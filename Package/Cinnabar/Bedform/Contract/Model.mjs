// Canonical v1 schema source. Generate the wire schema and language bindings with
// Package/ServerGameTest/Tool/AutomationContract.mjs.

export const Version = 1;
export const Limits = Object.freeze({
    ControlPath: `/automation/v${Version}`,
    ControlBytes: 65536,
    DefaultTimeoutMs: 10000,
    MaximumTimeoutMs: 120000,
    DefaultPressTicks: 1,
    DefaultLookBackMs: 10000,
    DefaultFps: 60,
    DefaultScreenshotFormat: "png",
    DefaultVideoContainer: "mp4",
    DefaultVideoCodec: "h264",
    DefaultArtifactTemplate: "{runId}/{playerId}/{trigger}/{activation}-{index}.{ext}"
});

const Ref = name => ({ $ref: `#/definitions/${name}` });
const String = (maxLength, pattern) => ({ type: "string", minLength: 1, maxLength, ...(pattern && { pattern }) });
const Const = value => ({ const: value });
const Enum = (...values) => ({ enum: values });
const Number = { type: "number" };
const Boolean = { type: "boolean" };
const Null = { type: "null" };
const UInt = { type: "integer", minimum: 0, maximum: 9007199254740991 };
const PositiveInt = { ...UInt, minimum: 1 };
const Elapsed = { type: "number", minimum: 0 };
const Duration = { type: "number", exclusiveMinimum: 0 };
const List = (items, minItems = 0) => ({ type: "array", items, minItems });
const Union = (...oneOf) => ({ oneOf });
const ObjectType = (required, optional = {}) => ({
    type: "object", properties: { ...required, ...optional }, required: Object.keys(required), additionalProperties: false
});
const Variant = (kind, required = {}, optional = {}) => ObjectType({ kind: Const(kind), ...required }, optional);

const Id = String(128, "^[A-Za-z0-9][A-Za-z0-9_-]*$");
const Name = String(128);
const Text = { type: "string", maxLength: 4096 };
const Path = String(32767);
const Digest = String(64, "^[0-9a-f]{64}$");
const Token = String(64, "^[0-9a-f]{64}$");
const ActorId = String(20, "^(0|-?[1-9][0-9]{0,18})$");
const RuntimeId = String(20, "^(0|[1-9][0-9]{0,19})$");
const Stamp = Ref("Stamp");
const Session = Ref("Session");
const Lease = Ref("Lease");
const Scalar = Union(Null, Boolean, Number, Text);
const Target = { session: Session };
const Output = Ref("Output");
const Interval = Ref("Interval");
const Fact = Ref("Fact");
const Condition = Ref("Condition");
const TriggerTarget = { ...Target, name: Name };
const NoArgs = ObjectType({});
const Empty = Null;

export const Actions = Object.freeze([
    "Use", "Attack", "Sneak", "Jump", "Sprint", "MoveForward", "MoveBackward", "MoveLeft", "MoveRight",
    "Inventory", "Hotbar1", "Hotbar2", "Hotbar3", "Hotbar4", "Hotbar5", "Hotbar6", "Hotbar7", "Hotbar8", "Hotbar9",
    "Drop", "Chat", "Confirm", "Cancel", "Pause", "Perspective"
].map(name => `@bedform/server-gametest/InputAction!${name}`));

