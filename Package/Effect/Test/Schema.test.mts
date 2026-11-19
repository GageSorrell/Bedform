/**
 * Differential acceptance for the synchronous Schema subset.
 *
 * @module @bedform/effect/Test/Schema.test
 *
 * @file      Schema.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Keep differential imports grouped by implementation and compact test branches. */
/* eslint-disable sort-imports, @stylistic/max-statements-per-line */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as S from "../Distribution/Schema.js";
import * as P from "../Distribution/SchemaParser.js";
import * as I from "../Distribution/SchemaIssue.js";
import * as G from "../Distribution/SchemaGetter.js";
import * as T from "../Distribution/SchemaTransformation.js";
import * as R from "../Distribution/Result.js";
import * as O from "../Distribution/Option.js";
import * as J from "../Distribution/JsonSchema.js";

import * as Equal from "../Distribution/Equal.js";
import * as U from "effect/Schema";
import * as UJ from "effect/JsonSchema";
import * as E from "effect/Effect";
import * as C from "../Distribution/Chunk.js";
import * as HM from "../Distribution/HashMap.js";
import * as HS from "../Distribution/HashSet.js";
import * as Duration from "../Distribution/Duration.js";
import * as BigDecimal from "../Distribution/BigDecimal.js";
import * as Redacted from "../Distribution/Redacted.js";

/* Differential fixtures intentionally pair structurally identical upstream and local codecs. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

/**
 * Compares normalized validation output, retaining issue formatting and paths.
 *
 * @category Tests
 * @since 1.0.0
 */
function compare(local: S.ConstraintDecoder<unknown>, upstream: U.ConstraintDecoder<unknown>, values: ReadonlyArray<unknown>): void
{
    for (const value of values)
    {
        for (const options of [ {}, { errors: "all",
            reportInput: true }, { onExcessProperty: "error" } ] as const)
        {
            const actual = S.decodeUnknownResult(local, options)(value);
            const expected = U.decodeUnknownResult(upstream, options)(value);
            Assert.equal(actual._tag, expected._tag, JSON.stringify(value));
            if (actual._tag === "Success" && expected._tag === "Success") {Assert.deepEqual(actual.success, expected.success);}
            else if (actual._tag === "Failure" && expected._tag === "Failure") {Assert.equal(actual.failure.message, expected.failure.message);}
        }
    }
}

test("primitives, structs, optional fields, records, tuples, unions and checks match upstream", () =>
{
    compare(S.Struct({ name: S.String,
        age: S.NumberFromString,
        nick: S.optionalKey(S.String) }), U.Struct({ name: U.String,
        age: U.NumberFromString,
        nick: U.optionalKey(U.String) }), [ { name: "A",
        age: "42" }, {}, { name: 1,
        age: "x",
        extra: true }, { name: "A",
        age: "NaN",
        nick: undefined }, { name: "A",
        age: "1",
        nick: "B",
        extra: 2 } ]);
    compare(S.Record(S.String, S.NumberFromString), U.Record(U.String, U.NumberFromString), [ { a: "1" }, { a: "bad",
        b: "2" }, null, [] ]);
    compare(S.Tuple([ S.String, S.optionalKey(S.Number) ]), U.Tuple([ U.String, U.optionalKey(U.Number) ]), [ [], [ "x" ], [ "x", 2 ], [ "x", undefined ], [ 1, "x" ], [ "x", 2, 3 ] ]);
    compare(S.TupleWithRest(S.Tuple([ S.String ]), [ S.Number, S.Boolean ]), U.TupleWithRest(U.Tuple([ U.String ]), [ U.Number, U.Boolean ]), [ [ "x", true ], [ "x", 1, 2, true ], [ "x" ], [ 1, "bad", false ] ]);
    compare(S.Union([ S.Struct({ _tag: S.Literal("A"),
        value: S.Number }), S.Struct({ _tag: S.Literal("B"),
        value: S.String }) ]), U.Union([ U.Struct({ _tag: U.Literal("A"),
        value: U.Number }), U.Struct({ _tag: U.Literal("B"),
        value: U.String }) ]), [ { _tag: "A",
        value: 1 }, { _tag: "A",
        value: "bad" }, { _tag: "C" }, null ]);
    compare(S.String.check(S.isMinLength(2), S.isPattern(/^[a-z]+$/)), U.String.check(U.isMinLength(2), U.isPattern(/^[a-z]+$/)), [ "abc", "a", "1", 1 ]);
    compare(S.TemplateLiteral([ "a", S.Number, "z" ]), U.TemplateLiteral([ "a", U.Number, "z" ]), [ "a123z", "a1.5z", "bad", "aInfinityz", 42 ]);
});

