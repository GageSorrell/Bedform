/**
 * Independent handle picking, local-frame drag projection, continuous turns and focus gating fixtures.
 *
 * @module bedform/Test/GizmoGeometry.test
 *
 * @file      GizmoGeometry.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Spatial fixtures retain contextual inference and axis ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as G from "bedform/Diagetic/Gizmo";
import * as Q from "bedform/Quat";
import type { Player, Vector3 } from "@minecraft/server";
import Assert from "node:assert/strict";
import { test } from "node:test";

const Geometry = G.Geometry;
const Zero = { x: 0,
    y: 0,
    z: 0 };
const Identity = { Position: Zero,
    Rotation: { x: 0,
        y: 0,
        z: 0,
        w: 1 } };
const Transform: G.Transform = { ...Identity,
    Scale: { x: 1,
        y: 1,
        z: 1 } };

/**
 * Compares independently calculated coordinates with floating-point tolerance.
 *
 * @category Testing
 * @since 1.0.0
 */
const close = (actual: Readonly<Vector3>, expected: Readonly<Vector3>, tolerance: number = 1e-8): void =>
{
    for (const axis of [ "x", "y", "z" ] as const)
    {
        Assert.ok(Math.abs(actual[axis] - expected[axis]) < tolerance,
            `${axis}: ${actual[axis]} != ${expected[axis]}`);
    }
};

/**
 * Builds a normalized ray from an eye toward a test point.
 *
 * @category Testing
 * @since 1.0.0
 */
const aim = (point: Readonly<Vector3>, origin: Readonly<Vector3> = { x: 0,
    y: 0,
    z: -3 }):
G.Geometry.Ray =>
{
    const delta = { x: point.x - origin.x,
        y: point.y - origin.y,
        z: point.z - origin.z };
    const length = Math.hypot(delta.x, delta.y, delta.z);
    return { Origin: origin,
        Direction: { x: delta.x / length,
            y: delta.y / length,
            z: delta.z / length } };
};

/**
 * Supplies explicit pure geometry with optional local and parent poses.
 *
 * @category Testing
 * @since 1.0.0
 */
const geometry = (mode: G.Mode, transform: G.Transform = Transform, parent: G.Frame = Identity) =>
{
    return Geometry.Build({ Transform: transform,
        Parent: parent,
        View: aim(Zero),
        Mode: mode,
        Tolerance: 0.025 });
};

/**
 * Builds right-handed local-axis quarter turns independently of the production quaternion helpers.
 *
 * @category Testing
 * @since 1.0.0
 */
const quaternion = (axis: "x" | "y" | "z", degrees: number) =>
{
    const value = { x: 0,
        y: 0,
        z: 0,
        w: Math.cos(degrees * Math.PI / 360) };
    value[axis] = Math.sin(degrees * Math.PI / 360);
    return value;
};

test("geometry inventories share colored local solids and bounded closed rotation rings", () =>
{
    Assert.deepEqual(geometry("translation").Parts.map((part) => part.Handle),
        [ "x", "y", "z", "xy", "xz", "yz", "camera" ]);
    Assert.deepEqual(geometry("scale").Parts.map((part) => part.Handle),
        [ "x", "y", "z", "xy", "xz", "yz", "uniform" ]);
    const rings = geometry("rotation");
    Assert.deepEqual(rings.Parts.map((part) => part.Color), [ "red", "green", "blue" ]);
    for (const part of rings.Parts)
    {
        Assert.equal(part.Primitives.length, 48);
        Assert.ok(part.Primitives.every((primitive) => primitive.Kind === "capsule"));
        const first = part.Primitives[0] as G.Geometry.Capsule;
        const last = part.Primitives[47] as G.Geometry.Capsule;
        close(first.Start, last.End);
        Assert.ok(Object.isFrozen(first.Start));
    }

    Assert.ok(Object.isFrozen(rings.Parts));
    Assert.ok(!Object.isFrozen(Transform.Scale));
    Assert.equal(geometry("scale", { ...Transform,
        Scale: Zero }).Parts.length, 7);
});

