/**
 * Crosshair targeting of committed spatial layouts: ray/plane intersection at arbitrary orientations,
 * nearest-surface hit ordering, ScrollView clipping and hover tracks, world occlusion, eligibility,
 * reactive line colors, and an explicitly started per-player tracker that draws private pointer lines
 * from an estimated hand position with Canvas particles. Imports are inert.
 *
 * @module bedform/Spatial/Pointer
 *
 * @file      Pointer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Access from "./Access.js";
import * as Layout from "./Layout.js";
import type * as Types from "./ComponentTypes.js";
import { Emit, Rectangle, Tint } from "../Canvas/Surface.js";
import type {
    Placed,
    Rgba,
    Scheduler,
    Pose as SurfacePose,
    TintInput,
    Variables
} from "../Canvas/Surface.js";
import { Kind } from "./Internal/ComponentKind.js";

/**
 * Pointer value contracts shared with component props and reactive color callbacks.
 *
 * @category Model
 * @since 1.0.0
 */
export type {
    PointerColorContext as ColorContext,
    PointerDenial as Denial,
    PointerInput as Input,
    PointerTarget as Target
} from "./ComponentTypes.js";

/**
 * Default line colors: white for noninteractive surface hits, cyan (Bedrock aqua) for eligible
 * interactive hits and orange (Bedrock gold) while an observed Use press is shown on an eligible hit.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DefaultColors = Object.freeze({
    Interactive: "#54FFFF",
    Surface: "#FFFFFF",
    Use: "#FFAA00"
} as const);

/**
 * Default tracker values. Range is the targeting distance in blocks from the eye. Thickness is the
 * line width in blocks. PressTicks is how long an observed Use is shown. OcclusionTolerance lets a
 * widget flush with a block face win over that block. The hand offsets, in blocks along the view's
 * forward, right and down directions, estimate the right hand from the eye; they await client tuning.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Defaults = Object.freeze({
    HandDown: 0.3,
    HandForward: 0.45,
    HandRight: 0.3,
    OcclusionTolerance: 0.01,
    PressTicks: 4,
    Range: 64,
    Thickness: 0.02
} as const);

/**
 * A world-space ray. Direction need not be normalized but must be nonzero.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Ray {
    readonly Origin: Types.Vector;
    readonly Direction: Types.Vector;
}

/**
 * Something a player can aim at: a committed layout and the ids of players presented with it.
 * Renderer roots satisfy this contract structurally.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Source {
    readonly Layout: Layout.Result | undefined;
    readonly Audience: ReadonlyArray<string>;
}

/**
 * One painted region under a local point: an item's own box, or the scrollbar track of a ScrollView.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Region {
    readonly Item: Layout.Item;
    readonly Part: "content" | "track";
}

/**
 * Where a ray meets a View's plane: distance along the normalized ray, world position and the
 * committed local point.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Intersection {
    readonly Distance: number;
    readonly Position: Types.Vector;
    readonly Point: Layout.Point;
}

/**
 * The nearest visible surface on a ray. Item and Part are the topmost painted region; Control is the
 * interactive item it belongs to (the region itself, its nearest interactive ancestor, or the
 * ScrollView owning a track), or undefined for a noninteractive surface, which still blocks controls
 * behind it.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Hit extends Intersection {
    readonly Source: Source;
    readonly View: Layout.View;
    readonly Item: Layout.Item;
    readonly Part: "content" | "track";
    readonly Control: Layout.Item | undefined;
}

/**
 * Casting limits. Only Views in Dimension are considered. Range bounds the distance from the ray
 * origin. Obstruction is the distance to the first world block on the ray; surfaces farther than it
 * (plus Tolerance) are occluded. DoubleSided also admits hits from behind a View's visible face.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface CastOptions {
    readonly Dimension: string;
    readonly Range?: number;
    readonly Obstruction?: number;
    readonly Tolerance?: number;
    readonly DoubleSided?: boolean;
}

/**
 * Per-layout lookup tables, built lazily once per committed layout.
 *
 * @category Model
 * @since 1.0.0
 */
interface Index {
    readonly ById: ReadonlyMap<number, Layout.Item>;
    readonly End: Map<number, number>;
}

/**
 * A painted region with its front-to-back sort key.
 *
 * @category Model
 * @since 1.0.0
 */
interface Ranked {
    readonly Region: Region;
    readonly Layer: number;
    readonly Order: number;
}

/**
 * One player's hit, input and denial before admission and drawing.
 *
 * @category Model
 * @since 1.0.0
 */
interface Pending {
    readonly Player: Player;
    readonly Ray: Ray;
    readonly Hit: Hit;
    readonly Input: Types.PointerInput;
    Denial: Types.PointerDenial | undefined;
}

const Indexes: WeakMap<Layout.Result, Index> = new WeakMap();

/**
 * Layout boxes that arrange children without painting anything themselves.
 *
 * @category Constant
 * @since 1.0.0
 */
const Containers: ReadonlySet<string> = new Set<string>([
    Kind.Column,
    Kind.Content,
    Kind.Heading,
    Kind.Row,
    Kind.ScrollView,
    Kind.Tabs,
    Kind.Title,
    Kind.View
]);

