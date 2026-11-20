/**
 * Qualifies installed spatial JSX child contracts and committed layout in both JSX modes.
 *
 * @module bedform/Test/SpatialComponentsPacked
 *
 * @file      SpatialComponentsPacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Consumer configuration and fixtures retain behavioral order. */

/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { Realm, Scene } from "./SpatialRuntimeHarness.mjs";
import { cp, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Compiles positive and negative consumers using only the independently installed archive.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyPackedComponents(directory: string): Promise<void>
{
    await cp(
        new URL("./SpatialComponents.tsx", import.meta.url),
        path.join(directory, "SpatialComponents.tsx")
    );
    await writeFile(
        path.join(directory, "SpatialComponents.tsconfig.json"),
        JSON.stringify({
            compilerOptions: {
                target: "ES2022",
                lib: [ "ES2022" ],
                types: [],
                strict: true,
                module: "NodeNext",
                moduleResolution: "NodeNext",
                jsxImportSource: "bedform/Spatial/React"
            },
            files: [ "SpatialComponents.tsx" ]
        })
    );
    for (const mode of [ "react-jsx", "react-jsxdev" ])
    {
        execFileSync(
            process.execPath,
            [
                fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
                "-p",
                "SpatialComponents.tsconfig.json",
                "--jsx",
                mode,
                "--outDir",
                `components-${mode}`
            ],
            { cwd: directory,
                encoding: "utf8" }
        );
        const api = await Realm(
            "export * as Renderer from \"bedform/Spatial/Renderer\";\n" +
                "export * as NativeText from \"bedform/Spatial/Text\";\n" +
                "export * as React from \"bedform/Spatial/React\";\n" +
                "export * as Spatial from \"bedform/Spatial\";\n" +
                `export { Sample } from "./components-${mode}/SpatialComponents.js";`,
            directory
        );
        const scene = new Scene();
        const viewer = { id: "packed-layout",
            isValid: true };
        scene.Players = [ viewer ];
        const runtime = scene.Start(api.Renderer, { Surface: { ...scene.Factory,
            CustomHost: false } });
        const root = api.Renderer.CreateRoot(runtime, { Player: viewer });
        try
        {
            const sample = (
                api as unknown as {
                    Sample: () => import("../Source/Spatial/React/index.js").ReactElement;
                }
            ).Sample;
            root.Render(api.React.createElement(sample));
            await scene.System.Until(() => root.Layout !== undefined);
            assert.equal(root.Layout!.Views.length, 2);
            assert.ok(root.Layout!.Items.some((item) => item.Text?.Value === "Action now"));
            assert.ok(root.Layout!.Items.some((item) => item.RequiredItems.includes("minecraft:stick")));
            assert.ok(root.Layout!.Views.every((view) => view.LayerDepth === 0.01));
            assert.ok(root.Layout!.Items.some((item) => item.Depth > 0));
            await scene.System.Until(() => scene.Sessions[0]?.Frames.at(-1)?.Layout === root.Layout);
            const frame = scene.Sessions[0]!.Frames.at(-1)!;
            assert.equal(frame.Layout, root.Layout);
            assert.equal(api.Spatial.Components.Text.name, "Text");
            assert.equal(typeof (api as unknown as {
                NativeText: typeof import("../Source/Spatial/Text.js");
            }).NativeText.CreateSurface, "function");
            assert.ok(
                api.Spatial.Layout.HitTest(root.Layout!, root.Layout!.Views[0]!.Id, { X: 1,
                    Y: 1 })
                    .length
            );
            assert.deepEqual(scene.Errors, []);
        }
        finally
        {
            await runtime.Dispose();
        }

        assert.equal(scene.System.Timers.size, 0);
        api.CheckGlobals();
    }
}
