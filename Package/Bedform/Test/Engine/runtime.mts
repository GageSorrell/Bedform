/**
 * Real engine owners, native contacts, disposal and process-restart restoration.
 *
 * @module bedform/Test/Engine/runtime
 *
 * @file      runtime.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Engine assertions retain contextual records and geometric axis order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import { BlockPermutation, system, world } from "@minecraft/server";
import * as Runtime from "../../Source/PhysicsRuntime.js";
import { makeHost } from "../../Source/Internal/PhysicsBedrock.js";
import * as E from "../../Source/PhysicsEntity.js";
import * as V from "../../Source/Vector3.js";
import * as Q from "../../Source/Quat.js";
import * as T from "../../Source/Transform.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import * as Renderer from "../../Source/PhysicsRenderer.js";
import { DynamicProperty, EntityProperty } from "../../Source/keys.js";
import { Models } from "./catalog.mjs";
import { TestDynamicProperty, TickingArea } from "./keys.mjs";

/**
 * Fails the engine phase with a concrete invariant.
 *
 * @throws { Error } A required runtime invariant failed.
 *
 * @category Tests
 * @since 1.0.0
 */
const check = (value: unknown, message: string): void =>
{
    if (!value)
    {
        throw new Error(message);
    }
};

/**
 * Executes a bounded engine assertion and retains a failure marker for the runner.
 *
 * @category Tests
 * @since 1.0.0
 */
const later = (operation: () => void, ticks: number): void =>
{
    system.runTimeout(() =>
    {
        try
        {
            operation();
        }
        catch (error)
        {
            console.error(`BF_FAIL ${String(error)}`);
        }
    }, ticks);
};

/**
 * Runs native and owner acceptance against real compiler output with a test renderer.
 * Particle rendering itself remains downstream of this fixture.
 *
 * @category Tests
 * @since 1.0.0
 */
