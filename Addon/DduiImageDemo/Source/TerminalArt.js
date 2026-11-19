/**
 * Terminal-style tables and a looping two-dimensional Braille wave animation.
 *
 * @module @sorrell/ddui-image-demo/Source/TerminalArt
 *
 * @file      TerminalArt.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Converts ASCII letters and digits to their fullwidth Unicode counterparts.
 *
 * @category Converting
 * @since 1.1.8
 */
function Fullwidth(Text)
{
    return Text.replace(/[A-Za-z0-9]/g, (Character) => String.fromCodePoint(Character.codePointAt(0) + 0xfee0));
}

/**
 * Builds a box-drawing table, accounting for two terminal cells per fullwidth
 * letter or digit. Both versions contain headings, words and numeric values.
 *
 * @category Formatting
 * @since 1.1.8
 */
export function TerminalTable(Wide = false)
{
    const Rows = [ ["SYSTEM", "LEVEL", "STATE"], ["GARDEN", "024", "BLOOM"],
        ["WATER", "086", "FLOW"], ["LIGHT", "100", "GLOW"] ];
    const Converted = Rows.map((Row) => Row.map((Text) => Wide ? Fullwidth(Text) : Text));
    const Width = (Text) => [...Text].reduce((Total, Character) => Total +
        (Character.codePointAt(0) >= 0xff01 && Character.codePointAt(0) <= 0xff60 ? 2 : 1), 0);
    const Widths = Rows[0].map((_, Column) => Math.max(...Converted.map((Row) => Width(Row[Column]))) + 2);
    const Rule = (Left, Middle, Right) => Left + Widths.map((Count) => "─".repeat(Count)).join(Middle) + Right;
    const Content = (Row) => "│" + Row.map((Text, Index) => " " + Text + " ".repeat(Widths[Index] - Width(Text) - 1)).join("│") + "│";
    return [Rule("┌", "┬", "┐"), Content(Converted[0]), Rule("├", "┼", "┤"),
        ...Converted.slice(1).map(Content), Rule("└", "┴", "┘")].join("\n");
}

/**
 * Rasterizes three flowing wave ribbons and orbiting fireflies into a 64 by
 * 32 dot canvas, packed as 8 rows of 32 Braille cells, one string per cell. The
 * motion loops in 12 seconds.
 *
 * @category Animation
 * @since 1.1.13
 */
function BrailleCells(Seconds)
{
    const Width = 64;
    const Height = 32;
    const Cells = new Uint8Array(32 * 8);
    const Bits = [1, 8, 2, 16, 4, 32, 64, 128];
    const Dot = (X, Y) =>
    {
        X = Math.round(X);
        Y = Math.round(Y);
        if (X < 0 || X >= Width || Y < 0 || Y >= Height) return;
        Cells[Math.floor(Y / 4) * 32 + Math.floor(X / 2)] |= Bits[(Y % 4) * 2 + X % 2];
    };
    const Phase = (((Seconds % 12) + 12) % 12) * Math.PI / 6;
    for (let X = 0; X < Width; X++)
    {
        for (let Ribbon = 0; Ribbon < 3; Ribbon++)
        {
            const Y = 16 + Math.sin(X * Math.PI / 32 + Phase + Ribbon * 1.4) * (5 + Ribbon * 2) +
                Math.sin(X * Math.PI / 16 - Phase * 2) * 2;
            Dot(X, Y);
            Dot(X, Y + 1);
        }
    }
    for (let Index = 0; Index < 10; Index++)
    {
        const Angle = Phase + Index * Math.PI / 5;
        const X = 31.5 + Math.cos(Angle) * 25;
        const Y = 15.5 + Math.sin(Angle * 2) * 12;
        Dot(X, Y);
        Dot(X - 1, Y);
        Dot(X + 1, Y);
        Dot(X, Y - 1);
        Dot(X, Y + 1);
    }
    const Rows = [];
    for (let Y = 0; Y < 8; Y++)
    {
        const Row = Cells.slice(Y * 32, (Y + 1) * 32);
        Rows.push(Array.from(Row, (Value) => String.fromCodePoint(0x2800 + Value)));
    }
    return Rows;
}

/**
 * Formatting code for a canvas row: light aqua at the top, dark aqua in the
 * middle and blue at the bottom of each 8-row animation tile.
 *
 * @category Animation
 * @since 1.1.13
 */
function RowColor(Y)
{
    const Row = Y % 8;
    return Row < 3 ? "§b" : Row < 6 ? "§3" : "§9";
}

/**
 * Renders one frame of the 32 by 8 cell Braille fireflies animation, beneath a
 * title line.
 *
 * @category Animation
 * @since 1.1.8
 */
