/**
 * Authoritative rigid collision queries, manifolds and angular-bounded CCD.
 *
 * @module bedform/Collision
 *
 * @file      Collision.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Geometric records retain mathematical ordering and contextual local types. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as B from "./AABB.js";
import type * as C from "./CollisionShape.js";
import * as G from "./Internal/CollisionGeometry.js";
import * as K from "./Internal/CollisionContact.js";
import * as M from "./Internal/CollisionMath.js";
import * as N from "./Internal/CollisionConvex.js";
import * as O from "@bedform/effect/Option";
import * as Profile from "./Internal/PhysicsProfile.js";
import * as Q from "./Quat.js";
import * as R from "@bedform/effect/Result";
import * as RT from "./RigidTransform.js";
import * as T from "./Transform.js";
import * as V from "./Vector3.js";
import { dual } from "@bedform/effect/Function";
const TypeId = "~bedform/Collision" as const;
const Geometries = new WeakMap<Shape, G.Geometry>();
const Poses = new WeakMap<T.Transform, T.Transform>();

/**
 * Derived geometry for one validated immutable pose; weak keys do not retain
 * old solver poses or shape registrations and never affect authoritative state.
 *
 * @category Internal
 * @since 1.0.0
 */
interface PlacedGeometry
{
    readonly bounds: WeakMap<G.Node, B.AABB>;
    readonly leaves: WeakMap<G.Leaf, G.Placed>;
}
const Placements = new WeakMap<T.Transform, PlacedGeometry>();

/**
 * Reuses only exact immutable pose/geometry identities, including across repeated
 * contact reads at the same substep. New poses get independent derived values.
 *
 * @category Internal
 * @since 1.0.0
 */
const placement = (transform: T.Transform): PlacedGeometry =>
{
    let value = Placements.get(transform);
    if (!value)
    {
        value = { bounds: new WeakMap(),
            leaves: new WeakMap() };
        Placements.set(transform, value);
    }

    return value;
};

/**
 * Immutable prepared geometry handle with an owned model BVH and support maps.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Shape
{
    readonly [TypeId]: typeof TypeId;
    readonly bounds: B.AABB;
    readonly radius: number;
    readonly leafCount: number;
}

/**
 * Authoritative model-origin pose, independent of root offsets or renderer samples.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Instance
{
    readonly shape: Shape;
    readonly pose: T.Coordinates;
}

/**
 * Typed failures for caller validation, exhausted work or unsupported convergence.
 * A solver must pause the affected island and report this diagnostic.
 *
 * @category Errors
 * @since 1.0.0
 */
export interface Diagnostic
{
    readonly _tag: "CollisionError";
    readonly code: "InvalidInput" | "ComplexityLimit" | "NonConvergence";
    readonly stage: "validation" | "gjk" | "epa" | "manifold" | "bvh" | "ccd";
    readonly message: string;
}

/**
 * Finite nonnegative tolerances in blocks plus model-radius relative tolerance.
 * Iteration and traversal budgets may be reduced for deterministic failure handling.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly absoluteTolerance?: number;
    readonly relativeTolerance?: number;
    readonly maxGjkIterations?: number;
    readonly maxEpaIterations?: number;
    readonly maxCcdIterations?: number;
    readonly maxPairs?: number;
    readonly maxNodes?: number;
}

/**
 * Closest world-space witnesses. Intersecting/touching solids have zero distance.
 * At a coincident witness the deterministic fallback normal is positive X.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Distance
{
    readonly distance: number;
    readonly normal: V.Vector3;
    readonly pointA: V.Vector3;
    readonly pointB: V.Vector3;
}

/**
 * World-space surface witnesses and penetration depth in blocks.
 * Feature identifiers are deterministic geometry features, not persistent body IDs.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Contact extends K.Contact
{
}

/**
 * Up to four clipped/merged contacts sharing a normal from the first body to the second.
 * Distinct exterior normal patches remain separate; internal partition faces never respond.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Manifold
{
    readonly normal: V.Vector3;
    readonly contacts: ReadonlyArray<Contact>;
}

/**
 * Constant COM linear and world angular velocity trajectory. RigidTransform linear
 * velocity is at the model origin; centerOfMass is a local block offset (default zero).
 * CCD converts vCOM = vOrigin + omega cross (COM-origin) before advancing COM and
 * rotation, then derives origin from the rotated COM offset. Full rotations are allowed.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Motion
{
    readonly shape: Shape;
    readonly state: RT.Coordinates;
    readonly centerOfMass?: V.Coordinates;
}

/**
 * Conservative first-contact time in seconds and normalized fraction of the horizon.
 * Hits are within the configured geometric tolerance, including an initial overlap.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Hit extends Distance
{
    readonly time: number;
    readonly fraction: number;
}

/**
 * Data-first and data-last authoritative pair query overloads.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PairQuery<A>
{
    (a: Instance, b: Instance, options?: Options): R.Result<A, Diagnostic>;
    (b: Instance, options?: Options): (a: Instance) => R.Result<A, Diagnostic>;
}

/**
 * Data-first and data-last continuous query overloads with a seconds horizon.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SweepQuery
{
    (a: Motion, b: Motion, duration: number, options?: Options): R.Result<O.Option<Hit>, Diagnostic>;
    (b: Motion, duration: number, options?: Options): (a: Motion) => R.Result<O.Option<Hit>, Diagnostic>;
}

/**
 * Applies the Result boundary to internal typed convergence exceptions.
 *
 * @category Internal
 * @since 1.0.0
 */