export const runRuntime = (): void =>
{
    const Dimension = world.getDimension("overworld");
    const Host = makeHost({ namespace: "bedform_fixture",
        dimensions: [ Dimension.id ] });
    const Diagnostics: Array<Runtime.Diagnostic> = [];
    let live = 0;
    let commits = 0;
    const Adapter: Renderer.Renderer = { attach: (_model, _id, dimension, initial) =>
    {
        const Anchor = world.getDimension(dimension).spawnEntity(Models.particle.identifier, initial.end.position);
        Anchor.setDynamicProperty(DynamicProperty.PhysicsTransient, "bedform_fixture");
        live++;
        let disposed = false;
        const Commit = (interval: Renderer.Interval): void =>
        {
            commits++;
            const Packet = R.getOrThrow(Renderer.encode(interval));
            for (const [ Key, Value ] of Object.entries(Packet))
            {
                if (Key !== EntityProperty.Sequence)
                {
                    Anchor.setProperty(Key, Value);
                }
            }

            Anchor.setProperty(EntityProperty.Sequence, interval.sequence);
        };

        Commit(initial);
        return { commit: Commit,
            rebase: (position) =>
            {
                Anchor.teleport(position);
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
                    if (Anchor.isValid)
                    {
                        Anchor.remove();
                    }
                }
            } };
    } };
    const Start = (): Runtime.Runtime => R.getOrThrow(Runtime.start({ host: Host,
        models: Object.values(Models),
        renderer: Adapter,
        diagnostic: (error) => Diagnostics.push(error),
        maxNativeHelpers: 4 }));
    let instance = Start();
    if (world.getDynamicProperty(TestDynamicProperty.Phase) === "restart")
    {
        const Expected = world.getDynamicProperty(TestDynamicProperty.Expected);
        const Actual = instance.world(Dimension.id)!.bodies.filter((body) => !body.id.startsWith("terrain:") && !body.id.startsWith("native:"));
        check(Actual.length === 2 && live === 2, "Restart must restore two owners and two independent attachments");
        check(JSON.stringify(Actual.map((body) => [ body.id, body.pose, body.linearVelocity, body.angularVelocity ])) === Expected, "Restart must not replay elapsed motion");
        check(Dimension.getEntities({ type: "bedform_fixture:physics_support" }).length === 0, "Restart must clean orphan helpers");
        for (let i = 0; i < 3; i++)
        {
            instance.dispose();
            instance.dispose();
            check(live === 0, "Repeated disposal leaked an attachment");
            instance = Start();
            check(live === 2, "Repeated startup duplicated attachments");
        }

        R.getOrThrow(instance.remove("cube"));
        R.getOrThrow(instance.remove("particle"));
        instance.dispose();
        check(live === 0, "Removal leaked attachments");
        check(Dimension.getEntities().filter((entity) => entity.getDynamicProperty(DynamicProperty.PhysicsTransient) === "bedform_fixture").length === 0, "Removal left orphan anchors");
        check(Diagnostics.length === 0, `Runtime diagnostics: ${JSON.stringify(Diagnostics.slice(0, 3))}`);
        console.warn("BF_PASS owners/full orientation/native AABBs/renderer lifecycle/actual process restart");
        return;
    }

    Dimension.getBlock({ x: -3,
        y: 99,
        z: 0 })!.setPermutation(BlockPermutation.resolve("minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }));
    R.getOrThrow(instance.spawn(R.getOrThrow(E.make(Models.cube, { id: "slab-fixture",
        pose: { position: V.Vector3Unsafe(-2.5, 101, 0.5),
            rotation: Q.Identity } })), Dimension.id));
    R.getOrThrow(instance.spawn(R.getOrThrow(E.make(Models.cube, { id: "cube",
        mode: "static",
        pose: { position: V.Vector3Unsafe(0, 100, 0),
            rotation: Q.Identity } })), Dimension.id));
    R.getOrThrow(instance.spawn(R.getOrThrow(E.make(Models.particle, { id: "particle",
        gravity: O.some(V.Zero),
        pose: { position: V.Vector3Unsafe(3, 101, 0),
            rotation: O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(0.2, 0.4, 0.6))) },
        linearVelocity: V.Vector3Unsafe(0.1, 0, 0),
        angularVelocity: V.Vector3Unsafe(0.3, 0.2, 0.1) })), Dimension.id));
    const Pig = Dimension.spawnEntity("minecraft:pig", { x: 0,
        y: 101.25,
        z: 0 });
    Pig.addEffect("slowness", 600, { amplifier: 255,
        showParticles: false });
    later(() =>
    {
        const State = instance.world(Dimension.id)!;
        const Particle = State.bodies.find((body) => body.id === "particle")!;
        const Slab = State.bodies.find((body) => body.id === "slab-fixture")!;
        check(Slab && !Slab.paused && Math.abs(Slab.pose.position.y - 100) < 0.02, `Slab collision height ${Slab?.pose.position.y}`);
        R.getOrThrow(instance.remove("slab-fixture"));
        console.warn("BF_TERRAIN_SLAB_PASS real bottom-slab permutation contact");
        check(Particle && !Particle.paused && !T.equals(Particle.pose, T.Identity), "Invisible owner must advance its full committed pose");
        check(Pig.location.y >= 100.49 && Pig.location.y < 100.7, `Native standing height ${Pig.location.y}`);
        const Helpers = Dimension.getEntities({ type: "bedform_fixture:physics_support" });
        check(Helpers.length > 0 && Helpers.length <= 4, "Native support helper pool must be active and bounded");
        console.warn(`BF_NATIVE ${JSON.stringify({ pig: Pig.location,
            helpers: Helpers.length,
            commits })}`);
        const BeforeTransport = Pig.location.x;
        R.getOrThrow(instance.update("cube", E.configure({ mode: "kinematic" })));
        R.getOrThrow(instance.update("cube", E.setLinearVelocity(V.Vector3Unsafe(0.5, 0, 0))));
        later(() =>
        {
            check(Pig.location.x > BeforeTransport + 0.1, `Moving support failed to carry native: ${Pig.location.x}`);
            console.warn(`BF_TRANSPORT ${JSON.stringify({ before: BeforeTransport,
                after: Pig.location.x })}`);
            R.getOrThrow(instance.update("cube", E.setLinearVelocity(V.Zero)));
            later(() =>
            {
                Pig.applyImpulse({ x: 0,
                    y: 0.4,
                    z: 0 });
                later(() =>
                {
                    console.warn(`BF_JUMP ${JSON.stringify({ position: Pig.location,
                        velocity: Pig.getVelocity() })}`);
                    check(Pig.location.y > 100.7, "Native jump must release support");
                    Pig.remove();
                    R.getOrThrow(instance.update("cube", E.setPose({ position: V.Vector3Unsafe(0, 100, 0),
                        rotation: Q.Identity })));
                    R.getOrThrow(instance.update("cube", E.configure({ mode: "dynamic",
                        mass: 80,
                        gravity: O.some(V.Zero) })));
                    R.getOrThrow(instance.update("cube", E.setLinearVelocity(V.Vector3Unsafe(4, 0, 0))));
                    Dimension.getBlock({ x: 1,
                        y: 99,
                        z: 0 })!.setPermutation(BlockPermutation.resolve("minecraft:oak_slab", { "minecraft:vertical_half": "bottom" }));
                    const Pushed = Dimension.spawnEntity("minecraft:pig", { x: 1.25,
                        y: 99.5,
                        z: 0 });
                    Pushed.addEffect("slowness", 200, { amplifier: 255,
                        showParticles: false });
                    later(() =>
                    {
                        const PushBody = instance.world(Dimension.id)!.bodies.find((body) => body.id === "cube")!;
                        console.warn(`BF_PUSH_TRACE ${JSON.stringify({ native: Pushed.location,
                            velocity: Pushed.getVelocity(),
                            pose: PushBody.pose,
                            bodyVelocity: PushBody.linearVelocity,
                            diagnostics: Diagnostics.slice(0, 3) })}`);
                        check(Pushed.location.x > 1.3, `Custom contact did not push native: ${Pushed.location.x}`);
                        console.warn(`BF_NATIVE_PUSH_PASS ${JSON.stringify({ position: Pushed.location,
                            velocity: Pushed.getVelocity() })}`);
                        Pushed.remove();
                        R.getOrThrow(instance.update("cube", E.setLinearVelocity(V.Zero)));
                        R.getOrThrow(instance.update("cube", E.setAngularVelocity(V.Zero)));
                        R.getOrThrow(instance.update("cube", E.configure({ mode: "kinematic",
                            mass: 1,
                            gravity: O.none() })));
                        R.getOrThrow(instance.update("cube", E.setPose({ position: V.Vector3Unsafe(0, 100, 0),
                            rotation: O.getOrThrow(Q.fromEuler(V.Vector3Unsafe(20, 40, 60))) })));
                        const Complete = (): void =>
                        {
                            R.getOrThrow(instance.update("particle", E.setLinearVelocity(V.Vector3Unsafe(0.1, 0, 0))));
                            R.getOrThrow(instance.update("particle", E.setAngularVelocity(V.Vector3Unsafe(0.3, 0.2, 0.1))));
                            R.getOrThrow(instance.transfer("particle", Dimension.id, O.getOrThrow(T.Transform(V.Vector3Unsafe(12, 101, 0), Particle.pose.rotation))));
                            later(() =>
                            {
                                const Final = instance.world(Dimension.id)!.bodies.filter((body) => body.id === "cube" || body.id === "particle");
                                check(Final.length === 2 && live === 2, "Both representations must retain one attachment");
                                for (const Owner of Host.discover().filter((owner) => owner.read(DynamicProperty.PhysicsState) !== undefined))
                                {
                                    const Native = Dimension.getEntities().find((entity) => entity.id === Owner.id)!;
                                    check(Native.getRotation().x === 0 && Native.getRotation().y === 0, "Owner native orientation must stay neutral");
                                }

                                world.setDynamicProperty(TestDynamicProperty.Expected, JSON.stringify(Final.map((body) => [ body.id, body.pose, body.linearVelocity, body.angularVelocity ])));
                                world.setDynamicProperty(TestDynamicProperty.Phase, "restart");
                                instance.dispose();
                                check(live === 0, "Disposal must remove transient anchors");
                                const Orphan = Dimension.spawnEntity(Models.particle.identifier, { x: 0,
                                    y: 101,
                                    z: 0 });
                                Orphan.setDynamicProperty(DynamicProperty.PhysicsTransient, "bedform_fixture");
                                Dimension.spawnEntity("bedform_fixture:physics_support", { x: 0,
                                    y: 101,
                                    z: 0 });
                                check(Diagnostics.every((error) => error.code === "UnloadedTerrain"), `Runtime diagnostics: ${JSON.stringify(Diagnostics.filter((error) => error.code !== "UnloadedTerrain").slice(0, 3))}`);
                                console.warn("BF_RESTART_READY");
                            }, 4);
                        };

                        const Target = O.getOrThrow(T.Transform(V.Vector3Unsafe(256, 101, 0), Particle.pose.rotation));
                        Dimension.runCommand(`tickingarea add circle 256 100 0 1 ${TickingArea.Remote} true`);
                        later(() =>
                        {
                            R.getOrThrow(instance.update("particle", E.setLinearVelocity(V.Zero)));
                            R.getOrThrow(instance.update("particle", E.setAngularVelocity(V.Zero)));
                            R.getOrThrow(instance.transfer("particle", Dimension.id, Target));
                            later(() =>
                            {
                                Dimension.runCommand(`tickingarea remove ${TickingArea.Remote}`);
                                later(() =>
                                {
                                    const Held = instance.world(Dimension.id)!.bodies.find((body) => body.id === "particle");
                                    check(!Held || Held.paused, "Removing the remote fixture ticking area must unload or pause its body");
                                    Dimension.runCommand(`tickingarea add circle 256 100 0 1 ${TickingArea.Remote} true`);
                                    later(() =>
                                    {
                                        const Restored = instance.world(Dimension.id)!.bodies.find((body) => body.id === "particle");
                                        check(Restored && !Restored.paused && T.equals(Restored.pose, Target), "Reload must restore the retained frozen owner pose");
                                        check(live === 2, "Reload must recreate one attachment without duplicating anchors");
                                        console.warn("BF_UNLOAD_RELOAD_PASS real remote chunk lifecycle");
                                        Complete();
                                    }, 30);
                                }, 240);
                            }, 4);
                        }, 20);
                    }, 8);
                }, 3);
            }, 2);
        }, 10);
    }, 40);
};
