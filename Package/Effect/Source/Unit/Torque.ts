/**
 * Torque quantities, stored in newton-meters, with constructors and conversions
 * for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Torque` and `TorqueExact` modules.
 *
 * @module @bedform/effect/Unit/Torque
 *
 * @file      Torque.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Force from "./Force.js";
import * as Length from "./Length.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the newton meters unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type NewtonMeters = Unit.Product<Force.Newtons, Length.Meters>;

/**
 * The newton meters unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const NewtonMeters: NewtonMeters = Unit.product(
    Force.Newtons,
    Length.Meters
);

/**
 * A quantity measured in `NewtonMeters`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Torque<K extends Quantity.Value = number> = Quantity.Quantity<NewtonMeters, K>;

/**
 * The identity schema for `Torque` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Torque = Quantity.Quantity(NewtonMeters);

/**
 * The codec between `Torque` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const TorqueFromStruct = Quantity.QuantityFromStruct(NewtonMeters);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Torque<K> => Quantity.make(NewtonMeters, value) as Torque<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/**
 * One pound foot is one pound of force times one foot—exactly
 * 3389544870828501/2500000000000000 (1.3558179483314004) newton meters.
 */
const newtonMetersPerPoundFootExact = BigRational.multiply(
    ConstantsExact.newtonsPerPoundForce,
    ConstantsExact.metersPerFoot
);

/**
 * A `Torque` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Torque` from a number of newton meters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const newtonMeters = <N extends Quantity.Input>(n: N): Torque<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Torque` to a number of newton meters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNewtonMeters = <K extends Quantity.Value>(t: Torque<K>): K =>
    t.value;

/** One pound foot is one pound of force times one foot. */
const newtonMetersPerPoundFoot =
    Constants.newtonsPerPoundForce * Constants.metersPerFoot;

/**
 * Creates a `Torque` from a number of pound feet.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const poundFeet = <N extends Quantity.Input>(n: N): Torque<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * newtonMetersPerPoundFoot)
        : make(Numeric.multiplyExact(n, newtonMetersPerPoundFootExact));

/**
 * Converts a `Torque` to a number of pound feet.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPoundFeet = <K extends Quantity.Value>(t: Torque<K>): K =>
    (Predicate.isNumber(t.value)
        ? t.value / newtonMetersPerPoundFoot
        : Numeric.divideExact(t.value, newtonMetersPerPoundFootExact)) as K;
