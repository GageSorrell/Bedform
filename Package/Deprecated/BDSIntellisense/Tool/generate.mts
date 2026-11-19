/**
 * Generates `Source/Schema/Generated/Schemas.generated.ts` from the default files in `Data/Pristine`.
 *
 * Each default file is split into properties.  A property starts at an assignment, or at a disabled
 * `# key=value` assignment that begins a blank-separated block, and takes the comment lines after
 * it.  Its type comes from the `Allowed values` comment by the rules in {@link TypeRules}, or, without
 * one, from its default value.  The corrections in `overrides.mts` are then applied.
 *
 * Consecutive releases with identical schemas are merged.  Each schema is keyed by its first
 * release's three-part version, such as `1.26.60`, so that a server detected only from its
 * `vanilla_1.26.60` pack folder still receives that release's schema.
 *
 * The run fails, writing nothing, when an `Allowed values` text matches no rule and no override
 * supplies a type, or when a release's own default file has diagnostics under the schema read from
 * it.  A shipped default value is always accepted, even when the comment's list of values omits it.
 *
 * `--report` also lists each property of the latest schema with its type.  `--check` writes nothing
 * and fails when the tracked module differs from what would be generated.
 *
 * Usage: `npm run generate --workspace bds-intellisense [-- --report | --check]`
 *
 * @module bds-intellisense/Tool/generate
 *
 * @file      generate.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import * as Version from "../Source/Version.ts";
import type { EntryLine, ParsedLine } from "../Source/Parser.ts";
import { Overrides, type PropertyOverride } from "./overrides.mts";
import type { PropertySchema, PropertyType, ServerPropertiesSchema } from "../Source/Schema/Types.ts";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { ParseDocument } from "../Source/Parser.ts";
import { Validate } from "../Source/Analysis.ts";
import process from "node:process";

/**
 * A rule that types a property from its `Allowed values` text.
 *
 * @category Tools
 * @since 1.0.0
 */
export interface TypeRule
{
    readonly Pattern: RegExp;
    readonly Type: (match: RegExpExecArray) => PropertyType;
}

/**
 * A property as read from one default file, before typing.
 */
interface RawProperty
{
    readonly Comments: Array<string>;
    readonly Default: string;
    readonly Key: string;
    readonly Optional: boolean;
}

/**
 * A default file and the release it came from.
 */
interface Pristine
{
    readonly Name: string;
    readonly Text: string;
    readonly Version: Version.BdsVersion;
}

/**
 * A property's `Allowed values` text and the comment lines that describe it.
 */
interface AllowedSplit
{
    readonly Allowed?: string;
    readonly Description: Array<string>;
}

/**
 * A run of consecutive releases with the same property definitions.
 */
interface Run
{
    readonly First: Version.BdsVersion;
    readonly Indices: ReadonlyArray<number>;
    readonly Key: string;
}

/**
 * A schema to emit: its definition indices and the version it is keyed by.
 */
interface EmittedSchema
{
    readonly Indices: ReadonlyArray<number>;
    readonly Version: Version.BdsVersion;
}

/** The folder holding this package's `package.json`. */
const PackageRoot: string = Path.resolve(import.meta.dirname, "..");

/** Where the default files are read from. */
const PristineDirectory: string = Path.join(PackageRoot, "Data", "Pristine");

/** The module this tool writes. */
const OutputPath: string = Path.join(PackageRoot, "Source", "Schema", "Generated", "Schemas.generated.ts");

/** Characters that `level-name` forbids: `;` and those illegal in file names. */
const FileNameForbidden: string = ";/`?*\\<>|\":";

/** A permissive IPv4 or IPv6 literal, or nothing. */
const AddressPattern: string = "(?:\\d{1,3}(?:\\.\\d{1,3}){3}|[0-9A-Fa-f]*:[0-9A-Fa-f:.]*)?";

/**
 * An integer type with optional bounds and keywords.
 */
function IntegerType(minimum?: number, maximum?: number, keywords?: ReadonlyArray<string>): PropertyType
{
    return {
        Integer: true,
        ...keywords === undefined ? {} : { Keywords: keywords },
        Kind: "Number",
        ...maximum === undefined ? {} : { Maximum: maximum },
        ...minimum === undefined ? {} : { Minimum: minimum }
    };
}

/**
 * A decimal type with bounds and optional keywords.
 */
