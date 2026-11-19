/**
 * Qualifies Canvas Intent arbitration, sequence fencing and session lifecycle against the real
 * Bedform request client over a deterministic native-shaped script-event bus.
 *
 * @module bedform-canvas/Test/IntentRuntime.test
 *
 * @file      IntentRuntime.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native fixtures retain contextual callback inference and protocol field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Intent from "../../../Package/Bedform/Source/Spatial/Intent.ts";
import type { Acknowledgement, Command } from "bedform/Canvas/IntentProtocol";
import type { Entity, ScriptEventCommandMessageAfterEvent, System, World } from "@minecraft/server";
import { ScriptEvent, Version } from "bedform/Canvas/IntentProtocol";
import type { Handle } from "../Script/IntentTypes.ts";
import { Start } from "../Script/IntentRuntime.ts";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mutable fake entity; replacing the map entry models a chunk reload with a new native wrapper.
 *
 * @category Testing
 * @since 1.0.0
 */
interface Actor
{
    id: string;
    typeId: string;
    isValid: boolean;
    Health?: number;
    dimension: { id: string };
    location: { x: number;
        y: number;
        z: number };
    Fail?: boolean;
}

/**
 * Builds a deterministic world/system pair. Script events are delivered on the next tick, before
 * due timers, and the bus is shared by every pack realm in the fixture.
 *
 * @category Testing
 * @since 1.0.0
 */
function Host()
{
    let tick = 0;
    let serial = 0;
    const timers = new Map<number, { At: number;
        Callback: () => void }>();
    const queue: Array<ScriptEventCommandMessageAfterEvent> = [];
    const script = new Set<(event: ScriptEventCommandMessageAfterEvent) => void>();
    const die = new Set<(event: { deadEntity: Entity }) => void>();
    const leave = new Set<(event: { playerId: string }) => void>();
    const entities = new Map<string, Actor>();
    const acknowledgements: Array<Acknowledgement> = [];
    const errors: Array<Error> = [];
    const signal = <Listener extends object>(listeners: Set<Listener>) => ({
        subscribe: (callback: Listener) =>
        {
            listeners.add(callback);
            return callback;
        },
        unsubscribe: (callback: Listener) => void listeners.delete(callback)
    });
    const system = {
        get currentTick()
        {
            return tick;
        },
        afterEvents: { scriptEventReceive: signal(script) },
        runTimeout(callback: () => void, delay = 1): number
        {
            timers.set(++serial, { At: tick + Math.max(1, delay),
                Callback: callback });
            return serial;
        },
        clearRun(handle: number): void
        {
            timers.delete(handle);
        },
        sendScriptEvent(id: string, message: string): void
        {
            if (id === ScriptEvent.Acknowledgement)
            {
                acknowledgements.push(JSON.parse(message));
            }

            queue.push({ id,
                message,
                sourceType: "Server" } as ScriptEventCommandMessageAfterEvent);
        }
    } as unknown as System;
    const world = {
        getEntity: (id: string) => entities.get(id),
        afterEvents: { entityDie: signal(die),
            playerLeave: signal(leave) }
    } as unknown as World;
    const flush = async (): Promise<void> =>
    {
        for (let i = 0; i < 8; ++i)
        {
            await Promise.resolve();
        }
    };

    const advance = async (count = 1): Promise<void> =>
    {
        await flush();
        for (let i = 0; i < count; ++i)
        {
            ++tick;
            for (const event of queue.splice(0))
            {
                for (const listener of [ ...script ])
                {
                    listener(event);
                }
            }

            for (const [ handle, entry ] of [ ...timers ])
            {
                if (entry.At <= tick && timers.delete(handle))
                {
                    entry.Callback();
                }
            }

            await flush();
        }
    };

    const actor = (id: string, typeId = "minecraft:player", dimension = "minecraft:overworld"): Entity =>
    {
        const entity: Actor = { id,
            typeId,
            isValid: true,
            dimension: { id: dimension },
            location: { x: 0,
                y: 64,
                z: 0 } };
        const native = Object.assign(entity, {
            getComponent(component: string): { currentValue: number } | undefined
            {
                return component === "minecraft:health" && entity.Health !== undefined
                    ? { currentValue: entity.Health } : undefined;
            },
            getHeadLocation(): { x: number;
                y: number;
                z: number }
            {
                if (entity.Fail)
                {
                    throw new Error("native read failed");
                }

                return { ...entity.location,
                    y: entity.location.y + 1.62 };
            }
        });
        entities.set(id, native);
        return native as unknown as Entity;
    };

    const inject = (payload: unknown, sourceType = "Server", id: string = ScriptEvent.Command): void =>
    {
        queue.push({ id,
            message: typeof payload === "string" ? payload : JSON.stringify(payload),
            sourceType } as ScriptEventCommandMessageAfterEvent);
    };

    const runtime = (): Handle => Start({ World: world,
        System: system,
        OnError: (error: Error) => errors.push(error) });
    const client = (id: string): Intent.Connection => Intent.Start({ Id: id,
        World: world,
        System: system,
        OnError: (error: Error) => errors.push(error) });
    return { system,
        world,
        advance,
        actor,
        inject,
        runtime,
        client,
        entities,
        acknowledgements,
        errors,
        timers,
        script,
        die,
        leave,
        get Tick()
        {
            return tick;
        } };
}

