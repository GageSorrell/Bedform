/**
 * Unit-direction forward ray domains, distances, rigid covariance and exact protocols.
 *
 * @module bedform/Test/Ray.test
 *
 * @file      Ray.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as R from "bedform/Ray";
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
 * Compares vector components using an explicit numerical tolerance.
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
 * Constructs a validated ray from explicit structural coordinates.
 *
 * @category Tests
 * @since 1.0.0
 */
const ray = (origin: V.Coordinates = V.Zero, direction: V.Coordinates = V.UnitZ): R.Ray =>
{
    return O.getOrThrow(R.Ray(origin, direction));
};

test("Ray public operation inventory and root/subpath exports are complete", () =>
{
    Assert.equal(Root.Ray, R);
    Assert.deepEqual(Object.keys(R).filter((key) => typeof R[key as keyof typeof R] === "function").sort(), [
        "Ray", "RayUnsafe", "at", "closestParameter", "closestPoint", "distanceToPoint", "equals", "format",
        "fromString", "isRay", "isValid", "parse", "toString", "transform"
    ].sort());
    Assert.equal(R.parse, R.fromString);
    Assert.equal(R.toString, R.format);
    Assert.equal(R.isRay(null), false);
    Assert.equal(R.isRay({ origin: V.Zero,
        direction: V.UnitZ }), false);
});

test("Ray constructors deeply copy/freeze inputs and stably normalize extreme nonzero directions", () =>
{
    const Origin = { x: -0,
        y: 2,
        z: 3 };
    const Direction = { x: 3,
        y: 4,
        z: 0 };
    const A = ray(Origin, Direction);
    const B = R.RayUnsafe(Origin, Direction);
    close(A.direction, { x: 0.6,
        y: 0.8,
        z: 0 });
    Assert.equal(B.direction.x, 3);
    Assert.equal(Object.isFrozen(Origin), false);
    Assert.equal(Object.isFrozen(Direction), false);
    Assert.notEqual(A.origin, Origin);
    Assert.notEqual(B.direction, Direction);
    Origin.x = 99;
    Direction.x = 99;
    Assert.ok(Object.is(A.origin.x, -0));
    Assert.equal(B.direction.x, 3);
    for (const Value of [ A, B ])
    {
        Assert.ok(R.isRay(Value));
        Assert.ok(Object.isFrozen(Value) && Object.isFrozen(Value.origin) && Object.isFrozen(Value.direction));
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(B));
    for (const Magnitude of [ Number.MAX_VALUE, 1e308, 1e-308, Number.MIN_VALUE ])
    {
        const Value = ray(V.Zero, { x: Magnitude,
            y: Magnitude,
            z: -Magnitude });
        Assert.ok(R.isValid(Value));
        close(Value.direction, { x: 1 / Math.sqrt(3),
            y: 1 / Math.sqrt(3),
            z: -1 / Math.sqrt(3) });
    }
});

