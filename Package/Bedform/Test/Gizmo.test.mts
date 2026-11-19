/**
 * Inert Gizmo entrypoints, immutable policies and generic target discovery/recovery qualification.
 *
 * @module bedform/Test/Gizmo.test
 *
 * @file      Gizmo.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped fixtures retain contextual inference and semantic ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as G from "bedform/Diagetic/Gizmo";
import Assert from "node:assert/strict";
import type { Player } from "@minecraft/server";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/**
 * Creates developer-owned targets without any native entity or block transform API.
 *
 * @category Testing
 * @since 1.0.0
 */
const fixture = () =>
{
    const transform: G.Transform = { Position: { x: 0,
        y: 0,
        z: 0 },
    Rotation: { x: 0,
        y: 0,
        z: 0,
        w: 1 },
    Scale: { x: 1,
        y: 1,
        z: 1 } };
    const targets = [ { key: "consumer:entity/part",
        valid: true,
        eligible: true,
        hit: { Distance: 2,
            Angle: 0,
            Occluded: false } },
    { key: "consumer:block/object",
        valid: true,
        eligible: true,
        hit: { Distance: 1,
            Angle: 10,
            Occluded: false } } ];
    let calls = 0;
    const adapter: G.Adapter<typeof targets[number]> = {
        Discover: () =>
        {
            calls++;
            return targets;
        },
        Resolve: (key) =>
        {
            calls++;
            return targets.find((target) => target.key === key);
        },
        Key: (target) => target.key,
        IsValid: (target) => target.valid,
        HitTest: (target) => target.hit,
        Read: () => transform,
        ReadDegrees: () => ({ x: 720,
            y: -450,
            z: 0 }),
        Parent: () => transform,
        Apply: () => { throw new Error("Discovery must never apply transforms"); } };
    const configuration: G.Configuration<typeof targets[number]> = { Id: "consumer:editor",
        Items: [ "consumer:wand" ],
        Modes: [ "scale", "translation", "rotation" ],
        Adapter: adapter,
        Eligible: (_player, target) => target.eligible };
    const query: G.Query = { Player: { id: "player" } as Player,
        Dimension: "minecraft:overworld",
        Origin: { x: 0,
            y: 0,
            z: 0 },
        Direction: { x: 0,
            y: 0,
            z: 1 } };
    return { transform,
        targets,
        adapter,
        configuration,
        query,
        calls: () => calls };
};

test("all import forms and Make run without native modules or host globals", async () =>
{
    const result = await build({ stdin: { contents: `
        import { Diagetic } from "bedform";
        import * as Direct from "bedform/Diagetic";
        import * as Gizmo from "bedform/Diagetic/Gizmo";
        const unexpected = () => { throw new Error("constructor invoked adapter"); };
        const adapter = Object.fromEntries(["Discover", "Resolve", "Key", "IsValid", "HitTest",
            "Read", "ReadDegrees", "Parent", "Apply"].map(key => [key, unexpected]));
        const definition = Gizmo.Make({ Id: "test:editor", Items: ["test:wand"],
            Modes: ["rotation", "scale"], Adapter: adapter, OnPreview: unexpected });
        globalThis.result = Diagetic.Gizmo.Make === Direct.Gizmo.Make &&
            Direct.Gizmo.Make === Gizmo.Make && definition.InitialMode === "rotation";
    `,
    resolveDir: process.cwd() },
    bundle: true,
    format: "iife",
    platform: "neutral",
    write: false });
    const context = { result: false };
    runInNewContext(result.outputFiles[0].text, context);
    Assert.equal(context.result, true);
    Assert.ok(!result.outputFiles[0].text.includes("from \"@minecraft/server\""));
});

