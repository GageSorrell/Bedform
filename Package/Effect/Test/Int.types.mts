/**
 * Declaration checks for the `Int` and `UInt` brands and kind-generic Unit signatures.
 *
 * @module @bedform/effect/Test/Int.types
 *
 * @file      Int.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Type fixtures exist only to be checked, one per line. */
/* eslint-disable @typescript-eslint/no-unused-vars, @stylistic/max-len */

import type * as BigRational from "@bedform/effect/BigRational";
import * as Int from "@bedform/effect/Int";
import type * as Option from "@bedform/effect/Option";
import * as Rational from "@bedform/effect/Rational";
import * as UInt from "@bedform/effect/UInt";
import * as Unit from "@bedform/effect/Unit";

const Unsigned: UInt.UInt = UInt.makeUnsafe(3);
const Widened: Int.Int = Unsigned;
const AsNumber: number = Widened;
// @ts-expect-error An arbitrary number is not an Int.
const Plain: Int.Int = 3;
// @ts-expect-error An Int is not necessarily a UInt.
const Narrowed: UInt.UInt = Int.makeUnsafe(-3);

const FloatLength: Unit.Length.Length = Unit.Length.feet(Int.makeUnsafe(3));
const RationalLength: Unit.Length.Length<Rational.Rational> = Unit.Length.feet(Rational.one);
const BigLength: Unit.Length.Length<BigRational.BigRational> = Unit.Length.feet(3n);
const RationalFeet: Rational.Rational = Unit.Length.inFeet(RationalLength);
const FloatQuotient: Unit.Length.Length = Unit.Quantity.divide(FloatLength, 2);
const ExactQuotient: Option.Option<Unit.Length.Length<BigRational.BigRational>> = Unit.Quantity.divide(BigLength, 2n);
const MixedSum: Unit.Length.Length = Unit.Quantity.sum(RationalLength, FloatLength);
// @ts-expect-error A float operand makes the result a float.
const NotExact: Unit.Length.Length<Rational.Rational> = Unit.Quantity.sum(RationalLength, FloatLength);
