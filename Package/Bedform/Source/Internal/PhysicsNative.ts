/**
 * Native AABB bridge: 80 kg translational response with locked angular motion.
 *
 * @module bedform/Internal/PhysicsNative
 *
 * @file      PhysicsNative.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Contact records retain physical ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as E from "./PhysicsBody.js";
import * as W from "../PhysicsWorld.js";
import * as C from "../Collision.js";
import * as B from "../AABB.js";
import * as S from "../CollisionShape.js";
import * as T from "../Transform.js";
import * as V from "../Vector3.js";
import * as Q from "../Quat.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";

/**
 * Live native snapshot. velocity is in blocks/second, not native blocks/tick.
 * Corrections must check terrain and return whether the move succeeded.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Native
{
    readonly id: string;
    readonly bounds: B.AABB;
    readonly position: V.Vector3;
    readonly velocity: V.Vector3;
    readonly jumping: boolean;
    readonly impulse: (deltaVelocity: V.Vector3) => void;
    readonly move: (delta: V.Vector3) => boolean;
}

/**
 * Small pooled native support entity, independent of owners/render anchors.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Helper
{
    readonly move: (position: V.Vector3) => void;
    readonly dispose: () => void;
}

/**
 * A dimension's shared native query and bounded helper factory.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Host
{
    readonly query: (dimension: string, bounds: B.AABB) => ReadonlyArray<Native>;
    readonly helper: (dimension: string, position: V.Vector3) => Helper;
}

interface Support
{
    readonly bodyId: string;
    readonly local: V.Vector3;
    readonly world: V.Vector3;
}

interface Sample
{
    readonly native: Native;
    readonly velocity: V.Vector3;
    readonly initial: E.PhysicsEntity;
}

/**
 * Per-runtime contact state and helper pool. No engine queries run on construction.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Bridge
{
    readonly forget: (bodyId: string) => void;
    readonly prepare: (dimension: string, world: W.PhysicsWorld, ids: ReadonlySet<string>) => W.PhysicsWorld;
    readonly commit: (dimension: string, world: W.PhysicsWorld, ids: ReadonlySet<string>) => void;
    readonly clear: () => void;
}

/**
 * Uses the rigid solver for native/custom impulses and CCD. Native proxies have
 * zero inverse inertia, zero gravity and no sleep; only their contact delta is
 * returned to native motion. Support follows body-local points and releases on jump.
 * Helpers are limited globally and reused during sustained contacts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (host: Host, maxHelpers: number, report: (error: unknown) => void): Bridge =>
{
    const Samples = new Map<string, Map<string, Sample>>();
    const Previous = new Map<string, V.Vector3>();
    const Supports = new Map<string, Support>();
    const Helpers = new Map<string, Helper>();
    const Definitions = new Map<string, E.Definition>();
    const ZeroTensor = Object.freeze([ 0, 0, 0, 0, 0, 0, 0, 0, 0 ] as const);
    const Release = (key: string): void =>
    {
        Supports.delete(key);
        const Helper = Helpers.get(key);
        Helpers.delete(key);
        try
        {
            Helper?.dispose();
        }
        catch (error)
        {
            report(error);
        }
    };

    return {
        forget: (bodyId) =>
        {
            for (const [ Key, Support ] of Supports)
            {
                if (Support.bodyId === bodyId)
                {
                    Release(Key);
                }
            }
        },
        prepare: (dimension, initial, ids) =>
        {
            let world = initial;
            const Bodies = world.bodies.filter((body) => ids.has(body.id) && !body.paused);
            const Current = new Map<string, Sample>();
            Samples.set(dimension, Current);
            if (!Bodies.length)
            {
                for (const Key of [ ...Helpers.keys() ])
                {
                    if (Key.startsWith(`${dimension}|`))
                    {
                        Release(Key);
                    }
                }

                for (const Key of [ ...Previous.keys() ])
                {
                    if (Key.startsWith(`${dimension}|`))
                    {
                        Previous.delete(Key);
                    }
                }

                for (const Body of world.bodies)
                {
                    if (Body.id.startsWith("native:"))
                    {
                        world = R.getOrThrow(W.remove(world, Body.id));
                    }
                }

                return world;
            }

            const Bounds = Bodies.map((body) => body.definition.shape.radius + V.magnitude(body.linearVelocity) * 0.05 + 2);
            const Regions = Bodies.map((body, i) => B.AABBUnsafe(V.subtract(body.pose.position, V.Vector3Unsafe(Bounds[i], Bounds[i], Bounds[i])), V.add(body.pose.position, V.Vector3Unsafe(Bounds[i], Bounds[i], Bounds[i]))));
            // Merge connected neighborhoods only. A single envelope across every
            // owner admits unrelated actors anywhere between distant stations.
            const Groups: Array<B.AABB> = [];
            for (const Region of Regions)
            {
                let merged = Region;
                for (let index = 0; index < Groups.length;)
                {
                    if (O.getOrThrow(B.overlaps(merged, Groups[index])))
                    {
                        merged = B.AABBUnsafe(V.min(merged.min, Groups[index].min), V.max(merged.max, Groups[index].max));
                        Groups.splice(index, 1);
                        index = 0;
                    }
                    else
                    {index++;}
                }

                Groups.push(merged);
            }

            const Found = new Map<string, Native>();
            for (const Group of Groups)
            {
                for (const Native of host.query(dimension, Group))
                {
                    if (Regions.some((region) => O.getOrThrow(B.overlaps(region, Native.bounds))))
                    {Found.set(Native.id, Native);}
                }
            }

            const Natives = [ ...Found.values() ].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
            if (Natives.length > 128)
            {
                report(new Error("Native query exceeds the 128-entity bridge budget"));
            }

            for (const Native of Natives.slice(0, 128))
            {
                try
                {
                    const Id = `native:${Native.id}`;
                    const Key = `${dimension}|${Native.id}`;
                    const Last = Previous.get(Key);
                    const Velocity = Last && !Native.jumping ? V.scale(V.subtract(Native.position, Last), 20) : Native.velocity;
                    if (Native.jumping)
                    {
                        Release(Key);
                    }

                    Previous.set(Key, Native.position);
                    const Half = O.getOrThrow(B.halfExtents(Native.bounds));
                    const Center = O.getOrThrow(B.center(Native.bounds));
                    const Model = { schemaVersion: 1 as const,
                        name: "native",
                        identifier: "bedform:native",
                        representation: "cuboid" as const,
                        fingerprint: "native-80kg-v1",
                        bounds: B.AABBUnsafe(V.scale(Half, -1), Half),
                        sourceGeometry: [],
                        sourceCells: [],
                        collision: R.getOrThrow(S.primitive("box", Half)),
                        restitution: 0,
                        linearVelocity: V.Zero,
                        angularVelocity: V.Zero,
                        physical: { volume: Half.x * Half.y * Half.z * 8,
                            mass: 80,
                            centroid: V.Zero,
                            centerOfMass: V.Zero,
                            inertia: [ 1, 0, 0, 0, 1, 0, 0, 0, 1 ] as const } };
                    const SizeKey = `${Half.x},${Half.y},${Half.z}`;
                    let definition = Definitions.get(SizeKey);
                    if (!definition)
                    {
                        definition = R.getOrThrow(E.define(Model));
                        if (Definitions.size >= 256)
                        {
                            Definitions.clear();
                        }

                        Definitions.set(SizeKey, definition);
                    }

                    const Body = E.copy(R.getOrThrow(E.make(definition, { id: Id,
                        mass: 80,
                        gravity: O.some(V.Zero),
                        allowSleep: false,
                        pose: { position: Center,
                            rotation: Q.Identity },
                        linearVelocity: Velocity })), { inverseInertia: ZeroTensor });
                    Current.set(Id, { native: Native,
                        velocity: Velocity,
                        initial: Body });
                    world = R.getOrThrow(world.bodies.some((body) => body.id === Id) ? W.set(world, Body) : W.add(world, Body));
                }
                catch (error)
                {
                    report(error);
                }
            }

            for (const Body of world.bodies)
            {
                if (Body.id.startsWith("native:") && !Current.has(Body.id))
                {
                    world = R.getOrThrow(W.remove(world, Body.id));
                }
            }

            for (const Key of [ ...Previous.keys() ])
            {
                if (Key.startsWith(`${dimension}|`) && !Current.has(`native:${Key.slice(dimension.length + 1)}`))
                {
                    Previous.delete(Key);
                    Release(Key);
                }
            }

            return world;
        },
        commit: (dimension, world, ids) =>
        {
            const Current = Samples.get(dimension);
            if (!Current)
            {
                return;
            }

            for (const [ Id, Sample ] of Current)
            {
                const Key = `${dimension}|${Sample.native.id}`;
                try
                {
                    const Body = world.bodies.find((body) => body.id === Id);
                    if (!Body || Body.paused)
                    {
                        Release(Key);
                        continue;
                    }

                    const DeltaVelocity = V.subtract(Body.linearVelocity, Sample.velocity);
                    if (V.magnitude(DeltaVelocity) > 1e-6)
                    {
                        Sample.native.impulse(DeltaVelocity);
                    }

                    // Correct current overlap, never replay predicted locomotion.
                    let Separation = V.Zero;
                    for (const Pair of world.contacts)
                    {
                        const OtherId = Pair.first === Id ? Pair.second : Pair.second === Id ? Pair.first : undefined;
                        if (!OtherId)
                        {
                            continue;
                        }

                        const Other = world.bodies.find((body) => body.id === OtherId)!;
                        const OtherSample = Current.get(OtherId);
                        const Patches = R.getOrThrow(C.collide({ shape: Other.definition.shape,
                            pose: OtherSample?.initial.pose ?? Other.pose }, { shape: Body.definition.shape,
                            pose: { position: V.add(Sample.initial.pose.position, Separation),
                                rotation: Q.Identity } }));
                        for (const Patch of Patches)
                        {
                            const Depth = Math.max(0, ...Patch.contacts.map((contact) => contact.depth));
                            if (Depth > 1e-5)
                            {
                                Separation = V.add(Separation, V.scale(Patch.normal, Depth + 1e-4));
                            }
                        }
                    }

                    if (V.magnitude(Separation) > 1e-5 && V.magnitude(Separation) < 1 && Sample.native.move(Separation))
                    {
                        Previous.set(Key, V.add(Sample.native.position, Separation));
                    }

                    let support: Support | undefined;
                    if (!Sample.native.jumping)
                    {
                        for (const Pair of world.contacts)
                        {
                            const OtherId = Pair.first === Id ? Pair.second : Pair.second === Id ? Pair.first : undefined;
                            if (!OtherId || !ids.has(OtherId))
                            {
                                continue;
                            }

                            const Other = world.bodies.find((body) => body.id === OtherId)!;
                            if (Other.paused)
                            {
                                continue;
                            }

                            for (const Manifold of Pair.manifolds)
                            {
                                const Normal = Pair.second === Id ? Manifold.normal : V.scale(Manifold.normal, -1);
                                if (Normal.y < 0.5)
                                {
                                    continue;
                                }

                                const Point = Manifold.contacts[0];
                                if (!Point)
                                {
                                    continue;
                                }

                                const SurfacePoint = Pair.second === Id ? Point.pointA : Point.pointB;
                                const Center = O.getOrThrow(B.center(Sample.native.bounds));
                                const Foot = V.Vector3Unsafe(Center.x, Sample.native.bounds.min.y, Center.z);
                                const WorldPoint = V.subtract(Foot, V.scale(Normal, V.dot(V.subtract(Foot, SurfacePoint), Normal)));
                                support = { bodyId: OtherId,
                                    local: O.getOrThrow(T.untransformPoint(Other.pose, WorldPoint)),
                                    world: WorldPoint };
                                break;
                            }

                            if (support)
                            {
                                break;
                            }
                        }
                    }

                    const Old = Supports.get(Key);
                    if (Old && support && Old.bodyId === support.bodyId)
                    {
                        const Other = world.bodies.find((body) => body.id === Old.bodyId)!;
                        const Transport = V.subtract(O.getOrThrow(T.transformPoint(Other.pose, Old.local)), Old.world);
                        if (V.magnitude(Transport) > 1e-5 && V.magnitude(Transport) < 1 && Sample.native.move(Transport))
                        {
                            const Prior = Previous.get(Key) ?? Sample.native.position;
                            Previous.set(Key, V.add(Prior, Transport));
                            const WorldPoint = V.add(support.world, Transport);
                            support = { ...support,
                                world: WorldPoint,
                                local: O.getOrThrow(T.untransformPoint(Other.pose, WorldPoint)) };
                        }
                    }

                    if (!support)
                    {
                        Release(Key);
                    }
                    else
                    {
                        Supports.set(Key, support);
                        const Position = V.subtract(support.world, V.Vector3Unsafe(0, 0.125, 0));
                        let helper = Helpers.get(Key);
                        if (!helper && Helpers.size < maxHelpers)
                        {
                            helper = host.helper(dimension, Position);
                            Helpers.set(Key, helper);
                        }

                        helper?.move(Position);
                    }
                }
                catch (error)
                {
                    Release(Key);
                    report(error);
                }
            }
        },
        clear: () =>
        {
            for (const Key of [ ...Helpers.keys() ])
            {
                Release(Key);
            }

            Samples.clear();
            Definitions.clear();
            Previous.clear();
            Supports.clear();
        }
    };
};
