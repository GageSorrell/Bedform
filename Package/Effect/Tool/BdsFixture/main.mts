/**
 * Behavior-pack script that exercises the Effect runtime through
 * `@bedform/effect/Bedrock` on a live Bedrock Dedicated Server. It reports one
 * marker line per scenario for `Tool/bds-runtime.mts`.
 *
 * @module @bedform/effect/Tool/BdsFixture/main
 *
 * @file      main.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Scenario programs use contextual callbacks and long Effect pipelines, as the sandbox tests do. */
/* eslint-disable @typescript-eslint/typedef, @stylistic/max-len */

import { Bedrock, Context, Deferred, Effect, Fiber, Layer, ManagedRuntime, Random, Schedule } from "@bedform/effect";
import { DynamicProperty, Marker, ScriptEvent } from "./keys.mjs";
import { WeatherType, system, world } from "@minecraft/server";

/**
 * Writes one scenario result for the runner.
 *
 * @category Tests
 * @since 1.0.0
 */
function report(name: string, ok: boolean, detail: string): void
{
    console.warn(`${Marker.Result} ${JSON.stringify({ detail,
        name,
        ok })}`);
}

/**
 * Runs an effect that measures game ticks and fails with a description when its
 * expectation does not hold.
 *
 * @category Tests
 * @since 1.0.0
 */
const scenario = (name: string, body: Effect.Effect<string, string, Bedrock.TickSystemService>): Effect.Effect<void, never, Bedrock.TickSystemService> =>
    body.pipe(
        Effect.matchCause({
            onFailure: (cause) => report(name, false, String(cause)),
            onSuccess: (detail) => report(name, true, detail)
        })
    );

/**
 * A service built by a layer that owns a resource and a background fiber.
 *
 * @category Tests
 * @since 1.0.0
 */
class Machines extends Context.Service<Machines, { readonly beats: Effect.Effect<ReadonlyArray<number>> }>()(
    "@bedform/effect/Fixture/Machines"
)
{}

const Events: Array<string> = [];

const MachinesLive = Layer.effect(Machines, Effect.gen(function* ()
{
    const beats: Array<number> = [];
    yield* Effect.acquireRelease(Effect.sync(() => Events.push("open")), () => Effect.sync(() => Events.push("close")));
    yield* Effect.forkScoped(Effect.repeat(Effect.sync(() => beats.push(system.currentTick)), Schedule.spaced(Bedrock.ticks(2))));
    return { beats: Effect.sync(() => beats.slice()) };
}));

const Layers = scenario("layers, scopes, schedules and interruption", Effect.gen(function* ()
{
    const beats = yield* Effect.scoped(Effect.gen(function* ()
    {
        const context = yield* Layer.build(MachinesLive);
        const machines = Context.get(context, Machines);
        yield* Effect.sleep(Bedrock.ticks(7));
        return yield* machines.beats;
    }));
    const gaps: Array<number> = beats.slice(1).map((tick, index) => tick - beats[index]);
    const interrupted: Array<string> = [];
    const sleeper = yield* Effect.forkChild(Effect.onInterrupt(Effect.sleep("1 hour"), () => Effect.sync(() => interrupted.push("yes"))));
    yield* Effect.sleep(Bedrock.ticks(1));
    yield* Fiber.interrupt(sleeper);
    const gate = yield* Deferred.make<string>();
    const waiter = yield* Effect.forkChild(Deferred.await(gate));
    yield* Deferred.succeed(gate, "open");
    const opened = yield* Fiber.join(waiter);
    const ok: boolean = gaps.length >= 3 && gaps.every((gap) => gap === 2) && Events.join(",") === "open,close" &&
        interrupted.length === 1 && opened === "open";
    const detail: string = `gaps ${gaps.join(",")} events ${Events.join(",")} interrupted ${interrupted.length}`;
    return ok ? detail : yield* Effect.fail(detail);
}));

