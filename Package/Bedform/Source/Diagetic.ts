/**
 * Entity control definitions, durable native handles and explicit recoverable interaction sessions.
 *
 * @module bedform/Diagetic
 *
 * @file      Diagetic.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public contracts and their implementations retain semantic field ordering. */
/* eslint-disable sort-keys */

import * as Motion from "./Diagetic/Simulation.js";
import { Binding, CheckValue, Configure, Coordinates } from "./Internal/DiageticConfiguration.js";
import type { Dimension, Direction, Entity, Player, SpawnEntityOptions,
    System, Vector3, World } from "@minecraft/server";
import { FindAttached, IsDefinition, RegisterDefinition, StartRuntime, Wake }
    from "./Internal/DiageticRuntime.js";
import { MotionValue, PublishPose as Present } from "./Internal/DiageticPose.js";
import { Pose as PoseSnapshot, ReadControl, WriteControl } from "./Internal/DiageticPersistence.js";
import type { Definition as CustomDefinition } from "./Diagetic/Custom.js";

/**
 * Pure projection and fixed-step motion, with no native listeners or automatic ticking.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Simulation from "./Diagetic/Simulation.js";

/**
 * Public recovery and cooperative ownership identifiers and shared presentation assets.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Keys from "./Diagetic/Keys.js";

/**
 * Low-level custom controls with consumer acquisition, look, simulation, persistence, pose
 * publication and release hooks, driven by the same sessions as built-in controls.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Custom from "./Diagetic/Custom.js";

/**
 * Item capabilities and generic local transform targets with an explicit discovery lifetime.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Gizmo from "./Diagetic/Gizmo.js";

/**
 * Width and height, in blocks, of the shared control entities' collision box.
 *
 * @category Constant
 * @since 1.0.0
 */
export const CarrierSize = 0.75 as const;

/**
 * Supported controls; buttons are intentionally excluded.
 *
 * @category Model
 * @since 1.0.0
 */
export type Kind = "lever" | "slider" | "wheel";

/**
 * Inclusive scalar value bounds. Lever and slider values default to the normalized range zero to one.
 * Wheel values are unwrapped degrees and have no default bounds.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Limits
{
    readonly Min: number;
    readonly Max: number;
}

/**
 * A return target and nonnegative restoring strength, taking precedence over release detents.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Spring
{
    readonly Target: number;
    readonly Strength: number;
}

/**
 * Local model offset in blocks and Euler rotation in degrees, retained for pose publication.
 * This metadata does not change the native entity's location or overwrite its initial yaw.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ModelPose
{
    readonly Offset: Readonly<Vector3>;
    readonly Rotation: Readonly<Vector3>;
}

/**
 * Optional persisted supporting block receipt, checked by a started runtime.
 * Ordinary block-state changes keep the same expected block type.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BlockBinding
{
    readonly Dimension: string;
    readonly Position: Readonly<Vector3>;
    readonly Face: Direction;
    readonly ExpectedBlockType: string;
}

/**
 * A player acquisition or release observation, delivered by the later qualified interaction runtime.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PlayerEvent
{
    readonly Control: Handle;
    readonly Player: Player;
}

/**
 * A committed value change. Programmatic updates commit before invoking the callback, even if it throws.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ChangeEvent
{
    readonly Control: Handle;
    readonly PreviousValue: number;
    readonly Value: number;
    readonly Source: "programmatic" | "input" | "simulation";
}

/**
 * Causes that cancel an acquired control instead of a successful second-Use release.
 *
 * @category Model
 * @since 1.0.0
 */
export type CancellationReason = "death" | "respawn" | "disconnect" | "dimensionChange" |
    "entityLost" | "outOfRange" | "disposed" | "error";

