/**
 * Isolated packed-consumer and restricted-host checks for the Predicate and String helpers.
 *
 * @module @bedform/effect/Test/PrimitivesPackage.test
 *
 * @file      PrimitivesPackage.test.mts
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

test("packed Predicate and String helpers resolve root/direct declarations and execute without Web globals", async () =>
{
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-primitives-"));
    try
    {
        const npm = process.env.npm_execpath;
        Assert.ok(npm, "Run through npm run test:collections");
        const packing = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", temporary ], { cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8" }));
        const packed = (Array.isArray(packing) ? packing : Object.values(packing))[0];
        writeFileSync(join(temporary, "package.json"), JSON.stringify({ name: "primitive-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename) ], { cwd: temporary,
            encoding: "utf8" });
        const manifest = JSON.parse(readFileSync(join(temporary, "node_modules/@bedform/effect/package.json"), "utf8"));
        Assert.equal(manifest.dependencies, undefined);
        writeFileSync(join(temporary, "consumer.mts"), readFileSync(new URL("Primitives.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true,
            noEmit: true,
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            types: [],
            lib: [ "ES2022" ] },
        files: [ "consumer.mts" ] }));
        execFileSync(process.execPath, [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", join(temporary, "tsconfig.json") ], { cwd: temporary,
            encoding: "utf8" });
        const bundle = await build({
            stdin: { contents: `import { Predicate as P, String as S, pipe } from "@bedform/effect";
                const guarded = [1, "hello"].filter(P.isString);
                globalThis.collectionProof = [pipe(guarded[0], S.toUpperCase, S.padStart(7, "0")), P.and(P.isNumber, value => value > 0)(1), Array.from(S.linesIterator("a\\r\\nb")), S.at("x", 1)._tag];`,
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
        Assert.equal(JSON.stringify(sandbox.collectionProof), "[\"00HELLO\",true,[\"a\",\"b\"],\"None\"]");
        Assert.ok(Object.values(bundle.metafile!.outputs).every((output) => output.imports.length === 0));
        Assert.ok(Object.keys(bundle.metafile!.inputs).every((input) => input === "<stdin>" || input.replaceAll("\\", "/").includes("node_modules/@bedform/effect/Distribution/")));
        const runtime = `import * as Root from "@bedform/effect";
            for (const name of ["Function", "Predicate", "String"]) { const direct = await import("@bedform/effect/" + name); if(Root[name] !== direct) throw new Error("namespace " + name); }
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
        Assert.ok(!shaken.outputFiles[0].text.includes("stripMarginWith"));
    }
    finally
    {
        Assert.equal(dirname(temporary), resolve(tmpdir()));
        rmSync(temporary, { recursive: true,
            force: true });
    }
});
