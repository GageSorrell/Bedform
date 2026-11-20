/**
 * React-independent particle surfaces: oriented textured rectangles laid out in surface pixels,
 * clipped through nested rectangular viewports, projected by a fixed or viewer-facing pose and emitted
 * privately to each audience member. Imports are inert; native adapters are supplied explicitly.
 *
 * @module bedform/Canvas/Surface
 *
 * @file      Surface.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Rgba, TintInput } from "./Color.js";
import type { Vector3 } from "@minecraft/server";
import { WithAssets } from "./Dependency.js";

export type { Channels, Rgba, TintInput } from "./Color.js";

/**
 * Molang variables read by every Canvas surface particle. Floats are set with setFloat, Color with
 * setColorRGBA and Direction with setVector3. UVs are texels of the particle's texture; SizeX and SizeY
 * are half-extents in blocks; Roll is degrees about the facing axis. Unset variables read as zero.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ParticleVariable = Object.freeze({
    Color: "variable.color",
    Direction: "variable.surface_direction",
    Height: "variable.surface_uv_height",
    Roll: "variable.surface_roll",
    SizeX: "variable.surface_size_x",
    SizeY: "variable.surface_size_y",
    U: "variable.surface_u",
    V: "variable.surface_v",
    Width: "variable.surface_uv_width"
} as const);

/**
 * Suffix of the oriented variant of every Canvas surface particle, which faces Direction.
 *
 * @category Constant
 * @since 1.0.0
 */
export const OrientedSuffix = "_oriented" as const;

/**
 * Suffix, after OrientedSuffix, of the depth-writing oriented variant of every Canvas surface
 * particle. Plain oriented particles use the blended particles_blend material, which never writes
 * depth, so overlapping layers draw in client order; depth variants use alpha-tested particles_alpha so
 * layer offsets order them. Select them with Pose.DepthWrite.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DepthSuffix = "_depth" as const;

/**
 * Canvas's plain tintable rectangle particle and its 16 by 16 white texture size.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Rectangle = /* #__PURE__ */ WithAssets(/* #__PURE__ */ Object.freeze({
    Particle: "bedform_canvas:rectangle",
    TextureSize: 16 } as const));

/**
 * Canvas particles live for two ticks; managed surfaces refresh every tick, so a removed or changed
 * sprite remains visible for at most this many ticks.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LifetimeTicks = 2 as const;

/**
 * Default work limits: sprites retained per frame and particle spawns per emission or tick.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const DefaultLimits = Object.freeze({ MaxSpawns: 2_048,
    MaxSprites: 512 } as const);

/**
 * Default audience range in blocks and depth separation per layer in blocks.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Defaults = Object.freeze({ LayerDepth: 0.002,
    MaxDistance: 64 } as const);

/**
 * Default tint: Canvas ink #4D4D4D at alpha 1.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DefaultTint: Rgba = Object.freeze({ alpha: 1,
    blue: 0x4D / 255,
    green: 0x4D / 255,
    red: 0x4D / 255 });

/**
 * Resolves a tint. Omitted tint is DefaultTint; explicit RGB or RGBA wins, unquantized, with alpha 1
 * when omitted. Textures are white, so the result is the drawn color and alpha multiplies texture alpha.
 *
 * @throws { TypeError } If a channel is not finite in [0, 1] or the hex form is malformed.
 *
 * @category Tint
 * @since 1.0.0
 */
export function Tint(input?: TintInput): Rgba
{
    if (input === undefined)
    {
        return DefaultTint;
    }

    if (typeof input === "string")
    {
        const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/iu.exec(input);
        if (!match)
        {
            throw new TypeError("Canvas tint strings use #RRGGBB or #RRGGBBAA.");
        }

        const channel = (offset: number): number => parseInt(match[1].slice(offset, offset + 2), 16) / 255;
        return Object.freeze({ alpha: match[2] === undefined ? 1 : parseInt(match[2], 16) / 255,
            blue: channel(4),
            green: channel(2),
            red: channel(0) });
    }

    const check = (value: unknown): number =>
    {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
        {
            throw new TypeError("Canvas tint channels must be finite numbers from 0 to 1.");
        }

        return value;
    };

    if (input === null || typeof input !== "object")
    {
        throw new TypeError("Canvas tint must be channels or a hex string.");
    }

    return Object.freeze({ alpha: input.alpha === undefined ? 1 : check(input.alpha),
        blue: check(input.blue),
        green: check(input.green),
        red: check(input.red) });
}

