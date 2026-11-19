/**
 * Tests of sub-glyph horizontal offsets in a TextPrimitive: invisible padding
 * of slightly different widths moves a bar between two fixed brackets, one
 * font pixel (bold spaces) or half a pixel (braille blanks) per line. A third
 * test tries ways to switch a line to the smaller Unicode font.
 *
 * @module @sorrell/ddui-image-demo/Source/PixelOffsets
 *
 * @file      PixelOffsets.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * U+2800 BRAILLE PATTERN BLANK: 3.5 font pixels wide by the client font data,
 * against 4 for a space. The client draws its eight empty dot positions.
 */
const BrailleBlank = "⠀";
const Plain = (Count) => " ".repeat(Count);
const Bold = (Count) => Count > 0 ? `§l${Plain(Count)}§r` : "";
/**
 * U+2223 DIVIDES: a bar from the Unicode font pages, 1 pixel wide with a
 * 2-pixel advance. A line with any such character is drawn entirely in the
 * smaller Unicode font, so ruler lines built from it match the braille lines.
 */
const Divides = "∣";

/**
 * Candidate ways to switch a line to the smaller Unicode font while drawing
 * little or nothing extra, each applied to the same bar ruler and labelled in
 * ASCII, which does not affect the choice of font. The first line is the
 * unchanged control.
 *
 * @category Formatting
 * @since 1.1.35
 */
function FontSwitchTest()
{
    const Bars = "||||||||";
    const Middle = (Character) => `[${Bars.slice(0, 4)}${Character}${Bars.slice(5)}]`;
    const Ends = (Character) => `${Character}[${Bars}]${Character}`;
    return [
        `[${Bars}] control`,
        `${Middle("∣")} mid U+2223`,
        `${Middle("│")} mid U+2502`,
        `${Middle("▏")} mid U+258F`,
        `${Middle("ǀ")} mid U+01C0`,
        `${Ends("§0∣§r")} ends black U+2223`,
        `${Ends("⁥")} ends U+2065`,
        `${Ends("⁩")} ends U+2069`,
        `${Ends("​")} ends U+200B`,
        `${Ends("⁠")} ends U+2060`,
        `${Ends("﻿")} ends U+FEFF`
    ].join("\n");
}

/**
 * Lays out an offset test: a ruler of bars at the top and bottom, and between
 * them one line per step, each `[`, left padding, a bar, right padding and `]`.
 * Every line is the same width, so centering moves nothing but the middle bar;
 * the padding before it grows or shrinks by one step per line.
 *
 * @category Formatting
 * @since 1.1.33
 */
function OffsetTest(Ruler, Steps, Line, Tick = "|")
{
    const RulerLine = `[${Tick.repeat(Ruler)}]`;
    return [ RulerLine, ...Array.from({ length: Steps + 1 }, (_, Step) => Line(Step)), RulerLine ].join("\n");
}

/**
 * The pixel offset tests, each with its title. Bold spaces should be 5 pixels
 * wide against 4 for plain ones: line k has k bold spaces before the bar and
 * 6 − k after it, so the bar moves right one pixel per line. Braille blanks
 * should be 3.5 pixels: line m has m of them before the bar and 8 − m after
 * it, so the bar moves left half a pixel per line. The ruler's bars are two
 * pixels apart, so whole-pixel bars alternate between on and between them.
 *
 * @category Constant
 * @since 1.1.33
 */
export const PixelOffsetTests = Object.freeze([
    {
        Text: OffsetTest(28, 6, (Step) => `[${Bold(Step)}${Plain(6 - Step)}|${Plain(Step)}${Bold(6 - Step)}]`),
        Title: "Bold spaces: the bar should move right 1 px per line"
    },
    {
        Text: OffsetTest(31, 8, (Step) =>
            `[${BrailleBlank.repeat(Step)}${Plain(8 - Step)}|${Plain(Step)}${BrailleBlank.repeat(8 - Step)}]`, Divides),
        Title: "Braille blanks: the bar should move left 1/2 px per line"
    },
    {
        Text: FontSwitchTest(),
        Title: "Font switch: which lines use the smaller font?"
    }
].map((Test) => Object.freeze(Test)));
