/**
 * Session-only Canvas Intent arbitration: one current request per entity across every connection,
 * sequence-fenced expiry and disposal, and native lifecycle cleanup.
 *
 * @module bedform-canvas/Script/IntentRuntime
 *
 * @file      IntentRuntime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Acknowledgement, Command } from "bedform/Canvas/IntentProtocol";
import type { Configuration, Handle, State, Subject } from "./IntentTypes.js";
import { Correlation, Decode, type Header, Read } from "./IntentProtocol.js";
import type { Entity, EntityDieAfterEvent, EntityHealthComponent, PlayerLeaveAfterEvent,
    ScriptEventCommandMessageAfterEvent, System } from "@minecraft/server";
import { ScriptEvent, Version } from "bedform/Canvas/IntentProtocol";

const Started = new WeakSet<System>();
const MaxReason = 256;

/**
 * One session connection. Disposed records stay as fences so delayed hello or mutation traffic for
 * that ConnectionId is rejected instead of reviving ownership.
 *
 * @category Model
 * @since 1.0.0
 */
interface Connection
{
    readonly ClientId: string;
    readonly HelloRequestId: number | null;
    LastRequestId: number;
    Disposed: boolean;
}

/**
 * Mutable bookkeeping behind one immutable accepted State; Timer is the fenced expiry callback.
 *
 * @category Model
 * @since 1.0.0
 */
interface Entry
{
    readonly State: Omit<State, "ElapsedTicks" | "Subject">;
    Timer?: number;
    Faulted: boolean;
}

/**
 * A rejection that is acknowledged to the requesting connection with an actionable reason.
 *
 * @category Error
 * @since 1.0.0
 */
class Rejection extends Error {}

/**
 * Bounds an acknowledgement reason to the public wire limit.
 *
 * @category Serialization
 * @since 1.0.0
 */
function Reason(error: unknown): string
{
    const message = error instanceof Error ? error.message : String(error);
    return message.length > MaxReason ? message.slice(0, MaxReason - 1) + "…" : message;
}

/**
 * Whether a still-valid native entity has died. Dying mobs stay valid during their death animation
 * and dead players stay valid until they respawn, after entityDie has already cleared their intent.
 * Entities without a readable health component are treated as alive.
 *
 * @category Lifecycle
 * @since 1.0.0
 */
function Dead(entity: Entity): boolean
{
    try
    {
        const health = entity.getComponent?.("minecraft:health") as EntityHealthComponent | undefined;
        return health !== undefined && health.currentValue <= 0;
    }
    catch
    {
        return false;
    }
}

/**
 * Creates a fresh boot token. It identifies this runtime session only and is never persisted.
 *
 * @category Constructor
 * @since 1.0.0
 */
function RuntimeToken(): string
{
    return `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-` +
        Math.random().toString(36).slice(2);
}

