/**
 * Inert control construction, native spawn forwarding, live handles and explicit registration tests.
 *
 * @module bedform/Test/Diagetic.test
 *
 * @file      Diagetic.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped test doubles retain contextual inference and semantic assertion ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "bedform/Diagetic";
import type { Dimension, Direction, Entity } from "@minecraft/server";
import Assert from "node:assert/strict";
import { Harness } from "./DiageticHarness.mjs";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/**
 * Supplies a valid native actor whose removal can fail once.
 *
 * @category Testing
 * @since 1.0.0
 */
const actor = (typeId = "bedform:diagetic_lever") =>
{
    const properties = new Map<string, unknown>();
    const native = { typeId,
        getDynamicProperty: (key: string) => properties.get(key),
        getProperty: (): undefined => undefined,
        setDynamicProperty: (key: string, value: unknown) => properties.set(key, value),
        isValid: true,
        removals: 0,
        fail: false,
        remove(): void
        {
            native.removals++;
            if (native.fail)
            {
                native.fail = false;
                throw new Error("remove failed");
            }

            native.isValid = false;
        } };
    return { native,
        entity: native as unknown as Entity };
};

/**
 * Deterministic native dependencies for explicit runtime registration and teardown.
 *
 * @category Testing
 * @since 1.0.0
 */
const host = () =>
{
    return Harness().options;
};

test("constructors normalize immutable policies without calling user code or touching the host", () =>
{
    const unexpected = (): never =>
    {
        throw new Error("Callback invoked during construction");
    };

    const input = { Kind: "lever" as const,
        Limits: { Min: -1,
            Max: 2 },
        Detents: [ -1, 0, 2 ],
        Spring: { Target: 0,
            Strength: 3 },
        Eligible: unexpected,
        OnGrab: unexpected,
        OnChange: unexpected,
        OnRelease: unexpected,
        OnCancel: unexpected };
    const lever = D.Make(input);
    input.Limits.Min = -5;
    input.Detents.push(100);
    input.Spring.Target = 1;
    Assert.equal(lever.Kind, "lever");
    Assert.equal(lever.EntityType, "bedform:diagetic_lever");
    Assert.equal(lever.Configuration.InitialValue, -1);
    Assert.deepEqual(lever.Configuration.Limits, { Min: -1,
        Max: 2 });
    Assert.deepEqual(lever.Configuration.Detents, [ -1, 0, 2 ]);
    Assert.equal(lever.Configuration.Spring!.Target, 0);
    for (const value of [ lever, lever.Configuration, lever.Configuration.Limits,
        lever.Configuration.Detents, lever.Configuration.Spring ])
    {
        Assert.ok(Object.isFrozen(value));
    }

    Assert.deepEqual(D.Lever().Configuration.Detents, [ 0, 1 ]);
    Assert.deepEqual(D.Slider().Configuration.Detents, []);
    Assert.equal(D.Slider().Configuration.Spring, undefined);
    Assert.equal(D.Wheel().Configuration.Limits, undefined);
    Assert.equal(D.Wheel().Configuration.Radius, 0.25);
    Assert.equal(D.Make({ Kind: "wheel",
        InitialValue: -720 }).Configuration.InitialValue, -720);
});

test("untyped malformed policies are rejected before any native operation", () =>
{
    for (const value of [ null, { Kind: "button" }, { Kind: "toString" },
        { Kind: "lever",
            EntityType: "invalid" }, { Kind: "lever",
            OnGrab: true },
        { Kind: "lever",
            Detents: "invalid" } ])
    {
        Assert.throws(() => D.Make(value as D.Configuration), TypeError);
    }

    for (const options of [ { InitialValue: NaN }, { InitialValue: 2 }, { Sensitivity: -1 },
        { Inertia: 0 }, { Damping: Infinity }, { Friction: -1 }, { InteractionRange: 0 },
        { Limits: { Min: 1,
            Max: 1 } }, { Detents: [ 2 ] },
        { Spring: { Target: NaN,
            Strength: 1 } }, { Spring: { Target: 0,
            Strength: -1 } } ])
    {
        Assert.throws(() => D.Lever(options), RangeError);
    }

    Assert.throws(() => D.Wheel({ Radius: 0.1,
        DeadZone: 0.1 }), RangeError);
    Assert.throws(() => D.Slider({ Length: 0 }), RangeError);
    Assert.throws(() => D.Lever({ ArcDegrees: 0 }), RangeError);
});

