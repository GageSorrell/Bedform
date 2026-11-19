/**
 * Independent authoritative collision, model-boundary and continuous-motion fixtures.
 *
 * @module bedform/Test/Collision.test
 *
 * @file      Collision.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures preserve geometric ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as C from "bedform/Collision";
import * as S from "bedform/CollisionShape";
import * as P from "bedform/CollisionBroadPhase";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import * as B from "bedform/AABB";
import * as H from "bedform/ConvexHull";
import * as Q from "bedform/Quat";
import * as T from "bedform/Transform";
import * as RT from "bedform/RigidTransform";
import * as V from "bedform/Vector3";
import * as OBB from "bedform/OBB";
import * as Rendering from "bedform/PhysicsRenderer";
import { partition, type Surface } from "../Source/Build/Solid.js";

test("convex CCD certifies parallel clearance without exhausting the advancement budget", () =>
{
    const A = instance(primitive("box"));
    const Bv = instance(primitive("box"), V.Vector3Unsafe(0, 1.001, 0));
    const Result = C.sweep({ shape: A.shape,
        state: RT.RigidTransformUnsafe(V.Zero, Q.Identity, V.Vector3Unsafe(100, 0, 0), V.Zero) },
    { shape: Bv.shape,
        state: RT.RigidTransformUnsafe(Bv.pose.position, Q.Identity, V.Zero, V.Zero) }, 0.05, { maxCcdIterations: 2 });
    Assert.ok(R.isSuccess(Result));
    Assert.ok(O.isNone(R.getOrThrow(Result)));
    const Hit = R.getOrThrow(C.sweep({ shape: A.shape,
        state: RT.RigidTransformUnsafe(V.Zero, Q.Identity, V.Vector3Unsafe(0, 100, 0), V.Zero) },
    { shape: Bv.shape,
        state: RT.RigidTransformUnsafe(Bv.pose.position, Q.Identity, V.Zero, V.Zero) }, 0.05));
    Assert.ok(O.isSome(Hit));
    Assert.ok(Hit.value.time < 0.00002);
});
test("polyhedral contacts and cached bounds agree with independent OBB math across rotations and translations", () =>
{
    let seed = 0x415343;
    const Random = (): number =>
    {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    for (let index = 0; index < 160; index++)
    {
        const HalfA = V.Vector3Unsafe(0.05 + Random(), 0.05 + Random(), 0.05 + Random());
        const HalfB = V.Vector3Unsafe(0.05 + Random(), 0.05 + Random(), 0.05 + Random());
        const RotationA = O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(Random() * 360, Random() * 360, Random() * 360)));
        const RotationB = O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(Random() * 360, Random() * 360, Random() * 360)));
        const PositionA = V.Vector3Unsafe(index % 2 ? 1e7 : 0, -1e7, 17);
        const PositionB = V.add(PositionA, V.Vector3Unsafe(Random() * 4 - 2, Random() * 4 - 2, Random() * 4 - 2));
        const A = instance(primitive("box", HalfA), PositionA, RotationA);
        const Bv = instance(primitive("box", HalfB), PositionB, RotationB);
        const Expected = O.getOrThrow(OBB.overlaps(OBB.OBBUnsafe(PositionA, HalfA, RotationA), OBB.OBBUnsafe(PositionB, HalfB, RotationB)));
        const Contacts = R.getOrThrow(C.collide(A, Bv));
        Assert.equal(Contacts.length > 0, Expected);
        const Bound = R.getOrThrow(C.bounds(A));
        const Independent = O.getOrThrow(B.transform(B.AABBUnsafe(V.scale(HalfA, -1), HalfA), A.pose));
        for (const Axis of [ "x", "y", "z" ] as const)
        {
            Assert.ok(Math.abs(Bound.min[Axis] - Independent.min[Axis]) < 1e-7);
            Assert.ok(Math.abs(Bound.max[Axis] - Independent.max[Axis]) < 1e-7);
        }

        Assert.deepEqual(R.getOrThrow(C.collide(A, { ...Bv,
            pose: T.TransformUnsafe(PositionB, Q.negate(RotationB)) })), Contacts);
    }

    const Mutable = { position: { x: 0,
        y: 0,
        z: 0 },
    rotation: { x: 0,
        y: 0,
        z: 0,
        w: 1 } };
    const A = instance(primitive("box"));
    const Bv = { shape: A.shape,
        pose: Mutable };
    Assert.ok(R.getOrThrow(C.collide(A, Bv)).length > 0);
    Mutable.position.x = 100;
    Assert.equal(R.getOrThrow(C.collide(A, Bv)).length, 0);
});

/**
 * Validated primitive fixture with explicit authored collider pose.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const primitive = (kind: S.CollisionShape.Primitive["kind"], half = V.Vector3Unsafe(0.5, 0.5, 0.5), pose = T.Identity): S.CollisionShape.Primitive =>
{
    return R.getOrThrow(S.primitive(kind, half, pose));
};

/**
 * Compiles one public shape into a placed authoritative collider.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const instance = (shape: S.CollisionShape, position = V.Zero, rotation = Q.Identity): C.Instance =>
{
    return { shape: R.getOrThrow(C.prepare(shape)),
        pose: T.TransformUnsafe(position, rotation) };
};

/**
 * Independently triangulated box boundary with original face provenance.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const box = (min: V.Coordinates, max: V.Coordinates): Surface =>
{
    const Vertices = Array.from({ length: 8 }, (_, i) => V.Vector3Unsafe(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
    const Faces = [ [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ], [ 0, 4, 6, 2 ], [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ] ];
    return { vertices: Vertices,
        triangles: Faces.flatMap((f, face) => [ [ f[0], f[1], f[2] ], [ f[0], f[2], f[3] ] ].map((indices) => ({ indices: indices as [
            number,
            number,
            number
        ],
        source: { object: "box",
            face } }))) };
};

/**
 * Explicit numerical comparison of analytic geometry, not implementation snapshots.
 *
 * @category Tests
 * @since 1.0.0
 */