/**
 * Axis-aligned rectangle; surface pixels grow right and down, texels likewise.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Box
{
    readonly X: number;
    readonly Y: number;
    readonly Width: number;
    readonly Height: number;
}

/**
 * Two-dimensional offset in surface pixels.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Point
{
    readonly X: number;
    readonly Y: number;
}

/**
 * One textured rectangle. Particle is the base identifier; surfaces spawn its oriented variant. UV
 * selects texels of that particle's texture. Layer offsets depth toward the viewer side of the plane.
 * Key identifies the sprite to hit-testing consumers.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Sprite
{
    readonly Kind: "sprite";
    readonly Particle: string;
    readonly UV: Box;
    readonly Bounds: Box;
    readonly Tint?: TintInput;
    readonly Layer?: number;
    readonly Key?: string;
}

/**
 * A clipping viewport. Clip is in parent coordinates; a child's parent position is
 * Clip.X + Offset.X + child.X * Scale, and likewise for Y. Children outside Clip, and outside every
 * ancestor clip, are trimmed with proportional UVs or removed.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Viewport
{
    readonly Kind: "viewport";
    readonly Clip: Box;
    readonly Offset?: Point;
    readonly Scale?: number;
    readonly Children: ReadonlyArray<Node>;
}

/**
 * A surface content node.
 *
 * @category Model
 * @since 1.0.0
 */
export type Node = Sprite | Viewport;