/**
 * Component kinds that are interactive controls without further props.
 *
 * @category Constant
 * @since 1.0.0
 */
const Controls: ReadonlySet<string> = new Set<string>([
    Kind.Button,
    Kind.Slider,
    Kind.TabButton,
    Kind.Toggle
]);

/**
 * Adds a scaled vector.
 *
 * @category Arithmetic
 * @since 1.0.0
 */
function Add(a: Types.Vector, b: Types.Vector, scale: number = 1): Types.Vector
{
    return {
        x: a.x + b.x * scale,
        y: a.y + b.y * scale,
        z: a.z + b.z * scale
    };
}

/**
 * Dot product.
 *
 * @category Arithmetic
 * @since 1.0.0
 */
function Dot(a: Types.Vector, b: Types.Vector): number
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * Right-handed cross product.
 *
 * @category Arithmetic
 * @since 1.0.0
 */
function Cross(a: Types.Vector, b: Types.Vector): Types.Vector
{
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

/**
 * Normalizes a finite nonzero vector, or returns undefined.
 *
 * @category Arithmetic
 * @since 1.0.0
 */
function Unit(vector: Types.Vector | undefined): Types.Vector | undefined
{
    if (!vector)
    {
        return undefined;
    }

    const length = Math.hypot(vector.x, vector.y, vector.z);
    return Number.isFinite(length) && length > 1e-9
        ? {
            x: vector.x / length,
            y: vector.y / length,
            z: vector.z / length
        }
        : undefined;
}

/**
 * Checks that a value is a vector with finite components.
 *
 * @category Predicate
 * @since 1.0.0
 */
function IsVector(value: unknown): value is Types.Vector
{
    const vector = value as Types.Vector;
    return (
        !!vector &&
        typeof vector === "object" &&
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z)
    );
}

/**
 * Returns a frozen copy of a vector.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Freeze(vector: Types.Vector): Types.Vector
{
    return Object.freeze({
        x: vector.x,
        y: vector.y,
        z: vector.z
    });
}

/**
 * Builds or reuses the lookup tables of a committed layout.
 *
 * @category Getter
 * @since 1.0.0
 */
function IndexOf(layout: Layout.Result): Index
{
    let index = Indexes.get(layout);
    if (!index)
    {
        index = {
            ById: new Map(layout.Items.map((item: Layout.Item) => [ item.Id, item ] as const)),
            End: new Map()
        };
        Indexes.set(layout, index);
    }

    return index;
}

/**
 * Checks whether an item lies under another in the committed tree.
 *
 * @category Predicate
 * @since 1.0.0
 */
function Descends(index: Index, item: Layout.Item, ancestor: number): boolean
{
    for (let parent = item.ParentId; parent !== undefined; parent = index.ById.get(parent)?.ParentId)
    {
        if (parent === ancestor)
        {
            return true;
        }
    }

    return false;
}

/**
 * Returns the paint order of an item's last descendant; layout emits descendants contiguously.
 *
 * @category Getter
 * @since 1.0.0
 */
function EndOf(layout: Layout.Result, item: Layout.Item): number
{
    const index = IndexOf(layout);
    let end = index.End.get(item.Id);
    if (end === undefined)
    {
        end = item.Order;
        while (end + 1 < layout.Items.length && Descends(index, layout.Items[end + 1]!, item.Id))
        {
            end++;
        }

        index.End.set(item.Id, end);
    }

    return end;
}

/**
 * Checks whether a committed item is an interactive control: a Button, Toggle, Slider or TabButton,
 * or any item with an OnActivate callback. ScrollView tracks are interactive regions of their own.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function Interactive(item: Layout.Item): boolean
{
    return Controls.has(item.Type) || typeof item.Props.OnActivate === "function";
}

/**
 * Checks whether a committed item paints a visible surface. Pure layout containers (View, Row, Column,
 * ScrollView and slot wrappers) paint nothing unless they have a BackgroundColor or are interactive,
 * so the pointer passes through their empty areas.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function Painted(item: Layout.Item): boolean
{
    return !Containers.has(item.Type) || item.Props.BackgroundColor !== undefined || Interactive(item);
}

/**
 * Returns the painted regions of one View under a local point, front to back. Hidden items, items
 * outside their ScrollView clip and unpainted containers are excluded. A ScrollView's track is painted
 * above the ScrollView's descendants, so it wins over clipped content beneath it.
 *
 * @category Filtering
 * @since 1.0.0
 */
