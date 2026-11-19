/**
 * Cross-world update/removal, adoption, dependency and rollback fixtures.
 *
 * @module bedrock-server-manager/Test/lifecycle.test
 *
 * @file      lifecycle.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path, PlatformError } from "effect";
import { type InstallOptions, installAddon } from "../Distribution/install.js";
import { removeAddon, updateAddon } from "../Distribution/lifecycle.js";
import type { InventoryOptions } from "../Distribution/inventory.js";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import type { UpdateOptions } from "../Distribution/lifecycle.js";
import assert from "node:assert/strict";
import { changeActivation } from "../Distribution/activation.js";
import { readRegistry } from "../Distribution/registry.js";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { withTransaction } from "../Distribution/transaction.js";
import { Option } from "effect";

const id: (number: number) => string = (number: number) =>
    `66666666-6666-6666-6666-${number.toString(16).padStart(12, "0")}`;
type Dependency =
    | { uuid: string;
        version: Array<number> }
    | { module_name: string;
        version: string };
const manifest: (
    number: number,
    revision?: number,
    kind?: string,
    dependencies?: Array<Dependency>
) => {
    dependencies: Array<Dependency>;
    format_version: number;
    header: {
        description: string;
        min_engine_version: Array<number>;
        name: string;
        uuid: string;
        version: Array<number>;
    };
    modules: Array<{ type: string;
        uuid: string;
        version: Array<number> }>;
    unknown: { preserved: boolean };
} = (
    number: number,
    revision: number = 1,
    kind: string = "data",
    dependencies: Array<Dependency> = []
) => ({
    dependencies,
    format_version: 2,
    header: {
        description: "Fixture",
        min_engine_version: [ 1, 21, 0 ],
        name: `Pack ${number}`,
        uuid: id(number),
        version: [ revision, 0, 0 ]
    },
    modules: [ { type: kind,
        uuid: id(number + 1000),
        version: [ revision, 0, 0 ] } ],
    unknown: { preserved: true }
});
const active: (
    number: number,
    revision?: number
) => { pack_id: string;
    version: Array<number> } = (number: number, revision: number = 1) => ({
    pack_id: id(number),
    version: [ revision, 0, 0 ]
});
const dependency: (
    number: number,
    revision?: number
) => { uuid: string;
    version: Array<number> } = (number: number, revision: number = 1) => ({
    uuid: id(number),
    version: [ revision, 0, 0 ]
});
const failure: (
    effect: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) => Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> = (
    effect: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) =>
    Effect.gen(function* ()
    {
        const result = yield* Effect.result(effect);
        assert.equal(result._tag, "Failure");
        assert.match(String(result.failure), pattern);
    });
type LifecycleFixture = {
    readonly change: (
        selector: string,
        enable: boolean,
        world?: string
    ) => ReturnType<typeof changeActivation>;
    readonly context: RuntimeContext;
    readonly entries: (
        world: string,
        kind?: string
    ) => Effect.Effect<Array<unknown>, unknown, never>;
    readonly fs: FileSystem.FileSystem;
    readonly install: (
        source: string,
        enable?: boolean,
        options?: Partial<InstallOptions>
    ) => ReturnType<typeof installAddon>;
    readonly path: Path.Path;
    readonly remove: (
        selector: string,
        options?: Partial<InventoryOptions>
    ) => ReturnType<typeof removeAddon>;
    readonly root: string;
    readonly server: string;
    readonly snapshot: () => Effect.Effect<Record<string, Array<number>>, unknown, never>;
    readonly update: (
        selector: string,
        options?: Partial<UpdateOptions>
    ) => ReturnType<typeof updateAddon>;
    readonly write: (
        relative: string,
        value: unknown
    ) => Effect.Effect<string, unknown, never>;
};
const fixture: (
    body: (
        context: LifecycleFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: LifecycleFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-lifecycle-"
                });
                const server: string = path.join(root, "server");
                for (const world of [ "A", "B", "C" ])
                {
                    yield* fs.makeDirectory(path.join(server, "worlds", world), {
                        recursive: true
                    });
                }

                yield* fs.writeFileString(
                    path.join(server, "server.properties"),
                    "level-name=A\n"
                );
                const context: {
                    cwd: string;
                    env: { BDS_CONFIG_PATH: string };
                    home: string;
                    platform: NodeJS.Platform;
                } = {
                    cwd: root,
                    env: { BDS_CONFIG_PATH: path.join(root, "config.json") },
                    home: root,
                    platform: process.platform
                };
                const write: (
                    relative: string,
                    value: unknown
                ) => Effect.Effect<string, PlatformError.PlatformError, never> = (
                    relative: string,
                    value: unknown
                ) =>
                    Effect.gen(function* ()
                    {
                        const file: string = path.join(root, ...relative.split("/"));
                        yield* fs.makeDirectory(path.dirname(file), {
                            recursive: true
                        });
                        yield* fs.writeFileString(
                            file,
                            typeof value === "string" ? value : JSON.stringify(value)
                        );
                        return file;
                    });
                const entries = (world: string, kind: string = "behavior") =>
                    Effect.gen(function* ()
                    {
                        const file: string = path.join(
                            server,
                            "worlds",
                            world,
                            `world_${kind}_packs.json`
                        );
                        return (yield* fs.exists(file))
                            ? JSON.parse(yield* fs.readFileString(file))
                            : [];
                    });
                const install = (source: string, enable: boolean = true, options: {} = {}) =>
                    installAddon(context, source, {
                        enable,
                        server,
                        ...options
                    });
                const update: (
                    selector: string,
                    options?: Partial<UpdateOptions>
                ) => Effect.Effect<
                    {
                        id: string;
                        name: string;
                        requirements: Array<string>;
                        worlds: Array<string>;
                    },
                    unknown,
                    FileSystem.FileSystem | Path.Path
                > = (selector: string, options: Partial<UpdateOptions> = {}) =>
                    updateAddon(context, selector, { server,
                        ...options });
                const remove: (
                    selector: string,
                    options?: {}
                ) => Effect.Effect<
                    {
                        id: string;
                        name: string;
                        requirements: Array<string>;
                        worlds: Array<string>;
                    },
                    unknown,
                    FileSystem.FileSystem | Path.Path
                > = (selector: string, options: {} = {}) =>
                    removeAddon(context, selector, { server,
                        ...options });
                const change: (
                    selector: string,
                    enable: boolean,
                    world?: string
                ) => Effect.Effect<
                    { id: string;
                        name: string;
                        requirements: Array<string> },
                    unknown,
                    FileSystem.FileSystem | Path.Path
                > = (selector: string, enable: boolean, world: string = "A") =>
                    changeActivation(context, selector, { server,
                        world }, enable);
                const snapshot: () => Effect.Effect<
                    Record<string, Array<number>>,
                    PlatformError.PlatformError,
                    never
                > = () =>
                    Effect.gen(function* ()
                    {
                        const output: Record<string, Array<number>> = {};
                        const pending: Array<string> = [ "" ];
                        while (pending.length)
                        {
                            const relative: Option.Option<string> = Option.fromUndefinedOr(pending.pop());
                            if (Option.isNone(relative))
                            {
                                continue;
                            }

                            for (const name of (yield* fs.readDirectory(
                                path.join(server, relative.value)
                            )).sort())
                            {
                                const next: string = path.join(relative.value, name);
                                const file: string = path.join(server, next);
                                if ((yield* fs.stat(file)).type === "Directory")
                                {
                                    pending.push(next);
                                }
                                else
                                {
                                    output[next] = [ ...(yield* fs.readFile(file)) ];
                                }
                            }
                        }

                        return output;
                    });
                yield* body({
                    change,
                    context,
                    entries,
                    fs,
                    install,
                    path,
                    remove,
                    root,
                    server,
                    snapshot,
                    update,
                    write
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("remembered-source updates refresh enabled worlds and preserve entry fields", () =>
    fixture(({ change, entries, fs, install, path, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* change(bundle.id, true, "B");
            yield* write("unrelated/manifest.json", manifest(99));
            yield* install("unrelated", false);
            const original: Array<
                | { extra: string;
                    pack_id: string;
                    version: Array<number> }
                | {
                    custom: { unchanged: boolean };
                    pack_id: string;
                    version: Array<number>;
                }
            > = [
                { ...active(99),
                    extra: "keep" },
                { ...active(1),
                    custom: { unchanged: true } }
            ];
            yield* write("server/worlds/A/world_behavior_packs.json", original);
            const disabled = " [ ] \n";
            const disabledFile: string = yield* write(
                "server/worlds/C/world_behavior_packs.json",
                disabled
            );
            yield* write("source/manifest.json", manifest(1, 2));
            yield* write("source/new.txt", "new bytes");
            assert.equal((yield* update(bundle.id)).id, bundle.id);
            assert.deepEqual(yield* entries("A"), [
                original[0],
                { ...original[1],
                    version: [ 2, 0, 0 ] }
            ]);
            assert.deepEqual(yield* entries("B"), [ active(1, 2) ]);
            assert.equal(yield* fs.readFileString(disabledFile), disabled);
            const registered = (yield* readRegistry(server)).bundles.find(
                (entry) => entry.id === bundle.id
            );
            assert.equal(registered?.id, bundle.id);
            assert.equal(
                yield* fs.readFileString(
                    path.join(server, "behavior_packs", id(1), "new.txt")
                ),
                "new bytes"
            );
        })
    ));

test("replacement sources change membership and retain bundle ID and world activation", () =>
    fixture(({ change, entries, fs, install, path, root, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("old/b/manifest.json", manifest(1));
            yield* write("old/b/obsolete.txt", "remove this");
            yield* write("old/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("old");
            yield* change(bundle.id, true, "B");
            yield* write("replacement/b/manifest.json", manifest(1, 2));
            yield* write("replacement/r/manifest.json", manifest(3, 2, "resources"));
            yield* update(bundle.id, { source: "replacement" });
            const registered = (yield* readRegistry(server)).bundles[0];
            assert.equal(registered.id, bundle.id);
            assert.equal(registered.source, path.join(root, "replacement"));
            for (const world of [ "A", "B" ])
            {
                assert.deepEqual(yield* entries(world), [ active(1, 2) ]);
                assert.deepEqual(yield* entries(world, "resource"), [ active(3, 2) ]);
            }

            assert.deepEqual(yield* entries("C"), []);
            assert.equal(yield* fs.exists(path.join(server, "resource_packs", id(2))), false);
            assert.equal(
                yield* fs.exists(path.join(server, "behavior_packs", id(1), "obsolete.txt")),
                false
            );
            yield* write("replacement/r/manifest.json", manifest(3, 3, "resources"));
            yield* update(bundle.id);
            assert.deepEqual(yield* entries("B", "resource"), [ active(3, 3) ]);
        })
    ));

test("partial activation remains partial and new members inherit the bundle's enabled state", () =>
    fixture(({ entries, install, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("old/b/manifest.json", manifest(1));
            yield* write("old/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("old", false);
            yield* write("server/worlds/A/world_behavior_packs.json", [ active(1) ]);
            yield* write("new/b/manifest.json", manifest(1, 2));
            yield* write("new/r/manifest.json", manifest(2, 2, "resources"));
            yield* write("new/additional/manifest.json", manifest(3));
            yield* update(bundle.id, { source: "new" });
            assert.deepEqual(yield* entries("A"), [ active(1, 2), active(3) ]);
            assert.deepEqual(yield* entries("A", "resource"), []);
            assert.deepEqual(yield* entries("B"), []);
        })
    ));

test("manifest kind changes move references without losing their extra fields", () =>
    fixture(({ entries, fs, install, path, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* write("server/worlds/A/world_behavior_packs.json", [
                { ...active(1),
                    extra: "keep" }
            ]);
            yield* write("source/manifest.json", manifest(1, 2, "resources"));
            yield* update(bundle.id);
            assert.deepEqual(yield* entries("A"), []);
            assert.deepEqual(yield* entries("A", "resource"), [
                { ...active(1, 2),
                    extra: "keep" }
            ]);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(1))), false);
            assert.equal(yield* fs.exists(path.join(server, "resource_packs", id(1))), true);
        })
    ));

test("an enabled bundle stays enabled if all previously enabled members are removed", () =>
    fixture(({ entries, install, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("old/b/manifest.json", manifest(1));
            yield* write("old/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("old", false);
            yield* write("server/worlds/A/world_behavior_packs.json", [ active(1) ]);
            yield* write(
                "new/manifest.json",
                manifest(2, 2, "resources", [
                    { module_name: "@minecraft/server",
                        version: "2.0.0" }
                ])
            );
            const result: {
                id: string;
                name: string;
                requirements: Array<string>;
                worlds: Array<string>;
            } = yield* update(bundle.id, { source: "new" });
            assert.deepEqual(yield* entries("A"), []);
            assert.deepEqual(yield* entries("A", "resource"), [ active(2, 2) ]);
            assert.deepEqual(yield* entries("B", "resource"), []);
            assert.deepEqual(result.requirements, [ "@minecraft/server@2.0.0" ]);
        })
    ));

test("standalone packs require explicit source and are adopted with the same printed ID", () =>
    fixture(({ entries, fs, path, remove, root, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("server/behavior_packs/existing/manifest.json", manifest(7));
            yield* write("server/worlds/A/world_behavior_packs.json", [ active(7) ]);
            const selector = "unregistered:behavior_packs/existing";
            yield* failure(update(id(7)), /--source/);
            yield* write("source/manifest.json", manifest(7, 2));
            const result: {
                id: string;
                name: string;
                requirements: Array<string>;
                worlds: Array<string>;
            } = yield* update(id(7), { source: "source" });
            assert.equal(result.id, selector);
            const registry = yield* readRegistry(server);
            assert.equal(registry.bundles[0].id, selector);
            assert.equal(registry.bundles[0].source, path.join(root, "source"));
            assert.deepEqual(yield* entries("A"), [ active(7, 2) ]);
            yield* remove(selector);
            assert.equal(
                yield* fs.exists(path.join(server, "behavior_packs", "existing")),
                false
            );
        })
    ));

test("missing remembered sources and conflicting UUID owners leave state unchanged", () =>
    fixture(({ fs, install, path, root, snapshot, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* fs.remove(path.join(root, "source"), { recursive: true });
            const before: Record<string, Array<number>> = yield* snapshot();
            yield* failure(update(bundle.id), /--source/);
            assert.deepEqual(yield* snapshot(), before);
            yield* write("other/manifest.json", manifest(9));
            yield* install("other", false);
            const occupied: Record<string, Array<number>> = yield* snapshot();
            yield* failure(
                update(bundle.id, { source: "other" }),
                /Conflicting UUID ownership/
            );
            assert.deepEqual(yield* snapshot(), occupied);
        })
    ));

test("a new standalone pack cannot steal an adopted bundle's retained ID", () =>
    fixture(({ fs, path, remove, server, snapshot, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("server/behavior_packs/existing/manifest.json", manifest(1));
            yield* write("replacement/manifest.json", manifest(2));
            yield* update(id(1), { source: "replacement" });
            yield* write("server/behavior_packs/existing/manifest.json", manifest(3));
            yield* write("new/manifest.json", manifest(3, 2));
            const before: Record<string, Array<number>> = yield* snapshot();
            yield* failure(remove(id(3)), /Conflicting bundle ID/);
            yield* failure(update(id(3), { source: "new" }), /Conflicting bundle ID/);
            assert.deepEqual(yield* snapshot(), before);
            yield* remove(id(2));
            assert.equal(
                yield* fs.exists(path.join(server, "behavior_packs", "existing")),
                true
            );
            assert.deepEqual((yield* readRegistry(server)).bundles, []);
        })
    ));

test("malformed activation in another world prevents every shared update/removal write", () =>
    fixture(({ install, remove, snapshot, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* write("server/worlds/B/world_resource_packs.json", "{broken");
            yield* write("source/manifest.json", manifest(1, 2));
            const before: Record<string, Array<number>> = yield* snapshot();
            yield* failure(update(bundle.id), /Invalid activation file/);
            yield* failure(remove(bundle.id), /Invalid activation file/);
            assert.deepEqual(yield* snapshot(), before);
        })
    ));

test("enabled dependents in other worlds block incompatible updates and removal", () =>
    fixture(({ change, entries, install, remove, snapshot, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const target = yield* install("source", false);
            yield* write("dependent/manifest.json", manifest(9, 1, "data", [ dependency(1) ]));
            const dependent = yield* install("dependent", false);
            yield* change(dependent.id, true, "B");
            yield* write("source/manifest.json", manifest(1, 2));
            const before: Record<string, Array<number>> = yield* snapshot();
            yield* failure(update(target.id), /break enabled dependency.*world B/);
            yield* failure(remove(target.id), /Cannot remove in world B/);
            assert.deepEqual(yield* snapshot(), before);
            yield* change(dependent.id, false, "B");
            yield* update(target.id);
            assert.deepEqual(yield* entries("B"), [ active(1, 2) ]);
            yield* remove(target.id);
            assert.deepEqual(yield* entries("B"), []);
        })
    ));

test("local updates/removal affect only the owner world, even if another world is malformed", () =>
    fixture(({ entries, fs, install, path, remove, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source", true, { scope: "world" });
            const other: string = yield* write(
                "server/worlds/B/world_behavior_packs.json",
                "{broken"
            );
            yield* write("source/manifest.json", manifest(1, 2));
            yield* update(bundle.id);
            assert.deepEqual(yield* entries("A"), [ active(1, 2) ]);
            assert.equal(yield* fs.readFileString(other), "{broken");
            yield* remove(bundle.id);
            assert.deepEqual(yield* entries("A"), []);
            assert.equal(yield* fs.readFileString(other), "{broken");
            assert.equal(
                yield* fs.exists(path.join(server, "worlds", "A", "behavior_packs", id(1))),
                false
            );
        })
    ));

test("paired removal disables every world and preserves dependency packs and unrelated fields", () =>
    fixture(({ change, entries, fs, install, path, remove, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("dependency/manifest.json", manifest(99));
            yield* install("dependency", false);
            yield* write("paired/b/manifest.json", manifest(1, 1, "data", [ dependency(99) ]));
            yield* write("paired/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("paired");
            yield* change(bundle.id, true, "B");
            const unrelated: {
                keep: string;
                pack_id: string;
                version: Array<number>;
            } = { ...active(99),
                keep: "field" };
            yield* write("server/worlds/A/world_behavior_packs.json", [ unrelated, active(1) ]);
            yield* remove(bundle.id);
            assert.deepEqual(yield* entries("A"), [ unrelated ]);
            assert.deepEqual(yield* entries("B"), [ active(99) ]);
            assert.deepEqual(yield* entries("A", "resource"), []);
            assert.deepEqual(yield* entries("B", "resource"), []);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(1))), false);
            assert.equal(yield* fs.exists(path.join(server, "resource_packs", id(2))), false);
            assert.equal((yield* readRegistry(server)).bundles.length, 1);
        })
    ));

test("late update failures restore old directories, removed members, JSON and all worlds", () =>
    fixture(({ change, fs, install, path, server, snapshot, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("old/b/manifest.json", manifest(1));
            yield* write("old/b/original.bin", "old pack bytes");
            yield* write("old/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("old");
            yield* change(bundle.id, true, "B");
            yield* write("new/b/manifest.json", manifest(1, 2));
            yield* write("new/r/manifest.json", manifest(3, 2, "resources"));
            const before: Record<string, Array<number>> = yield* snapshot();
            for (const mode of [ "pack", "world" ])
            {
                let failed: boolean = false;
                const injected: FileSystem.FileSystem = {
                    ...fs,
                    rename: (from: string, to: string) =>
                    {
                        const trigger: boolean =
                            mode === "world"
                                ? to ===
                                  path.join(server, "worlds", "B", "world_resource_packs.json")
                                : path.basename(from) === "updated-pack-0";
                        if (trigger && !failed)
                        {
                            failed = true;
                            return Effect.fail(
                                PlatformError.badArgument({
                                    description: "injected update failure",
                                    method: "rename",
                                    module: "FileSystem"
                                })
                            );
                        }

                        return fs.rename(from, to);
                    }
                };
                yield* failure(
                    update(bundle.id, { source: "new" }).pipe(
                        Effect.provideService(FileSystem.FileSystem, injected)
                    ),
                    /injected update failure/
                );
                assert.deepEqual(yield* snapshot(), before);
            }

            yield* update(bundle.id, { source: "new" });
        })
    ));

test("late removal failure restores deleted directories and world files", () =>
    fixture(({ change, fs, install, path, remove, server, snapshot, write }) =>
        Effect.gen(function* ()
        {
            yield* write("paired/b/manifest.json", manifest(1));
            yield* write("paired/r/manifest.json", manifest(2, 1, "resources"));
            const bundle = yield* install("paired");
            yield* change(bundle.id, true, "B");
            const before: Record<string, Array<number>> = yield* snapshot();
            let failed: boolean = false;
            const injected: FileSystem.FileSystem = {
                ...fs,
                rename: (from: string, to: string) =>
                {
                    if (
                        !failed &&
                        to === path.join(server, "worlds", "B", "world_resource_packs.json")
                    )
                    {
                        failed = true;
                        return Effect.fail(
                            PlatformError.badArgument({
                                description: "injected remove failure",
                                method: "rename",
                                module: "FileSystem"
                            })
                        );
                    }

                    return fs.rename(from, to);
                }
            };
            yield* failure(
                remove(bundle.id).pipe(Effect.provideService(FileSystem.FileSystem, injected)),
                /injected remove failure/
            );
            assert.deepEqual(yield* snapshot(), before);
            yield* remove(bundle.id);
        })
    ));

test("shared packs can be updated/removed before any world exists", () =>
    fixture(({ context, fs, path, root, write }) =>
        Effect.gen(function* ()
        {
            const server: string = path.join(root, "worldless");
            yield* fs.makeDirectory(server);
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* installAddon(context, "source", {
                enable: false,
                server
            });
            yield* write("source/manifest.json", manifest(1, 2));
            yield* updateAddon(context, bundle.id, { server });
            yield* removeAddon(context, bundle.id, { server });
            assert.equal(yield* fs.exists(path.join(server, "worlds")), false);
            assert.deepEqual((yield* readRegistry(server)).bundles, []);
        })
    ));

test("update/remove participate in the same server lock", () =>
    fixture(({ install, remove, server, update, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* withTransaction(server, () =>
                Effect.gen(function* ()
                {
                    yield* failure(update(bundle.id), /mutation lock/);
                    yield* failure(remove(bundle.id), /mutation lock/);
                })
            );
        })
    ));

test("CLI remembered/explicit source updates, rm alias and failure exit codes", () =>
    fixture(({ context, entries, install, path, root, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            const entry: string = yield* path.fromFileUrl(
                new URL("../Distribution/index.js", import.meta.url)
            );
            const run: (...args: Array<string>) => {
                code: number | null;
                text: string;
            } = (...args: Array<string>) =>
            {
                const result = spawnSync(
                    process.execPath,
                    [ entry, "addon", ...args, "-s", "server" ],
                    {
                        cwd: root,
                        encoding: "utf8",
                        env: { ...process.env,
                            ...context.env },
                        timeout: 60000
                    }
                );
                assert.equal(result.error, undefined);
                return {
                    code: result.status,
                    text: result.stdout + result.stderr
                };
            };

            yield* write("source/manifest.json", manifest(1, 2));
            const remembered: { code: number | null;
                text: string } = run("update", bundle.id);
            assert.equal(remembered.code, 0, remembered.text);
            assert.match(remembered.text, /Updated Pack 1/);
            yield* write("new/manifest.json", manifest(1, 3));
            const replaced: { code: number | null;
                text: string } = run(
                "update",
                bundle.id,
                "--source",
                "new"
            );
            assert.equal(replaced.code, 0, replaced.text);
            assert.deepEqual(yield* entries("A"), [ active(1, 3) ]);
            const removed: { code: number | null;
                text: string } = run("rm", id(1));
            assert.equal(removed.code, 0, removed.text);
            assert.match(removed.text, /Removed Pack 1/);
            assert.deepEqual(yield* entries("A"), []);
            assert.notEqual(run("remove", id(1)).code, 0);
        })
    ));
