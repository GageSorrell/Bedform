/**
 * Speed quantities, stored in meters per second, with constructors and conversions
 * for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Speed` and `SpeedExact` modules.
 *
 * @module @bedform/effect/Unit/Speed
 *
 * @file      Speed.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Duration from "./Duration.js";
import * as Length from "./Length.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the meters per second unit, composed from other units with the
 * `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type MetersPerSecond = Unit.Rate<Length.Meters, Duration.Seconds>;

/**
 * The meters per second unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const MetersPerSecond: MetersPerSecond = Unit.rate(
    Length.Meters,
    Duration.Seconds
);

/**
 * A quantity measured in `MetersPerSecond`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Speed<K extends Quantity.Value = number> = Quantity.Quantity<MetersPerSecond, K>;

/**
 * The identity schema for `Speed` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Speed = Quantity.Quantity(MetersPerSecond);

/**
 * The codec between `Speed` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const SpeedFromStruct = Quantity.QuantityFromStruct(MetersPerSecond);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Speed<K> => Quantity.make(MetersPerSecond, value) as Speed<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/** One kilometer per hour is exactly 5/18 meters per second. */
const metersPerSecondPerKilometerPerHourExact = BigRational.divideUnsafe(
    BigRational.makeUnsafe(1_000n),
    ConstantsExact.secondsPerHour
);

/** One mile per hour is exactly 1397/3125 (0.44704) meters per second. */
const metersPerSecondPerMilePerHourExact = BigRational.divideUnsafe(
    ConstantsExact.metersPerMile,
    ConstantsExact.secondsPerHour
);

/**
 * A `Speed` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Speed` from a number of meters per second.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const metersPerSecond = <N extends Quantity.Input>(n: N): Speed<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Speed` to a number of meters per second.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMetersPerSecond = <K extends Quantity.Value>(s: Speed<K>): K =>
    s.value;

const metersPerKilometer = Prefix.toBase("Kilo", 1);

const metersPerSecondPerKilometerPerHour =
    metersPerKilometer / Constants.secondsPerHour;

/**
 * Creates a `Speed` from a number of kilometers per hour.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilometersPerHour = <N extends Quantity.Input>(n: N): Speed<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerSecondPerKilometerPerHour)
        : make(Numeric.multiplyExact(n, metersPerSecondPerKilometerPerHourExact));

/**
 * Converts a `Speed` to a number of kilometers per hour.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilometersPerHour = <K extends Quantity.Value>(s: Speed<K>): K =>
    (Predicate.isNumber(s.value)
        ? s.value / metersPerSecondPerKilometerPerHour
        : Numeric.divideExact(s.value, metersPerSecondPerKilometerPerHourExact)) as K;

/**
 * Creates a `Speed` from a number of feet per second.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const feetPerSecond = <N extends Quantity.Input>(n: N): Speed<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerFoot)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerFoot));

/**
 * Converts a `Speed` to a number of feet per second.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFeetPerSecond = <K extends Quantity.Value>(s: Speed<K>): K =>
    (Predicate.isNumber(s.value)
        ? s.value / Constants.metersPerFoot
        : Numeric.divideExact(s.value, ConstantsExact.metersPerFoot)) as K;

/** One mile per hour is 0.44704 meters per second. */
const metersPerSecondPerMilePerHour =
    Constants.metersPerMile / Constants.secondsPerHour;

/**
 * Creates a `Speed` from a number of miles per hour.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milesPerHour = <N extends Quantity.Input>(n: N): Speed<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerSecondPerMilePerHour)
        : make(Numeric.multiplyExact(n, metersPerSecondPerMilePerHourExact));

/**
 * Converts a `Speed` to a number of miles per hour.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilesPerHour = <K extends Quantity.Value>(s: Speed<K>): K =>
    (Predicate.isNumber(s.value)
        ? s.value / metersPerSecondPerMilePerHour
        : Numeric.divideExact(s.value, metersPerSecondPerMilePerHourExact)) as K;