test("all arrow, plane, free-move, rotation and scale handles use the shared solids for picking", () =>
{
    for (const mode of [ "translation", "rotation", "scale" ] as const)
    {
        const shape = geometry(mode);
        for (const part of shape.Parts)
        {
            let point = Zero;
            let eye = { x: 0,
                y: 0,
                z: -3 };
            if (mode === "rotation")
            {
                const ring = part.Primitives[6] as G.Geometry.Capsule;
                point = { x: (ring.Start.x + ring.End.x) / 2,
                    y: (ring.Start.y + ring.End.y) / 2,
                    z: (ring.Start.z + ring.End.z) / 2 };
                eye = { ...point,
                    [part.Handle]: point[part.Handle as keyof Vector3] + 3 };
            }
            else if (part.Handle.length === 1)
            {
                point = { ...Zero,
                    [part.Handle]: 0.6 };
                eye = part.Handle === "z" ? { ...point,
                    x: -3 } : { ...point,
                    z: -3 };
            }
            else if (part.Handle.length === 2)
            {
                point = { ...Zero,
                    [part.Handle[0]]: 0.34,
                    [part.Handle[1]]: 0.34 };
                const normal = [ "x", "y", "z" ].find((axis) => !part.Handle.includes(axis))!;
                eye = { ...point,
                    [normal]: -3 };
            }

            Assert.equal(Geometry.Pick(shape, aim(point, eye))?.Handle, part.Handle,
                `${mode}/${part.Handle}`);
        }
    }
});

test("picking resolves overlap by actual forward entry, stable ties, and misses behind the camera", () =>
{
    const shape = geometry("scale");
    const cube = (z: number): G.Geometry.Box => ({ Kind: "box",
        Center: { x: 0,
            y: 0,
            z },
        Basis: shape.Basis,
        HalfSize: { x: 0.1,
            y: 0.1,
            z: 0.1 } });
    const overlapping: G.Geometry.Geometry = { ...shape,
        Parts: [
            { Handle: "x",
                Color: "red",
                Primitives: [ cube(1) ] },
            { Handle: "y",
                Color: "green",
                Primitives: [ cube(0) ] },
            { Handle: "z",
                Color: "blue",
                Primitives: [ cube(0) ] } ] };
    const picked = Geometry.Pick(overlapping, aim(Zero))!;
    Assert.equal(picked.Handle, "y");
    Assert.ok(Math.abs(picked.Distance - 2.9) < 1e-9);
    Assert.equal(Geometry.Pick(overlapping, { Origin: Zero,
        Direction: { x: 0,
            y: 0,
            z: -1 } })?.Distance, 0);
    Assert.equal(Geometry.Pick(shape, aim({ x: 10,
        y: 10,
        z: 0 })), undefined);
    Assert.equal(Geometry.Pick(shape, { Origin: { x: 0,
        y: 0,
        z: -3 },
    Direction: { x: 0,
        y: 0,
        z: -1 } }), undefined);
});

test("parent and target rotations compose local geometry and parent-relative translation", () =>
{
    const parent = { Position: { x: 5,
        y: 2,
        z: 3 },
    Rotation: quaternion("y", 90) };
    const local = { Position: { x: 1,
        y: 0,
        z: 0 },
    Rotation: quaternion("z", 90),
    Scale: Transform.Scale };
    const shape = geometry("translation", local, parent);
    close(shape.Center, { x: 5,
        y: 2,
        z: 2 });
    close(shape.Basis.X, { x: 0,
        y: 1,
        z: 0 });
    const eye = { x: 5,
        y: 2,
        z: -1 };
    const start = aim({ x: 5,
        y: 2.6,
        z: 2 }, eye);
    Assert.equal(Geometry.Pick(shape, start)?.Handle, "x");
    const drag = Geometry.Begin(shape, "x", start, { x: 0,
        y: 0,
        z: 90 });
    close(drag.Sample(start).Transform.Position, local.Position);
    close(drag.Sample(aim({ x: 5,
        y: 3.6,
        z: 2 }, eye)).Transform.Position, { x: 1,
        y: 1,
        z: 0 });
});

