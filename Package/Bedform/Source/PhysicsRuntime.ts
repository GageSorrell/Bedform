/**
 * Explicit physics integration. Imports create no subscriptions or engine objects.
 * Supply a host, or construct the Bedrock host from bedform/PhysicsRuntime/Bedrock.
 *
 * @module bedform/PhysicsRuntime
 *
 * @file      PhysicsRuntime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Runtime records preserve lifecycle ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as E from "./Internal/PhysicsBody.js";
import * as W from "./PhysicsWorld.js";
import * as C from "./Collision.js";
import * as S from "./CollisionShape.js";
import * as V from "./Vector3.js";
import * as T from "./Transform.js";
import * as Q from "./Quat.js";
import * as B from "./AABB.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import type * as M from "./PhysicsModel.js";
import * as Render from "./PhysicsRenderer.js";
import * as Terrain from "./Internal/PhysicsTerrain.js";
import * as Persistence from "./Internal/PhysicsPersistence.js";
import * as Native from "./Internal/PhysicsNative.js";
import * as Geometry from "./Internal/CollisionGeometry.js";
import * as Profile from "./Internal/PhysicsProfile.js";
import type { PhysicsError } from "./Internal/PhysicsMath.js";
import { DynamicProperty, EntityProperty } from "./keys.js";
const ActiveHosts = new WeakSet<Host>();

/**
 * Isolated runtime failure; diagnostic sinks may throw without interrupting cleanup.
 *
 * @category Errors
 * @since 1.0.0
 */
export interface Diagnostic
{
    readonly _tag: "PhysicsRuntimeError";
    readonly code: "Startup" | "Owner" | "Renderer" | "Terrain" | "UnknownBlock" | "UnloadedTerrain" | "InvalidState" | "MissingModel" | "IncompatibleModel" | "DuplicateOwner" | "Simulation" | "Disposed";
    readonly message: string;
    readonly bodyId?: string;
}

/**
 * Minimal owner entity port. Neutral native rotation is mandatory in move().
 * loaded() must return false after invalidation or chunk removal.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Owner
{
    readonly id: string;
    readonly identifier: string;
    readonly dimension: () => string;
    readonly position: () => V.Coordinates;
    readonly loaded: () => boolean;
    readonly read: (key: string) => unknown;
    readonly write: (key: string, value: string | undefined) => void;
    readonly property: (key: string, value: number) => void;
    readonly readProperty?: (key: string) => unknown;
    readonly move: (dimension: string, position: V.Coordinates) => void;
    readonly remove: () => void;
}

/**
 * Explicit host subscriptions. Disposers are registered immediately for rollback.
 * Owner discovery includes retained incompatible states. Transients are cleaned
 * only within this host's configured pack namespace, never another runtime's pack.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Host
{
    readonly acquire?: () => () => void;
    readonly native?: Native.Host;
    readonly discover: () => ReadonlyArray<Owner>;
    readonly spawn: (model: M.Model, dimension: string, position: V.Coordinates) => Owner;
    readonly onLoad: (callback: (owner: Owner) => void) => () => void;
    readonly onRemove: (callback: (ownerId: string) => void) => () => void;
    readonly onTick: (callback: () => void) => () => void;
    readonly block: (dimension: string, position: V.Coordinates) => Terrain.Block | undefined;
    readonly cleanupTransients: () => void;
}

/**
 * Explicit immutable catalog and optional renderer; no renderer dependency is required.
 * Per-tick terrain work is bounded across all bodies and shared between queries.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly profile?: boolean;
    readonly clock?: () => number;
    readonly metrics?: (sample: TickMetrics) => void;
    readonly maxNativeHelpers?: number;
    readonly host: Host;
    readonly models: ReadonlyArray<M.Model>;
    readonly renderer?: Render.Renderer;
    readonly diagnostic?: (diagnostic: Diagnostic) => void;
    readonly world?: W.Options;
    readonly maxTerrainBlocks?: number;
}

export namespace TickMetrics
{
    /**
     * Opt-in bounded solver counters plus native/terrain preparation observations.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Profile extends W.StepMetrics
    {
        readonly nativeMs: number;
        readonly terrainMs: number;
        readonly terrainColliders: number;
        readonly nativeBodies: number;
    }
}

/**
 * Observational runtime timing in milliseconds, including engine queries and
 * property/persistence publication. Counters describe owners, not terrain/proxies.
 * Callback/clock failures are isolated and cannot change the authoritative step.
 *
 * @category Types
 * @since 1.0.0
 */
export interface TickMetrics
{
    readonly profile?: TickMetrics.Profile;
    readonly totalMs: number;
    readonly solverMs: number;
    readonly publishMs: number;
    readonly terrainReads: number;
    readonly bodies: number;
    readonly active: number;
    readonly terrainContacts: number;
    readonly nativeContacts: number;
    readonly failed: boolean;
    readonly clockValid: boolean;
}