/**
 * A clipped sprite in root surface pixels, in paint order. Path is its child-index path.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Placed
{
    readonly Particle: string;
    readonly UV: Box;
    readonly Bounds: Box;
    readonly Tint: Rgba;
    readonly Layer: number;
    readonly Path: ReadonlyArray<number>;
    readonly Key?: string;
}

/**
 * Bounds on tree work, preventing unbounded recursion or allocation from untrusted layouts.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const TreeLimits = Object.freeze({ MaxDepth: 32,
    MaxNodes: 8_192 } as const);

/**
 * Creates a full-texture rectangle sprite of Canvas's plain tintable particle.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Fill(bounds: Box, tint?: TintInput, options: { readonly Layer?: number;
    readonly Key?: string } = {}):
Sprite
{
    return Object.freeze({ Bounds: bounds,
        Kind: "sprite",
        Particle: Rectangle.Particle,
        UV: Object.freeze({ Height: Rectangle.TextureSize,
            Width: Rectangle.TextureSize,
            X: 0,
            Y: 0 }),
        ...tint === undefined ? {} : { Tint: tint },
        ...options.Layer === undefined ? {} : { Layer: options.Layer },
        ...options.Key === undefined ? {} : { Key: options.Key } });
}

/**
 * Validates a finite number, optionally positive or nonnegative.
 *
 * @throws { TypeError } If the value is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
function Finite(value: unknown, field: string, minimum?: "positive" | "nonnegative"): number
{
    if (typeof value !== "number" || !Number.isFinite(value) || (minimum === "positive" && value <= 0) ||
        (minimum === "nonnegative" && value < 0))
    {
        throw new TypeError(`Canvas surface ${field} must be a ${minimum ?? "finite"} number.`);
    }

    return value;
}

/**
 * Validates a rectangle with nonnegative size.
 *
 * @throws { TypeError } If the rectangle is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckBox(value: unknown, field: string): Box
{
    if (value === null || typeof value !== "object")
    {
        throw new TypeError(`Canvas surface ${field} must be a rectangle.`);
    }

    const box = value as Box;
    return { Height: Finite(box.Height, `${field}.Height`, "nonnegative"),
        Width: Finite(box.Width, `${field}.Width`, "nonnegative"),
        X: Finite(box.X, `${field}.X`),
        Y: Finite(box.Y, `${field}.Y`) };
}

/**
 * Intersects two rectangles, or returns undefined when they share no area.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Intersect(a: Box, b: Box): Box | undefined
{
    const x0 = Math.max(a.X, b.X);
    const y0 = Math.max(a.Y, b.Y);
    const x1 = Math.min(a.X + a.Width, b.X + b.Width);
    const y1 = Math.min(a.Y + a.Height, b.Y + b.Height);
    return x1 > x0 && y1 > y0 ? { Height: y1 - y0,
        Width: x1 - x0,
        X: x0,
        Y: y0 } : undefined;
}

/**
 * Flattens a content tree into clipped sprites in root surface pixels and paint order. Clipping
 * trims UVs in proportion, so visible texels stay where they were; sprites with no visible area are
 * omitted and can never become hidden interactive targets.
 *
 * @throws { TypeError } If a node, rectangle or tint is invalid.
 * @throws { RangeError } If the tree exceeds TreeLimits.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Flatten(root: Node, clip?: Box): Array<Placed>
{
    const placed: Array<Placed> = [];
    let nodes = 0;
    const visit = (node: Node, transform: { X: number;
        Y: number;
        Scale: number }, bounds: Box | undefined,
    path: Array<number>): void =>
    {
        if (++nodes > TreeLimits.MaxNodes || path.length > TreeLimits.MaxDepth)
        {
            throw new RangeError(`Canvas surface trees are limited to ${TreeLimits.MaxNodes} nodes and ` +
                `depth ${TreeLimits.MaxDepth}.`);
        }

        if (node === null || typeof node !== "object")
        {
            throw new TypeError("Canvas surface nodes must be sprites or viewports.");
        }

        const map = (box: Box): Box => ({ Height: box.Height * transform.Scale,
            Width: box.Width * transform.Scale,
            X: transform.X + box.X * transform.Scale,
            Y: transform.Y + box.Y * transform.Scale });
        if (node.Kind === "viewport")
        {
            const own = map(CheckBox(node.Clip, "Clip"));
            const scale = node.Scale === undefined ? 1 : Finite(node.Scale, "Scale", "positive");
            const offset = node.Offset ?? { X: 0,
                Y: 0 };
            const inner = bounds === undefined ? own : Intersect(bounds, own);
            if (!Array.isArray(node.Children))
            {
                throw new TypeError("Canvas surface viewport Children must be an array.");
            }

            const child = { Scale: transform.Scale * scale,
                X: own.X + Finite(offset.X, "Offset.X") * transform.Scale,
                Y: own.Y + Finite(offset.Y, "Offset.Y") * transform.Scale };
            node.Children.forEach((entry: Node, index: number) =>
            {
                if (inner !== undefined)
                {
                    visit(entry, child, inner, [ ...path, index ]);
                }
                else
                {
                    // Fully clipped subtrees are still validated and counted.
                    visit(entry, child, { Height: 0,
                        Width: 0,
                        X: 0,
                        Y: 0 }, [ ...path, index ]);
                }
            });
            return;
        }

        if (node.Kind !== "sprite" || typeof node.Particle !== "string" || node.Particle.length === 0)
        {
            throw new TypeError("Canvas surface sprites need Kind sprite and a particle identifier.");
        }

        const uv = CheckBox(node.UV, "UV");
        const tint = Tint(node.Tint);
        const layer = node.Layer === undefined ? 0 : Finite(node.Layer, "Layer");
        const full = map(CheckBox(node.Bounds, "Bounds"));
        const visible = bounds === undefined ? (full.Width > 0 && full.Height > 0 ? full : undefined)
            : Intersect(bounds, full);
        if (visible === undefined)
        {
            return;
        }

        const u = uv.Width / full.Width;
        const v = uv.Height / full.Height;
        placed.push(Object.freeze({ Bounds: Object.freeze(visible),
            Layer: layer,
            Particle: node.Particle,
            Path: Object.freeze(path),
            Tint: tint,
            UV: Object.freeze({ Height: visible.Height * v,
                Width: visible.Width * u,
                X: uv.X + (visible.X - full.X) * u,
                Y: uv.Y + (visible.Y - full.Y) * v }),
            ...node.Key === undefined ? {} : { Key: String(node.Key) } }));
    };

    visit(root, { Scale: 1,
        X: 0,
        Y: 0 }, clip === undefined ? undefined : CheckBox(clip, "clip"), []);
    return placed;
}

/**
 * Surface placement. Position is the world point of surface pixel Pivot (default 0, 0); Scale is
 * blocks per surface pixel. Fixed orientation supplies the surface's world right and up directions;
 * FaceViewer turns the whole surface toward each viewer's head, keeping world up. DepthWrite selects
 * the depth-writing particle variants (see DepthSuffix): alpha-tested, so partial translucency is cut
 * out, and their visible side awaits client qualification.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Pose
{
    readonly Position: Readonly<Vector3>;
    readonly Pivot?: Point;
    readonly Scale: number;
    readonly Orientation: "FaceViewer" | Readonly<{ Right: Readonly<Vector3>;
        Up: Readonly<Vector3> }>;
    readonly LayerDepth?: number;
    readonly DepthWrite?: boolean;
}

/**
 * Right, up and normal unit vectors; the normal points toward the visible side.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Basis
{
    readonly Right: Vector3;
    readonly Up: Vector3;
    readonly Normal: Vector3;
}

/**
 * One projected quad and the values sent to its particle.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Quad
{
    readonly Particle: string;
    readonly Location: Vector3;
    readonly Floats: Readonly<Record<string, number>>;
    readonly Color: Rgba;
    readonly Direction: Vector3;
}

const Add = (a: Vector3, b: Vector3, scale: number = 1): Vector3 => ({ x: a.x + b.x * scale,
    y: a.y + b.y * scale,
    z: a.z + b.z * scale });
const Dot = (a: Vector3, b: Vector3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const Cross = (a: Vector3, b: Vector3): Vector3 => ({ x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x });

/**
 * Normalizes a vector, or returns undefined for a degenerate one.
 *
 * @category Geometry
 * @since 1.0.0
 */
