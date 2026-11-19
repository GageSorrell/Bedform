/**
 * Rotator utilities, Minecraft conversion conventions and canonical protocol laws.
 *
 * @module bedform/Test/Rotator.test
 *
 * @file      Rotator.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and deliberate axis ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as R from "bedform/Rotator";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as O from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashMap from "@bedform/effect/HashMap";
import * as HashSet from "@bedform/effect/HashSet";
import * as Inspectable from "@bedform/effect/Inspectable";
import { pipe } from "@bedform/effect/Function";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Compares raw angles with an explicit numerical tolerance.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: R.Coordinates, expected: R.Coordinates, tolerance = 1e-10): void =>
{
    for (const Key of [ "pitch", "yaw", "roll" ] as const)
    {
        Assert.ok(Math.abs(actual[Key] - expected[Key]) <= tolerance, `${Key}: ${actual[Key]} != ${expected[Key]}`);
    }
};

/**
 * Unwraps and compares immutable direction results.
 *
 * @category Tests
 * @since 1.0.0
 */
const vector = (value: O.Option<V.Vector3>, expected: V.Coordinates): void =>
{
    const Actual = O.getOrThrow(value);
    Assert.ok(Object.isFrozen(Actual));
    Assert.ok(V.distance(Actual, expected) < 1e-10);
};

/**
 * Constructs finite fixture angles without hiding the Option contract.
 *
 * @category Tests
 * @since 1.0.0
 */
const r = (pitch: number, yaw: number, roll: number): R.Rotator =>
{
    return O.getOrThrow(R.Rotator(pitch, yaw, roll));
};

test("Rotator inventory, finite construction, raw Unsafe values and exact alias restrictions", () =>
{
    Assert.strictEqual(Root.Rotator, R);
    const Inventory = [ "Rotator", "RotatorUnsafe", "isRotator", "isFinite", "add", "subtract", "scale", "negate", "getAxis", "setAxis", "wrapAxis", "clampAxis", "normalizeAxis", "wrap", "clamp", "normalize", "isZero", "isNearlyZero", "isNormalized", "toQuat", "fromQuat", "toEuler", "fromEuler", "principal", "windingAndRemainder", "equivalent", "manhattanDistance", "closest", "gridSnap", "compressAxisToByte", "decompressAxisFromByte", "compressAxisToShort", "decompressAxisFromShort", "inverse", "compose", "multiply", "slerp", "rotateVector", "unrotateVector", "axisX", "axisY", "axisZ", "forward", "up", "right", "axes", "angularDistance", "equalsApprox", "equals", "equalsComponents", "hashComponents", "isIdentity", "canonicalKey", "format", "toString", "fromString", "parse", "orderByAngleDistance", "OrderLexicographic", "OrderAngleDistance" ];
    Assert.deepEqual(Object.keys(R).filter((Key) => typeof R[Key as keyof typeof R] === "function").sort(), Inventory.sort());
    Assert.ok(!("EulerAngle" in R) && !("EulerAngle" in Root));
    Assert.ok(O.isSome(R.Rotator(0, 0, 0)));
    for (const Invalid of [ NaN, Infinity, -Infinity ])
    {
        Assert.ok(O.isNone(R.Rotator(Invalid, 0, 0)));
        Assert.ok(O.isNone(R.Rotator(0, Invalid, 0)));
        Assert.ok(O.isNone(R.Rotator(0, 0, Invalid)));
    }

    const Unsafe = R.RotatorUnsafe(-0, NaN, Infinity);
    Assert.ok(R.isRotator(Unsafe) && !R.isFinite(Unsafe));
    Assert.ok(Object.is(Unsafe.pitch, -0));
    Assert.ok(Object.isFrozen(Unsafe) && Object.isFrozen(Object.getPrototypeOf(Unsafe)));
    Assert.ok(!R.isRotator(null) && !R.isRotator({ pitch: 0,
        yaw: 0,
        roll: 0 }));
    Assert.throws(() => Object.assign(Unsafe, { pitch: 1 }), TypeError);
});

