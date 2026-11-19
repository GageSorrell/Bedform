/**
 * Provides small helpers for defining and reusing TypeScript functions.
 *
 * The main helpers are `pipe` and `flow` for left-to-right composition and
 * `dual` for APIs that support both direct and pipe-friendly call styles. The
 * module also contains small identity, constant, tuple, type-level, and
 * memoization helpers used across the library.
 *
 * Function composition, dual call styles, type helpers, and object memoization.
 *
 * @module @bedform/effect/Function
 *
 * @file      Function.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Check exported variable docs on the export node so standard TSDoc attaches correctly. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* The upstream overloads retain generic names, contextual parameter types, and callable inputs. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable @typescript-eslint/no-unsafe-function-type, prefer-rest-params */

import type { TypeLambda } from "./HKT.js";
import { pipeArguments } from "./Pipeable.js";

/**
 * Type lambda for function types, used for higher-kinded type operations.
 *
 * **When to use**
 *
 * Use when defining higher-kinded abstractions that must accept function types
 * as one of their type-lambda inputs.
 *
 * **Example** (Creating a function type with a type lambda)
 *
 * ```ts
 * import type { Function } from "@bedform/effect"
 *
 * interface StringToNumber extends Function.FunctionTypeLambda
 * {
 *   readonly In: string
 *   readonly Target: number
 * }
 * type StringToNumberFunction = StringToNumber["type"] // (a: string) => number
 * ```
 *
 * @category utility types
 * @since 1.0.0
 */
export interface FunctionTypeLambda extends TypeLambda
{
    readonly type: (a: this["In"]) => this["Target"]
}

/**
 * Creates a function that can be called in data-first style or data-last
 * (`pipe`-friendly) style.
 *
 * **When to use**
 *
 * Use to expose one implementation through both direct and `pipe`-friendly
 * call styles.
 *
 * **Details**
 *
 * Pass either the arity of the uncurried function or a predicate that decides
 * whether the current call is data-first. Arity is the common case. Use a
 * predicate when optional arguments make arity ambiguous.
 *
 * **Example** (Selecting data-first or data-last style by arity)
 *
 * ```ts
 * import { Function, pipe } from "@bedform/effect"
 *
 * const sum = Function.dual<
 *   (that: number) => (self: number) => number,
 *   (self: number, that: number) => number
 * >(2, (self, that) => self + that)
 *
 * sum(2, 3) // => 5
 * pipe(2, sum(3)) // => 5
 * ```
 *
 * **Example** (Defining overloads with call signatures)
 *
 * ```ts
 * import { Function, pipe } from "@bedform/effect"
 *
 * const sum: {
 *   (that: number): (self: number) => number
 *   (self: number, that: number): number
 * } = Function.dual(2, (self: number, that: number): number => self + that)
 *
 * sum(2, 3) // => 5
 * pipe(2, sum(3)) // => 5
 * ```
 *
 * **Example** (Selecting data-first or data-last style with a predicate)
 *
 * ```ts
 * import { Function, pipe } from "@bedform/effect"
 *
 * const sum = Function.dual<
 *   (that: number) => (self: number) => number,
 *   (self: number, that: number) => number
 * >(
 *   (args) => args.length === 2,
 *   (self, that) => self + that
 * )
 *
 * sum(2, 3) // => 5
 * pipe(2, sum(3)) // => 5
 * ```
 *
 * @throws { RangeError } When the numeric arity is zero or one.
 *
 * @category combinators
 * @since 1.0.0
 */
