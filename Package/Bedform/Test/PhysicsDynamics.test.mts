/**
 * Analytic dynamics, conservation, contact and transactional island fixtures.
 *
 * @module bedform/Test/PhysicsDynamics.test
 *
 * @file      PhysicsDynamics.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Independent physical fixtures retain tensor ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as E from "bedform/PhysicsEntity";
import * as W from "bedform/PhysicsWorld";
import * as S from "bedform/CollisionShape";
import type * as Model from "bedform/PhysicsModel";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as HashSet from "@bedform/effect/HashSet";
import * as T from "bedform/Transform";
import * as Q from "bedform/Quat";
import * as V from "bedform/Vector3";
import * as H from "bedform/ConvexHull";
import * as Render from "bedform/PhysicsRenderer";

/**
 * Independent uniform cuboid source with an independently selectable collision shape.
 *
 * @category Fixtures
 * @since 1.0.0
 */
const model = (size = V.One, mass = 1, kind: S.CollisionShape.Primitive["kind"] = "box"): Model.Model =>
{
    const Half = V.Vector3Unsafe(size.x / 2, size.y / 2, size.z / 2);
    const Hull = O.getOrThrow(H.fromAABB({ min: V.scale(Half, -1),
        max: Half }));
    return { schemaVersion: 1,
        name: "fixture",
        identifier: "test:fixture",
        representation: "cuboid",
        fingerprint: JSON.stringify([ size, mass, kind ]),
        bounds: O.getOrThrow(H.bounds(Hull)),
        sourceGeometry: [],
        sourceCells: [ { hull: Hull,
            internalFaces: Hull.faces.map(() => false),
            sources: [] } ],
        collision: R.getOrThrow(S.primitive(kind, Half)),
        restitution: 0,
        linearVelocity: V.Zero,
        angularVelocity: V.Zero,
        physical: { volume: size.x * size.y * size.z,
            mass,
            centroid: V.Zero,
            centerOfMass: V.Zero,
            inertia: [ mass * (size.y ** 2 + size.z ** 2) / 12, 0, 0, 0, mass * (size.x ** 2 + size.z ** 2) / 12, 0, 0, 0, mass * (size.x ** 2 + size.y ** 2) / 12 ] } };
};

/**
 * Looks up a retained authoritative body, failing the fixture if it disappeared.
 *
 * @category Tests
 * @since 1.0.0
 */
const body = (world: W.PhysicsWorld, id: string): E.PhysicsEntity =>
{
    return O.getOrThrow(R.getOrThrow(W.get(world, id)));
};

/**
 * Advances complete ticks and requires no unreported paused failures.
 *
 * @category Tests
 * @since 1.0.0
 */
const ticks = (world: W.PhysicsWorld, count: number): W.PhysicsWorld =>
{
    let current = world;
    for (let i = 0; i < count; i++)
    {
        current = R.getOrThrow(W.step(current));
        Assert.equal(current.diagnostics.length, 0, JSON.stringify(current.diagnostics));
    }

    return current;
};

/**
 * Independent numeric tolerance comparison.
 *
 * @category Tests
 * @since 1.0.0
 */
const near = (actual: number, expected: number, tolerance = 1e-7): void =>
{
    Assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test("four semi-implicit substeps preserve analytic gravity, loads and immutable history", () =>
{
    const Body = R.getOrThrow(E.make(model(), { id: "fall" }));
    const Original = R.getOrThrow(W.add(R.getOrThrow(W.make()), Body));
    const Next = ticks(Original, 20);
    const Fall = body(Next, "fall");
    const Hh = 0.0125;
    const Count = 80;
    near(Fall.linearVelocity.y, -9.81);
    near(Fall.pose.position.y, -9.81 * Hh ** 2 * Count * (Count + 1) / 2);
    Assert.equal(Original.tick, 0);
    near(Body.pose.position.y, 0);
    const Loaded = R.getOrThrow(E.applyForce(R.getOrThrow(E.make(model(V.One, 2), { id: "load" })), V.Vector3Unsafe(20, 0, 0)));
    const Result = ticks(R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Loaded)), 1);
    near(body(Result, "load").linearVelocity.x, 0.5);
    near(body(Result, "load").pose.position.x, 0.015625);
    near(body(Result, "load").force.x, 0);
    near(Loaded.force.x, 20);
    Assert.ok(Object.isFrozen(Fall.interval.start));
    Assert.ok(Object.isFrozen(Next.bodies));
});

