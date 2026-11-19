/**
 * Minecraft Ten, the game's heading font, as custom glyph cells: reads the
 * vanilla resource pack's font/minecraft-ten.ttf (TrueType outlines drawn on
 * a grid of 70-unit pixels, left side bearing 50, baseline at 0) and
 * rasterizes each printable ASCII glyph pixel for pixel, testing each pixel's
 * center against the outline. Its 10-pixel capitals land on rows 4 to 13 of a
 * 16-row cell, as the Unicode font's do. Lowercase letters are left out:
 * Minecraft Ten draws them with its capitals' outlines.
 *
 * @module @sorrell/ddui-image-demo/Tool/MinecraftTen
 *
 * @file      MinecraftTen.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { IsTenCharacter } from "../Source/MinecraftTen.js";
import { FindClient } from "./ClientFont.mjs";

/** Font units per pixel of Minecraft Ten's design grid, its left side bearing, and the cell row the baseline sits under. */
const Pixel = 70;
const Bearing = 50;
const BaselineRow = 13;

/**
 * Reads a TrueType font's character map (format 4) and simple glyph
 * outlines, returning a function from code point to contours of points, or
 * undefined when the font lacks the character.
 *
 * @throws { Error } On a composite glyph or a curve, which Minecraft Ten has none of.
 *
 * @category Tool
 * @since 1.1.64
 */
function ReadTrueType(Font)
{
    const Tables = new Map();
    for (let Index = 0; Index < Font.readUInt16BE(4); Index++)
    {
        const Entry = 12 + Index * 16;
        Tables.set(Font.toString("ascii", Entry, Entry + 4), Font.readUInt32BE(Entry + 8));
    }

    const Long = Font.readInt16BE(Tables.get("head") + 50) === 1;
    const Glyphs = new Map();
    const Cmap = Tables.get("cmap");
    for (let Index = 0; Index < Font.readUInt16BE(Cmap + 2); Index++)
    {
        const Table = Cmap + Font.readUInt32BE(Cmap + 4 + Index * 8 + 4);
        if (Font.readUInt16BE(Table) !== 4) continue;
        const Segments = Font.readUInt16BE(Table + 6) / 2;
        const Ends = Table + 14;
        const Starts = Ends + Segments * 2 + 2;
        const Deltas = Starts + Segments * 2;
        const Ranges = Deltas + Segments * 2;
        for (let Segment = 0; Segment < Segments; Segment++)
        {
            const End = Font.readUInt16BE(Ends + Segment * 2);
            const Start = Font.readUInt16BE(Starts + Segment * 2);
            const Delta = Font.readInt16BE(Deltas + Segment * 2);
            const Range = Font.readUInt16BE(Ranges + Segment * 2);
            for (let Code = Start; Code <= End && Code !== 0xffff; Code++)
            {
                let Glyph = Range === 0 ? (Code + Delta) & 0xffff
                    : Font.readUInt16BE(Ranges + Segment * 2 + Range + (Code - Start) * 2);
                if (Range !== 0 && Glyph !== 0) Glyph = (Glyph + Delta) & 0xffff;
                if (Glyph !== 0 && !Glyphs.has(Code)) Glyphs.set(Code, Glyph);
            }
        }
    }

    const Loca = Tables.get("loca");
    const Glyf = Tables.get("glyf");
    const Offset = (Glyph) => Long ? Font.readUInt32BE(Loca + Glyph * 4) : Font.readUInt16BE(Loca + Glyph * 2) * 2;
    return (CodePoint) =>
    {
        const Glyph = Glyphs.get(CodePoint);
        if (Glyph === undefined) return undefined;
        if (Offset(Glyph) === Offset(Glyph + 1)) return [];
        const Start = Glyf + Offset(Glyph);
        const Count = Font.readInt16BE(Start);
        if (Count < 0) throw new Error(`U+${CodePoint.toString(16)} is a composite glyph.`);
        const EndPoints = Array.from({ length: Count }, (_, Index) => Font.readUInt16BE(Start + 10 + Index * 2));
        const Total = EndPoints.at(-1) + 1;
        let At = Start + 10 + Count * 2;
        At += 2 + Font.readUInt16BE(At);
        const Flags = [];
        while (Flags.length < Total)
        {
            const Flag = Font[At++];
            Flags.push(Flag);
            if (Flag & 8) for (let Repeat = Font[At++]; Repeat > 0; Repeat--) Flags.push(Flag);
        }

        if (Flags.some((Flag) => !(Flag & 1))) throw new Error(`U+${CodePoint.toString(16)} has curves.`);
        const Coordinates = (Short, Same) =>
        {
            let Value = 0;
            return Flags.map((Flag) =>
            {
                if (Flag & Short)
                {
                    const Step = Font[At++];
                    Value += Flag & Same ? Step : -Step;
                }
                else if (!(Flag & Same))
                {
                    Value += Font.readInt16BE(At);
                    At += 2;
                }

                return Value;
            });
        };
        const Xs = Coordinates(2, 16);
        const Ys = Coordinates(4, 32);
        return EndPoints.map((End, Index) =>
        {
            const First = Index === 0 ? 0 : EndPoints[Index - 1] + 1;
            return Xs.slice(First, End + 1).map((X, Point) => [ X, Ys[First + Point] ]);
        });
    };
}

