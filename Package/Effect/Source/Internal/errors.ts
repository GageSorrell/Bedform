/**
 * Builds schema errors whose messages end with the path at which processing
 * failed. Adapted from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/errors
 *
 * @file      errors.ts
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

import { formatPath } from "../Formatter.js";

/**
 * Supports error with path during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function errorWithPath(message: string, path: ReadonlyArray<PropertyKey>)
{
    if (path.length > 0)
    {
        message += `\n  at ${formatPath(path)}`;
    }

    return new Error(message);
}
