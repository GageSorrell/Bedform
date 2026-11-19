/**
 * Helpers for normalizing and converting JSON Schema and OpenAPI schema
 * documents. Supported inputs include JSON Schema Draft-07, Draft 2020-12,
 * OpenAPI 3.0, and OpenAPI 3.1; conversions normalize through
 * `Document<"draft-2020-12">` before emitting another dialect, including
 * JSON Schema Draft-04. The module also defines document types, meta-schema
 * constants, and OpenAPI component-key helpers.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/Schema/jsonSchema
 *
 * @file      jsonSchema.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as InternalRecord from "../record.js";

import { formatUriFragment, parseUriFragment } from "../../JsonPointer.js";

import * as Predicate from "../../Predicate.js";

/**
 * A plain object representing a single JSON Schema node.
 *
 * @category models
 * @since 1.0.0
 */
export interface JsonSchema
{
    [x: string]: unknown;
}

/**
 * The set of JSON Schema dialects supported by this module.
 *
 * @category models
 * @since 1.0.0
 */
export type Dialect = "draft-04" | "draft-07" | "draft-2020-12" | "openapi-3.1" | "openapi-3.0";

/**
 * The JSON Schema primitive type names.
 *
 * @category models
 * @since 1.0.0
 */
export type Type = "string" | "number" | "boolean" | "array" | "object" | "null" | "integer";

/**
 * A record of named JSON Schema definitions, keyed by definition name.
 *
 * @category models
 * @since 1.0.0
 */
export interface Definitions extends Record<string, JsonSchema>
{
}

/**
 * A structured container for a single JSON Schema and its associated
 * definitions.
 *
 * @category models
 * @since 1.0.0
 */
export interface Document<D extends Dialect>
{
    readonly dialect: D;
    readonly schema: JsonSchema;
    readonly definitions: Definitions;
}

/**
 * Supports is meta schema uri during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isMetaSchemaUri = (value: unknown, uri: string): boolean =>
{
    return value === uri || value === (uri.endsWith("#") ? uri.slice(0, -1) : `${uri}#`);
};

/**
 * Converts a `Document<"draft-2020-12">` to a `Document<"draft-07">`.
 *
 * @category encoding
 * @since 1.0.0
 */
export const toDocumentDraft07 = (document: Document<"draft-2020-12">): Document<"draft-07"> =>
{
    return {
        dialect: "draft-07",
        ...convertDocument(document, draft07Adapter)
    };
};

