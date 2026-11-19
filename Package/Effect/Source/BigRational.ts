/**
 * Arbitrary-precision rational numbers, stored as reduced fractions of bigints, in
 * the idiom of `@bedform/effect/BigDecimal`.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/BigRational
 *
 * @file      BigRational.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units generics and contextual inference and import and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys */

import * as Array from "./Array.js";
import * as BigDecimal from "./BigDecimal.js";
import * as BigInt from "./BigInt.js";
import * as Equal from "./Equal.js";
import * as Equivalence_ from "./Equivalence.js";
import * as Function from "./Function.js";
import * as Hash from "./Hash.js";
import type * as Inspectable from "./Inspectable.js";
import * as Match from "./Match.js";
import * as Option from "./Option.js";
import * as order from "./Order.js";
import type * as Ordering from "./Ordering.js";
import type * as Pipeable from "./Pipeable.js";
import * as Predicate from "./Predicate.js";
import * as Result from "./Result.js";
import * as Schema from "./Schema.js";
import * as SchemaGetter from "./SchemaGetter.js";
import * as SchemaIssue from "./SchemaIssue.js";
import * as String from "./String.js";

import { ValueObjectProto } from "./Internal/valueObject.js";

/**
 * The runtime brand carried by every `BigRational`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const TypeId = Symbol.for("@bedform/effect/BigRational");

/**
 * The type of the runtime brand carried by every `BigRational`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export type TypeId = typeof TypeId;

/**
 * An arbitrary-precision rational number: a reduced fraction of bigints.
 * Unlike floats, arithmetic on rationals is exact—sums, products, and
 * quotients lose no information. Unlike `BigDecimal`, rationals are closed
 * under division (1/3 is a value, not a rounding), which is what makes them
 * the right value type for exact quantities and their rate algebra.
 *
 * @category Types
 * @since 1.0.0
 */
export interface BigRational
    extends Equal.Equal, Inspectable.Inspectable, Pipeable.Pipeable {
    readonly [TypeId]: TypeId;
    /** Carries the sign. An integer n is n/1. */
    readonly numerator: bigint;
    /** Always positive; gcd(|numerator|, denominator) is 1. */
    readonly denominator: bigint;
}

/**
 * Checks whether a value is a `BigRational`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isBigRational = (u: unknown): u is BigRational =>
    Predicate.hasProperty(u, TypeId);

const Proto = {
    ...ValueObjectProto,
    [TypeId]: TypeId,
    [Equal.symbol](this: BigRational, that: unknown): boolean
    {
        return isBigRational(that) && equals(this, that);
    },
    [Hash.symbol](this: BigRational): number
    {
        return Hash.combine(Hash.hash(this.numerator))(Hash.hash(this.denominator));
    },
    toJSON(this: BigRational)
    {
        return {
            _id: "BigRational",
            numerator: globalThis.String(this.numerator),
            denominator: globalThis.String(this.denominator)
        };
    }
} as const;

/** Builds a rational whose fields are already reduced and sign-normalized. */
const ofReduced = (numerator: bigint, denominator: bigint): BigRational =>
    Object.assign(Object.create(Proto), { numerator,
        denominator });

/**
 * Reduces a fraction to lowest terms with the sign carried by the
 * numerator. Total on a non-zero denominator, which every caller
 * establishes first—internal arithmetic derives denominators as products
 * of positive denominators, so they are never zero.
 */
const reduce = (numerator: bigint, denominator: bigint): BigRational =>
{
    const flip = denominator < 0n ? -1n : 1n;
    const n = flip * numerator;
    const d = flip * denominator;
    const g = BigInt.gcd(n < 0n ? -n : n, d);
    return ofReduced(n / g, d / g);
};

/**
 * Creates the rational `numerator / denominator`, reduced to lowest terms
 * with the sign carried by the numerator. Returns `Option.none()` on a zero
 * denominator; {@link makeUnsafe} is the throwing counterpart for
 * developer-written literals.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (
    numerator: bigint,
    denominator: bigint = 1n
): Option.Option<BigRational> =>
    denominator === 0n
        ? Option.none()
        : Option.some(reduce(numerator, denominator));

/**
 * Throws a `RangeError` on a zero denominator.
 *
 * @throws { RangeError } On a zero denominator.
 * @category Constructors
 * @since 1.0.0
 */