/**
 * Explicitly owned arbitration service behind the public Handle.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
class Runtime implements Handle
{
    private readonly Configuration: Configuration;
    private readonly RuntimeId: string = RuntimeToken();
    private readonly Connections: Map<string, Connection> = new Map();
    private readonly Owners: Map<string, string> = new Map();
    private readonly Entries: Map<string, Entry> = new Map();
    private readonly Releases: Array<() => void> = [];
    private Generation: number = 0;
    private Closed: boolean = false;

    constructor(configuration: Configuration)
    {
        this.Configuration = { OnError: configuration.OnError,
            System: configuration.System,
            World: configuration.World };
        const { System: system, World: world } = configuration;
        try
        {
            const receive = (event: ScriptEventCommandMessageAfterEvent): void => this.Receive(event);
            system.afterEvents.scriptEventReceive.subscribe(receive);
            this.Releases.push(() => system.afterEvents.scriptEventReceive.unsubscribe(receive));
            const die = (event: EntityDieAfterEvent): void => this.Lifecycle(() => event.deadEntity.id);
            world.afterEvents.entityDie.subscribe(die);
            this.Releases.push(() => world.afterEvents.entityDie.unsubscribe(die));
            const leave = (event: PlayerLeaveAfterEvent): void => this.Lifecycle(() => event.playerId);
            world.afterEvents.playerLeave.subscribe(leave);
            this.Releases.push(() => world.afterEvents.playerLeave.unsubscribe(leave));
        }
        catch (error)
        {
            this.Release();
            throw error;
        }
    }

    readonly Snapshot = (): ReadonlyArray<State> =>
    {
        if (this.Closed)
        {
            return Object.freeze([]);
        }

        const now = this.Configuration.System.currentTick;
        const states: Array<State> = [];
        for (const [ id, entry ] of [ ...this.Entries ])
        {
            if (entry.State.ExpiresAt !== null && now >= entry.State.ExpiresAt)
            {
                this.Remove(id);
                continue;
            }

            const subject = this.Resolve(entry);
            states.push(Object.freeze({ ...entry.State,
                ElapsedTicks: Math.max(0, now - entry.State.StartedTick),
                ...subject === undefined ? {} : { Subject: subject } }));
        }

        return Object.freeze(states);
    };

    readonly Retire = (entityId: string): void =>
    {
        if (!this.Closed)
        {
            this.Remove(entityId);
        }
    };

    readonly Dispose = (): void =>
    {
        if (this.Closed)
        {
            return;
        }

        this.Closed = true;
        for (const id of [ ...this.Entries.keys() ])
        {
            this.Remove(id);
        }

        this.Connections.clear();
        this.Owners.clear();
        this.Release();
        Started.delete(this.Configuration.System);
    };

    /**
     * Reads a subject's current dimension and head without retaining failures beyond this entry.
     * Absence means unloaded or not yet reloaded; the record and its elapsed time are retained.
     */
    private Resolve(entry: Entry): Subject | undefined
    {
        try
        {
            const entity = this.Configuration.World.getEntity(entry.State.EntityId);
            if (!entity?.isValid)
            {
                return undefined;
            }

            const subject = Object.freeze({ Dimension: entity.dimension,
                Entity: entity,
                Head: Object.freeze({ ...entity.getHeadLocation() }) });
            entry.Faulted = false;
            return subject;
        }
        catch (error)
        {
            if (!entry.Faulted)
            {
                entry.Faulted = true;
                this.Report(new Error(`Canvas Intent could not read subject ${entry.State.EntityId}; ` +
                    "its bubble is suspended until reads succeed.", { cause: error }));
            }

            return undefined;
        }
    }

    private Lifecycle(read: () => string): void
    {
        if (this.Closed)
        {
            return;
        }

        try
        {
            this.Remove(read());
        }
        catch (error)
        {
            this.Report(new Error("Canvas Intent could not process an entity lifecycle event.",
                { cause: error }));
        }
    }

    private Remove(entityId: string): void
    {
        const entry = this.Entries.get(entityId);
        if (!entry)
        {
            return;
        }

        this.Entries.delete(entityId);
        this.Cancel(entry);
    }

    private Cancel(entry: Entry): void
    {
        if (entry.Timer === undefined)
        {
            return;
        }

        const handle = entry.Timer;
        entry.Timer = undefined;
        try
        {
            this.Configuration.System.clearRun(handle);
        }
        catch (error)
        {
            // The expiry callback is generation-fenced, so a surviving timer cannot remove newer work.
            this.Report(new Error("Canvas Intent could not cancel an expiry timer.", { cause: error }));
        }
    }

    private Receive(event: ScriptEventCommandMessageAfterEvent): void
    {
        if (this.Closed || event.id !== ScriptEvent.Command || event.sourceType !== "Server")
        {
            return;
        }

        let input: Record<string, unknown>;
        let header: Header;
        try
        {
            input = Read(event.message);
            header = Correlation(input);
        }
        catch
        {
            // Uncorrelated traffic cannot be acknowledged and must not affect any connection.
            return;
        }

        try
        {
            this.Acknowledge(header, this.Handle(header, input), undefined);
        }
        catch (error)
        {
            if (!(error instanceof Rejection) && !(error instanceof TypeError))
            {
                this.Report(new Error(`Canvas Intent failed while handling ${header.Operation} from ` +
                    `${header.ClientId}.`, { cause: error }));
            }

            this.Acknowledge(header, "rejected", Reason(error));
        }
    }

    private Handle(header: Header, input: Record<string, unknown>): Acknowledgement["Status"]
    {
        if (header.Version !== Version)
        {
            throw new Rejection(`Canvas Intent protocol version ${header.Version} is unsupported; this ` +
                `runtime speaks version ${Version}. Update Bedform and BedformCanvas together.`);
        }

        const connection = this.Connections.get(header.ConnectionId);
        if (connection && connection.ClientId !== header.ClientId)
        {
            throw new Rejection("Canvas Intent ConnectionId belongs to another client.");
        }

        const command = Decode(header, input);
        if (command.Operation === "dispose")
        {
            return this.Disposal(command, connection);
        }

        if (connection?.Disposed)
        {
            throw new Rejection("Canvas Intent connection was disposed; create a new connection with Start.");
        }

        if (command.Operation === "hello")
        {
            return this.Hello(command, connection);
        }

        this.CheckRuntime(command.RuntimeId);
        if (!connection)
        {
            throw new Rejection("Canvas Intent connection is unknown; wait for a ready hello before " +
                "sending mutations.");
        }

        if (command.RequestId <= connection.LastRequestId)
        {
            throw new Rejection(`Canvas Intent request ${command.RequestId} is stale or duplicated.`);
        }

        connection.LastRequestId = command.RequestId;
        if (command.Operation === "clear")
        {
            this.Remove(command.EntityId);
            return "accepted";
        }

        this.Accept(command);
        return "accepted";
    }

    private Hello(command: Command & { Operation: "hello" }, connection: Connection | undefined)
        : Acknowledgement["Status"]
    {
        if (connection)
        {
            if (connection.HelloRequestId !== command.RequestId)
            {
                throw new Rejection("Canvas Intent connection already completed a different hello.");
            }

            return "ready";
        }

        const owner = this.Owners.get(command.ClientId);
        if (owner !== undefined && owner !== command.ConnectionId)
        {
            throw new Rejection(`Canvas Intent Id ${command.ClientId} already has an active connection; ` +
                "dispose it before starting another.");
        }

        this.Connections.set(command.ConnectionId, { ClientId: command.ClientId,
            Disposed: false,
            HelloRequestId: command.RequestId,
            LastRequestId: command.RequestId });
        this.Owners.set(command.ClientId, command.ConnectionId);
        return "ready";
    }

    /**
     * Fences the connection before acknowledging, then removes only entries it still owns. A
     * disposal that races its own hello leaves a disposed record that rejects the delayed hello.
     */
    private Disposal(command: Command & { Operation: "dispose" }, connection: Connection | undefined)
        : Acknowledgement["Status"]
    {
        if (command.RuntimeId !== undefined)
        {
            this.CheckRuntime(command.RuntimeId);
        }

        if (!connection)
        {
            this.Connections.set(command.ConnectionId, { ClientId: command.ClientId,
                Disposed: true,
                HelloRequestId: null,
                LastRequestId: command.RequestId });
            return "accepted";
        }

        connection.Disposed = true;
        connection.LastRequestId = Math.max(connection.LastRequestId, command.RequestId);
        if (this.Owners.get(command.ClientId) === command.ConnectionId)
        {
            this.Owners.delete(command.ClientId);
        }

        for (const [ id, entry ] of [ ...this.Entries ])
        {
            if (entry.State.ConnectionId === command.ConnectionId)
            {
                this.Remove(id);
            }
        }

        return "accepted";
    }

    private CheckRuntime(runtime: string): void
    {
        if (runtime !== this.RuntimeId)
        {
            throw new Rejection("Canvas Intent runtime restarted; dispose and create a new connection.");
        }
    }

    /**
     * Replaces the subject's current entry and restarts its animation clock. The expiry callback
     * only removes the generation that scheduled it.
     *
     * @throws { Rejection } If the subject cannot be resolved in this world or has died.
     */
    private Accept(command: Command & { Operation: "set" }): void
    {
        const entity = this.Configuration.World.getEntity(command.EntityId);
        if (!entity?.isValid)
        {
            throw new Rejection(`Canvas Intent subject ${command.EntityId} is unavailable in this world.`);
        }

        if (Dead(entity))
        {
            throw new Rejection(`Canvas Intent subject ${command.EntityId} has died; set a new intent ` +
                "after it respawns or for another entity.");
        }

        const { System: system } = this.Configuration;
        const now = system.currentTick;
        const duration = command.Options.DurationTicks;
        const generation = ++this.Generation;
        const entry: Entry = { Faulted: false,
            State: Object.freeze({ ClientId: command.ClientId,
                ConnectionId: command.ConnectionId,
                EntityId: command.EntityId,
                ExpiresAt: duration === null ? null : now + duration,
                Generation: generation,
                Intent: command.Intent,
                Options: command.Options,
                RequestId: command.RequestId,
                StartedTick: now }) };
        const previous = this.Entries.get(command.EntityId);
        if (previous)
        {
            this.Cancel(previous);
        }

        this.Entries.set(command.EntityId, entry);
        if (duration !== null)
        {
            entry.Timer = system.runTimeout((): void =>
            {
                if (this.Entries.get(command.EntityId)?.State.Generation === generation)
                {
                    entry.Timer = undefined;
                    this.Remove(command.EntityId);
                }
            }, duration);
        }
    }

    private Acknowledge(header: Header, status: Acknowledgement["Status"], message: string | undefined): void
    {
        const acknowledgement: Acknowledgement = { ClientId: header.ClientId,
            ConnectionId: header.ConnectionId,
            Operation: header.Operation,
            RequestId: header.RequestId,
            RuntimeId: this.RuntimeId,
            Status: status,
            Version,
            ...message === undefined ? {} : { Message: message } };
        try
        {
            this.Configuration.System.sendScriptEvent(ScriptEvent.Acknowledgement,
                JSON.stringify(acknowledgement));
        }
        catch (error)
        {
            this.Report(new Error(`Canvas Intent could not acknowledge ${header.Operation} from ` +
                `${header.ClientId}.`, { cause: error }));
        }
    }

    private Release(): void
    {
        for (const release of this.Releases.splice(0).reverse())
        {
            try
            {
                release();
            }
            catch (error)
            {
                this.Report(new Error("Canvas Intent could not unsubscribe a native event.",
                    { cause: error }));
            }
        }
    }

    private Report(error: Error): void
    {
        try
        {
            this.Configuration.OnError?.(error);
        }
        catch
        {
            // Diagnostics cannot interrupt arbitration or cleanup.
        }
    }
}

/**
 * Starts the single Canvas Intent service for a System. State is session-only: nothing is written
 * to the world, and a restart begins empty with a new RuntimeId that rejects old connections.
 *
 * @throws { TypeError } If native adapters are missing.
 * @throws { Error } If a service is already active for this System, or native subscription fails.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export function Start(configuration: Configuration): Handle
{
    const { OnError: onError, System: system, World: world } = configuration ?? {};
    if (!system || !world || typeof world.getEntity !== "function" ||
        typeof world.afterEvents?.entityDie?.subscribe !== "function" ||
        typeof world.afterEvents.playerLeave?.subscribe !== "function" ||
        typeof system.afterEvents?.scriptEventReceive?.subscribe !== "function" ||
        typeof system.sendScriptEvent !== "function" || typeof system.runTimeout !== "function" ||
        typeof system.clearRun !== "function" || (onError !== undefined && typeof onError !== "function"))
    {
        throw new TypeError("Canvas Intent runtime requires native World/System adapters and optional " +
            "OnError.");
    }

    if (Started.has(system))
    {
        throw new Error("Canvas Intent runtime is already active for this System.");
    }

    const runtime = new Runtime(configuration);
    Started.add(system);
    return runtime;
}
