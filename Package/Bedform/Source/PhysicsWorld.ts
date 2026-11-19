/**
 * Immutable deterministic 50 ms physics worlds with transactional island failures.
 *
 * @module bedform/PhysicsWorld
 *
 * @file      PhysicsWorld.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* World records preserve physical ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Body from "./Internal/PhysicsBody.js";
import * as P from "./Internal/PhysicsMath.js";
import * as Solver from "./Internal/PhysicsSolver.js";
import * as Profile from "./Internal/PhysicsProfile.js";
import * as C from "./Collision.js";
import * as B from "./AABB.js";
import type * as BP from "./CollisionBroadPhase.js";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import * as V from "./Vector3.js";
import { dual } from "@bedform/effect/Function";

const TypeId = "~bedform/PhysicsWorld" as const;
const Caches = new WeakMap<PhysicsWorld, ReadonlyArray<Solver.Cached>>();
const Acceleration = new WeakMap<PhysicsWorld, BP.Tree>();

/**
 * Fixed substeps, iterations and contact coefficients in seconds/SI units.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Settings = Solver.Settings;

/**
 * Explicit world configuration; importing or constructing a world starts no engine loop.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly gravity?: V.Coordinates;
    readonly collision?: C.Options;
    readonly maxBodies?: number;
    readonly maxPairs?: number;
    readonly maxImpacts?: number;
}

/**
 * Validated immutable work limits used by the world and collision stages.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Limits extends Solver.Options
{
    readonly maxBodies: number;
}

/**
 * Full immutable committed state. Events/diagnostics describe the last operation;
 * caller-owned inputs and older snapshots remain untouched by every update.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PhysicsWorld extends Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly tick: number;
    readonly revision: number;
    readonly gravity: V.Vector3;
    readonly limits: Limits;
    readonly bodies: ReadonlyArray<Body.PhysicsEntity>;
    readonly contacts: ReadonlyArray<Solver.ContactPair>;
    readonly events: ReadonlyArray<Solver.Event>;
    readonly diagnostics: ReadonlyArray<Solver.Diagnostic>;
}

/**
 * Receiver operations support direct and curried functional composition.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Update<A>
{
    (self: PhysicsWorld, value: A): R.Result<PhysicsWorld, P.PhysicsError>;
    (value: A): (self: PhysicsWorld) => R.Result<PhysicsWorld, P.PhysicsError>;
}

/**
 * Canonical world state includes warm starts because they affect future integration.
 *
 * @category Internal
 * @since 1.0.0
 */
const key = (self: PhysicsWorld): string =>
{
    return JSON.stringify([ self.tick, self.revision, self.gravity, self.limits, self.bodies.map(Body.valueKey), self.contacts, self.events, self.diagnostics, Caches.get(self) ]);
};

