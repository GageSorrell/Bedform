// Exercises BedformNativeBridge at the package's fixed, firewall-qualified BDS path.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import * as fs from "node:fs/promises";
import { createServer } from "node:net";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { strToU8, zipSync } from "fflate";
import { WorldFixture } from "../../../../../Script/WorldFixture.mts";
import { HostPeer, PacketPeer, eventually } from "./HostPeer.mjs";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));
const bedform = resolve(root, "Package/Bedform");
const runtime = join(bedform, "dist/bds-runtime");
const source = join(runtime, "bedrock_server.exe");
const lock = join(bedform, "dist/physics-bds.lock");
const evidenceParent = join(root, "Package/Cinnabar/.local/8ww-3-native");
const [bridgeDll, patchedExe, releases, runtimeData] = process.argv.slice(2).map(path => resolve(path));
if (!bridgeDll || !patchedExe || !releases || !runtimeData) {
    throw Error("Provide bridge DLL, pinned loader-patched BDS, loader release directory, and runtime-data file");
}
const compatibilityBytes = await fs.readFile(new URL("../../compatibility.json", import.meta.url));
const pins = JSON.parse(compatibilityBytes);
const assessment = JSON.parse(await fs.readFile(new URL(`../../bds-${pins.bedformBdsVersion}-assessment.json`, import.meta.url)));
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const compatibility = { platform: pins.platform, bdsVersion: pins.bedformBdsVersion, bdsBuild: Number(assessment.engine.build),
    wireProtocol: pins.wireProtocol, loaderVersion: pins.loaderVersion, sdkVersion: pins.sdkVersion,
    preLoaderVersion: pins.preLoaderVersion, compatibilitySha256: digest(compatibilityBytes) };

const tag = (type, key, ...payload) => Buffer.concat([Buffer.from([type]), string(key), ...payload]);
function integer(value) { const out = Buffer.alloc(4); out.writeInt32LE(value); return out; }
function string(value) { const bytes = Buffer.from(value); const size = Buffer.alloc(2); size.writeUInt16LE(bytes.length); return Buffer.concat([size, bytes]); }
const compound = (key, ...payload) => tag(10, key, ...payload, Buffer.from([0]));
const list = (type, values) => Buffer.concat([Buffer.from([type]), integer(values.length), ...values]);
const structure = compound("", tag(3, "format_version", integer(1)),
    tag(9, "size", list(3, [integer(1), integer(2), integer(1)])),
    tag(9, "structure_world_origin", list(3, [integer(0), integer(0), integer(0)])),
    compound("structure", tag(9, "block_indices", list(9, [list(3, [integer(0), integer(-1)]), list(3, [integer(-1), integer(-1)])])),
        tag(9, "entities", list(10, [])), compound("palette", compound("default", tag(9, "block_palette", list(10,
            [Buffer.concat([tag(8, "name", string("minecraft:stone")), compound("states"), tag(3, "version", integer(18168865)), Buffer.from([0])])])),
        compound("block_position_data")))));

const runId = `cinnabar-bridge-${randomUUID()}`;
const evidence = join(evidenceParent, runId);
const world = join(runtime, "worlds", runId);
const behavior = join(runtime, "behavior_packs", runId);
const resources = join(runtime, "resource_packs", runId);
const moduleId = randomUUID();
const behaviorId = randomUUID();
const resourceId = randomUUID();
const permission = join(runtime, "config", moduleId);
const property = join(runtime, "server.properties");
const preLoaderConfig = join(runtime, "PreLoaderConfig.json");
const version = [1, 0, 0];
const properties = `server-name=Bedform Native Fixture\nlevel-name=${runId}\nlevel-type=FLAT\nallow-cheats=true\n`
    + "allow-player-joining=false\nonline-mode=false\nenable-lan-visibility=false\nserver-port=0\nserver-portv6=0\ntransport=nethernet\n"
    + "content-log-console-output-enabled=true\ncontent-log-file-enabled=false\ntexturepack-required=true\n";
const writeJson = (path, value) => fs.writeFile(path, JSON.stringify(value));
const owned = [];
const peers = [];
let child;
let exit;
let log = "";
let oldProperties;
let stock;
let oldPreLoaderConfig;
let preLoaderRead = false;
let replaced = false;
let host;
const lease = await fs.open(lock, "wx");

