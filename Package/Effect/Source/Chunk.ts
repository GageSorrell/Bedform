/**
 * Stores many values in an immutable ordered collection.
 *
 * A `Chunk<A>` is useful when you need to build or transform collections
 * without changing the original collection. It is designed for efficient
 * append, prepend, and concatenation. This module includes helpers for
 * creating, reading, slicing, mapping, filtering, sorting, zipping, combining,
 * and converting chunks to and from arrays and iterables.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Chunk
 *
 * @file      Chunk.ts
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
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, prefer-rest-params, @stylistic/max-len */

import * as RA from "./Array.js";
import type { NonEmptyReadonlyArray } from "./Array.js";
import * as Equal from "./Equal.js";
import * as Equivalence from "./Equivalence.js";
import type * as Filter from "./Filter.js";
import { format } from "./Formatter.js";
import { dual, identity, pipe } from "./Function.js";
import * as Hash from "./Hash.js";
import type { TypeLambda } from "./HKT.js";
import { type Inspectable, NodeInspectSymbol, toJson } from "./Inspectable.js";
import * as Count from "./Internal/count.js";
import type { NonEmptyIterable } from "./NonEmptyIterable.js";
import type { Option } from "./Option.js";
import * as O from "./Option.js";
import * as Order from "./Order.js";
import type { Pipeable } from "./Pipeable.js";
import { pipeArguments } from "./Pipeable.js";
import { hasProperty, type Predicate, type Refinement } from "./Predicate.js";
import * as R from "./Result.js";
import type { Result } from "./Result.js";
import type { Covariant, NoInfer } from "./Types.js";

const TypeId = "~effect/Chunk";

