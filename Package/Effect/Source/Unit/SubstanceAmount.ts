/**
 * Substance amount quantities, stored in moles, with constructors and conversions
 * for common units.
 *
 * Every constructor and converter accepts each numeric kind that
 * `Quantity` does: a float, an `Int`, a `Rational`, a `bigint`, a
 * `BigRational` or a `BigDecimal`.
 *
 * Ported from effect-units 1.0.1, merging its `SubstanceAmount` and `SubstanceAmountExact` modules.
 *
 * @module @bedform/effect/Unit/SubstanceAmount
 *
 * @file      SubstanceAmount.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

import * as Prefix from "./Prefix.js";
import * as Quantity from "./Quantity.js";

/**
 * The type of the `Moles` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export type Moles = "Moles";

/**
 * The `Moles` unit tag.
 *
 * @category Units
 * @since 1.0.0
 */
export const Moles: Moles = "Moles";

/**
 * A quantity measured in `Moles`, whose value has kind `K`, a float by default.
 *
 * @category Types
 * @since 1.0.0
 */
export type SubstanceAmount<K extends Quantity.Value = number> = Quantity.Quantity<Moles, K>;

/**
 * The identity schema for `SubstanceAmount` values. Its canonical JSON
 * representation is `{ unit, value }` with a finite numeric value, so
 * `Schema.toCodecJson` derives that codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const SubstanceAmount = Quantity.Quantity(Moles);

/**
 * The codec between `SubstanceAmount` values and their `{ unit, value }` encoding,
 * with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const SubstanceAmountFromStruct = Quantity.QuantityFromStruct(Moles);

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): SubstanceAmount<K> => Quantity.make(Moles, value) as SubstanceAmount<K>;

/**
 * A `SubstanceAmount` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero = make(0);

/**
 * Creates a `SubstanceAmount` from a number of moles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const moles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `SubstanceAmount` to a number of moles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    s.value;

/**
 * Creates a `SubstanceAmount` from a number of picomoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const picomoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Pico", n));

/**
 * Converts a `SubstanceAmount` to a number of picomoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inPicomoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Pico", s.value);

/**
 * Creates a `SubstanceAmount` from a number of nanomoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const nanomoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Nano", n));

/**
 * Converts a `SubstanceAmount` to a number of nanomoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inNanomoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Nano", s.value);

/**
 * Creates a `SubstanceAmount` from a number of micromoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const micromoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Micro", n));

/**
 * Converts a `SubstanceAmount` to a number of micromoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMicromoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Micro", s.value);

/**
 * Creates a `SubstanceAmount` from a number of millimoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const millimoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Milli", n));

/**
 * Converts a `SubstanceAmount` to a number of millimoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMillimoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Milli", s.value);

/**
 * Creates a `SubstanceAmount` from a number of centimoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const centimoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Centi", n));

/**
 * Converts a `SubstanceAmount` to a number of centimoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCentimoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Centi", s.value);

/**
 * Creates a `SubstanceAmount` from a number of decimoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const decimoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Deci", n));

/**
 * Converts a `SubstanceAmount` to a number of decimoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDecimoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Deci", s.value);

/**
 * Creates a `SubstanceAmount` from a number of kilomoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kilomoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Kilo", n));

/**
 * Converts a `SubstanceAmount` to a number of kilomoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKilomoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Kilo", s.value);

/**
 * Creates a `SubstanceAmount` from a number of megamoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const megamoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Mega", n));

/**
 * Converts a `SubstanceAmount` to a number of megamoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inMegamoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Mega", s.value);

/**
 * Creates a `SubstanceAmount` from a number of gigamoles.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const gigamoles = <N extends Quantity.Input>(n: N): SubstanceAmount<Quantity.Of<N>> =>
    make(Prefix.toBase("Giga", n));

/**
 * Converts a `SubstanceAmount` to a number of gigamoles.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inGigamoles = <K extends Quantity.Value>(s: SubstanceAmount<K>): K =>
    Prefix.toPrefixed("Giga", s.value);
