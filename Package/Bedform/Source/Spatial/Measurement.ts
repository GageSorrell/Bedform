/**
 * Pure TextPrimitive measurement in large-font pixels, with explicit font and resource-pack overrides.
 *
 * @module bedform/Spatial/Measurement
 *
 * @file      Measurement.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Metrics from "./Internal/TextMetrics.generated.js";

/**
 * Bundled font provenance and native glyph classification.
 *
 * @category Constant
 * @since 1.0.0
 */
export { Client, Classification, MissingGlyphWidth, UnicodeFontPages } from
    "./Internal/TextMetrics.generated.js";

/**
 * Auto follows the client's per-line choice; Mojangles forces native fine metrics, Legacy uses large
 * metrics where available, and Ten measures printable ASCII stand-ins in their own page texels.
 *
 * @category Model
 * @since 1.0.0
 */
export type Font = "Auto" | "Mojangles" | "Legacy" | "Ten";

/**
 * A measurement override receives the complete line and requested font before any table lookup.
 * Return undefined to use bundled metrics. Widths include trailing advance in large pixels (Ten in
 * page texels). This supports resource-pack fonts and unresolved translated text for every font.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options
{
    readonly Font?: Font;
    readonly Override?: (text: string, font: Font) => number | undefined;
}

/**
 * Native line pitches and byte limit; pixel-to-block calibration remains the caller's responsibility.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Limits = Object.freeze({ LargePitch: 12,
    LineBytes: 128,
    UnicodePitch: 10 } as const);

const LargeFont = new Map<number, number>([ ...Metrics.LargeFontCharacters ].map(
    (character: string, index: number): [ number, number ] =>
        [ character.codePointAt(0)!, (Metrics.LargeFontWidths.charCodeAt(index) - 48) / 2 ]));
const PadCandidates = Object.freeze([ "", "\u00B7", "\u2219", "l", "\u2219\u2219",
    "l\u2219", "ll", "\u00B7l" ]);

/**
 * Removes color/reset codes. Width-changing obfuscation, bold and italic are rejected.
 *
 * @throws { Error } If formatting cannot be measured exactly.
 *
 * @category Filtering
 * @since 1.0.0
 */
function Visible(text: string): string
{
    if (/§[klo]/iu.test(text))
    {
        throw new Error("Exact text measurement does not support §k, §l or §o.");
    }

    return text.replace(/§./gu, "");
}

/**
 * Tests whether every visible code point belongs to the client's large-font table.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function UsesLargeFont(line: string): boolean
{
    return [ ...Visible(line) ].every((character: string) => LargeFont.has(character.codePointAt(0)!));
}

/**
 * Tests native glyph presence, independently of missing-box advances and Canvas PUA stand-ins.
 * Supplementary characters and surrogate code points have no native glyph pages.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function HasGlyph(codePoint: number, font: "Mojangles" | "Legacy" = "Mojangles"): boolean
{
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0xFF_FF ||
        codePoint >= 0xD8_00 && codePoint <= 0xDF_FF)
    {
        return false;
    }

    if (font === "Legacy")
    {
        return LargeFont.has(codePoint);
    }

    const offset = (codePoint >> 3) * 2;
    const byte = parseInt(Metrics.UnicodeFontPresence.slice(offset, offset + 2), 16);
    return (byte & 1 << (codePoint & 7)) !== 0;
}

/**
 * One code point's advance. Native fine-font metrics never substitute Canvas's PUA metrics. Ten
 * lowercase has no stand-in and uses the missing box; mapping/fallback belongs to the text renderer.
 *
 * @category Getter
 * @since 1.0.0
 */
export function GlyphWidth(codePoint: number, font: Font = "Auto"): number
{
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0xFF_FF)
    {
        return Metrics.MissingGlyphWidth;
    }

    if (font === "Ten")
    {
        const width = codePoint >= 0x20 && codePoint <= 0x7E
            ? Metrics.TenAdvances.charCodeAt(codePoint - 0x20) - 48 : 0;
        return width || Metrics.MissingGlyphWidth;
    }

    return font !== "Mojangles" && LargeFont.has(codePoint) ? LargeFont.get(codePoint)!
        : (Metrics.UnicodeFontWidthTable.charCodeAt(codePoint) - 48) / 2;
}

