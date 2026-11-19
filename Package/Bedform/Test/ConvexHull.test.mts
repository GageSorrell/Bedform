/**
 * Convex solid topology, analytic mass properties and complete static queries.
 *
 * @module bedform/Test/ConvexHull.test
 *
 * @file      ConvexHull.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional topology ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as H from "bedform/ConvexHull";
import * as B from "bedform/AABB";
import * as S from "bedform/OBB";
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
 * Independent outward polygon cube fixture in binary xyz index order.
 *
 * @category Tests
 * @since 1.0.0
 */
const CubeFaces = [ [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ], [ 0, 4, 6, 2 ],
    [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ] ] as const;

/**
 * Independent coordinate vertices of a unit cube.
 *
 * @category Tests
 * @since 1.0.0
 */
const CubePoints = [ V.Zero, V.UnitX, V.UnitY, { x: 1,
    y: 1,
    z: 0 }, V.UnitZ,
{ x: 1,
    y: 0,
    z: 1 }, { x: 0,
    y: 1,
    z: 1 }, V.One ];

/**
 * Strict representable query comparisons for analytic fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const Exact: H.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };

/**
 * Compares finite coordinate components with an explicit numerical tolerance.
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
 * Constructs a validated indexed polygon cube.
 *
 * @category Tests
 * @since 1.0.0
 */
const cube = (): H.ConvexHull =>
{
    return O.getOrThrow(H.fromFaces(CubePoints, CubeFaces));
};

/**
 * Constructs a unit-axis tetrahedron from an unordered point cloud.
 *
 * @category Tests
 * @since 1.0.0
 */
const tetra = (): H.ConvexHull =>
{
    return O.getOrThrow(H.ConvexHull([ V.Zero, V.UnitX, V.UnitY, V.UnitZ ]));
};

test("ConvexHull public operation inventory and root/subpath exports are complete", () =>
{
    Assert.equal(Root.ConvexHull, H);
    Assert.deepEqual(Object.keys(H).filter((key) => typeof H[key as keyof typeof H] === "function").sort(), [
        "ConvexHull", "ConvexHullUnsafe", "bounds", "centroid", "closestPoint", "contains", "containsPoint",
        "distanceToPoint", "edges", "equals", "format", "fromAABB", "fromFaces", "fromOBB", "fromString",
        "intersectRay", "isConvexHull", "isValid", "overlaps", "overlapsAABB", "overlapsConvexHull", "overlapsOBB",
        "parse", "planes", "supportPoint", "toAABB", "toString", "transform", "volume"
    ].sort());
    Assert.equal(H.contains, H.containsPoint);
    Assert.equal(H.overlapsConvexHull, H.overlaps);
    Assert.equal(H.bounds, H.toAABB);
    Assert.equal(H.parse, H.fromString);
    Assert.equal(H.toString, H.format);
    Assert.equal(H.isConvexHull(null), false);
    Assert.equal(H.isConvexHull({ vertices: CubePoints,
        faces: CubeFaces }), false);
});

test("ConvexHull point clouds are deterministic with duplicates/interior points and reject lower dimensions", () =>
{
    const A = O.getOrThrow(H.ConvexHull(CubePoints));
    const BBox = O.getOrThrow(H.ConvexHull([ ...CubePoints ].reverse().concat([ V.Zero, V.One, { x: 0.4,
        y: 0.3,
        z: 0.2 } ])));
    Assert.ok(H.equals(A, BBox));
    Assert.equal(A.vertices.length, 8);
    Assert.equal(A.faces.length, 12);
    Assert.equal(O.getOrThrow(H.volume(A)), 1);
    for (const Points of [ [], [ V.Zero ], [ V.Zero, V.One ], [ V.Zero, V.One, { x: 2,
        y: 2,
        z: 2 } ],
    [ V.Zero, V.UnitX, V.UnitY, { x: 2,
        y: 3,
        z: 0 } ], [ V.Zero, V.UnitX, V.UnitY, { x: NaN,
        y: 0,
        z: 1 } ] ])
    {
        Assert.ok(O.isNone(H.ConvexHull(Points)));
    }

    Assert.ok(O.isNone(H.ConvexHull(new Array<V.Coordinates>(4))));
});

