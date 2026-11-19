/**
 * Proves the Canvas glyph catalogue preserves the demo's current identities, shapes, alpha and
 * metrics while normalizing font ink to dark gray and removing Minecraft Ten's baked shadow.
 * Skipped when the demo's generated pages are absent.
 *
 * @module bedform-canvas/Test/GlyphParity.test
 *
 * @file      GlyphParity.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Generate, OpaqueColumns, Output } from "../Tool/Glyph/Generate.mts";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

const Demo = fileURLToPath(new URL("../../DduiImageDemo/", import.meta.url));
const DemoFont = path.join(Demo, "resource_packs/ddui_image_demo/font");
const Available = existsSync(path.join(DemoFont, "glyph_E2.png"));

test("demo identities, shapes, alpha and metrics survive normalization", { skip: !Available }, async () =>
{
    const generated = Generate();
    const glyphs = generated.Glyphs;
    const ten = new Set([ ...glyphs.entries() ].filter(([ , glyph ]: [ number, { Kind: string } ]) =>
        glyph.Kind === "Ten").map(([ code ]: [ number, unknown ]) => code));
    const keys = [ ...new Set([ ...glyphs.keys() ].map((code: number) => code >> 8)) ];
    let compared = 0;
    for (const key of keys)
    {
        const name = `glyph_${key.toString(16).toUpperCase()}.png`;
        const demo = PNG.sync.read(readFileSync(path.join(DemoFont, name))).data;
        const canvas = generated.Images.get(`${Output.Font}/${name}`)!;
        for (let index = 0; index < 256 * 256; index++)
        {
            const [ x, y ] = [ index % 256, index >> 8 ];
            const code = (key << 8) + (y >> 4) * 16 + (x >> 4);
            const pixel = index * 4;
            if (code === generated.Layout.Switch || !glyphs.has(code))
            {
                assert.equal(demo[pixel + 3], 0, `the demo leaves U+${code.toString(16)} unused`);
                continue;
            }

            if (ten.has(code))
            {
                // Only the demo's white ink survives; its baked green shadow is removed.
                const white = demo[pixel + 3] === 255 && demo[pixel] === 255 && demo[pixel + 1] === 255 &&
                    demo[pixel + 2] === 255;
                assert.equal(canvas[pixel + 3] === 255, white, `Ten ink at U+${code.toString(16)}`);
                continue;
            }

            assert.equal(canvas[pixel + 3], demo[pixel + 3],
                `alpha at U+${code.toString(16)} ${x & 15},${y & 15}`);
            compared++;
        }

        for (const code of ten)
        {
            if (code >> 8 === key)
            {
                assert.deepEqual(OpaqueColumns(canvas, code), OpaqueColumns(demo, code),
                    `Ten extent U+${code.toString(16)}`);
            }
        }
    }

    assert.ok(compared > 500_000);
    const widths = await import(pathToFileURL(path.join(Demo, "Source/MinecraftTenWidths.js")).href) as
        { MinecraftTenAdvances: string };
    const regions = await import(pathToFileURL(path.join(Demo, "Source/RegionGlyphs.js")).href) as
        { RegionOctants: ReadonlyArray<number> };
    const octant = await import(pathToFileURL(path.join(Demo, "Source/Octant.js")).href) as
        { GlyphEnd: number };
    const legacy = await import(pathToFileURL(path.join(Demo, "Source/LegacyComputing.js")).href) as
        { LegacyGlyph: (codePoint: number) => number | undefined };
    assert.equal(generated.TenAdvances, widths.MinecraftTenAdvances);
    assert.deepEqual(generated.RegionOctants, regions.RegionOctants);
    assert.equal(generated.Layout.Switch, octant.GlyphEnd,
        "the switch takes the first slot the demo leaves free");
    for (const [ codePoint, standIn ] of generated.Layout.Legacy)
    {
        assert.equal(standIn, legacy.LegacyGlyph(codePoint));
    }
});
