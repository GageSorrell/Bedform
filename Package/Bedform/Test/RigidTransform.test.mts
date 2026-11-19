/**
 * Origin-based rigid motion, analytic frame transport and independent derivative fixtures.
 *
 * @module bedform/Test/RigidTransform.test
 *
 * @file      RigidTransform.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numerical fixtures retain contextual inference and intentional coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Root from "bedform";
import * as R from "bedform/RigidTransform";
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
 * Compares vector components using explicit numerical tolerance.
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
 * Builds explicit validated motion fixtures.
 *
 * @category Tests
 * @since 1.0.0
 */
const motion = (position = V.Zero as V.Coordinates, rotation = Q.Identity as Q.Coordinates,
    linearVelocity = V.Zero as V.Coordinates, angularVelocity = V.Zero as V.Coordinates): R.RigidTransform =>
{
    return O.getOrThrow(R.RigidTransform(position, rotation, linearVelocity, angularVelocity));
};

/**
 * Compares all pose and motion fields geometrically without protocol rounding.
 *
 * @category Tests
 * @since 1.0.0
 */
const same = (actual: R.Coordinates, expected: R.Coordinates): void =>
{
    close(actual.position, expected.position);
    Assert.ok(O.getOrThrow(Q.equalsApprox(actual.rotation, expected.rotation, 1e-10)));
    close(actual.linearVelocity, expected.linearVelocity);
    close(actual.angularVelocity, expected.angularVelocity);
};

/**
 * Independently samples constant instantaneous containing-frame motion for derivative tests.
 * This fixture is not a production dynamics integrator.
 *
 * @category Tests
 * @since 1.0.0
 */
const sample = (value: R.Coordinates, dt: number): T.Transform =>
{
    const Delta = O.getOrThrow(Q.fromRotationVector(V.scale(value.angularVelocity, dt)));
    return O.getOrThrow(T.Transform(V.add(value.position, V.scale(value.linearVelocity, dt)),
        Q.multiply(Delta, value.rotation)));
};

test("RigidTransform exports cover every operation and preserve runtime Transform inheritance", () =>
{
    Assert.equal(Root.RigidTransform, R);
    Assert.deepEqual(Object.keys(R).filter((key) => typeof R[key as keyof typeof R] === "function").sort(), [
        "RigidTransform", "RigidTransformUnsafe", "compose", "equals", "format", "fromString", "fromTransform",
        "interpolate", "inverse", "isRigidTransform", "isValid", "lerp", "parse", "toString", "toTransform", "velocityAtPoint"
    ].sort());
    Assert.ok(T.isTransform(R.Identity));
    Assert.ok(R.isRigidTransform(R.Identity));
    Assert.equal(R.isRigidTransform(T.Identity), false);
    Assert.equal(R.isRigidTransform(null), false);
    Assert.equal(R.isRigidTransform({ ...R.Identity }), false);
    Assert.equal(R.lerp, R.interpolate);
    Assert.equal(R.parse, R.fromString);
    Assert.equal(R.toString, R.format);
});

test("RigidTransform construction deeply copies and freezes all fields without freezing callers", () =>
{
    const Position = { x: -0,
        y: 2,
        z: 3 };
    const Rotation = { x: 0,
        y: 0,
        z: 0,
        w: 4 };
    const Linear = { x: 1,
        y: -0,
        z: 3 };
    const Angular = { x: 4,
        y: 5,
        z: 6 };
    const A = motion(Position, Rotation, Linear, Angular);
    const B = R.RigidTransformUnsafe(Position, Rotation, Linear, Angular);
    Assert.equal(A.rotation.w, 1);
    Assert.equal(B.rotation.w, 4);
    for (const Value of [ A, B, R.Identity ])
    {
        for (const Child of [ Value, Value.position, Value.rotation, Value.linearVelocity, Value.angularVelocity ])
        {
            Assert.ok(Object.isFrozen(Child));
        }
    }

    Assert.equal(Object.getPrototypeOf(A), Object.getPrototypeOf(B));
    for (const Input of [ Position, Rotation, Linear, Angular ])
    {
        Assert.equal(Object.isFrozen(Input), false);
    }

    Position.x = 99;
    Rotation.w = 0;
    Linear.x = 99;
    Angular.x = 99;
    Assert.ok(Object.is(A.position.x, -0));
    Assert.ok(Object.is(A.linearVelocity.y, -0));
    Assert.equal(B.rotation.w, 4);
    Assert.equal(A.linearVelocity.x, 1);
    Assert.equal(A.angularVelocity.x, 4);
    for (const Magnitude of [ 1e308, 1e-308, Number.MIN_VALUE ])
    {
        Assert.ok(Q.isNormalized(motion(V.Zero, { x: Magnitude,
            y: 0,
            z: 0,
            w: Magnitude }).rotation));
    }
});

