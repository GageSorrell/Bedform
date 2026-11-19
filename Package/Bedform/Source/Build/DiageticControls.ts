/**
 * Shared Diagetic control content: behavior and client entities, geometry, animations, render
 * controllers and localization for the lever, slider and wheel models.
 *
 * @module bedform/Build/DiageticControls
 *
 * @file      DiageticControls.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Bedrock content keys preserve authored ordering. */
/* eslint-disable sort-keys */

import { EntityEvent, EntityProperty, PoseProperty, PoseRange, ReleaseTarget } from "../Diagetic/Keys.js";
import { CarrierSize } from "../Diagetic.js";
import type { Kind } from "../Diagetic.js";

/**
 * A coordinate triple in model pixels.
 *
 * @category Model
 * @since 1.0.0
 */
export type Triple = readonly [number, number, number];

/**
 * An axis-aligned cube in control-local pixels: X along the mount's Right, Y along its Up and Z out of
 * the supporting face. Uv optionally fixes the texture origin for every face; otherwise each face is
 * centred in its sixteen-pixel texture.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LocalCube
{
    readonly Min: Triple;
    readonly Max: Triple;
    readonly Uv?: readonly [number, number];
}

/**
 * A model bone in control-local pixels. Rotation is a static bone rotation in Bedrock's convention, and
 * Texture names the client texture slot that renders its cubes.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LocalBone
{
    readonly Name: string;
    readonly Parent: string;
    readonly Pivot: Triple;
    readonly Rotation?: Triple;
    readonly Texture?: string;
    readonly Cubes?: ReadonlyArray<LocalCube>;
}

/**
 * A control model: its bones below the shared mount chain, the bone animated by Motion, the channel that
 * Motion drives and vanilla texture paths for each texture slot.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ControlModel
{
    readonly Kind: Kind;
    readonly Bones: ReadonlyArray<LocalBone>;
    readonly Moving: string;
    readonly Channel: "rotation" | "position";
    readonly Axis: 0 | 1 | 2;
    readonly Textures: Readonly<Record<string, string>>;
}

/**
 * Bones shared by every control: root cancels body yaw, offset translates to the mount, and nested yaw,
 * pitch and roll bones orient the support plane. Each pivots at the model origin.
 *
 * @category Constant
 * @since 1.0.0
 */
export const MountBones = Object.freeze([ "root", "offset", "mount_yaw", "mount_pitch",
    "mount_roll" ] as const);

/**
 * Vanilla lever proportions: an 8 by 6 by 3 cobblestone base split by a 2.5-pixel channel and a 2 by 2 by
 * 10 stick pivoting one pixel above the support, sweeping toward local X through the channel.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LeverModel: ControlModel = Object.freeze({ Kind: "lever",
    Moving: "handle",
    Channel: "rotation",
    Axis: 1,
    Textures: Object.freeze({ base: "textures/blocks/cobblestone",
        handle: "textures/blocks/lever" }),
    Bones: Object.freeze([
        { Name: "base",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 0 ],
            Texture: "base",
            Cubes: [ { Min: [ -4, 1.25, 0 ],
                Max: [ 4, 3, 3 ] },
            { Min: [ -4, -3, 0 ],
                Max: [ 4, -1.25, 3 ] } ] },
        { Name: "handle",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 1 ] },
        { Name: "stick",
            Parent: "handle",
            Pivot: [ 0, 0, 1 ],
            Rotation: [ 90, 0, 0 ],
            Texture: "handle",
            Cubes: [ { Min: [ -1, 0, 0 ],
                Max: [ 1, 10, 2 ],
                Uv: [ 7, 6 ] } ] }
    ] as ReadonlyArray<LocalBone>) });

/**
 * A button-shaped 6 by 4 by 2 knob, longer along the track, riding a narrow 14 by 2 by 1 raised track.
 *
 * @category Constant
 * @since 1.0.0
 */
export const SliderModel: ControlModel = Object.freeze({ Kind: "slider",
    Moving: "knob",
    Channel: "position",
    Axis: 0,
    Textures: Object.freeze({ track: "textures/blocks/stone",
        knob: "textures/blocks/planks_oak" }),
    Bones: Object.freeze([
        { Name: "track",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 0 ],
            Texture: "track",
            Cubes: [ { Min: [ -7, -1, 0 ],
                Max: [ 7, 1, 1 ] } ] },
        { Name: "knob",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 0 ],
            Texture: "knob",
            Cubes: [ { Min: [ -3, -2, 1 ],
                Max: [ 3, 2, 3 ] } ] }
    ] as ReadonlyArray<LocalBone>) });

