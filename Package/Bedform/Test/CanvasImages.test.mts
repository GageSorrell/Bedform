/**
 * Shared Canvas image configuration, PNG compilation, virtual modules and atomic add-on integration.
 *
 * @module bedform/Test/CanvasImages.test
 *
 * @file      CanvasImages.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain domain order and contextual callback typing. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef, @stylistic/max-len */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { test, type TestContext } from "node:test";
import { PNG } from "pngjs";
import { strFromU8, unzipSync } from "fflate";
import { runInNewContext } from "node:vm";
import { BedformConfig } from "../Distribution/Config.js";
import { Compile, Stage, ImageCatalog } from "../Distribution/Build/CanvasImages.js";
import { prepareBuild } from "../Distribution/Build/Settings.js";
import { buildAddon } from "../Distribution/Build/Addon.js";
import { FrameAt } from "../Distribution/Canvas/Image.js";
import { CheckDefinition } from "../Distribution/Spatial/Internal/IntentValue.js";

/**
 * Creates a config-relative project with a three-frame PNG, native manifests and strict TypeScript.
 *
 * @category Testing
 * @since 1.0.0
 */
async function Fixture(context: TestContext)
{
    const root = await Fs.mkdtemp(Path.join(tmpdir(), "canvas-images-"));
    context.after(async () =>
    {
        assert.ok(Path.resolve(root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(root, { recursive: true,
            force: true });
    });
    for (const directory of [ "Config", "Asset", "Script", "behavior_packs/main", "resource_packs/main" ])
    {
        await Fs.mkdir(Path.join(root, directory), { recursive: true });
    }

    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)),
        Path.join(root, "node_modules"), "junction");
    const png = new PNG({ width: 3,
        height: 6 });
    for (let index = 0; index < png.data.length; index += 4)
    {
        png.data.set([ 17, 37, 123, [ 0, 1, 128, 255 ][index / 4 % 4] ], index);
    }

    const bytes = PNG.sync.write(png);
    await Fs.writeFile(Path.join(root, "Asset/strip.png"), bytes);
    await Fs.writeFile(Path.join(root, "package.json"), JSON.stringify({ name: "@fixture/canvas-images",
        version: "1.2.3-alpha.1+test",
        type: "module",
        license: "MIT" }));
    await Fs.writeFile(Path.join(root, ".gitignore"), "/Intermediate/\ndist/\n");
    await Fs.writeFile(Path.join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        module: "NodeNext",
        target: "ES2022",
        strict: true,
        types: [],
        skipLibCheck: true
    },
    include: [ "Script/**/*.ts" ] }));
    await Fs.writeFile(Path.join(root, "Script/main.ts"), `
        import { Images } from "../generated/canvas/images.js";
        import type { ImageDescriptor } from "bedform/Canvas/Image";
        const image: ImageDescriptor = Images.Spinner;
        Object.assign(globalThis, { image, frozen: Object.isFrozen(Images) && Object.isFrozen(image) });
    `);
    for (const [ directory, type, uuid ] of [
        [ "behavior_packs/main", "script", "00394656-35f6-4010-8966-82d6d1484597" ],
        [ "resource_packs/main", "resources", "c2a32be5-fec4-4f45-8c5b-f19699546fdd" ]
    ])
    {
        await Fs.writeFile(Path.join(root, directory, "manifest.json"), JSON.stringify({ format_version: 2,
            header: { name: "Canvas fixture",
                description: "Fixture",
                uuid,
                version: [ 1, 0, 0 ],
                min_engine_version: [ 1, 26, 60 ] },
            modules: [ { type,
                uuid: type === "script" ? "00294656-35f6-4010-8966-82d6d1484597" : "c1a32be5-fec4-4f45-8c5b-f19699546fdd",
                version: [ 1, 0, 0 ],
                ...(type === "script" ? { language: "javascript",
                    entry: "scripts/main.js" } : {}) } ]
        }));
    }

    const canvas = { Namespace: "fixture",
        Images: [ { Name: "Spinner",
            Source: "../Asset/strip.png",
            FrameCount: 3,
            FrameTicks: 4 } ] };
    const config = Path.join(root, "Config/bedform.config.json");
    await Fs.writeFile(config, JSON.stringify({ Canvas: canvas }));
    const prepared = await prepareBuild({ root,
        config }, () => {});
    const settings = prepared.project.config.Canvas!;
    const resource = Path.join(root, "resource_packs/main");
    return { root,
        config,
        canvas,
        prepared,
        settings,
        resource,
        bytes,
        png };
}