function DecimalType(minimum: number, maximum: number, keywords?: ReadonlyArray<string>): PropertyType
{
    return {
        Integer: false,
        ...keywords === undefined ? {} : { Keywords: keywords },
        Kind: "Number",
        Maximum: maximum,
        Minimum: minimum
    };
}

/**
 * The rules that type `Allowed values` texts, tried in order against the text without a final period.
 *
 * @category Tools
 * @since 1.0.0
 */
export const TypeRules: ReadonlyArray<TypeRule> = [
    {
        Pattern: /^(?:"true" or "false"|true, false)$/u,
        Type: () => ({ Kind: "Boolean" })
    },
    {
        Pattern: /^Integers in the range \[(\d+), (\d+)\]$/u,
        Type: (match: RegExpExecArray) => IntegerType(Number(match[1]), Number(match[2]))
    },
    {
        Pattern: /^(\d+)-(\d+)$/u,
        Type: (match: RegExpExecArray) => IntegerType(Number(match[1]), Number(match[2]))
    },
    {
        Pattern: /^Any positive integer$/u,
        Type: () => IntegerType(1)
    },
    {
        Pattern: /^Any positive integer, or 0 to .+$/u,
        Type: () => IntegerType(0)
    },
    {
        Pattern: /^Any non-negative integer$/u,
        Type: () => IntegerType(0)
    },
    {
        Pattern: /^Positive integer equal to (\d+) or greater$/u,
        Type: (match: RegExpExecArray) => IntegerType(Number(match[1]))
    },
    {
        Pattern: /^A positive integer no greater than (\d+), or "(\w+)"$/u,
        Type: (match: RegExpExecArray) => IntegerType(1, Number(match[1]), [ match[2] ])
    },
    {
        Pattern: /^"(\w+)" or any value in range \[([\d.]+), ([\d.]+)\]$/u,
        Type: (match: RegExpExecArray) => DecimalType(Number(match[2]), Number(match[3]), [ match[1] ])
    },
    {
        Pattern: /^Any value in the range of \[([\d.]+), ([\d.]+)\]/u,
        Type: (match: RegExpExecArray) => DecimalType(Number(match[1]), Number(match[2]))
    },
    {
        Pattern: /^Any string without semicolon symbol or symbols illegal for file name/u,
        Type: () => ({
            Forbidden: FileNameForbidden,
            Kind: "String"
        })
    },
    {
        Pattern: /^Any string without semicolon symbol$/u,
        Type: () => ({
            Forbidden: ";",
            Kind: "String"
        })
    },
    {
        Pattern: /^Any string$/u,
        Type: () => ({ Kind: "String" })
    },
    {
        Pattern: /^An IPv4 or IPv6 literal, or empty$/u,
        Type: () => ({
            Kind: "String",
            Pattern: AddressPattern,
            PatternDescription: "an IPv4 or IPv6 literal, or empty"
        })
    },
    {
        Pattern: /^"[^"]+"(?:(?:\s*,\s*|\s+or\s+|\s*,\s*or\s+)"[^"]+")*$/u,
        Type: (match: RegExpExecArray) =>
        {
            const values: Array<string> = [ ...match[0].matchAll(/"([^"]+)"/gu) ].map(
                (value: RegExpExecArray) => value[1]);

            return values.length === 2 && values.includes("true") && values.includes("false")
                ? { Kind: "Boolean" }
                : {
                    Kind: "Enum",
                    Values: values
                };
        }
    }
];

/**
 * Writes a line of progress.
 */
function Log(message: string): void
{
    process.stdout.write(`${message}\n`);
}

/**
 * Splits a default file into its properties.
 *
 * @throws { Error } When the file has a line that is neither blank, a comment nor an assignment.
 */
function ReadProperties(text: string, name: string): Array<RawProperty>
{
    const properties: Array<RawProperty> = [];
    let current: RawProperty | undefined = undefined;
    let blockStart: boolean = true;
    for (const line of ParseDocument(text).Lines as ReadonlyArray<ParsedLine>)
    {
        switch (line.Kind)
        {
            case "Blank":
                current = undefined;
                break;
            case "Entry":
                current = {
                    Comments: [],
                    Default: (line as EntryLine).Value,
                    Key: line.Key,
                    Optional: false
                };
                properties.push(current);
                break;
            case "Comment":
                if (blockStart && line.Assignment !== undefined)
                {
                    current = {
                        Comments: [],
                        Default: line.Assignment.Value,
                        Key: line.Assignment.Key,
                        Optional: true
                    };
                    properties.push(current);
                }
                else
                {
                    current?.Comments.push(line.Body.trimEnd());
                }

                break;
            case "Invalid":
                throw new Error(`${name}:${line.Line + 1} is not a property, comment or blank line.`);
        }

        blockStart = line.Kind === "Blank";
    }

    return properties;
}

