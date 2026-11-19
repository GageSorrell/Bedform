/**
 * Length quantities, stored in meters, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Length` and `LengthExact` modules.
 *
 * @module @bedform/effect/Unit/Length
 *
 * @file      Length.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Meters` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Meters = "Meters";

/**
 * The `Meters` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Meters: Meters = "Meters";

/**
 * A quantity measured in `Meters`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Length<K extends Quantity.Value = number> = Quantity.Quantity<Meters, K>;

/**
 * The identity schema for `Length` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Length = Quantity.Quantity(Meters);

/**
 * The codec between `Length` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const LengthFromStruct = Quantity.QuantityFromStruct(Meters);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Length<K> => Quantity.make(Meters, value) as Length<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const metersPerAngstromExact = BigRational.makeUnsafe(1n, 10n ** 10n);

/** One thou is one thousandth of an inch. */
const metersPerThouExact = BigRational.multiply(
    ConstantsExact.metersPerInch,
    BigRational.makeUnsafe(1n, 1_000n)
);

/** One CSS pixel is 1/96 of an inch. */
const metersPerCssPixelExact = BigRational.multiply(
    ConstantsExact.metersPerInch,
    BigRational.makeUnsafe(1n, 96n)
);

/** One point is 1/72 of an inch. */
const metersPerPointExact = BigRational.multiply(
    ConstantsExact.metersPerInch,
    BigRational.makeUnsafe(1n, 72n)
);

/** One pica is 1/6 of an inch. */
const metersPerPicaExact = BigRational.multiply(
    ConstantsExact.metersPerInch,
    BigRational.makeUnsafe(1n, 6n)
);

const metersPerAstronomicalUnitExact = BigRational.makeUnsafe(149_597_870_700n);

const metersPerLightYearExact = BigRational.makeUnsafe(9_460_730_472_580_800n);

/**
 * A `Length` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

// Metric

const metersPerAngstrom = 1e-10;

/**
 * Creates a `Length` from a number of angstroms.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const angstroms = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerAngstrom)
        : make(Numeric.multiplyExact(n, metersPerAngstromExact));

/**
 * Converts a `Length` to a number of angstroms.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAngstroms = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerAngstrom
        : Numeric.divideExact(l.value, metersPerAngstromExact)) as K;

/**
 * Creates a `Length` from a number of nanometers.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nanometers = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(Prefix.toBase("Nano", n));

/**
 * Converts a `Length` to a number of nanometers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNanometers = <K extends Quantity.Value>(l: Length<K>): K =>
    Prefix.toPrefixed("Nano", l.value);

/**
 * Creates a `Length` from a number of microns.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const microns = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(Prefix.toBase("Micro", n));

/**
 * Converts a `Length` to a number of microns.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicrons = <K extends Quantity.Value>(l: Length<K>): K =>
    Prefix.toPrefixed("Micro", l.value);

/**
 * Creates a `Length` from a number of kilometers.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilometers = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts a `Length` to a number of kilometers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilometers = <K extends Quantity.Value>(l: Length<K>): K =>
    Prefix.toPrefixed("Kilo", l.value);

/**
 * Creates a `Length` from a number of meters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const meters = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Length` to a number of meters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMeters = <K extends Quantity.Value>(l: Length<K>): K =>
    l.value;

/**
 * Creates a `Length` from a number of centimeters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const centimeters = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(Prefix.toBase("Centi", n));

/**
 * Converts a `Length` to a number of centimeters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCentimeters = <K extends Quantity.Value>(l: Length<K>): K =>
    Prefix.toPrefixed("Centi", l.value);

/**
 * Creates a `Length` from a number of millimeters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const millimeters = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    make(Prefix.toBase("Milli", n));

/**
 * Converts a `Length` to a number of millimeters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMillimeters = <K extends Quantity.Value>(l: Length<K>): K =>
    Prefix.toPrefixed("Milli", l.value);

// Imperial

/**
 * One thou is one thousandth of an inch: exactly 127/5,000,000 meters,
 * written as one division of exact integers so the factor is the correctly
 * rounded float of the defined value (dividing the already-rounded
 * metersPerInch would land one ulp off).
 */
const metersPerThou = 127 / 5_000_000;

