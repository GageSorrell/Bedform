/**
 * Pure fixed-step weighted motion and frozen-camera projection for lever, slider and circular wheel input.
 *
 * @module bedform/Diagetic/Simulation
 *
 * @file      Simulation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Motion equations and snapshot fields retain semantic ordering. */
/* eslint-disable sort-keys */

import { CheckValue, Configure, Coordinates } from "../Internal/DiageticConfiguration.js";
import type { Configuration, Kind, Limits, Spring } from "../Diagetic.js";
import type { Vector2, Vector3 } from "@minecraft/server";

/**
 * Simulation seconds per native twenty-hertz tick. Step never accepts variable elapsed time.
 *
 * @category Constant
 * @since 1.0.0
 */
export const StepSeconds = 0.05 as const;

/**
 * Camera and mounting basis contracts, expressed in world coordinates.
 *
 * @category Model
 * @since 1.0.0
 */
export namespace Frame
{
    /**
     * Frozen camera origin and orthonormal view axes. Right cross Up equals negative Forward.
     * No field of view or client setting is read or changed.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface Camera
    {
        readonly Position: Readonly<Vector3>;
        readonly Right: Readonly<Vector3>;
        readonly Up: Readonly<Vector3>;
        readonly Forward: Readonly<Vector3>;
    }

    /**
     * World-space hub and orthonormal local interaction plane. Right cross Up equals Normal.
     * The slider follows local X; lever and wheel rotate in local XY about this normal.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface Mount
    {
        readonly Position: Readonly<Vector3>;
        readonly Right: Readonly<Vector3>;
        readonly Up: Readonly<Vector3>;
        readonly Normal: Readonly<Vector3>;
    }
}

/**
 * A copied frozen view and mounting frame for one drag, independent of later player or entity motion.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Frame
{
    readonly Camera: Frame.Camera;
    readonly Mount: Frame.Mount;
}

/**
 * Measured or correction-gap-estimated look deltas in degrees: positive yaw moves screen-right,
 * positive pitch moves screen-down. Sensitivity scales angular displacement before projection.
 *
 * @category Model
 * @since 1.0.0
 */
export interface LookSample
{
    readonly Delta: Readonly<Vector2>;
    readonly Estimated?: boolean;
}

/**
 * Immutable scalar motion and local geometry. Velocity uses value units per second.
 * Pointer is the unconstrained projected local cursor during dragging; Point always obeys the
 * track, arc or rim constraint. Estimated describes the last accepted look during this drag.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Snapshot
{
    readonly Value: number;
    readonly Velocity: number;
    readonly Target: number;
    readonly Dragging: boolean;
    readonly Settled: boolean;
    readonly Estimated: boolean;
    readonly Pointer?: Readonly<Vector2>;
    readonly Point: Readonly<Vector3>;
}

/**
 * Explicit pure simulation lifetime. Begin snapshots a frame and optional local grab point;
 * Look changes the target, Step advances exactly one fixed tick, and Release permits settling.
 * Invalid numeric operations throw without committing partial state. Parallel or behind-camera
 * projected rays are ignored. SetValue resets velocity and rebases an active drag.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Controller
{
    readonly State: Snapshot;
    readonly Begin: (frame: Frame, pointer?: Readonly<Vector2>) => void;
    readonly Look: (sample: LookSample) => boolean;
    readonly Release: () => void;
    readonly Step: () => Snapshot;
    readonly SetValue: (value: number) => void;
}

interface Policy
{
    readonly Kind: Kind;
    readonly Initial: number;
    readonly Sensitivity: number;
    readonly Inertia: number;
    readonly Damping: number;
    readonly Friction: number;
    readonly DriveStrength: number;
    readonly DetentStrength: number;
    readonly Limits?: Limits;
    readonly Detents: ReadonlyArray<number>;
    readonly Spring?: Spring;
    readonly Range: number;
    readonly Arc: number;
    readonly Arm: number;
    readonly Length: number;
    readonly Radius: number;
    readonly DeadZone: number;
}

const Radians = Math.PI / 180;
const Degrees = 180 / Math.PI;
const GeometryEpsilon = 1e-8;

/**
 * Rejects unrepresentable intermediate arithmetic before it can reach motion state.
 *
 * @throws { RangeError } If arithmetic is non-finite.
 *
 * @category Validation
 * @since 1.0.0
 */
const Finite = (value: number): number =>
{
    if (!Number.isFinite(value))
    {
        throw new RangeError("Diagetic motion arithmetic must remain finite");
    }

    return value;
};

/**
 * Copies finite two-dimensional coordinates.
 *
 * @throws { RangeError } If coordinates are missing or non-finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Pair = (value: Readonly<Vector2>): Readonly<Vector2> =>
{
    if (!value)
    {
        throw new RangeError("Diagetic motion requires finite pointer coordinates");
    }

    return Object.freeze({ x: Finite(value.x),
        y: Finite(value.y) });
};

/**
 * Computes a checked dot product.
 *
 * @throws { RangeError } If the result is unrepresentable.
 *
 * @category Calculating
 * @since 1.0.0
 */
const Dot = (a: Readonly<Vector3>, b: Readonly<Vector3>): number =>
{
    return Finite(a.x * b.x + a.y * b.y + a.z * b.z);
};

/**
 * Subtracts finite world vectors without silently overflowing.
 *
 * @throws { RangeError } If the difference is unrepresentable.
 *
 * @category Calculating
 * @since 1.0.0
 */
const Subtract = (a: Readonly<Vector3>, b: Readonly<Vector3>): Readonly<Vector3> =>
{
    return Coordinates({ x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z });
};

/**
 * Requires a unit, orthogonal basis with the requested orientation.
 *
 * @throws { RangeError } If basis vectors are scaled, skewed or inconsistently handed.
 *
 * @category Validation
 * @since 1.0.0
 */
const Basis = (right: Readonly<Vector3>, up: Readonly<Vector3>, normal: Readonly<Vector3>): void =>
{
    const cross = { x: right.y * up.z - right.z * up.y,
        y: right.z * up.x - right.x * up.z,
        z: right.x * up.y - right.y * up.x };
    if ([ right, up, normal ].some((axis: Readonly<Vector3>) => Math.abs(Math.hypot(
        axis.x, axis.y, axis.z) - 1) > 1e-6) || Math.abs(Dot(right, up)) > 1e-6 ||
        Math.abs(Dot(right, normal)) > 1e-6 || Math.abs(Dot(up, normal)) > 1e-6 ||
        Dot(cross, normal) < 1 - 1e-6)
    {
        throw new RangeError("Diagetic motion requires an orthonormal camera and mounting frame");
    }
};

/**
 * Detaches and freezes a complete frame from caller-owned coordinates, validating both bases.
 * Custom controls use the same validation as built-in motion.
 *
 * @throws { RangeError } If the frame or basis is invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const CopyFrame = (input: Frame): Frame =>
{
    if (!input?.Camera || !input.Mount)
    {
        throw new RangeError("Diagetic motion requires camera and mount frames");
    }

    const Camera = Object.freeze({ Position: Coordinates(input.Camera.Position),
        Right: Coordinates(input.Camera.Right),
        Up: Coordinates(input.Camera.Up),
        Forward: Coordinates(input.Camera.Forward) });
    const Mount = Object.freeze({ Position: Coordinates(input.Mount.Position),
        Right: Coordinates(input.Mount.Right),
        Up: Coordinates(input.Mount.Up),
        Normal: Coordinates(input.Mount.Normal) });
    Basis(Camera.Right, Camera.Up, { x: -Camera.Forward.x,
        y: -Camera.Forward.y,
        z: -Camera.Forward.z });
    Basis(Mount.Right, Mount.Up, Mount.Normal);
    return Object.freeze({ Camera,
        Mount });
};

/**
 * Projects a local grab point into the frozen camera's unit-depth screen plane.
 *
 * @throws { RangeError } If the control is behind the camera or arithmetic overflows.
 *
 * @category Transforming
 * @since 1.0.0
 */
const Screen = (frame: Frame, point: Readonly<Vector2>): Readonly<Vector2> =>
{
    const { Camera, Mount } = frame;
    const world = Coordinates({ x: Mount.Position.x + Mount.Right.x * point.x + Mount.Up.x * point.y,
        y: Mount.Position.y + Mount.Right.y * point.x + Mount.Up.y * point.y,
        z: Mount.Position.z + Mount.Right.z * point.x + Mount.Up.z * point.y });
    const offset = Subtract(world, Camera.Position);
    const depth = Dot(offset, Camera.Forward);
    if (depth <= GeometryEpsilon)
    {
        throw new RangeError("Diagetic grab point must be in front of the frozen camera");
    }

    return Pair({ x: Dot(offset, Camera.Right) / depth,
        y: Dot(offset, Camera.Up) / depth });
};

/**
 * Intersects a frozen screen ray with the mounting plane and returns local XY coordinates.
 *
 * @throws { RangeError } If finite coordinates cannot represent the intersection.
 *
 * @category Transforming
 * @since 1.0.0
 */
const Project = (frame: Frame, screen: Readonly<Vector2>): Readonly<Vector2> | undefined =>
{
    const { Camera, Mount } = frame;
    const ray = Coordinates({ x: Camera.Forward.x + Camera.Right.x * screen.x + Camera.Up.x * screen.y,
        y: Camera.Forward.y + Camera.Right.y * screen.x + Camera.Up.y * screen.y,
        z: Camera.Forward.z + Camera.Right.z * screen.x + Camera.Up.z * screen.y });
    const denominator = Dot(Mount.Normal, ray);
    if (Math.abs(denominator) <= GeometryEpsilon)
    {
        return undefined;
    }

    const t = Finite(Dot(Mount.Normal, Subtract(Mount.Position, Camera.Position)) / denominator);
    if (t <= GeometryEpsilon)
    {
        return undefined;
    }

    const offset = Coordinates({ x: Camera.Position.x + ray.x * t - Mount.Position.x,
        y: Camera.Position.y + ray.y * t - Mount.Position.y,
        z: Camera.Position.z + ray.z * t - Mount.Position.z });
    return Pair({ x: Dot(offset, Mount.Right),
        y: Dot(offset, Mount.Up) });
};

/**
 * Computes the constrained local handle position from scalar value.
 *
 * @throws { RangeError } If configured geometry cannot represent a finite point.
 *
 * @category Transforming
 * @since 1.0.0
 */
const Point = (policy: Policy, value: number): Readonly<Vector3> =>
{
    if (policy.Kind === "slider")
    {
        return Coordinates({ x: ((value - policy.Limits!.Min) / policy.Range - 0.5) * policy.Length,
            y: 0,
            z: 0 });
    }

    const angle = policy.Kind === "wheel" ? value % 360 :
        Finite(((value - policy.Limits!.Min) / policy.Range - 0.5) * policy.Arc) % 360;
    const radians = angle * Radians;
    return policy.Kind === "wheel"
        ? Coordinates({ x: policy.Radius * Math.cos(radians),
            y: policy.Radius * Math.sin(radians),
            z: 0 })
        : Coordinates({ x: policy.Arm * Math.sin(radians),
            y: policy.Arm * Math.cos(radians),
            z: 0 });
};

/**
 * Rejects angular jumps through the hub, including segments whose endpoints are outside the dead zone.
 *
 * @throws { RangeError } If a pointer segment is not representable.
 *
 * @category Predicate
 * @since 1.0.0
 */
const CrossesHub = (from: Readonly<Vector2>, to: Readonly<Vector2>, deadZone: number): boolean =>
{
    const dx = Finite(to.x - from.x);
    const dy = Finite(to.y - from.y);
    const length = Finite(Math.hypot(dx, dy));
    if (length === 0)
    {
        return Math.hypot(from.x, from.y) <= deadZone;
    }

    const ux = dx / length;
    const uy = dy / length;
    const t = Math.max(0, Math.min(length, -Finite(from.x * ux + from.y * uy)));
    return Math.hypot(Finite(from.x + t * ux), Finite(from.y + t * uy)) <= deadZone;
};

/**
 * Extracts only numeric, callback-free policy so entity WeakMap state never retains user callbacks.
 *
 * @throws { RangeError } If a value span or derived physical coefficient is unrepresentable.
 *
 * @category Converting
 * @since 1.0.0
 */
const NumericPolicy = (config: Configuration): Policy =>
{
    return Object.freeze({ Kind: config.Kind,
        Initial: config.InitialValue!,
        Sensitivity: config.Sensitivity!,
        Inertia: config.Inertia!,
        Damping: config.Damping!,
        Friction: config.Friction!,
        DriveStrength: config.DriveStrength!,
        DetentStrength: config.DetentStrength!,
        Limits: config.Limits,
        Detents: config.Detents!,
        Spring: config.Spring,
        Range: config.Limits ? Finite(config.Limits.Max - config.Limits.Min) : 360,
        Arc: config.Kind === "lever" ? config.ArcDegrees! : 0,
        Arm: config.Kind === "lever" ? config.ArmLength! : 0,
        Length: config.Kind === "slider" ? config.Length! : 0,
        Radius: config.Kind === "wheel" ? config.Radius! : 0,
        DeadZone: config.Kind === "wheel" ? config.DeadZone! : GeometryEpsilon });
};

/**
 * Constructs motion from data without capturing the original configuration or any native entity.
 * Implicit spring/damper integration keeps stiff positive systems stable at the fixed timestep.
 *
 * @throws { RangeError } If physical coefficients or initial state cannot remain finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Create = (policy: Policy, initial: number): Controller =>
{
    const drive = Finite(policy.DriveStrength / policy.Inertia);
    const damping = Finite(policy.Damping / policy.Inertia);
    const friction = Finite(policy.Friction / policy.Inertia);
    const restoring = Finite((policy.Spring?.Strength || policy.DetentStrength) / policy.Inertia);
    const epsilon = Math.max(1, policy.Range) * 1e-7;
    const velocityEpsilon = epsilon / StepSeconds;
    let value = CheckValue(initial, policy.Limits);
    let velocity = 0;
    let target = value;
    let dragging = false;
    let estimated = false;
    let frame: Frame | undefined;
    let screen: Readonly<Vector2> | undefined;
    let pointer: Readonly<Vector2> | undefined;

    const clamp = (next: number): number => policy.Limits
        ? Math.max(policy.Limits.Min, Math.min(policy.Limits.Max, Finite(next))) : Finite(next);
    const rest = (position: number, speed: number): number =>
    {
        if (policy.Spring && policy.Spring.Strength > 0)
        {
            return policy.Spring.Target;
        }

        let nearest = position;
        let distance = Infinity;
        if (policy.DetentStrength > 0)
        {
            for (const detent of policy.Detents)
            {
                const delta = Math.abs(Finite(detent - position));
                if (delta < distance || delta === distance &&
                    (speed > 0 ? detent > nearest : detent < nearest))
                {
                    nearest = detent;
                    distance = delta;
                }
            }
        }

        return nearest;
    };

    const restRate = (): number => (policy.Spring?.Strength ?? 0) > 0 ||
        policy.Detents.length > 0 && policy.DetentStrength > 0 ? restoring : 0;
    const settled = (position: number, speed: number, goal: number, rate: number): boolean =>
        Math.abs(speed) <= velocityEpsilon && (rate === 0 || Math.abs(goal - position) <= epsilon ||
            Math.abs(goal - position) <= friction / rate);
    const snapshot = (): Snapshot => Object.freeze({ Value: value,
        Velocity: velocity,
        Target: target,
        Dragging: dragging,
        Settled: settled(value, velocity, target, dragging ? drive : restRate()),
        Estimated: estimated,
        Pointer: pointer,
        Point: Point(policy, value) });
    target = rest(value, 0);
    Finite(target - value);
    Point(policy, value);

    return Object.freeze({
        get State(): Snapshot { return snapshot(); },
        Begin(input: Frame, grabPoint?: Readonly<Vector2>): void
        {
            const nextFrame = CopyFrame(input);
            const nextPointer = Pair(grabPoint ?? Point(policy, value));
            const nextScreen = Screen(nextFrame, nextPointer);
            if (!Project(nextFrame, nextScreen))
            {
                throw new RangeError("Diagetic interaction plane cannot be projected from this camera");
            }

            frame = nextFrame;
            screen = nextScreen;
            pointer = nextPointer;
            velocity = 0;
            target = value;
            dragging = true;
            estimated = false;
        },
        Look(sample: LookSample): boolean
        {
            if (!dragging || !frame || !screen || !pointer)
            {
                throw new Error("Diagetic Look requires an active drag");
            }

            const delta = Pair(sample?.Delta);
            if (sample.Estimated !== undefined && typeof sample.Estimated !== "boolean")
            {
                throw new TypeError("Diagetic Estimated must be a boolean");
            }

            const nextScreen = Pair({ x: screen.x + delta.x * Radians * policy.Sensitivity,
                y: screen.y - delta.y * Radians * policy.Sensitivity });
            const nextPointer = Project(frame, nextScreen);
            if (!nextPointer)
            {
                return false;
            }

            let change = 0;
            if (policy.Kind === "slider")
            {
                change = Finite((nextPointer.x - pointer.x) / policy.Length * policy.Range);
            }
            else
            {
                const fromRadius = Finite(Math.hypot(pointer.x, pointer.y));
                const toRadius = Finite(Math.hypot(nextPointer.x, nextPointer.y));
                const deadZone = Math.max(GeometryEpsilon, policy.DeadZone);
                if (fromRadius > deadZone && toRadius > deadZone &&
                    !CrossesHub(pointer, nextPointer, deadZone))
                {
                    const ax = pointer.x / fromRadius;
                    const ay = pointer.y / fromRadius;
                    const bx = nextPointer.x / toRadius;
                    const by = nextPointer.y / toRadius;
                    const angle = Math.atan2(ax * by - ay * bx, ax * bx + ay * by) * Degrees;
                    change = policy.Kind === "wheel" ? angle : -angle / policy.Arc * policy.Range;
                }
            }

            const nextTarget = clamp(Finite(target + change));
            Finite(nextTarget - value);
            target = nextTarget;
            screen = nextScreen;
            pointer = nextPointer;
            estimated = sample.Estimated ?? false;
            return true;
        },
        Release(): void
        {
            if (dragging)
            {
                const nextTarget = rest(value, velocity);
                Finite(nextTarget - value);
                target = nextTarget;
                dragging = false;
                estimated = false;
                frame = undefined;
                screen = undefined;
                pointer = undefined;
            }
        },
        SetValue(next: number): void
        {
            CheckValue(next, policy.Limits);
            Point(policy, next);
            const nextPointer = dragging ? Pair(Point(policy, next)) : undefined;
            const nextScreen = frame && nextPointer ? Screen(frame, nextPointer) : undefined;
            if (frame && nextScreen && !Project(frame, nextScreen))
            {
                throw new RangeError("Diagetic updated handle cannot be projected from this camera");
            }

            const nextTarget = dragging ? next : rest(next, 0);
            Finite(nextTarget - next);
            value = next;
            velocity = 0;
            target = nextTarget;
            pointer = nextPointer;
            screen = nextScreen;
            estimated = false;
        },
        Step(): Snapshot
        {
            const rate = dragging ? drive : restRate();
            const error = Finite(target - value);
            const denominator = Finite(1 + StepSeconds * damping + StepSeconds * StepSeconds * rate);
            const driven = Finite(velocity / denominator + StepSeconds * rate / denominator * error);
            let nextVelocity = Math.sign(driven) * Math.max(0,
                Math.abs(driven) - StepSeconds * friction / denominator);
            let nextValue = clamp(Finite(value + StepSeconds * nextVelocity));
            if (policy.Limits && (nextValue === policy.Limits.Min && nextVelocity < 0 ||
                nextValue === policy.Limits.Max && nextVelocity > 0))
            {
                nextVelocity = 0;
            }

            if (Math.abs(nextVelocity) <= velocityEpsilon &&
                (rate === 0 || Math.abs(target - nextValue) <= epsilon))
            {
                nextVelocity = 0;
                if (rate > 0)
                {
                    nextValue = target;
                }
            }

            Point(policy, nextValue);
            value = nextValue;
            velocity = nextVelocity;
            if (!dragging && rate === 0)
            {
                target = nextValue;
            }

            return snapshot();
        }
    });
};

/**
 * Creates callback-free, host-independent fixed-step motion from a control configuration.
 * Default lever detents choose the nearest endpoint; positive return springs take precedence.
 * Sliders and unbounded wheels retain their position after damping/friction dissipates momentum.
 * Zero damping and friction intentionally permit indefinite free coasting after release.
 *
 * @throws { TypeError } If configuration is invalid.
 * @throws { RangeError } If policy or initial state cannot be represented finitely.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Make = (configuration: Configuration, initialValue?: number): Controller =>
{
    const policy = NumericPolicy(Configure(configuration));
    return Create(policy, initialValue ?? policy.Initial);
};

/**
 * Moves a local interaction-plane pointer by one look sample through a frozen frame, using the same
 * unit-depth screen projection and sensitivity scaling as built-in controls. Pointer and result are
 * local XY coordinates in blocks. Returns undefined when the moved ray is parallel to the plane or
 * points behind the camera, so custom controls can ignore that sample without changing state.
 *
 * @throws { RangeError } If the frame, pointer, delta or sensitivity is invalid, or the pointer is
 * behind the camera.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const MovePointer = (frame: Frame, pointer: Readonly<Vector2>, delta: Readonly<Vector2>,
    sensitivity: number = 1): Readonly<Vector2> | undefined =>
{
    if (!Number.isFinite(sensitivity) || sensitivity < 0)
    {
        throw new RangeError("Diagetic sensitivity must be finite and nonnegative");
    }

    const copy = CopyFrame(frame);
    const screen = Screen(copy, Pair(pointer));
    const move = Pair(delta);
    return Project(copy, Pair({ x: screen.x + move.x * Radians * sensitivity,
        y: screen.y - move.y * Radians * sensitivity }));
};
