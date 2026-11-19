/**
 * Unsigned safe integers as a branded `number`.
 *
 * A `UInt` is an `Int` that is at least zero, so it is accepted wherever an
 * `Int` is. Constructors round non-integral input down with `Math.floor`.
 * Operations that can go below zero (`subtract`, `decrement`) return `Option`,
 * with throwing `Unsafe` counterparts; operations that would leave the safe
 * range throw a `RangeError`, as they do for `Int`.
 *
 * @module @bedform/effect/UInt
 *
 * @file      UInt.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Brand from "./Brand.js";
import * as Combiner from "./Combiner.js";
import * as Equ from "./Equivalence.js";
import * as Function from "./Function.js";
import * as Int from "./Int.js";
import * as Option from "./Option.js";
import * as Ord from "./Order.js";
import * as Reducer from "./Reducer.js";
import * as Schema from "./Schema.js";

/**
 * A non-negative safe integer.
 *
 * @category Types
 * @since 1.0.0
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- `UInt` is the conventional name.
export type UInt = Int.Int & Brand.Brand<"UInt">;

/**
 * The schema for `UInt` values. Decoding rejects negative, non-integral and
 * unsafe numbers rather than flooring them.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const UInt = Int.Int.check(Schema.isGreaterThanOrEqualTo(0)).pipe(
    Schema.brand("UInt")
);

/** Brands a non-negative `Int`. */
const unsafeOf = (n: Int.Int): UInt => n as UInt;

/**
 * Brands the result of an operation, throwing when it is not a non-negative
 * safe integer.
 *
 * @throws { RangeError } When `n` is negative or not a safe integer.
 */
const checked = (n: number, operation: string): UInt =>
{
    if (!Number.isSafeInteger(n) || n < 0)
    {
        throw new RangeError(
            `UInt.${operation}: ${n} is not a non-negative safe integer`
        );
    }

    return (n + 0) as UInt;
};

/**
 * Checks whether a value is a `UInt`, that is a non-negative safe integer.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isUInt = (u: unknown): u is UInt => Int.isInt(u) && u >= 0;

/**
 * Narrows an `Int` to a `UInt`, or `Option.none()` when it is negative.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromInt = (n: Int.Int): Option.Option<UInt> =>
    n >= 0 ? Option.some(unsafeOf(n)) : Option.none();

/**
 * Rounds a number down with `Math.floor` and brands it. Returns
 * `Option.none()` for NaN, ±Infinity, negative results and results outside
 * the safe range.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (n: number): Option.Option<UInt> =>
    Option.flatMap(Int.make(n), fromInt);

/**
 * Rounds a number down with `Math.floor` and brands it.
 *
 * @throws { RangeError } For NaN, ±Infinity, negative results and results
 * outside the safe range.
 * @category Constructors
 * @since 1.0.0
 */
export const makeUnsafe = (n: number): UInt => checked(Math.floor(n), "makeUnsafe");

/**
 * The `UInt` zero.
 *
 * @category Constants
 * @since 1.0.0
 */
export const zero: UInt = unsafeOf(Int.zero);

/**
 * The `UInt` one.
 *
 * @category Constants
 * @since 1.0.0
 */
export const one: UInt = unsafeOf(Int.one);

/**
 * The largest `UInt`, `Number.MAX_SAFE_INTEGER`.
 *
 * @category Constants
 * @since 1.0.0
 */
export const maxValue: UInt = unsafeOf(Int.maxValue);

/**
 * Converts a `bigint` to a `UInt`, or `Option.none()` when it is negative or
 * lies outside the safe range.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigInt = (n: bigint): Option.Option<UInt> =>
    Option.flatMap(Int.fromBigInt(n), fromInt);

/**
 * Converts a `UInt` to the equal `bigint`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigInt = (n: UInt): bigint => BigInt(n);

/**
 * Parses a decimal integer string. Returns `Option.none()` for anything else,
 * including negative values and values outside the safe range.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromString = (s: string): Option.Option<UInt> =>
    Option.flatMap(Int.fromString(s), fromInt);

// Arithmetic

/**
 * Adds two `UInt`s.
 *
 * @throws { RangeError } When the sum leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const sum: {
    (that: UInt): (self: UInt) => UInt;
    (self: UInt, that: UInt): UInt;
} = Function.dual(2, (self: UInt, that: UInt): UInt => checked(self + that, "sum"));

/**
 * Subtracts the second `UInt` from the first, or `Option.none()` when the
 * result would be negative.
 *
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    (that: UInt): (self: UInt) => Option.Option<UInt>;
    (self: UInt, that: UInt): Option.Option<UInt>;
} = Function.dual(
    2,
    (self: UInt, that: UInt): Option.Option<UInt> =>
        self >= that ? Option.some(checked(self - that, "subtract")) : Option.none()
);

/**
 * Subtracts the second `UInt` from the first.
 *
 * @throws { RangeError } When the result would be negative.
 * @category Operation
 * @since 1.0.0
 */
export const subtractUnsafe: {
    (that: UInt): (self: UInt) => UInt;
    (self: UInt, that: UInt): UInt;
} = Function.dual(
    2,
    (self: UInt, that: UInt): UInt => checked(self - that, "subtractUnsafe")
);

