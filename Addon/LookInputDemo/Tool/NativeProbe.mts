/**
 * Runs the standalone look regression through the add-on's fixed isolated native runner.
 *
 * @module @sorrell/look-input-demo/Tool/NativeProbe
 *
 * @file      NativeProbe.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

process.argv.push("--look");
await import("./ToggleProbe.mjs");
