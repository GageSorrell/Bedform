/**
 * Versioned physical geometry and generated model catalog contracts.
 *
 * @module bedform/PhysicsModel
 *
 * @file      PhysicsModel.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Discriminants and vector channels precede related fields. */

/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as B from "./AABB.js";
import type * as C from "./CollisionShape.js";
import type * as V from "./Vector3.js";

/**
 * Original authoring provenance retained independently of renderer face merging.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Source
{
    readonly object: string;
    readonly face: number;
}

/**
 * Oriented evaluated triangle; cavities have opposite winding to exterior shells.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Triangle
{
    readonly indices: readonly [number, number, number];
    readonly source: Source;
}

/**
 * Exporter/compiler interchange before texture masking or particle region merging.
 * Fingerprint is SHA-256 of canonical JSON of all fields except fingerprint itself.
 * Blender coordinates convert as (x,z,-y); metresPerUnit applies exactly once.
 * Mirrored evaluated transforms must already have corrected oriented topology.
 *
 * @category Types
 * @since 1.0.0
 */
export interface MeshSolid
{
    readonly schemaVersion: 1;
    readonly coordinates: "minecraft" | "blender";
    readonly metresPerUnit: number;
    readonly vertices: ReadonlyArray<V.Coordinates>;
    readonly triangles: ReadonlyArray<Triangle>;
    readonly fingerprint: string;
}

/**
 * Converted model-local source boundary before collision selection or renderer merging.
 * Closed mesh shells retain outward/inward winding and original face provenance.
 * Cuboid surfaces retain individual overlap boundaries for reproducible union compilation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SolidSurface
{
    readonly vertices: ReadonlyArray<V.Vector3>;
    readonly triangles: ReadonlyArray<Triangle>;
}

/**
 * Symmetric inertia tensor about the configured COM in kg block squared.
 *
 * @category Types
 * @since 1.0.0
 */
export type Inertia = readonly [number, number, number, number, number, number, number, number, number];

/**
 * Uniform source-solid properties, independent of selected collision or renderer.
 *
 * @category Types
 * @since 1.0.0
 */
export interface MassProperties
{
    readonly volume: number;
    readonly mass: number;
    readonly centroid: V.Vector3;
    readonly centerOfMass: V.Vector3;
    readonly inertia: Inertia;
}

/**
 * An immutable generated catalog record. Fingerprints include compatible visual assets.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Model
{
    readonly schemaVersion: 1;
    readonly name: string;
    readonly identifier: string;
    readonly representation: "cuboid" | "particle";
    readonly fingerprint: string;
    readonly renderer?: string;
    readonly sourceGeometry: ReadonlyArray<SolidSurface>;
    readonly bounds: B.AABB;
    readonly sourceCells: ReadonlyArray<C.CollisionShape.Cell>;
    readonly collision: C.CollisionShape;
    readonly physical: MassProperties;
    readonly restitution: number;
    readonly gravity?: V.Vector3;
    readonly linearVelocity: V.Vector3;
    readonly angularVelocity: V.Vector3;
}
