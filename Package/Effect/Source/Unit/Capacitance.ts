/**
 * Capacitance quantities, stored in farads, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Capacitance` and `CapacitanceExact` modules.
 *
 * @module @bedform/effect/Unit/Capacitance
 *
 * @file      Capacitance.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Farads` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Farads = "Farads";

/**
 * The `Farads` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Farads: Farads = "Farads";

/**
 * A quantity measured in `Farads`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Capacitance<K extends Quantity.Value = number> = Quantity.Quantity<Farads, K>;

/**
 * The identity schema for `Capacitance` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Capacitance = Quantity.Quantity(Farads);

/**
 * The codec between `Capacitance` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const CapacitanceFromStruct = Quantity.QuantityFromStruct(Farads);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Capacitance<K> => Quantity.make(Farads, value) as Capacitance<K>;

/**
 * A `Capacitance` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `Capacitance` from a number of farads.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const farads = <N extends Quantity.Input>(n: N): Capacitance<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Capacitance` to a number of farads.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFarads = <K extends Quantity.Value>(c: Capacitance<K>): K =>
    c.value;

/**
 * Creates a `Capacitance` from a number of picofarads.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const picofarads = <N extends Quantity.Input>(n: N): Capacitance<Quantity.Of<N>> =>
    make(Prefix.toBase("Pico", n));

/**
 * Converts a `Capacitance` to a number of picofarads.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPicofarads = <K extends Quantity.Value>(c: Capacitance<K>): K =>
    Prefix.toPrefixed("Pico", c.value);

/**
 * Creates a `Capacitance` from a number of nanofarads.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nanofarads = <N extends Quantity.Input>(n: N): Capacitance<Quantity.Of<N>> =>
    make(Prefix.toBase("Nano", n));

/**
 * Converts a `Capacitance` to a number of nanofarads.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNanofarads = <K extends Quantity.Value>(c: Capacitance<K>): K =>
    Prefix.toPrefixed("Nano", c.value);

/**
 * Creates a `Capacitance` from a number of microfarads.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const microfarads = <N extends Quantity.Input>(n: N): Capacitance<Quantity.Of<N>> =>
    make(Prefix.toBase("Micro", n));

/**
 * Converts a `Capacitance` to a number of microfarads.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicrofarads = <K extends Quantity.Value>(c: Capacitance<K>): K =>
    Prefix.toPrefixed("Micro", c.value);
