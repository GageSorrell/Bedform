/**
 * Startup validation, native identity, concurrent ownership and crash-recovery fixtures.
 *
 * @module bedrock-server-manager/Test/start-ownership.test
 *
 * @file      start-ownership.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as PlatformErrorTypes from "effect/PlatformError";
import { Effect, FileSystem, Path } from "effect";
import {
    type PreparedServer,
    type StartDependencies,
    type StartOptions,
    assertNoDuplicate,
    prepareServer,
    withServerOwnership
} from "../Distribution/start-ownership.js";
import {
    inspectProc,
    inspectProcesses,
    parseCim
} from "../Distribution/process-inspection.js";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import type { ServerOwnership } from "../Distribution/start-ownership.js";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { spawnServer } from "../Distribution/start-process.js";
import test from "node:test";
import { withTransaction } from "../Distribution/transaction.js";
import { writeSetting } from "../Distribution/config.js";

const terminal: { stdin: { isTTY: boolean };
    stdout: { isTTY: boolean } } = {
    stdin: { isTTY: true },
    stdout: { isTTY: true }
};
const dependencies: {
    cliPid: number;
    executableAccess: () => Effect.Effect<void, never, never>;
    inspect: () => Effect.Effect<Array<never>, never, never>;
} = Object.freeze({ cliPid: 1001,
    executableAccess: () => Effect.void,
    inspect: () => Effect.succeed([]) });
const failure: <A, E, R>(
    operation: Effect.Effect<A, E, R>,
    pattern: RegExp
) => Effect.Effect<void, unknown, R> = <A, E, R>(
    operation: Effect.Effect<A, E, R>,
    pattern: RegExp
): Effect.Effect<void, unknown, R> =>
    Effect.gen(function* ()
    {
        const result = yield* Effect.exit(operation);
        assert.equal(result._tag, "Failure");
        assert.match(String(result.cause), pattern);
    });
type OwnershipFixture = {
    readonly binary: string;
    readonly context: RuntimeContext;
    readonly fs: FileSystem.FileSystem;
    readonly metadata: string;
    readonly options: StartOptions;
    readonly own: <A, E, R>(
        work: (ownership: ServerOwnership) => Effect.Effect<A, E, R>,
        injected?: Partial<StartDependencies>
    ) => Effect.Effect<
        A,
        E | Error | PlatformErrorTypes.PlatformError,
        FileSystem.FileSystem | Path.Path | Exclude<R, Scope.Scope>
    >;
    readonly path: Path.Path;
    readonly root: string;
    readonly server: string;
};
const fixture: (
    body: (
        context: OwnershipFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: OwnershipFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-ownership-"
                });
                const server: string = path.join(root, "server space");
                yield* fs.makeDirectory(server);
                const context: {
                    cwd: string;
                    env: { BDS_CONFIG_PATH: string };
                    home: string;
                    platform: NodeJS.Platform;
                } = {
                    cwd: root,
                    env: { BDS_CONFIG_PATH: path.join(root, "settings.json") },
                    home: root,
                    platform: process.platform
                };
                const binary: string = path.join(
                    server,
                    process.platform === "win32" ? "bedrock_server.exe" : "bedrock_server"
                );
                yield* fs.writeFileString(binary, "controlled fixture, never executed", {
                    mode: 0o755
                });
                const metadata: string = path.join(server, ".bedrock-server-manager");
                const options: {
                    server: string;
                    stdin: { isTTY: boolean };
                    stdout: { isTTY: boolean };
                } = { ...terminal,
                    server };
                const own = <A, E, R>(
                    work: (ownership: ServerOwnership) => Effect.Effect<A, E, R>,
                    injected: Partial<StartDependencies> = {}
                ) =>
                    withServerOwnership(context, options, work, {
                        ...dependencies,
                        ...injected
                    });
                yield* body({
                    binary,
                    context,
                    fs,
                    metadata,
                    options,
                    own,
                    path,
                    root,
                    server
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("preflight honors explicit then saved selection, never cwd, and needs no world", () =>
    fixture(({ context, fs, options, root, server }) =>
        Effect.gen(function* ()
        {
            yield* failure(prepareServer(context, terminal), /No server selected.*--server/);
            yield* writeSetting(context, "server.path", server);
            assert.equal((yield* prepareServer(context, terminal)).directory, server);
            const explicit: PreparedServer = yield* prepareServer(context, options);
            assert.equal(explicit.directory, server);
            assert.equal(yield* fs.exists(`${server}/worlds`), false);
            yield* fs.writeFileString(`${root}/settings.json`, "broken");
            assert.equal((yield* prepareServer(context, options)).directory, server);
            yield* failure(
                prepareServer(context, { ...terminal,
                    server: "missing" }),
                /Cannot access directory/
            );
        })
    ));

test("platform and terminal failures precede locks, process inspection and launch", () =>
    fixture(({ context, fs, metadata, options }) =>
        Effect.gen(function* ()
        {
            for (const platform of [ "darwin", "aix" ])
            {
                yield* failure(
                    prepareServer({ ...context,
                        platform }, options),
                    /Windows and Linux/
                );
            }

            for (const optionsWithoutTty of [
                { ...options,
                    stdin: {} },
                { ...options,
                    stdout: { isTTY: false } }
            ])
            {
                yield* failure(
                    withServerOwnership(
                        context,
                        optionsWithoutTty,
                        () => Effect.die("must not launch"),
                        { inspect: () => Effect.die("must not inspect") }
                    ),
                    /interactive stdin and stdout/
                );
            }

            assert.equal(yield* fs.exists(metadata), false);
        })
    ));

test("missing binaries, directories and Linux execution permissions fail preflight", () =>
    fixture(({ binary, context, fs, options, path, server }) =>
        Effect.gen(function* ()
        {
            yield* fs.remove(binary);
            yield* failure(
                prepareServer(context, options),
                /Cannot access native BDS executable/
            );
            yield* fs.makeDirectory(binary);
            yield* failure(prepareServer(context, options), /executable file/);
            const linux: RuntimeContext = { ...context,
                platform: "linux" };
            const linuxBinary: string = path.join(server, "bedrock_server");
            const fakeFs: FileSystem.FileSystem = {
                ...fs,
                realPath: (file: string) =>
                    file === linuxBinary ? Effect.succeed(file) : fs.realPath(file),
                stat: (file: string) =>
                    file === linuxBinary
                        ? fs.stat(server).pipe(
                            Effect.map((info: FileSystem.File.Info) => ({
                                ...info,
                                mode: 0o644,
                                type: "File" as const
                            }))
                        )
                        : fs.stat(file)
            };
            yield* failure(
                prepareServer(linux, options, dependencies).pipe(
                    Effect.provideService(FileSystem.FileSystem, fakeFs)
                ),
                /not executable/
            );
            const executableFs: FileSystem.FileSystem = {
                ...fakeFs,
                stat: (file: string) =>
                    file === linuxBinary
                        ? fs.stat(server).pipe(
                            Effect.map((info: FileSystem.File.Info) => ({
                                ...info,
                                mode: 0o755,
                                type: "File" as const
                            }))
                        )
                        : fs.stat(file)
            };
            yield* failure(
                prepareServer(linux, options, {
                    executableAccess: () => Effect.fail("ACL denied")
                }).pipe(Effect.provideService(FileSystem.FileSystem, executableFs)),
                /not executable.*ACL denied/
            );
            assert.equal(
                (yield* prepareServer(linux, options, dependencies).pipe(
                    Effect.provideService(FileSystem.FileSystem, executableFs)
                )).executable,
                linuxBinary
            );
        })
    ));

test("canonical directory aliases resolve before acquiring shared ownership", () =>
    fixture(({ context, fs, metadata, options, own, path, root, server }) =>
        Effect.gen(function* ()
        {
            const alias: string = path.join(root, "alias");
            const aliasedFs: FileSystem.FileSystem = {
                ...fs,
                realPath: (file: string) =>
                    file === alias ? Effect.succeed(server) : fs.realPath(file),
                stat: (file: string) => (file === alias ? fs.stat(server) : fs.stat(file))
            };
            yield* own(() =>
                failure(
                    withServerOwnership(
                        context,
                        { ...options,
                            server: alias },
                        () => Effect.die("duplicate"),
                        dependencies
                    ).pipe(Effect.provideService(FileSystem.FileSystem, aliasedFs)),
                    /mutation lock/
                )
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("external matching and unidentifiable BDS processes block the session before spawn", () =>
    fixture(({ binary, fs, metadata, own, path, root }) =>
        Effect.gen(function* ()
        {
            for (const executable of [
                binary,
                null,
                path.join(root, "missing", path.basename(binary))
            ])
            {
                yield* failure(
                    own(() => Effect.die("must not launch"), {
                        inspect: () =>
                            Effect.succeed([
                                { executable,
                                    name: path.basename(binary),
                                    pid: 2002 }
                            ])
                    }),
                    /already running|Cannot determine BDS executable identity/
                );
                assert.deepEqual(yield* fs.readDirectory(metadata), []);
            }

            yield* failure(
                own(() => Effect.die("must not launch"), {
                    inspect: () => Effect.fail(new Error("CIM unavailable"))
                }),
                /Cannot safely inspect.*CIM unavailable/
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("path canonicalization and Windows casing detect renamed aliases but allow another instance", () =>
{
    const paths: Map<string, string> = new Map([
        [ "C:\\ALIAS\\bds.exe", "c:\\Servers\\One\\BEDROCK_SERVER.EXE" ],
        [ "C:\\Servers\\Two\\bedrock_server.exe", "C:\\Servers\\Two\\bedrock_server.exe" ]
    ]);
    const server: PreparedServer = {
        directory: "C:\\Servers\\One",
        env: process.env,
        executable: "C:\\Servers\\One\\bedrock_server.exe",
        platform: "win32"
    };
    return Effect.runPromise(
        Effect.gen(function* ()
        {
            const baseFs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
            const fs: FileSystem.FileSystem = {
                ...baseFs,
                realPath: (file: string) => Effect.succeed(paths.get(file) ?? file)
            };
            yield* failure(
                assertNoDuplicate(server, [
                    { executable: "C:\\ALIAS\\bds.exe",
                        name: "renamed.exe",
                        pid: 9 }
                ]).pipe(Effect.provideService(FileSystem.FileSystem, fs)),
                /already running.*PID 9/
            );
            yield* assertNoDuplicate(server, [
                {
                    executable: "C:\\Servers\\Two\\bedrock_server.exe",
                    name: "bedrock_server.exe",
                    pid: 8
                },
                { executable: null,
                    name: "unrelated.exe",
                    pid: 7 }
            ]).pipe(Effect.provideService(FileSystem.FileSystem, fs));
        }).pipe(Effect.provide(NodeServices.layer))
    );
});

test("session records both PIDs and blocks addon transactions until confirmed child close", () =>
    fixture(({ binary, fs, metadata, own, path, server }) =>
        Effect.gen(function* ()
        {
            yield* own((ownership: ServerOwnership) =>
                Effect.gen(function* ()
                {
                    yield* ownership.recordChild(3003);
                    for (const name of [ "runtime.lock", "mutation.lock" ])
                    {
                        const owner = JSON.parse(
                            yield* fs.readFileString(path.join(metadata, name, "owner.json"))
                        );
                        assert.equal(owner.cliPid, 1001);
                        assert.equal(owner.serverPid, 3003);
                        assert.equal(owner.executable, binary);
                        assert.equal(owner.server, server);
                        assert.equal(typeof owner.token, "string");
                    }

                    yield* failure(
                        withTransaction(server, () => Effect.die("must not mutate")),
                        /mutation lock/
                    );
                    yield* failure(
                        ownership.recordChild(4004),
                        /one valid spawned server PID/
                    );
                    yield* ownership.childClosed();
                })
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
            yield* withTransaction(server, () => Effect.void);
        })
    ));

test("active addon transactions and pre-existing runtime recovery locks are never reclaimed", () =>
    fixture(({ fs, metadata, own, path, server }) =>
        Effect.gen(function* ()
        {
            yield* withTransaction(server, () =>
                failure(
                    own(() => Effect.die("must not launch")),
                    /mutation lock/
                )
            );
            const leftover: string = path.join(metadata, "runtime.lock");
            yield* fs.makeDirectory(leftover);
            yield* fs.writeFileString(
                path.join(leftover, "owner.json"),
                "uncertain crash record"
            );
            yield* failure(
                own(() => Effect.die("must not launch")),
                /runtime lock.*Confirm both recorded CLI/
            );
            assert.equal(
                yield* fs.readFileString(path.join(leftover, "owner.json")),
                "uncertain crash record"
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), [ "runtime.lock" ]);
        })
    ));

test("synchronous and asynchronous spawn failures clean owned locks before any child exists", () =>
    fixture(({ fs, metadata, own }) =>
        Effect.gen(function* ()
        {
            yield* failure(
                own(({ launch }) =>
                    Effect.try(() =>
                        spawnServer(launch, () =>
                        {
                            throw new Error("controlled spawn failure");
                        })
                    )
                ),
                /controlled spawn failure/
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
            yield* failure(
                own(() =>
                    Effect.tryPromise(async () =>
                    {
                        throw new Error("spawn error event");
                    })
                ),
                /spawn error event/
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("unconfirmed child lifetimes retain both lock records with actionable recovery", () =>
    fixture(({ fs, metadata, own, path, server }) =>
        Effect.gen(function* ()
        {
            yield* failure(
                own((owner: ServerOwnership) => owner.recordChild(3003)),
                /shutdown is unconfirmed.*Confirm both recorded/
            );
            const record: string = path.join(metadata, "runtime.lock", "owner.json");
            const original: string = yield* fs.readFileString(record);
            assert.equal(JSON.parse(original).serverPid, 3003);
            yield* failure(
                own(() => Effect.void),
                /mutation lock/
            );
            yield* failure(
                withTransaction(server, () => Effect.void),
                /mutation lock/
            );
            assert.equal(yield* fs.readFileString(record), original);
        })
    ));

test("cleanup never removes another owner's replacement lock", () =>
    fixture(({ fs, metadata, own, path }) =>
        Effect.gen(function* ()
        {
            const ownerFile: string = path.join(metadata, "runtime.lock", "owner.json");
            yield* failure(
                own(() =>
                    fs.writeFileString(
                        ownerFile,
                        JSON.stringify({ token: "foreign-session" })
                    )
                ),
                /ownership changed.*retained/
            );
            assert.equal(
                JSON.parse(yield* fs.readFileString(ownerFile)).token,
                "foreign-session"
            );
        })
    ));

test("simultaneous independent CLI processes cannot both acquire one instance", () =>
    fixture(({ fs, metadata, path, server }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./ownership-process.mts", import.meta.url)
            );
            const start = () =>
            {
                const child = spawn(
                    process.execPath,
                    [ "--import", import.meta.resolve("tsx"), script, server ],
                    { stdio: "pipe" }
                );
                let stdout: string = "";
                let stderr: string = "";
                const started: Promise<unknown> = new Promise(
                    (resolve: (value: unknown) => void, reject) =>
                    {
                        child.on("error", reject);
                        child.stdout.on("data", (chunk) =>
                        {
                            stdout += chunk;
                            if (stdout.includes("READY"))
                            {
                                resolve(true);
                            }
                        });
                        child.on("close", () => resolve(false));
                    }
                );
                child.stderr.on("data", (chunk) =>
                {
                    stderr += chunk;
                });
                const closed: Promise<{ code: number | null;
                    stderr: string }> = new Promise<{
                    code: number | null;
                    stderr: string;
                }>(
                    (
                        resolve: (
                            value:
                                | { code: number | null;
                                    stderr: string }
                                | PromiseLike<{ code: number | null;
                                    stderr: string }>
                        ) => void
                    ) => child.on("close", (code: number | null) => resolve({ code,
                        stderr }))
                );
                return { child,
                    closed,
                    started };
            };

            yield* Effect.promise(async () =>
            {
                const children = [ start(), start() ];
                try
                {
                    const results: Array<unknown> = await Promise.all(
                        children.map((child) => child.started)
                    );
                    assert.equal(results.filter(Boolean).length, 1);
                    const winner = children[results.indexOf(true)];
                    const loser = children[results.indexOf(false)];
                    assert.match((await loser.closed).stderr, /mutation lock/);
                    winner.child.stdin.end("release\n");
                    assert.equal((await winner.closed).code, 0);
                }
                finally
                {
                    for (const child of children)
                    {
                        child.child.stdin.end();
                        if (child.child.exitCode === null)
                        {
                            child.child.kill();
                        }
                    }

                    await Promise.all(children.map((child) => child.closed));
                }
            });
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("CIM output validates complete identities and preserves inaccessible executable paths", () =>
{
    assert.deepEqual(
        parseCim("[{\"ProcessId\":42,\"Name\":\"bedrock_server.exe\",\"ExecutablePath\":null}]"),
        [ { executable: null,
            name: "bedrock_server.exe",
            pid: 42 } ]
    );
    assert.deepEqual(parseCim("[]"), []);
    for (const text of [
        "",
        "{}",
        "null",
        "[{\"ProcessId\":42}]",
        "[{\"ProcessId\":-1,\"Name\":\"x\"}]"
    ])
    {
        assert.throws(() => parseCim(text));
    }
});

test("procfs reads executable links, classifies inaccessible BDS, and tolerates exited processes", async () =>
{
    const reader: {
        exists: (directory: string) => Promise<boolean>;
        link: (file: string | Array<string>) => Promise<string>;
        list: () => Promise<Array<string>>;
        text: (file: string | Array<string>) => Promise<"bedrock_server\n" | "unrelated\n">;
    } = {
        exists: async (directory: string) => !directory.endsWith("4"),
        link: async (file: string | Array<string>) =>
        {
            if (file.includes(`${process.platform === "win32" ? "\\" : "/"}1`))
            {
                return "/server/bedrock_server";
            }

            throw new Error("denied or exited");
        },
        list: async () => [ "self", "1", "2", "3", "4" ],
        text: async (file: string | Array<string>) =>
            file.includes("2") ? "bedrock_server\n" : "unrelated\n"
    };
    assert.deepEqual(await inspectProc(reader), [
        { executable: "/server/bedrock_server",
            name: "",
            pid: 1 },
        { executable: null,
            name: "bedrock_server",
            pid: 2 },
        { executable: null,
            name: "unrelated",
            pid: 3 }
    ]);
    await assert.rejects(
        inspectProc({
            ...reader,
            text: async () =>
            {
                throw new Error("denied");
            }
        }),
        /Cannot determine process identity/
    );
    await assert.rejects(
        inspectProc({
            ...reader,
            list: async () =>
            {
                throw new Error("proc unavailable");
            }
        }),
        /proc unavailable/
    );
});

test("native host process inspection locates this test process without launching BDS", async () =>
{
    assert.ok(process.platform === "win32" || process.platform === "linux");
    const processes = await inspectProcesses(process.platform);
    const self = processes.find((identity: { pid: number }) => identity.pid === process.pid);
    assert.ok(self);
    assert.equal(typeof self.executable, "string");
});

test("abrupt CLI death leaves both ownership records intact and blocks recovery launches", () =>
    fixture(({ fs, metadata, own, path, server }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./ownership-process.mts", import.meta.url)
            );
            yield* Effect.promise(async () =>
            {
                const child = spawn(
                    process.execPath,
                    [ "--import", import.meta.resolve("tsx"), script, server ],
                    { stdio: "pipe" }
                );
                const closed: Promise<unknown> = new Promise(
                    (resolve: (value: unknown) => void) => child.on("close", resolve)
                );
                try
                {
                    await new Promise<void>(
                        (resolve: (value: void | PromiseLike<void>) => void, reject) =>
                        {
                            let stdout: string = "";
                            child.on("error", reject);
                            child.on("close", () =>
                                reject(new Error("Fixture exited before ownership"))
                            );
                            child.stderr.resume();
                            child.stdout.on("data", (chunk) =>
                            {
                                stdout += chunk;
                                if (stdout.includes("READY"))
                                {
                                    resolve();
                                }
                            });
                        }
                    );
                }
                finally
                {
                    child.kill("SIGKILL");
                    await closed;
                }
            });
            const record: string = path.join(metadata, "runtime.lock", "owner.json");
            const original: string = yield* fs.readFileString(record);
            assert.ok(JSON.parse(original).serverPid > 0);
            yield* failure(
                own(() => Effect.void),
                /mutation lock.*Confirm both recorded/
            );
            assert.equal(yield* fs.readFileString(record), original);
            assert.deepEqual((yield* fs.readDirectory(metadata)).sort(), [
                "mutation.lock",
                "runtime.lock"
            ]);
        })
    ));
