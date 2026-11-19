/**
 * Reading photographs of the glyph width measurement: BMP input, PNG output
 * and the analysis that finds each display column, its marker-colored line
 * bands, the screen scale and every measured advance.
 *
 * @module @sorrell/ddui-image-demo/Tool/GlyphShot
 *
 * @file      GlyphShot.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Copies, HeaderLines, Ruler } from "../Source/GlyphProbePlan.js";
import { PNG } from "./ClientFont.mjs";

/**
 * Reads a bottom-up or top-down 24- or 32-bit BMP into top-down RGB rows.
 *
 * @throws { Error } On another format.
 *
 * @category Tool
 * @since 1.1.37
 */
export function ReadBmp(File)
{
    const Bytes = readFileSync(File);
    const Start = Bytes.readUInt32LE(10);
    const Width = Bytes.readInt32LE(18);
    const RawHeight = Bytes.readInt32LE(22);
    const Bits = Bytes.readUInt16LE(28);
    if (Bits !== 24 && Bits !== 32) throw new Error(`Unsupported BMP depth ${Bits}`);
    const Height = Math.abs(RawHeight);
    const Stride = Math.ceil(Width * Bits / 32) * 4;
    const Data = new Uint8Array(Width * Height * 3);
    for (let Y = 0; Y < Height; Y++)
    {
        const Row = Start + (RawHeight > 0 ? Height - 1 - Y : Y) * Stride;
        for (let X = 0; X < Width; X++)
        {
            const From = Row + X * (Bits / 8);
            const To = (Y * Width + X) * 3;
            Data[To] = Bytes[From + 2];
            Data[To + 1] = Bytes[From + 1];
            Data[To + 2] = Bytes[From];
        }
    }
    return { Data, Height, Width };
}

/**
 * Saves an RGB image as PNG, for photographs worth keeping.
 *
 * @category Tool
 * @since 1.1.37
 */
export function SavePng(Image, File)
{
    const Png = new PNG({ height: Image.Height, width: Image.Width });
    for (let Index = 0; Index < Image.Width * Image.Height; Index++)
    {
        Png.data[Index * 4] = Image.Data[Index * 3];
        Png.data[Index * 4 + 1] = Image.Data[Index * 3 + 1];
        Png.data[Index * 4 + 2] = Image.Data[Index * 3 + 2];
        Png.data[Index * 4 + 3] = 255;
    }
    writeFileSync(File, PNG.sync.write(Png));
}

/** Marker color tests, by color index: red (§c) and blue (§9). */
const MarkerTests = [
    (R, G, B) => R >= 150 && G <= 140 && B <= 140 && R - G >= 60,
    (R, G, B) => B >= 150 && R <= 140 && G <= 140 && B - R >= 60
];

/**
 * Splits indices where a test holds into runs, joining runs separated by at
 * most `Gap` failing indices.
 */
function Runs(Length, Test, Gap = 0)
{
    const Found = [];
    for (let Index = 0; Index < Length; Index++)
    {
        if (!Test(Index)) continue;
        const Last = Found.at(-1);
        if (Last && Index - Last[1] <= Gap + 1) Last[1] = Index;
        else Found.push([ Index, Index ]);
    }
    return Found;
}

/**
 * Reads one photograph of a batch. Finds the black display columns, the
 * marker-colored line bands in each, the column's screen scale from its two
 * rulers, and for each measured line, in screen pixels, the span of its 8
 * copies and its white ink's edges from the first copy's pen position, with
 * the advance at the column's own scale. Reports `Stale` when the other
 * batch color dominates, and per column whether the expected lines were found.
 * A single ruler only fixes the scale to a few percent, so callers convert
 * the pixel values with a scale averaged over many columns; see `Convert`.
 *
 * @category Tool
 * @since 1.1.37
 */
