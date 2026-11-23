//! A private developer-control client and its session-local virtual input state.

use std::{
    collections::{BTreeSet, HashMap},
    path::{Path, PathBuf},
    thread,
    time::{Duration, Instant},
};

use developer_control::{
    ENDPOINT_ENV, HIDDEN_WINDOW_ENV, SIGN_IN_FIXTURE_ENV,
    client::Controller,
    input::InputPlan,
    protocol::{Command, Condition, InputCommand},
};
use serde_json::{Value, json};
use tempfile::TempDir;

use crate::processes::{Client, Launch};

use super::{
    relay::Relay,
    wire::{Failure, Result, remaining},
};

pub struct LaunchConfig {
    pub executable: PathBuf,
    pub arguments: Vec<String>,
    pub assets: PathBuf,
    pub root: PathBuf,
}

pub struct Renderer {
    client: Client,
    control: Controller,
    pub relay: Relay,
    pub bindings: Value,
    held: HashMap<String, BTreeSet<String>>,
    ready: bool,
    applied_lease: Option<Value>,
    _profile: TempDir,
}

impl Renderer {
    pub fn launch(
        config: &LaunchConfig,
        state: &Value,
        relay: Relay,
        deadline: Instant,
    ) -> Result<Self> {
        let failed = |_| {
            Failure::new(
                "DiskFailed",
                "Could not create the renderer session directory",
            )
        };
        let run = config.root.join(format!(
            "run-{}",
            state["session"]["runId"].as_str().unwrap_or_default()
        ));
        std::fs::create_dir_all(&run).map_err(failed)?;
        let session = tempfile::Builder::new()
            .prefix("session-")
            .tempdir_in(run)
            .map_err(failed)?
            .keep();
        let profile = tempfile::Builder::new()
            .prefix("profile-")
            .tempdir_in(&session)
            .map_err(failed)?;
        let path = profile.path();
        let endpoint = path.join("control.json");
        std::fs::write(path.join("session.addr"), format!("{}\n", relay.address))
            .map_err(failed)?;
        let mut args = config.arguments.clone();
        args.extend([
            "--socket-dir".into(),
            display(path),
            "--assets".into(),
            display(&config.assets),
            "--hide-toasts".into(),
        ]);
        let env = [
            (ENDPOINT_ENV.into(), display(&endpoint)),
            (
                HIDDEN_WINDOW_ENV.into(),
                if state["renderer"] == "hidden" {
                    "1"
                } else {
                    "0"
                }
                .into(),
            ),
            (SIGN_IN_FIXTURE_ENV.into(), "0".into()),
            (
                render_api::USER_ROOT_ENV.into(),
                display(&path.join("user")),
            ),
            ("BEDFORM_CINNABAR_RELAY_DIRECTORY".into(), display(path)),
            ("BEDFORM_CINNABAR_RELAY_TOKEN".into(), relay.token.clone()),
        ];
        let (client, endpoint) = Client::launch(Launch {
            binary: &config.executable,
            args: &args,
            env: &env,
            endpoint: &endpoint,
            log: session.join("renderer.log"),
            timeout: remaining(deadline)?,
        })
        .map_err(|_| {
            if remaining(deadline).is_err() {
                Failure::timeout()
            } else {
                Failure::new(
                    "LaunchFailed",
                    "Renderer exited or failed to publish its developer-control endpoint",
                )
            }
        })?;
        let control = Controller::connect_to(&endpoint).map_err(|_| {
            Failure::new("LaunchFailed", "Renderer control endpoint is unavailable")
        })?;
        let mut renderer = Self {
            client,
            control,
            relay,
            bindings: json!([]),
            held: HashMap::new(),
            ready: false,
            applied_lease: None,
            _profile: profile,
        };
        let timeout_ms = remaining(deadline)?.as_millis().clamp(1, 120000) as u64;
        renderer.call(
            &Command::WaitFor {
                condition: Condition::InWorld,
                timeout_ms: Some(timeout_ms),
            },
            deadline,
        )?;
        Ok(renderer)
    }

    pub fn running(&mut self) -> bool {
        self.client.running() && !self.relay.ended() && !self.control.is_broken()
    }

    pub fn sync(&mut self, state: &Value, deadline: Instant) -> Result<()> {
        let next = (state["phase"] == "ready"
            && state["alive"] == true
            && state["lease"]["owner"] == "virtual")
            .then(|| state["lease"].clone());
        let ready = state["phase"] == "ready" && state["alive"] == true;
        if self.applied_lease != next || self.ready != ready {
            *self.relay.lease.write().expect("relay lease") = None;
            self.clear(deadline)?;
            *self.relay.lease.write().expect("relay lease") = next.clone();
            self.applied_lease = next;
        }
        self.ready = ready;
        Ok(())
    }

    pub fn clear(&mut self, deadline: Instant) -> Result<()> {
        self.held.clear();
        self.input(
            InputCommand {
                release_all: true,
                ..Default::default()
            },
            deadline,
        )
    }

