/**
 * Packed-consumer and restricted-host acceptance for Schema.
 *
 * @module @bedform/effect/Test/SchemaPackage.test
 *
 * @file      SchemaPackage.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Keep differential imports grouped by implementation and compact test branches. */
/* eslint-disable sort-imports */

import Assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

/* Tool callbacks retain contextual inference and fixture property order. */
/* eslint-disable @typescript-eslint/typedef, sort-keys, @stylistic/max-len */

const PackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Schema bundle executes in a host without Web globals or runtime dependencies", async () =>
{
    const output = await build({
        stdin: { contents: `
            import { Schema as S, Result as R, SchemaGetter as G } from "@bedform/effect";
            const schema = S.Struct({ name: S.String, age: S.NumberFromString.pipe(S.withDecodingDefaultKey(() => R.succeed("7"))) });
            const value = S.decodeUnknownSync(schema)({ name: "A" });
            if (value.age !== 7) throw new Error("decode");
            const standard = S.toStandardJSONSchemaV1(S.toStandardSchemaV1(schema));
            standard["~standard"].jsonSchema.input({ target: "draft-07" });
            standard["~standard"].jsonSchema.output({ target: "draft-2020-12" });
            const recursive = S.suspend(() => S.Struct({ children: S.Array(recursive) })).annotate({ identifier: "Node/~x" });
            S.toStandardJSONSchemaV1(recursive)["~standard"].jsonSchema.input({ target: "draft-07" });
            S.decodeUnknownSync(S.Uint8ArrayFromBase64)("aGVsbG8=");
            if ("makeEffect" in schema || "transformEffect" in G) throw new Error("excluded API");
            globalThis.schemaProof = value;
        `,
        resolveDir: PackageRoot,
        sourcefile: "restricted-consumer.ts" },
        bundle: true,
        format: "iife",
        platform: "neutral",
        target: "es2022",
        write: false,
        metafile: true
    });
    const code = output.outputFiles[0].text;
    const sandbox = { TextEncoder: undefined,
        TextDecoder: undefined,
        URL: undefined,
        URLSearchParams: undefined,
        Buffer: undefined,
        process: undefined,
        require: undefined,
        schemaProof: undefined };
    runInNewContext(code, sandbox, { timeout: 5000 });
    Assert.equal((sandbox.schemaProof as unknown as { age: number }).age, 7);
    Assert.ok(Object.keys(output.metafile!.inputs).every((input) => input === "restricted-consumer.ts" || !input.includes("node_modules")));
    Assert.ok(Object.values(output.metafile!.outputs).every((output) => output.imports.length === 0));
});

test("packed consumers resolve root/direct declarations and reject private paths", async () =>
{
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-schema-"));
    try
    {
        const npm = process.env.npm_execpath;
        Assert.ok(npm, "Run package acceptance through npm run test:schema");
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ], { cwd: PackageRoot,
            encoding: "utf8" }));
        const packed = Array.isArray(packing) ? packing : Object.values(packing);
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "schema-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed[0].filename) ], { cwd: temporary,
            encoding: "utf8" });
        const manifest = JSON.parse(readFileSync(join(temporary, "node_modules/@bedform/effect/package.json"), "utf8"));
        Assert.equal(manifest.dependencies, undefined);
        Assert.ok(packed[0].files.some((file: { path: string }) => file.path === "License.md"));
        writeFileSync(join(temporary, "consumer.ts"), `
            import { Schema as Root } from "@bedform/effect";
            import * as S from "@bedform/effect/Schema";
            import * as G from "@bedform/effect/SchemaGetter";
            import * as R from "@bedform/effect/Result";
            const schema = S.Struct({ name: S.String, age: S.optionalKey(S.Number) });
            const value: { readonly name: string; readonly age?: number } = Root.decodeSync(schema)({ name: "A" });
            const result = G.transformResult((input: string) => R.succeed(Number(input)));
            class Person extends S.Class<Person>("Person")({ name: S.String }) {}
            const person: Person = S.decodeUnknownSync(Person)({ name: "A" });
            // @ts-expect-error Effect adapters are omitted.
            S.decodeUnknownEffect(S.String);
            // @ts-expect-error Runtime makers are omitted.
            schema.makeEffect({ name: "A" });
            // @ts-expect-error Private imports are blocked by package exports.
            import * as Private from "@bedform/effect/Distribution/Internal/Schema/parser.js";
            // @ts-expect-error Services are incompatible with synchronous codecs.
            const service: S.Constraint = { ast: S.String.ast, DecodingServices: "service" };
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
        const runtime = "import {Schema as Root} from \"@bedform/effect\"; import * as S from \"@bedform/effect/Schema\"; if(Root.String !== S.String || S.decodeUnknownSync(S.NumberFromString)(\"2\") !== 2) throw new Error(\"exports\"); try { await import(\"@bedform/effect/Distribution/Schema.js\"); throw new Error(\"private path accepted\"); } catch(error) { if(error.code !== \"ERR_PACKAGE_PATH_NOT_EXPORTED\") throw error; }";
        execFileSync(process.execPath, [ "--input-type=module", "-e", runtime ], { cwd: temporary,
            encoding: "utf8" });
        const shaken = await build({
            stdin: { contents: "import { identity } from \"@bedform/effect\"; globalThis.identityProof = identity(1);",
                resolveDir: temporary },
            bundle: true,
            format: "iife",
            platform: "neutral",
            write: false,
            treeShaking: true,
            metafile: true
        });
        Assert.ok(shaken.outputFiles[0].text.length < 10000, "Unused Schema namespaces must be removable from root imports");
        Assert.ok(!shaken.outputFiles[0].text.includes("SchemaError"));
        const schemaBundle = await build({
            stdin: { contents: "import * as S from \"@bedform/effect/Schema\"; globalThis.packedProof = S.decodeUnknownSync(S.NumberFromString)(\"2\");",
                resolveDir: temporary },
            bundle: true,
            format: "iife",
            platform: "neutral",
            write: false,
            treeShaking: true,
            metafile: true
        });
        const packedHost = { packedProof: undefined,
            TextEncoder: undefined,
            TextDecoder: undefined,
            URL: undefined,
            URLSearchParams: undefined };
        runInNewContext(schemaBundle.outputFiles[0].text, packedHost, { timeout: 5000 });
        Assert.equal(packedHost.packedProof, 2);
        Assert.ok(packed[0].files.every((file: { path: string }) => !file.path.startsWith("Source/") && !file.path.startsWith("Test/")));
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});

