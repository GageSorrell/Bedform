/**
 * Identifiers owned by the look-input demonstration.
 *
 * @module @sorrell/look-input-demo/Script/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Saved recovery markers for interrupted camera sessions.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({ Active: "look_demo:active" } as const);

/**
 * Toggle item supplied by the behavior pack.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ToggleItem = "look_demo:toggle" as const;

/**
 * Persistent ticking-area names used by the demonstration scene.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TickingArea = Object.freeze({ Scene: "look_demo_scene" } as const);