/**
 * Running explicit integration. Updates are committed immutable world operations.
 * Disposal retains owners and saved state, while remove() deletes the owned entity.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Runtime
{
    readonly spawn: (body: E.PhysicsEntity, dimension: string) => R.Result<void, Diagnostic>;
    readonly update: (id: string, operation: (body: E.PhysicsEntity) => R.Result<E.PhysicsEntity, PhysicsError>) => R.Result<void, Diagnostic>;
    readonly remove: (id: string) => R.Result<void, Diagnostic>;
    readonly transfer: (id: string, dimension: string, pose: T.Transform) => R.Result<void, Diagnostic>;
    readonly world: (dimension: string) => W.PhysicsWorld | undefined;
    readonly registerTerrain: (resolver: Terrain.Resolver) => () => void;
    readonly retry: () => void;
    readonly dispose: () => void;
}

/**
 * Runtime terrain extension contracts, reused by the Bedrock host and add-on adapters.
 *
 * @category Types
 * @since 1.0.0
 */
export type { Block, Resolver } from "./Internal/PhysicsTerrain.js";

/**
 * Native bridge ports with engine-reported bounds and explicit velocity units.
 *
 * @category Types
 * @since 1.0.0
 */
export type { Native, Helper, Host as NativeHost } from "./Internal/PhysicsNative.js";

/**
 * Owned live resources and independently tracked temporary pause causes.
 *
 * @category Internal
 * @since 1.0.0
 */
interface Entry
{
    owner: Owner;
    readonly model: M.Model;
    dimension: string;
    attachment?: Render.Attachment;
    terrainPaused: boolean;
    rendererPaused?: boolean;
    rendererUnavailable?: boolean;
}

/**
 * Prepares a static box using existing collision shapes and source-independent mass.
 *
 * @category Internal
 * @since 1.0.0
 */
const terrainModel = (bounds: B.AABB): M.Model =>
{
    const Size = V.subtract(bounds.max, bounds.min);
    const Half = V.scale(Size, 0.5);
    return { schemaVersion: 1,
        name: "terrain",
        identifier: "bedform:terrain",
        representation: "cuboid",
        fingerprint: "terrain-v1",
        bounds: B.AABBUnsafe(V.scale(Half, -1), Half),
        sourceGeometry: [],
        sourceCells: [],
        collision: R.getOrThrow(S.primitive("box", Half)),
        restitution: 0,
        linearVelocity: V.Zero,
        angularVelocity: V.Zero,
        physical: { volume: Size.x * Size.y * Size.z,
            mass: 1,
            centroid: V.Zero,
            centerOfMass: V.Zero,
            inertia: [ (Size.y ** 2 + Size.z ** 2) / 12, 0, 0, 0, (Size.x ** 2 + Size.z ** 2) / 12, 0, 0, 0, (Size.x ** 2 + Size.y ** 2) / 12 ] } };
};

/**
 * Starts discovery/subscriptions transactionally. A failed startup disposes each
 * acquired subscription and attachment, leaving existing owners/data intact.
 * Terrain unavailable in the swept neighborhood pauses motion without time replay.
 *
 * @category Lifecycle
 * @since 1.0.0
 */
