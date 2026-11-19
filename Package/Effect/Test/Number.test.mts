/**
 * Generic numeric primitives, call styles, and boundary behavior.
 *
 * @module @bedform/effect/Test/Number.test
 *
 * @file      Number.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Numeric fixtures retain inference and explicit boundary ordering. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as N from "@bedform/effect/Number";
import { Number as RootNumber } from "@bedform/effect";
import { pipe } from "@bedform/effect/Function";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";

const Unary = [
    [ N.abs, Math.abs ],
    [ N.negate, (value: number): number => -value ],
    [ N.sqrt, Math.sqrt ],
    [ N.sin, Math.sin ],
    [ N.cos, Math.cos ],
    [ N.asin, Math.asin ],
    [ N.acos, Math.acos ],
    [ N.floor, Math.floor ],
    [ N.ceil, Math.ceil ],
    [ N.trunc, Math.trunc ],
    [ N.toRadians, (value: number): number => value * (Math.PI / 180) ],
    [ N.toDegrees, (value: number): number => value * (180 / Math.PI) ]
] as const;

test("unary helpers preserve native domains and all four call styles", () =>
{
    for (const [ operation, reference ] of Unary)
    {
        for (const value of [ -Infinity, -1e308, -2, -1, -0.5, -Number.MIN_VALUE, -0, 0, Number.MIN_VALUE, 0.5, 1, 2, 1e308, Infinity, NaN ])
        {
            const expected = reference(value);
            Assert.equal(operation(value), expected);
            Assert.equal(operation()(value), expected);
            Assert.equal(pipe(value, operation), expected);
            Assert.equal(pipe(value, operation()), expected);
        }
    }

    Assert.equal(N.toRadians(180), Math.PI);
    Assert.equal(N.toDegrees(Math.PI), 180);
});

test("binary helpers preserve order, quadrants and native exceptional values", () =>
{
    for (const [ operation, reference ] of [ [ N.atan2, Math.atan2 ], [ N.hypot, Math.hypot ], [ N.pow, Math.pow ] ] as const)
    {
        for (const a of [ -Infinity, -2, -1, -0, 0, Number.MIN_VALUE, 0.5, 1, 2, 1e308, Infinity, NaN ])
        {
            for (const b of [ -Infinity, -3, -1, -0, 0, Number.MIN_VALUE, 0.5, 1, 3, 1e308, Infinity, NaN ])
            {
                const expected = reference(a, b);
                Assert.equal(operation(a, b), expected);
                Assert.equal(operation(b)(a), expected);
                Assert.equal(pipe(a, operation(b)), expected);
            }
        }
    }

    Assert.equal(N.pow(3)(2), 8);
    Assert.equal(N.atan2(-1)(1), 3 * Math.PI / 4);
    Assert.ok(Number.isFinite(N.hypot(1e308, 1e308)));
    Assert.ok(N.hypot(1e-300, 1e-300) > 1e-300);
});

test("positive modulo validates its domain and handles extreme finite values", () =>
{
    for (const [ value, modulus, expected ] of [ [ -1, 3, 2 ], [ 7, 3, 1 ], [ -6, 3, 0 ], [ -0, 3, 0 ], [ 0, 3, 0 ], [ 1, 3, 1 ], [ -0.5, 2, 1.5 ], [ -Number.MIN_VALUE, 1, 0 ], [ Number.MAX_VALUE, Number.MAX_VALUE, 0 ], [ -1, Number.MAX_VALUE, 0 ], [ 3 * Number.MIN_VALUE, 2 * Number.MIN_VALUE, Number.MIN_VALUE ] ])
    {
        Assert.equal(N.positiveModulo(value, modulus), expected);
        Assert.equal(N.positiveModulo(modulus)(value), expected);
        Assert.equal(pipe(value, N.positiveModulo(modulus)), expected);
    }

    for (const modulus of [ -Infinity, -1, -0, 0, Infinity, NaN ])
    {
        Assert.ok(Number.isNaN(N.positiveModulo(1, modulus)));
    }

    for (const value of [ -Infinity, Infinity, NaN ])
    {
        Assert.ok(Number.isNaN(N.positiveModulo(value, 2)));
    }
});

test("lerp preserves operand order, endpoints, extrapolation and raw arithmetic", () =>
{
    for (const [ self, that, t, expected ] of [ [ 2, 10, 0, 2 ], [ 2, 10, 1, 10 ], [ 2, 10, 0.25, 4 ], [ 2, 10, -1, -6 ], [ 2, 10, 2, 18 ], [ Infinity, 1, 0, NaN ], [ 1, 2, NaN, NaN ], [ -1e308, 1e308, 0.5, Infinity ] ])
    {
        Assert.equal(N.lerp(self, that, t), expected);
        Assert.equal(N.lerp(that, t)(self), expected);
        Assert.equal(pipe(self, N.lerp(that, t)), expected);
    }
});

test("all additions resolve through root and subpath and load in a restricted host", async () =>
{
    const names = [ "abs", "negate", "sqrt", "sin", "cos", "asin", "acos", "floor", "ceil", "trunc", "toRadians", "toDegrees", "atan2", "hypot", "pow", "positiveModulo", "lerp" ] as const;
    for (const name of names)
    {
        Assert.strictEqual(RootNumber[name], N[name]);
    }

    const bundle = await build({ stdin: { contents: `import * as N from "@bedform/effect/Number";
        globalThis.results = [N.sin(Math.PI / 2), N.hypot(3, 4), N.positiveModulo(-1, 3), N.lerp(2, 10, 0.5)];`,
    resolveDir: process.cwd() },
    bundle: true,
    write: false,
    platform: "neutral",
    format: "iife" });
    const context = { console: undefined,
        process: undefined,
        Buffer: undefined,
        URL: undefined,
        TextEncoder: undefined,
        TextDecoder: undefined,
        setTimeout: undefined };
    runInNewContext(bundle.outputFiles[0].text, context);
    Assert.equal(JSON.stringify((context as typeof context & { results: unknown }).results), "[1,5,2,6]");
});
