/**
 * Demonstration-only particle backend for spatial React roots: paints committed layout items with
 * BedformCanvas widget art (nine-sliced buttons, toggles, sliders and scrollbars) and tinted fills,
 * with per-viewer hover and press states read from the pointer tracker. Bedform's own widget backend
 * is later work; this one exists so the demonstration can show what is built so far.
 *
 * @module @sorrell/widget-demo/Script/Backend
 *
 * @file      Backend.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Layout from "../../../Package/Bedform/Source/Spatial/Layout.js";
import type * as Pointer from "../../../Package/Bedform/Source/Spatial/Pointer.js";
import type * as Renderer from "../../../Package/Bedform/Source/Spatial/Renderer.js";
import { Emit, Fill, Flatten } from "../../../Package/Bedform/Source/Canvas/Surface.js";
import type { Placed, Pose, Sprite, TintInput, Variables, Viewer } from
    "../../../Package/Bedform/Source/Canvas/Surface.js";
import { Kind } from "../../../Package/Bedform/Source/Spatial/Internal/ComponentKind.js";
import { WidgetImages } from "../../BedformCanvas/Public/Widget.generated.js";

/**
 * Layout pixels per widget-art texel, matching the GUI scale of the art.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TexelPixels = 2 as const;

/**
 * Widget art names this backend paints with.
 *
 * @category Model
 * @since 1.0.0
 */
export type Art = keyof typeof WidgetImages;

/**
 * Nine-slice borders in texels: one value for every edge, or left, top, right and bottom.
 *
 * @category Model
 * @since 1.0.0
 */
export type Border = number | readonly [ number, number, number, number ];

/**
 * The hover and press state of one viewer's pointer on this root.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Hover {
    readonly Control?: number;
    readonly Pressed: boolean;
}

/**
 * One View's sprites, ready to emit with that View's pose.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Group {
    readonly View: Layout.View;
    readonly Sprites: ReadonlyArray<Placed>;
}

/**
 * Backend services: the pointer tracker (if started), the pointer source of each root, whether to
 * spawn depth-writing particle variants, Molang maps and error reporting.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Options {
    readonly Tracker: () => Pointer.Tracker | undefined;
    readonly Source: (rootId: number) => Pointer.Source | undefined;
    readonly DepthWrite: () => boolean;
    readonly CreateVariables: () => Variables;
    readonly OnError: (error: unknown) => void;
}

/**
 * Splits widget art into up to nine sprites so its border keeps its texel size at any box size.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function NineSlice(art: Art, bounds: Layout.Box, border: Border, layer: number): Array<Sprite>
{
    const image = WidgetImages[art].Image;
    const [ left, top, right, bottom ] = typeof border === "number"
        ? [ border, border, border, border ]
        : border;
    const scale = Math.min(
        TexelPixels,
        bounds.Width / Math.max(1, left + right),
        bounds.Height / Math.max(1, top + bottom)
    );
    const columns = [
        [ 0, left, bounds.X, left * scale ],
        [ left, image.Width - left - right, bounds.X + left * scale, bounds.Width - (left + right) * scale ],
        [ image.Width - right, right, bounds.X + bounds.Width - right * scale, right * scale ]
    ] as const;
    const rows = [
        [ 0, top, bounds.Y, top * scale ],
        [ top, image.Height - top - bottom, bounds.Y + top * scale, bounds.Height - (top + bottom) * scale ],
        [ image.Height - bottom, bottom, bounds.Y + bounds.Height - bottom * scale, bottom * scale ]
    ] as const;
    const sprites: Array<Sprite> = [];
    for (const [ u, width, x, w ] of columns)
    {
        for (const [ v, height, y, h ] of rows)
        {
            if (width > 0 && height > 0 && w > 0 && h > 0)
            {
                sprites.push({
                    Bounds: {
                        Height: h,
                        Width: w,
                        X: x,
                        Y: y
                    },
                    Kind: "sprite",
                    Layer: layer,
                    Particle: image.Particle,
                    UV: {
                        Height: height,
                        Width: width,
                        X: u,
                        Y: v
                    }
                });
            }
        }
    }

    return sprites;
}

/**
 * One whole-texture sprite of widget art.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Picture(art: Art, bounds: Layout.Box, layer: number, tint?: TintInput): Sprite
{
    const image = WidgetImages[art].Image;
    return {
        Bounds: bounds,
        Kind: "sprite",
        Layer: layer,
        Particle: image.Particle,
        UV: {
            Height: image.Height,
            Width: image.Width,
            X: 0,
            Y: 0
        },
        ...(tint === undefined ? {} : { Tint: tint })
    };
}

/**
 * Nesting depth of an item within its View.
 *
 * @category Getter
 * @since 1.0.0
 */
