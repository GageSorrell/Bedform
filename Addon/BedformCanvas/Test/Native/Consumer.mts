/**
 * Independent native consumer add-on script. Each of the two consumer packs bundles this module with
 * its own Intent Id and executes driver commands through the published bedform/Spatial/Intent client.
 *
 * @module bedform-canvas/Test/Native/Consumer
 *
 * @file      Consumer.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Intent from "bedform/Spatial/Intent";
import type { Entity, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import { system, world } from "@minecraft/server";
import { FixtureEvent } from "./Keys.mjs";

declare const NativeConsumerId: string;
declare const NativeConsumerTarget: string;

/**
 * A driver command for this consumer. Intent names a built-in preset or carries PUA glyph text.
 *
 * @category Testing
 * @since 1.0.0
 */
export interface Command
{
    readonly Target: string;
    readonly Nonce: number;
    readonly Operation: "start" | "set" | "clear" | "dispose";
    readonly EntityId?: string;
    readonly Builtin?: keyof typeof Intent.Builtin;
    readonly Glyphs?: string;
    readonly Options?: Intent.Options;
}

const Entities = new Map<string, Entity>();
const Errors: Array<string> = [];
let Connection: Intent.Connection = Open();
let Generation = 1;

/**
 * Starts this consumer's Intent connection; OnError messages are reported with the next result.
 *
 * @category Testing
 * @since 1.0.0
 */
function Open(): Intent.Connection
{
    return Intent.Start({ Id: NativeConsumerId,
        OnError: (error: Error): void =>
        {
            Errors.push(error.message);
        },
        System: system,
        World: world });
}

/**
 * Resolves the subject, retaining native handles so later requests can name dead or departed entities.
 *
 * @throws { Error } If the entity was never seen by this consumer.
 *
 * @category Testing
 * @since 1.0.0
 */
function Subject(id: string): Entity
{
    const current = world.getEntity(id);
    if (current)
    {
        Entities.set(id, current);
        return current;
    }

    const retained = Entities.get(id);
    if (!retained)
    {
        throw new Error(`Consumer has no handle for entity ${id}.`);
    }

    return retained;
}

/**
 * Executes one command against the current connection.
 *
 * @throws { Error } If the command is malformed.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Execute(command: Command): Promise<void>
{
    switch (command.Operation)
    {
        case "start":
            Connection = Open();
            Generation++;
            return;
        // Await directly, as ordinary consumers do, so handlers attach before the native callback returns.
        case "dispose":
            await Connection.Dispose();
            return;
        case "clear":
            await Connection.Clear(Subject(command.EntityId!));
            return;
        case "set":
        {
            const intent = command.Glyphs !== undefined ? Intent.Glyphs(command.Glyphs)
                : Intent.Builtin[command.Builtin!];
            await Connection.Set(Subject(command.EntityId!), intent, command.Options);
            return;
        }

        default:
            throw new Error("Unknown consumer command.");
    }
}

system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent): void =>
{
    if (event.id !== FixtureEvent.Consumer)
    {
        return;
    }

    const command = JSON.parse(event.message) as Command;
    if (command.Target !== NativeConsumerTarget)
    {
        return;
    }

    const started = system.currentTick;
    const respond = (status: "resolved" | "rejected", message?: string): void =>
    {
        const elapsed = system.currentTick - started;
        system.sendScriptEvent(FixtureEvent.ConsumerResult, JSON.stringify({ ElapsedTicks: elapsed,
            Errors: Errors.splice(0),
            Generation,
            Message: message,
            Nonce: command.Nonce,
            Status: status,
            Target: NativeConsumerTarget }));
    };

    // Execute is async, so synchronous validation failures also arrive as rejections.
    Execute(command).then(() => respond("resolved"), (error: unknown) =>
        respond("rejected", error instanceof Error ? error.message : String(error)));
});
