/**
 * Common artifact validation and staged dependency behavior for complete add-on builds.
 *
 * @module bedform/Test/Common.test
 *
 * @file      Common.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures preserve manifest order and contextual callback inference. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef, @stylistic/max-len */

import Assert from "node:assert/strict";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { test, type TestContext } from "node:test";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import { stageCommon, stageCommonDependency } from "../Distribution/Build/Common.js";
import { buildAddon } from "../Distribution/Build/Addon.js";
import { prepareBuild } from "../Distribution/Build/Settings.js";

/**
 * Creates an isolated owned test directory with automatic cleanup.
 *
 * @category Testing
 * @since 1.0.0
 */
const directory = async (context: TestContext): Promise<string> =>
{
    const root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-common-build-"));
    context.after(async () =>
    {
        Assert.ok(Path.resolve(root).startsWith(Path.resolve(tmpdir()) + Path.sep));
        await Fs.rm(root, { recursive: true,
            force: true });
    });
    return root;
};

test("artifact resolution is package-relative and rejects missing, corrupt and inconsistent bundles", async (context) =>
{
    const root = await directory(context);
    const module = Path.join(root, "Distribution/Build/Common.js");
    await Fs.cp(new URL("../Distribution/", import.meta.url), Path.join(root, "Distribution"),
        { recursive: true });
    await Fs.writeFile(Path.join(root, "package.json"), "{\"type\":\"module\"}");
    await Fs.symlink(fileURLToPath(new URL("../../../node_modules", import.meta.url)),
        Path.join(root, "node_modules"), "junction");
    const isolated: typeof import("../Distribution/Build/Common.js") = await import(pathToFileURL(module).href);
    const workspace = Path.join(root, "stage");
    await Assert.rejects(isolated.stageCommon(workspace), /Cannot load bundled BedformCommon artifact.*Reinstall/u);
    await Fs.mkdir(Path.join(root, "Asset"));
    const artifact = Path.join(root, "Asset/bedform-common.mcaddon");
    const bytes = await Fs.readFile(new URL("../Asset/bedform-common.mcaddon", import.meta.url));
    const outer = unzipSync(bytes);
    const behaviorFiles = unzipSync(outer["bedform-common-bp.mcpack"]);
    const manifest = JSON.parse(strFromU8(behaviorFiles["manifest.json"]));
    const behavior = (change: (value: typeof manifest) => void, files = behaviorFiles) =>
    {
        const copy = JSON.parse(JSON.stringify(manifest));
        change(copy);
        return zipSync({ ...outer,
            "bedform-common-bp.mcpack": zipSync({ ...files,
                "manifest.json": Buffer.from(JSON.stringify(copy)) }) });
    };

    const withoutScript = { ...behaviorFiles };
    delete withoutScript["scripts/main.js"];
    for (const invalid of [ Buffer.from("corrupt"), zipSync({}),
        zipSync({ ...outer,
            "unexpected.mcpack": outer["bedform-common-bp.mcpack"] }),
        behavior((value) => { value.dependencies[0].version = [ 99, 0, 0 ]; }),
        behavior(() => {}, withoutScript),
        behavior((value) => { value.modules[1].uuid = "82d1ef5f-0000-0000-0000-000000000000"; }),
        behavior((value) => { value.modules.pop(); }),
        behavior((value) => { value.dependencies.pop(); }),
        behavior((value) => { value.dependencies[1].version = "latest"; }) ])
    {
        await Fs.writeFile(artifact, invalid);
        await Assert.rejects(isolated.stageCommon(workspace), /Cannot load bundled BedformCommon artifact/u);
        await Assert.rejects(Fs.stat(workspace), /ENOENT/u);
    }

    await Fs.writeFile(artifact, bytes);
    const packs = await isolated.stageCommon(workspace);
    Assert.equal(packs.length, 2);
    for (const pack of packs)
    {
        Assert.deepEqual(await Fs.readFile(pack.archive), Buffer.from(outer[Path.basename(pack.archive)]));
    }

    const abort = new AbortController();
    abort.abort(new Error("cancelled common staging"));
    await Assert.rejects(isolated.stageCommon(Path.join(root, "cancelled"), abort.signal), /cancelled common/u);
    await Assert.rejects(Fs.stat(Path.join(root, "cancelled")), /ENOENT/u);

    const project = Path.join(root, "project");
    await Fs.mkdir(Path.join(project, "resource_packs/consumer"), { recursive: true });
    await Fs.writeFile(Path.join(project, "resource_packs/consumer/manifest.json"), JSON.stringify({
        format_version: 2,
        header: { uuid: "isolated-consumer" },
        modules: [ { type: "resources",
            uuid: "isolated-module" } ] }));
    const installed: typeof import("../Distribution/Build/Addon.js") =
        await import(pathToFileURL(Path.join(root, "Distribution/Build/Addon.js")).href);
    const prepared = await prepareBuild({ root: project,
        output: "result.mcaddon" }, () => {});
    const result = await installed.buildAddon(prepared);
    const prior = await Fs.readFile(result.archive);
    await Fs.rm(artifact);
    await Assert.rejects(installed.buildAddon(prepared), /workspace retained.*Cannot load bundled BedformCommon/u);
    Assert.deepEqual(await Fs.readFile(result.archive), prior);
    await Fs.writeFile(artifact, "corrupt");
    await Assert.rejects(installed.buildAddon(prepared), /workspace retained.*Cannot load bundled BedformCommon/u);
    Assert.deepEqual(await Fs.readFile(result.archive), prior);
});

