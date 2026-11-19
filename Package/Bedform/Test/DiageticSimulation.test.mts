/**
 * Deterministic projection, constrained geometry, weighted settling and circular-input qualification.
 *
 * @module bedform/Test/DiageticSimulation.test
 *
 * @file      DiageticSimulation.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Independent geometric fixtures retain contextual inference and physical coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "bedform/Diagetic";
import Assert from "node:assert/strict";
import type { Entity } from "@minecraft/server";
import { test } from "node:test";

type Motion = D.Simulation.Controller;
const Degrees = 180 / Math.PI;

/**
 * Supplies a front-facing unit mounting plane two blocks from an unmodified camera frame.
 *
 * @category Testing
 * @since 1.0.0
 */
const frame = () =>
{
    return { Camera: { Position: { x: 0,
        y: 0,
        z: 2 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Forward: { x: 0,
        y: 0,
        z: -1 } },
    Mount: { Position: { x: 0,
        y: 0,
        z: 0 },
    Right: { x: 1,
        y: 0,
        z: 0 },
    Up: { x: 0,
        y: 1,
        z: 0 },
    Normal: { x: 0,
        y: 0,
        z: 1 } } };
};

/**
 * Checks a floating-point result against an independently supplied target.
 *
 * @category Testing
 * @since 1.0.0
 */
const near = (actual: number, expected: number, tolerance = 1e-8): void =>
{
    Assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

/**
 * Moves the virtual cursor to a chosen point in the default frame's plane.
 * This inverse uses the fixture's known two-block depth rather than the production projector.
 *
 * @category Testing
 * @since 1.0.0
 */
const move = (motion: Motion, x: number, y: number, estimated = false): void =>
{
    const old = motion.State.Pointer!;
    Assert.ok(motion.Look({ Delta: { x: (x - old.x) / 2 * Degrees,
        y: -(y - old.y) / 2 * Degrees },
    Estimated: estimated }));
};

/**
 * Follows a radius-preserving circular cursor path independently of the solver's state integration.
 *
 * @category Testing
 * @since 1.0.0
 */
const angle = (motion: Motion, degrees: number, radius = 0.25): void =>
{
    move(motion, Math.cos(degrees / Degrees) * radius, Math.sin(degrees / Degrees) * radius);
};

/**
 * Advances a fixed number of ticks and asserts every public scalar remains finite.
 *
 * @category Testing
 * @since 1.0.0
 */
const ticks = (motion: Motion, count: number): D.Simulation.Snapshot =>
{
    let result = motion.State;
    for (let tick = 0; tick < count; tick++)
    {
        result = motion.Step();
        Assert.ok([ result.Value, result.Velocity, result.Target,
            result.Point.x, result.Point.y, result.Point.z ].every(Number.isFinite));
    }

    return result;
};

test("projection maps signed look through the frozen camera, sensitivity and local slider track", () =>
{
    const motion = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5 });
    motion.Begin(frame());
    Assert.ok(motion.Look({ Delta: { x: 0.125 / 2 * Degrees,
        y: 0 },
    Estimated: true }));
    near(motion.State.Target, 0.75);
    Assert.equal(motion.State.Estimated, true);
    const before = motion.State.Target;
    motion.Look({ Delta: { x: 0,
        y: 10 } });
    near(motion.State.Target, before);
    Assert.equal(motion.State.Estimated, false);
    const result = ticks(motion, 300);
    near(result.Value, 0.75);
    near(result.Point.x, 0.125);
    Assert.equal(result.Point.y, 0);
    Assert.equal(result.Point.z, 0);
    const sensitive = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5,
        Sensitivity: 2 });
    sensitive.Begin(frame());
    sensitive.Look({ Delta: { x: 0.125 / 2 * Degrees,
        y: 0 } });
    near(sensitive.State.Target, 1);
});

