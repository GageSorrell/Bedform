/**
 * Illuminance quantities, stored in lux, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Illuminance` and `IlluminanceExact` modules.
 *
 * @module @bedform/effect/Unit/Illuminance
 *
 * @file      Illuminance.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Area from "./Area.js";
import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as LuminousFlux from "./LuminousFlux.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the lux unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Lux = Unit.Rate<LuminousFlux.Lumens, Area.SquareMeters>;

/**
 * The lux unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Lux: Lux = Unit.rate(LuminousFlux.Lumens, Area.SquareMeters);

/**
 * A quantity measured in `Lux`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Illuminance<K extends Quantity.Value = number> = Quantity.Quantity<Lux, K>;

/**
 * The identity schema for `Illuminance` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Illuminance = Quantity.Quantity(Lux);

/**
 * The codec between `Illuminance` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const IlluminanceFromStruct = Quantity.QuantityFromStruct(Lux);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Illuminance<K> => Quantity.make(Lux, value) as Illuminance<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/**
 * One foot candle is one lumen per square foot—exactly 1562500/145161 lux.
 */
const luxPerFootCandleExact = BigRational.divideUnsafe(
    BigRational.one,
    BigRational.multiply(ConstantsExact.metersPerFoot, ConstantsExact.metersPerFoot)
);

/**
 * An `Illuminance` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `Illuminance` from a number of lux.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const lux = <N extends Quantity.Input>(n: N): Illuminance<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Illuminance` to a number of lux.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inLux = <K extends Quantity.Value>(i: Illuminance<K>): K =>
    i.value;

/** One foot candle is one lumen per square foot. */
const luxPerFootCandle =
    1 / (Constants.metersPerFoot * Constants.metersPerFoot);

/**
 * Creates an `Illuminance` from a number of foot candles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const footCandles = <N extends Quantity.Input>(n: N): Illuminance<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * luxPerFootCandle)
        : make(Numeric.multiplyExact(n, luxPerFootCandleExact));

/**
 * Converts an `Illuminance` to a number of foot candles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFootCandles = <K extends Quantity.Value>(i: Illuminance<K>): K =>
    (Predicate.isNumber(i.value)
        ? i.value / luxPerFootCandle
        : Numeric.divideExact(i.value, luxPerFootCandleExact)) as K;
