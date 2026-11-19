/**
 * Exact rational numbers stored as reduced fractions of safe integers (`Int`),
 * with the same API as `@bedform/effect/BigRational`.
 *
 * Arithmetic is exact. Each operation first works in `number`s, which is
 * exact while every intermediate product is a safe integer. When one is not,
 * it recomputes the result in `bigint` through `BigRational` and reduces it.
 * A reduced result whose numerator or denominator still lies outside the
 * safe range cannot be represented, and the operation throws a `RangeError`.
 * Use `BigRational` when values may grow without bound.
 *
 * Derived from the effect-units 1.0.1 `Rational` module.
 *
 * @module @bedform/effect/Rational
 *
 * @file      Rational.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Mirror the generics, contextual inference and property order of @bedform/effect/BigRational. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Array from "./Array.js";
import type * as BigDecimal from "./BigDecimal.js";
import * as BigRational from "./BigRational.js";
import * as Equal from "./Equal.js";
import * as Equivalence_ from "./Equivalence.js";
import * as Function from "./Function.js";
import * as Hash from "./Hash.js";
import type * as Inspectable from "./Inspectable.js";
import * as Int from "./Int.js";
import * as Option from "./Option.js";
import * as Ord from "./Order.js";
import type * as Ordering from "./Ordering.js";
import type * as Pipeable from "./Pipeable.js";
import * as Predicate from "./Predicate.js";
import * as Result from "./Result.js";
import * as Schema from "./Schema.js";
import * as SchemaGetter from "./SchemaGetter.js";
import * as SchemaIssue from "./SchemaIssue.js";

import { ValueObjectProto } from "./Internal/valueObject.js";

/**
 * The runtime brand carried by every `Rational`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const TypeId = Symbol.for("@bedform/effect/Rational");

/**
 * The type of the runtime brand carried by every `Rational`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export type TypeId = typeof TypeId;

/**
 * An exact rational number: a reduced fraction of safe integers. Unlike
 * floats, arithmetic on rationals is exact; unlike `BigRational`, the
 * numerator and denominator are plain `number`s, so a result that needs more
 * than 53 bits throws a `RangeError` rather than growing.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Rational
    extends Equal.Equal, Inspectable.Inspectable, Pipeable.Pipeable
{
    readonly [TypeId]: TypeId;
    /** Carries the sign. An integer n is n/1. */
    readonly numerator: Int.Int;
    /** Always positive; gcd(|numerator|, denominator) is 1. */
    readonly denominator: Int.Int;
}

/**
 * Checks whether a value is a `Rational`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isRational = (u: unknown): u is Rational =>
    Predicate.hasProperty(u, TypeId);

const Proto = {
    ...ValueObjectProto,
    [TypeId]: TypeId,
    [Equal.symbol](this: Rational, that: unknown): boolean
    {
        return isRational(that) && equals(this, that);
    },
    [Hash.symbol](this: Rational): number
    {
        return Hash.combine(Hash.number(this.numerator))(Hash.number(this.denominator));
    },
    toJSON(this: Rational)
    {
        return {
            _id: "Rational",
            numerator: this.numerator,
            denominator: this.denominator
        };
    }
} as const;

/** Builds a rational whose fields are already reduced and sign-normalized. */
const ofReduced = (numerator: number, denominator: number): Rational =>
    Object.assign(Object.create(Proto), {
        numerator: numerator + 0,
        denominator
    });

/** The non-negative gcd of two non-negative safe integers. */
const gcdOf = (a: number, b: number): number =>
{
    while (b !== 0)
    {
        const next = a % b;
        a = b;
        b = next;
    }

    return a;
};

/**
 * Reduces a fraction of safe integers to lowest terms with the sign carried
 * by the numerator. Total on a non-zero denominator, which every caller
 * establishes first. Reduction only shrinks magnitudes, and the safe range is
 * symmetric, so the result is always representable.
 */
const reduce = (numerator: number, denominator: number): Rational =>
{
    const flip = denominator < 0 ? -1 : 1;
    const n = flip * numerator;
    const d = flip * denominator;
    const g = gcdOf(Math.abs(n), d);
    return ofReduced(n / g, d / g);
};

