/**
 * Internal hashing state and value hash calculations.
 *
 * @module @bedform/effect/Internal/hash
 *
 * @file      hash.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/**
 * Back-edge count used to avoid caching entry-point-dependent hashes.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export let backEdges = 0;

/**
 * Records a cyclic back edge encountered during hashing.
 *
 * @internal
 *
 * @category Hashing
 * @since 1.0.0
 */
export const addBackEdge = (): void =>
{
    backEdges++;
};