test("Ray evaluation uses nonnegative block distance rather than raw direction magnitude", () =>
{
    const Value = ray({ x: 1,
        y: 2,
        z: 3 }, { x: 0,
        y: 0,
        z: 100 });
    const Zero = O.getOrThrow(R.at(Value, 0));
    Assert.notEqual(Zero, Value.origin);
    close(Zero, Value.origin);
    close(O.getOrThrow(pipe(Value, R.at(5))), { x: 1,
        y: 2,
        z: 8 });
    Assert.equal(V.distance(Value.origin, O.getOrThrow(R.at(Value, 5))), 5);
    Assert.ok(Object.isFrozen(O.getOrThrow(R.at(Value, 5))));
    for (const Distance of [ -1, -Number.MIN_VALUE, NaN, Infinity, -Infinity ])
    {
        Assert.ok(O.isNone(R.at(Value, Distance)));
    }

    Assert.ok(O.isSome(R.at(Value, -0)));
    const Huge = ray({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, V.UnitX);
    Assert.ok(O.isNone(R.at(Huge, Number.MAX_VALUE)));
    Assert.equal(O.getOrThrow(R.at(ray(V.Zero, V.UnitX), Number.MIN_VALUE)).x, Number.MIN_VALUE);
});

test("Ray closest queries use the forward half-line and preserve orthogonal offset distance", () =>
{
    const Value = ray({ x: 1,
        y: 2,
        z: 3 }, V.UnitZ);
    const Ahead = { x: 4,
        y: 6,
        z: 10 };
    Assert.equal(O.getOrThrow(R.closestParameter(Value, Ahead)), 7);
    close(O.getOrThrow(pipe(Value, R.closestPoint(Ahead))), { x: 1,
        y: 2,
        z: 10 });
    Assert.equal(O.getOrThrow(pipe(Value, R.distanceToPoint(Ahead))), 5);
    const Behind = { x: 4,
        y: 6,
        z: -9 };
    Assert.equal(O.getOrThrow(pipe(Value, R.closestParameter(Behind))), 0);
    close(O.getOrThrow(R.closestPoint(Value, Behind)), Value.origin);
    Assert.equal(O.getOrThrow(R.distanceToPoint(Value, Behind)), 13);
    Assert.equal(O.getOrThrow(R.distanceToPoint(Value, { x: 1,
        y: 2,
        z: 10 })), 0);
    Assert.equal(O.getOrThrow(R.distanceToPoint(Value, Value.origin)), 0);
    close(O.getOrThrow(R.closestPoint(Value, { x: 4,
        y: 6,
        z: 3 })), Value.origin);
});

test("Ray general projection satisfies perpendicularity and independent nearest-parameter fixtures", () =>
{
    const Value = ray({ x: 1,
        y: -2,
        z: 3 }, { x: 3,
        y: 4,
        z: 0 });
    const Point = { x: 9,
        y: 4,
        z: 8 };
    // Unit direction=(0.6,0.8,0), dot((8,6,5),direction)=9.6.
    Assert.ok(Math.abs(O.getOrThrow(R.closestParameter(Value, Point)) - 9.6) < 1e-12);
    const Closest = O.getOrThrow(R.closestPoint(Value, Point));
    close(Closest, { x: 6.76,
        y: 5.68,
        z: 3 });
    Assert.ok(Math.abs(V.dot(V.subtract(Point, Closest), Value.direction)) < 1e-12);
    const Best = O.getOrThrow(R.distanceToPoint(Value, Point));
    for (const Parameter of [ 0, 5, 9, 9.5, 9.7, 10, 20 ])
    {
        Assert.ok(V.distance(O.getOrThrow(R.at(Value, Parameter)), Point) > Best);
    }

    Assert.ok(Object.isFrozen(Closest));
});

test("Ray scaled projection handles subnormal coordinates, cancellation and extreme behind-origin points", () =>
{
    const Tiny = { x: Number.MIN_VALUE,
        y: 0,
        z: 0 };
    const X = ray(V.Zero, V.UnitX);
    Assert.equal(O.getOrThrow(R.closestParameter(X, Tiny)), Number.MIN_VALUE);
    Assert.equal(O.getOrThrow(R.closestPoint(X, Tiny)).x, Number.MIN_VALUE);
    Assert.equal(O.getOrThrow(R.distanceToPoint(X, Tiny)), 0);
    const HugeX = ray({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, V.UnitX);
    Assert.equal(O.getOrThrow(R.closestParameter(HugeX, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 })), 0);
    close(O.getOrThrow(R.closestPoint(HugeX, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 })), HugeX.origin);
    Assert.ok(O.isNone(R.distanceToPoint(HugeX, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 })));
    const Diagonal = ray({ x: -Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: 0 }, { x: 1,
        y: 1,
        z: 0 });
    const Opposite = { x: Number.MAX_VALUE,
        y: -Number.MAX_VALUE,
        z: 0 };
    Assert.equal(O.getOrThrow(R.closestParameter(Diagonal, Opposite)), 0);
    Assert.ok(O.isNone(R.closestParameter(ray(V.Zero, V.One), { x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        z: Number.MAX_VALUE })));
    Assert.ok(O.isNone(R.closestParameter(ray({ x: -Number.MAX_VALUE,
        y: 0,
        z: 0 }, V.UnitX),
    { x: Number.MAX_VALUE,
        y: 0,
        z: 0 })));
});

test("Ray invalid unsafe nonunit directions are rejected by all queries without silent renormalization", () =>
{
    const Invalid = [ R.RayUnsafe(V.Zero, V.Zero), R.RayUnsafe(V.Zero, { x: 0,
        y: 0,
        z: 2 }),
    R.RayUnsafe(V.Zero, { x: 0,
        y: 0,
        z: 1 + 1e-10 }),
    R.RayUnsafe(V.Zero, { x: Number.MIN_VALUE,
        y: 0,
        z: 0 }),
    R.RayUnsafe(V.Zero, { x: Infinity,
        y: 0,
        z: 1 }),
    R.RayUnsafe({ x: NaN,
        y: 0,
        z: 0 }, V.UnitZ) ];
    for (const Value of Invalid)
    {
        Assert.ok(!R.isValid(Value));
        Assert.ok(O.isNone(R.at(Value, 0)));
        Assert.ok(O.isNone(R.closestParameter(Value, V.One)));
        Assert.ok(O.isNone(R.closestPoint(Value, V.One)));
        Assert.ok(O.isNone(R.distanceToPoint(Value, V.One)));
        Assert.ok(O.isNone(R.transform(Value, T.Identity)));
    }

    for (const Direction of [ V.Zero, { x: NaN,
        y: 0,
        z: 0 }, { x: 0,
        y: Infinity,
        z: 0 } ])
    {
        Assert.ok(O.isNone(R.Ray(V.Zero, Direction)));
    }

    Assert.ok(O.isNone(R.Ray({ x: Infinity,
        y: 0,
        z: 0 }, V.UnitX)));
    for (const Point of [ { x: NaN,
        y: 0,
        z: 0 }, { x: 0,
        y: Infinity,
        z: 0 } ])
    {
        Assert.ok(O.isNone(R.closestParameter(ray(), Point)));
        Assert.ok(O.isNone(R.closestPoint(ray(), Point)));
        Assert.ok(O.isNone(R.distanceToPoint(ray(), Point)));
    }
});