test("component arithmetic, axis access/update and raw Manhattan distance preserve operand order", () =>
{
    const A = Object.freeze({ pitch: 10,
        yaw: 20,
        roll: 30 });
    const B = Object.freeze({ pitch: 1,
        yaw: 2,
        roll: 3 });
    close(R.add(A, B), r(11, 22, 33));
    close(pipe(A, R.add(B)), r(11, 22, 33));
    close(R.subtract(A, B), r(9, 18, 27));
    close(pipe(A, R.subtract(B)), r(9, 18, 27));
    close(R.scale(A, 2), r(20, 40, 60));
    close(R.scale(2)(A), r(20, 40, 60));
    close(R.negate(A), r(-10, -20, -30));
    Assert.equal(R.getAxis(A, R.Axis.Pitch), 10);
    Assert.equal(R.getAxis(R.Axis.Yaw)(A), 20);
    Assert.equal(R.getAxis(A, R.Axis.Roll), 30);
    close(R.setAxis(A, R.Axis.Pitch, 5), r(5, 20, 30));
    close(pipe(A, R.setAxis(R.Axis.Yaw, 5)), r(10, 5, 30));
    close(R.setAxis(A, R.Axis.Roll, 5), r(10, 20, 5));
    Assert.equal(R.manhattanDistance(A, B), 54);
    Assert.equal(R.manhattanDistance(B)(A), 54);
    Assert.equal(R.scale(r(Number.MAX_VALUE, 0, 0), 2).pitch, Infinity);
    const Mutable = { ...A };
    const Changed = R.setAxis(Mutable, R.Axis.Roll, 1);
    Assert.ok(!Object.isFrozen(Mutable) && Object.isFrozen(Changed));
    Assert.deepEqual(Mutable, A);
    Assert.ok(Object.isFrozen(R.Axis));
});

test("wrapping, normalization, exact/near-zero checks and winding decomposition are explicit", () =>
{
    const A = r(720 + 30, -360 - 20, 540);
    close(R.wrap(A), r(30, 340, 180));
    close(R.clamp(A), R.wrap(A));
    close(R.normalize(A), r(30, -20, -180));
    Assert.equal(R.wrapAxis(-90), 270);
    Assert.equal(R.clampAxis()(450), 90);
    Assert.equal(pipe(-180, R.normalizeAxis), -180);
    Assert.equal(R.normalizeAxis()(180), -180);
    Assert.equal(R.normalizeAxis(-1e-300), -1e-300);
    Assert.equal(R.normalizeAxis(1e-300), 1e-300);
    Assert.ok(!Object.is(R.normalizeAxis(-0), -0));
    Assert.ok(Number.isNaN(R.wrapAxis(Infinity)));
    Assert.ok(Number.isNaN(R.normalize(R.RotatorUnsafe(NaN, 0, 0)).pitch));
    Assert.ok(R.isZero(r(360, -720, 0)));
    Assert.ok(!R.isZero(r(180, 180, 180)) && R.isIdentity(r(180, 180, 180)));
    Assert.ok(R.isNearlyZero(r(360.01, 0, 0), 0.02));
    Assert.ok(pipe(r(0.01, 0, 0), R.isNearlyZero(0.02)));
    Assert.ok(!R.isNearlyZero(R.Zero, -1));
    Assert.ok(R.isNormalized(R.normalize(A)) && !R.isNormalized(A));
    const Parts = O.getOrThrow(R.windingAndRemainder(A));
    Assert.ok(Object.isFrozen(Parts) && Object.isFrozen(Parts.winding) && Object.isFrozen(Parts.remainder));
    close(R.add(Parts.winding, Parts.remainder), A);
    close(Parts.winding, r(720, -360, 720));
    Assert.ok(O.isNone(R.windingAndRemainder(R.RotatorUnsafe(Infinity, 0, 0))));
    Assert.ok(O.isNone(R.windingAndRemainder(r(Number.MAX_VALUE, 0, 0))));
});

