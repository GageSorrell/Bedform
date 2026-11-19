/**
 * Finite structural vector and Hamilton quaternion math shared by Gizmo picking and projection.
 *
 * @module bedform/Internal/GizmoMath
 *
 * @file      GizmoMath.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Structural coordinates retain axis ordering. */
/* eslint-disable sort-keys */

import type { Basis, Ray } from "../Diagetic/Gizmo/Geometry.js";
import type { Coordinates as Quat } from "../Quat.js";
import type { Vector3 } from "@minecraft/server";

/**
 * Copies finite vector components into a frozen value.
 *
 * @throws { RangeError } If any component is missing or non-finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const V = (value: Readonly<Vector3>): Readonly<Vector3> =>
{
    if (!value || ![ value.x, value.y, value.z ].every(Number.isFinite))
    {
        throw new RangeError("Gizmo geometry requires finite vector components");
    }

    return Object.freeze({ x: value.x,
        y: value.y,
        z: value.z });
};

/**
 * Adds structural vectors.
 *
 * @category Combining
 * @since 1.0.0
 */
export const Add = (a: Readonly<Vector3>, b: Readonly<Vector3>): Readonly<Vector3> =>
{
    return V({ x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z });
};

/**
 * Scales a structural vector.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Mul = (a: Readonly<Vector3>, scale: number): Readonly<Vector3> =>
{
    return V({ x: a.x * scale,
        y: a.y * scale,
        z: a.z * scale });
};

/**
 * Subtracts structural vectors.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Sub = (a: Readonly<Vector3>, b: Readonly<Vector3>): Readonly<Vector3> =>
{
    return Add(a, Mul(b, -1));
};

/**
 * Computes the Euclidean dot product.
 *
 * @category Getter
 * @since 1.0.0
 */
export const Dot = (a: Readonly<Vector3>, b: Readonly<Vector3>): number =>
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
};

/**
 * Computes the right-handed cross product.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Cross = (a: Readonly<Vector3>, b: Readonly<Vector3>): Readonly<Vector3> =>
{
    return V({ x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x });
};

/**
 * Normalizes a nonzero structural vector.
 *
 * @throws { RangeError } If direction is zero or non-finite.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Unit = (value: Readonly<Vector3>): Readonly<Vector3> =>
{
    const copy = V(value);
    const length = Math.hypot(copy.x, copy.y, copy.z);
    if (length < 1e-12 || !Number.isFinite(length))
    {
        throw new RangeError("Gizmo geometry requires a nonzero direction");
    }

    return Mul(copy, 1 / length);
};

/**
 * Validates and snapshots a unit forward ray without changing its distance parameterization.
 *
 * @throws { RangeError } If the ray is malformed or direction is not unit length.
 *
 * @category Validation
 * @since 1.0.0
 */
export const View = (ray: Ray): Ray =>
{
    const direction = V(ray?.Direction);
    if (Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) > 1e-6)
    {
        throw new RangeError("Gizmo view direction must be unit length");
    }

    return Object.freeze({ Origin: V(ray.Origin),
        Direction: direction });
};

/**
 * Composes Hamilton quaternions, applying the right operand first.
 *
 * @category Combining
 * @since 1.0.0
 */
export const Product = (a: Quat, b: Quat): Quat =>
{
    return Object.freeze({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
        y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
        z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
        w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
};

/**
 * Inverts a unit quaternion.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Inverse = (value: Quat): Quat =>
{
    return Object.freeze({ x: -value.x,
        y: -value.y,
        z: -value.z,
        w: value.w });
};

/**
 * Rotates a vector by a unit quaternion.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const Rotate = (rotation: Quat, value: Readonly<Vector3>): Readonly<Vector3> =>
{
    const q = V(rotation);
    const twice = Mul(Cross(q, value), 2);
    return Add(value, Add(Mul(twice, rotation.w), Cross(q, twice)));
};

/**
 * Captures a stable camera plane, including straight-up and straight-down views.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Camera = (direction: Readonly<Vector3>): Basis =>
{
    const z = Unit(direction);
    const up = Math.abs(z.y) < 0.99 ? V({ x: 0,
        y: 1,
        z: 0 }) : V({ x: 0,
        y: 0,
        z: 1 });
    const x = Unit(Cross(z, up));
    return Object.freeze({ X: x,
        Y: Unit(Cross(x, z)),
        Z: Mul(z, -1) });
};
