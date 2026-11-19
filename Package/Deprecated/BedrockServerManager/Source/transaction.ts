/**
 * Server mutation lock and a rollback journal for pack and JSON replacements.
 *
 * @module bedrock-server-manager/transaction
 *
 * @file      transaction.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, Exit, FileSystem, Path } from "effect";
import { acquireServerLock } from "./server-lock.js";
import { mutationPath } from "./safety.js";

/** A staged file or directory to replace at a validated server-relative destination. */
export interface Replacement
{
    readonly destination: string;
    readonly staged: string | null;
    readonly mustBeAbsent?: boolean;
    readonly allowDirectory?: boolean;
}
/** Lock-owned workspace shared by installation and activation transactions. */
export interface Transaction
{
    readonly server: string;
    readonly stage: string;
    readonly commit: (changes: Array<Replacement>) => Effect.Effect<void, unknown,
        FileSystem.FileSystem | Path.Path>;
}

/** Hold the per-server lock through validation, staging, commit, rollback and cleanup. */
const withTransaction = <Value, Err, Env>(server: string,
    body: (transaction: Transaction) => Effect.Effect<Value, Err, Env>) =>
    Effect.scoped(Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        let retainRecovery = false;
        const { metadata } = yield* acquireServerLock(server, "mutation.lock", () => retainRecovery);
        const stage = yield* Effect.acquireRelease(
            fs.makeTempDirectory({ directory: metadata, prefix: "stage-" }),
            (directory: string) => retainRecovery ? Effect.void
                : fs.remove(directory, { recursive: true }).pipe(Effect.orDie));

        const commit = (changes: Array<Replacement>) => Effect.uninterruptible(Effect.gen(function*()
        {
            const journal: Array<{
                destination: string; backup: string | null; touched: boolean; directory: boolean
            }> = [];
            const created: Array<string> = [];
            const targets = new Set<string>();
            // Save every original before any destination is replaced.
            for (const change of changes)
            {
                yield* mutationPath(server, change.destination);
                const key = path.sep === "\\" ? BedrockString.toLowerCase(path.normalize(change.destination))
                    : path.normalize(change.destination);
                if (targets.has(key))
                {
                    return yield* Effect.fail(new Error("Duplicate transaction destination."));
                }
                targets.add(key);
                const exists = yield* fs.exists(change.destination);
                if (exists && change.mustBeAbsent)
                {
                    return yield* Effect.fail(new Error(`Conflicting installation: ${change.destination}`));
                }
                const backup = exists ? path.join(stage, `backup-${journal.length}`) : null;
                let directory = false;
                if (backup)
                {
                    const stat = yield* fs.stat(change.destination);
                    directory = stat.type === "Directory";
                    if (stat.type !== "File" && !(directory && change.allowDirectory))
                    {
                        return yield* Effect.fail(new Error(
                            `Refusing to replace existing directory: ${change.destination}`
                        ));
                    }
                    if (!directory)
                    {
                        yield* fs.copyFile(change.destination, backup);
                    }
                }
                if (!exists && change.staged === null)
                {
                    return yield* Effect.fail(new Error(`Removal target is missing: ${change.destination}`));
                }
                journal.push({ backup, destination: change.destination, directory, touched: false });
            }
            yield* fs.writeFileString(path.join(stage, "journal.json"), JSON.stringify(journal, null, 2));
            const result = yield* Effect.exit(Effect.gen(function*()
            {
                for (let index = 0; index < changes.length; index++)
                {
                    const change = changes[index];
                    yield* mutationPath(server, change.destination);
                    const parent = path.dirname(change.destination);
                    if (!(yield* fs.exists(parent)))
                    {
                        created.push(parent);
                        yield* fs.makeDirectory(parent);
                    }
                    journal[index].touched = true;
                    const entry = journal[index];
                    if (entry.directory || change.staged === null)
                    {
                        yield* fs.rename(change.destination, entry.backup!);
                    }
                    if (change.staged !== null)
                    {
                        yield* fs.rename(change.staged, change.destination);
                    }
                }
            }));
            if (Exit.isSuccess(result))
            {
                return;
            }
            const failed: Array<string> = [];
            for (const entry of journal.reverse())
            {
                if (!entry.touched)
                {
                    continue;
                }
                const restored = yield* Effect.exit(Effect.gen(function*()
                {
                    yield* mutationPath(server, entry.destination);
                    if (entry.backup)
                    {
                        if (yield* fs.exists(entry.backup))
                        {
                            if (entry.directory && (yield* fs.exists(entry.destination)))
                            {
                                yield* fs.remove(entry.destination, { recursive: true });
                            }
                            yield* fs.rename(entry.backup, entry.destination);
                        }
                    }
                    else if (yield* fs.exists(entry.destination))
                    {
                        yield* fs.remove(entry.destination, { recursive: true });
                    }
                }));
                if (Exit.isFailure(restored))
                {
                    failed.push(entry.destination);
                }
            }
            for (const directory of created.reverse())
            {
                const contents = yield* Effect.result(fs.readDirectory(directory));
                if (contents._tag === "Success" && contents.success.length === 0)
                {
                    yield* mutationPath(server, directory).pipe(Effect.orDie);
                    yield* fs.remove(directory, { recursive: true }).pipe(Effect.ignore);
                }
            }
            if (failed.length)
            {
                retainRecovery = true;
                return yield* Effect.fail(new Error(
                    `Rollback incomplete for ${failed.join(", ")}; backups retained at ${stage}. ` +
                "The mutation lock is retained for manual recovery."
                ));
            }
            return yield* Effect.failCause(result.cause);
        }));
        return yield* body({ commit, server, stage });
    }));

export { withTransaction };