test("ConvexHull canonical indexed construction preserves polygon tessellation and deep caller isolation", () =>
{
    const Points = CubePoints.map((point) => ({ ...point }));
    const Faces = CubeFaces.map((face) => [ ...face ] as Array<number>);
    const A = O.getOrThrow(pipe(Points, H.fromFaces(Faces)));
    Assert.equal(A.faces.length, 6);
    Assert.equal(Object.isFrozen(Points), false);
    Assert.equal(Object.isFrozen(Faces), false);
    Assert.equal(Object.isFrozen(Faces[0]), false);
    Points[0].x = 99;
    Faces[0][0] = 99;
    Assert.equal(A.vertices[0].x, 0);
    Assert.ok(!A.faces.some((face) => face.includes(99)));
    Assert.ok(Object.isFrozen(A) && Object.isFrozen(A.vertices) && Object.isFrozen(A.faces));
    Assert.ok(A.vertices.every(Object.isFrozen) && A.faces.every(Object.isFrozen));
    const Reversed = [ ...CubePoints ].reverse();
    const Reindexed = [ ...CubeFaces ].reverse().map((face) =>
    {
        const Values = face.map((index) => 7 - index);
        return [ ...Values.slice(2), ...Values.slice(0, 2) ];
    });
    Assert.ok(H.equals(A, O.getOrThrow(H.fromFaces(Reversed, Reindexed))));
    Assert.equal(H.equals(A, O.getOrThrow(H.ConvexHull(CubePoints))), false);
});

test("ConvexHull indexed input rejects broken, inward, nonconvex, nonplanar and nonmanifold topology", () =>
{
    Assert.ok(O.isNone(H.fromFaces(CubePoints, CubeFaces.slice(1))));
    Assert.ok(O.isNone(H.fromFaces(CubePoints, [ ...CubeFaces, CubeFaces[0] ])));
    const Flipped = CubeFaces.map((face, i) => i === 0 ? [ ...face ].reverse() : [ ...face ]);
    Assert.ok(O.isNone(H.fromFaces(CubePoints, Flipped)));
    for (const InvalidFace of [ [ 0, 0, 1 ], [ 0, 2, 99 ], [ 0, 2, -1 ], [ 0, 2, 1.5 ], [ 0, 3, 2, 1 ] ])
    {
        Assert.ok(O.isNone(H.fromFaces(CubePoints, [ InvalidFace, ...CubeFaces.slice(1) ])));
    }

    const Nonplanar = CubePoints.map((point, i) => i === 7 ? { x: 1,
        y: 1,
        z: 1.1 } : point);
    Assert.ok(O.isNone(H.fromFaces(Nonplanar, CubeFaces)));
    const Concave = CubePoints.map((point, i) => i === 7 ? { x: 0.3,
        y: 0.3,
        z: 0.3 } : point);
    Assert.ok(O.isNone(H.fromFaces(Concave, CubeFaces)));
    Assert.ok(O.isNone(H.fromFaces([ ...CubePoints, { x: 0.5,
        y: 0.5,
        z: 0.5 } ], CubeFaces)));
    Assert.ok(O.isNone(H.fromFaces([ ...CubePoints, V.Zero ], CubeFaces)));
    Assert.ok(O.isNone(H.fromFaces(CubePoints.map((point) => ({ ...point,
        z: 0 })), CubeFaces)));
});

