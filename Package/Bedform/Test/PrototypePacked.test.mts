/**
 * Isolated packed Prototype consumer without the unrelated CLI dependency graph.
 *
 * @module bedform/Test/PrototypePacked.test
 *
 * @file      PrototypePacked.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain contextual callback inference and domain-grouped values. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import Assert from "node:assert/strict";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { tmpdir } from "node:os";

test("packed Prototype declarations and runtime work outside the repository", async () =>
{
    const npm = process.env.npm_execpath;
    Assert.ok(npm, "Run through npm test");
    const directory = mkdtempSync(join(tmpdir(), "bedform-prototype-"));
    try
    {
        const output = JSON.parse(execFileSync(process.execPath,
            [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", directory ],
            { cwd: fileURLToPath(new URL("..", import.meta.url)),
                encoding: "utf8" }));
        const artifact = (Array.isArray(output) ? output : Object.values(output))[0];
        const packageDirectory = join(directory, "node_modules", "bedform");
        mkdirSync(packageDirectory, { recursive: true });
        execFileSync("tar", [ "-xf", join(directory, artifact.filename), "--strip-components=1",
            "-C", packageDirectory ]);
        // Native modules have no host runtime. Only their installed declaration packages are copied.
        for (const name of [ "server", "common" ])
        {
            cpSync(dirname(fileURLToPath(import.meta.resolve(`@minecraft/${name}/package.json`))),
                join(directory, "node_modules", "@minecraft", name), { recursive: true });
        }

        writeFileSync(join(directory, "package.json"), JSON.stringify({ private: true,
            type: "module" }));
        writeFileSync(join(directory, "Prototype.types.mts"),
            readFileSync(new URL("Prototype.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "PrototypePersistence.types.mts"),
            readFileSync(new URL("PrototypePersistence.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "PrototypeCatalog.types.mts"),
            readFileSync(new URL("PrototypeCatalog.types.mts", import.meta.url), "utf8"));
        const guide = readFileSync(new URL("../Documentation/prototype.md", import.meta.url), "utf8");
        const example = /```ts\r?\n([\s\S]*?)```/u.exec(guide);
        Assert.ok(example);
        writeFileSync(join(directory, "example.ts"), example[1]);
        const walkthrough = readFileSync(
            join(packageDirectory, "Documentation", "prototype-guide.md"), "utf8");
        const walkthroughExamples = [ ...walkthrough.matchAll(/```ts\r?\n([\s\S]*?)```/gu) ];
        Assert.ok(walkthroughExamples.length > 0, "The authoring walkthrough must contain a checked example");
        const walkthroughFiles = walkthroughExamples.map((match, index) =>
        {
            const filename = `walkthrough-${index}.ts`;
            writeFileSync(join(directory, filename), match[1]);
            return filename;
        });
        writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
            compilerOptions: { lib: [ "ES2022" ],
                module: "NodeNext",
                moduleResolution: "NodeNext",
                noEmit: true,
                strict: true,
                target: "ES2022",
                types: [] },
            files: [ "Prototype.types.mts", "PrototypePersistence.types.mts",
                "PrototypeCatalog.types.mts", "example.ts", ...walkthroughFiles ]
        }));
        execFileSync(process.execPath,
            [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")), "-p", directory ],
            { cwd: directory,
                encoding: "utf8" });
        const bundle = await build({ bundle: true,
            format: "iife",
            metafile: true,
            platform: "neutral",
            stdin: { contents: `
                import * as P from "bedform/Prototype";
                import * as D from "bedform/Prototype/Demonstration";
                import * as W from "bedform/Prototype/World";
                import * as I from "bedform/Prototype/Interaction";
                import * as S from "bedform/Prototype/Structure";
                const demo = D.Demonstration({Id:"packed",Name:"Packed",Description:"",
                    GetState:()=>({Status:P.Ready})});
                const normalized = P.StructureCatalog.normalize({InteriorHeight:4});
                if (P.StructureCatalog.validateSite(normalized,{FloorY:0,MinY:0,MaxYExclusive:10}) !== 9)
                    throw new Error("Packed catalog site validation failed");
                const storage = new Map();
                const port = {getDynamicProperty:key=>storage.get(key),
                    setDynamicProperty:(key,value)=>storage.set(key,value)};
                P.Persistence.saveGeneratedColor(port,"packed",0,{red:0.5,green:0.6,blue:0.7});
                const state = P.Persistence.load(port);
                const view = P.References.reconcile(state,[demo],{
                    Block:()=>({Status:"Unloaded"}),Entity:()=>({Status:"Unloaded"})});
                globalThis.proof = [W.World({Demonstrations:[demo]}).Demonstrations.length,
                    S.Defaults.InteriorHeight,Object.keys(I).length,state.Revision,view.Total];
            `,
            resolveDir: directory },
            write: false });
        Assert.ok(Object.keys(bundle.metafile.inputs).every((path) =>
            path === "<stdin>" ||
            (/node_modules\/bedform\/Distribution\/Prototype\//u.test(path) && !/\/Host/u.test(path))));
        const sandbox = { proof: undefined,
            process: undefined,
            Buffer: undefined,
            console: undefined,
            URL: undefined,
            setTimeout: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox);
        Assert.equal(JSON.stringify(sandbox.proof), JSON.stringify([ 1, 3, 0, 1, 1 ]));
    }
    finally
    {
        // directory is a newly allocated temporary consumer owned exclusively by this test.
        rmSync(directory, { force: true,
            recursive: true });
    }
});
