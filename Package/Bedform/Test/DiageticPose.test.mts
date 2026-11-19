/**
 * Synchronized pose publication, Bedrock bone-convention reconstruction, shared control geometry and
 * the runtime's spawn attachment and release fallbacks.
 *
 * @module bedform/Test/DiageticPose.test
 *
 * @file      DiageticPose.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Geometry fixtures retain coordinate ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

import * as C from "../Source/Build/DiageticControls.js";
import * as D from "bedform/Diagetic";
import type { Direction, Entity, Vector3 } from "@minecraft/server";
import { MotionValue, Pose } from "../Source/Internal/DiageticPose.js";
import Assert from "node:assert/strict";
import { Harness } from "./DiageticHarness.mjs";
import { MountFrame } from "../Source/Internal/DiageticFrame.js";
import { test } from "node:test";

type Matrix = ReadonlyArray<ReadonlyArray<number>>;

const Radians = Math.PI / 180;
const Faces: ReadonlyArray<Direction> = [ "Up", "Down", "North", "South", "East", "West" ] as Array<Direction>;

/**
 * Right-handed rotation about one world axis.
 *
 * @category Testing
 * @since 1.0.0
 */
const Axis = (axis: 0 | 1 | 2, degrees: number): Matrix =>
{
    const c = Math.cos(degrees * Radians);
    const s = Math.sin(degrees * Radians);
    return axis === 0 ? [ [ 1, 0, 0 ], [ 0, c, -s ], [ 0, s, c ] ]
        : axis === 1 ? [ [ c, 0, s ], [ 0, 1, 0 ], [ -s, 0, c ] ]
            : [ [ c, -s, 0 ], [ s, c, 0 ], [ 0, 0, 1 ] ];
};

/**
 * Multiplies two 3 by 3 matrices.
 *
 * @category Testing
 * @since 1.0.0
 */
