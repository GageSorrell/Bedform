/**
 * Shared, session-owned directory locks for mutations and foreground servers.
 *
 * @module bedrock-server-manager/server-lock
 *
 * @file      server-lock.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path } from "effect";
import { mutationPath, rejectLinks } from "./safety.js";
import { randomUUID } from "node:crypto";

/** Explain conservative manual recovery without encouraging removal of a live owner's lock. */
const recoveryGuidance = (directory: string) =>
    `Inspect ${directory} and its owner.json. Confirm both recorded CLI/server PIDs have exited ` +
    "and no BDS uses this executable before removing leftover locks; recover pending addon journals first.";

/** Acquire atomically in a caller-owned scope; never reclaim existing or uncertain locks. */
const acquireServerLock = (server: string, name: "mutation.lock" | "runtime.lock",
    retain: () => boolean = () => false) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* rejectLinks(server);
    const metadata = path.join(server, ".bedrock-server-manager");
    yield* mutationPath(server, metadata);
    yield* fs.makeDirectory(metadata, { recursive: true });
    const directory = path.join(metadata, name);
    yield* mutationPath(server, directory);
    const ownerFile = path.join(directory, "owner.json");
    const token = randomUUID();
    let initialized = false;
    const owned = () => Effect.gen(function*()
    {
        yield* mutationPath(server, ownerFile);
        const text = yield* fs.readFileString(ownerFile);
        return yield* Effect.try(() => JSON.parse(text).token === token);
    });
    yield* Effect.acquireRelease(
        fs.makeDirectory(directory).pipe(Effect.mapError((error: unknown) => new Error(
            `Cannot acquire server ${name === "mutation.lock" ? "mutation" : "runtime"} lock at ` +
            `${directory}. Another session/mutation/recovery may be pending. ` +
            `${recoveryGuidance(directory)} ${error}`
        ))),
        () => Effect.gen(function*()
        {
            if (retain())
            {
                return;
            }
            yield* mutationPath(server, directory).pipe(Effect.orDie);
            const entries = yield* fs.readDirectory(directory).pipe(Effect.orDie);
            const identity = initialized ? yield* Effect.result(owned()) : undefined;
            if (initialized && entries.length === 1 && entries[0] === "owner.json" &&
                identity?._tag === "Success" && identity.success)
            {
                yield* fs.remove(ownerFile).pipe(Effect.orDie);
            }
            else if (initialized || entries.length !== 0)
            {
                return yield* Effect.die(new Error(
                    `Lock ownership changed or unexpected contents at ${directory}; retained. ` +
                    recoveryGuidance(directory)
                ));
            }
            yield* fs.remove(directory, { recursive: true }).pipe(Effect.orDie);
        })
    );
    yield* fs.writeFileString(ownerFile, JSON.stringify({ cliPid: process.pid, token }), { flag: "wx" });
    initialized = true;
    const writeOwner = (details: Record<string, unknown>) => Effect.uninterruptible(Effect.gen(function*()
    {
        if (!(yield* owned()))
        {
            return yield* Effect.fail(new Error(`Lock ownership changed at ${directory}. ` +
                recoveryGuidance(directory)));
        }
        const temporary = path.join(directory, "owner.tmp");
        yield* mutationPath(server, temporary);
        yield* fs.writeFileString(temporary, JSON.stringify({ ...details, token }, null, 2), { flag: "wx" });
        yield* fs.rename(temporary, ownerFile);
    }));
    return { directory, metadata, writeOwner };
});

export { acquireServerLock, recoveryGuidance };
