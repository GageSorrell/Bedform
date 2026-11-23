//! Validation and request correlation for the frozen v1 contract.

use std::{
    collections::HashMap,
    sync::LazyLock,
    time::{Duration, Instant},
};

use regex::Regex;
use serde_json::{Map, Value, json};

pub const PATH: &str = "/automation/v1";
pub const LIMIT: usize = 65536;
pub const DEFAULT_TIMEOUT: u64 = 10000;
pub const MAXIMUM_TIMEOUT: u64 = 120000;
const SCHEMA: &str = include_str!("../../../../Bedform/Contract/automation-v1.schema.json");

static DOCUMENT: LazyLock<Value> =
    LazyLock::new(|| serde_json::from_str(SCHEMA).expect("checked-in automation schema"));
static PATTERNS: LazyLock<HashMap<String, Regex>> = LazyLock::new(|| {
    fn collect(value: &Value, patterns: &mut HashMap<String, Regex>) {
        if let Some(pattern) = value["pattern"].as_str() {
            patterns
                .entry(pattern.to_owned())
                .or_insert_with(|| Regex::new(pattern).expect("checked-in schema pattern"));
        }
        match value {
            Value::Object(fields) => fields.values().for_each(|item| collect(item, patterns)),
            Value::Array(items) => items.iter().for_each(|item| collect(item, patterns)),
            _ => {}
        }
    }
    let mut patterns = HashMap::new();
    collect(&DOCUMENT, &mut patterns);
    patterns
});

pub type Result<T> = std::result::Result<T, Failure>;

#[derive(Debug)]
pub struct Failure(Value);

impl std::error::Error for Failure {}

impl Failure {
    pub fn new(code: &str, message: &str) -> Self {
        Self(
            json!({"code":code,"message":message,"retryable":matches!(code,"Timeout"|"NotReady"|"LeaseBusy")}),
        )
    }

    pub fn code(&self) -> &str {
        self.0["code"].as_str().unwrap_or("Internal")
    }

    pub fn value(&self) -> &Value {
        &self.0
    }

    pub fn timeout() -> Self {
        Self::new("Timeout", "Automation operation timed out")
    }
}

impl std::fmt::Display for Failure {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            formatter,
            "{}: {}",
            self.code(),
            self.0["message"].as_str().unwrap_or("")
        )
    }
}

pub fn remaining(deadline: Instant) -> Result<Duration> {
    deadline
        .checked_duration_since(Instant::now())
        .filter(|time| !time.is_zero())
        .ok_or_else(Failure::timeout)
}

pub fn request(id: &str, op: &str, args: Value, timeout: u64) -> Value {
    json!({"v":1,"kind":"request","id":id,"op":op,"args":args,"timeoutMs":timeout})
}

pub fn response(message: &Value, result: Result<Value>) -> Value {
    let mut envelope = json!({"v":1,"kind":"response","id":message["id"]});
    if roles(message["op"].as_str().unwrap_or("")).is_some() {
        envelope["op"] = message["op"].clone();
    }
    match result {
        Ok(value) => {
            envelope["ok"] = json!(true);
            envelope["value"] = value;
        }
        Err(error) => {
            envelope["ok"] = json!(false);
            envelope["error"] = error.0;
        }
    }
    if envelope.to_string().len() > LIMIT {
        return response(
            message,
            Err(Failure::new(
                "ResourceLimit",
                "Response exceeds the control byte limit",
            )),
        );
    }
    envelope
}

pub fn outcome(request: &Value, envelope: Value) -> Result<Value> {
    if !valid("Response", &envelope)
        || envelope["id"] != request["id"]
        || envelope["op"] != request["op"]
    {
        return Err(Failure::new(
            "Disconnected",
            "Peer returned an invalid response",
        ));
    }
    if envelope["ok"] == true {
        Ok(envelope["value"].clone())
    } else {
        Err(Failure(envelope["error"].clone()))
    }
}

pub fn roles(op: &str) -> Option<&'static Vec<Value>> {
    DOCUMENT["x-operation-receivers"][op].as_array()
}

pub fn args_schema(op: &str) -> Option<Value> {
    let request = DOCUMENT["definitions"]["Request"]["oneOf"]
        .as_array()?
        .iter()
        .find(|schema| schema["properties"]["op"]["const"] == op)?;
    let mut args = request["properties"]["args"].clone();
    if let Some(reference) = args["$ref"].as_str() {
        args = DOCUMENT.pointer(&reference[1..])?.clone();
    }
    let mut definitions = Map::new();
    collect_definitions(&args, &mut definitions);
    if !definitions.is_empty() {
        args["definitions"] = Value::Object(definitions);
    }
    args["properties"]["timeoutMs"] = request["properties"]["timeoutMs"].clone();
    Some(args)
}