test("spawn preserves native options and snapshots value, pose and binding before initialization", () =>
{
    const { native, entity } = actor("fixture:slider");
    const calls: Array<unknown> = [];
    const dimension = { spawnEntity: (...args: Array<unknown>) =>
    {
        calls.push(args);
        return entity;
    } } as unknown as Dimension;
    const pose = { Offset: { x: 1,
        y: 2,
        z: 3 },
    Rotation: { x: 90,
        y: 0,
        z: 0 } };
    const binding: D.BlockBinding = { Dimension: "minecraft:overworld",
        Position: { x: 0,
            y: 1,
            z: 2 },
        Face: "North" as Direction,
        ExpectedBlockType: "minecraft:stone" };
    let initialized = false;
    const definition = D.Slider({ EntityType: "fixture:slider",
        InitialValue: 0.2 });
    const handle = definition.Spawn(dimension, { x: 4,
        y: 5,
        z: 6 }, {
        initialPersistence: true,
        initialRotation: 75,
        spawnEvent: "fixture:ready",
        Value: 0.6,
        Pose: pose,
        Binding: binding,
        Initialize: (spawned, control) =>
        {
            Assert.equal(spawned, entity);
            Assert.equal(control.Value, 0.6);
            initialized = true;
        }
    });
    Assert.ok(initialized);
    Assert.equal(handle.Entity, entity);
    Assert.equal(handle.Definition, definition);
    Assert.deepEqual(calls, [ [ "fixture:slider", { x: 4,
        y: 5,
        z: 6 },
    { initialPersistence: true,
        initialRotation: 75,
        spawnEvent: "fixture:ready" } ] ]);
    pose.Offset.x = 10;
    Assert.equal(handle.Pose.Offset.x, 1);
    Assert.notEqual(handle.Binding, binding);
    Assert.ok(Object.isFrozen(handle.Binding!.Position));
    Assert.equal(native.removals, 0);
    Assert.equal(definition.Attach(entity).Value, 0.6);
});

test("attachments share live state, reject competing definitions, and propagate committed changes", () =>
{
    const { native, entity } = actor();
    const changes: Array<D.ChangeEvent> = [];
    const definition = D.Lever({ OnChange: (event) => changes.push(event) });
    const handle = definition.Attach(entity);
    const another = definition.Attach(entity);
    Assert.ok(handle.IsValid);
    Assert.throws(() => D.Lever().Attach(entity), /another definition/);
    handle.SetValue(0.5);
    Assert.equal(another.Value, 0.5);
    another.SetValue(0.5);
    Assert.equal(changes.length, 1);
    Assert.equal(changes[0].Control, handle);
    Assert.equal(changes[0].PreviousValue, 0);
    Assert.equal(changes[0].Value, 0.5);
    Assert.equal(changes[0].Source, "programmatic");
    Assert.throws(() => handle.SetValue(Infinity), RangeError);
    Assert.throws(() => handle.SetValue(2), RangeError);
    Assert.equal(handle.Value, 0.5);
    native.fail = true;
    Assert.throws(() => handle.Remove(), /remove failed/);
    Assert.ok(handle.IsValid);
    handle.Remove();
    another.Remove();
    Assert.equal(native.removals, 2);
    Assert.equal(another.IsValid, false);
    Assert.throws(() => another.SetValue(0), /valid entity/);
    Assert.throws(() => definition.Attach(entity), /valid entity/);
    Assert.throws(() => definition.Attach(actor("fixture:wrong").entity), /configured type/);
});

