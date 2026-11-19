/**
 * Internal collection cardinality and counting operations.
 *
 * @module @bedform/effect/Internal/count
 *
 * @file      count.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Normalizes a collection count to a non-negative integer. `NaN` and
 * non-positive values become `0`; positive infinity is preserved.
 *
 * @internal
 *
 * @category Combinator
 * @since 1.0.0
 */
export const normalize = (n: number): number => n > 0 ? Math.floor(n) : 0;

/**
 * Normalizes a collection count to an integer greater than or equal to `1`.
 *
 * @internal
 *
 * @category Combinator
 * @since 1.0.0
 */
export const normalizeNonEmpty = (n: number): number => Math.max(1, normalize(n));