function Unit(vector: Vector3): Vector3 | undefined
{
    const length = Math.hypot(vector.x, vector.y, vector.z);
    return Number.isFinite(length) && length > 1e-9 ? { x: vector.x / length,
        y: vector.y / length,
        z: vector.z / length } : undefined;
}

/**
 * Validates a world vector.
 *
 * @throws { TypeError } If a component is not finite.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckVector(value: unknown, field: string): Vector3
{
    const vector = value as Vector3;
    if (vector === null || typeof vector !== "object")
    {
        throw new TypeError(`Canvas surface ${field} must be a vector.`);
    }

    return { x: Finite(vector.x, `${field}.x`),
        y: Finite(vector.y, `${field}.y`),
        z: Finite(vector.z, `${field}.z`) };
}

/**
 * Builds a basis from right and up directions, orthogonalizing up against right.
 *
 * @throws { TypeError } If the directions are degenerate or parallel.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function FixedBasis(right: Vector3, up: Vector3): Basis
{
    const r = Unit(CheckVector(right, "Right"));
    const raw = CheckVector(up, "Up");
    const u = r && Unit(Add(raw, r, -Dot(raw, r)));
    if (!r || !u)
    {
        throw new TypeError("Canvas surface Right and Up must be nonzero and not parallel.");
    }

    return Object.freeze({ Normal: Cross(r, u),
        Right: r,
        Up: u });
}

/**
 * Basis of a surface at a position turned toward an eye, keeping world up where possible.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function FacingBasis(position: Vector3, eye: Vector3): Basis | undefined
{
    const normal = Unit(Add(eye, position, -1));
    if (!normal)
    {
        return undefined;
    }

    const right = Unit(Cross({ x: 0,
        y: 1,
        z: 0 }, normal)) ?? { x: 1,
        y: 0,
        z: 0 };
    return { Normal: normal,
        Right: right,
        Up: Cross(normal, right) };
}

/**
 * Degrees to roll a direction-facing particle so its texture up follows the basis up. The reference
 * is world up projected onto the plane (world -Z for horizontal planes), an assumption about the
 * client's default orientation that native acceptance must confirm.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Roll(basis: Basis): number
{
    const n = basis.Normal;
    const reference = Unit(Add({ x: 0,
        y: 1,
        z: 0 }, n, -n.y)) ?? Unit(Add({ x: 0,
        y: 0,
        z: -1 }, n, n.z))!;
    const angle = Math.atan2(Dot(Cross(reference, basis.Up), n), Dot(reference, basis.Up)) * 180 / Math.PI;
    return Math.abs(angle) < 1e-9 ? 0 : angle;
}

/**
 * Projects placed sprites through a pose and basis into world quads.
 *
 * @throws { TypeError } If the pose is invalid.
 *
 * @category Geometry
 * @since 1.0.0
 */
