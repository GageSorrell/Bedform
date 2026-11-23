//! Bounded loopback HTTP transport shared by the host and stdio adapter.

use std::{
    io::{self, BufRead, BufReader, Read, Write},
    net::{Ipv4Addr, Shutdown, SocketAddr, TcpStream},
    path::Path,
    time::Instant,
};

use serde_json::{Value, json};

use super::wire::{self, Failure, Result, remaining};

#[derive(Clone)]
pub struct Endpoint {
    pub port: u16,
    pub token: String,
    pub compatibility: Value,
}

impl Endpoint {
    pub fn read(path: &Path, role: &str) -> std::result::Result<Self, String> {
        let bytes = std::fs::read(path).map_err(|error| format!("Read endpoint: {error}"))?;
        let document: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid endpoint JSON")?;
        if !wire::valid("ControlEndpoint", &document) || document["role"] != role {
            return Err(format!("Expected a v1 {role} endpoint"));
        }
        Ok(Self {
            port: document["port"].as_u64().unwrap_or_default() as u16,
            token: document["token"].as_str().unwrap_or_default().into(),
            compatibility: document["compatibility"].clone(),
        })
    }

    pub fn exchange(&self, request: &Value, deadline: Instant) -> Result<Value> {
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, self.port));
        let mut socket =
            TcpStream::connect_timeout(&address, remaining(deadline)?).map_err(transport_error)?;
        let body = request.to_string();
        if body.len() > wire::LIMIT {
            return Err(Failure::new(
                "ResourceLimit",
                "Request exceeds the control byte limit",
            ));
        }
        socket
            .set_write_timeout(Some(remaining(deadline)?))
            .map_err(transport_error)?;
        write!(socket, "POST {} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            wire::PATH, self.port, self.token, body.len(), body).map_err(transport_error)?;
        let reply = read_message(&mut socket, deadline).map_err(|error| {
            if error == 408 {
                Failure::timeout()
            } else {
                Failure::new("Disconnected", "Peer returned invalid HTTP")
            }
        })?;
        if reply.first.split_ascii_whitespace().nth(1) != Some("200") {
            return Err(Failure::new(
                "Disconnected",
                "Peer rejected the HTTP request",
            ));
        }
        serde_json::from_slice(&reply.body)
            .map_err(|_| Failure::new("Disconnected", "Peer returned invalid JSON"))
    }

    pub fn call(&self, op: &str, args: Value, deadline: Instant) -> Result<Value> {
        let time = remaining(deadline)?
            .as_millis()
            .clamp(1, wire::MAXIMUM_TIMEOUT.into()) as u64;
        let id = super::random_token()
            .map_err(|_| Failure::new("Internal", "Could not generate a request ID"))?;
        let request = wire::request(&id, op, args, time);
        wire::outcome(&request, self.exchange(&request, deadline)?)
    }

    pub fn hello(&self, caller: &str, expected_peer: &str, deadline: Instant) -> Result<Value> {
        let welcome = self.call(
            "Hello",
            json!({"role":caller,"compatibility":self.compatibility}),
            deadline,
        )?;
        if welcome["role"] != expected_peer || welcome["compatibility"] != self.compatibility {
            return Err(Failure::new(
                "Incompatible",
                "Automation peer identity or compatibility does not match",
            ));
        }
        Ok(welcome["capabilities"].clone())
    }
}

fn transport_error(error: io::Error) -> Failure {
    if matches!(
        error.kind(),
        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
    ) {
        Failure::timeout()
    } else {
        Failure::new(
            "Disconnected",
            "Could not exchange data with the local peer",
        )
    }
}

pub struct Message {
    pub first: String,
    pub token: Option<String>,
    pub body: Vec<u8>,
}

pub fn read_message(
    socket: &mut TcpStream,
    deadline: Instant,
) -> std::result::Result<Message, u16> {
    fn status(error: io::Error) -> u16 {
        if matches!(
            error.kind(),
            io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
        ) {
            408
        } else {
            400
        }
    }
    let mut reader = BufReader::new(socket);
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() == 8192 {
            return Err(413);
        }
        let available = remaining(deadline).map_err(|_| 408u16)?;
        reader
            .get_ref()
            .set_read_timeout(Some(available))
            .map_err(status)?;
        let byte = *reader.fill_buf().map_err(status)?.first().ok_or(400u16)?;
        header.push(byte);
        reader.consume(1);
    }
    let header = std::str::from_utf8(&header).map_err(|_| 400u16)?;
    let mut lines = header.trim_end_matches("\r\n").split("\r\n");
    let first = lines.next().ok_or(400u16)?.to_owned();
    let mut length = None;
    let mut token = None;
    let mut authorization = false;
    for line in lines {
        let (key, value) = line.split_once(':').ok_or(400u16)?;
        let value = value.trim();
        if key.eq_ignore_ascii_case("content-length") {
            if length.is_some() {
                return Err(400);
            }
            length = Some(value.parse::<usize>().map_err(|_| 400u16)?);
        } else if key.eq_ignore_ascii_case("authorization") {
            if authorization {
                return Err(400);
            }
            authorization = true;
            token = value.strip_prefix("Bearer ").map(str::to_owned);
        } else if key.eq_ignore_ascii_case("transfer-encoding") {
            return Err(400);
        }
    }
    let length = length.ok_or(400u16)?;
    if length > wire::LIMIT {
        return Err(413);
    }
    let mut body = vec![0; length];
    let mut offset = 0;
    while offset < length {
        let available = remaining(deadline).map_err(|_| 408u16)?;
        reader
            .get_ref()
            .set_read_timeout(Some(available))
            .map_err(status)?;
        let count = reader.read(&mut body[offset..]).map_err(status)?;
        if count == 0 {
            return Err(400);
        }
        offset += count;
    }
    Ok(Message { first, token, body })
}

pub fn respond(mut stream: TcpStream, status: u16, value: Option<Value>) {
    let body = value.map_or_else(String::new, |value| value.to_string());
    let reason = match status {
        200 => "OK",
        408 => "Request Timeout",
        413 => "Content Too Large",
        503 => "Service Unavailable",
        _ => "Bad Request",
    };
    let _ = stream.set_write_timeout(Some(std::time::Duration::from_secs(2)));
    let _ = write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.shutdown(Shutdown::Write);
    if status == 413 {
        // Winsock can reset a socket closed with unread request bytes. Give a
        // rejected sender a bounded window to receive the response and finish.
        let deadline = Instant::now() + std::time::Duration::from_millis(50);
        let mut buffer = [0; 8192];
        let mut unread = wire::LIMIT + buffer.len();
        while unread > 0 {
            let Ok(time) = remaining(deadline) else { break };
            if stream.set_read_timeout(Some(time)).is_err() {
                break;
            }
            match stream.read(&mut buffer) {
                Ok(count) if count > 0 => unread = unread.saturating_sub(count),
                _ => break,
            }
        }
    }
}
