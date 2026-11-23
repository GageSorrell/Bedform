/**
 * Verified archive decoding and actual cache-byte checks without network access or installers.
 *
 * @module monorepo-setup/Test/PrerequisiteNode.test
 *
 * @file      PrerequisiteNode.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    ArchiveFiles,
    ArchiveReady,
    ArtifactDigest,
    PrerequisiteHostLayer,
    VerifyArtifact
} from "../Source/PrerequisiteNode.js";
import { Effect, Layer } from "effect";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { NodeServices } from "@effect/platform-node";
import { PrerequisiteHost } from "../Source/Prerequisite.js";
import type { TestContext } from "node:test";
import type { ToolArtifact } from "../Source/Prerequisite.js";
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";
import { zipSync } from "fflate";

/**
 * Pins test ZIP bytes using the same hash contract as checked installer manifests.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Artifact = (bytes: Uint8Array): ToolArtifact => ({
    sha256: ArtifactDigest(bytes, "sha256"),
    url: "https://example.invalid/pinned.zip"
});

test("injected downloads preserve prior inputs and clean transactions", async (context: TestContext) =>
{
    const host = await Effect.runPromise(PrerequisiteHost.pipe(Effect.provide(
        PrerequisiteHostLayer.pipe(Layer.provide(NodeServices.layer)))));
    const directory = await Effect.runPromise(host.temporary);
    const bytes = zipSync({ "nested/input": Buffer.from("original") });
    let payload: Uint8Array = bytes;
    context.mock.method(globalThis, "fetch", async () =>
    {
        const response = new Response(Buffer.from(payload));
        Object.defineProperty(response, "url", { value: "https://example.invalid/pinned.zip" });
        return response;
    });
    try
    {
        const artifact = Artifact(bytes);
        const cache = join(directory, "cache");
        await Effect.runPromise(host.archive(artifact, cache));
        assert.equal(await Effect.runPromise(host.archiveReady(artifact, cache)), true);
        const input = join(directory, "input.bin");
        await Effect.runPromise(host.file(artifact, input));
        assert.deepEqual(await readFile(input), Buffer.from(bytes));
        await assert.rejects(Effect.runPromise(host.file(artifact, input)), /EEXIST/);
        payload = Buffer.from("corrupt download");
        await assert.rejects(Effect.runPromise(host.archive(artifact, cache)), /checksum/);
        assert.equal(await Effect.runPromise(host.archiveReady(artifact, cache)), true);
        assert.equal((await readdir(directory)).some((name: string) =>
            name.startsWith(".bedform-prerequisite-")), false);
        await assert.rejects(Effect.runPromise(host.cleanup(join(directory, "unowned"))), /unowned/);
    }
    finally
    {
        await Effect.runPromise(host.cleanup(directory));
    }
});

test("SHA-256 and framed Git blob checks reject mismatches and unpinned artifacts", () =>
{
    const bytes = Buffer.from("test\n");
    assert.equal(ArtifactDigest(bytes, "gitBlob"), "9daeafb9864cf43055ae93beb0afd6c7d144bfa4");
    assert.doesNotThrow(() => VerifyArtifact(Artifact(bytes), bytes));
    assert.doesNotThrow(() =>
        VerifyArtifact(
            { gitBlob: ArtifactDigest(bytes, "gitBlob"),
                url: "https://example.invalid/input" },
            bytes
        )
    );
    assert.throws(() => VerifyArtifact(Artifact(bytes), Buffer.from("changed")), /checksum/);
    assert.throws(
        () => VerifyArtifact({ url: "https://example.invalid/input" }, bytes),
        /checksum/
    );
    assert.throws(() =>
        VerifyArtifact({ ...Artifact(bytes),
            url: "http://example.invalid/input" }, bytes)
    );
});

for (const name of [
    "../escape",
    "/absolute",
    "C:/drive",
    "a\\escape",
    "a/../escape",
    "NUL.bin",
    "file:stream",
    "a/trailing."
])
{
    test(`verified ZIP still rejects unsafe Windows path ${name}`, () =>
    {
        const bytes = zipSync({ [name]: Buffer.from("payload") });
        assert.throws(() => ArchiveFiles(Artifact(bytes), bytes), /Unsafe/);
    });
}

test("ZIP root restrictions and case collisions are checked after checksum verification", () =>
{
    const bytes = zipSync({ "root/A": Buffer.from("A"),
        "root/a": Buffer.from("a") });
    assert.throws(() => ArchiveFiles({ ...Artifact(bytes),
        prefix: "root/" }, bytes), /Unsafe/);
    assert.throws(
        () => ArchiveFiles({ ...Artifact(bytes),
            prefix: "different/" }, bytes),
        /Unexpected/
    );
    assert.throws(() => ArchiveFiles(Artifact(Buffer.from("different")), bytes), /checksum/);
});

test("Mojang inputs normalize the one optional wrapper and require the fork's source marker", () =>
{
    const marker = "resource_pack/blocks.json";
    for (const prefix of [ "", "bedrock-samples/" ])
    {
        const bytes = zipSync({ [`${prefix}${marker}`]: Buffer.from("{}") });
        const files = ArchiveFiles({ ...Artifact(bytes),
            marker }, bytes);
        assert.equal(Buffer.from(files.get(marker)!).toString(), "{}");
    }

    const bytes = zipSync({ "unrelated/file": Buffer.from("input") });
    assert.throws(() => ArchiveFiles({ ...Artifact(bytes),
        marker }, bytes), /source marker/);
});

test("cache readiness rehashes archive and every extracted file rather than trusting a marker", async () =>
{
    const directory = await mkdtemp(join(tmpdir(), "bedform-prerequisite-unit-"));
    try
    {
        const cache = join(directory, "cache");
        const bytes = zipSync({ "root/nested/input": Buffer.from("input") });
        const artifact = { ...Artifact(bytes),
            prefix: "root/" };
        assert.equal(await ArchiveReady(artifact, cache), false);
        await mkdir(join(cache, "nested"), { recursive: true });
        await writeFile(join(cache, "nested/input"), "input");
        await writeFile(`${cache}.source.zip`, bytes);
        assert.equal(await ArchiveReady(artifact, cache), true);
        await writeFile(join(cache, "nested/input"), "edited");
        assert.equal(await ArchiveReady(artifact, cache), false);
        await writeFile(join(cache, "nested/input"), "input");
        await writeFile(`${cache}.source.zip`, "corrupt");
        assert.equal(await ArchiveReady(artifact, cache), false);
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});
