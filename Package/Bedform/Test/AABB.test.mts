/**
 * Axis-aligned bounds, exact operations, tolerance queries and forward slab intersections.
 *
 * @module bedform/Test/AABB.test
 *
 * @file      AABB.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as B from "bedform/AABB";
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
 * Compares finite coordinate components with explicit numerical tolerance.
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
 * Creates validated bounds fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const box = (min: V.Coordinates = V.Zero, max: V.Coordinates = V.One): B.AABB =>
{
    return O.getOrThrow(B.AABB(min, max));
};

/**
 * Creates unit forward ray fixtures from arbitrary finite nonzero directions.
 *
 * @category Tests
 * @since 1.0.0
 */
const ray = (origin: V.Coordinates, direction: V.Coordinates): R.Ray =>
{
    return O.getOrThrow(R.Ray(origin, direction));
};

test("AABB operation inventory and public root/subpath exports are complete", () =>
{
    Assert.equal(Root.AABB, B);
    Assert.deepEqual(Object.keys(B).filter((key) => typeof B[key as keyof typeof B] === "function").sort(), [
        "AABB", "AABBUnsafe", "center", "closestPoint", "contains", "containsBox", "containsPoint", "corners",
        "distanceToPoint", "equals", "expand", "format", "fromCenterHalfExtents", "fromPoints", "fromString",
        "halfExtents", "intersectRay", "intersection", "isAABB", "isValid", "overlaps", "parse", "size",
        "supportPoint", "toString", "transform", "union"
    ].sort());
    Assert.equal(B.contains, B.containsPoint);
    Assert.equal(B.parse, B.fromString);
    Assert.equal(B.toString, B.format);
    Assert.equal(B.isAABB(null), false);
    Assert.equal(B.isAABB({ min: V.Zero,
        max: V.One }), false);
});

test("AABB constructors deep-copy raw bounds, allow zero extents and reject inversion/nonfinite values", () =>
{
    const Min = { x: -0,
        y: 1,
        z: 2 };
    const Max = { x: 3,
        y: 4,
        z: 5 };
    const A = box(Min, Max);
    const Raw = B.AABBUnsafe(Max, Min);
    Assert.equal(Object.isFrozen(Min), false);
    Assert.equal(Object.isFrozen(Max), false);
    Min.x = 99;
    Max.z = 99;
    Assert.ok(Object.is(A.min.x, -0));
    Assert.equal(A.max.z, 5);
    Assert.equal(Raw.min.z, 5);
    Assert.ok(!B.isValid(Raw));
    for (const Value of [ A, Raw, box(V.One, V.One) ])
    {
        Assert.ok(B.isAABB(Value));
        Assert.ok(Object.isFrozen(Value) && Object.isFrozen(Value.min) && Object.isFrozen(Value.max));
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(Raw));
    Assert.ok(O.isNone(B.AABB(V.One, V.Zero)));
    Assert.ok(O.isNone(B.AABB({ x: NaN,
        y: 0,
        z: 0 }, V.One)));
    Assert.ok(O.isNone(B.AABB(V.Zero, { x: Infinity,
        y: 1,
        z: 1 })));
});

