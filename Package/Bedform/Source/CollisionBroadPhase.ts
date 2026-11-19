/**
 * Explicit dynamic AABB tree with private mutable buffers and frozen snapshots.
 *
 * @module bedform/CollisionBroadPhase
 *
 * @file      CollisionBroadPhase.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document operation constants at their export declarations. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Tree topology and AABB fields retain geometric ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as B from "./AABB.js";
import type { Diagnostic } from "./Collision.js";
import * as O from "@bedform/effect/Option";
import * as R from "@bedform/effect/Result";
import { dual } from "@bedform/effect/Function";

const TypeId = "~bedform/CollisionBroadPhase" as const;
const Trees = new WeakMap<Tree, Data>();

/**
 * Opaque index handle. Tree operations mutate only private buffers; published
 * entries and pair/query snapshots never change after publication.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Tree
{
    readonly [TypeId]: typeof TypeId;
}

/**
 * Authoritative body bound. Static/static pairs are excluded from candidate output.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Entry
{
    readonly id: string;
    readonly bounds: B.Coordinates;
    readonly mode: "dynamic" | "static" | "kinematic";
}

/**
 * Ordered IDs of two overlapping authoritative AABBs, with first less than second.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Pair
{
    readonly first: string;
    readonly second: string;
}

/**
 * Optional fat margin and body capacity; no world subscriptions start automatically.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly margin?: number;
    readonly capacity?: number;
}

/**
 * Private mutable AVL node with a conservative fat box at each leaf.
 *
 * @category Types
 * @since 1.0.0
 */
interface Node
{
    parent?: Node;
    left?: Node;
    right?: Node;
    height: number;
    active: boolean;
    bounds: B.AABB;
    entry?: Entry;
}

/**
 * Private tree buffers and insertion-ordered body lookup.
 *
 * @category Types
 * @since 1.0.0
 */
interface Data
{
    root?: Node;
    leaves: Map<string, Node>;
    margin: number;
    capacity: number;
}

/**
 * Converts tree input failures to the shared typed collision diagnostic contract.
 *
 * @category Internal
 * @since 1.0.0
 */
const attempt = <A>(run: () => A): R.Result<A, Diagnostic> =>
{
    try
    {
        return R.succeed(run());
    }
    catch (error)
    {
        return R.fail(Object.freeze({ _tag: "CollisionError",
            code: error instanceof Error && /(?:capacity|budget) exceeded/u.test(error.message) ? "ComplexityLimit" : "InvalidInput",
            stage: "bvh",
            message: error instanceof Error ? error.message : "Invalid broad-phase input" }));
    }
};

/**
 * Validates and creates an empty index with a bounded capacity.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = (options: Options = {}): R.Result<Tree, Diagnostic> =>
{
    return attempt(() =>
    {
        const Margin = options.margin ?? 0.1;
        const Capacity = options.capacity ?? 16_384;
        if (!Number.isFinite(Margin) || Margin < 0 || Margin > 1e6 || !Number.isSafeInteger(Capacity) || Capacity < 1 || Capacity > 65_536)
        {
            throw new Error("Invalid tree margin/capacity");
        }

        const Tree: Tree = Object.freeze({ [TypeId]: TypeId });
        Trees.set(Tree, { leaves: new Map(),
            margin: Margin,
            capacity: Capacity });
        return Tree;
    });
};

/**
 * Retrieves a private index, rejecting forged handles.
 *
 * @throws { Error } Unknown index handle.
 *
 * @category Internal
 * @since 1.0.0
 */
const data = (self: Tree): Data =>
{
    const Data = Trees.get(self);
    if (!Data)
    {
        throw new Error("Unrecognized broad-phase index");
    }

    return Data;
};

/**
 * Recomputes an internal node's exact enclosing box and height.
 *
 * @category Internal
 * @since 1.0.0
 */
const refit = (node: Node): void =>
{
    if (node.left && node.right)
    {
        node.bounds = O.getOrThrow(B.union(node.left.bounds, node.right.bounds));
        node.height = 1 + Math.max(node.left.height, node.right.height);
        node.active = node.left.active || node.right.active;
    }
};