async function checkStopped() {
    const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='bedrock_server.exe'\" | Select-Object -ExpandProperty ExecutablePath"],
        { windowsHide: true, timeout: 10000 });
    assert.ok(!stdout.split(/\r?\n/).some(path => path.trim().toLowerCase() === source.toLowerCase()),
        "The fixed fixture runtime already has a live server");
    stock = await fs.readFile(source);
    assert.equal(digest(stock), assessment.engine.sha256);
}

async function optionalFile(path) {
    return fs.readFile(path).catch(error => { if (error.code !== "ENOENT") throw error; });
}

async function make(path, directory = true) {
    const sub = relative(runtime, path);
    assert.ok(sub && !sub.startsWith(`..${sep}`) && !isAbsolute(sub));
    if (directory) await fs.mkdir(path);
    else await fs.access(path).then(() => assert.fail(`Fixture reserves ${basename(path)}`), error => {
        if (error.code !== "ENOENT") throw error;
    });
    owned.push(path);
}

async function localPort() {
    const listener = createServer().listen(0, "127.0.0.1");
    await once(listener, "listening");
    const { port } = listener.address();
    listener.close();
    await once(listener, "close");
    return port;
}

function reports() {
    return log.split(/\r?\n/).flatMap(line => {
        const marker = "BEDFORM_BRIDGE_FIXTURE ";
        const index = line.indexOf(marker);
        if (index === -1) return [];
        try { return [JSON.parse(line.slice(index + marker.length).replace(/\u001B\[[0-9;]*m/g, ""))]; }
        catch { return []; }
    });
}

const act = name => child.stdin.write(`scriptevent bedform_bridge:test ${name}\n`);
const state = session => host.call("State", { session });
const events = () => host.call("PollEvents", { after: 0 });
const observe = async session => Object.fromEntries((await host.call("Observe", { session })).facts.map(({ fact, value }) => [fact.name, value]));

try {
    await fs.mkdir(evidence, { recursive: true });
    await checkStopped();
    oldPreLoaderConfig = await optionalFile(preLoaderConfig);
    preLoaderRead = true;
    const port = await localPort();
    const token = randomBytes(32).toString("hex");
    const manifest = { format_version: 2, header: { name: "Native Bridge RP", description: "Ephemeral test resource pack",
        uuid: resourceId, version, min_engine_version: [1, 26, 60] }, modules: [{ type: "resources", uuid: randomUUID(), version }] };
    const packFiles = { "manifest.json": JSON.stringify(manifest), "texts/languages.json": '["en_US"]', "texts/en_US.lang": "bridge.fixture=Native Bridge\n" };
    const archive = zipSync(Object.fromEntries(Object.entries(packFiles).map(([file, contents]) => [file, strToU8(contents)])));
    await fs.writeFile(join(evidence, "compatibility.json"), compatibilityBytes);
    await fs.writeFile(join(evidence, "fixture.zip"), archive);
    const config = join(evidence, "private.json");
    await writeJson(config, { token, port, packs: [{ uuid: resourceId, version: version.join("."), archive: "fixture.zip", sha256: digest(archive) }] });
    for (const path of [world, behavior, resources, permission]) await make(path);
    await fs.mkdir(join(behavior, "scripts"));
    await fs.mkdir(join(behavior, "structures/proof"), { recursive: true });
    await fs.copyFile(new URL("./Scenario.js", import.meta.url), join(behavior, "scripts/main.js"));
    await fs.writeFile(join(behavior, "structures/proof/bridge.mcstructure"), structure);
    const allowed = ["@minecraft/server", "@minecraft/server-gametest"];
    await writeJson(join(permission, "permissions.json"), { allowed_modules: allowed });
    await writeJson(join(behavior, "manifest.json"), { format_version: 2,
        header: { name: "Bedform Native Bridge Fixture", description: "Disposable test", uuid: behaviorId, version, min_engine_version: [1, 26, 60] },
        modules: [{ type: "script", language: "javascript", uuid: moduleId, version, entry: "scripts/main.js" }],
        dependencies: allowed.map((module_name, index) => ({ module_name, version: index ? "1.0.0-beta" : pins.apiPins[module_name] })) });
    await fs.mkdir(join(resources, "texts"));
    for (const [file, bytes] of Object.entries(packFiles)) await fs.writeFile(join(resources, file), bytes);
    await fs.writeFile(join(world, "level.dat"), WorldFixture(true));
    await writeJson(join(world, "world_behavior_packs.json"), [{ pack_id: behaviorId, version }]);
    await writeJson(join(world, "world_resource_packs.json"), [{ pack_id: resourceId, version }]);

    await make(join(runtime, "mods"));
    for (const [from, target] of [
        [join(releases, "PreLoader/bin/PreLoader.dll"), "PreLoader.dll"],
        [join(releases, "CrashLogger/CrashLogger.exe"), "CrashLogger.exe"],
        [runtimeData, "bedrock_runtime_data"]
    ]) {
        const to = join(runtime, target);
        await make(to, false);
        await fs.copyFile(from, to, fs.constants.COPYFILE_EXCL);
    }
    await fs.cp(join(releases, "LeviLamina/LeviLamina"), join(runtime, "mods/LeviLamina"), { recursive: true, force: false, errorOnExist: true });
    await fs.cp(join(releases, "locale/levilamina-loc-1.7.0/lang"), join(runtime, "mods/LeviLamina/lang"), { recursive: true, force: false, errorOnExist: true });
    const mod = join(runtime, "mods/BedformNativeBridge");
    await fs.mkdir(mod);
    await fs.copyFile(bridgeDll, join(mod, "BedformNativeBridge.dll"));
    await fs.copyFile(new URL("./manifest.json", import.meta.url), join(mod, "manifest.json"));
    oldProperties = await fs.readFile(property);
    await fs.writeFile(join(evidence, "original-server.properties"), oldProperties, { flag: "wx", flush: true });
    await fs.writeFile(property, properties, { flush: true });
    await fs.writeFile(join(evidence, "original-bedrock_server.exe"), stock, { flag: "wx", flush: true });
    const candidate = `${source}.${runId}`;
    await make(candidate, false);
    await fs.copyFile(patchedExe, candidate, fs.constants.COPYFILE_EXCL);
    await fs.rename(candidate, source);
    replaced = true;

    child = spawn(source, [], { cwd: runtime, windowsHide: true, env: { ...process.env, BEDFORM_CINNABAR_BRIDGE_CONFIG: config } });
    exit = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    child.stdout.on("data", bytes => { log += bytes; });
    child.stderr.on("data", bytes => { log += bytes; });
    await eventually(() => ({ ready: log.includes("BEDFORM_CINNABAR_BRIDGE_READY"), exit: child.exitCode }),
        value => value.ready || value.exit !== null, "native bridge startup", 45000);
    assert.match(log, /BEDFORM_CINNABAR_BRIDGE_READY/);
    await eventually(reports, values => values.some(value => value.stage === "standalone"), "global spawned identity");
    child.stdin.write("execute positioned 24 -59 24 run gametest run BedformBridge:Native\n");
    const all = await eventually(reports, values => values.some(value => value.stage === "gameTest"), "both spawn APIs");
    const before = all.find(value => value.stage === "gameTest").players;
    assert.equal(before.length, 2);
    const standalone = before.find(value => value.name === "BridgeStandalone").id;
    const gameTest = before.find(value => value.name === "BridgeGameTest").id;
    act("beforeTitle");
    await eventually(reports, list => list.some(value => value.stage === "beforeTitle"), "pre-attach UI state");

    host = new HostPeer(port, token);
    await host.error("Capabilities", {}, "Unauthorized");
    await host.error("Hello", { role: "host", compatibility }, "Unauthorized", { token: "f".repeat(64) });
    await host.error("Hello", { role: "host", compatibility }, "UnsupportedVersion", { version: 2 });
    await host.error("Hello", { role: "host", compatibility: { ...compatibility, wireProtocol: pins.wireProtocol + 1 } }, "Incompatible");
    assert.equal((await host.call("Hello", { role: "host", compatibility })).role, "bridge");
    const attach = entityId => host.call("Attach", { runId, entityId });
    await host.error("Attach", { runId, entityId: "-999" }, "InvalidPlayer");
    const a = await attach(standalone);
    const b = await attach(gameTest);
    const session = a.state.session;
    const other = b.state.session;
    assert.equal(session.player.spawn, "standalone");
    assert.equal(other.player.spawn, "gameTest");
    await host.error("Attach", { runId, entityId: standalone }, "AlreadyAttached");
    const wrong = await PacketPeer.bind(a, "f".repeat(64));
    peers.push(wrong);
    await eventually(() => wrong.ended, Boolean, "rejected packet credential");
    const first = await PacketPeer.bind(a);
    const second = await PacketPeer.bind(b);
    peers.push(first, second);
    const stream = peer => ({ handoff: peer.handoff, packets: peer.packets.map(packet => packet.id), packBytes: peer.packBytes.length, error: peer.error });
    for (const peer of [first, second]) {
        await eventually(() => stream(peer), value => Boolean(value.handoff && value.packBytes && value.packets.includes(58)), "native handoff, pack and terrain");
        const { entityId, runtimeId } = peer.session.player;
        assert.deepEqual(peer.startGameIdentity(), { entityId, runtimeId });
        assert.equal(peer.handoff.packs[0].uuid, resourceId);
        assert.equal(digest(Buffer.concat(peer.packBytes.map(entry => entry.bytes))), digest(archive));
    }
    await eventually(() => state(session), value => value.phase === "ready", "standalone ready");
    await eventually(() => state(other), value => value.phase === "ready", "GameTest ready");
    const title = (peer, text) => peer.packets.some(packet => packet.id === 88 && packet.data.includes(text));
    await eventually(() => title(first, "ExistingPrivateTitle"), Boolean, "existing UI replay at attach");
    assert.ok(!title(second, "ExistingPrivateTitle"));
    act("title");
    await eventually(() => title(first, "StandalonePrivateTitle") && title(second, "GameTestPrivateTitle"), Boolean, "isolated UI titles");
    assert.ok(!title(first, "GameTestPrivateTitle") && !title(second, "StandalonePrivateTitle"));
    act("report");
    const after = await eventually(reports, list => list.some(value => value.stage === "report"), "unchanged actor enumeration");
    assert.deepEqual(after.at(-1).players.map(value => value.id).sort(), [standalone, gameTest].sort());

    const native = await host.call("AcquireLease", { session, owner: "native" });
    await host.error("AcquireLease", { session, owner: "virtual" }, "LeaseBusy");
    const start = await observe(session);
    const otherBefore = await observe(other);
    first.input(native, start, 45);
    assert.equal((await observe(session)).yaw, start.yaw);
    await host.call("ReleaseLease", { session, lease: native });
    const virtual = await host.call("AcquireLease", { session, owner: "virtual" });
    act("nativeMove");
    await eventually(reports, list => list.some(value => value.stage === "nativeMove"), "native move issued during lease");
    const suppressed = await observe(session);
    assert.ok(Math.hypot(suppressed.x - start.x, suppressed.z - start.z) < 0.002,
        "Native move must stay suppressed under a virtual lease");
    first.input(virtual, await observe(session), 45);
    const rotated = await eventually(() => observe(session), value => Math.abs(value.yaw - 45) < 0.1, "leased server-observed auth input");
    const moved = await eventually(async () => {
        const position = await observe(session);
        first.input(virtual, position, 45, 1);
        return position;
    }, value => Math.hypot(value.x - rotated.x, value.z - rotated.z) > 0.05, "leased virtual movement", 4500);
    const otherAfter = await observe(other);
    assert.equal(otherAfter.yaw, otherBefore.yaw);
    assert.ok(Math.hypot(otherAfter.x - otherBefore.x, otherAfter.z - otherBefore.z) < 0.002,
        "Virtual movement must not spill into the other actor");
    await host.call("ReleaseLease", { session, lease: virtual });
    first.input(virtual, moved, 90);
    assert.ok(Math.abs((await observe(session)).yaw - 45) < 0.1);
    await host.error("ReleaseLease", { session, lease: virtual }, "LeaseLost");
    const otherLease = await host.call("AcquireLease", { session: other, owner: "virtual" });
    second.input(otherLease, await observe(other), -30);
    const otherRotated = await eventually(() => observe(other), value => Math.abs(value.yaw + 30) < 0.1,
        "second actor's leased input");
    assert.ok(Math.abs((await observe(session)).yaw - 45) < 0.1);
    await host.call("ReleaseLease", { session: other, lease: otherLease });

    await host.call("AcquireLease", { session, owner: "virtual" });
    act("death");
    await eventually(() => state(session), value => !value.alive && !value.lease, "death revoked the lease");
    await host.error("AcquireLease", { session, owner: "virtual" }, "PlayerDead");
    act("respawn");
    await eventually(() => state(session), value => value.alive && value.phase === "ready", "original actor respawn");
    await host.call("AcquireLease", { session, owner: "virtual" });
    act("nether");
    await eventually(() => state(session), value => value.dimension === "nether" && !value.lease, "dimension change revoked the lease");

    const detached = await host.call("Detach", { session });
    assert.equal(detached.endReason, "detached");
    await eventually(() => first.disconnect, value => value === "detached", "packet detach notification");
    const fresh = await attach(standalone);
    assert.equal(fresh.state.session.generation, session.generation + 1);
    assert.notEqual(fresh.state.session.sessionId, session.sessionId);
    await host.error("AcquireLease", { session, owner: "virtual" }, "StaleSession");
    const third = await PacketPeer.bind(fresh);
    peers.push(third);
    await eventually(() => third.handoff, Boolean, "fresh handoff after detach");
    act("endTest");
    await eventually(() => state(other), value => value.endReason === "testEnded", "GameTest lifecycle end");
    await eventually(() => second.disconnect, value => value === "testEnded", "GameTest packet teardown");
    third.close();
    await eventually(() => state(fresh.state.session), value => value.endReason === "disconnected", "transport lifecycle end");
    const removal = await attach(standalone);
    const removed = await PacketPeer.bind(removal);
    peers.push(removed);
    await eventually(() => removed.handoff, Boolean, "standalone attached for removal");
    act("remove");
    await eventually(() => state(removal.state.session), value => value.endReason === "playerRemoved", "standalone removal");
    await eventually(() => removed.disconnect, value => value === "playerRemoved", "standalone removal packet");
    act("replace");
    const nextActor = await eventually(reports, list => list.some(value => value.stage === "replacement"), "new standalone actor");
    const nextId = nextActor.at(-1).players.find(player => player.name === "BridgeStandalone").id;
    assert.notEqual(nextId, standalone);
    const shutdown = await attach(nextId);
    const last = await PacketPeer.bind(shutdown);
    peers.push(last);
    await eventually(() => last.handoff, Boolean, "shutdown fixture session");
    assert.ok((await events()).events.some(event => event.value.endReason === "testEnded"));
    child.stdin.write("stop\n");
    await eventually(() => last.disconnect, value => value === "shutdown", "orderly shutdown packet");
    assert.equal(await exit, 0);
    await assert.rejects(host.call("Capabilities", {}), error => error.cause?.code === "ECONNREFUSED");
    console.log(JSON.stringify({ original: before, first: first.startGameIdentity(), second: second.startGameIdentity(), rotated, moved, otherRotated,
        route: [first.disconnect, second.disconnect, last.disconnect], restoredFrom: evidence }));
} finally {
    try {
        for (const peer of peers) peer.close();
        if (child && child.exitCode === null && child.signalCode === null) {
            child.stdin.write("stop\n");
            const deadline = setTimeout(() => child.kill(), 8000);
            try { await exit; } finally { clearTimeout(deadline); }
        }
        await fs.writeFile(join(evidence, "server.log"), log);
        if (host) await writeJson(join(evidence, "operations.json"), host.requests);
    } finally {
        try {
            if (replaced) {
                await fs.rename(join(evidence, "original-bedrock_server.exe"), source);
                assert.equal(digest(await fs.readFile(source)), assessment.engine.sha256);
            }
            if (oldProperties) {
                await fs.writeFile(property, oldProperties, { flush: true });
                assert.deepEqual(await fs.readFile(property), oldProperties);
            }
            if (preLoaderRead && !(await optionalFile(preLoaderConfig))?.equals(oldPreLoaderConfig ?? Buffer.alloc(0))) {
                if (oldPreLoaderConfig) await fs.writeFile(preLoaderConfig, oldPreLoaderConfig, { flush: true });
                else await fs.rm(preLoaderConfig, { force: true });
            }
            for (const path of owned.reverse()) await fs.rm(path, { recursive: true, force: true });
            await fs.rm(join(evidence, "private.json"), { force: true });
        } finally {
            await lease.close();
            await fs.unlink(lock);
            console.log(`Evidence ${evidence}`);
        }
    }
}
