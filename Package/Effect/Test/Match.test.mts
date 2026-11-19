/**
 * Full Match API, matcher behavior and isolated consumer acceptance.
 *
 * @module @bedform/effect/Test/Match.test
 *
 * @file      Match.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pair implementations across their distinct inspection-symbol declarations. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as M from "@bedform/effect/Match";
import * as U from "effect/Match";
import * as Root from "@bedform/effect";
import Assert from "node:assert/strict";
import TypeScript from "typescript";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";

const Modules: ReadonlyArray<typeof M> = [ M, U as unknown as typeof M ];

test("Match has complete upstream exports, public declarations and private runtime implementation", () =>
{
    Assert.deepEqual(Object.keys(M).sort(), Object.keys(U).sort());
    Assert.strictEqual(Root.Match, M);
    const printer = TypeScript.createPrinter({ removeComments: true });
    const normalize = (specifier: string): string =>
    {
        const url = new URL(import.meta.resolve(specifier).replace(/\.js$/, ".d.ts"));
        const source = readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/")
            .replace("declare const TypeId = \"~effect/Match/Matcher\"", "declare const TypeId: \"~effect/Match/Matcher\"")
            .replace("export declare const TypeId = \"~effect/Match/Matcher\"", "export declare const TypeId: \"~effect/Match/Matcher\"");
        const file = TypeScript.createSourceFile(url.pathname, source, TypeScript.ScriptTarget.Latest, true);
        const extracted = new Map<string, TypeScript.TypeLiteralNode>();
        for (const node of file.statements)
        {
            if (TypeScript.isModuleDeclaration(node) && [ "TypeMatcher", "ValueMatcher" ].includes(node.name.text) && node.body && TypeScript.isModuleBlock(node.body))
            {
                for (const member of node.body.statements)
                {
                    if (TypeScript.isInterfaceDeclaration(member))
                    {
                        extracted.set(`${node.name.text}.${member.name.text}`, TypeScript.factory.createTypeLiteralNode(member.members));
                    }
                }
            }
        }

        const transformed = TypeScript.transform(file, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
            {
                if (TypeScript.isModuleDeclaration(node) && [ "TypeMatcher", "ValueMatcher" ].includes(node.name.text))
                {
                    return undefined;
                }

                if (TypeScript.isTypeReferenceNode(node))
                {
                    const replacement = extracted.get(node.typeName.getText(file));
                    if (replacement)
                    {
                        return replacement;
                    }
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (root) => TypeScript.visitNode(root, visit) as TypeScript.SourceFile;
        } ]);
        try
        {
            return printer.printFile(transformed.transformed[0]);

        }
        finally
        {
            transformed.dispose();

        }
    };

    Assert.equal(normalize("@bedform/effect/Match"), normalize("effect/Match"));
    // Upstream strips private declarations; compare the full typed source and emitted implementation.
    const privateSource = (url: URL): string => readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
        .replaceAll("/Internal/", "/internal/")
        .replaceAll("/Encoding/", "/encoding/")
        .replaceAll("/Schema/", "/schema/")
        .replaceAll("GetExhaustiveAbsurdErrorMessage", "getExhaustiveAbsurdErrorMessage")
        .replace("\"~effect/Match/Matcher\" as const", "\"~effect/Match/Matcher\"");
    const local = new URL("../Source/Internal/matcher.ts", import.meta.url);
    const upstream = new URL("../src/internal/matcher.ts", import.meta.resolve("effect/Match"));
    const typedSource = (url: URL): string => printer.printFile(TypeScript.createSourceFile("matcher.ts", privateSource(url), TypeScript.ScriptTarget.Latest, true));
    Assert.equal(typedSource(local), typedSource(upstream));
    const runtime = (url: URL): string =>
    {
        const source = readFileSync(url, "utf8").replaceAll(".ts\"", ".js\"")
            .replaceAll("/Internal/", "/internal/")
            .replaceAll("/Encoding/", "/encoding/")
            .replaceAll("/Schema/", "/schema/")
            .replaceAll("GetExhaustiveAbsurdErrorMessage", "getExhaustiveAbsurdErrorMessage");
        const emitted = TypeScript.transpileModule(source, { compilerOptions: { target: TypeScript.ScriptTarget.ES2022,
            module: TypeScript.ModuleKind.ESNext,
            removeComments: true } }).outputText;
        return printer.printFile(TypeScript.createSourceFile("matcher.js", emitted, TypeScript.ScriptTarget.Latest, true));
    };

    Assert.equal(runtime(local), runtime(upstream));
});

test("reusable and immediate matchers preserve ordering, laziness and immutable case branches", () =>
{
    for (const match of Modules)
    {
        const calls: Array<string> = [];
        const base = match.type<string | number>();
        const branch = base.pipe(match.when(match.string, (value) =>
        {
            calls.push("string");
            return value.length;

        }));
        const finish = branch.pipe(match.when(match.number, (value) =>
        {
            calls.push("number");
            return value * 2;

        }), match.exhaustive);
        Assert.deepEqual(calls, []);
        Assert.equal(finish("abc"), 3);
        Assert.equal(finish(2), 4);
        Assert.deepEqual(calls, [ "string", "number" ]);
        Assert.equal(base._tag === "TypeMatcher" ? base.cases.length : -1, 0);
        Assert.equal(branch._tag === "TypeMatcher" ? branch.cases.length : -1, 1);
        const immediate = match.value("abc" as string | number).pipe(match.when(match.string, (value) => value.length));
        Assert.equal(immediate.pipe(match.orElse(() => -1)), 3);
        const skipped = immediate.pipe(match.when(match.number, () =>
        {
            throw new Error("must skip");

        }));
        Assert.strictEqual(immediate, skipped);
        Assert.equal(match.type<number>().pipe(match.when(match.number, () => "first"), match.orElse(() => "fallback"))(1), "first");
    }
});

test("recursive object and prefix-array patterns preserve symbols, inherited keys and strict literals", () =>
{
    const key = Symbol("key");
    const fixtures: ReadonlyArray<readonly [unknown, unknown]> = [
        [ { nested: { value: M.number } }, { nested: { value: 1,
            extra: 2 } } ],
        [ { missing: undefined }, {} ], [ { missing: undefined }, { missing: undefined } ],
        [ { x: 1 }, Object.create({ x: 1 }) ], [ { [key]: 1 }, { [key]: 1 } ],
        [ [ 1 ], [ 1, 2 ] ], [ [ 1, 2 ], [ 1 ] ], [ [], [] ], [ [], {} ], [ NaN, NaN ], [ -0, 0 ],
        [ null, null ], [ undefined, undefined ], [ "1", 1 ], [ { x: 1 }, null ]
    ];
    for (const [ pattern, input ] of fixtures)
    {
        const actual = M.value(input).pipe(M.when(pattern as never, () => true), M.orElse(() => false));
        const expected = U.value(input).pipe(U.when(pattern as never, () => true), U.orElse(() => false));
        Assert.equal(actual, expected);
    }
});

test("logical and negated patterns short circuit in upstream order", () =>
{
    for (const match of Modules)
    {
        const or = match.type<string | number | boolean>().pipe(match.whenOr(match.string, match.number, () => "value"), match.orElse(() => "boolean"));
        Assert.deepEqual([ or("x"), or(2), or(false) ], [ "value", "value", "boolean" ]);
        const and = match.type<number>().pipe(match.whenAnd((value) => value > 0, (value) => Number.isInteger(value), () => true), match.orElse(() => false));
        Assert.deepEqual([ and(2), and(-1), and(1.5) ], [ true, false, false ]);
        const not = match.type<string | number>().pipe(match.not(match.string, (value) => value * 2), match.orElse((value) => value.length));
        Assert.equal(not(2), 4);
        Assert.equal(not("abc"), 3);
        const calls: Array<number> = [];
        match.value(1).pipe(match.whenOr(() =>
        {
            calls.push(1);
            return true;

        }, () =>
        {
            calls.push(2);
            return false;

        }, () => 1), match.orElse(() => 0));
        Assert.deepEqual(calls, [ 1 ]);
    }
});

test("tag and custom-discriminator combinators retain handlers, prefixes and exhaustive dispatch", () =>
{
    type Event = { readonly _tag: "Start";
        readonly value: number } | { readonly _tag: "Stop";
            readonly reason: string };
    for (const match of Modules)
    {
        const handlers = { Start: (value: Extract<Event, { _tag: "Start" }>) => value.value,
            Stop: (value: Extract<Event, { _tag: "Stop" }>) => value.reason.length };
        const events: Array<Event> = [ { _tag: "Start",
            value: 3 }, { _tag: "Stop",
            reason: "done" } ];
        const exhaustive = match.type<Event>().pipe(match.tagsExhaustive(handlers));
        const byTag = match.type<Event>().pipe(match.tag("Start", (value) => value.value), match.tag("Stop", (value) => value.reason.length), match.exhaustive);
        const byTags = match.type<Event>().pipe(match.tags(handlers), match.exhaustive);
        const typeTags = match.typeTags<Event>()(handlers);
        for (const event of events)
        {
            Assert.equal(exhaustive(event), byTag(event));
            Assert.equal(byTags(event), byTag(event));
            Assert.equal(typeTags(event), byTag(event));
            Assert.equal(match.valueTags(event, handlers), byTag(event));
            Assert.equal(match.valueTags<Event, typeof handlers>(handlers)(event), byTag(event));
        }

        const custom = match.type<{ kind: "A" } | { kind: "B" }>().pipe(match.discriminatorsExhaustive("kind")({ A: () => 1,
            B: () => 2 }));
        Assert.equal(custom({ kind: "B" }), 2);
        const prefixes = match.type<{ _tag: "machine:start" } | { _tag: "player:join" }>().pipe(match.tagStartsWith("machine:", () => "machine"), match.orElse(() => "player"));
        Assert.equal(prefixes({ _tag: "machine:start" }), "machine");
        Assert.equal(prefixes({ _tag: "player:join" }), "player");
        const multiple = match.type<Event>().pipe(match.tag("Start", "Stop", (value) => value._tag), match.exhaustive);
        Assert.equal(multiple(events[0]), "Start");
        const inheritedHandlers = Object.create({ Start: () => "inherited" });
        const safe = match.type<Event>().pipe(match.tags(inheritedHandlers), match.orElse(() => "fallback"));
        Assert.equal(safe(events[0]), "fallback");
    }
});

test("fn selectors forward original arguments once to matched handlers and fallbacks", () =>
{
    for (const match of Modules)
    {
        let selected = 0;
        const matcher = match.fn((prefix: string, value: "a" | "b") =>
        {
            selected++;
            return value;

        }).pipe(
            match.when("a", (value, prefix, original) => `${prefix}:${value}:${original}`),
            match.orElse((value, prefix, original) => `${prefix}:fallback:${value}:${original}`)
        );
        Assert.equal(matcher("X", "a"), "X:a:a");
        Assert.equal(matcher("X", "b"), "X:fallback:b:b");
        Assert.equal(selected, 2);
        const result = match.fn((value: number, offset: number) => value + offset).pipe(match.when(match.number, (value, original, offset) => value + original + offset), match.result);
        const output = result(2, 3);
        Assert.equal(output._tag, "Success");
        if (output._tag === "Success")
        {
            Assert.equal(output.success, 10);
        }
    }
});

test("all finalizers preserve unmatched input and expected errors; defects propagate", () =>
{
    for (const match of Modules)
    {
        const base = match.type<string | number>().pipe(match.when(match.string, (value) => value.length));
        const failure = base.pipe(match.result)(2);
        const success = base.pipe(match.result)("abc");
        Assert.equal(failure._tag, "Failure");
        if (failure._tag === "Failure")
        {
            Assert.equal(failure.failure, 2);
        }

        Assert.equal(success._tag, "Success");
        if (success._tag === "Success")
        {
            Assert.equal(success.success, 3);
        }

        Assert.equal(base.pipe(match.option)(2)._tag, "None");
        const some = base.pipe(match.option)("abc");
        Assert.equal(some._tag, "Some");
        if (some._tag === "Some")
        {
            Assert.equal(some.value, 3);
        }

        Assert.throws(() => base.pipe(match.orElseAbsurd)(2), /effect\/Match\/orElseAbsurd: absurd/);
        const invalid = match.exhaustive(base as never) as (input: unknown) => unknown;
        Assert.throws(() => invalid(2), /effect\/match\/Match\/exhaustive: absurd/);
        Assert.equal(match.value(1).pipe(match.when(1, () => "one"), match.exhaustive), "one");
        Assert.equal(match.value(2 as number).pipe(match.when(1, () => "one"), match.result)._tag, "Failure");
        const defect = new Error("matcher defect");
        Assert.throws(() => match.value(1).pipe(match.when(() =>
        {
            throw defect;

        }, () => 0)), (error) => error === defect);
        Assert.throws(() => match.type<number>().pipe(match.when(match.number, () =>
        {
            throw defect;

        }), match.orElse(() => 0))(1), (error) => error === defect);
    }
});

test("primitive, instance and defined guards match the pinned implementation", () =>
{
    const values = [ undefined, null, "", "x", 0, NaN, true, 1n, Symbol("s"), {}, [], new Date(0), /x/ ];
    for (const name of [ "string", "nonEmptyString", "number", "boolean", "bigint", "symbol", "date", "record", "defined", "any", "null", "undefined" ] as const)
    {
        for (const value of values)
        {
            Assert.equal(
                M.value(value).pipe(M.when(M[name], () => true), M.orElse(() => false)),
                U.value(value).pipe(U.when(U[name], () => true), U.orElse(() => false))
            );
        }
    }

    class Example {}
    for (const value of [ new Example(), {}, null ])
    {
        Assert.equal(
            M.value(value).pipe(M.when(M.instanceOf(Example), () => true), M.orElse(() => false)),
            U.value(value).pipe(U.when(U.instanceOf(Example), () => true), U.orElse(() => false))
        );
    }

    Assert.equal(M.value(new Example()).pipe(M.when(M.instanceOfUnsafe(Example), () => true), M.orElse(() => false)), true);
    Assert.equal(M.value("b" as string).pipe(M.when(M.is("a", "b"), () => true), M.orElse(() => false)), true);
    Assert.equal(M.value("c" as string).pipe(M.when(M.is("a", "b"), () => true), M.orElse(() => false)), false);
});

test("packed Match consumers preserve declarations, private boundaries and restricted-host behavior", async () =>
{
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-match-"));
    try
    {
        const npm = process.env.npm_execpath;
        Assert.ok(npm, "Run through npm run test:match");
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ], { cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8" }));
        const packed = (Array.isArray(packing) ? packing : Object.values(packing))[0];
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "match-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename) ], { cwd: temporary,
            encoding: "utf8" });
        const manifest = JSON.parse(readFileSync(join(temporary, "node_modules/@bedform/effect/package.json"), "utf8"));
        Assert.equal(manifest.dependencies, undefined);
        writeFileSync(join(temporary, "consumer.ts"), `
            import { Match as Root } from "@bedform/effect";
            import * as M from "@bedform/effect/Match";
            type Event = { _tag: "A"; value: number } | { _tag: "B"; reason: string };
            const run: (event: Event) => string = M.type<Event>().pipe(M.tagsExhaustive({ A: event => String(event.value), B: event => event.reason }));
            const result: number = Root.value(1 as string | number).pipe(M.when(M.number, value => value * 2), M.when(M.string, value => value.length), M.exhaustive);
            const partial = M.type<Event>().pipe(M.tag("A", event => event.value));
            // @ts-expect-error Missing case cannot be finalized exhaustively.
            partial.pipe(M.exhaustive);
            // @ts-expect-error Unknown event tags are rejected.
            M.type<Event>().pipe(M.tag("Other", () => 1));
            // @ts-expect-error Private implementation paths are blocked.
            import * as Private from "@bedform/effect/Distribution/Internal/matcher.js";
        `);
        writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true,
            noEmit: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            types: [] },
        files: [ "consumer.ts" ] }));
        execFileSync(process.execPath, [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", join(temporary, "tsconfig.json") ], { cwd: temporary,
            encoding: "utf8" });
        const bundle = await build({
            stdin: { contents: "import { Match as M } from \"@bedform/effect\"; const run = M.fn((prefix, value) => value).pipe(M.when(M.string, (value, prefix) => prefix + value), M.orElse(() => \"fallback\")); globalThis.matchProof = run(\"prefix:\", \"value\");",
                resolveDir: temporary },
            bundle: true,
            format: "iife",
            platform: "neutral",
            write: false,
            metafile: true,
            target: "es2022"
        });
        const sandbox = { TextEncoder: undefined,
            TextDecoder: undefined,
            URL: undefined,
            URLSearchParams: undefined,
            Buffer: undefined,
            process: undefined,
            matchProof: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox, { timeout: 5000 });
        Assert.equal(sandbox.matchProof, "prefix:value");
        Assert.ok(Object.values(bundle.metafile!.outputs).every((output) => output.imports.length === 0));
        Assert.ok(Object.keys(bundle.metafile!.inputs).every((input) => input === "<stdin>" || input.replaceAll("\\", "/").includes("node_modules/@bedform/effect/Distribution/")));
        const runtime = "import { Match as Root } from \"@bedform/effect\"; import * as M from \"@bedform/effect/Match\"; if(Root !== M) throw new Error(\"namespace\"); try { await import(\"@bedform/effect/Distribution/Internal/matcher.js\"); throw new Error(\"private path accepted\"); } catch(error) { if(error.code !== \"ERR_PACKAGE_PATH_NOT_EXPORTED\") throw error; }";
        execFileSync(process.execPath, [ "--input-type=module", "-e", runtime ], { cwd: temporary,
            encoding: "utf8" });
        const shaken = await build({ stdin: { contents: "import { identity } from \"@bedform/effect\"; globalThis.value = identity(1);",
            resolveDir: temporary },
        bundle: true,
        platform: "neutral",
        write: false,
        treeShaking: true });
        Assert.ok(!shaken.outputFiles[0].text.includes("Match/exhaustive"));
        Assert.ok(shaken.outputFiles[0].text.length < 10000);
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});
