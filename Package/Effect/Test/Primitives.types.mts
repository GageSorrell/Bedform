/**
 * Consumer inference and rejected inputs for Predicate and String.
 *
 * @module @bedform/effect/Test/Primitives.types
 *
 * @file      Primitives.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

import * as DirectPredicate from "@bedform/effect/Predicate";
import * as DirectString from "@bedform/effect/String";
import { Option, Predicate, String as Text, pipe } from "@bedform/effect";

const Guard: Predicate.Refinement<unknown, string> = DirectPredicate.isString;
const Filtered: Array<string> = ([ 1, "a", undefined ] as Array<unknown>).filter(Guard);
const Tuple: Predicate.Refinement<readonly [unknown, unknown], readonly [string, number]> =
    Predicate.Tuple([ Predicate.isString, Predicate.isNumber ]);
const Struct: Predicate.Refinement<{ value: unknown }, { value: string }> =
    Predicate.Struct({ value: Predicate.isString });
const Tagged = Predicate.isTagged("Ready");
const Input: unknown = { _tag: "Ready" };
if (Tagged(Input))
{
    const Tag: "Ready" = Input._tag;
    void Tag;
}

const Joined: "ab" = Text.concat("a", "b");
const Upper: "HELLO" = DirectString.toUpperCase("hello");
const Trimmed: "hello" = Text.trim(" hello ");
const Character: Option.Option<string> = pipe("hello", DirectString.at(-1));
const Curried: string = pipe("a", Text.padStart(3, "0"), Text.replace("a", "b"));
// @ts-expect-error String transforms require string inputs.
Text.trim(1);
// @ts-expect-error Numeric arguments are required for character access.
Text.at("first");
// @ts-expect-error The refined type must extend the input type.
type Invalid = Predicate.Refinement<string, number>;
// @ts-expect-error Predicate mapping must accept the transformed input.
Predicate.mapInput(Predicate.isString, (value: number) => value.length);
void [ Filtered, Tuple, Struct, Joined, Upper, Trimmed, Character, Curried, null as unknown as Invalid ];
