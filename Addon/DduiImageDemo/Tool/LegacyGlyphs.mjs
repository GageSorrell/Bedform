/**
 * The Symbols for Legacy Computing glyphs, as cells of the Unicode font's
 * pixels for Tool/CustomGlyph.mjs: 7 by 16 for glyphs that keep the game's
 * 1-pixel seam, and 8 by 16 for the seamless layers' wide glyphs, whose last
 * column fills the seam. Mosaics, eighths, triangles, shades, fills, diagonal
 * box drawings and circles are drawn from their names or code points on
 * shared anchors, so neighbors join: columns split 4 and 3 (4 and 4 when 8
 * wide), rows 5, 6 and 5. Diagonal lines run between the cell's corners and
 * edge midpoints, so a line keeps its slope from one glyph into the next. The
 * pictographs are drawn by hand; those spanning two or three cells are drawn
 * whole and cut into 7-column pieces, and 8 wide, each piece's last column is
 * set where the art is inked on both sides of the cut.
 *
 * @module @sorrell/ddui-image-demo/Tool/LegacyGlyphs
 *
 * @file      LegacyGlyphs.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { IsLegacyComputing, LegacyComputingBlock } from "../Source/LegacyComputing.js";
import { CharacterName } from "../Source/UnicodeBrowser.js";

/**
 * Cell width and height in pixels, for glyphs that keep the seam.
 *
 * @category Constant
 * @since 1.1.48
 */
export const Cell = Object.freeze({ Height: 16, Width: 7 });

/**
 * The width of the seamless layers' wide glyphs: the cell and its seam.
 *
 * @category Constant
 * @since 1.1.66
 */
export const WideWidth = 8;

/** The width the cells are being drawn at, and its last column. */
let Width = Cell.Width;
let R = Width - 1;

const Blank = () => Array.from({ length: Cell.Height }, () => Array(Width).fill(false));

/** Sets every pixel whose center passes a test of its coordinates. */
function Where(Pixels, Test)
{
    for (let Y = 0; Y < Cell.Height; Y++)
    {
        for (let X = 0; X < Width; X++)
        {
            if (Test(X + 0.5, Y + 0.5, X, Y)) Pixels[Y][X] = true;
        }
    }

    return Pixels;
}

/** A cell of the pixels whose centers pass a test. */
const Shape = (Test) => Where(Blank(), Test);
/** A cell of the pixels whose column and row pass a test. */
const Grid = (Test) => Where(Blank(), (CenterX, CenterY) => Test(CenterX - 0.5, CenterY - 0.5));
const Union = (...Cells) => Grid((X, Y) => Cells.some((Pixels) => Pixels[Y][X]));
const Invert = (Pixels) => Grid((X, Y) => !Pixels[Y][X]);
const Rect = (X0, X1, Y0, Y1) => Grid((X, Y) => X >= X0 && X <= X1 && Y >= Y0 && Y <= Y1);

/**
 * Draws a 1-pixel line between two points in the cell's continuous
 * coordinates (0 to the width across, 0 to 16 down): one pixel for each row
 * or column, whichever the line crosses more of, the pixel under the line at
 * that row's or column's center. A line ending on a cell's edge thus
 * continues at the same slope in the neighbor that starts there (1.1.66:
 * lines between fixed pixels met their neighbors in a flat step).
 */
function Line(Pixels, X0, Y0, X1, Y1)
{
    const Steps = Math.max(1, Math.round(Math.max(Math.abs(X1 - X0), Math.abs(Y1 - Y0))));
    for (let Step = 0; Step < Steps; Step++)
    {
        const T = (Step + 0.5) / Steps;
        const X = Math.min(R, Math.max(0, Math.floor(X0 + T * (X1 - X0))));
        const Y = Math.min(Cell.Height - 1, Math.max(0, Math.floor(Y0 + T * (Y1 - Y0))));
        Pixels[Y][X] = true;
    }

    return Pixels;
}

