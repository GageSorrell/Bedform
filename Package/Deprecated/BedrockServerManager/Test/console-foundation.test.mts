/**
 * Controllable console and child-process boundaries, without a real BDS launch.
 *
 * @module bedrock-server-manager/Test/console-foundation.test
 *
 * @file      console-foundation.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ConsoleFrame, renderConsole } from "../Distribution/console-frame.js";
import type { Instance as InkInstance, Key, RenderOptions } from "ink";
import { PassThrough, Writable } from "node:stream";
import { Text, render as renderInk, useInput } from "ink";
import { createElement, useState } from "react";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ConsoleTerminal } from "../Distribution/console-frame.js";
import { EventEmitter } from "node:events";
import type { ReactNode } from "react";
import type { SpawnServer } from "../Distribution/start-process.js";
import type { WriteStream } from "node:tty";
import assert from "node:assert/strict";
import { createConsoleState } from "../Distribution/console-state.js";
import { join } from "node:path";
import { render } from "ink-testing-library";
import { setImmediate as settle } from "node:timers/promises";
import { spawnServer } from "../Distribution/start-process.js";
import test from "node:test";
import { Option } from "effect";

const childFixture: () => ChildProcessWithoutNullStreams = () =>
    Object.assign(new EventEmitter(), {
        pid: 1234,
        stderr: new PassThrough(),
        stdin: new PassThrough(),
        stdout: new PassThrough()
    }) as unknown as ChildProcessWithoutNullStreams;

const terminalFixture: () => {
    stderr: WriteStream;
    stdin: NodeJS.ReadStream & PassThrough;
    stdout: WriteStream;
    writes: Array<string>;
} = () =>
{
    const input: PassThrough & {
        isTTY: boolean;
        isRaw: boolean;
        ref: () => PassThrough;
        unref: () => PassThrough;
        setRawMode: (enabled: boolean) => PassThrough;
    } = new PassThrough() as PassThrough & {
        isTTY: boolean;
        isRaw: boolean;
        ref: () => PassThrough;
        unref: () => PassThrough;
        setRawMode: (enabled: boolean) => PassThrough;
    };
    input.isTTY = true;
    input.isRaw = false;
    input.ref = () => input;
    input.unref = () => input;
    input.setRawMode = (enabled: boolean) =>
    {
        input.isRaw = enabled;
        return input;
    };

    const writes: Array<string> = [];
    const output: Writable & { columns: number;
        isTTY: boolean;
        rows: number } = Object.assign(
        new Writable({
            write(chunk, encoding: BufferEncoding, callback: (error?: Error | null) => void)
            {
                writes.push(chunk.toString());
                callback();
            }
        }),
        { columns: 80,
            isTTY: true,
            rows: 24 }
    );
    return {
        stderr: output as unknown as WriteStream,
        stdin: input as unknown as NodeJS.ReadStream & PassThrough,
        stdout: output as unknown as WriteStream,
        writes
    } satisfies ConsoleTerminal & { writes: Array<string> };
};

test("session state is fresh and independent of process and terminal globals", () =>
{
    const first = createConsoleState();
    const second = createConsoleState();
    first.editor.history.push("list");
    first.completions.push({
        description: "Stop",
        end: 1,
        start: 0,
        usage: "stop",
        value: "stop"
    });
    assert.equal(second.focus, "input");
    assert.deepEqual(second.editor, {
        anchor: 0,
        cursor: 0,
        draft: "",
        history: [],
        historyIndex: undefined,
        text: ""
    });
    assert.deepEqual(second.completions, []);
    assert.ok(Option.isNone(second.selectedCompletion));
});

test("process boundary preserves environment, uses native executable and never invokes a shell", () =>
{
    for (const platform of [ "win32", "linux" ] as const)
    {
        const child: ChildProcessWithoutNullStreams = childFixture();
        const env: { FIXTURE: string;
            LD_LIBRARY_PATH: string } = {
            FIXTURE: "preserved",
            LD_LIBRARY_PATH: "/existing:/other"
        };
        let call: Option.Option<Parameters<SpawnServer>> = Option.none();
        const spawned: ChildProcessWithoutNullStreams = spawnServer(
            { directory: "/fixture/server space",
                env,
                platform },
            (
                ...args: [
                    executable: string,
                    args: Array<string>,
                    options: {
                        cwd: string;
                        env: NodeJS.ProcessEnv;
                        shell: false;
                        stdio: "pipe";
                    }
                ]
            ) =>
            {
                call = Option.some(args);
                return child;
            }
        );
        assert.equal(spawned, child);
        assert.ok(Option.isSome(call));
        assert.equal(
            call.value[0],
            join(
                "/fixture/server space",
                platform === "win32" ? "bedrock_server.exe" : "bedrock_server"
            )
        );
        assert.deepEqual(call.value[1], []);
        assert.deepEqual(call.value[2], {
            cwd: "/fixture/server space",
            env: {
                ...env,
                LD_LIBRARY_PATH:
                    platform === "linux"
                        ? "/fixture/server space:/existing:/other"
                        : env.LD_LIBRARY_PATH
            },
            shell: false,
            stdio: "pipe"
        });
        assert.equal(env.LD_LIBRARY_PATH, "/existing:/other");
        let output: string = "";
        spawned.stdout.on("data", (chunk) =>
        {
            output += chunk;
        });
        child.stdout.emit("data", Buffer.from("controlled output"));
        assert.equal(output, "controlled output");
        let closed: Option.Option<number | null> = Option.none();
        spawned.on("close", (code: number | null) =>
        {
            closed = Option.some(code);
        });
        child.emit("close", 7);
        assert.equal(Option.getOrThrow(closed), 7);
    }
});

test("empty Linux library path and synchronous spawn failure are observable by session owner", () =>
{
    spawnServer({ directory: "/server",
        env: {},
        platform: "linux" }, ((
            _file: string,
            _args: Array<string>,
            options: {
                cwd: string;
                env: NodeJS.ProcessEnv;
                shell: false;
                stdio: "pipe";
            }
        ) =>
        {
            assert.equal(options.env.LD_LIBRARY_PATH, "/server");
            return childFixture();
        }) satisfies SpawnServer);
    const failure: Error = new Error("injected spawn failure");
    assert.throws(
        () =>
            spawnServer({ directory: "/server",
                env: {},
                platform: "linux" }, () =>
            {
                throw failure;
            }),
        (error: unknown) => error === failure
    );
});

test("render boundary configures alternate screen and blocks Ink default Ctrl+C exit", () =>
{
    const terminal: {
        stderr: WriteStream;
        stdin: NodeJS.ReadStream & PassThrough;
        stdout: WriteStream;
        writes: Array<string>;
    } = terminalFixture();
    const instance: InkInstance = {} as InkInstance;
    const node = createElement(Text, null, "fixture");
    assert.equal(
        renderConsole(node, terminal, ((tree: ReactNode, options: RenderOptions) =>
        {
            assert.equal(tree, node);
            assert.equal(options.stdin, terminal.stdin);
            assert.equal(options.stdout, terminal.stdout);
            assert.equal(options.stderr, terminal.stderr);
            assert.equal(options.alternateScreen, true);
            assert.equal(options.exitOnCtrlC, false);
            assert.equal(options.patchConsole, false);
            return instance;
        }) as typeof renderInk),
        instance
    );
});

test("compiled TSX frame composes slots and accepts controlled terminal input", async () =>
{
    const received: Array<{ input: string;
        key: Key }> = [];
    const tree = (focus: "input" | "output") =>
        createElement(ConsoleFrame, {
            assistance: createElement(Text, null, "completion description"),
            focus,
            instance: "Fixture World",
            onInput: (input: string, key: Key) =>
            {
                received.push({ input,
                    key });
            },
            output: createElement(Text, null, "server output"),
            prompt: createElement(Text, null, "typed command")
        });
    const app = render(tree("input"));
    try
    {
        await settle();
        assert.match(app.lastFrame() ?? "", /server output/);
        assert.match(app.lastFrame() ?? "", /completion description/);
        assert.match(app.lastFrame() ?? "", /BDS › Fixture World › typed command/);
        assert.match(app.lastFrame() ?? "", /INPUT/);
        app.stdin.write("x");
        await settle();
        assert.equal(received.at(-1)?.input, "x");
        app.rerender(tree("output"));
        await settle();
        assert.match(app.lastFrame() ?? "", /OUTPUT/);
    }
    finally
    {
        app.unmount();
        app.cleanup();
    }
});

test("real Ink streams receive Ctrl+C as input and restore alternate screen on cleanup", async () =>
{
    const terminal: {
        stderr: WriteStream;
        stdin: NodeJS.ReadStream & PassThrough;
        stdout: WriteStream;
        writes: Array<string>;
    } = terminalFixture();
    const received: Array<{ input: string;
        key: Key }> = [];
    const Probe = () =>
    {
        const [ count, setCount ] = useState(0);
        useInput((input: string, key: Key) =>
        {
            received.push({ input,
                key });
            setCount((previous: number) => previous + 1);
        });
        return createElement(Text, null, `events ${count}`);
    };

    // CI disables automatic interactive detection; force it only for this stream fixture.
    const app: InkInstance = renderConsole(
        createElement(Probe),
        terminal,
        (node: ReactNode, options: NodeJS.WriteStream | RenderOptions | undefined) =>
            renderInk(node, { ...options,
                interactive: true })
    );
    try
    {
        await app.waitUntilRenderFlush();
        await settle();
        assert.ok(terminal.writes.join("").includes("\u001b[?1049h"));
        terminal.stdin.write("\u0003");
        await settle();
        await app.waitUntilRenderFlush();
        assert.equal(received.at(-1)?.key.ctrl, true);
        assert.equal(received.at(-1)?.input, "c");
        terminal.stdin.write("x");
        await settle();
        assert.equal(received.at(-1)?.input, "x");
    }
    finally
    {
        app.unmount();
        await app.waitUntilExit();
        app.cleanup();
        assert.equal(terminal.stdin.isRaw, false);
        assert.ok(terminal.writes.join("").includes("\u001b[?1049l"));
        terminal.stdin.destroy();
        terminal.stdout.destroy();
    }
});
