/**
 * Generates configuration declarations and editor schema from upstream Effect metadata.
 *
 * @module bedform/Tool/config-generate
 *
 * @file      config-generate.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Schema templates retain contextual inference and generated layout. */
/* eslint-disable sort-imports, @stylistic/max-len, @typescript-eslint/typedef */

import { ESLint } from "eslint";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import * as Schema from "effect/Schema";
import type { JsonSchema } from "effect/JsonSchema";
import { BedformConfigSchema, BedformJsonConfigSchema } from "../Source/ConfigSchema.js";

const PackageVersion = (JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
// Symbol-level @since tags carry only the release core; prerelease and build suffixes are disallowed.
const VersionCore = /^(?<core>\d+\.\d+\.\d+)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.exec(PackageVersion)?.groups?.core;
if (!VersionCore)
{
    throw new Error(`package.json version is not valid semver: ${PackageVersion}`);
}

const Version = VersionCore;
const TaggedSince = /@since\s+\d+\.\d+\.\d+[-+]\S*/u;
const Check = process.argv.includes("--check");
const Publication = JSON.parse(await readFile(new URL("config-schema-publication.json", import.meta.url), "utf8")) as Record<string, string>;

/**
 * Formats documentation directly from schema descriptions.
 *
 * @category Tooling
 * @since 1.0.0
 */
const doc = (description: unknown, fallback: string): string =>
{
    return `/**\n * ${String(description ?? fallback).replaceAll("*/", "* / ")}\n *\n * @category Configuration\n * @since ${Version}\n */\n`;
};

/**
 * Indents generated namespace members without changing their documentation.
 *
 * @category Tooling
 * @since 1.0.0
 */
const indent = (value: string): string =>
{
    return value.split("\n").map((line) => line ? `    ${line}` : line).join("\n");
};

/**
 * Extracts every object shape into a documented interface and matching namespace.
 * Unsupported schema forms fail generation instead of weakening public types.
 *
 * @category Tooling
 * @since 1.0.0
 */
const declaration = (name: string, node: JsonSchema, owner: string): string =>
{
    const Children: Array<string> = [];
    const Qualified = `${owner}.${name}`;
    const Type = (value: JsonSchema | boolean, member: string): string =>
    {
        if (value === false)
        {
            return "never";
        }

        if (value === true)

        {

            throw new Error("Unconstrained configuration schema");

        }

        if (value.$ref)

        {

            return `BedformConfig.${String(value.$ref).split("/").at(-1)}`;

        }

        if (value.not)

        {

            return "never";

        }

        if (value.enum)

        {

            return (value.enum as Array<unknown>).map((item) => JSON.stringify(item)).join(" | ");

        }

        if (value.anyOf)

        {

            return (value.anyOf as Array<JsonSchema>).map((item, index) => Type(item, `${member}Variant${index + 1}`)).join(" | ");

        }

        if (value.type === "array")

        {

            return `ReadonlyArray<${Type(value.items as JsonSchema, member)}>`;

        }

        if (value.type === "object")
        {
            Children.push(declaration(member, value, Qualified));
            return `${name}.${member}`;
        }

        if (value.type === "integer")
        {
            return "number";
        }

        if ([ "boolean", "string", "number" ].includes(String(value.type)))

        {

            return String(value.type);

        }

        throw new Error(`Unsupported configuration schema: ${JSON.stringify(value)}`);
    };

    let Body: string;
    if (node.type === "object")
    {
        const Required = new Set(node.required as Array<string> | undefined);
        const Properties = Object.entries((node.properties ?? {}) as Record<string, JsonSchema>);
        const Fields = Properties.map(([ key, value ]) =>
        {
            const Member = key[0].toUpperCase() + key.slice(1);
            const Value = Type(value, Member);
            return indent(`${doc(value.description ?? InputDocument.definitions[String(value.$ref).split("/").at(-1) ?? ""]?.description, `${Member} configuration value.`)}readonly ${key}${Required.has(key) ? "" : "?"}: ${Value};`);
        });
        if (node.additionalProperties && typeof node.additionalProperties === "object")
        {
            Fields.push(indent(`readonly [key: string]: ${Type(node.additionalProperties as JsonSchema, "Value")};`));
        }

        Body = `${doc(node.description, `${name} configuration settings.`)}${name === "DDUI" ? "// eslint-disable-next-line @typescript-eslint/naming-convention -- Public DDUI section name.\n" : ""}export interface ${name}\n{\n${Fields.join("\n")}\n}`;
    }
    else
    {
        Body = `${doc(node.description, `${name} configuration alternatives.`)}export type ${name} = ${Type(node, "Member")};`;
    }

    const Namespace = Children.length ? `export namespace ${name}\n{\n${indent(Children.join("\n\n"))}\n}\n\n` : "";
    return Namespace + Body;
};

const InputDocument = Schema.toJsonSchemaDocument(BedformConfigSchema, { onExcessProperty: "error" });
const JsonDocument = Schema.toJsonSchemaDocument(BedformJsonConfigSchema, { onExcessProperty: "error" });
const Definitions = Object.entries(InputDocument.definitions).map(([ name, node ]) => declaration(name, node, "BedformConfig"));
const Root = declaration("Input", InputDocument.schema, "BedformConfig");
const Source = `/**
 * Host-only project configuration.
 *
 * This module is auto-generated by Tool/config-generate.mts; edit Source/ConfigSchema.ts.
 *
 * @module bedform/Config
 *
 * @file      Config.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

import * as Schema from "effect/Schema";
import { BedformConfigSchema } from "./ConfigSchema.js";

${doc("Registry identity for constructed project configurations.", "")}export const TypeId: unique symbol = Symbol.for("~bedform/Config");

${doc("Version-pinned raw JSON Schema URL for generated JSON configuration files.", "")}export const JsonSchemaUrl = ${JSON.stringify(Publication.rawUrl)} as const;

export namespace BedformConfig
{
${indent([ ...Definitions, Root ].join("\n\n"))}
}

${doc("Validated project settings with a non-enumerable configuration brand.", "")}export interface BedformConfig extends BedformConfig.Input
{
    readonly [TypeId]: typeof TypeId;
}

/**
 * Validates and copies project settings, defaulting DDUI strict mode and production development-module permission to false.
 * The registry brand is non-enumerable and is omitted from JSON serialization.
 *
 * @throws { Error } Configuration does not satisfy the project schema.
 *
 * @category Configuration
 * @since ${Version}
 */
export const BedformConfig = (input: BedformConfig.Input): BedformConfig =>
{
    const Value = Schema.decodeUnknownSync(BedformConfigSchema, { onExcessProperty: "error" })(input);
    const Result = { ...Value, DDUI: { StrictMode: false, ...Value.DDUI },
        Development: { AllowDevelopmentModulesInProduction: false, ...Value.Development } };
    Object.defineProperty(Result, TypeId, { enumerable: false, value: TypeId });
    return Result as BedformConfig;
};

/**
 * Generates validated JSON with defaults and the published editor schema hint.
 * The constructor brand is excluded from the serialized document.
 *
 * @throws { Error } Configuration does not satisfy the project schema.
 *
 * @category Configuration
 * @since ${Version}
 */
export const stringifyConfig = (input: BedformConfig.Input): string =>
{
    return JSON.stringify({ $schema: JsonSchemaUrl, ...BedformConfig(input) }, null, 2) + "\\n";
};
`;
const Json = `${JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema",
    ...JsonDocument.schema,
    $defs: JsonDocument.definitions }, null, 2)}\n`;
// Format declarations before applying the generated module's file-wide lint exemption.
const FormattingSource = Source.replace("/* eslint-disable */", `/* eslint-disable @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */`);
const [ Formatted ] = await new ESLint({ fix: true }).lintText(FormattingSource, { filePath: fileURLToPath(new URL("../Source/Config.ts", import.meta.url)) });
if (Formatted.errorCount)
{
    throw new Error(JSON.stringify(Formatted.messages));
}

const FormattedSource = Formatted.output ?? FormattingSource;
const GeneratedSource = Source.slice(0, Source.indexOf("/* eslint-disable */")) + "/* eslint-disable */\n\n" +
    FormattedSource.slice(FormattedSource.indexOf("import * as Schema"));

for (const [ Path, Content ] of [ [ "../Source/Config.ts", GeneratedSource ], [ "../bedform.config.schema.json", Json ] ])
{
    const Url = new URL(Path, import.meta.url);
    if (Check)
    {
        const Existing = await readFile(Url, "utf8");
        const Tagged = TaggedSince.exec(Existing);
        if (Tagged)
        {
            throw new Error(`Generated configuration artifact ${Path} has a prerelease or build tag in "${Tagged[0]}"; ` +
                `@since must name only the release version ${Version}.`);
        }

        if (Existing !== Content)
        {
            throw new Error(`Stale generated configuration artifact: ${Path}`);
        }
    }
    else {await writeFile(Url, Content);}
}