test("six mounted faces and translated world frames preserve the same local movement", () =>
{
    const axes = [
        [ [ 1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, 1 ] ],
        [ [ -1, 0, 0 ], [ 0, 1, 0 ], [ 0, 0, -1 ] ],
        [ [ 0, 0, -1 ], [ 0, 1, 0 ], [ 1, 0, 0 ] ],
        [ [ 0, 0, 1 ], [ 0, 1, 0 ], [ -1, 0, 0 ] ],
        [ [ 1, 0, 0 ], [ 0, 0, -1 ], [ 0, 1, 0 ] ],
        [ [ 1, 0, 0 ], [ 0, 0, 1 ], [ 0, -1, 0 ] ]
    ];
    for (const [ r, u, n ] of axes)
    {
        const Right = { x: r[0],
            y: r[1],
            z: r[2] };
        const Up = { x: u[0],
            y: u[1],
            z: u[2] };
        const Normal = { x: n[0],
            y: n[1],
            z: n[2] };
        const input: D.Simulation.Frame = {
            Camera: { Position: { x: 123 + 2 * n[0],
                y: -47 + 2 * n[1],
                z: 81 + 2 * n[2] },
            Right,
            Up,
            Forward: { x: -n[0],
                y: -n[1],
                z: -n[2] } },
            Mount: { Position: { x: 123,
                y: -47,
                z: 81 },
            Right,
            Up,
            Normal }
        };
        const motion = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.5 });
        motion.Begin(input);
        motion.Look({ Delta: { x: 0.125 / 2 * Degrees,
            y: 0 } });
        near(motion.State.Target, 0.75);
    }
});

test("reversed and quarter-turn mounts reverse or redirect screen input instead of using raw yaw", () =>
{
    const reversed = frame();
    reversed.Mount = { ...reversed.Mount,
        Right: { x: -1,
            y: 0,
            z: 0 },
        Normal: { x: 0,
            y: 0,
            z: -1 } };
    const a = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5 });
    a.Begin(reversed);
    a.Look({ Delta: { x: 0.125 / 2 * Degrees,
        y: 0 } });
    near(a.State.Target, 0.25);
    const rotated = frame();
    rotated.Mount = { ...rotated.Mount,
        Right: { x: 0,
            y: 1,
            z: 0 },
        Up: { x: -1,
            y: 0,
            z: 0 } };
    const b = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5 });
    b.Begin(rotated);
    b.Look({ Delta: { x: 4,
        y: 0 } });
    near(b.State.Target, 0.5);
    b.Look({ Delta: { x: 0,
        y: -0.125 / 2 * Degrees } });
    near(b.State.Target, 0.75);
    for (const [ mount, direction ] of [ [ frame(), -1 ], [ reversed, 1 ] ] as const)
    {
        const wheel = D.Simulation.Make({ Kind: "wheel" });
        wheel.Begin(mount, { x: 0,
            y: 0.25 });
        wheel.Look({ Delta: { x: 0.25 / 2 * Degrees,
            y: 0 } });
        near(wheel.State.Target, direction * 45);
    }
});

test("perspective projection handles foreshortened mounts, off-axis controls and copied frames", () =>
{
    const motion = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5 });
    const root = Math.SQRT1_2;
    const input = frame();
    input.Mount = { ...input.Mount,
        Right: { x: root,
            y: 0,
            z: root },
        Normal: { x: -root,
            y: 0,
            z: root } };
    motion.Begin(input);
    // Local x=0.1 lies at world x=z=sqrt(1/2)*0.1 and depth 2-z.
    motion.Look({ Delta: { x: root * 0.1 / (2 - root * 0.1) * Degrees,
        y: 0 } });
    near(motion.State.Target, 0.7);
    const offAxis = frame();
    offAxis.Mount = { ...offAxis.Mount,
        Position: { x: 1,
            y: 0,
            z: 0 } };
    const b = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.5 });
    b.Begin(offAxis);
    Object.assign(offAxis.Camera.Right, { x: -1 });
    Object.assign(offAxis.Mount.Position, { x: -100 });
    b.Look({ Delta: { x: 0.1 * Degrees,
        y: 0 } });
    near(b.State.Target, 0.9);
});