/**
 * Performs a parent-preserving left or right AVL rotation.
 *
 * @category Internal
 * @since 1.0.0
 */
const rotate = (tree: Data, root: Node, left: boolean): Node =>
{
    const Pivot = (left ? root.right : root.left)!;
    const Parent = root.parent;
    if (left)
    {
        root.right = Pivot.left;
        root.right!.parent = root;
        Pivot.left = root;
    }
    else
    {
        root.left = Pivot.right;
        root.left!.parent = root;
        Pivot.right = root;
    }

    root.parent = Pivot;
    Pivot.parent = Parent;
    if (!Parent)
    {
        tree.root = Pivot;
    }
    else if (Parent.left === root)
    {
        Parent.left = Pivot;
    }
    else
    {
        Parent.right = Pivot;
    }

    refit(root);
    refit(Pivot);
    return Pivot;
};

/**
 * Rebalances ancestors after insertion/removal; ties retain deterministic structure.
 *
 * @category Internal
 * @since 1.0.0
 */
const balance = (tree: Data, node: Node | undefined): void =>
{
    while (node)
    {
        refit(node);
        if (node.left && node.right)
        {
            const Difference = node.right.height - node.left.height;
            if (Difference > 1)
            {
                if (node.right.left!.height > node.right.right!.height)
                {
                    rotate(tree, node.right, false);
                }

                node = rotate(tree, node, true);
            }
            else if (Difference < -1)
            {
                if (node.left.right!.height > node.left.left!.height)
                {
                    rotate(tree, node.left, true);
                }

                node = rotate(tree, node, false);
            }
        }

        node = node.parent;
    }
};

/**
 * Surface-area heuristic for sibling selection.
 *
 * @category Internal
 * @since 1.0.0
 */
const area = (box: B.AABB): number =>
{
    const Size = O.getOrThrow(B.size(box));
    return 2 * (Size.x * Size.y + Size.y * Size.z + Size.z * Size.x);
};

/**
 * Removes a leaf and its old parent, then refits/balances ancestors.
 *
 * @category Internal
 * @since 1.0.0
 */
const detach = (tree: Data, leaf: Node): void =>
{
    const Parent = leaf.parent;
    if (!Parent)
    {
        tree.root = undefined;
        return;
    }

    const Sibling = Parent.left === leaf ? Parent.right! : Parent.left!;
    const Grand = Parent.parent;
    Sibling.parent = Grand;
    if (!Grand)
    {
        tree.root = Sibling;
    }
    else if (Grand.left === Parent)
    {
        Grand.left = Sibling;
    }
    else
    {
        Grand.right = Sibling;
    }

    leaf.parent = undefined;
    balance(tree, Grand);
};

/**
 * Inserts a leaf by minimum enlargement and deterministic branch tie-breaking.
 *
 * @category Internal
 * @since 1.0.0
 */
const attach = (tree: Data, leaf: Node): void =>
{
    if (!tree.root)
    {
        tree.root = leaf;
        return;
    }

    let sibling = tree.root;
    while (sibling.left && sibling.right)
    {
        const LeftCost = area(O.getOrThrow(B.union(sibling.left.bounds, leaf.bounds))) - area(sibling.left.bounds);
        const RightCost = area(O.getOrThrow(B.union(sibling.right.bounds, leaf.bounds))) - area(sibling.right.bounds);
        sibling = LeftCost <= RightCost ? sibling.left : sibling.right;
    }

    const OldParent = sibling.parent;
    const Parent: Node = { parent: OldParent,
        left: sibling,
        right: leaf,
        height: sibling.height + 1,
        active: sibling.active || leaf.active,
        bounds: O.getOrThrow(B.union(sibling.bounds, leaf.bounds)) };
    sibling.parent = Parent;
    leaf.parent = Parent;
    if (!OldParent)
    {
        tree.root = Parent;
    }
    else if (OldParent.left === sibling)
    {
        OldParent.left = Parent;
    }
    else
    {
        OldParent.right = Parent;
    }

    balance(tree, Parent);
};

/**
 * Copies a validated body entry; all snapshots own deeply frozen math values.
 *
 * @throws { Error } Malformed entry or excessive coordinate domain.
 *
 * @category Internal
 * @since 1.0.0
 */
