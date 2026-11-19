/**
 * Voxel construction, flooring, faces, neighbors, boxes, keys and Amanatides–Woo traversal checked
 * against brute-force sampling.
 *
 * @module bedform/Test/Voxel.test
 *
 * @file      Voxel.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as B from "bedform/AABB";
import * as V from "bedform/Vector3";
import * as X from "bedform/Voxel";
import * as Int from "@bedform/effect/Int";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

/**
 * Builds a voxel fixture from safe integers.
 *
 * @category Tests
 * @since 1.0.0
 */
const voxel = (x: number, y: number, z: number): X.Voxel =>
{
    return X.VoxelUnsafe(x, y, z);
};

/**
 * Lists voxel coordinates as plain tuples for readable deep comparisons.
 *
 * @category Tests
 * @since 1.0.0
 */
const tuples = (voxels: Iterable<X.Voxel>): Array<[number, number, number]> =>
{
    return Array.from(voxels, (value) => [ value.x, value.y, value.z ]);
};

/**
 * A small deterministic pseudo-random generator (mulberry32), so failures reproduce.
 *
 * @category Tests
 * @since 1.0.0
 */
const random = (seed: number): () => number =>
{
    let state = seed >>> 0;
    return () =>
    {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Checks whether the segment from `from` to `to` comes within `epsilon` of a voxel's cube, by slab clipping.
 *
 * @category Tests
 * @since 1.0.0
 */
const touches = (cell: X.Voxel, from: V.Coordinates, to: V.Coordinates, epsilon = 1e-9): boolean =>
{
    let low = 0;
    let high = 1;
    for (const axis of [ "x", "y", "z" ] as const)
    {
        const delta = to[axis] - from[axis];
        const min = cell[axis] - epsilon;
        const max = cell[axis] + 1 + epsilon;
        if (delta === 0)
        {
            if (from[axis] < min || from[axis] > max)
            {
                return false;
            }

            continue;
        }

        const first = (min - from[axis]) / delta;
        const second = (max - from[axis]) / delta;
        low = Math.max(low, Math.min(first, second));
        high = Math.min(high, Math.max(first, second));
    }

    return low <= high;
};

/**
 * Checks every structural guarantee of one traversal, and that it covers densely sampled points of the segment.
 *
 * @category Tests
 * @since 1.0.0
 */
const checkTraversal = (from: V.Coordinates, to: V.Coordinates): Array<X.Step> =>
{
    const steps = Array.from(X.traverse(from, to));
    const start = O.getOrThrow(X.fromPoint(from));
    const end = O.getOrThrow(X.fromPoint(to));
    Assert.ok(X.equals(steps[0].voxel, start), "starts in the voxel holding from");
    Assert.ok(O.isNone(steps[0].face), "the first voxel has no entry face");
    Assert.ok(X.equals(steps[steps.length - 1].voxel, end), "ends in the voxel holding to");
    Assert.equal(steps.length, 1 + X.distanceManhattan(start, end), "one step per unit of Manhattan distance");
    const keys = new Set(steps.map((step) => X.key(step.voxel)));
    Assert.equal(keys.size, steps.length, "no voxel repeats");
    for (let index = 1; index < steps.length; index++)
    {
        const face = O.getOrThrow(steps[index].face);
        Assert.ok(X.equals(X.neighbor(steps[index].voxel, face), steps[index - 1].voxel), "the entry face is shared with the previous voxel");
    }

    for (const step of steps)
    {
        Assert.ok(touches(step.voxel, from, to), `visited voxel ${X.key(step.voxel)} touches the segment`);
    }

    const samples = 4000;
    for (let index = 0; index <= samples; index++)
    {
        const t = index / samples;
        const point = { x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t };
        const sampled = X.key(O.getOrThrow(X.fromPoint(point)));
        Assert.ok(keys.has(sampled), `sampled voxel ${sampled} at t=${t} is visited`);
    }

    return steps;
};

test("Voxel operation inventory and public root/subpath exports are complete", () =>
{
    Assert.equal(Root.Voxel, X);
    Assert.deepEqual(Object.keys(X).filter((key) => typeof X[key as keyof typeof X] === "function").sort(), [
        "Equivalence", "Order", "Voxel", "VoxelUnsafe", "add", "bounds", "box", "center", "distance",
        "distanceChebyshev", "distanceManhattan", "equals", "faceAxis", "faceNormal", "fromKey", "fromNormal",
        "fromPoint", "isVoxel", "key", "neighbor", "neighbors", "opposite", "subtract", "traverse"
    ].sort());
});

test("faces equal Bedrock Direction strings and their geometry is consistent", () =>
{
    Assert.deepEqual({ ...X.Face }, { Down: "Down",
        East: "East",
        North: "North",
        South: "South",
        Up: "Up",
        West: "West" });
    Assert.ok(Object.isFrozen(X.Face));
    Assert.deepEqual(X.Faces, [ "Up", "Down", "North", "South", "East", "West" ]);
    Assert.ok(V.equals(X.faceNormal(X.Face.North), V.North));
    Assert.ok(V.equals(X.faceNormal(X.Face.South), { x: 0,
        y: 0,
        z: 1 }));
    Assert.ok(V.equals(X.faceNormal(X.Face.East), { x: 1,
        y: 0,
        z: 0 }));
    for (const face of X.Faces)
    {
        const normal = X.faceNormal(face);
        Assert.ok(V.isVector3(normal));
        Assert.equal(X.opposite(X.opposite(face)), face);
        Assert.ok(V.equals(X.faceNormal(X.opposite(face)), V.scale(normal, -1)));
        Assert.equal(X.faceAxis(face), X.faceAxis(X.opposite(face)));
        Assert.equal(Math.abs(normal[X.faceAxis(face)]), 1);
        Assert.deepEqual(X.fromNormal(normal), O.some(face));
        Assert.deepEqual(X.fromNormal(V.scale(normal, 3.5)), O.some(face));
    }

    Assert.deepEqual(X.fromNormal({ x: -0,
        y: -2,
        z: 0 }), O.some(X.Face.Down));
    for (const normal of [ V.Zero, { x: 1,
        y: 1,
        z: 0 }, { x: Number.NaN,
        y: 0,
        z: 0 }, { x: 0,
        y: Number.POSITIVE_INFINITY,
        z: 0 } ])
    {
        Assert.ok(O.isNone(X.fromNormal(normal)), JSON.stringify(normal));
    }
});

test("construction requires safe integers and never floors", () =>
{
    const value = O.getOrThrow(X.Voxel(1, -2, 3));
    Assert.deepEqual({ ...value }, { x: 1,
        y: -2,
        z: 3 });
    Assert.ok(Object.isFrozen(value));
    Assert.equal(Object.getPrototypeOf(value), Object.prototype);
    Assert.ok(Object.is(voxel(-0, 0, -0).x, 0), "negative zero is normalized");
    for (const [ x, y, z ] of [ [ 0.5, 0, 0 ], [ 0, Number.NaN, 0 ], [ 0, 0, Number.POSITIVE_INFINITY ], [ Number.MAX_SAFE_INTEGER + 1, 0, 0 ] ])
    {
        Assert.ok(O.isNone(X.Voxel(x, y, z)), `${x},${y},${z}`);
        Assert.throws(() => X.VoxelUnsafe(x, y, z), RangeError);
    }

    Assert.ok(X.isVoxel(value));
    Assert.ok(X.isVoxel({ x: 1,
        y: 2,
        z: 3 }));
    Assert.ok(!X.isVoxel({ x: 1.5,
        y: 2,
        z: 3 }));
    Assert.ok(!X.isVoxel(null));
    Assert.ok(!X.isVoxel({ x: 1,
        y: 2 }));
    Assert.ok(X.equals(X.Origin, voxel(0, 0, 0)));
});

test("fromPoint floors, including negative coordinates", () =>
{
    Assert.deepEqual(tuples([ O.getOrThrow(X.fromPoint({ x: -0.5,
        y: -1,
        z: 0.999 })) ]), [ [ -1, -1, 0 ] ]);
    Assert.deepEqual(tuples([ O.getOrThrow(X.fromPoint({ x: -1e-300,
        y: -0,
        z: -1.0000001 })) ]), [ [ -1, 0, -2 ] ]);
    Assert.deepEqual(tuples([ O.getOrThrow(X.fromPoint(V.Vector3Unsafe(15.99, 64, -15.01))) ]), [ [ 15, 64, -16 ] ]);
    Assert.ok(Object.is(O.getOrThrow(X.fromPoint({ x: -0,
        y: 0,
        z: 0 })).x, 0));
    for (const point of [ { x: Number.NaN,
        y: 0,
        z: 0 }, { x: 0,
        y: Number.NEGATIVE_INFINITY,
        z: 0 }, { x: 0,
        y: 0,
        z: 2 ** 60 } ])
    {
        Assert.ok(O.isNone(X.fromPoint(point)), JSON.stringify(point));
    }
});

test("add, subtract and neighbor move by whole blocks in both call styles", () =>
{
    const origin = voxel(10, 64, -3);
    const one = Int.one;
    const two = Int.makeUnsafe(2);
    Assert.deepEqual(tuples([ X.add(origin, { x: two }) ]), [ [ 12, 64, -3 ] ]);
    Assert.deepEqual(tuples([ pipe(origin, X.add({ y: one,
        z: two })) ]), [ [ 10, 65, -1 ] ]);
    Assert.deepEqual(tuples([ X.subtract(origin, voxel(10, 60, -3)) ]), [ [ 0, 4, 0 ] ]);
    Assert.deepEqual(tuples([ pipe(origin, X.subtract({ x: one })) ]), [ [ 9, 64, -3 ] ]);
    Assert.throws(() => X.add(voxel(Number.MAX_SAFE_INTEGER, 0, 0), { x: one }), RangeError);
    Assert.throws(() => X.subtract(voxel(0, Number.MIN_SAFE_INTEGER, 0), { y: one }), RangeError);

    Assert.deepEqual(tuples([ X.neighbor(origin, X.Face.Up) ]), [ [ 10, 65, -3 ] ]);
    Assert.deepEqual(tuples([ X.neighbor(origin, X.Face.North) ]), [ [ 10, 64, -4 ] ]);
    Assert.deepEqual(tuples([ X.neighbor(origin, X.Face.East, Int.makeUnsafe(5)) ]), [ [ 15, 64, -3 ] ]);
    Assert.deepEqual(tuples([ X.neighbor(origin, X.Face.West, Int.makeUnsafe(-2)) ]), [ [ 12, 64, -3 ] ]);
    Assert.deepEqual(tuples([ pipe(origin, X.neighbor(X.Face.South)) ]), [ [ 10, 64, -2 ] ]);
    Assert.deepEqual(tuples([ pipe(origin, X.neighbor(X.Face.Down, two)) ]), [ [ 10, 62, -3 ] ]);
    for (const face of X.Faces)
    {
        Assert.ok(X.equals(X.neighbor(X.neighbor(origin, face), X.opposite(face)), origin));
        Assert.ok(V.equals(V.subtract(X.neighbor(origin, face), origin), X.faceNormal(face)));
    }
});

test("neighbors return 6, 18 or 26 distinct voxels in canonical order", () =>
{
    const origin = voxel(-4, 0, 7);
    for (const [ connectivity, limit ] of [ [ 6, 1 ], [ 18, 2 ], [ 26, 3 ] ] as const)
    {
        const around = X.neighbors(origin, connectivity);
        Assert.equal(around.length, connectivity);
        Assert.ok(Object.isFrozen(around));
        Assert.equal(new Set(around.map(X.key)).size, connectivity);
        Assert.deepEqual(tuples(around), tuples([ ...around ].sort(X.Order)));
        for (const value of around)
        {
            Assert.equal(X.distanceChebyshev(origin, value), 1);
            Assert.ok(X.distanceManhattan(origin, value) <= limit);
        }
    }

    Assert.deepEqual(tuples(X.neighbors(origin)), tuples(X.neighbors(origin, 6)));
    Assert.deepEqual(new Set(X.neighbors(origin).map(X.key)), new Set(X.Faces.map((face) => X.key(X.neighbor(origin, face)))));
});

test("box iterates the inclusive box in canonical order from either corner", () =>
{
    const voxels = X.box(voxel(1, 5, -1), voxel(-1, 4, 0));
    const listed = tuples(voxels);
    Assert.equal(listed.length, 3 * 2 * 2);
    Assert.deepEqual(listed.slice(0, 4), [ [ -1, 4, -1 ], [ 0, 4, -1 ], [ 1, 4, -1 ], [ -1, 4, 0 ] ]);
    Assert.deepEqual(listed, tuples(Array.from(voxels).sort(X.Order)), "iterable more than once, already sorted");
    Assert.deepEqual(listed, tuples(pipe(voxel(-1, 4, -1), X.box(voxel(1, 5, 0)))));
    Assert.deepEqual(tuples(X.box(X.Origin, X.Origin)), [ [ 0, 0, 0 ] ]);
});

test("traverse matches brute-force sampling on random segments", () =>
{
    const next = random(0x8_2_0_e);
    const coordinate = (span: number) => (next() - 0.5) * span;
    for (let index = 0; index < 300; index++)
    {
        const span = index < 150 ? 8 : 40;
        const from = { x: coordinate(span),
            y: coordinate(span),
            z: coordinate(span) };
        const to = { x: coordinate(span),
            y: coordinate(span),
            z: coordinate(span) };
        checkTraversal(from, to);
    }
});

test("traverse handles axis-aligned, degenerate, boundary and exact-corner segments", () =>
{
    const along = checkTraversal({ x: 0.5,
        y: 0.5,
        z: 0.5 }, { x: 3.5,
        y: 0.5,
        z: 0.5 });
    Assert.deepEqual(tuples(along.map((step) => step.voxel)), [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 2, 0, 0 ], [ 3, 0, 0 ] ]);
    Assert.deepEqual(along.slice(1).map((step) => O.getOrThrow(step.face)), [ "West", "West", "West" ]);

    const single = checkTraversal({ x: -2.25,
        y: 7.5,
        z: 3.1 }, { x: -2.25,
        y: 7.5,
        z: 3.1 });
    Assert.equal(single.length, 1);

    const down = checkTraversal({ x: 0.5,
        y: 2,
        z: 0.5 }, { x: 0.5,
        y: -0.5,
        z: 0.5 });
    Assert.deepEqual(tuples(down.map((step) => step.voxel)), [ [ 0, 2, 0 ], [ 0, 1, 0 ], [ 0, 0, 0 ], [ 0, -1, 0 ] ]);
    Assert.deepEqual(down.slice(1).map((step) => O.getOrThrow(step.face)), [ "Up", "Up", "Up" ]);

    const corner = checkTraversal({ x: 0.5,
        y: 0.5,
        z: 0.5 }, { x: 1.5,
        y: 1.5,
        z: 0.5 });
    Assert.deepEqual(tuples(corner.map((step) => step.voxel)), [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 1, 1, 0 ] ], "x steps before y at a tie");

    const north = checkTraversal({ x: 0.5,
        y: 0.5,
        z: 0.5 }, { x: 0.5,
        y: 0.5,
        z: -1.5 });
    Assert.deepEqual(north.slice(1).map((step) => O.getOrThrow(step.face)), [ "South", "South" ]);

    const steps = X.traverse({ x: 0.5,
        y: 0.5,
        z: 0.5 }, { x: 2.5,
        y: 0.5,
        z: 0.5 });
    Assert.equal(Array.from(steps).length, 3);
    Assert.equal(Array.from(steps).length, 3, "iterable more than once");
    const mutable = { x: 0.5,
        y: 0.5,
        z: 0.5 };
    const captured = X.traverse(mutable, { x: 1.5,
        y: 0.5,
        z: 0.5 });
    mutable.x = -10;
    Assert.equal(Array.from(captured).length, 2, "endpoints are read when traverse is called");
    Assert.equal(Array.from(pipe({ x: 0,
        y: 0,
        z: 0 }, X.traverse({ x: 0,
        y: 0,
        z: 2.5 }))).length, 3);
    Assert.throws(() => X.traverse({ x: Number.NaN,
        y: 0,
        z: 0 }, V.Zero), RangeError);
    Assert.throws(() => X.traverse(V.Zero, { x: 0,
        y: 2 ** 60,
        z: 0 }), RangeError);
});

