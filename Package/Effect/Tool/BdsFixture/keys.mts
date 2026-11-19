/**
 * Keys owned by the @bedform/effect BDS runtime fixture and its runner.
 *
 * @module @bedform/effect/Tool/BdsFixture/keys
 *
 * @file      keys.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/**
 * Marker prefixes the fixture writes to the server console for the runner.
 *
 * @category Tests
 * @since 1.0.0
 */
export const Marker = Object.freeze({
    Command: "EFFECT_BEDROCK_COMMAND",
    Done: "EFFECT_BEDROCK_DONE",
    Ready: "EFFECT_BEDROCK_READY",
    Result: "EFFECT_BEDROCK_RESULT",
    Shutdown: "EFFECT_BEDROCK_SHUTDOWN_FINALIZED"
} as const);

/**
 * Script-event identifiers owned by the fixture.
 *
 * @category Tests
 * @since 1.0.0
 */
export const ScriptEvent = Object.freeze({
    Run: "effect_bedrock:run"
} as const);

/**
 * Dynamic-property identifiers owned by the fixture.
 *
 * @category Tests
 * @since 1.0.0
 */
export const DynamicProperty = Object.freeze({
    Probe: "effect_bedrock:probe"
} as const);
