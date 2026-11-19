/**
 * Editor-independent validation, completion and hover for `server.properties` documents.
 *
 * Every function takes a parsed document and the schema of the BDS release it targets, and returns
 * plain data with zero-based positions, so that any editor integration can adapt the results.
 *
 * @module bds-intellisense/Analysis
 *
 * @file      Analysis.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Version from "./Version.js";
import type { Assignment, EntryLine, ParsedDocument, ParsedLine, TextSpan } from "./Parser.js";
import { DiagnosticCode, DiagnosticSource } from "./Keys.js";
import { FindProperty, FormatHistory, PropertyHistory } from "./Schema/Catalog.js";
import type { NumberType,
    PropertySchema,
    PropertyType,
    ServerPropertiesSchema,
    StringType } from "./Schema/Types.js";
import type { SchemaCatalog, VersionRange } from "./Schema/Catalog.js";
import { MakeSpan } from "./Parser.js";

/**
 * How serious a diagnostic is.
 *
 * @category Types
 * @since 1.0.0
 */
export type Severity = "Error" | "Hint" | "Information" | "Warning";

/**
 * A problem found in a document.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Diagnostic
{
    readonly Code: DiagnosticCode;
    /** The property the problem concerns, when there is one. */
    readonly Key?: string;
    readonly Message: string;
    readonly Severity: Severity;
    /** Always {@link DiagnosticSource}. */
    readonly Source: typeof DiagnosticSource;
    readonly Span: TextSpan;
    /** Replacement texts for {@link Diagnostic.Span}, best first; empty when none apply. */
    readonly Suggestions: ReadonlyArray<string>;
}

/**
 * Why a value does not suit its property, with replacement values when some are likely meant.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ValueProblem
{
    readonly Code: DiagnosticCode;
    readonly Message: string;
    readonly Severity: Severity;
    readonly Suggestions: ReadonlyArray<string>;
}

/**
 * A zero-based line and UTF-16 character offset.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Position
{
    readonly Character: number;
    readonly Line: number;
}

/**
 * Whether a completion inserts a property name or a value.
 *
 * @category Types
 * @since 1.0.0
 */
export type CompletionKind = "Property" | "Value";

/**
 * One completion proposal.
 *
 * @category Types
 * @since 1.0.0
 */
export interface CompletionItem
{
    /** A short note shown beside the label, such as the default value. */
    readonly Detail?: string;
    /** Markdown shown when the proposal is selected. */
    readonly Documentation?: string;
    /** The text to insert; TextMate snippet syntax when {@link CompletionItem.IsSnippet} is set. */
    readonly InsertText: string;
    readonly IsSnippet: boolean;
    readonly Kind: CompletionKind;
    readonly Label: string;
    /** Orders proposals as the default file does, rather than alphabetically. */
    readonly SortText: string;
}

/**
 * Completion proposals and the text they replace.
 *
 * @category Types
 * @since 1.0.0
 */
export interface CompletionResult
{
    readonly Items: ReadonlyArray<CompletionItem>;
    readonly Span: TextSpan;
}

/**
 * Hover text and the span it describes.
 *
 * @category Types
 * @since 1.0.0
 */
export interface HoverResult
{
    readonly Markdown: string;
    readonly Span: TextSpan;
}

/** A candidate replacement and how far it is from the text it replaces. */
interface Score
{
    readonly Candidate: string;
    readonly Distance: number;
}

/** The most suggestions offered for a misspelt key or value. */
const SuggestionLimit: number = 3;

/**
 * Counts the single-character insertions, deletions and substitutions that turn one text into another.
 */
function EditDistance(left: string, right: string): number
{
    let previous: Array<number> = Array.from(
        { length: right.length + 1 },
        (_: unknown, index: number) => index);

    for (let row: number = 1; row <= left.length; row++)
    {
        const current: Array<number> = [ row ];
        for (let column: number = 1; column <= right.length; column++)
        {
            const substitution: number = left[row - 1] === right[column - 1] ? 0 : 1;
            current.push(Math.min(
                previous[column] + 1,
                current[column - 1] + 1,
                previous[column - 1] + substitution));
        }

        previous = current;
    }

    return previous[right.length];
}

/**
 * Picks the candidates nearest to a misspelling, ignoring letter case; a match apart from case
 * always comes first, and candidates too different to be meant are left out.
 */