/** A cell from text art, `#` set, placed from row `Top`; art narrower than the cell leaves the rest empty. */
function Art(Rows, Top = 0)
{
    const Pixels = Blank();
    Rows.forEach((Row, Index) =>
    {
        for (let X = 0; X < Width; X++) if (Row[X] === "#") Pixels[Top + Index][X] = true;
    });
    return Pixels;
}

/**
 * Piece `Index` of art spanning several cells, cut every 7 columns. Drawn 8
 * wide, the piece's last column, which fills the seam, is set where the art
 * is inked on both sides of the cut, so outlines run through it.
 */
function Piece(Rows, Top, Index)
{
    const Pixels = Blank();
    Rows.forEach((Row, Line) =>
    {
        for (let X = 0; X < 7; X++) if (Row[Index * 7 + X] === "#") Pixels[Top + Line][X] = true;
        if (Width > 7 && Row[Index * 7 + 6] === "#" && Row[Index * 7 + 7] === "#") Pixels[Top + Line][7] = true;
    });
    return Pixels;
}

/** Pixels inside an ellipse, or on its 1-pixel outline when `Outline` is set. */
function Ellipse(CenterX, CenterY, RadiusX, RadiusY, Outline)
{
    const Inside = (X, Y, Rx, Ry) => ((X - CenterX) / Rx) ** 2 + ((Y - CenterY) / Ry) ** 2 <= 1;
    return Shape((X, Y) => Inside(X, Y, RadiusX, RadiusY) && !(Outline && Inside(X, Y, RadiusX - 1, RadiusY - 1)));
}

// Smooth mosaic anchors: the sextant grid's column and row boundaries.
const MosaicX = () => ({ CENTRE: 4, LEFT: 0, RIGHT: Width });
const MosaicY = Object.freeze({ LOWER: 16, "LOWER MIDDLE": 11, UPPER: 0, "UPPER MIDDLE": 5 });
// Diagonal box drawing anchors: the cell's edges and midlines, in continuous coordinates.
const LineX = () => ({ CENTRE: Width / 2, LEFT: 0, RIGHT: Width });
const LineY = Object.freeze({ LOWER: 16, MIDDLE: 8, UPPER: 0 });

/** A named point, such as "UPPER MIDDLE LEFT", as its horizontal and vertical words. */
function Point(Phrase, Xs, Ys)
{
    const Words = Phrase.split(" ");
    const X = Xs[Words.at(-1)];
    const Y = Ys[Words.slice(0, -1).join(" ")];
    if (X === undefined || Y === undefined) throw new Error(`Unknown point ${Phrase}`);
    return { X, Y };
}

/** A sextant: its numbered subcells, 1 and 2 in the top row, left then right. */
function Sextant(Digits)
{
    const Columns = [ [ 0, 3 ], [ 4, R ] ];
    const Rows = [ [ 0, 4 ], [ 5, 10 ], [ 11, 15 ] ];
    return Union(...[ ...Digits ].map((Digit) =>
    {
        const Index = Number(Digit) - 1;
        const [ X0, X1 ] = Columns[Index % 2];
        const [ Y0, Y1 ] = Rows[Math.floor(Index / 2)];
        return Rect(X0, X1, Y0, Y1);
    }));
}

/** A smooth mosaic: the part of the cell on the named corner's side of the line from P to Q. */
function Mosaic(Vertical, Horizontal, From, To)
{
    const P = Point(From, MosaicX(), MosaicY);
    const Q = Point(To, MosaicX(), MosaicY);
    const Side = (X, Y) => (Q.X - P.X) * (Y - P.Y) - (Q.Y - P.Y) * (X - P.X);
    const Corner = Side(Horizontal === "LEFT" ? 0 : Width, Vertical === "UPPER" ? 0 : Cell.Height);
    return Shape((X, Y) => Side(X, Y) * Corner >= 0);
}

