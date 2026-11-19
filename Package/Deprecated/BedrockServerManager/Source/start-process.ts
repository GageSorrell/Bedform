/**
 * Native process boundary for the foreground console, independent of Ink.
 *
 * @module bedrock-server-manager/start-process
 *
 * @file      start-process.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { spawn } from "node:child_process";

/** Validated launch information supplied by the ownership/preflight layer. */
interface ServerLaunch
{
    directory: string;
    platform: "win32" | "linux";
    env: NodeJS.ProcessEnv;
    executable?: string;
}

/** Injectable process creation; tests can supply controllable streams and events. */
type SpawnServer = (executable: string, args: Array<string>, options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    shell: false;
    stdio: "pipe";
}) => ChildProcessWithoutNullStreams;

/**
 * Spawn only after the caller has validated the executable and acquired ownership.
 * This internal boundary deliberately does not resolve servers or acquire locks.
 */
const spawnServer = (launch: ServerLaunch, createProcess: SpawnServer = spawn) =>
{
    const env = { ...launch.env };
    if (launch.platform === "linux")
    {
        // The target platform determines the separator, even in cross-platform fixtures.
        env.LD_LIBRARY_PATH = [ launch.directory, env.LD_LIBRARY_PATH ].filter(Boolean).join(":");
    }
    const executable = launch.executable ?? join(launch.directory,
        launch.platform === "win32" ? "bedrock_server.exe" : "bedrock_server");
    return createProcess(executable, [], { cwd: launch.directory, env, shell: false, stdio: "pipe" });
};

export { spawnServer };
export type { ServerLaunch, SpawnServer };
