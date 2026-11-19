/**
 * Qualifies general Canvas dependency detection, canonical packs, copy reuse and atomic publication.
 *
 * @module bedform/Test/CanvasPacks.test
 *
 * @file      CanvasPacks.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures preserve manifest grouping and contextual callbacks. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { build, type Metafile } from "esbuild";
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { strFromU8, unzipSync, zipSync } from "fflate";
import { Identity, Load, Select, UsesAssets, Dependency } from "../Distribution/Build/Canvas.js";
import { prepareBuild } from "../Distribution/Build/Settings.js";
import { buildAddon } from "../Distribution/Build/Addon.js";

const PackageRoot = fileURLToPath(new URL("../", import.meta.url));

/**
 * Creates an isolated owned directory with scoped cleanup.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Directory(context: TestContext): Promise<string>
{
    const root = await Fs.mkdtemp(Path.join(tmpdir(), "canvas-packs-"));
    context.after(async () =>
    {
        assert.ok(Path.resolve(root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(root, { force: true,
            recursive: true });
    });
    return root;
}

/**
 * Builds a small ordinary add-on without Intent initialization or a JSX compiler.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Fixture(context: TestContext)
{
    const root = await Directory(context);
    const behavior = Path.join(root, "behavior_packs/main");
    const resource = Path.join(root, "resource_packs/main");
    const script = Path.join(root, "Script/main.ts");
    await Fs.mkdir(behavior, { recursive: true });
    await Fs.mkdir(resource, { recursive: true });
    await Fs.mkdir(Path.dirname(script));
    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)), Path.join(root, "node_modules"), "junction");
    await Fs.writeFile(Path.join(root, "package.json"), "{\"name\":\"canvas-fixture\",\"type\":\"module\"}");
    await Fs.writeFile(Path.join(root, ".gitignore"), "/Intermediate/\ndist/\n");
    for (const [ directory, type, uuid, module ] of [
        [ behavior, "script", "720c08ac-1308-46bf-ad55-7bf1c831b7c7", "c53013f4-e336-4060-b5e9-a38943b76411" ],
        [ resource, "resources", "3b3e7491-cc2b-4d48-9c44-dc25c35c06ba", "ab94c305-12eb-4201-9b17-d6fcc9f8288f" ]
    ])
    {
        await Fs.writeFile(Path.join(directory, "manifest.json"), JSON.stringify({ format_version: 2,
            header: { name: "Fixture",
                description: "Canvas",
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

    await Fs.writeFile(script, "import { WithAssets } from \"bedform/Canvas/Dependency\"; Object.assign(globalThis,{value:WithAssets({custom:1})});");
    return { root,
        behavior,
        resource,
        script,
        run: async () => buildAddon(await prepareBuild({ root }, () => {})) };
}

test("surviving direct, root, namespace, dynamic and transitive uses enable assets; erased/dead helpers do not", async (context) =>
{
    const root = await Directory(context);
    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)), Path.join(root, "node_modules"), "junction");
    await Fs.writeFile(Path.join(root, "transitive.ts"), "export { Fill } from \"bedform/Canvas/Surface\";");
    const cases: Array<readonly [string, boolean]> = [
        [ "import { Start } from \"bedform/Spatial/Intent\"; globalThis.api=Start;", true ],
        [ "import { Spatial } from \"bedform\"; globalThis.api=Spatial.Intent.Builtin;", true ],
        [ "import * as Spatial from \"bedform/Spatial\"; globalThis.api=Spatial.Intent;", true ],
        [ "globalThis.load=()=>import(\"bedform/Spatial/Intent\");", true ],
        [ "import { Fill } from \"./transitive.ts\"; globalThis.fill=Fill;", true ],
        [ "import { WithAssets } from \"bedform/Canvas/Dependency\"; globalThis.api=WithAssets({future:\"vm-display\"});", true ],
        [ "import type { Connection } from \"bedform/Spatial/Intent\"; const x:Connection|null=null; globalThis.ok=x;", false ],
        [ "import { Start } from \"bedform/Spatial/Intent\"; if(false) Start(null); globalThis.ok=1;", false ],
        [ "import * as B from \"bedform\"; globalThis.ok=1;", false ],
        [ "import { FrameAt } from \"bedform/Canvas/Image\"; globalThis.frame=FrameAt;", false ],
        [ "import { LineWidth } from \"bedform/Spatial/Measurement\"; globalThis.width=LineWidth;", false ],
        [ "import { Tint } from \"bedform/Canvas/Surface\"; globalThis.tint=Tint;", false ],
        [ "import { WithAssets } from \"bedform/Canvas/Dependency\"; const unused=/* @__PURE__ */WithAssets({x:1}); globalThis.ok=1;", false ]
    ];
    for (const [ contents, expected ] of cases)
    {
        const result = await build({ absWorkingDir: root,
            bundle: true,
            format: "esm",
            platform: "neutral",
            metafile: true,
            stdin: { contents,
                loader: "ts",
                resolveDir: root },
            write: false });
        assert.equal(await UsesAssets(result.metafile!, root), expected, contents);
    }

    const marker = Path.join(PackageRoot, "Source/Canvas/Dependency.ts").replaceAll("\\", "/");
    const source = await build({ absWorkingDir: root,
        bundle: true,
        metafile: true,
        platform: "neutral",
        stdin: { contents: `import { WithAssets } from ${JSON.stringify(marker)}; globalThis.x=WithAssets(1);`,
            resolveDir: root },
        write: false });
    assert.equal(await UsesAssets(source.metafile!, root), true);
    const nested = Path.join(root, "library/node_modules/bedform");
    await Fs.mkdir(Path.join(nested, "Distribution/Canvas"), { recursive: true });
    await Fs.cp(Path.join(PackageRoot, "Distribution/Canvas/Dependency.js"),
        Path.join(nested, "Distribution/Canvas/Dependency.js"));
    await Fs.writeFile(Path.join(nested, "package.json"), JSON.stringify({ name: "bedform",
        type: "module",
        exports: { "./Canvas/Dependency": "./Distribution/Canvas/Dependency.js" } }));
    await Fs.writeFile(Path.join(root, "library/index.ts"),
        "import { WithAssets } from 'bedform/Canvas/Dependency'; export const value = WithAssets(1);");
    const transitive = await build({ absWorkingDir: root,
        bundle: true,
        metafile: true,
        platform: "neutral",
        stdin: { contents: "import { value } from './library/index.ts'; globalThis.value=value;",
            resolveDir: root },
        write: false });
    assert.equal(await UsesAssets(transitive.metafile!, root), true, "nested installed Bedform ownership");
    assert.equal(await UsesAssets({ outputs: { "out.js": { inputs: {
        [Path.join(root, "Source/Spatial/Intent.ts")]: { bytesInOutput: 100 }
    } } } } as unknown as Metafile, root), false, "lookalike consumer paths are not Bedform");
});