test("RigidTransform from/to Transform copies poses, validates motion and supports data-last construction", () =>
{
    const Pose = T.TransformUnsafe(V.One, Q.scale(Q.Identity, -3));
    const Value = O.getOrThrow(pipe(Pose, R.fromTransform(V.UnitX, V.UnitY)));
    same(Value, O.getOrThrow(R.fromTransform(Pose, V.UnitX, V.UnitY)));
    const Extracted = O.getOrThrow(R.toTransform(Value));
    Assert.ok(T.equals(Extracted, Pose));
    Assert.equal(R.isRigidTransform(Extracted), false);
    Assert.notEqual(Extracted.position, Value.position);
    Assert.notEqual(Extracted.rotation, Value.rotation);
    close(O.getOrThrow(T.transformPoint(Value, V.One)), { x: 2,
        y: 2,
        z: 2 });
    Assert.ok(Object.isFrozen(Extracted) && Object.isFrozen(Extracted.position));
});

test("RigidTransform analytic rotating-frame composition includes transport and rotates both child velocities", () =>
{
    const A = motion({ x: 10,
        y: 0,
        z: 0 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: 90,
        z: 0 })),
    { x: 1,
        y: 2,
        z: 3 }, { x: 0,
        y: 2,
        z: 0 });
    const B = motion({ x: 0,
        y: 0,
        z: 2 }, O.getOrThrow(Q.fromEuler({ x: 90,
        y: 0,
        z: 0 })),
    { x: 4,
        y: 5,
        z: 6 }, V.UnitX);
    const AB = O.getOrThrow(R.compose(A, B));
    close(AB.position, { x: 8,
        y: 0,
        z: 0 });
    close(AB.linearVelocity, { x: -5,
        y: 7,
        z: 11 });
    close(AB.angularVelocity, { x: 0,
        y: 2,
        z: 1 });
    same(O.getOrThrow(pipe(A, R.compose(B))), AB);
    Assert.equal(R.equals(AB, O.getOrThrow(R.compose(B, A))), false);
    same(O.getOrThrow(R.compose(A, R.Identity)), A);
    same(O.getOrThrow(R.compose(R.Identity, A)), A);
    close(O.getOrThrow(R.velocityAtPoint(AB, AB.position)), AB.linearVelocity);
});

test("RigidTransform point velocity and explicit COM/origin conversions preserve authoritative COM velocity", () =>
{
    const Origin = V.Zero;
    const COM = V.UnitX;
    const Omega = { x: 0,
        y: 0,
        z: 2 };
    const VCOM = { x: 3,
        y: 4,
        z: 5 };
    const VOrigin = V.add(VCOM, V.cross(Omega, V.subtract(Origin, COM)));
    close(VOrigin, { x: 3,
        y: 2,
        z: 5 });
    const Value = motion(Origin, Q.Identity, VOrigin, Omega);
    close(O.getOrThrow(pipe(Value, R.velocityAtPoint(COM))), VCOM);
    close(O.getOrThrow(R.velocityAtPoint(Value, { x: 2,
        y: 0,
        z: 0 })), { x: 3,
        y: 6,
        z: 5 });
    close(V.add(Value.linearVelocity, V.cross(Omega, V.subtract(COM, Origin))), VCOM);
    // With a rotated pose, omega and v still use containing-frame coordinates.
    const Rotated = motion(Origin, O.getOrThrow(Q.fromEuler({ x: 70,
        y: 30,
        z: 10 })), VOrigin, Omega);
    close(O.getOrThrow(R.velocityAtPoint(Rotated, COM)), VCOM);
});

