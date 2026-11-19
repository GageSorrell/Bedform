/**
 * Isolated fixed-path engine fixtures; never touches an installed world.
 *
 * @module bedform/Tool/physics-bds
 *
 * @file      physics-bds.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Fixture records retain contextual types and pack field order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import { compile, fingerprint } from "../Source/Build/Physics.js";
import { createFixtures, FixtureTexture } from "./physics-fixtures.mjs";
import { galleryLevel } from "./physics-client-world.mjs";
import { physicsEngine, physicsTemplate } from "./physics-engine.mjs";
import { cpus, totalmem, release, platform } from "node:os";
import { createHash } from "node:crypto";
const Benchmark = process.argv.includes("--benchmark");
const Client = process.argv.includes("--prepare-client");
const SceneIndex = process.argv.indexOf("--scene");
const SelectedScene = SceneIndex < 0 ? undefined : process.argv[SceneIndex + 1];
const SceneNames = [ "mixed-128", "all-complex-128", "mesh_cube", "mesh_concave", "mesh_cavity", "mesh_disconnected" ];
if (SceneIndex >= 0 && !SceneNames.includes(SelectedScene ?? ""))
{
    throw new Error("Unknown or missing benchmark scene");
}

if (Client && Benchmark)
{
    throw new Error("Choose either benchmark or client preparation");
}

const BenchmarkScenes = SelectedScene === undefined ? SceneNames : [ SelectedScene ];
const SecondsIndex = process.argv.indexOf("--seconds");
const Seconds = SecondsIndex >= 0 ? Number(process.argv[SecondsIndex + 1]) : 600;
if (!Number.isFinite(Seconds) || Seconds < 1 || Seconds > 3600)
{
    throw new Error("Benchmark seconds must be in [1,3600]");
}

const Root = Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), "..");
const Runtime = Path.join(Root, "dist/bds-runtime");
const Template = process.env.BDS_TEST_WORLD === undefined ? undefined : Path.resolve(process.env.BDS_TEST_WORLD, "level.dat");
await Fs.mkdir(Path.join(Root, "dist"), { recursive: true });
const Lock = await Fs.open(Path.join(Root, "dist/physics-bds.lock"), "wx");
try
{
    const Source = await physicsEngine(Root, process.env.BDS_PATH);
    if (Template !== undefined)
    {
        try
        {await Fs.access(Template);}
        catch (error)
        {throw new Error(`Invalid BDS_TEST_WORLD: expected a saved level.dat at ${Template}`, { cause: error });}
    }

    await Fs.mkdir(Runtime, { recursive: true });
    const Reuse = Path.relative(await Fs.realpath(Source), await Fs.realpath(Runtime)) === "";
    console.warn(`Physics engine: ${Source}${Reuse ? " (reusing fixed runtime)" : " (copying into fixed runtime)"}`);

    for (const Entry of Reuse ? [] : await Fs.readdir(Source, { withFileTypes: true }))
    {
        if ([ "worlds", "behavior_packs", "resource_packs", "server.properties", "permissions.json", "allowlist.json", "config" ].includes(Entry.name))
        {
            continue;
        }

        await Fs.cp(Path.join(Source, Entry.name), Path.join(Runtime, Entry.name), { recursive: true,
            force: true });
    }

    for (const Kind of Reuse ? [] : [ "behavior_packs", "resource_packs" ])
    {
        for (const Entry of await Fs.readdir(Path.join(Source, Kind), { withFileTypes: true }))
        {
            if (/^(vanilla|chemistry|experimental|editor|server_)/u.test(Entry.name))
            {
                await Fs.cp(Path.join(Source, Kind, Entry.name), Path.join(Runtime, Kind, Entry.name), { recursive: true,
                    force: true });
            }
        }
    }

    await Fs.writeFile(Path.join(Runtime, "allowlist.json"), "[]");
    await Fs.writeFile(Path.join(Runtime, "permissions.json"), "[]");
    await Fs.mkdir(Path.join(Runtime, "config/default"), { recursive: true });
    await Fs.writeFile(Path.join(Runtime, "config/default/permissions.json"), JSON.stringify({ allowed_modules: [ "@minecraft/server" ] }));
    const Run = await Fs.mkdtemp(Path.join(Root, "dist/physics-bds-"));
    const Name = Path.basename(Run);
    if (Template === undefined)
    {console.warn("Creating an isolated BDS-saved world template...");}

    const Level = Template ?? await physicsTemplate(Runtime, Run);
    const World = Path.join(Runtime, "worlds", Name);
    await Fs.mkdir(World, { recursive: true });
    if (Client)
    {
        await Fs.writeFile(Path.join(World, "level.dat"), galleryLevel(await Fs.readFile(Level)));
        const Previous = Path.join(Runtime, "server.properties");
        try
        {await Fs.copyFile(Previous, Path.join(Run, "previous-server.properties"));}
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            {throw error;}
        }
    }
    else
    {await Fs.copyFile(Level, Path.join(World, "level.dat"));}

    const Bp = Path.join(Runtime, "behavior_packs", Name);
    const Rp = Path.join(Runtime, "resource_packs", Name);
    await Fs.mkdir(Bp, { recursive: true });
    await Fs.mkdir(Rp, { recursive: true });
    await Fs.writeFile(Path.join(Rp, "fixture.png"), FixtureTexture);
    await Fs.writeFile(Path.join(Rp, "cube.json"), JSON.stringify({ "minecraft:geometry": [ {
        description: { identifier: "geometry.fixture" },
        bones: [ { name: "root",
            cubes: [ { origin: [ -8, -8, -8 ],
                size: [ 16, 16, 16 ] } ] } ]
    } ] }));
    const Config = Path.join(Run, "build.json");
    const Vertices = Array.from({ length: 8 }, (_, i) => ({ x: (i & 1) ? 0.5 : -0.5,
        y: (i & 2) ? 0.5 : -0.5,
        z: (i & 4) ? 0.5 : -0.5 }));
    const Faces = [ [ 0, 4, 6, 2 ], [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ], [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ] ];
    const Solid = { schemaVersion: 1,
        coordinates: "minecraft",
        metresPerUnit: 1,
        vertices: Vertices,
        triangles: Faces.flatMap((face, index) => [ [ face[0], face[1], face[2] ], [ face[0], face[2], face[3] ] ].map((indices) => ({ indices,
            source: { object: "fixture",
                face: index } }))) };
    await Fs.writeFile(Path.join(Run, "solid.json"), JSON.stringify({ ...Solid,
        fingerprint: fingerprint(Solid) }));
    await Fs.writeFile(Path.join(Run, "anchor.json"), JSON.stringify({ "minecraft:geometry": [ { description: { identifier: "geometry.anchor" },
        bones: [] } ] }));
    await Fs.writeFile(Path.join(Run, "renderer.json"), JSON.stringify({ schemaVersion: 1,
        identifier: "bedform_fixture:renderer",
        geometry: "anchor.json",
        geometryIdentifier: "geometry.anchor",
        assets: [ "anchor.json" ] }));
    await Fs.writeFile(Config, JSON.stringify({ schemaVersion: 1,
        namespace: "bedform_fixture",
        resourcePack: Rp,
        behaviorPack: Bp,
        models: [ { name: "cube",
            representation: "cuboid",
            geometry: "cube.json",
            geometryIdentifier: "geometry.fixture",
            textures: { default: "fixture" },
            materials: { default: "entity_alphatest" } },
        { name: "particle",
            representation: "particle",
            meshSolid: "solid.json",
            rendererDescriptor: "renderer.json",
            collision: { kind: "box",
                fit: true } } ] }));
    const Fixtures = Benchmark || Client ? await createFixtures(Run, Bp, Rp, Client) : undefined;
    const Compiled = Fixtures?.compilation ?? await compile(Config);
    const Results: Array<Record<string, unknown>> = [];
    const Report = { benchmark: Benchmark,
        requestedSeconds: Seconds,
        completed: false,
        qualified: false,
        failures: [] as Array<string>,
        scriptHashes: {} as Record<string, string>,
        phaseExits: {} as Record<string, number | null>,
        engineVersion: "",
        watchdog: false,
        exitCode: null as number | null,
        hardware: { processors: cpus().map((cpu) => cpu.model),
            logicalProcessors: cpus().length,
            memoryBytes: totalmem(),
            platform: platform(),
            release: release(),
            node: process.version },
        engineSha256: createHash("sha256").update(await Fs.readFile(Path.join(Runtime, "bedrock_server.exe"))).digest("hex"),
        meshes: Fixtures?.meshes,
        complexAuthoredCubes: Fixtures?.complexAuthoredCubes,
        results: Results };
    await Fs.writeFile(Path.join(Run, "report.json"), JSON.stringify(Report, null, 2));
    for (const [ File, Data ] of Object.entries(Compiled.files))
    {
        const Target = File.startsWith("behavior_pack/") ? Path.join(Bp, File.slice(14)) : File.startsWith("resource_pack/") ? Path.join(Rp, File.slice(14)) : Path.join(Run, File);
        await Fs.mkdir(Path.dirname(Target), { recursive: true });
        await Fs.writeFile(Target, Data);
    }

    const BpId = randomUUID();
    const RpId = randomUUID();
    const ScriptId = randomUUID();
    await Fs.mkdir(Path.join(Runtime, "config", ScriptId), { recursive: true });
    await Fs.writeFile(Path.join(Runtime, "config", ScriptId, "permissions.json"), JSON.stringify({ allowed_modules: [ "@minecraft/server" ] }));
    await Fs.writeFile(Path.join(Bp, "manifest.json"), JSON.stringify({ format_version: 2,
        header: { name: Name,
            description: "Isolated physics fixture",
            uuid: BpId,
            version: [ 1, 0, 0 ],
            min_engine_version: [ 1, 26, 50 ] },
        modules: [ { type: "data",
            uuid: randomUUID(),
            version: [ 1, 0, 0 ] }, { type: "script",
            language: "javascript",
            entry: "scripts/main.js",
            uuid: ScriptId,
            version: [ 1, 0, 0 ] } ],
        dependencies: [ { module_name: "@minecraft/server",
            version: "2.10.0" }, { uuid: RpId,
            version: [ 1, 0, 0 ] } ] }));
    await Fs.writeFile(Path.join(Rp, "manifest.json"), JSON.stringify({ format_version: 2,
        header: { name: Name,
            description: "Isolated physics fixture",
            uuid: RpId,
            version: [ 1, 0, 0 ],
            min_engine_version: [ 1, 26, 50 ] },
        modules: [ { type: "resources",
            uuid: randomUUID(),
            version: [ 1, 0, 0 ] } ] }));
    await Fs.writeFile(Path.join(World, "world_behavior_packs.json"), JSON.stringify([ { pack_id: BpId,
        version: [ 1, 0, 0 ] } ]));
    await Fs.writeFile(Path.join(World, "world_resource_packs.json"), JSON.stringify([ { pack_id: RpId,
        version: [ 1, 0, 0 ] } ]));
    const Bundle = (scene: string) => build({ entryPoints: [ Path.join(Root, Client ? "Test/Engine/client.mts" : Benchmark ? "Test/Engine/benchmark.mts" : "Test/Engine/physics.mts") ],
        outfile: Path.join(Bp, "scripts/main.js"),
        bundle: true,
        format: "esm",
        platform: "neutral",
        external: [ "@minecraft/server" ],
        define: { BenchmarkProfile: String(process.argv.includes("--profile")),
            BenchmarkSeconds: String(Seconds),
            BenchmarkScene: JSON.stringify(scene) },
        plugins: [ { name: "compiled-catalog",
            setup: (builder) =>
            {
                builder.onResolve({ filter: new RegExp("^\\./catalog\\.mjs$") }, () => ({ path: Path.join(Run, "catalog/models.ts") }));
            } } ],
        target: "es2022" });
    await Bundle("all");
    await Fs.writeFile(Path.join(Runtime, "server.properties"), `server-name=Bedform isolated tests\nlevel-name=${Name}\ngamemode=creative\ndifficulty=peaceful\nallow-cheats=true\nonline-mode=false\nallow-player-joining=false\ntransport=nethernet\nserver-port=0\nserver-portv6=0\nenable-lan-visibility=false\ncontent-log-file-enabled=true\ncontent-log-console-output-enabled=true\ntick-distance=4\nview-distance=5\n`);
    if (Client)
    {
        const Properties = Path.join(Runtime, "server.properties");
        await Fs.writeFile(Properties, (await Fs.readFile(Properties, "utf8")).replace("online-mode=false", "online-mode=true").replace("allow-player-joining=false", "allow-player-joining=true").replace("server-port=0", "server-port=19142").replace("server-portv6=0", "server-portv6=19143") + "texturepack-required=true\nforce-gamemode=true\nlevel-type=FLAT\n");
        await Fs.writeFile(Path.join(Run, "client-session.json"), JSON.stringify({ prepared: true,
            captured: false,
            runtime: Runtime,
            executable: Path.join(Runtime, "bedrock_server.exe"),
            world: Name,
            port: 19142,
            transport: "nethernet",
            clientsRequired: 2,
            guide: "Package/Bedform/Documentation/physics-client-validation.md" }, null, 2));
        await Fs.copyFile(Path.join(Run, "client-session.json"), Path.join(Root, "dist/physics-client-session.json"));
    }

    for (const Phase of Client ? [] : Benchmark ? BenchmarkScenes : [ "startup", "restart" ])
    {
        if (Benchmark)
        {
            await Bundle(Phase);
            Report.scriptHashes[Phase] = createHash("sha256").update(await Fs.readFile(Path.join(Bp, "scripts/main.js"))).digest("hex");
            await Fs.copyFile(Path.join(Bp, "scripts/main.js"), Path.join(Run, `${Phase}.js`));
            const PhaseWorld = `${Name}-${Phase}`;
            const PhaseDirectory = Path.join(Runtime, "worlds", PhaseWorld);
            await Fs.mkdir(PhaseDirectory, { recursive: true });
            for (const File of [ "level.dat", "world_behavior_packs.json", "world_resource_packs.json" ])
            {
                await Fs.copyFile(Path.join(World, File), Path.join(PhaseDirectory, File));
            }

            const PropertiesFile = Path.join(Runtime, "server.properties");
            await Fs.writeFile(PropertiesFile, (await Fs.readFile(PropertiesFile, "utf8")).replace(/^level-name=.*$/mu, `level-name=${PhaseWorld}`));
        }

        const Child = spawn(Path.join(Runtime, "bedrock_server.exe"), [], { cwd: Runtime,
            windowsHide: true,
            stdio: [ "pipe", "pipe", "pipe" ] });
        let log = "";
        let stopping = false;
        let pending = "";
        let reports = Promise.resolve();
        const Stop = (): void =>
        {
            if (!stopping)
            {
                stopping = true;
                Child.stdin.write("stop\n");
            }
        };

        const Timeout = Benchmark ? (Seconds + Math.min(Seconds, 60) + 4 * Math.min(Seconds, 10) + 180) * 1000 : 180000;
        const Timer = setTimeout(Stop, Timeout);
        const Kill = setTimeout(() => Child.kill(), Timeout + 15000);
        Child.stdin.on("error", () =>
        {
        });
        Child.stdout.on("data", (data: Buffer) =>
        {
            const Text = data.toString();
            log += Text;
            process.stdout.write(Text);
            pending += Text;
            const Lines = pending.split("\n");
            pending = Lines.pop()!;
            for (const Line of Lines)
            {
                const Version = /Version: ([\d.]+)/u.exec(Line);
                if (Version)
                {
                    Report.engineVersion = Version[1];
                }

                if (/watchdog.*(terminat|hang)|script.*watchdog.*(terminat|hang)/iu.test(Line))
                {
                    Report.watchdog = true;
                }

                const Result = /BF_BENCH_RESULT (\{.*\})/u.exec(Line);
                if (Result)
                {
                    Results.push(JSON.parse(Result[1]) as Record<string, unknown>);
                }

                if (Benchmark && /BF_BENCH_(RESULT|PROGRESS|SCENE)/u.test(Line))
                {
                    const Snapshot = JSON.stringify(Report, null, 2);
                    reports = reports.then(() => Fs.writeFile(Path.join(Run, "report.json"), Snapshot));
                }
            }

            if (/BF_(PASS|FAIL|RESTART_READY|BENCH_DONE)/u.test(log))
            {
                Stop();
            }
        });
        Child.stderr.on("data", (data: Buffer) =>
        {
            log += data.toString();
            process.stderr.write(data);
        });
        try
        {
            const Exit = await new Promise<number | null>((resolve, reject) =>
            {
                Child.on("error", reject);
                Child.on("close", resolve);
            });
            Report.exitCode = Exit;
            Report.phaseExits[Phase] = Exit;
            const Expected = Benchmark ? "BF_BENCH_DONE" : Phase === "startup" ? "BF_RESTART_READY" : "BF_PASS";
            if (Exit !== 0 || !log.includes(Expected) || log.includes("BF_FAIL") || !/Version: \d/u.test(log))
            {
                throw new Error(`Engine fixture ${Phase} failed; see ${Run}`);
            }

            if (Benchmark)
            {
                Report.completed = Results.length === BenchmarkScenes.length;
                Report.qualified = Results.some((result) => result.scene === "mixed-128" && result.qualified === true) && !Report.watchdog;
            }
        }
        catch (error)
        {
            if (!Benchmark)
            {
                throw error;
            }

            Report.failures.push(`${Phase}: ${String(error)}`);
            console.warn(`Retained failed benchmark scene ${Phase}; continuing independent scenes`);
        }
        finally
        {
            clearTimeout(Timer);
            clearTimeout(Kill);
            await Fs.writeFile(Path.join(Run, `${Phase}.log`), log);
            await reports;
            await Fs.writeFile(Path.join(Run, "report.json"), JSON.stringify(Report, null, 2));
        }
    }

    if (Benchmark)
    {
        Report.completed = Results.length === BenchmarkScenes.length && Report.failures.length === 0;
        Report.qualified = Report.completed && !Report.watchdog && Results.some((result) => result.scene === "mixed-128" && result.qualified === true) && Results.every((result) => Number(result.failedTicks) === 0 && Number(result.invalidClock) === 0);
        await Fs.writeFile(Path.join(Run, "report.json"), JSON.stringify(Report, null, 2));
    }

    console.warn(`Evidence: ${Run}`);
    if (Benchmark && (!Report.completed || Report.watchdog || Report.failures.length > 0 || Results.some((result) => Number(result.failedTicks) > 0 || Number(result.invalidClock) > 0) || Seconds >= 600 && !Report.qualified))
    {
        throw new Error(`Benchmark acceptance failed; retained report: ${Path.join(Run, "report.json")}`);
    }
}
finally
{
    await Lock.close();
    await Fs.unlink(Path.join(Root, "dist/physics-bds.lock"));
}
