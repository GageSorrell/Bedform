/**
 * Bounded data-only UAC payloads, Windows argument quoting and original-account validation.
 *
 * @module monorepo-setup/Handoff
 *
 * @file      Handoff.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Paths, Request } from "./Contract.js";
import { Buffer } from "node:buffer";
import type { Identity } from "./Permissions.js";
import { IsAbsolutePath } from "./Permissions.js";
import type { Session } from "./Session.js";
import { win32 } from "node:path";

/**
 * Versioned internal handoff retaining absolute paths, selected stages and the live parent's lease.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Handoff
{
    readonly version: 1;
    readonly request: Request;
    readonly session: Session;
}

const ToolLocations = new Set([
    "PATH", "PATHEXT", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP",
    "CARGO_HOME", "CARGO_TARGET_DIR", "CARGO_BUILD_BUILD_DIR",
    "RUSTUP_HOME", "GOPATH", "GOROOT", "GOBIN", "CMAKE_PREFIX_PATH", "VCPKG_ROOT",
    "VSINSTALLDIR", "VCINSTALLDIR", "VCToolsInstallDir", "WindowsSdkDir", "WindowsSDKVersion",
    "INCLUDE", "LIB", "LIBPATH", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432",
    "SystemRoot", "SystemDrive", "ComSpec"
].map((key: string) => key.toUpperCase()));

/**
 * Transfers tool/profile locations without exposing arbitrary credentials or Node startup hooks in argv.
 *
 * @category Filtering
 * @since 1.0.0
 */
export const ToolEnvironment = (environment: Readonly<Record<string, string | undefined>>) =>
    Object.fromEntries(Object.entries(environment).filter(([ key, value ]: [string, string | undefined]) =>
        ToolLocations.has(key.toUpperCase()) && value !== undefined));

/**
 * Quotes one argument according to Windows CRT backslash/quote rules, without using an executable shell.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const QuoteWindowsArgument = (argument: string): string =>
{
    let quoted = "\"";
    let slashes = 0;
    for (const character of argument)
    {
        if (character === "\\")
        {
            slashes++;
            continue;
        }

        quoted += "\\".repeat(character === "\"" ? slashes * 2 + 1 : slashes) + character;
        slashes = 0;
    }

    return quoted + "\\".repeat(slashes * 2) + "\"";
};

/**
 * Encodes a data-only handoff with no unneeded environment secrets and a bounded Windows command line.
 *
 * @throws { Error } When the handoff exceeds the safe command-line budget.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const EncodeHandoff = (request: Request, session: Session): string =>
{
    const handoff: Handoff = { request: { ...request,
        account: { ...request.account,
            environment: ToolEnvironment(request.account.environment) } },
    session,
    version: 1 };
    const token = Buffer.from(JSON.stringify(handoff), "utf8").toString("base64url");
    if (token.length > 24_000)
    {
        throw new Error("Setup handoff is too large; shorten tool paths before requesting elevation.");
    }

    return token;
};

/**
 * Narrows JSON objects without accepting null or arrays.
 *
 * @category Guard
 * @since 1.0.0
 */
const IsRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Decodes and validates the internal data shape before any elevated setup action.
 *
 * @throws { Error } When the payload is malformed, oversized or contains unsupported fields.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const DecodeHandoff = (token: string): Handoff =>
{
    if (token.length === 0 || token.length > 24_000 || !/^[\w-]+$/.test(token))
    {
        throw new Error("Invalid setup handoff encoding.");
    }

    const value: unknown = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!IsRecord(value) || value.version !== 1 || !IsRecord(value.request) || !IsRecord(value.session))
    {
        throw new Error("Invalid setup handoff envelope.");
    }

    const request = value.request;
    const session = value.session;
    if (request.elevated !== true || !IsRecord(request.paths) || !IsRecord(request.account) ||
        !IsRecord(request.options))
    {
        throw new Error("Invalid setup handoff request.");
    }

    for (const key of [ "monorepo", "source", "install", "originalCwd", "cli", "node" ])
    {
        if (typeof request.paths[key] !== "string" || !IsAbsolutePath(request.paths[key]))
        {
            throw new Error(`Invalid absolute handoff path: ${key}`);
        }
    }

    const account = request.account;
    if (typeof account.id !== "string" || !/^S-1-\d+(?:-\d+)+$/.test(account.id) ||
        typeof account.home !== "string" || !IsAbsolutePath(account.home) || !IsRecord(account.environment))
    {
        throw new Error("Invalid handoff account.");
    }

    for (const [ key, entry ] of Object.entries(account.environment))
    {
        if (!ToolLocations.has(key.toUpperCase()) || typeof entry !== "string" || entry.includes("\0"))
        {
            throw new Error("Invalid handoff tool environment.");
        }
    }

    for (const key of [ "update", "core", "blender", "blockbench" ])
    {
        if (typeof request.options[key] !== "boolean")
        {
            throw new Error(`Invalid handoff stage flag: ${key}`);
        }
    }

    for (const key of [ "directory", "bdsDirectory", "mcpConfig" ])
    {
        const entry = request.options[key];
        if (entry !== undefined && (typeof entry !== "string" || entry.includes("\0") ||
            (key !== "directory" && !IsAbsolutePath(entry))))
        {
            throw new Error(`Invalid handoff option: ${key}`);
        }
    }

    if (!Number.isSafeInteger(session.pid) || Number(session.pid) <= 0 || typeof session.nonce !== "string" ||
        !/^[\da-f-]{36}$/.test(session.nonce) || typeof session.directory !== "string" ||
        !IsAbsolutePath(session.directory) || !Array.isArray(session.resources) ||
        !session.resources.every((resource: unknown) =>
            typeof resource === "string" && IsAbsolutePath(resource)))
    {
        throw new Error("Invalid setup parent lease.");
    }

    return value as unknown as Handoff;
};

/**
 * Rejects a different Windows account, non-elevated token, relocated source or substituted executable.
 * The original invocation directory and installation override are never recomputed from the UAC cwd.
 *
 * @throws { Error } When identity or ownership does not match the original setup invocation.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const ValidateHandoff = (handoff: Handoff, identity: Identity, ownPaths: Paths): Request =>
{
    const request = handoff.request;
    const equal = (left: string, right: string): boolean =>
        win32.normalize(left).toLowerCase() === win32.normalize(right).toLowerCase();
    if (!identity.elevated || request.account.id !== identity.sid ||
        !equal(request.account.home, identity.home))
    {
        throw new Error("UAC must use the invoking Windows account with an elevated token.");
    }

    for (const key of [ "monorepo", "source", "cli", "node" ] as const)
    {
        if (!equal(request.paths[key], ownPaths[key]))
        {
            throw new Error("Setup handoff must use the same Node executable, compiled CLI and local fork.");
        }
    }

    const install = request.options.directory === undefined ? "C:\\Program Files\\Bedform\\Cinnabar"
        : win32.resolve(request.paths.originalCwd, request.options.directory);
    if (!equal(install, request.paths.install))
    {
        throw new Error("Setup handoff installation does not match the original directory override.");
    }

    return request;
};
