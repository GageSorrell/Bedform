/**
 * Quote/cursor-aware static token completion and non-submitting completion dispatch.
 *
 * @module bedrock-server-manager/command-completion
 *
 * @file      command-completion.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { CompletionCandidate, EditorState } from "./console-state.js";
import { argumentHints, commandCatalog } from "./command-catalog.js";
import { editCommand, normalizeEditorText, snapOffset } from "./command-editor.js";
import type { CommandEntry } from "./command-catalog.js";
import type { Key } from "ink";

/** Tokenization preserves raw spans; quoted names and selector/JSON contents remain opaque. */
const commandTokens = (text: string) =>
{
    const tokens: Array<{ start: number; end: number; value: string; quote: string }> = [];
    let index = 0;
    while (index < text.length)
    {
        if (/\s/.test(text[index]))
        {
            index++;
            continue;
        }
        const start = index;
        let quote = "";
        let depth = 0;
        for (; index < text.length; index++)
        {
            const character = text[index];
            if (quote)
            {
                if (character === "\\")
                {
                    index++;
                }
                else if (character === quote)
                {
                    quote = "";
                }
            }
            else if (character === "\"" || character === "'")
            {
                quote = character;
            }
            else if (character === "[" || character === "{")
            {
                depth++;
            }
            else if (character === "]" || character === "}")
            {
                depth = Math.max(0, depth - 1);
            }
            else if (depth === 0 && /\s/.test(character))
            {
                break;
            }
        }
        const end = Math.min(index, text.length);
        const raw = text.slice(start, end);
        const outer = BedrockString.startsWith("\"")(raw) || BedrockString.startsWith("'")(raw) ? raw[0] : "";
        const value = outer ? raw.slice(1, raw.endsWith(outer) && raw.length > 1 ? -1 : undefined) : raw;
        tokens.push({ end, quote: outer, start, value: BedrockString.replace(/\\(["'\\])/g, "$1")(value) });
    }
    return tokens;
};

/** Return replacements only for the token under the cursor; preserve all other input byte-for-byte. */
const completionCandidates = (editor: EditorState): Array<CompletionCandidate> =>
{
    if (editor.cursor !== editor.anchor)
    {
        return [];
    }
    const cursor = snapOffset(editor.text, editor.cursor);
    const tokens = commandTokens(editor.text);
    let tokenIndex = tokens.findIndex((token: { start: number; end: number }) =>
        token.start <= cursor && cursor <= token.end);
    if (tokenIndex === -1)
    {
        tokenIndex = tokens.filter((token: { end: number }) => token.end < cursor).length;
    }
    const token = tokens[tokenIndex]?.start <= cursor ? tokens[tokenIndex] : undefined;
    let start = token?.start ?? cursor;
    const end = token?.end ?? cursor;
    const quote = token?.quote ?? "";
    let prefix = editor.text.slice(start + quote.length, Math.min(cursor, end));
    if (quote && prefix.endsWith(quote))
    {
        prefix = BedrockString.slice(0, -1)(prefix);
    }
    prefix = BedrockString.replace(/\\(["'\\])/g, "$1")(prefix);
    if (tokenIndex === 0 && !quote && editor.text[start] === "/")
    {
        start++;
        prefix = BedrockString.slice(1)(prefix);
    }
    const command = tokens[0]?.value.replace(/^\//, "").toLowerCase();
    const entry = commandCatalog.find((item: CommandEntry) => item.name === command ||
        item.aliases.includes(command));
    const choices = tokenIndex === 0 ? commandCatalog.flatMap((item: CommandEntry) =>
        [ item.name, ...item.aliases ].map((value: string) => ({ description: item.description,
            usage: item.usage.replace(item.name, value), value })))
        : entry ? argumentHints(entry.name, tokens.slice(1).map((item: { value: string }) => item.value),
            tokenIndex - 1).map((item: { value: string; description: string }) =>
            ({ ...item, usage: entry.usage }))
            : [];
    return choices.filter((item: { value: string }) =>
        BedrockString.toLowerCase(item.value).startsWith(BedrockString.toLowerCase(prefix)))
        .sort((left: { value: string }, right: { value: string }) =>
            left.value < right.value ? -1 : left.value > right.value ? 1 : 0)
        .map((item: { value: string; description: string; usage: string }) => ({ ...item, end, start,
            value: quote ? `${quote}${item.value}${quote}` : item.value }));
};

const applyCompletion = (editor: EditorState, candidate: CompletionCandidate) =>
    editCommand({ ...editor, anchor: candidate.start, cursor: candidate.end },
        { text: candidate.value, type: "insert" });

/** End-of-input suggestions append text; the typed prefix and its casing are never rewritten. */
const inlineSuggestion = (editor: EditorState): string =>
{
    if (!editor.text || editor.cursor !== editor.text.length || editor.anchor !== editor.cursor)
    {
        return "";
    }
    const suffix = (candidate: string) => candidate.length > editor.text.length &&
        BedrockString.toLowerCase(candidate.slice(0, editor.text.length)) === BedrockString.toLowerCase(editor.text)
        ? candidate.slice(editor.text.length) : "";
    for (let index = editor.history.length - 1; index >= 0; index--)
    {
        let candidate = editor.history[index];
        if (normalizeEditorText(candidate) !== candidate)
        {
            continue;
        }
        if (BedrockString.startsWith("/")(editor.text) && !BedrockString.startsWith("/")(candidate))
        {
            candidate = `/${candidate}`;
        }
        else if (!BedrockString.startsWith("/")(editor.text) && BedrockString.startsWith("/")(candidate))
        {
            candidate = BedrockString.slice(1)(candidate);
        }
        const suggestion = suffix(candidate);
        if (suggestion)
        {
            return suggestion;
        }
    }
    for (const candidate of completionCandidates(editor))
    {
        const suggestion = suffix(applyCompletion(editor, candidate).text);
        if (suggestion)
        {
            return suggestion;
        }
    }
    return "";
};

/** A Tab cycle retains the original token span even when replacement lengths change. */
interface CompletionState
{
    menuOpen: boolean;
    candidates: Array<CompletionCandidate>;
    selected: number;
    base?: EditorState;
    snapshot?: string;
}
const createCompletionState = (): CompletionState => ({ candidates: [], menuOpen: false, selected: 0 });
const fingerprint = (editor: EditorState) => JSON.stringify([ editor.text, editor.cursor, editor.anchor ]);

/** Handle completion keys before ordinary editing; handled Enter always accepts without submitting. */
const dispatchCompletion = (editor: EditorState, previous: CompletionState,
    input: string, key: Partial<Key>) =>
{
    let completion = previous.snapshot === fingerprint(editor) ? previous : createCompletionState();
    const result = (next: EditorState, handled: boolean) => ({ completion, editor: next, handled });
    if (key.eventType === "release")
    {
        return result(editor, false);
    }
    const unmodified = !key.ctrl && !key.meta && !key.shift && !key.super && !key.hyper;
    if (key.ctrl && !key.meta && !key.shift && [ " ", "space", "`", "\0" ].includes(input))
    {
        completion = { base: editor, candidates: completionCandidates(editor), menuOpen: true,
            selected: 0, snapshot: fingerprint(editor) };
        return result(editor, true);
    }
    if (key.tab && !key.ctrl && !key.meta)
    {
        const continuing = completion.base && !completion.menuOpen && completion.candidates.length > 0;
        const base = continuing ? completion.base! : editor;
        const candidates = continuing ? completion.candidates : completionCandidates(editor);
        const selected = candidates.length === 0 ? 0 : continuing
            ? (completion.selected + (key.shift ? -1 : 1) + candidates.length) % candidates.length
            : key.shift ? candidates.length - 1 : 0;
        const next = candidates.length ? applyCompletion(base, candidates[selected]) : editor;
        completion = { base, candidates, menuOpen: false, selected, snapshot: fingerprint(next) };
        return result(next, true);
    }
    if (completion.menuOpen)
    {
        if (key.escape)
        {
            completion = createCompletionState();
            return result(editor, true);
        }
        if (unmodified && (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow))
        {
            const count = completion.candidates.length;
            completion = { ...completion, selected: count
                ? (completion.selected + (key.upArrow || key.leftArrow ? -1 : 1) + count) % count : 0 };
            return result(editor, true);
        }
        if (key.return && unmodified)
        {
            const candidate = completion.candidates[completion.selected];
            completion = createCompletionState();
            return result(candidate ? applyCompletion(editor, candidate) : editor, true);
        }
    }
    if (key.rightArrow && unmodified)
    {
        const suggestion = inlineSuggestion(editor);
        if (suggestion)
        {
            completion = createCompletionState();
            return result(editCommand(editor, { text: suggestion, type: "insert" }), true);
        }
    }
    completion = createCompletionState();
    return result(editor, false);
};

export { applyCompletion, commandTokens, completionCandidates, createCompletionState,
    dispatchCompletion, inlineSuggestion };
export type { CompletionState };