test("ConvexHull analytic volume/centroid and derived edges/planes agree for tetrahedra and polygon cubes", () =>
{
    const A = tetra();
    Assert.ok(Math.abs(O.getOrThrow(H.volume(A)) - 1 / 6) < 1e-15);
    close(O.getOrThrow(H.centroid(A)), { x: 0.25,
        y: 0.25,
        z: 0.25 });
    Assert.equal(O.getOrThrow(H.edges(A)).length, 6);
    const C = cube();
    Assert.equal(O.getOrThrow(H.volume(C)), 1);
    close(O.getOrThrow(H.centroid(C)), { x: 0.5,
        y: 0.5,
        z: 0.5 });
    const Edges = O.getOrThrow(H.edges(C));
    const Planes = O.getOrThrow(H.planes(C));
    Assert.equal(Edges.length, 12);
    Assert.equal(Planes.length, 6);
    Assert.ok(Object.isFrozen(Edges) && Edges.every(Object.isFrozen));
    Assert.ok(Object.isFrozen(Planes) && Planes.every(Object.isFrozen));
    Assert.ok(Edges.every((edge) => edge.start < edge.end));
    close(O.getOrThrow(H.bounds(C)).min, V.Zero);
    close(O.getOrThrow(H.toAABB(C)).max, V.One);
});

test("ConvexHull conditioned mass properties retain very small/large solids and large common origins", () =>
{
    for (const Scale of [ 1e-100, 1e100 ])
    {
        const A = O.getOrThrow(H.ConvexHull([ V.Zero, { x: Scale,
            y: 0,
            z: 0 },
        { x: 0,
            y: Scale,
            z: 0 }, { x: 0,
            y: 0,
            z: Scale } ]));
        const Expected = Scale * Scale * Scale / 6;
        Assert.ok(Math.abs(O.getOrThrow(H.volume(A)) / Expected - 1) < 1e-14);
        close(O.getOrThrow(H.centroid(A)), { x: Scale / 4,
            y: Scale / 4,
            z: Scale / 4 });
    }

    const Small = O.getOrThrow(H.ConvexHull([ V.Zero, { x: 1e-200,
        y: 0,
        z: 0 },
    { x: 0,
        y: 1e-200,
        z: 0 }, { x: 0,
        y: 0,
        z: 1e-200 } ]));
    Assert.ok(H.isValid(Small) && O.isNone(H.volume(Small)));
    const Wide = B.AABBUnsafe({ x: -Number.MAX_VALUE,
        y: 2e-200,
        z: 0 },
    { x: Number.MAX_VALUE,
        y: 3e-200,
        z: 1e-200 });
    Assert.equal(O.getOrThrow(H.overlapsAABB(Small, Wide, Exact)), false);
    const Thin = O.getOrThrow(H.ConvexHull([ V.Zero, V.UnitX, V.UnitY, { x: 0,
        y: 0,
        z: 1e-300 } ]));
    Assert.ok(Math.abs(O.getOrThrow(H.centroid(Thin)).z / 2.5e-301 - 1) < 1e-12);
    const M = 1e308;
    const Large = O.getOrThrow(H.ConvexHull([ { x: -M,
        y: 0,
        z: 0 }, { x: M,
        y: 0,
        z: 0 },
    { x: M,
        y: M,
        z: 0 }, { x: M,
        y: 0,
        z: M } ]));
    close(O.getOrThrow(H.centroid(Large)), { x: M / 2,
        y: M / 4,
        z: M / 4 });
    Assert.ok(O.isNone(H.volume(Large)));
    const Points = CubePoints.map((point) => ({ x: 1e100 + point.x * 1e85,
        y: 1e100 + point.y * 1e85,
        z: 1e100 + point.z * 1e85 }));
    const Translated = O.getOrThrow(H.ConvexHull(Points));
    Assert.ok(O.getOrThrow(H.volume(Translated)) > 0);
});

test("ConvexHull support uses exact finite dot comparisons and deterministic ties", () =>
{
    const A = tetra();
    close(O.getOrThrow(H.supportPoint(A, V.Zero)), A.vertices[0]);
    close(O.getOrThrow(pipe(A, H.supportPoint(V.UnitX))), V.UnitX);
    for (const Direction of [ V.One, { x: -3,
        y: 2,
        z: 7 }, V.Zero ])
    {
        const Point = O.getOrThrow(H.supportPoint(A, Direction));
        Assert.equal(V.dot(Point, Direction), Math.max(...A.vertices.map((vertex) => V.dot(vertex, Direction))));
    }

    close(O.getOrThrow(H.supportPoint(A, { x: Number.MAX_VALUE,
        y: 0,
        z: 0 })), V.UnitX);
    close(O.getOrThrow(H.supportPoint(A, { x: Number.MIN_VALUE,
        y: 0,
        z: 0 })), V.UnitX);
});

