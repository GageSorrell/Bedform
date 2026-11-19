/**
 * Custom glyphs at the Unicode font's resolution, by layering two or three
 * TextPrimitives at one location: the Symbols for Legacy Computing
 * stand-ins. Seamless overlays add a third layer between the two
 * described below, and glyph-only text needs no front at all (see
 * `SplitOverlay` and `GlyphOnly`). The back one, at half scale with the black
 * background, draws the custom glyphs, whose pixels are large-font pixels and
 * so come out the Unicode font's size; everything else on it is the front's
 * text doubled, in black on black, which only places the glyphs. The front
 * one, at full scale with a
 * transparent background, draws the text itself, with a space where each
 * custom glyph goes. Created first, the back is drawn first.
 *
 * Lines are centered, so the back line must also have the front line's
 * width; mirroring the front gives it that exactly (1.1.44: computing the
 * back from estimated advances put the second test line's glyphs off). The
 * back's lines are spaced and placed a little differently from the front's;
 * see `OverlayDrop` and `OverlayBackGap` in Main.js.
 *
 * @module @sorrell/ddui-image-demo/Source/GlyphOverlay
 *
 * @file      GlyphOverlay.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { CustomGlyphAdvance, IsCustomGlyph } from "./CustomGlyph.js";
import { LineWidth, UsesLargeFont } from "./Layout.js";
import { IsCellGlyph, IsLegacyComputing, LegacyExtraGlyphs, LegacyWideGlyph, ToLegacyGlyphs }
    from "./LegacyComputing.js";
import { MinecraftTenWidth, ToMinecraftTen } from "./MinecraftTen.js";
import { BrailleOctant, OctantGlyph } from "./Octant.js";

/**
 * The face of the game's green buttons, such as the title screen's Play
 * button, #3C8527: the background the Minecraft Ten glyphs' baked shadow is
 * drawn for.
 *
 * @category Constant
 * @since 1.1.65
 */
export const ButtonFace = Object.freeze({ red: 0x3c / 255, green: 0x85 / 255, blue: 0x27 / 255, alpha: 1 });

/**
 * The overlays' colors: the background is Bedrock's gray (§7, #C5C5C5,
 * where Java's is #AAAAAA), so text hidden in §7 matches it;
 * text and glyphs are #4D4D4D, which no color code gives, so it is the
 * fronts' display color, `InkColor`, and `Ink`, the reset code, returns to
 * it. Legacy Computing glyphs have no other color: color codes still color
 * the text around them.
 * Everything drawn only to place or size something, such as the back's
 * mirrored text and the pads, is in `Hidden`, the background's color, so it
 * does not show.
 *
 * @category Constant
 * @since 1.1.55
 */
export const OverlayColors = Object.freeze({
    Background: Object.freeze({ red: 0xc5 / 255, green: 0xc5 / 255, blue: 0xc5 / 255, alpha: 1 }),
    Hidden: "§7",
    Ink: "§r",
    InkColor: Object.freeze({ red: 0x4d / 255, green: 0x4d / 255, blue: 0x4d / 255, alpha: 1 })
});

/**
 * A U+2800 BRAILLE PATTERN BLANK in the background's color: not a
 * large-font character, so a line holding it is drawn in the Unicode font,
 * and its dotted outline does not show.
 */
const SmallFont = `${OverlayColors.Hidden}\u2800`;

/** Formatting codes an overlay's text may hold: colors and reset, which do not change widths. */
const ColorCode = /^§[0-9a-fr]$/u;

/**
 * Black pads tried, shortest first, to make a line's width a multiple of 2
 * large-font pixels. Their ink stays well inside a row, so it never reaches
 * the rows above and below, where black would show (1.1.46's bars, inked on
 * rows 2 to 15 of the cell, did): U+2219 (rows 8 to 11, 3 pixels wide in the
 * Unicode font), U+00B7 (rows 8 to 9, 2 pixels) and l (rows 4 to 13, as
 * capitals, 3.5 pixels). All are large-font characters, so a pad never
 * changes a line's font.
 */
const PadCandidates = Object.freeze([ "", "\u00b7", "\u2219", "l", "\u2219\u2219", "l\u2219", "ll", "\u00b7l" ]);

/**
 * The shortest pad that makes a line's width, by `LineWidth`, a multiple of 2
 * pixels. The client places a line's start at minus half its width, rounded
 * to whole pixels of the display's font: half a front pixel when the width
 * is odd or fractional. The back, at half scale, has pixels half the size
 * and rounds differently, so its glyphs land beside their spaces (1.1.45:
 * the second test line, 39 pixels wide, put every glyph 1 Unicode-font pixel
 * left). With an even width, neither rounds. Pad characters are in the large
 * font, so they do not change the line's font.
 *
 * @throws { Error } When no candidate evens the width.
 *
 * @category Formatting
 * @since 1.1.46
 */