function Closest(candidates: Iterable<string>, text: string): Array<string>
{
    const lowered: string = text.toLowerCase();
    const threshold: number = Math.max(2, Math.floor(text.length / 3));
    const scored: Array<Score> = [];
    for (const candidate of candidates)
    {
        const distance: number = EditDistance(lowered, candidate.toLowerCase());
        if (distance <= threshold && candidate !== text)
        {
            scored.push({
                Candidate: candidate,
                Distance: distance
            });
        }
    }

    return scored
        .sort((left: Score, right: Score) => left.Distance - right.Distance)
        .slice(0, SuggestionLimit)
        .map((score: Score) => score.Candidate);
}

/**
 * Wraps text in Markdown code ticks.
 */
function Code(text: string): string
{
    return `\`${text}\``;
}

/**
 * Joins words as `a`, `a or b`, or `a, b or c`.
 */
function Alternatives(words: ReadonlyArray<string>): string
{
    return words.length <= 1
        ? words.join("")
        : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

/**
 * Describes the numbers a property accepts, such as "an integer between 1 and 65535".
 */
function DescribeNumber(type: NumberType): string
{
    const noun: string = type.Integer ? "an integer" : "a number";
    let bounds: string = "";
    if (type.Minimum !== undefined && type.Maximum !== undefined)
    {
        bounds = ` between ${type.Minimum} and ${type.Maximum}`;
    }
    else if (type.Minimum !== undefined)
    {
        bounds = ` of at least ${type.Minimum}`;
    }
    else if (type.Maximum !== undefined)
    {
        bounds = ` of at most ${type.Maximum}`;
    }

    const keywords: string = type.Keywords === undefined || type.Keywords.length === 0
        ? ""
        : `, or ${Alternatives(type.Keywords.map(Code))}`;

    return noun + bounds + keywords;
}

/**
 * Builds a problem report for a value.
 */
function Problem(
    code: DiagnosticCode,
    severity: Severity,
    message: string,
    suggestions: ReadonlyArray<string> = []): ValueProblem
{
    return {
        Code: code,
        Message: message,
        Severity: severity,
        Suggestions: suggestions
    };
}

/**
 * Checks a number against its property's type.
 */
function CheckNumber(key: string, type: NumberType, value: string): ValueProblem | undefined
{
    if (type.Keywords?.includes(value))
    {
        return undefined;
    }

    const pattern: RegExp = type.Integer ? /^[+-]?\d+$/u : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u;
    const number: number = Number(value);
    const inRange: boolean = (type.Minimum === undefined || number >= type.Minimum) &&
        (type.Maximum === undefined || number <= type.Maximum);

    if (pattern.test(value) && inRange)
    {
        return undefined;
    }

    const keyword: string | undefined = type.Keywords?.find((candidate: string) =>
        candidate.toLowerCase() === value.toLowerCase());

    return Problem(
        DiagnosticCode.InvalidValue,
        "Error",
        `${Code(key)} must be ${DescribeNumber(type)}.`,
        keyword === undefined ? [] : [ keyword ]);
}

/**
 * Checks free text against the characters and pattern its property allows.
 */
function CheckString(
    key: string,
    type: StringType,
    value: string): ValueProblem | undefined
{
    const forbidden: Array<string> = [ ...type.Forbidden ?? "" ].filter((character: string) =>
        value.includes(character));

    if (forbidden.length > 0)
    {
        const cleaned: string = [ ...value ].filter((character: string) =>
            !forbidden.includes(character)).join("");

        return Problem(
            DiagnosticCode.ForbiddenCharacter,
            "Error",
            `${Code(key)} must not contain ${Alternatives(forbidden.map(Code))}.`,
            [ cleaned ]);
    }

    if (type.Pattern !== undefined && !new RegExp(`^(?:${type.Pattern})$`, "u").test(value))
    {
        const expected: string = type.PatternDescription ?? `text matching ${Code(type.Pattern)}`;
        return Problem(DiagnosticCode.InvalidValue, "Error", `${Code(key)} must be ${expected}.`);
    }

    return undefined;
}

/**
 * Checks a value against the type of its property.
 */
function CheckType(key: string, type: PropertyType, value: string): ValueProblem | undefined
{
    switch (type.Kind)
    {
        case "Boolean":
        {
            if (value === "true" || value === "false")
            {
                return undefined;
            }

            const lowered: string = value.toLowerCase();
            return Problem(
                DiagnosticCode.InvalidValue,
                "Error",
                `${Code(key)} must be ${Code("true")} or ${Code("false")}.`,
                lowered === "true" || lowered === "false" ? [ lowered ] : [ "true", "false" ]);
        }

        case "Enum":
        {
            if (type.Values.includes(value))
            {
                return undefined;
            }

            return Problem(
                DiagnosticCode.InvalidValue,
                "Error",
                `${Code(key)} must be ${Alternatives(type.Values.map(Code))}.`,
                Closest(type.Values, value));
        }

        case "Number":
        {
            return CheckNumber(key, type, value);
        }

        case "String":
        {
            return CheckString(key, type, value);
        }
    }
}

/**
 * Checks a value against its property, or yields `undefined` when the value is acceptable.
 *
 * An empty value is acceptable for text properties.  For every other kind it is reported as a
 * warning that suggests the default, if the property has one.
 *
 * @category Functions
 * @since 1.0.0
 */
export function CheckValue(property: PropertySchema, value: string): ValueProblem | undefined
{
    if (value === "" && property.Type.Kind !== "String")
    {
        return Problem(
            DiagnosticCode.EmptyValue,
            "Warning",
            `${Code(property.Key)} has no value.`,
            property.Default === undefined || property.Default === "" ? [] : [ property.Default ]);
    }

    return CheckType(property.Key, property.Type, value);
}

/**
 * Builds a diagnostic.
 */
function MakeDiagnostic(span: TextSpan, problem: ValueProblem, key?: string): Diagnostic
{
    return {
        Code: problem.Code,
        ...key === undefined ? {} : { Key: key },
        Message: problem.Message,
        Severity: problem.Severity,
        Source: DiagnosticSource,
        Span: span,
        Suggestions: problem.Suggestions
    };
}

/**
 * Reports a key that the schema lacks, distinguishing keys of other releases from unknown ones.
 */
function CheckUnknownKey(
    entry: EntryLine,
    schema: ServerPropertiesSchema,
    catalog: SchemaCatalog | undefined): Diagnostic
{
    const history: ReadonlyArray<VersionRange> =
        catalog === undefined ? [] : PropertyHistory(catalog, entry.Key);

    if (history.length > 0)
    {
        return MakeDiagnostic(entry.KeySpan, Problem(
            DiagnosticCode.UnsupportedProperty,
            "Warning",
            `${Code(entry.Key)} is not supported by BDS ${Version.Format(schema.Version)}; ` +
            `it is available in ${FormatHistory(history)}.`), entry.Key);
    }

    const keys: Array<string> = schema.Properties.map((property: PropertySchema) => property.Key);
    const suggestions: Array<string> = Closest(keys, entry.Key);
    const hint: string = suggestions.length === 0 ? "" : ` Did you mean ${Code(suggestions[0])}?`;
    return MakeDiagnostic(entry.KeySpan, Problem(
        DiagnosticCode.UnknownProperty,
        "Warning",
        `Unknown property ${Code(entry.Key)}.${hint}`,
        suggestions), entry.Key);
}

/**
 * Checks one assignment, recording its key so that later duplicates can be reported.
 */
function CheckEntry(
    entry: EntryLine,
    schema: ServerPropertiesSchema,
    catalog: SchemaCatalog | undefined,
    seen: Map<string, number>): Array<Diagnostic>
{
    if (entry.Key === "")
    {
        return [ MakeDiagnostic(
            MakeSpan(entry.Line, entry.Separator, entry.Separator + 1),
            Problem(DiagnosticCode.EmptyKey, "Error", "This assignment has no property name.")) ];
    }

    const property: PropertySchema | undefined = FindProperty(schema, entry.Key);
    if (property === undefined)
    {
        return [ CheckUnknownKey(entry, schema, catalog) ];
    }

    const diagnostics: Array<Diagnostic> = [];
    const first: number | undefined = seen.get(entry.Key);
    if (first === undefined)
    {
        seen.set(entry.Key, entry.Line);
    }
    else if (!property.Repeatable)
    {
        diagnostics.push(MakeDiagnostic(entry.KeySpan, Problem(
            DiagnosticCode.DuplicateProperty,
            "Warning",
            `${Code(entry.Key)} is already set on line ${first + 1}.`), entry.Key));
    }

    const problem: ValueProblem | undefined = CheckValue(property, entry.Value);
    if (problem !== undefined)
    {
        const span: TextSpan = entry.Value === ""
            ? MakeSpan(entry.Line, entry.Separator, entry.Separator + 1)
            : entry.ValueSpan;

        diagnostics.push(MakeDiagnostic(span, problem, entry.Key));
    }

    return diagnostics;
}

/**
 * Finds every problem in a document under the given schema.
 *
 * When a catalog is given, keys that other releases support are reported as unsupported in this
 * release rather than as unknown.  Disabled assignments in comments are not checked.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Validate(
    document: ParsedDocument,
    schema: ServerPropertiesSchema,
    catalog?: SchemaCatalog): Array<Diagnostic>
{
    const diagnostics: Array<Diagnostic> = [];
    const seen: Map<string, number> = new Map<string, number>();
    for (const line of document.Lines)
    {
        if (line.Kind === "Invalid")
        {
            diagnostics.push(MakeDiagnostic(line.Span, Problem(
                DiagnosticCode.InvalidLine,
                "Error",
                `Expected ${Code("key=value")} or a comment starting with ${Code("#")}.`)));
        }
        else if (line.Kind === "Entry")
        {
            diagnostics.push(...CheckEntry(line, schema, catalog, seen));
        }
    }

    return diagnostics;
}

/**
 * Escapes text for a literal part of a TextMate snippet; inside a choice, `,` and `|` are escaped too.
 */
function EscapeSnippet(text: string, choice: boolean): string
{
    return text.replace(choice ? /[$}\\,|]/gu : /[$}\\]/gu, "\\$&");
}

