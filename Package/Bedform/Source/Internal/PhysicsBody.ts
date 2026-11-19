/**
 * Immutable rigid body values and source-solid physical configuration.
 *
 * @module bedform/Internal/PhysicsBody
 *
 * @file      PhysicsBody.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Physical records preserve vector/tensor ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as C from "../Collision.js";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import * as T from "../Transform.js";
import * as RT from "../RigidTransform.js";
import * as V from "../Vector3.js";
import type * as Model from "../PhysicsModel.js";
import type * as Renderer from "../PhysicsRenderer.js";
import * as M from "./CollisionMath.js";
import * as P from "./PhysicsMath.js";
import { dual } from "@bedform/effect/Function";

const TypeId = "~bedform/PhysicsEntity" as const;
const DefinitionId = "~bedform/PhysicsDefinition" as const;
const Definitions = new WeakMap<Definition, Source>();
const Bodies = new WeakSet<object>();
const OwnOption = <A>(value: O.Option<A>): O.Option<A> => Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(value)), value));

/**
 * Catalog reference retained without a mutable caller-owned model graph.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ModelReference
{
    readonly identifier: string;
    readonly fingerprint: string;
    readonly representation: "cuboid" | "particle";
    readonly renderer: O.Option<string>;
}

/**
 * Immutable registered collider and compiled source-solid mass properties.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Definition
{
    readonly [DefinitionId]: typeof DefinitionId;
    readonly model: ModelReference;
    readonly shape: C.Shape;
    readonly source: Model.MassProperties;
}

/**
 * Owned source-centroid tensor and model defaults, shared between immutable bodies.
 *
 * @category Types
 * @since 1.0.0
 */
interface Source
{
    readonly unitInertia: Model.Inertia;
    readonly gravity: O.Option<V.Vector3>;
    readonly velocity: V.Vector3;
    readonly angular: V.Vector3;
    readonly restitution: number;
    readonly signature: string;
}

