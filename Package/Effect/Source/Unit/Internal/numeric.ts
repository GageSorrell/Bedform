/**
 * The numeric kinds a quantity may hold, and the arithmetic that dispatches on
 * them.
 *
 * Unit functions accept a `number` (including the branded `Int` and `UInt`),
 * a `Rational`, a `bigint`, a `BigRational` or a `BigDecimal`. Each unit
 * function tests for `number` itself, so the float path stays as it is in
 * effect-units. Every other argument goes through these helpers, which test
 * the remaining kinds in order: `Rational`, then `bigint`, then `BigRational`,
 * then `BigDecimal`.
 *
 * A quantity stores one of three kinds: `number`, `Rational` or `BigRational`.
 * `bigint` and `BigDecimal` arguments become `BigRational`, because unit
 * conversions are closed over neither the integers nor the terminating
 * decimals. A `Rational` stays a `Rational`: it is computed exactly and then
 * narrowed back, and narrowing throws a `RangeError` when the result does not
 * fit in safe integers.
 *
 * When two values of different kinds meet, a float operand makes the result a
 * float. Two exact kinds combine upward: two `Rational`s give a `Rational`,
 * and a `Rational` with a `BigRational` gives a `BigRational`.
 *
 * @module @bedform/effect/Unit/Internal/numeric
 *
 * @file      numeric.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

import * as BigDecimal from "../../BigDecimal.js";
import * as BigRational from "../../BigRational.js";
import * as Hash from "../../Hash.js";
import * as Option from "../../Option.js";
import * as Predicate from "../../Predicate.js";
import * as Rational from "../../Rational.js";
import * as Schema from "../../Schema.js";

import { normalizeZero, valueEquals } from "../../Internal/valueObject.js";

/**
 * An exact value a quantity can store.
 *
 * @category Types
 * @since 1.0.0
 */
export type Exact = Rational.Rational | BigRational.BigRational;

/**
 * A value a quantity can store: a float, a `Rational` or a `BigRational`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Value = number | Exact;

/**
 * An argument a unit function accepts: any stored kind, a `bigint` or a
 * `BigDecimal`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Input = Value | bigint | BigDecimal.BigDecimal;

/**
 * The stored kind that an argument of kind `N` produces. It distributes over
 * unions.
 *
 * @category Types
 * @since 1.0.0
 */
export type Of<N> = N extends number
    ? number
    : N extends Rational.Rational
        ? Rational.Rational
        : BigRational.BigRational;

/**
 * The stored kind of the result of combining values of kinds `A` and `B`: a
 * float if either is a float, a `Rational` if both are, and a `BigRational`
 * otherwise. Arguments are first mapped through {@link Of}, so `bigint` and
 * `BigDecimal` count as `BigRational`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Join<A, B> = Of<A> extends infer KA
    ? Of<B> extends infer KB
        ? KA extends number
            ? number
            : KB extends number
                ? number
                : KA extends Rational.Rational
                    ? KB extends Rational.Rational
                        ? Rational.Rational
                        : BigRational.BigRational
                    : BigRational.BigRational
        : never
    : never;

/**
 * Converts an exact argument to a stored exact kind, testing `Rational`, then
 * `bigint`, then `BigRational`, then `BigDecimal`. Callers test for `number`
 * first.
 *
 * @throws { TypeError } When the argument is none of those kinds.
 * @category Conversions
 * @since 1.0.0
 */
export const toExact = (x: Input): Exact =>
{
    if (Rational.isRational(x))
    {
        return x;
    }

    if (Predicate.isBigInt(x))
    {
        return BigRational.fromBigInt(x);
    }

    if (BigRational.isBigRational(x))
    {
        return x;
    }

    if (BigDecimal.isBigDecimal(x))
    {
        return BigRational.fromBigDecimal(x);
    }

    throw new TypeError(`Expected an exact numeric value, got ${typeof x}`);
};

/**
 * Converts any argument to the kind a quantity stores.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const normalize = (x: Input): Value =>
    Predicate.isNumber(x) ? normalizeZero(x) : toExact(x);

/**
 * The nearest float to any argument, for conversions whose factor is
 * irrational (π) and so can only produce floats.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const float = (x: Input): number =>
    Predicate.isNumber(x) ? x : toFloat(toExact(x));

/** Widens an exact value to a `BigRational`. */
const toBig = (x: Exact): BigRational.BigRational =>
    Rational.isRational(x) ? Rational.toBigRational(x) : x;

/**
 * Converts an exact result back to the kind of `like`: a `Rational` when
 * `like` is one, otherwise the `BigRational` itself.
 *
 * @throws { RangeError } When `like` is a `Rational` and the result does not
 * fit in safe integers.
 */