test("Minecraft cardinal, pitch and roll signs follow intrinsic yaw/pitch/roll", () =>
{
    vector(R.forward(R.Zero), V.South);
    vector(R.up(R.Zero), V.Up);
    vector(R.right(R.Zero), V.West);
    vector(R.axisX(R.Zero), V.East);
    vector(R.axisY(R.Zero), V.Up);
    vector(R.axisZ(R.Zero), V.South);
    vector(R.forward(r(0, 90, 0)), V.West);
    vector(R.forward(r(0, -90, 0)), V.East);
    vector(R.forward(r(0, 180, 0)), V.North);
    vector(R.forward(r(90, 0, 0)), V.Down);
    vector(R.up(r(0, 0, 90)), V.West);
    const A = r(30, 40, 50);
    const QY = O.getOrThrow(Q.fromAxisAngle(V.UnitY, -40 * Math.PI / 180));
    const QX = O.getOrThrow(Q.fromAxisAngle(V.UnitX, 30 * Math.PI / 180));
    const QZ = O.getOrThrow(Q.fromAxisAngle(V.UnitZ, 50 * Math.PI / 180));
    const Expected = Q.multiply(Q.multiply(QY, QX), QZ);
    Assert.ok(O.getOrThrow(Q.equalsApprox(O.getOrThrow(R.toQuat(A)), Expected, 1e-12)));
    Assert.ok(Object.isFrozen(O.getOrThrow(R.axes(A))));
});

test("Quat/Euler-vector entrypoints use x=pitch,y=yaw,z=roll degrees and round trip", () =>
{
    const Fixtures = [ r(0, 0, 0), r(30, 40, 50), r(-70, 170, -130), r(100, 10, 20), r(-100, 10, 20), r(89.999999, 120, -60), r(-89.999999, -120, 60), r(1e-300, 0, 0) ];
    for (const A of Fixtures)
    {
        const Quat = O.getOrThrow(R.toQuat(A));
        const Recovered = O.getOrThrow(R.fromQuat(Quat));
        Assert.ok(O.getOrThrow(R.equalsApprox(A, Recovered, 1e-9)));
        Assert.ok(Recovered.pitch >= -90 && Recovered.pitch <= 90);
        Assert.ok(Recovered.yaw >= -180 && Recovered.yaw < 180 && Recovered.roll >= -180 && Recovered.roll < 180);
        Assert.ok(Q.equals(Quat, O.getOrThrow(Q.fromRotator(A))));
        close(O.getOrThrow(Q.toRotator(Quat)), Recovered);
        const Euler = R.toEuler(A);
        Assert.deepEqual([ Euler.x, Euler.y, Euler.z ], [ A.pitch, A.yaw, A.roll ]);
        close(O.getOrThrow(R.fromEuler(Euler)), A);
        Assert.ok(Q.equals(Quat, O.getOrThrow(Q.fromEuler(Euler))));
        const QEuler = O.getOrThrow(Q.toEuler(Quat));
        close(O.getOrThrow(R.fromEuler(QEuler)), Recovered);
        const Negative = O.getOrThrow(R.fromQuat(Q.negate(Quat)));
        Assert.ok(O.getOrThrow(R.equalsApprox(Recovered, Negative, 1e-10)));
    }

    const Tiny = O.getOrThrow(R.toQuat(r(-1e-300, 0, 0)));
    Assert.ok(Tiny.x < 0);
    Assert.ok(O.isSome(R.toQuat(r(Number.MAX_VALUE, -Number.MAX_VALUE, Number.MAX_VALUE))));
    close(O.getOrThrow(R.fromQuat(Q.QuatUnsafe(0, 0, 0, -1))), R.Zero);
    Assert.ok(O.isNone(R.fromEuler({ x: NaN,
        y: 0,
        z: 0 })));
});

test("pitch singularities select roll zero and absorb yaw with the correct sign", () =>
{
    close(O.getOrThrow(R.principal(r(90, 30, 20))), r(90, 50, 0));
    close(O.getOrThrow(R.principal(r(-90, 30, 20))), r(-90, 10, 0));
    for (const Pitch of [ 90, -90 ])
    {
        for (const Yaw of [ -170, 0, 100 ])
        {
            for (const Roll of [ -130, 0, 70 ])
            {
                const A = r(Pitch, Yaw, Roll);
                const P = O.getOrThrow(R.principal(A));
                Assert.equal(P.roll, 0);
                Assert.ok(R.equals(A, P));
                Assert.ok(O.getOrThrow(R.equalsApprox(A, P, 1e-10)));
            }
        }
    }
});