test("source-solid mass/COM rebuilding preserves pose and angular/full-tensor impulse response", () =>
{
    const Initial = R.getOrThrow(E.make(model(V.One, 2), { id: "mass",
        pose: T.TransformUnsafe(V.Vector3Unsafe(3, 4, 5), Q.Identity) }));
    const Changed = R.getOrThrow(E.configure({ density: 4,
        centerOfMass: V.UnitX })(Initial));
    near(Changed.physical.mass, 4);
    near(Changed.physical.inertia[4], 4 / 6 + 4);
    Assert.ok(Equal.equals(Changed.pose, Initial.pose));
    near(Initial.physical.mass, 2);
    const Center = E.centerOfMass(Changed);
    const Pushed = R.getOrThrow(E.applyImpulse(Changed, V.UnitX, V.add(Center, V.UnitY)));
    near(Pushed.linearVelocity.x, 0.25);
    near(Pushed.angularMomentum.z, -1);
    near(Pushed.angularVelocity.z, -1 / (4 / 6 + 4));
    const Motion = E.motion(Pushed);
    const Expected = V.add(Pushed.linearVelocity, V.cross(Pushed.angularVelocity, V.subtract(Pushed.pose.position, Center)));
    near(Motion.linearVelocity.x, Expected.x);
    near(Motion.linearVelocity.y, Expected.y);
    const Source = model();
    const Tetra = { ...Source,
        physical: { ...Source.physical,
            centroid: V.Vector3Unsafe(0.25, 0.25, 0.25),
            centerOfMass: V.Vector3Unsafe(0.25, 0.25, 0.25),
            inertia: [ 0.075, 0.0125, 0.0125, 0.0125, 0.075, 0.0125, 0.0125, 0.0125, 0.075 ] as Model.Inertia } };
    const Full = R.getOrThrow(E.make(Tetra, { id: "full" }));
    const Impact = R.getOrThrow(E.applyImpulse(Full, V.UnitY, V.add(E.centerOfMass(Full), V.UnitX)));
    near(Impact.angularMomentum.z, 1);
    near(Impact.angularVelocity.x, -2);
    near(Impact.angularVelocity.y, -2);
    near(Impact.angularVelocity.z, 14);
});

test("gravity overrides, torque, static and prescribed kinematic contacts obey body modes", () =>
{
    near(R.getOrThrow(E.gravityFrom(2, V.Vector3Unsafe(0, -3, 0))).y, -2);
    const Falling = R.getOrThrow(E.make(model(), { id: "custom",
        gravity: O.some(V.UnitX) }));
    const Free = ticks(R.getOrThrow(W.add(R.getOrThrow(W.make()), Falling)), 1);
    near(body(Free, "custom").linearVelocity.x, 0.05);
    near(body(Free, "custom").linearVelocity.y, 0);
    const Torque = R.getOrThrow(E.applyTorque(R.getOrThrow(E.make(model(), { id: "torque" })), V.Vector3Unsafe(0, 0, 2)));
    const Spinning = body(ticks(R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Torque)), 1), "torque");
    near(Spinning.angularMomentum.z, 0.1);
    near(Spinning.angularVelocity.z, 0.6);
    const Kinematic = R.getOrThrow(E.make(model(), { id: "kin",
        mode: "kinematic",
        pose: T.TransformUnsafe(V.Vector3Unsafe(-1, 0, 0), Q.Identity),
        linearVelocity: V.UnitX }));
    Assert.ok(Equal.equals(Kinematic, R.getOrThrow(E.applyImpulse(Kinematic, V.Vector3Unsafe(100, 0, 0)))));
    const Dynamic = R.getOrThrow(E.make(model(), { id: "dynamic" }));
    let World = R.getOrThrow(W.make({ gravity: V.Zero }));
    World = R.getOrThrow(W.add(World, Kinematic));
    World = R.getOrThrow(W.add(World, Dynamic));
    const Pushed = ticks(World, 4);
    near(body(Pushed, "kin").pose.position.x, -0.8);
    near(body(Pushed, "kin").linearVelocity.x, 1);
    near(body(Pushed, "dynamic").linearVelocity.x, 1, 1e-4);
});

