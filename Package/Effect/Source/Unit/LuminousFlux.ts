/**
 * Luminous flux quantities, stored in lumens, with constructors and conversions
 * for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `LuminousFlux` and `LuminousFluxExact` modules.
 *
 * @module @bedform/effect/Unit/LuminousFlux
 *
 * @file      LuminousFlux.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Quantity from "./Quantity.js";

/**
 * The type of the `Lumens` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Lumens = "Lumens";

/**
 * The `Lumens` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Lumens: Lumens = "Lumens";

/**
 * A quantity measured in `Lumens`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type LuminousFlux<K extends Quantity.Value = number> = Quantity.Quantity<Lumens, K>;

/**
 * The identity schema for `LuminousFlux` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LuminousFlux = Quantity.Quantity(Lumens);

/**
 * The codec between `LuminousFlux` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LuminousFluxFromStruct = Quantity.QuantityFromStruct(Lumens);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): LuminousFlux<K> => Quantity.make(Lumens, value) as LuminousFlux<K>;

/**
 * A `LuminousFlux` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `LuminousFlux` from a number of lumens.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const lumens = <N extends Quantity.Input>(n: N): LuminousFlux<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `LuminousFlux` to a number of lumens.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inLumens = <K extends Quantity.Value>(f: LuminousFlux<K>): K =>
    f.value;
