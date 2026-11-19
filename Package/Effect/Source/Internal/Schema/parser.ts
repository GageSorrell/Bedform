/**
 * Parser results: present and missing inputs, successful results, and
 * conversions between parse exits and options. Adapted from Effect 4.0.5 for
 * synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/parser
 *
 * @file      parser.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Option from "../../Option.js";
import * as Result from "../../Result.js";

/**
 * Missing input is distinct from a present undefined value.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const missing = Symbol();

/**
 * Successful parser result.
 *
 * @category Types
 * @since 1.0.0
 */
export type Success<A, E = never> = Result.Success<A, E>;

/**
 * Constructs a successful parser result.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const succeed = Result.succeed as <A>(value: A) => Result.Success<A, never>;

/**
 * Shared missing result.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const missingExit = succeed(missing);

/**
 * Internal marker for input returned unchanged; never crosses the public boundary.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const sameExit: Success<unknown> = succeed(missing);

/**
 * Converts the missing marker to an optional input.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const toOption = <A>(value: A): Option.Option<A> => value === missing ? Option.none() : Option.some(value);

/**
 * Converts optional output back to a parser result.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const fromOptionExit = <A>(value: Option.Option<A>): Success<A | typeof missing> => Option.isNone(value) ? missingExit : succeed(value.value);

/**
 * Rejects malformed user callback results as defects.
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function checked<A, E>(value: Result.Result<A, E>): Result.Result<A, E>
{
    if (!Result.isResult(value)) {throw new TypeError("Schema callback must return a Result");}

    return value;
}

