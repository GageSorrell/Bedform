/**
 * Verify the package publishes working JavaScript and declaration entrypoints.
 *
 * @module bedform/Test/Package.test
 *
 * @file      Package.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("package contains every declared entrypoint and depends on the Bedrock port", () =>
{
    const npm = process.env.npm_execpath;
    Assert.ok(npm, "Run tests through npm test");
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    const packed = JSON.parse(execFileSync(process.execPath,
        [ npm, "pack", "--dry-run", "--json", "--ignore-scripts" ],
        { cwd: fileURLToPath(new URL("..", import.meta.url)),
            encoding: "utf8" }));
    const artifact = (Array.isArray(packed) ? packed : Object.values(packed))[0];
    const files = new Set(artifact.files.map((file: { path: string }): string => file.path));
    for (const entry of [ manifest.main, manifest.types, manifest.bin.bedform,
        ...Object.values(manifest.exports).flatMap((value: unknown): Array<string> =>
            typeof value === "string" ? [ value ] : Object.values(value as Record<string, string>)) ])
    {
        Assert.ok(files.has(entry.slice(2)), `Missing published entrypoint: ${entry}`);
    }

    Assert.equal(manifest.dependencies["@bedform/effect"], "1.0.0-alpha.1");
    Assert.equal(manifest.dependencies.effect, undefined);
    Assert.equal(manifest.sideEffects, false);
    Assert.equal(manifest.license, "MIT");
    Assert.ok(files.has("License.md"));
    Assert.ok(files.has("ReadMe.md"));
});
