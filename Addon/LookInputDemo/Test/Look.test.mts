/**
 * Boundary cases for the displayed rotation measurement.
 *
 * @module @sorrell/look-input-demo/Test/Look.test
 *
 * @file      Look.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { AngleDelta, Fraction, MeasureLook } from "../Script/Look.js";
import assert from "node:assert/strict";
import { test } from "node:test";
test("fractional values truncate toward zero and retain exactly three digits", () =>
{
    assert.equal(Fraction(0.52999), "0.529");
    assert.equal(Fraction(-0.28199), "-0.281");
    assert.equal(Fraction(-0.0009), "0.000");
    assert.equal(Fraction(1), "1.000");
});
test("crossing the yaw seam measures a short turn in either direction", () =>
{
    assert.equal(AngleDelta(-179, 179), 2);
    assert.equal(AngleDelta(179, -179), -2);
    assert.equal(AngleDelta(720, 0), 0);
});

test("delayed client correction is excluded from measured input in both pitch directions", () =>
{
    for (const sign of [ -1, 1 ])
    {
        const state = { previousRotation: { x: 84 * sign,
            y: 179 },
        resetPendingTicks: 0,
        yawOrigin: 179 };
        const edge = MeasureLook(state, { x: 89.9999 * sign,
            y: -179 });
        assert.deepEqual(edge.resetRotation, { x: 0,
            y: -179 });
        assert.equal(Fraction(edge.delta.y), sign > 0 ? "5.999" : "-5.999");
        assert.equal(edge.delta.x, 2);
        for (let tick = 0; tick < 3; tick++)
        {
            const stale = MeasureLook(state, { x: 89.9999 * sign,
                y: -179 });
            assert.equal(stale.delta.y, edge.delta.y);
            assert.equal(stale.estimated, true);
            assert.equal(stale.resetRotation, undefined);
        }

        assert.equal(MeasureLook(state, { x: 0,
            y: -179 }).delta.y, edge.delta.y);
        assert.equal(state.resetPendingTicks, 0);
        for (let tick = 1; tick <= 6; tick++)
        {
            const sample = MeasureLook(state, { x: 2 * tick * sign,
                y: -179 });
            if (tick === 6)
            {
                assert.equal(sample.delta.y, 2 * sign);
            }
        }
    }
});

test("unconfirmed correction retries after ten ticks instead of every tick", () =>
{
    const state = { previousRotation: { x: 0,
        y: 30 },
    resetPendingTicks: 0,
    yawOrigin: 30 };
    assert.ok(MeasureLook(state, { x: 89,
        y: 30 }).resetRotation);
    for (let tick = 1; tick < 10; tick++)
    {
        assert.equal(MeasureLook(state, { x: 89,
            y: 30 }).resetRotation, undefined);
    }

    const retry = MeasureLook(state, { x: 89,
        y: 31 });
    assert.deepEqual(retry.resetRotation, { x: 0,
        y: 31 });
    assert.ok(retry.delta.y > 0 && retry.delta.y < 89);
    assert.equal(retry.estimated, true);
});

test("yaw resets relative to activation in both directions and across the world-angle seam", () =>
{
    for (const origin of [ 0, 170, -170 ])
    {
        for (const sign of [ -1, 1 ])
        {
            const state = { previousRotation: { x: 20,
                y: origin + 33 * sign },
            resetPendingTicks: 0,
            yawOrigin: origin };
            for (const offset of [ 36, 39, 42 ])
            {
                MeasureLook(state, { x: 20,
                    y: AngleDelta(origin + offset * sign, 0) });
            }

            const near = MeasureLook(state, { x: 20,
                y: AngleDelta(origin + 44.9 * sign, 0) });
            assert.equal(near.resetRotation, undefined);
            const edge = MeasureLook(state, { x: 20,
                y: AngleDelta(origin + 45 * sign, 0) });
            assert.deepEqual(edge.resetRotation, { x: 20,
                y: origin });
            assert.ok(Math.abs(edge.delta.x - 2.95 * sign) < 0.00001);
            const stale = MeasureLook(state, { x: 21,
                y: AngleDelta(origin + 46 * sign, 0) });
            assert.equal(stale.delta.x, edge.delta.x);
            assert.equal(stale.delta.y, 1);
            const corrected = MeasureLook(state, { x: 22,
                y: origin });
            assert.equal(corrected.delta.x, edge.delta.x);
            assert.equal(corrected.delta.y, 1);
            assert.equal(state.resetPendingTicks, 0);
            for (let tick = 1; tick <= 6; tick++)
            {
                const sample = MeasureLook(state, { x: 22,
                    y: origin + tick * sign });
                if (tick === 6)
                {
                    assert.equal(sample.delta.x, sign);
                }
            }
        }
    }
});

test("simultaneous pitch and yaw resets recover each axis independently", () =>
{
    const state = { previousRotation: { x: 84,
        y: 44 },
    resetPendingTicks: 0,
    yawOrigin: 0 };
    assert.deepEqual(MeasureLook(state, { x: 89,
        y: 46 }).resetRotation, { x: 0,
        y: 0 });
    assert.deepEqual(MeasureLook(state, { x: 0,
        y: 46 }).delta, { x: 2,
        y: 5 });
    assert.deepEqual(MeasureLook(state, { x: 2,
        y: 0 }).delta, { x: 2,
        y: 5 });
    assert.equal(state.resetPendingTicks, 0);
});

test("constant-speed yaw input survives stale, corrected, and ramping client samples", () =>
{
    for (const sign of [ -1, 1 ])
    {
        const state = { previousRotation: { x: 0,
            y: 30 * sign },
        resetPendingTicks: 0,
        yawOrigin: 0 };
        for (const yaw of [ 33, 36, 39, 42, 45 ])
        {
            assert.equal(MeasureLook(state, { x: 0,
                y: yaw * sign }).delta.x, 3 * sign);
        }

        // Stale reports, teleport acknowledgment, then the observed acceleration ramp.
        for (const yaw of [ 45, 45, 0, 0, 0.3, 1.2 ])
        {
            const sample = MeasureLook(state, { x: 0,
                y: yaw * sign });
            assert.equal(sample.delta.x, 3 * sign);
            assert.equal(sample.estimated, true);
        }

        const settled = MeasureLook(state, { x: 0,
            y: 4.2 * sign });
        assert.ok(Math.abs(settled.delta.x - 3 * sign) < 0.00001);
        assert.equal(settled.estimated, false);
    }
});

test("release after a wrap decays to zero and a recovered reversal takes effect immediately", () =>
{
    const state = { previousRotation: { x: 0,
        y: 30 },
    resetPendingTicks: 0,
    yawOrigin: 0 };
    for (const yaw of [ 33, 36, 39, 42, 45, 45, 0 ])
    {
        MeasureLook(state, { x: 0,
            y: yaw });
    }

    for (let tick = 0; tick < 8; tick++)
    {
        const sample = MeasureLook(state, { x: 0,
            y: 0 });
        if (tick === 7)
        {
            assert.equal(sample.delta.x, 0);
            assert.equal(sample.estimated, false);
        }
    }

    for (const yaw of [ 30, 33, 36, 39, 42, 45, 45, 0 ])
    {
        MeasureLook(state, { x: 0,
            y: yaw });
    }

    const reversed = MeasureLook(state, { x: 0,
        y: -2 });
    assert.equal(reversed.delta.x, -2);
    assert.equal(reversed.estimated, false);
});

test("constant-speed pitch input survives limit clipping and post-teleport ramping", () =>
{
    for (const sign of [ -1, 1 ])
    {
        const state = { previousRotation: { x: 70 * sign,
            y: 0 },
        resetPendingTicks: 0,
        yawOrigin: 0 };
        for (const pitch of [ 73, 76, 79, 82, 89.9999 ])
        {
            // Even a clipped/batched edge sample should use the preceding constant-speed estimate.
            assert.equal(MeasureLook(state, { x: pitch * sign,
                y: 0 }).delta.y, 3 * sign);
        }

        for (const pitch of [ 89.9999, 89.9999, 0, 0, 0.3, 1.2 ])
        {
            const sample = MeasureLook(state, { x: pitch * sign,
                y: 0 });
            assert.equal(sample.delta.y, 3 * sign);
            assert.equal(sample.estimated, true);
        }

        const settled = MeasureLook(state, { x: 4.2 * sign,
            y: 0 });
        assert.ok(Math.abs(settled.delta.y - 3 * sign) < 0.00001);
        assert.equal(settled.estimated, false);
    }
});

test("an unacknowledged correction cannot extrapolate nonzero input forever", () =>
{
    const state = { previousRotation: { x: 0,
        y: 30 },
    resetPendingTicks: 0,
    yawOrigin: 0 };
    for (const yaw of [ 33, 36, 39, 42, 45 ])
    {
        MeasureLook(state, { x: 0,
            y: yaw });
    }

    for (let tick = 0; tick < 25; tick++)
    {
        const sample = MeasureLook(state, { x: 0,
            y: 45 });
        if (tick >= 16)
        {
            assert.equal(sample.delta.x, 0);
        }
    }
});
