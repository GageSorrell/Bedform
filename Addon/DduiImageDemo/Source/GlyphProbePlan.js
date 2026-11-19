/**
 * The plan of the glyph width measurement, shared by the behavior pack, which
 * shows it, and Tool/MeasureGlyphs.mjs, which photographs and reads it: the
 * characters measured, how they are split into batches of display columns,
 * and the text of each column.
 *
 * Each column is one TextPrimitive. Its first two lines are rulers of 2 and 8
 * copies of U+2589, whose ink is a solid block 14 font pixels wide, giving the
 * screen scale. The third is the reference `[ǀ]`, and every further line is
 * `[ǀ`, 8 copies of one measured character in white, and `]`. The brackets
 * and the U+01C0 trigger, which puts every line in the Unicode font, are in
 * the batch's marker color, so the distance between the brackets less the
 * reference's is 8 advances of the measured character.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphProbePlan
 *
 * @file      GlyphProbePlan.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { UnicodeFontPages } from "./GlyphWidths.js";

/**
 * Copies of the measured character on its line.
 *
 * @category Constant
 * @since 1.1.37
 */
export const Copies = 8;

/**
 * U+01C0, drawn like the Unicode font's bar and absent from the large font,
 * so every line holding it is drawn in the Unicode font.
 *
 * @category Constant
 * @since 1.1.37
 */
export const Trigger = "ǀ";

/**
 * U+2589 LEFT SEVEN EIGHTHS BLOCK, the ruler glyph, and the width of its ink
 * in Unicode-font pixels.
 *
 * @category Constant
 * @since 1.1.37
 */
export const Ruler = Object.freeze({ Character: "▉", Ink: 14, Long: 8, Short: 2 });

/**
 * Marker colors, alternating by batch so a photograph of the previous batch
 * is recognized: red (§c) on even batches and blue (§9) on odd ones.
 *
 * @category Constant
 * @since 1.1.37
 */
export const MarkerColors = Object.freeze([ "§c", "§9" ]);

/**
 * Lines of a column before its measured characters: two rulers and the reference.
 *
 * @category Constant
 * @since 1.1.37
 */
export const HeaderLines = 3;

/**
 * Code points never measured: C0 controls and DEL, the section sign that
 * starts formatting codes, and line and paragraph separators, any of which
 * could break or restyle a line.
 */
const Excluded = new Set([ ...Array(0x20).keys(), 0x7f, 0x85, 0xa7, 0x2028, 0x2029 ]);

/**
 * The code points measured, from `First` to `Last` inclusive: every one on a
 * Unicode font page except the excluded controls and separators.
 *
 * @category Formatting
 * @since 1.1.37
 */
export function ProbeCharacters(First = 0, Last = 0xffff)
{
    const Characters = [];
    for (const Page of UnicodeFontPages)
    {
        for (let CodePoint = Page << 8; CodePoint < (Page + 1) << 8; CodePoint++)
        {
            if (CodePoint >= First && CodePoint <= Last && !Excluded.has(CodePoint)) Characters.push(CodePoint);
        }
    }
    return Characters;
}

/**
 * Number of batches needed for a count of characters, `Columns` columns of
 * `Lines` measured characters each.
 *
 * @category Formatting
 * @since 1.1.37
 */
export function BatchCount(Total, Columns, Lines)
{
    return Math.ceil(Total / (Columns * Lines));
}

/**
 * The code points of one batch, as one array per column, left to right as
 * seen by the camera. Columns past the end of the characters are empty.
 *
 * @category Formatting
 * @since 1.1.37
 */
export function BatchColumns(Characters, Batch, Columns, Lines)
{
    const Start = Batch * Columns * Lines;
    return Array.from({ length: Columns }, (_, Column) =>
        Characters.slice(Start + Column * Lines, Math.min(Start + (Column + 1) * Lines, Characters.length)));
}

/**
 * The text of one column: the two rulers, the reference and a line for each
 * code point, with markers in the given color.
 *
 * @category Formatting
 * @since 1.1.37
 */
export function ColumnText(CodePoints, Color)
{
    return [
        Color + Ruler.Character.repeat(Ruler.Short),
        Color + Ruler.Character.repeat(Ruler.Long),
        `${Color}[${Trigger}]`,
        ...CodePoints.map((CodePoint) => `${Color}[${Trigger}§f${String.fromCodePoint(CodePoint).repeat(Copies)}${Color}]`)
    ].join("\n");
}