/**
 * Observes a promise's settlement without leaving it unhandled.
 *
 * @category Testing
 * @since 1.0.0
 */
function Track(promise: Promise<unknown>): { Done: boolean;
    Error?: Error }
{
    const result: { Done: boolean;
        Error?: Error } = { Done: false };
    promise.then(() =>
    {
        result.Done = true;
    }, (error: Error) =>
    {
        result.Done = true;
        result.Error = error;
    });
    return result;
}

/**
 * Settles a client operation within a bounded number of fixture ticks.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Settle(host: ReturnType<typeof Host>, promise: Promise<unknown>): Promise<Error | undefined>
{
    const result = Track(promise);
    for (let i = 0; i < 20 && !result.Done; ++i)
    {
        await host.advance();
    }

    assert.ok(result.Done, "operation did not settle");
    return result.Error;
}

test("two independent connections share one entity intent and fenced disposal keeps newer work", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const first = host.client("test:first");
    const second = host.client("test:second");
    const player = host.actor("-1");
    assert.equal(await Settle(host, first.Set(player, Intent.Builtin.Thinking, { DurationTicks: 40 })),
        undefined);
    const initial = runtime.Snapshot();
    assert.equal(initial.length, 1);
    assert.equal(initial[0].ClientId, "test:first");
    assert.ok(Math.abs((initial[0].Subject?.Head.y ?? 0) - 65.62) < 1e-9);

    await host.advance(3);
    assert.equal(await Settle(host, second.Set(player, Intent.Glyphs(""))), undefined);
    const replaced = runtime.Snapshot();
    assert.equal(replaced.length, 1);
    assert.equal(replaced[0].ClientId, "test:second");
    assert.deepEqual(replaced[0].Intent, { Kind: "glyphs",
        Text: "" });
    assert.ok(replaced[0].Generation > initial[0].Generation);
    assert.ok(replaced[0].StartedTick > initial[0].StartedTick, "replacement restarts animation");
    assert.equal(replaced[0].ElapsedTicks, host.Tick - replaced[0].StartedTick);
    assert.equal(replaced[0].ExpiresAt, null);

    // The first request's expiry tick passes, and its owner disposes; neither removes the replacement.
    await host.advance(60);
    assert.equal(await Settle(host, first.Dispose()), undefined);
    assert.equal(runtime.Snapshot()[0]?.ClientId, "test:second");

    assert.equal(await Settle(host, second.Dispose()), undefined);
    assert.deepEqual(runtime.Snapshot(), []);
    assert.deepEqual(host.errors, []);
});

test("explicit Clear works across owners and is idempotent", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const first = host.client("test:first");
    const second = host.client("test:second");
    const npc = host.actor("42", "minecraft:villager_v2");
    assert.equal(await Settle(host, first.Set(npc, Intent.Builtin.Sleep)), undefined);
    assert.equal(runtime.Snapshot().length, 1);
    assert.equal(await Settle(host, second.Clear(npc)), undefined);
    assert.deepEqual(runtime.Snapshot(), []);
    assert.equal(await Settle(host, second.Clear(npc)), undefined);
    assert.equal(await Settle(host, first.Set(npc, Intent.Builtin.Hunger, { DurationTicks: 5 })), undefined);
    assert.equal(await Settle(host, first.Clear(npc)), undefined);
    assert.equal(host.timers.size, 0, "clearing cancels the expiry timer");
});

test("durations expire exactly once and stale expiry cannot remove a replacement", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const connection = host.client("test:one");
    const npc = host.actor("7", "minecraft:zombie");
    assert.equal(await Settle(host, connection.Set(npc, Intent.Builtin.SOS, { DurationTicks: 10 })),
        undefined);
    const accepted = runtime.Snapshot()[0];
    assert.equal(accepted.ExpiresAt, accepted.StartedTick + 10);
    await host.advance(accepted.ExpiresAt! - host.Tick - 1);
    assert.equal(runtime.Snapshot().length, 1);
    assert.equal(runtime.Snapshot()[0].ElapsedTicks, 9);
    await host.advance();
    assert.deepEqual(runtime.Snapshot(), []);

    assert.equal(await Settle(host, connection.Set(npc, Intent.Builtin.SOS, { DurationTicks: 10 })),
        undefined);
    const stale = runtime.Snapshot()[0];
    assert.equal(await Settle(host, connection.Set(npc, Intent.Builtin.Negative, { DurationTicks: 30 })),
        undefined);
    await host.advance(stale.ExpiresAt! - host.Tick + 2);
    const current = runtime.Snapshot();
    assert.equal(current.length, 1);
    assert.equal(current[0].Intent.Kind === "builtin" && current[0].Intent.Name, "negative");
    await host.advance(current[0].ExpiresAt! - host.Tick);
    assert.deepEqual(runtime.Snapshot(), []);
    assert.equal(host.timers.size, 0);
});

test("death and disconnect clear immediately; ambiguous removal suspends and reload resumes", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const connection = host.client("test:one");
    const player = host.actor("-5");
    const mob = host.actor("9", "minecraft:pig");
    const wanderer = host.actor("11", "minecraft:cow");
    assert.equal(await Settle(host, connection.Set(player, Intent.Builtin.Affirmative)), undefined);
    assert.equal(await Settle(host, connection.Set(mob, Intent.Builtin.Hunger)), undefined);
    assert.equal(await Settle(host, connection.Set(wanderer, Intent.Builtin.Thinking, { DurationTicks: 50 })),
        undefined);
    assert.equal(runtime.Snapshot().length, 3);

    for (const listener of host.die)
    {
        listener({ deadEntity: mob });
    }

    for (const listener of host.leave)
    {
        listener({ playerId: "-5" });
    }

    assert.deepEqual(runtime.Snapshot().map((state) => state.EntityId), [ "11" ]);

    // Chunk unload: native entityRemove carries no reason, so the record is retained while hidden.
    const before = runtime.Snapshot()[0];
    host.entities.delete("11");
    await host.advance(10);
    const suspended = runtime.Snapshot();
    assert.equal(suspended.length, 1);
    assert.equal(suspended[0].Subject, undefined);
    assert.equal(suspended[0].Generation, before.Generation);
    assert.equal(suspended[0].ElapsedTicks, before.ElapsedTicks + 10, "elapsed time continues");

    // Reload with a new wrapper in another dimension resumes the same request and animation clock.
    host.actor("11", "minecraft:cow", "minecraft:nether");
    const resumed = runtime.Snapshot()[0];
    assert.equal(resumed.Generation, before.Generation);
    assert.equal(resumed.StartedTick, before.StartedTick);
    assert.equal(resumed.Subject?.Dimension.id, "minecraft:nether");

    // An unloaded subject's duration still elapses.
    host.entities.delete("11");
    await host.advance(resumed.ExpiresAt! - host.Tick);
    assert.deepEqual(runtime.Snapshot(), []);
    assert.deepEqual(host.errors, []);
});

test("valid subjects that have died are rejected while dying or awaiting respawn", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const connection = host.client("test:one");
    const mob = host.actor("9", "minecraft:villager_v2");
    const player = host.actor("-5");
    (mob as unknown as Actor).Health = 0;
    (player as unknown as Actor).Health = 0;
    for (const subject of [ mob, player ])
    {
        const error = await Settle(host, connection.Set(subject, Intent.Builtin.Hunger));
        assert.match(error?.message ?? "", /has died/u);
    }

    assert.deepEqual(runtime.Snapshot(), []);
    (player as unknown as Actor).Health = 20;
    assert.equal(await Settle(host, connection.Set(player, Intent.Builtin.Affirmative)), undefined,
        "a respawned player is accepted again");
    assert.equal(runtime.Snapshot().length, 1);
    // Client OnError also observes each correlated rejection; the runtime itself reports nothing.
    assert.equal(host.errors.length, 2);
    assert.ok(host.errors.every((error: Error) => /has died/u.test(error.message)));
});

test("dormant records of permanently removed subjects end on Clear, owner disposal or Retire", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const connection = host.client("test:one");
    const other = host.client("test:two");
    const subjects = [ host.actor("1", "minecraft:cow"), host.actor("2", "minecraft:cow"),
        host.actor("3", "minecraft:cow") ];
    for (const subject of subjects)
    {
        assert.equal(await Settle(host, connection.Set(subject, Intent.Builtin.Knowledgeable)), undefined);
    }

    assert.equal(await Settle(host, other.Set(host.actor("4", "minecraft:cow"), Intent.Builtin.Exclamatory)),
        undefined);
    for (const id of [ "1", "2", "3", "4" ])
    {
        host.entities.delete(id);
    }

    assert.equal(runtime.Snapshot().length, 4);
    runtime.Retire("1");
    assert.deepEqual(runtime.Snapshot().map((state) => state.EntityId), [ "2", "3", "4" ]);
    // Clear is sent by ID; the client validates its subject first, so this uses the raw protocol.
    const hello = host.acknowledgements.find((entry) => entry.ClientId === "test:two")!;
    host.inject({ Version,
        ClientId: "test:two",
        ConnectionId: hello.ConnectionId,
        RequestId: 50,
        Operation: "clear",
        RuntimeId: hello.RuntimeId,
        EntityId: "2" });
    await host.advance();
    assert.equal(host.acknowledgements.at(-1)?.Status, "accepted");
    assert.deepEqual(runtime.Snapshot().map((state) => state.EntityId), [ "3", "4" ]);
    assert.equal(await Settle(host, connection.Dispose()), undefined);
    assert.deepEqual(runtime.Snapshot().map((state) => state.EntityId), [ "4" ]);
});

test("restart begins empty and fences connections from the previous runtime", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    assert.throws(() => host.runtime(), /already active/u);
    const connection = host.client("test:one");
    const player = host.actor("-1");
    assert.equal(await Settle(host, connection.Set(player, Intent.Builtin.Thinking, { DurationTicks: 100 })),
        undefined);
    runtime.Dispose();
    runtime.Dispose();
    assert.equal(host.script.size, 1, "only the client listener remains");
    assert.equal(host.die.size + host.leave.size, 0);
    assert.equal(host.timers.size, 0);
    assert.deepEqual(runtime.Snapshot(), []);

    const restarted = host.runtime();
    assert.deepEqual(restarted.Snapshot(), []);
    const error = await Settle(host, connection.Set(player, Intent.Builtin.Thinking));
    assert.match(error?.message ?? "", /runtime restarted/u);
    assert.deepEqual(restarted.Snapshot(), []);
    await Settle(host, connection.Dispose());

    const fresh = host.client("test:one");
    assert.equal(await Settle(host, fresh.Set(player, Intent.Builtin.Thinking)), undefined);
    assert.equal(restarted.Snapshot().length, 1);
});

test("malformed, foreign and out-of-order traffic is isolated and correlated when possible", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    const player = host.actor("-1");
    const base = { Version,
        ClientId: "raw:client",
        ConnectionId: "connection-1" };
    const replies = (): Array<Acknowledgement> => host.acknowledgements.splice(0);

    host.inject("{not json");
    host.inject("[]");
    host.inject({ ...base,
        RequestId: 0,
        Operation: "hello" });
    host.inject({ ...base,
        RequestId: 1,
        Operation: "hello" }, "Entity");
    host.inject({ ...base,
        RequestId: 1,
        Operation: "hello" }, "Server", "other:event");
    host.inject("x".repeat(4_096));
    await host.advance();
    assert.deepEqual(replies(), [], "uncorrelated or foreign traffic is ignored");

    host.inject({ ...base,
        Version: 2,
        RequestId: 1,
        Operation: "hello" });
    await host.advance();
    const [ incompatible ] = replies();
    assert.equal(incompatible.Status, "rejected");
    assert.equal(incompatible.Version, Version);
    assert.match(incompatible.Message ?? "", /version 2 is unsupported/u);

    host.inject({ ...base,
        RequestId: 2,
        Operation: "set",
        RuntimeId: "unknown",
        EntityId: "-1",
        Intent: { Kind: "builtin",
            Name: "thinking" },
        Options: { DurationTicks: null,
            MaxDistance: 32,
            Offset: { x: 0,
                y: 0.25,
                z: 0 },
            Scale: 1 } });
    await host.advance();
    assert.match(replies()[0].Message ?? "", /restarted/u, "a foreign RuntimeId is rejected first");

    host.inject({ ...base,
        RequestId: 1,
        Operation: "hello" });
    host.inject({ ...base,
        RequestId: 1,
        Operation: "hello" });
    await host.advance();
    const ready = replies();
    assert.deepEqual(ready.map((entry) => entry.Status), [ "ready", "ready" ],
        "repeated hello is idempotent");
    const runtimeId = ready[0].RuntimeId;
    const set = (requestId: number, body: Record<string, unknown> = {}) => ({ ...base,
        RequestId: requestId,
        Operation: "set",
        RuntimeId: runtimeId,
        EntityId: "-1",
        Intent: { Kind: "builtin",
            Name: "thinking" },
        Options: { DurationTicks: null,
            MaxDistance: 32,
            Offset: { x: 0,
                y: 0.25,
                z: 0 },
            Scale: 1 },
        ...body });

    host.inject(set(2, { Intent: { Kind: "builtin",
        Name: "unknown" } }));
    host.inject(set(3, { Options: { MaxDistance: 32 } }));
    host.inject(set(4, { EntityId: "missing" }));
    host.inject(set(5, { RuntimeId: "old-runtime" }));
    host.inject({ ...set(6),
        ClientId: "raw:impostor" });
    host.inject({ ...base,
        ClientId: "raw:client",
        ConnectionId: "connection-2",
        RequestId: 1,
        Operation: "hello" });
    host.inject({ ...set(1),
        ConnectionId: "connection-3" });
    await host.advance();
    const rejected = replies();
    assert.ok(rejected.every((entry) => entry.Status === "rejected"));
    assert.deepEqual(rejected.map((entry) => entry.RequestId), [ 2, 3, 4, 5, 6, 1, 1 ]);
    assert.match(rejected[0].Message ?? "", /builtin name/u);
    assert.match(rejected[1].Message ?? "", /DurationTicks/u);
    assert.match(rejected[2].Message ?? "", /unavailable/u);
    assert.match(rejected[3].Message ?? "", /restarted/u);
    assert.match(rejected[4].Message ?? "", /another client/u);
    assert.match(rejected[5].Message ?? "", /already has an active connection/u);
    assert.match(rejected[6].Message ?? "", /wait for a ready hello/u);
    assert.deepEqual(runtime.Snapshot(), []);

    host.inject(set(8));
    host.inject(set(7, { Intent: { Kind: "builtin",
        Name: "sleep" } }));
    await host.advance();
    assert.deepEqual(replies().map((entry) => entry.Status), [ "accepted", "rejected" ]);
    assert.equal(runtime.Snapshot()[0].RequestId, 8, "a reordered older request cannot replace newer work");

    // A per-subject read failure suspends only that subject and is reported once.
    const broken = host.actor("-2") as unknown as Actor;
    host.inject(set(9, { EntityId: "-2" }));
    await host.advance();
    broken.Fail = true;
    assert.deepEqual(runtime.Snapshot().map((state) => [ state.EntityId, state.Subject !== undefined ]),
        [ [ "-1", true ], [ "-2", false ] ]);
    runtime.Snapshot();
    assert.equal(host.errors.length, 1);
    assert.match(host.errors[0].message, /could not read subject -2/u);
    broken.Fail = false;
    assert.ok(runtime.Snapshot().every((state) => state.Subject !== undefined));
    assert.equal(player.id, "-1");
});

test("disposal racing a delayed hello fences the connection and its later traffic", async () =>
{
    const host = Host();
    const runtime = host.runtime();
    host.actor("-1");
    const base = { Version,
        ClientId: "raw:client",
        ConnectionId: "connection-1" };
    host.inject({ ...base,
        RequestId: 2,
        Operation: "dispose" });
    host.inject({ ...base,
        RequestId: 1,
        Operation: "hello" });
    await host.advance();
    const replies: Array<Acknowledgement & { Operation: Command["Operation"] }> =
        host.acknowledgements.splice(0);
    assert.deepEqual(replies.map((entry) => [ entry.Operation, entry.Status ]),
        [ [ "dispose", "accepted" ], [ "hello", "rejected" ] ]);
    assert.match(replies[1].Message ?? "", /disposed/u);

    // The Id is still free for a fresh connection, and a disposed one cannot take it back.
    host.inject({ ...base,
        ConnectionId: "connection-2",
        RequestId: 1,
        Operation: "hello" });
    await host.advance();
    assert.equal(host.acknowledgements.splice(0)[0].Status, "ready");
    assert.deepEqual(runtime.Snapshot(), []);
});

test("the runtime validates its native adapters", () =>
{
    assert.throws(() => Start({} as never), TypeError);
    assert.throws(() => Start({ World: {} as World,
        System: {} as System }), TypeError);
});
