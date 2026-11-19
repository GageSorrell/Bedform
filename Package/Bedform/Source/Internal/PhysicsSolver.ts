/**
 * Four-substep rigid dynamics with warm-started contacts and bounded CCD response.
 *
 * @module bedform/Internal/PhysicsSolver
 *
 * @file      PhysicsSolver.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document solver constants at their export declarations. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Constraint matrices and private work buffers retain physical ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as Body from "./PhysicsBody.js";
import * as P from "./PhysicsMath.js";
import * as M from "./CollisionMath.js";
import * as G from "./CollisionGeometry.js";
import * as C from "../Collision.js";
import * as BP from "../CollisionBroadPhase.js";
import * as Profile from "./PhysicsProfile.js";
import * as B from "../AABB.js";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import * as T from "../Transform.js";
import * as RT from "../RigidTransform.js";
import * as Q from "../Quat.js";
import * as V from "../Vector3.js";
import type { Inertia } from "../PhysicsModel.js";

/**
 * Fixed SI units and deterministic solver limits.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Settings = Object.freeze({ tick: 0.05,
    substeps: 4,
    iterations: 10,
    friction: 0.5,
    restitutionThreshold: 1,
    replans: 4,
    slop: 1e-4,
    correction: 0.2,
    sleepLinear: 0.03,
    sleepAngular: 0.03,
    sleepSeconds: 0.5 } as const);

/**
 * Ordered authoritative contact-pair snapshot.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ContactPair
{
    readonly first: string;
    readonly second: string;
    readonly manifolds: ReadonlyArray<C.Manifold>;
}

/**
 * Ordered contact transition within one 50 ms tick, including transient CCD impacts.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Event
{
    readonly type: "begin" | "end";
    readonly first: string;
    readonly second: string;
    readonly tick: number;
    readonly time: number;
}

/**
 * Retained failed island and its typed cause; no body is discarded.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Diagnostic
{
    readonly code: "CollisionFailure" | "NumericalFailure" | "SolverLimit";
    readonly message: string;
    readonly bodies: ReadonlyArray<string>;
    readonly collision?: C.Diagnostic;
}

/**
 * Frozen warm-start impulse and local anchors from a previous solve.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Cached
{
    readonly key: string;
    readonly first: string;
    readonly second: string;
    readonly normal: V.Vector3;
    readonly localA: V.Vector3;
    readonly localB: V.Vector3;
    readonly impulse: number;
    readonly tangent: V.Vector3;
}

/**
 * A complete transactional tick result.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Output
{
    readonly tree?: BP.Tree;
    readonly bodies: ReadonlyArray<Body.PhysicsEntity>;
    readonly contacts: ReadonlyArray<ContactPair>;
    readonly events: ReadonlyArray<Event>;
    readonly diagnostics: ReadonlyArray<Diagnostic>;
    readonly cache: ReadonlyArray<Cached>;
}

/**
 * Per-world bounded work configuration; velocity iterations/substeps remain fixed.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly collision: C.Options;
    readonly maxPairs: number;
    readonly maxImpacts: number;
}

/**
 * Owned mutable work body; vector/tensor values themselves remain immutable.
 *
 * @category Types
 * @since 1.0.0
 */
interface Work
{
    readonly original: Body.PhysicsEntity;
    pose: T.Transform;
    com: V.Vector3;
    velocity: V.Vector3;
    angular: V.Vector3;
    momentum: V.Vector3;
    sleeping: boolean;
    sleepTime: number;
    correction: number;
}

/**
 * One accumulated normal and two-dimensional Coulomb constraint.
 *
 * @category Types
 * @since 1.0.0
 */
interface Constraint
{
    readonly mass: number;
    readonly u: V.Vector3;
    readonly w: V.Vector3;
    readonly tangentScale: number;
    readonly a11: number;
    readonly a22: number;
    readonly a12: number;
    readonly denominator: number;
    readonly a: Work;
    readonly b: Work;
    readonly normal: V.Vector3;
    readonly point: V.Vector3;
    readonly depth: number;
    readonly divisor: number;
    readonly key: string;
    readonly localA: V.Vector3;
    readonly localB: V.Vector3;
    readonly target: number;
    impulse: number;
    tangent: V.Vector3;
}

/**
 * Internal failure classified before island rollback.
 *
 * @category Internal
 * @since 1.0.0
 */
class StepFault extends Error
{
    constructor(readonly code: Diagnostic["code"], message: string, readonly collision?: C.Diagnostic)
    {
        super(message);
    }
}

/**
 * Requests a full transactional retry with a larger conservative motion envelope.
 *
 * @category Internal
 * @since 1.0.0
 */
class Replan extends Error
{
    constructor(readonly id: string, readonly margin: number)
    {
        super("Motion envelope changed after contact response");
    }
}
const PairKey = (a: string, b: string): string => JSON.stringify([ a, b ]);
const InvMass = (body: Work): number => body.original.mode === "dynamic" && !body.sleeping ? 1 / body.original.physical.mass : 0;

/**
 * Full inverse tensor cached only for the current immutable quaternion value.
 *
 * @category Internal
 * @since 1.0.0
 */
