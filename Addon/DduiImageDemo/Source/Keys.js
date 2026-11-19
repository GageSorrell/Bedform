/**
 * Identifiers the demo's scripts own, shared by the behavior pack and the
 * host-side tools.
 *
 * @module @sorrell/ddui-image-demo/Source/Keys
 *
 * @file      Keys.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Script-event identifiers, sent with `/scriptevent` from the server console.
 *
 * @category Constant
 * @since 1.1.37
 */
export const ScriptEvent = Object.freeze({
    GlyphProbe: "ddui_demo:glyph_probe"
});

/**
 * Custom dimensions the scripts register at startup.
 *
 * @category Constant
 * @since 1.1.72
 */
export const CustomDimension = Object.freeze({
    Flat: "ddui_demo:flat"
});

/**
 * Ticking areas the scripts create.
 *
 * @category Constant
 * @since 1.1.72
 */
export const TickingArea = Object.freeze({
    FlatSpawn: "ddui_demo:flat_spawn"
});

/**
 * Custom slash commands the scripts register at startup.
 *
 * @category Constant
 * @since 1.1.72
 */
export const Command = Object.freeze({
    Flat: "ddui_demo:flat",
    Gallery: "ddui_demo:gallery"
});
