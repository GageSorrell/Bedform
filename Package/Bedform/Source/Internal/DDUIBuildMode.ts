/**
 * Pure compile-time DDUI mode shared by future renderer and JSX runtimes.
 *
 * @module bedform/Internal/DDUIBuildMode
 *
 * @file      DDUIBuildMode.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Exported constants are documented at their declarations. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/**
 * Replaced with a boolean literal by the host build; absent in unbundled runtimes.
 *
 * @category DDUI
 * @since 1.0.0
 */
declare const BedformDDUIStrict: boolean;

/**
 * Effective DDUI diagnostic mode, defaulting to false without host substitution.
 * No configuration, environment, Node API, or runtime side effect is required.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const StrictMode = typeof BedformDDUIStrict === "boolean" ? BedformDDUIStrict : false;
