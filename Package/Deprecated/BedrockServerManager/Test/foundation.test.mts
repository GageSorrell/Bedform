/**
 * Isolated configuration, server resolution and executable integration checks.
 *
 * @module bedrock-server-manager/Test/foundation.test
 *
 * @file      foundation.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path, PlatformError } from "effect";
import { NodePath, NodeServices } from "@effect/platform-node";
import { configPath, readSettings, writeSetting } from "../Distribution/config.js";
import { resolveServer, resolveWorld } from "../Distribution/server.js";
import type { RuntimeContext } from "../Distribution/config.js";
import type { Scope } from "effect";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

type FixtureContext = {
    context: RuntimeContext;
    fs: FileSystem.FileSystem;
    path: Path.Path;
    root: string;
};
const fixture: (
    body: (
        context: FixtureContext
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) => Promise<void> = (
    body: (
        context: FixtureContext
    ) => Effect.Effect<unknown, unknown, FileSystem.FileSystem | Path.Path | Scope.Scope>
) =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-test-"
                });
                const context: {
                    cwd: string;
                    env: { BDS_CONFIG_PATH: string };
                    home: string;
                    platform: NodeJS.Platform;
                } = {
                    cwd: root,
                    env: {
                        BDS_CONFIG_PATH: path.join(root, "settings", "config.json")
                    },
                    home: root,
                    platform: process.platform
                };
                yield* body({ context,
                    fs,
                    path,
                    root });
            })
        ).pipe(Effect.provide(NodeServices.layer))
    );

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

test("native Windows and POSIX path conventions are independent of the test host", async () =>
{
    const windows: {
        cwd: string;
        env: { APPDATA: string };
        home: string;
        platform: string;
    } = {
        cwd: "C:\\work",
        env: { APPDATA: "C:\\Users\\tester\\AppData\\Roaming" },
        home: "C:\\Users\\tester",
        platform: "win32"
    };
    assert.equal(
        await Effect.runPromise(configPath(windows).pipe(Effect.provide(NodePath.layerWin32))),
        "C:\\Users\\tester\\AppData\\Roaming\\bedrock-server-manager\\config.json"
    );
    const cases: Array<[string, Record<string, string | undefined>, string]> = [
        [
            "darwin",
            {},
            "/Users/tester/Library/Application Support/bedrock-server-manager/config.json"
        ],
        [ "linux", {}, "/Users/tester/.config/bedrock-server-manager/config.json" ],
        [
            "linux",
            { XDG_CONFIG_HOME: "/config" },
            "/config/bedrock-server-manager/config.json"
        ]
    ];
    for (const [ platform, env, expected ] of cases)
    {
        assert.equal(
            await Effect.runPromise(
                configPath({
                    cwd: "/work",
                    env,
                    home: "/Users/tester",
                    platform
                }).pipe(Effect.provide(NodePath.layerPosix))
            ),
            expected
        );
    }
});

test("platform config paths, overrides and missing Windows environment", () =>
    fixture(({ context, path, root }) =>
        Effect.gen(function* ()
        {
            const cases: Array<[string, Record<string, string | undefined>, string]> = [
                [
                    "win32",
                    { APPDATA: root },
                    path.join(root, "bedrock-server-manager", "config.json")
                ],
                [
                    "darwin",
                    {},
                    path.join(
                        root,
                        "Library",
                        "Application Support",
                        "bedrock-server-manager",
                        "config.json"
                    )
                ],
                [
                    "linux",
                    { XDG_CONFIG_HOME: root },
                    path.join(root, "bedrock-server-manager", "config.json")
                ],
                [
                    "linux",
                    { XDG_CONFIG_HOME: "" },
                    path.join(root, ".config", "bedrock-server-manager", "config.json")
                ]
            ];
            for (const [ platform, env, expected ] of cases)
            {
                assert.equal(yield* configPath({ ...context,
                    env,
                    platform }), expected);
            }

            assert.equal(
                yield* configPath({
                    ...context,
                    env: { BDS_CONFIG_PATH: "portable.json" }
                }),
                path.join(root, "portable.json")
            );
            yield* failure(configPath({ ...context,
                env: {},
                platform: "win32" }), /APPDATA/);
            yield* failure(
                configPath({ ...context,
                    env: { BDS_CONFIG_PATH: " " } }),
                /must not be empty/
            );
        })
    ));

test("lazy read, relative persistence, unset and unrelated settings preservation", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            assert.deepEqual(yield* readSettings(context), {});
            const file: string = yield* configPath(context);
            assert.equal(yield* fs.exists(path.dirname(file)), false);
            yield* fs.makeDirectory(path.join(root, "server"));
            yield* writeSetting(context, "server.path", "server");
            assert.deepEqual(yield* readSettings(context), {
                server: { path: path.join(root, "server") }
            });
            yield* fs.writeFileString(
                file,
                JSON.stringify({
                    custom: true,
                    server: { path: root,
                        retained: 42 }
                })
            );
            yield* writeSetting(context, "server.path");
            assert.deepEqual(yield* readSettings(context), {
                custom: true,
                server: { retained: 42 }
            });
            yield* writeSetting(context, "server.path", root);
            const updated = yield* readSettings(context);
            assert.equal(updated.server?.path, root);
            assert.deepEqual(yield* fs.readDirectory(path.dirname(file)), [ "config.json" ]);
        })
    ));

test("invalid configuration is preserved byte for byte on read and write", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            const file: string = yield* configPath(context);
            yield* fs.makeDirectory(path.dirname(file), { recursive: true });
            for (const invalid of [
                "{broken",
                "null",
                "[]",
                "{\"server\":3}",
                "{\"server\":{\"path\":\"\"}}"
            ])
            {
                yield* fs.writeFileString(file, invalid);
                yield* failure(readSettings(context), /Invalid configuration/);
                yield* failure(
                    writeSetting(context, "server.path", root),
                    /Invalid configuration/
                );
                yield* failure(writeSetting(context, "server.path"), /Invalid configuration/);
                assert.equal(yield* fs.readFileString(file), invalid);
            }
        })
    ));

test("unsupported keys and invalid paths never create configuration", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            yield* failure(writeSetting(context, "__proto__", root), /Unsupported setting/);
            yield* failure(writeSetting(context, "server.path", " "), /must not be empty/);
            yield* failure(
                writeSetting(context, "server.path", "absent"),
                /Cannot access directory/
            );
            yield* fs.writeFileString(path.join(root, "file"), "data");
            yield* failure(
                writeSetting(context, "server.path", "file"),
                /Expected a directory/
            );
            assert.equal(yield* fs.exists(yield* configPath(context)), false);
        })
    ));

test("failed atomic replacement preserves the original and cleans temporary files", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            yield* writeSetting(context, "server.path", root);
            const file: string = yield* configPath(context);
            const before: string = yield* fs.readFileString(file);
            const failingFs: FileSystem.FileSystem = {
                ...fs,
                rename: (_source: string, _destination: string) =>
                    Effect.fail(
                        PlatformError.badArgument({
                            description: "injected replacement failure",
                            method: "rename",
                            module: "FileSystem"
                        })
                    )
            };
            yield* failure(
                writeSetting(context, "server.path").pipe(
                    Effect.provideService(FileSystem.FileSystem, failingFs)
                ),
                /injected replacement failure/
            );
            assert.equal(yield* fs.readFileString(file), before);
            assert.deepEqual(yield* fs.readDirectory(path.dirname(file)), [ "config.json" ]);
        })
    ));

test("server precedence is explicit, saved, then actionable error", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            yield* failure(resolveServer(context), /--server.*config set server.path/);
            yield* fs.makeDirectory(path.join(root, "explicit"));
            yield* writeSetting(context, "server.path", root);
            assert.equal(yield* resolveServer(context), root);
            assert.equal(
                yield* resolveServer(context, "explicit"),
                path.join(root, "explicit")
            );
            yield* failure(resolveServer(context, "missing"), /Cannot access directory/);
            yield* fs.writeFileString(yield* configPath(context), "malformed");
            assert.equal(
                yield* resolveServer(context, "explicit"),
                path.join(root, "explicit")
            );
            yield* failure(resolveServer(context), /Invalid configuration/);
        })
    ));

test("world selection uses properties or override and rejects missing/unsafe worlds", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            for (const name of [ "A World", "other" ])
            {
                yield* fs.makeDirectory(path.join(root, "worlds", name), {
                    recursive: true
                });
            }

            yield* fs.writeFileString(
                path.join(root, "server.properties"),
                "# level-name=ignored\r\nlevel-name = A World\r\n"
            );
            assert.equal((yield* resolveWorld(context, root)).name, "A World");
            assert.equal(
                (yield* resolveWorld(context, root, "other")).directory,
                path.join(root, "worlds", "other")
            );
            yield* failure(resolveWorld(context, root, "missing"), /Cannot access directory/);
            for (const name of [ "", "..", "../escape", "C:\\escape", "a/b", "a\\b" ])
            {
                yield* failure(resolveWorld(context, root, name), /valid world name/);
            }

            yield* fs.remove(path.join(root, "server.properties"));
            yield* failure(resolveWorld(context, root), /server.properties.*--world/);
            assert.equal((yield* resolveWorld(context, root, "other")).name, "other");
        })
    ));

test("CLI help, version, config persistence and invalid arguments", () =>
    fixture(({ context, fs, path, root }) =>
        Effect.gen(function* ()
        {
            const entry: string = yield* path.fromFileUrl(
                new URL("../Distribution/index.js", import.meta.url)
            );
            const run: (...args: Array<string>) => {
                code: number | null;
                stdout: string;
                text: string;
            } = (...args: Array<string>) =>
            {
                const result = spawnSync(process.execPath, [ entry, ...args ], {
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

            for (const args of [
                [ "--help" ],
                [ "config", "--help" ],
                [ "config", "set", "--help" ]
            ])
            {
                const result: {
                    code: number | null;
                    stdout: string;
                    text: string;
                } = run(...args);
                assert.equal(result.code, 0, result.text);
                assert.match(result.text, /config/);
            }

            assert.match(run("--version").text, /0\.1\.0/);
            assert.deepEqual(JSON.parse(run("config", "get").stdout), {});
            assert.equal(yield* fs.exists(yield* configPath(context)), false);
            assert.equal(run("config", "set", "server.path", ".").code, 0);
            assert.equal(run("config", "get", "server.path").stdout.trim(), root);
            assert.equal(run("config", "set", "server.path", "--unset").code, 0);
            assert.deepEqual(JSON.parse(run("config", "get").stdout), {});
            for (const args of [
                [ "unknown" ],
                [ "--unknown" ],
                [ "config", "get", "bad" ],
                [ "config", "set", "server.path" ],
                [ "config", "set", "server.path", root, "--unset" ],
                [ "config", "set", "bad", root ],
                [ "config", "get", "server.path", "extra" ]
            ])
            {
                const result: {
                    code: number | null;
                    stdout: string;
                    text: string;
                } = run(...args);
                assert.notEqual(result.code, 0, `${args}: ${result.text}`);
            }

            yield* fs.writeFileString(yield* configPath(context), "{broken");
            const invalid: {
                code: number | null;
                stdout: string;
                text: string;
            } = run("config", "set", "server.path", root);
            assert.notEqual(invalid.code, 0);
            assert.match(invalid.text, /Invalid configuration/);
            assert.equal(yield* fs.readFileString(yield* configPath(context)), "{broken");
        })
    ));
