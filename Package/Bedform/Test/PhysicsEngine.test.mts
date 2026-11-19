/**
 * Portable engine discovery for fresh checkouts and retained fixed runtimes.
 *
 * @module bedform/Test/PhysicsEngine.test
 *
 * @file      PhysicsEngine.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable sort-imports */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { physicsEngine, physicsTemplate } from "../Tool/physics-engine.mjs";

test("physics preparation discovers repo and cached engines without WorldRealism files", async () =>
{
    const Workspace = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-engine-"));
    const Root = Path.join(Workspace, "Package/Bedform");
    const RepoServer = Path.join(Workspace, "Server");
    const Cached = Path.join(Root, "dist/bds-runtime");
    const Explicit = Path.join(Workspace, "separate installation");
    const Install = async (directory: string): Promise<void> =>
    {
        await Fs.mkdir(Path.join(directory, "behavior_packs"), { recursive: true });
        await Fs.mkdir(Path.join(directory, "resource_packs"), { recursive: true });
        await Fs.writeFile(Path.join(directory, "bedrock_server.exe"), "test discovery only");
    };

    try
    {
        await Assert.rejects(physicsEngine(Root), /No local BDS installation found.*BDS_PATH/u);
        await Install(Cached);
        Assert.equal(await physicsEngine(Root), Cached);
        await Install(RepoServer);
        Assert.equal(await physicsEngine(Root), RepoServer);
        await Install(Explicit);
        Assert.equal(await physicsEngine(Root, Explicit), Explicit);
        await Assert.rejects(physicsEngine(Root, Path.join(Workspace, "missing")), /Invalid BDS_PATH/u);
        const Incomplete = Path.join(Workspace, "incomplete");
        await Fs.mkdir(Incomplete);
        await Fs.writeFile(Path.join(Incomplete, "bedrock_server.exe"), "missing stock packs");
        await Assert.rejects(physicsEngine(Root, Incomplete), /Invalid BDS_PATH.*behavior_packs/u);
    }
    finally
    {
        Assert.equal(Path.dirname(Path.resolve(Workspace)), Path.resolve(tmpdir()));
        Assert.ok(Path.basename(Workspace).startsWith("bedform-engine-"));
        await Fs.rm(Workspace, { force: true,
            recursive: true });
    }
});

test("template bootstrap restores existing or absent properties after a launch failure", async () =>
{
    const Workspace = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-engine-"));
    const Runtime = Path.join(Workspace, "runtime");
    const Run = Path.join(Workspace, "physics-bds-failure");
    const Properties = Path.join(Runtime, "server.properties");
    try
    {
        await Fs.mkdir(Runtime);
        await Fs.mkdir(Run);
        for (const Previous of [ undefined, "level-name=preserved-world\nserver-port=19142\n" ])
        {
            if (Previous !== undefined)
            {await Fs.writeFile(Properties, Previous);}

            // No executable exists; failure must release timers and restore settings.
            await Assert.rejects(physicsTemplate(Runtime, Run), /ENOENT/u);
            if (Previous === undefined)
            {await Assert.rejects(Fs.readFile(Properties), /ENOENT/u);}
            else
            {Assert.equal(await Fs.readFile(Properties, "utf8"), Previous);}

            Assert.equal(await Fs.readFile(Path.join(Run, "bootstrap.log"), "utf8"), "");
        }
    }
    finally
    {
        Assert.equal(Path.dirname(Path.resolve(Workspace)), Path.resolve(tmpdir()));
        Assert.ok(Path.basename(Workspace).startsWith("bedform-engine-"));
        await Fs.rm(Workspace, { force: true,
            recursive: true });
    }
});
