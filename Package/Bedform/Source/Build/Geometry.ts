/**
 * Strict rigid Bedrock cuboid ingestion and one-time coordinate conversion.
 *
 * @module bedform/Build/Geometry
 *
 * @file      Geometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

import type * as V from "../Vector3.js";
import { SolidError, type Surface } from "./Solid.js";

/**
 * Checked JSON object used at the host input boundary.
 *
 * @category Types
 * @since 1.0.0
 */
export type JsonObject = Record<string, unknown>;

/**
 * Validates a non-array JSON object with a contextual diagnostic.
 *
 * @throws { SolidError } The input is not an object.
 *
 * @category Build
 * @since 1.0.0
 */
export const object = (value: unknown, label: string): JsonObject =>
{
    if (!value || typeof value !== "object" || Array.isArray(value))
    {
        throw new SolidError(`${label} must be an object`);
    }

    return value as JsonObject;
};

/**
 * Validates an explicitly finite coordinate triple without coercion.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const triple = (value: unknown, label: string): [number, number, number] =>
{
    if (!Array.isArray(value) || value.length !== 3 || !value.every((v) => typeof v === "number" && Number.isFinite(v)))
    {
        throw new SolidError(`${label} must be three finite numbers`);
    }

    return [ ...value ] as [number, number, number];
};

/**
 * Selected geometry with authored bone data retained for visual generation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Cuboids
{
    readonly geometry: JsonObject;
    readonly surfaces: ReadonlyArray<Surface>;
}

const CubeFaces = [ [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ], [ 0, 4, 6, 2 ],
    [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ] ] as const;

/**
 * Applies documented X-then-Y-then-Z authored rotations about a model-space pivot.
 * Model-to-world reflection occurs after all cube and ancestor transforms.
 *
 * @category Build
 * @since 1.0.0
 */
const rotate = (point: Array<number>, pivot: Array<number>, degrees: Array<number>): Array<number> =>
{
    let [ x, y, z ] = point.map((n, i) => n - pivot[i]);
    for (let axis = 0; axis < 3; axis++)
    {
        const Angle = degrees[axis] * Math.PI / 180;
        const C = Math.cos(Angle);
        const S = Math.sin(Angle);
        if (axis === 0)
        {
            [ y, z ] = [ C * y - S * z, S * y + C * z ];
        }

        if (axis === 1)
        {
            [ x, z ] = [ C * x + S * z, -S * x + C * z ];
        }

        if (axis === 2)
        {
            [ x, y ] = [ C * x - S * y, S * x + C * y ];
        }
    }

    return [ x + pivot[0], y + pivot[1], z + pivot[2] ];
};