/// Includes only definitions reachable from one MCP tool's input schema.
fn collect_definitions(schema: &Value, definitions: &mut Map<String, Value>) {
    if let Some(name) = schema["$ref"]
        .as_str()
        .and_then(|reference| reference.strip_prefix("#/definitions/"))
        && !definitions.contains_key(name)
    {
        let target = &DOCUMENT["definitions"][name];
        definitions.insert(name.into(), target.clone());
        collect_definitions(target, definitions);
    }
    match schema {
        Value::Object(fields) => fields
            .values()
            .for_each(|value| collect_definitions(value, definitions)),
        Value::Array(values) => values
            .iter()
            .for_each(|value| collect_definitions(value, definitions)),
        _ => {}
    }
}

pub fn valid(name: &str, value: &Value) -> bool {
    matches(&DOCUMENT["definitions"][name], value)
}

pub fn valid_id(value: &Value) -> bool {
    matches(
        &DOCUMENT["definitions"]["Request"]["oneOf"][0]["properties"]["id"],
        value,
    )
}

pub fn unknown_action(request: &Value) -> bool {
    let mut candidate = request.clone();
    let known = &DOCUMENT["definitions"]["Action"]["enum"][0];
    let replace = |action: &mut Value| {
        if action.is_string() && !valid("Action", action) {
            *action = known.clone();
            true
        } else {
            false
        }
    };
    let mut replaced = false;
    if let Some(action) = candidate.pointer_mut("/args/command/input/action") {
        replaced = replace(action);
    }
    if let Some(bindings) = candidate
        .pointer_mut("/args/bindings")
        .and_then(Value::as_array_mut)
    {
        for binding in bindings {
            if let Some(action) = binding.get_mut("action") {
                replaced |= replace(action);
            }
        }
    }
    replaced && valid("Request", &candidate)
}

/// Evaluates the subset of Draft 7 used by the checked-in schema.
fn matches(schema: &Value, value: &Value) -> bool {
    if let Some(reference) = schema["$ref"].as_str() {
        return DOCUMENT
            .pointer(&reference[1..])
            .is_some_and(|schema| matches(schema, value));
    }
    if let Some(options) = schema["oneOf"].as_array() {
        return options
            .iter()
            .filter(|option| matches(option, value))
            .take(2)
            .count()
            == 1;
    }
    if let Some(options) = schema["enum"].as_array() {
        return options.contains(value);
    }
    if let Some(constant) = schema.get("const") {
        return constant == value;
    }
    match schema["type"].as_str() {
        Some("object") => value.as_object().is_some_and(|fields| {
            let properties = &schema["properties"];
            schema["required"]
                .as_array()
                .into_iter()
                .flatten()
                .all(|key| fields.contains_key(key.as_str().unwrap_or("")))
                && fields.iter().all(|(key, field)| {
                    properties
                        .get(key)
                        .map_or(schema["additionalProperties"] != false, |rule| {
                            matches(rule, field)
                        })
                })
        }),
        Some("array") => value.as_array().is_some_and(|items| {
            items.len() as u64 >= schema["minItems"].as_u64().unwrap_or(0)
                && items.iter().all(|item| matches(&schema["items"], item))
        }),
        Some("string") => value.as_str().is_some_and(|value| {
            let count = value.chars().count() as u64;
            count >= schema["minLength"].as_u64().unwrap_or(0)
                && count <= schema["maxLength"].as_u64().unwrap_or(u64::MAX)
                && schema["pattern"].as_str().is_none_or(|pattern| {
                    PATTERNS[pattern].is_match(value)
                        && match pattern {
                            "^(0|-?[1-9][0-9]{0,18})$" => value.parse::<i64>().is_ok(),
                            "^(0|[1-9][0-9]{0,19})$" => value.parse::<u64>().is_ok(),
                            _ => true,
                        }
                })
        }),
        Some(kind @ ("number" | "integer")) => value.as_f64().is_some_and(|number| {
            number.is_finite()
                && (kind != "integer" || value.is_i64() || value.is_u64())
                && schema["minimum"]
                    .as_f64()
                    .is_none_or(|minimum| number >= minimum)
                && schema["maximum"]
                    .as_f64()
                    .is_none_or(|maximum| number <= maximum)
                && schema["exclusiveMinimum"]
                    .as_f64()
                    .is_none_or(|minimum| number > minimum)
        }),
        Some("boolean") => value.is_boolean(),
        Some("null") => value.is_null(),
        _ => false,
    }
}
