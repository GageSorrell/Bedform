/**
 * Injected World facade behavior, shared subscriptions, and raw-vector movement edges.
 *
 * @module @bedform/server/Test/World.test
 *
 * @file      World.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Harness, NativeFixture, States } from "./WorldHarness.mjs";
import type { InputCallback, PlayerButtonInputAfterEvent } from "../Source/Internal/WorldTypes.js";
import type { InputButton as NativeButton,
    PlayerButtonInputAfterEvent as NativeEvent } from "@minecraft/server";
import Assert from "node:assert/strict";
import type { PluginBuild } from "esbuild";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/**
 * Retains button and state pairs without depending on native object implementations.
 *
 * @category Testing
 * @since 2.11.0
 */
const edges = (events: ReadonlyArray<PlayerButtonInputAfterEvent>): ReadonlyArray<ReadonlyArray<string>> =>
{
    return events.map((event: PlayerButtonInputAfterEvent) => [ event.button, event.newButtonState ]);
};

test("facades forward live accessors, detached branded methods, reflection, and unchanged signals", () =>
{
    const harness = new Harness();
    const facade = harness.world;
    Object.freeze(harness.native);
    Object.freeze(harness.native.afterEvents);
    Assert.notEqual(facade, harness.native);
    Assert.equal(facade.beforeEvents, harness.native.beforeEvents);
    Assert.equal(facade.afterEvents.playerSpawn, harness.native.afterEvents.playerSpawn);
    Assert.notEqual(facade.afterEvents.playerButtonInput, harness.native.afterEvents.playerButtonInput);
    Assert.equal(facade.afterEvents, facade.afterEvents);
    Assert.equal(facade.getDay, facade.getDay);
    const getDay = facade.getDay;
    Assert.equal(getDay(), 1);
    harness.native.value = 7;
    Assert.equal(getDay(), 7);
    Assert.equal(Reflect.get(facade, "value"), 7);
    Assert.equal(Reflect.set(facade, "value", 9), true);
    Assert.equal(harness.native.value, 9);
    Assert.equal(Object.getPrototypeOf(facade), NativeFixture.prototype);
    Assert.equal(facade.constructor, NativeFixture);
    Assert.ok("getDay" in facade);
    Assert.deepEqual(Reflect.ownKeys(facade), Reflect.ownKeys(harness.native));
    Assert.equal(Object.getOwnPropertyDescriptor(facade, "afterEvents")!.value, facade.afterEvents);
    Assert.equal(harness.native.afterEvents.playerButtonInput.subscribed, 0);
    Assert.equal(harness.schedules, 0);
});

test("native events retain payload identity and exact callback/state/button filtering", () =>
{
    const harness = new Harness();
    const player = harness.player().native();
    const events: Array<PlayerButtonInputAfterEvent> = [];
    const filtered: Array<PlayerButtonInputAfterEvent> = [];
    const callback: InputCallback = (event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
    };

    const signal = harness.world.afterEvents.playerButtonInput;
    Assert.equal(signal.subscribe(callback), callback);
    signal.subscribe((event: PlayerButtonInputAfterEvent): void =>
    {
        filtered.push(event);
    },
    { buttons: [ "Jump" as NativeButton.Jump ],
        state: States.Pressed });
    signal.subscribe(() => Assert.fail("Empty filters must never match"), { buttons: [] });
    for (const button of [ "Jump", "Sneak" ] as const)
    {
        for (const newButtonState of [ States.Pressed, States.Released ])
        {
            const event: NativeEvent = Object.freeze({ button: button as NativeButton,
                newButtonState,
                player });
            harness.native.afterEvents.playerButtonInput.emit(event);
            Assert.equal(events.at(-1), event);
        }
    }

    Assert.equal(events.length, 4);
    Assert.equal(filtered.length, 1);
    Assert.equal(filtered[0], events[0]);
    Assert.equal(harness.native.afterEvents.playerButtonInput.subscribed, 1);
    Assert.equal(harness.schedules, 1);
});

