/**
 * Symbols for Legacy Computing Supplement stand-ins adapted from GNU Unifont, ported from the demo's
 * LegacySupplementGlyphs tool: 8-column Unifont cells are narrowed to the 7-column seamed cell, and
 * the wide copies keep Unifont's own 8 columns.
 *
 * @module bedform-canvas/Tool/Glyph/Supplement
 *
 * @file      Supplement.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { IsLegacyComputing, LegacyComputingBlocks } from "./Allocation.mts";
import type { Pixels } from "./Legacy.mts";

// Families whose glyphs tile with neighbors; their eighth column is the seam and can be dropped.
const Tiling = new RegExp([
    "HALF", "QUADRANT", "THIRD", "BLOCK", "FILL", "LARGE TYPE PIECE", "BOX DRAWINGS", "TWELFTH CIRCLE",
    "QUARTER CIRCLE", "SEGMENT", "LADDER", "LINE WITH", "INDUCTOR", "RESISTOR", "CAPACITOR", "DIODE",
    "TRANSISTOR", "LOGIC GATE", "ZIGZAG", "DASH", "ANTENNA", "RECEPTACLE"
].join("|"), "u");

// Separated blocks leave column 0 as a gutter; every glyph of the family drops it to stay aligned.
const LeftGutter = /^SEPARATED BLOCK (QUADRANT|SEXTANT)-/u;

/**
 * The column whose removal changes the glyph least, preferring the center on ties.
 *
 * @category Tool
 * @since 1.0.0
 */
function RedundantColumn(rows: ReadonlyArray<ReadonlyArray<boolean>>): number
{
    const column = (x: number): Array<boolean> => rows.map((row: ReadonlyArray<boolean>) => row[x]);
    const distance = (a: Array<boolean>, b: Array<boolean>): number =>
        a.reduce((sum: number, bit: boolean, index: number) => sum + (bit !== b[index] ? 1 : 0), 0);
    let best: { Center: number;
        Score: number;
        X: number } | undefined;
    for (let x = 1; x <= 6; x++)
    {
        const score = Math.min(distance(column(x), column(x - 1)), distance(column(x), column(x + 1)));
        const center = Math.abs(x - 3.5);
        if (!best || score < best.Score || (score === best.Score && center < best.Center))
        {
            best = { Center: center,
                Score: score,
                X: x };
        }
    }

    return best!.X;
}

/**
 * Narrows an 8-column Unifont cell to 7 columns and names the method used.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Narrow(rows: ReadonlyArray<ReadonlyArray<boolean>>, tiles: boolean, gutter: boolean = false):
{ Method: string;
    Rows: Pixels }
{
    const has = (x: number): boolean => rows.some((row: ReadonlyArray<boolean>) => row[x]);
    const keep = (from: number, to: number): Pixels =>
        rows.map((row: ReadonlyArray<boolean>) => row.slice(from, to));
    if (gutter)
    {
        return { Method: "gutter",
            Rows: keep(1, 8) };
    }

    if (!has(7))
    {
        return { Method: "fits",
            Rows: keep(0, 7) };
    }

    if (tiles)
    {
        return { Method: "seam",
            Rows: keep(0, 7) };
    }

    if (!has(0))
    {
        return { Method: "shift",
            Rows: keep(1, 8) };
    }

    const drop = RedundantColumn(rows);
    return { Method: `column ${drop}`,
        Rows: rows.map((row: ReadonlyArray<boolean>) => row.filter((_: boolean, x: number) => x !== drop)) };
}

/**
 * Every assigned supplement character's narrow and wide cells, with the narrowing method.
 *
 * @throws { Error } If Unifont lacks a narrow glyph for an assigned character.
 *
 * @category Tool
 * @since 1.0.0
 */
export function LegacySupplementCells(unifont: ReadonlyMap<number, ReadonlyArray<ReadonlyArray<boolean>>>,
    name: (codePoint: number) => string): { Cells: Map<number, Pixels>;
    Methods: Map<number, string>;
    Wide: Map<number, Pixels> }
{
    const supplement = LegacyComputingBlocks[1];
    const cells = new Map<number, Pixels>();
    const methods = new Map<number, string>();
    const wide = new Map<number, Pixels>();
    for (let codePoint = supplement.First; codePoint <= supplement.Last; codePoint++)
    {
        if (!IsLegacyComputing(codePoint))
        {
            continue;
        }

        const rows = unifont.get(codePoint);
        if (!rows || rows[0].length !== 8)
        {
            throw new Error(`Unifont has no narrow glyph for U+${codePoint.toString(16).toUpperCase()}.`);
        }

        const label = name(codePoint);
        const { Method: method, Rows: narrowed } = Narrow(rows, Tiling.test(label), LeftGutter.test(label));
        cells.set(codePoint, narrowed);
        wide.set(codePoint, rows.map((row: ReadonlyArray<boolean>) => [ ...row ]));
        methods.set(codePoint, method);
    }

    return { Cells: cells,
        Methods: methods,
        Wide: wide };
}