test("equivalent, closest and grid-snap utilities preserve their intended representations", () =>
{
    const A = r(100, 10, 20);
    const Alternate = O.getOrThrow(R.equivalent(A));
    close(Alternate, r(80, -170, -160));
    Assert.ok(R.equals(A, Alternate));
    close(O.getOrThrow(R.closest(r(0, 10, 0), r(0, 730, 0))), r(0, 730, 0));
    close(O.getOrThrow(pipe(A, R.closest(r(100, 370, 380)))), r(100, 370, 380));
    close(O.getOrThrow(R.closest(A, r(80, -170, -160))), r(80, -170, -160));
    Assert.ok(O.isNone(R.closest(r(0, 1, 0), r(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE))));
    close(O.getOrThrow(R.gridSnap(r(14, 25, -25), 10)), r(10, 30, -20));
    close(O.getOrThrow(pipe(r(14, 25, -25), R.gridSnap(r(0, 10, 5)))), r(14, 30, -25));
    Assert.ok(O.isNone(R.gridSnap(R.Zero, -1)));
    Assert.ok(O.isNone(R.gridSnap(R.Zero, NaN)));
    close(O.getOrThrow(R.gridSnap(r(1e308, -1e308, 0), Number.MIN_VALUE)), r(1e308, -1e308, 0));
});

test("byte and short encodings wrap nearest boundaries and validate integer codes", () =>
{
    for (const [ Encode, Decode, Steps ] of [ [ R.compressAxisToByte, R.decompressAxisFromByte, 256 ], [ R.compressAxisToShort, R.decompressAxisFromShort, 65536 ] ] as const)
    {
        Assert.equal(O.getOrThrow(Encode(0)), 0);
        Assert.equal(O.getOrThrow(Encode(360)), 0);
        Assert.equal(O.getOrThrow(Encode(180)), Steps / 2);
        Assert.equal(O.getOrThrow(Encode()(-90)), Steps * 3 / 4);
        Assert.equal(O.getOrThrow(pipe(90, Encode)), Steps / 4);
        Assert.equal(O.getOrThrow(Decode()(Steps / 4)), 90);
        Assert.equal(O.getOrThrow(Decode(0)), 0);
        Assert.equal(O.getOrThrow(Encode(360 - 0.1 * 360 / Steps)), 0);
        Assert.equal(O.getOrThrow(Encode(0.5 * 360 / Steps)), 1);
        for (const Bad of [ -1, Steps, 0.5, NaN, Infinity ])
        {
            Assert.ok(O.isNone(Decode(Bad)));
        }

        Assert.ok(O.isNone(Encode(Infinity)));
        Assert.ok(O.isSome(Encode(Number.MAX_VALUE)));
    }
});

test("quaternion composition, inverse and vector queries remain distinct from component operations", () =>
{
    const Parent = r(0, -90, 0);
    const Local = r(90, 0, 0);
    vector(R.rotateVector(O.getOrThrow(R.compose(Parent, Local)), V.UnitY), V.East);
    vector(R.rotateVector(O.getOrThrow(R.compose(Local, Parent)), V.UnitY), V.South);
    Assert.ok(R.equals(O.getOrThrow(pipe(Parent, R.compose(Local))), O.getOrThrow(R.multiply(Parent, Local))));
    const A = r(30, 40, 50);
    const Inverse = O.getOrThrow(R.inverse(A));
    Assert.ok(R.isIdentity(O.getOrThrow(R.compose(A, Inverse))));
    Assert.ok(!R.equals(Inverse, R.negate(A)));
    const Value = Object.freeze({ x: 1,
        y: 2,
        z: 3 });
    vector(R.unrotateVector(A, O.getOrThrow(R.rotateVector(A, Value))), Value);
    vector(pipe(A, R.rotateVector(Value)), O.getOrThrow(R.rotateVector(A, Value)));
    vector(pipe(A, R.unrotateVector(Value)), O.getOrThrow(R.unrotateVector(A, Value)));
    Assert.ok(R.equals(O.getOrThrow(R.compose(r(20, 30, 0), r(40, 50, 0))), R.add(r(20, 30, 0), r(40, 50, 0))) === false);
});

