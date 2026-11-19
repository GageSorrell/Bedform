/**
 * Acceleration quantities, stored in meters per second squared, with constructors
 * and conversions for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Acceleration` and `AccelerationExact` modules.
 *
 * @module @bedform/effect/Unit/Acceleration
 *
 * @file      Acceleration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Duration from "./Duration.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Speed from "./Speed.js";
import * as Unit from "./Unit.js";

/**
 * The type of the meters per second squared unit, composed from other units with
 * the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type MetersPerSecondSquared = Unit.Rate<
    Speed.MetersPerSecond,
    Duration.Seconds
>;

/**
 * The meters per second squared unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const MetersPerSecondSquared: MetersPerSecondSquared = Unit.rate(
    Speed.MetersPerSecond,
    Duration.Seconds
);

/**
 * A quantity measured in `MetersPerSecondSquared`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Acceleration<K extends Quantity.Value = number> = Quantity.Quantity<MetersPerSecondSquared, K>;

/**
 * The identity schema for `Acceleration` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Acceleration = Quantity.Quantity(MetersPerSecondSquared);

/**
 * The codec between `Acceleration` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const AccelerationFromStruct = Quantity.QuantityFromStruct(
    MetersPerSecondSquared
);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Acceleration<K> => Quantity.make(MetersPerSecondSquared, value) as Acceleration<K>;

/**
 * An `Acceleration` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `Acceleration` from a number of meters per second squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const metersPerSecondSquared = <N extends Quantity.Input>(n: N): Acceleration<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Acceleration` to a number of meters per second squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMetersPerSecondSquared = <K extends Quantity.Value>(a: Acceleration<K>): K =>
    a.value;

/**
 * Creates an `Acceleration` from a number of feet per second squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const feetPerSecondSquared = <N extends Quantity.Input>(n: N): Acceleration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerFoot)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerFoot));

/**
 * Converts an `Acceleration` to a number of feet per second squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFeetPerSecondSquared = <K extends Quantity.Value>(a: Acceleration<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / Constants.metersPerFoot
        : Numeric.divideExact(a.value, ConstantsExact.metersPerFoot)) as K;

/**
 * One gee is the standard acceleration due to gravity.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const gees = <N extends Quantity.Input>(n: N): Acceleration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.gee)
        : make(Numeric.multiplyExact(n, ConstantsExact.gee));

/**
 * Converts an `Acceleration` to a number of gees.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inGees = <K extends Quantity.Value>(a: Acceleration<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / Constants.gee
        : Numeric.divideExact(a.value, ConstantsExact.gee)) as K;
