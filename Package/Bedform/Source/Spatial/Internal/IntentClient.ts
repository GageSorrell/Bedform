/**
 * Explicit Canvas Intent handshake, correlated requests and bounded connection cleanup.
 *
 * @module bedform/Spatial/Internal/IntentClient
 *
 * @file      IntentClient.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CheckDefinition, CheckMessage, CheckOptions, IsIdentifier, RecordValue } from "./IntentValue.js";
import type { Clear as ClearCommand, Command, Dispose as DisposeCommand, Envelope, Hello,
    Set as SetCommand } from "../../Canvas/Public/Intent.js";
import type { Configuration, Connection, Definition, Options } from "../Intent.js";
import type { Entity, ScriptEventCommandMessageAfterEvent, System } from "@minecraft/server";
import { ScriptEvent, Timing, Version } from "../../Canvas/Public/Intent.js";

const Active = new WeakMap<System, Set<string>>();
let Serial = 0;

/**
 * Pending request and owned scheduler handles; mutations are never automatically replayed.
 *
 * @category Model
 * @since 1.0.0
 */
interface Pending
{
    readonly Command: Command;
    readonly Message: string;
    readonly Handles: Set<number>;
    readonly Resolve: (runtime: string) => void;
    readonly Reject: (error: Error) => void;
}

