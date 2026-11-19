/**
 * Source-solid tensor transport and finite rigid dynamics arithmetic.
 *
 * @module bedform/Internal/PhysicsMath
 *
 * @file      PhysicsMath.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Tensor coefficients retain row-major mathematical ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */

import * as V from "../Vector3.js";
import * as Q from "../Quat.js";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import type * as Model from "../PhysicsModel.js";
import * as M from "./CollisionMath.js";

/**
 * Validation and numerical failures represented at the public Result boundary.
 *
 * @category Errors
 * @since 1.0.0
 */
export interface PhysicsError
{
    readonly _tag: "PhysicsError";
    readonly code: "InvalidInput" | "NumericalFailure" | "MissingBody" | "DuplicateBody" | "ComplexityLimit";
    readonly message: string;
}

/**
 * Private exception used for transactional rollback and public typed diagnostics.
 *
 * @category Internal
 * @since 1.0.0
 */
export class Fault extends Error
{
    constructor(readonly code: PhysicsError["code"], message: string)
    {
        super(message);
    }
}

/**
 * Converts internal exceptions without publishing partial values.
 *
 * @category Internal
 * @since 1.0.0
 */
export const attempt = <A>(run: () => A): R.Result<A, PhysicsError> =>
{
    try
    {
        return R.succeed(run());
    }
    catch (error)
    {
        return R.fail(Object.freeze({ _tag: "PhysicsError",
            code: error instanceof Fault ? error.code : "InvalidInput",
            message: error instanceof Error ? error.message : "Invalid physics input" }));
    }
};

/**
 * Copies a finite vector without freezing caller-owned coordinates.
 *
 * @throws { Fault } Nonfinite coordinates.
 *
 * @category Internal
 * @since 1.0.0
 */
export const vector = (value: V.Coordinates, label: string): V.Vector3 =>
{
    if (!value || !V.isFinite(value))
    {
        throw new Fault("InvalidInput", `Invalid ${label}`);
    }

    return V.Vector3Unsafe(value.x, value.y, value.z);
};

/**
 * Owns a finite nine-coefficient tensor.
 *
 * @throws { Fault } Invalid tensor dimensions or coefficients.
 *
 * @category Internal
 * @since 1.0.0
 */
export const tensor = (values: ReadonlyArray<number>): Model.Inertia =>
{
    if (values.length !== 9 || !values.every(Number.isFinite))
    {
        throw new Fault("InvalidInput", "Invalid inertia tensor");
    }

    return Object.freeze([ ...values ]) as unknown as Model.Inertia;
};

/**
 * Multiplies a row-major tensor and a coordinate vector.
 *
 * @category Internal
 * @since 1.0.0
 */
export const apply = (matrix: Model.Inertia, value: V.Coordinates): V.Vector3 =>
{
    return V.Vector3Unsafe(matrix[0] * value.x + matrix[1] * value.y + matrix[2] * value.z,
        matrix[3] * value.x + matrix[4] * value.y + matrix[5] * value.z,
        matrix[6] * value.x + matrix[7] * value.y + matrix[8] * value.z);
};

/**
 * Applies a local tensor in the world frame through shared quaternion operations.
 *
 * @category Internal
 * @since 1.0.0
 */
const WorldTensors = new WeakMap<object, WeakMap<object, Model.Inertia>>();

