/**
 * Disposable checkpoint integrity, rollback boundaries and unrelated-world preservation.
 *
 * @module monorepo-setup/Test/Qualification.test
 *
 * @file      Qualification.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    MeasureTree,
    QualificationPaths,
    RestoreWorldCheckpoint,
    SaveWorldCheckpoint
} from "../Source/Qualification.js";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { tmpdir } from "node:os";

test("checkpoint reset reproduces measured files and preserves shared configuration and worlds", async () =>
{
    const root = await mkdtemp(join(tmpdir(), "bedform-checkpoint-"));
    try
    {
        const runId = `cinnabar-env-${randomUUID()}`;
        const paths = await QualificationPaths(root, runId);
        await mkdir(paths.world);
        await writeFile(join(paths.world, "level.dat"), "saved world");
        await writeFile(join(paths.runtime, "server.properties"), "unrelated configuration");
        const other = join(paths.runtime, "worlds/other");
        await mkdir(other);
        await writeFile(join(other, "level.dat"), "unrelated world");
        const checkpoint = await SaveWorldCheckpoint(root, runId);
        await writeFile(join(paths.world, "level.dat"), "mutated");
        await writeFile(join(paths.world, "extra"), "created after checkpoint");
        await RestoreWorldCheckpoint(root, runId);
        assert.deepEqual(await MeasureTree(paths.world), checkpoint.files);
        assert.equal(await readFile(join(other, "level.dat"), "utf8"), "unrelated world");
        assert.equal(
            await readFile(join(paths.runtime, "server.properties"), "utf8"),
            "unrelated configuration"
        );
        await writeFile(join(paths.run, "world-checkpoint/level.dat"), "corrupt snapshot");
        await writeFile(join(paths.world, "level.dat"), "retained current world");
        await assert.rejects(RestoreWorldCheckpoint(root, runId), /corrupt/);
        assert.equal(
            await readFile(join(paths.world, "level.dat"), "utf8"),
            "retained current world"
        );
    }
    finally
    {
        await rm(root, { force: true,
            recursive: true });
    }
});

test("arbitrary worlds and checkpoint junctions fail before external writes", async () =>
{
    const root = await mkdtemp(join(tmpdir(), "bedform-checkpoint-boundary-"));
    const outside = await mkdtemp(join(tmpdir(), "bedform-checkpoint-outside-"));
    try
    {
        await assert.rejects(QualificationPaths(root, "../../unrelated"), /Invalid/);
        await symlink(outside, join(root, "dist"), "junction");
        await assert.rejects(QualificationPaths(root, `cinnabar-env-${randomUUID()}`), /escapes/);
        assert.deepEqual(await MeasureTree(outside), []);
    }
    finally
    {
        await rm(root, { force: true,
            recursive: true });
        await rm(outside, { force: true,
            recursive: true });
    }
});