/**
 * Rejects unsupported physical deformation instead of silently dropping geometry.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
const rigid = (node: JsonObject, label: string): void =>
{
    for (const Key of [ "poly_mesh", "texture_meshes", "binding", "animations", "scale", "reset", "neverRender" ])
    {
        if (Key in node)
        {
            throw new SolidError(`${label}: unsupported ${Key}; use evaluated mesh-solid particle registration for rigid meshes`);
        }
    }
};

/**
 * Bakes inflation, per-cube pivots and ancestor transforms; UV mirroring remains visual.
 * Geometry units are sixteenths of blocks and model Z is opposite world Z.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const cuboids = (input: unknown, identifier: string, allowEmpty = false): Cuboids =>
{
    const Document = object(input, "Geometry document");
    if (!Array.isArray(Document["minecraft:geometry"]))
    {
        throw new SolidError("Expected modern minecraft:geometry array");
    }

    const Selected = Document["minecraft:geometry"].map((g) => object(g, "Geometry")).filter((g) =>
        object(g.description, "Geometry description").identifier === identifier);
    if (Selected.length !== 1)
    {
        throw new SolidError(`Expected exactly one geometry ${identifier}`);
    }

    const Geometry = structuredClone(Selected[0]);
    rigid(Geometry, identifier);
    if (!Array.isArray(Geometry.bones))
    {
        throw new SolidError("Geometry bones must be an array");
    }

    if (Geometry.bones.length > 256)
    {
        throw new SolidError("Bone budget exceeds 256");
    }

    const Bones = Geometry.bones.map((b) => object(b, "Bone"));
    const Names = new Map<string, JsonObject>();
    for (const Bone of Bones)
    {
        if (typeof Bone.name !== "string" || !Bone.name || Names.has(Bone.name))
        {
            throw new SolidError("Bone names must be unique nonempty strings");
        }

        rigid(Bone, Bone.name);
        Names.set(Bone.name, Bone);
        if (Bone.parent !== undefined && typeof Bone.parent !== "string")
        {
            throw new SolidError(`Invalid parent for ${Bone.name}`);
        }
    }

    const Chains = new Map<JsonObject, Array<JsonObject>>();
    for (const Bone of Bones)
    {
        const Chain: Array<JsonObject> = [];
        const Seen = new Set<JsonObject>();
        let current: JsonObject | undefined = Bone;
        while (current)
        {
            if (Seen.has(current))
            {
                throw new SolidError(`Bone cycle at ${String(current.name)}`);
            }

            Seen.add(current);
            Chain.push(current);
            if (current.parent === undefined)
            {
                break;
            }

            const Parent = Names.get(String(current.parent));
            if (!Parent)
            {
                throw new SolidError(`Missing parent ${String(current.parent)}`);
            }

            current = Parent;
        }

        // Validate transforms even for empty bones.
        Chain.forEach((b) =>
        {
            triple(b.pivot ?? [ 0, 0, 0 ], "Bone pivot");
            triple(b.rotation ?? [ 0, 0, 0 ], "Bone rotation");
        });
        Chains.set(Bone, Chain);
    }

    const Surfaces: Array<Surface> = [];
    for (const Bone of Bones)
    {
        if (Bone.cubes !== undefined && !Array.isArray(Bone.cubes))
        {
            throw new SolidError("Bone cubes must be an array");
        }

        for (const [ Index, Value ] of (Bone.cubes as Array<unknown> ?? []).entries())
        {
            const Cube = object(Value, "Cube");
            rigid(Cube, `${String(Bone.name)} cube ${Index}`);
            const Origin = triple(Cube.origin, "Cube origin");
            const Size = triple(Cube.size, "Cube size");
            const Inflation = Cube.inflate ?? Bone.inflate ?? 0;
            if (typeof Inflation !== "number" || !Number.isFinite(Inflation) || Size.some((n) => n < 0) || Size.some((n) => n + 2 * Inflation <= 0))
            {
                throw new SolidError(`Degenerate/inverted inflated cube ${String(Bone.name)}:${Index}`);
            }

            const Pivot = triple(Cube.pivot ?? Origin.map((n, i) => n + Size[i] / 2), "Cube pivot");
            const Rotation = triple(Cube.rotation ?? [ 0, 0, 0 ], "Cube rotation");
            const Vertices: Array<V.Coordinates> = Array.from({ length: 8 }, (_, i) =>
            {
                let point = Origin.map((n, axis) => n - Inflation + (((i >> axis) & 1) ? Size[axis] + 2 * Inflation : 0));
                point = rotate(point, Pivot, Rotation);
                for (const Ancestor of Chains.get(Bone)!)
                {
                    point = rotate(point, triple(Ancestor.pivot ?? [ 0, 0, 0 ], "Bone pivot"), triple(Ancestor.rotation ?? [ 0, 0, 0 ], "Bone rotation"));
                }

                return { x: point[0] / 16,
                    y: point[1] / 16,
                    z: -point[2] / 16 };
            });
            // Reflection changes winding; preserve outward normals after conversion.
            const Triangles = CubeFaces.flatMap((face, faceIndex) => [
                { indices: [ face[0], face[2], face[1] ] as const,
                    source: { object: `${String(Bone.name)}/cube ${Index}`,
                        face: faceIndex } },
                { indices: [ face[0], face[3], face[2] ] as const,
                    source: { object: `${String(Bone.name)}/cube ${Index}`,
                        face: faceIndex } }
            ]);
            Surfaces.push({ vertices: Vertices,
                triangles: Triangles });
            if (Surfaces.length > 64)
            {
                throw new SolidError("Cuboid budget exceeds 64");
            }
        }
    }

    if (!Surfaces.length && !allowEmpty)
    {
        throw new SolidError("Cuboid registration requires positive-volume cubes");
    }

    return { geometry: Geometry,
        surfaces: Surfaces };
};
