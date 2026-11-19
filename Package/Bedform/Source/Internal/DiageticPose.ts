/**
 * Converts Diagetic mount frames and control values into synchronized Bedrock bone pose properties.
 *
 * @module bedform/Internal/DiageticPose
 *
 * @file      DiageticPose.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pose fields retain geometric ordering. */
/* eslint-disable sort-keys */

import { PoseProperty, PoseRange } from "../Diagetic/Keys.js";
import type { Configuration } from "../Diagetic.js";
import type { Entity } from "@minecraft/server";
import type { Frame } from "../Diagetic/Simulation.js";
import { MountFrame } from "./DiageticFrame.js";

/**
 * One value per synchronized pose property.
 *
 * @category Model
 * @since 1.0.0
 */
export type PoseValues = Readonly<Record<keyof typeof PoseProperty, number>>;

/**
 * The parts of a handle needed to locate its mount.
 *
 * @category Model
 * @since 1.0.0
 */
export type Mounted = Parameters<typeof MountFrame>[0];

const Degrees = 180 / Math.PI;

/**
 * Wraps degrees into the half-open interval from -180 to 180, suppressing negative zero.
 *
 * @category Converting
 * @since 1.0.0
 */
const Wrap = (degrees: number): number =>
{
    const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
    return wrapped === 0 ? 0 : wrapped;
};

/**
 * Decomposes a mount basis into nested yaw, pitch and roll bone rotations.
 *
 * Model geometry maps to world space at body yaw zero as (x, y, -z) / 16, and the shared root bone
 * cancels body yaw. Under that mapping, bone rotations X, Y and Z act in world space as right-handed
 * rotations by X, -Y and -Z. The basis is factored as Ry(a) Rx(b) Rz(c), giving bone values -a, b, -c.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const MountAngles = (mount: Frame["Mount"]): Pick<PoseValues, "Yaw" | "Pitch" | "Roll"> =>
{
    const { Right: r, Up: u, Normal: n } = mount;
    const b = Math.asin(Math.max(-1, Math.min(1, -n.y)));
    let a: number;
    let c: number;
    if (Math.cos(b) > 1e-6)
    {
        a = Math.atan2(n.x, n.z);
        c = Math.atan2(r.y, u.y);
    }
    else
    {
        a = Math.atan2(-r.z, r.x);
        c = 0;
    }

    return { Yaw: Wrap(-a * Degrees),
        Pitch: Wrap(b * Degrees),
        Roll: Wrap(-c * Degrees) };
};

/**
 * Maps a built-in control value to its moving bone: the lever handle tilts toward local +X by its arc
 * angle about local Y, the slider knob translates along local X in pixels, and the wheel turns
 * counterclockwise about the local normal by its wrapped angle.
 *
 * @category Converting
 * @since 1.0.0
 */
export const MotionValue = (configuration: Configuration, value: number): number =>
{
    const limits = configuration.Limits;
    const fraction = limits ? (value - limits.Min) / (limits.Max - limits.Min) - 0.5 : 0;
    switch (configuration.Kind)
    {
        case "lever":
            return -fraction * configuration.ArcDegrees! + 0;
        case "slider":
            return fraction * configuration.Length! * 16 + 0;
        default:
            return Wrap(-value);
    }
};

/**
 * Computes the synchronized pose of a mounted control relative to its native carrier entity.
 *
 * @throws { RangeError } If native or authored coordinates are not finite.
 *
 * @category Converting
 * @since 1.0.0
 */
export const Pose = (control: Mounted, motion: number): PoseValues =>
{
    const mount = MountFrame(control);
    const location = control.Entity.location;
    return { OffsetX: (mount.Position.x - location.x) * 16,
        OffsetY: (mount.Position.y - location.y) * 16,
        OffsetZ: -(mount.Position.z - location.z) * 16,
        ...MountAngles(mount),
        Motion: motion };
};

/**
 * Writes changed pose properties when the entity type declares the shared schema, clamping each value
 * into its declared range. Entity types without the schema are left untouched.
 *
 * @throws { Error } If the native entity rejects a property write.
 *
 * @category Rendering
 * @since 1.0.0
 */
export const PublishPose = (control: Mounted, motion: number): boolean =>
{
    const entity: Entity = control.Entity;
    if (!entity.isValid || typeof entity.getProperty(PoseProperty.Motion) !== "number")
    {
        return false;
    }

    const values = Pose(control, motion);
    for (const name of Object.keys(PoseProperty) as Array<keyof typeof PoseProperty>)
    {
        const [ min, max ] = name.startsWith("Offset") ? PoseRange.Offset
            : name === "Motion" ? PoseRange.Motion : PoseRange.Angle;
        const value = Math.max(min, Math.min(max, values[name]));
        const current = entity.getProperty(PoseProperty[name]);
        // Synchronized floats are single precision; skip only writes that would not change them.
        if (typeof current !== "number" || Math.abs(current - value) > 1e-6 * Math.max(1, Math.abs(value)))
        {
            entity.setProperty(PoseProperty[name], value);
        }
    }

    return true;
};
