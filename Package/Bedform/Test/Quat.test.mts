/**
 * Quat core families, canonical protocols and total-order laws.
 *
 * @module bedform/Test/Quat.test
 *
 * @file      Quat.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Test matrices and numeric fixtures retain deliberate ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as Root from "bedform";
import * as Option from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashMap from "@bedform/effect/HashMap";
import * as HashSet from "@bedform/effect/HashSet";
import * as Inspectable from "@bedform/effect/Inspectable";
import { pipe } from "@bedform/effect/Function";

/**
 * Compares finite numeric components with an independent error bound.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: ReadonlyArray<number>, expected: ReadonlyArray<number>, tolerance = 1e-12): void =>
{
    Assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => Assert.ok(Math.abs(value - expected[index]) <= tolerance, `${value} != ${expected[index]}`));
};

/**
 * Reads a vector result for independent coordinate assertions.
 *
 * @category Tests
 * @since 1.0.0
 */
const vector = (value: Option.Option<V.Vector3>): ReadonlyArray<number> =>
{
    const Result = Option.getOrThrow(value);
    Assert.ok(Object.isFrozen(Result));
    return [ Result.x, Result.y, Result.z ];
};

/**
 * Reads raw quaternion fields without canonicalizing them.
 *
 * @category Tests
 * @since 1.0.0
 */
const raw = (value: Q.Coordinates): ReadonlyArray<number> =>
{
    return [ value.x, value.y, value.z, value.w ];
};

/**
 * Constructs a fixture orientation from radians and a coordinate axis.
 *
 * @category Tests
 * @since 1.0.0
 */
const axis = (value: V.Coordinates, angle: number): Q.Quat =>
{
    return Option.getOrThrow(Q.fromAxisAngle(value, angle));
};

test("Quat core inventory, construction and raw immutability", () =>
{
    Assert.strictEqual(Root.Quat, Q);
    const Inventory = [ "Quat", "QuatUnsafe", "canonicalKey", "isQuat", "isFinite", "normalize", "magnitude", "magnitudeSquared", "add", "subtract", "scale", "divide", "dot", "multiply", "conjugate", "negate", "inverse", "equalsComponents", "hashComponents", "equals", "angularDistance", "error", "errorAngle", "equalsApprox", "isNormalized", "isIdentity", "alignShortestArc", "toAxisAngle", "fromAxisAngle", "toRotationVector", "fromRotationVector", "fromVectors", "fromUnitNormals", "rotateVector", "unrotateVector", "axisX", "axisY", "axisZ", "forward", "up", "right", "axes", "toMatrix", "fromMatrix", "format", "toString", "fromString", "parse", "orderByAngleDistance", "OrderLexicographic", "OrderAngleDistance", "fastLerp", "fastBilerp", "slerp", "slerpUnnormalized", "slerpFullPath", "slerpFullPathUnnormalized", "squad", "squadFullPath", "log", "exp", "calculateTangent", "toSwingTwist", "twistAngle", "errorAutoNormalize", "fromRotator", "toRotator", "fromEuler", "toEuler" ];
    Assert.deepEqual(Object.keys(Q).filter((name) => typeof Q[name as keyof typeof Q] === "function").sort(), Inventory.sort());
    Assert.ok(!("Quaternion" in Q) && !("Quaternion" in Root) && !("EulerAngle" in Root));
    for (const Value of [ NaN, Infinity, -Infinity ])
    {
        for (let Index = 0; Index < 4; Index++)
        {
            const Fields = [ 1, 1, 1, 1 ];
            Fields[Index] = Value;
            Assert.ok(Option.isNone(Q.Quat(Fields[0], Fields[1], Fields[2], Fields[3])));
        }
    }

    Assert.ok(Option.isNone(Q.Quat(0, -0, 0, 0)));
    const Stored = Option.getOrThrow(Q.Quat(-0, 2, 3, -4));
    Assert.ok(Object.is(Stored.x, -0));
    Assert.ok(Object.isFrozen(Stored) && Object.isFrozen(Object.getPrototypeOf(Stored)));
    Assert.ok(Q.isQuat(Q.QuatUnsafe(NaN, 0, 0, 0)));
    Assert.ok(!Q.isQuat(null) && !Q.isQuat({ x: 0,
        y: 0,
        z: 0,
        w: 1 }));
    Assert.ok(!Q.isQuat(V.Zero));
    Assert.throws(() => Object.assign(Stored, { x: 5 }), TypeError);
    Assert.ok(Q.isFinite(Q.QuatUnsafe(0, 0, 0, 0)));
});

