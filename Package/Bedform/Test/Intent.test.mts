/**
 * Qualifies Intent definitions, validation, cooperative transport and connection resource ownership.
 *
 * @module bedform/Test/Intent.test
 *
 * @file      Intent.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Test fixtures preserve contextual callback inference and protocol field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as Intent from "bedform/Spatial/Intent";
import { CheckMessage, CheckOptions } from "../Source/Spatial/Internal/IntentValue.js";
import type { Acknowledgement } from "bedform/Canvas/IntentProtocol";
import type { Entity } from "@minecraft/server";
import { Harness } from "./IntentHarness.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("all 19 presets are deeply frozen and Glyphs snapshots exactly one-to-three BMP PUA characters", () =>
{
    assert.equal(Object.keys(Intent.Builtin).length, 19);
    assert.equal(new Set(Object.values(Intent.Builtin).map((entry) => entry.Name)).size, 19);
    assert.ok(Object.isFrozen(Intent.Builtin));
    for (const preset of Object.values(Intent.Builtin))
    {
        assert.ok(Object.isFrozen(preset));
    }

    const advances = [ 8, 16, 7.5 ];
    const metrics = { Advances: advances,
        Height: 16 };
    const glyphs = Intent.Glyphs("\uE000\uE200\uF8FF", metrics);
    advances[0] = 99;
    metrics.Height = 20;
    assert.deepEqual(glyphs.Metrics, { Advances: [ 8, 16, 7.5 ],
        Height: 16 });
    assert.ok(Object.isFrozen(glyphs.Metrics?.Advances));
    assert.ok(Object.isFrozen(glyphs));
    for (const text of [ "", "a", "\uDFFF", "\uF900", "\uE200a", "\u{F0000}", "\uE200".repeat(4) ])
    {
        assert.throws(() => Intent.Glyphs(text), /BMP PUA/u);
    }

    for (const invalid of [ { Advances: [] }, { Advances: [ 0 ] }, { Height: Infinity },
        { Advances: [ NaN ] }, { Height: -1 } ])
    {
        assert.throws(() => Intent.Glyphs("\uE200", invalid), TypeError);
    }
});

test("root and direct imports remain inert in a restricted host without native or Web APIs", async () =>
{
    for (const source of [
        "import { Spatial } from \"bedform\"; globalThis.api = Spatial.Intent;",
        "import * as Spatial from \"bedform/Spatial\"; globalThis.api = Spatial.Intent;",
        "import * as Intent from \"bedform/Spatial/Intent\"; globalThis.api = Intent;"
    ])
    {
        const bundled = await build({ stdin: { contents: source,
            resolveDir: process.cwd() },
        bundle: true,
        format: "iife",
        platform: "neutral",
        write: false,
        external: [ "@minecraft/server", "@minecraft/server-ui" ] });
        const context: Record<string, unknown> = {};
        runInNewContext(bundled.outputFiles[0].text, context);
        const api = context.api as typeof Intent;
        assert.equal(api.Builtin.Thinking.Name, "thinking");
        assert.equal(api.Glyphs("\uE200").Text, "\uE200");
        const host = Harness();
        const client = api.Start({ Id: "restricted:addon",
            World: host.world,
            System: host.system });
        const pending = client.Set(host.actor("npc", "minecraft:pig"), api.Builtin.Thinking);
        await host.advance(3);
        await pending;
        const disposed = client.Dispose();
        await host.advance(2);
        await disposed;
        assert.equal(host.listeners.size, 0);
        assert.equal(host.scheduled.size, 0);
    }
});

test("startup probes retry until ready, then Set acknowledges acceptance with exact defaults", async () =>
{
    const host = Harness();
    host.control.ReadyAt = 11;
    const client = host.start();
    const operation = client.Set(host.actor("player"), Intent.Builtin.Thinking);
    let complete = false;
    void operation.then(() =>
    {
        complete = true;
    });
    assert.equal(host.commands.length, 0);
    await host.advance(10);
    assert.equal(complete, false);
    assert.equal(host.commands.every((command) => command.Operation === "hello"), true);
    assert.equal(new Set(host.commands.map((command) => command.RequestId)).size, 1);
    await host.advance(2);
    await operation;
    const command = host.commands.at(-1)!;
    assert.equal(command.Operation, "set");
    if (command.Operation !== "set")
    {
        throw new Error("Expected Set.");
    }

    assert.deepEqual(command.Options, { DurationTicks: null,
        MaxDistance: 32,
        Offset: { x: 0,
            y: 0.25,
            z: 0 },
        Scale: 1 });
    assert.deepEqual(command.Intent, Intent.Builtin.Thinking);
    assert.equal(command.RuntimeId, "runtime-one");
    assert.equal(command.EntityId, "player");
    const disposed = client.Dispose();
    assert.equal(client.Dispose(), disposed);
    await host.advance(2);
    await disposed;
    assert.equal(host.listeners.size, 0);
    assert.equal(host.scheduled.size, 0);
});

test("independent connections and concurrent requests require matching acknowledgements", async () =>
{
    const host = Harness();
    const first = host.start("test:first");
    const second = host.start("test:second");
    await host.advance(1);
    host.control.Auto = false;
    const actor = host.actor("npc", "minecraft:villager");
    const one = first.Set(actor, Intent.Builtin.Affirmative);
    const two = second.Set(actor, Intent.Builtin.Negative);
    const clear = first.Clear(actor);
    const settled: Array<string> = [];
    void one.then(() => settled.push("one"));
    void two.then(() => settled.push("two"));
    void clear.then(() => settled.push("clear"));
    await host.advance(1);
    const mutations = host.commands.filter((command) => command.Operation !== "hello");
    assert.equal(mutations.length, 3);
    const [ oneCommand, twoCommand, clearCommand ] = mutations;
    assert.notEqual(oneCommand.ConnectionId, twoCommand.ConnectionId);
    host.acknowledge(oneCommand, { ClientId: "other:addon" });
    host.acknowledge(oneCommand, { ConnectionId: twoCommand.ConnectionId });
    host.acknowledge(oneCommand, { RequestId: 999 });
    host.acknowledge(oneCommand, { Operation: "dispose" });
    host.emit("{malformed");
    host.emit({ ...oneCommand,
        Status: "accepted",
        RuntimeId: "runtime-one" }, "Entity");
    await host.flush();
    assert.deepEqual(settled, []);
    host.acknowledge(clearCommand);
    host.acknowledge(twoCommand);
    await host.flush();
    assert.deepEqual(settled, [ "clear", "two" ]);
    host.acknowledge(oneCommand);
    host.acknowledge(oneCommand);
    await Promise.all([ one, two, clear ]);
    assert.deepEqual(settled, [ "clear", "two", "one" ]);
    host.control.Auto = true;
    const disposed = [ first.Dispose(), second.Dispose() ];
    await host.advance(2);
    await Promise.all(disposed);
    assert.equal(host.listeners.size, 0);
});

test("Set snapshots glyph, image and presentation inputs and validates live world subjects", async () =>
{
    const host = Harness();
    const client = host.start();
    const actor = host.actor("npc", "minecraft:cow");
    const image: Intent.ImageDescriptor = { Kind: "image",
        Version: 1,
        Id: "example:heart",
        Particle: "example:heart",
        Width: 8,
        Height: 16,
        FrameCount: 6,
        FrameTicks: 4 };
    const offset = { x: 1,
        y: 2,
        z: 3 };
    const options = { DurationTicks: 60,
        Scale: 2,
        Offset: offset,
        MaxDistance: 50 };
    const operation = client.Set(actor, image, options);
    offset.y = 99;
    options.Scale = 99;
    await host.advance(3);
    await operation;
    const command = host.commands.at(-1)!;
    if (command.Operation !== "set")
    {
        throw new Error("Expected Set.");
    }

    assert.deepEqual(command.Intent, image);
    assert.deepEqual(command.Options, { DurationTicks: 60,
        MaxDistance: 50,
        Offset: { x: 1,
            y: 2,
            z: 3 },
        Scale: 2 });
    for (const invalid of [ { ...image,
        FrameCount: 0 }, { ...image,
        FrameTicks: 0.5 },
    { ...image,
        Particle: "invalid" }, { ...image,
        Width: Infinity }, { ...image,
        Version: 2 },
    { Kind: "builtin",
        Name: "unknown" }, { Kind: "glyphs",
        Text: "a" } ])
    {
        await assert.rejects(client.Set(actor, invalid as Intent.Definition), TypeError);
    }

    for (const invalid of [ { DurationTicks: 0 }, { DurationTicks: 1.5 }, { Scale: NaN },
        { MaxDistance: -1 }, { Offset: { x: 0,
            y: Infinity,
            z: 0 } } ])
    {
        await assert.rejects(client.Set(actor, Intent.Builtin.Thinking, invalid), TypeError);
    }

    await assert.rejects(client.Set({ id: "missing" } as Entity, image), TypeError);
    host.actors.delete(actor.id);
    await assert.rejects(client.Clear(actor), /unavailable/u);
    assert.equal(host.commands.filter((entry) => entry.Operation === "set").length, 1);
    const disposal = client.Dispose();
    await host.advance(2);
    await disposal;
});

test("missing/incompatible Canvas fail within a bounded wait, without mutation retries", async () =>
{
    const host = Harness();
    host.control.Enabled = false;
    const client = host.start();
    const failure = assert.rejects(client.Set(host.actor("player"), Intent.Builtin.Sleep),
        /install.*Canvas/u);
    await host.advance(100);
    await failure;
    assert.equal(host.errors.length, 1);
    assert.equal(host.scheduled.size, 0);
    assert.equal(host.commands.every((entry) => entry.Operation === "hello"), true);
    host.control.Enabled = true;
    const disposed = client.Dispose();
    await host.advance(2);
    await disposed;

    host.control.Version = 2 as 1;
    const incompatible = host.start();
    const rejected = assert.rejects(incompatible.Clear(host.actor("again")), /incompatible.*expected/u);
    await host.advance(2);
    await rejected;
    host.control.Version = 1;
    const cleanup = incompatible.Dispose();
    await host.advance(2);
    await cleanup;

    const third = host.start();
    await host.advance(1);
    host.control.Auto = false;
    const uncertain = assert.rejects(third.Set(host.actor("last"), Intent.Builtin.SOS), /unknown.*no retry/u);
    await host.advance(100);
    await uncertain;
    assert.equal(host.commands.filter((entry) => entry.Operation === "set").length, 1);
    host.control.Auto = true;
    const thirdCleanup = third.Dispose();
    await host.advance(2);
    await thirdCleanup;
});

test("runtime rejection, malformed replies and restart epochs reject only the correlated request", async () =>
{
    for (const [ overrides, message ] of [
        [ { Status: "rejected",
            Message: "subject has been removed" }, /subject has been removed/u ],
        [ { RuntimeId: "next-boot" }, /restarted/u ],
        [ { RuntimeId: "" }, /malformed/u ],
        [ { Status: "ready" }, /status accepted/u ]
    ] as const)
    {
        const host = Harness();
        const client = host.start();
        await host.advance(1);
        host.control.Auto = false;
        const operation = assert.rejects(client.Clear(host.actor("npc")), message);
        await host.advance(1);
        host.acknowledge(host.commands.at(-1)!, overrides as Partial<Acknowledgement>);
        await operation;
        assert.equal(host.errors.length, 1);
        host.control.Auto = true;
        const disposal = client.Dispose();
        await host.advance(2);
        await disposal;
    }
});

test("dispose fences queued work, pending writes, startup races and retained stale callbacks", async () =>
{
    const fresh = Harness();
    const connection = fresh.start();
    const cancelled = assert.rejects(connection.Set(fresh.actor("early"), Intent.Builtin.Thinking),
        /disposed/u);
    const disposal = connection.Dispose();
    assert.equal(connection.Dispose(), disposal);
    await fresh.advance(101);
    await Promise.all([ cancelled, disposal ]);
    assert.equal(fresh.commands.length, 0);
    assert.equal(fresh.listeners.size, 0);
    assert.equal(fresh.scheduled.size, 0);

    const host = Harness();
    host.control.Auto = false;
    const client = host.start();
    const queued = assert.rejects(client.Set(host.actor("queued"), Intent.Builtin.Sleep), /disposed/u);
    const retained = [ ...host.scheduled.values() ].map((entry) => entry.Callback);
    await host.advance(1);
    const hello = host.commands[0];
    const finished = client.Dispose();
    host.acknowledge(hello);
    await host.advance(1);
    const command = host.commands.at(-1)!;
    assert.equal(command.Operation, "dispose");
    assert.equal(command.ConnectionId, hello.ConnectionId);
    assert.ok(command.RequestId > hello.RequestId);
    host.acknowledge(command);
    await Promise.all([ queued, finished ]);
    for (const callback of retained)
    {
        callback();
    }

    await host.advance(200);
    assert.equal(host.commands.length, 2);
    assert.equal(host.listeners.size, 0);
    assert.equal(host.scheduled.size, 0);
    await assert.rejects(client.Clear(host.actor("later")), /disposed/u);
    await assert.rejects(client.Set(host.actor("last"), Intent.Builtin.Thinking), /disposed/u);
});

test("local Id uniqueness and native transport failures leave recoverable ownership", async () =>
{
    const host = Harness();
    host.control.FailSubscribe = true;
    assert.throws(() => host.start(), /subscribe failed/u);
    host.control.FailSubscribe = false;
    const client = host.start();
    assert.throws(() => host.start(), /already has/u);
    await client.Dispose();
    const next = host.start();
    await next.Dispose();
    for (const fault of [ "FailSchedule", "FailSend" ] as const)
    {
        host.control[fault] = true;
        const broken = host.start();
        const failure = assert.rejects(broken.Clear(host.actor(fault)), /could not/u);
        await host.advance(1);
        await failure;
        host.control[fault] = false;
        const disposal = broken.Dispose();
        await host.advance(2);
        await disposal;
        assert.equal(host.listeners.size, 0);
        assert.equal(host.scheduled.size, 0);
    }

    assert.throws(() => Intent.Start({ Id: "bad",
        World: host.world,
        System: host.system }), TypeError);
    assert.throws(() => Intent.Start(null as unknown as Intent.Configuration), TypeError);
});

test("missing cleanup acknowledgements still release local subscriptions and timers", async () =>
{
    const host = Harness();
    const client = host.start();
    await host.advance(1);
    host.control.Enabled = false;
    const disposal = client.Dispose();
    const rejected = assert.rejects(disposal, /acceptance is unknown/u);
    assert.equal(client.Dispose(), disposal);
    await host.advance(100);
    await rejected;
    assert.equal(host.listeners.size, 0);
    assert.equal(host.scheduled.size, 0);
    const replacement = host.start();
    await replacement.Dispose();
});

test("UTF-8 budgets and defaults use no Node/Web helpers", () =>
{
    assert.doesNotThrow(() => CheckMessage("a".repeat(2048)));
    assert.throws(() => CheckMessage("\uE200".repeat(683)), /UTF-8/u);
    assert.throws(() => CheckMessage("\u{1F600}".repeat(513)), /UTF-8/u);
    const defaults = CheckOptions();
    assert.ok(Object.isFrozen(defaults));
    assert.ok(Object.isFrozen(defaults.Offset));
});

test("every builtin and both static/animated generic images use the same Set contract", async () =>
{
    const host = Harness();
    const client = host.start();
    const actor = host.actor("subject", "minecraft:pig");
    const definitions: Array<Intent.Definition> = [ ...Object.values(Intent.Builtin),
        Intent.Glyphs("\uE200"),
        { Kind: "image",
            Version: 1,
            Id: "test:static",
            Particle: "test:static",
            Width: 8,
            Height: 16,
            FrameCount: 1,
            FrameTicks: 1 },
        { Kind: "image",
            Version: 1,
            Id: "test:animated",
            Particle: "test:animated",
            Width: 16,
            Height: 8,
            FrameCount: 6,
            FrameTicks: 4 } ];
    for (const definition of definitions)
    {
        const set = client.Set(actor, definition);
        await host.advance(2);
        await set;
        const command = host.commands.at(-1)!;
        if (command.Operation !== "set")
        {
            throw new Error("Expected Set.");
        }

        assert.deepEqual(command.Intent, definition);
    }

    const disposal = client.Dispose();
    await host.advance(2);
    await disposal;
});

test("disposal fences transmitted writes and late replies across restarted connections", async () =>
{
    const host = Harness();
    const first = host.start();
    await host.advance(1);
    host.control.Auto = false;
    const actor = host.actor("subject");
    const pending = assert.rejects(first.Set(actor, Intent.Builtin.Thinking), /disposed/u);
    await host.advance(1);
    const oldWrite = host.commands.at(-1)!;
    const disposal = first.Dispose();
    await host.advance(1);
    const cleanup = host.commands.at(-1)!;
    host.acknowledge(oldWrite);
    host.acknowledge(cleanup);
    await Promise.all([ pending, disposal ]);
    const next = host.start();
    await host.advance(1);
    const nextHello = host.commands.at(-1)!;
    assert.notEqual(nextHello.ConnectionId, oldWrite.ConnectionId);
    host.acknowledge(oldWrite);
    host.acknowledge(cleanup);
    host.acknowledge(nextHello);
    host.control.Auto = true;
    const clear = next.Clear(actor);
    await host.advance(1);
    await clear;
    const done = next.Dispose();
    await host.advance(2);
    await done;
    assert.equal(host.listeners.size, 0);
    assert.equal(host.scheduled.size, 0);
});

test("throwing error observers cannot prevent rejection or local cleanup", async () =>
{
    const host = Harness();
    host.control.Enabled = false;
    const client = Intent.Start({ Id: "test:observer",
        World: host.world,
        System: host.system,
        OnError: () =>
        {
            throw new Error("observer failed");
        } });
    const missing = assert.rejects(client.Clear(host.actor("subject")), /did not become ready/u);
    await host.advance(100);
    await missing;
    const disposal = assert.rejects(client.Dispose(), /acceptance is unknown/u);
    await host.advance(100);
    await disposal;
    assert.equal(host.listeners.size, 0);
    assert.equal(host.scheduled.size, 0);
});
