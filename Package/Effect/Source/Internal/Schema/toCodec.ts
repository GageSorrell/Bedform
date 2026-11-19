/**
 * Derives JSON, isomorphism and array-from-single codecs from schemas. Adapted
 * from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/toCodec
 *
 * @file      toCodec.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import { memoize } from "../../Function.js";

import * as Predicate from "../../Predicate.js";

import type * as PublicSchema from "../../Schema.js";

import * as SchemaAST from "./ast.js";

import * as SchemaGetter from "../../SchemaGetter.js";

import * as InternalTransformation from "../../SchemaTransformation.js";

import * as InternalMake from "./make.js";

/**
 * Supports to codec json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function toCodecJson<S extends PublicSchema.Constraint>(schema: S): PublicSchema.toCodecJson<S>
{
    return InternalMake.make(toCodecJsonAST(schema.ast), { schema });
}

/**
 * Supports to codec json ast during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toCodecJsonAST = SchemaAST.applyToSelfOrLastLinkEncodingIdempotent((ast) =>
{
    const out = toCodecJsonASTStep(ast, toCodecJsonAST);
    const context = ast.context;
    if (out === ast || context === undefined)
    {return out;}

    return SchemaAST.replaceContextLastLink(out, withoutConstructorDefault(context));
});

/**
 * Supports without constructor default during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function withoutConstructorDefault(context: SchemaAST.Context): SchemaAST.Context
{
    return context.constructorDefault === undefined ?
        context :
        new SchemaAST.Context(context.isOptional, context.isMutable, undefined, context.annotations);
}

/**
 * Supports validate canonical object property names during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
function validateCanonicalObjectPropertyNames(ast: SchemaAST.Objects): void
{
    if (ast.propertySignatures.some((ps) => typeof ps.name !== "string"))
    {
        throw new globalThis.Error("Objects property names must be strings", { cause: ast });
    }
}

/**
 * Supports make reorder during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeReorder(getPriority: (ast: SchemaAST.AST) => number)
{
    return (types: ReadonlyArray<SchemaAST.AST>): ReadonlyArray<SchemaAST.AST> =>
    {
        const sortedTypes = [ ...types ].sort((a, b) => getPriority(SchemaAST.toEncoded(a)) - getPriority(SchemaAST.toEncoded(b)));
        // Check if order changed by comparing arrays
        const orderChanged = sortedTypes.some((ast, index) => ast !== types[index]);
        if (!orderChanged)
        {return types;}

        return sortedTypes;
    };
}

const toCodecJsonReorder = makeReorder((ast: SchemaAST.AST) =>
{
    switch (ast._tag)
    {
        case "BigInt":
        case "Symbol":
        case "UniqueSymbol":
            return 0;
        default:
            return 1;
    }
});

/**
 * Supports to codec json aststep during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function toCodecJsonASTStep(ast: SchemaAST.AST, recur: (ast: SchemaAST.AST) => SchemaAST.AST): SchemaAST.AST
{
    switch (ast._tag)
    {
        case "Declaration": {
            const getLink = ast.annotations?.toCodecJson ?? ast.annotations?.toCodec;
            if (!Predicate.isFunction(getLink))
            {
                return SchemaAST.replaceEncoding(ast, [ SchemaAST.unknownToJson ]);
            }

            const typeParameters = ast.typeParameters.map((tp) => InternalMake.make(SchemaAST.toEncoded(tp)));
            const link = getLink(typeParameters);
            return link === undefined ? ast : SchemaAST.replaceEncoding(ast, [ SchemaAST.mapLink(link, recur) ]);
        }

        case "Unknown":
            return SchemaAST.replaceEncoding(ast, [ SchemaAST.unknownToJson ]);
        case "ObjectKeyword":
            return SchemaAST.replaceEncoding(ast, [ SchemaAST.objectKeywordToJson ]);
        case "Undefined":
        case "Void":
        case "Literal":
        case "Number":
            return ast.toCodecJson();
        case "UniqueSymbol":
        case "Symbol":
        case "BigInt":
            return SchemaAST.stringCodec(ast);
        case "Objects": {
            validateCanonicalObjectPropertyNames(ast);
            return ast.recur(recur, SchemaAST.parameterFromString);
        }

        case "Union": {
            const sortedTypes = toCodecJsonReorder(ast.types);
            if (sortedTypes !== ast.types)
            {
                return new SchemaAST.Union(sortedTypes, ast.options, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur);
            }

            return ast.recur(recur);
        }

        case "Arrays":
        case "Suspend":
            return ast.recur(recur);
    }

    // `Schema.Any` is used as an escape hatch
    return ast;
}

/**
 * Supports to codec iso during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function toCodecIso<S extends PublicSchema.Constraint>(schema: S): PublicSchema.Codec<S["Type"], S["Iso"]>
{
    return InternalMake.make(toCodecIsoAST(SchemaAST.toType(schema.ast)));
}

const toCodecIsoAST = memoize((ast: SchemaAST.AST): SchemaAST.AST =>
{
    const out = toCodecIsoASTStep(ast, toCodecIsoAST);
    return out !== ast && ast.context !== undefined ?
        SchemaAST.replaceContextLastLink(out, withoutConstructorDefault(ast.context)) :
        out;
});

/**
 * Supports to codec iso aststep during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function toCodecIsoASTStep(ast: SchemaAST.AST, recur: (ast: SchemaAST.AST) => SchemaAST.AST): SchemaAST.AST
{
    switch (ast._tag)
    {
        case "Declaration": {
            const getLink = ast.annotations?.toCodecIso ?? ast.annotations?.toCodec;
            if (Predicate.isFunction(getLink))
            {
                const link = getLink(ast.typeParameters.map((tp) => InternalMake.make(tp)));
                return SchemaAST.replaceEncoding(ast, [ SchemaAST.mapLink(link, recur) ]);
            }

            return ast;
        }

        case "Arrays":
        case "Objects":
        case "Union":
        case "Suspend":
            return ast.recur(recur);
    }

    return ast;
}

/**
 * Supports to codec array from single during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */

/**
 * Supports to codec array from single during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function toCodecArrayFromSingle<S extends PublicSchema.Constraint>(schema: S): PublicSchema.toCodecArrayFromSingle<S>
{
    return InternalMake.make(toCodecArrayFromSingleAST(schema.ast));
}

const arrayFromSingleTransformation = new InternalTransformation.Transformation(SchemaGetter.transform((input: ReadonlyArray<unknown> | string) => typeof input === "string" ? [ input ] : input), SchemaGetter.passthrough());

const isCodecArrayFromSingleLink = (link: SchemaAST.Link): boolean => link.transformation === arrayFromSingleTransformation;

const toArrayFromSingleInputElement = (ast: SchemaAST.AST): SchemaAST.AST => SchemaAST.isOptional(ast) ? SchemaAST.optionalKey(SchemaAST.unknown) : SchemaAST.unknown;

const toCodecArrayFromSingleAST = SchemaAST.applyToSelfOrLastLinkEncodingIdempotent((ast) =>
{
    const out = toCodecArrayFromSingleASTStep(ast);
    if (SchemaAST.isArrays(out))
    {
        const ensure = SchemaAST.decodeTo(new SchemaAST.Union([
            new SchemaAST.Arrays(out.isMutable, out.elements.map(toArrayFromSingleInputElement), out.rest.map(toArrayFromSingleInputElement)),
            SchemaAST.string
        ], { mode: "anyOf" }), out, arrayFromSingleTransformation);
        return SchemaAST.isOptional(ast) ? SchemaAST.optionalKey(ensure) : ensure;
    }

    return out;
}, { stopAt: isCodecArrayFromSingleLink });

/**
 * Supports to codec array from single aststep during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function toCodecArrayFromSingleASTStep(ast: SchemaAST.AST): SchemaAST.AST
{
    return ast._tag === "Declaration" || ast._tag === "Arrays" || ast._tag === "Objects" || ast._tag === "Union" ||
        ast._tag === "Suspend"
        ? ast.recur(toCodecArrayFromSingleAST)
        : ast;
}