test("lazy defaults preserve encoded/type distinctions and omission", () =>
{
    let calls = 0;
    const local = S.Struct({ value: S.NumberFromString.pipe(S.withDecodingDefaultKey(() => { calls++; return R.succeed("7"); }, { encodingStrategy: "omit" })) });
    const upstream = U.Struct({ value: U.NumberFromString.pipe(U.withDecodingDefaultKey(E.succeed("7"), { encodingStrategy: "omit" })) });
    Assert.equal(calls, 0);
    compare(local, upstream, [ { value: "1" }, {}, { value: undefined } ]);
    Assert.equal(calls, 3);
    Assert.deepEqual(S.encodeSync(local)({ value: 7 }), U.encodeSync(upstream)({ value: 7 }));
    const schema = S.Struct({ value: S.Number.pipe(S.withConstructorDefault(() => { calls++; return R.succeed(9); })) });
    Assert.deepEqual(schema.make({}), { value: 9 });
    Assert.equal(S.decodeUnknownResult(schema)({})._tag, "Failure");
    const typed = S.Struct({ value: S.NumberFromString.pipe(S.withDecodingDefaultType(() => R.succeed(3))) });
    Assert.deepEqual(S.decodeUnknownSync(typed)({}), { value: 3 });
    Assert.deepEqual(S.decodeUnknownSync(typed)({ value: undefined }), { value: 3 });
});

test("recursive schemas, symbol keys, own properties and prototype-sensitive records", () =>
{
    interface Node { readonly name: string;
        readonly children: ReadonlyArray<Node>; }
    const node: S.Codec<Node> = S.suspend(() => S.Struct({ name: S.String,
        children: S.Array(node) }));
    const upstream: U.Codec<Node> = U.suspend(() => U.Struct({ name: U.String,
        children: U.Array(upstream) }));
    compare(node, upstream, [ { name: "a",
        children: [ { name: "b",
            children: [] } ] }, { name: "a",
        children: [ { name: 1,
            children: [] } ] } ]);
    const key = Symbol("key");
    Assert.deepEqual(S.decodeUnknownSync(S.Struct({ [key]: S.Number }))({ [key]: 1 }), { [key]: 1 });
    compare(S.Struct({ name: S.String }), U.Struct({ name: U.String }), [ Object.create({ name: "inherited" }) ]);
    const input = JSON.parse("{\"__proto__\":\"1\",\"constructor\":\"2\"}");
    const result = S.decodeUnknownSync(S.Record(S.String, S.NumberFromString))(input);
    Assert.equal(Object.getPrototypeOf(result), Object.prototype);
    Assert.equal(Object.hasOwn(result, "__proto__"), true);
    Assert.equal(result.__proto__, 1);
});

test("validation failures, defects and malformed callbacks remain distinct", () =>
{
    const defect = new Error("callback defect");
    const codec = S.String.pipe(S.decodeTo(S.Number, { decode: G.transform(() => { throw defect; }),
        encode: G.String() }));
    for (const adapter of [ S.decodeUnknownSync, S.decodeUnknownResult, S.decodeUnknownOption, P.decodeUnknownResult, P.decodeUnknownOption ]) {Assert.throws(() => adapter(codec)("x"), (error) => error === defect);}

    Assert.ok((S.toStandardSchemaV1(codec)["~standard"].validate("x") as any).issues[0].message.includes("callback defect"));
    const malformed = G.transformResult(() => ({ _tag: "Success",
        success: 1 }) as any);
    Assert.throws(() => G.run(malformed, O.some("x"), {}), TypeError);
    const failure = S.decodeUnknownResult(S.Number)("x");
    Assert.equal(failure._tag, "Failure");
    if (failure._tag === "Failure") {Assert.ok(S.isSchemaError(failure.failure));}

    Assert.throws(() => S.decodeUnknownSync(S.Number)("x"), S.SchemaError);
    Assert.throws(() => P.decodeUnknownSync(S.Number)("x"), (error) => error instanceof Error && I.isIssue(error.cause));
    Assert.equal(G.run(G.transformOptionalResult(() => R.succeed(O.none())), O.some(1), {})._tag, "Success");
    Assert.equal(T.transformResult({ decode: (s: string) => R.succeed(Number(s)),
        encode: (n: number) => R.succeed(String(n)) })._tag, "Transformation");
});