/** Diagonal box drawing paths: "A TO B TO C AND D TO E", or the diamond. */
function DiagonalLines(Paths)
{
    const Pixels = Blank();
    const Text = Paths === "DIAMOND" ? "UPPER CENTRE TO MIDDLE RIGHT TO LOWER CENTRE TO MIDDLE LEFT TO UPPER CENTRE" : Paths;
    for (const Path of Text.split(" AND "))
    {
        const Points = Path.split(" TO ").map((Phrase) => Point(Phrase, LineX(), LineY));
        for (let Index = 1; Index < Points.length; Index++)
        {
            Line(Pixels, Points[Index - 1].X, Points[Index - 1].Y, Points[Index].X, Points[Index].Y);
        }
    }

    return Pixels;
}

// Triangles meeting at the cell's center, which partition the cell.
const Quarter = (Name) => Shape((X, Y) =>
{
    const U = (X - Width / 2) / (Width / 2);
    const V = (Y - Cell.Height / 2) / (Cell.Height / 2);
    const Side = Math.abs(U) >= Math.abs(V) ? (U < 0 ? "LEFT" : "RIGHT") : (V < 0 ? "UPPER" : "LOWER");
    return Side === Name;
});

/** A 7-segment digit: segments a to g, top clockwise then the middle, in columns 1 to 5 and rows 3 to 13. */
function Segmented(Segments)
{
    const Parts = {
        a: Rect(2, 4, 3, 3), b: Rect(5, 5, 4, 7), c: Rect(5, 5, 9, 12), d: Rect(2, 4, 13, 13),
        e: Rect(1, 1, 9, 12), f: Rect(1, 1, 4, 7), g: Rect(2, 4, 8, 8)
    };
    return Union(...[ ...Segments ].map((Name) => Parts[Name]));
}

const DigitSegments = [ "abcdef", "bc", "abged", "abgcd", "fgbc", "afgcd", "afgedc", "abc", "abcdefg", "abcdfg" ];

// Pictographs drawn by hand.
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

