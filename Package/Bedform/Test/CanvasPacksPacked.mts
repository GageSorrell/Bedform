/**
 * Offline installed-CLI qualification of general Canvas assets without Intent or image setup.
 *
 * @module bedform/Test/CanvasPacksPacked
 *
 * @file      CanvasPacksPacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Packed fixtures retain manifest order and contextual callbacks. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { strFromU8, unzipSync } from "fflate";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

/**
 * Checks packaged artifact bytes, feature detection, erasure, dependency deduplication and atomic
 * failure through a source-free offline installation. The caller owns the installed fixture.
 *
 * @throws { Error } If archive contents, staged dependencies or publication preservation fail.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyPackedCanvasPacks(directory: string): Promise<void>
{
    const installed = Path.join(directory, "node_modules/bedform");
    const artifact = unzipSync(await Fs.readFile(Path.join(installed, "Asset/bedform-canvas.mcaddon")));
    const bp = JSON.parse(strFromU8(unzipSync(artifact["bedform-canvas-bp.mcpack"])["manifest.json"]));
    const root = Path.join(directory, "canvas-packs");
    for (const folder of [ "Script", "behavior_packs/main", "resource_packs/main" ])
    {
        await Fs.mkdir(Path.join(root, folder), { recursive: true });
    }

    await Fs.writeFile(Path.join(root, "package.json"), "{\"name\":\"canvas-packed-assets\",\"type\":\"module\"}");
    await Fs.writeFile(Path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        strict: true,
        types: [],
        skipLibCheck: true
    },
    include: [ "Script/**/*.ts" ] }));
    const script = Path.join(root, "Script/main.ts");
    await Fs.writeFile(script, `
        import { WithAssets } from "bedform/Canvas/Dependency";
        const value = WithAssets({ kind: "custom" as const });
        const kind: "custom" = value.kind;
        Object.assign(globalThis, { kind });
    `);
    for (const [ folder, type, uuid, module ] of [
        [ "behavior_packs/main", "script", "3e0bf41b-962c-4bea-bdac-43f7ee09e127", "b7858101-cf96-4250-a35c-1e2e185ae012" ],
        [ "resource_packs/main", "resources", "03a482c7-14d4-4682-b890-05e3b614e144", "c9e90282-b82d-42f8-98fb-d3fc4a53d1f8" ]
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

    const manifestFile = Path.join(root, "behavior_packs/main/manifest.json");
    const original = await Fs.readFile(manifestFile);
    const bin = Path.join(installed, "Distribution/Bin.js");
    const run = () => execFileSync(process.execPath, [ bin, "build", root ], { cwd: tmpdir(),
        encoding: "utf8" });
    run();
    const archiveFile = Path.join(root, "dist/canvas-packed-assets.mcaddon");
    const outer = unzipSync(await Fs.readFile(archiveFile));
    for (const [ name, bytes ] of Object.entries(artifact))
    {
        assert.deepEqual(outer[name], bytes);
    }

    const behavior = unzipSync(outer["0-main.mcpack"]);
    const sandbox: Record<string, unknown> = { process: undefined,
        require: undefined,
        fetch: undefined };
    runInNewContext(strFromU8(behavior["scripts/main.js"]), sandbox);
    assert.equal(sandbox.kind, "custom");
    assert.deepEqual(await Fs.readFile(manifestFile), original);
    const match = { uuid: bp.header.uuid.toUpperCase(),
        version: bp.header.version,
        extra: "preserved" };
    const declared = { ...JSON.parse(original.toString()),
        dependencies: [ match, match ] };
    await Fs.writeFile(manifestFile, JSON.stringify(declared));
    run();
    const archive = await Fs.readFile(archiveFile);
    const staged = JSON.parse(strFromU8(unzipSync(unzipSync(archive)["0-main.mcpack"])["manifest.json"]));
    const matches = staged.dependencies.filter((dependency: { uuid?: string }) => dependency.uuid?.toLowerCase() === bp.header.uuid);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].extra, "preserved");
    declared.dependencies[0] = { ...match,
        version: [ 99, 0, 0 ] };
    await Fs.writeFile(manifestFile, JSON.stringify(declared));
    const failed = spawnSync(process.execPath, [ bin, "build", root ], { cwd: tmpdir(),
        encoding: "utf8" });
    assert.equal(failed.status, 1);
    assert.match(failed.stderr, /Conflicting BedformCanvas/u);
    assert.deepEqual(await Fs.readFile(archiveFile), archive);
    await Fs.writeFile(manifestFile, original);
    await Fs.writeFile(script, `
        import type { WithAssets as DependencyMarker } from "bedform/Canvas/Dependency";
        import { WithAssets } from "bedform/Canvas/Dependency";
        const unused = /* #__PURE__ */ WithAssets({ kind: "unused" });
        const marker: typeof DependencyMarker | null = null;
        Object.assign(globalThis,{marker});
    `);
    run();
    assert.ok(!unzipSync(await Fs.readFile(archiveFile))["bedform-canvas-bp.mcpack"]);
}