test("capsule picking covers tube sides, tangent rays, parallel endcaps and origins inside solids", () =>
{
    const shape = geometry("translation");
    const capsule: G.Geometry.Geometry = { ...shape,
        Parts: [ { Handle: "x",
            Color: "red",
            Primitives: [ { Kind: "capsule",
                Start: Zero,
                End: { x: 1,
                    y: 0,
                    z: 0 },
                Radius: 0.1 } ] } ] };
    Assert.ok(Math.abs(Geometry.Pick(capsule, { Origin: { x: 0.5,
        y: 0,
        z: -1 },
    Direction: { x: 0,
        y: 0,
        z: 1 } })!.Distance - 0.9) < 1e-9);
    Assert.ok(Math.abs(Geometry.Pick(capsule, { Origin: { x: -1,
        y: 0,
        z: 0 },
    Direction: { x: 1,
        y: 0,
        z: 0 } })!.Distance - 0.9) < 1e-9);
    Assert.ok(Math.abs(Geometry.Pick(capsule, { Origin: { x: 0.5,
        y: 0.1,
        z: -1 },
    Direction: { x: 0,
        y: 0,
        z: 1 } })!.Distance - 1) < 1e-9);
    Assert.equal(Geometry.Pick(capsule, { Origin: { x: -1,
        y: 0.11,
        z: 0 },
    Direction: { x: 1,
        y: 0,
        z: 0 } }), undefined);
    Assert.equal(Geometry.Pick(capsule, aim({ x: 0.5,
        y: 0,
        z: 1 },
    { x: 0.5,
        y: 0,
        z: 0 }))?.Distance, 0);
    for (const mode of [ "translation", "scale" ] as const)
    {
        Assert.equal(Geometry.Pick(geometry(mode), aim({ x: 0.98,
            y: 0,
            z: 0 }))?.Handle, "x");
    }
});

test("axis and all local plane drags preserve grab offsets and captured handle selection", () =>
{
    const shape = geometry("translation");
    for (const handle of [ "x", "y", "z", "xy", "xz", "yz" ] as const)
    {
        const startPoint = { ...Zero,
            [handle[0]]: 0.6 };
        const endPoint = { ...Zero,
            [handle[0]]: 1.1 };
        if (handle.length === 2)
        {
            startPoint[handle[1] as keyof Vector3] = 0.3;
            endPoint[handle[1] as keyof Vector3] = 0.5;
        }

        const normal = [ "x", "y", "z" ].find((axis) => !handle.includes(axis))!;
        const eye = { ...Zero,
            [normal]: -3 };
        const drag = Geometry.Begin(shape, handle, aim(startPoint, eye), Zero);
        close(drag.Sample(aim(startPoint, eye)).Transform.Position, Zero);
        const expected = { ...Zero,
            [handle[0]]: 0.5 };
        if (handle.length === 2)
        {
            expected[handle[1] as keyof Vector3] = 0.2;
        }

        close(drag.Sample(aim(endPoint, eye)).Transform.Position, expected);
        Assert.equal(drag.Handle, handle);
    }

    const captured = Geometry.Begin(shape, "x", aim({ x: 0.6,
        y: 0,
        z: 0 }), Zero);
    const overY = aim({ x: 0,
        y: 0.6,
        z: 0 });
    Assert.equal(Geometry.Pick(shape, overY)?.Handle, "y");
    close(captured.Sample(overY).Transform.Position, { x: -0.6,
        y: 0,
        z: 0 });
    Assert.equal(captured.Handle, "x");
});

test("camera-plane movement captures the initial camera basis through subsequent aim changes", () =>
{
    const shape = geometry("translation");
    close(shape.CameraBasis.X, { x: -1,
        y: 0,
        z: 0 });
    close(shape.CameraBasis.Y, { x: 0,
        y: 1,
        z: 0 });
    close(shape.CameraBasis.Z, { x: 0,
        y: 0,
        z: -1 });
    const drag = Geometry.Begin(shape, "camera", aim(Zero), Zero);
    close(drag.Sample(aim({ x: 0.5,
        y: 0.4,
        z: 0 })).Transform.Position, { x: 0.5,
        y: 0.4,
        z: 0 });
    close(drag.Sample(aim({ x: -0.3,
        y: 0.7,
        z: 0 })).Transform.Position, { x: -0.3,
        y: 0.7,
        z: 0 });
    const vertical = Geometry.Build({ Transform,
        Parent: Identity,
        Mode: "translation",
        View: { Origin: { x: 0,
            y: 3,
            z: 0 },
        Direction: { x: 0,
            y: -1,
            z: 0 } } });
    Assert.ok(Number.isFinite(vertical.CameraBasis.X.x));
});

