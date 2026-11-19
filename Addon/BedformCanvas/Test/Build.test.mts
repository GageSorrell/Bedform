/**
 * Qualifies Canvas pack identities, isolated reproducibility and failure-safe publication.
 *
 * @module bedform-canvas/Test/Build.test
 *
 * @file      Build.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { Build } from "../Tool/Build.mts";
import type { Dirent } from "node:fs";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Execute = promisify(execFile);

/**
 * Copies only build inputs, independently of dist outputs or an installed client.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Snapshot(directory: string): Promise<string>
{
    await mkdir(directory, { recursive: true });
    for (const name of [ "Assets", "Public", "Script", "behavior_packs", "resource_packs", "package.json",
        "License.txt" ])
    {
        await cp(path.join(Root, name), path.join(directory, name), { force: true,
            recursive: true });
    }

    return directory;
}

test("isolated builds pin identities, versions, notices and script configuration", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-"));
    try
    {
        const firstSource = await Snapshot(path.join(directory, "first"));
        const secondSource = await Snapshot(path.join(directory, "second"));
        await utimes(path.join(secondSource, "Script/Main.ts"), new Date(0), new Date(0));
        const first = await readFile(await Build(path.join(directory, "out-first"), firstSource));
        const second = await readFile(await Build(path.join(directory, "out-second"), secondSource));
        assert.deepEqual(first, second);
        const addon = unzipSync(first);
        assert.deepEqual(Object.keys(addon), [ "bedform-canvas-bp.mcpack", "bedform-canvas-rp.mcpack" ]);
        const bp = unzipSync(addon["bedform-canvas-bp.mcpack"]);
        const rp = unzipSync(addon["bedform-canvas-rp.mcpack"]);
        assert.deepEqual(Object.keys(bp), [ "AssetProvenance.md", "License.txt", "manifest.json",
            "scripts/main.js" ]);
        // Every authored or generated resource file is packed, plus the two generated notices.
        const authored = (await readdir(path.join(firstSource, "resource_packs/bedform_canvas"),
            { recursive: true,
                withFileTypes: true })).filter((entry: Dirent) => entry.isFile())
            .map((entry: Dirent) => path.relative(path.join(firstSource, "resource_packs/bedform_canvas"),
                path.join(entry.parentPath, entry.name)).replaceAll("\\", "/"));
        assert.deepEqual(Object.keys(rp), [ ...authored, "AssetProvenance.md", "License.txt" ].sort());
        assert.ok(Object.keys(rp).includes("font/glyph_E2.png"));
        const identities: Array<string> = [];
        for (const [ files, kind, types ] of [ [ bp, "behavior_packs", [ "data", "script" ] ],
            [ rp, "resource_packs", [ "resources" ] ] ] as const)
        {
            const authored = await readFile(path.join(Root, kind, "bedform_canvas/manifest.json"));
            assert.deepEqual(Buffer.from(files["manifest.json"]), authored);
            const manifest = JSON.parse(authored.toString());
            assert.deepEqual(manifest.modules.map((entry: { type: string }) => entry.type), types);
            for (const entry of [ manifest.header, ...manifest.modules ])
            {
                identities.push(entry.uuid);
                assert.deepEqual(entry.version, [ 1, 0, 0 ]);
            }

            assert.deepEqual(Buffer.from(files["License.txt"]),
                await readFile(path.join(Root, "License.txt")));
            assert.deepEqual(Buffer.from(files["AssetProvenance.md"]),
                await readFile(path.join(Root, "Assets/ReadMe.md")));
        }

        assert.deepEqual(identities, [ "c9d18475-cf4a-4ae1-bf29-2154f9e7c10a",
            "abfd850a-2928-4d67-b16b-5cf387b1973d", "e96cb050-1354-44fd-871d-096e14bf8295",
            "5cb152c6-0965-4e0a-9870-0e0bebca1398", "850c8f8a-aa4c-4464-bc5e-0f14d1ba67dc" ]);
        const behavior = JSON.parse(Buffer.from(bp["manifest.json"]).toString());
        assert.deepEqual(behavior.dependencies, [ { uuid: identities[3],
            version: [ 1, 0, 0 ] }, { module_name: "@minecraft/server",
            version: "2.10.0" } ]);
        assert.equal(behavior.modules[1].entry, "scripts/main.js");
        assert.equal(behavior.modules[1].language, "javascript");
        // The entry imports only @minecraft/server and installs exactly the Intent service listeners.
        const script = Buffer.from(bp["scripts/main.js"]).toString();
        const imports = [ ...script.matchAll(/from\s*"([^"]+)"/gu) ];
        assert.deepEqual(imports.map((match: RegExpExecArray) => match[1]), [ "@minecraft/server" ]);
        const subscriptions: Array<string> = [];
        (globalThis as Record<string, unknown>).CanvasStubSubscriptions = subscriptions;
        const stub = [ "const s = globalThis.CanvasStubSubscriptions;",
            "const signal = (name) => ({ subscribe: (callback) => { s.push(name); return callback; },",
            "unsubscribe: () => {} });",
            "export const world = { getEntity: () => undefined, afterEvents: { entityDie: signal(\"die\"),",
            "playerLeave: signal(\"leave\") }, getAllPlayers: () => [] };",
            "export class TextPrimitive {}; export class MolangVariableMap {};",
            "export const system = { currentTick: 0, clearRun() {}, runInterval() { return 1; },",
            "runTimeout() { return 0; },",
            "sendScriptEvent() {}, afterEvents: { scriptEventReceive: signal(\"script\") } };" ].join("\n");
        const linked = script.replace(/from\s*"@minecraft\/server"/u,
            `from "data:text/javascript;base64,${Buffer.from(stub).toString("base64")}"`);
        await import(`data:text/javascript;base64,${Buffer.from(linked).toString("base64")}`);
        assert.deepEqual(subscriptions.sort(), [ "die", "leave", "script" ]);
        assert.deepEqual(await readdir(path.join(firstSource, "behavior_packs/bedform_canvas")),
            [ "manifest.json" ]);
        assert.deepEqual(await readdir(path.join(directory, "out-first")), [ "bedform-canvas.mcaddon" ]);
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("archive bytes do not depend on timezone or working directory", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-time-"));
    try
    {
        const source = await Snapshot(path.join(directory, "source"));
        const module = new URL("../Tool/Build.mts", import.meta.url).href;
        const script = `import { Build } from ${JSON.stringify(module)}; ` +
            "await Build(process.argv[1], process.argv[2]);";
        const outputs: Array<Buffer> = [];
        for (const timezone of [ "UTC", "Pacific/Honolulu" ])
        {
            const output = path.join(directory, timezone.replaceAll("/", "-"));
            await Execute(process.execPath, [ "--import", import.meta.resolve("tsx"), "--input-type=module",
                "-e", script, output, source ], { cwd: directory,
                env: { ...process.env,
                    TZ: timezone } });
            outputs.push(await readFile(path.join(output, "bedform-canvas.mcaddon")));
        }

        assert.deepEqual(outputs[0], outputs[1]);
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("nested assets and upstream notices are included byte for byte", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-assets-"));
    try
    {
        const source = await Snapshot(path.join(directory, "source"));
        const pack = path.join(source, "resource_packs/bedform_canvas");
        await mkdir(path.join(pack, "textures/canvas"), { recursive: true });
        const pixels = Uint8Array.from([ 0, 255, 127, 32 ]);
        await writeFile(path.join(pack, "textures/canvas/fixture.bin"), pixels);
        await writeFile(path.join(pack, "License.Upstream.txt"), "Fixture upstream attribution\n");
        const addon = unzipSync(await readFile(await Build(path.join(directory, "out"), source)));
        const rp = unzipSync(addon["bedform-canvas-rp.mcpack"]);
        assert.deepEqual(rp["textures/canvas/fixture.bin"], pixels);
        assert.equal(Buffer.from(rp["License.Upstream.txt"]).toString(), "Fixture upstream attribution\n");
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("invalid metadata, runtime and notice collisions preserve the last successful artifact", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-invalid-"));
    try
    {
        const source = await Snapshot(path.join(directory, "source"));
        const output = path.join(directory, "out");
        const original = await readFile(await Build(output, source));
        const manifestFile = path.join(source, "behavior_packs/bedform_canvas/manifest.json");
        const originalManifest = await readFile(manifestFile);
        for (const change of [ "version", "uuid", "entry", "dependency" ])
        {
            const manifest = JSON.parse(originalManifest.toString());
            if (change === "version")
            {
                manifest.header.version = [ 1, 0, 1 ];
            }

            if (change === "uuid")
            {
                manifest.modules[0].uuid = manifest.header.uuid;
            }

            if (change === "entry")
            {
                manifest.modules[1].entry = "missing.js";
            }

            if (change === "dependency")
            {
                manifest.dependencies[0].version = [ 2, 0, 0 ];
            }

            await writeFile(manifestFile, JSON.stringify(manifest));
            await assert.rejects(Build(output, source));
            assert.deepEqual(await readFile(path.join(output, "bedform-canvas.mcaddon")), original);
        }

        await writeFile(manifestFile, originalManifest);
        const main = path.join(source, "Script/Main.ts");
        const originalMain = await readFile(main);
        await writeFile(main, "import 'node:fs';");
        await assert.rejects(Build(output, source), /Could not resolve "node:fs"/u);
        await writeFile(main, originalMain);
        const collision = path.join(source, "resource_packs/bedform_canvas/License.txt");
        await writeFile(collision, "Do not overwrite me.");
        await assert.rejects(Build(output, source), /notice conflicts/u);
        assert.equal(await readFile(collision, "utf8"), "Do not overwrite me.");
        assert.deepEqual(await readFile(path.join(output, "bedform-canvas.mcaddon")), original);
        assert.deepEqual(await readdir(output), [ "bedform-canvas.mcaddon" ]);
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("pack directory indirection is rejected", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-link-"));
    try
    {
        const source = await Snapshot(path.join(directory, "source"));
        const external = path.join(directory, "external");
        await mkdir(external);
        await writeFile(path.join(external, "outside.txt"), "Do not package outside files.");
        await symlink(external, path.join(source, "resource_packs/bedform_canvas/linked"),
            process.platform === "win32" ? "junction" : "dir");
        await assert.rejects(Build(path.join(directory, "out"), source), /Unsupported Canvas pack entry/u);
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});
