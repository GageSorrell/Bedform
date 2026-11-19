/**
 * Generates Source/UnicodeData.js from the Unicode Character Database: blocks,
 * character names (front-coded), derived-name patterns, control-character
 * Unicode 1.0 names, and run-length tables of general category, bidi class,
 * script, age and simple case mappings. UCD files are cached in dist/ucd and
 * downloaded from unicode.org when missing.
 *
 * Usage: node Tool/UnicodeData.mjs
 *
 * @module @sorrell/ddui-image-demo/Tool/UnicodeData
 *
 * @file      UnicodeData.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Cache = path.join(Root, "dist/ucd");
const Files = Object.freeze({
    Age: "DerivedAge.txt",
    Blocks: "Blocks.txt",
    Names: "extracted/DerivedName.txt",
    Scripts: "Scripts.txt",
    UnicodeData: "UnicodeData.txt"
});

/**
 * Returns a UCD file's text, downloading it into the cache first if needed.
 *
 * @category Tool
 * @since 1.1.19
 */
async function Read(Name)
{
    const Target = path.join(Cache, path.basename(Name));
    if (!existsSync(Target))
    {
        mkdirSync(Cache, { recursive: true });
        const Response = await fetch(`https://www.unicode.org/Public/UCD/latest/ucd/${Name}`);
        if (!Response.ok) throw new Error(`Downloading ${Name} failed: ${Response.status}`);
        writeFileSync(Target, await Response.text());
    }
    return readFileSync(Target, "utf8");
}

/**
 * Parses semicolon-separated UCD lines into trimmed fields, skipping comments
 * and blank lines.
 *
 * @category Tool
 * @since 1.1.19
 */
