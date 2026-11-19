/**
 * Volume quantities, stored in cubic meters, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Volume` and `VolumeExact` modules.
 *
 * @module @bedform/effect/Unit/Volume
 *
 * @file      Volume.ts
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
 * The type of the cubic meters unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type CubicMeters = Unit.Cubed<Length.Meters>;

/**
 * The cubic meters unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const CubicMeters: CubicMeters = Unit.cubed(Length.Meters);

/**
 * A quantity measured in `CubicMeters`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Volume<K extends Quantity.Value = number> = Quantity.Quantity<CubicMeters, K>;

/**
 * The identity schema for `Volume` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Volume = Quantity.Quantity(CubicMeters);

/**
 * The codec between `Volume` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const VolumeFromStruct = Quantity.QuantityFromStruct(CubicMeters);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Volume<K> => Quantity.make(CubicMeters, value) as Volume<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const cubedExact = (r: BigRational.BigRational) =>
    BigRational.multiply(BigRational.multiply(r, r), r);

const cubicMetersPerLiterExact = BigRational.makeUnsafe(1n, 1_000n);

const cubicMetersPerMilliliterExact = Prefix.toBase(
    "Milli",
    cubicMetersPerLiterExact
);

const cubicMetersPerCubicInchExact = cubedExact(ConstantsExact.metersPerInch);

const cubicMetersPerCubicFootExact = cubedExact(ConstantsExact.metersPerFoot);

const cubicMetersPerCubicYardExact = cubedExact(ConstantsExact.metersPerYard);

const cubicMetersPerUsLiquidGallonExact = BigRational.makeUnsafe(
    3_785_411_784n,
    10n ** 12n
);

const cubicMetersPerUsLiquidQuartExact = BigRational.multiply(
    cubicMetersPerUsLiquidGallonExact,
    BigRational.makeUnsafe(1n, 4n)
);

const cubicMetersPerUsLiquidPintExact = BigRational.multiply(
    cubicMetersPerUsLiquidGallonExact,
    BigRational.makeUnsafe(1n, 8n)
);

/** One US fluid ounce is 1/128 of a US liquid gallon. */
const cubicMetersPerUsFluidOunceExact = BigRational.multiply(
    cubicMetersPerUsLiquidGallonExact,
    BigRational.makeUnsafe(1n, 128n)
);

const cubicMetersPerUsDryGallonExact = BigRational.makeUnsafe(
    440_488_377_086n,
    10n ** 14n
);

const cubicMetersPerUsDryQuartExact = BigRational.multiply(
    cubicMetersPerUsDryGallonExact,
    BigRational.makeUnsafe(1n, 4n)
);

const cubicMetersPerUsDryPintExact = BigRational.multiply(
    cubicMetersPerUsDryGallonExact,
    BigRational.makeUnsafe(1n, 8n)
);

const cubicMetersPerImperialGallonExact = BigRational.makeUnsafe(454_609n, 10n ** 8n);

const cubicMetersPerImperialQuartExact = BigRational.multiply(
    cubicMetersPerImperialGallonExact,
    BigRational.makeUnsafe(1n, 4n)
);

const cubicMetersPerImperialPintExact = BigRational.multiply(
    cubicMetersPerImperialGallonExact,
    BigRational.makeUnsafe(1n, 8n)
);

/** One imperial fluid ounce is 1/160 of an imperial gallon. */
const cubicMetersPerImperialFluidOunceExact = BigRational.multiply(
    cubicMetersPerImperialGallonExact,
    BigRational.makeUnsafe(1n, 160n)
);

