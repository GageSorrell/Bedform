/**
 * The context key under which fibers find runtime metrics, shared by the fiber
 * runtime and the public `Metric` module. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/metric
 *
 * @file      metric.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/**
 * Upstream helper from the pinned Effect implementation.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const FiberRuntimeMetricsKey = "effect/Metric/FiberRuntimeMetrics";
