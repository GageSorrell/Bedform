/**
 * Analytic shared Gizmo solids, nearest-hit picking and offset-preserving local drag projection.
 *
 * @module bedform/Internal/GizmoGeometry
 *
 * @file      GizmoGeometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Geometry and snapshots retain spatial ordering. */
/* eslint-disable sort-keys */

import { Add, Camera, Cross, Dot, Inverse, Mul, Product, Rotate, Sub, V, View } from "./GizmoMath.js";
import type { Basis, Box, Capsule, Drag, Focus, Geometry, Options, Part, Pick, Primitive,
    Ray, Result } from "../Diagetic/Gizmo/Geometry.js";
import type { Handle, Mode, Query, Runtime } from "../Diagetic/Gizmo.js";
import { Parameter } from "./DiageticConfiguration.js";
import type { Coordinates as Quat } from "../Quat.js";
import { SnapshotTransform } from "./Gizmo.js";
import type { Vector3 } from "@minecraft/server";
import { isSome } from "@bedform/effect/Option";
import { quaternionToAngles } from "./Rotation.js";

const Zero = V({ x: 0,
    y: 0,
    z: 0 });
const One = V({ x: 1,
    y: 1,
    z: 1 });
const Local: Basis = Object.freeze({ X: V({ x: 1,
    y: 0,
    z: 0 }),
Y: V({ x: 0,
    y: 1,
    z: 0 }),
Z: V({ x: 0,
    y: 0,
    z: 1 }) });
const Axis = Object.freeze([ "x", "y", "z" ] as const);
const Plane = Object.freeze([ "xy", "xz", "yz" ] as const);
const Color = Object.freeze({ x: "red",
    y: "green",
    z: "blue",
    xy: "yellow",
    xz: "magenta",
    yz: "cyan",
    camera: "white",
    uniform: "white" } as const);
const ProjectionTolerance = 1e-5;
const DegreesPerRadian = 180 / Math.PI;

/**
 * Selects a basis vector by local axis identifier.
 *
 * @category Getter
 * @since 1.0.0
 */
const Direction = (basis: Basis, axis: string): Readonly<Vector3> =>
{
    return axis === "x" ? basis.X : axis === "y" ? basis.Y : basis.Z;
};

/**
 * Selects the right-handed in-plane basis for an axis ring or a named local plane.
 *
 * @category Getter
 * @since 1.0.0
 */
const Surface = (basis: Basis, handle: Handle): Basis =>
{
    const x = handle === "x" || handle === "yz" ? basis.Y :
        handle === "y" ? basis.Z : basis.X;
    const y = handle === "x" || handle === "yz" || handle === "xz" ? basis.Z :
        handle === "y" ? basis.X : basis.Y;
    return Object.freeze({ X: x,
        Y: y,
        Z: Cross(x, y) });
};

