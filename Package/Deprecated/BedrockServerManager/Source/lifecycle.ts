/**
 * Transactional bundle updates, adoption and removal across affected worlds.
 *
 * @module bedrock-server-manager/lifecycle
 *
 * @file      lifecycle.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import type { Addon, InstalledPack, Inventory, InventoryOptions } from "./inventory.js";
import { Effect, FileSystem, Path } from "effect";
import type { Registry, RegistryBundle, RegistryMember } from "./registry.js";
import type { Replacement, Transaction } from "./transaction.js";
import { parseRegistry, readRegistry } from "./registry.js";
import { resolveServer, resolveWorld } from "./server.js";
import type { AffectedWorld } from "./world-change.js";
import type { ExistingPack } from "./installed.js";
import type { RuntimeContext } from "./config.js";
import { ingestSource } from "./source.js";
import { mutationPath } from "./safety.js";
import { planWorldChanges } from "./world-change.js";
import { rejectLinks } from "./safety.js";
import { scanInstalled } from "./installed.js";
import { selectAddon } from "./inventory.js";
import { versionText } from "./manifest.js";
import { withTransaction } from "./transaction.js";

/** Update selection optionally replaces the remembered source. */
export interface UpdateOptions extends InventoryOptions
{
    readonly source?: string;
}

const serverWorlds = (server: string) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = path.join(server, "worlds");
    yield* rejectLinks(root, true);
    const worlds: Array<AffectedWorld> = [];
    if (!(yield* fs.exists(root)))
    {
        return worlds;
    }
    for (const name of (yield* fs.readDirectory(root)).sort())
    {
        const directory = path.join(root, name);
        yield* rejectLinks(directory);
        if ((yield* fs.stat(directory)).type === "Directory")
        {
            worlds.push({ directory, name });
        }
    }
    return worlds;
});

/** Select visible bundles using the inventory selector without requiring a world before its creation. */
const mutationSelection = (context: RuntimeContext, server: string, options: InventoryOptions,
    registry: Registry, installed: Array<ExistingPack>, worlds: Array<AffectedWorld>, selector: string) =>
    Effect.gen(function*()
    {
        const path = yield* Path.Path;
        const world = worlds.length || options.world !== undefined || options.scope === "world"
            ? yield* resolveWorld(context, server, options.world) : { directory: server, name: "" };
        const same = (left: string, right: string): boolean => path.sep === "\\"
            ? BedrockString.toLowerCase(left) === BedrockString.toLowerCase(right) : left === right;
        const key = (location: string): string => path.sep === "\\"
            ? BedrockString.toLowerCase(path.normalize(location)) : path.normalize(location);
        const visible = (pack: ExistingPack): boolean => pack.world === null || same(pack.world, world.name);
        const asMember = (pack: ExistingPack): InstalledPack => ({
            activation: "unknown", identity: pack.manifest, kind: pack.manifest.kind,
            location: pack.location, manifest: pack.manifest.raw,
            relativeLocation: path.relative(server, pack.location).split(path.sep).join("/"),
            scope: pack.world === null ? "shared" : "world"
        });
        const claimed = new Set<string>();
        const addons: Array<Addon> = [];
        for (const bundle of registry.bundles)
        {
            const members = installed.filter((pack: ExistingPack) => bundle.packs.some(
                (member: RegistryMember) =>
                    same(path.join(server, ...member.location.split("/")), pack.location)));
            for (const member of bundle.packs) { claimed.add(key(member.location)); }
            const visibleMissing = bundle.packs.some((member: RegistryMember) =>
                !BedrockString.startsWith("worlds/")(member.location) || same(member.location.split("/")[1], world.name));
            if (members.some(visible) || visibleMissing)
            {
                addons.push({ id: bundle.id, members: members.filter(visible).map(asMember),
                    name: bundle.name, registered: true,
                    registeredMembers: bundle.packs, source: bundle.source });
            }
        }
        for (const pack of installed.filter(visible))
        {
            const member = asMember(pack);
            if (claimed.has(key(member.relativeLocation)))
            {
                continue;
            }
            addons.push({ id: `unregistered:${member.relativeLocation}`, members: [ member ],
                name: pack.manifest.name, registered: false, registeredMembers: [], source: null });
        }
        const inventory: Inventory = { addons, diagnostics: [], server, world };
        const addon = yield* selectAddon(inventory, selector, options.scope);
        if (!addon.registered && registry.bundles.some((bundle: RegistryBundle) => bundle.id === addon.id))
        {
            return yield* Effect.fail(new Error(
                `Conflicting bundle ID ${addon.id}; resolve the ID collision.`
            ));
        }
        const registered = addon.registered
            ? registry.bundles.find((bundle: RegistryBundle) => bundle.id === addon.id) : undefined;
        const targets: Array<ExistingPack> = [];
        if (registered)
        {
            for (const member of registered.packs)
            {
                const target = installed.find((pack: ExistingPack) =>
                    same(path.join(server, ...member.location.split("/")), pack.location));
                if (!target || target.manifest.uuid !== member.uuid)
                {
                    return yield* Effect.fail(new Error(
                        `Missing or changed registered member: ${member.location}`
                    ));
                }
                targets.push(target);
            }
        }
        else
        {
            targets.push(...installed.filter((pack: ExistingPack) =>
                addon.members.some((member: InstalledPack) => same(member.location, pack.location))));
        }
        return { addon, registered, targets };
    });