    /// Starts the command, returning the exact physical controls to release for a tick-based press.
    pub fn apply(&mut self, command: &Value, deadline: Instant) -> Result<Vec<String>> {
        let kind = command["kind"].as_str().unwrap_or_default();
        if kind == "releaseAll" {
            self.clear(deadline)?;
            return Ok(Vec::new());
        }
        let input = &command["input"];
        let key = input.to_string();
        if kind == "release" {
            if let Some(controls) = self.held.remove(&key) {
                let release = self.unheld(controls);
                self.input(
                    InputCommand {
                        release,
                        ..Default::default()
                    },
                    deadline,
                )?;
            }
            return Ok(Vec::new());
        }
        if kind == "hold" && self.held.contains_key(&key) {
            return Ok(Vec::new());
        }
        let mut steps = Vec::new();
        if input["kind"] == "action" {
            let action = &input["action"];
            if let Some(binding) = self
                .bindings
                .as_array()
                .into_iter()
                .flatten()
                .find(|binding| &binding["action"] == action)
            {
                for raw in binding["inputs"].as_array().into_iter().flatten() {
                    steps.push(raw_input(raw)?);
                }
            } else if let Some(binding) = default_binding(action.as_str().unwrap_or_default()) {
                steps.push(InputCommand {
                    hold: vec![binding],
                    ..Default::default()
                });
            }
        } else {
            steps.push(raw_input(input)?);
        }
        for step in &steps {
            InputPlan::from_command(step)
                .map_err(|_| Failure::new("Malformed", "Invalid developer-control input"))?;
        }
        let mut controls = BTreeSet::new();
        let mut pressed = Vec::new();
        for mut step in steps {
            step.hold.retain(|control| {
                controls.insert(control.clone())
                    && !self.held.values().any(|held| held.contains(control))
            });
            pressed.extend(step.hold.iter().cloned());
            self.input(step, deadline)?;
        }
        if kind == "hold" {
            self.held.insert(key, controls);
            Ok(Vec::new())
        } else {
            Ok(pressed)
        }
    }

    fn unheld(&self, controls: BTreeSet<String>) -> Vec<String> {
        controls
            .into_iter()
            .filter(|control| !self.held.values().any(|held| held.contains(control)))
            .collect()
    }

    pub fn release_press(&mut self, controls: Vec<String>, deadline: Instant) -> Result<()> {
        if controls.is_empty() {
            return Ok(());
        }
        self.input(
            InputCommand {
                release: controls,
                ..Default::default()
            },
            deadline,
        )
    }

    fn input(&mut self, input: InputCommand, deadline: Instant) -> Result<()> {
        InputPlan::from_command(&input)
            .map_err(|_| Failure::new("Malformed", "Invalid developer-control input"))?;
        self.call(&Command::Input(input), deadline).map(|_| ())
    }

    fn call(&mut self, command: &Command, deadline: Instant) -> Result<Value> {
        let timeout = remaining(deadline)?;
        self.control.call(command, timeout).map_err(|error| {
            if error.starts_with("no reply within") || remaining(deadline).is_err() {
                Failure::timeout()
            } else if self.control.is_broken() {
                Failure::new("Disconnected", "Renderer control connection ended")
            } else {
                Failure::new("LaunchFailed", "Renderer rejected the control command")
            }
        })
    }
}

impl Drop for Renderer {
    fn drop(&mut self) {
        *self.relay.lease.write().expect("relay lease") = None;
        if self.client.running() {
            let _ = self
                .control
                .call(&Command::Quit, Duration::from_millis(300));
            let deadline = Instant::now() + Duration::from_millis(300);
            while self.client.running() && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(10));
            }
        }
    }
}

fn display(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

fn default_binding(action: &str) -> Option<String> {
    let name = action.strip_prefix("@bedform/server-gametest/InputAction!")?;
    Some(
        match name {
            "Use" => "key.use",
            "Attack" => "key.attack",
            "Sneak" => "key.sneak",
            "Jump" => "key.jump",
            "Sprint" => "key.sprint",
            "MoveForward" => "key.forward",
            "MoveBackward" => "key.back",
            "MoveLeft" => "key.left",
            "MoveRight" => "key.right",
            "Inventory" => "key.inventory",
            "Drop" => "key.drop",
            "Chat" => "key.chat",
            "Confirm" => "Enter",
            "Cancel" | "Pause" => "Escape",
            "Perspective" => "key.togglePerspective",
            slot => {
                return slot
                    .strip_prefix("Hotbar")
                    .map(|slot| format!("key.hotbar.{slot}"));
            }
        }
        .into(),
    )
}

fn raw_input(raw: &Value) -> Result<InputCommand> {
    let hold = |controls| {
        Ok(InputCommand {
            hold: controls,
            ..Default::default()
        })
    };
    let update = match raw["kind"].as_str().unwrap_or_default() {
        "key" => return hold(vec![raw["code"].as_str().unwrap_or_default().into()]),
        "mouseButton" => {
            let button = raw["button"].as_str().unwrap_or_default();
            let mut chars = button.chars();
            let button = chars
                .next()
                .map(|first| format!("Mouse{}{}", first.to_ascii_uppercase(), chars.as_str()));
            return hold(button.into_iter().collect());
        }
        "movement" => {
            let mut controls = Vec::new();
            for (axis, positive, negative) in [
                ("forward", "key.forward", "key.back"),
                ("right", "key.right", "key.left"),
            ] {
                let value = raw[axis].as_f64().unwrap_or_default();
                if value != 0.0 {
                    controls.push(if value > 0.0 { positive } else { negative }.into());
                }
            }
            return hold(controls);
        }
        "look" => json!({"look":{"yaw":raw["yaw"],"pitch":raw["pitch"]}}),
        "pointer" => json!({"pointer":{"x":raw["x"],"y":raw["y"]}}),
        "wheel" => json!({"wheel":{"x":raw["x"],"y":raw["y"]}}),
        "text" => json!({"text":raw["text"]}),
        _ => return Err(Failure::new("Malformed", "Unrecognized raw input")),
    };
    serde_json::from_value(update)
        .map_err(|_| Failure::new("Malformed", "Input exceeds renderer numeric range"))
}
