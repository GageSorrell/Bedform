/**
 * Density quantities, stored in kilograms per cubic meter, with constructors and
 * conversions for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Density` and `DensityExact` modules.
 *
 * @module @bedform/effect/Unit/Density
 *
 * @file      Density.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Mass from "./Mass.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";
import * as Volume from "./Volume.js";

/**
 * The type of the kilograms per cubic meter unit, composed from other units with
 * the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type KilogramsPerCubicMeter = Unit.Rate<
    Mass.Kilograms,
    Volume.CubicMeters
>;

/**
 * The kilograms per cubic meter unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const KilogramsPerCubicMeter: KilogramsPerCubicMeter = Unit.rate(
    Mass.Kilograms,
    Volume.CubicMeters
);

/**
 * A quantity measured in `KilogramsPerCubicMeter`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Density<K extends Quantity.Value = number> = Quantity.Quantity<KilogramsPerCubicMeter, K>;

/**
 * The identity schema for `Density` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Density = Quantity.Quantity(KilogramsPerCubicMeter);

/**
 * The codec between `Density` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const DensityFromStruct = Quantity.QuantityFromStruct(
    KilogramsPerCubicMeter
);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Density<K> => Quantity.make(KilogramsPerCubicMeter, value) as Density<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const cubeExact = (r: BigRational.BigRational): BigRational.BigRational =>
    BigRational.multiply(BigRational.multiply(r, r), r);

/**
 * A gram is a milli-kilogram; a cubic centimeter is a centi-meter cubed—
 * exactly 1000 kilograms per cubic meter.
 */
const kilogramsPerCubicMeterPerGramPerCubicCentimeterExact = BigRational.divideUnsafe(
    Prefix.toBase("Milli", BigRational.one),
    cubeExact(Prefix.toBase("Centi", BigRational.one))
);

/**
 * One pound per cubic inch is exactly 56699046250/2048383 kilograms per
 * cubic meter.
 */
const kilogramsPerCubicMeterPerPoundPerCubicInchExact = BigRational.divideUnsafe(
    ConstantsExact.kilogramsPerPound,
    cubeExact(ConstantsExact.metersPerInch)
);

/**
 * One pound per cubic foot is exactly 28349523125/1769802912 kilograms per
 * cubic meter.
 */
const kilogramsPerCubicMeterPerPoundPerCubicFootExact = BigRational.divideUnsafe(
    ConstantsExact.kilogramsPerPound,
    cubeExact(ConstantsExact.metersPerFoot)
);

/**
 * A `Density` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Density` from a number of kilograms per cubic meter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilogramsPerCubicMeter = <N extends Quantity.Input>(n: N): Density<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Density` to a number of kilograms per cubic meter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilogramsPerCubicMeter = <K extends Quantity.Value>(d: Density<K>): K =>
    d.value;

/**
 * A gram is a milli-kilogram; a cubic centimeter is a centi-meter cubed—
 * exactly 1000 kg/m^3. A literal rather than a prefix-factor quotient,
 * which evaluates to 999.9999999999999.
 */
const kilogramsPerCubicMeterPerGramPerCubicCentimeter = 1_000;

/**
 * Creates a `Density` from a number of grams per cubic centimeter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const gramsPerCubicCentimeter = <N extends Quantity.Input>(n: N): Density<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerCubicMeterPerGramPerCubicCentimeter)
        : make(Numeric.multiplyExact(n, kilogramsPerCubicMeterPerGramPerCubicCentimeterExact));

/**
 * Converts a `Density` to a number of grams per cubic centimeter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inGramsPerCubicCentimeter = <K extends Quantity.Value>(d: Density<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / kilogramsPerCubicMeterPerGramPerCubicCentimeter
        : Numeric.divideExact(d.value, kilogramsPerCubicMeterPerGramPerCubicCentimeterExact)) as K;

/**
 * Exactly 56,699,046,250/2,048,383 kg/m^3 (the pound and cubed-inch
 * definitions combined into one reduced fraction), written as one division
 * of exact integers so the factor is correctly rounded—chaining the
 * already-rounded constants would land one ulp off.
 */
const kilogramsPerCubicMeterPerPoundPerCubicInch = 56_699_046_250 / 2_048_383;

/**
 * Creates a `Density` from a number of pounds per cubic inch.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const poundsPerCubicInch = <N extends Quantity.Input>(n: N): Density<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerCubicMeterPerPoundPerCubicInch)
        : make(Numeric.multiplyExact(n, kilogramsPerCubicMeterPerPoundPerCubicInchExact));

/**
 * Converts a `Density` to a number of pounds per cubic inch.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPoundsPerCubicInch = <K extends Quantity.Value>(d: Density<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / kilogramsPerCubicMeterPerPoundPerCubicInch
        : Numeric.divideExact(d.value, kilogramsPerCubicMeterPerPoundPerCubicInchExact)) as K;

const kilogramsPerCubicMeterPerPoundPerCubicFoot =
    Constants.kilogramsPerPound /
  (Constants.metersPerFoot * Constants.metersPerFoot * Constants.metersPerFoot);

/**
 * Creates a `Density` from a number of pounds per cubic foot.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const poundsPerCubicFoot = <N extends Quantity.Input>(n: N): Density<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * kilogramsPerCubicMeterPerPoundPerCubicFoot)
        : make(Numeric.multiplyExact(n, kilogramsPerCubicMeterPerPoundPerCubicFootExact));

/**
 * Converts a `Density` to a number of pounds per cubic foot.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPoundsPerCubicFoot = <K extends Quantity.Value>(d: Density<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / kilogramsPerCubicMeterPerPoundPerCubicFoot
        : Numeric.divideExact(d.value, kilogramsPerCubicMeterPerPoundPerCubicFootExact)) as K;
