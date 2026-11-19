/**
 * Validation, completion and hover against the fixture catalog.
 *
 * @module bds-intellisense/Test/Analysis.test
 *
 * @file      Analysis.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Analysis, Keys, Parser, Schema } from "bds-intellisense";
import Assert from "node:assert/strict";
import { Catalog } from "./Fixture.mts";
import { test } from "node:test";

/** The fixture's 1.16.0 schema. */
const Oldest: Schema.ServerPropertiesSchema = Catalog.Oldest;

/** The fixture's 1.26.0 schema. */
const Latest: Schema.ServerPropertiesSchema = Catalog.Latest;

/**
 * Validates text under a schema of the fixture catalog.
 */
function Check(text: string, schema: Schema.ServerPropertiesSchema = Latest): Array<Analysis.Diagnostic>
{
    return Analysis.Validate(Parser.ParseDocument(text), schema, Catalog);
}

/**
 * Summarizes diagnostics as `line:code:key` strings for comparison.
 */
function Codes(diagnostics: ReadonlyArray<Analysis.Diagnostic>): Array<string>
{
    return diagnostics.map((diagnostic: Analysis.Diagnostic) =>
        `${diagnostic.Span.Line}:${diagnostic.Code}:${diagnostic.Key ?? ""}`);
}

/**
 * Labels of the proposals at a position.
 */
function Labels(text: string, line: number, character: number): Array<string> | undefined
{
    const position: Analysis.Position = {
        Character: character,
        Line: line
    };

    return Analysis.Complete(Parser.ParseDocument(text), position, Latest)?.Items
        .map((item: Analysis.CompletionItem) => item.Label);
}

test("a valid document has no diagnostics", () =>
{
    const text: string = [
        "server-name=Our Server",
        "# A comment, and a disabled assignment that is not checked:",
        "# gamemode=nonsense",
        "gamemode=creative",
        "allow-cheats=true",
        "server-port=19132",
        "server-build-radius-ratio=0.5",
        "transport=raknet",
        "server-udp-ports=49152-49200",
        "server-udp-ports=19132:32000",
        ""
    ].join("\n");

    Assert.deepEqual(Check(text), []);
});

test("Validate reports typos, bad values, duplicates and unreadable lines", () =>
{
    const text: string = [
        "gamemod=survival",
        "gamemode=Creative",
        "server-port=70000",
        "allow-cheats=True",
        "server-name=A;B",
        "gamemode=adventure",
        "=orphan",
        "what is this",
        "server-build-radius-ratio=disabled",
        "server-port="
    ].join("\n");

    const diagnostics: Array<Analysis.Diagnostic> = Check(text);
    Assert.deepEqual(Codes(diagnostics), [
        `0:${Keys.DiagnosticCode.UnknownProperty}:gamemod`,
        `1:${Keys.DiagnosticCode.InvalidValue}:gamemode`,
        `2:${Keys.DiagnosticCode.InvalidValue}:server-port`,
        `3:${Keys.DiagnosticCode.InvalidValue}:allow-cheats`,
        `4:${Keys.DiagnosticCode.ForbiddenCharacter}:server-name`,
        `5:${Keys.DiagnosticCode.DuplicateProperty}:gamemode`,
        `6:${Keys.DiagnosticCode.EmptyKey}:`,
        `7:${Keys.DiagnosticCode.InvalidLine}:`,
        `8:${Keys.DiagnosticCode.InvalidValue}:server-build-radius-ratio`,
        `9:${Keys.DiagnosticCode.DuplicateProperty}:server-port`,
        `9:${Keys.DiagnosticCode.EmptyValue}:server-port`
    ]);

    Assert.deepEqual(diagnostics[0].Suggestions, [ "gamemode" ]);
    Assert.match(diagnostics[0].Message, /Did you mean `gamemode`\?/u);
    Assert.deepEqual(diagnostics[1].Suggestions, [ "creative" ]);
    Assert.deepEqual(diagnostics[1].Span, Parser.MakeSpan(1, 9, 17));
    Assert.equal(diagnostics[2].Message, "`server-port` must be an integer between 1 and 65535.");
    Assert.deepEqual(diagnostics[3].Suggestions, [ "true" ]);
    Assert.deepEqual(diagnostics[4].Suggestions, [ "AB" ]);
    Assert.match(diagnostics[5].Message, /already set on line 2/u);
    Assert.deepEqual(diagnostics[8].Suggestions, [ "Disabled" ]);
    Assert.deepEqual(diagnostics[10].Suggestions, [ "19132" ]);
    Assert.equal(diagnostics[10].Severity, "Warning");
    Assert.ok(diagnostics.every((diagnostic: Analysis.Diagnostic) =>
        diagnostic.Source === Keys.DiagnosticSource));
});

test("Validate reports keys of other releases as unsupported rather than unknown", () =>
{
    const old: Array<Analysis.Diagnostic> = Check("transport=raknet\nlegacy-option=true", Oldest);
    Assert.deepEqual(Codes(old), [ `0:${Keys.DiagnosticCode.UnsupportedProperty}:transport` ]);
    Assert.equal(
        old[0].Message,
        "`transport` is not supported by BDS 1.16.0; it is available in 1.26.0 and later.");

    const latest: Array<Analysis.Diagnostic> = Check("legacy-option=true");
    Assert.match(latest[0].Message, /available in 1\.16\.0 until 1\.20\.0/u);

    const withoutCatalog: Array<Analysis.Diagnostic> =
        Analysis.Validate(Parser.ParseDocument("transport=raknet"), Oldest);

    Assert.deepEqual(Codes(withoutCatalog), [ `0:${Keys.DiagnosticCode.UnknownProperty}:transport` ]);
});

