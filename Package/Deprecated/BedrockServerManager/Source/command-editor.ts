/**
 * Pure grapheme-aware command editing, selection and session history.
 *
 * @module bedrock-server-manager/command-editor
 *
 * @file      command-editor.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { EditorState } from "./console-state.js";
import type { Key } from "ink";
import { Option } from "effect";

/** Editing never submits commands or dispatches completion/pane navigation. */
type EditorAction =
    | { type: "insert"; text: string }
    | { type: "move"; direction: "left" | "right" | "home" | "end"; select?: boolean; word?: boolean }
    | { type: "delete"; direction: "backward" | "forward"; word?: boolean }
    | { type: "history"; direction: "older" | "newer" }
    | { type: "commit" };

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Grapheme boundaries are UTF-16 offsets, shared with completion replacement ranges. */
const graphemes = (text: string) => Array.from(segmenter.segment(text),
    (part: Intl.SegmentData) => ({ end: part.index + part.segment.length,
        start: part.index, text: part.segment }));

/** Snap externally supplied offsets without leaving a cursor inside a grapheme. */
const snapOffset = (text: string, offset: number, forward: boolean = false) =>
{
    const bounded = Math.max(0, Math.min(text.length, Number.isFinite(offset) ? Math.floor(offset) : 0));
    for (const part of graphemes(text))
    {
        if (bounded > part.start && bounded < part.end)
        {
            return forward ? part.end : part.start;
        }
    }
    return bounded;
};

/** Make pasted lines/tabs editable spaces, removing terminal control bytes. */
const normalizeEditorText = (text: string) => BedrockString.replace(/\p{Cc}/gu, "")(BedrockString.replace(/\r\n|[\r\n\t\u2028\u2029]/g, " ")(text));

/** Word movement groups letters/numbers, punctuation and whitespace without parsing commands. */
const wordClass = (text: string) => /^\s+$/u.test(text) ? "space"
    : /[\p{L}\p{N}\p{M}_]/u.test(text) ? "word" : "punctuation";

const moveOffset = (text: string, cursor: number, direction: "left" | "right", word: boolean) =>
{
    const parts = graphemes(text);
    let index = parts.findIndex((part: { start: number }) => part.start >= cursor);
    if (index === -1)
    {
        index = parts.length;
    }
    if (!word)
    {
        return direction === "left" ? (parts[index - 1]?.start ?? 0)
            : (parts[index]?.end ?? text.length);
    }
    if (direction === "left")
    {
        while (index > 0 && wordClass(parts[index - 1].text) === "space") { index--; }
        const kind = index > 0 ? wordClass(parts[index - 1].text) : undefined;
        while (index > 0 && wordClass(parts[index - 1].text) === kind) { index--; }
    }
    else
    {
        const kind = index < parts.length ? wordClass(parts[index].text) : undefined;
        while (index < parts.length && wordClass(parts[index].text) === kind) { index++; }
        while (index < parts.length && wordClass(parts[index].text) === "space") { index++; }
    }
    return parts[index]?.start ?? text.length;
};

const replace = (state: EditorState, start: number, end: number, inserted: string): EditorState =>
{
    const text = state.text.slice(0, start) + inserted + state.text.slice(end);
    const cursor = snapOffset(text, start + inserted.length, true);
    return { ...state, anchor: cursor, cursor, draft: text, draftAnchor: cursor,
        draftCursor: cursor, historyIndex: Option.none(), text };
};

