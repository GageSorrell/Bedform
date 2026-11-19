/**
 * The persistent hash array mapped trie behind `HashMap`: construction, lookup,
 * structural updates, transient mutation and traversal. Ported from Effect
 * 4.0.5 as a Schema dependency.
 *
 * @module @bedform/effect/Internal/hashMap
 *
 * @file      hashMap.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, prefer-rest-params, @stylistic/max-len */

import * as Equal_ from "../Equal.js";
import { format } from "../Formatter.js";
import { dual, identity, pipe } from "../Function.js";
import * as Hash from "../Hash.js";
import type { Inspectable } from "../Inspectable.js";
import { NodeInspectSymbol, toJson } from "../Inspectable.js";
import * as Option from "../Option.js";
import type { Pipeable } from "../Pipeable.js";
import { pipeArguments } from "../Pipeable.js";
import { hasProperty } from "../Predicate.js";
import * as Result from "../Result.js";
import type { NoInfer } from "../Types.js";
import { backEdges } from "./hash.js";

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const HashMapTypeId = "~effect/HashMap";

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type HashMapTypeId = typeof HashMapTypeId;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface HashMap<out Key, out Value> extends Iterable<[Key, Value]>, Equal_.Equal, Pipeable, Inspectable
{
    readonly [HashMapTypeId]: HashMapTypeId
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace HashMap
{
    /**
     * Pure helper from the pinned Effect implementation.
     *
     * @category Utilities
     * @since 1.0.0
     */
    export type UpdateFn<V> = (option: Option.Option<V>) => Option.Option<V>;
}

// HAMT Implementation

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const Shift = 5;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const BucketSize = 1 << Shift; // 32

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
// const BitmapSize = 1 << Shift // 32

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const MinArrayNode = BucketSize / 4; // 8

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const MaxIndexNode = BucketSize / 2; // 16

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const BitmapIndexMask = BucketSize - 1; // 31

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const Popcount = (n: number): number =>
{
    n = n - ((n >>> 1) & 0x55_55_55_55);
    n = (n & 0x33_33_33_33) + ((n >>> 2) & 0x33_33_33_33);
    return (((n + (n >>> 4)) & 0xF_0F_0F_0F) * 0x1_01_01_01) >>> 24;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const Mask = (hash: number, shift: number): number => (hash >>> shift) & BitmapIndexMask;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const Bitpos = (hash: number, shift: number): number => 1 << Mask(hash, shift);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const Index = (bitmap: number, bit: number): number => Popcount(bitmap & (bit - 1));

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @throws { Error } When the input violates the operation’s preconditions.
 *
 * @category Utilities
 * @since 1.0.0
 */
function mergeLeaves<K, V>(
    edit: number,
    shift: number,
    hash1: number,
    node1: Node<K, V>,
    hash2: number,
    node2: Node<K, V>
): Node<K, V>
{
    if (shift > 32)
    {
        throw new Error("HashMap: max depth exceeded");
    }

    const Bit1 = Bitpos(hash1, shift);
    const Bit2 = Bitpos(hash2, shift);

    if (Bit1 === Bit2)
    {
        const Child = mergeLeaves(edit, shift + Shift, hash1, node1, hash2, node2);
        return new IndexedNode(edit, Bit1, [ Child ]);
    }

    const Bitmap = Bit1 | Bit2;
    const Children: Array<Node<K, V>> = (Bit1 >>> 0) < (Bit2 >>> 0)
        ? [ node1, node2 ]
        : [ node2, node1 ];

    return new IndexedNode(edit, Bitmap, Children);
}

const HashMapSeed = Hash.string("HashMap");

const EntryHash = (key: unknown, value: unknown): number => Hash.combine(Hash.hash(key), Hash.hash(value));

const ChildrenHash = <K, V>(children: ReadonlyArray<Node<K, V> | undefined>): number =>
{
    let h = 0;
    for (let i = 0; i < children.length; i++)
    {
        const ChildValue = children[i];
        if (ChildValue) {h ^= ChildValue.subtreeHash();}
    }

    return h;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
abstract class Node<K, V>
{
    abstract readonly _tag: "EmptyNode" | "LeafNode" | "IndexedNode" | "CollisionNode" | "ArrayNode";
    abstract readonly edit: number;
    abstract get size(): number;
    abstract get(shift: number, hash: number, key: K): Option.Option<V>;
    abstract has(shift: number, hash: number, key: K): boolean;
    abstract set(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>;
    abstract remove(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        removed: { value: boolean }
    ): Node<K, V> | undefined;

    canEdit(edit: number): boolean
    {
        return this.edit === edit;
    }

    /**
     *  Cached XOR of this subtree's entry hashes. Cleared by in-place edits.
     *
     * @category Utilities
     * @since 1.0.0
     */
    declare _hash: number | undefined;

    abstract computeHash(): number;

    subtreeHash(): number
    {
        let h = this._hash;
        if (h === undefined)
        {
            const Seen = backEdges;
            h = this.computeHash();
            // Cycle hashes depend on the entry point.
            if (Seen === backEdges)
            {
                this._hash = h;
            }
        }

        return h;
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class EmptyNode<K, V> extends Node<K, V>
{
    readonly _tag = "EmptyNode";

    readonly edit = 0;

    get size(): number
    {
        return 0;
    }

    get(_shift: number, _hash: number, _key: K): Option.Option<V>
    {
        return Option.none();
    }

    has(_shift: number, _hash: number, _key: K): boolean
    {
        return false;
    }

    set(
        edit: number,
        _shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>
    {
        added.value = true;
        return new LeafNode(edit, hash, key, value);
    }

    remove(
        _edit: number,
        _shift: number,
        _hash: number,
        _key: K,
        _removed: { value: boolean }
    ): Node<K, V> | undefined
    {
        return this;
    }

    override canEdit(_edit: number): boolean
    {
        return false;
    }

    computeHash(): number
    {
        return 0;
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class LeafNode<K, V> extends Node<K, V>
{
    readonly _tag = "LeafNode";

    edit: number;
    readonly hash: number;
    key: K;
    value: V;

    constructor(
        edit: number,
        hash: number,
        key: K,
        value: V
    )
    {
        super();
        this.edit = edit;
        this.hash = hash;
        this.key = key;
        this.value = value;
    }

    get size(): number
    {
        return 1;
    }

    get(_shift: number, hash: number, key: K): Option.Option<V>
    {
        if (this.hash === hash && Equal_.equals(this.key, key))
        {
            return Option.some(this.value);
        }

        return Option.none();
    }

    has(_shift: number, hash: number, key: K): boolean
    {
        return this.hash === hash && Equal_.equals(this.key, key);
    }

    set(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        if (this.hash === hash && Equal_.equals(this.key, key))
        {
            if (Equal_.equals(this.value, value))
            {
                return this;
            }

            // Can mutate in-place if edit matches
            if (this.canEdit(edit))
            {
                this.value = value;
                return this;
            }

            return new LeafNode(edit, hash, key, value);
        }

        added.value = true;

        if (this.hash === hash)
        {
            return new CollisionNode(edit, hash, [ [ this.key, this.value ], [ key, value ] ]);
        }

        const NewBit = Bitpos(hash, shift);
        const ExistingBit = Bitpos(this.hash, shift);

        if (NewBit === ExistingBit)
        {
            return new IndexedNode(
                edit,
                NewBit,
                [ this.set(edit, shift + Shift, hash, key, value, added) ]
            );
        }

        const BitmapValue = NewBit | ExistingBit;
        const Nodes: Array<Node<K, V>> = (NewBit >>> 0) < (ExistingBit >>> 0)
            ? [ new LeafNode(edit, hash, key, value), this ]
            : [ this, new LeafNode(edit, hash, key, value) ];

        return new IndexedNode(edit, BitmapValue, Nodes);
    }

    remove(
        _edit: number,
        _shift: number,
        hash: number,
        key: K,
        removed: { value: boolean }
    ): Node<K, V> | undefined
    {
        if (this.hash === hash && Equal_.equals(this.key, key))
        {
            removed.value = true;
            return undefined;
        }

        return this;
    }

    computeHash(): number
    {
    // `setHash` allows the stored hash to differ from `Hash.hash(key)`.
        return EntryHash(this.key, this.value);
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class CollisionNode<K, V> extends Node<K, V>
{
    readonly _tag = "CollisionNode";

    edit: number;
    readonly hash: number;
    entries: Array<[K, V]>;

    constructor(
        edit: number,
        hash: number,
        entries: Array<[K, V]>
    )
    {
        super();
        this.edit = edit;
        this.hash = hash;
        this.entries = entries;
    }

    get size(): number
    {
        return this.entries.length;
    }

    get(_shift: number, hash: number, key: K): Option.Option<V>
    {
        if (this.hash !== hash)
        {
            return Option.none();
        }

        for (const [ KValue, VValue ] of this.entries)
        {
            if (Equal_.equals(KValue, key))
            {
                return Option.some(VValue);
            }
        }

        return Option.none();
    }

    has(_shift: number, hash: number, key: K): boolean
    {
        if (this.hash !== hash)
        {
            return false;
        }

        for (const [ KValueValue ] of this.entries)
        {
            if (Equal_.equals(KValueValue, key))
            {
                return true;
            }
        }

        return false;
    }

    set(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        if (this.hash !== hash)
        {
            added.value = true;
            // Need to merge this collision node with new leaf
            return mergeLeaves(
                edit,
                shift,
                this.hash,
                this,
                hash,
                new LeafNode(edit, hash, key, value)
            );
        }

        // Same hash - update or add to collision list
        for (let i = 0; i < this.entries.length; i++)
        {
            if (Equal_.equals(this.entries[i][0], key))
            {
                if (Equal_.equals(this.entries[i][1], value))
                {
                    return this;
                }

                if (this.canEdit(edit))
                {
                    this.entries[i] = [ key, value ];
                    return this;
                }

                const NewEntries = [ ...this.entries ];
                NewEntries[i] = [ key, value ];
                return new CollisionNode(edit, this.hash, NewEntries);
            }
        }

        added.value = true;
        if (this.canEdit(edit))
        {
            this.entries.push([ key, value ]);
            return this;
        }

        return new CollisionNode(edit, this.hash, [ ...this.entries, [ key, value ] ]);
    }

    remove(
        edit: number,
        _shift: number,
        hash: number,
        key: K,
        removed: { value: boolean }
    ): Node<K, V> | undefined
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        if (this.hash !== hash)
        {
            return this;
        }

        const Idx = this.entries.findIndex(([ KValueValueValue ]) => Equal_.equals(KValueValueValue, key));
        if (Idx === -1)
        {
            return this;
        }

        removed.value = true;

        if (this.entries.length === 1)
        {
            return undefined;
        }

        if (this.entries.length === 2)
        {
            const Remaining = this.entries[Idx === 0 ? 1 : 0];
            return new LeafNode(edit, this.hash, Remaining[0], Remaining[1]);
        }

        if (this.canEdit(edit))
        {
            this.entries.splice(Idx, 1);
            return this;
        }

        const NewEntriesValue = [ ...this.entries ];
        NewEntriesValue.splice(Idx, 1);
        return new CollisionNode(edit, this.hash, NewEntriesValue);
    }

    computeHash(): number
    {
        let h = 0;
        const EntriesValue = this.entries;
        for (let i = 0; i < EntriesValue.length; i++)
        {
            h ^= EntryHash(EntriesValue[i][0], EntriesValue[i][1]);
        }

        return h;
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class IndexedNode<K, V> extends Node<K, V>
{
    readonly _tag = "IndexedNode";

    edit: number;
    private _size: number | undefined;
    bitmap: number;
    children: Array<Node<K, V>>;

    constructor(
        edit: number,
        bitmap: number,
        children: Array<Node<K, V>>
    )
    {
        super();
        this.edit = edit;
        this.bitmap = bitmap;
        this.children = children;
    }

    get size(): number
    {
        if (this._size === undefined)
        {
            this._size = this.children.reduce((acc, child) => acc + child.size, 0);
        }

        return this._size;
    }

    get(shift: number, hash: number, key: K): Option.Option<V>
    {
        const Bit = Bitpos(hash, shift);
        if ((this.bitmap & Bit) === 0)
        {
            return Option.none();
        }

        const IdxValue = Index(this.bitmap, Bit);
        return this.children[IdxValue].get(shift + Shift, hash, key);
    }

    has(shift: number, hash: number, key: K): boolean
    {
        const BitValue = Bitpos(hash, shift);
        if ((this.bitmap & BitValue) === 0)
        {
            return false;
        }

        const IdxValueValue = Index(this.bitmap, BitValue);
        return this.children[IdxValueValue].has(shift + Shift, hash, key);
    }

    set(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        const BitValueValue = Bitpos(hash, shift);
        const IdxValueValueValue = Index(this.bitmap, BitValueValue);

        if ((this.bitmap & BitValueValue) !== 0)
        {
            // Existing child - update it
            const ChildValueValue = this.children[IdxValueValueValue];
            const NewChild = ChildValueValue.set(edit, shift + Shift, hash, key, value, added);
            if (ChildValueValue === NewChild)
            {
                return this;
            }

            if (this.canEdit(edit))
            {
                this.children[IdxValueValueValue] = NewChild;
                return this;
            }

            const NewChildren = [ ...this.children ];
            NewChildren[IdxValueValueValue] = NewChild;
            return new IndexedNode(edit, this.bitmap, NewChildren);
        }
        else
        {
            // New child - insert
            added.value = true;
            const NewChildValue = new LeafNode(edit, hash, key, value);
            const NewBitmap = this.bitmap | BitValueValue;

            if (this.canEdit(edit))
            {
                this.children.splice(IdxValueValueValue, 0, NewChildValue);
                this.bitmap = NewBitmap;
                this._size = undefined;

                if (this.children.length > MaxIndexNode)
                {
                    return this.expand(edit, NewBitmap, this.children);
                }

                return this;
            }

            const NewChildrenValue = [ ...this.children ];
            NewChildrenValue.splice(IdxValueValueValue, 0, NewChildValue);

            if (NewChildrenValue.length > MaxIndexNode)
            {
                return this.expand(edit, NewBitmap, NewChildrenValue);
            }

            return new IndexedNode(edit, NewBitmap, NewChildrenValue);
        }
    }

    remove(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        removed: { value: boolean }
    ): Node<K, V> | undefined
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        const BitValueValueValue = Bitpos(hash, shift);
        if ((this.bitmap & BitValueValueValue) === 0)
        {
            return this;
        }

        const IdxValueValueValueValue = Index(this.bitmap, BitValueValueValue);
        const ChildValueValueValue = this.children[IdxValueValueValueValue];
        const NewChildValueValue = ChildValueValueValue.remove(edit, shift + Shift, hash, key, removed);

        if (!removed.value)
        {
            return this;
        }

        if (NewChildValueValue === undefined)
        {
            const NewBitmapValue = this.bitmap ^ BitValueValueValue;
            if (NewBitmapValue === 0)
            {
                return undefined;
            }

            if (this.children.length === 2)
            {
                const RemainingValue = this.children[IdxValueValueValueValue === 0 ? 1 : 0];
                if (RemainingValue._tag === "LeafNode")
                {
                    return RemainingValue;
                }
            }

            if (this.canEdit(edit))
            {
                this.children.splice(IdxValueValueValueValue, 1);
                this.bitmap = NewBitmapValue;
                this._size = undefined;
                return this;
            }

            const NewChildrenValueValue = [ ...this.children ];
            NewChildrenValueValue.splice(IdxValueValueValueValue, 1);
            return new IndexedNode(edit, NewBitmapValue, NewChildrenValueValue);
        }

        if (ChildValueValueValue === NewChildValueValue)
        {
            return this;
        }

        if (this.canEdit(edit))
        {
            this.children[IdxValueValueValueValue] = NewChildValueValue;
            return this;
        }

        const NewChildrenValueValueValue = [ ...this.children ];
        NewChildrenValueValueValue[IdxValueValueValueValue] = NewChildValueValue;
        return new IndexedNode(edit, this.bitmap, NewChildrenValueValueValue);
    }

    private expand(edit: number, bitmap: number, children: Array<Node<K, V>>): ArrayNode<K, V>
    {
        const NodesValue: Array<Node<K, V> | undefined> = new globalThis.Array(BucketSize);
        let j = 0;
        for (let i = 0; i < BucketSize; i++)
        {
            if ((bitmap & (1 << i)) !== 0)
            {
                NodesValue[i] = children[j++];
            }
        }

        return new ArrayNode(edit, children.length, NodesValue);
    }

    computeHash(): number
    {
        return ChildrenHash(this.children);
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class ArrayNode<K, V> extends Node<K, V>
{
    readonly _tag = "ArrayNode";

    edit: number;
    private _size: number | undefined;
    count: number;
    children: Array<Node<K, V> | undefined>;

    constructor(
        edit: number,
        count: number,
        children: Array<Node<K, V> | undefined>
    )
    {
        super();
        this.edit = edit;
        this.count = count;
        this.children = children;
    }

    get size(): number
    {
        if (this._size === undefined)
        {
            this._size = this.children.reduce<number>((acc, child) => acc + (child?.size ?? 0), 0);
        }

        return this._size;
    }

    get(shift: number, hash: number, key: K): Option.Option<V>
    {
        const IdxValueValueValueValueValue = Mask(hash, shift);
        const ChildValueValueValueValue = this.children[IdxValueValueValueValueValue];
        return ChildValueValueValueValue ? ChildValueValueValueValue.get(shift + Shift, hash, key) : Option.none();
    }

    has(shift: number, hash: number, key: K): boolean
    {
        const IdxValueValueValueValueValueValue = Mask(hash, shift);
        const ChildValueValueValueValueValue = this.children[IdxValueValueValueValueValueValue];
        return ChildValueValueValueValueValue ? ChildValueValueValueValueValue.has(shift + Shift, hash, key) : false;
    }

    set(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        value: V,
        added: { value: boolean }
    ): Node<K, V>
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        const IdxValueValueValueValueValueValueValue = Mask(hash, shift);
        const ChildValueValueValueValueValueValue = this.children[IdxValueValueValueValueValueValueValue];

        if (ChildValueValueValueValueValueValue)
        {
            const NewChildValueValueValue = ChildValueValueValueValueValueValue.set(edit, shift + Shift, hash, key, value, added);
            if (ChildValueValueValueValueValueValue === NewChildValueValueValue)
            {
                return this;
            }

            if (this.canEdit(edit))
            {
                this.children[IdxValueValueValueValueValueValueValue] = NewChildValueValueValue;
                return this;
            }

            const NewChildrenValueValueValueValue = [ ...this.children ];
            NewChildrenValueValueValueValue[IdxValueValueValueValueValueValueValue] = NewChildValueValueValue;
            return new ArrayNode(edit, this.count, NewChildrenValueValueValueValue);
        }
        else
        {
            added.value = true;
            const NewChildValueValueValueValue = new LeafNode(edit, hash, key, value);

            if (this.canEdit(edit))
            {
                this.children[IdxValueValueValueValueValueValueValue] = NewChildValueValueValueValue;
                this.count++;
                this._size = undefined;
                return this;
            }

            const NewChildrenValueValueValueValueValue = [ ...this.children ];
            NewChildrenValueValueValueValueValue[IdxValueValueValueValueValueValueValue] = NewChildValueValueValueValue;
            return new ArrayNode(edit, this.count + 1, NewChildrenValueValueValueValueValue);
        }
    }

    remove(
        edit: number,
        shift: number,
        hash: number,
        key: K,
        removed: { value: boolean }
    ): Node<K, V> | undefined
    {
        if (this.canEdit(edit)) {this._hash = undefined;}

        const IdxValueValueValueValueValueValueValueValue = Mask(hash, shift);
        const ChildValueValueValueValueValueValueValue = this.children[IdxValueValueValueValueValueValueValueValue];

        if (!ChildValueValueValueValueValueValueValue)
        {
            return this;
        }

        const NewChildValueValueValueValueValue = ChildValueValueValueValueValueValueValue.remove(edit, shift + Shift, hash, key, removed);

        if (!removed.value)
        {
            return this;
        }

        const NewCount = this.count - (NewChildValueValueValueValueValue ? 0 : 1);

        if (NewCount < MinArrayNode)
        {
            return this.pack(edit, IdxValueValueValueValueValueValueValueValue, NewChildValueValueValueValueValue);
        }

        if (ChildValueValueValueValueValueValueValue === NewChildValueValueValueValueValue)
        {
            return this;
        }

        if (this.canEdit(edit))
        {
            this.children[IdxValueValueValueValueValueValueValueValue] = NewChildValueValueValueValueValue;
            if (!NewChildValueValueValueValueValue)
            {
                this.count = NewCount;
            }

            this._size = undefined;
            return this;
        }

        const NewChildrenValueValueValueValueValueValue = [ ...this.children ];
        NewChildrenValueValueValueValueValueValue[IdxValueValueValueValueValueValueValueValue] = NewChildValueValueValueValueValue;
        return new ArrayNode(edit, NewCount, NewChildrenValueValueValueValueValueValue);
    }

    private pack(
        edit: number,
        excludeIdx: number,
        newChild: Node<K, V> | undefined
    ): IndexedNode<K, V>
    {
        const ChildrenValue: Array<Node<K, V>> = [];
        let bitmap = 0;
        let bit = 1;

        for (let i = 0; i < this.children.length; i++)
        {
            const ChildValueValueValueValueValueValueValueValue = i === excludeIdx ? newChild : this.children[i];
            if (ChildValueValueValueValueValueValueValueValue)
            {
                ChildrenValue.push(ChildValueValueValueValueValueValueValueValue);
                bitmap |= bit;
            }

            bit <<= 1;
        }

        return new IndexedNode(edit, bitmap, ChildrenValue);
    }

    computeHash(): number
    {
        return ChildrenHash(this.children);
    }
}

class HashMapIterator<K, V, A> implements IterableIterator<A>
{
    readonly stack: Array<Node<K, V>>;
    readonly project: (key: K, value: V) => A;
    entries: Array<[K, V]> = [];
    index = 0;

    constructor(root: Node<K, V>, project: (key: K, value: V) => A)
    {
        this.stack = [ root ];
        this.project = project;
    }

    next(): IteratorResult<A>
    {
        while (true)
        {
            if (this.index < this.entries.length)
            {
                const Entry = this.entries[this.index++];
                return { done: false,
                    value: this.project(Entry[0], Entry[1]) };
            }

            if (this.stack.length === 0)
            {
                return { done: true,
                    value: undefined };
            }

            const NodeValue = this.stack.pop()!;
            switch (NodeValue._tag)
            {
                case "LeafNode": {
                    const Leaf = NodeValue as LeafNode<K, V>;
                    return { done: false,
                        value: this.project(Leaf.key, Leaf.value) };
                }

                case "CollisionNode": {
                    this.entries = (NodeValue as CollisionNode<K, V>).entries;
                    this.index = 0;
                    break;
                }

                case "IndexedNode":
                case "ArrayNode": {
                    const ChildrenValueValue = (NodeValue as IndexedNode<K, V> | ArrayNode<K, V>).children;
                    for (let i = ChildrenValueValue.length - 1; i >= 0; i--)
                    {
                        const ChildValueValueValueValueValueValueValueValueValue = ChildrenValueValue[i];
                        if (ChildValueValueValueValueValueValueValueValueValue) {this.stack.push(ChildValueValueValueValueValueValueValueValueValue);}
                    }
                }
            }
        }
    }

    [Symbol.iterator](): IterableIterator<A>
    {
        return this;
    }
}

const ToEntry = <K, V>(key: K, value: V): [K, V] => [ key, value ];
const ToValue = <V>(_: unknown, value: V): V => value;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
class HashMapImpl<K, V> implements HashMap<K, V>
{
    readonly [HashMapTypeId]: HashMapTypeId = HashMapTypeId;

    _editable: boolean;
    _edit: number;
    _root: Node<K, V>;
    _size: number;

    constructor(
        editable: boolean,
        edit: number,
        root: Node<K, V>,
        size: number
    )
    {
        this._editable = editable;
        this._edit = edit;
        this._root = root;
        this._size = size;
    }

    get size(): number
    {
        return this._size;
    }

    [Symbol.iterator](): IterableIterator<[K, V]>
    {
        return new HashMapIterator(this._root, ToEntry);
    }

    [Equal_.symbol](that: Equal_.Equal): boolean
    {
        if (isHashMap(that))
        {
            const ThatImpl = that as HashMapImpl<K, V>;
            if (this.size !== ThatImpl.size)
            {
                return false;
            }

            for (const [ KeyValueValue, ValueValue ] of this)
            {
                const OtherValue = pipe(that, get(KeyValueValue));
                if (Option.isNone(OtherValue) || !Equal_.equals(ValueValue, OtherValue.value))
                {
                    return false;
                }
            }

            return true;
        }

        return false;
    }

    [Hash.symbol](): number
    {
        return Hash.optimize(HashMapSeed ^ this._root.subtreeHash());
    }

    [NodeInspectSymbol](): unknown
    {
        return toJson(this);
    }

    toString(): string
    {
        return `HashMap(${format(Array.from(this))})`;
    }

    toJSON(): unknown
    {
        return {
            _id: "HashMap",
            values: Array.from(this).map(([ k, v ]) => [ toJson(k), toJson(v) ])
        };
    }

    pipe()
    {
        return pipeArguments(this, arguments);
    }
}

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
const EmptyNodeValue = new EmptyNode<any, any>();

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isHashMap: {
    <K, V>(u: Iterable<readonly [K, V]>): u is HashMap<K, V>
    (u: unknown): u is HashMap<unknown, unknown>
} = (u: unknown): u is HashMap<unknown, unknown> => hasProperty(u, HashMapTypeId);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const empty = <K = never, V = never>(): HashMap<K, V> => new HashMapImpl(false, 0, EmptyNodeValue, 0);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const make = <Entries extends ReadonlyArray<readonly [any, any]>>(
    ...entries: Entries
): HashMap<
    Entries[number] extends readonly [infer K, any] ? K : never,
    Entries[number] extends readonly [any, infer V] ? V : never
> => fromIterable(entries);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromIterable = <K, V>(entries: Iterable<readonly [K, V]>): HashMap<K, V> =>
{
    let root: Node<K, V> = EmptyNodeValue;
    let size = 0;
    const Added = { value: false };

    for (const [ KeyValueValueValue, ValueValueValue ] of entries)
    {
        const HashValue = Hash.hash(KeyValueValueValue);
        Added.value = false;
        root = root.set(NaN, 0, HashValue, KeyValueValueValue, ValueValueValue, Added);
        if (Added.value)
        {
            size++;
        }
    }

    return new HashMapImpl(false, 0, root, size);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isEmpty = <K, V>(self: HashMap<K, V>): boolean => (self as HashMapImpl<K, V>).size === 0;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const get = dual<
    <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => Option.Option<V>,
    <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => Option.Option<V>
>(2, <K, V>(self: HashMap<K, V>, key: K): Option.Option<V> =>
{
    const Impl = self as HashMapImpl<K, V>;
    return Impl._root.get(0, Hash.hash(key), key);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getHash = dual<
    <K1 extends K, K>(key: K1, hash: number) => <V>(self: HashMap<K, V>) => Option.Option<V>,
    <K1 extends K, K, V>(self: HashMap<K, V>, key: K1, hash: number) => Option.Option<V>
>(3, <K, V>(self: HashMap<K, V>, key: K, hash: number): Option.Option<V> =>
{
    const ImplValue = self as HashMapImpl<K, V>;
    return ImplValue._root.get(0, hash, key);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getUnsafe = dual<
    <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => V,
    <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => V
>(2, <K, V>(self: HashMap<K, V>, key: K): V =>
{
    const ResultValue = get(self, key);
    if (Option.isSome(ResultValue))
    {
        return ResultValue.value;
    }

    throw new Error(`HashMap.getUnsafe: key not found: ${key}`);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const has = dual<
    <K1 extends K, K>(key: K1) => <V>(self: HashMap<K, V>) => boolean,
    <K1 extends K, K, V>(self: HashMap<K, V>, key: K1) => boolean
>(2, <K, V>(self: HashMap<K, V>, key: K): boolean =>
{
    const ImplValueValue = self as HashMapImpl<K, V>;
    return ImplValueValue._root.has(0, Hash.hash(key), key);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const hasHash = dual<
    <K1 extends K, K>(key: K1, hash: number) => <V>(self: HashMap<K, V>) => boolean,
    <K1 extends K, K, V>(self: HashMap<K, V>, key: K1, hash: number) => boolean
>(3, <K, V>(self: HashMap<K, V>, key: K, hash: number): boolean =>
{
    const ImplValueValueValue = self as HashMapImpl<K, V>;
    return ImplValueValueValue._root.has(0, hash, key);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const hasBy = dual<
    <K, V>(predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean) => (self: HashMap<K, V>) => boolean,
    <K, V>(self: HashMap<K, V>, predicate: (value: NoInfer<V>, key: NoInfer<K>) => boolean) => boolean
>(2, <K, V>(self: HashMap<K, V>, predicate: (value: V, key: K) => boolean): boolean =>
{
    for (const [ KeyValueValueValueValue, ValueValueValueValue ] of self)
    {
        if (predicate(ValueValueValueValue, KeyValueValueValueValue))
        {
            return true;
        }
    }

    return false;
});

const SetHash = <K, V>(self: HashMap<K, V>, key: K, hash: number, value: V): HashMap<K, V> =>
{
    const ImplValueValueValueValue = self as HashMapImpl<K, V>;
    const AddedValue = { value: false };

    // Pass edit context: use current edit if editable, otherwise NaN (never matches any edit)
    const Edit = ImplValueValueValueValue._editable ? ImplValueValueValueValue._edit : NaN;
    const NewRoot = ImplValueValueValueValue._root.set(Edit, 0, hash, key, value, AddedValue);

    if (ImplValueValueValueValue._editable)
    {
    // In-place mutation
        ImplValueValueValueValue._root = NewRoot;
        if (AddedValue.value)
        {
            ImplValueValueValueValue._size++;
        }

        return self;
    }

    // Immutable: create new instance if changed
    if (ImplValueValueValueValue._root === NewRoot)
    {
        return self;
    }

    return new HashMapImpl(false, ImplValueValueValueValue._edit, NewRoot, ImplValueValueValueValue._size + (AddedValue.value ? 1 : 0));
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const set = dual<
    <K, V>(key: K, value: V) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, key: K, value: V) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, value: V): HashMap<K, V> =>
{
    return SetHash(self, key, Hash.hash(key), value);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const keys = <K, V>(self: HashMap<K, V>): IterableIterator<K> =>
    new HashMapIterator((self as HashMapImpl<K, V>)._root, identity);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const values = <K, V>(self: HashMap<K, V>): IterableIterator<V> =>
    new HashMapIterator((self as HashMapImpl<K, V>)._root, ToValue);

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const entries = <K, V>(self: HashMap<K, V>): IterableIterator<[K, V]> =>
    (self as HashMapImpl<K, V>)[Symbol.iterator]();

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const size = <K, V>(self: HashMap<K, V>): number => (self as HashMapImpl<K, V>).size;

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const beginMutation = <K, V>(self: HashMap<K, V>): HashMap<K, V> =>
{
    const ImplValueValueValueValueValue = self as HashMapImpl<K, V>;
    return new HashMapImpl(true, ImplValueValueValueValueValue._edit + 1, ImplValueValueValueValueValue._root, ImplValueValueValueValueValue._size);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const endMutation = <K, V>(self: HashMap<K, V>): HashMap<K, V> =>
{
    const ImplValueValueValueValueValueValue = self as HashMapImpl<K, V>;
    ImplValueValueValueValueValueValue._editable = false;
    return self;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mutate = dual<
    <K, V>(f: (self: HashMap<K, V>) => void) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, f: (self: HashMap<K, V>) => void) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, f: (self: HashMap<K, V>) => void): HashMap<K, V> =>
{
    const Mutable = beginMutation(self);
    f(Mutable);
    return endMutation(Mutable);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const modifyAt = dual<
    <K, V>(key: K, f: HashMap.UpdateFn<V>) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, key: K, f: HashMap.UpdateFn<V>) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, f: HashMap.UpdateFn<V>): HashMap<K, V> =>
{
    const Current = get(self, key);
    const Updated = f(Current);

    if (Option.isNone(Updated))
    {
        return has(self, key) ? remove(self, key) : self;
    }

    return set(self, key, Updated.value);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const modifyHash = dual<
    <K, V>(key: K, hash: number, f: HashMap.UpdateFn<V>) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, key: K, hash: number, f: HashMap.UpdateFn<V>) => HashMap<K, V>
>(4, <K, V>(self: HashMap<K, V>, key: K, hash: number, f: HashMap.UpdateFn<V>): HashMap<K, V> =>
{
    const CurrentValue = getHash(self, key, hash);
    const UpdatedValue = f(CurrentValue);

    if (Option.isNone(UpdatedValue))
    {
        return hasHash(self, key, hash) ? RemoveHash(self, key, hash) : self;
    }

    return SetHash(self, key, hash, UpdatedValue.value);
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const modify = dual<
    <K, V>(key: K, f: (v: V) => V) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, key: K, f: (v: V) => V) => HashMap<K, V>
>(3, <K, V>(self: HashMap<K, V>, key: K, f: (v: V) => V): HashMap<K, V> =>
{
    return modifyAt(self, key, Option.map(f));
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const union = dual<
    <K1, V1>(that: HashMap<K1, V1>) => <K0, V0>(self: HashMap<K0, V0>) => HashMap<K1 | K0, V1 | V0>,
    <K0, V0, K1, V1>(self: HashMap<K0, V0>, that: HashMap<K1, V1>) => HashMap<K0 | K1, V0 | V1>
>(2, <K0, V0, K1, V1>(self: HashMap<K0, V0>, that: HashMap<K1, V1>): HashMap<K0 | K1, V0 | V1> =>
{
    let result = self as HashMap<K0 | K1, V0 | V1>;
    for (const [ KeyValueValueValueValueValue, ValueValueValueValueValue ] of that)
    {
        result = set(result, KeyValueValueValueValueValue, ValueValueValueValueValue);
    }

    return result;
});

const RemoveHash = <K, V>(self: HashMap<K, V>, key: K, hash: number): HashMap<K, V> =>
{
    const ImplValueValueValueValueValueValueValue = self as HashMapImpl<K, V>;
    const Removed = { value: false };

    const EditValue = ImplValueValueValueValueValueValueValue._editable ? ImplValueValueValueValueValueValueValue._edit : NaN;
    const NewRootValue = ImplValueValueValueValueValueValueValue._root.remove(EditValue, 0, hash, key, Removed);

    if (!Removed.value)
    {
        return self;
    }

    if (ImplValueValueValueValueValueValueValue._editable)
    {
        ImplValueValueValueValueValueValueValue._root = NewRootValue ?? EmptyNodeValue;
        ImplValueValueValueValueValueValueValue._size--;
        return self;
    }

    if (NewRootValue === undefined)
    {
        return empty();
    }

    return new HashMapImpl(false, ImplValueValueValueValueValueValueValue._edit, NewRootValue, ImplValueValueValueValueValueValueValue._size - 1);
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const remove = dual<
    <K>(key: K) => <V>(self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, key: K) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, key: K): HashMap<K, V> =>
{
    return RemoveHash(self, key, Hash.hash(key));
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const removeMany = dual<
    <K>(keys: Iterable<K>) => <V>(self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, keys: Iterable<K>) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, keys: Iterable<K>): HashMap<K, V> =>
{
    let result = self;
    for (const KeyValue of keys)
    {
        result = remove(result, KeyValue);
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const setMany = dual<
    <K, V>(entries: Iterable<readonly [K, V]>) => (self: HashMap<K, V>) => HashMap<K, V>,
    <K, V>(self: HashMap<K, V>, entries: Iterable<readonly [K, V]>) => HashMap<K, V>
>(2, <K, V>(self: HashMap<K, V>, entries: Iterable<readonly [K, V]>): HashMap<K, V> =>
{
    let result = self;
    for (const [ KeyValueValueValueValueValueValue, ValueValueValueValueValueValue ] of entries)
    {
        result = set(result, KeyValueValueValueValueValueValue, ValueValueValueValueValueValue);
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const map = dual<
    <A, V, K>(f: (value: V, key: K) => A) => (self: HashMap<K, V>) => HashMap<K, A>,
    <K, V, A>(self: HashMap<K, V>, f: (value: V, key: K) => A) => HashMap<K, A>
>(2, <K, V, A>(self: HashMap<K, V>, f: (value: V, key: K) => A): HashMap<K, A> =>
{
    let result = empty<K, A>();
    for (const [ KeyValueValueValueValueValueValueValue, ValueValueValueValueValueValueValue ] of self)
    {
        result = set(result, KeyValueValueValueValueValueValueValue, f(ValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValue));
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const flatMap = dual<
    <A, K, B>(f: (value: A, key: K) => HashMap<K, B>) => (self: HashMap<K, A>) => HashMap<K, B>,
    <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => HashMap<K, B>) => HashMap<K, B>
>(2, <K, A, B>(self: HashMap<K, A>, f: (value: A, key: K) => HashMap<K, B>): HashMap<K, B> =>
{
    let result = empty<K, B>();
    for (const [ KeyValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValue ] of self)
    {
        result = union(result, f(ValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValue));
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const forEach = dual<
    <V, K>(f: (value: V, key: K) => void) => (self: HashMap<K, V>) => void,
    <V, K>(self: HashMap<K, V>, f: (value: V, key: K) => void) => void
>(2, <V, K>(self: HashMap<K, V>, f: (value: V, key: K) => void): void =>
{
    for (const [ KeyValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValue ] of self)
    {
        f(ValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValue);
    }
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const reduce = dual<
    <Z, V, K>(zero: Z, f: (accumulator: Z, value: V, key: K) => Z) => (self: HashMap<K, V>) => Z,
    <K, V, Z>(self: HashMap<K, V>, zero: Z, f: (accumulator: Z, value: V, key: K) => Z) => Z
>(3, <K, V, Z>(self: HashMap<K, V>, zero: Z, f: (accumulator: Z, value: V, key: K) => Z): Z =>
{
    let result = zero;
    for (const [ KeyValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        result = f(result, ValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValue);
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filter = dual<
    <K, A>(f: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => HashMap<K, A>,
    <K, A>(self: HashMap<K, A>, f: (a: A, k: K) => boolean) => HashMap<K, A>
>(2, <K, A>(self: HashMap<K, A>, f: (a: A, k: K) => boolean) =>
{
    let result = empty<K, A>();
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        if (f(ValueValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValueValue))
        {
            result = set(result, KeyValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValue);
        }
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const compact = <K, A>(self: HashMap<K, Option.Option<A>>): HashMap<K, A> =>
{
    let result = empty<K, A>();
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        if (Option.isSome(ValueValueValueValueValueValueValueValueValueValueValueValue))
        {
            result = set(result, KeyValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValue.value);
        }
    }

    return result;
};

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const filterMap = dual<
    <A, K, B, X>(f: (input: A, key: K) => Result.Result<B, X>) => (self: HashMap<K, A>) => HashMap<K, B>,
    <K, A, B, X>(self: HashMap<K, A>, f: (input: A, key: K) => Result.Result<B, X>) => HashMap<K, B>
>(2, <K, A, B, X>(self: HashMap<K, A>, f: (input: A, key: K) => Result.Result<B, X>): HashMap<K, B> =>
{
    let result = empty<K, B>();
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        const Mapped = f(ValueValueValueValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValueValueValueValue);
        if (Result.isSuccess(Mapped))
        {
            result = set(result, KeyValueValueValueValueValueValueValueValueValueValueValueValueValue, Mapped.success);
        }
    }

    return result;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const findFirst = dual<
    <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => Option.Option<[K, A]>,
    <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => Option.Option<[K, A]>
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) =>
{
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        if (predicate(ValueValueValueValueValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValue))
        {
            return Option.some([ KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValueValueValue ]);
        }
    }

    return Option.none();
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const some = dual<
    <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => boolean,
    <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => boolean
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean): boolean =>
{
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        if (predicate(ValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue))
        {
            return true;
        }
    }

    return false;
});

/**
 * Pure helper from the pinned Effect implementation.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const every = dual<
    <K, A>(predicate: (a: NoInfer<A>, k: K) => boolean) => (self: HashMap<K, A>) => boolean,
    <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean) => boolean
>(2, <K, A>(self: HashMap<K, A>, predicate: (a: A, k: K) => boolean): boolean =>
{
    for (const [ KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue, ValueValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue ] of self)
    {
        if (!predicate(ValueValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue, KeyValueValueValueValueValueValueValueValueValueValueValueValueValueValueValueValue))
        {
            return false;
        }
    }

    return true;
});

/* Preserve multiple statements in upstream traversal loops. */