test("all eight vector directions activate their components and diagonal with matching releases", () =>
{
    const directions: ReadonlyArray<ReadonlyArray<string | number>> = [
        [ 0, 1, "Forward" ], [ 0, -1, "Backward" ], [ 1, 0, "Left" ], [ -1, 0, "Right" ],
        [ 1, 1, "Forward", "Left", "ForwardLeft" ], [ -1, 1, "Forward", "Right", "ForwardRight" ],
        [ 1, -1, "Backward", "Left", "BackwardLeft" ], [ -1, -1, "Backward", "Right", "BackwardRight" ]
    ];
    for (const [ x, y, ...expected ] of directions)
    {
        const harness = new Harness();
        const player = harness.player();
        const events: Array<PlayerButtonInputAfterEvent> = [];
        harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
        {
            events.push(event);
            Assert.equal(event.player.id, "a");
            Assert.ok(Object.isFrozen(event));
        });
        harness.advance();
        player.vector = { x: x as number,
            y: y as number };
        harness.advance();
        player.vector = { x: 0,
            y: 0 };
        harness.advance();
        Assert.deepEqual(edges(events), [ ...expected.map((button: string | number) => [ button, "Pressed" ]),
            ...expected.map((button: string | number) => [ button, "Released" ]) ]);
    }
});

test("dead-zone boundaries and magnitude changes generate only actual active-direction transitions", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const events: Array<PlayerButtonInputAfterEvent> = [];
    harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
    { events.push(event); });
    harness.advance();
    for (const vector of [ { x: 0.2,
        y: -0.2 }, { x: -0.2,
        y: 0.2 }, { x: 0,
        y: 0 } ])
    {
        player.vector = vector;
        harness.advance();
    }

    Assert.equal(events.length, 0);
    player.vector = { x: -0.200001,
        y: 0.200001 };
    harness.advance();
    player.vector = { x: -1,
        y: 1 };
    harness.advance();
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Pressed" ], [ "Right", "Pressed" ],
        [ "ForwardRight", "Pressed" ] ]);
    events.length = 0;
    player.vector = { x: 0,
        y: 1 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Right", "Released" ], [ "ForwardRight", "Released" ] ]);
});

test("crossing axis signs releases the old directions and presses the new directions", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const events: Array<PlayerButtonInputAfterEvent> = [];
    harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
    { events.push(event); });
    harness.advance();
    player.vector = { x: 1,
        y: 1 };
    harness.advance();
    events.length = 0;
    player.vector = { x: -1,
        y: -1 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Released" ], [ "Backward", "Pressed" ],
        [ "Left", "Released" ], [ "Right", "Pressed" ], [ "ForwardLeft", "Released" ],
        [ "BackwardRight", "Pressed" ] ]);
});

test("startup and late join baseline held vectors without synthesizing a Down edge", () =>
{
    const harness = new Harness();
    const first = harness.player();
    first.vector = { x: -1,
        y: 1 };
    const events: Array<PlayerButtonInputAfterEvent> = [];
    harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
    { events.push(event); });
    Assert.equal(first.reads, 0);
    harness.advance();
    const late = harness.player("b");
    late.vector = { x: 1,
        y: 0 };
    harness.advance();
    Assert.equal(events.length, 0);
    late.vector = { x: 0,
        y: 0 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Left", "Released" ] ]);
});

test("one listener and interval sample each player once per tick for all callbacks", () =>
{
    const harness = new Harness();
    const player = harness.player();
    harness.native.players.push(harness.native.players[0]);
    const signal = harness.world.afterEvents.playerButtonInput;
    const first: InputCallback = (): void => {};

    const second: InputCallback = (): void => {};

    signal.subscribe(first);
    signal.subscribe(second);
    Assert.equal(harness.schedules, 1);
    Assert.equal(harness.native.afterEvents.playerButtonInput.subscribed, 1);
    harness.advance();
    for (const callback of harness.intervals.values())
    {
        callback();
    }

    Assert.equal(player.reads, 1);
    signal.unsubscribe(first);
    Assert.equal(harness.intervals.size, 1);
    signal.unsubscribe(second);
    signal.unsubscribe(second);
    Assert.equal(harness.intervals.size, 0);
    Assert.equal(harness.cleared, 1);
    Assert.equal(harness.native.afterEvents.playerButtonInput.unsubscribed, 1);
});

