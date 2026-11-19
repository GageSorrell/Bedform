/**
 * Injectable host clock, timers, console and error reporting behind the vendored React port, so the
 * pinned React, reconciler and scheduler sources run without Node, browser or global polyfills.
 *
 * @module bedform/Spatial/Internal/React/Host
 *
 * @file      Host.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export namespace ReactHost
{
    /**
     * Console methods the vendored sources call; development builds use more than production.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Console
    {
        readonly error: (...data: ReadonlyArray<unknown>) => void;
        readonly warn: (...data: ReadonlyArray<unknown>) => void;
        readonly info: (...data: ReadonlyArray<unknown>) => void;
        readonly log: (...data: ReadonlyArray<unknown>) => void;
        readonly group: (...data: ReadonlyArray<unknown>) => void;
        readonly groupCollapsed: (...data: ReadonlyArray<unknown>) => void;
        readonly groupEnd: () => void;
    }
}

/**
 * Host services for the vendored React port. `Now` and `TickBudget` are milliseconds. `SetTimeout`
 * with a zero delay means "after the current unit of host work", which is the next server tick on
 * Bedrock. The scheduler performs units of work until `TickBudget` milliseconds have elapsed in one
 * host turn, then yields; omitting it keeps upstream's 5 ms or the `unstable_forceFrameRate` value.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactHost
{
    readonly Now: () => number;
    readonly SetTimeout: (callback: () => void, delay: number) => unknown;
    readonly ClearTimeout: (handle: unknown) => void;
    readonly ReportError: (error: unknown) => void;
    readonly Console: ReactHost.Console;
    readonly TickBudget?: number;
}

/**
 * The subset of Minecraft's `System` that `CreateSystemReactHost` schedules with, typed structurally
 * so this module never imports `@minecraft/server`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactHostSystem
{
    readonly run: (callback: () => void) => number;
    readonly runTimeout: (callback: () => void, tickDelay?: number) => number;
    readonly clearRun: (runId: number) => void;
}

/**
 * Optional overrides for `CreateSystemReactHost`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactHostSystemOptions
{
    readonly TickBudget?: number;
    readonly Now?: () => number;
    readonly ReportError?: (error: unknown) => void;
    readonly Console?: ReactHost.Console;
}

/**
 * Upstream build flavor of a vendored module.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReactHostFlavor = "development" | "production";

/**
 * Process stand-in that development and production builds read `NODE_ENV` from.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactHostProcess
{
    readonly env: Readonly<Record<"NODE_ENV", ReactHostFlavor>>;
}

export namespace ReactHostBindings
{
    /**
     * Clock stand-in for upstream's `performance.now()` probes.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Performance
    {
        readonly now: () => number;
    }
}

/**
 * Lexical stand-ins that each generated vendor module passes to its upstream body in place of the
 * host globals it would otherwise read. Globals absent from Bedrock are passed as `undefined`
 * directly by the generated wrapper rather than appearing here.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactHostBindings
{
    readonly process: ReactHostProcess;
    readonly setTimeout: (callback: () => void, delay?: number) => unknown;
    readonly clearTimeout: (handle: unknown) => void;
    readonly performance: ReactHostBindings.Performance;
    readonly reportError: (error: unknown) => void;
    readonly console: ReactHost.Console;
    readonly TickBudget: (upstream: number) => number;
}

/**
 * Bedrock server ticks per real-time second.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TicksPerSecond = 20 as const;

/**
 * Real-time milliseconds per Bedrock server tick.
 *
 * @category Constant
 * @since 1.0.0
 */
export const MillisecondsPerTick: number = 1_000 / TicksPerSecond;

/**
 * Every console method a host must provide.
 *
 * @category Constant
 * @since 1.0.0
 */
const ConsoleMethods: ReadonlyArray<keyof ReactHost.Console> =
    Object.freeze([ "error", "group", "groupCollapsed", "groupEnd", "info", "log", "warn" ] as const);

/**
 * A timer requested before any host was installed; replayed through the first installed host.
 *
 * @category Model
 * @since 1.0.0
 */
interface Deferred
{
    readonly Callback: () => void;
    readonly Delay: number;
    Handle?: Handle;
    Cleared: boolean;
}

/**
 * A timer handle that remembers the host that issued it, so clearing always reaches that host.
 *
 * @category Model
 * @since 1.0.0
 */
interface Handle
{
    readonly Host: ReactHost | undefined;
    readonly Native: unknown;
    readonly Deferred?: Deferred;
}

