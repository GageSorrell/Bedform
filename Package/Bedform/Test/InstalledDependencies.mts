/**
 * Detached installed dependency inputs for offline packed-consumer tests.
 *
 * @module bedform/Test/InstalledDependencies
 *
 * @file      InstalledDependencies.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Dependency snapshots retain manifest field order and contextual callbacks. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { basename, dirname, join } from "node:path";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

/**
 * Copies the installed runtime dependency graph without workspace links or registry resolution.
 * npm still installs the tested package tarballs and validates their dependency declarations.
 * Conflicting versions retain private node_modules directories. Peer resolution is left to
 * the consumer's explicit tarballs and its legacy-peer-deps install policy.
 *
 * @throws { Error } A required installed dependency is missing.
 *
 * @category Tests
 * @since 1.0.0
 */
export const snapshotDependencies = async (manifests: ReadonlyArray<string>, destination: string,
    npm: string): Promise<void> =>
{
    const Versions = new Map<string, string>();
    const Visited = new Set<string>();
    const Sources = new Map<string, string>();
    const Root = join(destination, "node_modules");

    const Visit = (manifest: string, owner: string): void =>
    {
        const Package = JSON.parse(readFileSync(manifest, "utf8"));
        const Resolve = createRequire(manifest);
        const Required = Package.dependencies ?? {};
        const Optional = Package.optionalDependencies ?? {};
        for (const Name of new Set([ ...Object.keys(Required), ...Object.keys(Optional) ]))
        {
            const Found = Resolve.resolve.paths(`${Name}/`)?.map((path) => join(path, Name, "package.json"))
                .find((path) => existsSync(path));
            if (!Found)
            {
                if (Object.hasOwn(Package.optionalDependencies ?? {}, Name) || !Object.hasOwn(Required, Name))
                {
                    continue;
                }

                throw new Error(`Missing installed dependency ${Name} from ${manifest}`);
            }

            const SourceManifest = realpathSync(Found);
            const Dependency = JSON.parse(readFileSync(SourceManifest, "utf8"));
            const Existing = Versions.get(Name);
            const Target = Existing === undefined || Existing === Dependency.version ? join(Root, Name) :
                join(owner, "node_modules", Name);
            if (Existing === undefined)
            {
                Versions.set(Name, Dependency.version);
            }

            if (Visited.has(Target))
            {
                continue;
            }

            Visited.add(Target);
            Sources.set(Target, dirname(SourceManifest));
            mkdirSync(Target, { recursive: true });
            cpSync(dirname(SourceManifest), Target, { recursive: true,
                dereference: true,
                filter: (path) => basename(path) !== "node_modules" && basename(path) !== ".git" });
            Visit(SourceManifest, Target);
        }
    };

    for (const Manifest of manifests)
    {
        Visit(Manifest, destination);
    }

    // Pin the fixture's provisioned inputs, then let the same npm implementation used by
    // the install serialize its actual tree. npm 12 no longer exposes `npm shrinkwrap`.
    const Manifest = join(destination, "package.json");
    const Package = JSON.parse(readFileSync(Manifest, "utf8"));
    writeFileSync(Manifest, JSON.stringify({ ...Package,
        dependencies: Object.fromEntries(Versions) }));
    const Arborist = createRequire(npm)("@npmcli/arborist");
    const Pacote = createRequire(npm)("pacote");
    const Tree = await new Arborist({ path: destination }).loadActual();
    const Archives = join(destination, "dependency-tarballs");
    mkdirSync(Archives);
    const Packed = new Map<string, string>();
    for (const Node of Tree.inventory.values())
    {
        if (Node.isRoot)
        {
            continue;
        }

        const Source = Sources.get(Node.path);
        if (!Source)
        {
            throw new Error(`Dependency snapshot has no source for ${Node.path}`);
        }

        let Archive = Packed.get(Source);
        if (!Archive)
        {
            Archive = join(Archives, `${Packed.size}.tgz`);
            await Pacote.tarball.file(Node.path, Archive, { Arborist,
                ignoreScripts: true });
            Packed.set(Source, Archive);
        }

        Node.resolved = pathToFileURL(Archive).href;
    }

    await Tree.meta.save();
};
