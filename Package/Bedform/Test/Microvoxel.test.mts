/**
 * Microvoxel lattice validation, flooring, all 4096 local/global/index round trips, step moves, boxes and
 * traversal checked against brute-force sampling.
 *
 * @module bedform/Test/Microvoxel.test
 *
 * @file      Microvoxel.test.mts
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
import * as M from "bedform/Microvoxel";
import * as V from "bedform/Vector3";
import * as X from "bedform/Voxel";
import * as Int from "@bedform/effect/Int";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

/**
 * Builds a microvoxel fixture from coordinates in meters.
 *
 * @category Tests
 * @since 1.0.0
 */
const micro = (x: number, y: number, z: number): M.Microvoxel =>
{
    return M.MicrovoxelUnsafe(x, y, z);
};

/**
 * Lists microvoxel coordinates as plain tuples for readable deep comparisons.
 *
 * @category Tests
 * @since 1.0.0
 */
const tuples = (values: Iterable<M.Microvoxel>): Array<[number, number, number]> =>
{
    return Array.from(values, (value) => [ value.x, value.y, value.z ]);
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
 * Checks whether the segment comes within `epsilon` of a microvoxel's cube, by slab clipping.
 *
 * @category Tests
 * @since 1.0.0
 */
const touches = (cell: M.Microvoxel, from: V.Coordinates, to: V.Coordinates, epsilon = 1e-9): boolean =>
{
    let low = 0;
    let high = 1;
    for (const axis of [ "x", "y", "z" ] as const)
    {
        const delta = to[axis] - from[axis];
        const min = cell[axis] - epsilon;
        const max = cell[axis] + M.Size + epsilon;
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
const checkTraversal = (from: V.Coordinates, to: V.Coordinates): Array<M.Step> =>
{
    const steps = Array.from(M.traverse(from, to));
    const start = O.getOrThrow(M.fromPoint(from));
    const end = O.getOrThrow(M.fromPoint(to));
    const startSteps = M.steps(start);
    const endSteps = M.steps(end);
    const manhattan = Math.abs(startSteps.x - endSteps.x) + Math.abs(startSteps.y - endSteps.y) + Math.abs(startSteps.z - endSteps.z);
    Assert.ok(M.equals(steps[0].microvoxel, start), "starts in the microvoxel holding from");
    Assert.ok(O.isNone(steps[0].face), "the first microvoxel has no entry face");
    Assert.ok(M.equals(steps[steps.length - 1].microvoxel, end), "ends in the microvoxel holding to");
    Assert.equal(steps.length, 1 + manhattan, "one step per unit of Manhattan distance in steps");
    const keys = new Set(steps.map((step) => M.key(step.microvoxel)));
    Assert.equal(keys.size, steps.length, "no microvoxel repeats");
    for (let index = 1; index < steps.length; index++)
    {
        const face = O.getOrThrow(steps[index].face);
        Assert.ok(M.equals(M.neighbor(steps[index].microvoxel, face), steps[index - 1].microvoxel), "the entry face is shared with the previous microvoxel");
    }

    for (const step of steps)
    {
        Assert.ok(touches(step.microvoxel, from, to), `visited microvoxel ${M.key(step.microvoxel)} touches the segment`);
    }

    const samples = 3000;
    for (let index = 0; index <= samples; index++)
    {
        const t = index / samples;
        const point = { x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t };
        const sampled = M.key(O.getOrThrow(M.fromPoint(point)));
        Assert.ok(keys.has(sampled), `sampled microvoxel ${sampled} at t=${t} is visited`);
    }

    return steps;
};

test("Microvoxel operation inventory and public root/subpath exports are complete", () =>
{
    Assert.equal(Root.Microvoxel, M);
    Assert.deepEqual(Object.keys(M).filter((key) => typeof M[key as keyof typeof M] === "function").sort(), [
        "Equivalence", "Microvoxel", "MicrovoxelUnsafe", "Order", "bounds", "box", "center", "equals", "fromIndex",
        "fromKey", "fromPoint", "fromSteps", "fromVoxel", "fromVoxelUnsafe", "inVoxel", "index", "isMicrovoxel",
        "key", "local", "neighbor", "offset", "steps", "traverse", "voxel"
    ].sort());
    Assert.equal(M.Resolution, 16);
    Assert.equal(M.Size, 0.0625);
    Assert.equal(M.PerVoxel, 4096);
    Assert.equal(M.Size * M.Resolution, 1);
    Assert.equal(M.Resolution ** 3, M.PerVoxel);
});

test("construction requires the 1/16 m lattice and never rounds", () =>
{
    const value = O.getOrThrow(M.Microvoxel(0.0625, -0.125, 3));
    Assert.deepEqual({ ...value }, { [M.TypeId]: M.TypeId,
        x: 0.0625,
        y: -0.125,
        z: 3 });
    Assert.ok(Object.isFrozen(value));
    Assert.equal(Object.getPrototypeOf(value), Object.prototype);
    Assert.ok(Object.is(micro(-0, 0, 0).x, 0), "negative zero is normalized");
    for (const [ x, y, z ] of [ [ 0.03, 0, 0 ], [ 0, 1 / 3, 0 ], [ 0, 0, 0.1 ], [ Number.NaN, 0, 0 ], [ 0, Number.POSITIVE_INFINITY, 0 ], [ 0, 0, 2 ** 60 ] ])
    {
        Assert.ok(O.isNone(M.Microvoxel(x, y, z)), `${x},${y},${z}`);
        Assert.throws(() => M.MicrovoxelUnsafe(x, y, z), RangeError);
    }

    Assert.ok(M.isMicrovoxel(value));
    Assert.ok(!M.isMicrovoxel({ x: 0.5,
        y: -1.9375,
        z: 0 }));
    Assert.ok(!M.isMicrovoxel({ [M.TypeId]: M.TypeId,
        x: 0.03,
        y: 0,
        z: 0 }));
    Assert.ok(!M.isMicrovoxel({ [M.TypeId]: M.TypeId,
        x: "0",
        y: 0,
        z: 0 }));
    Assert.ok(!M.isMicrovoxel(null));
    Assert.ok(!M.isMicrovoxel({ ...value,
        [M.TypeId]: M.LocalTypeId }));
    Assert.ok(!M.isMicrovoxel(M.local(value)));
    Assert.ok(!M.isMicrovoxel(M.steps(value)));
    Assert.equal(value[M.TypeId], M.TypeId);
    Assert.equal(M.local(value)[M.LocalTypeId], M.LocalTypeId);
    Assert.equal(M.steps(value)[M.StepsTypeId], M.StepsTypeId);
    Assert.ok(Object.isFrozen(M.local(value)));
    Assert.ok(Object.isFrozen(M.steps(value)));
    Assert.deepEqual(M.fromSteps({ x: 1,
        y: 64,
        z: -2 }), O.some(micro(0.0625, 4, -0.125)));
    Assert.ok(O.isNone(M.fromSteps({ x: 0.5,
        y: 0,
        z: 0 })));
    Assert.ok(O.isNone(M.fromSteps({ x: Number.MAX_SAFE_INTEGER + 1,
        y: 0,
        z: 0 })));
});

test("fromPoint floors to the lattice, including negative coordinates", () =>
{
    const at = (x: number, y: number, z: number) => tuples([ O.getOrThrow(M.fromPoint({ x,
        y,
        z })) ])[0];
    Assert.deepEqual(at(-0.01, 0.0624, 0.0625), [ -0.0625, 0, 0.0625 ]);
    Assert.deepEqual(at(-1, -1.0001, 15.99), [ -1, -1.0625, 15.9375 ]);
    Assert.deepEqual(at(-1e-300, 1 - 1e-12, -0.0625), [ -0.0625, 0.9375, -0.0625 ]);
    Assert.ok(Object.is(O.getOrThrow(M.fromPoint({ x: -0,
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
        Assert.ok(O.isNone(M.fromPoint(point)), JSON.stringify(point));
    }
});

test("all 4096 local, global and index addresses round trip in several blocks", () =>
{
    for (const block of [ X.Origin, X.VoxelUnsafe(-3, -64, 7), X.VoxelUnsafe(1000, 319, -1) ])
    {
        const ordered = Array.from(M.inVoxel(block));
        Assert.equal(ordered.length, M.PerVoxel);
        const keys = new Set<string>();
        for (let index = 0; index < 4096; index++)
        {
            const value = O.getOrThrow(M.fromIndex(block, index));
            Assert.ok(M.equals(value, ordered[index]), `inVoxel yields index order at ${index}`);
            Assert.equal(M.index(value), index);
            Assert.ok(X.equals(M.voxel(value), block));
            const local = M.local(value);
            Assert.equal(local.x + 16 * (local.z + 16 * local.y), index);
            for (const axis of [ "x", "y", "z" ] as const)
            {
                Assert.ok(Int.isInt(local[axis]) && local[axis] >= 0 && local[axis] < 16);
            }

            Assert.ok(M.equals(O.getOrThrow(M.fromVoxel(block, local)), value));
            Assert.ok(M.equals(M.fromVoxelUnsafe(block, local), value));
            const steps = M.steps(value);
            Assert.deepEqual(steps, { [M.StepsTypeId]: M.StepsTypeId,
                x: block.x * 16 + local.x,
                y: block.y * 16 + local.y,
                z: block.z * 16 + local.z });
            Assert.ok(M.equals(O.getOrThrow(M.fromSteps(steps)), value));
            Assert.ok(M.equals(O.getOrThrow(M.Microvoxel(value.x, value.y, value.z)), value));
            Assert.ok(M.equals(O.getOrThrow(M.fromPoint(value)), value));
            Assert.ok(M.equals(O.getOrThrow(M.fromPoint(M.center(value))), value));
            Assert.ok(M.equals(O.getOrThrow(M.fromKey(M.key(value))), value));
            Assert.ok(X.equals(O.getOrThrow(X.fromPoint(value)), block));
            keys.add(M.key(value));
        }

        Assert.equal(keys.size, 4096);
        Assert.deepEqual(tuples(ordered), tuples([ ...ordered ].sort(M.Order)), "index order is canonical order");
    }
});

test("fromVoxel and fromIndex reject addresses outside the block", () =>
{
    for (const local of [ { x: -1,
        y: 0,
        z: 0 }, { x: 0,
        y: 16,
        z: 0 }, { x: 0,
        y: 0,
        z: 1.5 }, { x: Number.NaN,
        y: 0,
        z: 0 } ])
    {
        Assert.ok(O.isNone(M.fromVoxel(X.Origin, local)), JSON.stringify(local));
        Assert.throws(() => M.fromVoxelUnsafe(X.Origin, local), RangeError);
    }

    for (const index of [ -1, 4096, 1.5, Number.NaN ])
    {
        Assert.ok(O.isNone(M.fromIndex(X.Origin, index)), String(index));
    }

    Assert.ok(O.isNone(M.fromVoxel(X.VoxelUnsafe(Number.MAX_SAFE_INTEGER, 0, 0), V.Zero)), "unsafe step counts are rejected");
});

test("offset and neighbor move in microvoxel steps, crossing block boundaries", () =>
{
    const origin = micro(0.9375, 0, -0.0625);
    Assert.deepEqual(tuples([ M.offset(origin, { x: Int.one }) ]), [ [ 1, 0, -0.0625 ] ]);
    Assert.deepEqual(tuples([ pipe(origin, M.offset({ y: Int.makeUnsafe(-1),
        z: Int.one })) ]), [ [ 0.9375, -0.0625, 0 ] ]);
    const east = M.neighbor(origin, X.Face.East);
    Assert.deepEqual(M.local(east), { [M.LocalTypeId]: M.LocalTypeId,
        x: 0,
        y: 0,
        z: 15 });
    Assert.ok(X.equals(M.voxel(east), X.VoxelUnsafe(1, 0, -1)), "crossing x = 1 changes the block");
    Assert.deepEqual(tuples([ M.neighbor(origin, X.Face.North) ]), [ [ 0.9375, 0, -0.125 ] ]);
    Assert.deepEqual(tuples([ M.neighbor(origin, X.Face.Up, M.Resolution) ]), [ [ 0.9375, 1, -0.0625 ] ], "16 steps is one meter");
    Assert.deepEqual(tuples([ pipe(origin, M.neighbor(X.Face.West, Int.makeUnsafe(-2))) ]), [ [ 1.0625, 0, -0.0625 ] ]);
    for (const face of X.Faces)
    {
        Assert.ok(M.equals(M.neighbor(M.neighbor(origin, face), X.opposite(face)), origin));
        Assert.ok(V.equals(V.scale(V.subtract(M.neighbor(origin, face), origin), M.Resolution), X.faceNormal(face)));
    }

    Assert.throws(() => M.offset(O.getOrThrow(M.fromSteps({ x: Number.MAX_SAFE_INTEGER,
        y: 0,
        z: 0 })), { x: Int.one }), RangeError);
});

test("box iterates the inclusive box in canonical order from either corner", () =>
{
    const values = M.box(micro(0.0625, 1, 0), micro(-0.0625, 0.9375, 0.0625));
    const listed = tuples(values);
    Assert.equal(listed.length, 3 * 2 * 2);
    Assert.deepEqual(listed.slice(0, 4), [ [ -0.0625, 0.9375, 0 ], [ 0, 0.9375, 0 ], [ 0.0625, 0.9375, 0 ], [ -0.0625, 0.9375, 0.0625 ] ]);
    Assert.deepEqual(listed, tuples(Array.from(values).sort(M.Order)), "iterable more than once, already sorted");
    Assert.deepEqual(listed, tuples(pipe(micro(-0.0625, 0.9375, 0), M.box(micro(0.0625, 1, 0.0625)))));
});

test("traverse matches brute-force sampling on random segments", () =>
{
    const next = random(0x8_2_0_e_3);
    const coordinate = (span: number) => (next() - 0.5) * span;
    for (let index = 0; index < 200; index++)
    {
        const span = index < 100 ? 0.75 : 3;
        const from = { x: coordinate(span),
            y: coordinate(span),
            z: coordinate(span) };
        const to = { x: coordinate(span),
            y: coordinate(span),
            z: coordinate(span) };
        const steps = checkTraversal(from, to);
        const scaled = Array.from(X.traverse(V.scale(from, 16), V.scale(to, 16)));
        Assert.deepEqual(steps.map((step) => M.key(step.microvoxel)), scaled.map((step) => X.key(step.voxel)), "the same walk as Voxel at 16 times the scale");
    }
});

test("traverse handles axis-aligned, degenerate and exact-corner segments", () =>
{
    const along = checkTraversal({ x: 0.01,
        y: 0.01,
        z: 0.01 }, { x: 0.2,
        y: 0.01,
        z: 0.01 });
    Assert.deepEqual(tuples(along.map((step) => step.microvoxel)), [ [ 0, 0, 0 ], [ 0.0625, 0, 0 ], [ 0.125, 0, 0 ], [ 0.1875, 0, 0 ] ]);
    Assert.deepEqual(along.slice(1).map((step) => O.getOrThrow(step.face)), [ "West", "West", "West" ]);
    Assert.equal(checkTraversal({ x: 5.01,
        y: -2.3,
        z: 0.4 }, { x: 5.01,
        y: -2.3,
        z: 0.4 }).length, 1);
    const corner = checkTraversal({ x: 0.03125,
        y: 0.03125,
        z: 0.03125 }, { x: 0.09375,
        y: 0.09375,
        z: 0.03125 });
    Assert.deepEqual(tuples(corner.map((step) => step.microvoxel)), [ [ 0, 0, 0 ], [ 0.0625, 0, 0 ], [ 0.0625, 0.0625, 0 ] ], "x steps before y at a tie");
    const walk = M.traverse(V.Zero, { x: 0,
        y: 0,
        z: 0.2 });
    Assert.equal(Array.from(walk).length, 4);
    Assert.equal(Array.from(walk).length, 4, "iterable more than once");
    Assert.equal(Array.from(pipe(V.Zero, M.traverse({ x: 0,
        y: -0.1,
        z: 0 }))).length, 3);
    Assert.throws(() => M.traverse({ x: Number.NaN,
        y: 0,
        z: 0 }, V.Zero), RangeError);
    Assert.throws(() => M.traverse(V.Zero, { x: 0,
        y: 2 ** 60,
        z: 0 }), RangeError);
});

test("equality, order, keys, center and bounds", () =>
{
    const a = micro(0.0625, 4, -0.125);
    Assert.equal(M.key(a), "1,64,-2");
    Assert.ok(M.Equivalence(a, micro(0.0625, 4, -0.125)));
    Assert.ok(pipe(a, M.equals({ ...a })));
    Assert.ok(!M.equals(a, micro(0, 4, -0.125)));
    Assert.equal(M.Order(micro(9, 0, 9), micro(0, 0.0625, 0)), -1, "y dominates");
    Assert.equal(M.Order(micro(9, 0, 0), micro(0, 0, 0.0625)), -1, "then z");
    Assert.equal(M.Order(micro(0.0625, 0, 0), micro(0, 0, 0)), 1, "then x");
    for (const text of [ "", "1,2", "01,2,3", "-0,0,0", "0.5,0,0", "9007199254740992,0,0" ])
    {
        Assert.ok(O.isNone(M.fromKey(text)), JSON.stringify(text));
    }

    const middle = M.center(a);
    Assert.ok(V.isVector3(middle));
    Assert.ok(V.equals(middle, { x: 0.09375,
        y: 4.03125,
        z: -0.09375 }));
    const cube = M.bounds(a);
    Assert.ok(B.isAABB(cube));
    Assert.ok(V.equals(cube.min, a));
    Assert.ok(V.equals(cube.max, { x: 0.125,
        y: 4.0625,
        z: -0.0625 }));
    Assert.ok(V.equals(O.getOrThrow(B.center(cube)), middle));
});