test("ConvexHull solid containment/nearest queries use boundary geometry rather than only bounds", () =>
{
    const A = tetra();
    Assert.equal(O.getOrThrow(H.containsPoint(A, { x: 0.1,
        y: 0.1,
        z: 0.1 })), true);
    const Outside = { x: 1,
        y: 1,
        z: 1 };
    Assert.equal(O.getOrThrow(pipe(A, H.contains(Outside))), false);
    Assert.equal(O.getOrThrow(B.containsPoint(O.getOrThrow(H.bounds(A)), Outside)), true);
    close(O.getOrThrow(pipe(A, H.closestPoint(Outside))), { x: 1 / 3,
        y: 1 / 3,
        z: 1 / 3 });
    Assert.ok(Math.abs(O.getOrThrow(pipe(A, H.distanceToPoint(Outside))) - 2 / Math.sqrt(3)) < 1e-12);
    const Inside = { x: 0.1,
        y: 0.2,
        z: 0.3 };
    Assert.equal(O.getOrThrow(H.distanceToPoint(A, Inside)), 0);
    Assert.deepEqual(O.getOrThrow(H.closestPoint(A, Inside)), V.Vector3Unsafe(Inside.x, Inside.y, Inside.z));
    close(O.getOrThrow(H.closestPoint(A, { x: -1,
        y: 0.25,
        z: 0.25 })), { x: 0,
        y: 0.25,
        z: 0.25 });
    close(O.getOrThrow(H.closestPoint(A, { x: -1,
        y: -1,
        z: -1 })), V.Zero);
    Assert.equal(O.getOrThrow(H.contains(cube(), { x: 1 + 5e-10,
        y: 0.5,
        z: 0.5 })), true);
    Assert.equal(O.getOrThrow(H.contains(cube(), { x: 1 + 5e-10,
        y: 0.5,
        z: 0.5 }, Exact)), false);
});

test("ConvexHull box conversions reject zero volume while overlap queries retain valid degenerate boxes", () =>
{
    const Bounds = B.AABBUnsafe(V.Zero, V.One);
    const Box = S.OBBUnsafe({ x: 0.5,
        y: 0.5,
        z: 0.5 }, { x: 0.5,
        y: 0.5,
        z: 0.5 }, Q.Identity);
    Assert.ok(Math.abs(O.getOrThrow(H.volume(O.getOrThrow(H.fromAABB(Bounds)))) - 1) < 1e-14);
    Assert.ok(Math.abs(O.getOrThrow(H.volume(O.getOrThrow(H.fromOBB(Box)))) - 1) < 1e-14);
    Assert.ok(O.isNone(H.fromAABB(B.AABBUnsafe(V.Zero, V.Zero))));
    Assert.ok(O.isNone(H.fromOBB(S.OBBUnsafe(V.Zero, { x: 1,
        y: 1,
        z: 0 }, Q.Identity))));
    Assert.equal(O.getOrThrow(H.overlapsAABB(tetra(), B.AABBUnsafe(V.Zero, V.Zero))), true);
    Assert.equal(O.getOrThrow(H.overlapsOBB(tetra(), S.OBBUnsafe(V.Zero, V.Zero, Q.Identity))), true);
    Assert.equal(O.getOrThrow(H.overlapsAABB(tetra(), B.AABBUnsafe(V.One, V.One))), false);
});

