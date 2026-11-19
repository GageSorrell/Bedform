/**
 * Oriented plane coefficients, scale-aware half-spaces and static intersections.
 *
 * @module bedform/Test/Plane.test
 *
 * @file      Plane.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as P from "bedform/Plane";
import * as R from "bedform/Ray";
import * as T from "bedform/Transform";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as O from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashSet from "@bedform/effect/HashSet";
import * as HashMap from "@bedform/effect/HashMap";
import * as Inspectable from "@bedform/effect/Inspectable";
import { pipe } from "@bedform/effect/Function";

/**
 * Compares finite vector coordinates with explicit numerical tolerance.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: V.Coordinates, expected: V.Coordinates, tolerance = 1e-10): void =>
{
    for (const Key of [ "x", "y", "z" ] as const)
    {
        Assert.ok(Math.abs(actual[Key] - expected[Key]) <= tolerance * Math.max(1, Math.abs(expected[Key])),
            `${Key}: ${actual[Key]} != ${expected[Key]}`);
    }
};

/**
 * Constructs a validated plane from explicit coefficients.
 *
 * @category Tests
 * @since 1.0.0
 */
const plane = (normal: V.Coordinates = V.UnitY, offset = 0): P.Plane =>
{
    return O.getOrThrow(P.Plane(normal, offset));
};

