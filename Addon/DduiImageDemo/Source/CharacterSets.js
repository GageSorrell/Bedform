/**
 * Unicode ranges and labeled grids for the spawn character gallery.
 *
 * @module @sorrell/ddui-image-demo/Source/CharacterSets
 *
 * @file      CharacterSets.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Expands an inclusive Unicode range without splitting supplementary characters.
 *
 * @category Constructor
 * @since 1.1.2
 */
function Range(First, Last)
{
    return Array.from({ length: Last - First + 1 }, (_, Index) => String.fromCodePoint(First + Index));
}

/**
 * Character families shown in separate native TextPrimitives. Block elements
 * include the shading and quadrant subsets, which also have dedicated charts.
 *
 * @category Constant
 * @since 1.1.2
 */
export const CharacterSets = Object.freeze([
    { Name: "Braille", Ranges: "2800-28FF", Characters: Range(0x2800, 0x28ff) },
    { Name: "Block elements", Ranges: "2580-259F", Characters: Range(0x2580, 0x259f) },
    { Name: "Shading", Ranges: "2591-2593", Characters: Range(0x2591, 0x2593) },
    { Name: "Quadrants", Ranges: "2596-259F", Characters: Range(0x2596, 0x259f) },
    { Name: "Box drawing", Ranges: "2500-257F", Characters: Range(0x2500, 0x257f) },
    { Name: "Sextants", Ranges: "1FB00-1FB3B", Characters: Range(0x1fb00, 0x1fb3b) },
    // The other 26 of the 256 octant patterns reuse existing block, quadrant and sextant characters.
    { Name: "Octants", Ranges: "1CD00-1CDE5", Characters: Range(0x1cd00, 0x1cde5) },
    { Name: "Geometric shapes", Ranges: "25A0-25FF", Characters: Range(0x25a0, 0x25ff) },
    { Name: "Arrows", Ranges: "2190-21FF", Characters: Range(0x2190, 0x21ff) },
    { Name: "Diagonal lines", Ranges: "2571-2573 / 1FBA0-1FBAE / 1FBD0-1FBDF",
        Characters: [...Range(0x2571, 0x2573), ...Range(0x1fba0, 0x1fbae), ...Range(0x1fbd0, 0x1fbdf)] },
    { Name: "Mathematical Monospace", Ranges: "1D670-1D6A3 / 1D7F6-1D7FF",
        Characters: [...Range(0x1d670, 0x1d6a3), ...Range(0x1d7f6, 0x1d7ff)] },
    { Name: "Fullwidth Latin and digits", Ranges: "FF21-FF3A / FF41-FF5A / FF10-FF19", TextColor: "§d",
        Characters: [...Range(0xff21, 0xff3a), ...Range(0xff41, 0xff5a), ...Range(0xff10, 0xff19)] }
].map((Set) => Object.freeze({ ...Set, Characters: Object.freeze(Set.Characters) })));

/**
 * Lays out complete code points in sixteen-column rows with a range label.
 *
 * @category Formatting
 * @since 1.1.2
 */
export function CharacterChart(Set)
{
    const Rows = [];
    for (let Index = 0; Index < Set.Characters.length; Index += 16)
    {
        Rows.push(Set.Characters.slice(Index, Index + 16).join(" "));
    }
    return `${Set.Name} (${Set.Characters.length})\n${Set.Ranges}\n${Rows.join("\n")}`;
}

/**
 * U+001D INFORMATION SEPARATOR THREE (group separator).
 *
 * @category Constant
 * @since 1.1.18
 */
const GroupSeparator = "\u001D";

/**
 * U+202E RIGHT-TO-LEFT OVERRIDE, which reverses the direction of the text after it.
 *
 * @category Constant
 * @since 1.1.18
 */
const RightToLeftOverride = "‮";

/**
 * Four lines of twenty lowercase a's with no formatting codes, testing how the
 * client renders U+001D and U+202E: plain; U+001D after the first "a"; ten
 * U+001D after the first "a"; and the second line with U+202E, U+001D, U+202E
 * after the fourth "a".
 *
 * @category Constant
 * @since 1.1.18
 */
export const SeparatorTestText = [
    "a".repeat(20),
    "a" + GroupSeparator + "a".repeat(19),
    "a" + GroupSeparator.repeat(10) + "a".repeat(19),
    "a" + GroupSeparator + "a".repeat(3) +
        RightToLeftOverride + GroupSeparator + RightToLeftOverride + "a".repeat(16)
].join("\n");
