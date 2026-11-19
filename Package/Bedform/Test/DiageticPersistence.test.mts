/**
 * Durable control reloads, six-face mount frames and non-loading supporting-block retirement.
 *
 * @module bedform/Test/DiageticPersistence.test
 *
 * @file      DiageticPersistence.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped fixtures retain contextual inference and coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "bedform/Diagetic";
import type { Direction, Entity } from "@minecraft/server";
import Assert from "node:assert/strict";
import { CaptureFrame } from "../Source/Internal/DiageticFrame.js";
import { Harness } from "./DiageticHarness.mjs";
import { test } from "node:test";

/**
 * Creates one block-bound slider with a durable custom model pose.
 *
 * @category Testing
 * @since 1.0.0
 */
const fixture = (face = "South" as Direction) =>
{
    const h = Harness();
    h.blocks.set("0,1,0", "minecraft:stone");
    const a = h.actor("control");
    const p = h.player("owner");
    const definition = D.Slider({ EntityType: a.entity.typeId });
    const binding: D.BlockBinding = { Dimension: h.dimension.id,
        Position: { x: 0,
            y: 1,
            z: 0 },
        Face: face,
        ExpectedBlockType: "minecraft:stone" };
    const seed = { Version: 1,
        Kind: "slider",
        Value: 0.35,
        Pose: { Offset: { x: 0,
            y: 0,
            z: 0.01 },
        Rotation: { x: 0,
            y: 0,
            z: 0 } },
        Binding: binding };
    a.properties.set(D.Keys.DynamicProperty.Control, JSON.stringify(seed));
    const control = definition.Attach(a.entity);
    const runtime = D.Start({ ...h.options,
        Controls: [ definition ] });
    h.advance();
    return { h,
        a,
        p,
        control,
        runtime,
        binding,
        definition };
};

test("records restore values, pose and binding across wrappers and definitions without grabs", () =>
{
    const { h, a, p, control, runtime, binding } = fixture();
    runtime.Interact(p.player, a.entity);
    h.advance();
    Assert.ok(runtime.IsInteracting(p.player));
    control.SetValue(0.72);
    const saved = a.properties.get(D.Keys.DynamicProperty.Control);
    Assert.ok(!String(saved).includes("Dragging"));
    runtime.Dispose();
    const fresh = D.Slider({ InitialValue: 0.1 });
    const wrapper = { ...a.native } as unknown as Entity;
    const restored = fresh.Attach(wrapper);
    Assert.equal(restored.Value, 0.72);
    Assert.deepEqual(restored.Binding, binding);
    Assert.deepEqual(restored.Pose, control.Pose);
    Assert.equal(restored.Motion.State.Dragging, false);
    Assert.equal(restored.Motion.State.Velocity, 0);
    const restart = D.Start({ ...h.options,
        Controls: [ fresh ] });
    h.advance();
    Assert.equal(restart.IsInteracting(p.player), false);
    Assert.equal(a.properties.get(D.Keys.DynamicProperty.Control), saved);
    Assert.equal(h.actors.size, 1);
    restart.Dispose();
});

test("programmatic and simulated commits reach storage before callbacks, including throwing observers", () =>
{
    const h = Harness();
    const a = h.actor("free");
    let last = 0;
    const definition = D.Slider({ InitialValue: 0.8,
        Spring: { Target: 0.2,
            Strength: 50 },
        OnChange: (event) =>
        {
            const record = JSON.parse(String(a.properties.get(D.Keys.DynamicProperty.Control)));
            Assert.equal(record.Value, event.Value);
            last = event.Value;
            throw new Error("observer");
        } });
    const handle = definition.Attach(a.entity);
    Assert.throws(() => handle.SetValue(0.6), /observer/);
    Assert.equal(handle.Value, last);
    Assert.throws(() => handle.Motion.Step(), /observer/);
    Assert.equal(handle.Value, last);
    const raw = a.properties.get(D.Keys.DynamicProperty.Control);
    h.faults.set("free:write:" + D.Keys.DynamicProperty.Control, 2);
    Assert.throws(() => handle.SetValue(0.4), /write/);
    Assert.equal(handle.Value, last);
    Assert.throws(() => handle.Motion.Step(), /write/);
    Assert.equal(handle.Value, last);
    Assert.equal(handle.Motion.State.Velocity, 0);
    Assert.equal(a.properties.get(D.Keys.DynamicProperty.Control), raw);
    Assert.equal(handle.Binding, undefined);
});