test("lever targets follow angular input and all intermediate handles stay on their bounded arc", () =>
{
    const motion = D.Simulation.Make({ Kind: "lever",
        InitialValue: 0.5,
        ArcDegrees: 120,
        ArmLength: 0.4 });
    motion.Begin(frame());
    move(motion, 0, 0.8);
    near(motion.State.Target, 0.5);
    for (const degrees of [ 20, -50, 80, -80 ])
    {
        move(motion, Math.sin(degrees / Degrees) * 0.4, Math.cos(degrees / Degrees) * 0.4);
        const expected = degrees === 20 ? 0.5 + 20 / 120 : degrees === -50 ? 0.5 - 50 / 120 :
            degrees === 80 ? 1 : 0;
        // The final -80-degree sample crosses the center only if the chord intersects the hub.
        near(motion.State.Target, expected);
        for (let step = 0; step < 30; step++)
        {
            const state = motion.Step();
            near(Math.hypot(state.Point.x, state.Point.y), 0.4);
            Assert.ok(Math.abs(Math.atan2(state.Point.x, state.Point.y) * Degrees) <= 60 + 1e-8);
        }
    }
});

test("limits stop outward velocity, prevent accumulation beyond an end stop and permit immediate reversal",
    () =>
    {
        const motion = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0,
            Limits: { Min: -2,
                Max: 2 },
            Damping: 0 });
        motion.Begin(frame());
        move(motion, 10, 0);
        near(motion.State.Target, 2);
        for (let i = 0; i < 100; i++)
        {
            const state = motion.Step();
            Assert.ok(state.Value >= -2 && state.Value <= 2);
            if (state.Value === 2)
            {
                Assert.equal(state.Velocity, 0);
            }
        }

        near(motion.State.Value, 2);
        move(motion, 9.99, 0);
        Assert.ok(motion.State.Target < 2);
    });

test("inertia changes response; damping and friction dissipate release motion without sign flips",
    () =>
    {
        const light = D.Simulation.Make({ Kind: "slider",
            Inertia: 1 });
        const heavy = D.Simulation.Make({ Kind: "slider",
            Inertia: 10 });
        for (const motion of [ light, heavy ])
        {
            motion.Begin(frame());
            move(motion, 0.1, 0);
            motion.Step();
        }

        Assert.ok(light.State.Value > heavy.State.Value);
        const weak = D.Simulation.Make({ Kind: "slider",
            DriveStrength: 12 });
        weak.Begin(frame());
        move(weak, 0.1, 0);
        weak.Step();
        Assert.ok(weak.State.Value < light.State.Value);
        const damped = D.Simulation.Make({ Kind: "wheel",
            Damping: 8,
            Friction: 0.5 });
        damped.Begin(frame());
        angle(damped, 90);
        ticks(damped, 3);
        Assert.ok(damped.State.Velocity > 0);
        damped.Release();
        let speed = damped.State.Velocity;
        for (let i = 0; i < 200; i++)
        {
            const state = damped.Step();
            Assert.ok(state.Velocity >= 0 && state.Velocity <= speed);
            speed = state.Velocity;
        }

        Assert.equal(damped.State.Velocity, 0);
        Assert.equal(damped.State.Settled, true);
        Assert.ok(damped.State.Value > 0);
    });

test("lever endpoints, configured detents, springs and retained sliders settle deterministically",
    () =>
    {
        for (const [ initial, expected ] of [ [ 0.2, 0 ], [ 0.8, 1 ], [ 0.5, 0 ] ])
        {
            const motion = D.Simulation.Make({ Kind: "lever",
                InitialValue: initial });
            near(ticks(motion, 400).Value, expected);
            Assert.equal(motion.State.Settled, true);
        }

        const detent = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.61,
            Detents: [ 0.2, 0.6, 0.9 ] });
        near(ticks(detent, 400).Value, 0.6);
        const sprung = D.Simulation.Make({ Kind: "lever",
            InitialValue: 0.9,
            Spring: { Target: 0.4,
                Strength: 50 } });
        near(ticks(sprung, 400).Value, 0.4);
        const held = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.37 });
        held.Begin(frame());
        held.Release();
        near(ticks(held, 400).Value, 0.37);
        const neutral = D.Simulation.Make({ Kind: "lever",
            InitialValue: 0.4,
            DetentStrength: 0 });
        near(ticks(neutral, 100).Value, 0.4);
        const stiff = D.Simulation.Make({ Kind: "slider",
            InitialValue: 1,
            Inertia: 0.001,
            Spring: { Target: 0.25,
                Strength: 1e8 } });
        near(ticks(stiff, 30).Value, 0.25);
    });

