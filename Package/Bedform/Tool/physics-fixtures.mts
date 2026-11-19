/**
 * Reproducible cuboid and closed-mesh benchmark sources shared by host and BDS.
 *
 * @module bedform/Tool/physics-fixtures
 *
 * @file      physics-fixtures.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture coordinates and authored JSON retain contextual ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { performance } from "node:perf_hooks";
import { compile, fingerprint, meshSolid, type Compilation } from "../Source/Build/Physics.js";
import { partition, type Surface } from "../Source/Build/Solid.js";

/**
 * Validated 16-pixel orientation texture with four colored quadrants.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const FixtureTexture = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVR4AaXBQRGAMADAsNJDyOYE50jZoWQ42KfJtZ+xOZjvw4lEEkkkkUQSSXTPsThZ3+REIokkkkgiiST6ASXYBqHKv7zzAAAAAElFTkSuQmCC", "base64");

/**
 * Actual source/decomposition counts and separately timed compilation stages.
 *
 * @category Types
 * @since 1.0.0
 */
export interface MeshMeasurement
{
    readonly name: string;
    readonly vertices: number;
    readonly triangles: number;
    readonly cells: number;
    readonly validationMs: number;
    readonly decompositionMs: number;
    readonly compileMs: number;
    readonly volume: number;
}