export function BrailleFrame(Seconds)
{
    return "§r§bAnimated Demonstration (Fireflies) §r§7~20 fps\n" + BrailleCanvas(Seconds);
}

/**
 * One frame of the fireflies animation without its title line: 8 rows of 32
 * Braille cells, each row starting with its color code.
 *
 * @category Animation
 * @since 1.1.67
 */
export function BrailleCanvas(Seconds)
{
    return BrailleCells(Seconds).map((Characters, Y) => RowColor(Y) + Characters.join("")).join("\n");
}

/**
 * Width of the terminal in cells. A `TextPrimitive` rejects any line longer than
 * 128 UTF-8 bytes, and each Braille cell takes three, so 64 columns cannot fit;
 * 40 columns leave room for the color codes around the written text.
 *
 * @category Animation
 * @since 1.1.13
 */
const TerminalColumns = 40;

/**
 * Height of the terminal in cells: twice the fireflies canvas.
 *
 * @category Animation
 * @since 1.1.13
 */
const TerminalRows = 16;

/**
 * Non-Braille text written over the terminal, as row, column and text. Each
 * character, including a space, replaces exactly one Braille cell, as in a
 * terminal emulator with single-width glyphs. The runs cover A–Z, a–z, Unicode
 * Roman numerals (U+2160–U+217F), digits and common punctuation.
 *
 * @category Animation
 * @since 1.1.13
 */
const TerminalText = Object.freeze([
    [ 0, 2, "ABCDEFGHIJKLM" ], [ 0, 24, "NOPQRSTUVWXYZ" ],
    [ 1, 10, "MMMMMWWWWWiiiiilllll" ],
    [ 2, 4, "abcdefghijklm" ], [ 2, 22, "nopqrstuvwxyz" ],
    [ 3, 6, "The quick brown fox" ],
    [ 4, 14, "jumps over the lazy dog." ],
    [ 5, 7, "Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ Ⅵ Ⅶ Ⅷ" ], [ 5, 24, "Ⅸ Ⅹ Ⅺ" ],
    [ 6, 1, "Ⅻ Ⅼ Ⅽ Ⅾ Ⅿ" ], [ 6, 20, "ⅰ ⅱ ⅲ ⅳ ⅴ ⅵ" ],
    [ 7, 8, "ⅶ ⅷ ⅸ ⅹ ⅺ ⅻ" ], [ 7, 26, "ⅼ ⅽ ⅾ ⅿ" ],
    [ 8, 3, "0123456789" ], [ 8, 20, "MMXXVI = 2026" ],
    [ 9, 1, ". , - _ : ;" ], [ 9, 22, "! ? ' \" ` ~" ],
    [ 10, 6, "( ) [ ] { } < >" ], [ 10, 26, "/ \\ | @ # $ %" ],
    [ 11, 2, "^ & * + =" ], [ 11, 16, "… – — • ° ±" ],
    [ 12, 9, "Hello, world! (v1.1.13)" ],
    [ 13, 6, "$ ls -la ~/bin" ], [ 13, 21, "[ OK ] 98.6%" ],
    [ 14, 4, "i, j; k: l." ], [ 14, 20, "e.g. A-Z, a-z" ],
    [ 15, 1, "\"quoted\" 'single' `tick`" ], [ 15, 30, "iv. Fin." ]
]);

/**
 * Renders one frame of a 40 by 16 cell terminal: the fireflies animation
 * repeated two by two and cut to 40 columns, with white non-Braille text written
 * over cells throughout so the Mojangles advance widths can be compared with
 * the Braille grid. Every line stays within the 128-byte `TextPrimitive` limit.
 *
 * @category Animation
 * @since 1.1.13
 */
export function BrailleTerminalFrame(Seconds)
{
    const Tile = BrailleCells(Seconds);
    const Cells = [];
    for (let Y = 0; Y < TerminalRows; Y++)
    {
        Cells.push(Array.from({ length: TerminalColumns }, (_, X) => Tile[Y % 8][X % 32]));
    }

    const Written = Cells.map((Row) => Row.map(() => false));
    for (const [ Y, X, Text ] of TerminalText)
    {
        Array.from(Text).forEach((Character, Offset) =>
        {
            Cells[Y][X + Offset] = Character;
            Written[Y][X + Offset] = true;
        });
    }
    const Rows = Cells.map((Row, Y) =>
    {
        let Line = "";
        let White;
        Row.forEach((Character, X) =>
        {
            if (Written[Y][X] !== White) Line += (White = Written[Y][X]) ? "§f" : RowColor(Y);
            Line += Character;
        });
        return Line;
    });
    return "§r§bTerminal Text Test (Fireflies x4) §r§7~20 fps\n" + Rows.join("\n");
}
