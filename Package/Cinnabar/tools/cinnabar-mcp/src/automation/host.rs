//! Owns native player attachments, renderer processes, leases and events.

use std::{
    collections::{HashMap, HashSet, VecDeque},
    thread,
    time::{Duration, Instant},
};

use serde_json::{Value, json};

use super::{
    http::Endpoint,
    relay::Relay,
    renderer::{LaunchConfig, Renderer},
    wire::{self, Failure, Result, remaining},
};

pub const CAPABILITIES: &[&str] = &[
    "NativeSession",
    "VirtualInput",
    "HiddenRenderer",
    "VisibleRenderer",
    "Observations",
];
const SESSION_LIMIT: usize = 16;
const TERMINAL_LIMIT: usize = 256;
const EVENT_LIMIT: usize = 256;
const TICK_POLL: Duration = Duration::from_millis(10);

struct Session {
    owner: usize,
    state: Value,
    origin: Instant,
    renderer: Option<Renderer>,
}

#[derive(Default)]
struct Events {
    sequence: u64,
    records: VecDeque<Value>,
}

impl Events {
    fn push(&mut self, state: &Value) {
        self.sequence += 1;
        self.records.push_back(json!({"v":1,"kind":"event","event":"SessionChanged","sequence":self.sequence,"value":state}));
        if self.records.len() > EVENT_LIMIT {
            self.records.pop_front();
        }
    }

    fn page(&self, args: &Value) -> Result<Value> {
        let after = args["after"].as_u64().unwrap_or_default();
        if self
            .records
            .front()
            .and_then(|first| first["sequence"].as_u64())
            .is_some_and(|first| after + 1 < first)
        {
            return Err(Failure::new("ResourceLimit", "Event cursor has expired"));
        }
        let limit = args["limit"].as_u64().unwrap_or(128) as usize;
        let mut bytes = 512;
        let mut events = Vec::new();
        for event in &self.records {
            if event["sequence"].as_u64().unwrap_or_default() <= after
                || (args.get("session").is_some() && event["value"]["session"] != args["session"])
            {
                continue;
            }
            bytes += event.to_string().len() + 1;
            if bytes > wire::LIMIT {
                break;
            }
            events.push(event);
            if events.len() == limit {
                break;
            }
        }
        let next = events
            .last()
            .and_then(|event| event["sequence"].as_u64())
            .unwrap_or(after);
        Ok(json!({"events":events,"next":next}))
    }
}

pub struct Host {
    bridge: Endpoint,
    launch: LaunchConfig,
    sessions: HashMap<String, Session>,
    events: HashMap<usize, Events>,
    terminal: VecDeque<String>,
}

impl Host {
    pub fn new(bridge: Endpoint, launch: LaunchConfig) -> Self {
        Self {
            bridge,
            launch,
            sessions: HashMap::new(),
            events: HashMap::new(),
            terminal: VecDeque::new(),
        }
    }

