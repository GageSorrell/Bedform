/**
 * Unicode browser model: pages of code points grouped by block, page text and
 * headings, and lookup-site style details for a single character.
 *
 * @module @sorrell/ddui-image-demo/Source/UnicodeBrowser
 *
 * @file      UnicodeBrowser.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import {
    AgeRuns,
    BidiClassRuns,
    Blocks,
    ControlNames,
    GeneralCategoryRuns,
    LowercaseMappings,
    NamePatterns,
    NameRuns,
    Names,
    ScriptRuns,
    UnicodeVersion,
    UppercaseMappings
} from "./UnicodeData.js";

/**
 * Characters per page row.
 *
 * @category Unicode
 * @since 1.1.19
 */
export const PageColumns = 16;

/**
 * Rows per full page.
 *
 * @category Unicode
 * @since 1.1.19
 */
export const PageRows = 16;

/**
 * Browsable categories: every Unicode block except the surrogate blocks, whose
 * code points cannot appear in text on their own.
 *
 * @category Unicode
 * @since 1.1.19
 */
export const Categories = Object.freeze(Blocks.filter(([ , , Name ]) => !Name.includes("Surrogate"))
    .map(([ First, Last, Name ]) => Object.freeze({ First, Last, Name })));

const Pages = [];
const FirstPages = [];
Categories.forEach((Category, Index) =>
{
    FirstPages.push(Pages.length);
    for (let First = Category.First; First <= Category.Last; First += PageColumns * PageRows)
    {
        Pages.push(Object.freeze({ Category: Index, First, Last: Math.min(First + PageColumns * PageRows - 1, Category.Last) }));
    }
});

/**
 * Number of pages; each category starts on a new page.
 *
 * @category Unicode
 * @since 1.1.19
 */
export const PageCount = Pages.length;

/**
 * Returns a page by index, wrapping past either end, as its category index and
 * first and last code points.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function Page(Index)
{
    return Pages[((Index % PageCount) + PageCount) % PageCount];
}

/**
 * Returns the index of a category's first page.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function FirstPageOf(CategoryIndex)
{
    return FirstPages[CategoryIndex];
}

/**
 * Formats a code point as at least four uppercase hexadecimal digits.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function Hex(CodePoint)
{
    return CodePoint.toString(16).toUpperCase().padStart(4, "0");
}

/** Characters that would break a line, shown as their control pictures or U+2424 SYMBOL FOR NEWLINE instead. */
const LineBreakPictures = new Map([
    [ 0x0, 0x2400 ], [ 0xa, 0x240a ], [ 0xb, 0x240b ], [ 0xc, 0x240c ], [ 0xd, 0x240d ],
    [ 0x85, 0x2424 ], [ 0x2028, 0x2424 ], [ 0x2029, 0x2424 ]
]);

/**
 * Returns the text shown for a code point: the character itself, except NUL
 * and line breaks, which are replaced by pictures so they cannot end the text
 * or its line.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function DisplayCharacter(CodePoint)
{
    return String.fromCodePoint(LineBreakPictures.get(CodePoint) ?? CodePoint);
}

/**
 * Returns a page's characters in code point order, sixteen per line separated
 * by spaces. Each line is at most 79 UTF-8 bytes.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function PageText(Index)
{
    const { First, Last } = Page(Index);
    const Lines = [];
    for (let Row = First; Row <= Last; Row += PageColumns)
    {
        const Characters = [];
        for (let CodePoint = Row; CodePoint <= Math.min(Row + PageColumns - 1, Last); CodePoint++)
        {
            Characters.push(DisplayCharacter(CodePoint));
        }
        Lines.push(Characters.join(" "));
    }
    return Lines.join("\n");
}

/**
 * Returns a page's heading: its first and last code points in hexadecimal and
 * its category name, as "0000–007F • Basic Latin".
 *
 * @category Unicode
 * @since 1.1.19
 */
export function PageHeading(Index)
{
    const { Category, First, Last } = Page(Index);
    return `${Hex(First)}–${Hex(Last)} • ${Categories[Category].Name}`;
}

/**
 * Returns how many rows a page has.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function PageRowCount(Index)
{
    const { First, Last } = Page(Index);
    return Math.ceil((Last - First + 1) / PageColumns);
}

/**
 * Returns the code point at column X and row Y of a page, counting from the
 * upper left, or undefined past its end.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function CodePointAt(Index, X, Y)
{
    const { First, Last } = Page(Index);
    const CodePoint = First + Y * PageColumns + X;
    return X >= 0 && X < PageColumns && Y >= 0 && CodePoint <= Last ? CodePoint : undefined;
}

/**
 * Creates a lookup for "start value" runs separated by "|", parsed on first use.
 *
 * @category Unicode
 * @since 1.1.19
 */
