/**
 * Public protocol packaging, declarations and restricted-host integration.
 *
 * @module @bedform/effect/Test/Protocols.test
 *
 * @file      Protocols.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT AND BSD-3-Clause
 */

/* Consumer fixtures retain callback inference and deliberate property order. */
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
import * as Root from "@bedform/effect";
import { protocolProof } from "./Protocols.fixture.mjs";

const Names = [ "Equal", "Hash", "Equivalence", "Order", "Ordering", "Pipeable", "Inspectable", "Formatter" ] as const;
const Json = { _id: "Sample",
    value: 3 };
const Text = JSON.stringify(Json);
const Expected = [ true, false, true, 2, "found", true, -1, 1, 6, true, 3, Text, Text, Json, Json, Text ];

test("public root namespaces share each direct protocol module", async () =>
{
    for (const Name of Names)
    {
        Assert.strictEqual(Root[Name], await import(`@bedform/effect/${Name}`));
    }
});

test("custom public protocols integrate with collections, ordering and inspection", () =>
{
    Assert.deepEqual(protocolProof(), Expected);
});

test("packed protocols support modern and legacy declarations and a restricted host", async () =>
{
    const Temporary = mkdtempSync(join(tmpdir(), "bedform-effect-protocols-"));
    try
    {
        const Npm = process.env.npm_execpath;
        Assert.ok(Npm, "Run through npm run test:protocols");
        const Packing = JSON.parse(execFileSync(process.execPath, [ Npm, "pack", "--json", "--ignore-scripts", "--pack-destination", Temporary ], {
            cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8"
        }));
        const Packed = (Array.isArray(Packing) ? Packing : Object.values(Packing))[0];
        writeFileSync(join(Temporary, "package.json"), JSON.stringify({ name: "protocol-consumer",
            private: true,
            type: "module" }));
        execFileSync(process.execPath, [ Npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(Temporary, Packed.filename) ], { cwd: Temporary,
            encoding: "utf8" });
        const Manifest = JSON.parse(readFileSync(join(Temporary, "node_modules/@bedform/effect/package.json"), "utf8"));
        Assert.equal(Manifest.version, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);
        Assert.equal(Manifest.dependencies, undefined);
        for (const Name of Names)
        {
            Assert.deepEqual(Manifest.exports[`./${Name}`], { types: `./Distribution/${Name}.d.ts`,
                import: `./Distribution/${Name}.js` });
            Assert.deepEqual(Manifest.typesVersions["*"][Name], [ `Distribution/${Name}.d.ts` ]);
        }

        for (const Name of [ "Protocols.fixture.mts", "Protocols.types.mts" ])
        {
            writeFileSync(join(Temporary, Name), readFileSync(new URL(Name, import.meta.url), "utf8"));
        }

        for (const Resolution of [ "NodeNext", "Node10" ])
        {
            writeFileSync(join(Temporary, "tsconfig.json"), JSON.stringify({ compilerOptions: {
                strict: true,
                noEmit: true,
                target: "ES2022",
                module: Resolution === "NodeNext" ? "NodeNext" : "ESNext",
                moduleResolution: Resolution,
                ignoreDeprecations: "6.0",
                types: [],
                lib: [ "ES2022" ]
            },
            files: [ "Protocols.fixture.mts", "Protocols.types.mts" ] }));
            execFileSync(process.execPath, [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", join(Temporary, "tsconfig.json") ], { cwd: Temporary,
                encoding: "utf8" });
        }

        const Runtime = `import * as Root from "@bedform/effect";
            for (const name of ${JSON.stringify(Names)}) {
                if (Root[name] !== await import("@bedform/effect/" + name)) throw new Error(name);
            }
            try { await import("@bedform/effect/Distribution/Hash.js"); throw new Error("private path accepted"); }
            catch (error) { if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }`;
        execFileSync(process.execPath, [ "--input-type=module", "-e", Runtime ], { cwd: Temporary,
            encoding: "utf8" });
        const Bundle = await build({
            stdin: { contents: "import { protocolProof } from \"./Protocols.fixture.mts\"; globalThis.proof = protocolProof();",
                resolveDir: Temporary },
            bundle: true,
            write: false,
            format: "iife",
            platform: "neutral",
            target: "es2022",
            metafile: true
        });
        const Sandbox = { process: undefined,
            Buffer: undefined,
            TextEncoder: undefined,
            TextDecoder: undefined,
            URL: undefined,
            URLSearchParams: undefined,
            fetch: undefined,
            console: undefined,
            setTimeout: undefined,
            proof: undefined };
        runInNewContext(Bundle.outputFiles[0].text, Sandbox, { timeout: 5000 });
        Assert.equal(JSON.stringify(Sandbox.proof), JSON.stringify(Expected));
        Assert.ok(Object.values(Bundle.metafile!.outputs).every((Output) => Output.imports.length === 0));
        Assert.ok(Object.keys(Bundle.metafile!.inputs).every((Input) => Input === "<stdin>" || Input.replaceAll("\\", "/").includes("node_modules/@bedform/effect/Distribution/") || Input.endsWith("Protocols.fixture.mts")));
    }
    finally
    {
        Assert.equal(dirname(Temporary), resolve(tmpdir()));
        rmSync(Temporary, { recursive: true,
            force: true });
    }
});
