/**
 * Measures the advance width of every character of the Bedrock client's
 * Unicode font as it is drawn in a TextPrimitive, by photographing batches of
 * Source/GlyphProbePlan.js lines shown by Source/GlyphProbe.js and measuring
 * the distance between each line's brackets. Also measures where each glyph's
 * ink lies within its advance. Needs the demo server running through
 * Tool/Host.mjs and the Minecraft client on screen, joined to it.
 *
 * Usage: node Tool/MeasureGlyphs.mjs [--first HEX] [--last HEX] [--columns N]
 *        [--lines N] [--fov DEGREES] [--no-adapt]
 *
 * The first photograph sets the screen scale: the run then restarts with as
 * many columns and lines as keep about 1.5 screen pixels per font pixel.
 * Results go to dist/glyph-probe/measured.json and summary.txt.
 *
 * @module @sorrell/ddui-image-demo/Tool/MeasureGlyphs
 *
 * @file      MeasureGlyphs.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { BatchColumns, HeaderLines, ProbeCharacters } from "../Source/GlyphProbePlan.js";
import { UnicodeFontWidthTable } from "../Source/GlyphWidths.js";
import { ScriptEvent } from "../Source/Keys.js";
import { FindClient, FontArchive, OpaqueColumns, ReadArchive, SheetReader, UnicodePageName } from "./ClientFont.mjs";
import { Analyze, Convert, ReadBmp, SavePng } from "./GlyphShot.mjs";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Server = path.join(Root, "dist/bds-runtime");
const Output = path.join(Root, "dist/glyph-probe");
const Shot = path.join(Output, "current.bmp");
/** Screen pixels per Unicode-font pixel the adapted layout aims for. */
const TargetScale = 1.5;
/** Part of the screen height GlyphProbe.js fits the columns to. */
const ScreenFill = 0.7;

/**
 * Parses the command line into measurement options.
 *
 * @throws { Error } On an unknown option.
 *
 * @category Tool
 * @since 1.1.37
 */
function ParseArguments(Arguments)
{
    const Options = { Adapt: true, Columns: 6, First: 0, Fov: 40, Last: 0xffff, Lines: 23 };
    for (let Index = 0; Index < Arguments.length; Index++)
    {
        const Name = Arguments[Index];
        const Value = Arguments[Index + 1];
        if (Name === "--no-adapt") Options.Adapt = false;
        else if (Name === "--first" || Name === "--last") { Options[Name === "--first" ? "First" : "Last"] = parseInt(Value, 16); Index++; }
        else if (Name === "--columns" || Name === "--lines" || Name === "--fov")
        {
            Options[{ "--columns": "Columns", "--fov": "Fov", "--lines": "Lines" }[Name]] = Number(Value);
            Index++;
        }
        else throw new Error(`Unknown option ${Name}`);
    }
    return Options;
}

/**
 * Runs a console command on the server through Tool/Host.mjs, waiting for
 * any earlier command to be taken first.
 *
 * @throws { Error } When the host does not take the command.
 *
 * @category Tool
 * @since 1.1.37
 */
async function SendCommand(Command)
{
    const Request = path.join(Server, "command.request");
    for (let Attempt = 0; existsSync(Request); Attempt++)
    {
        if (Attempt > 200) throw new Error("The server host is not taking commands; restart it with the current Tool/Host.mjs.");
        await Sleep(25);
    }
    writeFileSync(Request + ".tmp", Command + "\n");
    renameSync(Request + ".tmp", Request);
}

const Sleep = (Milliseconds) => new Promise((Resolve) => setTimeout(Resolve, Milliseconds));

/**
 * Follows the server log from its current end, yielding each new line
 * without control characters.
 *
 * @category Tool
 * @since 1.1.37
 */