/**
 * A `Volume` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

// Metric

/**
 * Creates a `Volume` from a number of cubic meters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubicMeters = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Volume` to a number of cubic meters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCubicMeters = <K extends Quantity.Value>(v: Volume<K>): K =>
    v.value;

const cubicMetersPerLiter = 0.001;

/**
 * Creates a `Volume` from a number of liters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const liters = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerLiter)
        : make(Numeric.multiplyExact(n, cubicMetersPerLiterExact));

/**
 * Converts a `Volume` to a number of liters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inLiters = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerLiter
        : Numeric.divideExact(v.value, cubicMetersPerLiterExact)) as K;

const cubicMetersPerMilliliter = Prefix.toBase("Milli", cubicMetersPerLiter);

/**
 * Creates a `Volume` from a number of milliliters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milliliters = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerMilliliter)
        : make(Numeric.multiplyExact(n, cubicMetersPerMilliliterExact));

/**
 * Converts a `Volume` to a number of milliliters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilliliters = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerMilliliter
        : Numeric.divideExact(v.value, cubicMetersPerMilliliterExact)) as K;

/**
 * Creates a `Volume` from a number of cubic centimeters.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubicCentimeters = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerMilliliter)
        : make(Numeric.multiplyExact(n, cubicMetersPerMilliliterExact));

/**
 * Converts a `Volume` to a number of cubic centimeters.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCubicCentimeters = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerMilliliter
        : Numeric.divideExact(v.value, cubicMetersPerMilliliterExact)) as K;

// Imperial

const cubicMetersPerCubicInch =
    Constants.metersPerInch * Constants.metersPerInch * Constants.metersPerInch;

/**
 * Creates a `Volume` from a number of cubic inches.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubicInches = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerCubicInch)
        : make(Numeric.multiplyExact(n, cubicMetersPerCubicInchExact));

/**
 * Converts a `Volume` to a number of cubic inches.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCubicInches = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerCubicInch
        : Numeric.divideExact(v.value, cubicMetersPerCubicInchExact)) as K;

/**
 * Exactly (381/1250)^3 = 0.028316846592 cubic meters, written as one
 * division of exact integers so the factor is correctly rounded (cubing the
 * already-rounded foot would land one ulp off).
 */
const cubicMetersPerCubicFoot = (381 * 381 * 381) / (1_250 * 1_250 * 1_250);

/**
 * Creates a `Volume` from a number of cubic feet.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubicFeet = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerCubicFoot)
        : make(Numeric.multiplyExact(n, cubicMetersPerCubicFootExact));

/**
 * Converts a `Volume` to a number of cubic feet.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCubicFeet = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerCubicFoot
        : Numeric.divideExact(v.value, cubicMetersPerCubicFootExact)) as K;

const cubicMetersPerCubicYard =
    Constants.metersPerYard * Constants.metersPerYard * Constants.metersPerYard;

/**
 * Creates a `Volume` from a number of cubic yards.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubicYards = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerCubicYard)
        : make(Numeric.multiplyExact(n, cubicMetersPerCubicYardExact));

/**
 * Converts a `Volume` to a number of cubic yards.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCubicYards = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerCubicYard
        : Numeric.divideExact(v.value, cubicMetersPerCubicYardExact)) as K;

// US liquid

const cubicMetersPerUsLiquidGallon = 0.003785411784;

/**
 * Creates a `Volume` from a number of us liquid gallons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usLiquidGallons = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsLiquidGallon)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsLiquidGallonExact));

/**
 * Converts a `Volume` to a number of us liquid gallons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsLiquidGallons = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsLiquidGallon
        : Numeric.divideExact(v.value, cubicMetersPerUsLiquidGallonExact)) as K;

const cubicMetersPerUsLiquidQuart = cubicMetersPerUsLiquidGallon / 4;

/**
 * Creates a `Volume` from a number of us liquid quarts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usLiquidQuarts = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsLiquidQuart)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsLiquidQuartExact));

/**
 * Converts a `Volume` to a number of us liquid quarts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsLiquidQuarts = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsLiquidQuart
        : Numeric.divideExact(v.value, cubicMetersPerUsLiquidQuartExact)) as K;

const cubicMetersPerUsLiquidPint = cubicMetersPerUsLiquidGallon / 8;

/**
 * Creates a `Volume` from a number of us liquid pints.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usLiquidPints = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsLiquidPint)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsLiquidPintExact));

/**
 * Converts a `Volume` to a number of us liquid pints.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsLiquidPints = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsLiquidPint
        : Numeric.divideExact(v.value, cubicMetersPerUsLiquidPintExact)) as K;

/** One US fluid ounce is 1/128 of a US liquid gallon. */
const cubicMetersPerUsFluidOunce = cubicMetersPerUsLiquidGallon / 128;