function Depth(byId: ReadonlyMap<number, Layout.Item>, item: Layout.Item): number
{
    let depth = 0;
    for (let parent = item.ParentId; parent !== undefined; parent = byId.get(parent)?.ParentId)
    {
        depth++;
    }

    return depth;
}

/**
 * Paints a slider's track, progress and thumb from its controlled value.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Slider(item: Layout.Item, hovered: boolean, layer: number): Array<Sprite>
{
    const minimum = (item.Props.Min as number | undefined) ?? 0;
    const maximum = (item.Props.Max as number | undefined) ?? 1;
    const value = item.Props.Value as number;
    const fraction = maximum > minimum
        ? Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)))
        : 0;
    const box = item.Content;
    const track = {
        Height: 6,
        Width: box.Width,
        X: box.X,
        Y: box.Y + box.Height / 2 - 3
    };
    const thumb = 12;
    return [
        ...NineSlice(hovered ? "SliderTrackHover" : "SliderTrack", track, 1, layer),
        ...NineSlice(hovered ? "SliderProgressHover" : "SliderProgress", { ...track,
            Width: Math.max(2, track.Width * fraction) }, 1, layer + 1),
        ...NineSlice(hovered ? "SliderThumbHover" : "SliderThumb", {
            Height: thumb,
            Width: thumb,
            X: box.X + (box.Width - thumb) * fraction,
            Y: box.Y + box.Height / 2 - thumb / 2
        }, 2, layer + 2)
    ];
}

/**
 * Paints a ScrollView's gutter and a thumb sized by its viewport-to-content ratio.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Scrollbar(layout: Layout.Result, byId: ReadonlyMap<number, Layout.Item>, item: Layout.Item,
    layer: number): Array<Sprite>
{
    const track = item.Track!;
    let bottom = item.Content.Y;
    for (const other of layout.Items)
    {
        for (let parent = other.ParentId; parent !== undefined; parent = byId.get(parent)?.ParentId)
        {
            if (parent === item.Id)
            {
                bottom = Math.max(bottom, other.Bounds.Y + other.Bounds.Height);
                break;
            }
        }
    }

    const scroll = item.Scroll?.Y ?? 0;
    const extent = Math.max(item.Content.Height, bottom - item.Content.Y + scroll);
    const height = Math.max(8, track.Height * item.Content.Height / extent);
    const travel = Math.max(0, extent - item.Content.Height);
    return [
        ...NineSlice("ScrollGutter", track, 1, layer),
        ...NineSlice("ScrollThumb", {
            Height: height,
            Width: track.Width,
            X: track.X,
            Y: track.Y + (travel ? (track.Height - height) * scroll / travel : 0)
        }, [ 1, 2, 1, 2 ], layer + 1)
    ];
}

/**
 * Converts a committed layout into clipped sprites per View for one viewer's hover state. Pure: the
 * scrollbar callback decides per item whether a scrollbar is shown.
 *
 * @category Converting
 * @since 1.0.0
 */
export function Paint(layout: Layout.Result, hover: Hover, scrollbar: (item: Layout.Item) => boolean):
ReadonlyArray<Group>
{
    const byId = new Map(layout.Items.map((item: Layout.Item) => [ item.Id, item ] as const));
    const groups = new Map<number, Array<Placed>>();
    for (const item of layout.Items)
    {
        if (item.Hidden)
        {
            continue;
        }

        const layer = Depth(byId, item) * 3 - 48 + item.Layer * 3;
        const hovered = hover.Control === item.Id;
        const disabled = item.Props.Disabled === true;
        const sprites: Array<Sprite> = [];
        switch (item.Type)
        {
            case Kind.Button:
            case Kind.TabButton:
                sprites.push(...(disabled
                    ? NineSlice("ButtonDisabled", item.Bounds, 1, layer)
                    : NineSlice(hovered ? hover.Pressed ? "ButtonLightPressed" : "ButtonLightHover"
                        : "ButtonLightNormal", item.Bounds, 1, layer)));
                break;
            case Kind.Toggle:
            {
                const checked = item.Props.Checked === true;
                sprites.push(...NineSlice(hovered ? "ButtonLightHover" : "ButtonLightNormal", item.Bounds, 1,
                    layer));
                sprites.push(Picture(checked ? hovered ? "ToggleOnHover" : "ToggleOn"
                    : hovered ? "ToggleOffHover" : "ToggleOff", {
                    Height: 16,
                    Width: 30,
                    X: item.Bounds.X + 3,
                    Y: item.Bounds.Y + item.Bounds.Height / 2 - 8
                }, layer + 1));
                break;
            }

            case Kind.Slider:
                sprites.push(...Slider(item, hovered, layer));
                break;
            case Kind.ScrollView:
                if (item.Track && scrollbar(item))
                {
                    sprites.push(...Scrollbar(layout, byId, item, layer + 30));
                }

                break;
            default:
                if (item.Props.BackgroundColor !== undefined && item.Type !== Kind.Text)
                {
                    sprites.push(Fill(item.Bounds, item.Props.BackgroundColor as TintInput,
                        { Layer: layer }));
                }
        }

        const placed = groups.get(item.ViewId) ?? [];
        for (const sprite of sprites)
        {
            placed.push(...Flatten(sprite, item.Clip));
        }

        groups.set(item.ViewId, placed);
    }

    return layout.Views.map((view: Layout.View) => Object.freeze({
        Sprites: Object.freeze(groups.get(view.Id) ?? []),
        View: view
    }));
}

