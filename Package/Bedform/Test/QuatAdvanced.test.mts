/**
 * Analytic and invariant coverage for quaternion interpolation, spline and decomposition families.
 *
 * @module bedform/Test/QuatAdvanced.test
 *
 * @file      QuatAdvanced.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Numeric fixtures retain contextual inference and deliberate component ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as O from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import { pipe } from "@bedform/effect/Function";

/**
 * Reads and verifies a successful frozen quaternion result.
 *
 * @category Tests
 * @since 1.0.0
 */
const take = (value: O.Option<Q.Quat>): Q.Quat =>
{
    const Result = O.getOrThrow(value);
    Assert.ok(Object.isFrozen(Result));
    return Result;
};

/**
 * Compares raw coordinates without canonical equality, preserving full-path sign distinctions.
 *
 * @category Tests
 * @since 1.0.0
 */
const close = (actual: Q.Coordinates, expected: Q.Coordinates, epsilon = 1e-12): void =>
{
    for (const Key of [ "x", "y", "z", "w" ] as const)
    {
        Assert.ok(Math.abs(actual[Key] - expected[Key]) <= epsilon, `${Key}: ${actual[Key]} != ${expected[Key]}`);
    }
};

/**
 * Constructs an analytic positive-Z rotation from radians.
 *
 * @category Tests
 * @since 1.0.0
 */
const z = (angle: number): Q.Quat =>
{
    return take(Q.fromAxisAngle(V.UnitZ, angle));
};

test("fast interpolation preserves aligned raw magnitude, endpoints, dual order and extrapolation", () =>
{
    const A = Q.scale(Q.Identity, 2);
    const B = Q.scale(z(Math.PI), 4);
    close(take(Q.fastLerp(A, B, 0)), A);
    close(take(Q.fastLerp(A, B, 1)), B);
    close(take(Q.fastLerp(A, B, 0.5)), Q.QuatUnsafe(0, 0, 2, 1));
    close(take(pipe(A, Q.fastLerp(B, 0.5))), take(Q.fastLerp(A, B, 0.5)));
    close(take(Q.fastLerp(A, B, 2)), Q.QuatUnsafe(0, 0, 8, -2));
    close(take(Q.fastLerp(A, Q.negate(A), 0.5)), A);
    Assert.ok(!Q.isNormalized(take(Q.fastLerp(A, B, 0.5))));
    const Zero = take(Q.fastLerp(Q.Identity, Q.scale(Q.Identity, 2), -1));
    close(Zero, Q.QuatUnsafe(0, 0, 0, 0));
    Assert.ok(O.isNone(Q.normalize(Zero)));
    const Mutable = { x: 0,
        y: 0,
        z: 0,
        w: 2 };
    Q.fastLerp(Mutable, B, 0.5);
    Assert.deepEqual(Mutable, { x: 0,
        y: 0,
        z: 0,
        w: 2 });
    Assert.ok(!Object.isFrozen(Mutable));
    const Huge = Number.MAX_VALUE;
    close(take(Q.fastLerp(Q.QuatUnsafe(Huge, Huge, Huge, Huge),
        Q.QuatUnsafe(-Huge, Huge, Huge, Huge), 0.5)), Q.QuatUnsafe(0, Huge, Huge, Huge));
    const Tiny = take(Q.fastLerp(Q.QuatUnsafe(1e-300, 0, 0, 1e-300),
        Q.QuatUnsafe(-1e-300, 0, 0, 1e-300), 1e308));
    Assert.ok(Number.isFinite(Tiny.x) && Math.abs(Tiny.x / -2e8 - 1) < 1e-12);
});

