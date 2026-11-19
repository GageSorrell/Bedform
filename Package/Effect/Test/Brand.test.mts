/**
 * Differential, declaration and packed-consumer checks for the complete Brand module.
 *
 * @module @bedform/effect/Test/Brand.test
 *
 * @file      Brand.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain contextual inference and pair upstream and local implementations. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as B from "@bedform/effect/Brand";
import * as Root from "@bedform/effect";
import * as S from "@bedform/effect/Schema";
import * as I from "@bedform/effect/SchemaIssue";
import * as U from "effect/Brand";
import * as US from "effect/Schema";
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

type Positive = B.Branded<number, "Positive">;
type Integer = B.Branded<number, "Integer">;

test("Brand exposes the complete pinned runtime API and declaration signatures", () =>
{
    Assert.deepEqual(Object.keys(B).sort(), Object.keys(U).sort());
    Assert.strictEqual(Root.Brand, B);
    const printer = TypeScript.createPrinter({ removeComments: true });
    const normalize = (specifier: string): string =>
    {
        const location = new URL(import.meta.resolve(specifier).replace(/\.js$/, ".d.ts"));
        // A const assertion emits the same private literal type with a colon rather than an initializer.
        const text = readFileSync(location, "utf8").replaceAll(".ts\"", ".js\"" )
            .replace("declare const TypeId =", "declare const TypeId:");
        const source = TypeScript.createSourceFile(location.pathname, text, TypeScript.ScriptTarget.Latest, true);
        const transformed = TypeScript.transform(source, [ (context) =>
        {
            const visit = (node: TypeScript.Node): TypeScript.VisitResult<TypeScript.Node> | undefined =>
            {
                if (TypeScript.getJSDocTags(node).some((tag) => tag.tagName.text === "internal"))
                {
                    return undefined;
                }

                return TypeScript.visitEachChild(node, visit, context);
            };

            return (file) => TypeScript.visitNode(file, visit) as TypeScript.SourceFile;
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

    Assert.equal(normalize("@bedform/effect/Brand"), normalize("effect/Brand"));
});

test("nominal constructors preserve identity and all nonthrowing forms", () =>
{
    for (const module of [ B, U ])
    {
        const ctor = module.nominal<Positive>();
        for (const value of [ 0, -1, 1, NaN, Infinity ])
        {
            Assert.ok(Object.is(ctor(value), value));
            const option = ctor.option(value);
            const result = ctor.result(value);
            Assert.equal(option._tag, "Some");
            Assert.equal(result._tag, "Success");
            if (option._tag === "Some")
            {
                Assert.ok(Object.is(option.value, value));
            }

            if (result._tag === "Success")
            {
                Assert.ok(Object.is(result.success, value));
            }

            Assert.equal(ctor.is(value), true);
        }

        const object = { name: "A" };
        Assert.strictEqual(module.nominal<B.Branded<typeof object, "Entity">>()(object), object);
        Assert.equal("checks" in ctor, false);
    }
});

test("refinement constructors match errors, options, guards and unusual numbers", () =>
{
    const local = B.make<Positive>((value) => value > 0 || "must be positive");
    const upstream = U.make<Positive>((value) => value > 0 || "must be positive");
    for (const value of [ -Infinity, -2, -0, 0, 0.25, 1, NaN, Infinity ])
    {
        const actual = local.result(value);
        const expected = upstream.result(value);
        Assert.equal(actual._tag, expected._tag);
        Assert.equal(local.option(value)._tag, upstream.option(value)._tag);
        Assert.equal(local.is(value), upstream.is(value));
        if (actual._tag === "Failure" && expected._tag === "Failure")
        {
            Assert.equal(actual.failure.message, expected.failure.message);
            Assert.equal(actual.failure.toString(), expected.failure.toString());
            Assert.throws(() => local(value), B.BrandError);
        }
        else {Assert.ok(Object.is(local(value), upstream(value)));}
    }

    const issue = new I.InvalidValue({ message: "invalid" });
    const error = new B.BrandError(issue);
    Assert.strictEqual(error.issue, issue);
    Assert.equal(error._tag, "BrandError");
    Assert.equal(error.name, "BrandError");
    Assert.equal(error instanceof Error, false);
    Assert.equal(error.message, "invalid");
    Assert.equal(error.toString(), "BrandError(invalid)");
});

test("schema checks and composed brands preserve collected checks and ordering", () =>
{
    const local = B.all(B.make<Positive>((value) => value > 0 || "positive"), B.check<Integer>(S.isInt()));
    const upstream = U.all(U.make<Positive>((value) => value > 0 || "positive"), U.check<Integer>(US.isInt()));
    for (const value of [ -2, -1.5, 0, 1, 1.5, Infinity, NaN ])
    {
        const actual = local.result(value);
        const expected = upstream.result(value);
        Assert.equal(actual._tag, expected._tag);
        if (actual._tag === "Failure" && expected._tag === "Failure")
        {
            Assert.equal(actual.failure.message, expected.failure.message);
        }
    }

    const nominal = B.all(B.nominal<Positive>(), B.nominal<Integer>());
    Assert.equal(nominal(-1.5), -1.5);
    Assert.equal(nominal.checks, undefined);
    const checked = B.check<Positive>(S.isGreaterThan(0));
    Assert.strictEqual(B.all(checked, B.nominal<Integer>()).checks?.[0], checked.checks?.[0]);
    const calls: Array<string> = [];
    const sequence = B.all(B.make<Positive>(() =>
    {
        calls.push("first");
        return "failure";
    }), B.make<Integer>(() =>
    {
        calls.push("second");
        return false;
    }));
    sequence.result(0);
    Assert.deepEqual(calls, [ "first", "second" ]);
});

test("unexpected predicate defects propagate through every constructor adapter", () =>
{
    const defect = new Error("predicate defect");
    const ctor = B.make<Positive>(() =>
    {
        throw defect;
    });
    for (const run of [ ctor, ctor.result, ctor.option, ctor.is ])
    {
        Assert.throws(() => run(1), (error) => error === defect);
    }
});

test("Schema.fromBrand and public/private nominal types interoperate", () =>
{
    const ctor = B.all(B.make<Positive>((value) => value > 0 || "positive"), B.check<Integer>(S.isInt()));
    const schema = S.Number.pipe(S.fromBrand("Positive", B.make<Positive>((value) => value > 0 || "positive")));
    Assert.equal(S.decodeUnknownSync(schema)(1), ctor(1));
    Assert.equal(S.encodeSync(schema)(ctor(1)), 1);
    Assert.equal(S.decodeUnknownResult(schema)(-1)._tag, "Failure");
    Assert.equal(S.decodeUnknownSync(S.Number.pipe(S.fromBrand("Integer", B.nominal<Integer>())))(1.5), 1.5);
});

test("packed Brand consumers resolve types and execute without Web globals", async () =>
{
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-brand-"));
    try
    {
        const npm = process.env.npm_execpath;
        Assert.ok(npm, "Run through npm run test:brand");
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ], { cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8" }));
        const packed = (Array.isArray(packing) ? packing : Object.values(packing))[0];
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "brand-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename) ], { cwd: temporary,
            encoding: "utf8" });
        writeFileSync(join(temporary, "consumer.ts"), `
            import { Brand as Root, Schema } from "@bedform/effect";
            import * as Brand from "@bedform/effect/Brand";
            type Id = Brand.Branded<number, "Id">;
            const Id = Root.make<Id>(value => value > 0 || "positive");
            const id: Id = Schema.decodeUnknownSync(Schema.Number.pipe(Schema.fromBrand("Id", Id)))(1);
            const plain: Brand.Brand.Unbranded<Id> = id;
            // @ts-expect-error Nominal values require a constructor.
            const invalid: Id = 1;
            // @ts-expect-error Private paths remain blocked.
            import * as Private from "@bedform/effect/Distribution/Internal/brand.js";
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
            stdin: { contents: "import { Brand as B } from \"@bedform/effect\"; const Positive = B.make(n => n > 0 || \"positive\"); globalThis.brandProof = [Positive(1), Positive.result(-1).failure.message];",
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
            brandProof: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox, { timeout: 5000 });
        Assert.equal((sandbox.brandProof as unknown as Array<unknown>)[0], 1);
        Assert.ok(String((sandbox.brandProof as unknown as Array<unknown>)[1]).includes("positive"));
        Assert.ok(Object.values(bundle.metafile!.outputs).every((output) => output.imports.length === 0));
        Assert.ok(Object.keys(bundle.metafile!.inputs).every((input) => input === "<stdin>" || input.replaceAll("\\", "/").includes("node_modules/@bedform/effect/Distribution/")));
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});