test("bundled Canvas artifact is package-relative, validates before staging and rejects corrupt contracts", async (context) =>
{
    const root = await Directory(context);
    await Fs.mkdir(Path.join(root, "Distribution/Build"), { recursive: true });
    await Fs.cp(Path.join(PackageRoot, "Distribution/Build/Canvas.js"), Path.join(root, "Distribution/Build/Canvas.js"));
    await Fs.writeFile(Path.join(root, "package.json"), "{\"type\":\"module\"}");
    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)), Path.join(root, "node_modules"), "junction");
    const isolated: typeof import("../Distribution/Build/Canvas.js") = await import(pathToFileURL(Path.join(root, "Distribution/Build/Canvas.js")).href);
    await assert.rejects(isolated.Load(), /Cannot load bundled BedformCanvas.*Reinstall/u);
    const bytes = await Fs.readFile(Path.join(PackageRoot, "Asset/bedform-canvas.mcaddon"));
    const outer = unzipSync(bytes);
    const bp = unzipSync(outer["bedform-canvas-bp.mcpack"]);
    const manifest = JSON.parse(strFromU8(bp["manifest.json"]));
    const malformed = (change: (value: typeof manifest) => void, files = bp) =>
    {
        const value = structuredClone(manifest);
        change(value);
        return zipSync({ ...outer,
            "bedform-canvas-bp.mcpack": zipSync({ ...files,
                "manifest.json": Buffer.from(JSON.stringify(value)) }) });
    };

    await Fs.mkdir(Path.join(root, "Asset"));
    const file = Path.join(root, "Asset/bedform-canvas.mcaddon");
    const missing = { ...bp };
    delete missing[manifest.modules[1].entry];
    for (const value of [ Buffer.from("corrupt"), zipSync({}), zipSync({ ...outer,
        "extra.mcpack": new Uint8Array() }),
    malformed((m) => { m.header.uuid = Identity.Resource; }),
    malformed((m) => { m.modules[1].version = [ 9, 0, 0 ]; }),
    malformed((m) => { m.dependencies[0].version = [ 9, 0, 0 ]; }),
    malformed((m) => { m.dependencies[1].version = "latest"; }),
    malformed(() => {}, missing),
    malformed(() => {}, { ...bp,
        "../escape": Buffer.from("bad") }) ])
    {
        await Fs.writeFile(file, value);
        await assert.rejects(isolated.Load(), /Cannot load bundled BedformCanvas/u);
    }

    await Fs.writeFile(file, bytes);
    const packs = await isolated.Load();
    assert.equal(packs.length, 2);
    const stage = Path.join(root, "stage");
    const archives = await isolated.Stage(stage, packs);
    for (const archive of archives)
    {
        assert.deepEqual(await Fs.readFile(archive), Buffer.from(outer[Path.basename(archive)]));
    }

    await assert.rejects(isolated.Stage(stage, packs), /EEXIST/u);
    await assert.rejects(isolated.Stage(Path.join(root, "cancelled"), packs, AbortSignal.abort()), /abort/iu);
});