test("raw algebra preserves operand order and magnitude in both dual forms", () =>
{
    const A = Object.freeze({ x: 1,
        y: 2,
        z: 3,
        w: 4 });
    const B = Object.freeze({ x: 5,
        y: 6,
        z: 7,
        w: 8 });
    close(raw(Q.add(A, B)), [ 6, 8, 10, 12 ]);
    close(raw(Q.subtract(A, B)), [ -4, -4, -4, -4 ]);
    close(raw(pipe(A, Q.subtract(B))), [ -4, -4, -4, -4 ]);
    close(raw(Q.scale(2)(A)), [ 2, 4, 6, 8 ]);
    close(raw(Q.divide(A, 2)), [ 0.5, 1, 1.5, 2 ]);
    close(raw(Q.divide(2)(A)), raw(Q.divide(A, 2)));
    close(raw(Q.conjugate(A)), [ -1, -2, -3, 4 ]);
    close(raw(Q.negate(A)), [ -1, -2, -3, -4 ]);
    close(raw(Q.multiply(A, B)), [ 24, 48, 48, -6 ]);
    close(raw(Q.multiply(B)(A)), raw(Q.multiply(A, B)));
    Assert.ok(!Q.equalsComponents(Q.multiply(A, B), Q.multiply(B, A)));
    Assert.equal(Q.dot(A, B), 70);
    Assert.equal(Q.dot(B)(A), 70);
    Assert.equal(Q.magnitudeSquared(A), 30);
    Assert.ok(Math.abs(Q.magnitude(A) - Math.sqrt(30)) < 1e-14);
    Assert.equal(Q.divide(A, 0).x, Infinity);
    Assert.ok(Number.isNaN(Q.divide(Q.Identity, 0).x));
    Assert.equal(Q.scale(Q.QuatUnsafe(Number.MAX_VALUE, 0, 0, 1), 2).x, Infinity);
    const Mutable = { ...A };
    const Result = Q.add(Mutable, B);
    Assert.deepEqual(Mutable, A);
    Assert.ok(!Object.isFrozen(Mutable) && Object.isFrozen(Result));
});

test("stable normalization and algebraic inverse span extreme finite magnitudes", () =>
{
    for (const Size of [ Number.MAX_VALUE, 1e308, 1e-300, Number.MIN_VALUE ])
    {
        const Value = Q.QuatUnsafe(Size, Size, Size, Size);
        close(raw(Option.getOrThrow(Q.normalize(Value))), [ 0.5, 0.5, 0.5, 0.5 ]);
    }

    for (const Size of [ 1e308, 1, 1e-300 ])
    {
        const Value = Q.QuatUnsafe(Size, Size / 2, -Size / 4, Size / 8);
        const Inverse = Option.getOrThrow(Q.inverse(Value));
        close(raw(Q.multiply(Value, Inverse)), [ 0, 0, 0, 1 ], 1e-12);
    }

    Assert.ok(Option.isNone(Q.inverse(Q.QuatUnsafe(Number.MIN_VALUE, 0, 0, 0))));
    for (const Bad of [ Q.QuatUnsafe(0, 0, 0, 0), Q.QuatUnsafe(NaN, 0, 0, 1), Q.QuatUnsafe(Infinity, 0, 0, 1) ])
    {
        Assert.ok(Option.isNone(Q.normalize(Bad)) && Option.isNone(Q.inverse(Bad)));
        Assert.ok(Option.isNone(Q.rotateVector(Bad, V.One)));
        Assert.ok(Option.isNone(Q.toAxisAngle(Bad)) && Option.isNone(Q.toMatrix(Bad)));
        Assert.ok(Option.isNone(Q.angularDistance(Bad, Q.Identity)));
        Assert.ok(Option.isNone(Q.orderByAngleDistance(Bad)));
        Assert.ok(!Q.isIdentity(Bad) && !Q.isNormalized(Bad));
    }

    Assert.ok(Q.isNormalized(Option.getOrThrow(Q.normalize(Q.QuatUnsafe(1, 2, 3, 4)))));
    Assert.ok(!Q.isNormalized(Q.scale(Q.Identity, 2)));
    Assert.ok(Q.isNormalized(0)(Q.Identity));
    Assert.ok(!Q.isNormalized(Q.Identity, NaN));
});

