/**
 * Development-only, game-safe structure authoring contracts. Geometry and placement are separate services.
 *
 * @module bedform/Prototype/Structure
 *
 * @file      Structure.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Export declarations own their documentation; material and lifecycle ordering follows the public API. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* eslint-disable sort-keys */

import type { Bounds, Pose } from "./Interaction.js";
import type { Vector3 } from "@minecraft/server";

/**
 * Stable full blocks allowed for floors, sign supports, walls and ceilings, in dropdown order.
 *
 * @category Materials
 * @since 1.0.0
 */
export const SolidPalette = Object.freeze([
    "minecraft:iron_block", "minecraft:polished_andesite", "minecraft:smooth_stone", "minecraft:stone",
    "minecraft:stone_bricks", "minecraft:quartz_block", "minecraft:white_concrete", "minecraft:black_concrete"
] as const);

/**
 * Transparent full blocks allowed for walls and ceilings.
 *
 * @category Materials
 * @since 1.0.0
 */
export const GlassPalette = Object.freeze([
    "minecraft:glass", "minecraft:white_stained_glass", "minecraft:light_gray_stained_glass"
] as const);

/**
 * Connected pane choices allowed only for main walls.
 *
 * @category Materials
 * @since 1.0.0
 */
export const PanePalette = Object.freeze([
    "minecraft:glass_pane", "minecraft:white_stained_glass_pane", "minecraft:light_gray_stained_glass_pane"
] as const);

/**
 * Ceiling slab choices, placed with bottom-half permutations.
 *
 * @category Materials
 * @since 1.0.0
 */
export const SlabPalette = Object.freeze([
    "minecraft:smooth_stone_slab", "minecraft:stone_brick_slab", "minecraft:quartz_slab"
] as const);

/**
 * Material ID types shared by the per-part contracts and later engine-qualified catalogs.
 *
 * @category Types
 * @since 1.0.0
 */
export type Solid = typeof SolidPalette[number];

/**
 * Transparent full-block material identifier.
 *
 * @category Types
 * @since 1.0.0
 */
export type Glass = typeof GlassPalette[number];

/**
 * Main-wall pane material identifier.
 *
 * @category Types
 * @since 1.0.0
 */
export type Pane = typeof PanePalette[number];

/**
 * Bottom-half ceiling slab material identifier.
 *
 * @category Types
 * @since 1.0.0
 */
export type Slab = typeof SlabPalette[number];

/**
 * Main-floor preset names describe interior size, independent of selected materials.
 *
 * @category Presets
 * @since 1.0.0
 */
export const Presets = Object.freeze({
    Small: Object.freeze({ InteriorSize: 7,
        BorderedSize: 9 } as const),
    Medium: Object.freeze({ InteriorSize: 17,
        BorderedSize: 19 } as const),
    Large: Object.freeze({ InteriorSize: 25,
        BorderedSize: 27 } as const)
} as const);

/**
 * Cardinal direction toward the sign wall along positive local v; positive u is viewer-right.
 *
 * @category Types
 * @since 1.0.0
 */
export type Facing = "North" | "East" | "South" | "West";

/**
 * Six independent material roles. Border flooring follows EntranceFloor.
 * Only walls accept panes and only ceilings accept slabs.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Materials
{
    readonly MainFloor: Solid;
    readonly EntranceWall: Solid;
    readonly EntranceFloor: Solid;
    readonly MainWalls: Solid | Glass | Pane;
    readonly MainCeiling: Solid | Glass | Slab;
    readonly EntranceCeiling: Solid | Glass | Slab;
}

/**
 * Saved authoring choices; InteriorHeight must be an integer at least three.
 * Placement validates both roofs against the selected dimension and floor height without clamping.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly Size: keyof typeof Presets;
    readonly Facing: Facing;
    readonly IncludeMainCeiling: boolean;
    readonly InteriorHeight: number;
    readonly Materials: Materials;
}

/**
 * Initial options retain the disabled main-ceiling material and always include an entrance roof.
 *
 * @category Presets
 * @since 1.0.0
 */
export const Defaults = Object.freeze({
    Size: "Medium",
    Facing: "South",
    IncludeMainCeiling: false,
    InteriorHeight: 3,
    Materials: Object.freeze({
        MainFloor: "minecraft:iron_block",
        EntranceWall: "minecraft:stone",
        EntranceFloor: "minecraft:polished_andesite",
        MainWalls: "minecraft:glass",
        MainCeiling: "minecraft:glass",
        EntranceCeiling: "minecraft:smooth_stone_slab"
    } as const)
} as const) satisfies Options;

/**
 * Saved options have their own revision; editing them never mutates the placed recipe or blocks.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SavedOptions
{
    readonly DemonstrationId: string;
    readonly Revision: number;
    readonly Options: Options;
}

/**
 * Local block coordinate: floor center is u=0, y=F, v=0, with Bedrock Y vertical.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Cell
{
    readonly u: number;
    readonly y: number;
    readonly v: number;
}

/**
 * Serialized block choice with required states, retaining IDs rather than dropdown indexes or labels.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Permutation
{
    readonly Id: Solid | Glass | Pane | Slab | "minecraft:oak_wall_sign";
    readonly States: Readonly<Record<string, string | number | boolean>>;
}

/**
 * One local block write with its fully resolved material states.
 *
 * @category Types
 * @since 1.0.0
 */
export interface BlockPlacement
{
    readonly Cell: Cell;
    readonly Permutation: Permutation;
}

/**
 * Explicit front-face sign lines; name uses one sign and description uses at most two.
 * Text fitting is engine-qualified by the layout service, not this contract.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Sign
{
    readonly Cell: Cell;
    readonly Lines: readonly [string, string, string, string];
    readonly Role: "Name" | "Description";
}

/**
 * Pure layout output includes the exact union of columns requiring full-height clearance.
 * Roof heights and default bounds are derived from options rather than fixed at three blocks.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Layout
{
    readonly Options: Options;
    readonly Blocks: ReadonlyArray<BlockPlacement>;
    readonly Signs: ReadonlyArray<Sign>;
    readonly ClearanceColumns: ReadonlyArray<Cell>;
    readonly Bounds: Bounds;
    readonly Arrival: Pose;
}

/**
 * Validated preview snapshot; a changed options revision requires a new preview and confirmation.
 * Center is the unique main-floor cell in the selected dimension.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Placement
{
    readonly DemonstrationId: string;
    readonly OptionsRevision: number;
    readonly Options: Options;
    readonly Dimension: string;
    readonly Center: Vector3;
    readonly Layout: Layout;
}

/**
 * Last successful placement, separate from editable options; persisted only after all writes succeed.
 * Footprint contains exact cleared columns, while Bounds and Arrival remain editable independently.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PlacedRecipe
{
    readonly RecipeVersion: number;
    readonly DemonstrationId: string;
    readonly OptionsRevision: number;
    readonly Options: Options;
    readonly Dimension: string;
    readonly Center: Vector3;
    readonly Footprint: ReadonlyArray<Vector3>;
    readonly Bounds: Bounds;
    readonly Arrival: Pose;
}
