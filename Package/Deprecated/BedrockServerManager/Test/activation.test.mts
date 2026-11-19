/**
 * Default installation activation, dependency protection and rollback fixtures.
 *
 * @module bedrock-server-manager/Test/activation.test
 *
 * @file      activation.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as NodeChildProcessTypes from "node:child_process";
import type * as RegistryTypes from "../Distribution/registry.js";
import type * as ResultTypes from "effect/Result";
import { Effect, FileSystem, Path, PlatformError } from "effect";
import { type InstallOptions, installAddon } from "../Distribution/install.js";
import type { InventoryOptions } from "../Distribution/inventory.js";
import { NodeServices } from "@effect/platform-node";
import type { Scope } from "effect";
import assert from "node:assert/strict";
import { changeActivation } from "../Distribution/activation.js";
import { spawnSync } from "node:child_process";
import test from "node:test";

const id: (number: number) => string = (number: number) =>
    `33333333-3333-3333-3333-${number.toString(16).padStart(12, "0")}`;
type Dependency =
    | { uuid: string;
        version: Array<number> }
    | { module_name: string;
        version: string };
const manifest: (
    number: number,
    type?: string,
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
} = (number: number, type: string = "data", dependencies: Array<Dependency> = []) => ({
    dependencies,
    format_version: 2,
    header: {
        description: "Fixture",
        min_engine_version: [ 1, 21, 0 ],
        name: `Pack ${number}`,
        uuid: id(number),
        version: [ 1, 0, 0 ]
    },
    modules: [ { type,
        uuid: id(number + 1000),
        version: [ 1, 0, 0 ] } ]
});
const dependency: (
    number: number,
    version?: Array<number>
) => { uuid: string;
    version: Array<number> } = (
    number: number,
    version: Array<number> = [ 1, 0, 0 ]
) => ({ uuid: id(number),
    version });
const active: (number: number) => { pack_id: string;
    version: Array<number> } = (
    number: number
) => ({ pack_id: id(number),
    version: [ 1, 0, 0 ] });
const failure: (
    operation: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) => Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> = (
    operation: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) =>
    Effect.gen(function* ()
    {
        const result: ResultTypes.Result<unknown, unknown> = yield* Effect.result(operation);
        assert.equal(result._tag, "Failure");
        assert.match(String(result.failure), pattern);
    });
namespace ActivationFixture
{
    /**
     * Runtime context the fixture runs commands with.
     *
     * @category Testing
     * @since 1.0.0
     */
    export interface Context
{
        cwd: string;
        env: Record<string, string | undefined>;
        home: string;
        platform: string;
    }
}
type ActivationFixture = {
    readonly change: (
        selector: string,
        enable: boolean,
        options?: Partial<InventoryOptions>
    ) => ReturnType<typeof changeActivation>;
    readonly context: ActivationFixture.Context;
    readonly entries: (
        kind?: string
    ) => Effect.Effect<
        Array<{ pack_id: string;
            version: Array<number>;
            [key: string]: unknown }>,
        unknown,
        FileSystem.FileSystem
    >;
    readonly fs: FileSystem.FileSystem;
    readonly install: (
        source: string,
        enable?: boolean,
        options?: Partial<InstallOptions>
    ) => ReturnType<typeof installAddon>;
    readonly path: Path.Path;
    readonly root: string;
    readonly server: string;
    readonly world: string;
    readonly write: (
        relative: string,
        value: unknown
    ) => Effect.Effect<string, unknown, never>;
};
const fixture: (
    body: (
        context: ActivationFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: ActivationFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-activation-"
                });
                const server: string = path.join(root, "server");
                const world: string = path.join(server, "worlds", "Chosen");
                yield* fs.makeDirectory(world, { recursive: true });
                yield* fs.writeFileString(
                    path.join(server, "server.properties"),
                    "level-name=Chosen\n"
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
                        yield* fs.makeDirectory(path.dirname(file), { recursive: true });
                        yield* fs.writeFileString(
                            file,
                            typeof value === "string" ? value : JSON.stringify(value)
                        );
                        return file;
                    });
                const install: (
                    source: string,
                    enable?: boolean,
                    options?: {}
                ) => Effect.Effect<
                    {
                        requirements: Array<string>;
                        id: string;
                        name: string;
                        source: string | null;
                        packs: Array<RegistryTypes.RegistryMember>;
                    },
                    unknown,
                    FileSystem.FileSystem | Path.Path
                > = (source: string, enable: boolean = false, options: {} = {}) =>
                    installAddon(context, source, { enable,
                        server,
                        ...options });
                const change: (
                    selector: string,
                    enable: boolean,
                    options?: {}
                ) => Effect.Effect<
                    { id: string;
                        name: string;
                        requirements: Array<string> },
                    unknown,
                    FileSystem.FileSystem | Path.Path
                > = (selector: string, enable: boolean, options: {} = {}) =>
                    changeActivation(context, selector, { server,
                        ...options }, enable);
                const entries = (kind: string = "behavior") =>
                    fs
                        .readFileString(path.join(world, `world_${kind}_packs.json`))
                        .pipe(Effect.map(JSON.parse));
                yield* body({
                    change,
                    context,
                    entries,
                    fs,
                    install,
                    path,
                    root,
                    server,
                    world,
                    write
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("default activation accepts cyclic paired packs and preserves unrelated fields/order", () =>
    fixture(({ change, entries, fs, install, path, world, write }) =>
        Effect.gen(function* ()
        {
            yield* write("unrelated/manifest.json", manifest(99));
            yield* install("unrelated");
            const unrelated: {
                custom: { keep: boolean };
                pack_id: string;
                version: Array<number>;
            } = { ...active(99),
                custom: { keep: true } };
            yield* write("server/worlds/Chosen/world_behavior_packs.json", [ unrelated ]);
            yield* write(
                "paired/b/manifest.json",
                manifest(1, "data", [
                    dependency(2),
                    { module_name: "@minecraft/server",
                        version: "2.0.0-beta" }
                ])
            );
            yield* write("paired/r/manifest.json", manifest(2, "resources", [ dependency(1) ]));
            const installed: {
                requirements: Array<string>;
                id: string;
                name: string;
                source: string | null;
                packs: Array<RegistryTypes.RegistryMember>;
            } = yield* install("paired", true);
            assert.deepEqual(
                (yield* entries()).map(
                    (entry: {
                        [key: string]: unknown;
                        pack_id: string;
                        version: Array<number>;
                    }) => entry.pack_id
                ),
                [ id(99), id(1) ]
            );
            assert.deepEqual((yield* entries())[0], unrelated);
            assert.deepEqual(yield* entries("resource"), [ active(2) ]);
            assert.deepEqual(installed.requirements, [ "@minecraft/server@2.0.0-beta" ]);
            const file: string = path.join(world, "world_behavior_packs.json");
            const before: string = yield* fs.readFileString(file);
            yield* change(installed.id, true);
            assert.equal(yield* fs.readFileString(file), before);
            yield* change(installed.id, false);
            assert.deepEqual(yield* entries(), [ unrelated ]);
            assert.deepEqual(yield* entries("resource"), []);
            yield* change(installed.id, false);
            assert.deepEqual(yield* entries(), [ unrelated ]);
        })
    ));

test("recursive dependencies enable once; enabled dependents prevent disable", () =>
    fixture(({ change, entries, install, write }) =>
        Effect.gen(function* ()
        {
            const cases: Array<[number, string, Array<Dependency>]> = [
                [ 3, "data", [] ],
                [ 2, "resources", [ dependency(3) ] ],
                [ 1, "data", [ dependency(2) ] ]
            ];
            for (const [ number, type, dependencies ] of cases)
            {
                yield* write(
                    `source-${number}/manifest.json`,
                    manifest(number, type, dependencies)
                );
                yield* install(`source-${number}`);
            }

            yield* change(id(1), true);
            assert.deepEqual(
                (yield* entries()).map(
                    (entry: {
                        [key: string]: unknown;
                        pack_id: string;
                        version: Array<number>;
                    }) => entry.pack_id
                ),
                [ id(1), id(3) ]
            );
            assert.deepEqual(yield* entries("resource"), [ active(2) ]);
            yield* failure(change(id(3), false), /Cannot disable.*Pack 2/);
            yield* failure(change(id(2), false), /Cannot disable.*Pack 1/);
            yield* change(id(1), false);
            yield* change(id(2), false);
            yield* change(id(3), false);
            assert.deepEqual(yield* entries(), []);
        })
    ));

test("missing/mismatched dependencies prevent activation/install without partial files", () =>
    fixture(({ change, fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("missing/manifest.json", manifest(1, "data", [ dependency(2) ]));
            yield* failure(install("missing", true), /Missing\/mismatched dependency/);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs")), false);
            assert.deepEqual(
                yield* fs.readDirectory(path.join(server, ".bedrock-server-manager")),
                []
            );
            yield* install("missing");
            yield* write("wrong/manifest.json", manifest(2));
            yield* install("wrong");
            yield* change(id(1), true);
            yield* change(id(1), false);
            yield* write(
                "mismatch/manifest.json",
                manifest(4, "data", [ dependency(2, [ 9, 0, 0 ]) ])
            );
            yield* failure(install("mismatch", true), /Missing\/mismatched dependency/);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(4))), false);
            yield* failure(
                change(id(1), true, { world: "absent" }),
                /Cannot access directory/
            );
        })
    ));

