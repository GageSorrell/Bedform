/**
 * Shared numerical helpers for pure static geometry.
 *
 * @module bedform/Internal/Geometry
 *
 * @file      Geometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as N from "@bedform/effect/Number";

/**
 * Finite nonnegative absolute and relative tolerances; omitted fields default to 1e-9.
 *
 * @category Types
 * @since 1.0.0
 */
export interface QueryOptions
{
    readonly absoluteTolerance?: number;
    readonly relativeTolerance?: number;
}

/**
 * Validates tolerance fields without changing caller-owned options.
 *
 * @category Internal
 * @since 1.0.0
 */
export const validOptions = (options: QueryOptions): boolean =>
{
    if (typeof options !== "object" || options === null)
    {
        return false;
    }

    return [ options.absoluteTolerance === undefined ? 1e-9 : options.absoluteTolerance,
        options.relativeTolerance === undefined ? 1e-9 : options.relativeTolerance ]
        .every((value: number) => N.Number.isFinite(value) && value >= 0);
};

/**
 * Tests abs(value)<=absolute+relative*scale without overflowing the threshold.
 *
 * @category Internal
 * @since 1.0.0
 */
export const withinTolerance = (value: number, scale: number, options: QueryOptions): boolean =>
{
    const Absolute = options.absoluteTolerance ?? 1e-9;
    const Relative = options.relativeTolerance ?? 1e-9;
    const Magnitude = N.abs(value);
    return Magnitude <= Absolute || (scale > 0 && (Magnitude - Absolute) / scale <= Relative);
};

/**
 * Tests self<=that with abs+relative*max(abs(self),abs(that)) contact tolerance, even when
 * subtraction of finite coordinates overflows. Callers validate options before use.
 *
 * @category Internal
 * @since 1.0.0
 */
export const lessOrNear = (self: number, that: number, options: QueryOptions): boolean =>
{
    if (self <= that)
    {
        return true;
    }

    const Scale = N.max(N.abs(self), N.abs(that));
    const Difference = self - that;
    return N.Number.isFinite(Difference) ? withinTolerance(Difference, Scale, options) :
        (self / Scale - that / Scale) <= (options.absoluteTolerance ?? 1e-9) / Scale +
            (options.relativeTolerance ?? 1e-9);
};

/**
 * Sums finite terms using scaled compensated addition, preserving cancellation without overflow.
 * Nonfinite terms or unrepresentable final results propagate as nonfinite numbers.
 *
 * @category Internal
 * @since 1.0.0
 */
export const sum = (values: ReadonlyArray<number>): number =>
{
    const Scale = values.reduce((maximum: number, value: number) => N.max(maximum, N.abs(value)), 0);
    if (Scale === 0)
    {
        return 0;
    }

    let total = 0;
    let correction = 0;
    for (const Value of values)
    {
        const Scaled = Value / Scale;
        const Next = total + Scaled;
        correction += N.abs(total) >= N.abs(Scaled) ? (total - Next) + Scaled : (Scaled - Next) + total;
        total = Next;
    }

    return (total + correction) * Scale;
};