export function Analyze(Image, Color, Counts)
{
    const { Data, Height, Width } = Image;
    const At = (X, Y) => (Y * Width + X) * 3;
    const IsBlack = (Index) => Data[Index] <= 12 && Data[Index + 1] <= 12 && Data[Index + 2] <= 12;
    const IsWhite = (Index) => Data[Index] >= 160 && Data[Index + 1] >= 160 && Data[Index + 2] >= 160;
    const Marker = (Index, Which) => MarkerTests[Which](Data[Index], Data[Index + 1], Data[Index + 2]);
    const BlackPerX = new Uint32Array(Width);
    for (let Y = 0; Y < Height; Y++) for (let X = 0; X < Width; X++) if (IsBlack(At(X, Y))) BlackPerX[X]++;
    const Columns = Runs(Width, (X) => BlackPerX[X] >= 8, 2).filter(([ A, B ]) => B - A >= 12);
    const Result = { Columns: [], Expected: 0, Other: 0, Stale: false };
    for (const [ X0, X1 ] of Columns)
    {
        // Any black at all: rows across the rulers are mostly marker-colored.
        const Rows = Runs(Height, (Y) =>
        {
            let Count = 0;
            for (let X = X0; X <= X1; X++) if (IsBlack(At(X, Y))) Count++;
            return Count >= 4;
        }, 6);
        const [ Y0, Y1 ] = Rows.reduce((Best, Run) => Run[1] - Run[0] > Best[1] - Best[0] ? Run : Best, [ 0, -1 ]);
        const HasMarker = new Uint8Array(Height);
        for (let Y = Y0; Y <= Y1; Y++)
        {
            for (let X = X0; X <= X1; X++)
            {
                const Index = At(X, Y);
                if (Marker(Index, Color)) { HasMarker[Y] = 1; Result.Expected++; }
                else if (Marker(Index, 1 - Color)) Result.Other++;
            }
        }
        const Bands = Runs(Height, (Y) => HasMarker[Y] === 1).map(([ A, B ]) =>
        {
            const HasX = new Uint8Array(Width);
            for (let Y = A; Y <= B; Y++) for (let X = X0; X <= X1; X++) if (Marker(At(X, Y), Color)) HasX[X] = 1;
            return { Segments: Runs(Width, (X) => HasX[X] === 1), Y0: A, Y1: B };
        });
        Result.Columns.push({ Bands, X0, X1, Y0, Y1 });
    }
    Result.Stale = Result.Other > Result.Expected;
    if (Result.Stale || Result.Columns.length !== Counts.length) return Result;
    Result.Columns.forEach((Column, Index) =>
    {
        Column.Ok = Column.Bands.length === HeaderLines + Counts[Index];
        if (!Column.Ok) return;
        const Extent = (Band) => Band.Segments.at(-1)[1] + 1 - Band.Segments[0][0];
        const RulerAdvance = (Extent(Column.Bands[1]) - Extent(Column.Bands[0])) / (Ruler.Long - Ruler.Short);
        const Scale = (Extent(Column.Bands[0]) - (Ruler.Short - 1) * RulerAdvance) / Ruler.Ink;
        const Reference = Column.Bands[2];
        const ReferenceSpan = Reference.Segments.at(-1)[0] - Reference.Segments[0][0];
        Column.Scale = Scale;
        Column.Lines = Column.Bands.slice(HeaderLines).map((Band) =>
        {
            const Left = Band.Segments[0][0];
            const Right = Band.Segments.at(-1)[0];
            const Advance = (Right - Left - ReferenceSpan) / (Copies * Scale);
            // White ink between the brackets, on the band's rows.
            let InkLeft = Infinity;
            let InkRight = -Infinity;
            for (let Y = Band.Y0; Y <= Band.Y1; Y++)
            {
                for (let X = Left + 1; X < Right; X++)
                {
                    if (!IsWhite(At(X, Y))) continue;
                    InkLeft = Math.min(InkLeft, X);
                    InkRight = Math.max(InkRight, X + 1);
                }
            }
            // The pen position of the first copy, where the reference's closing bracket starts.
            const Pen = Left + ReferenceSpan;
            return {
                Advance,
                InkLeftPixels: Number.isFinite(InkLeft) ? InkLeft - Pen : null,
                InkRightPixels: Number.isFinite(InkRight) ? InkRight - Pen : null,
                SpanPixels: Right - Left - ReferenceSpan
            };
        });
    });
    return Result;
}

/**
 * Converts one line's pixel measurements to Unicode-font pixels at a given
 * screen scale: the advance, and the ink's left and right edges, the right
 * edge measured on the last copy, both from that copy's pen position.
 *
 * @category Tool
 * @since 1.1.37
 */
export function Convert(Line, Scale)
{
    const Advance = Line.SpanPixels / (Copies * Scale);
    return {
        Advance,
        InkLeft: Line.InkLeftPixels === null ? null : Line.InkLeftPixels / Scale,
        InkRight: Line.InkRightPixels === null ? null : Line.InkRightPixels / Scale - (Copies - 1) * Advance
    };
}
