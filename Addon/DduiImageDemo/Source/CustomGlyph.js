/**
 * What every custom glyph shares: its advance, and which code points are
 * custom glyphs. The demo's custom glyphs are the cell glyphs: stand-ins for
 * the Symbols for Legacy Computing characters and the glyphs that complete
 * the sextants. Page E2, with the first test glyph (a custom A) and the
 * alpha tests, was removed in 1.1.76.
 *
 * The client draws every texel of a Private Use Area page as one large-font
 * pixel, twice a Unicode-font pixel, whatever the page's resolution or the
 * glyph's ink, with the cell centered on its line (tested in 1.1.38 to
 * 1.1.40). At half a display's scale, a glyph therefore matches the Unicode
 * font exactly; Source/GlyphOverlay.js draws them that way.
 *
 * @module @sorrell/ddui-image-demo/Source/CustomGlyph
 *
 * @file      CustomGlyph.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { IsCellGlyph } from "./LegacyComputing.js";

/**
 * A custom glyph's advance in its own pixels (large-font pixels at the
 * display's scale): 7 columns of ink, alpha-1 widening pixels included, plus
 * a 1-pixel gap, by the rule measured in 1.1.38. That is two spaces, so in an
 * overlay's back line, at half scale, it takes exactly the place of the
 * front's space.
 *
 * @category Constant
 * @since 1.1.41
 */
export const CustomGlyphAdvance = 8;

/**
 * Whether a code point is a custom glyph: a cell glyph (a stand-in for a
 * Symbols for Legacy Computing character, or a glyph that completes the
 * sextants). Every custom glyph's advance is `CustomGlyphAdvance`, so each
 * takes the place of one space in an overlay.
 *
 * @category Formatting
 * @since 1.1.48
 */
export function IsCustomGlyph(CodePoint)
{
    return IsCellGlyph(CodePoint);
}
