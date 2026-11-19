/**
 * Decimal numbers and arithmetic for cases where JavaScript `number` rounding
 * is not precise enough. A `BigDecimal` stores digits as a `bigint` plus a
 * decimal scale, which lets the module parse, compare, add, subtract, multiply,
 * divide, round, and format decimal values such as money, quantities, and
 * measurements.
 *
 * @module @bedform/effect/BigDecimal
 *
 * @file      BigDecimal.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, prefer-rest-params, @stylistic/max-len */

import * as Equal from "./Equal.js";
import * as Equ from "./Equivalence.js";
import { dual } from "./Function.js";
import * as Hash from "./Hash.js";
import { type Inspectable, NodeInspectSymbol } from "./Inspectable.js";
import * as Option from "./Option.js";
import * as order from "./Order.js";
import type { Ordering } from "./Ordering.js";
import { type Pipeable, pipeArguments } from "./Pipeable.js";
import { hasProperty } from "./Predicate.js";

const DefaultPrecision = 100;
const FiniteIntRegexp = /^[+-]?\d+$/;

const TypeId = "~effect/BigDecimal";

/**
 * Represents an arbitrary precision decimal number.
 *
 * **When to use**
 *
 * Use when decimal arithmetic needs to avoid JavaScript floating point
 * representation errors.
 *
 * **Example** (Inspecting BigDecimal storage)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const d = BigDecimal.fromStringUnsafe("123.45")
 *
 * d.value // => 12345n
 * d.scale // => 2
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface BigDecimal extends Equal.Equal, Pipeable, Inspectable
{
    readonly [TypeId]: typeof TypeId
    readonly value: bigint
    readonly scale: number

    /**
     * Pure helper from the pinned Effect implementation.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    normalized?: BigDecimal
}

const BigDecimalProto: Omit<BigDecimal, "value" | "scale" | "normalized"> = {
    [TypeId]: TypeId,
    [Hash.symbol](this: BigDecimal): number
    {
        const Normalized = normalize(this);
        return Hash.combine(Hash.string(String(Normalized.value)), Hash.number(Normalized.scale));
    },
    [Equal.symbol](this: BigDecimal, that: unknown): boolean
    {
        return isBigDecimal(that) && Compare(this, that) === 0;
    },
    toString(this: BigDecimal)
    {
        return `BigDecimal(${format(this)})`;
    },
    toJSON(this: BigDecimal)
    {
        return {
            _id: "BigDecimal",
            value: String(this.value),
            scale: this.scale
        };
    },
    [NodeInspectSymbol](this: BigDecimal)
    {
        return this.toJSON();
    },
    pipe()
    {
        return pipeArguments(this, arguments);
    }
} as const;

/**
 * Checks whether a given value is a `BigDecimal`.
 *
 * **When to use**
 *
 * Use to validate unknown input and narrow it to `BigDecimal`.
 *
 * **Example** (Checking BigDecimal values)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const decimal = BigDecimal.fromNumber(123.45)
 * BigDecimal.isBigDecimal(decimal) // => false
 * BigDecimal.isBigDecimal(BigDecimal.fromStringUnsafe("123.45")) // => true
 * BigDecimal.isBigDecimal(123.45) // => false
 * BigDecimal.isBigDecimal("123.45") // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isBigDecimal = (u: unknown): u is BigDecimal => hasProperty(u, TypeId);

/**
 * Creates a `BigDecimal` from a `bigint` value and a safe integer scale.
 *
 * **When to use**
 *
 * Use to construct a decimal directly from its unscaled integer value and
 * decimal scale.
 *
 * **Gotchas**
 *
 * Throws a `RangeError` if `scale` is not a safe integer.
 *
 * **Example** (Creating decimals from bigint and scale)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * // Create 123.45 (12345 with scale 2)
 * const decimal = BigDecimal.make(12345n, 2)
 * decimal // => BigDecimal.fromStringUnsafe("123.45")
 *
 * // Create 42 (42 with scale 0)
 * const integer = BigDecimal.make(42n, 0)
 * integer // => BigDecimal.fromBigInt(42n)
 * ```
 *
 * @see {@link fromBigInt} for constructing an integer decimal from a `bigint`
 *
 * @throws { RangeError } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const make = (value: bigint, scale: number): BigDecimal =>
{
    if (!Number.isSafeInteger(scale))
    {
        throw new RangeError(`Scale must be a safe integer, got ${scale}`);
    }

    const O = Object.create(BigDecimalProto);
    O.value = value;
    O.scale = scale;
    return O;
};

const MakeNormalized = (value: bigint, scale: number): BigDecimal =>
{
    const OValue = make(value, scale);
    OValue.normalized = OValue;
    return OValue;
};

/**
 * Internal function used to create pre-normalized `BigDecimal`s.
 *
 * @internal
 *
 * @throws { RangeError } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeNormalizedUnsafe = (value: bigint, scale: number): BigDecimal =>
{
    if (value !== Bigint0 && value % Bigint10 === Bigint0)
    {
        throw new RangeError("Value must be normalized");
    }

    return MakeNormalized(value, scale);
};

const Bigint0 = BigInt(0);
const Bigint1 = BigInt(1);
const Bigint_1 = BigInt(-1);
const Bigint2 = BigInt(2);
const Bigint5 = BigInt(5);
const Bigint_5 = BigInt(-5);
const Bigint10 = BigInt(10);
const Zero = MakeNormalized(Bigint0, 0);
const One = makeNormalizedUnsafe(Bigint1, 0);

/**
 * Normalizes a given `BigDecimal` by removing trailing zeros.
 *
 * **When to use**
 *
 * Use to canonicalize decimals that have equivalent values but different
 * internal scales.
 *
 * **Example** (Normalizing trailing zeros)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const decimal = BigDecimal.normalize(BigDecimal.fromStringUnsafe("123.00000"))
 * const decimalStorage = [decimal.value, decimal.scale] // => [123n, 0]
 *
 * const largeDecimal = BigDecimal.normalize(BigDecimal.fromStringUnsafe("12300000"))
 * const largeDecimalStorage = [largeDecimal.value, largeDecimal.scale] // => [123n, -5]
 * ```
 *
 * @see {@link format} for rendering normalized decimals as strings
 *
 * @category Utilities
 * @since 1.0.0
 */
export const normalize = (self: BigDecimal): BigDecimal =>
{
    if (self.normalized === undefined)
    {
        if (self.value === Bigint0)
        {
            self.normalized = Zero;
        }
        else
        {
            const Digits = `${self.value}`;
            let end = Digits.length;
            while (Digits[end - 1] === "0") {end--;}

            self.normalized = MakeNormalized(BigInt(Digits.slice(0, end)), self.scale - (Digits.length - end));
        }
    }

    return self.normalized;
};

/**
 * Changes a `BigDecimal` to the specified scale.
 *
 * **When to use**
 *
 * Use to change how many decimal places are represented by a `BigDecimal`.
 *
 * **Details**
 *
 * Increasing the scale appends decimal zeros. Decreasing the scale discards
 * digits beyond the target scale by `bigint` division, which truncates toward
 * zero.
 *
 * **Example** (Scaling decimal precision)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const decimal = BigDecimal.fromNumberUnsafe(123.45)
 *
 * // Increase scale (add more precision)
 * const scaled = BigDecimal.scale(decimal, 4)
 * const scaledStorage = [scaled.value, scaled.scale] // => [1234500n, 4]
 *
 * // Decrease scale (reduce precision, truncating toward zero)
 * const reduced = BigDecimal.scale(decimal, 1)
 * reduced // => BigDecimal.fromStringUnsafe("123.4")
 * ```
 *
 * @see {@link round} for changing scale with configurable rounding
 *
 * @category Utilities
 * @since 1.0.0
 */