test("degenerate, nearly parallel and behind-camera projections retain the last valid result", () =>
{
    const shape = geometry("translation");
    const start = aim({ x: 0.6,
        y: 0,
        z: 0 });
    const drag = Geometry.Begin(shape, "x", start, Zero);
    const valid = drag.Sample(aim({ x: 0.9,
        y: 0,
        z: 0 }));
    const parallel = { Origin: { x: -3,
        y: 0.0001,
        z: 0 },
    Direction: { x: 1,
        y: 0,
        z: 0 } };
    Assert.equal(drag.Sample(parallel).Valid, false);
    Assert.equal(drag.State.Transform, valid.Transform);
    Assert.equal(drag.Sample(aim(Zero, { x: -3,
        y: 0.0001,
        z: 0 })).Valid, false);
    close(drag.Sample(start).Transform.Position, Zero);
    const pending = Geometry.Begin(shape, "x", parallel, Zero);
    Assert.equal(pending.State.Valid, false);
    close(pending.Sample(start).Transform.Position, Zero);
    close(pending.Sample(aim({ x: 0.9,
        y: 0,
        z: 0 })).Transform.Position, { x: 0.3,
        y: 0,
        z: 0 });
    const plane = Geometry.Begin(shape, "xy", start, Zero);
    Assert.equal(plane.Sample({ Origin: { x: 0,
        y: 0,
        z: -3 },
    Direction: { x: 0,
        y: 0,
        z: -1 } }).Valid, false);
});

test("axis, plane and uniform scale work through zero without dividing by target scale", () =>
{
    for (const handle of [ "x", "y", "z", "xy", "xz", "yz" ] as const)
    {
        const shape = geometry("scale", { ...Transform,
            Scale: Zero });
        const normal = [ "x", "y", "z" ].find((axis) => !handle.includes(axis))!;
        const eye = { ...Zero,
            [normal]: -3 };
        const drag = Geometry.Begin(shape, handle, aim(Zero, eye), Zero);
        const point = { ...Zero,
            [handle[0]]: -0.5 };
        const expected = { ...Zero,
            [handle[0]]: -0.5 };
        if (handle.length === 2)
        {
            point[handle[1] as keyof Vector3] = 0.2;
            expected[handle[1] as keyof Vector3] = 0.2;
        }

        close(drag.Sample(aim(point, eye)).Transform.Scale, expected);
    }

    const uniform = Geometry.Begin(geometry("scale", { ...Transform,
        Scale: Zero }), "uniform", aim(Zero), Zero);
    close(uniform.Sample(aim({ x: -Math.SQRT1_2,
        y: Math.SQRT1_2,
        z: 0 })).Transform.Scale,
    { x: 1,
        y: 1,
        z: 1 });
    const proportional = Geometry.Begin(geometry("scale", { ...Transform,
        Scale: { x: 2,
            y: 4,
            z: 6 } }), "uniform", aim(Zero), Zero);
    const next = proportional.Sample(aim({ x: -Math.SQRT1_2,
        y: Math.SQRT1_2,
        z: 0 })).Transform.Scale;
    Assert.ok(Math.abs(next.y / next.x - 2) < 1e-9);
    Assert.ok(Math.abs(next.z / next.x - 3) < 1e-9);
});

