/**
 * Script-owned identifiers used only by isolated engine fixtures.
 *
 * @module bedform/Test/Engine/keys
 *
 * @file      keys.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/**
 * Restart phase and expected authoritative state for the same disposable world.
 *
 * @category Constants
 * @since 1.0.0
 */
export const TestDynamicProperty = Object.freeze({
    Expected: "bedform_fixture:expected",
    Phase: "bedform_fixture:phase"
} as const);

/**
 * Explicit operator controls for the disposable two-client qualification fixture.
 *
 * @category Constants
 * @since 1.0.0
 */
export const TestScriptEvent = Object.freeze({ Capture: "bedform_fixture:capture",
    Scenario: "bedform_fixture:scenario" } as const);

/**
 * Explicit fixture-only chunk loading; PhysicsRuntime never creates ticking areas.
 *
 * @category Constants
 * @since 1.0.0
 */
export const TickingArea = Object.freeze({ Benchmark: "bedform_benchmark_fixture",
    Fixture: "bedform_fixture",
    Remote: "bedform_remote_fixture" } as const);
