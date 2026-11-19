/**
 * Runs the @bedform/effect runtime fixture on an isolated copy of Bedrock
 * Dedicated Server at the fixed `dist/bds-runtime/bedrock_server.exe` path.
 * Missing prerequisites are reported as an unrun validation, never a pass.
 * The fixture may ask for console commands, such as `weather rain` to raise a
 * before-event without a player; the runner sends them as written.
 *
 * Environment: `BDS_PATH` (or `BDS_ROOT`) names the BDS installation to copy;
 * `BDS_EXPECTED_VERSION` overrides the expected engine version prefix
 * (default `1.26.60`); `BDS_TEST_TIMEOUT_MS` bounds each server run.
 *
 * @module @bedform/effect/Tool/bds-runtime
 *
 * @file      bds-runtime.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Option objects follow the Node and esbuild APIs; callbacks are contextually typed, as in the tests. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import { access, cp, mkdir, mkdtemp, open, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { Marker, ScriptEvent } from "./BdsFixture/keys.mjs";
import { build } from "esbuild";
import { constants } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";

const Root: string = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Repository: string = path.resolve(Root, "../..");
const Runtime: string = path.join(Root, "dist/bds-runtime");
const Executable: string = path.join(Runtime, "bedrock_server.exe");
const PackName = "effect_bedrock_fixture" as const;
const ScenarioCount = 6 as const;

/**
 * Writes one line of progress to standard output.
 *
 * @category Utilities
 * @since 1.0.0
 */
function print(message: string): void
{
    process.stdout.write(`${message}
`);
}

/**
 * An error for a prerequisite that prevents the validation from running.
 *
 * @category Errors
 * @since 1.0.0
 */
class Unrun extends Error
{}

/**
 * One scenario result reported by the fixture.
 *
 * @category Tests
 * @since 1.0.0
 */
interface ScenarioResult
{
    readonly name: string;
    readonly ok: boolean;
    readonly detail: string;
}

/**
 * The outcome of one server process.
 *
 * @category Tests
 * @since 1.0.0
 */
interface ServerRun
{
    readonly code: number | null;
    readonly lines: ReadonlyArray<string>;
    readonly timedOut: boolean;
}

/**
 * Checks whether an engine file differs from the cached fixed-path copy.
 *
 * @category Utilities
 * @since 1.0.0
 */
async function needsEngineCopy(source: string, destination: string): Promise<boolean>
{
    const original = await stat(source);
    if (original.isDirectory())
    {
        return true;
    }

    const existing = await stat(destination).catch(() => undefined);
    return existing === undefined || !existing.isFile() || original.size !== existing.size ||
        Math.abs(original.mtimeMs - existing.mtimeMs) >= 1;
}

/**
 * Confirms the explicit firewall setup covers the fixed executable, so that a
 * test run never raises a Windows Firewall prompt.
 *
 * @category Utilities
 * @since 1.0.0
 * @throws { Unrun } When the setup receipt does not list this executable.
 */
async function requireFirewallRule(): Promise<void>
{
    if (process.platform !== "win32" || process.env.EFFECT_BEDROCK_SKIP_FIREWALL_CHECK === "1")
    {
        return;
    }

    const receipt: string = path.join(Repository, "dist/test-firewall-setup.json");
    const text: string = await readFile(receipt, "utf8").catch(() => "");
    // Windows PowerShell writes the receipt with a byte-order mark.
    const parsed = text ? JSON.parse(text.replace(/^\uFEFF/u, "")) as { rules?: Array<{ executable?: string }> } : {};
    const covered: boolean = (parsed.rules ?? []).some((rule) =>
        path.resolve(rule.executable ?? "").toLowerCase() === Executable.toLowerCase());
    if (!covered)
    {
        throw new Unrun(`No firewall rule covers ${Executable}. Run "npm run firewall:configure" at the ` +
            "repository root once (Windows administrator approval), then rerun.");
    }
}

/**
 * Starts the server, feeds lines to a handler that may send console commands,
 * and resolves when it exits or the timeout stops it.
 *
 * @category Utilities
 * @since 1.0.0
 */