async function* FollowLog()
{
    const File = path.join(Server, "console.log");
    let Offset = statSync(File).size;
    let Partial = "";
    for (;;)
    {
        const Size = statSync(File).size;
        if (Size > Offset)
        {
            const Buffer_ = Buffer.alloc(Size - Offset);
            const Handle = openSync(File, "r");
            readSync(Handle, Buffer_, 0, Buffer_.length, Offset);
            closeSync(Handle);
            Offset = Size;
            const Lines = (Partial + Buffer_.toString("utf8")).split(/\r?\n/u);
            Partial = Lines.pop();
            for (const Line of Lines) yield Line.replace(/[\u0000-\u0008\u000b-\u001f]/gu, "");
        }
        else await Sleep(20);
    }
}

/**
 * Starts Tool/CaptureWindow.ps1 and returns a function that saves the game
 * window to a path and resolves to its size.
 *
 * @throws { Error } When a capture fails.
 *
 * @category Tool
 * @since 1.1.37
 */
function StartCapture()
{
    const Child = spawn("powershell.exe", [ "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
        path.join(Root, "Tool/CaptureWindow.ps1") ], { stdio: [ "pipe", "pipe", "inherit" ] });
    const Replies = [];
    const Waiting = [];
    createInterface({ input: Child.stdout }).on("line", (Line) =>
    {
        if (Waiting.length > 0) Waiting.shift()(Line);
        else Replies.push(Line);
    });
    const Capture = async (File) =>
    {
        Child.stdin.write(File + "\n");
        const Reply = Replies.length > 0 ? Replies.shift() : await new Promise((Resolve) => Waiting.push(Resolve));
        if (!Reply.startsWith("OK ")) throw new Error(`Capture failed: ${Reply}`);
        return Reply;
    };
    Capture.Stop = () => Child.stdin.end();
    return Capture;
}

/**
 * Returns where each code point's ink lies in its Unicode font cell, in font
 * pixels from the cell's left edge, or null for an empty cell.
 *
 * @category Tool
 * @since 1.1.37
 */
function ImageInk(Sheet, CodePoint)
{
    const Page = Sheet(UnicodePageName(CodePoint));
    if (!Page) return null;
    const Cell = Page.width / 16;
    const Columns = OpaqueColumns(Page, CodePoint & 0xff, Cell);
    return Columns ? { Left: Columns.Left * 16 / Cell, Right: (Columns.Right + 1) * 16 / Cell } : null;
}

/**
 * Writes the measurements and a summary comparing them with the font image
 * and the width model in Source/GlyphWidths.js.
 *
 * @category Tool
 * @since 1.1.37
 */
function WriteResults(Results, Failed, Scales, Sheet, Final)
{
    const Scale = Scales.Sum / Scales.Count;
    const Records = [ ...Results.values() ].sort((A, B) => A.CodePoint - B.CodePoint).map((Raw) =>
    {
        const Ink = ImageInk(Sheet, Raw.CodePoint);
        return { ...Raw, ...Convert(Raw, Scale), ImageLeft: Ink?.Left ?? null, ImageRight: Ink?.Right ?? null };
    });
    writeFileSync(path.join(Output, "measured.json"), JSON.stringify({ Failed, Records, Scale }, null, 1));
    if (!Final) return;
    const Count = (Map_, Key) => Map_.set(Key, (Map_.get(Key) ?? 0) + 1);
    const Advances = new Map();
    const Spacing = new Map();
    const LeftOffsets = new Map();
    let ModelMatches = 0;
    const Mismatches = [];
    for (const Record of Records)
    {
        const Rounded = Math.round(Record.Advance);
        Count(Advances, Rounded);
        const Model = UnicodeFontWidthTable.charCodeAt(Record.CodePoint) - 48;
        if (Rounded === Model) ModelMatches++;
        else Mismatches.push(Record);
        if (Record.ImageLeft !== null)
        {
            Count(Spacing, Rounded - (Record.ImageRight - Record.ImageLeft));
            if (Record.InkLeft !== null) Count(LeftOffsets, Math.round(Record.InkLeft * 2) / 2);
        }
    }
    const Table = (Map_) => [ ...Map_ ].sort((A, B) => A[0] - B[0]).map(([ Key, Value ]) => `  ${Key}: ${Value}`).join("\n");
    const Lines = [
        `Measured ${Records.length} characters; ${Failed.length} failed. ` +
            `Screen scale ${Scale.toFixed(4)} px per font px over ${Scales.Count} columns.`,
        `Advance (rounded, Unicode-font pixels) matches the model for ${ModelMatches}; differs for ${Mismatches.length}.`,
        "Advances:", Table(Advances),
        "Advance less image ink width (the space beside the ink):", Table(Spacing),
        "Ink left edge from the pen, relative to the closing bracket's (to half a pixel):", Table(LeftOffsets),
        "First mismatches (code point, measured, model):",
        ...Mismatches.slice(0, 60).map((Record) =>
            `  U+${Record.CodePoint.toString(16).toUpperCase().padStart(4, "0")} ${Record.Advance.toFixed(2)} ` +
            `${UnicodeFontWidthTable.charCodeAt(Record.CodePoint) - 48}`)
    ];
    writeFileSync(path.join(Output, "summary.txt"), Lines.join("\n") + "\n");
    console.log(Lines.join("\n"));
}