export function Project(placed: ReadonlyArray<Placed>, pose: Pose, basis: Basis): Array<Quad>
{
    const position = CheckVector(pose.Position, "Position");
    const scale = Finite(pose.Scale, "Scale", "positive");
    const pivot = pose.Pivot ?? { X: 0,
        Y: 0 };
    const depth = pose.LayerDepth === undefined ? Defaults.LayerDepth : Finite(pose.LayerDepth, "LayerDepth");
    const roll = Roll(basis);
    return placed.map((sprite: Placed): Quad =>
    {
        const cx = (sprite.Bounds.X + sprite.Bounds.Width / 2 - pivot.X) * scale;
        const cy = (sprite.Bounds.Y + sprite.Bounds.Height / 2 - pivot.Y) * scale;
        const planar = Add(Add(position, basis.Right, cx), basis.Up, -cy);
        const location = Add(planar, basis.Normal, sprite.Layer * depth);
        return Object.freeze({ Color: sprite.Tint,
            Direction: basis.Normal,
            Floats: Object.freeze({ [ParticleVariable.Height]: sprite.UV.Height,
                [ParticleVariable.Roll]: roll,
                [ParticleVariable.SizeX]: sprite.Bounds.Width * scale / 2,
                [ParticleVariable.SizeY]: sprite.Bounds.Height * scale / 2,
                [ParticleVariable.U]: sprite.UV.X,
                [ParticleVariable.V]: sprite.UV.Y,
                [ParticleVariable.Width]: sprite.UV.Width }),
            Location: location,
            Particle: sprite.Particle + OrientedSuffix + (pose.DepthWrite === true ? DepthSuffix : "") });
    });
}

/**
 * The MolangVariableMap methods surfaces use.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Variables
{
    setFloat(name: string, value: number): void;
    setColorRGBA(name: string, color: Rgba): void;
    setVector3(name: string, vector: Vector3): void;
}

/**
 * The player capabilities surfaces use: identity, validity, dimension, head position and private
 * particle emission (Player.spawnParticle).
 *
 * @category Model
 * @since 1.0.0
 */
export interface Viewer
{
    readonly id: string;
    readonly isValid: boolean;
    readonly dimension: { readonly id: string };
    getHeadLocation(): Vector3;
    spawnParticle(effectName: string, location: Vector3, molangVariables?: Variables): void;
}

/**
 * Why a viewer did not receive a complete frame.
 *
 * @category Model
 * @since 1.0.0
 */
export type SkipReason = "invalid" | "dimension" | "range" | "capacity" | "failure" | "pose";

/**
 * Emission work limits.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Limits
{
    readonly MaxSprites?: number;
    readonly MaxSpawns?: number;
}

/**
 * One emission: viewers, the surface's dimension, pose and content, the MolangVariableMap factory,
 * limits and audience range.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Emission
{
    readonly Viewers: Iterable<Viewer>;
    readonly Dimension: string;
    readonly Pose: Pose;
    readonly Content: Node | ReadonlyArray<Placed>;
    readonly CreateVariables: () => Variables;
    readonly Limits?: Limits;
    readonly MaxDistance?: number;
}

/**
 * Outcome of one emission. Rendered is the frame actually sent (after MaxSprites); Viewers received
 * it completely; Skipped did not, with a reason; Errors holds isolated native failures.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Report
{
    readonly Rendered: ReadonlyArray<Placed>;
    readonly Dropped: number;
    readonly Viewers: ReadonlyArray<string>;
    readonly Skipped: ReadonlyArray<Readonly<{ Id: string;
        Reason: SkipReason }>>;
    readonly Spawned: number;
    readonly Errors: ReadonlyArray<Error>;
}

/**
 * Validates limits against their defaults.
 *
 * @throws { TypeError } If a limit is not a positive safe integer.
 *
 * @category Validation
 * @since 1.0.0
 */
