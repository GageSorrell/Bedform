/**
 * Effect process probes and verified, transactional prerequisite acquisition on Windows.
 *
 * @module monorepo-setup/PrerequisiteNode
 *
 * @file      PrerequisiteNode.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Effect, Layer, Stream } from "effect";
import {
    link,
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    rename,
    rm,
    stat,
    writeFile
} from "node:fs/promises";
import { PrerequisiteHost } from "./Prerequisite.js";
import type { ProcessCommand } from "./Contract.js";
import type { ToolArtifact } from "./Prerequisite.js";
import { createHash } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

/**
 * Reports IO and decoding failures through the component's Error channel.
 *
 * @category Converting
 * @since 1.0.0
 */
const Io = <Value>(run: (signal: AbortSignal) => Promise<Value>) =>
    Effect.tryPromise({
        catch: (error: unknown) => (error instanceof Error ? error : new Error(String(error))),
        try: run
    });

/**
 * Recognizes only a missing file; access and sharing errors must not become a successful absence probe.
 *
 * @category Predicate
 * @since 1.0.0
 */
const Missing = (error: unknown): boolean =>
    error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT";

/**
 * Computes the exact content pin, including Git's object framing for imported source data.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const ArtifactDigest = (bytes: Uint8Array, kind: "sha256" | "gitBlob"): string =>
    kind === "sha256"
        ? createHash("sha256").update(bytes).digest("hex")
        : createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

/**
 * Rejects unverified downloads before they can be written as executable or dependency inputs.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Testing
 * @since 1.0.0
 */
export const VerifyArtifact = (artifact: ToolArtifact, bytes: Uint8Array): void =>
{
    if (
        new URL(artifact.url).protocol !== "https:" ||
        (artifact.sha256 === undefined && artifact.gitBlob === undefined) ||
        (artifact.sha256 !== undefined && ArtifactDigest(bytes, "sha256") !== artifact.sha256) ||
        (artifact.gitBlob !== undefined && ArtifactDigest(bytes, "gitBlob") !== artifact.gitBlob)
    )
    {
        throw new Error(`Prerequisite download failed its local checksum: ${artifact.url}`);
    }
};

/**
 * Decodes a verified ZIP while rejecting traversal, Windows device paths and case collisions.
 * Files are materialized as regular files; archive link metadata is never followed.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const ArchiveFiles = (
    artifact: ToolArtifact,
    bytes: Uint8Array
): ReadonlyMap<string, Uint8Array> =>
{
    VerifyArtifact(artifact, bytes);
    const files = new Map<string, Uint8Array>();
    const names = new Set<string>();
    const unpacked = unzipSync(bytes);
    let prefix = artifact.prefix;
    if (artifact.marker !== undefined && unpacked[artifact.marker] === undefined)
    {
        const roots = new Set(Object.keys(unpacked).filter((name: string) => !name.endsWith("/"))
            .map((name: string) => name.split("/")[0]));
        if (roots.size !== 1 || unpacked[`${[ ...roots ][0]}/${artifact.marker}`] === undefined)
        {
            throw new Error("Prerequisite archive lacks its required normalized source marker.");
        }

        prefix = `${[ ...roots ][0]}/`;
    }

    for (const [ original, content ] of Object.entries(unpacked))
    {
        if (original.endsWith("/"))
        {
            continue;
        }

        if (prefix !== undefined && !original.startsWith(prefix))
        {
            throw new Error(`Unexpected prerequisite archive root: ${original}`);
        }

        const name =
            prefix === undefined ? original : original.slice(prefix.length);
        if (
            name.includes("\\") ||
            name
                .split("/")
                .some(
                    (part: string) =>
                        part === "" ||
                        part === "." ||
                        part === ".." ||
                        /[<>:"|?*]/u.test(part) ||
                        [ ...part ].some((character: string) => character.charCodeAt(0) < 32) ||
                        /[. ]$/.test(part) ||
                        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)
                ) ||
            names.has(name.toLowerCase())
        )
        {
            throw new Error(`Unsafe prerequisite archive path: ${original}`);
        }

        names.add(name.toLowerCase());
        files.set(name, content);
    }

    if (files.size === 0)
    {
        throw new Error("Prerequisite archive contains no files.");
    }

    return files;
};

/**
 * Retrieves bytes only from the manifest URL and checks them before any publication or execution.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Download = async (artifact: ToolArtifact, signal: AbortSignal): Promise<Uint8Array> =>
{
    if (new URL(artifact.url).protocol !== "https:")
    {
        throw new Error("Prerequisite downloads require HTTPS.");
    }

    const response = await fetch(artifact.url, {
        signal: AbortSignal.any([ signal, AbortSignal.timeout(600_000) ])
    });
    if (!response.ok || new URL(response.url).protocol !== "https:")
    {
        throw new Error(`Prerequisite download failed: ${response.status} ${artifact.url}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    VerifyArtifact(artifact, bytes);
    return bytes;
};

/**
 * Checks actual archive and extracted bytes without trusting a receipt or executable presence.
 *
 * @category Testing
 * @since 1.0.0
 */
