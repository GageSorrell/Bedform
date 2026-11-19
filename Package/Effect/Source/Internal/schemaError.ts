/**
 * The `SchemaError` type identifier and its guard, which need no runtime import
 * of the public `Schema` module. Adapted from Effect 4.0.5 for synchronous
 * parsing.
 *
 * @module @bedform/effect/Internal/schemaError
 *
 * @file      schemaError.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Predicate from "../Predicate.js";

import type { SchemaError } from "../Schema.js";

/**
 * Supports schema error type id during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
export const SchemaErrorTypeId = "~effect/Schema/SchemaError";

/**
 * Supports is schema error during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
export function isSchemaError(u: unknown): u is SchemaError
{
    return Predicate.hasProperty(u, SchemaErrorTypeId) && u[SchemaErrorTypeId] === SchemaErrorTypeId;
}
