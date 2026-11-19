/**
 * Inference and nominal boundaries of the complete Brand public API.
 *
 * @module @bedform/effect/Test/Brand.types
 *
 * @file      Brand.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Type fixtures preserve inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars */

import * as B from "../Source/Brand.js";
import type * as Private from "../Source/Internal/brand.js";
import * as S from "../Source/Schema.js";

type Positive = B.Branded<number, "Positive">;
type Integer = B.Branded<number, "Integer">;
const Positive = B.make<Positive>((value) => value > 0 || "positive");
const Integer = B.check<Integer>(S.isInt());
const Combined = B.all(Positive, Integer);
const Value: Positive & Integer = Combined(1);
const Plain: B.Brand.Unbranded<Positive & Integer> = 1;
const Key: B.Brand.Keys<Positive & Integer> = "Integer";
const Nominal: B.Brand.Brands<Positive & Integer> = Value;
const Extracted: B.Brand.FromConstructor<typeof Combined> = Value;
const Shared: Private.Branded<number, "Positive"> = Positive(1);
const SharedConstructor: Private.Constructor<Positive> = Positive;
const FromSchema: Positive = S.decodeUnknownSync(S.Number.pipe(S.fromBrand("Positive", Positive)))(1);
const Option = Positive.option(1);
if (Option._tag === "Some")
{
    const Typed: Positive = Option.value;
}

const Result = Positive.result(1);
if (Result._tag === "Failure")
{
    const Error: B.BrandError = Result.failure;
}
else
{
    const Typed: Positive = Result.success;
}

const Narrowed: number = 1;
if (Positive.is(Narrowed))
{
    const Typed: Positive = Narrowed;
}

// @ts-expect-error Unbranded numbers cannot be assigned to branded values.
const Invalid: Positive = 1;
// @ts-expect-error Distinct nominal keys are incompatible.
const WrongBrand: Positive = Integer(1);
// @ts-expect-error Invalid keys are excluded.
const WrongKey: B.Brand.Keys<Positive> = "Integer";
// @ts-expect-error Composed brands must have a common unbranded base.
B.all(Positive, B.nominal<B.Branded<string, "Name">>());
// @ts-expect-error Brand constructors retain their input type.
Positive("1");
