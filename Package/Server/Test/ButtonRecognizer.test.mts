/**
 * Pure World button recognition boundaries, independent controls, and lifecycle cancellation.
 *
 * @module @bedform/server/Test/ButtonRecognizer.test
 *
 * @file      ButtonRecognizer.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Button from "../Source/Internal/ButtonInput.js";
import * as HashMap from "@bedform/effect/HashMap";
import * as Option from "@bedform/effect/Option";
import * as Recognizer from "../Source/Internal/ButtonRecognizer.js";
import * as Result from "@bedform/effect/Result";
import Assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/**
 * Supplies one observed edge without importing native objects.
 *
 * @category Testing
 * @since 2.11.0
 */
const edge = (
    tick: number,
    pressed: boolean,
    button: Button.InputButton = "Jump",
    playerId: string = "a"
): Recognizer.Input =>
{
    return { button,
        playerId,
        pressed,
        tick };
};

/**
 * Executes a fixture while retaining events from both edges and observed ticks.
 *
 * @category Testing
 * @since 2.11.0
 */
const run = (
    registrations: ReadonlyArray<Button.Registration>,
    steps: ReadonlyArray<Recognizer.Input | number>
): Recognizer.Transition =>
{
    let state = Result.getOrThrow(Recognizer.make(registrations));
    const events: Array<Recognizer.Event> = [];
    for (const step of steps)
    {
        const next = Result.getOrThrow(typeof step === "number" ? Recognizer.advance(state, step) :
            Recognizer.input(state, step));
        state = next.state;
        events.push(...next.events);
    }

    return { events,
        state };
};

test("all ten controls support every family with resolved defaults and completed-tap targets", () =>
{
    Assert.equal(Object.values(Button.InputButton).length, 10);
    Assert.ok(Object.isFrozen(Button.InputButton));
    Assert.deepEqual(Button.DefaultTiming, { holdTicks: 6,
        maxGapTicks: 5,
        maxPressTicks: 5 });
    Assert.ok(Object.isFrozen(Button.DefaultTiming));
    for (const button of Object.values(Button.InputButton))
    {
        const registrations: ReadonlyArray<Button.Registration> = [
            { kind: "Down" }, { kind: "Up" }, { kind: "Press" }, { kind: "Hold" },
            { count: 3,
                kind: "NTap" }, { kind: "PressAndHold" }, { count: 3,
                kind: "NTapAndHold" }
        ];
        const state = Result.getOrThrow(Recognizer.make(registrations.map(
            (registration: Button.Registration) => ({ ...registration,
                buttons: [ button ] }))));
        Assert.deepEqual(state.definitions.map((definition: Button.Definition) => definition.count),
            [ 0, 0, 1, 0, 3, 1, 3 ]);
        for (const definition of state.definitions)
        {
            Assert.deepEqual(definition.buttons, [ button ]);
            Assert.equal(definition.holdTicks, 6);
            Assert.equal(definition.maxPressTicks, 5);
            Assert.equal(definition.maxGapTicks, 5);
        }

        const result = run(registrations, [ edge(0, true, button), edge(5, false, button),
            edge(10, true, button), edge(15, false, button), edge(20, true, button), edge(25, false, button),
            edge(30, true, button), 36, 37, edge(38, false, button) ]);
        Assert.deepEqual([ ...new Set(result.events.map((event: Recognizer.Event) => event.kind)) ].sort(),
            [ "Down", "Hold", "NTap", "NTapAndHold", "Press", "PressAndHold", "Up" ]);
        Assert.ok(result.events.every((event: Recognizer.Event) => event.button === button));
    }
});

