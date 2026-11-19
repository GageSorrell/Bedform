/**
 * Startup preflight, duplicate detection and scoped foreground-server ownership.
 *
 * @module bedrock-server-manager/start-ownership
 *
 * @file      start-ownership.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, Exit, FileSystem, Path } from "effect";
import { access, constants } from "node:fs/promises";
import { acquireServerLock, recoveryGuidance } from "./server-lock.js";
import type { ProcessIdentity } from "./process-inspection.js";
import type { RuntimeContext } from "./config.js";
import type { ServerLaunch } from "./start-process.js";
import { inspectProcesses } from "./process-inspection.js";
import { resolveServer } from "./server.js";
import { win32 } from "node:path";

namespace StartOptions
{
    /**
     * Terminal capability of standard input.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Stdin
    {
        isTTY?: boolean;
    }

    /**
     * Terminal capability of standard output.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface Stdout
    {
        isTTY?: boolean;
    }
}

/** Terminal capability is checked before locking or invoking native process inspection. */
interface StartOptions
{
    server?: string;
    stdin: StartOptions.Stdin;
    stdout: StartOptions.Stdout;
}

/** Native boundaries kept injectable for controlled platform and process fixtures. */
interface StartDependencies
{
    cliPid: number;
    inspect: (platform: "win32" | "linux") => Effect.Effect<Array<ProcessIdentity>, unknown>;
    executableAccess: (file: string) => Effect.Effect<void, unknown>;
}

const nativeDependencies: StartDependencies = {
    cliPid: process.pid,
    executableAccess: (file: string) => Effect.tryPromise(() => access(file, constants.X_OK)),
    inspect: (platform: "win32" | "linux") => Effect.tryPromise(() => inspectProcesses(platform))
};

/** Canonical directory/executable identity; an existing world is intentionally unnecessary. */
interface PreparedServer extends ServerLaunch
{
    executable: string;
}

/** Resolve the same explicit/saved server selection as addon commands, without resolving a world. */
const prepareServer = (context: RuntimeContext, options: StartOptions,
    injected: Partial<StartDependencies> = {}) => Effect.gen(function*()
{
    const dependencies = { ...nativeDependencies, ...injected };
    if (context.platform !== "win32" && context.platform !== "linux")
    {
        return yield* Effect.fail(new Error("BDS start supports native Windows and Linux servers only."));
    }
    if (options.stdin.isTTY !== true || options.stdout.isTTY !== true)
    {
        return yield* Effect.fail(new Error("BDS start requires interactive stdin and stdout terminals."));
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* fs.realPath(yield* resolveServer(context, options.server));
    const selected = path.join(directory,
        context.platform === "win32" ? "bedrock_server.exe" : "bedrock_server");
    const executable = yield* fs.realPath(selected).pipe(Effect.mapError((error: unknown) =>
        new Error(`Cannot access native BDS executable ${selected}: ${error}`)));
    const info = yield* fs.stat(executable);
    if (info.type !== "File")
    {
        return yield* Effect.fail(new Error(`Expected a native BDS executable file: ${executable}`));
    }
    if (context.platform === "linux")
    {
        if ((info.mode & 0o111) === 0)
        {
            return yield* Effect.fail(new Error(`BDS executable is not executable: ${executable}`));
        }
        yield* dependencies.executableAccess(executable).pipe(Effect.mapError((error: unknown) =>
            new Error(`BDS executable is not executable: ${executable}: ${error}`)));
    }
    const prepared: PreparedServer = { directory, env: { ...context.env }, executable,
        platform: context.platform };
    return prepared;
});

/** Compare canonical paths case-insensitively on Windows, including alternate path spellings. */
const assertNoDuplicate = (server: PreparedServer, processes: Array<ProcessIdentity>) =>
    Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const windows = server.platform === "win32";
        const key = (value: string) => windows
            ? BedrockString.toLowerCase(BedrockString.replace(/^\\\\\?\\/, "")(win32.normalize(value))) : path.normalize(value);
        const name = windows ? "bedrock_server.exe" : "bedrock_server";
        for (const identity of processes)
        {
            const executable = identity.executable?.replace(/ \(deleted\)$/, "");
            const relevant = BedrockString.toLowerCase(identity.name) === name || (executable !== undefined &&
            (BedrockString.toLowerCase((windows ? win32.basename(executable) : path.basename(executable))) === name ||
                key(executable) === key(server.executable)));
            if (!identity.executable)
            {
                if (!relevant)
                {
                    continue;
                }
                return yield* Effect.fail(new Error(
                    `Cannot determine BDS executable identity for PID ${identity.pid}.`));
            }
            const actual = yield* Effect.result(fs.realPath(identity.executable));
            if (actual._tag === "Failure")
            {
                if (!relevant)
                {
                    continue;
                }
                return yield* Effect.fail(new Error(
                    `Cannot determine BDS executable identity for PID ${identity.pid}.`));
            }
            if (key(actual.success) === key(server.executable))
            {
                return yield* Effect.fail(new Error(
                    `BDS is already running for ${server.executable} (PID ${identity.pid}).`
                ));
            }
        }
    });

