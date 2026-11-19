/**
 * Angles, stored in radians, with conversion to and from degrees, minutes and
 * seconds, and trigonometry.
 *
 * Conversions whose factor involves π cannot be exact, so their
 * constructors accept every numeric kind but always produce floats,
 * and their converters return floats. Radians, the base unit, keep the
 * kind they are given.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Angle
 *
 * @file      Angle.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units import and property order. */
/* eslint-disable sort-keys */

import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Radians` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Radians = "Radians";

/**
 * The `Radians` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Radians: Radians = "Radians";

/**
 * A quantity measured in `Radians`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Angle<K extends Quantity.Value = number> = Quantity.Quantity<Radians, K>;

/**
 * The identity schema for `Angle` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Angle = Quantity.Quantity(Radians);

/**
 * The codec between `Angle` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const AngleFromStruct = Quantity.QuantityFromStruct(Radians);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Angle<K> => Quantity.make(Radians, value) as Angle<K>;

/**
 * An `Angle` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `Angle` from a number of radians.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const radians = <N extends Quantity.Input>(n: N): Angle<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Angle` to a number of radians.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inRadians = <K extends Quantity.Value>(a: Angle<K>): K => a.value;

const radiansPerTurn = 2 * Math.PI;

/**
 * Creates an `Angle` from a number of turns.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const turns = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(n * radiansPerTurn)
        : make(Numeric.float(n) * radiansPerTurn);

/**
 * Converts an `Angle` to a number of turns.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inTurns = <K extends Quantity.Value>(a: Angle<K>): number =>
    Numeric.toFloat(a.value) / radiansPerTurn;

const radiansPerDegree = Math.PI / 180;

/**
 * Creates an `Angle` from a number of degrees.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const degrees = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(n * radiansPerDegree)
        : make(Numeric.float(n) * radiansPerDegree);

/**
 * Converts an `Angle` to a number of degrees.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDegrees = <K extends Quantity.Value>(a: Angle<K>): number =>
    Numeric.toFloat(a.value) / radiansPerDegree;

/** One minute of arc is 1/60 of a degree. */
const radiansPerArcminute = Math.PI / 10_800;

/**
 * Creates an `Angle` from a number of minutes.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const minutes = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(n * radiansPerArcminute)
        : make(Numeric.float(n) * radiansPerArcminute);

/**
 * Converts an `Angle` to a number of minutes.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMinutes = <K extends Quantity.Value>(a: Angle<K>): number =>
    Numeric.toFloat(a.value) / radiansPerArcminute;

/** One second of arc is 1/60 of a minute of arc. */
const radiansPerArcsecond = Math.PI / 648_000;

/**
 * Creates an `Angle` from a number of seconds.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const seconds = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(n * radiansPerArcsecond)
        : make(Numeric.float(n) * radiansPerArcsecond);

/**
 * Converts an `Angle` to a number of seconds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSeconds = <K extends Quantity.Value>(a: Angle<K>): number =>
    Numeric.toFloat(a.value) / radiansPerArcsecond;

// Degrees, minutes, seconds

/**
 * The sign of an angle in degrees, minutes and seconds notation.
 *
 * @category Types
 * @since 1.0.0
 */
export type Sign = "Positive" | "Negative";

/**
 * Creates an angle from its sign and its magnitude in degrees, minutes and seconds
 * of arc.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromDms = ({
    sign,
    degrees: wholeDegrees,
    minutes: wholeMinutes,
    seconds: dmsSeconds
}: {
    readonly sign: Sign;
    readonly degrees: number;
    readonly minutes: number;
    readonly seconds: number;
}): Angle =>
{
    const totalArcseconds = wholeDegrees * 3_600 + wholeMinutes * 60 + dmsSeconds;
    const magnitude = totalArcseconds * radiansPerArcsecond;

    return make(sign === "Positive" ? magnitude : -magnitude);
};

/**
 * Splits an angle into its sign, whole degrees, whole minutes and the remaining
 * seconds of arc of its magnitude.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toDms = <K extends Quantity.Value>(
    a: Angle<K>
): {
    readonly sign: Sign;
    readonly degrees: number;
    readonly minutes: number;
    readonly seconds: number;
} =>
{
    const value = Numeric.toFloat(a.value);
    const totalArcseconds = Math.abs(value) / radiansPerArcsecond;
    const wholeDegrees = Math.floor(totalArcseconds / 3_600);
    const remainingArcseconds = totalArcseconds - wholeDegrees * 3_600;
    const wholeMinutes = Math.floor(remainingArcseconds / 60);

    return {
        sign: value < 0 ? "Negative" : "Positive",
        degrees: wholeDegrees,
        minutes: wholeMinutes,
        seconds: remainingArcseconds - wholeMinutes * 60
    };
};

// Trigonometry

/**
 * The sine of an angle.
 *
 * @category Math
 * @since 1.0.0
 */
export const sin = <K extends Quantity.Value>(a: Angle<K>): number =>
    Math.sin(Numeric.toFloat(a.value));

/**
 * The cosine of an angle.
 *
 * @category Math
 * @since 1.0.0
 */
export const cos = <K extends Quantity.Value>(a: Angle<K>): number =>
    Math.cos(Numeric.toFloat(a.value));

/**
 * The tangent of an angle.
 *
 * @category Math
 * @since 1.0.0
 */
export const tan = <K extends Quantity.Value>(a: Angle<K>): number =>
    Math.tan(Numeric.toFloat(a.value));

/**
 * NaN when the input is outside `[-1, 1]`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const asin = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(Math.asin(n))
        : make(Math.asin(Numeric.float(n)));

/**
 * NaN when the input is outside `[-1, 1]`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const acos = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(Math.acos(n))
        : make(Math.acos(Numeric.float(n)));

/**
 * The arctangent of a number, in the range `[-π/2, π/2]`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const atan = <N extends Quantity.Input>(n: N): Angle =>
    Predicate.isNumber(n)
        ? make(Math.atan(n))
        : make(Math.atan(Numeric.float(n)));

/**
 * The angle from the positive x axis to the point `(x, y)`, in the range `[-π,
 * π]`.
 *
 * @category Math
 * @since 1.0.0
 */
export const atan2 = (y: Quantity.Input, x: Quantity.Input): Angle =>
    make(Math.atan2(Numeric.float(y), Numeric.float(x)));

/**
 * Normalizes an angle into the range `(-π, π]`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalize = <K extends Quantity.Value>(a: Angle<K>): Angle =>
{
    const remainder = Numeric.toFloat(a.value) % radiansPerTurn;

    return make(
        remainder > Math.PI
            ? remainder - radiansPerTurn
            : remainder <= -Math.PI
                ? remainder + radiansPerTurn
                : remainder
    );
};
