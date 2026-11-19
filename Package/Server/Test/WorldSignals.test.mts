/**
 * Derived World button signals: gesture payloads, hold phases, lifecycle cancellation, and shared resources.
 *
 * @module @bedform/server/Test/WorldSignals.test
 *
 * @file      WorldSignals.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { GestureKind, PlayerButtonGestureAfterEvent, PlayerButtonHoldAfterEvent,
    WorldAfterEvents } from "../Source/Internal/WorldTypes.js";
import Assert from "node:assert/strict";
import { Harness } from "./WorldHarness.mjs";
import type { MovementPlayer } from "./WorldHarness.mjs";
import { test } from "node:test";

/**
 * Any derived payload, including hold phases and cancellation reasons.
 *
 * @category Testing
 * @since 2.11.0
 */
type Derived = PlayerButtonGestureAfterEvent | PlayerButtonHoldAfterEvent;

/**
 * Derived after-event signal names keyed by recognition family.
 *
 * @category Testing
 * @since 2.11.0
 */
const SignalName = Object.freeze({
    Down: "playerButtonDown",
    Hold: "playerButtonHold",
    NTap: "playerButtonNTap",
    NTapAndHold: "playerButtonNTapAndHold",
    Press: "playerButtonPress",
    PressAndHold: "playerButtonPressAndHold",
    Up: "playerButtonUp"
} as const satisfies Record<GestureKind, keyof WorldAfterEvents>);

/**
 * An untyped view of one derived signal, so tests can pass deliberately invalid runtime options.
 *
 * @category Testing
 * @since 2.11.0
 */
interface Loose
{
    readonly subscribe: (callback: (event: Derived) => void, options?: unknown) => unknown;
    readonly unsubscribe: (callback: (event: Derived) => void) => void;
}

/**
 * A subscribed callback with its compact event descriptions and raw payloads.
 *
 * @category Testing
 * @since 2.11.0
 */
interface Recorder
{
    readonly log: Array<string>;
    readonly events: Array<Derived>;
    readonly callback: (event: Derived) => void;
}

/**
 * Returns a derived signal through the facade without static overload selection.
 *
 * @category Testing
 * @since 2.11.0
 */
const signal = (harness: Harness, kind: GestureKind): Loose =>
{
    return harness.world.afterEvents[SignalName[kind]] as unknown as Loose;
};

/**
 * Subscribes a recorder and returns its compact event descriptions and raw payloads.
 *
 * @category Testing
 * @since 2.11.0
 */
const record = (
    harness: Harness,
    kind: GestureKind,
    options?: unknown
): Recorder =>
{
    const log: Array<string> = [];
    const events: Array<Derived> = [];
    const callback = (event: Derived): void =>
    {
        events.push(event);
        log.push(describe(kind, event));
    };

    signal(harness, kind).subscribe(callback, options);
    return { callback,
        events,
        log };
};

/**
 * Formats a payload as kind, button, player, tick, tap count and duration plus any phase and reason.
 *
 * @category Testing
 * @since 2.11.0
 */
const describe = (kind: GestureKind, event: Derived): string =>
{
    const phase = "phase" in event ? ` ${event.phase}` : "";
    const reason = "reason" in event ? ` ${event.reason}` : "";
    return `${kind}${phase}${reason} ${event.button} ${event.playerId}@${event.tick} n${event.tapCount} ` +
        `d${event.duration}`;
};

/**
 * Presses and releases a native button at the given absolute ticks, advancing samples between them.
 *
 * @category Testing
 * @since 2.11.0
 */
const tap = (harness: Harness, player: MovementPlayer, down: number, up: number,
    button: "Jump" | "Sneak" = "Sneak"): void =>
{
    harness.advance(down - harness.tick);
    harness.button(player, button, true);
    harness.advance(up - harness.tick);
    harness.button(player, button, false);
};

