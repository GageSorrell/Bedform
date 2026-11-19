/**
 * The `HashSet` implementation, a `HashMap` of keys: construction, membership,
 * set algebra and traversal. Ported from Effect 4.0.5 as a Schema dependency.
 *
 * @module @bedform/effect/Internal/hashSet
 *
 * @file      hashSet.ts
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
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, prefer-rest-params */

import * as Equal from "../Equal.js";
import { format } from "../Formatter.js";
import * as Hash from "../Hash.js";
import type { Inspectable } from "../Inspectable.js";
import { NodeInspectSymbol, toJson } from "../Inspectable.js";
import type { Pipeable } from "../Pipeable.js";
import { pipeArguments } from "../Pipeable.js";
import { hasProperty } from "../Predicate.js";
import * as HashMap from "./hashMap.js";

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const HashSetTypeId = "~effect/HashSet";

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type HashSetTypeId = typeof HashSetTypeId;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface HashSet<out V> extends Iterable<V>, Equal.Equal, Pipeable, Inspectable
{
    readonly [HashSetTypeId]: HashSetTypeId
}

const HashSetSeed = Hash.string(HashSetTypeId);

const HashSetProto: Omit<HashSet<unknown>, HashSetTypeId> = {
    [Hash.symbol]<V>(this: HashSet<V>): number
    {
        return Hash.optimize(Hash.combine(HashSetSeed, Hash.hash(keyMap(this))));
    },
    [Equal.symbol]<V>(this: HashSet<V>, that: unknown): boolean
    {
        return isHashSet(that) && size(this) === size(that) && every(this, (value) => has(that, value));
    },
    [Symbol.iterator]<V>(this: HashSet<V>): Iterator<V>
    {
        return HashMap.keys(keyMap(this));
    },
    toString()
    {
        return `HashSet(${format(Array.from(this))})`;
    },
    toJSON()
    {
        return {
            _id: "HashSet",
            values: toJson(Array.from(this))
        };
    },
    [NodeInspectSymbol]()
    {
        return this.toJSON();
    },
    pipe()
    {
        return pipeArguments(this, arguments);
    }
};

const MakeImpl = <V>(keyMap: HashMap.HashMap<V, boolean>): HashSet<V> =>
{
    const Set = Object.create(HashSetProto);
    Set[HashSetTypeId] = HashSetTypeId;
    Set.keyMap = keyMap;
    return Set;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isHashSet = (u: unknown): u is HashSet<unknown> => hasProperty(u, HashSetTypeId);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const keyMap = <V>(self: HashSet<V>): HashMap.HashMap<V, boolean> => (self as any).keyMap;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const empty = <V = never>(): HashSet<V> => MakeImpl(HashMap.empty<V, boolean>());

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const make = <Values extends ReadonlyArray<any>>(
    ...values: Values
): HashSet<Values[number]> => fromIterable(values);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromIterable = <V>(values: Iterable<V>): HashSet<V> =>
{
    let map = HashMap.empty<V, boolean>();
    for (const Value of values)
    {
        map = HashMap.set(map, Value, true);
    }

    return MakeImpl(map);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const has = <V>(self: HashSet<V>, value: V): boolean => HashMap.has(keyMap(self), value);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const add = <V>(self: HashSet<V>, value: V): HashSet<V> =>
{
    const Map = keyMap(self);
    return HashMap.has(Map, value) ? self : MakeImpl(HashMap.set(Map, value, true));
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const remove = <V>(self: HashSet<V>, value: V): HashSet<V> =>
{
    const MapValue = keyMap(self);
    return HashMap.has(MapValue, value) ? MakeImpl(HashMap.remove(MapValue, value)) : self;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const size = <V>(self: HashSet<V>): number => HashMap.size(keyMap(self));

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isEmpty = <V>(self: HashSet<V>): boolean => HashMap.isEmpty(keyMap(self));

// Helper function for building new HashSets from iteration
const FromPredicate = <V>(self: HashSet<V>, predicate: (value: V) => boolean): HashSet<V> =>
{
    let result = HashMap.empty<V, boolean>();
    for (const ValueValue of self)
    {
        if (predicate(ValueValue))
        {
            result = HashMap.set(result, ValueValue, true);
        }
    }

    return MakeImpl(result);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const union = <V0, V1>(self: HashSet<V0>, that: HashSet<V1>): HashSet<V0 | V1> =>
{
    const MapValueValue = keyMap(self);
    let result = MapValueValue as HashMap.HashMap<V0 | V1, boolean>;
    for (const ValueValueValue of that)
    {
        result = HashMap.set(result, ValueValueValue, true);
    }

    return MakeImpl(result);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const intersection = <V0, V1>(self: HashSet<V0>, that: HashSet<V1>): HashSet<V0 & V1> =>
{
    let result = HashMap.empty<V0 & V1, boolean>();
    for (const ValueValueValueValue of self)
    {
        if (has(that, ValueValueValueValue as any))
        {
            result = HashMap.set(result, ValueValueValueValue as V0 & V1, true);
        }
    }

    return MakeImpl(result);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const difference = <V0, V1>(self: HashSet<V0>, that: HashSet<V1>): HashSet<V0> =>
    FromPredicate(self, (value) => !has(that, value as any));

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isSubset = <V0, V1>(self: HashSet<V0>, that: HashSet<V1>): boolean =>
{
    for (const ValueValueValueValueValue of self)
    {
        if (!has(that, ValueValueValueValueValue as any))
        {
            return false;
        }
    }

    return true;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const map = <V, U>(self: HashSet<V>, f: (value: V) => U): HashSet<U> =>
{
    let result = HashMap.empty<U, boolean>();
    for (const ValueValueValueValueValueValue of self)
    {
        result = HashMap.set(result, f(ValueValueValueValueValueValue), true);
    }

    return MakeImpl(result);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filter = <V>(self: HashSet<V>, predicate: (value: V) => boolean): HashSet<V> =>
    FromPredicate(self, predicate);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const some = <V>(self: HashSet<V>, predicate: (value: V) => boolean): boolean =>
{
    for (const ValueValueValueValueValueValueValue of self)
    {
        if (predicate(ValueValueValueValueValueValueValue))
        {
            return true;
        }
    }

    return false;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const every = <V>(self: HashSet<V>, predicate: (value: V) => boolean): boolean =>
{
    for (const ValueValueValueValueValueValueValueValue of self)
    {
        if (!predicate(ValueValueValueValueValueValueValueValue))
        {
            return false;
        }
    }

    return true;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const reduce = <V, U>(self: HashSet<V>, zero: U, f: (accumulator: U, value: V) => U): U =>
{
    let result = zero;
    for (const ValueValueValueValueValueValueValueValueValue of self)
    {
        result = f(result, ValueValueValueValueValueValueValueValueValue);
    }

    return result;
};
