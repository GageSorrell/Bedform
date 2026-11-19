/**
 * Compile-time consumer checks for Function inference and rejected inputs.
 *
 * @module @bedform/effect/Test/Function.types
 *
 * @file      Function.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

import * as Function from "@bedform/effect/Function";
import { type Thunk, pipe } from "@bedform/effect";
import type { Kind } from "../Source/HKT.js";

/* These assignments verify contextual inference, so parameters intentionally omit annotations. */
/* eslint @typescript-eslint/typedef: "off" */

const Literal: 1 = Function.satisfies<number>()(1 as const);
const Cast: string = Function.cast(1);
const Lambda: Kind<Function.FunctionTypeLambda, string, never, never, number> = (text) => text.length;
const Lazy: Function.LazyArg<number> = () => 1;
const Callback: Function.Thunk = () => {};

const RootCallback: Thunk = Callback;
const TupleCallback: Function.Thunk<readonly [number, string?]> = (count, text) =>
{
    void [ count, text ];
};

const RestCallback: Function.Thunk<readonly [string, ...Array<number>]> = (text, ...counts) =>
{
    void [ text, counts ];
};

const CallbackResult: void = RootCallback();
TupleCallback(1);
TupleCallback(1, "one");
RestCallback("counts", 1, 2);
// @ts-expect-error -- the default thunk takes no arguments.
Callback(1);
// @ts-expect-error -- tuple arguments remain required and typed.
TupleCallback("one");
// @ts-expect-error -- thunk parameters must be an argument tuple or array.
type InvalidThunk = Function.Thunk<string>;
const InvalidCallback: InvalidThunk = () => {};

const Variadic: Function.FunctionN<readonly [number, string], boolean> =
    (count, text) => count === text.length;
const Dual = Function.dual<
    (increment: number) => (self: number) => number,
    (self: number, increment: number) => number
>(2, (self, increment) => self + increment);
const Direct: number = Dual(1, 2);
const Piped: number = pipe(1, Dual(2));
const Tupled: (tuple: [number, string]) => string = Function.tupled(
    (count: number, text: string) => text.repeat(count)
);
const Untupled: (count: number, text: string) => string = Function.untupled(Tupled);
const Composed: (value: number) => string = Function.compose((value: number) => value + 1, String);
const Curried: (value: number) => string = Function.compose(String)((value: number) => value + 1);
const Flow: (left: number, right: number) => string = Function.flow(
    (left: number, right: number) => left + right,
    String
);
const Pipeline: string = pipe(1, (value) => value + 1, String);
const Flipped: (flag: boolean) => (count: number, text: string) => string = Function.flip(
    (count: number, text: string) => (flag: boolean) => flag ? text.repeat(count) : text
);
const Hole: Function.LazyArg<string> = Function.hole;
const Absurd: (value: never) => string = Function.absurd;

// @ts-expect-error -- satisfies rejects values outside its constraint.
Function.satisfies<string>()(1);
// @ts-expect-error -- adjacent composition stages must agree.
Function.compose((value: number) => value + 1, (value: boolean) => String(value));
// @ts-expect-error -- memoize only accepts object inputs.
Function.memoize((value: number) => value);
// @ts-expect-error -- undefined is reserved for memoize cache misses.
Function.memoize((_value: object) => undefined);
// @ts-expect-error -- idempotent transformations return their input type.
Function.memoizeIdempotent((value: { count: number }) => ({ text: String(value.count) }));

void [ Literal, Cast, Lambda, Lazy, CallbackResult, InvalidCallback, Variadic, Direct, Piped, Tupled,
    Untupled, Composed, Curried, Flow, Pipeline, Flipped, Hole, Absurd ];
