/**
 * Area quantities, stored in square meters, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Area` and `AreaExact` modules.
 *
 * @module @bedform/effect/Unit/Area
 *
 * @file      Area.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Length from "./Length.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the square meters unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type SquareMeters = Unit.Squared<Length.Meters>;

/**
 * The square meters unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const SquareMeters: SquareMeters = Unit.squared(Length.Meters);

/**
 * A quantity measured in `SquareMeters`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Area<K extends Quantity.Value = number> = Quantity.Quantity<SquareMeters, K>;

/**
 * The identity schema for `Area` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Area = Quantity.Quantity(SquareMeters);

/**
 * The codec between `Area` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const AreaFromStruct = Quantity.QuantityFromStruct(SquareMeters);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Area<K> => Quantity.make(SquareMeters, value) as Area<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const squaredExact = (r: BigRational.BigRational) => BigRational.multiply(r, r);

const squareMetersPerSquareMillimeterExact = squaredExact(
    Prefix.toBase("Milli", BigRational.one)
);

const squareMetersPerSquareCentimeterExact = squaredExact(
    Prefix.toBase("Centi", BigRational.one)
);

/** One hectare is one square hectometer. */
const squareMetersPerHectareExact = squaredExact(
    Prefix.toBase("Hecto", BigRational.one)
);

const squareMetersPerSquareKilometerExact = squaredExact(
    Prefix.toBase("Kilo", BigRational.one)
);

const squareMetersPerSquareInchExact = squaredExact(ConstantsExact.metersPerInch);

const squareMetersPerSquareFootExact = squaredExact(ConstantsExact.metersPerFoot);

const squareMetersPerSquareYardExact = squaredExact(ConstantsExact.metersPerYard);

/** One acre is 4840 square yards. */
const squareYardsPerAcreExact = BigRational.makeUnsafe(4_840n);
const squareMetersPerAcreExact = BigRational.multiply(
    squareYardsPerAcreExact,
    squareMetersPerSquareYardExact
);

const squareMetersPerSquareMileExact = squaredExact(ConstantsExact.metersPerMile);

/**
 * An `Area` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

// Metric

/**
 * Creates an `Area` from a number of square meters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareMeters = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Area` to a number of square meters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareMeters = <K extends Quantity.Value>(a: Area<K>): K =>
    a.value;

const squareMetersPerSquareMillimeter = Prefix.toBase("Milli", 1) ** 2;

/**
 * Creates an `Area` from a number of square millimeters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareMillimeters = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareMillimeter)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareMillimeterExact));

/**
 * Converts an `Area` to a number of square millimeters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareMillimeters = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareMillimeter
        : Numeric.divideExact(a.value, squareMetersPerSquareMillimeterExact)) as K;

const squareMetersPerSquareCentimeter = Prefix.toBase("Centi", 1) ** 2;

/**
 * Creates an `Area` from a number of square centimeters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareCentimeters = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareCentimeter)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareCentimeterExact));

/**
 * Converts an `Area` to a number of square centimeters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareCentimeters = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareCentimeter
        : Numeric.divideExact(a.value, squareMetersPerSquareCentimeterExact)) as K;

/** One hectare is one square hectometer. */
const squareMetersPerHectare = Prefix.toBase("Hecto", 1) ** 2;

/**
 * Creates an `Area` from a number of hectares.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const hectares = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerHectare)
        : make(Numeric.multiplyExact(n, squareMetersPerHectareExact));

/**
 * Converts an `Area` to a number of hectares.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inHectares = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerHectare
        : Numeric.divideExact(a.value, squareMetersPerHectareExact)) as K;

const squareMetersPerSquareKilometer = Prefix.toBase("Kilo", 1) ** 2;

/**
 * Creates an `Area` from a number of square kilometers.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareKilometers = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareKilometer)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareKilometerExact));

/**
 * Converts an `Area` to a number of square kilometers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareKilometers = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareKilometer
        : Numeric.divideExact(a.value, squareMetersPerSquareKilometerExact)) as K;

// Imperial

const squareMetersPerSquareInch =
    Constants.metersPerInch * Constants.metersPerInch;

/**
 * Creates an `Area` from a number of square inches.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareInches = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareInch)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareInchExact));

/**
 * Converts an `Area` to a number of square inches.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareInches = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareInch
        : Numeric.divideExact(a.value, squareMetersPerSquareInchExact)) as K;

const squareMetersPerSquareFoot =
    Constants.metersPerFoot * Constants.metersPerFoot;

/**
 * Creates an `Area` from a number of square feet.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareFeet = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareFoot)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareFootExact));

/**
 * Converts an `Area` to a number of square feet.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareFeet = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareFoot
        : Numeric.divideExact(a.value, squareMetersPerSquareFootExact)) as K;

const squareMetersPerSquareYard =
    Constants.metersPerYard * Constants.metersPerYard;

/**
 * Creates an `Area` from a number of square yards.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareYards = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareYard)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareYardExact));

/**
 * Converts an `Area` to a number of square yards.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareYards = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareYard
        : Numeric.divideExact(a.value, squareMetersPerSquareYardExact)) as K;

/** One acre is 4840 square yards. */
const squareYardsPerAcre = 4_840;
const squareMetersPerAcre = squareYardsPerAcre * squareMetersPerSquareYard;

/**
 * Creates an `Area` from a number of acres.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const acres = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerAcre)
        : make(Numeric.multiplyExact(n, squareMetersPerAcreExact));

/**
 * Converts an `Area` to a number of acres.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAcres = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerAcre
        : Numeric.divideExact(a.value, squareMetersPerAcreExact)) as K;

const squareMetersPerSquareMile =
    Constants.metersPerMile * Constants.metersPerMile;

/**
 * Creates an `Area` from a number of square miles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squareMiles = <N extends Quantity.Input>(n: N): Area<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * squareMetersPerSquareMile)
        : make(Numeric.multiplyExact(n, squareMetersPerSquareMileExact));

/**
 * Converts an `Area` to a number of square miles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inSquareMiles = <K extends Quantity.Value>(a: Area<K>): K =>
    (Predicate.isNumber(a.value)
        ? a.value / squareMetersPerSquareMile
        : Numeric.divideExact(a.value, squareMetersPerSquareMileExact)) as K;