test("ConvexHull static SAT tests hull/hull and both box pairs beyond bounding-box proxies", () =>
{
    const A = tetra();
    const Small = B.AABBUnsafe({ x: 0.8,
        y: 0.8,
        z: 0.8 }, V.One);
    Assert.equal(O.getOrThrow(B.overlaps(O.getOrThrow(H.bounds(A)), Small)), true);
    Assert.equal(O.getOrThrow(pipe(A, H.overlapsAABB(Small))), false);
    const OBB = S.OBBUnsafe({ x: 0.9,
        y: 0.9,
        z: 0.9 }, { x: 0.1,
        y: 0.1,
        z: 0.1 }, Q.Identity);
    Assert.equal(O.getOrThrow(pipe(A, H.overlapsOBB(OBB))), false);
    const Other = O.getOrThrow(H.fromAABB(Small));
    Assert.equal(O.getOrThrow(pipe(A, H.overlapsConvexHull(Other))), false);
    Assert.equal(O.getOrThrow(H.overlaps(Other, A)), false);
    const Touch = O.getOrThrow(H.transform(cube(), T.TransformUnsafe(V.UnitX, Q.Identity)));
    Assert.equal(O.getOrThrow(H.overlaps(cube(), Touch)), true);
    const Gap = O.getOrThrow(H.transform(cube(), T.TransformUnsafe({ x: 1 + 5e-10,
        y: 0,
        z: 0 }, Q.Identity)));
    Assert.equal(O.getOrThrow(H.overlaps(cube(), Gap)), true);
    Assert.equal(O.getOrThrow(H.overlaps(cube(), Gap, Exact)), false);
});

test("ConvexHull SAT retains edge-cross separators and agrees with oriented-box fixtures", () =>
{
    const Half = { x: 2,
        y: 0.1,
        z: 0.1 };
    const A = S.OBBUnsafe(V.Zero, Half, Q.Identity);
    const BBox = S.OBBUnsafe({ x: 0,
        y: 0.6,
        z: -0.6 }, Half, O.getOrThrow(Q.fromVectors(V.UnitX, V.One)));
    const HA = O.getOrThrow(H.fromOBB(A));
    const HB = O.getOrThrow(H.fromOBB(BBox));
    Assert.equal(O.getOrThrow(H.overlaps(HA, HB)), false);
    Assert.equal(O.getOrThrow(H.overlapsOBB(HA, BBox)), false);
    for (let i = 0; i < 15; i++)
    {
        const Box = S.OBBUnsafe({ x: i / 4,
            y: -i / 10,
            z: i / 20 }, { x: 0.3,
            y: 0.7,
            z: 0.5 },
        O.getOrThrow(Q.fromEuler({ x: i * 17,
            y: i * 11,
            z: i * 23 })));
        Assert.equal(O.getOrThrow(H.overlapsOBB(HA, Box)), O.getOrThrow(S.overlaps(A, Box)));
    }
});

test("ConvexHull ray clipping returns first forward hits and distinguishes unique faces from ties", () =>
{
    const A = cube();
    const Ray = R.RayUnsafe({ x: -2,
        y: 0.5,
        z: 0.5 }, V.UnitX);
    const Hit = O.getOrThrow(pipe(A, H.intersectRay(Ray)));
    Assert.equal(Hit.distance, 2);
    close(Hit.point, { x: 0,
        y: 0.5,
        z: 0.5 });
    close(O.getOrThrow(Hit.normal), V.West);
    Assert.ok(Object.isFrozen(Hit) && Object.isFrozen(Hit.point) && Object.isFrozen(Hit.normal));
    const Boundary = O.getOrThrow(H.intersectRay(A, R.RayUnsafe({ x: 0,
        y: 0.5,
        z: 0.5 }, V.Up)));
    Assert.equal(Boundary.distance, 0);
    close(O.getOrThrow(Boundary.normal), V.West);
    const Tangent = O.getOrThrow(H.intersectRay(A, R.RayUnsafe({ x: -1,
        y: 0,
        z: 0.5 }, V.UnitX)));
    Assert.equal(Tangent.distance, 1);
    Assert.ok(O.isNone(Tangent.normal));
    const Triangles = O.getOrThrow(H.ConvexHull(CubePoints));
    close(O.getOrThrow(O.getOrThrow(H.intersectRay(Triangles, Ray)).normal), V.West);
    const SharedNone = O.none();
    const WasFrozen = Object.isFrozen(SharedNone);
    const Inside = O.getOrThrow(H.intersectRay(A, R.RayUnsafe({ x: 0.5,
        y: 0.5,
        z: 0.5 }, V.UnitX)));
    Assert.equal(Inside.distance, 0);
    Assert.ok(O.isNone(Inside.normal) && Object.isFrozen(Inside.normal));
    Assert.notEqual(Inside.normal, SharedNone);
    Assert.equal(Object.isFrozen(SharedNone), WasFrozen);
    const Corner = O.getOrThrow(H.intersectRay(A, O.getOrThrow(R.Ray({ x: -1,
        y: -1,
        z: -1 }, V.One))));
    Assert.ok(O.isNone(Corner.normal));
    Assert.ok(O.isNone(H.intersectRay(A, R.RayUnsafe({ x: -2,
        y: 2,
        z: 0.5 }, V.UnitX))));
    Assert.ok(O.isNone(H.intersectRay(A, R.RayUnsafe({ x: -2,
        y: 0.5,
        z: 0.5 }, V.West))));
});

