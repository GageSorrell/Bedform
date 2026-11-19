/**
 * Differential font-table and pure layout qualification, including override precedence and Unicode.
 *
 * @module bedform/Test/Measurement.test
 *
 * @file      Measurement.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Test callbacks retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef */

import * as Measurement from "../Source/Spatial/Measurement.js";
import * as Metrics from "../Source/Spatial/Internal/TextMetrics.generated.js";
import { Generate, ReadArchive, ReadLargeFontTable } from "../Tool/TextMetrics.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("captured client tables match every demo advance and retain presence provenance", () =>
{
    const source = readFileSync(new URL("../../../Addon/DduiImageDemo/Source/GlyphWidths.js",
        import.meta.url),
    "utf8");
    for (const name of [ "LargeFontCharacters", "LargeFontWidths", "UnicodeFontWidthTable" ] as const)
    {
        const tail = source.slice(source.indexOf(`export const ${name} =`) + `export const ${name} =`.length);
        const expression = /^\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+);/u.exec(tail)![1];
        const value = [ ...expression.matchAll(/"(?:[^"\\]|\\.)*"/gu) ]
            .map((part) => JSON.parse(part[0])).join("");
        assert.equal(Metrics[name], value, name);
    }

    assert.equal(Metrics.LargeFontCharacters.length, 438);
    assert.equal(Metrics.UnicodeFontWidthTable.length, 65_536);
    assert.equal(Metrics.UnicodeFontPresence.length, 16_384);
    assert.match(Metrics.Client, /^\d+\.\d+\.\d+\.\d+$/u);
    assert.match(Metrics.Classification, /alpha above zero/u);
    const ten = readFileSync(new URL("../../../Addon/DduiImageDemo/Source/MinecraftTenWidths.js",
        import.meta.url), "utf8");
    assert.equal(Metrics.TenAdvances, JSON.parse(/MinecraftTenAdvances = (".*");/u.exec(ten)![1]));
});

test("font selection is per line and counts supplementary code points exactly once", () =>
{
    assert.equal(Measurement.UsesLargeFont("§aAa│"), true);
    assert.equal(Measurement.UsesLargeFont("Aa∣"), false);
    assert.equal(Measurement.LineWidth("a"), 6);
    assert.equal(Measurement.LineWidth("a", { Font: "Mojangles" }), 4);
    assert.equal(Measurement.LineWidth("a∣"), Measurement.GlyphWidth(0x61, "Mojangles") +
        Measurement.GlyphWidth(0x2223, "Mojangles"));
    assert.equal(Measurement.LineWidth("😀a"), 13);
    assert.equal(Measurement.LineWidth("\uD800a"), 13);
    assert.equal(Measurement.GlyphWidth(0x1_FB_00), Metrics.MissingGlyphWidth);
    assert.equal(Measurement.LineWidth("SOS", { Font: "Ten" }),
        Measurement.GlyphWidth(0x53, "Ten") * 2 + Measurement.GlyphWidth(0x4F, "Ten"));
    assert.equal(Measurement.GlyphWidth(0x61, "Ten"), Metrics.MissingGlyphWidth);
    assert.throws(() => Measurement.LineWidth("§lBold"), /does not support/u);
});

test("native presence excludes missing, surrogate and supplementary cells without aliasing", () =>
{
    for (const code of [ 0x20, 0x41, 0x391, 0x2592, 0xE0_00 ])
    {
        assert.equal(Measurement.HasGlyph(code), true);
    }

    for (const code of [ -1, 0.5, 0x378, 0x379, 0x38B, 0xD8_00, 0xE2_00, 0x1_00_41, 0x1_FB_00 ])
    {
        assert.equal(Measurement.HasGlyph(code), false);
    }

    assert.equal(Measurement.HasGlyph(0x2502, "Legacy"), true);
    assert.equal(Measurement.HasGlyph(0x2223, "Legacy"), false);
    assert.equal(Measurement.GlyphWidth(0xE2_00, "Mojangles"), Metrics.MissingGlyphWidth);
});