/**
 * Applies the complete rotated tensor, caching only frozen owned tensor and
 * quaternion identities. Off-diagonal coupling is retained without repeatedly
 * rotating and normalizing intermediate vectors for each contact constraint.
 *
 * @throws { Fault } The tensor frame or input vector is invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
export const world = (matrix: Model.Inertia, rotation: Q.Coordinates, value: V.Coordinates): V.Vector3 =>
{
    if (matrix[0] === matrix[4] && matrix[4] === matrix[8] && matrix[1] === 0 && matrix[2] === 0 && matrix[3] === 0 && matrix[5] === 0 && matrix[6] === 0 && matrix[7] === 0)
    {
        if (!Q.isFinite(rotation) || rotation.x === 0 && rotation.y === 0 && rotation.z === 0 && rotation.w === 0 || !V.isFinite(value))
        {throw new Fault("InvalidInput", "Invalid tensor frame or vector");}

        return matrix[0] === 0 ? V.Zero : M.scale(value, matrix[0]);
    }

    const Cacheable = Object.isFrozen(matrix) && Q.isQuat(rotation) && Object.isFrozen(rotation);
    let entries = Cacheable ? WorldTensors.get(matrix) : undefined;
    let rotated = entries?.get(rotation);
    if (!rotated)
    {
        const Axes = O.getOrThrow(Q.axes(rotation));
        const Rows = [ [ Axes.x.x, Axes.y.x, Axes.z.x ], [ Axes.x.y, Axes.y.y, Axes.z.y ], [ Axes.x.z, Axes.y.z, Axes.z.z ] ];
        rotated = Object.freeze(Array.from({ length: 9 }, (_, index) =>
        {
            const A = Rows[Math.floor(index / 3)];
            const B = Rows[index % 3];
            let result = 0;
            for (let row = 0; row < 3; row++)
            {
                for (let column = 0; column < 3; column++)
                {result += A[row] * matrix[row * 3 + column] * B[column];}
            }

            return result;
        })) as Model.Inertia;
        if (Cacheable)
        {
            if (!entries)
            {
                entries = new WeakMap();
                WorldTensors.set(matrix, entries);
            }

            entries.set(rotation, rotated);
        }
    }

    return apply(rotated, value);
};

/**
 * Positive parallel-axis contribution about a displaced center.
 *
 * @category Internal
 * @since 1.0.0
 */
export const parallel = (mass: number, offset: V.Coordinates): Model.Inertia =>
{
    const Components = [ offset.x, offset.y, offset.z ];
    const Square = M.dot(offset, offset);
    return tensor(Array.from({ length: 9 }, (_, i) => mass * ((i % 4 === 0 ? Square : 0) - Components[Math.floor(i / 3)] * Components[i % 3])));
};

/**
 * Validates symmetric positive-definite tensors with a conditioned Cholesky test,
 * then computes their inverse. Failed conditioning is explicit, never a diagonal proxy.
 *
 * @throws { Fault } Nonpositive, asymmetric or numerically singular inertia.
 *
 * @category Internal
 * @since 1.0.0
 */
export const inverse = (input: Model.Inertia): Model.Inertia =>
{
    const Scale = Math.max(...input.map(Math.abs));
    if (!(Scale > 0) || !Number.isFinite(Scale))
    {
        throw new Fault("InvalidInput", "Degenerate inertia");
    }

    const A = input.map((v) => v / Scale);
    if (Math.abs(A[1] - A[3]) > 1e-10 || Math.abs(A[2] - A[6]) > 1e-10 || Math.abs(A[5] - A[7]) > 1e-10 || A[0] <= 0)
    {
        throw new Fault("InvalidInput", "Inertia must be symmetric positive definite");
    }

    const L00 = Math.sqrt(A[0]);
    const L10 = A[3] / L00;
    const L20 = A[6] / L00;
    const D11 = A[4] - L10 * L10;
    if (D11 <= 1e-13)
    {
        throw new Fault("InvalidInput", "Ill-conditioned inertia");
    }

    const L11 = Math.sqrt(D11);
    const L21 = (A[7] - L20 * L10) / L11;
    if (A[8] - L20 * L20 - L21 * L21 <= 1e-13)
    {
        throw new Fault("InvalidInput", "Ill-conditioned inertia");
    }

    const Columns = [ 0, 1, 2 ].map((i) => M.solve([ A.slice(0, 3), A.slice(3, 6), A.slice(6, 9) ], [ i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0 ]));
    if (Columns.some((c) => c.length !== 3))
    {
        throw new Fault("InvalidInput", "Singular inertia");
    }

    return tensor(Array.from({ length: 9 }, (_, i) => Columns[i % 3][Math.floor(i / 3)] / Scale));
};

/**
 * Canonical orientation representation used only by value protocols, not integration.
 *
 * @category Internal
 * @since 1.0.0
 */
export const poseKey = (rotation: Q.Coordinates): ReadonlyArray<number> =>
{
    const Unit = O.getOrThrow(Q.normalize(rotation));
    const Sign = [ Unit.w, Unit.x, Unit.y, Unit.z ].find((n) => n !== 0)! < 0 ? -1 : 1;
    return [ Unit.x, Unit.y, Unit.z, Unit.w ].map((n) => Math.round(n * Sign * 1e12) / 1e12);
};
