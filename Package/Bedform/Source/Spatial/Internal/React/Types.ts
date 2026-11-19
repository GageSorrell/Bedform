/**
 * Declared shapes of the vendored React, reconciler and scheduler modules. The scheduler contract is
 * complete; React and reconciler exports stay structural until the public React port types them.
 *
 * @module bedform/Spatial/Internal/React/Types
 *
 * @file      Types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Exports of a vendored CommonJS module, keyed by upstream export name.
 *
 * @category Types
 * @since 1.0.0
 */
export type VendorModule = Readonly<Record<string, unknown>>;

/**
 * The `react-reconciler` default export: a factory that binds a host configuration.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReconcilerFactory = (configuration: object) => VendorModule;

export namespace SchedulerModule
{
    /**
     * Options accepted by `unstable_scheduleCallback`.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Options
    {
        readonly delay?: number;
    }

    /**
     * Opaque scheduled task returned by `unstable_scheduleCallback`.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Task
    {
        readonly id: number;
        readonly priorityLevel: Priority;
        readonly startTime: number;
        readonly expirationTime: number;
    }

    /**
     * Scheduler priority level, from 1 (immediate) to 5 (idle).
     *
     * @category Types
     * @since 1.0.0
     */
    export type Priority = 1 | 2 | 3 | 4 | 5;

    /**
     * A unit of work; returning a function continues the same task after the scheduler next checks
     * whether to yield.
     *
     * @category Types
     * @since 1.0.0
     */
    export type Callback = (didTimeout: boolean) => Callback | null | undefined | void;
}

/**
 * The `scheduler@0.28.0` contract used by `react-reconciler@0.34.0`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SchedulerModule
{
    readonly unstable_ImmediatePriority: 1;
    readonly unstable_UserBlockingPriority: 2;
    readonly unstable_NormalPriority: 3;
    readonly unstable_LowPriority: 4;
    readonly unstable_IdlePriority: 5;
    readonly unstable_Profiling: null;
    readonly unstable_now: () => number;
    readonly unstable_scheduleCallback: (
        priority: SchedulerModule.Priority,
        callback: SchedulerModule.Callback,
        options?: SchedulerModule.Options
    ) => SchedulerModule.Task;
    readonly unstable_cancelCallback: (task: SchedulerModule.Task) => void;
    readonly unstable_shouldYield: () => boolean;
    readonly unstable_requestPaint: () => void;
    readonly unstable_forceFrameRate: (framesPerSecond: number) => void;
    readonly unstable_getCurrentPriorityLevel: () => SchedulerModule.Priority;
    readonly unstable_runWithPriority: <R>(priority: SchedulerModule.Priority, handler: () => R) => R;
    readonly unstable_next: <R>(handler: () => R) => R;
    readonly unstable_wrapCallback: <Wrapped extends (...arguments_: Array<never>) => unknown>(
        callback: Wrapped
    ) => Wrapped;
}