/**
 * The values to propose for a property: its fixed words, keywords and default.
 */
function ProposedValues(property: PropertySchema): Array<string>
{
    const values: Array<string> = [];
    switch (property.Type.Kind)
    {
        case "Boolean":
            values.push("true", "false");
            break;
        case "Enum":
            values.push(...property.Type.Values);
            break;
        case "Number":
            values.push(...property.Type.Keywords ?? []);
            break;
        case "String":
            break;
    }

    if (property.Default !== undefined && property.Default !== "" && !values.includes(property.Default))
    {
        values.push(property.Default);
    }

    return values;
}

/**
 * The snippet for the value part of a new `key=value` line: a choice of fixed values with the
 * default first, or a placeholder holding the default.
 */
function ValueSnippet(property: PropertySchema): string
{
    const values: Array<string> = ProposedValues(property);
    if (property.Type.Kind === "Boolean" || property.Type.Kind === "Enum")
    {
        const fallback: string | undefined = property.Default;
        const ordered: Array<string> = fallback !== undefined && values.includes(fallback)
            ? [ fallback, ...values.filter((value: string) => value !== fallback) ]
            : values;

        return `\${1|${ordered.map((value: string) => EscapeSnippet(value, true)).join(",")}|}`;
    }

    return `\${1:${EscapeSnippet(property.Default ?? "", false)}}`;
}