const Multiply = (a: Matrix, b: Matrix): Matrix =>
{
    return a.map((row) => [ 0, 1, 2 ].map((j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
};

/**
 * Applies a matrix to a vector.
 *
 * @category Testing
 * @since 1.0.0
 */
const Apply = (m: Matrix, v: Readonly<Vector3>): Vector3 =>
{
    return { x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
        y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z,
        z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z };
};

/**
 * World-space effect of one Bedrock bone rotation under the documented convention: X, -Y, -Z.
 *
 * @category Testing
 * @since 1.0.0
 */
const Bone = (rotation: readonly [number, number, number]): Matrix =>
{
    return Multiply(Multiply(Axis(2, -rotation[2]), Axis(1, -rotation[1])), Axis(0, rotation[0]));
};

/**
 * Asserts two vectors agree within a tolerance.
 *
 * @category Testing
 * @since 1.0.0
 */
const Near = (actual: Readonly<Vector3>, expected: Readonly<Vector3>, message: string): void =>
{
    Assert.ok(Math.abs(actual.x - expected.x) < 1e-6 && Math.abs(actual.y - expected.y) < 1e-6 &&
        Math.abs(actual.z - expected.z) < 1e-6, `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
};

/**
 * A native-shaped carrier with location, rotation and the shared synchronized property schema.
 *
 * @category Testing
 * @since 1.0.0
 */
const Carrier = (location: Vector3, yaw: number, pitch = 0, schema = true) =>
{
    const synchronized = new Map<string, number>(schema ? Object.values(D.Keys.PoseProperty)
        .map((key) => [ key, 0 ]) : []);
    const writes: Array<string> = [];
    const entity = { isValid: true,
        location,
        getRotation: () => ({ x: pitch,
            y: yaw }),
        getProperty: (key: string) => synchronized.get(key),
        setProperty: (key: string, value: number) =>
        {
            writes.push(key);
            synchronized.set(key, value);
        } } as unknown as Entity;
    return { entity,
        synchronized,
        writes };
};

/**
 * Renders a control-local point through the client chain: geometry mirrors Z, nested mount bones rotate
 * by the published angles, the offset bone translates, the root cancels body yaw and the body yaw applies.
 *
 * @category Testing
 * @since 1.0.0
 */
const Render = (values: ReturnType<typeof Pose>, location: Readonly<Vector3>, yaw: number, local: Vector3): Vector3 =>
{
    const mount = Multiply(Multiply(Bone([ 0, values.Yaw, 0 ]), Bone([ values.Pitch, 0, 0 ])),
        Bone([ 0, 0, values.Roll ]));
    const rotated = Apply(mount, local);
    const offset = { x: values.OffsetX / 16,
        y: values.OffsetY / 16,
        z: -values.OffsetZ / 16 };
    const body = Multiply(Bone([ 0, yaw, 0 ]), Bone([ 0, -yaw, 0 ]));
    const world = Apply(body, { x: rotated.x + offset.x,
        y: rotated.y + offset.y,
        z: rotated.z + offset.z });
    return { x: location.x + world.x,
        y: location.y + world.y,
        z: location.z + world.z };
};

test("published bone values reconstruct every face and free mount through the Bedrock bone convention", () =>
{
    const controls: Array<Parameters<typeof Pose>[0] & { readonly yaw: number }> = [];
    for (const face of Faces)
    {
        const binding: D.BlockBinding = { Dimension: "overworld",
            Position: { x: 3,
                y: 64,
                z: -7 },
            Face: face,
            ExpectedBlockType: "minecraft:stone" };
        for (const rotation of [ { x: 0,
            y: 0,
            z: 0 }, { x: 20,
            y: -35,
            z: 70 } ])
        {
            const yaw = face === "Up" ? 37 : -110;
            controls.push({ Entity: Carrier(D.BindingLocation(binding), yaw).entity,
                Binding: binding,
                Pose: { Offset: { x: 0.1,
                    y: -0.05,
                    z: 0.02 },
                Rotation: rotation },
                yaw });
        }
    }

    for (const [ yaw, pitch ] of [ [ 0, 0 ], [ 90, 0 ], [ -135, 30 ], [ 179, -89.9 ], [ 45, 90 ] ])
    {
        controls.push({ Entity: Carrier({ x: 0.5,
            y: 5,
            z: 0.5 }, yaw, pitch).entity,
        Pose: { Offset: { x: 0,
            y: 0.375,
            z: 0.1 },
        Rotation: { x: 10,
            y: 0,
            z: -15 } },
        yaw });
    }

    for (const control of controls)
    {
        const mount = MountFrame(control);
        const values = Pose(control, 0);
        const location = control.Entity.location;
        Near(Render(values, location, control.yaw, { x: 0,
            y: 0,
            z: 0 }), mount.Position, "origin");
        for (const [ local, axis ] of [ [ { x: 1,
            y: 0,
            z: 0 }, mount.Right ], [ { x: 0,
            y: 1,
            z: 0 }, mount.Up ], [ { x: 0,
            y: 0,
            z: 1 }, mount.Normal ] ] as const)
        {
            const point = Render(values, location, control.yaw, local);
            Near({ x: point.x - mount.Position.x,
                y: point.y - mount.Position.y,
                z: point.z - mount.Position.z }, axis, "axis");
        }

        for (const name of [ "Yaw", "Pitch", "Roll" ] as const)
        {
            Assert.ok(values[name] >= -180 && values[name] < 180);
        }
    }
});

test("moving bones follow the simulation's handle, knob and wheel geometry", () =>
{
    const lever = D.Lever().Configuration;
    const slider = D.Slider().Configuration;
    const wheel = D.Wheel().Configuration;
    Assert.equal(MotionValue(lever, 0), 45);
    Assert.equal(MotionValue(lever, 1), -45);
    Assert.equal(MotionValue(lever, 0.5), 0);
    Assert.equal(MotionValue(slider, 0), -4);
    Assert.equal(MotionValue(slider, 1), 4);
    Assert.equal(MotionValue(wheel, 90), -90);
    Assert.equal(MotionValue(wheel, 540), -180);
    Assert.equal(MotionValue(wheel, -720), 0);
    // A lever value of one tilts the handle toward local +X: bone Y rotation -45 acts as Ry(+45).
    const tilt = Apply(Bone([ 0, MotionValue(lever, 1), 0 ]), { x: 0,
        y: 0,
        z: 1 });
    Assert.ok(tilt.x > 0.7 && tilt.z > 0.7);
    // The wheel point at value v is (cos v, sin v): bone Z rotation -v acts as Rz(+v).
    const turn = Apply(Bone([ 0, 0, MotionValue(wheel, 90) ]), { x: 1,
        y: 0,
        z: 0 });
    Near(turn, { x: 0,
        y: 1,
        z: 0 }, "wheel");
});

test("built-in handles publish clamped changes only for entities declaring the shared schema", () =>
{
    const h = Harness();
    const actor = h.actor("lever", "bedform:diagetic_lever");
    for (const key of Object.values(D.Keys.PoseProperty))
    {
        actor.synchronized.set(key, 0);
    }

    const handle = D.Lever().Attach(actor.entity);
    Assert.equal(actor.synchronized.get(D.Keys.PoseProperty.Motion), 45);
    Assert.equal(actor.synchronized.get(D.Keys.PoseProperty.OffsetY), 0);
    const writes = (): number => h.calls.filter((call) => call.startsWith("lever:property:")).length;
    const initial = writes();
    handle.SetValue(1);
    Assert.equal(actor.synchronized.get(D.Keys.PoseProperty.Motion), -45);
    Assert.equal(writes(), initial + 1);
    D.Lever().Attach({ ...actor.native } as unknown as Entity);
    Assert.ok(D.PublishPose({ Entity: actor.entity,
        Pose: { Offset: { x: 0,
            y: 100,
            z: 0 },
        Rotation: { x: 0,
            y: 0,
            z: 0 } } }, 9999));
    Assert.equal(actor.synchronized.get(D.Keys.PoseProperty.OffsetY), 256.5);
    Assert.equal(actor.synchronized.get(D.Keys.PoseProperty.Motion), 360.5);
    const plain = h.actor("plain", "bedform:diagetic_slider");
    D.Slider().Attach(plain.entity);
    Assert.equal(plain.synchronized.size, 0);
    Assert.equal(D.PublishPose({ Entity: plain.entity,
        Pose: handle.Pose }, 0), false);
});

test("bound carriers centre their collision box a quarter block out from each support face", () =>
{
    for (const face of Faces)
    {
        const binding: D.BlockBinding = { Dimension: "overworld",
            Position: { x: 0,
                y: 0,
                z: 0 },
            Face: face,
            ExpectedBlockType: "minecraft:stone" };
        const location = D.BindingLocation(binding);
        const centre = { x: location.x,
            y: location.y + D.CarrierSize / 2,
            z: location.z };
        const mount = MountFrame({ Entity: Carrier(location, 0).entity,
            Binding: binding,
            Pose: { Offset: { x: 0,
                y: 0,
                z: 0 },
            Rotation: { x: 0,
                y: 0,
                z: 0 } } });
        Near(centre, { x: mount.Position.x + mount.Normal.x * 0.25,
            y: mount.Position.y + mount.Normal.y * 0.25,
            z: mount.Position.z + mount.Normal.z * 0.25 }, face);
    }

    Assert.throws(() => D.BindingLocation({ Dimension: "overworld",
        Position: { x: 0.5,
            y: 0,
            z: 0 },
        Face: "Up" as Direction,
        ExpectedBlockType: "minecraft:stone" }), RangeError);
});

/**
 * Returns the local-space corners of a model bone's cubes.
 *
 * @category Testing
 * @since 1.0.0
 */
const Corners = (model: C.ControlModel, name: string): Array<Vector3> =>
{
    return model.Bones.find((bone) => bone.Name === name)!.Cubes!.flatMap((cube) =>
        [ 0, 1, 2, 3, 4, 5, 6, 7 ].map((index) => ({ x: index & 1 ? cube.Max[0] : cube.Min[0],
            y: index & 2 ? cube.Max[1] : cube.Min[1],
            z: index & 4 ? cube.Max[2] : cube.Min[2] })));
};

test("shared geometry keeps vanilla lever clearance, a button knob on a raised track and a half-block wheel", () =>
{
    const base = Corners(C.LeverModel, "base");
    const channel = Math.min(...base.map((corner) => Math.abs(corner.y)).filter((y) => y > 0));
    Assert.deepEqual([ Math.min(...base.map((c) => c.x)), Math.max(...base.map((c) => c.x)) ], [ -4, 4 ]);
    Assert.deepEqual([ Math.min(...base.map((c) => c.y)), Math.max(...base.map((c) => c.y)) ], [ -3, 3 ]);
    Assert.equal(Math.max(...base.map((c) => c.z)), 3);
    const stick = C.LeverModel.Bones.find((bone) => bone.Name === "stick")!;
    const handle = C.LeverModel.Bones.find((bone) => bone.Name === "handle")!;
    for (let angle = -45; angle <= 45; angle += 5)
    {
        const motion = Bone([ 0, -angle, 0 ]);
        for (const corner of Corners(C.LeverModel, "stick"))
        {
            const pivot = { x: stick.Pivot[0],
                y: stick.Pivot[1],
                z: stick.Pivot[2] };
            const raised = Apply(Bone(stick.Rotation!), { x: corner.x - pivot.x,
                y: corner.y - pivot.y,
                z: corner.z - pivot.z });
            const swept = Apply(motion, { x: raised.x + pivot.x - handle.Pivot[0],
                y: raised.y + pivot.y - handle.Pivot[1],
                z: raised.z + pivot.z - handle.Pivot[2] });
            const point = { x: swept.x + handle.Pivot[0],
                y: swept.y + handle.Pivot[1],
                z: swept.z + handle.Pivot[2] };
            Assert.ok(Math.abs(point.y) <= 1 + 1e-9 && Math.abs(point.y) < channel, "stick leaves the channel");
            Assert.ok(point.z >= 0, "stick enters the support");
            if (angle === 0)
            {
                Assert.ok(point.z >= 1 - 1e-9 && point.z <= 11 + 1e-9);
            }
        }
    }

    Assert.ok(channel - 1 >= 0.25, "lever channel clearance");
    const track = Corners(C.SliderModel, "track");
    const knob = Corners(C.SliderModel, "knob");
    const span = (points: Array<Vector3>, axis: "x" | "y" | "z"): number =>
        Math.max(...points.map((p) => p[axis])) - Math.min(...points.map((p) => p[axis]));
    Assert.ok(span(knob, "x") > span(knob, "y"), "knob longer along the track");
    Assert.deepEqual([ span(knob, "x"), span(knob, "y"), span(knob, "z") ], [ 6, 4, 2 ]);
    Assert.ok(span(track, "y") < span(knob, "y") && span(track, "z") >= 1, "narrow raised track");
    Assert.equal(Math.min(...knob.map((p) => p.z)), Math.max(...track.map((p) => p.z)));
    const travel = MotionValue(D.Slider().Configuration, 1);
    Assert.ok(Math.max(...knob.map((p) => p.x)) + travel <= Math.max(...track.map((p) => p.x)));
    const wheel = Corners(C.WheelModel, "wheel");
    Assert.equal(span(wheel, "x") / 16, 0.5);
    Assert.equal(span(wheel, "y") / 16, 0.5);
    Assert.equal(D.Wheel().Configuration.Radius! * 2, 0.5);
});

test("shared content declares the pose schema, references shared assets and hides other texture slots", () =>
{
    const behavior = C.BehaviorEntity("example:lever") as { "minecraft:entity": { description: {
        properties: Record<string, { range: Array<number>;
            client_sync: boolean;
            default: number }> } } };
    const properties = behavior["minecraft:entity"].description.properties;
    Assert.deepEqual(Object.keys(properties).sort(),
        [ ...Object.values(D.Keys.PoseProperty), D.Keys.EntityProperty.Highlighted ].sort());
    Assert.deepEqual(properties[D.Keys.EntityProperty.Highlighted],
        { type: "bool",
            default: false,
            client_sync: true });
    Assert.ok(Object.values(properties).every((property) => property.client_sync));
    Assert.deepEqual(properties[D.Keys.PoseProperty.Yaw].range, [ -180.5, 180.5 ]);
    for (const key of Object.values(D.Keys.PoseProperty))
    {
        const property = properties[key];
        Assert.ok([ ...property.range, property.default ].every((value) => !Number.isInteger(value)),
            "BDS needs fractional float tokens");
    }

    const client = JSON.stringify(C.ClientEntity("example:lever", "lever"));
    for (const reference of [ C.SharedResource.Geometry("lever"), C.SharedResource.MountAnimation,
        C.SharedResource.MotionAnimation("lever"), "textures/blocks/cobblestone", "textures/blocks/lever" ])
    {
        Assert.ok(client.includes(reference), reference);
    }

    const animations = JSON.stringify(C.Animations());
    for (const key of Object.values(D.Keys.PoseProperty))
    {
        Assert.ok(animations.includes(key), key);
    }

    const controllers = (C.RenderControllers() as { render_controllers: Record<string, {
        part_visibility: Array<Record<string, boolean>> }> }).render_controllers;
    Assert.deepEqual(controllers[C.SharedResource.RenderController("lever", "base")].part_visibility,
        [ { "*": true }, { stick: false } ]);
    Assert.deepEqual(controllers[C.SharedResource.RenderController("lever", "handle")].part_visibility,
        [ { "*": true }, { base: false } ]);
    for (const model of Object.values(C.Models))
    {
        const geometry = C.Geometry(model) as { "minecraft:geometry": Array<{ bones: Array<{ name: string;
            parent?: string;
            cubes?: Array<{ size: Array<number> }> }> }> };
        const bones = geometry["minecraft:geometry"][0].bones;
        Assert.deepEqual(bones.slice(0, 5).map((bone) => bone.name), [ ...C.MountBones ]);
        Assert.ok(bones.every((bone, index) => index === 0 || bones.some((parent) => parent.name === bone.parent)));
        Assert.ok(bones.flatMap((bone) => bone.cubes ?? []).every((cube) => cube.size.every((size) => size > 0)));
    }

    Assert.ok(!JSON.stringify([ C.Models, C.Localization() ]).toLowerCase().includes("button\""));
});

test("first block Use or item use releases an active grab, and spawned entities attach immediately", () =>
{
    const h = Harness();
    const a = h.player("a");
    const actor = h.actor("control");
    const runtime = D.Start({ ...h.options,
        Controls: [ D.Slider() ] });
    try
    {
        h.advance();
        const use = { player: a.player,
            target: actor.entity,
            cancel: false };
        h.before.playerInteractWithEntity.emit(use);
        h.advance();
        Assert.ok(runtime.IsInteracting(a.player));
        const held = { player: a.player,
            isFirstEvent: false,
            cancel: false };
        h.before.playerInteractWithBlock.emit(held);
        h.advance();
        Assert.ok(held.cancel && runtime.IsInteracting(a.player));
        const first = { player: a.player,
            isFirstEvent: true,
            cancel: false };
        h.before.playerInteractWithBlock.emit(first);
        h.advance();
        Assert.ok(first.cancel);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Assert.equal(a.data.prompt, "");
        h.before.playerInteractWithEntity.emit({ ...use });
        h.advance();
        Assert.ok(runtime.IsInteracting(a.player));
        const item = { source: a.player,
            cancel: false };
        h.before.itemUse.emit(item);
        h.advance();
        Assert.ok(item.cancel);
        Assert.equal(runtime.IsInteracting(a.player), false);
        const idle = { player: a.player,
            isFirstEvent: true,
            cancel: false };
        h.before.playerInteractWithBlock.emit(idle);
        Assert.equal(idle.cancel, false);

        const spawned = h.actor("spawned");
        for (const key of Object.values(D.Keys.PoseProperty))
        {
            spawned.synchronized.set(key, 0);
        }

        h.after.entitySpawn.emit({ entity: spawned.entity });
        Assert.equal(spawned.synchronized.get(D.Keys.PoseProperty.Motion), -4);
        Assert.deepEqual(h.errors, []);
    }
    finally
    {
        runtime.Dispose();
        Assert.equal(h.subscriptions(), 0);
    }
});
