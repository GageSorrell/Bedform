/**
 * Bounded chunk readiness polling shared by the client fixture and host checks.
 *
 * @module bedform/Test/Engine/readiness
 *
 * @file      readiness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Explicit scheduler and readiness callbacks; no engine import or subscriptions.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Readiness
{
    readonly probe: () => boolean;
    readonly schedule: (callback: () => void, ticks: number) => void;
    readonly ready: () => void;
    readonly failed: (message: string) => void;
}

/**
 * Waits up to 120 probes spaced five ticks apart. A thrown unloaded-chunk query
 * is retried just like an unavailable block; initialization is called only once.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const waitForLoadedRegion = (options: Readiness): void =>
{
    let attempts = 0;
    let lastError = "Unavailable block";
    const Probe = (): void =>
    {
        let loaded = false;
        attempts++;
        try
        {
            loaded = options.probe();
        }
        catch (error)
        {
            lastError = String(error);
        }

        if (loaded)
        {
            options.ready();
        }
        else if (attempts >= 120)
        {
            options.failed(`Fixture chunks did not become available after ${attempts} probes: ${lastError}`);
        }
        else
        {
            options.schedule(Probe, 5);
        }
    };

    Probe();
};