test("every derived signal reports native button gestures with complete frozen payloads", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const down = record(harness, "Down");
    const up = record(harness, "Up");
    const press = record(harness, "Press");
    const nTap = record(harness, "NTap", { count: 2 });
    tap(harness, player, 1, 3);
    tap(harness, player, 5, 6);
    Assert.deepEqual(down.log, [ "Down Sneak a@1 n0 d0", "Down Sneak a@5 n0 d0" ]);
    Assert.deepEqual(up.log, [ "Up Sneak a@3 n0 d2", "Up Sneak a@6 n0 d1" ]);
    Assert.deepEqual(press.log, [ "Press Sneak a@3 n1 d2", "Press Sneak a@6 n1 d1" ]);
    Assert.deepEqual(nTap.log, [ "NTap Sneak a@6 n2 d1" ]);
    for (const event of [ ...down.events, ...up.events, ...press.events, ...nTap.events ])
    {
        Assert.ok(Object.isFrozen(event));
        Assert.equal(event.player, player.native());
        Assert.deepEqual(Object.keys(event).sort(),
            [ "button", "duration", "player", "playerId", "tapCount", "tick" ]);
    }
});

test("hold families emit Start at the threshold, one Tick per later tick, and End on release", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const hold = record(harness, "Hold");
    const pressAndHold = record(harness, "PressAndHold");
    const nTapAndHold = record(harness, "NTapAndHold", { count: 2 });
    const press = record(harness, "Press");
    tap(harness, player, 1, 9);
    Assert.deepEqual(hold.log, [ "Hold Start Sneak a@7 n0 d6", "Hold Tick Sneak a@8 n0 d7",
        "Hold Tick Sneak a@9 n0 d8", "Hold End Release Sneak a@9 n0 d8" ]);
    Assert.deepEqual(press.log, []);
    tap(harness, player, 12, 13);
    tap(harness, player, 15, 22);
    Assert.deepEqual(pressAndHold.log, [ "PressAndHold Start Sneak a@21 n1 d6",
        "PressAndHold Tick Sneak a@22 n1 d7", "PressAndHold End Release Sneak a@22 n1 d7" ]);
    tap(harness, player, 30, 31);
    tap(harness, player, 33, 34);
    tap(harness, player, 36, 42);
    Assert.deepEqual(nTapAndHold.log.slice(-2), [ "NTapAndHold Start Sneak a@42 n2 d6",
        "NTapAndHold End Release Sneak a@42 n2 d6" ]);
    const end = hold.events.at(-1)!;
    Assert.deepEqual(Object.keys(end).sort(),
        [ "button", "duration", "phase", "player", "playerId", "reason", "tapCount", "tick" ]);
    Assert.equal(end.player, player.native());
});

test("release exactly at the hold threshold emits Start then End before or after the sample", () =>
{
    for (const sampleFirst of [ false, true ])
    {
        const harness = new Harness();
        const player = harness.player();
        const hold = record(harness, "Hold");
        const press = record(harness, "Press");
        harness.advance();
        harness.button(player, "Jump", true);
        harness.advance(5);
        if (sampleFirst)
        {
            harness.advance();
        }
        else
        {
            harness.tick++;
        }

        harness.button(player, "Jump", false);
        harness.advance(2);
        Assert.deepEqual(hold.log, [ "Hold Start Jump a@7 n0 d6", "Hold End Release Jump a@7 n0 d6" ]);
        Assert.deepEqual(press.log, []);
    }

    const harness = new Harness();
    const player = harness.player();
    const press = record(harness, "Press");
    const hold = record(harness, "Hold");
    tap(harness, player, 1, 6, "Jump");
    Assert.deepEqual(press.log, [ "Press Jump a@6 n1 d5" ]);
    Assert.deepEqual(hold.log, []);
});

test("movement directions drive every gesture with cardinal and diagonal components independently", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const down = record(harness, "Down", { buttons: [ "Forward", "ForwardRight" ] });
    const press = record(harness, "Press", { buttons: [ "Right", "ForwardRight" ] });
    const hold = record(harness, "Hold", { buttons: [ "Forward" ],
        phase: "Start" });
    harness.advance();
    player.vector = { x: -1,
        y: 1 };
    harness.advance();
    player.vector = { x: 0,
        y: 1 };
    harness.advance(2);
    player.vector = { x: 0,
        y: 0 };
    harness.advance(5);
    Assert.deepEqual(down.log, [ "Down Forward a@2 n0 d0", "Down ForwardRight a@2 n0 d0" ]);
    Assert.deepEqual(press.log, [ "Press Right a@3 n1 d1", "Press ForwardRight a@3 n1 d1" ]);
    Assert.deepEqual(hold.log, []);
    player.vector = { x: 0,
        y: 1 };
    harness.advance(8);
    Assert.deepEqual(hold.log, [ "Hold Start Forward a@16 n0 d6" ]);
});

