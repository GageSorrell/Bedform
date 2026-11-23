import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { once } from "node:events";
import { readFile, writeFile, mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { createServer as createHttp } from "node:http";
import { createServer as createTcp } from "node:net";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { ControlPeer, NativePeer } from "../../../Bedform/Contract/Peers.mjs";
import { Limits } from "../../../Bedform/Contract/Model.mjs";

const require = createRequire(import.meta.resolve("eslint/package.json"));
const Ajv = require("ajv");
const source = name => new URL(`../../../Bedform/${name}`, import.meta.url);
const schema = JSON.parse(await readFile(source("Contract/automation-v1.schema.json"), "utf8"));
const validator = new Ajv().addSchema(schema, "v1");
const check = (name, value) => validator.validate(`v1#/definitions/${name}`, value);
const checked = (name, value) => assert.ok(check(name, value), validator.errorsText());
const bytes = await readFile(source("compatibility.json"));
const manifest = JSON.parse(bytes);
const compatibility = {
    platform: manifest.platform, bdsVersion: manifest.bedformBdsVersion, bdsBuild: 52886189,
    wireProtocol: manifest.wireProtocol, loaderVersion: manifest.loaderVersion, sdkVersion: manifest.sdkVersion,
    preLoaderVersion: manifest.preLoaderVersion, compatibilitySha256: createHash("sha256").update(bytes).digest("hex")
};
const binary = resolve(process.env.BEDFORM_CINNABAR_MCP_BINARY ?? join(
    fileURLToPath(new URL("../../../target/debug/", import.meta.url)), process.platform === "win32" ? "cinnabar-mcp.exe" : "cinnabar-mcp"));
const token = () => randomBytes(32).toString("hex");
const word = number => { const value = Buffer.alloc(4); value.writeUInt32BE(number); return value; };
const frame = bytes => Buffer.concat([word(bytes.length), bytes]);
const jsonBytes = value => Buffer.from(JSON.stringify(value));
const wireBatch = Buffer.from("0203900100", "hex");
const player = (entityId, runtimeId, spawn) => ({ serverInstanceId: "native-fixture", entityId, runtimeId, spawn });
const players = [player("-9223372036854775808", "1", "standalone"), player("12", "2", "gameTest")];

async function eventually(read, accepts, description) {
    const end = performance.now() + 10000;
    let latest;
    while (performance.now() < end) {
        latest = await read();
        if (accepts(latest)) return latest;
        await delay(20);
    }
    assert.fail(`${description}: ${JSON.stringify(latest)}`);
}

function endpoint(port, token, role) {
    return { v: 1, host: "127.0.0.1", port, token, role, compatibility };
}

async function startBridge(t) {
    const native = new NativePeer(players, check);
    const key = token();
    const packets = new Map();
    const calls = [];
    const accepted = [];
    const sockets = new Set();
    const listeners = new Set();
    const epoch = performance.now();
    const control = new ControlPeer({ role: "bridge", capabilities: ["NativeSession", "VirtualInput", "Observations"],
        credentials: new Map([[key, "host"]]), compatibility, check,
        dispatch(message) {
            calls.push(message);
            const value = native.dispatch(message);
            if (message.op === "Observe") {
                value.observed = { monotonicMs: 900000, tick: Math.floor((performance.now() - epoch) / 50) };
            }
            if (message.op === "Detach") terminate(value.session, "detached");
            return value;
        }
    });

    function terminate(handle, reason) {
        const socket = packets.get(handle.sessionId);
        if (socket && !socket.destroyed) socket.end(frame(Buffer.concat([Buffer.from([6]), jsonBytes({ message: reason })])));
    }

    async function packetListener(state, packetToken) {
        const listener = createTcp(socket => {
            sockets.add(socket);
            socket.on("error", () => socket.destroy());
            socket.on("close", () => sockets.delete(socket));
            let pending = Buffer.alloc(0);
            let bound = false;
            socket.on("data", chunk => {
                pending = Buffer.concat([pending, chunk]);
                while (pending.length >= 4 && pending.length >= pending.readUInt32BE() + 4) {
                    const size = pending.readUInt32BE();
                    const message = pending.subarray(4, 4 + size);
                    pending = pending.subarray(4 + size);
                    if (!bound) {
                        const bind = JSON.parse(message);
                        checked("PacketBind", bind);
                        assert.equal(bind.token, packetToken);
                        assert.deepEqual(bind.session, state.session);
                        native.bind(bind);
                        bound = true;
                        packets.set(state.session.sessionId, socket);
                        listener.close();
                        const metadata = jsonBytes({ identity: { display_name: state.session.player.entityId },
                            client_cache: false, packs_required: false, packs: [] });
                        const startGame = Buffer.from([1, 11]);
                        socket.write(Buffer.concat([
                            frame(Buffer.concat([Buffer.from([3]), word(metadata.length), metadata, startGame])),
                            frame(wireBatch)
                        ]));
                    } else {
                        const size = message.readUInt32BE();
                        const ingress = JSON.parse(message.subarray(4, 4 + size));
                        const batch = message.subarray(4 + size);
                        checked("PacketIngress", ingress);
                        assert.deepEqual(batch, wireBatch);
                        assert.deepEqual(ingress.session, state.session);
                        // The same opaque fixture batch serves as a passive bootstrap reply or mutating input.
                        try {
                            native.receive(ingress, batch, Boolean(ingress.lease));
                            accepted.push(ingress);
                        } catch (error) {
                            assert.ok(["NotReady", "LeaseLost", "StaleSession"].includes(error.code));
                        }
                    }
                }
            });
        }).listen(0, "127.0.0.1");
        listeners.add(listener);
        await once(listener, "listening");
        return listener.address().port;
    }

    const server = createHttp(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        assert.equal(request.url, Limits.ControlPath);
        const message = JSON.parse(Buffer.concat(chunks));
        const result = control.exchange(request.headers.authorization?.slice(7), message);
        if (result.ok && message.op === "Attach") {
            result.value.packets.port = await packetListener(result.value.state, result.value.packets.token);
        }
        response.writeHead(200, { "Content-Type": "application/json", "Connection": "close",
            "Content-Length": Buffer.byteLength(JSON.stringify(result)) }).end(JSON.stringify(result));
    }).listen(0, "127.0.0.1");
    listeners.add(server);
    await once(server, "listening");
    t.after(() => {
        for (const socket of sockets) socket.destroy();
        for (const listener of listeners) listener.close();
    });
    return { native, calls, accepted, endpoint: endpoint(server.address().port, key, "bridge"), terminate };
}

