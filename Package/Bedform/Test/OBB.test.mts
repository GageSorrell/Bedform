/**
 * Oriented-box frame queries, complete SAT, degeneracy and immutable value protocols.
 *
 * @module bedform/Test/OBB.test
 *
 * @file      OBB.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as S from "bedform/OBB";
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
 * Strict query comparisons for independent separation fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const Exact: S.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };

/**
 * Compares finite coordinates using an explicit numerical tolerance.
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
 * Constructs explicit validated box fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const box = (center: V.Coordinates = V.Zero, half: V.Coordinates = V.One,
    rotation: Q.Coordinates = Q.Identity): S.OBB =>
{
    return O.getOrThrow(S.OBB(center, half, rotation));
};

/**
 * Constructs validated degree orientations for analytic fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const angles = (pitch: number, yaw: number, roll: number): Q.Quat =>
{
    return O.getOrThrow(Q.fromEuler({ x: pitch,
        y: yaw,
        z: roll }));
};

/**
 * Independently projects all eight world vertices to check six face-axis intervals.
 * This intentionally omits cross axes for a regression that requires all fifteen SAT axes.
 *
 * @category Tests
 * @since 1.0.0
 */
const faceAxesOverlap = (a: S.Coordinates, b: S.Coordinates): boolean =>
{
    const A = O.getOrThrow(S.corners(a));
    const B = O.getOrThrow(S.corners(b));
    const Axes = [ ...Object.values(O.getOrThrow(Q.axes(a.rotation))),
        ...Object.values(O.getOrThrow(Q.axes(b.rotation))) ];
    return Axes.every((axis) =>
    {
        const PA = A.map((point) => V.dot(point, axis));
        const PB = B.map((point) => V.dot(point, axis));
        return Math.max(...PA) >= Math.min(...PB) && Math.max(...PB) >= Math.min(...PA);
    });
};

test("OBB public operation inventory and direct/root identity are complete", () =>
{
    Assert.equal(Root.OBB, S);
    Assert.deepEqual(Object.keys(S).filter((key) => typeof S[key as keyof typeof S] === "function").sort(), [
        "OBB", "OBBUnsafe", "closestPoint", "contains", "containsPoint", "corners", "distanceToPoint", "equals",
        "format", "fromString", "intersectRay", "isOBB", "isValid", "overlaps", "overlapsAABB", "overlapsOBB",
        "parse", "supportPoint", "toAABB", "toLocalPoint", "toString", "toWorldPoint", "transform"
    ].sort());
    Assert.equal(S.overlapsOBB, S.overlaps);
    Assert.equal(S.contains, S.containsPoint);
    Assert.equal(S.parse, S.fromString);
    Assert.equal(S.toString, S.format);
    Assert.equal(S.isOBB(null), false);
    Assert.equal(S.isOBB({ center: V.Zero,
        halfExtents: V.One,
        rotation: Q.Identity }), false);
});

test("OBB constructors deeply copy/freeze fields, normalize only validated orientations and accept zero extents", () =>
{
    const Center = { x: -0,
        y: 2,
        z: 3 };
    const Half = { x: 1,
        y: 0,
        z: 2 };
    const Rotation = { x: 0,
        y: 0,
        z: 0,
        w: -4 };
    const A = box(Center, Half, Rotation);
    const Raw = S.OBBUnsafe(Center, Half, Rotation);
    Assert.equal(A.rotation.w, -1);
    Assert.equal(Raw.rotation.w, -4);
    for (const Input of [ Center, Half, Rotation ])
    {
        Assert.equal(Object.isFrozen(Input), false);
    }

    Center.x = 99;
    Half.x = 99;
    Rotation.w = 0;
    Assert.ok(Object.is(A.center.x, -0));
    Assert.equal(A.halfExtents.x, 1);
    Assert.equal(Raw.rotation.w, -4);
    Assert.ok(S.isValid(Raw));
    for (const Value of [ A, Raw, box(V.Zero, V.Zero) ])
    {
        Assert.ok(S.isOBB(Value));
        for (const Child of [ Value, Value.center, Value.halfExtents, Value.rotation ])
        {
            Assert.ok(Object.isFrozen(Child));
        }
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(Raw));
    for (const Magnitude of [ 1e308, 1e-308, Number.MIN_VALUE ])
    {
        Assert.ok(Q.isNormalized(box(V.Zero, V.One, { x: Magnitude,
            y: 0,
            z: 0,
            w: Magnitude }).rotation));
    }
});

