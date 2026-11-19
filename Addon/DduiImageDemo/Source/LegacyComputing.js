/**
 * The Symbols for Legacy Computing block (U+1FB00 to U+1FBFF) and its
 * supplement (U+1CC00 to U+1CEBF) as custom glyphs. The client has glyph
 * pages only for the Basic Multilingual Plane, so each character with a
 * glyph has a Private Use Area stand-in. Since 1.1.79 the stand-ins are packed
 * with no gaps from `GlyphBase`, U+E200, the first code point the vanilla
 * font leaves free: the block's glyphs in code point order, the four sextant
 * completers, the supplement's glyphs and the 26 octant completers, 913 cell
 * glyphs, then their wide copies. Unassigned and dropped code points take no
 * slot. Each narrow glyph is a 7 by 16 cell for the overlays of
 * Source/GlyphOverlay.js. Source/MinecraftTen.js and Source/Octant.js continue
 * the sequence after `CellGlyphEnd`.
 *
 * @module @sorrell/ddui-image-demo/Source/LegacyComputing
 *
 * @file      LegacyComputing.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * The two blocks, each with its first and last code points.
 *
 * @category Constant
 * @since 1.1.49
 */
export const LegacyComputingBlocks = Object.freeze([
    Object.freeze({ First: 0x1fb00, Last: 0x1fbff, Name: "Symbols for Legacy Computing" }),
    Object.freeze({ First: 0x1cc00, Last: 0x1cebf, Name: "Symbols for Legacy Computing Supplement" })
]);

/**
 * The Symbols for Legacy Computing block alone, as before the supplement.
 *
 * @category Constant
 * @since 1.1.48
 */
export const LegacyComputingBlock = LegacyComputingBlocks[0];

/**
 * Code points of the blocks that are unassigned, which have no stand-in.
 *
 * @category Constant
 * @since 1.1.48
 */
export const LegacyComputingReserved = Object.freeze([
    0x1fb93, 0x1fbfb, 0x1fbfc, 0x1fbfd, 0x1fbfe, 0x1fbff,
    0x1ccfd, 0x1ccfe, 0x1ccff, 0x1ceb4, 0x1ceb5, 0x1ceb6, 0x1ceb7, 0x1ceb8, 0x1ceb9
]);

/** Every code point from First to Last, inclusive. */
const Span = (First, Last) => Array.from({ length: Last - First + 1 }, (_, Index) => First + Index);

/**
 * Assigned characters left out of the glyph set, which have no stand-in:
 * sprites and letters whose Unifont designs use all 8 columns and so lose
 * one when narrowed to 7, kept out to free their slots. These are the alien
 * sprites (U+1CC4C to U+1CC55), the robot halves (U+1CC5A to U+1CC5F, and the
 * flailing robot's top halves, U+1CDF6 and U+1CDF7), the racing cars and
 * tanks (U+1CC97 to U+1CC9C and U+1CC9E to U+1CC9F), and the outlined letters
 * and digits (U+1CCD6 to U+1CCF9). The seven-segment digits stay.
 *
 * @category Constant
 * @since 1.1.69
 */
export const LegacyComputingDropped = Object.freeze([
    ...Span(0x1cc4c, 0x1cc55),
    ...Span(0x1cc5a, 0x1cc5f),
    ...Span(0x1cc97, 0x1cc9c),
    ...Span(0x1cc9e, 0x1cc9f),
    ...Span(0x1ccd6, 0x1ccf9),
    0x1cdf6, 0x1cdf7
]);

const Reserved = new Set([ ...LegacyComputingReserved, ...LegacyComputingDropped ]);

/** The block holding a code point, or undefined. */
const BlockOf = (CodePoint) => LegacyComputingBlocks.find((Block) => CodePoint >= Block.First && CodePoint <= Block.Last);

/**
 * Whether a code point is an assigned character of either block that has a
 * glyph: neither unassigned nor in `LegacyComputingDropped`.
 *
 * @category Formatting
 * @since 1.1.48
 */
export function IsLegacyComputing(CodePoint)
{
    return BlockOf(CodePoint) !== undefined && !Reserved.has(CodePoint);
}

/**
 * The first code point of the custom glyphs, U+E200: the start of page E2,
 * the first page the vanilla font leaves free (it supplies E0 and E1).
 *
 * @category Constant
 * @since 1.1.79
 */
export const GlyphBase = 0xe200;

/** Every code point of a block that has a glyph, in order. */
const WithGlyphs = (Block) => Span(Block.First, Block.Last).filter((CodePoint) => !Reserved.has(CodePoint));

