/**
 * Windows filesystem probes, token inspection and data-only visible UAC transport.
 *
 * @module monorepo-setup/Windows
 *
 * @file      Windows.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Access, AccountIdentity, Elevation, IsAbsolutePath } from "./Permissions.js";
import type { AccessTarget, Identity } from "./Permissions.js";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Effect, Layer } from "effect";
import { EncodeHandoff, QuoteWindowsArgument } from "./Handoff.js";
import { lstat, mkdir, open, realpath, rename, rmdir, stat, unlink } from "node:fs/promises";
import { ActiveSession } from "./Session.js";
import { Buffer } from "node:buffer";
import { EnvironmentVariable } from "./keys.js";
import { Processes } from "./Contract.js";
import type { Request } from "./Contract.js";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { win32 } from "node:path";

/**
 * Recognizes the supported host before filesystem probes or UAC can run.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const IsSupportedPlatform = (platform: string, architecture: string, release: string,
    edition: string): boolean =>
    platform === "win32" && architecture === "x64" && /^10\.0\.\d+$/.test(release) &&
    Number(release.split(".")[2]) >= 22_000 && /^Windows 11(?: |$)/.test(edition);

/**
 * Reads an OS error code without assuming the source of a failed filesystem operation.
 *
 * @category Getter
 * @since 1.0.0
 */
const ErrorCode = (error: unknown): string | undefined =>
    error !== null && typeof error === "object" && "code" in error ? String(error.code) : undefined;

/**
 * Resolves existing ancestors and junctions before appending nonexistent path components.
 * Dangling junctions and uninspectable ancestors fail instead of hiding a source/install collision.
 *
 * @category Converting
 * @since 1.0.0
 */
export const CanonicalPath = (path: string): Effect.Effect<string, Error> => Effect.tryPromise({
    catch: (error: unknown) => new Error(`Cannot resolve setup path ${path}: ${String(error)}`),
    try: async () =>
    {
        if (!IsAbsolutePath(path))
        {
            throw new Error("An unambiguous absolute Windows path is required.");
        }

        let ancestor = win32.normalize(path);
        const suffix: Array<string> = [];
        for (;;)
        {
            try
            {
                return win32.resolve(await realpath(ancestor), ...suffix.reverse()).toLowerCase();
            }
            catch (error: unknown)
            {
                if (ErrorCode(error) !== "ENOENT")
                {
                    throw error;
                }

                try
                {
                    await lstat(ancestor);
                    throw new Error("Existing junction or symlink cannot be resolved.");
                }
                catch (missing: unknown)
                {
                    if (ErrorCode(missing) !== "ENOENT")
                    {
                        throw missing;
                    }
                }

                const parent = win32.dirname(ancestor);
                if (parent === ancestor)
                {
                    throw new Error("No existing ancestor can be inspected.");
                }

                suffix.push(win32.basename(ancestor));
                ancestor = parent;
            }
        }
    }
});

/**
 * Finds a directory that actually exists without creating the selected destination.
 *
 * @category Getter
 * @since 1.0.0
 */
const ExistingDirectory = async (path: string): Promise<string> =>
{
    let current = path;
    for (;;)
    {
        try
        {
            if (!(await stat(current)).isDirectory())
            {
                throw new Error(`Expected a directory: ${current}`);
            }

            return current;
        }
        catch (error: unknown)
        {
            if (ErrorCode(error) !== "ENOENT")
            {
                throw error;
            }

            const parent = win32.dirname(current);
            if (parent === current)
            {
                throw error;
            }

            current = parent;
        }
    }
};

/**
 * Removes only the temporary files owned by an access probe and reports any cleanup failure.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const CleanupProbe = async (directory: string, file?: string): Promise<void> =>
{
    try
    {
        if (file !== undefined)
        {
            await unlink(file);
        }

        await rmdir(directory);
    }
    catch (error: unknown)
    {
        throw new Error(`Could not clean access probe ${directory}; ` +
            `inspect before retrying: ${String(error)}`);
    }
};

/**
 * Exercises only a newly created probe directory, including file and directory rename/rollback.
 * Cleanup errors stop setup explicitly; existing source, configuration and bundle files are never rewritten.
 *
 * @category Testing
 * @since 1.0.0
 */
const ProbeDirectory = async (path: string): Promise<void> =>
{
    const parent = await ExistingDirectory(path);
    let directory = win32.join(parent, `.bedform-access-${randomUUID()}`);
    await mkdir(directory);
    let file: string | undefined;
    try
    {
        const candidate = win32.join(directory, "probe");
        const handle = await open(candidate, "wx");
        file = candidate;
        try
        {
            await handle.writeFile("access probe");
        }
        finally
        {
            await handle.close();
        }

        await rename(file, file + "-renamed");
        file += "-renamed";
        const moved = directory + "-moved";
        await rename(directory, moved);
        file = win32.join(moved, win32.basename(file));
        const original = directory;
        directory = moved;
        await rename(directory, original);
        directory = original;
        file = win32.join(directory, win32.basename(file));
    }
    finally
    {
        await CleanupProbe(directory, file);
    }
};

/**
 * Probes actual Windows write access rather than relying on fs.access, which does not evaluate Windows ACLs.
 * Existing files are opened without truncation or writes; missing files use their nearest parent.
 *
 * @category Testing
 * @since 1.0.0
 */
