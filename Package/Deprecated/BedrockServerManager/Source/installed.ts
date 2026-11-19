/**
 * Server-wide identity preflight for mutations, independent of a selected world.
 *
 * @module bedrock-server-manager/installed
 *
 * @file      installed.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path } from "effect";
import type { Manifest, PackVersion } from "./manifest.js";
import { conflictingUuids, parseManifest, sameVersion } from "./manifest.js";
import { portableName, rejectLinks } from "./safety.js";
import { Option } from "effect";

/** Installed identity with its owning world, or null for shared content. */
export interface ExistingPack
{
    readonly manifest: Manifest;
    readonly location: string;
    readonly world: string | null;
}

/** Inspect every world's pack roots so conflicting ownership cannot hide outside the selection. */
const scanInstalled = (server: string) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const worlds = path.join(server, "worlds");
    const owners: Array<string | null> = [ null ];
    if (yield* fs.exists(worlds))
    {
        yield* rejectLinks(worlds);
        for (const name of yield* fs.readDirectory(worlds))
        {
            const directory = path.join(worlds, name);
            yield* rejectLinks(directory);
            if ((yield* fs.stat(directory)).type === "Directory")
            {
                owners.push(name);
            }
        }
    }
    const packs: Array<ExistingPack> = [];
    for (const world of owners)
    {
        for (const kind of [ "behavior", "resource" ] as const)
        {
            const root = world === null ? path.join(server, `${kind}_packs`)
                : path.join(worlds, world, `${kind}_packs`);
            yield* rejectLinks(root, true);
            if (!(yield* fs.exists(root)))
            {
                continue;
            }
            for (const folder of (yield* fs.readDirectory(root)).sort())
            {
                const location = path.join(root, folder);
                yield* rejectLinks(location);
                if ((yield* fs.stat(location)).type !== "Directory")
                {
                    continue;
                }
                const file = path.join(location, "manifest.json");
                yield* rejectLinks(file);
                const text = yield* fs.readFileString(file);
                const manifest = yield* Effect.try({
                    catch: (error: unknown) => new Error(`Cannot inspect pack ${file}: ${String(error)}`),
                    try: () => parseManifest(JSON.parse(text))
                });
                if (manifest.kind !== kind)
                {
                    return yield* Effect.fail(new Error(`Installed pack is in the wrong directory: ${file}`));
                }
                for (const script of manifest.scripts)
                {
                    const entry = yield* Effect.try({
                        catch: (error: unknown) => new Error(String(error)), try: () => portableName(script)
                    });
                    const target = path.join(location, ...entry.split("/"));
                    // Stock BDS packs ship their scripts inside a Bedrock archive, not as loose entry files.
                    const archived = path.join(location, "__brarchive", "scripts.brarchive");
                    const present = (yield* fs.exists(target)) || !(yield* fs.exists(archived))
                        ? target : archived;
                    yield* rejectLinks(present);
                    if (entry !== script || (yield* fs.stat(present)).type !== "File")
                    {
                        return yield* Effect.fail(new Error(`Invalid installed script entry: ${target}`));
                    }
                }
                packs.push({ location, manifest, world });
            }
        }
    }
    const [ conflict ] = conflictingUuids(packs.map((pack: ExistingPack) => pack.manifest));
    if (conflict !== undefined)
    {
        return yield* Effect.fail(new Error(`Duplicate installed UUID: ${conflict}`));
    }
    return packs;
});

/**
 * The single pack with this UUID, and this version when one is given. Undefined when absent or when
 * several versions match, since only the version disambiguates packs sharing a UUID.
 */
const findPack = (packs: Array<ExistingPack>, id: string, wanted?: PackVersion): Option.Option<ExistingPack> =>
{
    const matches = packs.filter((pack: ExistingPack) => pack.manifest.uuid === id &&
        (wanted === undefined || sameVersion(pack.manifest.version, wanted)));
    return Option.fromUndefinedOr(matches.length === 1 ? matches[0] : undefined);
};

export { findPack, scanInstalled };
