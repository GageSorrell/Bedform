import assert from "node:assert/strict";
import { IsCurrent } from "../../../../Script/Setup/Source/Currency.ts";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Version } from "../../../ServerGameTest/Source/AutomationContract.generated.ts";
import * as Contract from "../../../ServerGameTest/Source/AutomationContract.generated.ts";
import { Actions, Limits, Operations, Schema } from "./Model.mjs";
import { bundleFixture, digest } from "./BundleFixture.mjs";
import { ControlPeer, MediaPeer, NativePeer, RendererPeer } from "./Peers.mjs";

// ESLint carries the Draft 7 validator used by this repository's rule schemas.
const requireFromEslint = createRequire(import.meta.resolve("eslint/package.json"));
const Ajv = requireFromEslint("ajv");
const ajv = new Ajv({ allErrors: true, schemaId: "auto" });
const load = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const wire = load("./automation-v1.schema.json");
ajv.addSchema(wire, "automation");
const check = (definition, value) => ajv.validate(`automation#/definitions/${definition}`, value);
const checked = (definition, value) => assert.ok(check(definition, value), ajv.errorsText());
const vectors = load("./vectors.json");
const compatibilityBytes = readFileSync(new URL("../compatibility.json", import.meta.url));
const target = JSON.parse(compatibilityBytes);
const engine = load(`../bds-${target.bedformBdsVersion}-assessment.json`).engine;
const compatibility = {
    platform: target.platform, bdsVersion: target.bedformBdsVersion, bdsBuild: Number(engine.build), wireProtocol: target.wireProtocol,
    loaderVersion: target.loaderVersion, sdkVersion: target.sdkVersion, preLoaderVersion: target.preLoaderVersion,
    compatibilitySha256: digest(compatibilityBytes)
};
const token = "a".repeat(64);
const otherToken = "b".repeat(64);
const packet = Buffer.from(vectors.packet.batchHex, "hex");
const player = vectors.session.player;
const otherPlayer = { ...player, entityId: "-11", runtimeId: "3", spawn: "standalone" };

function bridgeFixture() {
    const native = new NativePeer([player, otherPlayer], check);
    const bridge = new ControlPeer({ role: "bridge", capabilities: ["NativeSession", "VirtualInput"], compatibility, check,
        credentials: new Map([[token, "host"], [otherToken, "host"]]), dispatch: native.dispatch });
    let next = 0;
    const request = (op, args, timeoutMs) => ({ v: Version, kind: "request", id: `req-${++next}`, op, args,
        ...(timeoutMs !== undefined && { timeoutMs }) });
    const call = (op, args, credential = token) => bridge.exchange(credential, request(op, args));
    const hello = credential => call("Hello", { role: "host", compatibility }, credential);
    const attach = (actor, credential = token) => {
        const { value } = call("Attach", { entityId: actor.entityId, runId: vectors.session.runId }, credential);
        const { session } = value.state;
        native.bind({ v: Version, session, token: value.packets.token });
        return session;
    };
    return { native, bridge, request, call, hello, attach };
}

test("standalone draft 7 schema, TypeScript wire registry, and portable vectors agree", () => {
    assert.deepEqual(wire, Schema);
    checked("Session", vectors.session);
    checked("Message", vectors.request);
    checked("Message", vectors.response);
    assert.equal(vectors.request.op, vectors.response.op);
    assert.equal(vectors.request.id, vectors.response.id);
    assert.deepEqual(Object.values(Contract).filter(value => Actions.includes(value)).sort(), [...Actions].sort());
    assert.deepEqual(Object.keys(Operations).sort(), Object.entries(Contract)
        .filter(([key]) => key.startsWith("Operation")).map(([, value]) => value).sort());
    for (const { valid, command } of vectors.input) assert.equal(check("InputCommand", command), valid);
    assert.ok(!check("Session", { ...vectors.session, generation: 0 }));
    assert.ok(!check("Session", { ...vectors.session, player: { ...player, runtimeId: Number(player.runtimeId) } }));
    assert.ok(!check("Request", { ...vectors.request, timeoutMs: Limits.MaximumTimeoutMs + 1 }));
    assert.ok(!check("Request", { ...vectors.request, args: { player: "extra" } }));
    assert.ok(!check("Response", { ...vectors.response, value: null }));
    const framed = Buffer.from(vectors.packet.framedBatchHex, "hex");
    assert.equal(framed.readUInt32BE(0), packet.length);
    assert.deepEqual(framed.subarray(4), packet);
});