function CheckLimits(limits: Limits = {}): Required<Limits>
{
    const read = (value: number | undefined, fallback: number, field: string): number =>
    {
        if (value === undefined)
        {
            return fallback;
        }

        if (!Number.isSafeInteger(value) || value <= 0)
        {
            throw new TypeError(`Canvas surface ${field} must be a positive safe integer.`);
        }

        return value;
    };

    return { MaxSpawns: read(limits.MaxSpawns, DefaultLimits.MaxSpawns, "MaxSpawns"),
        MaxSprites: read(limits.MaxSprites, DefaultLimits.MaxSprites, "MaxSprites") };
}

/**
 * Emits one frame privately to each eligible viewer through Player.spawnParticle. Viewers must be
 * valid, in the surface's dimension and within range; an empty audience renders nothing. Sprites
 * beyond MaxSprites are dropped in paint order. A viewer receives the whole frame or is skipped when
 * MaxSpawns would be exceeded, nearest viewers first. A native failure stops only that viewer's frame.
 *
 * @throws { TypeError } If the emission is invalid.
 *
 * @category Emission
 * @since 1.0.0
 */
export function Emit(emission: Emission): Report
{
    if (typeof emission?.CreateVariables !== "function" || typeof emission.Dimension !== "string")
    {
        throw new TypeError("Canvas surface emission needs CreateVariables and a Dimension identifier.");
    }

    const limits = CheckLimits(emission.Limits);
    const range = emission.MaxDistance === undefined ? Defaults.MaxDistance
        : Finite(emission.MaxDistance, "MaxDistance", "positive");
    const all = Array.isArray(emission.Content) ? emission.Content as ReadonlyArray<Placed>
        : Flatten(emission.Content as Node);
    const rendered = all.slice(0, limits.MaxSprites);
    const position = CheckVector(emission.Pose.Position, "Position");
    const fixed = emission.Pose.Orientation === "FaceViewer" ? undefined
        : FixedBasis(emission.Pose.Orientation.Right, emission.Pose.Orientation.Up);
    const fixedQuads = fixed && Project(rendered, emission.Pose, fixed);
    const skipped: Array<{ Id: string;
        Reason: SkipReason }> = [];
    const errors: Array<Error> = [];
    const candidates: Array<{ Viewer: Viewer;
        Eye: Vector3;
        Distance: number }> = [];
    const seen = new Set<string>();
    for (const viewer of emission.Viewers)
    {
        const id = String(viewer?.id);
        if (seen.has(id))
        {
            continue;
        }

        seen.add(id);
        try
        {
            if (!viewer.isValid)
            {
                skipped.push({ Id: id,
                    Reason: "invalid" });
                continue;
            }

            if (viewer.dimension.id !== emission.Dimension)
            {
                skipped.push({ Id: id,
                    Reason: "dimension" });
                continue;
            }

            const eye = viewer.getHeadLocation();
            const distance = Math.hypot(eye.x - position.x, eye.y - position.y, eye.z - position.z);
            if (!(distance <= range))
            {
                skipped.push({ Id: id,
                    Reason: "range" });
                continue;
            }

            candidates.push({ Distance: distance,
                Eye: eye,
                Viewer: viewer });
        }
        catch (error)
        {
            errors.push(new Error(`Canvas surface could not read viewer ${id}.`, { cause: error }));
            skipped.push({ Id: id,
                Reason: "failure" });
        }
    }

    candidates.sort((a: { Distance: number;
        Viewer: Viewer }, b: { Distance: number;
        Viewer: Viewer }) =>
        a.Distance - b.Distance || (a.Viewer.id < b.Viewer.id ? -1 : a.Viewer.id > b.Viewer.id ? 1 : 0));
    const viewers: Array<string> = [];
    let spawned = 0;
    let variables: Variables | undefined;
    for (const { Eye: eye, Viewer: viewer } of candidates)
    {
        if (spawned + rendered.length > limits.MaxSpawns)
        {
            skipped.push({ Id: viewer.id,
                Reason: "capacity" });
            continue;
        }

        const basis = fixed ?? FacingBasis(position, eye);
        if (!basis)
        {
            skipped.push({ Id: viewer.id,
                Reason: "pose" });
            continue;
        }

        const quads = fixedQuads ?? Project(rendered, emission.Pose, basis);
        try
        {
            for (const quad of quads)
            {
                variables ??= emission.CreateVariables();
                for (const [ name, value ] of Object.entries(quad.Floats))
                {
                    variables.setFloat(name, value);
                }

                variables.setColorRGBA(ParticleVariable.Color, quad.Color);
                variables.setVector3(ParticleVariable.Direction, quad.Direction);
                viewer.spawnParticle(quad.Particle, quad.Location, variables);
                spawned++;
            }

            viewers.push(viewer.id);
        }
        catch (error)
        {
            errors.push(new Error(`Canvas surface could not emit to viewer ${viewer.id}.`, { cause: error }));
            skipped.push({ Id: viewer.id,
                Reason: "failure" });
        }
    }

    return Object.freeze({ Dropped: all.length - rendered.length,
        Errors: Object.freeze(errors),
        Rendered: Object.freeze(rendered),
        Skipped: Object.freeze(skipped.map((entry: { Id: string;
            Reason: SkipReason }) => Object.freeze(entry))),
        Spawned: spawned,
        Viewers: Object.freeze(viewers) });
}