export const dual: {
    /**
     * Creates a function that can be called in data-first style or data-last
     * (`pipe`-friendly) style.
     *
     * **When to use**
     *
     * Use to expose one implementation through both direct and `pipe`-friendly
     * call styles.
     *
     * **Details**
     *
     * Pass either the arity of the uncurried function or a predicate that decides
     * whether the current call is data-first. Arity is the common case. Use a
     * predicate when optional arguments make arity ambiguous.
     *
     * **Example** (Selecting data-first or data-last style by arity)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum = Function.dual<
     *   (that: number) => (self: number) => number,
     *   (self: number, that: number) => number
     * >(2, (self, that) => self + that)
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * **Example** (Defining overloads with call signatures)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum: {
     *   (that: number): (self: number) => number
     *   (self: number, that: number): number
     * } = Function.dual(2, (self: number, that: number): number => self + that)
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * **Example** (Selecting data-first or data-last style with a predicate)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum = Function.dual<
     *   (that: number) => (self: number) => number,
     *   (self: number, that: number) => number
     * >(
     *   (args) => args.length === 2,
     *   (self, that) => self + that
     * )
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * @category combinators
     * @since 1.0.0
     */
    <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
        arity: Parameters<DataFirst>["length"],
        body: DataFirst
    ): DataLast & DataFirst

    /**
     * Creates a function that can be called in data-first style or data-last
     * (`pipe`-friendly) style.
     *
     * **When to use**
     *
     * Use to expose one implementation through both direct and `pipe`-friendly
     * call styles.
     *
     * **Details**
     *
     * Pass either the arity of the uncurried function or a predicate that decides
     * whether the current call is data-first. Arity is the common case. Use a
     * predicate when optional arguments make arity ambiguous.
     *
     * **Example** (Selecting data-first or data-last style by arity)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum = Function.dual<
     *   (that: number) => (self: number) => number,
     *   (self: number, that: number) => number
     * >(2, (self, that) => self + that)
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * **Example** (Defining overloads with call signatures)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum: {
     *   (that: number): (self: number) => number
     *   (self: number, that: number): number
     * } = Function.dual(2, (self: number, that: number): number => self + that)
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * **Example** (Selecting data-first or data-last style with a predicate)
     *
     * ```ts
     * import { Function, pipe } from "@bedform/effect"
     *
     * const sum = Function.dual<
     *   (that: number) => (self: number) => number,
     *   (self: number, that: number) => number
     * >(
     *   (args) => args.length === 2,
     *   (self, that) => self + that
     * )
     *
     * sum(2, 3) // => 5
     * pipe(2, sum(3)) // => 5
     * ```
     *
     * @category combinators
     * @since 1.0.0
     */
    <DataLast extends (...args: Array<any>) => any, DataFirst extends (...args: Array<any>) => any>(
        isDataFirst: (args: IArguments) => boolean,
        body: DataFirst
    ): DataLast & DataFirst
} = function(arity, body)
{
    if (typeof arity === "function")
    {
        return function(this: any)
        {
            return arity(arguments)
                ? body.apply(this, arguments as any)
                : ((self: any) => body(self, ...arguments)) as any;
        };
    }

    switch (arity)
    {
        case 0:
        case 1:
            throw new RangeError(`Invalid arity ${arity}`);

        case 2:
            return function(a, b)
            {
                if (arguments.length >= 2)
                {
                    return body(a, b);
                }

                return function(self: any)
                {
                    return body(self, a);
                };
            };

        case 3:
            return function(a, b, c)
            {
                if (arguments.length >= 3)
                {
                    return body(a, b, c);
                }

                return function(self: any)
                {
                    return body(self, a, b);
                };
            };

        default:
            return function()
            {
                if (arguments.length >= arity)
                {
                    // @ts-expect-error -- The generic fallback forwards its arguments unchanged.
                    return body.apply(this, arguments);
                }

                const args = arguments;
                return function(self: any)
                {
                    return body(self, ...args);
                };
            };
    }
};

/**
 * Applies a function to a given value.
 *
 * **When to use**
 *
 * Use to pass a fixed value into a unary function, especially when the function
 * is the value flowing through `pipe`.
 *
 * **Details**
 *
 * `apply(a)(f)` is equivalent to `f(a)`.
 *
 * **Example** (Applying an argument to a function)
 *
 * ```ts
 * import { Function, pipe, String } from "@bedform/effect"
 *
 * pipe(String.length, Function.apply("hello")) // => 5
 * ```
 *
 * @see {@link pipe} for building left-to-right pipelines
 *
 * @category combinators
 * @since 1.0.0
 */
export const apply = <A>(a: A) => <B>(self: (a: A) => B): B => self(a);

