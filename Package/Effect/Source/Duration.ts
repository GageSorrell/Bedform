/**
 * Represents immutable spans of time.
 *
 * A `Duration` can be finite, positive infinity, or negative infinity. It is
 * the standard representation for delays, timeouts, intervals, and
 * time-to-live values across Effect APIs. This module includes constructors
 * from common input shapes, unit conversions, comparisons, arithmetic,
 * formatting, and reusable reducer or combiner helpers.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Duration
 *
 * @file      Duration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, prefer-rest-params, @stylistic/max-len */

import * as Combiner from "./Combiner.js";
import * as Equal from "./Equal.js";
import type * as Equ from "./Equivalence.js";
import { dual, identity } from "./Function.js";
import * as Hash from "./Hash.js";
import type * as Inspectable from "./Inspectable.js";
import { NodeInspectSymbol } from "./Inspectable.js";
import * as Option from "./Option.js";
import * as order from "./Order.js";
import type { Pipeable } from "./Pipeable.js";
import { pipeArguments } from "./Pipeable.js";
import { hasProperty, isNumber } from "./Predicate.js";
import * as Reducer from "./Reducer.js";

const TypeId = "~effect/Duration";

const Bigint0 = BigInt(0);
const Bigint1 = BigInt(1);
const Bigint2 = BigInt(2);
const Bigint10 = BigInt(10);
const Bigint24 = BigInt(24);
const Bigint60 = BigInt(60);
const Bigint1e3 = BigInt(1_000);
const Bigint1e6 = BigInt(1_000_000);
const Bigint1e9 = BigInt(1_000_000_000);

const RoundTiesAwayFromZero = (input: number): bigint => BigInt(Math.sign(input) * Math.round(Math.abs(input)));

const RoundMillisToNanos = (millis: number): bigint =>
    Number.isInteger(millis) ? BigInt(millis) * Bigint1e6 : RoundTiesAwayFromZero(millis * 1_000_000);

const FromNanosNumber = (nanos: number): Duration => Make(Number.isFinite(nanos) ? RoundTiesAwayFromZero(nanos) : nanos);

const ParseNanos = (input: string, scale: bigint): bigint =>
{
    const DecimalIndex = input.indexOf(".");
    if (DecimalIndex === -1) {return BigInt(input) * scale;}

    const IsNegative = input[0] === "-";
    const FractionalValue = input.slice(DecimalIndex + 1);
    const FractionalScale = Bigint10 ** BigInt(FractionalValue.length);
    const Scaled = (
        BigInt(input.slice(IsNegative ? 1 : 0, DecimalIndex)) * FractionalScale + BigInt(FractionalValue)
    ) * scale;
    return DivideTiesAwayFromZero(IsNegative ? -Scaled : Scaled, FractionalScale);
};

const DivideTiesAwayFromZero = (numerator: bigint, denominator: bigint): bigint =>
{
    const Absolute = numerator < Bigint0 ? -numerator : numerator;
    const Rounded = Absolute / denominator + (Absolute % denominator * Bigint2 >= denominator ? Bigint1 : Bigint0);
    return numerator < Bigint0 ? -Rounded : Rounded;
};

const NanosToHrTime = (nanos: bigint): [seconds: number, nanos: number] =>
{
    const Sign = nanos < Bigint0 ? -Bigint1 : Bigint1;
    const AbsoluteValue = nanos < Bigint0 ? -nanos : nanos;
    return [
        Number(Sign * (AbsoluteValue / Bigint1e9)),
        Number(Sign * (AbsoluteValue % Bigint1e9))
    ];
};

/**
 * Represents a span of time with high precision, supporting operations from
 * nanoseconds to weeks.
 *
 * **When to use**
 *
 * Use to model elapsed time, delays, timeouts, schedule intervals, and cache
 * TTLs as immutable duration values.
 *
 * @see {@link Input} for values accepted by APIs that decode duration-like
 * inputs
 * @see {@link DurationValue} for the tagged representation exposed by the
 * `value` field
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface Duration extends Equal.Equal, Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId
    readonly value: DurationValue
}

/**
 * Tagged representation of a `Duration` value.
 *
 * **When to use**
 *
 * Use when modeling or inspecting the exact tagged representation stored in a
 * `Duration`, including finite millisecond or nanosecond values and infinite
 * sentinels.
 *
 * **Details**
 *
 * A duration is represented as milliseconds, nanoseconds, positive infinity,
 * or negative infinity.
 *
 * @see {@link Duration} for the public type whose `value` field contains this
 * representation
 * @see {@link match} for pattern matching without reading `value` directly
 *
 * @category Utilities
 * @since 1.0.0
 */
export type DurationValue =
  | { _tag: "Millis";
      millis: number }
  | { _tag: "Nanos";
      nanos: bigint }
  | { _tag: "Infinity" }
  | { _tag: "NegativeInfinity" };

