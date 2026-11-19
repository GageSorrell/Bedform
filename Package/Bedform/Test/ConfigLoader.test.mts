/**
 * Project configuration discovery, evaluation, path and CLI failure contracts.
 *
 * @module bedform/Test/ConfigLoader.test
 *
 * @file      ConfigLoader.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Configuration fixtures retain domain grouping and contextual inference. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len, @typescript-eslint/typedef */

import Assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";
import { loadProjectConfig } from "../Distribution/Build/ProjectConfig.js";
import { TypeId } from "../Distribution/Config.js";

/**
 * Creates an owned disposable root with spaces and a cleanup guarded by the temp directory.
 *
 * @category Tests
 * @since 1.0.0
 */
const fixture = async (context: TestContext): Promise<string> =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform config "));
    context.after(async () =>
    {
        Assert.ok(Path.resolve(Root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(Root, { recursive: true,
            force: true });
    });
    return Root;
};

test("empty discovery uses branded defaults without searching parents or changing files", async (context) =>
{
    const Root = await fixture(context);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), "{\"DDUI\":{\"StrictMode\":true}}");
    const Child = Path.join(Root, "addon");
    await Fs.mkdir(Child);
    const Loaded = await loadProjectConfig({ root: Child });
    Assert.equal(Loaded.file, undefined);
    Assert.equal(Loaded.directory, Child);
    Assert.equal(Loaded.config.DDUI?.StrictMode, false);
    Assert.equal(Loaded.config[TypeId], TypeId);
    Assert.deepEqual(Loaded.input, {});
    Assert.deepEqual(await Fs.readdir(Child), []);
    await Assert.rejects(loadProjectConfig({ root: Path.join(Child, "missing") }), /Cannot discover.*ENOENT/u);
});

test("JSON and async TS resolve the same config-relative paths while retaining authored input", async (context) =>
{
    const Root = await fixture(context);
    const Directory = Path.join(Root, "settings");
    await Fs.mkdir(Directory);
    const Input = {
        DDUI: { StrictMode: true },
        Development: { AllowDevelopmentModulesInProduction: true },
        build: { behaviorPacks: [ "../bp" ],
            resourcePacks: [ "../rp" ],
            scripts: [ { entry: "../Script/main.tsx",
                output: "../bp/scripts/main.js" } ] },
        Physics: { schemaVersion: 1,
            namespace: "example",
            behaviorPack: "../bp",
            resourcePack: "../rp",
            models: [
                { representation: "cuboid",
                    name: "cube",
                    geometry: "models/cube.json",
                    geometryIdentifier: "geometry.cube",
                    materials: { default: "entity_alphatest" },
                    textures: { default: "textures/cube" } },
                { representation: "particle",
                    name: "mesh",
                    meshSolid: "../mesh.json",
                    rendererDescriptor: "../renderer.json" }
            ] }
    };
    await Fs.writeFile(Path.join(Directory, "project.json"), "\uFEFF" + JSON.stringify({ $schema: "https://example.com/schema.json",
        ...Input }));
    await Fs.writeFile(Path.join(Directory, "local.ts"), `export const settings = ${JSON.stringify(Input)} as const;`);
    await Fs.writeFile(Path.join(Directory, "project.ts"), `
        import {readFile} from "node:fs/promises";
        import {join} from "node:path";
        import {settings} from "./local.ts";
        await readFile(join(import.meta.dirname, "project.json"), "utf8");
        await Promise.resolve();
        export default settings;
    `);
    const Json = await loadProjectConfig({ root: Root,
        config: "settings/project.json" });
    const Ts = await loadProjectConfig({ root: Root,
        config: "settings/project.ts" });
    Assert.deepEqual(Ts.input, Input);
    Assert.deepEqual(Json.input, Input);
    Assert.deepEqual(Ts.config, Json.config);
    Assert.equal(Ts.directory, Directory);
    Assert.equal(Ts.file, Path.join(Directory, "project.ts"));
    Assert.equal(Ts.config.Physics?.behaviorPack, Path.join(Root, "bp"));
    Assert.equal(Ts.config.Physics?.resourcePack, Path.join(Root, "rp"));
    Assert.equal(Ts.config.build?.behaviorPacks?.[0], Path.join(Root, "bp"));
    Assert.equal(Ts.config.build?.resourcePacks?.[0], Path.join(Root, "rp"));
    Assert.equal(Ts.config.build?.scripts?.[0].entry, Path.join(Root, "Script/main.tsx"));
    Assert.equal(Ts.config.build?.scripts?.[0].output, Path.join(Root, "bp/scripts/main.js"));
    const Models = Ts.config.Physics?.models;
    Assert.equal(Models?.[0].representation === "cuboid" && Models[0].geometry, "models/cube.json");
    Assert.equal(Models?.[1].representation === "particle" && Models[1].meshSolid, Path.join(Root, "mesh.json"));
    Assert.equal(Models?.[1].representation === "particle" && Models[1].rendererDescriptor, Path.join(Root, "renderer.json"));
    Assert.deepEqual((await Fs.readdir(Directory)).sort(), [ "local.ts", "project.json", "project.ts" ]);
});

