/**
 * Context references that the runtime reads for error reporting, stack frames,
 * tracing and logging, such as the current and minimum log levels and log
 * annotations. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/references
 *
 * @file      references.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Context from "../Context.js";
import type { ErrorReporter } from "../ErrorReporter.js";
import { constTrue, constUndefined } from "../Function.js";
import type { LogLevel, Severity } from "../LogLevel.js";
import type { ReadonlyRecord } from "../Record.js";
import type { StackFrame } from "../References.js";
import type { SpanLink } from "../Tracer.js";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CurrentErrorReporters = Context.Reference<ReadonlySet<ErrorReporter>>(
    "effect/ErrorReporter/CurrentErrorReporters",
    { defaultValue: () => new Set() }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CurrentStackFrame = Context.Reference<StackFrame | undefined>("effect/References/CurrentStackFrame", {
    fiberCached: true,
    defaultValue: constUndefined
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TracerEnabled = Context.Reference<boolean>("effect/References/TracerEnabled", {
    fiberCached: true,
    defaultValue: constTrue
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TracerTimingEnabled = Context.Reference<boolean>("effect/References/TracerTimingEnabled", {
    defaultValue: constTrue
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TracerSpanAnnotations = Context.Reference<ReadonlyRecord<string, unknown>>(
    "effect/References/TracerSpanAnnotations",
    { defaultValue: () => ({}) }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TracerSpanLinks = Context.Reference<ReadonlyArray<SpanLink>>("effect/References/TracerSpanLinks", {
    defaultValue: () => []
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CurrentLogAnnotations = Context.Reference<ReadonlyRecord<string, unknown>>(
    "effect/References/CurrentLogAnnotations",
    { defaultValue: () => ({}) }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CurrentLogLevel: Context.Reference<Severity> = Context.Reference<Severity>(
    "effect/References/CurrentLogLevel",
    { fiberCached: true,
        defaultValue: () => "Info" }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const MinimumLogLevel = Context.Reference<
    LogLevel
>("effect/References/MinimumLogLevel", { fiberCached: true,
    defaultValue: () => "Info" });

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const UnhandledLogLevel: Context.Reference<Severity | undefined> = Context.Reference(
    "effect/References/UnhandledLogLevel",
    { defaultValue: (): Severity | undefined => "Error" }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CurrentLogSpans = Context.Reference<
    ReadonlyArray<[label: string, timestamp: number]>
>("effect/References/CurrentLogSpans", { defaultValue: () => [] });
