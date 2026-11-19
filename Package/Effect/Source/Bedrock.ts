/**
 * Runs Effect programs on Bedrock's game tick. Bedrock's script engine has no
 * `setTimeout`, `setImmediate` or `performance`, so the default Effect scheduler
 * cannot hand work back to the game and `Effect.sleep` has no timer. This module
 * supplies a `Scheduler` and a `Clock` built on the `system` object from
 * `@minecraft/server`, which the add-on passes in; `@bedform/effect` itself never
 * imports a Minecraft module.
 *
 * Provide `Bedrock.layer(system)` once, usually to a `ManagedRuntime` together
 * with the add-on's own services:
 *
 * ```ts
 * import { system, world } from "@minecraft/server";
 * import { Bedrock, Effect, Layer, ManagedRuntime } from "@bedform/effect";
 *
 * const Runtime = ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), AppLive));
 * Bedrock.disposeOnShutdown(Runtime, system.beforeEvents.shutdown);
 *
 * world.afterEvents.playerSpawn.subscribe((event) =>
 * {
 *     Runtime.runFork(greet(event.player.name));
 * });
 * ```
 *
 * Time is measured in game ticks of 50 milliseconds. A sleep is rounded up to
 * whole ticks and lasts longer when the server lags. Work in a before-event
 * handler must finish synchronously, with `Effect.runSync`; an effect that
 * waits resumes after the handler has returned, when the event can no longer be
 * cancelled. The handler itself runs in read-only mode; code after any wait,
 * even `Effect.yieldNow` resumed by a microtask in the same tick, may change
 * the world.
 *
 * @module @bedform/effect/Bedrock
 *
 * @file      Bedrock.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Cause from "./Cause.js";
import * as Clock from "./Clock.js";
import * as Context from "./Context.js";
import * as Duration from "./Duration.js";
import * as Effect from "./Effect.js";
import * as Exit from "./Exit.js";
import * as Layer from "./Layer.js";
import type * as ManagedRuntime from "./ManagedRuntime.js";
import * as Scheduler from "./Scheduler.js";
import { Host } from "./Internal/host.js";

/**
 * The part of `@minecraft/server`'s `system` object that the Bedrock runtime
 * uses. Pass `system` itself; it satisfies this interface structurally. Tests
 * can pass a simulated tick loop instead.
 *
 * @category Models
 * @since 1.0.0
 */
export interface TickSystem
{
    /** The number of the current game tick. */
    readonly currentTick: number;

    /** Runs a callback on the next tick and returns an identifier for `clearRun`. */
    run(callback: () => void): number;

    /** Runs a callback after a number of ticks and returns an identifier for `clearRun`. */
    runTimeout(callback: () => void, tickDelay?: number): number;

    /** Cancels a callback scheduled with `run` or `runTimeout`. */
    clearRun(runId: number): void;
}

/**
 * Options for the Bedrock scheduler.
 *
 * @category Models
 * @since 1.0.0
 */
export interface SchedulerOptions
{
    /**
     * How many milliseconds of Effect work may run in one tick before the
     * scheduler continues on the next tick. Within the budget, fibers yield to
     * each other through microtasks. Zero makes every yield wait for the next
     * tick.
     */
    readonly budgetMillis?: number;
}

/**
 * A signal that reports when the world is about to shut down, such as
 * `system.beforeEvents.shutdown`.
 *
 * @category Models
 * @since 1.0.0
 */
export interface ShutdownSignal
{
    /** Registers a callback to run before shutdown. */
    subscribe(callback: () => void): unknown;
}

/**
 * The nominal length of a game tick, in milliseconds.
 *
 * @category Constants
 * @since 1.0.0
 */
export const TickMillis = 50 as const;

/**
 * The default per-tick budget of the Bedrock scheduler, in milliseconds.
 *
 * @category Constants
 * @since 1.0.0
 */
export const DefaultBudgetMillis = 5 as const;

const NanosPerMilli: bigint = BigInt(1_000_000);

/**
 * Converts a number of game ticks into a `Duration`, for `Effect.sleep`,
 * `Schedule.spaced` and other time-based APIs.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ticks = (count: number): Duration.Duration => Duration.millis(count * TickMillis);

/**
 * Schedules a callback as a microtask and returns a function that cancels it.
 *
 * @category Utilities
 * @since 1.0.0
 */
const microtask = (callback: () => void): (() => void) =>
{
    let cancelled: boolean = false;
    void Promise.resolve().then((): void =>
    {
        if (!cancelled)
        {
            callback();
        }
    });
    return (): void =>
    {
        cancelled = true;
    };
};