/**
 * Real generated catalog/pack assets and their measured closed-solid sources.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Fixtures
{
    readonly compilation: Compilation;
    readonly meshes: ReadonlyArray<MeshMeasurement>;
    readonly complexAuthoredCubes: 32;
}

/**
 * Welds only the exterior boundary of an integer voxel union. Cavity faces are
 * oriented into their void; disconnected components remain separate shells.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const surface = (voxels: ReadonlyArray<readonly [
    number,
    number,
    number
]>): Surface =>
{
    const Occupied = new Set(voxels.map((voxel) => voxel.join(",")));
    const Vertices: Array<Surface["vertices"][number]> = [];
    const Indices = new Map<string, number>();
    const Triangles: Array<Surface["triangles"][number]> = [];
    const Corners = Array.from({ length: 8 }, (_, i) => [ i & 1 ? 1 : 0, i & 2 ? 1 : 0, i & 4 ? 1 : 0 ]);
    const Faces = [ [ 0, 4, 6, 2 ], [ 1, 3, 7, 5 ], [ 0, 1, 5, 4 ], [ 2, 6, 7, 3 ], [ 0, 2, 3, 1 ], [ 4, 5, 7, 6 ] ];
    const Neighbors = [ [ -1, 0, 0 ], [ 1, 0, 0 ], [ 0, -1, 0 ], [ 0, 1, 0 ], [ 0, 0, -1 ], [ 0, 0, 1 ] ];
    for (const Voxel of voxels)
    {
        Faces.forEach((face, index) =>
        {
            if (Occupied.has(Voxel.map((value, axis) => value + Neighbors[index][axis]).join(",")))
            {
                return;
            }

            const Polygon = face.map((corner) =>
            {
                const Position = Voxel.map((value, axis) => value + Corners[corner][axis]);
                const Key = Position.join(",");
                let id = Indices.get(Key);
                if (id === undefined)
                {
                    id = Vertices.length;
                    Indices.set(Key, id);
                    Vertices.push({ x: Position[0] / 4,
                        y: Position[1] / 4,
                        z: Position[2] / 4 });
                }

                return id;
            });
            for (const Triangle of [ [ Polygon[0], Polygon[1], Polygon[2] ], [ Polygon[0], Polygon[2], Polygon[3] ] ])
            {
                Triangles.push({ indices: Triangle as [
                    number,
                    number,
                    number
                ],
                source: { object: `voxel_${Voxel.join("_")}`,
                    face: index } });
            }
        });
    }

    return { vertices: Vertices,
        triangles: Triangles };
};

/**
 * Generates four primitive fits, a concave 32-authored-cube collider and four
 * representative mesh solids. All registered colliders come from the real compiler.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const createFixtures = async (root: string, behaviorPack: string, resourcePack: string, client = false): Promise<Fixtures> =>
{
    await Fs.mkdir(resourcePack, { recursive: true });
    await Fs.mkdir(behaviorPack, { recursive: true });
    await Fs.writeFile(Path.join(resourcePack, "fixture.png"), FixtureTexture);
    const Cubes = [];
    for (let x = 0; x < 4; x++)
    {
        for (let y = 0; y < 3; y++)
        {
            for (let z = 0; z < 4; z++)
            {
                if (y < 2 ? x === 0 || x === 3 || z === 0 || z === 3 : x === 0 || x === 3)
                {
                    Cubes.push({ origin: [ x * 4 - 8, y * 4 - 6, z * 4 - 8 ],
                        size: [ 4, 4, 4 ] });
                }
            }
        }
    }

    if (Cubes.length !== 32)
    {
        throw new Error("Complex fixture must contain exactly 32 authored cuboids");
    }

    await Fs.writeFile(Path.join(resourcePack, "benchmark.geo.json"), JSON.stringify({ "minecraft:geometry": [
        { description: { identifier: "geometry.benchmark.primitive",
            ...(client ? { texture_width: 16,
                texture_height: 16 } : {}) },
        bones: [ { name: "root",
            cubes: [ { origin: [ -8, -8, -8 ],
                size: [ 16, 16, 16 ] } ] } ] },
        { description: { identifier: "geometry.benchmark.complex",
            ...(client ? { texture_width: 16,
                texture_height: 16 } : {}) },
        bones: [ { name: "root",
            cubes: Cubes } ] }
    ] }));
    const Base = { schemaVersion: 1,
        namespace: "bedform_fixture",
        resourcePack,
        behaviorPack };
    const Visual = { representation: "cuboid",
        geometry: "benchmark.geo.json",
        textures: { default: "fixture" },
        materials: { default: "entity_alphatest" } };
    const Models: Array<unknown> = [ "box", "sphere", "capsule", "ellipsoid" ].map((kind) => ({ ...Visual,
        name: kind,
        geometryIdentifier: "geometry.benchmark.primitive",
        collision: { kind,
            fit: true } }));
    Models.push({ ...Visual,
        name: "complex",
        geometryIdentifier: "geometry.benchmark.complex",
        collision: { kind: "complex" } });
    if (client)
    {
        await Fs.writeFile(Path.join(resourcePack, "platform.geo.json"), JSON.stringify({ "minecraft:geometry": [ { description: { identifier: "geometry.benchmark.platform",
            texture_width: 16,
            texture_height: 16 },
        bones: [ { name: "root",
            cubes: [ { origin: [ -32, -2, -32 ],
                size: [ 64, 4, 64 ] } ] } ] } ] }));
        Models.push({ ...Visual,
            name: "platform",
            geometry: "platform.geo.json",
            geometryIdentifier: "geometry.benchmark.platform",
            collision: { kind: "box",
                fit: true } });
        // Client fixtures need explicit UVs and bounds that cover a rebased root.
        // The benchmark's physical geometry and source counts remain unchanged.
        for (const File of [ "benchmark.geo.json", "platform.geo.json" ])
        {
            const Geometry = JSON.parse(await Fs.readFile(Path.join(resourcePack, File), "utf8"));
            for (const Model of Geometry["minecraft:geometry"])
            {
                Object.assign(Model.description, { visible_bounds_width: 32,
                    visible_bounds_height: 16,
                    visible_bounds_offset: [ 0, 2, 0 ] });
                for (const Bone of Model.bones)
                {
                    for (const Cube of Bone.cubes ?? [])
                    {Cube.uv = [ 0, 0 ];}
                }
            }

            await Fs.writeFile(Path.join(resourcePack, File), JSON.stringify(Geometry));
        }
    }

    await Fs.writeFile(Path.join(root, "benchmark-anchor.json"), JSON.stringify({ "minecraft:geometry": [ { description: { identifier: "geometry.benchmark.anchor" },
        bones: [] } ] }));
    await Fs.writeFile(Path.join(root, "benchmark-renderer.json"), JSON.stringify({ schemaVersion: 1,
        identifier: "bedform_fixture:benchmark_renderer",
        geometry: "benchmark-anchor.json",
        geometryIdentifier: "geometry.benchmark.anchor",
        assets: [ "benchmark-anchor.json" ] }));
    const Cavity: Array<readonly [
        number,
        number,
        number
    ]> = [];
    for (let x = 0; x < 4; x++)
    {
        for (let y = 0; y < 4; y++)
        {
            for (let z = 0; z < 4; z++)
            {
                if (x === 0 || x === 3 || y === 0 || y === 3 || z === 0 || z === 3)
                {
                    Cavity.push([ x, y, z ]);
                }
            }
        }
    }

    const Sources = [ [ "mesh_cube", [ [ 0, 0, 0 ] ] ], [ "mesh_concave", [ [ 0, 0, 0 ], [ 1, 0, 0 ], [ 0, 1, 0 ] ] ],
        [ "mesh_cavity", Cavity ], [ "mesh_disconnected", [ [ 0, 0, 0 ], [ 2, 0, 0 ] ] ] ] as const;
    const Measurements: Array<MeshMeasurement> = [];
    for (const [ Name, Voxels ] of Sources)
    {
        const Boundary = surface(Voxels);
        const Solid = { schemaVersion: 1,
            coordinates: "minecraft",
            metresPerUnit: 1,
            ...Boundary };
        const Document = { ...Solid,
            fingerprint: fingerprint(Solid) };
        await Fs.writeFile(Path.join(root, `${Name}.json`), JSON.stringify(Document));
        const ValidationStart = performance.now();
        const Validated = meshSolid(Document);
        const ValidationMs = performance.now() - ValidationStart;
        const PartitionStart = performance.now();
        const Partition = partition([ Validated ], true);
        const DecompositionMs = performance.now() - PartitionStart;
        const Registration = { name: Name,
            representation: "particle",
            meshSolid: `${Name}.json`,
            rendererDescriptor: "benchmark-renderer.json",
            collision: { kind: "complex" } };
        const Single = Path.join(root, `${Name}.config.json`);
        await Fs.writeFile(Single, JSON.stringify({ ...Base,
            models: [ Registration ] }));
        const CompileStart = performance.now();
        const Compiled = await compile(Single);
        const CompileMs = performance.now() - CompileStart;
        Measurements.push({ name: Name,
            vertices: Boundary.vertices.length,
            triangles: Boundary.triangles.length,
            cells: Partition.cells.length,
            validationMs: ValidationMs,
            decompositionMs: DecompositionMs,
            compileMs: CompileMs,
            volume: Compiled.models[0].physical.volume });
        Models.push(Registration);
    }

    const Config = Path.join(root, "benchmark.config.json");
    await Fs.writeFile(Config, JSON.stringify({ ...Base,
        models: Models }));
    const Compilation = await compile(Config);
    await Fs.writeFile(Path.join(root, "mesh-compilation.json"), JSON.stringify(Measurements, null, 2));
    return { compilation: Compilation,
        meshes: Measurements,
        complexAuthoredCubes: 32 };
};