test("release selects from actual weighted position and continues settling after input stops", () =>
{
    const motion = D.Simulation.Make({ Kind: "lever",
        InitialValue: 0.3 });
    motion.Begin(frame());
    move(motion, Math.sin(30 / Degrees) * 0.375, Math.cos(30 / Degrees) * 0.375);
    ticks(motion, 20);
    Assert.ok(motion.State.Value > 0.5);
    motion.Release();
    const released = motion.State.Value;
    near(motion.State.Target, 1);
    near(ticks(motion, 400).Value, 1);
    Assert.notEqual(released, motion.State.Value);
    Assert.equal(motion.State.Pointer, undefined);
});

test("stiff undamped return systems dissipate rather than create numerical energy", () =>
{
    for (const inertia of [ 0.001, 1, 100 ])
    {
        const strength = 1e6;
        const motion = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.9,
            Inertia: inertia,
            Damping: 0,
            Friction: 0,
            Spring: { Target: 0.25,
                Strength: strength } });
        let previous = 0.5 * strength * (0.9 - 0.25) ** 2;
        for (let tick = 0; tick < 100; tick++)
        {
            const state = motion.Step();
            const energy = 0.5 * inertia * state.Velocity ** 2 + 0.5 * strength * (state.Value - 0.25) ** 2;
            Assert.ok(Number.isFinite(energy) && energy <= previous + 1e-8);
            previous = energy;
        }
    }

    const stuck = D.Simulation.Make({ Kind: "slider",
        InitialValue: 0.3,
        Friction: 1,
        Spring: { Target: 0.5,
            Strength: 1 } });
    near(ticks(stuck, 100).Value, 0.3);
    Assert.equal(stuck.State.Settled, true);
});

test("wheels integrate complete circular turns without seams and reverse with signed angular movement", () =>
{
    const wheel = D.Simulation.Make({ Kind: "wheel" });
    wheel.Begin(frame());
    for (let degrees = 15; degrees <= 1080; degrees += 15)
    {
        angle(wheel, degrees);
    }

    near(wheel.State.Target, 1080);
    near(ticks(wheel, 500).Value, 1080, 1e-4);
    const seam = D.Simulation.Make({ Kind: "wheel",
        InitialValue: 170 });
    seam.Begin(frame());
    angle(seam, -175);
    near(seam.State.Target, 185);
    angle(seam, 170);
    near(seam.State.Target, 170);
    angle(seam, 155);
    near(seam.State.Target, 155);
    near(Math.hypot(seam.State.Point.x, seam.State.Point.y), 0.25);
});

test("wheel dead-zone entry, exit and crossing segments rebase without half-turn jumps", () =>
{
    const wheel = D.Simulation.Make({ Kind: "wheel" });
    wheel.Begin(frame());
    move(wheel, -0.25, 0);
    near(wheel.State.Target, 0);
    angle(wheel, 195);
    near(wheel.State.Target, 15);
    move(wheel, 0.01, 0);
    near(wheel.State.Target, 15);
    move(wheel, 0, 0.25);
    near(wheel.State.Target, 15);
    move(wheel, -0.25, 0);
    near(wheel.State.Target, 105);
    const hub = D.Simulation.Make({ Kind: "wheel",
        DeadZone: 0 });
    hub.Begin(frame(), { x: 0,
        y: 0 });
    move(hub, 0.25, 0);
    near(hub.State.Target, 0);
});

