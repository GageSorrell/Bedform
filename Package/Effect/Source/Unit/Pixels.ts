/**
 * Screen-space pixel quantities, together with pixel rates and pixel areas.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Pixels` and `PixelsExact` modules.
 *
 * @module @bedform/effect/Unit/Pixels
 *
 * @file      Pixels.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Duration from "./Duration.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

// Screen-space units. Note that these are unrelated to `Length.cssPixels`,
// which is a physical length (1/96 of an inch).

/**
 * A quantity measured in `"Pixels"`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Pixels<K extends Quantity.Value = number> = Quantity.Quantity<"Pixels", K>;

/**
 * The identity schema for `Pixels` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Pixels = Quantity.Quantity("Pixels");

/**
 * The codec between `Pixels` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const PixelsFromStruct = Quantity.QuantityFromStruct("Pixels");

/**
 * The type of the pixels per second unit, composed from other units with the
 * `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type PixelsPerSecond = Unit.Rate<"Pixels", Duration.Seconds>;

/**
 * The pixels per second unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const PixelsPerSecond: PixelsPerSecond = Unit.rate(
    "Pixels",
    Duration.Seconds
);

/**
 * The type of the pixels per second squared unit, composed from other units with
 * the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type PixelsPerSecondSquared = Unit.Rate<
    PixelsPerSecond,
    Duration.Seconds
>;

/**
 * The pixels per second squared unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const PixelsPerSecondSquared: PixelsPerSecondSquared = Unit.rate(
    PixelsPerSecond,
    Duration.Seconds
);

/**
 * The type of the square pixels unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type SquarePixels = Unit.Squared<"Pixels">;

/**
 * The square pixels unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const SquarePixels: SquarePixels = Unit.squared("Pixels");

/**
 * A `Quantity<"Pixels">` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = Quantity.make("Pixels", 0);

/**
 * Creates a `Pixels` from a number of pixels.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pixels = <N extends Quantity.Input>(n: N): Pixels<Quantity.Of<N>> =>
    Quantity.make("Pixels", n);

/**
 * Converts a `Pixels` to a number of pixels.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPixels = <K extends Quantity.Value>(p: Pixels<K>): K =>
    p.value;

/**
 * Creates a `Quantity<PixelsPerSecond>` from a number of pixels per second.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pixelsPerSecond = <N extends Quantity.Input>(
    n: N
): Quantity.Quantity<PixelsPerSecond, Quantity.Of<N>> =>
    Quantity.make(PixelsPerSecond, n);

/**
 * Converts a `Quantity<PixelsPerSecond>` to a number of pixels per second.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPixelsPerSecond = <K extends Quantity.Value>(
    p: Quantity.Quantity<PixelsPerSecond, K>
): K => p.value;

/**
 * Creates a `Quantity<PixelsPerSecondSquared>` from a number of pixels per second
 * squared.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pixelsPerSecondSquared = <N extends Quantity.Input>(
    n: N
): Quantity.Quantity<PixelsPerSecondSquared, Quantity.Of<N>> =>
    Quantity.make(PixelsPerSecondSquared, n);

/**
 * Converts a `Quantity<PixelsPerSecondSquared>` to a number of pixels per second
 * squared.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPixelsPerSecondSquared = <K extends Quantity.Value>(
    p: Quantity.Quantity<PixelsPerSecondSquared, K>
): K => p.value;

/**
 * Creates a `Quantity<SquarePixels>` from a number of square pixels.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squarePixels = <N extends Quantity.Input>(
    n: N
): Quantity.Quantity<SquarePixels, Quantity.Of<N>> => Quantity.make(SquarePixels, n);

/**
 * Converts a `Quantity<SquarePixels>` to a number of square pixels.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquarePixels = <K extends Quantity.Value>(
    p: Quantity.Quantity<SquarePixels, K>
): K => p.value;