test("staged dependencies preserve other entries, reuse matches and reject conflicts or reserved UUIDs", async (context) =>
{
    const root = await directory(context);
    const packs = await stageCommon(root);
    const file = Path.join(root, "manifest.json");
    const original = { header: { uuid: "consumer" },
        modules: [ { uuid: "consumer-module" } ],
        extra: { retained: true },
        dependencies: [ { module_name: "@minecraft/server",
            version: "2.10.0" },
        { uuid: "another-pack",
            version: [ 8, 0, 0 ] } ] };
    for (const target of packs)
    {
        const match = { uuid: target.uuid.toUpperCase(),
            version: target.version,
            retained: true };
        for (const existing of [ [], [ match ], [ match, match ] ])
        {
            await Fs.writeFile(file, JSON.stringify({ ...original,
                dependencies: [ ...original.dependencies, ...existing ] }));
            await stageCommonDependency(file, target.kind, packs);
            const actual = JSON.parse(await Fs.readFile(file, "utf8"));
            Assert.deepEqual(actual, { ...original,
                dependencies: [ ...original.dependencies,
                    existing.length ? match : { uuid: target.uuid,
                        version: target.version } ] });
        }

        for (const version of [ [ 2, 0, 0 ], "1.0.0", null ])
        {
            const bytes = JSON.stringify({ ...original,
                dependencies: [ { uuid: target.uuid,
                    version } ] });
            await Fs.writeFile(file, bytes);
            await Assert.rejects(stageCommonDependency(file, target.kind, packs), /Conflicting BedformCommon dependency/u);
            Assert.equal(await Fs.readFile(file, "utf8"), bytes);
        }

        const targetManifest = JSON.parse(strFromU8(unzipSync(await Fs.readFile(target.archive))["manifest.json"]));
        for (const reserved of [ target.uuid, ...targetManifest.modules.map((module: { uuid: string }) => module.uuid) ])
        {
            for (const location of [ "header", "module" ])
            {
                const bytes = JSON.stringify({ ...original,
                    ...(location === "header" ? { header: { uuid: reserved.toUpperCase() } } :
                        { modules: [ { uuid: reserved } ] }) });
                await Fs.writeFile(file, bytes);
                await Assert.rejects(stageCommonDependency(file, target.kind, packs), /includes these packs automatically/u);
                Assert.equal(await Fs.readFile(file, "utf8"), bytes);
            }
        }
    }
});