test("malformed, stale and duplicate activation references are preserved on mutation failure", () =>
    fixture(({ change, fs, install, path, world, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            yield* install("source");
            const file: string = path.join(world, "world_behavior_packs.json");
            for (const invalid of [
                "{broken",
                JSON.stringify([ active(999) ]),
                JSON.stringify([ active(1), active(1) ]),
                JSON.stringify([ { ...active(1),
                    version: [ 9, 0, 0 ] } ])
            ])
            {
                yield* fs.writeFileString(file, invalid);
                yield* failure(change(id(1), true), /Invalid/);
                yield* failure(change(id(1), false), /Invalid/);
                assert.equal(yield* fs.readFileString(file), invalid);
            }
        })
    ));

test("activation write failure restores world files, registry and new pack directories", () =>
    fixture(({ entries, fs, install, path, server, world, write }) =>
        Effect.gen(function* ()
        {
            yield* write("old/manifest.json", manifest(99));
            yield* install("old", true);
            const registry: string = path.join(
                server,
                ".bedrock-server-manager",
                "registry.json"
            );
            const original: string = yield* fs.readFileString(registry);
            const behaviorFile: string = path.join(world, "world_behavior_packs.json");
            const behavior: string = yield* fs.readFileString(behaviorFile);
            yield* write("paired/b/manifest.json", manifest(1));
            yield* write("paired/r/manifest.json", manifest(2, "resources"));
            let failed: boolean = false;
            const failingFs: FileSystem.FileSystem = {
                ...fs,
                rename: (from: string, to: string) =>
                {
                    if (to === path.join(world, "world_resource_packs.json") && !failed)
                    {
                        failed = true;
                        return Effect.fail(
                            PlatformError.badArgument({
                                description: "injected activation failure",
                                method: "rename",
                                module: "FileSystem"
                            })
                        );
                    }

                    return fs.rename(from, to);
                }
            };
            yield* failure(
                install("paired", true).pipe(
                    Effect.provideService(FileSystem.FileSystem, failingFs)
                ),
                /injected activation failure/
            );
            assert.equal(yield* fs.readFileString(registry), original);
            assert.equal(yield* fs.readFileString(behaviorFile), behavior);
            assert.deepEqual(yield* entries(), [ active(99) ]);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(1))), false);
            assert.equal(yield* fs.exists(path.join(server, "resource_packs", id(2))), false);
            assert.deepEqual(yield* fs.readDirectory(path.dirname(registry)), [
                "registry.json"
            ]);
        })
    ));