export const ProbeAccess = (target: AccessTarget): Effect.Effect<"writable" | "denied", Error> =>
    Effect.tryPromise({
        catch: (error: unknown) => new Error(
            `Cannot preflight ${target.purpose} (${target.path}): ${String(error)}`),
        try: async () =>
        {
            try
            {
                if (target.kind === "file")
                {
                    try
                    {
                        const handle = await open(target.path, "r+");
                        await handle.close();
                    }
                    catch (error: unknown)
                    {
                        if (ErrorCode(error) !== "ENOENT")
                        {
                            throw error;
                        }

                        await ProbeDirectory(win32.dirname(target.path));
                    }
                }
                else
                {
                    await ProbeDirectory(target.path);
                }

                return "writable" as const;
            }
            catch (error: unknown)
            {
                if ([ "EACCES", "EPERM" ].includes(ErrorCode(error) ?? ""))
                {
                    return "denied" as const;
                }

                throw error;
            }
        }
    });

/**
 * Supplies filesystem preflight adapters with no elevation, ACL changes or recursive removals.
 *
 * @category Layer
 * @since 1.0.0
 */
export const AccessLayer = Layer.succeed(Access, { canonical: CanonicalPath,
    probe: ProbeAccess });

/**
 * Fixed read-only Windows token query; no caller-controlled strings are embedded in executable code.
 *
 * @category Constant
 * @since 1.0.0
 */
export const IdentityScript = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
@{
    sid = $identity.User.Value
    name = [Environment]::UserName
    home = [Environment]::GetFolderPath('UserProfile')
    elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} | ConvertTo-Json -Compress
`;

/**
 * Fixed visible UAC launcher, using ProcessStartInfo data fields and waiting for the actual Node process.
 * The cancellation code is distinguished from ordinary child failure; no shell source evaluates user paths.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ElevationScript = `
$ErrorActionPreference = 'Stop'
try {
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:${EnvironmentVariable.Relaunch}))
    $payload = $json | ConvertFrom-Json
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $payload.node
    $start.Arguments = $payload.arguments
    $start.WorkingDirectory = $payload.cwd
    $start.UseShellExecute = $true
    $start.Verb = 'runas'
    $start.WindowStyle = [Diagnostics.ProcessWindowStyle]::Normal
    $child = [Diagnostics.Process]::Start($start)
    if ($null -eq $child) { throw 'Windows did not create an elevated setup process.' }
    $child.WaitForExit()
    exit $child.ExitCode
} catch {
    $errorObject = $_.Exception
    while ($null -ne $errorObject.InnerException) { $errorObject = $errorObject.InnerException }
    if ($errorObject -is [ComponentModel.Win32Exception] -and $errorObject.NativeErrorCode -eq 1223) {
        exit 1223
    }
    [Console]::Error.WriteLine('Could not launch elevated setup: ' + $errorObject.Message)
    exit 1
}
`;

/**
 * Resolves Windows PowerShell by its absolute operating-system location rather than ambient PATH.
 *
 * @category Getter
 * @since 1.0.0
 */
const PowerShell = (): string => win32.join(process.env.SystemRoot ?? "C:\\Windows",
    "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

/**
 * Encodes a fixed PowerShell program in its required UTF-16LE transport format.
 *
 * @category Encoding
 * @since 1.0.0
 */
const ScriptArguments = (script: string): Array<string> => [
    "-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64") ];

/**
 * Inspects the actual current SID and elevation state through Effect's process spawner.
 *
 * @category Layer
 * @since 1.0.0
 */
export const IdentityLayer = Layer.effect(AccountIdentity, Effect.gen(function*()
{
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    return { inspect: Effect.gen(function*()
    {
        const output = yield* spawner.string(ChildProcess.make(
            PowerShell(), ScriptArguments(IdentityScript)));
        return yield* Effect.try({
            catch: (error: unknown) => new Error(`Cannot inspect Windows account: ${String(error)}`),
            try: (): Identity =>
            {
                const identity = JSON.parse(output);
                if (typeof identity.sid !== "string" || !/^S-1-\d+(?:-\d+)+$/.test(identity.sid) ||
                    typeof identity.name !== "string" || typeof identity.home !== "string" ||
                    !IsAbsolutePath(identity.home) || typeof identity.elevated !== "boolean")
                {
                    throw new Error("Invalid Windows identity response.");
                }

                return identity;
            }
        });
    }).pipe(Effect.mapError((error: unknown) => new Error(String(error)))) };
}));

/**
 * Relaunches after permission-layer consent, retaining a parent lease and the entire parsed request.
 * Profile/tool data is carried as encoded data, and the elevated child validates account and checkout again.
 *
 * @category Layer
 * @since 1.0.0
 */
export const ElevationLayer = Layer.effect(Elevation, Effect.gen(function*()
{
    const processes = yield* Processes;
    return { relaunch: (request: Request) => Effect.gen(function*()
    {
        const session = yield* ActiveSession;
        if (session === undefined)
        {
            return yield* Effect.fail(new Error("Cannot elevate setup without a live parent session."));
        }

        const token = yield* Effect.try({ catch: (error: unknown) => new Error(String(error)),
            try: () => EncodeHandoff(request, session) });
        const payload = Buffer.from(JSON.stringify({
            arguments: [ request.paths.cli, "--handoff", token ].map(QuoteWindowsArgument).join(" "),
            cwd: request.paths.originalCwd,
            node: request.paths.node
        }), "utf8").toString("base64");
        const code = yield* processes.run({
            args: ScriptArguments(ElevationScript),
            cwd: request.paths.originalCwd,
            environment: { ...process.env,
                [EnvironmentVariable.Relaunch]: payload },
            executable: PowerShell()
        });
        if (code === 1_223)
        {
            return yield* Effect.fail(new Error("Windows UAC was canceled; setup did not continue."));
        }

        return code;
    }) };
}));