const attempt = <A>(operation: () => A): R.Result<A, Diagnostic> =>
{
    try
    {
        return R.succeed(operation());
    }
    catch (error)
    {
        const Fault = error instanceof G.Fault ? error : new G.Fault("validation", "InvalidInput", error instanceof Error ? error.message : "Malformed collision input");
        return R.fail(Object.freeze({ _tag: "CollisionError",
            code: Fault.code,
            stage: Fault.stage,
            message: Fault.message }));
    }
};

/**
 * Copies and validates a collider once, constructing its immutable spatial hierarchy.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const prepare = (shape: C.CollisionShape): R.Result<Shape, Diagnostic> =>
{
    return attempt(() =>
    {
        const Geometry = G.prepare(shape);
        const Shape: Shape = Object.freeze({ [TypeId]: TypeId,
            bounds: Geometry.root.bounds,
            radius: Geometry.radius,
            leafCount: Geometry.leaves.length });
        Geometries.set(Shape, Geometry);
        return Shape;
    });
};

/**
 * Retrieves owned prepared geometry and rejects forged handles.
 *
 * @throws { G.Fault } The shape was not prepared by this module.
 *
 * @category Internal
 * @since 1.0.0
 */
const geometry = (shape: Shape): G.Geometry =>
{
    const Geometry = Geometries.get(shape);
    if (!Geometry)
    {
        throw new G.Fault("validation", "InvalidInput", "Unrecognized prepared collision shape");
    }

    return Geometry;
};

/**
 * Validates finite work limits and computes the pair's geometric tolerance.
 *
 * @throws { G.Fault } Invalid tolerance or query budget.
 *
 * @category Internal
 * @since 1.0.0
 */
const settings = (a: Shape, b: Shape, options: Options): Required<Options> =>
{
    geometry(a);
    geometry(b);
    const Settings = { absoluteTolerance: options.absoluteTolerance ?? 1e-7,
        relativeTolerance: options.relativeTolerance ?? 1e-7,
        maxGjkIterations: options.maxGjkIterations ?? 64,
        maxEpaIterations: options.maxEpaIterations ?? 128,
        maxCcdIterations: options.maxCcdIterations ?? 128,
        maxPairs: options.maxPairs ?? 16_384,
        maxNodes: options.maxNodes ?? 65_536 };
    if (![ Settings.absoluteTolerance, Settings.relativeTolerance ].every((n) => Number.isFinite(n) && n >= 0) ||
        Settings.absoluteTolerance + Settings.relativeTolerance === 0)
    {
        throw new G.Fault("validation", "InvalidInput", "A positive finite combined tolerance is required");
    }

    for (const [ Key, Maximum ] of [ [ "maxGjkIterations", 256 ], [ "maxEpaIterations", 256 ], [ "maxCcdIterations", 256 ], [ "maxPairs", 65_536 ], [ "maxNodes", 262_144 ] ] as const)
    {
        if (!Number.isSafeInteger(Settings[Key]) || Settings[Key] < 1 || Settings[Key] > Maximum)
        {
            throw new G.Fault("validation", "InvalidInput", `Invalid ${Key} budget`);
        }
    }

    return Settings;
};