export const Definitions = {
    Compatibility: ObjectType({
        platform: Const("windows-x64"), bdsVersion: Name, bdsBuild: PositiveInt, wireProtocol: PositiveInt,
        loaderVersion: Name, sdkVersion: Name, preLoaderVersion: Name, compatibilitySha256: Digest
    }),
    ErrorCode: Enum(
        "Malformed", "Unauthorized", "UnsupportedVersion", "Incompatible", "UnsupportedCapability", "ExtensionMissing",
        "InvalidPlayer", "PlayerDead", "AlreadyAttached", "StaleSession", "LeaseBusy", "LeaseLost", "NotReady",
        "Disconnected", "Shutdown", "Timeout", "Cancelled", "ResourceLimit", "LaunchFailed", "UnknownAction",
        "TriggerExists", "TriggerMissing", "PredicateFailed", "LookBackDisabled", "HistoryUnavailable", "FrameUnavailable",
        "EncoderFailed", "DiskFailed", "PermissionDenied", "InvalidPath", "Collision", "Internal"
    ),
    Failure: ObjectType({ code: Ref("ErrorCode"), message: String(1024), retryable: Boolean }),
    Capability: Enum("NativeSession", "VirtualInput", "VisibleRenderer", "HiddenRenderer", "Observations", "Capture",
        "Audio", "FixedClock", "LookBack", "Triggers"),
    Role: Enum("script", "host", "bridge", "renderer", "provisioner"),
    Player: ObjectType({
        serverInstanceId: Id, entityId: ActorId, runtimeId: RuntimeId, spawn: Enum("standalone", "gameTest")
    }),
    Session: ObjectType({ runId: Id, sessionId: Id, generation: PositiveInt, player: Ref("Player") }),
    SessionState: ObjectType({
        session: Session, phase: Enum("attaching", "ready", "transitioning", "closing", "ended"),
        alive: Boolean, dimension: Name, runtimeId: RuntimeId, renderer: Enum("hidden", "visible")
    }, { lease: Lease, endReason: Ref("EndReason") }),
    EndReason: Enum("detached", "playerRemoved", "testEnded", "disconnected", "shutdown", "failed"),
    Lease: ObjectType({ id: Id, owner: Enum("native", "virtual") }),
    PacketEndpoint: ObjectType({ port: { ...PositiveInt, maximum: 65535 }, token: Token }),
    PacketBind: ObjectType({ v: Const(Version), session: Session, token: Token }),
    PacketIngress: ObjectType({ v: Const(Version), session: Session }, { lease: Lease }),
    Stamp: ObjectType({ monotonicMs: Elapsed }, { tick: UInt }),
    FrameTime: ObjectType({ index: UInt, at: Stamp }, { mediaPtsUs: UInt }),
    Vector: ObjectType({ x: Number, y: Number, z: Number }),
    RawInput: Union(
        Variant("key", { code: Name }), Variant("mouseButton", { button: Enum("left", "middle", "right", "back", "forward") }),
        Variant("movement", { forward: { ...Number, minimum: -1, maximum: 1 }, right: { ...Number, minimum: -1, maximum: 1 } }),
        Variant("look", { yaw: Number, pitch: Number }), Variant("pointer", { x: Number, y: Number }),
        Variant("wheel", { x: Number, y: Number }), Variant("text", { text: Text })
    ),
    Action: Enum(...Actions),
    Input: Union(Ref("RawInput"), Variant("action", { action: Ref("Action") })),
    InputCommand: Union(
        Variant("press", { input: Ref("Input") }, { ticks: PositiveInt }),
        Variant("hold", { input: Ref("Input") }), Variant("release", { input: Ref("Input") }), Variant("releaseAll")
    ),
    Binding: ObjectType({ action: Ref("Action"), inputs: List(Ref("RawInput")) }),
    InputAck: ObjectType({ applied: Stamp }),
    Fact: ObjectType({ source: Enum("player", "world", "inventory", "hud", "ui", "script"), name: Name }, { subject: Name }),
    Observation: ObjectType({ session: Session, observed: Stamp, sequence: UInt, facts: List(ObjectType({ fact: Fact, value: Scalar })) }),
    Condition: Union(
        Variant("all", { conditions: List(Condition, 1) }), Variant("any", { conditions: List(Condition, 1) }),
        Variant("not", { condition: Condition }), Variant("exists", { fact: Fact }),
        Variant("compare", { fact: Fact, operator: Enum("eq", "ne", "lt", "le", "gt", "ge"), value: Scalar })
    ),
    Output: ObjectType({}, { directory: Path, filename: Path, template: Path }),
    Screenshot: ObjectType({}, { output: Output, offsetsMs: List(Elapsed, 1), format: Const(Limits.DefaultScreenshotFormat) }),
    Video: ObjectType({}, {
        output: Output, container: Const(Limits.DefaultVideoContainer), codec: Const(Limits.DefaultVideoCodec), fps: Duration, audio: Boolean,
        clock: Enum("realTime", "fixed"),
        stop: Union(Variant("manual"), Variant("duration", { durationMs: Duration }),
            Variant("condition", { condition: Condition, maxWallClockMs: Duration }), Variant("historyOnly"))
    }),
    Interval: ObjectType({ startMs: Elapsed, endMs: Elapsed }),
    FrameRequest: ObjectType({ session: Session, observed: Stamp, receivedAtMs: Elapsed, offsetsMs: List(Elapsed, 1) }),
    FrameIndexEntry: ObjectType({ frame: Ref("FrameTime"), segmentId: Id, keyframe: Boolean }),
    FrameDescriptor: ObjectType({
        frame: Ref("FrameTime"), width: PositiveInt, height: PositiveInt, rowStride: PositiveInt,
        pixelFormat: Enum("rgba8", "bgra8")
    }),
    AudioDescriptor: ObjectType({ at: Stamp, sampleRate: PositiveInt, channels: PositiveInt, frames: PositiveInt,
        sampleFormat: Const("f32leInterleaved") }),
    LookBackDefaults: Union(Const(false), ObjectType({ screenshot: Boolean, video: Boolean })),
    LookBackConfig: ObjectType({}, { durationMs: Duration, defaults: Ref("LookBackDefaults"), audio: Boolean }),
    LookBackOverride: Union(Const(false), ObjectType({}, { durationMs: Duration, screenshot: Boolean, video: Boolean })),
    LookBackStatus: Union(Variant("disabled"), Variant("enabled", {
        epoch: PositiveInt, retentionMs: Duration, defaults: Ref("LookBackDefaults"), audio: Boolean, available: Union(Null, Interval)
    })),
    HistoryRequest: ObjectType({ session: Session, epoch: PositiveInt, interval: Interval }),
    HistorySegment: ObjectType({ id: Id, interval: Interval, bytes: PositiveInt, audio: Boolean }),
    HistoryIndex: ObjectType({ session: Session, status: Ref("LookBackStatus"), frames: List(Ref("FrameIndexEntry")),
        segments: List(Ref("HistorySegment")) }),
    HistoryPin: ObjectType({ id: Id, request: Ref("HistoryRequest"), segments: List(Ref("HistorySegment"), 1),
        frames: List(Ref("FrameIndexEntry"), 1) }),
    Trigger: ObjectType({ name: Name, condition: Condition }, {
        screenshot: Ref("Screenshot"), video: Ref("Video"), output: Output, lookBack: Ref("LookBackOverride"),
        oncePerRun: Boolean, cooldownMs: Elapsed, enabled: Boolean
    }),
    TriggerState: ObjectType({ trigger: Ref("Trigger"), owner: Enum("script", "mcp"), enabled: Boolean,
        previous: Boolean, activations: UInt }, { lastActivation: Stamp, failure: Ref("Failure") }),
    TriggerFact: ObjectType({ session: Session, fact: Fact, observed: Stamp, outcome: Union(
        Variant("value", { value: Scalar }), Variant("failure", { failure: Ref("Failure") })) }),
    TriggerEvaluation: ObjectType({ state: Ref("TriggerState"), observation: Ref("Observation"),
        at: Stamp, history: Ref("HistoryIndex"), nextActivation: PositiveInt }, { predicateFailure: Ref("Failure") }),
    Occurrence: ObjectType({ name: Name, activation: PositiveInt, observed: Stamp, activated: Stamp }),
    Warning: ObjectType({ reason: Enum("retentionClamp", "historyUnavailable", "historyWarmUp"), occurrence: Ref("Occurrence"),
        requestedMs: Duration, retentionMs: Duration, availableMs: Elapsed, effectiveMs: Elapsed }),
    WarningDelivery: ObjectType({ session: Session, warning: Ref("Warning"), sink: Enum("hostConsole", "bdsConsole", "mcp") }),
    LookBackResult: ObjectType({ requestedMs: Duration, effectiveMs: Elapsed, availableMs: Elapsed,
        retentionMs: Duration }),
    ScreenshotPlan: Union(Variant("current", { request: Ref("FrameRequest"), screenshot: Ref("Screenshot") }),
        Variant("historical", { epoch: PositiveInt, targetMs: Elapsed, frames: List(Ref("FrameIndexEntry"), 1),
            screenshot: Ref("Screenshot") })),
    VideoPlan: ObjectType({ video: Ref("Video"), activated: Stamp }, {
        history: Ref("HistoryRequest"), post: Interval, postDeadlineMs: Elapsed, stopCondition: Condition
    }),
    CapturePlan: ObjectType({ session: Session, occurrence: Ref("Occurrence"), warnings: List(Ref("WarningDelivery")) }, {
        screenshot: Ref("ScreenshotPlan"), video: Ref("VideoPlan"), lookBack: Ref("LookBackResult"), failure: Ref("Failure")
    }),
    TriggerDecision: Union(Variant("idle", { state: Ref("TriggerState") }),
        Variant("activate", { state: Ref("TriggerState"), plan: Ref("CapturePlan") }),
        Variant("failed", { state: Ref("TriggerState"), failure: Ref("Failure") })),
    CaptureJob: ObjectType({ id: Id, accepted: Stamp }),
    Recording: ObjectType({ id: Id, started: Stamp }),
    Artifact: ObjectType({ id: Id, session: Session, kind: Enum("screenshot", "video"), observed: Stamp,
        activated: Stamp, warnings: List(Ref("Warning")), droppedFrames: UInt,
        truncation: List(Enum("retentionClamp", "historyWarmUp", "historyUnavailable", "stopDeadline", "interrupted")),
        result: Union(
            Variant("completed", { path: Path, mediaStart: Ref("FrameTime"), mediaEnd: Ref("FrameTime"),
                source: Enum("renderer", "videoDerived", "mixed") }),
            Variant("failed", { failure: Ref("Failure") }, { path: Path }),
            Variant("interrupted", { failure: Ref("Failure") }, { path: Path }))
    }, { jobId: Id, occurrence: Ref("Occurrence"), lookBack: Ref("LookBackResult") }),
    RunManifest: ObjectType({ v: Const(Version), runId: Id, artifacts: List(Ref("Artifact")) }),
    OwnedFile: ObjectType({ path: String(1024), sha256: Digest, bytes: UInt,
        role: Enum("client", "mcp", "core", "helper", "asset", "bridge", "loader", "license") }),
    Provenance: ObjectType({ sourceSha256: Digest, pinsSha256: Digest, upstreamCommit: String(40, "^[0-9a-f]{40}$"),
        tools: List(ObjectType({ name: Name, version: Name }), 1) }, { monorepoCommit: String(40, "^[0-9a-f]{40}$") }),
    BundleManifest: ObjectType({ v: Const(Version), owner: Const("Bedform.Cinnabar"), bundleId: Id,
        compatibility: Ref("Compatibility"), provenance: Ref("Provenance"), files: List(Ref("OwnedFile"), 1) }),
    ProvisioningReceipt: ObjectType({ v: Const(Version), owner: Const("Bedform.Cinnabar"), bundleId: Id,
        target: Path, configSha256: Digest, stage: Enum("bds", "mcp"), files: List(Ref("OwnedFile")) }),
    ControlEndpoint: ObjectType({ v: Const(Version), host: Const("127.0.0.1"), port: { ...PositiveInt, maximum: 65535 },
        token: Token, role: Ref("Role"), compatibility: Ref("Compatibility") }),
    Hello: ObjectType({ role: Ref("Role"), compatibility: Ref("Compatibility") }),
    Welcome: ObjectType({ role: Ref("Role"), compatibility: Ref("Compatibility"), capabilities: List(Ref("Capability")) })
};

