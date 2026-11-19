/**
 * A structural abort signal and a private fallback controller for hosts, such
 * as Bedrock's script engine, that do not define `AbortController`. Hosts that
 * do define it keep using their own implementation. Nothing is installed on the
 * global object.
 *
 * @module @bedform/effect/Internal/abort
 *
 * @file      abort.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Host } from "./host.js";

/**
 * The part of the standard `AbortSignal` that the Effect runtime produces and
 * consumes. A standard signal from any host satisfies it.
 *
 * @category Models
 * @since 1.0.0
 */
export interface AbortSignal
{
    readonly aborted: boolean;
    readonly reason: unknown;
    addEventListener(type: "abort", listener: () => void, options?: AbortSignal.ListenerOptions): void;
    removeEventListener(type: "abort", listener: () => void): void;
    throwIfAborted(): void;
}

export namespace AbortSignal
{
    /**
     * Options accepted when an abort listener is added.
     *
     * @category Models
     * @since 1.0.0
     */
    export interface ListenerOptions
    {
        readonly once?: boolean;
    }
}

/**
 * Controls an `AbortSignal`.
 *
 * @category Models
 * @since 1.0.0
 */
export interface AbortController
{
    readonly signal: AbortSignal;
    abort(reason?: unknown): void;
}

/**
 * An error that carries the default abort reason, matching the standard
 * `AbortError` name.
 *
 * @category Errors
 * @since 1.0.0
 */
class AbortError extends Error
{
    public constructor()
    {
        super("This operation was aborted");
        this.name = "AbortError";
    }
}

/**
 * A registered abort listener.
 *
 * @category Models
 * @since 1.0.0
 */
interface ListenerEntry
{
    readonly listener: () => void;
    readonly once: boolean;
}

/**
 * Private abort signal used only when the host has no `AbortController`.
 *
 * @category Models
 * @since 1.0.0
 */
class FallbackAbortSignal implements AbortSignal
{
    public aborted: boolean = false;

    public reason: unknown = undefined;

    private readonly listeners: Array<ListenerEntry> = [];

    public addEventListener(_type: "abort", listener: () => void, options?: AbortSignal.ListenerOptions): void
    {
        if (!this.listeners.some((entry: ListenerEntry): boolean => entry.listener === listener))
        {
            this.listeners.push({ listener,
                once: options?.once === true });
        }
    }

    public removeEventListener(_type: "abort", listener: () => void): void
    {
        const index: number = this.listeners.findIndex(
            (entry: ListenerEntry): boolean => entry.listener === listener
        );
        if (index !== -1)
        {
            this.listeners.splice(index, 1);
        }
    }

    public throwIfAborted(): void
    {
        if (this.aborted)
        {
            throw this.reason;
        }
    }

    public dispatch(reason: unknown): void
    {
        if (this.aborted)
        {
            return;
        }

        this.aborted = true;
        this.reason = reason === undefined ? new AbortError() : reason;
        const listeners = this.listeners.slice();
        for (const entry of listeners)
        {
            if (entry.once)
            {
                this.removeEventListener("abort", entry.listener);
            }

            entry.listener();
        }
    }
}

/**
 * Private abort controller used only when the host has no `AbortController`.
 *
 * @category Models
 * @since 1.0.0
 */
class FallbackAbortController implements AbortController
{
    public readonly signal: FallbackAbortSignal = new FallbackAbortSignal();

    public abort(reason?: unknown): void
    {
        this.signal.dispatch(reason);
    }
}

/**
 * Creates the host's `AbortController` when it has one, and the private
 * fallback otherwise.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeAbortController = (): AbortController =>
{
    const HostAbortController = Host.AbortController as (new () => AbortController) | undefined;
    return HostAbortController === undefined ? new FallbackAbortController() : new HostAbortController();
};
