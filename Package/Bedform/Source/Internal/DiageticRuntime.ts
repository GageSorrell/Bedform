/**
 * Explicit Diagetic input sessions, cooperative claims, write-ahead recovery and native tick ownership.
 *
 * @module bedform/Internal/DiageticRuntime
 *
 * @file      DiageticRuntime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Transaction phases retain semantic ordering; native signal callbacks use contextual inference. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { CameraPreset, DynamicProperty, EntityEvent, EntityProperty, NativePermission,
    ReleasePrompt, ReleaseTarget, TagPrefix } from "../Diagetic/Keys.js";
import type { CancellationReason, Handle, PlayerEvent, Runtime, StartOptions } from "../Diagetic.js";
import type { Entity, Player, Vector3 } from "@minecraft/server";
import type { Frame, LookSample } from "../Diagetic/Simulation.js";
import { PrepareJournal, ReadJournal, RestoreJournal } from "./DiageticRecovery.js";
import { CaptureFrame } from "./DiageticFrame.js";
import type { Handle as CustomHandle } from "../Diagetic/Custom.js";
import { FreezeCamera } from "../Diagetic/Camera.js";
import type { Journal } from "./DiageticRecovery.js";
import type { LookState } from "../Diagetic/Look.js";
import { MeasureLook } from "../Diagetic/Look.js";
import { Support } from "./DiageticSupport.js";

/**
 * Any registered definition: a built-in kind or a hook-driven custom control.
 *
 * @category Model
 * @since 1.0.0
 */
export type AnyDefinition = StartOptions["Controls"][number];

/**
 * Any attached handle the session runtime drives.
 *
 * @category Model
 * @since 1.0.0
 */
export type AnyHandle = Handle | CustomHandle<any>;

/**
 * Session policy common to built-in and custom configurations. Custom controls have no built-in
 * grab, release or cancel callbacks; their Acquire and Release hooks run through the driver instead.
 *
 * @category Model
 * @since 1.0.0
 */
interface Lifecycle
{
    readonly InteractionRange?: number;
    readonly Eligible?: (player: Player, control: AnyHandle) => boolean;
    readonly OnGrab?: (event: PlayerEvent) => void;
}

interface Registry
{
    readonly Watchers: Set<(handle: AnyHandle) => void>;
    readonly Lookups: Set<(id: string) => AnyHandle | undefined>;
}

interface Signal<A>
{
    subscribe(callback: (event: A) => void): unknown;
    unsubscribe(callback: (event: A) => void): void;
}

interface Host
{
    readonly Players: Map<string, Session>;
    readonly Actors: Map<string, Session>;
    readonly Types: Map<string, Context>;
    readonly System: StartOptions["System"];
}

interface Context
{
    readonly Options: StartOptions;
    readonly Host: Host;
    readonly Controls: Map<string, AnyHandle>;
    readonly Active: Map<string, AnyHandle>;
    readonly Sessions: Set<Session>;
    readonly Pending: Map<string, number>;
    readonly Runs: Set<number>;
    readonly LastUse: Map<string, number>;
    readonly Dead: Set<string>;
    readonly RecoveryErrors: Set<string>;
    readonly Retiring: Set<string>;
    readonly RetirementErrors: Set<string>;
    readonly Cleanup: Array<() => void>;
    Disposed: boolean;
}

interface Session
{
    readonly Context: Context;
    readonly Player: Player;
    readonly Control: AnyHandle;
    Target?: Entity;
    TargetRefreshTick?: number;
    Journal?: Journal;
    Look?: LookState;
    Closing: boolean;
}

const Registries = new WeakMap<AnyDefinition, Registry>();
// Strong references exist only for explicitly started lifetimes and are released by Dispose.
const Hosts = new Map<object, Host>();

/**
 * Installs an empty, inert definition registry. Active lookup closures are removed at disposal.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const RegisterDefinition = (definition: AnyDefinition): void =>
{
    Registries.set(definition, { Watchers: new Set(),
        Lookups: new Set() });
};

/**
 * Shares a tracked native actor's handle across equivalent native wrapper objects while a runtime is alive.
 *
 * @category Getter
 * @since 1.0.0
 */
