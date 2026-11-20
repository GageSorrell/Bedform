/**
 * Isolated published-consumer and restricted-host verification.
 *
 * @module bedform/Test/Consumer.test
 *
 * @file      Consumer.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { strFromU8, unzipSync } from "fflate";
import Assert from "node:assert/strict";
import { VerifyPackedCanvas } from "./CanvasImagesPacked.mjs";
import { VerifyPackedCanvasPacks } from "./CanvasPacksPacked.mjs";
import { VerifyPackedIntent } from "./IntentPacked.mjs";
import { VerifyPackedSpatialBuild } from "./SpatialBuildPacked.mjs";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { snapshotDependencies } from "./InstalledDependencies.mjs";
import { test } from "node:test";
import { tmpdir } from "node:os";

/**
 * Packs a local workspace dependency without relying on the npm registry for unpublished packages.
 *
 * @category Tests
 * @since 1.0.0
 */
const pack = (npm: string, directories: ReadonlyArray<string>, destination: string): Record<string, string> =>
{
    const output = JSON.parse(execFileSync(process.execPath,
        [ npm, "pack", "--json", "--ignore-scripts", "--pack-destination", destination, ...directories ],
        { cwd: destination,
            encoding: "utf8" }));
    const artifacts = Array.isArray(output) ? output : Object.values(output);
    const bedform = artifacts.find((artifact: Record<string, unknown>) => artifact.name === "bedform");
    Assert.ok(bedform);
    const commonFiles = bedform.files.filter((file: Record<string, unknown>) =>
        file.path === "Asset/bedform-common.mcaddon");
    Assert.equal(commonFiles.length, 1);
    Assert.ok(commonFiles[0].size > 0);
    const canvasFiles = bedform.files.filter((file: Record<string, unknown>) =>
        file.path === "Asset/bedform-canvas.mcaddon");
    Assert.equal(canvasFiles.length, 1);
    Assert.ok(canvasFiles[0].size > 0);
    return Object.fromEntries(artifacts.map((artifact: Record<string, string>) =>
        [ artifact.name, join(destination, artifact.filename) ]));
};

/**
 * An authored consumer pack and its expected staged dependency in the installed CLI output.
 *
 * @category Model
 * @since 1.0.0
 */
interface ConsumerPack
{
    readonly archive: string;
    readonly manifest: string;
    readonly original: Uint8Array;
    readonly common: string;
}

/**
 * Checks the complete installed CLI archive, linked common packs and staged consumer manifests.
 * Source bytes are compared with snapshots captured before building.
 *
 * @category Testing
 * @since 1.0.0
 */
const verifyCommonArchive = (directory: string, outer: Record<string, Uint8Array>,
    consumers: ReadonlyArray<ConsumerPack>): void =>
{
    const common = unzipSync(readFileSync(
        join(directory, "node_modules/bedform/Asset/bedform-common.mcaddon")
    ));
    Assert.deepEqual(Object.keys(outer).sort(),
        [ ...consumers.map((pack: ConsumerPack) => pack.archive), ...Object.keys(common) ].sort());
    for (const [ name, bytes ] of Object.entries(common))
    {
        Assert.deepEqual(outer[name], bytes);
    }

    const behavior = JSON.parse(strFromU8(unzipSync(outer["bedform-common-bp.mcpack"])["manifest.json"]));
    const resource = JSON.parse(strFromU8(unzipSync(outer["bedform-common-rp.mcpack"])["manifest.json"]));
    Assert.equal(behavior.header.uuid, "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10");
    Assert.equal(resource.header.uuid, "c15f802e-ae6c-4b64-9037-db7fb035f1e8");
    Assert.deepEqual(behavior.dependencies, [ { uuid: resource.header.uuid,
        version: resource.header.version }, { module_name: "@minecraft/server",
        version: "2.10.0" } ]);
    const script = behavior.modules.find((module: { type: string }) => module.type === "script");
    Assert.ok(unzipSync(outer["bedform-common-bp.mcpack"])[script.entry], "common runtime is packaged");
    for (const pack of consumers)
    {
        Assert.deepEqual(readFileSync(join(directory, pack.manifest)), Buffer.from(pack.original));
        const source = JSON.parse(Buffer.from(pack.original).toString());
        const staged = JSON.parse(strFromU8(unzipSync(outer[pack.archive])["manifest.json"]));
        const target = pack.common === "bedform-common-bp.mcpack" ? behavior : resource;
        Assert.deepEqual(staged, { ...source,
            dependencies: [ ...(source.dependencies ?? []), { uuid: target.header.uuid,
                version: target.header.version } ] });
    }
};