/**
 * A console method of unknown arity.
 *
 * @category Types
 * @since 1.0.0
 */
type ConsoleMethod = (...data: ReadonlyArray<unknown>) => void;

/**
 * Builds a frozen console whose methods all forward to one function.
 *
 * @category Factory
 * @since 1.0.0
 */
function ForwardingConsole(
    forward: (method: keyof ReactHost.Console, data: ReadonlyArray<unknown>) => void
): ReactHost.Console
{
    const entries = ConsoleMethods.map((method: keyof ReactHost.Console) =>
        [ method, (...data: ReadonlyArray<unknown>): void => forward(method, data) ] as const);
    return Object.freeze(Object.fromEntries(entries) as unknown as ReactHost.Console);
}

/**
 * Console that forwards to the script engine's console when present and otherwise discards output.
 * Bedrock's script engine supplies `console`; it is the only non-ECMAScript global this module reads,
 * and only when a method is called.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EngineReactConsole: ReactHost.Console = ForwardingConsole(
    (method: keyof ReactHost.Console, data: ReadonlyArray<unknown>): void =>
    {
        const engine = typeof console === "object" && console !== null ?
            console as unknown as Partial<Record<keyof ReactHost.Console, ConsoleMethod>> :
            undefined;
        const call = engine?.[method];
        if (typeof call === "function")
        {
            Reflect.apply(call, engine, data);
        }
    });

let Installed: ReactHost | undefined;
let Pending: Array<Deferred> = [];

/**
 * Validates a tick budget in milliseconds.
 *
 * @throws { RangeError } When the budget is present but not a positive finite number.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckTickBudget(budget: unknown): void
{
    if (budget !== undefined && (typeof budget !== "number" || !Number.isFinite(budget) || budget <= 0))
    {
        throw new RangeError("React host TickBudget must be a finite number of milliseconds greater than 0.");
    }
}

/**
 * Validates every member of a host before it is installed.
 *
 * @throws { TypeError } When the host or its console is incomplete.
 * @throws { RangeError } When `TickBudget` is not a positive finite number.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckHost(host: ReactHost): void
{
    if (typeof host !== "object" || host === null ||
        typeof host.Now !== "function" ||
        typeof host.SetTimeout !== "function" ||
        typeof host.ClearTimeout !== "function" ||
        typeof host.ReportError !== "function" ||
        typeof host.Console !== "object" || host.Console === null)
    {
        throw new TypeError("A React host requires Now, SetTimeout, ClearTimeout, ReportError and Console.");
    }

    for (const method of ConsoleMethods)
    {
        if (typeof host.Console[method] !== "function")
        {
            throw new TypeError(`A React host Console requires a ${method} method.`);
        }
    }

    CheckTickBudget(host.TickBudget);
}

/**
 * Returns the installed host, or undefined while timers are still being deferred.
 *
 * @category Accessor
 * @since 1.0.0
 */
export function GetReactHost(): ReactHost | undefined
{
    return Installed;
}

/**
 * Installs the single host used by every vendored React module in this script environment. Timers
 * requested before installation are replayed through it in request order. Returns an idempotent
 * function that uninstalls this host; later timers are then deferred again until the next install.
 *
 * @throws { TypeError } When the host is incomplete.
 * @throws { RangeError } When `TickBudget` is not a positive finite number.
 * @throws { Error } When another host is already installed.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export function InstallReactHost(host: ReactHost): () => void
{
    CheckHost(host);
    if (Installed !== undefined)
    {
        throw new Error("A React host is already installed; uninstall it before installing another.");
    }

    Installed = host;
    const replay = Pending;
    Pending = [];
    for (const deferred of replay)
    {
        if (!deferred.Cleared)
        {
            deferred.Handle = {
                Host: host,
                Native: host.SetTimeout(deferred.Callback, deferred.Delay)
            };
        }
    }

    let active = true;
    return (): void =>
    {
        if (active && Installed === host)
        {
            Installed = undefined;
        }

        active = false;
    };
}

/**
 * Creates a host that schedules on a Minecraft `System`. A zero delay runs on the next tick through
 * `run`; positive delays round up to whole ticks through `runTimeout`; clearing uses `clearRun`. The
 * clock defaults to `Date.now`, errors to the console's `error` and output to the engine console.
 *
 * @throws { TypeError } When the system lacks `run`, `runTimeout` or `clearRun`.
 * @throws { RangeError } When `TickBudget` is not a positive finite number.
 *
 * @category Factory
 * @since 1.0.0
 */