test("OBB point frames distinguish local rotation and containing-frame translation", () =>
{
    const A = box({ x: 10,
        y: 2,
        z: 3 }, { x: 2,
        y: 1,
        z: 0.5 }, angles(0, 90, 0));
    close(O.getOrThrow(S.toWorldPoint(A, { x: 2,
        y: 0,
        z: 0.5 })), { x: 9.5,
        y: 2,
        z: 5 });
    close(O.getOrThrow(pipe(A, S.toLocalPoint({ x: 9.5,
        y: 2,
        z: 5 }))), { x: 2,
        y: 0,
        z: 0.5 });
    for (let i = 0; i < 15; i++)
    {
        const Point = { x: i - 5,
            y: i / 2,
            z: -i };
        const Value = box({ x: 4,
            y: 7,
            z: -2 }, V.One, angles(i * 17, i * 31, i * 11));
        close(O.getOrThrow(S.toLocalPoint(Value, O.getOrThrow(pipe(Value, S.toWorldPoint(Point))))), Point);
    }
});

test("OBB corners, nearest solid points and bounds agree with independent local fixtures", () =>
{
    const A = box({ x: 10,
        y: 0,
        z: 0 }, { x: 2,
        y: 1,
        z: 0.5 }, angles(0, 90, 0));
    const Corners = O.getOrThrow(S.corners(A));
    Assert.equal(Corners.length, 8);
    Assert.ok(Object.isFrozen(Corners) && Corners.every(Object.isFrozen));
    close(Corners[0], { x: 10.5,
        y: -1,
        z: -2 });
    close(Corners[7], { x: 9.5,
        y: 1,
        z: 2 });
    const Bounds = O.getOrThrow(S.toAABB(A));
    close(Bounds.min, { x: 9.5,
        y: -1,
        z: -2 });
    close(Bounds.max, { x: 10.5,
        y: 1,
        z: 2 });
    close(O.getOrThrow(pipe(A, S.closestPoint({ x: 6.5,
        y: 5,
        z: 0 }))), { x: 9.5,
        y: 1,
        z: 0 });
    Assert.ok(Math.abs(O.getOrThrow(pipe(A, S.distanceToPoint({ x: 6.5,
        y: 5,
        z: 0 }))) - 5) < 1e-12);
    const Inside = { x: 10.1,
        y: 0.2,
        z: -0.4 };
    Assert.deepEqual(O.getOrThrow(S.closestPoint(A, Inside)), V.Vector3Unsafe(Inside.x, Inside.y, Inside.z));
    Assert.equal(O.getOrThrow(S.distanceToPoint(A, Inside)), 0);
    const Degenerate = O.getOrThrow(S.corners(box(V.One, V.Zero)));
    Assert.ok(Degenerate.every((point) => V.equals(point, V.One)));
});

test("OBB support points maximize independently enumerated corner projections, including huge directions", () =>
{
    const A = box({ x: 2,
        y: -3,
        z: 4 }, { x: 2,
        y: 1,
        z: 0.3 }, angles(31, 43, -17));
    for (const Direction of [ V.Zero, V.UnitX, V.One, { x: -2,
        y: 3,
        z: -7 } ])
    {
        const Point = O.getOrThrow(pipe(A, S.supportPoint(Direction)));
        const Expected = Math.max(...O.getOrThrow(S.corners(A)).map((corner) => V.dot(corner, Direction)));
        Assert.ok(Math.abs(V.dot(Point, Direction) - Expected) < 1e-10);
    }

    close(O.getOrThrow(S.supportPoint(box(), V.Zero)), { x: -1,
        y: -1,
        z: -1 });
    close(O.getOrThrow(S.supportPoint(A, { x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: Number.MAX_VALUE })),
    O.getOrThrow(S.supportPoint(A, V.One)));
});

test("OBB overlap rejects enclosing-AABB false positives and requires an edge-cross separating axis", () =>
{
    const Half = { x: 2,
        y: 0.1,
        z: 0.1 };
    const Rotation = angles(0, 0, 45);
    const A = box(V.Zero, Half, Rotation);
    const BBox = box({ x: -0.4,
        y: 0.4,
        z: 0 }, Half, Rotation);
    Assert.equal(O.getOrThrow(B.overlaps(O.getOrThrow(S.toAABB(A)), O.getOrThrow(S.toAABB(BBox)))), true);
    Assert.equal(O.getOrThrow(S.overlaps(A, BBox)), false);
    const X = box(V.Zero, Half);
    const Y = box({ x: 0,
        y: 0.6,
        z: -0.6 }, Half,
    O.getOrThrow(Q.fromVectors(V.UnitX, V.One)));
    Assert.equal(faceAxesOverlap(X, Y), true);
    Assert.equal(O.getOrThrow(S.overlaps(X, Y)), false);
    Assert.equal(O.getOrThrow(pipe(Y, S.overlapsOBB(X))), false);
});

