/**
 * Transactional creation of isolated demonstration servers. Creation never launches BDS.
 *
 * @file create.mts
 */

import { access, cp, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm,
    writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promisify } from "node:util";

/** Versioned marker and lock files shared by creator and launcher. */
const DemoFiles = Object.freeze({ Lock: ".demonstration.lock",
    Metadata: "demonstration.json" } as const);
const Repository = fileURLToPath(new URL("../../../../", import.meta.url));

/** Inputs to an isolated, human-connectable demonstration server. */
export interface DemonstrationOptions
{
    name: string;
    description: string;
    world: string;
    behaviorPacks?: ReadonlyArray<string>;
    resourcePacks?: ReadonlyArray<string>;
    bds?: string;
    addon?: string;
    output?: string;
    descriptor?: string;
    instructions?: string;
    readyMarker?: string;
    config?: Readonly<Record<string, string | number | boolean>>;
    port?: number;
    portV6?: number;
}

/** Persisted launch instructions; it contains no engine credentials or source-world references. */
export interface DemonstrationMetadata
{
    version: 1;
    name: string;
    description: string;
    instructions?: string;
    readyMarker?: string;
    world: string;
    descriptor: string;
    launcher: string;
    port: number;
}

/**
 * Require a nonblank, single-line user-facing string.
 *
 * @throws { Error } If the input is blank or contains a line separator.
 */
function required(value: string | undefined, label: string): string
{
    if (!value?.trim() || /[\r\n\0]/.test(value))
    {
        throw new Error(`${label} must be a nonblank single-line value`);
    }

    return value.trim();
}

/** Derive the stable directory descriptor without allowing path traversal. */
export function descriptor(value: string): string
{
    const result = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/^-+|-+$/g, "");
    return required(result, "descriptor");
}

/** Test existence without swallowing other filesystem operations' failures. */
export async function exists(file: string): Promise<boolean>
{
    return access(file).then(() => true, () => false);
}

