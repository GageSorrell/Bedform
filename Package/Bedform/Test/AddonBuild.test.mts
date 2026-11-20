/**
 * Real official-task builds, strict JSX runtime execution, staging and publication failures.
 *
 * @module bedform/Test/AddonBuild.test
 *
 * @file      AddonBuild.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures retain pipeline order and inferred callback types. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef, @stylistic/max-len */

import Assert from "node:assert/strict";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { execFileSync, spawnSync } from "node:child_process";
import { test, type TestContext } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { prepareBuild } from "../Distribution/Build/Settings.js";
import { buildAddon } from "../Distribution/Build/Addon.js";

/** The Bedform Common version that staged consumer manifests depend on. */
const CommonVersion = JSON.parse(await Fs.readFile(
    new URL("../../../Addon/BedformCommon/package.json", import.meta.url), "utf8"
)).version.split(".").map(Number);

/**
 * Creates a script add-on with original-project dependency resolution and linked pack manifests.
 *
 * @category Tests
 * @since 1.0.0
 */
const fixture = async (context: TestContext): Promise<string> =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-addon-"));
    context.after(async () =>
    {
        Assert.ok(Path.resolve(Root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(Root, { recursive: true,
            force: true });
    });
    await Fs.mkdir(Path.join(Root, "behavior_packs/example"), { recursive: true });
    await Fs.mkdir(Path.join(Root, "resource_packs/resources"), { recursive: true });
    await Fs.mkdir(Path.join(Root, "Script"));
    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)),
        Path.join(Root, "node_modules"), "junction");
    for (const [ Directory, Type ] of [ [ "behavior_packs/example", "script" ], [ "resource_packs/resources", "resources" ] ])
    {
        await Fs.writeFile(Path.join(Root, Directory, "manifest.json"), JSON.stringify({
            format_version: 2,
            header: { name: "Fixture",
                description: "Build acceptance",
                uuid: randomUUID(),
                version: [ 1, 0, 0 ],
                min_engine_version: [ 1, 26, 0 ] },
            modules: [ { type: Type,
                uuid: randomUUID(),
                version: [ 1, 0, 0 ],
                ...(Type === "script" ? { language: "javascript",
                    entry: "scripts/main.js" } : {}) } ]
        }));
    }

    await Fs.writeFile(Path.join(Root, "package.json"), "{\"name\":\"@fixture/example\",\"type\":\"module\"}");
    await Fs.writeFile(Path.join(Root, ".gitignore"), "dist/\r\n");
    await Fs.writeFile(Path.join(Root, "Script/screen.tsx"), "export const Screen = (props: {title:string}) => { return props.title; };");
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"), `
        /** @jsxImportSource bedform/DDUI */
        import { StrictMode, isValidElement } from "bedform/DDUI";
        import { Screen } from "./screen.js";
        const element = <Screen title="fixture" />;
        Object.assign(globalThis, { proof: { strict: StrictMode, source: element.source ?? null, valid: isValidElement(element) } });
    `);
    return Root;
};

/**
 * Reads the actual nested archives and executes the manifest script without host globals.
 *
 * @category Tests
 * @since 1.0.0
 */
const proof = async (archive: string): Promise<{ strict: boolean;
    source: null | { fileName: string };
    valid: boolean }> =>
{
    const Outer = unzipSync(await Fs.readFile(archive));
    Assert.deepEqual(Object.keys(Outer).sort(), [ "0-example.mcpack", "1-resources.mcpack",
        "bedform-common-bp.mcpack", "bedform-common-rp.mcpack" ]);
    const Behavior = unzipSync(Outer["0-example.mcpack"]);
    const Resource = unzipSync(Outer["1-resources.mcpack"]);
    Assert.ok(Resource["manifest.json"]);
    Assert.equal(JSON.parse(strFromU8(Behavior["manifest.json"])).modules[0].entry, "scripts/main.js");
    Assert.ok(Object.keys(Behavior).every((file) => !/\.(?:tsx?|blend|bbmodel)$/u.test(file)));
    const Code = strFromU8(Behavior["scripts/main.js"]);
    Assert.doesNotMatch(Code, /node:|BedformDDUIStrict|from ["'](?:effect|jiti|bedform)|require\(/u);
    const Sandbox = { proof: undefined as undefined | { strict: boolean;
        source: null | { fileName: string };
        valid: boolean } };
    runInNewContext(Code, Sandbox);
    Assert.ok(Sandbox.proof);
    return Sandbox.proof;
};

test("real official archives use one strict selection for runtime and imported TSX source metadata", async (context) =>
{
    const Root = await fixture(context);
    const Events: Array<string> = [];
    for (const Configured of [ undefined, false, true ])
    {
        const ConfigPath = Path.join(Root, "bedform.config.json");
        if (Configured === undefined)
        {
            await Fs.rm(ConfigPath, { force: true });
        }
        else
        {
            await Fs.writeFile(ConfigPath, JSON.stringify({ DDUI: { StrictMode: Configured } }));
        }

        for (const Flag of [ undefined, false, true ])
        {
            Events.length = 0;
            const Prepared = await prepareBuild({ root: Root,
                strict: Flag,
                development: Flag ?? Configured ?? false }, (message) => Events.push(message));
            const Result = await buildAddon(Prepared, { log: (message) => Events.push(message) });
            Assert.equal(Result.archive, Path.join(Root, "dist/example.mcaddon"));
            const Actual = await proof(Result.archive);
            const Expected = Flag ?? Configured ?? false;
            Assert.equal(Actual.strict, Expected);
            Assert.equal(Actual.valid, true);
            Assert.equal(Actual.source !== null, Expected);
            if (Expected)
            {
                Assert.match(Actual.source?.fileName ?? "", /main\.tsx$/u);
            }

            if (Flag !== undefined && Configured !== undefined)
            {
                Assert.equal(Events[0], `DDUI.StrictMode override: config=${Configured}, --ddui-strict=${Flag}`);
                Assert.equal(Events[1], "Typechecking scripts");
            }
            else
            {
                Assert.equal(Events[0], "Typechecking scripts");
            }
        }
    }

    Assert.equal(await Fs.readFile(Path.join(Root, ".gitignore"), "utf8"), "dist/\r\n/Intermediate/\r\n");
    Assert.match(await Fs.readFile(Path.join(Root, "Script/main.tsx"), "utf8"), /<Screen/u);
});

test("CLI emits equal and unequal overrides before typechecking and preserves the prior archive on failures", async (context) =>
{
    const Root = await fixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    await Fs.writeFile(Path.join(Root, "bedform.config.ts"), "export default {DDUI:{StrictMode:true}};");
    await Fs.writeFile(Path.join(Root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        types: []
    },
    include: [ "Script/**/*.tsx" ] }));
    const Run = (flag: string) => execFileSync(process.execPath, [ Bin, "build", Root, flag ],
        { cwd: Root,
            encoding: "utf8",
            stdio: "pipe" });
    Run("--ddui-strict=true");
    const Archive = Path.join(Root, "dist/example.mcaddon");
    const Before = await Fs.readFile(Archive);
    await Fs.writeFile(Path.join(Root, "Script/screen.tsx"), "export const Screen = (props: {title:number}) => { return props.title; };");
    for (const Flag of [ "true", "false" ])
    {
        Assert.throws(() => Run(`--ddui-strict=${Flag}`), (error: Error & { stderr?: string }) =>
        {
            const Stderr = String(error.stderr);
            Assert.ok(Stderr.indexOf(`config=true, --ddui-strict=${Flag}`) < Stderr.indexOf("Typechecking scripts"));
            Assert.match(Stderr, /not assignable to type 'number'/u);
            return true;
        });
        Assert.deepEqual(await Fs.readFile(Archive), Before);
    }
});

test("mapping, ambiguity, host imports, models and cancellation fail without replacing published output", async (context) =>
{
    const Root = await fixture(context);
    const Prepared = await prepareBuild({ root: Root }, () => {});
    const Result = await buildAddon(Prepared);
    const Before = await Fs.readFile(Result.archive);
    await Fs.writeFile(Path.join(Root, "Script/main.ts"), "export {};");
    await Assert.rejects(buildAddon(Prepared), /Ambiguous script/u);
    await Fs.rm(Path.join(Root, "Script/main.ts"));
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"), "import \"bedform/Config\";");
    await Assert.rejects(buildAddon(Prepared), /Host-only import/u);
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"), "import \"node:fs\";");
    await Assert.rejects(buildAddon(Prepared), /Host-only import/u);
    await Fs.writeFile(Path.join(Root, "behavior_packs/example/model.blend"), "unchanged source");
    await Assert.rejects(buildAddon(Prepared), /Model conversion.*workspace|workspace.*Model conversion/u);
    Assert.equal(await Fs.readFile(Path.join(Root, "behavior_packs/example/model.blend"), "utf8"), "unchanged source");
    await Fs.rm(Path.join(Root, "behavior_packs/example/model.blend"));
    const Abort = new AbortController();
    await Assert.rejects(buildAddon(Prepared, { signal: Abort.signal,
        log: (message) =>
        {
            if (message.startsWith("Staging"))
            {
                Abort.abort(new Error("cancelled"));
            }
        } }), /cancelled/u);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), JSON.stringify({ build: { scripts: [ {
        entry: "Script/main.tsx",
        output: "outside.js"
    } ] } }));
    await Assert.rejects(buildAddon(await prepareBuild({ root: Root }, () => {})), /uniquely match/u);
    Assert.deepEqual(await Fs.readFile(Result.archive), Before);
});

test("explicit config-relative mappings build custom pack roots and native-only JS entries remain external", async (context) =>
{
    const Root = await fixture(context);
    await Fs.mkdir(Path.join(Root, "config"));
    await Fs.writeFile(Path.join(Root, "config/shared.json"), JSON.stringify({ build: {
        behaviorPacks: [ "../behavior_packs/example" ],
        resourcePacks: [ "../resource_packs/resources" ],
        scripts: [ { entry: "../Script/main.tsx",
            output: "../behavior_packs/example/scripts/main.js" } ]
    } }));
    const Prepared = await prepareBuild({ root: Root,
        config: "config/shared.json",
        output: "custom.mcaddon",
        strict: true }, () => {});
    const Result = await buildAddon(Prepared);
    Assert.equal((await proof(Result.archive)).strict, true);
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"), "import {world} from \"@minecraft/server\"; world.getPlayers();");
    const Native = await buildAddon(Prepared);
    const Outer = unzipSync(await Fs.readFile(Native.archive));
    const Code = strFromU8(unzipSync(Outer["0-example.mcpack"])["scripts/main.js"]);
    Assert.match(Code, /from "@minecraft\/server"/u);
    Assert.doesNotMatch(Code, /bedform\/DDUI|node:/u);
});

test("cancellation during typechecking stops before workspace and gitignore writes", async (context) =>
{
    const Root = await fixture(context);
    const Prepared = await prepareBuild({ root: Root }, () => {});
    const Abort = new AbortController();
    await Assert.rejects(buildAddon(Prepared, { signal: Abort.signal,
        log: (message) =>
        {
            if (message === "Typechecking scripts")
            {
                Abort.abort(new Error("cancelled before staging"));
            }
        } }), /cancelled before staging/u);
    await Assert.rejects(Fs.stat(Path.join(Root, "Intermediate")), /ENOENT/u);
    await Assert.rejects(Fs.stat(Path.join(Root, "dist")), /ENOENT/u);
    Assert.equal(await Fs.readFile(Path.join(Root, ".gitignore"), "utf8"), "dist/\r\n");
});

test("resource-only rebuilds preserve gitignore bytes and unowned intermediate content", async (context) =>
{
    const Root = await fixture(context);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), JSON.stringify({ build: {
        behaviorPacks: [],
        resourcePacks: [ "resource_packs/resources" ]
    } }));
    const Prepared = await prepareBuild({ root: Root }, () => {});
    const Ignore = Path.join(Root, ".gitignore");
    const Sentinel = Path.join(Root, "Intermediate/unowned.txt");
    await Fs.mkdir(Path.dirname(Sentinel));
    await Fs.writeFile(Sentinel, "retained");
    const Cases = [
        [ Buffer.from("Intermediate/\n"), Buffer.from("Intermediate/\n") ],
        [ Buffer.from("*/\n!Intermediate/\n"), Buffer.from("*/\n!Intermediate/\n/Intermediate/\n") ],
        [ Buffer.from("dist/"), Buffer.from("dist/\n/Intermediate/\n") ],
        [ Buffer.from("\uFEFFdist/\r\n", "utf16le"), Buffer.from("\uFEFFdist/\r\n/Intermediate/\r\n", "utf16le") ],
        [ Buffer.from("\uFEFFdist/\r\n", "utf16le").swap16(),
            Buffer.from("\uFEFFdist/\r\n/Intermediate/\r\n", "utf16le").swap16() ]
    ];
    const Workspaces = new Set<string>();
    for (const [ Before, After ] of Cases)
    {
        await Fs.writeFile(Ignore, Before);
        for (let Repeat = 0; Repeat < 2; Repeat++)
        {
            const Result = await buildAddon(Prepared);
            Assert.ok(!Workspaces.has(Result.workspace));
            Workspaces.add(Result.workspace);
            Assert.deepEqual(await Fs.readFile(Ignore), After);
            const Outer = unzipSync(await Fs.readFile(Result.archive));
            Assert.deepEqual(Object.keys(Outer).sort(), [ "0-resources.mcpack",
                "bedform-common-bp.mcpack", "bedform-common-rp.mcpack" ]);
            Assert.ok(unzipSync(Outer["0-resources.mcpack"])["manifest.json"]);
        }
    }

    await Fs.rm(Ignore);
    await buildAddon(Prepared);
    await Assert.rejects(Fs.stat(Ignore), /ENOENT/u);
    Assert.equal(await Fs.readFile(Sentinel, "utf8"), "retained");
});

/**
 * Creates config-relative physics inputs and a script consuming the virtual generated catalog.
 *
 * @category Tests
 * @since 1.0.0
 */
const physicsFixture = async (context: TestContext): Promise<string> =>
{
    const Root = await fixture(context);
    await Fs.mkdir(Path.join(Root, "config"));
    await Fs.writeFile(Path.join(Root, "resource_packs/resources/texture.png"), "texture fixture");
    await Fs.writeFile(Path.join(Root, "resource_packs/resources/model.json"), JSON.stringify({
        "minecraft:geometry": [ { description: { identifier: "geometry.box" },
            bones: [ { name: "root",
                cubes: [ { origin: [ 0, 0, 0 ],
                    size: [ 16, 16, 16 ] } ] } ] } ]
    }));
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"), `
        import { Models } from "../generated/physics/catalog/models.js";
        import { StrictMode } from "bedform/DDUI";
        Object.assign(globalThis, { proof: { identifier: Models.box.identifier,
            mass: Models.box.physical.mass, strict: StrictMode } });
    `);
    await Fs.writeFile(Path.join(Root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        types: []
    },
    include: [ "Script/**/*.tsx" ] }));
    const Config = { Physics: { schemaVersion: 1,
        namespace: "fixture",
        behaviorPack: "../behavior_packs/example",
        resourcePack: "../resource_packs/resources",
        models: [ { name: "box",
            representation: "cuboid",
            geometry: "model.json",
            geometryIdentifier: "geometry.box",
            textures: { default: "texture" },
            materials: { default: "entity_alphatest" } } ] } };
    await Fs.writeFile(Path.join(Root, "config/project.json"), JSON.stringify(Config));
    await Fs.writeFile(Path.join(Root, "config/project.ts"), `export default ${JSON.stringify(Config)};`);
    return Root;
};

test("shared Physics JSON/TS CLI builds stage assets and typecheck/bundle a virtual catalog without source writes", async (context) =>
{
    const Root = await physicsFixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    const Manifest = Path.join(Root, "behavior_packs/example/manifest.json");
    const Before = await Fs.readFile(Manifest);
    for (const Extension of [ "json", "ts" ])
    {
        const Run = spawnSync(process.execPath, [ Bin, "build", Root, "--config", `config/project.${Extension}`,
            "--ddui-strict" ], { cwd: tmpdir(),
            encoding: "utf8" });
        Assert.equal(Run.status, 0, Run.stderr);
        Assert.ok(Run.stderr.indexOf("Compiling physics") < Run.stderr.indexOf("Typechecking scripts"));
        const Outer = unzipSync(await Fs.readFile(Path.join(Root, "dist/example.mcaddon")));
        const Behavior = unzipSync(Outer["0-example.mcpack"]);
        const Resource = unzipSync(Outer["1-resources.mcpack"]);
        Assert.ok(Behavior["entities/box.json"]);
        Assert.ok(Resource["models/entity/box.geo.json"]);
        Assert.ok(Resource["animations/box.animation.json"]);
        Assert.deepEqual(JSON.parse(strFromU8(Behavior["manifest.json"])), {
            ...JSON.parse(Before.toString()),
            dependencies: [ { uuid: "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10",
                version: CommonVersion } ]
        });
        const Code = strFromU8(Behavior["scripts/main.js"]);
        Assert.doesNotMatch(Code, /node:|from ["'](?:effect|bedform)|BedformDDUIStrict/u);
        const Sandbox = { proof: undefined as unknown };
        runInNewContext(Code, Sandbox);
        Assert.equal(JSON.stringify(Sandbox.proof), JSON.stringify({ identifier: "fixture:physics_box",
            mass: 1,
            strict: true }));
    }

    await Assert.rejects(Fs.stat(Path.join(Root, "generated")), /ENOENT/u);
    await Assert.rejects(Fs.stat(Path.join(Root, "behavior_packs/example/entities/box.json")), /ENOENT/u);
    Assert.deepEqual(await Fs.readFile(Manifest), Before);
    const Archive = Path.join(Root, "dist/example.mcaddon");
    const Prior = await Fs.readFile(Archive);
    await Fs.appendFile(Path.join(Root, "Script/main.tsx"), "\nModels.missing;");
    await Assert.rejects(buildAddon(await prepareBuild({ root: Root,
        config: "config/project.json" }, () => {})), /missing.*does not exist/u);
    Assert.deepEqual(await Fs.readFile(Archive), Prior);
});

test("shared Physics refuses mismatched packs, authored catalog/assets and compiler failures without replacing archives", async (context) =>
{
    const Root = await physicsFixture(context);
    const Options = { root: Root,
        config: "config/project.json" };
    const Result = await buildAddon(await prepareBuild(Options, () => {}));
    const Prior = await Fs.readFile(Result.archive);
    const ConfigFile = Path.join(Root, "config/project.json");
    const Config = JSON.parse(await Fs.readFile(ConfigFile, "utf8"));
    Config.Physics.behaviorPack = "../resource_packs/resources";
    await Fs.writeFile(ConfigFile, JSON.stringify(Config));
    await Assert.rejects(buildAddon(await prepareBuild(Options, () => {})), /must match a discovered/u);
    Config.Physics.behaviorPack = "../behavior_packs/example";
    await Fs.writeFile(ConfigFile, JSON.stringify(Config));
    const Collision = Path.join(Root, "resource_packs/resources/models/entity/box.geo.json");
    await Fs.mkdir(Path.dirname(Collision), { recursive: true });
    await Fs.writeFile(Collision, "authored asset");
    await Assert.rejects(buildAddon(await prepareBuild(Options, () => {})), /collides with authored content/u);
    Assert.equal(await Fs.readFile(Collision, "utf8"), "authored asset");
    await Fs.rm(Collision);
    const Catalog = Path.join(Root, "generated/physics/catalog/models.js");
    await Fs.mkdir(Path.dirname(Catalog), { recursive: true });
    await Fs.writeFile(Catalog, "authored catalog");
    await Assert.rejects(buildAddon(await prepareBuild(Options, () => {})), /catalog collides/u);
    await Fs.rm(Catalog);
    Config.Physics.models[0].geometryIdentifier = "geometry.missing";
    await Fs.writeFile(ConfigFile, JSON.stringify(Config));
    await Assert.rejects(buildAddon(await prepareBuild(Options, () => {})), /geometry|Geometry/u);
    Assert.deepEqual(await Fs.readFile(Result.archive), Prior);
});

test("standalone Physics CLI retains overlays, explains migration and rejects ambiguous shared/legacy inputs", async (context) =>
{
    const Root = await physicsFixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    const Config = JSON.parse(await Fs.readFile(Path.join(Root, "config/project.json"), "utf8"));
    const Legacy = Path.join(Root, "config/legacy.json");
    await Fs.writeFile(Legacy, JSON.stringify(Config.Physics));
    const Run = (...args: Array<string>) => spawnSync(process.execPath, [ Bin, "build", ...args ],
        { cwd: Root,
            encoding: "utf8" });
    const Success = Run("--config", Legacy, "--out", "overlay");
    Assert.equal(Success.status, 0, Success.stderr);
    Assert.match(Success.stderr, /migrate.*under Physics/u);
    Assert.ok(await Fs.stat(Path.join(Root, "overlay/catalog/models.ts")));
    for (const Args of [ [ Root ], [ "--ddui-strict" ], [ "--development" ],
        [ "--allow-development-modules-in-production=false" ] ])
    {
        const Invalid = Run(...Args, "--config", Legacy, "--out", "untouched");
        Assert.equal(Invalid.status, 1);
        Assert.match(Invalid.stderr, /Move its fields under Physics/u);
    }

    await Fs.writeFile(Legacy, JSON.stringify({ ...Config.Physics,
        DDUI: { StrictMode: true } }));
    Assert.match(Run("--config", Legacy, "--out", "untouched").stderr, /Ambiguous configuration/u);
    await Assert.rejects(Fs.stat(Path.join(Root, "untouched")), /ENOENT/u);
});

test("production graph rejects Prototype direct, transitive, dynamic and physical imports while allowing erased types", async (context) =>
{
    const Root = await fixture(context);
    const Main = Path.join(Root, "Script/main.tsx");
    const Prepared = await prepareBuild({ root: Root }, () => {});
    const Initial = await buildAddon(Prepared);
    const Before = await Fs.readFile(Initial.archive);
    const Package = JSON.parse(await Fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
    const Modules = Object.keys(Package.exports).filter((name) => name.startsWith("./Prototype"));
    for (const Module of Modules)
    {
        await Fs.writeFile(Main, `import * as P from ${JSON.stringify(`bedform/${Module.slice(2)}`)};
            Object.assign(globalThis,{proof:Object.keys(P).length});`);
        await Assert.rejects(buildAddon(Prepared), /Prototype runtime module is development-only/u, Module);
        Assert.deepEqual(await Fs.readFile(Initial.archive), Before);
        const Allowed = await buildAddon(await prepareBuild({ root: Root,
            development: true }, () => {}));
        const Outer = unzipSync(await Fs.readFile(Allowed.archive));
        const Behavior = unzipSync(Outer["0-example.mcpack"]);
        const Resource = unzipSync(Outer["1-resources.mcpack"]);
        Assert.deepEqual(Object.keys(Behavior).sort(), [ "manifest.json", "scripts/main.js" ]);
        Assert.deepEqual(Object.keys(Resource), [ "manifest.json" ]);
        const Sandbox = { proof: undefined as unknown };
        runInNewContext(strFromU8(Behavior["scripts/main.js"]), Sandbox);
        Assert.equal(typeof Sandbox.proof, "number");
        // Refresh the known-good archive for the next rejected build.
        await Fs.writeFile(Initial.archive, Before);
    }

    await Fs.writeFile(Path.join(Root, "Script/barrel.ts"),
        "export * from \"bedform/Prototype/Structure/Catalog\";");
    const Physical = fileURLToPath(new URL("../Distribution/Prototype/World.js", import.meta.url));
    for (const Source of [
        "import * as P from \"./barrel.js\"; Object.assign(globalThis,{proof:Object.keys(P).length});",
        "Object.assign(globalThis,{load:()=>import(\"bedform/Prototype/Structure\")});",
        `import * as P from ${JSON.stringify(Physical)}; Object.assign(globalThis,{proof:Object.keys(P).length});`
    ])
    {
        await Fs.writeFile(Main, Source);
        await Assert.rejects(buildAddon(Prepared), /Prototype runtime module is development-only/u);
    }

    await Fs.writeFile(Path.join(Root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        types: [],
        allowJs: true,
        paths: { prototypeWorld: [ Physical ] }
    },
    files: [ "Script/main.tsx" ] }));
    await Fs.writeFile(Main,
        "import * as P from \"prototypeWorld\"; Object.assign(globalThis,{proof:Object.keys(P).length});");
    await Assert.rejects(buildAddon(Prepared), /Prototype runtime module is development-only/u);

    await Fs.writeFile(Main, `import type { Options } from "bedform/Prototype/Structure";
        let options: Options | undefined; void options; Object.assign(globalThis,{proof:1});`);
    await Fs.writeFile(Path.join(Root, "tsconfig.json"), JSON.stringify({ compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        types: []
    },
    files: [ "Script/main.tsx" ] }));
    await buildAddon(Prepared);
    await Fs.mkdir(Path.join(Root, "Script/Prototype"));
    await Fs.writeFile(Path.join(Root, "Script/Prototype/local.ts"), "export const Value=1;");
    await Fs.writeFile(Main, "import {Value} from \"./Prototype/local.js\"; Object.assign(globalThis,{proof:Value});");
    await buildAddon(Prepared);
});

test("development and explicit production permission obey config/flag precedence without changing manifests or injecting assets", async (context) =>
{
    const Root = await fixture(context);
    await Fs.writeFile(Path.join(Root, "Script/main.tsx"),
        "import {World} from \"bedform/Prototype\"; Object.assign(globalThis,{proof:World.World({Demonstrations:[]}).Demonstrations.length});");
    const Original = await Fs.readFile(Path.join(Root, "behavior_packs/example/manifest.json"));
    for (const Configured of [ undefined, false, true ])
    {
        await Fs.writeFile(Path.join(Root, "bedform.config.json"), JSON.stringify(Configured === undefined ? {} :
            { Development: { AllowDevelopmentModulesInProduction: Configured } }));
        for (const Override of [ undefined, false, true ])
        {
            for (const Development of [ false, true ])
            {
                const Events: Array<string> = [];
                const Prepared = await prepareBuild({ root: Root,
                    development: Development,
                    allowDevelopmentModulesInProduction: Override }, (message) => Events.push(message));
                const Build = () => buildAddon(Prepared, { log: (message) => Events.push(message) });
                if (!Development && !(Override ?? Configured ?? false))
                {
                    await Assert.rejects(Build(), /development-only/u);
                }
                else
                {
                    const Result = await Build();
                    const Outer = unzipSync(await Fs.readFile(Result.archive));
                    const Behavior = unzipSync(Outer["0-example.mcpack"]);
                    const Resource = unzipSync(Outer["1-resources.mcpack"]);
                    Assert.deepEqual(JSON.parse(strFromU8(Behavior["manifest.json"])), {
                        ...JSON.parse(Original.toString()),
                        dependencies: [ { uuid: "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10",
                            version: CommonVersion } ]
                    });
                    Assert.deepEqual(await Fs.readFile(Path.join(Root, "behavior_packs/example/manifest.json")), Original);
                    Assert.deepEqual(Object.keys(Behavior).sort(), [ "manifest.json", "scripts/main.js" ]);
                    Assert.deepEqual(Object.keys(Resource), [ "manifest.json" ]);
                    const Sandbox = { proof: undefined as unknown };
                    runInNewContext(strFromU8(Behavior["scripts/main.js"]), Sandbox);
                    Assert.equal(Sandbox.proof, 0);
                }

                if (Override !== undefined && Configured !== undefined)
                {
                    Assert.equal(Events[0], `Development.AllowDevelopmentModulesInProduction override: config=${Configured}, --allow-development-modules-in-production=${Override}`);
                    Assert.equal(Events[1], "Typechecking scripts");
                }
            }
        }
    }
});
