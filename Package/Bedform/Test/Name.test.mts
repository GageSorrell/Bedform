/**
 * Public name constructors, sampling boundaries, configuration and dictionary integrity.
 *
 * @module bedform/Test/Name.test
 *
 * @file      Name.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Direct from "bedform/Utility/Name";
import { type TestContext, test } from "node:test";
import Assert from "node:assert/strict";
import { Name } from "bedform/Utility";
import { Utility } from "bedform";
import { build } from "esbuild";

test("all public entrypoints expose the same name module", () =>
{
    Assert.equal(Direct.Make, Name.Make);
    Assert.equal(Utility.Name.Make, Name.Make);
    Assert.equal(Direct.MakeFast, Name.MakeFast);
    Assert.equal(Utility.Name.MakeFast, Name.MakeFast);
    Assert.equal(Utility.Name.Dictionary, Direct.Dictionary);
    Assert.equal(Utility.Name.DictionaryFast, Direct.DictionaryFast);
    Assert.ok(!("make" in Direct));
});

test("defaults independently sample three dictionary words separated by hyphens", (context: TestContext) =>
{
    const Random = context.mock.method(Math, "random");
    Random.mock.mockImplementationOnce(() => 0, 0);
    Random.mock.mockImplementationOnce(() => 0.5, 1);
    Random.mock.mockImplementationOnce(() => 0.9999999999999999, 2);
    Assert.equal(Name.Make(), [ Name.Dictionary[0], Name.Dictionary[Math.floor(Name.Dictionary.length / 2)],
        Name.Dictionary[Name.Dictionary.length - 1] ].join("-"));
    Assert.equal(Random.mock.callCount(), 3);
});

test("custom dictionaries preserve spelling, allow repetition and remain unchanged", (context: TestContext) =>
{
    context.mock.method(Math, "random", () => 0.9999999999999999);
    const Dictionary: ReadonlyArray<string> = Object.freeze([ "Red Stone", "Ender" ]);
    for (const Make of [ Name.Make, Name.MakeFast ])
    {
        Assert.equal(Make({ Dictionary,
            NumWords: 4,
            Separator: "::" }), "Ender::Ender::Ender::Ender");
        Assert.deepEqual(Dictionary, [ "Red Stone", "Ender" ]);
        Assert.equal(Make({ Dictionary: [ "a" ],
            Separator: "" }), "aaa");
        Assert.equal(Make({ Dictionary: [ "a" ],
            NumWords: 1 }), "a");
        Assert.equal(Make({ Dictionary: [ "a" ] }), "a-a-a");
    }
});

test("zero words produce an empty name without sampling", (context: TestContext) =>
{
    const Random = context.mock.method(Math, "random");
    for (const Make of [ Name.Make, Name.MakeFast ])
    {
        Assert.equal(Make({ NumWords: 0 }), "");
        Assert.equal(Make({ Dictionary: [],
            NumWords: 0 }), "");
    }

    Assert.equal(Random.mock.callCount(), 0);
});

test("invalid word counts and empty dictionaries fail before sampling", (context: TestContext) =>
{
    const Random = context.mock.method(Math, "random");
    for (const Make of [ Name.Make, Name.MakeFast ])
    {
        for (const NumWords of [ -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1 ])
        {
            Assert.throws(() => Make({ NumWords }), RangeError);
        }

        Assert.throws(() => Make({ Dictionary: [] }), RangeError);
    }

    Assert.equal(Random.mock.callCount(), 0);
});

test("vanilla vocabulary is immutable, sorted, unique and contains each registry's words", () =>
{
    Assert.ok(Object.isFrozen(Name.Dictionary));
    Assert.equal(Name.Dictionary.length, 765);
    Assert.deepEqual(Name.Dictionary, [ ...new Set(Name.Dictionary) ].sort());
    Assert.ok(Name.Dictionary.every((word: string): boolean => /^[a-z]+$/u.test(word)));
    for (const Word of [ "cobblestone", "pickaxe", "creeper", "blindness", "mending", "overworld" ])
    {
        Assert.ok(Name.Dictionary.includes(Word), Word);
    }

    Assert.ok(!Name.Dictionary.includes("undefined"));
    Assert.equal(Reflect.set(Name.Dictionary, "0", "changed"), false);
});

test("fast vocabulary is a frozen, sorted subset centered on recognizable Minecraft terms", () =>
{
    Assert.equal(Name.DictionaryFast.length, 256);
    Assert.ok(Object.isFrozen(Name.DictionaryFast));
    Assert.deepEqual(Name.DictionaryFast, [ ...new Set(Name.DictionaryFast) ].sort());
    Assert.ok(Name.DictionaryFast.every((word: string): boolean => Name.Dictionary.includes(word)));
    for (const Word of [ "creeper", "elytra", "redstone", "netherite", "pickaxe", "mending", "overworld" ])
    {
        Assert.ok(Name.DictionaryFast.includes(Word), Word);
    }

    for (const Word of [ "area", "normal", "constructor", "indented", "bordure" ])
    {
        Assert.ok(!Name.DictionaryFast.includes(Word), Word);
    }

    Assert.equal(Reflect.set(Name.DictionaryFast, "0", "changed"), false);
});

test("MakeFast independently samples its smaller default vocabulary", (context: TestContext) =>
{
    const Random = context.mock.method(Math, "random");
    Random.mock.mockImplementationOnce(() => 0, 0);
    Random.mock.mockImplementationOnce(() => 0.5, 1);
    Random.mock.mockImplementationOnce(() => 0.9999999999999999, 2);
    Assert.equal(Name.MakeFast(), [ Name.DictionaryFast[0], Name.DictionaryFast[128],
        Name.DictionaryFast[255] ].join("-"));
    Assert.equal(Random.mock.callCount(), 3);
});

test("fast-only bundles discard the full vocabulary and have a smaller footprint", async () =>
{
    const Outputs: Array<string> = [];
    for (const Constructor of [ "Make", "MakeFast" ])
    {
        const Result = await build({
            bundle: true,
            format: "esm",
            minify: true,
            platform: "neutral",
            stdin: { contents: `export { ${Constructor} } from "bedform/Utility/Name";`,
                resolveDir: process.cwd() },
            treeShaking: true,
            write: false
        });
        Outputs.push(Result.outputFiles[0].text);
    }

    Assert.ok(Outputs[0].includes("\"absorption\""));
    Assert.ok(!Outputs[1].includes("\"absorption\""));
    Assert.ok(Outputs[1].length < Outputs[0].length * 0.6);
});