export const makeUnsafe = (
    numerator: bigint,
    denominator: bigint = 1n
): BigRational =>
{
    if (denominator === 0n)
    {
        throw new RangeError("BigRational.makeUnsafe: zero denominator");
    }

    return reduce(numerator, denominator);
};

/**
 * Creates the rational equal to an integer.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromBigInt = (n: bigint): BigRational => ofReduced(n, 1n);

/**
 * A `BigRational` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero: BigRational = fromBigInt(0n);

/**
 * The rational one.
 *
 * @category Constants
 * @since 1.0.0
 */
export const one: BigRational = fromBigInt(1n);

// Guards

/**
 * Checks whether a rational is zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isZero = (r: BigRational): boolean => r.numerator === 0n;

/**
 * Checks whether a rational is an integer, that is whether its reduced denominator
 * is one.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isInteger = (r: BigRational): boolean => r.denominator === 1n;

/**
 * Checks whether a rational is strictly less than zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isNegative = (r: BigRational): boolean => r.numerator < 0n;

/**
 * Checks whether a rational is strictly greater than zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isPositive = (r: BigRational): boolean => r.numerator > 0n;

// Equality and order

/**
 * Field-wise equality—sound because every rational is stored reduced.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equals: {
    (b: BigRational): (a: BigRational) => boolean;
    (a: BigRational, b: BigRational): boolean;
} = Function.dual(
    2,
    (a: BigRational, b: BigRational): boolean =>
        a.numerator === b.numerator && a.denominator === b.denominator
);

/**
 * The `Equivalence` instance for rationals, based on {@link equals}.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equivalence_.Equivalence<BigRational> =
    Equivalence_.make(equals);

/**
 * Cross-multiplication comparison—denominators are always positive, so no
 * sign flip is needed.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: order.Order<BigRational> = order.make((a, b) =>
{
    const left = a.numerator * b.denominator;
    const right = b.numerator * a.denominator;
    return left < right ? -1 : left > right ? 1 : 0;
});

/**
 * Checks whether the first rational is less than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan = order.isLessThan(Order);

/**
 * Checks whether the first rational is less than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo = order.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first rational is greater than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan = order.isGreaterThan(Order);

/**
 * Checks whether the first rational is greater than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo = order.isGreaterThanOrEqualTo(Order);

/**
 * Returns the smaller of two rationals.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min = order.min(Order);

/**
 * Returns the larger of two rationals.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max = order.max(Order);

/**
 * Restricts a rational to the inclusive range between `minimum` and `maximum`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp = order.clamp(Order);

/**
 * Checks whether a rational lies in the inclusive range between `minimum` and
 * `maximum`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isBetween = order.isBetween(Order);

// Arithmetic

/**
 * Adds two rationals exactly.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sum: {
    (b: BigRational): (a: BigRational) => BigRational;
    (a: BigRational, b: BigRational): BigRational;
} = Function.dual(2, (a: BigRational, b: BigRational): BigRational =>
    reduce(
        a.numerator * b.denominator + b.numerator * a.denominator,
        a.denominator * b.denominator
    )
);

/**
 * Subtracts the second rational from the first exactly.
 *
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    (b: BigRational): (a: BigRational) => BigRational;
    (a: BigRational, b: BigRational): BigRational;
} = Function.dual(2, (a: BigRational, b: BigRational): BigRational =>
    reduce(
        a.numerator * b.denominator - b.numerator * a.denominator,
        a.denominator * b.denominator
    )
);

/**
 * Multiplies two rationals exactly.
 *
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    (b: BigRational): (a: BigRational) => BigRational;
    (a: BigRational, b: BigRational): BigRational;
} = Function.dual(2, (a: BigRational, b: BigRational): BigRational =>
    reduce(a.numerator * b.numerator, a.denominator * b.denominator)
);

/**
 * Negates a rational exactly.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (r: BigRational): BigRational =>
    ofReduced(-r.numerator, r.denominator);

/**
 * The absolute value of a rational.
 *
 * @category Operation
 * @since 1.0.0
 */
