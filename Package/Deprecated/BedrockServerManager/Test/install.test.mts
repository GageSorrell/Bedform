/**
 * Source ingestion, archive adversaries and transactional install fixtures.
 *
 * @module bedrock-server-manager/Test/install.test
 *
 * @file      install.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path, PlatformError } from "effect";
import { type InstallOptions, installAddon } from "../Distribution/install.js";
import { strToU8, zipSync } from "fflate";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import assert from "node:assert/strict";
import { decodeArchive } from "../Distribution/archive.js";
import { ingestSource } from "../Distribution/source.js";
import { readRegistry } from "../Distribution/registry.js";
import test from "node:test";
import { withTransaction } from "../Distribution/transaction.js";

const id: (number: number) => string = (number: number) =>
    `22222222-2222-2222-2222-${number.toString(16).padStart(12, "0")}`;
namespace FixtureManifest
{
    /**
     * Identity and engine requirement of a fixture pack.
     *
     * @category Testing
     * @since 1.0.0
     */
    export interface Header
{
        description: string;
        min_engine_version: Array<number>;
        name: string;
        uuid: string;
        version: Array<number>;
    }
}
type FixtureManifest = {
    [key: string]: unknown;
    dependencies?: Array<{
        uuid?: string;
        module_name?: string;
        version: Array<number> | string;
    }>;
    format_version: number;
    header: FixtureManifest.Header;
    modules: Array<{
        [key: string]: unknown;
        type: string;
        uuid: string;
        version: Array<number>;
    }>;
};
const manifest: (number: number, type?: string) => FixtureManifest = (
    number: number,
    type: string = "data"
): FixtureManifest => ({
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
        version: [ 1, 0, 0 ] } ],
    unknown: { keep: true }
});
const failure: (
    operation: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) => Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> = (
    operation: Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path>,
    pattern: RegExp
) =>
    Effect.gen(function* ()
    {
        const result = yield* Effect.result(operation);
        assert.equal(result._tag, "Failure");
        assert.match(String(result.failure), pattern);
    });
type InstallFixture = {
    readonly context: RuntimeContext;
    readonly fs: FileSystem.FileSystem;
    readonly install: (
        source: string,
        options?: Partial<InstallOptions>
    ) => ReturnType<typeof installAddon>;
    readonly path: Path.Path;
    readonly root: string;
    readonly server: string;
    readonly write: (
        relative: string,
        value: unknown
    ) => Effect.Effect<string, unknown, never>;
};
const fixture: (
    body: (
        context: InstallFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: InstallFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-install-"
                });
                const server: string = path.join(root, "server");
                yield* fs.makeDirectory(server);
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
                        yield* fs.writeFile(
                            file,
                            value instanceof Uint8Array
                                ? value
                                : strToU8(
                                    typeof value === "string"
                                        ? value
                                        : JSON.stringify(value)
                                )
                        );
                        return file;
                    });
                const install = (source: string, options: Partial<InstallOptions> = {}) =>
                    installAddon(context, source, {
                        enable: false,
                        server,
                        ...options
                    });
                yield* body({
                    context,
                    fs,
                    install,
                    path,
                    root,
                    server,
                    write
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("standalone and paired folder installs preserve bytes and remember absolute source", () =>
    fixture(({ fs, install, path, root, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/wrapper/behavior_packs/b/manifest.json", manifest(1));
            yield* write(
                "source/wrapper/resource_packs/r/manifest.json",
                manifest(2, "resources")
            );
            yield* write(
                "source/wrapper/resource_packs/r/textures/test.bin",
                new Uint8Array([ 0, 255, 11 ])
            );
            const bundle = yield* install("source");
            assert.equal(bundle.packs.length, 2);
            assert.equal(bundle.source, path.join(root, "source"));
            const registry = yield* readRegistry(server);
            assert.equal(registry.bundles[0].id, bundle.id);
            const bytes: Uint8Array = yield* fs.readFile(
                path.join(server, "resource_packs", id(2), "textures", "test.bin")
            );
            assert.deepEqual([ ...bytes ], [ 0, 255, 11 ]);
            const raw = JSON.parse(
                yield* fs.readFileString(
                    path.join(server, "behavior_packs", id(1), "manifest.json")
                )
            );
            assert.deepEqual(raw.unknown, { keep: true });
            assert.equal(yield* fs.exists(path.join(server, "worlds")), false);
            assert.deepEqual(
                yield* fs.readDirectory(path.join(server, ".bedrock-server-manager")),
                [ "registry.json" ]
            );
            yield* failure(install("source"), /Conflicting.*UUID/);
        })
    ));

test("mcpack, zip wrappers and mcaddon nested packs install as bundles", () =>
    fixture(({ install, write }) =>
        Effect.gen(function* ()
        {
            const pack: (number: number) => Uint8Array = (number: number) =>
                zipSync({
                    "manifest.json": strToU8(JSON.stringify(manifest(number)))
                });
            const source: string = yield* write(
                "paired.mcaddon",
                zipSync({
                    "wrapper/a.mcpack": pack(1),
                    "wrapper/b.mcpack": pack(2)
                })
            );
            assert.equal((yield* install(source)).packs.length, 2);
            const standalone: string = yield* write("single.mcpack", pack(3));
            assert.equal((yield* install(standalone)).packs.length, 1);
            const wrapper: string = yield* write(
                "wrapped.zip",
                zipSync({
                    "wrapper/b/manifest.json": strToU8(JSON.stringify(manifest(4)))
                })
            );
            assert.equal((yield* install(wrapper)).packs.length, 1);
        })
    ));

test("world-scoped install validates the world and leaves activation files unchanged", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            yield* failure(
                install("source", { scope: "world",
                    world: "missing" }),
                /Cannot access directory/
            );
            assert.deepEqual(yield* fs.readDirectory(server), []);
            yield* write("server/worlds/Chosen/world_behavior_packs.json", "{broken");
            const result = yield* install("source", {
                scope: "world",
                world: "Chosen"
            });
            assert.equal(result.packs[0].location, `worlds/Chosen/behavior_packs/${id(1)}`);
            assert.equal(
                yield* fs.readFileString(
                    path.join(server, "worlds", "Chosen", "world_behavior_packs.json")
                ),
                "{broken"
            );
        })
    ));

