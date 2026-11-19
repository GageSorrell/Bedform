/**
 * Upstream Effect schemas for host-only project configuration and editor metadata.
 *
 * @module bedform/ConfigSchema
 *
 * @file      ConfigSchema.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Schema fields follow domain grouping and retain contextual types. */
/* eslint-disable sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import "./Internal/ConfigHostTypes.js";
import * as Schema from "effect/Schema";
import type { Collision } from "./Build/Config.js";

const Text = Schema.String.check(Schema.isMinLength(1));
const Positive = Schema.Finite.check(Schema.isGreaterThan(0));
const Vector = Schema.Struct({ x: Schema.Finite,
    y: Schema.Finite,
    z: Schema.Finite })
    .annotate({ identifier: "Vector",
        description: "Coordinates in model-local blocks or the documented physical units." });
const Pose = Schema.Struct({
    position: Vector,
    rotation: Schema.Struct({ x: Schema.Finite,
        y: Schema.Finite,
        z: Schema.Finite,
        w: Schema.Finite })
}).annotate({ identifier: "Pose",
    description: "Model-local collider transform." });
const PrimitiveKind = Schema.Literals([ "box", "sphere", "ellipsoid", "capsule" ]);
const CollisionSchema: Schema.Codec<Collision> = Schema.suspend(() => CollisionCases);
const CollisionCases = Schema.Union([
    Schema.Struct({ kind: PrimitiveKind,
        fit: Schema.Literal(true) }),
    Schema.Struct({ kind: PrimitiveKind,
        halfExtents: Vector,
        pose: Schema.optionalKey(Pose) }),
    Schema.Struct({ kind: Schema.Literal("complex") }),
    Schema.Struct({ kind: Schema.Literal("compound"),
        children: Schema.Array(CollisionSchema).check(Schema.isBetweenLength(1, 64)) })
]).annotate({ identifier: "Collision",
    description: "Enclosing fitted primitive, explicit primitive, exact partition, or compound collider." });
const Common = {
    name: Text.annotate({ description: "Unique model registration name." }),
    collision: Schema.optionalKey(CollisionSchema),
    centerOfMass: Schema.optionalKey(Vector),
    restitution: Schema.optionalKey(Schema.Finite.check(Schema.isBetween({ minimum: 0,
        maximum: 1 }))),
    gravity: Schema.optionalKey(Vector),
    linearVelocity: Schema.optionalKey(Vector),
    angularVelocity: Schema.optionalKey(Vector)
};
const Cuboid = {
    ...Common,
    representation: Schema.Literal("cuboid"),
    geometry: Text.annotate({ description: "Geometry path relative to the resource pack." }),
    geometryIdentifier: Text.annotate({ description: "Geometry identifier defined by the source asset." }),
    materials: Schema.Record(Schema.String, Text),
    textures: Schema.Record(Schema.String, Text)
};
const Particle = {
    ...Common,
    representation: Schema.Literal("particle"),
    meshSolid: Text.annotate({ description: "Evaluated mesh-solid path relative to the configuration file." }),
    rendererDescriptor: Text.annotate({ description: "Particle renderer descriptor path relative to the configuration file." })
};
const Mass = { mass: Schema.optionalKey(Positive),
    density: Schema.optionalKey(Schema.Never) };
const Density = { mass: Schema.optionalKey(Schema.Never),
    density: Positive };
const Registration = Schema.Union([
    Schema.Struct({ ...Cuboid,
        ...Mass }), Schema.Struct({ ...Cuboid,
        ...Density }),
    Schema.Struct({ ...Particle,
        ...Mass }), Schema.Struct({ ...Particle,
        ...Density })
]).annotate({ identifier: "Registration",
    description: "Rigid model registration with mutually exclusive mass or density; omitted mass defaults to one kilogram." });
const Physics = Schema.Struct({
    schemaVersion: Schema.Literal(1).annotate({ description: "Physics compiler input format version." }),
    namespace: Text.check(Schema.isPattern(/^(?!minecraft$)[a-z][a-z0-9_]*$/u)).annotate({ description: "Custom namespace for generated physics assets." }),
    behaviorPack: Text.annotate({ description: "Behavior pack root relative to the configuration file." }),
    resourcePack: Text.annotate({ description: "Resource pack root relative to the configuration file." }),
    models: Schema.Array(Registration).check(Schema.isBetweenLength(1, 128)).annotate({ description: "Models compiled into the physics overlay." })
}).annotate({ identifier: "Physics",
    description: "Existing standalone physics compiler options, nested without changing their names or path semantics." });
const DDUI = Schema.Struct({
    StrictMode: Schema.optionalKey(Schema.Boolean.annotate({ description: "Show DDUI diagnostics in forms and logs; defaults to false.",
        default: false }))
}).annotate({ identifier: "DDUI",
    description: "Functional DDUI runtime build settings." });
const Development = Schema.Struct({
    AllowDevelopmentModulesInProduction: Schema.optionalKey(Schema.Boolean.annotate({
        description: "Permit Prototype runtime modules in production builds without injecting Prototype assets or startup.",
        default: false }))
}).annotate({ identifier: "Development",
    description: "Explicit permission for development modules in ordinary production builds." });
const Image = Schema.Struct({
    Name: Text.check(Schema.isPattern(/^[A-Z][A-Za-z0-9]*$/u), Schema.isMaxLength(24))
        .annotate({ description: "Unique PascalCase key in the generated Images record, at most 24 characters." }),
    Source: Text.annotate({ description: "PNG path relative to the selected configuration file." }),
    FrameCount: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1,
        maximum: 4_096 }))
        .annotate({ description: "Equal-height frames in a vertical PNG strip; defaults to one." })),
    FrameTicks: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1,
        maximum: 2_147_483_647 }))
        .annotate({ description: "Elapsed feature ticks per frame; defaults to one, independent of particle age." }))
}).annotate({ identifier: "CanvasImage",
    description: "A static PNG or equal-frame vertical flipbook registration." });
const Canvas = Schema.Struct({
    Namespace: Text.check(Schema.isPattern(/^(?!minecraft$)[a-z][a-z0-9_]*$/u), Schema.isMaxLength(24))
        .annotate({ description: "Consumer namespace for generated image textures and particle identifiers." }),
    ResourcePack: Schema.optionalKey(Text.annotate({ description: "Destination resource pack relative to the configuration file; required when multiple packs are discovered." })),
    Images: Schema.Array(Image).check(Schema.isBetweenLength(1, 256))
        .annotate({ description: "Shared Canvas image registrations; generated/canvas/images.ts is virtual during builds." })
}).annotate({ identifier: "Canvas",
    description: "Shared image compilation for Intent, imperative surfaces and spatial React consumers." });
const Script = Schema.Struct({
    entry: Text.annotate({ description: "Source-relative script entrypoint." }),
    output: Text.annotate({ description: "Source-relative output matching a behavior-pack script module entry." })
}).annotate({ identifier: "Script",
    description: "Explicit source-to-manifest script mapping." });
const Build = Schema.Struct({
    behaviorPacks: Schema.optionalKey(Schema.Array(Text).annotate({ description: "Source-relative behavior pack directories; omitted values use conventional discovery." })),
    resourcePacks: Schema.optionalKey(Schema.Array(Text).annotate({ description: "Source-relative resource pack directories; omitted values use conventional discovery." })),
    scripts: Schema.optionalKey(Schema.Array(Script).annotate({ description: "Explicit script mappings; omitted mappings use unambiguous conventional discovery." }))
}).annotate({ identifier: "Build",
    description: "Shared add-on staging and official-tool packaging settings." });

/**
 * Source of truth for TypeScript configuration inputs; schema hints and branding are excluded.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const BedformConfigSchema = Schema.Struct({
    Canvas: Schema.optionalKey(Canvas),
    DDUI: Schema.optionalKey(DDUI),
    Development: Schema.optionalKey(Development),
    Physics: Schema.optionalKey(Physics),
    build: Schema.optionalKey(Build)
}).annotate({ description: "Bedform shared project configuration." });

/**
 * JSON configuration accepts an editor schema hint in addition to the project settings.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const BedformJsonConfigSchema = Schema.Struct({
    ...BedformConfigSchema.fields,
    $schema: Schema.optionalKey(Text.annotate({ description: "Published JSON Schema URL used by editors." }))
}).annotate({ description: "Bedform shared project configuration." });