function EvenPad(Line)
{
    const Pad = PadCandidates.find((Candidate) => LineWidth(Line + Candidate) % 2 === 0);
    if (Pad === undefined)
    {
        throw new Error(`No pad makes ${JSON.stringify(Line)} an even width.`);
    }

    return Pad;
}

/**
 * Splits text containing custom glyphs into the front and back texts of an
 * overlay. Symbols for Legacy Computing characters are first replaced by
 * their stand-ins. The front replaces each custom glyph with a space and
 * keeps the text's color codes. The back, meant for half the front's scale,
 * mirrors the front: every other character twice, in the background's color, which at half scale takes exactly that character's place at
 * full scale, in the same font, whatever its true advance; and each custom
 * glyph, whose advance is two spaces. The client draws glyphs in their
 * texture's colors, ignoring color codes, so every glyph is dark gray. Every glyph therefore lands on
 * its space, and both lines have one width, so centering moves them alike.
 * Both lines end with the same black pad, from `EvenPad`, so that the
 * client's rounding of a line's start moves neither. A line the large font
 * would draw starts with `SmallFont`, so every line is in the Unicode font,
 * whose lines are 10 pixels tall to the large font's 12, and one gap spaces
 * them all alike. The back switches color
 * only before an inked character, so spaces cost no codes and a row of
 * sixteen spaced glyphs stays within the 128-byte line limit.
 *
 * With `Seamless`, the back is the first of two half-scale layers and
 * `Middle`, transparent and placed between the back and the front, is the
 * second; between them they draw every run of adjacent cell glyphs with no
 * seam between its cells (see `LayerLine`). The three layers' lines all have
 * one width.
 *
 * @throws { Error } When a custom glyph's advance is not two spaces, or the
 * text holds a formatting code other than a color or reset, which could
 * change widths.
 *
 * @category Formatting
 * @since 1.1.41
 */
export function SplitOverlay(Text, { Seamless = false } = {})
{
    if (CustomGlyphAdvance !== 8)
    {
        throw new Error("A custom glyph must be two spaces wide to take a space's place.");
    }

    const Front = [];
    const Back = [];
    const Middle = [];
    for (const Original of ToLegacyGlyphs(Text).split("\n"))
    {
        // Every overlay line is in the Unicode font, so all lines share one height and one gap spaces them alike.
        const Spaced = [ ...Original ].map((Character) => IsCustomGlyph(Character.codePointAt(0)) ? " " : Character).join("");
        const Source = UsesLargeFont(Spaced) ? SmallFont + Original : Original;
        const Characters = [ ...Source ];
        // Each visible character with the front's color at it: custom glyphs take that color behind.
        const Visible = [];
        let FrontLine = "";
        for (let Index = 0; Index < Characters.length; Index++)
        {
            const Character = Characters[Index];
            if (Character === "§")
            {
                const Code = Character + (Characters[Index + 1] ?? "");
                if (!ColorCode.test(Code))
                {
                    throw new Error(`An overlay cannot hold the formatting code ${JSON.stringify(Code)}.`);
                }

                FrontLine += Code;
                Index++;
                continue;
            }

            FrontLine += IsCustomGlyph(Character.codePointAt(0)) ? " " : Character;
            Visible.push({ Character });
        }

        const Pad = EvenPad(FrontLine);
        Front.push(Pad ? `${FrontLine}${OverlayColors.Hidden}${Pad}` : FrontLine);
        const Items = [ ...Visible, ...[ ...Pad ].map((Character) => ({ Character })) ];
        Back.push(LayerLine(Items, Seamless ? 0 : undefined));
        if (Seamless) Middle.push(LayerLine(Items, 1));
    }

    return {
        Back: Back.join("\n"),
        Front: Front.join("\n"),
        ...Seamless ? { Middle: Middle.join("\n") } : {}
    };
}

/** The blank cell glyph: no visible ink, an advance of one cell. */
const BlankCell = String.fromCodePoint(LegacyExtraGlyphs.Blank);