test("archive traversal, absolute paths, normalized duplicates, collisions and CRC errors fail", () =>
{
    const decode: (bytes: Uint8Array) => Map<string, Uint8Array> = (bytes: Uint8Array) =>
        decodeArchive(bytes, { limit: 1024 ** 3,
            used: 0 });
    for (const name of [
        "../escape",
        "/absolute",
        "C:/absolute",
        "a/../../escape",
        "CON.txt",
        "a/evil. "
    ])
    {
        assert.throws(() => decode(zipSync({ [name]: strToU8("data") })), /Unsafe/);
    }

    assert.throws(
        () => decode(zipSync({ "a/./file": strToU8("1"),
            "a/file": strToU8("2") })),
        /duplicate/i
    );
    assert.throws(() => decode(zipSync({ A: strToU8("1"),
        a: strToU8("2") })), /duplicate/i);
    assert.throws(
        () => decode(zipSync({ a: strToU8("1"),
            "a/file": strToU8("2") })),
        /collision/
    );
    const crc: Uint8Array = zipSync({ file: strToU8("payload") }, { level: 0 });
    const nameSize: number = new DataView(crc.buffer).getUint16(26, true);
    crc[30 + nameSize] ^= 1;
    assert.throws(() => decode(crc), /CRC/);
    const symlink: Uint8Array = zipSync({ file: strToU8("target") });
    const view: DataView = new DataView(symlink.buffer);
    for (let offset: number = 0; offset < symlink.length - 46; offset++)
    {
        if (view.getUint32(offset, true) === 0x02014b50)
        {
            view.setUint32(offset + 38, 0xa1ff0000, true);
            break;
        }
    }

    assert.throws(() => decode(symlink), /Unsafe/);
    assert.throws(
        () =>
            decodeArchive(zipSync({ file: new Uint8Array(1024) }), {
                limit: 128,
                used: 0
            }),
        /Expanded content/
    );
    const local: Uint8Array = zipSync({ safe: strToU8("payload") });
    local.set(strToU8("../x"), 30);
    assert.throws(() => decode(local), /Unsafe|mismatch/);
});