test("configuration validates safe integers and reports supplied runtime values without coercion", () =>
{
    const invalid = [ -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1,
        "2", null, true, undefined ];
    for (const field of [ "count", "maxPressTicks", "maxGapTicks", "holdTicks" ] as const)
    {
        for (const value of invalid)
        {
            if (value === undefined && field !== "count")
            {
                continue;
            }

            const result = Button.configure({ ...{ count: 2,
                kind: "NTap" as const },
            [field]: value } as Button.Registration);
            Assert.ok(Result.isFailure(result));
            Assert.equal(result.failure.field, field);
            Assert.ok(Object.is(result.failure.value, value));
            Assert.ok(Object.isFrozen(result.failure));
        }
    }

    for (const kind of [ "NTap", "NTapAndHold" ] as const)
    {
        Assert.ok(Result.isFailure(Button.configure({ count: 0,
            kind })));
        Assert.ok(Result.isSuccess(Button.configure({ count: Number.MAX_SAFE_INTEGER,
            kind })));
    }

    for (const holdTicks of [ 0, 4, 5 ])
    {
        Assert.ok(Result.isFailure(Button.configure({ holdTicks,
            kind: "Hold" })));
    }

    Assert.ok(Result.isFailure(Button.configure({ kind: "ItemUse" } as unknown as Button.Registration)));
    for (const buttons of [ [ "ItemUse" ], [ "ItemUseOn" ], [ undefined ], Array(1), null, "Jump" ])
    {
        Assert.ok(Result.isFailure(Button.configure({ buttons,
            kind: "Press" } as unknown as Button.Registration)));
    }

    Assert.ok(Result.isFailure(Button.configure({ kind: "Hold",
        phase: "Wrong" } as unknown as Button.Registration)));
    Assert.ok(Result.isFailure(Button.configure({ kind: "Press",
        phase: "End" } as unknown as Button.Registration)));
});

test("configuration copies inputs, deduplicates buttons, and resolves undefined defaults", () =>
{
    const buttons: Array<Button.InputButton> = [ "Jump", "Jump" ];
    const registration: Button.Registration = { buttons,
        holdTicks: undefined,
        kind: "Press" };
    const registrations = [ registration ];
    const state = Result.getOrThrow(Recognizer.make(registrations));
    buttons.push("Sneak");
    registrations.length = 0;
    Assert.deepEqual(state.definitions[0].buttons, [ "Jump" ]);
    Assert.equal(state.definitions[0].holdTicks, 6);
    Assert.ok(Object.isFrozen(state.definitions));
    Assert.ok(Object.isFrozen(state.definitions[0]));
    Assert.ok(Object.isFrozen(state.definitions[0].buttons));
    Assert.equal(run([ { buttons: [],
        kind: "Down" } ], [ edge(0, true) ]).events.length, 0);
});

test("Down and Up observe transitions only and preserve final duration independently of Press", () =>
{
    const result = run([ { kind: "Down" }, { kind: "Up" }, { kind: "Press" } ],
        [ edge(0, false), edge(1, true), edge(2, true), edge(6, false), edge(6, false),
            edge(7, true), edge(20, false) ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) =>
        [ event.kind, event.tick, event.duration, event.tapCount ]),
    [ [ "Down", 1, 0, 0 ], [ "Up", 6, 5, 0 ], [ "Press", 6, 5, 1 ],
        [ "Down", 7, 0, 0 ], [ "Up", 20, 13, 0 ] ]);
    Assert.equal(HashMap.size(result.state.players), 0);
});

test("Press and NTap match inclusive default/custom durations and inclusive release-to-down gaps", () =>
{
    const double: Button.Registration = { count: 2,
        kind: "NTap" };
    Assert.equal(run([ double ],
        [ edge(0, true), edge(5, false), edge(10, true), edge(15, false) ]).events.length, 1);
    Assert.equal(run([ double ],
        [ edge(0, true), edge(5, false), edge(11, true), edge(12, false) ]).events.length, 0);
    Assert.equal(run([ double ],
        [ edge(0, true), edge(6, false), edge(7, true), edge(8, false) ]).events.length, 0);
    const custom: Button.Registration = { count: 2,
        holdTicks: 10,
        kind: "NTap",
        maxGapTicks: 2,
        maxPressTicks: 9 };
    Assert.equal(run([ custom ],
        [ edge(0, true), edge(9, false), edge(11, true), edge(20, false) ]).events.length, 1);
    const zero: Button.Registration = { count: 2,
        holdTicks: 1,
        kind: "NTap",
        maxGapTicks: 0,
        maxPressTicks: 0 };
    Assert.equal(run([ zero ],
        [ edge(0, true), edge(0, false), edge(0, true), edge(0, false) ]).events.length, 1);
    Assert.equal(run([ { kind: "Press" } ], [ edge(0, true), edge(0, false) ]).events[0].duration, 0);
});