/** Widens a rational to the equal `BigRational`. */
const toBig = (r: Rational): BigRational.BigRational =>
    BigRational.makeUnsafe(BigInt(r.numerator), BigInt(r.denominator));

const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

/** Whether a reduced `BigRational` has safe-integer parts. */
const fits = (r: BigRational.BigRational): boolean =>
    r.denominator <= maxSafe &&
    r.numerator <= maxSafe &&
    r.numerator >= -maxSafe;

/** Narrows an already reduced `BigRational` that is known to fit. */
const ofBig = (r: BigRational.BigRational): Rational =>
    ofReduced(Number(r.numerator), Number(r.denominator));

/**
 * Narrows the exact result of an operation, throwing when it cannot be
 * represented.
 *
 * @throws { RangeError } When the reduced parts lie outside the safe range.
 */
const narrow = (r: BigRational.BigRational, operation: string): Rational =>
{
    if (!fits(r))
    {
        throw new RangeError(
            `Rational.${operation}: ${BigRational.format(r)} does not fit in safe integers`
        );
    }

    return ofBig(r);
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
    numerator: Int.Int,
    denominator: Int.Int = Int.one
): Option.Option<Rational> =>
    denominator === 0
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
    numerator: Int.Int,
    denominator: Int.Int = Int.one
): Rational =>
{
    if (denominator === 0)
    {
        throw new RangeError("Rational.makeUnsafe: zero denominator");
    }

    return reduce(numerator, denominator);
};

/**
 * Creates the rational equal to an integer.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromInt = (n: Int.Int): Rational => ofReduced(n, 1);

/**
 * A `Rational` of zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero: Rational = fromInt(Int.zero);

/**
 * The rational one.
 *
 * @category Constants
 * @since 1.0.0
 */
export const one: Rational = fromInt(Int.one);

// BigRational interop

/**
 * Widens a rational to the equal `BigRational`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRational = (r: Rational): BigRational.BigRational => toBig(r);

/**
 * Narrows a `BigRational` to the equal `Rational`, or `Option.none()` when its
 * numerator or denominator lies outside the safe range.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigRational = (
    r: BigRational.BigRational
): Option.Option<Rational> =>
    fits(r) ? Option.some(ofBig(r)) : Option.none();

/**
 * Narrows a `BigRational` to the equal `Rational`.
 *
 * @throws { RangeError } When the numerator or denominator lies outside the
 * safe range.
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigRationalUnsafe = (r: BigRational.BigRational): Rational =>
    narrow(r, "fromBigRationalUnsafe");

// Guards

/**
 * Checks whether a rational is zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isZero = (r: Rational): boolean => r.numerator === 0;

/**
 * Checks whether a rational is an integer, that is whether its reduced denominator
 * is one.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isInteger = (r: Rational): boolean => r.denominator === 1;

/**
 * Checks whether a rational is strictly less than zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isNegative = (r: Rational): boolean => r.numerator < 0;

/**
 * Checks whether a rational is strictly greater than zero.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isPositive = (r: Rational): boolean => r.numerator > 0;

// Equality and order

/**
 * Field-wise equality—sound because every rational is stored reduced.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equals: {
    (b: Rational): (a: Rational) => boolean;
    (a: Rational, b: Rational): boolean;
} = Function.dual(
    2,
    (a: Rational, b: Rational): boolean =>
        a.numerator === b.numerator && a.denominator === b.denominator
);

/**
 * The `Equivalence` instance for rationals, based on {@link equals}.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equivalence_.Equivalence<Rational> =
    Equivalence_.make(equals);

/**
 * Cross-multiplication comparison—denominators are always positive, so no
 * sign flip is needed. Falls back to `bigint` when a cross product is not a
 * safe integer, so the comparison is always exact.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<Rational> = Ord.make((a, b) =>
{
    const left = a.numerator * b.denominator;
    const right = b.numerator * a.denominator;
    if (Number.isSafeInteger(left) && Number.isSafeInteger(right))
    {
        return left < right ? -1 : left > right ? 1 : 0;
    }

    return BigRational.Order(toBig(a), toBig(b));
});

/**
 * Checks whether the first rational is less than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan = Ord.isLessThan(Order);

/**
 * Checks whether the first rational is less than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo = Ord.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first rational is greater than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan = Ord.isGreaterThan(Order);

/**
 * Checks whether the first rational is greater than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo = Ord.isGreaterThanOrEqualTo(Order);

/**
 * Returns the smaller of two rationals.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min = Ord.min(Order);

/**
 * Returns the larger of two rationals.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max = Ord.max(Order);

/**
 * Restricts a rational to the inclusive range between `minimum` and `maximum`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp = Ord.clamp(Order);

/**
 * Checks whether a rational lies in the inclusive range between `minimum` and
 * `maximum`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isBetween = Ord.isBetween(Order);

// Arithmetic

/** Adds or subtracts exactly, by `sign` of `b`. */
const addSigned = (
    a: Rational,
    b: Rational,
    direction: 1 | -1,
    operation: string
): Rational =>
{
    const left = a.numerator * b.denominator;
    const right = direction * b.numerator * a.denominator;
    const numerator = left + right;
    const denominator = a.denominator * b.denominator;
    if (
        Number.isSafeInteger(left) &&
        Number.isSafeInteger(right) &&
        Number.isSafeInteger(numerator) &&
        Number.isSafeInteger(denominator)
    )
    {
        return reduce(numerator, denominator);
    }

    return narrow(
        direction === 1
            ? BigRational.sum(toBig(a), toBig(b))
            : BigRational.subtract(toBig(a), toBig(b)),
        operation
    );
};

