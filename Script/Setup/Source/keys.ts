/**
 * Script-owned environment identifiers for setup handoff and prerequisite input discovery.
 *
 * @module monorepo-setup/keys
 *
 * @file      keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Data-only handoff and prerequisite locations passed to fixed helpers and later build stages.
 *
 * @category Constant
 * @since 1.0.0
 */
export const EnvironmentVariable = Object.freeze({
    AssetInputs: "BEDFORM_SETUP_ASSET_INPUTS",
    NativeSource: "BEDFORM_SETUP_NATIVE_SOURCE",
    Relaunch: "BEDFORM_SETUP_RELAUNCH",
    RuntimeData: "BEDFORM_SETUP_RUNTIME_DATA",
    RuntimeExecutable: "BEDFORM_SETUP_RUNTIME_EXECUTABLE",
    VisualStudio: "BEDFORM_SETUP_VISUAL_STUDIO"
} as const);