export namespace Chunk
{
    /**
     * Covariant element marker for the immutable Chunk protocol.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface TypeId<out A>
    {
        readonly _A: Covariant<A>
    }
}

/**
 * A Chunk is an immutable, ordered collection optimized for efficient concatenation and access patterns.
 *
 * **Example** (Inspecting chunk values)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk: Chunk.Chunk<number> = Chunk.make(1, 2, 3)
 * chunk.length // => 3
 * Chunk.toArray(chunk) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface Chunk<out A> extends Iterable<A>, Equal.Equal, Pipeable, Inspectable
{
    readonly [TypeId]: Chunk.TypeId<A>
    readonly length: number
    right: Chunk<A>
    left: Chunk<A>
    backing: Backing<A>
    depth: number
}

/**
 * A non-empty Chunk guaranteed to contain at least one element.
 *
 * **Example** (Working with non-empty chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nonEmptyChunk: Chunk.NonEmptyChunk<number> = Chunk.make(1, 2, 3)
 * Chunk.headNonEmpty(nonEmptyChunk) // => 1
 * Chunk.lastNonEmpty(nonEmptyChunk) // => 3
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface NonEmptyChunk<out A> extends Chunk<A>, NonEmptyIterable<A> {}

/**
 * Type lambda for Chunk, used for higher-kinded type operations.
 *
 * **Example** (Applying the Chunk type lambda)
 *
 * ```ts import.meta.vitest
 * import type { Chunk, HKT } from "effect"
 *
 * // Create a Chunk type using the type lambda
 * type NumberChunk = HKT.Kind<Chunk.ChunkTypeLambda, never, never, never, number>
 * // Equivalent to: Chunk<number>
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface ChunkTypeLambda extends TypeLambda
{
    readonly type: Chunk<this["Target"]>
}

type Backing<A> =
  | IArray<A>
  | IConcat<A>
  | ISingleton<A>
  | IEmpty
  | ISlice<A>;

interface IArray<A>
{
    readonly _tag: "IArray"
    readonly array: ReadonlyArray<A>
}

interface IConcat<A>
{
    readonly _tag: "IConcat"
    readonly left: Chunk<A>
    readonly right: Chunk<A>
}

interface ISingleton<A>
{
    readonly _tag: "ISingleton"
    readonly a: A
}

interface IEmpty
{
    readonly _tag: "IEmpty"
}

interface ISlice<A>
{
    readonly _tag: "ISlice"
    readonly chunk: Chunk<A>
    readonly offset: number
    readonly length: number
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 * @category Utilities
 * @since 1.0.0
 */
function copy<A>(
    src: ReadonlyArray<A>,
    srcPos: number,
    dest: Array<A>,
    destPos: number,
    len: number
)
{
    for (let i = srcPos; i < Math.min(src.length, srcPos + len); i++)
    {
        dest[destPos + i - srcPos] = src[i]!;
    }

    return dest;
}

const EmptyArray: ReadonlyArray<never> = [];

/**
 * Creates an `Equivalence` for chunks that compares chunk lengths and then
 * compares corresponding elements with the provided element equivalence.
 *
 * **Example** (Comparing chunks for equivalence)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Equivalence } from "effect"
 *
 * const chunk1 = Chunk.make(1, 2, 3)
 * const chunk2 = Chunk.make(1, 2, 3)
 * const chunk3 = Chunk.make(1, 2, 4)
 *
 * const eq = Chunk.makeEquivalence(Equivalence.strictEqual<number>())
 * eq(chunk1, chunk2) // => true
 * eq(chunk1, chunk3) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeEquivalence = <A>(isEquivalent: Equivalence.Equivalence<A>): Equivalence.Equivalence<Chunk<A>> =>
    Equivalence.make((self, that) =>
    {
        if (self.length !== that.length)
        {
            return false;
        }

        const AsValue = toReadonlyArray(self);
        const Bs = toReadonlyArray(that);
        for (let i = 0; i < AsValue.length; i++)
        {
            if (!isEquivalent(AsValue[i], Bs[i]))
            {
                return false;
            }
        }

        return true;
    });

const EquivalenceValue = makeEquivalence(Equal.equals);

const ChunkProto: Omit<Chunk<unknown>, "backing" | "depth" | "left" | "length" | "right"> = {
    [TypeId]: {
        _A: (_: never) => _
    },
    toString<A>(this: Chunk<A>)
    {
        return `Chunk(${format(toReadonlyArray(this))})`;
    },
    toJSON<A>(this: Chunk<A>)
    {
        return {
            _id: "Chunk",
            values: toJson(toReadonlyArray(this))
        };
    },
    [NodeInspectSymbol]<A>(this: Chunk<A>)
    {
        return this.toJSON();
    },
    [Equal.symbol]<A>(this: Chunk<A>, that: unknown): boolean
    {
        return isChunk(that) && EquivalenceValue(this, that);
    },
    [Hash.symbol]<A>(this: Chunk<A>): number
    {
        return Hash.array(toReadonlyArray(this));
    },
    [Symbol.iterator]<A>(this: Chunk<A>): Iterator<A>
    {
        switch (this.backing._tag)
        {
            case "IArray": {
                return this.backing.array[Symbol.iterator]();
            }

            case "IEmpty": {
                return EmptyArray[Symbol.iterator]();
            }

            default: {
                return toReadonlyArray(this)[Symbol.iterator]();
            }
        }
    },
    pipe<A>(this: Chunk<A>)
    {
        return pipeArguments(this, arguments);
    }
};

const MakeChunk = <A>(backing: Backing<A>): Chunk<A> =>
{
    const ChunkValue = Object.create(ChunkProto);
    ChunkValue.backing = backing;
    switch (backing._tag)
    {
        case "IEmpty": {
            ChunkValue.length = 0;
            ChunkValue.depth = 0;
            ChunkValue.left = ChunkValue;
            ChunkValue.right = ChunkValue;
            break;
        }

        case "IConcat": {
            ChunkValue.length = backing.left.length + backing.right.length;
            ChunkValue.depth = 1 + Math.max(backing.left.depth, backing.right.depth);
            ChunkValue.left = backing.left;
            ChunkValue.right = backing.right;
            break;
        }

        case "IArray": {
            ChunkValue.length = backing.array.length;
            ChunkValue.depth = 0;
            ChunkValue.left = EmptyValue;
            ChunkValue.right = EmptyValue;
            break;
        }

        case "ISingleton": {
            ChunkValue.length = 1;
            ChunkValue.depth = 0;
            ChunkValue.left = EmptyValue;
            ChunkValue.right = EmptyValue;
            break;
        }

        case "ISlice": {
            ChunkValue.length = backing.length;
            ChunkValue.depth = 0;
            ChunkValue.left = EmptyValue;
            ChunkValue.right = EmptyValue;
            break;
        }
    }

    return ChunkValue;
};

/**
 * Checks whether `u` is a `Chunk<unknown>`
 *
 * **Example** (Checking for chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * const array = [1, 2, 3]
 *
 * Chunk.isChunk(chunk) // => true
 * Chunk.isChunk(array) // => false
 * Chunk.isChunk("string") // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isChunk: {
    /**
     * Checks whether `u` is a `Chunk<unknown>`
     *
     * **Example** (Checking for chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * const array = [1, 2, 3]
     *
     * Chunk.isChunk(chunk) // => true
     * Chunk.isChunk(array) // => false
     * Chunk.isChunk("string") // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(u: Iterable<A>): u is Chunk<A>

    /**
     * Checks whether `u` is a `Chunk<unknown>`
     *
     * **Example** (Checking for chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * const array = [1, 2, 3]
     *
     * Chunk.isChunk(chunk) // => true
     * Chunk.isChunk(array) // => false
     * Chunk.isChunk("string") // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (u: unknown): u is Chunk<unknown>
} = (u: unknown): u is Chunk<unknown> => hasProperty(u, TypeId);

const EmptyValue = MakeChunk<never>({ _tag: "IEmpty" });

/**
 * Creates an empty `Chunk`.
 *
 * **Example** (Creating an empty chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.size(Chunk.empty()) // => 0
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const empty: <A = never>() => Chunk<A> = () => EmptyValue;

/**
 * Builds a `NonEmptyChunk` from an non-empty collection of elements.
 *
 * **Example** (Creating a non-empty chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.make(1, 2, 3, 4)) // => [1, 2, 3, 4]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const make = <As extends readonly [any, ...Array<any>]>(...as: As): NonEmptyChunk<As[number]> =>
    fromNonEmptyArrayUnsafe(as);

/**
 * Builds a `NonEmptyChunk` from a single element.
 *
 * **Example** (Creating a single-element chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.of("hello")) // => ["hello"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const of = <A>(a: A): NonEmptyChunk<A> => MakeChunk({ _tag: "ISingleton",
    a }) as any;

/**
 * Creates a new `Chunk` from an iterable collection of values.
 *
 * **Example** (Creating chunks from iterables)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.fromIterable([1, 2, 3])) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromIterable = <A>(self: Iterable<A>): Chunk<A> =>
    isChunk(self) ? self : fromArrayUnsafe(RA.fromIterable(self));

const CopyToArray = <A>(self: Chunk<A>, array: Array<any>, initial: number): void =>
{
    switch (self.backing._tag)
    {
        case "IArray": {
            copy(self.backing.array, 0, array, initial, self.length);
            break;
        }

        case "IConcat": {
            CopyToArray(self.left, array, initial);
            CopyToArray(self.right, array, initial + self.left.length);
            break;
        }

        case "ISingleton": {
            array[initial] = self.backing.a;
            break;
        }

        case "ISlice": {
            copy(toReadonlyArray(self.backing.chunk), self.backing.offset, array, initial, self.length);
            break;
        }
    }
};

const ToArray_ = <A>(self: Chunk<A>): Array<A> => toReadonlyArray(self).slice();

/**
 * Converts a `Chunk` into an `Array`. If the provided `Chunk` is non-empty
 * (`NonEmptyChunk`), the function will return a `NonEmptyArray`, ensuring the
 * non-empty property is preserved.
 *
 * **Example** (Converting chunks to mutable arrays)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * const array = Chunk.toArray(chunk)
 * array // => [1, 2, 3]
 * Array.isArray(array) // => true
 *
 * // With empty chunk
 * Chunk.toArray(Chunk.empty<number>()) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toArray: <S extends Chunk<any>>(
    self: S
) => S extends NonEmptyChunk<any> ? RA.NonEmptyArray<Chunk.Infer<S>> : Array<Chunk.Infer<S>> = ToArray_ as any;

const ToReadonlyArray_ = <A>(self: Chunk<A>): ReadonlyArray<A> =>
{
    switch (self.backing._tag)
    {
        case "IEmpty": {
            return EmptyArray;
        }

        case "IArray": {
            return self.backing.array;
        }

        default: {
            const Arr = new Array<A>(self.length);
            CopyToArray(self, Arr, 0);
            self.backing = {
                _tag: "IArray",
                array: Arr
            };
            self.left = EmptyValue;
            self.right = EmptyValue;
            self.depth = 0;
            return Arr;
        }
    }
};

/**
 * Converts a `Chunk` into a `ReadonlyArray`. If the provided `Chunk` is
 * non-empty (`NonEmptyChunk`), the function will return a
 * `NonEmptyReadonlyArray`, ensuring the non-empty property is preserved.
 *
 * **Example** (Converting chunks to readonly arrays)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * const readonlyArray = Chunk.toReadonlyArray(chunk)
 * readonlyArray // => [1, 2, 3]
 *
 * // The result is read-only, modifications would cause TypeScript errors
 * // readonlyArray[0] = 10 // TypeScript error
 *
 * // With empty chunk
 * Chunk.toReadonlyArray(Chunk.empty<number>()) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toReadonlyArray: <S extends Chunk<any>>(
    self: S
) => S extends NonEmptyChunk<any> ? RA.NonEmptyReadonlyArray<Chunk.Infer<S>> : ReadonlyArray<Chunk.Infer<S>> =
    ToReadonlyArray_ as any;

const ReverseChunk = <A>(self: Chunk<A>): Chunk<A> =>
{
    switch (self.backing._tag)
    {
        case "IEmpty":
        case "ISingleton":
            return self;
        case "IArray": {
            return MakeChunk({ _tag: "IArray",
                array: RA.reverse(self.backing.array) });
        }

        case "IConcat": {
            return MakeChunk({ _tag: "IConcat",
                left: reverse(self.backing.right),
                right: reverse(self.backing.left) });
        }

        case "ISlice":
            return fromArrayUnsafe(RA.reverse(toReadonlyArray(self)));
    }
};

/**
 * Reverses the order of elements in a `Chunk`.
 *
 * **When to use**
 *
 * Use to read or process chunk elements in reverse order.
 *
 * **Details**
 *
 * If the input chunk is a `NonEmptyChunk`, the reversed chunk is also a
 * `NonEmptyChunk`.
 *
 * **Example** (Reversing chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * Chunk.toArray(Chunk.reverse(chunk)) // => [3, 2, 1]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const reverse: <S extends Chunk<any>>(self: S) => Chunk.With<S, Chunk.Infer<S>> = ReverseChunk as any;

/**
 * Gets the value at an index in a `Chunk` safely, returning `None` when the index is
 * out of bounds.
 *
 * **Example** (Accessing elements safely)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make("a", "b", "c", "d")
 *
 * Chunk.get(chunk, 1) // => Option.some("b")
 * Chunk.get(chunk, 10) // => Option.none()
 * Chunk.get(chunk, -1) // => Option.none()
 *
 * // Using pipe syntax
 * chunk.pipe(Chunk.get(2)) // => Option.some("c")
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const get: {
    /**
     * Gets the value at an index in a `Chunk` safely, returning `None` when the index is
     * out of bounds.
     *
     * **Example** (Accessing elements safely)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     *
     * Chunk.get(chunk, 1) // => Option.some("b")
     * Chunk.get(chunk, 10) // => Option.none()
     * Chunk.get(chunk, -1) // => Option.none()
     *
     * // Using pipe syntax
     * chunk.pipe(Chunk.get(2)) // => Option.some("c")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (index: number): <A>(self: Chunk<A>) => Option<A>

    /**
     * Gets the value at an index in a `Chunk` safely, returning `None` when the index is
     * out of bounds.
     *
     * **Example** (Accessing elements safely)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     *
     * Chunk.get(chunk, 1) // => Option.some("b")
     * Chunk.get(chunk, 10) // => Option.none()
     * Chunk.get(chunk, -1) // => Option.none()
     *
     * // Using pipe syntax
     * chunk.pipe(Chunk.get(2)) // => Option.some("c")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, index: number): Option<A>
} = dual(
    2,
    <A>(self: Chunk<A>, index: number): Option<A> =>
        index < 0 || index >= self.length ? O.none() : O.some(getUnsafe(self, index))
);

/**
 * Wraps an array into a chunk without copying.
 *
 * **When to use**
 *
 * Use when the input array can be shared with the resulting `Chunk` and avoiding
 * a copy matters.
 *
 * **Gotchas**
 *
 * Mutating the source array after wrapping can mutate the resulting `Chunk`.
 *
 * **Example** (Creating chunks without copying arrays)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const array = [1, 2, 3, 4, 5]
 * const chunk = Chunk.fromArrayUnsafe(array)
 * Chunk.toArray(chunk) // => [1, 2, 3, 4, 5]
 *
 * // Warning: Since this doesn't copy the array, mutations affect the chunk
 * array[0] = 999
 * Chunk.toArray(chunk) // => [999, 2, 3, 4, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromArrayUnsafe = <A>(self: ReadonlyArray<A>): Chunk<A> =>
    self.length === 0 ? empty() : self.length === 1 ? of(self[0]) : MakeChunk({ _tag: "IArray",
        array: self });

/**
 * Wraps a non-empty array into a non-empty chunk without copying.
 *
 * **When to use**
 *
 * Use when the input array is already known to be non-empty, can be shared with
 * the resulting `Chunk`, and avoiding a copy matters.
 *
 * **Gotchas**
 *
 * Mutating the source array after wrapping can mutate the resulting `Chunk`.
 *
 * **Example** (Creating non-empty chunks without copying arrays)
 *
 * ```ts import.meta.vitest
 * import { Array, Chunk } from "effect"
 *
 * const nonEmptyArray = Array.make(1, 2, 3, 4, 5)
 * const chunk = Chunk.fromNonEmptyArrayUnsafe(nonEmptyArray)
 * Chunk.toArray(chunk) // => [1, 2, 3, 4, 5]
 *
 * // The result is guaranteed to be non-empty
 * Chunk.isNonEmpty(chunk) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromNonEmptyArrayUnsafe = <A>(self: NonEmptyReadonlyArray<A>): NonEmptyChunk<A> =>
    fromArrayUnsafe(self) as any;

/**
 * Gets an element at the specified index without returning an `Option`.
 *
 * **When to use**
 *
 * Use when reading from a `Chunk` at an index known to be in bounds and direct
 * element access is preferred over handling `Option.none`.
 *
 * **Gotchas**
 *
 * Throws if the index is out of bounds.
 *
 * **Example** (Accessing elements unsafely)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make("a", "b", "c", "d")
 *
 * Chunk.getUnsafe(chunk, 1) // => "b"
 * Chunk.getUnsafe(chunk, 3) // => "d"
 *
 * // Use Chunk.get when the index may be out of bounds
 * Option.isNone(Chunk.get(chunk, 10)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getUnsafe: {
    /**
     * Gets an element at the specified index without returning an `Option`.
     *
     * **When to use**
     *
     * Use when reading from a `Chunk` at an index known to be in bounds and direct
     * element access is preferred over handling `Option.none`.
     *
     * **Gotchas**
     *
     * Throws if the index is out of bounds.
     *
     * **Example** (Accessing elements unsafely)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     *
     * Chunk.getUnsafe(chunk, 1) // => "b"
     * Chunk.getUnsafe(chunk, 3) // => "d"
     *
     * // Use Chunk.get when the index may be out of bounds
     * Option.isNone(Chunk.get(chunk, 10)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (index: number): <A>(self: Chunk<A>) => A

    /**
     * Gets an element at the specified index without returning an `Option`.
     *
     * **When to use**
     *
     * Use when reading from a `Chunk` at an index known to be in bounds and direct
     * element access is preferred over handling `Option.none`.
     *
     * **Gotchas**
     *
     * Throws if the index is out of bounds.
     *
     * **Example** (Accessing elements unsafely)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     *
     * Chunk.getUnsafe(chunk, 1) // => "b"
     * Chunk.getUnsafe(chunk, 3) // => "d"
     *
     * // Use Chunk.get when the index may be out of bounds
     * Option.isNone(Chunk.get(chunk, 10)) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, index: number): A
} = dual(2, <A>(self: Chunk<A>, index: number): A =>
{
    const I = Math.floor(index);
    switch (self.backing._tag)
    {
        case "IEmpty": {
            throw new Error(`Index out of bounds: ${I}`);
        }

        case "ISingleton": {
            if (index !== 0)
            {
                throw new Error(`Index out of bounds: ${I}`);
            }

            return self.backing.a;
        }

        case "IArray": {
            if (I >= self.length || I < 0)
            {
                throw new Error(`Index out of bounds: ${I}`);
            }

            return self.backing.array[I]!;
        }

        case "IConcat": {
            return I < self.left.length
                ? getUnsafe(self.left, I)
                : getUnsafe(self.right, I - self.left.length);
        }

        case "ISlice": {
            return getUnsafe(self.backing.chunk, I + self.backing.offset);
        }
    }
});

/**
 * Appends the specified element to the end of the `Chunk`.
 *
 * **When to use**
 *
 * Use to add one element after the existing chunk elements and return a
 * `NonEmptyChunk`.
 *
 * **Example** (Appending an element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * Chunk.toArray(Chunk.append(chunk, 4)) // => [1, 2, 3, 4]
 *
 * // Appending to empty chunk
 * const emptyChunk = Chunk.empty<number>()
 * Chunk.toArray(Chunk.append(emptyChunk, 42)) // => [42]
 * ```
 *
 * @see {@link prepend} for adding one element before the existing elements
 * @see {@link appendAll} for appending all elements from another chunk
 *
 * @category Utilities
 * @since 1.0.0
 */
export const append: {
    /**
     * Appends the specified element to the end of the `Chunk`.
     *
     * **When to use**
     *
     * Use to add one element after the existing chunk elements and return a
     * `NonEmptyChunk`.
     *
     * **Example** (Appending an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.append(chunk, 4)) // => [1, 2, 3, 4]
     *
     * // Appending to empty chunk
     * const emptyChunk = Chunk.empty<number>()
     * Chunk.toArray(Chunk.append(emptyChunk, 42)) // => [42]
     * ```
     *
     * @see {@link prepend} for adding one element before the existing elements
     * @see {@link appendAll} for appending all elements from another chunk
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A2>(a: A2): <A>(self: Chunk<A>) => NonEmptyChunk<A2 | A>

    /**
     * Appends the specified element to the end of the `Chunk`.
     *
     * **When to use**
     *
     * Use to add one element after the existing chunk elements and return a
     * `NonEmptyChunk`.
     *
     * **Example** (Appending an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.append(chunk, 4)) // => [1, 2, 3, 4]
     *
     * // Appending to empty chunk
     * const emptyChunk = Chunk.empty<number>()
     * Chunk.toArray(Chunk.append(emptyChunk, 42)) // => [42]
     * ```
     *
     * @see {@link prepend} for adding one element before the existing elements
     * @see {@link appendAll} for appending all elements from another chunk
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, A2>(self: Chunk<A>, a: A2): NonEmptyChunk<A | A2>
} = dual(2, <A, A2>(self: Chunk<A>, a: A2): NonEmptyChunk<A | A2> => appendAll(self, of(a)));

/**
 * Prepends an element to the front of a `Chunk`, creating a new `NonEmptyChunk`.
 *
 * **Example** (Prepending an element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(2, 3, 4)
 * Chunk.toArray(Chunk.prepend(chunk, 1)) // => [1, 2, 3, 4]
 *
 * // Prepending to empty chunk
 * const emptyChunk = Chunk.empty<string>()
 * Chunk.toArray(Chunk.prepend(emptyChunk, "first")) // => ["first"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const prepend: {
    /**
     * Prepends an element to the front of a `Chunk`, creating a new `NonEmptyChunk`.
     *
     * **Example** (Prepending an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(2, 3, 4)
     * Chunk.toArray(Chunk.prepend(chunk, 1)) // => [1, 2, 3, 4]
     *
     * // Prepending to empty chunk
     * const emptyChunk = Chunk.empty<string>()
     * Chunk.toArray(Chunk.prepend(emptyChunk, "first")) // => ["first"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B>(elem: B): <A>(self: Chunk<A>) => NonEmptyChunk<B | A>

    /**
     * Prepends an element to the front of a `Chunk`, creating a new `NonEmptyChunk`.
     *
     * **Example** (Prepending an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(2, 3, 4)
     * Chunk.toArray(Chunk.prepend(chunk, 1)) // => [1, 2, 3, 4]
     *
     * // Prepending to empty chunk
     * const emptyChunk = Chunk.empty<string>()
     * Chunk.toArray(Chunk.prepend(emptyChunk, "first")) // => ["first"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, elem: B): NonEmptyChunk<A | B>
} = dual(2, <A, B>(self: Chunk<A>, elem: B): NonEmptyChunk<A | B> => appendAll(of(elem), self));

/**
 * Takes the first up to `n` elements from the chunk.
 * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
 *
 * **Example** (Taking elements from the start)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.toArray(Chunk.take(chunk, 3)) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const take: {
    /**
     * Takes the first up to `n` elements from the chunk.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Taking elements from the start)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.take(chunk, 3)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<A>

    /**
     * Takes the first up to `n` elements from the chunk.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Taking elements from the start)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.take(chunk, 3)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<A>
} = dual(2, <A>(self: Chunk<A>, _n: number): Chunk<A> =>
{
    const N = Count.normalize(_n);
    if (N <= 0)
    {
        return EmptyValue;
    }
    else if (N >= self.length)
    {
        return self;
    }
    else
    {
        switch (self.backing._tag)
        {
            case "ISlice": {
                return MakeChunk({
                    _tag: "ISlice",
                    chunk: self.backing.chunk,
                    length: N,
                    offset: self.backing.offset
                });
            }

            case "IConcat": {
                if (N > self.left.length)
                {
                    return MakeChunk({
                        _tag: "IConcat",
                        left: self.left,
                        right: take(self.right, N - self.left.length)
                    });
                }

                return take(self.left, N);
            }

            default: {
                return MakeChunk({
                    _tag: "ISlice",
                    chunk: self,
                    offset: 0,
                    length: N
                });
            }
        }
    }
});

/**
 * Drops the first up to `n` elements from the chunk.
 * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
 *
 * **Example** (Dropping elements from the start)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.toArray(Chunk.drop(chunk, 2)) // => [3, 4, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const drop: {
    /**
     * Drops the first up to `n` elements from the chunk.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Dropping elements from the start)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.drop(chunk, 2)) // => [3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<A>

    /**
     * Drops the first up to `n` elements from the chunk.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Dropping elements from the start)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.drop(chunk, 2)) // => [3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<A>
} = dual(2, <A>(self: Chunk<A>, _n: number): Chunk<A> =>
{
    const NValue = Count.normalize(_n);
    if (NValue <= 0)
    {
        return self;
    }
    else if (NValue >= self.length)
    {
        return EmptyValue;
    }
    else
    {
        switch (self.backing._tag)
        {
            case "ISlice": {
                return MakeChunk({
                    _tag: "ISlice",
                    chunk: self.backing.chunk,
                    offset: self.backing.offset + NValue,
                    length: self.backing.length - NValue
                });
            }

            case "IConcat": {
                if (NValue > self.left.length)
                {
                    return drop(self.right, NValue - self.left.length);
                }

                return MakeChunk({
                    _tag: "IConcat",
                    left: drop(self.left, NValue),
                    right: self.right
                });
            }

            default: {
                return MakeChunk({
                    _tag: "ISlice",
                    chunk: self,
                    offset: NValue,
                    length: self.length - NValue
                });
            }
        }
    }
});

/**
 * Drops the last `n` elements.
 * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
 *
 * **Example** (Dropping elements from the end)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.toArray(Chunk.dropRight(chunk, 2)) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const dropRight: {
    /**
     * Drops the last `n` elements.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Dropping elements from the end)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.dropRight(chunk, 2)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<A>

    /**
     * Drops the last `n` elements.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Dropping elements from the end)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.dropRight(chunk, 2)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, n: number): Chunk<A> => take(self, self.length - Math.min(Count.normalize(n), self.length))
);

/**
 * Drops all elements so long as the predicate returns true.
 *
 * **Example** (Dropping elements while a predicate matches)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.toArray(Chunk.dropWhile(chunk, (n) => n < 3)) // => [3, 4, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const dropWhile: {
    /**
     * Drops all elements so long as the predicate returns true.
     *
     * **Example** (Dropping elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.dropWhile(chunk, (n) => n < 3)) // => [3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => Chunk<A>

    /**
     * Drops all elements so long as the predicate returns true.
     *
     * **Example** (Dropping elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.toArray(Chunk.dropWhile(chunk, (n) => n < 3)) // => [3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A>
} = dual(2, <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A> =>
{
    const ArrValue = toReadonlyArray(self);
    const Len = ArrValue.length;
    let i = 0;
    while (i < Len && predicate(ArrValue[i]!))
    {
        i++;
    }

    return drop(self, i);
});

/**
 * Prepends the specified prefix chunk to the beginning of the specified chunk.
 * If either chunk is non-empty, the result is also a non-empty chunk.
 *
 * **Example** (Prepending all elements)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.make(1, 2).pipe(
 *   Chunk.prependAll(Chunk.make("a", "b")),
 *   Chunk.toArray
 * ) // => ["a", "b", 1, 2]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const prependAll: {
    /**
     * Prepends the specified prefix chunk to the beginning of the specified chunk.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **Example** (Prepending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.prependAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => ["a", "b", 1, 2]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S extends Chunk<any>, T extends Chunk<any>>(that: T): (self: S) => Chunk.OrNonEmpty<S, T, Chunk.Infer<S> | Chunk.Infer<T>>

    /**
     * Prepends the specified prefix chunk to the beginning of the specified chunk.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **Example** (Prepending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.prependAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => ["a", "b", 1, 2]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: NonEmptyChunk<B>): NonEmptyChunk<A | B>

    /**
     * Prepends the specified prefix chunk to the beginning of the specified chunk.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **Example** (Prepending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.prependAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => ["a", "b", 1, 2]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: NonEmptyChunk<A>, that: Chunk<B>): NonEmptyChunk<A | B>

    /**
     * Prepends the specified prefix chunk to the beginning of the specified chunk.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **Example** (Prepending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.prependAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => ["a", "b", 1, 2]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A | B>
} = dual(2, <A, B>(self: NonEmptyChunk<A>, that: Chunk<B>): Chunk<A | B> => appendAll(that, self));

/**
 * Concatenates two chunks, combining their elements.
 * If either chunk is non-empty, the result is also a non-empty chunk.
 *
 * **When to use**
 *
 * Use to concatenate two chunks when the second chunk's elements should come
 * after the first.
 *
 * **Example** (Appending all elements)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.make(1, 2).pipe(
 *   Chunk.appendAll(Chunk.make("a", "b")),
 *   Chunk.toArray
 * ) // => [1, 2, "a", "b"]
 * ```
 *
 * @see {@link prependAll} for concatenating chunks in the opposite order
 * @see {@link append} for adding a single element to the end
 *
 * @category Utilities
 * @since 1.0.0
 */
export const appendAll: {
    /**
     * Concatenates two chunks, combining their elements.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **When to use**
     *
     * Use to concatenate two chunks when the second chunk's elements should come
     * after the first.
     *
     * **Example** (Appending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.appendAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => [1, 2, "a", "b"]
     * ```
     *
     * @see {@link prependAll} for concatenating chunks in the opposite order
     * @see {@link append} for adding a single element to the end
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S extends Chunk<any>, T extends Chunk<any>>(that: T): (self: S) => Chunk.OrNonEmpty<S, T, Chunk.Infer<S> | Chunk.Infer<T>>

    /**
     * Concatenates two chunks, combining their elements.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **When to use**
     *
     * Use to concatenate two chunks when the second chunk's elements should come
     * after the first.
     *
     * **Example** (Appending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.appendAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => [1, 2, "a", "b"]
     * ```
     *
     * @see {@link prependAll} for concatenating chunks in the opposite order
     * @see {@link append} for adding a single element to the end
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: NonEmptyChunk<B>): NonEmptyChunk<A | B>

    /**
     * Concatenates two chunks, combining their elements.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **When to use**
     *
     * Use to concatenate two chunks when the second chunk's elements should come
     * after the first.
     *
     * **Example** (Appending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.appendAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => [1, 2, "a", "b"]
     * ```
     *
     * @see {@link prependAll} for concatenating chunks in the opposite order
     * @see {@link append} for adding a single element to the end
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: NonEmptyChunk<A>, that: Chunk<B>): NonEmptyChunk<A | B>

    /**
     * Concatenates two chunks, combining their elements.
     * If either chunk is non-empty, the result is also a non-empty chunk.
     *
     * **When to use**
     *
     * Use to concatenate two chunks when the second chunk's elements should come
     * after the first.
     *
     * **Example** (Appending all elements)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.make(1, 2).pipe(
     *   Chunk.appendAll(Chunk.make("a", "b")),
     *   Chunk.toArray
     * ) // => [1, 2, "a", "b"]
     * ```
     *
     * @see {@link prependAll} for concatenating chunks in the opposite order
     * @see {@link append} for adding a single element to the end
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A | B>
} = dual(2, <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A | B> =>
{
    if (self.backing._tag === "IEmpty")
    {
        return that;
    }

    if (that.backing._tag === "IEmpty")
    {
        return self;
    }

    const Diff = that.depth - self.depth;
    if (Math.abs(Diff) <= 1)
    {
        return MakeChunk</**
                          * Concatenates two chunks, combining their elements.
                          * If either chunk is non-empty, the result is also a non-empty chunk.
                          *
                          * **When to use**
                          *
                          * Use to concatenate two chunks when the second chunk's elements should come
                          * after the first.
                          *
                          * **Example** (Appending all elements)
                          *
                          * ```ts import.meta.vitest
                          * import { Chunk } from "effect"
                          *
                          * Chunk.make(1, 2).pipe(
                          *   Chunk.appendAll(Chunk.make("a", "b")),
                          *   Chunk.toArray
                          * ) // => [1, 2, "a", "b"]
                          * ```
                          *
                          * @see {@link prependAll} for concatenating chunks in the opposite order
                          * @see {@link append} for adding a single element to the end
                          *
                          * @category Utilities
                          * @since 1.0.0
                          */
    A | B>({ _tag: "IConcat",
            left: self,
            right: that });
    }
    else if (Diff < -1)
    {
        if (self.left.depth >= self.right.depth)
        {
            const Nr = appendAll(self.right, that);
            return MakeChunk({ _tag: "IConcat",
                left: self.left,
                right: Nr });
        }
        else
        {
            const Nrr = appendAll(self.right.right, that);
            if (Nrr.depth === self.depth - 3)
            {
                const NrValue = MakeChunk({ _tag: "IConcat",
                    left: self.right.left,
                    right: Nrr });
                return MakeChunk({ _tag: "IConcat",
                    left: self.left,
                    right: NrValue });
            }
            else
            {
                const Nl = MakeChunk({ _tag: "IConcat",
                    left: self.left,
                    right: self.right.left });
                return MakeChunk({ _tag: "IConcat",
                    left: Nl,
                    right: Nrr });
            }
        }
    }
    else
    {
        if (that.right.depth >= that.left.depth)
        {
            const NlValue = appendAll(self, that.left);
            return MakeChunk({ _tag: "IConcat",
                left: NlValue,
                right: that.right });
        }
        else
        {
            const Nll = appendAll(self, that.left.left);
            if (Nll.depth === that.depth - 3)
            {
                const NlValueValue = MakeChunk({ _tag: "IConcat",
                    left: Nll,
                    right: that.left.right });
                return MakeChunk({ _tag: "IConcat",
                    left: NlValueValue,
                    right: that.right });
            }
            else
            {
                const NrValueValue = MakeChunk({ _tag: "IConcat",
                    left: that.left.right,
                    right: that.right });
                return MakeChunk({ _tag: "IConcat",
                    left: Nll,
                    right: NrValueValue });
            }
        }
    }
});

