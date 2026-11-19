/**
 * Idempotent reverse-order release of spatial runtime, root and audience resources.
 *
 * @module bedform/Spatial/Internal/Scope
 *
 * @file      Scope.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Attempts every registered cleanup once, retaining all failures instead of abandoning later releases.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export class Scope
{
    private Closed: boolean = false;
    private readonly Releases: Set<() => void> = new Set();

    /**
     * Registers cleanup and returns an early idempotent release function.
     *
     * @throws { Error } If this scope has already closed.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Own(cleanup: () => void): () => void
    {
        if (this.Closed)
        {
            throw new Error("Spatial resource scope is disposed.");
        }

        if (typeof cleanup !== "function")
        {
            throw new TypeError("Spatial cleanup must be a function.");
        }

        let active = true;
        const release = (): void =>
        {
            if (!active)
            {
                return;
            }

            active = false;
            this.Releases.delete(release);
            cleanup();
        };

        this.Releases.add(release);
        return release;
    }

    /**
     * Releases all remaining registrations in reverse creation order.
     *
     * @throws { AggregateError } If any cleanup fails, after all releases have been attempted.
     *
     * @category ResourceManagement
     * @since 1.0.0
     */
    Dispose(): void
    {
        if (this.Closed)
        {
            return;
        }

        this.Closed = true;
        const errors: Array<unknown> = [];
        for (const release of [ ...this.Releases ].reverse())
        {
            try
            {
                release();
            }
            catch (error)
            {
                errors.push(error);
            }
        }

        if (errors.length)
        {
            throw new AggregateError(errors, "Spatial resource cleanup failed.");
        }
    }
}
