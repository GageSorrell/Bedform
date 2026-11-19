/**
 * Typed, optional access to host globals that the Effect runtime uses when a
 * host provides them. Bedrock's script engine provides none of the timer,
 * performance, crypto or abort APIs, so every caller must handle their absence.
 *
 * @module @bedform/effect/Internal/host
 *
 * @file      host.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host global names are fixed by the platforms that define them. */

/**
 * A console as far as the runtime's default `Console` service needs it.
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface HostConsole
{
    log(...args: ReadonlyArray<unknown>): void;
    warn?(...args: ReadonlyArray<unknown>): void;
}

/**
 * Optional host globals read by the runtime. None of them is installed or
 * modified by `@bedform/effect`.
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface HostGlobals
{
    readonly setTimeout?: (callback: () => void, millis: number) => unknown;
    readonly clearTimeout?: (handle: unknown) => void;
    readonly setImmediate?: (callback: () => void) => unknown;
    readonly clearImmediate?: (handle: unknown) => void;
    readonly performance?: HostGlobals.Performance;
    readonly crypto?: HostGlobals.Crypto;
    readonly console?: HostConsole;
    readonly AbortController?: new () => unknown;
}

export namespace HostGlobals
{
    /**
     * A monotonic high-resolution clock.
     *
     * @category Utilities
     * @since 1.0.0
     */
    export interface Performance
    {
        now(): number;
    }

    /**
     * A source of cryptographically secure random values.
     *
     * @category Utilities
     * @since 1.0.0
     */
    export interface Crypto
    {
        getRandomValues<T extends Uint8Array | Uint32Array>(array: T): T;
    }
}

/**
 * The global object, viewed through the optional host globals above.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Host: HostGlobals = globalThis as HostGlobals;
