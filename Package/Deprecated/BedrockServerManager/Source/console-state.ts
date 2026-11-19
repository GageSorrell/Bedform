/**
 * Session state shared by the editor, completion engine and console presentation.
 *
 * @module bedrock-server-manager/console-state
 *
 * @file      console-state.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/** Input offsets use UTF-16 boundaries; editor operations must preserve graphemes. */

import { Option } from "effect";
interface EditorState
{
    text: string;
    cursor: number;
    anchor: number;
    history: Array<string>;
    historyIndex: Option.Option<number>;
    draft: string;
    draftCursor?: number;
    draftAnchor?: number;
}

/** A completion replaces one token range without submitting the command. */
interface CompletionCandidate
{
    value: string;
    description: string;
    usage: string;
    start: number;
    end: number;
}

/** Presentation state stays independent of process ownership and terminal streams. */
interface ConsoleState
{
    focus: "input" | "output";
    editor: EditorState;
    completions: Array<CompletionCandidate>;
    selectedCompletion: Option.Option<number>;
}

/** Create fresh session-only state without sharing mutable histories between sessions. */
const createConsoleState = (): ConsoleState => ({
    completions: [],
    editor: { anchor: 0, cursor: 0, draft: "", history: [], historyIndex: Option.none(), text: "" },
    focus: "input",
    selectedCompletion: Option.none()
});

export { createConsoleState };
export type { CompletionCandidate, ConsoleState, EditorState };
