/**
 * Custom-control hook ordering, estimated look input, persistence and failure cleanup through the
 * shared Diagetic session runtime, exercised with the example joystick.
 *
 * @module bedform/Test/DiageticCustom.test
 *
 * @file      DiageticCustom.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped event tests retain contextual inference and transaction ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "bedform/Diagetic";
import type { Dimension, Entity, Player } from "@minecraft/server";
import { Joystick, JoystickConfiguration, StickProperty } from "./DiageticCustomExample.mjs";
import Assert from "node:assert/strict";
import { Harness } from "./DiageticHarness.mjs";
import { ReadJournal } from "../Source/Internal/DiageticRecovery.js";
import type { Stick } from "./DiageticCustomExample.mjs";
import { test } from "node:test";

type Overrides = Partial<D.Custom.Configuration<Stick>>;

/**
 * Composes the example's hooks with logging into the harness call order.
 *
 * @category Testing
 * @since 1.0.0
 */
const Instrument = (h: ReturnType<typeof Harness>, overrides: Overrides = {}): D.Custom.Definition<Stick> =>
{
    const base = JoystickConfiguration;
    const log = (name: string): void =>
    {
        h.calls.push("hook:" + name);
    };

    return D.Custom.Make<Stick>({ ...base,
        Eligible: () =>
        {
            log("eligible");
            return true;
        },
        Acquire: (event) =>
        {
            log("acquire");
            return base.Acquire!(event);
        },
        Look: (event) =>
        {
            log(event.Estimated ? "look:estimated" : "look");
            return base.Look!(event);
        },
        Simulate: (event) =>
        {
            log(event.Estimated ? "simulate:estimated" : "simulate");
            return base.Simulate!(event);
        },
        Release: (event) =>
        {
            log("release:" + (event.Reason ?? "use"));
            return base.Release!(event);
        },
        Save: (value) =>
        {
            log("save");
            return base.Save(value);
        },
        Publish: (event) =>
        {
            log("publish:" + event.Source);
            base.Publish!(event);
        },
        OnChange: (event) => log("change:" + event.Source),
        ...overrides });
};

/**
 * Starts one loaded joystick with a player in front of it and drains deferred startup work.
 *
 * @category Testing
 * @since 1.0.0
 */
const Setup = (overrides: Overrides = {}) =>
{
    const h = Harness();
    const a = h.player("a");
    const actor = h.actor("stick", "example:joystick");
    const definition = Instrument(h, overrides);
    const runtime = D.Start({ ...h.options,
        Controls: [ definition ] });
    h.advance();
    return { h,
        a,
        actor,
        definition,
        runtime,
        handle: definition.Attach(actor.entity) };
};

/**
 * Delivers native-shaped entity Use and advances its deferred mutable phase.
 *
 * @category Testing
 * @since 1.0.0
 */
const Use = (h: ReturnType<typeof Harness>, player: Player, target: Entity): void =>
{
    const event = { player,
        target,
        cancel: false };
    h.before.playerInteractWithEntity.emit(event);
    Assert.equal(event.cancel, true);
    h.advance();
};

/**
 * Asserts the player's camera, body, permissions, prompt, journal and ownership were all restored.
 *
 * @category Testing
 * @since 1.0.0
 */
const Restored = (h: ReturnType<typeof Harness>, a: ReturnType<ReturnType<typeof Harness>["player"]>,
    actor: ReturnType<ReturnType<typeof Harness>["actor"]>, runtime: D.Runtime): void =>
{
    Assert.equal(runtime.IsInteracting(a.player), false);
    Assert.equal(a.data.active, false);
    Assert.equal(a.data.bodyLocked, false);
    Assert.equal(a.data.prompt, "");
    Assert.ok([ ...a.permissions.values() ].every(Boolean));
    Assert.equal(ReadJournal(h.world, a.player.id), undefined);
    Assert.equal(a.tags.size + actor.tags.size, 0);
};

/**
 * Returns the index of a recorded call, failing when it is absent.
 *
 * @category Testing
 * @since 1.0.0
 */
const At = (h: ReturnType<typeof Harness>, name: string, from = 0): number =>
{
    const index = h.calls.indexOf(name, from);
    Assert.ok(index >= 0, `missing call ${name}`);
    return index;
};