const entry = (input: Entry): Entry =>
{
    if (!input || typeof input.id !== "string" || !input.id.length || input.id.length > 256 || ![ "dynamic", "static", "kinematic" ].includes(input.mode) ||
        !B.isValid(input.bounds) || O.getOrThrow(B.corners(input.bounds)).some((p) => Math.hypot(p.x, p.y, p.z) > 1e9))
    {
        throw new Error("Invalid broad-phase entry");
    }

    return Object.freeze({ id: input.id,
        mode: input.mode,
        bounds: B.AABBUnsafe(input.bounds.min, input.bounds.max) });
};

/**
 * Adds or updates an authoritative AABB, reinserting only when it escapes its fat box.
 * Both data-first and data-last calls operate on the explicitly created index.
 *
 * @category Updates
 * @since 1.0.0
 */
export const set: {
    (self: Tree, value: Entry): R.Result<void, Diagnostic>;
    (value: Entry): (self: Tree) => R.Result<void, Diagnostic>;
} = dual(2, (self: Tree, value: Entry) => attempt(() =>
{
    const Tree = data(self);
    const Value = entry(value);
    const Existing = Tree.leaves.get(Value.id);
    const Fat = O.getOrThrow(B.expand(Value.bounds, Tree.margin));
    if (!Existing && Tree.leaves.size >= Tree.capacity)
    {
        throw new Error("Broad-phase capacity exceeded");
    }

    if (Existing && O.getOrThrow(B.containsBox(Existing.bounds, Value.bounds)))
    {
        Existing.entry = Value;
        Existing.active = Value.mode !== "static";
        balance(Tree, Existing.parent);
        return;
    }

    if (Existing)
    {
        detach(Tree, Existing);
    }

    const Leaf: Node = { height: 0,
        active: Value.mode !== "static",
        bounds: Fat,
        entry: Value };
    Tree.leaves.set(Value.id, Leaf);
    attach(Tree, Leaf);
}));

/**
 * Idempotently removes a body; the successful boolean reports whether it existed.
 *
 * @category Updates
 * @since 1.0.0
 */
export const remove: {
    (self: Tree, id: string): R.Result<boolean, Diagnostic>;
    (id: string): (self: Tree) => R.Result<boolean, Diagnostic>;
} = dual(2, (self: Tree, id: string) => attempt(() =>
{
    if (typeof id !== "string" || !id.length)
    {
        throw new Error("Invalid body ID");
    }

    const Tree = data(self);
    const Leaf = Tree.leaves.get(id);
    if (!Leaf)
    {
        return false;
    }

    detach(Tree, Leaf);
    Tree.leaves.delete(id);
    return true;
}));

/**
 * Traverses fat bounds but returns only entries whose actual authoritative bounds overlap.
 *
 * @category Queries
 * @since 1.0.0
 */
