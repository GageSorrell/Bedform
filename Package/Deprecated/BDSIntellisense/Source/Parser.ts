/**
 * Line-oriented reading of `server.properties` text into entries, comments and unreadable lines.
 *
 * Bedrock Dedicated Server reads one `key=value` assignment per line and treats lines whose first
 * non-blank character is `#` as comments.  There are no continuation lines or escapes.  Positions
 * are zero-based UTF-16 offsets, matching editor positions.
 *
 * @module bds-intellisense/Parser
 *
 * @file      Parser.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * A run of characters on one line, from `Start` up to but excluding `End`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface TextSpan
{
    readonly End: number;
    readonly Line: number;
    readonly Start: number;
}

/**
 * The parts of a `key=value` assignment, with surrounding whitespace excluded from both spans.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Assignment
{
    readonly Key: string;
    readonly KeySpan: TextSpan;
    /** The offset of the first `=` on the line. */
    readonly Separator: number;
    readonly Value: string;
    readonly ValueSpan: TextSpan;
}

/**
 * A line holding only whitespace.
 *
 * @category Types
 * @since 1.0.0
 */
export interface BlankLine
{
    readonly Kind: "Blank";
    readonly Line: number;
    readonly Text: string;
}

/**
 * A line whose first non-blank character is `#`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface CommentLine
{
    /** Present when the comment reads like a disabled assignment, such as `# server-ip=`. */
    readonly Assignment?: Assignment;
    /** The comment text after `#` and one following space, if there is one. */
    readonly Body: string;
    readonly Kind: "Comment";
    readonly Line: number;
    readonly Text: string;
}

/**
 * A line that assigns a value to a property.
 *
 * @category Types
 * @since 1.0.0
 */
export interface EntryLine extends Assignment
{
    readonly Kind: "Entry";
    readonly Line: number;
    readonly Text: string;
}

/**
 * A line that is neither blank, a comment nor an assignment; the server cannot read it.
 *
 * @category Types
 * @since 1.0.0
 */
export interface InvalidLine
{
    readonly Kind: "Invalid";
    readonly Line: number;
    /** The non-blank part of the line. */
    readonly Span: TextSpan;
    readonly Text: string;
}

/**
 * Any classified line of a `server.properties` document.
 *
 * @category Types
 * @since 1.0.0
 */
export type ParsedLine = BlankLine | CommentLine | EntryLine | InvalidLine;

/**
 * Every line of a document in order, with the assignments also listed on their own.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ParsedDocument
{
    readonly Entries: ReadonlyArray<EntryLine>;
    readonly Lines: ReadonlyArray<ParsedLine>;
}

/** Matches a comment that holds a disabled assignment, capturing the text after `#`. */
const CommentedAssignmentPattern: RegExp = /^\s*#\s*([A-Za-z0-9][A-Za-z0-9._-]*\s*=.*)$/u;

/**
 * Creates a span on one line.
 *
 * @category Functions
 * @since 1.0.0
 */
export function MakeSpan(line: number, start: number, end: number): TextSpan
{
    return {
        End: end,
        Line: line,
        Start: start
    };
}

/**
 * Locates the trimmed text between two offsets of a line.
 */
function TrimmedSpan(text: string, line: number, start: number, end: number): TextSpan
{
    let first: number = start;
    let last: number = end;
    while (first < last && /\s/u.test(text[first]))
    {
        first++;
    }

    while (last > first && /\s/u.test(text[last - 1]))
    {
        last--;
    }

    return MakeSpan(line, first, last);
}

/**
 * Splits a line at its first `=` into an assignment, or yields `undefined` without one.
 *
 * `offset` is where the assignment starts within the line, which is past the `#` for disabled
 * assignments in comments.
 */
function ReadAssignment(text: string, line: number, offset: number): Assignment | undefined
{
    const separator: number = text.indexOf("=", offset);
    if (separator < 0)
    {
        return undefined;
    }

    const keySpan: TextSpan = TrimmedSpan(text, line, offset, separator);
    const valueSpan: TextSpan = TrimmedSpan(text, line, separator + 1, text.length);
    return {
        Key: text.slice(keySpan.Start, keySpan.End),
        KeySpan: keySpan,
        Separator: separator,
        Value: text.slice(valueSpan.Start, valueSpan.End),
        ValueSpan: valueSpan
    };
}

/**
 * Classifies a comment line, recognizing disabled assignments.
 */
function ParseComment(text: string, line: number, start: number): CommentLine
{
    const bodyStart: number = start + (text[start + 1] === " " ? 2 : 1);
    const match: RegExpExecArray | null = CommentedAssignmentPattern.exec(text);
    const assignment: Assignment | undefined = match === null
        ? undefined
        : ReadAssignment(text, line, text.length - match[1].length);

    const comment: CommentLine = {
        Body: text.slice(bodyStart),
        Kind: "Comment",
        Line: line,
        Text: text
    };

    return assignment === undefined
        ? comment
        : {
            ...comment,
            Assignment: assignment
        };
}

/**
 * Classifies a single line of text, given its zero-based line number.
 *
 * @category Functions
 * @since 1.0.0
 */
export function ParseLine(text: string, line: number): ParsedLine
{
    const span: TextSpan = TrimmedSpan(text, line, 0, text.length);
    if (span.Start === span.End)
    {
        return {
            Kind: "Blank",
            Line: line,
            Text: text
        };
    }

    if (text[span.Start] === "#")
    {
        return ParseComment(text, line, span.Start);
    }

    const assignment: Assignment | undefined = ReadAssignment(text, line, 0);
    if (assignment === undefined)
    {
        return {
            Kind: "Invalid",
            Line: line,
            Span: span,
            Text: text
        };
    }

    return {
        ...assignment,
        Kind: "Entry",
        Line: line,
        Text: text
    };
}

/**
 * Splits text into lines at `\r\n`, `\r` or `\n`, as editors do.
 *
 * @category Functions
 * @since 1.0.0
 */
export function SplitLines(text: string): Array<string>
{
    return text.split(/\r\n|\r|\n/u);
}

/**
 * Classifies every line of a `server.properties` document.
 *
 * @category Functions
 * @since 1.0.0
 */
export function ParseDocument(text: string): ParsedDocument
{
    const lines: Array<ParsedLine> = SplitLines(text).map(
        (line: string, index: number) => ParseLine(line, index));

    const entries: Array<EntryLine> = lines.filter((line: ParsedLine): line is EntryLine =>
        line.Kind === "Entry");

    return {
        Entries: entries,
        Lines: lines
    };
}