export const FindAttached = (definition: AnyDefinition, id: string): AnyHandle | undefined =>
{
    for (const lookup of Registries.get(definition)?.Lookups ?? [])
    {
        const handle = lookup(id);
        if (handle?.IsValid)
        {
            return handle;
        }
    }

    return undefined;
};

/**
 * Wakes a tracked control after explicit attachment, input, release or programmatic updates.
 *
 * @category Running
 * @since 1.0.0
 */
export const Wake = (definition: AnyDefinition, handle: AnyHandle): void =>
{
    for (const watcher of Registries.get(definition)?.Watchers ?? [])
    {
        watcher(handle);
    }
};

/**
 * Recognizes definitions constructed by Make or Custom.Make.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const IsDefinition = (definition: unknown): definition is AnyDefinition =>
{
    return typeof definition === "object" && definition !== null &&
        Registries.has(definition as AnyDefinition);
};

/**
 * Distinguishes hook-driven custom handles from built-in scalar motion.
 *
 * @category Predicate
 * @since 1.0.0
 */
const IsCustom = (control: AnyHandle): control is CustomHandle<any> =>
{
    return control.Definition.Kind === "custom";
};

/**
 * Reads the session policy shared by built-in and custom configurations.
 *
 * @category Getter
 * @since 1.0.0
 */
const Policy = (control: AnyHandle): Lifecycle =>
{
    return control.Definition.Configuration as Lifecycle;
};

/**
 * Begins a drag; custom drivers additionally receive the acquiring player for their Acquire hook.
 *
 * @category Running
 * @since 1.0.0
 */
const Begin = (control: AnyHandle, frame: Frame, player: Player): void =>
{
    if (IsCustom(control))
    {
        control.Motion.Begin(frame, player);
    }
    else
    {
        control.Motion.Begin(frame);
    }
};

/**
 * Delivers a measured or estimated look sample; custom drivers additionally receive the holder.
 *
 * @category Running
 * @since 1.0.0
 */
const Look = (control: AnyHandle, sample: LookSample, player: Player): void =>
{
    if (IsCustom(control))
    {
        control.Motion.Look(sample, player);
    }
    else
    {
        control.Motion.Look(sample);
    }
};

/**
 * Ends a drag; custom drivers receive the holder and cancellation reason for their Release hook.
 *
 * @category Running
 * @since 1.0.0
 */
const End = (control: AnyHandle, player: Player, reason?: CancellationReason): void =>
{
    if (IsCustom(control))
    {
        control.Motion.Release(player, reason);
    }
    else
    {
        control.Motion.Release();
    }
};

/**
 * Reports faults without allowing an error sink to interrupt resource cleanup.
 *
 * @category ErrorHandling
 * @since 1.0.0
 */
const Report = (context: Context, error: unknown): void =>
{
    try
    {
        if (context.Options.OnError)
        {
            context.Options.OnError(error);
        }
        else
        {
            const Globals = globalThis as { readonly console?: unknown };
            const Logger = Globals.console as { readonly error: (message: string) => void } | undefined;
            Logger?.error(`Diagetic: ${String(error)}`);
        }
    }
    catch { /* Error observers cannot acquire ownership or interrupt cleanup. */ }
};