test("matching dependencies are reused/deduplicated and unrelated metadata remains", async (context) =>
{
    const root = await Directory(context);
    const packs = await Load();
    const file = Path.join(root, "manifest.json");
    for (const target of packs)
    {
        const dependency = { uuid: target.Uuid.toUpperCase(),
            version: target.Version,
            extra: "retained" };
        const original = { header: { uuid: "consumer" },
            modules: [],
            extra: { retained: true },
            dependencies: [ { module_name: "@minecraft/server",
                version: "2.10.0" }, dependency, dependency ] };
        await Fs.writeFile(file, JSON.stringify(original));
        await Dependency(file, target.Kind, packs);
        assert.deepEqual(JSON.parse(await Fs.readFile(file, "utf8")), { ...original,
            dependencies: original.dependencies.slice(0, 2) });
        await Fs.writeFile(file, JSON.stringify({ ...original,
            dependencies: [ { uuid: target.Uuid,
                version: [ 99, 0, 0 ] } ] }));
        const before = await Fs.readFile(file);
        await assert.rejects(Dependency(file, target.Kind, packs), /Conflicting BedformCanvas/u);
        assert.deepEqual(await Fs.readFile(file), before);
    }
});

test("general marker builds include Canvas exactly once and preserve consumer sources; eliminated use omits it", async (context) =>
{
    const fixture = await Fixture(context);
    const bp = await Fs.readFile(Path.join(fixture.behavior, "manifest.json"));
    const rp = await Fs.readFile(Path.join(fixture.resource, "manifest.json"));
    const original = await Fs.readFile(fixture.script);
    const result = await fixture.run();
    const outer = unzipSync(await Fs.readFile(result.archive));
    for (const pack of await Load())
    {
        assert.deepEqual(outer[pack.Name], pack.Bytes);
        const consumer = unzipSync(outer[pack.Kind === "behavior_packs" ? "0-main.mcpack" : "1-main.mcpack"]);
        const manifest = JSON.parse(strFromU8(consumer["manifest.json"]));
        assert.equal(manifest.dependencies.filter((dependency: { uuid?: string }) => dependency.uuid === pack.Uuid).length, 1);
    }

    assert.equal(Object.keys(outer).length, 6);
    assert.deepEqual(await Fs.readFile(fixture.script), original);
    assert.deepEqual(await Fs.readFile(Path.join(fixture.behavior, "manifest.json")), bp);
    assert.deepEqual(await Fs.readFile(Path.join(fixture.resource, "manifest.json")), rp);
    await Fs.writeFile(fixture.script, "import { WithAssets } from \"bedform/Canvas/Dependency\"; const unused=/* @__PURE__ */WithAssets(1); Object.assign(globalThis,{ok:1});");
    const omitted = unzipSync(await Fs.readFile((await fixture.run()).archive));
    assert.equal(Object.keys(omitted).length, 4);
    assert.ok(!Object.hasOwn(omitted, "bedform-canvas-bp.mcpack"));
});