test("fast bilerp uses row-major grid order and exposes the full curried form", () =>
{
    const A = Q.Identity;
    const B = Q.QuatUnsafe(1, 0, 0, 1);
    const C = Q.QuatUnsafe(0, 2, 0, 1);
    const D = Q.QuatUnsafe(1, 2, 0, 1);
    close(take(Q.fastBilerp(A, B, C, D, 0.25, 0.75)), Q.QuatUnsafe(0.25, 1.5, 0, 1));
    close(take(pipe(A, Q.fastBilerp(B, C, D, 0.25, 0.75))), Q.QuatUnsafe(0.25, 1.5, 0, 1));
    for (const [ U, W, Expected ] of [ [ 0, 0, A ], [ 1, 0, B ], [ 0, 1, C ], [ 1, 1, D ] ] as const)
    {
        close(take(Q.fastBilerp(A, B, C, D, U, W)), Expected);
    }

    close(take(Q.fastBilerp(A, B, C, D, -1, 2)), Q.QuatUnsafe(-1, 4, 0, 1));
});

test("spherical families match analytic unit arcs, endpoints and extrapolation", () =>
{
    const A = Q.Identity;
    const B = z(Math.PI / 2);
    for (const T of [ -1, -0.5, 0, 0.25, 0.5, 1, 1.5, 2 ])
    {
        const Expected = z(T * Math.PI / 2);
        for (const Operation of [ Q.slerp, Q.slerpUnnormalized, Q.slerpFullPath, Q.slerpFullPathUnnormalized ])
        {
            close(take(Operation(A, B, T)), Expected);
            close(take(pipe(A, Operation(B, T))), Expected);
        }

        Assert.ok(Q.isNormalized(take(Q.slerp(A, B, T))));
        Assert.ok(Q.isNormalized(take(Q.slerpFullPath(A, B, T))));
    }

    const A2 = Q.scale(A, 2);
    const B4 = Q.scale(Q.QuatUnsafe(0, 0, 1, 0), 4);
    close(take(Q.slerp(A2, B4, 0.5)), Q.QuatUnsafe(0, 0, Math.SQRT1_2, Math.SQRT1_2));
    close(take(Q.slerpUnnormalized(A2, B4, 0.5)), Q.QuatUnsafe(0, 0, 2 * Math.SQRT2, Math.SQRT2));
    close(take(Q.slerpFullPathUnnormalized(A2, B4, 0)), A2);
    close(take(Q.slerpFullPathUnnormalized(A2, B4, 1)), B4);
    close(take(Q.slerpUnnormalized(A2, Q.scale(A, 4), 0.5)), Q.scale(A, 3));
});

test("shortest and full paths retain distinct signs even though canonical protocols equate endpoints", () =>
{
    const A = Q.Identity;
    const B = Q.negate(A);
    Assert.ok(Equal.equals(A, B));
    close(take(Q.slerp(A, B, 0.5)), A);
    const FullMiddle = take(Q.slerpFullPath(A, B, 0.5));
    close(FullMiddle, Q.QuatUnsafe(1, 0, 0, 0));
    Assert.ok(!Q.equals(FullMiddle, A));
    close(take(Q.slerpFullPath(A, B, 0)), A);
    close(take(Q.slerpFullPath(A, B, 1)), B);
    close(take(Q.slerpFullPath(A, B, 2)), A);
    close(take(Q.slerpFullPath(A, B, -0.5)), Q.QuatUnsafe(-1, 0, 0, 0));
    close(take(Q.slerpFullPath(B, A, 0.5)), FullMiddle);
    close(take(Q.slerpFullPathUnnormalized(Q.scale(A, 2), Q.scale(B, 4), 0.5)), Q.scale(FullMiddle, 3));
    const HalfW = Q.QuatUnsafe(1, 0, 0, 0);
    close(take(Q.slerpFullPath(HalfW, Q.negate(HalfW), 0.5)), Q.QuatUnsafe(0, 1, 0, 0));
});

