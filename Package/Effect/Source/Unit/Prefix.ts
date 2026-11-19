/**
 * SI prefixes and the conversions between prefixed and unprefixed values, for
 * every numeric kind a quantity accepts.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Prefix
 *
 * @file      Prefix.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units generics and contextual inference and import and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as BigRational from "../BigRational.js";
import * as Function from "../Function.js";
import * as Numeric from "./Internal/numeric.js";
import * as Predicate from "../Predicate.js";
import * as Record from "../Record.js";
import * as Schema from "../Schema.js";

/**
 * The schema of SI prefix names, from `Quetta` (10^30) down to `Quecto` (10^-30).
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Prefix = Schema.Literals([
    "Quetta",
    "Ronna",
    "Yotta",
    "Zetta",
    "Exa",
    "Peta",
    "Tera",
    "Giga",
    "Mega",
    "Kilo",
    "Hecto",
    "Deca",
    "Deci",
    "Centi",
    "Milli",
    "Micro",
    "Nano",
    "Pico",
    "Femto",
    "Atto",
    "Zepto",
    "Yocto",
    "Ronto",
    "Quecto"
]);

/**
 * An SI prefix name, such as `Kilo` or `Milli`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Prefix = typeof Prefix.Type;

const base10Exponents: Record<Prefix, number> = {
    Quetta: 30,
    Ronna: 27,
    Yotta: 24,
    Zetta: 21,
    Exa: 18,
    Peta: 15,
    Tera: 12,
    Giga: 9,
    Mega: 6,
    Kilo: 3,
    Hecto: 2,
    Deca: 1,
    Deci: -1,
    Centi: -2,
    Milli: -3,
    Micro: -6,
    Nano: -9,
    Pico: -12,
    Femto: -15,
    Atto: -18,
    Zepto: -21,
    Yocto: -24,
    Ronto: -27,
    Quecto: -30
};

// Factors come from parsing the decimal form rather than `10 ** exponent`:
// a parsed literal is always the correctly rounded float of the power of
// ten, while the runtime `**` is not (V8 lands one ulp off for 10^-21 and
// 10^-24).
const factors = Record.map(base10Exponents, (exponent) =>
    Number(`1e${exponent}`)
);

const exactFactorOf = (exponent: number): BigRational.BigRational =>
    exponent >= 0
        ? BigRational.makeUnsafe(10n ** BigInt(exponent))
        : BigRational.makeUnsafe(1n, 10n ** BigInt(-exponent));

/** The exact factor of every prefix; every prefix is a power of ten. */
const exactFactors = Record.map(base10Exponents, exactFactorOf);

/**
 * Converts a value expressed with an SI prefix to the unprefixed base unit by
 * multiplying it by the prefix factor; `toBase("Kilo", 2)` is `2000`. Dual, so it
 * also accepts the value first in a pipeline.
 *
 * A float is multiplied by the float factor. Any other kind is multiplied
 * exactly: a `Rational` stays a `Rational`, and the other kinds become a
 * `BigRational`.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Conversions
 * @since 1.0.0
 */
export const toBase: {
    <N extends Numeric.Input>(value: N): (prefix: Prefix) => Numeric.Of<N>;
    <N extends Numeric.Input>(prefix: Prefix, value: N): Numeric.Of<N>;
} = Function.dual(
    2,
    (prefix: Prefix, value: Numeric.Input): Numeric.Value =>
        Predicate.isNumber(value)
            ? value * factors[prefix]
            : Numeric.multiplyExact(value, exactFactors[prefix])
);

/**
 * Converts a value in the unprefixed base unit to one expressed with an SI prefix
 * by dividing it by the prefix factor; `toPrefixed("Kilo", 2000)` is `2`. Dual, so
 * it also accepts the value first in a pipeline.
 *
 * A float is divided by the float factor. Any other kind is divided exactly,
 * keeping its kind as {@link toBase} does.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Conversions
 * @since 1.0.0
 */
export const toPrefixed: {
    <K extends Numeric.Value>(value: K): (prefix: Prefix) => K;
    <K extends Numeric.Value>(prefix: Prefix, value: K): K;
    <N extends Numeric.Input>(value: N): (prefix: Prefix) => Numeric.Of<N>;
    <N extends Numeric.Input>(prefix: Prefix, value: N): Numeric.Of<N>;
} = Function.dual(
    2,
    (prefix: Prefix, value: Numeric.Input): Numeric.Value =>
    // Dividing by the same factor toBase multiplies by, rather than
    // multiplying by its inverse, keeps roundtrips as close to exact as
    // floats allow.
        Predicate.isNumber(value)
            ? value / factors[prefix]
            : Numeric.divideExact(value, exactFactors[prefix])
);
