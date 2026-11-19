/**
 * Bedrock adapter contract checks with a player-restrictive engine stub.
 *
 * @module bedform/Test/PhysicsBedrock.test
 *
 * @file      PhysicsBedrock.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Engine fixtures retain contextual vector ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import * as B from "bedform/AABB";
import * as V from "bedform/Vector3";

test("player corrections omit keepVelocity and restore native velocity only after successful movement", async () =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-adapter-"));
    const Key = "__bedformPhysicsAdapterTest";
    const Globals = globalThis as unknown as Record<string, unknown>;
    const Previous = Object.getOwnPropertyDescriptor(Globals, Key);
    let velocity = { x: 0.1,
        y: 0.2,
        z: -0.3 };
    const Original = { ...velocity };
    let succeed = true;
    const Calls: Array<Record<string, unknown>> = [];
    const Impulses: Array<unknown> = [];
    const Player = { id: "player",
        typeId: "minecraft:player",
        location: { x: 0,
            y: 1,
            z: 0 },
        hasComponent: () => true,
        getAABB: () => ({ center: { x: 0,
            y: 1.9,
            z: 0 },
        extent: { x: 0.3,
            y: 0.9,
            z: 0.3 } }),
        getVelocity: () => ({ ...velocity }),
        tryTeleport: (_target: unknown, options: Record<string, unknown>) =>
        {
            Calls.push(options);
            Assert.ok(!Object.hasOwn(options, "keepVelocity"));
            if (succeed)
            {
                velocity = { x: 0,
                    y: 0,
                    z: 0 };
            }

            return succeed;
        },
        applyImpulse: (delta: typeof velocity) =>
        {
            Impulses.push(delta);
            velocity = { x: velocity.x + delta.x,
                y: velocity.y + delta.y,
                z: velocity.z + delta.z };
        } };
    try
    {
        Globals[Key] = { world: { getDimension: () => ({ getEntities: () => [ Player ] }) } };
        const File = Path.join(Root, "adapter.mjs");
        await build({ entryPoints: [ fileURLToPath(new URL("../Source/Internal/PhysicsBedrock.ts", import.meta.url)) ],
            outfile: File,
            bundle: true,
            format: "esm",
            platform: "node",
            target: "es2022",
            plugins: [ { name: "mock-bedrock",
                setup: (builder) =>
                {
                    builder.onResolve({ filter: new RegExp("^@minecraft/server$") }, () => ({ path: "engine",
                        namespace: "mock" }));
                    builder.onLoad({ filter: new RegExp(".*"),
                        namespace: "mock" }, () => ({ contents: `export const world=globalThis.${Key}.world;export const system={};`,
                        loader: "js" }));
                } } ] });
        const Adapter = await import(pathToFileURL(File).href);
        const Host = Adapter.makeHost({ namespace: "test",
            dimensions: [ "overworld" ] });
        const Native = Host.native.query("overworld", B.AABBUnsafe(V.Vector3Unsafe(-1, 0, -1), V.Vector3Unsafe(1, 3, 1)))[0];
        Assert.ok(Native.move(V.UnitX));
        Assert.deepEqual(velocity, Original);
        Assert.equal(Impulses.length, 1);
        Assert.equal(Calls[0].checkForBlocks, true);
        succeed = false;
        Assert.equal(Native.move(V.UnitX), false);
        Assert.equal(Impulses.length, 1);
        Assert.deepEqual(velocity, Original);
    }
    finally
    {
        if (Previous)
        {Object.defineProperty(Globals, Key, Previous);}
        else
        {delete Globals[Key];}

        Assert.equal(Path.dirname(Path.resolve(Root)), Path.resolve(tmpdir()));
        Assert.ok(Path.basename(Root).startsWith("bedform-adapter-"));
        await Fs.rm(Root, { recursive: true,
            force: true });
    }
});
