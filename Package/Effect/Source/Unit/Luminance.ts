/**
 * Luminance quantities, stored in nits, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Luminance` and `LuminanceExact` modules.
 *
 * @module @bedform/effect/Unit/Luminance
 *
 * @file      Luminance.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Area from "./Area.js";
import * as Constants from "./Internal/constants.js";
import * as LuminousIntensity from "./LuminousIntensity.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the nits unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Nits = Unit.Rate<LuminousIntensity.Candelas, Area.SquareMeters>;

/**
 * The nits unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Nits: Nits = Unit.rate(
    LuminousIntensity.Candelas,
    Area.SquareMeters
);

/**
 * A quantity measured in `Nits`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Luminance<K extends Quantity.Value = number> = Quantity.Quantity<Nits, K>;

/**
 * The identity schema for `Luminance` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Luminance = Quantity.Quantity(Nits);

/**
 * The codec between `Luminance` values and their `{ unit, value }` encoding, with
 * a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LuminanceFromStruct = Quantity.QuantityFromStruct(Nits);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Luminance<K> => Quantity.make(Nits, value) as Luminance<K>;

/**
 * A `Luminance` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Luminance` from a number of nits.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nits = <N extends Quantity.Input>(n: N): Luminance<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Luminance` to a number of nits.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNits = <K extends Quantity.Value>(l: Luminance<K>): K =>
    l.value;

/** One foot lambert is 1/π candelas per square foot. */
const nitsPerFootLambert =
    1 / (Math.PI * Constants.metersPerFoot * Constants.metersPerFoot);

/**
 * Creates a `Luminance` from a number of foot lamberts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const footLamberts = <N extends Quantity.Input>(n: N): Luminance =>
    Predicate.isNumber(n)
        ? make(n * nitsPerFootLambert)
        : make(Numeric.float(n) * nitsPerFootLambert);

/**
 * Converts a `Luminance` to a number of foot lamberts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFootLamberts = <K extends Quantity.Value>(l: Luminance<K>): number =>
    Numeric.toFloat(l.value) / nitsPerFootLambert;
