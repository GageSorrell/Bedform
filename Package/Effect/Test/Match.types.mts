/**
 * Inference, exhaustiveness and negative boundaries for the complete Match module.
 *
 * @module @bedform/effect/Test/Match.types
 *
 * @file      Match.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Fixtures preserve inference, property order and intentional negative uses. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-keys, @stylistic/max-len */

import * as M from "../Source/Match.js";
import type * as Option from "../Source/Option.js";
import type * as Result from "../Source/Result.js";

type Event = { readonly _tag: "Started";
    readonly value: number } | { readonly _tag: "Stopped";
        readonly reason: string };
const Event: Event = { _tag: "Started",
    value: 2 };
const Dispatch = M.type<Event>().pipe(
    M.tag("Started", (event) =>
    {
        const Narrowed: number = event.value;
        return String(Narrowed);
    }),
    M.tag("Stopped", (event) => event.reason),
    M.exhaustive
);
const Value: string = Dispatch(Event);
const Immediate: number = M.value(Event as Event).pipe(M.tagsExhaustive({ Started: (event) => event.value,
    Stopped: (event) => event.reason.length }));
const Tags: (event: Event) => number = M.typeTags<Event>()({ Started: (event) => event.value,
    Stopped: (event) => event.reason.length });
const Fn = M.fn((prefix: string, event: Event) => event).pipe(
    M.tag("Started", (event, prefix, original) =>
    {
        const First: string = prefix;
        const Second: Event = original;
        return `${First}:${event.value}:${Second._tag}`;
    }),
    M.tag("Stopped", (event, prefix) => `${prefix}:${event.reason}`),
    M.exhaustive
);
const Forwarded: string = Fn("event", Event);
// @ts-expect-error fn preserves selector argument types.
Fn(1, Event);

const Incomplete = M.type<Event>().pipe(M.tag("Started", (event) => event.value));
// @ts-expect-error Exhaustive finalization requires all union members.
Incomplete.pipe(M.exhaustive);
const Failure: Result.Result<number, Extract<Event, { _tag: "Stopped" }>> = Incomplete.pipe(M.result)(Event);
const Optional: Option.Option<number> = Incomplete.pipe(M.option)(Event);
// @ts-expect-error Tag names are restricted to the input union.
M.type<Event>().pipe(M.tag("Missing", () => 0));
// @ts-expect-error Exhaustive handler maps reject missing tags.
M.typeTags<Event>()({ Started: () => 0 });
const Extras = { Started: () => 0,
    Stopped: () => 0,
    Extra: () => 0 };
// @ts-expect-error Exact tag-map combinators reject unknown tags.
M.type<Event>().pipe(M.tagsExhaustive(Extras));
const Strings = M.type<string | number>().pipe(M.withReturnType<string>());
// @ts-expect-error withReturnType rejects incompatible callback results.
Strings.pipe(M.when(M.number, () => 1));
const Returns: string = Strings.pipe(M.when(M.string, (value) => value), M.when(M.number, (value) => String(value)), M.exhaustive)(1);

const Prefix: number = M.value([ 1, "a", true ] as readonly [number, string, boolean]).pipe(
    M.when([ M.number, M.string ], (value) =>
    {
        const First: number = value[0];
        const Second: string = value[1];
        const Third: boolean = value[2];
        return First + Second.length + Number(Third);
    }),
    M.orElse(() => 0)
);
const ArrayPrefix = M.type<ReadonlyArray<string | number>>().pipe(
    M.when([ M.string ], (value) =>
    {
        const Head: string = value[0];
        return Head.length;
    }),
    M.orElse(() => 0)
);

/**
 * Exercises generic immediate matchers without confusing their flavor with their input.
 *
 * @category Tests
 * @since 1.0.0
 */
function genericImmediate<A>(input: A): void
{
    const Matcher = M.value(input).pipe(M.when(M.any, () => true));
    const Exhaustive: boolean = Matcher.pipe(M.exhaustive);
    const Fallback: boolean = Matcher.pipe(M.orElse(() => false));
    const Result: Result.Result<boolean, never> = Matcher.pipe(M.result);
    const Option: Option.Option<boolean> = Matcher.pipe(M.option);
}

/**
 * Exercises deferred contextual inference in generic tag-handler maps.
 *
 * @category Tests
 * @since 1.0.0
 */
function genericTags<A>(event: { _tag: "Some";
    value: A } | { _tag: "None" })
{
    return M.value(event).pipe(M.tagsExhaustive({ Some: (value) => value.value,
        None: () => undefined }));
}

const GenericValue: number | undefined = genericTags({ _tag: "Some",
    value: 1 });