const narrowLike = (like: Exact, result: BigRational.BigRational): Exact =>
    Rational.isRational(like) ? Rational.fromBigRationalUnsafe(result) : result;

/**
 * The nearest float to a stored value. A `BigRational` too large for a double
 * becomes ±Infinity, following IEEE semantics.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toFloat = (v: Value): number =>
{
    if (Predicate.isNumber(v))
    {
        return v;
    }

    if (Rational.isRational(v))
    {
        return Rational.toNumberUnsafe(v);
    }

    return Option.getOrElse(BigRational.toNumber(v), () =>
        v.numerator < 0n ? -Infinity : Infinity
    );
};

/**
 * Widens a stored value to a `BigRational`, or `Option.none()` for NaN and
 * ±Infinity.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRational = (v: Value): Option.Option<BigRational.BigRational> =>
    Predicate.isNumber(v) ? BigRational.fromNumber(v) : Option.some(toBig(v));

/**
 * Converts a stored value to a `Rational`, or `Option.none()` when it has no
 * exact value with safe-integer parts.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toRational = (v: Value): Option.Option<Rational.Rational> =>
    Option.flatMap(toBigRational(v), Rational.fromBigRational);

// Scaling an exact argument by an exact unit factor

/**
 * Multiplies an exact argument by a non-float factor. The result is a
 * `Rational` for a `Rational` argument and a `BigRational` otherwise.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const multiplyExact = (x: Input, factor: BigRational.BigRational): Exact =>
{
    const exact = toExact(x);
    return narrowLike(exact, BigRational.multiply(toBig(exact), factor));
};

/**
 * Divides an exact argument by a non-zero exact factor, keeping the argument's
 * kind as {@link multiplyExact} does.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const divideExact = (x: Input, factor: BigRational.BigRational): Exact =>
{
    const exact = toExact(x);
    return narrowLike(exact, BigRational.divideUnsafe(toBig(exact), factor));
};

/**
 * Adds an exact offset to an exact argument, keeping the argument's kind as
 * {@link multiplyExact} does.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const sumExact = (x: Input, offset: BigRational.BigRational): Exact =>
{
    const exact = toExact(x);
    return narrowLike(exact, BigRational.sum(toBig(exact), offset));
};

/**
 * Subtracts an exact offset from an exact argument, keeping the argument's
 * kind as {@link multiplyExact} does.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const subtractExact = (x: Input, offset: BigRational.BigRational): Exact =>
{
    const exact = toExact(x);
    return narrowLike(exact, BigRational.subtract(toBig(exact), offset));
};

// Binary arithmetic between stored values

/** Applies `onFloat` when either value is a float, and otherwise an exact operation. */
const combine = (
    a: Value,
    b: Value,
    onFloat: (x: number, y: number) => number,
    onRational: (x: Rational.Rational, y: Rational.Rational) => Rational.Rational,
    onBig: (x: BigRational.BigRational, y: BigRational.BigRational) => BigRational.BigRational
): Value =>
{
    if (Predicate.isNumber(a) || Predicate.isNumber(b))
    {
        return onFloat(toFloat(a), toFloat(b));
    }

    return Rational.isRational(a) && Rational.isRational(b)
        ? onRational(a, b)
        : onBig(toBig(a), toBig(b));
};