/**
 * Checks and normalizes an authoritative body pose without modifying its input.
 *
 * @throws { G.Fault } Nonfinite or unrepresentable body coordinates.
 *
 * @category Internal
 * @since 1.0.0
 */
const pose = (input: T.Coordinates): T.Transform =>
{
    const Previous = Poses.get(input as T.Transform);
    if (Previous)
    {return Previous;}

    if (!T.isValid(input) || M.length(input.position) > 1e9)
    {
        throw new G.Fault("validation", "InvalidInput", "Invalid authoritative pose");
    }

    const Immutable = T.isTransform(input) && Object.isFrozen(input) && Object.isFrozen(input.position) && Object.isFrozen(input.rotation);
    const Cached = Immutable ? Poses.get(input) : undefined;
    if (Cached)
    {return Cached;}

    const Result = O.getOrThrow(T.Transform(input.position, input.rotation));
    if (Immutable)
    {Poses.set(input, Result);}

    return Result;
};

/**
 * Returns enclosing world bounds for the prepared exact collider.
 *
 * @category Queries
 * @since 1.0.0
 */
export const bounds = (instance: Instance): R.Result<B.AABB, Diagnostic> =>
{
    return attempt(() => G.transformBounds(geometry(instance.shape).root.bounds, pose(instance.pose)));
};

/**
 * Traverses paired model BVHs with distance lower-bound pruning. Every leaf and node
 * visit is budgeted; geometry is never replaced by the hierarchy's bounding boxes.
 *
 * @throws { G.Fault } Traversal or convergence budgets are exhausted.
 *
 * @category Internal
 * @since 1.0.0
 */
const traverse = (a: Instance, b: Instance, options: Required<Options>, contacts: boolean): Distance | ReadonlyArray<Manifold> =>
{
    const Metrics = Profile.current();
    const A = geometry(a.shape);
    const Bv = geometry(b.shape);
    const PoseA = pose(a.pose);
    const PoseB = pose(b.pose);
    const Tolerance = options.absoluteTolerance + options.relativeTolerance * Math.max(a.shape.radius, b.shape.radius);
    const Stack: Array<readonly [
        G.Node,
        G.Node
    ]> = [ [ A.root, Bv.root ] ];
    const CacheA = placement(PoseA);
    const CacheB = placement(PoseB);
    const Box = (node: G.Node, cache: PlacedGeometry, transform: T.Transform): B.AABB =>
    {
        if (!cache.bounds.has(node))
        {
            cache.bounds.set(node, G.transformBounds(node.bounds, transform));
        }

        return cache.bounds.get(node)!;
    };

    const Place = (leaf: G.Leaf, cache: PlacedGeometry, transform: T.Transform): G.Placed =>
    {
        let placed = cache.leaves.get(leaf);
        if (!placed)
        {
            placed = G.place(leaf, transform);
            cache.leaves.set(leaf, placed);
        }

        return placed;
    };

    let best: Distance | undefined;
    let pairs = 0;
    let nodes = 0;
    let internalFailure: G.Fault | undefined;
    const Patches: Array<K.Patch> = [];
    while (Stack.length)
    {
        if (Metrics)
        {Metrics.bvhNodes++;}

        if (++nodes > options.maxNodes)
        {
            throw new G.Fault("bvh", "ComplexityLimit", "Model node-pair budget exceeded");
        }

        const [ Left, Right ] = Stack.pop()!;
        if (G.boxDistance(Box(Left, CacheA, PoseA), Box(Right, CacheB, PoseB)) > (contacts ? Tolerance : best?.distance ?? Infinity) + Tolerance)
        {
            continue;
        }

        if (!Left.leaf || !Right.leaf)
        {
            if (Left.leaf)
            {
                Stack.push([ Left, Right.right! ], [ Left, Right.left! ]);
            }
            else if (Right.leaf)
            {
                Stack.push([ Left.right!, Right ], [ Left.left!, Right ]);
            }
            else
            {
                Stack.push([ Left.right!, Right.right! ], [ Left.right!, Right.left! ], [ Left.left!, Right.right! ], [ Left.left!, Right.left! ]);
            }

            continue;
        }

        if (++pairs > options.maxPairs)
        {
            throw new G.Fault("bvh", "ComplexityLimit", "Convex leaf-pair budget exceeded");
        }

        const PlacedA = Place(Left.leaf, CacheA, PoseA);
        if (Metrics)
        {Metrics.leafPairs++;}

        const PlacedB = Place(Right.leaf, CacheB, PoseB);
        const Polyhedral = contacts ? N.polyhedral(PlacedA, PlacedB) : undefined;
        const Round = N.round(PlacedA, PlacedB);
        const Analytic = Polyhedral ?? Round;
        const Closest = Analytic ? { distance: Math.max(0, -Analytic.depth),
            normal: Analytic.normal,
            pointA: Analytic.pointA,
            pointB: Analytic.pointB,
            simplex: [] } :
            N.distance(PlacedA, PlacedB, Tolerance, options.maxGjkIterations);
        if (!best || Closest.distance < best.distance)
        {
            best = Object.freeze({ distance: Closest.distance,
                normal: Closest.normal,
                pointA: Closest.pointA,
                pointB: Closest.pointB });
        }

        if (contacts && Closest.distance <= Tolerance)
        {
            const Penetration = Polyhedral ?? N.penetration(PlacedA, PlacedB, Closest, Tolerance, options.maxEpaIterations);
            try
            {
                Patches.push(K.patch(PlacedA, PlacedB, Penetration, Tolerance));
            }
            catch (error)
            {
                if (error instanceof G.Fault && error.stage === "manifold")
                {
                    internalFailure = error;
                }
                else
                {
                    throw error;
                }
            }
        }
    }

    if (contacts)
    {
        if (!Patches.length && internalFailure)
        {
            throw internalFailure;
        }

        return Object.freeze(K.merge(Patches, Tolerance));
    }

    if (!best)
    {
        throw new G.Fault("bvh", "NonConvergence", "No convex distance witness was found");
    }

    return best;
};

