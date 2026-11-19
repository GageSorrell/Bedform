/**
 * The default `Random` service reference, backed by `Math.random` so that it
 * needs no host `crypto`, and the range scaling shared by random draws. Ported
 * from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/random
 *
 * @file      random.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-keys */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Context from "../Context.js";
import type { Random as RandomService } from "../Random.js";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Random: Context.Reference<RandomService> = Context.Reference<RandomService>("effect/Random", {
    defaultValue: () => ({
        nextIntUnsafe()
        {
            return Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - Number.MIN_SAFE_INTEGER + 1)) +
        Number.MIN_SAFE_INTEGER;
        },
        nextDoubleUnsafe()
        {
            return Math.random();
        }
    })
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const nextBetween = (min: number, max: number, draw: number): number =>
{
    const value = draw * (max - min) + min;
    if (value !== max || min >= max || !Number.isFinite(max))
    {
        return value;
    }

    // Rounding can reach the excluded endpoint even for a draw below 1.
    // Return its immediate predecessor, which is at least min for finite min < max.
    if (max === 0)
    {
        return -Number.MIN_VALUE;
    }

    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, max);
    const bits = view.getBigUint64(0);
    view.setBigUint64(0, max > 0 ? bits - BigInt(1) : bits + BigInt(1));
    return view.getFloat64(0);
};
