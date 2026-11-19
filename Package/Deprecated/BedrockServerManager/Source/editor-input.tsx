/**
 * Controlled editor rendering, terminal cursor placement and isolated bracketed paste.
 *
 * @module bedrock-server-manager/editor-input
 *
 * @file      editor-input.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Box, Text, useCursor, usePaste } from "ink";
import { useLayoutEffect, useRef } from "react";
import type { CursorPosition } from "ink";
import type { EditorAction } from "./command-editor.js";
import type { EditorCell } from "./editor-viewport.js";
import type { EditorState } from "./console-state.js";
import { clipColumns } from "./completion-view.js";
import { editorViewport } from "./editor-viewport.js";

/** The console supplies origin relative to Ink's output and owns key/focus/completion routing. */
interface EditorInputProps
{
    state: EditorState;
    columns: number;
    origin: CursorPosition;
    focused: boolean;
    onAction: (action: EditorAction) => void;
    suggestion?: string;
}

/** Render a single bounded row without storing or resetting the caller's editing state. */
const EditorInput = ({ state, columns, origin, focused, onAction, suggestion = "" }: EditorInputProps) =>
{
    const previous = useRef({ columns, start: 0 });
    const view = editorViewport(state, columns,
        previous.current.columns === columns ? previous.current.start : 0);
    const { setCursorPosition } = useCursor();
    const ghost = focused && state.cursor === state.text.length && state.anchor === state.cursor
        ? clipColumns(suggestion, view.width - view.cursorColumn) : "";
    const cells = ghost ? view.cells.filter((cell: EditorCell) => !cell.cursor) : view.cells;
    // Keep paste isolated even in OUTPUT mode; it must never reach a command or navigation key handler.
    usePaste((text: string) =>
    {
        if (focused)
        {
            onAction({ text, type: "insert" });
        }
    });
    setCursorPosition(focused && view.width > 0
        ? { x: origin.x + view.cursorColumn, y: origin.y } : undefined);
    useLayoutEffect(() =>
    {
        previous.current = { columns, start: view.start };
    }, [ columns, view.start ]);
    return (
        <Box width={ view.width }
            height={ 1 }
            flexShrink={ 0 }>
            <Text wrap="truncate">
                { cells.map((cell: EditorCell) => (
                    <Text key={ `${cell.start}:${cell.end}` }
                        inverse={ cell.selected || (focused && cell.cursor) }
                        underline={ focused && cell.cursor }>
                        { cell.text }
                    </Text>
                )) }
                { ghost ? <Text dimColor>{ ghost }</Text> : null }
            </Text>
        </Box>
    );
};

export { EditorInput };
export type { EditorInputProps };
