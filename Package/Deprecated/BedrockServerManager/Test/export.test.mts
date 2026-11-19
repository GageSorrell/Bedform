/**
 * Portable bundle round trips and exclusive output failure fixtures.
 *
 * @module bedrock-server-manager/Test/export.test
 *
 * @file      export.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path, PlatformError } from "effect";
import { type ExportOptions, exportAddon } from "../Distribution/export.js";
import { type InstallOptions, installAddon } from "../Distribution/install.js";
import type { Dependency } from "../Distribution/manifest.js";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import assert from "node:assert/strict";
import { decodeArchive } from "../Distribution/archive.js";
import { ingestSource } from "../Distribution/source.js";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { withTransaction } from "../Distribution/transaction.js";

const id: (number: number) => string = (number: number) =>
    `77777777-7777-7777-7777-${number.toString(16).padStart(12, "0")}`;
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
    dependencies?: Array<Dependency>;
    format_version: number;
    header: FixtureManifest.Header;
    modules: Array<{
        [key: string]: unknown;
        type: string;
        uuid: string;
        version: Array<number>;
    }>;
};
const manifest: (number: number, kind?: string) => FixtureManifest = (
    number: number,
    kind: string = "data"
): FixtureManifest => ({
    format_version: 2,
    header: {
        description: "Export fixture",
        min_engine_version: [ 1, 21, 0 ],
        name: `Export ${number}`,
        uuid: id(number),
        version: [ 2, 3, 4 ]
    },
    modules: [ { type: kind,
        uuid: id(number + 100),
        version: [ 2, 3, 4 ] } ],
    unknown: { content: "Preserve this field" }
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
type ExportFixture = {
    readonly clean: () => Effect.Effect<void, unknown, never>;
    readonly context: RuntimeContext;
    readonly fs: FileSystem.FileSystem;
    readonly install: (
        source: string,
        options?: Partial<InstallOptions>
    ) => ReturnType<typeof installAddon>;
    readonly path: Path.Path;
    readonly portable: (
        selector: string,
        output?: string,
        options?: Partial<ExportOptions>,
        maxBytes?: number
    ) => ReturnType<typeof exportAddon>;
    readonly root: string;
    readonly server: string;
    readonly write: (
        relative: string,
        value: unknown
    ) => Effect.Effect<string, unknown, never>;
};
const fixture: (
    body: (
        context: ExportFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: ExportFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-export-test-"
                });
                const server: string = path.join(root, "server");
                yield* fs.makeDirectory(path.join(server, "worlds", "A"), {
                    recursive: true
                });
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
                        if (value instanceof Uint8Array)
                        {
                            yield* fs.writeFile(file, value);
                        }
                        else
                        {
                            yield* fs.writeFileString(
                                file,
                                typeof value === "string" ? value : JSON.stringify(value)
                            );
                        }

                        return file;
                    });
                const install = (source: string, options: Partial<InstallOptions> = {}) =>
                    installAddon(context, source, {
                        enable: false,
                        server,
                        ...options
                    });
                const portable: (
                    selector: string,
                    output?: string,
                    options?: Partial<ExportOptions>,
                    maxBytes?: number
                ) => Effect.Effect<
                    { id: string;
                        name: string;
                        output: string;
                        packs: number },
                    PlatformError.PlatformError | Error,
                    FileSystem.FileSystem | Path.Path
                > = (
                    selector: string,
                    output: string = "bundle.mcaddon",
                    options: Partial<ExportOptions> = {},
                    maxBytes?: number
                ) => exportAddon(context, selector, { output,
                    server,
                    ...options }, maxBytes);
                const clean: () => Effect.Effect<
                    void,
                    PlatformError.PlatformError,
                    never
                > = () =>
                    Effect.gen(function* ()
                    {
                        assert.equal(
                            yield* fs.exists(
                                path.join(server, ".bedrock-server-manager", "mutation.lock")
                            ),
                            false
                        );
                        const temporary: Array<string> = (yield* fs.readDirectory(
                            root
                        )).filter((name: string) => name.startsWith(".bds-export-"));
                        assert.deepEqual(temporary, []);
                    });
                yield* body({
                    clean,
                    context,
                    fs,
                    install,
                    path,
                    portable,
                    root,
                    server,
                    write
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("paired export/reinstall retains every manifest and asset byte from installed files", () =>
    fixture(({ clean, context, fs, install, path, portable, root, server, write }) =>
        Effect.gen(function* ()
        {
            const behavior: FixtureManifest = manifest(1);
            behavior.dependencies = [
                { uuid: id(2),
                    version: [ 2, 3, 4 ] },
                { module_name: "@minecraft/server",
                    version: "2.0.0" }
            ];
            behavior.modules[0] = {
                ...behavior.modules[0],
                entry: "scripts/main.js",
                language: "javascript",
                type: "script"
            };
            const raw: string = `${JSON.stringify(behavior, null, 3)}\n`;
            yield* write("source/b/manifest.json", raw);
            yield* write("source/b/scripts/main.js", "// Exported scripting entrypoint\n");
            yield* write("source/b/__proto__", "portable prototype name");
            yield* write("source/b/constructor", "portable constructor name");
            yield* write("source/b/nested/二.bin", Uint8Array.from([ 0, 255, 128, 13, 10 ]));
            yield* write("source/b/empty", new Uint8Array());
            yield* write("source/r/manifest.json", manifest(2, "resources"));
            yield* write("source/r/textures/value.bin", Uint8Array.from([ 1, 2, 3 ]));
            const original = yield* ingestSource(context, "source");
            const bundle = yield* install("source", { enable: true });
            // Export installed bytes even after the source disappears.
            yield* fs.remove(path.join(root, "source"), {
                recursive: true
            });
            const registryFile: string = path.join(
                server,
                ".bedrock-server-manager",
                "registry.json"
            );
            const activationFile: string = path.join(
                server,
                "worlds",
                "A",
                "world_behavior_packs.json"
            );
            const registry: string = yield* fs.readFileString(registryFile);
            const activation: string = yield* fs.readFileString(activationFile);
            const result: {
                id: string;
                name: string;
                output: string;
                packs: number;
            } = yield* portable(id(2));
            assert.equal(result.packs, 2);
            const outer: Map<string, Uint8Array> = decodeArchive(
                yield* fs.readFile(result.output),
                {
                    limit: 1024 ** 3,
                    used: 0
                }
            );
            assert.deepEqual([ ...outer.keys() ].sort(), [ `${id(1)}.mcpack`, `${id(2)}.mcpack` ]);
            for (const bytes of outer.values())
            {
                assert.ok(
                    decodeArchive(bytes, { limit: 1024 ** 3,
                        used: 0 }).has("manifest.json")
                );
            }

            const exported = yield* ingestSource(context, result.output);
            assert.equal(exported.packs.length, 2);
            for (const expected of original.packs)
            {
                const actual = exported.packs.find(
                    (pack) => pack.manifest.uuid === expected.manifest.uuid
                );
                assert.deepEqual(actual?.manifest.raw, expected.manifest.raw);
                assert.deepEqual(actual?.files, expected.files);
            }

            const fresh: string = path.join(root, "fresh");
            yield* fs.makeDirectory(fresh);
            const installed = yield* installAddon(context, result.output, {
                enable: false,
                server: fresh
            });
            assert.equal(installed.packs.length, 2);
            for (const expected of original.packs)
            {
                const location: string = path.join(
                    fresh,
                    `${expected.manifest.kind}_packs`,
                    expected.manifest.uuid
                );
                const actual = (yield* ingestSource(context, location)).packs[0];
                assert.deepEqual(actual.files, expected.files);
            }

            assert.equal(yield* fs.readFileString(registryFile), registry);
            assert.equal(yield* fs.readFileString(activationFile), activation);
            assert.equal(result.id, bundle.id);
            yield* clean();
        })
    ));

test("standalone registered and unregistered world-local packs export by name and ID", () =>
    fixture(({ clean, context, fs, install, path, portable, root, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const worldless: string = path.join(root, "worldless");
            yield* fs.makeDirectory(worldless);
            const bundle = yield* install("source", { server: worldless });
            yield* portable(bundle.id, "shared.mcaddon", {
                server: worldless
            });
            yield* write(
                "server/worlds/A/resource_packs/manual/manifest.json",
                manifest(2, "resources")
            );
            const selected = "unregistered:worlds/A/resource_packs/manual";
            yield* portable(selected, "local.mcaddon", { scope: "world" });
            yield* portable("Export 2", "named.mcaddon", { world: "A" });
            for (const name of [ "shared", "local", "named" ])
            {
                const source = yield* ingestSource(context, `${name}.mcaddon`);
                assert.equal(source.packs.length, 1);
                const destination: string = path.join(root, `fresh-${name}`);
                yield* fs.makeDirectory(destination);
                const restored = yield* install(`${name}.mcaddon`, {
                    server: destination
                });
                assert.equal(restored.packs.length, 1);
                const expected = source.packs[0];
                const location: string = path.join(
                    destination,
                    `${expected.manifest.kind}_packs`,
                    expected.manifest.uuid
                );
                assert.deepEqual(
                    (yield* ingestSource(context, location)).packs[0].files,
                    expected.files
                );
            }

            assert.equal(
                yield* fs.exists(
                    path.join(server, ".bedrock-server-manager", "registry.json")
                ),
                false
            );
            yield* clean();
        })
    ));

test("existing files/directories, unsafe destinations and a publication race never overwrite", () =>
    fixture(({ clean, fs, install, path, portable, root, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            const outputParent: string = path.join(root, "linked-parent");
            yield* fs.makeDirectory(outputParent);
            const linkedParent: FileSystem.FileSystem = {
                ...fs,
                readLink: (file: string) =>
                    file === outputParent ? Effect.succeed("elsewhere") : fs.readLink(file)
            };
            yield* failure(
                portable(bundle.id, path.join(outputParent, "bad.mcaddon")).pipe(
                    Effect.provideService(FileSystem.FileSystem, linkedParent)
                ),
                /Symlinks/
            );
            const output: string = yield* write("existing.mcaddon", "KEEP EXACTLY");
            yield* failure(portable(bundle.id, output), /already exists/);
            assert.equal(yield* fs.readFileString(output), "KEEP EXACTLY");
            yield* failure(portable(bundle.id, "server"), /already exists/);
            yield* failure(portable(bundle.id, "missing/output.mcaddon"), /NotFound/);
            yield* failure(
                portable(bundle.id, path.join(server, "behavior_packs", id(1), "bad.mcaddon")),
                /inside installed packs/
            );
            yield* failure(
                portable(
                    bundle.id,
                    path.join(server, ".bedrock-server-manager", "bad.mcaddon")
                ),
                /inside installed packs/
            );
            const racing: string = path.join(root, "race.mcaddon");
            const injected: FileSystem.FileSystem = {
                ...fs,
                link: (from: string, to: string) =>
                    Effect.gen(function* ()
                    {
                        yield* fs.writeFileString(to, "RACER", { flag: "wx" });
                        yield* fs.link(from, to);
                    })
            };
            yield* failure(
                portable(bundle.id, racing).pipe(
                    Effect.provideService(FileSystem.FileSystem, injected)
                ),
                /exclusively publish/
            );
            assert.equal(yield* fs.readFileString(racing), "RACER");
            yield* clean();
            const unsupported: FileSystem.FileSystem = {
                ...fs,
                link: () =>
                    Effect.fail(
                        PlatformError.badArgument({
                            description: "hard links unsupported",
                            method: "link",
                            module: "FileSystem"
                        })
                    )
            };
            yield* failure(
                portable(bundle.id).pipe(
                    Effect.provideService(FileSystem.FileSystem, unsupported)
                ),
                /hard links unsupported/
            );
            assert.equal(yield* fs.exists(path.join(root, "bundle.mcaddon")), false);
            yield* clean();
        })
    ));

test("write failures and size limits leave no output and release temporary directories/lock", () =>
    fixture(({ clean, fs, install, path, portable, root, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            const injected: FileSystem.FileSystem = {
                ...fs,
                writeFile: (
                    file: string,
                    bytes: Uint8Array,
                    options:
                        | {
                            readonly flag?: FileSystem.OpenFlag | undefined;
                            readonly mode?: number | undefined;
                        }
                        | undefined
                ) =>
                    Effect.gen(function* ()
                    {
                        yield* fs.writeFile(file, bytes.subarray(0, 3), options);
                        return yield* Effect.fail(
                            PlatformError.badArgument({
                                description: "injected export write failure",
                                method: "writeFile",
                                module: "FileSystem"
                            })
                        );
                    })
            };
            yield* failure(
                portable(bundle.id).pipe(
                    Effect.provideService(FileSystem.FileSystem, injected)
                ),
                /injected export write failure/
            );
            assert.equal(yield* fs.exists(path.join(root, "bundle.mcaddon")), false);
            yield* clean();
            for (const limit of [ 0, 10, 500 ])
            {
                yield* failure(portable(bundle.id, "bundle.mcaddon", {}, limit), /limit/);
                assert.equal(yield* fs.exists(path.join(root, "bundle.mcaddon")), false);
                yield* clean();
            }
        })
    ));

test("missing members, unsafe installed files, selectors and the shared lock block export", () =>
    fixture(({ clean, fs, install, path, portable, root, server, write }) =>
        Effect.gen(function* ()
        {
            yield* write("source/manifest.json", manifest(1));
            const bundle = yield* install("source");
            yield* failure(portable("missing"), /No addon/);
            yield* withTransaction(server, () =>
                failure(portable(bundle.id), /mutation lock/)
            );
            const linked: string = path.join(server, "behavior_packs", id(1), "asset.bin");
            yield* fs.writeFileString(linked, "asset");
            const injected: FileSystem.FileSystem = {
                ...fs,
                readLink: (file: string) =>
                    file === linked ? Effect.succeed("elsewhere") : fs.readLink(file)
            };
            yield* failure(
                portable(bundle.id).pipe(
                    Effect.provideService(FileSystem.FileSystem, injected)
                ),
                /Symlinks/
            );
            yield* fs.remove(path.join(server, "behavior_packs", id(1)), {
                recursive: true
            });
            yield* failure(portable(bundle.id), /Missing or changed/);
            assert.equal(yield* fs.exists(path.join(root, "bundle.mcaddon")), false);
            yield* clean();
        })
    ));

test("CLI export requires output, reports success and fails on an existing output", () =>
    fixture(({ context, install, path, root, write }) =>
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
                    [ entry, "addon", "export", ...args ],
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

            assert.match(run("--help").text, /--output/);
            assert.notEqual(run(bundle.id, "-s", "server").code, 0);
            const result: { code: number | null;
                text: string } = run(
                bundle.id,
                "-s",
                "server",
                "--output",
                "cli.mcaddon"
            );
            assert.equal(result.code, 0, result.text);
            assert.match(result.text, /Exported Export 1/);
            assert.notEqual(run(bundle.id, "-s", "server", "--output", "cli.mcaddon").code, 0);
        })
    ));