test("Press emits immediately and independent N-tap registrations consume without overlap", () =>
{
    const result = run([ { kind: "Press" }, { count: 2,
        kind: "NTap" }, { count: 3,
        kind: "NTap" } ], [ edge(0, true), edge(0, false), edge(1, true), edge(1, false),
        edge(2, true), edge(2, false) ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) =>
        [ event.registration, event.tick, event.tapCount ]),
    [ [ 0, 0, 1 ], [ 0, 1, 1 ], [ 1, 1, 2 ], [ 0, 2, 1 ], [ 2, 2, 3 ] ]);
});

test("players and perpendicular and diagonal controls keep independent tap sequences", () =>
{
    const result = run([ { count: 2,
        kind: "NTap" } ], [ edge(0, true, "Forward"), edge(0, true, "Right"), edge(0, true, "ForwardRight"),
        edge(1, false, "Forward"), edge(1, false, "Right"), edge(1, false, "ForwardRight"),
        edge(2, true, "Forward", "b"), edge(3, false, "Forward", "b"),
        edge(4, true, "ForwardRight"), edge(5, false, "ForwardRight"),
        edge(6, true, "Right"), edge(6, false, "Right") ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) => [ event.playerId, event.button ]),
        [ [ "a", "ForwardRight" ], [ "a", "Right" ] ]);
});

test("button filters, different timing, and long or expired taps cannot complete other registrations", () =>
{
    const registrations: ReadonlyArray<Button.Registration> = [ { buttons: [ "Jump" ],
        count: 2,
        kind: "NTap" }, { buttons: [ "Sneak" ],
        count: 2,
        kind: "NTap" }, { buttons: [ "Jump" ],
        count: 2,
        kind: "NTap",
        maxPressTicks: 1 } ];
    const result = run(registrations, [ edge(0, true), edge(2, false), edge(3, true, "Sneak"),
        edge(4, false, "Sneak"), edge(5, true), edge(6, false) ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) => event.registration), [ 0 ]);
    const expired = run([ registrations[0] ], [ edge(0, true), edge(1, false), 7 ]);
    Assert.equal(HashMap.size(expired.state.players), 0);
    Assert.equal(run([ registrations[0] ], [ edge(0, true), edge(6, false), edge(7, true),
        edge(8, false), edge(9, true), edge(10, false) ]).events[0].tick, 10);
});

test("Hold emits one Start, one Tick per observed following tick, and End with final duration", () =>
{
    const result = run([ { kind: "Hold" } ], [ edge(0, true), 5, 6, 6, 7, 7, edge(8, false), 9 ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) => "phase" in event &&
        [ event.phase, event.tick, event.duration, event.tapCount, event.reason ]),
    [ [ "Start", 6, 6, 0, undefined ], [ "Tick", 7, 7, 0, undefined ], [ "End", 8, 8, 0, "Release" ] ]);
    Assert.equal(HashMap.size(result.state.players), 0);
    Assert.equal(run([ { kind: "Hold" } ], [ edge(0, true), edge(5, false) ]).events.length, 0);
});

test("release exactly at the hold threshold emits Start then End with either callback ordering", () =>
{
    const direct = run([ { kind: "Hold" } ], [ edge(0, true), edge(6, false) ]);
    const intervalFirst = run([ { kind: "Hold" } ], [ edge(0, true), 6, edge(6, false) ]);
    Assert.deepEqual(direct.events, intervalFirst.events);
    Assert.deepEqual(direct.events.map((event: Recognizer.Event) => "phase" in event && event.phase),
        [ "Start", "End" ]);
});

test("PressAndHold requires one completed short press then an additional held press", () =>
{
    const result = run([ { kind: "Press" }, { kind: "Hold" }, { kind: "PressAndHold" } ],
        [ edge(0, true), edge(5, false), edge(10, true), 16, 17, edge(18, false) ]);
    const combined = result.events.filter((event: Recognizer.Event): event is Recognizer.Event.Hold =>
        event.kind === "PressAndHold");
    Assert.deepEqual(combined.map((event: Recognizer.Event.Hold) =>
        [ event.phase, event.tapCount, event.duration ]),
    [ [ "Start", 1, 6 ], [ "Tick", 1, 7 ], [ "End", 1, 8 ] ]);
    Assert.equal(result.events[0].kind, "Press");
    Assert.equal(result.events.filter((event: Recognizer.Event) => event.kind === "Hold").length, 3);
    Assert.equal(run([ { kind: "PressAndHold" } ], [ edge(0, true), 6, edge(7, false) ]).events.length, 0);
});

