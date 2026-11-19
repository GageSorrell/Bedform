/**
 * Runs entity Use qualification in a disposable world at the add-on's fixed native test path.
 *
 * @module @sorrell/look-input-demo/Tool/ToggleProbe
 *
 * @file      ToggleProbe.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Root } from "./Build.mts";
import { ProbeEntity, ScriptEvent } from "./ToggleKeys.mjs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Build as BuildCommon } from "../../BedformCommon/Tool/Build.mts";
import { WorldFixture } from "../../../Script/WorldFixture.mts";
import { assertStopped } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import { build } from "esbuild";
import path from "node:path";
import { spawn } from "node:child_process";
import { unzipSync } from "fflate";

const Runtime = path.join(Root, "dist/bds-runtime");
const Installation = path.resolve(process.env.BDS_PATH ?? "C:/MineCraft/Server");
const Client = process.argv.includes("--client");
const Smoke = process.argv.includes("--smoke");
const Persistence = process.argv.includes("--persistence");
const Diagetic = process.argv.includes("--diagetic") || Persistence;
const Look = process.argv.includes("--look");
const Marker = Persistence ? "DIAGETIC_PERSISTENCE" :
    Diagetic ? "DIAGETIC_NATIVE" : Look ? "LOOK_INPUT_NATIVE" : "TOGGLE_CAPTURE";
const Log = Persistence ? "diagetic-persistence" :
    Diagetic ? "diagetic-native" : Look ? "native-probe" : Client ? "toggle-client" : "toggle-probe";
if (process.argv.slice(2).some((argument: string) =>
    ![ "--client", "--smoke", "--diagetic", "--look", "--persistence" ].includes(argument)) ||
    Smoke && !Client || Diagetic && (Client || Look) || Look && Client ||
    Persistence && process.argv.includes("--diagetic"))
{
    throw new Error("Usage: ToggleProbe.mts [--diagetic | --persistence | --look | --client [--smoke]]");
}

await assertStopped(Runtime);
await mkdir(Runtime, { recursive: true });
const Packs = await Build();
for (const name of [ "bedrock_server.exe", "data", "definitions", "profanity_filter.wlist" ])
{
    await cp(path.join(Installation, name), path.join(Runtime, name), { force: true,
        recursive: true });
}

for (const name of await readdir(Installation))
{
    if (name.endsWith(".dll"))
    {
        await cp(path.join(Installation, name), path.join(Runtime, name), { force: true });
    }
}

for (const kind of [ "behavior", "resource" ] as const)
{
    const source = path.join(Installation, `${kind}_packs`);
    for (const name of await readdir(source))
    {
        if (/^(vanilla|chemistry|experimental|education|server_)/.test(name))
        {
            await cp(path.join(source, name), path.join(Runtime, `${kind}_packs`, name),
                { force: true,
                    recursive: true });
        }
    }

    await cp(Packs[kind], path.join(Runtime, `${kind}_packs/look_probe`),
        { force: true,
            recursive: true });
}

const Pack = path.join(Runtime, "behavior_packs/look_probe");
const CommonReferences: Record<string, unknown> = {};
if (Diagetic)
{
    const common = unzipSync(await readFile(await BuildCommon()));
    for (const kind of [ "behavior", "resource" ])
    {
        const files = unzipSync(common[`bedform-common-${kind === "behavior" ? "bp" : "rp"}.mcpack`]);
        const target = path.join(Runtime, `${kind}_packs/bedform_common`);
        for (const [ name, bytes ] of Object.entries(files))
        {
            const destination = path.join(target, name);
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, bytes);
        }

        const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString());
        CommonReferences[kind] = { pack_id: manifest.header.uuid,
            version: manifest.header.version };
    }

    await rm(path.join(Pack, "entities/player.json"), { force: true });
    await rm(path.join(Runtime, "resource_packs/look_probe/entity/player.entity.json"), { force: true });
}

await mkdir(path.join(Pack, "entities"), { recursive: true });
await writeFile(path.join(Pack, "entities/toggle_probe.json"), JSON.stringify({
    format_version: "1.26.0",
    "minecraft:entity": {
        components: {
            "minecraft:collision_box": { height: 1.8,
                width: 0.5 },
            "minecraft:interact": { interactions: [ { interact_text: "Interact",
                on_interact: { event: "look_probe:touched",
                    target: "self" },
                swing: true } ] },
            "minecraft:physics": { has_collision: false,
                has_gravity: false }
        },
        description: { identifier: ProbeEntity,
            is_spawnable: false,
            is_summonable: true },
        events: { "look_probe:touched": {} }
    }
}));
const ClientEntities = path.join(Runtime, "resource_packs/look_probe/entity");
await mkdir(ClientEntities, { recursive: true });
await writeFile(path.join(ClientEntities, "toggle_probe.entity.json"), JSON.stringify({
    format_version: "1.10.0",
    "minecraft:client_entity": { description: { identifier: ProbeEntity,
        render_controllers: [] } }
}));
const Manifest = JSON.parse(await readFile(path.join(Pack, "manifest.json"), "utf8"));
// Distinct identities prevent clients reusing the normal demo's cached resource pack.
const ResourceManifestFile = path.join(Runtime, "resource_packs/look_probe/manifest.json");
const ResourceManifest = JSON.parse(await readFile(ResourceManifestFile, "utf8"));
const ResourceId = "456ec2be-2631-42a8-82c7-7e516bb1158a";
const OriginalResourceId = ResourceManifest.header.uuid;
Manifest.header.uuid = "0ce4c365-a504-4bb9-b899-2298d342de1b";
Manifest.header.name = "Toggle Capture Qualification";
Manifest.modules[0].uuid = "89bb9329-c193-4ad7-a615-03b8628ae5aa";
Manifest.modules[1].uuid = "64f53e8c-77e5-4bf7-acda-cbc351da3adb";
for (const dependency of Manifest.dependencies)
{
    if (dependency.uuid === OriginalResourceId)
    {
        dependency.uuid = ResourceId;
    }
}

ResourceManifest.header.uuid = ResourceId;
ResourceManifest.header.name = "Toggle Capture Qualification Resources";
ResourceManifest.modules[0].uuid = "b2053074-646d-47dd-906a-af28f65e6b83";
await writeFile(ResourceManifestFile, JSON.stringify(ResourceManifest));
if (!Client)
{
    Manifest.dependencies.push({ module_name: "@minecraft/server-gametest",
        version: "1.0.0-beta" });
}

await writeFile(path.join(Pack, "manifest.json"), JSON.stringify(Manifest));
await build({ bundle: true,
    entryPoints: [ path.join(Root, Persistence ? "Tool/DiageticPersistenceFixture.mts" :
        Diagetic ? "Tool/DiageticFixture.mts" : Look ? "Tool/NativeFixture.mts" :
            Client ? "Tool/ToggleClient.mts" : "Tool/ToggleFixture.mts") ],
    external: [ "@minecraft/server", "@minecraft/server-gametest" ],
    format: "esm",
    outfile: path.join(Pack, "scripts/main.js"),
    target: "es2022" });
const Config = path.join(Runtime, "config", Manifest.modules.find(
    (module: { type: string }) => module.type === "script").uuid);
await mkdir(Config, { recursive: true });
await writeFile(path.join(Config, "permissions.json"), JSON.stringify({ allowed_modules:
    Client ? [ "@minecraft/server" ] : [ "@minecraft/server", "@minecraft/server-gametest" ] }));
if (Diagetic)
{
    // BedformCommon 1.1.0 ships its own script module, which needs its own module permissions.
    const common = JSON.parse(await readFile(
        path.join(Runtime, "behavior_packs/bedform_common/manifest.json"), "utf8"));
    for (const module of common.modules.filter((entry: { type: string }) => entry.type === "script"))
    {
        await mkdir(path.join(Runtime, "config", module.uuid), { recursive: true });
        await writeFile(path.join(Runtime, "config", module.uuid, "permissions.json"),
            JSON.stringify({ allowed_modules: [ "@minecraft/server" ] }));
    }
}

await writeFile(path.join(Runtime, "allowlist.json"), "[]\n");
const Runs = path.join(Runtime, "worlds");
await mkdir(Runs, { recursive: true });
const World = await mkdtemp(path.join(Runs, "toggle-"));
await writeFile(path.join(World, "level.dat"), WorldFixture(!Client));
for (const kind of [ "behavior", "resource" ])
{
    const manifest = JSON.parse(await readFile(path.join(Runtime,
        `${kind}_packs/look_probe/manifest.json`), "utf8"));
    await writeFile(path.join(World, `world_${kind}_packs.json`), JSON.stringify([
        { pack_id: manifest.header.uuid,
            version: manifest.header.version }, ...(Diagetic ? [ CommonReferences[kind] ] : [])
    ]));
}

await writeFile(path.join(Runtime, "server.properties"), [
    "server-name=Toggle capture qualification", `level-name=${path.basename(World)}`,
    "gamemode=creative", "difficulty=peaceful", "allow-cheats=true", "online-mode=false",
    `allow-player-joining=${Client && !Smoke}`, "transport=nethernet",
    `server-port=${Client ? 19134 : 0}`, `server-portv6=${Client ? 19135 : 0}`,
    "enable-lan-visibility=false", "content-log-console-output-enabled=true",
    "content-log-file-enabled=true", "tick-distance=4", "view-distance=5"
].join("\n") + "\n");

/**
 * Runs one isolated server process; persistence mode reopens the saved world in a fresh process.
 *
 * @category Testing
 * @since 1.0.12
 */
