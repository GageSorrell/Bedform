/**
 * Symbols for Legacy Computing cells, ported from the demo's LegacyGlyphs tool: 7 by 16 cells that
 * keep the client's 1-pixel seam and 8 by 16 wide cells for seamless layers. Mosaics, eighths,
 * triangles, shades, fills, diagonal box drawings and circles derive from names on shared anchors so
 * neighbors join; pictographs are hand drawn, and multi-cell art is cut into 7-column pieces.
 *
 * @module bedform-canvas/Tool/Glyph/Legacy
 *
 * @file      Legacy.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pixel-art tables keep the demo's compact layout so shapes remain reviewable against it. */
/* eslint-disable @stylistic/max-len, @stylistic/object-property-newline */

import { type ExtraName, IsLegacyComputing, LegacyComputingBlocks } from "./Allocation.mts";

/**
 * A cell of booleans, rows then columns; true is ink.
 *
 * @category Model
 * @since 1.0.0
 */
export type Pixels = Array<Array<boolean>>;

/**
 * Seamed cell size in pixels.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Cell = Object.freeze({ Height: 16,
    Width: 7 } as const);

/**
 * Width of the seamless layers' wide cells: the cell plus its seam.
 *
 * @category Constant
 * @since 1.0.0
 */
export const WideWidth = 8;

const DigitSegments = [ "abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg" ];

const RunningMan = [
    "..............",
    ".........##...",
    ".........##...",
    "..............",
    "......#####...",
    ".....#.###.#..",
    "....#..###..#.",
    "...#...###....",
    ".......###....",
    "......##.##...",
    ".....##...##..",
    "....##.....#..",
    "..###......#..",
    "..#........##.",
    "..............",
    ".............."
];
const Folder = [
    ".####.........",
    "#....#........",
    "#.....########",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "##############"
];
const PointingIndex = [
    ".....######..........",
    "....#......#######...",
    "###.#.............#..",
    "#.#.#....#########...",
    "#.#.#....#...........",
    "#.#.#.....####.......",
    "#.#.#....#...........",
    "#.#.#.....###........",
    "###..#...#...........",
    "......####..........."
];

/**
 * Drawing primitives bound to one cell width.
 *
 * @category Tool
 * @since 1.0.0
 */