export const start = (options: Options): R.Result<Runtime, Diagnostic> =>
{
    if (!options || !options.host || !Array.isArray(options.models) || options.models.some((model) => !model || typeof model !== "object"))
    {
        return R.fail(Object.freeze({ _tag: "PhysicsRuntimeError",
            code: "Startup",
            message: "Expected explicit host ports and a model catalog" }));
    }

    const Host = options.host;
    const Catalog = new Map(options.models.map((model) => [ model.identifier, model ]));
    const Worlds = new Map<string, W.PhysicsWorld>();
    const Entries = new Map<string, Entry>();
    const OwnerIds = new Map<string, string>();
    const Resolvers: Array<Terrain.Resolver> = [];
    const Subscriptions: Array<() => void> = [];
    const Reported = new Set<string>();
    const TerrainModels = new Map<string, E.Definition>();
    const TerrainBodies = new Map<string, E.PhysicsEntity>();
    let resolverRevision = 0;
    const MaxBlocks = options.maxTerrainBlocks ?? 32_768;
    const MaxHelpers = options.maxNativeHelpers ?? 64;
    let disposed = false;
    let ownsHost = false;
    let ticking = false;
    const ErrorOf = (code: Diagnostic["code"], error: unknown, bodyId?: string): Diagnostic => Object.freeze({ _tag: "PhysicsRuntimeError",
        code,
        message: String(error),
        bodyId });
    const Report = (error: Diagnostic): void =>
    {
        try
        {
            options.diagnostic?.(error);
        }
        catch
        { /* The diagnostic sink is isolated. */
        }
    };

    const Bridge = Host.native ? Native.make(Host.native, MaxHelpers, (error) => Report(ErrorOf("Simulation", error))) : undefined;
    const Attempt = (operation: () => void): R.Result<void, Diagnostic> =>
    {
        try
        {
            if (disposed)
            {
                return R.fail(ErrorOf("Disposed", "Runtime has been disposed"));
            }

            operation();
            return R.succeed(undefined);
        }
        catch (error)
        {
            const Failure = error instanceof Persistence.RestoreError ? ErrorOf(error.code, error) : ErrorOf("Owner", error);
            Report(Failure);
            return R.fail(Failure);
        }
    };

    const World = (dimension: string): W.PhysicsWorld =>
    {
        let world = Worlds.get(dimension);
        if (!world)
        {
            world = R.getOrThrow(W.make(options.world));
            Worlds.set(dimension, world);
        }

        return world;
    };

    const DisposeAttachment = (entry: Entry): void =>
    {
        const Attachment = entry.attachment;
        entry.attachment = undefined;
        try
        {
            Attachment?.dispose();
        }
        catch (error)
        {
            Report(ErrorOf("Renderer", error));
        }
    };

    const Saved = (entry: Entry, body: E.PhysicsEntity): string => Persistence.save(entry.terrainPaused || entry.rendererPaused ? E.copy(body, { paused: false }) : body);
    const Publish = (entry: Entry, body: E.PhysicsEntity, reset = false): E.PhysicsEntity =>
    {
        if (body.interval.sequence >= 8_388_600 || body.interval.reset >= 65_530)
        {
            const Replacement = Host.spawn(entry.model, entry.dimension, body.pose.position);
            try
            {
                Replacement.write(DynamicProperty.PhysicsState, Saved(entry, body));
            }
            catch (error)
            {
                Replacement.remove();
                throw error;
            }

            const Previous = entry.owner;
            DisposeAttachment(entry);
            OwnerIds.delete(Previous.id);
            entry.owner = Replacement;
            if (Entries.has(body.id))
            {
                OwnerIds.set(Replacement.id, body.id);
            }

            Previous.remove();
            body = E.copy(body, { interval: Object.freeze({ start: body.pose,
                end: body.pose,
                sequence: 0,
                reset: 0,
                duration: Render.IntervalSeconds,
                renderBase: body.pose.position }) });
            reset = true;
        }

        // Keep the owner fixed until a rebase is required. Full orientation lives
        // exclusively in the common root, with actual render origin compensation.
        const NativeBase = entry.owner.position();
        let base = V.Vector3Unsafe(NativeBase.x, NativeBase.y, NativeBase.z);
        let interval: Render.Interval = { ...body.interval,
            renderBase: base };
        let packet = Render.encode(interval);
        if (R.isFailure(packet))
        {
            base = body.pose.position;
            entry.owner.move(entry.dimension, base);
            entry.attachment?.rebase(base);
            interval = { ...interval,
                renderBase: base };
            packet = Render.encode(interval);
            if (R.isFailure(packet))
            {
                body = E.copy(body, { interval: Object.freeze({ ...body.interval,
                    start: body.pose,
                    end: body.pose,
                    reset: body.interval.reset + 1,
                    renderBase: base }) });
                interval = body.interval;
                reset = true;
            }
        }

        if (reset)
        {
            interval = { ...interval,
                start: body.pose,
                end: body.pose,
                reset: body.interval.reset };
        }

        const Values = R.getOrThrow(reset ? Render.encode(interval) : packet);
        // Reset/payload first; Sequence is the final coherent commit marker.
        for (const [ Key, Value ] of Object.entries(Values))
        {
            if (Key !== EntityProperty.Sequence)
            {
                entry.owner.property(Key, Value);
            }
        }

        entry.owner.property(EntityProperty.Sequence, interval.sequence);
        if (options.renderer || entry.model.representation === "particle")
        {
            try
            {
                if (!options.renderer)
                {
                    throw new Error("Particle renderer is unavailable");
                }

                if (!entry.attachment)
                {
                    entry.attachment = options.renderer.attach(entry.model, body.id, entry.dimension, { ...interval,
                        start: body.pose,
                        end: body.pose });
                }
                else
                {
                    entry.attachment.commit(interval);
                }

                entry.rendererUnavailable = false;
                if (entry.rendererPaused)
                {
                    entry.rendererPaused = false;
                    if (!entry.terrainPaused)
                    {
                        body = R.getOrThrow(E.resume(body));
                    }
                }

                if (body.paused || body.sleeping)
                {
                    entry.attachment.pause();
                }
            }
            catch (error)
            {
                DisposeAttachment(entry);
                entry.rendererUnavailable = true;
                if (!body.paused)
                {
                    entry.rendererPaused = true;
                }

                body = R.getOrThrow(E.pause(body));
                Report(ErrorOf("Renderer", error, body.id));
            }
        }

        entry.owner.write(DynamicProperty.PhysicsState, Saved(entry, body));
        return body;
    };

    const Forget = (id: string): void =>
    {
        const Entry = Entries.get(id);
        if (!Entry)
        {
            return;
        }

        Entries.delete(id);
        OwnerIds.delete(Entry.owner.id);
        Bridge?.forget(id);
        DisposeAttachment(Entry);
        Worlds.set(Entry.dimension, R.getOrThrow(W.remove(World(Entry.dimension), id)));
    };

    const Restore = (owner: Owner): void =>
    {
        if (disposed || OwnerIds.has(owner.id))
        {
            return;
        }

        const Saved = owner.read(DynamicProperty.PhysicsState);
        if (Saved === undefined)
        {
            return;
        }

        try
        {
            if (typeof Saved !== "string")
            {
                throw new Persistence.RestoreError("InvalidState", "Owner state must be JSON text");
            }

            let Body = Persistence.restore(Saved, Catalog);
            const Sequence = owner.readProperty?.(EntityProperty.Sequence);
            const Reset = owner.readProperty?.(EntityProperty.Reset);
            if (typeof Sequence === "number" && Number.isSafeInteger(Sequence) && Sequence >= 0)
            {
                Body = E.copy(Body, { interval: Object.freeze({ ...Body.interval,
                    sequence: Sequence + 1,
                    reset: typeof Reset === "number" ? (Reset % 65_536 + 1) % 65_536 : 0 }) });
            }

            if (Entries.has(Body.id))
            {
                Report(ErrorOf("DuplicateOwner", "Duplicate persisted body ID retained", Body.id));
                return;
            }

            if (owner.identifier !== Body.definition.model.identifier)
            {
                throw new Persistence.RestoreError("IncompatibleModel", "Owner entity type disagrees with catalog");
            }

            const Dimension = owner.dimension();
            const Entry: Entry = { owner,
                model: Catalog.get(Body.definition.model.identifier)!,
                dimension: Dimension,
                terrainPaused: false };
            let Next = R.getOrThrow(W.add(World(Dimension), Body));
            // Attachments may be unavailable; authoritative compatible data stays retained.
            try
            {
                Body = Publish(Entry, Body, true);
                Next = R.getOrThrow(W.set(Next, Body));
            }
            catch (error)
            {
                DisposeAttachment(Entry);
                throw error;
            }

            Entries.set(Body.id, Entry);
            OwnerIds.set(Entry.owner.id, Body.id);
            Worlds.set(Dimension, Next);
        }
        catch (error)
        {
            Report(ErrorOf(error instanceof Persistence.RestoreError ? error.code : "Owner", error));
        }
    };

    const Dispose = (): void =>
    {
        if (disposed)
        {
            return;
        }

        disposed = true;
        for (const Unsubscribe of Subscriptions.splice(0).reverse())
        {
            try
            {
                Unsubscribe();
            }
            catch (error)
            {
                Report(ErrorOf("Startup", error));
            }
        }

        for (const [ Id, Entry ] of Entries)
        {
            try
            {
                const Body = World(Entry.dimension).bodies.find((body) => body.id === Id);
                if (Body && Entry.owner.loaded())
                {
                    Entry.owner.write(DynamicProperty.PhysicsState, Saved(Entry, Body));
                }
            }
            catch (error)
            {
                Report(ErrorOf("Owner", error, Id));
            }

            DisposeAttachment(Entry);
        }

        Bridge?.clear();
        Entries.clear();
        OwnerIds.clear();
        Worlds.clear();
        TerrainModels.clear();
        TerrainBodies.clear();
        try
        {
            if (ownsHost)
            {
                Host.cleanupTransients();
            }
        }
        catch (error)
        {
            Report(ErrorOf("Owner", error));
        }
    };

    const Tick = (): void =>
    {
        if (disposed || ticking)
        {
            return;
        }

        ticking = true;
        let clockValid = true;
        const Now = (): number =>
        {
            if (!options.metrics)
            {
                return 0;
            }

            try
            {
                const Value = options.clock ? options.clock() : Date.now();
                if (Number.isFinite(Value))
                {
                    return Value;
                }
            }
            catch
            { /* Instrumentation cannot prevent simulation. */
            }

            clockValid = false;
            return 0;
        };

        const Started = Now();
        let solverMs = 0;
        let publishMs = 0;
        const Counters = options.profile && options.metrics ? Profile.empty() : undefined;
        let nativeMs = 0;
        let terrainMs = 0;
        let terrainColliders = 0;
        let nativeBodies = 0;
        let failed = false;
        const Cache = new Map<string, Terrain.Block | undefined>();
        const Resolved = new Map<string, ReadonlyArray<B.AABB>>();
        const TerrainUsed = new Set<string>();
        const Read = (dimension: string, x: number, y: number, z: number): Terrain.Block =>
        {
            const Key = `${dimension}:${x},${y},${z}`;
            if (!Cache.has(Key))
            {
                if (Cache.size >= MaxBlocks)
                {
                    throw new Error("Terrain query budget exceeded");
                }

                Cache.set(Key, Host.block(dimension, V.Vector3Unsafe(x, y, z)));
            }

            const Block = Cache.get(Key);
            if (!Block)
            {
                throw new Persistence.RestoreError("InvalidState", "Unloaded terrain");
            }

            return Block;
        };

        try
        {
            for (const [ Id, Entry ] of [ ...Entries ])
            {
                if (!Entry.owner.loaded())
                {
                    Forget(Id);
                    continue;
                }

                if (Entry.owner.dimension() !== Entry.dimension)
                {
                    const Body = World(Entry.dimension).bodies.find((body) => body.id === Id)!;
                    const Dimension = Entry.owner.dimension();
                    const Next = R.getOrThrow(W.add(World(Dimension), R.getOrThrow(E.setPose(Body, Body.pose))));
                    Forget(Id);
                    Entry.dimension = Dimension;
                    Entries.set(Id, Entry);
                    OwnerIds.set(Entry.owner.id, Id);
                    Worlds.set(Dimension, Next);
                    const Published = Publish(Entry, Next.bodies.find((body) => body.id === Id)!, true);
                    Worlds.set(Dimension, R.getOrThrow(W.set(Next, Published)));
                }
            }

            for (const [ Dimension, Initial ] of [ ...Worlds ])
            {
                let world = Initial;
                const BodyIds = new Set([ ...Entries ].filter(([ , entry ]) => entry.dimension === Dimension).map(([ id ]) => id));
                const NativeStarted = Counters ? Now() : 0;
                if (Bridge)
                {
                    world = Bridge.prepare(Dimension, world, BodyIds);
                }

                if (Counters)
                {nativeMs += Now() - NativeStarted;}

                const TerrainStarted = Counters ? Now() : 0;
                const TerrainIds = new Set<string>();
                const Additions = new Map<string, E.PhysicsEntity>();
                const ExistingTerrain = new Map(world.bodies.filter((body) => body.id.startsWith("terrain:")).map((body) => [ body.id, body ]));
                const NativeIds = new Set(world.bodies.filter((body) => body.id.startsWith("native:")).map((body) => body.id));
                for (const QueryBody of world.bodies)
                {
                    const Id = QueryBody.id;
                    const Entry = Entries.get(Id);
                    if (!Entry && !Id.startsWith("native:"))
                    {
                        continue;
                    }

                    let body = QueryBody;
                    if (Entry?.rendererUnavailable)
                    {
                        body = Publish(Entry, body);
                        world = R.getOrThrow(W.set(world, body));
                    }

                    try
                    {
                        const Bounds = R.getOrThrow(C.bounds({ shape: body.definition.shape,
                            pose: body.pose }));
                        const Gravity = O.isSome(body.gravity) ? body.gravity.value : world.gravity;
                        const Acceleration = body.mode === "dynamic" ? V.magnitude(body.force) / body.physical.mass + V.magnitude(Gravity) : 0;
                        const InverseBound = Math.max(...[ 0, 3, 6 ].map((row) => Math.abs(body.inverseInertia[row]) + Math.abs(body.inverseInertia[row + 1]) + Math.abs(body.inverseInertia[row + 2])));
                        const AngularBound = InverseBound * (V.magnitude(body.angularMomentum) * 0.05 + V.magnitude(body.torque) * 0.0025);
                        const Reach = V.magnitude(body.linearVelocity) * 0.05 + Acceleration * 0.0025 +
                            Geometry.reach(body.definition.shape.bounds, body.physical.centerOfMass) * Math.min(2, AngularBound) + 0.02;
                        const Swept = B.AABBUnsafe(V.subtract(Bounds.min, V.Vector3Unsafe(Reach, Reach, Reach)), V.add(Bounds.max, V.Vector3Unsafe(Reach, Reach, Reach)));
                        // Vanilla collision stays within its cell horizontally;
                        // fences/walls can extend upward into the cell above.
                        // Custom resolvers keep the original one-cell halo in all
                        // directions. Neighbor-dependent shapes read neighbors
                        // explicitly through the shared loaded-block cache.
                        const Halo = Resolvers.length ? 1 : 0;
                        const Min = V.Vector3Unsafe(Math.floor(Swept.min.x) - Halo, Math.floor(Swept.min.y) - 1, Math.floor(Swept.min.z) - Halo);
                        const Max = V.Vector3Unsafe(Math.floor(Swept.max.x) + Halo, Math.floor(Swept.max.y) + Halo, Math.floor(Swept.max.z) + Halo);
                        const Count = (Max.x - Min.x + 1) * (Max.y - Min.y + 1) * (Max.z - Min.z + 1);
                        if (!Number.isSafeInteger(Count) || Count > MaxBlocks)
                        {
                            throw new Error("Swept terrain bounds exceed query budget");
                        }

                        const Local = new Map<string, E.PhysicsEntity>();
                        for (let x = Min.x; x <= Max.x; x++)
                        {
                            for (let y = Min.y; y <= Max.y; y++)
                            {
                                for (let z = Min.z; z <= Max.z; z++)
                                {
                                    const Block = Read(Dimension, x, y, z);
                                    const ResolvedKey = `${resolverRevision}:${Dimension}:${x},${y},${z}`;
                                    let boxes = Resolved.get(ResolvedKey);
                                    if (!boxes)
                                    {
                                        const Neighbor = (dx: number, dy: number, dz: number): Terrain.Block => Read(Dimension, x + dx, y + dy, z + dz);
                                        for (const Resolver of [ ...Resolvers, Terrain.vanilla ])
                                        {
                                            boxes = Resolver(Block, Neighbor);
                                            if (boxes !== undefined)
                                            {break;}
                                        }

                                        if (boxes === undefined)
                                        {
                                            boxes = Block.solid ? Terrain.FullCube : [];
                                            const Key = Block.identifier + JSON.stringify(Block.states);
                                            if (!Reported.has(Key))
                                            {
                                                Reported.add(Key);
                                                Report(ErrorOf("UnknownBlock", `Conservative full-cube fallback for ${Key}`, Id));
                                            }
                                        }

                                        Resolved.set(ResolvedKey, boxes);
                                    }

                                    boxes.forEach((box, index) =>
                                    {
                                        if (!B.isValid(box) || box.max.x <= box.min.x || box.max.y <= box.min.y || box.max.z <= box.min.z)
                                        {
                                            throw new Error("Invalid terrain resolver box");
                                        }

                                        const Offset = V.Vector3Unsafe(x, y, z);
                                        if (body.mode === "static" || !O.getOrThrow(B.overlaps(Swept, B.AABBUnsafe(V.add(box.min, Offset), V.add(box.max, Offset)))))
                                        {
                                            return;
                                        }

                                        const Key = JSON.stringify(box);
                                        let definition = TerrainModels.get(Key);
                                        if (!definition)
                                        {
                                            definition = R.getOrThrow(E.define(terrainModel(box)));
                                            if (TerrainModels.size >= 512)
                                            {
                                                TerrainModels.clear();
                                            }

                                            TerrainModels.set(Key, definition);
                                        }

                                        const TerrainId = `terrain:${x},${y},${z}:${index}`;
                                        const Position = V.add(V.Vector3Unsafe(x, y, z), V.scale(V.add(box.min, box.max), 0.5));
                                        const CacheKey = `${Dimension}:${TerrainId}`;
                                        TerrainUsed.add(CacheKey);
                                        const Previous = Additions.get(TerrainId) ?? ExistingTerrain.get(TerrainId) ?? TerrainBodies.get(CacheKey);
                                        const TerrainBody = Previous && Previous.definition === definition &&
                                            Previous.pose.position.x === Position.x && Previous.pose.position.y === Position.y && Previous.pose.position.z === Position.z ? Previous :
                                            R.getOrThrow(E.make(definition, { id: TerrainId,
                                                mode: "static",
                                                pose: { position: Position,
                                                    rotation: Q.Identity } }));
                                        Local.set(TerrainId, TerrainBody);
                                        if (!TerrainBodies.has(CacheKey) && TerrainBodies.size >= world.limits.maxBodies)
                                        {TerrainBodies.delete(TerrainBodies.keys().next().value!);}

                                        TerrainBodies.set(CacheKey, TerrainBody);
                                    });
                                }
                            }
                        }

                        if (new Set([ ...Local.keys(), ...Additions.keys(), ...BodyIds, ...NativeIds ]).size > world.limits.maxBodies)
                        {
                            const Candidates = new Map([ ...Additions, ...Local ]);
                            const Full: Array<B.AABB> = [];
                            let partial = 0;
                            for (const Candidate of Candidates.values())
                            {
                                const Box = R.getOrThrow(C.bounds({ shape: Candidate.definition.shape,
                                    pose: Candidate.pose }));
                                if (Box.max.x - Box.min.x === 1 && Box.max.y - Box.min.y === 1 && Box.max.z - Box.min.z === 1)
                                {Full.push(Box);}
                                else
                                {partial++;}
                            }

                            if (Terrain.coalesce(Full).length + partial + BodyIds.size + NativeIds.size > world.limits.maxBodies)
                            {throw new Error("Terrain collider capacity exceeded");}
                        }

                        for (const [ Key, Body ] of Local)
                        {
                            Additions.set(Key, Body);
                            TerrainIds.add(Key);
                        }

                        if (Entry?.terrainPaused)
                        {
                            if (!Entry.rendererUnavailable)
                            {
                                body = R.getOrThrow(E.resume(body));
                            }
                            else
                            {
                                Entry.rendererPaused = true;
                            }

                            Entry.terrainPaused = false;
                            world = R.getOrThrow(W.set(world, body));
                        }
                    }
                    catch (error)
                    {
                        if (!body.paused && Entry)
                        {
                            Entry.terrainPaused = true;
                        }

                        body = R.getOrThrow(E.pause(body));
                        world = R.getOrThrow(W.set(world, body));
                        Report(ErrorOf(error instanceof Persistence.RestoreError ? "UnloadedTerrain" : "Terrain", error, Id));
                    }
                }

                // A rectangle of adjacent full blocks is one exact solid. Keeping
                // each cube as an independent collider creates artificial support
                // edges and repeated zero-time CCD impacts on a flat floor.
                const Full: Array<B.AABB> = [];
                for (const [ Id, Body ] of Additions)
                {
                    const Box = R.getOrThrow(C.bounds({ shape: Body.definition.shape,
                        pose: Body.pose }));
                    if (Box.max.x - Box.min.x === 1 && Box.max.y - Box.min.y === 1 && Box.max.z - Box.min.z === 1)
                    {
                        Full.push(Box);
                        Additions.delete(Id);
                        TerrainIds.delete(Id);
                    }
                }

                for (const Box of Terrain.coalesce(Full))
                {
                    const Id = `terrain:union:${Box.min.x},${Box.min.y},${Box.min.z}:${Box.max.x},${Box.max.y},${Box.max.z}`;
                    const Position = V.Vector3Unsafe((Box.min.x + Box.max.x) / 2, (Box.min.y + Box.max.y) / 2, (Box.min.z + Box.max.z) / 2);
                    const LocalBox = B.AABBUnsafe(V.subtract(Box.min, Position), V.subtract(Box.max, Position));
                    const Key = JSON.stringify(LocalBox);
                    let Definition = TerrainModels.get(Key);
                    if (!Definition)
                    {
                        Definition = R.getOrThrow(E.define(terrainModel(LocalBox)));
                        if (TerrainModels.size >= 512)
                        {TerrainModels.clear();}

                        TerrainModels.set(Key, Definition);
                    }

                    const Old = ExistingTerrain.get(Id);
                    Additions.set(Id, Old?.definition === Definition ? Old : R.getOrThrow(E.make(Definition, {
                        id: Id,
                        mode: "static",
                        pose: { position: Position,
                            rotation: Q.Identity }
                    })));
                    TerrainIds.add(Id);
                }

                for (const Body of world.bodies)
                {
                    if (!Entries.has(Body.id) && !TerrainIds.has(Body.id) && !Body.id.startsWith("native:"))
                    {
                        world = R.getOrThrow(W.remove(world, Body.id));
                    }
                }

                for (const [ Id, Body ] of Additions)
                {
                    const Previous = world.bodies.find((body) => body.id === Id);
                    if (!Previous)
                    {
                        world = R.getOrThrow(W.add(world, Body));
                    }
                    else if (Previous.definition !== Body.definition || !T.equals(Previous.pose, Body.pose))
                    {
                        world = R.getOrThrow(W.set(world, Body));
                    }
                }

                if (Counters)
                {
                    terrainMs += Now() - TerrainStarted;
                    terrainColliders += TerrainIds.size;
                    nativeBodies += NativeIds.size;
                }

                const SolverStarted = Now();
                let Next = R.getOrThrow(W.step(world, Counters ? (sample) =>
                {
                    for (const Key of [ "totalMs", "broadPhaseMs", "narrowPhaseMs", "ccdMs", "broadPhasePairs",
                        "narrowPhaseCalls", "narrowPhaseCacheHits", "ccdCalls", "ccdIterations", "bvhNodes", "leafPairs", "replans" ] as const)
                    {Counters[Key] += sample[Key];}

                    Counters.maxIslandBodies = Math.max(Counters.maxIslandBodies, sample.maxIslandBodies);
                    if (sample.slowestPairMs > Counters.slowestPairMs)
                    {
                        Counters.slowestPairMs = sample.slowestPairMs;
                        Counters.slowestPair = sample.slowestPair;
                    }
                } : undefined));
                solverMs += Now() - SolverStarted;
                const CommitStarted = Counters ? Now() : 0;
                Bridge?.commit(Dimension, Next, BodyIds);
                if (Counters)
                {nativeMs += Now() - CommitStarted;}

                Worlds.set(Dimension, Next);
                for (const Diagnostic of Next.diagnostics)
                {
                    Report(ErrorOf("Simulation", JSON.stringify(Diagnostic)));
                }

                const PublishStarted = Now();
                for (const Body of Next.bodies)
                {
                    const Entry = Entries.get(Body.id);
                    if (Entry)
                    {
                        try
                        {
                            const Published = Publish(Entry, Body);
                            if (Published !== Body)
                            {
                                Next = R.getOrThrow(W.set(Next, Published));
                            }
                        }
                        catch (error)
                        {
                            Report(ErrorOf("Owner", error, Body.id));
                        }
                    }
                }

                publishMs += Now() - PublishStarted;
                Worlds.set(Dimension, Next);
            }
        }
        catch (error)
        {
            failed = true;
            Report(ErrorOf("Simulation", error));
        }
        finally
        {
            ticking = false;
            for (const Key of TerrainBodies.keys())
            {
                if (!TerrainUsed.has(Key))
                {TerrainBodies.delete(Key);}
            }

            if (options.metrics)
            {
                const Bodies = [ ...Worlds.values() ].flatMap((world) => world.bodies).filter((body) => Entries.has(body.id));
                const Total = Now() - Started;
                const Contacts = [ ...Worlds.values() ].flatMap((world) => world.contacts);
                try
                {
                    options.metrics(Object.freeze({ ...(Counters ? { profile: Object.freeze({ ...Counters,
                        nativeMs,
                        terrainMs,
                        terrainColliders,
                        nativeBodies }) } : {}),
                    totalMs: Total,
                    solverMs,
                    publishMs,
                    terrainReads: Cache.size,
                    bodies: Bodies.length,
                    active: Bodies.filter((body) => body.mode !== "static" && !body.paused && !body.sleeping).length,
                    terrainContacts: Contacts.filter((pair) => pair.first.startsWith("terrain:") && Entries.has(pair.second) || pair.second.startsWith("terrain:") && Entries.has(pair.first)).length,
                    nativeContacts: Contacts.filter((pair) => pair.first.startsWith("native:") && Entries.has(pair.second) || pair.second.startsWith("native:") && Entries.has(pair.first)).length,
                    failed: failed || Bodies.some((body) => body.paused),
                    clockValid: clockValid && Total >= 0 && solverMs >= 0 && publishMs >= 0 }));
                }
                catch
                { /* Measurement sinks are isolated from physics. */
                }
            }
        }
    };

    try
    {
        if (Catalog.size !== options.models.length || !Number.isSafeInteger(MaxBlocks) || MaxBlocks < 1 || MaxBlocks > 1_000_000 || !Number.isSafeInteger(MaxHelpers) || MaxHelpers < 0 || MaxHelpers > 256)
        {
            throw new Error("Invalid catalog or runtime budgets");
        }

        for (const Model of Catalog.values())
        {
            R.getOrThrow(E.define(Model));
        }

        R.getOrThrow(W.make(options.world));
        if (ActiveHosts.has(Host))
        {
            throw new Error("Physics host is already running");
        }

        const ReleaseHost = Host.acquire?.();
        ActiveHosts.add(Host);
        ownsHost = true;
        Subscriptions.push(() =>
        {
            ActiveHosts.delete(Host);
            ReleaseHost?.();
        });
        Host.cleanupTransients();
        Subscriptions.push(Host.onLoad((owner) =>
        {
            try
            {
                Restore(owner);
            }
            catch (error)
            {
                Report(ErrorOf("Owner", error));
            }
        }));
        Subscriptions.push(Host.onRemove((ownerId) =>
        {
            const Id = OwnerIds.get(ownerId);
            if (Id !== undefined && !Entries.get(Id)?.owner.loaded())
            {
                Forget(Id);
            }
        }));
        for (const Owner of Host.discover())
        {
            Restore(Owner);
        }

        Subscriptions.push(Host.onTick(Tick));
    }
    catch (error)
    {
        Dispose();
        const Failure = ErrorOf("Startup", error);
        Report(Failure);
        return R.fail(Failure);
    }

    return R.succeed(Object.freeze({
        spawn: (body: E.PhysicsEntity, dimension: string) => Attempt(() =>
        {
            E.check(body);
            if (Entries.has(body.id) || body.id.startsWith("terrain:") || body.id.startsWith("native:"))
            {
                throw new Error("Duplicate or reserved body ID");
            }

            const Model = Catalog.get(body.definition.model.identifier);
            if (!Model)
            {
                throw new Persistence.RestoreError("MissingModel", "Model is not registered");
            }

            if (Model.fingerprint !== body.definition.model.fingerprint || Model.representation !== body.definition.model.representation)
            {
                throw new Persistence.RestoreError("IncompatibleModel", "Catalog fingerprint mismatch");
            }

            let Next = R.getOrThrow(W.add(World(dimension), body));
            const Owner = Host.spawn(Model, dimension, body.pose.position);
            const Entry: Entry = { owner: Owner,
                model: Model,
                dimension,
                terrainPaused: false };
            try
            {
                const Published = Publish(Entry, body, true);
                Next = R.getOrThrow(W.set(Next, Published));
                Entries.set(body.id, Entry);
                OwnerIds.set(Entry.owner.id, body.id);
                Worlds.set(dimension, Next);
            }
            catch (error)
            {
                DisposeAttachment(Entry);
                Owner.remove();
                throw error;
            }
        }),
        update: (id: string, operation: (body: E.PhysicsEntity) => R.Result<E.PhysicsEntity, PhysicsError>) => Attempt(() =>
        {
            const Entry = Entries.get(id);
            if (!Entry)
            {
                throw new Error("Missing body");
            }

            const Next = R.getOrThrow(W.modify(World(Entry.dimension), id, operation));
            const Body = Next.bodies.find((body) => body.id === id)!;
            if (Body.definition.model.identifier !== Entry.model.identifier || Body.definition.model.fingerprint !== Entry.model.fingerprint)
            {
                throw new Error("Runtime updates cannot replace a catalog registration");
            }

            Entry.owner.write(DynamicProperty.PhysicsState, Saved(Entry, Body));
            Worlds.set(Entry.dimension, Next);
        }),
        remove: (id: string) => Attempt(() =>
        {
            const Entry = Entries.get(id);
            if (!Entry)
            {
                return;
            }

            Entry.owner.remove();
            Forget(id);
        }),
        transfer: (id: string, dimension: string, pose: T.Transform) => Attempt(() =>
        {
            const Entry = Entries.get(id);
            if (!Entry)
            {
                throw new Error("Missing body");
            }

            const Old = World(Entry.dimension);
            const Body = R.getOrThrow(E.setPose(Old.bodies.find((body) => body.id === id)!, pose));
            const Next = Entry.dimension === dimension ? R.getOrThrow(W.set(Old, Body)) : R.getOrThrow(W.add(World(dimension), Body));
            Entry.owner.move(dimension, pose.position);
            if (Entry.dimension !== dimension)
            {
                Worlds.set(Entry.dimension, R.getOrThrow(W.remove(Old, id)));
            }

            DisposeAttachment(Entry);
            Entry.dimension = dimension;
            Worlds.set(dimension, Next);
            const Published = Publish(Entry, Body, true);
            Worlds.set(dimension, R.getOrThrow(W.set(Next, Published)));
        }),
        world: (dimension: string) => Worlds.get(dimension),
        registerTerrain: (resolver: Terrain.Resolver) =>
        {
            if (disposed)
            {
                return () =>
                {
                };
            }

            Resolvers.unshift(resolver);
            resolverRevision++;
            return () =>
            {
                const Index = Resolvers.indexOf(resolver);
                if (Index >= 0)
                {
                    Resolvers.splice(Index, 1);
                    resolverRevision++;
                }
            };
        },
        retry: () =>
        {
            if (!disposed)
            {
                for (const Owner of Host.discover())
                {
                    Restore(Owner);
                }
            }
        },
        dispose: Dispose
    }));
};
