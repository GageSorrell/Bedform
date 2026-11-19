/**
 * Storage for `Redacted` values: a registry that keeps each secret outside the
 * value object, with access to the secret and safe string conversion. Ported
 * from Effect 4.0.5 as a Schema dependency.
 *
 * @module @bedform/effect/Internal/redacted
 *
 * @file      redacted.ts
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

/* eslint-disable @stylistic/max-len */

import type * as Redacted from "../Redacted.js";

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal 
 *
 * @category Utilities
 * @since 1.0.0
 */
export const redactedRegistry = new WeakMap<Redacted.Redacted<any>, any>();

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal 
 *
 * @throws { Error } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const value = <T>(self: Redacted.Redacted<T>): T =>
{
    if (redactedRegistry.has(self))
    {
        return redactedRegistry.get(self);
    }
    else
    {
        throw new Error(
            "Unable to get redacted value" +
        (self.label ? ` with label: "${self.label}"` : "")
        );
    }
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal 
 *
 * @category Utilities
 * @since 1.0.0
 */
export const stringOrRedacted = (val: string | Redacted.Redacted): string => typeof val === "string" ? val : value(val);
