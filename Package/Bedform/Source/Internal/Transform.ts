/**
 * Shared pure pose and motion interpolation helpers.
 *
 * @module bedform/Internal/Transform
 *
 * @file      Transform.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as N from "@bedform/effect/Number";

/**
 * Interpolates finite scalars with Number lerp, avoiding avoidable intermediate overflow.
 *
 * @category Internal
 * @since 1.0.0
 */
export const interpolateComponent = (self: number, that: number, t: number): number =>
{
    if (t === 0 || self === that)
    {
        return self;
    }

    if (t === 1)
    {
        return that;
    }

    const Direct = N.lerp(self, that, t);
    if (N.Number.isFinite(Direct))
    {
        return Direct;
    }

    const Weighted = self * (1 - t) + that * t;
    if (N.Number.isFinite(Weighted))
    {
        return Weighted;
    }

    const Maximum = N.max(N.abs(self), N.abs(that));
    return Maximum === 0 ? 0 : N.lerp(self / Maximum, that / Maximum, t) * Maximum;
};