export namespace Properties
{
    /**
     * Pose-preserving physical changes. None gravity restores world gravity.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Common
    {
        readonly mode?: "dynamic" | "static" | "kinematic";
        readonly centerOfMass?: V.Coordinates;
        readonly restitution?: number;
        readonly gravity?: O.Option<V.Coordinates>;
        readonly allowSleep?: boolean;
    }

    /**
     * Positive kilograms; mass and density cannot be supplied together.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Mass
    {
        readonly mass?: number;
        readonly density?: never;
    }

    /**
     * Positive kilograms per source-solid cubic block.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Density
    {
        readonly mass?: never;
        readonly density: number;
    }
}

/**
 * Mutually exclusive uniform mass/density overrides on compiled source geometry.
 *
 * @category Types
 * @since 1.0.0
 */
export type Properties = Properties.Common & (Properties.Mass | Properties.Density);

export namespace Options
{
    /**
     * Explicit deterministic body ID, model-origin pose and initial COM/world velocities.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Initial
    {
        readonly id: string;
        readonly pose?: T.Coordinates;
        readonly linearVelocity?: V.Coordinates;
        readonly angularVelocity?: V.Coordinates;
    }
}

/**
 * Validated body construction without spawning entities or subscribing to the engine.
 *
 * @category Types
 * @since 1.0.0
 */
export type Options = Properties & Options.Initial;

/**
 * Immutable authoritative body. linearVelocity is COM motion; angular momentum is
 * world-space. Presentation intervals contain only committed model-origin poses.
 * Paused bodies retain their pre-failure velocities and accumulated loads for repair.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PhysicsEntity extends Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly id: string;
    readonly definition: Definition;
    readonly mode: "dynamic" | "static" | "kinematic";
    readonly pose: T.Transform;
    readonly linearVelocity: V.Vector3;
    readonly angularVelocity: V.Vector3;
    readonly angularMomentum: V.Vector3;
    readonly physical: Model.MassProperties;
    readonly inverseInertia: Model.Inertia;
    readonly restitution: number;
    readonly gravity: O.Option<V.Vector3>;
    readonly force: V.Vector3;
    readonly torque: V.Vector3;
    readonly allowSleep: boolean;
    readonly sleeping: boolean;
    readonly paused: boolean;
    readonly sleepTime: number;
    readonly revision: number;
    readonly interval: Renderer.Interval;
}

/**
 * Functional receiver update with both call styles.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Update<A>
{
    (self: PhysicsEntity, value: A): R.Result<PhysicsEntity, P.PhysicsError>;
    (value: A): (self: PhysicsEntity) => R.Result<PhysicsEntity, P.PhysicsError>;
}

/**
 * World-point loading; omitted points apply a force/impulse at COM.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PointUpdate
{
    (self: PhysicsEntity, value: V.Coordinates, point?: V.Coordinates): R.Result<PhysicsEntity, P.PhysicsError>;
    (value: V.Coordinates, point?: V.Coordinates): (self: PhysicsEntity) => R.Result<PhysicsEntity, P.PhysicsError>;
}

/**
 * Protocol key includes catalog geometry, physical state and transient output history.
 *
 * @category Internal
 * @since 1.0.0
 */
const key = (self: PhysicsEntity): string =>
{
    const PoseKey = (pose: T.Transform): unknown => [ pose.position, P.poseKey(pose.rotation) ];
    return JSON.stringify([ Definitions.get(self.definition)!.signature, self.id, self.mode, PoseKey(self.pose), self.linearVelocity,
        self.angularMomentum, self.physical, self.restitution, self.gravity, self.force, self.torque, self.allowSleep,
        self.sleeping, self.paused, self.sleepTime, self.revision, self.interval.sequence, self.interval.reset,
        PoseKey(self.interval.start), PoseKey(self.interval.end), self.interval.renderBase ]);
};

/**
 * Shares the canonical immutable body key with world protocols.
 *
 * @category Internal
 * @since 1.0.0
 */
export const valueKey = (self: PhysicsEntity): string =>
{
    return key(self);
};

const Prototype = Object.freeze({ ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Compares immutable body values, including the owned catalog registration.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: PhysicsEntity, that: Equal.Equal): boolean
    {
        return isPhysicsEntity(that) && key(this) === key(that);
    },

    /**
     * Hashes the same canonical state used for equality.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: PhysicsEntity): number
    {
        return Hash.string(key(this));
    },

    /**
     * Exposes frozen inspectable state without serializing private prepared geometry.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: PhysicsEntity): unknown
    {
        const { definition: Definition, ...State } = this;
        return Object.freeze({ _id: "PhysicsEntity",
            model: Definition.model,
            ...State });
    },

    /**
     * Emits full-precision state for diagnostics.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: PhysicsEntity): string
    {
        return JSON.stringify(this.toJSON());
    }
});

/**
 * Recognizes constructed immutable values rather than accepting forged body records.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isPhysicsEntity = (value: unknown): value is PhysicsEntity =>
{
    return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Prototype && Bodies.has(value);
};

/**
 * Guards public receiver operations.
 *
 * @throws { P.Fault } A non-body value was supplied.
 *
 * @category Internal
 * @since 1.0.0
 */
export const check = (self: PhysicsEntity): void =>
{
    if (!isPhysicsEntity(self))
    {
        throw new P.Fault("InvalidInput", "Expected a PhysicsEntity");
    }
};

/**
 * Copies a validated immutable state; only the private solver uses unchecked patches.
 *
 * @category Internal
 * @since 1.0.0
 */
export const copy = (self: PhysicsEntity, patch: Partial<PhysicsEntity>): PhysicsEntity =>
{
    const Next = Object.freeze(Object.assign(Object.create(Prototype) as PhysicsEntity, self, patch));
    Bodies.add(Next);
    return Next;
};

/**
 * Validates/copies an optional per-body gravity override.
 *
 * @throws { P.Fault } A malformed Option was supplied.
 *
 * @category Internal
 * @since 1.0.0
 */
const gravity = (input: O.Option<V.Coordinates>): O.Option<V.Vector3> =>
{
    if (!O.isOption(input))
    {
        throw new P.Fault("InvalidInput", "Gravity must be an Option");
    }

    return OwnOption(O.isSome(input) ? O.some(P.vector(input.value, "gravity")) : O.none());
};

/**
 * Registers owned compiled physical data and collider geometry once for many bodies.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const define = (model: Model.Model): R.Result<Definition, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        if (!model || model.schemaVersion !== 1 || typeof model.identifier !== "string" || !model.identifier.length ||
            typeof model.fingerprint !== "string" || !model.fingerprint.length || ![ "cuboid", "particle" ].includes(model.representation))
        {
            throw new P.Fault("InvalidInput", "Invalid physics model reference");
        }

        const Physical = model.physical;
        if (!Physical || !Number.isFinite(Physical.mass) || Physical.mass <= 0 || !Number.isFinite(Physical.volume) || Physical.volume <= 0)
        {
            throw new P.Fault("InvalidInput", "Invalid compiled source mass/volume");
        }

        const Centroid = P.vector(Physical.centroid, "source centroid");
        const COM = P.vector(Physical.centerOfMass, "source COM");
        const Tensor = P.tensor(Physical.inertia);
        const Parallel = P.parallel(Physical.mass, M.sub(COM, Centroid));
        const Unit = P.tensor(Tensor.map((n, i) => (n - Parallel[i]) / Physical.mass));
        P.inverse(Unit);
        const Shape = C.prepare(model.collision);
        if (R.isFailure(Shape))
        {
            throw new P.Fault("InvalidInput", Shape.failure.message);
        }

        const Restitution = model.restitution;
        if (!Number.isFinite(Restitution) || Restitution < 0 || Restitution > 1)
        {
            throw new P.Fault("InvalidInput", "Invalid restitution");
        }

        const Reference = Object.freeze({ identifier: model.identifier,
            fingerprint: model.fingerprint,
            representation: model.representation,
            renderer: OwnOption(model.renderer === undefined ? O.none<string>() : O.some(model.renderer)) });
        const Source = Object.freeze({ volume: Physical.volume,
            mass: Physical.mass,
            centroid: Centroid,
            centerOfMass: COM,
            inertia: Tensor });
        const Definition: Definition = Object.freeze({ [DefinitionId]: DefinitionId,
            model: Reference,
            shape: Shape.success,
            source: Source });
        const Defaults = { unitInertia: Unit,
            gravity: OwnOption(model.gravity === undefined ? O.none<V.Vector3>() : O.some(P.vector(model.gravity, "model gravity"))),
            velocity: P.vector(model.linearVelocity, "model velocity"),
            angular: P.vector(model.angularVelocity, "model angular velocity"),
            restitution: Restitution,
            signature: JSON.stringify([ Reference, Source, model.collision ]) };
        Definitions.set(Definition, Object.freeze(Defaults));
        return Definition;
    });
};

/**
 * Reweights compiled source-centroid inertia and applies the selected COM offset.
 *
 * @throws { P.Fault } Invalid mass, density, COM or tensor conditioning.
 *
 * @category Internal
 * @since 1.0.0
 */
const properties = (definition: Definition, options: Properties, fallback: Model.MassProperties): Model.MassProperties =>
{
    if ("friction" in options)
    {
        throw new P.Fault("InvalidInput", "Friction is fixed at 0.5");
    }

    if (options.mass !== undefined && options.density !== undefined)
    {
        throw new P.Fault("InvalidInput", "Mass and density are mutually exclusive");
    }

    for (const Value of [ options.mass, options.density ])
    {
        if (Value !== undefined && (!Number.isFinite(Value) || Value <= 0))
        {
            throw new P.Fault("InvalidInput", "Mass/density must be positive finite numbers");
        }
    }

    const Mass = options.mass ?? (options.density === undefined ? fallback.mass : options.density * definition.source.volume);
    if (!Number.isFinite(1 / Mass) || Mass <= 0)
    {
        throw new P.Fault("InvalidInput", "Mass is outside the supported inverse-mass domain");
    }

    const COM = options.centerOfMass === undefined ? fallback.centerOfMass : P.vector(options.centerOfMass, "COM");
    const Base = Definitions.get(definition);
    if (!Base)
    {
        throw new P.Fault("InvalidInput", "Unrecognized physics definition");
    }

    const Parallel = P.parallel(Mass, M.sub(COM, definition.source.centroid));
    const Tensor = P.tensor(Base.unitInertia.map((n, i) => n * Mass + Parallel[i]));
    P.inverse(Tensor);
    return Object.freeze({ volume: definition.source.volume,
        mass: Mass,
        centroid: definition.source.centroid,
        centerOfMass: COM,
        inertia: Tensor });
};

/**
 * Constructs an immutable body from a model or an explicitly registered definition.
 * Static bodies reject initial movement; kinematic bodies remain caller-driven.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (model: Model.Model | Definition, options: Options): R.Result<PhysicsEntity, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        const Registered = Definitions.has(model as Definition) ? R.succeed(model as Definition) : define(model as Model.Model);
        if (R.isFailure(Registered))
        {
            throw new P.Fault(Registered.failure.code, Registered.failure.message);
        }

        const Definition = Registered.success;
        const Defaults = Definitions.get(Definition)!;
        if (!options || typeof options.id !== "string" || !options.id.length || options.id.length > 256)
        {
            throw new P.Fault("InvalidInput", "Body ID must contain 1..256 characters");
        }

        const Mode = options.mode === undefined ? "dynamic" : options.mode;
        if (![ "dynamic", "static", "kinematic" ].includes(Mode))
        {
            throw new P.Fault("InvalidInput", "Invalid body mode");
        }

        const InputPose = options.pose === undefined ? T.Identity : options.pose;
        const Pose = O.getOrThrow(T.Transform(InputPose.position, InputPose.rotation));
        const CheckBounds = C.bounds({ shape: Definition.shape,
            pose: Pose });
        if (R.isFailure(CheckBounds))
        {
            throw new P.Fault("InvalidInput", CheckBounds.failure.message);
        }

        const Velocity = options.linearVelocity === undefined ? (Mode === "static" ? V.Zero : Defaults.velocity) : P.vector(options.linearVelocity, "COM velocity");
        const Angular = options.angularVelocity === undefined ? (Mode === "static" ? V.Zero : Defaults.angular) : P.vector(options.angularVelocity, "angular velocity");
        if (Mode === "static" && (M.length(Velocity) > 0 || M.length(Angular) > 0))
        {
            throw new P.Fault("InvalidInput", "Static bodies cannot have velocity");
        }

        const Physical = properties(Definition, options, Definition.source);
        const Restitution = options.restitution === undefined ? Defaults.restitution : options.restitution;
        if (!Number.isFinite(Restitution) || Restitution < 0 || Restitution > 1 || (options.allowSleep !== undefined && typeof options.allowSleep !== "boolean"))
        {
            throw new P.Fault("InvalidInput", "Invalid restitution/sleep policy");
        }

        const Next = Object.freeze(Object.assign(Object.create(Prototype) as PhysicsEntity, { id: options.id,
            definition: Definition,
            mode: Mode,
            pose: Pose,
            linearVelocity: Velocity,
            angularVelocity: Angular,
            angularMomentum: P.world(Physical.inertia, Pose.rotation, Angular),
            physical: Physical,
            inverseInertia: P.inverse(Physical.inertia),
            restitution: Restitution,
            gravity: options.gravity === undefined ? Defaults.gravity : gravity(options.gravity),
            force: V.Zero,
            torque: V.Zero,
            allowSleep: options.allowSleep ?? true,
            sleeping: false,
            paused: false,
            sleepTime: 0,
            revision: 0,
            interval: Object.freeze({ start: Pose,
                end: Pose,
                duration: 0.05,
                sequence: 0,
                reset: 0,
                renderBase: Pose.position }) }));
        Bodies.add(Next);
        return Next;
    });
};

/**
 * Model-origin pose to world-space COM position.
 *
 * @category Inspection
 * @since 1.0.0
 */
export const centerOfMass = (self: PhysicsEntity): V.Vector3 =>
{
    return O.getOrThrow(T.transformPoint(self.pose, self.physical.centerOfMass));
};

/**
 * Returns shared origin-motion state, explicitly transporting authoritative COM velocity.
 * Static/sleeping/paused bodies report zero effective motion without discarding saved data.
 *
 * @category Inspection
 * @since 1.0.0
 */
export const motion = (self: PhysicsEntity): RT.RigidTransform =>
{
    const Inactive = self.mode === "static" || self.sleeping || self.paused;
    const Angular = Inactive ? V.Zero : self.angularVelocity;
    const Velocity = Inactive ? V.Zero : M.add(self.linearVelocity, M.cross(Angular, M.sub(self.pose.position, centerOfMass(self))));
    return RT.RigidTransformUnsafe(self.pose.position, self.pose.rotation, Velocity, Angular);
};

/**
 * Rebuilds mass properties while retaining the current world pose and velocities.
 *
 * @category Updates
 * @since 1.0.0
 */
export const configure: Update<Properties> = dual(2, (self: PhysicsEntity, options: Properties) => P.attempt(() =>
{
    check(self);
    const Physical = properties(self.definition, options, self.physical);
    const Mode = options.mode === undefined ? self.mode : options.mode;
    const Restitution = options.restitution === undefined ? self.restitution : options.restitution;
    if (![ "dynamic", "static", "kinematic" ].includes(Mode) || !Number.isFinite(Restitution) || Restitution < 0 || Restitution > 1 ||
        (options.allowSleep !== undefined && typeof options.allowSleep !== "boolean"))
    {
        throw new P.Fault("InvalidInput", "Invalid physical properties");
    }

    const Angular = Mode === "static" ? V.Zero : self.angularVelocity;
    return copy(self, { physical: Physical,
        inverseInertia: P.inverse(Physical.inertia),
        mode: Mode,
        restitution: Restitution,
        gravity: options.gravity === undefined ? self.gravity : gravity(options.gravity),
        allowSleep: options.allowSleep ?? self.allowSleep,
        linearVelocity: Mode === "static" ? V.Zero : self.linearVelocity,
        angularVelocity: Angular,
        force: Mode === "dynamic" ? self.force : V.Zero,
        torque: Mode === "dynamic" ? self.torque : V.Zero,
        angularMomentum: P.world(Physical.inertia, self.pose.rotation, Angular),
        sleeping: false,
        sleepTime: 0,
        revision: self.revision + 1 });
}));

/**
 * Explicit pose discontinuity with reset presentation endpoints; angular velocity is retained.
 *
 * @category Updates
 * @since 1.0.0
 */
export const setPose: Update<T.Coordinates> = dual(2, (self: PhysicsEntity, input: T.Coordinates) => P.attempt(() =>
{
    check(self);
    const Pose = O.getOrThrow(T.Transform(input.position, input.rotation));
    const Bounds = C.bounds({ shape: self.definition.shape,
        pose: Pose });
    if (R.isFailure(Bounds))
    {
        throw new P.Fault("InvalidInput", Bounds.failure.message);
    }

    return copy(self, { pose: Pose,
        angularMomentum: P.world(self.physical.inertia, Pose.rotation, self.angularVelocity),
        sleeping: false,
        sleepTime: 0,
        revision: self.revision + 1,
        interval: Object.freeze({ start: Pose,
            end: Pose,
            duration: 0.05,
            sequence: self.interval.sequence + 1,
            reset: self.interval.reset + 1,
            renderBase: Pose.position }) });
}));

/**
 * Independently replaces COM linear velocity, waking a dynamic body.
 *
 * @category Updates
 * @since 1.0.0
 */
export const setLinearVelocity: Update<V.Coordinates> = dual(2, (self: PhysicsEntity, value: V.Coordinates) => P.attempt(() =>
{
    check(self);
    const Velocity = P.vector(value, "COM velocity");
    if (self.mode === "static" && M.length(Velocity))
    {
        throw new P.Fault("InvalidInput", "Static bodies cannot move");
    }

    return copy(self, { linearVelocity: Velocity,
        sleeping: false,
        sleepTime: 0,
        revision: self.revision + 1 });
}));

/**
 * Independently replaces world angular velocity and its full-tensor angular momentum.
 *
 * @category Updates
 * @since 1.0.0
 */
export const setAngularVelocity: Update<V.Coordinates> = dual(2, (self: PhysicsEntity, value: V.Coordinates) => P.attempt(() =>
{
    check(self);
    const Angular = P.vector(value, "angular velocity");
    if (self.mode === "static" && M.length(Angular))
    {
        throw new P.Fault("InvalidInput", "Static bodies cannot rotate");
    }

    return copy(self, { angularVelocity: Angular,
        angularMomentum: P.world(self.physical.inertia, self.pose.rotation, Angular),
        sleeping: false,
        sleepTime: 0,
        revision: self.revision + 1 });
}));

/**
 * Accumulates world force and its torque about COM for the next complete tick.
 * Static and kinematic bodies ignore valid loads.
 *
 * @category Updates
 * @since 1.0.0
 */
export const applyForce: PointUpdate = dual((args: IArguments) => args.length >= 3 || isPhysicsEntity(args[0]) || typeof args[0] === "object" && args[0] !== null && "definition" in args[0],
    (self: PhysicsEntity, value: V.Coordinates, point?: V.Coordinates) => P.attempt(() =>
    {
        check(self);
        const Force = P.vector(value, "force");
        const Point = point === undefined ? centerOfMass(self) : P.vector(point, "force point");
        if (self.mode !== "dynamic")
        {
            return self;
        }

        const Total = M.add(self.force, Force);
        const Torque = M.add(self.torque, M.cross(M.sub(Point, centerOfMass(self)), Force));
        if (!V.isFinite(Total) || !V.isFinite(Torque))
        {
            throw new P.Fault("NumericalFailure", "Force accumulation overflow");
        }

        return copy(self, { force: Total,
            torque: Torque,
            sleeping: false,
            sleepTime: 0,
            revision: self.revision + 1 });
    }));

/**
 * Accumulates world torque without changing COM velocity.
 *
 * @category Updates
 * @since 1.0.0
 */
export const applyTorque: Update<V.Coordinates> = dual(2, (self: PhysicsEntity, value: V.Coordinates) => P.attempt(() =>
{
    check(self);
    const Torque = P.vector(value, "torque");
    if (self.mode !== "dynamic")
    {
        return self;
    }

    const Total = M.add(self.torque, Torque);
    if (!V.isFinite(Total))
    {
        throw new P.Fault("NumericalFailure", "Torque accumulation overflow");
    }

    return copy(self, { torque: Total,
        sleeping: false,
        sleepTime: 0,
        revision: self.revision + 1 });
}));

/**
 * Applies an immediate world-point impulse with full-tensor angular response.
 * Static and kinematic bodies are unaffected by impulses.
 *
 * @category Updates
 * @since 1.0.0
 */
export const applyImpulse: PointUpdate = dual((args: IArguments) => args.length >= 3 || isPhysicsEntity(args[0]) || typeof args[0] === "object" && args[0] !== null && "definition" in args[0],
    (self: PhysicsEntity, value: V.Coordinates, point?: V.Coordinates) => P.attempt(() =>
    {
        check(self);
        const Impulse = P.vector(value, "impulse");
        const Point = point === undefined ? centerOfMass(self) : P.vector(point, "impulse point");
        if (self.mode !== "dynamic")
        {
            return self;
        }

        const Velocity = M.add(self.linearVelocity, M.scale(Impulse, 1 / self.physical.mass));
        const Momentum = M.add(self.angularMomentum, M.cross(M.sub(Point, centerOfMass(self)), Impulse));
        const Angular = P.world(self.inverseInertia, self.pose.rotation, Momentum);
        if (![ Velocity, Momentum, Angular ].every(V.isFinite))
        {
            throw new P.Fault("NumericalFailure", "Impulse response overflow");
        }

        return copy(self, { linearVelocity: Velocity,
            angularVelocity: Angular,
            angularMomentum: Momentum,
            sleeping: false,
            sleepTime: 0,
            revision: self.revision + 1 });
    }));

/**
 * Clears accumulated loads without changing committed velocities or poses.
 *
 * @category Updates
 * @since 1.0.0
 */
export const clearForces = (self: PhysicsEntity): R.Result<PhysicsEntity, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        check(self);
        return copy(self, { force: V.Zero,
            torque: V.Zero,
            revision: self.revision + 1 });
    });
};