test("right-to-left noncommuting local/world composition and Minecraft signs", () =>
{
    const Parent = axis(V.UnitY, Math.PI / 2);
    const Local = axis(V.UnitX, Math.PI / 2);
    vector(Q.rotateVector(Parent, V.Zero));
    close(vector(Q.rotateVector(Q.multiply(Parent, Local), V.UnitY)), [ 1, 0, 0 ]);
    close(vector(Q.rotateVector(Q.multiply(Local, Parent), V.UnitY)), [ 0, 0, 1 ]);
    close(vector(pipe(Q.multiply(Parent, Local), Q.rotateVector(V.UnitY))), [ 1, 0, 0 ]);
    close(vector(Q.forward(axis(V.UnitY, -Math.PI / 2))), [ -1, 0, 0 ]);
    close(vector(Q.forward(axis(V.UnitX, Math.PI / 2))), [ 0, -1, 0 ]);
    close(vector(Q.up(axis(V.UnitZ, Math.PI / 2))), [ -1, 0, 0 ]);
    close(vector(Q.right(Q.Identity)), [ -1, 0, 0 ]);
    close(vector(Q.axisX(Q.Identity)), [ 1, 0, 0 ]);
    close(vector(Q.axisY(Q.Identity)), [ 0, 1, 0 ]);
    close(vector(Q.axisZ(Q.Identity)), [ 0, 0, 1 ]);
    const Axes = Option.getOrThrow(Q.axes(Parent));
    Assert.ok(Object.isFrozen(Axes));
    close([ Axes.z.x, Axes.z.y, Axes.z.z ], [ 1, 0, 0 ]);
    const Mixed = Q.multiply(Parent, Local);
    const Value = Object.freeze({ x: 4,
        y: -2,
        z: 7 });
    close(vector(Q.unrotateVector(Mixed, Option.getOrThrow(Q.rotateVector(Mixed, Value)))), [ 4, -2, 7 ]);
    close(vector(Q.rotateVector(Q.scale(Mixed, -1e308), Value)), vector(Q.rotateVector(Mixed, Value)));
    close(vector(Q.unrotateVector(Value)(Mixed)), vector(Q.unrotateVector(Mixed, Value)));
    Assert.ok(Option.isNone(Q.rotateVector(Mixed, { x: NaN,
        y: 0,
        z: 0 })));
    const Huge = Option.getOrThrow(Q.rotateVector(Parent, { x: 1e308,
        y: 0,
        z: 0 }));
    Assert.ok(Number.isFinite(Huge.z) && Math.abs(Huge.z / 1e308 + 1) < 1e-12);
});