test("explicit Canvas dependencies include assets without any runtime module and version failures preserve output", async (context) =>
{
    const fixture = await Fixture(context);
    await Fs.writeFile(fixture.script, "Object.assign(globalThis,{ok:1});");
    const file = Path.join(fixture.resource, "manifest.json");
    const value = JSON.parse(await Fs.readFile(file, "utf8"));
    value.dependencies = [ { uuid: Identity.Resource,
        version: [ 1, 0, 0 ] } ];
    await Fs.writeFile(file, JSON.stringify(value));
    const result = await fixture.run();
    const before = await Fs.readFile(result.archive);
    assert.ok(unzipSync(before)["bedform-canvas-rp.mcpack"]);
    value.dependencies[0].version = [ 99, 0, 0 ];
    await Fs.writeFile(file, JSON.stringify(value));
    await assert.rejects(fixture.run(), /Conflicting BedformCanvas/u);
    assert.deepEqual(await Fs.readFile(result.archive), before);
});

test("canonical source pack copies are reused once; conflicting copied content and reserved UUIDs fail", async (context) =>
{
    const fixture = await Fixture(context);
    const copies: Array<string> = [];
    for (const pack of await Load())
    {
        for (const suffix of [ "one", "two" ])
        {
            const directory = Path.join(fixture.root, pack.Kind, "canvas-" + suffix);
            copies.push(directory);
            for (const [ file, bytes ] of Object.entries(pack.Files))
            {
                await Fs.mkdir(Path.dirname(Path.join(directory, file)), { recursive: true });
                await Fs.writeFile(Path.join(directory, file), bytes);
            }

            const file = Path.join(directory, "manifest.json");
            const manifest = JSON.parse(await Fs.readFile(file, "utf8"));
            manifest.header.uuid = manifest.header.uuid.toUpperCase();
            manifest.modules.reverse();
            for (const module of manifest.modules)
            {
                module.uuid = module.uuid.toUpperCase();
            }

            if (manifest.dependencies)
            {
                manifest.dependencies.reverse();
                for (const dependency of manifest.dependencies)
                {
                    if (dependency.uuid)
                    {
                        dependency.uuid = dependency.uuid.toUpperCase();
                    }
                }
            }

            await Fs.writeFile(file, JSON.stringify(manifest, null, 4));
        }
    }

    const result = await fixture.run();
    const before = await Fs.readFile(result.archive);
    assert.deepEqual(Object.keys(unzipSync(before)).sort(), [ "0-main.mcpack", "1-main.mcpack",
        "bedform-common-bp.mcpack", "bedform-common-rp.mcpack", "bedform-canvas-bp.mcpack", "bedform-canvas-rp.mcpack" ].sort());
    const canvasScripts = copies.filter((copy) => copy.includes("behavior_packs"))
        .map((copy) => Path.relative(fixture.root, Path.join(copy, "scripts/main.js")).replaceAll("\\", "/"));
    await Fs.writeFile(Path.join(fixture.root, "bedform.config.json"), JSON.stringify({ build: { scripts: [
        { entry: "Script/main.ts",
            output: "behavior_packs/main/scripts/main.js" },
        ...canvasScripts.map((file) => ({ entry: file,
            output: file }))
    ] } }));
    const mapped = await fixture.run();
    assert.equal(Object.keys(unzipSync(await Fs.readFile(mapped.archive))).length, 6);
    const mappedBefore = await Fs.readFile(mapped.archive);
    await Fs.writeFile(Path.join(copies[0], "unversioned-change.txt"), "authored change");
    await assert.rejects(fixture.run(), /UUID\/version\/content conflict/u);
    assert.deepEqual(await Fs.readFile(result.archive), mappedBefore);
    const manifest = JSON.parse(await Fs.readFile(Path.join(fixture.resource, "manifest.json"), "utf8"));
    manifest.modules[0].uuid = Identity.Script;
    await Fs.writeFile(Path.join(fixture.resource, "manifest.json"), JSON.stringify(manifest));
    await assert.rejects(Select([ { kind: "resource_packs",
        source: fixture.resource } ]), /reuses a BedformCanvas UUID/u);
    manifest.modules[0].uuid = "ordinary-module";
    manifest.dependencies = [ { uuid: Identity.Script,
        version: [ 1, 0, 0 ] } ];
    await Fs.writeFile(Path.join(fixture.resource, "manifest.json"), JSON.stringify(manifest));
    await assert.rejects(Select([ { kind: "resource_packs",
        source: fixture.resource } ]), /module UUID/u);
});