function Drawer(width: number)
{
    const r = width - 1;
    const blank = (): Pixels => Array.from({ length: Cell.Height }, () => Array<boolean>(width).fill(false));
    const where = (pixels: Pixels, test: (cx: number, cy: number, x: number, y: number) => boolean): Pixels =>
    {
        for (let y = 0; y < Cell.Height; y++)
        {
            for (let x = 0; x < width; x++)
            {
                if (test(x + 0.5, y + 0.5, x, y))
                {
                    pixels[y][x] = true;
                }
            }
        }

        return pixels;
    };

    const shape = (test: (x: number, y: number) => boolean): Pixels => where(blank(), test);
    const grid = (test: (x: number, y: number) => boolean): Pixels =>
        where(blank(), (cx: number, cy: number) => test(cx - 0.5, cy - 0.5));
    const union = (...cells: Array<Pixels>): Pixels =>
        grid((x: number, y: number) => cells.some((pixels: Pixels) => pixels[y][x]));
    const invert = (pixels: Pixels): Pixels => grid((x: number, y: number) => !pixels[y][x]);
    const rect = (x0: number, x1: number, y0: number, y1: number): Pixels =>
        grid((x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
    // One pixel per row or column the line crosses more of, so a line keeps its slope into neighbors.
    const line = (pixels: Pixels, x0: number, y0: number, x1: number, y1: number): Pixels =>
    {
        const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let step = 0; step < steps; step++)
        {
            const t = (step + 0.5) / steps;
            const x = Math.min(r, Math.max(0, Math.floor(x0 + t * (x1 - x0))));
            const y = Math.min(Cell.Height - 1, Math.max(0, Math.floor(y0 + t * (y1 - y0))));
            pixels[y][x] = true;
        }

        return pixels;
    };

    const art = (rows: Array<string>, top: number = 0): Pixels =>
    {
        const pixels = blank();
        rows.forEach((row: string, index: number) =>
        {
            for (let x = 0; x < width; x++)
            {
                if (row[x] === "#")
                {
                    pixels[top + index][x] = true;
                }
            }
        });
        return pixels;
    };

    // Piece of multi-cell art; 8 wide, the seam column is set where the art is inked across the cut.
    const piece = (rows: Array<string>, top: number, index: number): Pixels =>
    {
        const pixels = blank();
        rows.forEach((row: string, offset: number) =>
        {
            for (let x = 0; x < 7; x++)
            {
                if (row[index * 7 + x] === "#")
                {
                    pixels[top + offset][x] = true;
                }
            }

            if (width > 7 && row[index * 7 + 6] === "#" && row[index * 7 + 7] === "#")
            {
                pixels[top + offset][7] = true;
            }
        });
        return pixels;
    };

    const ellipse = (centerX: number, centerY: number, radiusX: number, radiusY: number, outline: boolean): Pixels =>
    {
        const inside = (x: number, y: number, rx: number, ry: number): boolean =>
            ((x - centerX) / rx) ** 2 + ((y - centerY) / ry) ** 2 <= 1;
        return shape((x: number, y: number) => inside(x, y, radiusX, radiusY) &&
            !(outline && inside(x, y, radiusX - 1, radiusY - 1)));
    };

    return { art, blank, ellipse, grid, invert, line, piece, r, rect, shape, union, width };
}

/**
 * Drawing context for one width.
 *
 * @category Model
 * @since 1.0.0
 */
type Draw = ReturnType<typeof Drawer>;

const MosaicY: Readonly<Record<string, number>> = Object.freeze({ LOWER: 16, "LOWER MIDDLE": 11, UPPER: 0,
    "UPPER MIDDLE": 5 });
const LineY: Readonly<Record<string, number>> = Object.freeze({ LOWER: 16, MIDDLE: 8, UPPER: 0 });

/**
 * A named anchor, such as "UPPER MIDDLE LEFT", as its horizontal and vertical words.
 *
 * @throws { Error } If the phrase names an unknown anchor.
 *
 * @category Geometry
 * @since 1.0.0
 */
function Point(phrase: string, xs: Record<string, number>, ys: Readonly<Record<string, number>>):
{ X: number; Y: number }
{
    const words = phrase.split(" ");
    const x = xs[words.at(-1)!];
    const y = ys[words.slice(0, -1).join(" ")];
    if (x === undefined || y === undefined)
    {
        throw new Error(`Unknown point ${phrase}`);
    }

    return { X: x, Y: y };
}

/**
 * Pictographs drawn by hand at the context's width.
 *
 * @category Tool
 * @since 1.0.0
 */
function Pictographs(d: Draw, diagonal: (paths: string) => Pixels): Map<number, Pixels>
{
    const { art, invert, line, piece, r, rect, union, blank, width } = d;
    const lineX = { CENTRE: width / 2, LEFT: 0, RIGHT: width };
    return new Map([
        [ 0x1_FB_B0, art([ "#......", "##.....", "###....", "####...", "#####..", "######.", "#######",
            "###....", "#.##...", "..##...", "...##..", "...##.." ], 2) ],
        [ 0x1_FB_B1, invert(art([ "......#", ".....#.", ".....#.", "#...#..", ".#..#..", ".#.#...", "..#...." ], 4)) ],
        [ 0x1_FB_B2, piece(RunningMan, 0, 0) ],
        [ 0x1_FB_B3, piece(RunningMan, 0, 1) ],
        [ 0x1_FB_B4, invert(art([ ".....#.", ".....#.", ".....#.", ".....#.", "..#..#.", ".#...#.", "######.",
            ".#.....", "..#...." ], 3)) ],
        // The arrow's shaft runs on through the seam to the next cell, as the bars above and below it do.
        [ 0x1_FB_B5, union(rect(0, r, 0, 1), rect(0, r, 14, 15), rect(0, r, 7, 7),
            art([ "..#....", ".#.....", "#######", ".#.....", "..#...." ], 5)) ],
        [ 0x1_FB_B6, union(rect(0, r, 0, 1), rect(0, r, 14, 15), art([ "....#..", ".....#.", "#######", ".....#.", "....#.." ], 5)) ],
        [ 0x1_FB_B7, union(rect(r, r, 0, 15), art([ "..#....", "..#....", "..#....", "..#....", "..#....", "..#....",
            "..#....", "#.#.#..", ".###...", "..#...." ], 3)) ],
        [ 0x1_FB_B8, union(rect(r, r, 0, 15), art([ "..#....", ".###...", "#.#.#..", "..#....", "..#....", "..#....",
            "..#....", "..#....", "..#....", "..#...." ], 3)) ],
        [ 0x1_FB_B9, piece(Folder, 3, 0) ],
        [ 0x1_FB_BA, piece(Folder, 3, 1) ],
        [ 0x1_FB_BB, art([ "..###..", "..#.#..", "###.###", "#.....#", "###.###", "..#.#..", "..###.." ], 4) ],
        [ 0x1_FB_BC, art([ "######.", "#......", "#......", "#..##..", "#..##..", "#......", "#......", "######." ], 4) ],
        [ 0x1_FB_BD, invert(line(line(blank(), 0, 0, width, 16), width, 0, 0, 16)) ],
        [ 0x1_FB_BE, invert(line(blank(), lineX.RIGHT, LineY.MIDDLE, lineX.CENTRE, LineY.LOWER)) ],
        [ 0x1_FB_BF, invert(diagonal("DIAMOND")) ],
        // The outline of a heavy X with rounded ends, 7 by 9.
        [ 0x1_FB_C0, art([ ".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", ".#...#.", "#.....#", "#..#..#",
            ".##.##." ], 4) ],
        [ 0x1_FB_C1, piece(PointingIndex, 3, 0) ],
        [ 0x1_FB_C2, piece(PointingIndex, 3, 1) ],
        [ 0x1_FB_C3, piece(PointingIndex, 3, 2) ],
        // The negative squared question mark: a square, rows 3 to 12, with a question mark knocked out.
        [ 0x1_FB_C4, invert(union(invert(rect(0, r, 3, 12)),
            art([ "..###..", ".#...#.", ".....#.", "....#..", "...#...", "...#...", ".......", "...#..." ], 4))) ],
        [ 0x1_FB_C5, art([ "..###..", "..#.#..", "..###..", "...#...", "#######", "...#...", "...#...", "...#...",
            "..#.#..", ".#...#.", "#.....#" ], 2) ],
        [ 0x1_FB_C6, art([ "..###..", "#.#.#.#", ".#####.", "...#...", "...#...", "...#...", "...#...", "...#...",
            "..#.#..", ".#...#.", "#.....#" ], 2) ],
        [ 0x1_FB_C7, art([ "###....", "#.#....", "###....", "...#...", "######.", "....#..", "....#..", "...#.#.",
            "..#..#.", "..#...#", ".#....#" ], 2) ],
        [ 0x1_FB_C8, art([ "....###", "....#.#", "....###", "...#...", ".######", "..#....", "..#....", ".#.#...",
            ".#..#..", "#...#..", "#....#." ], 2) ],
        [ 0x1_FB_C9, art([ "..###..", "..#.#..", "..###..", "...#...", "#######", "...#...", "..###..", ".#####.",
            "#######", "..#.#..", "..#.#.." ], 2) ],
        [ 0x1_FB_CA, art([ "...#...", "..#.#..", ".#...#.", "#..#..#", "#.#.#.#", "##...##" ], 5) ],
        // The same outlined X, 7 by 7.
        [ 0x1_FB_CB, art([ ".##.##.", "#..#..#", ".#...#.", "..#.#..", ".#...#.", "#..#..#", ".##.##." ], 5) ],
        [ 0x1_FB_CC, art([ "..###..", "..#....", "..#....", "..#....", "..###.." ], 2) ],
        [ 0x1_FB_CD, art([ "...#...", "..###..", ".##.##.", "##...##" ], 7) ],
        [ 0x1_FB_FA, art([ "...#...", "..###..", ".#####.", ".#####.", ".#####.", ".#####.", "#######", "#######",
            ".......", "...#..." ], 3) ]
    ]);
}

/**
 * Draws every assigned character of the first legacy block at a width. Shade samples the vanilla
 * U+2592 medium shade; Name returns Unicode character names.
 *
 * @throws { Error } When a character has no drawing.
 *
 * @category Tool
 * @since 1.0.0
 */
export function LegacyGlyphCells(shade: (x: number, y: number) => boolean, name: (codePoint: number) => string,
    width: number = Cell.Width): Map<number, Pixels>
{
    const d = Drawer(width);
    const { ellipse, grid, invert, line, r, rect, shape, union } = d;
    const mosaicX = { CENTRE: 4, LEFT: 0, RIGHT: width };
    const lineX = { CENTRE: width / 2, LEFT: 0, RIGHT: width };
    const diagonal = (paths: string): Pixels =>
    {
        const pixels = d.blank();
        const text = paths === "DIAMOND"
            ? "UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE TO MIDDLE LEFT TO UPPER CENTRE" : paths;
        for (const path of text.split(" AND "))
        {
            const points = path.split(" TO ").map((phrase: string) => Point(phrase, lineX, LineY));
            for (let index = 1; index < points.length; index++)
            {
                line(pixels, points[index - 1].X, points[index - 1].Y, points[index].X, points[index].Y);
            }
        }

        return pixels;
    };

    const sextant = (digits: string): Pixels =>
    {
        const columns = [ [ 0, 3 ], [ 4, r ] ];
        const rows = [ [ 0, 4 ], [ 5, 10 ], [ 11, 15 ] ];
        return union(...[ ...digits ].map((digit: string) =>
        {
            const index = Number(digit) - 1;
            const [ x0, x1 ] = columns[index % 2];
            const [ y0, y1 ] = rows[Math.floor(index / 2)];
            return rect(x0, x1, y0, y1);
        }));
    };

    const mosaic = (vertical: string, horizontal: string, from: string, to: string): Pixels =>
    {
        const p = Point(from, mosaicX, MosaicY);
        const q = Point(to, mosaicX, MosaicY);
        const side = (x: number, y: number): number => (q.X - p.X) * (y - p.Y) - (q.Y - p.Y) * (x - p.X);
        const corner = side(horizontal === "LEFT" ? 0 : width, vertical === "UPPER" ? 0 : Cell.Height);
        return shape((x: number, y: number) => side(x, y) * corner >= 0);
    };

    const quarter = (side: string): Pixels => shape((x: number, y: number) =>
    {
        const u = (x - width / 2) / (width / 2);
        const v = (y - Cell.Height / 2) / (Cell.Height / 2);
        const found = Math.abs(u) >= Math.abs(v) ? (u < 0 ? "LEFT" : "RIGHT") : (v < 0 ? "UPPER" : "LOWER");
        return found === side;
    });
    const segmented = (segments: string): Pixels =>
    {
        const parts: Record<string, Pixels> = {
            a: rect(2, 4, 3, 3), b: rect(5, 5, 4, 7), c: rect(5, 5, 9, 12), d: rect(2, 4, 13, 13),
            e: rect(1, 1, 9, 12), f: rect(1, 1, 4, 7), g: rect(2, 4, 8, 8)
        };
        return union(...[ ...segments ].map((part: string) => parts[part]));
    };

    const drawn = Pictographs(d, diagonal);
    const medium = grid((x: number, y: number) => shade(x, y));
    const inverse = invert(medium);
    const masked = (mask: Pixels, pattern: Pixels): Pixels => grid((x: number, y: number) => mask[y][x] && pattern[y][x]);
    const left = rect(0, 3, 0, 15);
    const right = rect(4, r, 0, 15);
    const upper = rect(0, r, 0, 7);
    const lower = rect(0, r, 8, 15);
    const eighthRows = (n: number): Pixels => rect(0, r, 2 * (n - 1), 2 * n - 1);
    const rightEighths = (k: number): Pixels => rect(width - Math.round(width * k / 8), r, 0, 15);
    const [ centreLeft, centreRight ] = width === 8 ? [ 2, 5 ] : [ 2, 4 ];
    const fixed = (): Record<number, Pixels> => ({
        0x1_FB_68: invert(quarter("LEFT")), 0x1_FB_69: invert(quarter("UPPER")), 0x1_FB_6A: invert(quarter("RIGHT")),
        0x1_FB_6B: invert(quarter("LOWER")), 0x1_FB_6C: quarter("LEFT"), 0x1_FB_6D: quarter("UPPER"),
        0x1_FB_6E: quarter("RIGHT"), 0x1_FB_6F: quarter("LOWER"),
        0x1_FB_7C: union(rect(0, 0, 0, 15), eighthRows(8)), 0x1_FB_7D: union(rect(0, 0, 0, 15), eighthRows(1)),
        0x1_FB_7E: union(rect(r, r, 0, 15), eighthRows(1)), 0x1_FB_7F: union(rect(r, r, 0, 15), eighthRows(8)),
        0x1_FB_80: union(eighthRows(1), eighthRows(8)),
        0x1_FB_82: rect(0, r, 0, 3), 0x1_FB_83: rect(0, r, 0, 5), 0x1_FB_84: rect(0, r, 0, 9),
        0x1_FB_85: rect(0, r, 0, 11), 0x1_FB_86: rect(0, r, 0, 13),
        0x1_FB_87: rightEighths(2), 0x1_FB_88: rightEighths(3), 0x1_FB_89: rightEighths(5),
        0x1_FB_8A: rightEighths(6), 0x1_FB_8B: rightEighths(7),
        0x1_FB_8C: masked(left, medium), 0x1_FB_8D: masked(right, medium), 0x1_FB_8E: masked(upper, medium),
        0x1_FB_8F: masked(lower, medium), 0x1_FB_90: inverse,
        0x1_FB_91: union(upper, masked(lower, inverse)), 0x1_FB_92: union(masked(upper, inverse), lower),
        0x1_FB_94: union(masked(left, inverse), right),
        0x1_FB_95: grid((x: number, y: number) => ((x >> 1) + (y >> 1)) % 2 === 0),
        0x1_FB_96: grid((x: number, y: number) => ((x >> 1) + (y >> 1)) % 2 === 1),
        0x1_FB_97: grid((_: number, y: number) => (y >> 1) % 2 === 0),
        0x1_FB_98: grid((x: number, y: number) => (((x - y) % 4) + 4) % 4 < 2),
        0x1_FB_99: grid((x: number, y: number) => (x + y) % 4 < 2),
        0x1_FB_9A: union(quarter("UPPER"), quarter("LOWER")), 0x1_FB_9B: union(quarter("LEFT"), quarter("RIGHT")),
        0x1_FB_9C: masked(shape((x: number, y: number) => x / width + y / Cell.Height < 1), medium),
        0x1_FB_9D: masked(shape((x: number, y: number) => y / Cell.Height < x / width), medium),
        0x1_FB_9E: masked(shape((x: number, y: number) => x / width + y / Cell.Height > 1), medium),
        0x1_FB_9F: masked(shape((x: number, y: number) => y / Cell.Height > x / width), medium),
        0x1_FB_AF: union(rect(0, r, 7, 7), rect(3, 3, 5, 9)),
        0x1_FB_CE: rect(0, Math.round(width * 2 / 3) - 1, 0, 15), 0x1_FB_CF: rect(0, Math.round(width / 3) - 1, 0, 15),
        0x1_FB_E0: ellipse(width / 2, 0, width / 2, 8, true), 0x1_FB_E1: ellipse(width, 8, width, 8, true),
        0x1_FB_E2: ellipse(width / 2, 16, width / 2, 8, true), 0x1_FB_E3: ellipse(0, 8, width, 8, true),
        0x1_FB_E4: rect(centreLeft, centreRight, 0, 7), 0x1_FB_E5: rect(centreLeft, centreRight, 8, 15),
        0x1_FB_E6: rect(0, 3, 4, 11), 0x1_FB_E7: rect(4, r, 4, 11),
        0x1_FB_E8: ellipse(width / 2, 0, width / 2, 8, false), 0x1_FB_E9: ellipse(width, 8, width, 8, false),
        0x1_FB_EA: ellipse(width / 2, 16, width / 2, 8, false), 0x1_FB_EB: ellipse(0, 8, width, 8, false),
        0x1_FB_EC: ellipse(width, 0, width, 8, false), 0x1_FB_ED: ellipse(0, 16, width, 8, false),
        0x1_FB_EE: ellipse(width, 16, width, 8, false), 0x1_FB_EF: ellipse(0, 0, width, 8, false)
    });
    const cells = new Map<number, Pixels>();
    const block = LegacyComputingBlocks[0];
    for (let codePoint = block.First; codePoint <= block.Last; codePoint++)
    {
        if (!IsLegacyComputing(codePoint))
        {
            continue;
        }

        const label = name(codePoint);
        let match: RegExpExecArray | null;
        let pixels: Pixels | undefined;
        if ((match = /^BLOCK SEXTANT-(\d+)$/u.exec(label)))
        {
            pixels = sextant(match[1]);
        }
        else if ((match = /^(LOWER|UPPER) (LEFT|RIGHT) BLOCK DIAGONAL (.+) TO (.+)$/u.exec(label)))
        {
            pixels = mosaic(match[1], match[2], match[3], match[4]);
        }
        else if ((match = /^BOX DRAWINGS LIGHT DIAGONAL (.+)$/u.exec(label)))
        {
            pixels = diagonal(match[1]);
        }
        else if ((match = /^VERTICAL ONE EIGHTH BLOCK-(\d)$/u.exec(label)))
        {
            pixels = rect(Number(match[1]) - 1, Number(match[1]) - 1, 0, 15);
        }
        else if ((match = /^HORIZONTAL ONE EIGHTH BLOCK-(\d+)$/u.exec(label)))
        {
            pixels = union(...[ ...match[1] ].map((n: string) => eighthRows(Number(n))));
        }
        else if (/^SEGMENTED DIGIT (\w+)$/u.test(label))
        {
            pixels = segmented(DigitSegments[codePoint - 0x1_FB_F0]);
        }
        else if (drawn.has(codePoint))
        {
            pixels = drawn.get(codePoint);
        }
        else
        {
            pixels = fixed()[codePoint];
        }

        if (!pixels)
        {
            throw new Error(`No drawing for U+${codePoint.toString(16).toUpperCase()} ${label}`);
        }

        cells.set(codePoint, pixels);
    }

    return cells;
}

/**
 * The sextant-completing extras at a width: blank, full block and left and right halves.
 *
 * @category Tool
 * @since 1.0.0
 */
export function LegacyExtraCells(width: number = Cell.Width): Map<ExtraName, Pixels>
{
    const { blank, r, rect } = Drawer(width);
    return new Map<ExtraName, Pixels>([
        [ "Blank", blank() ],
        [ "Full", rect(0, r, 0, 15) ],
        [ "LeftHalf", rect(0, 3, 0, 15) ],
        [ "RightHalf", rect(4, r, 0, 15) ]
    ]);
}
