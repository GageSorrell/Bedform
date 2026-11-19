/**
 * Script-owned identifiers of the World input demonstration.
 *
 * @module @sorrell/world-input-demo/Script/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Script events a tester sends with `/scriptevent` to adjust the demonstration.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ScriptEvent = Object.freeze({ Chat: "world_input:chat" } as const);

/**
 * Persistent ticking-area names used by the demonstration scene.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TickingArea = Object.freeze({ Scene: "world_input_scene" } as const);

/**
 * Console line the demonstration launcher waits for after the scene is prepared.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ReadyMarker = "WORLD_INPUT_DEMO_READY" as const;

/**
 * Prefix of every console evidence line, so a session log can be filtered for input events.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LogPrefix = "WORLD_INPUT" as const;
