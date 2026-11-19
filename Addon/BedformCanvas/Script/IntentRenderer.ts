/**
 * Private per-viewer Intent panels, elapsed-time image particles and measured billboard PUA text.
 * Imports are inert; Start explicitly owns a refresh ticker and only its own primitive handles.
 *
 * @module bedform-canvas/Script/IntentRenderer
 *
 * @file      IntentRenderer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Surface from "bedform/Canvas/Surface";
import type { DimensionLocation, MolangVariableMap, Player, System, TextPrimitive, World }
    from "@minecraft/server";
import { FrameAt, type ImageDescriptor } from "bedform/Canvas/Image";
import { BuiltinImages } from "../Public/IntentArt.generated.js";
import { GlyphWidth } from "bedform/Spatial/Measurement";
import { Lookup } from "../Public/Glyph.js";
import type { State } from "./IntentTypes.js";

/**
 * Logical panel geometry at default scale, text calibration and resource limits per renderer tick.
 * TextPrimitive's blocks-per-large-pixel estimate remains subject to real-client calibration.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Defaults = Object.freeze({ Depth: 0.005,
    Height: 24,
    MaxSpawns: 2_048,
    MaxTexts: 256,
    Padding: 4,
    PixelSize: 1 / 32,
    Pointer: 4,
    TextPixelSize: 0.025,
    Width: 32 } as const);

/**
 * Explicit native adapters and state provider. Limits apply across all subjects/viewers per tick.
 * CreateText must return an unregistered primitive so privacy can be configured before addText.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface Configuration
{
    readonly World: World;
    readonly System: Pick<System, "runInterval" | "clearRun">;
    readonly Snapshot: () => ReadonlyArray<State>;
    readonly CreateText: (location: DimensionLocation, text: string) => TextPrimitive;
    readonly CreateVariables: () => MolangVariableMap;
    readonly MaxSpawns?: number;
    readonly MaxTexts?: number;
    readonly OnError?: (error: Error) => void;
}

/**
 * A single rendering lifetime. Dispose retires all owned text and stops particle refresh. If native
 * removal fails the ticker retries cleanup without further drawing; it never empties visibleTo.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export interface Handle
{
    readonly Dispose: () => void;
}

/**
 * One measured bubble layout relative to its pointer tip; logical X grows right and Y grows down.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Layout
{
    readonly Width: number;
    readonly Height: number;
    readonly CenterY: number;
    readonly TextScale: number;
    readonly Content: ReadonlyArray<Surface.Placed>;
}

/**
 * Measures Canvas PUA advances before native fallback; consumer metrics take precedence. Builds a
 * beveled gray panel with lower shadow and pixel pointer. Images retain aspect ratio; frames derive
 * from elapsed Intent ticks so particle refresh never restarts an animation.
 *
 * @throws { Error } If a built-in image descriptor is missing.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function LayoutOf(state: State): Layout
{
    let width: number = Defaults.Width;
    let height: number = Defaults.Height;
    const nodes: Array<Surface.Node> = [];
    const intent = state.Intent;
    let image: ImageDescriptor | undefined;
    if (intent.Kind === "glyphs")
    {
        const measured = [ ...intent.Text ].reduce((sum: number, character: string, index: number) =>
            sum + (intent.Metrics?.Advances?.[index] ?? Lookup(character.codePointAt(0)!)?.Advance ??
                GlyphWidth(character.codePointAt(0)!, "Mojangles")), 0);
        width = Math.max(width, measured + Defaults.Padding * 2);
        height = Math.max(height, (intent.Metrics?.Height ?? 16) + Defaults.Padding * 2);
    }
    else
    {
        image = intent.Kind === "builtin" ? BuiltinImages[intent.Name] : intent;
        if (!image)
        {
            throw new Error("Intent built-in artwork is missing; regenerate Canvas Intent assets.");
        }
    }

    const top = -Defaults.Pointer - height;
    const centerY = top + height / 2;
    const fill = (x: number, y: number, w: number, h: number, tint: string, layer: number = 0): void =>
    {
        nodes.push(Surface.Fill({ Height: h,
            Width: w,
            X: x,
            Y: y }, tint, { Layer: layer }));
    };

    fill(-width / 2 + 1, top + 2, width, height, "#333333", -1);
    fill(-width / 2, top, width, height, "#555555");
    fill(-width / 2 + 1, top + 1, width - 2, height - 2, "#C6C6C6", 1);
    fill(-width / 2 + 1, top + 1, width - 2, 1, "#FFFFFF", 2);
    fill(-width / 2 + 1, top + 2, 1, height - 3, "#FFFFFF", 2);
    fill(-width / 2 + 2, top + height - 2, width - 3, 1, "#777777", 2);
    fill(width / 2 - 2, top + 2, 1, height - 3, "#777777", 2);
    for (let row = 0; row < Defaults.Pointer; row++)
    {
        const half = Defaults.Pointer - row;
        fill(-half, -Defaults.Pointer + row, half * 2, 1, "#555555");
        if (half > 1)
        {
            fill(-half + 1, -Defaults.Pointer + row, half * 2 - 2, 1, "#C6C6C6", 1);
        }
    }

    if (image)
    {
        const factor = Math.min((width - Defaults.Padding * 2) / image.Width,
            (height - Defaults.Padding * 2) / image.Height);
        const frame = FrameAt(image, state.ElapsedTicks);
        nodes.push({ Bounds: { Height: image.Height * factor,
            Width: image.Width * factor,
            X: -image.Width * factor / 2,
            Y: centerY - image.Height * factor / 2 },
        Kind: "sprite",
        Layer: 3,
        Particle: image.Particle,
        Tint: "#FFFFFF",
        UV: { Height: image.Height,
            Width: image.Width,
            X: 0,
            Y: frame.V } });
    }

    return Object.freeze({ CenterY: centerY,
        Content: Object.freeze(nodes.flatMap((node: Surface.Node) => Surface.Flatten(node))),
        Height: height,
        TextScale: Defaults.PixelSize * state.Options.Scale / Defaults.TextPixelSize,
        Width: width });
}

/**
 * Native text retained for one subject generation and one viewer; stale handles are removed before
 * replacements can register. Failed removals remain owned and are retried on subsequent ticks.
 *
 * @category Model
 * @since 1.0.0
 */