/**
 * Explicitly wakes a body without resuming a paused failure.
 *
 * @category Updates
 * @since 1.0.0
 */
export const wake = (self: PhysicsEntity): R.Result<PhysicsEntity, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        check(self);
        return copy(self, { sleeping: false,
            sleepTime: 0,
            revision: self.revision + 1 });
    });
};

/**
 * Explicitly retries a retained body after its failure condition has been repaired.
 *
 * @category Updates
 * @since 1.0.0
 */
export const resume = (self: PhysicsEntity): R.Result<PhysicsEntity, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        check(self);
        return copy(self, { paused: false,
            sleeping: false,
            sleepTime: 0,
            revision: self.revision + 1 });
    });
};

/**
 * Explicitly holds a body while retaining loads and velocities for a later resume.
 * First pause resets the presentation interval to its committed pose; repeats are inert.
 *
 * @category Updates
 * @since 1.0.0
 */
export const pause = (self: PhysicsEntity): R.Result<PhysicsEntity, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        check(self);
        return self.paused ? self : copy(self, { paused: true,
            revision: self.revision + 1,
            interval: Object.freeze({ start: self.pose,
                end: self.pose,
                duration: 0.05,
                sequence: self.interval.sequence + 1,
                reset: self.interval.reset + 1,
                renderBase: self.pose.position }) });
    });
};

/**
 * Constructs finite gravity from nonnegative magnitude and a unitized direction.
 * Zero magnitude accepts a zero direction and yields zero gravity.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const gravityFrom = (magnitude: number, direction: V.Coordinates): R.Result<V.Vector3, P.PhysicsError> =>
{
    return P.attempt(() =>
    {
        const Direction = P.vector(direction, "gravity direction");
        if (!Number.isFinite(magnitude) || magnitude < 0)
        {
            throw new P.Fault("InvalidInput", "Invalid gravity magnitude");
        }

        if (magnitude === 0)
        {
            return V.Zero;
        }

        const Unit = V.normalize(Direction);
        if (O.isNone(Unit))
        {
            throw new P.Fault("InvalidInput", "Positive gravity requires a nonzero direction");
        }

        return M.scale(Unit.value, magnitude);
    });
};
