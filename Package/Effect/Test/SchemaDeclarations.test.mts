/**
 * Checks that the emitted declarations typecheck with the oldest TypeScript the workspace's
 * consumers use, so a type that only newer compilers accept cannot ship.
 *
 * @module @bedform/effect/Test/SchemaDeclarations.test
 *
 * @file      SchemaDeclarations.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { dirname, join, resolve } from "node:path";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import Assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { tmpdir } from "node:os";

const PackageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** The TypeScript line the add-on consumers compile with; see PROVENANCE.md. */
const OldestTypeScript = "5.5.";

test("every exported declaration typechecks with the consumers' TypeScript 5.5", () =>
{
    // The package builds with its own newer TypeScript; consumers resolve the workspace root's.
    const workspace = createRequire(resolve(PackageRoot, "../../package.json"));
    const compiler = workspace.resolve("typescript/lib/tsc.js");
    const installed = readFileSync(workspace.resolve("typescript/package.json"), "utf8");
    const version: string = JSON.parse(installed).version;
    Assert.ok(version.startsWith(OldestTypeScript),
        `The workspace TypeScript is ${version}; update OldestTypeScript and PROVENANCE.md together`);
    const manifest = JSON.parse(readFileSync(join(PackageRoot, "package.json"), "utf8"));
    const declarations = Object.values(manifest.exports as Record<string, { types?: string }>)
        .flatMap((entry: { types?: string }) => (entry.types ? [ join(PackageRoot, entry.types) ] : []));
    Assert.ok(declarations.length > 0, "No exported declarations found");
    const temporary = mkdtempSync(join(tmpdir(), "bedform-effect-declarations-"));
    try
    {
        writeFileSync(join(temporary, "tsconfig.json"), JSON.stringify({
            compilerOptions: {
                module: "NodeNext",
                moduleResolution: "NodeNext",
                noEmit: true,
                skipLibCheck: false,
                strict: true,
                target: "ES2022",
                types: []
            },
            files: declarations
        }));
        try
        {
            execFileSync(process.execPath, [ compiler, "-p", join(temporary, "tsconfig.json") ],
                { encoding: "utf8" });
        }
        catch (error)
        {
            const output = error as { stdout?: string };
            const details = output.stdout ?? String(error);
            Assert.fail(`TypeScript ${version} rejects the emitted declarations:\n${details}`);
        }
    }
    finally
    {
        rmSync(temporary, { force: true,
            recursive: true });
    }
});
