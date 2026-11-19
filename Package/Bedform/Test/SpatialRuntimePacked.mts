/**
 * Qualifies installed spatial runtime exports, restricted-host lifetimes and consumer declarations.
 *
 * @module bedform/Test/SpatialRuntimePacked
 *
 * @file      SpatialRuntimePacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain lifetime order and infer callbacks from public contracts. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { Realm, Scene, Text } from "./SpatialRuntimeHarness.mjs";
import { cp, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Uses only the installed archive, including the Spatial namespace and explicit Renderer subpath.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyPackedSpatial(directory: string): Promise<void>
{
    const api = await Realm("export * as Renderer from \"bedform/Spatial/Renderer\";\n" +
        "export * as React from \"bedform/Spatial/React\";\n" +
        "export * as Spatial from \"bedform/Spatial\";", directory);
    assert.equal(api.Spatial.Start, api.Renderer.Start);
    assert.equal(api.Spatial.Renderer.CreateRoot, api.Renderer.CreateRoot);
    const scene = new Scene();
    const a = { id: "packed-a",
        isValid: true };
    const b = { id: "packed-b",
        isValid: true };
    scene.Players = [ a, b ];
    const runtime = scene.Start(api.Renderer);
    let audience = [ b ];
    const root = api.Renderer.CreateRoot(runtime, { Player: a });
    const shared = api.Renderer.CreateRoot(runtime, { Shared: true,
        Audience: () => audience });
    const Component = (): import("../Source/Spatial/React/index.js").ReactNode =>
    {
        const [ value ] = api.React.useState("packed");
        return api.React.createElement("label", null, value);
    };

    try
    {
        root.Render(api.React.createElement(Component));
        shared.Render(api.React.createElement(Component));
        await scene.System.Until(() => scene.Live.size === 2);
        assert.deepEqual(scene.Sessions.map((session) => session.Context.Viewer.id), [ a.id, b.id ]);
        assert.ok(scene.Sessions.every((session) => Text(session.Frames.at(-1)) === "packed"));
        audience = [];
        await scene.System.Step();
        assert.equal(scene.Live.size, 1);
        assert.equal(root.Unmount(), root.Unmount());
        await root.Unmount();
        assert.equal(scene.Live.size, 0);
    }
    finally
    {
        await runtime.Dispose();
    }

    assert.equal(scene.System.Timers.size, 0);
    api.CheckGlobals();
    await cp(new URL("./SpatialRuntime.types.mts", import.meta.url),
        path.join(directory, "SpatialRuntime.types.mts"));
    await writeFile(path.join(directory, "SpatialRuntime.tsconfig.json"), JSON.stringify({
        compilerOptions: { target: "ES2022",
            lib: [ "ES2022" ],
            types: [],
            strict: true,
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true },
        files: [ "SpatialRuntime.types.mts" ]
    }));
    execFileSync(process.execPath, [
        fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
        "-p", "SpatialRuntime.tsconfig.json"
    ], { cwd: directory,
        encoding: "utf8" });
    const metadata = JSON.parse(await readFile(
        path.join(directory, "node_modules/bedform/package.json"), "utf8"));
    assert.ok(metadata.exports["./Spatial/Renderer"].types.endsWith("Renderer.d.ts"));
}