/**
 * Supports transform schema during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const transformSchema = (node: unknown, transform: (schema: Record<string, unknown>, inEmbeddedResource: boolean) => void): unknown =>
{
    /**
     * Supports walk during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const walk = (node: unknown, inheritedResource: boolean, isRoot = false): unknown =>
    {
        if (!Predicate.isObject(node))
        {return node;}

        const inEmbeddedResource = inheritedResource || (!isRoot && createsResource(node.$id));
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(node))
        {
            const value = node[key];
            let transformed = value;
            switch (key)
            {
                case "$defs":
                case "properties":
                case "patternProperties":
                case "dependentSchemas":
                    transformed = mapObject(value, (value) => walk(value, inEmbeddedResource)) ?? value;
                    break;
                case "allOf":
                case "anyOf":
                case "oneOf":
                case "prefixItems":
                    transformed = Array.isArray(value) ? value.map((value) => walk(value, inEmbeddedResource)) : value;
                    break;
                case "not":
                case "additionalProperties":
                case "propertyNames":
                case "unevaluatedProperties":
                case "items":
                case "contains":
                case "unevaluatedItems":
                case "if":
                case "then":
                case "else":
                case "contentSchema":
                    transformed = walk(value, inEmbeddedResource);
            }

            InternalRecord.assignProperty(out, key, transformed);
        }

        transform(out, inEmbeddedResource);
        return out;
    };

    return walk(node, false, true);
};

/**
 * Supports rewrite schema ref during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const rewriteSchemaRef = (schema: Record<string, unknown>, rewrite: ($ref: string, keyword: "$ref" | "$dynamicRef") => string): void =>
{
    if (typeof schema.$ref === "string")
    {
        InternalRecord.assignProperty(schema, "$ref", rewrite(schema.$ref, "$ref"));
    }

    if (typeof schema.$dynamicRef === "string")
    {
        InternalRecord.assignProperty(schema, "$dynamicRef", rewrite(schema.$dynamicRef, "$dynamicRef"));
    }
};

/**
 * Supports map object during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const mapObject = (value: unknown, f: (node: unknown, key: string) => unknown): Record<string, unknown> | undefined =>
{
    if (!Predicate.isObject(value))
    {return undefined;}

    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value))
    {
        InternalRecord.assignProperty(out, key, f(value[key], key));
    }

    return out;
};

type Path = ReadonlyArray<string>;

type Convert = (root: unknown, sourcePath?: Path, targetPath?: Path) => unknown;

interface Context
{
    readonly isDocumentRoot: boolean;
    readonly schema: (value: unknown, sourceKey: string, targetKey?: string) => unknown;
    readonly schemaAt: (value: unknown, sourcePath: Path, targetPath: Path) => unknown;
    readonly schemaArray: (value: unknown, sourceKey: string, targetKey?: string) => unknown;
    readonly schemaMap: (value: unknown, sourceKey: string, targetKey?: string) => unknown;
    readonly reference: (out: JsonSchema, value: unknown) => void;
}

type Adapter = (schema: JsonSchema, context: Context) => JsonSchema;

interface ConverterOptions
{
    readonly booleanAdapter?: (schema: boolean) => JsonSchema | boolean;
    readonly trackIds?: boolean;
    readonly ignoreRefSiblings?: boolean;
}

// Adapters decide which values are schemas. The kernel only handles recursion,
// resource scopes, and reference relocation between structural source/target paths.

/**
 * Supports run converter during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
const runConverter = <A>(adapter: Adapter, options: ConverterOptions | undefined, use: (convert: Convert) => A): A =>
{
    const locations = new Map<string, Path>();
    const refs: Array<readonly [JsonSchema, string]> = [];

    /**
     * Supports loop during synchronous schema processing.
     *
     *
     * @throws { Error } When schema configuration is invalid or a callback throws.
     *
     * @category Internal
     * @since 1.0.0
     */
    const loop = (node: unknown, source: Path, target: Path): unknown =>
    {
        locations.set(formatUriFragment(source), target);
        if (typeof node === "boolean") {return options?.booleanAdapter?.(node) ?? node;}

        if (!Predicate.isObject(node)) {return node;}

        if (node.$id !== undefined || node.id !== undefined || node.$anchor !== undefined || node.$dynamicAnchor !== undefined) {throw new Error("Resource identifiers are unsupported; use local JSON pointers");}

        const context: Context = {
            isDocumentRoot: source.length === 0,
            schema: (value, from, to = from) => loop(value, [ ...source, from ], [ ...target, to ]),
            schemaAt: (value, from, to) => loop(value, [ ...source, ...from ], [ ...target, ...to ]),
            schemaArray: (value, from, to = from) => Array.isArray(value) ? value.map((v, i) => loop(v, [ ...source, from, String(i) ], [ ...target, to, String(i) ])) : value,
            schemaMap: (value, from, to = from) => mapObject(value, (v, key) => loop(v, [ ...source, from, key ], [ ...target, to, key ])) ?? value,
            reference(out, value)
            {
                if (typeof value !== "string") {throw new Error("Invalid JSON Schema reference");}

                if (!value.startsWith("#")) {throw new Error("External JSON Schema references are unsupported");}

                refs.push([ out, value ]);
            }
        };
        return adapter(node, context);
    };

    const out = use((node, source = [], target = []) => loop(node, source, target));
    for (const [ node, ref ] of refs)
    {
        const tokens = parseUriFragment(ref); if (!tokens) {throw new Error("Unsupported JSON Schema reference: " + ref);}

        const target = locations.get(formatUriFragment(tokens)); InternalRecord.assignProperty(node, "$ref", target ? relocateReference(ref, target) : ref);
    }

    return out;
};

