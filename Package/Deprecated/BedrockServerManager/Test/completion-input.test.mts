/**
 * Real terminal completion dispatch, described menu and inline-hint rendering.
 *
 * @module bedrock-server-manager/Test/completion-input.test
 *
 * @file      completion-input.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Box, Text, render, useInput } from "ink";
import { PassThrough, Writable } from "node:stream";
import type { ReadStream, WriteStream } from "node:tty";
import {
    createCompletionState,
    dispatchCompletion,
    inlineSuggestion
} from "../Distribution/command-completion.js";
import { createElement, useState } from "react";
import { setTimeout as delay, setImmediate as settle } from "node:timers/promises";
import { editCommand, editorActionForKey } from "../Distribution/command-editor.js";
import { CompletionMenu } from "../Distribution/completion-menu.js";
import type { CompletionState } from "../Distribution/command-completion.js";
import { EditorInput } from "../Distribution/editor-input.js";
import type { EditorState } from "../Distribution/console-state.js";
import assert from "node:assert/strict";
import { createConsoleState } from "../Distribution/console-state.js";
import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";
import { Option } from "effect";

type CompletionModel = { completion: CompletionState;
    editor: EditorState };
const fixture: (
    text: string,
    history?: Array<string>,
    columns?: number
) => Promise<{
    close: () => Promise<void>;
    latest: () => CompletionModel;
    output: () => string;
    send: (text: string) => Promise<void>;
    submissions: () => number;
}> = async (text: string, history: Array<string> = [], columns: number = 64) =>
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
    const terminalInput: ReadStream = input as unknown as ReadStream;
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
        { columns: 70,
            isTTY: true,
            rows: 12 }
    );
    let latest: Option.Option<CompletionModel> = Option.none();
    let submissions: number = 0;
    const Probe = () =>
    {
        const [ model, setModel ] = useState<CompletionModel>(() => ({
            completion: createCompletionState(),
            editor: {
                ...createConsoleState().editor,
                anchor: text.length,
                cursor: text.length,
                history,
                text
            }
        }));
        latest = Option.some(model);
        useInput((input: string, key) =>
        {
            const next: {
                completion: CompletionState;
                editor: EditorState;
                handled: boolean;
            } = dispatchCompletion(model.editor, model.completion, input, key);
            if (!next.handled)
            {
                if (key.return)
                {
                    submissions++;
                    return;
                }

                const action = editorActionForKey(input, key);
                if (Option.isSome(action))
                {
                    next.editor = editCommand(next.editor, action.value);
                }
            }

            setModel({ completion: next.completion,
                editor: next.editor });
        });
        return createElement(
            Box,
            { flexDirection: "column" },
            createElement(EditorInput, {
                columns,
                focused: true,
                onAction: (action) =>
                    setModel((previous: CompletionModel) => ({
                        completion: createCompletionState(),
                        editor: editCommand(previous.editor, action)
                    })),
                origin: { x: 0,
                    y: 0 },
                state: model.editor,
                suggestion: model.completion.menuOpen ? "" : inlineSuggestion(model.editor)
            }),
            createElement(CompletionMenu, {
                columns,
                maxRows: 4,
                state: model.completion
            }),
            createElement(Text, null, "INPUT")
        );
    };

    const terminalOutput: WriteStream = output as unknown as WriteStream;
    const app = render(createElement(Probe), {
        exitOnCtrlC: false,
        interactive: true,
        patchConsole: false,
        stderr: terminalOutput,
        stdin: terminalInput,
        stdout: terminalOutput
    });
    await app.waitUntilRenderFlush();
    await settle();
    return {
        close: async () =>
        {
            app.unmount();
            await app.waitUntilExit();
            app.cleanup();
            input.destroy();
            output.destroy();
        },
        latest: () =>
        {
            assert.ok(Option.isSome(latest));
            return latest.value;
        },
        output: () => stripVTControlCharacters(writes.join("")),
        send: async (text: string) =>
        {
            input.write(text);
            await settle();
            await app.waitUntilRenderFlush();
        },
        submissions: () => submissions
    };
};

test("raw Ctrl+Space opens a described menu; arrows and Enter accept without submitting", async () =>
{
    const app: {
        close: () => Promise<void>;
        latest: () => CompletionModel;
        output: () => string;
        send: (text: string) => Promise<void>;
        submissions: () => number;
    } = await fixture("time ");
    try
    {
        await app.send("\0");
        assert.equal(app.latest().completion.menuOpen, true);
        assert.ok(app.output().includes("Clock action: add"));
        assert.ok(app.output().includes("time <add|set|query>"));
        await app.send("\u001b[B");
        assert.equal(app.latest().completion.selected, 1);
        await app.send("\r");
        assert.equal(app.latest().editor.text, "time query");
        assert.equal(app.latest().completion.menuOpen, false);
        assert.equal(app.submissions(), 0);
        await app.send("\r");
        assert.equal(app.submissions(), 1);
    }
    finally
    {
        await app.close();
    }
});

test("Tab/Shift+Tab cycle without submission and Escape dismisses without changing input", async () =>
{
    const app: {
        close: () => Promise<void>;
        latest: () => CompletionModel;
        output: () => string;
        send: (text: string) => Promise<void>;
        submissions: () => number;
    } = await fixture("time ");
    try
    {
        await app.send("\t");
        assert.equal(app.latest().editor.text, "time add");
        await app.send("\t");
        assert.equal(app.latest().editor.text, "time query");
        await app.send("\u001b[Z");
        assert.equal(app.latest().editor.text, "time add");
        await app.send("\0");
        await app.send("\u001b");
        // Ink waits briefly to distinguish standalone Escape from a longer terminal sequence.
        await delay(75);
        assert.equal(app.latest().completion.menuOpen, false);
        assert.equal(app.latest().editor.text, "time add");
        assert.equal(app.submissions(), 0);
    }
    finally
    {
        await app.close();
    }
});

test("Right accepts the full history suffix even when the visible preview is clipped", async () =>
{
    const app: {
        close: () => Promise<void>;
        latest: () => CompletionModel;
        output: () => string;
        send: (text: string) => Promise<void>;
        submissions: () => number;
    } = await fixture("wea", [ "weather clear" ], 5);
    try
    {
        assert.ok(app.output().includes("weath"));
        await app.send("\u001b[C");
        assert.equal(app.latest().editor.text, "weather clear");
        assert.equal(app.submissions(), 0);
        await app.send("\u001b[H");
        await app.send("\u001b[C");
        assert.equal(app.latest().editor.cursor, 1);
        assert.equal(app.latest().editor.text, "weather clear");
    }
    finally
    {
        await app.close();
    }
});

test("inline previews are dim and suppressed for a selection or a mid-line cursor", () =>
{
    const module: string = new URL("../Distribution/editor-input.js", import.meta.url).href;
    const code: string =
        "import {createElement} from 'react'; import {renderToString} from 'ink'; " +
        `import {EditorInput} from ${JSON.stringify(module)}; ` +
        "const draw=(cursor,anchor)=>renderToString(createElement(EditorInput,{" +
        "columns:5,focused:true,onAction:()=>{},origin:{x:0,y:0},suggestion:'ther clear'," +
        "state:{text:'wea',cursor,anchor,history:[],draft:''}}));" +
        "process.stdout.write(JSON.stringify([draw(3,3),draw(3,0),draw(1,1)]));";
    const env: NodeJS.ProcessEnv = { ...process.env,
        FORCE_COLOR: "1" };
    delete env.NO_COLOR;
    const result = spawnSync(process.execPath, [ "--input-type=module", "--eval", code ], {
        encoding: "utf8",
        env,
        timeout: 15000
    });
    assert.equal(result.status, 0, result.stderr);
    const frames = JSON.parse(result.stdout);
    assert.ok(frames[0].includes("\u001b[2mth"));
    assert.equal(stripVTControlCharacters(frames[0]), "weath");
    assert.equal(stripVTControlCharacters(frames[1]).trim(), "wea");
    assert.equal(stripVTControlCharacters(frames[2]).trim(), "wea");
});