/**
 * A zero-argument function that produces a value when invoked.
 *
 * **When to use**
 *
 * Use to type a lazy value provider that should not run until called.
 *
 * **Example** (Creating a lazy argument)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const constNull: Function.LazyArg<null> = Function.constant(null)
 * constNull() // => null
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export type LazyArg<A> = () => A;

/**
 * Represents a function with multiple arguments.
 *
 * **When to use**
 *
 * Use to describe a function whose argument list is represented as a tuple
 * type.
 *
 * **Example** (Typing a variadic function)
 *
 * ```ts
 * import type { Function } from "@bedform/effect"
 *
 * const sum: Function.FunctionN<[number, number], number> = (a, b) => a + b
 * sum(2, 3) // => 5
 * ```
 *
 * @category models
 * @since 1.0.0
 */
export type FunctionN<A extends ReadonlyArray<unknown>, B> = (...args: A) => B;

/**
 * A function that is invoked only for its side effects and returns nothing.
 *
 * **When to use**
 *
 * Use to type a callback whose result is discarded. When `A` is left at its
 * default of `never`, the thunk takes no arguments; when `A` is a tuple type,
 * the thunk takes its arguments from `A`.
 *
 * **Example** (Typing side-effecting callbacks)
 *
 * ```ts
 * import type { Function } from "@bedform/effect"
 *
 * const done: Function.Thunk = () => console.log("done")
 * done() // logs "done"
 *
 * const log: Function.Thunk<[string]> = (message) => console.log(message)
 * log("hello") // logs "hello"
 * ```
 *
 * This type is a local extension to the pinned upstream Function module.
 *
 * @category Model
 * @since 1.0.0
 */
export type Thunk<A extends ReadonlyArray<unknown> = never> = [ A ] extends [ never ]
    ? () => void
    : (...ArgumentVector: A) => void;

/**
 * Returns its input argument unchanged.
 *
 * **When to use**
 *
 * Use to return a value unchanged where a function is required.
 *
 * **Example** (Returning the same value)
 *
 * ```ts
 * import { identity } from "@bedform/effect"
 *
 * identity(5) // => 5
 * ```
 *
 * @category combinators
 * @since 1.0.0
 */
export const identity = <A>(a: A): A => a;

/**
 * Ensures that the type of an expression matches some type,
 * without changing the resulting type of that expression.
 *
 * **When to use**
 *
 * Use to check assignability while preserving the expression's precise inferred
 * type.
 *
 * **Example** (Checking an expression against a type)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const test1 = Function.satisfies<number>()(5 as const) // => 5
 * // ^? const test: 5
 * // \@ts-expect-error
 * const test2 = Function.satisfies<string>()(5)
 * // ^? Argument of type 'number' is not assignable to parameter of type 'string'
 * ```
 *
 * @see {@link cast} for changing only the static TypeScript type
 *
 * @category utility types
 * @since 1.0.0
 */
export const satisfies = <A>() => <B extends A>(b: B) => b;

/**
 * Returns the input value with a different static type.
 *
 * **When to use**
 *
 * Use when you need an explicit type-level cast and accept that the value is
 * returned unchanged at runtime.
 *
 * **Gotchas**
 *
 * This is a type-level cast only; it performs no runtime validation or
 * conversion.
 *
 * @see {@link satisfies} for checking assignability without changing the resulting type
 *
 * @category utility types
 * @since 1.0.0
 */
export const cast: <A, B>(a: A) => B = identity as any;

/**
 * Creates a zero-argument function that always returns the provided value.
 *
 * **When to use**
 *
 * Use when you need a thunk or callback that returns the same value on every
 * invocation.
 *
 * **Example** (Creating a constant thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const constNull = Function.constant(null)
 *
 * constNull() // => null
 * constNull() // => null
 * ```
 *
 * @category constructors
 * @since 1.0.0
 */
export const constant = <A>(value: A): LazyArg<A> => () => value;

/**
 * Returns `true` when called.
 *
 * **When to use**
 *
 * Use when you need a thunk that returns `true` on every invocation.
 *
 * **Example** (Returning true from a thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.constTrue() // => true
 * ```
 *
 * @category constants
 * @since 1.0.0
 */