test("NTapAndHold counts N completed taps before a separate final held press", () =>
{
    for (const count of [ 1, 2, 3 ])
    {
        const taps = Array.from({ length: count }, (_: unknown, index: number) =>
            [ edge(index * 2, true), edge(index * 2 + 1, false) ]).flat();
        const result = run([ { count,
            kind: "NTapAndHold" } ], [ ...taps, edge(count * 2, true), count * 2 + 6,
            count * 2 + 7, edge(count * 2 + 8, false) ]);
        Assert.deepEqual(result.events.map((event: Recognizer.Event) => "phase" in event &&
            [ event.phase, event.tapCount, event.duration ]),
        [ [ "Start", count, 6 ], [ "Tick", count, 7 ], [ "End", count, 8 ] ]);
    }

    const result = run([ { count: 2,
        kind: "NTapAndHold" } ], [ edge(0, true), edge(1, false), edge(2, true), 8, edge(9, false) ]);
    Assert.equal(result.events.length, 0);
});

test("failed or expired combined holds reset without sliding completed prefixes", () =>
{
    const combined: Button.Registration = { kind: "PressAndHold" };
    Assert.equal(run([ combined ], [ edge(0, true), edge(1, false), edge(2, true), edge(3, false),
        edge(4, true), 10, edge(11, false) ]).events.length, 0);
    Assert.equal(run([ combined ], [ edge(0, true), edge(1, false), edge(7, true), 13 ]).events.length, 0);
    Assert.equal(run([ combined ], [ edge(0, true), edge(6, false), edge(7, true), 13 ]).events.length, 0);
    Assert.equal(run([ combined ], [ edge(0, true), edge(1, false), edge(2, true), edge(3, false),
        edge(4, true), edge(5, false), edge(6, true), 12 ]).events.length, 1);
});

test("hold phase filters suppress delivery without suppressing progression and terminal cleanup", () =>
{
    for (const phase of [ "Start", "Tick", "End" ] as const)
    {
        const result = run([ { kind: "Hold",
            phase } ], [ edge(0, true), 6, 7, edge(8, false) ]);
        Assert.equal(result.events.length, 1);
        Assert.ok("phase" in result.events[0]);
        Assert.equal(result.events[0].phase, phase);
        Assert.equal(HashMap.size(result.state.players), 0);
    }
});

test("skipped ticks emit once at observation and duplicate input never produces hold Tick", () =>
{
    const result = run([ { kind: "Hold" } ], [ edge(0, true), 100, edge(101, true), 101, 101 ]);
    Assert.deepEqual(result.events.map((event: Recognizer.Event) =>
        [ event.tick, "phase" in event && event.phase ]),
    [ [ 100, "Start" ], [ 101, "Tick" ] ]);
});

test("cancellation ends only active holds and clears pending presses without manufacturing Up or Press", () =>
{
    const registrations: ReadonlyArray<Button.Registration> = [ { kind: "Up" }, { kind: "Press" },
        { kind: "Hold" }, { kind: "PressAndHold" }, { count: 2,
            kind: "NTap" } ];
    const state = run(registrations, [ edge(0, true), edge(1, false), edge(2, true),
        edge(2, true, "Jump", "b"), 8 ]).state;
    const reasons = [ "Reset", "Leave", "Death", "Spawn", "DimensionChange",
        "UnavailableInput", "Dispose" ] as const;
    for (const reason of reasons)
    {
        const result = Result.getOrThrow(Recognizer.resetPlayer(state, { playerId: "a",
            reason,
            tick: 9 }));
        Assert.equal(HashMap.size(result.state.players), 1);
        Assert.equal(result.events.length, 2);
        Assert.ok(result.events.every((event: Recognizer.Event) =>
            "phase" in event && event.phase === "End" && event.reason === reason && event.playerId === "a"));
        Assert.equal(Result.getOrThrow(Recognizer.input(result.state, edge(10, false))).events.length, 0);
    }

    Assert.equal(Result.getOrThrow(Recognizer.reset(state, { tick: 9 })).events.length, 3);
    const pending = run(registrations, [ edge(0, true) ]).state;
    const reset = Result.getOrThrow(Recognizer.reset(pending, { tick: 100 }));
    Assert.equal(reset.events.length, 0);
    Assert.equal(HashMap.size(reset.state.players), 0);
});

