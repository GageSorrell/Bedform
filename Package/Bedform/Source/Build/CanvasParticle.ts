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

import { LifetimeTicks, OrientedSuffix, ParticleVariable } from "../Canvas/Surface.js";

/**
 * Serializes one particle definition. Oriented variants face the Direction variable and roll about
 * it; camera-facing variants roll in screen space. Particles last LifetimeTicks (two ticks).
 *
 * @category Serialization
 * @since 1.0.0
 */
export function ParticleDefinition(identifier: string, texture: string, textureSize: number,
    oriented: boolean, textureHeight: number = textureSize): string
{
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
                basic_render_parameters: { material: "particles_blend",
                    texture },
                identifier: identifier + (oriented ? OrientedSuffix : "")
            }
        } }, null, 2) + "\n";
}