function Lines(Text)
{
    return Text.split("\n").map((Line) => Line.replace(/#.*/u, "").trim()).filter(Boolean)
        .map((Line) => Line.split(";").map((Field) => Field.trim()));
}

/**
 * Parses a "XXXX" or "XXXX..YYYY" code point range.
 *
 * @category Tool
 * @since 1.1.19
 */
function Range(Text)
{
    const [ First, Last = First ] = Text.split("..").map((Hex) => parseInt(Hex, 16));
    return [ First, Last ];
}

/**
 * Encodes a sorted list of [first, last, value] ranges as runs, "start value"
 * separated by "|", with an empty value for the gaps between ranges.
 *
 * @category Tool
 * @since 1.1.19
 */
function Runs(Ranges)
{
    const Sorted = [ ...Ranges ].sort((A, B) => A[0] - B[0]);
    const Output = [];
    let Next = 0;
    let Current;
    const Push = (Start, Value) =>
    {
        if (Value === Current) return;
        Output.push(`${Start.toString(16)} ${Value}`);
        Current = Value;
    };
    for (const [ First, Last, Value ] of Sorted)
    {
        if (First > Next) Push(Next, "");
        Push(First, Value);
        Next = Last + 1;
    }
    Push(Next, "");
    return Output.join("|");
}

const Version = (await Read("ReadMe.txt")).match(/version (\d+\.\d+\.\d+)/u)?.[1] ?? "unknown";

const Blocks = Lines(await Read(Files.Blocks)).map(([ Text, Name ]) => [ ...Range(Text), Name ]);

// UnicodeData.txt: general category, bidi class, Unicode 1.0 control names and simple case mappings.
const Categories = [];
const Bidi = [];
const Controls = [];
const Upper = [];
const Lower = [];
let Pending;
for (const Fields of Lines(await Read(Files.UnicodeData)))
{
    const CodePoint = parseInt(Fields[0], 16);
    if (Fields[1].endsWith(", First>")) { Pending = CodePoint; continue; }
    const First = Fields[1].endsWith(", Last>") ? Pending : CodePoint;
    Categories.push([ First, CodePoint, Fields[2] ]);
    Bidi.push([ First, CodePoint, Fields[4] ]);
    if (Fields[1] === "<control>" && Fields[10]) Controls.push(`${CodePoint.toString(16)} ${Fields[10]}`);
    if (Fields[12]) Upper.push(`${CodePoint.toString(16)} ${Fields[12].toLowerCase()}`);
    if (Fields[13]) Lower.push(`${CodePoint.toString(16)} ${Fields[13].toLowerCase()}`);
}

const Scripts = Lines(await Read(Files.Scripts)).map(([ Text, Name ]) => [ ...Range(Text), Name.replace(/_/gu, " ") ]);
const Ages = Lines(await Read(Files.Age)).map(([ Text, Age ]) => [ ...Range(Text), Age ]);

// DerivedName.txt: individual names, front-coded, plus "PREFIX-*" patterns. Hangul syllables are algorithmic.
const Patterns = [];
const Named = [];
for (const [ Text, Name ] of Lines(await Read(Files.Names)))
{
    const [ First, Last ] = Range(Text);
    if (Name.endsWith("*")) Patterns.push([ First, Last, Name.slice(0, -1) ]);
    else if (First < 0xac00 || First > 0xd7a3) Named.push([ First, Name ]);
}
Named.sort((A, B) => A[0] - B[0]);
const NameRuns = [];
for (const [ CodePoint ] of Named)
{
    const Last = NameRuns.at(-1);
    if (Last && Last[0] + Last[1] === CodePoint) Last[1]++;
    else NameRuns.push([ CodePoint, 1 ]);
}
let Previous = "";
const Names = Named.map(([ , Name ]) =>
{
    let Shared = 0;
    // Capped at 88 so the length character (35 + 88 = "{") is never the "|" separator.
    while (Shared < Math.min(Name.length, Previous.length, 88) && Name[Shared] === Previous[Shared]) Shared++;
    Previous = Name;
    return String.fromCharCode(35 + Shared) + Name.slice(Shared);
}).join("|");

const Output = `/**
 * Unicode ${Version} character data for the Unicode browser: blocks, names,
 * general category, bidi class, script, age and simple case mappings.
 *
 * This module is auto-generated by Tool/UnicodeData.mjs.
 *
 * @module @sorrell/ddui-image-demo/Source/UnicodeData
 *
 * @file      UnicodeData.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

/** Unicode Character Database version. */
export const UnicodeVersion = ${JSON.stringify(Version)};

/** Blocks as [first, last, name]. */
export const Blocks = ${JSON.stringify(Blocks)};

/** Derived-name patterns as [first, last, prefix]; the name is the prefix and the hexadecimal code point. */
export const NamePatterns = ${JSON.stringify(Patterns)};

/** Runs of individually named code points, "start count" in hexadecimal, separated by "|". */
export const NameRuns = ${JSON.stringify(NameRuns.map(([ Start, Count ]) => `${Start.toString(16)} ${Count.toString(16)}`).join("|"))};

/**
 * Names in code point order, separated by "|". Each begins with one character
 * whose code minus 35 is the length of the prefix shared with the previous name.
 */
export const Names = ${JSON.stringify(Names)};

/** Unicode 1.0 names of control characters, "code name", separated by "|". */
export const ControlNames = ${JSON.stringify(Controls.join("|"))};

/** Runs of "start value", separated by "|"; an empty value marks unassigned code points. */
export const GeneralCategoryRuns = ${JSON.stringify(Runs(Categories))};

/** Runs of bidi class, encoded like GeneralCategoryRuns. */
export const BidiClassRuns = ${JSON.stringify(Runs(Bidi))};

/** Runs of script, encoded like GeneralCategoryRuns. */
export const ScriptRuns = ${JSON.stringify(Runs(Scripts))};

/** Runs of the Unicode version that assigned each code point, encoded like GeneralCategoryRuns. */
export const AgeRuns = ${JSON.stringify(Runs(Ages))};

/** Simple uppercase mappings, "code mapping", separated by "|". */
export const UppercaseMappings = ${JSON.stringify(Upper.join("|"))};

/** Simple lowercase mappings, "code mapping", separated by "|". */
export const LowercaseMappings = ${JSON.stringify(Lower.join("|"))};
`;
writeFileSync(path.join(Root, "Source/UnicodeData.js"), Output);
console.log(`Unicode ${Version}: ${Blocks.length} blocks, ${Named.length} names, ${Patterns.length} patterns, ${(Output.length / 1024).toFixed(0)} KiB.`);
