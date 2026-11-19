/**
 * Octant cell glyphs for glyph-only displays: every 2 by 4 pattern of
 * blocks, drawn 8 columns wide like the seamless layers' wide glyphs, in the
 * overlays' dark gray, after the Minecraft Ten stand-ins. A Braille
 * character's eight dots map one to one onto an octant's eight blocks, so
 * Braille art can be shown with solid,
 * seamless cells instead of dots.
 *
 * @module @sorrell/ddui-image-demo/Source/Octant
 *
 * @file      Octant.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { MinecraftTenBase, MinecraftTenCount } from "./MinecraftTen.js";

/**
 * The first octant glyph, right after the Minecraft Ten stand-ins (since
 * 1.1.79): each octant is at this plus its pattern, in the overlays' dark
 * gray (the colored octants were removed in 1.1.75 and 1.1.77). A pattern's bit
 * 2 x row + column is the block in that row (0 to 3, top first) and column
 * (0 left, 1 right). Every glyph is wide only:
 * 8 columns drawn and an alpha-1 pixel in column 14, an advance of two cells,
 * so a glyph-only display draws them only in seamless layers.
 *
 * @category Constant
 * @since 1.1.67
 */
export const OctantBase = MinecraftTenBase + MinecraftTenCount;

/**
 * The octant pages' colors, by the color code that selects them, in page
 * order, with their RGB values: only the overlays' dark gray, which a reset
 * or any other color code also selects.
 *
 * @category Constant
 * @since 1.1.67
 */
export const OctantColors = Object.freeze([
    Object.freeze({ Code: "§r", Rgb: Object.freeze([ 0x4d, 0x4d, 0x4d ]) })
]);

/**
 * The first Braille dot glyph, right after the octants: every 2 by 4 dot
 * pattern, one 2 by 2 dot per bit, narrow, at this plus the pattern, with the
 * same bit order as `OctantBase`. Region layers draw Braille with them.
 *
 * @category Constant
 * @since 1.1.78
 */
export const BrailleDotBase = OctantBase + 256 * OctantColors.length;

/**
 * The first code point after every custom glyph.
 *
 * @category Constant
 * @since 1.1.79
 */
export const GlyphEnd = BrailleDotBase + 256;

/** Each Braille dot's octant block bit, dots 1 to 8 in order: dots 1 to 3 and 7 are the left column, top down. */
const DotBlocks = Object.freeze([ 0, 2, 4, 1, 3, 5, 6, 7 ]);

/**
 * The octant pattern of a Braille character (U+2800 to U+28FF), or undefined
 * for any other code point.
 *
 * @category Formatting
 * @since 1.1.67
 */
export function BrailleOctant(CodePoint)
{
    if (CodePoint < 0x2800 || CodePoint > 0x28ff) return undefined;
    const Dots = CodePoint - 0x2800;
    let Pattern = 0;
    DotBlocks.forEach((Block, Dot) =>
    {
        if (Dots & (1 << Dot)) Pattern |= 1 << Block;
    });
    return Pattern;
}

/**
 * The wide octant glyph of a pattern in the color a color code selects:
 * dark gray for any code without its own page.
 *
 * @category Formatting
 * @since 1.1.67
 */
export function OctantGlyph(Pattern, Code)
{
    const Page = Math.max(0, OctantColors.findIndex((Color) => Color.Code === Code));
    return OctantBase + (Page << 8) + Pattern;
}