test("parallel, near-antipodal and huge/tiny spherical boundaries are stable", () =>
{
    const A = Q.Identity;
    for (const Epsilon of [ 1e-8, 1e-100, 1e-300 ])
    {
        const B = take(Q.Quat(Epsilon, 0, 0, -1));
        const Middle = take(Q.slerpFullPath(A, B, 0.5));
        Assert.ok(Q.isNormalized(Middle));
        Assert.ok(Math.abs(Middle.x - 1) < 1e-8);
        const Near = take(Q.slerp(A, take(Q.Quat(Epsilon, 0, 0, 1)), 0.5));
        Assert.ok(Near.x > 0 && Math.abs(Near.x / (Epsilon / 2) - 1) < 1e-8);
    }

    for (const Size of [ 1e308, 1e-300, Number.MIN_VALUE ])
    {
        const Scaled = Q.scale(A, Size);
        close(take(Q.slerp(Scaled, Scaled, 0.5)), A);
        const Middle = take(Q.slerpFullPathUnnormalized(Scaled, Q.negate(Scaled), 0.5));
        Assert.ok(Number.isFinite(Middle.x) && Math.abs(Middle.x / Size - 1) < 1e-12);
    }

    close(take(Q.slerp(A, A, 1e308)), A);
    const UnequalNearAntipodes = take(Q.slerpFullPathUnnormalized(Q.QuatUnsafe(0, 0, 0, 1e-10),
        Q.QuatUnsafe(Number.MIN_VALUE, 0, 0, -2e-10), 0.5));
    Assert.ok(Number.isFinite(UnequalNearAntipodes.w) && UnequalNearAntipodes.w < -1e303);
    Assert.ok(Math.abs(UnequalNearAntipodes.x / 2e-10 - 1) < 1e-12);
});

test("rotation log/exp reconstruct signs and orientations, with explicit identity and pure-log domains", () =>
{
    const Zero = take(Q.log(Q.Identity));
    close(Zero, Q.QuatUnsafe(0, 0, 0, 0));
    close(take(Q.exp(Zero)), Q.Identity);
    close(take(Q.log(Q.negate(Q.Identity))), Q.QuatUnsafe(Math.PI, 0, 0, 0));
    close(take(Q.exp(take(Q.log(Q.negate(Q.Identity))))), Q.negate(Q.Identity));
    const Inputs = [ z(0.75), z(4.5), Q.negate(z(0.75)), take(Q.fromAxisAngle({ x: 1,
        y: 2,
        z: -3 }, 2.1)) ];
    for (const A of Inputs)
    {
        const Log = take(Q.log(Q.scale(A, 1e300)));
        Assert.equal(Log.w, 0);
        close(take(Q.exp(Log)), A);
    }

    for (const Size of [ 1e-10, 1e-100, 1e-300, Number.MIN_VALUE ])
    {
        const Value = Q.QuatUnsafe(Size, 0, 0, 0);
        const Exp = take(Q.exp(Value));
        Assert.ok(Exp.x > 0 && Math.abs(Exp.x / Size - 1) < 1e-10);
        Assert.ok(take(Q.log(Exp)).x > 0);
    }

    Assert.ok(O.isNone(Q.exp(Q.Identity)));
    Assert.ok(O.isNone(Q.exp(Q.QuatUnsafe(Infinity, 0, 0, 0))));
    Assert.ok(O.isNone(Q.log(Q.QuatUnsafe(0, 0, 0, 0))));
});