export function Regions(layout: Layout.Result, viewId: number, point: Layout.Point): ReadonlyArray<Region>
{
    const contains = (box: Layout.Box): boolean =>
        box.Width > 0 &&
        box.Height > 0 &&
        point.X >= box.X &&
        point.Y >= box.Y &&
        point.X < box.X + box.Width &&
        point.Y < box.Y + box.Height;
    const entries: Array<Ranked> = [];
    for (const item of Layout.HitTest(layout, viewId, point))
    {
        if (Painted(item))
        {
            entries.push({
                Layer: item.Layer,
                Order: item.Order,
                Region: Object.freeze({
                    Item: item,
                    Part: "content"
                })
            });
        }
    }

    for (const item of layout.Items)
    {
        if (
            item.ViewId === viewId &&
            item.Track &&
            !item.Hidden &&
            contains(item.Track) &&
            (!item.Clip || contains(item.Clip))
        )
        {
            entries.push({
                Layer: item.Layer,
                Order: EndOf(layout, item) + 0.5,
                Region: Object.freeze({
                    Item: item,
                    Part: "track"
                })
            });
        }
    }

    entries.sort((a: Ranked, b: Ranked) => b.Layer - a.Layer || b.Order - a.Order);
    return Object.freeze(entries.map((entry: Ranked) => entry.Region));
}

/**
 * Resolves the interactive control owning a painted region: the ScrollView of a track, otherwise the
 * region's item or its nearest interactive ancestor within the same View.
 *
 * @category Getter
 * @since 1.0.0
 */
export function ControlOf(layout: Layout.Result, region: Region): Layout.Item | undefined
{
    if (region.Part === "track")
    {
        return region.Item;
    }

    const index = IndexOf(layout);
    for (
        let item: Layout.Item | undefined = region.Item;
        item;
        item = item.ParentId === undefined ? undefined : index.ById.get(item.ParentId)
    )
    {
        if (Interactive(item))
        {
            return item;
        }
    }

    return undefined;
}

/**
 * Intersects a ray with a View's plane at any rigid orientation. The visible face is the View's local
 * +Z side, toward which layers are offset; rays reaching the plane from behind miss unless DoubleSided.
 * Rays parallel to the plane, starting past it or with a degenerate direction miss.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Intersect(view: Layout.View, ray: Ray, doubleSided: boolean = false): Intersection | undefined
{
    const direction = Unit(ray.Direction);
    if (!direction || !IsVector(ray.Origin))
    {
        return undefined;
    }

    const origin = Layout.Project(view, {
        X: 0,
        Y: 0
    });
    const normal = Add(Layout.Project(view, {
        X: 0,
        Y: 0
    }, 1), origin, -1);
    const denominator = Dot(direction, normal);
    if (Math.abs(denominator) < 1e-9 || (!doubleSided && denominator > 0))
    {
        return undefined;
    }

    const distance = Dot(Add(origin, ray.Origin, -1), normal) / denominator;
    if (!(distance >= 0) || !Number.isFinite(distance))
    {
        return undefined;
    }

    const position = Freeze(Add(ray.Origin, direction, distance));
    return Object.freeze({
        Distance: distance,
        Point: Layout.Unproject(view, position),
        Position: position
    });
}

/**
 * Finds the nearest visible surface on a ray across sources. Views are compared by distance along the
 * ray; within a View the topmost painted region wins. Surfaces beyond Range or behind a world
 * obstruction are ignored; a nearer surface hides everything behind it, whether or not it is
 * interactive, so denied or noninteractive surfaces never allow click-through. Ties keep the earlier
 * source and View.
 *
 * @throws { TypeError } If the dimension, range, obstruction or tolerance is invalid.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Cast(sources: Iterable<Source>, ray: Ray, options: CastOptions): Hit | undefined
{
    const range = options.Range ?? Defaults.Range;
    const tolerance = options.Tolerance ?? Defaults.OcclusionTolerance;
    if (
        typeof options.Dimension !== "string" ||
        !(range > 0) ||
        !(tolerance >= 0) ||
        (options.Obstruction !== undefined && !(options.Obstruction >= 0))
    )
    {
        throw new TypeError("Pointer casts need a Dimension, positive Range and nonnegative limits.");
    }

    const limit = Math.min(
        range,
        options.Obstruction === undefined ? Infinity : options.Obstruction + tolerance
    );
    let best: Hit | undefined;
    for (const source of sources)
    {
        const layout = source.Layout;
        if (!layout)
        {
            continue;
        }

        for (const view of layout.Views)
        {
            if (view.Dimension !== options.Dimension)
            {
                continue;
            }

            const intersection = Intersect(view, ray, options.DoubleSided ?? false);
            if (
                !intersection ||
                intersection.Distance > limit ||
                (best && best.Distance <= intersection.Distance)
            )
            {
                continue;
            }

            const region = Regions(layout, view.Id, intersection.Point)[0];
            if (region)
            {
                best = Object.freeze({
                    ...intersection,
                    Control: ControlOf(layout, region),
                    Item: region.Item,
                    Part: region.Part,
                    Source: source,
                    View: view
                });
            }
        }
    }

    return best;
}

/**
 * The item whose pointer settings and policies govern a hit: its control, else its surface.
 *
 * @category Getter
 * @since 1.0.0
 */
function SubjectOf(hit: Hit): Layout.Item
{
    return hit.Control ?? hit.Item;
}

