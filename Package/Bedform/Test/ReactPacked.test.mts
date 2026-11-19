/**
 * Installs the actual React package archive and checks both compiled JSX modes in a restricted host.
 *
 * @module bedform/Test/ReactPacked.test
 *
 * @file      ReactPacked.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture props and observations retain behavioral order. */

/* eslint-disable sort-keys */

import { Capture, CreateRoot, FakeSystem, Install, Print, Restricted } from "./ReactHarness.mjs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { VerifyPackedComponents } from "./SpatialComponentsPacked.mjs";
import { VerifyPackedSpatial } from "./SpatialRuntimePacked.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { realpathSync } from "node:fs";
import { snapshotDependencies } from "./InstalledDependencies.mjs";
import test from "node:test";
import { tmpdir } from "node:os";
test("independently installed React consumers typecheck and execute both JSX modes", async () =>
{
    const directory = await mkdtemp(path.join(realpathSync.native(tmpdir()), "react-packed-"));
    try
    {
        const npm = process.env.npm_execpath;
        assert.ok(npm, "Run through npm to provide the package manager path.");
        await writeFile(
            path.join(directory, "package.json"),
            JSON.stringify({ private: true,
                type: "module" })
        );
        const output = JSON.parse(
            execFileSync(
                process.execPath,
                [
                    npm,
                    "pack",
                    "--json",
                    "--ignore-scripts",
                    "--pack-destination",
                    directory,
                    fileURLToPath(new URL("../", import.meta.url)),
                    fileURLToPath(new URL("../../Effect", import.meta.url))
                ],
                { cwd: directory,
                    encoding: "utf8" }
            )
        );
        const artifacts = Array.isArray(output) ? output : Object.values(output);
        const archives = artifacts.map((entry: { filename: string }) =>
            path.join(directory, entry.filename)
        );
        await snapshotDependencies(
            [
                fileURLToPath(new URL("../package.json", import.meta.url)),
                fileURLToPath(new URL("../../Effect/package.json", import.meta.url))
            ],
            directory,
            npm
        );
        execFileSync(
            process.execPath,
            [
                npm,
                "install",
                "--offline",
                "--legacy-peer-deps",
                "--ignore-scripts",
                "--no-audit",
                "--no-fund",
                ...archives
            ],
            { cwd: directory,
                encoding: "utf8" }
        );
        const installed = path.join(directory, "node_modules/bedform");
        const metadata = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
        assert.equal(metadata.dependencies["@types/react"], "19.3.0");
        assert.ok(
            (await readFile(path.join(installed, "ThirdPartyNotices.md"), "utf8")).includes(
                "react@19.3.1"
            )
        );
        assert.ok(
            (await readFile(path.join(installed, "Documentation/react-port.md"), "utf8")).includes(
                "Compatibility matrix"
            )
        );
        await cp(new URL("./ReactConsumer.tsx", import.meta.url), path.join(directory, "Consumer.tsx"));
        await writeFile(
            path.join(directory, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    target: "ES2022",
                    lib: [ "ES2022" ],
                    module: "NodeNext",
                    moduleResolution: "NodeNext",
                    strict: true,
                    types: [],
                    jsxImportSource: "bedform/Spatial/React"
                },
                files: [ "Consumer.tsx" ]
            })
        );
        for (const mode of [ "react-jsx", "react-jsxdev" ])
        {
            execFileSync(
                process.execPath,
                [
                    fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
                    "-p",
                    path.join(directory, "tsconfig.json"),
                    "--jsx",
                    mode,
                    "--outDir",
                    mode
                ],
                { cwd: directory,
                    encoding: "utf8" }
            );
            const result = await build({
                stdin: {
                    contents: `
                    export * as React from "bedform/Spatial/React";
                    export * as JsxRuntime from "bedform/Spatial/React/jsx-runtime";
                    export * as JsxDevRuntime from "bedform/Spatial/React/jsx-dev-runtime";
                    export { Sample } from "./${mode}/Consumer.js";
                    export * as Host from
                        "./node_modules/bedform/Distribution/Spatial/Internal/React/Host.js";
                    export { Module as Reconciler } from "./node_modules/bedform/Distribution/Spatial/Internal/React/Vendor/Reconciler.development.generated.js";
                    export { Module as ReconcilerConstants } from "./node_modules/bedform/Distribution/Spatial/Internal/React/Vendor/ReconcilerConstants.development.generated.js";
                `,
                    resolveDir: directory,
                    loader: "js"
                },
                bundle: true,
                format: "iife",
                globalName: "Vendor",
                platform: "neutral",
                target: "es2022",
                write: false,
                logLevel: "silent",
                metafile: true
            });
            const inputs = Object.keys(result.metafile!.inputs).filter(
                (name: string) => name !== "<stdin>"
            );
            for (const input of inputs)
            {
                assert.ok(
                    path.resolve(input).startsWith(directory),
                    `Unexpected workspace dependency: ${input}`
                );
            }

            const { Vendor, Accesses } = await Restricted("public", result.outputFiles[0]!.text);
            const system = new FakeSystem();
            assert.equal(system.Pending, 0);
            const dispose = Install(Vendor, system, { Console: Capture().Console });
            const root = CreateRoot(Vendor, system);
            const sample = (
                Vendor as unknown as {
                    Sample: () => unknown;
                }
            ).Sample;
            root.Render(Vendor.React.createElement(sample));
            await system.Settle();
            assert.equal(
                Print(root.Container),
                "<sample>\"1|2|3|context|4|5|6|false|7|true|store|8|context\"</sample>"
            );
            root.Render(null);
            await system.Settle();
            assert.equal(Print(root.Container), "");
            assert.deepEqual(Accesses, []);
            dispose();
        }

        await VerifyPackedSpatial(directory);
        await VerifyPackedComponents(directory);
    }
    finally
    {
        await rm(directory, { recursive: true,
            force: true });
    }
});
