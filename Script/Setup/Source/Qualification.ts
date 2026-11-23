/**
 * Scoped disposable-world checkpoints for repeatable native environment experiments.
 *
 * @module monorepo-setup/Qualification
 *
 * @file      Qualification.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import {
    cp,
    lstat,
    mkdir,
    readFile,
    readdir,
    realpath,
    rename,
    rm,
    writeFile
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

/**
 * A content-measured checkpoint; no executable paths, credentials or external worlds are accepted.
 *
 * @category Model
 * @since 1.0.0
 */
export interface WorldCheckpoint {
    readonly schemaVersion: 1;
    readonly runId: string;
    readonly files: ReadonlyArray<CheckpointFile>;
}

/**
 * One regular file relative to a disposable world's root.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CheckpointFile {
    readonly name: string;
    readonly sha256: string;
}

/**
 * Measures regular files without following junctions or trusting completion markers.
 *
 * @throws { Error } When a tree contains links or unreadable entries.
 *
 * @category Testing
 * @since 1.0.0
 */
export const MeasureTree = async (root: string): Promise<ReadonlyArray<CheckpointFile>> =>
{
    const files: Array<CheckpointFile> = [];
    const walk = async (directory: string): Promise<void> =>
    {
        const info = await lstat(directory);
        if (info.isSymbolicLink() || !info.isDirectory())
        {
            throw new Error(`Checkpoint directory is not an ordinary directory: ${directory}`);
        }

        for (const entry of await readdir(directory, { withFileTypes: true }))
        {
            const file = path.join(directory, entry.name);
            if (entry.isSymbolicLink())
            {
                throw new Error(`Checkpoint cannot follow a link: ${file}`);
            }

            if (entry.isDirectory())
            {
                await walk(file);
            }
            else if (entry.isFile())
            {
                files.push({
                    name: path.relative(root, file).split(path.sep).join("/"),
                    sha256: createHash("sha256")
                        .update(await readFile(file))
                        .digest("hex")
                });
            }
            else
            {
                throw new Error(`Checkpoint contains an unsupported entry: ${file}`);
            }
        }
    };

    await walk(root);
    return files.sort((left: CheckpointFile, right: CheckpointFile) =>
        left.name.localeCompare(right.name)
    );
};

/**
 * Derives all mutable paths from a validated run identifier and fixed package runtime.
 *
 * @throws { Error } When a caller supplies an arbitrary world or a junction outside the package.
 *
 * @category Guard
 * @since 1.0.0
 */
export const QualificationPaths = async (packageRoot: string, runId: string) =>
{
    if (!/^cinnabar-env-[a-f0-9-]{36}$/.test(runId))
    {
        throw new Error("Invalid qualification run identifier.");
    }

    const root = await realpath(packageRoot);
    const runtime = path.join(root, "dist/bds-runtime");
    const runs = path.join(root, "dist/cinnabar-environment");
    const worlds = path.join(runtime, "worlds");
    for (const directory of [ path.join(root, "dist"), runtime, worlds, runs ])
    {
        await mkdir(directory).catch((error: unknown) =>
        {
            if (!(
                error !== null &&
                typeof error === "object" &&
                "code" in error &&
                error.code === "EEXIST"
            ))
            {
                throw error;
            }
        });
        if (
            !(await lstat(directory)).isDirectory() ||
            (await lstat(directory)).isSymbolicLink() ||
            path.relative(root, await realpath(directory)).startsWith("..")
        )
        {
            throw new Error(`Qualification path escapes the package: ${directory}`);
        }
    }

    const run = path.join(runs, runId);
    await mkdir(run, { recursive: true });
    if ((await lstat(run)).isSymbolicLink())
    {
        throw new Error("Qualification run cannot be a junction.");
    }

    return { run,
        runtime,
        world: path.join(worlds, `${runId}-bootstrap`) };
};

/**
 * Saves a stopped disposable world, excluding global tools and all unrelated server contents.
 * The caller holds the package BDS lease and verifies no process owns the executable.
 *
 * @throws { Error } When ownership or measured checkpoint content is invalid.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const SaveWorldCheckpoint = async (
    packageRoot: string,
    runId: string
): Promise<WorldCheckpoint> =>
{
    const paths = await QualificationPaths(packageRoot, runId);
    const files = await MeasureTree(paths.world);
    const checkpoint: WorldCheckpoint = { files,
        runId,
        schemaVersion: 1 };
    if (!files.some((file: CheckpointFile) => file.name === "level.dat"))
    {
        throw new Error("A saved level.dat is required before checkpointing.");
    }

    await cp(paths.world, path.join(paths.run, "world-checkpoint"), {
        errorOnExist: true,
        force: false,
        recursive: true
    });
    await writeFile(path.join(paths.run, "checkpoint.json"), JSON.stringify(checkpoint, null, 2), {
        flag: "wx"
    });
    return checkpoint;
};

/**
 * Restores only the named disposable world after remeasuring the entire checkpoint.
 * Failed publication rolls back; unrelated packs, configuration and worlds are never reset.
 * The caller must hold the package lease and establish that BDS is stopped.
 *
 * @throws { Error } When ownership, checkpoint integrity or atomic publication fails.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const RestoreWorldCheckpoint = async (packageRoot: string, runId: string): Promise<void> =>
{
    const paths = await QualificationPaths(packageRoot, runId);
    const checkpoint = JSON.parse(await readFile(path.join(paths.run, "checkpoint.json"), "utf8"));
    const source = path.join(paths.run, "world-checkpoint");
    if (
        checkpoint.schemaVersion !== 1 ||
        checkpoint.runId !== runId ||
        JSON.stringify(await MeasureTree(source)) !== JSON.stringify(checkpoint.files)
    )
    {
        throw new Error("Qualification checkpoint is corrupt or belongs to another run.");
    }

    await MeasureTree(paths.world);
    const transaction = path.join(paths.run, `reset-${randomUUID()}`);
    await mkdir(transaction);
    const staged = path.join(transaction, "new");
    const previous = path.join(transaction, "previous");
    let moved = false;
    let published = false;
    let safeToClean = true;
    try
    {
        await cp(source, staged, { errorOnExist: true,
            force: false,
            recursive: true });
        if (JSON.stringify(await MeasureTree(staged)) !== JSON.stringify(checkpoint.files))
        {
            throw new Error("Staged qualification checkpoint failed verification.");
        }

        await rename(paths.world, previous);
        moved = true;
        safeToClean = false;
        await rename(staged, paths.world);
        published = true;
        safeToClean = true;
    }
    catch (error: unknown)
    {
        safeToClean = false;
        if (published)
        {
            await rename(paths.world, staged);
        }

        if (moved)
        {
            await rename(previous, paths.world);
        }

        safeToClean = true;
        throw error;
    }
    finally
    {
        // This absolute transaction path is constructed only below the validated package run directory.
        if (safeToClean)
        {
            await rm(transaction, { force: true,
                recursive: true });
        }
    }
};