/**
 * Returns a filtered and mapped subset of the elements.
 *
 * **Example** (Filtering and mapping values)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Result } from "effect"
 *
 * const chunk = Chunk.make("1", "2", "hello", "3", "world")
 * const numbers = Chunk.filterMap(chunk, (str) => {
 *   const num = parseInt(str)
 *   return isNaN(num) ? Result.failVoid : Result.succeed(num)
 * })
 * Chunk.toArray(numbers) // => [1, 2, 3]
 *
 * // With index parameter
 * const evenIndexNumbers = Chunk.filterMap(chunk, (str, i) => {
 *   const num = parseInt(str)
 *   return isNaN(num) || i % 2 !== 0 ? Result.failVoid : Result.succeed(num)
 * })
 * Chunk.toArray(evenIndexNumbers) // => [1]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filterMap: {
    /**
     * Returns a filtered and mapped subset of the elements.
     *
     * **Example** (Filtering and mapping values)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const chunk = Chunk.make("1", "2", "hello", "3", "world")
     * const numbers = Chunk.filterMap(chunk, (str) => {
     *   const num = parseInt(str)
     *   return isNaN(num) ? Result.failVoid : Result.succeed(num)
     * })
     * Chunk.toArray(numbers) // => [1, 2, 3]
     *
     * // With index parameter
     * const evenIndexNumbers = Chunk.filterMap(chunk, (str, i) => {
     *   const num = parseInt(str)
     *   return isNaN(num) || i % 2 !== 0 ? Result.failVoid : Result.succeed(num)
     * })
     * Chunk.toArray(evenIndexNumbers) // => [1]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, X>(f: (input: A, i: number) => Result<B, X>): (self: Chunk<A>) => Chunk<B>

    /**
     * Returns a filtered and mapped subset of the elements.
     *
     * **Example** (Filtering and mapping values)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const chunk = Chunk.make("1", "2", "hello", "3", "world")
     * const numbers = Chunk.filterMap(chunk, (str) => {
     *   const num = parseInt(str)
     *   return isNaN(num) ? Result.failVoid : Result.succeed(num)
     * })
     * Chunk.toArray(numbers) // => [1, 2, 3]
     *
     * // With index parameter
     * const evenIndexNumbers = Chunk.filterMap(chunk, (str, i) => {
     *   const num = parseInt(str)
     *   return isNaN(num) || i % 2 !== 0 ? Result.failVoid : Result.succeed(num)
     * })
     * Chunk.toArray(evenIndexNumbers) // => [1]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, X>(self: Chunk<A>, f: (input: A, i: number) => Result<B, X>): Chunk<B>
} = dual(
    2,
    <A, B, X>(self: Chunk<A>, f: (input: A, i: number) => Result<B, X>): Chunk<B> =>
    {
        const AsValueValue = toReadonlyArray(self);
        const Out: Array<B> = [];
        for (let i = 0; i < AsValueValue.length; i++)
        {
            const ResultValue = f(AsValueValue[i], i);
            if (R.isSuccess(ResultValue))
            {
                Out.push(ResultValue.success);
            }
        }

        return fromArrayUnsafe(Out);
    }
);

/**
 * Returns a filtered subset of the elements.
 *
 * **Example** (Filtering values)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
 * const evenNumbers = Chunk.filter(chunk, (n) => n % 2 === 0)
 * Chunk.toArray(evenNumbers) // => [2, 4, 6]
 *
 * // With refinement
 * const mixed = Chunk.make("hello", 42, "world", 100)
 * const numbers = Chunk.filter(mixed, (x): x is number => typeof x === "number")
 * Chunk.toArray(numbers) // => [42, 100]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filter: {
    /**
     * Returns a filtered subset of the elements.
     *
     * **Example** (Filtering values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const evenNumbers = Chunk.filter(chunk, (n) => n % 2 === 0)
     * Chunk.toArray(evenNumbers) // => [2, 4, 6]
     *
     * // With refinement
     * const mixed = Chunk.make("hello", 42, "world", 100)
     * const numbers = Chunk.filter(mixed, (x): x is number => typeof x === "number")
     * Chunk.toArray(numbers) // => [42, 100]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): (self: Chunk<A>) => Chunk<B>

    /**
     * Returns a filtered subset of the elements.
     *
     * **Example** (Filtering values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const evenNumbers = Chunk.filter(chunk, (n) => n % 2 === 0)
     * Chunk.toArray(evenNumbers) // => [2, 4, 6]
     *
     * // With refinement
     * const mixed = Chunk.make("hello", 42, "world", 100)
     * const numbers = Chunk.filter(mixed, (x): x is number => typeof x === "number")
     * Chunk.toArray(numbers) // => [42, 100]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => Chunk<A>

    /**
     * Returns a filtered subset of the elements.
     *
     * **Example** (Filtering values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const evenNumbers = Chunk.filter(chunk, (n) => n % 2 === 0)
     * Chunk.toArray(evenNumbers) // => [2, 4, 6]
     *
     * // With refinement
     * const mixed = Chunk.make("hello", 42, "world", 100)
     * const numbers = Chunk.filter(mixed, (x): x is number => typeof x === "number")
     * Chunk.toArray(numbers) // => [42, 100]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): Chunk<B>

    /**
     * Returns a filtered subset of the elements.
     *
     * **Example** (Filtering values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const evenNumbers = Chunk.filter(chunk, (n) => n % 2 === 0)
     * Chunk.toArray(evenNumbers) // => [2, 4, 6]
     *
     * // With refinement
     * const mixed = Chunk.make("hello", 42, "world", 100)
     * const numbers = Chunk.filter(mixed, (x): x is number => typeof x === "number")
     * Chunk.toArray(numbers) // => [42, 100]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A> => fromArrayUnsafe(RA.filter(toReadonlyArray(self), predicate))
);

/**
 * Transforms all elements of the chunk for as long as the specified function succeeds.
 *
 * **Example** (Filtering and mapping while values match)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Result } from "effect"
 *
 * const chunk = Chunk.make("1", "2", "hello", "3", "4")
 * Chunk.toArray(Chunk.filterMapWhile(chunk, (s) => {
 *   const n = Number(s)
 *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
 * })) // => [1, 2]
 *
 * Chunk.toArray(Chunk.filterMap(chunk, (s) => {
 *   const n = Number(s)
 *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
 * })) // => [1, 2, 3, 4]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filterMapWhile: {
    /**
     * Transforms all elements of the chunk for as long as the specified function succeeds.
     *
     * **Example** (Filtering and mapping while values match)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const chunk = Chunk.make("1", "2", "hello", "3", "4")
     * Chunk.toArray(Chunk.filterMapWhile(chunk, (s) => {
     *   const n = Number(s)
     *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
     * })) // => [1, 2]
     *
     * Chunk.toArray(Chunk.filterMap(chunk, (s) => {
     *   const n = Number(s)
     *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
     * })) // => [1, 2, 3, 4]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, X>(f: Filter.Filter<A, B, X>): (self: Chunk<A>) => Chunk<B>

    /**
     * Transforms all elements of the chunk for as long as the specified function succeeds.
     *
     * **Example** (Filtering and mapping while values match)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const chunk = Chunk.make("1", "2", "hello", "3", "4")
     * Chunk.toArray(Chunk.filterMapWhile(chunk, (s) => {
     *   const n = Number(s)
     *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
     * })) // => [1, 2]
     *
     * Chunk.toArray(Chunk.filterMap(chunk, (s) => {
     *   const n = Number(s)
     *   return Number.isNaN(n) ? Result.failVoid : Result.succeed(n)
     * })) // => [1, 2, 3, 4]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, X>(self: Chunk<A>, f: Filter.Filter<A, B, X>): Chunk<B>
} = dual(2, <A, B, X>(self: Chunk<A>, f: Filter.Filter<A, B, X>): Chunk<B> =>
{
    const OutValue: Array<B> = [];
    for (const AValue of self)
    {
        const ResultValueValue = f(AValue);
        if (R.isSuccess(ResultValueValue))
        {
            OutValue.push(ResultValueValue.success);
        }
        else
        {
            break;
        }
    }

    return fromArrayUnsafe(OutValue);
});

/**
 * Filters out optional values
 *
 * **Example** (Compacting optional values)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(Option.some(1), Option.none(), Option.some(3))
 * Chunk.toArray(Chunk.compact(chunk)) // => [1, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const compact = <A>(self: Chunk<Option<A>>): Chunk<A> =>
{
    const OutValueValue: Array<A> = [];
    for (const OptionValue of self)
    {
        if (O.isSome(OptionValue))
        {
            OutValueValue.push(OptionValue.value);
        }
    }

    return fromArrayUnsafe(OutValueValue);
};

/**
 * Applies a function to each element in a chunk and returns a new chunk containing the concatenated mapped elements.
 *
 * **Example** (Flat mapping chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3)
 * const duplicated = Chunk.flatMap(chunk, (n) => Chunk.make(n, n))
 * Chunk.toArray(duplicated) // => [1, 1, 2, 2, 3, 3]
 *
 * // Flattening nested arrays
 * const words = Chunk.make("hello", "world")
 * const letters = Chunk.flatMap(
 *   words,
 *   (word) => Chunk.fromIterable(word.split(""))
 * )
 * Chunk.toArray(letters).join("") // => "helloworld"
 *
 * // With index parameter
 * const indexed = Chunk.flatMap(chunk, (n, i) => Chunk.make(n + i))
 * Chunk.toArray(indexed) // => [1, 3, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const flatMap: {
    /**
     * Applies a function to each element in a chunk and returns a new chunk containing the concatenated mapped elements.
     *
     * **Example** (Flat mapping chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * const duplicated = Chunk.flatMap(chunk, (n) => Chunk.make(n, n))
     * Chunk.toArray(duplicated) // => [1, 1, 2, 2, 3, 3]
     *
     * // Flattening nested arrays
     * const words = Chunk.make("hello", "world")
     * const letters = Chunk.flatMap(
     *   words,
     *   (word) => Chunk.fromIterable(word.split(""))
     * )
     * Chunk.toArray(letters).join("") // => "helloworld"
     *
     * // With index parameter
     * const indexed = Chunk.flatMap(chunk, (n, i) => Chunk.make(n + i))
     * Chunk.toArray(indexed) // => [1, 3, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S extends Chunk<any>, T extends Chunk<any>>(f: (a: Chunk.Infer<S>, i: number) => T): (self: S) => Chunk.AndNonEmpty<S, T, Chunk.Infer<T>>

    /**
     * Applies a function to each element in a chunk and returns a new chunk containing the concatenated mapped elements.
     *
     * **Example** (Flat mapping chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * const duplicated = Chunk.flatMap(chunk, (n) => Chunk.make(n, n))
     * Chunk.toArray(duplicated) // => [1, 1, 2, 2, 3, 3]
     *
     * // Flattening nested arrays
     * const words = Chunk.make("hello", "world")
     * const letters = Chunk.flatMap(
     *   words,
     *   (word) => Chunk.fromIterable(word.split(""))
     * )
     * Chunk.toArray(letters).join("") // => "helloworld"
     *
     * // With index parameter
     * const indexed = Chunk.flatMap(chunk, (n, i) => Chunk.make(n + i))
     * Chunk.toArray(indexed) // => [1, 3, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: NonEmptyChunk<A>, f: (a: A, i: number) => NonEmptyChunk<B>): NonEmptyChunk<B>

    /**
     * Applies a function to each element in a chunk and returns a new chunk containing the concatenated mapped elements.
     *
     * **Example** (Flat mapping chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3)
     * const duplicated = Chunk.flatMap(chunk, (n) => Chunk.make(n, n))
     * Chunk.toArray(duplicated) // => [1, 1, 2, 2, 3, 3]
     *
     * // Flattening nested arrays
     * const words = Chunk.make("hello", "world")
     * const letters = Chunk.flatMap(
     *   words,
     *   (word) => Chunk.fromIterable(word.split(""))
     * )
     * Chunk.toArray(letters).join("") // => "helloworld"
     *
     * // With index parameter
     * const indexed = Chunk.flatMap(chunk, (n, i) => Chunk.make(n + i))
     * Chunk.toArray(indexed) // => [1, 3, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, f: (a: A, i: number) => Chunk<B>): Chunk<B>
} = dual(2, <A, B>(self: Chunk<A>, f: (a: A, i: number) => Chunk<B>) =>
{
    if (self.backing._tag === "ISingleton")
    {
        return f(self.backing.a, 0);
    }

    const AsValueValueValue = toReadonlyArray(self);
    const ChunksValue = new Array<Chunk<B>>(AsValueValueValue.length);
    for (let i = 0; i < AsValueValueValue.length; i++)
    {
        ChunksValue[i] = f(AsValueValueValue[i], i);
    }

    for (let step = 1; step < ChunksValue.length; step *= 2)
    {
        for (let i = 0; i + step < ChunksValue.length; i += 2 * step)
        {
            ChunksValue[i] = appendAll(ChunksValue[i], ChunksValue[i + step]);
        }
    }

    return ChunksValue.length === 0 ? EmptyValue : ChunksValue[0];
});

/**
 * Iterates over each element of a `Chunk` and applies a function to it.
 *
 * **Details**
 *
 * This function processes every element of the given `Chunk`, calling the
 * provided function `f` on each element. It does not return a new value;
 * instead, it is primarily used for side effects, such as logging or
 * accumulating data in an external variable.
 *
 * **Example** (Iterating over chunk values)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 *
 * const values: Array<string> = []
 * Chunk.forEach(chunk, (n) => values.push(`Value: ${n}`))
 * values // => ["Value: 1", "Value: 2", "Value: 3", "Value: 4"]
 *
 * // With index parameter
 * const indexed: Array<string> = []
 * Chunk.forEach(chunk, (n, i) => indexed.push(`Index ${i}: ${n}`))
 * indexed // => ["Index 0: 1", "Index 1: 2", "Index 2: 3", "Index 3: 4"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const forEach: {
    /**
     * Iterates over each element of a `Chunk` and applies a function to it.
     *
     * **Details**
     *
     * This function processes every element of the given `Chunk`, calling the
     * provided function `f` on each element. It does not return a new value;
     * instead, it is primarily used for side effects, such as logging or
     * accumulating data in an external variable.
     *
     * **Example** (Iterating over chunk values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     *
     * const values: Array<string> = []
     * Chunk.forEach(chunk, (n) => values.push(`Value: ${n}`))
     * values // => ["Value: 1", "Value: 2", "Value: 3", "Value: 4"]
     *
     * // With index parameter
     * const indexed: Array<string> = []
     * Chunk.forEach(chunk, (n, i) => indexed.push(`Index ${i}: ${n}`))
     * indexed // => ["Index 0: 1", "Index 1: 2", "Index 2: 3", "Index 3: 4"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(f: (a: A, index: number) => B): (self: Chunk<A>) => void

    /**
     * Iterates over each element of a `Chunk` and applies a function to it.
     *
     * **Details**
     *
     * This function processes every element of the given `Chunk`, calling the
     * provided function `f` on each element. It does not return a new value;
     * instead, it is primarily used for side effects, such as logging or
     * accumulating data in an external variable.
     *
     * **Example** (Iterating over chunk values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     *
     * const values: Array<string> = []
     * Chunk.forEach(chunk, (n) => values.push(`Value: ${n}`))
     * values // => ["Value: 1", "Value: 2", "Value: 3", "Value: 4"]
     *
     * // With index parameter
     * const indexed: Array<string> = []
     * Chunk.forEach(chunk, (n, i) => indexed.push(`Index ${i}: ${n}`))
     * indexed // => ["Index 0: 1", "Index 1: 2", "Index 2: 3", "Index 3: 4"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, f: (a: A, index: number) => B): void
} = dual(2, <A, B>(self: Chunk<A>, f: (a: A) => B): void => toReadonlyArray(self).forEach(f));

/**
 * Flattens a chunk of chunks into a single chunk by concatenating all chunks.
 *
 * **Example** (Flattening nested chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nested = Chunk.make(
 *   Chunk.make(1, 2),
 *   Chunk.make(3, 4, 5),
 *   Chunk.make(6)
 * )
 * Chunk.toArray(Chunk.flatten(nested)) // => [1, 2, 3, 4, 5, 6]
 *
 * // With empty chunks
 * const withEmpty = Chunk.make(
 *   Chunk.make(1, 2),
 *   Chunk.empty<number>(),
 *   Chunk.make(3, 4)
 * )
 * Chunk.toArray(Chunk.flatten(withEmpty)) // => [1, 2, 3, 4]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const flatten: <S extends Chunk<Chunk<any>>>(self: S) => Chunk.Flatten<S> = flatMap(identity) as any;

/**
 * Groups elements in chunks of up to `n` elements.
 *
 * **When to use**
 *
 * Use to divide a chunk into ordered, non-overlapping chunks with at most `n`
 * elements each.
 *
 * **Details**
 *
 * `n` is rounded down and normalized to at least `1`. The final chunk may
 * contain fewer than `n` elements. Empty input produces an empty chunk of
 * chunks.
 *
 * **Gotchas**
 *
 * `NaN` and values of `n` less than or equal to zero produce singleton chunks.
 *
 * **Example** (Splitting into fixed-size chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
 * const chunked = Chunk.chunksOf(chunk, 3)
 *
 * Chunk.toArray(chunked).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
 *
 * // When length is not evenly divisible
 * const chunk2 = Chunk.make(1, 2, 3, 4, 5)
 * const chunked2 = Chunk.chunksOf(chunk2, 2)
 * Chunk.toArray(chunked2).map(Chunk.toArray) // => [[1, 2], [3, 4], [5]]
 * ```
 *
 * @see {@link split} for splitting into a target number of chunks instead of a fixed chunk size
 *
 * @category Utilities
 * @since 1.0.0
 */