export function CreateSystemReactHost(
    system: ReactHostSystem,
    options: ReactHostSystemOptions = {}
): ReactHost
{
    if (typeof system !== "object" || system === null ||
        typeof system.run !== "function" ||
        typeof system.runTimeout !== "function" ||
        typeof system.clearRun !== "function")
    {
        throw new TypeError("CreateSystemReactHost requires a System with run, runTimeout and clearRun.");
    }

    CheckTickBudget(options.TickBudget);
    const output = options.Console ?? EngineReactConsole;
    return Object.freeze({
        ClearTimeout: (handle: unknown): void =>
        {
            if (typeof handle === "number")
            {
                system.clearRun(handle);
            }
        },
        Console: output,
        Now: options.Now ?? ((): number => Date.now()),
        ReportError: options.ReportError ?? ((error: unknown): void => output.error(error)),
        SetTimeout: (callback: () => void, delay: number): number =>
        {
            const ticks = Number.isFinite(delay) && delay > 0 ? Math.ceil(delay / MillisecondsPerTick) : 0;
            return ticks === 0 ? system.run(callback) : system.runTimeout(callback, ticks);
        },
        TickBudget: options.TickBudget
    });
}

/**
 * Schedules through the installed host, or defers the request until one is installed.
 *
 * @category Scheduling
 * @since 1.0.0
 */
function SetTimeout(callback: () => void, delay?: number): Handle
{
    const milliseconds = typeof delay === "number" && Number.isFinite(delay) && delay > 0 ? delay : 0;
    if (Installed !== undefined)
    {
        return {
            Host: Installed,
            Native: Installed.SetTimeout(callback, milliseconds)
        };
    }

    const deferred: Deferred = {
        Callback: callback,
        Cleared: false,
        Delay: milliseconds
    };
    Pending.push(deferred);
    return {
        Deferred: deferred,
        Host: undefined,
        Native: undefined
    };
}

/**
 * Clears a timer through the host that issued it, including deferred and replayed timers.
 *
 * @category Scheduling
 * @since 1.0.0
 */
function ClearTimeout(handle: unknown): void
{
    if (typeof handle !== "object" || handle === null)
    {
        return;
    }

    const timer = handle as Handle;
    if (timer.Deferred !== undefined)
    {
        timer.Deferred.Cleared = true;
        const replayed = timer.Deferred.Handle;
        if (replayed?.Host !== undefined)
        {
            replayed.Host.ClearTimeout(replayed.Native);
        }

        return;
    }

    timer.Host?.ClearTimeout(timer.Native);
}

/**
 * Console stand-in that resolves the installed host on every call.
 *
 * @category Constant
 * @since 1.0.0
 */
const HostConsole: ReactHost.Console = ForwardingConsole(
    (method: keyof ReactHost.Console, data: ReadonlyArray<unknown>): void =>
    {
        const output = Installed?.Console ?? EngineReactConsole;
        Reflect.apply(output[method], output, data);
    });

/**
 * `process` stand-ins by flavor.
 *
 * @category Constant
 * @since 1.0.0
 */
const Processes: Readonly<Record<ReactHostFlavor, ReactHostProcess>> = Object.freeze({
    development: Object.freeze({ env: Object.freeze({ NODE_ENV: "development" as const }) }),
    production: Object.freeze({ env: Object.freeze({ NODE_ENV: "production" as const }) })
});

/**
 * Flavor-independent stand-ins.
 *
 * @category Constant
 * @since 1.0.0
 */
const Shared: Omit<ReactHostBindings, "process"> = Object.freeze({
    TickBudget: (upstream: number): number => Installed?.TickBudget ?? upstream,
    clearTimeout: ClearTimeout,
    console: HostConsole,
    performance: Object.freeze({ now: (): number => (Installed?.Now ?? Date.now)() }),
    reportError: (error: unknown): void =>
    {
        if (Installed === undefined)
        {
            EngineReactConsole.error(error);
        }
        else
        {
            Installed.ReportError(error);
        }
    },
    setTimeout: SetTimeout
});

/**
 * Returns the frozen lexical stand-ins a generated vendor module of the given flavor passes to its
 * upstream body. Every stand-in resolves the installed host when called, never when imported.
 *
 * @category Factory
 * @since 1.0.0
 */
export function Bindings(flavor: ReactHostFlavor): ReactHostBindings
{
    return Object.freeze({
        ...Shared,
        process: Processes[flavor]
    });
}