test("all operations reject backward, negative, fractional, nonfinite, and unsafe clock values", () =>
{
    const state = run([], [ 5 ]).state;
    for (const tick of [ 4, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1 ])
    {
        for (const result of [ Recognizer.advance(state, tick), Recognizer.input(state, edge(tick, true)),
            Recognizer.reset(state, { tick }), Recognizer.resetPlayer(state, { playerId: "a",
                tick }) ])
        {
            Assert.ok(Result.isFailure(result));
            Assert.equal(result.failure._tag, "TimeError");
            Assert.equal(result.failure.previousTick, 5);
        }
    }
});

test("snapshots, progress and emitted data remain immutable and terminal state is reclaimed", () =>
{
    const original = Result.getOrThrow(Recognizer.make([ { kind: "Press" } ]));
    const pressed = Result.getOrThrow(Recognizer.input(original, edge(0, true)));
    const released = Result.getOrThrow(Recognizer.input(pressed.state, edge(1, false)));
    Assert.equal(HashMap.size(original.players), 0);
    Assert.equal(HashMap.size(pressed.state.players), 1);
    Assert.equal(HashMap.size(released.state.players), 0);
    const entries = Option.getOrThrow(HashMap.get(pressed.state.players, "a"));
    Assert.ok(Object.isFrozen(pressed));
    Assert.ok(Object.isFrozen(pressed.state));
    Assert.ok(Object.isFrozen(entries));
    Assert.ok(Object.isFrozen(Option.getOrThrow(HashMap.get(entries[0], "Jump"))));
    Assert.ok(Object.isFrozen(released.events));
    Assert.ok(Object.isFrozen(released.events[0]));
});

test("custom and default Press/Hold thresholds remain disjoint for every sampled duration", () =>
{
    for (const maxPressTicks of [ 0, 5, 9 ])
    {
        const holdTicks = maxPressTicks + 1;
        for (let duration = 0; duration <= 15; duration++)
        {
            const result = run([ { holdTicks,
                kind: "Press",
                maxPressTicks }, { holdTicks,
                kind: "Hold",
                maxPressTicks } ], [ edge(0, true), edge(duration, false) ]);
            Assert.equal(result.events.some((event: Recognizer.Event) => event.kind === "Press"),
                duration <= maxPressTicks);
            Assert.equal(result.events.some((event: Recognizer.Event) => event.kind === "Hold"),
                duration >= holdTicks);
        }
    }
});

test("the new core bundles and runs without native, Node, or browser runtime services", async () =>
{
    const bundle = await build({
        bundle: true,
        entryPoints: [ fileURLToPath(new URL("../Source/Internal/ButtonRecognizer.ts", import.meta.url)) ],
        format: "iife",
        globalName: "ButtonCore",
        metafile: true,
        platform: "neutral",
        write: false
    });
    Assert.ok(Object.keys(bundle.metafile.inputs).every((path: string) =>
        !/@minecraft|node_modules\/effect\/|\/Build\//u.test(path)));
    const proof = runInNewContext(`${bundle.outputFiles[0].text}
        const initial = ButtonCore.make([{kind: "Press"}]).success;
        const pressed = ButtonCore.input(initial,
            {playerId: "a", button: "ForwardRight", pressed: true, tick: 0}).success;
        const released = ButtonCore.input(pressed.state,
            {playerId: "a", button: "ForwardRight", pressed: false, tick: 5}).success;
        released.events[0].kind + ":" + released.events[0].button + ":" + released.events[0].duration;
    `, { Buffer: undefined,
        URL: undefined,
        console: undefined,
        process: undefined,
        setTimeout: undefined }, { timeout: 1000 });
    Assert.equal(proof, "Press:ForwardRight:5");
});
