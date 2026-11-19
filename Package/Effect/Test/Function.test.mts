/**
 * Differential tests for the complete pinned Function module and its package surface.
 *
 * @module @bedform/effect/Test/Function.test
 *
 * @file      Function.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

import * as Bedrock from "@bedform/effect/Function";
import * as Root from "@bedform/effect";
import * as Upstream from "effect/Function";
import Assert from "node:assert/strict";
import TypeScript from "typescript";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/* Contextual parameter types intentionally exercise the public overloads. */
/* eslint @typescript-eslint/typedef: "off" */

const Modules = [ Upstream, Bedrock ];

test("Function exposes every upstream runtime export through direct, namespace and root imports", () =>
{
    Assert.deepEqual(Object.keys(Bedrock).sort(), Object.keys(Upstream).sort());
    Assert.strictEqual(Root.Function, Bedrock);
    for (const key of Object.keys(Bedrock) as Array<keyof typeof Bedrock>)
    {
        Assert.strictEqual(Root[key], Bedrock[key]);
    }
});

test("Function declarations preserve upstream signatures and the documented Thunk extension", () =>
{
    const Printer = TypeScript.createPrinter({ removeComments: true });
    const normalize = (specifier: string): string =>
    {
        const path = new URL(import.meta.resolve(specifier).replace(/\.js$/, ".d.ts"));
        const source = readFileSync(path, "utf8").replaceAll("\"./HKT.ts\"", "\"./HKT.js\"");
        const file = TypeScript.createSourceFile(
            path.pathname,
            source,
            TypeScript.ScriptTarget.Latest,
            true
        );
        if (specifier === "@bedform/effect/Function")
        {
            const extensions = file.statements.filter((statement) =>
                TypeScript.isTypeAliasDeclaration(statement) && statement.name.text === "Thunk");
            Assert.equal(extensions.length, 1);
            const expected = TypeScript.createSourceFile(
                "Thunk.d.ts",
                "export type Thunk<A extends ReadonlyArray<unknown> = never> = " +
                    "[A] extends [never] ? () => void : (...ArgumentVector: A) => void;",
                TypeScript.ScriptTarget.Latest,
                true
            );
            Assert.equal(
                Printer.printFile(TypeScript.factory.updateSourceFile(file, extensions)),
                Printer.printFile(expected)
            );
            return Printer.printFile(TypeScript.factory.updateSourceFile(
                file,
                file.statements.filter((statement) => !extensions.includes(statement))
            ));
        }

        return Printer.printFile(file);
    };

    Assert.equal(normalize("@bedform/effect/Function"), normalize("effect/Function"));
});

test("Function runtime dependency closure contains only shipped relative ESM modules", () =>
{
    const Visited = new Set<string>();
    const visit = (url: URL): void =>
    {
        if (Visited.has(url.href))
        {
            return;
        }

        Visited.add(url.href);
        const source = readFileSync(url, "utf8");
        const file = TypeScript.createSourceFile(url.pathname, source, TypeScript.ScriptTarget.Latest, true);
        for (const statement of file.statements)
        {
            if (TypeScript.isImportDeclaration(statement))
            {
                const specifier = (statement.moduleSpecifier as TypeScript.StringLiteral).text;
                Assert.ok(specifier.startsWith("./"), `External dependency: ${specifier}`);
                visit(new URL(specifier, url));
            }
        }
    };

    visit(new URL(import.meta.resolve("@bedform/effect/Function")));
    Assert.equal(Visited.size, 2);
});

test("dual preserves specialized and generic arities, partial arguments and invalid-arity errors", () =>
{
    for (const Module of Modules)
    {
        for (const arity of [ 2, 3, 4, 5, 7 ])
        {
            const collect = Module.dual(arity, (...values: Array<number>) => values);
            const args = Array.from({ length: arity }, (_, index) => index + 1);
            Assert.deepEqual(collect(...args), args);
            Assert.deepEqual(collect(...args.slice(1))(args[0]), args);
            const partial = arity <= 3 ? [ args[0], ...Array(arity - 1).fill(undefined) ] : [ args[0] ];
            Assert.deepEqual(collect()(args[0]), partial);
            const extra = [ ...args, 99 ];
            Assert.deepEqual(collect(...extra), arity <= 3 ? args : extra);
        }

        for (const arity of [ 0, 1 ])
        {
            Assert.throws(() => Module.dual(arity, (...args: Array<number>) => args), {
                message: `Invalid arity ${arity}`,
                name: "RangeError"
            });
        }
    }
});

test("dual predicate receives IArguments and forwards data-first receivers", () =>
{
    for (const Module of Modules)
    {
        const Receiver = { offset: 10 };
        const collect = Module.dual(
            (args) =>
            {
                Assert.equal(Object.prototype.toString.call(args), "[object Arguments]");
                return args.length >= 2;
            },
            function(this: typeof Receiver | undefined, ...args: Array<number>)
            {
                return [ this?.offset, ...args ];
            }
        );
        Assert.deepEqual(collect.call(Receiver, 1, 2, 3), [ 10, 1, 2, 3 ]);
        Assert.deepEqual(collect(2)(1), [ undefined, 1, 2 ]);

        const generic = Module.dual(4, function(this: typeof Receiver, ...args: Array<number>)
        {
            return [ this.offset, ...args ];
        });
        Assert.deepEqual(generic.call(Receiver, 1, 2, 3, 4), [ 10, 1, 2, 3, 4 ]);
    }
});