/**
 * Supports relocate reference during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const relocateReference = (reference: string, targetPath: Path): string =>
{
    const index = reference.indexOf("#");
    if (index === -1 && targetPath.length === 0)
    {return reference;}

    const uri = index === -1 ? reference : reference.slice(0, index);
    return `${uri}${formatUriFragment(targetPath)}`;
};

/**
 * Supports creates resource during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const createsResource = (id: unknown): boolean =>
{
    return typeof id === "string" && id.length > 0 && id[0] !== "#";
};

/**
 * Supports convert document during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertDocument = (document: Document<"draft-2020-12">, adapter: Adapter, options?: ConverterOptions): {
    readonly schema: JsonSchema;
    readonly definitions: Definitions;
} =>
{
    return runConverter(adapter, { ...options,
        trackIds: true }, (convert) => ({
        schema: convert(document.schema) as JsonSchema,
        definitions: mapObject(document.definitions, (definition, key) => convert(definition, [ "$defs", key ], [ "definitions", key ]) as JsonSchema) as Definitions
    }));
};

const SchemaMapKeywords = new Set([ "properties", "patternProperties" ]);

const SchemaArrayKeywords = new Set([ "allOf", "anyOf", "oneOf" ]);

const JsonSchemaSingleKeywords = new Set([
    "not",
    "additionalProperties",
    "propertyNames",
    "contains",
    "if",
    "then",
    "else",
    "contentSchema"
]);

/**
 * Supports convert subschema keyword during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertSubschemaKeyword = (out: JsonSchema, key: string, value: unknown, context: Context, singleKeywords: ReadonlySet<string>, mapKeywords: ReadonlySet<string> = SchemaMapKeywords): boolean =>
{
    let converted: unknown;
    if (mapKeywords.has(key))
    {converted = context.schemaMap(value, key);}
    else if (SchemaArrayKeywords.has(key))
    {converted = context.schemaArray(value, key);}
    else if (singleKeywords.has(key))
    {converted = context.schema(value, key);}
    else
    {return false;}

    InternalRecord.assignProperty(out, key, converted);
    return true;
};

const AnchorRegexp = /^[A-Za-z_][-A-Za-z0-9._]*$/;

const LegacyIdFragmentRegexp = /^[A-Za-z][-A-Za-z0-9._:]*$/;

/**
 * Supports unsupported during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
const unsupported: (keyword: string, dialect: string, details: string) => never = (keyword, dialect, details) =>
{
    throw new Error(`Cannot convert JSON Schema keyword "${keyword}" to ${dialect}: ${details}`);
};

/**
 * Supports reject keyword collisions during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const rejectKeywordCollisions = (source: JsonSchema, keywords: ReadonlyArray<string>, targetDialect: string, sourceDialect: string): void =>
{
    for (const keyword of keywords)
    {
        if (Object.hasOwn(source, keyword))
        {
            unsupported(keyword, targetDialect, `it is not active in ${sourceDialect} but would become active in the target`);
        }
    }
};

const Draft07TargetCollisions = [ "additionalItems", "definitions", "dependencies" ];

/**
 * Supports convert meta schema keyword during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertMetaSchemaKeyword = (out: JsonSchema, value: unknown, context: Context, targetUri: string, targetDialect: string): void =>
{
    if (context.isDocumentRoot)
    {
        InternalRecord.assignProperty(out, "$schema", isMetaSchemaUri(value, MetaSchemaUriDraft202012) ? targetUri : value);
    }
    else if (!isMetaSchemaUri(value, MetaSchemaUriDraft202012))
    {
        unsupported("$schema", targetDialect, "an embedded resource cannot declare a different dialect");
    }
};

/**
 * Supports draft07adapter during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const draft07Adapter = (source: JsonSchema, context: Context): JsonSchema =>
{
    rejectKeywordCollisions(source, Draft07TargetCollisions, "Draft-07", "Draft 2020-12");
    const out: JsonSchema = {};
    let reference: unknown = undefined;
    let prefixItems: unknown = undefined;
    let items: unknown = undefined;
    for (const key of Object.keys(source))
    {
        const value = source[key];
        if (convertSubschemaKeyword(out, key, value, context, JsonSchemaSingleKeywords))
        {continue;}

        switch (key)
        {
            case "$ref":
                reference = value;
                break;
            case "$schema":
                convertMetaSchemaKeyword(out, value, context, MetaSchemaUriDraft07, "Draft-07");
                break;
            case "$id":
            case "$anchor":
                break;
            case "$defs":
                InternalRecord.assignProperty(out, "definitions", context.schemaMap(value, key, "definitions"));
                break;
            case "prefixItems":
                prefixItems = value;
                break;
            case "items":
                items = value;
                break;
            case "dependentRequired":
            case "dependentSchemas":
            case "minContains":
            case "maxContains":
                break;
            case "$dynamicRef":
            case "$dynamicAnchor":
            case "$vocabulary":
            case "unevaluatedProperties":
            case "unevaluatedItems":
                unsupported(key, "Draft-07", "the target dialect has no equivalent");
                break;
            case "required":
                if (Array.isArray(value) && value.length === 0)
                {break;}

                InternalRecord.assignProperty(out, key, value);
                break;
            default:
                InternalRecord.assignProperty(out, key, value);
        }
    }

    convertTuple(out, prefixItems, items, context);
    if (Object.hasOwn(source, "contains"))
    {
        const minContains = source.minContains;
        const maxContains = source.maxContains;
        if ((minContains !== undefined && minContains !== 1) || maxContains !== undefined)
        {
            unsupported("minContains/maxContains", "Draft-07", "contains cardinality cannot be represented");
        }

        if (Object.hasOwn(source, "minContains"))
        {InternalRecord.assignProperty(out, "minContains", minContains);}
    }
    else
    {
        if (Object.hasOwn(source, "minContains"))
        {InternalRecord.assignProperty(out, "minContains", source.minContains);}

        if (Object.hasOwn(source, "maxContains"))
        {InternalRecord.assignProperty(out, "maxContains", source.maxContains);}
    }

    convertDependencies(source, out, context, "draft-07");
    convertLegacyId(source, out, "$id", "Draft-07");
    convertReference(out, reference, context);
    return out;
};

/**
 * Supports convert tuple during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertTuple = (out: JsonSchema, prefixItems: unknown, items: unknown, context: Context): void =>
{
    if (prefixItems === undefined)
    {
        if (items !== undefined)
        {InternalRecord.assignProperty(out, "items", context.schema(items, "items"));}

        return;
    }

    InternalRecord.assignProperty(out, "items", context.schemaArray(prefixItems, "prefixItems", "items"));
    if (items !== undefined)
    {
        InternalRecord.assignProperty(out, "additionalItems", context.schema(items, "items", "additionalItems"));
    }
};

/**
 * Supports convert reference during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertReference = (out: JsonSchema, reference: unknown, context: Context): void =>
{
    if (reference === undefined)
    {return;}

    if (typeof reference === "string" && Object.keys(out).length > 0)
    {
        const referenceSchema: JsonSchema = {};
        context.reference(referenceSchema, reference);
        appendAllOf(out, referenceSchema);
    }
    else
    {
        context.reference(out, reference);
    }
};

/**
 * Supports convert dependencies during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertDependencies = (source: JsonSchema, out: JsonSchema, context: Context, targetDialect: "draft-04" | "draft-07"): void =>
{
    const dependentRequired = Predicate.isObject(source.dependentRequired) ? source.dependentRequired : undefined;
    const dependentSchemas = Predicate.isObject(source.dependentSchemas) ? source.dependentSchemas : undefined;
    if (dependentRequired === undefined && dependentSchemas === undefined)
    {return;}

    const dependencies: JsonSchema = {};
    const keys = new Set([
        ...Object.keys(dependentRequired ?? {}),
        ...Object.keys(dependentSchemas ?? {})
    ]);
    for (const key of keys)
    {
        const required = dependentRequired?.[key];
        const dependency = dependentSchemas?.[key];
        const omitRequired = targetDialect === "draft-04" && Array.isArray(required) && required.length === 0;
        if (dependency === undefined)
        {
            if (!omitRequired)
            {InternalRecord.assignProperty(dependencies, key, required);}
        }
        else if (required === undefined || omitRequired)
        {
            InternalRecord.assignProperty(dependencies, key, context.schemaAt(dependency, [ "dependentSchemas", key ], [ "dependencies", key ]));
        }
        else
        {
            InternalRecord.assignProperty(dependencies, key, {
                allOf: [
                    context.schemaAt(dependency, [ "dependentSchemas", key ], [ "dependencies", key, "allOf", "0" ]),
                    { required }
                ]
            });
        }
    }

    if (Object.keys(dependencies).length > 0)
    {InternalRecord.assignProperty(out, "dependencies", dependencies);}
};

/**
 * Supports append all of during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const appendAllOf = (out: JsonSchema, schema: JsonSchema): void =>
{
    if (Array.isArray(out.allOf))
    {out.allOf.push(schema);}
    else
    {InternalRecord.assignProperty(out, "allOf", [ schema ]);}
};

/**
 * Supports convert legacy id during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const convertLegacyId = (source: JsonSchema, out: JsonSchema, targetKey: "$id" | "id", dialect: string): void =>
{
    const id = source.$id;
    const anchor = source.$anchor;
    if (anchor === undefined)
    {
        if (id !== undefined)
        {InternalRecord.assignProperty(out, targetKey, id);}

        return;
    }

    if (typeof anchor !== "string" || !AnchorRegexp.test(anchor))
    {
        unsupported("$anchor", dialect, "the anchor is not valid");
    }

    if (!LegacyIdFragmentRegexp.test(anchor))
    {
        unsupported("$anchor", dialect, "the anchor cannot be represented as a plain-name fragment identifier");
    }

    if (id === undefined)
    {
        InternalRecord.assignProperty(out, targetKey, `#${anchor}`);
    }
    else
    {
        unsupported("$anchor", dialect, "it cannot be combined with the schema $id");
    }
};

/**
 * Like {@link Document}, but carries multiple root schemas that share a
 * single definitions pool.
 *
 * **When to use**
 *
 * Use when generating several schemas, such as a request body
 * and a response body, that reference the same set of definitions.
 *
 * **Details**
 *
 * The `schemas` tuple is non-empty and contains at least one element.
 *
 * @see {@link Document}
 * @see {@link toMultiDocumentOpenApi3_1}
 *
 * @category models
 * @since 1.0.0
 */