test("Canvas schema validates registrations and resolves paths relative to JSON/TS config", async (context) =>
{
    const fixture = await Fixture(context);
    assert.equal(fixture.settings.Images[0].Source, Path.join(fixture.root, "Asset/strip.png"));
    assert.equal(fixture.prepared.project.input.Canvas!.Images[0].Source, "../Asset/strip.png");
    const ts = Path.join(fixture.root, "Config/bedform.config.ts");
    await Fs.writeFile(ts, `await Promise.resolve(); export default ${JSON.stringify({ Canvas: {
        ...fixture.canvas,
        ResourcePack: "../resource_packs/main"
    } })};`);
    const loaded = await prepareBuild({ root: fixture.root,
        config: ts }, () => {});
    assert.equal(loaded.project.config.Canvas!.ResourcePack, fixture.resource);
    assert.equal(loaded.project.config.Canvas!.Images[0].Source, fixture.settings.Images[0].Source);
    for (const change of [ { Namespace: "minecraft" }, { Namespace: "../bad" }, { Images: [] },
        { Images: [ { Name: "invalid-name",
            Source: "x.png" } ] },
        { Images: [ { Name: "Icon",
            Source: "x.png",
            FrameCount: 0 } ] },
        { Images: [ { Name: "Icon",
            Source: "x.png",
            FrameCount: 1.5 } ] },
        { Images: [ { Name: "Icon",
            Source: "x.png",
            FrameTicks: -1 } ] },
        { Images: [ { Name: "Icon",
            Source: "x.png",
            FrameTicks: "4" } ] },
        { Images: [ { Name: "Icon",
            Source: "x.png",
            Unexpected: true } ] }
    ])
    {
        assert.throws(() => BedformConfig({ Canvas: { ...fixture.canvas,
            ...change } } as never));
    }
});

