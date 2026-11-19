/**
 * Pressure quantities, stored in pascals, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Pressure` and `PressureExact` modules.
 *
 * @module @bedform/effect/Unit/Pressure
 *
 * @file      Pressure.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Area from "./Area.js";
import * as BigRational from "../BigRational.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Force from "./Force.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the pascals unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Pascals = Unit.Rate<Force.Newtons, Area.SquareMeters>;

/**
 * The pascals unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Pascals: Pascals = Unit.rate(Force.Newtons, Area.SquareMeters);

/**
 * A quantity measured in `Pascals`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Pressure<K extends Quantity.Value = number> = Quantity.Quantity<Pascals, K>;

/**
 * The identity schema for `Pressure` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Pressure = Quantity.Quantity(Pascals);

/**
 * The codec between `Pressure` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const PressureFromStruct = Quantity.QuantityFromStruct(Pascals);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Pressure<K> => Quantity.make(Pascals, value) as Pressure<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/**
 * One pound per square inch is one pound of force per square inch—exactly
 * 8896443230521/1290320000 pascals.
 */
const pascalsPerPoundPerSquareInchExact = BigRational.divideUnsafe(
    ConstantsExact.newtonsPerPoundForce,
    BigRational.multiply(ConstantsExact.metersPerInch, ConstantsExact.metersPerInch)
);

/** One standard atmosphere is 101325 pascals. */
const pascalsPerAtmosphereExact = BigRational.makeUnsafe(101_325n);

/**
 * A `Pressure` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Pressure` from a number of pascals.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pascals = <N extends Quantity.Input>(n: N): Pressure<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Pressure` to a number of pascals.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPascals = <K extends Quantity.Value>(p: Pressure<K>): K =>
    p.value;

/**
 * Creates a `Pressure` from a number of kilopascals.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilopascals = <N extends Quantity.Input>(n: N): Pressure<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts a `Pressure` to a number of kilopascals.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilopascals = <K extends Quantity.Value>(p: Pressure<K>): K =>
    Prefix.toPrefixed("Kilo", p.value);

/**
 * Creates a `Pressure` from a number of megapascals.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const megapascals = <N extends Quantity.Input>(n: N): Pressure<Quantity.Of<N>> =>
    make(Prefix.toBase("Mega", n));

/**
 * Converts a `Pressure` to a number of megapascals.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMegapascals = <K extends Quantity.Value>(p: Pressure<K>): K =>
    Prefix.toPrefixed("Mega", p.value);

/**
 * One pound per square inch is one pound of force per square inch: exactly
 * 8,896,443,230,521/1,290,320,000 pascals (the pound-force and inch
 * definitions combined into one reduced fraction), written as one division
 * of exact integers so the factor is correctly rounded—chaining the
 * already-rounded constants would land one ulp off.
 */
const pascalsPerPoundPerSquareInch = 8_896_443_230_521 / 1_290_320_000;

/**
 * Creates a `Pressure` from a number of pounds per square inch.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const poundsPerSquareInch = <N extends Quantity.Input>(n: N): Pressure<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * pascalsPerPoundPerSquareInch)
        : make(Numeric.multiplyExact(n, pascalsPerPoundPerSquareInchExact));

/**
 * Converts a `Pressure` to a number of pounds per square inch.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPoundsPerSquareInch = <K extends Quantity.Value>(p: Pressure<K>): K =>
    (Predicate.isNumber(p.value)
        ? p.value / pascalsPerPoundPerSquareInch
        : Numeric.divideExact(p.value, pascalsPerPoundPerSquareInchExact)) as K;

/** One standard atmosphere is 101325 pascals. */
const pascalsPerAtmosphere = 101_325;

/**
 * Creates a `Pressure` from a number of atmospheres.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const atmospheres = <N extends Quantity.Input>(n: N): Pressure<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * pascalsPerAtmosphere)
        : make(Numeric.multiplyExact(n, pascalsPerAtmosphereExact));

/**
 * Converts a `Pressure` to a number of atmospheres.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAtmospheres = <K extends Quantity.Value>(p: Pressure<K>): K =>
    (Predicate.isNumber(p.value)
        ? p.value / pascalsPerAtmosphere
        : Numeric.divideExact(p.value, pascalsPerAtmosphereExact)) as K;
