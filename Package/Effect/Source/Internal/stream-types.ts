/**
 * Private Stream type contracts extracted from Effect 4.0.5 Stream.
 * The public Stream module is not ported.
 *
 * @module @bedform/effect/Internal/stream-types
 *
 * @file      stream-types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-imports, @stylistic/max-len */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as Arr from "../Array.js";
import type * as Channel from "./channel-types.js";
import type * as Effect from "../Effect.js";
import type { Pipeable } from "../Pipeable.js";
import type { Covariant } from "../Types.js";
import type * as Unify from "../Unify.js";

/**
 * String literal type used as the unique brand for `Stream` values.
 *
 * @category type IDs
 * @since 1.0.0
 */
export type TypeId = "~effect/Stream";

/**
 * Runtime identifier stored on `Stream` values and used by `isStream` to
 * recognize them.
 *
 * **Details**
 *
 * This marker is part of the runtime representation of `Stream` values. Prefer
 * `isStream` when narrowing unknown values.
 *
 * @see {@link isStream} for the public guard that checks this identifier
 *
 * @category type IDs
 * @since 1.0.0
 */
declare const TypeId: TypeId;

/**
 * A `Stream<A, E, R>` describes a program that can emit many `A` values, fail
 * with `E`, and require `R`.
 *
 * **Details**
 *
 * Streams are pull-based with backpressure and emit chunks to amortize effect
 * evaluation. They support monadic composition and error handling similar to
 * `Effect`, adapted for multiple values.
 *
 * **Example** (Creating and consuming streams)
 *
 * ```ts import.meta.vitest
 * import { Effect, Stream } from "effect"
 *
 * const values = await Effect.runPromise(
 *   Stream.make(1, 2, 3).pipe(
 *     Stream.map((n) => n * 2),
 *     Stream.runCollect
 *   )
 * )
 * values // => [2, 4, 6]
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export interface Stream<out A, out E = never, out R = never> extends Variance<A, E, R>, Pipeable {
    readonly channel: Channel.Channel<Arr.NonEmptyReadonlyArray<A>, E, void, unknown, unknown, unknown, R>
    [Unify.typeSymbol]?: unknown
    [Unify.unifySymbol]?: StreamUnify<this>
    [Unify.ignoreSymbol]?: StreamUnifyIgnore
}

/**
 * Type-level unification hook for Stream within the Effect type system.
 *
 * @category models
 * @since 1.0.0
 */
export interface StreamUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
    Stream?: () => A[Unify.typeSymbol] extends Stream<infer A0, infer E0, infer R0> | infer _ ? Stream<A0, E0, R0> : never
}

/**
 * Type-level marker that excludes Stream from unification.
 *
 * @category models
 * @since 1.0.0
 */
export interface StreamUnifyIgnore {
    Effect?: true
}

/**
 * Type-level variance marker for `Stream`.
 *
 * **Details**
 *
 * The emitted value `A`, error `E`, and service requirement `R` type
 * parameters are covariant.
 *
 * @category models
 * @since 1.0.0
 */
export interface Variance<out A, out E, out R> {
    readonly [TypeId]: VarianceStruct<A, E, R>
}

/**
 * Structural encoding used by `Variance` to record each `Stream` type
 * parameter's variance.
 *
 * **Details**
 *
 * `_A`, `_E`, and `_R` are covariant markers.
 *
 * @category models
 * @since 1.0.0
 */
export interface VarianceStruct<out A, out E, out R> {
    readonly _A: Covariant<A>
    readonly _E: Covariant<E>
    readonly _R: Covariant<R>
}
