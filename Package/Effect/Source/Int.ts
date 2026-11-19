/**
 * Safe integers as a branded `number`.
 *
 * An `Int` is a `number` that satisfies `Number.isSafeInteger`, so integer
 * arithmetic on it is exact. Constructors round non-integral input down with
 * `Math.floor`; arithmetic that would leave the safe range throws a
 * `RangeError` rather than silently losing precision, and division floors.
 * Because an `Int` is still a `number`, every `number` API accepts it.
 *
 * @module @bedform/effect/Int
 *
 * @file      Int.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Brand from "./Brand.js";
import * as Combiner from "./Combiner.js";
import * as Equ from "./Equivalence.js";
import * as Function from "./Function.js";
import * as Option from "./Option.js";
import * as Ord from "./Order.js";
import type * as Ordering from "./Ordering.js";
import * as Reducer from "./Reducer.js";
import * as Schema from "./Schema.js";

/**
 * A safe integer: a `number` for which `Number.isSafeInteger` holds. Negative
 * zero is normalized to zero by every constructor and operation.
 *
 * @category Types
 * @since 1.0.0
 */
export type Int = Brand.Branded<number, "Int">;

/**
 * The schema for `Int` values. Decoding rejects non-integral and unsafe
 * numbers rather than flooring them.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Int = Schema.Int.pipe(Schema.brand("Int"));

/** Brands a safe integer, normalizing negative zero. */
const unsafeOf = (n: number): Int => (n + 0) as Int;

/**
 * Brands the result of an operation, throwing when it is not a safe integer.
 *
 * @throws { RangeError } When `n` is not a safe integer.
 */
const checked = (n: number, operation: string): Int =>
{
    if (!Number.isSafeInteger(n))
    {
        throw new RangeError(`Int.${operation}: ${n} is not a safe integer`);
    }

    return unsafeOf(n);
};

/**
 * Checks whether a value is an `Int`, that is a safe integer.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isInt = (u: unknown): u is Int => Number.isSafeInteger(u);

/**
 * Rounds a number down with `Math.floor` and brands it. Returns
 * `Option.none()` for NaN, ±Infinity and results outside the safe range.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (n: number): Option.Option<Int> =>
{
    const floored = Math.floor(n);
    return Number.isSafeInteger(floored)
        ? Option.some(unsafeOf(floored))
        : Option.none();
};

/**
 * Rounds a number down with `Math.floor` and brands it.
 *
 * @throws { RangeError } For NaN, ±Infinity and results outside the safe range.
 * @category Constructors
 * @since 1.0.0
 */
export const makeUnsafe = (n: number): Int => checked(Math.floor(n), "makeUnsafe");

/**
 * The `Int` zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero: Int = unsafeOf(0);

/**
 * The `Int` one.
 *
 * @category Constants
 * @since 1.0.0
 */
export const one: Int = unsafeOf(1);

/**
 * The largest `Int`, `Number.MAX_SAFE_INTEGER`.
 *
 * @category Constants
 * @since 1.0.0
 */
export const maxValue: Int = unsafeOf(Number.MAX_SAFE_INTEGER);

/**
 * The smallest `Int`, `Number.MIN_SAFE_INTEGER`.
 *
 * @category Constants
 * @since 1.0.0
 */
export const minValue: Int = unsafeOf(Number.MIN_SAFE_INTEGER);

const maxSafeBigInt = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Converts a `bigint` to an `Int`, or `Option.none()` when it lies outside the
 * safe range.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigInt = (n: bigint): Option.Option<Int> =>
    n <= maxSafeBigInt && n >= -maxSafeBigInt
        ? Option.some(unsafeOf(Number(n)))
        : Option.none();