export const abs = (r: BigRational): BigRational =>
    r.numerator < 0n ? negate(r) : r;

/**
 * The sign of a rational as an `Ordering`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sign = (r: BigRational): Ordering.Ordering =>
    r.numerator < 0n ? -1 : r.numerator > 0n ? 1 : 0;

/**
 * The reciprocal of a rational, or `Option.none()` for zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const reciprocal = (r: BigRational): Option.Option<BigRational> =>
    r.numerator === 0n
        ? Option.none()
        : Option.some(
            r.numerator < 0n
                ? ofReduced(-r.denominator, -r.numerator)
                : ofReduced(r.denominator, r.numerator)
        );

/**
 * Throws a `RangeError` when the argument is zero.
 *
 * @throws { RangeError } When the argument is zero.
 * @category Operation
 * @since 1.0.0
 */
export const reciprocalUnsafe = (r: BigRational): BigRational =>
{
    if (r.numerator === 0n)
    {
        throw new RangeError("Division by zero");
    }

    return r.numerator < 0n
        ? ofReduced(-r.denominator, -r.numerator)
        : ofReduced(r.denominator, r.numerator);
};

/**
 * Returns `Option.none()` when the divisor is zero—ℚ has no infinities.
 *
 * @category Operation
 * @since 1.0.0
 */
export const divide: {
    (b: BigRational): (a: BigRational) => Option.Option<BigRational>;
    (a: BigRational, b: BigRational): Option.Option<BigRational>;
} = Function.dual(2, (a: BigRational, b: BigRational): Option.Option<BigRational> =>
    Option.map(reciprocal(b), (rb) => multiply(a, rb))
);

/**
 * Throws a `RangeError` when the divisor is zero.
 *
 * @throws { RangeError } When the divisor is zero.
 * @category Operation
 * @since 1.0.0
 */
export const divideUnsafe: {
    (b: BigRational): (a: BigRational) => BigRational;
    (a: BigRational, b: BigRational): BigRational;
} = Function.dual(2, (a: BigRational, b: BigRational): BigRational =>
    multiply(a, reciprocalUnsafe(b))
);

/**
 * Adds every rational in a collection exactly; an empty collection sums to zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sumAll = (collection: Iterable<BigRational>): BigRational =>
    Array.reduce(collection, zero, sum);

/**
 * Multiplies every rational in a collection exactly; an empty collection
 * multiplies to one.
 *
 * @category Operation
 * @since 1.0.0
 */
export const multiplyAll = (collection: Iterable<BigRational>): BigRational =>
    Array.reduce(collection, one, multiply);

// Rounding

/**
 * Rounds to the nearest bigint under the given mode (the `RoundingMode`
 * vocabulary of `@bedform/effect/BigDecimal`; the default, `"half-from-zero"`, is
 * BigDecimal's default). Returns a bigint rather than a BigRational because
 * every boundary that rounds—money amounts, nanoseconds, milliseconds—
 * wants an integer.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const round: {
    (options?: {
        readonly mode?: BigDecimal.RoundingMode;
    }): (self: BigRational) => bigint;
    (
        self: BigRational,
        options?: { readonly mode?: BigDecimal.RoundingMode },
    ): bigint;
} = Function.dual(
    (args) => isBigRational(args[0]),
    (
        self: BigRational,
        options?: { readonly mode?: BigDecimal.RoundingMode }
    ): bigint =>
    {
        const mode = options?.mode ?? "half-from-zero";
        const n = self.numerator;
        const d = self.denominator;
        const quotient = n / d;
        const remainder = n % d;

        if (remainder === 0n)
        {
            return quotient;
        }

        const towardZero = quotient;
        const fromZero = n < 0n ? quotient - 1n : quotient + 1n;
        const floor = n < 0n ? fromZero : towardZero;
        const ceil = n < 0n ? towardZero : fromZero;
        const twiceRemainder = 2n * (remainder < 0n ? -remainder : remainder);

        /** Nearest, resolving an exact tie with `onTie`. */
        const nearest = (onTie: bigint): bigint =>
            twiceRemainder < d ? towardZero : twiceRemainder > d ? fromZero : onTie;

        return Match.value(mode).pipe(
            Match.when("ceil", () => ceil),
            Match.when("floor", () => floor),
            Match.when("to-zero", () => towardZero),
            Match.when("from-zero", () => fromZero),
            Match.when("half-ceil", () => nearest(ceil)),
            Match.when("half-floor", () => nearest(floor)),
            Match.when("half-to-zero", () => nearest(towardZero)),
            Match.when("half-from-zero", () => nearest(fromZero)),
            Match.when("half-even", () =>
                nearest(towardZero % 2n === 0n ? towardZero : fromZero)
            ),
            Match.when("half-odd", () =>
                nearest(towardZero % 2n === 0n ? fromZero : towardZero)
            ),
            Match.exhaustive
        );
    }
);