test("elastic impacts preserve momentum/energy and fast bodies cannot cross thin walls", () =>
{
    const Sphere = model(V.One, 1, "sphere");
    const A = R.getOrThrow(E.make(Sphere, { id: "a",
        pose: T.TransformUnsafe(V.Vector3Unsafe(-0.6, 0, 0), Q.Identity),
        linearVelocity: V.Vector3Unsafe(2, 0, 0),
        restitution: 1 }));
    const Bv = R.getOrThrow(E.make(Sphere, { id: "b",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0.6, 0, 0), Q.Identity),
        linearVelocity: V.Vector3Unsafe(-2, 0, 0) }));
    let World = R.getOrThrow(W.make({ gravity: V.Zero }));
    World = R.getOrThrow(W.add(World, A));
    World = R.getOrThrow(W.add(World, Bv));
    const Bounce = ticks(World, 3);
    const Left = body(Bounce, "a");
    const Right = body(Bounce, "b");
    near(Left.linearVelocity.x, -2, 1e-5);
    near(Right.linearVelocity.x, 2, 1e-5);
    near(Left.linearVelocity.x + Right.linearVelocity.x, 0);
    near((V.magnitude(Left.linearVelocity) ** 2 + V.magnitude(Right.linearVelocity) ** 2) / 2, 4, 1e-5);
    const Wall = R.getOrThrow(E.make(model(V.Vector3Unsafe(0.02, 5, 5)), { id: "wall",
        mode: "static" }));
    const Fast = R.getOrThrow(E.make(Sphere, { id: "fast",
        pose: T.TransformUnsafe(V.Vector3Unsafe(-2, 0, 0), Q.Identity),
        linearVelocity: V.Vector3Unsafe(1_000, 0, 0) }));
    let Scene = R.getOrThrow(W.make({ gravity: V.Zero }));
    Scene = R.getOrThrow(W.add(Scene, Wall));
    Scene = R.getOrThrow(W.add(Scene, Fast));
    const Stopped = body(ticks(Scene, 1), "fast");
    Assert.ok(Stopped.pose.position.x < -0.509);
    near(Stopped.linearVelocity.x, 0, 1e-4);
});

test("stacking, Coulomb friction, island sleeping and wake propagation remain stable", () =>
{
    const Ground = R.getOrThrow(E.make(model(V.Vector3Unsafe(10, 1, 10)), { id: "ground",
        mode: "static",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0, -0.5, 0), Q.Identity) }));
    const Bottom = R.getOrThrow(E.make(model(), { id: "bottom",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0, 0.5, 0), Q.Identity) }));
    const Top = R.getOrThrow(E.make(model(), { id: "top",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0, 1.5, 0), Q.Identity) }));
    let World = R.getOrThrow(W.make());
    for (const Body of [ Ground, Bottom, Top ])
    {
        World = R.getOrThrow(W.add(World, Body));
    }

    const Settled = ticks(World, 40);
    near(body(Settled, "bottom").pose.position.y, 0.5, 0.02);
    near(body(Settled, "top").pose.position.y, 1.5, 0.04);
    Assert.ok(body(Settled, "bottom").sleeping);
    Assert.ok(body(Settled, "top").sleeping);
    const Unsupported = ticks(R.getOrThrow(W.remove(Settled, "ground")), 2);
    Assert.equal(body(Unsupported, "bottom").sleeping, false);
    Assert.ok(body(Unsupported, "bottom").linearVelocity.y < -0.9);
    const Woken = R.getOrThrow(W.modify(Settled, "bottom", E.applyImpulse(V.UnitX)));
    const Moving = ticks(Woken, 1);
    Assert.equal(body(Moving, "top").sleeping, false);
    const Slider = R.getOrThrow(E.make(model(), { id: "slide",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0, 0.5, 0), Q.Identity),
        linearVelocity: V.Vector3Unsafe(2, 0, 0) }));
    let Sliding = R.getOrThrow(W.make());
    Sliding = R.getOrThrow(W.add(Sliding, Ground));
    Sliding = R.getOrThrow(W.add(Sliding, Slider));
    const Slowed = body(ticks(Sliding, 5), "slide");
    Assert.ok(Slowed.linearVelocity.x < 1.2 && Slowed.linearVelocity.x > 0);
    for (const Force of [ 4, 6 ])
    {
        // Large source inertia isolates sliding friction from initial rolling/pressure transients.
        const Flywheel = {...model(V.Vector3Unsafe(1_000, 1_000, 1_000)),
            collision:R.getOrThrow(S.primitive("box", V.Vector3Unsafe(0.5, 0.5, 0.5)))};
        const Loaded = R.getOrThrow(E.applyForce(R.getOrThrow(E.make(Flywheel, {id:"friction",
            pose:T.TransformUnsafe(V.Vector3Unsafe(0, 0.5, 0), Q.Identity)})), V.Vector3Unsafe(Force, -10, 0)));
        let Scene = R.getOrThrow(W.make({gravity:V.Zero}));
        Scene = R.getOrThrow(W.add(Scene, Ground));
        Scene = R.getOrThrow(W.add(Scene, Loaded));
        near(body(ticks(Scene, 1), "friction").linearVelocity.x, Force < 5 ? 0 : 0.05, 2e-3);
    }
});

