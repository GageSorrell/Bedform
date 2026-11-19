/**
 * Resistance quantities, stored in ohms, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Resistance` and `ResistanceExact` modules.
 *
 * @module @bedform/effect/Unit/Resistance
 *
 * @file      Resistance.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Current from "./Current.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";
import * as Voltage from "./Voltage.js";

/**
 * The type of the ohms unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Ohms = Unit.Rate<Voltage.Volts, Current.Amperes>;

/**
 * The ohms unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Ohms: Ohms = Unit.rate(Voltage.Volts, Current.Amperes);

/**
 * A quantity measured in `Ohms`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Resistance<K extends Quantity.Value = number> = Quantity.Quantity<Ohms, K>;

/**
 * The identity schema for `Resistance` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Resistance = Quantity.Quantity(Ohms);

/**
 * The codec between `Resistance` values and their `{ unit, value }` encoding, with
 * a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const ResistanceFromStruct = Quantity.QuantityFromStruct(Ohms);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Resistance<K> => Quantity.make(Ohms, value) as Resistance<K>;

/**
 * A `Resistance` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Resistance` from a number of ohms.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ohms = <N extends Quantity.Input>(n: N): Resistance<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Resistance` to a number of ohms.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inOhms = <K extends Quantity.Value>(r: Resistance<K>): K =>
    r.value;