export const query: {
    (self: Tree, bounds: B.Coordinates): R.Result<ReadonlyArray<Entry>, Diagnostic>;
    (bounds: B.Coordinates): (self: Tree) => R.Result<ReadonlyArray<Entry>, Diagnostic>;
} = dual(2, (self: Tree, bounds: B.Coordinates) => attempt(() =>
{
    const Tree = data(self);
    if (!B.isValid(bounds))
    {
        throw new Error("Invalid query bounds");
    }

    const Stack = Tree.root ? [ Tree.root ] : [];
    const Entries: Array<Entry> = [];
    while (Stack.length)
    {
        const Node = Stack.pop()!;
        if (!O.getOrThrow(B.overlaps(Node.bounds, bounds, { absoluteTolerance: 0,
            relativeTolerance: 0 })))
        {
            continue;
        }

        if (Node.entry)
        {
            if (O.getOrThrow(B.overlaps(Node.entry.bounds, bounds, { absoluteTolerance: 0,
                relativeTolerance: 0 })))
            {
                Entries.push(Node.entry);
            }
        }
        else
        {
            Stack.push(Node.right!, Node.left!);
        }
    }

    return Object.freeze(Entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}));

/**
 * Returns deterministic overlapping pairs, excluding static/static combinations.
 * Capacity bounds tree work; a separate pair budget prevents unbounded dense scenes.
 *
 * @category Queries
 * @since 1.0.0
 */
export const pairs: {
    (self: Tree, maxPairs?: number, maxNodes?: number): R.Result<ReadonlyArray<Pair>, Diagnostic>;
    (maxPairs?: number, maxNodes?: number): (self: Tree) => R.Result<ReadonlyArray<Pair>, Diagnostic>;
} = dual((args: IArguments) => args.length > 0 && typeof args[0] === "object",
    (self: Tree, maxPairs = 65_536, maxNodes = 262_144) => attempt(() =>
    {
        const Tree = data(self);
        const Pairs: Array<Pair> = [];
        if (!Number.isSafeInteger(maxPairs) || maxPairs < 1 || maxPairs > 1_000_000 ||
            !Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 1_000_000)
        {
            throw new Error("Invalid pair/node budget");
        }

        const Stack: Array<readonly [Node, Node]> = Tree.root ? [ [ Tree.root, Tree.root ] ] : [];
        let visited = 0;
        while (Stack.length)
        {
            if (++visited > maxNodes)
            {
                throw new Error("Broad-phase node budget exceeded");
            }

            const [ A, Bv ] = Stack.pop()!;
            if ((!A.active && !Bv.active) || !O.getOrThrow(B.overlaps(A.bounds, Bv.bounds, {absoluteTolerance:0,
                relativeTolerance:0})))
            {
                continue;
            }

            if (A === Bv)
            {
                if (A.left)
                {
                    Stack.push([ A.right!, A.right! ], [ A.left, A.right! ], [ A.left, A.left ]);
                }

                continue;
            }

            if (A.entry && Bv.entry)
            {
                if (!O.getOrThrow(B.overlaps(A.entry.bounds, Bv.entry.bounds, {absoluteTolerance:0,
                    relativeTolerance:0})))
                {
                    continue;
                }

                if (Pairs.length >= maxPairs)
                {
                    throw new Error("Broad-phase pair budget exceeded");
                }

                Pairs.push(Object.freeze({first: A.entry.id < Bv.entry.id ? A.entry.id : Bv.entry.id,
                    second: A.entry.id < Bv.entry.id ? Bv.entry.id : A.entry.id}));
            }
            else if (A.entry)
            {
                Stack.push([ A, Bv.right! ], [ A, Bv.left! ]);
            }
            else if (Bv.entry)
            {
                Stack.push([ A.right!, Bv ], [ A.left!, Bv ]);
            }
            else
            {
                Stack.push([ A.right!, Bv.right! ], [ A.right!, Bv.left! ], [ A.left!, Bv.right! ], [ A.left!, Bv.left! ]);
            }
        }

        Pairs.sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : a.second < b.second ? -1 : 1);
        return Object.freeze(Pairs);
    }));

/**
 * Frozen ordered body snapshot with no references to private nodes or buffers.
 *
 * @category Queries
 * @since 1.0.0
 */
export const snapshot = (self: Tree): R.Result<ReadonlyArray<Entry>, Diagnostic> =>
{
    return attempt(() => Object.freeze([ ...data(self).leaves.values() ].map((n) => n.entry!).sort((a, b) => a.id < b.id ? -1 : 1)));
};

/**
 * Copies private topology while sharing immutable bounds and entries. Mutating
 * either handle cannot change the other tree or any published query snapshot.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fork = (self: Tree): R.Result<Tree, Diagnostic> =>
{
    return attempt(() =>
    {
        const Source = data(self);
        const Tree = R.getOrThrow(make({ capacity: Source.capacity,
            margin: Source.margin }));
        const Target = data(Tree);
        const Copy = (node: Node, parent?: Node): Node =>
        {
            const Next: Node = { ...node,
                parent };
            if (node.entry)
            {Target.leaves.set(node.entry.id, Next);}

            if (node.left)
            {Next.left = Copy(node.left, Next);}

            if (node.right)
            {Next.right = Copy(node.right, Next);}

            return Next;
        };

        Target.root = Source.root ? Copy(Source.root) : undefined;
        return Tree;
    });
};