/** The pictographs, drawn at the current width. */
const Pictographs = () => new Map([
    [ 0x1fbb0, Art([ "#......", "##.....", "###....", "####...", "#####..", "######.", "#######",
        "###....", "#.##...", "..##...", "...##..", "...##.." ], 2) ],
    [ 0x1fbb1, Invert(Art([ "......#", ".....#.", ".....#.", "#...#..", ".#..#..", ".#.#...", "..#...." ], 4)) ],
    [ 0x1fbb2, Piece(RunningMan, 0, 0) ],
    [ 0x1fbb3, Piece(RunningMan, 0, 1) ],
    [ 0x1fbb4, Invert(Art([ ".....#.", ".....#.", ".....#.", ".....#.", "..#..#.", ".#...#.", "######.",
        ".#.....", "..#...." ], 3)) ],
    // The arrow's shaft runs on through the seam to the next cell, as the bars above and below it do.
    [ 0x1fbb5, Union(Rect(0, R, 0, 1), Rect(0, R, 14, 15), Rect(0, R, 7, 7),
        Art([ "..#....", ".#.....", "#######", ".#.....", "..#...." ], 5)) ],
    [ 0x1fbb6, Union(Rect(0, R, 0, 1), Rect(0, R, 14, 15), Art([ "....#..", ".....#.", "#######", ".....#.", "....#.." ], 5)) ],
    [ 0x1fbb7, Union(Rect(R, R, 0, 15), Art([ "..#....", "..#....", "..#....", "..#....", "..#....", "..#....",
        "..#....", "#.#.#..", ".###...", "..#...." ], 3)) ],
    [ 0x1fbb8, Union(Rect(R, R, 0, 15), Art([ "..#....", ".###...", "#.#.#..", "..#....", "..#....", "..#....",
        "..#....", "..#....", "..#....", "..#...." ], 3)) ],
    [ 0x1fbb9, Piece(Folder, 3, 0) ],
    [ 0x1fbba, Piece(Folder, 3, 1) ],
    [ 0x1fbbb, Art([ "..###..", "..#.#..", "###.###", "#.....#", "###.###", "..#.#..", "..###.." ], 4) ],
    [ 0x1fbbc, Art([ "######.", "#......", "#......", "#..##..", "#..##..", "#......", "#......", "######." ], 4) ],
    [ 0x1fbbd, Invert(Line(Line(Blank(), 0, 0, Width, 16), Width, 0, 0, 16)) ],
    [ 0x1fbbe, Invert(Line(Blank(), LineX().RIGHT, LineY.MIDDLE, LineX().CENTRE, LineY.LOWER)) ],
    [ 0x1fbbf, Invert(DiagonalLines("DIAMOND")) ],
    // The outline of a heavy X with rounded ends, 7 by 9; traced automatically, an outline this small is dotted.
    [ 0x1fbc0, Art([ ".##.##.", "#..#..#", "#.....#", ".#...#.", "..#.#..", ".#...#.", "#.....#", "#..#..#",
        ".##.##." ], 4) ],
    [ 0x1fbc1, Piece(PointingIndex, 3, 0) ],
    [ 0x1fbc2, Piece(PointingIndex, 3, 1) ],
    [ 0x1fbc3, Piece(PointingIndex, 3, 2) ],
    // The negative squared question mark: a white square, rows 3 to 12, with a question mark knocked out of it.
    [ 0x1fbc4, Invert(Union(Invert(Rect(0, R, 3, 12)),
        Art([ "..###..", ".#...#.", ".....#.", "....#..", "...#...", "...#...", ".......", "...#..." ], 4))) ],
    [ 0x1fbc5, Art([ "..###..", "..#.#..", "..###..", "...#...", "#######", "...#...", "...#...", "...#...",
        "..#.#..", ".#...#.", "#.....#" ], 2) ],
    [ 0x1fbc6, Art([ "..###..", "#.#.#.#", ".#####.", "...#...", "...#...", "...#...", "...#...", "...#...",
        "..#.#..", ".#...#.", "#.....#" ], 2) ],
    [ 0x1fbc7, Art([ "###....", "#.#....", "###....", "...#...", "######.", "....#..", "....#..", "...#.#.",
        "..#..#.", "..#...#", ".#....#" ], 2) ],
    [ 0x1fbc8, Art([ "....###", "....#.#", "....###", "...#...", ".######", "..#....", "..#....", ".#.#...",
        ".#..#..", "#...#..", "#....#." ], 2) ],
    [ 0x1fbc9, Art([ "..###..", "..#.#..", "..###..", "...#...", "#######", "...#...", "..###..", ".#####.",
        "#######", "..#.#..", "..#.#.." ], 2) ],
    [ 0x1fbca, Art([ "...#...", "..#.#..", ".#...#.", "#..#..#", "#.#.#.#", "##...##" ], 5) ],
    // The same outlined X, 7 by 7.
    [ 0x1fbcb, Art([ ".##.##.", "#..#..#", ".#...#.", "..#.#..", ".#...#.", "#..#..#", ".##.##." ], 5) ],
    [ 0x1fbcc, Art([ "..###..", "..#....", "..#....", "..#....", "..###.." ], 2) ],
    [ 0x1fbcd, Art([ "...#...", "..###..", ".##.##.", "##...##" ], 7) ],
    [ 0x1fbfa, Art([ "...#...", "..###..", ".#####.", ".#####.", ".#####.", ".#####.", "#######", "#######",
        ".......", "...#..." ], 3) ]
]);

/** Runs `Draw` with the cells `CellWidth` columns wide. */
function AtWidth(CellWidth, Draw)
{
    Width = CellWidth;
    R = Width - 1;
    try
    {
        return Draw();
    }
    finally
    {
        Width = Cell.Width;
        R = Width - 1;
    }
}

/**
 * Returns every assigned character's cell, by code point, as rows of
 * booleans: true for ink, `CellWidth` columns wide (7, or `WideWidth` for the
 * seamless layers). `Shade(X, Y)` is the medium shade pattern, which
 * Tool/CustomGlyph.mjs samples from the vanilla Unicode font's U+2592.
 *
 * @throws { Error } When a character has no drawing.
 *
 * @category Tool
 * @since 1.1.48
 */
export function LegacyGlyphCells(Shade, CellWidth = Cell.Width)
{
    return AtWidth(CellWidth, () => DrawCells(Shade));
}

