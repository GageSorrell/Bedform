/**
 * Read-only inventory, validation, activation inspection and addon selection.
 *
 * @module bedrock-server-manager/inventory
 *
 * @file      inventory.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Effect, FileSystem, Path } from "effect";
import type { Manifest, PackKind, PackVersion } from "./manifest.js";
import {
    conflictingUuids, object, parseManifest, sameVersion, uuid, version, versionText
} from "./manifest.js";
import { resolveServer, resolveWorld } from "./server.js";
import type { RegistryBundle } from "./registry.js";
import type { RuntimeContext } from "./config.js";
import { readRegistry } from "./registry.js";

/** Location filter; dependency validation always uses the complete selected inventory. */
export type Scope = "shared" | "world";
/** A repairable inventory error or a scripting API requirement. */
export interface Diagnostic
{
    readonly code: string;
    readonly location: string;
    readonly message: string;
    readonly severity: "error" | "info";
}
/** An installed pack, including invalid manifests so validation can report all problems. */
export interface InstalledPack
{
    readonly location: string;
    readonly relativeLocation: string;
    readonly scope: Scope;
    readonly kind: PackKind;
    readonly manifest: Record<string, unknown> | null;
    readonly identity: Manifest | null;
    activation: "enabled" | "disabled" | "invalid" | "unknown";
}
/** Registered source grouping, or one standalone unregistered pack. */
export interface Addon
{
    readonly id: string;
    readonly name: string;
    readonly source: string | null;
    readonly registered: boolean;
    readonly members: Array<InstalledPack>;
    readonly registeredMembers: RegistryBundle["packs"];
}

export namespace Inventory
{
    /**
     * Name and directory of the selected world.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface World
    {
        readonly name: string;
        readonly directory: string;
    }
}
/** Selected-world inventory and its validation report. */
export interface Inventory
{
    readonly server: string;
    readonly world: Inventory.World;
    readonly addons: Array<Addon>;
    readonly diagnostics: Array<Diagnostic>;
}
/** Common selection flags passed by every read-only addon command. */
export interface InventoryOptions
{
    readonly server?: string;
    readonly world?: string;
    readonly scope?: Scope;
}

interface Activation
{
    readonly pack_id: string;
    readonly version: PackVersion;
}

const errorDiagnostic = (code: string, location: string, message: string): Diagnostic =>
    ({ code, location, message, severity: "error" });

/** Test real paths rather than string prefixes, including symlinked descendants. */
const contained = (parent: string, child: string) => Effect.gen(function*()
{
    const path = yield* Path.Path;
    const fs = yield* FileSystem.FileSystem;
    const relative = path.relative(yield* fs.realPath(parent), yield* fs.realPath(child));
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
});

const inspectPack = (server: string, relativeLocation: string, scope: Scope, kind: PackKind,
    diagnostics: Array<Diagnostic>) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const location = path.join(server, ...relativeLocation.split("/"));
    const pack: InstalledPack = {
        activation: "disabled", identity: null, kind, location, manifest: null, relativeLocation, scope
    };
    let rawManifest: Record<string, unknown> | null = null;
    const inspected = yield* Effect.result(Effect.gen(function*()
    {
        if (!(yield* contained(server, location)))
        {
            return yield* Effect.fail(new Error("Pack directory resolves outside the server."));
        }
        const file = path.join(location, "manifest.json");
        if (!(yield* contained(location, file)))
        {
            return yield* Effect.fail(new Error("Manifest resolves outside its pack directory."));
        }
        const text = yield* fs.readFileString(file);
        const raw = yield* Effect.try({
            catch: (error: unknown) => new Error(`Invalid manifest JSON: ${String(error)}`),
            try: (): unknown => JSON.parse(text)
        });
        rawManifest = object(raw) ? raw : null;
        const identity = yield* Effect.try({
            catch: (error: unknown) => error instanceof Error ? error : new Error(String(error)),
            try: () => parseManifest(raw)
        });
        return { identity, raw };
    }));
    if (inspected._tag === "Failure")
    {
        diagnostics.push(errorDiagnostic("invalid-manifest", location, String(inspected.failure)));
        return { ...pack, manifest: rawManifest };
    }
    const identity = inspected.success.identity;
    const result = { ...pack, identity, manifest: identity.raw };
    if (identity.kind !== kind)
    {
        diagnostics.push(errorDiagnostic("wrong-pack-directory", location,
            `Manifest declares ${identity.kind} content in the ${kind} pack directory.`));
    }
    for (const entry of identity.scripts)
    {
        const safe = !path.isAbsolute(entry) && !/[\\:\0]/.test(entry) &&
            !entry.split("/").some((part: string) => part === ".." || part === "");
        if (!safe)
        {
            diagnostics.push(errorDiagnostic("unsafe-script-entry", location,
                `Unsafe script entry: ${entry}`));
            continue;
        }
        const script = path.join(location, entry);
        // Stock BDS packs ship their scripts inside a Bedrock archive, not as loose entry files.
        const archived = path.join(location, "__brarchive", "scripts.brarchive");
        const checked = yield* Effect.result(Effect.gen(function*()
        {
            const file = (yield* fs.exists(script)) || !(yield* fs.exists(archived)) ? script : archived;
            const info = yield* fs.stat(file);
            return info.type === "File" && (yield* contained(location, file));
        }));
        if (checked._tag === "Failure" || !checked.success)
        {
            diagnostics.push(errorDiagnostic("missing-script-entry", location,
                `Script entry must be an existing file inside the pack: ${entry}`));
        }
    }
    return result;
});