export interface MultiDocument<D extends Dialect>
{
    readonly dialect: D
    readonly schemas: readonly [JsonSchema, ...Array<JsonSchema>]
    readonly definitions: Definitions
}

/**
 * Represents the `$schema` meta-schema URI for JSON Schema Draft-04.
 *
 * **When to use**
 *
 * Use when constructing a Draft-04 JSON Schema document and you need a stable
 * value for the root `$schema` field.
 *
 * @see {@link MetaSchemaUriDraft07} for the Draft-07 `$schema` URI
 *
 * @category constants
 * @since 1.0.0
 */
export const MetaSchemaUriDraft04 = "http://json-schema.org/draft-04/schema#";

/**
 * Represents the `$schema` meta-schema URI for JSON Schema Draft-07.
 *
 * **When to use**
 *
 * Use when constructing a Draft-07 JSON Schema document and you need a stable
 * value for the root `$schema` field.
 *
 * **Details**
 *
 * The exported value is the literal string
 * `http://json-schema.org/draft-07/schema#`.
 *
 * @see {@link MetaSchemaUriDraft04} for the Draft-04 `$schema` URI
 * @see {@link MetaSchemaUriDraft202012} for the Draft 2020-12 `$schema` URI
 *
 * @category constants
 * @since 1.0.0
 */
export const MetaSchemaUriDraft07 = "http://json-schema.org/draft-07/schema#";

/**
 * Represents the `$schema` meta-schema URI for JSON Schema Draft 2020-12.
 *
 * **When to use**
 *
 * Use when you need to populate the `$schema` field while emitting a JSON
 * Schema document that should declare JSON Schema Draft 2020-12.
 *
 * **Details**
 *
 * The exported value is the literal string
 * `https://json-schema.org/draft/2020-12/schema`.
 *
 * @see {@link MetaSchemaUriDraft07} for the Draft-07 `$schema` URI
 *
 * @category constants
 * @since 1.0.0
 */
export const MetaSchemaUriDraft202012 = "https://json-schema.org/draft/2020-12/schema";

/**
 * Supports rewrite refs during synchronous schema processing.
 *
 *  @internal
 *
 * @category Internal
 * @since 1.0.0
 */
export const rewriteRefs = (schema: JsonSchema, rewrite: ($ref: string) => string): JsonSchema =>
{
    return transformSchema(schema, (schema) =>
    {
        rewriteSchemaRef(schema, rewrite);
    }) as JsonSchema;
};
