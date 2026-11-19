/**
 * Low-level custom controls whose acquisition, look, simulation, persistence, pose and release
 * behavior is supplied by consumer hooks while the shared runtime owns sessions and cleanup.
 *
 * @module bedform/Diagetic/Custom
 *
 * @file      Custom.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public contracts and hook events retain semantic field ordering. */
/* eslint-disable sort-keys */

import type { BlockBinding, CancellationReason, ModelPose } from "../Diagetic.js";
import { Binding as CheckBinding, Coordinates, Identifier, Parameter }
    from "../Internal/DiageticConfiguration.js";
import { CopyFrame, StepSeconds } from "./Simulation.js";
import type { Dimension, Entity, Player, SpawnEntityOptions, Vector2, Vector3 }
    from "@minecraft/server";
import { FindAttached, RegisterDefinition, Wake } from "../Internal/DiageticRuntime.js";
import type { Frame, LookSample } from "./Simulation.js";
import { Pose as PoseSnapshot, ReadCustom, WriteControl } from "../Internal/DiageticPersistence.js";

/**
 * Hook or programmatic origin of a committed custom value. Attach publishes a newly created or restored
 * attachment without reporting a change.
 *
 * @category Model
 * @since 1.0.0
 */
export type Source = "acquire" | "input" | "simulation" | "release" | "programmatic";

/**
 * Fields shared by every hook event: the handle and its committed value when the hook was invoked.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Event<S>
{
    readonly Control: Handle<S>;
    readonly Value: S;
}

/**
 * Acquisition after the runtime claimed both actors, journaled recovery and locked the player.
 * Frame is the frozen eye camera and mount frame used for the whole grab.
 *
 * @category Model
 * @since 1.0.0
 */
export interface AcquireEvent<S> extends Event<S>
{
    readonly Player?: Player;
    readonly Frame: Frame;
}

