/**
 * Pure scene layout for the Diagetic demonstration: support blocks, bound and free controls and signs.
 *
 * @module @sorrell/diagetic-demo/Script/Layout
 *
 * @file      Layout.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Layout records retain semantic field ordering. */
/* eslint-disable sort-keys */

import type { Direction, Vector3 } from "@minecraft/server";
import { DemoEntity } from "./Controls.js";
import type { Kind } from "../../../Package/Bedform/Source/Diagetic.js";
import { Tag } from "./Keys.js";

/**
 * Faces in the order controls are placed on each built-in support cube.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Faces: ReadonlyArray<Direction> = Object.freeze([ "North", "East", "South", "West", "Up",
    "Down" ] as Array<Direction>);

/**
 * Standing height of the superflat surface.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Floor = -60 as const;

/**
 * A support cube carrying one BedformCommon control of a kind on each of its six faces.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Cube
{
    readonly Kind: Kind;
    readonly Position: Vector3;
}

/**
 * A demo control bound to the north face of a wall block, with optional feedback tag.
 *
 * @category Model
 * @since 1.0.0
 */
export interface WallControl
{
    readonly EntityType: string;
    readonly Position: Vector3;
    readonly Face: Direction;
    readonly Tag?: string;
}

/**
 * A free demo control: carrier location, native yaw and local model rotation in degrees.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FreeControl
{
    readonly EntityType: string;
    readonly Location: Vector3;
    readonly Yaw: number;
    readonly Rotation: Vector3;
}

/**
 * A standing sign facing the spawn, with its text.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Sign
{
    readonly Position: Vector3;
    readonly Text: string;
}

/**
 * Row one: built-in controls on all six faces of floating cubes.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Cubes: ReadonlyArray<Cube> = Object.freeze([
    { Kind: "lever",
        Position: { x: -6,
            y: Floor + 2,
            z: 6 } },
    { Kind: "slider",
        Position: { x: 0,
            y: Floor + 2,
            z: 6 } },
    { Kind: "wheel",
        Position: { x: 6,
            y: Floor + 2,
            z: 6 } }
] as Array<Cube>);

/**
 * Row two: a wall whose north face carries the tuned demo controls.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Wall = Object.freeze({ From: { x: -9,
    y: Floor,
    z: 15 },
To: { x: 9,
    y: Floor + 3,
    z: 15 } });

/**
 * Tuned demo controls on the wall: a heavy lever lighting a lamp, a spring throttle filling a gauge and
 * a notched dial.
 *
 * @category Constant
 * @since 1.0.0
 */
export const WallControls: ReadonlyArray<WallControl> = Object.freeze([
    { EntityType: DemoEntity.HeavyLever,
        Position: { x: -6,
            y: Floor + 1,
            z: 15 },
        Face: "North",
        Tag: Tag.Lamp },
    { EntityType: DemoEntity.SpringThrottle,
        Position: { x: 0,
            y: Floor + 1,
            z: 15 },
        Face: "North",
        Tag: Tag.Gauge },
    { EntityType: DemoEntity.NotchedDial,
        Position: { x: 6,
            y: Floor + 1,
            z: 15 },
        Face: "North" }
] as Array<WallControl>);

/**
 * Lamp positions, two blocks above each lamp-tagged control's support.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Lamps: ReadonlyArray<Vector3> = Object.freeze(WallControls.filter((control: WallControl) =>
    control.Tag === Tag.Lamp).map((control: WallControl) => ({ x: control.Position.x,
    y: control.Position.y + 2,
    z: control.Position.z })));

/**
 * Row three: free controls on a console of desk blocks, tilted toward the player, rolled and turned.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Desk = Object.freeze({ From: { x: -4,
    y: Floor,
    z: 10 },
To: { x: 4,
    y: Floor,
    z: 10 } });

/**
 * Free controls standing on the desk, facing the spawn (yaw 180 faces north).
 *
 * @category Constant
 * @since 1.0.0
 */
export const FreeControls: ReadonlyArray<FreeControl> = Object.freeze([
    { EntityType: DemoEntity.HeavyLever,
        Location: { x: -3.5,
            y: Floor + 1,
            z: 10.5 },
        Yaw: 180,
        Rotation: { x: -40,
            y: 0,
            z: 0 } },
    { EntityType: DemoEntity.SpringThrottle,
        Location: { x: 0.5,
            y: Floor + 1,
            z: 10.5 },
        Yaw: 180,
        Rotation: { x: -40,
            y: 0,
            z: 30 } },
    { EntityType: DemoEntity.NotchedDial,
        Location: { x: 4.5,
            y: Floor + 1,
            z: 10.5 },
        Yaw: 135,
        Rotation: { x: -60,
            y: 0,
            z: 0 } }
] as Array<FreeControl>);

/**
 * Labels in front of each row.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Signs: ReadonlyArray<Sign> = Object.freeze([
    { Position: { x: -6,
        y: Floor,
        z: 4 },
    Text: "Built-in lever\nall six faces" },
    { Position: { x: 0,
        y: Floor,
        z: 4 },
    Text: "Built-in slider\nall six faces" },
    { Position: { x: 6,
        y: Floor,
        z: 4 },
    Text: "Built-in wheel\nall six faces" },
    { Position: { x: -6,
        y: Floor,
        z: 13 },
    Text: "Heavy lever\nlights the lamp" },
    { Position: { x: 0,
        y: Floor,
        z: 13 },
    Text: "Spring throttle\nreturns to zero" },
    { Position: { x: 6,
        y: Floor,
        z: 13 },
    Text: "Notched dial\n45° detents, ±2 turns" },
    { Position: { x: -2,
        y: Floor,
        z: 8 },
    Text: "Free poses:\ntilted, rolled, turned" }
] as Array<Sign>);
