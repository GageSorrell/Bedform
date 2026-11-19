/**
 * Stage all source packs and commit their registry membership as one transaction.
 *
 * @module bedrock-server-manager/install
 *
 * @file      install.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path } from "effect";
import type { RegistryBundle, RegistryMember } from "./registry.js";
import type { Replacement, Transaction } from "./transaction.js";
import { parseRegistry, readRegistry } from "./registry.js";
import { resolveServer, resolveWorld } from "./server.js";
import type { Dependency } from "./manifest.js";
import type { ExistingPack } from "./installed.js";
import type { RuntimeContext } from "./config.js";
import type { Scope } from "./inventory.js";
import type { SourcePack } from "./source.js";
import { ingestSource } from "./source.js";
import { mutationPath } from "./safety.js";
import { planActivation } from "./activation.js";
import { randomUUID } from "node:crypto";
import { scanInstalled } from "./installed.js";
import { versionText } from "./manifest.js";
import { withTransaction } from "./transaction.js";

/** Installation selection, including optional activation in an existing world. */
export interface InstallOptions
{
    readonly server?: string;
    readonly world?: string;
    readonly scope?: Scope;
    readonly enable: boolean;
}

const installAddon = (context: RuntimeContext, source: string, options: InstallOptions) =>
    Effect.gen(function*()
    {
        const server = yield* resolveServer(context, options.server);
        const scope = options.scope ?? "shared";
        const world = scope === "world" || options.world !== undefined || options.enable
            ? yield* resolveWorld(context, server, options.world) : null;
        const bundle = yield* ingestSource(context, source);
        return yield* withTransaction(server, (transaction: Transaction) => Effect.gen(function*()
        {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const registryFile = path.join(server, ".bedrock-server-manager", "registry.json");
            yield* mutationPath(server, registryFile);
            const registry = yield* readRegistry(server);
            const existing = yield* scanInstalled(server);
            const reserved = new Set(registry.bundles.flatMap((entry: RegistryBundle) =>
                entry.packs.map((member: RegistryMember) => member.uuid)));
            for (const pack of existing)
            {
                for (const id of [ pack.manifest.uuid, ...pack.manifest.moduleUuids ]) { reserved.add(id); }
            }
            const installed: RegistryBundle = {
                id: randomUUID(), name: bundle.name, packs: [], source: bundle.source
            };
            const changes: Array<Replacement> = [];
            for (let index = 0; index < bundle.packs.length; index++)
            {
                const pack = bundle.packs[index];
                for (const id of [ pack.manifest.uuid, ...pack.manifest.moduleUuids ])
                {
                    if (reserved.has(id))
                    {
                        return yield* Effect.fail(new Error(`Conflicting installed/registered UUID: ${id}`));
                    }
                    reserved.add(id);
                }
                const relative = (scope === "world" ? `worlds/${world!.name}/` : "") +
                `${pack.manifest.kind}_packs/${pack.manifest.uuid}`;
                const destination = path.join(server, ...relative.split("/"));
                yield* mutationPath(server, destination);
                const staged = path.join(transaction.stage, `pack-${index}`);
                yield* fs.makeDirectory(staged);
                for (const [ name, bytes ] of pack.files)
                {
                    const file = path.join(staged, ...name.split("/"));
                    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
                    yield* fs.writeFile(file, bytes, { flag: "wx" });
                }
                installed.packs.push({ location: relative, uuid: pack.manifest.uuid });
                changes.push({ destination, mustBeAbsent: true, staged });
            }
            const updated = yield* parseRegistry({ bundles: [ ...registry.bundles, installed ], version: 1 });
            const staged = path.join(transaction.stage, "registry.new.json");
            yield* fs.writeFileString(staged, `${JSON.stringify(updated, null, 2)}\n`);
            changes.push({ destination: registryFile, staged });
            let requirements: Array<string> = bundle.packs.flatMap((pack: SourcePack) =>
                pack.manifest.dependencies
                    .filter((dependency: Dependency) => dependency.module_name)
                    .map((dependency: Dependency) =>
                        `${dependency.module_name}@${versionText(dependency.version)}`));
            if (options.enable)
            {
                const selected: Array<ExistingPack> = existing.filter((pack: ExistingPack) =>
                    pack.world === null || pack.world === world!.name);
                for (let index = 0; index < bundle.packs.length; index++)
                {
                    selected.push({
                        location: path.join(server, ...installed.packs[index].location.split("/")),
                        manifest: bundle.packs[index].manifest, world: scope === "world" ? world!.name : null
                    });
                }
                const activation = yield* planActivation(transaction, world!.directory, selected,
                    bundle.packs.map((pack: SourcePack) => pack.manifest.uuid), true);
                changes.push(...activation.changes);
                requirements = activation.requirements;
            }
            yield* transaction.commit(changes);
            return { ...installed, requirements };
        }));
    });

export { installAddon };