test("radial drags cannot spin a wheel; straight offset dragging has bounded angular travel",
    () =>
    {
        const radial = D.Simulation.Make({ Kind: "wheel" });
        radial.Begin(frame());
        for (const x of [ 0.5, 1, 5, 1, -1, -5, 1 ])
        {
            move(radial, x, 0);
        }

        near(radial.State.Target, 0);
        const horizontal = D.Simulation.Make({ Kind: "wheel" });
        horizontal.Begin(frame(), { x: 0,
            y: 0.25 });
        for (let x = 0.1; x < 100; x += 0.1)
        {
            move(horizontal, x, 0.25);
        }

        Assert.ok(horizontal.State.Target > -90 && horizontal.State.Target < 0);
        move(horizontal, 0, 0.25);
        near(horizontal.State.Target, 0);
    });

test("unbounded wheels coast when configured and bounded wheels discard stop windup", () =>
{
    const free = D.Simulation.Make({ Kind: "wheel",
        Damping: 0,
        Friction: 0 });
    free.Begin(frame());
    angle(free, 90);
    ticks(free, 5);
    free.Release();
    const old = free.State;
    ticks(free, 100);
    near(free.State.Velocity, old.Velocity);
    near(free.State.Value, old.Value + old.Velocity * 100 * D.Simulation.StepSeconds, 1e-7);
    Assert.equal(free.State.Settled, false);
    const bounded = D.Simulation.Make({ Kind: "wheel",
        Limits: { Min: -90,
            Max: 90 } });
    bounded.Begin(frame());
    for (let degrees = 15; degrees <= 720; degrees += 15)
    {
        angle(bounded, degrees);
    }

    near(bounded.State.Target, 90);
    angle(bounded, 705);
    near(bounded.State.Target, 75);
});

test("invalid geometry, non-finite input, overflow and rejected rays leave committed state unchanged",
    () =>
    {
        const motion = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.5 });
        Assert.throws(() => motion.Look({ Delta: { x: 1,
            y: 0 } }), /active drag/);
        const bad = frame();
        bad.Mount = { ...bad.Mount,
            Right: { x: 2,
                y: 0,
                z: 0 } };
        Assert.throws(() => motion.Begin(bad), /orthonormal/);
        Assert.equal(motion.State.Dragging, false);
        const behind = frame();
        behind.Mount = { ...behind.Mount,
            Position: { x: 0,
                y: 0,
                z: 3 } };
        Assert.throws(() => motion.Begin(behind), /front/);
        motion.Begin(frame());
        const before = motion.State;
        for (const input of [ { x: NaN,
            y: 0 }, { x: Infinity,
            y: 0 } ])
        {
            Assert.throws(() => motion.Look({ Delta: input }), RangeError);
            Assert.deepEqual(motion.State, before);
        }

        Assert.throws(() => motion.SetValue(Infinity), RangeError);
        Assert.deepEqual(motion.State, before);
        Assert.throws(() => D.Simulation.Make({ Kind: "wheel",
            Inertia: Number.MIN_VALUE }), RangeError);
        Assert.throws(() => D.Simulation.Make({ Kind: "slider",
            Limits: { Min: -1e308,
                Max: 1e308 } }), RangeError);
        Assert.throws(() => D.Simulation.Make({ Kind: "wheel",
            InitialValue: -1e308,
            Spring: { Target: 1e308,
                Strength: 1 } }), RangeError);
        const overflow = D.Simulation.Make({ Kind: "wheel",
            Sensitivity: 1e308 });
        overflow.Begin(frame());
        const saved = overflow.State;
        Assert.throws(() => overflow.Look({ Delta: { x: 1e308,
            y: 0 } }), RangeError);
        Assert.deepEqual(overflow.State, saved);
        const edge = frame();
        edge.Camera = { ...edge.Camera,
            Position: { x: 1,
                y: 0,
                z: 2 } };
        edge.Mount = { ...edge.Mount,
            Right: { x: 0,
                y: 0,
                z: -1 },
            Normal: { x: 1,
                y: 0,
                z: 0 } };
        motion.Begin(edge);
        const base = motion.State;
        Assert.equal(motion.Look({ Delta: { x: 0.5 * Degrees,
            y: 0 } }), false);
        Assert.deepEqual(motion.State, base);
        Assert.equal(motion.Look({ Delta: { x: Degrees,
            y: 0 } }), false);
        Assert.deepEqual(motion.State, base);
    });

