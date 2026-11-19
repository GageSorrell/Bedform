/**
 * Complete APIs and differential behavior of the existing collection helper group.
 *
 * @module @bedform/effect/Test/Collections.test
 *
 * @file      Collections.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Fixtures pair implementations across their distinct inspection-symbol declarations. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as A from "@bedform/effect/Array";
import * as R from "@bedform/effect/Record";
import * as S from "@bedform/effect/Struct";
import * as N from "@bedform/effect/Number";
import * as T from "@bedform/effect/Tuple";
import * as UA from "effect/Array";
import * as UR from "effect/Record";
import * as US from "effect/Struct";
import * as UN from "effect/Number";
import * as UT from "effect/Tuple";
import * as UResult from "effect/Result";
import * as Root from "@bedform/effect";
import Assert from "node:assert/strict";
import TypeScript from "typescript";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const NumberAdditions = [ "abs", "negate", "sqrt", "sin", "cos", "asin", "acos", "floor", "ceil", "trunc", "toRadians", "toDegrees", "atan2", "hypot", "pow", "positiveModulo", "lerp" ];
const Names = [ "Array", "Record", "Struct", "Number", "Tuple" ] as const;
const Local = [ A, R, S, N, T ];
const Upstream = [ UA, UR, US, UN, UT ];

/**
 * Converts nominal Option/Result wrappers while retaining ordinary arrays and own keys.
 *
 * @category Tests
 * @since 1.0.0
 */
function plain(value: unknown): unknown
{
    if (Root.Option.isOption(value))
    {
        return value._tag === "Some" ? { _tag: "Some",
            value: plain(value.value) } : { _tag: "None" };
    }

    if (Root.Result.isResult(value))
    {
        return value._tag === "Success" ? { _tag: "Success",
            success: plain(value.success) } : { _tag: "Failure",
            failure: plain(value.failure) };
    }

    if (Array.isArray(value))
    {
        return value.map(plain);
    }

    if (value && typeof value === "object" && [ null, Object.prototype ].includes(Object.getPrototypeOf(value)))
    {
        return Object.fromEntries(Reflect.ownKeys(value).map((key) => [ key, plain((value as Record<PropertyKey, unknown>)[key]) ]));
    }

    return value;
}

/**
 * Compares results without depending on shared package inspection prototypes.
 *
 * @category Tests
 * @since 1.0.0
 */
function same(actual: unknown, expected: unknown): void
{
    Assert.deepEqual(plain(actual), plain(expected));

}

/**
 * Records a return value or an ordinary thrown error for differential boundaries.
 * A thrown value that is not an `Error` is rethrown.
 *
 * @throws { unknown } When the callback throws a value that is not an `Error`.
 *
 * @category Tests
 * @since 1.0.0
 */
function outcome(run: () => unknown): unknown
{
    try
    {
        return { value: plain(run()) };

    }
    catch (error)
    {
        if (error instanceof Error)
        {
            return { error: error.name,
                message: error.message };
        }

        throw error;
    }
}

test("all five modules expose complete pinned runtime APIs and root namespaces", () =>
{
    for (let index = 0; index < Names.length; index++)
    {
        Assert.deepEqual(Object.keys(Local[index]).filter((key) => Names[index] !== "Number" || !NumberAdditions.includes(key)).sort(), Object.keys(Upstream[index]).sort(), Names[index]);
        Assert.strictEqual(Root[Names[index]], Local[index]);
    }
});