// Conversions

// Doubling a finite non-integral double is always exact (its magnitude is
// below 2^53), so this recursion terminates with the exact scaled mantissa
//—at most 1075 steps, for the smallest subnormal.
const dyadic = (mantissa: number, denominator: bigint): BigRational =>
    Number.isInteger(mantissa)
        ? reduce(globalThis.BigInt(mantissa), denominator)
        : dyadic(mantissa * 2, denominator << 1n);

/**
 * The exact rational value of a finite double; every finite double is a dyadic
 * rational.
 *
 * @throws { RangeError } When the input is NaN or ±Infinity.
 * @category Constructors
 * @since 1.0.0
 */
export const fromNumberUnsafe = (n: number): BigRational =>
{
    if (!Number.isFinite(n))
    {
        throw new RangeError(`BigRational.fromNumberUnsafe: ${n}`);
    }

    return dyadic(n, 1n);
};

/**
 * The exact rational value of a finite double, or `Option.none()` for NaN and
 * ±Infinity.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromNumber = (n: number): Option.Option<BigRational> =>
    Number.isFinite(n) ? Option.some(fromNumberUnsafe(n)) : Option.none();

const maxSafeInteger = 9_007_199_254_740_991n;

// No Effect helper covers a bigint's binary width, so this stays on the
// built-in radix conversion.
const bitLength = (n: bigint): number => String.length(n.toString(2));

/**
 * The correctly rounded (nearest, ties to even) double of a positive
 * rational a/b, or `undefined` on overflow to Infinity. Guard/round/sticky
 * rounding on a ≥55-bit integer quotient, with subnormal precision loss and
 * carry handled explicitly.
 */
const positiveToNumber = (a: bigint, b: bigint): number | undefined =>
{
    // Both operands exactly representable: one correctly rounded division.
    if (a <= maxSafeInteger && b <= maxSafeInteger)
    {
        return Number(a) / Number(b);
    }

    // a/b lies in [2^(e-1), 2^(e+1)).
    const e = bitLength(a) - bitLength(b);
    // Below 2^-1075 (the midpoint between 0 and the smallest subnormal)
    // everything rounds to 0; at or above 2^1024 everything overflows.
    if (e <= -1_076)
    {
        return 0;
    }

    if (e >= 1_025)
    {
        return undefined;
    }

    // Scale so the integer quotient has at least 55 bits.
    const shift = 55 - e;
    const scaledA = shift >= 0 ? a << globalThis.BigInt(shift) : a;
    const scaledB = shift >= 0 ? b : b << globalThis.BigInt(-shift);
    const quotient = scaledA / scaledB;
    const remainder = scaledA % scaledB;

    // The value's leading bit sits at exactly this power of two.
    const quotientBits = bitLength(quotient);
    const leadPosition = quotientBits - 1 - shift;
    if (leadPosition > 1_023)
    {
        return undefined;
    }

    if (leadPosition < -1_075)
    {
        return 0;
    }

    if (leadPosition === -1_075)
    {
    // Candidates are 0 and 2^-1074, with the midpoint at 2^-1075: exactly
    // the midpoint ties to even (0), anything above rounds up.
        const isExactMidpoint =
            quotient === 1n << globalThis.BigInt(quotientBits - 1) &&
      remainder === 0n;
        return isExactMidpoint ? 0 : 2 ** -1_074;
    }

    // Subnormal results keep fewer than 53 bits (the lowest kept bit is 2^-1074).
    const precision = Math.min(53, leadPosition + 1_075);
    const drop = quotientBits - precision;
    const truncated = quotient >> globalThis.BigInt(drop);
    const roundBit = (quotient >> globalThis.BigInt(drop - 1)) & 1n;
    const sticky =
        (quotient & ((1n << globalThis.BigInt(drop - 1)) - 1n)) !== 0n ||
    remainder !== 0n;
    // Ties to even: round up on a set guard bit unless the remainder is
    // exactly half and the kept mantissa is already even.
    const mantissa =
        roundBit === 1n && (sticky || truncated % 2n === 1n)
            ? truncated + 1n
            : truncated;

    // A carry out of the mantissa (to exactly 2^precision) raises the leading
    // bit by one, which can push a near-maximal value over the top.
    const carried = bitLength(mantissa) > precision;
    if (leadPosition + (carried ? 1 : 0) > 1_023)
    {
        return undefined;
    }

    // Both factors are exact and the product is representable by construction,
    // so this multiplication is exact (2^exponent is exact for exponent ≥ -1074).
    return Number(mantissa) * 2 ** (drop - shift);
};