interface TextEntry
{
    readonly Text: TextPrimitive;
    readonly Generation: number;
    readonly Dimension: string;
    Retiring: boolean;
}

/**
 * Starts the renderer. Native errors are isolated per subject/viewer, deduplicated while active and
 * retried next tick. Capacity rejection skips an entire viewer frame, avoiding partially drawn panels.
 *
 * @throws { TypeError } If adapters or limits are invalid.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export function Start(configuration: Configuration): Handle
{
    const maxSpawns = configuration.MaxSpawns ?? Defaults.MaxSpawns;
    const maxTexts = configuration.MaxTexts ?? Defaults.MaxTexts;
    if (![ maxSpawns, maxTexts ].every((limit: number) => Number.isSafeInteger(limit) && limit >= 0) ||
        typeof configuration.CreateText !== "function" ||
        typeof configuration.CreateVariables !== "function" ||
        typeof configuration.Snapshot !== "function" ||
        typeof configuration.System?.runInterval !== "function" ||
        typeof configuration.System.clearRun !== "function" ||
        typeof configuration.World?.getAllPlayers !== "function")
    {
        throw new TypeError("Intent rendering requires native adapters and nonnegative integer limits.");
    }

    const texts = new Map<string, TextEntry>();
    let closed = false;
    let drawing = false;
    let previousErrors = new Set<string>();
    let currentErrors = new Set<string>();
    const report = (key: string, error: unknown): void =>
    {
        if (currentErrors.has(key))
        {
            return;
        }

        currentErrors.add(key);
        if (!previousErrors.has(key))
        {
            try
            {
                const detail = error instanceof Error ? error.message : String(error);
                configuration.OnError?.(new Error(`Canvas Intent ${key}: ${detail}`, { cause: error }));
            }
            catch
            {
                // Diagnostics cannot interrupt drawing or cleanup.
            }
        }
    };

    const remove = (key: string): boolean =>
    {
        const entry = texts.get(key);
        if (!entry)
        {
            return true;
        }

        entry.Retiring = true;
        try
        {
            entry.Text.remove();
            texts.delete(key);
            return true;
        }
        catch (error)
        {
            report(`cleanup ${key}`, error);
            return false;
        }
    };

    const tick = (): void =>
    {
        if (drawing)
        {
            return;
        }

        drawing = true;
        currentErrors = new Set();
        const keep = new Set<string>();
        let spawns = 0;
        try
        {
            const states = closed ? [] : configuration.Snapshot();
            const viewers = closed ? [] : configuration.World.getAllPlayers();
            // Retire stale generations/audiences before allocating this tick's native shapes.
            for (const [ key, entry ] of texts)
            {
                const active = states.some((state: State) => state.Subject &&
                    state.Generation === entry.Generation && state.Intent.Kind === "glyphs" &&
                    state.Subject.Dimension.id === entry.Dimension && viewers.some((viewer: Player) =>
                    key === JSON.stringify([ state.EntityId, viewer.id ])));
                if (!active || entry.Retiring)
                {
                    remove(key);
                }
            }

            for (const state of states)
            {
                if (closed)
                {
                    break;
                }

                try
                {
                    const subject = state.Subject;
                    if (!subject)
                    {
                        continue;
                    }

                    const layout = LayoutOf(state);
                    const tip = { x: subject.Head.x + state.Options.Offset.x,
                        y: subject.Head.y + state.Options.Offset.y,
                        z: subject.Head.z + state.Options.Offset.z };
                    const scale = Defaults.PixelSize * state.Options.Scale;
                    for (const viewer of viewers)
                    {
                        if (closed)
                        {
                            break;
                        }

                        const key = JSON.stringify([ state.EntityId, viewer.id ]);
                        try
                        {
                            if (viewer.id === state.EntityId || !viewer.isValid ||
                                viewer.dimension.id !== subject.Dimension.id)
                            {
                                continue;
                            }

                            const eye = viewer.getHeadLocation();
                            if (Math.hypot(eye.x - subject.Head.x, eye.y - subject.Head.y,
                                eye.z - subject.Head.z) > state.Options.MaxDistance)
                            {
                                continue;
                            }

                            // Match native rotate_xyz billboarding: the plane normal is camera -forward.
                            const look = viewer.getViewDirection();
                            const basis = Surface.FacingBasis({ x: look.x,
                                y: look.y,
                                z: look.z }, { x: 0,
                                y: 0,
                                z: 0 });
                            if (!basis)
                            {
                                throw new Error("Viewer camera direction is degenerate.");
                            }

                            if (spawns + layout.Content.length > maxSpawns)
                            {
                                throw new RangeError("Intent particle capacity reached.");
                            }

                            const quads = Surface.Project(layout.Content, { LayerDepth: Defaults.Depth,
                                Orientation: { Right: basis.Right,
                                    Up: basis.Up },
                                Position: tip,
                                Scale: scale }, basis);
                            if (state.Intent.Kind === "glyphs")
                            {
                                let entry = texts.get(key);
                                if (entry?.Retiring)
                                {
                                    continue;
                                }

                                const center = -layout.CenterY * scale;
                                const location = { dimension: subject.Dimension,
                                    x: tip.x + basis.Up.x * center + basis.Normal.x * Defaults.Depth * 4,
                                    y: tip.y + basis.Up.y * center + basis.Normal.y * Defaults.Depth * 4,
                                    z: tip.z + basis.Up.z * center + basis.Normal.z * Defaults.Depth * 4 };
                                if (!entry)
                                {
                                    if (texts.size >= maxTexts)
                                    {
                                        throw new RangeError("Intent text capacity reached.");
                                    }

                                    const text = configuration.CreateText(location, state.Intent.Text);
                                    entry = { Dimension: subject.Dimension.id,
                                        Generation: state.Generation,
                                        Retiring: false,
                                        Text: text };
                                    texts.set(key, entry);
                                    // Never register until the private audience and depth are configured.
                                    text.visibleTo = [ viewer ];
                                    text.useRotation = false;
                                    text.backgroundColorOverride = { alpha: 0,
                                        blue: 0,
                                        green: 0,
                                        red: 0 };
                                    text.color = Surface.DefaultTint;
                                    text.depthTest = true;
                                    text.backfaceVisible = false;
                                    text.textBackfaceVisible = false;
                                    text.scale = layout.TextScale;
                                    configuration.World.primitiveShapesManager.addText(text,
                                        subject.Dimension);
                                }
                                else
                                {
                                    entry.Text.setLocation(location);
                                }

                                keep.add(key);
                            }

                            const variables = configuration.CreateVariables();
                            for (const quad of quads)
                            {
                                for (const [ name, value ] of Object.entries(quad.Floats))
                                {
                                    variables.setFloat(name, value);
                                }

                                variables.setColorRGBA(Surface.ParticleVariable.Color, quad.Color);
                                // Camera-facing variant keeps text and pixels in the same camera plane.
                                viewer.spawnParticle(quad.Particle.slice(0, -Surface.OrientedSuffix.length),
                                    quad.Location, variables);
                                spawns++;
                            }
                        }
                        catch (error)
                        {
                            keep.delete(key);
                            remove(key);
                            report(`viewer ${key}`, error);
                        }
                    }
                }
                catch (error)
                {
                    report(`subject ${state.EntityId}`, error);
                }
            }
        }
        catch (error)
        {
            report("state or audience unavailable", error);
        }

        for (const key of texts.keys())
        {
            if (closed || !keep.has(key))
            {
                remove(key);
            }
        }

        if (closed && texts.size === 0)
        {
            try
            {
                configuration.System.clearRun(run);
            }
            catch (error)
            {
                report("stop refresh", error);
            }
        }

        previousErrors = currentErrors;
        drawing = false;
    };

    const run = configuration.System.runInterval(tick, 1);
    return Object.freeze({ Dispose: (): void =>
    {
        if (!closed || texts.size > 0)
        {
            closed = true;
            tick();
        }
    } });
}
