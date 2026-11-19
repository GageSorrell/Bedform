/**
 * Rigid pose construction, independent frame/matrix fixtures and value protocols.
 *
 * @module bedform/Test/Transform.test
 *
 * @file      Transform.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and deliberate coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as T from "bedform/Transform";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as O from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashMap from "@bedform/effect/HashMap";
import * as HashSet from "@bedform/effect/HashSet";
import * as Inspectable from "@bedform/effect/Inspectable";
import { pipe } from "@bedform/effect/Function";

/**
 * Compares finite vector components using explicit absolute and relative numerical tolerance.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: V.Coordinates, expected: V.Coordinates, tolerance = 1e-11): void =>
{
    for (const Key of [ "x", "y", "z" ] as const)
    {
        Assert.ok(Math.abs(actual[Key] - expected[Key]) <= tolerance * Math.max(1, Math.abs(expected[Key])),
            `${Key}: ${actual[Key]} != ${expected[Key]}`);
    }
};

/**
 * Builds a validated pose from explicit position and orientation fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const pose = (position: V.Coordinates, rotation: Q.Coordinates = Q.Identity): T.Transform =>
{
    return O.getOrThrow(T.Transform(position, rotation));
};

/**
 * Compares normalized geometric orientation rather than rounded canonical keys.
 *
 * @category Tests
 * @since 1.0.0
 */
const samePose = (actual: T.Coordinates, expected: T.Coordinates): void =>
{
    close(actual.position, expected.position);
    Assert.equal(O.getOrThrow(Q.equalsApprox(actual.rotation, expected.rotation, 1e-10)), true);
};

/**
 * Independent row-major matrix multiplication used to check composition order.
 *
 * @category Tests
 * @since 1.0.0
 */
const matrixProduct = (a: T.Matrix4, b: T.Matrix4): Array<number> =>
{
    return Array.from({ length: 16 }, (_, i) =>
        Array.from({ length: 4 }, (_unused, j) => a[Math.floor(i / 4) * 4 + j] * b[j * 4 + i % 4])
            .reduce((x, y) => x + y, 0));
};

test("Transform public operation inventory and root/subpath identity are complete", () =>
{
    Assert.equal(Root.Transform, T);
    Assert.deepEqual(Object.keys(T).filter((key) => typeof T[key as keyof typeof T] === "function").sort(), [
        "Transform", "TransformUnsafe", "compose", "equals", "format", "fromMatrix", "fromString", "interpolate",
        "inverse", "isTransform", "isValid", "lerp", "parse", "toMatrix", "toString", "transformDirection",
        "transformPoint", "untransformDirection", "untransformPoint"
    ].sort());
    Assert.equal(T.lerp, T.interpolate);
    Assert.equal(T.parse, T.fromString);
    Assert.equal(T.toString, T.format);
});

test("Transform constructors deep-copy/freeze nested values and normalize only validated orientations", () =>
{
    const Position = { x: 1,
        y: -2,
        z: 3 };
    const Rotation = { x: 0,
        y: 0,
        z: 0,
        w: 4 };
    const A = pose(Position, Rotation);
    const B = T.TransformUnsafe(Position, Rotation);
    Assert.equal(A.rotation.w, 1);
    Assert.equal(B.rotation.w, 4);
    Assert.notEqual(A.position, Position);
    Assert.notEqual(B.rotation, Rotation);
    Assert.equal(Object.isFrozen(Position), false);
    Assert.equal(Object.isFrozen(Rotation), false);
    Position.x = 99;
    Rotation.w = 0;
    Assert.equal(A.position.x, 1);
    Assert.equal(B.rotation.w, 4);
    for (const Value of [ A, B, T.Identity ])
    {
        Assert.ok(Object.isFrozen(Value) && Object.isFrozen(Value.position) && Object.isFrozen(Value.rotation));
        Assert.ok(T.isTransform(Value));
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(B));
    Assert.ok(T.isValid(B));
    Assert.equal(T.isTransform({ position: V.Zero,
        rotation: Q.Identity }), false);
    Assert.equal(T.isTransform(null), false);
    for (const Magnitude of [ 1e308, 1e-308, Number.MIN_VALUE ])
    {
        const Value = pose(V.Zero, { x: Magnitude,
            y: 0,
            z: 0,
            w: Magnitude });
        Assert.ok(Q.isNormalized(Value.rotation));
    }
});