/**
 * Retires orphaned control tags without removing a live player's cooperative claim.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Prune = (context: Context, actor: Entity): void =>
{
    const tags = actor.getTags().filter((tag: string) => tag.startsWith(TagPrefix.Session));
    if (tags.length === 0)
    {
        return;
    }

    const players = context.Options.World.getAllPlayers();
    for (const tag of tags)
    {
        if (!players.some((player: Player) => player.isValid && player.hasTag(tag)))
        {
            actor.removeTag(tag);
        }
    }
};

/**
 * Recovers stale receipts without resuming grabs. Corrupt or temporarily unavailable state fails closed.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Recover = (context: Context, player: Player): boolean =>
{
    if (context.Host.Players.has(player.id))
    {
        return false;
    }

    try
    {
        const journal = ReadJournal(context.Options.World, player.id);
        if (journal)
        {
            const errors = RestoreJournal(context.Options.World, player, journal);
            if (errors.length)
            {
                throw new AggregateError(errors, "Diagetic player recovery incomplete");
            }
        }

        context.RecoveryErrors.delete(player.id);
        return true;
    }
    catch (error)
    {
        if (!context.RecoveryErrors.has(player.id))
        {
            context.RecoveryErrors.add(player.id);
            Report(context, error);
        }

        return false;
    }
};

/**
 * Cancels pending observation callbacks so a lifecycle boundary cannot reacquire a stale player.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Invalidate = (context: Context, playerId: string): void =>
{
    const run = context.Pending.get(playerId);
    context.Pending.delete(playerId);
    if (run !== undefined)
    {
        context.Runs.delete(run);
        try
        {
            context.Options.System.clearRun(run);
        }
        catch (error)
        {
            Report(context, error);
        }
    }
};

/**
 * Retires a session once. Ownership remains claimed through callbacks and independent restoration attempts.
 * Failed cleanup retains the recovery receipt but always releases in-memory ownership.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Finish = (session: Session, reason?: CancellationReason): void =>
{
    const { Context: context, Player: player, Control: control } = session;
    if (session.Closing || !context.Sessions.has(session))
    {
        return;
    }

    session.Closing = true;
    Invalidate(context, player.id);
    const errors: Array<unknown> = [];
    try
    {
        if (session.Target?.isValid)
        {
            session.Target.remove();
        }
    }
    catch (error)
    {
        errors.push(error);
    }

    try
    {
        End(control, player, reason);
    }
    catch (error)
    {
        errors.push(error);
    }

    try
    {
        if (session.Journal && !IsCustom(control))
        {
            if (reason)
            {
                control.Definition.Configuration.OnCancel?.({ Control: control,
                    Player: player.isValid ? player : undefined,
                    Reason: reason });
            }
            else
            {
                control.Definition.Configuration.OnRelease?.({ Control: control,
                    Player: player });
            }
        }
    }
    catch (error)
    {
        errors.push(error);
    }
    finally
    {
        try
        {
            if (session.Journal)
            {
                errors.push(...RestoreJournal(context.Options.World, player, session.Journal));
            }
        }
        catch (error)
        {
            errors.push(error);
        }
        finally
        {
            context.Sessions.delete(session);
            if (context.Host.Players.get(player.id) === session)
            {
                context.Host.Players.delete(player.id);
            }

            if (context.Host.Actors.get(control.Entity.id) === session)
            {
                context.Host.Actors.delete(control.Entity.id);
            }

            if (!context.Disposed && control.IsValid)
            {
                context.Active.set(control.Entity.id, control);
            }
        }
    }

    if (errors.length)
    {
        Report(context, new AggregateError(errors, "Diagetic session retirement incomplete"));
    }
};

/**
 * Places a short-lived invisible receiver along the current native aim. Refreshing its lease every
 * five ticks also bounds orphan lifetime after script reload or a failed removal.
 *
 * @throws { Error } If the native receiver is unavailable.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const UpdateTarget = (session: Session): void =>
{
    const player = session.Player;
    const head = player.getHeadLocation();
    const aim = player.getViewDirection();
    const position = { x: head.x + aim.x * 1.5,
        y: head.y + aim.y * 1.5 - 0.3,
        z: head.z + aim.z * 1.5 };
    if (!session.Target)
    {
        session.Target = player.dimension.spawnEntity(ReleaseTarget, position);
    }

    if (!session.Target.isValid)
    {
        throw new Error("Diagetic release target was lost");
    }

    const previous = session.Target.location;
    if (Math.hypot(previous.x - position.x, previous.y - position.y, previous.z - position.z) > 0.001)
    {
        session.Target.teleport(position);
    }

    const tick = session.Context.Options.System.currentTick;
    if (session.TargetRefreshTick === undefined || tick - session.TargetRefreshTick >= 5)
    {
        session.Target.triggerEvent(EntityEvent.RefreshTarget);
        session.TargetRefreshTick = tick;
    }
};

/**
 * Claims before calling eligibility or mutating the player, commits recovery, then captures one frozen frame.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Acquire = (context: Context, player: Player, actor: Entity): void =>
{
    const active = context.Host.Players.get(player.id);
    if (active)
    {
        if (active.Context === context && !active.Closing)
        {
            Finish(active);
        }

        return;
    }

    if (context.Disposed || !player.isValid || !actor.isValid || context.Dead.has(player.id) ||
        context.Host.Actors.has(actor.id) || context.Retiring.has(actor.id) || !Recover(context, player))
    {
        return;
    }

    const definition = context.Options.Controls.find((control: AnyDefinition) =>
        control.EntityType === actor.typeId);
    if (!definition)
    {
        return;
    }

    try
    {
        Prune(context, actor);
        if ([ ...player.getTags(), ...actor.getTags() ].some((tag: string) =>
            tag.startsWith(TagPrefix.Session)))
        {
            return;
        }

        const control = context.Controls.get(actor.id) ?? definition.Attach(actor);
        if (Support(context.Options.World, control) !== "valid")
        {
            return;
        }

        const session: Session = { Context: context,
            Player: player,
            Control: control,
            Closing: false };
        context.Sessions.add(session);
        context.Host.Players.set(player.id, session);
        context.Host.Actors.set(actor.id, session);
        try
        {
            const configuration = Policy(control);
            const rotation = player.getRotation();
            const frame = CaptureFrame(player, control, rotation);
            if (actor.dimension.id !== player.dimension.id || Math.hypot(
                frame.Mount.Position.x - frame.Camera.Position.x,
                frame.Mount.Position.y - frame.Camera.Position.y,
                frame.Mount.Position.z - frame.Camera.Position.z) > configuration.InteractionRange! ||
                configuration.Eligible?.(player, control) === false)
            {
                Finish(session, "error");
                return;
            }

            if (context.Disposed || session.Closing)
            {
                return;
            }

            if (typeof player.getProperty(EntityProperty.CameraActive) !== "boolean")
            {
                throw new Error("BedformCommon player presentation assets are missing or overridden");
            }

            session.Journal = PrepareJournal(context.Options.World, player, actor,
                context.Options.System.currentTick);
            if (!player.addTag(session.Journal.Receipt.Tag) || !actor.addTag(session.Journal.Receipt.Tag))
            {
                throw new Error("Diagetic native ownership claim did not commit");
            }

            if (typeof actor.getProperty(EntityProperty.Highlighted) === "boolean")
            {
                actor.setProperty(EntityProperty.Highlighted, false);
            }

            player.triggerEvent(EntityEvent.Lock);
            player.inputPermissions.setPermissionCategory(NativePermission.Camera, true);
            player.inputPermissions.setPermissionCategory(NativePermission.Movement, false);
            player.clearVelocity();
            player.teleport(player.location, { rotation: session.Journal.Receipt.Rotation });
            Begin(control, CaptureFrame(player, control, session.Journal.Receipt.Rotation), player);
            FreezeCamera(player, CameraPreset);
            session.Look = { previousRotation: { ...session.Journal.Receipt.Rotation },
                resetPendingTicks: 0,
                yawOrigin: session.Journal.Receipt.Rotation.y };
            UpdateTarget(session);
            player.onScreenDisplay.setActionBar(ReleasePrompt);
            if (!IsCustom(control))
            {
                configuration.OnGrab?.({ Control: control,
                    Player: player });
            }

            if (!session.Closing && !context.Disposed)
            {
                player.onScreenDisplay.setActionBar(ReleasePrompt);
                context.Active.set(actor.id, control);
            }
        }
        catch (error)
        {
            Finish(session, "error");
            Report(context, error);
        }
    }
    catch (error)
    {
        Report(context, error);
    }
};

/**
 * Observes native entity Use and defers all mutations out of restricted execution.
 * Only duplicate observations in the same tick are coalesced; no held-Use timing heuristic is imposed.
 *
 * @category Running
 * @since 1.0.0
 */