/**
 * Freezes one shared handle's geometry and color.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Piece = (handle: Handle, primitives: ReadonlyArray<Primitive>): Part =>
{
    return Object.freeze({ Handle: handle,
        Color: Color[handle],
        Primitives: Object.freeze(primitives) });
};

/**
 * Creates one world-space capsule descriptor.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Tube = (start: Readonly<Vector3>, end: Readonly<Vector3>, radius: number): Capsule =>
{
    return Object.freeze({ Kind: "capsule",
        Start: start,
        End: end,
        Radius: radius });
};

/**
 * Creates one world-space oriented box descriptor.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Cube = (center: Readonly<Vector3>, basis: Basis, halfSize: Readonly<Vector3>): Box =>
{
    return Object.freeze({ Kind: "box",
        Center: center,
        Basis: basis,
        HalfSize: halfSize });
};

/**
 * Snapshots local and parent frames and builds a bounded shared geometry array.
 *
 * @throws { TypeError | RangeError } If pose, mode, view or dimensions are malformed.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const BuildGeometry = (options: Options): Geometry =>
{
    if (!options || ![ "translation", "rotation", "scale" ].includes(options.Mode))
    {
        throw new TypeError("Gizmo geometry requires a supported local mode");
    }

    const transform = SnapshotTransform(options.Transform);
    const parent = SnapshotTransform({ ...options.Parent,
        Scale: One });
    const view = View(options.View);
    const size = Parameter(options.Size === undefined ? 1 : options.Size, "geometry size", true);
    const radius = Parameter(options.Tolerance === undefined ? 0.08 : options.Tolerance,
        "geometry tolerance", true);
    const center = Add(parent.Position, Rotate(parent.Rotation, transform.Position));
    const orientation = Product(parent.Rotation, transform.Rotation);
    const basis: Basis = Object.freeze({ X: Rotate(orientation, Local.X),
        Y: Rotate(orientation, Local.Y),
        Z: Rotate(orientation, Local.Z) });
    const camera = Camera(view.Direction);
    const parts: Array<Part> = [];
    for (const axis of Axis)
    {
        const direction = Direction(basis, axis);
        const surface = Surface(basis, axis);
        const point = (distance: number): Readonly<Vector3> => Add(center, Mul(direction, distance * size));
        if (options.Mode === "rotation")
        {
            const ring = (index: number): Readonly<Vector3> => Add(center,
                Mul(Add(Mul(surface.X, Math.cos(index * Math.PI / 24)),
                    Mul(surface.Y, Math.sin(index * Math.PI / 24))), size * 0.75));
            parts.push(Piece(axis, Array.from({ length: 48 }, (_value: unknown, index: number): Capsule =>
                Tube(ring(index), ring((index + 1) % 48), radius))));
            continue;
        }

        const primitives: Array<Primitive> = [ Tube(point(0.18), point(0.85), radius) ];
        if (options.Mode === "scale")
        {
            primitives.push(Cube(point(0.94), basis, Mul(One, 0.09 * size)));
        }
        else
        {
            for (const side of [ surface.X, surface.Y ])
            {
                for (const sign of [ -1, 1 ])
                {
                    primitives.push(Tube(Add(point(0.78), Mul(side, sign * size * 0.1)), point(1), radius));
                }
            }
        }

        parts.push(Piece(axis, primitives));
    }

    if (options.Mode !== "rotation")
    {
        for (const plane of Plane)
        {
            const surface = Surface(basis, plane);
            parts.push(Piece(plane, [ Cube(Add(center, Mul(Add(surface.X, surface.Y), size * 0.34)),
                surface, V({ x: size * 0.09,
                    y: size * 0.09,
                    z: radius * 0.25 })) ]));
        }

        parts.push(options.Mode === "scale" ?
            Piece("uniform", [ Cube(center, basis, Mul(One, size * 0.1)) ]) :
            Piece("camera", [ Cube(center, camera,
                V({ x: size * 0.1,
                    y: size * 0.1,
                    z: radius * 0.25 })) ]));
    }

    return Object.freeze({ Transform: transform,
        Parent: Object.freeze({ Position: parent.Position,
            Rotation: parent.Rotation }),
        Mode: options.Mode,
        Center: center,
        Basis: basis,
        CameraBasis: camera,
        Size: size,
        Tolerance: radius,
        Parts: Object.freeze(parts) });
};

/**
 * Computes forward ray/sphere entry distance, including an origin inside the sphere.
 *
 * @category Getter
 * @since 1.0.0
 */
const Sphere = (ray: Ray, center: Readonly<Vector3>, radius: number): number =>
{
    const delta = Sub(ray.Origin, center);
    const b = Dot(delta, ray.Direction);
    const c = Dot(delta, delta) - radius * radius;
    const discriminant = b * b - c;
    if (c <= 0)
    {
        return 0;
    }

    return discriminant < 0 || -b - Math.sqrt(discriminant) < 0 ? Infinity :
        -b - Math.sqrt(discriminant);
};