test("full-tensor free rotation conserves angular momentum with bounded energy drift", () =>
{
    const Rotating = R.getOrThrow(E.make(model(V.Vector3Unsafe(1, 2, 3)), { id: "spin",
        angularVelocity: V.Vector3Unsafe(0.7, 1.1, 0.3),
        allowSleep: false }));
    const Energy = (b: E.PhysicsEntity): number => V.dot(b.angularMomentum, b.angularVelocity) / 2;
    const Final = body(ticks(R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Rotating)), 40), "spin");
    near(Final.angularMomentum.x, Rotating.angularMomentum.x);
    near(Final.angularMomentum.y, Rotating.angularMomentum.y);
    near(Final.angularMomentum.z, Rotating.angularMomentum.z);
    near(Energy(Final), Energy(Rotating), 5e-4);
});

test("impact-driven motion replanning catches a second obstacle outside the original light-body bounds", () =>
{
    const Heavy = R.getOrThrow(E.make(model(V.One, 1_000, "sphere"), { id: "heavy",
        pose: T.TransformUnsafe(V.Vector3Unsafe(-2, 0, 0), Q.Identity),
        linearVelocity: V.Vector3Unsafe(1_000, 0, 0),
        restitution: 1 }));
    const Light = R.getOrThrow(E.make(model(V.One, 1, "sphere"), { id: "light",
        restitution: 1 }));
    const Wall = R.getOrThrow(E.make(model(V.Vector3Unsafe(0.02, 5, 5)), { id: "wall",
        mode: "static",
        pose: T.TransformUnsafe(V.Vector3Unsafe(60, 0, 0), Q.Identity) }));
    let Scene = R.getOrThrow(W.make({ gravity: V.Zero }));
    for (const Body of [ Heavy, Light, Wall ])
    {
        Scene = R.getOrThrow(W.add(Scene, Body));
    }

    const Next = ticks(Scene, 1);
    Assert.ok(body(Next, "light").pose.position.x < 59.491);
    Assert.ok(Next.events.some((e) => e.first === "light" && e.second === "wall" && e.type === "begin"));
});

test("rotation-only continuous contact transfers angular momentum into physical response", () =>
{
    const Rod = R.getOrThrow(E.make(model(V.Vector3Unsafe(0.2, 0.2, 4)), { id: "rod",
        angularVelocity: V.Vector3Unsafe(0, 2 * Math.PI, 0) }));
    const Stop = R.getOrThrow(E.make(model(V.Vector3Unsafe(0.5, 0.5, 0.5), 1, "sphere"), { id: "stop",
        mode: "static",
        pose: T.TransformUnsafe(V.Vector3Unsafe(1.5, 0, 0), Q.Identity) }));
    let Scene = R.getOrThrow(W.make({ gravity: V.Zero }));
    Scene = R.getOrThrow(W.add(Scene, Rod));
    Scene = R.getOrThrow(W.add(Scene, Stop));
    let touched = false;
    for (let i = 0;i < 10;i++)
    {
        Scene = ticks(Scene, 1);
        touched ||= Scene.events.some((e) => e.type === "begin");
    }

    Assert.ok(touched);
    Assert.ok(body(Scene, "rod").angularMomentum.y < Rod.angularMomentum.y - 0.1);
    Assert.ok(Equal.equals(body(Scene, "stop").pose, Stop.pose));
});

