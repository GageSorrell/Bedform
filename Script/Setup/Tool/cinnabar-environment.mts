/**
 * Reproducible native-feasibility preparation on the explicitly selected Windows development machine.
 *
 * @module monorepo-setup/Tool/cinnabar-environment
 *
 * @file      cinnabar-environment.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture field order follows emitted evidence, and callbacks retain contextual types. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys */

import { Console, Effect, Layer } from "effect";
import { NodeServices } from "@effect/platform-node";
import { MakeRequest } from "../Source/Cli.js";
import { ConsentLayer, ProbeLayer, ProcessLayer } from "../Source/Node.js";
import { IdentityLayer } from "../Source/Windows.js";
import { AccountIdentity } from "../Source/Permissions.js";
import { EnvironmentVariable } from "../Source/keys.js";
import { PrerequisiteHost } from "../Source/Prerequisite.js";
import { PrerequisiteHostLayer } from "../Source/PrerequisiteNode.js";
import { PrerequisiteLayer } from "../Source/Prerequisites.js";
import { Prerequisites, Probes } from "../Source/Contract.js";
import type { ProcessCommand } from "../Source/Contract.js";
import type { ToolEnvironment, ToolOutput } from "../Source/Prerequisite.js";
import {
    MeasureTree,
    QualificationPaths,
    RestoreWorldCheckpoint,
    SaveWorldCheckpoint
} from "../Source/Qualification.js";
import { WorldFixture } from "../../WorldFixture.mjs";
import { physicsTemplate } from "../../../Package/Bedform/Tool/physics-engine.mjs";
import { cp, lstat, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { cpus, totalmem } from "node:os";
import path from "node:path";

const Repository = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const Root = path.join(Repository, "Package/Bedform");
const Reset = process.argv.indexOf("--reset");
const RunId = Reset < 0 ? `cinnabar-env-${randomUUID()}` : process.argv[Reset + 1];
if (
    RunId === undefined ||
    (Reset < 0 ? process.argv.length !== 2 : Reset !== 2 || process.argv.length !== 4)
)
{
    throw new Error("Usage: qualify:cinnabar [--reset cinnabar-env-UUID]");
}

/**
 * Converts asynchronous local IO failures into the shared Effect error channel.
 *
 * @category Converting
 * @since 1.0.0
 */
function Io<Value>(run: () => Promise<Value>)
{
    return Effect.tryPromise({
        try: run,
        catch: (error: unknown) => (error instanceof Error ? error : new Error(String(error)))
    });
}

/**
 * Captures tool commands and diagnostics while never serializing the inherited environment or credentials.
 *
 * @category Model
 * @since 1.0.0
 */
interface Observation extends ToolOutput {
    executable: string;
    args: ReadonlyArray<string>;
}

const Observations: Array<Observation> = [];
let DeveloperEnvironment: ToolEnvironment | undefined;
const Platform = NodeServices.layer;
const Host = Layer.mergeAll(PrerequisiteHostLayer, IdentityLayer).pipe(
    Layer.provideMerge(Platform)
);
const RecordedHost = Layer.effect(
    PrerequisiteHost,
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        return {
            ...host,
            capture: (command: ProcessCommand) =>
                host.capture(command).pipe(
                    Effect.tap((output: ToolOutput) =>
                        Effect.sync(() =>
                        {
                            Observations.push({
                                executable: command.executable,
                                args: command.args.includes("-EncodedCommand")
                                    ? [ "fixed encoded helper" ]
                                    : command.args,
                                ...output
                            });
                            if (command.executable === "cl.exe" && output.code === 0)
                            {
                                DeveloperEnvironment = command.environment;
                            }
                        })
                    )
                )
        };
    })
).pipe(Layer.provideMerge(Host));
const Adapters = Layer.mergeAll(ConsentLayer, ProcessLayer, ProbeLayer).pipe(
    Layer.provideMerge(RecordedHost)
);
const Services = PrerequisiteLayer.pipe(Layer.provideMerge(Adapters));