/**
 * Valid time units that can be used in duration string representations.
 *
 * **When to use**
 *
 * Use when typing the unit portion of duration string inputs accepted by
 * `Duration.Input`.
 *
 * @see {@link Input} for the full duration input union
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Unit =
  | "nano"
  | "nanos"
  | "micro"
  | "micros"
  | "milli"
  | "millis"
  | "second"
  | "seconds"
  | "minute"
  | "minutes"
  | "hour"
  | "hours"
  | "day"
  | "days"
  | "week"
  | "weeks";

/**
 * Valid input types that can be converted to a Duration.
 *
 * **When to use**
 *
 * Use when an API should accept any value that Effect can convert into a
 * `Duration`, including existing durations, millisecond numbers, nanosecond
 * bigints, high-resolution tuples, duration strings, infinity strings, or
 * duration objects.
 *
 * **Details**
 *
 * String inputs accept values like `"10 seconds"`, `"500 millis"`,
 * `"Infinity"`, and `"-Infinity"`. Finite fractional values that are
 * normalized to nanoseconds are rounded to the nearest nanosecond, with ties
 * away from zero.
 *
 * @see {@link fromInput} for safe conversion to `Option`
 * @see {@link fromInputUnsafe} for throwing conversion
 * @see {@link DurationObject} for object-shaped duration input
 * @see {@link Unit} for supported string units
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Input =
  | Duration
  | number // millis
  | bigint // nanos
  | readonly [seconds: number, nanos: number]
  | `${number} ${Unit}`
  | "Infinity"
  | "-Infinity"
  | DurationObject;

/**
 * An object with optional duration components that can be combined to create
 * a Duration. All fields are optional and additive.
 *
 * **Details**
 *
 * Compatible with Temporal.Duration-like objects.
 *
 * **Example** (Combining duration object fields)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.fromInputUnsafe({ seconds: 30 }) // => Duration.seconds(30)
 * Duration.fromInputUnsafe({ days: 1 }) // => Duration.days(1)
 * Duration.fromInputUnsafe({ seconds: 1, nanoseconds: 500 }) // => Duration.nanos(1_000_000_500n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface DurationObject
{
    readonly weeks?: number | undefined
    readonly days?: number | undefined
    readonly hours?: number | undefined
    readonly minutes?: number | undefined
    readonly seconds?: number | undefined
    readonly milliseconds?: number | undefined
    readonly microseconds?: number | undefined
    readonly nanoseconds?: number | undefined
}

const DurationRegexp = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;

/**
 * Decodes a `Duration.Input` into a `Duration`.
 *
 * **When to use**
 *
 * Use when the input has already been validated or comes from a trusted source
 * and throwing is acceptable for invalid duration syntax.
 *
 * **Gotchas**
 *
 * If the input is not a valid `Duration.Input`, it throws an error.
 *
 * **Example** (Decoding duration inputs)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.fromInputUnsafe(1000) // => Duration.millis(1000)
 * Duration.fromInputUnsafe("5 seconds") // => Duration.seconds(5)
 * Duration.fromInputUnsafe("Infinity") // => Duration.infinity
 * Duration.fromInputUnsafe([2, 500_000_000]) // => Duration.nanos(2_500_000_000n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromInputUnsafe = (input: Input): Duration =>
{
    switch (typeof input)
    {
        case "number":
            return millis(input);
        case "bigint":
            return nanos(input);
        case "string": {
            if (input === "Infinity")
            {
                return infinity;
            }

            if (input === "-Infinity")
            {
                return negativeInfinity;
            }

            const Match = DurationRegexp.exec(input);
            if (!Match) {break;}

            const [ _, ValueStr, UnitValue ] = Match;
            if (UnitValue === "nano" || UnitValue === "nanos")
            {
                return nanos(ParseNanos(ValueStr, Bigint1));
            }

            if (UnitValue === "micro" || UnitValue === "micros")
            {
                return nanos(ParseNanos(ValueStr, Bigint1e3));
            }

            const Value = Number(ValueStr);
            switch (UnitValue)
            {
                case "milli":
                case "millis":
                    return millis(Value);
                case "second":
                case "seconds":
                    return seconds(Value);
                case "minute":
                case "minutes":
                    return minutes(Value);
                case "hour":
                case "hours":
                    return hours(Value);
                case "day":
                case "days":
                    return days(Value);
                case "week":
                case "weeks":
                    return weeks(Value);
            }

            break;
        }

        case "object": {
            if (input === null) {break;}

            if (TypeId in input) {return input as Duration;}

            if (Array.isArray(input))
            {
                if (input.length !== 2 || !input.every(isNumber))
                {
                    return InvalidValue(input);
                }

                if (Number.isNaN(input[0]) || Number.isNaN(input[1]))
                {
                    return zero;
                }

                if (input[0] === -Infinity || input[1] === -Infinity)
                {
                    return negativeInfinity;
                }

                if (input[0] === Infinity || input[1] === Infinity)
                {
                    return infinity;
                }

                return FromNanosNumber(input[0] * 1_000_000_000 + input[1]);
            }

            const Obj = input as DurationObject;
            let millis = 0;
            // we can use truthy checks here, because 0 can be ignored
            if (Obj.weeks) {millis += Obj.weeks * 604_800_000;}

            if (Obj.days) {millis += Obj.days * 86_400_000;}

            if (Obj.hours) {millis += Obj.hours * 3_600_000;}

            if (Obj.minutes) {millis += Obj.minutes * 60_000;}

            if (Obj.seconds) {millis += Obj.seconds * 1_000;}

            if (Obj.milliseconds) {millis += Obj.milliseconds;}

            if (!Obj.microseconds && !Obj.nanoseconds) {return Make(millis);}

            return FromNanosNumber(millis * 1_000_000 + (Obj.microseconds ?? 0) * 1_000 + (Obj.nanoseconds ?? 0));
        }
    }

    return InvalidValue(input);
};

const InvalidValue = (input: unknown): never =>
{
    throw new Error(`Invalid Input: ${input}`);
};

/**
 * Decodes a `Input` value into a `Duration` safely, returning
 * `Option.none()` if decoding fails.
 *
 * **Example** (Safely decoding duration inputs)
 *
 * ```ts import.meta.vitest
 * import { Duration, Option } from "effect"
 *
 * Duration.fromInput(1000) // => Option.some(Duration.seconds(1))
 * Duration.fromInput("invalid" as any) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromInput: (u: Input) => Option.Option<Duration> = Option.liftThrowable(
    fromInputUnsafe
);

const ZeroDurationValue: DurationValue = { _tag: "Millis",
    millis: 0 };
const InfinityDurationValue: DurationValue = { _tag: "Infinity" };
const NegativeInfinityDurationValue: DurationValue = { _tag: "NegativeInfinity" };

const DurationProto: Omit<Duration, "value"> = {
    [TypeId]: TypeId,
    [Hash.symbol](this: Duration)
    {
    // Hash equal finite durations using the same canonical nanoseconds
    // representation used by `equals`.
        switch (this.value._tag)
        {
            case "Millis":
                return Hash.hash(RoundMillisToNanos(this.value.millis));
            case "Nanos":
                return Hash.hash(this.value.nanos);
            default:
                return Hash.structure(this.value);
        }
    },
    [Equal.symbol](this: Duration, that: unknown): boolean
    {
        return isDuration(that) && equals(this, that);
    },
    toString(this: Duration)
    {
        switch (this.value._tag)
        {
            case "Infinity":
                return "Infinity";
            case "NegativeInfinity":
                return "-Infinity";
            case "Nanos":
                return `${this.value.nanos} nanos`;
            case "Millis":
                return `${this.value.millis} millis`;
        }
    },
    toJSON(this: Duration)
    {
        switch (this.value._tag)
        {
            case "Millis":
                return { _id: "Duration",
                    _tag: "Millis",
                    millis: this.value.millis };
            case "Nanos":
                return { _id: "Duration",
                    _tag: "Nanos",
                    nanos: String(this.value.nanos) };
            case "Infinity":
                return { _id: "Duration",
                    _tag: "Infinity" };
            case "NegativeInfinity":
                return { _id: "Duration",
                    _tag: "NegativeInfinity" };
        }
    },
    [NodeInspectSymbol]()
    {
        return this.toJSON();
    },
    pipe()
    {
        return pipeArguments(this, arguments);
    }
} as const;

const Make = (input: number | bigint): Duration =>
{
    const DurationValueValue = Object.create(DurationProto);
    if (typeof input === "number")
    {
        if (isNaN(input) || input === 0 || Object.is(input, -0))
        {
            DurationValueValue.value = ZeroDurationValue;
        }
        else if (!Number.isFinite(input))
        {
            DurationValueValue.value = input > 0 ? InfinityDurationValue : NegativeInfinityDurationValue;
        }
        else if (!Number.isInteger(input))
        {
            DurationValueValue.value = { _tag: "Nanos",
                nanos: RoundMillisToNanos(input) };
        }
        else
        {
            DurationValueValue.value = { _tag: "Millis",
                millis: input };
        }
    }
    else if (input === Bigint0)
    {
        DurationValueValue.value = ZeroDurationValue;
    }
    else
    {
        DurationValueValue.value = { _tag: "Nanos",
            nanos: input };
    }

    return DurationValueValue;
};

/**
 * Checks whether a value is a Duration.
 *
 * **Example** (Checking for durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isDuration(Duration.seconds(1)) // => true
 * Duration.isDuration(1000) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isDuration = (u: unknown): u is Duration => hasProperty(u, TypeId);

/**
 * Checks whether a Duration is finite (not infinite).
 *
 * **Example** (Checking finite durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isFinite(Duration.seconds(5)) // => true
 * Duration.isFinite(Duration.infinity) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isFinite = (self: Duration): boolean =>
    self.value._tag !== "Infinity" && self.value._tag !== "NegativeInfinity";

/**
 * Checks whether a Duration is zero.
 *
 * **Example** (Checking for zero durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isZero(Duration.zero) // => true
 * Duration.isZero(Duration.seconds(1)) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isZero = (self: Duration): boolean =>
{
    switch (self.value._tag)
    {
        case "Millis":
            return self.value.millis === 0;
        case "Nanos":
            return self.value.nanos === Bigint0;
        case "Infinity":
        case "NegativeInfinity":
            return false;
    }
};

/**
 * Returns `true` if the duration is negative (strictly less than zero).
 *
 * **Example** (Checking for negative durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isNegative(Duration.seconds(-5)) // => true
 * Duration.isNegative(Duration.zero) // => false
 * Duration.isNegative(Duration.negativeInfinity) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isNegative = (self: Duration): boolean =>
{
    switch (self.value._tag)
    {
        case "Millis":
            return self.value.millis < 0;
        case "Nanos":
            return self.value.nanos < Bigint0;
        case "NegativeInfinity":
            return true;
        case "Infinity":
            return false;
    }
};

/**
 * Returns `true` if the duration is positive (strictly greater than zero).
 *
 * **Example** (Checking for positive durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isPositive(Duration.seconds(5)) // => true
 * Duration.isPositive(Duration.zero) // => false
 * Duration.isPositive(Duration.infinity) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isPositive = (self: Duration): boolean =>
{
    switch (self.value._tag)
    {
        case "Millis":
            return self.value.millis > 0;
        case "Nanos":
            return self.value.nanos > Bigint0;
        case "Infinity":
            return true;
        case "NegativeInfinity":
            return false;
    }
};

/**
 * Returns the absolute value of the duration.
 *
 * **Example** (Taking absolute duration values)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.abs(Duration.seconds(-5)) // => Duration.seconds(5)
 * Duration.abs(Duration.negativeInfinity) // => Duration.infinity
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const abs = (self: Duration): Duration =>
{
    switch (self.value._tag)
    {
        case "Infinity":
        case "NegativeInfinity":
            return infinity;
        case "Millis":
            return self.value.millis < 0 ? Make(-self.value.millis) : self;
        case "Nanos":
            return self.value.nanos < Bigint0 ? Make(-self.value.nanos) : self;
    }
};

/**
 * Returns the negated duration.
 *
 * **Example** (Negating durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.negate(Duration.seconds(5)) // => Duration.seconds(-5)
 * Duration.negate(Duration.infinity) // => Duration.negativeInfinity
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const negate = (self: Duration): Duration =>
{
    switch (self.value._tag)
    {
        case "Infinity":
            return negativeInfinity;
        case "NegativeInfinity":
            return infinity;
        case "Millis":
            return self.value.millis === 0 ? self : Make(-self.value.millis);
        case "Nanos":
            return self.value.nanos === Bigint0 ? self : Make(-self.value.nanos);
    }
};

/**
 * A Duration representing zero time.
 *
 * **Example** (Referencing the zero duration)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.zero) // => 0
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zero: Duration = Make(0);

/**
 * A Duration representing infinite time.
 *
 * **Example** (Referencing infinite duration)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.infinity) // => Infinity
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const infinity: Duration = Make(Infinity);

/**
 * A Duration representing negative infinite time.
 *
 * **Example** (Referencing negative infinite duration)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.negativeInfinity) // => -Infinity
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const negativeInfinity: Duration = Make(-Infinity);

/**
 * Creates a Duration from nanoseconds.
 *
 * **Example** (Creating durations from nanoseconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.nanos(500_000_000n) // => Duration.nanos(500_000_000n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const nanos = (nanos: bigint): Duration => Make(nanos);

/**
 * Creates a Duration from microseconds.
 *
 * **Example** (Creating durations from microseconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.micros(500_000n) // => Duration.nanos(500_000_000n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const micros = (micros: bigint): Duration => Make(micros * Bigint1e3);

/**
 * Creates a Duration from milliseconds.
 *
 * **Example** (Creating durations from milliseconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.millis(1000)) // => 1000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const millis = (millis: number): Duration => Make(millis);

/**
 * Creates a Duration from seconds.
 *
 * **Example** (Creating durations from seconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.seconds(30)) // => 30_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const seconds = (seconds: number): Duration => Make(seconds * 1_000);

/**
 * Creates a Duration from minutes.
 *
 * **Example** (Creating durations from minutes)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.minutes(5)) // => 300_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const minutes = (minutes: number): Duration => Make(minutes * 60_000);

/**
 * Creates a Duration from hours.
 *
 * **Example** (Creating durations from hours)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.hours(2)) // => 7_200_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const hours = (hours: number): Duration => Make(hours * 3_600_000);

/**
 * Creates a Duration from days.
 *
 * **Example** (Creating durations from days)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.days(1)) // => 86_400_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const days = (days: number): Duration => Make(days * 86_400_000);

/**
 * Creates a Duration from weeks.
 *
 * **Example** (Creating durations from weeks)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.weeks(1)) // => 604_800_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const weeks = (weeks: number): Duration => Make(weeks * 604_800_000);

/**
 * Converts a Duration to milliseconds.
 *
 * **Example** (Converting durations to milliseconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMillis(Duration.seconds(5)) // => 5000
 * Duration.toMillis(Duration.minutes(2)) // => 120_000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toMillis = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: identity,
        onNanos: (nanos) => Number(nanos) / 1_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Converts a Duration to seconds.
 *
 * **Example** (Converting durations to seconds)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toSeconds(Duration.millis(5000)) // => 5
 * Duration.toSeconds(Duration.minutes(2)) // => 120
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toSeconds = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: (millis) => millis / 1_000,
        onNanos: (nanos) => Number(nanos) / 1_000_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Converts a Duration to minutes.
 *
 * **Example** (Converting durations to minutes)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toMinutes(Duration.seconds(120)) // => 2
 * Duration.toMinutes(Duration.hours(1)) // => 60
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toMinutes = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: (millis) => millis / 60_000,
        onNanos: (nanos) => Number(nanos) / 60_000_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Converts a Duration to hours.
 *
 * **Example** (Converting durations to hours)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toHours(Duration.minutes(120)) // => 2
 * Duration.toHours(Duration.days(1)) // => 24
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toHours = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: (millis) => millis / 3_600_000,
        onNanos: (nanos) => Number(nanos) / 3_600_000_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Converts a Duration to days.
 *
 * **Example** (Converting durations to days)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toDays(Duration.hours(48)) // => 2
 * Duration.toDays(Duration.weeks(1)) // => 7
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toDays = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: (millis) => millis / 86_400_000,
        onNanos: (nanos) => Number(nanos) / 86_400_000_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Converts a Duration to weeks.
 *
 * **Example** (Converting durations to weeks)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toWeeks(Duration.days(14)) // => 2
 * Duration.toWeeks(Duration.days(7)) // => 1
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toWeeks = (self: Input): number =>
    match(fromInputUnsafe(self), {
        onMillis: (millis) => millis / 604_800_000,
        onNanos: (nanos) => Number(nanos) / 604_800_000_000_000,
        onInfinity: () => Infinity,
        onNegativeInfinity: () => -Infinity
    });

/**
 * Gets the duration in nanoseconds as a bigint.
 *
 * **When to use**
 *
 * Use when the duration is known to be finite and you need the nanosecond value
 * as a `bigint`.
 *
 * **Details**
 *
 * Millisecond-backed fractional durations are rounded to the nearest
 * nanosecond, with ties away from zero.
 *
 * **Gotchas**
 *
 * If the duration is infinite, it throws an error.
 *
 * **Example** (Reading nanoseconds unsafely)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toNanosUnsafe(Duration.seconds(2)) // => 2_000_000_000n
 *
 * // Duration.toNanosUnsafe(Duration.infinity)
 * // throws Error: "Cannot convert infinite duration to nanos"
 * ```
 *
 * @throws { Error } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toNanosUnsafe = (input: Input): bigint =>
{
    const Self = fromInputUnsafe(input);
    switch (Self.value._tag)
    {
        case "Infinity":
        case "NegativeInfinity":
            throw new Error("Cannot convert infinite duration to nanos");
        case "Nanos":
            return Self.value.nanos;
        case "Millis":
            return RoundMillisToNanos(Self.value.millis);
    }
};

/**
 * Gets the duration in nanoseconds safely as an `Option<bigint>`.
 *
 * **Details**
 *
 * If the duration is infinite, returns `Option.none()`.
 *
 * **Example** (Safely reading nanoseconds)
 *
 * ```ts import.meta.vitest
 * import { Duration, Option } from "effect"
 *
 * Duration.toNanos(Duration.seconds(1)) // => Option.some(1_000_000_000n)
 * Duration.toNanos(Duration.infinity) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toNanos: (self: Input) => Option.Option<bigint> = Option.liftThrowable(toNanosUnsafe);

/**
 * Converts a Duration to high-resolution time format [seconds, nanoseconds].
 *
 * **Example** (Converting durations to high-resolution time)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.toHrTime(Duration.millis(1500)) // => [1, 500_000_000]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toHrTime = (input: Input): [seconds: number, nanos: number] =>
{
    const SelfValue = fromInputUnsafe(input);
    switch (SelfValue.value._tag)
    {
        case "Infinity":
            return [ Infinity, 0 ];
        case "NegativeInfinity":
            return [ -Infinity, 0 ];
        case "Nanos":
            return NanosToHrTime(SelfValue.value.nanos);
        case "Millis":
            return NanosToHrTime(RoundMillisToNanos(SelfValue.value.millis));
    }
};

/**
 * Pattern matches on the representation of a `Duration`.
 *
 * **Details**
 *
 * Provide handlers for millisecond-backed values, nanosecond-backed values,
 * and positive infinity. Use `onNegativeInfinity` to handle negative infinity
 * separately; otherwise negative infinity is handled by `onInfinity`.
 *
 * **Example** (Pattern matching on duration representations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.match(Duration.seconds(5), {
 *   onMillis: (millis) => `${millis} milliseconds`,
 *   onNanos: (nanos) => `${nanos} nanoseconds`,
 *   onInfinity: () => "infinite"
 * }) // => "5000 milliseconds"
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const match: {
    /**
     * Pattern matches on the representation of a `Duration`.
     *
     * **Details**
     *
     * Provide handlers for millisecond-backed values, nanosecond-backed values,
     * and positive infinity. Use `onNegativeInfinity` to handle negative infinity
     * separately; otherwise negative infinity is handled by `onInfinity`.
     *
     * **Example** (Pattern matching on duration representations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.match(Duration.seconds(5), {
     *   onMillis: (millis) => `${millis} milliseconds`,
     *   onNanos: (nanos) => `${nanos} nanoseconds`,
     *   onInfinity: () => "infinite"
     * }) // => "5000 milliseconds"
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C, D = C>(
        options: {
            readonly onMillis: (millis: number) => A
            readonly onNanos: (nanos: bigint) => B
            readonly onInfinity: () => C
            readonly onNegativeInfinity?: () => D
        }
    ): (self: Duration) => A | B | C | D

    /**
     * Pattern matches on the representation of a `Duration`.
     *
     * **Details**
     *
     * Provide handlers for millisecond-backed values, nanosecond-backed values,
     * and positive infinity. Use `onNegativeInfinity` to handle negative infinity
     * separately; otherwise negative infinity is handled by `onInfinity`.
     *
     * **Example** (Pattern matching on duration representations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.match(Duration.seconds(5), {
     *   onMillis: (millis) => `${millis} milliseconds`,
     *   onNanos: (nanos) => `${nanos} nanoseconds`,
     *   onInfinity: () => "infinite"
     * }) // => "5000 milliseconds"
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C, D = C>(
        self: Duration,
        options: {
            readonly onMillis: (millis: number) => A
            readonly onNanos: (nanos: bigint) => B
            readonly onInfinity: () => C
            readonly onNegativeInfinity?: () => D
        }
    ): A | B | C | D
} = dual(2, <A, B, C, D = C>(
    self: Duration,
    options: {
        readonly onMillis: (millis: number) => A
        readonly onNanos: (nanos: bigint) => B
        readonly onInfinity: () => C
        readonly onNegativeInfinity?: () => D
    }
): A | B | C | D =>
{
    switch (self.value._tag)
    {
        case "Millis":
            return options.onMillis(self.value.millis);
        case "Nanos":
            return options.onNanos(self.value.nanos);
        case "Infinity":
            return options.onInfinity();
        case "NegativeInfinity":
            return (options.onNegativeInfinity ?? options.onInfinity as unknown as () => D)();
    }
});

/**
 * Pattern matches on two `Duration`s, providing handlers that receive both values.
 *
 * **Example** (Pattern matching on duration pairs)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.matchPair(Duration.seconds(3), Duration.seconds(2), {
 *   onMillis: (a, b) => a + b,
 *   onNanos: (a, b) => Number(a + b),
 *   onInfinity: () => Infinity
 * }) // => 5000
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const matchPair: {
    /**
     * Pattern matches on two `Duration`s, providing handlers that receive both values.
     *
     * **Example** (Pattern matching on duration pairs)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.matchPair(Duration.seconds(3), Duration.seconds(2), {
     *   onMillis: (a, b) => a + b,
     *   onNanos: (a, b) => Number(a + b),
     *   onInfinity: () => Infinity
     * }) // => 5000
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C>(
        that: Duration,
        options: {
            readonly onMillis: (self: number, that: number) => A
            readonly onNanos: (self: bigint, that: bigint) => B
            readonly onInfinity: (self: Duration, that: Duration) => C
        }
    ): (self: Duration) => A | B | C

    /**
     * Pattern matches on two `Duration`s, providing handlers that receive both values.
     *
     * **Example** (Pattern matching on duration pairs)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.matchPair(Duration.seconds(3), Duration.seconds(2), {
     *   onMillis: (a, b) => a + b,
     *   onNanos: (a, b) => Number(a + b),
     *   onInfinity: () => Infinity
     * }) // => 5000
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C>(
        self: Duration,
        that: Duration,
        options: {
            readonly onMillis: (self: number, that: number) => A
            readonly onNanos: (self: bigint, that: bigint) => B
            readonly onInfinity: (self: Duration, that: Duration) => C
        }
    ): A | B | C
} = dual(3, <A, B, C>(
    self: Duration,
    that: Duration,
    options: {
        readonly onMillis: (self: number, that: number) => A
        readonly onNanos: (self: bigint, that: bigint) => B
        readonly onInfinity: (self: Duration, that: Duration) => C
    }
): A | B | C =>
{
    if (
        self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" ||
    that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity"
    ) {return options.onInfinity(self, that);}

    if (self.value._tag === "Millis")
    {
        return that.value._tag === "Millis"
            ? options.onMillis(self.value.millis, that.value.millis)
            : options.onNanos(toNanosUnsafe(self), that.value.nanos);
    }
    else
    {
        return options.onNanos(self.value.nanos, toNanosUnsafe(that));
    }
});

/**
 * Provides an `Order` instance for comparing `Duration` values.
 *
 * **Details**
 *
 * `NegativeInfinity` < any finite value < `Infinity`.
 *
 * **Example** (Sorting durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * const durations = [
 *   Duration.seconds(3),
 *   Duration.seconds(1),
 *   Duration.seconds(2)
 * ]
 * durations.sort((a, b) => Duration.Order(a, b)).map(Duration.toSeconds) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Order: order.Order<Duration> = order.make((self, that) =>
    matchPair(self, that, {
        onMillis: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
        onNanos: (self, that) => (self < that ? -1 : self > that ? 1 : 0),
        onInfinity: (self, that) =>
        {
            if (self.value._tag === that.value._tag) {return 0;}

            if (self.value._tag === "Infinity") {return 1;}

            if (self.value._tag === "NegativeInfinity") {return -1;}

            // self is finite
            if (that.value._tag === "Infinity") {return -1;}

            // that is NegativeInfinity
            return 1;
        }
    })
);

/**
 * Returns `true` if a `Duration` is greater than or equal to `minimum` and
 * less than or equal to `maximum`, according to `Duration.Order`.
 *
 * **When to use**
 *
 * Use to test whether a duration is inside an inclusive range.
 *
 * **Details**
 *
 * Both bounds are inclusive and compared with `Duration.Order`.
 *
 * **Gotchas**
 *
 * The bounds are not normalized. If `minimum` is greater than `maximum`, the
 * predicate returns `false` for every duration.
 *
 * **Example** (Checking duration ranges)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.between(Duration.seconds(3), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * }) // => true
 * ```
 *
 * @see {@link clamp} for constraining a duration to a range
 * @see {@link isGreaterThanOrEqualTo} for checking only the lower bound
 * @see {@link isLessThanOrEqualTo} for checking only the upper bound
 *
 * @category Utilities
 * @since 1.0.0
 */
