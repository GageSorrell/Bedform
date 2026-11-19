/**
 * Real Ink rendering, bracketed-paste isolation and display-width cursor checks.
 *
 * @module bedrock-server-manager/Test/editor-input.test
 *
 * @file      editor-input.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Box, Text, render, useInput } from "ink";
import { PassThrough, Writable } from "node:stream";
import type { ReadStream, WriteStream } from "node:tty";
import { createElement, useState } from "react";
import { editCommand, editorActionForKey } from "../Distribution/command-editor.js";
import type { EditorAction } from "../Distribution/command-editor.js";
import { EditorInput } from "../Distribution/editor-input.js";
import type { EditorState } from "../Distribution/console-state.js";
import assert from "node:assert/strict";
import { createConsoleState } from "../Distribution/console-state.js";
import { setImmediate as settle } from "node:timers/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Option } from "effect";

const terminalFixture: () => {
    stderr: WriteStream;
    stdin: ReadStream & PassThrough;
    stdout: WriteStream;
    writes: Array<string>;
} = () =>
{
    const input: PassThrough & {
        isRaw: boolean;
        isTTY: boolean;
        ref: () => PassThrough;
        setRawMode: (value: boolean) => PassThrough;
        unref: () => PassThrough;
    } = new PassThrough() as PassThrough & {
        isRaw: boolean;
        isTTY: boolean;
        ref: () => PassThrough;
        setRawMode: (value: boolean) => PassThrough;
        unref: () => PassThrough;
    };
    Object.assign(input, {
        isRaw: false,
        isTTY: true,
        ref: () => input,
        setRawMode: (value: boolean) =>
        {
            input.isRaw = value;
            return input;
        },
        unref: () => input
    });
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
        { columns: 40,
            isTTY: true,
            rows: 10 }
    );
    return {
        stderr: output as unknown as WriteStream,
        stdin: input as unknown as ReadStream & PassThrough,
        stdout: output as unknown as WriteStream,
        writes
    };
};

const editorFixture = async (initial: EditorState, initialColumns: number = 20) =>
{
    const terminal: {
        stderr: WriteStream;
        stdin: ReadStream & PassThrough;
        stdout: WriteStream;
        writes: Array<string>;
    } = terminalFixture();
    let latest: Option.Option<EditorState> = Option.none();
    let entered: number = 0;
    const Probe = ({
        focused,
        columns,
        message
    }: {
        focused: boolean;
        columns: number;
        message: string;
    }) =>
    {
        const [ state, setState ] = useState(initial);
        latest = Option.some(state);
        const dispatch: (action: EditorAction) => void = (action: EditorAction) =>
            setState((previous: EditorState) => editCommand(previous, action));
        useInput((input: string, key) =>
        {
            if (!focused)
            {
                return;
            }

            if (key.return)
            {
                entered++;
                return;
            }

            const action: Option.Option<EditorAction> = editorActionForKey(input, key);
            if (Option.isSome(action))
            {
                dispatch(action.value);
            }
        });
        return createElement(
            Box,
            { flexDirection: "column" },
            createElement(Text, null, message),
            createElement(
                Box,
                null,
                createElement(Text, null, "> "),
                createElement(EditorInput, {
                    columns,
                    focused,
                    onAction: dispatch,
                    origin: { x: 2,
                        y: 1 },
                    state
                })
            ),
            createElement(Text, null, focused ? "INPUT" : "OUTPUT")
        );
    };

    const tree = (
        focused: boolean = true,
        columns: number = initialColumns,
        message: string = "server output"
    ) => createElement(Probe, { columns,
        focused,
        message });
    const app = render(tree(), {
        ...terminal,
        alternateScreen: true,
        exitOnCtrlC: false,
        interactive: true,
        patchConsole: false
    });
    await app.waitUntilRenderFlush();
    await settle();
    return {
        app,
        close: async () =>
        {
            app.unmount();
            await app.waitUntilExit();
            app.cleanup();
            terminal.stdin.destroy();
            terminal.stdout.destroy();
        },
        entered: () => entered,
        flush: async () =>
        {
            await settle();
            await app.waitUntilRenderFlush();
        },
        latest: () =>
        {
            assert.ok(Option.isSome(latest));
            return latest;
        },
        send: async (text: string) =>
        {
            terminal.stdin.write(text);
            await settle();
            await app.waitUntilRenderFlush();
        },
        terminal,
        tree
    };
};

test("actual bracketed multiline paste stays editable and never reaches Enter handling", async () =>
{
    const fixture = await editorFixture(createConsoleState().editor);
    try
    {
        assert.ok(fixture.terminal.writes.join("").includes("\u001b[?2004h"));
        fixture.terminal.stdin.write("\u001b[20");
        fixture.terminal.stdin.write("0~/stop\r");
        await settle();
        fixture.terminal.stdin.write("\nlist\n");
        fixture.terminal.stdin.write("\u001b[201~");
        await fixture.flush();
        assert.equal(fixture.latest().value.text, "/stop list ");
        assert.deepEqual(fixture.latest().value.history, []);
        assert.equal(fixture.entered(), 0);
        await fixture.send("\r");
        assert.equal(fixture.entered(), 1);
    }
    finally
    {
        await fixture.close();
    }

    assert.equal(fixture.terminal.stdin.isRaw, false);
    assert.ok(fixture.terminal.writes.join("").includes("\u001b[?2004l"));
});

test("cursor columns update on the current frame, including wide text and shifted movement", async () =>
{
    const initial: {
        anchor: number;
        cursor: number;
        text: string;
        history: Array<string>;
        historyIndex: Option.Option<number>;
        draft: string;
        draftCursor?: number;
        draftAnchor?: number;
    } = {
        ...createConsoleState().editor,
        anchor: 2,
        cursor: 2,
        text: "界a"
    };
    const fixture = await editorFixture(initial, 6);
    try
    {
        // Prefix occupies two columns; 界 occupies two; a occupies one. Cursor is column six (1-based).
        assert.ok(fixture.terminal.writes.join("").includes("\u001b[6G"));
        fixture.terminal.writes.length = 0;
        await fixture.send("\u001b[1;2D");
        assert.deepEqual([ fixture.latest().value.anchor, fixture.latest().value.cursor ], [ 2, 1 ]);
        assert.ok(fixture.terminal.writes.join("").includes("\u001b[5G"));
        const before: EditorState = fixture.latest().value;
        fixture.app.rerender(fixture.tree(true, 6, "new unrelated output"));
        await fixture.flush();
        assert.equal(fixture.latest().value, before);
        fixture.app.rerender(fixture.tree(false, 6));
        await fixture.flush();
        assert.equal(fixture.latest().value, before);
        fixture.terminal.writes.length = 0;
        fixture.app.rerender(fixture.tree(true, 2));
        await fixture.flush();
        assert.equal(fixture.latest().value, before);
        assert.ok(fixture.terminal.writes.join("").includes("\u001b[3G"));
    }
    finally
    {
        await fixture.close();
    }
});

test("paste while output is focused cannot mutate input or trigger command/navigation handlers", async () =>
{
    const initial: {
        anchor: number;
        cursor: number;
        text: string;
        history: Array<string>;
        historyIndex: Option.Option<number>;
        draft: string;
        draftCursor?: number;
        draftAnchor?: number;
    } = {
        ...createConsoleState().editor,
        anchor: 0,
        cursor: 4,
        text: "list"
    };
    const fixture = await editorFixture(initial);
    try
    {
        fixture.app.rerender(fixture.tree(false));
        await fixture.flush();
        await fixture.send("\u001b[200~stop\njjj\r\u001b[201~");
        assert.equal(fixture.latest().value, initial);
        assert.equal(fixture.entered(), 0);
        fixture.app.rerender(fixture.tree(true));
        await fixture.flush();
        await fixture.send("\u001b[200~界\u001b[201~");
        assert.equal(fixture.latest().value.text, "界");
        assert.equal(fixture.latest().value.cursor, 1);
        assert.equal(fixture.latest().value.anchor, 1);
    }
    finally
    {
        await fixture.close();
    }
});

test("selection highlighting survives a monochrome render without changing text width", () =>
{
    const module: string = new URL("../Distribution/editor-input.js", import.meta.url).href;
    const code: string =
        "import {createElement} from 'react'; import {renderToString} from 'ink'; " +
        `import {EditorInput} from ${JSON.stringify(module)}; ` +
        "process.stdout.write(renderToString(createElement(EditorInput, {" +
        "columns: 8, focused: false, onAction: () => {}, origin: {x:0,y:0}, " +
        "state: {text:'a界b', anchor:1, cursor:2, history:[], draft:''} })));";
    const env: NodeJS.ProcessEnv = { ...process.env,
        FORCE_COLOR: "1" };
    delete env.NO_COLOR;
    const result = spawnSync(process.execPath, [ "--input-type=module", "--eval", code ], {
        encoding: "utf8",
        env,
        timeout: 15000
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("\u001b[7m界"));
});