test("loopback HTTP control binds a scoped caller before accepting requests", async () => {
    const { bridge, request } = bridgeFixture();
    const server = createServer(async (incoming, outgoing) => {
        const body = [];
        for await (const chunk of incoming) body.push(chunk);
        const bearer = incoming.headers.authorization?.slice("Bearer ".length);
        outgoing.setHeader("content-type", "application/json");
        outgoing.end(JSON.stringify(bridge.exchange(bearer, JSON.parse(Buffer.concat(body)))));
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        const post = async (credential, message) => {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${Contract.ControlPath}`, { method: "POST",
                headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" }, body: JSON.stringify(message) });
            return response.json();
        };
        assert.equal((await post(token, request("Capabilities", {}))).error.code, "Unauthorized");
        assert.equal((await post(token, request("Hello", { role: "renderer", compatibility }))).error.code, "Unauthorized");
        const mismatch = { ...compatibility, wireProtocol: compatibility.wireProtocol + 1 };
        assert.equal((await post(token, request("Hello", { role: "host", compatibility: mismatch }))).error.code, "Incompatible");
        assert.equal((await post(token, { ...request("Capabilities", {}), v: 2 })).error.code, "UnsupportedVersion");
        assert.ok((await post(token, request("Hello", { role: "host", compatibility }))).ok);
        assert.deepEqual((await post(token, request("Capabilities", {}))).value, ["NativeSession", "VirtualInput"]);
        assert.equal(bridge.exchange(token, request("Capabilities", {}, 5), 5).error.code, "Timeout");
        assert.equal((await post(otherToken, request("Capabilities", {}))).error.code, "Unauthorized");
    } finally {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
});

test("bridge peer preserves both identities and isolates packet batches, leases, generations, and terminal events", () => {
    const { native, call, hello, attach } = bridgeFixture();
    assert.ok(hello(token).ok && hello(otherToken).ok);
    const session = attach(player);
    const other = attach(otherPlayer, otherToken);
    assert.deepEqual(session.player, player);
    assert.deepEqual(other.player, otherPlayer);
    assert.equal(native.playerCount, 2);
    assert.equal(call("State", { session }, otherToken).error.code, "Unauthorized");
    assert.equal(call("Attach", { entityId: player.entityId, runId: "repeat" }).error.code, "AlreadyAttached");
    const nativeLease = call("AcquireLease", { session, owner: "native" }).value;
    assert.equal(call("AcquireLease", { session, owner: "virtual" }).error.code, "LeaseBusy");
    const ingress = { v: Version, session };
    assert.throws(() => native.receive({ ...ingress, lease: nativeLease }, packet, true), /LeaseLost/);
    assert.ok(call("ReleaseLease", { session, lease: nativeLease }).ok);
    const lease = call("AcquireLease", { session, owner: "virtual" }).value;
    assert.equal(native.receive({ ...ingress, lease }, packet, true), player.entityId);
    assert.deepEqual(native.drain(other), []);
    assert.deepEqual(native.drain(session), [packet]);
    native.transition(session, "transitioning", false, "nether", "42");
    assert.equal(call("AcquireLease", { session, owner: "virtual" }).error.code, "PlayerDead");
    native.transition(session, "ready", true, "nether", "42");
    assert.equal(call("State", { session }).value.runtimeId, "42");
    assert.equal(call("Observe", { session }).value.facts[0].value, "nether");
    assert.throws(() => native.receive({ ...ingress, lease }, packet, true), /LeaseLost/);
    assert.equal(call("Detach", { session }).value.endReason, "detached");
    assert.equal(native.playerCount, 2);
    const attachedAgain = attach(player);
    assert.equal(attachedAgain.generation, session.generation + 1);
    assert.throws(() => native.receive({ ...ingress, lease }, packet, true), /StaleSession/);
    native.remove(attachedAgain, "testEnded");
    assert.equal(native.playerCount, 1);
    assert.equal(call("Attach", { entityId: player.entityId, runId: session.runId }).error.code, "InvalidPlayer");
    native.shutdown();
    assert.equal(call("State", { session: other }, otherToken).value.endReason, "shutdown");
    assert.equal(call("AcquireLease", { session: other, owner: "virtual" }, otherToken).error.code, "Shutdown");
    const events = call("PollEvents", { after: 0 }).value.events;
    assert.ok(events.every(event => event.value.session.player.entityId === player.entityId));
    assert.deepEqual(events.filter(event => event.value.phase === "ended").map(event => event.value.endReason), ["detached", "testEnded"]);
    assert.equal(call("PollEvents", { after: 0 }, otherToken).value.events.at(-1).value.endReason, "shutdown");
});

test("frame and retention peers distinguish observation, acquisition, index and pinned media times", () => {
    const frame = (index, monotonicMs) => ({ index, at: { monotonicMs, tick: index + 10 }, mediaPtsUs: monotonicMs * 1000 });
    const descriptor = value => ({ frame: value, width: 1, height: 1, rowStride: 4, pixelFormat: "rgba8" });
    const [first, second, third] = [frame(0, 100), frame(1, 150), frame(2, 200)];
    const entries = [first, second, third].map((value, index) => ({ frame: value, segmentId: "segment-1", keyframe: index === 0 }));
    const session = vectors.session;
    const interval = { startMs: 100, endMs: 200 };
    const history = { session, status: { kind: "enabled", epoch: 1, retentionMs: 10000,
        defaults: { screenshot: true, video: false }, audio: false, available: interval }, frames: entries,
        segments: [{ id: "segment-1", interval, bytes: 100, audio: false }] };
    checked("HistoryIndex", history);
    const media = new MediaPeer([first, second, third].map(value => ({ descriptor: descriptor(value),
        pixels: Uint8Array.of(value.index, 64, 128, 255) })));
    const request = { session, observed: { monotonicMs: 90, tick: 9 }, receivedAtMs: 100, offsetsMs: [0, 50] };
    checked("FrameRequest", request);
    const acquired = media.acquire(request);
    for (const value of acquired) checked("FrameDescriptor", value.descriptor);
    assert.deepEqual(acquired.map(value => value.descriptor.frame), [second, third]);
    assert.deepEqual(acquired[0].pixels, Uint8Array.of(1, 64, 128, 255));
    const pin = media.pin(history, { session, epoch: 1, interval: { startMs: 150, endMs: 200 } });
    checked("HistoryPin", pin);
    assert.deepEqual(pin.frames, entries);
    history.status = { kind: "disabled" };
    assert.throws(() => media.pin(history, { session, epoch: 1, interval }), /LookBackDisabled/);
    assert.deepEqual(media.read(pin.id), pin);
    media.release(pin.id);
    assert.equal(media.read(pin.id), null);
    assert.ok(!check("LookBackConfig", { durationMs: 0 }));
    assert.ok(!check("Video", { stop: { kind: "condition", condition: { kind: "exists", fact: { source: "ui", name: "open" } } } }));
});

test("renderer peer applies tick acknowledgements and clears held bindings on lease loss", () => {
    const { request } = bridgeFixture();
    const session = vectors.session;
    const applied = { tick: 12, monotonicMs: 600 };
    const renderer = new RendererPeer(session, () => applied);
    const peer = new ControlPeer({ role: "renderer", capabilities: ["VirtualInput"], compatibility, check,
        credentials: new Map([[token, "host"]]), dispatch: renderer.dispatch });
    const call = (op, args) => peer.exchange(token, request(op, args));
    assert.ok(call("Hello", { role: "host", compatibility }).ok);
    const lease = { id: "virtual-fixture", owner: "virtual" };
    const ready = { session, lease, phase: "ready", dimension: "overworld", alive: true,
        runtimeId: session.player.runtimeId, renderer: "hidden" };
    assert.ok(call("SyncSession", ready).ok);
    const raw = { kind: "key", code: "KeyW" };
    const command = vectors.input[1].command;
    assert.ok(call("SetBindings", { session, bindings: [{ action: command.input.action, inputs: [raw] }] }).ok);
    assert.deepEqual(call("DispatchInput", { session, lease, command }).value, { applied });
    assert.deepEqual(renderer.held, [raw]);
    const { lease: oldLease, ...withoutLease } = ready;
    assert.ok(call("SyncSession", withoutLease).ok);
    assert.deepEqual(renderer.held, []);
    assert.equal(call("DispatchInput", { session, lease: oldLease, command }).error.code, "LeaseLost");
    assert.equal(call("SyncSession", { ...ready, session: { ...session, generation: 2 } }).error.code, "StaleSession");
});

test("wire trigger decision and per-run artifact manifest retain provenance across time and failure", () => {
    const session = vectors.session;
    const observed = { tick: 10, monotonicMs: 400 };
    const activated = { tick: 11, monotonicMs: 450 };
    const occurrence = { name: "Open Inventory", observed, activated, activation: 1 };
    const warning = { reason: "retentionClamp", occurrence, requestedMs: 1000, retentionMs: 500, availableMs: 450, effectiveMs: 450 };
    const lookBack = { requestedMs: 1000, retentionMs: 500, availableMs: 450, effectiveMs: 450 };
    const condition = { kind: "compare", fact: { source: "ui", name: "screenId" }, operator: "eq", value: "inventory" };
    const trigger = { name: occurrence.name, condition, lookBack: { durationMs: 1000, video: true } };
    checked("TriggerDecision", { kind: "activate", state: { trigger, owner: "script", enabled: true,
        previous: true, activations: 1, lastActivation: activated }, plan: { session, occurrence, lookBack,
        warnings: ["hostConsole", "bdsConsole", "mcp"].map(sink => ({ session, warning, sink })), video: {
            activated, history: { session, epoch: 1, interval: { startMs: 0, endMs: 450 } },
            postDeadlineMs: 10450, stopCondition: condition,
            video: { stop: { kind: "condition", condition, maxWallClockMs: 10000 } }
        } } });
    checked("RunManifest", { v: Version, runId: session.runId, artifacts: [{ session, observed, activated,
        occurrence, lookBack, kind: "video", id: "artifact-1", warnings: [warning], droppedFrames: 2,
        truncation: ["retentionClamp", "interrupted"], result: { kind: "interrupted",
            failure: { code: "Shutdown", message: "Server shut down", retryable: false } } }] });
});

test("fixture bundle and receipts carry compatible measured ownership", () => {
    assert.equal(compatibility.bdsVersion, load("../../../../Script/bedrock-target.json").serverVersion);
    assert.equal(compatibility.bdsVersion, engine.version);
    assert.equal(compatibility.bdsVersion, target.sdkBdsVersion);
    assert.equal(compatibility.bdsVersion, target.importedServerVersion);
    const { manifest, contents, provisioned } = bundleFixture(compatibility, target.upstreamCommit);
    checked("BundleManifest", manifest);
    for (const file of manifest.files) {
        assert.equal(digest(contents.get(file.path)), file.sha256);
        assert.equal(contents.get(file.path).length, file.bytes);
    }
    checked("ProvisioningReceipt", { v: Version, owner: manifest.owner, bundleId: manifest.bundleId,
        stage: "bds", target: "C:\\Fixture BDS", configSha256: digest("fixture config"), files: provisioned });
    const { token: omitted, ...receipt } = { v: Version, owner: manifest.owner, bundleId: manifest.bundleId,
        stage: "mcp", target: "C:\\Fixture\\mcp.json", configSha256: digest("fixture mcp"), files: [], token };
    assert.ok(!check("ProvisioningReceipt", { ...receipt, token: omitted }));
    checked("ProvisioningReceipt", receipt);

    const source = "C:\\Fixture checkout\\Package\\Cinnabar";
    const install = "C:\\Fixture install";
    const measured = (recorded, bytes) => ({ recorded, actual: digest(bytes) });
    const ownershipBytes = JSON.stringify(manifest.files);
    const provenanceBytes = JSON.stringify(manifest.provenance);
    const targetPath = receipt.target;
    const config = "fixture mcp";
    const request = { paths: { source, install }, options: { core: true, update: false, mcpConfig: targetPath } };
    const verification = { complete: true, sourceDirectory: source, installDirectory: install,
        inputs: measured(manifest.provenance.sourceSha256, "fixture source\n"),
        pins: measured(manifest.provenance.pinsSha256, "fixture pins\n"),
        ownership: measured(digest(ownershipBytes), ownershipBytes), provenance: measured(digest(provenanceBytes), provenanceBytes),
        requiredFiles: [...contents.keys()], files: manifest.files.map(file => ({ path: file.path,
            ...measured(file.sha256, contents.get(file.path)) })), stages: [
            { stage: "core", state: "current", fingerprint: measured(digest(ownershipBytes), ownershipBytes) },
            { stage: "mcp", state: "current", target: targetPath, fingerprint: measured(receipt.configSha256, config) }
        ] };
    assert.ok(IsCurrent(request, verification));
    assert.ok(!IsCurrent(request, { ...verification, files: verification.files.slice(1) }));
    assert.ok(!IsCurrent(request, { ...verification, stages: verification.stages.slice(0, 1) }));
});
