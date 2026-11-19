/**
 * Voltage quantities, stored in volts, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Voltage` and `VoltageExact` modules.
 *
 * @module @bedform/effect/Unit/Voltage
 *
 * @file      Voltage.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Current from "./Current.js";
import * as Power from "./Power.js";
import * as Quantity from "./Quantity.js";
import * as Unit from "./Unit.js";

/**
 * The type of the volts unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export type Volts = Unit.Rate<Power.Watts, Current.Amperes>;

/**
 * The volts unit, composed from other units with the `Unit` algebra.
 *
 * @category Units
 * @since 1.0.0
 */
export const Volts: Volts = Unit.rate(Power.Watts, Current.Amperes);

/**
 * A quantity measured in `Volts`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Voltage<K extends Quantity.Value = number> = Quantity.Quantity<Volts, K>;

/**
 * The identity schema for `Voltage` values. Its canonical JSON representation is
 * `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives
 * that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Voltage = Quantity.Quantity(Volts);

/**
 * The codec between `Voltage` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const VoltageFromStruct = Quantity.QuantityFromStruct(Volts);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Voltage<K> => Quantity.make(Volts, value) as Voltage<K>;

/**
 * A `Voltage` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Voltage` from a number of volts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const volts = <N extends Quantity.Input>(n: N): Voltage<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Voltage` to a number of volts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inVolts = <K extends Quantity.Value>(v: Voltage<K>): K =>
    v.value;