test("explicit fixed stepping is reproducible and SetValue rebases an active drag without a phantom delta",
    () =>
    {
        const run = (): Array<D.Simulation.Snapshot> =>
        {
            const motion = D.Simulation.Make({ Kind: "slider",
                InitialValue: 0.5 });
            motion.Begin(frame());
            move(motion, 0.15, 0.1);
            const results = [ ticks(motion, 5), ticks(motion, 10) ];
            motion.Release();
            results.push(ticks(motion, 200));
            return results;
        };

        Assert.deepEqual(run(), run());
        const motion = D.Simulation.Make({ Kind: "slider",
            InitialValue: 0.5 });
        motion.Begin(frame());
        move(motion, 0.1, 0);
        ticks(motion, 3);
        motion.SetValue(0.25);
        near(motion.State.Velocity, 0);
        near(motion.State.Target, 0.25);
        motion.Look({ Delta: { x: 0,
            y: 0 } });
        near(motion.State.Target, 0.25);
        Assert.ok(Object.isFrozen(motion.State));
        Assert.ok(Object.isFrozen(motion.State.Point));
        Assert.ok(Object.isFrozen(motion.State.Pointer));
    });

test("pure motion ignores callbacks; live callback failures propagate after committing finite state", () =>
{
    const unexpected = (): never =>
    {
        throw new Error("observer failed");
    };

    const pure = D.Simulation.Make({ Kind: "slider",
        InitialValue: 1,
        Spring: { Target: 0,
            Strength: 50 },
        OnChange: unexpected });
    near(ticks(pure, 300).Value, 0);
    const properties = new Map<string, unknown>();
    const actor = { typeId: "bedform:diagetic_slider",
        getDynamicProperty: (key: string) => properties.get(key),
        getProperty: (): undefined => undefined,
        setDynamicProperty: (key: string, value: unknown) => properties.set(key, value),
        isValid: true,
        remove: (): void => { actor.isValid = false; } };
    const handle = D.Slider({ OnChange: unexpected }).Attach(actor as unknown as Entity);
    handle.Motion.Begin(frame());
    move(handle.Motion, 0, 0);
    Assert.throws(() => handle.Motion.Step(), /observer failed/);
    Assert.ok(handle.Value > 0 && Number.isFinite(handle.Motion.State.Velocity));
    handle.Remove();
});

test("live handles share the same motion, commit input/simulation callbacks and stop mutation after removal",
    () =>
    {
        const properties = new Map<string, unknown>();
        const actor = { typeId: "bedform:diagetic_lever",
            getDynamicProperty: (key: string) => properties.get(key),
            getProperty: (): undefined => undefined,
            setDynamicProperty: (key: string, value: unknown) => properties.set(key, value),
            isValid: true,
            remove: (): void => { actor.isValid = false; } };
        const changes: Array<D.ChangeEvent> = [];
        const definition = D.Lever({ InitialValue: 0.3,
            OnChange: (event) => changes.push(event) });
        const a = definition.Attach(actor as unknown as Entity);
        const b = definition.Attach(actor as unknown as Entity);
        a.Motion.Begin(frame());
        move(a.Motion, 0.2, 0.3, true);
        ticks(b.Motion, 30);
        near(a.Value, b.Value);
        Assert.ok(changes.some((event) => event.Source === "input" && event.Control === b));
        a.Motion.Release();
        ticks(a.Motion, 400);
        Assert.ok(changes.some((event) => event.Source === "simulation" && event.Control === a));
        near(a.Value, 1);
        b.Motion.SetValue(0.5);
        Assert.equal(changes.at(-1)!.Source, "programmatic");
        near(a.Value, 0.5);
        a.Remove();
        Assert.throws(() => b.Motion.Begin(frame()), /valid entity/);
        Assert.throws(() => b.Motion.Look({ Delta: { x: 0,
            y: 0 } }), /valid entity/);
        Assert.throws(() => b.Motion.Step(), /valid entity/);
        Assert.throws(() => b.Motion.SetValue(0.4), /valid entity/);
        b.Motion.Release();
    });