/**
 * Reads the example's persisted custom record.
 *
 * @category Testing
 * @since 1.0.0
 */
const Record = (actor: ReturnType<ReturnType<typeof Harness>["actor"]>) =>
{
    return JSON.parse(String(actor.properties.get(D.Keys.DynamicProperty.Control)));
};

test("custom hooks run in session order and reuse ownership, camera and restoration", () =>
{
    const { h, a, actor, handle, runtime } = Setup();
    try
    {
        Assert.deepEqual(actor.synchronized.get(StickProperty.X), 0);
        Assert.deepEqual(Record(actor), { Version: 1,
            Kind: "custom",
            Value: { X: 0,
                Y: 0 },
            Pose: handle.Pose });
        const start = h.calls.length;
        Use(h, a.player, actor.entity);
        Assert.ok(runtime.IsInteracting(a.player));
        Assert.equal(a.data.prompt, D.Keys.ReleasePrompt);
        const acquire = At(h, "hook:acquire", start);
        const journal = "write:" + D.Keys.DynamicPropertyPrefix.Recovery + "a";
        Assert.ok(At(h, "hook:eligible", start) < At(h, journal, start));
        Assert.ok(At(h, journal, start) < At(h, "a:lock", start));
        Assert.ok(At(h, "a:lock", start) < acquire);
        Assert.ok(acquire < At(h, "hook:publish:acquire", start));
        Assert.ok(At(h, "hook:publish:acquire", start) < At(h, "hook:change:acquire", start));
        Assert.ok(At(h, "hook:change:acquire", start) < At(h, "a:camera", start));
        Assert.ok(handle.Motion.State.Held);
        Assert.deepEqual(handle.Value.Pointer, { x: 0,
            y: 0 });

        const tick = h.calls.length;
        a.data.rotation = { x: -1,
            y: 182 };
        h.advance();
        Assert.ok(At(h, "hook:look", tick) < At(h, "hook:simulate", tick));
        const look = At(h, "hook:look", tick);
        const simulate = At(h, "hook:simulate", tick);
        Assert.ok(look < At(h, "hook:publish:input", look) && At(h, "hook:publish:input", look) < simulate);
        Assert.ok(simulate < At(h, "hook:publish:input", simulate));
        Assert.ok(At(h, "hook:publish:input", simulate) < At(h, "hook:change:input", simulate));
        Assert.ok(handle.Value.X > 0 && handle.Value.Y > 0);
        Assert.equal(actor.synchronized.get(StickProperty.X), handle.Value.X);
        Assert.deepEqual(Record(actor).Value, { X: handle.Value.X,
            Y: handle.Value.Y });

        const release = h.calls.length;
        Use(h, a.player, actor.entity);
        Assert.ok(At(h, "hook:release:use", release) < At(h, "a:unlock", release));
        Restored(h, a, actor, runtime);
        Assert.equal(handle.Value.Pointer, undefined);
        h.advance(40);
        Assert.deepEqual(handle.Value, { X: 0,
            Y: 0 });
        Assert.ok(handle.Motion.State.Settled);
        Assert.equal(actor.synchronized.get(StickProperty.X), 0);
        Assert.equal(h.calls.filter((call) => call.startsWith("hook:release")).length, 1);
        const settled = h.calls.length;
        h.advance(5);
        Assert.equal(h.calls.slice(settled).filter((call) => call.startsWith("hook:")).length, 0);
        Assert.deepEqual(h.errors, []);
        Assert.equal(h.actors.size, 1);
    }
    finally
    {
        runtime.Dispose();
        Assert.equal(h.subscriptions(), 0);
        Assert.equal(h.intervals.size, 0);
    }
});