test("AABB point-set and center/half-extents construction preserve exact enclosure and caller data", () =>
{
    const Points = [ { x: -3,
        y: 4,
        z: 1 }, { x: 2,
        y: -5,
        z: 8 }, { x: 1,
        y: 1,
        z: 1 } ];
    const A = O.getOrThrow(B.fromPoints(Points));
    close(A.min, { x: -3,
        y: -5,
        z: 1 });
    close(A.max, { x: 2,
        y: 4,
        z: 8 });
    Points[0].x = -99;
    Assert.equal(A.min.x, -3);
    Assert.equal(Object.isFrozen(Points), false);
    Assert.ok(B.equals(box(V.One, V.One), O.getOrThrow(B.fromPoints([ V.One, V.One ]))));
    Assert.ok(O.isNone(B.fromPoints([])));
    Assert.ok(O.isNone(B.fromPoints(new Array<V.Coordinates>(2))));
    Assert.ok(O.isNone(B.fromPoints([ V.Zero, { x: NaN,
        y: 1,
        z: 1 } ])));
    const FromCenter = O.getOrThrow(pipe(V.One, B.fromCenterHalfExtents({ x: 2,
        y: 0,
        z: 3 })));
    close(FromCenter.min, { x: -1,
        y: 1,
        z: -2 });
    close(FromCenter.max, { x: 3,
        y: 1,
        z: 4 });
    Assert.ok(O.isNone(B.fromCenterHalfExtents(V.Zero, { x: -1,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(B.fromCenterHalfExtents({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: 0,
        z: 0 })));
});

test("AABB derived center/extents remain stable across huge, subnormal and degenerate bounds", () =>
{
    const Huge = box({ x: -Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: 0 });
    close(O.getOrThrow(B.center(Huge)), { x: 0,
        y: Number.MAX_VALUE,
        z: 0 });
    close(O.getOrThrow(B.halfExtents(Huge)), { x: Number.MAX_VALUE,
        y: 0,
        z: 0 });
    Assert.ok(O.isNone(B.size(Huge)));
    const Tiny = box({ x: Number.MIN_VALUE,
        y: 0,
        z: 0 }, { x: 2 * Number.MIN_VALUE,
        y: 0,
        z: 0 });
    Assert.equal(O.getOrThrow(B.center(Tiny)).x, 2 * Number.MIN_VALUE);
    Assert.equal(O.getOrThrow(B.size(Tiny)).x, Number.MIN_VALUE);
    close(O.getOrThrow(B.size(box())), V.One);
    close(O.getOrThrow(B.halfExtents(box())), { x: 0.5,
        y: 0.5,
        z: 0.5 });
    close(O.getOrThrow(B.center(box(V.One, V.One))), V.One);
});

test("AABB corners have deterministic binary ordering and freeze every repeated degenerate corner", () =>
{
    const Corners = O.getOrThrow(B.corners(box()));
    Assert.deepEqual(Corners.map((p) => [ p.x, p.y, p.z ]), [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ], [ 1, 1, 0 ],
        [ 0, 0, 1 ], [ 1, 0, 1 ], [ 0, 1, 1 ], [ 1, 1, 1 ] ]);
    Assert.ok(Object.isFrozen(Corners) && Corners.every(Object.isFrozen));
    const Degenerate = O.getOrThrow(B.corners(box(V.One, V.One)));
    Assert.equal(Degenerate.length, 8);
    Assert.ok(Degenerate.every((point) => V.equals(point, V.One)));
    Assert.notEqual(Degenerate[0], Degenerate[1]);
});

test("AABB containment/overlap treat contact and degenerate boxes consistently with scale-aware tolerances", () =>
{
    const A = box();
    Assert.equal(O.getOrThrow(B.containsPoint(A, V.One)), true);
    Assert.equal(O.getOrThrow(pipe(A, B.contains({ x: 2,
        y: 0,
        z: 0 }))), false);
    Assert.equal(O.getOrThrow(B.containsBox(A, box(V.One, V.One))), true);
    Assert.equal(O.getOrThrow(pipe(A, B.containsBox(box(V.Zero, { x: 2,
        y: 1,
        z: 1 }), {}))), false);
    const Touch = box({ x: 1,
        y: 0,
        z: 0 }, { x: 2,
        y: 1,
        z: 1 });
    Assert.equal(O.getOrThrow(pipe(A, B.overlaps(Touch))), true);
    const Gap = box({ x: 1 + 5e-10,
        y: 0,
        z: 0 }, { x: 2,
        y: 1,
        z: 1 });
    Assert.equal(O.getOrThrow(B.overlaps(A, Gap)), true);
    Assert.equal(O.getOrThrow(B.overlaps(A, Gap, { absoluteTolerance: 0,
        relativeTolerance: 0 })), false);
    Assert.ok(O.isNone(B.intersection(A, Gap)));
    Assert.equal(O.getOrThrow(B.contains(A, { x: 1 + 5e-10,
        y: 0,
        z: 0 })), true);
    const Large = box(V.Zero, { x: 1e9,
        y: 1,
        z: 1 });
    Assert.equal(O.getOrThrow(B.containsPoint(Large, { x: 1e9 + 0.5,
        y: 0,
        z: 0 })), true);
    Assert.equal(O.getOrThrow(B.containsPoint(Large, { x: 1e9 + 2,
        y: 0,
        z: 0 })), false);
    const Extreme = box({ x: -Number.MAX_VALUE,
        y: 0,
        z: 0 }, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 });
    Assert.equal(O.getOrThrow(B.containsPoint(Extreme, { x: Number.MAX_VALUE,
        y: 0,
        z: 0 })), false);
    Assert.equal(O.getOrThrow(B.containsPoint(Extreme, { x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, { relativeTolerance: 3 })), true);
});

test("AABB union/intersection/expansion produce exact ordered bounds and reject empty/inverted results", () =>
{
    const A = box();
    const Other = box({ x: -2,
        y: 0.5,
        z: 1 }, { x: 0.5,
        y: 3,
        z: 2 });
    const Union = O.getOrThrow(pipe(A, B.union(Other)));
    close(Union.min, { x: -2,
        y: 0,
        z: 0 });
    close(Union.max, { x: 1,
        y: 3,
        z: 2 });
    const Intersection = O.getOrThrow(B.intersection(A, Other));
    close(Intersection.min, { x: 0,
        y: 0.5,
        z: 1 });
    close(Intersection.max, { x: 0.5,
        y: 1,
        z: 1 });
    Assert.ok(B.equals(Intersection, O.getOrThrow(pipe(Other, B.intersection(A)))));
    Assert.ok(O.isNone(B.intersection(A, box({ x: 2,
        y: 2,
        z: 2 }, { x: 3,
        y: 3,
        z: 3 }))));
    const Expanded = O.getOrThrow(pipe(A, B.expand({ x: 2,
        y: 0,
        z: -0.5 })));
    close(Expanded.min, { x: -2,
        y: 0,
        z: 0.5 });
    close(Expanded.max, { x: 3,
        y: 1,
        z: 0.5 });
    close(O.getOrThrow(B.expand(A, 1)).min, { x: -1,
        y: -1,
        z: -1 });
    Assert.ok(O.isNone(B.expand(A, -1)));
    Assert.ok(O.isNone(B.expand(A, Infinity)));
});

test("AABB nearest solid points/distances and support ties agree with independent corner enumeration", () =>
{
    const A = box();
    close(O.getOrThrow(pipe(A, B.closestPoint({ x: -3,
        y: 5,
        z: 0.5 }))), { x: 0,
        y: 1,
        z: 0.5 });
    Assert.equal(O.getOrThrow(pipe(A, B.distanceToPoint({ x: -3,
        y: 5,
        z: 0.5 }))), 5);
    const Inside = { x: 0.2,
        y: 0.4,
        z: 0.8 };
    close(O.getOrThrow(B.closestPoint(A, Inside)), Inside);
    Assert.equal(O.getOrThrow(B.distanceToPoint(A, Inside)), 0);
    Assert.notEqual(O.getOrThrow(B.closestPoint(A, Inside)), Inside);
    for (const Direction of [ V.Zero, V.One, V.UnitX, { x: -3,
        y: 2,
        z: -1 } ])
    {
        const Support = O.getOrThrow(pipe(A, B.supportPoint(Direction)));
        const Best = Math.max(...O.getOrThrow(B.corners(A)).map((point) => V.dot(point, Direction)));
        Assert.equal(V.dot(Support, Direction), Best);
    }

    close(O.getOrThrow(B.supportPoint(A, V.Zero)), V.Zero);
    Assert.ok(O.isNone(B.distanceToPoint(box({ x: -Number.MAX_VALUE,
        y: 0,
        z: 0 },
    { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 }), { x: Number.MAX_VALUE,
        y: 0,
        z: 0 })));
});

test("AABB transformed bounds enclose every independently transformed corner and are not a rotated shape", () =>
{
    const A = box({ x: -2,
        y: -1,
        z: -3 }, { x: 2,
        y: 1,
        z: 3 });
    const Pose = T.TransformUnsafe({ x: 5,
        y: 7,
        z: -2 },
    Q.scale(O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })), 1e308));
    const Moved = O.getOrThrow(pipe(A, B.transform(Pose)));
    close(Moved.min, { x: 2,
        y: 6,
        z: -4 });
    close(Moved.max, { x: 8,
        y: 8,
        z: 0 });
    for (let i = 0; i < 12; i++)
    {
        const Rotation = O.getOrThrow(Q.fromEuler({ x: i * 17,
            y: i * 11,
            z: i * 23 }));
        const Frame = O.getOrThrow(T.Transform({ x: i,
            y: -i,
            z: 4 }, Rotation));
        const Points = O.getOrThrow(B.corners(A)).map((point) => O.getOrThrow(T.transformPoint(Frame, point)));
        const Result = O.getOrThrow(B.transform(A, Frame));
        for (const Axis of [ "x", "y", "z" ] as const)
        {
            Assert.equal(Result.min[Axis], Math.min(...Points.map((point) => point[Axis])));
            Assert.equal(Result.max[Axis], Math.max(...Points.map((point) => point[Axis])));
        }
    }
});