export const constTrue: LazyArg<boolean> = constant(true);

/**
 * Returns `false` when called.
 *
 * **When to use**
 *
 * Use when you need a thunk that returns `false` on every invocation.
 *
 * **Example** (Returning false from a thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.constFalse() // => false
 * ```
 *
 * @category constants
 * @since 1.0.0
 */
export const constFalse: LazyArg<boolean> = constant(false);

/**
 * Returns `null` when called.
 *
 * **When to use**
 *
 * Use when you need a thunk that returns `null` on every invocation.
 *
 * **Example** (Returning null from a thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.constNull() // => null
 * ```
 *
 * @category constants
 * @since 1.0.0
 */
export const constNull: LazyArg<null> = constant(null);

/**
 * Returns `undefined` when called.
 *
 * **When to use**
 *
 * Use when you need a thunk that returns `undefined` on every invocation.
 *
 * **Example** (Returning undefined from a thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.constUndefined() // => undefined
 * ```
 *
 * @category constants
 * @since 1.0.0
 */
export const constUndefined: LazyArg<undefined> = constant(undefined);

/**
 * Returns no meaningful value when called.
 *
 * **When to use**
 *
 * Use when you need a thunk that is called only for its effect and has no
 * meaningful return value.
 *
 * **Example** (Returning void from a thunk)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.constVoid() // => undefined
 * ```
 *
 * @category constants
 * @since 1.0.0
 */
export const constVoid: LazyArg<void> = constUndefined;

/**
 * Reverses the order of arguments for a curried function.
 *
 * **When to use**
 *
 * Use to adapt a curried function when its argument groups need to be supplied
 * in the opposite order.
 *
 * **Example** (Flipping curried arguments)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const f = (a: number) => (b: string) => a - b.length
 *
 * Function.flip(f)("aaa")(2) // => -1
 * ```
 *
 * @category combinators
 * @since 1.0.0
 */
export const flip = <A extends Array<unknown>, B extends Array<unknown>, C>(
    f: (...a: A) => (...b: B) => C
): (...b: B) => (...a: A) => C =>
    (...b) =>
        (...a) => f(...a)(...b);

/**
 * Composes two unary functions, applying `ab` first and then `bc`.
 * The composed function accepts an `A` and returns a `C`.
 *
 * **When to use**
 *
 * Use to compose exactly two unary functions into a reusable unary function.
 *
 * **Example** (Composing two functions)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const increment = (n: number) => n + 1
 * const square = (n: number) => n * n
 *
 * Function.compose(increment, square)(2) // => 9
 * ```
 *
 * @see {@link flow} for composing a left-to-right sequence of functions
 * @see {@link pipe} for applying a value through a left-to-right sequence immediately
 *
 * @category combinators
 * @since 1.0.0
 */
export const compose: {
    /**
     * Composes two unary functions, applying `ab` first and then `bc`.
     * The composed function accepts an `A` and returns a `C`.
     *
     * **When to use**
     *
     * Use to compose exactly two unary functions into a reusable unary function.
     *
     * **Example** (Composing two functions)
     *
     * ```ts
     * import { Function } from "@bedform/effect"
     *
     * const increment = (n: number) => n + 1
     * const square = (n: number) => n * n
     *
     * Function.compose(increment, square)(2) // => 9
     * ```
     *
     * @see {@link flow} for composing a left-to-right sequence of functions
     * @see {@link pipe} for applying a value through a left-to-right sequence immediately
     *
     * @category combinators
     * @since 1.0.0
     */
    <B, C>(bc: (b: B) => C): <A>(self: (a: A) => B) => (a: A) => C

    /**
     * Composes two unary functions, applying `ab` first and then `bc`.
     * The composed function accepts an `A` and returns a `C`.
     *
     * **When to use**
     *
     * Use to compose exactly two unary functions into a reusable unary function.
     *
     * **Example** (Composing two functions)
     *
     * ```ts
     * import { Function } from "@bedform/effect"
     *
     * const increment = (n: number) => n + 1
     * const square = (n: number) => n * n
     *
     * Function.compose(increment, square)(2) // => 9
     * ```
     *
     * @see {@link flow} for composing a left-to-right sequence of functions
     * @see {@link pipe} for applying a value through a left-to-right sequence immediately
     *
     * @category combinators
     * @since 1.0.0
     */
    <A, B, C>(self: (a: A) => B, bc: (b: B) => C): (a: A) => C
} = dual(2, <A, B, C>(ab: (a: A) => B, bc: (b: B) => C): (a: A) => C => (a) => bc(ab(a)));

