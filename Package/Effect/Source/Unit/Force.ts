/**
 * Force quantities, stored in newtons, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Force` and `ForceExact` modules.
 *
 * @module @bedform/effect/Unit/Force
 *
 * @file      Force.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Acceleration from "./Acceleration.js";
import * as BigRational from "../BigRational.js";
import * as Constants from "./Internal/constants.js";
import * as ConstantsExact from "./Internal/constantsExact.js";
import * as Mass from "./Mass.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the newtons unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Newtons = Unit.Product<
    Mass.Kilograms,
    Acceleration.MetersPerSecondSquared
>;

/**
 * The newtons unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Newtons: Newtons = Unit.product(
    Mass.Kilograms,
    Acceleration.MetersPerSecondSquared
);

/**
 * A quantity measured in `Newtons`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Force<K extends Quantity.Value = number> = Quantity.Quantity<Newtons, K>;

/**
 * The identity schema for `Force` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Force = Quantity.Quantity(Newtons);

/**
 * The codec between `Force` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const ForceFromStruct = Quantity.QuantityFromStruct(Newtons);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Force<K> => Quantity.make(Newtons, value) as Force<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const newtonsPerPoundExact = ConstantsExact.newtonsPerPoundForce;

/**
 * One kip is 1000 pounds of force—exactly 8896443230521/2000000000
 * (4448.2216152605) newtons.
 */
const newtonsPerKipExact = BigRational.multiply(
    newtonsPerPoundExact,
    BigRational.makeUnsafe(1_000n)
);

/**
 * A `Force` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Force` from a number of newtons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const newtons = <N extends Quantity.Input>(n: N): Force<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Force` to a number of newtons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNewtons = <K extends Quantity.Value>(f: Force<K>): K =>
    f.value;

/**
 * Creates a `Force` from a number of kilonewtons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilonewtons = <N extends Quantity.Input>(n: N): Force<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts a `Force` to a number of kilonewtons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilonewtons = <K extends Quantity.Value>(f: Force<K>): K =>
    Prefix.toPrefixed("Kilo", f.value);

/**
 * Creates a `Force` from a number of meganewtons.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const meganewtons = <N extends Quantity.Input>(n: N): Force<Quantity.Of<N>> =>
    make(Prefix.toBase("Mega", n));

/**
 * Converts a `Force` to a number of meganewtons.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMeganewtons = <K extends Quantity.Value>(f: Force<K>): K =>
    Prefix.toPrefixed("Mega", f.value);

const newtonsPerPound = Constants.newtonsPerPoundForce;

/**
 * Creates a `Force` from a number of pounds.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const pounds = <N extends Quantity.Input>(n: N): Force<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * newtonsPerPound)
        : make(Numeric.multiplyExact(n, newtonsPerPoundExact));

/**
 * Converts a `Force` to a number of pounds.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPounds = <K extends Quantity.Value>(f: Force<K>): K =>
    (Predicate.isNumber(f.value)
        ? f.value / newtonsPerPound
        : Numeric.divideExact(f.value, newtonsPerPoundExact)) as K;

/** One kip is 1000 pounds of force. */
const newtonsPerKip = newtonsPerPound * 1_000;

/**
 * Creates a `Force` from a number of kips.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kips = <N extends Quantity.Input>(n: N): Force<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * newtonsPerKip)
        : make(Numeric.multiplyExact(n, newtonsPerKipExact));

/**
 * Converts a `Force` to a number of kips.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKips = <K extends Quantity.Value>(f: Force<K>): K =>
    (Predicate.isNumber(f.value)
        ? f.value / newtonsPerKip
        : Numeric.divideExact(f.value, newtonsPerKipExact)) as K;