/**
 * Checks whether a hit lies beyond the governing item's Pointer.MaxDistance.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function Beyond(hit: Hit): boolean
{
    const maximum = SubjectOf(hit).Pointer.MaxDistance;
    return maximum !== undefined && hit.Distance > maximum;
}

/**
 * Returns why a hit is not eligible before access control, checking in order: a disabled pointer or
 * control, the maximum distance, and every required item along the ancestor chain against the held
 * item. Returns undefined when nothing denies the hit. Access policies (locks, predicates and player
 * limits) are applied afterwards by the tracker's admission, which needs every player's hit at once.
 *
 * @category Validation
 * @since 1.0.0
 */
export function Deny(hit: Hit, input: Types.PointerInput): Types.PointerDenial | undefined
{
    const subject = SubjectOf(hit);
    if (subject.Pointer.Enabled === false || subject.Props.Disabled === true)
    {
        return "disabled";
    }

    if (Beyond(hit))
    {
        return "distance";
    }

    if (subject.RequiredItems.some((item: string) => item !== input.HeldItem))
    {
        return "item";
    }

    return undefined;
}

/**
 * Describes a hit for color callbacks and listeners.
 *
 * @category Converting
 * @since 1.0.0
 */
export function TargetOf(hit: Hit): Types.PointerTarget
{
    const subject = SubjectOf(hit);
    return Object.freeze({
        Distance: hit.Distance,
        Id: subject.Id,
        Interactive: hit.Control !== undefined,
        Part: hit.Part,
        Type: subject.Type
    });
}

/**
 * The default color for a hit: the Use color while an observed press is shown on an eligible hit,
 * the interactive color on other eligible hits and the surface color otherwise.
 *
 * @category Getter
 * @since 1.0.0
 */
export function DefaultColor(eligible: boolean, input: Types.PointerInput): TintInput
{
    return eligible ? (input.Use ? DefaultColors.Use : DefaultColors.Interactive) : DefaultColors.Surface;
}

/**
 * Resolves the line color through the governing item's reactive Pointer.Color callback, if any.
 * The callback receives a frozen context; undefined keeps the default.
 *
 * @throws { TypeError } If the callback returns an invalid tint.
 *
 * @category Getter
 * @since 1.0.0
 */
export function ColorOf(
    hit: Hit,
    viewerId: string,
    input: Types.PointerInput,
    denial: Types.PointerDenial | undefined
): Rgba
{
    const eligible = hit.Control !== undefined && denial === undefined;
    const fallback = DefaultColor(eligible, input);
    const callback = SubjectOf(hit).Pointer.Color;
    const chosen =
        typeof callback === "function"
            ? callback(
                Object.freeze({
                    Default: fallback,
                    Eligible: eligible,
                    Input: input,
                    Target: TargetOf(hit),
                    ViewerId: viewerId,
                    ...(denial === undefined ? {} : { Denial: denial })
                })
            )
            : undefined;
    return Tint(chosen ?? fallback);
}

/**
 * Hand offsets in blocks along the view's forward, right and down directions.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface HandOffsets {
    readonly Forward?: number;
    readonly Right?: number;
    readonly Down?: number;
}

/**
 * Estimates the right hand's world position from a view ray. Right is the horizontal right of the
 * view; when looking straight up or down it falls back to world +X.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function EstimateHand(ray: Ray, offsets: HandOffsets = {}): Types.Vector
{
    const forward = Unit(ray.Direction) ?? {
        x: 0,
        y: 0,
        z: 1
    };
    const right = Unit(Cross(forward, {
        x: 0,
        y: 1,
        z: 0
    })) ?? {
        x: 1,
        y: 0,
        z: 0
    };
    const up = Cross(right, forward);
    return Freeze(
        Add(
            Add(Add(ray.Origin, forward, offsets.Forward ?? Defaults.HandForward), right,
                offsets.Right ?? Defaults.HandRight),
            up,
            -(offsets.Down ?? Defaults.HandDown)
        )
    );
}

/**
 * A raycast block result: the block and the hit point relative to its minimum corner.
 *
 * @category Model
 * @since 1.0.0
 */
