/**
 * Multi-line tests of characters that might render oddly beside other text:
 * blanks of unusual width, zero-width and direction characters, fillers and
 * controls, combining marks, glyphs that reach above, below or beyond their
 * line, formatting codes and the sixteenth block characters. Each case is its
 * own display, and no Latin letter appears twice in one case.
 *
 * @module @sorrell/ddui-image-demo/Source/OddCharacters
 *
 * @file      OddCharacters.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { CharacterLabel, Hex } from "./UnicodeBrowser.js";

const Character = (CodePoint) => String.fromCodePoint(CodePoint);
const Characters = (...CodePoints) => String.fromCodePoint(...CodePoints);
/** Formatting codes: a section sign and the character after it, which is not shown. */
const FormattingCode = /§./gu;

/**
 * Latin letters that are all 6 font pixels wide, so bars line up across lines.
 * I is narrower in both cases; F, K, L and T are narrower in lower case, so
 * they are always upper case.
 */
const PoolLetters = "ABCDEGHJMNOPQRSUVWXYZFKLT";
const AlwaysUpper = "FKLT";

/**
 * Returns a function that takes the next unused letters, alternating upper and
 * lower case, skipping any letter in `Reserved`. It throws when the pool runs
 * out, so no letter can repeat.
 *
 * @throws { Error } When more letters are taken than remain.
 *
 * @category Formatting
 * @since 1.1.25
 */
function LetterPool(Reserved = "")
{
    const Taken = new Set(Reserved.toUpperCase());
    let Count = 0;
    return (Length) =>
    {
        let Result = "";
        while (Result.length < Length)
        {
            const Letter = [ ...PoolLetters ].find((Candidate) => !Taken.has(Candidate));
            if (!Letter) throw new Error("Out of distinct letters.");
            Taken.add(Letter);
            Result += Count++ % 2 === 0 || AlwaysUpper.includes(Letter) ? Letter : Letter.toLowerCase();
        }
        return Result;
    };
}

/**
 * Returns the Latin letters shown in text, upper-cased, ignoring formatting
 * codes, which are not shown.
 *
 * @category Formatting
 * @since 1.1.25
 */
export function ShownLetters(Text)
{
    return [ ...Text.replace(FormattingCode, "").toUpperCase() ].filter((Letter) => /[A-Z]/u.test(Letter));
}

/**
 * A width test for one character: bars around the ordinary space and the
 * character, once and four times between letters, then the character at the
 * start and end of a bar pair and inside words. A bar out of line with the
 * reference line above it shows a different width.
 *
 * @category Formatting
 * @since 1.1.25
 */
function WidthCase(CodePoint)
{
    const Glyph = Character(CodePoint);
    const Take = LetterPool();
    const Pair = () => [ ...Take(2) ];
    const [ A, B ] = Pair(), [ C, D ] = Pair(), [ E, F ] = Pair(), [ G, H ] = Pair();
    const [ J, K ] = Pair(), [ L, M ] = Pair();
    return {
        Text: [
            `|${A} ${B}|`,
            `|${C}${Glyph}${D}|`,
            `|${E}    ${F}|`,
            `|${G}${Glyph.repeat(4)}${H}|`,
            `|${Glyph}${J}${K}|`,
            `|${L}${M}${Glyph}|`,
            `${Take(2)}${Glyph}${Take(2)} ${Take(2)}${Glyph}${Take(2)}`
        ].join("\n"),
        Studied: Studied([ CodePoint ]),
        Title: `U+${Hex(CodePoint)} ${CharacterLabel(CodePoint)}`
    };
}

/**
 * A combining mark test: the mark on a capital and a lower-case letter, each
 * beside the same letter width without it, on a descender, three times on one
 * letter, alone and between letters, and a reference line with no mark.
 *
 * @category Formatting
 * @since 1.1.25
 */