/**
 * The Canvas pose of a View: its origin, scale and right/up directions, with layers spaced by its
 * LayerDepth toward its +Z front.
 *
 * @category Converting
 * @since 1.0.0
 */
export function PoseOf(view: Layout.View, depthWrite: boolean = false): Pose
{
    const origin = Layout.Project(view, {
        X: 0,
        Y: 0
    });
    const right = Layout.Project(view, {
        X: view.PixelsPerBlock,
        Y: 0
    });
    const up = Layout.Project(view, {
        X: 0,
        Y: -view.PixelsPerBlock
    });
    return {
        DepthWrite: depthWrite,
        LayerDepth: view.LayerDepth,
        Orientation: {
            Right: {
                x: right.x - origin.x,
                y: right.y - origin.y,
                z: right.z - origin.z
            },
            Up: {
                x: up.x - origin.x,
                y: up.y - origin.y,
                z: up.z - origin.z
            }
        },
        Position: origin,
        Scale: 1 / view.PixelsPerBlock
    };
}

/**
 * Creates the per-viewer particle surface factory. Each viewer's surface repaints every tick, so
 * hover, press and hover-scrollbar state are private to that viewer.
 *
 * @category Factory
 * @since 1.0.0
 */
export function Create(options: Options): Renderer.SurfaceFactory
{
    return {
        Create: (context: Renderer.SurfaceContext): Renderer.Surface =>
        {
            let frame: Renderer.SurfaceFrame | undefined;
            let active = true;
            const reported = new Set<string>();
            const viewer = context.Viewer as unknown as Viewer;
            return {
                Commit: (next: Renderer.SurfaceFrame): void =>
                {
                    frame = next;
                },
                Dispose: (): void =>
                {
                    active = false;
                    frame = undefined;
                },
                Update: (): void =>
                {
                    if (!active || !frame?.Layout)
                    {
                        return;
                    }

                    const tracker = options.Tracker();
                    const source = options.Source(context.RootId);
                    const state = tracker?.Get(viewer.id);
                    const hover: Hover = state && source && state.Hit.Source === source
                        ? {
                            Control: state.Eligible ? state.Hit.Control?.Id : undefined,
                            Pressed: state.Input.Use
                        }
                        : { Pressed: false };
                    const shown = (item: Layout.Item): boolean => tracker && source
                        ? tracker.ScrollbarVisible(viewer.id, source, item)
                        : item.Props.scrollbarVisibility !== "hidden";
                    for (const group of Paint(frame.Layout, hover, shown))
                    {
                        const report = Emit({
                            Content: group.Sprites,
                            CreateVariables: options.CreateVariables,
                            Dimension: group.View.Dimension,
                            Pose: PoseOf(group.View, options.DepthWrite()),
                            Viewers: [ viewer ]
                        });
                        for (const error of report.Errors)
                        {
                            if (!reported.has(error.message))
                            {
                                reported.add(error.message);
                                options.OnError(error);
                            }
                        }
                    }
                }
            };
        }
    };
}

/**
 * Combines surface factories so every viewer lease drives each backend.
 *
 * @category Factory
 * @since 1.0.0
 */
export function Combine(...factories: Array<Renderer.SurfaceFactory>): Renderer.SurfaceFactory
{
    return {
        Create: (context: Renderer.SurfaceContext): Renderer.Surface =>
        {
            const surfaces = factories.map((factory: Renderer.SurfaceFactory) => factory.Create(context));
            const each = (action: (surface: Renderer.Surface) => void): void =>
            {
                const errors: Array<unknown> = [];
                for (const surface of surfaces)
                {
                    try
                    {
                        action(surface);
                    }
                    catch (error)
                    {
                        errors.push(error);
                    }
                }

                if (errors.length)
                {
                    throw new AggregateError(errors, "A combined widget surface failed.");
                }
            };

            return {
                Commit: (frame: Renderer.SurfaceFrame): void => each((surface: Renderer.Surface) =>
                    surface.Commit(frame)),
                Dispose: (): void => each((surface: Renderer.Surface) => surface.Dispose()),
                Update: (): void => each((surface: Renderer.Surface) => surface.Update())
            };
        }
    };
}