async function startHost(t, bridge, mode = "normal") {
    const root = await mkdtemp(join(tmpdir(), "bedform-automation-"));
    const run = join(root, "runs");
    await mkdir(run);
    await Promise.all([
        writeFile(join(root, "compatibility.json"), bytes),
        writeFile(join(root, "bridge.json"), JSON.stringify(bridge.endpoint)),
        writeFile(join(root, "host.json"), JSON.stringify({
            compatibility: "compatibility.json", bridgeEndpoint: "bridge.json", rendererExecutable: process.execPath,
            rendererArguments: [fileURLToPath(new URL("./RendererPeer.mjs", import.meta.url)), mode],
            assets: ".", runDirectory: "runs", scriptEndpoints: ["script.json", "other.json"], provisionerEndpoint: "setup.json",
            shutdownOnStdinClose: true
        }))
    ]);
    const processHandle = spawn(binary, ["--automation-host", join(root, "host.json")], { windowsHide: true });
    const closed = once(processHandle, "exit");
    let stdout = "", stderr = "";
    processHandle.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
    processHandle.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    let stopping;
    const stop = () => stopping ??= (async () => {
        processHandle.stdin.end();
        const timer = setTimeout(() => processHandle.kill(), 8000);
        try {
            const [code] = await closed;
            assert.equal(code, 0, stderr);
            assert.equal(stdout, "");
            assert.equal(stderr, "");
        } finally {
            clearTimeout(timer);
        }
    })();
    t.after(async () => { try { await stop(); } finally { await rm(root, { recursive: true, force: true }); } });
    const discovery = name => join(root, name + ".json");
    const read = name => eventually(async () => {
        if (processHandle.exitCode !== null) assert.fail(stderr);
        return readFile(discovery(name), "utf8").then(JSON.parse, error => {
            if (error.code !== "ENOENT") throw error;
        });
    }, Boolean, "host endpoint");
    const [script, other, setup] = await Promise.all(["script", "other", "setup"].map(read));
    for (const doc of [script, other, setup]) checked("ControlEndpoint", doc);
    return { root, run, discovery, stop, script, other, setup };
}