test("timing options, button filters, phase filters, and N-tap counts select independent matches", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const triple = record(harness, "NTap", { buttons: [ "Jump" ],
        count: 3,
        holdTicks: 1,
        maxGapTicks: 0,
        maxPressTicks: 0 });
    const double = record(harness, "NTap", { buttons: [ "Jump" ],
        count: 2 });
    const sneak = record(harness, "Press", { buttons: [ "Sneak" ] });
    const ends = record(harness, "Hold", { holdTicks: 2,
        maxPressTicks: 1,
        phase: "End" });
    for (const at of [ 1, 2, 3, 4 ])
    {
        harness.advance(at - harness.tick);
        harness.button(player, "Jump", true);
        harness.button(player, "Jump", false);
    }

    Assert.deepEqual(triple.log, []);
    Assert.deepEqual(double.log, [ "NTap Jump a@2 n2 d0", "NTap Jump a@4 n2 d0" ]);
    Assert.deepEqual(sneak.log, []);
    harness.advance();
    harness.button(player, "Jump", true);
    harness.button(player, "Jump", false);
    harness.button(player, "Jump", true);
    harness.button(player, "Jump", false);
    harness.button(player, "Jump", true);
    harness.button(player, "Jump", false);
    Assert.deepEqual(triple.log, [ "NTap Jump a@5 n3 d0" ]);
    tap(harness, player, 10, 13);
    Assert.deepEqual(ends.log, [ "Hold End Release Sneak a@13 n0 d3" ]);
});

test("duplicate edges are ignored and players keep isolated sequences across shared listeners", () =>
{
    const harness = new Harness();
    const first = harness.player("a");
    const second = harness.player("b");
    const nTap = record(harness, "NTap", { count: 2 });
    const press = record(harness, "Press");
    const down = record(harness, "Down");
    harness.advance();
    harness.button(first, "Sneak", true);
    harness.button(first, "Sneak", true);
    harness.advance();
    harness.button(second, "Sneak", true);
    harness.button(first, "Sneak", false);
    harness.button(first, "Sneak", false);
    harness.advance();
    harness.button(second, "Sneak", false);
    Assert.deepEqual(down.log, [ "Down Sneak a@1 n0 d0", "Down Sneak b@2 n0 d0" ]);
    Assert.deepEqual(press.log, [ "Press Sneak a@2 n1 d1", "Press Sneak b@3 n1 d1" ]);
    Assert.deepEqual(nTap.log, []);
    Assert.equal(press.events[1].player, second.native());
});

test("lifecycle boundaries cancel holds with reasons and never complete a Press or N-tap", () =>
{
    for (const reason of [ "Leave", "Spawn", "DimensionChange", "Death" ] as const)
    {
        const harness = new Harness();
        const player = harness.player();
        const hold = record(harness, "Hold");
        const press = record(harness, "Press");
        const nTap = record(harness, "NTap", { count: 2 });
        const up = record(harness, "Up");
        harness.advance();
        harness.button(player, "Sneak", true);
        harness.advance(7);
        harness.lifecycle(player, reason);
        harness.advance();
        harness.button(player, "Sneak", false);
        Assert.deepEqual(hold.log, [ "Hold Start Sneak a@7 n0 d6", "Hold Tick Sneak a@8 n0 d7",
            `Hold End ${reason} Sneak a@8 n0 d7` ]);
        Assert.equal(hold.events.at(-1)!.player, reason === "Leave" ? undefined : player.native());
        Assert.deepEqual(up.log, []);
        tap(harness, player, 12, 13);
        harness.lifecycle(player, reason);
        harness.button(player, "Sneak", true);
        harness.lifecycle(player, reason);
        harness.button(player, "Sneak", false);
        tap(harness, player, 15, 16);
        Assert.deepEqual(press.log, [ "Press Sneak a@13 n1 d1", "Press Sneak a@16 n1 d1" ]);
        Assert.deepEqual(nTap.log, []);
    }
});

test("non-player deaths are filtered natively and ignored by the handler", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const hold = record(harness, "Hold");
    Assert.deepEqual(harness.native.afterEvents.entityDie.options,
        [ { entityTypes: [ "minecraft:player" ] } ]);
    harness.button(player, "Jump", true);
    harness.advance(6);
    harness.native.afterEvents.entityDie.emit({ deadEntity: { id: "a",
        typeId: "minecraft:zombie" } } as never);
    harness.button(player, "Jump", false);
    Assert.deepEqual(hold.log, [ "Hold Start Jump a@6 n0 d6", "Hold End Release Jump a@6 n0 d6" ]);
});