/**
 * One half-scale layer's line for an overlay's visible characters. Every
 * character that is not a custom glyph is
 * mirrored: twice, in the background's color. With `Parity` undefined, every
 * custom glyph is drawn as itself, which keeps the seam after it. Otherwise
 * the layer is one of a seamless pair: within each run of adjacent custom
 * glyphs, it draws the cells whose position in the run has that parity, each
 * cell glyph with a following cell as its wide copy, which spans that cell
 * too, so its forced gap falls in the other layer's cell; a cell the layer
 * neither draws nor spans is a blank cell. A run's last cell keeps its seam,
 * as would any custom glyph without a wide copy. The client draws glyphs in
 * their texture's colors, so every glyph is dark gray whatever the text's
 * color.
 */
function LayerLine(Items, Parity)
{
    let Line = "";
    let Color = "";
    // Color codes go only before inked characters, so spaces and blank cells cost no bytes.
    const Emit = (Text, Wanted) =>
    {
        if (Wanted && Color !== Wanted)
        {
            Line += Wanted;
            Color = Wanted;
        }

        Line += Text;
    };
    let Run = 0;
    let Spanned = false;
    for (let Index = 0; Index < Items.length; Index++)
    {
        const { Character } = Items[Index];
        const CodePoint = Character.codePointAt(0);
        if (!IsCustomGlyph(CodePoint))
        {
            Run = 0;
            Spanned = false;
            Emit(Character + Character, Character === " " ? "" : OverlayColors.Hidden);
            continue;
        }

        const Cell = IsCellGlyph(CodePoint);
        // Glyphs are drawn in their texture's colors; white would keep them so even if the client tinted them.
        if (Parity === undefined)
        {
            Emit(String.fromCodePoint(CodePoint), "§f");
            continue;
        }

        const Owned = Run % 2 === Parity;
        Run++;
        if (Spanned)
        {
            Spanned = false;
            continue;
        }

        if (!Owned)
        {
            Emit(BlankCell);
            continue;
        }

        const Next = Items[Index + 1];
        Spanned = Cell && Next !== undefined && IsCustomGlyph(Next.Character.codePointAt(0));
        Emit(String.fromCodePoint(Spanned ? LegacyWideGlyph(CodePoint) : CodePoint), "§f");
    }

    return Line;
}

/** A blank cell: its glyph and its wide copy. */
const Blank = Object.freeze({ Narrow: LegacyExtraGlyphs.Blank, Wide: LegacyWideGlyph(LegacyExtraGlyphs.Blank) });

/**
 * One layer's line of a glyph-only display's cells, each a narrow glyph (an
 * advance of one cell, keeping the seam) and a wide one (two cells, filling
 * it). With `Parity` undefined, the layer draws every cell narrow. Otherwise
 * it is one of a seamless pair: it draws the cells whose index has that
 * parity, each wide but the last, so the cell after each is spanned, and a
 * blank cell where the line starts with the other layer's cell.
 */
function CellLayer(Cells, Parity)
{
    let Line = "";
    for (let Index = 0; Index < Cells.length; Index++)
    {
        const { Narrow, Wide } = Cells[Index];
        if (Parity === undefined)
        {
            Line += String.fromCodePoint(Narrow);
            continue;
        }

        if (Index % 2 !== Parity)
        {
            // Every other cell of the other layer's is spanned by this layer's wide glyph before it.
            if (Index === 0) Line += String.fromCodePoint(Blank.Narrow);
            continue;
        }

        Line += String.fromCodePoint(Index + 1 < Cells.length ? Wide : Narrow);
    }

    return Line;
}

/**
 * Text made only of cell glyphs, for displays with no front: one or two
 * TextPrimitives at half scale, with no mirrored text, no font switch and no
 * pads, since nothing on them needs to line up with vanilla text. Symbols for
 * Legacy Computing characters become their stand-ins, a space becomes a blank
 * cell (so every line, even an empty one, holds only Private Use Area glyphs
 * and is in the Unicode font, 10 pixels tall), and a Braille character
 * becomes the octant with blocks where it has dots (Source/Octant.js), the
 * blank pattern a blank cell. Color codes pick the octants' colors until the
 * next, though every octant is now the overlays' dark gray. Legacy
 * Computing glyphs are always dark gray. `A`, with the display's background,
 * draws every cell when `Seamless` is false, keeping the seam after each
 * glyph; when true, `A` and `B`, a transparent layer just in front of it,
 * draw alternate cells with wide glyphs, so cells join with no seam. Octants
 * exist only wide, so a line ending in one gains a blank cell, which its
 * layer draws narrow. The client centers each line, so every line is padded
 * with blank cells to the widest, `Cells` cells, making the display a grid;
 * both lines of a pair have that width, so they center alike.
 *
 * @throws { Error } When the text holds anything else, a formatting code
 * other than a color or reset, or, without `Seamless`, an octant.
 *
 * @category Formatting
 * @since 1.1.66
 */