test("Ray rigid transforms preserve block parameters, forward queries and inverse round trips", () =>
{
    const Value = ray({ x: 1,
        y: 2,
        z: 3 }, V.UnitZ);
    const Pose = T.TransformUnsafe({ x: 10,
        y: 0,
        z: 0 },
    Q.scale(O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })), 1e308));
    const Moved = O.getOrThrow(pipe(Value, R.transform(Pose)));
    close(Moved.origin, { x: 7,
        y: 2,
        z: 1 });
    close(Moved.direction, V.West);
    Assert.ok(R.isValid(Moved));
    for (const Distance of [ 0, 1, 5, 100 ])
    {
        close(O.getOrThrow(R.at(Moved, Distance)), O.getOrThrow(T.transformPoint(Pose, O.getOrThrow(R.at(Value, Distance)))));
    }

    const Point = { x: 5,
        y: 8,
        z: 9 };
    const WorldPoint = O.getOrThrow(T.transformPoint(Pose, Point));
    close(O.getOrThrow(R.closestPoint(Moved, WorldPoint)),
        O.getOrThrow(T.transformPoint(Pose, O.getOrThrow(R.closestPoint(Value, Point)))));
    Assert.ok(Math.abs(O.getOrThrow(R.distanceToPoint(Moved, WorldPoint)) - O.getOrThrow(R.distanceToPoint(Value, Point))) < 1e-11);
    const Restored = O.getOrThrow(R.transform(Moved, O.getOrThrow(T.inverse(Pose))));
    close(Restored.origin, Value.origin);
    close(Restored.direction, Value.direction);
    Assert.ok(Object.isFrozen(Moved) && Object.isFrozen(Moved.origin) && Object.isFrozen(Moved.direction));
    for (const BadPose of [ T.TransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0)),
        T.TransformUnsafe({ x: Infinity,
            y: 0,
            z: 0 }, Q.Identity) ])
    {
        Assert.ok(O.isNone(R.transform(Value, BadPose)));
    }

    Assert.ok(O.isNone(R.transform(ray({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }),
    T.TransformUnsafe({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, Q.Identity))));
});

test("Ray exact protocols preserve unsafe representations, invalid reflexivity and kind separation", () =>
{
    const A = ray({ x: -0,
        y: 1,
        z: 2 }, V.UnitZ);
    const B = ray({ x: 0,
        y: 1,
        z: 2 }, V.UnitZ);
    Assert.ok(Equal.equals(A, B));
    Assert.ok(pipe(A, R.equals(B)));
    Assert.equal(Hash.hash(A), Hash.hash(B));
    Assert.equal(HashSet.size(HashSet.make(A, B)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "ray" ]), B)), "ray");
    Assert.ok(!R.equals(A, R.RayUnsafe(A.origin, { x: 0,
        y: 0,
        z: 2 })));
    Assert.ok(!R.equals(A, R.RayUnsafe(A.origin, { x: 0,
        y: 0,
        z: 1 + 1e-15 })));
    Assert.equal(Equal.equals(A, V.Zero), false);
    Assert.equal(Equal.equals(A, T.Identity), false);
    for (const Bad of [ NaN, Infinity, -Infinity ])
    {
        const X = R.RayUnsafe({ x: Bad,
            y: 0,
            z: 0 }, { x: Bad,
            y: -0,
            z: 0 });
        const Y = R.RayUnsafe({ x: Bad,
            y: -0,
            z: 0 }, { x: Bad,
            y: 0,
            z: 0 });
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("Ray full-precision text, JSON and inspection round trip valid stored unit components exactly", () =>
{
    const A = ray({ x: 1.1234567891234566,
        y: -2e-200,
        z: 3e200 }, { x: 3,
        y: 4,
        z: 5 });
    Assert.ok(R.equals(A, O.getOrThrow(R.parse(A.toString()))));
    Assert.equal(A.pipe(R.toString), A.toString());
    const Json = A.toJSON() as R.Json;
    Assert.deepEqual(Json, { _id: "Ray",
        origin: A.origin.toJSON(),
        direction: A.direction.toJSON() });
    Assert.ok(Object.isFrozen(Json) && Object.isFrozen(Json.origin) && Object.isFrozen(Json.direction));
    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    Assert.equal(R.format(ray()), "Ray(0, 0, 0, 0, 0, 1)");
    for (const Text of [ "", "Ray(0,0,0,0,0,0)", "Ray(0,0,0,0,0,2)", "Ray(0,0,0,0,0,Infinity)",
        "Ray(0,,0,0,0,1)", "Ray(0,0,0,0,1)", "Ray(0,0,0,0,0,1)tail", "Ray(0,0,0,0,0,1junk)" ])
    {
        Assert.ok(O.isNone(R.parse(Text)), Text);
    }
});
