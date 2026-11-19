/**
 * Renderer-independent immutable collision descriptions, measured in blocks.
 *
 * @module bedform/CollisionShape
 *
 * @file      CollisionShape.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Discriminants and vector channels precede related fields. */
/* eslint-disable sort-keys */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as H from "./ConvexHull.js";
import * as R from "@bedform/effect/Result";
import * as T from "./Transform.js";
import * as V from "./Vector3.js";

export namespace CollisionShape
{
    /**
     * A positioned analytic primitive. Capsule half-length excludes its hemispheres.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Primitive
    {
        readonly kind: "box" | "sphere" | "ellipsoid" | "capsule";
        readonly pose: T.Transform;
        readonly halfExtents: V.Vector3;
    }

    /**
     * A convex partition cell. Face metadata has the same order as hull.faces.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Cell
    {
        readonly hull: H.ConvexHull;
        readonly internalFaces: ReadonlyArray<boolean>;
        readonly sources: ReadonlyArray<string>;
    }

    /**
     * Exact nonoverlapping source-solid partition, with seams excluded from contacts.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Complex
    {
        readonly kind: "complex";
        readonly cells: ReadonlyArray<Cell>;
    }

    /**
     * A union of independently positioned primitive or complex colliders.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Compound
    {
        readonly kind: "compound";
        readonly children: ReadonlyArray<CollisionShape>;
    }
}

/**
 * Pure collision data, independent of physical mass and visual representation.
 *
 * @category Types
 * @since 1.0.0
 */
export type CollisionShape = CollisionShape.Primitive | CollisionShape.Complex | CollisionShape.Compound;

/**
 * Rejected primitive configuration, represented as immutable data.
 *
 * @category Errors
 * @since 1.0.0
 */
export interface ShapeError
{
    readonly _tag: "ShapeError";
    readonly message: string;
}

/**
 * Copies and validates primitive dimensions and pose. Spheres use equal radii;
 * capsules use equal X/Z radius and Y as the straight segment half-length.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const primitive = (kind: CollisionShape.Primitive["kind"], halfExtents: V.Coordinates,
    pose: T.Coordinates = T.Identity): R.Result<CollisionShape.Primitive, ShapeError> =>
{
    const { x: X, y: Y, z: Z } = halfExtents;
    if (![ "box", "sphere", "ellipsoid", "capsule" ].includes(kind) ||
        ![ X, Y, Z ].every(Number.isFinite) || X <= 0 || Z <= 0 ||
        (kind === "capsule" ? Y < 0 || X !== Z : Y <= 0) ||
        (kind === "sphere" && (X !== Y || Y !== Z)) || !T.isValid(pose))
    {
        return R.fail(Object.freeze({ _tag: "ShapeError",
            message: "Invalid primitive dimensions or pose" }));
    }

    return R.succeed(Object.freeze({ kind,
        halfExtents: V.Vector3Unsafe(X, Y, Z),
        pose: T.TransformUnsafe(pose.position, pose.rotation) }));
};
