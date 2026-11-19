/**
 * Generates the resource pack's custom glyph pages. Since 1.1.79 every glyph
 * is packed with no gaps from U+E200, the first code point the vanilla font
 * leaves free, in this order: the cell glyphs (Symbols for Legacy Computing
 * stand-ins of Tool/LegacyGlyphs.mjs, the sextant completers, the
 * Supplement's stand-ins of Tool/LegacySupplementGlyphs.mjs, adapted from
 * GNU Unifont, and the octant completers), their wide copies for the seamless
 * layers, Minecraft Ten, every octant pattern as a wide glyph and the Braille
 * dots, so the pages run from font/glyph_E2.png with none missing. The slots
 * come from Source/LegacyComputing.js, Source/MinecraftTen.js and
 * Source/Octant.js. Beside them, font/LICENSE-Unifont.txt carries Unifont's
 * notice and the SIL Open Font License its derived glyphs are distributed
 * under. Every page is 256 by 256 pixels, 16 by 16 cells, in the overlays'
 * dark gray, except Minecraft Ten in the button text style. A narrow glyph's
 * ink spans exactly columns 0 to 6, so its advance is 8, one space in an
 * overlay; a wide glyph's is drawn in columns 0 to 7 and spans 0 to 14, an
 * advance of 16, two cells. Where ink does not reach the first or last
 * column, a pixel there at alpha 1, invisible on any background, extends it.
 * Also writes contact sheets to dist/glyph-preview: each page holding cell
 * glyphs, narrow glyphs' extensions in red, Minecraft Ten and the Braille
 * dots.
 *
 * Usage: node Tool/CustomGlyph.mjs
 *
 * @module @sorrell/ddui-image-demo/Tool/CustomGlyph
 *
 * @file      CustomGlyph.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    GlyphBase,
    LegacyExtraGlyphs,
    LegacyGlyph,
    LegacyWideGlyph,
    OctantCompleterBase,
    OctantCompleterCount
} from "../Source/LegacyComputing.js";
import { FindClient, FontArchive, OpaqueColumns, PNG, ReadArchive, SheetReader, UnicodePageName } from "./ClientFont.mjs";
import { Cell, LegacyExtraCells, LegacyGlyphCells, WideWidth } from "./LegacyGlyphs.mjs";
import { LegacySupplementCells } from "./LegacySupplementGlyphs.mjs";
import { UnifontLicenseText, UnifontNotice, UnifontVersion } from "./Unifont.mjs";
import { MinecraftTenBase, MinecraftTenGlyph } from "../Source/MinecraftTen.js";
import { BrailleDotBase, GlyphEnd, OctantBase, OctantColors } from "../Source/Octant.js";
import { MinecraftTenCells } from "./MinecraftTen.mjs";
import { CharacterName } from "../Source/UnicodeBrowser.js";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Folder = path.join(Root, "resource_packs/ddui_image_demo/font");
mkdirSync(Folder, { recursive: true });
const Hex = (CodePoint) => CodePoint.toString(16).toUpperCase();

/**
 * Glyph colors: the client draws Private Use Area glyphs in their texture's
 * colors, so the pages hold the overlays' ink themselves, #4D4D4D. The pixels
 * that only widen a glyph are at alpha 1: the client counts any pixel above
 * alpha 0 toward a glyph's width (1.1.58: alphas 1 to 254 all widened it), and
 * at alpha 1 it does not show on any background, so the pages suit any
 * background color.
 */
const Ink = [ 0x4d, 0x4d, 0x4d ];
const HiddenAlpha = 1;

/**
 * The game's button text style, measured from a screenshot of the title screen's Play button: white text
 * with a shadow of black at 30% over the button face, #3C8527, which is #2A5D1B.
 */
const ButtonText = Object.freeze({ Face: [ 0x3c, 0x85, 0x27 ], Ink: [ 0xff, 0xff, 0xff ], Shadow: [ 0x2a, 0x5d, 0x1b ] });

