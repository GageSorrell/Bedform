/**
 * Energy quantities, stored in joules, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Energy` and `EnergyExact` modules.
 *
 * @module @bedform/effect/Unit/Energy
 *
 * @file      Energy.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Force from "./Force.js";
import * as Length from "./Length.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the joules unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Joules = Unit.Product<Force.Newtons, Length.Meters>;

/**
 * The joules unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Joules: Joules = Unit.product(Force.Newtons, Length.Meters);

/**
 * A quantity measured in `Joules`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Energy<K extends Quantity.Value = number> = Quantity.Quantity<Joules, K>;

/**
 * The identity schema for `Energy` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Energy = Quantity.Quantity(Joules);

/**
 * The codec between `Energy` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const EnergyFromStruct = Quantity.QuantityFromStruct(Joules);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Energy<K> => Quantity.make(Joules, value) as Energy<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/**
 * One kilowatt hour is one kilowatt (1000 joules per second) for one hour—
 * exactly 3600000 joules.
 */
const wattsPerKilowattExact = BigRational.makeUnsafe(1_000n);
const joulesPerKilowattHourExact = BigRational.multiply(
    wattsPerKilowattExact,
    ConstantsExact.secondsPerHour
);

/**
 * An `Energy` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `Energy` from a number of joules.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const joules = <N extends Quantity.Input>(n: N): Energy<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Energy` to a number of joules.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inJoules = <K extends Quantity.Value>(e: Energy<K>): K =>
    e.value;

/**
 * Creates an `Energy` from a number of kilojoules.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilojoules = <N extends Quantity.Input>(n: N): Energy<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts an `Energy` to a number of kilojoules.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilojoules = <K extends Quantity.Value>(e: Energy<K>): K =>
    Prefix.toPrefixed("Kilo", e.value);

/**
 * Creates an `Energy` from a number of megajoules.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const megajoules = <N extends Quantity.Input>(n: N): Energy<Quantity.Of<N>> =>
    make(Prefix.toBase("Mega", n));

/**
 * Converts an `Energy` to a number of megajoules.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMegajoules = <K extends Quantity.Value>(e: Energy<K>): K =>
    Prefix.toPrefixed("Mega", e.value);

/** One kilowatt hour is one kilowatt (1000 joules per second) for one hour. */
const wattsPerKilowatt = 1_000;
const joulesPerKilowattHour = wattsPerKilowatt * Constants.secondsPerHour;

/**
 * Creates an `Energy` from a number of kilowatt hours.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilowattHours = <N extends Quantity.Input>(n: N): Energy<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * joulesPerKilowattHour)
        : make(Numeric.multiplyExact(n, joulesPerKilowattHourExact));

/**
 * Converts an `Energy` to a number of kilowatt hours.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilowattHours = <K extends Quantity.Value>(e: Energy<K>): K =>
    (Predicate.isNumber(e.value)
        ? e.value / joulesPerKilowattHour
        : Numeric.divideExact(e.value, joulesPerKilowattHourExact)) as K;
