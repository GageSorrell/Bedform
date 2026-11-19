/**
 * Captures and cleans the stack traces recorded for spans and errors, within a
 * bounded stack-trace limit. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/tracer
 *
 * @file      tracer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable @stylistic/max-len */

/* Preserve upstream statement layout, type-level inference names and signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as Tracer from "../Tracer.js";
import { getStackTraceLimit, setStackTraceLimit } from "./stackTraceLimit.js";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface ErrorWithStackTraceLimit {
    stackTraceLimit?: number | undefined
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const addSpanStackTrace = <A extends Tracer.TraceOptions>(
    options: A | undefined
): A =>
{
    if (options?.captureStackTrace === false)
    {
        return options;
    }
    else if (options?.captureStackTrace !== undefined && typeof options.captureStackTrace !== "boolean")
    {
        return options;
    }

    const limit = getStackTraceLimit();
    if (limit === 0 && options?.captureStackTrace !== true)
    {
        return { ...options,
            captureStackTrace: false } as A;
    }

    setStackTraceLimit(3);
    const traceError = new Error();
    setStackTraceLimit(limit);
    return {
        ...options,
        captureStackTrace: spanCleaner(() => traceError.stack)
    } as A;
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeStackCleaner = (line: number) => (stack: () => string | undefined): () => string | undefined =>
{
    let cache: string | undefined;
    return () =>
    {
        if (cache !== undefined) {return cache;}

        const trace = stack();
        if (!trace) {return undefined;}

        const lines = trace.split("\n");
        if (lines[line] !== undefined)
        {
            cache = lines[line].trim();
            return cache;
        }
    };
};

const spanCleaner = makeStackCleaner(3);
