/**
 * Estimated TextPrimitive extents and the single-row gallery layout, with
 * neighbors a fixed distance apart edge to edge.
 *
 * @module @sorrell/ddui-image-demo/Source/Layout
 *
 * @file      Layout.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { LargeFontCharacters, LargeFontWidths, MissingGlyphWidth, UnicodeFontWidthTable } from "./GlyphWidths.js";

/**
 * Large-font advance widths in half pixels, indexed by code point; 0 marks a
 * character the large font lacks. Every large-font character is in the Basic
 * Multilingual Plane.
 */
const LargeFont = new Uint8Array(0x10000);
[ ...LargeFontCharacters ].forEach((Character, Index) =>
{
    LargeFont[Character.codePointAt(0)] = LargeFontWidths.charCodeAt(Index) - 48;
});
const FormattingCodes = /§./gu;

/** Removes formatting codes, which take no space and do not affect the choice of font. */
const Visible = (Line) => Line.includes("§") ? Line.replace(FormattingCodes, "") : Line;

/**
 * Whether every UTF-16 unit of already visible text is a large-font
 * character. Surrogates never are, so a character outside the Basic
 * Multilingual Plane fails too.
 */
function AllLarge(Text)
{
    for (let Index = 0; Index < Text.length; Index++)
    {
        if (LargeFont[Text.charCodeAt(Index)] === 0) return false;
    }
    return true;
}

/**
 * Whether the client draws a line in its large font: only when every visible
 * character, after formatting codes are removed, is one of the large font's.
 * Any other character switches the whole line to the smaller Unicode font.
 *
 * @category Layout
 * @since 1.1.36
 */
export function UsesLargeFont(Line)
{
    return AllLarge(Visible(String(Line)));
}

/**
 * Advance width of one character in font pixels, including the gap after it,
 * in the large font when `Large` is true and otherwise in the Unicode font.
 * `Large` defaults to whether the large font has the character, which is the
 * font it gets on a line of its own. Characters outside the Basic
 * Multilingual Plane count as missing glyphs.
 *
 * @category Layout
 * @since 1.1.19
 */
export function GlyphWidth(CodePoint, Large = CodePoint <= 0xffff && LargeFont[CodePoint] > 0)
{
    if (CodePoint > 0xffff) return MissingGlyphWidth;
    if (Large && LargeFont[CodePoint] > 0) return LargeFont[CodePoint] / 2;
    return (UnicodeFontWidthTable.charCodeAt(CodePoint) - 48) / 2;
}

/**
 * Width of one line in font pixels, measured in the font the client chooses
 * for that line: the sum of its advances, including the gap after its last
 * glyph, which is the width the client centers it on (1.1.41). Formatting
 * codes take no space.
 *
 * @category Layout
 * @since 1.1.36
 */
export function LineWidth(Line)
{
    const Text = Visible(String(Line));
    // Half pixels, summed as integers.
    let Total = 0;
    if (AllLarge(Text))
    {
        for (let Index = 0; Index < Text.length; Index++) Total += LargeFont[Text.charCodeAt(Index)];
    }
    else
    {
        for (let Index = 0; Index < Text.length; Index++)
        {
            const Unit = Text.charCodeAt(Index);
            if (Unit >= 0xd800 && Unit <= 0xdbff && Index + 1 < Text.length)
            {
                // A surrogate pair: one character outside the Basic Multilingual Plane, without a glyph.
                Total += MissingGlyphWidth * 2;
                Index++;
            }
            else Total += UnicodeFontWidthTable.charCodeAt(Unit) - 48;
        }
    }
    return Total / 2;
}

/**
 * Line pitch in font pixels before `lineGapHeight` is added: the client's ASCII
 * cell height (`ascii_character_height` in default8.json).
 *
 * @category Layout
 * @since 1.1.14
 */
export const LineHeight = 12;

/**
 * Line pitch in font pixels, before `lineGapHeight`, of a line drawn in the
 * Unicode font: 10, against the large font's 12 (1.1.53: chart rows put in
 * the Unicode font at a gap of -4 were 12 Unicode-font pixels apart, and a
 * Text Writer line at a gap of 0 was 20).
 *
 * @category Layout
 * @since 1.1.62
 */
export const UnicodeLineHeight = 10;

/**
 * Longest line, in UTF-8 bytes, that a TextPrimitive accepts. Its constructor
 * silently drops longer text; `setText` throws.
 *
 * @category Layout
 * @since 1.1.14
 */
export const LineByteLimit = 128;

