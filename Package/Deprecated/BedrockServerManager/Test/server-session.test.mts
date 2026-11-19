/**
 * Foreground output, command transport and ownership/lifecycle supervision fixtures.
 *
 * @module bedrock-server-manager/Test/server-session.test
 *
 * @file      server-session.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, Fiber, FileSystem, Path } from "effect";
import { PassThrough, Writable } from "node:stream";
import { type ServerOutput, createOutputDecoder } from "../Distribution/server-output.js";
import { type StartOptions, withServerOwnership } from "../Distribution/start-ownership.js";
import { createServerSession, normalizeCommand } from "../Distribution/server-session.js";
import { superviseServer, watchServerSession } from "../Distribution/supervised-server.js";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import type { ServerLaunch } from "../Distribution/start-process.js";
import type { ServerOwnership } from "../Distribution/start-ownership.js";
import { TextEncoder } from "node:util";
import assert from "node:assert/strict";
import { setImmediate as settle } from "node:timers/promises";
import { spawn } from "node:child_process";
import test from "node:test";
import { Option } from "effect";

const launch: ServerLaunch = {
    directory: "/fixture/server",
    env: { ...process.env },
    platform: "linux"
};
type ControlledChild = EventEmitter & {
    pid: number;
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: Writable;
    kill: (signal?: NodeJS.Signals | null) => boolean;
};
const controlled = ({
    hold = false,
    onOutput,
    onKill
}: {
    hold?: boolean;
    onOutput?: (line: ServerOutput) => void;
    onKill?: (signal: NodeJS.Signals | null | undefined) => void;
} = {}) =>
{
    const child: ControlledChild = new EventEmitter() as ControlledChild;
    const writes: Array<string> = [];
    const callbacks: Array<(error?: Error | null) => void> = [];
    const kills: Array<NodeJS.Signals | null | undefined> = [];
    child.pid = 1234;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new Writable({
        highWaterMark: hold ? 1 : 16384,
        write(chunk, encoding: BufferEncoding, callback: (error?: Error | null) => void)
        {
            writes.push(chunk.toString());
            if (hold)
            {
                callbacks.push(callback);
            }
            else
            {
                callback();
            }
        }
    });
    child.kill = (signal: NodeJS.Signals | null | undefined) =>
    {
        kills.push(signal);
        onKill?.(signal);
        return true;
    };

    const session = createServerSession(launch, {
        onOutput,
        spawn: () => child as unknown as ChildProcessWithoutNullStreams
    });
    child.emit("spawn");
    const close: (code?: number | null, signal?: NodeJS.Signals | null) => void = (
        code: number | null = 0,
        signal: NodeJS.Signals | null = null
    ) =>
    {
        child.stdout.end();
        child.stderr.end();
        child.emit("close", code, signal);
    };

    return { callbacks,
        child,
        close,
        kills,
        session,
        writes };
};

test("incremental decoding preserves UTF-8, empty lines, split CRLF and unfinished tails", () =>
{
    const lines: Array<ServerOutput> = [];
    const decoder: { end: () => void;
        write: (bytes: Buffer) => void } = createOutputDecoder(
        "stdout",
        (line: ServerOutput) => lines.push(line)
    );
    const bytes: Uint8Array = new TextEncoder().encode("one 🧱\r\n\nlast é");
    for (const byte of bytes)
    {
        decoder.write(Buffer.from([ byte ]));
    }

    decoder.end();
    decoder.end();
    assert.deepEqual(lines, [
        { stream: "stdout",
            terminated: true,
            text: "one 🧱" },
        { stream: "stdout",
            terminated: true,
            text: "" },
        { stream: "stdout",
            terminated: false,
            text: "last é" }
    ]);
    const incomplete: { end: () => void;
        write: (bytes: Buffer) => void } =
        createOutputDecoder("stderr", (line: ServerOutput) => lines.push(line));
    incomplete.write(Buffer.from([ 0xe2, 0x82 ]));
    incomplete.end();
    assert.equal(lines.at(-1)?.text, "�");
});

test("normalization removes one slash, ignores empty input and preserves argument contents", () =>
{
    assert.equal(
        normalizeCommand("  /say  \"quoted  argument\"  @a  "),
        "say  \"quoted  argument\"  @a"
    );
    assert.equal(normalizeCommand("\n /stop \r\n"), "stop");
    assert.equal(normalizeCommand(" //stop "), "/stop");
    for (const input of [ "", " \t\r\n", " / " ])
    {
        assert.equal(normalizeCommand(input), "");
    }

    for (const input of [ "say x\nstop", "say x\rstop", "say\0x" ])
    {
        assert.throws(() => normalizeCommand(input), /one console command/);
    }
});

test("stdout and stderr retain per-stream order through exit until close", async () =>
{
    const output: Array<ServerOutput> = [];
    const fixture = controlled({ onOutput: (line: ServerOutput) => output.push(line) });
    let completed: boolean = false;
    void fixture.session.completion.then(() =>
    {
        completed = true;
    });
    fixture.child.stdout.write("first\npart");
    fixture.child.stderr.write("error\nerr-tail");
    fixture.child.emit("exit", 0, null);
    await settle();
    assert.equal(completed, false);
    fixture.child.stdout.write("ial\nfinal");
    fixture.close();
    const result = await fixture.session.completion;
    assert.deepEqual(
        output
            .filter((line: ServerOutput) => line.stream === "stdout")
            .map((line: ServerOutput) => line.text),
        [ "first", "partial", "final" ]
    );
    assert.deepEqual(
        output
            .filter((line: ServerOutput) => line.stream === "stderr")
            .map((line: ServerOutput) => line.text),
        [ "error", "err-tail" ]
    );
    assert.equal(result.exitCode, 0);
    assert.equal(fixture.child.listenerCount("close"), 0);
    assert.equal(fixture.child.stdout.listenerCount("data"), 0);
});

test("command bytes are serialized, empty input is ignored, and stop drains final output", async () =>
{
    const output: Array<string> = [];
    const fixture = controlled({
        onOutput: (line: ServerOutput) => output.push(line.text)
    });
    assert.equal(await fixture.session.submit(" / "), false);
    await Promise.all([
        fixture.session.submit(" /say  \"hello  world\" @a "),
        fixture.session.submit("unknown-command untouched"),
        fixture.session.submit(" /stop ")
    ]);
    assert.deepEqual(fixture.writes, [
        "say  \"hello  world\" @a\n",
        "unknown-command untouched\n",
        "stop\n"
    ]);
    await assert.rejects(fixture.session.submit("list"), /stopping or closed/);
    let complete: boolean = false;
    void fixture.session.completion.then(() =>
    {
        complete = true;
    });
    await settle();
    assert.equal(complete, false);
    fixture.child.stdout.write("saved\nlast output");
    fixture.close();
    assert.equal((await fixture.session.completion).reason, "stop");
    assert.deepEqual(output, [ "saved", "last output" ]);
    assert.deepEqual(fixture.kills, []);
});

test("backpressure delays both acknowledgement and later writes until callbacks and drain", async () =>
{
    const fixture = controlled({ hold: true });
    let firstDone: boolean = false;
    const first: Promise<void> = fixture.session.submit("list").then(() =>
    {
        firstDone = true;
    });
    const second: Promise<boolean> = fixture.session.submit("stop");
    await settle();
    assert.deepEqual(fixture.writes, [ "list\n" ]);
    assert.equal(firstDone, false);
    fixture.callbacks.shift()!();
    await first;
    await settle();
    assert.deepEqual(fixture.writes, [ "list\n", "stop\n" ]);
    fixture.callbacks.shift()!();
    await second;
    fixture.close();
    assert.equal((await fixture.session.completion).exitCode, 0);
    assert.equal(fixture.child.stdin.listenerCount("drain"), 0);
});

test("closing during backpressure settles all queued submissions without hanging", async () =>
{
    const fixture = controlled({ hold: true });
    const commands: Array<Promise<boolean>> = [
        fixture.session.submit("list"),
        fixture.session.submit("say next")
    ];
    const settled: Promise<Array<PromiseSettledResult<boolean>>> =
        Promise.allSettled(commands);
    await settle();
    fixture.close(9);
    assert.deepEqual(
        (await settled).map((result: PromiseSettledResult<boolean>) => result.status),
        [ "rejected", "rejected" ]
    );
    assert.equal((await fixture.session.completion).exitCode, 9);
    assert.deepEqual(fixture.writes, [ "list\n" ]);
});

test("write errors reject callers and fall back to a single termination signal", async () =>
{
    const fixture = controlled({ hold: true });
    const submission: Promise<boolean> = fixture.session.submit("list");
    const rejected: Promise<void> = assert.rejects(submission, /controlled EPIPE/);
    await settle();
    fixture.callbacks.shift()!(new Error("controlled EPIPE"));
    await rejected;
    await settle();
    assert.deepEqual(fixture.kills, [ "SIGTERM" ]);
    fixture.close(null, "SIGTERM");
    const result = await fixture.session.completion;
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /controlled EPIPE/);
});

test("a synchronous stdin write throw is supervised and reported", async () =>
{
    const fixture = controlled();
    fixture.child.stdin.write = () =>
    {
        throw new Error("synchronous write failure");
    };

    await assert.rejects(fixture.session.submit("list"), /synchronous write failure/);
    assert.deepEqual(fixture.kills, [ "SIGTERM" ]);
    fixture.close(null, "SIGTERM");
    assert.match((await fixture.session.completion).summary, /synchronous write failure/);
});

test("a zero-code close cannot hide an unacknowledged write failure", async () =>
{
    const fixture = controlled({ hold: true });
    const rejected: Promise<void> = assert.rejects(
        fixture.session.submit("list"),
        /channel closed/
    );
    await settle();
    fixture.close();
    await rejected;
    const result = await fixture.session.completion;
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /before acknowledging/);
});

test("stdin closing after exit does not signal an exited child or discard late output", async () =>
{
    const lines: Array<string> = [];
    const fixture = controlled({ onOutput: (line: ServerOutput) => lines.push(line.text) });
    fixture.child.emit("exit", 0, null);
    fixture.child.stdin.emit("close");
    fixture.child.stdout.write("late tail");
    await settle();
    assert.deepEqual(fixture.writes, []);
    assert.deepEqual(fixture.kills, []);
    fixture.close();
    assert.equal((await fixture.session.completion).exitCode, 0);
    assert.deepEqual(lines, [ "late tail" ]);
});

test("unexpected stdin loss falls back to termination and still waits for close", async () =>
{
    const fixture = controlled();
    fixture.child.stdin.destroy();
    await settle();
    await settle();
    assert.deepEqual(fixture.kills, [ "SIGTERM" ]);
    let closed: boolean = false;
    void fixture.session.completion.then(() =>
    {
        closed = true;
    });
    await settle();
    assert.equal(closed, false);
    fixture.close(null, "SIGTERM");
    assert.equal((await fixture.session.completion).exitCode, 1);
});

test("output stream errors request stop and report failure after final close", async () =>
{
    const fixture = controlled();
    fixture.child.stderr.emit("error", new Error("controlled read failure"));
    await settle();
    assert.deepEqual(fixture.writes, [ "stop\n" ]);
    fixture.close();
    const result = await fixture.session.completion;
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /controlled read failure/);
});

test("asynchronous spawn errors settle startup and failure status on close", async () =>
{
    const child: ControlledChild = new EventEmitter() as ControlledChild;
    Object.assign(child, {
        stderr: new PassThrough(),
        stdin: new PassThrough(),
        stdout: new PassThrough()
    });
    const session = createServerSession(launch, {
        spawn: () => child as unknown as ChildProcessWithoutNullStreams
    });
    child.emit("error", new Error("controlled ENOENT"));
    assert.ok(Option.isNone(await session.started));
    child.emit("close", -2, null);
    const result = await session.completion;
    assert.equal(result.exitCode, 1);
    assert.equal(result.reason, "spawn-error");
    assert.match(result.summary, /controlled ENOENT/);
});

test("nonzero and signal exits propagate failure while preserving the final stderr tail", async () =>
{
    const exits: Array<[number | null, NodeJS.Signals | null, number]> = [
        [ 7, null, 7 ],
        [ null, "SIGTERM", 1 ]
    ];
    for (const [ code, signal, expected ] of exits)
    {
        const lines: Array<ServerOutput> = [];
        const fixture = controlled({ onOutput: (line: ServerOutput) => lines.push(line) });
        fixture.child.stderr.write("last failure");
        fixture.close(code, signal);
        const result = await fixture.session.completion;
        assert.equal(result.exitCode, expected);
        assert.equal(lines.at(-1)?.text, "last failure");
        assert.match(result.summary, /BDS closed/);
    }
});

test("terminal loss and external signals request one stop and detach lifecycle listeners", async () =>
{
    for (const event of [ "end", "close", "error", "SIGTERM", "SIGHUP" ])
    {
        const fixture = controlled();
        const input = new EventEmitter();
        const output = new EventEmitter();
        const signals = new EventEmitter();
        watchServerSession(fixture.session, { input,
            output,
            signals });
        if (event.startsWith("SIG"))
        {
            signals.emit(event);
            signals.emit(event);
        }
        else
        {
            input.emit(event, new Error("terminal lost"));
            output.emit("close");
        }

        await settle();
        assert.deepEqual(fixture.writes, [ "stop\n" ]);
        assert.deepEqual(fixture.kills, []);
        fixture.child.stdout.write("saved");
        fixture.close();
        const result = await fixture.session.completion;
        assert.equal(result.exitCode, 1);
        assert.equal(result.reason, event.startsWith("SIG") ? event : "terminal-loss");
        assert.equal(input.listenerCount("close"), 0);
        assert.equal(signals.listenerCount("SIGTERM"), 0);
    }
});

test("output observer failures request shutdown but cannot orphan the child", async () =>
{
    const fixture = controlled({
        onOutput: () =>
        {
            throw new Error("observer failed");
        }
    });
    fixture.child.stdout.write("output\n");
    await settle();
    assert.deepEqual(fixture.writes, [ "stop\n" ]);
    fixture.child.stdout.write("still draining");
    fixture.close();
    assert.match((await fixture.session.completion).summary, /observer failed/);
});

test("an observer failure while flushing the close tail is reported in final status", async () =>
{
    const fixture = controlled({
        onOutput: () =>
        {
            throw new Error("tail observer failed");
        }
    });
    fixture.child.stdout.write("unterminated tail");
    fixture.close();
    const result = await fixture.session.completion;
    assert.equal(result.exitCode, 1);
    assert.match(result.summary, /tail observer failed/);
});

type OwnedFixture = {
    readonly fs: FileSystem.FileSystem;
    readonly metadata: string;
    readonly path: Path.Path;
    readonly root: string;
    readonly run: <A, E, R>(
        work: (ownership: ServerOwnership) => Effect.Effect<A, E, R>
    ) => Effect.Effect<A, E | unknown, R | FileSystem.FileSystem | Path.Path | Scope.Scope>;
};
const ownedFixture: (
    body: (
        context: OwnedFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: OwnedFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-supervisor-"
                });
                const binary: string = path.join(
                    root,
                    process.platform === "win32" ? "bedrock_server.exe" : "bedrock_server"
                );
                yield* fs.writeFileString(binary, "controlled fixture, never executed", {
                    mode: 0o755
                });
                const context: RuntimeContext = {
                    cwd: root,
                    env: process.env,
                    home: root,
                    platform: process.platform
                };
                const options: {
                    server: string;
                    stdin: { isTTY: boolean };
                    stdout: { isTTY: boolean };
                } = {
                    server: root,
                    stdin: { isTTY: true },
                    stdout: { isTTY: true }
                };
                const metadata: string = path.join(root, ".bedrock-server-manager");
                const run = <A, E, R>(
                    work: (ownership: ServerOwnership) => Effect.Effect<A, E, R>
                ) =>
                    withServerOwnership(context, options as StartOptions, work, {
                        inspect: () => Effect.succeed([])
                    });
                yield* body({ fs,
                    metadata,
                    path,
                    root,
                    run });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("real child supervision holds ownership through final output then releases locks", () =>
    ownedFixture(({ fs, metadata, path, run }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./server-child.mts", import.meta.url)
            );
            const lines: Array<ServerOutput> = [];
            const result = yield* run((owner: ServerOwnership) =>
                superviseServer(owner, {
                    lifecycle: { signals: new EventEmitter() },
                    onOutput: (line: ServerOutput) => lines.push(line),
                    onSession: (session) =>
                    {
                        void session
                            .submit(" /say  \"two  spaces\" ")
                            .then(() => session.submit("/stop"));
                    },
                    spawn: (
                        _file: string,
                        _args: Array<string>,
                        options: {
                            cwd: string;
                            env: NodeJS.ProcessEnv;
                            shell: false;
                            stdio: "pipe";
                        }
                    ) =>
                        spawn(
                            process.execPath,
                            [ "--import", import.meta.resolve("tsx"), script ],
                            options
                        )
                })
            );
            assert.equal(result.exitCode, 0);
            assert.equal(result.reason, "stop");
            assert.ok(lines.some((line: ServerOutput) => line.text === "ready 🧱"));
            assert.ok(
                lines.some(
                    (line: ServerOutput) => line.text === JSON.stringify("say  \"two  spaces\"")
                )
            );
            assert.ok(
                lines.some(
                    (line: ServerOutput) =>
                        line.text === "final stdout 🧱" && !line.terminated
                )
            );
            assert.ok(
                lines.some(
                    (line: ServerOutput) =>
                        line.text === "final stderr tail" && !line.terminated
                )
            );
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("synchronous spawn failure and asynchronous spawn failure both release ownership", () =>
    ownedFixture(({ fs, metadata, run }) =>
        Effect.gen(function* ()
        {
            const thrown = yield* Effect.exit(
                run((owner: ServerOwnership) =>
                    superviseServer(owner, {
                        spawn: () =>
                        {
                            throw new Error("controlled synchronous spawn failure");
                        }
                    })
                )
            );
            assert.equal(thrown._tag, "Failure");
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
            const result = yield* run((owner: ServerOwnership) =>
                superviseServer(owner, {
                    lifecycle: { signals: new EventEmitter() },
                    spawn: () =>
                        spawn(process.execPath + ".missing", [], {
                            stdio: "pipe"
                        })
                })
            );
            assert.equal(result.reason, "spawn-error");
            assert.equal(result.exitCode, 1);
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("unexpected real child failure propagates its code and releases ownership", () =>
    ownedFixture(({ fs, metadata, path, run }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./server-child.mts", import.meta.url)
            );
            const lines: Array<string> = [];
            const result = yield* run((owner: ServerOwnership) =>
                superviseServer(owner, {
                    lifecycle: { signals: new EventEmitter() },
                    onOutput: (line: { text: string }) => lines.push(line.text),
                    spawn: (
                        _file: string,
                        _args: Array<string>,
                        options: {
                            cwd: string;
                            env: NodeJS.ProcessEnv;
                            shell: false;
                            stdio: "pipe";
                        }
                    ) =>
                        spawn(
                            process.execPath,
                            [ "--import", import.meta.resolve("tsx"), script ],
                            {
                                ...options,
                                env: {
                                    ...options.env,
                                    BDS_FIXTURE_MODE: "failure"
                                }
                            }
                        )
                })
            );
            assert.equal(result.exitCode, 7);
            assert.ok(lines.includes("controlled failure tail"));
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("PID recording failure closes the spawned child before ownership is released", () =>
    ownedFixture(({ fs, metadata, path, run }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./server-child.mts", import.meta.url)
            );
            const result = yield* Effect.exit(
                run((owner: ServerOwnership) =>
                    superviseServer(
                        {
                            ...owner,
                            recordChild: () => Effect.fail(new Error("PID recording failure"))
                        },
                        {
                            lifecycle: { signals: new EventEmitter() },
                            spawn: (
                                _file: string,
                                _args: Array<string>,
                                options: {
                                    cwd: string;
                                    env: NodeJS.ProcessEnv;
                                    shell: false;
                                    stdio: "pipe";
                                }
                            ) =>
                                spawn(
                                    process.execPath,
                                    [ "--import", import.meta.resolve("tsx"), script ],
                                    options
                                )
                        }
                    )
                )
            );
            assert.equal(result._tag, "Failure");
            assert.match(String(result.cause), /PID recording failure/);
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("UI startup failure gracefully closes the real child before releasing ownership", () =>
    ownedFixture(({ fs, metadata, path, run }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./server-child.mts", import.meta.url)
            );
            const result = yield* Effect.exit(
                run((owner: ServerOwnership) =>
                    superviseServer(owner, {
                        lifecycle: { signals: new EventEmitter() },
                        onSession: () =>
                        {
                            throw new Error("controlled UI startup failure");
                        },
                        spawn: (
                            _file: string,
                            _args: Array<string>,
                            options: {
                                cwd: string;
                                env: NodeJS.ProcessEnv;
                                shell: false;
                                stdio: "pipe";
                            }
                        ) =>
                            spawn(
                                process.execPath,
                                [ "--import", import.meta.resolve("tsx"), script ],
                                options
                            )
                    })
                )
            );
            assert.equal(result._tag, "Failure");
            assert.match(String(result.cause), /controlled UI startup failure/);
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));

test("Effect interruption gracefully closes a real child and releases ownership", () =>
    ownedFixture(({ fs, metadata, path, run }) =>
        Effect.gen(function* ()
        {
            const script: string = yield* path.fromFileUrl(
                new URL("./server-child.mts", import.meta.url)
            );
            let ready: (value: void | PromiseLike<void>) => void;
            const started: Promise<void> = new Promise<void>(
                (resolve: (value: void | PromiseLike<void>) => void) =>
                {
                    ready = resolve;
                }
            );
            const program = run((owner: ServerOwnership) =>
                superviseServer(owner, {
                    lifecycle: { signals: new EventEmitter() },
                    onSession: () => ready(undefined),
                    spawn: (
                        _file: string,
                        _args: Array<string>,
                        options: {
                            cwd: string;
                            env: NodeJS.ProcessEnv;
                            shell: false;
                            stdio: "pipe";
                        }
                    ) =>
                        spawn(
                            process.execPath,
                            [ "--import", import.meta.resolve("tsx"), script ],
                            options
                        )
                })
            );
            const fiber = yield* Effect.forkChild(program);
            yield* Effect.promise(() => started);
            yield* Fiber.interrupt(fiber);
            assert.deepEqual(yield* fs.readDirectory(metadata), []);
        })
    ));
