/**
 * Pictures in bounded cell rectangles at an integer multiple of a host's resolution.
 *
 * @module @sorrell/ddui-image-demo/RegionLayer
 *
 * @file      RegionLayer.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { GlyphOnly, GlyphOnlyLineGap } from "./GlyphOverlay.js";
import { LegacyExtraGlyphs, LegacyGlyph, LegacyWideGlyph } from "./LegacyComputing.js";
import { LineByteLimit } from "./Layout.js";
import { BrailleDotBase } from "./Octant.js";
import { RegionOctants } from "./RegionGlyphs.js";

/**
 * Sub-pixels per cell for each family. Braille uses page EC's octant-style
 * dots on the same 8×16 grid, rather than vanilla's 3.5-pixel advance.
 *
 * @category Constant
 * @since 1.1.68
 */
export const RegionFamilies = Object.freeze({
    Octant: 4, Sextant: 3, Quadrant: 2, SeparatedSextant: 3, SeparatedQuadrant: 2, Braille: 4
});

/**
 * Blank sub-cells, using a two-cell wide blank wherever it saves bytes.
 *
 * @category Encoding
 * @since 1.1.68
 */
function Blanks(Count)
{
    return String.fromCodePoint(LegacyWideGlyph(LegacyExtraGlyphs.Blank)).repeat(Math.floor(Count / 2)) +
        (Count % 2 ? String.fromCodePoint(LegacyExtraGlyphs.Blank) : "");
}

/**
 * The narrow glyph of a row-major sub-pixel pattern.
 *
 * @category Encoding
 * @since 1.1.68
 */
function PatternGlyph(Family, Pattern)
{
    if (Family === "Octant") return RegionOctants[Pattern];
    if (Family === "Braille") return BrailleDotBase + Pattern;
    if (Pattern === 0) return LegacyExtraGlyphs.Blank;
    if (Family === "SeparatedQuadrant") return LegacyGlyph(0x1cc20 + Pattern);
    if (Family === "SeparatedSextant") return LegacyGlyph(0x1ce50 + Pattern);
    if (Family === "Quadrant")
    {
        return RegionOctants[(Pattern & 3) * 5 | (Pattern >> 2) * 80];
    }
    const Extra = { 21: LegacyExtraGlyphs.LeftHalf, 42: LegacyExtraGlyphs.RightHalf, 63: LegacyExtraGlyphs.Full }[Pattern];
    return Extra ?? LegacyGlyph(0x1fb00 + Pattern - 1 - (Pattern > 21 ? 1 : 0) - (Pattern > 42 ? 1 : 0));
}

/**
 * Renders a region without accessing the world. Host describes its glyph
 * layer A: Cells (width), Lines (height), and Scale (RowScale / 2), for either
 * GlyphOnly or a seamless SplitOverlay. Its lines must share this cell grid;
 * host cells inside Box must be blank on every layer. Box has zero-based
 * Column and Row and positive Columns and Rows. K is a positive integer.
 * Inside is a predicate in local sub-pixel units (sampled at sub-pixel
 * centres), or a rectangular bitmap with exactly 2*K*Columns columns and
 * RegionFamilies[Family]*K*Rows rows. Truthy pixels are inked.
 *
 * Returns Text, Scale, Lines and LocationOffset (local right/up, in blocks).
 * All Lines are Unicode-font lines at GlyphOnlyLineGap, including blank
 * padding lines. Anchor at the host's A location; put the region depth
 * OverlayDepth / 4 in front of B, with depth testing and no background.
 * WorldOffset uses Options.PixelSize, which is uncalibrated, instead of
 * horizontal padding. Default padding needs no pixel-size calibration.
 * Single narrow glyphs retain seams of 1/K host fine pixel.
 *
 * @throws { Error } For invalid dimensions, family or bitmap, or if a line
 * exceeds LineByteLimit; the error gives a smaller K or box-width budget.
 *
 * @category Encoding
 * @since 1.1.68
 */