const Observe = (context: Context, player: Player, actor: Entity): boolean =>
{
    if (context.Disposed || !player.isValid)
    {
        return false;
    }

    const active = context.Host.Players.get(player.id);
    if (actor.typeId === ReleaseTarget && active?.Target?.id !== actor.id)
    {
        return false;
    }

    if (!active && (!actor.isValid ||
        player.getTags().some((tag) => tag.startsWith(TagPrefix.Session))))
    {
        return false;
    }

    if (active ? active.Context !== context : context.Host.Types.get(actor.typeId) !== context)
    {
        return false;
    }

    if (context.Pending.has(player.id) ||
        context.LastUse.get(player.id) === context.Options.System.currentTick)
    {
        return true;
    }

    context.LastUse.set(player.id, context.Options.System.currentTick);
    const id = context.Options.System.run(() =>
    {
        context.Runs.delete(id);
        if (context.Pending.get(player.id) !== id || context.Disposed)
        {
            return;
        }

        context.Pending.delete(player.id);
        Acquire(context, player, actor);
    });
    context.Pending.set(player.id, id);
    context.Runs.add(id);
    return true;
};

/**
 * Treats a first Use on a block or an item use during an active session as the release toggle. While the
 * displayed camera is frozen, the player's hidden aim can drift off the control, so the second Use may not
 * reach the entity. Same-tick and queued observations still coalesce.
 *
 * @category Running
 * @since 1.0.0
 */