const Prototype = Object.freeze({ ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Compares complete deterministic world values.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: PhysicsWorld, that: Equal.Equal): boolean
    {
        return isPhysicsWorld(that) && key(this) === key(that);
    },

    /**
     * Hashes the same complete state used for world equality.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: PhysicsWorld): number
    {
        return Hash.string(key(this));
    },

    /**
     * Publishes frozen inspectable state; runtime subscriptions and buffers are absent.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: PhysicsWorld): unknown
    {
        return Object.freeze({ _id: "PhysicsWorld",
            ...this });
    },

    /**
     * Emits full-precision public state for diagnostics.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: PhysicsWorld): string
    {
        return JSON.stringify(this.toJSON());
    }
});

/**
 * Recognizes immutable worlds with owned warm-start state.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isPhysicsWorld = (value: unknown): value is PhysicsWorld =>
{
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Prototype && Caches.has(value as PhysicsWorld);
};

/**
 * Validates a world receiver and monotonic counter domain.
 *
 * @throws { P.Fault } Forged input or exhausted counter domain.
 *
 * @category Internal
 * @since 1.0.0
 */
const check = (self: PhysicsWorld): void =>
{
    if (!isPhysicsWorld(self))
    {
        throw new P.Fault("InvalidInput", "Expected a PhysicsWorld");
    }

    if (!Number.isSafeInteger(self.revision + 1) || !Number.isSafeInteger(self.tick + 1))
    {
        throw new P.Fault("ComplexityLimit", "World counters exhausted");
    }
};

/**
 * Owns immutable snapshots and warm-start arrays for a new world value.
 *
 * @category Internal
 * @since 1.0.0
 */
const copy = (self: PhysicsWorld, patch: Partial<PhysicsWorld>, cache = Caches.get(self)!): PhysicsWorld =>
{
    const Next = Object.freeze(Object.assign(Object.create(Prototype) as PhysicsWorld, self, { revision: self.revision + 1,
        events: Object.freeze([]),
        diagnostics: Object.freeze([]) }, patch));
    Caches.set(Next, cache);
    const Tree = Acceleration.get(self);
    if (Tree)
    {Acceleration.set(Next, Tree);}

    return Next;
};

/**
 * Changes to infinite-mass anchors wake old contacts and newly overlapping sleepers.
 *
 * @category Internal
 * @since 1.0.0
 */
const wakeNeighbors = (self: PhysicsWorld, changed: Body.PhysicsEntity, bodies: ReadonlyArray<Body.PhysicsEntity>): ReadonlyArray<Body.PhysicsEntity> =>
{
    if (changed.mode === "dynamic")
    {
        return bodies;
    }

    const Bounds = R.getOrThrow(C.bounds({shape:changed.definition.shape,
        pose:changed.pose}));
    return Object.freeze(bodies.map((body) =>
    {
        if (body.mode !== "dynamic" || !body.sleeping)
        {
            return body;
        }

        const Contact = self.contacts.some((p) => p.first === changed.id && p.second === body.id || p.second === changed.id && p.first === body.id);
        const Overlap = O.getOrThrow(B.overlaps(Bounds, R.getOrThrow(C.bounds({shape:body.definition.shape,
            pose:body.pose}))));
        return Contact || Overlap ? R.getOrThrow(Body.wake(body)) : body;
    }));
};

/**
 * Creates an empty deterministic world with default gravity (0,-9.81,0).
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (options: Options = {}): R.Result<PhysicsWorld, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        const Gravity = P.vector(options.gravity === undefined ? V.Vector3Unsafe(0, -9.81, 0) : options.gravity, "world gravity");
        const MaxBodies = options.maxBodies === undefined ? 4_096 : options.maxBodies;
        const MaxPairs = options.maxPairs === undefined ? 65_536 : options.maxPairs;
        const MaxImpacts = options.maxImpacts === undefined ? 8 : options.maxImpacts;
        for (const [ Value, Maximum ] of [ [ MaxBodies, 4_096 ], [ MaxPairs, 1_000_000 ], [ MaxImpacts, 64 ] ])
        {
            if (!Number.isSafeInteger(Value) || Value < 1 || Value > Maximum)
            {
                throw new P.Fault("InvalidInput", "Invalid world work budget");
            }
        }

        if (options.collision !== undefined && (!options.collision || typeof options.collision !== "object" || Array.isArray(options.collision)))
        {
            throw new P.Fault("InvalidInput", "Invalid collision options");
        }

        const Collision = { ...options.collision };
        const Allowed = [ "absoluteTolerance", "relativeTolerance", "maxGjkIterations", "maxEpaIterations", "maxCcdIterations", "maxPairs", "maxNodes" ];
        if (Object.keys(Collision).some((key) => !Allowed.includes(key)))
        {
            throw new P.Fault("InvalidInput", "Unknown collision option");
        }

        for (const Name of [ "absoluteTolerance", "relativeTolerance" ] as const)
        {
            if (Collision[Name] !== undefined && (!Number.isFinite(Collision[Name]) || Collision[Name]! < 0))
            {
                throw new P.Fault("InvalidInput", "Invalid collision tolerance");
            }
        }

        if ((Collision.absoluteTolerance ?? 1e-7) + (Collision.relativeTolerance ?? 1e-7) <= 0)
        {
            throw new P.Fault("InvalidInput", "A positive collision tolerance is required");
        }

        for (const [ Name, Maximum ] of [ [ "maxGjkIterations", 256 ], [ "maxEpaIterations", 256 ], [ "maxCcdIterations", 256 ], [ "maxPairs", 65_536 ], [ "maxNodes", 262_144 ] ] as const)
        {
            if (Collision[Name] !== undefined && (!Number.isSafeInteger(Collision[Name]) || Collision[Name]! < 1 || Collision[Name]! > Maximum))
            {
                throw new P.Fault("InvalidInput", `Invalid collision ${Name}`);
            }
        }

        const World = Object.freeze(Object.assign(Object.create(Prototype) as PhysicsWorld, { tick: 0,
            revision: 0,
            gravity: Gravity,
            limits: Object.freeze({ collision: Object.freeze(Collision),
                maxBodies: MaxBodies,
                maxPairs: MaxPairs,
                maxImpacts: MaxImpacts }),
            bodies: Object.freeze([]),
            contacts: Object.freeze([]),
            events: Object.freeze([]),
            diagnostics: Object.freeze([]) }));
        Caches.set(World, Object.freeze([]));
        return World;
    });
};

/**
 * Inserts an independently constructed body; duplicate IDs fail rather than replace data.
 *
 * @category Updates
 * @since 1.0.0
 */
export const add: Update<Body.PhysicsEntity> = dual(2, (self: PhysicsWorld, body: Body.PhysicsEntity) => P.attempt(() =>
{
    check(self);
    Body.check(body);
    if (self.bodies.some((b) => b.id === body.id))
    {
        throw new P.Fault("DuplicateBody", `Body ${body.id} already exists`);
    }

    if (self.bodies.length >= self.limits.maxBodies)
    {
        throw new P.Fault("ComplexityLimit", "World body capacity exceeded");
    }

    return copy(self, { bodies: wakeNeighbors(self, body, Object.freeze([ ...self.bodies, body ].sort((a, b) => a.id < b.id ? -1 : 1))) });
}));

/**
 * Replaces an immutable body, retaining warm starts for load/velocity-only updates.
 *
 * @category Updates
 * @since 1.0.0
 */
export const set: Update<Body.PhysicsEntity> = dual(2, (self: PhysicsWorld, body: Body.PhysicsEntity) => P.attempt(() =>
{
    check(self);
    Body.check(body);
    if (!self.bodies.some((b) => b.id === body.id))
    {
        throw new P.Fault("MissingBody", `No body ${body.id}`);
    }

    const Previous = self.bodies.find((b) => b.id === body.id)!;
    const Preserve = Previous.definition === body.definition && Previous.physical === body.physical && Equal.equals(Previous.pose, body.pose) &&
        Previous.mode === body.mode && Previous.restitution === body.restitution && Previous.paused === body.paused;
    return copy(self, { bodies: wakeNeighbors(self, body, Object.freeze(self.bodies.map((b) => b.id === body.id ? body : b))) },
        Preserve ? Caches.get(self)! : Object.freeze(Caches.get(self)!.filter((c) => c.first !== body.id && c.second !== body.id)));
}));

/**
 * Looks up an optional body while retaining typed receiver/ID validation.
 *
 * @category Inspection
 * @since 1.0.0
 */
export const get: {
    (self: PhysicsWorld, id: string): R.Result<O.Option<Body.PhysicsEntity>, P.PhysicsError>;
    (id: string): (self: PhysicsWorld) => R.Result<O.Option<Body.PhysicsEntity>, P.PhysicsError>;
} = dual(2, (self: PhysicsWorld, id: string) => P.attempt(() =>
{
    check(self);
    if (typeof id !== "string" || !id.length)
    {
        throw new P.Fault("InvalidInput", "Invalid body ID");
    }

    const Found = self.bodies.find((b) => b.id === id);
    return Found === undefined ? O.none() : O.some(Found);
}));

/**
 * Removes a body idempotently and emits ordered ends for its committed contacts.
 *
 * @category Updates
 * @since 1.0.0
 */
export const remove: Update<string> = dual(2, (self: PhysicsWorld, id: string) => P.attempt(() =>
{
    check(self);
    if (typeof id !== "string" || !id.length)
    {
        throw new P.Fault("InvalidInput", "Invalid body ID");
    }

    if (!self.bodies.some((b) => b.id === id))
    {
        return self;
    }

    const Ending = self.contacts.filter((p) => p.first === id || p.second === id);
    const WakeIDs = new Set(Ending.flatMap((p) => [ p.first, p.second ]));
    return copy(self, { bodies: Object.freeze(self.bodies.filter((b) => b.id !== id).map((b) => WakeIDs.has(b.id) && b.mode === "dynamic" ? R.getOrThrow(Body.wake(b)) : b)),
        contacts: Object.freeze(self.contacts.filter((p) => p.first !== id && p.second !== id)),
        events: Object.freeze(Ending.map((p) => Object.freeze({ type: "end" as const,
            first: p.first,
            second: p.second,
            tick: self.tick,
            time: 0 }))) },
    Object.freeze(Caches.get(self)!.filter((c) => c.first !== id && c.second !== id)));
}));

/**
 * Applies an atomic body operation to an existing ID, preserving both failures and immutability.
 *
 * @category Updates
 * @since 1.0.0
 */
export const modify: {
    (self: PhysicsWorld, id: string, operation: (body: Body.PhysicsEntity) => R.Result<Body.PhysicsEntity, P.PhysicsError>): R.Result<PhysicsWorld, P.PhysicsError>;
    (id: string, operation: (body: Body.PhysicsEntity) => R.Result<Body.PhysicsEntity, P.PhysicsError>): (self: PhysicsWorld) => R.Result<PhysicsWorld, P.PhysicsError>;
} = dual(3, (self: PhysicsWorld, id: string, operation: (body: Body.PhysicsEntity) => R.Result<Body.PhysicsEntity, P.PhysicsError>) =>
{
    return P.attempt(() =>
    {
        const Found = get(self, id);
        if (R.isFailure(Found))
        {
            throw new P.Fault(Found.failure.code, Found.failure.message);
        }

        if (O.isNone(Found.success))
        {
            throw new P.Fault("MissingBody", `No body ${id}`);
        }

        const Changed = operation(Found.success.value);
        if (R.isFailure(Changed))
        {
            throw new P.Fault(Changed.failure.code, Changed.failure.message);
        }

        Body.check(Changed.success);
        if (Changed.success.id !== id)
        {
            throw new P.Fault("InvalidInput", "A body update cannot change its ID");
        }

        const Updated = set(self, Changed.success);
        if (R.isFailure(Updated))
        {
            throw new P.Fault(Updated.failure.code, Updated.failure.message);
        }

        return Updated.success;
    });
});

/**
 * Changes world gravity and wakes bodies which inherit it, without altering poses.
 *
 * @category Updates
 * @since 1.0.0
 */
export const setGravity: Update<V.Coordinates> = dual(2, (self: PhysicsWorld, value: V.Coordinates) => P.attempt(() =>
{
    check(self);
    const Gravity = P.vector(value, "world gravity");
    return copy(self, { gravity: Gravity,
        bodies: Object.freeze(self.bodies.map((b) => O.isNone(b.gravity) && b.mode === "dynamic" ? R.getOrThrow(Body.wake(b)) : b)) });
}));

/**
 * Advances exactly one 50 ms tick with four substeps. Island failures are retained
 * in a successful world's diagnostics while unrelated islands continue to advance.
 *
 * @category Simulation
 * @since 1.0.0
 */
export const step = (self: PhysicsWorld, metrics?: (sample: StepMetrics) => void): R.Result<PhysicsWorld, P.PhysicsError> =>
{
    return Profile.observe(() => P.attempt(() =>
    {
        check(self);
        const Next = Solver.step(self.bodies, self.contacts, Caches.get(self)!, self.gravity, self.tick + 1, self.limits, undefined, 0, Acceleration.get(self));
        const World = copy(self, { tick: self.tick + 1,
            bodies: Next.bodies,
            contacts: Next.contacts,
            events: Next.events,
            diagnostics: Next.diagnostics }, Next.cache);
        if (Next.tree)
        {Acceleration.set(World, Next.tree);}

        return World;
    }), metrics);
};

/**
 * Observational world-step counters; absent observers incur no clock reads.
 *
 * @category Types
 * @since 1.0.0
 */
export interface StepMetrics extends Profile.Metrics {}

/**
 * Ordered contact, failure and public validation contracts.
 *
 * @category Types
 * @since 1.0.0
 */
export type { ContactPair, Event, Diagnostic } from "./Internal/PhysicsSolver.js";

/**
 * Typed world construction/update failures.
 *
 * @category Errors
 * @since 1.0.0
 */
export type { PhysicsError } from "./Internal/PhysicsMath.js";
