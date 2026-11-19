/**
 * Private Logger type contracts extracted from Effect 4.0.5 Logger.
 * The public Logger module is not ported.
 *
 * @module @bedform/effect/Internal/logger-types
 *
 * @file      logger-types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-imports */

/* Preserve upstream statement layout, type-level inference names and signatures. */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as Cause from "../Cause.js";
import type * as Fiber from "../Fiber.js";
import type * as effect from "./effect.js";
import type * as LogLevel from "../LogLevel.js";
import type { Pipeable } from "../Pipeable.js";

declare const TypeId: "~effect/Logger";

/**
 * A logger that transforms a runtime log event into an output value.
 *
 * **Details**
 *
 * The runtime calls `log` with the message, level, cause, fiber, and timestamp
 * for each log event. Use `Logger.layer` to install one or more loggers for an
 * effect.
 *
 * **Example** (Creating custom loggers)
 *
 * ```ts import.meta.vitest
 * import { Effect, Logger } from "effect"
 *
 * const messages: Array<string> = []
 * const stringLogger = Logger.make<unknown, void>((options) => {
 *   messages.push(`[${options.logLevel}] ${options.message}`)
 * })
 *
 * const program = Effect.log("Hello World").pipe(
 *   Effect.provide(Logger.layer([stringLogger]))
 * )
 *
 * Effect.runSync(program)
 * messages // => ["[Info] Hello World"]
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export interface Logger<in Message, out Output> extends Pipeable {
    readonly [TypeId]: typeof TypeId
    log(options: Options<Message>): Output
}

/**
 * Information supplied to a `Logger` for a single log event.
 *
 * **Details**
 *
 * Includes the logged message, log level, cause, current fiber, and timestamp.
 *
 * **Example** (Accessing logger options)
 *
 * ```ts import.meta.vitest
 * import { Effect, Logger } from "effect"
 *
 * const outputs: Array<unknown> = []
 * const detailedLogger = Logger.make((options) => {
 *   outputs.push({
 *     message: options.message,
 *     level: options.logLevel,
 *     hasCause: options.cause.reasons.length > 0
 *   })
 * })
 *
 * const program = Effect.log("Processing request").pipe(
 *   Effect.provide(Logger.layer([detailedLogger]))
 * )
 *
 * Effect.runSync(program)
 * outputs // => [{ message: ["Processing request"], level: "Info", hasCause: false }]
 * ```
 *
 * @category options
 * @since 1.0.0
 */
export interface Options<out Message> {
    readonly message: Message
    readonly logLevel: LogLevel.LogLevel
    readonly cause: Cause.Cause<unknown>
    readonly fiber: Fiber.Fiber<unknown, unknown>
    readonly date: Date
}