test("ConvexHull rigid mapping preserves indexed topology, volume, centroid and ray covariance", () =>
{
    const A = cube();
    const Pose = T.TransformUnsafe({ x: 5,
        y: -3,
        z: 7 }, O.getOrThrow(Q.fromEuler({ x: 31,
        y: 47,
        z: -19 })));
    const Moved = O.getOrThrow(pipe(A, H.transform(Pose)));
    Assert.equal(Moved.faces.length, A.faces.length);
    Assert.equal(Moved.vertices.length, A.vertices.length);
    Assert.ok(Math.abs(O.getOrThrow(H.volume(Moved)) - 1) < 1e-12);
    close(O.getOrThrow(H.centroid(Moved)), O.getOrThrow(T.transformPoint(Pose, { x: 0.5,
        y: 0.5,
        z: 0.5 })));
    const Ray = R.RayUnsafe({ x: -2,
        y: 0.3,
        z: 0.4 }, V.UnitX);
    const Hit = O.getOrThrow(H.intersectRay(A, Ray));
    const World = O.getOrThrow(H.intersectRay(Moved, O.getOrThrow(R.transform(Ray, Pose))));
    Assert.ok(Math.abs(World.distance - Hit.distance) < 1e-12);
    close(World.point, O.getOrThrow(T.transformPoint(Pose, Hit.point)));
    close(O.getOrThrow(World.normal), O.getOrThrow(T.transformDirection(Pose, O.getOrThrow(Hit.normal))));
});

test("ConvexHull unsafe values defer topology validation and mutable structural inputs are never cached", () =>
{
    const Points = CubePoints.map((point) => ({ ...point }));
    const Faces = CubeFaces.map((face) => [ ...face ] as Array<number>);
    const Raw = H.ConvexHullUnsafe(Points, Faces);
    Assert.ok(H.isValid(Raw));
    Points[0].x = 99;
    Faces[0][0] = 99;
    Assert.equal(Raw.vertices[0].x, 0);
    Assert.ok(H.isValid(Raw));
    const Structural = { vertices: CubePoints.map((point) => ({ ...point })),
        faces: CubeFaces.map((face) => [ ...face ] as Array<number>) };
    Assert.ok(H.isValid(Structural));
    Structural.faces.pop();
    Assert.equal(H.isValid(Structural), false);
    const Bad = H.ConvexHullUnsafe([ { x: NaN,
        y: 0,
        z: 0 } ], [ [ NaN, 1, 2 ] ]);
    Assert.ok(H.isConvexHull(Bad));
    Assert.equal(H.isValid(Bad), false);
    for (const Value of [ Bad, H.ConvexHullUnsafe(CubePoints), H.ConvexHullUnsafe([], []) ])
    {
        Assert.ok(O.isNone(H.bounds(Value)));
        Assert.ok(O.isNone(H.volume(Value)));
        Assert.ok(O.isNone(H.centroid(Value)));
        Assert.ok(O.isNone(H.edges(Value)));
        Assert.ok(O.isNone(H.planes(Value)));
        Assert.ok(O.isNone(H.supportPoint(Value, V.One)));
        Assert.ok(O.isNone(H.contains(Value, V.Zero)));
        Assert.ok(O.isNone(H.closestPoint(Value, V.Zero)));
        Assert.ok(O.isNone(H.distanceToPoint(Value, V.Zero)));
        Assert.ok(O.isNone(H.transform(Value, T.Identity)));
        Assert.ok(O.isNone(H.overlaps(Value, cube())));
        Assert.ok(O.isNone(H.overlaps(cube(), Value)));
        Assert.ok(O.isNone(H.overlapsAABB(Value, B.AABBUnsafe(V.Zero, V.One))));
        Assert.ok(O.isNone(H.overlapsOBB(Value, S.OBBUnsafe(V.Zero, V.One, Q.Identity))));
        Assert.ok(O.isNone(H.intersectRay(Value, R.RayUnsafe(V.Zero, V.UnitX))));
    }
});