const Release = (context: Context, player: Player): void =>
{
    const session = context.Host.Players.get(player.id);
    if (session?.Context === context && !session.Closing && session.Control.IsValid)
    {
        Observe(context, player, session.Control.Entity);
    }
};

/**
 * Subscribes a live native signal and immediately records the corresponding cleanup operation.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Listen = <A>(context: Context, signal: Signal<A>, callback: (event: A) => void): void =>
{
    const guarded = (event: A): void =>
    {
        if (context.Disposed)
        {
            return;
        }

        try
        {
            callback(event);
        }
        catch (error)
        {
            Report(context, error);
        }
    };

    signal.subscribe(guarded);
    context.Cleanup.push(() => signal.unsubscribe(guarded));
};

/**
 * Cancels one player's session and queued input across every lifecycle boundary.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const CancelPlayer = (context: Context, playerId: string, reason: CancellationReason): void =>
{
    Invalidate(context, playerId);
    const session = context.Host.Players.get(playerId);
    if (session?.Context === context)
    {
        Finish(session, reason);
    }
};

/**
 * Attaches loaded controls at startup/load and retires orphaned actor ownership markers.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Loaded = (context: Context, entity: Entity): void =>
{
    const definition = context.Options.Controls.find((control: AnyDefinition) =>
        control.EntityType === entity.typeId);
    if (definition && entity.isValid)
    {
        Prune(context, entity);
        definition.Attach(entity);
    }
};

/**
 * Marks controls on an observed broken/replaced block, even if an identical type is placed immediately.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const ChangedSupport = (context: Context, dimension: string, position: Vector3): void =>
{
    for (const [ id, control ] of context.Controls)
    {
        const binding = control.Binding;
        if (binding && (binding.Dimension === dimension || "minecraft:" + binding.Dimension === dimension) &&
            binding.Position.x === position.x && binding.Position.y === position.y &&
            binding.Position.z === position.z)
        {
            MarkRetiring(context, id, control);
        }
    }
};

/**
 * Persists an irreversible support-retirement marker before callbacks or native removal can fail.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const MarkRetiring = (context: Context, id: string, control: AnyHandle): void =>
{
    context.Retiring.add(id);
    try
    {
        if (control.Entity.getDynamicProperty(DynamicProperty.Retired) !== true)
        {
            control.Entity.setDynamicProperty(DynamicProperty.Retired, true);
        }

        if (control.Entity.getDynamicProperty(DynamicProperty.Retired) !== true)
        {
            throw new Error("Diagetic retirement marker did not commit");
        }
    }
    catch (error)
    {
        if (!context.RetirementErrors.has(id))
        {
            context.RetirementErrors.add(id);
            Report(context, error);
        }
    }
};

/**
 * Cancels holders before removing unsupported controls; unavailable chunks remain untouched.
 * Failed native removals stay quarantined and retry without spawning replacements or flooding errors.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const CheckSupports = (context: Context): void =>
{
    for (const [ id, control ] of context.Controls)
    {
        if (context.Disposed)
        {
            return;
        }

        if (!control.IsValid)
        {
            context.Controls.delete(id);
            context.Active.delete(id);
            context.Retiring.delete(id);
            context.RetirementErrors.delete(id);
            continue;
        }

        if (!context.Retiring.has(id) && Support(context.Options.World, control) !== "missing")
        {
            continue;
        }

        MarkRetiring(context, id, control);
        const session = context.Host.Actors.get(id);
        if (session?.Context === context)
        {
            Finish(session, "entityLost");
        }

        if (context.Disposed)
        {
            return;
        }

        try
        {
            control.Remove();
            context.Controls.delete(id);
            context.Active.delete(id);
            context.Retiring.delete(id);
            context.RetirementErrors.delete(id);
        }
        catch (error)
        {
            if (!context.RetirementErrors.has(id))
            {
                context.RetirementErrors.add(id);
                Report(context, error);
            }
        }
    }
};

/**
 * Publishes a light gold gaze highlight for idle controls that declare the shared highlight property.
 * Native raycasts stop at blocks and the nearest entity; held controls and players do not participate.
 *
 * @category Running
 * @since 1.0.0
 */