test("distances, equality, order and keys", () =>
{
    const a = voxel(1, 2, 3);
    const b = voxel(-2, 6, 3);
    Assert.equal(X.distanceManhattan(a, b), 7);
    Assert.equal(pipe(a, X.distanceManhattan(b)), 7);
    Assert.equal(X.distanceChebyshev(a, b), 4);
    Assert.equal(X.distance(a, b), 5);
    Assert.ok(Int.isInt(X.distanceManhattan(a, b)));
    Assert.ok(X.Equivalence(a, voxel(1, 2, 3)));
    Assert.ok(!X.equals(a, b));
    Assert.ok(pipe(a, X.equals({ ...a })));
    Assert.equal(X.Order(voxel(9, 0, 9), voxel(0, 1, 0)), -1, "y dominates");
    Assert.equal(X.Order(voxel(9, 0, 0), voxel(0, 0, 1)), -1, "then z");
    Assert.equal(X.Order(voxel(1, 0, 0), voxel(0, 0, 0)), 1, "then x");
    Assert.equal(X.Order(a, voxel(1, 2, 3)), 0);

    Assert.equal(X.key(voxel(-1, 64, 3)), "-1,64,3");
    const next = random(42);
    for (let index = 0; index < 200; index++)
    {
        const value = voxel(Math.floor((next() - 0.5) * 2e6), Math.floor((next() - 0.5) * 600), Math.floor((next() - 0.5) * 2e6));
        const text = X.key(value);
        const parsed = O.getOrThrow(X.fromKey(text));
        Assert.ok(X.equals(parsed, value));
        Assert.equal(X.key(parsed), text);
    }

    Assert.ok(X.equals(O.getOrThrow(X.fromKey(String(Number.MIN_SAFE_INTEGER) + ",0," + String(Number.MAX_SAFE_INTEGER))), voxel(Number.MIN_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER)));
    for (const text of [ "", "1,2", "1,2,3,4", "1, 2,3", "+1,2,3", "01,2,3", "-0,0,0", "1.5,2,3", "a,b,c", "9007199254740992,0,0" ])
    {
        Assert.ok(O.isNone(X.fromKey(text)), JSON.stringify(text));
    }
});

test("center and bounds return bedform Vector3 and AABB values", () =>
{
    const value = voxel(-3, 64, 0);
    const middle = X.center(value);
    Assert.ok(V.isVector3(middle));
    Assert.ok(V.equals(middle, { x: -2.5,
        y: 64.5,
        z: 0.5 }));
    const cube = X.bounds(value);
    Assert.ok(B.isAABB(cube));
    Assert.ok(V.equals(cube.min, value));
    Assert.ok(V.equals(cube.max, { x: -2,
        y: 65,
        z: 1 }));
    Assert.ok(V.equals(O.getOrThrow(B.center(cube)), middle));
});