interface WorldInverse
{
    readonly rotation: Q.Quat;
    readonly matrix: Inertia;
}
const WorldInverses = new WeakMap<Work, WorldInverse>();

/**
 * Caches the full world inverse tensor while a body's orientation is fixed during
 * velocity iterations. It retains off-diagonal/angular response and zero native
 * inverse inertia; no diagonal approximation or altered iteration count is used.
 *
 * @category Internal
 * @since 1.0.0
 */
const InvTensor = (body: Work, vector: V.Coordinates): V.Vector3 =>
{
    if (!InvMass(body))
    {return V.Zero;}

    let inverse = WorldInverses.get(body);
    if (!inverse || inverse.rotation !== body.pose.rotation)
    {
        const X = P.world(body.original.inverseInertia, body.pose.rotation, V.UnitX);
        const Y = P.world(body.original.inverseInertia, body.pose.rotation, V.UnitY);
        const Z = P.world(body.original.inverseInertia, body.pose.rotation, V.UnitZ);
        inverse = { rotation: body.pose.rotation,
            matrix: Object.freeze([ X.x, Y.x, Z.x, X.y, Y.y, Z.y, X.z, Y.z, Z.z ]) };
        WorldInverses.set(body, inverse);
    }

    return P.apply(inverse.matrix, vector);
};

const At = (body: Work, point: V.Coordinates): V.Vector3 => body.original.mode === "static" || body.sleeping ? V.Zero : M.add(body.velocity, M.cross(body.angular, M.sub(point, body.com)));
const Instance = (body: Work): C.Instance => ({ shape: body.original.definition.shape,
    pose: body.pose });

/**
 * Verifies numerical integration before any immutable body is published.
 *
 * @throws { StepFault } Nonfinite or unsupported motion.
 *
 * @category Internal
 * @since 1.0.0
 */
const finite = (body: Work): void =>
{
    if (![ body.com, body.velocity, body.angular, body.momentum, body.pose.position ].every(V.isFinite) || M.length(body.pose.position) > 1e9)
    {
        throw new StepFault("NumericalFailure", "Rigid integration exceeded the finite coordinate domain");
    }
};

/**
 * Synchronizes model origin from COM and full orientation.
 *
 * @category Internal
 * @since 1.0.0
 */
const origin = (body: Work, rotation: Q.Quat): void =>
{
    body.pose = T.TransformUnsafe(M.sub(body.com, O.getOrThrow(Q.rotateVector(rotation, body.original.physical.centerOfMass))), rotation);
    if (body.original.mode === "dynamic")
    {
        body.angular = P.world(body.original.inverseInertia, rotation, body.momentum);
    }
    else
    {
        body.momentum = P.world(body.original.physical.inertia, rotation, body.angular);
    }

    finite(body);
};

/**
 * Applies a world impulse at the common contact point to one work body.
 *
 * @category Internal
 * @since 1.0.0
 */
const impulse = (body: Work, value: V.Coordinates, point: V.Coordinates): void =>
{
    const InverseMass = InvMass(body);
    if (!InverseMass)
    {
        return;
    }

    body.velocity = M.add(body.velocity, M.scale(value, InverseMass));
    body.momentum = M.add(body.momentum, M.cross(M.sub(point, body.com), value));
    body.angular = InvTensor(body, body.momentum);
};

/**
 * Bilinear effective inverse mass for contact directions, including tensor coupling.
 *
 * @category Internal
 * @since 1.0.0
 */
const effective = (a: Work, b: Work, point: V.Coordinates, left: V.Coordinates, right = left): number =>
{
    const RA = M.sub(point, a.com);
    const RB = M.sub(point, b.com);
    return (InvMass(a) + InvMass(b)) * M.dot(left, right) +
        M.dot(M.cross(RA, left), InvTensor(a, M.cross(RA, right))) + M.dot(M.cross(RB, left), InvTensor(b, M.cross(RB, right)));
};

/**
 * Ten accumulated sequential-impulse iterations, with fixed Coulomb coefficient and
 * thresholded max-participant restitution. Warm starting validates local anchors.
 *
 * @throws { StepFault } Effective mass is nonfinite or numerically singular.
 *
 * @category Internal
 * @since 1.0.0
 */