test("Data-backed classes construct, extend, encode and preserve protocols", () =>
{
    class Person extends S.Class<Person>("Person")({ name: S.String,
        age: S.Number }) {}
    const value = S.decodeUnknownSync(Person)({ name: "A",
        age: 2 });
    Assert.ok(value instanceof Person);
    Assert.deepEqual(S.encodeSync(Person)(value), { name: "A",
        age: 2 });
    Assert.ok(Equal.equals(value, new Person({ name: "A",
        age: 2 })));
    class Employee extends Person.extend<Employee>("Employee")({ team: S.String }) {}
    Assert.ok(new Employee({ name: "A",
        age: 2,
        team: "B" }) instanceof Person);
    class Failure extends S.TaggedError<Failure>()("Failure", { reason: S.String }) {}
    const failure = new Failure({ reason: "bad" });
    Assert.ok(failure instanceof Error);
    Assert.equal(failure._tag, "Failure");
    Assert.equal("makeEffect" in Person, false);
    Assert.equal("makeEffect" in S.String, false);
    Assert.ok(Equal.equals(failure, new Failure({ reason: "bad" })));
});

test("native codecs, JSON codecs and pure Effect data schemas", () =>
{
    compare(S.DateFromString, U.DateFromString, [ "2026-01-01", "bad", 1 ]);
    compare(S.Uint8ArrayFromBase64, U.Uint8ArrayFromBase64, [ "", "aGVsbG8=", "?", "YQ==" ]);
    compare(S.fromJsonString(S.Struct({ name: S.String })), U.fromJsonString(U.Struct({ name: U.String })), [ "{\"name\":\"A\"}", "{}", "bad" ]);
    const option = S.Option(S.NumberFromString);
    Assert.deepEqual(S.decodeUnknownSync(option)(O.some("2")), O.some(2));
    Assert.deepEqual(S.encodeSync(option)(O.some(2)), O.some("2"));
    const result = S.Result(S.NumberFromString, S.String);
    Assert.deepEqual(S.decodeUnknownSync(result)(R.succeed("2")), R.succeed(2));
    Assert.deepEqual(S.decodeUnknownSync(S.ReadonlyMap(S.String, S.NumberFromString))(new Map([ [ "a", "2" ] ])), new Map([ [ "a", 2 ] ]));
    Assert.equal(S.toFormatter(S.Option(S.Number))(O.some(2)), "some(2)");
    Assert.equal(S.toEquivalence(S.Struct({ name: S.String }))({ name: "A" }, { name: "A" }), true);
});

test("JSON Schema documents, both dialects and Standard capabilities match upstream", () =>
{
    for (const [ local, upstream ] of [ [ S.Struct({ name: S.String,
        age: S.optionalKey(S.Int) }), U.Struct({ name: U.String,
        age: U.optionalKey(U.Int) }) ], [ S.Tuple([ S.String, S.Number ]), U.Tuple([ U.String, U.Number ]) ], [ S.String.check(S.isMinLength(2)), U.String.check(U.isMinLength(2)) ] ] as const)
    {
        const actual = S.toJsonSchemaDocument(local);
        const expected = U.toJsonSchemaDocument(upstream);
        Assert.deepEqual(actual, expected);
        Assert.deepEqual(J.toDocumentDraft07(actual), UJ.toDocumentDraft07(expected));
    }

    interface Node { readonly name: string;
        readonly children: ReadonlyArray<Node>; }
    const node: S.Codec<Node> = S.suspend(() => S.Struct({ name: S.String,
        children: S.Array(node) })).annotate({ identifier: "Node/~x" });
    const upstream: U.Codec<Node> = U.suspend(() => U.Struct({ name: U.String,
        children: U.Array(upstream) })).annotate({ identifier: "Node/~x" });
    const actual = S.toJsonSchemaDocument(node);
    Assert.deepEqual(actual, U.toJsonSchemaDocument(upstream));
    Assert.deepEqual(J.toDocumentDraft07(actual), UJ.toDocumentDraft07(U.toJsonSchemaDocument(upstream)));
    const standard = S.toStandardJSONSchemaV1(S.toStandardSchemaV1(S.Struct({ value: S.NumberFromString })));
    Assert.deepEqual(standard["~standard"].validate({ value: "2" }), { value: { value: 2 } });
    Assert.ok(standard["~standard"].jsonSchema.input({ target: "draft-07" }));
    Assert.ok(standard["~standard"].jsonSchema.output({ target: "draft-2020-12" }));
    Assert.throws(() => J.toDocumentDraft07({ dialect: "draft-2020-12",
        schema: { $ref: "https://example.com/schema" },
        definitions: {} }), /External/);
    Assert.throws(() => J.toDocumentDraft07({ dialect: "draft-2020-12",
        schema: { $id: "https://example.com/schema" },
        definitions: {} }), /Resource/);
});

