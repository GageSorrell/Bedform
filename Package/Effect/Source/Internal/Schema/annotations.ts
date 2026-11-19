/**
 * Resolves schema annotations such as identifiers, titles, descriptions and
 * expected-value text, and names the annotation keys that Schema treats
 * specially. Adapted from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/annotations
 *
 * @file      annotations.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable sort-imports, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import { memoize } from "../../Function.js";

import type * as Schema from "../../Schema.js";

import type * as SchemaAST from "../../SchemaAST.js";

/**
 * Supports resolve during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function resolve(ast: SchemaAST.AST): Schema.Annotations.Annotations | undefined
{
    return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}

/**
 * Supports resolve at during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function resolveAt<A>(key: string)
{
    return (ast: SchemaAST.AST): A | undefined => resolve(ast)?.[key] as A | undefined;
}

/**
 * Supports structural annotation key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const StructuralAnnotationKey = "~structural";

/**
 * Supports identifier fallback key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const IdentifierFallbackKey = "~identifier";

/**
 * Supports sentinels annotation key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const SentinelsAnnotationKey = "~sentinels";

/**
 * Supports constructor annotation key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ConstructorAnnotationKey = "~constructor";

/**
 * Supports json schema annotation keys during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const jsonSchemaAnnotationKeys = [
    "title",
    "description",
    "default",
    "examples",
    "readOnly",
    "writeOnly",
    "format",
    "contentEncoding",
    "contentMediaType",
    "contentSchema"
] as const;

/**
 * Supports resolve identifier during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const resolveIdentifier = resolveAt<string>("identifier");

/**
 * Supports resolve identifier fallback during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const resolveIdentifierFallback = resolveAt<string>(IdentifierFallbackKey);

/**
 * Supports resolve title during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const resolveTitle = resolveAt<string>("title");

/**
 * Supports resolve description during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const resolveDescription = resolveAt<string>("description");

/**
 * Supports get expected during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getExpected = memoize((ast: SchemaAST.AST): string =>
{
    const identifier = resolve(ast)?.identifier;
    if (typeof identifier === "string")
    {return identifier;}

    return ast.getExpected(getExpected);
});

/**
 * Supports annotation excluded keys during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const annotationExcludedKeys = new Set([
    SentinelsAnnotationKey,
    StructuralAnnotationKey,
    "representation",
    "~representation",
    "arbitraryConstraint",
    "toJsonSchema",
    "toCode",
    "toEquivalence",
    "toFormatter",
    "toCodec",
    "toCodecJson",
    "toCodecStringTree",
    "toCodecIso",
    "toCodecArbitrary"
]);