test("tangents reproduce constant-axis motion and squad endpoints in both dual forms", () =>
{
    const Previous = z(-0.5);
    const A = z(0);
    const B = z(0.5);
    const Next = z(1);
    const TangentA = take(Q.calculateTangent(A, Previous, B));
    const TangentB = take(Q.calculateTangent(B, A, Next));
    close(TangentA, A);
    close(TangentB, B);
    close(take(pipe(A, Q.calculateTangent(Previous, B))), TangentA);
    close(take(pipe(A, Q.calculateTangent(Previous, B, 0))), TangentA);
    close(take(Q.calculateTangent(B, Previous, Next, 1)), B);
    for (const T of [ -0.5, 0, 0.25, 0.5, 1, 1.5 ])
    {
        close(take(Q.squad(A, TangentA, B, TangentB, T)), z(T * 0.5));
        close(take(pipe(A, Q.squad(TangentA, B, TangentB, T))), z(T * 0.5));
        close(take(Q.squadFullPath(A, TangentA, B, TangentB, T)), z(T * 0.5));
        close(take(pipe(A, Q.squadFullPath(TangentA, B, TangentB, T))), z(T * 0.5));
    }

    const Negative = Q.negate(A);
    close(take(Q.squadFullPath(A, A, Negative, Negative, 1)), Negative);
    close(take(Q.squadFullPath(A, A, Negative, Negative, 0.5)), Q.QuatUnsafe(1, 0, 0, 0));
});

test("squad tangents give matching angular velocity across noncommuting neighboring segments", () =>
{
    const Keys = [ Q.Identity, take(Q.fromAxisAngle(V.UnitX, 0.4)),
        take(Q.fromAxisAngle(V.UnitY, 0.7)), take(Q.fromAxisAngle(V.UnitZ, 0.9)) ];
    const T1 = take(Q.calculateTangent(Keys[1], Keys[0], Keys[2]));
    const T2 = take(Q.calculateTangent(Keys[2], Keys[1], Keys[3]));
    const Step = 1e-5;
    const Left = take(Q.squad(Keys[0], Keys[0], Keys[1], T1, 1 - Step));
    const Right = take(Q.squad(Keys[1], T1, Keys[2], T2, Step));
    const Before = take(Q.log(Q.multiply(Q.conjugate(Left), Keys[1])));
    const After = take(Q.log(Q.multiply(Q.conjugate(Keys[1]), Right)));
    close(Q.scale(Before, 2 / Step), Q.scale(After, 2 / Step), 1e-4);
});