test("ambiguity fails before evaluation and explicit selection takes precedence", async (context) =>
{
    const Root = await fixture(context);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), "{}");
    await Fs.writeFile(Path.join(Root, "bedform.config.ts"), "throw new Error(\"must not evaluate\");");
    await Assert.rejects(loadProjectConfig({ root: Root }), /Ambiguous.*--config/u);
    Assert.equal((await loadProjectConfig({ root: Root,
        config: "bedform.config.json" })).config.DDUI?.StrictMode, false);
    await Assert.rejects(loadProjectConfig({ root: Root,
        config: "absent.json" }), /Cannot read.*absent.json.*ENOENT/u);
    await Assert.rejects(loadProjectConfig({ root: Root,
        config: "" }), /Explicit --config/u);
    await Fs.rm(Path.join(Root, "bedform.config.ts"));
    Assert.equal((await loadProjectConfig({ root: Root })).file, Path.join(Root, "bedform.config.json"));
    await Fs.rm(Path.join(Root, "bedform.config.json"));
    await Fs.writeFile(Path.join(Root, "bedform.config.ts"), "export default {};");
    Assert.equal((await loadProjectConfig({ root: Root })).file, Path.join(Root, "bedform.config.ts"));
});

test("errors identify selected files and distinguish parsing, evaluation and validation", async (context) =>
{
    const Root = await fixture(context);
    const Cases = [
        [ "bad.json", "{", /Cannot parse JSON/u ],
        [ "flag.json", "{\"DDUI\":{\"StrictMode\":\"false\"}}", /Cannot validate/u ],
        [ "array.json", "[]", /must be an object/u ],
        [ "unknown.json", "{\"machine\":{\"python\":\"python.exe\"}}", /Cannot validate/u ],
        [ "syntax.ts", "export default { DDUI: ;", /Cannot evaluate TypeScript/u ],
        [ "import.ts", "import value from \"./absent.ts\"; export default value;", /Cannot evaluate TypeScript/u ],
        [ "missing.ts", "export const DDUI = {};", /must default-export/u ],
        [ "null.ts", "export default null;", /must be an object/u ],
        [ "function.ts", "export default () => ({});", /must be an object/u ],
        [ "promise.ts", "export default Promise.resolve({});", /must be a plain object/u ],
        [ "instance.ts", "export default new Date();", /must be a plain object/u ],
        [ "schema.ts", "export default {$schema:\"json-only\"};", /Cannot validate/u ],
        [ "rejection.ts", "await Promise.reject(new Error(\"async init failed\")); export default {};", /async init failed/u ],
        [ "format.js", "export default {};", /expected .json or .ts/u ]
    ] as const;
    for (const [ Name, Source, Pattern ] of Cases)
    {
        await Fs.writeFile(Path.join(Root, Name), Source);
        await Assert.rejects(loadProjectConfig({ root: Root,
            config: Name }), (error: Error) =>
        {
            Assert.match(error.message, Pattern);
            Assert.ok(error.message.includes(Path.join(Root, Name)));
            Assert.ok(error.cause);
            return true;
        });
    }

    await Fs.mkdir(Path.join(Root, "directory.json"));
    await Assert.rejects(loadProjectConfig({ root: Root,
        config: "directory.json" }), /not a file/u);
});

test("reloading TS observes local source changes and does not write transpilation caches", async (context) =>
{
    const Root = await fixture(context);
    await Fs.writeFile(Path.join(Root, "bedform.config.ts"), "import { strict } from \"./value.ts\"; export default { DDUI: { StrictMode: strict } };");
    await Fs.writeFile(Path.join(Root, "value.ts"), "export const strict = false;");
    Assert.equal((await loadProjectConfig({ root: Root })).config.DDUI?.StrictMode, false);
    await Fs.writeFile(Path.join(Root, "value.ts"), "export const strict = true;");
    Assert.equal((await loadProjectConfig({ root: Root })).config.DDUI?.StrictMode, true);
    Assert.deepEqual((await Fs.readdir(Root)).sort(), [ "bedform.config.ts", "value.ts" ]);
});

test("CLI validates discovered and explicit configurations and rejects malformed options", async (context) =>
{
    const Root = await fixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    const Run = (args: Array<string>): string => execFileSync(process.execPath, [ Bin, "config", "validate", ...args ],
        { cwd: Root,
            encoding: "utf8",
            stdio: "pipe" });
    Assert.equal(JSON.parse(Run([])).config.DDUI.StrictMode, false);
    await Fs.writeFile(Path.join(Root, "bedform.config.ts"), "export default { DDUI: { StrictMode: true } };");
    Assert.equal(JSON.parse(Run([ Root ])).config.DDUI.StrictMode, true);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), "{}");
    Assert.throws(() => Run([]), /Ambiguous/u);
    Assert.equal(JSON.parse(Run([ "--config", "bedform.config.json" ])).file, Path.join(Root, "bedform.config.json"));
    for (const Args of [ [ "--config" ], [ "--config", "--unknown" ], [ "--unknown" ],
        [ "--config", "bedform.config.json", "--config", "bedform.config.ts" ], [ Root, Root ] ])
    {
        Assert.throws(() => Run(Args));
    }
});
