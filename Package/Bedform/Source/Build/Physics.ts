/**
 * Host-only physics model compilation, deterministic catalogs and owned overlays.
 *
 * @module bedform/Build/Physics
 *
 * @file      Physics.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host geometry/packet expressions keep mathematical ordering and contextual types. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Host JSON validation and geometric assembly retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef */

import { createHash } from "node:crypto";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import * as B from "../AABB.js";
import * as C from "../CollisionShape.js";
import * as H from "../ConvexHull.js";
import type * as M from "../PhysicsModel.js";
import * as O from "@bedform/effect/Option";
import * as Q from "../Quat.js";
import * as R from "@bedform/effect/Result";
import * as T from "../Transform.js";
import * as V from "../Vector3.js";
import { type JsonObject, cuboids, object } from "./Geometry.js";
import { SolidError, type Surface, massProperties, partition } from "./Solid.js";
import { visual } from "./Visual.js";

/**
 * In-memory build output; no filesystem writes occur until all models compile.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Compilation
{
    readonly models: ReadonlyArray<M.Model>;
    readonly files: Readonly<Record<string, string>>;
}

/**
 * Canonical object-key ordering shared with the later mesh-solid exporter.
 *
 * @category Build
 * @since 1.0.0
 */
export const canonical = (value: unknown): string =>
{
    if (Array.isArray(value))
    {
        return `[${value.map(canonical).join(",")}]`;
    }

    if (value && typeof value === "object")
    {
        return `{${Object.entries(value).filter(([ , v ]) => v !== undefined).sort(([ a ], [ b ]) => a.localeCompare(b, "en")).map(([ k, v ]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
    }

    return JSON.stringify(value);
};

/**
 * SHA-256 fingerprint of canonical JSON or asset bytes, never modification times.
 *
 * @category Build
 * @since 1.0.0
 */
export const fingerprint = (value: unknown): string =>
{
    return createHash("sha256").update(canonical(value)).digest("hex");
};

/**
 * Validates text fields at the configuration boundary.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
const text = (value: unknown, label: string): string =>
{
    if (typeof value !== "string" || !value.length)
    {
        throw new SolidError(`${label} must be a nonempty string`);
    }

    return value;
};

/**
 * Reads JSON without transforming or modifying source files.
 *
 * @category Build
 * @since 1.0.0
 */
const json = async (file: string): Promise<unknown> =>
{
    return JSON.parse(await Fs.readFile(file, "utf8")) as unknown;
};

/**
 * Checks coordinate objects without coercion or caller mutation.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
const vector = (input: unknown, label: string): V.Vector3 =>
{
    const P = object(input, label);
    if (![ P.x, P.y, P.z ].every((n) => typeof n === "number" && Number.isFinite(n)))
    {
        throw new SolidError(`Invalid ${label}`);
    }

    return V.Vector3Unsafe(P.x as number, P.y as number, P.z as number);
};

/**
 * Validates version/provenance/fingerprint and converts evaluated physical geometry once.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const meshSolid = (input: unknown): Surface =>
{
    const Data = object(input, "Mesh solid");
    if ("poly_mesh" in Data)
    {
        throw new SolidError("poly_mesh is unsupported; export evaluated mesh-solid triangles");
    }

    if (Data.schemaVersion !== 1 || ![ "blender", "minecraft" ].includes(String(Data.coordinates)) ||
        typeof Data.metresPerUnit !== "number" || !Number.isFinite(Data.metresPerUnit) || Data.metresPerUnit <= 0 ||
        !Array.isArray(Data.vertices) || !Array.isArray(Data.triangles))
    {
        throw new SolidError("Unsupported mesh-solid version, coordinates, units or topology");
    }

    const { fingerprint: Hash, ...Physical } = Data;
    if (typeof Hash !== "string" || Hash !== fingerprint(Physical))
    {
        throw new SolidError("Mesh-solid fingerprint mismatch");
    }

    const Scale = Data.metresPerUnit;
    const Vertices = Data.vertices.map((p) =>
    {
        const V = vector(p, "Mesh vertex");
        return Data.coordinates === "blender" ? { x: V.x * Scale,
            y: V.z * Scale,
            z: -V.y * Scale } :
            { x: V.x * Scale,
                y: V.y * Scale,
                z: V.z * Scale };
    });
    const Triangles = Data.triangles.map((t) =>
    {
        const Triangle = object(t, "Mesh triangle");
        const Provenance = object(Triangle.source, "Triangle source");
        if (!Array.isArray(Triangle.indices) || Triangle.indices.length !== 3 ||
            !Number.isSafeInteger(Provenance.face) || (Provenance.face as number) < 0)
        {
            throw new SolidError("Invalid triangle indices or source face");
        }

        return { indices: [ ...Triangle.indices ] as [number, number, number],
            source: { object: text(Provenance.object, "Source object"),
                face: Provenance.face as number } };
    });
    return { vertices: Vertices,
        triangles: Triangles };
};

/**
 * Validates collider choices; fitted primitives enclose the source bounds deterministically.
 * Explicit colliders never replace source-solid mass properties.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
const collision = (input: unknown, bounds: B.AABB, cells: ReadonlyArray<C.CollisionShape.Cell>, depth = 0): C.CollisionShape =>
{
    if (depth > 8)
    {
        throw new SolidError("Compound nesting exceeds 8");
    }

    const Config = input === undefined ? { kind: "box",
        fit: true } : object(input, "Collision");
    if (Config.kind === "complex")
    {
        return Object.freeze({ kind: "complex",
            cells });
    }

    if (Config.kind === "compound")
    {
        if (!Array.isArray(Config.children) || !Config.children.length || Config.children.length > 64)
        {
            throw new SolidError("Compound requires 1..64 children");
        }

        return Object.freeze({ kind: "compound",
            children: Object.freeze(Config.children.map((c) => collision(c, bounds, cells, depth + 1))) });
    }

    if (![ "box", "sphere", "ellipsoid", "capsule" ].includes(String(Config.kind)))
    {
        throw new SolidError("Unknown collision kind");
    }

    const Half = V.Vector3Unsafe((bounds.max.x - bounds.min.x) / 2, (bounds.max.y - bounds.min.y) / 2, (bounds.max.z - bounds.min.z) / 2);
    const Center = V.Vector3Unsafe((bounds.max.x + bounds.min.x) / 2, (bounds.max.y + bounds.min.y) / 2, (bounds.max.z + bounds.min.z) / 2);
    let dimensions: V.Coordinates;
    let pose: T.Coordinates;
    if (Config.fit === true)
    {
        const Radius = Math.hypot(Half.x, Half.y, Half.z);
        dimensions = Config.kind === "sphere" ? { x: Radius,
            y: Radius,
            z: Radius } :
            Config.kind === "ellipsoid" ? { x: Half.x * Math.sqrt(3),
                y: Half.y * Math.sqrt(3),
                z: Half.z * Math.sqrt(3) } :
                Config.kind === "capsule" ? { x: Math.hypot(Half.x, Half.z),
                    y: Half.y,
                    z: Math.hypot(Half.x, Half.z) } : Half;
        pose = T.TransformUnsafe(Center, Q.Identity);
        if (Config.pose !== undefined || Config.halfExtents !== undefined)
        {
            throw new SolidError("Fit cannot be combined with explicit dimensions/pose");
        }
    }
    else
    {
        dimensions = vector(Config.halfExtents, "Primitive halfExtents");
        const P = Config.pose === undefined ? T.Identity : object(Config.pose, "Collider pose");
        const Rotation = object(P.rotation, "Collider rotation");
        if (![ Rotation.x, Rotation.y, Rotation.z, Rotation.w ].every((n) => typeof n === "number" && Number.isFinite(n)))
        {
            throw new SolidError("Invalid collider quaternion");
        }

        const Orientation = Q.Quat(Rotation.x as number, Rotation.y as number, Rotation.z as number, Rotation.w as number);
        if (O.isNone(Orientation))
        {
            throw new SolidError("Zero collider quaternion");
        }

        pose = T.TransformUnsafe(vector(P.position, "Collider position"), Orientation.value);
    }

    const Result = C.primitive(Config.kind as C.CollisionShape.Primitive["kind"], dimensions, pose);
    if (R.isFailure(Result))
    {
        throw new SolidError(Result.failure.message);
    }

    return Result.success;
};

/**
 * Serializes pure protocol values into executable, deeply immutable catalog expressions.
 *
 * @category Build
 * @since 1.0.0
 */
const expression = (value: unknown): string =>
{
    if (H.isConvexHull(value))
    {
        return `H.ConvexHullUnsafe(${expression(value.vertices)},${expression(value.faces)})`;
    }

    if (B.isAABB(value))
    {
        return `B.AABBUnsafe(${expression(value.min)},${expression(value.max)})`;
    }

    if (T.isTransform(value))
    {
        return `T.TransformUnsafe(${expression(value.position)},${expression(value.rotation)})`;
    }

    if (Q.isQuat(value))
    {
        return `Q.QuatUnsafe(${value.x},${value.y},${value.z},${value.w})`;
    }

    if (V.isVector3(value))
    {
        return `V.Vector3Unsafe(${value.x},${value.y},${value.z})`;
    }

    if (Array.isArray(value))
    {
        return `Object.freeze([${value.map(expression).join(",")}] as const)`;
    }

    if (value && typeof value === "object")
    {
        return `Object.freeze({${Object.entries(value).filter(([ , v ]) => v !== undefined).map(([ k, v ]) => `${JSON.stringify(k)}:${expression(v)}`).join(",")}})`;
    }

    return JSON.stringify(value);
};

/**
 * Compiles every registration before publication. Pack roots locate authored inputs;
 * output contains overlays only and never mutates either authored pack.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const compile = async (configFile: string): Promise<Compilation> =>
{
    return compileConfig(await json(configFile), Path.dirname(Path.resolve(configFile)));
};

/**
 * Compiles an in-memory physics section using the selected configuration directory.
 * Absolute fields from the shared loader and legacy relative fields share the same compiler.
 * No authored files or generated assets are written by this operation.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const compileConfig = async (input: unknown, directory: string): Promise<Compilation> =>
{
    const Config = object(input, "Build configuration");
    if (Config.schemaVersion !== 1)
    {
        throw new SolidError("Expected physics build schemaVersion 1");
    }

    const Namespace = text(Config.namespace, "Namespace");
    if (!/^[a-z][a-z0-9_]*$/u.test(Namespace) || Namespace === "minecraft")
    {
        throw new SolidError("Invalid custom namespace");
    }

    const Base = Path.resolve(directory);
    const ResourcePack = Path.resolve(Base, text(Config.resourcePack, "Resource pack root"));
    const BehaviorPack = Path.resolve(Base, text(Config.behaviorPack, "Behavior pack root"));
    for (const Root of [ ResourcePack, BehaviorPack ])
    {
        if (!(await Fs.stat(Root)).isDirectory())
        {
            throw new SolidError(`Pack root is not a directory: ${Root}`);
        }
    }

    if (!Array.isArray(Config.models) || !Config.models.length || Config.models.length > 128)
    {
        throw new SolidError("Models must contain 1..128 registrations");
    }

    const Files: Record<string, string> = {};
    const Models: Array<M.Model> = [];
    const Names = new Set<string>();
    const Put = (path: string, value: unknown): void =>
    {
        Files[path] = `${JSON.stringify(value, null, 2)}\n`;
    };

    for (const Input of Config.models)
    {
        const Registration = object(Input, "Model registration");
        const Name = text(Registration.name, "Model name");
        if (!/^[a-z][a-z0-9_]*$/u.test(Name) || Names.has(Name) || [ "support", "physics_support", "bedform_invisible" ].includes(Name))
        {
            throw new SolidError(`Invalid or duplicate model name ${Name}`);
        }

        Names.add(Name);
        const Identifier = `${Namespace}:physics_${Name}`;
        const Representation = Registration.representation;
        let surfaces: ReadonlyArray<Surface>;
        let geometry: JsonObject;
        let physicalSource: unknown;
        let renderer: string | undefined;
        const CompatibleAssets: Record<string, string> = {};
        if (Representation === "cuboid")
        {
            const GeometryPath = Path.resolve(ResourcePack, text(Registration.geometry, "Geometry path"));
            physicalSource = await json(GeometryPath);
            const Result = cuboids(physicalSource, text(Registration.geometryIdentifier, "Geometry identifier"));
            geometry = Result.geometry;
            surfaces = Result.surfaces;
            if (!Registration.textures || !Registration.materials)
            {
                throw new SolidError("Cuboid textures and materials are required");
            }

            const Textures = object(Registration.textures, "Textures");
            const Materials = object(Registration.materials, "Materials");
            for (const Entries of [ Textures, Materials ])
            {
                if (!Object.keys(Entries).length || typeof Entries.default !== "string")
                {
                    throw new SolidError("Texture/material maps require a default entry");
                }

                for (const [ Key, Value ] of Object.entries(Entries))
                {
                    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/u.test(Key) || typeof Value !== "string" || !Value.length)
                    {
                        throw new SolidError("Invalid texture/material alias or asset reference");
                    }
                }
            }

            for (const Asset of Object.values(Textures))
            {
                const Relative = `${text(Asset, "Texture")}.png`;
                const Bytes = await Fs.readFile(Path.resolve(ResourcePack, Relative));
                CompatibleAssets[Relative] = createHash("sha256").update(Bytes).digest("hex");
            }
        }
        else if (Representation === "particle")
        {
            physicalSource = await json(Path.resolve(Base, text(Registration.meshSolid, "Mesh solid path")));
            surfaces = [ meshSolid(physicalSource) ];
            const DescriptorFile = Path.resolve(Base, text(Registration.rendererDescriptor, "Particle descriptor path"));
            const Descriptor = object(await json(DescriptorFile), "Particle descriptor");
            if (Descriptor.schemaVersion !== 1)
            {
                throw new SolidError("Unsupported particle descriptor version");
            }

            renderer = text(Descriptor.identifier, "Renderer identifier");
            const Anchor = await json(Path.resolve(Path.dirname(DescriptorFile), text(Descriptor.geometry, "Anchor geometry")));
            geometry = cuboids(Anchor, text(Descriptor.geometryIdentifier, "Anchor geometry identifier"), true).geometry;
            if (!Array.isArray(Descriptor.assets))
            {
                throw new SolidError("Renderer descriptor must enumerate compatible assets");
            }

            CompatibleAssets.descriptor = fingerprint(Descriptor);
            for (const Asset of Descriptor.assets)
            {
                const Relative = text(Asset, "Renderer asset");
                CompatibleAssets[Relative] = createHash("sha256").update(await Fs.readFile(Path.resolve(Path.dirname(DescriptorFile), Relative))).digest("hex");
            }
        }
        else
        {
            throw new SolidError("Representation must be cuboid or particle");
        }

        const Result = partition(surfaces, Representation === "particle");
        const Unit = massProperties(Result.cells, 1);
        if (Representation === "particle")
        {
            const Signed = massProperties([ { hull: H.ConvexHullUnsafe(surfaces[0].vertices, surfaces[0].triangles.map((t) => t.indices)),
                internalFaces: [],
                sources: [] } ], 1);
            if (Math.abs(Signed.volume - Unit.volume) > Signed.volume * 1e-7)
            {
                throw new SolidError("Partition volume differs from source solid beyond 1e-7; simplify source");
            }
        }

        if ((Registration.mass !== undefined && (typeof Registration.mass !== "number" || !Number.isFinite(Registration.mass) || Registration.mass <= 0)) ||
            (Registration.density !== undefined && (typeof Registration.density !== "number" || !Number.isFinite(Registration.density) || Registration.density <= 0)))
        {
            throw new SolidError("Mass/density must be positive finite numbers");
        }

        if (Registration.mass !== undefined && Registration.density !== undefined)
        {
            throw new SolidError("Mass and density are mutually exclusive");
        }

        const Mass = Registration.mass ?? (Registration.density === undefined ? 1 : (Registration.density as number) * Unit.volume);
        if (typeof Mass !== "number" || !Number.isFinite(Mass) || Mass <= 0 ||
            (Registration.density !== undefined && (typeof Registration.density !== "number" || Registration.density <= 0)))
        {
            throw new SolidError("Mass/density must be positive finite numbers");
        }

        const Physical = massProperties(Result.cells, Mass, Registration.centerOfMass === undefined ? undefined : vector(Registration.centerOfMass, "COM"));
        const Bounds = O.getOrThrow(B.fromPoints(Result.cells.flatMap((c) => [ ...c.hull.vertices ])));
        const Restitution = Registration.restitution === undefined ? 0 : Registration.restitution;
        if (typeof Restitution !== "number" || !Number.isFinite(Restitution) || Restitution < 0 || Restitution > 1)
        {
            throw new SolidError("Restitution must be in [0,1]");
        }

        const SelectedCollision = collision(Registration.collision, Bounds, Result.cells);
        const GeneratedVisual = visual(geometry, Identifier);
        const Model = Object.freeze({ schemaVersion: 1 as const,
            name: Name,
            identifier: Identifier,
            representation: Representation,
            fingerprint: fingerprint({ physicalSource,
                registration: Registration,
                compatibleAssets: CompatibleAssets,
                visual: GeneratedVisual }),
            renderer,
            sourceGeometry: Object.freeze(surfaces.map((s) => Object.freeze({
                vertices: Object.freeze(s.vertices.map((v) => V.Vector3Unsafe(v.x, v.y, v.z))),
                triangles: Object.freeze(s.triangles.map((t) => Object.freeze({
                    indices: Object.freeze([ ...t.indices ]) as readonly [number, number, number],
                    source: Object.freeze({...t.source})
                })))
            }))),
            gravity: Registration.gravity === undefined ? undefined : vector(Registration.gravity, "Gravity"),
            linearVelocity: Registration.linearVelocity === undefined ? V.Zero : vector(Registration.linearVelocity, "COM linear velocity"),
            angularVelocity: Registration.angularVelocity === undefined ? V.Zero : vector(Registration.angularVelocity, "Angular velocity"),
            bounds: Bounds,
            sourceCells: Result.cells,
            collision: SelectedCollision,
            physical: Physical,
            restitution: Restitution });
        Models.push(Model);
        Put(`resource_pack/models/entity/${Name}.geo.json`, { format_version: "1.12.0",
            "minecraft:geometry": [ GeneratedVisual.geometry ] });
        Put(`resource_pack/animations/${Name}.animation.json`, GeneratedVisual.animation);
        const AnimationId = `animation.${Identifier.replace(":", ".")}.pose`;
        Put(`catalog/${Name}.renderer.json`, { schemaVersion: 1,
            identifier: Identifier,
            renderer,
            root: GeneratedVisual.root,
            fingerprint: Model.fingerprint,
            geometry: GeneratedVisual.geometry.description,
            properties: GeneratedVisual.properties,
            scripts: GeneratedVisual.scripts,
            animation: AnimationId,
            duration: 0.05,
            tolerance: Result.tolerance });
        const OwnerGeometry = Representation === "particle" ? `geometry.${Namespace}.physics_invisible` :
            object(GeneratedVisual.geometry.description, "Generated description").identifier;
        const ControllerId = `controller.render.${Namespace}.physics_${Name}`;
        const TextureMap = object(Registration.textures ?? { default: "textures/blocks/glass" }, "Textures");
        const MaterialMap = object(Registration.materials ?? { default: "entity_alphatest" }, "Materials");
        Put(`resource_pack/render_controllers/${Name}.render_controllers.json`, { format_version: "1.8.0",
            render_controllers:
            { [ControllerId]: { geometry: "Geometry.default",
                materials: Object.keys(MaterialMap).map((key) => ({ [key === "default" ? "*" : key]: `Material.${key}` })),
                textures: Object.keys(TextureMap).map((key) => `Texture.${key}`) } } });
        Put(`resource_pack/entity/${Name}.entity.json`, { format_version: "1.10.0",
            "minecraft:client_entity": { description:
            { identifier: Identifier,
                materials: Registration.materials ?? { default: "entity_alphatest" },
                textures: Registration.textures ?? { default: "textures/blocks/glass" },
                geometry: { default: OwnerGeometry },
                render_controllers: [ ControllerId ],
                animations: { bedform_pose: AnimationId },
                scripts: Representation === "cuboid" ? GeneratedVisual.scripts : {} } } });
        Put(`behavior_pack/entities/${Name}.json`, { format_version: "1.21.0",
            "minecraft:entity": {
                description: { identifier: Identifier,
                    is_spawnable: false,
                    is_summonable: true,
                    properties: GeneratedVisual.properties },
                components: { "minecraft:physics": { has_gravity: false,
                    has_collision: false },
                "minecraft:collision_box": { width: 0,
                    height: 0 },
                "minecraft:persistent": {},
                "minecraft:pushable": { is_pushable: false,
                    is_pushable_by_piston: false },
                "minecraft:movement": { value: 0 } } } });
    }

    Put("resource_pack/render_controllers/physics.render_controllers.json", { format_version: "1.8.0",
        render_controllers:
        { "controller.render.bedform_physics": { geometry: "Geometry.default",
            materials: [ { "*": "Material.default" } ],
            textures: [ "Texture.default" ] } } });
    Put("resource_pack/models/entity/bedform_invisible.geo.json", { format_version: "1.12.0",
        "minecraft:geometry": [
            { description: { identifier: `geometry.${Namespace}.physics_invisible`,
                texture_width: 1,
                texture_height: 1 },
            bones: [ { name: "root",
                pivot: [ 0, 0, 0 ] } ] } ] });
    // A support helper is separate from both the persistent owner and renderer anchor.
    Put("behavior_pack/entities/physics_support.json", { format_version: "1.21.0",
        "minecraft:entity": {
            description: { identifier: `${Namespace}:physics_support`,
                is_spawnable: false,
                is_summonable: true },
            components:
            { "minecraft:physics": { has_gravity: false },
                "minecraft:collision_box": { width: 0.125,
                    height: 0.125 },
                "minecraft:is_collidable": {},
                "minecraft:pushable": { is_pushable: false,
                    is_pushable_by_piston: false },
                "minecraft:movement": { value: 0 } } } });
    Put("resource_pack/entity/physics_support.entity.json", { format_version: "1.10.0",
        "minecraft:client_entity": { description:
        { identifier: `${Namespace}:physics_support`,
            materials: { default: "entity_alphatest" },
            textures: { default: "textures/blocks/glass" },
            geometry: { default: `geometry.${Namespace}.physics_invisible` },
            render_controllers: [ "controller.render.bedform_physics" ] } } });
    Files["catalog/models.ts"] = "/**\n * Generated immutable physics model catalog.\n *\n * @file models.ts\n * @category Catalog\n * @since 1.0.0\n */\n" +
        "import * as B from \"bedform/AABB\";\nimport * as H from \"bedform/ConvexHull\";\nimport * as Q from \"bedform/Quat\";\nimport * as T from \"bedform/Transform\";\nimport * as V from \"bedform/Vector3\";\nimport type { Model } from \"bedform/PhysicsModel\";\n" +
        "/**\n * Compiled source solids and renderer-compatible fingerprints.\n *\n * @category Catalog\n * @since 1.0.0\n */\n" +
        `export const Models = ${expression(Object.fromEntries(Models.map((m) => [ m.name, m ])))} satisfies Readonly<Record<string, Model>>;\n`;
    Put("catalog/models.json", Models);
    return Object.freeze({ models: Object.freeze(Models),
        files: Object.freeze(Files) });
};

/**
 * Rejects traversal, authored-file replacement and symlink escapes before publication.
 * Files are owned only when the prior manifest records their matching content hash.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const publish = async (compilation: Compilation, output: string): Promise<void> =>
{
    const Root = Path.resolve(output);
    const ManifestPath = Path.join(Root, ".bedform-physics.json");
    await Fs.mkdir(Root, { recursive: true });
    const RootInfo = await Fs.lstat(Root);
    if (RootInfo.isSymbolicLink())
    {
        throw new SolidError("Output root cannot be a symlink");
    }

    let prior: Record<string, string> = {};
    try
    {
        if ((await Fs.lstat(ManifestPath)).isSymbolicLink())
        {
            throw new SolidError("Owned manifest cannot be a symlink");
        }

        const Manifest = object(await json(ManifestPath), "Owned manifest");
        if (Manifest.schemaVersion !== 1)
        {
            throw new SolidError("Unknown owned manifest version");
        }

        prior = object(Manifest.files, "Owned files") as Record<string, string>;
    }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        {
            throw error;
        }
    }

    const CheckPath = async (relative: string): Promise<string> =>
    {
        if (!/^(?:behavior_pack|resource_pack|catalog)\/[a-zA-Z0-9_./-]+$/u.test(relative) || relative.split("/").some((p) => !p || p === "." || p === ".."))
        {
            throw new SolidError(`Unsafe generated path ${relative}`);
        }

        const Destination = Path.resolve(Root, relative);
        if (!Destination.startsWith(`${Root}${Path.sep}`))
        {
            throw new SolidError("Generated path escapes output root");
        }

        let current = Root;
        for (const Component of relative.split("/"))
        {
            current = Path.join(current, Component);
            try
            {
                if ((await Fs.lstat(current)).isSymbolicLink())
                {
                    throw new SolidError(`Symlink in output path ${relative}`);
                }
            }
            catch (error)
            {
                if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                {
                    throw error;
                }
            }
        }

        return Destination;
    };

    for (const Relative of new Set([ ...Object.keys(prior), ...Object.keys(compilation.files) ]))
    {
        const Destination = await CheckPath(Relative);
        try
        {
            const Existing = await Fs.readFile(Destination, "utf8");
            if (!prior[Relative] || fingerprint(Existing) !== prior[Relative])
            {
                throw new SolidError(`Refusing to replace/delete unowned or edited file ${Relative}`);
            }
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            {
                throw error;
            }
        }
    }

    for (const [ Relative, Contents ] of Object.entries(compilation.files))
    {
        const Destination = await CheckPath(Relative);
        await Fs.mkdir(Path.dirname(Destination), { recursive: true });
        const Temporary = `${Destination}.bedform-tmp`;
        await Fs.writeFile(Temporary, Contents, { flag: "wx" });
        try
        {
            await Fs.rename(Temporary, Destination);
        }
        finally
        {
            await Fs.rm(Temporary, { force: true });
        }
    }

    for (const Relative of Object.keys(prior))
    {
        if (!(Relative in compilation.files))
        {
            await Fs.rm(await CheckPath(Relative), { force: true });
        }
    }

    await Fs.writeFile(ManifestPath, `${JSON.stringify({ schemaVersion: 1,
        files:
        Object.fromEntries(Object.entries(compilation.files).map(([ path, contents ]) => [ path, fingerprint(contents) ])) }, null, 2)}\n`);
};

/**
 * Host build registration types with exclusive mass/density defaults.
 *
 * @category Types
 * @since 1.0.0
 */
export type { Config, Registration, Collision, PhysicalDefaults } from "./Config.js";

/**
 * Typed host diagnostics and explicit compilation budgets.
 *
 * @category Exports
 * @since 1.0.0
 */
export { Limits, SolidError } from "./Solid.js";