test("callback failures preserve committed values and failed initialization rolls back only new actors", () =>
{
    const existing = actor();
    const definition = D.Lever({ OnChange: () =>
    {
        throw new Error("change failed");
    } });
    const handle = definition.Attach(existing.entity);
    Assert.throws(() => handle.SetValue(1), /change failed/);
    Assert.equal(handle.Value, 1);
    Assert.equal(existing.native.removals, 0);
    const created = actor();
    const dimension = { spawnEntity: () => created.entity } as unknown as Dimension;
    let leaked: D.Handle | undefined;
    Assert.throws(() => definition.Spawn(dimension, { x: 0,
        y: 0,
        z: 0 }, {
        Initialize: (_entity, control) =>
        {
            leaked = control;
            throw new Error("init failed");
        }
    }), /init failed/);
    Assert.equal(created.native.removals, 1);
    Assert.equal(leaked!.IsValid, false);
    Assert.ok(handle.IsValid);
});

test("spawn validation precedes creation and rollback failures preserve both errors", () =>
{
    const definition = D.Lever();
    let spawned = 0;
    const created = actor();
    const dimension = { spawnEntity: () =>
    {
        spawned++;
        return created.entity;
    } } as unknown as Dimension;
    Assert.throws(() => definition.Spawn(dimension, { x: 0,
        y: 0,
        z: 0 }, { Value: NaN }), RangeError);
    Assert.throws(() => definition.Spawn(dimension, { x: NaN,
        y: 0,
        z: 0 }), RangeError);
    Assert.throws(() => definition.Spawn(dimension, { x: 0,
        y: 0,
        z: 0 }, {
        Binding: { Dimension: "overworld",
            Face: "Up" as Direction,
            Position: { x: 0.5,
                y: 0,
                z: 0 },
            ExpectedBlockType: "minecraft:stone" }
    }), RangeError);
    Assert.equal(spawned, 0);
    created.native.fail = true;
    Assert.throws(() => definition.Spawn(dimension, { x: 0,
        y: 0,
        z: 0 }, {
        Initialize: () =>
        {
            throw new Error("init failed");
        }
    }), (error: unknown) => error instanceof AggregateError && error.errors.length === 2);
});

test("Start explicitly validates and copies registrations; disposal leaves attached entities alone", () =>
{
    const controls = [ D.Lever(), D.Slider(), D.Wheel() ];
    const dependencies = host();
    const handle = controls[0].Attach(actor().entity);
    const runtime = D.Start({ ...dependencies,
        Controls: controls });
    controls.length = 0;
    Assert.equal(runtime.Controls.length, 3);
    Assert.ok(Object.isFrozen(runtime.Controls));
    Assert.equal(runtime.Disposed, false);
    runtime.Dispose();
    runtime.Dispose();
    Assert.equal(runtime.Disposed, true);
    Assert.ok(handle.IsValid);
    Assert.throws(() => D.Start({ ...dependencies,
        Controls: [ D.Lever(), D.Lever() ] }), /unique/);
    Assert.throws(() => D.Start({ ...dependencies,
        Controls: [ {} as D.Definition ] }), /definitions/);
    Assert.throws(() => D.Start({ Controls: [] } as unknown as D.StartOptions), /explicit/);
});

test("both entrypoints bundle without native, Node or browser APIs and constructors stay inert", async () =>
{
    const output = await build({ bundle: true,
        write: false,
        metafile: true,
        format: "iife",
        platform: "neutral",
        target: "es2022",
        stdin: {
            contents: `import { Diagetic } from "bedform";
                import * as Direct from "bedform/Diagetic";
                if (Diagetic.Make !== Direct.Make) throw new Error("different entrypoints");
                const unexpected = () => { throw new Error("user code executed"); };
                globalThis.proof = [Direct.Lever({ OnGrab: unexpected }).Kind,
                    Diagetic.Slider().Kind, Direct.Wheel().Kind].join(",");`,
            resolveDir: fileURLToPath(new URL("..", import.meta.url)) } });
    Assert.ok(Object.keys(output.metafile!.inputs).every((name) =>
        !name.includes("@minecraft/") && !name.includes("/Build/") && !name.startsWith("node:")));
    const sandbox = { proof: "",
        process: undefined,
        console: undefined,
        setTimeout: undefined,
        Buffer: undefined,
        TextEncoder: undefined,
        TextDecoder: undefined,
        URL: undefined };
    runInNewContext(output.outputFiles[0].text, sandbox);
    Assert.equal(sandbox.proof, "lever,slider,wheel");
});
