/**
 * Behavior, schema, packaging and restricted-host checks for the Unit port of effect-units,
 * whose float and `Exact` modules are merged into kind-dispatching modules.
 *
 * @module @bedform/effect/Test/Unit.test
 *
 * @file      Unit.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Reflective fixtures index the public Unit facade by module name. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import * as Root from "@bedform/effect";
import * as Unit from "@bedform/effect/Unit";
import * as Schema from "@bedform/effect/Schema";
import * as Equal from "@bedform/effect/Equal";
import * as HashSet from "@bedform/effect/HashSet";
import * as Result from "@bedform/effect/Result";
import * as EffectDuration from "@bedform/effect/Duration";
import * as Option from "@bedform/effect/Option";
import * as BigRational from "@bedform/effect/BigRational";
import * as Rational from "@bedform/effect/Rational";
import * as Int from "@bedform/effect/Int";
import * as Constants from "../Distribution/Unit/Internal/constants.js";
import * as ConstantsExact from "../Distribution/Unit/Internal/constantsExact.js";

type Module = Readonly<Record<string, unknown>>;
const Modules = Unit as unknown as Readonly<Record<string, Module>>;
const ModuleNames = Object.keys(Modules).sort();
test("the facade exposes the public Unit modules", () =>
{
    Assert.equal(ModuleNames.length, 36);
    Assert.ok(!ModuleNames.some((name) => name.endsWith("Exact") || name === "Rational"), "Exact twins and Rational are merged or moved");
    Assert.ok(!ModuleNames.some((name) => /^[a-z]/.test(name)), "internal modules stay private");
    Assert.strictEqual(Root.Unit, Unit);
    Assert.strictEqual(Root.Unit.Length, Unit.Length);
    Assert.strictEqual(Root.BigRational, BigRational);
    Assert.strictEqual(Root.Rational, Rational);
    Assert.strictEqual(Root.Int, Int);
});

test("mixed kinds follow the float-wins rule and exact division returns Option", () =>
{
    const I = Int.makeUnsafe;
    const float = Unit.Length.meters(1.5);
    const rational = Unit.Length.meters(Rational.makeUnsafe(I(3), I(2)));
    const big = Unit.Length.meters(BigRational.makeUnsafe(3n, 2n));

    const rationalSum: Unit.Length.Length<Rational.Rational> = Unit.Quantity.sum(rational, rational);
    const bigSum: Unit.Length.Length<BigRational.BigRational> = Unit.Quantity.sum(rational, big);
    const floatSum: Unit.Length.Length = Unit.Quantity.sum(big, float);
    Assert.equal(Rational.format(rationalSum.value), "3");
    Assert.equal(BigRational.format(bigSum.value), "3");
    Assert.equal(floatSum.value, 3);
    Assert.equal(Unit.Quantity.sum(float, rational).value, 3);
    Assert.equal(Unit.Length.meters(I(3)).value, 3);

    const scaled: Unit.Length.Length<BigRational.BigRational> = Unit.Quantity.multiply(big, 3n);
    Assert.equal(BigRational.format(scaled.value), "9/2");
    Assert.equal(Rational.format(Unit.Quantity.multiply(rational, rational.value).value), "9/4");

    const area = Unit.Quantity.times(big, big);
    Assert.equal(BigRational.format(Unit.Area.inSquareMeters(area)), "9/4");

    Assert.ok(Option.isNone(Unit.Quantity.divide(big, 0n)));
    Assert.equal(BigRational.format(Option.getOrThrow(Unit.Quantity.divide(big, 3n)).value), "1/2");
    Assert.equal(Unit.Quantity.divide(float, 0).value, Infinity);
    Assert.throws(() => Unit.Quantity.divideUnsafe(big, 0n), RangeError);
    const speed = Unit.Quantity.per(big, Unit.Duration.seconds(BigRational.makeUnsafe(1n, 2n)));
    Assert.equal(BigRational.format(Unit.Speed.inMetersPerSecond(Option.getOrThrow(speed))), "3");
    Assert.ok(Option.isNone(Unit.Quantity.per(big, Unit.Duration.seconds(BigRational.zero))));
    Assert.equal(Unit.Quantity.per(float, Unit.Duration.seconds(0)).value, Infinity);
    Assert.equal(Unit.Quantity.per(big, Unit.Duration.seconds(0)).value, Infinity);
    Assert.ok(Option.isNone(Unit.Quantity.ratio(big, Unit.Length.meters(0n))));

    Assert.ok(!Equal.equals(float, big), "Equal distinguishes kinds");
    Assert.ok(Unit.Quantity.equals(float, big), "Quantity.equals compares across kinds");
    Assert.ok(Unit.Quantity.isLessThan(Unit.Length.meters(1n), float));
    Assert.ok(BigRational.isBigRational(Unit.Quantity.max(float, Unit.Length.meters(2n)).value), "max returns its argument unchanged");

    Assert.throws(() => Unit.Length.lightYears(Rational.one), RangeError, "a light year needs more than 53 bits");
    Assert.equal(BigRational.format(Unit.Length.inMeters(Unit.Length.lightYears(1n))), "9460730472580800");
    Assert.equal(Unit.Length.parsecs(1n).value, Unit.Length.parsecs(1).value, "π-based conversions produce floats");
    Assert.equal(Rational.format(Unit.Angle.inRadians(Unit.Angle.radians(Rational.one))), "1");

    const kelvins = Unit.Temperature.degreesFahrenheit(BigRational.makeUnsafe(212n));
    Assert.equal(BigRational.format(Unit.Temperature.inKelvins(kelvins)), "7463/20");
    Assert.equal(BigRational.format(Unit.Temperature.inDegreesCelsius(kelvins)), "100");
    Assert.equal(Rational.format(Unit.Dimensionless.inPercent(Unit.Dimensionless.complement(Unit.Dimensionless.percent(Rational.makeUnsafe(I(30)))))), "70");

    Assert.equal(Unit.Quantity.toNumberUnsafe(big).value, 1.5);
    Assert.equal(Rational.format(Unit.Quantity.toRationalUnsafe(float).value), "3/2");
    Assert.ok(Option.isNone(Unit.Quantity.toRational(Unit.Length.meters(0.1))));
    Assert.ok(Option.isNone(Unit.Quantity.toBigRational(Unit.Length.meters(NaN))));
});

test("Result-based string getters decode, encode and report failures", () =>
{
    const half = Schema.decodeUnknownSync(BigRational.BigRationalFromString)("2/4");
    Assert.equal(BigRational.format(half), "1/2");
    Assert.equal(Schema.encodeSync(BigRational.BigRationalFromString)(BigRational.makeUnsafe(-6n, 4n)), "-3/2");
    const badRational = Schema.decodeUnknownResult(BigRational.BigRationalFromString)("1/-2");
    Assert.ok(Result.isFailure(badRational));
    Assert.match(String(badRational.failure), /not a canonical rational encoding/);
    Assert.equal(Rational.format(Schema.decodeUnknownSync(Rational.RationalFromString)("6/4")), "3/2");

    const speed = Unit.Unit.rate("Meters", "Seconds");
    Assert.ok(Unit.Unit.equals(Schema.decodeUnknownSync(Unit.Unit.UnitFromString)("(Meters/Seconds)"), speed));
    Assert.equal(Schema.encodeSync(Unit.Unit.UnitFromString)(speed), "(Meters/Seconds)");
    const badUnit = Schema.decodeUnknownResult(Unit.Unit.UnitFromString)("Meters/Seconds");
    Assert.ok(Result.isFailure(badUnit));
    Assert.match(String(badUnit.failure), /not a canonical unit encoding/);
});

test("identity schemas derive JSON codecs when nested", () =>
{
    const Trip = Schema.Struct({ distance: Unit.Length.Length,
        exactDistance: Unit.Quantity.Quantity(Unit.Length.Meters, BigRational.BigRational),
        ratio: BigRational.BigRational,
        at: Unit.Temperature.Temperature });
    const codec = Schema.toCodecJson(Trip);
    const trip = { distance: Unit.Length.kilometers(2),
        exactDistance: Unit.Length.feet(1n),
        ratio: BigRational.makeUnsafe(2n, 3n),
        at: Unit.Temperature.degreesCelsius(20) };
    const encoded = Schema.encodeSync(codec)(trip);
    Assert.deepEqual(encoded, { distance: { unit: "Meters",
        value: 2000 },
    exactDistance: { unit: "Meters",
        value: "381/1250" },
    ratio: "2/3",
    at: { unit: "Kelvins",
        value: 293.15 } });
    const decoded = Schema.decodeUnknownSync(codec)(encoded);
    Assert.ok(Equal.equals(decoded.distance, trip.distance));
    Assert.ok(Equal.equals(decoded.exactDistance, trip.exactDistance));
    Assert.ok(Equal.equals(decoded.ratio, trip.ratio));
    Assert.ok(Equal.equals(decoded.at, trip.at));
    Assert.equal(BigRational.BigRational.ast.annotations?.["toCodecArbitrary"], undefined);
});

test("quantities use @bedform/effect equality, hashing and Duration interop", () =>
{
    Assert.ok(Equal.equals(Unit.Length.meters(1), Unit.Length.centimeters(100)));
    Assert.equal(HashSet.size(HashSet.make(Unit.Length.meters(1), Unit.Length.meters(1), Unit.Length.meters(2))), 2);
    Assert.equal(HashSet.size(HashSet.make(Unit.Length.meters(1n), Unit.Length.meters(BigRational.one), Unit.Length.meters(1))), 2);
    Assert.ok(Equal.equals(BigRational.makeUnsafe(2n, 4n), BigRational.makeUnsafe(1n, 2n)));
    Assert.equal(Unit.Duration.inSeconds(Unit.Duration.fromDuration(EffectDuration.minutes(2))), 120);
    Assert.equal(EffectDuration.toMillis(Option.getOrThrow(Unit.Duration.toDuration(Unit.Duration.seconds(1.5)))), 1500);
    const exact = Option.getOrThrow(Unit.Duration.fromDurationBigRational(EffectDuration.millis(1)));
    Assert.equal(BigRational.format(Unit.Duration.inSeconds(exact)), "1/1000");
    const third = Option.getOrThrow(Unit.Duration.toDuration(Unit.Duration.seconds(BigRational.makeUnsafe(1n, 3n)), { mode: "floor" }));
    Assert.equal(Option.getOrThrow(EffectDuration.toNanos(third)), 333_333_333n);
    Assert.ok(Option.isNone(Unit.Duration.toDuration(Unit.Duration.seconds(-1n))));

    const speed: Unit.Speed.Speed = Unit.Quantity.per(Unit.Length.meters(10), Unit.Duration.seconds(4));
    Assert.equal(Unit.Speed.inMetersPerSecond(speed), 2.5);
    // @ts-expect-error Quantities in different units cannot be added.
    Assert.ok(Unit.Quantity.sum(Unit.Length.meters(1), Unit.Duration.seconds(1)));
});

test("float and exact constants agree, including every SI prefix", () =>
{
    for (const name of Object.keys(ConstantsExact) as ReadonlyArray<keyof typeof ConstantsExact>)
    {
        Assert.ok(Object.is(Constants[name], Option.getOrThrow(BigRational.toNumber(ConstantsExact[name]))), name);
    }

    const prefixes = Unit.Prefix.Prefix.literals;
    Assert.equal(prefixes.length, 24);
    for (const prefix of prefixes)
    {
        Assert.ok(Object.is(Unit.Prefix.toBase(prefix, 1), Option.getOrThrow(BigRational.toNumber(Unit.Prefix.toBase(prefix, BigRational.one)))), prefix);
        Assert.equal(BigRational.format(Unit.Prefix.toPrefixed(prefix, Unit.Prefix.toBase(prefix, BigRational.makeUnsafe(7n, 3n)))), "7/3");
    }
});

test("packed subpaths are public and Unit internals stay private", async () =>
{
    Assert.strictEqual(Root.Unit, await import("@bedform/effect/Unit"));
    Assert.strictEqual(Root.Unit.Meter, await import("@bedform/effect/Unit/Meter"), "Meter is the one public Unit subpath");
    for (const name of [ "Int", "UInt", "Rational", "BigRational" ])
    {
        Assert.strictEqual((Root as unknown as Record<string, unknown>)[name], await import(`@bedform/effect/${name}`), name);
    }

    await Assert.rejects(import("@bedform/effect/Distribution/Unit/Internal/constants.js" as string), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    await Assert.rejects(import("@bedform/effect/Unit/Length" as string), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    await Assert.rejects(import("@bedform/effect/Unit/Rational" as string), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
});

test("Unit runs without Node or Web globals", async () =>
{
    const bundle = await build({ stdin: { contents: `import { Length, Quantity, Speed, Duration } from "@bedform/effect/Unit";
        import * as BigRational from "@bedform/effect/BigRational";
        import * as Rational from "@bedform/effect/Rational";
        import * as Int from "@bedform/effect/Int";
        import * as Schema from "@bedform/effect/Schema";
        const speed = Quantity.per(Length.miles(1), Duration.hours(1));
        globalThis.results = [
            Speed.inMetersPerSecond(speed),
            BigRational.format(Length.inMeters(Length.feet(1n))),
            Rational.format(Length.inMeters(Length.feet(Rational.fromInt(Int.makeUnsafe(5))))),
            Schema.encodeSync(Length.LengthFromStruct)(Length.kilometers(1)),
            Schema.decodeUnknownSync(BigRational.BigRationalFromString)("-3/2").numerator.toString()
        ];`,
    resolveDir: process.cwd() },
    bundle: true,
    write: false,
    platform: "neutral",
    format: "iife" });
    const context = { console: undefined,
        process: undefined,
        Buffer: undefined,
        URL: undefined,
        TextEncoder: undefined,
        TextDecoder: undefined,
        setTimeout: undefined };
    runInNewContext(bundle.outputFiles[0].text, context);
    Assert.equal(JSON.stringify((context as typeof context & { results: unknown }).results), "[0.44704,\"381/1250\",\"381/250\",{\"unit\":\"Meters\",\"value\":1000},\"-3\"]");
});