/**
 * A blocky oak wheel 8 pixels (0.5 blocks) across, with stepped rim corners, four spokes, a hub, a grip
 * at local +Y showing its angle, and a stone axle to the support.
 *
 * @category Constant
 * @since 1.0.0
 */
export const WheelModel: ControlModel = Object.freeze({ Kind: "wheel",
    Moving: "wheel",
    Channel: "rotation",
    Axis: 2,
    Textures: Object.freeze({ axle: "textures/blocks/stone",
        wheel: "textures/blocks/planks_oak" }),
    Bones: Object.freeze([
        { Name: "axle",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 0 ],
            Texture: "axle",
            Cubes: [ { Min: [ -0.5, -0.5, 0 ],
                Max: [ 0.5, 0.5, 2 ] } ] },
        { Name: "wheel",
            Parent: "mount_roll",
            Pivot: [ 0, 0, 0 ],
            Texture: "wheel",
            Cubes: [
                { Min: [ -1, -1, 1.5 ],
                    Max: [ 1, 1, 3.5 ] },
                { Min: [ -3, -0.5, 2 ],
                    Max: [ 3, 0.5, 3 ] },
                { Min: [ -0.5, -3, 2 ],
                    Max: [ 0.5, 3, 3 ] },
                { Min: [ -2, 3, 2 ],
                    Max: [ 2, 4, 3 ] },
                { Min: [ -2, -4, 2 ],
                    Max: [ 2, -3, 3 ] },
                { Min: [ 3, -2, 2 ],
                    Max: [ 4, 2, 3 ] },
                { Min: [ -4, -2, 2 ],
                    Max: [ -3, 2, 3 ] },
                { Min: [ 2, 2, 2 ],
                    Max: [ 3, 3, 3 ] },
                { Min: [ -3, 2, 2 ],
                    Max: [ -2, 3, 3 ] },
                { Min: [ 2, -3, 2 ],
                    Max: [ 3, -2, 3 ] },
                { Min: [ -3, -3, 2 ],
                    Max: [ -2, -2, 3 ] },
                { Min: [ -0.5, 3, 3 ],
                    Max: [ 0.5, 4, 5 ] }
            ] }
    ] as ReadonlyArray<LocalBone>) });

/**
 * Models by control kind.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Models: Readonly<Record<Kind, ControlModel>> = Object.freeze({ lever: LeverModel,
    slider: SliderModel,
    wheel: WheelModel });

/**
 * Built-in entity identifiers registered by BedformCommon.
 *
 * @category Constant
 * @since 1.0.0
 */
export const BuiltinEntity: Readonly<Record<Kind, string>> = Object.freeze({ lever: "bedform:diagetic_lever",
    slider: "bedform:diagetic_slider",
    wheel: "bedform:diagetic_wheel" });

/**
 * Shared client resource identifiers and the entity Use event and interact text key.
 *
 * @category Constant
 * @since 1.0.0
 */
export const SharedResource = Object.freeze({
    Geometry: (kind: Kind): string => `geometry.bedform.diagetic_${kind}`,
    MountAnimation: "animation.bedform.diagetic.mount",
    MotionAnimation: (kind: Kind): string => `animation.bedform.diagetic_${kind}.motion`,
    RenderController: (kind: Kind, texture: string): string =>
        `controller.render.bedform.diagetic_${kind}.${texture}`,
    InteractText: "action.interact.bedform.diagetic",
    ReleaseText: "action.interact.bedform.diagetic_release",
    UseEvent: "bedform:diagetic_use",
    Family: "bedform_diagetic"
});

/**
 * Converts a control-local point in pixels to Bedrock model space, which mirrors Z.
 *
 * @category Transforming
 * @since 1.0.0
 */
const Model = (point: Triple): [number, number, number] =>
{
    return [ point[0], point[1], point[2] === 0 ? 0 : -point[2] ];
};

/**
 * Builds per-face UVs, centring each face in a sixteen-pixel texture unless the cube fixes an origin.
 *
 * @category Serialization
 * @since 1.0.0
 */
