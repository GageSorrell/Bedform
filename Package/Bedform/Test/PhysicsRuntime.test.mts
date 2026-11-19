/**
 * Runtime fault injection, retained owner state, terrain and renderer lifecycle.
 *
 * @module bedform/Test/PhysicsRuntime.test
 *
 * @file      PhysicsRuntime.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Independent fixtures preserve contextual types and physical axis ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Runtime from "bedform/PhysicsRuntime";
import * as E from "bedform/PhysicsEntity";
import * as S from "bedform/CollisionShape";
import * as B from "bedform/AABB";
import * as V from "bedform/Vector3";
import * as T from "bedform/Transform";
import * as Q from "bedform/Quat";
import type * as M from "bedform/PhysicsModel";
import type * as Renderer from "bedform/PhysicsRenderer";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import { DynamicProperty, EntityProperty } from "bedform/keys";
import { vanilla, FullCube, coalesce } from "../Source/Internal/PhysicsTerrain.js";
import { save, restore } from "../Source/Internal/PhysicsPersistence.js";
import * as Native from "../Distribution/Internal/PhysicsNative.js";
import * as W from "bedform/PhysicsWorld";
test("observational timing and throwing clock/sinks cannot alter authoritative motion", () =>
{
    const M = model();
    const A = fixture();
    const Bv = fixture();
    const Cv = fixture();
    const Samples: Array<Runtime.TickMetrics> = [];
    const BrokenSamples: Array<Runtime.TickMetrics> = [];
    let time = 0;
    const Plain = R.getOrThrow(Runtime.start({ host: A.host,
        models: [ M ] }));
    const Metered = R.getOrThrow(Runtime.start({ host: Bv.host,
        models: [ M ],
        clock: () =>
        {
            time += 0.125;
            return time;
        },
        metrics: (sample) =>
        {
            Samples.push(sample);
            throw new Error("observer failure");
        } }));
    const Broken = R.getOrThrow(Runtime.start({ host: Cv.host,
        models: [ M ],
        clock: () =>
        {
            throw new Error("clock failure");
        },
        metrics: (sample) => BrokenSamples.push(sample) }));
    const Body = R.getOrThrow(E.make(M, { id: "timed",
        linearVelocity: V.One,
        angularVelocity: V.UnitY }));
    for (const Instance of [ Plain, Metered, Broken ])
    {R.getOrThrow(Instance.spawn(Body, "overworld"));}

    for (let i = 0; i < 8; i++)
    {
        A.tick();
        Bv.tick();
        Cv.tick();
    }

    Assert.deepEqual(Plain.world("overworld")!.bodies[0].pose, Metered.world("overworld")!.bodies[0].pose);
    Assert.deepEqual(Plain.world("overworld")!.bodies[0].pose, Broken.world("overworld")!.bodies[0].pose);
    Assert.equal(Samples.length, 8);
    Assert.ok(Samples.every((sample) => Object.isFrozen(sample) && sample.clockValid && sample.totalMs > 0 && sample.active === 1));
    Assert.ok(BrokenSamples.every((sample) => !sample.clockValid));
    for (const Instance of [ Plain, Metered, Broken ])
    {Instance.dispose();}
});

/**
 * Independent uniform unit box, usable with either representation.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const model = (representation: M.Model["representation"] = "cuboid"): M.Model =>
{
    return { schemaVersion: 1,
        identifier: `test:physics_${representation}`,
        name: representation,
        representation,
        fingerprint: `fixture-${representation}`,
        renderer: representation === "particle" ? "test:particle" : undefined,
        bounds: B.AABBUnsafe(V.scale(V.One, -0.5), V.scale(V.One, 0.5)),
        collision: R.getOrThrow(S.primitive("box", V.scale(V.One, 0.5))),
        sourceGeometry: [],
        sourceCells: [],
        restitution: 0,
        linearVelocity: V.Zero,
        angularVelocity: V.Zero,
        physical: { volume: 1,
            mass: 1,
            centroid: V.Zero,
            centerOfMass: V.Zero,
            inertia: [ 1 / 6, 0, 0, 0, 1 / 6, 0, 0, 0, 1 / 6 ] } };
};

/**
 * Fully controlled engine ports; entity invalidation never destroys persisted bytes.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const fixture = () =>
{
    const Owners: Array<Runtime.Owner> = [];
    const Loads = new Set<(owner: Runtime.Owner) => void>();
    const Removes = new Set<(id: string) => void>();
    const Ticks = new Set<() => void>();
    const States = new Map<string, Map<string, unknown>>();
    const Properties = new Map<string, Array<readonly [
        string,
        number
    ]>>();
    const Valid = new Set<string>();
    let serial = 0;
    let cleans = 0;
    let reads = 0;
    let unavailable = false;
    let writeFailure = false;
    let tickFailure = false;
    let resolver: Runtime.Host["block"] = () => ({ identifier: "minecraft:air",
        states: {},
        solid: false });
    const Host: Runtime.Host = {
        discover: () => Owners.filter((owner) => owner.loaded()),
        spawn: (model, dimension, position) =>
        {
            const Id = String(++serial);
            let currentDimension = dimension;
            let currentPosition = position;
            States.set(Id, new Map());
            Properties.set(Id, []);
            Valid.add(Id);
            const Owner: Runtime.Owner = { id: Id,
                identifier: model.identifier,
                dimension: () => currentDimension,
                position: () => currentPosition,
                loaded: () => Valid.has(Id),
                read: (key) => States.get(Id)!.get(key),
                write: (key, value) =>
                {
                    if (writeFailure)
                    {
                        throw new Error("write failed");
                    }

                    States.get(Id)!.set(key, value);
                },
                property: (key, value) =>
                {
                    Properties.get(Id)!.push([ key, value ]);
                },
                readProperty: (key) => [ ...Properties.get(Id)! ].reverse().find(([ property ]) => property === key)?.[1],
                move: (nextDimension, nextPosition) =>
                {
                    currentDimension = nextDimension;
                    currentPosition = nextPosition;
                },
                remove: () =>
                {
                    Valid.delete(Id);
                    for (const Callback of Removes)
                    {
                        Callback(Id);
                    }
                } };
            Owners.push(Owner);
            return Owner;
        },
        onLoad: (callback) =>
        {
            Loads.add(callback);
            return () =>
            {
                Loads.delete(callback);
            };
        },
        onRemove: (callback) =>
        {
            Removes.add(callback);
            return () =>
            {
                Removes.delete(callback);
            };
        },
        onTick: (callback) =>
        {
            if (tickFailure)
            {
                throw new Error("tick startup failed");
            }

            Ticks.add(callback);
            return () =>
            {
                Ticks.delete(callback);
            };
        },
        block: (dimension, position) =>
        {
            reads++;
            return unavailable ? undefined : resolver(dimension, position);
        },
        cleanupTransients: () =>
        {
            cleans++;
        }
    };
    return { host: Host,
        owners: Owners,
        states: States,
        properties: Properties,
        valid: Valid,
        tick: () =>
        {
            for (const Callback of Ticks)
            {
                Callback();
            }
        },
        load: (owner: Runtime.Owner) =>
        {
            Valid.add(owner.id);
            for (const Callback of Loads)
            {
                Callback(owner);
            }
        },
        setUnavailable: (value: boolean) =>
        {
            unavailable = value;
        },
        setWriteFailure: (value: boolean) =>
        {
            writeFailure = value;
        },
        setTickFailure: (value: boolean) =>
        {
            tickFailure = value;
        },
        setResolver: (value: Runtime.Host["block"]) =>
        {
            resolver = value;
        },
        subscriptions: () => Loads.size + Removes.size + Ticks.size,
        cleans: () => cleans,
        reads: () => reads };
};

/**
 * Test renderer with an observable count of live attachments and exact intervals.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const renderer = () =>
{
    const Intervals: Array<Renderer.Interval> = [];
    let live = 0;
    let attaches = 0;
    let fail = false;
    const Adapter: Renderer.Renderer = { attach: (_model, _id, _dimension, initial) =>
    {
        if (fail)
        {
            throw new Error("Missing renderer asset");
        }

        live++;
        attaches++;
        Intervals.push(initial);
        let disposed = false;
        return { commit: (interval) =>
        {
            Assert.equal(disposed, false);
            Intervals.push(interval);
        },
        rebase: () =>
        {
        },
        pause: () =>
        {
        },
        dispose: () =>
        {
            if (!disposed)
            {
                disposed = true;
                live--;
            }
        } };
    } };
    return { adapter: Adapter,
        intervals: Intervals,
        live: () => live,
        attaches: () => attaches,
        fail: (value: boolean) =>
        {
            fail = value;
        } };
};

for (const Representation of [ "cuboid", "particle" ] as const)
{
    test(`${Representation} runtime starts explicitly, publishes full pose and disposes idempotently`, () =>
    {
        const F = fixture();
        const A = renderer();
        const M = model(Representation);
        Assert.equal(F.subscriptions(), 0);
        const RuntimeInstance = R.getOrThrow(Runtime.start({ host: F.host,
            models: [ M ],
            renderer: A.adapter,
            world: { gravity: V.Zero } }));
        const Rotation = O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(0.2, 0.4, 0.6)));
        const Body = R.getOrThrow(E.make(M, { id: "body",
            angularVelocity: V.Vector3Unsafe(1, 2, 3),
            pose: { position: V.Zero,
                rotation: Rotation } }));
        R.getOrThrow(RuntimeInstance.spawn(Body, "overworld"));
        F.tick();
        const State = RuntimeInstance.world("overworld")!.bodies.find((body) => body.id === "body")!;
        Assert.notDeepEqual(State.pose.rotation, Body.pose.rotation);
        Assert.equal(State.physical.mass, Body.physical.mass);
        Assert.equal(A.live(), 1);
        Assert.equal(A.intervals.at(-1)!.end, State.pose);
        Assert.equal(F.properties.get("1")!.at(-1)![0], EntityProperty.Sequence);
        Assert.deepEqual(F.owners[0].position(), V.Zero);
        Assert.equal(F.subscriptions(), 3);
        RuntimeInstance.dispose();
        RuntimeInstance.dispose();
        Assert.equal(A.live(), 0);
        Assert.equal(F.subscriptions(), 0);
        Assert.equal(F.valid.size, 1);
        Assert.equal(R.isFailure(RuntimeInstance.spawn(Body, "overworld")), true);
    });
}

test("owner restart round-trip retains physical overrides, forces and COM velocity without wall-time replay", () =>
{
    const M = model("particle");
    let body = R.getOrThrow(E.make(M, { id: "saved",
        mass: 4,
        centerOfMass: V.Vector3Unsafe(0.2, 0, 0),
        linearVelocity: V.Vector3Unsafe(1, 2, 3),
        angularVelocity: V.Vector3Unsafe(2, 1, 0),
        gravity: O.some(V.Vector3Unsafe(0, -4, 0)) }));
    body = R.getOrThrow(E.applyForce(body, V.One));
    body = R.getOrThrow(E.applyTorque(body, V.One));
    const Restored = restore(save(body), new Map([ [ M.identifier, M ] ]));
    Assert.deepEqual(Restored.physical, body.physical);
    Assert.deepEqual(Restored.force, body.force);
    Assert.deepEqual(Restored.torque, body.torque);
    Assert.deepEqual(Restored.linearVelocity, body.linearVelocity);
    Assert.deepEqual(Restored.angularVelocity, body.angularVelocity);
    Assert.deepEqual(Restored.pose, body.pose);
    Assert.equal(Restored.interval.start, Restored.interval.end);
    const F = fixture();
    const A = renderer();
    const First = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter }));
    R.getOrThrow(First.spawn(body, "overworld"));
    First.dispose();
    const Second = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter }));
    Assert.deepEqual(Second.world("overworld")!.bodies[0].pose, body.pose);
    F.load(F.owners[0]);
    Second.retry();
    Assert.equal(A.live(), 1);
    Assert.equal(A.attaches(), 2);
    Second.dispose();
    Assert.equal(F.subscriptions(), 0);
});
test("invalid, missing and incompatible catalog states remain byte-for-byte retained", () =>
{
    for (const Kind of [ "schema", "missing", "fingerprint", "malformed" ])
    {
        const F = fixture();
        const M = model();
        const Diagnostics: Array<Runtime.Diagnostic> = [];
        const Owner = F.host.spawn(M, "overworld", V.Zero);
        const State = JSON.parse(save(R.getOrThrow(E.make(M, { id: "retained" }))));
        if (Kind === "schema")
        {
            State.schemaVersion = 2;
        }

        if (Kind === "fingerprint")
        {
            State.model.fingerprint = "old";
        }

        const Text = Kind === "malformed" ? "{" : JSON.stringify(State);
        Owner.write(DynamicProperty.PhysicsState, Text);
        const Instance = R.getOrThrow(Runtime.start({ host: F.host,
            models: Kind === "missing" ? [] : [ M ],
            diagnostic: (value) =>
            {
                Diagnostics.push(value);
                throw new Error("sink failed");
            } }));
        F.tick();
        Instance.dispose();
        Assert.equal(Owner.read(DynamicProperty.PhysicsState), Text);
        Assert.equal(F.valid.size, 1);
        Assert.equal(Diagnostics.length > 0, true);
        Assert.equal(F.subscriptions(), 0);
    }
});
test("startup rollback releases attachments/subscriptions and failed spawn removes its new owner", () =>
{
    const F = fixture();
    const M = model();
    const A = renderer();
    const Owner = F.host.spawn(M, "overworld", V.Zero);
    Owner.write(DynamicProperty.PhysicsState, save(R.getOrThrow(E.make(M, { id: "old" }))));
    F.setTickFailure(true);
    Assert.equal(R.isFailure(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter })), true);
    Assert.equal(F.subscriptions(), 0);
    Assert.equal(A.live(), 0);
    Assert.equal(F.valid.size, 1);
    F.setTickFailure(false);
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ] }));
    F.setWriteFailure(true);
    Assert.equal(R.isFailure(Instance.spawn(R.getOrThrow(E.make(M, { id: "new" })), "overworld")), true);
    Assert.equal(F.valid.size, 1);
    Assert.equal(Instance.world("overworld")!.bodies.length, 1);
    F.setWriteFailure(false);
    Instance.dispose();
});
test("unload/reload, dimension transfer and removal recreate exactly one attachment", () =>
{
    const F = fixture();
    const M = model();
    const A = renderer();
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter,
        world: { gravity: V.Zero } }));
    R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: "body" })), "overworld"));
    F.valid.delete("1");
    F.tick();
    Assert.equal(A.live(), 0);
    F.load(F.owners[0]);
    F.load(F.owners[0]);
    Assert.equal(A.live(), 1);
    R.getOrThrow(Instance.transfer("body", "nether", O.getOrThrow(T.Transform(V.One, Q.Identity))));
    Assert.equal(A.live(), 1);
    Assert.equal(Instance.world("overworld")!.bodies.length, 0);
    Assert.equal(A.intervals.at(-1)!.start, A.intervals.at(-1)!.end);
    R.getOrThrow(Instance.remove("body"));
    R.getOrThrow(Instance.remove("body"));
    Assert.equal(A.live(), 0);
    Assert.equal(F.valid.size, 0);
    Instance.dispose();
});
test("terrain queries are shared per tick; unavailable terrain pauses and resumes without replay", () =>
{
    const F = fixture();
    const M = model();
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        diagnostic: (value) => Diagnostics.push(value),
        world: { gravity: V.Zero } }));
    for (const Id of [ "a", "b" ])
    {
        R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: Id,
            mode: "kinematic",
            linearVelocity: V.One })), "overworld"));
    }

    F.tick();
    const Reads = F.reads();
    Assert.ok(Reads > 0 && Reads < 500);
    const Pose = Instance.world("overworld")!.bodies[0].pose;
    F.setUnavailable(true);
    F.tick();
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, true);
    Assert.deepEqual(Instance.world("overworld")!.bodies[0].pose, Pose);
    F.setUnavailable(false);
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, false);
    Assert.ok(Diagnostics.some((value) => value.code === "UnloadedTerrain"));
    Instance.dispose();
});
test("terrain extensions precede conservative reported fallback and unregister idempotently", () =>
{
    const F = fixture();
    const M = model();
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    F.setResolver((_dimension, position) => position.y === -1 ? { identifier: "test:unknown",
        states: {},
        solid: true } : { identifier: "minecraft:air",
        states: {},
        solid: false });
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        diagnostic: (value) => Diagnostics.push(value) }));
    R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: "body",
        pose: { position: V.Vector3Unsafe(0, 1, 0),
            rotation: Q.Identity } })), "overworld"));
    const Unregister = Instance.registerTerrain((block) => block.identifier === "test:unknown" ? [] : undefined);
    F.tick();
    Assert.equal(Diagnostics.length, 0);
    Unregister();
    Unregister();
    F.tick();
    Assert.ok(Diagnostics.some((value) => value.code === "UnknownBlock"));
    Instance.dispose();
});
test("vanilla permutation boxes distinguish slab halves, gates, doors, thin blocks and neighbor availability", () =>
{
    const Air = (): Runtime.Block => ({ identifier: "minecraft:air",
        states: {},
        solid: false });
    const Boxes = (identifier: string, states: Runtime.Block["states"] = {}) => vanilla({ identifier: `minecraft:${identifier}`,
        states,
        solid: true }, Air)!;
    Assert.equal(Boxes("oak_slab")[0].max.y, 0.5);
    Assert.equal(Boxes("oak_slab", { "minecraft:vertical_half": "top" })[0].min.y, 0.5);
    Assert.equal(Boxes("oak_fence_gate", { open_bit: true }).length, 0);
    Assert.equal(Boxes("snow_layer", { height: 3 })[0].max.y, 3 / 8);
    Assert.equal(Boxes("oak_trapdoor", { open_bit: true })[0].max.y, 1);
    Assert.notDeepEqual(Boxes("oak_door", { open_bit: false }), Boxes("oak_door", { open_bit: true }));
    Assert.equal(Boxes("oak_fence").length, 1);
    Assert.equal(Boxes("glass_pane").length, 1);
    Assert.equal(FullCube[0].max.y, 1);
});
test("native proxies use 80 kg, measured movement and locked angular inertia", () =>
{
    const M = model();
    const Body = R.getOrThrow(E.make(M, { id: "body",
        mode: "static" }));
    let position = V.Vector3Unsafe(2, 0, 0);
    const Bridge = Native.make({ query: () => [ { id: "pig",
        bounds: B.AABBUnsafe(V.subtract(position, V.scale(V.One, 0.5)), V.add(position, V.scale(V.One, 0.5))),
        position,
        velocity: V.One,
        jumping: false,
        impulse: () =>
        {
        },
        move: () => true } ],
    helper: () =>
    {
        throw new Error("No contact expected");
    } }, 0, (error) =>
    {
        throw error;
    });
    let world = R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Body));
    world = Bridge.prepare("overworld", world, new Set([ "body" ]));
    const Proxy = world.bodies.find((body) => body.id === "native:pig")!;
    Assert.equal(Proxy.physical.mass, 80);
    Assert.deepEqual(Proxy.inverseInertia, [ 0, 0, 0, 0, 0, 0, 0, 0, 0 ]);
    position = V.Vector3Unsafe(2.1, 0, 0);
    world = Bridge.prepare("overworld", world, new Set([ "body" ]));
    Assert.ok(Math.abs(world.bodies.find((body) => body.id === "native:pig")!.linearVelocity.x - 2) < 1e-10);
    Bridge.clear();
    Bridge.clear();
});
test("missing renderer assets pause retained motion and resume after repair", () =>
{
    const F = fixture();
    const M = model("particle");
    const A = renderer();
    A.fail(true);
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter,
        world: { gravity: V.Zero } }));
    R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: "body",
        linearVelocity: V.One })), "overworld"));
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, true);
    Assert.deepEqual(Instance.world("overworld")!.bodies[0].pose.position, V.Zero);
    A.fail(false);
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, false);
    Assert.ok(Instance.world("overworld")!.bodies[0].pose.position.x > 0);
    Assert.equal(A.live(), 1);
    Instance.dispose();
});
test("owner packet sequences remain monotonic across disposal and rotate owners before exhaustion", () =>
{
    const F = fixture();
    const M = model();
    let instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        world: { gravity: V.Zero } }));
    R.getOrThrow(instance.spawn(R.getOrThrow(E.make(M, { id: "body",
        linearVelocity: V.One })), "overworld"));
    F.tick();
    const Sequence = F.owners[0].readProperty!(EntityProperty.Sequence) as number;
    instance.dispose();
    instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        world: { gravity: V.Zero } }));
    Assert.ok((F.owners[0].readProperty!(EntityProperty.Sequence) as number) > Sequence);
    instance.dispose();
    F.owners[0].property(EntityProperty.Sequence, 8388600);
    instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        world: { gravity: V.Zero } }));
    Assert.equal(F.valid.size, 1);
    Assert.equal(F.owners.length, 2);
    Assert.equal(F.owners[1].readProperty!(EntityProperty.Sequence), 0);
    F.tick();
    Assert.equal(instance.world("overworld")!.bodies.length, 1);
    instance.dispose();
});
test("duplicate persistent owners are retained without duplicate bodies or attachments", () =>
{
    const F = fixture();
    const M = model();
    const A = renderer();
    const Body = R.getOrThrow(E.make(M, { id: "same" }));
    for (let i = 0; i < 2; i++)
    {
        F.host.spawn(M, "overworld", V.Zero).write(DynamicProperty.PhysicsState, save(Body));
    }

    const Diagnostics: Array<Runtime.Diagnostic> = [];
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter,
        diagnostic: (value) => Diagnostics.push(value) }));
    Assert.equal(A.live(), 1);
    Assert.equal(F.valid.size, 2);
    Assert.equal(Instance.world("overworld")!.bodies.length, 1);
    Assert.ok(Diagnostics.some((value) => value.code === "DuplicateOwner"));
    Instance.dispose();
});
test("terrain budget exhaustion retains and pauses the body with a typed diagnostic", () =>
{
    const F = fixture();
    const M = model();
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        maxTerrainBlocks: 1,
        diagnostic: (value) => Diagnostics.push(value) }));
    R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: "body" })), "overworld"));
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, true);
    Assert.deepEqual(Instance.world("overworld")!.bodies[0].pose.position, V.Zero);
    Assert.ok(Diagnostics.some((value) => value.code === "Terrain"));
    Instance.dispose();
});
test("native contact exchanges linear momentum while separation respects a rejected move", () =>
{
    const M = model();
    const Body = R.getOrThrow(E.make(M, { id: "body",
        linearVelocity: V.Vector3Unsafe(4, 0, 0),
        allowSleep: false }));
    let delta = V.Zero;
    let moves = 0;
    const Bridge = Native.make({ query: () => [ { id: "native",
        position: V.Vector3Unsafe(1.05, -0.5, 0),
        bounds: B.AABBUnsafe(V.Vector3Unsafe(0.55, -0.5, -0.5), V.Vector3Unsafe(1.55, 0.5, 0.5)),
        velocity: V.Zero,
        jumping: false,
        impulse: (value) =>
        {
            delta = V.add(delta, value);
        },
        move: () =>
        {
            moves++;
            return false;
        } } ],
    helper: () =>
    {
        throw new Error("Side contacts do not create support helpers");
    } }, 4, (error) =>
    {
        throw error;
    });
    let world = R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Body));
    world = Bridge.prepare("overworld", world, new Set([ "body" ]));
    world = R.getOrThrow(W.step(world));
    Assert.equal(world.diagnostics.length, 0);
    Bridge.commit("overworld", world, new Set([ "body" ]));
    const Custom = world.bodies.find((body) => body.id === "body")!;
    Assert.ok(delta.x > 0);
    Assert.ok(Math.abs(Custom.linearVelocity.x + 80 * delta.x - 4) < 1e-6);
    Assert.deepEqual(world.bodies.find((body) => body.id === "native:native")!.angularVelocity, V.Zero);
    Assert.ok(moves > 0);
    Bridge.clear();
});
test("body-local support transports native walking, reuses helpers and releases jumping actors", () =>
{
    const M = model();
    let position = V.Vector3Unsafe(0, 0.5, 0);
    let jumping = false;
    let created = 0;
    let live = 0;
    const Bridge = Native.make({ query: () => [ { id: "walker",
        position,
        bounds: B.AABBUnsafe(V.add(position, V.Vector3Unsafe(-0.2, 0, -0.2)), V.add(position, V.Vector3Unsafe(0.2, 1, 0.2))),
        velocity: V.Zero,
        jumping,
        impulse: () =>
        {
        },
        move: (delta) =>
        {
            position = V.add(position, delta);
            return true;
        } } ],
    helper: () =>
    {
        created++;
        live++;
        return { move: () =>
        {
        },
        dispose: () =>
        {
            live--;
        } };
    } }, 1, (error) =>
    {
        throw error;
    });
    let world = R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), R.getOrThrow(E.make(M, { id: "platform",
        mode: "kinematic",
        linearVelocity: V.Vector3Unsafe(1, 0, 0) }))));
    const Ids = new Set([ "platform" ]);
    for (let i = 0; i < 10; i++)
    {
        position = V.add(position, V.Vector3Unsafe(0.01, 0, 0));
        world = Bridge.prepare("overworld", world, Ids);
        world = R.getOrThrow(W.step(world));
        Assert.equal(world.diagnostics.length, 0);
        Bridge.commit("overworld", world, Ids);
    }

    Assert.ok(position.x >= 0.54 && position.x <= 0.56, `walking + support position ${position.x}`);
    Assert.equal(created, 1);
    Assert.equal(live, 1);
    jumping = true;
    world = Bridge.prepare("overworld", world, Ids);
    world = R.getOrThrow(W.step(world));
    Bridge.commit("overworld", world, Ids);
    Assert.equal(live, 0);
    Bridge.clear();
});
test("stationary support never teleports native actors, and yaw transport uses the foot point", () =>
{
    const M = model();
    let position = V.Vector3Unsafe(0.2, 0.5, 0);
    let moves = 0;
    const Bridge = Native.make({ query: () => [ { id: "standing",
        position,
        bounds: B.AABBUnsafe(V.add(position, V.Vector3Unsafe(-0.1, 0, -0.1)), V.add(position, V.Vector3Unsafe(0.1, 1, 0.1))),
        velocity: V.Zero,
        jumping: false,
        impulse: () =>
        {
        },
        move: (delta) =>
        {
            moves++;
            position = V.add(position, delta);
            return true;
        } } ],
    helper: () => ({ move: () =>
    {
    },
    dispose: () =>
    {
    } }) }, 1, (error) =>
    {
        throw error;
    });
    let world = R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), R.getOrThrow(E.make(M, { id: "platform",
        mode: "kinematic" }))));
    const Ids = new Set([ "platform" ]);
    for (let i = 0; i < 2; i++)
    {
        world = Bridge.prepare("overworld", world, Ids);
        world = R.getOrThrow(W.step(world));
        Bridge.commit("overworld", world, Ids);
    }

    Assert.equal(moves, 0);
    world = R.getOrThrow(W.modify(world, "platform", E.setPose({ position: V.Zero,
        rotation: O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(0, 90, 0))) })));
    world = Bridge.prepare("overworld", world, Ids);
    world = R.getOrThrow(W.step(world));
    Bridge.commit("overworld", world, Ids);
    Assert.ok(Math.abs(position.x) < 1e-5 && Math.abs(position.z - 0.2) < 1e-5, JSON.stringify(position));
    Bridge.clear();
});
test("duplicate runtime startup cannot clean resources owned by the first runtime", () =>
{
    const F = fixture();
    const M = model();
    const A = renderer();
    const First = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter }));
    R.getOrThrow(First.spawn(R.getOrThrow(E.make(M, { id: "body" })), "overworld"));
    const Cleans = F.cleans();
    Assert.equal(R.isFailure(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter })), true);
    Assert.equal(A.live(), 1);
    Assert.equal(F.cleans(), Cleans);
    Assert.equal(F.subscriptions(), 3);
    First.dispose();
});
test("straight, inner and outer stairs retain analytic volumes in every orientation", () =>
{
    const Vectors = [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ] ] as const;
    const Volume = (boxes: ReadonlyArray<B.AABB>): number => boxes.reduce((sum, box) => sum +
        (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z), 0);
    for (const Top of [ false, true ])
    {
        for (const Direction of [ 0, 1, 2, 3 ])
        {
            const Stair: Runtime.Block = { identifier: "minecraft:oak_stairs",
                solid: true,
                states: { weirdo_direction: Direction,
                    upside_down_bit: Top } };
            const [ X, Z ] = Vectors[Direction];
            const Other = { ...Stair,
                states: { weirdo_direction: Direction < 2 ? 2 : 0,
                    upside_down_bit: Top } };
            const Air: Runtime.Block = { identifier: "minecraft:air",
                states: {},
                solid: false };
            Assert.equal(Volume(vanilla(Stair, () => Air)!), 0.75);
            Assert.equal(Volume(vanilla(Stair, (x, _y, z) => x === X && z === Z ? Other : Air)!), 0.625);
            Assert.equal(Volume(vanilla(Stair, (x, _y, z) => x === -X && z === -Z ? Other : Air)!), 0.875);
        }
    }
});
test("terrain repair cannot resume motion while renderer assets remain unavailable", () =>
{
    const F = fixture();
    const M = model("particle");
    const A = renderer();
    const Instance = R.getOrThrow(Runtime.start({ host: F.host,
        models: [ M ],
        renderer: A.adapter,
        world: { gravity: V.Zero } }));
    R.getOrThrow(Instance.spawn(R.getOrThrow(E.make(M, { id: "body",
        linearVelocity: V.One })), "overworld"));
    F.setUnavailable(true);
    F.tick();
    A.fail(true);
    // Recreate the adapter after unload so the failure overlaps a terrain pause.
    F.valid.delete("1");
    F.tick();
    F.load(F.owners[0]);
    F.tick();
    F.setUnavailable(false);
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, true);
    Assert.deepEqual(Instance.world("overworld")!.bodies[0].pose.position, V.Zero);
    A.fail(false);
    F.tick();
    Assert.equal(Instance.world("overworld")!.bodies[0].paused, false);
    Instance.dispose();
});

test("non-colliding signs and buttons stay empty; exact terrain coalescing preserves openings", () =>
{
    for (const Identifier of [ "minecraft:stone_button", "minecraft:wall_sign", "minecraft:standing_sign", "minecraft:oak_hanging_sign" ])
    {
        Assert.deepEqual(vanilla({ identifier: Identifier,
            solid: true,
            states: {} }, () => { throw new Error("no neighbor needed"); }), []);
    }

    const Cells = [ [ 0, 0 ], [ 1, 0 ], [ 0, 1 ] ].map(([ x, z ]) => B.AABBUnsafe(V.Vector3Unsafe(x, 0, z), V.Vector3Unsafe(x + 1, 1, z + 1)));
    const Merged = coalesce(Cells);
    Assert.equal(Merged.reduce((sum, box) => sum + (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z), 0), 3);
    Assert.ok(!Merged.some((box) => O.getOrThrow(B.containsPoint(box, V.Vector3Unsafe(1.5, 0.5, 1.5)))));
    Assert.equal(coalesce([ ...Cells, B.AABBUnsafe(V.Vector3Unsafe(1, 0, 1), V.Vector3Unsafe(2, 1, 2)) ]).length, 1);
});

test("local native neighborhoods exclude actors between distant stations and deduplicate query results", () =>
{
    let World = R.getOrThrow(W.make());
    for (const X of [ 0, 80 ])
    {
        World = R.getOrThrow(W.add(World, R.getOrThrow(E.make(model(), { id: `owner-${X}`,
            pose: T.TransformUnsafe(V.Vector3Unsafe(X, 10, 0), Q.Identity) }))));
    }

    const Queries: Array<B.AABB> = [];
    const Actors = [ 0, 40 ].map((x) => ({ id: String(x),
        bounds: B.AABBUnsafe(V.Vector3Unsafe(x - 0.3, 10, -0.3), V.Vector3Unsafe(x + 0.3, 11.8, 0.3)),
        position: V.Vector3Unsafe(x, 10, 0),
        velocity: V.Zero,
        jumping: false,
        impulse: () => {},
        move: () => true }));
    const Bridge = Native.make({ query: (_dimension, bounds) =>
    {
        Queries.push(bounds);
        return Actors;
    },
    helper: () => ({ move: () => {},
        dispose: () => {} }) }, 8, (error) => Assert.fail(String(error)));
    World = Bridge.prepare("overworld", World, new Set([ "owner-0", "owner-80" ]));
    Assert.equal(Queries.length, 2);
    Assert.ok(Queries.every((box) => box.max.x - box.min.x < 10));
    Assert.equal(World.bodies.filter((value) => value.id.startsWith("native:")).length, 1);
    Assert.ok(World.bodies.some((value) => value.id === "native:0"));
    Bridge.clear();
});

test("overlapping terrain neighborhoods count unique colliders and reuse unchanged static bodies", () =>
{
    const Host = fixture();
    let solid = true;
    Host.setResolver((_dimension, point) => ({ identifier: solid && point.x === 0 && point.y === 0 && point.z === 0 ? "minecraft:stone" : "minecraft:air",
        states: {},
        solid: solid && point.x === 0 && point.y === 0 && point.z === 0 }));
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    const Samples: Array<Runtime.TickMetrics> = [];
    const Physics = R.getOrThrow(Runtime.start({ host: Host.host,
        models: [ model() ],
        world: { maxBodies: 3 },
        profile: true,
        metrics: (sample) => Samples.push(sample),
        diagnostic: (error) => Diagnostics.push(error) }));
    for (const Id of [ "first", "second" ])
    {
        R.getOrThrow(Physics.spawn(R.getOrThrow(E.make(model(), { id: Id,
            mode: "kinematic",
            pose: T.TransformUnsafe(V.Vector3Unsafe(0.5, 1.5, 0.5), Q.Identity) })), "overworld"));
    }

    Host.tick();
    const Terrain = Physics.world("overworld")!.bodies.find((value) => value.id.startsWith("terrain:"));
    Assert.ok(Terrain);
    Host.tick();
    Assert.equal(Physics.world("overworld")!.bodies.find((value) => value.id.startsWith("terrain:")), Terrain);
    Assert.ok(!Diagnostics.some((error) => error.code === "Terrain"));
    Assert.ok(Samples.every((sample) => sample.profile?.terrainColliders === 1 && Object.isFrozen(sample.profile)));
    solid = false;
    Host.tick();
    Assert.ok(!Physics.world("overworld")!.bodies.some((value) => value.id.startsWith("terrain:")));
    Physics.dispose();
});
