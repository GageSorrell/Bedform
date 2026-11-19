/**
 * Frozen native-camera and posed control frames using the package's degree rotation convention.
 *
 * @module bedform/Internal/DiageticFrame
 *
 * @file      DiageticFrame.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Basis vectors retain geometric coordinate ordering. */
/* eslint-disable sort-keys */

import type { Direction, Player, Vector2, Vector3 } from "@minecraft/server";
import { Coordinates } from "./DiageticConfiguration.js";
import type { Frame } from "../Diagetic/Simulation.js";
import type { Handle } from "../Diagetic.js";

/**
 * Face-aligned world rotation with local +Z pointing out of the supporting block.
 * Floor and ceiling mounts keep local +X along world +X.
 *
 * @category Transforming
 * @since 1.0.0
 */
const FaceRotation = (face: Direction): Readonly<Vector3> =>
{
    return { x: face === "Up" ? -90 : face === "Down" ? 90 : 0,
        y: face === "North" ? 180 : face === "East" ? -90 : face === "West" ? 90 : 0,
        z: 0 };
};

/**
 * Applies roll, pitch and native yaw to a local vector, matching bedform/Rotator conventions.
 *
 * @throws { RangeError } If orientation or transformed coordinates are not finite.
 *
 * @category Transforming
 * @since 1.0.0
 */
const Rotate = (vector: Readonly<Vector3>, rotation: Readonly<Vector3>): Readonly<Vector3> =>
{
    const r = Coordinates(rotation);
    const pitch = r.x * Math.PI / 180;
    const yaw = r.y * Math.PI / 180;
    const roll = r.z * Math.PI / 180;
    const x = vector.x * Math.cos(roll) - vector.y * Math.sin(roll);
    const y = vector.x * Math.sin(roll) + vector.y * Math.cos(roll);
    const py = y * Math.cos(pitch) - vector.z * Math.sin(pitch);
    const pz = y * Math.sin(pitch) + vector.z * Math.cos(pitch);
    return Coordinates({ x: x * Math.cos(yaw) - pz * Math.sin(yaw),
        y: py,
        z: x * Math.sin(yaw) + pz * Math.cos(yaw) });
};

/**
 * Composes the authored model pose with the binding face or native entity orientation into the
 * world-space interaction plane. Bound controls start at the support face centre.
 *
 * @throws { RangeError } If native or authored coordinates are not finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const MountFrame = (control: Pick<Handle, "Entity" | "Binding" | "Pose">): Frame["Mount"] =>
{
    const native = control.Entity.getRotation();
    const root = control.Binding ? FaceRotation(control.Binding.Face) : { x: native.x,
        y: native.y,
        z: 0 };
    const local = (value: Readonly<Vector3>): Readonly<Vector3> =>
        Rotate(Rotate(value, control.Pose.Rotation), root);
    const offset = Rotate(control.Pose.Offset, root);
    const normal = Rotate({ x: 0,
        y: 0,
        z: 1 }, root);
    const location = control.Binding ? Coordinates({
        x: control.Binding.Position.x + 0.5 + normal.x * 0.5,
        y: control.Binding.Position.y + 0.5 + normal.y * 0.5,
        z: control.Binding.Position.z + 0.5 + normal.z * 0.5
    }) : Coordinates(control.Entity.location);
    return { Position: Coordinates({ x: location.x + offset.x,
        y: location.y + offset.y,
        z: location.z + offset.z }),
    Right: local({ x: 1,
        y: 0,
        z: 0 }),
    Up: local({ x: 0,
        y: 1,
        z: 0 }),
    Normal: local({ x: 0,
        y: 0,
        z: 1 }) };
};

/**
 * Captures the initial eye frame and composes authored model pose with native entity orientation.
 *
 * @throws { RangeError } If native or authored coordinates are not finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const CaptureFrame = (player: Player, control: Pick<Handle, "Entity" | "Binding" | "Pose">,
    activation: Readonly<Vector2>): Frame =>
{
    const eye = Coordinates(player.getHeadLocation());
    const camera = { x: activation.x,
        y: activation.y,
        z: 0 };
    return {
        Camera: { Position: eye,
            Right: Rotate({ x: -1,
                y: 0,
                z: 0 }, camera),
            Up: Rotate({ x: 0,
                y: 1,
                z: 0 }, camera),
            Forward: Rotate({ x: 0,
                y: 0,
                z: 1 }, camera) },
        Mount: MountFrame(control)
    };
};