test("unreadable input and unlisted players cancel progress with UnavailableInput", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const hold = record(harness, "Hold");
    const press = record(harness, "Press");
    harness.button(player, "Jump", true);
    harness.advance(6);
    player.failRead = true;
    harness.advance();
    player.failRead = false;
    harness.button(player, "Jump", false);
    Assert.deepEqual(hold.log, [ "Hold Start Jump a@6 n0 d6", "Hold End UnavailableInput Jump a@7 n0 d7" ]);
    Assert.equal(hold.events[1].player, player.native());
    Assert.equal(harness.errors.length, 1);
    harness.button(player, "Jump", true);
    harness.advance(6);
    harness.native.players.length = 0;
    harness.advance();
    harness.native.players.push(player.native());
    harness.button(player, "Jump", false);
    Assert.deepEqual(hold.log.slice(2), [ "Hold Start Jump a@13 n0 d6",
        "Hold End UnavailableInput Jump a@14 n0 d7" ]);
    Assert.equal(hold.events[3].player, undefined);
    Assert.deepEqual(press.log, []);
});

test("late subscriptions never inherit presses that began before them", () =>
{
    const harness = new Harness();
    const player = harness.player();
    record(harness, "Down");
    harness.advance();
    harness.button(player, "Sneak", true);
    player.vector = { x: 0,
        y: 1 };
    harness.advance();
    const up = record(harness, "Up");
    const press = record(harness, "Press");
    const hold = record(harness, "Hold");
    harness.advance(8);
    harness.button(player, "Sneak", false);
    player.vector = { x: 0,
        y: 0 };
    harness.advance();
    Assert.deepEqual([ ...up.log, ...press.log, ...hold.log ], []);
    tap(harness, player, 14, 15);
    Assert.deepEqual(up.log, [ "Up Sneak a@15 n0 d1" ]);
});

test("callback failures are reported without stopping other listeners or later events", () =>
{
    const harness = new Harness();
    const player = harness.player();
    signal(harness, "Press").subscribe(() =>
    {
        throw new Error("handler failed");
    });
    harness.world.afterEvents.playerButtonInput.subscribe(() =>
    {
        throw new Error("input handler failed");
    });
    const press = record(harness, "Press");
    tap(harness, player, 1, 2);
    tap(harness, player, 3, 4);
    Assert.deepEqual(press.log, [ "Press Sneak a@2 n1 d1", "Press Sneak a@4 n1 d1" ]);
    Assert.equal(harness.errors.length, 6);
});

test("reentrant unsubscription, subscription, and replacement apply to later deliveries only", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const late: Array<string> = [];
    const removed = (): void => Assert.fail("Removed listener must not run");
    const lateUp = (event: Derived): void =>
    {
        late.push(describe("Up", event));
    };

    const first = (): void =>
    {
        signal(harness, "Down").unsubscribe(removed);
        signal(harness, "Up").subscribe(lateUp);
        signal(harness, "Down").unsubscribe(first);
    };

    signal(harness, "Down").subscribe(first);
    signal(harness, "Down").subscribe(removed);
    tap(harness, player, 1, 2);
    Assert.deepEqual(late, []);
    tap(harness, player, 3, 4);
    Assert.deepEqual(late, [ "Up Sneak a@4 n0 d1" ]);
    const hold = record(harness, "Hold");
    harness.button(player, "Jump", true);
    harness.advance(6);
    Assert.deepEqual(hold.log, [ "Hold Start Jump a@10 n0 d6" ]);
    signal(harness, "Hold").subscribe(hold.callback, { phase: "End" });
    harness.advance();
    harness.button(player, "Jump", false);
    Assert.deepEqual(hold.log, [ "Hold Start Jump a@10 n0 d6" ]);
});

test("unsubscribing everything during dispatch releases resources and suppresses queued deliveries", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const later: Array<string> = [];
    const second = (event: Derived): void =>
    {
        later.push(describe("Press", event));
    };

    const first = (): void =>
    {
        signal(harness, "Press").unsubscribe(first);
        signal(harness, "Press").unsubscribe(second);
        signal(harness, "NTap").unsubscribe(second);
    };

    signal(harness, "Press").subscribe(first);
    signal(harness, "Press").subscribe(second);
    signal(harness, "NTap").subscribe(second, { count: 1 });
    tap(harness, player, 1, 2);
    Assert.deepEqual(later, []);
    Assert.equal(harness.held(), 0);
    Assert.equal(harness.cleared, 1);
});