const Faces = (cube: LocalCube): Record<string, unknown> =>
{
    const [ x, y, z ] = [ 0, 1, 2 ].map((axis: number) => cube.Max[axis] - cube.Min[axis]);
    const face = (width: number, height: number): Record<string, unknown> =>
        ({ uv: cube.Uv ? [ ...cube.Uv ] : [ (16 - width) / 2, (16 - height) / 2 ],
            uv_size: [ width, height ] });
    return { north: face(x, y),
        south: face(x, y),
        east: face(z, y),
        west: face(z, y),
        up: face(x, z),
        down: face(x, z) };
};

/**
 * Emits the model's geometry file, prefixed by the shared mount chain.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const Geometry = (model: ControlModel): Record<string, unknown> =>
{
    const chain = MountBones.map((name: string, index: number) => ({ name,
        ...(index ? { parent: MountBones[index - 1] } : {}),
        pivot: [ 0, 0, 0 ] }));
    const bones = model.Bones.map((bone: LocalBone) => ({ name: bone.Name,
        parent: bone.Parent,
        pivot: Model(bone.Pivot),
        ...(bone.Rotation ? { rotation: [ ...bone.Rotation ] } : {}),
        ...(bone.Cubes ? { cubes: bone.Cubes.map((cube: LocalCube) => ({
            origin: Model([ cube.Min[0], cube.Min[1], cube.Max[2] ]),
            size: [ 0, 1, 2 ].map((axis: number) => cube.Max[axis] - cube.Min[axis]),
            uv: Faces(cube) })) } : {}) }));
    return { format_version: "1.16.0",
        "minecraft:geometry": [ { description: { identifier: SharedResource.Geometry(model.Kind),
            texture_width: 16,
            texture_height: 16,
            visible_bounds_width: 2,
            visible_bounds_height: 2,
            visible_bounds_offset: [ 0, 0.5, 0 ] },
        bones: [ ...chain, ...bones ] } ] };
};

/**
 * Emits the mount animation shared by all kinds and one Motion animation per kind. Values are published
 * in Bedrock bone units, so the expressions only read properties.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const Animations = (): Record<string, unknown> =>
{
    const read = (name: string): string => `query.property('${name}')`;
    const animations: Record<string, unknown> = {
        [SharedResource.MountAnimation]: { loop: true,
            bones: { root: { rotation: [ 0, "-query.body_y_rotation", 0 ] },
                offset: { position: [ read(PoseProperty.OffsetX), read(PoseProperty.OffsetY),
                    read(PoseProperty.OffsetZ) ] },
                mount_yaw: { rotation: [ 0, read(PoseProperty.Yaw), 0 ] },
                mount_pitch: { rotation: [ read(PoseProperty.Pitch), 0, 0 ] },
                mount_roll: { rotation: [ 0, 0, read(PoseProperty.Roll) ] } } }
    };
    for (const model of Object.values(Models))
    {
        const channel: Array<string | number> = [ 0, 0, 0 ];
        channel[model.Axis] = read(PoseProperty.Motion);
        animations[SharedResource.MotionAnimation(model.Kind)] = { loop: true,
            bones: { [model.Moving]: { [model.Channel]: channel } } };
    }

    return { format_version: "1.8.0",
        animations };
};

/**
 * Emits one render controller per texture slot, hiding cube bones that belong to other slots.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const RenderControllers = (): Record<string, unknown> =>
{
    const controllers: Record<string, unknown> = {};
    for (const model of Object.values(Models))
    {
        for (const texture of Object.keys(model.Textures))
        {
            const hidden = model.Bones.filter((bone: LocalBone) => bone.Cubes && bone.Texture !== texture)
                .map((bone: LocalBone) => ({ [bone.Name]: false }));
            controllers[SharedResource.RenderController(model.Kind, texture)] = {
                geometry: "Geometry.default",
                materials: [ { "*": "Material.default" } ],
                textures: [ `Texture.${texture}` ],
                overlay_color: { r: 1,
                    g: 0.84,
                    b: 0.4,
                    a: `query.property('${EntityProperty.Highlighted}') ? 0.25 : 0` },
                part_visibility: [ { "*": true }, ...hidden ]
            };
        }
    }

    return { format_version: "1.10.0",
        render_controllers: controllers };
};

/**
 * Emits a server entity with the shared synchronized pose schema, a non-colliding, invulnerable,
 * unpushable carrier and an interaction so clients offer Use. Consumers may reuse it for their own
 * identifiers; register each identifier with exactly one Diagetic runtime.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const BehaviorEntity = (identifier: string): Record<string, unknown> =>
{
    const properties: Record<string, unknown> = { [EntityProperty.Highlighted]: { type: "bool",
        default: false,
        client_sync: true } };
    for (const [ name, key ] of Object.entries(PoseProperty))
    {
        const range = name.startsWith("Offset") ? PoseRange.Offset
            : name === "Motion" ? PoseRange.Motion : PoseRange.Angle;
        // BDS requires fractional JSON tokens for float defaults; published poses replace this at once.
        properties[key] = { type: "float",
            range: [ ...range ],
            default: 0.0001,
            client_sync: true };
    }

    return { format_version: "1.26.50",
        "minecraft:entity": {
            description: { identifier,
                is_spawnable: false,
                is_summonable: true,
                properties },
            components: {
                "minecraft:collision_box": { width: CarrierSize,
                    height: CarrierSize },
                "minecraft:physics": { has_collision: false,
                    has_gravity: false },
                "minecraft:pushable_by_entity": { presets: [ { push_mode: "none" } ] },
                "minecraft:damage_sensor": { triggers: { cause: "all",
                    deals_damage: "no" } },
                "minecraft:knockback_resistance": { value: 1 },
                "minecraft:fire_immune": {},
                "minecraft:persistent": {},
                "minecraft:body_rotation_blocked": {},
                "minecraft:type_family": { family: [ SharedResource.Family, "inanimate" ] },
                "minecraft:interact": { interactions: [ { interact_text: SharedResource.InteractText,
                    on_interact: { event: SharedResource.UseEvent,
                        target: "self" },
                    swing: true } ] }
            },
            events: { [SharedResource.UseEvent]: {} }
        } };
};

/**
 * Emits a client entity for an identifier, referencing the shared geometry, animations, render
 * controllers and vanilla textures of a control kind.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const ClientEntity = (identifier: string, kind: Kind): Record<string, unknown> =>
{
    const model = Models[kind];
    return { format_version: "1.10.0",
        "minecraft:client_entity": { description: { identifier,
            materials: { default: "entity_alphatest" },
            textures: { ...model.Textures },
            geometry: { default: SharedResource.Geometry(kind) },
            animations: { mount: SharedResource.MountAnimation,
                motion: SharedResource.MotionAnimation(kind) },
            scripts: { animate: [ "mount", "motion" ] },
            render_controllers: Object.keys(model.Textures)
                .map((texture: string) => SharedResource.RenderController(kind, texture)) } } };
};

/**
 * Localization lines for the built-in entity names and the shared interaction prompt.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const Localization = (): string =>
{
    return [ `entity.${BuiltinEntity.lever}.name=Lever`,
        `entity.${BuiltinEntity.slider}.name=Slider`,
        `entity.${BuiltinEntity.wheel}.name=Wheel`,
        `${SharedResource.InteractText}=Grab`,
        `${SharedResource.ReleaseText}=Release` ].join("\n") + "\n";
};

/**
 * Emits an invisible Use receiver with a renewable one-second lease. Unrefreshed receivers despawn
 * independently of the script runtime, including after reloads and interrupted cleanup.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const ReleaseTargetBehavior = (): Record<string, unknown> =>
{
    const shared = BehaviorEntity(ReleaseTarget)["minecraft:entity"] as {
        components: Record<string, unknown> };
    return { format_version: "1.26.50",
        "minecraft:entity": { description: { identifier: ReleaseTarget,
            is_spawnable: false,
            is_summonable: true },
        components: { ...shared.components,
            "minecraft:collision_box": { width: 0.6,
                height: 0.6 },
            "minecraft:interact": { interactions: [ { interact_text: SharedResource.ReleaseText,
                on_interact: { event: SharedResource.UseEvent,
                    target: "self" },
                swing: true } ] } },
        component_groups: { lease: { "minecraft:timer": { time: 1,
            looping: false,
            time_down_event: { event: EntityEvent.ExpireTarget,
                target: "self" } } },
        expired: { "minecraft:instant_despawn": {} } },
        events: { [EntityEvent.RefreshTarget]: {
            sequence: [ { remove: { component_groups: [ "lease" ] } },
                { add: { component_groups: [ "lease" ] } } ] },
        "minecraft:entity_spawned": { add: { component_groups: [ "lease" ] } },
        [EntityEvent.ExpireTarget]: { add: { component_groups: [ "expired" ] } },
        [SharedResource.UseEvent]: {} } } };
};