test("axis-angle, rotation-vector and proper homogeneous matrix conversions round trip", () =>
{
    const Inputs = [ Q.Identity, axis(V.UnitX, Math.PI), axis(V.UnitY, Math.PI), axis(V.UnitZ, Math.PI), axis({ x: 2,
        y: -3,
        z: 4 }, 2.9), axis(V.UnitX, 1e-13) ];
    for (const Input of Inputs)
    {
        const AxisAngle = Option.getOrThrow(Q.toAxisAngle(Input));
        Assert.ok(Object.isFrozen(AxisAngle));
        Assert.ok(Option.getOrThrow(Q.equalsApprox(Input, Option.getOrThrow(Q.fromAxisAngle(AxisAngle.axis, AxisAngle.angle)), 1e-12)));
        const RotationVector = Option.getOrThrow(Q.toRotationVector(Input));
        Assert.ok(Option.getOrThrow(Q.equalsApprox(Input, Option.getOrThrow(Q.fromRotationVector(RotationVector)), 1e-12)));
        const Matrix = Option.getOrThrow(Q.toMatrix(Input));
        Assert.ok(Object.isFrozen(Matrix));
        Assert.deepEqual([ Matrix[3], Matrix[7], Matrix[11], Matrix[12], Matrix[13], Matrix[14], Matrix[15] ], [ 0, 0, 0, 0, 0, 0, 1 ]);
        const Recovered = Option.getOrThrow(Q.fromMatrix(Matrix));
        Assert.ok(Option.getOrThrow(Q.equalsApprox(Input, Recovered, 1e-12)));
        const Applied = [ Matrix[0] + 2 * Matrix[1] + 3 * Matrix[2], Matrix[4] + 2 * Matrix[5] + 3 * Matrix[6], Matrix[8] + 2 * Matrix[9] + 3 * Matrix[10] ];
        close(vector(Q.rotateVector(Input, { x: 1,
            y: 2,
            z: 3 })), Applied);
    }

    close(vector(Q.toRotationVector(Q.Identity)), [ 0, 0, 0 ]);
    Assert.ok(Q.isIdentity(Option.getOrThrow(Q.fromRotationVector(V.Zero))));
    Assert.ok(Q.isIdentity(Option.getOrThrow(Q.fromAxisAngle(0)(V.UnitX))));
    Assert.ok(Option.isNone(Q.fromAxisAngle(V.Zero, 0)));
    Assert.ok(Option.isNone(Q.fromAxisAngle(V.UnitX, Infinity)));
    Assert.ok(Option.isNone(Q.fromRotationVector({ x: Infinity,
        y: 0,
        z: 0 })));
    const IdentityMatrix = Option.getOrThrow(Q.toMatrix(Q.Identity));
    for (const [ Index, Value ] of [ [ 0, 2 ], [ 0, -1 ], [ 1, 0.2 ], [ 3, 1 ], [ 12, 1 ], [ 15, 0 ], [ 5, NaN ], [ 6, Infinity ] ])
    {
        const Bad = [ ...IdentityMatrix ];
        Bad[Index] = Value;
        Assert.ok(Option.isNone(Q.fromMatrix(Bad as unknown as Q.Matrix4)));
        Assert.ok(!Object.isFrozen(Bad));
    }

    Assert.ok(Option.isNone(Q.fromMatrix([] as unknown as Q.Matrix4)));
});