/**
 * Adds two stored values under the mixed-kind rule.
 *
 * @throws { RangeError } When a `Rational` sum does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const sum = (a: Value, b: Value): Value =>
    combine(a, b, (x: number, y: number) => x + y, Rational.sum, BigRational.sum);

/**
 * Subtracts the second stored value from the first under the mixed-kind rule.
 *
 * @throws { RangeError } When a `Rational` difference does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const subtract = (a: Value, b: Value): Value =>
    combine(a, b, (x: number, y: number) => x - y, Rational.subtract, BigRational.subtract);

/**
 * Multiplies two stored values under the mixed-kind rule.
 *
 * @throws { RangeError } When a `Rational` product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const multiply = (a: Value, b: Value): Value =>
    combine(a, b, (x: number, y: number) => x * y, Rational.multiply, BigRational.multiply);

/**
 * Whether dividing `a` by `b` follows float semantics, that is whether either
 * is a float.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isFloatDivision = (a: Value, b: Value): boolean =>
    Predicate.isNumber(a) || Predicate.isNumber(b);

/**
 * Divides two stored values under the mixed-kind rule. A float division
 * follows IEEE semantics; an exact division by zero yields `undefined`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const divide = (a: Value, b: Value): Value | undefined =>
{
    if (Predicate.isNumber(a) || Predicate.isNumber(b))
    {
        return toFloat(a) / toFloat(b);
    }

    if (isZero(b))
    {
        return undefined;
    }

    return Rational.isRational(a) && Rational.isRational(b)
        ? Rational.divideUnsafe(a, b)
        : BigRational.divideUnsafe(toBig(a), toBig(b));
};

/**
 * Compares two stored values under the mixed-kind rule: negative, zero or
 * positive, or NaN when a float comparison involves NaN, so every ordering
 * test against zero is false, as IEEE comparisons are.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compare = (a: Value, b: Value): number =>
{
    if (Predicate.isNumber(a) || Predicate.isNumber(b))
    {
        const x = toFloat(a);
        const y = toFloat(b);
        return x < y ? -1 : x > y ? 1 : x === y ? 0 : Number.NaN;
    }

    return Rational.isRational(a) && Rational.isRational(b)
        ? Rational.Order(a, b)
        : BigRational.Order(toBig(a), toBig(b));
};

/**
 * Negates a stored value, keeping its kind.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (v: Value): Value =>
{
    if (Predicate.isNumber(v))
    {
        return -v;
    }

    return Rational.isRational(v) ? Rational.negate(v) : BigRational.negate(v);
};

/**
 * The absolute value of a stored value, keeping its kind.
 *
 * @category Operation
 * @since 1.0.0
 */
export const abs = (v: Value): Value =>
{
    if (Predicate.isNumber(v))
    {
        return Math.abs(v);
    }

    return Rational.isRational(v) ? Rational.abs(v) : BigRational.abs(v);
};

/**
 * Checks whether a stored value is zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isZero = (v: Value): boolean =>
{
    if (Predicate.isNumber(v))
    {
        return v === 0;
    }

    return Rational.isRational(v) ? Rational.isZero(v) : BigRational.isZero(v);
};

/**
 * Checks whether a stored value is NaN; exact values never are.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isNaN = (v: Value): boolean =>
    Predicate.isNumber(v) && Number.isNaN(v);

// Structural equality, hashing and encoding

/**
 * Structural equality of stored values: the same kind and the same value, with
 * NaN equal to itself. A float 0.5 and a `Rational` 1/2 are not equal, which
 * keeps `Equal` consistent with `Hash`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equalsStructural = (a: Value, b: Value): boolean =>
{
    if (Predicate.isNumber(a))
    {
        return Predicate.isNumber(b) && valueEquals(a, b);
    }

    if (Rational.isRational(a))
    {
        return Rational.isRational(b) && Rational.equals(a, b);
    }

    return BigRational.isBigRational(b) && BigRational.equals(a, b);
};

/**
 * Hashes a stored value consistently with {@link equalsStructural}.
 *
 * @category Operation
 * @since 1.0.0
 */
export const hash = (v: Value): number =>
    Predicate.isNumber(v) ? Hash.number(v) : Hash.hash(v);

/**
 * The JSON form of a stored value: the float itself, or the canonical rational
 * string (`"3/2"`) of an exact value.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const encode = (v: Value): number | string =>
{
    if (Predicate.isNumber(v))
    {
        return v;
    }

    return Rational.isRational(v) ? Rational.format(v) : BigRational.format(v);
};

// Value schemas

/**
 * The value schemas a quantity schema accepts: `Schema.Finite` for floats,
 * `Rational.Rational` and `BigRational.BigRational` for exact values.
 *
 * @category Schemas
 * @since 1.0.0
 */
export type ValueSchema =
    | typeof Schema.Finite
    | typeof Rational.Rational
    | typeof BigRational.BigRational;

/**
 * The stored kind a value schema decodes to.
 *
 * @category Schemas
 * @since 1.0.0
 */
export type ValueOf<S extends ValueSchema> = S extends typeof Rational.Rational
    ? Rational.Rational
    : S extends typeof BigRational.BigRational
        ? BigRational.BigRational
        : number;

/**
 * The kind test for a value schema.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const isKind = (value: ValueSchema): ((u: unknown) => boolean) =>
    value === Rational.Rational
        ? Rational.isRational
        : value === BigRational.BigRational
            ? BigRational.isBigRational
            : Predicate.isNumber;

/**
 * The JSON codec for a value schema's values: a finite number, or the
 * canonical rational string.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const valueCodec = (value: ValueSchema): Schema.Codec<Value, number | string> =>
    (value === Rational.Rational
        ? Rational.RationalFromString
        : value === BigRational.BigRational
            ? BigRational.BigRationalFromString
            : Schema.Finite) as unknown as Schema.Codec<Value, number | string>;