const Sleeps = scenario("sleeps round up to whole ticks", Effect.gen(function* ()
{
    const measure = function <R>(effect: Effect.Effect<void, never, R>): Effect.Effect<number, never, R>
    {
        return Effect.gen(function* ()
        {
            const start: number = system.currentTick;
            yield* effect;
            return system.currentTick - start;
        });
    };

    const results: Array<number> = [
        yield* measure(Effect.sleep("120 millis")),
        yield* measure(Effect.sleep(Bedrock.ticks(4))),
        yield* measure(Bedrock.nextTick)
    ];
    const detail: string = results.join(",");
    return detail === "3,4,1" ? detail : yield* Effect.fail(`expected 3,4,1 but measured ${detail}`);
}));

const Budget = scenario("long work spreads across ticks without the watchdog", Effect.gen(function* ()
{
    const start: number = system.currentTick;
    let sum: number = 0;
    yield* Effect.forEach(Array.from({ length: 200_000 }, (_, index) => index), (index) => Effect.sync(() =>
    {
        sum += index;
    }), { discard: true });
    const detail: string = `sum ${sum} over ${system.currentTick - start} ticks`;
    return sum === 19_999_900_000 ? detail : yield* Effect.fail(detail);
}));

const Writes = scenario("fibers resumed by microtasks and ticks may write to the world", Effect.gen(function* ()
{
    yield* Effect.yieldNow;
    world.setDynamicProperty(DynamicProperty.Probe, 1);
    yield* Effect.sleep(Bedrock.ticks(1));
    world.setDynamicProperty(DynamicProperty.Probe, 2);
    return `probe ${String(world.getDynamicProperty(DynamicProperty.Probe))}`;
}));

const HostFallbacks = scenario("Random and abort signals work without host crypto or AbortController", Effect.gen(function* ()
{
    const value: number = yield* Random.next;
    let signal: { readonly aborted: boolean } | undefined;
    const fiber = yield* Effect.forkChild(Effect.tryPromise({
        catch: String,
        try: (abort) =>
        {
            signal = abort;
            return new Promise<never>(() => undefined);
        }
    }));
    yield* Effect.sleep(Bedrock.ticks(1));
    yield* Fiber.interrupt(fiber);
    const detail: string = `random ${value >= 0 && value < 1} aborted ${String(signal?.aborted)} hostAbortController ${
        typeof (globalThis as { AbortController?: unknown }).AbortController}`;
    return value >= 0 && value < 1 && signal?.aborted === true ? detail : yield* Effect.fail(detail);
}));

/**
 * Attempts a world write that read-only mode forbids and reports whether the
 * engine allowed it. Dynamic properties cannot serve: read-only mode permits
 * `setDynamicProperty`.
 *
 * @category Tests
 * @since 1.0.0
 */
function tryWrite(timeOfDay: number): boolean
{
    try
    {
        world.setTimeOfDay(timeOfDay);
        return true;
    }
    catch
    {
        return false;
    }
}

namespace BeforeEventProbe
{
    /**
     * What a weather before-event handler and the fiber it forked observed.
     *
     * @category Tests
     * @since 1.0.0
     */
    export interface Observation
    {
        readonly handlerWrite: boolean;
        readonly microtaskSameTick: boolean;
        readonly microtaskWrite: boolean;
        readonly tickWrite: boolean;
    }

    /**
     * An observation together with whether the rain was finally applied.
     *
     * @category Tests
     * @since 1.0.0
     */
    export interface Outcome extends Observation
    {
        readonly applied: boolean;
    }
}

/**
 * One armed weather before-event: whether its handler cancels synchronously
 * with `runSync` or only after the forked fiber has waited, and where the
 * observations go.
 *
 * @category Tests
 * @since 1.0.0
 */
interface BeforeEventProbe
{
    readonly cancel: "sync" | "after-wait";
    readonly observed: Deferred.Deferred<BeforeEventProbe.Observation>;
}

let armed: BeforeEventProbe | undefined;
let rainApplied: number = 0;

/**
 * Asks the runner for `weather rain`, waits for the armed handler's
 * observations and a few ticks more, and reports whether the rain was applied.
 *
 * @category Tests
 * @since 1.0.0
 */
