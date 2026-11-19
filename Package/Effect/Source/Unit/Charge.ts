/**
 * Charge quantities, stored in coulombs, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Charge` and `ChargeExact` modules.
 *
 * @module @bedform/effect/Unit/Charge
 *
 * @file      Charge.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Coulombs` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Coulombs = "Coulombs";

/**
 * The `Coulombs` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Coulombs: Coulombs = "Coulombs";

/**
 * A quantity measured in `Coulombs`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Charge<K extends Quantity.Value = number> = Quantity.Quantity<Coulombs, K>;

/**
 * The identity schema for `Charge` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Charge = Quantity.Quantity(Coulombs);

/**
 * The codec between `Charge` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const ChargeFromStruct = Quantity.QuantityFromStruct(Coulombs);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Charge<K> => Quantity.make(Coulombs, value) as Charge<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/** One ampere hour is one ampere (a coulomb per second) for one hour. */
const coulombsPerAmpereHourExact = ConstantsExact.secondsPerHour;

/** One milliampere hour is exactly 18/5 (3.6) coulombs. */
const coulombsPerMilliampereHourExact = Prefix.toBase(
    "Milli",
    coulombsPerAmpereHourExact
);

/**
 * A `Charge` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Charge` from a number of coulombs.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const coulombs = <N extends Quantity.Input>(n: N): Charge<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Charge` to a number of coulombs.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCoulombs = <K extends Quantity.Value>(c: Charge<K>): K =>
    c.value;

/** One ampere hour is one ampere (a coulomb per second) for one hour. */
const coulombsPerAmpereHour = Constants.secondsPerHour;

/**
 * Creates a `Charge` from a number of ampere hours.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ampereHours = <N extends Quantity.Input>(n: N): Charge<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * coulombsPerAmpereHour)
        : make(Numeric.multiplyExact(n, coulombsPerAmpereHourExact));

/**
 * Converts a `Charge` to a number of ampere hours.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAmpereHours = <K extends Quantity.Value>(c: Charge<K>): K =>
    (Predicate.isNumber(c.value)
        ? c.value / coulombsPerAmpereHour
        : Numeric.divideExact(c.value, coulombsPerAmpereHourExact)) as K;

const coulombsPerMilliampereHour = Prefix.toBase(
    "Milli",
    coulombsPerAmpereHour
);

/**
 * Creates a `Charge` from a number of milliampere hours.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milliampereHours = <N extends Quantity.Input>(n: N): Charge<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * coulombsPerMilliampereHour)
        : make(Numeric.multiplyExact(n, coulombsPerMilliampereHourExact));

/**
 * Converts a `Charge` to a number of milliampere hours.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilliampereHours = <K extends Quantity.Value>(c: Charge<K>): K =>
    (Predicate.isNumber(c.value)
        ? c.value / coulombsPerMilliampereHour
        : Numeric.divideExact(c.value, coulombsPerMilliampereHourExact)) as K;