test("Transform point and direction fixtures distinguish translation and facing from coordinate axes", () =>
{
    // Positive Minecraft yaw sends +Z toward -X.
    const A = pose({ x: 10,
        y: 20,
        z: 30 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })));
    close(O.getOrThrow(T.transformPoint(A, { x: 0,
        y: 0,
        z: 2 })), { x: 8,
        y: 20,
        z: 30 });
    close(O.getOrThrow(pipe(A, T.transformDirection({ x: 0,
        y: 0,
        z: 2 }))), { x: -2,
        y: 0,
        z: 0 });
    close(O.getOrThrow(T.untransformPoint(A, { x: 8,
        y: 20,
        z: 30 })), { x: 0,
        y: 0,
        z: 2 });
    close(O.getOrThrow(pipe(A, T.untransformDirection({ x: -2,
        y: 0,
        z: 0 }))), { x: 0,
        y: 0,
        z: 2 });
    close(O.getOrThrow(T.transformDirection(A, V.Zero)), V.Zero);
    close(O.getOrThrow(T.untransformDirection(A, V.Zero)), V.Zero);
});

test("Transform composition applies the second pose first and distinguishes local/world updates", () =>
{
    const A = pose({ x: 10,
        y: 0,
        z: 0 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })));
    const B = pose({ x: 0,
        y: 0,
        z: 2 }, O.getOrThrow(Q.fromEuler({ x: 90,
        y: 0,
        z: 0 })));
    const AB = O.getOrThrow(T.compose(A, B));
    const BA = O.getOrThrow(pipe(B, T.compose(A)));
    close(AB.position, { x: 8,
        y: 0,
        z: 0 });
    close(BA.position, { x: 10,
        y: 0,
        z: 2 });
    close(O.getOrThrow(T.transformDirection(AB, V.UnitZ)), { x: 0,
        y: -1,
        z: 0 });
    close(O.getOrThrow(T.transformDirection(BA, V.UnitZ)), { x: -1,
        y: 0,
        z: 0 });
    const Point = { x: 3,
        y: -7,
        z: 5 };
    close(O.getOrThrow(T.transformPoint(AB, Point)), O.getOrThrow(T.transformPoint(A, O.getOrThrow(T.transformPoint(B, Point)))));
    samePose(O.getOrThrow(pipe(A, T.compose(B))), AB);
    Assert.ok(!T.equals(AB, BA));
});

test("Transform inverses and structural unsafe scaled orientations preserve frame round trips", () =>
{
    for (let i = 0; i < 30; i++)
    {
        const A = pose({ x: i - 4,
            y: i * 3,
            z: 2 - i }, O.getOrThrow(Q.fromEuler({ x: i * 7,
            y: i * 17,
            z: i * 11 })));
        const Raw = { position: A.position,
            rotation: Q.scale(A.rotation, i % 2 ? 1e308 : -1e-308) };
        const Inverse = O.getOrThrow(T.inverse(Raw));
        samePose(O.getOrThrow(T.compose(Raw, Inverse)), T.Identity);
        samePose(O.getOrThrow(T.compose(Inverse, Raw)), T.Identity);
        const Point = { x: i / 2,
            y: -i,
            z: 3 };
        close(O.getOrThrow(T.untransformPoint(Raw, O.getOrThrow(T.transformPoint(Raw, Point)))), Point);
        close(O.getOrThrow(T.untransformDirection(Raw, O.getOrThrow(T.transformDirection(Raw, Point)))), Point);
    }
});