test("Make snapshots defaults, enabled ordering, scale policies and complete private hooks", () =>
{
    const f = fixture();
    const degrees = { Min: -720,
        Max: 1_080 };
    const definition = G.Make({ ...f.configuration,
        Rotation: { Bounds: { Actual: { x: degrees } } },
        Preview: { Visibility: "private",
            Create: () => "preview",
            Update: () => {},
            Dispose: () => {} } });
    Assert.equal(f.calls(), 0);
    Assert.equal(definition.InitialMode, "scale");
    Assert.deepEqual(definition.Modes, [ "scale", "translation", "rotation" ]);
    Assert.equal(definition.Configuration.InteractionRange, 3);
    Assert.equal(definition.Configuration.TargetingAngle, 15);
    Assert.equal(definition.Configuration.Measurements, true);
    Assert.equal(definition.Configuration.AllowWalking, false);
    Assert.equal(definition.Configuration.Cycle, false);
    Assert.equal(definition.Configuration.Review, false);
    Assert.equal(definition.Configuration.Physics, undefined);
    Assert.equal(definition.Configuration.Translation?.Snap, undefined);
    Assert.equal(definition.Configuration.Abandonment?.Outcome, "cancel");
    Assert.equal(definition.Configuration.Abandonment?.TimeoutSeconds, undefined);
    Assert.equal(definition.Configuration.Scale?.Bounds?.Actual?.x?.Min, 0.001);
    degrees.Min = -10;
    Assert.equal(definition.Configuration.Rotation?.Bounds?.Actual?.x?.Min, -720);
    Assert.ok(Object.isFrozen(definition.Configuration.Scale?.Bounds?.Actual?.x));
    Assert.ok(!Object.isFrozen(f.adapter));
    Assert.ok(!Object.isFrozen(f.targets));
    Assert.equal(G.Make({ ...f.configuration,
        Scale: { Bounds: { Actual: { x: { Min: -1 },
            y: { Min: 0 } } } } }).Configuration.Scale?.Bounds?.Actual?.y?.Min, 0);
});

test("malformed policies and incomplete private previews are rejected before any hook runs", () =>
{
    const f = fixture();
    const invalid = [ { Modes: [] }, { Modes: [ "translation", "translation" ] }, { Modes: [ "invalid" ] },
        { Items: [] }, { Items: [ "invalid" ] }, { Items: [ "test:a", "test:a" ] }, { Id: "invalid" },
        { Adapter: {} }, { Adapter: { ...f.adapter,
            ReadDegrees: undefined } },
        { Preview: { Visibility: "private" } },
        { Preview: { Visibility: "private",
            Create: () => ({}),
            Update: () => {} } },
        { Preview: { Visibility: "unknown" } }, { OnPreview: 3 }, { OnCommit: async () => {} },
        { InteractionRange: 0 }, { TargetingAngle: 181 }, { Size: Number.NaN }, { HandleTolerance: -1 },
        { AllowWalking: "yes" }, { TranslationDecimals: 2 }, { ScaleDecimals: 4 },
        { Scale: { Bounds: { Actual: { x: { Max: 0 } } } } },
        { Rotation: { Bounds: { Actual: { y: { Min: 2,
            Max: 1 } } } } },
        { Rotation: { Bounds: { Change: { x: { Min: Infinity } } } } },
        { Translation: { Snap: { Increment: { x: 1,
            y: 0,
            z: 1 } } } },
        { Scale: { Snap: { Increment: { x: 1,
            y: 1,
            z: 1 },
        Origin: "drag" } } },
        { Physics: {} }, { Physics: { Inertia: 1,
            Strength: 1,
            Damping: -1,
            Friction: 0 } },
        { Abandonment: { Outcome: "unknown" } }, { Abandonment: { Overrides: { death: "unknown" } } },
        { Abandonment: { Overrides: { unknown: "commit" } } }, { Abandonment: { TimeoutSeconds: 0 } } ];
    for (const policy of invalid)
    {
        Assert.throws(() => G.Make({ ...f.configuration,
            ...policy } as G.Configuration<unknown>),
        { name: /TypeError|RangeError/u });
    }

    Assert.equal(f.calls(), 0);
});

