/**
 * Molarity quantities, stored in moles per cubic meter, with constructors and
 * conversions for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Molarity` and `MolarityExact` modules.
 *
 * @module @bedform/effect/Unit/Molarity
 *
 * @file      Molarity.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as SubstanceAmount from "./SubstanceAmount.js";
import * as Unit from "./Unit.js";
import * as Volume from "./Volume.js";

/**
 * The type of the moles per cubic meter unit, composed from other units with the
 * `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type MolesPerCubicMeter = Unit.Rate<
    SubstanceAmount.Moles,
    Volume.CubicMeters
>;

/**
 * The moles per cubic meter unit, composed from other units with the `Unit`
 * algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const MolesPerCubicMeter: MolesPerCubicMeter = Unit.rate(
    SubstanceAmount.Moles,
    Volume.CubicMeters
);

/**
 * A quantity measured in `MolesPerCubicMeter`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Molarity<K extends Quantity.Value = number> = Quantity.Quantity<MolesPerCubicMeter, K>;

/**
 * The identity schema for `Molarity` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Molarity = Quantity.Quantity(MolesPerCubicMeter);

/**
 * The codec between `Molarity` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const MolarityFromStruct =
    Quantity.QuantityFromStruct(MolesPerCubicMeter);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Molarity<K> => Quantity.make(MolesPerCubicMeter, value) as Molarity<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

const molesPerCubicMeterPerMolePerLiterExact = BigRational.makeUnsafe(1_000n);

const molesPerCubicMeterPerDecimolePerLiterExact = Prefix.toBase(
    "Deci",
    molesPerCubicMeterPerMolePerLiterExact
);

const molesPerCubicMeterPerCentimolePerLiterExact = Prefix.toBase(
    "Centi",
    molesPerCubicMeterPerMolePerLiterExact
);

const molesPerCubicMeterPerMillimolePerLiterExact = Prefix.toBase(
    "Milli",
    molesPerCubicMeterPerMolePerLiterExact
);

const molesPerCubicMeterPerMicromolePerLiterExact = Prefix.toBase(
    "Micro",
    molesPerCubicMeterPerMolePerLiterExact
);

/**
 * A `Molarity` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Molarity` from a number of moles per cubic meter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const molesPerCubicMeter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Molarity` to a number of moles per cubic meter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMolesPerCubicMeter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    m.value;

const molesPerCubicMeterPerMolePerLiter = 1_000;

/**
 * Creates a `Molarity` from a number of moles per liter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const molesPerLiter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * molesPerCubicMeterPerMolePerLiter)
        : make(Numeric.multiplyExact(n, molesPerCubicMeterPerMolePerLiterExact));

/**
 * Converts a `Molarity` to a number of moles per liter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMolesPerLiter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / molesPerCubicMeterPerMolePerLiter
        : Numeric.divideExact(m.value, molesPerCubicMeterPerMolePerLiterExact)) as K;

const molesPerCubicMeterPerDecimolePerLiter = Prefix.toBase(
    "Deci",
    molesPerCubicMeterPerMolePerLiter
);

/**
 * Creates a `Molarity` from a number of decimoles per liter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const decimolesPerLiter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * molesPerCubicMeterPerDecimolePerLiter)
        : make(Numeric.multiplyExact(n, molesPerCubicMeterPerDecimolePerLiterExact));

/**
 * Converts a `Molarity` to a number of decimoles per liter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDecimolesPerLiter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / molesPerCubicMeterPerDecimolePerLiter
        : Numeric.divideExact(m.value, molesPerCubicMeterPerDecimolePerLiterExact)) as K;

const molesPerCubicMeterPerCentimolePerLiter = Prefix.toBase(
    "Centi",
    molesPerCubicMeterPerMolePerLiter
);

/**
 * Creates a `Molarity` from a number of centimoles per liter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const centimolesPerLiter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * molesPerCubicMeterPerCentimolePerLiter)
        : make(Numeric.multiplyExact(n, molesPerCubicMeterPerCentimolePerLiterExact));

/**
 * Converts a `Molarity` to a number of centimoles per liter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCentimolesPerLiter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / molesPerCubicMeterPerCentimolePerLiter
        : Numeric.divideExact(m.value, molesPerCubicMeterPerCentimolePerLiterExact)) as K;

const molesPerCubicMeterPerMillimolePerLiter = Prefix.toBase(
    "Milli",
    molesPerCubicMeterPerMolePerLiter
);

/**
 * Creates a `Molarity` from a number of millimoles per liter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const millimolesPerLiter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * molesPerCubicMeterPerMillimolePerLiter)
        : make(Numeric.multiplyExact(n, molesPerCubicMeterPerMillimolePerLiterExact));

/**
 * Converts a `Molarity` to a number of millimoles per liter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMillimolesPerLiter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / molesPerCubicMeterPerMillimolePerLiter
        : Numeric.divideExact(m.value, molesPerCubicMeterPerMillimolePerLiterExact)) as K;

const molesPerCubicMeterPerMicromolePerLiter = Prefix.toBase(
    "Micro",
    molesPerCubicMeterPerMolePerLiter
);

/**
 * Creates a `Molarity` from a number of micromoles per liter.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const micromolesPerLiter = <N extends Quantity.Input>(n: N): Molarity<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * molesPerCubicMeterPerMicromolePerLiter)
        : make(Numeric.multiplyExact(n, molesPerCubicMeterPerMicromolePerLiterExact));

/**
 * Converts a `Molarity` to a number of micromoles per liter.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicromolesPerLiter = <K extends Quantity.Value>(m: Molarity<K>): K =>
    (Predicate.isNumber(m.value)
        ? m.value / molesPerCubicMeterPerMicromolePerLiter
        : Numeric.divideExact(m.value, molesPerCubicMeterPerMicromolePerLiterExact)) as K;
