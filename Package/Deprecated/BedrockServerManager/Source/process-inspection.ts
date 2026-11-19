/**
 * Native process identity inspection, with injectable CIM and procfs boundaries.
 *
 * @module bedrock-server-manager/process-inspection
 *
 * @file      process-inspection.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { access, readFile, readdir, readlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

/** A native process whose executable path may be inaccessible. */
interface ProcessIdentity
{
    pid: number;
    name: string;
    executable: string | null;
}

const execute = promisify(execFile);
/** Static query: no server paths or other user strings are interpolated into PowerShell. */
const queryCim = async () => (await execute("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-Command",
    "$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new(); " +
    "ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | " +
    "Select-Object ProcessId,Name,ExecutablePath)"
], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 15000, windowsHide: true })).stdout;

/**
 * Validate CIM output so unavailable/malformed identities never become an empty process list.
 * @throws {Error} When process enumeration output is malformed or incomplete.
 */
const parseCim = (text: string): Array<ProcessIdentity> =>
{
    const value: unknown = JSON.parse(BedrockString.replace(/^\uFEFF/, "")(text));
    if (!Array.isArray(value))
    {
        throw new Error("Expected a CIM process array.");
    }
    return value.map((entry: unknown) =>
    {
        if (typeof entry !== "object" || entry === null)
        {
            throw new Error("Invalid CIM process.");
        }
        const record = entry as Record<string, unknown>;
        if (!Number.isSafeInteger(record.ProcessId) || Number(record.ProcessId) < 0 ||
            typeof record.Name !== "string" || !record.Name ||
            !(record.ExecutablePath === null || typeof record.ExecutablePath === "string"))
        {
            throw new Error("Cannot determine a CIM process identity.");
        }
        return { executable: record.ExecutablePath || null, name: record.Name,
            pid: Number(record.ProcessId) } as ProcessIdentity;
    });
};

/** Minimal procfs operations, allowing Linux coverage without launching BDS or requiring Linux. */
interface ProcReader
{
    list: (directory: string) => Promise<Array<string>>;
    text: (file: string) => Promise<string>;
    link: (file: string) => Promise<string>;
    exists: (directory: string) => Promise<boolean>;
}

const procReader: ProcReader = {
    exists: async (directory: string) =>
    {
        try { await access(directory); return true; }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code === "ENOENT")
            {
                return false;
            }
            throw error;
        }
    },
    link: readlink,
    list: readdir,
    text: (file: string) => readFile(file, "utf8")
};

/** Read actual executable links, falling back to comm only to classify inaccessible identities. */
const inspectProc = async (reader: ProcReader = procReader, root: string = "/proc") =>
{
    const identities: Array<ProcessIdentity> = [];
    for (const pid of await reader.list(root))
    {
        if (!/^\d+$/.test(pid))
        {
            continue;
        }
        const directory = join(root, pid);
        try
        {
            const executable = await reader.link(join(directory, "exe"));
            identities.push({ executable, name: "", pid: Number(pid) });
        }
        catch
        {
            if (!(await reader.exists(directory)))
            {
                continue;
            }
            let name: string;
            try { name = BedrockString.trim((await reader.text(join(directory, "comm")))); }
            catch { throw new Error(`Cannot determine process identity for PID ${pid}.`); }
            if (!name)
            {
                throw new Error(`Cannot determine process identity for PID ${pid}.`);
            }
            identities.push({ executable: null, name, pid: Number(pid) });
        }
    }
    return identities;
};

/** Native enumeration errors must propagate to preflight and block launch. */
const inspectProcesses = (platform: "win32" | "linux") => platform === "win32"
    ? queryCim().then(parseCim) : inspectProc();

export { inspectProcesses, inspectProc, parseCim };
export type { ProcessIdentity, ProcReader };
