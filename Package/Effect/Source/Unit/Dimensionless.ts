/**
 * Dimensionless quantities: pure numbers with a scale attached, stored as a
 * fraction, so `one` is 100%, 1,000 per mille, and 10,000 basis points alike.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Percentages are the reason to reach for this module. A bare `number` says
 * nothing about which scale it is on—the classic 0.5-versus-50 bug—while a
 * `Dimensionless` names the scale at every boundary and carries the unit into
 * the wire format.
 *
 * Ratios of two quantities in the same units land here (`Quantity.ratio`),
 * and because `Unitless` is the multiplicative identity of the unit algebra,
 * `Quantity.times` and `over` apply one without leaving the units they scale.
 *
 * Ported from effect-units 1.0.1, merging its `Dimensionless` and `DimensionlessExact` modules.
 *
 * @module @bedform/effect/Unit/Dimensionless
 *
 * @file      Dimensionless.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as BigRational from "../BigRational.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import * as Rational from "../Rational.js";

/**
 * The type of the `Unitless` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Unitless = "Unitless";

/**
 * The `Unitless` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Unitless: Unitless = "Unitless";

/**
 * A quantity measured in `Unitless`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Dimensionless<K extends Quantity.Value = number> = Quantity.Quantity<Unitless, K>;

/**
 * The identity schema for `Dimensionless` values. Its canonical JSON
 * representation is `{ unit, value }` with a finite numeric value, so
 * `Schema.toCodecJson` derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Dimensionless = Quantity.Quantity(Unitless);

/**
 * The codec between `Dimensionless` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const DimensionlessFromStruct = Quantity.QuantityFromStruct(Unitless);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Dimensionless<K> => Quantity.make(Unitless, value) as Dimensionless<K>;

// The exact factors below are the exact counterparts of the float
// factors, used on the exact path of each conversion.

/** One percent (%) is 10⁻², the SI centi- prefix applied to the unit one. */
const fractionPerPercentExact = BigRational.makeUnsafe(1n, 100n);

/** One per mille (‰) is 10⁻³, a tenth of a percent. */
const fractionPerPerMilleExact = BigRational.makeUnsafe(1n, 1_000n);

/** One basis point (bp) is 10⁻⁴, a hundredth of a percent. */
const fractionPerBasisPointExact = BigRational.makeUnsafe(1n, 10n ** 4n);

/** One part per million (ppm) is 10⁻⁶. */
const fractionPerPartPerMillionExact = BigRational.makeUnsafe(1n, 10n ** 6n);

/** One part per billion (ppb) is 10⁻⁹, on the short scale. */
const fractionPerPartPerBillionExact = BigRational.makeUnsafe(1n, 10n ** 9n);

/**
 * A `Dimensionless` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * A factor of one: the identity for `Quantity.times`, and 100%.
 *
 * @category Constants
 * @since 1.0.0
 */
export const one = make(1);

/**
 * Creates a `Dimensionless` from a number of fraction.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fraction = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Dimensionless` to a number of fraction.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFraction = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    d.value;

/** One percent (%) is 10⁻², the SI centi- prefix applied to the unit one. */
const fractionPerPercent = 1e-2;

/**
 * Creates a `Dimensionless` from a number of percent.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const percent = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * fractionPerPercent)
        : make(Numeric.multiplyExact(n, fractionPerPercentExact));

/**
 * Converts a `Dimensionless` to a number of percent.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPercent = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fractionPerPercent
        : Numeric.divideExact(d.value, fractionPerPercentExact)) as K;

/** One per mille (‰) is 10⁻³, a tenth of a percent. */
const fractionPerPerMille = 1e-3;

/**
 * Creates a `Dimensionless` from a number of per mille.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const perMille = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * fractionPerPerMille)
        : make(Numeric.multiplyExact(n, fractionPerPerMilleExact));

/**
 * Converts a `Dimensionless` to a number of per mille.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPerMille = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fractionPerPerMille
        : Numeric.divideExact(d.value, fractionPerPerMilleExact)) as K;

/** One basis point (bp) is 10⁻⁴, a hundredth of a percent. */
const fractionPerBasisPoint = 1e-4;

/**
 * Creates a `Dimensionless` from a number of basis points.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const basisPoints = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * fractionPerBasisPoint)
        : make(Numeric.multiplyExact(n, fractionPerBasisPointExact));

/**
 * Converts a `Dimensionless` to a number of basis points.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inBasisPoints = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fractionPerBasisPoint
        : Numeric.divideExact(d.value, fractionPerBasisPointExact)) as K;

/** One part per million (ppm) is 10⁻⁶. */
const fractionPerPartPerMillion = 1e-6;

/**
 * Creates a `Dimensionless` from a number of parts per million.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const partsPerMillion = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * fractionPerPartPerMillion)
        : make(Numeric.multiplyExact(n, fractionPerPartPerMillionExact));

/**
 * Converts a `Dimensionless` to a number of parts per million.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPartsPerMillion = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fractionPerPartPerMillion
        : Numeric.divideExact(d.value, fractionPerPartPerMillionExact)) as K;

/** One part per billion (ppb) is 10⁻⁹, on the short scale. */
const fractionPerPartPerBillion = 1e-9;

/**
 * Creates a `Dimensionless` from a number of parts per billion.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const partsPerBillion = <N extends Quantity.Input>(n: N): Dimensionless<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n * fractionPerPartPerBillion)
        : make(Numeric.multiplyExact(n, fractionPerPartPerBillionExact));

/**
 * Converts a `Dimensionless` to a number of parts per billion.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPartsPerBillion = <K extends Quantity.Value>(d: Dimensionless<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fractionPerPartPerBillion
        : Numeric.divideExact(d.value, fractionPerPartPerBillionExact)) as K;

/**
 * The rest of the whole: `complement(percent(30))` is `percent(70)`. Values
 * outside 0–100% are not rejected—the complement of 150% is -50%.
 *
 * @category Operation
 * @since 1.0.0
 */
export const complement = <K extends Quantity.Value>(
    d: Dimensionless<K>
): Dimensionless<K> =>
    Predicate.isNumber(d.value)
        ? make(1 - d.value)
        : make(Numeric.subtract(Rational.one, d.value));
