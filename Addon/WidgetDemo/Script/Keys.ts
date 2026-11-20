/**
 * Script-owned identifiers of the spatial widget demonstration.
 *
 * @module @sorrell/widget-demo/Script/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Script events a player can send from chat.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ScriptEvent = Object.freeze({
    Depth: "widget_demo:depth",
    TextFlip: "widget_demo:text_flip"
} as const);

/**
 * Demonstration items. Using either activates the control under the pointer; the key also satisfies
 * the "Needs the key" button's RequiredItem.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Item = Object.freeze({
    Key: "widget_demo:key",
    Wand: "widget_demo:wand"
} as const);

/**
 * World-scoped scene version record; the floor and signs are built once per world.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({ Scene: "widget_demo:scene" } as const);

/**
 * Ticking area keeping the scene loaded while no player is nearby.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TickingArea = "widget_demo" as const;

/**
 * Console markers read by the demonstration launcher and smoke checks.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Marker = Object.freeze({
    Evidence: "WIDGET_DEMO_EVIDENCE",
    Fail: "WIDGET_DEMO_FAIL",
    Ready: "WIDGET_DEMO_READY"
} as const);