test("AABB ray slabs return forward entry, inside-zero and deterministic unique/ambiguous normals", () =>
{
    const A = box();
    const Hit = O.getOrThrow(B.intersectRay(A, ray({ x: -2,
        y: 0.5,
        z: 0.5 }, V.UnitX)));
    Assert.equal(Hit.distance, 2);
    close(Hit.point, { x: 0,
        y: 0.5,
        z: 0.5 });
    close(O.getOrThrow(Hit.normal), V.West);
    Assert.ok(Object.isFrozen(Hit) && Object.isFrozen(Hit.point) && Object.isFrozen(Hit.normal));
    Assert.ok(Object.isFrozen(O.getOrThrow(Hit.normal)));
    const Reverse = O.getOrThrow(pipe(A, B.intersectRay(ray({ x: 3,
        y: 0.5,
        z: 0.5 }, V.West))));
    Assert.equal(Reverse.distance, 2);
    close(O.getOrThrow(Reverse.normal), V.East);
    const SharedNone = O.none();
    const WasFrozen = Object.isFrozen(SharedNone);
    const Inside = O.getOrThrow(B.intersectRay(A, ray({ x: 0.5,
        y: 0.5,
        z: 0.5 }, V.UnitZ)));
    Assert.equal(Inside.distance, 0);
    Assert.equal(Object.isFrozen(SharedNone), WasFrozen);
    Assert.notEqual(Inside.normal, SharedNone);
    Assert.ok(Object.isFrozen(Inside.normal));
    Assert.ok(O.isNone(Inside.normal));
    const Boundary = O.getOrThrow(B.intersectRay(A, ray({ x: 0,
        y: 0.5,
        z: 0.5 }, V.West)));
    Assert.equal(Boundary.distance, 0);
    close(O.getOrThrow(Boundary.normal), V.West);
    const Corner = O.getOrThrow(B.intersectRay(A, ray({ x: -1,
        y: -1,
        z: -1 }, V.One)));
    Assert.ok(Math.abs(Corner.distance - Math.sqrt(3)) < 1e-12);
    Assert.ok(O.isNone(Corner.normal));
    Assert.ok(O.isNone(O.getOrThrow(B.intersectRay(A, ray(V.Zero, V.UnitX))).normal));
});