/**
 * Adds two rationals exactly.
 *
 * @throws { RangeError } When the reduced sum does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const sum: {
    (b: Rational): (a: Rational) => Rational;
    (a: Rational, b: Rational): Rational;
} = Function.dual(2, (a: Rational, b: Rational): Rational =>
    addSigned(a, b, 1, "sum")
);

/**
 * Subtracts the second rational from the first exactly.
 *
 * @throws { RangeError } When the reduced difference does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    (b: Rational): (a: Rational) => Rational;
    (a: Rational, b: Rational): Rational;
} = Function.dual(2, (a: Rational, b: Rational): Rational =>
    addSigned(a, b, -1, "subtract")
);

/**
 * Multiplies two rationals exactly. Common factors are cancelled across the
 * fractions before multiplying, so the product is already reduced, and an
 * unsafe product is a genuine overflow.
 *
 * @throws { RangeError } When the reduced product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    (b: Rational): (a: Rational) => Rational;
    (a: Rational, b: Rational): Rational;
} = Function.dual(2, (a: Rational, b: Rational): Rational =>
{
    const g1 = gcdOf(Math.abs(a.numerator), b.denominator);
    const g2 = gcdOf(Math.abs(b.numerator), a.denominator);
    const numerator = (a.numerator / g1) * (b.numerator / g2);
    const denominator = (a.denominator / g2) * (b.denominator / g1);
    if (Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator))
    {
        return ofReduced(numerator, denominator);
    }

    return narrow(BigRational.multiply(toBig(a), toBig(b)), "multiply");
});

/**
 * Negates a rational exactly; the safe range is symmetric, so this never fails.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (r: Rational): Rational =>
    ofReduced(-r.numerator, r.denominator);

/**
 * The absolute value of a rational.
 *
 * @category Operation
 * @since 1.0.0
 */
export const abs = (r: Rational): Rational => (r.numerator < 0 ? negate(r) : r);

