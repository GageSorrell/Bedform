/**
 * Classification of `server.properties` lines and the spans of their parts.
 *
 * @module bds-intellisense/Test/Parser.test
 *
 * @file      Parser.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Assert from "node:assert/strict";
import { Parser } from "bds-intellisense";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

/** The machine's BDS installation, used when present. */
const InstalledProperties: string = "C:\\MineCraft\\Server\\server.properties";

test("ParseLine reads an assignment with trimmed key and value spans", () =>
{
    const line: Parser.ParsedLine = Parser.ParseLine("  server-name = Our Server  ", 3);
    Assert.equal(line.Kind, "Entry");
    if (line.Kind !== "Entry")
    {
        return;
    }

    Assert.equal(line.Key, "server-name");
    Assert.equal(line.Value, "Our Server");
    Assert.deepEqual(line.KeySpan, Parser.MakeSpan(3, 2, 13));
    Assert.deepEqual(line.ValueSpan, Parser.MakeSpan(3, 16, 26));
    Assert.equal(line.Separator, 14);
});

test("ParseLine splits at the first equals sign and allows empty values", () =>
{
    const line: Parser.ParsedLine = Parser.ParseLine("level-seed=a=b", 0);
    Assert.equal(line.Kind === "Entry" ? line.Value : undefined, "a=b");

    const empty: Parser.ParsedLine = Parser.ParseLine("level-seed=", 0);
    Assert.equal(empty.Kind === "Entry" ? empty.Value : undefined, "");
    Assert.deepEqual(empty.Kind === "Entry" ? empty.ValueSpan : undefined, Parser.MakeSpan(0, 11, 11));
});

test("ParseLine recognizes comments and disabled assignments inside them", () =>
{
    const plain: Parser.ParsedLine = Parser.ParseLine("# Allowed values: Any positive integer", 0);
    Assert.equal(plain.Kind, "Comment");
    Assert.equal(plain.Kind === "Comment" ? plain.Body : undefined, "Allowed values: Any positive integer");
    Assert.equal(plain.Kind === "Comment" ? plain.Assignment : "missing", undefined);

    const disabled: Parser.ParsedLine = Parser.ParseLine("# server-ip=", 5);
    Assert.equal(disabled.Kind, "Comment");
    const assignment: Parser.Assignment | undefined =
        disabled.Kind === "Comment" ? disabled.Assignment : undefined;

    Assert.equal(assignment?.Key, "server-ip");
    Assert.equal(assignment?.Value, "");
    Assert.deepEqual(assignment?.KeySpan, Parser.MakeSpan(5, 2, 11));
});

test("ParseLine separates blank lines from unreadable ones", () =>
{
    Assert.equal(Parser.ParseLine("   ", 0).Kind, "Blank");

    const invalid: Parser.ParsedLine = Parser.ParseLine("  not a property ", 1);
    Assert.equal(invalid.Kind, "Invalid");
    Assert.deepEqual(invalid.Kind === "Invalid" ? invalid.Span : undefined, Parser.MakeSpan(1, 2, 16));
});

test("ParseDocument numbers lines across every line-ending style", () =>
{
    const document: Parser.ParsedDocument = Parser.ParseDocument("a=1\r\n# note\rb=2\n\nc");
    Assert.deepEqual(
        document.Lines.map((line: Parser.ParsedLine) => line.Kind),
        [ "Entry", "Comment", "Entry", "Blank", "Invalid" ]);

    Assert.deepEqual(
        document.Entries.map((entry: Parser.EntryLine) => [ entry.Line, entry.Key ]),
        [ [ 0, "a" ], [ 2, "b" ] ]);
});

test("the installed server.properties has no unreadable lines", {
    skip: !existsSync(InstalledProperties)
}, async () =>
{
    const document: Parser.ParsedDocument = Parser.ParseDocument(await readFile(InstalledProperties, "utf8"));
    Assert.ok(document.Entries.length > 10);
    Assert.deepEqual(document.Lines.filter((line: Parser.ParsedLine) => line.Kind === "Invalid"), []);
});
