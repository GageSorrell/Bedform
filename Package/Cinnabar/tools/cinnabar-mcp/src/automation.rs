//! Bedform's authenticated local automation host and its stdio MCP client.

mod host;
mod http;
mod relay;
mod renderer;
mod wire;

use std::{
    collections::HashSet,
    fs::{self, File},
    io::Write,
    net::{Ipv4Addr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread,
    time::{Duration, Instant},
};

use developer_control::endpoint::token_matches;
use mcp_stdio::ToolServer;
use serde::Deserialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use self::{
    host::{CAPABILITIES, Host},
    http::Endpoint,
    renderer::LaunchConfig,
    wire::{Failure, Result as WireResult, remaining},
};

const LOCAL_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_CONNECTIONS: usize = 32;

pub fn cli() -> Option<Result<(), String>> {
    let mut args = std::env::args_os().skip(1);
    let mode = args.next()?;
    if mode != "--automation-host" && mode != "--automation-stdio" {
        return None;
    }
    Some(match (args.next(), args.next()) {
        (Some(path), None) if mode == "--automation-host" => serve_host(Path::new(&path)),
        (Some(path), None) => serve_stdio(Path::new(&path)),
        _ => Err("Supply one configuration file for --automation-host or one discovery file for --automation-stdio".into()),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Config {
    compatibility: PathBuf,
    bridge_endpoint: PathBuf,
    renderer_executable: PathBuf,
    #[serde(default)]
    renderer_arguments: Vec<String>,
    assets: PathBuf,
    run_directory: PathBuf,
    script_endpoints: Vec<PathBuf>,
    #[serde(default)]
    provisioner_endpoint: Option<PathBuf>,
    #[serde(default)]
    port: u16,
    #[serde(default)]
    shutdown_on_stdin_close: bool,
}

struct Credential {
    token: String,
    role: &'static str,
    accepted: AtomicBool,
}

struct Runtime {
    compatibility: Value,
    credentials: Vec<Credential>,
    in_flight: Mutex<HashSet<(usize, String)>>,
    connections: AtomicUsize,
    stop: Arc<AtomicBool>,
    host: Mutex<Host>,
}

impl Runtime {
    fn execute(&self, token: &str, request: &Value, accepted_at: Instant) -> WireResult<Value> {
        let (owner, credential) = self
            .credentials
            .iter()
            .enumerate()
            .find(|(_, credential)| token_matches(&credential.token, token))
            .ok_or_else(|| Failure::new("Unauthorized", "Invalid automation credential"))?;
        if request["v"] != 1 {
            return Err(Failure::new(
                "UnsupportedVersion",
                "Unsupported automation version",
            ));
        }
        let op = request["op"].as_str().unwrap_or_default();
        if !wire::valid("Request", request) {
            let unknown_action =
                (op == "DispatchInput" || op == "SetBindings") && wire::unknown_action(request);
            return Err(if unknown_action {
                Failure::new("UnknownAction", "Input action is outside the v1 registry")
            } else {
                Failure::new("Malformed", "Request does not match the v1 schema")
            });
        }
        let deadline = accepted_at
            + Duration::from_millis(
                request["timeoutMs"]
                    .as_u64()
                    .unwrap_or(wire::DEFAULT_TIMEOUT),
            );
        remaining(deadline)?;
        let key = (owner, request["id"].as_str().unwrap_or_default().to_owned());
        if !self
            .in_flight
            .lock()
            .expect("request IDs")
            .insert(key.clone())
        {
            return Err(Failure::new(
                "Malformed",
                "This request ID is already in flight",
            ));
        }
        let result = self.dispatch(owner, credential, op, &request["args"], deadline);
        self.in_flight.lock().expect("request IDs").remove(&key);
        result
    }

    fn dispatch(
        &self,
        owner: usize,
        credential: &Credential,
        op: &str,
        args: &Value,
        deadline: Instant,
    ) -> WireResult<Value> {
        if self.stop.load(Ordering::Acquire) {
            return Err(Failure::new(
                "Shutdown",
                "The automation host is shutting down",
            ));
        }
        if op == "Hello" {
            if args["role"] != credential.role {
                return Err(Failure::new("Unauthorized", "Wrong credential role"));
            }
            if args["compatibility"] != self.compatibility {
                return Err(Failure::new(
                    "Incompatible",
                    "Compatibility tuple does not match",
                ));
            }
            credential.accepted.store(true, Ordering::Release);
            return Ok(
                json!({"role":"host","compatibility":self.compatibility,"capabilities":CAPABILITIES}),
            );
        }
        if !credential.accepted.load(Ordering::Acquire)
            || (credential.role == "provisioner" && op != "Capabilities")
        {
            return Err(Failure::new(
                "Unauthorized",
                "Operation requires an authorized handshake",
            ));
        }
        if op == "Capabilities" {
            return Ok(json!(CAPABILITIES));
        }
        if !wire::roles(op).is_some_and(|roles| roles.iter().any(|role| role == "host")) {
            return Err(Failure::new(
                "UnsupportedCapability",
                "The host does not receive this operation",
            ));
        }
        loop {
            let available = remaining(deadline)?;
            if self.stop.load(Ordering::Acquire) {
                return Err(Failure::new(
                    "Shutdown",
                    "The automation host is shutting down",
                ));
            }
            if let Ok(mut host) = self.host.try_lock() {
                return host.execute(owner, op, args, deadline);
            }
            thread::sleep(available.min(Duration::from_millis(5)));
        }
    }
}

struct Connection(Arc<Runtime>);

impl Drop for Connection {
    fn drop(&mut self) {
        self.0.connections.fetch_sub(1, Ordering::Release);
    }
}

fn handle(connection: Connection, mut stream: TcpStream) {
    let message = match http::read_message(&mut stream, Instant::now() + LOCAL_TIMEOUT) {
        Ok(message) => message,
        Err(status) => {
            http::respond(stream, status, None);
            return;
        }
    };
    let accepted = Instant::now();
    if !matches!(
        message.first.as_str(),
        "POST /automation/v1 HTTP/1.1" | "POST /automation/v1 HTTP/1.0"
    ) {
        http::respond(stream, 400, None);
        return;
    }
    let Ok(request) = serde_json::from_slice::<Value>(&message.body) else {
        http::respond(stream, 400, None);
        return;
    };
    if !wire::valid_id(&request["id"]) {
        http::respond(stream, 400, None);
        return;
    }
    let result = connection.0.execute(
        message.token.as_deref().unwrap_or_default(),
        &request,
        accepted,
    );
    http::respond(stream, 200, Some(wire::response(&request, result)));
}

fn serve_host(path: &Path) -> Result<(), String> {
    let path = path
        .canonicalize()
        .map_err(|error| format!("Read host configuration: {error}"))?;
    let config: Config =
        serde_json::from_reader(File::open(&path).map_err(|error| error.to_string())?)
            .map_err(|_| "Invalid automation host configuration")?;
    let base = path
        .parent()
        .ok_or("Host configuration must have a parent directory")?;
    let compatibility = installed_compatibility(&base.join(config.compatibility))?;
    let bridge = Endpoint::read(&base.join(config.bridge_endpoint), "bridge")?;
    if bridge.compatibility != compatibility {
        return Err("Bridge discovery and installed compatibility do not match".into());
    }
    if !(1..=16).contains(&config.script_endpoints.len()) {
        return Err("Configure between one and sixteen private script endpoints".into());
    }
    let listener =
        TcpListener::bind((Ipv4Addr::LOCALHOST, config.port)).map_err(|error| error.to_string())?;
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    let stop = Arc::new(AtomicBool::new(false));
    let stopping = stop.clone();
    ctrlc::set_handler(move || {
        stopping.store(true, Ordering::Release);
    })
    .map_err(|error| error.to_string())?;
    if config.shutdown_on_stdin_close {
        let stopping = stop.clone();
        thread::spawn(move || {
            let _ = std::io::copy(&mut std::io::stdin().lock(), &mut std::io::sink());
            stopping.store(true, Ordering::Release);
        });
    }
    let mut publications = Vec::new();
    let mut credentials = Vec::new();
    for (role, name) in config
        .script_endpoints
        .into_iter()
        .map(|name| ("script", name))
        .chain(
            config
                .provisioner_endpoint
                .into_iter()
                .map(|name| ("provisioner", name)),
        )
    {
        let token = random_token()?;
        let path = base.join(name);
        let endpoint = json!({"v":1,"host":"127.0.0.1","port":port,"token":token,"role":"host","compatibility":compatibility});
        publications.push(publish(&path, &endpoint)?);
        credentials.push(Credential {
            token,
            role,
            accepted: AtomicBool::new(false),
        });
    }
    let root = base.join(config.run_directory);
    if !root.is_dir() {
        return Err("The private run directory must already exist".into());
    }
    let launch = LaunchConfig {
        executable: base.join(config.renderer_executable),
        assets: base.join(config.assets),
        root,
        arguments: config.renderer_arguments,
    };
    let runtime = Arc::new(Runtime {
        compatibility,
        credentials,
        in_flight: Mutex::default(),
        connections: AtomicUsize::new(0),
        stop,
        host: Mutex::new(Host::new(bridge, launch)),
    });
    let result = listen(&listener, &runtime);
    drop(publications);
    runtime.stop.store(true, Ordering::Release);
    runtime.host.lock().expect("host state").shutdown();
    result
}

fn listen(listener: &TcpListener, runtime: &Arc<Runtime>) -> Result<(), String> {
    let mut maintenance = Instant::now();
    while !runtime.stop.load(Ordering::Acquire) {
        match listener.accept() {
            Ok((socket, _)) => {
                if socket.set_nonblocking(false).is_err() {
                    continue;
                }
                let count = runtime.connections.fetch_add(1, Ordering::AcqRel);
                let connection = Connection(runtime.clone());
                if count >= MAX_CONNECTIONS {
                    drop(connection);
                    drop(socket);
                } else {
                    thread::spawn(move || handle(connection, socket));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10))
            }
            Err(error) => return Err(format!("Automation listener failed: {error}")),
        }
        if Instant::now() >= maintenance {
            if let Ok(mut host) = runtime.host.try_lock() {
                host.maintain();
            }
            maintenance = Instant::now() + Duration::from_millis(100);
        }
    }
    Ok(())
}

/// Discovery files inherit the private directory's Windows ACL and are owner-only on Unix.
fn publish(path: &Path, endpoint: &Value) -> Result<Publication, String> {
    let parent = path
        .parent()
        .ok_or("Discovery file must have a parent directory")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|error| format!("Create discovery file: {error}"))?;
    temp.write_all(endpoint.to_string().as_bytes())
        .and_then(|()| temp.as_file().sync_all())
        .map_err(|error| format!("Write discovery file: {error}"))?;
    temp.persist_noclobber(path)
        .map_err(|error| format!("Publish discovery file: {}", error.error))?;
    Ok(Publication(path.to_owned()))
}

struct Publication(PathBuf);

impl Drop for Publication {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

fn installed_compatibility(path: &Path) -> Result<Value, String> {
    let bytes = fs::read(path).map_err(|error| format!("Read installed compatibility: {error}"))?;
    let manifest: Value =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid installed compatibility JSON")?;
    let version = &manifest["bedformBdsVersion"];
    // The v1 native target has one qualified executable build. The current manifest omits the build number.
    if version != "1.26.60.6" {
        return Err("The BDS version has no qualified v1 native build".into());
    }
    let compatibility = json!({
        "platform":manifest["platform"], "bdsVersion":version, "bdsBuild":52886189,
        "wireProtocol":manifest["wireProtocol"], "loaderVersion":manifest["loaderVersion"],
        "sdkVersion":manifest["sdkVersion"], "preLoaderVersion":manifest["preLoaderVersion"],
        "compatibilitySha256":format!("{:x}", Sha256::digest(bytes)),
    });
    if !wire::valid("Compatibility", &compatibility) {
        return Err("Invalid installed compatibility tuple".into());
    }
    Ok(compatibility)
}

fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|_| "OS random generator unavailable")?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

const TOOLS: &[(&str, &str, &str)] = &[
    (
        "automation_capabilities",
        "Capabilities",
        "List the automation host's capabilities",
    ),
    (
        "automation_attach",
        "Attach",
        "Attach a renderer to an existing native simulated player",
    ),
    (
        "automation_detach",
        "Detach",
        "Detach the renderer from a native simulated player",
    ),
    (
        "automation_state",
        "State",
        "Read the state of an existing automation session",
    ),
    (
        "automation_acquire_lease",
        "AcquireLease",
        "Acquire exclusive native or virtual control",
    ),
    (
        "automation_release_lease",
        "ReleaseLease",
        "Release an active control lease",
    ),
    (
        "automation_dispatch_input",
        "DispatchInput",
        "Send tick-based virtual input using the active lease",
    ),
    (
        "automation_set_bindings",
        "SetBindings",
        "Replace a session's action bindings",
    ),
    (
        "automation_get_bindings",
        "GetBindings",
        "Read a session's action bindings",
    ),
    (
        "automation_observe",
        "Observe",
        "Read timestamped native player and world facts",
    ),
    (
        "automation_poll_events",
        "PollEvents",
        "Read the credential's ordered automation events",
    ),
];

struct AutomationStdio {
    endpoint: Endpoint,
}

fn serve_stdio(path: &Path) -> Result<(), String> {
    let endpoint = Endpoint::read(path, "host")?;
    endpoint
        .hello("script", "host", Instant::now() + LOCAL_TIMEOUT)
        .map_err(|error| error.to_string())?;
    mcp_stdio::serve(&mut AutomationStdio { endpoint });
    Ok(())
}

impl ToolServer for AutomationStdio {
    fn info(&self) -> (&'static str, &'static str) {
        ("cinnabar-mcp", env!("CARGO_PKG_VERSION"))
    }

    fn definitions(&self) -> Value {
        Value::Array(TOOLS.iter().map(|(name, op, description)| {
            json!({"name":name,"description":description,"inputSchema":wire::args_schema(op).expect("registered tool")})
        }).collect())
    }

    fn call(&mut self, name: &str, args: &Value) -> Value {
        let Some((_, op, _)) = TOOLS.iter().find(|(tool, _, _)| *tool == name) else {
            return mcp_stdio::text_content(
                &json!({"code":"UnsupportedCapability","message":"Unknown automation tool"}),
                true,
            );
        };
        let mut args = args.clone();
        let timeout = args
            .as_object_mut()
            .and_then(|fields| fields.remove("timeoutMs"));
        let milliseconds = match timeout {
            None => wire::DEFAULT_TIMEOUT,
            Some(value) => match value
                .as_u64()
                .filter(|value| (1..=wire::MAXIMUM_TIMEOUT).contains(value))
            {
                Some(value) => value,
                None => {
                    return mcp_stdio::text_content(
                        Failure::new("Malformed", "timeoutMs is outside the v1 range").value(),
                        true,
                    );
                }
            },
        };
        let deadline = Instant::now() + Duration::from_millis(milliseconds);
        match self.endpoint.call(op, args, deadline) {
            Ok(value) => mcp_stdio::text_content(&value, false),
            Err(error) => mcp_stdio::text_content(error.value(), true),
        }
    }
}
