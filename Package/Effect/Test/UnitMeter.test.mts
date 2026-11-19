/**
 * Behavior, schema and packaging checks for the original `Unit/Meter` branded scalar.
 *
 * @module @bedform/effect/Test/UnitMeter.test
 *
 * @file      UnitMeter.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

import * as BigRational from "@bedform/effect/BigRational";
import * as Int from "@bedform/effect/Int";
import * as Meter from "@bedform/effect/Unit/Meter";
import * as Option from "@bedform/effect/Option";
import * as Rational from "@bedform/effect/Rational";
import * as Schema from "@bedform/effect/Schema";
import * as Unit from "@bedform/effect/Unit";
import Assert from "node:assert/strict";
import { test } from "node:test";

test("the subpath and the Unit namespace are the same module", () =>
{
    Assert.strictEqual(Unit.Meter, Meter);
});

test("make accepts finite numbers and rejects NaN and infinities", () =>
{
    Assert.deepEqual(Meter.make(0.0625), Option.some(0.0625));
    Assert.deepEqual(Meter.make(-3.5), Option.some(-3.5));
    Assert.ok(Object.is(Option.getOrThrow(Meter.make(-0)), 0), "negative zero is normalized");
    for (const value of [ Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY ])
    {
        Assert.ok(Option.isNone(Meter.make(value)), String(value));
        Assert.throws(() => Meter.makeUnsafe(value), RangeError, String(value));
    }

    Assert.equal(Meter.makeUnsafe(1.5), 1.5);
    Assert.ok(Object.is(Meter.makeUnsafe(-0), 0));
});

test("fromInt and makeInt produce whole meters, flooring like Int.make", () =>
{
    Assert.equal(Meter.fromInt(Int.makeUnsafe(-7)), -7);
    Assert.deepEqual(Meter.makeInt(2.9), Option.some(2));
    Assert.deepEqual(Meter.makeInt(-2.1), Option.some(-3));
    Assert.ok(Object.is(Option.getOrThrow(Meter.makeInt(-0.5)), -1));
    Assert.ok(Object.is(Option.getOrThrow(Meter.makeInt(-0)), 0));
    for (const value of [ Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 2 ])
    {
        Assert.ok(Option.isNone(Meter.makeInt(value)), String(value));
        Assert.deepEqual(Meter.makeInt(value), Option.map(Int.make(value), Meter.fromInt));
    }

    const whole = Option.getOrThrow(Meter.makeInt(4.25));
    Assert.ok(Int.isInt(whole));
});

test("fromLength and toLength convert to and from float lengths", () =>
{
    Assert.equal(Meter.fromLength(Unit.Length.centimeters(250)), 2.5);
    const sixteenth = Rational.makeUnsafe(Int.makeUnsafe(1), Int.makeUnsafe(16));
    Assert.equal(Meter.fromLength(Unit.Length.meters(sixteenth)), 0.0625);
    Assert.equal(Meter.fromLength(Unit.Length.feet(1n)), 0.3048);
    Assert.ok(Object.is(Meter.fromLength(Unit.Length.meters(-0)), 0));
    Assert.throws(() => Meter.fromLength(Unit.Quantity.divide(Unit.Length.meters(1), 0)), RangeError);
    const overflowing = BigRational.makeUnsafe(10n ** 400n, 1n);
    Assert.throws(() => Meter.fromLength(Unit.Length.meters(overflowing)), RangeError);

    const length = Meter.toLength(Meter.makeUnsafe(0.0625));
    Assert.equal(length.unit, Unit.Length.Meters);
    Assert.equal(Unit.Length.inMeters(length), 0.0625);
    Assert.equal(Meter.fromLength(length), 0.0625);
});

test("the schema decodes finite numbers and rejects non-finite ones", () =>
{
    const decode = Schema.decodeUnknownSync(Meter.Meter);
    Assert.equal(decode(1.25), 1.25);
    Assert.equal(Schema.encodeSync(Meter.Meter)(Meter.makeUnsafe(3)), 3);
    for (const value of [ Number.NaN, Number.POSITIVE_INFINITY, "1", null ])
    {
        Assert.throws(() => decode(value), String(value));
    }
});
