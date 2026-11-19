/**
 * Conditioned collision vector arithmetic and small simplex systems.
 *
 * @module bedform/Internal/CollisionMath
 *
 * @file      CollisionMath.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Mathematical kernels retain coordinate ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef */

import * as V from "../Vector3.js";

/**
 * Adds coordinate vectors without modifying either operand.
 *
 * @category Internal
 * @since 1.0.0
 */
export const add = (a: V.Coordinates, b: V.Coordinates): V.Vector3 =>
{
    return V.Vector3Unsafe(a.x + b.x, a.y + b.y, a.z + b.z);
};

/**
 * Subtracts coordinate vectors.
 *
 * @category Internal
 * @since 1.0.0
 */
export const sub = (a: V.Coordinates, b: V.Coordinates): V.Vector3 =>
{
    return V.Vector3Unsafe(a.x - b.x, a.y - b.y, a.z - b.z);
};

/**
 * Scales a coordinate vector.
 *
 * @category Internal
 * @since 1.0.0
 */
export const scale = (a: V.Coordinates, s: number): V.Vector3 =>
{
    return V.Vector3Unsafe(a.x * s, a.y * s, a.z * s);
};

/**
 * Computes an inner product.
 *
 * @category Internal
 * @since 1.0.0
 */
export const dot = (a: V.Coordinates, b: V.Coordinates): number =>
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
};

/**
 * Computes a right-handed cross product.
 *
 * @category Internal
 * @since 1.0.0
 */
export const cross = (a: V.Coordinates, b: V.Coordinates): V.Vector3 =>
{
    return V.Vector3Unsafe(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
};

/**
 * Computes a stable Euclidean length.
 *
 * @category Internal
 * @since 1.0.0
 */
export const length = (a: V.Coordinates): number =>
{
    return Math.hypot(a.x, a.y, a.z);
};

/**
 * Returns a unit vector, choosing positive X for an exactly zero direction.
 *
 * @category Internal
 * @since 1.0.0
 */
export const unit = (a: V.Coordinates): V.Vector3 =>
{
    const Length = length(a);
    return Length === 0 ? V.UnitX : scale(a, 1 / Length);
};

/**
 * Computes a convex combination with explicit barycentric weights.
 *
 * @category Internal
 * @since 1.0.0
 */
export const blend = (points: ReadonlyArray<V.Coordinates>, weights: ReadonlyArray<number>): V.Vector3 =>
{
    return points.reduce<V.Vector3>((sum, point, i) => add(sum, scale(point, weights[i])), V.Zero);
};

/**
 * Solves a small nonsingular system with deterministic partial pivoting. Singular
 * systems have no unique solution and yield an empty array.
 *
 * @category Internal
 * @since 1.0.0
 */
export const solve = (matrix: ReadonlyArray<ReadonlyArray<number>>,
    right: ReadonlyArray<number>): ReadonlyArray<number> =>
{
    const Rows = matrix.map((row, i) => [ ...row, right[i] ]);
    const Size = Rows.length;
    const Magnitude = Math.max(...matrix.flatMap((row) => [ ...row ].map(Math.abs)));
    for (let column = 0; column < Size; column++)
    {
        let pivot = column;
        for (let i = column + 1; i < Size; i++)
        {
            if (Math.abs(Rows[i][column]) > Math.abs(Rows[pivot][column]))
            {
                pivot = i;
            }
        }

        if (Math.abs(Rows[pivot][column]) <= Magnitude * 1e-13)
        {
            return [];
        }

        [ Rows[column], Rows[pivot] ] = [ Rows[pivot], Rows[column] ];
        const Divisor = Rows[column][column];
        for (let j = column; j <= Size; j++)
        {
            Rows[column][j] /= Divisor;
        }

        for (let i = 0; i < Size; i++)
        {
            if (i !== column)
            {
                const Factor = Rows[i][column];
                for (let j = column; j <= Size; j++)
                {
                    Rows[i][j] -= Factor * Rows[column][j];
                }
            }
        }
    }

    return Rows.map((row) => row[Size]);
};