let requestNumber = 0;
async function request(endpoint, op, args, options = {}) {
    const id = options.id ?? `request-${++requestNumber}`;
    const body = { v: options.version ?? 1, kind: "request", id, op, args,
        ...(options.timeoutMs && { timeoutMs: options.timeoutMs }) };
    const response = await fetch(`http://127.0.0.1:${endpoint.port}${Limits.ControlPath}`, {
        method: "POST", headers: { Authorization: `Bearer ${options.token ?? endpoint.token}`, "Content-Type": "application/json", Connection: "close" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(12000)
    }).catch(cause => { throw Error(`HTTP exchange failed for ${op}`, { cause }); });
    assert.equal(response.status, 200);
    const result = await response.json();
    checked("Response", result);
    assert.equal(result.id, id);
    assert.equal(result.op, op);
    return result;
}
async function call(endpoint, op, args, options) {
    const result = await request(endpoint, op, args, options);
    assert.ok(result.ok, `${op}: ${JSON.stringify(result.error)}`);
    return result.value;
}
async function error(endpoint, op, args, code, options) {
    assert.equal((await request(endpoint, op, args, options)).error?.code, code);
}

const hello = (endpoint, role = "script") => call(endpoint, "Hello", { role, compatibility });
const attach = (endpoint, player, runId, renderer) => call(endpoint, "Attach",
    { entityId: player.entityId, runId, ...(renderer && { renderer }) });
const lease = (endpoint, session) => call(endpoint, "AcquireLease", { session, owner: "virtual" });
const input = (endpoint, session, lease, command, options) => call(endpoint, "DispatchInput", { session, lease, command }, options);

async function mcp(t, discovery) {
    const child = spawn(binary, discovery ? ["--automation-stdio", discovery] : [], { windowsHide: true });
    const closed = once(child, "exit");
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    let id = 0;
    const close = async () => {
        child.stdin.end();
        const [code] = await closed;
        assert.equal(code, 0, stderr);
        assert.equal(stderr, "");
        assert.ok((await lines.next()).done, "only MCP replies are allowed on stdout");
    };
    let closing;
    t.after(() => closing ??= close());
    return {
        close: () => closing ??= close(),
        async send(method, params) {
            child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) + "\n");
            const reply = JSON.parse((await lines.next()).value);
            assert.equal(reply.jsonrpc, "2.0");
            assert.equal(reply.id, id);
            return reply.result;
        }
    };
}