/**
 * Chooses the layout for the real run from the first photograph: corrects the
 * assumed field of view by how much of the screen the columns filled, then
 * sets the lines per column for about `TargetScale` screen pixels per font
 * pixel and as many columns as fit across the screen.
 *
 * @category Tool
 * @since 1.1.37
 */
function Adapted(Options, Analysis, Image)
{
    const Scales = Analysis.Columns.map((Column) => Column.Scale).filter(Number.isFinite);
    if (Scales.length === 0) return undefined;
    const Scale = Scales.reduce((Sum, Value) => Sum + Value, 0) / Scales.length;
    const Top = Math.min(...Analysis.Columns.map((Column) => Column.Y0));
    const Bottom = Math.max(...Analysis.Columns.map((Column) => Column.Y1));
    const Fill = (Bottom - Top + 1) / Image.Height;
    const Fov = 2 * Math.atan(Math.tan(Options.Fov * Math.PI / 360) * ScreenFill / Fill) * 180 / Math.PI;
    const FilledScale = Scale * ScreenFill / Fill;
    const Lines = Math.max(4, Math.min(120, Math.floor((Options.Lines + HeaderLines) * FilledScale / TargetScale) - HeaderLines));
    const NewScale = FilledScale * (Options.Lines + HeaderLines) / (Lines + HeaderLines);
    const Centers = Analysis.Columns.map((Column) => (Column.X0 + Column.X1) / 2);
    const Spacing = Centers.length > 1 ? (Centers.at(-1) - Centers[0]) / (Centers.length - 1) : Image.Width / 2;
    const Columns = Math.max(1, Math.min(40, Math.floor(0.96 * Image.Width / (Spacing * NewScale / Scale))));
    return { ...Options, Columns, Fov: Math.round(Fov * 10) / 10, Lines, Scale, NewScale };
}