export function GlyphOnly(Text, { Seamless = true } = {})
{
    const A = [];
    const B = [];
    const Rows = [];
    let Widest = 0;
    for (const Original of ToLegacyGlyphs(Text).split("\n"))
    {
        const Characters = [ ...Original ];
        const Cells = [];
        let Color = OverlayColors.Ink;
        for (let Index = 0; Index < Characters.length; Index++)
        {
            const Character = Characters[Index];
            if (Character === "§")
            {
                Color = Character + (Characters[Index + 1] ?? "");
                if (!ColorCode.test(Color)) throw new Error(`Glyph-only text cannot hold the formatting code ${JSON.stringify(Color)}.`);
                Index++;
                continue;
            }

            const CodePoint = Character.codePointAt(0);
            const Pattern = BrailleOctant(CodePoint);
            if (Character === " " || Pattern === 0) Cells.push(Blank);
            else if (Pattern !== undefined) Cells.push({ Wide: OctantGlyph(Pattern, Color) });
            else if (IsCellGlyph(CodePoint))
            {
                Cells.push({ Narrow: CodePoint, Wide: LegacyWideGlyph(CodePoint) });
            }
            else throw new Error(`${JSON.stringify(Character)} is not a cell glyph.`);
        }

        if (Cells.length === 0 || Cells.at(-1).Narrow === undefined) Cells.push(Blank);
        if (!Seamless && Cells.some(({ Narrow }) => Narrow === undefined))
        {
            throw new Error("Octants exist only as wide glyphs, which only seamless layers use.");
        }

        Widest = Math.max(Widest, Cells.length);
        Rows.push(Cells);
    }

    for (const Cells of Rows)
    {
        // The client centers each line, so every line is padded to the widest with blank cells: a grid.
        while (Cells.length < Widest) Cells.push(Blank);
        A.push(CellLayer(Cells, Seamless ? 0 : undefined));
        if (Seamless) B.push(CellLayer(Cells, 1));
    }

    return { A: A.join("\n"), Cells: Widest, ...Seamless ? { B: B.join("\n") } : {} };
}

/**
 * Sextant art: `Columns` by `Rows` cells, each split into 2 by 3 subcells
 * set where `Inside(X, Y)` holds at the subcell's center, in the cell's own
 * pixels (8 by 16 per cell, so a seamless display's shapes keep their
 * proportions). Patterns Unicode encodes outside the sextants use
 * `LegacyExtraGlyphs`.
 *
 * @category Formatting
 * @since 1.1.66
 */
export function SextantArt(Columns, Rows, Inside)
{
    const Lines = [];
    for (let Row = 0; Row < Rows; Row++)
    {
        let Line = "";
        for (let Column = 0; Column < Columns; Column++)
        {
            let Value = 0;
            for (let Sub = 0; Sub < 6; Sub++)
            {
                const X = Column * 8 + (Sub % 2 === 0 ? 2 : 6);
                const Y = Row * 16 + [ 2.5, 8, 13.5 ][Sub >> 1];
                if (Inside(X, Y)) Value |= 1 << Sub;
            }

            const Extra = { 0: LegacyExtraGlyphs.Blank, 21: LegacyExtraGlyphs.LeftHalf, 42: LegacyExtraGlyphs.RightHalf,
                63: LegacyExtraGlyphs.Full }[Value];
            // U+1FB00 is sextant-1; the sequence skips the left (21) and right (42) halves.
            Line += String.fromCodePoint(Extra ?? 0x1fb00 + Value - 1 - (Value > 21 ? 1 : 0) - (Value > 42 ? 1 : 0));
        }

        Lines.push(Line);
    }

    return Lines.join("\n");
}

/**
 * Code points `First` to `Last` of the Symbols for Legacy Computing blocks,
 * one row per 16 code points (the range itself is on the chart's title), each labeled
 * with its first four hex digits and an underscore, its characters side by
 * side so that mosaics show how they tile; an unassigned code point is a
 * space. Row labels alternate dark gray and cyan (the glyphs are always dark
 * gray), and rows start with `SmallFont`, so their labels are in the Unicode
 * font.
 *
 * @category Formatting
 * @since 1.1.48
 */
function LegacyComputingChart(First, Last)
{
    const Rows = [];
    for (let Row = First; Row <= Last; Row += 16)
    {
        // A hidden braille blank puts the row in the Unicode font, so its label is small; labels alternate colors.
        const Color = (Row - First) % 32 === 0 ? OverlayColors.Ink : "§b";
        let Line = `${SmallFont}${Color}${Row.toString(16).toUpperCase().slice(0, 4)}_ `;
        for (let CodePoint = Row; CodePoint < Row + 16; CodePoint++)
        {
            Line += IsLegacyComputing(CodePoint) ? String.fromCodePoint(CodePoint) : " ";
        }

        Rows.push(Line);
    }

    return Rows.join("\n");
}