test("discovery filters invalid or ineligible targets, range, angle and occlusion and ranks hits", () =>
{
    const f = fixture();
    const runtime = G.Start({ Definitions: [ G.Make(f.configuration) ] });
    Assert.equal(f.calls(), 0);
    Assert.deepEqual(runtime.Discover("other:item", f.query), []);
    Assert.deepEqual(runtime.Discover("consumer:wand", f.query).map((candidate) => candidate.Key),
        [ "consumer:entity/part", "consumer:block/object" ]);
    for (const change of [ { valid: false }, { eligible: false },
        { hit: { Distance: 4,
            Angle: 0,
            Occluded: false } },
        { hit: { Distance: 1,
            Angle: 16,
            Occluded: false } },
        { hit: { Distance: 1,
            Angle: 0,
            Occluded: true } } ])
    {
        const original = { ...f.targets[0] };
        Object.assign(f.targets[0], change);
        Assert.equal(runtime.Discover("consumer:wand", f.query).length, 1);
        Object.assign(f.targets[0], original);
    }

    f.targets[1].hit = { Distance: 1,
        Angle: 0,
        Occluded: false };
    Assert.equal(runtime.Discover("consumer:wand", f.query)[0].Key, f.targets[1].key);
    f.targets[0].hit.Distance = Number.NaN;
    Assert.throws(() => runtime.Discover("consumer:wand", f.query), RangeError);
    runtime.Dispose();
    runtime.Dispose();
    Assert.equal(runtime.Disposed, true);
    Assert.throws(() => runtime.Discover("consumer:wand", f.query), /disposed/u);
    Assert.throws(() => runtime.Resolve("consumer:editor", f.targets[0].key), /disposed/u);
});

test("recovery defers unavailable targets, fences changed keys and rejects duplicate registrations", () =>
{
    const f = fixture();
    const definition = G.Make(f.configuration);
    const runtime = G.Start({ Definitions: [ definition ] });
    Assert.equal(runtime.Resolve(definition.Id, f.targets[0].key), f.targets[0]);
    Assert.equal(runtime.Resolve(definition.Id, "missing"), undefined);
    Assert.equal(runtime.Resolve("missing", f.targets[0].key), undefined);
    f.targets[0].valid = false;
    Assert.equal(runtime.Resolve(definition.Id, f.targets[0].key), undefined);
    const wrong = G.Start({ Definitions: [ G.Make({ ...f.configuration,
        Adapter: { ...f.adapter,
            Resolve: () => f.targets[1] } }) ] });
    Assert.throws(() => wrong.Resolve(definition.Id, f.targets[0].key), /different stable/u);
    Assert.throws(() => G.Start({ Definitions: [ definition, definition ] }), TypeError);
    Assert.throws(() => G.Start({ Definitions: [ definition,
        G.Make({ ...f.configuration,
            Id: "consumer:other" }) ] }), /unique/u);
    Assert.throws(() => G.Start({ Definitions: [],
        Presentation: {} as G.Presentation }), TypeError);
    runtime.Dispose();
    wrong.Dispose();
});

test("transform snapshots preserve component scale through zero and reject malformed orientations", () =>
{
    const f = fixture();
    const snapshot = G.Snapshot({ ...f.transform,
        Scale: { x: -1,
            y: 0,
            z: 2 } });
    Assert.deepEqual(snapshot.Scale, { x: -1,
        y: 0,
        z: 2 });
    Assert.ok(Object.isFrozen(snapshot.Rotation));
    Assert.throws(() => G.Snapshot({ ...f.transform,
        Rotation: { x: 0,
            y: 0,
            z: 0,
            w: 0 } }), RangeError);
    Assert.throws(() => G.Snapshot({ ...f.transform,
        Position: { x: Infinity,
            y: 0,
            z: 0 } }), RangeError);
    Assert.deepEqual(G.UseComponents(), { "minecraft:use_modifiers": {
        use_duration: 3_600,
        movement_modifier: 1,
        start_using: "always" } });
    Assert.throws(() => G.UseComponents(0), RangeError);
});