async function runServer(timeout: number, onLine: (line: string, send: (command: string) => void) => void): Promise<ServerRun>
{
    const lines: Array<string> = [];
    let timedOut: boolean = false;
    let stopping: NodeJS.Timeout | undefined;
    const child = spawn(Executable, [], { cwd: Runtime,
        stdio: [ "pipe", "pipe", "pipe" ],
        windowsHide: true });
    const send = (command: string): void =>
    {
        if (command === "stop")
        {
            if (stopping !== undefined)
            {
                return;
            }

            stopping = setTimeout(() => child.kill(), 15_000);
        }

        child.stdin.write(`${command}\n`);
    };

    const timer: NodeJS.Timeout = setTimeout(() =>
    {
        timedOut = true;
        send("stop");
    }, timeout);
    const consume = (line: string): void =>
    {
        lines.push(line);
        onLine(line, send);
    };

    child.stdin.on("error", () => undefined);
    createInterface({ input: child.stdout }).on("line", consume);
    createInterface({ input: child.stderr }).on("line", consume);
    try
    {
        const code: number | null = await new Promise((resolve, reject) =>
        {
            child.on("error", reject);
            child.on("close", resolve);
        });
        return { code,
            lines,
            timedOut };
    }
    finally
    {
        clearTimeout(timer);
        clearTimeout(stopping);
    }
}

/**
 * Writes the server properties for an isolated, non-joinable test world.
 *
 * @category Utilities
 * @since 1.0.0
 */
async function writeProperties(world: string): Promise<void>
{
    await writeFile(path.join(Runtime, "server.properties"), [
        "server-name=@bedform/effect runtime fixture",
        `level-name=${world}`,
        "level-type=FLAT",
        "gamemode=creative",
        "difficulty=peaceful",
        "allow-cheats=true",
        "online-mode=false",
        "allow-list=false",
        "max-players=1",
        "allow-player-joining=false",
        "transport=nethernet",
        "server-port=0",
        "server-portv6=0",
        "enable-lan-visibility=false",
        "content-log-file-enabled=true",
        "content-log-console-output-enabled=true",
        "player-idle-timeout=0"
    ].join("\n") + "\n");
}

/**
 * Prepares the fixed runtime, runs the fixture and records machine-readable results.
 *
 * @category Tests
 * @since 1.0.0
 */
