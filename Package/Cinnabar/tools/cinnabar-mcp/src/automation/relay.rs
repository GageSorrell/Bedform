//! Adapts the native packet bind to the client session wire without a game login.

use std::{
    io::{self, Read, Write},
    net::{Ipv4Addr, Shutdown, SocketAddr, TcpListener, TcpStream},
    sync::{
        Arc, Mutex, RwLock,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

use serde_json::{Value, json};

use super::wire::{self, Failure, Result, remaining};

const MAX_FRAME: usize = 64 * 1024 * 1024;
const CONNECT: u8 = 1;
const BATCH: u8 = 2;
const HANDOFF: u8 = 3;
const DISCONNECT: u8 = 6;

pub struct Relay {
    pub address: SocketAddr,
    pub lease: Arc<RwLock<Option<Value>>>,
    pub token: String,
    stop: Arc<AtomicBool>,
    sockets: Arc<Mutex<Vec<TcpStream>>>,
    thread: Option<JoinHandle<()>>,
}

impl Relay {
    pub fn start(session: Value, endpoint: &Value, deadline: Instant) -> Result<Self> {
        let launch_failed = |_| Failure::new("LaunchFailed", "Could not create the renderer relay");
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(launch_failed)?;
        listener.set_nonblocking(true).map_err(launch_failed)?;
        let address = listener.local_addr().map_err(launch_failed)?;
        let port = endpoint["port"].as_u64().unwrap_or_default() as u16;
        let mut native = TcpStream::connect_timeout(
            &SocketAddr::from((Ipv4Addr::LOCALHOST, port)),
            remaining(deadline)?,
        )
        .map_err(|_| {
            Failure::new(
                "Disconnected",
                "Could not connect to the native packet endpoint",
            )
        })?;
        native
            .set_write_timeout(Some(remaining(deadline)?))
            .map_err(launch_failed)?;
        let bind = json!({"v":1,"session":session,"token":endpoint["token"]});
        write_frame(&mut native, bind.to_string().as_bytes())
            .map_err(|_| Failure::new("Disconnected", "Native packet bind failed"))?;
        native.set_write_timeout(None).map_err(launch_failed)?;
        native.set_nodelay(true).map_err(launch_failed)?;

        let stop = Arc::new(AtomicBool::new(false));
        let sockets = Arc::new(Mutex::new(vec![native.try_clone().map_err(launch_failed)?]));
        let lease = Arc::new(RwLock::new(None));
        let token = super::random_token()
            .map_err(|_| Failure::new("Internal", "Could not create a renderer credential"))?;
        let offered = token.clone();
        let (stopping, connections, active) = (stop.clone(), sockets.clone(), lease.clone());
        let thread = thread::spawn(move || {
            let _ = transfer(
                listener,
                native,
                &session,
                &active,
                &stopping,
                &connections,
                deadline,
                &offered,
            );
            close(&connections);
            stopping.store(true, Ordering::Release);
        });
        Ok(Self {
            address,
            lease,
            token,
            stop,
            sockets,
            thread: Some(thread),
        })
    }

    pub fn ended(&self) -> bool {
        self.stop.load(Ordering::Acquire)
    }
}

impl Drop for Relay {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Release);
        close(&self.sockets);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

fn close(sockets: &Mutex<Vec<TcpStream>>) {
    for socket in sockets.lock().expect("relay sockets").iter() {
        let _ = socket.shutdown(Shutdown::Both);
    }
}

#[expect(
    clippy::too_many_arguments,
    reason = "separate packet endpoints, credentials and lifecycle handles"
)]
fn transfer(
    listener: TcpListener,
    mut native: TcpStream,
    session: &Value,
    lease: &RwLock<Option<Value>>,
    stop: &AtomicBool,
    sockets: &Mutex<Vec<TcpStream>>,
    deadline: Instant,
    token: &str,
) -> io::Result<()> {
    let mut client = loop {
        if stop.load(Ordering::Acquire) || Instant::now() >= deadline {
            return Ok(());
        }
        match listener.accept() {
            Ok((mut client, _)) => {
                client.set_nonblocking(false)?;
                if authenticate(&mut client, token, deadline).unwrap_or(false) {
                    break client;
                }
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10))
            }
            Err(error) => return Err(error),
        }
    };
    drop(listener);
    {
        let mut guard = sockets.lock().expect("relay sockets");
        if stop.load(Ordering::Acquire) {
            return Ok(());
        }
        guard.push(client.try_clone()?);
    }
    client.set_nodelay(true)?;
    client.set_read_timeout(Some(remaining(deadline).map_err(io::Error::other)?))?;
    let connect = read_frame(&mut client)?;
    if connect.first() != Some(&CONNECT)
        || !serde_json::from_slice::<Value>(&connect[1..]).is_ok_and(|value| value.is_object())
    {
        return Err(io::Error::other("Expected a renderer Connect frame"));
    }
    client.set_read_timeout(None)?;
    let mut native_output = native.try_clone()?;
    let mut client_input = client.try_clone()?;
    thread::scope(|scope| {
        scope.spawn(move || {
            let _ = send_ingress(&mut client_input, &mut native_output, session, lease);
            close(sockets);
        });
        let output = (|| {
            let mut handed_off = false;
            loop {
                let frame = read_frame(&mut native)?;
                match frame[0] {
                    HANDOFF if !handed_off => handed_off = true,
                    2 | 4 if handed_off => {}
                    DISCONNECT => {
                        write_frame(&mut client, &frame)?;
                        break;
                    }
                    _ => return Err(io::Error::other("Unexpected native packet frame")),
                }
                write_frame(&mut client, &frame)?;
            }
            Ok(())
        })();
        close(sockets);
        output
    })
}