/**
 * A cancelled acquisition; the player may already be unavailable during cleanup.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CancellationEvent
{
    readonly Control: Handle;
    readonly Player?: Player;
    readonly Reason: CancellationReason;
}

/**
 * Shared motion and interaction policy. Callbacks are synchronous and are never invoked by constructors.
 * Sensitivity scales look input; inertia is positive; damping and friction are nonnegative.
 * DriveStrength controls held target attraction; DetentStrength controls released detents.
 * The interaction runtime supplies look samples and drives the explicit simulation timestep.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SharedConfiguration
{
    readonly EntityType?: string;
    readonly InitialValue?: number;
    readonly Sensitivity?: number;
    readonly Inertia?: number;
    readonly Damping?: number;
    readonly Friction?: number;
    readonly DriveStrength?: number;
    readonly DetentStrength?: number;
    readonly Limits?: Limits;
    readonly Detents?: ReadonlyArray<number>;
    readonly Spring?: Spring;
    readonly InteractionRange?: number;
    readonly Eligible?: (player: Player, control: Handle) => boolean;
    readonly OnGrab?: (event: PlayerEvent) => void;
    readonly OnChange?: (event: ChangeEvent) => void;
    readonly OnRelease?: (event: PlayerEvent) => void;
    readonly OnCancel?: (event: CancellationEvent) => void;
}

/**
 * Lever policy with a positive handle sweep in degrees. Default detents are the two limits.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface LeverConfiguration extends SharedConfiguration
{
    readonly Kind: "lever";
    readonly ArcDegrees?: number;
    readonly ArmLength?: number;
}

/**
 * Slider policy with a positive track length in blocks and no default detents or return spring.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SliderConfiguration extends SharedConfiguration
{
    readonly Kind: "slider";
    readonly Length?: number;
}

/**
 * Wheel policy with a positive projected radius and a central dead-zone radius in blocks.
 * The dead zone must be smaller than the radius. Rotation is unbounded by default.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface WheelConfiguration extends SharedConfiguration
{
    readonly Kind: "wheel";
    readonly Radius?: number;
    readonly DeadZone?: number;
}

/**
 * Discriminated supported-control configuration.
 *
 * @category Configuration
 * @since 1.0.0
 */
export type Configuration = LeverConfiguration | SliderConfiguration | WheelConfiguration;

/**
 * Selects a kind's configuration without allowing another kind's geometry fields.
 *
 * @category UtilityType
 * @since 1.0.0
 */
export type ConfigurationFor<K extends Kind> = Extract<Configuration, { readonly Kind: K }>;

/**
 * Configuration accepted by a convenience constructor, which supplies its own discriminant.
 *
 * @category UtilityType
 * @since 1.0.0
 */
export type Options<K extends Kind> = Omit<ConfigurationFor<K>, "Kind">;