/**
 * Creates a scheduler that runs fibers within a per-tick time budget and then
 * continues them on the next tick through `system.run`, so long-running work
 * is spread over ticks instead of tripping Bedrock's script watchdog.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeScheduler = (system: TickSystem, options?: SchedulerOptions): Scheduler.Scheduler =>
{
    const budgetMillis: number = options?.budgetMillis ?? DefaultBudgetMillis;
    let tick: number = Number.NaN;
    let tickStart: number = 0;
    return new Scheduler.MixedScheduler("async", (task: () => void): (() => void) =>
    {
        const now: number = Date.now();
        if (system.currentTick !== tick)
        {
            tick = system.currentTick;
            tickStart = now;
        }

        if (now - tickStart < budgetMillis)
        {
            return microtask(task);
        }

        const runId: number = system.run(task);
        return (): void => system.clearRun(runId);
    });
};

/**
 * Creates a clock whose `sleep` waits whole game ticks through
 * `system.runTimeout`, rounding up and waiting at least one tick. Wall-clock
 * and monotonic readings come from `Date.now`, with millisecond resolution.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeClock = (system: TickSystem): Clock.Clock =>
{
    let previousNanos: bigint = BigInt(0);
    const monotonicNanos = (): bigint =>
    {
        const current: bigint = BigInt(Date.now()) * NanosPerMilli;
        if (current > previousNanos)
        {
            previousNanos = current;
        }

        return previousNanos;
    };

    const sleepMillis = (millis: number): Effect.Effect<void> =>
    {
        if (millis <= 0)
        {
            return Effect.yieldNow;
        }

        if (!Number.isFinite(millis))
        {
            return Effect.never;
        }

        return Effect.callback<void>((resume: (effect: Effect.Effect<void>) => void): Effect.Effect<void> =>
        {
            const runId: number = system.runTimeout(
                (): void => resume(Effect.void),
                Math.max(1, Math.ceil(millis / TickMillis))
            );
            return Effect.sync((): void => system.clearRun(runId));
        });
    };

    return {
        currentTimeMillis: Effect.sync((): number => Date.now()),
        currentTimeMillisUnsafe: (): number => Date.now(),
        currentTimeNanos: Effect.sync((): bigint => BigInt(Date.now()) * NanosPerMilli),
        currentTimeNanosUnsafe: (): bigint => BigInt(Date.now()) * NanosPerMilli,
        monotonicTimeNanos: Effect.sync(monotonicNanos),
        monotonicTimeNanosUnsafe: monotonicNanos,
        sleep: (duration: Duration.Duration): Effect.Effect<void> => sleepMillis(Duration.toMillis(duration))
    };
};

/**
 * The tick system the Bedrock layer was built with, for effects that need to
 * schedule work on the game loop themselves.
 *
 * @category Services
 * @since 1.0.0
 */
export class TickSystemService extends Context.Service<TickSystemService, TickSystem>()(
    "@bedform/effect/Bedrock/TickSystem"
)
{}

/**
 * Provides the Bedrock scheduler, the tick clock and `TickSystemService`. Every
 * effect that sleeps, repeats on a schedule or yields between fibers needs it.
 *
 * @category Layers
 * @since 1.0.0
 */
export const layer = (system: TickSystem, options?: SchedulerOptions): Layer.Layer<TickSystemService> =>
    Layer.mergeAll(
        Layer.succeed(Scheduler.Scheduler, makeScheduler(system, options)),
        Layer.succeed(Clock.Clock, makeClock(system)),
        Layer.succeed(TickSystemService, system)
    );

/**
 * Waits for the next game tick. Code after it runs from a `system.run`
 * callback, outside any before-event handler, so it may change the world.
 * Any other wait also leaves a before-event's read-only mode; use this one to
 * act on the next tick regardless of the scheduler's budget.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const nextTick: Effect.Effect<void, never, TickSystemService> = TickSystemService.use(
    (system: TickSystem): Effect.Effect<void> =>
        Effect.callback<void>((resume: (effect: Effect.Effect<void>) => void): Effect.Effect<void> =>
        {
            const runId: number = system.run((): void => resume(Effect.void));
            return Effect.sync((): void => system.clearRun(runId));
        })
);

/**
 * Disposes a `ManagedRuntime` when the shutdown signal fires, running the
 * finalizers of its layers. Shutdown handlers run synchronously, so only
 * finalizers that complete without waiting can finish; if any finalizer waits,
 * or disposal fails, a warning is written to the console.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const disposeOnShutdown = <R, Error>(
    runtime: ManagedRuntime.ManagedRuntime<R, Error>,
    signal: ShutdownSignal
): void =>
{
    signal.subscribe((): void =>
    {
        const exit: Exit.Exit<void> = Effect.runSyncExit(runtime.disposeEffect);
        if (Exit.isFailure(exit))
        {
            Host.console?.warn?.(`@bedform/effect: runtime disposal at shutdown did not complete:\n${
                Cause.pretty(exit.cause)}`);
        }
    });
};