/**
 * The sign of a rational as an `Ordering`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sign = (r: Rational): Ordering.Ordering =>
    r.numerator < 0 ? -1 : r.numerator > 0 ? 1 : 0;

/**
 * The reciprocal of a rational, or `Option.none()` for zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const reciprocal = (r: Rational): Option.Option<Rational> =>
    r.numerator === 0
        ? Option.none()
        : Option.some(
            r.numerator < 0
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
export const reciprocalUnsafe = (r: Rational): Rational =>
{
    if (r.numerator === 0)
    {
        throw new RangeError("Division by zero");
    }

    return r.numerator < 0
        ? ofReduced(-r.denominator, -r.numerator)
        : ofReduced(r.denominator, r.numerator);
};

/**
 * Returns `Option.none()` when the divisor is zero—ℚ has no infinities.
 *
 * @throws { RangeError } When the reduced quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const divide: {
    (b: Rational): (a: Rational) => Option.Option<Rational>;
    (a: Rational, b: Rational): Option.Option<Rational>;
} = Function.dual(2, (a: Rational, b: Rational): Option.Option<Rational> =>
    Option.map(reciprocal(b), (rb) => multiply(a, rb))
);

/**
 * Throws a `RangeError` when the divisor is zero.
 *
 * @throws { RangeError } When the divisor is zero, or when the reduced
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const divideUnsafe: {
    (b: Rational): (a: Rational) => Rational;
    (a: Rational, b: Rational): Rational;
} = Function.dual(2, (a: Rational, b: Rational): Rational =>
    multiply(a, reciprocalUnsafe(b))
);

/**
 * Adds every rational in a collection exactly; an empty collection sums to zero.
 *
 * @throws { RangeError } When a partial sum does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const sumAll = (collection: Iterable<Rational>): Rational =>
    Array.reduce(collection, zero, sum);

/**
 * Multiplies every rational in a collection exactly; an empty collection
 * multiplies to one.
 *
 * @throws { RangeError } When a partial product does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const multiplyAll = (collection: Iterable<Rational>): Rational =>
    Array.reduce(collection, one, multiply);

// Rounding

/**
 * Rounds to the nearest `Int` under the given mode (the `RoundingMode`
 * vocabulary of `@bedform/effect/BigDecimal`; the default, `"half-from-zero"`, is
 * BigDecimal's default). A rounded rational never leaves the safe range,
 * since its magnitude is at most that of its numerator.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const round: {
    (options?: {
        readonly mode?: BigDecimal.RoundingMode;
    }): (self: Rational) => Int.Int;
    (
        self: Rational,
        options?: { readonly mode?: BigDecimal.RoundingMode },
    ): Int.Int;
} = Function.dual(
    (args) => isRational(args[0]),
    (
        self: Rational,
        options?: { readonly mode?: BigDecimal.RoundingMode }
    ): Int.Int =>
        Int.makeUnsafe(Number(BigRational.round(toBig(self), options)))
);

// Conversions

/**
 * The exact rational value of a finite double, when its reduced numerator and
 * denominator are safe integers; `Option.none()` otherwise, and for NaN and
 * ±Infinity. Most doubles with a fractional part need a denominator above
 * 2^53 (0.1 needs 2^55), so prefer {@link make} for decimal literals.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromNumber = (n: number): Option.Option<Rational> =>
    Option.flatMap(BigRational.fromNumber(n), fromBigRational);

/**
 * The exact rational value of a finite double.
 *
 * @throws { RangeError } When the input is NaN or ±Infinity, or when its exact
 * value does not fit in safe integers.
 * @category Constructors
 * @since 1.0.0
 */
export const fromNumberUnsafe = (n: number): Rational =>
    narrow(BigRational.fromNumberUnsafe(n), "fromNumberUnsafe");