test("all input signals share one set of native resources released after the last listener", () =>
{
    const harness = new Harness();
    const events = harness.native.afterEvents;
    const input = (): void => {};

    const callbacks = new Map<GestureKind, () => void>();
    harness.world.afterEvents.playerButtonInput.subscribe(input);
    for (const kind of Object.keys(SignalName) as Array<GestureKind>)
    {
        const callback = (): void => {};

        callbacks.set(kind, callback);
        signal(harness, kind).subscribe(callback, kind === "NTap" || kind === "NTapAndHold" ?
            { count: 2 } : undefined);
    }

    Assert.equal(harness.schedules, 1);
    Assert.equal(harness.held(), 6);
    for (const each of events.acquired())
    {
        Assert.equal(each.subscribed, 1);
    }

    harness.world.afterEvents.playerButtonInput.unsubscribe(input);
    for (const [ kind, callback ] of callbacks)
    {
        Assert.equal(harness.held(), 6);
        signal(harness, kind).unsubscribe(callback);
        signal(harness, kind).unsubscribe(callback);
    }

    Assert.equal(harness.held(), 0);
    for (const each of events.acquired())
    {
        Assert.equal(each.unsubscribed, 1);
    }

    record(harness, "Press");
    Assert.equal(harness.schedules, 2);
    Assert.equal(harness.held(), 6);
});

test("partial startup failures roll back acquired resources and the failed subscription", () =>
{
    const harness = new Harness();
    const player = harness.player();
    const events = harness.native.afterEvents;
    const callback = (): void => Assert.fail("Rejected subscription must not be retained");
    events.playerDimensionChange.failSubscribe = true;
    Assert.throws(() => signal(harness, "Press").subscribe(callback), /native subscribe failed/u);
    Assert.equal(harness.held(), 0);
    Assert.equal(events.playerButtonInput.unsubscribed, 1);
    Assert.equal(events.playerSpawn.unsubscribed, 1);
    events.playerDimensionChange.failSubscribe = false;
    harness.failSchedule = true;
    Assert.throws(() => signal(harness, "Hold").subscribe(callback), /interval failed/u);
    Assert.equal(harness.held(), 0);
    harness.failSchedule = false;
    const press = record(harness, "Press");
    tap(harness, player, 1, 2);
    Assert.deepEqual(press.log, [ "Press Sneak a@2 n1 d1" ]);
    Assert.equal(harness.held(), 6);
});

test("invalid options are rejected before any native resource is acquired", () =>
{
    const harness = new Harness();
    const invalid: ReadonlyArray<readonly [ GestureKind, unknown ]> = [
        [ "NTap", undefined ], [ "NTap", { count: 0 } ], [ "NTapAndHold", { count: 1.5 } ],
        [ "Press", { holdTicks: 5 } ], [ "Hold", { maxPressTicks: -1 } ],
        [ "Hold", { maxGapTicks: NaN } ], [ "Press", { phase: "End" } ], [ "Hold", { phase: "Middle" } ],
        [ "Down", { buttons: [ "ItemUse" ] } ],
        [ "Up", { buttons: "Jump" } ], [ "Press", null ], [ "Press", 5 ]
    ];
    for (const [ kind, options ] of invalid)
    {
        Assert.throws(() => signal(harness, kind).subscribe(() => {}, options), TypeError);
    }

    Assert.throws(() => signal(harness, "Press").subscribe(5 as never), TypeError);
    Assert.equal(harness.held(), 0);
    Assert.equal(harness.schedules, 0);
});

test("derived signals are stable facade properties visible to reflection", () =>
{
    const harness = new Harness();
    const afterEvents = harness.world.afterEvents;
    for (const name of Object.values(SignalName))
    {
        Assert.equal(afterEvents[name], afterEvents[name]);
        Assert.ok(name in afterEvents);
        Assert.ok(Reflect.ownKeys(afterEvents).includes(name));
        Assert.equal(Object.getOwnPropertyDescriptor(afterEvents, name)!.value, afterEvents[name]);
        Assert.equal(Reflect.set(afterEvents, name, null), false);
        Assert.ok(!(name in harness.native.afterEvents));
    }

    Assert.equal(afterEvents.weatherChange, harness.native.afterEvents.weatherChange);
    Assert.equal(harness.held(), 0);
});