test("ConvexHull invalid query options/rays/points remain None rather than valid negative answers", () =>
{
    const A = cube();
    for (const Bad of [ -1, Infinity, NaN, null, "1" ])
    {
        const Options = { absoluteTolerance: Bad as number };
        Assert.ok(O.isNone(H.contains(A, V.Zero, Options)));
        Assert.ok(O.isNone(H.overlaps(A, A, Options)));
        Assert.ok(O.isNone(H.overlapsAABB(A, B.AABBUnsafe(V.Zero, V.One), Options)));
        Assert.ok(O.isNone(H.overlapsOBB(A, S.OBBUnsafe(V.Zero, V.One, Q.Identity), Options)));
        Assert.ok(O.isNone(H.intersectRay(A, R.RayUnsafe(V.Zero, V.UnitX), Options)));
    }

    Assert.ok(O.isNone(H.intersectRay(A, R.RayUnsafe(V.Zero, V.One))));
    Assert.ok(O.isNone(H.supportPoint(A, { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(H.contains(A, { x: Infinity,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(H.closestPoint(A, { x: NaN,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(H.overlapsAABB(A, B.AABBUnsafe(V.One, V.Zero))));
    Assert.ok(O.isNone(H.transform(A, T.TransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0)))));
});

test("ConvexHull exact topology protocols, frozen JSON, text and inspection retain all stored precision", () =>
{
    const A = cube();
    const Same = O.getOrThrow(H.parse(A.toString()));
    Assert.ok(Equal.equals(A, Same));
    Assert.ok(pipe(A, H.equals(Same)));
    Assert.equal(Hash.hash(A), Hash.hash(Same));
    Assert.equal(HashSet.size(HashSet.make(A, Same)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "solid" ]), Same)), "solid");
    Assert.equal(Equal.equals(A, B.AABBUnsafe(V.Zero, V.One)), false);
    Assert.equal(A.pipe(H.toString), A.toString());
    const Json = A.toJSON() as H.Json;
    Assert.ok(Object.isFrozen(Json) && Object.isFrozen(Json.vertices) && Object.isFrozen(Json.faces));
    Assert.ok(Json.vertices.every(Object.isFrozen) && Json.faces.every(Object.isFrozen));
    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    const Raw = H.ConvexHullUnsafe([ { x: NaN,
        y: -0,
        z: Infinity } ], [ [ NaN, -0, Infinity ] ]);
    const Other = H.ConvexHullUnsafe([ { x: NaN,
        y: 0,
        z: Infinity } ], [ [ NaN, 0, Infinity ] ]);
    Assert.ok(Equal.equals(Raw, Other));
    Assert.equal(Hash.hash(Raw), Hash.hash(Other));
    for (const Text of [ "", "ConvexHull(|)", `${A.toString()}tail`, A.toString().replace("[0, 0, 0]", "[NaN, 0, 0]"),
        "ConvexHull([0,0,0]|[0,1,2])", A.toString().replace("|", "||") ])
    {
        Assert.ok(O.isNone(H.parse(Text)));
    }
});