/**
 * Computes exact forward ray/capsule entry, retaining endcaps and parallel-ray cases.
 *
 * @category Getter
 * @since 1.0.0
 */
const CapsuleHit = (ray: Ray, shape: Capsule): number =>
{
    const span = Sub(shape.End, shape.Start);
    const offset = Sub(ray.Origin, shape.Start);
    const length = Dot(span, span);
    if (length < 1e-20)
    {
        return Sphere(ray, shape.Start, shape.Radius);
    }

    const projection = Dot(span, offset);
    const closest = Sub(offset, Mul(span, Math.max(0, Math.min(1, projection / length))));
    if (Dot(closest, closest) <= shape.Radius * shape.Radius)
    {
        return 0;
    }

    let distance = Math.min(Sphere(ray, shape.Start, shape.Radius), Sphere(ray, shape.End, shape.Radius));
    const along = Dot(span, ray.Direction);
    const a = length - along * along;
    const b = length * Dot(ray.Direction, offset) - projection * along;
    const c = length * (Dot(offset, offset) - shape.Radius * shape.Radius) - projection * projection;
    const discriminant = b * b - a * c;
    if (a > 1e-12 * length && discriminant >= 0)
    {
        const hit = (-b - Math.sqrt(discriminant)) / a;
        const position = projection + hit * along;
        if (hit >= 0 && position >= 0 && position <= length)
        {
            distance = Math.min(distance, hit);
        }
    }

    return distance;
};

/**
 * Computes exact forward ray/oriented-box entry by local slab intersections.
 *
 * @category Getter
 * @since 1.0.0
 */
const BoxHit = (ray: Ray, shape: Box): number =>
{
    const offset = Sub(ray.Origin, shape.Center);
    let near = 0;
    let far = Infinity;
    for (const axis of Axis)
    {
        const direction = Direction(shape.Basis, axis);
        const origin = Dot(offset, direction);
        const velocity = Dot(ray.Direction, direction);
        const half = shape.HalfSize[axis];
        if (Math.abs(velocity) < 1e-12)
        {
            if (Math.abs(origin) > half)
            {
                return Infinity;
            }

            continue;
        }

        const first = (-half - origin) / velocity;
        const second = (half - origin) / velocity;
        near = Math.max(near, Math.min(first, second));
        far = Math.min(far, Math.max(first, second));
        if (near > far)
        {
            return Infinity;
        }
    }

    return near;
};

/**
 * Picks shared solids with deterministic geometry-order ties and no target-body shortcut.
 *
 * @throws { RangeError } If the ray is malformed.
 *
 * @category Getter
 * @since 1.0.0
 */
export const PickGeometry = (geometry: Geometry, input: Ray): Pick | undefined =>
{
    const ray = View(input);
    let pick: Pick | undefined;
    for (const part of geometry.Parts)
    {
        for (const primitive of part.Primitives)
        {
            const distance = primitive.Kind === "box" ? BoxHit(ray, primitive) : CapsuleHit(ray, primitive);
            if (Number.isFinite(distance) && (!pick || distance < pick.Distance - 1e-9))
            {
                pick = Object.freeze({ Handle: part.Handle,
                    Distance: distance,
                    Position: Add(ray.Origin, Mul(ray.Direction, distance)) });
            }
        }
    }

    return pick;
};

/**
 * Returns one broad-focus target with separately tested handle hover geometry.
 *
 * @throws { TypeError | RangeError | Error } If runtime, mode or adapter geometry is invalid.
 *
 * @category Getter
 * @since 1.0.0
 */