test("AABB ray queries cover zero extents, parallel/tangent/miss cases and tolerance boundaries", () =>
{
    const A = box();
    Assert.ok(O.isNone(B.intersectRay(A, ray({ x: -2,
        y: 2,
        z: 0.5 }, V.UnitX))));
    Assert.ok(O.isNone(B.intersectRay(A, ray({ x: -2,
        y: 0.5,
        z: 0.5 }, V.West))));
    Assert.ok(O.isSome(B.intersectRay(A, ray({ x: -2,
        y: 1,
        z: 0.5 }, V.UnitX))));
    Assert.ok(O.isNone(O.getOrThrow(B.intersectRay(A, ray({ x: -2,
        y: 1,
        z: 0.5 }, V.UnitX))).normal));
    const Near = ray({ x: -1,
        y: 1 + 5e-10,
        z: 0.5 }, V.UnitX);
    Assert.ok(O.isSome(B.intersectRay(A, Near)));
    Assert.ok(O.isNone(B.intersectRay(A, Near, { absoluteTolerance: 0,
        relativeTolerance: 0 })));
    for (const Thin of [ box(V.Zero, { x: 0,
        y: 1,
        z: 1 }), box(V.Zero, { x: 0,
        y: 0,
        z: 1 }), box(V.Zero, V.Zero) ])
    {
        const Hit = O.getOrThrow(B.intersectRay(Thin, ray({ x: -1,
            y: 0,
            z: 0 }, V.UnitX)));
        Assert.equal(Hit.distance, 1);
        Assert.ok(O.isNone(Hit.normal));
    }

    const Distant = box({ x: -1,
        y: 1e10,
        z: -1 }, { x: 2,
        y: 1e10 + 1,
        z: 1 });
    const TinyDirection = ray(V.Zero, { x: 1e-10,
        y: 1,
        z: 0 });
    Assert.ok(O.isSome(B.intersectRay(Distant, TinyDirection)));
});