test("packed consumers resolve declarations and run without Node or Web globals", async () =>
{
    const npm = process.env.npm_execpath;
    Assert.ok(npm);
    const directory = mkdtempSync(join(tmpdir(), "bedform-consumer-"));
    try
    {
        const artifacts = pack(npm, [ fileURLToPath(new URL("../../Effect", import.meta.url)),
            fileURLToPath(new URL("..", import.meta.url)),
            fileURLToPath(new URL(".", import.meta.resolve("@minecraft/server/package.json"))),
            fileURLToPath(new URL(".", import.meta.resolve("@minecraft/common/package.json"))),
            fileURLToPath(new URL("../../", import.meta.resolve("@minecraft/math"))),
            fileURLToPath(new URL("../", import.meta.resolve("@minecraft/vanilla-data"))),
            fileURLToPath(new URL(".", import.meta.resolve("effect/package.json"))),
            fileURLToPath(new URL(".", import.meta.resolve("@effect/platform-node/package.json"))) ],
        directory);
        const effect = artifacts["@bedform/effect"];
        const bedform = artifacts.bedform;
        const server = artifacts["@minecraft/server"];
        const common = artifacts["@minecraft/common"];
        const math = artifacts["@minecraft/math"];
        const vanilla = artifacts["@minecraft/vanilla-data"];
        const upstream = artifacts.effect;
        const platform = artifacts["@effect/platform-node"];
        writeFileSync(join(directory, "package.json"), JSON.stringify({
            name: "bedform-consumer",
            private: true,
            type: "module"
        }));
        await snapshotDependencies([
            fileURLToPath(new URL("../package.json", import.meta.url)),
            fileURLToPath(new URL("../../Effect/package.json", import.meta.url)),
            fileURLToPath(import.meta.resolve("effect/package.json")),
            fileURLToPath(import.meta.resolve("@effect/platform-node/package.json"))
        ], directory, npm);
        execFileSync(process.execPath, [ npm, "install", "--offline", "--legacy-peer-deps",
            "--ignore-scripts", "--no-audit",
            "--no-fund", effect, bedform, server, common, vanilla, math, upstream, platform ],
        { cwd: directory,
            encoding: "utf8" });
        const installedCommon = join(directory, "node_modules/bedform/Asset/bedform-common.mcaddon");
        Assert.deepEqual(readFileSync(installedCommon),
            readFileSync(new URL("../Asset/bedform-common.mcaddon", import.meta.url)));
        // Resolve the archive reader from the installed package, outside the monorepo and without hooks.
        execFileSync(process.execPath, [ "--input-type=module", "-e", `
            import Assert from "node:assert/strict";
            import { readFileSync } from "node:fs";
            import { createRequire } from "node:module";
            const require = createRequire(import.meta.resolve("bedform/package.json"));
            const manifest = require("./package.json");
            Assert.equal(manifest.dependencies.fflate, "0.8.2");
            Assert.equal(manifest.devDependencies.fflate, undefined);
            const { unzipSync } = require("fflate");
            const archive = unzipSync(readFileSync(require.resolve("./Asset/bedform-common.mcaddon")));
            Assert.deepEqual(Object.keys(archive).sort(),
                [ "bedform-common-bp.mcpack", "bedform-common-rp.mcpack" ]);
            const packs = Object.values(archive).map((bytes) =>
                JSON.parse(Buffer.from(unzipSync(bytes)["manifest.json"]).toString()));
            Assert.equal(packs[0].dependencies[0].uuid, packs[1].header.uuid);
            Assert.deepEqual(packs[0].dependencies[0].version, packs[1].header.version);
        ` ], { cwd: directory,
            encoding: "utf8" });
        writeFileSync(join(directory, "consumer.ts"), `
            // @ts-expect-error The World facade moved to @bedform/server.
            import { world } from "bedform/World";
            // @ts-expect-error The legacy Gesture subpath is removed.
            import * as LegacyGesture from "bedform/Gesture";
            // @ts-expect-error The legacy Recognizer subpath is removed.
            import * as LegacyRecognizer from "bedform/Recognizer";
            // @ts-expect-error The legacy Bedrock adapter subpath is removed.
            import * as LegacyBedrock from "bedform/Bedrock";
            // @ts-expect-error The pure root no longer exports Gesture.
            import { Gesture } from "bedform";
            // @ts-expect-error The pure root no longer exports Recognizer.
            import { Recognizer } from "bedform";
            // @ts-expect-error Private implementation paths are not public package entrypoints.
            import * as Private from "bedform/Distribution/Internal/ButtonRecognizer.js";
            void [world, LegacyGesture, LegacyRecognizer, LegacyBedrock, Gesture, Recognizer, Private];
        `);
        writeFileSync(join(directory, "Diagetic.types.mts"),
            readFileSync(new URL("Diagetic.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Intent.types.mts"),
            readFileSync(new URL("Intent.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "DiageticCustomExample.mts"),
            readFileSync(new URL("DiageticCustomExample.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Gizmo.types.mts"),
            readFileSync(new URL("Gizmo.types.mts", import.meta.url), "utf8"));
        // Run both actual installed entrypoints in Node without a native-module loader or mocks.
        execFileSync(process.execPath, [ "--input-type=module", "-e", `
            import Assert from "node:assert/strict";
            import { Diagetic } from "bedform";
            import * as Direct from "bedform/Diagetic";
            import * as Gizmo from "bedform/Diagetic/Gizmo";
            Assert.equal(Diagetic.Make, Direct.Make);
            const unexpected = () => { throw new Error("inert constructor invoked a callback"); };
            Assert.equal(Diagetic.Gizmo.Make, Gizmo.Make);
            Assert.equal(Direct.Gizmo.Start, Gizmo.Start);
            Assert.equal(Direct.Gizmo.Geometry.Build, Gizmo.Geometry.Build);
            const pose = { Position: { x: 0, y: 0, z: 0 },
                Rotation: { x: 0, y: 0, z: 0, w: 1 }, Scale: { x: 1, y: 1, z: 1 } };
            const view = { Origin: { x: 0, y: 0, z: -3 }, Direction: { x: 0, y: 0, z: 1 } };
            const handles = Gizmo.Geometry.Build({ Transform: pose, Parent: pose, View: view,
                Mode: "translation" });
            Assert.equal(Gizmo.Geometry.Pick(handles, view).Handle, "camera");
            Assert.deepEqual(Gizmo.Geometry.Begin(handles, "camera", view, pose.Position)
                .Sample(view).Transform.Position, pose.Position);
            const adapter = Object.fromEntries(["Discover", "Resolve", "Key", "IsValid", "HitTest",
                "Read", "ReadDegrees", "Parent", "Apply"].map(key => [key, unexpected]));
            const gizmo = Gizmo.Make({ Id: "consumer:editor", Items: ["consumer:wand"],
                Modes: ["scale", "rotation"], Adapter: adapter, OnCommit: unexpected });
            Assert.equal(gizmo.InitialMode, "scale");
            const registry = Gizmo.Start({ Definitions: [gizmo] });
            registry.Dispose();
            Assert.equal(registry.Disposed, true);
            Assert.equal(Diagetic.Lever({ OnGrab: unexpected }).Kind, "lever");
            Assert.equal(Direct.Slider().Kind, "slider");
            Assert.equal(Direct.Wheel().Configuration.Limits, undefined);
            Assert.equal(Diagetic.Simulation.Make, Direct.Simulation.Make);
            Assert.equal(Diagetic.Custom.Make, Direct.Custom.Make);
            Assert.equal(Direct.Custom.Make({ EntityType: "consumer:custom", Initial: 0,
                Acquire: unexpected, Save: unexpected, Load: unexpected,
                Publish: unexpected }).Kind, "custom");
            const spring = Direct.Simulation.Make({ Kind: "slider", InitialValue: 0.9,
                Spring: { Target: 0.25, Strength: 50 }, OnChange: unexpected });
            for (let tick = 0; tick < 500; tick++) spring.Step();
            Assert.equal(spring.State.Value, 0.25);
            Assert.equal(spring.State.Settled, true);
        ` ], { cwd: directory,
            encoding: "utf8" });
        const readme = readFileSync(new URL("../ReadMe.md", import.meta.url), "utf8");
        const examples = Array.from(readme.matchAll(/```ts\r?\n([\s\S]*?)```/g));
        const exampleFiles = examples.map((match: RegExpMatchArray, index: number): string =>
        {
            const name = `example-${index}.ts`;
            writeFileSync(join(directory, name), match[1]);
            return name;
        });
        Assert.equal(exampleFiles.length, 14);
        writeFileSync(join(directory, "Name.types.mts"),
            readFileSync(new URL("Name.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Vector.types.mts"),
            readFileSync(new URL("Vector.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Quat.types.mts"),
            readFileSync(new URL("Quat.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "QuatAdvanced.types.mts"),
            readFileSync(new URL("QuatAdvanced.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Rotator.types.mts"),
            readFileSync(new URL("Rotator.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Transform.types.mts"),
            readFileSync(new URL("Transform.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "RigidTransform.types.mts"),
            readFileSync(new URL("RigidTransform.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Ray.types.mts"),
            readFileSync(new URL("Ray.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Plane.types.mts"),
            readFileSync(new URL("Plane.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "AABB.types.mts"),
            readFileSync(new URL("AABB.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "OBB.types.mts"),
            readFileSync(new URL("OBB.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "ConvexHull.types.mts"),
            readFileSync(new URL("ConvexHull.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "PhysicsDynamics.types.mts"),
            readFileSync(new URL("PhysicsDynamics.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Collision.types.mts"),
            readFileSync(new URL("Collision.types.mts", import.meta.url), "utf8"));
        writeFileSync(join(directory, "Physics.types.mts"),
            readFileSync(new URL("Physics.types.mts", import.meta.url), "utf8"));
        // Exercise the packed host compiler and its generated catalog outside the repository.
        execFileSync(process.execPath, [ "--input-type=module", "-e", `
            import * as Fs from "node:fs/promises";
            await Fs.mkdir("bp"); await Fs.mkdir("rp");
            await Fs.writeFile("rp/texture.png", "fixture");
            await Fs.writeFile("rp/model.json", JSON.stringify({"minecraft:geometry":[{
                description:{identifier:"geometry.packed"}, bones:[{name:"root", cubes:[{
                    origin:[0,0,0],size:[16,16,16]}]}]}]}));
            await Fs.writeFile("physics.config.json", JSON.stringify({schemaVersion:1,
                namespace:"packed",behaviorPack:"bp",resourcePack:"rp",models:[{
                    name:"box",representation:"cuboid",geometry:"model.json",
                    geometryIdentifier:"geometry.packed",textures:{default:"texture"},
                    materials:{default:"entity_alphatest"}}]}));
        ` ], { cwd: directory,
            encoding: "utf8" });
        execFileSync(process.execPath, [ join(directory, "node_modules/bedform/Distribution/Bin.js"),
            "build", "--config", "physics.config.json", "--out", "physics-output" ],
        { cwd: directory,
            encoding: "utf8" });
        // Exercise the actual packed CLI, project-local Node/Effect resolution and async TS imports.
        writeFileSync(join(directory, "config-value.ts"), "export const flag = true as const;");
        writeFileSync(join(directory, "config-data.txt"), "true");
        writeFileSync(join(directory, "bedform.config.ts"), `
            import { readFileSync } from "node:fs";
            import { readFile } from "node:fs/promises";
            import { join } from "node:path";
            import * as Effect from "effect/Effect";
            import { FileSystem } from "effect/FileSystem";
            import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
            import { BedformConfig } from "bedform/Config";
            import { flag } from "./config-value.ts";
            const file = join(import.meta.dirname, "config-data.txt");
            const direct = await readFile(file, "utf8");
            const sync = readFileSync(file, "utf8");
            const platform = await Effect.runPromise(Effect.gen(function*() {
                const fs = yield* FileSystem;
                return yield* fs.readFileString(file);
            }).pipe(Effect.provide(NodeFileSystem.layer)));
            export default BedformConfig({
                DDUI: { StrictMode: flag && direct === platform && sync === direct }
            });
        `);
        const ValidateConfig = (args: Array<string>): string => execFileSync(process.execPath,
            [ join(directory, "node_modules/bedform/Distribution/Bin.js"), "config", "validate", ...args ],
            { cwd: directory,
                encoding: "utf8",
                stdio: "pipe" });
        const LoadedTs = JSON.parse(ValidateConfig([]));
        Assert.equal(LoadedTs.config.DDUI.StrictMode, true);
        Assert.equal(LoadedTs.file, join(directory, "bedform.config.ts"));
        writeFileSync(join(directory, "bedform.config.json"), "{\"DDUI\":{\"StrictMode\":true}}");
        const LoadedJson = JSON.parse(ValidateConfig([ "--config", "bedform.config.json" ]));
        Assert.deepEqual(LoadedTs.config, LoadedJson.config);
        Assert.throws(() => ValidateConfig([]), /Ambiguous/u);
        writeFileSync(join(directory, "invalid.config.ts"), "export const config = {};");
        Assert.throws(() => ValidateConfig([ "--config", "invalid.config.ts" ]), /must default-export/u);
        for (const [ name, source, message ] of [
            [ "invalid.config.ts", "export default {DDUI:{StrictMode:42}};", /Cannot validate/u ],
            [ "invalid.config.ts", "export default { bad: ;", /Cannot evaluate TypeScript/u ],
            [ "invalid.config.ts", "import value from \"./missing-config-value.ts\"; export default value;",
                /Cannot evaluate TypeScript/u ]
        ] as const)
        {
            writeFileSync(join(directory, name), source);
            Assert.throws(() => ValidateConfig([ "--config", name ]), message);
        }

        // Exercise the real packed CLI and published JSX runtimes through official nested archives.
        mkdirSync(join(directory, "behavior_packs/packed"), { recursive: true });
        mkdirSync(join(directory, "Script"));
        writeFileSync(join(directory, "behavior_packs/packed/manifest.json"), JSON.stringify({
            dependencies: [ { module_name: "@minecraft/server",
                version: "2.10.0" }, { uuid: "f3e7c2b4-763a-46b5-aa47-edfe9e5a061a",
                version: [ 7, 0, 0 ] } ],
            format_version: 2,
            header: { description: "Independent build",
                min_engine_version: [ 1, 26, 0 ],
                name: "Packed",
                uuid: "32babd4f-c454-4f98-ab8f-cf15db5f0524",
                version: [ 1, 0, 0 ] },
            modules: [ { entry: "scripts/main.js",
                language: "javascript",
                type: "script",
                uuid: "f012a0db-b745-47b4-a8fa-63dd14e80df5",
                version: [ 1, 0, 0 ] } ]
        }));
        const behaviorPack: ConsumerPack = { archive: "0-packed.mcpack",
            common: "bedform-common-bp.mcpack",
            manifest: "behavior_packs/packed/manifest.json",
            original: readFileSync(join(directory, "behavior_packs/packed/manifest.json")) };
        writeFileSync(join(directory, "Script/part.tsx"),
            "export const Part = (props: {label:string}) => { return props.label; };");
        writeFileSync(join(directory, "Script/main.tsx"), `
            /** @jsxImportSource bedform/DDUI */
            import { StrictMode, isValidElement } from "bedform/DDUI";
            import { Part } from "./part.js";
            const view = <Part label="packed" />;
            Object.assign(globalThis, {proof: {
                strict: StrictMode, source: view.source ?? null, valid: isValidElement(view)
            }});
        `);
        writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
            compilerOptions: { module: "NodeNext",
                moduleResolution: "NodeNext",
                strict: true,
                target: "ES2022",
                types: [] },
            files: [ "Script/main.tsx" ]
        }));
        const buildBin = join(directory, "node_modules/bedform/Distribution/Bin.js");
        for (const strict of [ false, true ])
        {
            execFileSync(process.execPath, [ buildBin, "build", "--config", "bedform.config.json",
                ...strict ? [ "--development" ] : [],
                `--ddui-strict=${strict}`, "--out", "packed.mcaddon" ], {
                cwd: directory,
                encoding: "utf8",
                stdio: "pipe"
            });
            const archive = unzipSync(readFileSync(join(directory, "packed.mcaddon")));
            verifyCommonArchive(directory, archive, [ behaviorPack ]);
            const packFiles = unzipSync(archive["0-packed.mcpack"]);
            Assert.ok(packFiles["manifest.json"]);
            Assert.ok(Object.keys(packFiles).every((file: string) =>
                !/\.(?:tsx?|blend|bbmodel)$/u.test(file)));
            const code = strFromU8(packFiles["scripts/main.js"]);
            Assert.doesNotMatch(code, /node:|BedformDDUIStrict|require\(|from ["'](?:effect|jiti|bedform)/u);
            const modeSandbox = { proof: undefined as undefined | {
                strict: boolean;
                source: null | {fileName: string};
                valid: boolean
            } };
            runInNewContext(code, modeSandbox);
            Assert.equal(modeSandbox.proof?.strict, strict);
            Assert.equal(modeSandbox.proof?.valid, true);
            Assert.equal(modeSandbox.proof?.source !== null, strict);
        }

        execFileSync(process.execPath, [ buildBin, "build", "--config", "bedform.config.json",
            "--out", "omitted.mcaddon" ], { cwd: directory,
            encoding: "utf8",
            stdio: "pipe" });
        const omitted = unzipSync(readFileSync(join(directory, "omitted.mcaddon")));
        verifyCommonArchive(directory, omitted, [ behaviorPack ]);
        const omittedCode = strFromU8(unzipSync(omitted["0-packed.mcpack"])["scripts/main.js"]);
        const omittedSandbox = { proof: undefined as undefined | {strict: boolean} };
        runInNewContext(omittedCode, omittedSandbox);
        Assert.equal(omittedSandbox.proof?.strict, true);

        // Exercise nested JSON/TS Physics through the installed CLI, including the virtual catalog.
        mkdirSync(join(directory, "settings"));
        writeFileSync(join(directory, "rp/manifest.json"), JSON.stringify({
            format_version: 2,
            header: { description: "Packed physics resources",
                min_engine_version: [ 1, 26, 0 ],
                name: "Physics",
                uuid: "ca7eeabe-fd3f-44e2-b03e-a68633bbd209",
                version: [ 1, 0, 0 ] },
            modules: [ { type: "resources",
                uuid: "078a6ab9-2ac9-4b0a-bfae-56b97ed4b559",
                version: [ 1, 0, 0 ] } ]
        }));
        const resourcePack: ConsumerPack = { archive: "1-rp.mcpack",
            common: "bedform-common-rp.mcpack",
            manifest: "rp/manifest.json",
            original: readFileSync(join(directory, "rp/manifest.json")) };
        const physics = JSON.parse(readFileSync(join(directory, "physics.config.json"), "utf8"));
        physics.behaviorPack = "../behavior_packs/packed";
        physics.resourcePack = "../rp";
        const shared = { Physics: physics,
            build: { resourcePacks: [ "../rp" ] } };
        writeFileSync(join(directory, "Script/main.tsx"), `
            import { Models } from "../generated/physics/catalog/models.js";
            Object.assign(globalThis, {physicsProof: Models.box.identifier});
        `);
        for (const extension of [ "json", "ts" ])
        {
            const content = JSON.stringify(shared);
            writeFileSync(join(directory, `settings/physics.${extension}`),
                extension === "ts" ? `export default ${content};` : content);
            execFileSync(process.execPath, [ buildBin, "build", "--config", `settings/physics.${extension}`,
                "--out", "shared-physics.mcaddon" ], { cwd: directory,
                encoding: "utf8",
                stdio: "pipe" });
            const outer = unzipSync(readFileSync(join(directory, "shared-physics.mcaddon")));
            verifyCommonArchive(directory, outer, [ behaviorPack, resourcePack ]);
            const behavior = unzipSync(outer["0-packed.mcpack"]);
            const resources = unzipSync(outer["1-rp.mcpack"]);
            Assert.ok(behavior["entities/box.json"]);
            Assert.ok(resources["models/entity/box.geo.json"]);
            const physicsSandbox = { physicsProof: undefined as unknown };
            const script = strFromU8(behavior["scripts/main.js"]);
            Assert.doesNotMatch(script, /node:|from ["'](?:effect|bedform)/u);
            runInNewContext(script, physicsSandbox);
            Assert.equal(physicsSandbox.physicsProof, "packed:physics_box");
        }

        Assert.equal(existsSync(join(directory, "generated")), false);
        Assert.equal(existsSync(join(directory, "behavior_packs/packed/entities/box.json")), false);

        // Verify the production boundary in the installed CLI, without generated Prototype assets.
        writeFileSync(join(directory, "Script/main.tsx"), `
            import {World} from "bedform/Prototype";
            Object.assign(globalThis,{prototypeProof:World.World({Demonstrations:[]}).Demonstrations.length});
        `);
        const permission = "--allow-development-modules-in-production";
        for (const extension of [ "json", "ts" ])
        {
            const value = JSON.stringify({ Development: { AllowDevelopmentModulesInProduction: false } });
            const file = `settings/boundary.${extension}`;
            writeFileSync(join(directory, file), extension === "ts" ? `export default ${value};` : value);
            const run = (...flags: Array<string>) => spawnSync(process.execPath,
                [ buildBin, "build", "--config", file, "--out", "boundary.mcaddon", ...flags ],
                { cwd: directory,
                    encoding: "utf8" });
            const blocked = run(`${permission}=false`);
            Assert.equal(blocked.status, 1);
            Assert.match(blocked.stderr, /Prototype runtime module is development-only/u);
            Assert.ok(blocked.stderr.indexOf("config=false") <
                blocked.stderr.indexOf("Typechecking scripts"));
            for (const flags of [ [ "--development" ], [ permission ], [ `${permission}=true` ] ])
            {
                const allowed = run(...flags);
                Assert.equal(allowed.status, 0, allowed.stderr);
                const outer = unzipSync(readFileSync(join(directory, "boundary.mcaddon")));
                verifyCommonArchive(directory, outer, [ behaviorPack ]);
                const behavior = unzipSync(outer["0-packed.mcpack"]);
                Assert.deepEqual(Object.keys(behavior).sort(), [ "manifest.json", "scripts/main.js" ]);
                const sandbox = { prototypeProof: undefined as unknown };
                runInNewContext(strFromU8(behavior["scripts/main.js"]), sandbox);
                Assert.equal(sandbox.prototypeProof, 0);
            }
        }

        writeFileSync(join(directory, "Script/main.tsx"), `
            import type {Options} from "bedform/Prototype/Structure";
            let options: Options | undefined; void options;
        `);
        execFileSync(process.execPath, [ buildBin, "build", "--config", "settings/boundary.json",
            "--out", "types-only.mcaddon" ], { cwd: directory,
            encoding: "utf8",
            stdio: "pipe" });

        verifyCommonArchive(directory, unzipSync(readFileSync(join(directory, "types-only.mcaddon"))),
            [ behaviorPack ]);
        // Content-only and single-kind builds also work from the offline, script-disabled install.
        mkdirSync(join(directory, "content"));
        writeFileSync(join(directory, "content/manifest.json"), JSON.stringify({ format_version: 2,
            header: { name: "Content",
                uuid: "de4d5df4-6a79-433b-9dcf-25ce97be1ded",
                version: [ 1, 0, 0 ] },
            modules: [ { type: "data",
                uuid: "c1d864bf-53ca-4a91-aeb4-8bd74e8f59a5",
                version: [ 1, 0, 0 ] } ] }));
        const contentPack: ConsumerPack = { archive: "0-content.mcpack",
            common: behaviorPack.common,
            manifest: "content/manifest.json",
            original: readFileSync(join(directory, "content/manifest.json")) };
        const runContent = () => spawnSync(process.execPath,
            [ buildBin, "build", "--config", "settings/common-content.json",
                "--out", "content-only.mcaddon" ],
            { cwd: directory,
                encoding: "utf8" });
        for (const mode of [ "both", "behavior", "resource" ])
        {
            writeFileSync(join(directory, "settings/common-content.json"), JSON.stringify({ build: {
                behaviorPacks: mode === "resource" ? [] : [ "../content" ],
                resourcePacks: mode === "behavior" ? [] : [ "../rp" ] } }));
            const result = runContent();
            Assert.equal(result.status, 0, result.stderr);
            verifyCommonArchive(directory, unzipSync(readFileSync(join(directory, "content-only.mcaddon"))),
                mode === "both" ? [ contentPack, resourcePack ] : mode === "behavior" ? [ contentPack ] :
                    [ { ...resourcePack,
                        archive: "0-rp.mcpack" } ]);
        }

        const prior = readFileSync(join(directory, "content-only.mcaddon"));
        const resourceSource = JSON.parse(Buffer.from(resourcePack.original).toString());
        for (const invalid of [ { ...resourceSource,
            dependencies: [ {
                uuid: "c15f802e-ae6c-4b64-9037-db7fb035f1e8",
                version: [ 9, 0, 0 ] } ] },
        { ...resourceSource,
            header: { ...resourceSource.header,
                uuid: "c15f802e-ae6c-4b64-9037-db7fb035f1e8" } } ])
        {
            const source = JSON.stringify(invalid);
            writeFileSync(join(directory, resourcePack.manifest), source);
            const result = runContent();
            Assert.equal(result.status, 1);
            Assert.match(result.stderr, /Conflicting BedformCommon|includes these packs automatically/u);
            Assert.equal(readFileSync(join(directory, resourcePack.manifest), "utf8"), source);
            Assert.deepEqual(readFileSync(join(directory, "content-only.mcaddon")), prior);
        }

        writeFileSync(join(directory, resourcePack.manifest), resourcePack.original);
        const commonBytes = readFileSync(installedCommon);
        try
        {
            for (const missing of [ true, false ])
            {
                if (missing)
                {
                    rmSync(installedCommon);
                }
                else
                {
                    writeFileSync(installedCommon, "corrupt");
                }

                const result = runContent();
                Assert.equal(result.status, 1);
                Assert.match(result.stderr,
                    /workspace retained.*Cannot load bundled BedformCommon artifact/u);
                Assert.deepEqual(readFileSync(join(directory, "content-only.mcaddon")), prior);
                Assert.deepEqual(readFileSync(join(directory, resourcePack.manifest)),
                    Buffer.from(resourcePack.original));
            }
        }
        finally
        {
            writeFileSync(installedCommon, commonBytes);
        }

        writeFileSync(join(directory, "tsconfig.json"), JSON.stringify({
            compilerOptions: { lib: [ "ES2022" ],
                module: "NodeNext",
                moduleResolution: "NodeNext",
                noEmit: true,
                strict: true,
                target: "ES2022",
                types: [] },
            files: [ "consumer.ts", "Diagetic.types.mts", "DiageticCustomExample.mts",
                "Gizmo.types.mts",
                "Vector.types.mts",
                "Quat.types.mts",
                "QuatAdvanced.types.mts", "Rotator.types.mts", "Transform.types.mts",
                "RigidTransform.types.mts", "Ray.types.mts", "Plane.types.mts",
                "AABB.types.mts", "OBB.types.mts", "ConvexHull.types.mts", "Physics.types.mts",
                "physics-output/catalog/models.ts", "Collision.types.mts",
                "PhysicsDynamics.types.mts", "Name.types.mts", ...exampleFiles ]
        }));
        execFileSync(process.execPath,
            [ fileURLToPath(import.meta.resolve("typescript/lib/tsc.js")),
                "-p", join(directory, "tsconfig.json") ],
            { cwd: directory,
                encoding: "utf8" });
        const PhysicsBundle = await build({
            bundle: true,
            format: "iife",
            metafile: true,
            platform: "neutral",
            stdin: { contents: `
                import { Models } from "./physics-output/catalog/models.ts";
                import * as C from "bedform/CollisionShape";
                import * as P from "bedform/PhysicsRenderer";
                import * as N from "bedform/Collision";
                import * as F from "bedform/CollisionBroadPhase";
                import * as E from "bedform/PhysicsEntity";
                import * as W from "bedform/PhysicsWorld";
                import * as Runtime from "bedform/PhysicsRuntime";
                import { EntityProperty } from "bedform/keys";
                import * as R from "@bedform/effect/Result";
                import * as T from "bedform/Transform";
                import * as V from "bedform/Vector3";
                const Shape = R.getOrThrow(N.prepare(R.getOrThrow(C.primitive("sphere", V.One))));
                const Instance = {shape:Shape,pose:T.Identity};
                const Tree = R.getOrThrow(F.make());
                R.getOrThrow(F.set(Tree,{id:"body",bounds:Shape.bounds,mode:"dynamic"}));
                const Definition = R.getOrThrow(E.define(Models.box));
                const Body = R.getOrThrow(E.make(Definition,{id:"dynamics",linearVelocity:V.UnitX}));
                const World = R.getOrThrow(W.add(R.getOrThrow(W.make({gravity:V.Zero})),Body));
                const Next = R.getOrThrow(W.step(World));
                if (typeof Runtime.start !== "function") throw new Error("Packed runtime core is missing");
                globalThis.proof = [Math.abs(Models.box.physical.volume - 1) < 1e-12,
                    R.isSuccess(C.primitive("box", V.One)),
                    Object.keys(R.getOrThrow(P.encode({start:T.Identity,end:T.Identity,
                        sequence:0,reset:0,renderBase:V.Zero,duration:0.05}))).length,
                    Object.keys(EntityProperty).length,
                    R.getOrThrow(N.distance(Instance,Instance)).distance === 0,
                    R.getOrThrow(F.snapshot(Tree)).length, Next.tick === 1,
                    Math.abs(Next.bodies[0].pose.position.x - 0.05) < 1e-12];
            `,
            resolveDir: directory },
            write: false
        });
        Assert.ok(Object.keys(PhysicsBundle.metafile.inputs).every((path: string) =>
            !/Particle|Blender|node_modules\/effect\/|\/Build\//u.test(path)));
        const PhysicsSandbox = { Buffer: undefined,
            URL: undefined,
            console: undefined,
            process: undefined,
            proof: undefined,
            setTimeout: undefined };
        runInNewContext(PhysicsBundle.outputFiles[0].text, PhysicsSandbox);
        Assert.equal(JSON.stringify(PhysicsSandbox.proof),
            JSON.stringify([ true, true, 25, 25, true, 1, true, true ]));
        const bundle = await build({
            bundle: true,
            format: "iife",
            metafile: true,
            platform: "neutral",
            stdin: {
                contents: `
                    import { Vector2, Vector3, Quat as Q,
                        Rotator as R, Transform as T, RigidTransform as RT, Ray,
                        Plane as P, AABB as B, OBB as S, ConvexHull as H } from "bedform";
                    import * as Option from "@bedform/effect/Option";
                    import * as Equal from "@bedform/effect/Equal";
                    import * as HashSet from "@bedform/effect/HashSet";
                    import * as DirectVector from "bedform/Vector3";
                    import * as DirectQuat from "bedform/Quat";
                    import * as DirectRotator from "bedform/Rotator";
                    import * as DirectTransform from "bedform/Transform";
                    import * as DirectRigidTransform from "bedform/RigidTransform";
                    import * as DirectRay from "bedform/Ray";
                    import * as DirectPlane from "bedform/Plane";
                    import * as DirectAABB from "bedform/AABB";
                    import * as DirectOBB from "bedform/OBB";
                    import * as DirectHull from "bedform/ConvexHull";
                    import * as Result from "@bedform/effect/Result";
                    const solid = Option.getOrThrow(H.ConvexHull([
                        Vector3.Zero, Vector3.UnitX, Vector3.UnitY, Vector3.UnitZ]));
                    globalThis.proof = [
                        Option.getOrThrow(Vector3.normalize({x: 1e308, y: 1e308, z: 0})).x,
                        Vector3.cross(Vector3.UnitX, Vector3.UnitY).z,
                        Vector2.parse(Vector2.One.toString())._tag,
                        Vector3.North.z, Vector3.Right.x,
                        HashSet.size(HashSet.make(Vector3.One, DirectVector.Vector3Unsafe(1, 1, 1))),
                        Equal.equals(Vector2.Zero, Vector3.Zero),
                        Q === DirectQuat,
                        Q.equals(Q.Identity, Q.negate(Q.Identity)),
                        HashSet.size(HashSet.make(Q.Identity, Q.negate(Q.Identity))),
                        Q.fromMatrix(Option.getOrThrow(Q.toMatrix(Q.Identity)))._tag,
                        Q.OrderLexicographic(Q.Identity, Q.negate(Q.Identity)),
                        Q.parse(Q.Identity.toString())._tag,
                        Option.getOrThrow(Q.slerpFullPath(Q.Identity, Q.negate(Q.Identity), 0.5)).x,
                        Option.getOrThrow(Q.slerp(Q.Identity, Q.negate(Q.Identity), 0.5)).w,
                        Option.getOrThrow(Q.exp(Option.getOrThrow(Q.log(Q.Identity)))).w,
                        Q.calculateTangent(Q.Identity, Q.Identity, Q.Identity)._tag,
                        Option.getOrThrow(Q.squad(Q.Identity, Q.Identity, Q.Identity, Q.Identity, 0.5)).w,
                        Option.getOrThrow(Q.toSwingTwist(Q.scale(Q.Identity, 2), Vector3.UnitY)).swing.w,
                        Option.getOrThrow(Q.twistAngle(Q.Identity, Vector3.UnitY)),
                        Option.getOrThrow(Q.slerpFullPathUnnormalized(
                            Q.Identity, Q.negate(Q.Identity), 0.5)).x,
                        Option.getOrThrow(Q.fastBilerp(
                            Q.Identity, Q.Identity, Q.Identity, Q.Identity, 0.5, 0.5)).w,
                        R === DirectRotator,
                        R.equals(R.RotatorUnsafe(0, 360, 0), R.Zero),
                        R.fromQuat(Q.Identity)._tag, Q.toRotator(Q.Identity)._tag,
                        Q.fromEuler(R.toEuler(R.Zero))._tag,
                        Option.getOrThrow(R.compressAxisToByte(180)), R.normalizeAxis(-450),
                        HashSet.size(HashSet.make(R.Zero, R.RotatorUnsafe(0, 360, 0))),
                        T === DirectTransform,
                        Option.getOrThrow(T.transformPoint(T.Identity, Vector3.One)).x,
                        T.fromMatrix(Option.getOrThrow(T.toMatrix(T.Identity)))._tag,
                        T.parse(T.Identity.toString())._tag,
                        HashSet.size(HashSet.make(T.Identity,
                            T.TransformUnsafe(Vector3.Zero, Q.negate(Q.Identity)))),
                        T.interpolate(T.Identity, T.Identity, 0.5)._tag,
                        RT === DirectRigidTransform, T.isTransform(RT.Identity),
                        Equal.equals(RT.Identity, T.Identity), Equal.equals(T.Identity, RT.Identity),
                        RT.toTransform(RT.Identity)._tag,
                        RT.fromTransform(T.Identity, Vector3.Zero, Vector3.Zero)._tag,
                        Option.getOrThrow(RT.velocityAtPoint(
                            RT.RigidTransformUnsafe(Vector3.Zero, Q.Identity,
                                Vector3.Zero, {x: 0, y: 0, z: 2}), Vector3.UnitX)).y,
                        HashSet.size(HashSet.make(T.Identity, RT.Identity)),
                        RT.inverse(RT.Identity)._tag,
                        Ray === DirectRay, Ray.Ray(Vector3.Zero, {x: 0, y: 0, z: 2})._tag,
                        Option.getOrThrow(Ray.at(Ray.RayUnsafe(Vector3.Zero, Vector3.UnitZ), 3)).z,
                        Option.getOrThrow(Ray.closestParameter(
                            Ray.RayUnsafe(Vector3.Zero, Vector3.UnitZ), Vector3.North)),
                        Option.getOrThrow(Ray.distanceToPoint(
                            Ray.RayUnsafe(Vector3.Zero, Vector3.UnitZ), Vector3.UnitX)),
                        Ray.transform(Ray.RayUnsafe(Vector3.Zero, Vector3.UnitZ), T.Identity)._tag,
                        Ray.parse(Ray.RayUnsafe(Vector3.Zero, Vector3.UnitZ).toString())._tag,
                        P === DirectPlane,
                        Option.getOrThrow(P.Plane({x: 0, y: 2, z: 0}, -4)).offset,
                        Option.getOrThrow(P.signedDistance(P.PlaneUnsafe(Vector3.Up, -2), Vector3.Zero)),
                        Option.getOrThrow(P.contains(P.PlaneUnsafe(Vector3.Up, 0), Vector3.Up)),
                        Option.getOrThrow(P.classify(P.PlaneUnsafe(Vector3.Up, 0), Vector3.Zero)),
                        P.intersectRay(P.PlaneUnsafe(Vector3.Up, -2),
                            Ray.RayUnsafe(Vector3.Zero, Vector3.Up))._tag,
                        P.intersectPlane(P.PlaneUnsafe(Vector3.Up, 0),
                            P.PlaneUnsafe(Vector3.UnitX, 0))._tag,
                        P.parse(P.PlaneUnsafe(Vector3.Up, -2).toString())._tag,
                        B === DirectAABB, B.AABB(Vector3.Zero, Vector3.One)._tag,
                        Option.getOrThrow(B.contains(B.AABBUnsafe(Vector3.Zero, Vector3.One), Vector3.One)),
                        Option.getOrThrow(B.intersectRay(B.AABBUnsafe(Vector3.Zero, Vector3.One),
                            Ray.RayUnsafe({x: -2, y: 0.5, z: 0.5}, Vector3.UnitX))).distance,
                        B.transform(B.AABBUnsafe(Vector3.Zero, Vector3.One), T.Identity)._tag,
                        B.parse(B.AABBUnsafe(Vector3.Zero, Vector3.One).toString())._tag,
                        HashSet.size(HashSet.make(B.AABBUnsafe(Vector3.Zero, Vector3.One),
                            B.AABBUnsafe(Vector3.Zero, Vector3.One))),
                        S === DirectOBB, S.OBB(Vector3.Zero, Vector3.One, Q.Identity)._tag,
                        Option.getOrThrow(S.contains(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity),
                            Vector3.Zero)),
                        Option.getOrThrow(S.closestPoint(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity),
                            {x: 3, y: 0, z: 0})).x,
                        S.toAABB(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity))._tag,
                        Option.getOrThrow(S.intersectRay(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity),
                            Ray.RayUnsafe({x: -3, y: 0, z: 0}, Vector3.UnitX))).distance,
                        S.parse(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity).toString())._tag,
                        Option.getOrThrow(S.overlapsAABB(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity),
                            B.AABBUnsafe({x: 3, y: 0, z: 0}, {x: 4, y: 1, z: 1}))),
                        Option.getOrThrow(S.intersectRay(S.OBBUnsafe(Vector3.Zero, Vector3.One, Q.Identity),
                            Ray.RayUnsafe(Vector3.Zero, Vector3.UnitX))).normal._tag,
                        H === DirectHull, Option.getOrThrow(H.volume(solid)),
                        Option.getOrThrow(H.centroid(solid)).x,
                        Option.getOrThrow(H.supportPoint(solid, Vector3.UnitX)).x,
                        Option.getOrThrow(H.overlapsAABB(solid, B.AABBUnsafe(Vector3.One, Vector3.One))),
                        H.fromAABB(B.AABBUnsafe(Vector3.Zero, Vector3.One))._tag,
                        H.parse(solid.toString())._tag,
                        HashSet.size(HashSet.make(solid, Option.getOrThrow(H.parse(solid.toString()))))];
                `,
                resolveDir: directory
            },
            target: "es2022",
            write: false
        });
        Assert.ok(Object.keys(bundle.metafile.inputs).every((path: string) =>
            !path.includes("@minecraft") && !path.includes("platform-node") &&
            !path.includes("node_modules/effect/") && !path.includes("jiti") &&
            !path.includes("ProjectConfig")));
        const sandbox = { Buffer: undefined,
            TextDecoder: undefined,
            TextEncoder: undefined,
            URL: undefined,
            URLSearchParams: undefined,
            clearTimeout: undefined,
            console: undefined,
            process: undefined,
            proof: undefined,
            setInterval: undefined,
            setTimeout: undefined };
        runInNewContext(bundle.outputFiles[0].text, sandbox);
        Assert.equal(JSON.stringify(sandbox.proof),
            JSON.stringify([ 1 / Math.sqrt(2), 1, "Some", -1, -1, 1, false,
                true, true, 1, "Some", 0, "Some", 1, 1, 1, "Some", 1, 2, 0, 1, 1,
                true, true, "Some", "Some", "Some", 128, -90, 1, true, 1, "Some", "Some", 1, "Some",
                true, true, false, false, "Some", "Some", 2, 2, "Some",
                true, "Some", 3, 0, 1, "Some", "Some",
                true, -2, -2, false, "Boundary", "Some", "Some", "Some",
                true, "Some", true, 2, "Some", "Some", 1,
                true, "Some", true, 1, "Some", 2, "Some", false, "None",
                true, 1 / 6, 0.25, 1, false, "Some", "Some", 1 ]));
        await VerifyPackedIntent(directory);
        await VerifyPackedCanvas(directory);
        await VerifyPackedCanvasPacks(directory);
        await VerifyPackedSpatialBuild(directory);
        const manifest = JSON.parse(readFileSync(
            join(directory, "node_modules/bedform/package.json"), "utf8"));
        Assert.equal(manifest.dependencies["@bedform/effect"], "1.0.0-alpha.1");
        Assert.ok(manifest.files.includes("Asset/bedform-common.mcaddon"));
        Assert.equal(manifest.peerDependencies["@minecraft/math"], "^2.4.1");
        Assert.equal(manifest.devDependencies["@minecraft/math"], "2.4.1");
        Assert.equal(manifest.peerDependenciesMeta["@minecraft/math"], undefined);
        const mathManifest = JSON.parse(readFileSync(
            join(directory, "node_modules/@minecraft/math/package.json"), "utf8"));
        Assert.equal(mathManifest.version, "2.4.1");
        Assert.equal(manifest.exports["./Quaternion"], undefined);
        Assert.equal(manifest.exports["./EulerAngle"], undefined);
        for (const removed of [ "./Gesture", "./Recognizer", "./Bedrock" ])
        {
            Assert.equal(manifest.exports[removed], undefined);
        }

        Assert.equal(manifest.exports["./World"], undefined);

        const aliases = `import * as Root from "bedform";
            if ("Quaternion" in Root || "EulerAngle" in Root) throw new Error("alias namespace");
            if ("Gesture" in Root || "Recognizer" in Root || "world" in Root)
                throw new Error("legacy root export");
            for (const path of ["bedform/Quaternion", "bedform/EulerAngle",
                "bedform/Gesture", "bedform/Recognizer", "bedform/Bedrock", "bedform/World"]) {
                try { await import(path); throw new Error("alias subpath"); }
                catch (error) { if(error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }
            }`;
        execFileSync(process.execPath, [ "--input-type=module", "-e", aliases ],
            { cwd: directory,
                encoding: "utf8" });
    }
    finally
    {
        rmSync(directory, { force: true,
            recursive: true });
    }
});
