/**
 * Versioned bundle registry contract. Read-only commands never create this file.
 *
 * @module bedrock-server-manager/registry
 *
 * @file      registry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";
import { object, uuid } from "./manifest.js";

/** A member location is relative to the server, with forward slash separators. */
export interface RegistryMember
{
    readonly uuid: string;
    readonly location: string;
}
/** Durable source grouping; null source represents adopted existing packs. */
export interface RegistryBundle
{
    readonly id: string;
    readonly name: string;
    readonly source: string | null;
    readonly packs: Array<RegistryMember>;
}
/** Initial registry format, consumed by inventory and future install transactions. */
export interface Registry
{
    readonly version: 1;
    readonly bundles: Array<RegistryBundle>;
}

const parseRegistry = (raw: unknown) => Effect.gen(function*()
{
    const path = yield* Path.Path;
    return yield* Effect.try({
        catch: (error: unknown) => new Error(`Invalid bundle registry: ${String(error)}`),
        try: (): Registry =>
        {
            if (!object(raw) || raw.version !== 1 || !Array.isArray(raw.bundles))
            {
                throw new Error("Expected version 1 and a bundles array.");
            }
            const ids = new Set<string>();
            const locations = new Set<string>();
            const owners = new Map<string, string>();
            const bundles: Array<RegistryBundle> = [];
            for (const entry of raw.bundles)
            {
                if (!object(entry) || typeof entry.id !== "string" || !BedrockString.trim(entry.id) ||
                    ids.has(entry.id) ||
                    typeof entry.name !== "string" || !BedrockString.trim(entry.name) ||
                    !(entry.source === null || (typeof entry.source === "string" &&
                        path.isAbsolute(entry.source))) || !Array.isArray(entry.packs) || !entry.packs.length)
                {
                    throw new Error("Bundles need a unique ID, name, absolute source (or null) and members.");
                }
                ids.add(entry.id);
                const packs: Array<RegistryMember> = [];
                for (const member of entry.packs)
                {
                    if (!object(member) || !uuid(member.uuid) || typeof member.location !== "string" ||
                        !/^(?:worlds\/[^/]+\/)?(?:behavior_packs|resource_packs)\/[^/]+$/
                            .test(member.location) ||
                        /[\\:\0]/.test(member.location) || member.location.split("/").some(
                        (part: string) => part === "." || part === ".."))
                    {
                        throw new Error("Members need a UUID and a safe server-relative pack location.");
                    }
                    const locationKey = path.normalize(member.location);
                    const normalized = path.sep === "\\" ? BedrockString.toLowerCase(locationKey) : locationKey;
                    const id = BedrockString.toLowerCase(member.uuid);
                    if (locations.has(normalized) || (owners.has(id) && owners.get(id) !== entry.id))
                    {
                        throw new Error(`Conflicting member ownership: ${member.location} (${id})`);
                    }
                    locations.add(normalized);
                    owners.set(id, entry.id);
                    packs.push({ location: member.location, uuid: id });
                }
                bundles.push({ id: entry.id, name: entry.name, packs, source: entry.source });
            }
            return { bundles, version: 1 };
        }
    });
});

const readRegistry = (server: string) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(server, ".bedrock-server-manager", "registry.json");
    if (!(yield* fs.exists(file)))
    {
        return { bundles: [], version: 1 } as Registry;
    }
    const content = yield* fs.readFileString(file);
    const raw = yield* Effect.try({
        catch: (error: unknown) => new Error(`Invalid bundle registry at ${file}: ${String(error)}`),
        try: (): unknown => JSON.parse(content)
    });
    return yield* parseRegistry(raw);
});

export { parseRegistry, readRegistry };