/**
 * One look sample in degrees; positive yaw is screen-right and positive pitch is screen-down.
 * Estimated marks correction-gap reconstruction rather than measured rotation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LookEvent<S> extends Event<S>
{
    readonly Player?: Player;
    readonly Frame: Frame;
    readonly Delta: Readonly<Vector2>;
    readonly Estimated: boolean;
}

/**
 * One fixed simulation step of exactly StepSeconds, while held or settling after release.
 * Frame and Player are present only while held.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SimulateEvent<S> extends Event<S>
{
    readonly Held: boolean;
    readonly Estimated: boolean;
    readonly Frame?: Frame;
    readonly Player?: Player;
    readonly StepSeconds: typeof StepSeconds;
}

/**
 * A simulation result. An omitted or identical Value leaves state unchanged. Settled stops stepping
 * after release until input, a programmatic change or another acquisition wakes the control.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SimulateResult<S>
{
    readonly Value?: S;
    readonly Settled: boolean;
}

/**
 * A successful second-Use release when Reason is absent, otherwise a cancellation. The player may be
 * unavailable during cancellation, and the control may already be invalid.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ReleaseEvent<S> extends Event<S>
{
    readonly Player?: Player;
    readonly Reason?: CancellationReason;
}

/**
 * Pose publication for a committed value or a fresh attachment. Publish synchronized entity properties,
 * animations or other presentation here; it runs after persistence commits.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PublishEvent<S> extends Event<S>
{
    readonly Source: Source | "attach";
}

/**
 * A committed custom value change, reported after pose publication.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ChangeEvent<S>
{
    readonly Control: Handle<S>;
    readonly PreviousValue: S;
    readonly Value: S;
    readonly Source: Source;
}

/**
 * Custom-control hooks. Hooks are synchronous and never invoked by Make. Value hooks return a new value to
 * change state; returning undefined or the identical value changes nothing. Treat values as immutable.
 * Each change is saved, committed, published and then reported; a failed Save or write commits nothing.
 * Release runs exactly once for each Acquire that returned, including cancellation and failures.
 * Save must return JSON-compatible data; Load decodes it and must throw for unsupported data.
 * Values that differ only in fields omitted by Save change in memory without rewriting the record.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration<S>
{
    readonly EntityType: string;
    readonly Initial: S;
    readonly InteractionRange?: number;
    readonly Eligible?: (player: Player, control: Handle<S>) => boolean;
    readonly Acquire?: (event: AcquireEvent<S>) => S | undefined;
    readonly Look?: (event: LookEvent<S>) => S | undefined;
    readonly Simulate?: (event: SimulateEvent<S>) => SimulateResult<S>;
    readonly Release?: (event: ReleaseEvent<S>) => S | undefined;
    readonly Save: (value: S) => unknown;
    readonly Load: (saved: unknown) => S;
    readonly Publish?: (event: PublishEvent<S>) => void;
    readonly OnChange?: (event: ChangeEvent<S>) => void;
}

/**
 * Native spawn options with an initial custom value, model pose, support receipt and initialization.
 * Native options are forwarded unchanged; failure removes only the newly spawned entity.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface SpawnOptions<S> extends SpawnEntityOptions
{
    readonly Value?: S;
    readonly Pose?: Partial<ModelPose>;
    readonly Binding?: BlockBinding;
    readonly Initialize?: (entity: Entity, control: Handle<S>) => void;
}

/**
 * Transient interaction status. It is never persisted, so a reload is released and unsettled.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Status
{
    readonly Held: boolean;
    readonly Settled: boolean;
    readonly Estimated: boolean;
}

/**
 * Low-level driver used by a started runtime. Begin invokes Acquire, Look invokes Look, Step invokes
 * Simulate and Release invokes Release. Avoid driving a handle that a started runtime also owns.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Driver
{
    readonly State: Status;
    readonly Begin: (frame: Frame, player?: Player) => void;
    readonly Look: (sample: LookSample, player?: Player) => boolean;
    readonly Step: () => Status;
    readonly Release: (player?: Player, reason?: CancellationReason) => void;
}

/**
 * A custom control attached to a native entity. Value is the committed consumer value.
 * SetValue commits a programmatic value through Save, persistence, Publish and OnChange.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Handle<S>
{
    readonly Definition: Definition<S>;
    readonly Entity: Entity;
    readonly Value: S;
    readonly Motion: Driver;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
    readonly IsValid: boolean;
    readonly SetValue: (value: S) => void;
    readonly Remove: () => void;
}

/**
 * A reusable frozen custom definition registered with Start alongside built-in definitions.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Definition<S>
{
    readonly Kind: "custom";
    readonly EntityType: string;
    readonly Configuration: Readonly<Configuration<S>>;
    readonly Spawn: (dimension: Dimension, location: Vector3, options?: SpawnOptions<S>) => Handle<S>;
    readonly Attach: (entity: Entity) => Handle<S>;
}

interface Attachment<S>
{
    readonly Owner: object;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
    Value: S;
    Saved: string;
    Held: boolean;
    Settled: boolean;
    Estimated: boolean;
    Frame?: Frame;
    Holder?: Player;
    Removed: boolean;
}

// Values hold no handle, hooks or the keyed entity; QuickJS retains self-referencing WeakMap entries.
const Attachments = new WeakMap<Entity, Attachment<unknown>>();
const HookNames = [ "Eligible", "Acquire", "Look", "Simulate", "Release", "Save", "Load", "Publish",
    "OnChange" ] as const;

/**
 * Encodes a value through Save and requires JSON-compatible output.
 *
 * @throws { TypeError } If Save returns data that JSON cannot represent.
 *
 * @category Encoding
 * @since 1.0.0
 */
const Encode = <S>(configuration: Configuration<S>, value: S): string =>
{
    const raw = JSON.stringify(configuration.Save(value)) as string | undefined;
    if (typeof raw !== "string")
    {
        throw new TypeError("Diagetic custom Save must return JSON-compatible data");
    }

    return raw;
};

/**
 * Requires a defined value; undefined is reserved for unchanged hook results.
 *
 * @throws { TypeError } If the value is undefined.
 *
 * @category Validation
 * @since 1.0.0
 */
const Defined = <S>(value: S, name: string): S =>
{
    if (value === undefined)
    {
        throw new TypeError(`Diagetic custom ${name} must not be undefined`);
    }

    return value;
};