test("offset-COM rotation preserves COM while intervals and origin-motion follow the model origin", () =>
{
    const Initial = R.getOrThrow(E.make(model(), { id: "offset",
        centerOfMass: V.UnitX,
        angularVelocity: V.UnitY,
        allowSleep: false }));
    const Last = body(ticks(R.getOrThrow(W.add(R.getOrThrow(W.make({ gravity: V.Zero })), Initial)), 20), "offset");
    const Center = E.centerOfMass(Last);
    near(Center.x, 1);
    near(Center.z, 0);
    near(Last.pose.position.x, 1 - Math.cos(1));
    near(Last.pose.position.z, Math.sin(1));
    near(Last.interval.start.position.z, Math.sin(0.95));
    near(Last.interval.end.position.z, Math.sin(1));
    Assert.ok(T.isTransform(Last.interval.start));
    near(Last.linearVelocity.x, 0);
    near(E.motion(Last).linearVelocity.x, Math.sin(1));
});

test("nested options are owned, forged bodies fail, and a failed motion bound pauses only its island", () =>
{
    const Input = { x: 1,
        y: 0,
        z: 0 };
    const Override = O.some(Input);
    const Owned = R.getOrThrow(E.make(model(), { id: "owned",
        gravity: Override }));
    Input.x = 99;
    Assert.equal(O.getOrThrow(Owned.gravity).x, 1);
    Assert.ok(Object.isFrozen(Owned.gravity));
    Assert.equal(Object.isFrozen(Input), false);
    const Forged = Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(Owned)), Owned));
    Assert.equal(E.isPhysicsEntity(Forged), false);
    Assert.ok(R.isFailure(W.add(R.getOrThrow(W.make()), Forged)));
    Assert.ok(R.isFailure(E.applyImpulse(Forged, V.UnitX)));
    const Loaded = R.getOrThrow(E.applyForce(R.getOrThrow(E.make(model(), { id: "bad" })), V.Vector3Unsafe(1e308, 0, 0)));
    const Far = R.getOrThrow(E.make(model(), { id: "far",
        pose: T.TransformUnsafe(V.Vector3Unsafe(100, 0, 0), Q.Identity),
        linearVelocity: V.UnitX }));
    let Scene = R.getOrThrow(W.make({ gravity: V.Zero }));
    Scene = R.getOrThrow(W.add(Scene, Loaded));
    Scene = R.getOrThrow(W.add(Scene, Far));
    const Next = R.getOrThrow(W.step(Scene));
    Assert.ok(body(Next, "bad").paused);
    near(body(Next, "far").pose.position.x, 100.05);
    near(body(Next, "bad").force.x, 1e308);
    Assert.equal(Next.diagnostics[0].code, "NumericalFailure");
    Assert.ok(R.isFailure(W.modify(Scene, "far", () =>
    {
        throw new Error("caller error");
    })));
    const Paused = R.getOrThrow(E.pause(Far));
    Assert.equal(E.motion(Paused).linearVelocity.x, 0);
    near(Paused.linearVelocity.x, 1);
    Assert.ok(Equal.equals(Paused, R.getOrThrow(E.pause(Paused))));
    Assert.equal(R.getOrThrow(E.resume(Paused)).paused, false);
});

test("failures roll back connected islands while unrelated bodies advance and remain recoverable", () =>
{
    const A = R.getOrThrow(E.make(model(), { id: "a" }));
    const Bv = R.getOrThrow(E.make(model(V.Vector3Unsafe(1.4, 0.8, 1), 1, "ellipsoid"), { id: "b",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0.2, 0, 0), Q.Identity) }));
    const Far = R.getOrThrow(E.make(model(), { id: "far",
        pose: T.TransformUnsafe(V.Vector3Unsafe(100, 0, 0), Q.Identity),
        linearVelocity: V.UnitX }));
    let World = R.getOrThrow(W.make({ gravity: V.Zero,
        collision: { maxEpaIterations: 1 } }));
    for (const Value of [ A, Bv, Far ])
    {
        World = R.getOrThrow(W.add(World, Value));
    }

    const Next = R.getOrThrow(W.step(World));
    Assert.equal(Next.diagnostics.length, 1);
    Assert.deepEqual(Next.diagnostics[0].bodies, [ "a", "b" ]);
    Assert.ok(body(Next, "a").paused);
    Assert.ok(body(Next, "b").paused);
    Assert.equal(Next.bodies.length, 3);
    near(body(Next, "a").pose.position.x, 0);
    near(body(Next, "far").pose.position.x, 100.05);
    const Resumed = R.getOrThrow(E.resume(body(Next, "a")));
    Assert.equal(Resumed.paused, false);
    let Repaired = R.getOrThrow(W.set(Next, Resumed));
    const Separated = R.getOrThrow(E.resume(R.getOrThrow(E.setPose(body(Next, "b"), T.TransformUnsafe(V.Vector3Unsafe(10, 0, 0), Q.Identity)))));
    Repaired = R.getOrThrow(W.set(Repaired, Separated));
    Assert.equal(body(ticks(Repaired, 1), "a").paused, false);

});