test("correction-gap look samples reach the hooks with their estimate marker", () =>
{
    const { h, a, actor, handle, runtime } = Setup();
    try
    {
        Use(h, a.player, actor.entity);
        a.data.rotation = { x: 1,
            y: 181 };
        h.advance();
        Assert.equal(handle.Motion.State.Estimated, false);
        const tick = h.calls.length;
        a.data.rotation = { x: 86,
            y: 182 };
        h.advance();
        Assert.ok(At(h, "hook:look:estimated", tick) < At(h, "hook:simulate:estimated", tick));
        Assert.ok(handle.Motion.State.Estimated);
        Assert.deepEqual(a.data.rotation, { x: 0,
            y: 182 });
        Use(h, a.player, actor.entity);
        Assert.equal(handle.Motion.State.Estimated, false);
        Restored(h, a, actor, runtime);
    }
    finally
    {
        runtime.Dispose();
    }

    const frame: D.Simulation.Frame = { Camera: { Position: { x: 0,
        y: 0,
        z: 2 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Forward: { x: 0,
        y: 0,
        z: -1 } },
    Mount: { Position: { x: 0,
        y: 0,
        z: 0 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Normal: { x: 0,
        y: 0,
        z: 1 } } };
    const origin = { x: 0,
        y: 0 };
    const full = D.Simulation.MovePointer(frame, origin, { x: 2,
        y: -2 })!;
    const half = D.Simulation.MovePointer(frame, origin, { x: 2,
        y: -2 }, 0.5)!;
    Assert.ok(full.x > half.x && half.x > 0 && full.y > half.y && half.y > 0);
    const floor: D.Simulation.Frame = { Camera: { ...frame.Camera,
        Position: { x: 0,
            y: 1,
            z: 2 } },
    Mount: { ...frame.Mount,
        Up: { x: 0,
            y: 0,
            z: -1 },
        Normal: { x: 0,
            y: 1,
            z: 0 } } };
    Assert.ok(D.Simulation.MovePointer(floor, origin, { x: 0,
        y: 10 }));
    Assert.equal(D.Simulation.MovePointer(floor, origin, { x: 0,
        y: -60 }), undefined);
    Assert.throws(() => D.Simulation.MovePointer(frame, origin, { x: Number.NaN,
        y: 0 }), RangeError);
    Assert.throws(() => D.Simulation.MovePointer(frame, origin, origin, -1), RangeError);
});

test("Save/Load persist only durable fields, restore released and fail closed on bad records", () =>
{
    const { h, a, actor, handle, runtime } = Setup();
    Use(h, a.player, actor.entity);
    a.data.rotation = { x: 2,
        y: 178 };
    h.advance();
    const deflection = { X: handle.Value.X,
        Y: handle.Value.Y };
    Assert.ok(deflection.X < 0 && deflection.Y < 0);
    const saved = String(actor.properties.get(D.Keys.DynamicProperty.Control));
    Assert.ok(!saved.includes("Pointer"));
    runtime.Dispose();
    Restored(h, a, actor, runtime);
    Assert.equal(h.calls.filter((call) => call === "hook:release:disposed").length, 1);

    const writes = h.calls.filter((call) => call.startsWith("stick:write:")).length;
    const wrapper = { ...actor.native } as unknown as Entity;
    const reloaded = D.Custom.Make({ ...JoystickConfiguration }).Attach(wrapper);
    Assert.deepEqual(reloaded.Value, deflection);
    Assert.deepEqual(reloaded.Motion.State, { Held: false,
        Settled: false,
        Estimated: false });
    Assert.equal(h.calls.filter((call) => call.startsWith("stick:write:")).length, writes);
    Assert.equal(actor.properties.get(D.Keys.DynamicProperty.Control), saved);
    const copy = (): Entity => ({ ...actor.native }) as unknown as Entity;
    Assert.throws(() => D.Slider({ EntityType: "example:joystick" }).Attach(copy()),
        /Unsupported or malformed/u);

    const corrupt = JSON.stringify({ ...JSON.parse(saved),
        Value: { X: 4,
            Y: 0 } });
    actor.properties.set(D.Keys.DynamicProperty.Control, corrupt);
    Assert.throws(() => D.Custom.Make({ ...JoystickConfiguration }).Attach(copy()),
        RangeError);
    Assert.equal(actor.properties.get(D.Keys.DynamicProperty.Control), corrupt);

    const spawned = h.actor("spawned", "example:joystick");
    const dimension = { spawnEntity: () => spawned.entity } as unknown as Dimension;
    let initialized = false;
    const control = Joystick.Spawn(dimension, { x: 1,
        y: 2,
        z: 3 }, { Value: { X: 0.5,
        Y: 0 },
    Initialize: (_entity, created) =>
    {
        initialized = true;
        Assert.deepEqual(Record(spawned).Value, { X: 0.5,
            Y: 0 });
        Assert.equal(spawned.synchronized.get(StickProperty.X), 0.5);
        Assert.equal(created.Value.X, 0.5);
    } });
    Assert.ok(initialized && control.IsValid);
    control.SetValue({ X: 0,
        Y: -1 });
    Assert.deepEqual(Record(spawned).Value, { X: 0,
        Y: -1 });
    Assert.equal(spawned.synchronized.get(StickProperty.Y), -1);
    Assert.throws(() => control.SetValue(undefined as unknown as Stick), TypeError);
    Assert.deepEqual(h.errors, []);
});

test("hook and storage failures cancel through Release once and always restore the player", () =>
{
    let fail = true;
    {
        const { h, a, actor, handle, runtime } = Setup({ Acquire: (event) =>
        {
            h.calls.push("hook:acquire");
            if (fail)
            {
                throw new Error("acquire");
            }

            return JoystickConfiguration.Acquire!(event);
        } });
        Use(h, a.player, actor.entity);
        Restored(h, a, actor, runtime);
        Assert.equal(handle.Motion.State.Held, false);
        Assert.ok(!h.calls.some((call) => call.startsWith("hook:release")));
        Assert.match(String(h.errors[0]), /acquire/u);
        fail = false;
        Use(h, a.player, actor.entity);
        Assert.ok(runtime.IsInteracting(a.player));
        runtime.Dispose();
        Restored(h, a, actor, runtime);
        Assert.deepEqual(h.calls.filter((call) => call.startsWith("hook:release")),
            [ "hook:release:disposed" ]);
    }

    {
        const { h, a, actor, runtime } = Setup({ Look: () =>
        {
            throw new Error("look");
        } });
        Use(h, a.player, actor.entity);
        h.advance();
        Restored(h, a, actor, runtime);
        Assert.deepEqual(h.calls.filter((call) => call.startsWith("hook:release")), [ "hook:release:error" ]);
        Assert.match(String(h.errors[0]), /look/u);
        runtime.Dispose();
    }

    {
        const { h, a, actor, runtime } = Setup({ Release: () =>
        {
            h.calls.push("hook:release");
            throw new Error("release");
        } });
        Use(h, a.player, actor.entity);
        Use(h, a.player, actor.entity);
        Restored(h, a, actor, runtime);
        Assert.equal(h.calls.filter((call) => call === "hook:release").length, 1);
        Assert.ok(h.errors[0] instanceof AggregateError);
        runtime.Dispose();
    }

    {
        const { h, a, actor, handle, runtime } = Setup();
        Use(h, a.player, actor.entity);
        h.faults.set("stick:write:" + D.Keys.DynamicProperty.Control, 1);
        a.data.rotation = { x: 0,
            y: 183 };
        h.advance();
        Assert.deepEqual([ handle.Value.X, handle.Value.Y ], [ 0, 0 ]);
        Assert.deepEqual(Record(actor).Value, { X: 0,
            Y: 0 });
        Restored(h, a, actor, runtime);
        Assert.deepEqual(h.calls.filter((call) => call.startsWith("hook:release")), [ "hook:release:error" ]);
        Assert.equal(h.errors.length, 1);
        runtime.Dispose();
    }

    {
        const { h, a, actor, handle, runtime } = Setup({ Simulate: () =>
            ({}) as D.Custom.SimulateResult<Stick> });
        Use(h, a.player, actor.entity);
        h.advance();
        Restored(h, a, actor, runtime);
        Assert.ok(h.errors[0] instanceof TypeError);
        Assert.equal(handle.Motion.State.Held, false);
        runtime.Dispose();
    }

    {
        const h = Harness();
        const spawned = h.actor("spawned", "example:joystick");
        const dimension = { spawnEntity: () => spawned.entity } as unknown as Dimension;
        const definition = Instrument(h, { Publish: () =>
        {
            throw new Error("publish");
        } });
        Assert.throws(() => definition.Spawn(dimension, { x: 0,
            y: 0,
            z: 0 }), /publish/u);
        Assert.equal(spawned.native.isValid, false);
    }
});

test("custom definitions validate inertly and register alongside built-in controls", () =>
{
    const unexpected = (): never =>
    {
        throw new Error("constructor invoked a hook");
    };

    const inert = D.Custom.Make<number>({ EntityType: "example:inert",
        Initial: 0,
        Acquire: unexpected,
        Save: unexpected,
        Load: unexpected,
        Publish: unexpected });
    Assert.equal(inert.Kind, "custom");
    Assert.ok(Object.isFrozen(inert) && Object.isFrozen(inert.Configuration));
    Assert.equal(inert.Configuration.InteractionRange, 3);
    Assert.throws(() => D.Custom.Make({ EntityType: "example:x",
        Initial: 0 } as D.Custom.Configuration<number>), TypeError);
    Assert.throws(() => D.Custom.Make({ EntityType: "bad type",
        Initial: 0,
        Save: Number,
        Load: Number }), TypeError);
    Assert.throws(() => D.Custom.Make({ EntityType: "example:x",
        Initial: undefined as unknown as number,
        Save: Number,
        Load: Number }), TypeError);
    Assert.throws(() => D.Custom.Make({ EntityType: "example:x",
        Initial: 0,
        Save: Number,
        Load: Number,
        Look: 1 as unknown as undefined }), TypeError);
    Assert.throws(() => D.Custom.Make({ EntityType: "example:x",
        Initial: 0,
        InteractionRange: 0,
        Save: Number,
        Load: Number }), RangeError);

    const h = Harness();
    const a = h.player("a");
    const slider = h.actor("slider");
    const stick = h.actor("stick", "example:joystick");
    const custom = Instrument(h);
    Assert.throws(() => D.Start({ ...h.options,
        Controls: [ { ...custom } ] }), TypeError);
    Assert.throws(() => D.Start({ ...h.options,
        Controls: [ custom, Instrument(h) ] }), TypeError);
    const runtime = D.Start({ ...h.options,
        Controls: [ D.Slider(), custom ] });
    try
    {
        h.advance();
        Use(h, a.player, stick.entity);
        Assert.ok(runtime.IsInteracting(a.player));
        Use(h, a.player, slider.entity);
        Assert.equal(runtime.IsInteracting(a.player), false);
        Use(h, a.player, slider.entity);
        Assert.ok(runtime.IsInteracting(a.player));
        Use(h, a.player, slider.entity);
        Restored(h, a, slider, runtime);
        Assert.deepEqual(h.errors, []);
    }
    finally
    {
        runtime.Dispose();
    }
});

test("the driver invokes hooks in order without a runtime and releases exactly once", () =>
{
    const h = Harness();
    const actor = h.actor("stick", "example:joystick");
    const handle = Instrument(h).Attach(actor.entity);
    const frame: D.Simulation.Frame = { Camera: { Position: { x: 0,
        y: 1.5,
        z: 2 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Forward: { x: 0,
        y: 0,
        z: -1 } },
    Mount: { Position: { x: 0,
        y: 1.5,
        z: 0 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Normal: { x: 0,
        y: 0,
        z: 1 } } };
    Assert.throws(() => handle.Motion.Look({ Delta: { x: 1,
        y: 0 } }), /active drag/u);
    const start = h.calls.length;
    handle.Motion.Begin(frame);
    handle.Motion.Look({ Delta: { x: 1,
        y: 0 },
    Estimated: true });
    Assert.equal(handle.Motion.Step().Held, true);
    handle.Motion.Release(undefined, "outOfRange");
    handle.Motion.Release();
    const hooks = h.calls.slice(start).filter((call) => call.startsWith("hook:") &&
        !call.startsWith("hook:save") && !call.startsWith("hook:publish") && !call.startsWith("hook:change"));
    Assert.deepEqual(hooks, [ "hook:acquire", "hook:look:estimated", "hook:simulate:estimated",
        "hook:release:outOfRange" ]);
    Assert.throws(() => handle.Motion.Begin({ ...frame,
        Mount: { ...frame.Mount,
            Normal: { x: 0,
                y: 1,
                z: 0 } } }), RangeError);
    Assert.equal(handle.Motion.State.Held, false);
    handle.Remove();
    handle.Remove();
    Assert.equal(handle.IsValid, false);
    Assert.throws(() => handle.Motion.Step(), /no longer refers/u);
});