test("all public declarations and emitted algorithms match pinned upstream", () =>
{
    const printer = TypeScript.createPrinter({ removeComments: true });
    const canonical = (text: string, omitNumberAdditions: boolean): string =>
    {
        const file = TypeScript.createSourceFile("module.ts", text.replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/"), TypeScript.ScriptTarget.Latest, true);
        // Compare the original Number surface independently of deliberate local additions.
        const statements = file.statements.filter((node) =>
            !omitNumberAdditions || !TypeScript.isVariableStatement(node) || !node.declarationList.declarations.some((declaration) =>
                TypeScript.isIdentifier(declaration.name) && NumberAdditions.includes(declaration.name.text)));
        const imports = statements.filter(TypeScript.isImportDeclaration).map((node) => printer.printNode(TypeScript.EmitHint.Unspecified, node, file)).sort();
        const rest = statements.filter((node) => !TypeScript.isImportDeclaration(node)).map((node) => printer.printNode(TypeScript.EmitHint.Unspecified, node, file));
        const syntax = TypeScript.createSourceFile("canonical.ts", [ ...imports, ...rest ].join("\n"), TypeScript.ScriptTarget.Latest, true);
        // Repository formatting adds braces to upstream's single-statement if branches.
        const blocks = TypeScript.transform(syntax, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> =>
            {
                if (TypeScript.isIfStatement(node))
                {
                    const branch = TypeScript.visitNode(node.thenStatement, visit) as TypeScript.Statement;
                    return context.factory.updateIfStatement(node, node.expression, TypeScript.isBlock(branch) ? branch : context.factory.createBlock([ branch ]), TypeScript.visitNode(node.elseStatement, visit) as TypeScript.Statement | undefined);
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (root) => TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
        } ]);
        const normalized = TypeScript.createSourceFile("canonical.ts", printer.printFile(blocks.transformed[0]), TypeScript.ScriptTarget.Latest, true);
        blocks.dispose();
        const tokens: Array<string> = [];
        const collect = (node: TypeScript.Node): void =>
        {
            const children = node.getChildren(normalized);
            if (children.length)
            {
                children.forEach(collect);
            }
            else
            {
                tokens.push(`${node.kind}:${node.getText(normalized)}`);
            }
        };

        collect(normalized);
        return JSON.stringify(tokens);
    };

    for (const name of Names)
    {
        const local = new URL(import.meta.resolve(`@bedform/effect/${name}`));
        const upstream = new URL(import.meta.resolve(`effect/${name}`));
        const declarations = (url: URL): string =>
        {
            const source = TypeScript.createSourceFile("module.d.ts", readFileSync(new URL(url.href.replace(/\.js$/, ".d.ts")), "utf8"), TypeScript.ScriptTarget.Latest, true);
            const stripped = TypeScript.transform(source, [ (context) =>
            {
                const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
                {
                    if (TypeScript.getJSDocTags(node).some((tag) => tag.tagName.text === "internal"))
                    {
                        return undefined;
                    }

                    return TypeScript.visitEachChild(node, visit, context);
                };

                return (node) => TypeScript.visitNode(node, visit) as TypeScript.SourceFile;
            } ]);
            try
            {
                return canonical(printer.printFile(stripped.transformed[0]), name === "Number");

            }
            finally
            {
                stripped.dispose();

            }
        };

        Assert.equal(declarations(local), declarations(upstream), `${name} declarations`);
        const source = (url: URL): string =>
        {
            const text = readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
                .replaceAll("/Internal/", "/internal/")
                .replaceAll("/Encoding/", "/encoding/")
                .replaceAll("/Schema/", "/schema/");
            return canonical(TypeScript.transpileModule(text, { compilerOptions: { target: TypeScript.ScriptTarget.ES2022,
                module: TypeScript.ModuleKind.ESNext,
                removeComments: true } }).outputText, name === "Number");
        };

        Assert.equal(source(new URL(`../Source/${name}.ts`, import.meta.url)), source(new URL(`../src/${name}.ts`, upstream)), `${name} algorithms`);
    }
});

test("Array mapping, flattening, folding, zipping and accumulator callbacks match", () =>
{
    for (const values of [ [], [ 1 ], [ 3, 1, 2, 1 ], [ -1, 0, 2 ] ])
    {
        const input = Object.freeze([ ...values ]);
        same(A.map(input, (value, index) => value + index), UA.map(input, (value, index) => value + index));
        same(A.map((value: number) => value * 2)(input), UA.map((value: number) => value * 2)(input));
        same(A.flatMap(input, (value) => [ value, -value ]), UA.flatMap(input, (value) => [ value, -value ]));
        same(A.reduce(input, "", (acc, value, index) => `${acc}${index}:${value};`), UA.reduce(input, "", (acc, value, index) => `${acc}${index}:${value};`));
        same(A.reduceRight(input, "", (acc, value, index) => `${acc}${index}:${value};`), UA.reduceRight(input, "", (acc, value, index) => `${acc}${index}:${value};`));
        same(A.scan(input, 0, (acc, value) => acc + value), UA.scan(input, 0, (acc, value) => acc + value));
        same(A.mapAccum(input, 0, (acc, value) => [ acc + value, value * 2 ]), UA.mapAccum(input, 0, (acc, value) => [ acc + value, value * 2 ]));
        same(A.zip(input, [ "a", "b" ]), UA.zip(input, [ "a", "b" ]));
        same(A.reverse(input), UA.reverse(input));
        Assert.deepEqual(input, values);
    }
});

test("Array count/index boundaries, sparse inputs and safe/unsafe lookup match", () =>
{
    const input = Object.freeze([ 1, 2, 3 ]);
    for (const count of [ -Infinity, -2, -0, 0, 1, 1.5, 3, 5, NaN, Infinity ])
    {
        same(A.take(input, count), UA.take(input, count));
        same(A.drop(input, count), UA.drop(input, count));
        same(A.takeRight(input, count), UA.takeRight(input, count));
        same(A.dropRight(input, count), UA.dropRight(input, count));
        same(A.splitAt(input, count), UA.splitAt(input, count));
        same(A.get(input, count), UA.get(input, count));
    }

    for (const index of [ -1, 0, 1, 3 ])
    {
        same(A.insertAt(input, index, 9), UA.insertAt(input, index, 9));
        same(A.modify(input, index, (value) => value * 2), UA.modify(input, index, (value) => value * 2));
        same(A.remove(input, index), UA.remove(input, index));
    }

    same(outcome(() => A.getUnsafe(input, 4)), outcome(() => UA.getUnsafe(input, 4)));
    const sparse = new Array<number>(3);
    sparse[1] = 2;
    same(A.map(sparse, (value) => value), UA.map(sparse, (value) => value));
    same(A.fromIterable(new Set([ 3, 1, 2 ])), UA.fromIterable(new Set([ 3, 1, 2 ])));
    same(A.head([]), UA.head([]));
    same(A.last(input), UA.last(input));
});

test("Array grouping, set operations, Result filters and do notation match", () =>
{
    const values = [ 1, 2, 2, 3, 4 ];
    same(A.groupBy(values, (value) => String(value % 2)), UA.groupBy(values, (value) => String(value % 2)));
    same(A.dedupe(values), UA.dedupe(values));
    same(A.union(values, [ 3, 5 ]), UA.union(values, [ 3, 5 ]));
    same(A.intersection(values, [ 2, 3 ]), UA.intersection(values, [ 2, 3 ]));
    same(A.difference(values, [ 2, 3 ]), UA.difference(values, [ 2, 3 ]));
    same(A.chunksOf(values, 2), UA.chunksOf(values, 2));
    same(A.window(values, 3), UA.window(values, 3));
    const filter = (value: number) => value % 2 ? Root.Result.fail(value) : Root.Result.succeed(String(value));
    same(A.partition(values, filter), UA.partition(values, (value) => value % 2 ? UResult.fail(value) : UResult.succeed(String(value))));
    same(A.getSomes([ Root.Option.none(), Root.Option.some(2) ]), [ 2 ]);
    const local = Root.pipe(A.Do, A.bind("value", () => [ 1, 2 ]), A.let("double", (row) => row.value * 2));
    const upstream = Root.pipe(UA.Do, UA.bind("value", () => [ 1, 2 ]), UA.let("double", (row) => row.value * 2));
    same(local, upstream);
});

test("Record immutable lookup, updates, mapped entries, partitions and set operations match", () =>
{
    const input: Readonly<Record<string, number>> = Object.freeze({ a: 1,
        b: 2,
        c: 3 });
    same(R.map(input, (value, key) => `${key}:${value}`), UR.map(input, (value, key) => `${key}:${value}`));
    same(R.filter(input, (value) => value > 1), UR.filter(input, (value) => value > 1));
    same(R.set(input, "d", 4), UR.set(input, "d", 4));
    same(R.remove(input, "b"), UR.remove(input, "b"));
    same(R.modify(input, "b", (value) => value * 2), UR.modify(input, "b", (value) => value * 2));
    same(R.modify(input, "missing", (value) => value * 2), UR.modify(input, "missing", (value) => value * 2));
    same(R.get(input, "missing"), UR.get(input, "missing"));
    same(R.partition(input, (value) => value % 2 ? Root.Result.fail(value) : Root.Result.succeed(value)), UR.partition(input, (value) => value % 2 ? UResult.fail(value) : UResult.succeed(value)));
    same(R.union(input, { b: 5,
        d: 4 }, (a, b) => a + b), UR.union(input, { b: 5,
        d: 4 }, (a, b) => a + b));
    same(R.intersection(input, { b: 5,
        d: 4 }, (a, b) => a + b), UR.intersection(input, { b: 5,
        d: 4 }, (a, b) => a + b));
    same(R.difference(input, { b: 5,
        d: 4 }), UR.difference(input, { b: 5,
        d: 4 }));
    Assert.deepEqual(input, { a: 1,
        b: 2,
        c: 3 });
});

test("prototype-sensitive and symbol keys retain upstream semantics without prototype pollution", () =>
{
    const symbol = Symbol("key");
    const input: Record<string | symbol, number> = JSON.parse("{\"__proto__\":1,\"constructor\":2,\"a\":3}");
    input[symbol] = 4;
    const actual = R.map(input, (value) => value * 2);
    const expected = UR.map(input, (value) => value * 2);
    same(actual, expected);
    Assert.equal(Object.getPrototypeOf(actual), Object.getPrototypeOf(expected));
    Assert.equal(Object.hasOwn(actual, "__proto__"), Object.hasOwn(expected, "__proto__"));
    const entries: Array<readonly [string | symbol, number]> = [ [ "__proto__", 1 ], [ symbol, 2 ], [ "a", 3 ] ];
    same(R.fromEntries(entries), UR.fromEntries(entries));
    same(S.pick(input, [ "__proto__", symbol ]), US.pick(input, [ "__proto__", symbol ]));
    same(S.omit(input, [ symbol ]), US.omit(input, [ symbol ]));
    const inherited = Object.create({ inherited: 1 });
    inherited.own = 2;
    same(R.keys(inherited), UR.keys(inherited));
    same(S.keys(inherited), US.keys(inherited));
    Assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("Struct selection, assignment, evolution, renaming and typed records match", () =>
{
    const input = Object.freeze({ name: "A",
        count: 2,
        active: true });
    same(S.pick(input, [ "name", "count" ]), US.pick(input, [ "name", "count" ]));
    same(S.omit(input, [ "active" ]), US.omit(input, [ "active" ]));
    same(S.assign(input, { count: 3,
        more: "B" }), US.assign(input, { count: 3,
        more: "B" }));
    same(S.evolve(input, { count: (value) => value * 2,
        name: (value) => value.toLowerCase() }), US.evolve(input, { count: (value) => value * 2,
        name: (value) => value.toLowerCase() }));
    same(S.renameKeys(input, { name: "label",
        count: "amount" }), US.renameKeys(input, { name: "label",
        count: "amount" }));
    same(S.Record([ "a", "b" ], 1), US.Record([ "a", "b" ], 1));
    Assert.deepEqual(input, { name: "A",
        count: 2,
        active: true });
});

test("Tuple positions, append operations, transforms and comparison derivation match", () =>
{
    const input = Object.freeze([ 1, "A", true ] as const);
    same(T.pick(input, [ 0, 2 ]), UT.pick(input, [ 0, 2 ]));
    same(T.omit(input, [ 1 ]), UT.omit(input, [ 1 ]));
    same(T.appendElement(input, 9), UT.appendElement(input, 9));
    same(T.appendElements(input, [ 9, "B" ]), UT.appendElements(input, [ 9, "B" ]));
    same(T.evolve(input, [ (value) => value + 1, (value) => value.toLowerCase() ]), UT.evolve(input, [ (value) => value + 1, (value) => value.toLowerCase() ]));
    same(T.renameIndices(input, [ "2", "1", "0" ]), UT.renameIndices(input, [ "2", "1", "0" ]));
    Assert.equal(T.get(input, 1), UT.get(input, 1));
    Assert.equal(T.isTupleOf(input, 3), UT.isTupleOf(input, 3));
    Assert.equal(T.isTupleOfAtLeast(input, 2), UT.isTupleOfAtLeast(input, 2));
    const order = T.makeOrder([ N.Order, N.Order ]);
    Assert.equal(order([ 1, 2 ], [ 1, 3 ]), UT.makeOrder([ UN.Order, UN.Order ])([ 1, 2 ], [ 1, 3 ]));
    same(T.makeReducer([ N.ReducerSum, N.ReducerMultiply ]).combineAll([ [ 1, 2 ], [ 3, 4 ] ]), UT.makeReducer([ UN.ReducerSum, UN.ReducerMultiply ]).combineAll([ [ 1, 2 ], [ 3, 4 ] ]));
});

test("Number arithmetic, parse, rounding, floating remainder and reducers match at boundaries", () =>
{
    const values = [ -Infinity, -Number.MAX_VALUE, -3.5, -1, -0, 0, Number.MIN_VALUE, 0.1, 1, 2, Number.MAX_SAFE_INTEGER, Infinity, NaN ];
    for (const a of values)
    {
        for (const b of [ -2, -0, 0, 0.2, 2, Infinity, NaN ])
        {
            same(N.sum(a, b), UN.sum(a, b));
            same(N.subtract(a, b), UN.subtract(a, b));
            same(N.multiply(a, b), UN.multiply(a, b));
            same(N.divide(a, b), UN.divide(a, b));
            same(outcome(() => N.divideUnsafe(a, b)), outcome(() => UN.divideUnsafe(a, b)));
            same(outcome(() => N.remainder(a, b)), outcome(() => UN.remainder(a, b)));
            Assert.equal(N.isLessThan(a, b), UN.isLessThan(a, b));
        }
    }

    for (const value of values)
    {
        same(N.sign(value), UN.sign(value));
        same(N.clamp(value, { minimum: -1,
            maximum: 1 }), UN.clamp(value, { minimum: -1,
            maximum: 1 }));
        same(N.round(value, 2), UN.round(value, 2));
        same(N.nextPow2(value), UN.nextPow2(value));
    }

    for (const value of [ "", " ", "NaN", "Infinity", "-Infinity", "0x10", "1e3", "1.2x", "-0" ])
    {
        same(N.parse(value), UN.parse(value));
    }

    same(N.ReducerSum.combineAll([ 1, 2, 3 ]), UN.ReducerSum.combineAll([ 1, 2, 3 ]));
    same(N.ReducerMultiply.combineAll([]), UN.ReducerMultiply.combineAll([]));
    same(N.ReducerMin.combineAll([]), UN.ReducerMin.combineAll([]));
    same(N.ReducerMax.combineAll([]), UN.ReducerMax.combineAll([]));
});

test("callbacks preserve evaluation order and propagate defects unchanged", () =>
{
    const defect = new Error("callback defect");
    Assert.throws(() => A.map([ 1 ], () =>
    {
        throw defect;

    }), (error) => error === defect);
    Assert.throws(() => R.map({ a: 1 }, () =>
    {
        throw defect;

    }), (error) => error === defect);
    Assert.throws(() => S.evolve({ a: 1 }, { a: () =>
    {
        throw defect;

    } }), (error) => error === defect);
    Assert.throws(() => T.evolve([ 1 ], [ () =>
    {
        throw defect;

    } ]), (error) => error === defect);
    const calls: Array<number> = [];
    A.findFirst([ 1, 2, 3 ], (value) =>
    {
        calls.push(value);
        return value === 2;

    });
    Assert.deepEqual(calls, [ 1, 2 ]);
});