/**
 * Creates a `Volume` from a number of us fluid ounces.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usFluidOunces = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsFluidOunce)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsFluidOunceExact));

/**
 * Converts a `Volume` to a number of us fluid ounces.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsFluidOunces = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsFluidOunce
        : Numeric.divideExact(v.value, cubicMetersPerUsFluidOunceExact)) as K;

// US dry

const cubicMetersPerUsDryGallon = 0.00440488377086;

/**
 * Creates a `Volume` from a number of us dry gallons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usDryGallons = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsDryGallon)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsDryGallonExact));

/**
 * Converts a `Volume` to a number of us dry gallons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsDryGallons = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsDryGallon
        : Numeric.divideExact(v.value, cubicMetersPerUsDryGallonExact)) as K;

const cubicMetersPerUsDryQuart = cubicMetersPerUsDryGallon / 4;

/**
 * Creates a `Volume` from a number of us dry quarts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usDryQuarts = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsDryQuart)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsDryQuartExact));

/**
 * Converts a `Volume` to a number of us dry quarts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsDryQuarts = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsDryQuart
        : Numeric.divideExact(v.value, cubicMetersPerUsDryQuartExact)) as K;

const cubicMetersPerUsDryPint = cubicMetersPerUsDryGallon / 8;

/**
 * Creates a `Volume` from a number of us dry pints.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const usDryPints = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerUsDryPint)
        : make(Numeric.multiplyExact(n, cubicMetersPerUsDryPintExact));

/**
 * Converts a `Volume` to a number of us dry pints.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inUsDryPints = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerUsDryPint
        : Numeric.divideExact(v.value, cubicMetersPerUsDryPintExact)) as K;

// Imperial (UK)

const cubicMetersPerImperialGallon = 0.00454609;

/**
 * Creates a `Volume` from a number of imperial gallons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const imperialGallons = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerImperialGallon)
        : make(Numeric.multiplyExact(n, cubicMetersPerImperialGallonExact));

/**
 * Converts a `Volume` to a number of imperial gallons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inImperialGallons = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerImperialGallon
        : Numeric.divideExact(v.value, cubicMetersPerImperialGallonExact)) as K;

const cubicMetersPerImperialQuart = cubicMetersPerImperialGallon / 4;

/**
 * Creates a `Volume` from a number of imperial quarts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const imperialQuarts = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerImperialQuart)
        : make(Numeric.multiplyExact(n, cubicMetersPerImperialQuartExact));

/**
 * Converts a `Volume` to a number of imperial quarts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inImperialQuarts = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerImperialQuart
        : Numeric.divideExact(v.value, cubicMetersPerImperialQuartExact)) as K;

const cubicMetersPerImperialPint = cubicMetersPerImperialGallon / 8;

/**
 * Creates a `Volume` from a number of imperial pints.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const imperialPints = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerImperialPint)
        : make(Numeric.multiplyExact(n, cubicMetersPerImperialPintExact));

/**
 * Converts a `Volume` to a number of imperial pints.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inImperialPints = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerImperialPint
        : Numeric.divideExact(v.value, cubicMetersPerImperialPintExact)) as K;

/** One imperial fluid ounce is 1/160 of an imperial gallon. */
const cubicMetersPerImperialFluidOunce = cubicMetersPerImperialGallon / 160;

/**
 * Creates a `Volume` from a number of imperial fluid ounces.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const imperialFluidOunces = <N extends Quantity.Input>(n: N): Volume<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * cubicMetersPerImperialFluidOunce)
        : make(Numeric.multiplyExact(n, cubicMetersPerImperialFluidOunceExact));

/**
 * Converts a `Volume` to a number of imperial fluid ounces.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inImperialFluidOunces = <K extends Quantity.Value>(v: Volume<K>): K =>
    (Predicate.isNumber(v.value)
        ? v.value / cubicMetersPerImperialFluidOunce
        : Numeric.divideExact(v.value, cubicMetersPerImperialFluidOunceExact)) as K;
