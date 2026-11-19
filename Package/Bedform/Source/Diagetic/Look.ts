/**
 * Shared rotation measurement, wrap correction and bounded correction-gap estimation.
 *
 * @module bedform/Diagetic/Look
 *
 * @file      Look.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Vector2 } from "@minecraft/server";

export namespace LookState
{
    /**
     * Recent measured velocity and bounded extrapolation during a rotation correction.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface Axis
    {
        history: Array<number>;
        velocity: number;
        estimatedTicks: number;
        recoveryTicks: number;
    }
}

/**
 * Rotation samples, activation yaw, and independent wrap-recovery estimators.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LookState
{
    previousRotation: Vector2;
    resetPendingTicks: number;
    yawOrigin: number;
    pendingPitchReset?: boolean;
    pendingYawReset?: boolean;
    horizontal?: LookState.Axis;
    vertical?: LookState.Axis;
}

/**
 * A rotation delta, an approximation marker, and an optional teleport correction.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LookSample
{
    delta: Vector2;
    estimated: boolean;
    resetRotation?: Vector2;
}

interface AxisSample
{
    value: number;
    estimated: boolean;
}

/**
 * Tracks ordinary measurements and bridges corrections with recent weighted velocity.
 * Estimates hold for eight ticks, then decay to zero by sixteen ticks if no recovery arrives.
 * After recovery, six ticks allow client input to settle; a reversal or converged sample
 * resumes direct measurement immediately.
 *
 * @category Mapping
 * @since 1.0.0
 */
const SampleAxis = (axis: LookState.Axis, raw: number, resetting: boolean,
    pendingBefore: boolean, pendingAfter: boolean): AxisSample =>
{
    if (resetting && !pendingBefore)
    {
        let total = 0;
        let weight = 0;
        for (let index = 0; index < axis.history.length; index++)
        {
            total += axis.history[index] * (index + 1);
            weight += index + 1;
        }

        axis.velocity = weight > 0 ? total / weight : raw;
        if (Math.abs(axis.velocity) < 0.001 || axis.velocity * raw < 0)
        {
            axis.velocity = raw;
        }

        axis.estimatedTicks = 0;
        axis.recoveryTicks = 6;
        return { estimated: true,
            value: axis.velocity };
    }

    if (pendingBefore || axis.recoveryTicks > 0)
    {
        axis.estimatedTicks++;
        const attenuation = Math.max(0, Math.min(1, (16 - axis.estimatedTicks) / 8));
        const predicted = axis.velocity * attenuation;
        if (pendingBefore)
        {
            if (!pendingAfter)
            {
                axis.recoveryTicks = 6;
            }

            return { estimated: true,
                value: predicted };
        }

        const reversed = raw * axis.velocity < 0 && Math.abs(raw) > 0.01;
        const converged = Math.abs(raw - axis.velocity) <= Math.max(0.01, Math.abs(axis.velocity) * 0.2);
        if (reversed || converged || Math.abs(axis.velocity) < 0.001)
        {
            axis.recoveryTicks = 0;
            axis.history = [];
        }
        else
        {
            axis.recoveryTicks--;
            const measuredWeight = Math.max(0, (3 - axis.recoveryTicks) / 3);
            if (axis.recoveryTicks > 0)
            {
                return { estimated: true,
                    value: predicted * (1 - measuredWeight) + raw * measuredWeight };
            }

            axis.history = [];
        }
    }

    axis.history.push(raw);
    if (axis.history.length > 3)
    {
        axis.history.shift();
    }

    return { estimated: false,
        value: raw };
};

/**
 * Measures rotation deltas and requests pitch or yaw recentering at their respective limits.
 * Reconstructs correction gaps from recent per-axis velocity, then blends back to measurement.
 *
 * @category Mapping
 * @since 1.0.0
 */
export const MeasureLook = (state: LookState, current: Vector2): LookSample =>
{
    const horizontal = AngleDelta(current.y, state.previousRotation.y);
    const vertical = current.x - state.previousRotation.x;
    const yawOffset = AngleDelta(current.y, state.yawOrigin);
    const pitchPendingBefore = state.pendingPitchReset ?? false;
    const yawPendingBefore = state.pendingYawReset ?? false;
    if (state.pendingPitchReset)
    {
        state.pendingPitchReset = Math.abs(current.x) > 45;
    }

    if (state.pendingYawReset)
    {
        state.pendingYawReset = Math.abs(yawOffset) > 22.5;
    }

    state.resetPendingTicks = Math.max(0, state.resetPendingTicks - 1);
    const resetPitch = !state.pendingPitchReset && Math.abs(current.x) >= 85;
    const resetYaw = !state.pendingYawReset && Math.abs(yawOffset) >= 45;
    const retry = state.resetPendingTicks === 0 &&
        (state.pendingPitchReset || state.pendingYawReset);
    state.previousRotation = current;
    state.horizontal ??= { estimatedTicks: 0,
        history: [],
        recoveryTicks: 0,
        velocity: 0 };
    state.vertical ??= { estimatedTicks: 0,
        history: [],
        recoveryTicks: 0,
        velocity: 0 };
    const resetting = resetPitch || resetYaw;
    const horizontalSample = SampleAxis(state.horizontal, horizontal, resetting,
        yawPendingBefore, Boolean(state.pendingYawReset));
    const verticalSample = SampleAxis(state.vertical, vertical, resetting,
        pitchPendingBefore, Boolean(state.pendingPitchReset));
    const delta = { x: horizontalSample.value,
        y: verticalSample.value };
    const estimated = horizontalSample.estimated || verticalSample.estimated;
    if (resetPitch || resetYaw || retry)
    {
        state.pendingPitchReset ||= resetPitch;
        state.pendingYawReset ||= resetYaw;
        state.resetPendingTicks = 10;
        return { delta,
            estimated,
            resetRotation: { x: state.pendingPitchReset ? 0 : current.x,
                y: state.pendingYawReset ? state.yawOrigin : current.y } };
    }

    if (!state.pendingPitchReset && !state.pendingYawReset)
    {
        state.resetPendingTicks = 0;
    }

    return { delta,
        estimated };
};

/**
 * Wraps an angular difference to the shortest signed turn in degrees.
 *
 * @category Converting
 * @since 1.0.0
 */
export const AngleDelta = (current: number, previous: number): number =>
{
    return ((current - previous + 180) % 360 + 360) % 360 - 180;
};

/**
 * Truncates toward zero to exactly three fractional digits, suppressing negative zero.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const Fraction = (value: number): string =>
{
    return (Math.trunc(value * 1_000) / 1_000).toFixed(3);
};
