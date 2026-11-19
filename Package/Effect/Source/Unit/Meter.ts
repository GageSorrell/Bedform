/**
 * Meters as a branded `number`, for coordinates and sizes that Bedrock APIs
 * take as plain numbers.
 *
 * A `Meter` is a finite `number` carrying the `"Meter"` brand, so a plain
 * number is rejected where a `Meter` is expected, yet every `Meter` is still a
 * `number` and can be passed straight to a Bedrock `Vector3`. `Meter<Int>`
 * narrows the value to a safe integer and remains assignable to `Int`. Unlike
 * a `Length`, a `Meter` is not a quantity object; `fromLength` and `toLength`
 * convert between the two.
 *
 * This module is original to `@bedform/effect` and is not ported from
 * effect-units. It carries the BSD-3-Clause license of the `Unit` tree.
 *
 * @module @bedform/effect/Unit/Meter
 *
 * @file      Meter.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

import type * as Brand from "../Brand.js";
import * as Int from "../Int.js";
import * as Length from "./Length.js";
import * as Numeric from "./Internal/numeric.js";
import * as Option from "../Option.js";
import type * as Quantity from "./Quantity.js";
import * as Schema from "../Schema.js";

/**
 * A finite number of meters, whose underlying number type is `N`. `Meter<Int>`
 * is a whole number of meters and is assignable to both `number` and `Int`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Meter<N extends number = number> = N & Brand.Brand<"Meter">;

/**
 * The schema for `Meter` values. Decoding accepts any finite number and
 * rejects NaN and ±Infinity.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Meter = Schema.Finite.pipe(Schema.brand("Meter"));

/** Brands a finite number, normalizing negative zero. */
const unsafeOf = <N extends number>(n: N): Meter<N> => (n + 0) as Meter<N>;

/**
 * Brands a finite number of meters. Returns `Option.none()` for NaN and
 * ±Infinity. Negative zero becomes zero.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (n: number): Option.Option<Meter> =>
    Number.isFinite(n) ? Option.some(unsafeOf(n)) : Option.none();

/**
 * Brands a finite number of meters. Negative zero becomes zero.
 *
 * @throws { RangeError } For NaN and ±Infinity.
 * @category Constructors
 * @since 1.0.0
 */
export const makeUnsafe = (n: number): Meter =>
{
    if (!Number.isFinite(n))
    {
        throw new RangeError(`Meter.makeUnsafe: ${n} is not finite`);
    }

    return unsafeOf(n);
};

/**
 * Brands an `Int` as a whole number of meters. This never fails, because every
 * `Int` is finite.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromInt = (i: Int.Int): Meter<Int.Int> => unsafeOf(i);

/**
 * Rounds a number down with `Math.floor`, as `Int.make` does, and brands it as
 * a whole number of meters. Returns `Option.none()` for NaN, ±Infinity and
 * results outside the safe integer range.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeInt = (n: number): Option.Option<Meter<Int.Int>> =>
    Option.map(Int.make(n), fromInt);

/**
 * Converts a `Length` of any numeric kind to a `Meter`. An exact value is
 * rounded once to the nearest float, and negative zero becomes zero.
 *
 * @throws { RangeError } When the length is not finite in meters, such as the
 * result of a float division by zero or an exact value that overflows.
 * @category Conversions
 * @since 1.0.0
 */
export const fromLength = <K extends Quantity.Value>(length: Length.Length<K>): Meter =>
{
    const meters: number = Numeric.toFloat(length.value);
    if (!Number.isFinite(meters))
    {
        throw new RangeError(`Meter.fromLength: ${meters} m is not finite`);
    }

    return unsafeOf(meters);
};

/**
 * Converts a `Meter` to a float `Length` of the same number of meters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toLength = (meter: Meter): Length.Length<number> =>
    Length.meters(meter as number);
