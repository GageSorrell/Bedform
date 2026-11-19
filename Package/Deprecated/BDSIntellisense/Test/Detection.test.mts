/**
 * Server version detection in temporary installations and in the installed server.
 *
 * @module bds-intellisense/Test/Detection.test
 *
 * @file      Detection.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import { Detection, Version } from "bds-intellisense";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import Assert from "node:assert/strict";
import { BdsPe } from "./PeFixture.mts";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { tmpdir } from "node:os";

/** The machine's BDS installation, used when present. */
const InstalledServer: string = "C:\\MineCraft\\Server";

/**
 * Runs a test body in a fresh temporary folder holding the given files, then removes the folder.
 * Paths ending in `/` become empty folders.
 */
async function InInstallation(
    files: Readonly<Record<string, Uint8Array | string>>,
    body: (directory: string) => Promise<void>): Promise<void>
{
    const directory: string = await mkdtemp(Path.join(tmpdir(), "bds-intellisense-"));
    try
    {
        for (const [ name, content ] of Object.entries(files))
        {
            const path: string = Path.join(directory, name);
            if (name.endsWith("/"))
            {
                await mkdir(path, { recursive: true });
            }
            else
            {
                await mkdir(Path.dirname(path), { recursive: true });
                await writeFile(path, content);
            }
        }

        await body(directory);
    }
    finally
    {
        await rm(directory, {
            force: true,
            recursive: true
        });
    }
}

/**
 * Summarizes a detection result as `source version`.
 */
function Summary(detected: Detection.DetectedVersion | undefined): string | undefined
{
    return detected === undefined ? undefined : `${detected.Source} ${Version.Format(detected.Version)}`;
}

test("the executable's file version wins over older vanilla packs", async () =>
{
    await InInstallation({
        "bedrock_server.exe": BdsPe,
        "behavior_packs/vanilla_1.26.60/": "",
        "server.properties": "gamemode=survival\n"
    }, async (directory: string) =>
    {
        const detected: Detection.DetectedVersion | undefined =
            await Detection.DetectServerVersion(Path.join(directory, "server.properties"));

        Assert.equal(Summary(detected), "Executable 1.26.63.1");
        Assert.equal(detected?.Evidence, Path.join(directory, "bedrock_server.exe"));
    });
});

test("without a readable executable, the newest vanilla pack folder is used", async () =>
{
    await InInstallation({
        bedrock_server: "\u007FELF",
        "bedrock_server.exe": "not an executable",
        "behavior_packs/vanilla/": "",
        "behavior_packs/vanilla_1.20.0/": "",
        "behavior_packs/vanilla_1.21.10/": "",
        "behavior_packs/vanilla_1.21.9/": "",
        "resource_packs/vanilla_1.21.2/": "",
        "resource_packs/vanilla_base/": ""
    }, async (directory: string) =>
    {
        const detected: Detection.DetectedVersion | undefined =
            await Detection.DetectServerVersionInDirectory(directory);

        Assert.equal(Summary(detected), "VanillaPacks 1.21.10");
        Assert.equal(detected?.Evidence, Path.join(directory, "behavior_packs", "vanilla_1.21.10"));
    });
});

test("resource packs alone are enough", async () =>
{
    await InInstallation({ "resource_packs/vanilla_1.19.83/": "" }, async (directory: string) =>
    {
        const detected: Detection.DetectedVersion | undefined =
            await Detection.DetectServerVersionInDirectory(directory);

        Assert.equal(Summary(detected), "VanillaPacks 1.19.83");
    });
});

test("a folder that is not a BDS installation yields undefined", async () =>
{
    await InInstallation({
        "behavior_packs/my_pack/": "",
        "server.properties": ""
    }, async (directory: string) =>
    {
        const properties: string = Path.join(directory, "server.properties");
        Assert.equal(await Detection.DetectServerVersion(properties), undefined);
        const missing: string = Path.join(directory, "missing");
        Assert.equal(await Detection.DetectServerVersionInDirectory(missing), undefined);
    });
});

test("DetectionInputs lists the executable and both pack folders", () =>
{
    Assert.deepEqual(Detection.DetectionInputs("root"), [
        Path.join("root", "bedrock_server.exe"),
        Path.join("root", "behavior_packs"),
        Path.join("root", "resource_packs")
    ]);
});

test("the installed server is detected from its executable", {
    skip: !existsSync(Path.join(InstalledServer, "bedrock_server.exe"))
}, async () =>
{
    const detected: Detection.DetectedVersion | undefined =
        await Detection.DetectServerVersion(Path.join(InstalledServer, "server.properties"));

    Assert.equal(Summary(detected), "Executable 1.26.63.1");
});