const activationFile = (directory: string, kind: PackKind, diagnostics: Array<Diagnostic>) =>
    Effect.gen(function*()
    {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const file = path.join(directory, `world_${kind}_packs.json`);
        if (!(yield* fs.exists(file)))
        {
            return [] as Array<Activation>;
        }
        const checked = yield* Effect.result(Effect.gen(function*()
        {
            if (!(yield* contained(directory, file)))
            {
                return yield* Effect.fail(new Error("Activation file resolves outside the world directory."));
            }
            const text = yield* fs.readFileString(file);
            return yield* Effect.try({
                catch: (error: unknown) => new Error(String(error)),
                try: (): Array<Activation> =>
                {
                    const raw: unknown = JSON.parse(text);
                    if (!Array.isArray(raw))
                    {
                        throw new Error("Expected an activation array.");
                    }
                    return raw.map((entry: unknown, index: number): Activation =>
                    {
                        if (!object(entry) || !uuid(entry.pack_id) || !version(entry.version))
                        {
                            throw new Error(`Invalid activation entry at index ${index}.`);
                        }
                        return { pack_id: BedrockString.toLowerCase(entry.pack_id), version: entry.version };
                    });
                }
            });
        }));
        if (checked._tag === "Failure")
        {
            diagnostics.push(errorDiagnostic("invalid-activation-file", file, String(checked.failure)));
            return null;
        }
        return checked.success;
    });

const validatePacks = (packs: Array<InstalledPack>, diagnostics: Array<Diagnostic>): void =>
{
    const identified = packs.filter((pack: InstalledPack) => pack.identity);
    for (const id of conflictingUuids(identified.map((pack: InstalledPack) => pack.identity!)))
    {
        const matches = identified.filter((pack: InstalledPack) =>
            [ pack.identity!.uuid, ...pack.identity!.moduleUuids ].includes(id));
        for (const pack of matches)
        {
            diagnostics.push(errorDiagnostic("duplicate-identity", pack.location,
                `UUID ${id} appears in: ${matches.map((item: InstalledPack) => item.location).join(", ")}`));
        }
    }
    for (const pack of packs)
    {
        for (const dependency of pack.identity?.dependencies ?? [])
        {
            if (dependency.module_name)
            {
                diagnostics.push({
                    code: "scripting-api", location: pack.location,
                    message: `${dependency.module_name}@${versionText(dependency.version)} ` +
                        "(runtime requirement)",
                    severity: "info"
                });
                continue;
            }
            const matches = packs.filter((item: InstalledPack) => item.identity?.uuid === dependency.uuid);
            const exact = matches.filter((item: InstalledPack) =>
                sameVersion(item.identity!.version, dependency.version));
            if (!matches.length || exact.length > 1)
            {
                const code = matches.length ? "ambiguous-dependency" : "missing-dependency";
                diagnostics.push(errorDiagnostic(code,
                    pack.location, `Dependency ${dependency.uuid} needs exactly one installed pack.`));
            }
            else if (!exact.length)
            {
                diagnostics.push(errorDiagnostic("dependency-version", pack.location,
                    `Dependency ${dependency.uuid} requires ${versionText(dependency.version)}; installed ` +
                    matches.map((item: InstalledPack) => versionText(item.identity!.version)).join(", ") +
                    "."));
            }
        }
    }
};