const HostScript = `$ErrorActionPreference='Stop'
$target=$env:${EnvironmentVariable.RuntimeExecutable}
$running=@(Get-CimInstance Win32_Process -Filter "Name='bedrock_server.exe'" | ForEach-Object {
 if(-not $_.ExecutablePath){throw 'Cannot inspect BDS process ownership'}
 if($_.ExecutablePath -eq $target){$_.ProcessId}
})
$rules=@(Get-NetFirewallApplicationFilter -PolicyStore ActiveStore -Program $target |
 Get-NetFirewallRule | Where-Object {$_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound'})
$os=Get-CimInstance Win32_OperatingSystem
@{version=(Get-Item -LiteralPath $target).VersionInfo.ProductVersion; running=$running;
 allow=@($rules | Where-Object {$_.Action -eq 'Allow'}).Count -gt 0;
 block=@($rules | Where-Object {$_.Action -eq 'Block'}).Count -gt 0;
 os=$os.Caption; build=$os.BuildNumber;
 video=@(Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion)
} | ConvertTo-Json -Depth 5 -Compress`;

const Program = Effect.gen(function* ()
{
    const probes = yield* Probes;
    yield* probes.platform;
    const identity = yield* (yield* AccountIdentity).inspect;
    const paths = yield* Io(() => QualificationPaths(Root, RunId));
    const executable = path.join(paths.runtime, "bedrock_server.exe");
    if (!(yield* Io(() => lstat(executable))).isFile())
    {
        return yield* Effect.fail(new Error("The fixed BDS executable must be a regular file."));
    }

    const request = MakeRequest({ core: true,
        update: false,
        blender: false,
        blockbench: false });
    const bounded = {
        ...request.account.environment,
        CARGO_BUILD_JOBS: "2",
        CMAKE_BUILD_PARALLEL_LEVEL: "2",
        GOMAXPROCS: "2"
    };
    const current = {
        ...request,
        account: { ...request.account,
            id: identity.sid,
            home: identity.home,
            environment: bounded }
    };
    yield* probes.source(current.paths);
    const host = yield* PrerequisiteHost;
    const lockPath = path.join(Root, "dist/physics-bds.lock");
    const lock = yield* Effect.acquireRelease(Io(() => open(lockPath, "wx")),
        (file) => Io(async () =>
        {
            await file.close();
            await rm(lockPath);
        }).pipe(Effect.orDie));
    yield* Io(() => lock.writeFile(JSON.stringify({ pid: process.pid,
        runId: RunId })));
    const metadata = yield* host.capture({
        executable: "powershell.exe",
        args: [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            Buffer.from(HostScript, "utf16le").toString("base64")
        ],
        cwd: Root,
        environment: { ...bounded,
            [EnvironmentVariable.RuntimeExecutable]: executable }
    });
    if (metadata.code !== 0)
    {
        return yield* Effect.fail(new Error(metadata.stderr));
    }

    const machine = JSON.parse(metadata.stdout);
    const target = JSON.parse(
        yield* Io(() => readFile(path.join(Repository, "Script/bedrock-target.json"), "utf8"))
    );
    if (
        machine.version !== target.serverVersion ||
        machine.running.length > 0 ||
        !machine.allow ||
        machine.block
    )
    {
        return yield* Effect.fail(
            new Error("Fixed BDS is running, mismatched or lacks effective firewall approval.")
        );
    }

    const assessment = JSON.parse(yield* Io(() => readFile(path.join(current.paths.source,
        `Bedform/bds-${target.serverVersion}-assessment.json`), "utf8")));
    const engineSha256 = yield* host.hash(executable, "sha256");
    if (assessment.engine.version !== target.serverVersion || assessment.engine.sha256 !== engineSha256)
    {
        return yield* Effect.fail(new Error("Fixed BDS executable differs from the assessed engine."));
    }

    if (Reset >= 0)
    {
        yield* Io(() => RestoreWorldCheckpoint(Root, RunId));
        yield* Console.log(`Restored disposable world checkpoint: ${RunId}`);
        return;
    }

    const head = yield* host.capture({
        executable: "git.exe",
        args: [ "rev-parse", "HEAD" ],
        cwd: Repository,
        environment: bounded
    });
    const changes = yield* host.capture({
        executable: "git.exe",
        args: [ "status", "--short" ],
        cwd: Repository,
        environment: bounded
    });
    if (head.code !== 0 || changes.code !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim()))
    {
        return yield* Effect.fail(new Error("Cannot verify the local checkout revision."));
    }

    const records: Record<string, unknown> = {
        schemaVersion: 1,
        runId: RunId,
        timestamp: new Date().toISOString(),
        checkout: { revision: head.stdout.trim(),
            changes: changes.stdout },
        identity,
        machine,
        runtime: executable,
        engineSha256,
        limits: {
            nativeJobs: 2,
            goProcessors: 2,
            bdsThreads: 2,
            renderProcesses: 1,
            logicalProcessors: cpus().length,
            physicalMemory: totalmem()
        },
        acceptance: {
            environment: false,
            nativeAttachment: false,
            cinnabarFrame: false,
            installedBundle: false,
            uac: false,
            cleanMissingIncompleteOsSnapshots: false
        }
    };
    let ready = false;
    let toolError: string | undefined;
    try
    {
        const prepared = yield* (yield* Prerequisites).prepare(current).pipe(
            Effect.map((environment) => ({ environment,
                error: undefined })),
            Effect.catch((error: Error) =>
                Effect.succeed({ environment: undefined,
                    error: error.message })
            )
        );
        toolError = prepared.error;
        ready = prepared.environment !== undefined;
        const environment = prepared.environment ?? DeveloperEnvironment;
        records.prerequisites = { ready,
            error: toolError };
        if (prepared.environment !== undefined)
        {
            records.inputs = {
                nativeSource: prepared.environment[EnvironmentVariable.NativeSource],
                runtimeData: prepared.environment[EnvironmentVariable.RuntimeData],
                assets: prepared.environment[EnvironmentVariable.AssetInputs]
            };
        }

        if (environment === undefined)
        {
            return yield* Effect.fail(
                new Error("Native developer environment unavailable; see recorded probes.")
            );
        }

        const renderer = path.join(paths.run, "renderer-probe.exe");
        const compile = yield* host.capture({
            executable: "cl.exe",
            args: [
                "/nologo",
                "/EHsc",
                "/std:c++20",
                path.join(Repository, "Script/Setup/Native/RendererProbe.cpp"),
                `/Fo${path.join(paths.run, "renderer-probe.obj")}`,
                `/Fe${renderer}`,
                "/link",
                "d3d12.lib",
                "dxgi.lib"
            ],
            cwd: paths.run,
            environment
        });
        if (compile.code !== 0)
        {
            return yield* Effect.fail(new Error(compile.stdout + compile.stderr));
        }

        const rendered = yield* host.capture({
            executable: renderer,
            args: [],
            cwd: paths.run,
            environment
        });
        if (rendered.code !== 0)
        {
            return yield* Effect.fail(new Error(rendered.stderr));
        }

        records.renderer = JSON.parse(rendered.stdout);
        const packId = randomUUID();
        const moduleId = randomUUID();
        const name = `bedform-cinnabar-${RunId}`;
        const pack = path.join(paths.runtime, "behavior_packs", name);
        const permissions = path.join(paths.runtime, "config", moduleId);
        yield* Io(async () =>
        {
            for (const directory of [ path.dirname(pack), path.dirname(permissions) ])
            {
                if (!(await lstat(directory)).isDirectory())
                {
                    throw new Error(`Expected an ordinary BDS fixture directory: ${directory}`);
                }
            }

            await mkdir(paths.world);
            await mkdir(pack);
            await mkdir(path.join(pack, "scripts"));
            await mkdir(permissions);
            await writeFile(path.join(paths.world, "level.dat"), WorldFixture(true));
            const moduleVersion = (name: string) =>
                /^(\d+\.\d+\.\d+(?:-beta)?)/.exec(target.apiPins[name])![1];
            await writeFile(
                path.join(pack, "manifest.json"),
                JSON.stringify({
                    format_version: 2,
                    header: {
                        name: "Cinnabar environment readiness",
                        description: "Disposable API availability fixture",
                        uuid: packId,
                        version: [ 1, 0, 0 ],
                        min_engine_version: [ 1, 26, 0 ]
                    },
                    modules: [
                        {
                            type: "script",
                            language: "javascript",
                            uuid: moduleId,
                            version: [ 1, 0, 0 ],
                            entry: "scripts/main.js"
                        }
                    ],
                    dependencies: [
                        {
                            module_name: "@minecraft/server",
                            version: moduleVersion("@minecraft/server")
                        },
                        {
                            module_name: "@minecraft/server-gametest",
                            version: moduleVersion("@minecraft/server-gametest")
                        }
                    ]
                })
            );
            await writeFile(
                path.join(permissions, "permissions.json"),
                JSON.stringify({
                    allowed_modules: [ "@minecraft/server", "@minecraft/server-gametest" ]
                })
            );
            await writeFile(
                path.join(pack, "scripts/main.js"),
                "import * as GameTest from \"@minecraft/server-gametest\";\n" +
                    "const value={globalSpawn:typeof GameTest.spawnSimulatedPlayer," +
                    "testSpawn:typeof GameTest.Test?.prototype?.spawnSimulatedPlayer," +
                    "register:typeof GameTest.register};\n" +
                    "console.warn(\"BEDFORM_ENVIRONMENT_API \"+JSON.stringify(value));\n"
            );
            await writeFile(
                path.join(paths.world, "world_behavior_packs.json"),
                JSON.stringify([ { pack_id: packId,
                    version: [ 1, 0, 0 ] } ])
            );
        });
        const before = yield* Io(async () =>
            readFile(path.join(paths.runtime, "server.properties"))
        );
        try
        {
            yield* Io(() => physicsTemplate(paths.runtime, paths.run, "max-threads=2\n"));
        }
        finally
        {
            // These exact UUID-owned paths were created by this invocation; no shared pack/config is removed.
            yield* Io(async () =>
            {
                await cp(pack, path.join(paths.run, "behavior-pack"), { recursive: true });
                await cp(permissions, path.join(paths.run, "permissions"), { recursive: true });
                await rm(pack, { recursive: true,
                    force: true });
                await rm(permissions, { recursive: true,
                    force: true });
            });
        }

        const log = yield* Io(() => readFile(path.join(paths.run, "bootstrap.log"), "utf8"));
        const api = /BEDFORM_ENVIRONMENT_API (\{[^\r\n]+\})/.exec(log)?.[1];
        if (api === undefined)
        {
            return yield* Effect.fail(
                new Error("BDS fixture did not report native API availability.")
            );
        }

        const nativeApi = JSON.parse(api);
        records.nativeApi = nativeApi;
        if (nativeApi.globalSpawn !== "function" || nativeApi.testSpawn !== "function" ||
            nativeApi.register !== "function")
        {
            return yield* Effect.fail(
                new Error("The selected server does not expose both required spawn APIs.")
            );
        }

        const after = yield* Io(() => readFile(path.join(paths.runtime, "server.properties")));
        if (!before.equals(after))
        {
            return yield* Effect.fail(new Error("Shared server configuration was not restored."));
        }

        const checkpoint = yield* Io(() => SaveWorldCheckpoint(Root, RunId));
        yield* Io(() =>
            writeFile(path.join(paths.world, "reset-verification.tmp"), "disposable mutation")
        );
        yield* Io(() => RestoreWorldCheckpoint(Root, RunId));
        const restored = yield* Io(() => MeasureTree(paths.world));
        if (JSON.stringify(restored) !== JSON.stringify(checkpoint.files))
        {
            return yield* Effect.fail(new Error("Reset did not reproduce the measured world."));
        }

        records.snapshot = { runId: RunId,
            files: checkpoint.files.length,
            resetVerified: true };
        records.acceptance = {
            environment: ready,
            nativeAttachment: false,
            cinnabarFrame: false,
            installedBundle: false,
            uac: false,
            cleanMissingIncompleteOsSnapshots: false
        };
    }
    finally
    {
        records.observations = Observations;
        yield* Io(() =>
            writeFile(path.join(paths.run, "readiness.json"), JSON.stringify(records, null, 2))
        );
        yield* Console.log(`Native environment evidence: ${path.join(paths.run, "readiness.json")}`);
    }

    if (!ready)
    {
        return yield* Effect.fail(new Error(`Prerequisite qualification incomplete: ${toolError}`));
    }
});

await Effect.runPromise(Program.pipe(Effect.scoped, Effect.provide(Services)));