/** Sets one pixel of a 256-pixel page: opaque ink, or a hidden widening pixel at alpha 1. */
function SetPixel(Page, X, Y, Inked)
{
    const Index = (Y * 256 + X) * 4;
    Page.data.set(Ink, Index);
    Page.data[Index + 3] = Inked ? 255 : HiddenAlpha;
}

/**
 * Every page drawn, by page number. The glyph groups are packed with no gaps,
 * so a page can hold the end of one group and the start of the next; each
 * group draws into its slots' pages, and all are written at the end.
 */
const Pages = new Map();

/** A slot's page, created on first use, and the top left of its 16 by 16 cell there. */
function Slot(Code)
{
    const Key = Code >> 8;
    if (!Pages.has(Key)) Pages.set(Key, new PNG({ height: 256, width: 256 }));
    return { Page: Pages.get(Key), X: (Code & 15) * 16, Y: ((Code & 255) >> 4) * 16 };
}

// The medium shade pattern of the vanilla Unicode font's U+2592, for the Legacy Computing shades.
const Sheet = SheetReader(ReadArchive(FontArchive(FindClient())));
const ShadePage = Sheet(UnicodePageName(0x2592));
const ShadeCell = ShadePage.width / 16;
if (!OpaqueColumns(ShadePage, 0x92, ShadeCell)) throw new Error("The vanilla U+2592 cell is empty.");
const Shade = (X, Y) =>
    ShadePage.data[(((0x92 >> 4) * ShadeCell + Y) * ShadePage.width + (0x92 & 15) * ShadeCell + X) * 4 + 3] > 0;

// Every cell glyph, by stand-in: the Legacy Computing block drawn here, the Supplement adapted from Unifont, and
// the extras that complete the sextants, each 7 columns wide and, for the seamless layers' wide copies, 8.
const Glyphs = new Map();
// Reuse all 230 supplement octants; the remaining 26 patterns follow the Supplement's last stand-in.
const RegionOctants = Array(256);
for (let Code = 0x1cd00; Code <= 0x1cde5; Code++)
{
    const Digits = CharacterName(Code).match(/^BLOCK OCTANT-([1-8]+)$/u)?.[1];
    if (!Digits) throw new Error(`Missing octant name for ${Code}.`);
    const Pattern = [ ...Digits ].reduce((Value, Digit) => Value | 1 << (Number(Digit) - 1), 0);
    RegionOctants[Pattern] = LegacyGlyph(Code);
}
const MissingOctants = Array.from({ length: 256 }, (_, Pattern) => Pattern)
    .filter((Pattern) => RegionOctants[Pattern] === undefined);
if (MissingOctants.length !== OctantCompleterCount) throw new Error(`Expected ${OctantCompleterCount} octant completers.`);
MissingOctants.forEach((Pattern, Index) => { RegionOctants[Pattern] = OctantCompleterBase + Index; });
writeFileSync(path.join(Root, "Source/RegionGlyphs.js"), `/**
 * Narrow octant patterns, bit 2 * row + column, reusing supplement stand-ins.
 *
 * This module is auto-generated by Tool/CustomGlyph.mjs.
 *
 * @module @sorrell/ddui-image-demo/RegionGlyphs
 *
 * @file      RegionGlyphs.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

export const RegionOctants = Object.freeze(${JSON.stringify(RegionOctants)});
`);
{
    const Narrow = LegacyGlyphCells(Shade);
    const Wide = LegacyGlyphCells(Shade, WideWidth);
    for (const [ CodePoint, Pixels ] of Narrow)
    {
        Glyphs.set(LegacyGlyph(CodePoint), { Label: `U+${Hex(CodePoint)}`, Narrow: Pixels, Wide: Wide.get(CodePoint) });
    }
}
const Supplement = LegacySupplementCells();
for (const [ CodePoint, Pixels ] of Supplement.Cells)
{
    Glyphs.set(LegacyGlyph(CodePoint), { Label: `U+${Hex(CodePoint)}`, Narrow: Pixels, Wide: Supplement.Wide.get(CodePoint) });
}
{
    const Narrow = LegacyExtraCells();
    const Wide = LegacyExtraCells(WideWidth);
    for (const [ Name, StandIn ] of Object.entries(LegacyExtraGlyphs))
    {
        Glyphs.set(StandIn, { Label: Name, Narrow: Narrow.get(Name), Wide: Wide.get(Name) });
    }
}