/** Immutable editor transition; history is only changed by an explicit successful-submit commit. */
const editCommand = (state: EditorState, action: EditorAction): EditorState =>
{
    const cursor = snapOffset(state.text, state.cursor);
    const anchor = snapOffset(state.text, state.anchor);
    const start = Math.min(cursor, anchor);
    const end = Math.max(cursor, anchor);
    switch (action.type)
    {
        case "insert":
        {
            const inserted = normalizeEditorText(action.text);
            return inserted ? replace(state, start, end, inserted) : state;
        }
        case "delete":
        {
            if (start !== end)
            {
                return replace(state, start, end, "");
            }
            const other = moveOffset(state.text, cursor,
                action.direction === "backward" ? "left" : "right", action.word ?? false);
            return other === cursor ? state
                : replace(state, Math.min(cursor, other), Math.max(cursor, other), "");
        }
        case "move":
        {
            let next: number;
            if (action.direction === "home")
            {
                next = 0;
            }
            else if (action.direction === "end")
            {
                next = state.text.length;
            }
            else if (start !== end && !action.select)
            {
                next = action.direction === "left" ? start : end;
            }
            else
            {
                next = moveOffset(state.text, cursor, action.direction, action.word ?? false);
            }
            return { ...state, anchor: action.select ? anchor : next, cursor: next };
        }
        case "history":
        {
            if (state.history.length === 0)
            {
                return state;
            }
            const current = Option.getOrElse(state.historyIndex, () => state.history.length);
            const index = Math.max(0, Math.min(state.history.length,
                current + (action.direction === "older" ? -1 : 1)));
            if (Option.contains(Option.some(current), index))
            {
                return state;
            }
            if (index === state.history.length)
            {
                return { ...state, anchor: snapOffset(state.draft, state.draftAnchor ?? state.draft.length),
                    cursor: snapOffset(state.draft, state.draftCursor ?? state.draft.length),
                    historyIndex: Option.none(), text: state.draft };
            }
            const text = state.history[index];
            return { ...state, anchor: text.length, cursor: text.length,
                draft: Option.isNone(state.historyIndex) ? state.text : state.draft,
                draftAnchor: Option.isNone(state.historyIndex) ? anchor : state.draftAnchor,
                draftCursor: Option.isNone(state.historyIndex) ? cursor : state.draftCursor,
                historyIndex: Option.some(index), text };
        }
        case "commit":
            return { anchor: 0, cursor: 0, draft: "", history: BedrockString.trim(state.text)
                ? [ ...state.history, state.text ] : [ ...state.history ],
            historyIndex: Option.none(), text: "" };
    }
};

/** Convert only editor keys; Enter, completion keys, pane chords and Ctrl+C belong to the caller. */
const editorActionForKey = (input: string, key: Partial<Key>): Option.Option<EditorAction> =>
{
    if (key.eventType === "release")
    {
        return Option.none();
    }
    if (input.length > 1 && /[\r\n\t\u2028\u2029]/.test(input))
    {
        return Option.some({ text: input, type: "insert" });
    }
    if (key.return || key.tab || key.escape || key.pageUp || key.pageDown || key.super || key.hyper)
    {
        return Option.none();
    }
    if (key.home || (key.shift && key.upArrow))
    {
        return Option.some({ direction: "home", select: key.shift, type: "move" });
    }
    if (key.end || (key.shift && key.downArrow))
    {
        return Option.some({ direction: "end", select: key.shift, type: "move" });
    }
    if (key.leftArrow || key.rightArrow)
    {
        return Option.some({ direction: key.leftArrow ? "left" : "right", select: key.shift,
            type: "move", word: key.ctrl || key.meta });
    }
    if (key.backspace || key.delete)
    {
        return Option.some({ direction: key.backspace ? "backward" : "forward",
            type: "delete", word: key.ctrl || key.meta });
    }
    if (!key.ctrl && !key.meta && (key.upArrow || key.downArrow))
    {
        return Option.some({ direction: key.upArrow ? "older" : "newer", type: "history" });
    }
    if (key.meta && !key.ctrl && (input === "b" || input === "f"))
    {
        return Option.some({ direction: input === "b" ? "left" : "right", select: key.shift,
            type: "move", word: true });
    }
    if (!key.ctrl && !key.meta && input && normalizeEditorText(input))
    {
        return Option.some({ text: input, type: "insert" });
    }
    return Option.none();
};

export { editCommand, editorActionForKey, graphemes, normalizeEditorText, snapOffset };
export type { EditorAction };
