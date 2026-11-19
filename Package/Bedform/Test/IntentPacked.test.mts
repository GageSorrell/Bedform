/**
 * Checks Intent's actual npm archive without lifecycle scripts or source workspace resolution.
 *
 * @module bedform/Test/IntentPacked.test
 *
 * @file      IntentPacked.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { VerifyPackedIntent, VerifyPackedSurface } from "./IntentPacked.mjs";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

test("published Intent and Surface entries and restricted helpers survive npm packing", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "intent-packed-"));
    try
    {
        const npm = process.env.npm_execpath;
        assert.ok(npm, "Run this packed test through npm so the package manager path is explicit.");
        const result = JSON.parse(execFileSync(process.execPath, [ npm, "pack", "--json",
            "--ignore-scripts", "--offline", "--pack-destination", directory,
            fileURLToPath(new URL("../", import.meta.url)) ], { cwd: directory,
            encoding: "utf8" }));
        const artifacts = Array.isArray(result) ? result : Object.values(result);
        const artifact = artifacts.find((entry: Record<string, unknown>) => entry.name === "bedform");
        assert.ok(artifact);
        const destination = path.join(directory, "node_modules/bedform");
        await mkdir(destination, { recursive: true });
        execFileSync("tar", [ "-xzf", path.join(directory, artifact.filename), "-C", destination,
            "--strip-components=1" ]);
        const metadata = JSON.parse(await readFile(path.join(destination, "package.json"), "utf8"));
        for (const name of [ "./Spatial", "./Spatial/Intent", "./Canvas/Image", "./Canvas/IntentProtocol",
            "./Canvas/Surface", "./Spatial/Measurement", "./Canvas/Dependency" ])
        {
            for (const kind of [ "types", "import" ])
            {
                assert.ok((await readFile(path.join(destination, metadata.exports[name][kind]))).length > 0);
            }
        }

        // Unused unrelated root exports can remain external; executing the bundle proves Intent
        // itself retains no dependency on them. The full offline consumer also calls this helper.
        await VerifyPackedIntent(directory);
        await VerifyPackedSurface(directory);
        for (const name of [ "@minecraft/server", "@minecraft/common" ])
        {
            const source = path.dirname(fileURLToPath(import.meta.resolve(`${name}/package.json`)));
            await cp(source, path.join(directory, "node_modules", name), { force: true,
                recursive: true });
        }

        const types = path.join(directory, "Intent.types.mts");
        await cp(new URL("./Intent.types.mts", import.meta.url), types, { force: true });
        execFileSync(process.execPath, [
            fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
            "--ignoreConfig", "--noEmit", "--strict", "--target", "ES2022", "--module", "NodeNext",
            "--skipLibCheck", types ], { cwd: directory,
            encoding: "utf8" });
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});
