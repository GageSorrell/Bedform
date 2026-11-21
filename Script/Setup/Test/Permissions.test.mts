/**
 * Machine-free permission policy, UAC transport and scoped Windows filesystem qualification.
 *
 * @module monorepo-setup/Test/Permissions.test
 *
 * @file      Permissions.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Access, AccountIdentity, Elevation, IsAbsolutePath, Overlaps,
    PermissionLayer } from "../Source/Permissions.js";
import type { AccessTarget, Identity } from "../Source/Permissions.js";
import { ActiveSession, SessionLayer, Sessions } from "../Source/Session.js";
import { CanonicalPath, ElevationLayer, ElevationScript, IsSupportedPlatform,
    ProbeAccess } from "../Source/Windows.js";
import { DecodeHandoff, EncodeHandoff, QuoteWindowsArgument, ValidateHandoff } from "../Source/Handoff.js";
import { Effect, Layer } from "effect";
import { Fixture, RequestFor } from "./Fixture.mjs";
import { Permissions, Probes } from "../Source/Contract.js";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { EnvironmentVariable } from "../Source/keys.js";
import type { Request } from "../Source/Contract.js";
import type { Session } from "../Source/Session.js";
import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { tmpdir } from "node:os";
import { win32 } from "node:path";

const Identity: Identity = {
    elevated: false,
    home: "C:\\Users\\Tester",
    name: "Tester",
    sid: "S-1-5-21-123"
};

/**
 * Constructs an absolute Windows request with deliberately awkward invocation paths.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Request = (): Request => ({
    ...RequestFor({ directory: "..\\tools' & $(literal)",
        update: true }),
    account: { environment: { LOCALAPPDATA: "C:\\Users\\Tester\\AppData\\Local",
        NODE_OPTIONS: "--bad-hook",
        PATH: "C:\\original tools",
        SECRET_TOKEN: "do not transfer" },
    home: Identity.home,
    id: Identity.name },
    paths: {
        cli: "C:\\checkout' & $(literal)\\Script\\Setup\\Distribution\\index.js",
        install: "C:\\tools' & $(literal)",
        monorepo: "C:\\checkout' & $(literal)",
        node: "C:\\Program Files\\nodejs\\node.exe",
        originalCwd: "C:\\caller",
        source: "C:\\checkout' & $(literal)\\Package\\Cinnabar"
    }
});

/**
 * Supplies independently injectable token, access and relaunch services without touching the host.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Policy = (denied: boolean = false, identity: Identity = Identity, unsupported: boolean = false) =>
{
    const fixture = Fixture();
    const targets: Array<AccessTarget> = [];
    const children: Array<Request> = [];
    const access = { canonical: (path: string) => Effect.succeed(win32.normalize(path).toLowerCase()),
        probe: (target: AccessTarget) => Effect.sync((): "denied" | "writable" =>
        {
            targets.push(target);
            return denied ? "denied" as const : "writable" as const;
        }) };
    const dependencies = Layer.mergeAll(fixture.layer,
        Layer.succeed(Probes, {
            platform: unsupported ? Effect.fail(new Error("unsupported platform")) : Effect.void,
            source: () => Effect.void
        }),
        Layer.succeed(Access, access),
        Layer.succeed(AccountIdentity, { inspect: Effect.succeed(identity) }),
        Layer.succeed(Elevation, { relaunch: (request: Request) => Effect.sync(() =>
        {
            children.push(request);
            return 37;
        }) }));
    const layer = PermissionLayer.pipe(Layer.provideMerge(dependencies));
    const run = (request: Request = Request()) => Effect.runPromise(Effect.gen(function*()
    {
        return yield* (yield* Permissions).prepare(request);
    }).pipe(Effect.provide(layer)));
    return { ...fixture,
        access,
        children,
        layer,
        run,
        targets };
};

const Lease: Session = { directory: "C:\\Users\\Tester\\AppData\\Local\\Bedform\\Setup\\locks",
    nonce: "12345678-1234-1234-1234-123456789abc",
    pid: process.pid,
    resources: [ Request().paths.source.toLowerCase(), Request().paths.install.toLowerCase() ].sort() };

test("Windows 11 x64 is required; ambiguous and device paths are rejected", () =>
{
    assert.equal(IsSupportedPlatform("win32", "x64", "10.0.26100", "Windows 11 Pro"), true);
    for (const args of [ [ "win32", "arm64", "10.0.26100" ], [ "win32", "x64", "10.0.19045" ],
        [ "linux", "x64", "10.0.26100" ], [ "win32", "x64", "invalid" ],
        [ "win32", "x64", "10.0.26100", "Windows Server 2025" ] ])
    {
        assert.equal(IsSupportedPlatform(args[0], args[1], args[2], args[3] ?? "Windows 11 Pro"), false);
    }

    for (const path of [ "relative", "C:\\bad.", "C:\\bad:stream", "\\\\?\\C:\\device", "C:\\a\0b" ])
    {
        assert.equal(IsAbsolutePath(path), false, path);
    }

    assert.equal(Overlaps("C:\\source", "C:\\source-elsewhere"), false);
    assert.equal(Overlaps("C:\\SOURCE", "c:\\source\\target"), true);
});

test("writable custom install checks build, bundle and staging without prompting or elevation", async () =>
{
    const fixture = Policy();
    const result = await fixture.run();
    assert.equal(result.kind, "ready");
    assert.ok(result.kind === "ready");
    assert.equal(result.environment.PATH, Request().account.environment.PATH);
    assert.equal(result.environment.CARGO_TARGET_DIR, win32.join(Request().paths.source, "target"));
    assert.equal(result.environment.CARGO_BUILD_BUILD_DIR,
        win32.join(Request().paths.source, "target", ".setup-build"));
    assert.equal(fixture.targets.length, 4);
    assert.ok(fixture.targets.some((target: AccessTarget) => target.purpose === "local build cache"));
    assert.ok(fixture.targets.some((target: AccessTarget) => target.purpose === "bundle staging/rollback"));
    assert.deepEqual(fixture.prompts, []);
    assert.deepEqual(fixture.children, []);
});

test("protected paths default to decline, then a consented child retains all parsed selections", async () =>
{
    const fixture = Policy(true);
    await assert.rejects(fixture.run(), /Elevation declined/);
    assert.equal(fixture.children.length, 0);
    fixture.answers.push(true);
    const request = Request();
    const result = await fixture.run(request);
    assert.deepEqual(result, { exitCode: 37,
        kind: "relaunched" });
    assert.ok(fixture.prompts[0].includes(request.paths.install));
    assert.deepEqual(fixture.children[0].paths, request.paths);
    assert.deepEqual(fixture.children[0].options, request.options);
    assert.equal(fixture.children[0].account.id, Identity.sid);
    assert.equal(fixture.children[0].elevated, true);
});

test("different account and denied elevated access fail without prompting or relaunch loops", async () =>
{
    const wrong = Policy(true, { ...Identity,
        name: "Different",
        sid: "S-1-5-21-999" });
    await assert.rejects(wrong.run(), /different account/);
    assert.equal(wrong.targets.length, 0);
    const elevated = Policy(true, { ...Identity,
        elevated: true });
    await assert.rejects(elevated.run(), /still denied while elevated/);
    assert.deepEqual(elevated.prompts, []);
    assert.deepEqual(elevated.children, []);
});

test("source overlap and explicitly selected provisioning collisions fail before access probes", async () =>
{
    for (const install of [ Request().paths.source, "C:\\checkout' & $(literal)",
        win32.join(Request().paths.source, "target", "release") ])
    {
        const fixture = Policy();
        const request = Request();
        await assert.rejects(fixture.run({ ...request,
            paths: { ...request.paths,
                install } }), /overlap/);
        assert.equal(fixture.targets.length, 0);
    }

    const fixture = Policy();
    const request = Request();
    await assert.rejects(fixture.run({ ...request,
        options: { ...request.options,
            bdsDirectory: request.paths.source } }), /Provisioning paths/);
});

test("selected BDS and MCP destinations include existing configuration and backup checks", async () =>
{
    const fixture = Policy();
    const request = Request();
    await fixture.run({ ...request,
        options: { ...request.options,
            bdsDirectory: "D:\\explicit BDS",
            mcpConfig: "D:\\editor\\mcp.json" } });
    assert.equal(fixture.targets.filter((target: AccessTarget) => target.kind === "file").length, 3);
    assert.ok(fixture.targets.some((target: AccessTarget) => target.path.endsWith("permissions.json")));
});

test("data-only handoff preserves awkward paths and flags while excluding secrets and Node hooks", () =>
{
    const base = Request();
    const original = { ...base,
        options: { ...base.options,
            bdsDirectory: "D:\\explicit BDS",
            blender: true,
            blockbench: true,
            core: false,
            mcpConfig: "D:\\editor\\mcp.json" } };
    const request = { ...original,
        account: { ...original.account,
            id: Identity.sid },
        elevated: true };
    const handoff = DecodeHandoff(EncodeHandoff(request, Lease));
    assert.deepEqual(handoff.request.paths, request.paths);
    assert.deepEqual(handoff.request.options, request.options);
    assert.equal(handoff.request.account.environment.PATH, "C:\\original tools");
    assert.equal(handoff.request.account.environment.NODE_OPTIONS, undefined);
    assert.equal(handoff.request.account.environment.SECRET_TOKEN, undefined);
    assert.deepEqual(ValidateHandoff(handoff, { ...Identity,
        elevated: true }, request.paths), handoff.request);
    for (const identity of [ Identity, { ...Identity,
        elevated: true,
        sid: "S-1-5-21-999" } ])
    {
        assert.throws(() => ValidateHandoff(handoff, identity, request.paths), /invoking Windows account/);
    }

    assert.throws(() => ValidateHandoff(handoff, { ...Identity,
        elevated: true },
    { ...request.paths,
        node: "C:\\other\\node.exe" }), /same Node/);
    assert.throws(() => DecodeHandoff("not valid data"), /encoding/);
    assert.throws(() => DecodeHandoff(Buffer.from("{}").toString("base64url")), /envelope/);
    assert.equal(QuoteWindowsArgument("C:\\trailing\\"), "\"C:\\trailing\\\\\"");
    assert.equal(QuoteWindowsArgument("a\"b"), "\"a\\\"b\"");
});

test("UAC transport uses fixed encoded script, visible waited child and cancellation diagnostics", async () =>
{
    const fixture = Fixture();
    const layer = ElevationLayer.pipe(Layer.provide(fixture.layer));
    const request = { ...Request(),
        elevated: true };
    const run = () => Effect.runPromise(Effect.gen(function*()
    {
        return yield* (yield* Elevation).relaunch(request);
    }).pipe(Effect.provideService(ActiveSession, Lease), Effect.provide(layer)));
    fixture.exitCodes.push(37, 1223);
    assert.equal(await run(), 37);
    await assert.rejects(run(), /UAC was canceled/);
    const command = fixture.commands[0];
    assert.ok(win32.isAbsolute(command.executable));
    assert.equal(Buffer.from(command.args.at(-1)!, "base64").toString("utf16le"), ElevationScript);
    const payload = JSON.parse(Buffer.from(command.environment[EnvironmentVariable.Relaunch]!,
        "base64").toString("utf8"));
    assert.equal(payload.node, request.paths.node);
    assert.equal(payload.cwd, request.paths.originalCwd);
    assert.ok(payload.arguments.startsWith(QuoteWindowsArgument(request.paths.cli)));
    assert.ok(ElevationScript.includes("ProcessWindowStyle]::Normal"));
    assert.ok(ElevationScript.includes("$child.WaitForExit()"));
    assert.ok(!ElevationScript.includes(request.paths.cli));
});

test("platform failure prevents all permission probes and consent", async () =>
{
    const fixture = Policy(true, Identity, true);
    await assert.rejects(fixture.run(), /unsupported platform/);
    assert.deepEqual(fixture.targets, []);
    assert.deepEqual(fixture.prompts, []);
});

test("temporary probes leave directories unchanged and never truncate existing files", async () =>
{
    const directory = await mkdtemp(win32.join(tmpdir(), "bedform-permission-"));
    try
    {
        const file = win32.join(directory, "existing.json");
        await writeFile(file, "preserve existing bytes");
        for (const target of [ { kind: "directory" as const,
            path: win32.join(directory, "missing", "install") },
        { kind: "file" as const,
            path: file },
        { kind: "file" as const,
            path: win32.join(directory, "missing", "mcp.json") } ])
        {
            assert.equal(await Effect.runPromise(ProbeAccess({ ...target,
                purpose: "temporary test" })),
            "writable");
        }

        assert.equal(await readFile(file, "utf8"), "preserve existing bytes");
        assert.deepEqual(await readdir(directory), [ "existing.json" ]);
        assert.equal(await Effect.runPromise(CanonicalPath(win32.join(directory, "missing", "install"))),
            win32.join(await realpath(directory), "missing", "install").toLowerCase());
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("exclusive scoped lease rejects duplicates and authenticates borrowed parent ownership", async () =>
{
    const local = await mkdtemp(win32.join(tmpdir(), "bedform-lease-"));
    const request = Request();
    const selected = { ...request,
        account: { ...request.account,
            environment: { LOCALAPPDATA: local } } };
    const layer = SessionLayer.pipe(Layer.provide(Layer.succeed(Access, {
        canonical: (path: string) => Effect.succeed(path.toLowerCase()),
        probe: () => Effect.succeed("writable")
    })));
    try
    {
        await Effect.runPromise(Effect.scoped(Effect.gen(function*()
        {
            const sessions = yield* Sessions;
            const lease = yield* sessions.acquire(selected);
            yield* Effect.promise(() => assert.rejects(
                Effect.runPromise(Effect.scoped(sessions.acquire(selected))), /Another setup/));
            const resumed = yield* sessions.acquire({ ...selected,
                elevated: true }, lease);
            assert.deepEqual(resumed, lease);
            yield* Effect.promise(() => assert.rejects(Effect.runPromise(Effect.scoped(sessions.acquire(
                { ...selected,
                    elevated: true }, { ...lease,
                    nonce: "wrong" }))), /Parent lease/));
        })).pipe(Effect.provide(layer)));
        assert.deepEqual(await readdir(win32.join(local, "Bedform", "Setup", "locks")), []);
    }
    finally
    {
        await rm(local, { force: true,
            recursive: true });
    }
});

test("default protected destination explains its path and does not silently elevate", async () =>
{
    const fixture = Policy(true);
    const request = Request();
    await assert.rejects(fixture.run({ ...request,
        options: { ...request.options,
            directory: undefined },
        paths: { ...request.paths,
            install: "C:\\Program Files\\Bedform\\Cinnabar" }
    }), /Elevation declined/);
    assert.ok(fixture.prompts[0].includes("C:\\Program Files\\Bedform\\Cinnabar"));
    assert.deepEqual(fixture.children, []);
});

test("all owned bundle executables and support files are checked, including Go helpers", async () =>
{
    const fixture = Policy();
    const request = Request();
    const fingerprint = { actual: "a".repeat(64),
        recorded: "a".repeat(64) };
    const files = [ "cinnabar.exe", "cinnabar-mcp.exe", "helpers/core.exe", "assets/runtime.bin" ];
    fixture.verification.value = {
        complete: true,
        files: files.map((path: string) => ({ ...fingerprint,
            path })),
        inputs: fingerprint,
        installDirectory: request.paths.install,
        ownership: fingerprint,
        pins: fingerprint,
        provenance: fingerprint,
        requiredFiles: files,
        sourceDirectory: request.paths.source,
        stages: []
    };
    await fixture.run(request);
    assert.deepEqual(fixture.targets.filter((target: AccessTarget) => target.kind === "file")
        .map((target: AccessTarget) => target.path), files.map((path: string) =>
        win32.resolve(request.paths.install, path)));
    fixture.verification.value = { ...fixture.verification.value,
        files: [ { ...fingerprint,
            path: "../outside.exe" } ] };
    await assert.rejects(fixture.run(request), /escapes/);
});

test("canonical build junction collisions are rejected before write probes", async () =>
{
    const fixture = Fixture();
    let probes = 0;
    const request = Request();
    const dependencies = Layer.mergeAll(fixture.layer,
        Layer.succeed(AccountIdentity, { inspect: Effect.succeed(Identity) }),
        Layer.succeed(Elevation, { relaunch: () => Effect.succeed(0) }),
        Layer.succeed(Access, {
            canonical: (path: string) => Effect.succeed(path.endsWith("target")
                ? request.paths.install.toLowerCase() : path.toLowerCase()),
            probe: () => Effect.sync(() =>
            {
                probes++;
                return "writable" as const;
            })
        }));
    await assert.rejects(Effect.runPromise(Effect.gen(function*()
    {
        return yield* (yield* Permissions).prepare(request);
    }).pipe(Effect.provide(PermissionLayer.pipe(Layer.provide(dependencies))))), /overlap/);
    assert.equal(probes, 0);
});
