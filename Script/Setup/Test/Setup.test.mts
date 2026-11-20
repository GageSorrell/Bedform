/**
 * Component fixtures for setup ordering, CLI isolation and stable local-fork paths.
 *
 * @module monorepo-setup/Test/Setup.test
 *
 * @file      Setup.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { BuildInstall, Consent, CreativeTools, Permissions, Probes, Processes } from "../Source/Contract.js";
import { ConsentLayer, ProbeLayer, ProcessLayer } from "../Source/Node.js";
import { Defaults, Fixture, RequestFor } from "./Fixture.mjs";
import { Effect, Layer } from "effect";
import { ResolveOptions, ResolvePaths, RunSetup } from "../Source/Setup.js";
import { execFileSync, spawnSync } from "node:child_process";
import { Command } from "effect/cli";
import { MakeCommand } from "../Source/Cli.js";
import { NodeServices } from "@effect/platform-node";
import type { Options } from "../Source/Contract.js";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { resolve } from "node:path";
import test from "node:test";

const Root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const Entry = resolve(Root, "Script/Setup/Distribution/index.js");
test("source discovery follows compiled CLI, and directory follows original cwd", () =>
{
    const cwd = resolve(Root, "outside checkout");
    const paths = ResolvePaths(new URL("../Distribution/index.js", import.meta.url).href,
        cwd, process.execPath, "tools with spaces");
    assert.equal(paths.monorepo, Root);
    assert.equal(paths.source, resolve(Root, "Package/Cinnabar"));
    assert.equal(paths.install, resolve(cwd, "tools with spaces"));
    assert.equal(RequestFor().paths.install, "C:\\Program Files\\Bedform\\Cinnabar");
    assert.equal(paths.originalCwd, cwd);
});

test("provisioning paths resolve before handoff and omitted paths remain absent", () =>
{
    const options = ResolveOptions({ ...Defaults,
        bdsDirectory: "server",
        mcpConfig: "mcp.json" }, Root);
    assert.equal(options.bdsDirectory, resolve(Root, "server"));
    assert.equal(options.mcpConfig, resolve(Root, "mcp.json"));
    assert.equal(ResolveOptions(Defaults, Root).bdsDirectory, undefined);
});

test("default execution runs only required stages with refreshed child environment", async () =>
{
    const fixture = Fixture();
    assert.equal(await Effect.runPromise(RunSetup(RequestFor()).pipe(Effect.provide(fixture.layer))), 0);
    assert.deepEqual(fixture.events,
        [ "platform", "source", "permissions", "prerequisites", "buildInstall" ]);
    assert.equal(fixture.requests[1].account.environment.PATH, "permission tools");
    assert.equal(fixture.requests[2].account.environment.PATH, "refreshed tools");
    assert.equal(fixture.requests[2].account.id, "original account");
    assert.equal(fixture.requests[2].options.update, false);
});

test("forced local rebuild and all selected stages survive permission handoff", async () =>
{
    const fixture = Fixture();
    const request = RequestFor({ bdsDirectory: "D:\\BDS",
        blender: true,
        blockbench: true,
        mcpConfig: "D:\\MCP.json",
        update: true });
    await Effect.runPromise(RunSetup(request).pipe(Effect.provide(fixture.layer)));
    assert.deepEqual(fixture.events, [ "platform", "source", "permissions", "prerequisites", "buildInstall",
        "bds:D:\\BDS", "mcp:D:\\MCP.json", "blender", "blockbench" ]);
    for (const forwarded of fixture.requests)
    {
        assert.equal(forwarded.options, request.options);
        assert.equal(forwarded.paths, request.paths);
        assert.equal(forwarded.account.id, request.account.id);
    }
});

test("provisioning and creative stages can be selected without rebuilding core", async () =>
{
    const fixture = Fixture();
    await Effect.runPromise(RunSetup(RequestFor({ blockbench: true,
        core: false,
        mcpConfig: "explicit config" }))
        .pipe(Effect.provide(fixture.layer)));
    assert.deepEqual(fixture.events, [ "platform", "source", "permissions", "prerequisites",
        "mcp:explicit config", "blockbench" ]);
});

test("optional decline and failure preserve required success and the other optional stage", async () =>
{
    const fixture = Fixture();
    const result = await Effect.runPromise(RunSetup(RequestFor({ blender: true,
        blockbench: true })).pipe(
        Effect.provideService(CreativeTools, {
            blender: () => Effect.fail(new Error("Consent declined")),
            blockbench: () => Effect.sync(() => { fixture.events.push("blockbench"); })
        }),
        Effect.provide(fixture.layer)
    ));
    assert.equal(result, 0);
    assert.ok(fixture.events.includes("buildInstall"));
    assert.equal(fixture.events.at(-1), "blockbench");
});

test("relaunch propagates failure exit code and prevents duplicate orchestration", async () =>
{
    const fixture = Fixture();
    const result = await Effect.runPromise(RunSetup(RequestFor({ update: true })).pipe(
        Effect.provideService(Permissions, {
            prepare: () => Effect.succeed({ exitCode: 37,
                kind: "relaunched" })
        }), Effect.provide(fixture.layer)
    ));
    assert.equal(result, 37);
    assert.deepEqual(fixture.events, [ "platform", "source" ]);
});

for (const failure of [ "platform", "source" ] as const)
{
    test(`${failure} failure stops before any machine-changing stage`, async () =>
    {
        const fixture = Fixture();
        await assert.rejects(Effect.runPromise(RunSetup(RequestFor()).pipe(
            Effect.provideService(Probes, {
                platform: failure === "platform" ? Effect.fail(new Error(failure)) : Effect.void,
                source: () => Effect.fail(new Error("source"))
            }), Effect.provide(fixture.layer)
        )), new RegExp(failure));
        assert.deepEqual(fixture.events, []);
    });
}

test("required failure stops provisioning and optional stages", async () =>
{
    const fixture = Fixture();
    await assert.rejects(Effect.runPromise(RunSetup(RequestFor({ blender: true })).pipe(
        Effect.provideService(BuildInstall, { run: () => Effect.fail(new Error("build failed")) }),
        Effect.provide(fixture.layer)
    )), /build failed/);
    assert.equal(fixture.events.at(-1), "prerequisites");
});

test("Effect CLI parses forced rebuild, paths and independent stage selections", async () =>
{
    let parsed: Options | undefined;
    const command = MakeCommand((options: Options) => Effect.sync(() =>
    {
        parsed = options;
    }));
    await Effect.runPromise(Command.runWith(command, { version: "1.0.0" })([
        "--update", "--directory", "tools with spaces", "--no-core", "--bds-directory", "server",
        "--mcp-config", "config.json", "--blender", "--blockbench"
    ]).pipe(Effect.provide(NodeServices.layer)));
    assert.deepEqual(parsed, {
        bdsDirectory: "server",
        blender: true,
        blockbench: true,
        core: false,
        directory: "tools with spaces",
        mcpConfig: "config.json",
        update: true
    });
});

test("Effect CLI ordinary invocation selects incremental core only", async () =>
{
    let parsed: Options | undefined;
    await Effect.runPromise(Command.runWith(MakeCommand((options: Options) => Effect.sync(() =>
    {
        parsed = options;
    })), { version: "1.0.0" })([]).pipe(Effect.provide(NodeServices.layer)));
    assert.deepEqual(parsed, { ...Defaults,
        bdsDirectory: undefined,
        directory: undefined,
        mcpConfig: undefined });
});

for (const flag of [ "--help", "--version" ])
{
    test(`compiled ${flag} works from another cwd without any setup services`, () =>
    {
        const output = execFileSync(process.execPath, [ Entry, flag ], { cwd: process.env.TEMP,
            encoding: "utf8" });
        assert.match(output, flag === "--version" ? /1\.0\.0/ : /--directory/);
        assert.doesNotMatch(output, /Missing local fork|not implemented/);
    });
}

test("importing every compiled module never runs the CLI handler", () =>
{
    const output = execFileSync(process.execPath, [ "--input-type=module", "-e",
        "await Promise.all(['index','Cli','Node','Setup','Contract','Currency']" +
        ".map(n => import('./' + n + '.js')));" ],
    { cwd: resolve(Root, "Script/Setup/Distribution"),
        encoding: "utf8" });
    assert.equal(output, "");
});

test("invalid CLI flags fail without entering setup", () =>
{
    const result = spawnSync(process.execPath, [ Entry, "--fetch" ], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /Missing local fork|not implemented/);
});

test("npm setup uses INIT_CWD for overrides while retaining its owning checkout", () =>
{
    const caller = resolve(Root, "outside caller");
    const module = new URL("../Distribution/Cli.js", import.meta.url).href;
    const script = `import { MakeRequest } from ${JSON.stringify(module)}; ` +
        "process.stdout.write(JSON.stringify(MakeRequest({ directory: 'tools' }).paths));";
    const output = execFileSync(process.execPath, [ "--input-type=module", "-e", script ], {
        cwd: Root,
        encoding: "utf8",
        env: { ...process.env,
            INIT_CWD: caller,
            npm_lifecycle_event: "setup" }
    });
    const paths = JSON.parse(output);
    assert.equal(paths.originalCwd, caller);
    assert.equal(paths.install, resolve(caller, "tools"));
    assert.equal(paths.source, resolve(Root, "Package/Cinnabar"));
});

test("Node process adapter preserves argument boundaries and child exit code", async () =>
{
    const result = await Effect.runPromise(Effect.gen(function*()
    {
        const processes = yield* Processes;
        return yield* processes.run({
            args: [ "-e", "process.exit(process.argv[1] === 'a b;$(literal)' ? 23 : 24)", "a b;$(literal)" ],
            cwd: Root,
            environment: { ...process.env },
            executable: process.execPath
        });
    }).pipe(Effect.provide(ProcessLayer.pipe(Layer.provide(NodeServices.layer)))));
    assert.equal(result, 23);
});

test("reusable consent/process services default to No and retain explicit responses", async () =>
{
    const fixture = Fixture();
    await Effect.runPromise(Effect.gen(function*()
    {
        const consent = yield* Consent;
        const processes = yield* Processes;
        assert.equal(yield* consent.confirm("first"), false);
        fixture.answers.push(true, false);
        assert.equal(yield* consent.confirm("second"), true);
        assert.equal(yield* consent.confirm("third"), false);
        fixture.exitCodes.push(3010);
        const command = {
            args: [ "literal path with spaces" ],
            cwd: Root,
            environment: {},
            executable: "fake installer"
        };
        assert.equal(yield* processes.run(command), 3010);
        assert.deepEqual(fixture.commands, [ command ]);
    }).pipe(Effect.provide(fixture.layer)));
    assert.deepEqual(fixture.prompts, [ "first", "second", "third" ]);
});

test("Node consent refuses noninteractive input before opening a prompt", async () =>
{
    assert.equal(Boolean(process.stdin.isTTY), false);
    const confirmation = Effect.gen(function*()
    {
        const consent = yield* Consent;
        return yield* consent.confirm("Install a tool?");
    });
    await assert.rejects(Effect.runPromise(confirmation.pipe(
        Effect.provide(ConsentLayer.pipe(Layer.provide(NodeServices.layer)))
    )), /Interactive consent required/);
});

test("Node source probe diagnoses a missing local fork without machine services", async () =>
{
    const paths = { ...RequestFor().paths,
        source: resolve(Root, "Script/Setup/dist/absent-local-fork") };
    const preflight = Effect.gen(function*()
    {
        const probes = yield* Probes;
        return yield* probes.source(paths);
    });
    await assert.rejects(Effect.runPromise(preflight.pipe(
        Effect.provide(ProbeLayer.pipe(Layer.provide(NodeServices.layer)))
    )), /complete checkout/);
});