const markActivation = (packs: Array<InstalledPack>, kind: PackKind,
    entries: Array<Activation> | null): void =>
{
    for (const pack of packs.filter((item: InstalledPack) => item.kind === kind))
    {
        if (entries === null)
        {
            pack.activation = "unknown";
            continue;
        }
        const matches = entries.filter((entry: Activation) => entry.pack_id === pack.identity?.uuid);
        if (!matches.length)
        {
            continue;
        }
        const versions = packs.filter((item: InstalledPack) => item.identity?.uuid === pack.identity?.uuid);
        // With several installed versions, an entry naming another version activates that one instead.
        if (versions.length > 1 && !matches.some((entry: Activation) =>
            sameVersion(entry.version, pack.identity!.version)))
        {
            continue;
        }
        const duplicates = versions.filter((item: InstalledPack) =>
            sameVersion(item.identity!.version, pack.identity!.version));
        pack.activation = matches.length === 1 && duplicates.length === 1 && pack.identity?.kind === kind &&
            sameVersion(matches[0].version, pack.identity.version) ? "enabled" : "invalid";
    }
};

const inspectActivation = (packs: Array<InstalledPack>, kind: PackKind, entries: Array<Activation> | null,
    directory: string, diagnostics: Array<Diagnostic>): void =>
{
    const seen = new Set<string>();
    for (const entry of entries ?? [])
    {
        if (seen.has(entry.pack_id))
        {
            diagnostics.push(errorDiagnostic("duplicate-activation", directory,
                `Duplicate ${kind} activation: ${entry.pack_id}`));
        }
        seen.add(entry.pack_id);
        const matches = packs.filter((pack: InstalledPack) => pack.identity?.uuid === entry.pack_id &&
            pack.kind === kind && pack.identity.kind === kind &&
            sameVersion(pack.identity.version, entry.version));
        if (matches.length !== 1)
        {
            diagnostics.push(errorDiagnostic("invalid-activation-reference", directory,
                `${kind} reference ${entry.pack_id}@${versionText(entry.version)} ` +
                "has no unique matching pack."));
        }
    }
    const enabled = packs.filter((item: InstalledPack) =>
        item.activation === "enabled" && item.kind === kind);
    for (const pack of enabled)
    {
        for (const dependency of pack.identity?.dependencies ?? [])
        {
            if (!dependency.uuid)
            {
                continue;
            }
            const versions = packs.filter((item: InstalledPack) => item.identity?.uuid === dependency.uuid);
            const matches = versions.length > 1 ? versions.filter((item: InstalledPack) =>
                sameVersion(item.identity!.version, dependency.version)) : versions;
            // Other pack kinds are marked before this routine's dependency pass by discoverInventory.
            if (matches.length === 1 && matches[0].activation !== "enabled")
            {
                diagnostics.push(errorDiagnostic("inactive-dependency", pack.location,
                    `Enabled pack requires inactive dependency ${dependency.uuid}.`));
            }
        }
    }
};