test("Transform matrices use row-major translation and agree with independent matrix composition", () =>
{
    const A = pose({ x: 3,
        y: 4,
        z: 5 }, Q.Identity);
    Assert.deepEqual(O.getOrThrow(T.toMatrix(A)), [ 1, 0, 0, 3, 0, 1, 0, 4, 0, 0, 1, 5, 0, 0, 0, 1 ]);
    for (let i = 0; i < 20; i++)
    {
        const B = pose({ x: i,
            y: -i,
            z: 4 }, O.getOrThrow(Q.fromEuler({ x: i * 17,
            y: i * -13,
            z: i * 7 })));
        const C = pose({ x: -3,
            y: i,
            z: 6 }, O.getOrThrow(Q.fromEuler({ x: 33,
            y: 12,
            z: -53 })));
        const M = O.getOrThrow(T.toMatrix(B));
        Assert.ok(Object.isFrozen(M));
        samePose(O.getOrThrow(T.fromMatrix(M)), B);
        const Product = matrixProduct(M, O.getOrThrow(T.toMatrix(C)));
        const Composed = O.getOrThrow(T.toMatrix(O.getOrThrow(T.compose(B, C))));
        Product.forEach((value, j) => Assert.ok(Math.abs(value - Composed[j]) < 1e-10));
        const Point = { x: 2,
            y: -4,
            z: 9 };
        close(O.getOrThrow(T.transformPoint(B, Point)), {
            x: M[0] * Point.x + M[1] * Point.y + M[2] * Point.z + M[3],
            y: M[4] * Point.x + M[5] * Point.y + M[6] * Point.z + M[7],
            z: M[8] * Point.x + M[9] * Point.y + M[10] * Point.z + M[11]
        });
    }
});

test("Transform matrix construction rejects scale, reflection, shear, perspective and invalid entries", () =>
{
    const Identity = O.getOrThrow(T.toMatrix(T.Identity));
    for (const [ Index, Value ] of [ [ 0, 2 ], [ 0, -1 ], [ 1, 0.1 ], [ 12, 0.01 ], [ 13, 0.01 ], [ 14, 0.01 ], [ 15, 2 ], [ 3, Infinity ], [ 7, NaN ], [ 10, 0 ] ])
    {
        const M = [ ...Identity ];
        M[Index] = Value;
        Assert.ok(O.isNone(T.fromMatrix(M as unknown as T.Matrix4)), `${Index}=${Value}`);
        Assert.equal(M[Index], Value);
    }

    Assert.ok(O.isNone(T.fromMatrix([] as unknown as T.Matrix4)));
    const Raw = [ ...Identity ];
    Raw[3] = 1e308;
    const A = O.getOrThrow(T.fromMatrix(Raw as unknown as T.Matrix4));
    Raw[3] = 0;
    Assert.equal(A.position.x, 1e308);
});

test("Transform interpolation uses linear position, shortest spherical orientation and finite extrapolation", () =>
{
    const A = pose({ x: 0,
        y: 2,
        z: 4 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: 170,
        z: 0 })));
    const B = pose({ x: 10,
        y: 4,
        z: 8 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: -170,
        z: 0 })));
    samePose(O.getOrThrow(T.interpolate(A, B, 0)), A);
    samePose(O.getOrThrow(T.interpolate(A, B, 1)), B);
    const Mid = O.getOrThrow(pipe(A, T.interpolate(B, 0.5)));
    close(Mid.position, { x: 5,
        y: 3,
        z: 6 });
    close(O.getOrThrow(T.transformDirection(Mid, V.UnitZ)), V.North);
    close(O.getOrThrow(T.interpolate(A, B, 2)).position, { x: 20,
        y: 6,
        z: 12 });
    const MidAngle = O.getOrThrow(Q.angularDistance(A.rotation, Mid.rotation));
    Assert.ok(Math.abs(MidAngle - Math.PI / 18) < 1e-12);
    samePose(O.getOrThrow(T.lerp(A, T.TransformUnsafe(A.position, Q.negate(A.rotation)), 0.5)), A);
    const HugeA = pose({ x: -Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: 0 });
    const HugeB = pose({ x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: 0 });
    close(O.getOrThrow(T.interpolate(HugeA, HugeB, 0.5)).position, { x: 0,
        y: Number.MAX_VALUE,
        z: 0 });
    Assert.ok(O.isNone(T.interpolate(HugeA, HugeB, 2)));
});