/**
 * Separates the `Allowed values` text from the description.  Text that breaks off mid-sentence
 * continues on the following lines while they start in lower case.
 */
function SplitAllowedValues(comments: ReadonlyArray<string>): AllowedSplit
{
    const index: number = comments.findIndex((comment: string) => /^\s*Allowed values:/iu.test(comment));
    if (index < 0)
    {
        return { Description: [ ...comments ] };
    }

    let allowed: string = comments[index].replace(/^\s*Allowed values:\s*/iu, "").trim();
    let end: number = index + 1;
    while (allowed !== "" && !/[.")\]]$/u.test(allowed) && /^\s*[a-z]/u.test(comments[end] ?? ""))
    {
        allowed = `${allowed} ${comments[end].trim()}`;
        end++;
    }

    const description: Array<string> = [ ...comments.slice(0, index), ...comments.slice(end) ];
    return allowed === ""
        ? { Description: [ ...comments.slice(0, index), ...comments.slice(index + 1) ] }
        : {
            Allowed: allowed,
            Description: description
        };
}

/**
 * Types a property from its `Allowed values` text, or yields `undefined` when no rule matches.
 */
function TypeFromAllowed(allowed: string): PropertyType | undefined
{
    const text: string = allowed.replace(/\.$/u, "");
    for (const rule of TypeRules)
    {
        const match: RegExpExecArray | null = rule.Pattern.exec(text);
        if (match !== null)
        {
            return rule.Type(match);
        }
    }

    return undefined;
}

/**
 * Types a property from its default value alone.  Numeric defaults in the shipped files are all
 * counts, durations, sizes or thresholds, so numbers are taken to be non-negative.
 */
function TypeFromDefault(value: string): PropertyType
{
    if (value === "true" || value === "false")
    {
        return { Kind: "Boolean" };
    }

    if (/^\d+$/u.test(value))
    {
        return IntegerType(0);
    }

    return /^\d*\.\d+$/u.test(value)
        ? {
            Integer: false,
            Kind: "Number",
            Minimum: 0
        }
        : { Kind: "String" };
}

/**
 * Picks the last override that sets a field, since later overrides take precedence.
 */
function LastSetting<K extends keyof PropertyOverride>(
    overrides: ReadonlyArray<PropertyOverride>,
    field: K): PropertyOverride[K] | undefined
{
    for (let index: number = overrides.length - 1; index >= 0; index--)
    {
        if (overrides[index][field] !== undefined)
        {
            return overrides[index][field];
        }
    }

    return undefined;
}

/**
 * Finds the overrides that apply to a property in a release.
 */
function OverridesFor(key: string, version: Version.BdsVersion): Array<PropertyOverride>
{
    return Overrides.filter((override: PropertyOverride) => override.Key === key &&
        (override.From === undefined || Version.Compare(version, override.From) >= 0) &&
        (override.Until === undefined || Version.Compare(version, override.Until) < 0));
}

/**
 * Types and documents one property of a release.
 *
 * @throws { Error } When its `Allowed values` text matches no rule and no override supplies a type.
 */
function BuildProperty(raw: RawProperty, release: Pristine): PropertySchema
{
    const { Allowed, Description } = SplitAllowedValues(raw.Comments);
    const overrides: Array<PropertyOverride> = OverridesFor(raw.Key, release.Version);
    const overriddenType: PropertyType | undefined = LastSetting(overrides, "Type");

    let type: PropertyType | undefined = overriddenType ??
        (Allowed === undefined ? TypeFromDefault(raw.Default) : TypeFromAllowed(Allowed));

    if (type === undefined)
    {
        throw new Error(`${release.Name}: no rule types ${raw.Key}, whose allowed values are "${Allowed}".`);
    }

    // The server accepts the value it ships with, even when the comment's list omits it.
    if (type.Kind === "Enum" && raw.Default !== "" && !type.Values.includes(raw.Default))
    {
        type = {
            ...type,
            Values: [ ...type.Values, raw.Default ]
        };
    }

    type = Object.freeze(type);
    const allowedValues: string | undefined = LastSetting(overrides, "AllowedValues") ?? Allowed;

    const repeatable: boolean =
        LastSetting(overrides, "Repeatable") ??
        raw.Comments.some((comment: string) => /more than one line/iu.test(comment));

    while (Description.length > 0 && Description[Description.length - 1].trim() === "")
    {
        Description.pop();
    }

    return {
        ...allowedValues === undefined ? {} : { AllowedValues: allowedValues },
        ...raw.Default === "" ? {} : { Default: raw.Default },
        Description: Description.join("\n"),
        Key: raw.Key,
        Optional: raw.Optional,
        Repeatable: repeatable,
        Type: type
    };
}

/**
 * Reads every default file, oldest first.
 */
async function ReadPristine(): Promise<Array<Pristine>>
{
    const files: Array<Pristine> = [];
    for (const name of await readdir(PristineDirectory))
    {
        const version: Version.BdsVersion | undefined = Version.Parse(name.replace(/\.properties$/u, ""));
        if (version !== undefined && name.endsWith(".properties"))
        {
            files.push({
                Name: name,
                Text: await readFile(Path.join(PristineDirectory, name), "utf8"),
                Version: version
            });
        }
    }

    return files.sort((left: Pristine, right: Pristine) => Version.Compare(left.Version, right.Version));
}

/**
 * Serializes a value as JSON with object keys sorted, so that output is stable.
 */
function Stable(value: unknown): string
{
    if (Array.isArray(value))
    {
        return `[ ${value.map(Stable).join(", ")} ]`;
    }

    if (typeof value === "object" && value !== null)
    {
        const entries: Array<string> = Object.keys(value).sort().map((key: string) =>
            `${JSON.stringify(key)}: ${Stable((value as Record<string, unknown>)[key])}`);

        return `{ ${entries.join(", ")} }`;
    }

    return JSON.stringify(value);
}

/**
 * Picks the version each schema is keyed by: three parts, or four when two schemas begin in the
 * same three-part release.
 */
function SchemaVersions(firsts: ReadonlyArray<Version.BdsVersion>): Array<Version.BdsVersion>
{
    const short: Array<string> = firsts.map((version: Version.BdsVersion) =>
        Version.Format(version.slice(0, 3)));

    return firsts.map((version: Version.BdsVersion, index: number) =>
        short.indexOf(short[index]) === short.lastIndexOf(short[index]) ? version.slice(0, 3) : version);
}

/**
 * Builds the source of the generated module.
 */
function Render(
    definitions: ReadonlyArray<string>,
    schemas: ReadonlyArray<EmittedSchema>,
    oldest: Version.BdsVersion,
    latest: Version.BdsVersion): string
{
    const lines: Array<string> = [
        "/**",
        ` * Bundled \`server.properties\` schemas for BDS ${Version.Format(oldest)} through ` +
            `${Version.Format(latest)},`,
        " * read from the default file of each release.",
        " *",
        " * This module is auto-generated by Tool/generate.mts.",
        " *",
        " * @module bds-intellisense/Schema/Generated/Schemas.generated",
        " *",
        " * @file      Schemas.generated.ts",
        " * @author    Gage Sorrell <gage@sorrell.sh>",
        " * @copyright (c) 2026 Gage Sorrell",
        " * @license   MIT",
        " */",
        "",
        "/* eslint-disable */",
        "",
        "import type { BdsVersion } from \"../../Version.js\";",
        "import type { PropertySchema, ServerPropertiesSchema } from \"../Types.js\";",
        "",
        "/** Every distinct property definition, shared by the schemas that agree on it. */",
        "const Definitions: ReadonlyArray<PropertySchema> = [",
        definitions.map((definition: string) => `    ${definition}`).join(",\n"),
        "];",
        "",
        "/** Selects definitions by index. */",
        "function Pick(indices: ReadonlyArray<number>): ReadonlyArray<PropertySchema>",
        "{",
        "    return indices.map((index: number) => Definitions[index]);",
        "}",
        "",
        "/**",
        " * The first and last releases the schemas were read from.",
        " *",
        " * @category Constants",
        " * @since 1.0.0",
        " */",
        "export const BundledReleases: Readonly<Record<\"Latest\" | \"Oldest\", BdsVersion>> = {",
        `    Latest: ${Stable(latest)},`,
        `    Oldest: ${Stable(oldest)}`,
        "};",
        "",
        "/**",
        " * One schema per run of consecutive releases whose default files agree, oldest first.",
        " *",
        " * @category Constants",
        " * @since 1.0.0",
        " */",
        "export const GeneratedSchemas: ReadonlyArray<ServerPropertiesSchema> = [",
        schemas.map((schema: EmittedSchema) =>
            `    { Properties: Pick(${Stable(schema.Indices)}), Version: ${Stable(schema.Version)} }`)
            .join(",\n"),
        "];",
        ""
    ];

    return lines.join("\n");
}

/**
 * Describes a type briefly for the report.
 */
function DescribeType(type: PropertyType): string
{
    switch (type.Kind)
    {
        case "Boolean":
            return "Boolean";
        case "Enum":
            return `Enum ${type.Values.join("|")}`;
        case "Number":
            return `${type.Integer ? "Integer" : "Decimal"} [${type.Minimum ?? ""}, ${type.Maximum ?? ""}]` +
                (type.Keywords === undefined ? "" : ` or ${type.Keywords.join("|")}`);
        case "String":
            return `String${type.Forbidden === undefined ? "" : ` without ${type.Forbidden}`}` +
                (type.Pattern === undefined ? "" : " matching a pattern");
    }
}

/**
 * Generates the module and reports the schemas.
 */
async function Main(): Promise<void>
{
    const releases: Array<Pristine> = await ReadPristine();
    if (releases.length === 0)
    {
        throw new Error("Data/Pristine holds no default files; run `npm run fetch` first.");
    }

    const definitions: Array<string> = [];
    const runs: Array<Run> = [];
    const problems: Array<string> = [];
    let latestProperties: Array<PropertySchema> = [];
    for (const release of releases)
    {
        const properties: Array<PropertySchema> = ReadProperties(release.Text, release.Name)
            .map((raw: RawProperty) => BuildProperty(raw, release));

        // A release's own default file must be valid under the schema read from it.
        const schema: ServerPropertiesSchema = {
            Properties: properties,
            Version: release.Version
        };

        for (const diagnostic of Validate(ParseDocument(release.Text), schema))
        {
            problems.push(`${release.Name}:${diagnostic.Span.Line + 1}: ${diagnostic.Message}`);
        }

        const indices: Array<number> = properties.map((property: PropertySchema) =>
        {
            const text: string = Stable(property);
            const found: number = definitions.indexOf(text);
            return found >= 0 ? found : definitions.push(text) - 1;
        });

        const key: string = indices.join(",");
        if (runs.length === 0 || runs[runs.length - 1].Key !== key)
        {
            runs.push({
                First: release.Version,
                Indices: indices,
                Key: key
            });
        }

        latestProperties = properties;
    }

    if (problems.length > 0)
    {
        throw new Error(`Default files are invalid under their own schemas:\n  ${problems.join("\n  ")}`);
    }

    const versions: Array<Version.BdsVersion> = SchemaVersions(runs.map((run: Run) => run.First));

    const source: string = Render(
        definitions,
        runs.map((run: Run, index: number): EmittedSchema => ({
            Indices: run.Indices,
            Version: versions[index]
        })),
        releases[0].Version,
        releases[releases.length - 1].Version);

    if (process.argv.includes("--check"))
    {
        const current: string = await readFile(OutputPath, "utf8").catch(() => "");
        if (current !== source)
        {
            Log("Schemas.generated.ts is out of date; run `npm run generate`.");
            process.exitCode = 1;
            return;
        }

        Log("Schemas.generated.ts is up to date.");
        return;
    }

    await mkdir(Path.dirname(OutputPath), { recursive: true });
    await writeFile(OutputPath, source);
    Log(`Read ${releases.length} releases into ${runs.length} schemas of ${definitions.length} definitions.`);
    Log(`Schemas: ${versions.map((version: Version.BdsVersion) => Version.Format(version)).join(" ")}`);

    if (process.argv.includes("--report"))
    {
        for (const property of latestProperties)
        {
            Log(`  ${property.Key}${property.Optional ? " (optional)" : ""}` +
                `${property.Repeatable ? " (repeatable)" : ""}: ${DescribeType(property.Type)}`);
        }
    }
}

await Main();
