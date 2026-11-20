/**
 * Qualifies Spatial React TSX, mapped outputs and shared Canvas descriptors in installed CLI archives.
 *
 * @module bedform/Test/SpatialBuildPacked
 *
 * @file      SpatialBuildPacked.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Consumer fixtures retain manifest grouping and contextual inference. */
/* eslint-disable sort-imports, sort-keys */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { strFromU8, unzipSync } from "fflate";
import { tmpdir } from "node:os";

/**
 * Builds a consumer from its independent installed package using both automatic JSX transforms.
 * Every script is read from its actual manifest entry in the official staged archive.
 *
 * @throws { Error } If compilation, runtime execution or source/output isolation fails.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function VerifyPackedSpatialBuild(directory: string): Promise<void>
{
    const root = Path.join(directory, "spatial-build");
    for (const folder of [ "Script", "Assets", "settings", "behavior_packs/main", "resource_packs/main",
        "node_modules/@bedrock-core/ui" ])
    {
        await Fs.mkdir(Path.join(root, folder), { recursive: true });
    }

    const write = async (name: string, value: unknown): Promise<void> =>
    {
        await Fs.writeFile(Path.join(root, name), typeof value === "string" ? value : JSON.stringify(value));
    };

    await write("package.json", { name: "spatial-build-consumer",
        type: "module",
        version: "1.0.0" });
    await write("settings/typescript.base.json", { compilerOptions: { target: "ES2022",
        lib: [ "ES2022" ],
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        types: [],
        paths: { "fixture-part": [ "../Script/part.tsx" ] } } });
    await write("tsconfig.json", { extends: "./settings/typescript.base.json",
        compilerOptions: {
            jsx: "preserve",
            jsxImportSource: "deliberately-wrong-project-default" },
        include: [ "Script/**/*.ts", "Script/**/*.tsx" ] });
    const png = new PNG({ width: 4,
        height: 6 });
    png.data.fill(255);
    png.data[3] = 128;
    const pixels = PNG.sync.write(png);
    await Fs.writeFile(Path.join(root, "Assets/strip.png"), pixels);
    const originalManifest = { format_version: 2,
        header: { name: "Spatial consumer",
            description: "Installed CLI JSX qualification",
            uuid: "263fbac5-ce17-428e-8ca1-18d70bbbef91",
            version: [ 1, 0, 0 ],
            min_engine_version: [ 1, 26, 60 ] },
        modules: [ { type: "script",
            language: "javascript",
            uuid: "63f806db-cfce-4a42-990f-ef7ebf29be91",
            version: [ 1, 0, 0 ],
            entry: "scripts/main.js" } ] };
    await write("behavior_packs/main/manifest.json", originalManifest);
    await write("resource_packs/main/manifest.json", { format_version: 2,
        header: { name: "Spatial resources",
            description: "Image overlay",
            uuid: "223fbac5-ce17-428e-8ca1-18d70bbbef91",
            version: [ 1, 0, 0 ],
            min_engine_version: [ 1, 26, 60 ] },
        modules: [ { type: "resources",
            uuid: "23f806db-cfce-4a42-990f-ef7ebf29be91",
            version: [ 1, 0, 0 ] } ] });
    const config = { Canvas: { Namespace: "spatial_fixture",
        Images: [ {
            Name: "Spinner",
            Source: "../Assets/strip.png",
            FrameCount: 3,
            FrameTicks: 4
        } ] } };
    await write("settings/project.json", config);
    await write("settings/project.ts", `export default ${JSON.stringify(config)};`);
    // A separate engine fixture proves per-file overrides in types and runtime, without adding React.
    await write("node_modules/@bedrock-core/ui/package.json", { name: "@bedrock-core/ui",
        type: "module",
        exports: { "./jsx-runtime": { types: "./runtime.d.ts",
            import: "./runtime.js" },
        "./jsx-dev-runtime": { types: "./runtime.d.ts",
            import: "./runtime.js" } } });
    await write("node_modules/@bedrock-core/ui/runtime.d.ts", `
        export namespace JSX {
            export interface Element { readonly Engine: "override"; readonly Development: boolean; }
            export interface IntrinsicElements { external: { value: number }; }
        }
        export function jsx(type: string, props: unknown): JSX.Element;
        export const jsxs: typeof jsx;
        export const jsxDEV: typeof jsx;
    `);
    await write("node_modules/@bedrock-core/ui/runtime.js", `
        export const jsx = () => ({Engine:"override", Development:false});
        export const jsxs = jsx;
        export const jsxDEV = () => ({Engine:"override", Development:true});
    `);
    await write("Script/external.tsx", `/** @jsxImportSource @bedrock-core/ui */
        export const external = <external value={7} />;
        // @ts-expect-error The per-file engine has its own prop contract.
        const wrong = <external value="bad" />;
        void wrong;
    `);
    await write("Script/part.tsx", `
        import { Image, Text } from "bedform/Spatial/Components";
        import { Images } from "../generated/canvas/images.js";
        export const part = <Image Source={Images.Spinner} />;
        export const caption = <Text>Spinner</Text>;
    `);
    const entry = `
        import { View, Panel } from "bedform/Spatial/Components";
        import { isValidElement } from "bedform/Spatial/React";
        import { FrameAt } from "bedform/Canvas/Image";
        import { Images } from "../generated/canvas/images.js";
        import { part, caption } from "fixture-part";
        import { external } from "./external.js";
        const tree = <View Dimension="minecraft:overworld">{part}{caption}</View>;
        // @ts-expect-error Display text must be wrapped in Text.
        const wrong = <Panel>bare</Panel>;
        void wrong;
        Object.assign(globalThis, { spatialBuildProof: {
            Valid: isValidElement(tree), SameImage: part.props.Source === Images.Spinner,
            Image: Images.Spinner, Frame: FrameAt(Images.Spinner, 5), External: external,
            View: tree.type === View, Text: caption.props.children
        }});
    `;
    await write("Script/main.tsx", entry);
    const cli = Path.join(directory, "node_modules/bedform/Distribution/Bin.js");
    const archive = Path.join(root, "spatial.mcaddon");
    const run = (development: boolean, extension: string): Buffer => execFileSync(process.execPath,
        [ cli, "build", root, "--config", `settings/project.${extension}`, "--out", "spatial.mcaddon",
            ...development ? [ "--development" ] : [] ], { cwd: tmpdir(),
            encoding: "buffer" });
    for (const development of [ false, true ])
    {
        for (const extension of [ "json", "ts" ])
        {
            run(development, extension);
            const outer = unzipSync(await Fs.readFile(archive));
            const behavior = unzipSync(outer["0-main.mcpack"]);
            const resource = unzipSync(outer["1-main.mcpack"]);
            const manifest = JSON.parse(strFromU8(behavior["manifest.json"]));
            const output = manifest.modules[0].entry;
            assert.equal(output, "scripts/main.js");
            const code = strFromU8(behavior[output]);
            assert.doesNotMatch(code, /node:|require\(|from ["'](?:bedform|effect)|BedformDDUIStrict/u);
            const realm: Record<string, unknown> = {};
            for (const name of [ "process", "require", "Buffer", "fetch", "setTimeout", "setInterval",
                "window", "document", "performance", "TextEncoder" ])
            {
                Object.defineProperty(realm, name, { get: (): never =>
                {
                    throw new Error(`Unexpected host access ${name}`);
                } });
            }

            runInNewContext(code, realm);
            const proof = realm.spatialBuildProof as Record<string, unknown>;
            assert.equal(proof.Valid, true);
            assert.equal(proof.View, true);
            assert.equal(proof.Text, "Spinner");
            assert.equal(proof.SameImage, true);
            assert.equal(JSON.stringify(proof.External), JSON.stringify({ Engine: "override",
                Development: development }));
            assert.equal(JSON.stringify(proof.Frame), JSON.stringify({ Height: 2,
                Index: 1,
                U: 0,
                V: 2,
                Width: 4 }));
            const texture = resource["textures/spatial_fixture/canvas/images/spinner.png"];
            assert.deepEqual(PNG.sync.read(Buffer.from(texture)).data, png.data);
            const textures = Object.keys(resource).filter((name: string) => name.endsWith("/spinner.png"));
            assert.equal(textures.length, 1);
            assert.ok(resource["particles/canvas/images/spinner_oriented.json"]);
            assert.ok(Object.keys(behavior).every((name: string) => !/\.tsx?$/u.test(name)));
        }
    }

    const before = await Fs.readFile(archive);
    await write("Script/main.ts", "throw new Error('ambiguous entry must never execute');");
    const ambiguous = spawnSync(process.execPath, [ cli, "build", root, "--out", "spatial.mcaddon",
        "--config", "settings/project.json" ], { cwd: tmpdir(),
        encoding: "utf8" });
    assert.equal(ambiguous.status, 1);
    assert.match(ambiguous.stderr, /Ambiguous script entries/u);
    assert.deepEqual(await Fs.readFile(archive), before);
    await write("settings/project.json", { ...config,
        build: { scripts: [ {
            entry: "../Script/main.tsx",
            output: "../behavior_packs/main/scripts/main.js"
        } ] } });
    run(false, "json");
    await Fs.rm(Path.join(root, "Script/main.ts"));
    await write("Script/imported.tsx", entry);
    await Fs.rm(Path.join(root, "Script/main.tsx"));
    await write("Script/main.ts", "import './imported.js';");
    await write("settings/project.json", config);
    run(false, "json");
    const imported = unzipSync(unzipSync(await Fs.readFile(archive))["0-main.mcpack"]);
    const importedRealm: Record<string, unknown> = {};
    runInNewContext(strFromU8(imported["scripts/main.js"]), importedRealm);
    assert.equal((importedRealm.spatialBuildProof as Record<string, unknown>).SameImage, true);
    await Fs.rm(Path.join(root, "Script/main.ts"));
    await Fs.rm(Path.join(root, "Script/imported.tsx"));
    await write("Script/main.tsx", entry);
    const mappedManifest = { ...originalManifest,
        modules: [ { ...originalManifest.modules[0],
            entry: "custom/widget.js" }, { ...originalManifest.modules[0],
            uuid: "a3f806db-cfce-4a42-990f-ef7ebf29be91",
            entry: "custom/secondary.js" } ] };
    await write("behavior_packs/main/manifest.json", mappedManifest);
    await write("settings/project.json", { ...config,
        build: { scripts: [ {
            entry: "../Script/main.tsx",
            output: "../behavior_packs/main/custom/widget.js"
        }, { entry: "../Script/part.tsx",
            output: "../behavior_packs/main/custom/secondary.js" } ] } });
    run(true, "json");
    const mapped = unzipSync(unzipSync(await Fs.readFile(archive))["0-main.mcpack"]);
    const manifest = JSON.parse(strFromU8(mapped["manifest.json"]));
    for (const module of manifest.modules)
    {
        assert.ok(mapped[module.entry], `Missing manifest output ${module.entry}`);
    }

    assert.ok(!mapped["scripts/main.js"]);
    assert.equal(await Fs.readFile(Path.join(root, "Script/main.tsx"), "utf8"), entry);
    assert.deepEqual(await Fs.readFile(Path.join(root, "Assets/strip.png")), pixels);
    assert.deepEqual(JSON.parse(await Fs.readFile(Path.join(root, "behavior_packs/main/manifest.json"),
        "utf8")), mappedManifest);
    await assert.rejects(Fs.stat(Path.join(root, "generated")), /ENOENT/u);
}