/**
 * The last column of each kind of glyph's ink extent: a narrow glyph spans
 * columns 0 to 6, an advance of 8, one cell; a wide one spans 0 to 14, an
 * advance of 16, two cells, though only its columns 0 to 7 are drawn.
 */
const LastColumn = Object.freeze({ Narrow: Cell.Width - 1, Wide: 2 * WideWidth - 2 });

for (const Pattern of MissingOctants)
{
    const Rows = (Width) => Array.from({ length: 16 }, (_, Y) => Array.from({ length: Width }, (_, X) =>
        Boolean(Pattern & 1 << (2 * Math.floor(Y / 4) + Math.floor(X / 4)))));
    Glyphs.set(RegionOctants[Pattern], { Label: `Octant ${Pattern}`, Narrow: Rows(7), Wide: Rows(8) });
}

// The cell glyphs, narrow then wide, each glyph's extent completed with alpha-1 pixels.
const Drawn = new Map();
for (const [ StandIn, Glyph ] of Glyphs)
{
    for (const [ Kind, Code ] of [ [ "Narrow", StandIn ], [ "Wide", LegacyWideGlyph(StandIn) ] ])
    {
        const { Page, X: CellX, Y: CellY } = Slot(Code);
        const Columns = new Set();
        Glyph[Kind].forEach((Row, Y) => Row.forEach((White, X) =>
        {
            if (!White) return;
            Columns.add(X);
            SetPixel(Page, CellX + X, CellY + Y, true);
        }));
        if (Columns.size === 0 && StandIn !== LegacyExtraGlyphs.Blank && StandIn !== RegionOctants[0]) throw new Error(`${Glyph.Label} has no ink.`);
        const Extensions = [ 0, LastColumn[Kind] ].filter((X) => !Columns.has(X));
        for (const X of Extensions) SetPixel(Page, CellX + X, CellY + Cell.Height - 1, false);
        Drawn.set(Code, { Extensions, Kind, Label: Glyph.Label, Pixels: Glyph[Kind] });
    }
}

// Self-check: every glyph's ink, visible or not, spans exactly its kind's columns, so its advance is 8 or 16.
for (const [ Code, { Kind, Label } ] of Drawn)
{
    const Columns = OpaqueColumns(Pages.get(Code >> 8), Code & 255, 16);
    if (!Columns || Columns.Left !== 0 || Columns.Right !== LastColumn[Kind])
    {
        throw new Error(`${Label} (${Kind}) spans columns ${JSON.stringify(Columns)}.`);
    }
}
const CellKeys = new Set([ ...Drawn.keys() ].map((Code) => Code >> 8));

// The octants: every pattern, wide only, in each of the octant colors, its blocks 4 by 4 pixels.
for (const [ Index, { Rgb } ] of OctantColors.entries())
{
    for (let Pattern = 0; Pattern < 256; Pattern++)
    {
        const Code = OctantBase + Index * 256 + Pattern;
        const { Page, X: CellX, Y: CellY } = Slot(Code);
        const Put = (X, Y, Alpha) => Page.data.set([ ...Rgb, Alpha ], ((CellY + Y) * 256 + CellX + X) * 4);
        for (let Block = 0; Block < 8; Block++)
        {
            if (!(Pattern & (1 << Block))) continue;
            const [ Row, Column ] = [ Block >> 1, Block & 1 ];
            for (let Y = 0; Y < 4; Y++) for (let X = 0; X < 4; X++) Put(Column * 4 + X, Row * 4 + Y, 255);
        }

        // The left blocks are bits 0, 2, 4 and 6; without one, an alpha-1 pixel starts the extent at column 0.
        if (!(Pattern & 0x55)) Put(0, Cell.Height - 1, HiddenAlpha);
        Put(LastColumn.Wide, Cell.Height - 1, HiddenAlpha);
        const Columns = OpaqueColumns(Page, Code & 255, 16);
        if (!Columns || Columns.Left !== 0 || Columns.Right !== LastColumn.Wide)
        {
            throw new Error(`Octant ${Pattern} at U+${Hex(Code)} spans columns ${JSON.stringify(Columns)}.`);
        }
    }
}