/** Discover shared and selected-world pack roots and reconcile registered membership. */
const discoverInventory = (context: RuntimeContext, options: InventoryOptions = {}) => Effect.gen(function*()
{
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const server = yield* resolveServer(context, options.server);
    const world = yield* resolveWorld(context, server, options.world);
    const registry = yield* readRegistry(server);
    const diagnostics: Array<Diagnostic> = [];
    const packs: Array<InstalledPack> = [];
    for (const scope of [ "shared", "world" ] as const)
    {
        for (const kind of [ "behavior", "resource" ] as const)
        {
            const prefix = scope === "shared" ? "" : `worlds/${world.name}/`;
            const relativeRoot = `${prefix}${kind}_packs`;
            const root = path.join(server, ...relativeRoot.split("/"));
            if (!(yield* fs.exists(root)))
            {
                continue;
            }
            const checked = yield* Effect.result(Effect.gen(function*()
            {
                if (!(yield* contained(server, root)))
                {
                    return yield* Effect.fail(new Error("Pack root resolves outside the server."));
                }
                return yield* fs.readDirectory(root);
            }));
            if (checked._tag === "Failure")
            {
                diagnostics.push(errorDiagnostic("unreadable-pack-root", root, String(checked.failure)));
                continue;
            }
            for (const name of checked.success.sort())
            {
                const location = path.join(root, name);
                const info = yield* Effect.result(fs.stat(location));
                if (info._tag === "Failure")
                {
                    diagnostics.push(errorDiagnostic("unreadable-pack", location, String(info.failure)));
                }
                else if (info.success.type === "Directory")
                {
                    packs.push(yield* inspectPack(server, `${relativeRoot}/${name}`,
                        scope, kind, diagnostics));
                }
            }
        }
    }
    validatePacks(packs, diagnostics);
    const behavior = yield* activationFile(world.directory, "behavior", diagnostics);
    const resource = yield* activationFile(world.directory, "resource", diagnostics);
    // Mark both kinds before checking cross-kind dependencies.
    markActivation(packs, "behavior", behavior);
    markActivation(packs, "resource", resource);
    inspectActivation(packs, "behavior", behavior, world.directory, diagnostics);
    inspectActivation(packs, "resource", resource, world.directory, diagnostics);
    const addons: Array<Addon> = [];
    const claimed = new Set<InstalledPack>();
    const equalLocation = (left: string, right: string): boolean => path.sep === "\\"
        ? BedrockString.toLowerCase(left) === BedrockString.toLowerCase(right) : left === right;
    for (const bundle of registry.bundles)
    {
        const members: Array<InstalledPack> = [];
        let visible = false;
        for (const member of bundle.packs)
        {
            if (BedrockString.startsWith("worlds/")(member.location) &&
                !member.location.startsWith(`worlds/${world.name}/`))
            {
                continue;
            }
            visible = true;
            const pack = packs.find((item: InstalledPack) =>
                equalLocation(item.relativeLocation, member.location));
            if (!pack)
            {
                diagnostics.push(errorDiagnostic("missing-registered-pack",
                    path.join(server, member.location),
                    `Bundle ${bundle.id} is missing registered pack ${member.uuid}.`));
                continue;
            }
            claimed.add(pack);
            members.push(pack);
            if (pack.identity?.uuid !== member.uuid)
            {
                diagnostics.push(errorDiagnostic("registry-identity-mismatch", pack.location,
                    `Bundle ${bundle.id} records UUID ${member.uuid}; ` +
                    "installed manifest differs or is invalid."));
            }
        }
        if (visible)
        {
            addons.push({ id: bundle.id, members, name: bundle.name, registered: true,
                registeredMembers: bundle.packs, source: bundle.source });
        }
    }
    for (const pack of packs)
    {
        if (claimed.has(pack))
        {
            continue;
        }
        addons.push({
            id: `unregistered:${pack.relativeLocation}`, members: [ pack ],
            name: pack.identity?.name ?? path.basename(pack.location), registered: false,
            registeredMembers: [], source: null
        });
    }
    return { addons, diagnostics, server, world } as Inventory;
});

const scopedAddons = (inventory: Inventory, scope?: Scope): Array<Addon> => scope === undefined
    ? inventory.addons : inventory.addons.filter((addon: Addon) => addon.members.some(
        (pack: InstalledPack) => pack.scope === scope) || addon.registeredMembers.some(
        (member: RegistryBundle["packs"][number]) => scope === "world"
            ? member.location.startsWith(`worlds/${inventory.world.name}/`)
            : !BedrockString.startsWith("worlds/")(member.location)));

/** Every selector form shares ambiguity detection, including names that collide with IDs. */
const selectAddon = (inventory: Inventory, selector: string, scope?: Scope) => Effect.gen(function*()
{
    const matches = scopedAddons(inventory, scope).filter((addon: Addon) => addon.id === selector ||
        addon.name === selector || addon.members.some((pack: InstalledPack) =>
        pack.identity?.uuid === BedrockString.toLowerCase(selector) || pack.identity?.name === selector) ||
        addon.registeredMembers.some(
            (member: RegistryBundle["packs"][number]) => member.uuid === BedrockString.toLowerCase(selector)));
    if (matches.length === 1)
    {
        return matches[0];
    }
    return yield* Effect.fail(new Error(matches.length
        ? `Ambiguous addon "${selector}". Candidates: ${matches.map((addon: Addon) =>
            `${addon.id} (${addon.name})`).join(", ")}`
        : `No addon matches "${selector}". Use bds addon list to inspect installed IDs and names.`));
});

export { discoverInventory, scopedAddons, selectAddon };
