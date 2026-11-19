/**
 * Shared generated image descriptors consumed by Canvas features without runtime asset loading.
 *
 * @module bedform/Canvas/Image
 *
 * @file      Image.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * A compiler-produced static image or vertical flipbook. Width and Height describe one frame in
 * pixels; FrameTicks advances animation from elapsed feature ticks, never from particle refreshes.
 * Particle is the namespaced consumer effect; Id identifies the registered image across features.
 * This contract is shared by Intent and future Canvas.Images/React consumers.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ImageDescriptor
{
    readonly Kind: "image";
    readonly Version: 1;
    readonly Id: string;
    readonly Particle: string;
    readonly Width: number;
    readonly Height: number;
    readonly FrameCount: number;
    readonly FrameTicks: number;
}

/**
 * One frame's texel rectangle in a vertical strip. Width and Height retain the source aspect ratio.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Frame
{
    readonly Index: number;
    readonly U: number;
    readonly V: number;
    readonly Width: number;
    readonly Height: number;
}

/**
 * Selects UVs from elapsed feature ticks, independently of particle refresh, with no runtime fetching.
 *
 * @throws { RangeError } If elapsed time or frame geometry/timing is invalid.
 *
 * @category Getter
 * @since 1.0.0
 */
export function FrameAt(image: ImageDescriptor, elapsedTicks: number): Frame
{
    if (!Number.isFinite(elapsedTicks) || elapsedTicks < 0 ||
        ![ image.Width, image.Height, image.FrameCount, image.FrameTicks ]
            .every((value: number) => Number.isSafeInteger(value) && value > 0))
    {
        throw new RangeError("Canvas image frames need positive integer geometry/timing " +
            "and finite elapsed ticks.");
    }

    const index = Math.floor(elapsedTicks / image.FrameTicks) % image.FrameCount;
    return Object.freeze({ Height: image.Height,
        Index: index,
        U: 0,
        V: index * image.Height,
        Width: image.Width });
}