const solve = (frames: ReadonlyArray<ContactPair>, work: Map<string, Work>, cache: ReadonlyArray<Cached>, warm: boolean): ReadonlyArray<Cached> =>
{
    const Constraints: Array<Constraint> = [];
    const Previous = new Map(cache.map((c) => [ c.key, c ]));
    for (const Frame of frames)
    {
        for (const Manifold of Frame.manifolds)
        {
            for (const Contact of Manifold.contacts)
            {
                const A = work.get(Frame.first)!;
                const Bv = work.get(Frame.second)!;
                const Point = M.scale(M.add(Contact.pointA, Contact.pointB), 0.5);
                const Normal = Manifold.normal;
                const LocalA = O.getOrThrow(T.untransformPoint(A.pose, Point));
                const LocalB = O.getOrThrow(T.untransformPoint(Bv.pose, Point));
                const Key = JSON.stringify([ Frame.first, Frame.second, Contact.feature ]);
                const Cached = Previous.get(Key);
                const Reuse = warm && Cached && M.dot(Cached.normal, Normal) > 0.99 && M.length(M.sub(Cached.localA, LocalA)) < 0.05 && M.length(M.sub(Cached.localB, LocalB)) < 0.05;
                const Velocity = M.dot(M.sub(At(Bv, Point), At(A, Point)), Normal);
                const Mass = effective(A, Bv, Point, Normal);
                const Basis = Math.abs(Normal.x) < 0.7 ? V.UnitX : V.UnitY;
                const U = M.unit(M.cross(Normal, Basis));
                const W = M.cross(Normal, U);
                const K11 = effective(A, Bv, Point, U);
                const K22 = effective(A, Bv, Point, W);
                const K12 = effective(A, Bv, Point, U, W);
                const Scale = Math.max(K11, K22, Math.abs(K12));
                const A11 = Mass > 0 ? K11 / Scale : 0;
                const A22 = Mass > 0 ? K22 / Scale : 0;
                const A12 = Mass > 0 ? K12 / Scale : 0;
                const Denominator = A11 * A22 - A12 * A12;
                if (!Number.isFinite(Mass) || Mass > 0 && (!Number.isFinite(Scale) || Scale <= 0 || Denominator <= 0))
                {throw new StepFault("NumericalFailure", "Invalid contact effective mass");}

                Constraints.push({ a: A,
                    mass: Mass,
                    u: U,
                    w: W,
                    tangentScale: Scale,
                    a11: A11,
                    a22: A22,
                    a12: A12,
                    denominator: Denominator,
                    b: Bv,
                    point: Point,
                    normal: Normal,
                    depth: Contact.depth,
                    divisor: Manifold.contacts.length,
                    key: Key,
                    localA: LocalA,
                    localB: LocalB,
                    target: Velocity < -Settings.restitutionThreshold ? -Math.max(A.original.restitution, Bv.original.restitution) * Velocity : 0,
                    impulse: Reuse ? Cached.impulse : 0,
                    tangent: Reuse ? M.sub(Cached.tangent, M.scale(Normal, M.dot(Cached.tangent, Normal))) : V.Zero });
            }
        }
    }

    for (const Constraint of Constraints)
    {
        const Value = M.add(M.scale(Constraint.normal, Constraint.impulse), Constraint.tangent);
        impulse(Constraint.a, M.scale(Value, -1), Constraint.point);
        impulse(Constraint.b, Value, Constraint.point);
    }

    for (let iteration = 0; iteration < Settings.iterations; iteration++)
    {
        for (const Constraint of Constraints)
        {
            const { a: A, b: Bv, point: Point, normal: Normal } = Constraint;
            const Mass = Constraint.mass;
            if (!Number.isFinite(Mass))
            {
                throw new StepFault("NumericalFailure", "Contact effective mass overflow");
            }

            if (Mass <= 0)
            {
                continue;
            }

            const Speed = M.dot(M.sub(At(Bv, Point), At(A, Point)), Normal);
            const Total = Math.max(0, Constraint.impulse + (Constraint.target - Speed) / Mass);
            const Delta = M.scale(Normal, Total - Constraint.impulse);
            Constraint.impulse = Total;
            impulse(A, M.scale(Delta, -1), Point);
            impulse(Bv, Delta, Point);
            const U = Constraint.u;
            const W = Constraint.w;
            const Relative = M.sub(At(Bv, Point), At(A, Point));
            const Scale = Constraint.tangentScale;
            if (!Number.isFinite(Scale) || Scale <= 0)
            {
                throw new StepFault("NumericalFailure", "Invalid tangent effective mass");
            }

            const A11 = Constraint.a11;
            const A22 = Constraint.a22;
            const A12 = Constraint.a12;
            const Denominator = Constraint.denominator;
            if (Denominator <= 0)
            {
                throw new StepFault("NumericalFailure", "Singular tangent effective mass");
            }

            const Vu = M.dot(Relative, U);
            const Vw = M.dot(Relative, W);
            const Change = M.add(M.scale(U, (-A22 * (Vu / Scale) + A12 * (Vw / Scale)) / Denominator), M.scale(W, (A12 * (Vu / Scale) - A11 * (Vw / Scale)) / Denominator));
            let total = M.add(Constraint.tangent, Change);
            const Limit = Settings.friction * Total;
            if (M.length(total) > Limit)
            {
                total = M.scale(M.unit(total), Limit);
            }

            const TangentDelta = M.sub(total, Constraint.tangent);
            Constraint.tangent = total;
            impulse(A, M.scale(TangentDelta, -1), Point);
            impulse(Bv, TangentDelta, Point);
        }
    }

    for (const Constraint of Constraints)
    {
        finite(Constraint.a);
        finite(Constraint.b);
    }

    return Object.freeze(Constraints.map((c) => Object.freeze({ key: c.key,
        first: c.a.original.id,
        second: c.b.original.id,
        normal: c.normal,
        localA: c.localA,
        localB: c.localB,
        impulse: c.impulse,
        tangent: c.tangent })));
};

