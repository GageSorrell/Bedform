/**
 * Durations, stored in seconds, with conversions to and from
 * `@bedform/effect/Duration`.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Duration` and `DurationExact` modules.
 *
 * @module @bedform/effect/Unit/Duration
 *
 * @file      Duration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigDecimal from "../BigDecimal.js";
import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as EffectDuration from "../Duration.js";
import * as Numeric from "./Internal/numeric.js";
import * as Option from "../Option.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Rational from "../Rational.js";

/**
 * The type of the `Seconds` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Seconds = "Seconds";

/**
 * The `Seconds` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Seconds: Seconds = "Seconds";

/**
 * A quantity measured in `Seconds`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Duration<K extends Quantity.Value = number> = Quantity.Quantity<Seconds, K>;

/**
 * The identity schema for `Duration` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Duration = Quantity.Quantity(Seconds);

/**
 * The codec between `Duration` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const DurationFromStruct = Quantity.QuantityFromStruct(Seconds);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Duration<K> => Quantity.make(Seconds, value) as Duration<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const secondsPerDayExact = BigRational.multiply(
    BigRational.makeUnsafe(24n),
    ConstantsExact.secondsPerHour
);

const secondsPerWeekExact = BigRational.multiply(
    BigRational.makeUnsafe(7n),
    secondsPerDayExact
);

/** One Julian year is exactly 365.25 days. */
const secondsPerJulianYearExact = BigRational.multiply(
    BigRational.makeUnsafe(1_461n, 4n),
    secondsPerDayExact
);

const nanosecondsPerSecondExact = BigRational.makeUnsafe(1_000_000_000n);

/**
 * A `Duration` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Duration` from a number of seconds.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const seconds = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Duration` to a number of seconds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSeconds = <K extends Quantity.Value>(d: Duration<K>): K =>
    d.value;

/**
 * Creates a `Duration` from a number of milliseconds.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milliseconds = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    make(Prefix.toBase("Milli", n));

/**
 * Converts a `Duration` to a number of milliseconds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilliseconds = <K extends Quantity.Value>(d: Duration<K>): K =>
    Prefix.toPrefixed("Milli", d.value);

/**
 * Creates a `Duration` from a number of minutes.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const minutes = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.secondsPerMinute)
        : make(Numeric.multiplyExact(n, ConstantsExact.secondsPerMinute));

/**
 * Converts a `Duration` to a number of minutes.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMinutes = <K extends Quantity.Value>(d: Duration<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / Constants.secondsPerMinute
        : Numeric.divideExact(d.value, ConstantsExact.secondsPerMinute)) as K;

/**
 * Creates a `Duration` from a number of hours.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const hours = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.secondsPerHour)
        : make(Numeric.multiplyExact(n, ConstantsExact.secondsPerHour));

/**
 * Converts a `Duration` to a number of hours.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inHours = <K extends Quantity.Value>(d: Duration<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / Constants.secondsPerHour
        : Numeric.divideExact(d.value, ConstantsExact.secondsPerHour)) as K;

const secondsPerDay = 24 * Constants.secondsPerHour;

/**
 * Creates a `Duration` from a number of days.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const days = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * secondsPerDay)
        : make(Numeric.multiplyExact(n, secondsPerDayExact));

/**
 * Converts a `Duration` to a number of days.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDays = <K extends Quantity.Value>(d: Duration<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / secondsPerDay
        : Numeric.divideExact(d.value, secondsPerDayExact)) as K;

const secondsPerWeek = 7 * secondsPerDay;

/**
 * Creates a `Duration` from a number of weeks.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const weeks = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * secondsPerWeek)
        : make(Numeric.multiplyExact(n, secondsPerWeekExact));

/**
 * Converts a `Duration` to a number of weeks.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inWeeks = <K extends Quantity.Value>(d: Duration<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / secondsPerWeek
        : Numeric.divideExact(d.value, secondsPerWeekExact)) as K;

/** One Julian year is exactly 365.25 days. */
const secondsPerJulianYear = 365.25 * secondsPerDay;

/**
 * Creates a `Duration` from a number of Julian years.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const julianYears = <N extends Quantity.Input>(n: N): Duration<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * secondsPerJulianYear)
        : make(Numeric.multiplyExact(n, secondsPerJulianYearExact));

/**
 * Converts a `Duration` to a number of Julian years.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inJulianYears = <K extends Quantity.Value>(d: Duration<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / secondsPerJulianYear
        : Numeric.divideExact(d.value, secondsPerJulianYearExact)) as K;

// Interop

/**
 * Converts an `@bedform/effect/Duration` to a `Duration` quantity. Infinite durations
 * become `Infinity` seconds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromDuration = (duration: EffectDuration.Duration): Duration =>
    milliseconds(EffectDuration.toMillis(duration));

/**
 * Converts an `@bedform/effect/Duration` to an exact `Duration` quantity—
 * lossless, since a whole number of nanoseconds is an exact rational number
 * of seconds. Returns `Option.none()` for infinite durations, which have no
 * rational image.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromDurationBigRational = (
    duration: EffectDuration.Duration
): Option.Option<Duration<BigRational.BigRational>> =>
    Option.map(EffectDuration.toNanos(duration), (nanos: bigint) =>
        make(BigRational.makeUnsafe(nanos, 1_000_000_000n))
    );

/**
 * Converts a `Duration` quantity to an `@bedform/effect/Duration`. A float is
 * rounded to the nearest nanosecond, and returns `Option.none()` when it is
 * negative, not finite, or too large for a whole number of nanoseconds to be
 * representable. An exact value is rounded to a whole number of nanoseconds
 * under `options.mode` (by default `"half-from-zero"`)—exactly one rounding,
 * made explicit—and returns `Option.none()` when it is negative.
 * `@bedform/effect/Duration`s are non-negative.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toDuration = <K extends Quantity.Value>(
    d: Duration<K>,
    options?: { readonly mode?: BigDecimal.RoundingMode }
): Option.Option<EffectDuration.Duration> =>
{
    const value: Quantity.Value = d.value;
    if (Predicate.isNumber(value))
    {
        const nanos = value * 1e9;

        return Number.isFinite(nanos) && nanos >= 0
            ? Option.some(EffectDuration.nanos(BigInt(Math.round(nanos))))
            : Option.none();
    }

    const exact = Rational.isRational(value) ? Rational.toBigRational(value) : value;
    return BigRational.isNegative(exact)
        ? Option.none()
        : Option.some(
            EffectDuration.nanos(
                BigRational.round(BigRational.multiply(exact, nanosecondsPerSecondExact), options)
            )
        );
};