export namespace BlockHit
{
    /**
     * The hit block's integer location.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface Block
    {
        readonly location: Types.Vector;
    }
}

/**
 * The native BlockRaycastHit fields the default occlusion reads.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BlockHit {
    readonly block: BlockHit.Block;
    readonly faceLocation: Types.Vector;
}

/**
 * The native BlockRaycastOptions fields the default occlusion sets.
 *
 * @category Model
 * @since 1.0.0
 */
export interface RaycastOptions {
    readonly maxDistance?: number;
    readonly includeLiquidBlocks?: boolean;
    readonly includePassableBlocks?: boolean;
}

/**
 * The native Dimension capabilities the tracker uses; getBlockFromRay is needed only by the default
 * occlusion.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Dimension {
    readonly id: string;
    getBlockFromRay?(
        origin: Types.Vector,
        direction: Types.Vector,
        options?: RaycastOptions
    ): BlockHit | undefined;
}

/**
 * The native Player capabilities the tracker uses. The default view reads the head location and view
 * direction; the default line emits privately through spawnParticle.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Player {
    readonly id: string;
    readonly isValid: boolean;
    readonly dimension: Dimension;
    getHeadLocation(): Types.Vector;
    getViewDirection(): Types.Vector;
    spawnParticle(effectName: string, location: Types.Vector, molangVariables?: Variables): void;
}

/**
 * Online player enumeration; native World satisfies it.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Players {
    readonly getAllPlayers: () => ReadonlyArray<Player>;
}

/**
 * Distance in blocks from the ray origin to the first occluding world block, using the native
 * Dimension.getBlockFromRay without liquids or passable blocks. Returns undefined when nothing is hit
 * within range or the dimension cannot raycast.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Obstruction(player: Player, ray: Ray, range: number): number | undefined
{
    const direction = Unit(ray.Direction);
    if (!direction || typeof player.dimension.getBlockFromRay !== "function")
    {
        return undefined;
    }

    const hit = player.dimension.getBlockFromRay(ray.Origin, direction, {
        includeLiquidBlocks: false,
        includePassableBlocks: false,
        maxDistance: range
    });
    if (!hit)
    {
        return undefined;
    }

    const point = Add(hit.block.location, hit.faceLocation);
    return Math.hypot(point.x - ray.Origin.x, point.y - ray.Origin.y, point.z - ray.Origin.z);
}

/**
 * Reads the held item's type identifier through the native equippable or inventory components.
 * Returns undefined for an empty hand or when neither component can be read.
 *
 * @category Getter
 * @since 1.0.0
 */
export function HeldItem(player: Player): string | undefined
{
    type Stack = { readonly typeId?: string } | undefined;
    const native = player as unknown as {
        readonly selectedSlotIndex?: number;
        getComponent?(id: string): unknown;
    };
    if (typeof native.getComponent !== "function")
    {
        return undefined;
    }

    const equippable = native.getComponent("minecraft:equippable") as
        | { getEquipment?(slot: string): Stack }
        | undefined;
    if (typeof equippable?.getEquipment === "function")
    {
        return equippable.getEquipment("Mainhand")?.typeId;
    }

    const inventory = native.getComponent("minecraft:inventory") as
        | { readonly container?: { getItem?(slot: number): Stack } }
        | undefined;
    const slot = native.selectedSlotIndex;
    return typeof inventory?.container?.getItem === "function" && typeof slot === "number"
        ? inventory.container.getItem(slot)?.typeId
        : undefined;
}

/**
 * A pointer line to draw for one player: from the hand to the hit, in the player's dimension.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Line {
    readonly Viewer: Player;
    readonly Dimension: string;
    readonly From: Types.Vector;
    readonly To: Types.Vector;
    readonly Eye: Types.Vector;
    readonly Color: Rgba;
    readonly Thickness: number;
}

/**
 * A segment as one Canvas rectangle sprite and the fixed pose that lays it along the segment, turned
 * about its axis to face the eye.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Segment {
    readonly Pose: SurfacePose;
    readonly Sprite: Placed;
}

/**
 * Lays a line out as a Canvas rectangle sprite: surface X runs from From to To in blocks, and the
 * sprite's face is turned about the line toward the eye. Returns undefined for a degenerate line.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function SegmentOf(
    line: Pick<Line, "From" | "To" | "Eye" | "Color" | "Thickness">
): Segment | undefined
{
    const axis = Add(line.To, line.From, -1);
    const length = Math.hypot(axis.x, axis.y, axis.z);
    const along = Unit(axis);
    if (!along || !(length > 1e-6) || !(line.Thickness > 0))
    {
        return undefined;
    }

    const middle = Add(line.From, axis, 0.5);
    const toward = Add(line.Eye, middle, -1);
    const normal =
        Unit(Add(toward, along, -Dot(toward, along))) ??
        Unit(Cross(along, {
            x: 0,
            y: 1,
            z: 0
        })) ??
        Unit(Cross(along, {
            x: 1,
            y: 0,
            z: 0
        }))!;
    return Object.freeze({
        Pose: Object.freeze({
            LayerDepth: 0,
            Orientation: Object.freeze({
                Right: Freeze(along),
                Up: Freeze(Cross(normal, along))
            }),
            Position: Freeze(line.From),
            Scale: 1
        }),
        Sprite: Object.freeze({
            Bounds: Object.freeze({
                Height: line.Thickness,
                Width: length,
                X: 0,
                Y: -line.Thickness / 2
            }),
            Layer: 0,
            Particle: Rectangle.Particle,
            Path: Object.freeze([]),
            Tint: line.Color,
            UV: Object.freeze({
                Height: Rectangle.TextureSize,
                Width: Rectangle.TextureSize,
                X: 0,
                Y: 0
            })
        })
    });
}

/**
 * One player's targeting result for the current tick. Present only while a widget surface is hit.
 * Line is present only while the line is drawn: the hit is within MaxDistance and the line is not
 * hidden. Hidden lines do not change targeting, eligibility or access counting.
 *
 * @category Model
 * @since 1.0.0
 */
export interface State {
    readonly ViewerId: string;
    readonly Ray: Ray;
    readonly Hit: Hit;
    readonly Target: Types.PointerTarget;
    readonly Input: Types.PointerInput;
    readonly Denial?: Types.PointerDenial;
    readonly Eligible: boolean;
    readonly Line?: Line;
}

/**
 * A player aiming at an interactive control with no other denial, offered to admission.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Candidate {
    readonly ViewerId: string;
    readonly Hit: Hit;
}

/**
 * Tracker configuration. Sources is read every tick; a player can target only sources whose Audience
 * contains its id. View, Hand and HeldItem override the default eye ray, hand estimate and held-item
 * reader. Occlusion false disables world occlusion; a function replaces the native raycast. Access
 * policies on the target and its ancestors are always applied by the tracker's own admission (see
 * Access.CreateAdmission). Admit is an optional further hook: it receives every interactive candidate
 * still eligible after that and returns the ids it denies access. Draw replaces the default private
 * particle line, which needs CreateVariables.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration {
    readonly World: Players;
    readonly System: Scheduler;
    readonly Sources: () => Iterable<Source>;
    readonly CreateVariables?: () => Variables;
    readonly Draw?: (line: Line) => void;
    readonly View?: (player: Player) => Ray | undefined;
    readonly Hand?: (player: Player, ray: Ray) => Types.Vector;
    readonly HeldItem?: (player: Player) => string | undefined;
    readonly Occlusion?: false | ((player: Player, ray: Ray, range: number) => number | undefined);
    readonly Admit?: (candidates: ReadonlyArray<Candidate>) => Iterable<string>;
    readonly Range?: number;
    readonly Thickness?: number;
    readonly PressTicks?: number;
    readonly DoubleSided?: boolean;
    readonly OnError?: (error: Error) => void;
}

/**
 * A running pointer tracker. Update runs one targeting pass; the tracker also runs one every tick.
 * Press shows an observed Use for PressTicks updates. Retain keeps a ScrollView's hover scrollbar
 * shown for a player during an active gesture until the returned release is called. ScrollbarVisible
 * answers whether a ScrollView's scrollbar is shown to a player. Subscribe receives the states after
 * every update. Dispose stops updates and clears all state; later Press, Retain and Subscribe throw.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Tracker {
    readonly Disposed: boolean;
    readonly Get: (viewerId: string) => State | undefined;
    readonly All: () => ReadonlyMap<string, State>;
    readonly Press: (viewerId: string) => void;
    readonly Retain: (viewerId: string, source: Source, itemId: number) => () => void;
    readonly ScrollbarVisible: (viewerId: string, source: Source, item: Layout.Item) => boolean;
    readonly Subscribe: (listener: (states: ReadonlyMap<string, State>) => void) => () => void;
    readonly Update: () => void;
    readonly Dispose: () => void;
}

/**
 * Checks a positive finite option.
 *
 * @throws { TypeError } If the value is present and not positive and finite.
 *
 * @category Validation
 * @since 1.0.0
 */
function Positive(value: number | undefined, fallback: number, field: string): number
{
    if (value === undefined)
    {
        return fallback;
    }

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    {
        throw new TypeError(`Pointer ${field} must be a positive finite number.`);
    }

    return value;
}

/**
 * Starts a pointer tracker. Every tick it samples online players, casts each player's view ray against
 * the sources presented to that player, respects world occlusion, resolves eligibility, admits
 * players through the access policies of their targets (counting hidden-line pointers too),
 * and draws each visible line privately to its player. Line drawing reuses Canvas's rectangle particle.
 * Failures are isolated per player and reported once per condition until they clear; a failing
 * source list, admission hook or occlusion raycast fails closed.
 *
 * @throws { TypeError } If required services or options are invalid.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Start(configuration: Configuration): Tracker
{
    if (
        !configuration ||
        typeof configuration.World?.getAllPlayers !== "function" ||
        typeof configuration.System?.runInterval !== "function" ||
        typeof configuration.System.clearRun !== "function" ||
        typeof configuration.Sources !== "function" ||
        (configuration.Draw === undefined && typeof configuration.CreateVariables !== "function")
    )
    {
        throw new TypeError(
            "Pointer.Start requires World, System, Sources and either Draw or CreateVariables."
        );
    }

    for (const key of [ "Draw", "View", "Hand", "HeldItem", "Admit", "OnError", "CreateVariables" ] as const)
    {
        if (configuration[key] !== undefined && typeof configuration[key] !== "function")
        {
            throw new TypeError(`Pointer ${key} must be a function.`);
        }
    }

    if (configuration.Occlusion !== undefined && configuration.Occlusion !== false &&
        typeof configuration.Occlusion !== "function")
    {
        throw new TypeError("Pointer Occlusion must be false or a function.");
    }

    const range = Positive(configuration.Range, Defaults.Range, "Range");
    const thickness = Positive(configuration.Thickness, Defaults.Thickness, "Thickness");
    const pressTicks = Positive(configuration.PressTicks, Defaults.PressTicks, "PressTicks");
    const options = Object.freeze({ ...configuration });
    let closed = false;
    let tick = 0;
    let states: ReadonlyMap<string, State> = Object.freeze(new Map());
    const presses = new Map<string, number>();
    const retained = new Map<string, Map<Source, Map<number, number>>>();
    const listeners = new Set<(states: ReadonlyMap<string, State>) => void>();
    const admission = Access.CreateAdmission({
        OnError: (error: Error): void => raise(`predicate:${error.message}`, error)
    });
    const reported = new Set<string>();
    let active = new Set<string>();
    const raise = (key: string, error: unknown): void =>
    {
        active.add(key);
        if (reported.has(key))
        {
            return;
        }

        reported.add(key);
        try
        {
            options.OnError?.(error instanceof Error ? error : new Error(String(error)));
        }
        catch
        {
            /* Diagnostics cannot interrupt targeting. */
        }
    };

    const view = (player: Player): Ray | undefined =>
        options.View
            ? options.View(player)
            : {
                Direction: player.getViewDirection(),
                Origin: player.getHeadLocation()
            };
    const draw = (line: Line): void =>
    {
        if (options.Draw)
        {
            options.Draw(line);
            return;
        }

        const segment = SegmentOf(line);
        if (!segment)
        {
            return;
        }

        const report = Emit({
            Content: [ segment.Sprite ],
            CreateVariables: options.CreateVariables!,
            Dimension: line.Dimension,
            MaxDistance: range,
            Pose: segment.Pose,
            Viewers: [ line.Viewer ]
        });
        if (report.Errors.length)
        {
            throw report.Errors[0];
        }
    };

    const update = (): void =>
    {
        if (closed)
        {
            return;
        }

        tick++;
        active = new Set();
        let sources: Array<Source>;
        let players: Array<Player>;
        try
        {
            sources = [ ...options.Sources() ];
            players = [ ...options.World.getAllPlayers() ];
        }
        catch (error)
        {
            raise("sources", new Error("Pointer could not read players or sources.", { cause: error }));
            sources = [];
            players = [];
        }

        const pending: Array<Pending> = [];
        const online = new Set<string>();
        for (const player of players)
        {
            let id = "";
            try
            {
                if (!player || player.isValid !== true || typeof player.id !== "string" || !player.id)
                {
                    continue;
                }

                id = player.id;
                online.add(id);
                const ray = view(player);
                if (!ray || !IsVector(ray.Origin) || !IsVector(ray.Direction) || !Unit(ray.Direction))
                {
                    continue;
                }

                let obstruction: number | undefined;
                if (options.Occlusion !== false)
                {
                    try
                    {
                        obstruction = (options.Occlusion ?? Obstruction)(player, ray, range);
                    }
                    catch (error)
                    {
                        raise(`occlusion:${id}`, new Error(`Pointer could not test occlusion for ${id}.`,
                            { cause: error }));
                        obstruction = 0;
                    }
                }

                const visible = sources.filter(
                    (source: Source) => Array.isArray(source?.Audience) && source.Audience.includes(id)
                );
                const hit = Cast(visible, ray, {
                    Dimension: player.dimension.id,
                    DoubleSided: options.DoubleSided,
                    Range: range,
                    ...(obstruction === undefined ? {} : { Obstruction: Math.max(0, obstruction) })
                });
                if (!hit)
                {
                    continue;
                }

                const held = (options.HeldItem ?? HeldItem)(player);
                const input: Types.PointerInput = Object.freeze({
                    Use: (presses.get(id) ?? 0) > tick,
                    ...(typeof held === "string" ? { HeldItem: held } : {})
                });
                pending.push({
                    Denial: Deny(hit, input),
                    Hit: hit,
                    Input: input,
                    Player: player,
                    Ray: Object.freeze({
                        Direction: Freeze(ray.Direction),
                        Origin: Freeze(ray.Origin)
                    })
                });
            }
            catch (error)
            {
                raise(`player:${id}`, new Error(`Pointer could not target for player ${id}.`,
                    { cause: error }));
            }
        }

        try
        {
            const denied = admission.Admit(
                pending
                    .filter((entry: Pending) => entry.Denial === undefined)
                    .map((entry: Pending) => ({
                        Policies: SubjectOf(entry.Hit).Access,
                        ViewerId: entry.Player.id
                    }))
            );
            for (const entry of pending)
            {
                if (entry.Denial === undefined && denied.has(entry.Player.id))
                {
                    entry.Denial = "access";
                }
            }
        }
        catch (error)
        {
            raise("access", new Error("Pointer access control failed.", { cause: error }));
            for (const entry of pending)
            {
                if (entry.Denial === undefined && SubjectOf(entry.Hit).Access.length)
                {
                    entry.Denial = "access";
                }
            }
        }

        if (options.Admit)
        {
            const candidates = pending.filter(
                (entry: Pending) => entry.Hit.Control !== undefined && entry.Denial === undefined
            );
            let denied: ReadonlySet<string>;
            try
            {
                denied = new Set(
                    options.Admit(Object.freeze(candidates.map((entry: Pending) =>
                        Object.freeze({
                            Hit: entry.Hit,
                            ViewerId: entry.Player.id
                        }))))
                );
            }
            catch (error)
            {
                raise("admit", new Error("Pointer admission failed.", { cause: error }));
                denied = new Set(candidates.map((entry: Pending) => entry.Player.id));
            }

            for (const entry of candidates)
            {
                if (denied.has(entry.Player.id))
                {
                    entry.Denial = "access";
                }
            }
        }

        const next = new Map<string, State>();
        for (const entry of pending)
        {
            const id = entry.Player.id;
            const eligible = entry.Hit.Control !== undefined && entry.Denial === undefined;
            let line: Line | undefined;
            try
            {
                if (SubjectOf(entry.Hit).Pointer.Visible !== false && !Beyond(entry.Hit))
                {
                    let color: Rgba;
                    try
                    {
                        color = ColorOf(entry.Hit, id, entry.Input, entry.Denial);
                    }
                    catch (error)
                    {
                        raise(`color:${id}`, new Error(`Pointer color callback failed for ${id}.`,
                            { cause: error }));
                        color = Tint(DefaultColor(eligible, entry.Input));
                    }

                    line = Object.freeze({
                        Color: color,
                        Dimension: entry.Player.dimension.id,
                        Eye: entry.Ray.Origin,
                        From: Freeze((options.Hand ?? ((_: Player, ray: Ray) => EstimateHand(ray)))(
                            entry.Player,
                            entry.Ray
                        )),
                        Thickness: thickness,
                        To: entry.Hit.Position,
                        Viewer: entry.Player
                    });
                    draw(line);
                }
            }
            catch (error)
            {
                raise(`line:${id}`, new Error(`Pointer could not draw the line for ${id}.`,
                    { cause: error }));
            }

            next.set(id, Object.freeze({
                Eligible: eligible,
                Hit: entry.Hit,
                Input: entry.Input,
                Ray: entry.Ray,
                Target: TargetOf(entry.Hit),
                ViewerId: id,
                ...(entry.Denial === undefined ? {} : { Denial: entry.Denial }),
                ...(line === undefined ? {} : { Line: line })
            }));
        }

        for (const id of [ ...retained.keys() ])
        {
            if (!online.has(id))
            {
                retained.delete(id);
            }
        }

        for (const [ id, until ] of presses)
        {
            if (until <= tick || !online.has(id))
            {
                presses.delete(id);
            }
        }

        for (const key of [ ...reported ])
        {
            if (!active.has(key))
            {
                reported.delete(key);
            }
        }

        states = Object.freeze(next);
        for (const listener of [ ...listeners ])
        {
            try
            {
                listener(states);
            }
            catch (error)
            {
                raise("listener", new Error("Pointer listener failed.", { cause: error }));
            }
        }
    };

    const check = (): void =>
    {
        if (closed)
        {
            throw new Error("Pointer tracker is disposed.");
        }
    };

    const run = options.System.runInterval(update, 1);
    return Object.freeze({
        All: (): ReadonlyMap<string, State> => states,
        Dispose: (): void =>
        {
            if (closed)
            {
                return;
            }

            closed = true;
            states = Object.freeze(new Map());
            presses.clear();
            admission.Reset();
            retained.clear();
            listeners.clear();
            try
            {
                options.System.clearRun(run);
            }
            catch (error)
            {
                raise("dispose", new Error("Pointer could not stop its updates.", { cause: error }));
            }
        },
        get Disposed(): boolean
        {
            return closed;
        },
        Get: (viewerId: string): State | undefined => states.get(viewerId),
        Press: (viewerId: string): void =>
        {
            check();
            presses.set(viewerId, tick + 1 + pressTicks);
        },
        Retain: (viewerId: string, source: Source, itemId: number): (() => void) =>
        {
            check();
            const bySource = retained.get(viewerId) ?? new Map<Source, Map<number, number>>();
            const counts = bySource.get(source) ?? new Map<number, number>();
            counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
            bySource.set(source, counts);
            retained.set(viewerId, bySource);
            let released = false;
            return (): void =>
            {
                if (released)
                {
                    return;
                }

                released = true;
                const current = retained.get(viewerId)?.get(source);
                const count = current?.get(itemId) ?? 0;
                if (current && count > 1)
                {
                    current.set(itemId, count - 1);
                }
                else
                {
                    current?.delete(itemId);
                }
            };
        },
        ScrollbarVisible: (viewerId: string, source: Source, item: Layout.Item): boolean =>
        {
            if (closed || !item.Track || item.Hidden)
            {
                return false;
            }

            if (item.Props.scrollbarVisibility !== "hover")
            {
                return true;
            }

            if ((retained.get(viewerId)?.get(source)?.get(item.Id) ?? 0) > 0)
            {
                return true;
            }

            const state = states.get(viewerId);
            return (
                !!state &&
                state.Eligible &&
                state.Hit.Source === source &&
                state.Hit.Part === "track" &&
                state.Hit.Item.Id === item.Id
            );
        },
        Subscribe: (listener: (states: ReadonlyMap<string, State>) => void): (() => void) =>
        {
            check();
            if (typeof listener !== "function")
            {
                throw new TypeError("Pointer listeners must be functions.");
            }

            listeners.add(listener);
            return (): void =>
            {
                listeners.delete(listener);
            };
        },
        Update: update
    });
}
