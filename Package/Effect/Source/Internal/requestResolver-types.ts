/**
 * Private RequestResolver type contracts extracted from Effect 4.0.5 RequestResolver.
 * The public module is not ported.
 *
 * @module @bedform/effect/Internal/requestResolver-types
 *
 * @file      requestResolver-types.ts
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

import type { NonEmptyArray } from "../Array.js";
import type * as Effect from "../Effect.js";
import type * as effect from "./effect.js";
import type { Pipeable } from "../Pipeable.js";
import type * as Request from "../Request.js";
import type * as Types from "../Types.js";

declare const TypeId: "~effect/RequestResolver";

/**
 * A resolver that executes and completes batched `Request` entries.
 *
 * **Details**
 *
 * A resolver controls how requests are grouped, delayed, optionally
 * pre-checked, and finally run. Its `runAll` method receives a non-empty batch
 * of `Request.Entry` values for a single batch key and must complete every
 * received entry, usually by calling `completeUnsafe` or one of the `Request`
 * completion helpers.
 *
 * **Gotchas**
 *
 * If a resolver finishes without completing an entry, the waiting request fails
 * because the resolver did not supply a result.
 *
 * **Example** (Defining a request resolver)
 *
 * ```ts import.meta.vitest
 * import { Effect, Exit, Request, RequestResolver } from "effect"
 *
 * interface GetUserRequest extends Request.Request<string, Error> {
 *   readonly _tag: "GetUserRequest"
 *   readonly id: number
 * }
 * const GetUserRequest = Request.tagged<GetUserRequest>("GetUserRequest")
 *
 * // In practice, you would typically use RequestResolver.make() instead
 * const resolver = RequestResolver.make<GetUserRequest>((entries) =>
 *   Effect.sync(() => {
 *     for (const entry of entries) {
 *       entry.completeUnsafe(Exit.succeed(`User ${entry.request.id}`))
 *     }
 *   })
 * )
 *
 * const program = Effect.request(GetUserRequest({ id: 1 }), resolver)
 * await Effect.runPromise(program) // => "User 1"
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export interface RequestResolver<in A extends Request.Any> extends RequestResolver.Variance<A>, Pipeable {
    readonly delay: Effect.Effect<void>

    /**
     * Get a batch key for the given request.
     *
     * @category Utilities
     * @since 1.0.0
     */
    batchKey(entry: Request.Entry<A>): unknown

    /**
     * An optional pre-check function that can be used to filter requests before
     * they are added to a batch. If the function returns `false`, the request
     * will not be processed.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly preCheck: ((entry: Request.Entry<A>) => boolean) | undefined

    /**
     * Should the resolver continue collecting requests? Otherwise, it will
     * immediately execute the collected requests cutting the delay short.
     *
     * @category Utilities
     * @since 1.0.0
     */
    collectWhile(entries: ReadonlySet<Request.Entry<A>>): boolean

    /**
     * Execute a collection of requests.
     *
     * @category Utilities
     * @since 1.0.0
     */
    runAll(entries: NonEmptyArray<Request.Entry<A>>, key: unknown): Effect.Effect<void, Request.Error<A>>
}

/**
 * Namespace containing type-level helpers associated with `RequestResolver`.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace RequestResolver
{
    export namespace Variance
    {
        /**
         * Contravariant request marker for the `RequestResolver` protocol.
         *
         * @category models
         * @since 1.0.0
         */
        export interface TypeId<in A> {
            readonly _A: Types.Contravariant<A>
        }
    }

    /**
     * Variance marker carried by every `RequestResolver`.
     *
     * **Details**
     *
     * This marker preserves the request type accepted by the resolver for
     * Effect's type-level machinery. Users normally do not implement it directly.
     *
     * @category models
     * @since 1.0.0
     */
    export interface Variance<in A> {
        readonly [TypeId]: Variance.TypeId<A>
    }
}