test("missing/corrupt required artifacts preserve the published archive while non-Canvas builds still work", async (context) =>
{
    const fixture = await Fixture(context);
    const isolated = Path.join(fixture.root, "isolated");
    await Fs.cp(Path.join(PackageRoot, "Distribution"), Path.join(isolated, "Distribution"), { recursive: true });
    await Fs.writeFile(Path.join(isolated, "package.json"), "{\"type\":\"module\"}");
    await Fs.mkdir(Path.join(isolated, "Asset"));
    await Fs.cp(Path.join(PackageRoot, "Asset/bedform-common.mcaddon"), Path.join(isolated, "Asset/bedform-common.mcaddon"));
    const canvas = Path.join(isolated, "Asset/bedform-canvas.mcaddon");
    await Fs.cp(Path.join(PackageRoot, "Asset/bedform-canvas.mcaddon"), canvas);
    const marker = Path.join(isolated, "Distribution/Canvas/Dependency.js").replaceAll("\\", "/");
    await Fs.writeFile(fixture.script, `import { WithAssets } from ${JSON.stringify(marker)}; globalThis.value=WithAssets(1);`);
    const installed: typeof import("../Distribution/Build/Addon.js") = await import(pathToFileURL(Path.join(isolated, "Distribution/Build/Addon.js")).href);
    const prepared = await prepareBuild({ root: fixture.root }, () => {});
    const result = await installed.buildAddon(prepared);
    const original = await Fs.readFile(result.archive);
    await Fs.rm(canvas, { force: true });
    await assert.rejects(installed.buildAddon(prepared), /workspace retained.*Cannot load bundled BedformCanvas/u);
    assert.deepEqual(await Fs.readFile(result.archive), original);
    await Fs.writeFile(canvas, "corrupt");
    await assert.rejects(installed.buildAddon(prepared), /workspace retained.*Cannot load bundled BedformCanvas/u);
    assert.deepEqual(await Fs.readFile(result.archive), original);
    await Fs.writeFile(fixture.script, "globalThis.ok=1;");
    assert.ok(!unzipSync(await Fs.readFile((await installed.buildAddon(prepared)).archive))["bedform-canvas-bp.mcpack"]);
});