test("rotation axes unwrap seams and turns, retain invalid samples and match Minecraft signs", () =>
{
    const shape = geometry("rotation");
    for (const handle of [ "x", "y", "z" ] as const)
    {
        const surface = handle === "x" ? [ "y", "z" ] : handle === "y" ? [ "z", "x" ] : [ "x", "y" ];
        const eye = { ...Zero,
            [handle]: -3 };
        const point = (angle: number) => ({ ...Zero,
            [surface[0]]: Math.cos(angle * Math.PI / 180) * 0.75,
            [surface[1]]: Math.sin(angle * Math.PI / 180) * 0.75 });
        const drag = Geometry.Begin(shape, handle, aim(point(170), eye), Zero);
        for (let angle = 170; angle <= 890; angle += 30)
        {
            const result = drag.Sample(aim(point(angle), eye));
            const expected = (angle - 170) * (handle === "y" ? -1 : 1);
            Assert.ok(Math.abs(result.AngleDegrees - expected) < 1e-7);
            Assert.ok(Math.abs(result.RotationDegrees[handle] - expected) < 1e-6,
                `${handle}/${angle}: ${JSON.stringify(result.RotationDegrees)}`);
        }

        const previous = drag.State;
        Assert.equal(drag.Sample(aim(Zero, eye)).Valid, false);
        Assert.equal(drag.State.Transform, previous.Transform);
        Assert.equal(drag.State.AngleDegrees, previous.AngleDegrees);
    }
});

test("rotated parents and wound Euler channels retain quaternion equivalence across all ring axes", () =>
{
    for (const original of [ { pitch: 732,
        yaw: -326,
        roll: 1_057 },
    { pitch: 90,
        yaw: 35,
        roll: 15 }, { pitch: -90,
        yaw: 15,
        roll: 35 } ])
    {
        const rotation = Q.fromRotator(original);
        Assert.ok(rotation._tag === "Some");
        const shape = geometry("rotation", { ...Transform,
            Rotation: rotation.value },
        { Position: { x: 4,
            y: 2,
            z: -1 },
        Rotation: quaternion("y", 47) });
        for (const handle of [ "x", "y", "z" ] as const)
        {
            const normal = handle === "x" ? shape.Basis.X : handle === "y" ? shape.Basis.Y : shape.Basis.Z;
            const u = handle === "x" ? shape.Basis.Y : handle === "y" ? shape.Basis.Z : shape.Basis.X;
            const v = handle === "x" ? shape.Basis.Z : handle === "y" ? shape.Basis.X : shape.Basis.Y;
            const eye = { x: shape.Center.x - 3 * normal.x,
                y: shape.Center.y - 3 * normal.y,
                z: shape.Center.z - 3 * normal.z };
            const point = (angle: number) =>
            {
                const c = Math.cos(angle * Math.PI / 180) * 0.75;
                const s = Math.sin(angle * Math.PI / 180) * 0.75;
                return { x: shape.Center.x + c * u.x + s * v.x,
                    y: shape.Center.y + c * u.y + s * v.y,
                    z: shape.Center.z + c * u.z + s * v.z };
            };

            const initialDegrees = { x: original.pitch,
                y: original.yaw,
                z: original.roll };
            const drag = Geometry.Begin(shape, handle, aim(point(0), eye), initialDegrees);
            let previous = initialDegrees;
            for (let angle = 0; angle <= 720; angle += 15)
            {
                const result = drag.Sample(aim(point(angle), eye));
                const reconstructed = Q.fromRotator({ pitch: result.RotationDegrees.x,
                    yaw: result.RotationDegrees.y,
                    roll: result.RotationDegrees.z });
                Assert.ok(reconstructed._tag === "Some");
                const expected = Q.multiply(rotation.value, quaternion(handle, angle));
                const actual = result.Transform.Rotation;
                Assert.ok(Math.abs(expected.x * actual.x + expected.y * actual.y +
                    expected.z * actual.z + expected.w * actual.w) > 1 - 1e-8);
                Assert.ok(Math.abs(reconstructed.value.x * actual.x + reconstructed.value.y * actual.y +
                    reconstructed.value.z * actual.z + reconstructed.value.w * actual.w) > 1 - 1e-8,
                `${handle}/${angle}: ${JSON.stringify(result.RotationDegrees)}`);
                for (const axis of [ "x", "y", "z" ] as const)
                {
                    Assert.ok(Math.abs(result.RotationDegrees[axis] - previous[axis]) < 180);
                }

                previous = result.RotationDegrees;
            }
        }
    }
});