/**
 * Marks an impossible branch by accepting a `never` value and returning any
 * type.
 *
 * **When to use**
 *
 * Use when you need a return value in a branch that exhaustive checks prove
 * cannot be reached.
 *
 * **Gotchas**
 *
 * Calling `absurd` throws, because a value of type `never` should be
 * impossible at runtime.
 *
 * **Example** (Handling impossible values)
 *
 * ```ts
 * import { absurd } from "@bedform/effect"
 *
 * const handleNever = (value: never) => {
 *   return absurd(value) // This will throw an error if called
 * }
 * ```
 *
 * @throws { Error } Whenever this function is called.
 *
 * @category utility types
 * @since 1.0.0
 */
export const absurd = <A>(_: never): A =>
{
    throw new Error("Called `absurd` function which should be uncallable");
};

/**
 * Creates a tupled version of this function: instead of `n` arguments, it accepts a single tuple argument.
 *
 * **When to use**
 *
 * Use to adapt a multi-argument function so it accepts one tuple argument.
 *
 * **Example** (Converting arguments to a tuple)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const sumTupled = Function.tupled((x: number, y: number): number => x + y)
 *
 * sumTupled([1, 2]) // => 3
 * ```
 *
 * @see {@link untupled} for adapting a tuple-argument function back to multiple arguments
 *
 * @category combinators
 * @since 1.0.0
 */
export const tupled = <A extends ReadonlyArray<unknown>, B>(f: (...a: A) => B): (a: A) => B => (a) => f(...a);

/**
 * Converts a tupled function back to an uncurried function.
 *
 * **When to use**
 *
 * Use to adapt a tuple-argument function so it accepts multiple arguments.
 *
 * **Example** (Converting a tuple to arguments)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * const getFirst = Function.untupled(<A, B>(tuple: [A, B]): A => tuple[0])
 *
 * getFirst(1, 2) // => 1
 * ```
 *
 * @see {@link tupled} for adapting a multi-argument function to one tuple argument
 *
 * @category combinators
 * @since 1.0.0
 */
export const untupled = <A extends ReadonlyArray<unknown>, B>(
    f: (a: A) => B
): (...a: A) => B => (...a) => f(a);

/**
 * Pipes the value of an expression through a left-to-right sequence of
 * functions.
 *
 * **When to use**
 *
 * Use when you need to compose data-last functions into readable
 * transformation pipelines instead of method-style chains.
 *
 * **Details**
 *
 * Takes an initial value, passes it to the first function, then passes each
 * result to the next function in order. The final function result is returned.
 *
 * **Gotchas**
 *
 * Each function passed after the initial value must accept a single argument,
 * because `pipe` calls each step with only the previous result.
 *
 * **Example** (Piping values through functions)
 *
 * In this example, `1` is passed to the first function, and each result becomes
 * the input for the next function.
 *
 * ```ts
 * import { pipe } from "@bedform/effect"
 *
 * pipe(
 *   1,
 *   (n) => n + 1,
 *   (n) => n * 2,
 *   (n) => `result: ${n}`
 * ) // => "result: 4"
 * ```
 *
 * **Example** (Rewriting method chains with pipe)
 *
 * The same transformation can be written with data-last functions.
 *
 * ```ts
 * import { Array, pipe } from "@bedform/effect"
 *
 * const numbers = [1, 2, 3, 4]
 * const double = (n: number) => n * 2
 * const greaterThanFour = (n: number) => n > 4
 *
 * pipe(
 *   numbers,
 *   Array.map(double),
 *   Array.filter(greaterThanFour)
 * ) // => [6, 8]
 * ```
 *
 * @category combinators
 * @since 1.0.0
 */
