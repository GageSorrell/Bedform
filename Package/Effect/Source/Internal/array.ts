/**
 * Internal array construction, traversal and transformation operations.
 *
 * @module @bedform/effect/Internal/array
 *
 * @file      array.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { NonEmptyArray } from "../Array.js";

/**
 * Tests whether the array contains at least one element.
 *
 * @internal
 *
 * @category Guard
 * @since 1.0.0
 */
export const isArrayNonEmpty = <A>(self: ReadonlyArray<A>): self is NonEmptyArray<A> => self.length > 0;

/**
 * Copies an array and replaces the value at the specified index.
 *
 * @internal
 *
 * @category Transforming
 * @since 1.0.0
 */
export function replaceAt<A>(self: ReadonlyArray<A>, index: number, value: A): Array<A>
{
    const out = self.slice();
    out[index] = value;
    return out;
}