test("options are copied, repeated subscription replaces filters, and movement filters work", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const events: Array<PlayerButtonInputAfterEvent> = [];
    const callback: InputCallback = (event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
    };

    const buttons: Array<"Forward" | "Right"> = [ "Forward" ];
    const signal = harness.world.afterEvents.playerButtonInput;
    signal.subscribe(callback, { buttons,
        state: States.Pressed });
    buttons.push("Right");
    harness.advance();
    player.vector = { x: -1,
        y: 1 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Pressed" ] ]);
    signal.subscribe(callback, { buttons: [ "Right" ],
        state: States.Released });
    player.vector = { x: 0,
        y: 0 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Pressed" ], [ "Right", "Released" ] ]);
    Assert.equal(harness.schedules, 1);
});

test("unsubscribe during dispatch suppresses removed callbacks and stale session events", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const signal = harness.world.afterEvents.playerButtonInput;
    const events: Array<PlayerButtonInputAfterEvent> = [];
    const second: InputCallback = (): void => Assert.fail("Removed callback must not run");
    const first: InputCallback = (event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
        signal.unsubscribe(second);
        signal.unsubscribe(first);
    };

    signal.subscribe(first);
    signal.subscribe(second);
    const stale = [ ...harness.native.afterEvents.playerButtonInput.callbacks ];
    harness.advance();
    player.vector = { x: -1,
        y: 1 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Pressed" ] ]);
    Assert.equal(harness.intervals.size, 0);
    signal.subscribe((event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
    });
    for (const callback of stale)
    {
        callback({ button: "Jump" as NativeButton,
            newButtonState: States.Pressed,
            player: player.native() });
    }

    harness.advance();
    Assert.equal(events.length, 1);
});

test("input read failures and player removal reset baselines without false movement releases", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const events: Array<PlayerButtonInputAfterEvent> = [];
    harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
    { events.push(event); });
    harness.advance();
    player.vector = { x: 1,
        y: 0 };
    harness.advance();
    player.failRead = true;
    harness.advance();
    player.failRead = false;
    player.vector = { x: 0,
        y: 0 };
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Left", "Pressed" ] ]);
    Assert.equal(harness.errors.length, 1);
    harness.native.players.length = 0;
    harness.advance();
    harness.native.players.push(player.native());
    player.vector = { x: 0,
        y: 1 };
    harness.advance();
    Assert.equal(events.length, 1);
});

test("raw vectors are copied across ticks and invalid vectors cannot fabricate movement", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const healthy = harness.player("b");
    const events: Array<PlayerButtonInputAfterEvent> = [];
    harness.world.afterEvents.playerButtonInput.subscribe((event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
    });
    harness.advance();
    player.vector.x = 1;
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Left", "Pressed" ] ]);
    player.vector.x = NaN;
    healthy.vector.y = -1;
    harness.advance();
    Assert.equal(harness.errors.length, 1);
    Assert.deepEqual(edges(events), [ [ "Left", "Pressed" ], [ "Backward", "Pressed" ] ]);
    player.vector.x = 0;
    harness.advance();
    Assert.equal(events.length, 2);
});

test("restarting listeners while a vector remains held establishes a fresh baseline", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const signal = harness.world.afterEvents.playerButtonInput;
    const events: Array<PlayerButtonInputAfterEvent> = [];
    const callback: InputCallback = (event: PlayerButtonInputAfterEvent): void =>
    {
        events.push(event);
    };

    signal.subscribe(callback);
    harness.advance();
    player.vector.y = 1;
    harness.advance();
    signal.unsubscribe(callback);
    signal.subscribe(callback);
    harness.advance();
    Assert.deepEqual(edges(events), [ [ "Forward", "Pressed" ] ]);
    Assert.equal(harness.schedules, 2);
    Assert.equal(harness.native.afterEvents.playerButtonInput.callbacks.size, 1);
});