test("nested depth and aggregate byte budgets are enforced before writing", () =>
    fixture(({ context, fs, path, server, write }) =>
        Effect.gen(function* ()
        {
            let archive: Uint8Array = zipSync({
                "manifest.json": strToU8(JSON.stringify(manifest(1)))
            });
            for (let level: number = 1; level < 4; level++)
            {
                archive = zipSync({ "inner.mcpack": archive });
            }

            const allowed: string = yield* write("four.mcaddon", archive);
            assert.equal((yield* ingestSource(context, allowed)).packs.length, 1);
            const excessive: string = yield* write(
                "five.mcaddon",
                zipSync({ "inner.mcpack": archive })
            );
            yield* failure(ingestSource(context, excessive), /four levels/);
            yield* failure(ingestSource(context, allowed, 128), /limit|exceeds/i);
            yield* write("folder/manifest.json", manifest(2));
            yield* failure(
                ingestSource(context, path.join(path.dirname(server), "folder"), 128),
                /limit/
            );
            assert.deepEqual(yield* fs.readDirectory(server), []);
        })
    ));

test("symlink sources and mutation parents are rejected, including links inside a source", () =>
    fixture(({ context, fs, install, path, root, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const sourceFile: string = path.join(root, "source", "manifest.json");
            const linkedFs: FileSystem.FileSystem = {
                ...fs,
                readLink: (file: string) =>
                    file === sourceFile ? Effect.succeed("elsewhere") : fs.readLink(file)
            };
            yield* failure(
                ingestSource(context, "source").pipe(
                    Effect.provideService(FileSystem.FileSystem, linkedFs)
                ),
                /Symlinks/
            );
            const parent: string = path.join(server, "behavior_packs");
            const badParent: FileSystem.FileSystem = {
                ...fs,
                readLink: (file: string) =>
                    file === parent ? Effect.succeed("elsewhere") : fs.readLink(file)
            };
            yield* failure(
                install("source").pipe(
                    Effect.provideService(FileSystem.FileSystem, badParent)
                ),
                /Symlinks/
            );
            assert.equal(
                yield* fs.exists(
                    path.join(server, ".bedrock-server-manager", "registry.json")
                ),
                false
            );
        })
    ));

test("staging/commit failures roll back packs, preserve old JSON and release locks", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("one/manifest.json", manifest(1));
            yield* install("one");
            yield* write("two/manifest.json", manifest(2));
            const registry: string = path.join(
                server,
                ".bedrock-server-manager",
                "registry.json"
            );
            const original: string = yield* fs.readFileString(registry);
            const stagedFailure: FileSystem.FileSystem = {
                ...fs,
                writeFile: () =>
                    Effect.fail(
                        PlatformError.badArgument({
                            description: "injected staging failure",
                            method: "writeFile",
                            module: "FileSystem"
                        })
                    )
            };
            yield* failure(
                install("two").pipe(
                    Effect.provideService(FileSystem.FileSystem, stagedFailure)
                ),
                /staging/
            );
            let failed: boolean = false;
            const commitFailure: FileSystem.FileSystem = {
                ...fs,
                rename: (from: string, to: string) =>
                {
                    if (to === registry && !failed)
                    {
                        failed = true;
                        return Effect.fail(
                            PlatformError.badArgument({
                                description: "injected commit failure",
                                method: "rename",
                                module: "FileSystem"
                            })
                        );
                    }

                    return fs.rename(from, to);
                }
            };
            yield* failure(
                install("two").pipe(
                    Effect.provideService(FileSystem.FileSystem, commitFailure)
                ),
                /commit/
            );
            assert.equal(yield* fs.readFileString(registry), original);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(1))), true);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs", id(2))), false);
            assert.deepEqual(yield* fs.readDirectory(path.dirname(registry)), [
                "registry.json"
            ]);
            assert.equal((yield* install("two")).packs.length, 1);
        })
    ));

