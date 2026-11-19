/**
 * Rasterises host and region PNG glyphs with client advances and centring.
 *
 * @module @sorrell/ddui-image-demo/Tool/SimulateRegion
 *
 * @file      SimulateRegion.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "./ClientFont.mjs";
import { GlyphOnly, SplitOverlay } from "../Source/GlyphOverlay.js";
import { LegacyExtraGlyphs } from "../Source/LegacyComputing.js";
import { RegionDemo, RegionFamilies, RegionText } from "../Source/RegionLayer.js";
import { RegionOctants } from "../Source/RegionGlyphs.js";

const Root = new URL("../", import.meta.url);
const Sheets = new Map();

/**
 * Reads a glyph directly from its generated PNG, counting alpha-1 pixels
 * toward advance and only alpha > 64 toward visible ink.
 *
 * @category Decoding
 * @since 1.1.68
 */
function Glyph(Code)
{
    const Page = Code >> 8;
    if (!Sheets.has(Page)) Sheets.set(Page, PNG.sync.read(readFileSync(new URL(
        `resource_packs/ddui_image_demo/font/glyph_${Page.toString(16).toUpperCase()}.png`, Root))));
    const Sheet = Sheets.get(Page);
    let First = 16;
    let Last = -1;
    const Pixels = [];
    for (let Y = 0; Y < 16; Y++) for (let X = 0; X < 16; X++)
    {
        const Alpha = Sheet.data[(((Code & 255) >> 4) * 16 * Sheet.width + Y * Sheet.width + (Code & 15) * 16 + X) * 4 + 3];
        if (Alpha) { First = Math.min(First, X); Last = Math.max(Last, X); }
        if (Alpha > 64) Pixels.push([ X, Y ]);
    }
    assert.equal(First, 0, `U+${Code.toString(16)} ink extent must begin at zero`);
    return { Advance: Last - First + 2, Pixels };
}

/**
 * Rasterises lines at their own scale, with independent rounded centring.
 * Vertical positions follow the documented inferred 12-pixel centring and
 * measured 16-pixel pitch; this cannot establish the physical client's anchor.
 *
 * @category Testing
 * @since 1.1.68
 */
function Raster(Text, Scale, Offset = 0)
{
    const Lines = Text.split("\n");
    const Pixels = [];
    Lines.forEach((Line, Row) =>
    {
        assert.ok(Buffer.byteLength(Line) <= 128);
        const Glyphs = [ ...Line ].map((Character) => Glyph(Character.codePointAt(0)));
        let X = Math.round(-Glyphs.reduce((Sum, Cell) => Sum + Cell.Advance, 0) / 2);
        for (const Cell of Glyphs)
        {
            for (const [ Dx, Dy ] of Cell.Pixels)
                Pixels.push([ (X + Dx) * Scale + Offset, (-6 * Lines.length + Row * 16 + Dy) * Scale ]);
            X += Cell.Advance;
        }
    });
    return Pixels;
}

// Independently check every octant bitmap, including all reused supplement cells.
for (let Pattern = 0; Pattern < 256; Pattern++)
{
    const Cell = Glyph(RegionOctants[Pattern]);
    assert.equal(Cell.Advance, 8);
    const Expected = [];
    for (let Y = 0; Y < 16; Y++) for (let X = 0; X < 7; X++)
        if (Pattern & 1 << (2 * Math.floor(Y / 4) + Math.floor(X / 4))) Expected.push([ X, Y ]);
    assert.deepEqual(Cell.Pixels, Expected, `octant ${Pattern}`);
}

const Host = { Cells: 12, Lines: 5, Scale: 1 };
const Empty = GlyphOnly(Array(5).fill(" ".repeat(12)).join("\n"));
assert.equal(Raster(Empty.A, 1).length + Raster(Empty.B, 1).length, 0);
// A split overlay of cell glyphs can use the same descriptor at its Back anchor.
const Overlay = SplitOverlay(Array(5).fill(String.fromCodePoint(LegacyExtraGlyphs.Blank).repeat(12)).join("\n"),
    { Seamless: true });