/**
 * The correctly rounded double nearest the rational, or `Option.none()`
 * when that double would be ±Infinity. Underflow to zero is a rounding, not
 * a failure, and yields `Option.some(0)`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toNumber = (r: BigRational): Option.Option<number> =>
{
    if (r.numerator === 0n)
    {
        return Option.some(0);
    }

    const negative = r.numerator < 0n;
    const magnitude = positiveToNumber(
        negative ? -r.numerator : r.numerator,
        r.denominator
    );
    return magnitude === undefined
        ? Option.none()
        : Option.some(negative ? -magnitude : magnitude);
};

/**
 * Throws a `RangeError` when the nearest double is ±Infinity.
 *
 * @throws { RangeError } When the nearest double is ±Infinity.
 * @category Conversions
 * @since 1.0.0
 */
export const toNumberUnsafe = (r: BigRational): number =>
    Option.getOrThrowWith(
        toNumber(r),
        () => new RangeError(`BigRational.toNumberUnsafe: ${format(r)} overflows`)
    );

/**
 * The exact rational value of a `BigDecimal`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigDecimal = (bd: BigDecimal.BigDecimal): BigRational =>
    bd.scale >= 0
        ? reduce(bd.value, 10n ** globalThis.BigInt(bd.scale))
        : fromBigInt(bd.value * 10n ** globalThis.BigInt(-bd.scale));

/**
 * Rounds to a `BigDecimal` at the given scale—exactly one rounding, made
 * explicit. For a lossless conversion when one exists, use
 * {@link toBigDecimalExact}.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigDecimal: {
    (options: {
        readonly scale: number;
        readonly mode?: BigDecimal.RoundingMode;
    }): (self: BigRational) => BigDecimal.BigDecimal;
    (
        self: BigRational,
        options: {
            readonly scale: number;
            readonly mode?: BigDecimal.RoundingMode;
        },
    ): BigDecimal.BigDecimal;
} = Function.dual(
    2,
    (
        self: BigRational,
        options: {
            readonly scale: number;
            readonly mode?: BigDecimal.RoundingMode;
        }
    ): BigDecimal.BigDecimal =>
    {
        const scaled =
            options.scale >= 0
                ? reduce(
                    self.numerator * 10n ** globalThis.BigInt(options.scale),
                    self.denominator
                )
                : reduce(
                    self.numerator,
                    self.denominator * 10n ** globalThis.BigInt(-options.scale)
                );
        return BigDecimal.make(
            round(scaled, options.mode === undefined ? {} : { mode: options.mode }),
            options.scale
        );
    }
);

/**
 * The exact `BigDecimal` equal to the rational, when one exists—i.e. when
 * the denominator is a product of twos and fives, so the decimal expansion
 * terminates. `Option.none()` otherwise (e.g. 1/3).
 */
