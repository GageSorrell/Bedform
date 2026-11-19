/**
 * Vector protocol, operation-family and pinned upstream differential coverage.
 *
 * @module bedform/Test/Vector.test
 *
 * @file      Vector.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Test fixtures retain contextual inference and explicit boundary ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as V2 from "bedform/Vector2";
import * as V3 from "bedform/Vector3";
import { Vector2 as Root2, Vector3 as Root3 } from "bedform";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashSet from "@bedform/effect/HashSet";
import * as HashMap from "@bedform/effect/HashMap";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as Formatter from "@bedform/effect/Formatter";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
import type * as Upstream from "@minecraft/math";
import { readFileSync } from "node:fs";

// Import the distributed pure vector implementation: upstream's root also loads Bedrock AABB classes.
const UpstreamEntry = new URL(import.meta.resolve("@minecraft/math"));
const U = await import(new URL("./vector3/coreHelpers.js", UpstreamEntry).href) as typeof Upstream;
const CommonOperations = [ "add", "subtract", "multiply", "min", "max", "scale", "dot", "distance", "equals", "magnitude", "magnitudeSquared", "floor", "ceil", "normalize", "isFinite", "clamp", "lerp", "slerp", "format", "toString", "fromString", "parse" ];

/**
 * Reads coordinates without coupling tests to enriched prototype properties.
 *
 * @category Tests
 * @since 1.0.0
 */
const components = (value: V2.Coordinates): Array<number> =>
{
    return "z" in value ? [ value.x, value.y, value.z as number ] : [ value.x, value.y ];
};

/**
 * Unwraps a successful geometric result for ordinary coordinate assertions.
 *
 * @category Tests
 * @since 1.0.0
 */
const take = (value: Option.Option<V2.Coordinates>): V2.Coordinates =>
{
    Assert.ok(Option.isSome(value));
    return value.value;
};