test("regrabs rebuild local bases from current transforms without a position or orientation jump", () =>
{
    const rotation = geometry("rotation");
    const first = Geometry.Begin(rotation, "z", aim({ x: 0.75,
        y: 0,
        z: 0 }), Zero);
    const changed = first.Sample(aim({ x: 0,
        y: 0.75,
        z: 0 }));
    const next = geometry("translation", changed.Transform);
    close(next.Basis.X, { x: 0,
        y: 1,
        z: 0 });
    const grab = aim({ x: 0,
        y: 0.6,
        z: 0 });
    const second = Geometry.Begin(next, "x", grab, changed.RotationDegrees);
    close(second.Sample(grab).Transform.Position, Zero);
    close(second.Sample(aim({ x: 0,
        y: 1.1,
        z: 0 })).Transform.Position, { x: 0,
        y: 0.5,
        z: 0 });
    const rebuilt = geometry("translation", second.State.Transform);
    const thirdGrab = aim({ x: 0,
        y: 1.4,
        z: 0 });
    const third = Geometry.Begin(rebuilt, "x", thirdGrab, second.State.RotationDegrees);
    close(third.Sample(thirdGrab).Transform.Position, second.State.Transform.Position);
    close(third.Sample(thirdGrab).RotationDegrees, changed.RotationDegrees);
});

test("focus gates items, eligibility, bounds angle, distance and explicit occlusion before picking", () =>
{
    const targets = [ { key: "first",
        distance: 2,
        angle: 0,
        occluded: false,
        eligible: true },
    { key: "second",
        distance: 1,
        angle: 10,
        occluded: false,
        eligible: true } ];
    const definition = G.Make({ Id: "test:focus",
        Items: [ "test:wand" ],
        Modes: [ "translation", "scale" ],
        Adapter: { Discover: () => targets,
            Resolve: (key) => targets.find((target) => target.key === key),
            Key: (target) => target.key,
            IsValid: () => true,
            HitTest: (target) => ({ Distance: target.distance,
                Angle: target.angle,
                Occluded: target.occluded }),
            Read: () => Transform,
            ReadDegrees: () => Zero,
            Parent: () => Identity,
            Apply: () => { throw new Error("pure focus must not apply transforms"); } },
        Eligible: (_player, target) => target.eligible });
    const runtime = G.Start({ Definitions: [ definition ] });
    const query = { ...aim(Zero),
        Player: { id: "player" } as Player,
        Dimension: "minecraft:overworld" };
    Assert.equal(Geometry.Focus(runtime, "test:wand", query)?.Candidate.Key, "first");
    Assert.equal(Geometry.Focus(runtime, "test:wand", query)?.Hover?.Handle, "camera");
    Assert.equal(Geometry.Focus(runtime, "other:item", query), undefined);
    targets[0].occluded = true;
    Assert.equal(Geometry.Focus(runtime, "test:wand", query)?.Candidate.Key, "second");
    targets[1].angle = 16;
    Assert.equal(Geometry.Focus(runtime, "test:wand", query), undefined);
    targets[1].angle = 0;
    targets[1].distance = 3.01;
    Assert.equal(Geometry.Focus(runtime, "test:wand", query), undefined);
    targets[1].distance = 3;
    targets[1].eligible = false;
    Assert.equal(Geometry.Focus(runtime, "test:wand", query), undefined);
    targets[1].eligible = true;
    Assert.equal(Geometry.Focus(runtime, "test:wand", query, "scale")?.Geometry.Mode, "scale");
    Assert.throws(() => Geometry.Focus(runtime, "test:wand", query, "rotation"), TypeError);
    runtime.Dispose();
});

test("malformed rays, unsupported handles and world-axis modes are rejected", () =>
{
    const shape = geometry("translation");
    Assert.throws(() => Geometry.Pick(shape, { Origin: Zero,
        Direction: Zero }), RangeError);
    Assert.throws(() => Geometry.Build({ Transform,
        Parent: Identity,
        View: aim(Zero),
        Mode: "world" as G.Mode }), TypeError);
    Assert.throws(() => Geometry.Begin(shape, "uniform", aim(Zero), Zero), TypeError);
    Assert.throws(() => Geometry.Begin(shape, "x", aim(Zero), { x: Infinity,
        y: 0,
        z: 0 }), RangeError);
});