export const ArchiveReady = async (artifact: ToolArtifact, directory: string): Promise<boolean> =>
{
    try
    {
        if ((await lstat(directory)).isSymbolicLink())
        {
            return false;
        }

        const files = ArchiveFiles(artifact, await readFile(`${directory}.source.zip`));
        for (const [ name, expected ] of files)
        {
            let parent = directory;
            for (const segment of name.split("/").slice(0, -1))
            {
                parent = path.join(parent, segment);
                if (
                    !(await lstat(parent)).isDirectory() ||
                    (await lstat(parent)).isSymbolicLink()
                )
                {
                    return false;
                }
            }

            const file = path.join(directory, ...name.split("/"));
            if (!(await lstat(file)).isFile() || !(await readFile(file)).equals(expected))
            {
                return false;
            }
        }

        return true;
    }
    catch (error: unknown)
    {
        if (
            Missing(error) ||
            (error instanceof Error && /checksum|archive|ZIP|zip/.test(error.message))
        )
        {
            return false;
        }

        throw error;
    }
};

/**
 * Atomically repairs only an explicitly selected dependency cache, retaining the previous tree on failure.
 * Temporary archive/extraction files are cleaned after errors and cancellation.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const InstallArchive = async (
    artifact: ToolArtifact,
    directory: string,
    signal: AbortSignal
): Promise<void> =>
{
    const existing = await lstat(directory).catch((error: unknown) =>
    {
        if (!Missing(error))
        {
            throw error;
        }

        return undefined;
    });
    if (existing?.isSymbolicLink())
    {
        throw new Error(`Refusing to replace a prerequisite-cache junction: ${directory}`);
    }

    await mkdir(path.dirname(directory), { recursive: true });
    const transaction = await mkdtemp(path.join(path.dirname(directory), ".bedform-prerequisite-"));
    const staged = path.join(transaction, "new");
    const backup = path.join(transaction, "previous");
    let moved = false;
    let published = false;
    try
    {
        const bytes = await Download(artifact, signal);
        const files = ArchiveFiles(artifact, bytes);
        for (const [ name, content ] of files)
        {
            const destination = path.join(staged, ...name.split("/"));
            await mkdir(path.dirname(destination), { recursive: true });
            await writeFile(destination, content, { flag: "wx" });
        }

        signal.throwIfAborted();
        if (existing !== undefined)
        {
            await rename(directory, backup);
            moved = true;
        }

        await rename(staged, directory);
        published = true;
        const archive = path.join(transaction, "source.zip");
        await writeFile(archive, bytes, { flag: "wx" });
        await rename(archive, `${directory}.source.zip`);
    }
    catch (error: unknown)
    {
        if (published)
        {
            await rename(directory, staged);
        }

        if (moved)
        {
            await rename(backup, directory);
        }

        throw error;
    }
    finally
    {
        // This exact directory was returned by mkdtemp above and contains only transaction-owned files.
        await rm(transaction, { force: true,
            recursive: true });
    }
};

/**
 * Supplies scoped IO and Effect ChildProcess probes without running any probe at import or layer creation.
 * Installers use the shared live-stream Processes service after policy consent.
 *
 * @category Layer
 * @since 1.0.0
 */
