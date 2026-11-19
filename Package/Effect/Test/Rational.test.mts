/**
 * Runtime checks for the safe-integer `Rational`, against `BigRational` as the reference.
 *
 * @module @bedform/effect/Test/Rational.test
 *
 * @file      Rational.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Fixtures keep each assertion on one line, and import test tooling first. */
/* eslint-disable sort-imports, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as BigDecimal from "@bedform/effect/BigDecimal";
import * as BigRational from "@bedform/effect/BigRational";
import * as Equal from "@bedform/effect/Equal";
import * as Int from "@bedform/effect/Int";
import * as Option from "@bedform/effect/Option";
import * as Rational from "@bedform/effect/Rational";

const I = Int.makeUnsafe;
const Max = Number.MAX_SAFE_INTEGER;
const MaxBig = BigInt(Max);

/** A deterministic linear congruential generator, so failures reproduce. */
const random = (() =>
{
    let state = 0x2545_f491n;
    return (): bigint =>
    {
        state = (state * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) % 2n ** 64n;
        return state >> 11n;
    };
})();

/** A random safe integer whose magnitude has at most `bits` bits. */
const randomInt = (bits: bigint): number =>
{
    const magnitude = Number(random() % 2n ** bits);
    return random() % 2n === 0n ? magnitude : -magnitude;
};

const randomRational = (bits: bigint): Rational.Rational =>
{
    const denominator = Math.abs(randomInt(bits)) || 1;
    return Rational.makeUnsafe(I(randomInt(bits)), I(denominator));
};

const fits = (r: BigRational.BigRational): boolean =>
    r.denominator <= MaxBig && r.numerator <= MaxBig && r.numerator >= -MaxBig;

/** Asserts a Rational operation agrees with BigRational, or throws a RangeError when the result does not fit. */
const agrees = (
    label: string,
    rationalOperation: () => Rational.Rational,
    reference: BigRational.BigRational
): void =>
{
    if (fits(reference))
    {
        Assert.equal(Rational.format(rationalOperation()), BigRational.format(reference), label);
    }
    else
    {
        Assert.throws(rationalOperation, RangeError, label);
    }
};

test("construction reduces and normalizes the sign", () =>
{
    const r = Rational.makeUnsafe(I(6), I(-4));
    Assert.equal(r.numerator, -3);
    Assert.equal(r.denominator, 2);
    Assert.ok(Option.isNone(Rational.make(I(1), Int.zero)));
    Assert.throws(() => Rational.makeUnsafe(I(1), Int.zero), RangeError);
    Assert.ok(Equal.equals(Rational.makeUnsafe(I(2), I(4)), Rational.makeUnsafe(I(1), I(2))));
    Assert.ok(!Equal.equals(Rational.makeUnsafe(I(1), I(2)), BigRational.makeUnsafe(1n, 2n)), "kinds are distinct values");
    Assert.equal(Rational.format(Rational.makeUnsafe(Int.minValue, I(-1))), String(Max));
});

test("arithmetic agrees with BigRational on random inputs, or throws RangeError", () =>
{
    for (const bits of [ 8n, 26n, 40n, 53n ])
    {
        for (let i = 0; i < 400; i += 1)
        {
            const a = randomRational(bits);
            const b = randomRational(bits);
            const A = Rational.toBigRational(a);
            const B = Rational.toBigRational(b);
            agrees(`${Rational.format(a)} + ${Rational.format(b)}`, () => Rational.sum(a, b), BigRational.sum(A, B));
            agrees(`${Rational.format(a)} - ${Rational.format(b)}`, () => Rational.subtract(a, b), BigRational.subtract(A, B));
            agrees(`${Rational.format(a)} * ${Rational.format(b)}`, () => Rational.multiply(a, b), BigRational.multiply(A, B));
            Option.match(BigRational.divide(A, B), {
                onNone: () => Assert.ok(Option.isNone(Rational.divide(a, b))),
                onSome: (quotient: BigRational.BigRational) => agrees(`${Rational.format(a)} / ${Rational.format(b)}`, () => Rational.divideUnsafe(a, b), quotient)
            });
            Assert.equal(Rational.Order(a, b), BigRational.Order(A, B), `compare ${Rational.format(a)} ${Rational.format(b)}`);
        }
    }
});

test("overflow throws RangeError instead of losing precision", () =>
{
    const tiny = Rational.makeUnsafe(Int.one, I(2 ** 52));
    Assert.throws(() => Rational.multiply(tiny, tiny), RangeError);
    Assert.throws(() => Rational.sum(Rational.fromInt(Int.maxValue), Rational.one), RangeError);
    Assert.equal(Rational.format(Rational.sum(Rational.fromInt(Int.maxValue), Rational.negate(Rational.one))), String(Max - 1));
    const x = Rational.makeUnsafe(I(2 ** 30 + 1), I(2 ** 31 - 1));
    const y = Rational.makeUnsafe(I(2 ** 31 - 1), I(2 ** 30 + 1));
    Assert.equal(Rational.format(Rational.multiply(x, y)), "1", "cross-cancellation keeps intermediate products small");
});

test("conversions mirror BigRational and refuse what does not fit", () =>
{
    Assert.equal(Rational.format(Rational.fromNumberUnsafe(0.5)), "1/2");
    Assert.ok(Option.isNone(Rational.fromNumber(0.1)), "0.1 needs a denominator of 2^55");
    Assert.ok(Option.isNone(Rational.fromNumber(NaN)));
    Assert.equal(Option.getOrThrow(Rational.toNumber(Rational.makeUnsafe(I(1), I(3)))), 1 / 3);
    Assert.equal(Rational.round(Rational.makeUnsafe(I(-5), I(2))), -3);
    Assert.equal(Rational.round(Rational.makeUnsafe(I(-5), I(2)), { mode: "half-even" }), -2);
    Assert.equal(Rational.format(Option.getOrThrow(Rational.fromBigDecimal(BigDecimal.make(125n, 3)))), "1/8");
    Assert.ok(Option.isNone(Rational.fromBigDecimal(BigDecimal.make(1n, 20))));
    Assert.ok(Option.isNone(Rational.fromBigRational(BigRational.makeUnsafe(1n, 2n ** 60n))));
    Assert.equal(BigDecimal.format(Option.getOrThrow(Rational.toBigDecimalExact(Rational.makeUnsafe(I(3), I(8))))), "0.375");
    Assert.equal(Rational.format(Rational.fromStringUnsafe("-6/4")), "-3/2");
    Assert.ok(Option.isNone(Rational.fromString("1/9007199254740992")));
});