async function Run(phase: number): Promise<void>
{
    const reportLog = Persistence && phase === 0 ? Log + "-save" : Log;
    let Output = "";
    let TimedOut = false;
    const Child = spawn(path.join(Runtime, "bedrock_server.exe"), [], { cwd: Runtime,
        stdio: [ "pipe", "pipe", "pipe" ],
        windowsHide: true });
    let KillTimer: NodeJS.Timeout | undefined;
    let Stopped = false;
    const Stop = (): void =>
    {
        if (!Stopped)
        {
            Stopped = true;
            Child.stdin.write("stop\n");
            KillTimer = setTimeout(() => Child.kill(), 10000);
        }
    };

    const Timer = Client && !Smoke ? undefined : setTimeout(() =>
    {
        TimedOut = true;
        Stop();
    }, 45000);
    for (const stream of [ Child.stdout, Child.stderr ])
    {
        stream.on("data", (chunk: Buffer) =>
        {
            const text = chunk.toString();
            Output += text;
            process.stdout.write(text);
            if (new RegExp(Marker + "_(PASS|FAIL|SAVED)").test(Output) ||
            Smoke && Output.includes("TOGGLE_CLIENT_READY"))
            {
                Stop();
            }
        });
    }

    const Forward = (chunk: Buffer): void =>
    {
        if (/^stop\s*$/i.test(chunk.toString().trim()))
        {
            Child.stdin.write(`scriptevent ${ScriptEvent.Reset} reset\n`);
            setTimeout(Stop, 250);
        }
        else
        {
            Child.stdin.write(chunk);
        }
    };

    if (Client && !Smoke)
    {
        process.stdin.on("data", Forward);
        process.stdin.resume();
    }

    let Code: number | null;
    try
    {
        Code = await new Promise<number | null>((resolve: (code: number | null) => void,
            reject: (error: Error) => void) =>
        {
            Child.on("error", reject);
            Child.on("exit", resolve);
        });
    }
    finally
    {
        clearTimeout(Timer);
        clearTimeout(KillTimer);
        if (Client && !Smoke)
        {
            process.stdin.off("data", Forward);
            process.stdin.pause();
        }

        await writeFile(path.join(Root, `dist/${reportLog}.log`), Output);
    }

    const expectedMarker = Client ? "TOGGLE_CLIENT_READY" :
        Marker + (Persistence && phase === 0 ? "_SAVED" : "_PASS");
    if (TimedOut || Code !== 0 || !Output.includes(expectedMarker) ||
    new RegExp("\\bERROR\\b|" + Marker + "_FAIL").test(Output))
    {
        throw new Error(`Native qualification probe failed; see dist/${reportLog}.log`);
    }

    const Evidence = Client ? { clientRecording: true,
        smoke: Smoke } : Look ? { nativeLookRegression: true } :
        JSON.parse(Output.match(new RegExp(Marker + "_EVIDENCE (\\{[^\\r\\n]+\\})"))![1]);
    await writeFile(path.join(Root, `dist/${reportLog}.json`),
        JSON.stringify({
            build: Output.match(/Build ID: ([^\r\n]+)/)?.[1],
            engine: Output.match(/Version: ([^\r\n]+)/)?.[1],
            evidence: Evidence,
            runtime: Runtime,
            world: World
        }, null, 2) + "\n");

}

await Run(0);
if (Persistence)
{
    await Run(1);
}