/// Reads the renderer's one-time credential under an absolute admission deadline.
fn authenticate(client: &mut TcpStream, token: &str, deadline: Instant) -> io::Result<bool> {
    let deadline = deadline.min(Instant::now() + Duration::from_millis(250));
    let mut prefix = [0; 68];
    let mut offset = 0;
    while offset < prefix.len() {
        client.set_read_timeout(Some(remaining(deadline).map_err(io::Error::other)?))?;
        let received = client.read(&mut prefix[offset..])?;
        if received == 0 {
            return Ok(false);
        }
        offset += received;
    }
    Ok(prefix[..4] == 64u32.to_be_bytes()
        && std::str::from_utf8(&prefix[4..])
            .is_ok_and(|offered| developer_control::endpoint::token_matches(token, offered)))
}

fn send_ingress(
    client: &mut TcpStream,
    native: &mut TcpStream,
    session: &Value,
    lease: &RwLock<Option<Value>>,
) -> io::Result<()> {
    loop {
        // Snapshot the lease once a complete batch is accepted. The bridge checks it again at dispatch.
        let batch = read_frame(client)?;
        if batch[0] != BATCH {
            return Err(io::Error::other("Expected a renderer Batch frame"));
        }
        let mut ingress = json!({"v":1,"session":session});
        if let Some(active) = lease.read().expect("relay lease").as_ref() {
            ingress["lease"] = active.clone();
        }
        let metadata = ingress.to_string();
        let length = 4 + metadata.len() + batch.len();
        if metadata.len() > wire::LIMIT || length > MAX_FRAME {
            return Err(io::Error::other("Native ingress exceeds frame limit"));
        }
        native.write_all(&(length as u32).to_be_bytes())?;
        native.write_all(&(metadata.len() as u32).to_be_bytes())?;
        native.write_all(metadata.as_bytes())?;
        native.write_all(&batch)?;
    }
}

fn read_frame(stream: &mut TcpStream) -> io::Result<Vec<u8>> {
    let mut length = [0; 4];
    stream.read_exact(&mut length)?;
    let length = u32::from_be_bytes(length) as usize;
    if !(1..=MAX_FRAME).contains(&length) {
        return Err(io::Error::other("Invalid session frame length"));
    }
    let mut frame = vec![0; length];
    stream.read_exact(&mut frame)?;
    Ok(frame)
}

fn write_frame(stream: &mut TcpStream, frame: &[u8]) -> io::Result<()> {
    stream.write_all(&(frame.len() as u32).to_be_bytes())?;
    stream.write_all(frame)
}