function RunLookup(Text)
{
    let Starts;
    let Values;
    return (CodePoint) =>
    {
        if (!Starts)
        {
            Starts = [];
            Values = [];
            for (const Run of Text.split("|"))
            {
                const Space = Run.indexOf(" ");
                Starts.push(parseInt(Run.slice(0, Space), 16));
                Values.push(Run.slice(Space + 1));
            }
        }
        let Low = 0;
        let High = Starts.length - 1;
        while (Low < High)
        {
            const Middle = (Low + High + 1) >> 1;
            if (Starts[Middle] <= CodePoint) Low = Middle;
            else High = Middle - 1;
        }
        return Values[Low];
    };
}

/**
 * Creates a lookup for "code value" pairs separated by "|", parsed on first use.
 *
 * @category Unicode
 * @since 1.1.19
 */
function PairLookup(Text)
{
    let Table;
    return (CodePoint) =>
    {
        Table ??= new Map(Text.split("|").map((Pair) =>
        {
            const Space = Pair.indexOf(" ");
            return [ parseInt(Pair.slice(0, Space), 16), Pair.slice(Space + 1) ];
        }));
        return Table.get(CodePoint);
    };
}

const GeneralCategory = RunLookup(GeneralCategoryRuns);
const BidiClass = RunLookup(BidiClassRuns);
const Script = RunLookup(ScriptRuns);
const Age = RunLookup(AgeRuns);
const ControlName = PairLookup(ControlNames);
const Uppercase = PairLookup(UppercaseMappings);
const Lowercase = PairLookup(LowercaseMappings);

let NameTable;

/**
 * Decodes the front-coded individual names on first use.
 *
 * @category Unicode
 * @since 1.1.19
 */
function IndividualName(CodePoint)
{
    if (!NameTable)
    {
        NameTable = new Map();
        const Entries = Names.split("|");
        let Index = 0;
        let Previous = "";
        for (const Run of NameRuns.split("|"))
        {
            const [ Start, Count ] = Run.split(" ").map((Value) => parseInt(Value, 16));
            for (let Offset = 0; Offset < Count; Offset++)
            {
                const Entry = Entries[Index++];
                Previous = Previous.slice(0, Entry.charCodeAt(0) - 35) + Entry.slice(1);
                NameTable.set(Start + Offset, Previous);
            }
        }
    }
    return NameTable.get(CodePoint);
}

const JamoInitial = [ "G", "GG", "N", "D", "DD", "R", "M", "B", "BB", "S", "SS", "", "J", "JJ", "C", "K", "T", "P", "H" ];
const JamoMedial = [ "A", "AE", "YA", "YAE", "EO", "E", "YEO", "YE", "O", "WA", "WAE", "OE", "YO", "U", "WEO", "WE", "WI",
    "YU", "EU", "YI", "I" ];
const JamoFinal = [ "", "G", "GG", "GS", "N", "NJ", "NH", "D", "L", "LG", "LM", "LB", "LS", "LT", "LP", "LH", "M", "B", "BS",
    "S", "SS", "NG", "J", "C", "K", "T", "P", "H" ];

/**
 * Returns a code point's name, or its Unicode code point label (such as
 * "<control-001D>" or "<reserved-0378>") when it has none.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function CharacterName(CodePoint)
{
    if (CodePoint >= 0xac00 && CodePoint <= 0xd7a3)
    {
        const Index = CodePoint - 0xac00;
        return "HANGUL SYLLABLE " + JamoInitial[Math.floor(Index / 588)] + JamoMedial[Math.floor(Index % 588 / 28)] +
            JamoFinal[Index % 28];
    }
    const Name = IndividualName(CodePoint);
    if (Name) return Name;
    const Pattern = NamePatterns.find(([ First, Last ]) => CodePoint >= First && CodePoint <= Last);
    if (Pattern) return Pattern[2] + Hex(CodePoint);
    const Category = GeneralCategory(CodePoint);
    if (Category === "Cc") return `<control-${Hex(CodePoint)}>`;
    if (Category === "Co") return `<private-use-${Hex(CodePoint)}>`;
    if (Category === "Cs") return `<surrogate-${Hex(CodePoint)}>`;
    if ((CodePoint & 0xfffe) === 0xfffe || (CodePoint >= 0xfdd0 && CodePoint <= 0xfdef)) return `<noncharacter-${Hex(CodePoint)}>`;
    return `<reserved-${Hex(CodePoint)}>`;
}

const GeneralCategoryNames = Object.freeze({
    Cc: "Control", Cf: "Format", Cn: "Unassigned", Co: "Private Use", Cs: "Surrogate",
    Ll: "Lowercase Letter", Lm: "Modifier Letter", Lo: "Other Letter", Lt: "Titlecase Letter", Lu: "Uppercase Letter",
    Mc: "Spacing Mark", Me: "Enclosing Mark", Mn: "Nonspacing Mark",
    Nd: "Decimal Number", Nl: "Letter Number", No: "Other Number",
    Pc: "Connector Punctuation", Pd: "Dash Punctuation", Pe: "Close Punctuation", Pf: "Final Punctuation",
    Pi: "Initial Punctuation", Po: "Other Punctuation", Ps: "Open Punctuation",
    Sc: "Currency Symbol", Sk: "Modifier Symbol", Sm: "Math Symbol", So: "Other Symbol",
    Zl: "Line Separator", Zp: "Paragraph Separator", Zs: "Space Separator"
});

const BidiClassNames = Object.freeze({
    AL: "Arabic Letter", AN: "Arabic Number", B: "Paragraph Separator", BN: "Boundary Neutral",
    CS: "Common Separator", EN: "European Number", ES: "European Separator", ET: "European Terminator",
    FSI: "First Strong Isolate", L: "Left To Right", LRE: "Left To Right Embedding", LRI: "Left To Right Isolate",
    LRO: "Left To Right Override", NSM: "Nonspacing Mark", ON: "Other Neutral", PDF: "Pop Directional Format",
    PDI: "Pop Directional Isolate", R: "Right To Left", RLE: "Right To Left Embedding", RLI: "Right To Left Isolate",
    RLO: "Right To Left Override", S: "Segment Separator", WS: "White Space"
});

const PlaneNames = Object.freeze({
    0: "Basic Multilingual Plane", 1: "Supplementary Multilingual Plane", 2: "Supplementary Ideographic Plane",
    3: "Tertiary Ideographic Plane", 14: "Supplementary Special-purpose Plane",
    15: "Supplementary Private Use Area-A", 16: "Supplementary Private Use Area-B"
});

/**
 * Returns a code point's control name (such as "CHARACTER TABULATION") for a
 * control character, or otherwise its name or code point label.
 *
 * @category Unicode
 * @since 1.1.24
 */