test("OBB overlap preserves touching, symmetry and point/line/plane degeneracies", () =>
{
    const A = box();
    Assert.equal(O.getOrThrow(S.overlaps(A, box({ x: 2,
        y: 0,
        z: 0 }), Exact)), true);
    Assert.equal(O.getOrThrow(S.overlaps(A, box({ x: 2 + 5e-10,
        y: 0,
        z: 0 }))), true);
    Assert.equal(O.getOrThrow(S.overlaps(A, box({ x: 2 + 5e-10,
        y: 0,
        z: 0 }), Exact)), false);
    Assert.equal(O.getOrThrow(S.overlaps(box(V.Zero, V.Zero), box(V.Zero, V.Zero, angles(11, 23, 47)), Exact)), true);
    Assert.equal(O.getOrThrow(S.overlaps(box(V.Zero, V.Zero), box(V.UnitX, V.Zero), Exact)), false);
    const Line = box(V.Zero, { x: 1,
        y: 0,
        z: 0 });
    const Crossing = box(V.Zero, { x: 1,
        y: 0,
        z: 0 }, angles(0, 0, 90));
    Assert.equal(O.getOrThrow(S.overlaps(Line, Crossing)), true);
    Assert.equal(O.getOrThrow(S.overlaps(Line, box({ x: 0,
        y: 0,
        z: 0.1 }, Crossing.halfExtents, Crossing.rotation))), false);
    const Plane = box(V.Zero, { x: 1,
        y: 1,
        z: 0 });
    Assert.equal(O.getOrThrow(S.overlaps(Plane, box(V.UnitZ, Plane.halfExtents))), false);
    Assert.equal(O.getOrThrow(S.overlaps(Plane, box(V.Zero, Plane.halfExtents, angles(0, 90, 0)))), true);
    for (let i = 0; i < 25; i++)
    {
        const Other = box({ x: i / 5,
            y: -i / 10,
            z: i / 20 }, { x: 0.4,
            y: 0.7,
            z: 0.2 }, angles(i * 19, i * 7, i * 13));
        Assert.equal(O.getOrThrow(S.overlaps(A, Other)), O.getOrThrow(S.overlaps(Other, A)));
    }
});

test("OBB overlap and containment scale finite differences without losing tiny common-origin separations", () =>
{
    const A = box({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, V.Zero);
    const BBox = box({ x: Number.MAX_VALUE,
        y: 1e-300,
        z: 0 }, V.Zero);
    Assert.equal(O.getOrThrow(S.overlaps(A, BBox, Exact)), false);
    Assert.equal(O.getOrThrow(S.containsPoint(A, BBox.center, Exact)), false);
    Assert.equal(O.getOrThrow(S.contains(A, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 })), false);
    Assert.equal(O.getOrThrow(S.overlaps(box(V.Zero, { x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: Number.MAX_VALUE }),
    box(V.Zero, V.One))), true);
    const Thin = B.AABBUnsafe({ x: Number.MIN_VALUE,
        y: 0,
        z: 0 }, { x: 2 * Number.MIN_VALUE,
        y: 0,
        z: 0 });
    Assert.equal(O.getOrThrow(S.overlapsAABB(box({ x: Number.MIN_VALUE,
        y: 0,
        z: 0 }, V.Zero), Thin, Exact)), true);
    Assert.equal(O.getOrThrow(S.overlapsAABB(box({ x: 3 * Number.MIN_VALUE,
        y: 0,
        z: 0 }, V.Zero), Thin, Exact)), false);
});

test("OBB AABB overlap agrees with direct identity boxes and rotated box point containment", () =>
{
    const A = box({ x: 2,
        y: 1,
        z: -3 }, { x: 2,
        y: 0.4,
        z: 0.8 }, angles(19, 31, 47));
    for (let i = 0; i < 20; i++)
    {
        const Center = { x: i / 4,
            y: -i / 7,
            z: -i / 3 };
        const Half = { x: 0.3,
            y: 0.7,
            z: 0.5 };
        const Bounds = O.getOrThrow(B.fromCenterHalfExtents(Center, Half));
        Assert.equal(O.getOrThrow(pipe(A, S.overlapsAABB(Bounds))), O.getOrThrow(S.overlaps(A, box(Center, Half))));
    }

    Assert.equal(O.getOrThrow(S.containsPoint(A, A.center)), true);
    Assert.equal(O.getOrThrow(pipe(A, S.contains({ x: -100,
        y: 0,
        z: 0 }))), false);
});