test("unload/reload retains durable data but never held motion or stale ownership", () =>
{
    const { h, a, p, control, runtime, definition } = fixture();
    runtime.Interact(p.player, a.entity);
    h.advance();
    control.SetValue(0.66);
    const tags = [ ...a.tags ];
    a.native.isValid = false;
    h.after.entityRemove.emit({ removedEntityId: a.entity.id,
        typeId: a.entity.typeId });
    Assert.equal(runtime.IsInteracting(p.player), false);
    const loaded = h.actor("control");
    for (const [ key, value ] of a.properties)
    {
        loaded.properties.set(key, value);
    }

    for (const tag of tags)
    {
        loaded.tags.add(tag);
    }

    h.after.entityLoad.emit({ entity: loaded.entity });
    const restored = definition.Attach(loaded.entity);
    Assert.equal(restored.Value, 0.66);
    Assert.deepEqual(restored.Binding, control.Binding);
    Assert.equal(restored.Motion.State.Dragging, false);
    Assert.equal(restored.Motion.State.Velocity, 0);
    Assert.equal(loaded.tags.size, 0);
    Assert.equal(h.actors.size, 1);
    runtime.Dispose();
});

test("observed replacement stays retired across restart even when the same support type returns", () =>
{
    const { h, a, runtime } = fixture();
    h.after.playerPlaceBlock.emit({ dimension: h.dimension,
        block: { location: { x: 0,
            y: 1,
            z: 0 } } });
    Assert.equal(a.properties.get(D.Keys.DynamicProperty.Retired), true);
    runtime.Dispose();
    const loaded = h.actor("control");
    for (const [ key, value ] of a.properties)
    {
        loaded.properties.set(key, value);
    }

    const restarted = D.Start({ ...h.options,
        Controls: [ D.Slider() ] });
    h.advance();
    Assert.equal(loaded.native.isValid, false);
    Assert.equal(h.actors.size, 1);
    restarted.Dispose();
});

test("corrupt, unsupported and incompatible records stay untouched and never create duplicate actors", () =>
{
    const h = Harness();
    const a = h.actor("bad");
    const valid = { Version: 1,
        Kind: "slider",
        Value: 0.2,
        Pose: { Offset: { x: 0,
            y: 0,
            z: 0 },
        Rotation: { x: 0,
            y: 0,
            z: 0 } } };
    for (const raw of [ "bad", "null", "{}", 42, "x".repeat(16_385),
        JSON.stringify({ ...valid,
            Version: 2 }), JSON.stringify({ ...valid,
            Kind: "wheel" }),
        JSON.stringify({ ...valid,
            Value: 2 }), JSON.stringify({ ...valid,
            Pose: {} }),
        JSON.stringify({ ...valid,
            Binding: null }),
        JSON.stringify({ ...valid,
            Binding: { Face: "invalid" } }) ])
    {
        a.properties.set(D.Keys.DynamicProperty.Control, raw);
        Assert.throws(() => D.Slider().Attach(a.entity));
        Assert.equal(a.properties.get(D.Keys.DynamicProperty.Control), raw);
        Assert.equal(a.native.isValid, true);
        Assert.equal(h.actors.size, 1);
    }

    a.properties.set(D.Keys.DynamicProperty.Control, JSON.stringify(valid));
    a.properties.set(D.Keys.DynamicProperty.Retired, "corrupt");
    Assert.throws(() => D.Slider().Attach(a.entity), /retirement marker/);
    Assert.equal(a.properties.get(D.Keys.DynamicProperty.Retired), "corrupt");
    Assert.equal(a.native.isValid, true);
});