/**
 * Separate position correction does not add physical velocity or restitution energy.
 *
 * @category Internal
 * @since 1.0.0
 */
const correct = (frames: ReadonlyArray<ContactPair>, work: Map<string, Work>): void =>
{
    for (const Frame of frames)
    {
        for (const Patch of Frame.manifolds)
        {
            for (const Contact of Patch.contacts)
            {
                const A = work.get(Frame.first)!;
                const Bv = work.get(Frame.second)!;
                const Mass = InvMass(A) + InvMass(Bv);
                if (!Mass || Contact.depth <= Settings.slop)
                {
                    continue;
                }

                const Amount = Math.min(0.1, Settings.correction * (Contact.depth - Settings.slop) / Patch.contacts.length);
                let factor = 1;
                if (InvMass(A))
                {
                    factor = Math.min(factor, Math.max(0, 0.1 - A.correction) / (Amount * InvMass(A) / Mass));
                }

                if (InvMass(Bv))
                {
                    factor = Math.min(factor, Math.max(0, 0.1 - Bv.correction) / (Amount * InvMass(Bv) / Mass));
                }

                const Delta = M.scale(Patch.normal, Amount * factor / Mass);
                A.correction += M.length(Delta) * InvMass(A);
                Bv.correction += M.length(Delta) * InvMass(Bv);
                if (InvMass(A))
                {
                    A.com = M.sub(A.com, M.scale(Delta, InvMass(A)));
                    origin(A, A.pose.rotation);
                }

                if (InvMass(Bv))
                {
                    Bv.com = M.add(Bv.com, M.scale(Delta, InvMass(Bv)));
                    origin(Bv, Bv.pose.rotation);
                }
            }
        }
    }
};

/**
 * Midpoint angular integration predicts a constant segment angular velocity; CCD
 * and actual advancement use that exact same segment, preserving world angular momentum.
 *
 * @category Internal
 * @since 1.0.0
 */
const angular = (body: Work, duration: number): V.Vector3 =>
{
    if (body.original.mode !== "dynamic")
    {
        return body.angular;
    }

    const I = body.original.physical.inertia;
    if (I[0] === I[4] && I[4] === I[8] && I[1] === 0 && I[2] === 0 && I[3] === 0 && I[5] === 0 && I[6] === 0 && I[7] === 0)
    {return body.angular;}

    const Half = O.getOrThrow(Q.normalize(Q.multiply(O.getOrThrow(Q.fromRotationVector(M.scale(body.angular, duration / 2))), body.pose.rotation)));
    return P.world(body.original.inverseInertia, Half, body.momentum);
};

/**
 * Advances the exact COM/quaternion trajectory supplied to continuous queries.
 *
 * @category Internal
 * @since 1.0.0
 */
const advance = (bodies: ReadonlyArray<Work>, angles: Map<string, V.Vector3>, duration: number, validate: (body: Work) => void): void =>
{
    for (const Body of bodies)
    {
        if (Body.original.mode === "static" || Body.sleeping)
        {
            continue;
        }

        validate(Body);
        Body.com = M.add(Body.com, M.scale(Body.velocity, duration));
        const Delta = O.getOrThrow(Q.fromRotationVector(M.scale(angles.get(Body.original.id)!, duration)));
        origin(Body, O.getOrThrow(Q.normalize(Q.multiply(Delta, Body.pose.rotation))));
    }
};

/**
 * Maintains exact contact transitions as the solve advances through CCD segments.
 *
 * @category Internal
 * @since 1.0.0
 */
const transitions = (previous: ReadonlyArray<ContactPair>, current: ReadonlyArray<ContactPair>, tick: number, time: number, events: Array<Event>): void =>
{
    const Old = new Set(previous.map((p) => PairKey(p.first, p.second)));
    const Next = new Set(current.map((p) => PairKey(p.first, p.second)));
    for (const Pair of previous)
    {
        if (!Next.has(PairKey(Pair.first, Pair.second)))
        {
            events.push(Object.freeze({ type: "end",
                first: Pair.first,
                second: Pair.second,
                tick,
                time }));
        }
    }

    for (const Pair of current)
    {
        if (!Old.has(PairKey(Pair.first, Pair.second)))
        {
            events.push(Object.freeze({ type: "begin",
                first: Pair.first,
                second: Pair.second,
                tick,
                time }));
        }
    }
};

/**
 * Pauses without losing pre-tick pose, velocities, loads or physical configuration.
 *
 * @category Internal
 * @since 1.0.0
 */
const pause = (body: Body.PhysicsEntity): Body.PhysicsEntity =>
{
    return body.paused ? body : Body.copy(body, { paused: true,
        revision: body.revision + 1,
        interval: Object.freeze({ start: body.pose,
            end: body.pose,
            duration: 0.05,
            sequence: body.interval.sequence + 1,
            reset: body.interval.reset + 1,
            renderBase: body.pose.position }) });
};

/**
 * Solves all independent conservative contact islands transactionally. Static anchors
 * do not connect unrelated islands; failure rolls back only the affected moving group.
 *
 * @category Internal
 * @since 1.0.0
 */
