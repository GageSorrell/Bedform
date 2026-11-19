/**
 * Scoped observational counters; importing this module never reads a clock.
 *
 * @module bedform/Internal/PhysicsProfile
 *
 * @file      PhysicsProfile.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable sort-keys */

/**
 * Frozen work and timing observations for one complete transactional world step.
 * Timings are milliseconds; counters include retries and failed work.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Metrics
{
    readonly totalMs: number;
    readonly broadPhaseMs: number;
    readonly narrowPhaseMs: number;
    readonly ccdMs: number;
    readonly broadPhasePairs: number;
    readonly narrowPhaseCalls: number;
    readonly narrowPhaseCacheHits: number;
    readonly ccdCalls: number;
    readonly ccdIterations: number;
    readonly bvhNodes: number;
    readonly leafPairs: number;
    readonly replans: number;
    readonly maxIslandBodies: number;
    readonly slowestPairMs: number;
    readonly slowestPair: string;
}

/**
 * Mutable counters are private to the active synchronous profiling scope.
 *
 * @category Types
 * @since 1.0.0
 */
export type Collector = { -readonly [Key in keyof Metrics]: Metrics[Key] };
let active: Collector | undefined;

/**
 * Reads the current opt-in scope without creating collectors or reading time.
 *
 * @category Internal
 * @since 1.0.0
 */
export const current = (): Collector | undefined =>
{
    return active;
};

/**
 * Creates bounded scalar counters; no body arrays or unbounded logs are retained.
 *
 * @category Internal
 * @since 1.0.0
 */
export const empty = (): Collector =>
{
    return { totalMs: 0,
        broadPhaseMs: 0,
        narrowPhaseMs: 0,
        ccdMs: 0,
        broadPhasePairs: 0,
        narrowPhaseCacheHits: 0,
        narrowPhaseCalls: 0,
        ccdCalls: 0,
        ccdIterations: 0,
        bvhNodes: 0,
        leafPairs: 0,
        replans: 0,
        maxIslandBodies: 0,
        slowestPairMs: 0,
        slowestPair: "" };
};

/**
 * A failed or unavailable instrumentation clock cannot interrupt a physics step.
 *
 * @category Internal
 * @since 1.0.0
 */
export const now = (): number =>
{
    try
    {
        const Value = Date.now();
        return Number.isFinite(Value) ? Value : 0;
    }
    catch
    {return 0;}
};

/**
 * Runs with optional counters and restores nested scopes before notifying the
 * observer. Throwing observers cannot change the returned authoritative result.
 *
 * @category Internal
 * @since 1.0.0
 */
export const observe = <A>(run: () => A, observer?: (metrics: Metrics) => void): A =>
{
    if (!observer)
    {return run();}

    const Previous = active;
    const Sample = empty();
    active = Sample;
    const Started = now();
    try
    {return run();}
    finally
    {
        Sample.totalMs = Math.max(0, now() - Started);
        active = Previous;
        try
        {observer(Object.freeze(Sample));}
        catch
        { /* Observations cannot alter simulation. */ }
    }
};
