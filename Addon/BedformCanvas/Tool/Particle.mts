/**
 * Canvas surface particle definitions shared by every generator: one camera-facing and one oriented
 * variant per texture, reading size, UV, roll, tint and direction from the public Molang variables
 * of bedform/Canvas/Surface, plus the plain tintable rectangle particle and its white texture.
 *
 * @module bedform-canvas/Tool/Particle
 *
 * @file      Particle.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ParticleDefinition, ParticleVariants }
    from "../../../Package/Bedform/Source/Build/CanvasParticle.js";
import { Rectangle } from "bedform/Canvas/Surface";

/**
 * Generated surface base outputs, relative to the workspace root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const SurfaceOutput = Object.freeze({
    Particles: "resource_packs/bedform_canvas/particles",
    Texture: "resource_packs/bedform_canvas/textures/bedform_canvas/surface/rectangle.png"
} as const);

/**
 * Shared image, glyph and surface particle serializer, including rectangular vertical strips, and the
 * particle variants (camera-facing, oriented and oriented depth-writing) every generator emits.
 *
 * @category Serialization
 * @since 1.0.0
 */
export { ParticleDefinition, ParticleVariants }
    from "../../../Package/Bedform/Source/Build/CanvasParticle.js";

/**
 * The plain rectangle particle variants and its opaque white texture as raw RGBA.
 *
 * @category Tool
 * @since 1.0.0
 */
export function SurfaceOutputs(): { Images: Map<string, Uint8Array>;
    Texts: Map<string, string> }
{
    const size = Rectangle.TextureSize;
    const name = Rectangle.Particle.split(":")[1];
    const texts = new Map<string, string>();
    for (const variant of ParticleVariants)
    {
        texts.set(`${SurfaceOutput.Particles}/${name}${variant.Suffix}.json`,
            ParticleDefinition(Rectangle.Particle, "textures/bedform_canvas/surface/rectangle", size,
                variant.Oriented, size, variant.Depth));
    }

    return { Images: new Map([ [ SurfaceOutput.Texture, new Uint8Array(size * size * 4).fill(0xFF) ] ]),
        Texts: texts };
}