export const chunksOf: {
    /**
     * Groups elements in chunks of up to `n` elements.
     *
     * **When to use**
     *
     * Use to divide a chunk into ordered, non-overlapping chunks with at most `n`
     * elements each.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`. The final chunk may
     * contain fewer than `n` elements. Empty input produces an empty chunk of
     * chunks.
     *
     * **Gotchas**
     *
     * `NaN` and values of `n` less than or equal to zero produce singleton chunks.
     *
     * **Example** (Splitting into fixed-size chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
     * const chunked = Chunk.chunksOf(chunk, 3)
     *
     * Chunk.toArray(chunked).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
     *
     * // When length is not evenly divisible
     * const chunk2 = Chunk.make(1, 2, 3, 4, 5)
     * const chunked2 = Chunk.chunksOf(chunk2, 2)
     * Chunk.toArray(chunked2).map(Chunk.toArray) // => [[1, 2], [3, 4], [5]]
     * ```
     *
     * @see {@link split} for splitting into a target number of chunks instead of a fixed chunk size
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<Chunk<A>>

    /**
     * Groups elements in chunks of up to `n` elements.
     *
     * **When to use**
     *
     * Use to divide a chunk into ordered, non-overlapping chunks with at most `n`
     * elements each.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`. The final chunk may
     * contain fewer than `n` elements. Empty input produces an empty chunk of
     * chunks.
     *
     * **Gotchas**
     *
     * `NaN` and values of `n` less than or equal to zero produce singleton chunks.
     *
     * **Example** (Splitting into fixed-size chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
     * const chunked = Chunk.chunksOf(chunk, 3)
     *
     * Chunk.toArray(chunked).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
     *
     * // When length is not evenly divisible
     * const chunk2 = Chunk.make(1, 2, 3, 4, 5)
     * const chunked2 = Chunk.chunksOf(chunk2, 2)
     * Chunk.toArray(chunked2).map(Chunk.toArray) // => [[1, 2], [3, 4], [5]]
     * ```
     *
     * @see {@link split} for splitting into a target number of chunks instead of a fixed chunk size
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<Chunk<A>>
} = dual(2, <A>(self: Chunk<A>, n: number) =>
{
    const Size = Count.normalizeNonEmpty(n);
    const Gr: Array<Chunk<A>> = [];
    let current: Array<A> = [];
    toReadonlyArray(self).forEach((a) =>
    {
        current.push(a);
        if (current.length >= Size)
        {
            Gr.push(fromArrayUnsafe(current));
            current = [];
        }
    });
    if (current.length > 0)
    {
        Gr.push(fromArrayUnsafe(current));
    }

    return fromArrayUnsafe(Gr);
});

/**
 * Creates a `Chunk` of values that are included in both chunks.
 *
 * **Details**
 *
 * The order and references of result values are determined by the first chunk.
 *
 * **Example** (Intersecting chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk1 = Chunk.make(1, 2, 3, 4)
 * const chunk2 = Chunk.make(3, 4, 5, 6)
 * Chunk.toArray(Chunk.intersection(chunk1, chunk2)) // => [3, 4]
 *
 * // With strings
 * const words1 = Chunk.make("hello", "world", "foo")
 * const words2 = Chunk.make("world", "bar", "foo")
 * Chunk.toArray(Chunk.intersection(words1, words2)) // => ["world", "foo"]
 *
 * // No intersection
 * const chunk3 = Chunk.make(1, 2)
 * const chunk4 = Chunk.make(3, 4)
 * Chunk.toArray(Chunk.intersection(chunk3, chunk4)) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const intersection: {
    /**
     * Creates a `Chunk` of values that are included in both chunks.
     *
     * **Details**
     *
     * The order and references of result values are determined by the first chunk.
     *
     * **Example** (Intersecting chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3, 4)
     * const chunk2 = Chunk.make(3, 4, 5, 6)
     * Chunk.toArray(Chunk.intersection(chunk1, chunk2)) // => [3, 4]
     *
     * // With strings
     * const words1 = Chunk.make("hello", "world", "foo")
     * const words2 = Chunk.make("world", "bar", "foo")
     * Chunk.toArray(Chunk.intersection(words1, words2)) // => ["world", "foo"]
     *
     * // No intersection
     * const chunk3 = Chunk.make(1, 2)
     * const chunk4 = Chunk.make(3, 4)
     * Chunk.toArray(Chunk.intersection(chunk3, chunk4)) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(that: Chunk<A>): <B>(self: Chunk<B>) => Chunk<A & B>

    /**
     * Creates a `Chunk` of values that are included in both chunks.
     *
     * **Details**
     *
     * The order and references of result values are determined by the first chunk.
     *
     * **Example** (Intersecting chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3, 4)
     * const chunk2 = Chunk.make(3, 4, 5, 6)
     * Chunk.toArray(Chunk.intersection(chunk1, chunk2)) // => [3, 4]
     *
     * // With strings
     * const words1 = Chunk.make("hello", "world", "foo")
     * const words2 = Chunk.make("world", "bar", "foo")
     * Chunk.toArray(Chunk.intersection(words1, words2)) // => ["world", "foo"]
     *
     * // No intersection
     * const chunk3 = Chunk.make(1, 2)
     * const chunk4 = Chunk.make(3, 4)
     * Chunk.toArray(Chunk.intersection(chunk3, chunk4)) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A & B>
} = dual(
    2,
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A & B> =>
        fromArrayUnsafe(RA.intersection(toReadonlyArray(self), toReadonlyArray(that)))
);

/**
 * Determines if the chunk is empty.
 *
 * **Example** (Checking for empty chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.isEmpty(Chunk.empty()) // => true
 * Chunk.isEmpty(Chunk.make(1, 2, 3)) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isEmpty = <A>(self: Chunk<A>): boolean => self.length === 0;

/**
 * Determines if the chunk is not empty.
 *
 * **Example** (Checking for non-empty chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.isNonEmpty(Chunk.empty()) // => false
 * Chunk.isNonEmpty(Chunk.make(1, 2, 3)) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isNonEmpty = <A>(self: Chunk<A>): self is NonEmptyChunk<A> => self.length > 0;

/**
 * Returns the first element of this chunk safely if it exists.
 *
 * **Example** (Getting the first element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * Chunk.head(Chunk.empty()) // => Option.none()
 * Chunk.head(Chunk.make(1, 2, 3)) // => Option.some(1)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const head: <A>(self: Chunk<A>) => Option<A> = get(0);

/**
 * Returns the first element of this chunk.
 *
 * **When to use**
 *
 * Use when you know the chunk is non-empty and need the first element directly
 * without handling `Option.none`.
 *
 * **Gotchas**
 *
 * Throws an error if the chunk is empty.
 *
 * **Example** (Getting the first element unsafely)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 * Chunk.headUnsafe(chunk) // => 1
 *
 * const singleElement = Chunk.make("hello")
 * Chunk.headUnsafe(singleElement) // => "hello"
 *
 * // Use Chunk.head when the chunk may be empty
 * Option.isNone(Chunk.head(Chunk.empty())) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const headUnsafe = <A>(self: Chunk<A>): A => getUnsafe(self, 0);

/**
 * Returns the first element of this non empty chunk.
 *
 * **Example** (Getting the first element of a non-empty chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nonEmptyChunk = Chunk.make(1, 2, 3, 4)
 * Chunk.headNonEmpty(nonEmptyChunk) // => 1
 *
 * const singleElement = Chunk.make("hello")
 * Chunk.headNonEmpty(singleElement) // => "hello"
 *
 * // Type safety: this function only accepts NonEmptyChunk
 * // Chunk.headNonEmpty(Chunk.empty()) // TypeScript error
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const headNonEmpty: <A>(self: NonEmptyChunk<A>) => A = headUnsafe;

/**
 * Returns the last element of this chunk safely if it exists.
 *
 * **Example** (Getting the last element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * Chunk.last(Chunk.empty()) // => Option.none()
 * Chunk.last(Chunk.make(1, 2, 3)) // => Option.some(3)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const last = <A>(self: Chunk<A>): Option<A> => get(self, self.length - 1);

/**
 * Returns the last element of this chunk.
 *
 * **When to use**
 *
 * Use when you know the chunk is non-empty and need the last element directly
 * without handling `Option.none`.
 *
 * **Gotchas**
 *
 * Throws an error if the chunk is empty.
 *
 * **Example** (Getting the last element unsafely)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 * Chunk.lastUnsafe(chunk) // => 4
 *
 * const singleElement = Chunk.make("hello")
 * Chunk.lastUnsafe(singleElement) // => "hello"
 *
 * // Use Chunk.last when the chunk may be empty
 * Option.isNone(Chunk.last(Chunk.empty())) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const lastUnsafe = <A>(self: Chunk<A>): A => getUnsafe(self, self.length - 1);

/**
 * Returns the last element of this non empty chunk.
 *
 * **Example** (Getting the last element of a non-empty chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nonEmptyChunk = Chunk.make(1, 2, 3, 4)
 * Chunk.lastNonEmpty(nonEmptyChunk) // => 4
 *
 * const singleElement = Chunk.make("hello")
 * Chunk.lastNonEmpty(singleElement) // => "hello"
 *
 * // Type safety: this function only accepts NonEmptyChunk
 * // Chunk.lastNonEmpty(Chunk.empty()) // TypeScript error
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const lastNonEmpty: <A>(self: NonEmptyChunk<A>) => A = lastUnsafe;

/**
 * A namespace containing utility types for Chunk operations.
 *
 * **Example** (Working with Chunk utility types)
 *
 * ```ts import.meta.vitest
 * import type { Chunk } from "effect"
 *
 * // Extract the element type from a Chunk
 * declare const chunk: Chunk.Chunk<string>
 * type ElementType = Chunk.Chunk.Infer<typeof chunk> // string
 *
 * // Create a preserving non-emptiness
 * declare const nonEmptyChunk: Chunk.NonEmptyChunk<number>
 * type WithString = Chunk.Chunk.With<typeof nonEmptyChunk, string> // Chunk.NonEmptyChunk<string>
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Chunk
{
    /**
     * Infers the element type of a Chunk.
     *
     * **Example** (Inferring element types)
     *
     * ```ts import.meta.vitest
     * import type { Chunk } from "effect"
     *
     * declare const numberChunk: Chunk.Chunk<number>
     * declare const stringChunk: Chunk.Chunk<string>
     *
     * type NumberType = Chunk.Chunk.Infer<typeof numberChunk> // number
     * type StringType = Chunk.Chunk.Infer<typeof stringChunk> // string
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type Infer<S extends Chunk<any>> = S extends Chunk<infer A> ? A : never;

    /**
     * Constructs a Chunk type preserving non-emptiness.
     *
     * **Example** (Preserving non-emptiness)
     *
     * ```ts import.meta.vitest
     * import type { Chunk } from "effect"
     *
     * declare const regularChunk: Chunk.Chunk<number>
     * declare const nonEmptyChunk: Chunk.NonEmptyChunk<number>
     *
     * type WithString1 = Chunk.Chunk.With<typeof regularChunk, string> // Chunk.Chunk<string>
     * type WithString2 = Chunk.Chunk.With<typeof nonEmptyChunk, string> // Chunk.NonEmptyChunk<string>
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type With<S extends Chunk<any>, A> = S extends NonEmptyChunk<any> ? NonEmptyChunk<A> : Chunk<A>;

    /**
     * Creates a non-empty Chunk if either input is non-empty.
     *
     * **Example** (Preserving non-emptiness from either input)
     *
     * ```ts import.meta.vitest
     * import type { Chunk } from "effect"
     *
     * declare const emptyChunk: Chunk.Chunk<number>
     * declare const nonEmptyChunk: Chunk.NonEmptyChunk<number>
     *
     * type Result1 = Chunk.Chunk.OrNonEmpty<
     *   typeof emptyChunk,
     *   typeof emptyChunk,
     *   string
     * > // Chunk.Chunk<string>
     * type Result2 = Chunk.Chunk.OrNonEmpty<
     *   typeof emptyChunk,
     *   typeof nonEmptyChunk,
     *   string
     * > // Chunk.NonEmptyChunk<string>
     * type Result3 = Chunk.Chunk.OrNonEmpty<
     *   typeof nonEmptyChunk,
     *   typeof emptyChunk,
     *   string
     * > // Chunk.NonEmptyChunk<string>
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type OrNonEmpty<S extends Chunk<any>, T extends Chunk<any>, A> = S extends NonEmptyChunk<any> ?
        NonEmptyChunk<A>
        : T extends NonEmptyChunk<any> ? NonEmptyChunk<A>
            : Chunk<A>;

    /**
     * Creates a non-empty Chunk only if both inputs are non-empty.
     *
     * **Example** (Requiring non-emptiness from both inputs)
     *
     * ```ts import.meta.vitest
     * import type { Chunk } from "effect"
     *
     * declare const emptyChunk: Chunk.Chunk<number>
     * declare const nonEmptyChunk: Chunk.NonEmptyChunk<number>
     *
     * type Result1 = Chunk.Chunk.AndNonEmpty<
     *   typeof emptyChunk,
     *   typeof emptyChunk,
     *   string
     * > // Chunk.Chunk<string>
     * type Result2 = Chunk.Chunk.AndNonEmpty<
     *   typeof emptyChunk,
     *   typeof nonEmptyChunk,
     *   string
     * > // Chunk.Chunk<string>
     * type Result3 = Chunk.Chunk.AndNonEmpty<
     *   typeof nonEmptyChunk,
     *   typeof nonEmptyChunk,
     *   string
     * > // Chunk.NonEmptyChunk<string>
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type AndNonEmpty<S extends Chunk<any>, T extends Chunk<any>, A> = S extends NonEmptyChunk<any> ?
        T extends NonEmptyChunk<any> ? NonEmptyChunk<A>
            : Chunk<A> :
        Chunk<A>;

    /**
     * Flattens a nested Chunk type.
     *
     * **Example** (Flattening nested chunk types)
     *
     * ```ts import.meta.vitest
     * import type { Chunk } from "effect"
     *
     * declare const nestedChunk: Chunk.Chunk<Chunk.Chunk<number>>
     * declare const nestedNonEmpty: Chunk.NonEmptyChunk<Chunk.NonEmptyChunk<string>>
     *
     * type Flattened1 = Chunk.Chunk.Flatten<typeof nestedChunk> // Chunk.Chunk<number>
     * type Flattened2 = Chunk.Chunk.Flatten<typeof nestedNonEmpty> // Chunk.NonEmptyChunk<string>
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type Flatten<T extends Chunk<Chunk<any>>> = T extends NonEmptyChunk<NonEmptyChunk<infer A>> ? NonEmptyChunk<A>
        : T extends Chunk<Chunk<infer A>> ? Chunk<A>
            : never;
}

/**
 * Transforms the elements of a chunk using the specified mapping function.
 * If the input chunk is non-empty, the resulting chunk will also be non-empty.
 *
 * **Example** (Mapping values)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.map(Chunk.make(1, 2), (n) => n + 1)) // => [2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const map: {
    /**
     * Transforms the elements of a chunk using the specified mapping function.
     * If the input chunk is non-empty, the resulting chunk will also be non-empty.
     *
     * **Example** (Mapping values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.toArray(Chunk.map(Chunk.make(1, 2), (n) => n + 1)) // => [2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S extends Chunk<any>, B>(f: (a: Chunk.Infer<S>, i: number) => B): (self: S) => Chunk.With<S, B>

    /**
     * Transforms the elements of a chunk using the specified mapping function.
     * If the input chunk is non-empty, the resulting chunk will also be non-empty.
     *
     * **Example** (Mapping values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.toArray(Chunk.map(Chunk.make(1, 2), (n) => n + 1)) // => [2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: NonEmptyChunk<A>, f: (a: A, i: number) => B): NonEmptyChunk<B>

    /**
     * Transforms the elements of a chunk using the specified mapping function.
     * If the input chunk is non-empty, the resulting chunk will also be non-empty.
     *
     * **Example** (Mapping values)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.toArray(Chunk.map(Chunk.make(1, 2), (n) => n + 1)) // => [2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, f: (a: A, i: number) => B): Chunk<B>
} = dual(2, <A, B>(self: Chunk<A>, f: (a: A, i: number) => B): Chunk<B> =>
    self.backing._tag === "ISingleton" ?
        of(f(self.backing.a, 0)) :
        fromArrayUnsafe(pipe(toReadonlyArray(self), RA.map((a, i) => f(a, i)))));

/**
 * Maps over the chunk statefully, producing new elements of type `B`.
 *
 * **Example** (Mapping with accumulated state)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * const [finalState, mapped] = Chunk.mapAccum(chunk, 0, (state, current) => [
 *   state + current, // accumulate sum
 *   state + current // output running sum
 * ])
 *
 * finalState // => 15
 * Chunk.toArray(mapped) // => [1, 3, 6, 10, 15]
 *
 * // Building a string with indices
 * const words = Chunk.make("hello", "world", "effect")
 * const [count, indexed] = Chunk.mapAccum(words, 0, (index, word) => [
 *   index + 1,
 *   `${index}: ${word}`
 * ])
 * count // => 3
 * Chunk.toArray(indexed) // => ["0: hello", "1: world", "2: effect"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mapAccum: {
    /**
     * Maps over the chunk statefully, producing new elements of type `B`.
     *
     * **Example** (Mapping with accumulated state)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * const [finalState, mapped] = Chunk.mapAccum(chunk, 0, (state, current) => [
     *   state + current, // accumulate sum
     *   state + current // output running sum
     * ])
     *
     * finalState // => 15
     * Chunk.toArray(mapped) // => [1, 3, 6, 10, 15]
     *
     * // Building a string with indices
     * const words = Chunk.make("hello", "world", "effect")
     * const [count, indexed] = Chunk.mapAccum(words, 0, (index, word) => [
     *   index + 1,
     *   `${index}: ${word}`
     * ])
     * count // => 3
     * Chunk.toArray(indexed) // => ["0: hello", "1: world", "2: effect"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S, A, B>(s: S, f: (s: S, a: A) => readonly [S, B]): (self: Chunk<A>) => [S, Chunk<B>]

    /**
     * Maps over the chunk statefully, producing new elements of type `B`.
     *
     * **Example** (Mapping with accumulated state)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * const [finalState, mapped] = Chunk.mapAccum(chunk, 0, (state, current) => [
     *   state + current, // accumulate sum
     *   state + current // output running sum
     * ])
     *
     * finalState // => 15
     * Chunk.toArray(mapped) // => [1, 3, 6, 10, 15]
     *
     * // Building a string with indices
     * const words = Chunk.make("hello", "world", "effect")
     * const [count, indexed] = Chunk.mapAccum(words, 0, (index, word) => [
     *   index + 1,
     *   `${index}: ${word}`
     * ])
     * count // => 3
     * Chunk.toArray(indexed) // => ["0: hello", "1: world", "2: effect"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <S, A, B>(self: Chunk<A>, s: S, f: (s: S, a: A) => readonly [S, B]): [S, Chunk<B>]
} = dual(3, <S, A, B>(self: Chunk<A>, s: S, f: (s: S, a: A) => readonly [S, B]): [S, Chunk<B>] =>
{
    const [ S1, AsValueValueValueValueValueValue ] = RA.mapAccum(self, s, f);
    return [ S1, fromArrayUnsafe(AsValueValueValueValueValueValue) ];
});

/**
 * Splits a chunk using a `Filter` into successes and failures.
 *
 * **Details**
 *
 * Returns `[passes, fails]`. The filter receives `(element, index)`.
 *
 * **Example** (Partitioning with a Result)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Result } from "effect"
 *
 * const [passes, fails] = Chunk.partition(Chunk.make(1, -2, 3), (n, i) =>
 *   n > 0 ? Result.succeed(n + i) : Result.fail(`negative:${n}`)
 * )
 *
 * Chunk.toArray(passes) // => [1, 5]
 * Chunk.toArray(fails) // => ["negative:-2"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const partition: {
    /**
     * Splits a chunk using a `Filter` into successes and failures.
     *
     * **Details**
     *
     * Returns `[passes, fails]`. The filter receives `(element, index)`.
     *
     * **Example** (Partitioning with a Result)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const [passes, fails] = Chunk.partition(Chunk.make(1, -2, 3), (n, i) =>
     *   n > 0 ? Result.succeed(n + i) : Result.fail(`negative:${n}`)
     * )
     *
     * Chunk.toArray(passes) // => [1, 5]
     * Chunk.toArray(fails) // => ["negative:-2"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, Pass, Fail>(f: (input: NoInfer<A>, i: number) => Result<Pass, Fail>): (self: Chunk<A>) => [passes: Chunk<Pass>, fails: Chunk<Fail>]

    /**
     * Splits a chunk using a `Filter` into successes and failures.
     *
     * **Details**
     *
     * Returns `[passes, fails]`. The filter receives `(element, index)`.
     *
     * **Example** (Partitioning with a Result)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Result } from "effect"
     *
     * const [passes, fails] = Chunk.partition(Chunk.make(1, -2, 3), (n, i) =>
     *   n > 0 ? Result.succeed(n + i) : Result.fail(`negative:${n}`)
     * )
     *
     * Chunk.toArray(passes) // => [1, 5]
     * Chunk.toArray(fails) // => ["negative:-2"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, Pass, Fail>(self: Chunk<A>, f: (input: A, i: number) => Result<Pass, Fail>): [passes: Chunk<Pass>, fails: Chunk<Fail>]
} = dual(
    2,
    <A, Pass, Fail>(
        self: Chunk<A>,
        f: (input: A, i: number) => Result<Pass, Fail>
    ): [passes: Chunk<Pass>, fails: Chunk<Fail>] =>
    {
        const [ Passes, Fails ] = RA.partition(self, f);
        return [ fromArrayUnsafe(Passes), fromArrayUnsafe(Fails) ];
    }
);

/**
 * Separates a chunk of `Result` values into a chunk of successes and a chunk of
 * failures.
 *
 * **Details**
 *
 * The returned tuple is `[successes, failures]`, preserving the original order
 * within each side.
 *
 * **Example** (Separating successes and failures)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Result } from "effect"
 *
 * const chunk = Chunk.make(
 *   Result.succeed(1),
 *   Result.fail("error1"),
 *   Result.succeed(2),
 *   Result.fail("error2"),
 *   Result.succeed(3)
 * )
 *
 * const [values, errors] = Chunk.separate(chunk)
 * Chunk.toArray(values) // => [1, 2, 3]
 * Chunk.toArray(errors) // => ["error1", "error2"]
 *
 * // All successes
 * const allSuccesses = Chunk.make(Result.succeed(1), Result.succeed(2))
 * const [allValues, noErrors] = Chunk.separate(allSuccesses)
 * Chunk.toArray(allValues) // => [1, 2]
 * Chunk.toArray(noErrors) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const separate = <A, B>(self: Chunk<Result<B, A>>): [Chunk<B>, Chunk<A>] =>
    pipe(
        RA.separate(toReadonlyArray(self)),
        ([ L, RValue ]) => [ fromArrayUnsafe(L), fromArrayUnsafe(RValue) ]
    );

/**
 * Retrieves the size of the chunk.
 *
 * **Example** (Getting chunk size)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.size(Chunk.make(1, 2, 3)) // => 3
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const size = <A>(self: Chunk<A>): number => self.length;

/**
 * Sorts the elements of a `Chunk` in increasing order, creating a new `Chunk`.
 *
 * **Example** (Sorting chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Order } from "effect"
 *
 * const numbers = Chunk.make(3, 1, 4, 1, 5, 9, 2, 6)
 * Chunk.toArray(Chunk.sort(numbers, Order.Number)) // => [1, 1, 2, 3, 4, 5, 6, 9]
 *
 * // Reverse order
 * Chunk.toArray(Chunk.sort(numbers, Order.flip(Order.Number))) // => [9, 6, 5, 4, 3, 2, 1, 1]
 *
 * // String sorting
 * const words = Chunk.make("banana", "apple", "cherry")
 * Chunk.toArray(Chunk.sort(words, Order.String)) // => ["apple", "banana", "cherry"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sort: {
    /**
     * Sorts the elements of a `Chunk` in increasing order, creating a new `Chunk`.
     *
     * **Example** (Sorting chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Order } from "effect"
     *
     * const numbers = Chunk.make(3, 1, 4, 1, 5, 9, 2, 6)
     * Chunk.toArray(Chunk.sort(numbers, Order.Number)) // => [1, 1, 2, 3, 4, 5, 6, 9]
     *
     * // Reverse order
     * Chunk.toArray(Chunk.sort(numbers, Order.flip(Order.Number))) // => [9, 6, 5, 4, 3, 2, 1, 1]
     *
     * // String sorting
     * const words = Chunk.make("banana", "apple", "cherry")
     * Chunk.toArray(Chunk.sort(words, Order.String)) // => ["apple", "banana", "cherry"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B>(O: Order.Order<B>): <A extends B>(self: Chunk<A>) => Chunk<A>

    /**
     * Sorts the elements of a `Chunk` in increasing order, creating a new `Chunk`.
     *
     * **Example** (Sorting chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Order } from "effect"
     *
     * const numbers = Chunk.make(3, 1, 4, 1, 5, 9, 2, 6)
     * Chunk.toArray(Chunk.sort(numbers, Order.Number)) // => [1, 1, 2, 3, 4, 5, 6, 9]
     *
     * // Reverse order
     * Chunk.toArray(Chunk.sort(numbers, Order.flip(Order.Number))) // => [9, 6, 5, 4, 3, 2, 1, 1]
     *
     * // String sorting
     * const words = Chunk.make("banana", "apple", "cherry")
     * Chunk.toArray(Chunk.sort(words, Order.String)) // => ["apple", "banana", "cherry"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A extends B, B>(self: Chunk<A>, O: Order.Order<B>): Chunk<A>
} = dual(
    2,
    <A extends B, B>(self: Chunk<A>, O: Order.Order<B>): Chunk<A> => fromArrayUnsafe(RA.sort(toReadonlyArray(self), O))
);

/**
 * Sorts the elements of a `Chunk` based on a projection function.
 *
 * **Example** (Sorting chunks by a derived value)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Order } from "effect"
 *
 * const people = Chunk.make(
 *   { name: "Alice", age: 30 },
 *   { name: "Bob", age: 25 },
 *   { name: "Charlie", age: 35 }
 * )
 *
 * // Sort by age
 * const byAge = Chunk.sortWith(people, (person) => person.age, Order.Number)
 * Chunk.toArray(byAge).map((person) => person.name) // => ["Bob", "Alice", "Charlie"]
 *
 * // Sort by name
 * const byName = Chunk.sortWith(people, (person) => person.name, Order.String)
 * Chunk.toArray(byName).map((person) => person.name) // => ["Alice", "Bob", "Charlie"]
 *
 * // Sort by string length
 * const words = Chunk.make("a", "abc", "ab")
 * Chunk.toArray(Chunk.sortWith(words, (word) => word.length, Order.Number)) // => ["a", "ab", "abc"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sortWith: {
    /**
     * Sorts the elements of a `Chunk` based on a projection function.
     *
     * **Example** (Sorting chunks by a derived value)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Order } from "effect"
     *
     * const people = Chunk.make(
     *   { name: "Alice", age: 30 },
     *   { name: "Bob", age: 25 },
     *   { name: "Charlie", age: 35 }
     * )
     *
     * // Sort by age
     * const byAge = Chunk.sortWith(people, (person) => person.age, Order.Number)
     * Chunk.toArray(byAge).map((person) => person.name) // => ["Bob", "Alice", "Charlie"]
     *
     * // Sort by name
     * const byName = Chunk.sortWith(people, (person) => person.name, Order.String)
     * Chunk.toArray(byName).map((person) => person.name) // => ["Alice", "Bob", "Charlie"]
     *
     * // Sort by string length
     * const words = Chunk.make("a", "abc", "ab")
     * Chunk.toArray(Chunk.sortWith(words, (word) => word.length, Order.Number)) // => ["a", "ab", "abc"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(f: (a: A) => B, order: Order.Order<B>): (self: Chunk<A>) => Chunk<A>

    /**
     * Sorts the elements of a `Chunk` based on a projection function.
     *
     * **Example** (Sorting chunks by a derived value)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Order } from "effect"
     *
     * const people = Chunk.make(
     *   { name: "Alice", age: 30 },
     *   { name: "Bob", age: 25 },
     *   { name: "Charlie", age: 35 }
     * )
     *
     * // Sort by age
     * const byAge = Chunk.sortWith(people, (person) => person.age, Order.Number)
     * Chunk.toArray(byAge).map((person) => person.name) // => ["Bob", "Alice", "Charlie"]
     *
     * // Sort by name
     * const byName = Chunk.sortWith(people, (person) => person.name, Order.String)
     * Chunk.toArray(byName).map((person) => person.name) // => ["Alice", "Bob", "Charlie"]
     *
     * // Sort by string length
     * const words = Chunk.make("a", "abc", "ab")
     * Chunk.toArray(Chunk.sortWith(words, (word) => word.length, Order.Number)) // => ["a", "ab", "abc"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, f: (a: A) => B, order: Order.Order<B>): Chunk<A>
} = dual(
    3,
    <A, B>(self: Chunk<A>, f: (a: A) => B, order: Order.Order<B>): Chunk<A> => sort(self, Order.mapInput(order, f))
);

/**
 *  Returns two splits of this chunk at the specified index.
 *
 * **Example** (Splitting at an index)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
 * const [before, after] = Chunk.splitAt(chunk, 3)
 * Chunk.toArray(before) // => [1, 2, 3]
 * Chunk.toArray(after) // => [4, 5, 6]
 *
 * // Split at index 0
 * const [empty, all] = Chunk.splitAt(chunk, 0)
 * Chunk.toArray(empty) // => []
 * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
 *
 * // Split beyond length
 * const [allElements, empty2] = Chunk.splitAt(chunk, 10)
 * Chunk.toArray(allElements) // => [1, 2, 3, 4, 5, 6]
 * Chunk.toArray(empty2) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const splitAt: {
    /**
     *  Returns two splits of this chunk at the specified index.
     *
     * **Example** (Splitting at an index)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, after] = Chunk.splitAt(chunk, 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(after) // => [4, 5, 6]
     *
     * // Split at index 0
     * const [empty, all] = Chunk.splitAt(chunk, 0)
     * Chunk.toArray(empty) // => []
     * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
     *
     * // Split beyond length
     * const [allElements, empty2] = Chunk.splitAt(chunk, 10)
     * Chunk.toArray(allElements) // => [1, 2, 3, 4, 5, 6]
     * Chunk.toArray(empty2) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => [beforeIndex: Chunk<A>, fromIndex: Chunk<A>]

    /**
     *  Returns two splits of this chunk at the specified index.
     *
     * **Example** (Splitting at an index)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, after] = Chunk.splitAt(chunk, 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(after) // => [4, 5, 6]
     *
     * // Split at index 0
     * const [empty, all] = Chunk.splitAt(chunk, 0)
     * Chunk.toArray(empty) // => []
     * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
     *
     * // Split beyond length
     * const [allElements, empty2] = Chunk.splitAt(chunk, 10)
     * Chunk.toArray(allElements) // => [1, 2, 3, 4, 5, 6]
     * Chunk.toArray(empty2) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): [beforeIndex: Chunk<A>, fromIndex: Chunk<A>]
} = dual(2, <A>(self: Chunk<A>, n: number): [Chunk<A>, Chunk<A>] => [ take(self, n), drop(self, n) ]);

/**
 * Splits a `NonEmptyChunk` at `n`, returning a non-empty prefix and the
 * remaining suffix.
 *
 * **Details**
 *
 * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
 * `1`. If `n` is greater than or equal to the chunk length, the first result is
 * the original chunk and the second result is empty.
 *
 * **Example** (Splitting non-empty chunks at an index)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nonEmptyChunk = Chunk.make(1, 2, 3, 4, 5, 6)
 * const [before, after] = Chunk.splitNonEmptyAt(nonEmptyChunk, 3)
 * Chunk.toArray(before) // => [1, 2, 3]
 * Chunk.toArray(after) // => [4, 5, 6]
 *
 * // Split at 1 (minimum)
 * const [first, rest] = Chunk.splitNonEmptyAt(nonEmptyChunk, 1)
 * Chunk.toArray(first) // => [1]
 * Chunk.toArray(rest) // => [2, 3, 4, 5, 6]
 *
 * // The first part is guaranteed to be NonEmptyChunk
 * // while the second part may be empty
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const splitNonEmptyAt: {
    /**
     * Splits a `NonEmptyChunk` at `n`, returning a non-empty prefix and the
     * remaining suffix.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
     * `1`. If `n` is greater than or equal to the chunk length, the first result is
     * the original chunk and the second result is empty.
     *
     * **Example** (Splitting non-empty chunks at an index)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const nonEmptyChunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, after] = Chunk.splitNonEmptyAt(nonEmptyChunk, 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(after) // => [4, 5, 6]
     *
     * // Split at 1 (minimum)
     * const [first, rest] = Chunk.splitNonEmptyAt(nonEmptyChunk, 1)
     * Chunk.toArray(first) // => [1]
     * Chunk.toArray(rest) // => [2, 3, 4, 5, 6]
     *
     * // The first part is guaranteed to be NonEmptyChunk
     * // while the second part may be empty
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: NonEmptyChunk<A>) => [beforeIndex: NonEmptyChunk<A>, fromIndex: Chunk<A>]

    /**
     * Splits a `NonEmptyChunk` at `n`, returning a non-empty prefix and the
     * remaining suffix.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
     * `1`. If `n` is greater than or equal to the chunk length, the first result is
     * the original chunk and the second result is empty.
     *
     * **Example** (Splitting non-empty chunks at an index)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const nonEmptyChunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, after] = Chunk.splitNonEmptyAt(nonEmptyChunk, 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(after) // => [4, 5, 6]
     *
     * // Split at 1 (minimum)
     * const [first, rest] = Chunk.splitNonEmptyAt(nonEmptyChunk, 1)
     * Chunk.toArray(first) // => [1]
     * Chunk.toArray(rest) // => [2, 3, 4, 5, 6]
     *
     * // The first part is guaranteed to be NonEmptyChunk
     * // while the second part may be empty
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: NonEmptyChunk<A>, n: number): [beforeIndex: NonEmptyChunk<A>, fromIndex: Chunk<A>]
} = dual(2, <A>(self: NonEmptyChunk<A>, n: number): [Chunk<A>, Chunk<A>] =>
{
    const NValueValue = Count.normalizeNonEmpty(n);
    return NValueValue >= self.length ?
        [ self, empty() ] :
        [ take(self, NValueValue), drop(self, NValueValue) ];
});

/**
 * Splits a chunk into up to `n` chunks, distributing elements in order.
 *
 * **Details**
 *
 * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
 * `1`. The chunk size is derived from the input length and normalized count;
 * the final chunk may contain fewer elements than the others.
 *
 * **Example** (Splitting chunks into groups)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
 * const chunks = Chunk.split(chunk, 3)
 * Chunk.toArray(chunks).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
 *
 * // Uneven split
 * const chunk2 = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8)
 * const chunks2 = Chunk.split(chunk2, 3)
 * Chunk.toArray(chunks2).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8]]
 *
 * // Split into 1 chunk
 * const chunks3 = Chunk.split(chunk, 1)
 * Chunk.toArray(chunks3).map(Chunk.toArray) // => [[1, 2, 3, 4, 5, 6, 7, 8, 9]]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const split: {
    /**
     * Splits a chunk into up to `n` chunks, distributing elements in order.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
     * `1`. The chunk size is derived from the input length and normalized count;
     * the final chunk may contain fewer elements than the others.
     *
     * **Example** (Splitting chunks into groups)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
     * const chunks = Chunk.split(chunk, 3)
     * Chunk.toArray(chunks).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
     *
     * // Uneven split
     * const chunk2 = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8)
     * const chunks2 = Chunk.split(chunk2, 3)
     * Chunk.toArray(chunks2).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8]]
     *
     * // Split into 1 chunk
     * const chunks3 = Chunk.split(chunk, 1)
     * Chunk.toArray(chunks3).map(Chunk.toArray) // => [[1, 2, 3, 4, 5, 6, 7, 8, 9]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<Chunk<A>>

    /**
     * Splits a chunk into up to `n` chunks, distributing elements in order.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to at least `1`, with `NaN` treated as
     * `1`. The chunk size is derived from the input length and normalized count;
     * the final chunk may contain fewer elements than the others.
     *
     * **Example** (Splitting chunks into groups)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8, 9)
     * const chunks = Chunk.split(chunk, 3)
     * Chunk.toArray(chunks).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
     *
     * // Uneven split
     * const chunk2 = Chunk.make(1, 2, 3, 4, 5, 6, 7, 8)
     * const chunks2 = Chunk.split(chunk2, 3)
     * Chunk.toArray(chunks2).map(Chunk.toArray) // => [[1, 2, 3], [4, 5, 6], [7, 8]]
     *
     * // Split into 1 chunk
     * const chunks3 = Chunk.split(chunk, 1)
     * Chunk.toArray(chunks3).map(Chunk.toArray) // => [[1, 2, 3, 4, 5, 6, 7, 8, 9]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<Chunk<A>>
} = dual(2, <A>(self: Chunk<A>, n: number) => chunksOf(self, Math.ceil(self.length / Count.normalizeNonEmpty(n))));

/**
 * Splits this chunk on the first element that matches this predicate.
 * Returns a tuple containing two chunks: the first one is before the match, and the second one is from the match onward.
 *
 * **Example** (Splitting at a matching element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
 * const [before, fromMatch] = Chunk.splitWhere(chunk, (n) => n > 3)
 * Chunk.toArray(before) // => [1, 2, 3]
 * Chunk.toArray(fromMatch) // => [4, 5, 6]
 *
 * // No match found
 * const [all, empty] = Chunk.splitWhere(chunk, (n) => n > 10)
 * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
 * Chunk.toArray(empty) // => []
 *
 * // Match on first element
 * const [emptyBefore, allFromFirst] = Chunk.splitWhere(chunk, (n) => n === 1)
 * Chunk.toArray(emptyBefore) // => []
 * Chunk.toArray(allFromFirst) // => [1, 2, 3, 4, 5, 6]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const splitWhere: {
    /**
     * Splits this chunk on the first element that matches this predicate.
     * Returns a tuple containing two chunks: the first one is before the match, and the second one is from the match onward.
     *
     * **Example** (Splitting at a matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, fromMatch] = Chunk.splitWhere(chunk, (n) => n > 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(fromMatch) // => [4, 5, 6]
     *
     * // No match found
     * const [all, empty] = Chunk.splitWhere(chunk, (n) => n > 10)
     * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
     * Chunk.toArray(empty) // => []
     *
     * // Match on first element
     * const [emptyBefore, allFromFirst] = Chunk.splitWhere(chunk, (n) => n === 1)
     * Chunk.toArray(emptyBefore) // => []
     * Chunk.toArray(allFromFirst) // => [1, 2, 3, 4, 5, 6]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => [beforeMatch: Chunk<A>, fromMatch: Chunk<A>]

    /**
     * Splits this chunk on the first element that matches this predicate.
     * Returns a tuple containing two chunks: the first one is before the match, and the second one is from the match onward.
     *
     * **Example** (Splitting at a matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * const [before, fromMatch] = Chunk.splitWhere(chunk, (n) => n > 3)
     * Chunk.toArray(before) // => [1, 2, 3]
     * Chunk.toArray(fromMatch) // => [4, 5, 6]
     *
     * // No match found
     * const [all, empty] = Chunk.splitWhere(chunk, (n) => n > 10)
     * Chunk.toArray(all) // => [1, 2, 3, 4, 5, 6]
     * Chunk.toArray(empty) // => []
     *
     * // Match on first element
     * const [emptyBefore, allFromFirst] = Chunk.splitWhere(chunk, (n) => n === 1)
     * Chunk.toArray(emptyBefore) // => []
     * Chunk.toArray(allFromFirst) // => [1, 2, 3, 4, 5, 6]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): [beforeMatch: Chunk<A>, fromMatch: Chunk<A>]
} = dual(2, <A>(self: Chunk<A>, predicate: Predicate<A>): [beforeMatch: Chunk<A>, fromMatch: Chunk<A>] =>
{
    let i = 0;
    for (const AValueValue of toReadonlyArray(self))
    {
        if (predicate(AValueValue))
        {
            break;
        }
        else
        {
            i++;
        }
    }

    return splitAt(self, i);
});

/**
 * Returns every element after the first safely, or `None` when the chunk is empty.
 *
 * **Example** (Getting the tail safely)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 * Chunk.tail(chunk) // => Option.some(Chunk.make(2, 3, 4))
 *
 * const singleElement = Chunk.make(1)
 * Chunk.tail(singleElement) // => Option.some(Chunk.empty())
 *
 * Chunk.tail(Chunk.empty<number>()) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const tail = <A>(self: Chunk<A>): O.Option<Chunk<A>> => self.length > 0 ? O.some(drop(self, 1)) : O.none();

/**
 * Returns every element after the first from a non-empty chunk.
 *
 * **Example** (Getting the tail of a non-empty chunk)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const nonEmptyChunk = Chunk.make(1, 2, 3, 4)
 * Chunk.toArray(Chunk.tailNonEmpty(nonEmptyChunk)) // => [2, 3, 4]
 *
 * const singleElement = Chunk.make(1)
 * Chunk.toArray(Chunk.tailNonEmpty(singleElement)) // => []
 *
 * // Type safety: this function only accepts NonEmptyChunk
 * // Chunk.tailNonEmpty(Chunk.empty()) // TypeScript error
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const tailNonEmpty = <A>(self: NonEmptyChunk<A>): Chunk<A> => drop(self, 1);

/**
 * Takes the last `n` elements.
 * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
 *
 * **Example** (Taking elements from the end)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
 * Chunk.toArray(Chunk.takeRight(chunk, 3)) // => [4, 5, 6]
 *
 * // Take more than available
 * Chunk.toArray(Chunk.takeRight(chunk, 10)) // => [1, 2, 3, 4, 5, 6]
 *
 * // Take zero
 * Chunk.toArray(Chunk.takeRight(chunk, 0)) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const takeRight: {
    /**
     * Takes the last `n` elements.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Taking elements from the end)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * Chunk.toArray(Chunk.takeRight(chunk, 3)) // => [4, 5, 6]
     *
     * // Take more than available
     * Chunk.toArray(Chunk.takeRight(chunk, 10)) // => [1, 2, 3, 4, 5, 6]
     *
     * // Take zero
     * Chunk.toArray(Chunk.takeRight(chunk, 0)) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (n: number): <A>(self: Chunk<A>) => Chunk<A>

    /**
     * Takes the last `n` elements.
     * `n` is rounded down, with `NaN` and non-positive values treated as `0`.
     *
     * **Example** (Taking elements from the end)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5, 6)
     * Chunk.toArray(Chunk.takeRight(chunk, 3)) // => [4, 5, 6]
     *
     * // Take more than available
     * Chunk.toArray(Chunk.takeRight(chunk, 10)) // => [1, 2, 3, 4, 5, 6]
     *
     * // Take zero
     * Chunk.toArray(Chunk.takeRight(chunk, 0)) // => []
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, n: number): Chunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, n: number): Chunk<A> => drop(self, self.length - Math.min(Count.normalize(n), self.length))
);

/**
 * Takes all elements so long as the predicate returns true.
 *
 * **Example** (Taking elements while a predicate matches)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 3, 2, 1)
 * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n < 4)) // => [1, 2, 3]
 *
 * // Empty if first element doesn't match
 * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n > 5)) // => []
 *
 * // Takes all if all match
 * const small = Chunk.make(1, 2, 3)
 * Chunk.toArray(Chunk.takeWhile(small, (n) => n < 10)) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const takeWhile: {
    /**
     * Takes all elements so long as the predicate returns true.
     *
     * **Example** (Taking elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 3, 2, 1)
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n < 4)) // => [1, 2, 3]
     *
     * // Empty if first element doesn't match
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n > 5)) // => []
     *
     * // Takes all if all match
     * const small = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.takeWhile(small, (n) => n < 10)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): (self: Chunk<A>) => Chunk<B>

    /**
     * Takes all elements so long as the predicate returns true.
     *
     * **Example** (Taking elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 3, 2, 1)
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n < 4)) // => [1, 2, 3]
     *
     * // Empty if first element doesn't match
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n > 5)) // => []
     *
     * // Takes all if all match
     * const small = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.takeWhile(small, (n) => n < 10)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => Chunk<A>

    /**
     * Takes all elements so long as the predicate returns true.
     *
     * **Example** (Taking elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 3, 2, 1)
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n < 4)) // => [1, 2, 3]
     *
     * // Empty if first element doesn't match
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n > 5)) // => []
     *
     * // Takes all if all match
     * const small = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.takeWhile(small, (n) => n < 10)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): Chunk<B>

    /**
     * Takes all elements so long as the predicate returns true.
     *
     * **Example** (Taking elements while a predicate matches)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 3, 2, 1)
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n < 4)) // => [1, 2, 3]
     *
     * // Empty if first element doesn't match
     * Chunk.toArray(Chunk.takeWhile(chunk, (n) => n > 5)) // => []
     *
     * // Takes all if all match
     * const small = Chunk.make(1, 2, 3)
     * Chunk.toArray(Chunk.takeWhile(small, (n) => n < 10)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A>
} = dual(2, <A>(self: Chunk<A>, predicate: Predicate<A>): Chunk<A> =>
{
    const OutValueValueValue: Array<A> = [];
    for (const AValueValueValue of toReadonlyArray(self))
    {
        if (predicate(AValueValueValue))
        {
            OutValueValueValue.push(AValueValueValue);
        }
        else
        {
            break;
        }
    }

    return fromArrayUnsafe(OutValueValueValue);
});

/**
 * Creates a Chunks of unique values, in order, from all given Chunks.
 *
 * **Example** (Unioning chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk1 = Chunk.make(1, 2, 3)
 * const chunk2 = Chunk.make(3, 4, 5)
 * Chunk.toArray(Chunk.union(chunk1, chunk2)) // => [1, 2, 3, 4, 5]
 *
 * // Handles duplicates within the same chunk
 * const withDupes1 = Chunk.make(1, 1, 2)
 * const withDupes2 = Chunk.make(2, 3, 3)
 * Chunk.toArray(Chunk.union(withDupes1, withDupes2)) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const union: {
    /**
     * Creates a Chunks of unique values, in order, from all given Chunks.
     *
     * **Example** (Unioning chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3)
     * const chunk2 = Chunk.make(3, 4, 5)
     * Chunk.toArray(Chunk.union(chunk1, chunk2)) // => [1, 2, 3, 4, 5]
     *
     * // Handles duplicates within the same chunk
     * const withDupes1 = Chunk.make(1, 1, 2)
     * const withDupes2 = Chunk.make(2, 3, 3)
     * Chunk.toArray(Chunk.union(withDupes1, withDupes2)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(that: Chunk<A>): <B>(self: Chunk<B>) => Chunk<A | B>

    /**
     * Creates a Chunks of unique values, in order, from all given Chunks.
     *
     * **Example** (Unioning chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3)
     * const chunk2 = Chunk.make(3, 4, 5)
     * Chunk.toArray(Chunk.union(chunk1, chunk2)) // => [1, 2, 3, 4, 5]
     *
     * // Handles duplicates within the same chunk
     * const withDupes1 = Chunk.make(1, 1, 2)
     * const withDupes2 = Chunk.make(2, 3, 3)
     * Chunk.toArray(Chunk.union(withDupes1, withDupes2)) // => [1, 2, 3]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<A | B>
} = dual(
    2,
    <A, B>(self: Chunk<A>, that: Chunk<B>) => fromArrayUnsafe(RA.union(toReadonlyArray(self), toReadonlyArray(that)))
);

/**
 * Removes duplicate elements from a `Chunk`, preserving the first occurrence
 * of each value.
 *
 * **Example** (Removing duplicate values)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 2, 3, 1, 4, 3)
 * Chunk.toArray(Chunk.dedupe(chunk)) // => [1, 2, 3, 4]
 *
 * // Empty chunk
 * const empty = Chunk.empty<number>()
 * Chunk.toArray(Chunk.dedupe(empty)) // => []
 *
 * // No duplicates
 * const unique = Chunk.make(1, 2, 3)
 * Chunk.toArray(Chunk.dedupe(unique)) // => [1, 2, 3]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const dedupe = <A>(self: Chunk<A>): Chunk<A> => fromArrayUnsafe(RA.dedupe(toReadonlyArray(self)));

/**
 * Deduplicates adjacent elements that are identical.
 *
 * **Example** (Removing adjacent duplicates)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 1, 2, 2, 2, 3, 1, 1)
 * Chunk.toArray(Chunk.dedupeAdjacent(chunk)) // => [1, 2, 3, 1]
 *
 * // Only removes adjacent duplicates, not all duplicates
 * const mixed = Chunk.make("a", "a", "b", "a", "a")
 * Chunk.toArray(Chunk.dedupeAdjacent(mixed)) // => ["a", "b", "a"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const dedupeAdjacent = <A>(self: Chunk<A>): Chunk<A> => fromArrayUnsafe(RA.dedupeAdjacent(self));

/**
 * Takes a `Chunk` of pairs and returns two corresponding `Chunk`s.
 *
 * **Details**
 *
 * This function is the reverse of `zip`.
 *
 * **Example** (Unzipping pairs)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const pairs = Chunk.make(
 *   [1, "a"] as const,
 *   [2, "b"] as const,
 *   [3, "c"] as const
 * )
 * const [numbers, letters] = Chunk.unzip(pairs)
 * Chunk.toArray(numbers) // => [1, 2, 3]
 * Chunk.toArray(letters) // => ["a", "b", "c"]
 *
 * // Empty chunk
 * const empty = Chunk.empty<[number, string]>()
 * const [emptyNums, emptyStrs] = Chunk.unzip(empty)
 * Chunk.toArray(emptyNums) // => []
 * Chunk.toArray(emptyStrs) // => []
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const unzip = <A, B>(self: Chunk<readonly [A, B]>): [Chunk<A>, Chunk<B>] =>
{
    const [ Left, Right ] = RA.unzip(toReadonlyArray(self));
    return [ fromArrayUnsafe(Left), fromArrayUnsafe(Right) ];
};

/**
 * Zips this chunk pointwise with the specified chunk using the specified combiner.
 *
 * **Example** (Zipping chunks with a function)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const numbers = Chunk.make(1, 2, 3)
 * const letters = Chunk.make("a", "b", "c")
 * Chunk.toArray(Chunk.zipWith(numbers, letters, (n, l) => `${n}-${l}`)) // => ["1-a", "2-b", "3-c"]
 *
 * // Different lengths - takes minimum
 * const short = Chunk.make(1, 2)
 * const long = Chunk.make("a", "b", "c", "d")
 * Chunk.toArray(Chunk.zipWith(short, long, (n, l) => [n, l])) // => [[1, "a"], [2, "b"]]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zipWith: {
    /**
     * Zips this chunk pointwise with the specified chunk using the specified combiner.
     *
     * **Example** (Zipping chunks with a function)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const numbers = Chunk.make(1, 2, 3)
     * const letters = Chunk.make("a", "b", "c")
     * Chunk.toArray(Chunk.zipWith(numbers, letters, (n, l) => `${n}-${l}`)) // => ["1-a", "2-b", "3-c"]
     *
     * // Different lengths - takes minimum
     * const short = Chunk.make(1, 2)
     * const long = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.zipWith(short, long, (n, l) => [n, l])) // => [[1, "a"], [2, "b"]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C>(that: Chunk<B>, f: (a: A, b: B) => C): (self: Chunk<A>) => Chunk<C>

    /**
     * Zips this chunk pointwise with the specified chunk using the specified combiner.
     *
     * **Example** (Zipping chunks with a function)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const numbers = Chunk.make(1, 2, 3)
     * const letters = Chunk.make("a", "b", "c")
     * Chunk.toArray(Chunk.zipWith(numbers, letters, (n, l) => `${n}-${l}`)) // => ["1-a", "2-b", "3-c"]
     *
     * // Different lengths - takes minimum
     * const short = Chunk.make(1, 2)
     * const long = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.zipWith(short, long, (n, l) => [n, l])) // => [[1, "a"], [2, "b"]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B, C>(self: Chunk<A>, that: Chunk<B>, f: (a: A, b: B) => C): Chunk<C>
} = dual(
    3,
    <A, B, C>(self: Chunk<A>, that: Chunk<B>, f: (a: A, b: B) => C): Chunk<C> =>
        fromArrayUnsafe(RA.zipWith(toReadonlyArray(self), toReadonlyArray(that), f))
);

/**
 * Zips this chunk pointwise with the specified chunk.
 *
 * **Example** (Zipping chunks)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const numbers = Chunk.make(1, 2, 3)
 * const letters = Chunk.make("a", "b", "c")
 * Chunk.toArray(Chunk.zip(numbers, letters)) // => [[1, "a"], [2, "b"], [3, "c"]]
 *
 * // Different lengths - takes minimum length
 * const short = Chunk.make(1, 2)
 * const long = Chunk.make("a", "b", "c", "d")
 * Chunk.toArray(Chunk.zip(short, long)) // => [[1, "a"], [2, "b"]]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zip: {
    /**
     * Zips this chunk pointwise with the specified chunk.
     *
     * **Example** (Zipping chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const numbers = Chunk.make(1, 2, 3)
     * const letters = Chunk.make("a", "b", "c")
     * Chunk.toArray(Chunk.zip(numbers, letters)) // => [[1, "a"], [2, "b"], [3, "c"]]
     *
     * // Different lengths - takes minimum length
     * const short = Chunk.make(1, 2)
     * const long = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.zip(short, long)) // => [[1, "a"], [2, "b"]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B>(that: Chunk<B>): <A>(self: Chunk<A>) => Chunk<[A, B]>

    /**
     * Zips this chunk pointwise with the specified chunk.
     *
     * **Example** (Zipping chunks)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const numbers = Chunk.make(1, 2, 3)
     * const letters = Chunk.make("a", "b", "c")
     * Chunk.toArray(Chunk.zip(numbers, letters)) // => [[1, "a"], [2, "b"], [3, "c"]]
     *
     * // Different lengths - takes minimum length
     * const short = Chunk.make(1, 2)
     * const long = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.zip(short, long)) // => [[1, "a"], [2, "b"]]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<[A, B]>
} = dual(
    2,
    <A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<[A, B]> => zipWith(self, that, (a, b) => [ a, b ])
);

/**
 * Deletes the element at the specified index, creating a new `Chunk`.
 *
 * **Example** (Removing an element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make("a", "b", "c", "d")
 * Chunk.toArray(Chunk.remove(chunk, 1)) // => ["a", "c", "d"]
 *
 * // Remove first element
 * Chunk.toArray(Chunk.remove(chunk, 0)) // => ["b", "c", "d"]
 *
 * // Index out of bounds returns same chunk
 * Chunk.toArray(Chunk.remove(chunk, 10)) // => ["a", "b", "c", "d"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const remove: {
    /**
     * Deletes the element at the specified index, creating a new `Chunk`.
     *
     * **Example** (Removing an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.remove(chunk, 1)) // => ["a", "c", "d"]
     *
     * // Remove first element
     * Chunk.toArray(Chunk.remove(chunk, 0)) // => ["b", "c", "d"]
     *
     * // Index out of bounds returns same chunk
     * Chunk.toArray(Chunk.remove(chunk, 10)) // => ["a", "b", "c", "d"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (i: number): <A>(self: Chunk<A>) => Chunk<A>

    /**
     * Deletes the element at the specified index, creating a new `Chunk`.
     *
     * **Example** (Removing an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     * Chunk.toArray(Chunk.remove(chunk, 1)) // => ["a", "c", "d"]
     *
     * // Remove first element
     * Chunk.toArray(Chunk.remove(chunk, 0)) // => ["b", "c", "d"]
     *
     * // Index out of bounds returns same chunk
     * Chunk.toArray(Chunk.remove(chunk, 10)) // => ["a", "b", "c", "d"]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, i: number): Chunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, i: number): Chunk<A> => fromArrayUnsafe(RA.remove(toReadonlyArray(self), i))
);

/**
 * Applies a function to the element at the specified index safely, creating a new `Chunk`,
 * or returns `None` if the index is out of bounds.
 *
 * **Example** (Modifying an element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 * Chunk.modify(chunk, 1, (n) => n * 10) // => Option.some(Chunk.make(1, 20, 3, 4))
 *
 * // Index out of bounds returns None
 * chunk.pipe(Chunk.modify(10, (n) => n * 10)) // => Option.none()
 *
 * // Negative index returns None
 * chunk.pipe(Chunk.modify(-1, (n) => n * 10)) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const modify: {
    /**
     * Applies a function to the element at the specified index safely, creating a new `Chunk`,
     * or returns `None` if the index is out of bounds.
     *
     * **Example** (Modifying an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     * Chunk.modify(chunk, 1, (n) => n * 10) // => Option.some(Chunk.make(1, 20, 3, 4))
     *
     * // Index out of bounds returns None
     * chunk.pipe(Chunk.modify(10, (n) => n * 10)) // => Option.none()
     *
     * // Negative index returns None
     * chunk.pipe(Chunk.modify(-1, (n) => n * 10)) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(i: number, f: (a: A) => B): (self: Chunk<A>) => O.Option<Chunk<A | B>>

    /**
     * Applies a function to the element at the specified index safely, creating a new `Chunk`,
     * or returns `None` if the index is out of bounds.
     *
     * **Example** (Modifying an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     * Chunk.modify(chunk, 1, (n) => n * 10) // => Option.some(Chunk.make(1, 20, 3, 4))
     *
     * // Index out of bounds returns None
     * chunk.pipe(Chunk.modify(10, (n) => n * 10)) // => Option.none()
     *
     * // Negative index returns None
     * chunk.pipe(Chunk.modify(-1, (n) => n * 10)) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, i: number, f: (a: A) => B): O.Option<Chunk<A | B>>
} = dual(
    3,
    <A, B>(self: Chunk<A>, i: number, f: (a: A) => B): O.Option<Chunk<A | B>> =>
        pipe(RA.modify(toReadonlyArray(self), i, f), O.map(fromArrayUnsafe))
);

/**
 * Changes the element at the specified index safely, creating a new `Chunk`,
 * or returns `None` if the index is out of bounds.
 *
 * **Example** (Replacing an element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make("a", "b", "c", "d")
 * Chunk.replace(chunk, 1, "X") // => Option.some(Chunk.make("a", "X", "c", "d"))
 *
 * // Index out of bounds returns None
 * chunk.pipe(Chunk.replace(10, "Y")) // => Option.none()
 *
 * // Negative index returns None
 * chunk.pipe(Chunk.replace(-1, "Z")) // => Option.none()
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const replace: {
    /**
     * Changes the element at the specified index safely, creating a new `Chunk`,
     * or returns `None` if the index is out of bounds.
     *
     * **Example** (Replacing an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     * Chunk.replace(chunk, 1, "X") // => Option.some(Chunk.make("a", "X", "c", "d"))
     *
     * // Index out of bounds returns None
     * chunk.pipe(Chunk.replace(10, "Y")) // => Option.none()
     *
     * // Negative index returns None
     * chunk.pipe(Chunk.replace(-1, "Z")) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B>(i: number, b: B): <A>(self: Chunk<A>) => O.Option<Chunk<B | A>>

    /**
     * Changes the element at the specified index safely, creating a new `Chunk`,
     * or returns `None` if the index is out of bounds.
     *
     * **Example** (Replacing an element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make("a", "b", "c", "d")
     * Chunk.replace(chunk, 1, "X") // => Option.some(Chunk.make("a", "X", "c", "d"))
     *
     * // Index out of bounds returns None
     * chunk.pipe(Chunk.replace(10, "Y")) // => Option.none()
     *
     * // Negative index returns None
     * chunk.pipe(Chunk.replace(-1, "Z")) // => Option.none()
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, i: number, b: B): O.Option<Chunk<B | A>>
} = dual(3, <A, B>(self: Chunk<A>, i: number, b: B): O.Option<Chunk<B | A>> => modify(self, i, () => b));

/**
 * Returns a non-empty `Chunk` of length `n` with element `i` initialized by `f(i)`.
 *
 * **Details**
 *
 * `n` is rounded down and normalized to an integer greater than or equal to
 * `1`. `NaN` is treated as `1`.
 *
 * **Example** (Generating chunks from indices)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.makeBy(5, (i) => i * 2)) // => [0, 2, 4, 6, 8]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeBy: {
    /**
     * Returns a non-empty `Chunk` of length `n` with element `i` initialized by `f(i)`.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to an integer greater than or equal to
     * `1`. `NaN` is treated as `1`.
     *
     * **Example** (Generating chunks from indices)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.toArray(Chunk.makeBy(5, (i) => i * 2)) // => [0, 2, 4, 6, 8]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(f: (i: number) => A): (n: number) => NonEmptyChunk<A>

    /**
     * Returns a non-empty `Chunk` of length `n` with element `i` initialized by `f(i)`.
     *
     * **Details**
     *
     * `n` is rounded down and normalized to an integer greater than or equal to
     * `1`. `NaN` is treated as `1`.
     *
     * **Example** (Generating chunks from indices)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * Chunk.toArray(Chunk.makeBy(5, (i) => i * 2)) // => [0, 2, 4, 6, 8]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(n: number, f: (i: number) => A): NonEmptyChunk<A>
} = dual(2, (n, f) => fromIterable(RA.makeBy(n, f)));

/**
 * Creates a non-empty `Chunk` of consecutive integers from `start` through
 * `end`, inclusive.
 *
 * **Details**
 *
 * If `start` is greater than `end`, returns a single-element chunk containing
 * `start`.
 *
 * **Example** (Creating a range)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * Chunk.toArray(Chunk.range(1, 5)) // => [1, 2, 3, 4, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const range = (start: number, end: number): NonEmptyChunk<number> =>
    start <= end ? makeBy(end - start + 1, (i) => start + i) : of(start);

// -------------------------------------------------------------------------------------
// re-exports from ReadonlyArray
// -------------------------------------------------------------------------------------

/**
 * Returns a function that checks if a `Chunk` contains a given value using the default `Equivalence`.
 *
 * **Example** (Checking membership)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.contains(chunk, 3) // => true
 * Chunk.contains(chunk, 6) // => false
 *
 * // Works with strings
 * const words = Chunk.make("apple", "banana", "cherry")
 * Chunk.contains(words, "banana") // => true
 * Chunk.contains(words, "grape") // => false
 *
 * // Empty chunk
 * Chunk.contains(Chunk.empty<number>(), 1) // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const contains: {
    // -------------------------------------------------------------------------------------
    // re-exports from ReadonlyArray
    // -------------------------------------------------------------------------------------

    /**
     * Returns a function that checks if a `Chunk` contains a given value using the default `Equivalence`.
     *
     * **Example** (Checking membership)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.contains(chunk, 3) // => true
     * Chunk.contains(chunk, 6) // => false
     *
     * // Works with strings
     * const words = Chunk.make("apple", "banana", "cherry")
     * Chunk.contains(words, "banana") // => true
     * Chunk.contains(words, "grape") // => false
     *
     * // Empty chunk
     * Chunk.contains(Chunk.empty<number>(), 1) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(a: A): (self: Chunk<A>) => boolean
    // -------------------------------------------------------------------------------------
    // re-exports from ReadonlyArray
    // -------------------------------------------------------------------------------------

    /**
     * Returns a function that checks if a `Chunk` contains a given value using the default `Equivalence`.
     *
     * **Example** (Checking membership)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.contains(chunk, 3) // => true
     * Chunk.contains(chunk, 6) // => false
     *
     * // Works with strings
     * const words = Chunk.make("apple", "banana", "cherry")
     * Chunk.contains(words, "banana") // => true
     * Chunk.contains(words, "grape") // => false
     *
     * // Empty chunk
     * Chunk.contains(Chunk.empty<number>(), 1) // => false
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, a: A): boolean
} = RA.contains;

/**
 * Returns a function that checks if a `Chunk` contains a given value using a provided `isEquivalent` function.
 *
 * **Example** (Checking membership with custom equivalence)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make({ id: 1, name: "Alice" }, { id: 2, name: "Bob" })
 *
 * // Custom equivalence by id
 * const containsById = Chunk.containsWith<{ id: number; name: string }>((a, b) =>
 *   a.id === b.id
 * )
 * containsById(chunk, { id: 1, name: "Different" }) // => true
 * containsById(chunk, { id: 3, name: "Charlie" }) // => false
 *
 * // Case-insensitive string comparison
 * const words = Chunk.make("Apple", "Banana", "Cherry")
 * const containsCaseInsensitive = Chunk.containsWith<string>((a, b) =>
 *   a.toLowerCase() === b.toLowerCase()
 * )
 * containsCaseInsensitive(words, "apple") // => true
 * containsCaseInsensitive(words, "grape") // => false
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const containsWith: <A>(
    isEquivalent: (self: A, that: A) => boolean
) => {
    (a: A): (self: Chunk<A>) => boolean
    (self: Chunk<A>, a: A): boolean
} = RA.containsWith;

/**
 * Returns the first element that satisfies the specified
 * predicate, or `None` if no such element exists.
 *
 * **Example** (Finding the first matching element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.findFirst(chunk, (n) => n > 3) // => Option.some(4)
 *
 * // No match found
 * Chunk.findFirst(chunk, (n) => n > 10) // => Option.none()
 *
 * // With type refinement
 * const mixed = Chunk.make(1, "hello", 2, "world", 3)
 * const firstString = Chunk.findFirst(
 *   mixed,
 *   (x): x is string => typeof x === "string"
 * )
 * firstString // => Option.some("hello")
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const findFirst: {
    /**
     * Returns the first element that satisfies the specified
     * predicate, or `None` if no such element exists.
     *
     * **Example** (Finding the first matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirst(chunk, (n) => n > 3) // => Option.some(4)
     *
     * // No match found
     * Chunk.findFirst(chunk, (n) => n > 10) // => Option.none()
     *
     * // With type refinement
     * const mixed = Chunk.make(1, "hello", 2, "world", 3)
     * const firstString = Chunk.findFirst(
     *   mixed,
     *   (x): x is string => typeof x === "string"
     * )
     * firstString // => Option.some("hello")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): (self: Chunk<A>) => Option<B>

    /**
     * Returns the first element that satisfies the specified
     * predicate, or `None` if no such element exists.
     *
     * **Example** (Finding the first matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirst(chunk, (n) => n > 3) // => Option.some(4)
     *
     * // No match found
     * Chunk.findFirst(chunk, (n) => n > 10) // => Option.none()
     *
     * // With type refinement
     * const mixed = Chunk.make(1, "hello", 2, "world", 3)
     * const firstString = Chunk.findFirst(
     *   mixed,
     *   (x): x is string => typeof x === "string"
     * )
     * firstString // => Option.some("hello")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => Option<A>

    /**
     * Returns the first element that satisfies the specified
     * predicate, or `None` if no such element exists.
     *
     * **Example** (Finding the first matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirst(chunk, (n) => n > 3) // => Option.some(4)
     *
     * // No match found
     * Chunk.findFirst(chunk, (n) => n > 10) // => Option.none()
     *
     * // With type refinement
     * const mixed = Chunk.make(1, "hello", 2, "world", 3)
     * const firstString = Chunk.findFirst(
     *   mixed,
     *   (x): x is string => typeof x === "string"
     * )
     * firstString // => Option.some("hello")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): Option<B>

    /**
     * Returns the first element that satisfies the specified
     * predicate, or `None` if no such element exists.
     *
     * **Example** (Finding the first matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirst(chunk, (n) => n > 3) // => Option.some(4)
     *
     * // No match found
     * Chunk.findFirst(chunk, (n) => n > 10) // => Option.none()
     *
     * // With type refinement
     * const mixed = Chunk.make(1, "hello", 2, "world", 3)
     * const firstString = Chunk.findFirst(
     *   mixed,
     *   (x): x is string => typeof x === "string"
     * )
     * firstString // => Option.some("hello")
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): Option<A>
} = RA.findFirst;

/**
 * Returns the first index for which a predicate holds.
 *
 * **Example** (Finding the first matching index)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.findFirstIndex(chunk, (n) => n > 3) // => Option.some(3)
 *
 * // No match found
 * Chunk.findFirstIndex(chunk, (n) => n > 10) // => Option.none()
 *
 * // Find first even number
 * Chunk.findFirstIndex(chunk, (n) => n % 2 === 0) // => Option.some(1)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const findFirstIndex: {
    /**
     * Returns the first index for which a predicate holds.
     *
     * **Example** (Finding the first matching index)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirstIndex(chunk, (n) => n > 3) // => Option.some(3)
     *
     * // No match found
     * Chunk.findFirstIndex(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find first even number
     * Chunk.findFirstIndex(chunk, (n) => n % 2 === 0) // => Option.some(1)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<A>): (self: Chunk<A>) => O.Option<number>

    /**
     * Returns the first index for which a predicate holds.
     *
     * **Example** (Finding the first matching index)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findFirstIndex(chunk, (n) => n > 3) // => Option.some(3)
     *
     * // No match found
     * Chunk.findFirstIndex(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find first even number
     * Chunk.findFirstIndex(chunk, (n) => n % 2 === 0) // => Option.some(1)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): O.Option<number>
} = dual(
    2,
    <A>(self: Chunk<A>, predicate: Predicate<A>): O.Option<number> => RA.findFirstIndex(self, predicate)
);

/**
 * Finds the last element for which a predicate holds.
 *
 * **Example** (Finding the last matching element)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.findLast(chunk, (n) => n < 4) // => Option.some(3)
 *
 * // No match found
 * Chunk.findLast(chunk, (n) => n > 10) // => Option.none()
 *
 * // Find last even number
 * Chunk.findLast(chunk, (n) => n % 2 === 0) // => Option.some(4)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const findLast: {
    /**
     * Finds the last element for which a predicate holds.
     *
     * **Example** (Finding the last matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLast(chunk, (n) => n < 4) // => Option.some(3)
     *
     * // No match found
     * Chunk.findLast(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number
     * Chunk.findLast(chunk, (n) => n % 2 === 0) // => Option.some(4)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): (self: Chunk<A>) => Option<B>

    /**
     * Finds the last element for which a predicate holds.
     *
     * **Example** (Finding the last matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLast(chunk, (n) => n < 4) // => Option.some(3)
     *
     * // No match found
     * Chunk.findLast(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number
     * Chunk.findLast(chunk, (n) => n % 2 === 0) // => Option.some(4)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => Option<A>

    /**
     * Finds the last element for which a predicate holds.
     *
     * **Example** (Finding the last matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLast(chunk, (n) => n < 4) // => Option.some(3)
     *
     * // No match found
     * Chunk.findLast(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number
     * Chunk.findLast(chunk, (n) => n % 2 === 0) // => Option.some(4)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): Option<B>

    /**
     * Finds the last element for which a predicate holds.
     *
     * **Example** (Finding the last matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLast(chunk, (n) => n < 4) // => Option.some(3)
     *
     * // No match found
     * Chunk.findLast(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number
     * Chunk.findLast(chunk, (n) => n % 2 === 0) // => Option.some(4)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): Option<A>
} = dual(2, <A>(self: Chunk<A>, predicate: Predicate<A>): Option<A> => RA.findLast(toReadonlyArray(self), predicate));

/**
 * Returns the last index for which a predicate holds.
 *
 * **Example** (Finding the last matching index)
 *
 * ```ts import.meta.vitest
 * import { Chunk, Option } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.findLastIndex(chunk, (n) => n < 4) // => Option.some(2)
 *
 * // No match found
 * Chunk.findLastIndex(chunk, (n) => n > 10) // => Option.none()
 *
 * // Find last even number index
 * Chunk.findLastIndex(chunk, (n) => n % 2 === 0) // => Option.some(3)
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const findLastIndex: {
    /**
     * Returns the last index for which a predicate holds.
     *
     * **Example** (Finding the last matching index)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLastIndex(chunk, (n) => n < 4) // => Option.some(2)
     *
     * // No match found
     * Chunk.findLastIndex(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number index
     * Chunk.findLastIndex(chunk, (n) => n % 2 === 0) // => Option.some(3)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<A>): (self: Chunk<A>) => O.Option<number>

    /**
     * Returns the last index for which a predicate holds.
     *
     * **Example** (Finding the last matching index)
     *
     * ```ts import.meta.vitest
     * import { Chunk, Option } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.findLastIndex(chunk, (n) => n < 4) // => Option.some(2)
     *
     * // No match found
     * Chunk.findLastIndex(chunk, (n) => n > 10) // => Option.none()
     *
     * // Find last even number index
     * Chunk.findLastIndex(chunk, (n) => n % 2 === 0) // => Option.some(3)
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): O.Option<number>
} = dual(
    2,
    <A>(self: Chunk<A>, predicate: Predicate<A>): O.Option<number> => RA.findLastIndex(toReadonlyArray(self), predicate)
);

/**
 * Checks whether a predicate holds true for every `Chunk` element.
 *
 * **Example** (Checking every element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const allPositive = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.every(allPositive, (n) => n > 0) // => true
 * Chunk.every(allPositive, (n) => n > 3) // => false
 *
 * // Empty chunk returns true
 * Chunk.every(Chunk.empty<number>(), (n) => n > 0) // => true
 *
 * // Type refinement
 * const mixed = Chunk.make(1, 2, 3)
 * if (Chunk.every(mixed, (x): x is number => typeof x === "number")) {
 *   // mixed is now typed as Chunk<number>
 * }
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const every: {
    /**
     * Checks whether a predicate holds true for every `Chunk` element.
     *
     * **Example** (Checking every element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const allPositive = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.every(allPositive, (n) => n > 0) // => true
     * Chunk.every(allPositive, (n) => n > 3) // => false
     *
     * // Empty chunk returns true
     * Chunk.every(Chunk.empty<number>(), (n) => n > 0) // => true
     *
     * // Type refinement
     * const mixed = Chunk.make(1, 2, 3)
     * if (Chunk.every(mixed, (x): x is number => typeof x === "number")) {
     *   // mixed is now typed as Chunk<number>
     * }
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(refinement: Refinement<NoInfer<A>, B>): (self: Chunk<A>) => self is Chunk<B>

    /**
     * Checks whether a predicate holds true for every `Chunk` element.
     *
     * **Example** (Checking every element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const allPositive = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.every(allPositive, (n) => n > 0) // => true
     * Chunk.every(allPositive, (n) => n > 3) // => false
     *
     * // Empty chunk returns true
     * Chunk.every(Chunk.empty<number>(), (n) => n > 0) // => true
     *
     * // Type refinement
     * const mixed = Chunk.make(1, 2, 3)
     * if (Chunk.every(mixed, (x): x is number => typeof x === "number")) {
     *   // mixed is now typed as Chunk<number>
     * }
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<A>): (self: Chunk<A>) => boolean

    /**
     * Checks whether a predicate holds true for every `Chunk` element.
     *
     * **Example** (Checking every element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const allPositive = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.every(allPositive, (n) => n > 0) // => true
     * Chunk.every(allPositive, (n) => n > 3) // => false
     *
     * // Empty chunk returns true
     * Chunk.every(Chunk.empty<number>(), (n) => n > 0) // => true
     *
     * // Type refinement
     * const mixed = Chunk.make(1, 2, 3)
     * if (Chunk.every(mixed, (x): x is number => typeof x === "number")) {
     *   // mixed is now typed as Chunk<number>
     * }
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): self is Chunk<B>

    /**
     * Checks whether a predicate holds true for every `Chunk` element.
     *
     * **Example** (Checking every element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const allPositive = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.every(allPositive, (n) => n > 0) // => true
     * Chunk.every(allPositive, (n) => n > 3) // => false
     *
     * // Empty chunk returns true
     * Chunk.every(Chunk.empty<number>(), (n) => n > 0) // => true
     *
     * // Type refinement
     * const mixed = Chunk.make(1, 2, 3)
     * if (Chunk.every(mixed, (x): x is number => typeof x === "number")) {
     *   // mixed is now typed as Chunk<number>
     * }
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): boolean
} = dual(
    2,
    <A, B extends A>(self: Chunk<A>, refinement: Refinement<A, B>): self is Chunk<B> =>
    {
        const AsValueValueValueValue = toReadonlyArray(self);
        for (let i = 0; i < AsValueValueValueValue.length; i++)
        {
            if (!refinement(AsValueValueValueValue[i]))
            {
                return false;
            }
        }

        return true;
    }
);

/**
 * Checks whether a predicate holds true for some `Chunk` element.
 *
 * **Example** (Checking for some matching element)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.some(chunk, (n) => n > 4) // => true
 * Chunk.some(chunk, (n) => n > 10) // => false
 *
 * // Empty chunk returns false
 * Chunk.some(Chunk.empty<number>(), (n) => n > 0) // => false
 *
 * // Check for specific value
 * const words = Chunk.make("apple", "banana", "cherry")
 * Chunk.some(words, (word) => word.includes("ban")) // => true
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const some: {
    /**
     * Checks whether a predicate holds true for some `Chunk` element.
     *
     * **Example** (Checking for some matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.some(chunk, (n) => n > 4) // => true
     * Chunk.some(chunk, (n) => n > 10) // => false
     *
     * // Empty chunk returns false
     * Chunk.some(Chunk.empty<number>(), (n) => n > 0) // => false
     *
     * // Check for specific value
     * const words = Chunk.make("apple", "banana", "cherry")
     * Chunk.some(words, (word) => word.includes("ban")) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(predicate: Predicate<NoInfer<A>>): (self: Chunk<A>) => self is NonEmptyChunk<A>

    /**
     * Checks whether a predicate holds true for some `Chunk` element.
     *
     * **Example** (Checking for some matching element)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.some(chunk, (n) => n > 4) // => true
     * Chunk.some(chunk, (n) => n > 10) // => false
     *
     * // Empty chunk returns false
     * Chunk.some(Chunk.empty<number>(), (n) => n > 0) // => false
     *
     * // Check for specific value
     * const words = Chunk.make("apple", "banana", "cherry")
     * Chunk.some(words, (word) => word.includes("ban")) // => true
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, predicate: Predicate<A>): self is NonEmptyChunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, predicate: Predicate<A>): self is NonEmptyChunk<A> =>
    {
        const AsValueValueValueValueValue = toReadonlyArray(self);
        for (let i = 0; i < AsValueValueValueValueValue.length; i++)
        {
            if (predicate(AsValueValueValueValueValue[i]))
            {
                return true;
            }
        }

        return false;
    }
);

/**
 * Joins the elements together with "sep" in the middle.
 *
 * **Example** (Joining chunks into a string)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make("apple", "banana", "cherry")
 * Chunk.join(chunk, ", ") // => "apple, banana, cherry"
 *
 * // With different separator
 * Chunk.join(chunk, " | ") // => "apple | banana | cherry"
 *
 * // Empty chunk
 * Chunk.join(Chunk.empty<string>(), ", ") // => ""
 *
 * // Single element
 * Chunk.join(Chunk.make("hello"), ", ") // => "hello"
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const join: {
    /**
     * Joins the elements together with "sep" in the middle.
     *
     * **Example** (Joining chunks into a string)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make("apple", "banana", "cherry")
     * Chunk.join(chunk, ", ") // => "apple, banana, cherry"
     *
     * // With different separator
     * Chunk.join(chunk, " | ") // => "apple | banana | cherry"
     *
     * // Empty chunk
     * Chunk.join(Chunk.empty<string>(), ", ") // => ""
     *
     * // Single element
     * Chunk.join(Chunk.make("hello"), ", ") // => "hello"
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (sep: string): (self: Chunk<string>) => string

    /**
     * Joins the elements together with "sep" in the middle.
     *
     * **Example** (Joining chunks into a string)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make("apple", "banana", "cherry")
     * Chunk.join(chunk, ", ") // => "apple, banana, cherry"
     *
     * // With different separator
     * Chunk.join(chunk, " | ") // => "apple | banana | cherry"
     *
     * // Empty chunk
     * Chunk.join(Chunk.empty<string>(), ", ") // => ""
     *
     * // Single element
     * Chunk.join(Chunk.make("hello"), ", ") // => "hello"
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: Chunk<string>, sep: string): string
} = dual(2, (self: Chunk<string>, sep: string): string => toReadonlyArray(self).join(sep));

/**
 * Reduces the elements of a chunk from left to right.
 *
 * **Example** (Reducing from the left)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4, 5)
 * Chunk.reduce(chunk, 0, (acc, n) => acc + n) // => 15
 *
 * // String concatenation with index
 * const words = Chunk.make("a", "b", "c")
 * Chunk.reduce(words, "", (acc, word, i) => acc + `${i}:${word} `).trimEnd() // => "0:a 1:b 2:c"
 *
 * // Find maximum
 * Chunk.reduce(chunk, -Infinity, (acc, n) => Math.max(acc, n)) // => 5
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const reduce: {
    /**
     * Reduces the elements of a chunk from left to right.
     *
     * **Example** (Reducing from the left)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.reduce(chunk, 0, (acc, n) => acc + n) // => 15
     *
     * // String concatenation with index
     * const words = Chunk.make("a", "b", "c")
     * Chunk.reduce(words, "", (acc, word, i) => acc + `${i}:${word} `).trimEnd() // => "0:a 1:b 2:c"
     *
     * // Find maximum
     * Chunk.reduce(chunk, -Infinity, (acc, n) => Math.max(acc, n)) // => 5
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B, A>(b: B, f: (b: B, a: A, i: number) => B): (self: Chunk<A>) => B

    /**
     * Reduces the elements of a chunk from left to right.
     *
     * **Example** (Reducing from the left)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4, 5)
     * Chunk.reduce(chunk, 0, (acc, n) => acc + n) // => 15
     *
     * // String concatenation with index
     * const words = Chunk.make("a", "b", "c")
     * Chunk.reduce(words, "", (acc, word, i) => acc + `${i}:${word} `).trimEnd() // => "0:a 1:b 2:c"
     *
     * // Find maximum
     * Chunk.reduce(chunk, -Infinity, (acc, n) => Math.max(acc, n)) // => 5
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, b: B, f: (b: B, a: A, i: number) => B): B
} = RA.reduce;

/**
 * Reduces the elements of a chunk from right to left.
 *
 * **Example** (Reducing from the right)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk = Chunk.make(1, 2, 3, 4)
 * Chunk.reduceRight(chunk, 0, (acc, n) => acc + n) // => 10
 *
 * // String building (right to left)
 * const words = Chunk.make("a", "b", "c")
 * Chunk.reduceRight(
 *   words,
 *   "",
 *   (acc, word, i) => acc + `${i}:${word} `
 * ).trim() // => "2:c 1:b 0:a"
 *
 * // Subtract from right to left
 * Chunk.reduceRight(chunk, 0, (acc, n) => n - acc) // => -2
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const reduceRight: {
    /**
     * Reduces the elements of a chunk from right to left.
     *
     * **Example** (Reducing from the right)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     * Chunk.reduceRight(chunk, 0, (acc, n) => acc + n) // => 10
     *
     * // String building (right to left)
     * const words = Chunk.make("a", "b", "c")
     * Chunk.reduceRight(
     *   words,
     *   "",
     *   (acc, word, i) => acc + `${i}:${word} `
     * ).trim() // => "2:c 1:b 0:a"
     *
     * // Subtract from right to left
     * Chunk.reduceRight(chunk, 0, (acc, n) => n - acc) // => -2
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <B, A>(b: B, f: (b: B, a: A, i: number) => B): (self: Chunk<A>) => B

    /**
     * Reduces the elements of a chunk from right to left.
     *
     * **Example** (Reducing from the right)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk = Chunk.make(1, 2, 3, 4)
     * Chunk.reduceRight(chunk, 0, (acc, n) => acc + n) // => 10
     *
     * // String building (right to left)
     * const words = Chunk.make("a", "b", "c")
     * Chunk.reduceRight(
     *   words,
     *   "",
     *   (acc, word, i) => acc + `${i}:${word} `
     * ).trim() // => "2:c 1:b 0:a"
     *
     * // Subtract from right to left
     * Chunk.reduceRight(chunk, 0, (acc, n) => n - acc) // => -2
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A, B>(self: Chunk<A>, b: B, f: (b: B, a: A, i: number) => B): B
} = RA.reduceRight;

/**
 * Creates a `Chunk` of values not included in the other given `Chunk` using the provided `isEquivalent` function.
 * The order and references of result values are determined by the first `Chunk`.
 *
 * **Example** (Computing difference with custom equivalence)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk1 = Chunk.make({ id: 1, name: "Alice" }, { id: 2, name: "Bob" })
 * const chunk2 = Chunk.make({ id: 1, name: "Alice" }, { id: 3, name: "Charlie" })
 *
 * // Custom equivalence by id
 * const byId = Chunk.differenceWith<{ id: number; name: string }>((a, b) =>
 *   a.id === b.id
 * )
 * Chunk.toArray(byId(chunk1, chunk2)) // => [{ id: 2, name: "Bob" }]
 *
 * // String comparison case-insensitive
 * const words1 = Chunk.make("Apple", "Banana", "Cherry")
 * const words2 = Chunk.make("apple", "grape")
 * const caseInsensitive = Chunk.differenceWith<string>((a, b) =>
 *   a.toLowerCase() === b.toLowerCase()
 * )
 * Chunk.toArray(caseInsensitive(words1, words2)) // => ["Banana", "Cherry"]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const differenceWith = <A>(isEquivalent: (self: A, that: A) => boolean): {
    (that: Chunk<A>): (self: Chunk<A>) => Chunk<A>
    (self: Chunk<A>, that: Chunk<A>): Chunk<A>
} =>
{
    return dual(
        2,
        (self: Chunk<A>, that: Chunk<A>): Chunk<A> => fromArrayUnsafe(RA.differenceWith(isEquivalent)(self, that))
    );
};

/**
 * Creates a `Chunk` of values not included in the other given `Chunk`.
 * The order and references of result values are determined by the first `Chunk`.
 *
 * **Example** (Computing chunk difference)
 *
 * ```ts import.meta.vitest
 * import { Chunk } from "effect"
 *
 * const chunk1 = Chunk.make(1, 2, 3, 4, 5)
 * const chunk2 = Chunk.make(3, 4, 6, 7)
 * Chunk.toArray(Chunk.difference(chunk1, chunk2)) // => [1, 2, 5]
 *
 * // String difference
 * const words1 = Chunk.make("apple", "banana", "cherry")
 * const words2 = Chunk.make("banana", "grape")
 * Chunk.toArray(Chunk.difference(words1, words2)) // => ["apple", "cherry"]
 *
 * // Empty second chunk returns original
 * Chunk.toArray(Chunk.difference(chunk1, Chunk.empty<number>())) // => [1, 2, 3, 4, 5]
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const difference: {
    /**
     * Creates a `Chunk` of values not included in the other given `Chunk`.
     * The order and references of result values are determined by the first `Chunk`.
     *
     * **Example** (Computing chunk difference)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3, 4, 5)
     * const chunk2 = Chunk.make(3, 4, 6, 7)
     * Chunk.toArray(Chunk.difference(chunk1, chunk2)) // => [1, 2, 5]
     *
     * // String difference
     * const words1 = Chunk.make("apple", "banana", "cherry")
     * const words2 = Chunk.make("banana", "grape")
     * Chunk.toArray(Chunk.difference(words1, words2)) // => ["apple", "cherry"]
     *
     * // Empty second chunk returns original
     * Chunk.toArray(Chunk.difference(chunk1, Chunk.empty<number>())) // => [1, 2, 3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(that: Chunk<A>): (self: Chunk<A>) => Chunk<A>

    /**
     * Creates a `Chunk` of values not included in the other given `Chunk`.
     * The order and references of result values are determined by the first `Chunk`.
     *
     * **Example** (Computing chunk difference)
     *
     * ```ts import.meta.vitest
     * import { Chunk } from "effect"
     *
     * const chunk1 = Chunk.make(1, 2, 3, 4, 5)
     * const chunk2 = Chunk.make(3, 4, 6, 7)
     * Chunk.toArray(Chunk.difference(chunk1, chunk2)) // => [1, 2, 5]
     *
     * // String difference
     * const words1 = Chunk.make("apple", "banana", "cherry")
     * const words2 = Chunk.make("banana", "grape")
     * Chunk.toArray(Chunk.difference(words1, words2)) // => ["apple", "cherry"]
     *
     * // Empty second chunk returns original
     * Chunk.toArray(Chunk.difference(chunk1, Chunk.empty<number>())) // => [1, 2, 3, 4, 5]
     * ```
     *
     * @category Utilities
     * @since 1.0.0
     */
    <A>(self: Chunk<A>, that: Chunk<A>): Chunk<A>
} = dual(
    2,
    <A>(self: Chunk<A>, that: Chunk<A>): Chunk<A> => fromArrayUnsafe(RA.difference(self, toReadonlyArray(that)))
);
