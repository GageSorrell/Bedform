/**
 * Explicit renderer attachment without imports from Bedrock or ParticleRuntime.
 *
 * @module bedform/PhysicsRenderer
 *
 * @file      PhysicsRenderer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host geometry/packet expressions keep mathematical ordering and contextual types. */
/* eslint-disable sort-imports, @stylistic/max-len */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as M from "./PhysicsModel.js";
import type * as T from "./Transform.js";
import type * as V from "./Vector3.js";
import * as R from "@bedform/effect/Result";
import { EntityProperty } from "./keys.js";
import * as Transform from "./Transform.js";

/**
 * Fixed presentation interval in seconds, shared by every representation.
 *
 * @category Constants
 * @since 1.0.0
 */
export const IntervalSeconds = 0.05 as const;

/**
 * Complete committed model-origin poses. Sequence increases monotonically through
 * reset generations; a reset or skipped sequence initializes both endpoints to end.
 * Render base is the actual rendered neutral-rotation owner/anchor origin, not COM.
 * Pose fields are published before their matching sequence commit marker.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Interval
{
    readonly start: T.Transform;
    readonly end: T.Transform;
    readonly duration: typeof IntervalSeconds;
    readonly sequence: number;
    readonly reset: number;
    readonly renderBase: V.Vector3;
}

/**
 * Idempotent attachment lifecycle; disposal also applies to failed startup rollback.
 * Rebase changes presentation coordinates only. A dimension change disposes the old
 * attachment before attaching anew with a reset interval. Pause holds the endpoint.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Attachment
{
    readonly commit: (interval: Interval) => void;
    readonly rebase: (base: V.Vector3) => void;
    readonly pause: () => void;
    readonly dispose: () => void;
}

/**
 * Explicit runtime adapter. Each particle attachment owns one transient anchor;
 * persistent physics owners and native-contact helpers are independently owned.
 * Missing or incompatible assets must fail instead of switching representation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Renderer
{
    readonly attach: (model: M.Model, bodyId: string, dimensionId: string, initial: Interval) => Attachment;
}

/**
 * Invalid or unrepresentable presentation interval, requiring an explicit rebase/reset.
 *
 * @category Errors
 * @since 1.0.0
 */
export interface IntervalError
{
    readonly _tag: "IntervalError";
    readonly message: string;
}

/**
 * Encodes a complete tagged property packet. Local positions have 1/4096 block
 * precision within [-8,8); quaternion components have 1/32767 precision and are
 * renormalized on the client. Base integer coordinates use two words plus a
 * 1/65535 fractional word. Every word carries sequence modulo 128, so torn packets
 * are held until every channel matches. Transports must retire payloads within
 * 127 commits; the runtime engine fixture must qualify that delivery bound.
 * Sequence is monotonic through resets; respawn before exhausting 8,388,607.
 * Publish payload and reset first, then Sequence. Neither duplicate nor stale
 * sequence restarts the shared presentation clock.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const encode = (interval: Interval): R.Result<Readonly<Record<string, number>>, IntervalError> =>
{
    const Fail = (message: string): R.Result<never, IntervalError> =>
        R.fail(Object.freeze({ _tag: "IntervalError",
            message }));
    if (interval.duration !== IntervalSeconds || !Transform.isValid(interval.start) || !Transform.isValid(interval.end) ||
        !Number.isSafeInteger(interval.sequence) || interval.sequence < 0 || interval.sequence > 8_388_607 ||
        !Number.isSafeInteger(interval.reset) || interval.reset < 0 || interval.reset > 65_535)
    {
        return Fail("Invalid interval pose, duration or sequence/reset");
    }

    const Values: Record<string, number> = {};
    const Tag = (interval.sequence % 128) * 65_536;
    const Put = (key: string, word: number): void =>
    {
        Values[key] = word + Tag;
    };

    for (const [ Axis, StartKey, EndKey, Low, High, Fraction ] of [
        [ "x", EntityProperty.Sx, EntityProperty.Ex, EntityProperty.BxLow, EntityProperty.BxHigh, EntityProperty.BxFraction ],
        [ "y", EntityProperty.Sy, EntityProperty.Ey, EntityProperty.ByLow, EntityProperty.ByHigh, EntityProperty.ByFraction ],
        [ "z", EntityProperty.Sz, EntityProperty.Ez, EntityProperty.BzLow, EntityProperty.BzHigh, EntityProperty.BzFraction ]
    ] as const)
    {
        const Base = interval.renderBase[Axis];
        const Integer = Math.floor(Base);
        if (!Number.isFinite(Base) || Integer < -2_147_483_648 || Integer > 2_147_483_647)
        {
            return Fail("Render base exceeds signed 32-bit block coordinates");
        }

        const Unsigned = Integer + 2_147_483_648;
        Put(Low, Unsigned % 65_536);
        Put(High, Math.floor(Unsigned / 65_536));
        Put(Fraction, Math.round((Base - Integer) * 65_535));
        for (const [ Pose, Key ] of [ [ interval.start, StartKey ], [ interval.end, EndKey ] ] as const)
        {
            const Local = Math.round((Pose.position[Axis] - Base) * 4_096);
            if (Local < -32_768 || Local > 32_767)
            {
                return Fail("Pose is outside render-base range; rebase or reset the interval");
            }

            Put(Key, Local + 32_768);
        }
    }

    const Start = interval.start.rotation;
    const End = interval.end.rotation;
    const A = [ Start.x, Start.y, Start.z, Start.w ];
    const B = [ End.x, End.y, End.z, End.w ];
    // Scale before normalization to retain finite extreme quaternion inputs.
    for (const Components of [ A, B ])
    {
        const Scale = Math.max(...Components.map((n: number) => Math.abs(n)));
        for (let i = 0; i < Components.length; i++)
        {
            Components[i] /= Scale;
        }
    }

    // Canonicalize the start so exact half-turn paths are invariant under q/-q.
    if ([ A[3], A[0], A[1], A[2] ].find((n: number) => n !== 0)! < 0)
    {
        for (let i = 0; i < A.length; i++)
        {
            A[i] = -A[i];
        }
    }

    const La = Math.hypot(...A);
    const Lb = Math.hypot(...B);
    const D = A.reduce((sum: number, n: number, i: number) => sum + n * B[i], 0);
    // Exact half turns choose the lexicographically positive endpoint independent of q/-q.
    const Sign = D < 0 || (D === 0 && B.find((n: number) => n !== 0)! < 0) ? -1 : 1;
    [ EntityProperty.Sqx, EntityProperty.Sqy, EntityProperty.Sqz, EntityProperty.Sqw ].forEach((key: string, i: number) =>
        Put(key, Math.round(A[i] / La * 32_767) + 32_768));
    [ EntityProperty.Eqx, EntityProperty.Eqy, EntityProperty.Eqz, EntityProperty.Eqw ].forEach((key: string, i: number) =>
        Put(key, Math.round(B[i] / Lb * Sign * 32_767) + 32_768));
    Put(EntityProperty.Reset, interval.reset);
    Values[EntityProperty.Sequence] = interval.sequence;
    return R.succeed(Object.freeze(Values));
};