// The Braille dots: row-major 2×4 dot patterns on the same 8×16 grid, narrow.
for (let Pattern = 0; Pattern < 256; Pattern++)
{
    const { Page, X: X0, Y: Y0 } = Slot(BrailleDotBase + Pattern);
    for (let Bit = 0; Bit < 8; Bit++)
    {
        if (!(Pattern & 1 << Bit)) continue;
        for (let Y = 1; Y <= 2; Y++) for (let X = 1; X <= 2; X++)
            SetPixel(Page, X0 + (Bit & 1) * 4 + X, Y0 + (Bit >> 1) * 4 + Y, true);
    }
    SetPixel(Page, X0, Y0 + 15, false);
    SetPixel(Page, X0 + 6, Y0 + 15, false);
}

// The Supplement's glyphs derive from Unifont, so its notice and license travel with the pages holding them.
const SupplementSlots = [ ...Supplement.Cells.keys() ].map(LegacyGlyph).sort((A, B) => A - B);
const [ FirstSlot, LastSlot ] = [ SupplementSlots[0], SupplementSlots.at(-1) ];
const SupplementPages = [ ...new Set(SupplementSlots.flatMap((Code) => [ Code, LegacyWideGlyph(Code) ])
    .map((Code) => Code >> 8)) ].sort((A, B) => A - B).map((Key) => UnicodePageName(Key << 8)).join(", ");
const Span = (First, Last) => `U+${Hex(First)} to U+${Hex(Last)}`;
writeFileSync(path.join(Folder, "LICENSE-Unifont.txt"), [
    `Glyphs on ${SupplementPages} are derived from GNU Unifont ${UnifontVersion}`,
    `(https://unifoundry.com/unifont/): the Supplement's stand-ins, ${Span(FirstSlot, LastSlot)},`,
    `narrowed from 8 to 7 columns per glyph, and their wide copies,`,
    `${Span(LegacyWideGlyph(FirstSlot), LegacyWideGlyph(LastSlot))}, at Unifont's own 8 columns.`,
    "",
    UnifontNotice,
    "",
    "Unifont is dual-licensed under the SIL Open Font License, Version 1.1, and the",
    "GNU GPL version 2 or later with the GNU font embedding exception. These derived",
    "glyph pages are used and distributed under the SIL Open Font License, Version",
    "1.1, which follows.",
    "",
    UnifontLicenseText()
].join("\n"));