export const FindFocus = (runtime: Runtime, item: string, query: Query, mode?: Mode): Focus | undefined =>
{
    const candidate = runtime.Discover(item, query)[0];
    if (!candidate)
    {
        return undefined;
    }

    const definition = candidate.Definition;
    const selected = mode ?? definition.InitialMode;
    if (!definition.Modes.includes(selected))
    {
        throw new TypeError("Gizmo focus mode must be enabled by its definition");
    }

    const config = definition.Configuration;
    const geometry = BuildGeometry({ Transform: config.Adapter.Read(candidate.Target),
        Parent: config.Adapter.Parent(candidate.Target),
        View: query,
        Mode: selected,
        Size: config.Size,
        Tolerance: config.HandleTolerance });
    return Object.freeze({ Candidate: candidate,
        Geometry: geometry,
        Hover: PickGeometry(geometry, query) });
};

/**
 * Projects aim into a captured axis coordinate or captured plane coordinates.
 *
 * @category Getter
 * @since 1.0.0
 */
const Project = (
    geometry: Geometry,
    handle: Handle,
    ray: Ray,
    camera: Basis
): Readonly<Vector3> | undefined =>
{
    const offset = Sub(ray.Origin, geometry.Center);
    if (handle.length === 1 && geometry.Mode !== "rotation")
    {
        const axis = Direction(geometry.Basis, handle);
        const along = Dot(axis, ray.Direction);
        const denominator = 1 - along * along;
        if (denominator < ProjectionTolerance)
        {
            return undefined;
        }

        const distance = (Dot(axis, offset) - along * Dot(ray.Direction, offset)) / denominator;
        const forward = along * distance - Dot(ray.Direction, offset);
        return forward < 0 ? undefined : V({ x: distance,
            y: 0,
            z: 0 });
    }

    const surface = handle === "camera" || handle === "uniform" ? camera : Surface(geometry.Basis, handle);
    const denominator = Dot(surface.Z, ray.Direction);
    if (Math.abs(denominator) < ProjectionTolerance)
    {
        return undefined;
    }

    const distance = -Dot(offset, surface.Z) / denominator;
    if (distance < 0)
    {
        return undefined;
    }

    const hit = Add(offset, Mul(ray.Direction, distance));
    const x = Dot(hit, surface.X);
    const y = Dot(hit, surface.Y);
    if (geometry.Mode === "rotation" && Math.hypot(x, y) < geometry.Size * ProjectionTolerance)
    {
        return undefined;
    }

    return V({ x,
        y,
        z: 0 });
};

/**
 * Chooses the winding equivalent nearest the previous continuous angle.
 *
 * @category Converting
 * @since 1.0.0
 */
const Unwrap = (angle: number, previous: number): number =>
{
    return angle + 360 * Math.round((previous - angle) / 360);
};

/**
 * Extracts continuous Minecraft Y-X-Z channels while following the closest equivalent Euler branch.
 * At gimbal lock, distributes the constrained yaw/roll change around the previous channels.
 *
 * @throws { RangeError } If orientation cannot be converted to degree channels.
 *
 * @category Converting
 * @since 1.0.0
 */
const Channels = (rotation: Quat, previous: Readonly<Vector3>): Readonly<Vector3> =>
{
    const angles = quaternionToAngles([ rotation.x, rotation.y, rotation.z, rotation.w ]);
    if (!isSome(angles))
    {
        throw new RangeError("Gizmo rotation cannot be converted to continuous channels");
    }

    const [ pitch, yaw, roll ] = angles.value;
    if (Math.abs(Math.abs(pitch) - 90) < 1e-7)
    {
        const sign = Math.sign(pitch);
        const current = previous.y + sign * previous.z;
        const delta = Unwrap(yaw, current) - current;
        return V({ x: Unwrap(pitch, previous.x),
            y: previous.y + delta / 2,
            z: previous.z + sign * delta / 2 });
    }

    const primary = V({ x: Unwrap(pitch, previous.x),
        y: Unwrap(yaw, previous.y),
        z: Unwrap(roll, previous.z) });
    const alternate = V({ x: Unwrap(180 - pitch, previous.x),
        y: Unwrap(yaw + 180, previous.y),
        z: Unwrap(roll + 180, previous.z) });
    const first = Sub(primary, previous);
    const second = Sub(alternate, previous);
    return Dot(first, first) <= Dot(second, second) ? primary : alternate;
};

