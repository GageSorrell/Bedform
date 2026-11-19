/**
 * Mass quantities, stored in kilograms, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Mass` and `MassExact` modules.
 *
 * @module @bedform/effect/Unit/Mass
 *
 * @file      Mass.ts
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
 * The type of the `Kilograms` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Kilograms = "Kilograms";

/**
 * The `Kilograms` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Kilograms: Kilograms = "Kilograms";

/**
 * A quantity measured in `Kilograms`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Mass<K extends Quantity.Value = number> = Quantity.Quantity<Kilograms, K>;

/**
 * The identity schema for `Mass` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Mass = Quantity.Quantity(Kilograms);

/**
 * The codec between `Mass` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const MassFromStruct = Quantity.QuantityFromStruct(Kilograms);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Mass<K> => Quantity.make(Kilograms, value) as Mass<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const kilogramsPerGramExact = Prefix.toPrefixed("Kilo", BigRational.one);

const kilogramsPerMilligramExact = Prefix.toBase("Milli", kilogramsPerGramExact);

const kilogramsPerMicrogramExact = Prefix.toBase("Micro", kilogramsPerGramExact);

const kilogramsPerNanogramExact = Prefix.toBase("Nano", kilogramsPerGramExact);

const kilogramsPerMetricTonExact = BigRational.makeUnsafe(1_000n);

const kilogramsPerPoundExact = ConstantsExact.kilogramsPerPound;

/** One ounce is 1/16 of a pound. */
const kilogramsPerOunceExact = BigRational.multiply(
    kilogramsPerPoundExact,
    BigRational.makeUnsafe(1n, 16n)
);

/** One long ton (UK) is 2240 pounds. */
const kilogramsPerLongTonExact = BigRational.multiply(
    kilogramsPerPoundExact,
    BigRational.makeUnsafe(2_240n)
);

/** One short ton (US) is 2000 pounds. */
const kilogramsPerShortTonExact = BigRational.multiply(
    kilogramsPerPoundExact,
    BigRational.makeUnsafe(2_000n)
);

/**
 * A `Mass` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

// Metric

/**
 * Creates a `Mass` from a number of kilograms.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilograms = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Mass` to a number of kilograms.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilograms = <K extends Quantity.Value>(m: Mass<K>): K =>
    m.value;

const kilogramsPerGram = Prefix.toPrefixed("Kilo", 1);

/**
 * Creates a `Mass` from a number of grams.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const grams = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerGram)
        : make(Numeric.multiplyExact(n, kilogramsPerGramExact));

/**
 * Converts a `Mass` to a number of grams.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inGrams = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerGram
        : Numeric.divideExact(m.value, kilogramsPerGramExact)) as K;

const kilogramsPerMilligram = Prefix.toBase("Milli", kilogramsPerGram);

/**
 * Creates a `Mass` from a number of milligrams.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milligrams = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerMilligram)
        : make(Numeric.multiplyExact(n, kilogramsPerMilligramExact));

/**
 * Converts a `Mass` to a number of milligrams.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilligrams = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerMilligram
        : Numeric.divideExact(m.value, kilogramsPerMilligramExact)) as K;

const kilogramsPerMicrogram = Prefix.toBase("Micro", kilogramsPerGram);

/**
 * Creates a `Mass` from a number of micrograms.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const micrograms = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerMicrogram)
        : make(Numeric.multiplyExact(n, kilogramsPerMicrogramExact));

/**
 * Converts a `Mass` to a number of micrograms.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicrograms = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerMicrogram
        : Numeric.divideExact(m.value, kilogramsPerMicrogramExact)) as K;

// A literal rather than a prefix chain: composing two power-of-ten factors
// rounds twice and lands one ulp off the true 10^-12.
const kilogramsPerNanogram = 1e-12;

/**
 * Creates a `Mass` from a number of nanograms.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nanograms = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerNanogram)
        : make(Numeric.multiplyExact(n, kilogramsPerNanogramExact));

/**
 * Converts a `Mass` to a number of nanograms.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNanograms = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerNanogram
        : Numeric.divideExact(m.value, kilogramsPerNanogramExact)) as K;

const kilogramsPerMetricTon = 1_000;

/**
 * Creates a `Mass` from a number of metric tons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const metricTons = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerMetricTon)
        : make(Numeric.multiplyExact(n, kilogramsPerMetricTonExact));

/**
 * Converts a `Mass` to a number of metric tons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMetricTons = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerMetricTon
        : Numeric.divideExact(m.value, kilogramsPerMetricTonExact)) as K;

// Imperial

const kilogramsPerPound = Constants.kilogramsPerPound;

/** One ounce is 1/16 of a pound. */
const kilogramsPerOunce = kilogramsPerPound / 16;

/**
 * Creates a `Mass` from a number of ounces.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ounces = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerOunce)
        : make(Numeric.multiplyExact(n, kilogramsPerOunceExact));

/**
 * Converts a `Mass` to a number of ounces.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inOunces = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerOunce
        : Numeric.divideExact(m.value, kilogramsPerOunceExact)) as K;

/**
 * Creates a `Mass` from a number of pounds.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pounds = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerPound)
        : make(Numeric.multiplyExact(n, kilogramsPerPoundExact));

/**
 * Converts a `Mass` to a number of pounds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPounds = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerPound
        : Numeric.divideExact(m.value, kilogramsPerPoundExact)) as K;

/**
 * One long ton (UK) is 2240 pounds: exactly 1016.0469088 kg, written as one
 * division of exact integers so the factor is correctly rounded
 * (multiplying the already-rounded pound would land one ulp off).
 */
const kilogramsPerLongTon = (45_359_237 * 2_240) / 1e8;

/**
 * Creates a `Mass` from a number of long tons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const longTons = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerLongTon)
        : make(Numeric.multiplyExact(n, kilogramsPerLongTonExact));

/**
 * Converts a `Mass` to a number of long tons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inLongTons = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerLongTon
        : Numeric.divideExact(m.value, kilogramsPerLongTonExact)) as K;

/** One short ton (US) is 2000 pounds. */
const kilogramsPerShortTon = kilogramsPerPound * 2_000;

/**
 * Creates a `Mass` from a number of short tons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const shortTons = <N extends Quantity.Input>(n: N): Mass<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerShortTon)
        : make(Numeric.multiplyExact(n, kilogramsPerShortTonExact));

/**
 * Converts a `Mass` to a number of short tons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inShortTons = <K extends Quantity.Value>(m: Mass<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / kilogramsPerShortTon
        : Numeric.divideExact(m.value, kilogramsPerShortTonExact)) as K;
