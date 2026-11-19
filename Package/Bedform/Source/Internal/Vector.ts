/**
 * Shared stable vector algorithms and Effect-based component formatting.
 *
 * @module bedform/Internal/Vector
 *
 * @file      Vector.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Formatter from "@bedform/effect/Formatter";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";

/**
 * Combines scalar hypot operations without squaring components.
 *
 * @category Internal
 * @since 1.0.0
 */
const length = (values: ReadonlyArray<number>): number =>
{
    return values.reduce((total: number, value: number) => N.hypot(total, value), 0);
};

/**
 * Finds the largest absolute component without overflowing.
 *
 * @category Internal
 * @since 1.0.0
 */
const largest = (values: ReadonlyArray<number>): number =>
{
    return values.reduce((total: number, value: number) => N.max(total, N.abs(value)), 0);
};

/**
 * Normalizes finite nonzero components after dividing by their largest magnitude.
 *
 * @category Internal
 * @since 1.0.0
 */
export const normalizeComponents = (values: ReadonlyArray<number>): Option.Option<ReadonlyArray<number>> =>
{
    if (!values.every(N.Number.isFinite))
    {
        return Option.none();
    }

    const Maximum = largest(values);
    if (Maximum === 0)
    {
        return Option.none();
    }

    const Scaled = values.map((value: number) => value / Maximum);
    const Magnitude = length(Scaled);
    return Option.some(Scaled.map((value: number) => value / Magnitude));
};

/**
 * Computes a three-dimensional cross product on normalized component arrays.
 *
 * @category Internal
 * @since 1.0.0
 */
const cross = (self: ReadonlyArray<number>, that: ReadonlyArray<number>): ReadonlyArray<number> =>
{
    return [ self[1] * that[2] - self[2] * that[1], self[2] * that[0] - self[0] * that[2],
        self[0] * that[1] - self[1] * that[0] ];
};

/**
 * Interpolates a two- or three-dimensional direction and a linearly varying magnitude.
 *
 * @category Internal
 * @since 1.0.0
 */
export const slerpComponents = (self: ReadonlyArray<number>,
    that: ReadonlyArray<number>,
    t: number): Option.Option<ReadonlyArray<number>> =>
{
    const First = normalizeComponents(self);
    const Second = normalizeComponents(that);
    if (!N.Number.isFinite(t) || Option.isNone(First) || Option.isNone(Second))
    {
        return Option.none();
    }

    if (t === 0)
    {
        return Option.some([ ...self ]);
    }

    if (t === 1)
    {
        return Option.some([ ...that ]);
    }

    const A = First.value;
    const B = Second.value;
    const Dot = N.clamp(A.reduce((sum: number,
        value: number,
        index: number) => sum + value * B[index],
    0),
    { maximum: 1,

        minimum: -1 });
    let Tangent: ReadonlyArray<number>;
    let Sine: number;
    if (A.length === 2)
    {
        const Determinant = A[0] * B[1] - A[1] * B[0];
        Sine = N.abs(Determinant);
        const Sign = Determinant < 0 ? -1 : 1;
        Tangent = [ -A[1] * Sign, A[0] * Sign ];
    }
    else
    {
        const Normal = cross(A, B);
        Sine = length(Normal);
        let UnitNormal = normalizeComponents(Normal);
        if (Option.isNone(UnitNormal))
        {
            // For antipodes, choose the least-aligned positive axis; ties prefer X, then Y.
            let Index = 0;
            for (let index = 1; index < 3; index++)
            {
                if (N.abs(A[index]) < N.abs(A[Index]))
                {
                    Index = index;
                }
            }

            const Axis = [ 0, 0, 0 ];
            Axis[Index] = 1;
            UnitNormal = normalizeComponents(cross(A, cross(Axis, A)));
        }

        if (Option.isNone(UnitNormal))
        {
            return Option.none();
        }

        Tangent = cross(UnitNormal.value, A);
    }

    const Theta = N.atan2(Sine, Dot);
    const C = N.cos(Theta * t);
    const S = N.sin(Theta * t);
    const Direction = normalizeComponents(A.map((value: number,
        index: number) => value * C + Tangent[index] * S));
    if (Option.isNone(Direction))
    {
        return Option.none();
    }

    const CommonScale = N.max(largest(self), largest(that));
    const FirstLength = length(self.map((value: number) => value / CommonScale));
    const SecondLength = length(that.map((value: number) => value / CommonScale));
    const Magnitude = N.lerp(FirstLength, SecondLength, t);
    const Result = Direction.value.map((value: number) => (value * Magnitude) * CommonScale);
    return Result.every(N.Number.isFinite) ? Option.some(Result) : Option.none();
};

/**
 * Formats scalars with Effect, optionally applying native fixed decimal precision.
 * Invalid decimal precision propagates the native formatting error.
 *
 * @throws { RangeError } Decimal precision is outside the native toFixed range.
 *
 * @category Internal
 * @since 1.0.0
 */
export const formatComponents = (values: ReadonlyArray<number>,
    decimals?: number,
    delimiter: string = ", "): string =>
{
    return values.map((value: number) =>
        decimals === undefined ? Formatter.format(value) : value.toFixed(decimals)).join(delimiter);
};

/**
 * Parses complete finite decimal fields; rejects empty separators and trailing text.
 *
 * @category Internal
 * @since 1.0.0
 */
export const parseComponents = (text: string,
    count: number,
    delimiter: string = ","): Option.Option<ReadonlyArray<number>> =>
{
    if (delimiter.length === 0)
    {
        return Option.none();
    }

    const Fields = text.split(delimiter).map((field: string) => field.trim());
    if (Fields.length !== count ||
        !Fields.every((field: string) => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(field)))
    {
        return Option.none();
    }

    const Values = Fields.map((field: string) => N.Number(field));
    return Values.every(N.Number.isFinite) ? Option.some(Values) : Option.none();
};
