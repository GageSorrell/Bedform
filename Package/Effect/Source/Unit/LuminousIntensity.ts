/**
 * Luminous intensity quantities, stored in candelas, with constructors and
 * conversions for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `LuminousIntensity` and `LuminousIntensityExact` modules.
 *
 * @module @bedform/effect/Unit/LuminousIntensity
 *
 * @file      LuminousIntensity.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as LuminousFlux from "./LuminousFlux.js";
import * as Quantity from "./Quantity.js";
import * as SolidAngle from "./SolidAngle.js";
import * as Unit from "./Unit.js";

/**
 * The type of the candelas unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Candelas = Unit.Rate<LuminousFlux.Lumens, SolidAngle.Steradians>;

/**
 * The candelas unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Candelas: Candelas = Unit.rate(
    LuminousFlux.Lumens,
    SolidAngle.Steradians
);

/**
 * A quantity measured in `Candelas`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type LuminousIntensity<K extends Quantity.Value = number> = Quantity.Quantity<Candelas, K>;

/**
 * The identity schema for `LuminousIntensity` values. Its canonical JSON
 * representation is `{ unit, value }` with a finite numeric value, so
 * `Schema.toCodecJson` derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LuminousIntensity = Quantity.Quantity(Candelas);

/**
 * The codec between `LuminousIntensity` values and their `{ unit, value }`
 * encoding, with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LuminousIntensityFromStruct =
    Quantity.QuantityFromStruct(Candelas);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): LuminousIntensity<K> => Quantity.make(Candelas, value) as LuminousIntensity<K>;

/**
 * A `LuminousIntensity` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `LuminousIntensity` from a number of candelas.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const candelas = <N extends Quantity.Input>(n: N): LuminousIntensity<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `LuminousIntensity` to a number of candelas.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCandelas = <K extends Quantity.Value>(i: LuminousIntensity<K>): K =>
    i.value;
