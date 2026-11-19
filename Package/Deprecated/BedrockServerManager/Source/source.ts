/**
 * Folder and nested archive ingestion into validated byte-array pack snapshots.
 *
 * @module bedrock-server-manager/source
 *
 * @file      source.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Option, Path } from "effect";
import { charge, decodeArchive } from "./archive.js";
import { portableName, rejectLinks } from "./safety.js";
import type { ExpansionBudget } from "./archive.js";
import type { Manifest } from "./manifest.js";
import type { RuntimeContext } from "./config.js";
import { parseManifest } from "./manifest.js";

/** A validated pack snapshot; paths are relative to its manifest directory. */
export interface SourcePack
{
    readonly manifest: Manifest;
    readonly files: Map<string, Uint8Array>;
}
/** Immutable source identity and all its member packs. */
export interface SourceBundle
{
    readonly source: string;
    readonly name: string;
    readonly packs: Array<SourcePack>;
}

const archiveName = (name: string): boolean => /\.(zip|mcaddon|mcpack)$/i.test(name);
const attempted = <Value>(body: () => Value) => Effect.try({
    catch: (error: unknown) => error instanceof Error ? error : new Error(String(error)), try: body
});

const readBounded = (file: string, budget: ExpansionBudget) => Effect.scoped(Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const handle = yield* fs.open(file);
    const chunks: Array<Uint8Array> = [];
    let size = 0;
    while (true)
    {
        const chunk = yield* handle.readAlloc(65536);
        if (Option.isNone(chunk))
        {
            break;
        }
        yield* attempted(() => charge(budget, chunk.value.length));
        size += chunk.value.length;
        chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
}));

/** Discover pack roots first, expanding archives only outside already-recognized packs. */
const collectPacks = (files: Map<string, Uint8Array>, budget: ExpansionBudget, depth: number):
Effect.Effect<Array<SourcePack>, Error> => Effect.gen(function*()
{
    const roots = [ ...files.keys() ].filter((name: string) => name.split("/").at(-1) === "manifest.json")
        .map((name: string) => name.slice(0, -"manifest.json".length)).sort();
    const packs: Array<SourcePack> = [];
    for (const root of roots)
    {
        if (roots.some((other: string) => other !== root && root.startsWith(other)))
        {
            return yield* Effect.fail(new Error(`Nested pack manifests are ambiguous: ${root}`));
        }
        const raw = yield* attempted((): unknown => JSON.parse(new TextDecoder().decode(
            files.get(`${root}manifest.json`)!
        )));
        const manifest = yield* attempted(() => parseManifest(raw));
        const contents = new Map([ ...files ].filter(([ name ]: [string, Uint8Array]) =>
            name.startsWith(root))
            .map(([ name, bytes ]: [string, Uint8Array]) => [ name.slice(root.length), bytes ] as const));
        for (const script of manifest.scripts)
        {
            const safe = yield* attempted(() => portableName(script));
            if (safe !== script || !contents.has(safe))
            {
                return yield* Effect.fail(new Error(`Missing or unsafe script entry: ${script}`));
            }
        }
        packs.push({ files: contents, manifest });
    }
    for (const [ name, bytes ] of files)
    {
        if (!archiveName(name) || roots.some((root: string) => name.startsWith(root)))
        {
            continue;
        }
        if (depth >= 4)
        {
            return yield* Effect.fail(new Error("Nested archives exceed four levels."));
        }
        const unpacked = yield* attempted(() => decodeArchive(bytes, budget));
        packs.push(...(yield* collectPacks(unpacked, budget, depth + 1)));
    }
    return packs;
});

/** Snapshot all files before installation. A lower byte ceiling is available for deterministic tests. */
const ingestSource = (context: RuntimeContext, input: string, maxBytes: number = 1024 ** 3) =>
    Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        if (!BedrockString.trim(input) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 1024 ** 3)
        {
            return yield* Effect.fail(new Error("Source/expanded-byte limit must be valid (maximum 1 GiB)."));
        }
        const source = path.resolve(context.cwd, input);
        yield* rejectLinks(source);
        const info = yield* fs.stat(source);
        const budget: ExpansionBudget = { limit: maxBytes, used: 0 };
        let files: Map<string, Uint8Array>;
        let depth = 0;
        if (info.type === "Directory")
        {
            files = new Map();
            const seen = new Set<string>();
            const pending = [ "" ];
            while (pending.length)
            {
                const relative = pending.pop()!;
                const absolute = path.join(source, ...relative.split("/"));
                yield* rejectLinks(absolute);
                for (const entry of (yield* fs.readDirectory(absolute)).sort())
                {
                    const name = yield* attempted(() =>
                        portableName(relative ? `${relative}/${entry}` : entry));
                    const key = BedrockString.toLowerCase(name);
                    if (seen.has(key))
                    {
                        return yield* Effect.fail(new Error(`Duplicate source path: ${name}`));
                    }
                    seen.add(key);
                    const file = path.join(source, ...name.split("/"));
                    yield* rejectLinks(file);
                    const stat = yield* fs.stat(file);
                    if (stat.type === "Directory")
                    {
                        pending.push(name);
                    }
                    else if (stat.type === "File")
                    {
                        if (Number(stat.size) > budget.limit - budget.used)
                        {
                            return yield* Effect.fail(new Error("Source exceeds expanded-byte limit."));
                        }
                        const bytes = yield* readBounded(file, budget);
                        if (bytes.length !== Number(stat.size))
                        {
                            return yield* Effect.fail(new Error(`Source changed while reading: ${file}`));
                        }
                        files.set(name, bytes);
                    }
                    else
                    {
                        return yield* Effect.fail(new Error(`Unsupported source entry: ${file}`));
                    }
                }
            }
        }
        else if (info.type === "File" && archiveName(source))
        {
            if (Number(info.size) > maxBytes)
            {
                return yield* Effect.fail(new Error("Source archive exceeds the 1 GiB input limit."));
            }
            const bytes = yield* readBounded(source, { limit: maxBytes, used: 0 });
            files = yield* attempted(() => decodeArchive(bytes, budget));
            depth = 1;
        }
        else
        {
            return yield* Effect.fail(new Error("Source must be a folder, .mcpack, .mcaddon or .zip."));
        }
        const packs = yield* collectPacks(files, budget, depth);
        if (!packs.length)
        {
            return yield* Effect.fail(new Error("No pack manifests were found in the source."));
        }
        const identities = new Set<string>();
        for (const pack of packs)
        {
            for (const id of [ pack.manifest.uuid, ...pack.manifest.moduleUuids ])
            {
                if (identities.has(id))
                {
                    return yield* Effect.fail(new Error(`Duplicate source UUID: ${id}`));
                }
                identities.add(id);
            }
        }
        const name = packs.length === 1 ? packs[0].manifest.name
            : path.basename(source, path.extname(source));
        return { name, packs, source } as SourceBundle;
    });

export { ingestSource };