function MarkCase(CodePoint)
{
    const Mark = Character(CodePoint);
    return {
        Text: [
            `|A|B${Mark}|`,
            `|c|d${Mark}|`,
            `|p|q${Mark}|`,
            `|e|o${Mark.repeat(3)}|`,
            `|${Mark}|r${Mark}s|`,
            "|UV|WX|"
        ].join("\n"),
        Studied: Studied([ CodePoint ]),
        Title: `U+${Hex(CodePoint)} ${CharacterLabel(CodePoint)}`
    };
}

/**
 * A sample test: a line of letters above, the sample between bars and letters
 * (each sample line in turn), and a line of letters below, so marks and glyphs
 * that leave their line overlap something. `Sample` may take letters of its
 * own from the pool, and `Reserved` lists letters it contains literally. The
 * studied characters are the sample's own, except ordinary spaces, unless
 * `Pattern` names them instead.
 *
 * @category Formatting
 * @since 1.1.25
 */
function SampleCase(Title, Sample, Reserved = "", Pattern = undefined)
{
    const Take = LetterPool(Reserved + ShownLetters(typeof Sample === "function" ? "" : [ Sample ].flat().join("")).join(""));
    const Lines = [ typeof Sample === "function" ? Sample(Take) : Sample ].flat();
    return {
        Studied: Pattern ?? Studied([ ...Lines.join("") ].map((Glyph) => Glyph.codePointAt(0))),
        Text: [ Take(6), ...Lines.map((Line) => `${Take(1)}|${Line}|${Take(1)}`), Take(6) ].join("\n"),
        Title
    };
}

/**
 * Returns a pattern matching every occurrence of the given code points, except
 * the ordinary space, which is never studied.
 *
 * @category Formatting
 * @since 1.1.26
 */
function Studied(CodePoints)
{
    const Escaped = [ ...new Set(CodePoints) ].filter((CodePoint) => CodePoint !== 0x20)
        .map((CodePoint) => `\\u{${CodePoint.toString(16)}}`).join("");
    return new RegExp(`[${Escaped}]`, "gu");
}

/** Every formatting code: a section sign and the character after it. */
const FormattingCodes = /§./gu;
/** Section signs alone. */
const SectionSigns = /§/gu;

/**
 * A case of directional formatting characters used as they are in practice,
 * around right-to-left words, numbers and punctuation. Its letters may repeat.
 * The studied characters are the given controls, so the reference shows the
 * same text without them.
 *
 * @category Formatting
 * @since 1.1.32
 */
function BidiCase(Title, Lines, Controls)
{
    return { Bidi: true, Studied: Studied(Controls), Text: Lines.join("\n"), Title };
}

/** The Hebrew word "shalom" (shin, lamed, vav, final mem), written right to left. */
const Shalom = "\u05e9\u05dc\u05d5\u05dd";
const [ LeftToRightMark, RightToLeftMark ] = [ "\u200e", "\u200f" ];
const [ RightToLeftEmbedding, PopFormatting, LeftToRightOverride, RightToLeftOverride ] =
    [ "\u202b", "\u202c", "\u202d", "\u202e" ];
const [ RightToLeftIsolate, FirstStrongIsolate, PopIsolate ] = [ "\u2067", "\u2068", "\u2069" ];
const Controls = (...Texts) => Texts.map((Text) => Text.codePointAt(0));
/** A subdivision flag: the black flag, the region code in tag letters, then CANCEL TAG. */
const Flag = (Code) => "\u{1f3f4}" + [ ...Code ].map((Letter) => Character(0xe0000 + Letter.codePointAt(0))).join("") +
    Character(0xe007f);

/** Twelve marks above a letter, twelve below, and four of each on two letters. */
const MarksAbove = [ 0x30d, 0x30e, 0x304, 0x305, 0x33f, 0x311, 0x306, 0x310, 0x352, 0x357, 0x351, 0x307 ];
const MarksBelow = [ 0x316, 0x317, 0x318, 0x319, 0x31c, 0x31d, 0x31e, 0x31f, 0x320, 0x324, 0x325, 0x326 ];
const Stacked = (Base) => Base + Characters(...MarksAbove.slice(0, 4), ...MarksBelow.slice(0, 4));