export function CharacterLabel(CodePoint)
{
    return ControlName(CodePoint) ?? CharacterName(CodePoint);
}

/**
 * Returns the block containing a code point, or undefined.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function BlockOf(CodePoint)
{
    return Blocks.find(([ First, Last ]) => CodePoint >= First && CodePoint <= Last)?.[2];
}

/**
 * Formats a code point mapping as "U+0041 A".
 *
 * @category Unicode
 * @since 1.1.19
 */
function Mapping(Hexadecimal)
{
    const CodePoint = parseInt(Hexadecimal, 16);
    return `U+${Hex(CodePoint)} ${DisplayCharacter(CodePoint)}`;
}

/**
 * Describes a code point as a Unicode lookup site would: character, name, code
 * point, block, plane, general category, script, bidi class, version, UTF-8,
 * UTF-16, HTML references and simple case mappings.
 *
 * @category Unicode
 * @since 1.1.19
 */
export function DescribeCharacter(CodePoint)
{
    const Shown = DisplayCharacter(CodePoint);
    const Substituted = Shown !== String.fromCodePoint(CodePoint);
    const Category = GeneralCategory(CodePoint) || "Cn";
    const Bidi = BidiClass(CodePoint);
    const Plane = CodePoint >> 16;
    const Utf8 = [];
    for (const Byte of encodeURIComponent(String.fromCodePoint(CodePoint)).match(/%[0-9A-F]{2}|[^%]/gu) ?? [])
    {
        Utf8.push(Byte.startsWith("%") ? Byte.slice(1) : Byte.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
    }
    const Utf16 = Array.from({ length: CodePoint > 0xffff ? 2 : 1 },
        (_, Index) => String.fromCodePoint(CodePoint).charCodeAt(Index).toString(16).toUpperCase().padStart(4, "0"));
    const Control = ControlName(CodePoint);
    const Lines = [
        `Character:  ${Shown}${Substituted ? "   (a picture: the character itself would break the line)" : ""}`,
        `Name: ${CharacterName(CodePoint)}${Control ? ` (${Control})` : ""}`,
        `Code point: U+${Hex(CodePoint)} (decimal ${CodePoint})`,
        `Block: ${BlockOf(CodePoint) ?? "No block"}`,
        `Plane: ${Plane} (${PlaneNames[Plane] ?? "Unassigned plane"})`,
        `General category: ${Category} (${GeneralCategoryNames[Category] ?? Category})`,
        `Script: ${Script(CodePoint) || "Unknown"}`,
        `Bidi class: ${Bidi ? `${Bidi} (${BidiClassNames[Bidi] ?? Bidi})` : "Unassigned"}`,
        `Introduced: ${Age(CodePoint) ? `Unicode ${Age(CodePoint)}` : "Not assigned"}`,
        `UTF-8: ${Utf8.join(" ")}    UTF-16: ${Utf16.join(" ")}`,
        `HTML: &#${CodePoint}; &#x${Hex(CodePoint)};`
    ];
    const Upper = Uppercase(CodePoint);
    const Lower = Lowercase(CodePoint);
    if (Upper) Lines.push(`Uppercase: ${Mapping(Upper)}`);
    if (Lower) Lines.push(`Lowercase: ${Mapping(Lower)}`);
    Lines.push(`Data: Unicode ${UnicodeVersion}`);
    return Lines.join("\n");
}