// Request, success response, receiving peer roles. All non-success responses share Failure.
export const Operations = {
    Hello: [Ref("Hello"), Ref("Welcome"), ["host", "bridge", "renderer"]],
    Capabilities: [NoArgs, List(Ref("Capability")), ["host", "bridge", "renderer"]],
    Attach: [ObjectType({ runId: Id, entityId: ActorId }, {
        renderer: Enum("hidden", "visible"), fixedClock: Boolean
    }), ObjectType({ state: Ref("SessionState") }, { packets: Ref("PacketEndpoint") }), ["host", "bridge"]],
    Detach: [ObjectType(Target), Ref("SessionState"), ["host", "bridge"]],
    State: [ObjectType(Target), Ref("SessionState"), ["host", "bridge"]],
    SyncSession: [Ref("SessionState"), Empty, ["renderer"]],
    AcquireLease: [ObjectType({ ...Target, owner: Enum("native", "virtual") }), Lease, ["host", "bridge"]],
    ReleaseLease: [ObjectType({ ...Target, lease: Lease }), Empty, ["host", "bridge"]],
    DispatchInput: [ObjectType({ ...Target, lease: Lease, command: Ref("InputCommand") }), Ref("InputAck"), ["host", "renderer"]],
    SetBindings: [ObjectType({ ...Target, bindings: List(Ref("Binding")) }), Empty, ["host", "renderer"]],
    GetBindings: [ObjectType(Target), List(Ref("Binding")), ["host", "renderer"]],
    Observe: [ObjectType(Target, { facts: List(Fact) }), Ref("Observation"), ["host", "bridge", "renderer"]],
    PublishFact: [Ref("TriggerFact"), Empty, ["host"]],
    Screenshot: [ObjectType({ ...Target, capture: Ref("Screenshot") }), Ref("CaptureJob"), ["host"]],
    StartVideo: [ObjectType({ ...Target, capture: Ref("Video") }), Ref("Recording"), ["host"]],
    StopVideo: [ObjectType({ ...Target, recordingId: Id }), Ref("Artifact"), ["host"]],
    EnableLookBack: [ObjectType(Target, { config: Ref("LookBackConfig") }), Ref("LookBackStatus"), ["host"]],
    DisableLookBack: [ObjectType(Target), Ref("LookBackStatus"), ["host"]],
    LookBackStatus: [ObjectType(Target), Ref("LookBackStatus"), ["host"]],
    RegisterTrigger: [ObjectType({ ...Target, trigger: Ref("Trigger") }), Ref("TriggerState"), ["host"]],
    ListTriggers: [ObjectType(Target), List(Ref("TriggerState")), ["host"]],
    InspectTrigger: [ObjectType(TriggerTarget), Ref("TriggerState"), ["host"]],
    EnableTrigger: [ObjectType(TriggerTarget), Ref("TriggerState"), ["host"]],
    DisableTrigger: [ObjectType(TriggerTarget), Ref("TriggerState"), ["host"]],
    ResetTrigger: [ObjectType(TriggerTarget), Ref("TriggerState"), ["host"]],
    RemoveTrigger: [ObjectType(TriggerTarget), Empty, ["host"]],
    Artifacts: [ObjectType({ runId: Id }, Target), Ref("RunManifest"), ["host"]],
    PollEvents: [ObjectType({ after: UInt }, { ...Target, limit: { ...PositiveInt, maximum: 128 } }),
        ObjectType({ events: List(Ref("Event")), next: UInt }), ["host", "bridge", "renderer"]]
};

