/**
 * Inventory and command fixtures never reference a real Bedrock installation.
 *
 * @module bedrock-server-manager/Test/inventory.test
 *
 * @file      inventory.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path } from "effect";
import {
    type Inventory,
    discoverInventory,
    scopedAddons,
    selectAddon
} from "../Distribution/inventory.js";
import { parseManifest, sameVersion } from "../Distribution/manifest.js";
import { parseRegistry, readRegistry } from "../Distribution/registry.js";
import type { Dependency } from "../Distribution/manifest.js";
import { NodeServices } from "@effect/platform-node";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const id: (number: number) => string = (number: number) =>
    `12345678-1234-1234-1234-${number.toString(16).padStart(12, "0")}`;
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
    dependencies: Array<Dependency>;
    format_version: number;
    header: FixtureManifest.Header;
    modules: Array<{
        [key: string]: unknown;
        type: string;
        uuid: string;
        version: Array<number>;
    }>;
};
const manifest: (number: number, name?: string, type?: string) => FixtureManifest = (
    number: number,
    name: string = "Example",
    type: string = "data"
): FixtureManifest => ({
    dependencies: [],
    extension: { preserved: true },
    format_version: 2,
    header: {
        description: "Fixture",
        min_engine_version: [ 1, 21, 0 ],
        name,
        uuid: id(number),
        version: [ 1, 0, 0 ]
    },
    modules: [ { type,
        uuid: id(number + 1000),
        version: [ 1, 0, 0 ] } ]
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
type InventoryFixture = {
    readonly add: (relative: string, value: unknown) => Effect.Effect<void, unknown, never>;
    readonly context: RuntimeContext;
    readonly fs: FileSystem.FileSystem;
    readonly inventory: () => ReturnType<typeof discoverInventory>;
    readonly path: Path.Path;
    readonly root: string;
    readonly world: string;
    readonly write: (relative: string, value: unknown) => Effect.Effect<void, unknown, never>;
};
const fixture: (
    body: (
        context: InventoryFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: InventoryFixture
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-inventory-"
                });
                const world: string = path.join(root, "worlds", "Fixture World");
                yield* fs.makeDirectory(world, { recursive: true });
                yield* fs.writeFileString(
                    path.join(root, "server.properties"),
                    "level-name=Fixture World\n"
                );
                const context: {
                    cwd: string;
                    env: { BDS_CONFIG_PATH: string };
                    home: string;
                    platform: NodeJS.Platform;
                } = {
                    cwd: root,
                    env: {
                        BDS_CONFIG_PATH: path.join(root, "absent-config.json")
                    },
                    home: root,
                    platform: process.platform
                };
                const write = (relative: string, value: unknown) =>
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
                    });
                const add = (relative: string, value: unknown) =>
                    write(`${relative}/manifest.json`, value);
                const inventory = () => discoverInventory(context, { server: root });
                yield* body({
                    add,
                    context,
                    fs,
                    inventory,
                    path,
                    root,
                    world,
                    write
                });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

test("manifest parsing preserves extensions and classifies resources and script-only behavior", () =>
{
    const raw: FixtureManifest = manifest(1);
    assert.equal(parseManifest(raw).raw, raw);
    assert.deepEqual(parseManifest(raw).raw.extension, { preserved: true });
    assert.equal(parseManifest(manifest(2, "Resources", "resources")).kind, "resource");
    const script: FixtureManifest = manifest(3, "Script", "script");
    Object.assign(script.modules[0], {
        entry: "scripts/main.js",
        language: "javascript"
    });
    script.dependencies = [ { module_name: "@minecraft/server",
        version: "2.0.0-beta" } ];
    assert.equal(parseManifest(script).kind, "behavior");
    assert.equal(parseManifest(script).dependencies[0].module_name, "@minecraft/server");
    script.dependencies = [ { module_name: "@minecraft/server-editor",
        version: "beta" } ];
    assert.equal(parseManifest(script).dependencies[0].version, "beta");
    assert.throws(
        () =>
            parseManifest({
                ...script,
                dependencies: [ { uuid: id(2),
                    version: "beta" } ]
            }),
        /dependency/
    );
    const modern: FixtureManifest = manifest(4, "Modern", "resources");
    Object.assign(modern, { format_version: 3 });
    Object.assign(modern.header, { min_engine_version: "1.26.50",
        pack_scope: "world",
        version: "1.14.1" });
    assert.deepEqual(parseManifest(modern).version, [ 1, 14, 1 ]);
    Object.assign(modern.header, { version: "1.14.1-beta" });
    assert.equal(parseManifest(modern).version, "1.14.1-beta");
    assert.ok(sameVersion([ 1, 0, 0 ], "1.0.0"));
    assert.equal(sameVersion("1.0.0-beta", "1.0.0"), false);
    assert.equal(sameVersion("1.0.0+one", "1.0.0+two"), false);
});

test("unsupported formats/kinds and invalid identities/modules/dependencies are actionable", () =>
{
    for (const [ change, pattern ] of [
        [ { format_version: 1 }, /format_version 2 or 3/ ],
        [ { format_version: 4 }, /format_version 2 or 3/ ],
        [ { header: { name: "broken" } }, /header/ ],
        [ { modules: [] }, /at least one module/ ],
        [
            {
                modules: [
                    {
                        type: "world_template",
                        uuid: id(50),
                        version: [ 1, 0, 0 ]
                    }
                ]
            },
            /Unsupported/
        ],
        [ { modules: [ { type: "data",
            uuid: id(1),
            version: [ 1, 0, 0 ] } ] }, /Duplicate/ ],
        [ { dependencies: [ { uuid: id(2) } ] }, /dependency/ ],
        [
            {
                dependencies: [ { module_name: "api",
                    uuid: id(2),
                    version: [ 1, 0, 0 ] } ]
            },
            /dependency/
        ]
    ])
    {
        assert.throws(() => parseManifest({ ...manifest(1),
            ...change }), pattern);
    }

    const mixed: FixtureManifest = manifest(1);
    mixed.modules.push({ type: "resources",
        uuid: id(9),
        version: [ 1, 0, 0 ] });
    assert.throws(() => parseManifest(mixed), /cannot mix/);
    for (const version of [ "01.0.0", "1.0.0-01", "1.0.0-a..b", "1.0.0+..", [ -1, 0, 0 ] ])
    {
        assert.throws(
            () =>
                parseManifest({
                    ...manifest(1),
                    header: { ...manifest(1).header,
                        version }
                }),
            /header/
        );
    }
});

test("shared and world discovery, bundle grouping, selectors, scope and source retention", () =>
    fixture(({ add, fs, inventory, path, root, write }) =>
        Effect.gen(function* ()
        {
            yield* add("behavior_packs/behavior", manifest(1, "Behavior"));
            yield* add("resource_packs/resource", manifest(2, "Resources", "resources"));
            yield* add("worlds/Fixture World/behavior_packs/local", manifest(3, "Local"));
            yield* add("worlds/Other/behavior_packs/invisible", manifest(4));
            yield* write("worlds/Fixture World/world_behavior_packs.json", [
                {
                    extra: "preserved",
                    pack_id: id(1).toUpperCase(),
                    version: [ 1, 0, 0 ]
                }
            ]);
            const registry: {
                bundles: Array<{
                    id: string;
                    name: string;
                    packs: Array<{ location: string;
                        uuid: string }>;
                    source: string;
                }>;
                version: number;
            } = {
                bundles: [
                    {
                        id: "bundle-one",
                        name: "Paired",
                        packs: [
                            {
                                location: "behavior_packs/behavior",
                                uuid: id(1)
                            },
                            {
                                location: "resource_packs/resource",
                                uuid: id(2)
                            }
                        ],
                        source: path.join(root, "source.zip")
                    }
                ],
                version: 1
            };
            yield* write(".bedrock-server-manager/registry.json", registry);
            const result: Inventory = yield* inventory();
            assert.equal(result.addons.length, 2);
            assert.deepEqual(result.diagnostics, []);
            const bundle = yield* selectAddon(result, "bundle-one");
            assert.equal(bundle.members.length, 2);
            assert.equal(bundle.source, path.join(root, "source.zip"));
            assert.equal((yield* selectAddon(result, id(2))).id, bundle.id);
            assert.equal((yield* selectAddon(result, "Paired")).id, bundle.id);
            assert.equal((yield* selectAddon(result, "Resources")).id, bundle.id);
            assert.equal(bundle.members[0].activation, "enabled");
            assert.equal(bundle.members[1].activation, "disabled");
            assert.equal(scopedAddons(result, "world")[0].name, "Local");
            assert.equal(scopedAddons(result, "shared").length, 1);
            assert.deepEqual(
                JSON.parse(
                    yield* fs.readFileString(
                        path.join(
                            root,
                            "worlds",
                            "Fixture World",
                            "world_behavior_packs.json"
                        )
                    )
                )[0].extra,
                "preserved"
            );
        })
    ));

test("missing registry is lazy and malformed or conflicting registries fail without writes", () =>
    fixture(({ fs, path, root, write }) =>
        Effect.gen(function* ()
        {
            assert.deepEqual(yield* readRegistry(root), {
                bundles: [],
                version: 1
            });
            assert.equal(yield* fs.exists(path.join(root, ".bedrock-server-manager")), false);
            const member: { location: string;
                uuid: string } = {
                location: "behavior_packs/a",
                uuid: id(1)
            };
            const bundle: {
                id: string;
                name: string;
                packs: Array<{ location: string;
                    uuid: string }>;
                source: null;
            } = {
                id: "bundle",
                name: "Name",
                packs: [ member ],
                source: null
            };
            for (const value of [
                { bundles: [],
                    version: 2 },
                {
                    bundles: [ { ...bundle,
                        source: "relative.zip" } ],
                    version: 1
                },
                {
                    bundles: [
                        {
                            ...bundle,
                            packs: [ { ...member,
                                location: "../escape" } ]
                        }
                    ],
                    version: 1
                },
                { bundles: [ bundle, bundle ],
                    version: 1 },
                { bundles: [ bundle, { ...bundle,
                    id: "other" } ],
                version: 1 }
            ])
            {
                yield* failure(parseRegistry(value), /Invalid bundle registry/);
            }

            yield* write(".bedrock-server-manager/registry.json", "{broken");
            yield* failure(readRegistry(root), /Invalid bundle registry/);
            assert.equal(
                yield* fs.readFileString(
                    path.join(root, ".bedrock-server-manager", "registry.json")
                ),
                "{broken"
            );
        })
    ));

test("duplicates, ambiguous names, missing registry members and identity drift are reported", () =>
    fixture(({ add, inventory, write }) =>
        Effect.gen(function* ()
        {
            yield* add("behavior_packs/a", manifest(1, "Same"));
            yield* add("worlds/Fixture World/behavior_packs/b", manifest(1, "Same"));
            yield* write(".bedrock-server-manager/registry.json", {
                bundles: [
                    {
                        id: "drift",
                        name: "Drift",
                        packs: [
                            { location: "behavior_packs/a",
                                uuid: id(8) },
                            { location: "resource_packs/missing",
                                uuid: id(9) }
                        ],
                        source: null
                    }
                ],
                version: 1
            });
            const result: Inventory = yield* inventory();
            assert.ok(
                result.diagnostics.some(
                    (item: { code: string }) => item.code === "duplicate-identity"
                )
            );
            assert.ok(
                result.diagnostics.some(
                    (item: { code: string }) => item.code === "registry-identity-mismatch"
                )
            );
            assert.ok(
                result.diagnostics.some(
                    (item: { code: string }) => item.code === "missing-registered-pack"
                )
            );
            yield* failure(selectAddon(result, id(1)), /Ambiguous.*Candidates/);
            yield* failure(selectAddon(result, "absent"), /No addon matches/);
            const unregistered = {
                ...result,
                addons: result.addons.flatMap((addon) =>
                    addon.members.map((pack) => ({
                        ...addon,
                        id: pack.relativeLocation,
                        members: [ pack ],
                        name: "Same",
                        registeredMembers: []
                    }))
                )
            };
            yield* failure(selectAddon(unregistered, "Same"), /Ambiguous/);
            assert.equal(
                (yield* selectAddon(result, id(1), "world")).members[0].scope,
                "world"
            );
        })
    ));

test("invalid manifests stay visible; scripts, dependencies and activation are checked", () =>
    fixture(({ add, inventory, write }) =>
        Effect.gen(function* ()
        {
            const behavior: FixtureManifest = manifest(1, "Script", "script");
            Object.assign(behavior.modules[0], {
                entry: "scripts/missing.js",
                language: "javascript"
            });
            behavior.dependencies = [
                { uuid: id(2),
                    version: [ 2, 0, 0 ] },
                { uuid: id(3),
                    version: [ 1, 0, 0 ] },
                { module_name: "@minecraft/server",
                    version: "2.0.0" }
            ];
            yield* add("behavior_packs/script", behavior);
            yield* add("resource_packs/resources", manifest(2, "Resources", "resources"));
            yield* add("behavior_packs/malformed", "{broken");
            yield* add("behavior_packs/unsupported", {
                ...manifest(4),
                format_version: 3
            });
            yield* add("behavior_packs/wrong-kind", manifest(5, "Wrong", "resources"));
            yield* write("worlds/Fixture World/world_behavior_packs.json", [
                { pack_id: id(1),
                    version: [ 1, 0, 0 ] },
                { pack_id: id(6),
                    version: [ 1, 0, 0 ] }
            ]);
            const result: Inventory = yield* inventory();
            const codes: Array<string> = result.diagnostics.map((item) => item.code);
            for (const code of [
                "invalid-manifest",
                "missing-script-entry",
                "wrong-pack-directory",
                "missing-dependency",
                "dependency-version",
                "scripting-api",
                "inactive-dependency",
                "invalid-activation-reference"
            ])
            {
                assert.ok(codes.includes(code), code);
            }

            assert.equal(result.addons.length, 5);
            Object.assign(behavior.modules[0], { entry: "../escape.js" });
            yield* add("behavior_packs/script", behavior);
            yield* write("worlds/Fixture World/world_resource_packs.json", "{broken");
            const invalid: Inventory = yield* inventory();
            assert.ok(
                invalid.diagnostics.some(
                    (item: { code: string }) => item.code === "unsafe-script-entry"
                )
            );
            assert.ok(
                invalid.diagnostics.some(
                    (item: { code: string }) => item.code === "invalid-activation-file"
                )
            );
            const resources = invalid.addons.find(
                (addon: { name: string }) => addon.name === "Resources"
            );
            assert.equal(resources?.members[0]?.activation, "unknown");
        })
    ));

test("valid mutually dependent packs, script entrypoints and duplicate activation detection", () =>
    fixture(({ add, inventory, write }) =>
        Effect.gen(function* ()
        {
            const behavior: FixtureManifest = manifest(1, "Script", "script");
            Object.assign(behavior.modules[0], {
                entry: "scripts/main.js",
                language: "javascript"
            });
            behavior.dependencies = [ { uuid: id(2),
                version: [ 1, 0, 0 ] } ];
            const resource: FixtureManifest = manifest(2, "Resources", "resources");
            resource.dependencies = [ { uuid: id(1),
                version: [ 1, 0, 0 ] } ];
            yield* add("behavior_packs/behavior", behavior);
            yield* add("resource_packs/resource", resource);
            yield* write("behavior_packs/behavior/scripts/main.js", "// fixture");
            const active: (number: number) => {
                pack_id: string;
                version: Array<number>;
            } = (number: number) => ({
                pack_id: id(number),
                version: [ 1, 0, 0 ]
            });
            yield* write("worlds/Fixture World/world_behavior_packs.json", [ active(1) ]);
            yield* write("worlds/Fixture World/world_resource_packs.json", [ active(2) ]);
            assert.deepEqual((yield* inventory()).diagnostics, []);
            yield* write("worlds/Fixture World/world_behavior_packs.json", [
                active(1),
                active(1)
            ]);
            const result: Inventory = yield* inventory();
            assert.ok(
                result.diagnostics.some(
                    (item: { code: string }) => item.code === "duplicate-activation"
                )
            );
            assert.equal(result.addons[0].members[0].activation, "invalid");
        })
    ));

test("pack and script real paths cannot escape their permitted directories", () =>
    fixture(({ add, context, fs, path, root, write }) =>
        Effect.gen(function* ()
        {
            const raw: FixtureManifest = manifest(1, "Script", "script");
            Object.assign(raw.modules[0], {
                entry: "main.js",
                language: "javascript"
            });
            yield* add("behavior_packs/example", raw);
            yield* write("behavior_packs/example/main.js", "// fixture");
            const pack: string = path.join(root, "behavior_packs", "example");
            const script: string = path.join(pack, "main.js");
            for (const escape of [ pack, script ])
            {
                const guarded: FileSystem.FileSystem = {
                    ...fs,
                    realPath: (file: string) =>
                        file === escape
                            ? Effect.succeed(path.resolve(root, "..", "escaped"))
                            : fs.realPath(file)
                };
                const result: Inventory = yield* discoverInventory(context, {
                    server: root
                }).pipe(Effect.provideService(FileSystem.FileSystem, guarded));
                assert.ok(
                    result.diagnostics.some(
                        (item: { code: string }) =>
                            item.code ===
                            (escape === pack ? "invalid-manifest" : "missing-script-entry")
                    )
                );
            }
        })
    ));

test("addon CLI aliases, JSON reports, selected worlds, help and failure exit codes", () =>
    fixture(({ add, context, fs, path, root, write }) =>
        Effect.gen(function* ()
        {
            yield* add("behavior_packs/example", manifest(1, "Example"));
            const entry: string = yield* path.fromFileUrl(
                new URL("../Distribution/index.js", import.meta.url)
            );
            const run: (...args: Array<string>) => {
                code: number | null;
                stdout: string;
                text: string;
            } = (...args: Array<string>) =>
            {
                const result = spawnSync(process.execPath, [ entry, "addon", ...args ], {
                    cwd: root,
                    encoding: "utf8",
                    env: { ...process.env,
                        ...context.env,
                        NO_COLOR: "1" },
                    timeout: 60000
                });
                assert.equal(result.error, undefined);
                return {
                    code: result.status,
                    stdout: result.stdout,
                    text: result.stdout + result.stderr
                };
            };

            const listed: {
                code: number | null;
                stdout: string;
                text: string;
            } = run("ls", "-s", root, "-w", "Fixture World", "--json");
            assert.equal(listed.code, 0, listed.text);
            assert.equal(JSON.parse(listed.stdout).addons[0].name, "Example");
            const text: { code: number | null;
                stdout: string;
                text: string } = run(
                "list",
                "-s",
                root
            );
            assert.equal(text.code, 0, text.text);
            assert.match(text.stdout, /Example.*unregistered/s);
            assert.match(text.stdout, /1\.0\.0.*disabled/s);
            yield* add("worlds/Other/behavior_packs/local", manifest(2, "Other"));
            const other: { code: number | null;
                stdout: string;
                text: string } = run(
                "list",
                "-s",
                root,
                "-w",
                "Other",
                "--scope",
                "world",
                "--json"
            );
            assert.equal(other.code, 0, other.text);
            assert.deepEqual(
                (JSON.parse(other.stdout) as Inventory).addons.map((addon) => addon.name),
                [ "Other" ]
            );
            const shown: { code: number | null;
                stdout: string;
                text: string } = run(
                "show",
                id(1),
                "--server",
                root,
                "--json"
            );
            assert.equal(shown.code, 0, shown.text);
            assert.deepEqual(JSON.parse(shown.stdout).members[0].manifest.extension, {
                preserved: true
            });
            const valid: { code: number | null;
                stdout: string;
                text: string } = run(
                "validate",
                "--server",
                root,
                "--json"
            );
            assert.equal(valid.code, 0, valid.text);
            assert.equal(JSON.parse(valid.stdout).valid, true);
            const help: { code: number | null;
                stdout: string;
                text: string } = run(
                "show",
                "--help"
            );
            assert.equal(help.code, 0, help.text);
            assert.match(help.text, /--server/);
            assert.notEqual(run("list").code, 0);
            assert.notEqual(run("list", "-s", root, "--scope", "invalid").code, 0);
            assert.notEqual(run("show", "missing", "-s", root).code, 0);
            assert.notEqual(run("list", "-s", root, "-w", "missing").code, 0);
            yield* write("worlds/Fixture World/world_behavior_packs.json", "{broken");
            const invalid: {
                code: number | null;
                stdout: string;
                text: string;
            } = run("validate", "Example", "-s", root, "--json");
            assert.equal(invalid.code, 1, invalid.text);
            assert.equal(JSON.parse(invalid.stdout).valid, false);
            assert.equal(
                yield* fs.readFileString(
                    path.join(root, "worlds", "Fixture World", "world_behavior_packs.json")
                ),
                "{broken"
            );
            assert.equal(yield* fs.exists(path.join(root, ".bedrock-server-manager")), false);
            assert.equal(yield* fs.exists(context.env.BDS_CONFIG_PATH ?? ""), false);
        })
    ));