// Contact sheets, scaled 6 times: narrow cells side by side with a gray seam, as an overlay row tiles them, and
// wide cells 8 columns apart with no seam, as the seamless layers tile them; hidden extensions of narrow cells red.
const Scale = 6;
const PreviewFolder = path.join(Root, "dist/glyph-preview");
mkdirSync(PreviewFolder, { recursive: true });
{
    // The Braille dots in pattern order, 16 to a row, as they were on their own page before 1.1.79.
    const Preview = new PNG({ height: 256, width: 256 });
    for (let Pattern = 0; Pattern < 256; Pattern++)
    {
        const { Page, X, Y } = Slot(BrailleDotBase + Pattern);
        for (let Row = 0; Row < 16; Row++)
        {
            const From = ((Y + Row) * 256 + X) * 4;
            Preview.data.set(Page.data.subarray(From, From + 64), (((Pattern >> 4) * 16 + Row) * 256 + (Pattern & 15) * 16) * 4);
        }
    }
    writeFileSync(path.join(PreviewFolder, "braille-dots.png"), PNG.sync.write(Preview));
}
for (const Key of CellKeys)
{
    const Pitch = WideWidth;
    const Preview = new PNG({ height: 16 * Cell.Height * Scale, width: 16 * Pitch * Scale });
    for (let Index = 0; Index < Preview.width * Preview.height; Index++) Preview.data.set([ 0, 0, 0, 255 ], Index * 4);
    const Paint = (X, Y, Color) =>
    {
        for (let Dy = 0; Dy < Scale; Dy++)
        {
            for (let Dx = 0; Dx < Scale; Dx++) Preview.data.set(Color, ((Y * Scale + Dy) * Preview.width + X * Scale + Dx) * 4);
        }
    };
    for (let Low = 0; Low < 256; Low++)
    {
        const [ Column, Row ] = [ Low & 15, Low >> 4 ];
        const Glyph = Drawn.get((Key << 8) + Low);
        if (!Glyph || Glyph.Kind === "Narrow")
        {
            for (let Y = 0; Y < Cell.Height; Y++) Paint(Column * Pitch + Cell.Width, Row * Cell.Height + Y, [ 48, 48, 48, 255 ]);
        }
        if (!Glyph) continue;
        Glyph.Pixels.forEach((Line, Y) => Line.forEach((White, X) =>
        {
            if (White) Paint(Column * Pitch + X, Row * Cell.Height + Y, [ 255, 255, 255, 255 ]);
        }));
        if (Glyph.Kind !== "Narrow") continue;
        for (const X of Glyph.Extensions) Paint(Column * Pitch + X, Row * Cell.Height + Cell.Height - 1, [ 200, 0, 0, 255 ]);
    }
    writeFileSync(path.join(PreviewFolder, `glyph-${Hex(Key)}.png`), PNG.sync.write(Preview));
}

// Minecraft Ten, pixel for pixel, in the game's button text style: white, with a shadow 1 pixel
// right and down in black at 30% over the button's green, baked opaque since the client hides pixels at
// alpha 64 or less. Each glyph's advance is its ink and shadow width plus 1, by the client's rule.
const Ten = MinecraftTenCells();
// The bar reaches 3.6 pixels below the baseline, past the cell's 2 rows there; its tail is clipped.
if (Ten.Clipped.length > 0) console.warn(`Minecraft Ten ink clipped at the cell's edge: ${Ten.Clipped.join(", ")}`);
let TenAdvances = "";
for (let Code = 0x20; Code <= 0x7e; Code++)
{
    const Rows = Ten.Cells.get(Code);
    if (!Rows)
    {
        // Lowercase letters have no stand-in; their place in the table is never read.
        TenAdvances += "0";
        continue;
    }

    const { Page: TenPage, X: CellX, Y: CellY } = Slot(MinecraftTenGlyph(Code));
    const Columns = new Set();
    const Paint = (X, Y, Color) =>
    {
        Columns.add(X);
        TenPage.data.set([ ...Color, 255 ], ((CellY + Y) * 256 + CellX + X) * 4);
    };
    Rows.forEach((Row, Y) => Row.forEach((Inked, X) =>
    {
        if (!Inked) return;
        Paint(X, Y, ButtonText.Ink);
        // The shadow shows only where the glyph does not cover it; below row 15 it is clipped.
        if (Y < 15 && X < 15 && !Rows[Y + 1][X + 1]) Paint(X + 1, Y + 1, ButtonText.Shadow);
    }));
    if (Columns.size === 0)
    {
        // The space: two pixels at alpha 1 give it a 3-pixel advance, Minecraft Ten's 2.86 rounded.
        SetPixel(TenPage, CellX, CellY + 15, false);
        SetPixel(TenPage, CellX + 1, CellY + 15, false);
        TenAdvances += String.fromCharCode(48 + 3);
        continue;
    }

    if (Math.min(...Columns) !== 0) throw new Error(`Minecraft Ten U+${Hex(Code)} does not start in column 0.`);
    TenAdvances += String.fromCharCode(48 + Math.max(...Columns) + 2);
}