export const step = (bodies: ReadonlyArray<Body.PhysicsEntity>, previous: ReadonlyArray<ContactPair>, oldCache: ReadonlyArray<Cached>, gravity: V.Vector3, tick: number, options: Options, envelopes: ReadonlyMap<string, number> = new Map(), retries = 0, acceleration?: BP.Tree): Output =>
{
    const Original = new Map(bodies.map((b) => [ b.id, b ]));
    const Metrics = Profile.current();
    const TreeStarted = Metrics ? Profile.now() : 0;
    const Result = new Map(Original);
    const Diagnostics: Array<Diagnostic> = [];
    const Events: Array<Event> = [];
    const Final: Array<ContactPair> = [];
    const Cache: Array<Cached> = [];
    const Work = new Map<string, Work>(bodies.map((b) => [ b.id, { original: b,
        pose: b.pose,
        com: Body.centerOfMass(b),
        velocity: b.linearVelocity,
        angular: b.angularVelocity,
        momentum: b.angularMomentum,
        sleeping: b.sleeping,
        sleepTime: b.sleepTime,
        correction: 0 } ]));
    const Parents = new Map(bodies.filter((b) => b.mode !== "static").map((b) => [ b.id, b.id ]));
    const Root = (id: string): string =>
    {
        let current = id;
        while (Parents.get(current) !== current)
        {
            current = Parents.get(current)!;
        }

        return current;
    };

    const Union = (a: string, b: string): void =>
    {
        if (Parents.has(a) && Parents.has(b))
        {
            const A = Root(a);
            const Bv = Root(b);
            if (A !== Bv)
            {
                Parents.set(A < Bv ? Bv : A, A < Bv ? A : Bv);
            }
        }
    };

    const Tree = R.getOrThrow(acceleration ? BP.fork(acceleration) : BP.make({ capacity: 65_536 }));
    if (acceleration)
    {
        for (const Entry of R.getOrThrow(BP.snapshot(Tree)))
        {
            if (!Work.has(Entry.id))
            {R.getOrThrow(BP.remove(Tree, Entry.id));}
        }
    }

    const PlanningFailures = new Map<string, string>();
    const Margins = new Map<string, number>();
    const Reaches = new Map<string, number>();
    const AngularBounds = new Map<string, number>();
    const Starts = new Map([ ...Work ].map(([ id, body ]) => [ id, body.com ]));
    let pairs: ReadonlyArray<BP.Pair>;
    try
    {
        for (const Body of bodies)
        {
            try
            {
                const Acceleration = M.add(O.getOrElse(Body.gravity, () => gravity), M.scale(Body.force, 1 / Body.physical.mass));
                const Reach = G.reach(Body.definition.shape.bounds, Body.physical.centerOfMass);
                const Margin = Math.max(envelopes.get(Body.id) ?? 0, Body.mode === "static" || Body.paused || Body.sleeping ? 0 : M.length(Body.linearVelocity) * Settings.tick + M.length(Acceleration) * Settings.tick ** 2 + 0.5);
                if (!Number.isFinite(Margin) || Margin > 1e9)
                {
                    throw new StepFault("NumericalFailure", "Motion envelope exceeds the supported coordinate domain");
                }

                const InverseBound = Math.max(...[ 0, 3, 6 ].map((row) => Math.abs(Body.inverseInertia[row]) + Math.abs(Body.inverseInertia[row + 1]) + Math.abs(Body.inverseInertia[row + 2])));
                AngularBounds.set(Body.id, InverseBound);
                Reaches.set(Body.id, Reach);
                const Spin = Body.mode === "kinematic" ? M.length(Body.angularVelocity) : InverseBound * (M.length(Body.angularMomentum) + M.length(Body.torque) * Settings.tick);
                const Turn = Body.mode === "static" || Body.paused || Body.sleeping ? 0 : Reach * Math.min(2, Spin * Settings.tick);
                const Expansion = Margin + Turn;
                Margins.set(Body.id, Expansion);
                const Actual = R.getOrThrow(C.bounds(Instance(Work.get(Body.id)!)));
                const Box = Body.mode === "static" ? Actual : O.getOrThrow(B.expand(Actual, Expansion));
                R.getOrThrow(BP.set(Tree, { id: Body.id,
                    bounds: Box,
                    mode: Body.mode }));
            }
            catch (error)
            {
                PlanningFailures.set(Body.id, error instanceof Error ? error.message : "Unrepresentable motion bound");
                const Still = R.getOrThrow(C.bounds(Instance(Work.get(Body.id)!)));
                R.getOrThrow(BP.set(Tree, { id: Body.id,
                    bounds: Still,
                    mode: Body.mode }));
            }
        }

        const Candidates = BP.pairs(Tree, options.maxPairs);
        if (R.isFailure(Candidates))
        {
            throw new StepFault("SolverLimit", Candidates.failure.message);
        }

        pairs = Candidates.success;
        if (Metrics)
        {
            Metrics.broadPhaseMs += Math.max(0, Profile.now() - TreeStarted);
            Metrics.broadPhasePairs += pairs.length;
        }
    }
    catch (error)
    {
        const IDs = Object.freeze(bodies.filter((b) => b.mode !== "static").map((b) => b.id));
        return Object.freeze({ bodies: Object.freeze(bodies.map((b) => b.mode === "static" ? b : pause(b))),
            contacts: previous,
            cache: oldCache,
            events: Object.freeze([]),
            diagnostics: Object.freeze([ Object.freeze({ code: "SolverLimit" as const,
                message: error instanceof Error ? error.message : "Broad-phase failure",
                bodies: IDs }) ]) });
    }

    for (const Pair of [ ...pairs, ...previous ])
    {
        Union(Pair.first, Pair.second);
    }

    const Groups = new Map<string, Array<string>>();
    for (const ID of Parents.keys())
    {
        const Key = Root(ID);
        if (!Groups.has(Key))
        {
            Groups.set(Key, []);
        }

        Groups.get(Key)!.push(ID);
    }

    for (const IDs of Groups.values())
    {
        const Members = new Set(IDs);
        const GroupPairs = pairs.filter((p) => Members.has(p.first) || Members.has(p.second));
        const ActiveBodies = IDs.map((id) => Work.get(id)!);
        if (Metrics)
        {Metrics.maxIslandBodies = Math.max(Metrics.maxIslandBodies, ActiveBodies.length);}

        const GroupOld = previous.filter((p) => Members.has(p.first) || Members.has(p.second));
        const GroupCache = oldCache.filter((p) => Members.has(p.first) || Members.has(p.second));
        const PlanningFailure = IDs.find((id) => PlanningFailures.has(id));
        if (PlanningFailure !== undefined)
        {
            IDs.forEach((id) => Result.set(id, pause(Original.get(id)!)));
            Final.push(...GroupOld);
            Cache.push(...GroupCache);
            Diagnostics.push(Object.freeze({ code: "NumericalFailure",
                message: PlanningFailures.get(PlanningFailure)!,
                bodies: Object.freeze([ ...IDs ]) }));
            continue;
        }

        if (ActiveBodies.some((b) => b.original.paused))
        {
            IDs.forEach((id) => Result.set(id, pause(Original.get(id)!)));
            Final.push(...GroupOld);
            Cache.push(...GroupCache);
            continue;
        }

        const GroupEvents: Array<Event> = [];
        let active: ReadonlyArray<ContactPair> = GroupOld;
        let cache: ReadonlyArray<Cached> = GroupCache;
        try
        {
            const Wake = ActiveBodies.some((b) => b.original.mode === "kinematic" && (M.length(b.velocity) > 0 || M.length(b.angular) > 0) ||
                !b.sleeping && (b.sleepTime === 0 || M.length(b.velocity) > Settings.sleepLinear || M.length(b.angular) > Settings.sleepAngular || M.length(b.original.force) > 0 || M.length(b.original.torque) > 0));
            if (Wake)
            {
                for (const Body of ActiveBodies)
                {
                    if (Body.sleeping)
                    {
                        Body.sleeping = false;
                        Body.sleepTime = 0;
                    }
                }
            }

            const ContactCache = new Map<BP.Pair, { first: T.Transform;
                second: T.Transform;
                result: R.Result<ReadonlyArray<C.Manifold>, C.Diagnostic> }>();
            const Read = (extra?: ContactPair): Array<ContactPair> =>
            {
                const Frames: Array<ContactPair> = [];
                for (const Pair of GroupPairs)
                {
                    const A = Work.get(Pair.first)!;
                    const Bv = Work.get(Pair.second)!;
                    const Tolerance = (options.collision.absoluteTolerance ?? 1e-7) + (options.collision.relativeTolerance ?? 1e-7) * Math.max(A.original.definition.shape.radius, Bv.original.definition.shape.radius);
                    const Started = Metrics ? Profile.now() : 0;
                    const Cached = ContactCache.get(Pair);
                    const Reuse = Cached?.first === A.pose && Cached.second === Bv.pose;
                    const Query = Reuse ? Cached.result : C.collide(Instance(A), Instance(Bv), { ...options.collision,
                        absoluteTolerance: 4 * Tolerance,
                        relativeTolerance: 0 });
                    if (!Reuse)
                    {
                        ContactCache.set(Pair, { first: A.pose,
                            second: Bv.pose,
                            result: Query });
                    }

                    if (Metrics)
                    {
                        const Elapsed = Math.max(0, Profile.now() - Started);
                        Metrics.narrowPhaseMs += Elapsed;
                        Metrics.narrowPhaseCalls += Number(!Reuse);
                        Metrics.narrowPhaseCacheHits += Number(Reuse);
                        if (Elapsed > Metrics.slowestPairMs)
                        {
                            Metrics.slowestPairMs = Elapsed;
                            Metrics.slowestPair = `${Pair.first}|${Pair.second}`;
                        }
                    }

                    if (R.isFailure(Query))
                    {
                        throw new StepFault("CollisionFailure", Query.failure.message, Query.failure);
                    }

                    if (Query.success.length)
                    {
                        Frames.push(Object.freeze({ ...Pair,
                            manifolds: Query.success }));
                    }
                    else if (extra && Pair.first === extra.first && Pair.second === extra.second)
                    {
                        Frames.push(extra);
                    }
                }

                return Frames;
            };

            if (ActiveBodies.every((b) => b.sleeping || b.original.mode === "kinematic" && M.length(b.velocity) === 0 && M.length(b.angular) === 0))
            {
                const Frames = Read();
                transitions(active, Frames, tick, 0, GroupEvents);
                active = Frames;
            }
            else
            {
                for (let substep = 0; substep < Settings.substeps; substep++)
                {
                    const Dt = Settings.tick / Settings.substeps;
                    for (const Body of ActiveBodies)
                    {
                        if (Body.original.mode === "dynamic" && !Body.sleeping)
                        {
                            const Acceleration = M.add(O.getOrElse(Body.original.gravity, () => gravity), M.scale(Body.original.force, 1 / Body.original.physical.mass));
                            Body.velocity = M.add(Body.velocity, M.scale(Acceleration, Dt));
                            Body.momentum = M.add(Body.momentum, M.scale(Body.original.torque, Dt));
                            Body.angular = P.world(Body.original.inverseInertia, Body.pose.rotation, Body.momentum);
                            finite(Body);
                        }
                    }

                    let frames = Read();
                    transitions(active, frames, tick, substep * Dt, GroupEvents);
                    active = frames;
                    cache = solve(frames, Work, cache, true);
                    let remaining = Dt;
                    let elapsed = 0;
                    let impacts = 0;
                    const Validate = (body: Work): void =>
                    {
                        const Left = Settings.tick - substep * Dt - elapsed;
                        const Acceleration = body.original.mode === "dynamic" ? M.add(O.getOrElse(body.original.gravity, () => gravity), M.scale(body.original.force, 1 / body.original.physical.mass)) : V.Zero;
                        const Spin = body.original.mode === "kinematic" ? M.length(body.angular) :
                            AngularBounds.get(body.original.id)! * (M.length(body.momentum) + M.length(body.original.torque) * Left);
                        const Arc = O.getOrThrow(Q.angularDistance(body.original.pose.rotation, body.pose.rotation));
                        const Turn = Reaches.get(body.original.id)! * Math.min(2, Arc + Spin * Left);
                        const Required = M.length(M.sub(body.com, Starts.get(body.original.id)!)) + M.length(body.velocity) * Left + M.length(Acceleration) * Left * Left + Turn + 0.4;
                        if (Required > (Margins.get(body.original.id) ?? 0) + 1e-8)
                        {
                            throw new Replan(body.original.id, Required * 1.05 + 0.5);
                        }
                    };

                    while (remaining > 1e-12)
                    {
                        const Angles = new Map(ActiveBodies.map((b) => [ b.original.id, b.sleeping ? V.Zero : angular(b, remaining) ]));
                        const Motion = (id: string): C.Motion =>
                        {
                            const Body = Work.get(id)!;
                            const Moving = Body.original.mode !== "static" && !Body.sleeping;
                            const Angular = Moving ? Angles.get(id)! : V.Zero;
                            const Velocity = Moving ? Body.velocity : V.Zero;
                            return { shape: Body.original.definition.shape,
                                centerOfMass: Body.original.physical.centerOfMass,
                                state: RT.RigidTransformUnsafe(Body.pose.position, Body.pose.rotation, M.add(Velocity, M.cross(Angular, M.sub(Body.pose.position, Body.com))), Angular) };
                        };

                        let earliest: C.Hit | undefined;
                        let hitPair: BP.Pair | undefined;
                        for (const Pair of GroupPairs)
                        {
                            const A = Work.get(Pair.first)!;
                            const Bv = Work.get(Pair.second)!;
                            if (active.some((p) => p.first === Pair.first && p.second === Pair.second))
                            {
                                continue;
                            }

                            if (M.length(A.velocity) + M.length(Bv.velocity) + M.length(A.angular) + M.length(Bv.angular) === 0)
                            {
                                continue;
                            }

                            const Started = Metrics ? Profile.now() : 0;
                            const Query = C.sweep(Motion(Pair.first), Motion(Pair.second), remaining, options.collision);
                            if (Metrics)
                            {
                                const Elapsed = Math.max(0, Profile.now() - Started);
                                Metrics.ccdCalls++;
                                Metrics.ccdMs += Elapsed;
                                if (Elapsed > Metrics.slowestPairMs)
                                {
                                    Metrics.slowestPairMs = Elapsed;
                                    Metrics.slowestPair = `${Pair.first}|${Pair.second}`;
                                }
                            }

                            if (R.isFailure(Query))
                            {
                                throw new StepFault("CollisionFailure", Query.failure.message, Query.failure);
                            }

                            if (O.isSome(Query.success) && (!earliest || Query.success.value.time < earliest.time))
                            {
                                earliest = Query.success.value;
                                hitPair = Pair;
                            }
                        }

                        if (!earliest)
                        {
                            advance(ActiveBodies, Angles, remaining, Validate);
                            elapsed += remaining;
                            remaining = 0;
                            break;
                        }

                        if (++impacts > options.maxImpacts)
                        {
                            throw new StepFault("SolverLimit", `CCD impact budget exceeded at ${elapsed} + ${earliest.time} seconds for ${hitPair!.first}|${hitPair!.second}`);
                        }

                        advance(ActiveBodies, Angles, earliest.time, Validate);
                        elapsed += earliest.time;
                        remaining -= earliest.time;
                        const Extra = Object.freeze({ ...hitPair!,
                            manifolds: Object.freeze([ Object.freeze({ normal: earliest.normal,
                                contacts: Object.freeze([ Object.freeze({ pointA: earliest.pointA,
                                    pointB: earliest.pointB,
                                    depth: 0,
                                    feature: "ccd" }) ]) }) ]) });
                        frames = Read(Extra);
                        transitions(active, frames, tick, substep * Dt + elapsed, GroupEvents);
                        active = frames;
                        cache = solve(frames, Work, [], false);
                    }

                    frames = Read();
                    transitions(active, frames, tick, (substep + 1) * Dt, GroupEvents);
                    active = frames;
                    ActiveBodies.forEach((b) =>
                    {
                        b.correction = 0;
                    });
                    correct(frames, Work);
                }
            }

            const Dynamics = ActiveBodies.filter((b) => b.original.mode === "dynamic");
            const Quiet = Dynamics.every((b) => b.original.allowSleep && M.length(b.velocity) <= Settings.sleepLinear && M.length(b.angular) <= Settings.sleepAngular &&
                M.length(b.original.force) === 0 && M.length(b.original.torque) === 0) &&
                !ActiveBodies.some((b) => b.original.mode === "kinematic" && (M.length(b.velocity) > 0 || M.length(b.angular) > 0));
            for (const Body of Dynamics)
            {
                Body.sleepTime = Quiet ? Body.sleepTime + Settings.tick : 0;
            }

            if (Dynamics.length && Dynamics.every((b) => b.sleepTime >= Settings.sleepSeconds))
            {
                for (const Body of Dynamics)
                {
                    Body.sleeping = true;
                    Body.velocity = V.Zero;
                    Body.angular = V.Zero;
                    Body.momentum = V.Zero;
                }
            }

            for (const Body of ActiveBodies)
            {
                finite(Body);
                const Old = Body.original;
                Result.set(Old.id, BodyCopy(Body, Old));
            }

            Final.push(...active);
            Events.push(...GroupEvents);
            Cache.push(...cache.filter((c) => active.some((p) => c.first === p.first && c.second === p.second)));
        }
        catch (error)
        {
            if (error instanceof Replan)
            {
                if (Metrics)
                {Metrics.replans++;}

                if (retries < Settings.replans)
                {
                    const Expanded = new Map(envelopes);
                    Expanded.set(error.id, error.margin);
                    return step(bodies, previous, oldCache, gravity, tick, options, Expanded, retries + 1, acceleration);
                }

                const Affected = Object.freeze(bodies.filter((b) => b.mode !== "static").map((b) => b.id));
                return Object.freeze({ bodies: Object.freeze(bodies.map((b) => b.mode === "static" ? b : pause(b))),
                    contacts: previous,
                    cache: oldCache,
                    events: Object.freeze([]),
                    diagnostics: Object.freeze([ Object.freeze({ code: "SolverLimit" as const,
                        message: "Motion-envelope replan budget exceeded",
                        bodies: Affected }) ]) });
            }

            IDs.forEach((id) => Result.set(id, pause(Original.get(id)!)));
            Final.push(...GroupOld);
            Cache.push(...GroupCache);
            Diagnostics.push(Object.freeze({ code: error instanceof StepFault ? error.code : "NumericalFailure",
                message: error instanceof Error ? error.message : "Solver failure",
                bodies: Object.freeze([ ...IDs ]),
                collision: error instanceof StepFault ? error.collision : undefined }));
        }
    }

    Events.sort((a, b) => a.time - b.time || (a.first < b.first ? -1 : a.first > b.first ? 1 : a.second < b.second ? -1 : a.second > b.second ? 1 : a.type === b.type ? 0 : a.type === "end" ? -1 : 1));
    Final.sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : a.second < b.second ? -1 : 1);
    return Object.freeze({ bodies: Object.freeze(bodies.map((b) => Result.get(b.id)!)),
        contacts: Object.freeze(Final),
        events: Object.freeze(Events),
        diagnostics: Object.freeze(Diagnostics),
        cache: Object.freeze(Cache),
        tree: Tree });
};

/**
 * Commits physical state and a pose-only presentation interval after all substeps.
 *
 * @category Internal
 * @since 1.0.0
 */
const BodyCopy = (body: Work, previous: Body.PhysicsEntity): Body.PhysicsEntity =>
{
    return Body.copy(previous, { pose: body.pose,
        linearVelocity: body.velocity,
        angularVelocity: body.angular,
        angularMomentum: body.momentum,
        sleeping: body.sleeping,
        sleepTime: body.sleepTime,
        force: V.Zero,
        torque: V.Zero,
        revision: previous.revision + 1,
        interval: Object.freeze({ start: previous.pose,
            end: body.pose,
            duration: 0.05,
            sequence: previous.interval.sequence + 1,
            reset: previous.interval.reset,
            renderBase: body.pose.position }) });
};