test("compiler preserves RGBA/aspect, emits both particle variants and deterministic inert metadata", async (context) =>
{
    const fixture = await Fixture(context);
    const first = await Compile(fixture.settings, fixture.root, [ fixture.resource ]);
    const second = await Compile(fixture.settings, fixture.root, [ fixture.resource ]);
    assert.deepEqual([ ...first.Files ], [ ...second.Files ]);
    assert.equal(first.Catalog.contents, second.Catalog.contents);
    const descriptor = first.Images.Spinner;
    assert.deepEqual(CheckDefinition(descriptor), descriptor);
    assert.equal(descriptor.Width / descriptor.Height, 1.5);
    assert.equal(descriptor.FrameCount, 3);
    assert.equal(descriptor.FrameTicks, 4);
    const generated = PNG.sync.read(Buffer.from(first.Files.get("textures/fixture/canvas/images/spinner.png")!));
    assert.deepEqual(generated.data, fixture.png.data);
    for (const suffix of [ "", "_oriented" ])
    {
        const particle = JSON.parse(Buffer.from(first.Files.get(`particles/canvas/images/spinner${suffix}.json`)!).toString()).particle_effect;
        assert.equal(particle.description.identifier, descriptor.Particle + suffix);
        assert.equal(particle.components["minecraft:particle_lifetime_expression"].max_lifetime, 0.1);
        assert.deepEqual(particle.components["minecraft:particle_appearance_billboard"].uv,
            { texture_height: 6,
                texture_width: 3,
                uv: [ "variable.surface_u", "variable.surface_v" ],
                uv_size: [ "variable.surface_uv_width", "variable.surface_uv_height" ] });
        assert.equal(particle.components["minecraft:particle_appearance_billboard"].facing_camera_mode,
            suffix ? "direction_z" : "rotate_xyz");
    }

    assert.match(first.Catalog.contents, /@module @fixture\/canvas-images\/generated\/canvas\/images/u);
    assert.match(first.Catalog.contents, /@since 1\.2\.3\n/u);
    assert.doesNotMatch(first.Catalog.contents, /@since.*alpha|fetch\(|https:|import /u);
    assert.ok(first.Catalog.contents.includes("\n */\n\n/* eslint-disable */\n\n"));
    assert.equal(await Fs.readFile(Path.join(fixture.root, "Asset/strip.png")).then((bytes) => bytes.equals(fixture.bytes)), true);
});

test("default frames and elapsed phase match the shared descriptor contract", async (context) =>
{
    const fixture = await Fixture(context);
    const defaults = await Compile({ ...fixture.settings,
        Images: [ { Name: "Static",
            Source: fixture.settings.Images[0].Source } ] }, fixture.root, [ fixture.resource ]);
    assert.equal(defaults.Images.Static.FrameCount, 1);
    assert.equal(defaults.Images.Static.FrameTicks, 1);
    assert.equal(defaults.Images.Static.Height, 6);
    const compiled = await Compile(fixture.settings, fixture.root, [ fixture.resource ]);
    for (const [ ticks, index ] of [ [ 0, 0 ], [ 3, 0 ], [ 4, 1 ], [ 11, 2 ], [ 12, 0 ], [ 20, 2 ] ])
    {
        const frame = FrameAt(compiled.Images.Spinner, ticks);
        assert.equal(frame.Index, index);
        assert.equal(frame.V, index * 2);
    }

    assert.throws(() => FrameAt(compiled.Images.Spinner, -1), RangeError);
    assert.throws(() => FrameAt({ ...compiled.Images.Spinner,
        FrameCount: 0 }, 0), RangeError);
});

test("invalid PNGs, unequal frames, duplicate names, ambiguous destinations and links fail before writes", async (context) =>
{
    const fixture = await Fixture(context);
    const compile = (settings: BedformConfig.Canvas, resources = [ fixture.resource ]) => Compile(settings, fixture.root, resources);
    await assert.rejects(compile(fixture.settings, []), /ResourcePack/u);
    const other = Path.join(fixture.root, "resource_packs/other");
    await Fs.mkdir(other);
    await assert.rejects(compile(fixture.settings, [ fixture.resource, other ]), /explicitly/u);
    assert.equal((await compile({ ...fixture.settings,
        ResourcePack: other }, [ fixture.resource, other ])).ResourcePack, other);
    await assert.rejects(compile({ ...fixture.settings,
        ResourcePack: fixture.root }), /discovered/u);
    await assert.rejects(compile({ ...fixture.settings,
        Images: [ { ...fixture.settings.Images[0],
            FrameCount: 4 } ] }), /equal-height/u);
    await assert.rejects(compile({ ...fixture.settings,
        Images: [ fixture.settings.Images[0], fixture.settings.Images[0] ] }), /Duplicate/u);
    await assert.rejects(compile({ ...fixture.settings,
        Images: [ fixture.settings.Images[0], { ...fixture.settings.Images[0],
            Name: "SPINNER" } ] }), /Duplicate/u);
    const invalid = Path.join(fixture.root, "Asset/invalid.png");
    await Fs.writeFile(invalid, "not a PNG");
    await assert.rejects(compile({ ...fixture.settings,
        Images: [ { Name: "Bad",
            Source: invalid } ] }), /PNG/u);
    const link = Path.join(fixture.root, "Asset/link");
    await Fs.symlink(Path.join(fixture.root, "Config"), link, "junction");
    await assert.rejects(compile({ ...fixture.settings,
        Images: [ { Name: "Bad",
            Source: Path.join(link, "source.png") } ] }), /symlinks/u);
    await assert.rejects(Compile(fixture.settings, fixture.root, [ fixture.resource ], AbortSignal.abort()), /abort/iu);
    assert.equal(await Fs.stat(Path.join(fixture.root, "generated")).then(() => true, () => false), false);
});

test("authored virtual modules, textures and identifiers are protected across all resource packs", async (context) =>
{
    const fixture = await Fixture(context);
    const catalog = Path.join(fixture.root, ImageCatalog);
    await Fs.mkdir(Path.dirname(catalog), { recursive: true });
    await Fs.writeFile(catalog.replace(/\.ts$/u, ".d.ts"), "// authored\n");
    await assert.rejects(Compile(fixture.settings, fixture.root, [ fixture.resource ]), /virtual image module/u);
    await Fs.rm(catalog.replace(/\.ts$/u, ".d.ts"), { force: true });
    const particle = Path.join(fixture.resource, "particles/authored.json");
    await Fs.mkdir(Path.dirname(particle));
    await Fs.writeFile(particle, "{ /* JSONC */ \"particle_effect\": {\"description\": {\"identifier\": \"fixture:canvas_image_spinner_oriented\"}}}");
    await assert.rejects(Compile(fixture.settings, fixture.root, [ fixture.resource ]), /identifier collides/u);
    await Fs.writeFile(particle, "{ /* \"identifier\": \"fixture:canvas_image_spinner\" */ \"particle_effect\": {\"description\": {\"identifier\": \"fixture:unrelated\"}}}");
    const second = Path.join(fixture.root, "resource_packs/second");
    const texture = Path.join(second, "textures/fixture/canvas/images/spinner.png");
    await Fs.mkdir(Path.dirname(texture), { recursive: true });
    await Fs.writeFile(texture, fixture.bytes);
    await assert.rejects(Compile({ ...fixture.settings,
        ResourcePack: fixture.resource }, fixture.root,
    [ fixture.resource, second ]), /collides with authored/u);
    assert.ok((await Fs.readFile(texture)).equals(fixture.bytes));
});

test("real build typechecks and bundles virtual descriptors without mutating sources; failed rebuild preserves archive", async (context) =>
{
    const fixture = await Fixture(context);
    const originals = await Promise.all([ "Asset/strip.png", "Script/main.ts", "Config/bedform.config.json", "resource_packs/main/manifest.json", ".gitignore" ]
        .map(async (file) => [ file, await Fs.readFile(Path.join(fixture.root, file)) ] as const));
    const result = await buildAddon(fixture.prepared);
    const bytes = await Fs.readFile(result.archive);
    const outer = unzipSync(bytes);
    const behavior = unzipSync(outer["0-main.mcpack"]);
    const resource = unzipSync(outer["1-main.mcpack"]);
    const sandbox: Record<string, unknown> = { fetch: undefined,
        process: undefined,
        require: undefined,
        setTimeout: undefined,
        TextEncoder: undefined };
    runInNewContext(strFromU8(behavior["scripts/main.js"]), sandbox);
    assert.equal(sandbox.frozen, true);
    assert.equal((sandbox.image as { Height: number }).Height, 2);
    assert.ok(resource["textures/fixture/canvas/images/spinner.png"]);
    assert.ok(resource["particles/canvas/images/spinner_oriented.json"]);
    const retained = await Fs.readFile(Path.join(result.workspace, "canvas/images.ts"), "utf8");
    assert.equal(retained, (await Compile(fixture.settings, fixture.root, [ fixture.resource ])).Catalog.contents);
    for (const [ file, before ] of originals)
    {
        assert.deepEqual(await Fs.readFile(Path.join(fixture.root, file)), before);
    }

    assert.equal(await Fs.stat(Path.join(fixture.root, "generated/canvas/images.ts")).then(() => true, () => false), false);
    await Fs.appendFile(Path.join(fixture.root, "Script/main.ts"), "\nconst invalid: number = Images.Spinner.Kind;\n");
    await assert.rejects(buildAddon(fixture.prepared), /not assignable/u);
    assert.deepEqual(await Fs.readFile(result.archive), bytes);
});

test("staging rejects overlapping compiler outputs and unsafe paths", async (context) =>
{
    const fixture = await Fixture(context);
    const compiled = await Compile(fixture.settings, fixture.root, [ fixture.resource ]);
    const workspace = Path.join(fixture.root, "Intermediate/test");
    const resource = Path.join(workspace, "resource");
    await Stage(compiled, resource, workspace);
    await assert.rejects(Stage(compiled, resource, workspace), /without overwriting/u);
    await assert.rejects(Stage({ ...compiled,
        Files: new Map([ [ "../escape", Buffer.from("bad") ] ]) },
    resource, workspace), /Unsafe/u);
});

test("Physics and Canvas catalogs coexist in TypeScript and bundling with separate virtual identities", async (context) =>
{
    const fixture = await Fixture(context);
    await Fs.writeFile(Path.join(fixture.resource, "texture.png"), fixture.bytes);
    await Fs.writeFile(Path.join(fixture.resource, "model.json"), JSON.stringify({ "minecraft:geometry": [
        { description: { identifier: "geometry.box" },
            bones: [ { name: "root",
                cubes: [ { origin: [ 0, 0, 0 ],
                    size: [ 16, 16, 16 ] } ] } ] }
    ] }));
    await Fs.writeFile(fixture.config, JSON.stringify({ Canvas: fixture.canvas,
        Physics: {
            schemaVersion: 1,
            namespace: "fixture",
            behaviorPack: "../behavior_packs/main",
            resourcePack: "../resource_packs/main",
            models: [ { name: "box",
                representation: "cuboid",
                geometry: "model.json",
                geometryIdentifier: "geometry.box",
                textures: { default: "texture" },
                materials: { default: "entity_alphatest" } } ]
        } }));
    await Fs.appendFile(Path.join(fixture.root, "Script/main.ts"), `
        import { Models } from "../generated/physics/catalog/models.js";
        Object.assign(globalThis, { model: Models.box.identifier });
    `);
    const result = await buildAddon(await prepareBuild({ root: fixture.root,
        config: fixture.config }, () => {}));
    const behavior = unzipSync(unzipSync(await Fs.readFile(result.archive))["0-main.mcpack"]);
    const sandbox: Record<string, unknown> = {};
    runInNewContext(strFromU8(behavior["scripts/main.js"]), sandbox);
    assert.equal((sandbox.image as { Height: number }).Height, 2);
    assert.equal(sandbox.model, "fixture:physics_box");
});