/** The sixteenth blocks (U+1CE90–U+1CE9F) and the quarter blocks on the same grid (U+1CEA0–U+1CEAF). */
const Sixteenths = Array.from({ length: 16 }, (_, Index) => Character(0x1ce90 + Index));
const Quarters = Array.from({ length: 16 }, (_, Index) => Character(0x1cea0 + Index));

/**
 * Every case, in display order, each with its own title and its reference
 * text: the same lines without the characters the case studies.
 *
 * @category Constant
 * @since 1.1.25
 */
export const OddCharacterCases = Object.freeze([
    { Text: [ Sixteenths.slice(0, 8).join(" "), Sixteenths.slice(8).join(" ") ].join("\n"),
        Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))), Title: "Sixteenth blocks 1CE90-1CE9F" },
    { Text: [ 0, 4, 8, 12 ].map((Start) => Sixteenths.slice(Start, Start + 4).join("")).join("\n"),
        Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))), Title: "Sixteenth blocks by grid position" },
    { Text: [ Sixteenths.join(""), Sixteenths.join("") ].join("\n"), Studied: Studied(Sixteenths.map((Glyph) => Glyph.codePointAt(0))), Title: "Sixteenth blocks run together" },
    { Text: [ Quarters.slice(0, 8).join(" "), Quarters.slice(8).join(" ") ].join("\n"),
        Studied: Studied(Quarters.map((Glyph) => Glyph.codePointAt(0))), Title: "Quarter blocks 1CEA0-1CEAF" },
    { Text: [ Quarters.join(""), Quarters.join("") ].join("\n"), Studied: Studied(Quarters.map((Glyph) => Glyph.codePointAt(0))), Title: "Quarter blocks run together" },
    // Spaces of other widths.
    ...[ 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
        0x202f, 0x205f, 0x3000 ].map(WidthCase),
    // Zero-width and invisible characters.
    ...[ 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0xad, 0x34f, 0x2061, 0x2062, 0x180b, 0x180f, 0xfe00, 0xfe0f,
        0x17b4, 0x17b5 ].map(WidthCase),
    // Direction and tag characters.
    ...[ 0x200e, 0x200f, 0x61c, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xe0001,
        0xe0020, 0xe0041, 0xe007f ].map(WidthCase),
    // Directional characters as they are used in practice.
    BidiCase("Right-to-left override (RLO ... PDF)", [
        `Ab ${RightToLeftOverride}xyz${PopFormatting} Cd`,
        "want: Ab zyx Cd",
        `Ef ${RightToLeftOverride}pqr stu${PopFormatting} Gh`,
        "want: Ef uts rqp Gh"
    ], Controls(RightToLeftOverride, PopFormatting)),
    BidiCase("Left-to-right override on Hebrew (LRO ... PDF)", [
        Shalom,
        `${LeftToRightOverride}${Shalom}${PopFormatting}`
    ], Controls(LeftToRightOverride, PopFormatting)),
    BidiCase("Isolate around a Hebrew name (RLI, FSI ... PDI)", [
        `Ab: ${Shalom} 3 Cd`,
        `Ab: ${RightToLeftIsolate}${Shalom}${PopIsolate} 3 Cd`,
        `Ab: ${FirstStrongIsolate}${Shalom}${PopIsolate} 3 Cd`
    ], Controls(RightToLeftIsolate, FirstStrongIsolate, PopIsolate)),
    BidiCase("Embedding versus isolate (RLE ... PDF, RLI ... PDI)", [
        `Ab ${RightToLeftEmbedding}${Shalom}${PopFormatting} 3 Cd`,
        `Ab ${RightToLeftIsolate}${Shalom}${PopIsolate} 3 Cd`
    ], Controls(RightToLeftEmbedding, PopFormatting, RightToLeftIsolate, PopIsolate)),
    BidiCase("Marks beside punctuation (RLM, LRM)", [
        `Ab ${Shalom}!`,
        `Ab ${Shalom}!${RightToLeftMark}`,
        `${Shalom} C++`,
        `${Shalom} C++${LeftToRightMark}`
    ], Controls(RightToLeftMark, LeftToRightMark)),
    BidiCase("Subdivision flags (tag sequences)", [
        `England ${Flag("gbeng")}`,
        `Scotland ${Flag("gbsct")}`,
        `Wales ${Flag("gbwls")}`,
        "Black flag \u{1f3f4}"
    ], [ ...Array.from({ length: 26 }, (_, Index) => 0xe0061 + Index), 0xe007f ]),
    // Fillers and controls.
    ...[ 0x2800, 0x3164, 0xffa0, 0x115f, 0x1160, 0x180e, 0x9, 0x8, 0x1b, 0x7f, 0x80, 0x9f, 0xfff9, 0xfffa,
        0xfffb, 0xfffc ].map(WidthCase),
    // Combining marks.
    ...[ 0x300, 0x301, 0x302, 0x303, 0x308, 0x30a, 0x30b, 0x311, 0x323, 0x327, 0x328, 0x332, 0x333, 0x336, 0x338,
        0x20dd, 0x20e3 ].map(MarkCase),
    // Glyphs that reach above or below their line.
    SampleCase("Twelve marks above", `a${Characters(...MarksAbove)}`),
    SampleCase("Twelve marks below", `a${Characters(...MarksBelow)}`),
    SampleCase("Four marks above and below", `${Stacked("a")}${Stacked("x")}`),
    SampleCase("Accented capitals", "ÅÉÎÕÜǺǾȦḜẪỖ"),
    SampleCase("Capitals with two marks", "Å̂É̂"),
    SampleCase("Descenders", "gjpqyÇŞŢƒʝ"),
    SampleCase("Tibetan stacks", "སྐྱོ ཧྨྱཱ ཀྵ"),
    SampleCase("Thai marks", "กิ่ ฟุ้ ปู่ ก็"),
    SampleCase("Devanagari", "क्षि हिन्दी"),
    SampleCase("Hebrew points", "שָׁלוֹם"),
    SampleCase("Superscripts and subscripts", "x² ₂ ᵃᵇ ˢᵐˡ"),
    SampleCase("Bracket and integral pieces", [ "⎛⌠⎡⎧", "⎜⎮⎢⎨",
        "⎝⌡⎣⎩" ]),
    SampleCase("Large operators", "∫∑∏√"),
    // Glyphs wider than their neighbors, and formatting codes.
    SampleCase("Arabic ligatures", "﷽ ﷺ"),
    SampleCase("Arabic, joined right to left", "سلام"),
    SampleCase("Three-em, two-em, em and en dashes", "⸻ ⸺ — –"),
    SampleCase("Wide symbols", "꧁꧂ ꧅ ꙮ ௸"),
    SampleCase("CJK, Hangul and halfwidth kana", "漢字 한글 ｶﾀﾅ"),
    SampleCase("Fullwidth letters, ideographic space", "ＷＡ　ＭＰ"),
    SampleCase("Private use input icons", " "),
    SampleCase("Outside the Basic Multilingual Plane", Characters(0x1f600, 0x1d54f, 0x10348)),
    SampleCase("Replacement and emoji presentation", "� ☺️ ☺"),
    SampleCase("Bold", (Take) => `§l${Take(3)}§r ${Take(3)}`, "LR", FormattingCodes),
    SampleCase("Italic", (Take) => `§o${Take(3)}§r ${Take(3)}`, "OR", FormattingCodes),
    SampleCase("Obfuscated", (Take) => `§k${Take(3)}§r ${Take(3)}`, "KR", FormattingCodes),
    SampleCase("Stray section signs", (Take) => `${Take(1)}§ ${Take(1)} ${Take(1)}§§${Take(1)}`, "", SectionSigns),
    SampleCase("Combined codes", (Take) => `§l§o${Take(2)}§r§k§l${Take(2)}§r`, "LORK", FormattingCodes)
].map(({ Studied: Pattern, ...Case }) => Object.freeze({
    ...Case,
    // Each line without the studied characters, for the reference display beside the case.
    Reference: Case.Text.split("\n").map((Line) => Line.replace(Pattern, "")).join("\n")
})));