test("pipe preserves identity and executes each specialized and fallback pipeline in order", () =>
{
    for (const Module of Modules)
    {
        const Value = {};
        Assert.strictEqual(Module.pipe(Value), Value);
        for (let length = 1; length <= 25; length++)
        {
            const Calls: Array<number> = [];
            const functions = Array.from({ length }, (_, index) => (value: number) =>
            {
                Calls.push(index);
                return value * 2 + index;
            });
            const invoke = Module.pipe as (value: number, ...steps: typeof functions) => number;
            Assert.equal(invoke(1, ...functions), functions.reduce((value, step) => step(value), 1));
            Assert.deepEqual(Calls.slice(0, length), Array.from({ length }, (_, index) => index));
        }
    }
});

test("flow preserves identity, first-function receiver and arguments through all nine overloads", () =>
{
    for (const Module of Modules)
    {
        const first = function(this: { offset: number }, left: number, right: number): number
        {
            return this.offset + left + right;
        };

        Assert.strictEqual(Module.flow(first), first);
        const invoke = Module.flow as (...steps: Array<(...args: Array<any>) => any>) => typeof first;
        for (let length = 1; length <= 9; length++)
        {
            const tail = Array.from({ length: length - 1 }, () => (value: number) => value * 2);
            Assert.equal(invoke(first, ...tail).call({ offset: 3 }, 4, 5), 12 * 2 ** (length - 1));
        }

        // Preserve upstream behavior for untyped calls outside the supported overloads.
        Assert.equal(invoke(), undefined);
        Assert.equal(invoke(...Array.from({ length: 10 }, () => Module.identity)), undefined);
    }
});

test("identity, constants, type helpers, tuple adapters and composition preserve values", () =>
{
    for (const Module of Modules)
    {
        const Value = { value: 1 };
        Assert.strictEqual(Module.identity(Value), Value);
        Assert.strictEqual(Module.cast(Value), Value);
        Assert.strictEqual(Module.satisfies<object>()(Value), Value);
        Assert.strictEqual(Module.constant(Value)(), Value);
        Assert.strictEqual(Module.SK(undefined, Value), Value);
        Assert.equal(Module.constTrue(), true);
        Assert.equal(Module.constFalse(), false);
        Assert.equal(Module.constNull(), null);
        Assert.equal(Module.constUndefined(), undefined);
        Assert.equal(Module.constVoid(), undefined);
        Assert.strictEqual(Module.constVoid, Module.constUndefined);
        Assert.equal(Module.apply(3)((value) => value * 2), 6);
        Assert.equal(Module.compose((value: number) => value + 1, (value) => value * 2)(3), 8);
        Assert.equal(Module.compose((value: number) => value * 2)((value: number) => value + 1)(3), 8);
        Assert.deepEqual(Module.tupled((...args: Array<unknown>) => args)([ 1, "two" ]), [ 1, "two" ]);
        Assert.deepEqual(Module.untupled((args: [number, string]) => args)(1, "two"), [ 1, "two" ]);
        const flipped = Module.flip((a: number, b: string) => (c: boolean, d: number) => [ a, b, c, d ]);
        Assert.deepEqual(flipped(true, 4)(1, "two"), [ 1, "two", true, 4 ]);
        for (const fail of [ Module.absurd, Module.hole ])
        {
            Assert.throws(() => fail(undefined as never), {
                message: "Called `absurd` function which should be uncallable",
                name: "Error"
            });
        }
    }
});

test("memoize caches by object identity including null and false, and retries thrown computations", () =>
{
    for (const Module of Modules)
    {
        let calls = 0;
        const memoized = Module.memoize((input: { value: number }) =>
        {
            calls++;
            return { value: input.value };
        });
        const Input = { value: 1 };
        const Output = memoized(Input);
        Input.value = 2;
        Assert.strictEqual(memoized(Input), Output);
        Assert.equal(Output.value, 1);
        Assert.notStrictEqual(memoized({ value: 1 }), Output);
        Assert.equal(calls, 2);
        for (const value of [ null, false, 0, "" ])
        {
            let runs = 0;
            const cached = Module.memoize(() =>
            {
                runs++;
                return value;
            });
            Assert.equal(cached(Input), value);
            Assert.equal(cached(Input), value);
            Assert.equal(runs, 1);
        }

        let attempts = 0;
        const retry = Module.memoize(() =>
        {
            if (attempts++ === 0)
            {
                throw new Error("retry");
            }

            return Input;
        });
        Assert.throws(() => retry(Input), /retry/);
        Assert.strictEqual(retry(Input), Input);
        Assert.strictEqual(retry(Input), Input);
        Assert.equal(attempts, 2);
    }
});

test("memoizeIdempotent caches both inputs and outputs with separate wrapper caches", () =>
{
    for (const Module of Modules)
    {
        let calls = 0;
        const transform = (input: { value: number }): { value: number } =>
        {
            calls++;
            return input.value === 0 ? input : { value: 0 };
        };

        const memoized = Module.memoizeIdempotent(transform);
        const Input = { value: 1 };
        const Output = memoized(Input);
        Assert.strictEqual(memoized(Input), Output);
        Assert.strictEqual(memoized(Output), Output);
        Assert.equal(calls, 1);
        const Fixed = { value: 0 };
        Assert.strictEqual(memoized(Fixed), Fixed);
        Assert.strictEqual(memoized(Fixed), Fixed);
        Assert.equal(calls, 2);
        Assert.notStrictEqual(Module.memoizeIdempotent(transform)(Input), Output);
        Assert.equal(calls, 3);
    }
});
