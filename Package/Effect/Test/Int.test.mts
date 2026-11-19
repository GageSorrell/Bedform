/**
 * Runtime checks for the safe-integer brands `Int` and `UInt`.
 *
 * @module @bedform/effect/Test/Int.test
 *
 * @file      Int.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Fixtures keep each assertion on one line, and import test tooling first. */
/* eslint-disable sort-imports, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Int from "@bedform/effect/Int";
import * as Option from "@bedform/effect/Option";
import * as Result from "@bedform/effect/Result";
import * as Schema from "@bedform/effect/Schema";
import * as UInt from "@bedform/effect/UInt";
import { pipe } from "@bedform/effect/Function";

const I = Int.makeUnsafe;
const U = UInt.makeUnsafe;
const Max = Number.MAX_SAFE_INTEGER;

test("constructors floor and reject non-finite or unsafe results", () =>
{
    Assert.deepEqual(Option.getOrThrow(Int.make(2.9)), 2);
    Assert.deepEqual(Option.getOrThrow(Int.make(-2.5)), -3);
    Assert.ok(Object.is(Int.makeUnsafe(-0), 0), "negative zero is normalized");
    Assert.ok(Object.is(Int.makeUnsafe(-0.5), -1));
    for (const bad of [ NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 53) ])
    {
        Assert.ok(Option.isNone(Int.make(bad)), String(bad));
        Assert.throws(() => Int.makeUnsafe(bad), RangeError, String(bad));
    }

    Assert.equal(Int.makeUnsafe(Max - 0.5), Max - 1);
    Assert.ok(Option.isNone(UInt.make(-0.5)), "UInt floors before checking the sign");
    Assert.equal(UInt.makeUnsafe(0.99), 0);
    Assert.throws(() => UInt.makeUnsafe(-1), RangeError);
    Assert.ok(Int.isInt(3) && !Int.isInt(3.5) && !Int.isInt(2 ** 53));
    Assert.ok(UInt.isUInt(0) && !UInt.isUInt(-1));
});

test("conversions to and from bigint and strings respect the safe range", () =>
{
    Assert.equal(Option.getOrThrow(Int.fromBigInt(-12n)), -12);
    Assert.ok(Option.isNone(Int.fromBigInt(2n ** 53n)));
    Assert.equal(Int.toBigInt(I(-12)), -12n);
    Assert.equal(Option.getOrThrow(Int.fromString("+42")), 42);
    Assert.equal(Option.getOrThrow(Int.fromString("-42")), -42);
    Assert.ok(Option.isNone(Int.fromString("4.2")));
    Assert.ok(Option.isNone(Int.fromString("9007199254740992")));
    Assert.ok(Option.isNone(UInt.fromString("-1")));
    Assert.ok(Option.isNone(UInt.fromInt(I(-1))));
});

test("arithmetic is exact or throws when it leaves the safe range", () =>
{
    Assert.equal(Int.sum(I(2), I(3)), 5);
    Assert.equal(pipe(I(2), Int.subtract(I(5))), -3);
    Assert.equal(Int.multiply(I(-4), I(6)), -24);
    Assert.throws(() => Int.sum(Int.maxValue, Int.one), RangeError);
    Assert.throws(() => Int.subtract(Int.minValue, Int.one), RangeError);
    Assert.throws(() => Int.multiply(I(2 ** 27), I(2 ** 26)), RangeError);
    Assert.throws(() => Int.increment(Int.maxValue), RangeError);
    Assert.equal(Int.negate(Int.minValue), Max);
    Assert.equal(Int.abs(I(-7)), 7);
    Assert.equal(Int.sign(I(-7)), -1);
    Assert.equal(Int.gcd(I(-12), I(18)), 6);
    Assert.equal(Int.lcm(I(-4), I(6)), 12);
    Assert.equal(Int.sumAll([ I(1), I(2), I(3) ]), 6);
    Assert.equal(Int.multiplyAll([ I(2), I(0), Int.maxValue, Int.maxValue ]), 0);
    Assert.equal(Int.clamp(I(12), { maximum: I(10),
        minimum: I(0) }), 10);
    Assert.equal(Int.remainder(I(-7), I(2)), -1);
});

test("division floors exactly, even at the edges of the safe range", () =>
{
    Assert.equal(Option.getOrThrow(Int.divide(I(7), I(2))), 3);
    Assert.equal(Option.getOrThrow(Int.divide(I(-7), I(2))), -4);
    Assert.equal(Option.getOrThrow(Int.divide(I(7), I(-2))), -4);
    Assert.equal(Option.getOrThrow(Int.divide(I(-7), I(-2))), 3);
    Assert.ok(Object.is(Option.getOrThrow(Int.divide(I(0), I(-5))), 0));
    Assert.ok(Option.isNone(Int.divide(I(1), I(0))));
    Assert.throws(() => Int.divideUnsafe(I(1), I(0)), RangeError);
    const edges = [ Max, Max - 1, -Max, 3, 7, 94_906_267, 2 ** 52 + 1 ];
    for (const a of edges)
    {
        for (const b of edges)
        {
            const expected = Number((BigInt(a) - (((BigInt(a) % BigInt(b)) + BigInt(b)) % BigInt(b))) / BigInt(b));
            Assert.equal(Int.divideUnsafe(I(a), I(b)), expected, `${a} / ${b}`);
        }
    }
});

test("square roots floor exactly", () =>
{
    for (const root of [ 0, 1, 2, 3, 94_906_265, 94_906_266 ])
    {
        const square = root * root;
        if (Number.isSafeInteger(square))
        {
            Assert.equal(Int.sqrtUnsafe(I(square)), root, `${square}`);
        }

        if (square > 0 && Number.isSafeInteger(square))
        {
            Assert.equal(Int.sqrtUnsafe(I(square - 1)), root - 1, `${square - 1}`);
        }
    }

    Assert.equal(Int.sqrtUnsafe(Int.maxValue), 94_906_265);
    Assert.ok(Option.isNone(Int.sqrt(I(-1))));
    Assert.equal(UInt.sqrt(U(17)), 4);
});

test("UInt subtraction and decrement return Option instead of going negative", () =>
{
    Assert.ok(Option.isNone(UInt.subtract(U(2), U(3))));
    Assert.equal(Option.getOrThrow(UInt.subtract(U(3), U(2))), 1);
    Assert.throws(() => UInt.subtractUnsafe(U(2), U(3)), RangeError);
    Assert.ok(Option.isNone(UInt.decrement(UInt.zero)));
    Assert.equal(Option.getOrThrow(UInt.decrement(U(1))), 0);
    Assert.throws(() => UInt.decrementUnsafe(UInt.zero), RangeError);
    Assert.equal(UInt.sign(UInt.zero), 0);
    Assert.equal(UInt.sign(U(9)), 1);
    Assert.equal(Int.sum(U(2), I(-5)), -3, "a UInt is an Int");
});

test("schemas reject rather than floor", () =>
{
    Assert.equal(Schema.decodeUnknownSync(Int.Int)(-3), -3);
    Assert.ok(Result.isFailure(Schema.decodeUnknownResult(Int.Int)(2.5)));
    Assert.ok(Result.isFailure(Schema.decodeUnknownResult(Int.Int)(2 ** 53)));
    Assert.equal(Schema.decodeUnknownSync(UInt.UInt)(3), 3);
    Assert.ok(Result.isFailure(Schema.decodeUnknownResult(UInt.UInt)(-1)));
});