/**
 * The line gap of a glyph-only display at half scale: its lines hold only
 * Private Use Area glyphs, so they are Unicode-font lines, 10 pixels plus the
 * gap apart, and 6 makes that 16, one cell, so rows stack with no gap.
 *
 * @category Constant
 * @since 1.1.66
 */
export const GlyphOnlyLineGap = 6;

/**
 * The glyph-only sample, 20 cells wide: a target of concentric rings in
 * sextants over 6 rows, then a zigzag of four light diagonals per peak, and
 * a checkerboard fill, both of which break up at every seam unless cells
 * join.
 */
const GlyphOnlySample = [
    SextantArt(20, 6, (X, Y) =>
    {
        const Distance = Math.hypot(X - 80, (Y - 48) * 0.75);
        return Distance < 14 || (Distance > 22 && Distance < 32) || (Distance > 40 && Distance < 50);
    }),
    String.fromCodePoint(0x1fbd0, 0x1fbd1, 0x1fbd2, 0x1fbd3).repeat(5),
    String.fromCodePoint(0x1fb95).repeat(20)
].join("\n");

/**
 * The overlays for the pixel offset row, each a front text with its back
 * text: Minecraft Ten, the whole Symbols for Legacy Computing block, and its
 * supplement in three charts of up to 256 code points, then the glyph-only
 * sample. The custom A and the alpha tests, which needed page E2, were
 * removed in 1.1.76.
 *
 * @category Constant
 * @since 1.1.41
 */
export const OverlayTests = Object.freeze([
    (() =>
    {
        // Single-layer at half scale, so a Minecraft Ten pixel is a Unicode-font pixel; its own advances space it.
        // The glyphs are drawn in the button text style, so the display takes the button's green face.
        const Lines = [ "ABCDEFGHIJKLM", "NOPQRSTUVWXYZ", "0123456789", "!\"#$%&'()*+,-./", ":;<=>?@[\\]^_`{|}~",
            "MINECRAFT TEN" ].map(ToMinecraftTen);
        return {
            Background: ButtonFace,
            HalfScale: true,
            LineGap: 4,
            Measure: { Lines: Lines.length, Width: Math.max(...Lines.map(MinecraftTenWidth)) },
            Overlaid: true,
            Text: Lines.join("\n"),
            Title: "Minecraft Ten, pixel for pixel (69)"
        };
    })(),
    ...[
        [ 0x1fb00, 0x1fbff, "Symbols for Legacy Computing", true ],
        [ 0x1fb00, 0x1fbff, "Symbols for Legacy Computing, two layers", false ],
        [ 0x1cc00, 0x1ccff, "Legacy Computing Supplement, 1", true ],
        [ 0x1cd00, 0x1cdff, "Legacy Computing Supplement, 2", true ],
        [ 0x1ce00, 0x1cebf, "Legacy Computing Supplement, 3", true ]
    ].map(([ First, Last, Name, Seamless ]) =>
    {
        // Three layers join adjacent glyphs with no seam; the two-layer copy keeps the seams, for comparison.
        const { Back, Front, Middle } = SplitOverlay(LegacyComputingChart(First, Last), { Seamless });
        let Count = 0;
        for (let CodePoint = First; CodePoint <= Last; CodePoint++) Count += IsLegacyComputing(CodePoint) ? 1 : 0;
        return {
            Back,
            Middle,
            Text: Front,
            // The range goes on the title, above the chart, rather than on the chart's own first line.
            Title: `${Name} (${Count})\nU+${First.toString(16).toUpperCase()}\u2013${Last.toString(16).toUpperCase()}`
        };
    }),
    ...[ true, false ].map((Seamless) =>
    {
        const { A, B, Cells } = GlyphOnly(GlyphOnlySample, { Seamless });
        return {
            Background: OverlayColors.Background,
            GlyphOnly: true,
            HalfScale: true,
            LineGap: GlyphOnlyLineGap,
            Measure: { Lines: GlyphOnlySample.split("\n").length, Width: Cells * CustomGlyphAdvance },
            Middle: B,
            Pitch: 10,
            Text: A,
            Title: Seamless ? "Glyphs only, seamless (two layers)" : "Glyphs only, one layer"
        };
    })
].map((Test) => Object.freeze(Test)));