test("OBB rigid transformation preserves oriented geometry, corners and overlap", () =>
{
    const A = box({ x: 2,
        y: 1,
        z: -3 }, { x: 2,
        y: 0.4,
        z: 0.8 }, angles(19, 31, 47));
    const Frame = O.getOrThrow(T.Transform({ x: 5,
        y: -4,
        z: 7 }, angles(23, -41, 17)));
    const Moved = O.getOrThrow(pipe(A, S.transform(Frame)));
    close(Moved.halfExtents, A.halfExtents);
    const Original = O.getOrThrow(S.corners(A));
    const Transformed = O.getOrThrow(S.corners(Moved));
    Original.forEach((point, i) => close(Transformed[i], O.getOrThrow(T.transformPoint(Frame, point))));
    const Restored = O.getOrThrow(S.transform(Moved, O.getOrThrow(T.inverse(Frame))));
    close(Restored.center, A.center);
    Assert.ok(O.getOrThrow(Q.equalsApprox(Restored.rotation, A.rotation, 1e-10)));
    const Other = box({ x: 3,
        y: 1,
        z: -3 });
    Assert.equal(O.getOrThrow(S.overlaps(A, Other)),
        O.getOrThrow(S.overlaps(Moved, O.getOrThrow(S.transform(Other, Frame)))));
});

test("OBB ray intersections retain world distance/point and rotate unique normals with owned wrappers", () =>
{
    const A = box({ x: 10,
        y: 0,
        z: 0 }, { x: 2,
        y: 1,
        z: 0.5 }, angles(0, 90, 0));
    const Ray = O.getOrThrow(R.Ray({ x: 10,
        y: 0,
        z: -5 }, V.UnitZ));
    const Hit = O.getOrThrow(pipe(A, S.intersectRay(Ray)));
    Assert.ok(Math.abs(Hit.distance - 3) < 1e-12);
    close(Hit.point, O.getOrThrow(R.at(Ray, Hit.distance)));
    close(O.getOrThrow(Hit.normal), V.North);
    Assert.ok(Object.isFrozen(Hit) && Object.isFrozen(Hit.point) && Object.isFrozen(Hit.normal));
    const SharedNone = O.none();
    const WasFrozen = Object.isFrozen(SharedNone);
    const Inside = O.getOrThrow(S.intersectRay(A, R.RayUnsafe(A.center, V.UnitX)));
    Assert.equal(Inside.distance, 0);
    Assert.ok(O.isNone(Inside.normal) && Object.isFrozen(Inside.normal));
    Assert.notEqual(Inside.normal, SharedNone);
    Assert.equal(Object.isFrozen(SharedNone), WasFrozen);
    Assert.ok(O.isNone(S.intersectRay(A, R.RayUnsafe({ x: 10,
        y: 3,
        z: -5 }, V.UnitZ))));
    const PointBox = box(V.Zero, V.Zero);
    Assert.ok(O.isNone(O.getOrThrow(S.intersectRay(PointBox, R.RayUnsafe(V.West, V.UnitX))).normal));
});

