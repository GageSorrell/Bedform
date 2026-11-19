/**
 * Owns every timer and root-schedule microtask issued by one explicitly started spatial runtime.
 *
 * @module bedform/Spatial/Internal/ManagedHost
 *
 * @file      ManagedHost.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ReactHost, ReactHostSystemOptions } from "./React/Host.js";
import { CreateSystemReactHost } from "./React/Host.js";
import type { Environment } from "./HostConfig.js";
import type { System } from "../Renderer.js";

/**
 * Tracks native timer handles while leaving unrelated System runs untouched.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export class ManagedHost implements Environment
{
    readonly Host: ReactHost;
    private Active: boolean = true;
    private readonly Pending: Map<number, () => void> = new Map();
    constructor(private readonly System: System, options: ReactHostSystemOptions)
    {
        this.Host = CreateSystemReactHost({
            clearRun: (handle: number): void => this.Cancel(handle),
            run: (callback: () => void): number => this.Schedule(callback, 0),
            runTimeout: (callback: () => void, ticks: number = 1): number => this.Schedule(callback, ticks)
        }, options);
    }

    /**
     * Queues React's root-schedule microtask on the next owned host turn.
     *
     * @category Scheduling
     * @since 1.0.0
     */
    readonly Microtask = (callback: () => void): void =>
    {
        this.Schedule(callback, 0);
    };

    /**
     * Routes reconciler timeouts through the same owned host used by the scheduler.
     *
     * @category Scheduling
     * @since 1.0.0
     */
    readonly SetTimeout = (callback: () => void, delay: number): unknown =>
        this.Host.SetTimeout(callback, delay);

    /**
     * Cancels a timeout without affecting another runtime or native consumer.
     *
     * @category Scheduling
     * @since 1.0.0
     */
    readonly ClearTimeout = (handle: unknown): void => this.Host.ClearTimeout(handle);

    /**
     * Schedules one native callback and fences a native callback already dequeued during cancellation.
     *
     * @category Scheduling
     * @since 1.0.0
     */
    private Schedule(callback: () => void, ticks: number): number
    {
        if (!this.Active)
        {
            return 0;
        }

        let handle = 0;
        const run = (): void =>
        {
            if (!this.Active || !this.Pending.delete(handle))
            {
                return;
            }

            try
            {
                callback();
            }
            catch (error)
            {
                this.Host.ReportError(error);
            }
        };

        handle = ticks === 0 ? this.System.run(run) : this.System.runTimeout(run, ticks);
        this.Pending.set(handle, callback);
        return handle;
    }

    /**
     * Releases a tracked native timer.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    private Cancel(handle: number): void
    {
        if (this.Pending.delete(handle))
        {
            this.System.clearRun(handle);
        }
    }

    /**
     * Drains bookkeeping after all roots have unmounted, including canceled scheduler callbacks.
     * Running these callbacks clears upstream scheduled-work flags so a subsequent runtime can start.
     * No live application timers are advanced early: callers must retire every root first.
     *
     * @throws { AggregateError } If callbacks fail or retired work refuses to settle.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Drain(): void
    {
        const errors: Array<unknown> = [];
        let count = 0;
        while (this.Pending.size && count++ < 1_000)
        {
            const [ handle, callback ] = this.Pending.entries().next().value!;
            try
            {
                this.Cancel(handle);
                callback();
            }
            catch (error)
            {
                errors.push(error);
            }
        }

        if (this.Pending.size)
        {
            errors.push(new Error("Retired spatial work did not settle."));
        }

        if (errors.length)
        {
            throw new AggregateError(errors, "Spatial scheduler cleanup failed.");
        }
    }

    /**
     * Fences remaining callbacks and attempts every native cancellation, even when one cancellation fails.
     *
     * @throws { AggregateError } If native cancellation fails.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Close(): void
    {
        this.Active = false;
        const errors: Array<unknown> = [];
        for (const handle of [ ...this.Pending.keys() ])
        {
            try
            {
                this.Cancel(handle);
            }
            catch (error)
            {
                errors.push(error);
            }
        }

        if (errors.length)
        {
            throw new AggregateError(errors, "Spatial native timer cleanup failed.");
        }
    }
}