async function run(): Promise<void>
{
    const installation: string | undefined = process.env.BDS_PATH ?? process.env.BDS_ROOT;
    if (!installation)
    {
        throw new Unrun("Set BDS_PATH (or BDS_ROOT) to a Bedrock Dedicated Server installation.");
    }

    const source: string = path.resolve(installation);
    await access(path.join(source, "bedrock_server.exe"), constants.F_OK)
        .catch(() => Promise.reject(new Unrun(`No bedrock_server.exe in ${source}.`)));
    await requireFirewallRule();
    const expectedVersion: string = process.env.BDS_EXPECTED_VERSION ?? "1.26.60";
    const timeout: number = Number(process.env.BDS_TEST_TIMEOUT_MS ?? 180_000);
    const runs: string = path.join(Root, "dist/bds-runs");
    await mkdir(runs, { recursive: true });
    const directory: string = await mkdtemp(path.join(runs, "run-"));
    await mkdir(Runtime, { recursive: true });
    const lockPath: string = path.join(Runtime, ".bedform-effect-run.lock");
    const lock = await open(lockPath, "wx").catch(() =>
    {
        throw new Error(`Another run owns ${lockPath}; do not run BDS jobs concurrently.`);
    });
    try
    {
        print(`Preparing the fixed BDS runtime at ${Runtime}`);
        for (const name of await readdir(source))
        {
            if (![ "worlds", "logs", "config", "server.properties", "allowlist.json", "permissions.json" ].includes(name))
            {
                await cp(path.join(source, name), path.join(Runtime, name),
                    { filter: needsEngineCopy,
                        preserveTimestamps: true,
                        recursive: true });
            }
        }

        const pack: string = path.join(Runtime, "behavior_packs", PackName);
        await rm(pack, { force: true,
            recursive: true });
        await mkdir(path.join(pack, "scripts"), { recursive: true });
        const manifestText: string = await readFile(path.join(Root, "Tool/BdsFixture/manifest.json"), "utf8");
        const manifest = JSON.parse(manifestText) as {
            header: { uuid: string;
                version: Array<number> };
            modules: Array<{ type: string;
                uuid: string }>;
        };
        await writeFile(path.join(pack, "manifest.json"), manifestText);
        await build({
            entryPoints: [ path.join(Root, "Tool/BdsFixture/main.mts") ],
            bundle: true,
            format: "esm",
            platform: "neutral",
            mainFields: [ "module", "main" ],
            target: "es2022",
            external: [ "@minecraft/server" ],
            outfile: path.join(pack, "scripts/main.js")
        });
        const scriptModule: string = manifest.modules.find((module) => module.type === "script")!.uuid;
        await mkdir(path.join(Runtime, "config", scriptModule), { recursive: true });
        await writeFile(path.join(Runtime, "config", scriptModule, "permissions.json"),
            JSON.stringify({ allowed_modules: [ "@minecraft/server" ] }));

        const worldName: string = `bedform-effect-${path.basename(directory)}`;
        await writeProperties(worldName);
        print("Creating the test world.");
        const bootstrap: ServerRun = await runServer(timeout, (line, send) =>
        {
            if (line.includes("Server started."))
            {
                send("stop");
            }
        });
        await writeFile(path.join(directory, "bootstrap.log"), bootstrap.lines.join("\n"));
        const version: string | undefined = bootstrap.lines.map((line) => /Version:?\s*([0-9.]+)/.exec(line)?.[1])
            .find((value) => value !== undefined);
        if (version === undefined || !version.startsWith(expectedVersion))
        {
            throw new Error(`Expected BDS ${expectedVersion}.x but the engine reported ${version ?? "no version"}.`);
        }

        const world: string = path.join(Runtime, "worlds", worldName);
        await access(path.join(world, "level.dat"));
        await writeFile(path.join(world, "world_behavior_packs.json"),
            JSON.stringify([ { pack_id: manifest.header.uuid,
                version: manifest.header.version } ]));

        print(`Running the fixture on BDS ${version}.`);
        const results: Array<ScenarioResult> = [];
        let shutdownFinalized: boolean = false;
        const main: ServerRun = await runServer(timeout, (line, send) =>
        {
            print(line);
            if (line.includes(Marker.Ready))
            {
                send(`scriptevent ${ScriptEvent.Run} go`);
            }

            const command: number = line.indexOf(Marker.Command);
            if (command !== -1)
            {
                send(line.slice(command + Marker.Command.length).trim());
            }

            const result: number = line.indexOf(Marker.Result);
            if (result !== -1)
            {
                results.push(JSON.parse(line.slice(result + Marker.Result.length)) as ScenarioResult);
            }

            if (line.includes(Marker.Done))
            {
                send("stop");
            }

            if (line.includes(Marker.Shutdown))
            {
                shutdownFinalized = true;
            }
        });
        await writeFile(path.join(directory, "fixture.log"), main.lines.join("\n"));
        const scriptErrors: Array<string> = main.lines.filter((line) =>
            /\[Scripting\]/i.test(line) && /error/i.test(line) && !line.includes(Marker.Result));
        const failures: Array<string> = [
            ...(main.timedOut ? [ `timed out after ${timeout} ms` ] : []),
            ...(main.lines.some((line) => line.includes(Marker.Done)) ? [] : [ "fixture never reported completion" ]),
            ...(results.length === ScenarioCount ? [] : [ `expected ${ScenarioCount} scenario results, received ${results.length}` ]),
            ...results.filter((result) => !result.ok).map((result) => `${result.name}: ${result.detail}`),
            ...(shutdownFinalized ? [] : [ "runtime finalizers did not run at shutdown" ]),
            ...scriptErrors
        ];
        await writeFile(path.join(directory, "results.json"),
            JSON.stringify({ engine: version,
                failures,
                results,
                runtime: Runtime,
                shutdownFinalized }, null, 2));
        print(`Run retained at ${directory}`);
        for (const result of results)
        {
            print(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
        }

        if (failures.length > 0)
        {
            throw new Error(`BDS runtime validation failed:\n${failures.join("\n")}`);
        }

        print("BDS runtime validation passed.");
    }
    finally
    {
        await lock.close();
        await unlink(lockPath);
    }
}

run().catch((error: unknown) =>
{
    if (error instanceof Unrun)
    {
        console.error(`UNRUN: ${error.message} No BDS validation ran; this is not a pass.`);
        process.exitCode = 2;
        return;
    }

    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