export function pipe<A>(a: A): A;
export function pipe<A, B = never>(a: A, ab: (a: A) => B): B;
export function pipe<A, B = never, C = never>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C
): C;
export function pipe<A, B = never, C = never, D = never>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D
): D;
export function pipe<A, B = never, C = never, D = never, E = never>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E
): E;
export function pipe<A, B = never, C = never, D = never, E = never, F = never>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F
): F;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G
): G;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H
): H;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I
): I;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J
): J;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K
): K;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L
): L;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M
): M;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N
): N;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O
): O;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never,
    P = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P
): P;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never,
    P = never,
    Q = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q
): Q;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never,
    P = never,
    Q = never,
    R = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R
): R;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never,
    P = never,
    Q = never,
    R = never,
    S = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R,
    rs: (r: R) => S
): S;
export function pipe<
    A,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never,
    K = never,
    L = never,
    M = never,
    N = never,
    O = never,
    P = never,
    Q = never,
    R = never,
    S = never,
    T = never
>(
    a: A,
    ab: (a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J,
    jk: (j: J) => K,
    kl: (k: K) => L,
    lm: (l: L) => M,
    mn: (m: M) => N,
    no: (n: N) => O,
    op: (o: O) => P,
    pq: (p: P) => Q,
    qr: (q: Q) => R,
    rs: (r: R) => S,
    st: (s: S) => T
): T;
export function pipe(a: unknown, ...args: Array<any>): unknown
{
    return pipeArguments(a, args as any);
}

/**
 * Performs left-to-right function composition.
 *
 * **When to use**
 *
 * Use to build a reusable function from a left-to-right sequence of
 * transformations.
 *
 * **Details**
 *
 * The first function may have any arity. Every following function must be
 * unary.
 *
 * **Example** (Composing functions left to right)
 *
 * ```ts
 * import { flow } from "@bedform/effect"
 *
 * const len = (s: string): number => s.length
 * const double = (n: number): number => n * 2
 *
 * const f = flow(len, double)
 *
 * f("aaa") // => 6
 * ```
 *
 * @see {@link pipe} for applying a value through a left-to-right sequence immediately
 * @see {@link compose} for composing exactly two functions
 *
 * @category combinators
 * @since 1.0.0
 */
export function flow<A extends ReadonlyArray<unknown>, B = never>(
    ab: (...a: A) => B
): (...a: A) => B;
export function flow<A extends ReadonlyArray<unknown>, B = never, C = never>(
    ab: (...a: A) => B,
    bc: (b: B) => C
): (...a: A) => C;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never
>(ab: (...a: A) => B, bc: (b: B) => C, cd: (c: C) => D): (...a: A) => D;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E
): (...a: A) => E;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F
): (...a: A) => F;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G
): (...a: A) => G;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H
): (...a: A) => H;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I
): (...a: A) => I;
export function flow<
    A extends ReadonlyArray<unknown>,
    B = never,
    C = never,
    D = never,
    E = never,
    F = never,
    G = never,
    H = never,
    I = never,
    J = never
>(
    ab: (...a: A) => B,
    bc: (b: B) => C,
    cd: (c: C) => D,
    de: (d: D) => E,
    ef: (e: E) => F,
    fg: (f: F) => G,
    gh: (g: G) => H,
    hi: (h: H) => I,
    ij: (i: I) => J
): (...a: A) => J;
export function flow(
    ab: Function,
    bc?: Function,
    cd?: Function,
    de?: Function,
    ef?: Function,
    fg?: Function,
    gh?: Function,
    hi?: Function,
    ij?: Function
): unknown
{
    switch (arguments.length)
    {
        case 1:
            return ab;
        case 2:
            return function(this: unknown)
            {
                return bc!(ab.apply(this, arguments));
            };

        case 3:
            return function(this: unknown)
            {
                return cd!(bc!(ab.apply(this, arguments)));
            };

        case 4:
            return function(this: unknown)
            {
                return de!(cd!(bc!(ab.apply(this, arguments))));
            };

        case 5:
            return function(this: unknown)
            {
                return ef!(de!(cd!(bc!(ab.apply(this, arguments)))));
            };

        case 6:
            return function(this: unknown)
            {
                return fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))));
            };

        case 7:
            return function(this: unknown)
            {
                return gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))));
            };

        case 8:
            return function(this: unknown)
            {
                return hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments))))))));
            };

        case 9:
            return function(this: unknown)
            {
                return ij!(hi!(gh!(fg!(ef!(de!(cd!(bc!(ab.apply(this, arguments)))))))));
            };
    }

    return;
}