/**
 * Native spawn options with initial value, local model pose, support receipt and synchronous initialization.
 * Native options are forwarded unchanged. Initialization runs after attachment and may configure the entity.
 * Failure rolls back only the newly spawned entity; an existing entity is never adopted during Spawn.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SpawnOptions extends SpawnEntityOptions
{
    readonly Value?: number;
    readonly Pose?: Partial<ModelPose>;
    readonly Binding?: BlockBinding;
    readonly Initialize?: (entity: Entity, control: Handle) => void;
}

/**
 * Live scalar motion attached to a native entity. Scalar values and pose/binding receipts are persisted;
 * synchronized rendering is a subsequent stage. A started runtime drives motion automatically.
 * SetValue rejects non-finite or out-of-range values and reports actual changes synchronously.
 * Remove is idempotent after successful removal, and a failed native removal can be retried.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Handle<K extends Kind = Kind>
{
    readonly Definition: Definition<K>;
    readonly Entity: Entity;
    readonly Value: number;
    readonly Motion: Motion.Controller;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
    readonly IsValid: boolean;
    readonly SetValue: (value: number) => void;
    readonly Remove: () => void;
}

/**
 * A reusable frozen definition. Construction spawns nothing and installs no listeners.
 * Attach requires a valid entity with the configured type and shares state with previous attachments.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Definition<K extends Kind = Kind>
{
    readonly Kind: K;
    readonly EntityType: string;
    readonly Configuration: Readonly<ConfigurationFor<K>>;
    readonly Spawn: (dimension: Dimension, location: Vector3, options?: SpawnOptions) => Handle<K>;
    readonly Attach: (entity: Entity) => Handle<K>;
}

/**
 * Explicit native dependencies and definitions to register. Importing the module never obtains them.
 * Built-in and custom definitions may be mixed; entity types must be unique.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface StartOptions
{
    readonly World: World;
    readonly System: System;
    readonly Controls: ReadonlyArray<Definition | CustomDefinition<any>>;
    readonly OnError?: (error: unknown) => void;
}

/**
 * Explicit registration lifetime. Disposal is idempotent and does not remove consumer-owned entities.
 * Explicitly owns input subscriptions, fixed ticking and recoverable player sessions.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export interface Runtime
{
    readonly Controls: StartOptions["Controls"];
    readonly Disposed: boolean;
    readonly Dispose: () => void;
    readonly Interact: (player: Player, entity: Entity) => boolean;
    readonly IsInteracting: (player: Pick<Player, "id">) => boolean;
}

interface AttachmentState
{
    readonly Owner: object;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
    readonly Motion: Motion.Controller;
    Removed: boolean;
}

// Never store the handle or entity in the value: QuickJS retains self-referencing WeakMap entries.
const Handles = new WeakMap<Entity, AttachmentState>();

/**
 * Creates a reusable control definition without accessing the game host.
 * Spawn and Attach explicitly access only the native objects supplied by their callers.
 *
 * @throws { TypeError } If the kind, identifier, callback or attached entity is invalid.
 * @throws { RangeError } If motion policy or an initial value is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Make = <K extends Kind>(configuration: Configuration & { readonly Kind: K }): Definition<K> =>
{
    const config = Configure(configuration) as ConfigurationFor<K>;
    const owner = Object.freeze({});
    const attach = (entity: Entity, initial: number, pose: ModelPose, binding?: BlockBinding): Handle<K> =>
    {
        if (!entity?.isValid || entity.typeId !== config.EntityType)
        {
            throw new TypeError("Diagetic Attach requires a valid entity of the configured type");
        }

        const tracked = FindAttached(definition, entity.id);
        if (tracked)
        {
            return tracked as Handle<K>;
        }

        const existing = Handles.get(entity);
        if (existing)
        {
            if (existing.Owner !== owner)
            {
                throw new TypeError("Diagetic entity is already attached to another definition");
            }

        }

        const saved = existing ? undefined : ReadControl(entity, config);
        const state: AttachmentState = existing ?? { Owner: owner,
            Motion: Motion.Make(config, saved?.Value ?? initial),
            Pose: saved?.Pose ?? pose,
            Binding: saved?.Binding ?? binding,
            Removed: false };
        const persist = (value: number): void => WriteControl(entity, { Version: 1,
            Kind: config.Kind,
            Value: value,
            Pose: state.Pose,
            Binding: state.Binding });
        if (!existing && !saved)
        {
            persist(initial);
        }

        const handle: Handle<K> = Object.freeze({ Definition: definition,
            Entity: entity,
            get Value(): number
            {
                return state.Motion.State.Value;
            },
            Pose: state.Pose,
            Binding: state.Binding,
            get IsValid(): boolean
            {
                return !state.Removed && entity.isValid;
            },
            SetValue(next: number): void
            {
                if (!handle.IsValid)
                {
                    throw new Error("Diagetic handle no longer refers to a valid entity");
                }

                const previous = state.Motion.State.Value;
                CheckValue(next, config.Limits);
                if (next !== previous)
                {
                    persist(next);
                }

                state.Motion.SetValue(next);
                if (next !== previous)
                {
                    try
                    {
                        present(next);
                        config.OnChange?.(Object.freeze({ Control: handle,
                            PreviousValue: previous,
                            Value: next,
                            Source: "programmatic" }));
                    }
                    finally
                    {
                        Wake(definition, handle);
                    }
                }
                else
                {
                    Wake(definition, handle);
                }
            },
            Motion: Object.freeze({
                get State(): Motion.Snapshot
                {
                    return state.Motion.State;
                },
                Begin(frame: Motion.Frame, pointer?: Parameters<Motion.Controller["Begin"]>[1]): void
                {
                    if (!handle.IsValid)
                    {
                        throw new Error("Diagetic handle no longer refers to a valid entity");
                    }

                    state.Motion.Begin(frame, pointer);
                    Wake(definition, handle);
                },
                Look(sample: Motion.LookSample): boolean
                {
                    if (!handle.IsValid)
                    {
                        throw new Error("Diagetic handle no longer refers to a valid entity");
                    }

                    const accepted = state.Motion.Look(sample);
                    Wake(definition, handle);
                    return accepted;
                },
                Release(): void
                {
                    state.Motion.Release();
                    Wake(definition, handle);
                },
                SetValue(next: number): void
                {
                    handle.SetValue(next);
                },
                Step(): Motion.Snapshot
                {
                    if (!handle.IsValid)
                    {
                        throw new Error("Diagetic handle no longer refers to a valid entity");
                    }

                    const previous = handle.Value;
                    const next = state.Motion.Step();
                    if (next.Value !== previous)
                    {
                        try
                        {
                            persist(next.Value);
                        }
                        catch (error)
                        {
                            state.Motion.SetValue(previous);
                            throw error;
                        }

                        present(next.Value);
                        config.OnChange?.(Object.freeze({ Control: handle,
                            PreviousValue: previous,
                            Value: next.Value,
                            Source: next.Dragging ? "input" : "simulation" }));
                    }

                    return next;
                }
            }),
            Remove(): void
            {
                if (!state.Removed)
                {
                    if (entity.isValid)
                    {
                        entity.remove();
                    }

                    state.Removed = true;
                    Handles.delete(entity);
                    state.Motion.Release();
                }
            } });
        const present = (value: number): void =>
        {
            Present(handle, MotionValue(config, value));
        };

        Handles.set(entity, state);
        present(state.Motion.State.Value);
        Wake(definition, handle);
        return handle;
    };

    const definition: Definition<K> = Object.freeze({ Kind: config.Kind,
        EntityType: config.EntityType!,
        Configuration: config as ConfigurationFor<K>,
        Spawn(dimension: Dimension, location: Vector3, options: SpawnOptions = {}): Handle<K>
        {
            const { Value, Pose, Binding: receipt, Initialize, ...nativeOptions } = options;
            const initial = CheckValue(Value ?? config.InitialValue!, config.Limits);
            const modelPose = PoseSnapshot(Pose);
            const binding = Binding(receipt);
            const position = Coordinates(location);
            if (Initialize !== undefined && typeof Initialize !== "function")
            {
                throw new TypeError("Diagetic Initialize must be a function");
            }

            const entity = dimension.spawnEntity(config.EntityType!, position, nativeOptions);
            try
            {
                const handle = attach(entity, initial, modelPose, binding);
                Initialize?.(entity, handle);
                if (!handle.IsValid)
                {
                    throw new Error("Diagetic initialization removed or invalidated the spawned entity");
                }

                return handle;
            }
            catch (error)
            {
                const state = Handles.get(entity);
                if (state)
                {
                    state.Removed = true;
                }

                Handles.delete(entity);
                if (entity.isValid)
                {
                    try
                    {
                        entity.remove();
                    }
                    catch (cleanupError)
                    {
                        throw new AggregateError([ error, cleanupError ], "Diagetic spawn rollback failed");
                    }
                }

                throw error;
            }
        },
        Attach(entity: Entity): Handle<K>
        {
            return attach(entity, config.InitialValue!, PoseSnapshot());
        } });
    RegisterDefinition(definition);
    return definition;
};

/**
 * Creates a reusable lever definition with endpoint detents and a ninety-degree default sweep.
 *
 * @throws { TypeError } If configuration is malformed.
 * @throws { RangeError } If motion policy is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Lever = (options: Options<"lever"> = {}): Definition<"lever"> =>
{
    return Make({ ...options,
        Kind: "lever" });
};

/**
 * Creates a reusable slider definition with a half-block default track and retained released position.
 *
 * @throws { TypeError } If configuration is malformed.
 * @throws { RangeError } If motion policy is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Slider = (options: Options<"slider"> = {}): Definition<"slider"> =>
{
    return Make({ ...options,
        Kind: "slider" });
};

/**
 * Creates a reusable unbounded wheel definition with a half-block diameter and central dead zone.
 *
 * @throws { TypeError } If configuration is malformed.
 * @throws { RangeError } If motion policy is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Wheel = (options: Options<"wheel"> = {}): Definition<"wheel"> =>
{
    return Make({ ...options,
        Kind: "wheel" });
};

/**
 * Recommended spawn location for a bound control using the shared carrier: the collision box is centred a
 * quarter block out from the support face centre, so it covers the model without being buried in the block.
 * The rendered model is placed at the face centre regardless of the carrier location.
 *
 * @throws { TypeError } If the binding's dimension or face is invalid.
 * @throws { RangeError } If the binding position is not an integral finite block position.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const BindingLocation = (binding: BlockBinding): Vector3 =>
{
    const { Position: position, Face: face } = Binding(binding)!;
    const normal = { x: face === "East" ? 1 : face === "West" ? -1 : 0,
        y: face === "Up" ? 1 : face === "Down" ? -1 : 0,
        z: face === "South" ? 1 : face === "North" ? -1 : 0 };
    return { x: position.x + 0.5 + normal.x * 0.75,
        y: position.y + 0.5 + normal.y * 0.75 - CarrierSize / 2,
        z: position.z + 0.5 + normal.z * 0.75 };
};

/**
 * Publishes a control's mount pose and a moving-bone value into the shared synchronized properties.
 * Built-in handles publish automatically after attachment and every committed value change; custom
 * controls that reuse the shared bone layout can call this from their Publish hook. Entity types that
 * do not declare the shared property schema are left untouched, and the result is false.
 *
 * @throws { Error } If the native entity rejects a property write.
 *
 * @category Rendering
 * @since 1.0.0
 */
