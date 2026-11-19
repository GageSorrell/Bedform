/** @file bds-server.mts Node tooling shared by the scripts that change the server at %BDS_ROOT%. */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Reports a failure and exits with a nonzero status.
 *
 * @category Tools
 * @since 1.0.0
 */
export type Fail = (message: string) => never;

/**
 * Resolves and validates the configured server directory.
 *
 * @category Tools
 * @since 1.0.0
 */
export function serverRoot(fail: Fail): string
{
    const value = process.env.BDS_ROOT;
    if (!value)
    {
        fail(
            "BDS_ROOT is not set. If it was just created, restart the terminal or " +
                "VS Code so the new variable is visible."
        );
    }

    const root = path.resolve(value);
    if (!existsSync(root) || !statSync(root).isDirectory())
    {
        fail(`BDS_ROOT does not identify a directory: ${root}`);
    }

    return root;
}

/**
 * Refuses to continue while this server's executable is running.
 *
 * @category Tools
 * @since 1.0.0
 */
export function assertStopped(root: string, fail: Fail): void
{
    if (process.platform !== "win32")
    {
        return;
    }

    const query = spawnSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_Process -Filter \"Name='bedrock_server.exe'\" | " +
                "ForEach-Object { $_.ExecutablePath }"
        ],
        { encoding: "utf8" }
    );
    if (query.status !== 0)
    {
        fail(`Could not check for a running server: ${query.stderr.trim()}`);
    }

    const prefix = root.toLowerCase() + path.sep;
    const running = query.stdout
        .split(/\r?\n/)
        .filter((line: string) => line.trim().toLowerCase().startsWith(prefix));
    if (running.length)
    {
        fail(`Stop the server before installing; running: ${running.join(", ")}`);
    }
}
