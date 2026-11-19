/**
 * Builds the Canvas scaffold as two deterministic packs without invoking Bedform or a client.
 *
 * @module bedform-canvas/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import type { Zippable } from "fflate";
import assert from "node:assert/strict";
import { build } from "esbuild";
import path from "node:path";
import { zipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
// ZIP stores local calendar fields, so use the same local date in every timezone.
const Stamp = new Date(2026, 0, 1);

/**
 * Reads regular pack files with portable relative paths, rejecting filesystem indirection.
 *
 * @throws { Error } If a pack contains a symlink or another nonregular entry.
 *
 * @category Serialization
 * @since 1.0.0
 */
async function Collect(directory: string, relative: string = ""): Promise<Record<string, Uint8Array>>
{
    const files: Record<string, Uint8Array> = {};
    const children = await readdir(path.join(directory, relative), { withFileTypes: true });
    children.sort((left: Dirent<string>, right: Dirent<string>) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const child of children)
    {
        const name = relative + child.name;
        assert.ok(!child.name.includes("\\"), `Canvas pack path must be portable: ${name}`);
        if (child.isDirectory())
        {
            Object.assign(files, await Collect(directory, name + "/"));
        }
        else if (child.isFile())
        {
            files[name] = await readFile(path.join(directory, name));
        }
        else
        {
            throw new Error(`Unsupported Canvas pack entry: ${name}`);
        }
    }

    return files;
}

/**
 * Serializes files in lexical order with fixed compression, dates and permissions.
 *
 * @category Serialization
 * @since 1.0.0
 */
function Archive(files: Record<string, Uint8Array>): Uint8Array
{
    const entries: Zippable = {};
    for (const name of Object.keys(files).sort())
    {
        entries[name] = [ files[name], { attrs: 0,
            level: 9,
            mtime: Stamp,
            os: 0 } ];
    }

    return zipSync(entries);
}

/**
 * Validates package versions, unique pack/module identities and the native script entry contract.
 *
 * @throws { Error } If authored metadata disagrees or required pack configuration is missing.
 *
 * @category Validation
 * @since 1.0.0
 */
function Validate(metadata: string, behavior: Uint8Array, resource: Uint8Array): void
{
    const pkg = JSON.parse(metadata);
    assert.equal(pkg.name, "bedform-canvas", "Canvas package name must be bedform-canvas.");
    assert.equal(pkg.private, true, "Canvas must remain a private workspace.");
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/u, "Canvas pack versions must be release triples.");
    const version = pkg.version.split(".").map(Number);
    assert.ok(version.every(Number.isSafeInteger), "Canvas versions must use safe integers.");
    const bp = JSON.parse(Buffer.from(behavior).toString());
    const rp = JSON.parse(Buffer.from(resource).toString());
    const identities = new Set<string>();
    for (const manifest of [ bp, rp ])
    {
        assert.equal(manifest.format_version, 2, "Canvas requires manifest format 2.");
        assert.deepEqual(manifest.header.min_engine_version, [ 1, 26, 60 ]);
        for (const entry of [ manifest.header, ...manifest.modules ])
        {
            assert.match(entry.uuid, /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/u);
            assert.ok(!identities.has(entry.uuid), `Duplicate Canvas UUID: ${entry.uuid}`);
            identities.add(entry.uuid);
            assert.deepEqual(entry.version, version, "Canvas package and manifest versions must agree.");
        }
    }

    assert.deepEqual(bp.modules.map((entry: { type: string }) => entry.type), [ "data", "script" ]);
    assert.equal(bp.modules[1].language, "javascript");
    assert.equal(bp.modules[1].entry, "scripts/main.js");
    assert.deepEqual(rp.modules.map((entry: { type: string }) => entry.type), [ "resources" ]);
    assert.deepEqual(bp.dependencies, [ { uuid: rp.header.uuid,
        version }, { module_name: "@minecraft/server",
        version: "2.10.0" } ]);
    assert.equal(rp.dependencies, undefined, "Canvas resources must not create a dependency cycle.");
}

/**
 * Builds bedform-canvas.mcaddon from a workspace snapshot and atomically publishes the archive.
 * The optional source directory permits independent isolated builds. Generated runtime and notices
 * exist only in the archive; authored source packs are never modified.
 *
 * @throws { Error } If inputs are invalid, bundling fails or the archive cannot be published.
 *
 * @category Serialization
 * @since 1.0.0
 */
export async function Build(outputDirectory: string = path.join(Root, "dist"),
    sourceDirectory: string = Root): Promise<string>
{
    const source = path.resolve(sourceDirectory);
    const behavior = await Collect(path.join(source, "behavior_packs/bedform_canvas"));
    const resource = await Collect(path.join(source, "resource_packs/bedform_canvas"));
    Validate(await readFile(path.join(source, "package.json"), "utf8"),
        behavior["manifest.json"], resource["manifest.json"]);
    const compiled = await build({ absWorkingDir: source,
        alias: {
            "bedform/Canvas/Image": path.join(Root, "../../Package/Bedform/Source/Canvas/Image.ts"),
            "bedform/Canvas/IntentProtocol": path.join(Root,
                "../../Package/Bedform/Source/Canvas/Public/Intent.ts"),
            "bedform/Canvas/IntentValidation": path.join(Root,
                "../../Package/Bedform/Source/Spatial/Internal/IntentValue.ts"),
            "bedform/Canvas/Surface": path.join(Root, "../../Package/Bedform/Source/Canvas/Surface.ts"),
            "bedform/Spatial/Measurement": path.join(Root,
                "../../Package/Bedform/Source/Spatial/Measurement.ts")
        },
        bundle: true,
        entryPoints: [ "Script/Main.ts" ],
        external: [ "@minecraft/server" ],
        format: "esm",
        legalComments: "none",
        logLevel: "silent",
        outfile: "scripts/main.js",
        platform: "neutral",
        target: "es2022",
        write: false });
    assert.equal(compiled.outputFiles.length, 1);
    assert.equal(behavior["scripts/main.js"], undefined, "Canvas runtime must be built from Script/Main.ts.");
    behavior["scripts/main.js"] = compiled.outputFiles[0].contents;
    for (const files of [ behavior, resource ])
    {
        for (const [ name, input ] of [ [ "License.txt", "License.txt" ],
            [ "AssetProvenance.md", "Assets/ReadMe.md" ] ])
        {
            assert.equal(files[name], undefined, `Canvas generated notice conflicts with ${name}.`);
            files[name] = await readFile(path.join(source, input));
        }
    }

    const bytes = Archive({ "bedform-canvas-bp.mcpack": Archive(behavior),
        "bedform-canvas-rp.mcpack": Archive(resource) });
    const directory = path.resolve(outputDirectory);
    await mkdir(directory, { recursive: true });
    const temporary = await mkdtemp(path.join(directory, ".canvas-"));
    const output = path.join(directory, "bedform-canvas.mcaddon");
    try
    {
        const staged = path.join(temporary, "bedform-canvas.mcaddon");
        await writeFile(staged, bytes);
        await rename(staged, output);
    }
    finally
    {
        await rm(temporary, { force: true,
            recursive: true });
    }

    return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