/**
 * Computes exact convex/compound minimum distance to the configured convergence tolerance.
 *
 * @category Queries
 * @since 1.0.0
 */
export const distance: PairQuery<Distance> = dual((args: IArguments) => args.length >= 2 && typeof args[1] === "object" && args[1] !== null && "shape" in args[1], (a: Instance, b: Instance, options: Options = {}) => attempt(() => traverse(a, b, settings(a.shape, b.shape, options), false) as Distance));

/**
 * Produces exterior contact manifolds, with successful empty output for separated solids.
 *
 * @category Queries
 * @since 1.0.0
 */
export const collide: PairQuery<ReadonlyArray<Manifold>> = dual((args: IArguments) => args.length >= 2 && typeof args[1] === "object" && args[1] !== null && "shape" in args[1], (a: Instance, b: Instance, options: Options = {}) => attempt(() => traverse(a, b, settings(a.shape, b.shape, options), true) as ReadonlyArray<Manifold>));

/**
 * Evaluated constant-COM-velocity trajectory and its angular reach bound.
 *
 * @category Types
 * @since 1.0.0
 */
interface Trajectory
{
    readonly center: V.Vector3;
    readonly at: (time: number) => Instance;
    readonly velocity: V.Vector3;
    readonly angularSpeed: number;
    readonly reach: number;
}

/**
 * Converts origin motion to COM motion and supports arbitrary full-turn angular paths.
 *
 * @throws { G.Fault } Invalid motion or trajectory domain.
 *
 * @category Internal
 * @since 1.0.0
 */
