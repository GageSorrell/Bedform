/**
 * An imperative BedformCanvas surface, independent of React: widget art at its GUI scale, tinted
 * legacy-computing glyph particles and a clipped marquee that scrolls through a nested viewport.
 *
 * @module @sorrell/widget-demo/Script/Gallery
 *
 * @file      Gallery.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Surface from "../../../Package/Bedform/Source/Canvas/Surface.js";
import { Center, PixelsPerBlock, RowZ, Top } from "./Scene.js";
import { LegacyGlyph, Lookup, ParticlePrefix, PatternGlyph } from "../../BedformCanvas/Public/Glyph.js";
import { NineSlice, Picture } from "./Backend.js";

const Width = 128;
const Height = 112;

/**
 * Rainbow tints applied to the white glyph particle textures.
 *
 * @category Constant
 * @since 1.0.0
 */
const Rainbow = [ "#FF5555", "#FFAA00", "#FFFF55", "#55FF55", "#55FFFF", "#5555FF", "#FF55FF" ] as const;

/**
 * One glyph particle sprite at two layout pixels per glyph texel.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Glyph(code: number, x: number, y: number, tint: Surface.TintInput): Surface.Sprite | undefined
{
    const entry = Lookup(code);
    if (!entry?.Visible)
    {
        return undefined;
    }

    const width = entry.Advance - 1;
    return {
        Bounds: {
            Height: 32,
            Width: width * 2,
            X: x,
            Y: y
        },
        Kind: "sprite",
        Particle: ParticlePrefix + entry.Page.toLowerCase(),
        Tint: tint,
        UV: {
            Height: 16,
            Width: width,
            X: entry.U,
            Y: entry.V
        }
    };
}

/**
 * Glyph codes shown in the gallery: legacy-computing stand-ins and octant patterns.
 *
 * @category Getter
 * @since 1.0.0
 */
function Codes(): Array<number>
{
    const legacy = [ 0x1_FB_00, 0x1_FB_0A, 0x1_FB_14, 0x1_FB_1E, 0x1_FB_28, 0x1_FB_3C, 0x1_FB_45, 0x1_FB_52,
        0x1_FB_6C, 0x1_FB_82 ]
        .map((point: number) => LegacyGlyph(point))
        .filter((code: number | undefined): code is number => code !== undefined);
    return [ ...legacy, ...[ 0x0F, 0x3C, 0x5A, 0x99, 0xC3, 0xF0 ].map((pattern: number) =>
        PatternGlyph("Octant", pattern)) ];
}

/**
 * Builds the gallery content with the marquee scrolled by an offset in pixels.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Content(offset: number): Surface.Node
{
    const codes = Codes();
    const children: Array<Surface.Node> = [
        Surface.Fill({
            Height,
            Width,
            X: 0,
            Y: 0
        }, "#C6C6C6", { Layer: -2 }),
        ...NineSlice("ButtonLightNormal", {
            Height: 20,
            Width: 36,
            X: 6,
            Y: 6
        }, 1, 0),
        ...NineSlice("ButtonLightHover", {
            Height: 20,
            Width: 36,
            X: 46,
            Y: 6
        }, 1, 0),
        ...NineSlice("ButtonLightPressed", {
            Height: 20,
            Width: 36,
            X: 86,
            Y: 6
        }, 1, 0),
        Picture("ToggleOn", {
            Height: 16,
            Width: 30,
            X: 6,
            Y: 32
        }, 0),
        Picture("ToggleOff", {
            Height: 16,
            Width: 30,
            X: 40,
            Y: 32
        }, 0),
        Picture("SlotNormal", {
            Height: 36,
            Width: 36,
            X: 86,
            Y: 30
        }, 0),
        ...[ "HealthFull", "HealthHalf", "HungerFull", "ArmorFull", "AirFull" ].map((art: string,
            index: number) =>
            Picture(art as "HealthFull", {
                Height: 9,
                Width: 9,
                X: 6 + index * 12,
                Y: 54
            }, 0))
    ];
    const strip: Array<Surface.Node> = [];
    let x = 0;
    for (const copy of [ 0, 1 ])
    {
        codes.forEach((code: number, index: number) =>
        {
            const sprite = Glyph(code, x, 0, Rainbow[(index + copy) % Rainbow.length]!);
            if (sprite)
            {
                strip.push(sprite);
                x += sprite.Bounds.Width + 2;
            }
        });
    }

    const period = Math.max(1, x / 2);
    children.push({
        Children: strip,
        Clip: {
            Height: 32,
            Width: 116,
            X: 6,
            Y: 72
        },
        Kind: "viewport",
        Offset: {
            X: -(offset % period),
            Y: 0
        }
    });
    return {
        Children: children,
        Clip: {
            Height,
            Width,
            X: 0,
            Y: 0
        },
        Kind: "viewport"
    };
}

/**
 * The gallery's fixed pose: north-facing, below its React title panel.
 *
 * @category Constant
 * @since 1.0.0
 */
export const GalleryPose: Surface.Pose = Object.freeze({
    Orientation: Object.freeze({
        Right: Object.freeze({
            x: -1,
            y: 0,
            z: 0
        }),
        Up: Object.freeze({
            x: 0,
            y: 1,
            z: 0
        })
    }),
    Position: Object.freeze({
        x: Center.Gallery + Width / PixelsPerBlock / 2,
        y: Top - 1.2,
        z: RowZ
    }),
    Scale: 1 / PixelsPerBlock
});

/**
 * A running gallery: Dispose stops it; SetDepthWrite switches between blended and depth-writing
 * particle variants.
 *
 * @category Interface
 * @since 1.0.0
 */
export interface Gallery {
    readonly Dispose: () => void;
    readonly SetDepthWrite: (depthWrite: boolean) => void;
}

/**
 * Starts the managed gallery surface for an audience and scrolls its marquee every other tick.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Start(options: {
    readonly System: Surface.Scheduler;
    readonly Audience: () => Iterable<Surface.Viewer>;
    readonly CreateVariables: () => Surface.Variables;
    readonly OnError: (error: Error) => void;
}): Gallery
{
    const handle = Surface.Create({
        Audience: options.Audience,
        Content: Content(0),
        CreateVariables: options.CreateVariables,
        Dimension: "minecraft:overworld",
        OnError: options.OnError,
        Pose: GalleryPose,
        System: options.System
    });
    let offset = 0;
    const run = options.System.runInterval(() =>
    {
        offset += 1;
        handle.Update({ Content: Content(offset) });
    }, 2);
    return {
        Dispose: (): void =>
        {
            options.System.clearRun(run);
            handle.Dispose();
        },
        SetDepthWrite: (depthWrite: boolean): void => handle.Update({ Pose: { ...GalleryPose,
            DepthWrite: depthWrite } })
    };
}
