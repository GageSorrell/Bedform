/**
 * Display-column-aware editor viewport and selection/cursor presentation model.
 *
 * @module bedrock-server-manager/editor-viewport
 *
 * @file      editor-viewport.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { graphemes, snapOffset } from "./command-editor.js";
import type { EditorState } from "./console-state.js";
import stringWidth from "string-width";

/** A complete displayed grapheme, or a placeholder when the terminal is too narrow for it. */
interface EditorCell
{
    text: string;
    start: number;
    end: number;
    width: number;
    selected: boolean;
    cursor: boolean;
    clipped: boolean;
}

/** Keep the cursor visible without splitting wide characters or grapheme clusters. */
const editorViewport = (state: EditorState, columns: number, previousStart: number = 0) =>
{
    const width = Number.isFinite(columns) ? Math.max(0, Math.floor(columns)) : 0;
    const cursor = snapOffset(state.text, state.cursor);
    const anchor = snapOffset(state.text, state.anchor);
    const parts = graphemes(state.text).map((part: { start: number; end: number; text: string }) =>
    {
        // A leading combining/format cluster has no printable base; make its cursor cell visible.
        const text = stringWidth(part.text) === 0 ? `◌${part.text}` : part.text;
        return { ...part, text, width: Math.max(1, stringWidth(text)) };
    });
    let cursorIndex = parts.findIndex((part: { start: number }) => part.start === cursor);
    if (cursorIndex === -1)
    {
        cursorIndex = parts.length;
    }
    const offset = snapOffset(state.text, previousStart);
    let first = parts.findIndex((part: { start: number }) => part.start >= offset);
    if (first === -1)
    {
        first = parts.length;
    }
    if (first > cursorIndex)
    {
        first = 0;
    }
    let cursorColumn = parts.slice(first, cursorIndex).reduce((total: number, part: { width: number }) =>
        total + part.width, 0);
    const cursorWidth = Math.min(width, parts[cursorIndex]?.width ?? 1);
    while (first < cursorIndex && cursorColumn + cursorWidth > width)
    {
        cursorColumn -= parts[first++].width;
    }
    const cells: Array<EditorCell> = [];
    let used = 0;
    let last = first;
    for (; last < parts.length && width > 0; last++)
    {
        const part = parts[last];
        const clipped = part.width > width && last === cursorIndex;
        const cellWidth = clipped ? 1 : part.width;
        if (used + cellWidth > width)
        {
            break;
        }
        cells.push({ clipped, cursor: last === cursorIndex, end: part.end,
            selected: part.start >= Math.min(anchor, cursor) && part.end <= Math.max(anchor, cursor),
            start: part.start, text: clipped ? "…" : part.text, width: cellWidth });
        used += cellWidth;
    }
    if (cursorIndex === parts.length && used < width)
    {
        cells.push({ clipped: false, cursor: true, end: cursor, selected: false,
            start: cursor, text: " ", width: 1 });
    }
    return { cells, cursorColumn: Math.max(0, Math.min(Math.max(0, width - 1), cursorColumn)),
        end: parts[last - 1]?.end ?? cursor, leftHidden: first > 0, rightHidden: last < parts.length,
        start: parts[first]?.start ?? state.text.length, width };
};

export { editorViewport };
export type { EditorCell };
