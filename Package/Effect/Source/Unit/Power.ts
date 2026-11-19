/**
 * Power quantities, stored in watts, with constructors and conversions for common
 * units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Power` and `PowerExact` modules.
 *
 * @module @bedform/effect/Unit/Power
 *
 * @file      Power.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Duration from "./Duration.js";
import * as Energy from "./Energy.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the watts unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Watts = Unit.Rate<Energy.Joules, Duration.Seconds>;

/**
 * The watts unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Watts: Watts = Unit.rate(Energy.Joules, Duration.Seconds);

/**
 * A quantity measured in `Watts`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Power<K extends Quantity.Value = number> = Quantity.Quantity<Watts, K>;

/**
 * The identity schema for `Power` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Power = Quantity.Quantity(Watts);

/**
 * The codec between `Power` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const PowerFromStruct = Quantity.QuantityFromStruct(Watts);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Power<K> => Quantity.make(Watts, value) as Power<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/** One metric horsepower is 735.49875 (exactly 588399/800) watts. */
const wattsPerMetricHorsepowerExact = BigRational.makeUnsafe(73_549_875n, 100_000n);

/**
 * One mechanical horsepower is 550 foot pounds of force per second—exactly
 * 37284993579113511/50000000000000 (745.69987158227022) watts.
 */
const footPoundsPerSecondPerMechanicalHorsepowerExact = BigRational.makeUnsafe(550n);
const wattsPerMechanicalHorsepowerExact = BigRational.multiply(
    footPoundsPerSecondPerMechanicalHorsepowerExact,
    BigRational.multiply(
        ConstantsExact.newtonsPerPoundForce,
        ConstantsExact.metersPerFoot
    )
);

/** One electrical horsepower is 746 watts. */
const wattsPerElectricalHorsepowerExact = BigRational.makeUnsafe(746n);

/**
 * A `Power` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Power` from a number of watts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const watts = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Power` to a number of watts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inWatts = <K extends Quantity.Value>(p: Power<K>): K =>
    p.value;

/**
 * Creates a `Power` from a number of kilowatts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilowatts = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts a `Power` to a number of kilowatts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilowatts = <K extends Quantity.Value>(p: Power<K>): K =>
    Prefix.toPrefixed("Kilo", p.value);

/**
 * Creates a `Power` from a number of megawatts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const megawatts = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    make(Prefix.toBase("Mega", n));

/**
 * Converts a `Power` to a number of megawatts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMegawatts = <K extends Quantity.Value>(p: Power<K>): K =>
    Prefix.toPrefixed("Mega", p.value);

/** One metric horsepower is 735.49875 watts. */
const wattsPerMetricHorsepower = 735.49875;

/**
 * Creates a `Power` from a number of metric horsepower.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const metricHorsepower = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * wattsPerMetricHorsepower)
        : make(Numeric.multiplyExact(n, wattsPerMetricHorsepowerExact));

/**
 * Converts a `Power` to a number of metric horsepower.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMetricHorsepower = <K extends Quantity.Value>(p: Power<K>): K =>
    (Predicate.isNumber(p.value)
        ? p.value / wattsPerMetricHorsepower
        : Numeric.divideExact(p.value, wattsPerMetricHorsepowerExact)) as K;

/** One mechanical horsepower is 550 foot pounds of force per second. */
const footPoundsPerSecondPerMechanicalHorsepower = 550;
const wattsPerMechanicalHorsepower =
    footPoundsPerSecondPerMechanicalHorsepower *
  Constants.newtonsPerPoundForce *
  Constants.metersPerFoot;

/**
 * Creates a `Power` from a number of mechanical horsepower.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const mechanicalHorsepower = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * wattsPerMechanicalHorsepower)
        : make(Numeric.multiplyExact(n, wattsPerMechanicalHorsepowerExact));

/**
 * Converts a `Power` to a number of mechanical horsepower.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMechanicalHorsepower = <K extends Quantity.Value>(p: Power<K>): K =>
    (Predicate.isNumber(p.value)
        ? p.value / wattsPerMechanicalHorsepower
        : Numeric.divideExact(p.value, wattsPerMechanicalHorsepowerExact)) as K;

/** One electrical horsepower is 746 watts. */
const wattsPerElectricalHorsepower = 746;

/**
 * Creates a `Power` from a number of electrical horsepower.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const electricalHorsepower = <N extends Quantity.Input>(n: N): Power<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * wattsPerElectricalHorsepower)
        : make(Numeric.multiplyExact(n, wattsPerElectricalHorsepowerExact));

/**
 * Converts a `Power` to a number of electrical horsepower.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inElectricalHorsepower = <K extends Quantity.Value>(p: Power<K>): K =>
    (Predicate.isNumber(p.value)
        ? p.value / wattsPerElectricalHorsepower
        : Numeric.divideExact(p.value, wattsPerElectricalHorsepowerExact)) as K;