/**
 * Measures one line including trailing advances. Overrides win before formatting or font selection.
 *
 * @throws { RangeError } If an override returns a negative or nonfinite width.
 * @throws { Error } If bundled measurement encounters width-changing formatting.
 *
 * @category Getter
 * @since 1.0.0
 */
export function LineWidth(line: string, options: Options = {}): number
{
    const font = options.Font ?? "Auto";
    const override = options.Override?.(line, font);
    if (override !== undefined)
    {
        if (!Number.isFinite(override) || override < 0)
        {
            throw new RangeError("Text measurement overrides must return finite nonnegative widths.");
        }

        return override;
    }

    const text = Visible(line);
    const selected = font === "Auto" ? (UsesLargeFont(text) ? "Legacy" : "Mojangles") : font;
    let width = 0;
    for (const character of text)
    {
        width += GlyphWidth(character.codePointAt(0)!, selected);
    }

    return width;
}

/**
 * Counts UTF-8 bytes without TextEncoder, which is absent in Bedrock; lone surrogates use three bytes.
 *
 * @category Getter
 * @since 1.0.0
 */
export function Utf8Bytes(text: string): number
{
    let bytes = 0;
    for (const character of text)
    {
        const code = character.codePointAt(0)!;
        bytes += code < 0x80 ? 1 : code < 0x8_00 ? 2 : code < 0x1_00_00 ? 3 : 4;
    }

    return bytes;
}

/**
 * Counts the longest transmitted line, including formatting and text after NUL, for native validation.
 *
 * @category Getter
 * @since 1.0.0
 */
export function LongestLineBytes(text: string): number
{
    return text.split("\n").reduce((longest: number, line: string) => Math.max(longest, Utf8Bytes(line)), 0);
}

/**
 * Measured widest line and number of lines before native NUL truncation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Measurement
{
    readonly Lines: number;
    readonly Width: number;
}

/**
 * Measures each line independently in the font it selects, stopping at the server's first NUL.
 *
 * @category Getter
 * @since 1.0.0
 */
export function MeasureText(text: string, options: Options = {}): Measurement
{
    const lines = text.split("\u0000")[0].split("\n");
    return { Lines: lines.length,
        Width: lines.reduce((width: number, line: string) => Math.max(width, LineWidth(line, options)), 0) };
}

/**
 * Wraps at spaces within each explicit line; an overwide word retains a line of its own. Measurement
 * is repeated after every candidate so switching the whole line's font is accounted for.
 *
 * @throws { RangeError } If width is not positive and finite.
 *
 * @category Transforming
 * @since 1.0.0
 */
export function WrapText(text: string, width: number, options: Options = {}): string
{
    if (!Number.isFinite(width) || width <= 0)
    {
        throw new RangeError("Wrap width must be positive and finite.");
    }

    return text.split("\n").map((source: string) =>
    {
        const lines: Array<string> = [];
        let line = "";
        for (const word of source.split(" "))
        {
            const candidate = line ? `${line} ${word}` : word;
            if (line && LineWidth(candidate, options) > width)
            {
                lines.push(line);
                line = word;
            }
            else
            {
                line = candidate;
            }
        }

        lines.push(line);
        return lines.join("\n");
    }).join("\n");
}

/**
 * Returns the first unobtrusive pad making a line's full advance an even number of large pixels.
 * It returns only the suffix, preserving the demo's overlay contract.
 *
 * @throws { Error } If no candidate can even the measured width.
 *
 * @category Transforming
 * @since 1.0.0
 */
export function EvenPad(line: string, options: Options = {}): string
{
    const pad = PadCandidates.find((candidate: string) => LineWidth(line + candidate, options) % 2 === 0);
    if (pad === undefined)
    {
        throw new Error(`No pad makes ${JSON.stringify(line)} an even width.`);
    }

    return pad;
}