const Highlight = (context: Context, clearing = false): void =>
{
    const highlighted = new Set<string>();
    const range = Math.max(0, ...context.Options.Controls.map((definition) =>
        (definition.Configuration as Lifecycle).InteractionRange ?? 3));
    for (const player of context.Options.World.getAllPlayers())
    {
        if (clearing || !player.isValid || context.Host.Players.has(player.id))
        {
            continue;
        }

        try
        {
            const hit = player.getEntitiesFromViewDirection({ maxDistance: range,
                ignoreBlockCollision: false }).sort((left, right) => left.distance - right.distance)[0];
            const control = hit && context.Controls.get(hit.entity.id);
            if (control && hit.distance <= (Policy(control).InteractionRange ?? 3))
            {
                highlighted.add(hit.entity.id);
            }
        }
        catch (error)
        {
            Report(context, error);
        }
    }

    for (const [ id, control ] of context.Controls)
    {
        try
        {
            if (!control.IsValid ||
                typeof control.Entity.getProperty(EntityProperty.Highlighted) !== "boolean")
            {
                continue;
            }

            const value = !clearing && highlighted.has(id) && !context.Host.Actors.has(id) &&
                !context.Retiring.has(id) && !control.Entity.getTags().some((tag) =>
                tag.startsWith(TagPrefix.Session));
            if (control.Entity.getProperty(EntityProperty.Highlighted) !== value)
            {
                control.Entity.setProperty(EntityProperty.Highlighted, value);
            }
        }
        catch (error)
        {
            Report(context, error);
        }
    }
};

/**
 * Advances each active control once per native tick and keeps the exact prompt after value callbacks.
 *
 * @category Running
 * @since 1.0.0
 */
const Tick = (context: Context): void =>
{
    if (context.Disposed)
    {
        return;
    }

    CheckSupports(context);
    if (context.Disposed)
    {
        return;
    }

    for (const player of context.Options.World.getAllPlayers())
    {
        if (!context.Host.Players.has(player.id))
        {
            Recover(context, player);
        }
    }

    Highlight(context);
    for (const session of [ ...context.Sessions ])
    {
        if (session.Closing || context.Disposed)
        {
            continue;
        }

        const { Player: player, Control: control } = session;
        try
        {
            if (!player.isValid)
            {
                Finish(session, "disconnect");
                continue;
            }

            if (!control.IsValid || control.Entity.dimension.id !== session.Journal!.Receipt.Dimension)
            {
                Finish(session, "entityLost");
                continue;
            }

            if (player.dimension.id !== session.Journal!.Receipt.Dimension)
            {
                Finish(session, "dimensionChange");
                continue;
            }

            const currentFrame = CaptureFrame(player, control, session.Journal!.Receipt.Rotation);
            if (Math.hypot(currentFrame.Mount.Position.x - currentFrame.Camera.Position.x,
                currentFrame.Mount.Position.y - currentFrame.Camera.Position.y,
                currentFrame.Mount.Position.z - currentFrame.Camera.Position.z) >
                Policy(control).InteractionRange!)
            {
                Finish(session, "outOfRange");
                continue;
            }

            if (!player.hasTag(session.Journal!.Receipt.Tag) ||
                !control.Entity.hasTag(session.Journal!.Receipt.Tag))
            {
                throw new Error("Diagetic session lost its ownership receipt");
            }

            const sample = MeasureLook(session.Look!, player.getRotation());
            Look(control, { Delta: sample.delta,
                Estimated: sample.estimated }, player);
            if (sample.resetRotation)
            {
                player.teleport(player.location, { rotation: sample.resetRotation });
            }

            UpdateTarget(session);
            context.Active.set(control.Entity.id, control);
        }
        catch (error)
        {
            Finish(session, "error");
            Report(context, error);
        }
    }

    for (const [ id, control ] of [ ...context.Active ])
    {
        if (context.Disposed)
        {
            break;
        }

        try
        {
            if (!control.IsValid)
            {
                context.Active.delete(id);
                context.Controls.delete(id);
                continue;
            }

            const state = control.Motion.Step();
            if (state.Settled)
            {
                context.Active.delete(id);
            }
        }
        catch (error)
        {
            context.Active.delete(id);
            const session = context.Host.Actors.get(id);
            if (session?.Context === context)
            {
                Finish(session, "error");
            }

            Report(context, error);
        }
    }

    for (const session of [ ...context.Sessions ])
    {
        if (!session.Closing && !context.Disposed)
        {
            try
            {
                session.Player.onScreenDisplay.setActionBar(ReleasePrompt);
            }
            catch (error)
            {
                Finish(session, "error");
                Report(context, error);
            }
        }
    }
};

