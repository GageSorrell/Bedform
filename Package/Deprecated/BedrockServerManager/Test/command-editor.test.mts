/**
 * Grapheme editing, selection, draft history and terminal-column viewport checks.
 *
 * @module bedrock-server-manager/Test/command-editor.test
 *
 * @file      command-editor.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    editCommand,
    editorActionForKey,
    graphemes,
    normalizeEditorText
} from "../Distribution/command-editor.js";
import type { EditorState } from "../Distribution/console-state.js";
import type { Key } from "ink";
import assert from "node:assert/strict";
import { createConsoleState } from "../Distribution/console-state.js";
import { editorViewport } from "../Distribution/editor-viewport.js";
import stringWidth from "string-width";
import test from "node:test";
import { Option } from "effect";

const state: (text?: string, cursor?: number, anchor?: number) => EditorState = (
    text: string = "",
    cursor: number = text.length,
    anchor: number = cursor
): EditorState => ({ ...createConsoleState().editor,
    anchor,
    cursor,
    text });
const move: (
    value: EditorState,
    direction: "left" | "right" | "home" | "end",
    select?: boolean,
    word?: boolean
) => EditorState = (
    value: EditorState,
    direction: "left" | "right" | "home" | "end",
    select: boolean = false,
    word: boolean = false
) => editCommand(value, { direction,
    select,
    type: "move",
    word });
const remove: (
    value: EditorState,
    direction: "backward" | "forward",
    word?: boolean
) => EditorState = (
    value: EditorState,
    direction: "backward" | "forward",
    word: boolean = false
) => editCommand(value, { direction,
    type: "delete",
    word });
const history: (value: EditorState, direction: "older" | "newer") => EditorState = (
    value: EditorState,
    direction: "older" | "newer"
) => editCommand(value, { direction,
    type: "history" });
const insert: (value: EditorState, text: string) => EditorState = (
    value: EditorState,
    text: string
) => editCommand(value, { text,
    type: "insert" });

test("cursor movement and deletion preserve combining, flag, skin-tone and ZWJ graphemes", () =>
{
    const clusters: Array<string> = [ "A", "e\u0301", "界", "👨‍👩‍👧‍👦", "🇺🇸", "👍🏽", "z" ];
    const text: string = clusters.join("");
    let value: EditorState = state(text);
    for (let index: number = clusters.length - 1; index >= 0; index--)
    {
        value = move(value, "left");
        assert.equal(value.cursor, clusters.slice(0, index).join("").length);
        assert.equal(value.anchor, value.cursor);
    }

    assert.equal(move(value, "left").cursor, 0);
    for (let index: number = 1; index <= clusters.length; index++)
    {
        value = move(value, "right");
        assert.equal(value.cursor, clusters.slice(0, index).join("").length);
    }

    assert.equal(move(value, "right").cursor, text.length);
    for (let index: number = clusters.length - 1; index >= 0; index--)
    {
        value = remove(value, "backward");
        assert.equal(value.text, clusters.slice(0, index).join(""));
    }

    value = state(text, 0);
    for (let index: number = 1; index <= clusters.length; index++)
    {
        value = remove(value, "forward");
        assert.equal(value.text, clusters.slice(index).join(""));
    }
});

test("forward and reverse selections replace/delete whole graphemes without mutating history", () =>
{
    const text = "a👨‍👩‍👧‍👦界e\u0301z";
    const end: number = text.indexOf("z");
    for (const [ cursor, anchor ] of [
        [ 1, end ],
        [ end, 1 ]
    ])
    {
        const value: EditorState = Object.freeze({
            ...state(text, cursor, anchor),
            history: [ "list" ]
        });
        assert.equal(insert(value, "🧱").text, "a🧱z");
        assert.equal(remove(value, "backward").text, "az");
        assert.equal(remove(value, "forward").text, "az");
        assert.equal(move(value, "left").cursor, 1);
        assert.equal(move(value, "right").cursor, end);
        assert.equal(value.cursor, cursor);
        assert.deepEqual(value.history, [ "list" ]);
    }
});

test("insertions and deletions snap cursor to new boundaries when adjacent graphemes merge", () =>
{
    const combined: EditorState = insert(state("\u0301x", 0), "e");
    assert.equal(combined.text, "e\u0301x");
    assert.equal(combined.cursor, 2);
    const joined: EditorState = remove(state("🇺x🇸", 3, 2), "backward");
    assert.equal(joined.text, "🇺🇸");
    assert.equal(joined.cursor, 4);
});

test("shifted movement extends, shrinks and crosses the fixed selection anchor", () =>
{
    let value: EditorState = state("a界🧱z", 1);
    value = move(value, "right", true);
    assert.deepEqual([ value.anchor, value.cursor ], [ 1, 2 ]);
    value = move(value, "right", true);
    assert.deepEqual([ value.anchor, value.cursor ], [ 1, 4 ]);
    value = move(value, "left", true);
    value = move(value, "left", true);
    value = move(value, "left", true);
    assert.deepEqual([ value.anchor, value.cursor ], [ 1, 0 ]);
    assert.equal(insert(value, "X").text, "X界🧱z");
    assert.deepEqual([ move(value, "end").anchor, move(value, "end").cursor ], [ 5, 5 ]);
});

test("Home/End and shifted Up/Down select the corresponding boundary", () =>
{
    const cases: Array<[Partial<Key>, number]> = [
        [ { home: true }, 0 ],
        [ { end: true }, 5 ],
        [ { shift: true,
            upArrow: true }, 0 ],
        [ { downArrow: true,
            shift: true }, 5 ],
        [ { home: true,
            shift: true }, 0 ],
        [ { end: true,
            shift: true }, 5 ]
    ];
    for (const [ key, expected ] of cases)
    {
        const action = editorActionForKey("", key);
        assert.ok(Option.isSome(action));
        const value: EditorState = editCommand(state("a界🧱z", 2), action.value);
        assert.equal(value.cursor, expected);
        assert.equal(value.anchor, key.shift ? 2 : expected);
    }
});

test("word movement and word deletion distinguish words, Unicode, punctuation and spaces", () =>
{
    const text = "/say  café_2 --目标  end";
    let value: EditorState = state(text, 0);
    for (const expected of [
        1,
        text.indexOf("café"),
        text.indexOf("--"),
        text.indexOf("目标"),
        text.indexOf("end"),
        text.length
    ])
    {
        value = move(value, "right", false, true);
        assert.equal(value.cursor, expected);
    }

    for (const expected of [
        text.indexOf("end"),
        text.indexOf("目标"),
        text.indexOf("--"),
        text.indexOf("café"),
        1,
        0
    ])
    {
        value = move(value, "left", false, true);
        assert.equal(value.cursor, expected);
    }

    assert.equal(remove(state("say  café_2"), "backward", true).text, "say  ");
    assert.equal(remove(state("say  café_2", 0), "forward", true).text, "café_2");
    const wordMove = editorActionForKey("", { ctrl: true,
        leftArrow: true });
    assert.ok((Option.isSome(wordMove)&&wordMove.value.type==="move"));
    assert.equal(wordMove.value.word, true);
    const wordDelete = editorActionForKey("", { delete: true,
        meta: true });
    assert.ok((Option.isSome(wordDelete)&&wordDelete.value.type==="delete"));
    assert.equal(wordDelete.value.word, true);
    const metaMove = editorActionForKey("b", { meta: true });
    assert.ok((Option.isSome(metaMove)&&metaMove.value.type==="move"));
    assert.equal(metaMove.value.direction, "left");
});

test("history restores the exact draft cursor and selection; commits preserve raw session input", () =>
{
    let value: EditorState = editCommand(state("/list"), { type: "commit" });
    value = editCommand(insert(value, " say  hello "), { type: "commit" });
    value = { ...insert(value, "say unfinished"),
        anchor: 4,
        cursor: 8 };
    value = history(value, "older");
    assert.equal(value.text, " say  hello ");
    value = history(value, "older");
    assert.equal(value.text, "/list");
    assert.equal(history(value, "older"), value);
    value = history(value, "newer");
    value = history(value, "newer");
    assert.deepEqual([ value.text, value.anchor, value.cursor ], [ "say unfinished", 4, 8 ]);
    assert.ok(Option.isNone(value.historyIndex));
    assert.equal(history(value, "newer"), value);
    assert.deepEqual(value.history, [ "/list", " say  hello " ]);
    assert.deepEqual(editCommand(state("  "), { type: "commit" }).history, []);
});

test("editing recalled commands detaches history and preserves the original entries", () =>
{
    let value: {
        history: Array<string>;
        text: string;
        cursor: number;
        anchor: number;
        historyIndex: Option.Option<number>;
        draft: string;
        draftCursor?: number;
        draftAnchor?: number;
    } = { ...state("draft"),
        history: [ "list", "say old" ] };
    value = history(value, "older");
    value = insert(value, " edited");
    assert.ok(Option.isNone(value.historyIndex));
    assert.deepEqual(value.history, [ "list", "say old" ]);
    value = history(value, "older");
    value = history(value, "newer");
    assert.equal(value.text, "say old edited");
});

test("paste normalization inserts editable spaces and cannot commit or execute", () =>
{
    const text = "say first\r\n/stop\nlist\r\tend\u2028next\u2029last\0\u001b";
    assert.equal(normalizeEditorText(text), "say first /stop list  end next last");
    const action = editorActionForKey(text, { return: true });
    assert.ok((Option.isSome(action)&&action.value.type==="insert"));
    const value: EditorState = editCommand(state(), action.value);
    assert.equal(value.text, "say first /stop list  end next last");
    assert.deepEqual(value.history, []);
    assert.equal(insert(state("x"), "\0").text, "x");
});

test("editor dispatch leaves Enter, completions, pane chords, Ctrl+C and releases to its caller", () =>
{
    const ignored: Array<[string, Partial<Key>]> = [
        [ "", { return: true } ],
        [ "", { tab: true } ],
        [ "", { shift: true,
            tab: true } ],
        [ " ", { ctrl: true } ],
        [ "c", { ctrl: true } ],
        [ "w", { ctrl: true } ],
        [ "", { escape: true } ],
        [ "", { pageUp: true } ],
        [ "x", { eventType: "release" } ]
    ];
    for (const [ input, key ] of ignored)
    {
        assert.ok(Option.isNone(editorActionForKey(input, key)));
    }

    const up = editorActionForKey("", { upArrow: true });
    assert.ok((Option.isSome(up)&&up.value.type==="history"));
    assert.equal(up.value.direction, "older");
    const down = editorActionForKey("", { downArrow: true });
    assert.ok((Option.isSome(down)&&down.value.type==="history"));
    assert.equal(down.value.direction, "newer");
    const selectRight = editorActionForKey("", {
        rightArrow: true,
        shift: true
    });
    assert.ok((Option.isSome(selectRight)&&selectRight.value.type==="move"));
    assert.equal(selectRight.value.select, true);
});

test("wide/combining viewport placement uses columns, never UTF-16 length", () =>
{
    const value: EditorState = state("ae\u0301界🧱z");
    const view = editorViewport(value, 5);
    assert.equal(view.cursorColumn, 3);
    assert.equal(view.start, value.text.indexOf("🧱"));
    assert.equal(view.cells.map((cell) => cell.text).join(""), "🧱z ");
    assert.equal(view.leftHidden, true);
    assert.equal(view.rightHidden, false);
    const selected = editorViewport(state("a界🧱z", 4, 1), 4);
    assert.deepEqual(
        selected.cells.filter((cell) => cell.selected).map((cell) => cell.text),
        [ "🧱" ]
    );
    assert.ok(selected.cursorColumn < 4);
});

test("long input scrolling follows the cursor and preserves a paused viewport where possible", () =>
{
    const text = "0123456789abcdefghijklmnopqrstuvwxyz";
    let view = editorViewport(state(text), 8);
    assert.equal(view.cursorColumn, 7);
    assert.equal(view.cells.map((cell) => cell.text).join(""), "tuvwxyz ");
    const start: number = view.start;
    view = editorViewport(state(text, text.length - 2), 8, start);
    assert.equal(view.start, start);
    view = editorViewport(state(text, 0), 8, start);
    assert.equal(view.start, 0);
    assert.equal(view.cursorColumn, 0);
    assert.equal(view.rightHidden, true);
});

test("tiny viewports retain an addressable cursor and do not cut wide graphemes", () =>
{
    const tiny = editorViewport(state("界", 0), 1);
    assert.equal(tiny.cells[0].text, "…");
    assert.equal(tiny.cells[0].clipped, true);
    assert.equal(tiny.cursorColumn, 0);
    assert.deepEqual(editorViewport(state("界"), 0).cells, []);
    assert.equal(editorViewport(state("界"), 1).cells[0].text, " ");
    assert.equal(editorViewport(state("\u0301", 0), 2).cells[0].text, "◌\u0301");
});

test("every viewport boundary/cursor remains valid across all positions, widths and selections", () =>
{
    const text = "Ae\u0301界👨‍👩‍👧‍👦🇺🇸👍🏽z";
    const boundaries: Array<number> = [
        0,
        ...graphemes(text).map(
            (part: { end: number;
                start: number;
                text: string }) => part.end
        )
    ];
    for (const cursor of boundaries)
    {
        for (const anchor of boundaries)
        {
            for (let width: number = 1; width <= 10; width++)
            {
                const view = editorViewport(state(text, cursor, anchor), width);
                assert.ok(boundaries.includes(view.start));
                assert.ok(boundaries.includes(view.end));
                assert.ok(view.cursorColumn >= 0 && view.cursorColumn < width);
                assert.ok(stringWidth(view.cells.map((cell) => cell.text).join("")) <= width);
                assert.equal(view.cells.filter((cell) => cell.cursor).length, 1);
                assert.ok(
                    view.cells.every(
                        (cell) =>
                            boundaries.includes(cell.start) && boundaries.includes(cell.end)
                    )
                );
            }
        }
    }
});
