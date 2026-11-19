/**
 * Dependency-aware activation plans and locked enable/disable transactions.
 *
 * @module bedrock-server-manager/activation
 *
 * @file      activation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { Diagnostic, InstalledPack, InventoryOptions } from "./inventory.js";
import { Effect, FileSystem, Option, Path } from "effect";
import type { Replacement, Transaction } from "./transaction.js";
import { discoverInventory, selectAddon } from "./inventory.js";
import { findPack, scanInstalled } from "./installed.js";
import { object, uuid, version, versionText } from "./manifest.js";
import { resolveServer, resolveWorld } from "./server.js";
import type { Dependency } from "./manifest.js";
import type { ExistingPack } from "./installed.js";
import type { RuntimeContext } from "./config.js";
import { mutationPath } from "./safety.js";
import { withTransaction } from "./transaction.js";

const activationEntries = (server: string, file: string) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    yield* mutationPath(server, file);
    if (!(yield* fs.exists(file)))
    {
        return [] as Array<Record<string, unknown>>;
    }
    const text = yield* fs.readFileString(file);
    return yield* Effect.try({
        catch: (error: unknown) => new Error(`Invalid activation file ${file}: ${String(error)}`),
        try: (): Array<Record<string, unknown>> =>
        {
            const raw: unknown = JSON.parse(text);
            if (!Array.isArray(raw))
            {
                throw new Error("Expected an activation array.");
            }
            for (const entry of raw)
            {
                if (!object(entry) || !uuid(entry.pack_id) || !version(entry.version))
                {
                    throw new Error("Each activation entry needs pack_id and a valid version.");
                }
            }
            return raw;
        }
    });
});

/** Plan both world files before committing any pack, registry or activation changes. */
const planActivation = (transaction: Transaction, world: string, installed: Array<ExistingPack>,
    target: Array<string>, enable: boolean) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const behaviorFile = path.join(world, "world_behavior_packs.json");
    const resourceFile = path.join(world, "world_resource_packs.json");
    const behavior = yield* activationEntries(transaction.server, behaviorFile);
    const resource = yield* activationEntries(transaction.server, resourceFile);
    const active = new Map<string, ExistingPack>();
    for (const [ kind, entries ] of [ [ "behavior", behavior ], [ "resource", resource ] ] as const)
    {
        for (const entry of entries)
        {
            const id = BedrockString.toLowerCase(String(entry.pack_id));
            const pack = version(entry.version) ? findPack(installed, id, entry.version) : Option.none<ExistingPack>();
            if (active.has(id) || Option.isNone(pack) || pack.value.manifest.kind !== kind)
            {
                return yield* Effect.fail(new Error(`Invalid/duplicate ${kind} activation reference: ${id}`));
            }
            active.set(id, pack.value);
        }
    }
    const desired = new Map<string, ExistingPack>();
    const requirements = new Set<string>();
    for (const id of target)
    {
        const pack = findPack(installed, id);
        if (Option.isNone(pack))
        {
            return yield* Effect.fail(new Error(`Target pack is not installed: ${id}`));
        }
        desired.set(id, pack.value);
    }
    if (enable)
    {
        // Map iteration visits appended dependencies once and naturally accepts cycles.
        for (const pack of desired.values())
        {
            for (const dependency of pack.manifest.dependencies)
            {
                if (dependency.module_name)
                {
                    requirements.add(`${dependency.module_name}@${versionText(dependency.version)}`);
                    continue;
                }
                const required = findPack(installed, dependency.uuid!, dependency.version);
                if (Option.isNone(required))
                {
                    return yield* Effect.fail(new Error(
                        `Missing/mismatched dependency ${dependency.uuid}` +
                        `@${versionText(dependency.version)} ` +
                        `required by ${pack.manifest.name}.`
                    ));
                }
                desired.set(required.value.manifest.uuid, required.value);
            }
        }
    }
    else
    {
        for (const [ id, dependent ] of active)
        {
            if (desired.has(id))
            {
                continue;
            }
            if (dependent.manifest.dependencies.some((dependency: Dependency) =>
                dependency.uuid && desired.has(dependency.uuid)))
            {
                return yield* Effect.fail(new Error(
                    `Cannot disable: enabled pack ${dependent.manifest.name} (${id}) requires this addon.`
                ));
            }
        }
    }
    const changes: Array<Replacement> = [];
    for (const [ kind, entries, destination ] of [
        [ "behavior", behavior, behaviorFile ], [ "resource", resource, resourceFile ]
    ] as const)
    {
        const next = enable ? [ ...entries ] : entries.filter((entry: Record<string, unknown>) =>
            !desired.has(BedrockString.toLowerCase(String(entry.pack_id))));
        if (enable)
        {
            for (const [ id, pack ] of desired)
            {
                if (pack.manifest.kind === kind && !active.has(id))
                {
                    next.push({ pack_id: id, version: pack.manifest.version });
                }
            }
        }
        if (JSON.stringify(next) === JSON.stringify(entries))
        {
            continue;
        }
        const staged = path.join(transaction.stage, `world-${kind}.new.json`);
        yield* fs.writeFileString(staged, `${JSON.stringify(next, null, 2)}\n`);
        changes.push({ destination, staged });
    }
    return { changes, requirements: [ ...requirements ] };
});

const changeActivation = (context: RuntimeContext, selector: string, options: InventoryOptions,
    enable: boolean) => Effect.gen(function*()
{
    const server = yield* resolveServer(context, options.server);
    const world = yield* resolveWorld(context, server, options.world);
    return yield* withTransaction(server, (transaction: Transaction) => Effect.gen(function*()
    {
        const path = yield* Path.Path;
        yield* mutationPath(server, path.join(server, ".bedrock-server-manager", "registry.json"));
        const inventory = yield* discoverInventory(context, { ...options, server, world: world.name });
        const addon = yield* selectAddon(inventory, selector, options.scope);
        if (!addon.members.length || addon.members.some((pack: InstalledPack) => !pack.identity) ||
            inventory.diagnostics.some((entry: Diagnostic) => entry.code === "missing-registered-pack" &&
                entry.message.startsWith(`Bundle ${addon.id} `)))
        {
            return yield* Effect.fail(new Error(`Bundle ${addon.id} has missing or invalid packs.`));
        }
        const all = yield* scanInstalled(server);
        const selected = all.filter((pack: ExistingPack) => pack.world === null || pack.world === world.name);
        const planned = yield* planActivation(transaction, world.directory, selected,
            addon.members.map((pack: InstalledPack) => pack.identity!.uuid), enable);
        yield* transaction.commit(planned.changes);
        return { id: addon.id, name: addon.name, requirements: planned.requirements };
    }));
});

export { activationEntries, changeActivation, planActivation };
