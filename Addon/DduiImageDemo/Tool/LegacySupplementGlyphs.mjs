/**
 * The Symbols for Legacy Computing Supplement glyphs, as 7 by 16 cells of
 * the Unicode font's pixels, for Tool/CustomGlyph.mjs, adapted from GNU
 * Unifont's 8 by 16 glyphs (see Tool/Unifont.mjs). A glyph without ink in
 * column 7 keeps columns 0 to 6. A glyph that tiles with its neighbors, such
 * as a mosaic, a piece of a larger picture or a circuit segment, drops column
 * 7, where the game's 1-pixel seam between glyphs falls, so the pieces stay
 * aligned and grid mosaics split 4 and 3 like the block's own. A standalone
 * picture inked only on the right shifts one column left; one inked on both
 * edges loses the interior column most like a neighbor, which keeps
 * symmetric pictures symmetric. Separated quadrants and sextants, whose
 * gutters are on the left of their blocks, drop column 0 instead. `Overrides` replaces any adapted cell.
 *
 * @module @sorrell/ddui-image-demo/Tool/LegacySupplementGlyphs
 *
 * @file      LegacySupplementGlyphs.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { IsLegacyComputing, LegacyComputingBlocks } from "../Source/LegacyComputing.js";
import { CharacterName } from "../Source/UnicodeBrowser.js";
import { UnifontPlane1 } from "./Unifont.mjs";

/** Names of characters that tile with their neighbors, which keep their columns 0 to 6. */
const Tiling = new RegExp([
    "HALF", "QUADRANT", "THIRD", "BLOCK", "FILL", "LARGE TYPE PIECE", "BOX DRAWINGS", "TWELFTH CIRCLE",
    "QUARTER CIRCLE", "SEGMENT", "LADDER", "LINE WITH", "INDUCTOR", "RESISTOR", "CAPACITOR", "DIODE",
    "TRANSISTOR", "LOGIC GATE", "ZIGZAG", "DASH", "ANTENNA", "RECEPTACLE"
].join("|"), "u");

/**
 * Names of characters drawn with a gutter on the left of each block: Unifont's
 * separated quadrants and sextants leave columns 0 and 4 empty and fill 1 to 3
 * and 5 to 7. Dropping column 0 keeps both blocks 3 wide, and the seam after
 * the glyph serves as the right block's gutter; dropping column 7 left the
 * right block 2 wide (1.1.62).
 */
const LeftGutter = /^SEPARATED BLOCK (QUADRANT|SEXTANT)-/u;

/**
 * Hand-drawn replacements for adapted cells, by code point, as 16 rows of 7
 * characters, `#` for ink.
 *
 * @category Constant
 * @since 1.1.49
 */
export const Overrides = new Map();

/** The interior column (1 to 6) most like a neighbor; ties go to the center. */
function RedundantColumn(Rows)
{
    const Column = (X) => Rows.map((Row) => Row[X]);
    const Distance = (A, B) => A.reduce((Sum, Bit, Index) => Sum + (Bit !== B[Index] ? 1 : 0), 0);
    let Best;
    for (let X = 1; X <= 6; X++)
    {
        const Score = Math.min(Distance(Column(X), Column(X - 1)), Distance(Column(X), Column(X + 1)));
        const Center = Math.abs(X - 3.5);
        if (!Best || Score < Best.Score || (Score === Best.Score && Center < Best.Center)) Best = { Center, Score, X };
    }

    return Best.X;
}

/**
 * Narrows an 8-column Unifont glyph to 7 columns by the rules above, or, with
 * `Gutter`, by dropping column 0, and reports how: "fits", "gutter", "seam",
 * "shift" or "column N".
 *
 * @category Tool
 * @since 1.1.49
 */
export function Narrow(Rows, Tiles, Gutter = false)
{
    const Has = (X) => Rows.some((Row) => Row[X]);
    // Every glyph of a gutter family drops column 0, inked on the right or not, so their blocks stay in line.
    if (Gutter) return { Method: "gutter", Rows: Rows.map((Row) => Row.slice(1, 8)) };
    if (!Has(7)) return { Method: "fits", Rows: Rows.map((Row) => Row.slice(0, 7)) };
    if (Tiles) return { Method: "seam", Rows: Rows.map((Row) => Row.slice(0, 7)) };
    if (!Has(0)) return { Method: "shift", Rows: Rows.map((Row) => Row.slice(1, 8)) };
    const Drop = RedundantColumn(Rows);
    return { Method: `column ${Drop}`, Rows: Rows.map((Row) => Row.filter((_, X) => X !== Drop)) };
}

/**
 * Returns every assigned supplement character's cell, by code point, as rows
 * of booleans, true for white ink, with how each was narrowed, and its wide
 * cell for the seamless layers: Unifont's 8 columns unchanged.
 *
 * @throws { Error } When Unifont lacks a character or draws it double width.
 *
 * @category Tool
 * @since 1.1.49
 */
export function LegacySupplementCells()
{
    const Unifont = UnifontPlane1();
    const Supplement = LegacyComputingBlocks[1];
    const Cells = new Map();
    const Methods = new Map();
    const Wide = new Map();
    for (let CodePoint = Supplement.First; CodePoint <= Supplement.Last; CodePoint++)
    {
        if (!IsLegacyComputing(CodePoint)) continue;
        if (Overrides.has(CodePoint))
        {
            const Rows = Overrides.get(CodePoint).map((Row) => [ ...Row ].map((Pixel) => Pixel === "#"));
            Cells.set(CodePoint, Rows);
            // A hand-drawn cell is 7 wide; its wide glyph leaves the seam empty.
            Wide.set(CodePoint, Rows.map((Row) => [ ...Row, false ]));
            Methods.set(CodePoint, "override");
            continue;
        }

        const Rows = Unifont.get(CodePoint);
        if (!Rows || Rows[0].length !== 8)
        {
            throw new Error(`Unifont has no narrow glyph for U+${CodePoint.toString(16).toUpperCase()}.`);
        }

        const Name = CharacterName(CodePoint);
        const { Method, Rows: Narrowed } = Narrow(Rows, Tiling.test(Name), LeftGutter.test(Name));
        Cells.set(CodePoint, Narrowed);
        // The seamless layers' wide glyph is Unifont's own 8 columns: its column 7 fills the seam.
        Wide.set(CodePoint, Rows);
        Methods.set(CodePoint, Method);
    }

    return { Cells, Methods, Wide };
}