/**
 * Explicitly owned implementation of the public Intent connection.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export class Client implements Connection
{
    private readonly Configuration: Configuration;
    private readonly ConnectionId: string;
    private readonly Pending: Map<number, Pending> = new Map();
    private readonly Listener: (event: ScriptEventCommandMessageAfterEvent) => void;
    private readonly Ready: Promise<string>;
    private RuntimeId?: string;
    private Sequence: number = 0;
    private HasSent: boolean = false;
    private Disposing: boolean = false;
    private Closed: boolean = false;
    private Disposal?: Promise<void>;

    constructor(configuration: Configuration)
    {
        const input = RecordValue(configuration);
        if (!IsIdentifier(input.Id) || !input.World || !input.System ||
            typeof configuration.World.getEntity !== "function" ||
            typeof configuration.System.sendScriptEvent !== "function" ||
            typeof configuration.System.runTimeout !== "function" ||
            typeof configuration.System.clearRun !== "function" ||
            typeof configuration.System.afterEvents?.scriptEventReceive?.subscribe !== "function" ||
            typeof configuration.System.afterEvents.scriptEventReceive.unsubscribe !== "function" ||
            (input.OnError !== undefined && typeof input.OnError !== "function"))
        {
            throw new TypeError("Intent.Start requires a namespaced Id, World/System and optional OnError.");
        }

        this.Configuration = { Id: configuration.Id,
            OnError: configuration.OnError,
            System: configuration.System,
            World: configuration.World };
        const active = Active.get(configuration.System) ?? new Set<string>();
        if (active.has(configuration.Id))
        {
            throw new Error(`Canvas Intent Id ${configuration.Id} already has an active connection.`);
        }

        active.add(configuration.Id);
        Active.set(configuration.System, active);
        this.ConnectionId = `${Date.now().toString(36)}-${++Serial}-` +
            `${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        this.Listener = (event: ScriptEventCommandMessageAfterEvent): void => this.Receive(event);
        try
        {
            configuration.System.afterEvents.scriptEventReceive.subscribe(this.Listener);
        }
        catch (error)
        {
            active.delete(configuration.Id);
            throw error;
        }

        this.Ready = this.Request<Hello>({ Operation: "hello" }).then((runtime: string) =>
        {
            this.RuntimeId = runtime;
            return runtime;
        });
        // Start is synchronous; retain failures for operations without an unhandled rejection.
        void this.Ready.catch(() => {});
    }

    async Set(entity: Entity, intent: Definition, options?: Options): Promise<void>
    {
        this.AssertActive();
        const subject = this.Subject(entity);
        const definition = CheckDefinition(intent);
        const resolved = CheckOptions(options);
        const runtime = await this.Ready;
        this.AssertActive();
        await this.Request<SetCommand>({ EntityId: subject,
            Intent: definition,
            Operation: "set",
            Options: resolved,
            RuntimeId: runtime });
    }

    async Clear(entity: Entity): Promise<void>
    {
        this.AssertActive();
        const subject = this.Subject(entity);
        const runtime = await this.Ready;
        this.AssertActive();
        await this.Request<ClearCommand>({ EntityId: subject,
            Operation: "clear",
            RuntimeId: runtime });
    }

    Dispose(): Promise<void>
    {
        if (this.Disposal)
        {
            return this.Disposal;
        }

        this.Disposing = true;
        for (const pending of [ ...this.Pending.values() ])
        {
            this.Finish(pending, new Error("Canvas Intent connection was disposed."), false);
        }

        this.Disposal = Promise.resolve().then(async (): Promise<void> =>
        {
            try
            {
                if (this.HasSent)
                {
                    await this.Request<DisposeCommand>({ Operation: "dispose",
                        ...this.RuntimeId === undefined ? {} : { RuntimeId: this.RuntimeId } });
                }
            }
            finally
            {
                this.Release();
            }
        });
        return this.Disposal;
    }

    private AssertActive(): void
    {
        if (this.Disposing || this.Closed)
        {
            throw new Error("Canvas Intent connection is disposed; create a new connection with Start.");
        }
    }

    private Subject(entity: Entity): string
    {
        if (!entity || typeof entity.id !== "string" || entity.id.length === 0 || entity.id.length > 128 ||
            entity.isValid !== true || typeof entity.typeId !== "string")
        {
            throw new TypeError("Canvas Intent subject must be a valid native entity.");
        }

        const current = this.Configuration.World.getEntity(entity.id);
        if (!current || !current.isValid || current.typeId !== entity.typeId)
        {
            throw new TypeError("Canvas Intent subject is unavailable in the configured World.");
        }

        return entity.id;
    }

    private Request<Request extends Command>(body: Omit<Request, keyof Envelope>): Promise<string>
    {
        const command = { ...body,
            ClientId: this.Configuration.Id,
            ConnectionId: this.ConnectionId,
            RequestId: ++this.Sequence,
            Version } as Request;
        return new Promise<string>((resolve: (value: string) => void, reject: (reason: Error) => void) =>
        {
            const message = JSON.stringify(command);
            CheckMessage(message);
            const pending: Pending = { Command: command,
                Handles: new Set(),
                Message: message,
                Reject: reject,
                Resolve: resolve };
            this.Pending.set(command.RequestId, pending);
            this.Schedule(pending, (): void =>
            {
                const detail = command.Operation === "hello"
                    ? "did not become ready; install a compatible BedformCanvas pack with the Intent service"
                    : `did not acknowledge ${command.Operation}; acceptance is unknown (no retry)`;
                this.Finish(pending,
                    new Error(`Canvas Intent ${detail} within ${Timing.TimeoutTicks} ticks.`));
            }, Timing.TimeoutTicks);
            this.Schedule(pending, (): void => this.Send(pending), 1);
        });
    }

    private Schedule(pending: Pending, work: () => void, delay: number): void
    {
        if (!this.Pending.has(pending.Command.RequestId))
        {
            return;
        }

        try
        {
            const handle = this.Configuration.System.runTimeout((): void =>
            {
                pending.Handles.delete(handle);
                if (!this.Closed && this.Pending.get(pending.Command.RequestId) === pending)
                {
                    work();
                }
            }, delay);
            pending.Handles.add(handle);
        }
        catch (error)
        {
            this.Finish(pending,
                new Error("Canvas Intent could not schedule native transport.", { cause: error }));
        }
    }

    private Send(pending: Pending): void
    {
        try
        {
            this.HasSent = true;
            this.Configuration.System.sendScriptEvent(ScriptEvent.Command, pending.Message);
            if (pending.Command.Operation === "hello")
            {
                this.Schedule(pending, (): void => this.Send(pending), Timing.RetryTicks);
            }
        }
        catch (error)
        {
            this.Finish(pending,
                new Error("Canvas Intent could not send its native script event.", { cause: error }));
        }
    }

    private Receive(event: ScriptEventCommandMessageAfterEvent): void
    {
        if (this.Closed || event.id !== ScriptEvent.Acknowledgement || event.sourceType !== "Server")
        {
            return;
        }

        let input: Record<string, unknown>;
        try
        {
            CheckMessage(event.message);
            input = RecordValue(JSON.parse(event.message));
        }
        catch
        {
            return;
        }

        if (input.ClientId !== this.Configuration.Id || input.ConnectionId !== this.ConnectionId ||
            typeof input.RequestId !== "number")
        {
            return;
        }

        const pending = this.Pending.get(input.RequestId);
        if (!pending || input.Operation !== pending.Command.Operation)
        {
            return;
        }

        if (input.Version !== Version)
        {
            this.Finish(pending, new Error(`Canvas Intent protocol is incompatible (expected ${Version}). ` +
                "Update Bedform and BedformCanvas together."));
            return;
        }

        if (typeof input.RuntimeId !== "string" || input.RuntimeId.length === 0 ||
            input.RuntimeId.length > 128 ||
            (input.Status !== "ready" && input.Status !== "accepted" && input.Status !== "rejected") ||
            (input.Message !== undefined &&
                (typeof input.Message !== "string" || input.Message.length > 256)))
        {
            this.Finish(pending, new Error("Canvas Intent received a malformed correlated acknowledgement."));
            return;
        }

        if (this.RuntimeId !== undefined && input.RuntimeId !== this.RuntimeId)
        {
            this.Finish(pending,
                new Error("Canvas Intent runtime restarted; dispose and create a new connection."));
            return;
        }

        if (input.Status === "rejected")
        {
            this.Finish(pending, new Error(`Canvas Intent rejected ${pending.Command.Operation}: ` +
                (input.Message ?? "the runtime supplied no reason")));
            return;
        }

        const expected = pending.Command.Operation === "hello" ? "ready" : "accepted";
        if (input.Status !== expected)
        {
            this.Finish(pending, new Error(`Canvas Intent acknowledgement must have status ${expected}.`));
            return;
        }

        this.Finish(pending, input.RuntimeId);
    }

    private Finish(pending: Pending, result: string | Error, report: boolean = true): void
    {
        if (this.Pending.get(pending.Command.RequestId) !== pending)
        {
            return;
        }

        this.Pending.delete(pending.Command.RequestId);
        for (const handle of pending.Handles)
        {
            try
            {
                this.Configuration.System.clearRun(handle);
            }
            catch (error)
            {
                this.Report(new Error("Canvas Intent could not cancel a native timer.", { cause: error }));
            }
        }

        pending.Handles.clear();
        if (result instanceof Error)
        {
            pending.Reject(result);
            if (report)
            {
                this.Report(result);
            }
        }
        else
        {
            pending.Resolve(result);
        }
    }

    private Release(): void
    {
        this.Closed = true;
        Active.get(this.Configuration.System)?.delete(this.Configuration.Id);
        try
        {
            this.Configuration.System.afterEvents.scriptEventReceive.unsubscribe(this.Listener);
        }
        catch (error)
        {
            const failure = new Error("Canvas Intent could not unsubscribe native transport.",
                { cause: error });
            this.Report(failure);
            throw failure;
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
            // Consumer diagnostics cannot interrupt settlement or resource cleanup.
        }
    }
}
