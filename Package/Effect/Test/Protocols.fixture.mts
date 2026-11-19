/**
 * Executable public protocol consumer shared with isolated package tests.
 *
 * @module @bedform/effect/Test/Protocols.fixture
 *
 * @file      Protocols.fixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Public consumer fixtures retain callback inference and deliberate property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports */

import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as Equivalence from "@bedform/effect/Equivalence";
import * as Order from "@bedform/effect/Order";
import * as Ordering from "@bedform/effect/Ordering";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as Formatter from "@bedform/effect/Formatter";
import { HashMap, HashSet } from "@bedform/effect";

/**
 * Full-precision diagnostic representation for the consumer value.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SampleJson
{
    readonly _id: "Sample";
    readonly value: number;
}

/**
 * A custom value whose public protocols work together in hash collections.
 *
 * @category Tests
 * @since 1.0.0
 */
export class Sample extends Inspectable.Class implements Equal.Equal, Pipeable.Pipeable
{
    /**
     * Stores the numeric identity used by equality and hashing.
     *
     * @category Constructors
     * @since 1.0.0
     */
    constructor(readonly value: number)
    {
        super();
    }

    /**
     * Reuses the public piping prototype and its overloads.
     *
     * @category Combinators
     * @since 1.0.0
     */
    readonly pipe = Pipeable.Prototype.pipe;

    /**
     * Compares custom values by their stored numeric identity.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](that: Equal.Equal): boolean
    {
        return that instanceof Sample && Equal.equals(this.value, that.value);
    }

    /**
     * Hashes the same numeric identity used by equality.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](): number
    {
        return Hash.hash(this.value);
    }

    /**
     * Supplies the representation consumed by inherited inspection helpers.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(): SampleJson
    {
        return { _id: "Sample",
            value: this.value };
    }
}

/**
 * Exercises argument forwarding through the public pipeArguments helper.
 *
 * @category Tests
 * @since 1.0.0
 */
function pipeValue(this: Sample, ...operations: ReadonlyArray<(value: unknown) => unknown>): unknown
{
    void operations;
    // The public helper deliberately consumes IArguments rather than a rest array.
    // eslint-disable-next-line prefer-rest-params
    return Pipeable.pipeArguments(this, arguments);
}

/**
 * Runs the protocol integration using only public package imports.
 *
 * @category Tests
 * @since 1.0.0
 */
export function protocolProof(): ReadonlyArray<unknown>
{
    const First = new Sample(3);
    const Same = new Sample(3);
    const Other = new Sample(5);
    const Compare = Order.make<Sample>((self, that) => Order.Number(self.value, that.value));
    const Equivalent = Equivalence.make<Sample>((self, that) => Equal.equals(self, that));
    const Render: Formatter.Formatter<Sample> = Formatter.format;
    const Set = HashSet.make(First, Same, Other);
    const Map = HashMap.make([ First, "found" ] as const);
    return [
        Equal.equals(First, Same), Equal.equals(First, Other),
        Hash.hash(First) === Hash.hash(Same), HashSet.size(Set),
        HashMap.getUnsafe(Map, Same), Equivalent(First, Same),
        Compare(First, Other), Ordering.reverse(Compare(First, Other)),
        First.pipe((value) => value.value, (value) => value * 2),
        pipeValue.call(First) === First, pipeValue.call(First, (value: unknown) => (value as Sample).value),
        Render(First), Formatter.formatJson(First.toJSON()),
        Inspectable.toJson(First), First[Inspectable.NodeInspectSymbol](),
        Inspectable.toStringUnknown(First.toJSON(), 0)
    ];
}