const trajectory = (input: Motion): Trajectory =>
{
    geometry(input.shape);
    if (!RT.isValid(input.state))
    {
        throw new G.Fault("validation", "InvalidInput", "Invalid origin-motion state");
    }

    const Start = pose(input.state);
    const LocalCOM = input.centerOfMass ?? V.Zero;
    if (!V.isFinite(LocalCOM) || M.length(LocalCOM) > 1e6)
    {
        throw new G.Fault("validation", "InvalidInput", "Invalid local COM offset");
    }

    const Offset = O.getOrThrow(Q.rotateVector(Start.rotation, LocalCOM));
    const COM = M.add(Start.position, Offset);
    const Angular = input.state.angularVelocity;
    const Velocity = M.add(input.state.linearVelocity, M.cross(Angular, Offset));
    if (!V.isFinite(Velocity) || !Number.isFinite(M.length(Angular)) || !Number.isFinite(M.length(Velocity)))
    {
        throw new G.Fault("validation", "InvalidInput", "Unrepresentable COM/angular motion");
    }

    return { center: COM,
        velocity: Velocity,
        angularSpeed: M.length(Angular),
        reach: G.reach(input.shape.bounds, LocalCOM),
        at: (time: number): Instance =>
        {
            if (time === 0 || Velocity.x === 0 && Velocity.y === 0 && Velocity.z === 0 && Angular.x === 0 && Angular.y === 0 && Angular.z === 0)
            {
                return { shape: input.shape,
                    pose: Start };
            }

            if (Angular.x === 0 && Angular.y === 0 && Angular.z === 0)
            {
                return { shape: input.shape,
                    pose: T.TransformUnsafe(M.add(Start.position, M.scale(Velocity, time)), Start.rotation) };
            }

            const Delta = O.getOrThrow(Q.fromRotationVector(M.scale(Angular, time)));
            const Rotation = O.getOrThrow(Q.normalize(Q.multiply(Delta, Start.rotation)));
            const Origin = M.sub(M.add(COM, M.scale(Velocity, time)), O.getOrThrow(Q.rotateVector(Rotation, LocalCOM)));
            return { shape: input.shape,
                pose: T.TransformUnsafe(Origin, Rotation) };
        } };
};

/**
 * Encloses the complete COM segment expanded by angular reach for any number of
 * turns. This is a conservative broad-phase bound, never a narrow-phase replacement.
 *
 * @category Queries
 * @since 1.0.0
 */
export const sweptBounds: {
    (motion: Motion, duration: number): R.Result<B.AABB, Diagnostic>;
    (duration: number): (motion: Motion) => R.Result<B.AABB, Diagnostic>;
} = dual(2, (motion: Motion, duration: number) => attempt(() =>
{
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
    {
        throw new G.Fault("validation", "InvalidInput", "Invalid sweep horizon");
    }

    const Trajectory = trajectory(motion);
    const End = M.add(Trajectory.center, M.scale(Trajectory.velocity, duration));
    if (!V.isFinite(End) || M.length(End) > 1e9)
    {
        throw new G.Fault("validation", "InvalidInput", "Unrepresentable COM segment");
    }

    return O.getOrThrow(B.expand(O.getOrThrow(B.fromPoints([ Trajectory.center, End ])), Trajectory.reach));
}));

/**
 * Conservative advancement uses a global relative-speed bound plus angular reach
 * bounds, not visual endpoints or discrete swept samples. Exhaustion is a typed
 * failure, never a false miss. Constant COM/world angular velocities define the path.
 *
 * @category Queries
 * @since 1.0.0
 */
