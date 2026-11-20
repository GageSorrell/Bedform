/**
 * Isolated native BDS qualification of Canvas Intent at the add-on's fixed runtime path. Installs the
 * built Canvas packs, two independently bundled consumer packs and a GameTest driver into a fresh
 * disposable world, runs an observed process and an unmodified restart process, then verifies that
 * the installed Canvas files match the built archive.
 *
 * @module bedform-canvas/Tool/Native
 *
 * @file      Native.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pack manifests and reports retain their conventional field order. */
/* eslint-disable sort-keys, @stylistic/max-len */

import { ConsumerId, Marker } from "../Test/Native/Keys.mjs";
import { cp, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { Build } from "./Build.mts";
import { WorldFixture } from "../../../Script/WorldFixture.mts";
import { assertStopped } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { unzipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Runtime = path.join(Root, "dist/bds-runtime");
const Installation = path.resolve(process.env.BDS_PATH ?? "C:/MineCraft/Server");
const Timeout = 360_000;
const ServerModule = "2.10.0";
const GameTestModule = "1.0.0-beta";
const ObserverSuffix = "\nBedformNativeObserver.Install(BedformNativeObserverServer);\n";

/**
 * Fixed fixture identities. Consumers depend on Canvas exactly as a Bedform build would declare it.
 *
 * @category Testing
 * @since 1.0.0
 */
const Pack = Object.freeze({
    ConsumerA: { Directory: "bedform_native_consumer_a",
        Header: "ff6173b7-a43f-40b7-b889-f4bf46d4d27e",
        Id: ConsumerId.A,
        Script: "9f95c4a7-7e5c-422a-8660-6ec6bec0f416",
        Target: "a" },
    ConsumerB: { Directory: "bedform_native_consumer_b",
        Header: "36e4aa40-fd0a-4740-b198-f9fe4e38c39f",
        Id: ConsumerId.B,
        Script: "1b7baee4-3cc0-43ee-afaa-e387db11da64",
        Target: "b" },
    Driver: { Directory: "bedform_native_driver",
        Header: "bbf248f9-b289-4cae-9a45-84ccf1f62e21",
        Script: "045b4abb-3f0c-42ea-9b58-7f0ab45bc274" }
} as const);

/**
 * Outcome of one server process.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Phase
{
    readonly Name: string;
    readonly ExitCode: number | null;
    readonly ElapsedMs: number;
    readonly Evidence: unknown;
    readonly ExpectedWarnings: number;
    readonly EngineWarnings: ReadonlyArray<string>;
}

/**
 * Hex SHA-256 of bytes.
 *
 * @category Testing
 * @since 1.0.0
 */
function Hash(bytes: Uint8Array): string
{
    return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Recursively reads every file below a directory, keyed by forward-slash relative path.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Files(directory: string, relative: string = ""): Promise<Record<string, Uint8Array>>
{
    const files: Record<string, Uint8Array> = {};
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true }))
    {
        const name = relative ? `${relative}/${entry.name}` : entry.name;
        Object.assign(files, entry.isDirectory() ? await Files(directory, name)
            : { [name]: await readFile(path.join(directory, name)) });
    }

    return files;
}

