/**
 * Current quantities, stored in amperes, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Current` and `CurrentExact` modules.
 *
 * @module @bedform/effect/Unit/Current
 *
 * @file      Current.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Charge from "./Charge.js";
import * as Duration from "./Duration.js";
import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the amperes unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Amperes = Unit.Rate<Charge.Coulombs, Duration.Seconds>;

/**
 * The amperes unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Amperes: Amperes = Unit.rate(Charge.Coulombs, Duration.Seconds);

/**
 * A quantity measured in `Amperes`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Current<K extends Quantity.Value = number> = Quantity.Quantity<Amperes, K>;

/**
 * The identity schema for `Current` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Current = Quantity.Quantity(Amperes);

/**
 * The codec between `Current` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const CurrentFromStruct = Quantity.QuantityFromStruct(Amperes);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Current<K> => Quantity.make(Amperes, value) as Current<K>;

/**
 * A `Current` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Current` from a number of amperes.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const amperes = <N extends Quantity.Input>(n: N): Current<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Current` to a number of amperes.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inAmperes = <K extends Quantity.Value>(c: Current<K>): K =>
    c.value;

/**
 * Creates a `Current` from a number of milliamperes.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const milliamperes = <N extends Quantity.Input>(n: N): Current<Quantity.Of<N>> =>
    make(Prefix.toBase("Milli", n));

/**
 * Converts a `Current` to a number of milliamperes.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMilliamperes = <K extends Quantity.Value>(c: Current<K>): K =>
    Prefix.toPrefixed("Milli", c.value);