test("byte counting includes codes and handles NUL, lone surrogates and native boundaries", () =>
{
    for (const text of [ "", "abc", "§a😀\uE200", "\uD800a", "\u0000" ])
    {
        assert.equal(Measurement.Utf8Bytes(text), Buffer.byteLength(text));
    }

    assert.equal(Measurement.LongestLineBytes("x\n" + "a".repeat(128)), 128);
    assert.equal(Measurement.LongestLineBytes("\uE200".repeat(43)), 129);
    assert.deepEqual(Measurement.MeasureText("a\nb\u0000longer\nmore"), { Lines: 2,
        Width: 6 });
});

test("wrapping preserves explicit lines and leaves overwide words intact; pads even centering", () =>
{
    assert.equal(Measurement.WrapText("aa aa aa", 28), "aa aa\naa");
    assert.equal(Measurement.WrapText("aaaa b\n\nx", 6), "aaaa\nb\n\nx");
    assert.throws(() => Measurement.WrapText("a", 0), RangeError);
    for (const line of [ "a", "i", "hello", "a∣", "\u2800i", "😀" ])
    {
        assert.equal(Measurement.LineWidth(line + Measurement.EvenPad(line)) % 2, 0);
    }
});

test("overrides take precedence for every font and flow through wrapping and padding", () =>
{
    for (const font of [ "Auto", "Mojangles", "Legacy", "Ten" ] as const)
    {
        assert.equal(Measurement.LineWidth("§ltranslated", { Font: font,
            Override: (text, selected) =>
            {
                assert.equal(text, "§ltranslated");
                assert.equal(selected, font);
                return 17;
            } }), 17);
    }

    const options = { Override: (text: string): number => text.length };
    assert.equal(Measurement.WrapText("aa bb", 4, options), "aa\nbb");
    assert.equal(Measurement.EvenPad("a", options), "·");
    assert.equal(Measurement.LineWidth("a", { Override: () => undefined }), 6);
    assert.throws(() => Measurement.LineWidth("a", { Override: () => NaN }), RangeError);
});

test("generator rejects absent source data and decodes archive and extended executable table", () =>
{
    const archive = Buffer.alloc(16 + 256 + 3);
    archive.writeUInt32LE(1, 8);
    archive[16] = 5;
    archive.write("a.png", 17);
    archive.writeUInt32LE(3, 16 + 252);
    archive.write("png", 16 + 256);
    assert.equal(ReadArchive(archive).get("a.png")!.toString(), "png");
    const exe = Buffer.alloc(96 * 8);
    for (let code = 0x20; code <= 0x7F; code++)
    {
        exe.writeUInt32LE(code, (code - 0x20) * 8);
        exe.writeUInt32LE(code, (code - 0x20) * 8 + 4);
    }

    assert.equal(ReadLargeFontTable(exe).length, 96);
    assert.throws(() => ReadLargeFontTable(Buffer.alloc(1)), /No large font/u);
    assert.throws(() => Generate({ Archive: new Map(),
        LargeTable: [],
        Version: "test" }, ""), /notfound/u);
});

test("published measurement entry is inert and works without native, Node or browser globals", async () =>
{
    const bundle = await build({ bundle: true,
        format: "iife",
        platform: "neutral",
        stdin: { contents: "import * as M from 'bedform/Spatial/Measurement'; " +
            "globalThis.width = M.LineWidth('a'); globalThis.bytes = M.Utf8Bytes('😀');",
        resolveDir: process.cwd() },
        write: false });
    const sandbox: Record<string, unknown> = { Buffer: undefined,
        TextEncoder: undefined,
        process: undefined,
        require: undefined,
        setInterval: undefined,
        setTimeout: undefined };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    assert.equal(sandbox.width, 6);
    assert.equal(sandbox.bytes, 4);
});