const changeBundle = (context: RuntimeContext, selector: string, options: UpdateOptions,
    removing: boolean) => Effect.gen(function*()
{
    const server = yield* resolveServer(context, options.server);
    return yield* withTransaction(server, (transaction: Transaction) => Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const registryFile = path.join(server, ".bedrock-server-manager", "registry.json");
        yield* mutationPath(server, registryFile);
        const registry = yield* readRegistry(server);
        const installed = yield* scanInstalled(server);
        const worlds = yield* serverWorlds(server);
        const { addon, registered, targets } = yield* mutationSelection(context, server, options,
            registry, installed, worlds, selector);
        if (!targets.length)
        {
            return yield* Effect.fail(new Error("Bundle has no installed member packs."));
        }
        const targetLocations = new Set(targets.map((pack: ExistingPack) => pack.location));
        const oldIds = new Set(targets.map((pack: ExistingPack) => pack.manifest.uuid));
        const others = installed.filter((pack: ExistingPack) => !targetLocations.has(pack.location));
        const shared = targets.some((pack: ExistingPack) => pack.world === null);
        const owners = new Set(targets.map((pack: ExistingPack) => pack.world));
        const affected = shared ? worlds : worlds.filter((world: AffectedWorld) => owners.has(world.name));
        const changes: Array<Replacement> = [];
        const nextPacks: Array<ExistingPack> = [];
        const requirements = new Set<string>();
        let updated: RegistryBundle | null = null;
        if (!removing)
        {
            if (owners.size !== 1)
            {
                return yield* Effect.fail(new Error("Cannot update a bundle spanning scopes/worlds."));
            }
            const input = options.source ?? registered?.source;
            if (!input)
            {
                return yield* Effect.fail(new Error("No remembered source. Use --source <path> to update."));
            }
            const source = yield* ingestSource(context, input).pipe(Effect.mapError((error: unknown) =>
                new Error(`Cannot load source ${input}. ` +
                    `Use --source <path> to replace it: ${String(error)}`)));
            const reserved = new Set<string>();
            for (const pack of others)
            {
                for (const id of [ pack.manifest.uuid, ...pack.manifest.moduleUuids ]) { reserved.add(id); }
            }
            for (const bundle of registry.bundles)
            {
                if (bundle.id === addon.id)
                {
                    continue;
                }
                for (const member of bundle.packs) { reserved.add(member.uuid); }
            }
            updated = { id: addon.id, name: source.name, packs: [], source: source.source };
            for (let index = 0; index < source.packs.length; index++)
            {
                const pack = source.packs[index];
                for (const dependency of pack.manifest.dependencies)
                {
                    if (dependency.module_name)
                    {
                        requirements.add(`${dependency.module_name}@${versionText(dependency.version)}`);
                    }
                }
                for (const id of [ pack.manifest.uuid, ...pack.manifest.moduleUuids ])
                {
                    if (reserved.has(id))
                    {
                        return yield* Effect.fail(new Error(`Conflicting UUID ownership: ${id}`));
                    }
                }
                const previous = targets.find((target: ExistingPack) =>
                    target.manifest.uuid === pack.manifest.uuid &&
                    target.manifest.kind === pack.manifest.kind);
                const owner = targets[0].world;
                const destination = previous?.location ?? path.join(server,
                    ...(owner === null ? [] : [ "worlds", owner ]),
                    `${pack.manifest.kind}_packs`, pack.manifest.uuid);
                yield* mutationPath(server, destination);
                const staged = path.join(transaction.stage, `updated-pack-${index}`);
                yield* fs.makeDirectory(staged);
                for (const [ name, bytes ] of pack.files)
                {
                    const file = path.join(staged, ...name.split("/"));
                    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
                    yield* fs.writeFile(file, bytes, { flag: "wx" });
                }
                changes.push({ allowDirectory: true, destination,
                    mustBeAbsent: !targetLocations.has(destination), staged });
                nextPacks.push({ location: destination, manifest: pack.manifest, world: owner });
                updated.packs.push({ location: path.relative(server, destination).split(path.sep).join("/"),
                    uuid: pack.manifest.uuid });
            }
        }
        const destinations = new Set(nextPacks.map((pack: ExistingPack) => pack.location));
        for (const pack of targets)
        {
            if (destinations.has(pack.location))
            {
                continue;
            }
            changes.push({ allowDirectory: true, destination: pack.location, staged: null });
        }
        const nextRegistry = yield* parseRegistry({ bundles: [
            ...registry.bundles.filter((bundle: RegistryBundle) => bundle.id !== addon.id),
            ...(updated ? [ updated ] : [])
        ], version: 1 });
        if (registered || updated)
        {
            const staged = path.join(transaction.stage, "lifecycle-registry.new.json");
            yield* fs.writeFileString(staged, `${JSON.stringify(nextRegistry, null, 2)}\n`);
            changes.push({ destination: registryFile, staged });
        }
        const planned = yield* planWorldChanges(transaction, affected, installed, [ ...others, ...nextPacks ],
            oldIds, new Set(nextPacks.map((pack: ExistingPack) => pack.manifest.uuid)), removing);
        changes.push(...planned.changes);
        yield* transaction.commit(changes);
        for (const requirement of planned.requirements) { requirements.add(requirement); }
        return { id: addon.id, name: updated?.name ?? addon.name,
            requirements: [ ...requirements ], worlds: affected.map((world: AffectedWorld) => world.name) };
    }));
});

const updateAddon = (context: RuntimeContext, selector: string, options: UpdateOptions) =>
    changeBundle(context, selector, options, false);
const removeAddon = (context: RuntimeContext, selector: string, options: InventoryOptions) =>
    changeBundle(context, selector, options, true);

export { mutationSelection, removeAddon, serverWorlds, updateAddon };