test("spherical interpolation crosses winding and pitch singularities without component lerp artifacts", () =>
{
    const A = r(0, 170, 0);
    const B = r(0, -170, 0);
    const Middle = O.getOrThrow(R.slerp(A, B, 0.5));
    Assert.ok(R.equals(Middle, r(0, -180, 0)));
    Assert.ok(Math.abs(O.getOrThrow(R.angularDistance(A, Middle)) - 10) < 1e-10);
    Assert.ok(R.equals(Middle, O.getOrThrow(pipe(A, R.slerp(B, 0.5)))));
    Assert.ok(R.equals(O.getOrThrow(R.slerp(R.Zero, r(0, 30, 0), 2)), r(0, 60, 0)));
    const PoleMid = O.getOrThrow(R.slerp(r(80, 20, 30), r(100, 20, 30), 0.5));
    Assert.ok(R.equals(PoleMid, r(90, 50, 0)));
    Assert.ok(O.getOrThrow(R.equalsApprox(Middle, r(0, 179.999, 0), 0.01)));
    Assert.ok(O.isNone(R.equalsApprox(A, B, -1)));
});

test("canonical orientation versus raw equality, hashing, JSON and parsing are consistent", () =>
{
    const A = r(20, 30, 40);
    const Variants = [ A, r(380, -330, 760), O.getOrThrow(R.equivalent(A)) ];
    for (const B of Variants)
    {
        Assert.ok(Equal.equals(A, B));
        Assert.equal(Hash.hash(A), Hash.hash(B));
        Assert.equal(R.OrderLexicographic(A, B), 0);
        Assert.equal(R.OrderAngleDistance(A, B), 0);
    }

    Assert.equal(HashSet.size(HashSet.make(...Variants)), 1);
    Assert.equal(HashMap.getUnsafe(HashMap.make([ A, "orientation" ]), Variants[1]), "orientation");
    Assert.ok(!R.equalsComponents(A, Variants[1]));
    Assert.ok(R.equalsComponents(A)(A));
    Assert.ok(!Equal.equals(R.Zero, Q.Identity));
    const Signed = R.RotatorUnsafe(-0, 0, -0);
    Assert.ok(R.equalsComponents(Signed, R.Zero));
    Assert.equal(R.hashComponents(Signed), R.hashComponents(R.Zero));
    const Small = r(0.49e-12 * 2 * 180 / Math.PI, 0, 0);
    const Larger = r(0.51e-12 * 2 * 180 / Math.PI, 0, 0);
    Assert.ok(R.equals(Small, R.Zero) && !R.equals(Larger, R.Zero));
    const Stored = r(370.1234567890123, -720, 30);
    const Parsed = O.getOrThrow(R.parse(Stored.toString()));
    Assert.ok(R.equalsComponents(Stored, Parsed));
    Assert.equal(R.format(Stored), R.toString(Stored));
    Assert.deepEqual(Stored[Inspectable.NodeInspectSymbol](), Stored.toJSON());
    Assert.ok(Object.isFrozen(Stored.toJSON()));
    Assert.deepEqual(JSON.parse(JSON.stringify(Stored)), { _id: "Rotator",
        pitch: Stored.pitch,
        yaw: -720,
        roll: 30 });
    Assert.equal(Stored.pipe((value) => value.yaw), -720);
    for (const Bad of [ "", "Rotator(1x,2,3)", "Rotator(NaN,0,0)", "Rotator(1,2)", "1,2,3" ])
    {
        Assert.ok(O.isNone(R.fromString(Bad)));
    }
});