test("startup failures roll back resources and callback failures do not stop other listeners", () =>
{
    const harness = new Harness();
    const signal = harness.world.afterEvents.playerButtonInput;
    const callback: InputCallback = (): void => {};

    harness.failSchedule = true;
    Assert.throws(() => signal.subscribe(callback), /interval failed/u);
    Assert.equal(harness.native.afterEvents.playerButtonInput.callbacks.size, 0);
    Assert.equal(harness.intervals.size, 0);
    Assert.equal(harness.held(), 0);
    harness.failSchedule = false;
    harness.native.afterEvents.playerButtonInput.failSubscribe = true;
    Assert.throws(() => signal.subscribe(callback), /native subscribe failed/u);
    harness.native.afterEvents.playerButtonInput.failSubscribe = false;
    let calls = 0;
    signal.subscribe((): void =>
    {
        throw new Error("handler failed");
    });
    signal.subscribe((): void =>
    {
        calls++;
    });
    harness.native.afterEvents.playerButtonInput.emit({ button: "Sneak" as NativeButton,
        newButtonState: States.Pressed,
        player: harness.player().native() });
    Assert.equal(calls, 1);
    Assert.equal(harness.errors.length, 1);
});

test("invalid subscriptions acquire no native resources", () =>
{
    const harness = new Harness();
    const signal = harness.world.afterEvents.playerButtonInput;
    for (const buttons of [ [ "ItemUse" ], Array(1), null, "Forward" ])
    {
        Assert.throws(() => signal.subscribe(() => {}, { buttons } as never), TypeError);
    }

    Assert.throws(() => signal.subscribe(() => {}, { state: "Wrong" } as never), TypeError);
    Assert.equal(harness.schedules, 0);
    Assert.equal(harness.native.afterEvents.playerButtonInput.subscribed, 0);
});

test("public World import stays inert and preserves native enum and signal identities", async () =>
{
    const harness = new Harness();
    let reads = 0;
    const native = new Proxy(harness.native, { get: (target: NativeFixture, key: PropertyKey): unknown =>
    {
        reads++;
        return Reflect.get(target, key, target);
    } });
    const bundle = await build({
        bundle: true,
        entryPoints: [ fileURLToPath(new URL("../Source/index.ts", import.meta.url)) ],
        format: "iife",
        globalName: "WorldModule",
        platform: "neutral",
        plugins: [ { name: "native-host",
            setup: (builder: PluginBuild): void =>
            {
                builder.onResolve({ filter: new RegExp("^@minecraft/server$") }, () => ({ namespace: "native",
                    path: "host" }));
                builder.onLoad({ filter: new RegExp(".*"),
                    namespace: "native" }, () => ({ contents:
                    "export const {world, system, InputButton, ButtonState} = globalThis.host;",
                loader: "js" }));
            } } ],
        write: false
    });
    const sandbox = { host: { ButtonState: States,
        InputButton: { Jump: "Jump",
            Sneak: "Sneak" },
        system: harness.host().system,
        world: native } };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    Assert.equal(reads, 0);
    Assert.equal(harness.schedules, 0);
    Assert.equal(harness.native.afterEvents.playerButtonInput.subscribed, 0);
    Assert.equal(runInNewContext("WorldModule.InputButton.Jump === host.InputButton.Jump", sandbox), true);
    Assert.equal(runInNewContext("Object.isFrozen(WorldModule.InputButton)", sandbox), true);
    Assert.equal(runInNewContext("Object.keys(WorldModule.InputButton).length", sandbox), 10);
    Assert.equal(runInNewContext("WorldModule.world.afterEvents.playerSpawn", sandbox),
        harness.native.afterEvents.playerSpawn);
    Assert.equal(harness.schedules, 0);
});