const near = (actual: number, expected: number, tolerance = 2e-5): void =>
{
    Assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
};

test("all ordered shape pairings support rotated separation and penetration", () =>
{
    const Hull = O.getOrThrow(H.fromAABB({ min: V.Vector3Unsafe(-0.5, -0.5, -0.5),
        max: V.Vector3Unsafe(0.5, 0.5, 0.5) }));
    const Shapes: Array<S.CollisionShape> = [ primitive("box"), primitive("sphere"), primitive("ellipsoid", V.Vector3Unsafe(0.7, 0.45, 0.3)),
        primitive("capsule", V.Vector3Unsafe(0.3, 0.5, 0.3)),
        { kind: "complex",
            cells: [ { hull: Hull,
                internalFaces: Hull.faces.map(() => false),
                sources: [ "fixture" ] } ] },
        { kind: "compound",
            children: [ primitive("sphere", V.Vector3Unsafe(0.45, 0.45, 0.45), T.TransformUnsafe(V.Vector3Unsafe(-0.3, 0, 0), Q.Identity)),
                primitive("sphere", V.Vector3Unsafe(0.45, 0.45, 0.45), T.TransformUnsafe(V.Vector3Unsafe(0.3, 0, 0), Q.Identity)) ] } ];
    const Rotation = O.getOrThrow(Q.fromAxisAngle(V.UnitY, 0.37));
    for (const [ I, Left ] of Shapes.entries())
    {
        for (const [ J, Right ] of Shapes.entries())
        {
            const A = instance(Left);
            const Far = instance(Right, V.Vector3Unsafe(4, 0.1, 0), Rotation);
            const Near = { ...Far,
                pose: T.TransformUnsafe(V.Vector3Unsafe(0.15, 0.1, 0.05), Rotation) };
            const Distance = R.getOrThrow(C.distance(A, Far));
            Assert.ok(Distance.distance > 2, `${I}/${J} must be separated`);
            Assert.equal(R.getOrThrow(C.collide(A, Far)).length, 0);
            const Span = [ 0.5, 0.5, 0.7, 0.3, 0.5, 0.75 ];
            const Touching = { ...Far,
                pose: T.TransformUnsafe(V.Vector3Unsafe(Span[I] + Span[J], 0, 0), Q.Identity) };
            Assert.ok(R.getOrThrow(C.collide(A, Touching)).length, `touching ${I}/${J}`);
            const Collision = C.collide(A, Near);
            Assert.ok(R.isSuccess(Collision), `${I}/${J}: ${JSON.stringify(Collision)}`);
            Assert.ok(R.getOrThrow(Collision).length, `${I}/${J} must collide`);
            near(R.getOrThrow(C.distance(A, Near)).distance, 0);
        }
    }
});
test("analytic sphere/capsule witnesses, four-point box clipping and curried overloads", () =>
{
    const Sphere = instance(primitive("sphere"));
    const Other = { ...Sphere,
        pose: T.TransformUnsafe(V.Vector3Unsafe(0.8, 0, 0), Q.Identity) };
    const Patch = R.getOrThrow(C.collide(Other)(Sphere))[0];
    near(Patch.normal.x, 1);
    near(Patch.contacts[0].depth, 0.2);
    near(Patch.contacts[0].pointA.x, 0.5);
    near(Patch.contacts[0].pointB.x, 0.3);
    const Ground = instance(primitive("box", V.Vector3Unsafe(2, 0.5, 2)));
    const Crate = instance(primitive("box"), V.Vector3Unsafe(0, 0.9, 0));
    const Manifold = R.getOrThrow(C.collide(Ground, Crate))[0];
    near(Manifold.normal.y, 1);
    Assert.equal(Manifold.contacts.length, 4);
    Manifold.contacts.forEach((c) => near(c.depth, 0.1));
    Assert.deepEqual(C.distance(Ground, Crate), C.distance(Crate)(Ground));
    Assert.ok(Object.isFrozen(Manifold.contacts[0]));
    Assert.equal(new Set(Manifold.contacts.map((c) => c.feature)).size, 4);
    const RotatedCapsule = primitive("capsule", V.Vector3Unsafe(0.2, 1, 0.2), T.TransformUnsafe(V.Zero, O.getOrThrow(Q.fromAxisAngle(V.UnitZ, Math.PI / 2))));
    const Coincident = R.getOrThrow(C.collide(instance(RotatedCapsule), instance(RotatedCapsule)))[0];
    near(Coincident.normal.x, 0);
});
test("rotated boxes agree with independent SAT and boundary-touching patches remain valid", () =>
{
    let seed = 91;
    const Random = (): number =>
    {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    for (let i = 0; i < 120; i++)
    {
        const Half = V.Vector3Unsafe(0.2 + Random(), 0.2 + Random(), 0.2 + Random());
        const Axis = V.Vector3Unsafe(Random(), Random(), Random());
        const Rotation = O.getOrThrow(Q.fromAxisAngle(Axis, Random() * Math.PI));
        const Center = V.Vector3Unsafe(Random() * 4 - 2, Random() * 4 - 2, Random() * 4 - 2);
        const A = instance(primitive("box", Half));
        const Bv = instance(primitive("box", Half), Center, Rotation);
        const Expected = O.getOrThrow(H.overlapsOBB(O.getOrThrow(H.fromOBB(OBB.OBBUnsafe(V.Zero, Half, Q.Identity))), OBB.OBBUnsafe(Center, Half, Rotation)));
        Assert.equal(R.getOrThrow(C.collide(A, Bv)).length > 0, Expected, `SAT fixture ${i}`);
    }

    const Ground = instance(primitive("box", V.Vector3Unsafe(2, 0.5, 2)));
    const Touching = instance(primitive("box"), V.Vector3Unsafe(0.7, 1, 0.3), O.getOrThrow(Q.fromAxisAngle(V.UnitY, 0.3)));
    const Contact = R.getOrThrow(C.collide(Ground, Touching));
    Assert.ok(Contact.length);
    Contact.forEach((m) => m.contacts.forEach((c) => near(c.depth, 0)));
});
test("concavity, narrow openings, cavities, disconnected solids and partition seams remain physical", () =>
{
    const Outer = box(V.Zero, V.Vector3Unsafe(3, 3, 3));
    const Inner = box(V.One, V.Vector3Unsafe(2, 2, 2));
    const Cavity: Surface = { vertices: [ ...Outer.vertices, ...Inner.vertices ],
        triangles: [ ...Outer.triangles,
            ...Inner.triangles.map((t) => ({ ...t,
                indices: [ t.indices[0] + 8, t.indices[2] + 8, t.indices[1] + 8 ] as [
                    number,
                    number,
                    number
                ] })) ] };
    const Complex = instance({ kind: "complex",
        cells: partition([ Cavity ], true).cells });
    const Small = primitive("sphere", V.Vector3Unsafe(0.1, 0.1, 0.1));
    Assert.equal(R.getOrThrow(C.collide(Complex, instance(Small, V.Vector3Unsafe(1.5, 1.5, 1.5)))).length, 0);
    const Wall = R.getOrThrow(C.collide(Complex, instance(Small, V.Vector3Unsafe(1.05, 1.5, 1.5))));
    Assert.ok(Wall.length);
    Assert.ok(Wall.some((m) => m.normal.x > 0.99));
    const FloorCells = partition([ box(V.Vector3Unsafe(-2, -1, -1), V.Vector3Unsafe(0, 0, 1)), box(V.Vector3Unsafe(0, -1, -1), V.Vector3Unsafe(2, 0, 1)) ], false).cells;
    const Floor = instance({ kind: "complex",
        cells: FloorCells });
    for (const X of [ -0.1, 0, 0.1 ])
    {
        const Contact = R.getOrThrow(C.collide(Floor, instance(primitive("sphere", V.Vector3Unsafe(0.3, 0.3, 0.3)), V.Vector3Unsafe(X, 0.2, 0))));
        Assert.ok(Contact.length);
        Contact.forEach((m) =>
        {
            near(m.normal.y, 1);
            m.contacts.forEach((c) => near(c.depth, 0.1));
        });
    }

    const Ring = instance({ kind: "complex",
        cells: partition([ box(V.Zero, V.Vector3Unsafe(1, 3, 1)),
            box(V.Vector3Unsafe(2, 0, 0), V.Vector3Unsafe(3, 3, 1)), box(V.Vector3Unsafe(1, 0, 0), V.Vector3Unsafe(2, 1, 1)),
            box(V.Vector3Unsafe(1, 2, 0), V.Vector3Unsafe(2, 3, 1)) ], false).cells });
    Assert.ok(R.getOrThrow(C.distance(Ring, instance(Small, V.Vector3Unsafe(1.5, 1.5, 0.5)))).distance > 0.39);
    const Disconnected = instance({ kind: "compound",
        children: [ primitive("sphere", V.One, T.TransformUnsafe(V.Vector3Unsafe(-3, 0, 0), Q.Identity)),
            primitive("sphere", V.One, T.TransformUnsafe(V.Vector3Unsafe(3, 0, 0), Q.Identity)) ] });
    Assert.equal(R.getOrThrow(C.collide(Disconnected, instance(Small))).length, 0);
});
test("equivalent cuboid unions and mesh solids produce the same rotated exterior response", () =>
{
    const Union = { kind: "complex" as const,
        cells: partition([ box(V.Vector3Unsafe(-2, -1, -1), V.Vector3Unsafe(1, 0, 1)),
            box(V.Vector3Unsafe(-1, -1, -1), V.Vector3Unsafe(2, 0, 1)) ], false).cells };
    const Mesh = { kind: "complex" as const,
        cells: partition([ box(V.Vector3Unsafe(-2, -1, -1), V.Vector3Unsafe(2, 0, 1)) ], true).cells };
    const Rotation = O.getOrThrow(Q.fromAxisAngle(V.UnitX, 0.3));
    const Position = V.Vector3Unsafe(3, 2, 1);
    const Pose = T.TransformUnsafe(Position, Rotation);
    const A = instance(Union, Position, Rotation);
    const Bv = instance(Mesh, Position, Rotation);
    const Up = O.getOrThrow(Q.rotateVector(Rotation, V.Up));
    for (const X of [ -1.1, -1, -0.9, 0.9, 1, 1.1 ])
    {
        const Sphere = instance(primitive("sphere", V.Vector3Unsafe(0.3, 0.3, 0.3)), O.getOrThrow(T.transformPoint(Pose, V.Vector3Unsafe(X, 0.2, 0))));
        const Left = R.getOrThrow(C.collide(A, Sphere));
        const Right = R.getOrThrow(C.collide(Bv, Sphere));
        Assert.equal(Left.length, Right.length);
        for (const Patch of Left)
        {
            near(Patch.normal.x, Up.x);
            near(Patch.normal.y, Up.y);
            near(Patch.normal.z, Up.z);
            Patch.contacts.forEach((c) => near(c.depth, 0.1));
        }

        near(R.getOrThrow(C.distance(A, Sphere)).distance, R.getOrThrow(C.distance(Bv, Sphere)).distance);
    }
});
test("CCD catches thin walls, rotation-only impacts, full turns and offset-COM motion", () =>
{
    const Sphere = instance(primitive("sphere", V.Vector3Unsafe(0.25, 0.25, 0.25)));
    const Wall = instance(primitive("box", V.Vector3Unsafe(0.01, 2, 2)));
    const Moving: C.Motion = { shape: Sphere.shape,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(-10, 0, 0), Q.Identity, V.Vector3Unsafe(200, 0, 0), V.Zero) };
    const Static: C.Motion = { shape: Wall.shape,
        state: RT.Identity };
    const Hit = O.getOrThrow(R.getOrThrow(C.sweep(Moving, Static, 0.1)));
    near(Hit.time, (10 - 0.26) / 200, 1e-6);
    Assert.ok(O.isNone(R.getOrThrow(C.sweep({ ...Moving,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(-10, 0, 0), Q.Identity, V.Vector3Unsafe(-200, 0, 0), V.Zero) }, Static, 0.1))));
    const Rod = instance(primitive("box", V.Vector3Unsafe(0.1, 0.1, 2)));
    const Rotating: C.Motion = { shape: Rod.shape,
        state: RT.RigidTransformUnsafe(V.Zero, Q.Identity, V.Zero, V.Vector3Unsafe(0, Math.PI * 2, 0)) };
    const Target: C.Motion = { shape: Sphere.shape,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(1.5, 0, 0), Q.Identity, V.Zero, V.Zero) };
    const RotationHit = O.getOrThrow(R.getOrThrow(C.sweep(Target, 1)(Rotating)));
    Assert.ok(RotationHit.time > 0 && RotationHit.time < 0.25);
    const Orbiting: C.Motion = { shape: Sphere.shape,
        centerOfMass: V.UnitX,
        state: RT.RigidTransformUnsafe(V.Zero, Q.Identity, V.Vector3Unsafe(0, 0, Math.PI), V.Vector3Unsafe(0, Math.PI, 0)) };
    const OrbitTarget = { ...Target,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(1, 0, 1), Q.Identity, V.Zero, V.Zero) };
    Assert.ok(O.isSome(R.getOrThrow(C.sweep(Orbiting, OrbitTarget, 0.6))));
    const Swept = R.getOrThrow(C.sweptBounds(1)(Rotating));
    Assert.ok(O.getOrThrow(B.containsPoint(Swept, V.Vector3Unsafe(2, 0, 0))));
    const BothSides = instance({ kind: "compound",
        children: [ primitive("sphere", V.Vector3Unsafe(0.1, 0.1, 0.1), T.TransformUnsafe(V.Vector3Unsafe(-1, 0, 0), Q.Identity)),
            primitive("sphere", V.Vector3Unsafe(0.1, 0.1, 0.1), T.TransformUnsafe(V.Vector3Unsafe(5, 0, 0), Q.Identity)) ] });
    Assert.ok(O.isSome(R.getOrThrow(C.sweep({ shape: Sphere.shape,
        state: RT.RigidTransformUnsafe(V.Zero, Q.Identity, V.Vector3Unsafe(10, 0, 0), V.Zero) }, { shape: BothSides.shape,
        state: RT.Identity }, 1))));
});
test("all shape CCD pairings and a cavity pass use exact leaves rather than enclosing bounds", () =>
{
    const Hull = O.getOrThrow(H.fromAABB({ min: V.Vector3Unsafe(-0.5, -0.5, -0.5),
        max: V.Vector3Unsafe(0.5, 0.5, 0.5) }));
    const Registrations: Array<S.CollisionShape> = [ primitive("box"), primitive("sphere"), primitive("ellipsoid", V.Vector3Unsafe(0.7, 0.45, 0.3)),
        primitive("capsule", V.Vector3Unsafe(0.3, 0.5, 0.3)), { kind: "complex",
            cells: [ { hull: Hull,
                internalFaces: Hull.faces.map(() => false),
                sources: [] } ] },
        { kind: "compound",
            children: [ primitive("sphere"), primitive("box", V.Vector3Unsafe(0.2, 0.2, 0.2), T.TransformUnsafe(V.UnitX, Q.Identity)) ] } ];
    const Shapes = Registrations.map((s) => R.getOrThrow(C.prepare(s)));
    for (const A of Shapes)
    {
        for (const Bv of Shapes)
        {
            const Moving = { shape: A,
                state: RT.RigidTransformUnsafe(V.Vector3Unsafe(-4, 0, 0), Q.Identity, V.Vector3Unsafe(10, 0, 0), V.Zero) };
            Assert.ok(O.isSome(R.getOrThrow(C.sweep(Moving, { shape: Bv,
                state: RT.Identity }, 1))));
        }
    }

    const Ring = instance({ kind: "complex",
        cells: partition([ box(V.Zero, V.Vector3Unsafe(1, 3, 1)),
            box(V.Vector3Unsafe(2, 0, 0), V.Vector3Unsafe(3, 3, 1)), box(V.Vector3Unsafe(1, 0, 0), V.Vector3Unsafe(2, 1, 1)),
            box(V.Vector3Unsafe(1, 2, 0), V.Vector3Unsafe(2, 3, 1)) ], false).cells });
    const Small = instance(primitive("sphere", V.Vector3Unsafe(0.1, 0.1, 0.1)));
    const Passing = { shape: Small.shape,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(1.5, 1.5, -2), Q.Identity, V.Vector3Unsafe(0, 0, 5), V.Zero) };
    Assert.ok(O.isNone(R.getOrThrow(C.sweep(Passing, { shape: Ring.shape,
        state: RT.Identity }, 1))));
});
test("dynamic AABB index agrees with brute force after insert, reinsert, removal and snapshots", () =>
{
    const Tree = R.getOrThrow(P.make());
    const Entries = new Map<string, P.Entry>();
    for (let i = 0; i < 100; i++)
    {
        const Entry: P.Entry = { id: String(i).padStart(3, "0"),
            mode: i % 4 === 0 ? "static" : "dynamic",
            bounds: B.AABBUnsafe(V.Vector3Unsafe(i % 10, Math.floor(i / 10), 0), V.Vector3Unsafe(i % 10 + 1.1, Math.floor(i / 10) + 1.1, 1)) };
        R.getOrThrow(P.set(Tree, Entry));
        Entries.set(Entry.id, Entry);
    }

    const Before = R.getOrThrow(P.snapshot(Tree));
    for (let i = 0; i < 100; i += 3)
    {
        const Id = String(i).padStart(3, "0");
        R.getOrThrow(P.remove(Id)(Tree));
        Entries.delete(Id);
    }

    for (const [ Id, Entry ] of Entries)
    {
        const Updated = { ...Entry,
            bounds: O.getOrThrow(B.expand(Entry.bounds, Id.endsWith("1") ? 0.01 : 0.5)) };
        R.getOrThrow(P.set(Updated)(Tree));
        Entries.set(Id, Updated);
    }

    const Expected = [ ...Entries.values() ].flatMap((a) => [ ...Entries.values() ].filter((b) => a.id < b.id && !(a.mode === "static" && b.mode === "static") &&
        O.getOrThrow(B.overlaps(a.bounds, b.bounds, { absoluteTolerance: 0,
            relativeTolerance: 0 }))).map((b) => ({ first: a.id,
        second: b.id })))
        .sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : a.second < b.second ? -1 : 1);
    Assert.deepEqual(R.getOrThrow(P.pairs(Tree)), Expected);
    Assert.equal(Before.length, 100);
    Assert.ok(Object.isFrozen(Before[0].bounds));
    Assert.ok(R.isFailure(P.pairs(Tree, 1)));
    Assert.equal(R.getOrThrow(P.remove(Tree, "missing")), false);
});
test("typed deterministic budgets and rendering independence retain authoritative geometry", () =>
{
    const A = instance(primitive("box"));
    const Bv = instance(primitive("ellipsoid", V.Vector3Unsafe(0.7, 0.4, 0.5)), V.Vector3Unsafe(0.2, 0, 0));
    const Failure = C.collide(A, Bv, { maxEpaIterations: 1 });
    Assert.ok(R.isFailure(Failure));
    Assert.deepEqual(Failure, C.collide(A, Bv, { maxEpaIterations: 1 }));
    Assert.ok(R.isFailure(C.distance(A, Bv, { absoluteTolerance: -1 })));
    const Compound = instance({ kind: "compound",
        children: [ primitive("sphere"), primitive("sphere") ] });
    const Exhausted = C.collide(Compound, Compound, { maxPairs: 1 });
    Assert.ok(R.isFailure(Exhausted));
    if (R.isFailure(Exhausted))
    {
        Assert.equal(Exhausted.failure.code, "ComplexityLimit");
    }

    const Motion = { shape: A.shape,
        state: RT.RigidTransformUnsafe(V.Vector3Unsafe(-4, 0, 0), Q.Identity, V.Vector3Unsafe(10, 0, 0), V.Zero) };
    const CcdFailure = C.sweep(Motion, { shape: Bv.shape,
        state: RT.Identity }, 1, { maxCcdIterations: 1 });
    Assert.ok(R.isFailure(CcdFailure));
    if (R.isFailure(CcdFailure))
    {
        Assert.equal(CcdFailure.failure.stage, "ccd");
    }

    const Tree = R.getOrThrow(P.make({ capacity: 1 }));
    R.getOrThrow(P.set(Tree, { id: "a",
        bounds: A.shape.bounds,
        mode: "static" }));
    const CapacityFailure = P.set(Tree, { id: "b",
        bounds: A.shape.bounds,
        mode: "dynamic" });
    Assert.ok(R.isFailure(CapacityFailure));
    if (R.isFailure(CapacityFailure))
    {
        Assert.equal(CapacityFailure.failure.code, "ComplexityLimit");
    }

    const Original = C.collide(A, Bv);
    for (const Frames of [ 20, 60, 144 ])
    {
        for (let i = 0; i < Frames; i++)
        {
            R.getOrThrow(Rendering.encode({ start: T.Identity,
                end: T.TransformUnsafe(V.One, Q.Identity),
                duration: 0.05,
                sequence: i,
                reset: 0,
                renderBase: V.Zero }));
            Assert.deepEqual(C.collide(A, Bv), Original);
        }
    }
});

test("forked broad-phase topology and old snapshots stay independent under refit and removal", () =>
{
    const Tree = R.getOrThrow(P.make());
    const Bounds = B.AABBUnsafe(V.Zero, V.One);
    R.getOrThrow(P.set(Tree, { id: "a",
        mode: "dynamic",
        bounds: Bounds }));
    R.getOrThrow(P.set(Tree, { id: "b",
        mode: "static",
        bounds: Bounds }));
    const Snapshot = R.getOrThrow(P.snapshot(Tree));
    const Fork = R.getOrThrow(P.fork(Tree));
    R.getOrThrow(P.remove(Fork, "b"));
    R.getOrThrow(P.set(Fork, { id: "c",
        mode: "dynamic",
        bounds: B.AABBUnsafe(V.One, V.Vector3Unsafe(2, 2, 2)) }));
    Assert.deepEqual(R.getOrThrow(P.snapshot(Tree)), Snapshot);
    Assert.deepEqual(R.getOrThrow(P.pairs(Tree)), [ { first: "a",
        second: "b" } ]);
    R.getOrThrow(P.remove(Tree, "a"));
    Assert.deepEqual(R.getOrThrow(P.snapshot(Fork)).map((entry) => entry.id), [ "a", "c" ]);
});