/** Divides out every factor of `prime`, returning the rest and the count. */
const factorOut = (
    n: bigint,
    prime: bigint,
    count = 0
): readonly [rest: bigint, count: number] =>
{
    while (n % prime === 0n)
    {
        n /= prime;
        count += 1;
    }

    return [ n, count ];
};

/**
 * Converts a rational to a `BigDecimal` without rounding when it has a terminating
 * decimal expansion, that is when its reduced denominator has no prime factors
 * other than 2 and 5. Returns `Option.none()` otherwise.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigDecimalExact = (
    self: BigRational
): Option.Option<BigDecimal.BigDecimal> =>
{
    const [ withoutTwos, twos ] = factorOut(self.denominator, 2n);
    const [ rest, fives ] = factorOut(withoutTwos, 5n);

    if (rest !== 1n)
    {
        return Option.none();
    }

    const scale = Math.max(twos, fives);
    return Option.some(
        BigDecimal.make(
            (self.numerator * 10n ** globalThis.BigInt(scale)) / self.denominator,
            scale
        )
    );
};

// Formatting and schemas

/**
 * The canonical string encoding: the reduced fraction with the sign on the
 * numerator, integers without the `/1` (`"3/2"`, `"-3/2"`, `"3"`).
 *
 * @category Constructors
 * @since 1.0.0
 */
export const format = (r: BigRational): string =>
    r.denominator === 1n
        ? globalThis.String(r.numerator)
        : `${r.numerator}/${r.denominator}`;

const parsePattern = /^(-?\d+)(?:\/([1-9]\d*))?$/;

/**
 * Parses the encoding produced by {@link format} (a denominator of 1 may be
 * spelled out; non-canonical fractions like `"6/4"` reduce on the way in).
 * Returns `Option.none()` for anything else, including zero denominators.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromString = (s: string): Option.Option<BigRational> =>
    String.match(parsePattern)(s).pipe(
        Option.flatMap((groups) =>
            Option.map(Option.fromUndefinedOr(groups[1]), (numerator) =>
                reduce(
                    globalThis.BigInt(numerator),
                    groups[2] === undefined ? 1n : globalThis.BigInt(groups[2])
                )
            )
        )
    );

/**
 * Throws a `RangeError` on input {@link fromString} would reject.
 *
 * @throws { RangeError } When {@link fromString} would reject the input.
 * @category Conversions
 * @since 1.0.0
 */
export const fromStringUnsafe = (s: string): BigRational =>
    Option.getOrThrowWith(
        fromString(s),
        () => new RangeError(`BigRational.fromStringUnsafe: ${JSON.stringify(s)}`)
    );

/**
 * The single definition of the canonical string encoding, shared by
 * {@link BigRationalFromString} and by the `toCodecJson` annotation on
 * {@link BigRational}, so the two can never drift apart.
 */
const stringTransformation = {
    decode: SchemaGetter.transformResult((s: string, options) =>
        Option.match(fromString(s), {
            onNone: () =>
                Result.fail(
                    new SchemaIssue.InvalidValue(
                        { message: "not a canonical rational encoding" },
                        s,
                        options
                    )
                ),
            onSome: Result.succeed
        })
    ),
    encode: SchemaGetter.transform(format)
};

/**
 * The identity schema: a `BigRational` on both sides, decoded from itself.
 *
 * It carries the canonical string encoding as its JSON representation, so
 * `Schema.toCodecJson` derives that codec on demand—including when a
 * rational is nested inside a larger schema of your own.
 * {@link BigRationalFromString} is the same codec named directly, with a
 * precise `string` encoded type rather than `Json`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const BigRational = Schema.declare(isBigRational, {
    identifier: "BigRational",
    toFormatter: () => format,
    toEquivalence: () => Equivalence,
    toCodecJson: () =>
        Schema.link<BigRational>()(Schema.String, stringTransformation)
});

/**
 * The codec between rationals and their canonical string encoding (`"3/2"`,
 * `"-3/2"`, `"3"`), as produced by `format`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const BigRationalFromString = Schema.String.annotate({
    description: "a string to be decoded into a BigRational"
})
    .pipe(Schema.decodeTo(BigRational, stringTransformation))
    .annotate({ identifier: "BigRationalFromString" });