/**
 * The correctly rounded double nearest the rational. Both parts are safe
 * integers, so a single division rounds correctly and never overflows; the
 * result is always `Option.some`, which keeps the signature that of
 * `BigRational.toNumber`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toNumber = (r: Rational): Option.Option<number> =>
    Option.some(r.numerator / r.denominator);

/**
 * The correctly rounded double nearest the rational. Never throws, and is
 * named for parity with `BigRational.toNumberUnsafe`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toNumberUnsafe = (r: Rational): number =>
    r.numerator / r.denominator;

/**
 * The exact rational value of a `BigDecimal`, or `Option.none()` when it does
 * not fit in safe integers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigDecimal = (
    bd: BigDecimal.BigDecimal
): Option.Option<Rational> => fromBigRational(BigRational.fromBigDecimal(bd));

/**
 * The exact rational value of a `BigDecimal`.
 *
 * @throws { RangeError } When the value does not fit in safe integers.
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigDecimalUnsafe = (bd: BigDecimal.BigDecimal): Rational =>
    narrow(BigRational.fromBigDecimal(bd), "fromBigDecimalUnsafe");

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
    }): (self: Rational) => BigDecimal.BigDecimal;
    (
        self: Rational,
        options: {
            readonly scale: number;
            readonly mode?: BigDecimal.RoundingMode;
        },
    ): BigDecimal.BigDecimal;
} = Function.dual(
    2,
    (
        self: Rational,
        options: {
            readonly scale: number;
            readonly mode?: BigDecimal.RoundingMode;
        }
    ): BigDecimal.BigDecimal => BigRational.toBigDecimal(toBig(self), options)
);

/**
 * Converts a rational to a `BigDecimal` without rounding when it has a terminating
 * decimal expansion, that is when its reduced denominator has no prime factors
 * other than 2 and 5. Returns `Option.none()` otherwise.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigDecimalExact = (
    self: Rational
): Option.Option<BigDecimal.BigDecimal> =>
    BigRational.toBigDecimalExact(toBig(self));

// Formatting and schemas

/**
 * The canonical string encoding: the reduced fraction with the sign on the
 * numerator, integers without the `/1` (`"3/2"`, `"-3/2"`, `"3"`). It is the
 * same encoding as `BigRational.format`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const format = (r: Rational): string =>
    r.denominator === 1
        ? globalThis.String(r.numerator)
        : `${r.numerator}/${r.denominator}`;

/**
 * Parses the encoding produced by {@link format} (a denominator of 1 may be
 * spelled out; non-canonical fractions like `"6/4"` reduce on the way in).
 * Returns `Option.none()` for anything else, including zero denominators and
 * values that do not fit in safe integers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromString = (s: string): Option.Option<Rational> =>
    Option.flatMap(BigRational.fromString(s), fromBigRational);

/**
 * Throws a `RangeError` on input {@link fromString} would reject.
 *
 * @throws { RangeError } When {@link fromString} would reject the input.
 * @category Conversions
 * @since 1.0.0
 */
export const fromStringUnsafe = (s: string): Rational =>
    Option.getOrThrowWith(
        fromString(s),
        () => new RangeError(`Rational.fromStringUnsafe: ${JSON.stringify(s)}`)
    );

/**
 * The single definition of the canonical string encoding, shared by
 * {@link RationalFromString} and by the `toCodecJson` annotation on
 * {@link Rational}, so the two can never drift apart.
 */
const stringTransformation = {
    decode: SchemaGetter.transformResult((s: string, options) =>
        Option.match(fromString(s), {
            onNone: () =>
                Result.fail(
                    new SchemaIssue.InvalidValue(
                        { message: "not a canonical rational encoding with safe-integer parts" },
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
 * The identity schema: a `Rational` on both sides, decoded from itself.
 *
 * It carries the canonical string encoding as its JSON representation, so
 * `Schema.toCodecJson` derives that codec on demand—including when a
 * rational is nested inside a larger schema of your own.
 * {@link RationalFromString} is the same codec named directly, with a
 * precise `string` encoded type rather than `Json`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Rational = Schema.declare(isRational, {
    identifier: "Rational",
    toFormatter: () => format,
    toEquivalence: () => Equivalence,
    toCodecJson: () =>
        Schema.link<Rational>()(Schema.String, stringTransformation)
});

/**
 * The codec between rationals and their canonical string encoding (`"3/2"`,
 * `"-3/2"`, `"3"`), as produced by `format`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const RationalFromString = Schema.String.annotate({
    description: "a string to be decoded into a Rational"
})
    .pipe(Schema.decodeTo(Rational, stringTransformation))
    .annotate({ identifier: "RationalFromString" });