test("content-only complete builds include both common packs and preserve sources and previous output", async (context) =>
{
    const root = await directory(context);
    const artifact = unzipSync(await Fs.readFile(new URL("../Asset/bedform-common.mcaddon", import.meta.url)));
    const originals = new Map<string, string>();
    for (const [ kind, type ] of [ [ "behavior_packs", "data" ], [ "resource_packs", "resources" ] ])
    {
        const file = Path.join(root, kind, "consumer/manifest.json");
        await Fs.mkdir(Path.dirname(file), { recursive: true });
        const text = JSON.stringify({ format_version: 2,
            header: { name: "Consumer",
                uuid: `${type}-consumer`,
                version: [ 1, 0, 0 ] },
            modules: [ { type,
                uuid: `${type}-module`,
                version: [ 1, 0, 0 ] } ] });
        originals.set(file, text);
        await Fs.writeFile(file, text);
    }

    for (const selected of [ "both", "behavior", "resource" ])
    {
        await Fs.writeFile(Path.join(root, "bedform.config.json"), JSON.stringify({ build: {
            ...(selected === "resource" ? { behaviorPacks: [] } : {}),
            ...(selected === "behavior" ? { resourcePacks: [] } : {}) } }));
        const prepared = await prepareBuild({ root,
            output: "result.mcaddon" }, () => {});
        const result = await buildAddon(prepared);
        const outer = unzipSync(await Fs.readFile(result.archive));
        Assert.equal(Object.keys(outer).length, selected === "both" ? 4 : 3);
        for (const [ name, bytes ] of Object.entries(artifact))
        {
            Assert.deepEqual(outer[name], bytes);
        }

        const common = await stageCommon(Path.join(root, "expected"));
        for (const [ file, text ] of originals)
        {
            Assert.equal(await Fs.readFile(file, "utf8"), text);
            const kind = file.includes("behavior_packs") ? "behavior_packs" : "resource_packs";
            if (selected === "both" || selected === "behavior" && kind === "behavior_packs" ||
                selected === "resource" && kind === "resource_packs")
            {
                const manifest = JSON.parse(await Fs.readFile(Path.join(result.workspace, "source", Path.relative(root, file)), "utf8"));
                const target = common.find((pack) => pack.kind === kind)!;
                Assert.deepEqual(manifest.dependencies, [ { uuid: target.uuid,
                    version: target.version } ]);
            }
        }

        const kind = selected === "resource" ? "resource_packs" : "behavior_packs";
        const file = Path.join(root, kind, "consumer/manifest.json");
        const original = JSON.parse(originals.get(file)!);
        const target = common.find((pack) => pack.kind === kind)!;
        const unrelated = { uuid: "another-pack",
            version: [ 7, 0, 0 ] };
        const matching = { uuid: target.uuid,
            version: target.version,
            retained: "matching dependency" };
        const authored = JSON.stringify({ ...original,
            dependencies: [ unrelated, matching, matching ] });
        await Fs.writeFile(file, authored);
        const reused = await buildAddon(prepared);
        const reusedOuter = unzipSync(await Fs.readFile(reused.archive));
        // With both kinds selected, behavior is index zero; resource-only also starts at zero.
        const reusedManifest = JSON.parse(strFromU8(unzipSync(reusedOuter["0-consumer.mcpack"])["manifest.json"]));
        Assert.deepEqual(reusedManifest.dependencies, [ unrelated, matching ]);
        Assert.equal(await Fs.readFile(file, "utf8"), authored);
        const prior = await Fs.readFile(reused.archive);
        for (const manifest of [ { ...original,
            dependencies: [ { uuid: target.uuid,
                version: [ 9, 0, 0 ] } ] },
        { ...original,
            header: { ...original.header,
                uuid: target.uuid } } ])
        {
            const bytes = JSON.stringify(manifest);
            await Fs.writeFile(file, bytes);
            await Assert.rejects(buildAddon(prepared), /workspace retained.*(Conflicting BedformCommon|includes these packs automatically)/u);
            Assert.deepEqual(await Fs.readFile(result.archive), prior);
            Assert.equal(await Fs.readFile(file, "utf8"), bytes);
        }

        await Fs.writeFile(file, originals.get(file)!);
    }
});