test("OBB queries reject invalid domains/options and unrepresentable coordinates", () =>
{
    for (const A of [ S.OBBUnsafe(V.Zero, { x: -1,
        y: 0,
        z: 0 }, Q.Identity),
    S.OBBUnsafe({ x: Infinity,
        y: 0,
        z: 0 }, V.One, Q.Identity),
    S.OBBUnsafe(V.Zero, V.One, Q.QuatUnsafe(0, 0, 0, 0)),
    S.OBBUnsafe(V.Zero, { x: NaN,
        y: 1,
        z: 1 }, Q.Identity) ])
    {
        Assert.ok(!S.isValid(A));
        Assert.ok(O.isNone(S.OBB(A.center, A.halfExtents, A.rotation)));
        Assert.ok(O.isNone(S.toWorldPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.toLocalPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.corners(A)));
        Assert.ok(O.isNone(S.toAABB(A)));
        Assert.ok(O.isNone(S.closestPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.distanceToPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.supportPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.transform(A, T.Identity)));
        Assert.ok(O.isNone(S.overlaps(A, box())));
        Assert.ok(O.isNone(S.overlaps(box(), A)));
        Assert.ok(O.isNone(S.overlapsAABB(A, B.AABBUnsafe(V.Zero, V.One))));
        Assert.ok(O.isNone(S.containsPoint(A, V.Zero)));
        Assert.ok(O.isNone(S.intersectRay(A, R.RayUnsafe(V.Zero, V.UnitX))));
    }

    for (const Bad of [ -1, Infinity, NaN, null, "1" ])
    {
        const Options = { relativeTolerance: Bad as number };
        Assert.ok(O.isNone(S.overlaps(box(), box(), Options)));
        Assert.ok(O.isNone(S.containsPoint(box(), V.Zero, Options)));
        Assert.ok(O.isNone(S.overlapsAABB(box(), B.AABBUnsafe(V.Zero, V.One), Options)));
        Assert.ok(O.isNone(S.intersectRay(box(), R.RayUnsafe(V.Zero, V.UnitX), Options)));
    }

    Assert.ok(O.isNone(S.overlapsAABB(box(), B.AABBUnsafe(V.One, V.Zero))));
    Assert.ok(O.isNone(S.intersectRay(box(), R.RayUnsafe(V.Zero, V.One))));
    Assert.ok(O.isNone(S.supportPoint(box(), { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(S.corners(box({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: 1,
        z: 1 }))));
});

test("OBB exact center/extents and canonical rotation protocols preserve hash collections and kind boundaries", () =>
{
    const A = S.OBBUnsafe(V.Zero, V.One, { x: 1,
        y: 2,
        z: 3,
        w: 4 });
    const BBox = S.OBBUnsafe(V.Zero, V.One, { x: -2,
        y: -4,
        z: -6,
        w: -8 });
    Assert.ok(Equal.equals(A, BBox));
    Assert.ok(pipe(A, S.equals(BBox)));
    Assert.equal(Hash.hash(A), Hash.hash(BBox));
    Assert.equal(HashSet.size(HashSet.make(A, BBox)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "box" ]), BBox)), "box");
    Assert.equal(Equal.equals(box(), B.AABBUnsafe(V.scale(V.One, -1), V.One)), false);
    Assert.equal(Equal.equals(A, Q.Identity), false);
    Assert.equal(S.equals(box(), box(V.Zero, { x: 1 + 1e-15,
        y: 1,
        z: 1 })), false);
    for (const Bad of [ NaN, Infinity, -Infinity ])
    {
        const X = S.OBBUnsafe({ x: Bad,
            y: 0,
            z: 0 }, V.One, { x: Bad,
            y: 0,
            z: 0,
            w: 0 });
        const Y = S.OBBUnsafe({ x: Bad,
            y: -0,
            z: 0 }, V.One, { x: Bad,
            y: -0,
            z: 0,
            w: 0 });
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("OBB text, JSON and inspection retain raw rotation and coordinate precision", () =>
{
    const A = S.OBBUnsafe({ x: 1.1234567891234566,
        y: -2e-200,
        z: 3e200 },
    { x: 1,
        y: 0,
        z: 2 }, { x: 1,
        y: 2,
        z: 3,
        w: 4 });
    const Parsed = O.getOrThrow(S.parse(A.toString()));
    Assert.ok(S.equals(A, Parsed));
    Assert.ok(Q.equalsComponents(A.rotation, Parsed.rotation));
    Assert.equal(A.pipe(S.toString), A.toString());
    Assert.equal(S.format(box()), "OBB(0, 0, 0, 1, 1, 1, 0, 0, 0, 1)");
    const Json = A.toJSON() as S.Json;
    Assert.deepEqual(Json, { _id: "OBB",
        center: A.center.toJSON(),
        halfExtents: A.halfExtents.toJSON(),
        rotation: A.rotation.toJSON() });
    for (const Value of [ Json, Json.center, Json.halfExtents, Json.rotation ])
    {
        Assert.ok(Object.isFrozen(Value));
    }

    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    for (const Text of [ "", "OBB(0,0,0,-1,1,1,0,0,0,1)", "OBB(0,0,0,1,1,1,0,0,0,0)",
        "OBB(0,0,0,1,1,1,0,0,0,Infinity)", `${box().toString()}tail`, "OBB(0,0,0,1,1,1,0,0,1)" ])
    {
        Assert.ok(O.isNone(S.parse(Text)));
    }
});