/**
 * Captures a local drag segment without native input, target writes, physics or policy enforcement.
 *
 * @throws { TypeError | RangeError } If the handle, initial ray or degree channels are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const BeginDrag = (geometry: Geometry, handle: Handle, input: Ray, degrees: Readonly<Vector3>): Drag =>
{
    if (!geometry.Parts.some((part: Part): boolean => part.Handle === handle))
    {
        throw new TypeError("Gizmo drag handle must belong to its mode geometry");
    }

    const ray = View(input);
    const camera = Camera(ray.Direction);
    const originalDegrees = V(degrees);
    let anchor = Project(geometry, handle, ray, camera);
    let previousAngle = anchor ? Math.atan2(anchor.y, anchor.x) : 0;
    let angle = 0;
    let state: Result = Object.freeze({ Transform: geometry.Transform,
        RotationDegrees: originalDegrees,
        Translation: Zero,
        ScaleChange: Zero,
        AngleDegrees: 0,
        Valid: anchor !== undefined });
    return Object.freeze({ Geometry: geometry,
        Handle: handle,
        get State(): Result
        {
            return state;
        },
        Sample(inputRay: Ray): Result
        {
            const projected = Project(geometry, handle, View(inputRay), camera);
            if (!projected)
            {
                state = Object.freeze({ ...state,
                    Valid: false });
                return state;
            }

            if (!anchor)
            {
                anchor = projected;
                previousAngle = Math.atan2(projected.y, projected.x);
            }

            const delta = Sub(projected, anchor);
            let translation = Zero;
            let scale = Zero;
            let rotation = geometry.Transform.Rotation;
            let nextDegrees = originalDegrees;
            if (geometry.Mode === "rotation")
            {
                const currentAngle = Math.atan2(projected.y, projected.x);
                const difference = currentAngle - previousAngle;
                angle += Math.atan2(Math.sin(difference), Math.cos(difference));
                previousAngle = currentAngle;
                const axis = Direction(Local, handle);
                const half = angle / 2;
                rotation = Product(rotation, { x: axis.x * Math.sin(half),
                    y: axis.y * Math.sin(half),
                    z: axis.z * Math.sin(half),
                    w: Math.cos(half) });
                nextDegrees = Channels(rotation, state.RotationDegrees);
            }
            else if (geometry.Mode === "translation")
            {
                const surface = handle === "camera" ? camera : Surface(geometry.Basis, handle);
                const world = handle.length === 1 ? Mul(Direction(geometry.Basis, handle), delta.x) :
                    Add(Mul(surface.X, delta.x), Mul(surface.Y, delta.y));
                translation = Rotate(Inverse(geometry.Parent.Rotation), world);
            }
            else if (handle === "uniform")
            {
                const amount = (delta.x + delta.y) / (Math.SQRT2 * geometry.Size);
                const initial = geometry.Transform.Scale;
                const largest = Math.max(Math.abs(initial.x), Math.abs(initial.y), Math.abs(initial.z));
                scale = Mul(largest > 1e-12 ? Mul(initial, 1 / largest) : One, amount);
            }
            else
            {
                const values = { x: 0,
                    y: 0,
                    z: 0 };
                values[handle[0] as keyof Vector3] = delta.x / geometry.Size;
                if (handle.length === 2)
                {
                    values[handle[1] as keyof Vector3] = delta.y / geometry.Size;
                }

                scale = V(values);
            }

            state = Object.freeze({ Transform: SnapshotTransform({
                Position: Add(geometry.Transform.Position, translation),
                Rotation: rotation,
                Scale: Add(geometry.Transform.Scale, scale) }),
            RotationDegrees: nextDegrees,
            Translation: translation,
            ScaleChange: scale,
            AngleDegrees: angle * DegreesPerRadian * (handle === "y" ? -1 : 1),
            Valid: true });
            return state;
        } });
};
