/**
 * Pure degree-based rotation conventions, values and helper operations.
 *
 * @module bedform/Internal/Rotation
 *
 * @file      Rotation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document exported variables at their export declaration. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import { normalizeComponents } from "./Vector.js";

/**
 * Readonly canonical x/y/z/w rotation-key components.
 *
 * @category Types
 * @since 1.0.0
 */
export type RotationKey = readonly [x: number, y: number, z: number, w: number];

/**
 * Readonly principal pitch/yaw/roll components in degrees.
 *
 * @category Types
 * @since 1.0.0
 */
export type EulerTuple = readonly [pitch: number, yaw: number, roll: number];

/**
 * Reduces finite angles to [-180,180), retaining tiny negative magnitudes and collapsing signed
 * zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalizedDegrees = (value: number): number =>
{
    const Magnitude = N.positiveModulo(N.abs(value), 360);
    const Signed = value < 0 ? -Magnitude : Magnitude;
    const Result = Signed >= 180 ? Signed - 360 : Signed < -180 ? Signed + 360 : Signed;
    return Result === 0 ? 0 : Result;
};

/**
 * Chooses positive w and first-nonzero x/y/z half-turn sign.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotationSign = (key: ReadonlyArray<number>): number =>
{
    if (key[3] !== 0)
    {
        return key[3] < 0 ? -1 : 1;
    }

    for (let index = 0; index < 3; index++)
    {
        if (key[index] !== 0)
        {
            return key[index] < 0 ? -1 : 1;
        }
    }

    return 1;
};

/**
 * Normalizes stably, rounds to twelve decimals, reapplies sign and collapses signed zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotationKey = (values: ReadonlyArray<number>): Option.Option<RotationKey> =>
{
    const Unit = normalizeComponents(values);
    if (Option.isNone(Unit))
    {
        return Option.none();
    }

    const Sign = rotationSign(Unit.value);
    const Rounded = Unit.value.map((value: number) => N.round(value * Sign, 12));
    const FinalSign = rotationSign(Rounded);
    const Key = Rounded.map((value: number) => value === 0 ? 0 : value * FinalSign);
    return Option.some(Object.freeze([ Key[0], Key[1], Key[2], Key[3] ] as const));
};

/**
 * Orders negative infinity, finite values, positive infinity and NaN, with signed-zero agreement.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compareNumbers = (self: number, that: number): -1 | 0 | 1 =>
{
    if (self === that)
    {
        return 0;
    }

    if (N.Number.isNaN(self))
    {
        return N.Number.isNaN(that) ? 0 : 1;
    }

    if (N.Number.isNaN(that))
    {
        return -1;
    }

    return self < that ? -1 : 1;
};

/**
 * Compares equal-length numeric keys lexicographically.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compareNumericKeys = (self: ReadonlyArray<number>, that: ReadonlyArray<number>): -1 | 0 | 1 =>
{
    for (let index = 0; index < self.length; index++)
    {
        const Compared = compareNumbers(self[index], that[index]);
        if (Compared !== 0)
        {
            return Compared;
        }
    }

    return 0;
};

/**
 * Evaluates degree half-angle sine/cosine with exact quarter/half-turn landmarks.
 *
 * @category Operation
 * @since 1.0.0
 */
const halfAngle = (value: number): readonly [number, number] =>
{
    if (value === 0)
    {
        return [ 0, 1 ];
    }

    if (N.abs(value) === 180)
    {
        return [ value < 0 ? -1 : 1, 0 ];
    }

    if (N.abs(value) === 90)
    {
        return [ (value < 0 ? -1 : 1) * N.sqrt(0.5), N.sqrt(0.5) ];
    }

    const Angle = N.toRadians(value / 2);
    return [ N.sin(Angle), N.cos(Angle) ];
};

/**
 * Converts winding-reduced Minecraft intrinsic yaw/pitch/roll into a frozen unit quaternion tuple.
 *
 * @category Operation
 * @since 1.0.0
 */
export const anglesToQuat = (pitch: number, yaw: number, roll: number): Option.Option<RotationKey> =>
{
    if (![ pitch, yaw, roll ].every(N.Number.isFinite))
    {
        return Option.none();
    }

    const [ SX, CX ] = halfAngle(normalizedDegrees(pitch));
    const [ SY, CY ] = halfAngle(-normalizedDegrees(yaw));
    const [ SZ, CZ ] = halfAngle(normalizedDegrees(roll));
    const Values = normalizeComponents([
        CY * SX * CZ + SY * CX * SZ,
        SY * CX * CZ - CY * SX * SZ,
        CY * CX * SZ - SY * SX * CZ,
        CY * CX * CZ + SY * SX * SZ
    ]);
    return Option.map(Values,
        (key: ReadonlyArray<number>) => Object.freeze([ key[0],
            key[1],
            key[2],
            key[3] ] as const));
};

/**
 * Extracts principal Y-X-Z angles in degrees; cosine-pitch <=1e-12 uses roll zero and combined
 * yaw.
 *
 * @category Operation
 * @since 1.0.0
 */
export const quaternionToAngles = (values: ReadonlyArray<number>): Option.Option<EulerTuple> =>
{
    const Unit = normalizeComponents(values);
    if (Option.isNone(Unit))
    {
        return Option.none();
    }

    const [ X, Y, Z, W ] = Unit.value;
    const SinePitch = N.clamp(2 * (X * W - Y * Z), { maximum: 1,
        minimum: -1 });
    const First = N.atan2(Y - Z, W + X);
    const Second = N.atan2(Y + Z, W - X);
    const CosinePitch = N.hypot(W + X, Y - Z) * N.hypot(W - X, Y + Z);
    if (CosinePitch <= 1e-12)
    {
        const Yaw = normalizedDegrees(-2 * N.toDegrees(SinePitch < 0 ? Second : First));
        return Option.some(Object.freeze([ SinePitch < 0 ? -90 : 90, Yaw, 0 ] as const));
    }

    const Pitch = N.toDegrees(N.atan2(SinePitch, CosinePitch));
    return Option.some(Object.freeze([
        Pitch === 0 ? 0 : Pitch,
        normalizedDegrees(-N.toDegrees(First + Second)),
        normalizedDegrees(N.toDegrees(Second - First))
    ] as const));
};
