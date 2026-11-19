/**
 * Runs a packed Intent client against a native-shaped relay with restricted runtime globals.
 *
 * @module bedform/Test/IntentPacked
 *
 * @file      IntentPacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Assert from "node:assert/strict";
import { Harness as IntentHarness } from "./IntentHarness.mjs";
import { VerifyIntentCanvas } from "./IntentCanvas.mjs";
import { build } from "esbuild";
import { runInNewContext } from "node:vm";

/**
 * Exercises the independently installed Intent client in a restricted host through root/direct exports.
 *
 * @category Testing
 * @since 1.0.0
 */
export const VerifyPackedIntent = async (directory: string): Promise<void> =>
{
    const bundle = await build({ bundle: true,
        external: [ "@minecraft/*", "@bedform/effect", "@bedform/effect/*" ],
        format: "iife",
        platform: "neutral",
        stdin: { contents: `
            import { Spatial } from "bedform";
            import * as Intent from "bedform/Spatial/Intent";
            import { ScriptEvent } from "bedform/Canvas/IntentProtocol";
            globalThis.api = Intent;
            globalThis.same = Spatial.Intent.Start === Intent.Start;
            globalThis.ack = ScriptEvent.Acknowledgement;
        `,
        resolveDir: directory },
        write: false });
    const sandbox: Record<string, unknown> = { Buffer: undefined,
        TextDecoder: undefined,
        TextEncoder: undefined,
        URL: undefined,
        console: undefined,
        process: undefined,
        require: undefined,
        setInterval: undefined,
        setTimeout: undefined };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    Assert.equal(sandbox.same, true);
    const host = IntentHarness();
    const api = sandbox.api as typeof import("bedform/Spatial/Intent");
    const protocol = await import("bedform/Canvas/IntentProtocol");
    Assert.equal(sandbox.ack, protocol.ScriptEvent.Acknowledgement);
    const connection = api.Start({ Id: "packed:intent",
        System: host.system,
        World: host.world });
    const operation = connection.Set(host.actor("npc", "minecraft:pig"), api.Builtin.Thinking);
    await host.advance(3);
    await operation;
    const disposed = connection.Dispose();
    await host.advance(2);
    await disposed;
    Assert.equal(host.listeners.size, 0);
    Assert.equal(host.scheduled.size, 0);
    await VerifyIntentCanvas(directory);
};

/**
 * Bundles the packed imperative surface helpers alone in a restricted realm, without React, JSX or
 * an image compiler, and emits one frame through a native-shaped fake viewer.
 *
 * @category Testing
 * @since 1.0.0
 */
export const VerifyPackedSurface = async (directory: string): Promise<void> =>
{
    const bundle = await build({ bundle: true,
        external: [ "@minecraft/*" ],
        format: "iife",
        metafile: true,
        platform: "neutral",
        stdin: { contents: "import * as Surface from \"bedform/Canvas/Surface\"; globalThis.api = Surface;",
            resolveDir: directory },
        write: false });
    const inputs = Object.keys(bundle.metafile!.inputs);
    Assert.ok(inputs.length > 0 && inputs.every((input: string) => !/react|jsx|Image|Spatial/iu.test(input)),
        `surfaces bundle without React, JSX or image modules: ${inputs.join(", ")}`);
    const sandbox: Record<string, unknown> = { console: undefined,
        process: undefined,
        require: undefined };
    runInNewContext(bundle.outputFiles[0].text, sandbox);
    const api = sandbox.api as typeof import("bedform/Canvas/Surface");
    const spawned: Array<string> = [];
    const colors: Array<import("bedform/Canvas/Surface").Rgba> = [];
    const variables = { setColorRGBA: (_name: string,
        color: import("bedform/Canvas/Surface").Rgba): void =>
    {
        colors.push(JSON.parse(JSON.stringify(color)));
    },
    setFloat: (): void => {},
    setVector3: (): void => {} };
    const rgb = { blue: 0.731,
        green: 0.287,
        red: 0.123 };
    const rgba = { ...rgb,
        alpha: 0.413 };
    for (const tint of [ undefined, api.DefaultTint, rgb, rgba ])
    {
        const report = api.Emit({ Content: api.Fill({ Height: 1,
            Width: 1,
            X: 0,
            Y: 0 }, tint),
        CreateVariables: () => variables,
        Dimension: "minecraft:overworld",
        Pose: { Orientation: "FaceViewer",
            Position: { x: 0,
                y: 0,
                z: 0 },
            Scale: 1 },
        Viewers: [ { dimension: { id: "minecraft:overworld" },
            getHeadLocation: () => ({ x: 0,
                y: 0,
                z: 2 }),
            id: "viewer",
            isValid: true,
            spawnParticle: (particle: string): void =>
            {
                spawned.push(particle);
            } } ] });
        // The report comes from the sandbox realm, so compare its JSON.
        Assert.equal(JSON.stringify(report.Viewers), JSON.stringify([ "viewer" ]));
    }

    Assert.deepEqual(spawned, Array(4).fill(api.Rectangle.Particle + api.OrientedSuffix));
    const gray = JSON.parse(JSON.stringify(api.DefaultTint));
    Assert.deepEqual(colors, [ gray, gray, { ...rgb,
        alpha: 1 }, rgba ]);
};
