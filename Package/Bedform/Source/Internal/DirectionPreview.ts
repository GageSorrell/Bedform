/**
 * Shared native direction-preview asset names and signed-axis ordering.
 *
 * @module bedform/Internal/DirectionPreview
 *
 * @file      DirectionPreview.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CommonResourcePack } from "./CommonResourcePack.js";

/**
 * Resource pack containing native DDUI direction artwork.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DirectionResourcePack = CommonResourcePack;

/**
 * Signed axes in the native direction dropdown's stable numeric order.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DirectionAxes = Object.freeze([ "+Y", "-Y", "-Z", "+Z", "+X", "-X" ] as const);

/**
 * Resolves an asset path, sharing identical unrestricted variants across masks.
 * Selection -1 represents an empty or excluded observable value.
 *
 * @category Getter
 * @since 1.0.0
 */
export const DirectionPreviewPath = (
    selected: number,
    mask: number,
    labels: "xyz" | "localized" | undefined,
    excluded: boolean | "dim"
): string =>
{
    const style = excluded === true || mask === 63 ? "show" : excluded === false ? "hide" : "dim";
    const name = `${style}_${style === "show" ? 63 : mask}_${selected + 1}.png`;
    return `textures/bedform/direction/${labels ?? "none"}/${name}`;
};
