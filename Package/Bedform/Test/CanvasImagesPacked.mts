/**
 * Exercises Canvas image compilation through an independently installed offline package and CLI.
 *
 * @module bedform/Test/CanvasImagesPacked
 *
 * @file      CanvasImagesPacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Packed fixtures retain authored field order and contextual callbacks. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { strFromU8, unzipSync } from "fflate";
import { runInNewContext } from "node:vm";

/**
 * Builds actual image assets and the virtual descriptor through the installed CLI, with no workspace
 * links, lifecycle scripts or source-package resolution. The caller owns the installed fixture.
 *
 * @throws { Error } If CLI output, public types, native-shaped metadata or source preservation fails.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyPackedCanvas(directory: string): Promise<void>
{
    const root = Path.join(directory, "canvas-images");
    for (const folder of [ "Asset", "Script", "behavior_packs/main", "resource_packs/main" ])
    {
        await Fs.mkdir(Path.join(root, folder), { recursive: true });
    }

    const png = new PNG({ width: 4,
        height: 6 });
    png.data.fill(255);
    png.data[3] = 1;
    const source = PNG.sync.write(png);
    await Fs.writeFile(Path.join(root, "Asset/strip.png"), source);
    await Fs.writeFile(Path.join(root, "package.json"), JSON.stringify({ name: "canvas-packed",
        type: "module",
        version: "1.0.0" }));
    await Fs.writeFile(Path.join(root, "bedform.config.json"), JSON.stringify({ Canvas: {
        Namespace: "packed",
        Images: [ { Name: "Spinner",
            Source: "Asset/strip.png",
            FrameCount: 3,
            FrameTicks: 4 } ]
    } }));
    await Fs.writeFile(Path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        strict: true,
        types: [],
        skipLibCheck: true
    },
    include: [ "Script/**/*.ts" ] }));
    await Fs.writeFile(Path.join(root, "Script/main.ts"), `
        import { Images } from "../generated/canvas/images.js";
        import { FrameAt, type ImageDescriptor } from "bedform/Canvas/Image";
        import type * as Intent from "bedform/Spatial/Intent";
        const image: ImageDescriptor = Images.Spinner;
        const shared: Intent.ImageDescriptor = image;
        Object.assign(globalThis, { image: shared, frame: FrameAt(image, 5) });
    `);
    for (const [ folder, type, uuid, module ] of [
        [ "behavior_packs/main", "script", "5813e754-5dc7-4134-a6fc-a38197545bb4", "74a73813-98d0-4d4f-8042-80622a282b3e" ],
        [ "resource_packs/main", "resources", "2fd48632-7c32-4ccf-b3f9-359fd363d467", "4c82a0af-bc5c-42e1-a263-2c55b1e30570" ]
    ])
    {
        await Fs.writeFile(Path.join(root, folder, "manifest.json"), JSON.stringify({ format_version: 2,
            header: { name: "Packed Canvas",
                description: "Offline fixture",
                uuid,
                version: [ 1, 0, 0 ],
                min_engine_version: [ 1, 26, 60 ] },
            modules: [ { type,
                uuid: module,
                version: [ 1, 0, 0 ],
                ...(type === "script" ? { language: "javascript",
                    entry: "scripts/main.js" } : {}) } ]
        }));
    }

    const original = await Fs.readFile(Path.join(root, "Script/main.ts"));
    execFileSync(process.execPath, [ Path.join(directory, "node_modules/bedform/Distribution/Bin.js"), "build", root ],
        { cwd: tmpdir(),
            encoding: "utf8" });
    const outer = unzipSync(await Fs.readFile(Path.join(root, "dist/canvas-packed.mcaddon")));
    const behavior = unzipSync(outer["0-main.mcpack"]);
    const resource = unzipSync(outer["1-main.mcpack"]);
    assert.ok(resource["particles/canvas/images/spinner.json"]);
    assert.ok(resource["particles/canvas/images/spinner_oriented.json"]);
    const compiled = PNG.sync.read(Buffer.from(resource["textures/packed/canvas/images/spinner.png"]));
    assert.deepEqual(compiled.data, png.data);
    const code = strFromU8(behavior["scripts/main.js"]);
    assert.doesNotMatch(code, /node:|fetch\(|require\(|from ["']bedform|jsx-runtime/u);
    const sandbox: Record<string, unknown> = { fetch: undefined,
        require: undefined,
        process: undefined,
        setTimeout: undefined,
        TextEncoder: undefined };
    runInNewContext(code, sandbox);
    assert.equal(JSON.stringify(sandbox.frame), JSON.stringify({ Height: 2,
        Index: 1,
        U: 0,
        V: 2,
        Width: 4 }));
    assert.equal((sandbox.image as { FrameTicks: number }).FrameTicks, 4);
    assert.deepEqual(await Fs.readFile(Path.join(root, "Asset/strip.png")), source);
    assert.deepEqual(await Fs.readFile(Path.join(root, "Script/main.ts")), original);
    await assert.rejects(Fs.stat(Path.join(root, "generated")), /ENOENT/u);
}