test("Complete proposes whole assignments on an empty line, omitting keys already set", () =>
{
    const document: Parser.ParsedDocument = Parser.ParseDocument("gamemode=survival\n\nserver-udp-ports=1");
    const result: Analysis.CompletionResult | undefined = Analysis.Complete(document, {
        Character: 0,
        Line: 1
    }, Latest);

    Assert.ok(result !== undefined);
    const labels: Array<string> = result.Items.map((item: Analysis.CompletionItem) => item.Label);
    Assert.ok(!labels.includes("gamemode"), "already set");
    Assert.ok(labels.includes("server-udp-ports"), "repeatable");
    Assert.deepEqual(result.Span, Parser.MakeSpan(1, 0, 0));

    const transport: Analysis.CompletionItem | undefined = result.Items.find(
        (item: Analysis.CompletionItem) => item.Label === "transport");

    Assert.equal(transport?.InsertText, "transport=${1|nethernet,raknet|}");
    Assert.equal(transport?.IsSnippet, true);
    Assert.equal(transport?.Detail, "Default: nethernet");

    const name: Analysis.CompletionItem | undefined = result.Items.find(
        (item: Analysis.CompletionItem) => item.Label === "server-name");

    Assert.equal(name?.InsertText, "server-name=${1:Dedicated Server}");
});

test("Complete replaces only the key when the line already has an equals sign", () =>
{
    const result: Analysis.CompletionResult | undefined = Analysis.Complete(
        Parser.ParseDocument("game=creative"),
        {
            Character: 2,
            Line: 0
        },
        Latest);

    Assert.deepEqual(result?.Span, Parser.MakeSpan(0, 0, 4));
    const gamemode: Analysis.CompletionItem | undefined = result?.Items.find(
        (item: Analysis.CompletionItem) => item.Label === "gamemode");

    Assert.equal(gamemode?.InsertText, "gamemode");
    Assert.equal(gamemode?.IsSnippet, false);
});

test("Complete proposes values after the equals sign", () =>
{
    Assert.deepEqual(Labels("gamemode=", 0, 9), [ "survival", "creative", "adventure" ]);
    Assert.deepEqual(Labels("allow-cheats=tr", 0, 15), [ "true", "false" ]);
    Assert.deepEqual(Labels("server-build-radius-ratio=", 0, 26), [ "Disabled" ]);
    Assert.deepEqual(Labels("server-port=", 0, 12), [ "19132" ]);
    Assert.equal(Labels("no-such-key=", 0, 12), undefined);
    Assert.equal(Labels("# gamemode=", 0, 11), undefined);

    const result: Analysis.CompletionResult | undefined = Analysis.Complete(
        Parser.ParseDocument("gamemode=surv"),
        {
            Character: 13,
            Line: 0
        },
        Latest);

    Assert.deepEqual(result?.Span, Parser.MakeSpan(0, 9, 13));
    Assert.equal(result?.Items[0].Detail, "Default");
});

test("Hover describes properties in assignments and disabled assignments", () =>
{
    const document: Parser.ParsedDocument = Parser.ParseDocument("gamemode=creative\n# transport=raknet\n");
    const onKey: Analysis.HoverResult | undefined = Analysis.Hover(document, {
        Character: 3,
        Line: 0
    }, Latest, Catalog);

    Assert.deepEqual(onKey?.Span, Parser.MakeSpan(0, 0, 8));
    Assert.match(onKey?.Markdown ?? "", /^\*\*`gamemode`\*\*/u);
    Assert.match(onKey?.Markdown ?? "", /\*\*Default:\*\* `survival`/u);
    Assert.doesNotMatch(onKey?.Markdown ?? "", /Available in/u, "defined by every schema");

    const onValue: Analysis.HoverResult | undefined = Analysis.Hover(document, {
        Character: 12,
        Line: 0
    }, Latest, Catalog);

    Assert.equal(onValue?.Markdown, onKey?.Markdown);

    const commented: Analysis.HoverResult | undefined = Analysis.Hover(document, {
        Character: 4,
        Line: 1
    }, Latest, Catalog);

    Assert.match(commented?.Markdown ?? "", /\*Available in BDS 1\.26\.0 and later\.\*/u);

    const unsupported: Analysis.HoverResult | undefined = Analysis.Hover(document, {
        Character: 4,
        Line: 1
    }, Oldest, Catalog);

    Assert.match(
        unsupported?.Markdown ?? "",
        /Not supported by BDS 1\.16\.0; available in 1\.26\.0 and later\./u);

    Assert.equal(Analysis.Hover(document, {
        Character: 0,
        Line: 2
    }, Latest, Catalog), undefined);
});

test("PropertyMarkdown keeps the default file's line breaks", () =>
{
    const property: Schema.PropertySchema | undefined = Schema.FindProperty(Latest, "server-udp-ports");

    Assert.ok(property !== undefined);
    Assert.match(Analysis.PropertyMarkdown(property), /ports\. {2}\n {2}\* `internal`/u);
});