/**
 * Validates a custom configuration and copies it without invoking any hook.
 *
 * @throws { TypeError } If the entity type, initial value or a hook is invalid.
 * @throws { RangeError } If the interaction range is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Configure = <S>(input: Configuration<S>): Configuration<S> =>
{
    if (!input || typeof input !== "object")
    {
        throw new TypeError("Diagetic custom configuration is required");
    }

    for (const name of HookNames)
    {
        if (input[name] !== undefined && typeof input[name] !== "function")
        {
            throw new TypeError(`Diagetic custom ${name} must be a function`);
        }
    }

    if (typeof input.Save !== "function" || typeof input.Load !== "function")
    {
        throw new TypeError("Diagetic custom controls require Save and Load persistence hooks");
    }

    return Object.freeze({ ...input,
        EntityType: Identifier(input.EntityType),
        Initial: Defined(input.Initial, "Initial"),
        InteractionRange: Parameter(input.InteractionRange ?? 3, "interaction range", true) });
};

/**
 * Creates a reusable custom-control definition without accessing the game host. Built-in session
 * ownership, camera capture, look measurement, recovery and cleanup are reused unchanged; the hooks
 * supply simulation, persistence and pose publication. No branched-path or transmission solver is
 * provided.
 *
 * @throws { TypeError } If the entity type, initial value or a hook is invalid.
 * @throws { RangeError } If the interaction range is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Make = <S>(configuration: Configuration<S>): Definition<S> =>
{
    const config = Configure(configuration);
    const owner = Object.freeze({});
    const attach = (entity: Entity, created?: Omit<SpawnOptions<S>, "Initialize">): Handle<S> =>
    {
        if (!entity?.isValid || entity.typeId !== config.EntityType)
        {
            throw new TypeError("Diagetic Attach requires a valid entity of the configured type");
        }

        const tracked = FindAttached(definition, entity.id);
        if (tracked)
        {
            return tracked as Handle<S>;
        }

        const existing = Attachments.get(entity) as Attachment<S> | undefined;
        if (existing && existing.Owner !== owner)
        {
            throw new TypeError("Diagetic entity is already attached to another definition");
        }

        let fresh = false;
        let state = existing;
        if (!state)
        {
            const saved = created ? undefined : ReadCustom(entity);
            const value = saved ? Defined(config.Load(saved.Value), "Load result")
                : Defined(created ? created.Value as S : config.Initial, "Value");
            const pose = saved?.Pose ?? PoseSnapshot(created?.Pose);
            const binding = saved?.Binding ?? CheckBinding(created?.Binding);
            const raw = saved ? JSON.stringify(saved.Value) : Encode(config, value);
            if (!saved)
            {
                WriteControl(entity, { Version: 1,
                    Kind: "custom",
                    Value: JSON.parse(raw),
                    Pose: pose,
                    Binding: binding });
            }

            state = { Owner: owner,
                Pose: pose,
                Binding: binding,
                Value: value,
                Saved: raw,
                Held: false,
                Settled: false,
                Estimated: false,
                Removed: false };
            fresh = true;
        }

        const live = state;
        const valid = (): void =>
        {
            if (!handle.IsValid)
            {
                throw new Error("Diagetic handle no longer refers to a valid entity");
            }
        };

        const commit = (next: S | undefined, source: Source): void =>
        {
            if (next === undefined || Object.is(next, live.Value))
            {
                return;
            }

            const raw = Encode(config, next);
            if (raw !== live.Saved)
            {
                WriteControl(entity, { Version: 1,
                    Kind: "custom",
                    Value: JSON.parse(raw),
                    Pose: live.Pose,
                    Binding: live.Binding });
            }

            const previous = live.Value;
            live.Value = next;
            live.Saved = raw;
            live.Settled = false;
            const errors: Array<unknown> = [];
            try
            {
                config.Publish?.(Object.freeze({ Control: handle,
                    Value: next,
                    Source: source }));
            }
            catch (error)
            {
                errors.push(error);
            }

            try
            {
                config.OnChange?.(Object.freeze({ Control: handle,
                    PreviousValue: previous,
                    Value: next,
                    Source: source }));
            }
            catch (error)
            {
                errors.push(error);
            }

            if (errors.length === 1)
            {
                throw errors[0];
            }

            if (errors.length)
            {
                throw new AggregateError(errors, "Diagetic custom publication and change callbacks failed");
            }
        };

        const status = (): Status => Object.freeze({ Held: live.Held,
            Settled: live.Settled,
            Estimated: live.Estimated });
        const handle: Handle<S> = Object.freeze({ Definition: definition,
            Entity: entity,
            get Value(): S
            {
                return live.Value;
            },
            Pose: live.Pose,
            Binding: live.Binding,
            get IsValid(): boolean
            {
                return !live.Removed && entity.isValid;
            },
            SetValue(next: S): void
            {
                valid();
                try
                {
                    commit(Defined(next, "value"), "programmatic");
                }
                finally
                {
                    Wake(definition, handle);
                }
            },
            Motion: Object.freeze({
                get State(): Status
                {
                    return status();
                },
                Begin(frame: Frame, player?: Player): void
                {
                    valid();
                    const copy = CopyFrame(frame);
                    const next = config.Acquire?.(Object.freeze({ Control: handle,
                        Value: live.Value,
                        Player: player,
                        Frame: copy }));
                    live.Held = true;
                    live.Settled = false;
                    live.Estimated = false;
                    live.Frame = copy;
                    live.Holder = player;
                    try
                    {
                        commit(next, "acquire");
                    }
                    finally
                    {
                        Wake(definition, handle);
                    }
                },
                Look(sample: LookSample, player?: Player): boolean
                {
                    valid();
                    if (!live.Held || !live.Frame)
                    {
                        throw new Error("Diagetic Look requires an active drag");
                    }

                    const delta = Coordinates({ x: sample?.Delta?.x,
                        y: sample?.Delta?.y,
                        z: 0 });
                    if (sample.Estimated !== undefined && typeof sample.Estimated !== "boolean")
                    {
                        throw new TypeError("Diagetic Estimated must be a boolean");
                    }

                    live.Estimated = sample.Estimated === true;
                    const next = config.Look?.(Object.freeze({ Control: handle,
                        Value: live.Value,
                        Player: player ?? live.Holder,
                        Frame: live.Frame,
                        Delta: Object.freeze({ x: delta.x,
                            y: delta.y }),
                        Estimated: live.Estimated }));
                    try
                    {
                        commit(next, "input");
                    }
                    finally
                    {
                        Wake(definition, handle);
                    }

                    return true;
                },
                Step(): Status
                {
                    valid();
                    const held = live.Held;
                    const result = config.Simulate
                        ? config.Simulate(Object.freeze({ Control: handle,
                            Value: live.Value,
                            Held: held,
                            Estimated: live.Estimated,
                            Frame: live.Frame,
                            Player: live.Holder,
                            StepSeconds }))
                        : { Settled: true };
                    if (!result || typeof result.Settled !== "boolean")
                    {
                        throw new TypeError("Diagetic custom Simulate must return a Settled flag");
                    }

                    commit(result.Value, held ? "input" : "simulation");
                    live.Settled = !held && result.Settled;
                    return status();
                },
                Release(player?: Player, reason?: CancellationReason): void
                {
                    if (!live.Held)
                    {
                        return;
                    }

                    const holder = player ?? live.Holder;
                    live.Held = false;
                    live.Settled = false;
                    live.Estimated = false;
                    live.Frame = undefined;
                    live.Holder = undefined;
                    try
                    {
                        const next = config.Release?.(Object.freeze({ Control: handle,
                            Value: live.Value,
                            Player: holder?.isValid ? holder : undefined,
                            Reason: reason }));
                        if (handle.IsValid)
                        {
                            commit(next, "release");
                        }
                    }
                    finally
                    {
                        if (handle.IsValid)
                        {
                            Wake(definition, handle);
                        }
                    }
                }
            }),
            Remove(): void
            {
                if (!live.Removed)
                {
                    if (entity.isValid)
                    {
                        entity.remove();
                    }

                    live.Removed = true;
                    Attachments.delete(entity);
                }
            } });
        if (fresh)
        {
            Attachments.set(entity, live as Attachment<unknown>);
            try
            {
                config.Publish?.(Object.freeze({ Control: handle,
                    Value: live.Value,
                    Source: "attach" }));
            }
            catch (error)
            {
                Attachments.delete(entity);
                throw error;
            }
        }

        Wake(definition, handle);
        return handle;
    };

    const definition: Definition<S> = Object.freeze({ Kind: "custom",
        EntityType: config.EntityType,
        Configuration: config,
        Spawn(dimension: Dimension, location: Vector3, options: SpawnOptions<S> = {}): Handle<S>
        {
            const { Value, Pose, Binding, Initialize, ...nativeOptions } = options;
            const created = { Value: Value === undefined ? config.Initial : Value,
                Pose: PoseSnapshot(Pose),
                Binding: CheckBinding(Binding) };
            const position = Coordinates(location);
            if (Initialize !== undefined && typeof Initialize !== "function")
            {
                throw new TypeError("Diagetic Initialize must be a function");
            }

            const entity = dimension.spawnEntity(config.EntityType, position, nativeOptions);
            try
            {
                const handle = attach(entity, created);
                Initialize?.(entity, handle);
                if (!handle.IsValid)
                {
                    throw new Error("Diagetic initialization removed or invalidated the spawned entity");
                }

                return handle;
            }
            catch (error)
            {
                const state = Attachments.get(entity);
                if (state)
                {
                    state.Removed = true;
                }

                Attachments.delete(entity);
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
        Attach(entity: Entity): Handle<S>
        {
            return attach(entity);
        } });
    RegisterDefinition(definition);
    return definition;
};
