/**
 * Script-owned identifiers for the Diagetic demonstration scene.
 *
 * @module @sorrell/diagetic-demo/Script/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * World-scoped scene version record; the scene is built once per world.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({ Scene: "diagetic_demo:scene" } as const);

/**
 * Entity tags selecting block feedback for a demo control.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Tag = Object.freeze({ Gauge: "diagetic_demo:gauge",
    Lamp: "diagetic_demo:lamp" } as const);

/**
 * Ticking area keeping the scene loaded while no player is nearby.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TickingArea = "diagetic_demo" as const;

/**
 * Console markers read by the demonstration launcher and smoke checks.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Marker = Object.freeze({ Evidence: "DIAGETIC_DEMO_EVIDENCE",
    Fail: "DIAGETIC_DEMO_FAIL",
    Ready: "DIAGETIC_DEMO_READY" } as const);