test("CLI install enables by default; enable/disable honor selectors and --no-enable", () =>
    fixture(({ context, entries, fs, path, root, write }) =>
        Effect.gen(function* ()
        {
            yield* write(
                "source/manifest.json",
                manifest(1, "data", [ { module_name: "@minecraft/server",
                    version: "2.0.0" } ])
            );
            const entry: string = yield* path.fromFileUrl(
                new URL("../Distribution/index.js", import.meta.url)
            );
            const run: (...args: Array<string>) => string = (...args: Array<string>) =>
            {
                const result: NodeChildProcessTypes.SpawnSyncReturns<string> = spawnSync(
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
                assert.equal(result.status, 0, result.stdout + result.stderr);
                return result.stdout;
            };

            assert.match(
                run("install", "source"),
                /Scripting API requirement.*@minecraft\/server/
            );
            assert.deepEqual(yield* entries(), [ active(1) ]);
            run("disable", "Pack 1");
            assert.deepEqual(yield* entries(), []);
            run("enable", id(1));
            assert.deepEqual(yield* entries(), [ active(1) ]);
            yield* write("other/manifest.json", manifest(2));
            run("install", "other", "--no-enable");
            assert.deepEqual(yield* entries(), [ active(1) ]);
            assert.equal(yield* fs.exists(context.env.BDS_CONFIG_PATH ?? ""), false);
        })
    ));

test("world-local activation stays in its selected world", () =>
    fixture(({ change, entries, fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            yield* write("server/worlds/Other/world_behavior_packs.json", []);
            const installed: {
                requirements: Array<string>;
                id: string;
                name: string;
                source: string | null;
                packs: Array<RegistryTypes.RegistryMember>;
            } = yield* install("source", true, { scope: "world" });
            assert.match(installed.packs[0].location, /^worlds\/Chosen\/behavior_packs\//);
            assert.deepEqual(yield* entries(), [ active(1) ]);
            const other: string = path.join(
                server,
                "worlds",
                "Other",
                "world_behavior_packs.json"
            );
            assert.deepEqual(JSON.parse(yield* fs.readFileString(other)), []);
            yield* failure(change(id(1), true, { world: "Other" }), /No addon matches/);
            yield* change(id(1), false);
            assert.deepEqual(yield* entries(), []);
        })
    ));