/**
 * Creates a compile-time placeholder for a value of any type.
 *
 * **When to use**
 *
 * Use as a temporary typed placeholder while developing incomplete code.
 *
 * **Gotchas**
 *
 * `hole` is intended for temporary development use. If the placeholder is
 * evaluated at runtime, it throws.
 *
 * **Example** (Creating a development placeholder)
 *
 * ```ts
 * import { hole } from "@bedform/effect"
 *
 * // Intentionally not called: `hole` throws if the placeholder is evaluated.
 * const buildUser = (id: number): { readonly id: number; readonly name: string } => ({
 *   id,
 *   name: hole<string>()
 * })
 *
 * ```
 *
 * @category utility types
 * @since 1.0.0
 */
export const hole: <T>() => T = cast(absurd);

/**
 * Returns the second argument and discards the first. The SK combinator is
 * a fundamental combinator in the lambda calculus and the SKI combinator
 * calculus.
 *
 * **When to use**
 *
 * Use to discard the first argument and return the second argument.
 *
 * **Example** (Discarding the first argument)
 *
 * ```ts
 * import { Function } from "@bedform/effect"
 *
 * Function.SK(0, "hello") // => "hello"
 * ```
 *
 * @category combinators
 * @since 1.0.0
 */
export const SK = <A, B>(_: A, b: B): B => b;

/**
 * Creates a memoized function whose input is an object, caching results by
 * object identity.
 *
 * **When to use**
 *
 * Use to reuse the result of a synchronous computation whose output is stable
 * for a given object reference.
 *
 * **Details**
 *
 * Each memoized wrapper owns a private `WeakMap` keyed by object identity.
 *
 * **Gotchas**
 *
 * `undefined` is reserved to represent a cache miss and is therefore not
 * supported as a return value.
 *
 * Structurally equal objects do not share cache entries. If the same object is
 * mutated after its first call, later calls still return the cached result for
 * that reference.
 *
 * @category caching
 * @since 1.0.0
 */
export function memoize<A extends object, O extends {} | null>(f: (a: A) => O): (ast: A) => O
{
    const cache = new WeakMap<object, O>();
    return (a) =>
    {
        const cached = cache.get(a);
        if (cached !== undefined)
        {
            return cached;
        }

        const result = f(a);
        cache.set(a, result);
        return result;
    };
}

/**
 * Creates a memoized idempotent object transformation that caches both inputs
 * and their outputs by object identity.
 *
 * **When to use**
 *
 * Use when an object transformation is idempotent and its output can be safely
 * reused as a fixed point.
 *
 * **Details**
 *
 * After computing an input, the returned function caches both the input and
 * the output. Calling it with either reference returns the output without
 * invoking the supplied function again.
 *
 * **Gotchas**
 *
 * The returned function treats each computed output as a fixed point. If
 * applying the supplied function to an output would produce an observably
 * different value, this memoization changes that behavior.
 *
 * @see {@link memoize} for memoizing functions without an idempotence requirement
 *
 * @category caching
 * @since 1.0.0
 */
export function memoizeIdempotent<A extends object>(f: (a: A) => A): (a: A) => A
{
    const cache = new WeakMap<A, A>();
    return (a) =>
    {
        const cached = cache.get(a);
        if (cached !== undefined)
        {
            return cached;
        }

        const result = f(a);
        cache.set(a, result);
        if (result !== a)
        {
            cache.set(result, result);
        }

        return result;
    };
}