/** Whether a point is inside contours by the nonzero winding rule. */
function Inside(Contours, X, Y)
{
    let Winding = 0;
    for (const Contour of Contours)
    {
        for (let Index = 0; Index < Contour.length; Index++)
        {
            const [ X0, Y0 ] = Contour[Index];
            const [ X1, Y1 ] = Contour[(Index + 1) % Contour.length];
            if ((Y0 <= Y) !== (Y1 <= Y))
            {
                const Cross = X0 + (Y - Y0) * (X1 - X0) / (Y1 - Y0);
                if (Cross > X) Winding += Y1 > Y0 ? 1 : -1;
            }
        }
    }

    return Winding !== 0;
}

/**
 * Returns each Minecraft Ten character's cell, by code point: 16 rows of 16
 * booleans, true for ink, its first ink in column 0. Pixel centers are nudged
 * by a hundredth of a unit, so a center on an outline's edge falls one way
 * consistently. Ink a cell cannot hold is reported in `Clipped`.
 *
 * @category Tool
 * @since 1.1.64
 */
export function MinecraftTenCells()
{
    const Outline = ReadTrueType(readFileSync(path.join(FindClient(), "data/resource_packs/vanilla/font/minecraft-ten.ttf")));
    const Cells = new Map();
    const Clipped = [];
    for (let CodePoint = 0x20; CodePoint <= 0x7e; CodePoint++)
    {
        if (!IsTenCharacter(CodePoint)) continue;
        const Contours = Outline(CodePoint) ?? [];
        const Rows = Array.from({ length: 16 }, () => Array(16).fill(false));
        const Points = Contours.flat();
        if (Points.length > 0)
        {
            const Columns = Math.ceil((Math.max(...Points.map(([ X ]) => X)) - Bearing) / Pixel);
            const Low = Math.floor(Math.min(...Points.map(([ , Y ]) => Y)) / Pixel);
            const High = Math.ceil(Math.max(...Points.map(([ , Y ]) => Y)) / Pixel);
            for (let Column = 0; Column < Columns; Column++)
            {
                for (let Row = Low; Row < High; Row++)
                {
                    if (!Inside(Contours, Bearing + Pixel * Column + Pixel / 2 + 0.01, Pixel * Row + Pixel / 2 + 0.01)) continue;
                    const CellRow = BaselineRow - Row;
                    if (CellRow < 0 || CellRow > 15 || Column > 15) Clipped.push(`U+${CodePoint.toString(16)} column ${Column} row ${CellRow}`);
                    else Rows[CellRow][Column] = true;
                }
            }
        }

        Cells.set(CodePoint, Rows);
    }

    return { Cells, Clipped };
}