test("shortest vector rotations, normalized-normal validation and sign alignment", () =>
{
    for (const Target of [ V.UnitX, V.West, V.UnitY, { x: -1,
        y: 1e-10,
        z: 0 }, { x: 1,
        y: 1e-300,
        z: 0 } ])
    {
        const Rotation = Option.getOrThrow(Q.fromVectors(V.UnitX, Target));
        const Expected = Option.getOrThrow(V.normalize(Target));
        close(vector(Q.rotateVector(Rotation, V.UnitX)), [ Expected.x, Expected.y, Expected.z ]);
        Assert.ok(Q.equals(Rotation, Option.getOrThrow(Q.fromVectors(Target)(V.UnitX))));
    }

    Assert.ok(Option.isSome(Q.fromVectors({ x: 1e308,
        y: 0,
        z: 0 }, { x: 0,
        y: Number.MIN_VALUE,
        z: 0 })));
    Assert.ok(Option.isNone(Q.fromVectors(V.Zero, V.UnitX)));
    Assert.ok(Option.isNone(Q.fromVectors(V.UnitX, { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(Option.isSome(Q.fromUnitNormals(V.UnitX, V.UnitY)));
    Assert.ok(Option.isSome(Q.fromUnitNormals(V.UnitY)(V.UnitX)));
    Assert.ok(Option.isNone(Q.fromUnitNormals({ x: 2,
        y: 0,
        z: 0 }, V.UnitY)));
    const A = Q.scale(axis(V.UnitY, 0.75), -3);
    const Aligned = Option.getOrThrow(Q.alignShortestArc(A, Q.Identity));
    close(raw(Aligned), raw(Q.negate(A)));
    close(raw(Option.getOrThrow(Q.alignShortestArc(Q.Identity)(A))), raw(Aligned));
    close(raw(A), raw(Q.negate(Aligned)));
    Assert.ok(Option.isNone(Q.alignShortestArc(Q.Identity, Q.QuatUnsafe(0, 0, 0, 0))));
});

test("angles, errors and explicit fuzzy comparisons stay separate from canonical equality", () =>
{
    const Half = axis(V.UnitX, Math.PI);
    Assert.ok(Math.abs(Option.getOrThrow(Q.angularDistance(Q.Identity, Half)) - Math.PI) < 1e-14);
    Assert.ok(Math.abs(Option.getOrThrow(Q.angularDistance(Half)(Q.Identity)) - Math.PI) < 1e-14);
    Assert.ok(Math.abs(Option.getOrThrow(Q.errorAngle(Half)(Q.Identity)) - 1) < 1e-14);
    Assert.ok(Math.abs(Option.getOrThrow(Q.error(Q.Identity, Half)) - 1) < 1e-14);
    Assert.equal(Option.getOrThrow(Q.errorAngle(Q.Identity, Q.negate(Q.Identity))), 0);
    Assert.equal(Option.getOrThrow(Q.error(Q.Identity)(Q.Identity)), 0);
    Assert.ok(Q.isIdentity(Q.negate(Q.Identity)) && Q.isIdentity()(Q.Identity));
    Assert.ok(!Q.isIdentity(Q.Identity, -1));
    Assert.ok(Option.isNone(Q.equalsApprox(Q.Identity, Half, -1)));
    Assert.ok(Option.getOrThrow(pipe(Q.Identity, Q.equalsApprox(axis(V.UnitX, 1e-4), 1e-3))));
    Assert.ok(!Q.equals(Q.Identity, axis(V.UnitX, 1e-4)));
    Assert.ok(Option.getOrThrow(Q.angularDistance(Q.Identity, axis(V.UnitX, 1e-13))) > 0);
});

test("canonical protocols quantize normalized keys, preserve raw fields and handle sign ties", () =>
{
    const A = axis({ x: 1,
        y: 2,
        z: 3 }, 1.25);
    for (const B of [ A, Q.negate(A), Q.scale(A, 7), Q.scale(A, -1e300) ])
    {
        Assert.ok(Equal.equals(A, B));
        Assert.equal(Hash.hash(A), Hash.hash(B));
        Assert.equal(Q.OrderLexicographic(A, B), 0);
        Assert.equal(Q.OrderAngleDistance(A, B), 0);
    }

    Assert.ok(!Q.equalsComponents(A, Q.negate(A)));
    Assert.ok(Q.equalsComponents(A)(A));
    const ZeroSigns = Q.QuatUnsafe(-0, 0, -0, 1);
    Assert.ok(Q.equalsComponents(ZeroSigns, Q.Identity));
    Assert.equal(Q.hashComponents(ZeroSigns), Q.hashComponents(Q.Identity));
    const Half = Q.QuatUnsafe(-1, 0, 0, 1e-14);
    Assert.deepEqual(Option.getOrThrow(Q.canonicalKey(Half)), [ 1, 0, 0, 0 ]);
    Assert.deepEqual(Option.getOrThrow(Q.canonicalKey(Q.QuatUnsafe(0, -1, 0, -0))), [ 0, 1, 0, 0 ]);
    Assert.deepEqual(Option.getOrThrow(Q.canonicalKey(Q.QuatUnsafe(0, 0, -1, 0))), [ 0, 0, 1, 0 ]);
    const Key = Option.getOrThrow(Q.canonicalKey(ZeroSigns));
    Assert.ok(Object.isFrozen(Key) && !Key.some((value) => Object.is(value, -0)));
    Assert.ok(Q.equals(Q.QuatUnsafe(0.49e-12, 0, 0, 1), Q.Identity));
    Assert.ok(!Q.equals(Q.QuatUnsafe(0.51e-12, 0, 0, 1), Q.Identity));
    Assert.ok(Object.is(Half.w, 1e-14) && Half.x === -1);
    Assert.equal(HashSet.size(HashSet.make(A, Q.negate(A), Q.scale(A, 7))), 1);
    Assert.equal(HashMap.getUnsafe(HashMap.make([ A, "orientation" ]), Q.negate(A)), "orientation");
    Assert.ok(!Equal.equals(Q.Identity, V.Zero));
});

test("total orders are reflexive, antisymmetric, transitive and agree with equality for invalid values", () =>
{
    const Samples = [ Q.Identity, axis(V.UnitX, 0.5), axis(V.UnitY, 0.5), axis(V.UnitZ, 0.5), Q.QuatUnsafe(-1, 0, 0, 0), Q.QuatUnsafe(1, 0, 0, 0), Q.QuatUnsafe(0, 0, 0, 0), Q.QuatUnsafe(NaN, 0, 0, 0), Q.QuatUnsafe(Infinity, 0, 0, 0), Q.QuatUnsafe(-Infinity, 0, 0, 0), Q.QuatUnsafe(-0, 0, 0, 0) ];
    Samples.push(Q.negate(Samples[1]), Q.scale(Samples[2], 5));
    const ReferenceOrder = Option.getOrThrow(Q.orderByAngleDistance(axis(V.UnitY, 1)));
    for (const Compare of [ Q.OrderLexicographic, Q.OrderAngleDistance, ReferenceOrder ])
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

    const Numbers = [ -Infinity, -2, -0, 0, 2, Infinity, NaN ];
    const RawInvalid = Numbers.map((x) => Q.QuatUnsafe(x, 0, 0, NaN));
    Assert.deepEqual([ ...RawInvalid ].reverse().sort(Q.OrderLexicographic).map((value) => value.x === 0 ? 0 : value.x), Numbers.map((value) => value === 0 ? 0 : value));
    Assert.ok(Q.OrderLexicographic(Q.Identity, RawInvalid[0]) < 0);
    Assert.equal(HashSet.size(HashSet.make(Q.QuatUnsafe(NaN, 0, 0, 0), Q.QuatUnsafe(NaN, -0, 0, 0))), 1);
});

test("formatting, inspection, full precision JSON, and default parser round trip", () =>
{
    const A = Q.QuatUnsafe(-1.123456789012345, 2, -3, 4);
    Assert.equal(A.pipe((value) => value.w), 4);
    Assert.equal(Q.toString(A), Q.format(A));
    const B = Option.getOrThrow(Q.parse(A.toString()));
    Assert.ok(Q.equalsComponents(A, B));
    Assert.deepEqual(A[Inspectable.NodeInspectSymbol](), A.toJSON());
    Assert.ok(Object.isFrozen(A.toJSON()));
    Assert.deepEqual(JSON.parse(JSON.stringify(A)), { _id: "Quat",
        x: -1.123456789012345,
        y: 2,
        z: -3,
        w: 4 });
    for (const Text of [ "", "Quat(0,0,0,0)", "Quat(NaN,0,0,1)", "Quat(1x,0,0,1)", "Quat(1,2,3)", "1,2,3,4" ])
    {
        Assert.ok(Option.isNone(Q.fromString(Text)), Text);
    }
});