export const PrerequisiteHostLayer = Layer.effect(
    PrerequisiteHost,
    Effect.gen(function* ()
    {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const owned = new Set<string>();
        return {
            archive: (artifact: ToolArtifact, directory: string) =>
                Io((signal: AbortSignal) => InstallArchive(artifact, directory, signal)),
            archiveReady: (artifact: ToolArtifact, directory: string) =>
                Io(() => ArchiveReady(artifact, directory)),
            capture: (command: ProcessCommand) =>
                Effect.scoped(
                    Effect.gen(function* ()
                    {
                        const child = yield* spawner.spawn(
                            ChildProcess.make(command.executable, command.args, {
                                cwd: command.cwd,
                                env: { ...command.environment },
                                shell: false,
                                stderr: "pipe",
                                stdin: "ignore",
                                stdout: "pipe"
                            })
                        );
                        const [ stdout, stderr, code ] = yield* Effect.all(
                            [
                                Stream.runCollect(Stream.decodeText(child.stdout)),
                                Stream.runCollect(Stream.decodeText(child.stderr)),
                                child.exitCode
                            ],
                            { concurrency: "unbounded" }
                        );
                        return {
                            code: Number(code),
                            stderr: stderr.join(""),
                            stdout: stdout.join("")
                        };
                    })
                ).pipe(
                    Effect.timeout("2 minutes"),
                    Effect.mapError((error: unknown) => new Error(String(error)))
                ),
            cleanup: (directory: string) =>
                Io(async () =>
                {
                    if (!owned.has(directory))
                    {
                        throw new Error(
                            `Refusing cleanup of an unowned prerequisite directory: ${directory}`
                        );
                    }

                    await rm(directory, { force: true,
                        recursive: true });
                    owned.delete(directory);
                }),
            exists: (file: string) =>
                Io(async () =>
                {
                    try
                    {
                        return (await stat(file)).isFile();
                    }
                    catch (error: unknown)
                    {
                        if (Missing(error))
                        {
                            return false;
                        }

                        throw error;
                    }
                }),
            file: (artifact: ToolArtifact, file: string) =>
                Io(async (signal: AbortSignal) =>
                {
                    const bytes = await Download(artifact, signal);
                    await mkdir(path.dirname(file), { recursive: true });
                    const transaction = await mkdtemp(
                        path.join(path.dirname(file), ".bedform-prerequisite-")
                    );
                    try
                    {
                        const staged = path.join(transaction, "input");
                        await writeFile(staged, bytes, { flag: "wx" });
                        signal.throwIfAborted();
                        // Atomic publication preserves existing and concurrently written inputs.
                        await link(staged, file);
                    }
                    finally
                    {
                        await rm(transaction, { force: true,
                            recursive: true });
                    }
                }),
            hash: (file: string, kind: "sha256" | "gitBlob") =>
                Io(async () => ArtifactDigest(await readFile(file), kind)),
            read: (file: string) => Io(() => readFile(file, "utf8")),
            temporary: Io(async () =>
            {
                const directory = await mkdtemp(path.join(tmpdir(), "bedform-prerequisite-"));
                owned.add(directory);
                return directory;
            }),
            write: (file: string, text: string) =>
                Io(async () =>
                {
                    if (
                        ![ ...owned ].some(
                            (directory: string) => path.dirname(path.resolve(file)) === directory
                        )
                    )
                    {
                        throw new Error(
                            `Prerequisite probe write is outside its owned directory: ${file}`
                        );
                    }

                    await writeFile(file, text, { flag: "wx" });
                })
        };
    })
);
