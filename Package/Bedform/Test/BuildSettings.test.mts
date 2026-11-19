/**
 * Strict build precedence, diagnostics, parsing, and pure bundle substitution contracts.
 *
 * @module bedform/Test/BuildSettings.test
 *
 * @file      BuildSettings.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Table-driven fixtures retain domain order and contextual types. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len, @typescript-eslint/typedef */

import Assert from "node:assert/strict";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { test, type TestContext } from "node:test";
import { build } from "esbuild";
import { BedformConfig } from "../Distribution/Config.js";
import { StrictMode } from "../Distribution/Internal/DDUIBuildMode.js";
import { parseBuildArguments, prepareBuild, resolveBuildSettings } from "../Distribution/Build/Settings.js";

/**
 * Creates a disposable fixture root with cleanup constrained to the temp directory.
 *
 * @category Tests
 * @since 1.0.0
 */
const fixture = async (context: TestContext): Promise<string> =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-strict-"));
    context.after(async () =>
    {
        Assert.ok(Path.resolve(Root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(Root, { force: true,
            recursive: true });
    });
    return Root;
};

test("strict flags distinguish omission, true and false and preserve build path arguments", () =>
{
    Assert.equal(parseBuildArguments([]).strict, undefined);
    for (const [ Flag, Value ] of [ [ "--ddui-strict", true ], [ "--ddui-strict=true", true ], [ "--ddui-strict=false", false ] ] as const)
    {
        const Options = parseBuildArguments([ "addon directory", "--out", "out directory", Flag, "--config", "settings.ts" ]);
        Assert.deepEqual(Options, { root: "addon directory",
            config: "settings.ts",
            output: "out directory",
            strict: Value });
    }

    Assert.equal(parseBuildArguments([ "--ddui-strict=false", "addon" ]).root, "addon");
});

test("invalid and repeated options fail before loading or evaluating configuration", () =>
{
    for (const Args of [ [ "--ddui-strict=" ], [ "--ddui-strict=TRUE" ], [ "--ddui-strict=1" ],
        [ "--ddui-strict=false", "--ddui-strict" ], [ "--ddui-strict", "--ddui-strict=true" ],
        [ "--ddui-strict", "false" ], [ "--ddui-strict", "true" ], [ "--config" ], [ "--out", "--ddui-strict" ],
        [ "--out", "" ], [ "--config", "a", "--config", "b" ], [ "--out", "a", "--out", "b" ],
        [ "a", "b" ], [ "--unknown" ], [ "" ] ])
    {
        Assert.throws(() => parseBuildArguments(Args), Error, JSON.stringify(Args));
    }
});

test("precedence and equal overrides use authored presence without mutating configuration", () =>
{
    for (const Configured of [ undefined, false, true ])
    {
        for (const Flag of [ undefined, false, true ])
        {
            const Input = Configured === undefined ? {} : { DDUI: { StrictMode: Configured } };
            const Project = { config: BedformConfig(Input),
                directory: "/fixture",
                input: Input };
            const Logs: Array<string> = [];
            const Settings = resolveBuildSettings(Project, Flag, (message) => Logs.push(message));
            const Effective = Flag ?? Configured ?? false;
            Assert.equal(Settings.strict, Effective);
            Assert.equal(Settings.bundle.jsxDev, Effective);
            Assert.equal(Settings.bundle.jsx, "automatic");
            Assert.equal(Settings.typescript.jsx, Effective ? "react-jsxdev" : "react-jsx");
            Assert.equal(Settings.bundle.jsxImportSource, Settings.typescript.jsxImportSource);
            Assert.equal(Logs.length, Flag !== undefined && Configured !== undefined ? 1 : 0);
            if (Logs.length)
            {
                Assert.equal(Logs[0], `DDUI.StrictMode override: config=${Configured}, --ddui-strict=${Flag}`);
            }

            Assert.deepEqual(Project.input, Input);
            Assert.equal(Project.config.DDUI?.StrictMode, Configured ?? false);
        }
    }
});

test("preflight defaults configless projects and logs overrides before a later failure", async (context) =>
{
    const Root = await fixture(context);
    const Events: Array<string> = [];
    const Default = await prepareBuild({ root: Root }, (message) => Events.push(message));
    Assert.equal(Default.settings.strict, false);
    Assert.equal(Events.length, 0);
    Assert.equal((await prepareBuild({ root: Root,
        strict: true }, () => {})).settings.strict, true);
    Assert.deepEqual(await Fs.readdir(Root), []);
    await Fs.writeFile(Path.join(Root, "bedform.config.json"), "{\"DDUI\":{\"StrictMode\":true}}");
    await prepareBuild({ root: Root,
        strict: true }, (message) => Events.push(message));
    Events.push("stage would begin");
    Assert.deepEqual(Events, [ "DDUI.StrictMode override: config=true, --ddui-strict=true", "stage would begin" ]);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    Assert.throws(() => execFileSync(process.execPath, [ Bin, "build", "--ddui-strict=false", "--out", "must-not-exist" ],
        { cwd: Root,
            encoding: "utf8",
            stdio: "pipe" }), (error: Error & { stderr?: string }) =>
    {
        const Stderr = String(error.stderr);
        Assert.ok(Stderr.indexOf("config=true, --ddui-strict=false") < Stderr.indexOf("Build requires"));
        Assert.match(Stderr, /DDUI.StrictMode override/u);
        Assert.match(Stderr, /Build requires at least one unique behavior or resource pack/u);
        return true;
    });
    await Assert.rejects(Fs.stat(Path.join(Root, "must-not-exist")), /ENOENT/u);
});

test("explicit shared JSON and TS configurations use project preflight with an omitted strict flag", async (context) =>
{
    const Root = await fixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    await Fs.writeFile(Path.join(Root, "settings.json"), "{\"DDUI\":{\"StrictMode\":true}}");
    await Fs.writeFile(Path.join(Root, "settings.ts"), "export default { DDUI: { StrictMode: true } };");
    for (const Config of [ "settings.json", "settings.ts" ])
    {
        for (const Prefix of [ [], [ Root ] ])
        {
            Assert.throws(() => execFileSync(process.execPath,
                [ Bin, "build", ...Prefix, "--config", Config, "--out", "must-not-exist" ],
                { cwd: Root,
                    encoding: "utf8",
                    stdio: "pipe" }), (error: Error & { stderr?: string }) =>
            {
                Assert.match(String(error.stderr), /Build requires at least one unique behavior or resource pack/u);
                Assert.doesNotMatch(String(error.stderr), /physics build schemaVersion|DDUI.StrictMode override/u);
                return true;
            });
        }
    }

    await Assert.rejects(Fs.stat(Path.join(Root, "must-not-exist")), /ENOENT/u);
});

test("CLI rejects invalid strict flags before evaluating explicit TS configuration", async (context) =>
{
    const Root = await fixture(context);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    await Fs.writeFile(Path.join(Root, "settings.ts"), `
        import { writeFileSync } from "node:fs";
        writeFileSync(${JSON.stringify(Path.join(Root, "evaluated"))}, "evaluated");
        export default { DDUI: { StrictMode: true } };
    `);
    for (const Flags of [ [ "--ddui-strict=1" ], [ "--ddui-strict", "--ddui-strict=true" ] ])
    {
        Assert.throws(() => execFileSync(process.execPath,
            [ Bin, "build", "--config", "settings.ts", ...Flags ],
            { cwd: Root,
                encoding: "utf8",
                stdio: "pipe" }), /--ddui-strict/u);
    }

    await Assert.rejects(Fs.stat(Path.join(Root, "evaluated")), /ENOENT/u);
});

test("strict and ordinary JSX fixture bundles agree with pure mode and include no host tooling", async () =>
{
    Assert.equal(StrictMode, false);
    const Mode = fileURLToPath(new URL("../Distribution/Internal/DDUIBuildMode.js", import.meta.url));
    for (const Flag of [ false, true ])
    {
        const Settings = resolveBuildSettings({ config: BedformConfig({}),
            directory: "/fixture",
            input: {} }, Flag, () => {});
        const Bundle = await build({
            ...Settings.bundle,
            bundle: true,
            write: false,
            metafile: true,
            format: "iife",
            platform: "neutral",
            stdin: { contents: "globalThis.proof = <toggle value={true} />;",
                loader: "tsx",
                sourcefile: "screen.tsx" },
            plugins: [ {
                name: "future-jsx-runtime-fixture",
                setup(plugin)
                {
                    plugin.onResolve({ filter: /^bedform\/DDUI\/jsx-(dev-)?runtime$/ }, (args) => ({ path: args.path,
                        namespace: "fixture" }));
                    plugin.onLoad({ filter: /.*/,
                        namespace: "fixture" }, () => ({
                        contents: `import {StrictMode} from ${JSON.stringify(Mode.replaceAll("\\", "/"))};
                            export const jsx = (type,props,key) => ({type,props,key,strict:StrictMode,source:null});
                            export const jsxs = jsx;
                            export const jsxDEV = (type,props,key,staticChildren,source) => ({type,props,key,strict:StrictMode,source});`,
                        loader: "js",
                        resolveDir: Path.dirname(Mode)
                    }));
                }
            } ]
        });
        const Sandbox = { proof: undefined as undefined | { strict: boolean;
            source: null | { fileName: string } } };
        runInNewContext(Bundle.outputFiles[0].text, Sandbox);
        Assert.equal(Sandbox.proof?.strict, Flag);
        Assert.equal(Sandbox.proof?.source !== null, Flag);
        if (Flag)
        {
            Assert.equal(Sandbox.proof?.source?.fileName, "screen.tsx");
        }

        Assert.ok(Object.keys(Bundle.metafile.inputs).every((name) => !/Settings|ProjectConfig|node_modules\/effect\/|jiti/u.test(name)));
        Assert.doesNotMatch(Bundle.outputFiles[0].text, /process\.|require\(|node:|BedformDDUIStrict/u);
    }
});

test("development mode and production permission preserve omission, strict parsing and early override diagnostics", async (context) =>
{
    Assert.equal(parseBuildArguments([]).development, undefined);
    Assert.equal(parseBuildArguments([]).allowDevelopmentModulesInProduction, undefined);
    Assert.equal(parseBuildArguments([ "--development" ]).development, true);
    const Permission = "--allow-development-modules-in-production";
    for (const [ Flag, Value ] of [ [ Permission, true ], [ `${Permission}=true`, true ],
        [ `${Permission}=false`, false ] ] as const)
    {
        Assert.equal(parseBuildArguments([ Flag ]).allowDevelopmentModulesInProduction, Value);
    }

    for (const Args of [ [ "--development", "--development" ], [ "--development=false" ],
        [ "--development", "false" ], [ `${Permission}=` ], [ `${Permission}=TRUE` ],
        [ `${Permission}=0` ], [ Permission, "false" ], [ Permission, `${Permission}=false` ] ])
    {
        Assert.throws(() => parseBuildArguments(Args), Error, JSON.stringify(Args));
    }

    const Root = await fixture(context);
    const Config = Path.join(Root, "bedform.config.json");
    for (const Configured of [ undefined, false, true ])
    {
        await Fs.writeFile(Config, JSON.stringify(Configured === undefined ? {} :
            { Development: { AllowDevelopmentModulesInProduction: Configured } }));
        for (const Flag of [ undefined, false, true ])
        {
            const Logs: Array<string> = [];
            const Prepared = await prepareBuild({ root: Root,
                allowDevelopmentModulesInProduction: Flag }, (message) => Logs.push(message));
            Assert.equal(Prepared.settings.development, false);
            Assert.equal(Prepared.settings.allowDevelopmentModulesInProduction, Flag ?? Configured ?? false);
            Assert.equal(Logs.length, Flag !== undefined && Configured !== undefined ? 1 : 0);
            if (Logs.length)
            {
                Assert.equal(Logs[0], `Development.AllowDevelopmentModulesInProduction override: config=${Configured}, ${Permission}=${Flag}`);
            }
        }
    }

    await Fs.writeFile(Path.join(Root, "settings.ts"), `
        import {writeFileSync} from "node:fs";
        writeFileSync(${JSON.stringify(Path.join(Root, "evaluated"))}, "evaluated");
        export default {};
    `);
    const Bin = fileURLToPath(new URL("../Distribution/Bin.js", import.meta.url));
    for (const Flags of [ [ `${Permission}=invalid` ], [ "--development", "--development" ] ])
    {
        Assert.throws(() => execFileSync(process.execPath, [ Bin, "build", "--config", "settings.ts", ...Flags ],
            { cwd: Root,
                encoding: "utf8",
                stdio: "pipe" }));
    }

    await Assert.rejects(Fs.stat(Path.join(Root, "evaluated")), /ENOENT/u);
});