test("a held server lock rejects a competing install without deleting the owner's lock", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            yield* withTransaction(server, () =>
                Effect.gen(function* ()
                {
                    yield* failure(install("source"), /mutation lock/);
                    assert.equal(
                        yield* fs.exists(
                            path.join(server, ".bedrock-server-manager", "mutation.lock")
                        ),
                        true
                    );
                })
            );
            assert.deepEqual(
                yield* fs.readDirectory(path.join(server, ".bedrock-server-manager")),
                []
            );
            assert.equal((yield* install("source")).packs.length, 1);
        })
    ));

test("rollback failure retains backups and the lock for manual recovery", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("one/manifest.json", manifest(1));
            yield* install("one");
            yield* write("two/manifest.json", manifest(2));
            const registry: string = path.join(
                server,
                ".bedrock-server-manager",
                "registry.json"
            );
            const failingFs: FileSystem.FileSystem = {
                ...fs,
                rename: (from: string, to: string) =>
                    to === registry
                        ? Effect.fail(
                            PlatformError.badArgument({
                                description: "persistent rename failure",
                                method: "rename",
                                module: "FileSystem"
                            })
                        )
                        : fs.rename(from, to)
            };
            yield* failure(
                install("two").pipe(Effect.provideService(FileSystem.FileSystem, failingFs)),
                /Rollback incomplete.*backups retained/
            );
            const metadata: string = path.join(server, ".bedrock-server-manager");
            const entries: Array<string> = yield* fs.readDirectory(metadata);
            assert.ok(entries.includes("mutation.lock"));
            assert.ok(entries.some((entry: string) => entry.startsWith("stage-")));
            yield* failure(install("two"), /mutation lock/);
        })
    ));

test("UUID conflicts in another world prevent shared installation", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            yield* write(
                "server/worlds/Other/behavior_packs/existing/manifest.json",
                manifest(1)
            );
            yield* failure(install("source"), /Conflicting.*UUID/);
            assert.equal(yield* fs.exists(path.join(server, "behavior_packs")), false);
        })
    ));

test("stock BDS packs (versioned UUIDs, archived beta scripts) allow installation", () =>
    fixture(({ fs, install, path, server, write }) =>
        Effect.gen(function* ()
        {
            const stock: (version: Array<number>) => {
                header: {
                    version: Array<number>;
                    description: string;
                    min_engine_version: Array<number>;
                    name: string;
                    uuid: string;
                };
                dependencies?: Array<{
                    uuid?: string;
                    module_name?: string;
                    version: Array<number> | string;
                }>;
                format_version: number;
                modules: Array<{
                    [key: string]: unknown;
                    type: string;
                    uuid: string;
                    version: Array<number>;
                }>;
            } = (version: Array<number>) => ({
                ...manifest(5),
                header: { ...manifest(5).header,
                    version }
            });
            yield* write("server/behavior_packs/stock_1.0/manifest.json", stock([ 1, 0, 0 ]));
            yield* write("server/behavior_packs/stock_1.1/manifest.json", stock([ 1, 1, 0 ]));
            const editor: FixtureManifest = manifest(7, "script");
            Object.assign(editor.modules[0], {
                entry: "scripts/Main.js",
                language: "javascript"
            });
            editor.dependencies = [
                { module_name: "@minecraft/server-editor",
                    version: "beta" }
            ];
            yield* write("server/behavior_packs/editor/manifest.json", editor);
            yield* write(
                "server/behavior_packs/editor/__brarchive/scripts.brarchive",
                "packed"
            );
            const activation: string = path.join(
                server,
                "worlds",
                "Chosen",
                "world_behavior_packs.json"
            );
            yield* write("server/worlds/Chosen/world_behavior_packs.json", [
                { pack_id: id(5),
                    version: [ 1, 1, 0 ] }
            ]);
            yield* write("source/manifest.json", manifest(1));
            yield* install("source", { enable: true,
                world: "Chosen" });
            const active: Array<{ pack_id: string }> = JSON.parse(
                yield* fs.readFileString(activation)
            );
            assert.deepEqual(
                active.map((entry: { pack_id: string }) => entry.pack_id),
                [ id(5), id(1) ]
            );
            yield* write("server/behavior_packs/stock_copy/manifest.json", stock([ 1, 1, 0 ]));
            yield* write("other/manifest.json", manifest(2));
            yield* failure(install("other"), /Duplicate installed UUID/);
        })
    ));