test("Transform partial operations reject invalid unsafe domains and unrepresentable coordinates", () =>
{
    const Invalid = [ T.TransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0)),
        T.TransformUnsafe({ x: Infinity,
            y: 0,
            z: 0 }, Q.Identity),
        T.TransformUnsafe(V.Zero, Q.QuatUnsafe(NaN, 0, 0, 1)) ];
    for (const Value of Invalid)
    {
        Assert.ok(O.isNone(T.Transform(Value.position, Value.rotation)));
        Assert.equal(T.isValid(Value), false);
        Assert.ok(O.isNone(T.inverse(Value)));
        Assert.ok(O.isNone(T.toMatrix(Value)));
        Assert.ok(O.isNone(T.compose(Value, T.Identity)));
        Assert.ok(O.isNone(T.compose(T.Identity, Value)));
        Assert.ok(O.isNone(T.interpolate(Value, T.Identity, 0)));
        Assert.ok(O.isNone(T.interpolate(T.Identity, Value, 1)));
        for (const Operation of [ T.transformPoint, T.transformDirection, T.untransformPoint, T.untransformDirection ])
        {
            Assert.ok(O.isNone(Operation(Value, V.Zero)));
            Assert.ok(O.isNone(Operation(T.Identity, { x: NaN,
                y: 0,
                z: 0 })));
        }
    }

    for (const t of [ NaN, Infinity, -Infinity ])
    {
        Assert.ok(O.isNone(T.interpolate(T.Identity, T.Identity, t)));
    }

    const Huge = pose({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 });
    Assert.ok(O.isNone(T.compose(Huge, Huge)));
    Assert.ok(O.isNone(T.transformPoint(Huge, Huge.position)));
    Assert.ok(O.isNone(T.untransformPoint(Huge, V.scale(Huge.position, -1))));
});

test("Transform protocols use exact positions, canonical orientations and distinct invalid/kind keys", () =>
{
    const A = T.TransformUnsafe(V.One, { x: 1,
        y: 2,
        z: 3,
        w: 4 });
    const B = T.TransformUnsafe(V.One, { x: -2,
        y: -4,
        z: -6,
        w: -8 });
    Assert.ok(Equal.equals(A, B));
    Assert.ok(pipe(A, T.equals(B)));
    Assert.equal(Hash.hash(A), Hash.hash(B));
    Assert.equal(HashSet.size(HashSet.make(A, B)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "pose" ]), B)), "pose");
    Assert.equal(Equal.equals(T.Identity, Q.Identity), false);
    Assert.equal(Equal.equals(T.Identity, V.Zero), false);
    Assert.equal(T.equals(A, T.TransformUnsafe({ x: 1 + 1e-15,
        y: 1,
        z: 1 }, A.rotation)), false);
    Assert.ok(Equal.equals(T.TransformUnsafe({ x: -0,
        y: 0,
        z: 0 }, Q.Identity), T.Identity));
    for (const Bad of [ NaN, Infinity, -Infinity ])
    {
        const X = T.TransformUnsafe({ x: Bad,
            y: 0,
            z: 0 }, { x: Bad,
            y: 0,
            z: 0,
            w: 0 });
        const Y = T.TransformUnsafe({ x: Bad,
            y: -0,
            z: 0 }, { x: Bad,
            y: 0,
            z: 0,
            w: 0 });
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("Transform full-precision formatting, parsing, JSON and custom inspection retain copied raw state", () =>
{
    const A = T.TransformUnsafe({ x: 1.1234567891234566,
        y: -2e-200,
        z: 3e200 }, { x: 1,
        y: 2,
        z: 3,
        w: 4 });
    const B = O.getOrThrow(T.parse(A.toString()));
    Assert.ok(T.equals(A, B));
    Assert.ok(Q.equalsComponents(A.rotation, B.rotation));
    Assert.equal(T.format(A), "Transform(1.1234567891234566, -2e-200, 3e+200, 1, 2, 3, 4)");
    const Json = A.toJSON() as T.Json;
    Assert.deepEqual(Json, { _id: "Transform",
        position: { _id: "Vector3",
            x: A.position.x,
            y: A.position.y,
            z: A.position.z },
        rotation: { _id: "Quat",
            x: 1,
            y: 2,
            z: 3,
            w: 4 } });
    Assert.ok(Object.isFrozen(Json) && Object.isFrozen(Json.position) && Object.isFrozen(Json.rotation));
    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    Assert.equal(A.pipe(T.toString), A.toString());
    for (const Text of [ "", "Transform(0,0,0,0,0,0,0)", "Transform(0,0,0,0,0,0,Infinity)",
        "Transform(0,0,0,0,0,0,1)tail", "Transform(0,0,0,0,0,1)", "Transform(0,,0,0,0,0,1)",
        "Transform(0,0,0,0,0,0,1junk)" ])
    {
        Assert.ok(O.isNone(T.parse(Text)), Text);
    }
});
