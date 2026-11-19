/**
 * Schema resolution from manual choices, detection and the fallback setting, and the detection cache.
 *
 * @module bds-intellisense/Test/Resolution.test
 *
 * @file      Resolution.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import { Detection, Resolution, Version } from "bds-intellisense";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import Assert from "node:assert/strict";
import { Catalog } from "./Fixture.mts";
import { test } from "node:test";
import { tmpdir } from "node:os";

/** A detection result as the executable would give it. */
const Detected: Detection.DetectedVersion = {
    Evidence: "C:\\Server\\bedrock_server.exe",
    Source: "Executable",
    Version: [ 1, 20, 81, 1 ]
};

/**
 * A detector and the number of times it has run.
 */
interface CountingDetector
{
    readonly Calls: () => number;
    readonly Detect: () => Promise<Detection.DetectedVersion | undefined>;
}

/**
 * A detector that records how often it ran.
 */
function Detector(result: Detection.DetectedVersion | undefined): CountingDetector
{
    let calls: number = 0;
    return {
        Calls: () => calls,
        Detect: async () =>
        {
            calls++;
            return result;
        }
    };
}

/**
 * Resolves with the fixture catalog and summarizes the result as `origin version schema`.
 */
async function Summary(
    settings: Resolution.ResolutionSettings,
    detect: () => Promise<Detection.DetectedVersion | undefined>): Promise<string>
{
    const resolved: Resolution.ResolvedSchema = await Resolution.ResolveSchema(Catalog, settings, detect);
    const schema: string = Version.Format(resolved.Schema.Version);
    return `${resolved.Origin} ${Version.Format(resolved.Version)} ${schema}`;
}

test("a manual choice wins without running detection", async () =>
{
    const detector: CountingDetector = Detector(Detected);
    Assert.equal(await Summary({
        DetectVersion: true,
        FallbackVersion: "latest",
        ManualVersion: [ 1, 16, 0 ]
    }, detector.Detect), "Manual 1.16.0 1.16.0");

    Assert.equal(detector.Calls(), 0);
});

test("a detected release selects its schema and keeps its own version for display", async () =>
{
    const resolved: Resolution.ResolvedSchema = await Resolution.ResolveSchema(Catalog, {
        DetectVersion: true,
        FallbackVersion: "1.16.0"
    }, Detector(Detected).Detect);

    Assert.equal(resolved.Origin, "Detected");
    Assert.equal(resolved.Detected, Detected);
    Assert.deepEqual(resolved.Version, [ 1, 20, 81, 1 ]);
    Assert.equal(Version.Format(resolved.Schema.Version), "1.20.0");
    Assert.match(resolved.Notes[0], /server executable: C:\\Server\\bedrock_server\.exe/u);
});

test("failed detection uses the fallback version and says why", async () =>
{
    const resolved: Resolution.ResolvedSchema = await Resolution.ResolveSchema(Catalog, {
        DetectVersion: true,
        FallbackVersion: "latest"
    }, Detector(undefined).Detect);

    Assert.equal(resolved.Origin, "Fallback");
    Assert.equal(resolved.Schema, Catalog.Latest);
    Assert.match(resolved.Notes[0], /No Bedrock Dedicated Server installation/u);
});

test("disabled detection skips the detector and honours a fallback version", async () =>
{
    const detector: CountingDetector = Detector(Detected);
    Assert.equal(await Summary({
        DetectVersion: false,
        FallbackVersion: "1.21.4"
    }, detector.Detect), "Fallback 1.21.4 1.20.0");

    Assert.equal(detector.Calls(), 0);
});

test("an unreadable fallback setting falls back to the latest schema with a note", async () =>
{
    const resolved: Resolution.ResolvedSchema = await Resolution.ResolveSchema(Catalog, {
        DetectVersion: false,
        FallbackVersion: "newest"
    }, Detector(undefined).Detect);

    Assert.equal(resolved.Schema, Catalog.Latest);
    Assert.deepEqual(resolved.Version, Catalog.Latest.Version);
    Assert.equal(resolved.Notes.length, 2);
    Assert.match(resolved.Notes[1], /"newest" is neither "latest" nor a version/u);
});

test("the detection cache reuses results until the server files change or it is cleared", async () =>
{
    const directory: string = await mkdtemp(Path.join(tmpdir(), "bds-intellisense-cache-"));
    try
    {
        await mkdir(Path.join(directory, "behavior_packs"));
        await writeFile(Path.join(directory, "bedrock_server.exe"), "one");
        const detector: CountingDetector = Detector(Detected);
        const cache: Resolution.DetectionCache = Resolution.CreateDetectionCache(detector.Detect);

        Assert.equal(await cache.Detect(directory), Detected);
        Assert.equal(await cache.Detect(directory), Detected);
        Assert.equal(detector.Calls(), 1, "unchanged files reuse the result");

        await writeFile(Path.join(directory, "bedrock_server.exe"), "a longer executable");
        await cache.Detect(directory);
        Assert.equal(detector.Calls(), 2, "a replaced executable is detected again");

        await mkdir(Path.join(directory, "resource_packs"));
        await cache.Detect(directory);
        Assert.equal(detector.Calls(), 3, "a new pack folder is detected again");

        cache.Clear();
        await cache.Detect(directory);
        Assert.equal(detector.Calls(), 4, "clearing forgets the result");
    }
    finally
    {
        await rm(directory, {
            force: true,
            recursive: true
        });
    }
});