export function RegionText(Host, Box, K, Family, Inside, Options = {})
{
    const Positive = (Value) => Number.isSafeInteger(Value) && Value > 0;
    if (!Host || !Box || !Positive(Host.Cells) || !Positive(Host.Lines) ||
        !Number.isFinite(Host.Scale) || Host.Scale <= 0 || !Positive(K) ||
        !Positive(Box.Columns) || !Positive(Box.Rows) ||
        !Number.isSafeInteger(Box.Column) || Box.Column < 0 || !Number.isSafeInteger(Box.Row) || Box.Row < 0 ||
        Box.Column + Box.Columns > Host.Cells || Box.Row + Box.Rows > Host.Lines ||
        !Number.isSafeInteger(K * Host.Cells) || !Number.isSafeInteger(K * Host.Lines))
        throw new Error("Region needs a positive integer K and a cell box inside a positive host grid and scale.");
    if (!Object.hasOwn(RegionFamilies, Family)) throw new Error(`Unknown region glyph family ${Family}.`);
    if (Options.WorldOffset && (!Number.isFinite(Options.PixelSize) || Options.PixelSize <= 0))
        throw new Error("WorldOffset needs a positive PixelSize (uncalibrated blocks per pixel).");
    const SubRows = RegionFamilies[Family];
    const Width = K * Box.Columns;
    const Height = K * Box.Rows;
    const Delta = K * (2 * Box.Column + Box.Columns - Host.Cells);
    const Padding = Options.WorldOffset ? 0 : Math.abs(Delta);
    const Bytes = (Factor) => 3 * (Factor * Box.Columns + Math.ceil((Options.WorldOffset ? 0 :
        Factor * Math.abs(2 * Box.Column + Box.Columns - Host.Cells)) / 2));
    if (Bytes(K) > LineByteLimit)
    {
        const MaxK = Math.floor(Math.floor(LineByteLimit / 3) /
            (Box.Columns + (Options.WorldOffset ? 0 : Math.abs(2 * Box.Column + Box.Columns - Host.Cells) / 2)));
        throw new Error(`Region needs ${Bytes(K)} bytes per line; limit ${LineByteLimit}. Use K <= ${MaxK}, ` +
            `or shrink/recentre the box so K*Columns + ceil(padding/2) <= ${Math.floor(LineByteLimit / 3)}.`);
    }
    if (typeof Inside !== "function" && (!Array.isArray(Inside) || Inside.length !== Height * SubRows ||
        Inside.some((Row) => !Array.isArray(Row) || Row.length !== Width * 2)))
        throw new Error(`Region bitmap must be ${Width * 2} × ${Height * SubRows} sub-pixels.`);
    const Sample = typeof Inside === "function" ? Inside : (X, Y) => Inside[Math.floor(Y)][Math.floor(X)];
    const Left = Blanks(Delta > 0 && !Options.WorldOffset ? Padding : 0);
    const Right = Blanks(Delta < 0 && !Options.WorldOffset ? Padding : 0);
    const Lines = Array(K * Host.Lines).fill(String.fromCodePoint(LegacyExtraGlyphs.Blank));
    for (let Y = 0; Y < Height; Y++)
    {
        let Line = Left;
        for (let X = 0; X < Width; X++)
        {
            let Pattern = 0;
            for (let Bit = 0; Bit < SubRows * 2; Bit++)
                if (Sample(X * 2 + (Bit & 1) + 0.5, Y * SubRows + (Bit >> 1) + 0.5)) Pattern |= 1 << Bit;
            Line += String.fromCodePoint(PatternGlyph(Family, Pattern));
        }
        Lines[K * Box.Row + Y] = Line + Right;
    }
    return {
        Text: Lines.join("\n"), Scale: Host.Scale / K, Lines: Lines.length,
        LocationOffset: { x: Options.WorldOffset ? Delta * 4 * Host.Scale / K * Options.PixelSize : 0, y: 0 }
    };
}

/**
 * A 12×5 blank host and three 4×3 regions showing a circle and surrounding
 * ring, from left to right at K = 1, 2, 4.
 *
 * @category Constructor
 * @since 1.1.68
 */
export function RegionDemo()
{
    const Host = GlyphOnly(Array(5).fill(" ".repeat(12)).join("\n"));
    return {
        Background: undefined, GlyphOnly: true, HalfScale: true, LineGap: GlyphOnlyLineGap,
        Measure: { Lines: 5, Width: 96 }, Middle: Host.B, Pitch: 10, Text: Host.A,
        Title: "Octant circle and ring: k = 1, 2, 4",
        Regions: [ 1, 2, 4 ].map((K, Index) => ({
            Box: { Column: Index * 4, Row: 1, Columns: 4, Rows: 3 }, K, Family: "Octant",
            Inside: (X, Y) =>
            {
                // Physical sub-pixels are square for octants; normalize all three pictures.
                const Radius = Math.hypot((X / K - 4) * 4, (Y / K - 6) * 4);
                return Radius <= 8 || Radius >= 12 && Radius <= 15;
            }
        }))
    };
}