/**
 * Pads an index so that proposals sort in schema order.
 */
function SortText(index: number): string
{
    return index.toString().padStart(4, "0");
}

/**
 * Formats a property's documentation as Markdown, as used by hovers and completion details.
 *
 * The description keeps the line breaks of the default file.  With a catalog, the releases that
 * define the property are listed when they are not all of them.
 *
 * @category Functions
 * @since 1.0.0
 */
export function PropertyMarkdown(property: PropertySchema, catalog?: SchemaCatalog): string
{
    const sections: Array<string> = [ `**${Code(property.Key)}**` ];
    if (property.Description !== "")
    {
        sections.push(property.Description.split("\n").join("  \n"));
    }

    if (property.AllowedValues !== undefined)
    {
        sections.push(`**Allowed values:** ${property.AllowedValues}`);
    }

    if (property.Default !== undefined && property.Default !== "")
    {
        sections.push(`**Default:** ${Code(property.Default)}`);
    }

    if (catalog !== undefined)
    {
        const history: ReadonlyArray<VersionRange> = PropertyHistory(catalog, property.Key);
        const everywhere: boolean = history.length === 1 && history[0].Until === undefined &&
            Version.Equals(history[0].From, catalog.Oldest.Version);

        if (history.length > 0 && !everywhere)
        {
            sections.push(`*Available in BDS ${FormatHistory(history)}.*`);
        }
    }

    return sections.join("\n\n");
}

/**
 * Proposes property names for the key part of a line.
 */
