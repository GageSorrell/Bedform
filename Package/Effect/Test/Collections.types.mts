/**
 * Consumer inference for complete array, record, struct, number and tuple helpers.
 *
 * @module @bedform/effect/Test/Collections.types
 *
 * @file      Collections.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Preserve contextual inference and intentional negative uses in type fixtures. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-keys, @stylistic/max-len */

import * as A from "../Source/Array.js";
import * as N from "../Source/Number.js";
import type * as O from "../Source/Option.js";
import * as R from "../Source/Record.js";
import * as S from "../Source/Struct.js";
import * as T from "../Source/Tuple.js";
import { pipe } from "../Source/Function.js";

const NonEmpty = A.make(1, 2);
const Mapped: A.NonEmptyArray<string> = A.map(NonEmpty, (value) => String(value));
const Readonly: A.NonEmptyReadonlyArray<number> = [ 1, 2 ];
const Head: number = A.headNonEmpty(Readonly);
// @ts-expect-error Non-empty access rejects arbitrary arrays.
A.headNonEmpty([] as Array<number>);
const Mixed: ReadonlyArray<string | number> = [ 1, "two" ];
const Narrowed: Array<string> = A.filter(Mixed, (value): value is string => typeof value === "string");
const Curried: Array<number> = A.map((value: string) => value.length)(Narrowed);
const Safe: O.Option<number> = A.get(Readonly, 1);
const Grouped: Record<string, A.NonEmptyArray<number>> = A.groupBy([ 1, 2 ], (value) => String(value % 2));
const Bound: Array<{ readonly a: number;
    readonly b: string }> = pipe(A.Do, A.bind("a", () => [ 1 ]), A.bind("b", (row) => [ String(row.a) ]));

const RecordValue = { a: 1,
    b: 2 };
const MappedRecord: Record<"a" | "b", string> = R.map(RecordValue, (value) => String(value));
const Lookup: O.Option<number> = R.get(RecordValue, "a");
// @ts-expect-error Lookup rejects keys absent from a precise record.
R.get(RecordValue, "missing");
const Extended: Record<"a" | "b" | "c", number> = R.set(RecordValue, "c", 3);

const Input = { name: "A",
    count: 1,
    active: true };
const Picked: { name: string;
    count: number } = S.pick(Input, [ "name", "count" ]);
const Omitted: { name: string;
    count: number } = S.omit(Input, [ "active" ]);
const Renamed: { label: string;
    count: number;
    active: boolean } = S.renameKeys(Input, { name: "label" });
const Evolved: { name: string;
    count: string;
    active: boolean } = S.evolve(Input, { count: (value) => String(value) });
// @ts-expect-error Struct selection rejects unknown fields.
S.pick(Input, [ "missing" ]);
// @ts-expect-error Struct access preserves the property type.
const WrongField: number = S.get(Input, "name");

/**
 * Retains each input's type when wrapping struct and tuple values in arrays.
 *
 * @category Types
 * @since 1.0.0
 */
interface AsArray extends S.Lambda
{
    <A>(self: A): Array<A>;
    readonly "~lambda.out": Array<this["~lambda.in"]>;
}
const Wrap = S.lambda<AsArray>((value) => [ value ]);
const Wrapped: { name: Array<string>;
    count: Array<number>;
    active: Array<boolean> } = S.map(Input, Wrap);
const Selected: { name: Array<string>;
    count: number;
    active: boolean } = S.mapPick(Input, [ "name" ], Wrap);

const Tuple = T.make(1, "A", true);
const TuplePicked: [number, boolean] = T.pick(Tuple, [ 0, 2 ]);
const TupleOmitted: [number, boolean] = T.omit(Tuple, [ 1 ]);
const TupleAppended: [number, string, boolean, string] = T.appendElement(Tuple, "tail");
const TupleEvolved: [string, string, boolean] = T.evolve(Tuple, [ (value) => String(value) ]);
const TupleWrapped: [Array<number>, Array<string>, Array<boolean>] = T.map(Tuple, Wrap);
// @ts-expect-error Tuple lookup rejects out-of-range positions.
T.get(Tuple, 3);
// @ts-expect-error Tuple element positions retain their types.
const WrongPosition: number = T.get(Tuple, 1);

const Division: O.Option<number> = N.divide(1, 2);
const Sum: number = N.sum(2)(1);
const Parse: O.Option<number> = N.parse("1");
// @ts-expect-error Arithmetic rejects nonnumeric operands.
N.sum("1", 2);