/**
 * Converts an `Int` to the equal `bigint`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigInt = (n: Int): bigint => BigInt(n);

const integerPattern = /^[+-]?\d+$/;

/**
 * Parses a decimal integer string, with an optional sign. Returns
 * `Option.none()` for anything else, including values outside the safe range.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromString = (s: string): Option.Option<Int> =>
    integerPattern.test(s) ? fromBigInt(BigInt(s)) : Option.none();

// Arithmetic

/**
 * Adds two `Int`s.
 *
 * @throws { RangeError } When the sum leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const sum: {
    (that: Int): (self: Int) => Int;
    (self: Int, that: Int): Int;
} = Function.dual(2, (self: Int, that: Int): Int => checked(self + that, "sum"));

/**
 * Subtracts the second `Int` from the first.
 *
 * @throws { RangeError } When the difference leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    (that: Int): (self: Int) => Int;
    (self: Int, that: Int): Int;
} = Function.dual(
    2,
    (self: Int, that: Int): Int => checked(self - that, "subtract")
);

/**
 * Multiplies two `Int`s.
 *
 * @throws { RangeError } When the product leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    (that: Int): (self: Int) => Int;
    (self: Int, that: Int): Int;
} = Function.dual(
    2,
    (self: Int, that: Int): Int => checked(self * that, "multiply")
);

/**
 * Floor division of safe integers, exact for every pair of operands. The
 * truncated quotient is recovered from the exact IEEE remainder, so rounding
 * in `self / divisor` can never put the result off by one.
 */
const floorDivide = (self: number, divisor: number): Int =>
{
    const rest = self % divisor;
    const truncated = (self - rest) / divisor;
    return unsafeOf(
        rest !== 0 && rest < 0 !== divisor < 0
            ? truncated - 1
            : truncated
    );
};

/**
 * Divides with the quotient rounded down, as `Math.floor(self / divisor)`
 * would be with exact arithmetic. Returns `Option.none()` when the divisor is
 * zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const divide: {
    (divisor: Int): (self: Int) => Option.Option<Int>;
    (self: Int, divisor: Int): Option.Option<Int>;
} = Function.dual(
    2,
    (self: Int, divisor: Int): Option.Option<Int> =>
        divisor === 0 ? Option.none() : Option.some(floorDivide(self, divisor))
);

/**
 * Divides with the quotient rounded down.
 *
 * @throws { RangeError } When the divisor is zero.
 * @category Operation
 * @since 1.0.0
 */
export const divideUnsafe: {
    (divisor: Int): (self: Int) => Int;
    (self: Int, divisor: Int): Int;
} = Function.dual(2, (self: Int, divisor: Int): Int =>
{
    if (divisor === 0)
    {
        throw new RangeError("Division by zero");
    }

    return floorDivide(self, divisor);
});

/**
 * The truncating remainder, with the sign of `self`, like `%`. A zero divisor
 * yields NaN, as `%` does.
 *
 * @category Operation
 * @since 1.0.0
 */
export const remainder: {
    (divisor: Int): (self: Int) => Int;
    (self: Int, divisor: Int): Int;
} = Function.dual(
    2,
    (self: Int, divisor: Int): Int => unsafeOf(self % divisor)
);

/**
 * Adds one.
 *
 * @throws { RangeError } When the result leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const increment = (n: Int): Int => checked(n + 1, "increment");

/**
 * Subtracts one.
 *
 * @throws { RangeError } When the result leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const decrement = (n: Int): Int => checked(n - 1, "decrement");

/**
 * Negates an `Int`; the safe range is symmetric, so this never fails.
 *
 * @category Operation
 * @since 1.0.0
 */
export const negate = (n: Int): Int => unsafeOf(-n);

/**
 * The absolute value of an `Int`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const abs = (n: Int): Int => unsafeOf(Math.abs(n));

/**
 * The sign of an `Int` as an `Ordering`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sign = (n: Int): Ordering.Ordering =>
    n < 0 ? -1 : n > 0 ? 1 : 0;

/**
 * The non-negative greatest common divisor; `gcd(0, 0)` is zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const gcd: {
    (that: Int): (self: Int) => Int;
    (self: Int, that: Int): Int;
} = Function.dual(2, (self: Int, that: Int): Int =>
{
    let a = Math.abs(self);
    let b = Math.abs(that);
    while (b !== 0)
    {
        const next = a % b;
        a = b;
        b = next;
    }

    return unsafeOf(a);
});

/**
 * The non-negative least common multiple; zero when either argument is zero.
 *
 * @throws { RangeError } When the result leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const lcm: {
    (that: Int): (self: Int) => Int;
    (self: Int, that: Int): Int;
} = Function.dual(2, (self: Int, that: Int): Int =>
    self === 0 || that === 0
        ? zero
        : checked(Math.abs((self / gcd(self, that)) * that), "lcm")
);

/**
 * The floor of the square root of a non-negative `Int`.
 *
 * @throws { RangeError } When the argument is negative.
 * @category Operation
 * @since 1.0.0
 */
