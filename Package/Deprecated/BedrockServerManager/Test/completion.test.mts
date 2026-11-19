/**
 * Offline catalog, quote/cursor-aware replacement, completion state and inline suggestion checks.
 *
 * @module bedrock-server-manager/Test/completion.test
 *
 * @file      completion.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    applyCompletion,
    commandTokens,
    completionCandidates,
    createCompletionState,
    dispatchCompletion,
    inlineSuggestion
} from "../Distribution/command-completion.js";
import { catalogProvenance, commandCatalog } from "../Distribution/command-catalog.js";
import { clipColumns, completionMenuRows } from "../Distribution/completion-view.js";
import type { EditorState } from "../Distribution/console-state.js";
import type { Key } from "ink";
import assert from "node:assert/strict";
import { createConsoleState } from "../Distribution/console-state.js";
import { editCommand } from "../Distribution/command-editor.js";
import stringWidth from "string-width";
import test from "node:test";
import { Option } from "effect";

const editor: (text?: string, cursor?: number, anchor?: number) => EditorState = (
    text: string = "",
    cursor: number = text.length,
    anchor: number = cursor
): EditorState => ({ ...createConsoleState().editor,
    anchor,
    cursor,
    text });
const values: (text: string, cursor?: number) => Array<string> = (
    text: string,
    cursor: number = text.length
) => completionCandidates(editor(text, cursor)).map((candidate) => candidate.value);
type Completion = Parameters<typeof dispatchCompletion>[1];
type CompletionModel = {
    completion: Completion;
    editor: EditorState;
    handled: boolean;
};
const step: (
    model: CompletionModel,
    input: string,
    key: Partial<Key>
) => ReturnType<typeof dispatchCompletion> = (
    model: CompletionModel,
    input: string,
    key: Partial<Key>
): ReturnType<typeof dispatchCompletion> =>
    dispatchCompletion(model.editor, model.completion, input, key);
const model: (text: Option.Option<string>) => CompletionModel = (
    text: Option.Option<string>
): CompletionModel => ({
    completion: createCompletionState(),
    editor: editor(Option.getOrThrow(text)),
    handled: false
});

test("catalog commands and aliases carry descriptions, usage and recorded provenance", () =>
{
    assert.ok(commandCatalog.length > 70);
    const names: Array<string> = commandCatalog.flatMap((entry) => [
        entry.name,
        ...entry.aliases
    ]);
    assert.equal(new Set(names).size, names.length);
    for (const entry of commandCatalog)
    {
        assert.ok(entry.description && entry.source && entry.usage.startsWith(entry.name));
    }

    assert.equal(catalogProvenance.shipped.serverVersion, "1.26.52.3");
    assert.match(catalogProvenance.shipped.sha256, /^[a-f0-9]{64}$/);
    for (const alias of [ "?", "tp", "w", "msg", "ops", "whitelist", "alwaysday", "connect" ])
    {
        const entry = completionCandidates(editor(alias)).find(
            (candidate: { value: string }) => candidate.value === alias
        );
        assert.ok(entry?.description && entry.usage.startsWith(alias));
    }
});

test("command matching is case-insensitive and preserves the optional initial slash", () =>
{
    const input: EditorState = editor("  /WeA");
    const candidate = completionCandidates(input).find(
        (item: { value: string }) => item.value === "weather"
    );
    assert.ok(candidate);
    assert.equal(candidate.start, 3);
    assert.equal(candidate.end, input.text.length);
    assert.equal(applyCompletion(input, candidate).text, "  /weather");
    assert.ok(values("/whi").includes("whitelist"));
    assert.ok(values("/w").includes("w"));
});

test("administration, difficulty, gamemode, time, weather and gamerule hints follow documented enums", () =>
{
    const cases: Array<[string, Array<string>]> = [
        [ "allowlist ", [ "add", "remove", "on", "off", "list", "reload" ] ],
        [ "whitelist ", [ "add", "remove" ] ],
        [ "permission ", [ "list", "reload" ] ],
        [ "ops ", [ "list", "reload" ] ],
        [ "save ", [ "hold", "resume", "query" ] ],
        [ "serveridentity ", [ "save", "delete", "status" ] ],
        [ "changesetting ", [ "allow-cheats", "difficulty" ] ],
        [ "changesetting allow-cheats ", [ "true", "false" ] ],
        [ "changesetting difficulty ", [ "peaceful", "hard", "3" ] ],
        [ "difficulty ", [ "peaceful", "easy", "normal", "hard", "p", "3" ] ],
        [ "gamemode ", [ "survival", "creative", "spectator", "s", "c" ] ],
        [ "time ", [ "add", "set", "query" ] ],
        [ "time set ", [ "day", "night", "midnight" ] ],
        [ "time query ", [ "day", "daytime", "gametime" ] ],
        [ "weather ", [ "clear", "rain", "thunder", "query" ] ],
        [ "gamerule do", [ "dodaylightcycle", "doweathercycle" ] ],
        [ "gamerule KEEPINVENTORY ", [ "false", "true" ] ],
        [ "gamerule playerwaypoints ", [ "everyone", "off" ] ],
        [ "alwaysday ", [ "true", "false" ] ]
    ];
    for (const [ input, expected ] of cases)
    {
        for (const value of expected)
        {
            assert.ok(values(input).includes(value), `${input}: ${value}`);
        }
    }

    assert.deepEqual(values("gamerule randomtickspeed "), []);
    assert.deepEqual(values("gamerule arbitrary_addon_rule "), []);
    assert.ok(values("help whi").includes("whitelist"));
});

test("selectors appear only in recognized target positions without dynamic player/item lookup", () =>
{
    for (const input of [
        "give @",
        "kill @",
        "tell @",
        "msg @",
        "gamemode creative @",
        "tp @",
        "tp @a @"
    ])
    {
        assert.ok(values(input).includes("@a"), input);
        assert.ok(values(input).includes("@p"), input);
    }

    for (const input of [
        "say @",
        "give @a ",
        "allowlist add ",
        "kick ",
        "unknown @",
        "time add ",
        "tp ~ @"
    ])
    {
        assert.deepEqual(values(input), [], input);
    }

    assert.deepEqual(values("give @e[name=\"Two Players\"] minecraft:"), []);
});

test("quoted replacement spans preserve quoting, suffix arguments and Unicode neighbors", () =>
{
    for (const text of [
        "difficulty \"ha\" trailing",
        "difficulty \"ha",
        "difficulty 'ha' trailing"
    ])
    {
        const cursor: number = text.indexOf("ha") + 2;
        const state: EditorState = editor(text, cursor);
        const candidate = completionCandidates(state).find((item) =>
            item.value.includes("hard")
        );
        assert.ok(candidate);
        assert.equal(candidate.start, text.indexOf("ha") - 1);
        const next: EditorState = applyCompletion(state, candidate);
        assert.equal(
            next.text,
            text.startsWith("difficulty \"")
                ? `difficulty "hard"${text.endsWith("trailing") ? " trailing" : ""}`
                : "difficulty 'hard' trailing"
        );
    }

    const text = "/GaMeMoDe crZZ \"玩家 👨‍👩‍👧‍👦\"";
    const state: EditorState = editor(text, text.indexOf("cr") + 2);
    const candidate = completionCandidates(state).find(
        (item: { value: string }) => item.value === "creative"
    );
    assert.ok(candidate);
    assert.equal(applyCompletion(state, candidate).text, "/GaMeMoDe creative \"玩家 👨‍👩‍👧‍👦\"");
    assert.equal(state.text, text);
});

test("lexer keeps quoted names, escaped quotes and bracketed selector/JSON arguments opaque", () =>
{
    const tokens: Array<{
        start: number;
        end: number;
        value: string;
        quote: string;
    }> = commandTokens("tell \"A \\\"Name\\\"\" @e[name=\"A B\"] {\"text\": \"hello world\"}");
    assert.equal(tokens[0].value, "tell");
    assert.equal(tokens[1].value, "A \"Name\"");
    assert.equal(tokens.length, 4);
    assert.equal(tokens[2].value, "@e[name=\"A B\"]");
    assert.equal(tokens[3].value, "{\"text\": \"hello world\"}");
    assert.deepEqual(values("tell \"Some Player\" hello"), []);
});

test("mid-input completion can insert into whitespace without deleting following arguments", () =>
{
    const text = "gamemode   @a";
    const cursor: number = "gamemode ".length;
    const state: EditorState = editor(text, cursor);
    const candidate = completionCandidates(state).find(
        (item: { value: string }) => item.value === "creative"
    );
    assert.ok(candidate);
    assert.equal(applyCompletion(state, candidate).text, "gamemode creative  @a");
});

test("Tab cycles original token replacements forward/reverse across unequal lengths", () =>
{
    let current: ReturnType<typeof dispatchCompletion> = model(Option.some("time s"));
    const candidates: Array<string> = values("time ");
    current = model(Option.some("time "));
    for (let index: number = 0; index < candidates.length + 2; index++)
    {
        current = step(current, "", { tab: true });
        assert.equal(current.editor.text, `time ${candidates[index % candidates.length]}`);
        assert.equal(current.handled, true);
    }

    current = step(current, "", { shift: true,
        tab: true });
    assert.equal(current.editor.text, `time ${candidates[0]}`);
    const reverse = step(model(Option.some("time ")), "", { shift: true,
        tab: true });
    assert.equal(reverse.editor.text, "time set");
    const changed = { ...current,
        editor: editor("weather r") };
    assert.equal(step(changed, "", { tab: true }).editor.text, "weather rain");
});

test("menu arrows wrap and Enter accepts without committing or allowing submission", () =>
{
    let current = step(model(Option.some("time ")), " ", { ctrl: true });
    assert.equal(current.completion.menuOpen, true);
    current = step(current, "", { downArrow: true });
    assert.equal(current.completion.selected, 1);
    const rows: Array<{ kind: string;
        selected: boolean;
        text: string }> = completionMenuRows(
        current.completion,
        70
    );
    assert.ok(
        rows.some(
            (row: { kind: string;
                selected: boolean;
                text: string }) =>
                row.selected && row.text.includes("query")
        )
    );
    current = step(current, "", { return: true });
    assert.equal(current.handled, true);
    assert.equal(current.editor.text, "time query");
    assert.deepEqual(current.editor.history, []);
    assert.equal(current.completion.menuOpen, false);
    assert.equal(step(current, "", { return: true }).handled, false);
    const escaped = step(step(model(Option.some("time ")), "space", { ctrl: true }), "", {
        escape: true
    });
    assert.equal(escaped.handled, true);
    assert.equal(escaped.editor.text, "time ");
    assert.equal(escaped.completion.menuOpen, false);
});

test("menu windows and descriptions/usage stay within row and column budgets", () =>
{
    let current = step(model(Option.some("")), "`", { ctrl: true });
    for (let index: number = 0; index < 40; index++)
    {
        current = step(current, "", { downArrow: true });
    }

    for (const maxRows of [ 0, 1, 2, 4, 6, 100 ])
    {
        for (const columns of [ 0, 1, 8, 30, 80 ])
        {
            const rows: Array<{ kind: string;
                selected: boolean;
                text: string }> =
                completionMenuRows(current.completion, columns, maxRows);
            assert.ok(rows.length <= Math.min(8, maxRows));
            assert.ok(rows.every((row: { text: string }) => stringWidth(row.text) <= columns));
            if (rows.length)
            {
                assert.equal(
                    rows.filter(
                        (row: { kind: string;
                            selected: boolean;
                            text: string }) =>
                            row.selected
                    ).length,
                    1
                );
            }
        }
    }

    const rows: Array<{ kind: string;
        selected: boolean;
        text: string }> = completionMenuRows(
        step(model(Option.some("wea")), " ", { ctrl: true }).completion,
        80
    );
    assert.ok(
        rows.some((row: { text: string | Array<string> }) =>
            row.text.includes("Weather control")
        )
    );
    assert.ok(
        rows.some(
            (row: { kind: string;
                text: string | Array<string> }) =>
                row.kind === "usage" && row.text.includes("weather <")
        )
    );
});

test("empty menus swallow Enter, and unrelated editing dismisses stale menu/cycle state", () =>
{
    let current = step(model(Option.some("my_unknown_command ")), " ", { ctrl: true });
    assert.equal(completionMenuRows(current.completion, 20)[0].text, "No completions");
    current = step(current, "", { return: true });
    assert.equal(current.handled, true);
    assert.equal(current.editor.text, "my_unknown_command ");
    current = step(step(model(Option.some("wea")), " ", { ctrl: true }), "x", {});
    assert.equal(current.handled, false);
    assert.equal(current.completion.menuOpen, false);
});

test("history-first ghosts prefer the most recent safe prefix match, preserving slash and typed case", () =>
{
    const state: {
        history: Array<string>;
        text: string;
        cursor: number;
        anchor: number;
        historyIndex: Option.Option<number>;
        draft: string;
        draftCursor?: number;
        draftAnchor?: number;
    } = {
        ...editor("/Wea"),
        history: [ "weather clear", "weather rain", "weather\nstop" ]
    };
    assert.equal(inlineSuggestion(state), "ther rain");
    const accepted = dispatchCompletion(state, createCompletionState(), "", {
        rightArrow: true
    });
    assert.equal(accepted.handled, true);
    assert.equal(accepted.editor.text, "/Weather rain");
    assert.deepEqual(accepted.editor.history, state.history);
    assert.equal(inlineSuggestion(editor("wea")), "ther");
    assert.equal(
        inlineSuggestion({ ...editor("say "),
            history: [ "/say hello world" ] }),
        "hello world"
    );
});

test("Right only accepts a whole suffix at end with no selection or modifiers", () =>
{
    const cases: Array<[EditorState, Partial<Key>]> = [
        [ editor("weather", 2), { rightArrow: true } ],
        [ editor("wea", 3, 0), { rightArrow: true } ],
        [ editor("wea"), { rightArrow: true,
            shift: true } ],
        [ editor("wea"), { ctrl: true,
            rightArrow: true } ]
    ];
    for (const [ state, key ] of cases)
    {
        assert.equal(
            dispatchCompletion(state, createCompletionState(), "", key).handled,
            false
        );
    }

    assert.equal(inlineSuggestion(editor("weather", 2)), "");
    assert.equal(inlineSuggestion(editor("wea", 3, 0)), "");
    const state: EditorState = editor("weather", 2);
    const result = dispatchCompletion(state, createCompletionState(), "", {
        rightArrow: true
    });
    assert.equal(editCommand(result.editor, { direction: "right",
        type: "move" }).cursor, 3);
});

test("unknown input and selected text pass through without mutation or validation", () =>
{
    const state: EditorState = editor("new_addon_command \"arbitrary argument\"");
    const result = dispatchCompletion(state, createCompletionState(), "", {
        return: true
    });
    assert.equal(result.handled, false);
    assert.equal(result.editor, state);
    assert.deepEqual(completionCandidates(state), []);
    assert.deepEqual(completionCandidates(editor("wea", 3, 0)), []);
    assert.equal(clipColumns("👨‍👩‍👧‍👦界abc", 3, true), "👨‍👩‍👧‍👦…");
});