export const sweep: SweepQuery = dual((args: IArguments) => args.length >= 3 && typeof args[1] === "object", (a: Motion, b: Motion, duration: number, options: Options = {}) => attempt(() =>
{
    const Settings = settings(a.shape, b.shape, options);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
    {
        throw new G.Fault("validation", "InvalidInput", "CCD duration must be in (0,60] seconds");
    }

    const A = trajectory(a);
    const Bv = trajectory(b);
    const Tolerance = Settings.absoluteTolerance + Settings.relativeTolerance * Math.max(a.shape.radius, b.shape.radius);
    const Metrics = Profile.current();
    const StartA = A.at(0).pose;
    const StartB = Bv.at(0).pose;
    const Swept = (node: G.Node, path: Trajectory, motion: Motion, start: T.Coordinates): B.AABB =>
    {
        if (path.angularSpeed === 0)
        {
            const First = G.transformBounds(node.bounds, pose(start));
            const Delta = M.scale(path.velocity, duration);
            return B.AABBUnsafe(V.min(First.min, M.add(First.min, Delta)), V.max(First.max, M.add(First.max, Delta)));
        }

        const End = M.add(path.center, M.scale(path.velocity, duration));
        const Reach = G.reach(node.bounds, motion.centerOfMass ?? V.Zero);
        return O.getOrThrow(B.expand(B.AABBUnsafe(V.min(path.center, End), V.max(path.center, End)), Reach));
    };

    const BoundsA = new Map<G.Node, B.AABB>();
    const BoundsB = new Map<G.Node, B.AABB>();
    const Bound = (node: G.Node, cache: Map<G.Node, B.AABB>, path: Trajectory, motion: Motion, start: T.Coordinates): B.AABB =>
    {
        let value = cache.get(node);
        if (!value)
        {
            value = Swept(node, path, motion, start);
            cache.set(node, value);
        }

        return value;
    };

    const Stack: Array<readonly [G.Node, G.Node]> = [ [ geometry(a.shape).root, geometry(b.shape).root ] ];
    const Relative = M.sub(A.velocity, Bv.velocity);
    let best: Hit | undefined;
    let nodes = 0;
    let pairs = 0;
    let iterations = 0;
    while (Stack.length)
    {
        if (++nodes > Settings.maxNodes)
        {throw new G.Fault("bvh", "ComplexityLimit", "CCD model node-pair budget exceeded");}

        if (Metrics)
        {Metrics.bvhNodes++;}

        const [ Left, Right ] = Stack.pop()!;
        if (G.boxDistance(Bound(Left, BoundsA, A, a, StartA), Bound(Right, BoundsB, Bv, b, StartB)) > Tolerance * 2)
        {continue;}

        if (!Left.leaf || !Right.leaf)
        {
            if (Left.leaf)
            {Stack.push([ Left, Right.right! ], [ Left, Right.left! ]);}
            else if (Right.leaf)
            {Stack.push([ Left.right!, Right ], [ Left.left!, Right ]);}
            else
            {Stack.push([ Left.right!, Right.right! ], [ Left.right!, Right.left! ], [ Left.left!, Right.right! ], [ Left.left!, Right.left! ]);}

            continue;
        }

        if (++pairs > Settings.maxPairs)
        {throw new G.Fault("bvh", "ComplexityLimit", "CCD convex leaf-pair budget exceeded");}

        if (Metrics)
        {Metrics.leafPairs++;}

        let time = 0;
        let resolved = false;
        const Horizon = best?.time ?? duration;
        for (let iteration = 0; iteration < Settings.maxCcdIterations; iteration++)
        {
            if (++iterations > Settings.maxCcdIterations)
            {throw new G.Fault("ccd", "NonConvergence", `CCD exceeded ${Settings.maxCcdIterations} iterations`);}

            if (Metrics)
            {Metrics.ccdIterations++;}

            const PlacedA = G.place(Left.leaf, A.at(time).pose);
            const PlacedB = G.place(Right.leaf, Bv.at(time).pose);
            // A SAT gap is a conservative distance lower bound. Its separating
            // plane is sufficient for certified advancement; public distance()
            // continues returning Euclidean GJK distance rather than this bound.
            const Analytic = N.polyhedral(PlacedA, PlacedB) ?? N.round(PlacedA, PlacedB);
            let Closest = Analytic ? { distance: Math.max(0, -Analytic.depth),
                normal: Analytic.normal,
                pointA: Analytic.pointA,
                pointB: Analytic.pointB } :
                N.distance(PlacedA, PlacedB, Tolerance, Settings.maxGjkIterations);
            if (Analytic && Closest.distance <= Tolerance * 2)
            {
                // The SAT gap guides advancement, but a reported hit retains
                // actual convex witnesses and the public Euclidean tolerance.
                Closest = N.distance(PlacedA, PlacedB, Tolerance, Settings.maxGjkIterations);
            }

            if (Closest.distance <= Tolerance * 2)
            {
                best = Object.freeze({ distance: Closest.distance,
                    normal: Closest.normal,
                    pointA: Closest.pointA,
                    pointB: Closest.pointB,
                    time,
                    fraction: time / duration });
                resolved = true;
                break;
            }

            const Closing = Math.max(0, M.dot(Relative, Closest.normal)) + A.angularSpeed * A.reach + Bv.angularSpeed * Bv.reach;
            if (Closing <= 0)
            {
                resolved = true;
                break;
            }

            const Advance = (Closest.distance - Tolerance) / Closing;
            if (Advance > Horizon - time)
            {
                resolved = true;
                break;
            }

            if (Advance <= Number.EPSILON * Math.max(1, time))
            {throw new G.Fault("ccd", "NonConvergence", "Conservative advancement stalled");}

            time += Advance;
        }

        if (!resolved)
        {throw new G.Fault("ccd", "NonConvergence", `CCD exceeded ${Settings.maxCcdIterations} iterations`);}

        if (best?.time === 0)
        {break;}
    }

    return best ? O.some(best) : O.none();
}));