test("all six faces use block-face centers, outward normals and consistent orthonormal mount axes", () =>
{
    const normals = { Up: [ 0, 1, 0 ],
        Down: [ 0, -1, 0 ],
        North: [ 0, 0, -1 ],
        South: [ 0, 0, 1 ],
        East: [ 1, 0, 0 ],
        West: [ -1, 0, 0 ] };
    for (const [ face, expected ] of Object.entries(normals))
    {
        const { p, control, runtime } = fixture(face as Direction);
        const { Mount } = CaptureFrame(p.player, control, { x: 0,
            y: 180 });
        const values = [ Mount.Normal.x, Mount.Normal.y, Mount.Normal.z ];
        values.forEach((value, index) => Assert.ok(Math.abs(value - expected[index]) < 1e-10));
        const positions = [ Mount.Position.x - 0.5, Mount.Position.y - 1.5, Mount.Position.z - 0.5 ];
        positions.forEach((value, index) => Assert.ok(Math.abs(value - expected[index] * 0.51) < 1e-10));
        const cross = [ Mount.Right.y * Mount.Up.z - Mount.Right.z * Mount.Up.y,
            Mount.Right.z * Mount.Up.x - Mount.Right.x * Mount.Up.z,
            Mount.Right.x * Mount.Up.y - Mount.Right.y * Mount.Up.x ];
        cross.forEach((value, index) => Assert.ok(Math.abs(value - expected[index]) < 1e-10));
        runtime.Dispose();
    }
});

test("unavailable chunks and ordinary permutations retain controls; loaded changes remove them", () =>
{
    const { h, a, p, runtime } = fixture();
    h.blocks.delete("0,1,0");
    h.advance(3);
    runtime.Interact(p.player, a.entity);
    h.advance();
    Assert.equal(runtime.IsInteracting(p.player), false);
    Assert.ok(a.native.isValid);
    h.faults.set("block:0,1,0", 2);
    h.advance(2);
    Assert.ok(a.native.isValid);
    h.blocks.set("0,1,0", "minecraft:stone");
    h.advance(2);
    Assert.ok(a.native.isValid);
    h.blocks.set("0,1,0", "minecraft:dirt");
    h.advance();
    Assert.equal(a.native.isValid, false);
    Assert.equal(h.errors.length, 0);
    runtime.Dispose();
});

test("break, replacement and explosion retire same-type support and restore holders", () =>
{
    for (const signal of [ "playerBreakBlock", "playerPlaceBlock", "blockExplode" ] as const)
    {
        const { h, a, p, runtime } = fixture();
        runtime.Interact(p.player, a.entity);
        h.advance();
        Assert.ok(runtime.IsInteracting(p.player));
        h.after[signal].emit({ dimension: h.dimension,
            block: { location: { x: 0,
                y: 1,
                z: 0 } } });
        h.advance();
        Assert.equal(a.native.isValid, false);
        Assert.equal(runtime.IsInteracting(p.player), false);
        Assert.equal(p.data.active || p.data.bodyLocked, false);
        Assert.equal(p.permissions.get(D.Keys.NativePermission.Movement), true);
        Assert.equal(h.storage.get(D.Keys.DynamicPropertyPrefix.Recovery + p.player.id), undefined);
        runtime.Dispose();
        Assert.equal(h.subscriptions(), 0);
    }
});

test("failed retirement quarantines controls and retries without duplicate actors or repeated errors", () =>
{
    const { h, a, p, runtime } = fixture();
    h.blocks.set("0,1,0", "minecraft:air");
    h.faults.set("control:remove", 3);
    h.advance(3);
    Assert.equal(h.errors.length, 1);
    Assert.ok(a.native.isValid);
    runtime.Interact(p.player, a.entity);
    h.advance();
    Assert.equal(runtime.IsInteracting(p.player), false);
    Assert.equal(a.native.isValid, false);
    Assert.equal(h.actors.size, 1);
    runtime.Dispose();
});

test("corrupt controls do not prevent healthy controls from attaching and checking support", () =>
{
    const h = Harness();
    const bad = h.actor("bad");
    bad.properties.set(D.Keys.DynamicProperty.Control, "bad");
    const good = h.actor("good");
    const runtime = D.Start({ ...h.options,
        Controls: [ D.Slider() ] });
    h.advance();
    Assert.ok(good.properties.has(D.Keys.DynamicProperty.Control));
    Assert.equal(bad.properties.get(D.Keys.DynamicProperty.Control), "bad");
    Assert.equal(h.actors.size, 2);
    Assert.ok(h.errors.length > 0);
    runtime.Dispose();
});
