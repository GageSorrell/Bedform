/**
 * Exposes schemas through the Standard Schema and Standard JSON Schema V1
 * interfaces. Adapted from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/standardSchema
 *
 * @file      standardSchema.ts
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

import * as JsonSchema from "./jsonSchema.js";
import * as Result from "../../Result.js";
import type * as Schema from "../../Schema.js";
import * as SchemaAST from "../../SchemaAST.js";
import * as SchemaIssue from "../../SchemaIssue.js";
import * as SchemaParser from "../../SchemaParser.js";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "../../StandardSchema.js";
import * as Codec from "./toCodec.js";
import * as Document from "./toJsonSchemaDocument.js";
import * as Representation from "./toRepresentation.js";

/**
 * Adds synchronous Standard Schema validation, preserving existing JSON capabilities.
 *
 * @category Interoperability
 * @since 1.0.0
 */
export function toStandardSchemaV1<S extends Schema.ConstraintDecoder<unknown>>(self: S, options?: { readonly leafHook?: SchemaIssue.LeafHook;
    readonly checkHook?: SchemaIssue.CheckHook;
    readonly parseOptions?: SchemaAST.ParseOptions }): StandardSchemaV1<S["Encoded"], S["Type"]> & S
{
    const decode = SchemaParser.decodeUnknownResult(self, { errors: "all",
        ...options?.parseOptions });
    const formatter = SchemaIssue.makeFormatterStandardSchemaV1(options);
    const validate = (input: unknown): StandardSchemaV1.Result<S["Type"]> =>
    {
        try
        {
            const result = decode(input);
            return Result.isSuccess(result) ? { value: result.success } : formatter(result.failure);
        }
        catch (error)
        {
            return { issues: [ { message: String(error) } ] };
        }
    };

    const target = self as S & StandardSchemaV1<S["Encoded"], S["Type"]>;
    if (Object.hasOwn(self, "~standard")) {Object.assign(target["~standard"], { validate });}
    else
    {
        Object.assign(target, { "~standard": { version: 1,
            vendor: "effect",
            validate } });
    }

    return target;
}

/**
 * Derives a standalone local-reference document for the requested standard target.
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Interoperability
 * @since 1.0.0
 */
function toStandardDocument(ast: SchemaAST.AST, target: StandardJSONSchemaV1.Target): JsonSchema.JsonSchema
{
    const document = Document.toJsonSchemaDocument(Representation.toRepresentation(Codec.toCodecJsonAST(ast)));
    if (target === "draft-2020-12")
    {
        return Object.keys(document.definitions).length ? { ...document.schema,
            $defs: document.definitions } : document.schema;
    }

    if (target === "draft-07")
    {
        const draft = JsonSchema.toDocumentDraft07(document);
        return Object.keys(draft.definitions).length ? { ...draft.schema,
            definitions: draft.definitions } : draft.schema;
    }

    throw new Error(`Unsupported target: ${target}`);
}

/**
 * Adds Standard JSON Schema input and output derivation alongside validation.
 *
 * @category Interoperability
 * @since 1.0.0
 */
export function toStandardJSONSchemaV1<S extends Schema.Constraint>(self: S): StandardJSONSchemaV1<S["Encoded"], S["Type"]> & S
{
    const jsonSchema: StandardJSONSchemaV1.Props<S["Encoded"], S["Type"]>["jsonSchema"] = {
        input: (options) => toStandardDocument(self.ast, options.target),
        output: (options) => toStandardDocument(SchemaAST.toType(self.ast), options.target)
    };
    const target = self as S & StandardJSONSchemaV1<S["Encoded"], S["Type"]>;
    if (Object.hasOwn(self, "~standard")) {Object.assign(target["~standard"], { jsonSchema });}
    else
    {
        Object.assign(target, { "~standard": { version: 1,
            vendor: "effect",
            jsonSchema } });
    }

    return target;
}