test("AABB invalid unsafe bounds, query options and unrepresentable outputs are rejected consistently", () =>
{
    const Invalid = [ B.AABBUnsafe(V.One, V.Zero), B.AABBUnsafe({ x: NaN,
        y: 0,
        z: 0 }, V.One),
    B.AABBUnsafe(V.Zero, { x: Infinity,
        y: 1,
        z: 1 }) ];
    for (const A of Invalid)
    {
        Assert.ok(!B.isValid(A));
        for (const Operation of [ B.center, B.size, B.halfExtents ])
        {
            Assert.ok(O.isNone(Operation(A)));
        }

        Assert.ok(O.isNone(B.corners(A)));

        Assert.ok(O.isNone(B.containsPoint(A, V.Zero)));
        Assert.ok(O.isNone(B.containsBox(A, box())));
        Assert.ok(O.isNone(B.overlaps(A, box())));
        Assert.ok(O.isNone(B.union(A, box())));
        Assert.ok(O.isNone(B.intersection(A, box())));
        Assert.ok(O.isNone(B.expand(A, 1)));
        Assert.ok(O.isNone(B.closestPoint(A, V.Zero)));
        Assert.ok(O.isNone(B.distanceToPoint(A, V.Zero)));
        Assert.ok(O.isNone(B.supportPoint(A, V.Zero)));
        Assert.ok(O.isNone(B.transform(A, T.Identity)));
        Assert.ok(O.isNone(B.intersectRay(A, ray(V.Zero, V.UnitX))));
    }

    for (const Bad of [ -1, NaN, Infinity, null, "1" ])
    {
        const Options = { absoluteTolerance: Bad as number };
        Assert.ok(O.isNone(B.containsPoint(box(), V.Zero, Options)));
        Assert.ok(O.isNone(B.overlaps(box(), box(), Options)));
        Assert.ok(O.isNone(B.intersectRay(box(), ray(V.Zero, V.UnitX), Options)));
    }

    Assert.ok(O.isNone(B.intersectRay(box(), R.RayUnsafe(V.Zero, V.One))));
    Assert.ok(O.isNone(B.supportPoint(box(), { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(B.transform(box(), T.TransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0)))));
    Assert.ok(O.isNone(B.expand(box({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: 0,
        z: 0 }), Number.MAX_VALUE)));
});

test("AABB exact protocols retain raw bounds and deterministic invalid fallback across hash collections", () =>
{
    const A = box();
    const Same = box({ x: -0,
        y: 0,
        z: 0 }, V.One);
    Assert.ok(Equal.equals(A, Same));
    Assert.ok(pipe(A, B.equals(Same)));
    Assert.equal(Hash.hash(A), Hash.hash(Same));
    Assert.equal(HashSet.size(HashSet.make(A, Same)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "box" ]), Same)), "box");
    Assert.equal(Equal.equals(A, V.Zero), false);
    Assert.equal(Equal.equals(A, T.Identity), false);
    Assert.equal(B.equals(A, box(V.Zero, { x: 1 + 1e-15,
        y: 1,
        z: 1 })), false);
    for (const Bad of [ NaN, Infinity, -Infinity ])
    {
        const X = B.AABBUnsafe({ x: Bad,
            y: 0,
            z: 0 }, V.One);
        const Y = B.AABBUnsafe({ x: Bad,
            y: -0,
            z: 0 }, V.One);
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("AABB full-precision text, JSON and custom inspection preserve copied stored bounds", () =>
{
    const A = box({ x: -1.1234567891234566,
        y: -2e-200,
        z: -3e200 }, { x: 4,
        y: 5,
        z: 6 });
    Assert.ok(B.equals(A, O.getOrThrow(B.parse(A.toString()))));
    Assert.equal(A.pipe(B.toString), A.toString());
    Assert.equal(B.format(box()), "AABB(0, 0, 0, 1, 1, 1)");
    const Json = A.toJSON() as B.Json;
    Assert.deepEqual(Json, { _id: "AABB",
        min: A.min.toJSON(),
        max: A.max.toJSON() });
    Assert.ok(Object.isFrozen(Json) && Object.isFrozen(Json.min) && Object.isFrozen(Json.max));
    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    for (const Text of [ "", "AABB(1,1,1,0,0,0)", "AABB(0,0,0,1,1,Infinity)", "AABB(0,0,0,1,1)",
        "AABB(0,,0,1,1,1)", "AABB(0,0,0,1,1,1)tail", "AABB(0,0,0,1,1,1junk)" ]) {Assert.ok(O.isNone(B.parse(Text)));}
});