/**
 * The cells that complete the sextants, which Unicode encodes as Block
 * Elements rather than as Symbols for Legacy Computing, by the names of
 * `LegacyExtraGlyphs` in Source/LegacyComputing.js, `CellWidth` columns wide:
 * a blank, which has no ink, the full block and the left and right halves.
 *
 * @category Tool
 * @since 1.1.66
 */
export function LegacyExtraCells(CellWidth = Cell.Width)
{
    return AtWidth(CellWidth, () => new Map([
        [ "Blank", Blank() ],
        [ "Full", Rect(0, R, 0, 15) ],
        [ "LeftHalf", Rect(0, 3, 0, 15) ],
        [ "RightHalf", Rect(4, R, 0, 15) ]
    ]));
}

/** Draws every assigned character's cell at the current width. */
function DrawCells(Shade)
{
    const Drawn = Pictographs();
    const Medium = Grid((X, Y) => Shade(X, Y));
    const Inverse = Invert(Medium);
    const Masked = (Mask, Pattern) => Grid((X, Y) => Mask[Y][X] && Pattern[Y][X]);
    const Left = Rect(0, 3, 0, 15);
    const Right = Rect(4, R, 0, 15);
    const Upper = Rect(0, R, 0, 7);
    const Lower = Rect(0, R, 8, 15);
    const EighthRows = (N) => Rect(0, R, 2 * (N - 1), 2 * N - 1);
    // A right block K eighths wide: the nearest whole number of columns.
    const RightEighths = (K) => Rect(Width - Math.round(Width * K / 8), R, 0, 15);
    // A centered quarter: columns 2 to 4 of 7, 2 to 5 of 8.
    const [ CentreLeft, CentreRight ] = Width === 8 ? [ 2, 5 ] : [ 2, 4 ];
    const Cells = new Map();
    for (let CodePoint = LegacyComputingBlock.First; CodePoint <= LegacyComputingBlock.Last; CodePoint++)
    {
        if (!IsLegacyComputing(CodePoint)) continue;
        const Name = CharacterName(CodePoint);
        let Match;
        let Pixels;
        if ((Match = /^BLOCK SEXTANT-(\d+)$/u.exec(Name))) Pixels = Sextant(Match[1]);
        else if ((Match = /^(LOWER|UPPER) (LEFT|RIGHT) BLOCK DIAGONAL (.+) TO (.+)$/u.exec(Name)))
        {
            Pixels = Mosaic(Match[1], Match[2], Match[3], Match[4]);
        }
        else if ((Match = /^BOX DRAWINGS LIGHT DIAGONAL (.+)$/u.exec(Name))) Pixels = DiagonalLines(Match[1]);
        else if ((Match = /^VERTICAL ONE EIGHTH BLOCK-(\d)$/u.exec(Name))) Pixels = Rect(Number(Match[1]) - 1, Number(Match[1]) - 1, 0, 15);
        else if ((Match = /^HORIZONTAL ONE EIGHTH BLOCK-(\d+)$/u.exec(Name))) Pixels = Union(...[ ...Match[1] ].map((N) => EighthRows(Number(N))));
        else if ((Match = /^SEGMENTED DIGIT (\w+)$/u.exec(Name))) Pixels = Segmented(DigitSegments[CodePoint - 0x1fbf0]);
        else if (Drawn.has(CodePoint)) Pixels = Drawn.get(CodePoint);
        else Pixels = {
            0x1fb68: Invert(Quarter("LEFT")), 0x1fb69: Invert(Quarter("UPPER")), 0x1fb6a: Invert(Quarter("RIGHT")),
            0x1fb6b: Invert(Quarter("LOWER")), 0x1fb6c: Quarter("LEFT"), 0x1fb6d: Quarter("UPPER"),
            0x1fb6e: Quarter("RIGHT"), 0x1fb6f: Quarter("LOWER"),
            0x1fb7c: Union(Rect(0, 0, 0, 15), EighthRows(8)), 0x1fb7d: Union(Rect(0, 0, 0, 15), EighthRows(1)),
            0x1fb7e: Union(Rect(R, R, 0, 15), EighthRows(1)), 0x1fb7f: Union(Rect(R, R, 0, 15), EighthRows(8)),
            0x1fb80: Union(EighthRows(1), EighthRows(8)),
            0x1fb82: Rect(0, R, 0, 3), 0x1fb83: Rect(0, R, 0, 5), 0x1fb84: Rect(0, R, 0, 9),
            0x1fb85: Rect(0, R, 0, 11), 0x1fb86: Rect(0, R, 0, 13),
            0x1fb87: RightEighths(2), 0x1fb88: RightEighths(3), 0x1fb89: RightEighths(5),
            0x1fb8a: RightEighths(6), 0x1fb8b: RightEighths(7),
            0x1fb8c: Masked(Left, Medium), 0x1fb8d: Masked(Right, Medium), 0x1fb8e: Masked(Upper, Medium),
            0x1fb8f: Masked(Lower, Medium), 0x1fb90: Inverse,
            0x1fb91: Union(Upper, Masked(Lower, Inverse)), 0x1fb92: Union(Masked(Upper, Inverse), Lower),
            0x1fb94: Union(Masked(Left, Inverse), Right),
            0x1fb95: Grid((X, Y) => ((X >> 1) + (Y >> 1)) % 2 === 0),
            0x1fb96: Grid((X, Y) => ((X >> 1) + (Y >> 1)) % 2 === 1),
            0x1fb97: Grid((X, Y) => (Y >> 1) % 2 === 0),
            0x1fb98: Grid((X, Y) => (((X - Y) % 4) + 4) % 4 < 2),
            0x1fb99: Grid((X, Y) => (X + Y) % 4 < 2),
            0x1fb9a: Union(Quarter("UPPER"), Quarter("LOWER")), 0x1fb9b: Union(Quarter("LEFT"), Quarter("RIGHT")),
            0x1fb9c: Masked(Shape((X, Y) => X / Width + Y / Cell.Height < 1), Medium),
            0x1fb9d: Masked(Shape((X, Y) => Y / Cell.Height < X / Width), Medium),
            0x1fb9e: Masked(Shape((X, Y) => X / Width + Y / Cell.Height > 1), Medium),
            0x1fb9f: Masked(Shape((X, Y) => Y / Cell.Height > X / Width), Medium),
            0x1fbaf: Union(Rect(0, R, 7, 7), Rect(3, 3, 5, 9)),
            0x1fbce: Rect(0, Math.round(Width * 2 / 3) - 1, 0, 15), 0x1fbcf: Rect(0, Math.round(Width / 3) - 1, 0, 15),
            0x1fbe0: Ellipse(Width / 2, 0, Width / 2, 8, true), 0x1fbe1: Ellipse(Width, 8, Width, 8, true),
            0x1fbe2: Ellipse(Width / 2, 16, Width / 2, 8, true), 0x1fbe3: Ellipse(0, 8, Width, 8, true),
            0x1fbe4: Rect(CentreLeft, CentreRight, 0, 7), 0x1fbe5: Rect(CentreLeft, CentreRight, 8, 15),
            0x1fbe6: Rect(0, 3, 4, 11), 0x1fbe7: Rect(4, R, 4, 11),
            0x1fbe8: Ellipse(Width / 2, 0, Width / 2, 8, false), 0x1fbe9: Ellipse(Width, 8, Width, 8, false),
            0x1fbea: Ellipse(Width / 2, 16, Width / 2, 8, false), 0x1fbeb: Ellipse(0, 8, Width, 8, false),
            0x1fbec: Ellipse(Width, 0, Width, 8, false), 0x1fbed: Ellipse(0, 16, Width, 8, false),
            0x1fbee: Ellipse(Width, 16, Width, 8, false), 0x1fbef: Ellipse(0, 0, Width, 8, false)
        }[CodePoint];
        if (!Pixels) throw new Error(`No drawing for U+${CodePoint.toString(16).toUpperCase()} ${Name}`);
        Cells.set(CodePoint, Pixels);
    }

    return Cells;
}