/**
 * Compares vector components using independent numeric error bounds.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: V2.Coordinates, expected: ReadonlyArray<number>, tolerance = 1e-12): void =>
{
    const Values = components(actual);
    Assert.equal(Values.length, expected.length);
    Values.forEach((value, index) => Assert.ok(Math.abs(value - expected[index]) <= tolerance, `${value} != ${expected[index]}`));
};

test("constructors validate components and unsafe values retain raw signed-zero/nonfinite data", () =>
{
    Assert.strictEqual(Root2, V2);
    Assert.strictEqual(Root3, V3);
    Assert.ok(Option.isSome(V2.Vector2(0, 0)));
    Assert.ok(Option.isSome(V3.Vector3(0, 0, 0)));
    for (const Invalid of [ NaN, Infinity, -Infinity ])
    {
        Assert.ok(Option.isNone(V2.Vector2(Invalid, 1)));
        Assert.ok(Option.isNone(V2.Vector2(1, Invalid)));
        Assert.ok(Option.isNone(V3.Vector3(Invalid, 1, 1)));
        Assert.ok(Option.isNone(V3.Vector3(1, Invalid, 1)));
        Assert.ok(Option.isNone(V3.Vector3(1, 1, Invalid)));
    }

    const Unsafe = V3.Vector3Unsafe(-0, NaN, Infinity);
    Assert.ok(Object.is(Unsafe.x, -0));
    Assert.ok(Number.isNaN(Unsafe.y));
    Assert.equal(Unsafe.z, Infinity);
    Assert.ok(Object.isFrozen(Unsafe));
    Assert.ok(V3.isVector3(Unsafe));
    Assert.ok(!V2.isVector2(Unsafe));
    Assert.ok(!V3.isVector3({ x: 0,
        y: 0,
        z: 0 }));
    Assert.ok(!V3.isVector3(null));
});

{
    const Module = V2;
    const Dim = 2 as number;
    const Reference = U.Vector2Utils;
    test(`Vector${Dim} operation inventory covers every exported callable`, () =>
    {
        const Expected = [ ...CommonOperations, `Vector${Dim}`, `Vector${Dim}Unsafe`, `isVector${Dim}`,
            ...(Dim === 3 ? [ "cross", "rotateX", "rotateY", "rotateZ" ] : []) ].sort();
        Assert.deepEqual(Object.entries(Module).filter(([ , value ]) => typeof value === "function").map(([ key ]) => key).sort(), Expected);
        Assert.equal(JSON.parse(readFileSync(new URL("../../package.json", UpstreamEntry), "utf8")).version, "2.4.1");
    });

    test(`Vector${Dim} raw arithmetic, partial operands and dual order agree with pinned vectors`, () =>
    {
        const A = Object.freeze({ x: 2.25,
            y: -3.5});
        const B = Object.freeze({ x: -1,
            y: 2});
        const Expected = (value: V2.Coordinates): Array<number> => Dim === 2 ? [ value.x, value.y ] : components(value);
        Assert.equal(Module.isFinite(A), true);
        Assert.equal(Module.isFinite({ ...A,
            x: Infinity }), false);
        for (const Op of [ "add", "subtract", "multiply" ] as const)
        {
            Assert.deepEqual(components((Module[Op] as typeof Module.multiply)(A, B)), Expected(Reference[Op](A, B)));
            Assert.deepEqual(components((Module[Op] as typeof Module.multiply)(B)(A)), components((Module[Op] as typeof Module.multiply)(A, B)));
            Assert.deepEqual(components(pipe(A, (Module[Op] as typeof Module.multiply)(B))), components((Module[Op] as typeof Module.multiply)(A, B)));
            Assert.ok(Object.isFrozen((Module[Op] as typeof Module.multiply)(A, B)));
        }

        close(Module.add(A, { y: 1 }), Dim === 2 ? [ 2.25, -2.5 ] : [ 2.25, -2.5, 4.75 ]);
        close(Module.subtract({ x: 5,
            y: 6}, { x: 2 }), Dim === 2 ? [ 3, 6 ] : [ 3, 6, 7 ]);
        close(Module.scale(A, 2), Expected(Reference.scale(A, 2)));
        close(pipe(A, Module.scale(2)), components(Module.scale(A, 2)));
        Assert.equal(Module.dot(A, B), Reference.dot(A, B));
        Assert.equal(Module.dot(B)(A), Reference.dot(A, B));
        Assert.ok(Math.abs(Module.magnitude(A) - Reference.magnitude(A)) < 1e-12);
        Assert.ok(Math.abs(Module.distance(A, B) - Reference.distance(A, B)) < 1e-12);
        Assert.equal(Module.distance(B)(A), Module.distance(A, B));
        Assert.equal(Module.magnitudeSquared(A), Module.dot(A, A));
        close(Module.floor(A), Expected(Reference.floor(A)));
        close(Module.ceil(A), Dim === 2 ? [ 3, -3 ] : [ 3, -3, 5 ]);
        close(Module.min(A, B), Dim === 2 ? [ -1, -3.5 ] : [ -1, -3.5, 0.5 ]);
        close(Module.max(B)(A), Dim === 2 ? [ 2.25, 2 ] : [ 2.25, 2, 4.75 ]);
        const Limits = { min: { x: 0 },
            max: { y: 0 } };
        close(Module.clamp(A, Limits), Expected(Reference.clamp(A, Limits)));
        close(Module.clamp(Limits)(A), components(Module.clamp(A, Limits)));
        close(Module.clamp()(A), components(Module.clamp(A)));
        Assert.ok(!Object.isFrozen({ ...A }));
        const Mutable = { x: 1,
            y: 2};
        Module.scale(Mutable, 2);
        Assert.deepEqual(Mutable, { x: 1,
            y: 2});
        Assert.ok(!Object.isFrozen(Mutable));
        const Overflow = Module.scale({ x: Number.MAX_VALUE,
            y: 0}, 2);
        Assert.equal(Overflow.x, Infinity);
        Assert.ok(Number.isNaN(Module.min({ x: NaN,
            y: 0}, B).x));
    });

    test(`Vector${Dim} normalization and scalar length handle very large and very small inputs`, () =>
    {
        for (const Scale of [ Number.MAX_VALUE, 1e308, 1e-300, Number.MIN_VALUE ])
        {
            const Value = { x: Scale,
                y: Scale};
            close(take(Module.normalize(Value)), Array(Dim).fill(1 / Math.sqrt(Dim)));
        }

        for (const Value of [ { x: 0,
            y: 0}, { x: NaN,
            y: 1}, { x: Infinity,
            y: 1} ])
        {
            Assert.ok(Option.isNone(Module.normalize(Value)));
        }

        Assert.ok(Number.isFinite(Module.magnitude({ x: 1e308,
            y: 1e308})));
        Assert.ok(Module.magnitude({ x: 1e-300,
            y: 1e-300}) > 1e-300);
        close(take(Module.normalize({ x: 3,
            y: 4})), Dim === 2 ? [ 0.6, 0.8 ] : [ 0.6, 0.8, 0 ]);
    });

    test(`Vector${Dim} interpolation covers endpoints, lengths, extrapolation and spherical boundaries`, () =>
    {
        const A = { x: 1,
            y: 0};
        const B = { x: 0,
            y: 1};
        for (const T of [ -0.5, 0, 0.25, 0.5, 1, 1.5 ])
        {
            close(Module.lerp(A, B, T), components(Reference.lerp(A, B, T)));
            close(Module.lerp(B, T)(A), components(Module.lerp(A, B, T)));
            const Spherical = take(Module.slerp(A, B, T));
            close(Spherical, components(Reference.slerp(A, B, T)));
            close(take(pipe(A, Module.slerp(B, T))), components(Spherical));
        }

        const Opposite = { x: -1,
            y: 0};
        close(take(Module.slerp(A, Opposite, 0.5)), Dim === 2 ? [ 0, 1 ] : [ 0, 0, -1 ]);
        close(take(Module.slerp(A, A, 0.5)), Dim === 2 ? [ 1, 0 ] : [ 1, 0, 0 ]);
        close(take(Module.slerp(A, { x: 3,
            y: 0}, 0.5)), Dim === 2 ? [ 2, 0 ] : [ 2, 0, 0 ]);
        const Near = take(Module.slerp(A, { x: -1,
            y: 1e-10}, 0.5));
        close(Near, Dim === 2 ? [ 0, 1 ] : [ 0, 1, 0 ], 1e-9);
        const NearParallel = take(Module.slerp(A, { x: 1,
            y: 1e-10}, 0.5));
        Assert.ok(Math.abs(NearParallel.y - 5e-11) < 1e-15);
        const Huge = { x: 1e308,
            y: 1e308};
        const HugeMiddle = take(Module.slerp(Huge, Huge, 0.5));
        components(HugeMiddle).forEach((value) => Assert.ok(Number.isFinite(value) && Math.abs(value / 1e308 - 1) < 1e-12));
        Assert.ok(Option.isNone(Module.slerp(A, { x: 0,
            y: 0}, 0)));
        Assert.ok(Option.isNone(Module.slerp(A, { x: Infinity,
            y: 0}, 1)));
        Assert.ok(Option.isNone(Module.slerp(A, B, NaN)));
        Assert.ok(Option.isNone(Module.slerp(A, B, Infinity)));
        // Native upstream returns undefined numeric results for parallel/zero cases; these are deliberate differences.
        Assert.ok(components(Reference.slerp(A, A, 0.5)).some(Number.isNaN));
    });

    test(`Vector${Dim} text formatting, strict parsing and dual option forms round trip`, () =>
    {
        const Value = { x: 1.123456789012345,
            y: -2e-20};
        const Text = Module.format(Value);
        close(take(Module.parse(Text)), components(Module.lerp(Value, Value, 0)));
        Assert.equal(Module.toString(Value), Text);
        Assert.equal(Module.format({ decimals: 3,
            delimiter: "|" })(Value), Reference.toString(Value, { decimals: 3,
            delimiter: "|" }));
        const Custom = Module.format(Value, { delimiter: "|" });
        close(take(Module.fromString({ delimiter: "|" })(Custom)), components(Module.lerp(Value, Value, 0)));
        Assert.equal(Module.format()(Value), Text);
        Assert.equal(Module.parse()(Text)._tag, "Some");
        for (const Bad of [ "", "1", "1,2,3,4", "NaN,2", "Infinity,2", Dim === 2 ? "1x,2" : "1x,2,3", Dim === 2 ? ",2" : "1,,3" ])
        {
            Assert.ok(Option.isNone(Module.parse(Bad)), Bad);
        }

        Assert.ok(Option.isNone(Module.parse(Text, { delimiter: "" })));
        Assert.notEqual(Reference.fromString(Dim === 2 ? "1x,2" : "1x,2,3"), undefined);
        Assert.throws(() => Module.format(Value, { decimals: 101 }), RangeError);
    });
}

{
    const Module = V3;
    const Dim = 3 as number;
    const Reference = U.Vector3Utils;
    test(`Vector${Dim} operation inventory covers every exported callable`, () =>
    {
        const Expected = [ ...CommonOperations, `Vector${Dim}`, `Vector${Dim}Unsafe`, `isVector${Dim}`,
            ...(Dim === 3 ? [ "cross", "rotateX", "rotateY", "rotateZ" ] : []) ].sort();
        Assert.deepEqual(Object.entries(Module).filter(([ , value ]) => typeof value === "function").map(([ key ]) => key).sort(), Expected);
        Assert.equal(JSON.parse(readFileSync(new URL("../../package.json", UpstreamEntry), "utf8")).version, "2.4.1");
    });

    test(`Vector${Dim} raw arithmetic, partial operands and dual order agree with pinned vectors`, () =>
    {
        const A = Object.freeze({ x: 2.25,
            y: -3.5,
            z: 4.75 });
        const B = Object.freeze({ x: -1,
            y: 2,
            z: 0.5 });
        const Expected = (value: V2.Coordinates): Array<number> => Dim === 2 ? [ value.x, value.y ] : components(value);
        Assert.equal(Module.isFinite(A), true);
        Assert.equal(Module.isFinite({ ...A,
            x: Infinity }), false);
        for (const Op of [ "add", "subtract", "multiply" ] as const)
        {
            Assert.deepEqual(components((Module[Op] as typeof Module.multiply)(A, B)), Expected(Reference[Op](A, B)));
            Assert.deepEqual(components((Module[Op] as typeof Module.multiply)(B)(A)), components((Module[Op] as typeof Module.multiply)(A, B)));
            Assert.deepEqual(components(pipe(A, (Module[Op] as typeof Module.multiply)(B))), components((Module[Op] as typeof Module.multiply)(A, B)));
            Assert.ok(Object.isFrozen((Module[Op] as typeof Module.multiply)(A, B)));
        }

        close(Module.add(A, { y: 1 }), Dim === 2 ? [ 2.25, -2.5 ] : [ 2.25, -2.5, 4.75 ]);
        close(Module.subtract({ x: 5,
            y: 6,
            z: 7 }, { x: 2 }), Dim === 2 ? [ 3, 6 ] : [ 3, 6, 7 ]);
        close(Module.scale(A, 2), Expected(Reference.scale(A, 2)));
        close(pipe(A, Module.scale(2)), components(Module.scale(A, 2)));
        Assert.equal(Module.dot(A, B), Reference.dot(A, B));
        Assert.equal(Module.dot(B)(A), Reference.dot(A, B));
        Assert.ok(Math.abs(Module.magnitude(A) - Reference.magnitude(A)) < 1e-12);
        Assert.ok(Math.abs(Module.distance(A, B) - Reference.distance(A, B)) < 1e-12);
        Assert.equal(Module.distance(B)(A), Module.distance(A, B));
        Assert.equal(Module.magnitudeSquared(A), Module.dot(A, A));
        close(Module.floor(A), Expected(Reference.floor(A)));
        close(Module.ceil(A), Dim === 2 ? [ 3, -3 ] : [ 3, -3, 5 ]);
        close(Module.min(A, B), Dim === 2 ? [ -1, -3.5 ] : [ -1, -3.5, 0.5 ]);
        close(Module.max(B)(A), Dim === 2 ? [ 2.25, 2 ] : [ 2.25, 2, 4.75 ]);
        const Limits = { min: { x: 0 },
            max: { y: 0 } };
        close(Module.clamp(A, Limits), Expected(Reference.clamp(A, Limits)));
        close(Module.clamp(Limits)(A), components(Module.clamp(A, Limits)));
        close(Module.clamp()(A), components(Module.clamp(A)));
        Assert.ok(!Object.isFrozen({ ...A }));
        const Mutable = { x: 1,
            y: 2,
            z: 3 };
        Module.scale(Mutable, 2);
        Assert.deepEqual(Mutable, { x: 1,
            y: 2,
            z: 3 });
        Assert.ok(!Object.isFrozen(Mutable));
        const Overflow = Module.scale({ x: Number.MAX_VALUE,
            y: 0,
            z: 0 }, 2);
        Assert.equal(Overflow.x, Infinity);
        Assert.ok(Number.isNaN(Module.min({ x: NaN,
            y: 0,
            z: 0 }, B).x));
    });

    test(`Vector${Dim} normalization and scalar length handle very large and very small inputs`, () =>
    {
        for (const Scale of [ Number.MAX_VALUE, 1e308, 1e-300, Number.MIN_VALUE ])
        {
            const Value = { x: Scale,
                y: Scale,
                z: Scale };
            close(take(Module.normalize(Value)), Array(Dim).fill(1 / Math.sqrt(Dim)));
        }

        for (const Value of [ { x: 0,
            y: 0,
            z: 0 }, { x: NaN,
            y: 1,
            z: 0 }, { x: Infinity,
            y: 1,
            z: 0 } ])
        {
            Assert.ok(Option.isNone(Module.normalize(Value)));
        }

        Assert.ok(Number.isFinite(Module.magnitude({ x: 1e308,
            y: 1e308,
            z: 0 })));
        Assert.ok(Module.magnitude({ x: 1e-300,
            y: 1e-300,
            z: 0 }) > 1e-300);
        close(take(Module.normalize({ x: 3,
            y: 4,
            z: 0 })), Dim === 2 ? [ 0.6, 0.8 ] : [ 0.6, 0.8, 0 ]);
    });

    test(`Vector${Dim} interpolation covers endpoints, lengths, extrapolation and spherical boundaries`, () =>
    {
        const A = { x: 1,
            y: 0,
            z: 0 };
        const B = { x: 0,
            y: 1,
            z: 0 };
        for (const T of [ -0.5, 0, 0.25, 0.5, 1, 1.5 ])
        {
            close(Module.lerp(A, B, T), components(Reference.lerp(A, B, T)));
            close(Module.lerp(B, T)(A), components(Module.lerp(A, B, T)));
            const Spherical = take(Module.slerp(A, B, T));
            close(Spherical, components(Reference.slerp(A, B, T)));
            close(take(pipe(A, Module.slerp(B, T))), components(Spherical));
        }

        const Opposite = { x: -1,
            y: 0,
            z: 0 };
        close(take(Module.slerp(A, Opposite, 0.5)), Dim === 2 ? [ 0, 1 ] : [ 0, 0, -1 ]);
        close(take(Module.slerp(A, A, 0.5)), Dim === 2 ? [ 1, 0 ] : [ 1, 0, 0 ]);
        close(take(Module.slerp(A, { x: 3,
            y: 0,
            z: 0 }, 0.5)), Dim === 2 ? [ 2, 0 ] : [ 2, 0, 0 ]);
        const Near = take(Module.slerp(A, { x: -1,
            y: 1e-10,
            z: 0 }, 0.5));
        close(Near, Dim === 2 ? [ 0, 1 ] : [ 0, 1, 0 ], 1e-9);
        const NearParallel = take(Module.slerp(A, { x: 1,
            y: 1e-10,
            z: 0 }, 0.5));
        Assert.ok(Math.abs(NearParallel.y - 5e-11) < 1e-15);
        const Huge = { x: 1e308,
            y: 1e308,
            z: 1e308 };
        const HugeMiddle = take(Module.slerp(Huge, Huge, 0.5));
        components(HugeMiddle).forEach((value) => Assert.ok(Number.isFinite(value) && Math.abs(value / 1e308 - 1) < 1e-12));
        Assert.ok(Option.isNone(Module.slerp(A, { x: 0,
            y: 0,
            z: 0 }, 0)));
        Assert.ok(Option.isNone(Module.slerp(A, { x: Infinity,
            y: 0,
            z: 0 }, 1)));
        Assert.ok(Option.isNone(Module.slerp(A, B, NaN)));
        Assert.ok(Option.isNone(Module.slerp(A, B, Infinity)));
        // Native upstream returns undefined numeric results for parallel/zero cases; these are deliberate differences.
        Assert.ok(components(Reference.slerp(A, A, 0.5)).some(Number.isNaN));
    });

    test(`Vector${Dim} text formatting, strict parsing and dual option forms round trip`, () =>
    {
        const Value = { x: 1.123456789012345,
            y: -2e-20,
            z: 3.25 };
        const Text = Module.format(Value);
        close(take(Module.parse(Text)), components(Module.lerp(Value, Value, 0)));
        Assert.equal(Module.toString(Value), Text);
        Assert.equal(Module.format({ decimals: 3,
            delimiter: "|" })(Value), Reference.toString(Value, { decimals: 3,
            delimiter: "|" }));
        const Custom = Module.format(Value, { delimiter: "|" });
        close(take(Module.fromString({ delimiter: "|" })(Custom)), components(Module.lerp(Value, Value, 0)));
        Assert.equal(Module.format()(Value), Text);
        Assert.equal(Module.parse()(Text)._tag, "Some");
        for (const Bad of [ "", "1", "1,2,3,4", "NaN,2", "Infinity,2", Dim === 2 ? "1x,2" : "1x,2,3", Dim === 2 ? ",2" : "1,,3" ])
        {
            Assert.ok(Option.isNone(Module.parse(Bad)), Bad);
        }

        Assert.ok(Option.isNone(Module.parse(Text, { delimiter: "" })));
        Assert.notEqual(Reference.fromString(Dim === 2 ? "1x,2" : "1x,2,3"), undefined);
        Assert.throws(() => Module.format(Value, { decimals: 101 }), RangeError);
    });
}

test("vector protocols are exact, type-specific, inspectable, frozen and interoperable with hash collections", () =>
{
    for (const Make of [ (x: number, y: number) => V2.Vector2Unsafe(x, y), (x: number, y: number) => V3.Vector3Unsafe(x, y, 3) ])
    {
        const A = Make(NaN, -0);
        const B = Make(NaN, 0);
        Assert.ok(Equal.equals(A, B));
        Assert.equal(Hash.hash(A), Hash.hash(B));
        Assert.ok(Equal.equals(A, A));
        Assert.equal(HashSet.size(HashSet.make(A, B)), 1);
        Assert.equal(HashMap.getUnsafe(HashMap.make([ A, "found" ]), B), "found");
        Assert.ok(A.pipe((value) => Number.isNaN(value.x)));
        Assert.deepEqual(A[Inspectable.NodeInspectSymbol](), A.toJSON());
        Assert.equal(Formatter.format(A), A.toString());
        Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(B));
        Assert.ok(Object.isFrozen(Object.getPrototypeOf(A)));
        Assert.throws(() => Object.assign(A, { x: 5 }), TypeError);
    }

    Assert.ok(!Equal.equals(V2.Zero, V3.Zero));
    Assert.ok(V2.equals(V2.Vector2Unsafe(NaN, -0), V2.Vector2Unsafe(NaN, 0)));
    Assert.ok(!V3.equals(V3.One, V3.Zero));
    Assert.ok(V3.equals(V3.One)(V3.One));
    Assert.deepEqual(V3.Vector3Unsafe(1.123456789012345, 2, 3).toJSON(), { _id: "Vector3",
        x: 1.123456789012345,
        y: 2,
        z: 3 });
    Assert.deepEqual(JSON.parse(JSON.stringify(V2.One)), { _id: "Vector2",
        x: 1,
        y: 1 });
});

test("cardinals, facing-relative directions, cross order and positive-axis rotations are explicit", () =>
{
    close(V3.East, [ 1, 0, 0 ]);
    close(V3.West, [ -1, 0, 0 ]);
    close(V3.South, [ 0, 0, 1 ]);
    close(V3.North, [ 0, 0, -1 ]);
    close(V3.Up, [ 0, 1, 0 ]);
    close(V3.Down, [ 0, -1, 0 ]);
    close(V3.Right, [ -1, 0, 0 ]);
    close(V3.Left, [ 1, 0, 0 ]);
    close(V3.cross(V3.UnitX, V3.UnitY), [ 0, 0, 1 ]);
    close(pipe(V3.UnitX, V3.cross(V3.UnitY)), [ 0, 0, 1 ]);
    close(V3.cross(V3.UnitY, V3.UnitX), [ 0, 0, -1 ]);
    for (const Op of [ "rotateX", "rotateY", "rotateZ" ] as const)
    {
        const Value = { x: 2,
            y: 3,
            z: 4 };
        close(V3[Op](Value, 0.75), components(U.Vector3Utils[Op](Value, 0.75)));
        close(V3[Op](0.75)(Value), components(V3[Op](Value, 0.75)));
    }

    close(V3.rotateX(V3.UnitY, Math.PI / 2), [ 0, 0, 1 ]);
    close(V3.rotateY(V3.UnitZ, Math.PI / 2), [ 1, 0, 0 ]);
    close(V3.rotateZ(V3.UnitX, Math.PI / 2), [ 0, 1, 0 ]);
    Assert.equal(U.VECTOR3_NORTH.z, 1);
    Assert.equal(V3.North.z, -1); // Correct the pinned package's north/south reversal.
});