/**
 * Writes an unpacked mcpack into a clean pack directory.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Install(files: Record<string, Uint8Array>, directory: string): Promise<void>
{
    await rm(directory, { force: true,
        recursive: true });
    for (const [ name, bytes ] of Object.entries(files))
    {
        if (!name.endsWith("/"))
        {
            await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
            await writeFile(path.join(directory, name), bytes);
        }
    }
}

/**
 * Bundles a fixture script for the BDS QuickJS runtime.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Bundle(entry: string, define: Record<string, string> = {}, format: "esm" | "iife" = "esm")
    : Promise<string>
{
    const result = await build({ bundle: true,
        define,
        entryPoints: [ path.join(Root, entry) ],
        external: [ "@minecraft/server", "@minecraft/server-gametest" ],
        format,
        ...format === "iife" ? { globalName: "BedformNativeObserver" } : {},
        legalComments: "none",
        logLevel: "silent",
        platform: "neutral",
        target: "es2022",
        write: false });
    return result.outputFiles[0].text;
}

/**
 * Writes one fixture behavior pack with a single script module.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Fixture(identity: { Directory: string;
    Header: string;
    Script: string }, name: string,
script: string, dependencies: Array<Record<string, unknown>>): Promise<void>
{
    const directory = path.join(Runtime, "behavior_packs", identity.Directory);
    await rm(directory, { force: true,
        recursive: true });
    await mkdir(path.join(directory, "scripts"), { recursive: true });
    await writeFile(path.join(directory, "scripts/main.js"), script);
    await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ format_version: 2,
        header: { description: "Isolated native Canvas Intent fixture",
            min_engine_version: [ 1, 26, 60 ],
            name,
            uuid: identity.Header,
            version: [ 1, 0, 0 ] },
        modules: [ { entry: "scripts/main.js",
            language: "javascript",
            type: "script",
            uuid: identity.Script,
            version: [ 1, 0, 0 ] } ],
        dependencies }, null, 2));
}

/**
 * Copies the selected stable engine without its worlds, packs, configuration or properties.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Engine(): Promise<void>
{
    await mkdir(Runtime, { recursive: true });
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

    for (const kind of [ "behavior_packs", "resource_packs" ])
    {
        for (const name of await readdir(path.join(Installation, kind)))
        {
            if (/^(vanilla|chemistry|experimental|education|server_)/u.test(name))
            {
                await cp(path.join(Installation, kind, name), path.join(Runtime, kind, name), { force: true,
                    recursive: true });
            }
        }
    }
}

/**
 * Runs one server process until the driver reports, then stops it through its console.
 *
 * @throws { Error } If the process times out, exits abnormally, logs errors or the driver fails.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Run(name: string, expected: string, allowedWarning?: string): Promise<Phase>
{
    const started = Date.now();
    let output = "";
    let timedOut = false;
    let stopped = false;
    let kill: NodeJS.Timeout | undefined;
    const child = spawn(path.join(Runtime, "bedrock_server.exe"), [], { cwd: Runtime,
        stdio: [ "pipe", "pipe", "pipe" ],
        windowsHide: true });
    const stop = (): void =>
    {
        if (!stopped)
        {
            stopped = true;
            child.stdin.write("stop\n");
            kill = setTimeout(() => child.kill(), 20_000);
        }
    };

    const timer = setTimeout(() =>
    {
        timedOut = true;
        stop();
    }, Timeout);
    for (const stream of [ child.stdout, child.stderr ])
    {
        stream.on("data", (chunk: Buffer) =>
        {
            const text = chunk.toString();
            output += text;
            process.stdout.write(text);
            if (output.includes(expected) || output.includes(Marker.Fail))
            {
                stop();
            }
        });
    }

    let code: number | null;
    try
    {
        code = await new Promise<number | null>((resolve: (code: number | null) => void,
            reject: (error: Error) => void) =>
        {
            child.on("error", reject);
            child.on("exit", resolve);
        });
    }
    finally
    {
        clearTimeout(timer);
        clearTimeout(kill);
        await writeFile(path.join(Root, `dist/native-${name}.log`), output);
    }

    const lines = output.split(/\r?\n/u);
    const warnings = lines.filter((line: string) => / WARN\]/u.test(line) && !line.includes("CANVAS_NATIVE_"));
    const expectedWarnings = allowedWarning === undefined ? []
        : warnings.filter((line: string) => line.includes(allowedWarning));
    const scripting = warnings.filter((line: string) => /\[Scripting\]/u.test(line) &&
        !expectedWarnings.includes(line));
    const errors = lines.filter((line: string) => /\bERROR\b|\[error\]/u.test(line));
    if (timedOut || code !== 0 || !output.includes(expected) || output.includes(Marker.Fail) ||
        errors.length > 0 || scripting.length > 0)
    {
        throw new Error(`Native ${name} phase failed (timeout ${timedOut}, exit ${code}); ` +
            `${[ ...errors, ...scripting, ...lines.filter((line: string) => line.includes(Marker.Fail)) ]
                .join(" | ")}; see dist/native-${name}.log`);
    }

    const evidence = output.match(new RegExp(`${Marker.Evidence} (\\{[^\\r\\n]+\\})`, "u"));
    return { ElapsedMs: Date.now() - started,
        EngineWarnings: warnings.filter((line: string) => !expectedWarnings.includes(line)),
        Evidence: evidence ? JSON.parse(evidence[1]) : null,
        ExitCode: code,
        ExpectedWarnings: expectedWarnings.length,
        Name: name };
}

await mkdir(path.join(Root, "dist"), { recursive: true });
const Lock = await open(path.join(Root, "dist/native.lock"), "wx");
const Results: Record<string, unknown> = { Passed: false,
    NativeAcceptance: false,
    ClientAcceptance: false,
    StartedAt: new Date().toISOString() };
const TextOnly = process.argv.includes("--text-only");
Results.Selection = TextOnly ? "CanvasIntentAndSpatialText" : "CanvasIntentWidgetsAndSpatialText";
const ResultsFile = path.join(Root, "dist/native.results.json");
try
{
    await assertStopped(Runtime);
    await writeFile(ResultsFile, JSON.stringify(Results, null, 2) + "\n");
    const archivePath = await Build();
    const archive = await readFile(archivePath);
    const outer = unzipSync(archive);
    const behavior = unzipSync(outer["bedform-canvas-bp.mcpack"]);
    const resource = unzipSync(outer["bedform-canvas-rp.mcpack"]);
    const canvasBehavior = JSON.parse(Buffer.from(behavior["manifest.json"]).toString());
    const canvasResource = JSON.parse(Buffer.from(resource["manifest.json"]).toString());
    await Engine();
    const canvasBehaviorDirectory = path.join(Runtime, "behavior_packs/bedform_canvas");
    const canvasResourceDirectory = path.join(Runtime, "resource_packs/bedform_canvas");
    await Install(behavior, canvasBehaviorDirectory);
    await Install(resource, canvasResourceDirectory);
    const canvasDependency = { uuid: canvasBehavior.header.uuid,
        version: canvasBehavior.header.version };
    for (const consumer of [ Pack.ConsumerA, Pack.ConsumerB ])
    {
        await Fixture(consumer, `Canvas Native Consumer ${consumer.Target.toUpperCase()}`,
            await Bundle("Test/Native/Consumer.mts", { NativeConsumerId: JSON.stringify(consumer.Id),
                NativeConsumerTarget: JSON.stringify(consumer.Target) }),
            [ { module_name: "@minecraft/server",
                version: ServerModule }, canvasDependency ]);
    }

    await Fixture(Pack.Driver, "Canvas Native Driver", await Bundle("Test/Native/Driver.mts",
        { NativeTextOnly: JSON.stringify(TextOnly) }),
    [ { module_name: "@minecraft/server",
        version: ServerModule }, { module_name: "@minecraft/server-gametest",
        version: GameTestModule } ]);
    const original = behavior["scripts/main.js"];
    const observed = Buffer.concat([ Buffer.from("import * as BedformNativeObserverServer from " +
        "\"@minecraft/server\";\n" + await Bundle("Test/Native/Observer.mts", {}, "iife") + ObserverSuffix),
    Buffer.from(original) ]);
    await rm(path.join(Runtime, "config"), { force: true,
        recursive: true });
    await mkdir(path.join(Runtime, "config/default"), { recursive: true });
    await writeFile(path.join(Runtime, "config/default/permissions.json"), JSON.stringify({ allowed_modules:
        [ "@minecraft/server", "@minecraft/server-gametest" ] }));
    await writeFile(path.join(Runtime, "allowlist.json"), "[]\n");
    await writeFile(path.join(Runtime, "permissions.json"), "[]\n");
    const worlds = path.join(Runtime, "worlds");
    await mkdir(worlds, { recursive: true });
    const world = await mkdtemp(path.join(worlds, "canvas-native-"));
    await writeFile(path.join(world, "level.dat"), WorldFixture(true));
    await writeFile(path.join(world, "world_behavior_packs.json"), JSON.stringify([ canvasBehavior.header,
        { uuid: Pack.ConsumerA.Header }, { uuid: Pack.ConsumerB.Header }, { uuid: Pack.Driver.Header } ]
        .map((header: { uuid: string;
            version?: Array<number> }) => ({ pack_id: header.uuid,
            version: header.version ?? [ 1, 0, 0 ] }))));
    await writeFile(path.join(world, "world_resource_packs.json"), JSON.stringify([ { pack_id: canvasResource.header.uuid,
        version: canvasResource.header.version } ]));
    await writeFile(path.join(Runtime, "server.properties"), [
        "server-name=Canvas Intent native qualification", `level-name=${path.basename(world)}`,
        "gamemode=creative", "difficulty=peaceful", "allow-cheats=true", "online-mode=false",
        "allow-player-joining=false", "transport=nethernet", "server-port=0", "server-portv6=0",
        "enable-lan-visibility=false", "content-log-console-output-enabled=true",
        "content-log-file-enabled=true", "tick-distance=4", "view-distance=5"
    ].join("\n") + "\n");

    await writeFile(path.join(canvasBehaviorDirectory, "scripts/main.js"), observed);
    const first = await Run("observed", Marker.Saved, "Injected native fixture particle fault.");
    const second = await Run("restart", Marker.Saved);
    await writeFile(path.join(canvasBehaviorDirectory, "scripts/main.js"), original);
    const third = await Run("unmodified", Marker.Pass);

    const installed = { ...Object.fromEntries(Object.entries(await Files(canvasBehaviorDirectory))
        .map(([ name, bytes ]: [ string, Uint8Array ]) => [ `bp/${name}`, bytes ])),
    ...Object.fromEntries(Object.entries(await Files(canvasResourceDirectory))
        .map(([ name, bytes ]: [ string, Uint8Array ]) => [ `rp/${name}`, bytes ])) };
    const built = { ...Object.fromEntries(Object.entries(behavior).filter(([ name ]: [ string, Uint8Array ]) => !name.endsWith("/"))
        .map(([ name, bytes ]: [ string, Uint8Array ]) => [ `bp/${name}`, bytes ])),
    ...Object.fromEntries(Object.entries(resource).filter(([ name ]: [ string, Uint8Array ]) => !name.endsWith("/"))
        .map(([ name, bytes ]: [ string, Uint8Array ]) => [ `rp/${name}`, bytes ])) };
    const mismatched = [ ...new Set([ ...Object.keys(installed), ...Object.keys(built) ]) ].filter((name: string) =>
        !installed[name] || !built[name] || Hash(installed[name]) !== Hash(built[name]));
    if (mismatched.length > 0)
    {
        throw new Error(`Installed Canvas files differ from the build: ${mismatched.join(", ")}`);
    }

    if (first.ExpectedWarnings < 1)
    {
        throw new Error("The injected renderer fault was not reported through Canvas OnError.");
    }

    const log = await readFile(path.join(Root, "dist/native-unmodified.log"), "utf8");
    Object.assign(Results, {
        Archive: { Path: path.relative(Root, archivePath).replaceAll("\\", "/"),
            Sha256: Hash(archive),
            InstalledFiles: Object.keys(built).length,
            InstalledMatchesBuild: true,
            ObservedScriptSuffixMatches: observed.subarray(observed.length - original.length).equals(original) },
        Engine: { Version: log.match(/Version: ([^\r\n]+)/u)?.[1],
            Build: log.match(/Build ID: ([^\r\n]+)/u)?.[1],
            Sha256: Hash(await readFile(path.join(Runtime, "bedrock_server.exe"))),
            Source: Installation.replaceAll("\\", "/") },
        Modules: { Canvas: canvasBehavior.dependencies.filter((entry: { module_name?: string }) =>
            entry.module_name),
        Consumers: { "@minecraft/server": ServerModule },
        Driver: { "@minecraft/server": ServerModule,
            "@minecraft/server-gametest": GameTestModule },
        Experiments: [ "gametest (Beta APIs)" ] },
        Runtime: path.relative(path.join(Root, "../.."), Runtime).replaceAll("\\", "/"),
        World: path.basename(world),
        Phases: [ first, second, third ],
        FinishedAt: new Date().toISOString(),
        // Server-side native qualification only; real-client acceptance remains MineCraft-zcmm.10.
        NativeAcceptance: !TextOnly,
        SpatialTextAcceptance: true,
        Passed: true });
    await writeFile(ResultsFile, JSON.stringify(Results, null, 2) + "\n");
    console.log(`Canvas native qualification passed; see ${path.relative(process.cwd(), ResultsFile)}`);
}
catch (error)
{
    Results.Error = error instanceof Error ? error.message : String(error);
    await writeFile(ResultsFile, JSON.stringify(Results, null, 2) + "\n");
    throw error;
}
finally
{
    await Lock.close();
    await rm(path.join(Root, "dist/native.lock"), { force: true });
}
