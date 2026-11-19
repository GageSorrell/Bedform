/**
 * Isolated packed-consumer and restricted-host checks for the collection helpers.
 *
 * @module @bedform/effect/Test/CollectionsPackage.test
 *
 * @file      CollectionsPackage.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Tool fixtures preserve declaration inference and intentional object ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";

test("packed collection helpers resolve root/direct declarations and execute without Web globals", async () =>
{
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-collections-"));
    try
    {
        const npm = process.env.npm_execpath;
        Assert.ok(npm, "Run through npm run test:collections");
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ], { cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8" }));
        const packed = (Array.isArray(packing) ? packing : Object.values(packing))[0];
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "collection-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename) ], { cwd: temporary,
            encoding: "utf8" });
        const manifest = JSON.parse(readFileSync(join(temporary, "node_modules/@bedform/effect/package.json"), "utf8"));
        Assert.equal(manifest.dependencies, undefined);
        writeFileSync(join(temporary, "consumer.ts"), `
            import { Array as A, Record as R, Struct as S, Number as N, Tuple as T } from "@bedform/effect";
            import * as DirectArray from "@bedform/effect/Array";
            import * as DirectRecord from "@bedform/effect/Record";
            import * as DirectStruct from "@bedform/effect/Struct";
            import * as DirectNumber from "@bedform/effect/Number";
            import * as DirectTuple from "@bedform/effect/Tuple";
            const mapped: A.NonEmptyArray<string> = DirectArray.map(A.make(1, 2), value => String(value));
            const record: Record<"a", string> = DirectRecord.map(R.singleton("a", 1), value => String(value));
            const struct: { a: number } = DirectStruct.pick({ a: 1, b: "B" }, ["a"]);
            const number: number = DirectNumber.sum(N.sum(1, 2), 3);
            const tuple: [number, string] = DirectTuple.make(T.get([1, "A"] as const, 0), "B");
            // @ts-expect-error Nonempty access requires a nonempty array.
            A.headNonEmpty([] as Array<number>);
            // @ts-expect-error Arithmetic preserves numeric inputs.
            N.sum("1", 2);
            // @ts-expect-error Private paths remain blocked.
            import * as Private from "@bedform/effect/Distribution/Internal/array.js";
        `);
        // Reuse every Number declaration fixture against the installed package.
        writeFileSync(join(temporary, "number.mts"), readFileSync(new URL("Number.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true,
            noEmit: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            types: [],
            lib: [ "ES2022" ] },
        files: [ "consumer.ts", "number.mts" ] }));
        execFileSync(process.execPath, [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", join(temporary, "tsconfig.json") ], { cwd: temporary,
            encoding: "utf8" });
        const bundle = await build({
            stdin: { contents: `import { Array as A, Record as R, Struct as S, Number as N, Tuple as T } from "@bedform/effect";
                const values = A.map(A.make(1, 2), value => N.sum(value, 1));
                const record = R.map({ a: values[0] }, value => String(value));
                const struct = S.pick({ record, extra: true }, ["record"]);
                globalThis.collectionProof = [values.join(","), struct.record.a, T.get(T.make("A", "B"), 1), N.hypot(3, 4), N.positiveModulo(-1, 3), N.sin()(Math.PI / 2)];`,
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
            collectionProof: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox, { timeout: 5000 });
        Assert.equal(JSON.stringify(sandbox.collectionProof), "[\"2,3\",\"2\",\"B\",5,2,1]");
        Assert.ok(Object.values(bundle.metafile!.outputs).every((output) => output.imports.length === 0));
        Assert.ok(Object.keys(bundle.metafile!.inputs).every((input) => input === "<stdin>" || input.replaceAll("\\", "/").includes("node_modules/@bedform/effect/Distribution/")));
        const runtime = `import * as Root from "@bedform/effect";
            for (const name of ["Array", "Record", "Struct", "Number", "Tuple"]) { const direct = await import("@bedform/effect/" + name); if(Root[name] !== direct) throw new Error("namespace " + name); }
            try { await import("@bedform/effect/Distribution/Internal/array.js"); throw new Error("private path accepted"); } catch(error) { if(error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }`;
        execFileSync(process.execPath, [ "--input-type=module", "-e", runtime ], { cwd: temporary,
            encoding: "utf8" });
        const shaken = await build({ stdin: { contents: "import { identity } from \"@bedform/effect\"; globalThis.value = identity(1);",
            resolveDir: temporary },
        bundle: true,
        platform: "neutral",
        write: false,
        treeShaking: true });
        Assert.ok(shaken.outputFiles[0].text.length < 10000);
        Assert.ok(!shaken.outputFiles[0].text.includes("isCanonicalArrayIndex"));
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});