/**
 * The scheduler capabilities managed surfaces use.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Scheduler
{
    runInterval(callback: () => void, tickInterval?: number): number;
    clearRun(runId: number): void;
}

/**
 * Managed surface configuration. Audience is read every tick; a private surface returns its one
 * player. Errors are reported once per distinct condition until it clears.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options
{
    readonly System: Scheduler;
    readonly Audience: () => Iterable<Viewer>;
    readonly Dimension: string;
    readonly Pose: Pose;
    readonly Content: Node;
    readonly CreateVariables: () => Variables;
    readonly Limits?: Limits;
    readonly MaxDistance?: number;
    readonly OnError?: (error: Error) => void;
}

/**
 * Replaceable presentation inputs; omitted fields keep their current values.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Change
{
    readonly Audience?: () => Iterable<Viewer>;
    readonly Dimension?: string;
    readonly Pose?: Pose;
    readonly Content?: Node;
    readonly Limits?: Limits;
    readonly MaxDistance?: number;
}

/**
 * A managed surface refreshed every tick. Rendered lists the sprites actually emitted, for
 * hit-testing; VisibleTo reports whether a viewer received the last complete frame. Dispose stops
 * refreshes, leaving at most LifetimeTicks of visual tail, and later Update calls throw.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Handle
{
    readonly Update: (change: Change) => void;
    readonly Rendered: () => ReadonlyArray<Placed>;
    readonly VisibleTo: (viewerId: string) => boolean;
    readonly LastReport: () => Report | undefined;
    readonly Dispose: () => void;
}

/**
 * Creates a managed surface. Content is validated and flattened before any native work; the first
 * frame is emitted on the next tick and every tick after. Capacity drops and per-viewer failures are
 * reported and retried each tick without affecting other viewers or surfaces.
 *
 * @throws { TypeError } If options are invalid.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export function Create(options: Options): Handle
{
    if (typeof options?.System?.runInterval !== "function" || typeof options.System.clearRun !== "function" ||
        typeof options.Audience !== "function" || typeof options.CreateVariables !== "function" ||
        (options.OnError !== undefined && typeof options.OnError !== "function"))
    {
        throw new TypeError("Canvas surfaces need a System scheduler, Audience, CreateVariables and " +
            "optional " +
            "OnError.");
    }

    type State = { Audience: () => Iterable<Viewer>;
        Dimension: string;
        Pose: Pose;
        Placed: Array<Placed>;
        Limits: Limits | undefined;
        MaxDistance: number | undefined };
    const prepare = (base: State | undefined, change: Change): State =>
    {
        const pose = change.Pose ?? base!.Pose;
        CheckVector(pose.Position, "Position");
        Finite(pose.Scale, "Scale", "positive");
        if (pose.Orientation !== "FaceViewer")
        {
            FixedBasis(pose.Orientation.Right, pose.Orientation.Up);
        }

        const limits = change.Limits ?? base?.Limits;
        CheckLimits(limits);
        const dimension = change.Dimension ?? base!.Dimension;
        const audience = change.Audience;
        if (typeof dimension !== "string" || (audience !== undefined && typeof audience !== "function"))
        {
            throw new TypeError("Canvas surface Dimension must be a string and Audience a function.");
        }

        const maxDistance = change.MaxDistance ?? base?.MaxDistance;
        if (maxDistance !== undefined)
        {
            Finite(maxDistance, "MaxDistance", "positive");
        }

        return { Audience: change.Audience ?? base!.Audience,
            Dimension: dimension,
            Limits: limits,
            MaxDistance: maxDistance,
            Placed: change.Content === undefined ? base!.Placed : Flatten(change.Content),
            Pose: pose };
    };

    let state = prepare(undefined, options);
    let closed = false;
    let report: Report | undefined;
    const reported = new Set<string>();
    const raise = (key: string, error: Error): void =>
    {
        if (reported.has(key))
        {
            return;
        }

        reported.add(key);
        try
        {
            options.OnError?.(error);
        }
        catch
        {
            // Diagnostics cannot interrupt rendering.
        }
    };

    const tick = (): void =>
    {
        if (closed)
        {
            return;
        }

        let viewers: Array<Viewer>;
        try
        {
            viewers = [ ...state.Audience() ];
            reported.delete("audience");
        }
        catch (error)
        {
            // Fail closed: an unreadable audience never renders publicly.
            raise("audience", new Error("Canvas surface audience could not be read.", { cause: error }));
            report = undefined;
            return;
        }

        report = Emit({ Content: state.Placed,
            CreateVariables: options.CreateVariables,
            Dimension: state.Dimension,
            Viewers: viewers,
            ...state.Limits === undefined ? {} : { Limits: state.Limits },
            ...state.MaxDistance === undefined ? {} : { MaxDistance: state.MaxDistance },
            Pose: state.Pose });
        const active = new Set<string>();
        if (report.Dropped > 0)
        {
            active.add("dropped");
            raise("dropped", new RangeError(`Canvas surface dropped ${report.Dropped} sprites beyond ` +
                "MaxSprites."));
        }

        for (const { Id: id, Reason: reason } of report.Skipped)
        {
            if (reason === "capacity" || reason === "failure")
            {
                const key = `${reason}:${id}`;
                active.add(key);
                const cause = reason === "failure"
                    ? report.Errors.find((error: Error) => error.message.endsWith(` ${id}.`)) : undefined;
                raise(key, reason === "capacity"
                    ? new RangeError(`Canvas surface skipped viewer ${id}: MaxSpawns reached.`)
                    : cause ?? new Error(`Canvas surface failed for viewer ${id}.`));
            }
        }

        for (const key of [ ...reported ])
        {
            if (key !== "audience" && !active.has(key))
            {
                reported.delete(key);
            }
        }
    };

    const run = options.System.runInterval(tick, 1);
    return Object.freeze({
        Dispose: (): void =>
        {
            if (closed)
            {
                return;
            }

            closed = true;
            report = undefined;
            try
            {
                options.System.clearRun(run);
            }
            catch (error)
            {
                raise("dispose", new Error("Canvas surface could not stop its refresh.", { cause: error }));
            }
        },
        LastReport: (): Report | undefined => report,
        Rendered: (): ReadonlyArray<Placed> => closed ? [] : report?.Rendered ?? [],
        Update: (change: Change): void =>
        {
            if (closed)
            {
                throw new Error("Canvas surface is disposed; create a new surface.");
            }

            // Validate completely before replacing the presented state.
            state = prepare(state, change ?? {});
            reported.delete("dropped");
        },
        VisibleTo: (viewerId: string): boolean => !closed && (report?.Viewers.includes(viewerId) ?? false)
    });
}
