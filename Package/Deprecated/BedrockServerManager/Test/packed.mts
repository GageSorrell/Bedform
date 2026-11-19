/**
 * Build and install a tarball in a disposable directory, then exercise both bins.
 * Run through npm run test:pack so npm_execpath identifies the active npm CLI.
 *
 * @module bedrock-server-manager/Test/packed
 *
 * @file      packed.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Console, Effect, FileSystem, Path } from "effect";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { type SpawnSyncOptionsWithStringEncoding, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

Effect.scoped(
    Effect.gen(function* ()
    {
        const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
        const path: Path.Path = yield* Path.Path;
        const root: string = yield* fs.makeTempDirectoryScoped({
            prefix: "bds-packed-"
        });
        const source: string = yield* path.fromFileUrl(new URL("..", import.meta.url));
        const env: { BDS_CONFIG_PATH: string;
            NO_COLOR: string } = {
            ...process.env,
            BDS_CONFIG_PATH: path.join(root, "config.json"),
            NO_COLOR: "1"
        };
        const execute = (
            executable: string,
            args: Array<string>,
            cwd: string = root,
            extra: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {}
        ) =>
        {
            const result = spawnSync(executable, args, {
                cwd,
                encoding: "utf8",
                env,
                timeout: 120000,
                ...extra
            });
            assert.equal(result.error, undefined);
            assert.notEqual(result.status, null, result.stderr);
            return result;
        };

        const run: (
            executable: string,
            args: Array<string>,
            cwd?: string,
            extra?: Omit<SpawnSyncOptionsWithStringEncoding, "encoding">
        ) => string = (
            executable: string,
            args: Array<string>,
            cwd: string = root,
            extra: Omit<SpawnSyncOptionsWithStringEncoding, "encoding"> = {}
        ) =>
        {
            const result = execute(executable, args, cwd, extra);
            assert.equal(result.status, 0, result.stdout + result.stderr);
            return result.stdout;
        };

        assert.ok(process.env.npm_execpath, "Run using npm run test:pack");
        const npm: (...args: Array<string>) => string = (...args: Array<string>) =>
            run(process.execPath, [ process.env.npm_execpath ?? "npm", ...args ], source);
        const report = JSON.parse(npm("pack", "--json", "--pack-destination", root));
        const packed = Array.isArray(report) ? report[0] : Object.values(report)[0];
        assert.equal(packed.name, "bedrock-server-manager");
        const modules: (
            directory: string
        ) => Effect.Effect<Array<string>, unknown, FileSystem.FileSystem | Path.Path> = (
            directory: string
        ): Effect.Effect<Array<string>, unknown, FileSystem.FileSystem | Path.Path> =>
            Effect.gen(function* ()
            {
                const files: Array<string> = [];
                for (const name of yield* fs.readDirectory(
                    path.join(source, "Source", directory)
                ))
                {
                    const relative: string = directory ? `${directory}/${name}` : name;
                    const info: FileSystem.File.Info = yield* fs.stat(
                        path.join(source, "Source", relative)
                    );
                    if (info.type === "Directory")
                    {
                        files.push(...(yield* modules(relative)));
                    }
                    else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts"))
                    {
                        files.push(`Distribution/${relative.replace(/\.tsx?$/, ".js")}`);
                    }
                }

                return files;
            });
        const expected: Array<string> = [ "README.md", "package.json", ...(yield* modules("")) ];
        assert.deepEqual(
            packed.files.map((file: { path: string }) => file.path).sort(),
            expected.sort()
        );
        for (const file of packed.files)
        {
            assert.ok(
                file.path === "package.json" ||
                    file.path === "README.md" ||
                    file.path.startsWith("Distribution/"),
                `Unexpected package file: ${file.path}`
            );
        }

        const installation: string = path.join(root, "installation");
        npm(
            "install",
            "--prefix",
            installation,
            "--ignore-scripts",
            "--omit=dev",
            "--no-audit",
            "--no-fund",
            path.join(root, packed.filename)
        );
        const metadata = JSON.parse(
            yield* fs.readFileString(
                path.join(
                    installation,
                    "node_modules",
                    "bedrock-server-manager",
                    "package.json"
                )
            )
        );
        assert.deepEqual(metadata.exports, {});
        assert.deepEqual(Object.keys(metadata.bin).sort(), [ "bds", "bedrock-server-manager" ]);
        assert.ok(
            Object.values(metadata.bin).every(
                (value: unknown) => value === "./Distribution/index.js"
            )
        );
        assert.equal(metadata.type, "module");
        assert.equal(metadata.engines.node, ">=22");
        assert.equal(metadata.dependencies.effect, "4.0.5");
        assert.equal(metadata.dependencies["@effect/platform-node"], "4.0.5");
        assert.equal(metadata.dependencies["@effect/platform-node-shared"], "4.0.5");
        assert.equal(metadata.dependencies.ink, "7.1.1");
        assert.equal(metadata.dependencies.react, "19.2.9");
        assert.equal(metadata.dependencies["string-width"], "8.3.0");
        assert.equal(metadata.dependencies["ink-scroll-view"], "0.4.0");
        assert.equal(metadata.dependencies["@byteland/ink-scroll-bar"], "1.0.0");
        run(
            process.execPath,
            [
                "--input-type=module",
                "--eval",
                "await import('./node_modules/bedrock-server-manager/Distribution/console-frame.js');" +
                    "await import('./node_modules/bedrock-server-manager/Distribution/editor-input.js');" +
                    "await import('./node_modules/bedrock-server-manager/Distribution/completion-menu.js');" +
                    "await import('ink-scroll-view'); await import('@byteland/ink-scroll-bar');"
            ],
            installation
        );
        run(
            process.execPath,
            [
                "--input-type=module",
                "--eval",
                "import('bedrock-server-manager').then(() => process.exit(1), " +
                    "error => { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; })"
            ],
            installation
        );
        yield* fs.makeDirectory(path.join(root, "worlds", "Packed"), {
            recursive: true
        });
        yield* fs.makeDirectory(path.join(root, "worlds", "Other"), {
            recursive: true
        });
        yield* fs.writeFileString(path.join(root, "server.properties"), "level-name=Packed\n");
        yield* fs.makeDirectory(path.join(root, "source"));
        yield* fs.writeFileString(
            path.join(root, "source", "manifest.json"),
            JSON.stringify({
                format_version: 2,
                header: {
                    description: "Packed fixture",
                    min_engine_version: [ 1, 21, 0 ],
                    name: "Packed",
                    uuid: "44444444-4444-4444-4444-444444444444",
                    version: [ 1, 0, 0 ]
                },
                modules: [
                    {
                        type: "data",
                        uuid: "55555555-5555-5555-5555-555555555555",
                        version: [ 1, 0, 0 ]
                    }
                ]
            })
        );
        for (const name of [ "bds", "bedrock-server-manager" ])
        {
            const shim: string = path.join(
                installation,
                "node_modules",
                ".bin",
                name + (process.platform === "win32" ? ".cmd" : "")
            );
            assert.ok(yield* fs.exists(shim), `Missing executable: ${name}`);
            const command = (...args: Array<string>) =>
            {
                // Arguments are controlled fixture strings. Quote spaces for cmd shims
                // without expansion tokens.
                for (const arg of args)
                {
                    assert.doesNotMatch(arg, /["%!\r\n]/);
                }

                return process.platform === "win32"
                    ? execute(
                        process.env.ComSpec || "cmd.exe",
                        [
                            "/d",
                            "/s",
                            "/c",
                            `""${shim}" ${args.map((arg: string) => `"${arg}"`).join(" ")}"`
                        ],
                        root,
                        { windowsVerbatimArguments: true }
                    )
                    : execute(shim, args);
            };

            const invoke: (...args: Array<string>) => string = (...args: Array<string>) =>
            {
                const result = command(...args);
                assert.equal(
                    result.status,
                    0,
                    `${args.join(" ")}: ${result.stdout}${result.stderr}`
                );
                return result.stdout;
            };

            const reject = (...args: Array<string>) =>
            {
                const result = command(...args);
                assert.notEqual(result.status, 0, args.join(" "));
                return result;
            };

            assert.match(invoke("--version"), /0\.1\.0/);
            assert.match(invoke("--help"), /config/);
            assert.match(invoke("addon", "--help"), /export/);
            assert.match(invoke("config", "--help"), /get/);
            assert.deepEqual(JSON.parse(invoke("config", "get")), {});
            for (const subcommand of [
                "install",
                "list",
                "ls",
                "show",
                "validate",
                "enable",
                "disable",
                "update",
                "remove",
                "rm",
                "export"
            ])
            {
                assert.match(invoke("addon", subcommand, "--help"), /--server/);
            }

            for (const subcommand of [ "get", "set" ])
            {
                assert.match(invoke("config", subcommand, "--help"), /key/);
            }

            assert.equal(yield* fs.exists(env.BDS_CONFIG_PATH), false);
            const missingServer = reject("addon", "list");
            assert.match(missingServer.stdout + missingServer.stderr, /--server/);
            reject("--unknown");
            reject("addon", "install");
            reject("addon", "list", "-s", ".", "--scope", "invalid");
            reject("addon", "list", "-s", ".", "-w", "missing");
            reject("addon", "show", "missing", "-s", ".");
            reject("addon", "export", "Packed", "-s", ".");
            invoke("config", "set", "server.path", ".");
            assert.equal(invoke("config", "get", "server.path").trim(), root);
            assert.equal(JSON.parse(invoke("addon", "list", "--json")).server, root);
            reject("addon", "list", "-s", "missing");
            invoke("config", "set", "server.path", "--unset");
            yield* fs.remove(env.BDS_CONFIG_PATH);
            const inventory = JSON.parse(invoke("addon", "ls", "-s", ".", "--json"));
            assert.deepEqual(inventory.addons, []);
            assert.match(invoke("addon", "install", "source", "-s", "."), /Installed Packed/);
            reject("addon", "install", "source", "-s", ".");
            const shown = JSON.parse(invoke("addon", "show", "Packed", "-s", ".", "--json"));
            assert.equal(shown.members.length, 1);
            assert.equal(shown.source, path.join(root, "source"));
            assert.equal(
                shown.members[0].identity.uuid,
                "44444444-4444-4444-4444-444444444444"
            );
            assert.deepEqual(inventory.diagnostics, []);
            assert.match(invoke("addon", "disable", "Packed", "-s", "."), /Disabled Packed/);
            assert.match(invoke("addon", "enable", "Packed", "-s", "."), /Enabled Packed/);
            const activated = JSON.parse(invoke("addon", "ls", "-s", ".", "--json"));
            assert.equal(activated.addons[0].members[0].activation, "enabled");
            assert.equal(
                JSON.parse(invoke("addon", "validate", "-s", ".", "--json")).valid,
                true
            );
            const invalidFile: string = path.join(
                root,
                "worlds",
                "Packed",
                "world_behavior_packs.json"
            );
            const originalActivation: string = yield* fs.readFileString(invalidFile);
            yield* fs.writeFileString(invalidFile, "{broken");
            const invalid = reject("addon", "validate", "Packed", "-s", ".", "--json");
            assert.equal(invalid.status, 1);
            assert.equal(JSON.parse(invalid.stdout).valid, false);
            assert.equal(yield* fs.readFileString(invalidFile), "{broken");
            yield* fs.writeFileString(invalidFile, originalActivation);
            invoke("addon", "enable", "Packed", "-s", ".", "-w", "Other");
            const sourceFile: string = path.join(root, "source", "manifest.json");
            const sourceManifest = JSON.parse(yield* fs.readFileString(sourceFile));
            sourceManifest.header.version[0]++;
            sourceManifest.modules[0].version[0]++;
            yield* fs.writeFileString(sourceFile, JSON.stringify(sourceManifest));
            assert.match(invoke("addon", "update", "Packed", "-s", "."), /Updated Packed/);
            const updated = JSON.parse(invoke("addon", "ls", "-s", ".", "--json"));
            assert.deepEqual(
                updated.addons[0].members[0].identity.version,
                sourceManifest.header.version
            );
            const other = JSON.parse(
                invoke("addon", "show", "Packed", "-s", ".", "-w", "Other", "--json")
            );
            assert.equal(other.members[0].activation, "enabled");
            assert.deepEqual(other.members[0].identity.version, sourceManifest.header.version);
            const portable: string = `portable ${name}.mcaddon`;
            assert.match(
                invoke("addon", "export", "Packed", "-s", ".", "--output", portable),
                /Exported Packed/
            );
            const exported: Uint8Array = yield* fs.readFile(path.join(root, portable));
            reject("addon", "export", "Packed", "-s", ".", "--output", portable);
            assert.deepEqual(yield* fs.readFile(path.join(root, portable)), exported);
            assert.match(invoke("addon", "rm", "Packed", "-s", "."), /Removed Packed/);
            assert.match(
                invoke("addon", "install", portable, "-s", ".", "--no-enable"),
                /Installed Packed/
            );
            const restored = JSON.parse(invoke("addon", "ls", "-s", ".", "--json"));
            assert.equal(restored.addons[0].members[0].activation, "disabled");
            assert.deepEqual(
                restored.addons[0].members[0].identity.version,
                sourceManifest.header.version
            );
            assert.match(invoke("addon", "remove", "Packed", "-s", "."), /Removed Packed/);
            assert.deepEqual(
                JSON.parse(invoke("addon", "ls", "-s", ".", "--json")).addons,
                []
            );
            invoke(
                "addon",
                "install",
                portable,
                "-s",
                ".",
                "--scope",
                "world",
                "-w",
                "Other",
                "--no-enable"
            );
            const local = JSON.parse(
                invoke(
                    "addon",
                    "list",
                    "-s",
                    ".",
                    "-w",
                    "Other",
                    "--scope",
                    "world",
                    "--json"
                )
            );
            assert.equal(local.addons[0].members[0].scope, "world");
            assert.equal(local.addons[0].members[0].activation, "disabled");
            invoke("addon", "rm", "Packed", "-s", ".", "-w", "Other");
            reject("addon", "show", "Packed", "-s", ".");
            yield* Console.log(
                `Verified ${name}: help, errors, config, JSON and full addon lifecycle.`
            );
        }

        assert.equal(yield* fs.exists(env.BDS_CONFIG_PATH), false);
        yield* Console.log(
            "Packed contents and both installed executables passed smoke tests."
        );
    })
).pipe(Effect.provide(NodeServices.layer), NodeRuntime.runMain);
