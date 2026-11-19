/**
 * Deterministic native-shaped script-event relay and scheduler for Intent client qualification.
 *
 * @module bedform/Test/IntentHarness
 *
 * @file      IntentHarness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native fixtures retain contextual callback inference and protocol field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Intent from "bedform/Spatial/Intent";
import type { Acknowledgement, Command } from "bedform/Canvas/IntentProtocol";
import type { Entity, ScriptEventCommandMessageAfterEvent, System, World } from "@minecraft/server";
import { ScriptEvent, Version } from "bedform/Canvas/IntentProtocol";

/**
 * Queued native tick callback; callbacks can also be retained and fired after cancellation.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Scheduled
{
    readonly At: number;
    readonly Callback: () => void;
}

/**
 * Creates a relay with controllable readiness, acknowledgements and independent connections.
 * This models the transport peer and does not qualify the future Canvas arbitration implementation.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Harness()
{
    let tick = 0;
    let serial = 0;
    const scheduled = new Map<number, Scheduled>();
    const listeners = new Set<(event: ScriptEventCommandMessageAfterEvent) => void>();
    const commands: Array<Command> = [];
    const errors: Array<Error> = [];
    const actors = new Map<string, Entity>();
    const control = { Auto: true,
        Enabled: true,
        ReadyAt: 0,
        RuntimeId: "runtime-one",
        Version,
        FailSend: false,
        FailSchedule: false,
        FailSubscribe: false };
    const emit = (payload: unknown, source = "Server", id: string = ScriptEvent.Acknowledgement): void =>
    {
        const event = { id,
            message: typeof payload === "string" ? payload : JSON.stringify(payload),
            sourceType: source } as ScriptEventCommandMessageAfterEvent;
        for (const callback of [ ...listeners ])
        {
            callback(event);
        }
    };

    const acknowledge = (command: Command, overrides: Partial<Acknowledgement> = {}): void =>
    {
        emit({ Version: control.Version,
            ClientId: command.ClientId,
            ConnectionId: command.ConnectionId,
            RequestId: command.RequestId,
            Operation: command.Operation,
            RuntimeId: control.RuntimeId,
            Status: command.Operation === "hello" ? "ready" : "accepted",
            ...overrides });
    };

    const system = {
        afterEvents: { scriptEventReceive: {
            subscribe(callback: (event: ScriptEventCommandMessageAfterEvent) => void)
            {
                if (control.FailSubscribe)
                {
                    throw new Error("native subscribe failed");
                }

                listeners.add(callback);
                return callback;
            },
            unsubscribe(callback: (event: ScriptEventCommandMessageAfterEvent) => void): void
            {
                listeners.delete(callback);
            }
        } },
        runTimeout(callback: () => void, delay: number = 1): number
        {
            if (control.FailSchedule)
            {
                throw new Error("native schedule failed");
            }

            scheduled.set(++serial, { At: tick + Math.max(1, delay),
                Callback: callback });
            return serial;
        },
        clearRun(handle: number): void
        {
            scheduled.delete(handle);
        },
        sendScriptEvent(id: string, message: string): void
        {
            if (control.FailSend)
            {
                throw new Error("native send failed");
            }

            if (id !== ScriptEvent.Command)
            {
                throw new Error("wrong event key");
            }

            const command = JSON.parse(message) as Command;
            commands.push(command);
            if (control.Auto && control.Enabled && tick >= control.ReadyAt)
            {
                acknowledge(command);
            }
        }
    } as unknown as System;
    const world = { getEntity: (id: string) => actors.get(id) } as unknown as World;
    const actor = (id: string, typeId: string = "minecraft:player"): Entity =>
    {
        const entity = { id,
            typeId,
            isValid: true } as Entity;
        actors.set(id, entity);
        return entity;
    };

    const flush = async (): Promise<void> =>
    {
        for (let i = 0; i < 8; ++i)
        {
            await Promise.resolve();
        }
    };

    const advance = async (count: number = 1): Promise<void> =>
    {
        await flush();
        for (let i = 0; i < count; ++i)
        {
            ++tick;
            for (const [ handle, entry ] of [ ...scheduled ])
            {
                if (entry.At <= tick && scheduled.delete(handle))
                {
                    entry.Callback();
                }
            }

            await flush();
        }
    };

    const start = (id: string = "test:addon"): Intent.Connection => Intent.Start({
        Id: id,
        System: system,
        World: world,
        OnError: (error: Error) => errors.push(error)
    });
    return { system,
        world,
        start,
        advance,
        flush,
        actor,
        actors,
        commands,
        errors,
        control,
        scheduled,
        listeners,
        emit,
        acknowledge };
}