    pub fn execute(
        &mut self,
        owner: usize,
        op: &str,
        args: &Value,
        deadline: Instant,
    ) -> Result<Value> {
        remaining(deadline)?;
        match op {
            "Attach" => return self.attach(owner, args, deadline),
            "PollEvents" => {
                if let Some(handle) = args.get("session") {
                    self.lookup(owner, handle)?;
                }
                return self.events.entry(owner).or_default().page(args);
            }
            "State" | "Detach" | "AcquireLease" | "ReleaseLease" | "GetBindings"
            | "SetBindings" | "Observe" | "DispatchInput" => {}
            _ => {
                return Err(Failure::new(
                    "UnsupportedCapability",
                    "This automation host does not provide the requested operation",
                ));
            }
        }
        let handle = &args["session"];
        let id = self.lookup(owner, handle)?;
        if self.sessions[&id].renderer.is_none() {
            return if op == "State" || op == "Detach" {
                Ok(self.sessions[&id].state.clone())
            } else {
                Err(stale())
            };
        }
        match op {
            "State" => {
                let result = self.refresh(&id, deadline);
                if self.sessions[&id].renderer.is_some() {
                    result?;
                }
                Ok(self.sessions[&id].state.clone())
            }
            "Detach" => {
                let result = self.bridge.call("Detach", args.clone(), deadline);
                match result {
                    Ok(state) => {
                        if state["session"] != *handle || state["phase"] != "ended" {
                            self.abandon(&id);
                            return Err(Failure::new(
                                "Disconnected",
                                "Bridge returned inconsistent detach state",
                            ));
                        }
                        self.update(&id, state.clone(), deadline)?;
                        Ok(state)
                    }
                    Err(error) => {
                        self.abandon(&id);
                        Err(error)
                    }
                }
            }
            "AcquireLease" | "ReleaseLease" => {
                self.refresh(&id, deadline)?;
                self.active(&id)?;
                if op == "ReleaseLease" && self.sessions[&id].state["lease"] == args["lease"] {
                    *self.active(&id)?.relay.lease.write().expect("relay lease") = None;
                }
                let result = self.bridge.call(op, args.clone(), deadline);
                match result {
                    Ok(value) => {
                        if let Err(error) = self.refresh(&id, deadline) {
                            self.abandon(&id);
                            return Err(error);
                        }
                        if op == "AcquireLease" && self.sessions[&id].state["lease"] != value {
                            return Err(Failure::new(
                                "LeaseLost",
                                "Native lease was revoked before it became usable",
                            ));
                        }
                        Ok(value)
                    }
                    Err(error) => {
                        if matches!(error.code(), "Timeout" | "Disconnected") {
                            self.abandon(&id);
                        }
                        Err(error)
                    }
                }
            }
            "GetBindings" | "SetBindings" => {
                self.refresh(&id, deadline)?;
                let renderer = self.active(&id)?;
                if op == "GetBindings" {
                    return Ok(renderer.bindings.clone());
                }
                let mut actions = HashSet::new();
                if args["bindings"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .any(|binding| !actions.insert(binding["action"].as_str()))
                {
                    return Err(Failure::new(
                        "Malformed",
                        "Binding list contains duplicate actions",
                    ));
                }
                renderer.bindings = args["bindings"].clone();
                Ok(Value::Null)
            }
            "Observe" => {
                self.refresh(&id, deadline)?;
                self.active(&id)?;
                self.observe(&id, args.clone(), deadline)
            }
            "DispatchInput" => self.dispatch(&id, args, deadline),
            _ => Err(Failure::new(
                "UnsupportedCapability",
                "This automation host does not provide the requested operation",
            )),
        }
    }

    fn lookup(&self, owner: usize, handle: &Value) -> Result<String> {
        let id = handle["sessionId"].as_str().ok_or_else(stale)?;
        let session = self
            .sessions
            .get(id)
            .filter(|session| session.state["session"] == *handle)
            .ok_or_else(stale)?;
        if session.owner != owner {
            return Err(Failure::new(
                "Unauthorized",
                "This credential does not own the session",
            ));
        }
        Ok(id.to_owned())
    }

    fn attach(&mut self, owner: usize, args: &Value, deadline: Instant) -> Result<Value> {
        if args["fixedClock"] == true {
            return Err(Failure::new(
                "UnsupportedCapability",
                "Native player sessions use a real-time clock",
            ));
        }
        if self
            .sessions
            .values()
            .filter(|session| session.renderer.is_some())
            .count()
            >= SESSION_LIMIT
        {
            return Err(Failure::new(
                "ResourceLimit",
                "Too many active renderer sessions",
            ));
        }
        if self.sessions.values().any(|session| {
            session.renderer.is_some()
                && session.state["session"]["player"]["entityId"] == args["entityId"]
        }) {
            return Err(Failure::new(
                "AlreadyAttached",
                "A renderer already owns this player",
            ));
        }
        let capabilities = self
            .bridge
            .hello("host", "bridge", deadline)
            .map_err(|error| {
                if error.code() == "Disconnected" {
                    Failure::new("ExtensionMissing", "Native bridge is unavailable")
                } else {
                    error
                }
            })?;
        if !capabilities
            .as_array()
            .is_some_and(|list| list.contains(&json!("NativeSession")))
        {
            return Err(Failure::new(
                "UnsupportedCapability",
                "Bridge cannot attach native players",
            ));
        }
        let origin = Instant::now();
        let mut args = args.clone();
        if args.get("renderer").is_none() {
            args["renderer"] = json!("hidden");
        }
        let response = self.bridge.call("Attach", args.clone(), deadline)?;
        let state = &response["state"];
        let handle = &state["session"];
        let id = handle["sessionId"].as_str().unwrap_or_default().to_owned();

        let setup = (|| {
            if handle["runId"] != args["runId"]
                || handle["player"]["entityId"] != args["entityId"]
                || state["renderer"] != args["renderer"]
                || self.sessions.contains_key(&id)
            {
                return Err(Failure::new(
                    "Disconnected",
                    "Bridge returned an inconsistent attachment",
                ));
            }
            if response.get("packets").is_none() {
                return Err(Failure::new(
                    "Disconnected",
                    "Bridge omitted the packet endpoint",
                ));
            }
            let relay = Relay::start(handle.clone(), &response["packets"], deadline)?;
            let mut renderer = Renderer::launch(&self.launch, state, relay, deadline)?;
            let ready = loop {
                let state = self
                    .bridge
                    .call("State", json!({"session":handle}), deadline)?;
                if state["session"] != *handle {
                    return Err(Failure::new(
                        "Disconnected",
                        "Bridge returned a different session while the renderer was launching",
                    ));
                }
                if state["phase"] == "ended" {
                    return Err(Failure::new(
                        "Disconnected",
                        "Native player attachment ended during launch",
                    ));
                }
                if !renderer.running() {
                    return Err(Failure::new(
                        "Disconnected",
                        "Renderer process or packet transport ended during launch",
                    ));
                }
                if state["phase"] == "ready" {
                    break state;
                }
                thread::sleep(TICK_POLL.min(remaining(deadline)?));
            };
            renderer.sync(&ready, deadline)?;
            remaining(deadline)?;
            Ok((ready, renderer))
        })();
        match setup {
            Ok((state, renderer)) => {
                self.events.entry(owner).or_default().push(&state);
                self.sessions.insert(
                    id,
                    Session {
                        owner,
                        state: state.clone(),
                        origin,
                        renderer: Some(renderer),
                    },
                );
                Ok(json!({"state":state}))
            }
            Err(error) => {
                let _ = self
                    .bridge
                    .call("Detach", json!({"session":handle}), cleanup_deadline());
                Err(error)
            }
        }
    }

    fn active(&mut self, id: &str) -> Result<&mut Renderer> {
        self.sessions
            .get_mut(id)
            .and_then(|session| session.renderer.as_mut())
            .ok_or_else(stale)
    }

    fn refresh(&mut self, id: &str, deadline: Instant) -> Result<()> {
        let session = &self.sessions[id];
        if session.renderer.is_none() {
            return Ok(());
        }
        let handle = session.state["session"].clone();
        let state = match self
            .bridge
            .call("State", json!({"session":handle}), deadline)
        {
            Ok(state) => state,
            Err(error) => {
                if matches!(error.code(), "StaleSession" | "Disconnected" | "Shutdown") {
                    let reason = if error.code() == "Shutdown" {
                        "shutdown"
                    } else {
                        "disconnected"
                    };
                    self.end(id, reason);
                }
                return Err(error);
            }
        };
        if state["session"] != handle {
            self.abandon(id);
            return Err(Failure::new(
                "Disconnected",
                "Bridge returned mismatched state",
            ));
        }
        self.update(id, state, deadline)?;
        if self.sessions[id].renderer.is_some() && !self.active(id)?.running() {
            self.abandon(id);
            return Err(Failure::new(
                "Disconnected",
                "Renderer process or packet transport ended",
            ));
        }
        Ok(())
    }

    fn update(&mut self, id: &str, state: Value, deadline: Instant) -> Result<()> {
        if state["phase"] != "ended" {
            if let Err(error) = self.active(id)?.sync(&state, deadline) {
                self.abandon(id);
                return Err(error);
            }
        }
        let session = self.sessions.get_mut(id).expect("known session");
        if session.state != state {
            self.events.entry(session.owner).or_default().push(&state);
            session.state = state;
        }
        if session.state["phase"] == "ended" && session.renderer.take().is_some() {
            self.remember_terminal(id);
        }
        Ok(())
    }

    fn remember_terminal(&mut self, id: &str) {
        self.terminal.push_back(id.to_owned());
        if self.terminal.len() > TERMINAL_LIMIT
            && let Some(expired) = self.terminal.pop_front()
        {
            self.sessions.remove(&expired);
        }
    }

    fn end(&mut self, id: &str, reason: &str) {
        let session = self.sessions.get_mut(id).expect("known session");
        if session.renderer.take().is_none() {
            return;
        }
        session.state["phase"] = json!("ended");
        session.state["endReason"] = json!(reason);
        session
            .state
            .as_object_mut()
            .expect("validated state")
            .remove("lease");
        self.events
            .entry(session.owner)
            .or_default()
            .push(&session.state);
        self.remember_terminal(id);
    }

    fn abandon(&mut self, id: &str) {
        let mut detached = false;
        if let Ok(renderer) = self.active(id) {
            *renderer.relay.lease.write().expect("relay lease") = None;
            let handle = &self.sessions[id].state["session"];
            detached = self
                .bridge
                .call("Detach", json!({"session":handle}), cleanup_deadline())
                .is_ok();
        }
        self.end(id, if detached { "failed" } else { "disconnected" });
    }

    fn observe(&self, id: &str, args: Value, deadline: Instant) -> Result<Value> {
        let mut observation = self.bridge.call("Observe", args, deadline)?;
        let session = &self.sessions[id];
        if observation["session"] != session.state["session"] {
            return Err(Failure::new(
                "Disconnected",
                "Observation belongs to a different session",
            ));
        }
        observation["observed"]["monotonicMs"] =
            json!(session.origin.elapsed().as_secs_f64() * 1000.0);
        Ok(observation)
    }

    fn dispatch(&mut self, id: &str, args: &Value, deadline: Instant) -> Result<Value> {
        self.refresh(id, deadline)?;
        self.check_lease(id, &args["lease"])?;
        let target = json!({"session":args["session"]});
        let command = &args["command"];
        let controls = match self.active(id)?.apply(command, deadline) {
            Ok(controls) => controls,
            Err(error) => {
                if error.code() != "Malformed" {
                    self.abandon(id);
                }
                return Err(error);
            }
        };
        let result: Result<Value> = (|| {
            let before = self.observe(id, target.clone(), deadline)?;
            let initial = tick(&before)?;
            let elapsed = if command["kind"] == "press" {
                command["ticks"].as_u64().unwrap_or(1)
            } else {
                1
            };
            let completes = initial.saturating_add(elapsed);
            loop {
                self.refresh(id, deadline)?;
                self.check_lease(id, &args["lease"])?;
                let observation = self.observe(id, target.clone(), deadline)?;
                if tick(&observation)? >= completes {
                    self.active(id)?.release_press(controls, deadline)?;
                    return Ok(json!({"applied":observation["observed"]}));
                }
                thread::sleep(TICK_POLL.min(remaining(deadline)?));
            }
        })();
        if let Err(error) = &result {
            if !matches!(error.code(), "NotReady" | "LeaseLost" | "StaleSession") {
                self.abandon(id);
            }
        }
        result
    }

    fn check_lease(&self, id: &str, lease: &Value) -> Result<()> {
        let state = &self.sessions[id].state;
        if state["lease"] != *lease || lease["owner"] != "virtual" {
            return Err(Failure::new(
                "LeaseLost",
                "Input requires the current virtual control lease",
            ));
        }
        if state["phase"] != "ready" || state["alive"] != true {
            return Err(Failure::new(
                "NotReady",
                "Native player is not ready for input",
            ));
        }
        Ok(())
    }

    pub fn maintain(&mut self) {
        let ids: Vec<_> = self
            .sessions
            .iter()
            .filter(|(_, session)| session.renderer.is_some())
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            let _ = self.refresh(&id, Instant::now() + Duration::from_millis(200));
        }
    }

    pub fn shutdown(&mut self) {
        let ids: Vec<_> = self
            .sessions
            .iter()
            .filter(|(_, session)| session.renderer.is_some())
            .map(|(id, _)| id.clone())
            .collect();
        for id in ids {
            let session = &self.sessions[&id];
            if let Some(renderer) = &session.renderer {
                *renderer.relay.lease.write().expect("relay lease") = None;
            }
            let _ = self.bridge.call(
                "Detach",
                json!({"session":session.state["session"]}),
                cleanup_deadline(),
            );
            self.end(&id, "shutdown");
        }
    }
}

fn tick(observation: &Value) -> Result<u64> {
    observation["observed"]["tick"]
        .as_u64()
        .ok_or_else(|| Failure::new("Disconnected", "Bridge omitted the server tick"))
}

fn stale() -> Failure {
    Failure::new("StaleSession", "Session handle is stale")
}

fn cleanup_deadline() -> Instant {
    Instant::now() + Duration::from_millis(500)
}
