#[allow(dead_code)]
#[path = "../../automation_contract.rs"]
mod contract;

use contract::{ACTIONS, OPERATION_CAPABILITIES, VERSION};
use serde_json::Value;

fn main() {
    let vectors: Value = serde_json::from_str(include_str!("../../vectors.json")).unwrap();
    let request = &vectors["request"];
    assert_eq!(request["v"], VERSION);
    assert_eq!(request["op"], OPERATION_CAPABILITIES);

    let session = &vectors["session"];
    assert_eq!(session["generation"], 1);
    let entity_id: i64 = session["player"]["entityId"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    let runtime_id: u64 = session["player"]["runtimeId"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();
    assert_eq!(entity_id, i64::MIN);
    assert_eq!(runtime_id, u64::MAX);

    for vector in vectors["input"].as_array().unwrap() {
        let action = vector["command"]["input"]["action"].as_str().unwrap();
        assert_eq!(
            ACTIONS.contains(&action),
            vector["valid"].as_bool().unwrap()
        );
        let wire = serde_json::to_vec(&vector["command"]).unwrap();
        assert_eq!(
            serde_json::from_slice::<Value>(&wire).unwrap(),
            vector["command"]
        );
    }
}