test("RigidTransform inverse motion cancels in both orders and remains valid for scaled unsafe orientations", () =>
{
    for (let i = 0; i < 25; i++)
    {
        const A = motion({ x: i - 5,
            y: i / 2,
            z: 7 }, O.getOrThrow(Q.fromEuler({ x: i * 17,
            y: i * 11,
            z: -i * 7 })),
        { x: i / 3,
            y: -2,
            z: 4 }, { x: 0.2,
            y: i / 10,
            z: -0.3 });
        const Raw = R.RigidTransformUnsafe(A.position, Q.scale(A.rotation, i % 2 ? 1e308 : -1e-308),
            A.linearVelocity, A.angularVelocity);
        const Inverse = O.getOrThrow(R.inverse(Raw));
        same(O.getOrThrow(R.compose(Raw, Inverse)), R.Identity);
        same(O.getOrThrow(R.compose(Inverse, Raw)), R.Identity);
        same(O.getOrThrow(R.inverse(Inverse)), A);
    }

    // For identity rotation, v'=omega cross position-v and omega'=-omega.
    const A = motion({ x: 2,
        y: 0,
        z: 0 }, Q.Identity, { x: 1,
        y: 2,
        z: 3 }, { x: 0,
        y: 0,
        z: 4 });
    const Inverse = O.getOrThrow(R.inverse(A));
    close(Inverse.linearVelocity, { x: -1,
        y: 6,
        z: -3 });
    close(Inverse.angularVelocity, { x: 0,
        y: 0,
        z: -4 });
});

test("RigidTransform composed point and angular velocities match independent central differences", () =>
{
    const A = motion({ x: 4,
        y: -2,
        z: 1 }, O.getOrThrow(Q.fromEuler({ x: 31,
        y: 73,
        z: -24 })),
    { x: 2,
        y: -3,
        z: 1 }, { x: 0.4,
        y: -0.6,
        z: 0.2 });
    const B = motion({ x: -3,
        y: 5,
        z: 2 }, O.getOrThrow(Q.fromEuler({ x: -21,
        y: 17,
        z: 35 })),
    { x: -1,
        y: 2,
        z: 3 }, { x: 0.1,
        y: 0.7,
        z: -0.5 });
    const AB = O.getOrThrow(R.compose(A, B));
    const Dt = 1e-5;
    const Minus = O.getOrThrow(T.compose(sample(A, -Dt), sample(B, -Dt)));
    const Plus = O.getOrThrow(T.compose(sample(A, Dt), sample(B, Dt)));
    for (const Point of [ V.Zero, V.One, { x: -3,
        y: 2,
        z: 7 } ])
    {
        const Derivative = V.scale(V.subtract(O.getOrThrow(T.transformPoint(Plus, Point)),
            O.getOrThrow(T.transformPoint(Minus, Point))), 1 / (2 * Dt));
        const WorldPoint = O.getOrThrow(T.transformPoint(AB, Point));
        close(O.getOrThrow(R.velocityAtPoint(AB, WorldPoint)), Derivative, 2e-8);
        const InParent = O.getOrThrow(T.transformPoint(B, Point));
        const Expected = V.add(O.getOrThrow(R.velocityAtPoint(A, WorldPoint)),
            O.getOrThrow(Q.rotateVector(A.rotation, O.getOrThrow(R.velocityAtPoint(B, InParent)))));
        close(O.getOrThrow(R.velocityAtPoint(AB, WorldPoint)), Expected);
    }

    for (const Axis of [ V.UnitX, V.UnitY, V.UnitZ ])
    {
        const Derivative = V.scale(V.subtract(O.getOrThrow(T.transformDirection(Plus, Axis)),
            O.getOrThrow(T.transformDirection(Minus, Axis))), 1 / (2 * Dt));
        close(Derivative, V.cross(AB.angularVelocity, O.getOrThrow(T.transformDirection(AB, Axis))), 2e-8);
    }

    const Inverse = O.getOrThrow(R.inverse(A));
    const InversePlus = O.getOrThrow(T.inverse(sample(A, Dt)));
    const InverseMinus = O.getOrThrow(T.inverse(sample(A, -Dt)));
    const Point = { x: 3,
        y: -4,
        z: 7 };
    const Derivative = V.scale(V.subtract(O.getOrThrow(T.transformPoint(InversePlus, Point)),
        O.getOrThrow(T.transformPoint(InverseMinus, Point))), 1 / (2 * Dt));
    close(O.getOrThrow(R.velocityAtPoint(Inverse, O.getOrThrow(T.transformPoint(Inverse, Point)))), Derivative, 2e-8);
});