test("swing/twist reconstructs raw magnitude and keeps twist on its requested axis", () =>
{
    const Swing = take(Q.fromAxisAngle(V.UnitX, 0.75));
    const Twist = take(Q.fromAxisAngle(V.UnitY, -0.5));
    const A = Q.scale(Q.multiply(Swing, Twist), 3);
    for (const Axis of [ V.UnitX, V.UnitY, V.UnitZ, { x: 1,
        y: 2,
        z: 3 } ])
    {
        const Parts = O.getOrThrow(Q.toSwingTwist(A, Axis));
        Assert.ok(Object.isFrozen(Parts) && Object.isFrozen(Parts.swing) && Object.isFrozen(Parts.twist));
        close(Q.multiply(Parts.swing, Parts.twist), A);
        Assert.ok(Q.isNormalized(Parts.twist));
        Assert.ok(Math.abs(Q.magnitude(Parts.swing) - Q.magnitude(A)) < 1e-12);
        const Unit = O.getOrThrow(V.normalize(Axis));
        Assert.ok(V.magnitude(V.cross(Parts.twist, Unit)) < 1e-12);
        const Rotated = O.getOrThrow(Q.rotateVector(Parts.twist, Unit));
        Assert.ok(V.distance(Rotated, Unit) < 1e-12);
    }

    const Parts = O.getOrThrow(pipe(A, Q.toSwingTwist(V.UnitY)));
    close(Parts.twist, Twist);
    close(Parts.swing, Q.scale(Swing, 3));
    Assert.ok(Math.abs(O.getOrThrow(Q.twistAngle(A, V.UnitY)) + 0.5) < 1e-12);
    Assert.ok(Math.abs(O.getOrThrow(pipe(A, Q.twistAngle(V.UnitY))) + 0.5) < 1e-12);
    Assert.equal(O.getOrThrow(Q.twistAngle(Q.QuatUnsafe(0, 1, 0, 0), V.UnitY)), -Math.PI);
    const Singular = O.getOrThrow(Q.toSwingTwist(Q.QuatUnsafe(1, 0, 0, 0), V.UnitY));
    close(Singular.twist, Q.Identity);
    close(Singular.swing, Q.QuatUnsafe(1, 0, 0, 0));
    Assert.equal(O.getOrThrow(Q.twistAngle(Q.QuatUnsafe(1, 0, 0, 0), V.UnitY)), 0);
    for (const Size of [ 1e-10, 1e-100, 1e-300, Number.MIN_VALUE ])
    {
        const Tiny = Q.QuatUnsafe(0, Size, 0, 1);
        Assert.ok(O.getOrThrow(Q.twistAngle(Tiny, V.UnitY)) > 0);
        Assert.equal(O.getOrThrow(Q.twistAngle(Tiny, V.UnitY)), O.getOrThrow(Q.twistAngle(Q.negate(Tiny), V.UnitY)));
    }

    for (const Size of [ -3, 1e-300, 1e300, -1e300 ])
    {
        const Scaled = Q.scale(A, Size);
        const Factor = Math.max(Math.abs(Scaled.x), Math.abs(Scaled.y), Math.abs(Scaled.z), Math.abs(Scaled.w));
        const Decomposed = O.getOrThrow(Q.toSwingTwist(Scaled, { x: 1,
            y: 2,
            z: 3 }));
        close(Q.multiply(Q.divide(Decomposed.swing, Factor), Decomposed.twist), Q.divide(Scaled, Factor));
    }

    const Huge = Q.QuatUnsafe(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
    Assert.ok(O.isNone(Q.toSwingTwist(Huge, V.UnitX)));
    Assert.ok(O.isSome(Q.twistAngle(Huge, V.UnitX)));
    Assert.ok(O.isNone(Q.toSwingTwist(A, V.Zero)));
    Assert.ok(O.isNone(Q.twistAngle(A, { x: Infinity,
        y: 0,
        z: 0 })));
});

test("all advanced partial operations reject invalid domains without changing canonical equality", () =>
{
    const Invalid = Q.QuatUnsafe(0, 0, 0, 0);
    for (const Operation of [ Q.fastLerp, Q.slerp, Q.slerpUnnormalized, Q.slerpFullPath, Q.slerpFullPathUnnormalized ])
    {
        Assert.ok(O.isNone(Operation(Invalid, Q.Identity, 0)));
        Assert.ok(O.isNone(Operation(Q.Identity, Invalid, 1)));
        Assert.ok(O.isNone(Operation(Q.Identity, Q.Identity, NaN)));
        Assert.ok(O.isNone(Operation(Q.Identity, Q.Identity, Infinity)));
    }

    Assert.ok(O.isNone(Q.fastBilerp(Q.Identity, Q.Identity, Q.Identity, Invalid, 0, 0)));
    Assert.ok(O.isNone(Q.fastBilerp(Q.Identity, Q.Identity, Q.Identity, Q.Identity, 0, NaN)));
    Assert.ok(O.isNone(Q.squad(Invalid, Q.Identity, Q.Identity, Q.Identity, 0)));
    Assert.ok(O.isNone(Q.squadFullPath(Q.Identity, Q.Identity, Q.Identity, Invalid, 1)));
    Assert.ok(O.isNone(Q.calculateTangent(Q.Identity, Invalid, Q.Identity)));
    Assert.ok(O.isNone(Q.calculateTangent(Q.Identity, Q.Identity, Q.Identity, NaN)));
    Assert.ok(O.isNone(Q.toSwingTwist(Invalid, V.UnitY)));
    Assert.ok(O.isNone(Q.twistAngle(Invalid, V.UnitY)));
    Assert.equal(Q.errorAutoNormalize, Q.error);
    Assert.equal(O.getOrThrow(Q.errorAutoNormalize(Q.scale(Q.Identity, 1e308), Q.negate(Q.Identity))), 0);
});
