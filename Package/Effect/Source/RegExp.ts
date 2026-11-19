/**
 * Tools for working with JavaScript regular expressions from the Effect module
 * namespace. The module exposes the native `RegExp` constructor, a guard for
 * narrowing unknown values, and escaping for literal text that will be embedded
 * in a pattern.
 *
 * Reach for `RegExp` when you need to build a regular expression from user or
 * data-driven text, check whether an unknown value is already a `RegExp`, or
 * access the native constructor without leaving the Effect namespace.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/RegExp
 *
 * @file      RegExp.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

import * as predicate from "./Predicate.js";

/**
 * Exposes the JavaScript regular expression constructor from `globalThis`.
 *
 * **When to use**
 *
 * Use to construct JavaScript regular expressions through the Effect module
 * namespace.
 *
 * **Example** (Creating a regular expression)
 *
 * ```ts import.meta.vitest
 * import { RegExp } from "effect"
 *
 * const pattern = new RegExp.RegExp("hello", "i")
 * pattern // => /hello/i
 * pattern.test("Hello World") // => true
 * pattern.test("goodbye") // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const RegExp = globalThis.RegExp;

/**
 * Checks whether a value is a `RegExp`.
 *
 * **When to use**
 *
 * Use to validate unknown input before treating it as a regular expression.
 *
 * **Example** (Checking for regular expressions)
 *
 * ```ts import.meta.vitest
 * import { RegExp } from "effect"
 *
 * RegExp.isRegExp(/a/) // => true
 * RegExp.isRegExp("a") // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isRegExp: (input: unknown) => input is RegExp = predicate.isRegExp;

/**
 * Escapes special characters in a regular expression pattern.
 *
 * **When to use**
 *
 * Use to turn literal text into a safe regular expression pattern fragment.
 *
 * **Example** (Escaping a pattern string)
 *
 * ```ts import.meta.vitest
 * import { RegExp } from "effect"
 *
 * RegExp.escape("a*b") // => "a\\*b"
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const escape = (string: string): string => string.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