test("pure collection, decimal, duration and redacted schemas decode and encode", () =>
{
    Assert.deepEqual(C.toArray(S.decodeUnknownSync(S.Chunk(S.NumberFromString))(C.fromIterable([ "1", "2" ]))), [ 1, 2 ]);
    Assert.deepEqual(HM.toEntries(S.decodeUnknownSync(S.HashMap(S.String, S.NumberFromString))(HM.fromIterable([ [ "a", "2" ] ]))), [ [ "a", 2 ] ]);
    Assert.deepEqual([ ...S.decodeUnknownSync(S.HashSet(S.NumberFromString))(HS.fromIterable([ "1", "2" ])) ], [ 1, 2 ]);
    Assert.ok(S.is(S.Duration)(Duration.millis(2)));
    Assert.ok(S.is(S.BigDecimal)(BigDecimal.fromStringUnsafe("2.3")));
    Assert.equal(Redacted.value(S.decodeUnknownSync(S.Redacted(S.NumberFromString))(Redacted.make("2"))), 2);
    Assert.equal(S.decodeUnknownResult(S.Redacted(S.Number))(Redacted.make("secret"))._tag, "Failure");
});

test("parse overrides, oneOf, numeric record keys and tuple construction defaults", () =>
{
    compare(S.Record(S.Number, S.NumberFromString), U.Record(U.Number, U.NumberFromString), [ { 1: "2",
        x: "bad" }, { "-1.5": "2",
        3: "bad" } ]);
    compare(S.Union([ S.Number, S.Int ], { mode: "oneOf" }), U.Union([ U.Number, U.Int ], { mode: "oneOf" }), [ 1, 1.5, "bad" ]);
    const schema = S.Struct({ a: S.Number,
        b: S.String });
    const parser = S.decodeUnknownResult(schema, { errors: "first" });
    const result = parser({ a: "bad",
        b: 1,
        excess: 1 }, { errors: "all",
        onExcessProperty: "error" });
    Assert.equal(result._tag, "Failure");
    if (result._tag === "Failure") {Assert.equal(result.failure.issue._tag === "Composite" ? result.failure.issue.issues.length : 0, 3);}

    const defaults = S.Tuple([ S.String, S.Number.pipe(S.withConstructorDefault(() => R.succeed(7))) ]);
    Assert.deepEqual(defaults.make([ "A" ]), [ "A", 7 ]);
    Assert.equal(S.decodeUnknownResult(defaults)([ "A" ])._tag, "Failure");
});

test("parametric declarations preserve both directions, custom derivation hooks and failures", () =>
{
    interface Box<A> { readonly value: A; }
    const box = S.declareConstructor<Box<number>, Box<string>>()([ S.NumberFromString ], ([ value ]) => (input, ast, options) =>
    {
        if (typeof input !== "object" || input === null || !("value" in input)) {return R.fail(new I.InvalidType(ast, input, options));}

        return R.map(P.decodeUnknownResult(value)(input.value, options), (value) => ({ value }));
    }, {
        toFormatter: ([ format ]) => (box) => `Box(${format(box.value)})`,
        toEquivalence: ([ equal ]) => (left, right) => equal(left.value, right.value)
    });
    Assert.deepEqual(S.decodeUnknownSync(box)({ value: "2" }), { value: 2 });
    Assert.deepEqual(S.encodeSync(box)({ value: 2 }), { value: "2" });
    Assert.equal(S.decodeUnknownResult(box)(null)._tag, "Failure");
    Assert.equal(S.toFormatter(box)({ value: 2 }), "Box(2)");
    Assert.equal(S.toEquivalence(box)({ value: 2 }, { value: 2 }), true);
    const malformed = S.declareConstructor<number>()([], () => () => Promise.resolve(1) as never);
    Assert.throws(() => S.decodeUnknownResult(malformed)(1), TypeError);
    const defaultFailure = S.Struct({ value: S.Number.pipe(S.withConstructorDefault(() => R.fail(new I.InvalidValue({ message: "no default" })))) });
    Assert.throws(() => defaultFailure.make({}), (error) => error instanceof Error && I.isIssue(error.cause));
});