writeFileSync(path.join(Root, "Source/MinecraftTenWidths.js"), `/**
 * Advances of the Minecraft Ten stand-ins, in their own pixels: one character
 * per code from U+0020 to U+007E, its code minus 48 the advance (0 for the
 * lowercase letters, which have no stand-in).
 *
 * This module is auto-generated by Tool/CustomGlyph.mjs.
 *
 * @module @sorrell/ddui-image-demo/Source/MinecraftTenWidths
 *
 * @file      MinecraftTenWidths.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

/** Advances of U+0020 to U+007E's stand-ins, one character each: its code minus 48. */
export const MinecraftTenAdvances = ${JSON.stringify(TenAdvances)};
`);

// A contact sheet of Minecraft Ten on the button's green, by ASCII code, as wide as the glyphs need, scaled 6 times.
{
    const Preview = new PNG({ height: 16 * 16 * Scale, width: 16 * 18 * Scale });
    for (let Index = 0; Index < Preview.width * Preview.height; Index++) Preview.data.set([ ...ButtonText.Face, 255 ], Index * 4);
    for (let Code = 0x20; Code <= 0x7e; Code++)
    {
        if (!Ten.Cells.has(Code)) continue;
        const [ Column, Row ] = [ Code & 15, (Code >> 4) - 2 ];
        const { Page: TenPage, X: CellX, Y: CellY } = Slot(MinecraftTenGlyph(Code));
        for (let Y = 0; Y < 16; Y++)
        {
            for (let X = 0; X < 16; X++)
            {
                const Index = ((CellY + Y) * 256 + CellX + X) * 4;
                if (TenPage.data[Index + 3] !== 255) continue;
                for (let Dy = 0; Dy < Scale; Dy++)
                {
                    for (let Dx = 0; Dx < Scale; Dx++)
                    {
                        Preview.data.set([ ...TenPage.data.subarray(Index, Index + 3), 255 ],
                            (((Row * 16 + Y) * Scale + Dy) * Preview.width + (Column * 18 + X) * Scale + Dx) * 4);
                    }
                }
            }
        }
    }
    writeFileSync(path.join(PreviewFolder, "minecraft-ten.png"), PNG.sync.write(Preview));
}

// Every group has drawn, so each page is complete: write them, and check they are consecutive from the first.
const Keys = [ ...Pages.keys() ].sort((A, B) => A - B);
if (Keys[0] !== GlyphBase >> 8 || Keys.at(-1) !== (GlyphEnd - 1) >> 8 || Keys.length !== Keys.at(-1) - Keys[0] + 1)
{
    throw new Error(`The glyph pages are not packed: ${Keys.map((Key) => Hex(Key)).join(", ")}.`);
}
for (const [ Key, Page ] of Pages) writeFileSync(path.join(Folder, UnicodePageName(Key << 8)), PNG.sync.write(Page));

const Methods = new Map();
for (const Method of Supplement.Methods.values())
{
    const Kind = Method.startsWith("column") ? "middle column" : Method;
    Methods.set(Kind, (Methods.get(Kind) ?? 0) + 1);
}
const Extended = [ ...Drawn.values() ].filter(({ Extensions, Kind }) => Kind === "Narrow" && Extensions.length > 0).length;
console.log(`Wrote U+${Hex(GlyphBase)} to U+${Hex(GlyphEnd - 1)} on ${Keys.length} pages, ` +
    `${Keys.map((Key) => UnicodePageName(Key << 8)).join(", ")}: ${Glyphs.size} cell glyphs, narrow and wide; ` +
    `${Ten.Cells.size} Minecraft Ten glyphs from U+${Hex(MinecraftTenBase)}; octants from U+${Hex(OctantBase)}; ` +
    `Braille dots from U+${Hex(BrailleDotBase)}. ${Extended} narrow glyphs needed hidden extensions. ` +
    `Supplement narrowing: ${[ ...Methods ].map(([ Kind, Count ]) => `${Kind} ${Count}`).join(", ")}.`);