export const PublishPose = (control: Pick<Handle, "Entity" | "Binding" | "Pose">, motion: number): boolean =>
{
    return Present(control, motion);
};

/**
 * Registers a copied set of definitions against explicitly supplied native dependencies.
 * Subscribes only when explicitly started. Uses the accepted native entity Use signal for toggling;
 * journals original permissions/orientation before any player lock and recovers interrupted sessions.
 *
 * @throws { TypeError } If dependencies, definitions or duplicate entity-type registrations are invalid.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const Start = (options: StartOptions): Runtime =>
{
    if (!options?.World || typeof options.World.getDimension !== "function" ||
        !options.System || typeof options.System.runInterval !== "function" ||
        typeof options.System.clearRun !== "function" || !Array.isArray(options.Controls))
    {
        throw new TypeError("Diagetic Start requires explicit World, System and Controls");
    }

    if (options.OnError !== undefined && typeof options.OnError !== "function")
    {
        throw new TypeError("Diagetic OnError must be a function");
    }

    const types = new Set<string>();
    for (const control of options.Controls)
    {
        if (!IsDefinition(control) || types.has(control.EntityType))
        {
            throw new TypeError("Diagetic Controls must be definitions with unique entity types");
        }

        types.add(control.EntityType);
    }

    return StartRuntime(options);
};