assert.equal(Overlay.Back.split("\n").length, Host.Lines);
let Cases = 0;
for (const K of [ 1, 2, 4 ]) for (const Family of Object.keys(RegionFamilies))
    for (const Column of [ 0, 4, 8 ]) for (const Row of [ 0, 1, 2 ]) for (const WorldOffset of [ false, true ])
    {
        const Box = { Column, Row, Columns: 4, Rows: 3 };
        // Extreme left/right K=4 boxes remain under the budget through wide blank compression.
        const Spec = RegionText(Host, Box, K, Family, () => true, { WorldOffset, PixelSize: 1 });
        assert.equal(Spec.Lines, Host.Lines * K);
        assert.equal(Spec.Scale, 1 / K);
        const Pixels = Raster(Spec.Text, Spec.Scale, Spec.LocationOffset.x);
        const Left = -Host.Cells * 4 + Column * 8;
        const Top = -Host.Lines * 6 + Row * 16;
        assert.ok(Pixels.length > 0);
        for (const [ X, Y ] of Pixels)
        {
            assert.ok(X >= Left && X + Spec.Scale <= Left + Box.Columns * 8, `${Family} x ${X}`);
            assert.ok(Y >= Top && Y + Spec.Scale <= Top + Box.Rows * 16, `${Family} y ${Y}`);
        }
        if (Family === "Octant")
        {
            assert.equal(Math.min(...Pixels.map(([ X ]) => X)), Left);
            assert.equal(Math.max(...Pixels.map(([ X ]) => X)) + 2 / K, Left + Box.Columns * 8);
            assert.equal(Math.min(...Pixels.map(([, Y ]) => Y)), Top);
            assert.equal(Math.max(...Pixels.map(([, Y ]) => Y)) + 1 / K, Top + Box.Rows * 16);
        }
        Cases++;
    }
const Box = { Column: 1, Row: 1, Columns: 1, Rows: 1 };
const Bitmap = Array.from({ length: 4 }, (_, Y) => Array.from({ length: 2 }, (_, X) => (X + Y) % 2 === 0));
assert.equal(RegionText(Host, Box, 1, "Octant", Bitmap).Text,
    RegionText(Host, Box, 1, "Octant", (X, Y) => Bitmap[Math.floor(Y)][Math.floor(X)]).Text);
assert.throws(() => RegionText(Host, Box, 0, "Octant", () => true), /positive integer/u);
assert.throws(() => RegionText(Host, { ...Box, Column: 12 }, 1, "Octant", () => true), /inside/u);
assert.throws(() => RegionText(Host, Box, 1, "toString", () => true), /family/u);
assert.throws(() => RegionText(Host, Box, 1, "Octant", []), /bitmap/u);
assert.throws(() => RegionText(Host, Box, 1, "Octant", () => true, { WorldOffset: true }), /PixelSize/u);
assert.throws(() => RegionText(Host, { Column: 0, Row: 0, Columns: 12, Rows: 5 }, 4, "Octant", () => true), /K <= 3/u);
// A non-centred odd-sized host exercises one-cell padding and centre rounding.
assert.ok(RegionText({ Cells: 13, Lines: 7, Scale: 0.39375 }, Box, 2, "Octant", () => false).Text);

const Demo = RegionDemo();
const Preview = new PNG({ width: 384, height: 320 });
for (let Index = 0; Index < Preview.width * Preview.height; Index++) Preview.data.set([ 197, 197, 197, 255 ], Index * 4);
for (const Definition of Demo.Regions)
{
    const Spec = RegionText(Host, Definition.Box, Definition.K, Definition.Family, Definition.Inside);
    for (const [ X, Y ] of Raster(Spec.Text, Spec.Scale))
        for (let Dy = 0; Dy < 4 / Definition.K; Dy++) for (let Dx = 0; Dx < 4 / Definition.K; Dx++)
            Preview.data.set([ 77, 77, 77, 255 ], ((Math.round((Y + 30) * 4) + Dy) * Preview.width + Math.round((X + 48) * 4) + Dx) * 4);
}
mkdirSync(new URL("dist/glyph-preview/", Root), { recursive: true });
writeFileSync(new URL("dist/glyph-preview/regions.png", Root), PNG.sync.write(Preview));
console.log(`Passed ${Cases} PNG region containment cases, 256 octant masks, bitmap and validation checks. Preview: ${fileURLToPath(new URL("dist/glyph-preview/regions.png", Root))}`);