/**
 * Constructs validated forward ray fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const ray = (origin: V.Coordinates, direction: V.Coordinates): R.Ray =>
{
    return O.getOrThrow(R.Ray(origin, direction));
};

test("Plane operation inventory and root/direct public exports are complete", () =>
{
    Assert.equal(Root.Plane, P);
    Assert.deepEqual(Object.keys(P).filter((key) => typeof P[key as keyof typeof P] === "function").sort(), [
        "Plane", "PlaneUnsafe", "classify", "contains", "equals", "flip", "format", "fromPointNormal", "fromPoints",
        "fromString", "intersectPlane", "intersectRay", "isPlane", "isValid", "parse", "projectPoint",
        "signedDistance", "toString", "transform"
    ].sort());
    Assert.equal(P.parse, P.fromString);
    Assert.equal(P.toString, P.format);
    Assert.equal(P.isPlane(null), false);
    Assert.equal(P.isPlane({ normal: V.UnitY,
        offset: 0 }), false);
    Assert.ok(Object.isFrozen(P.Side));
});

test("Plane constructors normalize normal and offset together without flipping orientation or freezing callers", () =>
{
    const Normal = { x: 0,
        y: -4,
        z: 0 };
    const A = plane(Normal, 8);
    const Raw = P.PlaneUnsafe(Normal, 8);
    close(A.normal, V.Down);
    Assert.equal(A.offset, 2);
    Assert.equal(Raw.normal.y, -4);
    Assert.equal(Raw.offset, 8);
    Assert.equal(Object.isFrozen(Normal), false);
    Normal.y = 99;
    Assert.equal(Raw.normal.y, -4);
    Assert.notEqual(A.normal, Normal);
    for (const Value of [ A, Raw ])
    {
        Assert.ok(Object.isFrozen(Value) && Object.isFrozen(Value.normal));
        Assert.ok(P.isPlane(Value));
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(Raw));
    for (const Magnitude of [ Number.MAX_VALUE, 1e308, 1e-308, Number.MIN_VALUE ])
    {
        const Value = plane({ x: Magnitude,
            y: Magnitude,
            z: Magnitude }, -Magnitude);
        Assert.ok(P.isValid(Value));
        Assert.ok(Math.abs(Value.offset + 1 / Math.sqrt(3)) < 1e-15);
    }

    Assert.ok(Number.isFinite(plane({ x: 0.9,
        y: 0.9,
        z: 0.9 }, Number.MAX_VALUE).offset));
    Assert.ok(O.isNone(P.Plane({ x: Number.MIN_VALUE,
        y: 0,
        z: 0 }, Number.MAX_VALUE)));
});

test("Plane point/normal and oriented three-point construction reject degeneracy and retain winding", () =>
{
    const A = O.getOrThrow(P.fromPointNormal({ x: 1,
        y: 2,
        z: 3 }, { x: 0,
        y: 20,
        z: 0 }));
    Assert.equal(A.offset, -2);
    Assert.ok(P.equals(A, O.getOrThrow(pipe({ x: 1,
        y: 2,
        z: 3 }, P.fromPointNormal(V.Up)))));
    const B = O.getOrThrow(P.fromPoints(V.Zero, V.UnitX, V.UnitY));
    close(B.normal, V.UnitZ);
    close(O.getOrThrow(pipe(V.Zero, P.fromPoints(V.UnitY, V.UnitX))).normal, V.North);
    for (const Magnitude of [ 1e308, 1e-308, Number.MIN_VALUE ])
    {
        close(O.getOrThrow(P.fromPoints(V.Zero, { x: Magnitude,
            y: 0,
            z: 0 },
        { x: 0,
            y: Magnitude,
            z: 0 })).normal, V.UnitZ);
    }

    close(O.getOrThrow(P.fromPoints({ x: -Number.MAX_VALUE,
        y: 0,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, { x: 0,
        y: Number.MAX_VALUE,
        z: 0 })).normal, V.UnitZ);
    Assert.ok(O.isNone(P.fromPoints(V.Zero, V.Zero, V.UnitY)));
    Assert.ok(O.isNone(P.fromPoints(V.Zero, V.One, { x: 2,
        y: 2,
        z: 2 })));
    Assert.ok(O.isNone(P.fromPoints(V.Zero, { x: NaN,
        y: 0,
        z: 0 }, V.One)));
    Assert.ok(O.isNone(P.fromPointNormal(V.Zero, V.Zero)));
});

test("Plane signed distance and projection use negative interior and stable large cancellation", () =>
{
    const A = plane(V.UnitY, -2);
    Assert.equal(O.getOrThrow(P.signedDistance(A, { x: 4,
        y: -1,
        z: 8 })), -3);
    Assert.equal(O.getOrThrow(pipe(A, P.signedDistance({ x: 4,
        y: 5,
        z: 8 }))), 3);
    close(O.getOrThrow(pipe(A, P.projectPoint({ x: 4,
        y: 5,
        z: 8 }))), { x: 4,
        y: 2,
        z: 8 });
    const B = plane(V.One, 0);
    Assert.ok(Math.abs(O.getOrThrow(P.signedDistance(B, { x: 1e308,
        y: 1,
        z: -1e308 })) - 1 / Math.sqrt(3)) < 1e-14);
    Assert.equal(O.getOrThrow(P.signedDistance(plane(V.UnitX, -Number.MAX_VALUE),
        { x: Number.MAX_VALUE,
            y: 0,
            z: 0 })), 0);
    const Point = { x: 4,
        y: -3,
        z: 9 };
    const Projected = O.getOrThrow(P.projectPoint(B, Point));
    Assert.ok(Math.abs(O.getOrThrow(P.signedDistance(B, Projected))) < 1e-14);
    const Delta = V.subtract(Point, Projected);
    close(Delta, V.scale(B.normal, O.getOrThrow(P.signedDistance(B, Point))));
    Assert.ok(Object.isFrozen(Projected));
});

test("Plane classification and containment honor absolute/relative options and distinguish invalid input", () =>
{
    const A = plane();
    Assert.equal(O.getOrThrow(P.classify(A, { x: 0,
        y: -2,
        z: 0 })), P.Side.Inside);
    Assert.equal(O.getOrThrow(pipe(A, P.classify({ x: 0,
        y: 2,
        z: 0 }))), P.Side.Outside);
    Assert.equal(O.getOrThrow(P.classify(A, { x: 0,
        y: 5e-10,
        z: 0 })), P.Side.Boundary);
    Assert.equal(O.getOrThrow(P.classify(A, { x: 0,
        y: 5e-10,
        z: 0 },
    { absoluteTolerance: 0,
        relativeTolerance: 0 })), P.Side.Outside);
    Assert.equal(O.getOrThrow(pipe(A, P.classify(V.Zero, {}))), P.Side.Boundary);
    Assert.equal(O.getOrThrow(P.contains(A, { x: 0,
        y: -2,
        z: 0 })), true);
    Assert.equal(O.getOrThrow(pipe(A, P.contains({ x: 0,
        y: 2,
        z: 0 }))), false);
    Assert.equal(O.getOrThrow(pipe(A, P.contains(V.Zero, undefined))), true);
    const Large = plane(V.UnitY, -1e9);
    Assert.equal(O.getOrThrow(P.classify(Large, { x: 0,
        y: 1e9 + 0.5,
        z: 0 })), P.Side.Boundary);
    Assert.equal(O.getOrThrow(P.classify(Large, { x: 0,
        y: 1e9 + 2,
        z: 0 })), P.Side.Outside);
    Assert.equal(O.getOrThrow(P.classify(A, V.Up, { absoluteTolerance: Number.MAX_VALUE,
        relativeTolerance: Number.MAX_VALUE })), P.Side.Boundary);
    const Huge = plane(V.One, Number.MAX_VALUE);
    const HugePoint = { x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: Number.MAX_VALUE };
    Assert.equal(O.getOrThrow(P.contains(Huge, HugePoint)), false);
    Assert.equal(O.getOrThrow(P.classify(Huge, HugePoint)), P.Side.Outside);
    Assert.ok(O.isNone(P.classify(A, V.Zero, null as unknown as P.QueryOptions)));
    Assert.ok(O.isNone(P.classify(A, V.Zero, { absoluteTolerance: null as unknown as number })));
    Assert.ok(O.isNone(P.contains(A, V.Zero, { relativeTolerance: "1" as unknown as number })));
    for (const Bad of [ -1, Infinity, NaN ])
    {
        Assert.ok(O.isNone(P.classify(A, V.Zero, { absoluteTolerance: Bad })));
        Assert.ok(O.isNone(P.contains(A, V.Zero, { relativeTolerance: Bad })));
    }
});

test("Plane flipping reverses the oriented half-space and returns the original after two flips", () =>
{
    const A = plane(V.UnitY, -2);
    const B = O.getOrThrow(P.flip(A));
    close(B.normal, V.Down);
    Assert.equal(B.offset, 2);
    Assert.equal(O.getOrThrow(P.contains(B, V.Zero)), false);
    Assert.equal(O.getOrThrow(P.signedDistance(B, V.Zero)), 2);
    Assert.ok(P.equals(A, O.getOrThrow(P.flip(B))));
    Assert.equal(Equal.equals(A, B), false);
});

test("Plane rigid transformations preserve signed distance, projection and oriented normals", () =>
{
    const A = plane(V.UnitX, -2);
    const Pose = T.TransformUnsafe({ x: 10,
        y: 3,
        z: 4 },
    Q.scale(O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })), 1e308));
    const Moved = O.getOrThrow(pipe(A, P.transform(Pose)));
    close(Moved.normal, V.UnitZ);
    Assert.ok(Math.abs(Moved.offset + 6) < 1e-12);
    const Point = { x: 7,
        y: -2,
        z: 9 };
    const World = O.getOrThrow(T.transformPoint(Pose, Point));
    Assert.ok(Math.abs(O.getOrThrow(P.signedDistance(Moved, World)) - O.getOrThrow(P.signedDistance(A, Point))) < 1e-12);
    close(O.getOrThrow(P.projectPoint(Moved, World)),
        O.getOrThrow(T.transformPoint(Pose, O.getOrThrow(P.projectPoint(A, Point)))));
    const Restored = O.getOrThrow(P.transform(Moved, O.getOrThrow(T.inverse(Pose))));
    close(Restored.normal, A.normal);
    Assert.ok(Math.abs(Restored.offset - A.offset) < 1e-12);
});

test("Plane intersections return deterministic infinite lines satisfying both plane equations", () =>
{
    const A = plane(V.UnitX, -1);
    const B = plane(V.UnitY, -2);
    const Line = O.getOrThrow(P.intersectPlane(A, B));
    close(Line.point, { x: 1,
        y: 2,
        z: 0 });
    close(Line.direction, V.UnitZ);
    Assert.deepEqual(Line, O.getOrThrow(pipe(B, P.intersectPlane(A, {}))));
    Assert.equal(R.isRay(Line), false);
    Assert.ok(Object.isFrozen(Line) && Object.isFrozen(Line.point) && Object.isFrozen(Line.direction));
    const C = plane({ x: 1,
        y: 2,
        z: 3 }, -7);
    const D = plane({ x: 2,
        y: -1,
        z: 1 }, 4);
    const General = O.getOrThrow(P.intersectPlane(C, D));
    Assert.ok(Math.abs(V.dot(General.point, General.direction)) < 1e-12);
    for (const Parameter of [ -1e4, -2, 0, 3, 1e4 ])
    {
        const Point = V.add(General.point, V.scale(General.direction, Parameter));
        Assert.ok(Math.abs(O.getOrThrow(P.signedDistance(C, Point))) < 1e-11);
        Assert.ok(Math.abs(O.getOrThrow(P.signedDistance(D, Point))) < 1e-11);
    }
});

test("Plane parallel/coincident and near-parallel intersection boundaries use validated query options", () =>
{
    const A = plane();
    Assert.ok(O.isNone(P.intersectPlane(A, A)));
    Assert.ok(O.isNone(P.intersectPlane(A, plane(V.Up, -2))));
    Assert.ok(O.isNone(P.intersectPlane(A, O.getOrThrow(P.flip(A)))));
    const Near = plane({ x: 1e-10,
        y: 1,
        z: 0 }, -1);
    Assert.ok(O.isNone(P.intersectPlane(A, Near)));
    const Line = O.getOrThrow(pipe(A, P.intersectPlane(Near, { absoluteTolerance: 0,
        relativeTolerance: 0 })));
    close(Line.point, { x: 1e10,
        y: 0,
        z: 0 });
    Assert.ok(O.isNone(P.intersectPlane(A, plane(V.UnitX), { absoluteTolerance: -1 })));
});

test("Plane forward-ray intersections handle hits, misses, parallel, coplanar and boundary origins", () =>
{
    const A = plane(V.Up, -2);
    const Hit = O.getOrThrow(P.intersectRay(A, ray({ x: 3,
        y: 5,
        z: 4 }, V.Down)));
    Assert.equal(Hit.distance, 3);
    close(Hit.point, { x: 3,
        y: 2,
        z: 4 });
    close(O.getOrThrow(Hit.normal), V.Up);
    Assert.ok(Object.isFrozen(Hit) && Object.isFrozen(Hit.point) && Object.isFrozen(Hit.normal) &&
        Object.isFrozen(O.getOrThrow(Hit.normal)));
    Assert.ok(O.isNone(P.intersectRay(A, ray({ x: 0,
        y: 5,
        z: 0 }, V.Up))));
    Assert.ok(O.isNone(P.intersectRay(A, ray(V.Zero, V.Down))));
    Assert.ok(O.isNone(P.intersectRay(A, ray(V.Zero, V.UnitX))));
    const Coplanar = O.getOrThrow(pipe(A, P.intersectRay(ray({ x: 7,
        y: 2,
        z: 3 }, V.UnitX))));
    Assert.equal(Coplanar.distance, 0);
    close(Coplanar.point, { x: 7,
        y: 2,
        z: 3 });
    close(O.getOrThrow(Coplanar.normal), V.Up);
    Assert.equal(O.getOrThrow(P.intersectRay(A, ray({ x: 0,
        y: 2,
        z: 0 }, V.Up))).distance, 0);
    Assert.equal(O.getOrThrow(P.intersectRay(plane(), ray({ x: 0,
        y: 5e-10,
        z: 0 }, V.UnitX))).distance, 0);
    Assert.ok(O.isNone(P.intersectRay(plane(), ray({ x: 0,
        y: 5e-10,
        z: 0 }, V.UnitX),
    { absoluteTolerance: 0,
        relativeTolerance: 0 })));
    const NearlyParallel = ray(V.Zero, { x: 1,
        y: 1e-10,
        z: 0 });
    Assert.ok(O.isNone(P.intersectRay(A, NearlyParallel)));
    Assert.ok(Math.abs(O.getOrThrow(P.intersectRay(A, NearlyParallel,
        { absoluteTolerance: 0,
            relativeTolerance: 0 })).distance - 2e10) < 1e-4);
});

test("Plane ray intersections commute with rigid frame mapping", () =>
{
    const A = plane({ x: 1,
        y: 2,
        z: 3 }, -4);
    const Ray = ray(V.Zero, V.One);
    const Hit = O.getOrThrow(P.intersectRay(A, Ray));
    const Pose = O.getOrThrow(T.Transform({ x: 5,
        y: -3,
        z: 2 },
    O.getOrThrow(Q.fromEuler({ x: 31,
        y: 83,
        z: -17 }))));
    const World = O.getOrThrow(P.intersectRay(O.getOrThrow(P.transform(A, Pose)), O.getOrThrow(R.transform(Ray, Pose))));
    Assert.ok(Math.abs(Hit.distance - World.distance) < 1e-12);
    close(World.point, O.getOrThrow(T.transformPoint(Pose, Hit.point)));
    close(O.getOrThrow(World.normal), O.getOrThrow(T.transformDirection(Pose, O.getOrThrow(Hit.normal))));
});

test("Plane partial queries reject nonunit unsafe planes, invalid rays/options and unrepresentable output", () =>
{
    for (const A of [ P.PlaneUnsafe(V.Zero, 0), P.PlaneUnsafe({ x: 0,
        y: 2,
        z: 0 }, 0),
    P.PlaneUnsafe(V.Up, Infinity), P.PlaneUnsafe({ x: NaN,
        y: 0,
        z: 0 }, 0) ])
    {
        Assert.ok(!P.isValid(A));
        Assert.ok(O.isNone(P.signedDistance(A, V.Zero)));
        Assert.ok(O.isNone(P.projectPoint(A, V.Zero)));
        Assert.ok(O.isNone(P.flip(A)));
        Assert.ok(O.isNone(P.classify(A, V.Zero)));
        Assert.ok(O.isNone(P.contains(A, V.Zero)));
        Assert.ok(O.isNone(P.transform(A, T.Identity)));
        Assert.ok(O.isNone(P.intersectPlane(A, plane(V.UnitX))));
        Assert.ok(O.isNone(P.intersectPlane(plane(V.UnitX), A)));
        Assert.ok(O.isNone(P.intersectRay(A, ray(V.Zero, V.Up))));
    }

    Assert.ok(O.isNone(P.Plane(V.Zero, 0)));
    Assert.ok(O.isNone(P.Plane(V.Up, NaN)));
    Assert.ok(O.isNone(P.signedDistance(plane(), { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(P.intersectRay(plane(), R.RayUnsafe(V.Zero, { x: 0,
        y: 2,
        z: 0 }))));
    Assert.ok(O.isNone(P.intersectRay(plane(), ray(V.Zero, V.Up), { relativeTolerance: Infinity })));
    Assert.ok(O.isNone(P.transform(plane(), T.TransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0)))));
    Assert.ok(O.isNone(P.signedDistance(plane(V.One, Number.MAX_VALUE),
        { x: Number.MAX_VALUE,
            y: Number.MAX_VALUE,
            z: Number.MAX_VALUE })));
    Assert.ok(O.isNone(P.intersectRay(plane(V.Up, -Number.MAX_VALUE),
        ray({ x: 0,
            y: -Number.MAX_VALUE,
            z: 0 }, V.Up))));
});

test("Plane exact protocols preserve orientation, raw magnitude and deterministic invalid fallbacks", () =>
{
    const A = plane(V.Up, -2);
    const B = P.PlaneUnsafe({ x: -0,
        y: 1,
        z: 0 }, -2);
    Assert.ok(Equal.equals(A, B));
    Assert.ok(pipe(A, P.equals(B)));
    Assert.equal(Hash.hash(A), Hash.hash(B));
    Assert.equal(HashSet.size(HashSet.make(A, B)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "plane" ]), B)), "plane");
    Assert.ok(!P.equals(A, P.PlaneUnsafe({ x: 0,
        y: 2,
        z: 0 }, -4)));
    Assert.ok(!P.equals(A, O.getOrThrow(P.flip(A))));
    Assert.equal(Equal.equals(A, V.Up), false);
    Assert.equal(Equal.equals(A, ray(V.Zero, V.Up)), false);
    for (const Bad of [ NaN, Infinity, -Infinity ])
    {
        const X = P.PlaneUnsafe({ x: Bad,
            y: 0,
            z: 0 }, Bad);
        const Y = P.PlaneUnsafe({ x: Bad,
            y: -0,
            z: 0 }, Bad);
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("Plane text, frozen JSON and custom inspection retain full-precision stored coefficients", () =>
{
    const A = plane({ x: 1,
        y: 2,
        z: 3 }, -1.1234567891234566);
    Assert.ok(P.equals(A, O.getOrThrow(P.parse(A.toString()))));
    Assert.equal(A.pipe(P.toString), A.toString());
    Assert.equal(P.format(plane(V.Up, -2)), "Plane(0, 1, 0, -2)");
    const Json = A.toJSON() as P.Json;
    Assert.deepEqual(Json, { _id: "Plane",
        normal: A.normal.toJSON(),
        offset: A.offset });
    Assert.ok(Object.isFrozen(Json) && Object.isFrozen(Json.normal));
    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    for (const Text of [ "", "Plane(0,0,0,0)", "Plane(0,2,0,1)", "Plane(0,1,0,Infinity)",
        "Plane(0,1,0)", "Plane(0,1,0,0)tail", "Plane(0,1,0,0junk)", "Plane(0,,0,0)" ])
    {
        Assert.ok(O.isNone(P.parse(Text)), Text);
    }
});