/** Each character's stand-in, by code point. */
const StandIns = new Map();
let NextSlot = GlyphBase;
for (const CodePoint of WithGlyphs(LegacyComputingBlocks[0])) StandIns.set(CodePoint, NextSlot++);
const ExtraSlot = NextSlot;
NextSlot += 4;
for (const CodePoint of WithGlyphs(LegacyComputingBlocks[1]))
{
    StandIns.set(CodePoint, NextSlot++);
}

/**
 * The stand-in of a character of either block that has a glyph, or undefined
 * for one without (unassigned or in `LegacyComputingDropped`).
 *
 * @category Formatting
 * @since 1.1.48
 */
export function LegacyGlyph(CodePoint)
{
    return StandIns.get(CodePoint);
}

const LegacyStandIns = new Set(StandIns.values());

/**
 * Whether a code point is the stand-in of a character of either block.
 *
 * @category Formatting
 * @since 1.1.48
 */
export function IsLegacyGlyph(CodePoint)
{
    return LegacyStandIns.has(CodePoint);
}

/**
 * Glyphs that complete the sextants, which Unicode encodes as Block Elements
 * (vanilla glyphs, which a half-scale layer would draw at the wrong size) or
 * not at all: the full block, the left and right halves and a blank cell, in
 * the four slots after the block's last glyph.
 *
 * @category Constant
 * @since 1.1.66
 */
export const LegacyExtraGlyphs = Object.freeze({
    Blank: ExtraSlot + 3,
    Full: ExtraSlot,
    LeftHalf: ExtraSlot + 1,
    RightHalf: ExtraSlot + 2
});

const Extras = new Set(Object.values(LegacyExtraGlyphs));

/**
 * The first of the 26 octant completers, right after the supplement's last
 * glyph: the octant patterns Unicode does not encode, drawn by
 * Tool/CustomGlyph.mjs and listed in Source/RegionGlyphs.js.
 *
 * @category Constant
 * @since 1.1.79
 */
export const OctantCompleterBase = NextSlot;

/**
 * How many octant completers there are: 256 patterns less the 230 octants
 * the supplement encodes.
 *
 * @category Constant
 * @since 1.1.79
 */
export const OctantCompleterCount = 26;

/**
 * How many narrow cell glyphs there are, from `GlyphBase`: the block's, the
 * sextant completers, the supplement's and the octant completers.
 *
 * @category Constant
 * @since 1.1.79
 */
export const CellGlyphCount = OctantCompleterBase + OctantCompleterCount - GlyphBase;

/**
 * Whether a code point is a cell glyph of the overlays' grid: a stand-in for
 * a Symbols for Legacy Computing character or one of `LegacyExtraGlyphs`.
 * Every cell glyph is 7 columns of ink plus the seam, an advance of 8, and
 * has a wide copy (`LegacyWideGlyph`) that fills the seam.
 *
 * @category Formatting
 * @since 1.1.66
 */
export function IsCellGlyph(CodePoint)
{
    return IsLegacyGlyph(CodePoint) || Extras.has(CodePoint);
}

/**
 * How far a cell glyph's wide copy is from it: the wide copies follow the
 * narrow glyphs in the same order, 8 columns wide, their last column filling
 * the seam, with an alpha-1 pixel in column 14 that makes the advance 16, two
 * cells. A seamless layer draws every other cell with them, and its forced
 * 1-pixel gap falls in a cell the other layer draws. Every cell glyph is dark
 * gray: the client draws Private Use Area glyphs in their texture's colors
 * and ignores color codes.
 *
 * @category Constant
 * @since 1.1.66
 */
export const LegacyWideOffset = CellGlyphCount;

/**
 * The wide copy of a cell glyph.
 *
 * @category Formatting
 * @since 1.1.66
 */
export function LegacyWideGlyph(StandIn)
{
    return StandIn + LegacyWideOffset;
}

/**
 * The first code point after the cell glyphs and their wide copies, where
 * Source/MinecraftTen.js continues.
 *
 * @category Constant
 * @since 1.1.79
 */
export const CellGlyphEnd = GlyphBase + 2 * CellGlyphCount;

/**
 * Replaces every assigned character of either block in text with its
 * stand-in. The characters are outside the Basic Multilingual Plane, so the
 * text is read by code point, not by UTF-16 unit.
 *
 * @category Formatting
 * @since 1.1.48
 */
export function ToLegacyGlyphs(Text)
{
    let Result = "";
    for (const Character of String(Text))
    {
        const CodePoint = Character.codePointAt(0);
        Result += IsLegacyComputing(CodePoint) ? String.fromCodePoint(LegacyGlyph(CodePoint)) : Character;
    }

    return Result;
}