async function transcript(run, name) {
    const root = join(run, `run-${name}`);
    const [session] = await readdir(root);
    return (await readFile(join(root, session, "transcript.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
}

test("script and stdio share an authenticated host, with independently owned native renderer sessions", async t => {
    const bridge = await startBridge(t);
    const host = await startHost(t, bridge);
    const { script, other, setup } = host;
    assert.equal(new Set([script.token, other.token, setup.token, bridge.endpoint.token]).size, 4);
    await error(script, "Capabilities", {}, "Unauthorized");
    await error(script, "Hello", { role: "provisioner", compatibility }, "Unauthorized");
    await error(script, "Hello", { role: "script", compatibility: { ...compatibility, wireProtocol: 1 } }, "Incompatible");
    await error(script, "Hello", { role: "script", compatibility }, "Unauthorized", { token: token() });
    await error(script, "Hello", { role: "script", compatibility }, "UnsupportedVersion", { version: 2 });
    await hello(script);
    await hello(other);
    await hello(setup, "provisioner");
    assert.ok((await call(setup, "Capabilities", {})).includes("HiddenRenderer"));
    await error(setup, "Attach", { entityId: players[0].entityId, runId: "no" }, "Unauthorized");
    await error(script, "Attach", { entityId: "9223372036854775808", runId: "no" }, "Malformed");
    await error(script, "Attach", { entityId: "99", runId: "no" }, "InvalidPlayer");
    await error(script, "Attach", { entityId: players[0].entityId, runId: "no", fixedClock: true }, "UnsupportedCapability");

    const first = await attach(script, players[0], "first");
    const second = await attach(other, players[1], "second", "visible");
    assert.equal(first.packets, undefined);
    assert.equal(first.state.renderer, "hidden");
    assert.equal(second.state.renderer, "visible");
    assert.equal(bridge.native.playerCount, 2);
    const a = first.state.session, b = second.state.session;
    assert.deepEqual(a.player, players[0]);
    assert.deepEqual(b.player, players[1]);
    await error(script, "Screenshot", { session: a, capture: {} }, "UnsupportedCapability");
    await error(other, "State", { session: a }, "Unauthorized");
    await error(script, "State", { session: { ...a, generation: a.generation + 1 } }, "StaleSession");
    await error(other, "Attach", { entityId: players[0].entityId, runId: "duplicate" }, "AlreadyAttached");

    const stdio = await mcp(t, host.discovery("script"));
    assert.equal((await stdio.send("initialize", {})).serverInfo.name, "cinnabar-mcp");
    const tools = (await stdio.send("tools/list", {})).tools;
    assert.ok(tools.some(tool => tool.name === "automation_state"));
    const rpc = (name, args) => stdio.send("tools/call", { name: `automation_${name}`, arguments: args });
    assert.deepEqual(JSON.parse((await rpc("state", { session: a, timeoutMs: 2000 })).content[0].text), first.state);
    assert.equal(JSON.parse((await rpc("state", { session: a, timeoutMs: -1 })).content[0].text).code, "Malformed");
    assert.equal((await rpc("state", { session: b })).isError, true);
    assert.equal(bridge.calls.filter(call => call.op === "Attach").length, 3); // Invalid player plus the two real players.

    const aLease = JSON.parse((await rpc("acquire_lease", { session: a, owner: "virtual" })).content[0].text);
    const bLease = await lease(other, b);
    await error(script, "AcquireLease", { session: a, owner: "native" }, "LeaseBusy");
    await error(script, "DispatchInput", { session: a, lease: bLease, command: { kind: "releaseAll" } }, "LeaseLost");
    const action = "@bedform/server-gametest/InputAction!Use";
    const raw = code => ({ kind: "key", code });
    await error(script, "DispatchInput", { session: a, lease: aLease, command: {
        kind: "hold", input: { kind: "action", action: action + "x" } } }, "UnknownAction");
    const binding = code => ({ action, inputs: [raw(code)] });
    await call(script, "SetBindings", { session: a, bindings: [binding("KeyF")] });
    assert.deepEqual(await call(other, "GetBindings", { session: b }), []);
    const hold = kind => ({ kind, input: { kind: "action", action } });
    const ack = await input(script, a, aLease, hold("hold"));
    assert.ok(ack.applied.tick > 0 && ack.applied.monotonicMs < 900000);
    await call(script, "SetBindings", { session: a, bindings: [binding("KeyG")] });
    await input(script, a, aLease, hold("release"));
    const pressStart = await call(other, "Observe", { session: b });
    const pressed = await input(other, b, bLease, { kind: "press", ticks: 2, input: raw("KeyW") });
    assert.ok(pressed.applied.tick >= pressStart.observed.tick + 2);
    await input(script, a, aLease, hold("hold"));
    assert.equal(await call(script, "ReleaseLease", { session: a, lease: aLease }), null);
    await error(script, "DispatchInput", { session: a, lease: aLease, command: hold("hold") }, "LeaseLost");
    const left = await transcript(host.run, "first");
    const right = await transcript(host.run, "second");
    assert.equal(left[0].hidden, "1");
    assert.equal(right[0].hidden, "0");
    assert.notEqual(left[0].pid, right[0].pid);
    assert.notEqual(left[0].user, right[0].user);
    assert.ok(left[0].credentialDistinct && right[0].credentialDistinct);
    assert.ok(left.some(event => event.fields?.release?.includes("KeyF")));
    assert.ok(!left.some(event => event.fields?.hold?.includes("KeyW")));
    assert.ok(right.some(event => event.fields?.hold?.includes("KeyW")));
    assert.deepEqual(left.at(-1).held, []);
    assert.ok(bridge.accepted.some(packet => packet.lease?.id === aLease.id && packet.session.sessionId === a.sessionId));
    assert.ok(bridge.accepted.some(packet => packet.lease?.id === bLease.id && packet.session.sessionId === b.sessionId));

    bridge.native.transition(b, "transitioning", false, "nether", "8");
    const transition = await eventually(() => call(other, "State", { session: b }), value => value.phase === "transitioning", "native transition");
    assert.equal(transition.lease, undefined);
    await error(other, "DispatchInput", { session: b, lease: bLease, command: { kind: "releaseAll" } }, "LeaseLost");
    bridge.native.remove(b, "testEnded");
    bridge.terminate(b, "testEnded");
    const ended = await eventually(() => call(other, "State", { session: b }), state => state.phase === "ended", "GameTest teardown");
    assert.equal(ended.endReason, "testEnded");
    const page = await call(other, "PollEvents", { after: 0, session: b });
    assert.ok(page.events.length > 2);
    assert.ok(page.events.every(event => event.value.session.sessionId === b.sessionId));
    assert.ok(page.events.every((event, index) => !index || page.events[index - 1].sequence < event.sequence));
    assert.equal((await call(other, "PollEvents", { after: page.next })).next, page.next);
    await waitExited(right[0].pid);

    const detached = await call(script, "Detach", { session: a });
    assert.equal(detached.endReason, "detached");
    await waitExited(left[0].pid);
    assert.equal(bridge.native.playerCount, 1);
    const fresh = (await attach(script, players[0], "fresh")).state.session;
    assert.equal(fresh.generation, a.generation + 1);
    assert.notEqual(fresh.sessionId, a.sessionId);
    const freshPid = (await transcript(host.run, "fresh"))[0].pid;
    await stdio.close();
    assert.equal((await call(script, "State", { session: fresh })).phase, "ready");
    await host.stop();
    await waitExited(freshPid);
    await assert.rejects(readFile(host.discovery("script")), { code: "ENOENT" });
});

async function waitExited(pid) {
    await eventually(() => {
        try { process.kill(pid, 0); return false; }
        catch (error) { if (error.code === "ESRCH") return true; throw error; }
    }, Boolean, "owned renderer process exit");
}

test("launch failures, queue expiry and duplicate IDs leave no attached native player", async t => {
    const bridge = await startBridge(t);
    const failed = await startHost(t, bridge, "fail");
    await hello(failed.script);
    const args = { entityId: players[0].entityId, runId: "broken" };
    await error(failed.script, "Attach", args, "LaunchFailed");
    assert.ok(bridge.calls.some(call => call.op === "Detach"));
    await failed.stop();

    const stalled = await startHost(t, bridge, "stall");
    await hello(stalled.script);
    const started = request(stalled.script, "Attach", args, { id: "same", timeoutMs: 1200 });
    await eventually(() => bridge.calls.filter(call => call.op === "Attach").length, count => count === 2, "in-flight attach");
    await error(stalled.script, "Attach", args, "Malformed", { id: "same" });
    await error(stalled.script, "Attach", { entityId: players[1].entityId, runId: "queued" }, "Timeout", { timeoutMs: 50 });
    assert.equal((await started).error?.code, "Timeout");
    assert.equal(bridge.calls.filter(call => call.op === "Attach").length, 2);
    assert.equal(bridge.calls.filter(call => call.op === "Detach").length, 2);
    assert.equal(bridge.native.playerCount, 2);
    const tooLarge = await fetch(`http://127.0.0.1:${stalled.script.port}${Limits.ControlPath}`, {
        method: "POST", body: " ".repeat(Limits.ControlBytes + 1)
    });
    assert.equal(tooLarge.status, 413);
});

test("default stdio still serves upstream tools", async t => {
    const stdio = await mcp(t);
    assert.equal((await stdio.send("initialize", {})).serverInfo.name, "cinnabar-mcp");
    const { tools } = await stdio.send("tools/list", {});
    assert.ok(tools.some(tool => tool.name === "launch_client"));
    assert.ok(tools.some(tool => tool.name === "input"));
    assert.ok(!tools.some(tool => tool.name === "automation_attach"));
});

test("an expired input clears its lease and retains terminal state", async t => {
    const bridge = await startBridge(t);
    const host = await startHost(t, bridge);
    await hello(host.script);
    const { session } = (await attach(host.script, players[0], "input-timeout")).state;
    const control = await lease(host.script, session);
    const pid = (await transcript(host.run, "input-timeout"))[0].pid;
    await error(host.script, "DispatchInput", {
        session, lease: control, command: { kind: "press", ticks: 200, input: { kind: "key", code: "KeyW" } }
    }, "Timeout", { timeoutMs: 300 });
    const state = await call(host.script, "State", { session });
    assert.equal(state.phase, "ended");
    assert.equal(state.lease, undefined);
    assert.ok(bridge.calls.some(call => call.op === "Detach" && call.args.session.sessionId === session.sessionId));
    await waitExited(pid);
    assert.equal(bridge.native.playerCount, 2);
});