const Options = ParseArguments(process.argv.slice(2));
mkdirSync(Output, { recursive: true });
if (!existsSync(path.join(Server, "host.pid"))) throw new Error("Start the server first: npm start --workspace @sorrell/ddui-image-demo");
const Sheet = SheetReader(ReadArchive(FontArchive(FindClient())));
const Capture = StartCapture();
const Results = new Map();
const Failed = [];
/** Column scales of the real run, averaged for the conversion to font pixels. */
const Scales = { Count: 0, Sum: 0 };
let Session = { ...Options };
let Characters = ProbeCharacters(Session.First, Session.Last);
let Adapting = Options.Adapt;
let Started = false;
let Done = -1;
const StartCommand = (Given) => `scriptevent ${ScriptEvent.GlyphProbe} start ${JSON.stringify({
    Columns: Given.Columns, First: Given.First, Fov: Given.Fov, Last: Given.Last, Lines: Given.Lines
})}`;
const Log = FollowLog();
await SendCommand(StartCommand(Session));
console.log(`Requested a measurement of ${Characters.length} characters; join the server and keep the game window visible.`);
let LastNote = "";
for await (const Line of Log)
{
    const Match = /GLYPH_PROBE_(\w+) ?(.*)$/u.exec(Line);
    if (!Match) continue;
    const [ , Kind, Rest ] = Match;
    if (Kind === "WAITING")
    {
        if (Rest !== LastNote) console.log(`Waiting: ${Rest}`);
        LastNote = Rest;
    }
    else if (Kind === "STARTED")
    {
        Started = true;
        Done = -1;
        console.log(`Started: ${Rest}`);
    }
    else if (Kind === "SHOT" && Started)
    {
        const Batch = JSON.parse(Rest);
        if (Batch.Batch <= Done) continue;
        const Columns = BatchColumns(Characters, Batch.Batch, Session.Columns, Session.Lines);
        if ((Columns[0][0] ?? -1) !== Batch.First) throw new Error(`Batch ${Batch.Batch} starts at ${Batch.First}, expected ${Columns[0][0]}`);
        let Image;
        let Analysis;
        for (let Attempt = 0; ; Attempt++)
        {
            await Capture(Shot);
            Image = ReadBmp(Shot);
            Analysis = Analyze(Image, Batch.Color, Batch.Counts);
            if (!Analysis.Stale && Analysis.Expected > 0) break;
            if (Attempt >= 30)
            {
                SavePng(Image, path.join(Output, `stale-batch-${Batch.Batch}.png`));
                throw new Error(`Batch ${Batch.Batch} never appeared on screen; see dist/glyph-probe/stale-batch-${Batch.Batch}.png`);
            }
            await Sleep(100);
        }
        if (Analysis.Columns.length !== Batch.Counts.length)
        {
            SavePng(Image, path.join(Output, `layout-batch-${Batch.Batch}.png`));
            await SendCommand(`scriptevent ${ScriptEvent.GlyphProbe} stop`);
            throw new Error(`Found ${Analysis.Columns.length} display columns, expected ${Batch.Counts.length}; ` +
                `see dist/glyph-probe/layout-batch-${Batch.Batch}.png`);
        }
        if (Adapting)
        {
            Adapting = false;
            SavePng(Image, path.join(Output, "first-shot.png"));
            const Next = Adapted(Session, Analysis, Image);
            if (!Next) throw new Error("Could not read the rulers in the first photograph; see dist/glyph-probe/first-shot.png");
            console.log(`Scale ${Next.Scale.toFixed(2)} screen px per font px; restarting with ${Next.Columns} columns of ` +
                `${Next.Lines} lines at ${Next.Fov}° for about ${Next.NewScale.toFixed(2)}.`);
            Session = { ...Session, Columns: Next.Columns, Fov: Next.Fov, Lines: Next.Lines };
            Characters = ProbeCharacters(Session.First, Session.Last);
            Started = false;
            await SendCommand(StartCommand(Session));
            continue;
        }
        let Bad = 0;
        Analysis.Columns.forEach((Column, Index) =>
        {
            if (!Column.Ok)
            {
                Failed.push(...Columns[Index]);
                Bad++;
                return;
            }
            Scales.Sum += Column.Scale;
            Scales.Count++;
            Column.Lines.forEach((Measured, Line) =>
            {
                const CodePoint = Columns[Index][Line];
                Results.set(CodePoint, {
                    CodePoint, InkLeftPixels: Measured.InkLeftPixels, InkRightPixels: Measured.InkRightPixels,
                    SpanPixels: Measured.SpanPixels
                });
            });
        });
        if (Bad > 0) SavePng(Image, path.join(Output, `failed-batch-${Batch.Batch}.png`));
        Done = Batch.Batch;
        await SendCommand(`scriptevent ${ScriptEvent.GlyphProbe} next ${Batch.Batch}`);
        if (Batch.Batch % 10 === 0)
        {
            console.log(`Batch ${Batch.Batch + 1}/${Batch.Batches}: ${Results.size} measured, ${Failed.length} failed`);
            WriteResults(Results, Failed, Scales, Sheet, false);
        }
    }
    else if (Kind === "DONE" || Kind === "STOPPED")
    {
        if (!Started) continue;
        console.log(`Measurement ${Kind.toLowerCase()} at ${Rest}.`);
        break;
    }
}
if (Scales.Count > 0) WriteResults(Results, Failed, Scales, Sheet, true);
Capture.Stop();
process.exit(0);