/** Session owner must acknowledge child close before scoped cleanup can release its locks. */
interface ServerOwnership
{
    launch: PreparedServer;
    recordChild: (pid: number) => Effect.Effect<void, unknown, FileSystem.FileSystem | Path.Path>;
    childClosed: () => Effect.Effect<void>;
    retainRecovery: () => Effect.Effect<void>;
}

/** Hold both locks through the complete caller-supplied child lifecycle, including spawn failures. */
const withServerOwnership = <Value, Err, Env>(context: RuntimeContext, options: StartOptions,
    body: (ownership: ServerOwnership) => Effect.Effect<Value, Err, Env>,
    injected: Partial<StartDependencies> = {}) => Effect.scoped(Effect.gen(function*()
{
    const dependencies = { ...nativeDependencies, ...injected };
    const launch = yield* prepareServer(context, options, dependencies);
    let uncertain = false;
    let serverPid: number | null = null;
    // Share addon transaction serialization before inspecting native processes.
    const mutation = yield* acquireServerLock(launch.directory, "mutation.lock", () => uncertain);
    const runtime = yield* acquireServerLock(launch.directory, "runtime.lock", () => uncertain);
    const details = () => ({ cliPid: dependencies.cliPid, executable: launch.executable,
        server: launch.directory, serverPid });
    yield* mutation.writeOwner(details());
    yield* runtime.writeOwner(details());
    yield* assertNoDuplicate(launch, yield* dependencies.inspect(launch.platform).pipe(
        Effect.mapError((error: unknown) => new Error(`Cannot safely inspect native BDS processes: ${error}`))
    ));
    const recordChild = (pid: number) => Effect.uninterruptible(Effect.gen(function*()
    {
        if (!Number.isSafeInteger(pid) || pid <= 0 || serverPid !== null)
        {
            return yield* Effect.fail(new Error(
                "Expected one valid spawned server PID per ownership session."));
        }
        uncertain = true;
        serverPid = pid;
        yield* runtime.writeOwner(details());
        yield* mutation.writeOwner(details());
    }));
    const result = yield* Effect.exit(body({
        childClosed: () => Effect.sync(() => { uncertain = false; }),
        launch, recordChild,
        retainRecovery: () => Effect.sync(() => { uncertain = true; })
    }));
    if (uncertain)
    {
        return yield* Effect.fail(new Error(
            "Server shutdown is unconfirmed; runtime and mutation locks retained. " +
            recoveryGuidance(runtime.directory)));
    }
    if (Exit.isFailure(result))
    {
        return yield* Effect.failCause(result.cause);
    }
    return result.value;
}));

export { assertNoDuplicate, prepareServer, withServerOwnership };
export type { PreparedServer, ServerOwnership, StartDependencies, StartOptions };