test("both total orders agree with equality and canonical key ties, including invalid fallbacks", () =>
{
    const Samples = [ R.Zero, r(20, 30, 40), r(380, -330, 760), r(90, 10, 20), r(90, 30, 0),
        r(0, 90, 0), r(0, 0, 90), r(180, 180, 180),
        R.RotatorUnsafe(NaN, 0, 0), R.RotatorUnsafe(NaN, -0, 0),
        R.RotatorUnsafe(-Infinity, 0, 0), R.RotatorUnsafe(Infinity, 0, 0) ];
    const Reference = { pitch: 30,
        yaw: 40,
        roll: 50 };
    const RefOrder = O.getOrThrow(R.orderByAngleDistance(Reference));
    const Before = RefOrder(Samples[0], Samples[1]);
    Reference.pitch = 120;
    Assert.equal(RefOrder(Samples[0], Samples[1]), Before);
    for (const Compare of [ R.OrderLexicographic, R.OrderAngleDistance, RefOrder ])
    {
        for (const A of Samples)
        {
            Assert.equal(Compare(A, A), 0);
            Assert.ok(Equal.equals(A, A));
            for (const B of Samples)
            {
                Assert.equal(Compare(A, B) + Compare(B, A), 0);
                Assert.equal(Compare(A, B) === 0, Equal.equals(A, B));
                if (Equal.equals(A, B))
                {
                    Assert.equal(Hash.hash(A), Hash.hash(B));
                }

                for (const C of Samples)
                {
                    if (Compare(A, B) <= 0 && Compare(B, C) <= 0)
                    {
                        Assert.ok(Compare(A, C) <= 0);
                    }
                }
            }
        }
    }

    const Numeric = [ -Infinity, -1, -0, 0, 1, Infinity, NaN ];
    const Invalid = Numeric.map((pitch) => R.RotatorUnsafe(pitch, NaN, 0));
    Assert.deepEqual([ ...Invalid ].reverse().sort(R.OrderLexicographic).map((value) => value.pitch === 0 ? 0 : value.pitch),
        Numeric.map((value) => value === 0 ? 0 : value));
    Assert.ok(R.OrderLexicographic(R.Zero, Invalid[0]) < 0);
    Assert.equal(HashSet.size(HashSet.make(Samples[8], Samples[9])), 1);
});

test("partial orientation operations reject nonfinite fields and invalid quaternion inputs", () =>
{
    const Bad = R.RotatorUnsafe(Infinity, NaN, 0);
    Assert.ok(O.isNone(R.toQuat(Bad)));
    Assert.ok(O.isNone(R.principal(Bad)) && O.isNone(R.equivalent(Bad)));
    Assert.ok(O.isNone(R.inverse(Bad)) && O.isNone(R.compose(Bad, R.Zero)));
    Assert.ok(O.isNone(R.rotateVector(Bad, V.One)) && O.isNone(R.unrotateVector(Bad, V.One)));
    Assert.ok(O.isNone(R.angularDistance(Bad, R.Zero)));
    Assert.ok(O.isNone(R.slerp(R.Zero, R.Zero, NaN)));
    Assert.ok(O.isNone(R.orderByAngleDistance(Bad)));
    Assert.ok(O.isNone(R.fromQuat(Q.QuatUnsafe(0, 0, 0, 0))));
    Assert.ok(O.isNone(Q.toEuler(Q.QuatUnsafe(NaN, 0, 0, 1))));
    Assert.ok(O.isNone(Q.fromRotator(Bad)));
});

test("fresh Quat-first and Rotator-first module imports have no cyclic initialization hazards", () =>
{
    for (const First of [ "Quat", "Rotator" ])
    {
        const Script = `const first = await import("bedform/" + ${JSON.stringify(First)});
            if (${JSON.stringify(First)} === "Quat" && first.toRotator(first.Identity)._tag !== "Some") {
                throw new Error("Quat-only conversion failed");
            }
            const Q = await import("bedform/Quat");
            const R = await import("bedform/Rotator");
            const value = Q.toRotator(Q.Identity).value;
            if (!R.isRotator(value) || !R.isIdentity(value) || R.toQuat(value)._tag !== "Some") {
                throw new Error("cross-entrypoint conversion failed");
            }
            if ("EulerAngle" in R || "Quaternion" in Q) throw new Error("runtime alias");`;
        execFileSync(process.execPath, [ "--input-type=module", "-e", Script ],
            { cwd: fileURLToPath(new URL("..", import.meta.url)),
                encoding: "utf8" });
    }
});
