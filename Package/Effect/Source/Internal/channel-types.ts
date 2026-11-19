/**
 * Private Channel type contracts extracted from Effect 4.0.5 Channel.
 * The public Channel module is not ported.
 *
 * @module @bedform/effect/Internal/channel-types
 *
 * @file      channel-types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable sort-imports */

/* Preserve upstream statement layout, type-level inference names and signatures. */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as Effect from "../Effect.js";
import type { Pipeable } from "../Pipeable.js";
import type * as Types from "../Types.js";
import type * as Unify from "../Unify.js";

/**
 * String literal type used as the unique brand for `Channel` values.
 *
 * @category type IDs
 * @since 1.0.0
 */
export type TypeId = "~effect/Channel";

/**
 * Runtime identifier stored on `Channel` values and used by `isChannel` to
 * recognize them.
 *
 * @category type IDs
 * @since 1.0.0
 */
declare const TypeId: TypeId;

/**
 * A `Channel` is a nexus of I/O operations, which supports both reading and
 * writing. A channel may read values of type `InElem` and write values of type
 * `OutElem`. When the channel finishes, it yields a value of type `OutDone`. A
 * channel may fail with a value of type `OutErr`.
 *
 * **Details**
 *
 * Channels are the foundation of Streams: both streams and sinks are built on
 * channels. Most users shouldn't have to use channels directly, as streams and
 * sinks are much more convenient and cover all common use cases. However, when
 * adding new stream and sink operators, or doing something highly specialized,
 * it may be useful to use channels directly.
 *
 * Channels compose in a variety of ways:
 *
 *  - **Piping**: One channel can be piped to another channel, assuming the
 *    input type of the second is the same as the output type of the first.
 *  - **Sequencing**: The terminal value of one channel can be used to create
 *    another channel, and both the first channel and the function that makes
 *    the second channel can be composed into a channel.
 *  - **Concatenating**: The output of one channel can be used to create other
 *    channels, which are all concatenated together. The first channel and the
 *    function that makes the other channels can be composed into a channel.
 *
 * **Example** (Typing channels)
 *
 * ```ts import.meta.vitest
 * import { Channel, Effect } from "effect"
 *
 * // A channel that outputs numbers and requires no environment
 * type NumberChannel = Channel.Channel<number>
 *
 * // A channel that outputs strings, can fail with Error, completes with boolean
 * type StringChannel = Channel.Channel<string, Error, boolean>
 *
 * // A channel with all type parameters specified
 * type FullChannel = Channel.Channel<
 *   string, // OutElem - output elements
 *   Error, // OutErr - output errors
 *   number, // OutDone - completion value
 *   number, // InElem - input elements
 *   string, // InErr - input errors
 *   boolean, // InDone - input completion
 *   { db: string } // Env - required environment
 * >
 *
 * const channel: NumberChannel = Channel.succeed(1)
 * Effect.runSync(Channel.runCollect(channel)) // => [1]
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export interface Channel<
    out OutElem,
    out OutErr = never,
    out OutDone = void,
    in InElem = unknown,
    in InErr = unknown,
    in InDone = unknown,
    out Env = never
> extends Variance<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>, Pipeable {
    [Unify.typeSymbol]?: unknown
    [Unify.unifySymbol]?: ChannelUnify<this>
    [Unify.ignoreSymbol]?: ChannelUnifyIgnore
}

/**
 * Type-level unification support for `Channel` values.
 *
 * **Details**
 *
 * This preserves all `Channel` type parameters when `Unify` normalizes unions
 * or generic return types that include channels. Users normally do not need to
 * reference this interface directly.
 *
 * @category models
 * @since 1.0.0
 */
export interface ChannelUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
    Channel?: () => A[Unify.typeSymbol] extends
    | Channel<infer OutElem, infer OutErr, infer OutDone, infer InElem, infer InErr, infer InDone, infer Env>
    | infer _ ? Channel<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
        : never
}

/**
 * Marker used by `Unify` while resolving `Channel` values.
 *
 * **Details**
 *
 * It prevents the inherited `Effect` unifier from being selected when the
 * channel-specific unifier should preserve `Channel` input, output, and
 * environment type parameters. Users normally do not need to reference this
 * interface directly.
 *
 * @category models
 * @since 1.0.0
 */
export interface ChannelUnifyIgnore {
    Effect?: true
}

/**
 * Phantom variance marker for the type parameters of `Channel`.
 *
 * **Details**
 *
 * Output element, output error, output done, and environment types are
 * covariant. Input element, input error, and input done types are
 * contravariant. This is type-level machinery and is not used directly at
 * runtime.
 *
 * @category models
 * @since 1.0.0
 */
export interface Variance<
    out OutElem,
    out OutErr,
    out OutDone,
    in InElem,
    in InErr,
    in InDone,
    out Env
> {
    readonly [TypeId]: VarianceStruct<OutElem, OutErr, OutDone, InElem, InErr, InDone, Env>
}

/**
 * Structural encoding used by `Variance` to record each `Channel` type
 * parameter's variance.
 *
 * **Details**
 *
 * The `_OutElem`, `_OutErr`, `_OutDone`, and `_Env` fields are covariant; the
 * `_InElem`, `_InErr`, and `_InDone` fields are contravariant. Users normally
 * do not need to reference this interface directly.
 *
 * @category models
 * @since 1.0.0
 */
export interface VarianceStruct<
    out OutElem,
    out OutErr,
    out OutDone,
    in InElem,
    in InErr,
    in InDone,
    out Env
> {
    _Env: Types.Covariant<Env>
    _InErr: Types.Contravariant<InErr>
    _InElem: Types.Contravariant<InElem>
    _InDone: Types.Contravariant<InDone>
    _OutErr: Types.Covariant<OutErr>
    _OutElem: Types.Covariant<OutElem>
    _OutDone: Types.Covariant<OutDone>
}
