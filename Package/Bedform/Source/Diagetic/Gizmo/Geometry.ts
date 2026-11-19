/**
 * Shared local Gizmo solids, deterministic picking, focus selection and captured analytic drags.
 *
 * @module bedform/Diagetic/Gizmo/Geometry
 *
 * @file      Geometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Spatial contracts retain semantic ordering. */

import { BeginDrag, BuildGeometry, FindFocus, PickGeometry } from "../../Internal/GizmoGeometry.js";
import type { Candidate, Frame, Handle, Mode, Runtime, Transform } from "../Gizmo.js";
import type { Query } from "../Gizmo.js";
import type { Vector3 } from "@minecraft/server";

/**
 * World ray with a finite origin and unit forward direction. Distances are blocks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Ray
{
    readonly Origin: Readonly<Vector3>;
    readonly Direction: Readonly<Vector3>;
}

/**
 * Orthonormal world directions of local axes. X/Y/Z retain red/green/blue and Minecraft Y-up.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Basis
{
    readonly X: Readonly<Vector3>;
    readonly Y: Readonly<Vector3>;
    readonly Z: Readonly<Vector3>;
}

/**
 * A closed capsule: the swept sphere between Start and End. Renderers and pickers share its radius.
 * Arrow heads use four converging struts; rings use a bounded closed chain of these same solids.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Capsule
{
    readonly Kind: "capsule";
    readonly Start: Readonly<Vector3>;
    readonly End: Readonly<Vector3>;
    readonly Radius: number;
}

/**
 * Oriented solid box with world-space axes and positive half extents. Thin boxes form plane patches;
 * cubes form axis and uniform scaling handles. These descriptors do not create native collision.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Box
{
    readonly Kind: "box";
    readonly Center: Readonly<Vector3>;
    readonly Basis: Basis;
    readonly HalfSize: Readonly<Vector3>;
}

/**
 * Shared analytic solid geometry, suitable for later particle rendering without helper entities.
 *
 * @category Model
 * @since 1.0.0
 */
export type Primitive = Capsule | Box;

/**
 * One selectable handle and all its visible/pickable solids. Array order breaks equal-distance ties.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Part
{
    readonly Handle: Handle;
    readonly Color: "red" | "green" | "blue" | "yellow" | "magenta" | "cyan" | "white";
    readonly Primitives: ReadonlyArray<Primitive>;
}

/**
 * Explicit local target, rigid parent and current camera view. Size is a positive world length, default
 * one block. Tolerance is a positive world-space tube radius, default 0.08 blocks. Target scale never
 * collapses the editing handles. No world-axis editing mode is available.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options
{
    readonly Transform: Transform;
    readonly Parent: Frame;
    readonly View: Ray;
    readonly Mode: Mode;
    readonly Size?: number;
    readonly Tolerance?: number;
}

/**
 * Deeply frozen geometry snapshot. World center and basis compose parent and target orientation.
 * CameraBasis is screen-right, screen-up and back toward the camera. Each rotation ring has 48 capsules.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Geometry
{
    readonly Transform: Transform;
    readonly Parent: Frame;
    readonly Mode: Mode;
    readonly Center: Readonly<Vector3>;
    readonly Basis: Basis;
    readonly CameraBasis: Basis;
    readonly Size: number;
    readonly Tolerance: number;
    readonly Parts: ReadonlyArray<Part>;
}

/**
 * Nearest forward intersection with a handle's actual shared geometry, including its world hit point.
 * Rays starting inside a solid return distance zero. Geometry order resolves coincident handles.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Pick
{
    readonly Handle: Handle;
    readonly Distance: number;
    readonly Position: Readonly<Vector3>;
}

/**
 * One eligible target and its handle geometry; Hover is absent when aim misses actual handle solids.
 * Target focus can persist within its angular allowance while no handle is under the crosshair.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Focus
{
    readonly Candidate: Candidate<unknown>;
    readonly Geometry: Geometry;
    readonly Hover?: Pick;
}

/**
 * Segment-relative unsnapped result. Translation is parent-frame displacement; ScaleChange is additive.
 * AngleDegrees is the continuously unwrapped selected-axis angle in Minecraft degree conventions
 * (positive local Y yaw is negative right-handed rotation). RotationDegrees are continuous Y-X-Z
 * parent-frame channels, retaining winding through Euler branch changes. Policies are applied later.
 * Valid false retains the previous transform and measurements exactly.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Result
{
    readonly Transform: Transform;
    readonly RotationDegrees: Readonly<Vector3>;
    readonly Translation: Readonly<Vector3>;
    readonly ScaleChange: Readonly<Vector3>;
    readonly AngleDegrees: number;
    readonly Valid: boolean;
}

/**
 * Captured handle and local basis for one drag segment. Sample never repicks or consults live targets.
 * Initial aim establishes an offset so grabbing anywhere on a handle produces no jump. An initially
 * degenerate view waits for its first valid projection, which also establishes a zero-delta anchor.
 * Nearly parallel, behind-camera and center-of-ring projections retain the last valid result.
 * Drop the controller on release; rebuild geometry and Begin again to rebase a subsequent grab.
 * Rotation samples must advance by less than 180 degrees to resolve winding unambiguously.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Drag
{
    readonly Geometry: Geometry;
    readonly Handle: Handle;
    readonly State: Result;
    readonly Sample: (ray: Ray) => Result;
}

/**
 * Builds the shared local-axis arrows, plane patches, camera-plane move patch, rings or scale cubes.
 *
 * @throws { TypeError | RangeError } If mode, pose, ray or dimensions are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Build = (options: Options): Geometry =>
{
    return BuildGeometry(options);
};

/**
 * Picks the nearest handle solid independently of the broader target-body focus region.
 *
 * @throws { RangeError } If the view ray is malformed.
 *
 * @category Getter
 * @since 1.0.0
 */
export const Pick = (geometry: Geometry, ray: Ray): Pick | undefined =>
{
    return PickGeometry(geometry, ray);
};

/**
 * Selects one focused target from the runtime's range/angle/occlusion/eligibility-filtered candidates.
 * Body occlusion must be explicitly reported by the adapter. Its first ranked candidate wins even when
 * a different target has a handle under aim. Omitted mode uses the definition's first enabled mode.
 * No target is mutated and no callbacks are fired beyond adapter discovery and transform reads.
 *
 * @throws { TypeError | RangeError | Error } If mode, adapter data or runtime lifetime is invalid.
 *
 * @category Getter
 * @since 1.0.0
 */
export const Focus = (runtime: Runtime, item: string, query: Query, mode?: Mode): Focus | undefined =>
{
    return FindFocus(runtime, item, query, mode);
};

/**
 * Begins one pure captured drag using the geometry built for this grab and continuous original channels.
 * Axis/plane scaling is additive, so zero components can be edited. Uniform scaling preserves component
 * proportions; when every component is zero it uses an equal-component direction to permit recovery.
 *
 * @throws { TypeError | RangeError } If the handle, ray or rotation channels are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Begin = (
    geometry: Geometry,
    handle: Handle,
    ray: Ray,
    rotationDegrees: Readonly<Vector3>
): Drag =>
{
    return BeginDrag(geometry, handle, ray, rotationDegrees);
};
