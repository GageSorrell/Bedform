/**
 * Inductance quantities, stored in henries, with constructors and conversions for
 * common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `Inductance` and `InductanceExact` modules.
 *
 * @module @bedform/effect/Unit/Inductance
 *
 * @file      Inductance.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Henries` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Henries = "Henries";

/**
 * The `Henries` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Henries: Henries = "Henries";

/**
 * A quantity measured in `Henries`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type Inductance<K extends Quantity.Value = number> = Quantity.Quantity<Henries, K>;

/**
 * The identity schema for `Inductance` values. Its canonical JSON representation
 * is `{ unit, value }` with a finite numeric value, so `Schema.toCodecJson`
 * derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Inductance = Quantity.Quantity(Henries);

/**
 * The codec between `Inductance` values and their `{ unit, value }` encoding, with
 * a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const InductanceFromStruct = Quantity.QuantityFromStruct(Henries);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Inductance<K> => Quantity.make(Henries, value) as Inductance<K>;

/**
 * An `Inductance` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates an `Inductance` from a number of henries.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const henries = <N extends Quantity.Input>(n: N): Inductance<Quantity.Of<N>> =>
    make(n);

/**
 * Converts an `Inductance` to a number of henries.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inHenries = <K extends Quantity.Value>(i: Inductance<K>): K =>
    i.value;

/**
 * Creates an `Inductance` from a number of nanohenries.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nanohenries = <N extends Quantity.Input>(n: N): Inductance<Quantity.Of<N>> =>
    make(Prefix.toBase("Nano", n));

/**
 * Converts an `Inductance` to a number of nanohenries.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNanohenries = <K extends Quantity.Value>(i: Inductance<K>): K =>
    Prefix.toPrefixed("Nano", i.value);

/**
 * Creates an `Inductance` from a number of microhenries.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const microhenries = <N extends Quantity.Input>(n: N): Inductance<Quantity.Of<N>> =>
    make(Prefix.toBase("Micro", n));

/**
 * Converts an `Inductance` to a number of microhenries.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicrohenries = <K extends Quantity.Value>(i: Inductance<K>): K =>
    Prefix.toPrefixed("Micro", i.value);

/**
 * Creates an `Inductance` from a number of millihenries.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const millihenries = <N extends Quantity.Input>(n: N): Inductance<Quantity.Of<N>> =>
    make(Prefix.toBase("Milli", n));

/**
 * Converts an `Inductance` to a number of millihenries.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMillihenries = <K extends Quantity.Value>(i: Inductance<K>): K =>
    Prefix.toPrefixed("Milli", i.value);

/**
 * Creates an `Inductance` from a number of kilohenries.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilohenries = <N extends Quantity.Input>(n: N): Inductance<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts an `Inductance` to a number of kilohenries.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilohenries = <K extends Quantity.Value>(i: Inductance<K>): K =>
    Prefix.toPrefixed("Kilo", i.value);