/**
 * Creates and owns subscriptions, tick scheduling and recovery for one explicit registration lifetime.
 *
 * @throws { Error } If native startup fails; all acquired resources are still retired.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const StartRuntime = (options: StartOptions): Runtime =>
{
    options = { ...options,
        Controls: Object.freeze([ ...options.Controls ]) };
    const hostKey = options.World.beforeEvents.playerInteractWithEntity;
    const host = Hosts.get(hostKey) ?? { Players: new Map(),
        Actors: new Map(),
        Types: new Map(),
        System: options.System };
    if (host.System !== options.System || options.Controls.some((control: AnyDefinition) =>
        host.Types.has(control.EntityType)))
    {
        throw new Error("Diagetic runtimes must share System and register distinct entity types");
    }

    const context: Context = { Options: { ...options,
        Controls: Object.freeze([ ...options.Controls ]) },
    Host: host,
    Controls: new Map(),
    Active: new Map(),
    Sessions: new Set(),
    Pending: new Map(),
    Runs: new Set(),
    LastUse: new Map(),
    Dead: new Set(),
    RecoveryErrors: new Set(),
    Retiring: new Set(),
    RetirementErrors: new Set(),
    Cleanup: [],
    Disposed: false };
    Hosts.set(hostKey, host);
    const dispose = (): void =>
    {
        if (context.Disposed)
        {
            return;
        }

        context.Disposed = true;
        Highlight(context, true);
        for (const session of [ ...context.Sessions ])
        {
            Finish(session, "disposed");
        }

        const errors: Array<unknown> = [];
        for (const cleanup of context.Cleanup.reverse())
        {
            try
            {
                cleanup();
            }
            catch (error)
            {
                errors.push(error);
            }
        }

        for (const run of context.Runs)
        {
            try
            {
                options.System.clearRun(run);
            }
            catch (error)
            {
                errors.push(error);
            }
        }

        for (const definition of options.Controls)
        {
            if (host.Types.get(definition.EntityType) === context)
            {
                host.Types.delete(definition.EntityType);
            }
        }

        context.Runs.clear();
        context.Pending.clear();
        context.Active.clear();
        context.Controls.clear();
        context.LastUse.clear();
        context.Dead.clear();
        context.RecoveryErrors.clear();
        context.Retiring.clear();
        context.RetirementErrors.clear();
        context.Cleanup.length = 0;
        if (host.Types.size === 0 && Hosts.get(hostKey) === host)
        {
            Hosts.delete(hostKey);
        }

        if (errors.length)
        {
            throw new AggregateError(errors, "Diagetic runtime disposal incomplete");
        }
    };

    try
    {
        for (const definition of options.Controls)
        {
            host.Types.set(definition.EntityType, context);
            const registry = Registries.get(definition)!;
            const wake = (handle: AnyHandle): void =>
            {
                if (!context.Disposed)
                {
                    context.Controls.set(handle.Entity.id, handle);
                    context.Active.set(handle.Entity.id, handle);
                }
            };

            const lookup = (id: string): AnyHandle | undefined => context.Disposed
                ? undefined : context.Controls.get(id);
            registry.Watchers.add(wake);
            registry.Lookups.add(lookup);
            context.Cleanup.push(() =>
            {
                registry.Watchers.delete(wake);
                registry.Lookups.delete(lookup);
            });
        }

        const { beforeEvents: before, afterEvents: after } = options.World;
        Listen(context, before.playerInteractWithEntity, (event) =>
        {
            if (Observe(context, event.player, event.target))
            {
                event.cancel = true;
            }
        });
        Listen(context, before.playerInteractWithBlock, (event) =>
        {
            if (host.Players.get(event.player.id)?.Context === context ||
                context.Pending.has(event.player.id))
            {
                event.cancel = true;
                if (event.isFirstEvent)
                {
                    Release(context, event.player);
                }
            }
        });
        Listen(context, before.itemUse, (event) =>
        {
            if (host.Players.get(event.source.id)?.Context === context ||
                context.Pending.has(event.source.id))
            {
                event.cancel = true;
                Release(context, event.source);
            }
        });
        Listen(context, after.playerSpawn, (event) =>
        {
            CancelPlayer(context, event.player.id, "respawn");
            context.Dead.delete(event.player.id);
            context.LastUse.delete(event.player.id);
            Recover(context, event.player);
        });
        Listen(context, after.playerLeave, (event) =>
        {
            CancelPlayer(context, event.playerId, "disconnect");
            context.Dead.delete(event.playerId);
            context.LastUse.delete(event.playerId);
        });
        Listen(context, after.playerDimensionChange, (event) =>
            CancelPlayer(context, event.player.id, "dimensionChange"));
        Listen(context, after.entityDie, (event) =>
        {
            if (event.deadEntity.typeId === "minecraft:player")
            {
                context.Dead.add(event.deadEntity.id);
                CancelPlayer(context, event.deadEntity.id, "death");
            }

            const session = host.Actors.get(event.deadEntity.id);
            if (session?.Context === context)
            {
                Finish(session, "entityLost");
            }
        });
        Listen(context, after.entityRemove, (event) =>
        {
            if (event.typeId === "minecraft:player")
            {
                CancelPlayer(context, event.removedEntityId, "disconnect");
            }

            const session = host.Actors.get(event.removedEntityId);
            if (session?.Context === context)
            {
                Finish(session, "entityLost");
            }

            context.Active.delete(event.removedEntityId);
            context.Controls.delete(event.removedEntityId);
        });
        Listen(context, after.entityLoad, (event) => Loaded(context, event.entity));
        Listen(context, after.entitySpawn, (event) => Loaded(context, event.entity));
        Listen(context, after.playerBreakBlock, (event) =>
            ChangedSupport(context, event.dimension.id, event.block.location));
        Listen(context, after.playerPlaceBlock, (event) =>
            ChangedSupport(context, event.dimension.id, event.block.location));
        Listen(context, after.blockExplode, (event) =>
            ChangedSupport(context, event.dimension.id, event.block.location));
        const bootstrap = options.System.run(() =>
        {
            context.Runs.delete(bootstrap);
            if (context.Disposed)
            {
                return;
            }

            try
            {
                for (const player of options.World.getAllPlayers())
                {
                    Recover(context, player);
                }

                for (const dimension of [ "overworld", "nether", "the_end" ])
                {
                    for (const definition of options.Controls)
                    {
                        const entities = options.World.getDimension(dimension)
                            .getEntities({ type: definition.EntityType });
                        for (const entity of entities)
                        {
                            try
                            {
                                Loaded(context, entity);
                            }
                            catch (error)
                            {
                                Report(context, error);
                            }
                        }
                    }
                }
            }
            catch (error)
            {
                Report(context, error);
            }
        });
        context.Runs.add(bootstrap);
        const timer = options.System.runInterval(() =>
        {
            try
            {
                Tick(context);
            }
            catch (error)
            {
                Report(context, error);
            }
        }, 1);
        context.Cleanup.push(() => options.System.clearRun(timer));
    }
    catch (error)
    {
        try
        {
            dispose();
        }
        catch (cleanupError)
        {
            throw new AggregateError([ error, cleanupError ], "Diagetic startup rollback failed");
        }

        throw error;
    }

    return Object.freeze({ Controls: context.Options.Controls,
        get Disposed(): boolean
        {
            return context.Disposed;
        },
        Dispose: dispose,
        Interact: (player: Player, entity: Entity): boolean => Observe(context, player, entity),
        IsInteracting: (player: Pick<Player, "id">): boolean =>
            host.Players.get(player.id)?.Context === context });
};