function CompleteKey(
    document: ParsedDocument,
    line: ParsedLine,
    character: number,
    schema: ServerPropertiesSchema): CompletionResult | undefined
{
    let span: TextSpan = MakeSpan(line.Line, character, character);
    if (line.Kind === "Entry")
    {
        span = line.KeySpan;
    }
    else if (line.Kind === "Invalid")
    {
        span = line.Span;
    }

    const hasSeparator: boolean = line.Kind === "Entry";
    const taken: Set<string> = new Set<string>(document.Entries
        .filter((entry: EntryLine) => entry.Line !== line.Line)
        .map((entry: EntryLine) => entry.Key));

    const items: Array<CompletionItem> = [];
    schema.Properties.forEach((property: PropertySchema, index: number) =>
    {
        if (taken.has(property.Key) && !property.Repeatable)
        {
            return;
        }

        items.push({
            ...property.Default === undefined || property.Default === ""
                ? {}
                : { Detail: `Default: ${property.Default}` },
            Documentation: PropertyMarkdown(property),
            InsertText: hasSeparator
                ? property.Key
                : `${EscapeSnippet(property.Key, false)}=${ValueSnippet(property)}`,
            IsSnippet: !hasSeparator,
            Kind: "Property",
            Label: property.Key,
            SortText: SortText(index)
        });
    });

    return items.length === 0
        ? undefined
        : {
            Items: items,
            Span: span
        };
}

/**
 * Proposes values for the value part of an assignment.
 */
function CompleteValue(line: EntryLine, schema: ServerPropertiesSchema): CompletionResult | undefined
{
    const property: PropertySchema | undefined = FindProperty(schema, line.Key);
    if (property === undefined)
    {
        return undefined;
    }

    const items: Array<CompletionItem> = ProposedValues(property).map(
        (value: string, index: number): CompletionItem => ({
            ...value === property.Default ? { Detail: "Default" } : {},
            InsertText: value,
            IsSnippet: false,
            Kind: "Value",
            Label: value,
            SortText: SortText(index)
        }));

    const span: TextSpan = line.Value === ""
        ? MakeSpan(line.Line, line.Separator + 1, line.Text.length)
        : line.ValueSpan;

    return items.length === 0
        ? undefined
        : {
            Items: items,
            Span: span
        };
}

/**
 * Proposes property names at the start of a line and values after `=`, or yields `undefined` where
 * nothing applies, such as inside a comment or after the `=` of an unknown property.
 *
 * Properties already set on other lines are not proposed again unless they are repeatable.  On a
 * line without `=`, a proposal inserts a whole `key=value` snippet whose value starts as the default.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Complete(
    document: ParsedDocument,
    position: Position,
    schema: ServerPropertiesSchema): CompletionResult | undefined
{
    const line: ParsedLine | undefined = document.Lines[position.Line];
    if (line === undefined || line.Kind === "Comment")
    {
        return undefined;
    }

    if (line.Kind === "Entry" && position.Character > line.Separator)
    {
        return CompleteValue(line, schema);
    }

    return CompleteKey(document, line, position.Character, schema);
}

/**
 * Whether a character offset falls within a non-empty span or touches its end.
 */
function Touches(span: TextSpan, character: number): boolean
{
    return character >= span.Start && character <= span.End && span.Start !== span.End;
}

/**
 * Finds the assignment on a line, including a disabled one in a comment.
 */
function AssignmentOn(line: ParsedLine | undefined): Assignment | undefined
{
    if (line?.Kind === "Entry")
    {
        return line;
    }

    return line?.Kind === "Comment" ? line.Assignment : undefined;
}

/**
 * Describes the property under the cursor, in an assignment or in a disabled assignment in a comment.
 *
 * A key that the schema lacks but other releases in the catalog define is described as unsupported
 * in this release.  Anything else yields `undefined`.
 *
 * @category Functions
 * @since 1.0.0
 */
export function Hover(
    document: ParsedDocument,
    position: Position,
    schema: ServerPropertiesSchema,
    catalog?: SchemaCatalog): HoverResult | undefined
{
    const assignment: Assignment | undefined = AssignmentOn(document.Lines[position.Line]);
    if (assignment === undefined)
    {
        return undefined;
    }

    const character: number = position.Character;
    if (!Touches(assignment.KeySpan, character) && !Touches(assignment.ValueSpan, character))
    {
        return undefined;
    }

    const property: PropertySchema | undefined = FindProperty(schema, assignment.Key);
    if (property !== undefined)
    {
        return {
            Markdown: PropertyMarkdown(property, catalog),
            Span: assignment.KeySpan
        };
    }

    const history: ReadonlyArray<VersionRange> =
        catalog === undefined ? [] : PropertyHistory(catalog, assignment.Key);

    if (history.length === 0)
    {
        return undefined;
    }

    return {
        Markdown: `**${Code(assignment.Key)}**\n\n` +
            `Not supported by BDS ${Version.Format(schema.Version)}; ` +
            `available in ${FormatHistory(history)}.`,
        Span: assignment.KeySpan
    };
}