/**
 * Creates a `Length` from a number of thou.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const thou = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerThou)
        : make(Numeric.multiplyExact(n, metersPerThouExact));

/**
 * Converts a `Length` to a number of thou.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inThou = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerThou
        : Numeric.divideExact(l.value, metersPerThouExact)) as K;

/**
 * Creates a `Length` from a number of inches.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const inches = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerInch)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerInch));

/**
 * Converts a `Length` to a number of inches.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inInches = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / Constants.metersPerInch
        : Numeric.divideExact(l.value, ConstantsExact.metersPerInch)) as K;

/**
 * Creates a `Length` from a number of feet.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const feet = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerFoot)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerFoot));

/**
 * Converts a `Length` to a number of feet.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFeet = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / Constants.metersPerFoot
        : Numeric.divideExact(l.value, ConstantsExact.metersPerFoot)) as K;

/**
 * Creates a `Length` from a number of yards.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const yards = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerYard)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerYard));

/**
 * Converts a `Length` to a number of yards.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inYards = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / Constants.metersPerYard
        : Numeric.divideExact(l.value, ConstantsExact.metersPerYard)) as K;

/**
 * Creates a `Length` from a number of miles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const miles = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * Constants.metersPerMile)
        : make(Numeric.multiplyExact(n, ConstantsExact.metersPerMile));

/**
 * Converts a `Length` to a number of miles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMiles = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / Constants.metersPerMile
        : Numeric.divideExact(l.value, ConstantsExact.metersPerMile)) as K;

// Typography

/** One CSS pixel is 1/96 of an inch: exactly 127/480,000 meters. */
const metersPerCssPixel = 127 / 480_000;

/**
 * Creates a `Length` from a number of CSS pixels.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cssPixels = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerCssPixel)
        : make(Numeric.multiplyExact(n, metersPerCssPixelExact));

/**
 * Converts a `Length` to a number of CSS pixels.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCssPixels = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerCssPixel
        : Numeric.divideExact(l.value, metersPerCssPixelExact)) as K;

/** One point is 1/72 of an inch. */
const metersPerPoint = Constants.metersPerInch / 72;

/**
 * Creates a `Length` from a number of points.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const points = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerPoint)
        : make(Numeric.multiplyExact(n, metersPerPointExact));

/**
 * Converts a `Length` to a number of points.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPoints = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerPoint
        : Numeric.divideExact(l.value, metersPerPointExact)) as K;

/** One pica is 1/6 of an inch: exactly 127/30,000 meters. */
const metersPerPica = 127 / 30_000;

/**
 * Creates a `Length` from a number of picas.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const picas = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerPica)
        : make(Numeric.multiplyExact(n, metersPerPicaExact));

/**
 * Converts a `Length` to a number of picas.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPicas = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerPica
        : Numeric.divideExact(l.value, metersPerPicaExact)) as K;

// Astronomical

const metersPerAstronomicalUnit = 149_597_870_700;

/**
 * Creates a `Length` from a number of astronomical units.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const astronomicalUnits = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerAstronomicalUnit)
        : make(Numeric.multiplyExact(n, metersPerAstronomicalUnitExact));

/**
 * Converts a `Length` to a number of astronomical units.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAstronomicalUnits = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerAstronomicalUnit
        : Numeric.divideExact(l.value, metersPerAstronomicalUnitExact)) as K;

/** One parsec is 648,000/π astronomical units. */
const metersPerParsec = (metersPerAstronomicalUnit * 648_000) / Math.PI;

/**
 * Creates a `Length` from a number of parsecs.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const parsecs = <N extends Quantity.Input>(n: N): Length =>
    Predicate.isNumber(n)
        ? make(n * metersPerParsec)
        : make(Numeric.float(n) * metersPerParsec);

/**
 * Converts a `Length` to a number of parsecs.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inParsecs = <K extends Quantity.Value>(l: Length<K>): number =>
    Numeric.toFloat(l.value) / metersPerParsec;

const metersPerLightYear = 9_460_730_472_580_800;

/**
 * Creates a `Length` from a number of light years.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const lightYears = <N extends Quantity.Input>(n: N): Length<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * metersPerLightYear)
        : make(Numeric.multiplyExact(n, metersPerLightYearExact));

/**
 * Converts a `Length` to a number of light years.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inLightYears = <K extends Quantity.Value>(l: Length<K>): K =>
    (Predicate.isNumber(l.value)
        ? l.value / metersPerLightYear
        : Numeric.divideExact(l.value, metersPerLightYearExact)) as K;