/** Retry Windows directory renames while antivirus releases newly copied executables. */
async function publish(source: string, destination: string): Promise<void>
{
    for (let attempt = 0; ; attempt++)
    {
        try
        {
            await rename(source, destination);
            return;
        }
        catch (error)
        {
            if (attempt >= 5 || ![ "EPERM", "EBUSY",
                "EACCES" ].includes((error as NodeJS.ErrnoException).code!))
            {
                throw error;
            }

            await new Promise<void>((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
        }
    }
}

/** Resolve symlinked parents even when the final output directory does not exist. */
async function resolved(file: string): Promise<string>
{
    const absolute = path.resolve(file);
    if (await exists(absolute))
    {
        return realpath(absolute);
    }

    return path.join(await resolved(path.dirname(absolute)), path.basename(absolute));
}

/** Compare directory ancestry using path boundaries, including case-insensitive Windows paths. */
export function within(parent: string, child: string): boolean
{
    const relative = path.relative(parent, child);
    return relative === "" || !relative.startsWith(".." + path.sep) && relative !== ".." &&
        !path.isAbsolute(relative);
}

/** Refuse creation over an active launcher or a BDS started independently from the launcher. */
export async function assertStopped(server: string): Promise<void>
{
    const lock = path.join(server, DemoFiles.Lock);
    if (await exists(lock))
    {
        const pid = Number(await readFile(lock, "utf8"));
        try
        {
            process.kill(pid, 0);
            throw new Error(`Demonstration is running (PID ${pid})`);
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH")
            {
                throw error;
            }
        }

        await rm(lock);
    }

    if (process.platform === "win32")
    {
        const { stdout } = await promisify(execFile)("powershell.exe", [ "-NoProfile",
            "-NonInteractive", "-Command",
            "@(Get-CimInstance Win32_Process -Filter \"Name = " +
                "'bedrock_server.exe'\" | Select-Object -ExpandProperty " +
                "ExecutablePath) | ConvertTo-Json -Compress" ]);
        const paths: string | Array<string> = JSON.parse(stdout.trim() || "[]");
        const executable = path.join(server, "bedrock_server.exe").toLowerCase();
        if ([ paths ].flat().some((value) => value?.toLowerCase() === executable))
        {
            throw new Error(`BDS is running from ${server}`);
        }
    }
}

/** A numeric pack version triple as world pack references store it. */
type PackTriple = [number, number, number];

/**
 * Normalize an array version or a format-3 plain release string such as "1.14.1" to a numeric triple.
 * Prerelease and build strings are not supported by demonstration worlds.
 */
function packTriple(value: unknown): PackTriple | undefined
{
    const parts = typeof value === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)
        ? value.split(".").map(Number)
        : value;
    return Array.isArray(parts) && parts.length === 3 &&
        parts.every((part: unknown) => Number.isSafeInteger(part) && (part as number) >= 0)
        ? parts as PackTriple
        : undefined;
}

/** Read manifests before copying so missing/version-mismatched UUID dependencies cannot publish a server. */
async function packs(options: DemonstrationOptions)
{
    const entries = [];
    for (const [ kind, inputs ] of [ [ "behavior_packs", options.behaviorPacks ?? [] ],
        [ "resource_packs", options.resourcePacks ?? [] ] ] as const)
    {
        for (const input of inputs)
        {
            const source = await realpath(input);
            const manifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
            if (!/^[\da-f-]{36}$/i.test(manifest.header?.uuid) || !packTriple(manifest.header.version))
            {
                throw new Error(`Invalid pack manifest: ${source}`);
            }

            entries.push({ kind,
                manifest,
                source });
        }
    }

    const uuids = new Set<string>();
    for (const entry of entries)
    {
        if (uuids.has(entry.manifest.header.uuid))
        {
            throw new Error(`Duplicate pack UUID: ${entry.manifest.header.uuid}`);
        }

        uuids.add(entry.manifest.header.uuid);
        for (const dependency of entry.manifest.dependencies ?? [])
        {
            if (dependency.uuid && !entries.some((other) => other.manifest.header.uuid === dependency.uuid &&
                JSON.stringify(packTriple(other.manifest.header.version)) ===
                    JSON.stringify(packTriple(dependency.version))))
            {
                throw new Error(`Missing pack dependency ${dependency.uuid} for ${entry.source}`);
            }
        }
    }

    return entries;
}

/** Find an add-on from an explicit path, output location or the caller's directory. */
async function addonRoot(options: DemonstrationOptions): Promise<string | undefined>
{
    if (options.addon)
    {
        return realpath(options.addon);
    }

    for (const candidate of [ options.output, process.cwd() ])
    {
        if (!candidate)
        {
            continue;
        }

        let directory = path.resolve(candidate);
        while (path.dirname(directory) !== directory)
        {
            if (path.basename(path.dirname(directory)).toLowerCase() === "addon" &&
                await exists(path.join(directory, "package.json")))
            {
                return realpath(directory);
            }

            directory = path.dirname(directory);
        }
    }

    return undefined;
}

/** Update the add-on's launch command and the nearest permitted existing ignore file. */
async function register(addon: string | undefined, output: string, slug: string): Promise<string | undefined>
{
    if (!addon || !within(addon, output))
    {
        return undefined;
    }

    const file = path.join(addon, "package.json");
    const pkg = JSON.parse(await readFile(file, "utf8"));
    const command = `demo:${slug.slice(0, 16).replace(/-+$/g, "")}`;
    const operation = pkg.scripts?.[command] === undefined ? "added" : "modified";
    pkg.scripts ??= {};
    const launcher = path.relative(addon, path.join(Repository,
        "Script/Deprecated/Demonstration/Source/start.mts")).replaceAll("\\", "/");
    const server = path.relative(addon, output).replaceAll("\\", "/");
    if (/["\r\n%]/.test(launcher + server))
    {
        throw new Error("Launch paths contain unsupported shell characters");
    }

    pkg.scripts[command] = `node --import tsx "${launcher}" --server "${server}"`;
    await writeFile(file, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`${operation} ${pkg.name} script ${command}`);
    if (within(path.join(addon, "Demonstration"), output))
    {
        let gitRoot: string | undefined;
        let directory = addon;
        while (path.dirname(directory) !== directory)
        {
            if (await exists(path.join(directory, ".git")))
            {
                gitRoot = directory;
                break;
            }

            directory = path.dirname(directory);
        }

        if (gitRoot)
        {
            const ignore = await exists(path.join(addon, ".gitignore")) ? path.join(addon, ".gitignore") :
                await exists(path.join(gitRoot, ".gitignore")) ? path.join(gitRoot, ".gitignore") :
                    path.join(addon, ".gitignore");
            const old = await exists(ignore) ? await readFile(ignore, "utf8") : "";
            const rule = "/" + path.relative(path.dirname(ignore), path.join(addon,
                "Demonstration")).replaceAll("\\", "/") + "/";
            if (!old.split(/\r?\n/).includes(rule))
            {
                await writeFile(ignore, old + (old.endsWith("\n") || !old ? "" : "\n") + rule + "\n");
            }
        }
    }

    return command;
}

/**
 * Stage a complete server, then atomically replace a marked predecessor after a complete backup.
 * Engine credentials, unrelated worlds, custom packs and manager state are deliberately excluded.
 */
export async function createDemonstration(options: DemonstrationOptions)
{
    const name = required(options.name, "name");
    const description = required(options.description, "description");
    required(options.world, "world");
    const slug = descriptor(options.descriptor ?? name);
    const addon = await addonRoot(options);
    if (!options.output && !addon)
    {
        throw new Error("Supply --output when no add-on can be resolved");
    }

    const output = await resolved(options.output ?? path.join(addon!, "Demonstration", slug, "server"));
    const world = await realpath(options.world);
    const engine = await realpath(required(options.bds ?? process.env.BDS_PATH ?? process.env.BDS_ROOT,
        "bds"));
    const entries = await packs(options);
    for (const source of [ engine, world, ...entries.map((entry) => entry.source) ])
    {
        if (within(output, source) || within(source, output))
        {
            throw new Error(`Source/output directories overlap: ${source}`);
        }
    }

    await access(path.join(world, "level.dat"));
    await access(path.join(engine, "bedrock_server.exe"));
    const port = options.port ?? 19132;
    const portV6 = options.portV6 ?? 19133;
    if ([ port, portV6 ].some((value) => !Number.isSafeInteger(value) || value < 1 || value > 65535) ||
        port === portV6)
    {
        throw new Error("Server ports must be distinct integers between 1 and 65535");
    }

    if (await exists(output))
    {
        const metadata = JSON.parse(await readFile(path.join(output, DemoFiles.Metadata), "utf8"));
        if (metadata.version !== 1)
        {
            throw new Error("Refusing to replace an unmarked server directory");
        }

        await assertStopped(output);
    }

    await mkdir(path.dirname(output), { recursive: true });
    const stage = await mkdtemp(path.join(path.dirname(output), ".preparing-"));
    let backup: string | undefined;
    try
    {
        for (const entry of await readdir(engine, { withFileTypes: true }))
        {
            if (entry.isFile() &&
                /^(bedrock_server\.exe|.*\.dll|.*\.so|profanity_filter\.wlist|packetlimitconfig\.json)$/
                    .test(entry.name) ||
                entry.isDirectory() && [ "data", "definitions" ].includes(entry.name))
            {
                await cp(path.join(engine, entry.name), path.join(stage, entry.name), { recursive: true });
            }
        }

        for (const kind of [ "behavior_packs", "resource_packs" ])
        {
            await mkdir(path.join(stage, kind), { recursive: true });
            for (const entry of await readdir(path.join(engine, kind)))
            {
                if (/^(vanilla(?:_|$)|chemistry(?:_|$)|experimental_|server_)/.test(entry))
                {
                    await cp(path.join(engine, kind, entry), path.join(stage, kind, entry),
                        { recursive: true });
                }
            }
        }

        const selected = path.join(stage, "worlds", slug);
        await cp(world, selected, { recursive: true });
        for (const kind of [ "behavior_packs", "resource_packs" ])
        {
            const chosen = entries.filter((entry) => entry.kind === kind);
            for (const entry of chosen)
            {
                await cp(entry.source, path.join(stage, kind, entry.manifest.header.uuid),
                    { recursive: true });
            }

            await writeFile(path.join(selected, `world_${kind}.json`), JSON.stringify(chosen.map((entry) =>
                ({ pack_id: entry.manifest.header.uuid,
                    version: packTriple(entry.manifest.header.version) })), null, 2) + "\n");
        }

        await mkdir(path.join(stage, "config/default"), { recursive: true });
        await writeFile(path.join(stage, "config/default/permissions.json"),
            JSON.stringify({ allowed_modules: [] }));
        await writeFile(path.join(stage, "allowlist.json"), "[]\n");
        await writeFile(path.join(stage, "permissions.json"), "[]\n");
        for (const entry of entries.filter((value) => value.kind === "behavior_packs"))
        {
            for (const module of entry.manifest.modules ?? [])
            {
                if (module.type === "script")
                {
                    if (!/^[\da-f-]{36}$/i.test(module.uuid))
                    {
                        throw new Error("Invalid script module UUID");
                    }

                    const configuration = path.join(stage, "config", module.uuid);
                    await mkdir(configuration, { recursive: true });
                    const allowed = (entry.manifest.dependencies ?? [])
                        .filter((dependency: { module_name?: string }) => dependency.module_name)
                        .map((dependency: { module_name: string }) => dependency.module_name);
                    await writeFile(path.join(configuration, "permissions.json"),
                        JSON.stringify({ allowed_modules: allowed }));
                }
            }
        }

        const config = {
            ...options.config,
            "allow-cheats": true,
            "allow-list": false,
            difficulty: "peaceful",
            "enable-lan-visibility": true,
            "force-gamemode": true,
            gamemode: "creative",
            "level-name": slug,
            "online-mode": true,
            "server-name": name,
            "server-port": port,
            "server-portv6": portV6,
            "texturepack-required": true
        };
        if (Object.entries(config).some(([ key, value ]) => /[=\r\n\0]/.test(key) ||
            /[\r\n\0]/.test(String(value))))
        {
            throw new Error("Invalid server configuration line");
        }

        await writeFile(path.join(stage, "server.properties"), Object.entries(config).map(([ key, value ]) =>
            `${key}=${value}`).join("\n") + "\n");
        const launcher = path.join(Repository, "Script/Deprecated/Demonstration/Source/start.mts");
        const metadata: DemonstrationMetadata = { description,
            descriptor: slug,
            instructions: options.instructions,
            launcher,
            name,
            port,
            readyMarker: options.readyMarker,
            version: 1,
            world: slug };
        await writeFile(path.join(stage, DemoFiles.Metadata), JSON.stringify(metadata, null, 2) + "\n");
        if (/["%\r\n]/.test(launcher))
        {
            throw new Error("Launcher path contains unsupported shell characters");
        }

        const preload = import.meta.resolve("tsx").replaceAll("%", "%%");
        await writeFile(path.join(stage, "Start Demonstration.cmd"),
            `@echo off\r\ncd /d "%~dp0"\r\nnode --import "${preload}" ` +
                `"${launcher}" --server "%~dp0."\r\npause\r\n`);
        if (await exists(output))
        {
            await assertStopped(output);
            backup = output + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-");
            await publish(output, backup);
        }

        try
        {
            await publish(stage, output);
        }
        catch (error)
        {
            if (backup)
            {
                await publish(backup, output);
            }

            throw error;
        }
    }
    finally
    {
        // Stage is always a verified mkdtemp child of the output parent.
        await rm(stage, {
            force: true,
            recursive: true
        });
    }

    const command = await register(addon, output, slug);
    await mkdir(path.join(Repository, "dist"), { recursive: true });
    const registry = path.join(Repository, "dist/demonstration-servers.json");
    const known: Array<string> = await exists(registry) ? JSON.parse(await readFile(registry, "utf8")) : [];
    const executable = path.join(output, "bedrock_server.exe");
    await writeFile(registry, JSON.stringify([ ...new Set([ ...known, executable ]) ], null, 2) + "\n");
    console.log(`Created ${output}. Creation does not start BDS.`);
    return { backup,
        command,
        server: output };
}

export { DemoFiles };