/**
 * Multiplies two `UInt`s.
 *
 * @throws { RangeError } When the product leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    (that: UInt): (self: UInt) => UInt;
    (self: UInt, that: UInt): UInt;
} = Function.dual(
    2,
    (self: UInt, that: UInt): UInt => checked(self * that, "multiply")
);

/**
 * Divides with the quotient rounded down. Returns `Option.none()` when the
 * divisor is zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const divide: {
    (divisor: UInt): (self: UInt) => Option.Option<UInt>;
    (self: UInt, divisor: UInt): Option.Option<UInt>;
} = Function.dual(
    2,
    (self: UInt, divisor: UInt): Option.Option<UInt> =>
        Option.map(Int.divide(self, divisor), unsafeOf)
);

/**
 * Divides with the quotient rounded down.
 *
 * @throws { RangeError } When the divisor is zero.
 * @category Operation
 * @since 1.0.0
 */
export const divideUnsafe: {
    (divisor: UInt): (self: UInt) => UInt;
    (self: UInt, divisor: UInt): UInt;
} = Function.dual(
    2,
    (self: UInt, divisor: UInt): UInt => unsafeOf(Int.divideUnsafe(self, divisor))
);

/**
 * The remainder of division, like `%`. A zero divisor yields NaN, as `%` does.
 *
 * @category Operation
 * @since 1.0.0
 */
export const remainder: {
    (divisor: UInt): (self: UInt) => UInt;
    (self: UInt, divisor: UInt): UInt;
} = Function.dual(
    2,
    (self: UInt, divisor: UInt): UInt => unsafeOf(Int.remainder(self, divisor))
);

/**
 * Adds one.
 *
 * @throws { RangeError } When the result leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const increment = (n: UInt): UInt => checked(n + 1, "increment");

/**
 * Subtracts one, or `Option.none()` for zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const decrement = (n: UInt): Option.Option<UInt> =>
    n > 0 ? Option.some(unsafeOf(Int.decrement(n))) : Option.none();

/**
 * Subtracts one.
 *
 * @throws { RangeError } When the argument is zero.
 * @category Operation
 * @since 1.0.0
 */
export const decrementUnsafe = (n: UInt): UInt => checked(n - 1, "decrementUnsafe");

/**
 * The sign of a `UInt`: zero for zero, otherwise one.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sign = (n: UInt): 0 | 1 => (n > 0 ? 1 : 0);

/**
 * The greatest common divisor; `gcd(0, 0)` is zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const gcd: {
    (that: UInt): (self: UInt) => UInt;
    (self: UInt, that: UInt): UInt;
} = Function.dual(2, (self: UInt, that: UInt): UInt => unsafeOf(Int.gcd(self, that)));

/**
 * The least common multiple; zero when either argument is zero.
 *
 * @throws { RangeError } When the result leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const lcm: {
    (that: UInt): (self: UInt) => UInt;
    (self: UInt, that: UInt): UInt;
} = Function.dual(2, (self: UInt, that: UInt): UInt => unsafeOf(Int.lcm(self, that)));

/**
 * The floor of the square root, which always exists for a `UInt`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const sqrt = (n: UInt): UInt => unsafeOf(Int.sqrtUnsafe(n));

/**
 * Adds every `UInt` in a collection; an empty collection sums to zero.
 *
 * @throws { RangeError } When a partial sum leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const sumAll = (collection: Iterable<UInt>): UInt =>
    unsafeOf(Int.sumAll(collection));

/**
 * Multiplies every `UInt` in a collection; an empty collection multiplies to
 * one. A zero anywhere short-circuits to zero.
 *
 * @throws { RangeError } When a partial product leaves the safe range.
 * @category Operation
 * @since 1.0.0
 */
export const multiplyAll = (collection: Iterable<UInt>): UInt =>
    unsafeOf(Int.multiplyAll(collection));

// Equality and order

/**
 * The `Order` instance for `UInt`s.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<UInt> = Int.Order;

/**
 * The `Equivalence` instance for `UInt`s.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<UInt> = Int.Equivalence;

/**
 * Checks whether the first `UInt` is less than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan = Ord.isLessThan(Order);

/**
 * Checks whether the first `UInt` is less than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo = Ord.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first `UInt` is greater than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan = Ord.isGreaterThan(Order);

/**
 * Checks whether the first `UInt` is greater than or equal to the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo = Ord.isGreaterThanOrEqualTo(Order);

/**
 * Checks whether a `UInt` lies in the inclusive range between `minimum` and
 * `maximum`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const between = Ord.isBetween(Order);

/**
 * Restricts a `UInt` to the inclusive range between `minimum` and `maximum`.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp = Ord.clamp(Order);

/**
 * Returns the smaller of two `UInt`s.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min = Ord.min(Order);

/**
 * Returns the larger of two `UInt`s.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max = Ord.max(Order);

// Reducers and combiners

/**
 * A `Reducer` that sums `UInt`s, starting from zero.
 *
 * @category Instances
 * @since 1.0.0
 */
export const ReducerSum: Reducer.Reducer<UInt> = Reducer.make<UInt>(sum, zero);

/**
 * A `Reducer` that multiplies `UInt`s, starting from one.
 *
 * @category Instances
 * @since 1.0.0
 */
export const ReducerMultiply: Reducer.Reducer<UInt> = Reducer.make<UInt>(
    multiply,
    one,
    multiplyAll
);

/**
 * A `Combiner` that keeps the larger `UInt`.
 *
 * @category Instances
 * @since 1.0.0
 */
export const CombinerMax: Combiner.Combiner<UInt> = Combiner.max(Order);

/**
 * A `Combiner` that keeps the smaller `UInt`.
 *
 * @category Instances
 * @since 1.0.0
 */
export const CombinerMin: Combiner.Combiner<UInt> = Combiner.min(Order);
