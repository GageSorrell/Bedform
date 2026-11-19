/**
 * Preflight and activation rewrites for bundle replacement/removal in every affected world.
 *
 * @module bedrock-server-manager/world-change
 *
 * @file      world-change.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Option, Path } from "effect";
import type { Replacement, Transaction } from "./transaction.js";
import { sameVersion, version, versionText } from "./manifest.js";
import type { ExistingPack } from "./installed.js";
import { activationEntries } from "./activation.js";
import { findPack } from "./installed.js";

/** An existing world selected for a bundle mutation. */
export interface AffectedWorld
{
    readonly name: string;
    readonly directory: string;
}
type Entries = Array<Record<string, unknown>>;

/** Validate activation against an exact snapshot of packs visible in a world. */
const checkReferences = (packs: Array<ExistingPack>, behavior: Entries, resource: Entries) =>
    Effect.gen(function*()
    {
        const active = new Map<string, ExistingPack>();
        for (const [ kind, entries ] of [ [ "behavior", behavior ], [ "resource", resource ] ] as const)
        {
            for (const entry of entries)
            {
                const id = BedrockString.toLowerCase(String(entry.pack_id));
                const pack = version(entry.version) ? findPack(packs, id, entry.version) : Option.none<ExistingPack>();
                if (active.has(id) || Option.isNone(pack) || pack.value.manifest.kind !== kind)
                {
                    return yield* Effect.fail(new Error(`Invalid/duplicate ${kind} activation: ${id}`));
                }
                active.set(id, pack.value);
            }
        }
        return active;
    });

/** Build all world replacements before allowing the enclosing transaction to commit. */
const planWorldChanges = (transaction: Transaction, worlds: Array<AffectedWorld>,
    before: Array<ExistingPack>, after: Array<ExistingPack>, removed: Set<string>, added: Set<string>,
    removing: boolean) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const changes: Array<Replacement> = [];
    const requirements = new Set<string>();
    for (let index = 0; index < worlds.length; index++)
    {
        const world = worlds[index];
        const visible = (pack: ExistingPack): boolean => pack.world === null || pack.world === world.name;
        const oldPacks = before.filter(visible);
        const newPacks = after.filter(visible);
        const behaviorFile = path.join(world.directory, "world_behavior_packs.json");
        const resourceFile = path.join(world.directory, "world_resource_packs.json");
        const behavior = yield* activationEntries(transaction.server, behaviorFile);
        const resource = yield* activationEntries(transaction.server, resourceFile);
        const original = yield* checkReferences(oldPacks, behavior, resource);
        if (removing)
        {
            for (const [ id, pack ] of original)
            {
                if (removed.has(id))
                {
                    continue;
                }
                for (const dependency of pack.manifest.dependencies)
                {
                    if (dependency.uuid && removed.has(dependency.uuid))
                    {
                        return yield* Effect.fail(new Error(
                            `Cannot remove in world ${world.name}: enabled pack ${pack.manifest.name} ` +
                            `(${id}) requires ${dependency.uuid}.`
                        ));
                    }
                }
            }
        }
        const next: { behavior: Entries; resource: Entries } = { behavior: [], resource: [] };
        const active = new Set<string>();
        let bundleEnabled = false;
        for (const [ kind, entries ] of [ [ "behavior", behavior ], [ "resource", resource ] ] as const)
        {
            for (const entry of entries)
            {
                const id = BedrockString.toLowerCase(String(entry.pack_id));
                if (!removed.has(id))
                {
                    next[kind].push(entry);
                    active.add(id);
                    continue;
                }
                bundleEnabled = true;
                const replacement = findPack(newPacks, id);
                if (!removing && Option.isSome(replacement) && added.has(id))
                {
                    next[replacement.value.manifest.kind].push({ ...entry, version: replacement.value.manifest.version });
                    active.add(id);
                }
            }
        }
        const pending = new Map<string, Option.Option<ExistingPack>>();
        if (!removing && bundleEnabled)
        {
            for (const id of added)
            {
                // Retained disabled members stay disabled unless required by an enabled member.
                if (active.has(id) || !removed.has(id))
                {
                    pending.set(id, findPack(newPacks, id));
                }
            }
            // Preserve the bundle's enabled state when none of its formerly enabled members survive.
            if (!pending.size)
            {
                for (const id of added) { pending.set(id, findPack(newPacks, id)); }
            }
        }
        for (const [ id, pack ] of pending)
        {
            if (Option.isNone(pack))
            {
                return yield* Effect.fail(new Error(`Updated pack ${id} is unavailable in ${world.name}.`));
            }
            if (!active.has(id))
            {
                next[pack.value.manifest.kind].push({ pack_id: id, version: pack.value.manifest.version });
                active.add(id);
            }
            for (const dependency of pack.value.manifest.dependencies)
            {
                if (dependency.module_name)
                {
                    requirements.add(`${dependency.module_name}@${versionText(dependency.version)}`);
                    continue;
                }
                const required = findPack(newPacks, dependency.uuid!, dependency.version);
                if (Option.isNone(required))
                {
                    return yield* Effect.fail(new Error(
                        `Missing/mismatched dependency ${dependency.uuid} in world ${world.name}.`
                    ));
                }
                if (!pending.has(required.value.manifest.uuid))
                {
                    pending.set(required.value.manifest.uuid, required);
                }
            }
        }
        const resolved = yield* checkReferences(newPacks, next.behavior, next.resource);
        // External enabled packs must still resolve against the replacement inventory.
        for (const pack of resolved.values())
        {
            for (const dependency of pack.manifest.dependencies)
            {
                if (!dependency.uuid)
                {
                    continue;
                }
                const required = resolved.get(dependency.uuid);
                if (!required || !sameVersion(required.manifest.version, dependency.version))
                {
                    return yield* Effect.fail(new Error(
                        `Update/removal would break enabled dependency ${dependency.uuid} ` +
                        `required by ${pack.manifest.name} in world ${world.name}.`
                    ));
                }
            }
        }
        for (const [ kind, previous, destination ] of [
            [ "behavior", behavior, behaviorFile ], [ "resource", resource, resourceFile ]
        ] as const)
        {
            if (JSON.stringify(previous) === JSON.stringify(next[kind]))
            {
                continue;
            }
            const staged = path.join(transaction.stage, `world-${index}-${kind}.new.json`);
            yield* fs.writeFileString(staged, `${JSON.stringify(next[kind], null, 2)}\n`);
            changes.push({ destination, staged });
        }
    }
    return { changes, requirements: [ ...requirements ] };
});

export { planWorldChanges };