export const sqrtUnsafe = (n: Int): Int =>
{
    if (n < 0)
    {
        throw new RangeError("Cannot take the square root of a negative number");
    }

    // Math.sqrt rounds correctly, which can still land on the next integer
    // just below a perfect square, so correct by at most one either way.
    let root = Math.floor(Math.sqrt(n));
    while (root * root > n)
    {
        root -= 1;
    }

    while ((root + 1) * (root + 1) <= n)
    {
        root += 1;
    }

    return unsafeOf(root);
};

/**
 * The floor of the square root, or `Option.none()` for a negative argument.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sqrt = (n: Int): Option.Option<Int> =>
    n < 0 ? Option.none() : Option.some(sqrtUnsafe(n));

/**
 * Adds every `Int` in a collection; an empty collection sums to zero.
 *
 * @throws { RangeError } When a partial sum leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const sumAll = (collection: Iterable<Int>): Int =>
{
    let total = zero;
    for (const n of collection)
    {
        total = sum(total, n);
    }

    return total;
};

/**
 * Multiplies every `Int` in a collection; an empty collection multiplies to one.
 * A zero anywhere short-circuits to zero.
 *
 * @throws { RangeError } When a partial product leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const multiplyAll = (collection: Iterable<Int>): Int =>
{
    let product = one;
    for (const n of collection)
    {
        if (n === 0)
        {
            return zero;
        }

        product = multiply(product, n);
    }

    return product;
};

// Equality and order

/**
 * The `Order` instance for `Int`s.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<Int> = Ord.Number;

/**
 * The `Equivalence` instance for `Int`s.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<Int> = Equ.Number;

/**
 * Checks whether the first `Int` is less than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan = Ord.isLessThan(Order);

/**
 * Checks whether the first `Int` is less than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo = Ord.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first `Int` is greater than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan = Ord.isGreaterThan(Order);

/**
 * Checks whether the first `Int` is greater than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo = Ord.isGreaterThanOrEqualTo(Order);

/**
 * Checks whether an `Int` lies in the inclusive range between `minimum` and
 * `maximum`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const between = Ord.isBetween(Order);

/**
 * Restricts an `Int` to the inclusive range between `minimum` and `maximum`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp = Ord.clamp(Order);

/**
 * Returns the smaller of two `Int`s.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min = Ord.min(Order);

/**
 * Returns the larger of two `Int`s.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max = Ord.max(Order);

// Reducers and combiners

/**
 * A `Reducer` that sums `Int`s, starting from zero.
 *
 * @category Instances
 * @since 1.0.0
 */
export const ReducerSum: Reducer.Reducer<Int> = Reducer.make<Int>(sum, zero);

/**
 * A `Reducer` that multiplies `Int`s, starting from one.
 *
 * @category Instances
 * @since 1.0.0
 */
export const ReducerMultiply: Reducer.Reducer<Int> = Reducer.make<Int>(
    multiply,
    one,
    multiplyAll
);

/**
 * A `Combiner` that keeps the larger `Int`.
 *
 * @category Instances
 * @since 1.0.0
 */
export const CombinerMax: Combiner.Combiner<Int> = Combiner.max(Order);

/**
 * A `Combiner` that keeps the smaller `Int`.
 *
 * @category Instances
 * @since 1.0.0
 */
export const CombinerMin: Combiner.Combiner<Int> = Combiner.min(Order);
