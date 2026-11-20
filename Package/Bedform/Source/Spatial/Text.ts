/**
 * Private per-line TextPrimitive surfaces with measured anchors and owned native cleanup.
 *
 * @module bedform/Spatial/Text
 *
 * @file      Text.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Layout from "./Layout.js";
import type * as Surface from "./Internal/Surface.js";
import type { Rgba } from "../Canvas/Color.js";
import { Tint } from "../Canvas/Surface.js";
import type { Vector } from "./ComponentTypes.js";
import type { Viewer } from "./Renderer.js";
import { WithAssets } from "../Canvas/Dependency.js";

/**
 * Estimated blocks per large-font pixel at native scale one; client calibration remains open.
 *
 * @category Constant
 * @since 1.0.0
 */
export const BlocksPerLargePixel = 0.025 as const;

/**
 * Native location always includes a dimension, preventing cross-dimension text leakage.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Location extends Vector {
    readonly dimension: unknown;
}

/**
 * TextPrimitive's presentation ABI, injected explicitly without importing a native module.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Primitive {
    visibleTo: Array<Viewer>;
    useRotation: boolean;
    rotation: Vector;
    scale: number;
    color: Rgba;
    backgroundColorOverride: Rgba;
    depthTest: boolean;
    textBackfaceVisible: boolean;
    backfaceVisible: boolean;
    readonly setText: (value: string) => void;
    readonly setLocation: (location: Location) => void;
    readonly remove: () => void;
}

/**
 * Explicit native adapters. CreateText returns an unregistered primitive; AddText registers it only
 * after its private audience, depth and face flags are set. Dimension resolves native identities.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration {
    readonly CreateText: (location: Location, text: string) => Primitive;
    readonly AddText: (text: Primitive, dimension: unknown) => void;
    readonly Dimension: (id: string) => unknown;
}

/**
 * One retained line and its placement resend deadline, advanced by the surface's runtime ticks.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
interface Entry {
    readonly Primitive: Primitive;
    readonly Release: () => void;
    Value: string;
    Resend: number;
    Signature: string;
}

/**
 * Converts the View's rigid plane to TextPrimitive Euler angles. Yaw uses the client's opposite sign
 * to entities and is normalized to (-180, 180]; pitch and roll preserve arbitrary View orientation.
 *
 * @category Converting
 * @since 1.0.0
 */
function Rotation(view: Layout.View): Vector
{
    const origin = Layout.Project(view, { X: 0,
        Y: 0 });
    const point = Layout.Project(view, { X: 0,
        Y: 0 }, 1);
    const normal = { x: point.x - origin.x,
        y: point.y - origin.y,
        z: point.z - origin.z };
    const upPoint = Layout.Project(view, { X: 0,
        Y: -view.PixelsPerBlock });
    const up = { x: upPoint.x - origin.x,
        y: upPoint.y - origin.y,
        z: upPoint.z - origin.z };
    const yaw = Math.atan2(normal.x, normal.z);
    const right = { x: Math.cos(yaw),
        z: -Math.sin(yaw) };
    const degrees = yaw * 180 / Math.PI;
    return { x: -Math.asin(Math.max(-1, Math.min(1, normal.y))) * 180 / Math.PI,
        y: degrees <= -180 ? 180 : degrees,
        z: Math.atan2(up.x * right.x + up.z * right.z, up.y) * 180 / Math.PI };
}

/**
 * Creates an inert text-only surface factory, composable with other visual backends. Each outer Text
 * emits one private primitive per fully visible visual line. Partial ScrollView lines are omitted:
 * TextPrimitive has no native scissor. Native font substitutions remain the font pipeline's concern.
 *
 * @category Factory
 * @since 1.0.0
 */