export const Events = {
    SessionChanged: Ref("SessionState"),
    Observation: Ref("Observation"),
    Warning: Ref("WarningDelivery"),
    Artifact: Ref("Artifact"),
    RunFailed: ObjectType({ runId: Id, failure: Ref("Failure") }, Target)
};

const Header = { v: Const(Version), id: Id };
const Success = { ...Header, kind: Const("response"), ok: Const(true) };
const Request = { ...Header, kind: Const("request") };
export const Schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "Bedform Cinnabar Automation v1",
    $ref: "#/definitions/Message",
    "x-operation-receivers": Object.fromEntries(Object.entries(Operations).map(([op, [, , roles]]) => [op, roles])),
    definitions: {
        ...Definitions,
        Request: Union(...Object.entries(Operations).map(([op, [args]]) => ObjectType({ ...Request, op: Const(op), args }, {
            timeoutMs: { ...PositiveInt, maximum: Limits.MaximumTimeoutMs }
        }))),
        Response: Union(...Object.entries(Operations).map(([op, [, value]]) =>
            ObjectType({ ...Success, op: Const(op), value })), ObjectType({ ...Header, kind: Const("response"),
            ok: Const(false), error: Ref("Failure") }, { op: Enum(...Object.keys(Operations)) })),
        Event: Union(...Object.entries(Events).map(([event, value]) => ObjectType({ v: Const(Version), kind: Const("event"),
            event: Const(event), value, sequence: UInt }))),
        Message: Union(Ref("Request"), Ref("Response"), Ref("Event"))
    }
};