/**
 * Returns the UTF-8 length of the longest line of text, including formatting
 * codes.
 *
 * @category Layout
 * @since 1.1.14
 */
export function LongestLineBytes(Text)
{
    return Math.max(...String(Text).split("\n").map((Line) =>
    {
        let Bytes = 0;
        for (const Character of Line)
        {
            const CodePoint = Character.codePointAt(0);
            Bytes += CodePoint < 0x80 ? 1 : CodePoint < 0x800 ? 2 : CodePoint < 0x10000 ? 3 : 4;
        }
        return Bytes;
    }));
}

/**
 * Measures text in font pixels: the widest line, each in the font the client
 * chooses for it, as `LineWidth` gives, and the line count. Formatting codes
 * take no space.
 *
 * @category Layout
 * @since 1.1.14
 */
export function MeasureText(Text)
{
    // The server truncates TextPrimitive text at the first NUL, so nothing after it is shown.
    const Lines = String(Text).split("\u0000")[0].split("\n");
    return { Lines: Lines.length, Width: Math.max(...Lines.map(LineWidth)) };
}

/**
 * Lays out displays left to right, as seen from the origin, in one straight row
 * perpendicular to the facing direction, `Distance` blocks ahead, or through
 * `Center` when it is given. Each entry
 * gives its measured text, scale and line gap; `PixelSize` is the width of one
 * font pixel at scale 1, in blocks. Neighbors are `Gap` blocks apart edge to
 * edge. `Anchor` "Center" centers the whole row straight ahead (or on
 * `Center`); "First" centers the first display there and extends the row to
 * the right; an index centers that display there, with earlier displays to
 * its left. Every center shares
 * one height: `EyeHeight` above `GroundTop`, raised if needed to keep the
 * tallest display's bottom edge `Clearance` blocks above the ground.
 *
 * @category Layout
 * @since 1.1.16
 */
export function RowLayout(Entries, {
    Anchor = "Center",
    Center: Through,
    Clearance = 0.1,
    Distance = 30,
    EyeHeight = 1.62,
    Facing,
    Gap = 0.5,
    GroundTop,
    Origin,
    PixelSize
})
{
    const Sizes = Entries.map(({ Measure, Scale, LineGap = 0, Pitch = LineHeight }) => ({
        Width: Measure.Width * PixelSize * Scale,
        Height: Measure.Lines * (Pitch + LineGap) * PixelSize * Scale,
        // The client seems to center a block on 12 pixels per line whatever the gap, so with a negative gap the
        // text reaches higher than half its height (1.1.51: titles overlapped 17-line charts at a gap of -4).
        Reach: Measure.Lines * Math.max(LineHeight, LineHeight + LineGap) * PixelSize * Scale / 2
    }));
    const Total = Sizes.reduce((Sum, { Width }) => Sum + Width, 0) + Gap * Math.max(0, Entries.length - 1);
    const Right = { x: -Math.cos(Facing), z: Math.sin(Facing) };
    const Center = Through ?? { x: Origin.x + Math.sin(Facing) * Distance, z: Origin.z + Math.cos(Facing) * Distance };
    const Y = GroundTop + Math.max(EyeHeight, Clearance + Math.max(...Sizes.map(({ Height }) => Height)) / 2);
    const AnchorIndex = Anchor === "First" ? 0 : Anchor;
    let Offset = -Total / 2;
    if (typeof AnchorIndex === "number")
    {
        // Start left of the anchored display by everything before it, so its center lands straight ahead.
        Offset = -(Sizes[AnchorIndex]?.Width ?? 0) / 2;
        for (let Index = 0; Index < AnchorIndex; Index++) Offset -= Sizes[Index].Width + Gap;
    }
    return Sizes.map(({ Width, Height, Reach }) =>
    {
        const Middle = Offset + Width / 2;
        Offset += Width + Gap;
        return { Height, Location: { x: Center.x + Right.x * Middle, y: Y, z: Center.z + Right.z * Middle }, Reach, Width };
    });
}

/**
 * Wraps text at spaces so each line fits within `Width` font pixels where it
 * can; a single word wider than that keeps a line of its own.
 *
 * @category Layout
 * @since 1.1.25
 */
export function WrapText(Text, Width)
{
    const Lines = [];
    let Line = "";
    for (const Word of String(Text).split(" "))
    {
        const Candidate = Line ? `${Line} ${Word}` : Word;
        if (Line && MeasureText(Candidate).Width > Width)
        {
            Lines.push(Line);
            Line = Word;
        }
        else Line = Candidate;
    }
    Lines.push(Line);
    return Lines.join("\n");
}