const rainEvent = (cancel: BeforeEventProbe["cancel"]): Effect.Effect<BeforeEventProbe.Outcome, string, Bedrock.TickSystemService> =>
    Effect.gen(function* ()
    {
        const observed = yield* Deferred.make<BeforeEventProbe.Observation>();
        const before: number = rainApplied;
        armed = { cancel,
            observed };
        console.warn(`${Marker.Command} weather rain`);
        const observation = yield* Deferred.await(observed).pipe(
            Effect.timeout(Bedrock.ticks(200)),
            Effect.mapError(() => `no weather before-event for ${cancel} cancel`)
        );
        yield* Effect.sleep(Bedrock.ticks(5));
        world.getDimension("overworld").setWeather(WeatherType.Clear);
        yield* Bedrock.nextTick;
        return { ...observation,
            applied: rainApplied > before };
    });

const BeforeEvents = scenario("before-events are read-only until the handler returns and drain microtasks in the same tick", Effect.gen(function* ()
{
    yield* Effect.sync(() =>
    {
        world.gameRules.doWeatherCycle = false;
        world.getDimension("overworld").setWeather(WeatherType.Clear);
    });
    yield* Bedrock.nextTick;
    const sync = yield* rainEvent("sync");
    const late = yield* rainEvent("after-wait");
    const ok: boolean = !sync.handlerWrite && !sync.applied && sync.microtaskSameTick && sync.microtaskWrite &&
        sync.tickWrite && !late.handlerWrite && late.microtaskSameTick && late.microtaskWrite && late.applied;
    const detail: string = `handler write ${sync.handlerWrite}, runSync cancel applied rain ${sync.applied}, ` +
        `microtask same tick ${sync.microtaskSameTick}, microtask write ${sync.microtaskWrite}, ` +
        `nextTick write ${sync.tickWrite}, cancel after waiting applied rain ${late.applied}`;
    return ok ? detail : yield* Effect.fail(detail);
}));

world.afterEvents.weatherChange.subscribe((event) =>
{
    if (event.newWeather === WeatherType.Rain)
    {
        rainApplied++;
    }
});

/**
 * A finalizer that proves shutdown disposal reached the runtime's layers.
 *
 * @category Tests
 * @since 1.0.0
 */
class ShutdownProbe extends Context.Service<ShutdownProbe, { readonly name: string }>()("@bedform/effect/Fixture/ShutdownProbe")
{}

const Runtime = ManagedRuntime.make(Layer.mergeAll(
    Bedrock.layer(system),
    Layer.effect(ShutdownProbe, Effect.gen(function* ()
    {
        yield* Effect.addFinalizer(() => Effect.sync(() => console.warn(Marker.Shutdown)));
        return { name: "probe" };
    }))
));
Bedrock.disposeOnShutdown(Runtime, system.beforeEvents.shutdown);

world.beforeEvents.weatherChange.subscribe((event) =>
{
    const probe: BeforeEventProbe | undefined = armed;
    if (probe === undefined || event.newWeather !== WeatherType.Rain)
    {
        return;
    }

    armed = undefined;
    const eventTick: number = system.currentTick;
    const handlerWrite: boolean = tryWrite(1000);
    if (probe.cancel === "sync")
    {
        Runtime.runSync(Effect.sync(() =>
        {
            event.cancel = true;
        }));
    }

    Runtime.runFork(Effect.gen(function* ()
    {
        yield* Effect.yieldNow;
        const microtaskSameTick: boolean = system.currentTick === eventTick;
        const microtaskWrite: boolean = tryWrite(2000);
        if (probe.cancel === "after-wait")
        {
            event.cancel = true;
        }

        yield* Bedrock.nextTick;
        const tickWrite: boolean = tryWrite(3000);
        yield* Deferred.succeed(probe.observed, { handlerWrite,
            microtaskSameTick,
            microtaskWrite,
            tickWrite });
    }));
});

system.afterEvents.scriptEventReceive.subscribe((event) =>
{
    if (event.id !== ScriptEvent.Run)
    {
        return;
    }

    void Runtime.runPromise(Effect.gen(function* ()
    {
        yield* ShutdownProbe;
        yield* Writes;
        yield* Sleeps;
        yield* Layers;
        yield* Budget;
        yield* HostFallbacks;
        yield* BeforeEvents;
    })).then(() => console.warn(Marker.Done));
});

world.afterEvents.worldLoad.subscribe(() => console.warn(Marker.Ready));
