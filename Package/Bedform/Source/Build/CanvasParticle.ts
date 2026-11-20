/**
 * Shared Canvas particle serialization for custom glyphs, surfaces and consumer image strips.
 *
 * @module bedform/Build/CanvasParticle
 *
 * @file      CanvasParticle.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DepthSuffix, LifetimeTicks, OrientedSuffix, ParticleVariable } from "../Canvas/Surface.js";

/**
 * One generated particle variant: whether it faces the Direction variable, whether it writes depth,
 * and the suffix its file and identifier add to the base particle identifier.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ParticleVariant {
    readonly Oriented: boolean;
    readonly Depth: boolean;
    readonly Suffix: string;
}

/**
 * The variants generated for every Canvas particle: camera-facing, oriented (blended, no depth
 * writes), and oriented depth-writing (alpha-tested particles_alpha) for layered surfaces.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ParticleVariants: ReadonlyArray<ParticleVariant> = Object.freeze([
    Object.freeze({ Depth: false,
        Oriented: false,
        Suffix: "" }),
    Object.freeze({ Depth: false,
        Oriented: true,
        Suffix: OrientedSuffix }),
    Object.freeze({ Depth: true,
        Oriented: true,
        Suffix: OrientedSuffix + DepthSuffix })
]);

/**
 * Serializes one particle definition. Oriented variants face the Direction variable and roll about
 * it; camera-facing variants roll in screen space. Particles last LifetimeTicks (two ticks). The
 * default particles_blend material blends but never writes depth, so overlapping particles draw in
 * client order regardless of their depth offsets. Depth variants of oriented particles use
 * particles_alpha instead: alpha-tested (no partial translucency), depth-writing and, unlike
 * particles_blend, not explicitly double-sided.
 *
 * @throws { TypeError } If a depth variant is requested for a camera-facing particle.
 *
 * @category Serialization
 * @since 1.0.0
 */
export function ParticleDefinition(identifier: string, texture: string, textureSize: number,
    oriented: boolean, textureHeight: number = textureSize, depth: boolean = false): string
{
    if (depth && !oriented)
    {
        throw new TypeError("Only oriented Canvas particles have depth-writing variants.");
    }

    const billboard: Record<string, unknown> = {
        facing_camera_mode: oriented ? "direction_z" : "rotate_xyz",
        ...oriented ? { direction: { custom_direction: [ "x", "y", "z" ].map((axis: string) =>
            `${ParticleVariable.Direction}.${axis}`),
        mode: "custom" } } : {},
        size: [ ParticleVariable.SizeX, ParticleVariable.SizeY ],
        uv: { texture_height: textureHeight,
            texture_width: textureSize,
            uv: [ ParticleVariable.U, ParticleVariable.V ],
            uv_size: [ ParticleVariable.Width, ParticleVariable.Height ] }
    };
    return JSON.stringify({ format_version: "1.10.0",
        particle_effect: {
            components: {
                "minecraft:emitter_lifetime_once": { active_time: 0.05 },
                "minecraft:emitter_rate_instant": { num_particles: 1 },
                "minecraft:emitter_shape_point": { offset: [ 0, 0, 0 ] },
                "minecraft:particle_appearance_billboard": billboard,
                "minecraft:particle_appearance_tinting": { color: [ "r", "g", "b", "a" ].map(
                    (channel: string) =>
                        `${ParticleVariable.Color}.${channel}`) },
                "minecraft:particle_initial_speed": 0,
                "minecraft:particle_lifetime_expression": { max_lifetime: LifetimeTicks / 20 },
                "minecraft:particle_motion_parametric": { relative_position: [ 0, 0, 0 ],
                    rotation: ParticleVariable.Roll }
            },
            description: {
                basic_render_parameters: { material: depth ? "particles_alpha" : "particles_blend",
                    texture },
                identifier: identifier + (oriented ? OrientedSuffix : "") + (depth ? DepthSuffix : "")
            }
        } }, null, 2) + "\n";
}