export function CreateSurface(configuration: Configuration): Surface.Factory
{
    WithAssets(configuration);
    return {
        Create: (context: Surface.Context): Surface.Surface =>
        {
            const entries = new Map<string, Entry>();
            let active = true;
            let tick = 0;
            const dispose = (): void =>
            {
                active = false;
                const errors: Array<unknown> = [];
                for (const entry of entries.values())
                {
                    try
                    {
                        entry.Release();
                    }
                    catch (error)
                    {
                        errors.push(error);
                    }
                }

                entries.clear();
                if (errors.length)
                {
                    throw new AggregateError(errors, "Text surface cleanup failed.");
                }
            };

            return {
                Commit: (frame: Surface.Frame): void =>
                {
                    if (!active)
                    {
                        return;
                    }

                    if (!frame.Layout)
                    {
                        for (const entry of entries.values())
                        {
                            entry.Release();
                        }

                        entries.clear();
                        return;
                    }

                    const keep = new Set<string>();
                    for (const item of frame.Layout.Items)
                    {
                        if (!active || item.Hidden || !item.Text)
                        {
                            continue;
                        }

                        const view = frame.Layout.Views.find(
                            (candidate: Layout.View) => candidate.Id === item.ViewId)!;
                        const dimension = configuration.Dimension(view.Dimension);
                        item.Text.Lines.forEach((
                            line: Layout.TextLayout["Lines"][number], index: number
                        ): void =>
                        {
                            const x = item.Content.X + line.X;
                            const y = item.Content.Y + line.Y;
                            if (!active || !Layout.TextLineVisible(item, line))
                            {
                                return;
                            }

                            const key = `${item.Id}:${index}`;
                            keep.add(key);
                            const location = { ...Layout.Project(view,
                                { X: x + Math.floor(line.PaddedWidth / 2) - line.PrefixWidth,
                                    Y: y + 6 }, -item.Layer * view.LayerDepth),
                            dimension };
                            const rotation = Rotation(view);
                            const color = Tint(item.Props.Color as Parameters<typeof Tint>[0]);
                            const signature = JSON.stringify([
                                view.Dimension, location.x, location.y, location.z,
                                rotation, color, view.PixelsPerBlock ]);
                            let entry = entries.get(key);
                            if (entry && entry.Signature !== signature)
                            {
                                entry.Release();
                                entries.delete(key);
                                entry = undefined;
                            }

                            if (!entry)
                            {
                                const primitive = configuration.CreateText(location, line.Encoded);
                                if (!active)
                                {
                                    primitive.remove();
                                    return;
                                }

                                let release: () => void;
                                try
                                {
                                    release = context.Own((): void => primitive.remove());
                                }
                                catch (error)
                                {
                                    primitive.remove();
                                    throw error;
                                }

                                entry = { Primitive: primitive,
                                    Release: release,
                                    Resend: (context.System.currentTick ?? tick) + 5,
                                    Signature: signature,
                                    Value: line.Encoded };
                                entries.set(key, entry);
                                primitive.visibleTo = [ context.Viewer ];
                                primitive.useRotation = true;
                                primitive.rotation = rotation;
                                primitive.scale = 1 / (view.PixelsPerBlock * BlocksPerLargePixel);
                                primitive.color = color;
                                primitive.backgroundColorOverride = { alpha: 0,
                                    blue: 0,
                                    green: 0,
                                    red: 0 };
                                primitive.depthTest = true;
                                primitive.backfaceVisible = false;
                                primitive.textBackfaceVisible = false;
                                if (active)
                                {
                                    configuration.AddText(primitive, dimension);
                                }
                            }
                            else if (entry.Value !== line.Encoded)
                            {
                                entry.Primitive.setText(line.Encoded);
                                entry.Value = line.Encoded;
                                entry.Resend = Infinity;
                            }
                        });
                    }

                    for (const [ key, entry ] of entries)
                    {
                        if (!keep.has(key))
                        {
                            entry.Release();
                            entries.delete(key);
                        }
                    }
                },
                Dispose: dispose,
                Update: (): void =>
                {
                    if (!active)
                    {
                        return;
                    }

                    tick++;
                    for (const entry of entries.values())
                    {
                        if ((context.System.currentTick ?? tick) >= entry.Resend)
                        {
                            entry.Primitive.setText(entry.Value);
                            entry.Resend = Infinity;
                        }
                    }
                }
            };
        }
    };
}
