/**
 * Bounded menu and inline-hint presentation without terminal or process side effects.
 *
 * @module bedrock-server-manager/completion-view
 *
 * @file      completion-view.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { graphemes, normalizeEditorText } from "./command-editor.js";
import type { CompletionCandidate } from "./console-state.js";
import type { CompletionState } from "./command-completion.js";
import stringWidth from "string-width";

/** Clip at full grapheme boundaries and optionally reserve a column for a truncation marker. */
const clipColumns = (text: string, columns: number, ellipsis: boolean = false) =>
{
    const width = Number.isFinite(columns) ? Math.max(0, Math.floor(columns)) : 0;
    const clean = normalizeEditorText(text);
    if (stringWidth(clean) <= width)
    {
        return clean;
    }
    const available = Math.max(0, width - (ellipsis ? 1 : 0));
    let result = "";
    let used = 0;
    for (const part of graphemes(clean))
    {
        const size = stringWidth(part.text);
        if (used + size > available)
        {
            break;
        }
        used += size;
        result += part.text;
    }
    return result + (ellipsis && width > 0 ? "…" : "");
};

/** Window candidates around the selection, reserving one bounded row for selected usage. */
const completionMenuRows = (state: CompletionState, columns: number, maxRows: number = 6) =>
{
    const rows = Number.isFinite(maxRows) ? Math.max(0, Math.min(8, Math.floor(maxRows))) : 0;
    if (!state.menuOpen || rows === 0 || columns <= 0)
    {
        return [];
    }
    if (!state.candidates.length)
    {
        return [ { kind: "notice", selected: false, text: clipColumns("No completions", columns, true) } ];
    }
    const count = rows > 1 ? rows - 1 : 1;
    const selected = Math.max(0, Math.min(state.candidates.length - 1, state.selected));
    const first = Math.max(0, Math.min(state.candidates.length - count, selected - Math.floor(count / 2)));
    const visible = state.candidates.slice(first, first + count)
        .map((candidate: CompletionCandidate, offset: number) => ({
            kind: "candidate", selected: first + offset === selected,
            text: clipColumns(`${first + offset === selected ? "›" : " "} ${candidate.value} — ` +
            candidate.description, columns, true)
        }));
    if (rows > 1)
    {
        visible.push({ kind: "usage", selected: false, text: clipColumns(
            `${selected + 1}/${state.candidates.length}  ${state.candidates[selected].usage}`,
            columns, true) });
    }
    return visible;
};

export { clipColumns, completionMenuRows };