export const between: {
    /**
     * Returns `true` if a `Duration` is greater than or equal to `minimum` and
     * less than or equal to `maximum`, according to `Duration.Order`.
     *
     * **When to use**
     *
     * Use to test whether a duration is inside an inclusive range.
     *
     * **Details**
     *
     * Both bounds are inclusive and compared with `Duration.Order`.
     *
     * **Gotchas**
     *
     * The bounds are not normalized. If `minimum` is greater than `maximum`, the
     * predicate returns `false` for every duration.
     *
     * **Example** (Checking duration ranges)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.between(Duration.seconds(3), {
     *   minimum: Duration.seconds(2),
     *   maximum: Duration.seconds(5)
     * }) // => true
     * ```
     *
     * @see {@link clamp} for constraining a duration to a range
     * @see {@link isGreaterThanOrEqualTo} for checking only the lower bound
     * @see {@link isLessThanOrEqualTo} for checking only the upper bound
     *
     * @category Utilities
     * @since 1.0.0
     */
    (options: { minimum: Duration;
        maximum: Duration }): (self: Duration) => boolean

    /**
     * Returns `true` if a `Duration` is greater than or equal to `minimum` and
     * less than or equal to `maximum`, according to `Duration.Order`.
     *
     * **When to use**
     *
     * Use to test whether a duration is inside an inclusive range.
     *
     * **Details**
     *
     * Both bounds are inclusive and compared with `Duration.Order`.
     *
     * **Gotchas**
     *
     * The bounds are not normalized. If `minimum` is greater than `maximum`, the
     * predicate returns `false` for every duration.
     *
     * **Example** (Checking duration ranges)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.between(Duration.seconds(3), {
     *   minimum: Duration.seconds(2),
     *   maximum: Duration.seconds(5)
     * }) // => true
     * ```
     *
     * @see {@link clamp} for constraining a duration to a range
     * @see {@link isGreaterThanOrEqualTo} for checking only the lower bound
     * @see {@link isLessThanOrEqualTo} for checking only the upper bound
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, options: { minimum: Duration;
        maximum: Duration }): boolean
} = order.isBetween(Order);

/**
 * Provides an `Equivalence` instance for comparing `Duration` values.
 *
 * **Example** (Comparing durations for equivalence)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.Equivalence(Duration.seconds(5), Duration.millis(5000)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<Duration> = (self, that) =>
    matchPair(self, that, {
        onMillis: (self, that) => self === that,
        onNanos: (self, that) => self === that,
        onInfinity: (self, that) => self.value._tag === that.value._tag
    });

/**
 * Returns the smaller of two Durations.
 *
 * **Example** (Selecting the shorter duration)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.min(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(3)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const min: {
    /**
     * Returns the smaller of two Durations.
     *
     * **Example** (Selecting the shorter duration)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.min(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(3)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => Duration

    /**
     * Returns the smaller of two Durations.
     *
     * **Example** (Selecting the shorter duration)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.min(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(3)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): Duration
} = order.min(Order);

/**
 * Returns the larger of two Durations.
 *
 * **Example** (Selecting the longer duration)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.max(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(5)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const max: {
    /**
     * Returns the larger of two Durations.
     *
     * **Example** (Selecting the longer duration)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.max(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(5)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => Duration

    /**
     * Returns the larger of two Durations.
     *
     * **Example** (Selecting the longer duration)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.max(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(5)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): Duration
} = order.max(Order);

/**
 * Returns a `Duration` constrained between a minimum and maximum value.
 *
 * **Example** (Clamping durations to a range)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.clamp(Duration.seconds(10), {
 *   minimum: Duration.seconds(2),
 *   maximum: Duration.seconds(5)
 * }) // => Duration.seconds(5)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const clamp: {
    /**
     * Returns a `Duration` constrained between a minimum and maximum value.
     *
     * **Example** (Clamping durations to a range)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.clamp(Duration.seconds(10), {
     *   minimum: Duration.seconds(2),
     *   maximum: Duration.seconds(5)
     * }) // => Duration.seconds(5)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (options: { minimum: Duration;
        maximum: Duration }): (self: Duration) => Duration

    /**
     * Returns a `Duration` constrained between a minimum and maximum value.
     *
     * **Example** (Clamping durations to a range)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.clamp(Duration.seconds(10), {
     *   minimum: Duration.seconds(2),
     *   maximum: Duration.seconds(5)
     * }) // => Duration.seconds(5)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, options: { minimum: Duration;
        maximum: Duration }): Duration
} = order.clamp(Order);

/**
 * Divides a `Duration` by a finite, non-zero number safely.
 *
 * **Details**
 *
 * Returns `Option.none()` for zero, negative zero, or non-finite divisors. For
 * nanosecond-backed durations, also returns `Option.none()` when the divisor
 * cannot be converted to a `bigint`, such as a fractional divisor.
 *
 * **Example** (Safely dividing durations)
 *
 * ```ts import.meta.vitest
 * import { Duration, Option } from "effect"
 *
 * Duration.divide(Duration.seconds(10), 2) // => Option.some(Duration.seconds(5))
 * Duration.divide(Duration.seconds(10), 0) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const divide: {
    /**
     * Divides a `Duration` by a finite, non-zero number safely.
     *
     * **Details**
     *
     * Returns `Option.none()` for zero, negative zero, or non-finite divisors. For
     * nanosecond-backed durations, also returns `Option.none()` when the divisor
     * cannot be converted to a `bigint`, such as a fractional divisor.
     *
     * **Example** (Safely dividing durations)
     *
     * ```ts import.meta.vitest
     * import { Duration, Option } from "effect"
     *
     * Duration.divide(Duration.seconds(10), 2) // => Option.some(Duration.seconds(5))
     * Duration.divide(Duration.seconds(10), 0) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (by: number): (self: Duration) => Option.Option<Duration>

    /**
     * Divides a `Duration` by a finite, non-zero number safely.
     *
     * **Details**
     *
     * Returns `Option.none()` for zero, negative zero, or non-finite divisors. For
     * nanosecond-backed durations, also returns `Option.none()` when the divisor
     * cannot be converted to a `bigint`, such as a fractional divisor.
     *
     * **Example** (Safely dividing durations)
     *
     * ```ts import.meta.vitest
     * import { Duration, Option } from "effect"
     *
     * Duration.divide(Duration.seconds(10), 2) // => Option.some(Duration.seconds(5))
     * Duration.divide(Duration.seconds(10), 0) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, by: number): Option.Option<Duration>
} = dual(
    2,
    (self: Duration, by: number): Option.Option<Duration> =>
    {
        if (!Number.isFinite(by)) {return Option.none();}

        if (by === 0 || Object.is(by, -0)) {return Option.none();}

        return match(self, {
            onMillis: (millis) => Option.some(Make(millis / by)),
            onNanos: (nanos) =>
            {
                try
                {
                    return Option.some(Make(nanos / BigInt(by)));
                }
                catch
                {
                    return Option.none();
                }
            },
            onInfinity: () => Option.some(by > 0 ? infinity : negativeInfinity),
            onNegativeInfinity: () => Option.some(by > 0 ? negativeInfinity : infinity)
        });
    }
);

/**
 * Divides a `Duration` by a number using fallback rules instead of returning
 * an `Option`.
 *
 * **When to use**
 *
 * Use when dividing a `Duration` should return `Duration.zero` or signed
 * infinity for invalid cases instead of forcing callers to handle `Option.none`.
 *
 * **Details**
 *
 * Non-finite divisors return `Duration.zero`. Division by positive or negative
 * zero can produce signed infinity for non-zero finite durations, while zero
 * or infinite durations divided by zero produce `Duration.zero`.
 * Nanosecond-backed durations return `Duration.zero` when the divisor cannot
 * be converted to a `bigint`.
 *
 * **Example** (Dividing durations unsafely)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.divideUnsafe(Duration.seconds(10), 2) // => Duration.seconds(5)
 * Duration.divideUnsafe(Duration.seconds(10), 0) // => Duration.infinity
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const divideUnsafe: {
    /**
     * Divides a `Duration` by a number using fallback rules instead of returning
     * an `Option`.
     *
     * **When to use**
     *
     * Use when dividing a `Duration` should return `Duration.zero` or signed
     * infinity for invalid cases instead of forcing callers to handle `Option.none`.
     *
     * **Details**
     *
     * Non-finite divisors return `Duration.zero`. Division by positive or negative
     * zero can produce signed infinity for non-zero finite durations, while zero
     * or infinite durations divided by zero produce `Duration.zero`.
     * Nanosecond-backed durations return `Duration.zero` when the divisor cannot
     * be converted to a `bigint`.
     *
     * **Example** (Dividing durations unsafely)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.divideUnsafe(Duration.seconds(10), 2) // => Duration.seconds(5)
     * Duration.divideUnsafe(Duration.seconds(10), 0) // => Duration.infinity
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (by: number): (self: Duration) => Duration

    /**
     * Divides a `Duration` by a number using fallback rules instead of returning
     * an `Option`.
     *
     * **When to use**
     *
     * Use when dividing a `Duration` should return `Duration.zero` or signed
     * infinity for invalid cases instead of forcing callers to handle `Option.none`.
     *
     * **Details**
     *
     * Non-finite divisors return `Duration.zero`. Division by positive or negative
     * zero can produce signed infinity for non-zero finite durations, while zero
     * or infinite durations divided by zero produce `Duration.zero`.
     * Nanosecond-backed durations return `Duration.zero` when the divisor cannot
     * be converted to a `bigint`.
     *
     * **Example** (Dividing durations unsafely)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.divideUnsafe(Duration.seconds(10), 2) // => Duration.seconds(5)
     * Duration.divideUnsafe(Duration.seconds(10), 0) // => Duration.infinity
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, by: number): Duration
} = dual(
    2,
    (self: Duration, by: number): Duration =>
    {
        if (!Number.isFinite(by)) {return zero;}

        return match(self, {
            onMillis: (millis) => Make(millis / by),
            onNanos: (nanos) =>
            {
                if (Object.is(by, 0) || Object.is(by, -0))
                {
                    if (nanos === Bigint0) {return zero;}

                    // match IEEE 754: same sign → +infinity, different sign → -infinity
                    const PositiveNanos = nanos > Bigint0;
                    const PositiveZero = Object.is(by, 0);
                    return (PositiveNanos === PositiveZero) ? infinity : negativeInfinity;
                }

                try
                {
                    return Make(nanos / BigInt(by));
                }
                catch
                {
                    return zero;
                }
            },
            onInfinity: () => by > 0 ? infinity : by < 0 ? negativeInfinity : zero,
            onNegativeInfinity: () => by > 0 ? negativeInfinity : by < 0 ? infinity : zero
        });
    }
);

/**
 * Returns a `Duration` multiplied by a number.
 *
 * **Details**
 *
 * Fractional multipliers on nanosecond-backed durations round the result to
 * the nearest nanosecond, with ties rounding away from zero. Infinite
 * durations return positive infinity, negative infinity, or zero depending on
 * the multiplier sign.
 *
 * **Example** (Multiplying durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.times(Duration.seconds(5), 2) // => Duration.seconds(10)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const times: {
    /**
     * Returns a `Duration` multiplied by a number.
     *
     * **Details**
     *
     * Fractional multipliers on nanosecond-backed durations round the result to
     * the nearest nanosecond, with ties rounding away from zero. Infinite
     * durations return positive infinity, negative infinity, or zero depending on
     * the multiplier sign.
     *
     * **Example** (Multiplying durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.times(Duration.seconds(5), 2) // => Duration.seconds(10)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (times: number): (self: Duration) => Duration

    /**
     * Returns a `Duration` multiplied by a number.
     *
     * **Details**
     *
     * Fractional multipliers on nanosecond-backed durations round the result to
     * the nearest nanosecond, with ties rounding away from zero. Infinite
     * durations return positive infinity, negative infinity, or zero depending on
     * the multiplier sign.
     *
     * **Example** (Multiplying durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.times(Duration.seconds(5), 2) // => Duration.seconds(10)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, times: number): Duration
} = dual(
    2,
    (self: Duration, times: number): Duration =>
        match(self, {
            onMillis: (millis) => Make(millis * times),
            onNanos: (nanos) =>
            {
                if (Number.isInteger(times)) {return Make(nanos * BigInt(times));}

                const NanosNumber = Number(nanos);
                const ScaledValue = NanosNumber * times;
                if (
                    !Number.isFinite(times) ||
          (Number.isSafeInteger(NanosNumber) && Math.abs(ScaledValue) <= Number.MAX_SAFE_INTEGER)
                )
                {
                    return FromNanosNumber(ScaledValue);
                }

                let numerator = times;
                let denominator = Bigint1;
                while (!Number.isInteger(numerator))
                {
                    numerator *= 2;
                    denominator *= Bigint2;
                }

                return Make(DivideTiesAwayFromZero(nanos * BigInt(numerator), denominator));
            },
            onInfinity: () => times > 0 ? infinity : times < 0 ? negativeInfinity : zero,
            onNegativeInfinity: () => times > 0 ? negativeInfinity : times < 0 ? infinity : zero
        })
);

/**
 * Subtracts one Duration from another. The result can be negative.
 *
 * **Details**
 *
 * Infinity subtraction follows signed-infinity arithmetic. Subtracting the
 * same infinity from itself returns zero. Positive infinity minus negative
 * infinity or any finite duration remains positive infinity. Negative infinity
 * minus positive infinity or any finite duration remains negative infinity.
 * Finite durations minus positive infinity produce negative infinity, and
 * finite durations minus negative infinity produce positive infinity.
 *
 * **Example** (Subtracting durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.subtract(Duration.seconds(10), Duration.seconds(3)) // => Duration.seconds(7)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const subtract: {
    /**
     * Subtracts one Duration from another. The result can be negative.
     *
     * **Details**
     *
     * Infinity subtraction follows signed-infinity arithmetic. Subtracting the
     * same infinity from itself returns zero. Positive infinity minus negative
     * infinity or any finite duration remains positive infinity. Negative infinity
     * minus positive infinity or any finite duration remains negative infinity.
     * Finite durations minus positive infinity produce negative infinity, and
     * finite durations minus negative infinity produce positive infinity.
     *
     * **Example** (Subtracting durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.subtract(Duration.seconds(10), Duration.seconds(3)) // => Duration.seconds(7)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => Duration

    /**
     * Subtracts one Duration from another. The result can be negative.
     *
     * **Details**
     *
     * Infinity subtraction follows signed-infinity arithmetic. Subtracting the
     * same infinity from itself returns zero. Positive infinity minus negative
     * infinity or any finite duration remains positive infinity. Negative infinity
     * minus positive infinity or any finite duration remains negative infinity.
     * Finite durations minus positive infinity produce negative infinity, and
     * finite durations minus negative infinity produce positive infinity.
     *
     * **Example** (Subtracting durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.subtract(Duration.seconds(10), Duration.seconds(3)) // => Duration.seconds(7)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): Duration
} = dual(
    2,
    (self: Duration, that: Duration): Duration =>
        matchPair(self, that, {
            onMillis: (self, that) => Make(self - that),
            onNanos: (self, that) => Make(self - that),
            onInfinity: (self, that) =>
            {
                const S = self.value._tag;
                const T = that.value._tag;
                if (S === "Infinity") {return T === "Infinity" ? zero : infinity;}

                if (S === "NegativeInfinity") {return T === "NegativeInfinity" ? zero : negativeInfinity;}

                return T === "Infinity" ? negativeInfinity : infinity;
            }
        })
);

/**
 * Adds two Durations together.
 *
 * **Details**
 *
 * Infinity addition follows these rules:
 *
 * - infinity + infinity = infinity
 * - infinity + negativeInfinity = zero
 * - infinity + finite = infinity
 * - negativeInfinity + negativeInfinity = negativeInfinity
 * - negativeInfinity + finite = negativeInfinity
 *
 * **Example** (Adding durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.sum(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(8)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sum: {
    /**
     * Adds two Durations together.
     *
     * **Details**
     *
     * Infinity addition follows these rules:
     *
     * - infinity + infinity = infinity
     * - infinity + negativeInfinity = zero
     * - infinity + finite = infinity
     * - negativeInfinity + negativeInfinity = negativeInfinity
     * - negativeInfinity + finite = negativeInfinity
     *
     * **Example** (Adding durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.sum(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(8)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => Duration

    /**
     * Adds two Durations together.
     *
     * **Details**
     *
     * Infinity addition follows these rules:
     *
     * - infinity + infinity = infinity
     * - infinity + negativeInfinity = zero
     * - infinity + finite = infinity
     * - negativeInfinity + negativeInfinity = negativeInfinity
     * - negativeInfinity + finite = negativeInfinity
     *
     * **Example** (Adding durations)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.sum(Duration.seconds(5), Duration.seconds(3)) // => Duration.seconds(8)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): Duration
} = dual(
    2,
    (self: Duration, that: Duration): Duration =>
        matchPair(self, that, {
            onMillis: (self, that) => Make(self + that),
            onNanos: (self, that) => Make(self + that),
            onInfinity: (self, that) =>
            {
                const SValue = self.value._tag;
                const TValue = that.value._tag;
                if (SValue === "Infinity" && TValue === "NegativeInfinity") {return zero;}

                if (SValue === "NegativeInfinity" && TValue === "Infinity") {return zero;}

                if (SValue === "Infinity" || TValue === "Infinity") {return infinity;}

                if (SValue === "NegativeInfinity" || TValue === "NegativeInfinity") {return negativeInfinity;}

                // unreachable, but satisfy TS
                return zero;
            }
        })
);

/**
 * Checks whether the first Duration is less than the second.
 *
 * **Example** (Comparing durations with less than)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isLessThan(Duration.seconds(3), Duration.seconds(5)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThan: {
    /**
     * Checks whether the first Duration is less than the second.
     *
     * **Example** (Comparing durations with less than)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isLessThan(Duration.seconds(3), Duration.seconds(5)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => boolean

    /**
     * Checks whether the first Duration is less than the second.
     *
     * **Example** (Comparing durations with less than)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isLessThan(Duration.seconds(3), Duration.seconds(5)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): boolean
} = order.isLessThan(Order);

/**
 * Checks whether the first Duration is less than or equal to the second.
 *
 * **Example** (Comparing durations with less than or equal)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isLessThanOrEqualTo(
 *   Duration.seconds(5),
 *   Duration.seconds(5)
 * ) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThanOrEqualTo: {
    /**
     * Checks whether the first Duration is less than or equal to the second.
     *
     * **Example** (Comparing durations with less than or equal)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isLessThanOrEqualTo(
     *   Duration.seconds(5),
     *   Duration.seconds(5)
     * ) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => boolean

    /**
     * Checks whether the first Duration is less than or equal to the second.
     *
     * **Example** (Comparing durations with less than or equal)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isLessThanOrEqualTo(
     *   Duration.seconds(5),
     *   Duration.seconds(5)
     * ) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): boolean
} = order.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first Duration is greater than the second.
 *
 * **Example** (Comparing durations with greater than)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isGreaterThan(Duration.seconds(5), Duration.seconds(3)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThan: {
    /**
     * Checks whether the first Duration is greater than the second.
     *
     * **Example** (Comparing durations with greater than)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isGreaterThan(Duration.seconds(5), Duration.seconds(3)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => boolean

    /**
     * Checks whether the first Duration is greater than the second.
     *
     * **Example** (Comparing durations with greater than)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isGreaterThan(Duration.seconds(5), Duration.seconds(3)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): boolean
} = order.isGreaterThan(Order);

/**
 * Checks whether the first Duration is greater than or equal to the second.
 *
 * **Example** (Comparing durations with greater than or equal)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.isGreaterThanOrEqualTo(
 *   Duration.seconds(5),
 *   Duration.seconds(5)
 * ) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo: {
    /**
     * Checks whether the first Duration is greater than or equal to the second.
     *
     * **Example** (Comparing durations with greater than or equal)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isGreaterThanOrEqualTo(
     *   Duration.seconds(5),
     *   Duration.seconds(5)
     * ) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => boolean

    /**
     * Checks whether the first Duration is greater than or equal to the second.
     *
     * **Example** (Comparing durations with greater than or equal)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.isGreaterThanOrEqualTo(
     *   Duration.seconds(5),
     *   Duration.seconds(5)
     * ) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): boolean
} = order.isGreaterThanOrEqualTo(Order);

/**
 * Checks whether two Durations are equal.
 *
 * **Example** (Checking duration equality)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.equals(Duration.seconds(5), Duration.millis(5000)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const equals: {
    /**
     * Checks whether two Durations are equal.
     *
     * **Example** (Checking duration equality)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.equals(Duration.seconds(5), Duration.millis(5000)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: Duration): (self: Duration) => boolean

    /**
     * Checks whether two Durations are equal.
     *
     * **Example** (Checking duration equality)
     *
     * ```ts import.meta.vitest
     * import { Duration } from "effect"
     *
     * Duration.equals(Duration.seconds(5), Duration.millis(5000)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Duration, that: Duration): boolean
} = dual(2, (self: Duration, that: Duration): boolean => Equivalence(self, that));

/**
 * Decomposes a `Duration` into normalized signed components.
 *
 * **Details**
 *
 * Finite durations are returned as `{ days, hours, minutes, seconds, millis,
 * nanos }`. Infinite durations return every component as `Infinity` or
 * `-Infinity`.
 *
 * **Example** (Decomposing durations into parts)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * // Create a complex duration by adding multiple parts
 * const duration = Duration.sum(
 *   Duration.sum(
 *     Duration.sum(Duration.days(1), Duration.hours(2)),
 *     Duration.sum(Duration.minutes(30), Duration.seconds(45))
 *   ),
 *   Duration.millis(123)
 * )
 * Duration.parts(duration) // => ({ days: 1, hours: 2, minutes: 30, seconds: 45, millis: 123, nanos: 0 })
 *
 * const complex = Duration.sum(Duration.hours(25), Duration.minutes(90))
 * Duration.parts(complex) // => ({ days: 1, hours: 2, minutes: 30, seconds: 0, millis: 0, nanos: 0 })
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const parts = (self: Duration): {
    days: number
    hours: number
    minutes: number
    seconds: number
    millis: number
    nanos: number
} =>
{
    if (self.value._tag === "Infinity")
    {
        return {
            days: Infinity,
            hours: Infinity,
            minutes: Infinity,
            seconds: Infinity,
            millis: Infinity,
            nanos: Infinity
        };
    }

    if (self.value._tag === "NegativeInfinity")
    {
        return {
            days: -Infinity,
            hours: -Infinity,
            minutes: -Infinity,
            seconds: -Infinity,
            millis: -Infinity,
            nanos: -Infinity
        };
    }

    const N = toNanosUnsafe(self);
    const Neg = N < Bigint0;
    const AValue = Neg ? -N : N;
    const Ms = AValue / Bigint1e6;
    const Sec = Ms / Bigint1e3;
    const Min = Sec / Bigint60;
    const Hr = Min / Bigint60;
    const DValue = Hr / Bigint24;
    const SignValue = Neg ? -1 : 1;

    return {
        days: SignValue * Number(DValue),
        hours: SignValue * Number(Hr % Bigint24),
        minutes: SignValue * Number(Min % Bigint60),
        seconds: SignValue * Number(Sec % Bigint60),
        millis: SignValue * Number(Ms % Bigint1e3),
        nanos: SignValue * Number(AValue % Bigint1e6)
    };
};

/**
 * Converts a `Duration` to a human readable string.
 *
 * **Example** (Formatting durations)
 *
 * ```ts import.meta.vitest
 * import { Duration } from "effect"
 *
 * Duration.format(Duration.millis(1000)) // => "1s"
 * Duration.format(Duration.millis(1001)) // => "1s 1ms"
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const format = (self: Duration): string =>
{
    if (self.value._tag === "Infinity")
    {
        return "Infinity";
    }

    if (self.value._tag === "NegativeInfinity")
    {
        return "-Infinity";
    }

    if (isZero(self))
    {
        return "0";
    }

    if (isNegative(self))
    {
        return "-" + format(abs(self));
    }

    const Fragments = parts(self);
    const Pieces = [];
    if (Fragments.days !== 0)
    {
        Pieces.push(`${Fragments.days}d`);
    }

    if (Fragments.hours !== 0)
    {
        Pieces.push(`${Fragments.hours}h`);
    }

    if (Fragments.minutes !== 0)
    {
        Pieces.push(`${Fragments.minutes}m`);
    }

    if (Fragments.seconds !== 0)
    {
        Pieces.push(`${Fragments.seconds}s`);
    }

    if (Fragments.millis !== 0)
    {
        Pieces.push(`${Fragments.millis}ms`);
    }

    if (Fragments.nanos !== 0)
    {
        Pieces.push(`${Fragments.nanos}ns`);
    }

    return Pieces.join(" ");
};

/**
 * Reducer for summing `Duration`s.
 *
 * **When to use**
 *
 * Use to sum many `Duration` values through APIs that consume a `Reducer`.
 *
 * **Details**
 *
 * `ReducerSum` uses `sum` and starts from `zero`, so `combineAll([])` returns
 * `zero`.
 *
 * @see {@link sum} for adding two duration values directly
 * @see {@link CombinerMax} for keeping the longest duration instead of summing
 * @see {@link CombinerMin} for keeping the shortest duration instead of summing
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ReducerSum: Reducer.Reducer<Duration> = Reducer.make(sum, zero);

/**
 * Combiner that returns the maximum `Duration`.
 *
 * **When to use**
 *
 * Use to keep the longest `Duration` when an API consumes a `Combiner`.
 *
 * @see {@link CombinerMin} for keeping the shortest `Duration`
 * @see {@link max} for comparing two `Duration` values directly
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CombinerMax: Combiner.Combiner<Duration> = Combiner.max(Order);

/**
 * Combiner that returns the minimum `Duration`.
 *
 * **When to use**
 *
 * Use to keep the shortest `Duration` through APIs that consume a `Combiner`.
 *
 * @see {@link CombinerMax} for keeping the longest `Duration`
 * @see {@link min} for comparing two `Duration` values directly
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CombinerMin: Combiner.Combiner<Duration> = Combiner.min(Order);

/* Preserve multiple statements in upstream traversal loops. */