test("ordered events, protocol values, immutable intervals, resets and render independence", () =>
{
    const Ball = R.getOrThrow(E.make(model(V.One, 1, "sphere"), { id: "ball",
        pose: T.TransformUnsafe(V.Vector3Unsafe(0, 1, 0), Q.Identity) }));
    const Ground = R.getOrThrow(E.make(model(V.Vector3Unsafe(10, 1, 10)), { id: "ground",
        mode: "static" }));
    let World = R.getOrThrow(W.make());
    World = R.getOrThrow(W.add(World, Ball));
    World = R.getOrThrow(W.add(World, Ground));
    const Next = ticks(World, 1);
    const Current = body(Next, "ball");
    Assert.ok(Next.events.some((e) => e.type === "begin"));
    Assert.ok(Equal.equals(Current.interval.start, Ball.pose));
    Assert.ok(Equal.equals(Current.interval.end, Current.pose));
    Assert.equal(Current.interval.duration, 0.05);
    Assert.equal(Current.interval.sequence, 1);
    const Teleported = R.getOrThrow(E.setPose(Current, T.TransformUnsafe(V.Vector3Unsafe(0, 10, 0), Q.Identity)));
    Assert.equal(Teleported.interval.reset, 1);
    Assert.ok(Equal.equals(Teleported.interval.start, Teleported.interval.end));
    const Removed = R.getOrThrow(W.remove(Next, "ball"));
    Assert.ok(Removed.events.some((e) => e.type === "end"));
    Assert.ok(O.isNone(R.getOrThrow(W.get(Removed, "ball"))));
    const Copy = R.getOrThrow(W.step(World));
    Assert.ok(Equal.equals(Next, Copy));
    Assert.equal(Hash.hash(Next), Hash.hash(Copy));
    Assert.equal(HashSet.size(HashSet.make(Next, Copy)), 1);
    for (const Rate of [ 20, 60, 144 ])
    {
        for (let i = 0; i < Rate; i++)
        {
            R.getOrThrow(Render.encode(Current.interval));
        }

        Assert.ok(Equal.equals(R.getOrThrow(W.step(World)), Next));
    }

    Assert.ok(R.isFailure(E.make(model(), { id: "invalid",
        mass: -1 })));
    Assert.ok(R.isFailure(E.make(model(), { id: "invalid",
        mass: 1,
        density: 1 } as unknown as E.Options)));
    Assert.ok(R.isFailure(E.applyImpulse(Ball, V.Vector3Unsafe(Infinity, 0, 0))));
    Assert.ok(R.isFailure(W.add(World, Ball)));
    Assert.ok(R.isFailure(W.make({ maxImpacts: 0 })));
});

test("profiling and branched refitted worlds preserve identical authoritative results", () =>
{
    let World = R.getOrThrow(W.make());
    World = R.getOrThrow(W.add(World, R.getOrThrow(E.make(model(), { id: "moving",
        linearVelocity: V.UnitX }))));
    World = R.getOrThrow(W.step(World));
    const Before = JSON.stringify(World);
    const Samples: Array<W.StepMetrics> = [];
    const Plain = R.getOrThrow(W.step(World));
    const Observed = R.getOrThrow(W.step(World, (sample) =>
    {
        Samples.push(sample);
        throw new Error("ignored observer failure");
    }));
    Assert.ok(Equal.equals(Plain, Observed));
    Assert.equal(Hash.hash(Plain), Hash.hash(Observed));
    const Changed = R.getOrThrow(W.modify(World, "moving", E.setLinearVelocity(V.UnitY)));
    R.getOrThrow(W.step(Changed));
    Assert.ok(Equal.equals(R.getOrThrow(W.step(World)), Plain));
    Assert.equal(JSON.stringify(World), Before);
    Assert.equal(Samples.length, 1);
    Assert.ok(Object.isFrozen(Samples[0]));
    Assert.equal(Samples[0].maxIslandBodies, 1);
    Assert.ok(Samples[0].broadPhaseMs >= 0);
});
