/**
 * Builds the World input demonstration behavior pack, bundling @bedform/server into its script.
 *
 * @module @sorrell/world-input-demo/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import path from "node:path";

/**
 * Root of this standalone demonstration add-on.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Stable pack and module identities of the demonstration behavior pack.
 *
 * @category Constant
 * @since 1.0.0
 */
const PackId = Object.freeze({
    Data: "6d930f93-aecc-4d31-97d8-234d504c50b1",
    Header: "525fcc02-ee99-4b90-9f27-ae39dd50563a",
    Script: "b98134b2-9b8a-4a3f-8a47-e0326a3b6c0a"
} as const);

/**
 * Emits the behavior pack under dist/behavior and returns its directory.
 * `@bedform/server` is bundled from the workspace build; only `@minecraft/server` stays external.
 *
 * @category Serialization
 * @since 1.0.0
 */
export async function Build(): Promise<string>
{
    const behavior = path.join(Root, "dist/behavior");
    await rm(behavior, { force: true,
        recursive: true });
    await mkdir(behavior, { recursive: true });
    const metadata = JSON.parse(await readFile(path.join(Root, "package.json"), "utf8"));
    const version = metadata.version.split(".").map(Number);
    await writeFile(path.join(behavior, "manifest.json"), JSON.stringify({
        dependencies: [ { module_name: "@minecraft/server",
            version: "2.10.0" } ],
        format_version: 2,
        header: {
            description: "@bedform/server input signal monitor",
            min_engine_version: [ 1, 26, 60 ],
            name: "World Input Demo",
            uuid: PackId.Header,
            version },
        modules: [ { type: "data",
            uuid: PackId.Data,
            version },
        { entry: "scripts/main.js",
            language: "javascript",
            type: "script",
            uuid: PackId.Script,
            version } ]
    }, null, 2) + "\n");
    await build({
        bundle: true,
        entryPoints: [ path.join(Root, "Script/Main.ts") ],
        external: [ "@minecraft/server" ],
        format: "esm",
        outfile: path.join(behavior, "scripts/main.js"),
        target: "es2022" });
    return behavior;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
