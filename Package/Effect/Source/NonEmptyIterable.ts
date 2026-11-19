/**
 * The `NonEmptyIterable` module provides a type-level representation of any
 * JavaScript `Iterable` that is known to contain at least one element. A
 * `NonEmptyIterable<A>` can be consumed anywhere an `Iterable<A>` is expected,
 * while also carrying the guarantee that reading the first element is safe.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/NonEmptyIterable
 *
 * @file      NonEmptyIterable.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */

/* eslint-disable @stylistic/max-len */

/**
 * Defines the type-level symbol used to brand the `NonEmptyIterable` type.
 *
 * **When to use**
 *
 * Use as the property key for the type-level brand that marks an `Iterable` as
 * non-empty.
 *
 * **Details**
 *
 * `NonEmptyIterable<A>` includes `readonly [nonEmpty]: A`, which makes it
 * distinct from a plain `Iterable<A>` at compile time while preserving the
 * normal iteration shape.
 *
 * @see {@link NonEmptyIterable} for the branded iterable type that uses this symbol
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare const nonEmpty: unique symbol;

/**
 * Represents an iterable that is guaranteed to contain at least one element.
 *
 * **When to use**
 *
 * Use to require an iterable input that must provide at least one element.
 *
 * **Details**
 *
 * `NonEmptyIterable<A>` extends the standard `Iterable<A>` interface with a type-level
 * guarantee of non-emptiness. This allows for safe operations that would otherwise
 * require runtime checks or could throw exceptions.
 *
 * The type is branded with a unique symbol to ensure type safety while maintaining
 * full compatibility with JavaScript's iteration protocol.
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface NonEmptyIterable<out A> extends Iterable<A>
{
    readonly [nonEmpty]: A
}

/**
 * Extracts the first element and remaining elements from a non-empty iterable safely.
 *
 * **When to use**
 *
 * Use to split a non-empty iterable into its first element and an iterator for
 * the remaining elements.
 *
 * **Details**
 *
 * This function provides a safe way to deconstruct a `NonEmptyIterable` into its
 * head (first element) and tail (remaining elements as an iterator). Since the
 * iterable is guaranteed to be non-empty, the first element is always available.
 *
 * **Example** (Extracting first and remaining elements)
 *
 * ```ts import.meta.vitest
 * import { Chunk, NonEmptyIterable } from "effect"
 *
 * const [first, rest] = NonEmptyIterable.unprepend(Chunk.make(1, 2, 3))
 *
 * first // => 1
 * globalThis.Array.from({ [Symbol.iterator]: () => rest }) // => [2, 3]
 * ```
 *
 * @throws { Error } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const unprepend = <A>(self: NonEmptyIterable<A>): [firstElement: A, remainingElements: Iterator<A>] =>
{
    const IteratorValue = self[Symbol.iterator]();
    const Next = IteratorValue.next();
    if (Next.done)
    {
        throw new Error(
            "BUG: NonEmptyIterator should not be empty - please report an issue at https://github.com/Effect-TS/effect/issues"
        );
    }

    return [ Next.value, IteratorValue ];
};