export const scale: {
    /**
     * Changes a `BigDecimal` to the specified scale.
     *
     * **When to use**
     *
     * Use to change how many decimal places are represented by a `BigDecimal`.
     *
     * **Details**
     *
     * Increasing the scale appends decimal zeros. Decreasing the scale discards
     * digits beyond the target scale by `bigint` division, which truncates toward
     * zero.
     *
     * **Example** (Scaling decimal precision)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const decimal = BigDecimal.fromNumberUnsafe(123.45)
     *
     * // Increase scale (add more precision)
     * const scaled = BigDecimal.scale(decimal, 4)
     * const scaledStorage = [scaled.value, scaled.scale] // => [1234500n, 4]
     *
     * // Decrease scale (reduce precision, truncating toward zero)
     * const reduced = BigDecimal.scale(decimal, 1)
     * reduced // => BigDecimal.fromStringUnsafe("123.4")
     * ```
     *
     * @see {@link round} for changing scale with configurable rounding
     *
     * @category Utilities
     * @since 1.0.0
     */
    (scale: number): (self: BigDecimal) => BigDecimal

    /**
     * Changes a `BigDecimal` to the specified scale.
     *
     * **When to use**
     *
     * Use to change how many decimal places are represented by a `BigDecimal`.
     *
     * **Details**
     *
     * Increasing the scale appends decimal zeros. Decreasing the scale discards
     * digits beyond the target scale by `bigint` division, which truncates toward
     * zero.
     *
     * **Example** (Scaling decimal precision)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const decimal = BigDecimal.fromNumberUnsafe(123.45)
     *
     * // Increase scale (add more precision)
     * const scaled = BigDecimal.scale(decimal, 4)
     * const scaledStorage = [scaled.value, scaled.scale] // => [1234500n, 4]
     *
     * // Decrease scale (reduce precision, truncating toward zero)
     * const reduced = BigDecimal.scale(decimal, 1)
     * reduced // => BigDecimal.fromStringUnsafe("123.4")
     * ```
     *
     * @see {@link round} for changing scale with configurable rounding
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, scale: number): BigDecimal
} = dual(2, (self: BigDecimal, scale: number): BigDecimal =>
{
    if (scale > self.scale)
    {
        return make(self.value * Bigint10 ** BigInt(scale - self.scale), scale);
    }

    if (scale < self.scale)
    {
        return make(self.value / Bigint10 ** BigInt(self.scale - scale), scale);
    }

    return self;
});

/**
 * Provides an addition operation on `BigDecimal`s.
 *
 * **When to use**
 *
 * Use when you need a decimal addition function for piping or higher-order APIs
 * while preserving decimal precision.
 *
 * **Example** (Adding decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.sum(
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3")
 * ) // => BigDecimal.fromBigInt(5n)
 * ```
 *
 * @see {@link sumAll} for summing an iterable of `BigDecimal` values
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sum: {
    /**
     * Provides an addition operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use when you need a decimal addition function for piping or higher-order APIs
     * while preserving decimal precision.
     *
     * **Example** (Adding decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.sum(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(5n)
     * ```
     *
     * @see {@link sumAll} for summing an iterable of `BigDecimal` values
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Provides an addition operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use when you need a decimal addition function for piping or higher-order APIs
     * while preserving decimal precision.
     *
     * **Example** (Adding decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.sum(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(5n)
     * ```
     *
     * @see {@link sumAll} for summing an iterable of `BigDecimal` values
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = dual(2, (self: BigDecimal, that: BigDecimal): BigDecimal =>
{
    if (that.value === Bigint0)
    {
        return self;
    }

    if (self.value === Bigint0)
    {
        return that;
    }

    if (self.scale > that.scale)
    {
        return make(scale(that, self.scale).value + self.value, self.scale);
    }

    if (self.scale < that.scale)
    {
        return make(scale(self, that.scale).value + that.value, that.scale);
    }

    return make(self.value + that.value, self.scale);
});

/**
 * Takes an `Iterable` of `BigDecimal`s and returns their sum as a single `BigDecimal`.
 *
 * **When to use**
 *
 * Use when you need to aggregate decimal quantities with decimal precision
 * instead of converting through JavaScript numbers.
 *
 * **Example** (Adding multiple decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.sumAll([
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3"),
 *   BigDecimal.fromStringUnsafe("4")
 * ]) // => BigDecimal.fromBigInt(9n)
 * ```
 *
 * @see {@link sum} for adding two `BigDecimal` values
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sumAll = (collection: Iterable<BigDecimal>): BigDecimal =>
{
    let out: BigDecimal = Zero;
    for (const N of collection)
    {
        out = sum(out, N);
    }

    return out;
};

/**
 * Provides a multiplication operation on `BigDecimal`s.
 *
 * **When to use**
 *
 * Use to multiply two `BigDecimal` values.
 *
 * **Example** (Multiplying decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.multiply(
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3")
 * ) // => BigDecimal.fromBigInt(6n)
 * ```
 *
 * @see {@link multiplyAll} for multiplying an iterable of `BigDecimal` values
 *
 * @category Utilities
 * @since 1.0.0
 */
export const multiply: {
    /**
     * Provides a multiplication operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to multiply two `BigDecimal` values.
     *
     * **Example** (Multiplying decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.multiply(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(6n)
     * ```
     *
     * @see {@link multiplyAll} for multiplying an iterable of `BigDecimal` values
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Provides a multiplication operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to multiply two `BigDecimal` values.
     *
     * **Example** (Multiplying decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.multiply(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(6n)
     * ```
     *
     * @see {@link multiplyAll} for multiplying an iterable of `BigDecimal` values
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = dual(2, (self: BigDecimal, that: BigDecimal): BigDecimal =>
{
    if (that.value === Bigint0 || self.value === Bigint0)
    {
        return Zero;
    }

    return make(self.value * that.value, self.scale + that.scale);
});

/**
 * Takes an `Iterable` of `BigDecimal`s and returns their multiplication as a single `BigDecimal`.
 *
 * **When to use**
 *
 * Use to multiply all `BigDecimal` values in an iterable.
 *
 * **Example** (Multiplying multiple decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.multiplyAll([
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3"),
 *   BigDecimal.fromStringUnsafe("4")
 * ]) // => BigDecimal.fromBigInt(24n)
 * ```
 *
 * @see {@link multiply} for multiplying two `BigDecimal` values
 *
 * @category Utilities
 * @since 1.0.0
 */
export const multiplyAll = (collection: Iterable<BigDecimal>): BigDecimal =>
{
    let out: BigDecimal = One;
    for (const NValue of collection)
    {
        if (NValue.value === Bigint0)
        {
            return Zero;
        }

        out = multiply(out, NValue);
    }

    return out;
};

/**
 * Provides a subtraction operation on `BigDecimal`s.
 *
 * **When to use**
 *
 * Use to subtract one `BigDecimal` value from another.
 *
 * **Example** (Subtracting decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.subtract(
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3")
 * ) // => BigDecimal.fromBigInt(-1n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const subtract: {
    /**
     * Provides a subtraction operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to subtract one `BigDecimal` value from another.
     *
     * **Example** (Subtracting decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.subtract(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(-1n)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Provides a subtraction operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to subtract one `BigDecimal` value from another.
     *
     * **Example** (Subtracting decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.subtract(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(-1n)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = dual(2, (self: BigDecimal, that: BigDecimal): BigDecimal =>
{
    if (that.value === Bigint0)
    {
        return self;
    }

    if (self.value === Bigint0)
    {
        return make(-that.value, that.scale);
    }

    if (self.scale > that.scale)
    {
        return make(self.value - scale(that, self.scale).value, self.scale);
    }

    if (self.scale < that.scale)
    {
        return make(scale(self, that.scale).value - that.value, that.scale);
    }

    return make(self.value - that.value, self.scale);
});

/**
 * Internal function used for arbitrary precision division.
 *
 * @category Utilities
 * @since 1.0.0
 */
const DivideWithPrecision = (
    num: bigint,
    den: bigint,
    scale: number,
    precision: number
): BigDecimal =>
{
    const NumNegative = num < Bigint0;
    const DenNegative = den < Bigint0;
    const NegateResult = NumNegative !== DenNegative;

    num = NumNegative ? -num : num;
    den = DenNegative ? -den : den;

    // Shift digits until numerator is larger than denominator (set scale appropriately).
    while (num < den)
    {
        num *= Bigint10;
        scale++;
    }

    // First division.
    let quotient = num / den;
    let remainder = num % den;

    if (remainder === Bigint0)
    {
    // No remainder, return immediately.
        return make(NegateResult ? -quotient : quotient, scale);
    }

    // The quotient is guaranteed to be non-negative at this point. No need to consider sign.
    let count = `${quotient}`.length;

    // Shift the remainder by 1 decimal; The quotient will be 1 digit upon next division.
    remainder *= Bigint10;
    while (remainder !== Bigint0 && count < precision)
    {
        const Q = remainder / den;
        const R = remainder % den;
        quotient = quotient * Bigint10 + Q;
        remainder = R * Bigint10;

        count++;
        scale++;
    }

    if (remainder !== Bigint0)
    {
    // Round final number with remainder.
        quotient += roundTerminal(remainder / den);
    }

    return make(NegateResult ? -quotient : quotient, scale);
};

/**
 * Internal function used for rounding.
 *
 * Returns 1 if the most significant digit is >= 5, otherwise 0.
 *
 * This is used after dividing a number by a power of ten and rounding the last digit.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const roundTerminal = (n: bigint): bigint =>
{
    const Pos = n >= Bigint0 ? 0 : 1;
    return Number(`${n}`[Pos]) < 5 ? Bigint0 : Bigint1;
};

/**
 * Divides `BigDecimal`s safely.
 *
 * **When to use**
 *
 * Use to divide `BigDecimal` values while representing division by zero as
 * `Option.none`.
 *
 * **Details**
 *
 * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
 * with up to the default division precision. If the divisor is `0`, the result
 * will be `Option.none()`.
 *
 * **Example** (Dividing decimals safely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal, Option } from "effect"
 *
 * const six = BigDecimal.fromBigInt(6n)
 *
 * BigDecimal.divide(six, BigDecimal.fromBigInt(3n)) // => Option.some(BigDecimal.fromBigInt(2n))
 * BigDecimal.divide(six, BigDecimal.fromBigInt(4n)) // => Option.some(BigDecimal.fromStringUnsafe("1.5"))
 * BigDecimal.divide(six, BigDecimal.fromBigInt(0n)) // => Option.none()
 * ```
 *
 * @see {@link divideUnsafe} for division that throws when the divisor is zero
 * @see {@link remainder} for the decimal remainder operation
 *
 * @category Utilities
 * @since 1.0.0
 */
export const divide: {
    /**
     * Divides `BigDecimal`s safely.
     *
     * **When to use**
     *
     * Use to divide `BigDecimal` values while representing division by zero as
     * `Option.none`.
     *
     * **Details**
     *
     * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
     * with up to the default division precision. If the divisor is `0`, the result
     * will be `Option.none()`.
     *
     * **Example** (Dividing decimals safely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal, Option } from "effect"
     *
     * const six = BigDecimal.fromBigInt(6n)
     *
     * BigDecimal.divide(six, BigDecimal.fromBigInt(3n)) // => Option.some(BigDecimal.fromBigInt(2n))
     * BigDecimal.divide(six, BigDecimal.fromBigInt(4n)) // => Option.some(BigDecimal.fromStringUnsafe("1.5"))
     * BigDecimal.divide(six, BigDecimal.fromBigInt(0n)) // => Option.none()
     * ```
     *
     * @see {@link divideUnsafe} for division that throws when the divisor is zero
     * @see {@link remainder} for the decimal remainder operation
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => Option.Option<BigDecimal>

    /**
     * Divides `BigDecimal`s safely.
     *
     * **When to use**
     *
     * Use to divide `BigDecimal` values while representing division by zero as
     * `Option.none`.
     *
     * **Details**
     *
     * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
     * with up to the default division precision. If the divisor is `0`, the result
     * will be `Option.none()`.
     *
     * **Example** (Dividing decimals safely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal, Option } from "effect"
     *
     * const six = BigDecimal.fromBigInt(6n)
     *
     * BigDecimal.divide(six, BigDecimal.fromBigInt(3n)) // => Option.some(BigDecimal.fromBigInt(2n))
     * BigDecimal.divide(six, BigDecimal.fromBigInt(4n)) // => Option.some(BigDecimal.fromStringUnsafe("1.5"))
     * BigDecimal.divide(six, BigDecimal.fromBigInt(0n)) // => Option.none()
     * ```
     *
     * @see {@link divideUnsafe} for division that throws when the divisor is zero
     * @see {@link remainder} for the decimal remainder operation
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): Option.Option<BigDecimal>
} = dual(2, (self: BigDecimal, that: BigDecimal): Option.Option<BigDecimal> =>
{
    if (that.value === Bigint0)
    {
        return Option.none();
    }

    if (self.value === Bigint0)
    {
        return Option.some(Zero);
    }

    const ScaleValue = self.scale - that.scale;
    if (self.value === that.value)
    {
        return Option.some(make(Bigint1, ScaleValue));
    }

    return Option.some(DivideWithPrecision(self.value, that.value, ScaleValue, DefaultPrecision));
});

/**
 * Provides an unsafe division operation on `BigDecimal`s.
 *
 * **When to use**
 *
 * Use when you need to divide `BigDecimal` values where the divisor is known
 * to be non-zero, so division by zero should be a thrown exception.
 *
 * **Details**
 *
 * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
 * with up to the default division precision.
 *
 * **Gotchas**
 *
 * Throws a `RangeError` if the divisor is `0`.
 *
 * **Example** (Dividing decimals unsafely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(2n)
 * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("4")) // => BigDecimal.fromStringUnsafe("1.5")
 * ```
 *
 * @see {@link divide} for division that returns `Option.none` when the divisor is zero
 *
 * @category Utilities
 * @since 1.0.0
 */
export const divideUnsafe: {
    /**
     * Provides an unsafe division operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use when you need to divide `BigDecimal` values where the divisor is known
     * to be non-zero, so division by zero should be a thrown exception.
     *
     * **Details**
     *
     * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
     * with up to the default division precision.
     *
     * **Gotchas**
     *
     * Throws a `RangeError` if the divisor is `0`.
     *
     * **Example** (Dividing decimals unsafely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(2n)
     * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("4")) // => BigDecimal.fromStringUnsafe("1.5")
     * ```
     *
     * @see {@link divide} for division that returns `Option.none` when the divisor is zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Provides an unsafe division operation on `BigDecimal`s.
     *
     * **When to use**
     *
     * Use when you need to divide `BigDecimal` values where the divisor is known
     * to be non-zero, so division by zero should be a thrown exception.
     *
     * **Details**
     *
     * If the dividend is not a multiple of the divisor, the result will be a `BigDecimal` value
     * with up to the default division precision.
     *
     * **Gotchas**
     *
     * Throws a `RangeError` if the divisor is `0`.
     *
     * **Example** (Dividing decimals unsafely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(2n)
     * BigDecimal.divideUnsafe(BigDecimal.fromStringUnsafe("6"), BigDecimal.fromStringUnsafe("4")) // => BigDecimal.fromStringUnsafe("1.5")
     * ```
     *
     * @see {@link divide} for division that returns `Option.none` when the divisor is zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = dual(2, (self: BigDecimal, that: BigDecimal): BigDecimal =>
{
    if (that.value === Bigint0)
    {
        throw new RangeError("Division by zero");
    }

    if (self.value === Bigint0)
    {
        return Zero;
    }

    const ScaleValueValue = self.scale - that.scale;
    if (self.value === that.value)
    {
        return make(Bigint1, ScaleValueValue);
    }

    return DivideWithPrecision(self.value, that.value, ScaleValueValue, DefaultPrecision);
});

const MaxComparisonScaleAlignment = 100;
const ComparisonPowersOfTen: Array<bigint | undefined> = [ Bigint1 ];

const CompareBigInt = (self: bigint, that: bigint): Ordering => self === that ? 0 : self < that ? -1 : 1;

const CompareMagnitude = (self: BigDecimal, that: BigDecimal): Ordering =>
{
    const SelfDigits = `${self.value < Bigint0 ? -self.value : self.value}`;
    const ThatDigits = `${that.value < Bigint0 ? -that.value : that.value}`;
    const ExponentDifference = BigInt(SelfDigits.length - ThatDigits.length) - BigInt(self.scale) + BigInt(that.scale);
    if (ExponentDifference !== Bigint0) {return ExponentDifference < Bigint0 ? -1 : 1;}

    const Length = Math.max(SelfDigits.length, ThatDigits.length);
    return order.String(SelfDigits.padEnd(Length, "0"), ThatDigits.padEnd(Length, "0"));
};

const Compare = (self: BigDecimal, that: BigDecimal): Ordering =>
{
    if (self.scale === that.scale) {return CompareBigInt(self.value, that.value);}

    const SelfSign = sign(self);
    const ThatSign = sign(that);
    if (SelfSign !== ThatSign) {return SelfSign < ThatSign ? -1 : 1;}

    if (SelfSign === 0) {return 0;}

    const ScaleDifference = self.scale - that.scale;
    const AbsoluteScaleDifference = Math.abs(ScaleDifference);
    if (AbsoluteScaleDifference > MaxComparisonScaleAlignment)
    {
        return SelfSign === -1 ? CompareMagnitude(that, self) : CompareMagnitude(self, that);
    }

    const PowerOfTen = ComparisonPowersOfTen[AbsoluteScaleDifference] ??= Bigint10 ** BigInt(AbsoluteScaleDifference);
    return ScaleDifference > 0
        ? CompareBigInt(self.value, that.value * PowerOfTen)
        : CompareBigInt(self.value * PowerOfTen, that.value);
};

/**
 * Provides an `Order` instance for `BigDecimal` that allows comparing and sorting BigDecimal values.
 *
 * **When to use**
 *
 * Use when you need to sort or compare decimal values through APIs that accept
 * an ordering instance.
 *
 * **Example** (Comparing decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const a = BigDecimal.fromNumberUnsafe(1.5)
 * const b = BigDecimal.fromNumberUnsafe(2.3)
 * const c = BigDecimal.fromNumberUnsafe(1.5)
 *
 * BigDecimal.Order(a, b) // => -1
 * BigDecimal.Order(b, a) // => 1
 * BigDecimal.Order(a, c) // => 0
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Order: order.Order<BigDecimal> = order.make(Compare);

/**
 * Returns `true` if the first argument is less than the second, otherwise `false`.
 *
 * **When to use**
 *
 * Use to test whether one `BigDecimal` is strictly less than another.
 *
 * **Example** (Checking less-than comparisons)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const two = BigDecimal.fromStringUnsafe("2")
 * const three = BigDecimal.fromStringUnsafe("3")
 * const four = BigDecimal.fromStringUnsafe("4")
 *
 * BigDecimal.isLessThan(two, three) // => true
 * BigDecimal.isLessThan(three, three) // => false
 * BigDecimal.isLessThan(four, three) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThan: {
    /**
     * Returns `true` if the first argument is less than the second, otherwise `false`.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is strictly less than another.
     *
     * **Example** (Checking less-than comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isLessThan(two, three) // => true
     * BigDecimal.isLessThan(three, three) // => false
     * BigDecimal.isLessThan(four, three) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => boolean

    /**
     * Returns `true` if the first argument is less than the second, otherwise `false`.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is strictly less than another.
     *
     * **Example** (Checking less-than comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isLessThan(two, three) // => true
     * BigDecimal.isLessThan(three, three) // => false
     * BigDecimal.isLessThan(four, three) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): boolean
} = order.isLessThan(Order);

/**
 * Checks whether a given `BigDecimal` is less than or equal to the provided one.
 *
 * **When to use**
 *
 * Use to test whether one `BigDecimal` is less than or equal to another.
 *
 * **Example** (Checking less-than-or-equal comparisons)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const two = BigDecimal.fromStringUnsafe("2")
 * const three = BigDecimal.fromStringUnsafe("3")
 * const four = BigDecimal.fromStringUnsafe("4")
 *
 * BigDecimal.isLessThanOrEqualTo(two, three) // => true
 * BigDecimal.isLessThanOrEqualTo(three, three) // => true
 * BigDecimal.isLessThanOrEqualTo(four, three) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThanOrEqualTo: {
    /**
     * Checks whether a given `BigDecimal` is less than or equal to the provided one.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is less than or equal to another.
     *
     * **Example** (Checking less-than-or-equal comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isLessThanOrEqualTo(two, three) // => true
     * BigDecimal.isLessThanOrEqualTo(three, three) // => true
     * BigDecimal.isLessThanOrEqualTo(four, three) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => boolean

    /**
     * Checks whether a given `BigDecimal` is less than or equal to the provided one.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is less than or equal to another.
     *
     * **Example** (Checking less-than-or-equal comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isLessThanOrEqualTo(two, three) // => true
     * BigDecimal.isLessThanOrEqualTo(three, three) // => true
     * BigDecimal.isLessThanOrEqualTo(four, three) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): boolean
} = order.isLessThanOrEqualTo(Order);

/**
 * Returns `true` if the first argument is greater than the second, otherwise `false`.
 *
 * **When to use**
 *
 * Use to test whether one `BigDecimal` is strictly greater than another.
 *
 * **Example** (Checking greater-than comparisons)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const two = BigDecimal.fromStringUnsafe("2")
 * const three = BigDecimal.fromStringUnsafe("3")
 * const four = BigDecimal.fromStringUnsafe("4")
 *
 * BigDecimal.isGreaterThan(two, three) // => false
 * BigDecimal.isGreaterThan(three, three) // => false
 * BigDecimal.isGreaterThan(four, three) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThan: {
    /**
     * Returns `true` if the first argument is greater than the second, otherwise `false`.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is strictly greater than another.
     *
     * **Example** (Checking greater-than comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isGreaterThan(two, three) // => false
     * BigDecimal.isGreaterThan(three, three) // => false
     * BigDecimal.isGreaterThan(four, three) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => boolean

    /**
     * Returns `true` if the first argument is greater than the second, otherwise `false`.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is strictly greater than another.
     *
     * **Example** (Checking greater-than comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isGreaterThan(two, three) // => false
     * BigDecimal.isGreaterThan(three, three) // => false
     * BigDecimal.isGreaterThan(four, three) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): boolean
} = order.isGreaterThan(Order);

/**
 * Checks whether a given `BigDecimal` is greater than or equal to the provided one.
 *
 * **When to use**
 *
 * Use to test whether one `BigDecimal` is greater than or equal to another.
 *
 * **Example** (Checking greater-than-or-equal comparisons)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const two = BigDecimal.fromStringUnsafe("2")
 * const three = BigDecimal.fromStringUnsafe("3")
 * const four = BigDecimal.fromStringUnsafe("4")
 *
 * BigDecimal.isGreaterThanOrEqualTo(two, three) // => false
 * BigDecimal.isGreaterThanOrEqualTo(three, three) // => true
 * BigDecimal.isGreaterThanOrEqualTo(four, three) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo: {
    /**
     * Checks whether a given `BigDecimal` is greater than or equal to the provided one.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is greater than or equal to another.
     *
     * **Example** (Checking greater-than-or-equal comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isGreaterThanOrEqualTo(two, three) // => false
     * BigDecimal.isGreaterThanOrEqualTo(three, three) // => true
     * BigDecimal.isGreaterThanOrEqualTo(four, three) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => boolean

    /**
     * Checks whether a given `BigDecimal` is greater than or equal to the provided one.
     *
     * **When to use**
     *
     * Use to test whether one `BigDecimal` is greater than or equal to another.
     *
     * **Example** (Checking greater-than-or-equal comparisons)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const four = BigDecimal.fromStringUnsafe("4")
     *
     * BigDecimal.isGreaterThanOrEqualTo(two, three) // => false
     * BigDecimal.isGreaterThanOrEqualTo(three, three) // => true
     * BigDecimal.isGreaterThanOrEqualTo(four, three) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): boolean
} = order.isGreaterThanOrEqualTo(Order);

/**
 * Checks whether a `BigDecimal` is between a `minimum` and `maximum` value (inclusive).
 *
 * **When to use**
 *
 * Use to test whether a `BigDecimal` falls inside an inclusive range.
 *
 * **Example** (Checking decimal ranges)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const between = BigDecimal.between({
 *   minimum: BigDecimal.fromStringUnsafe("1"),
 *   maximum: BigDecimal.fromStringUnsafe("5")
 * })
 *
 * between(BigDecimal.fromStringUnsafe("3")) // => true
 * between(BigDecimal.fromStringUnsafe("0")) // => false
 * between(BigDecimal.fromStringUnsafe("6")) // => false
 * ```
 *
 * @see {@link clamp} for forcing a `BigDecimal` into an inclusive range
 *
 * @category Utilities
 * @since 1.0.0
 */
export const between: {
    /**
     * Checks whether a `BigDecimal` is between a `minimum` and `maximum` value (inclusive).
     *
     * **When to use**
     *
     * Use to test whether a `BigDecimal` falls inside an inclusive range.
     *
     * **Example** (Checking decimal ranges)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const between = BigDecimal.between({
     *   minimum: BigDecimal.fromStringUnsafe("1"),
     *   maximum: BigDecimal.fromStringUnsafe("5")
     * })
     *
     * between(BigDecimal.fromStringUnsafe("3")) // => true
     * between(BigDecimal.fromStringUnsafe("0")) // => false
     * between(BigDecimal.fromStringUnsafe("6")) // => false
     * ```
     *
     * @see {@link clamp} for forcing a `BigDecimal` into an inclusive range
     *
     * @category Utilities
     * @since 1.0.0
     */
    (
        options: {
            minimum: BigDecimal
            maximum: BigDecimal
        }
    ): (self: BigDecimal) => boolean

    /**
     * Checks whether a `BigDecimal` is between a `minimum` and `maximum` value (inclusive).
     *
     * **When to use**
     *
     * Use to test whether a `BigDecimal` falls inside an inclusive range.
     *
     * **Example** (Checking decimal ranges)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const between = BigDecimal.between({
     *   minimum: BigDecimal.fromStringUnsafe("1"),
     *   maximum: BigDecimal.fromStringUnsafe("5")
     * })
     *
     * between(BigDecimal.fromStringUnsafe("3")) // => true
     * between(BigDecimal.fromStringUnsafe("0")) // => false
     * between(BigDecimal.fromStringUnsafe("6")) // => false
     * ```
     *
     * @see {@link clamp} for forcing a `BigDecimal` into an inclusive range
     *
     * @category Utilities
     * @since 1.0.0
     */
    (
        self: BigDecimal,
        options: {
            minimum: BigDecimal
            maximum: BigDecimal
        }
    ): boolean
} = order.isBetween(Order);

/**
 * Restricts the given `BigDecimal` to be within the range specified by the `minimum` and `maximum` values.
 *
 * **When to use**
 *
 * Use to force a `BigDecimal` into an inclusive range.
 *
 * **Details**
 *
 * If the `BigDecimal` is less than the `minimum` value, the function returns
 * the `minimum` value. If it is greater than the `maximum` value, the function
 * returns the `maximum` value. Otherwise, it returns the original `BigDecimal`.
 *
 * **Example** (Clamping decimals to a range)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const clamp = BigDecimal.clamp({
 *   minimum: BigDecimal.fromStringUnsafe("1"),
 *   maximum: BigDecimal.fromStringUnsafe("5")
 * })
 *
 * clamp(BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(3n)
 * clamp(BigDecimal.fromStringUnsafe("0")) // => BigDecimal.fromBigInt(1n)
 * clamp(BigDecimal.fromStringUnsafe("6")) // => BigDecimal.fromBigInt(5n)
 * ```
 *
 * @see {@link between} for checking whether a `BigDecimal` is already inside a range
 *
 * @category Utilities
 * @since 1.0.0
 */
export const clamp: {
    /**
     * Restricts the given `BigDecimal` to be within the range specified by the `minimum` and `maximum` values.
     *
     * **When to use**
     *
     * Use to force a `BigDecimal` into an inclusive range.
     *
     * **Details**
     *
     * If the `BigDecimal` is less than the `minimum` value, the function returns
     * the `minimum` value. If it is greater than the `maximum` value, the function
     * returns the `maximum` value. Otherwise, it returns the original `BigDecimal`.
     *
     * **Example** (Clamping decimals to a range)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const clamp = BigDecimal.clamp({
     *   minimum: BigDecimal.fromStringUnsafe("1"),
     *   maximum: BigDecimal.fromStringUnsafe("5")
     * })
     *
     * clamp(BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(3n)
     * clamp(BigDecimal.fromStringUnsafe("0")) // => BigDecimal.fromBigInt(1n)
     * clamp(BigDecimal.fromStringUnsafe("6")) // => BigDecimal.fromBigInt(5n)
     * ```
     *
     * @see {@link between} for checking whether a `BigDecimal` is already inside a range
     *
     * @category Utilities
     * @since 1.0.0
     */
    (
        options: {
            minimum: BigDecimal
            maximum: BigDecimal
        }
    ): (self: BigDecimal) => BigDecimal

    /**
     * Restricts the given `BigDecimal` to be within the range specified by the `minimum` and `maximum` values.
     *
     * **When to use**
     *
     * Use to force a `BigDecimal` into an inclusive range.
     *
     * **Details**
     *
     * If the `BigDecimal` is less than the `minimum` value, the function returns
     * the `minimum` value. If it is greater than the `maximum` value, the function
     * returns the `maximum` value. Otherwise, it returns the original `BigDecimal`.
     *
     * **Example** (Clamping decimals to a range)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const clamp = BigDecimal.clamp({
     *   minimum: BigDecimal.fromStringUnsafe("1"),
     *   maximum: BigDecimal.fromStringUnsafe("5")
     * })
     *
     * clamp(BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(3n)
     * clamp(BigDecimal.fromStringUnsafe("0")) // => BigDecimal.fromBigInt(1n)
     * clamp(BigDecimal.fromStringUnsafe("6")) // => BigDecimal.fromBigInt(5n)
     * ```
     *
     * @see {@link between} for checking whether a `BigDecimal` is already inside a range
     *
     * @category Utilities
     * @since 1.0.0
     */
    (
        self: BigDecimal,
        options: {
            minimum: BigDecimal
            maximum: BigDecimal
        }
    ): BigDecimal
} = order.clamp(Order);

/**
 * Returns the minimum between two `BigDecimal`s.
 *
 * **When to use**
 *
 * Use to select the smaller of two `BigDecimal` values.
 *
 * **Example** (Selecting the smaller decimal)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.min(
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3")
 * ) // => BigDecimal.fromBigInt(2n)
 * ```
 *
 * @see {@link max} for selecting the larger value
 *
 * @category Utilities
 * @since 1.0.0
 */
export const min: {
    /**
     * Returns the minimum between two `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to select the smaller of two `BigDecimal` values.
     *
     * **Example** (Selecting the smaller decimal)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.min(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(2n)
     * ```
     *
     * @see {@link max} for selecting the larger value
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Returns the minimum between two `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to select the smaller of two `BigDecimal` values.
     *
     * **Example** (Selecting the smaller decimal)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.min(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(2n)
     * ```
     *
     * @see {@link max} for selecting the larger value
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = order.min(Order);

/**
 * Returns the maximum between two `BigDecimal`s.
 *
 * **When to use**
 *
 * Use to select the larger of two `BigDecimal` values.
 *
 * **Example** (Selecting the larger decimal)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const result = BigDecimal.max(
 *   BigDecimal.fromStringUnsafe("2"),
 *   BigDecimal.fromStringUnsafe("3")
 * ) // => BigDecimal.fromBigInt(3n)
 * ```
 *
 * @see {@link min} for selecting the smaller value
 *
 * @category Utilities
 * @since 1.0.0
 */
export const max: {
    /**
     * Returns the maximum between two `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to select the larger of two `BigDecimal` values.
     *
     * **Example** (Selecting the larger decimal)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.max(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(3n)
     * ```
     *
     * @see {@link min} for selecting the smaller value
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Returns the maximum between two `BigDecimal`s.
     *
     * **When to use**
     *
     * Use to select the larger of two `BigDecimal` values.
     *
     * **Example** (Selecting the larger decimal)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const result = BigDecimal.max(
     *   BigDecimal.fromStringUnsafe("2"),
     *   BigDecimal.fromStringUnsafe("3")
     * ) // => BigDecimal.fromBigInt(3n)
     * ```
     *
     * @see {@link min} for selecting the smaller value
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): BigDecimal
} = order.max(Order);

/**
 * Determines the sign of a given `BigDecimal`.
 *
 * **When to use**
 *
 * Use to classify a `BigDecimal` as negative, zero, or positive.
 *
 * **Example** (Reading decimal signs)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.sign(BigDecimal.fromStringUnsafe("-5")) // => -1
 * BigDecimal.sign(BigDecimal.fromStringUnsafe("0")) // => 0
 * BigDecimal.sign(BigDecimal.fromStringUnsafe("5")) // => 1
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sign = (n: BigDecimal): Ordering => n.value === Bigint0 ? 0 : n.value < Bigint0 ? -1 : 1;

/**
 * Determines the absolute value of a given `BigDecimal`.
 *
 * **When to use**
 *
 * Use to remove the sign from a `BigDecimal` while preserving its magnitude.
 *
 * **Example** (Calculating absolute values)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.abs(BigDecimal.fromStringUnsafe("-5")) // => BigDecimal.fromBigInt(5n)
 * BigDecimal.abs(BigDecimal.fromStringUnsafe("0")) // => BigDecimal.fromBigInt(0n)
 * BigDecimal.abs(BigDecimal.fromStringUnsafe("5")) // => BigDecimal.fromBigInt(5n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const abs = (n: BigDecimal): BigDecimal => n.value < Bigint0 ? make(-n.value, n.scale) : n;

/**
 * Provides a negate operation on `BigDecimal`s.
 *
 * **When to use**
 *
 * Use to flip the sign of a `BigDecimal`.
 *
 * **Example** (Negating decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.negate(BigDecimal.fromStringUnsafe("3")) // => BigDecimal.fromBigInt(-3n)
 * BigDecimal.negate(BigDecimal.fromStringUnsafe("-6")) // => BigDecimal.fromBigInt(6n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const negate = (n: BigDecimal): BigDecimal => make(-n.value, n.scale);

/**
 * Computes the decimal remainder safely when one operand is divided by a second
 * operand.
 *
 * **When to use**
 *
 * Use to compute a decimal remainder while representing division by zero as
 * `Option.none`.
 *
 * **Details**
 *
 * If the divisor is `0`, the result will be `Option.none()`.
 *
 * **Example** (Computing remainders safely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal, Option } from "effect"
 *
 * const two = BigDecimal.fromStringUnsafe("2")
 * const three = BigDecimal.fromStringUnsafe("3")
 * const zero = BigDecimal.fromStringUnsafe("0")
 *
 * BigDecimal.remainder(three, two) // => Option.some(BigDecimal.fromBigInt(1n))
 * BigDecimal.remainder(two, zero) // => Option.none()
 * ```
 *
 * @see {@link remainderUnsafe} for remainder calculation that throws when the divisor is zero
 * @see {@link divide} for decimal quotient calculation
 *
 * @category Utilities
 * @since 1.0.0
 */
export const remainder: {
    /**
     * Computes the decimal remainder safely when one operand is divided by a second
     * operand.
     *
     * **When to use**
     *
     * Use to compute a decimal remainder while representing division by zero as
     * `Option.none`.
     *
     * **Details**
     *
     * If the divisor is `0`, the result will be `Option.none()`.
     *
     * **Example** (Computing remainders safely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal, Option } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const zero = BigDecimal.fromStringUnsafe("0")
     *
     * BigDecimal.remainder(three, two) // => Option.some(BigDecimal.fromBigInt(1n))
     * BigDecimal.remainder(two, zero) // => Option.none()
     * ```
     *
     * @see {@link remainderUnsafe} for remainder calculation that throws when the divisor is zero
     * @see {@link divide} for decimal quotient calculation
     *
     * @category Utilities
     * @since 1.0.0
     */
    (divisor: BigDecimal): (self: BigDecimal) => Option.Option<BigDecimal>

    /**
     * Computes the decimal remainder safely when one operand is divided by a second
     * operand.
     *
     * **When to use**
     *
     * Use to compute a decimal remainder while representing division by zero as
     * `Option.none`.
     *
     * **Details**
     *
     * If the divisor is `0`, the result will be `Option.none()`.
     *
     * **Example** (Computing remainders safely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal, Option } from "effect"
     *
     * const two = BigDecimal.fromStringUnsafe("2")
     * const three = BigDecimal.fromStringUnsafe("3")
     * const zero = BigDecimal.fromStringUnsafe("0")
     *
     * BigDecimal.remainder(three, two) // => Option.some(BigDecimal.fromBigInt(1n))
     * BigDecimal.remainder(two, zero) // => Option.none()
     * ```
     *
     * @see {@link remainderUnsafe} for remainder calculation that throws when the divisor is zero
     * @see {@link divide} for decimal quotient calculation
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, divisor: BigDecimal): Option.Option<BigDecimal>
} = dual(2, (self: BigDecimal, divisor: BigDecimal): Option.Option<BigDecimal> =>
{
    if (divisor.value === Bigint0)
    {
        return Option.none();
    }

    const Max = Math.max(self.scale, divisor.scale);
    return Option.some(make(scale(self, Max).value % scale(divisor, Max).value, Max));
});

/**
 * Returns the decimal remainder left over when one operand is divided by a
 * non-zero second operand.
 *
 * **When to use**
 *
 * Use when you need to compute a `BigDecimal` remainder with a divisor known to
 * be non-zero and want a plain `BigDecimal` result instead of an `Option`.
 *
 * **Gotchas**
 *
 * Throws a `RangeError` if the divisor is `0`.
 *
 * **Example** (Computing remainders unsafely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.remainderUnsafe(
 *   BigDecimal.fromStringUnsafe("3"),
 *   BigDecimal.fromStringUnsafe("2")
 * ) // => BigDecimal.fromBigInt(1n)
 * ```
 *
 * @see {@link remainder} for returning `Option.none` when the divisor is zero
 *
 * @category Utilities
 * @since 1.0.0
 */
export const remainderUnsafe: {
    /**
     * Returns the decimal remainder left over when one operand is divided by a
     * non-zero second operand.
     *
     * **When to use**
     *
     * Use when you need to compute a `BigDecimal` remainder with a divisor known to
     * be non-zero and want a plain `BigDecimal` result instead of an `Option`.
     *
     * **Gotchas**
     *
     * Throws a `RangeError` if the divisor is `0`.
     *
     * **Example** (Computing remainders unsafely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.remainderUnsafe(
     *   BigDecimal.fromStringUnsafe("3"),
     *   BigDecimal.fromStringUnsafe("2")
     * ) // => BigDecimal.fromBigInt(1n)
     * ```
     *
     * @see {@link remainder} for returning `Option.none` when the divisor is zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (divisor: BigDecimal): (self: BigDecimal) => BigDecimal

    /**
     * Returns the decimal remainder left over when one operand is divided by a
     * non-zero second operand.
     *
     * **When to use**
     *
     * Use when you need to compute a `BigDecimal` remainder with a divisor known to
     * be non-zero and want a plain `BigDecimal` result instead of an `Option`.
     *
     * **Gotchas**
     *
     * Throws a `RangeError` if the divisor is `0`.
     *
     * **Example** (Computing remainders unsafely)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.remainderUnsafe(
     *   BigDecimal.fromStringUnsafe("3"),
     *   BigDecimal.fromStringUnsafe("2")
     * ) // => BigDecimal.fromBigInt(1n)
     * ```
     *
     * @see {@link remainder} for returning `Option.none` when the divisor is zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, divisor: BigDecimal): BigDecimal
} = dual(2, (self: BigDecimal, divisor: BigDecimal): BigDecimal =>
{
    if (divisor.value === Bigint0)
    {
        throw new RangeError("Division by zero");
    }

    const MaxValue = Math.max(self.scale, divisor.scale);
    return make(scale(self, MaxValue).value % scale(divisor, MaxValue).value, MaxValue);
});

/**
 * Provides an `Equivalence` instance for `BigDecimal` that determines equality between BigDecimal values.
 *
 * **When to use**
 *
 * Use when comparing decimal values through APIs that accept an equivalence
 * relation.
 *
 * **Example** (Checking decimal equivalence)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const a = BigDecimal.fromStringUnsafe("1.50")
 * const b = BigDecimal.fromStringUnsafe("1.5")
 * const c = BigDecimal.fromStringUnsafe("2.0")
 *
 * BigDecimal.Equivalence(a, b) // => true
 * BigDecimal.Equivalence(a, c) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<BigDecimal> = Equ.make((self, that) => Compare(self, that) === 0);

/**
 * Checks whether two `BigDecimal`s are equal.
 *
 * **When to use**
 *
 * Use to compare two `BigDecimal` values for numeric equality.
 *
 * **Example** (Checking decimal equality)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const a = BigDecimal.fromStringUnsafe("1.5")
 * const b = BigDecimal.fromStringUnsafe("1.50")
 * const c = BigDecimal.fromStringUnsafe("2.0")
 *
 * BigDecimal.equals(a, b) // => true
 * BigDecimal.equals(a, c) // => false
 * ```
 *
 * @see {@link Equivalence} for passing decimal equality to APIs that require an `Equivalence`
 *
 * @category Utilities
 * @since 1.0.0
 */
export const equals: {
    /**
     * Checks whether two `BigDecimal`s are equal.
     *
     * **When to use**
     *
     * Use to compare two `BigDecimal` values for numeric equality.
     *
     * **Example** (Checking decimal equality)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const a = BigDecimal.fromStringUnsafe("1.5")
     * const b = BigDecimal.fromStringUnsafe("1.50")
     * const c = BigDecimal.fromStringUnsafe("2.0")
     *
     * BigDecimal.equals(a, b) // => true
     * BigDecimal.equals(a, c) // => false
     * ```
     *
     * @see {@link Equivalence} for passing decimal equality to APIs that require an `Equivalence`
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: BigDecimal): (self: BigDecimal) => boolean

    /**
     * Checks whether two `BigDecimal`s are equal.
     *
     * **When to use**
     *
     * Use to compare two `BigDecimal` values for numeric equality.
     *
     * **Example** (Checking decimal equality)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const a = BigDecimal.fromStringUnsafe("1.5")
     * const b = BigDecimal.fromStringUnsafe("1.50")
     * const c = BigDecimal.fromStringUnsafe("2.0")
     *
     * BigDecimal.equals(a, b) // => true
     * BigDecimal.equals(a, c) // => false
     * ```
     *
     * @see {@link Equivalence} for passing decimal equality to APIs that require an `Equivalence`
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, that: BigDecimal): boolean
} = dual(2, (self: BigDecimal, that: BigDecimal): boolean => Equivalence(self, that));

/**
 * Creates a `BigDecimal` from a `bigint` value.
 *
 * **When to use**
 *
 * Use to construct an integer `BigDecimal` from a `bigint`.
 *
 * **Example** (Creating decimals from bigint)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const decimal = BigDecimal.fromBigInt(123n)
 * decimal // => BigDecimal.fromStringUnsafe("123")
 *
 * const largeBigInt = BigDecimal.fromBigInt(9007199254740991n)
 * largeBigInt // => BigDecimal.fromStringUnsafe("9007199254740991")
 * ```
 *
 * @see {@link make} for constructing a decimal with an explicit scale
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromBigInt = (n: bigint): BigDecimal => make(n, 0);

/**
 * Creates a `BigDecimal` from a finite `number`.
 *
 * **When to use**
 *
 * Use when you need to convert a trusted finite JavaScript number to a
 * `BigDecimal` and want a plain result instead of an `Option`.
 *
 * **Gotchas**
 *
 * It is not recommended to convert a floating point number to a decimal
 * directly, as the floating point representation may be unexpected. Throws a
 * `RangeError` if the number is not finite (`NaN`, `+Infinity` or `-Infinity`).
 *
 * **Example** (Creating decimals from finite numbers)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.fromNumberUnsafe(123) // => BigDecimal.fromBigInt(123n)
 * BigDecimal.fromNumberUnsafe(123.456) // => BigDecimal.fromStringUnsafe("123.456")
 * ```
 *
 * @see {@link fromNumber} for returning `Option.none` when the number is not finite
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromNumberUnsafe = (n: number): BigDecimal =>
{
    return Option.getOrThrowWith(fromNumber(n), () => new RangeError(`Number must be finite, got ${n}`));
};

/**
 * Creates a `BigDecimal` safely from a finite `number`.
 *
 * **When to use**
 *
 * Use to convert a finite JavaScript number to a `BigDecimal` without throwing
 * on invalid input.
 *
 * **Details**
 *
 * Returns `Option.none()` for `NaN`, `+Infinity` or `-Infinity`.
 *
 * **Gotchas**
 *
 * It is not recommended to convert a floating point number to a decimal
 * directly, as the floating point representation may be unexpected.
 *
 * **Example** (Creating decimals from numbers safely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal, Option } from "effect"
 *
 * BigDecimal.fromNumber(123.456) // => Option.some(BigDecimal.fromStringUnsafe("123.456"))
 * BigDecimal.fromNumber(Infinity) // => Option.none()
 * ```
 *
 * @see {@link fromNumberUnsafe} for throwing when the number is not finite
 * @see {@link fromString} for parsing decimal strings directly
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromNumber = (n: number): Option.Option<BigDecimal> =>
{
    if (!Number.isFinite(n))
    {
        return Option.none();
    }

    const StringValue = `${n}`;
    if (StringValue.includes("e"))
    {
        return fromString(StringValue);
    }

    const [ LeadValue, TrailValueValue = "" ] = StringValue.split(".");
    return Option.some(make(BigInt(`${LeadValue}${TrailValueValue}`), TrailValueValue.length));
};

/**
 * Parses a decimal string into a `BigDecimal` safely.
 *
 * **When to use**
 *
 * Use to parse external decimal text without throwing on invalid input.
 *
 * **Details**
 *
 * Returns `Option.some` for valid decimal or exponent notation and
 * `Option.none` when the string cannot be parsed or would produce an unsafe
 * scale. The empty string parses as zero.
 *
 * **Example** (Parsing decimal strings safely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal, Option } from "effect"
 *
 * BigDecimal.fromString("123.456") // => Option.some(BigDecimal.make(123456n, 3))
 * BigDecimal.fromString("123.abc") // => Option.none()
 * ```
 *
 * @see {@link fromStringUnsafe} for parsing that throws on invalid input
 * @see {@link fromNumber} for converting finite JavaScript numbers
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromString = (s: string): Option.Option<BigDecimal> =>
{
    if (s === "")
    {
        return Option.some(Zero);
    }

    let base: string;
    let exp: number;
    const Separator = s.search(/[eE]/);
    if (Separator !== -1)
    {
        const Trail = s.slice(Separator + 1);
        base = s.slice(0, Separator);
        exp = Number(Trail);
        if (base === "" || !Number.isSafeInteger(exp) || !FiniteIntRegexp.test(Trail))
        {
            return Option.none();
        }
    }
    else
    {
        base = s;
        exp = 0;
    }

    let digits: string;
    let offset: number;
    const Dot = base.search(/\./);
    if (Dot !== -1)
    {
        const Lead = base.slice(0, Dot);
        const TrailValue = base.slice(Dot + 1);
        digits = `${Lead}${TrailValue}`;
        offset = TrailValue.length;
    }
    else
    {
        digits = base;
        offset = 0;
    }

    if (!FiniteIntRegexp.test(digits))
    {
        return Option.none();
    }

    const ScaleValueValueValue = offset - exp;
    if (!Number.isSafeInteger(ScaleValueValueValue))
    {
        return Option.none();
    }

    return Option.some(make(BigInt(digits), ScaleValueValueValue));
};

/**
 * Parses a decimal string into a `BigDecimal`, throwing if the string is
 * invalid.
 *
 * **When to use**
 *
 * Use when you expect decimal text to be valid and want parse errors to throw.
 *
 * **Details**
 *
 * Accepts the same syntax as `fromString`. Use `fromString` when invalid input
 * should be represented as `Option.none` instead of throwing.
 *
 * **Example** (Parsing decimal strings unsafely)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.fromStringUnsafe("123") // => BigDecimal.fromBigInt(123n)
 * BigDecimal.fromStringUnsafe("123.456") // => BigDecimal.make(123456n, 3)
 * ```
 *
 * @see {@link fromString} for returning `Option.none` on invalid input
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromStringUnsafe = (s: string): BigDecimal =>
{
    return Option.getOrThrowWith(fromString(s), () => new Error(`Invalid numerical string: ${s}`));
};

/**
 * Formats a `BigDecimal` as a string.
 *
 * **When to use**
 *
 * Use to render a `BigDecimal` as plain decimal text when possible.
 *
 * **Details**
 *
 * The value is normalized before formatting. Scientific notation is used when
 * the absolute value of the normalized scale is at least `16`; otherwise plain
 * decimal notation is used.
 *
 * **Example** (Formatting decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.format(BigDecimal.fromStringUnsafe("-5")) // => "-5"
 * BigDecimal.format(BigDecimal.fromStringUnsafe("123.456")) // => "123.456"
 * BigDecimal.format(BigDecimal.fromStringUnsafe("-0.00000123")) // => "-0.00000123"
 * ```
 *
 * @see {@link toExponential} for always rendering scientific notation
 *
 * @category Utilities
 * @since 1.0.0
 */
export const format = (n: BigDecimal): string =>
{
    const NormalizedValue = normalize(n);
    if (Math.abs(NormalizedValue.scale) >= 16)
    {
        return toExponential(NormalizedValue);
    }

    const Negative = NormalizedValue.value < Bigint0;
    const Absolute = `${Negative ? -NormalizedValue.value : NormalizedValue.value}`;
    const DigitsValue = NormalizedValue.scale > 0
        ? Absolute.padStart(NormalizedValue.scale + 1, "0")
        : Absolute.padEnd(Absolute.length - NormalizedValue.scale, "0");
    const Point = DigitsValue.length - NormalizedValue.scale;
    const Complete = NormalizedValue.scale > 0 ? `${DigitsValue.slice(0, Point)}.${DigitsValue.slice(Point)}` : DigitsValue;
    return Negative ? `-${Complete}` : Complete;
};

/**
 * Formats a given `BigDecimal` as a `string` in scientific notation.
 *
 * **When to use**
 *
 * Use to render a `BigDecimal` in scientific notation.
 *
 * **Example** (Formatting decimals exponentially)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.toExponential(BigDecimal.make(123456n, -5)) // => "1.23456e+10"
 * ```
 *
 * @see {@link format} for plain decimal formatting when possible
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toExponential = (n: BigDecimal): string =>
{
    if (isZero(n))
    {
        return "0e+0";
    }

    const NormalizedValueValue = normalize(n);
    const DigitsValueValue = `${NormalizedValueValue.value}`;
    const PointValue = NormalizedValueValue.value < Bigint0 ? 2 : 1;
    const Head = DigitsValueValue.slice(0, PointValue);
    const Tail = DigitsValueValue.slice(PointValue);
    const Exp = Tail.length - NormalizedValueValue.scale;
    return `${Head}${Tail === "" ? "" : `.${Tail}`}e${Exp >= 0 ? "+" : ""}${Exp}`;
};

/**
 * Converts a `BigDecimal` to a JavaScript `number`.
 *
 * **When to use**
 *
 * Use when you need a JavaScript number at an interop boundary where precision
 * loss is acceptable.
 *
 * **Gotchas**
 *
 * This conversion is unsafe because the result can lose integer or fractional
 * precision, round to a nearby representable value, or become `Infinity` when
 * the decimal cannot be represented as a finite JavaScript `number`.
 *
 * **Example** (Converting decimals to numbers)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.toNumberUnsafe(BigDecimal.fromStringUnsafe("123.456")) // => 123.456
 * ```
 *
 * @see {@link format} for preserving decimal precision as text
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toNumberUnsafe = (n: BigDecimal): number => Number(format(n));

/**
 * Checks whether a given `BigDecimal` is an integer.
 *
 * **When to use**
 *
 * Use to test whether a `BigDecimal` has no fractional decimal part.
 *
 * **Example** (Checking integer decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.isInteger(BigDecimal.fromStringUnsafe("0")) // => true
 * BigDecimal.isInteger(BigDecimal.fromStringUnsafe("1")) // => true
 * BigDecimal.isInteger(BigDecimal.fromStringUnsafe("1.1")) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isInteger = (n: BigDecimal): boolean => normalize(n).scale <= 0;

/**
 * Checks whether a given `BigDecimal` is `0`.
 *
 * **When to use**
 *
 * Use to test whether a `BigDecimal` is exactly zero.
 *
 * **Example** (Checking zero decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.isZero(BigDecimal.fromStringUnsafe("0")) // => true
 * BigDecimal.isZero(BigDecimal.fromStringUnsafe("1")) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isZero = (n: BigDecimal): boolean => n.value === Bigint0;

/**
 * Checks whether a given `BigDecimal` is negative.
 *
 * **When to use**
 *
 * Use to test whether a `BigDecimal` is less than zero.
 *
 * **Example** (Checking negative decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.isNegative(BigDecimal.fromStringUnsafe("-1")) // => true
 * BigDecimal.isNegative(BigDecimal.fromStringUnsafe("0")) // => false
 * BigDecimal.isNegative(BigDecimal.fromStringUnsafe("1")) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isNegative = (n: BigDecimal): boolean => n.value < Bigint0;

/**
 * Checks whether a given `BigDecimal` is positive.
 *
 * **When to use**
 *
 * Use to test whether a `BigDecimal` is greater than zero.
 *
 * **Example** (Checking positive decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.isPositive(BigDecimal.fromStringUnsafe("-1")) // => false
 * BigDecimal.isPositive(BigDecimal.fromStringUnsafe("0")) // => false
 * BigDecimal.isPositive(BigDecimal.fromStringUnsafe("1")) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isPositive = (n: BigDecimal): boolean => n.value > Bigint0;

const IsBigDecimalArgs = (args: IArguments) => isBigDecimal(args[0]);

/**
 * Rounding modes for `BigDecimal`.
 *
 * **When to use**
 *
 * Use with `round` to choose how discarded digits affect a `BigDecimal`
 * rounded to a target scale.
 *
 * **Details**
 *
 * - `ceil`: round towards positive infinity
 * - `floor`: round towards negative infinity
 * - `to-zero`: round towards zero
 * - `from-zero`: round away from zero
 * - `half-ceil`: round to the nearest neighbor; if equidistant round towards positive infinity
 * - `half-floor`: round to the nearest neighbor; if equidistant round towards negative infinity
 * - `half-to-zero`: round to the nearest neighbor; if equidistant round towards zero
 * - `half-from-zero`: round to the nearest neighbor; if equidistant round away from zero
 * - `half-even`: round to the nearest neighbor; if equidistant round to the neighbor with an even digit
 * - `half-odd`: round to the nearest neighbor; if equidistant round to the neighbor with an odd digit
 *
 * @see {@link round} for configurable rounding with a `RoundingMode`
 * @see {@link ceil} for fixed rounding toward positive infinity
 * @see {@link floor} for fixed rounding toward negative infinity
 * @see {@link truncate} for fixed rounding toward zero
 *
 * @category Utilities
 * @since 1.0.0
 */
export type RoundingMode =
  | "ceil"
  | "floor"
  | "to-zero"
  | "from-zero"
  | "half-ceil"
  | "half-floor"
  | "half-to-zero"
  | "half-from-zero"
  | "half-even"
  | "half-odd";

/**
 * Computes a rounded `BigDecimal` at the given scale with the specified rounding mode.
 *
 * **When to use**
 *
 * Use to round a decimal at a requested scale with an explicit rounding mode.
 *
 * **Example** (Rounding decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * const positive = BigDecimal.round(BigDecimal.fromStringUnsafe("145"), { mode: "from-zero", scale: -1 })
 * positive // => BigDecimal.fromBigInt(150n)
 *
 * const negative = BigDecimal.round(BigDecimal.fromStringUnsafe("-14.5"))
 * negative // => BigDecimal.fromBigInt(-15n)
 * ```
 *
 * @see {@link ceil} for fixed rounding toward positive infinity
 * @see {@link floor} for fixed rounding toward negative infinity
 * @see {@link truncate} for fixed rounding toward zero
 *
 * @category Utilities
 * @since 1.0.0
 */
export const round: {
    /**
     * Computes a rounded `BigDecimal` at the given scale with the specified rounding mode.
     *
     * **When to use**
     *
     * Use to round a decimal at a requested scale with an explicit rounding mode.
     *
     * **Example** (Rounding decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const positive = BigDecimal.round(BigDecimal.fromStringUnsafe("145"), { mode: "from-zero", scale: -1 })
     * positive // => BigDecimal.fromBigInt(150n)
     *
     * const negative = BigDecimal.round(BigDecimal.fromStringUnsafe("-14.5"))
     * negative // => BigDecimal.fromBigInt(-15n)
     * ```
     *
     * @see {@link ceil} for fixed rounding toward positive infinity
     * @see {@link floor} for fixed rounding toward negative infinity
     * @see {@link truncate} for fixed rounding toward zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (options: { scale?: number;
        mode?: RoundingMode }): (self: BigDecimal) => BigDecimal

    /**
     * Computes a rounded `BigDecimal` at the given scale with the specified rounding mode.
     *
     * **When to use**
     *
     * Use to round a decimal at a requested scale with an explicit rounding mode.
     *
     * **Example** (Rounding decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * const positive = BigDecimal.round(BigDecimal.fromStringUnsafe("145"), { mode: "from-zero", scale: -1 })
     * positive // => BigDecimal.fromBigInt(150n)
     *
     * const negative = BigDecimal.round(BigDecimal.fromStringUnsafe("-14.5"))
     * negative // => BigDecimal.fromBigInt(-15n)
     * ```
     *
     * @see {@link ceil} for fixed rounding toward positive infinity
     * @see {@link floor} for fixed rounding toward negative infinity
     * @see {@link truncate} for fixed rounding toward zero
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: BigDecimal, options?: { scale?: number;
        mode?: RoundingMode }): BigDecimal
} = dual(IsBigDecimalArgs, (self: BigDecimal, options?: { scale?: number;
    mode?: RoundingMode }): BigDecimal =>
{
    const Mode = options?.mode ?? "half-from-zero";
    const ScaleValueValueValueValue = options?.scale ?? 0;

    switch (Mode)
    {
        case "ceil":
            return ceil(self, ScaleValueValueValueValue);

        case "floor":
            return floor(self, ScaleValueValueValueValue);

        case "to-zero":
            return truncate(self, ScaleValueValueValueValue);

        case "from-zero":
            return (isPositive(self) ? ceil(self, ScaleValueValueValueValue) : floor(self, ScaleValueValueValueValue));

        case "half-ceil":
            return floor(sum(self, make(Bigint5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);

        case "half-floor":
            return ceil(sum(self, make(Bigint_5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);

        case "half-to-zero":
            return isNegative(self)
                ? floor(sum(self, make(Bigint5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue)
                : ceil(sum(self, make(Bigint_5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);

        case "half-from-zero":
            return isNegative(self)
                ? ceil(sum(self, make(Bigint_5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue)
                : floor(sum(self, make(Bigint5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);
    }

    const HalfCeil = floor(sum(self, make(Bigint5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);
    const HalfFloor = ceil(sum(self, make(Bigint_5, ScaleValueValueValueValue + 1)), ScaleValueValueValueValue);
    const Digit = digitAt(HalfCeil, ScaleValueValueValueValue);

    switch (Mode)
    {
        case "half-even":
            return equals(HalfCeil, HalfFloor) ? HalfCeil : (Digit % Bigint2 === Bigint0) ? HalfCeil : HalfFloor;

        case "half-odd":
            return equals(HalfCeil, HalfFloor) ? HalfCeil : (Digit % Bigint2 === Bigint0) ? HalfFloor : HalfCeil;
    }
});

/**
 * Computes a truncated `BigDecimal` at the given scale. This removes fractional digits beyond the scale,
 * rounding toward zero.
 *
 * **When to use**
 *
 * Use when you need to discard fractional digits beyond a scale rather than
 * round half up, half down, or toward an infinity.
 *
 * **Example** (Truncating decimals)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.truncate(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
 * BigDecimal.truncate(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
 * ```
 *
 * @see {@link round} for configurable rounding modes
 * @see {@link ceil} for rounding toward positive infinity
 * @see {@link floor} for rounding toward negative infinity
 *
 * @category Utilities
 * @since 1.0.0
 */
export const truncate: {
    /**
     * Computes a truncated `BigDecimal` at the given scale. This removes fractional digits beyond the scale,
     * rounding toward zero.
     *
     * **When to use**
     *
     * Use when you need to discard fractional digits beyond a scale rather than
     * round half up, half down, or toward an infinity.
     *
     * **Example** (Truncating decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.truncate(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
     * BigDecimal.truncate(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
     * ```
     *
     * @see {@link round} for configurable rounding modes
     * @see {@link ceil} for rounding toward positive infinity
     * @see {@link floor} for rounding toward negative infinity
     *
     * @category Utilities
     * @since 1.0.0
     */
    (scale: number): (self: BigDecimal) => BigDecimal

    /**
     * Computes a truncated `BigDecimal` at the given scale. This removes fractional digits beyond the scale,
     * rounding toward zero.
     *
     * **When to use**
     *
     * Use when you need to discard fractional digits beyond a scale rather than
     * round half up, half down, or toward an infinity.
     *
     * **Example** (Truncating decimals)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.truncate(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
     * BigDecimal.truncate(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
     * ```
     *
     * @see {@link round} for configurable rounding modes
     * @see {@link ceil} for rounding toward positive infinity
     * @see {@link floor} for rounding toward negative infinity
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, scale?: number): BigDecimal
} = dual(IsBigDecimalArgs, (self: BigDecimal, scale: number = 0): BigDecimal =>
{
    if (self.scale <= scale)
    {
        return self;
    }

    // BigInt division truncates towards zero
    return make(self.value / (Bigint10 ** BigInt(self.scale - scale)), scale);
});

/**
 * Computes the ceiling of a `BigDecimal` at the given scale.
 *
 * **When to use**
 *
 * Use to round a decimal toward positive infinity at a requested scale.
 *
 * **Details**
 *
 * The default scale is `0`. Positive scales keep digits to the right of the
 * decimal point, and negative scales round positions to the left of the decimal
 * point.
 *
 * @see {@link floor} for rounding toward negative infinity
 * @see {@link truncate} for rounding toward zero
 * @see {@link round} for configurable rounding modes
 *
 * **Example** (Rounding decimals up)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.ceil(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(150n)
 * BigDecimal.ceil(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ceil: {
    /**
     * Computes the ceiling of a `BigDecimal` at the given scale.
     *
     * **When to use**
     *
     * Use to round a decimal toward positive infinity at a requested scale.
     *
     * **Details**
     *
     * The default scale is `0`. Positive scales keep digits to the right of the
     * decimal point, and negative scales round positions to the left of the decimal
     * point.
     *
     * @see {@link floor} for rounding toward negative infinity
     * @see {@link truncate} for rounding toward zero
     * @see {@link round} for configurable rounding modes
     *
     * **Example** (Rounding decimals up)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.ceil(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(150n)
     * BigDecimal.ceil(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (scale: number): (self: BigDecimal) => BigDecimal

    /**
     * Computes the ceiling of a `BigDecimal` at the given scale.
     *
     * **When to use**
     *
     * Use to round a decimal toward positive infinity at a requested scale.
     *
     * **Details**
     *
     * The default scale is `0`. Positive scales keep digits to the right of the
     * decimal point, and negative scales round positions to the left of the decimal
     * point.
     *
     * @see {@link floor} for rounding toward negative infinity
     * @see {@link truncate} for rounding toward zero
     * @see {@link round} for configurable rounding modes
     *
     * **Example** (Rounding decimals up)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.ceil(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(150n)
     * BigDecimal.ceil(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-14n)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, scale?: number): BigDecimal
} = dual(IsBigDecimalArgs, (self: BigDecimal, scale: number = 0): BigDecimal =>
{
    const Truncated = truncate(self, scale);

    if (isPositive(self) && isLessThan(Truncated, self))
    {
        return sum(Truncated, make(Bigint1, scale));
    }

    return Truncated;
});

/**
 * Internal function used by `round` for `half-even` and `half-odd` rounding modes.
 *
 * Returns the digit at the position of the given `scale` within the `BigDecimal`.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const digitAt: {
    /**
     * Internal function used by `round` for `half-even` and `half-odd` rounding modes.
     *
     * Returns the digit at the position of the given `scale` within the `BigDecimal`.
     *
     * @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    (scale: number): (self: BigDecimal) => bigint

    /**
     * Internal function used by `round` for `half-even` and `half-odd` rounding modes.
     *
     * Returns the digit at the position of the given `scale` within the `BigDecimal`.
     *
     * @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, scale: number): bigint
} = dual(2, (self: BigDecimal, scale: number): bigint =>
{
    if (self.scale < scale)
    {
        return Bigint0;
    }

    const Scaled = self.value / (Bigint10 ** BigInt(self.scale - scale));
    return Scaled % Bigint10;
});

/**
 * Computes the floor of a `BigDecimal` at the given scale.
 *
 * **When to use**
 *
 * Use to round a decimal toward negative infinity at a requested scale.
 *
 * **Example** (Rounding decimals down)
 *
 * ```ts import.meta.vitest
 * import { BigDecimal } from "effect"
 *
 * BigDecimal.floor(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
 * BigDecimal.floor(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-15n)
 * ```
 *
 * @see {@link ceil} for rounding toward positive infinity
 * @see {@link truncate} for rounding toward zero
 * @see {@link round} for configurable rounding modes
 *
 * @category Utilities
 * @since 1.0.0
 */
export const floor: {
    /**
     * Computes the floor of a `BigDecimal` at the given scale.
     *
     * **When to use**
     *
     * Use to round a decimal toward negative infinity at a requested scale.
     *
     * **Example** (Rounding decimals down)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.floor(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
     * BigDecimal.floor(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-15n)
     * ```
     *
     * @see {@link ceil} for rounding toward positive infinity
     * @see {@link truncate} for rounding toward zero
     * @see {@link round} for configurable rounding modes
     *
     * @category Utilities
     * @since 1.0.0
     */
    (scale: number): (self: BigDecimal) => BigDecimal

    /**
     * Computes the floor of a `BigDecimal` at the given scale.
     *
     * **When to use**
     *
     * Use to round a decimal toward negative infinity at a requested scale.
     *
     * **Example** (Rounding decimals down)
     *
     * ```ts import.meta.vitest
     * import { BigDecimal } from "effect"
     *
     * BigDecimal.floor(BigDecimal.fromStringUnsafe("145"), -1) // => BigDecimal.fromBigInt(140n)
     * BigDecimal.floor(BigDecimal.fromStringUnsafe("-14.5")) // => BigDecimal.fromBigInt(-15n)
     * ```
     *
     * @see {@link ceil} for rounding toward positive infinity
     * @see {@link truncate} for rounding toward zero
     * @see {@link round} for configurable rounding modes
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: BigDecimal, scale?: number): BigDecimal
} = dual(IsBigDecimalArgs, (self: BigDecimal, scale: number = 0): BigDecimal =>
{
    const TruncatedValue = truncate(self, scale);

    if (isNegative(self) && isGreaterThan(TruncatedValue, self))
    {
        return sum(TruncatedValue, make(Bigint_1, scale));
    }

    return TruncatedValue;
});

/* Preserve multiple statements in upstream traversal loops. */