test("RigidTransform interpolation uses shortest pose path and independent containing-frame velocity lerps", () =>
{
    const A = motion(V.Zero, O.getOrThrow(Q.fromEuler({ x: 0,
        y: 170,
        z: 0 })), V.UnitX, V.UnitY);
    const B = motion({ x: 10,
        y: 0,
        z: 0 }, O.getOrThrow(Q.fromEuler({ x: 0,
        y: -170,
        z: 0 })),
    { x: 3,
        y: 4,
        z: 5 }, { x: -2,
        y: -3,
        z: -4 });
    same(O.getOrThrow(R.interpolate(A, B, 0)), A);
    same(O.getOrThrow(R.interpolate(A, B, 1)), B);
    const Mid = O.getOrThrow(pipe(A, R.interpolate(B, 0.5)));
    close(Mid.position, { x: 5,
        y: 0,
        z: 0 });
    close(Mid.linearVelocity, { x: 2,
        y: 2,
        z: 2.5 });
    close(Mid.angularVelocity, { x: -1,
        y: -1,
        z: -2 });
    close(O.getOrThrow(T.transformDirection(Mid, V.UnitZ)), V.North);
    const Extra = O.getOrThrow(pipe(A, R.lerp(B, 2)));
    close(Extra.position, { x: 20,
        y: 0,
        z: 0 });
    close(Extra.linearVelocity, { x: 5,
        y: 8,
        z: 10 });
    close(Extra.angularVelocity, { x: -4,
        y: -7,
        z: -8 });
    const HugeA = motion(V.Zero, Q.Identity, { x: -Number.MAX_VALUE,
        y: 0,
        z: 0 }, { x: 0,
        y: -Number.MAX_VALUE,
        z: 0 });
    const HugeB = motion(V.Zero, Q.Identity, { x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, { x: 0,
        y: Number.MAX_VALUE,
        z: 0 });
    const HugeMid = O.getOrThrow(R.interpolate(HugeA, HugeB, 0.5));
    close(HugeMid.linearVelocity, V.Zero);
    close(HugeMid.angularVelocity, V.Zero);
    Assert.ok(O.isNone(R.interpolate(HugeA, HugeB, 2)));
});

test("RigidTransform partial operations reject every invalid unsafe domain and nonfinite parameters", () =>
{
    const Bad = { x: NaN,
        y: 0,
        z: 0 };
    const Invalid = [ R.RigidTransformUnsafe(Bad, Q.Identity, V.Zero, V.Zero),
        R.RigidTransformUnsafe(V.Zero, Q.QuatUnsafe(0, 0, 0, 0), V.Zero, V.Zero),
        R.RigidTransformUnsafe(V.Zero, Q.QuatUnsafe(0, Infinity, 0, 1), V.Zero, V.Zero),
        R.RigidTransformUnsafe(V.Zero, Q.Identity, Bad, V.Zero),
        R.RigidTransformUnsafe(V.Zero, Q.Identity, V.Zero, { x: 0,
            y: Infinity,
            z: 0 }) ];
    for (const Value of Invalid)
    {
        Assert.ok(!R.isValid(Value));
        Assert.ok(O.isNone(R.RigidTransform(Value.position, Value.rotation, Value.linearVelocity, Value.angularVelocity)));
        Assert.ok(O.isNone(R.fromTransform(Value, Value.linearVelocity, Value.angularVelocity)));
        Assert.ok(O.isNone(R.toTransform(Value)));
        Assert.ok(O.isNone(R.inverse(Value)));
        Assert.ok(O.isNone(R.compose(Value, R.Identity)));
        Assert.ok(O.isNone(R.compose(R.Identity, Value)));
        Assert.ok(O.isNone(R.velocityAtPoint(Value, V.Zero)));
        Assert.ok(O.isNone(R.interpolate(Value, R.Identity, 0)));
        Assert.ok(O.isNone(R.interpolate(R.Identity, Value, 1)));
    }

    Assert.ok(O.isNone(R.velocityAtPoint(R.Identity, Bad)));
    for (const t of [ NaN, Infinity, -Infinity ])
    {
        Assert.ok(O.isNone(R.interpolate(R.Identity, R.Identity, t)));
    }

    const Huge = motion({ x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, Q.Identity,
    { x: Number.MAX_VALUE,
        y: 0,
        z: 0 }, { x: 0,
        y: 0,
        z: Number.MAX_VALUE });
    Assert.ok(O.isNone(R.compose(Huge, Huge)));
    Assert.ok(O.isNone(R.inverse(Huge)));
    Assert.ok(O.isNone(R.velocityAtPoint(Huge, V.Zero)));
});

test("RigidTransform protocols distinguish motion and pose symmetrically and preserve exact velocity semantics", () =>
{
    const A = R.RigidTransformUnsafe(V.One, { x: 1,
        y: 2,
        z: 3,
        w: 4 }, V.UnitX, V.UnitY);
    const B = R.RigidTransformUnsafe(V.One, { x: -2,
        y: -4,
        z: -6,
        w: -8 }, V.UnitX, V.UnitY);
    Assert.ok(Equal.equals(A, B));
    Assert.ok(pipe(A, R.equals(B)));
    Assert.equal(Hash.hash(A), Hash.hash(B));
    Assert.equal(HashSet.size(HashSet.make(A, B)), 1);
    Assert.equal(O.getOrThrow(HashMap.get(HashMap.make([ A, "motion" ]), B)), "motion");
    Assert.ok(!R.equals(A, R.RigidTransformUnsafe(A.position, A.rotation, V.Zero, A.angularVelocity)));
    Assert.ok(!R.equals(A, R.RigidTransformUnsafe(A.position, A.rotation, A.linearVelocity, V.Zero)));
    const Pose = T.TransformUnsafe(A.position, A.rotation);
    Assert.equal(Equal.equals(A, Pose), false);
    Assert.equal(Equal.equals(Pose, A), false);
    Assert.equal(Equal.equals(R.Identity, T.Identity), false);
    Assert.equal(Equal.equals(T.Identity, R.Identity), false);
    Assert.equal(T.Identity[Equal.symbol](R.Identity), false);
    Assert.equal(R.Identity[Equal.symbol](T.Identity), false);
    Assert.equal(HashSet.size(HashSet.make(R.Identity as T.Transform, T.Identity)), 2);
    Assert.equal(HashSet.size(HashSet.make(T.Identity, R.Identity as T.Transform)), 2);
    Assert.equal(Equal.equals(R.Identity, V.Zero), false);
    Assert.ok(Equal.equals(motion(), R.Identity));
    for (const NumberValue of [ NaN, Infinity, -Infinity, -0 ])
    {
        const Value = { x: NumberValue,
            y: 0,
            z: 0 };
        const X = R.RigidTransformUnsafe(Value, { x: NumberValue,
            y: 0,
            z: 0,
            w: 0 }, Value, Value);
        const Y = R.RigidTransformUnsafe(Value, { x: NumberValue,
            y: -0,
            z: 0,
            w: 0 }, Value, Value);
        Assert.ok(Equal.equals(X, Y));
        Assert.equal(Hash.hash(X), Hash.hash(Y));
        Assert.equal(HashSet.size(HashSet.make(X, Y)), 1);
    }
});

test("RigidTransform full-precision text, raw orientation parsing, JSON and custom inspection round trip", () =>
{
    const A = R.RigidTransformUnsafe({ x: 1.1234567891234566,
        y: -2e-200,
        z: 3e200 },
    { x: 1,
        y: 2,
        z: 3,
        w: 4 }, { x: -1e-200,
        y: 2.345678912345678,
        z: 3e200 }, { x: 4,
        y: 5,
        z: 6 });
    const B = O.getOrThrow(R.parse(A.toString()));
    Assert.ok(R.equals(A, B));
    Assert.ok(Q.equalsComponents(A.rotation, B.rotation));
    Assert.equal(R.format(A), "RigidTransform(1.1234567891234566, -2e-200, 3e+200, 1, 2, 3, 4, -1e-200, 2.345678912345678, 3e+200, 4, 5, 6)");
    const Json = A.toJSON() as R.Json;
    Assert.deepEqual(Json, { _id: "RigidTransform",
        position: A.position.toJSON(),
        rotation: A.rotation.toJSON(),
        linearVelocity: A.linearVelocity.toJSON(),
        angularVelocity: A.angularVelocity.toJSON() });
    for (const Child of [ Json, Json.position, Json.rotation, Json.linearVelocity, Json.angularVelocity ])
    {
        Assert.ok(Object.isFrozen(Child));
    }

    Assert.deepEqual((A as unknown as Record<symbol, () => unknown>)[Inspectable.NodeInspectSymbol](), Json);
    Assert.equal(A.pipe(R.toString), A.toString());
    for (const Text of [ "", "RigidTransform(0,0,0,0,0,0,0,0,0,0,0,0,0)",
        "RigidTransform(0,0,0,0,0,0,1,0,0,0,0,0,Infinity)", "RigidTransform(0,0,0,0,0,0,1)",
        `${R.Identity.toString()}tail`, R.Identity.toString().replace("0, 0", "0,,0") ])
    {
        Assert.ok(O.isNone(R.parse(Text)), Text);
    }
});
