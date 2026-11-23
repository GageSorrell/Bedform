/**
 * Machine-free prerequisite acceptance against the checkout's authoritative manifests.
 *
 * @module monorepo-setup/Test/Prerequisites.test
 *
 * @file      Prerequisites.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CheckInstallerExit, WithToolPaths } from "../Source/Prerequisites.js";
import { Consent, Prerequisites, Processes } from "../Source/Contract.js";
import { Effect, Layer } from "effect";
import type { ToolArtifact, ToolOutput } from "../Source/Prerequisite.js";
import { LoadPrerequisitePlan } from "../Source/PrerequisitePlan.js";
import { PrerequisiteHost } from "../Source/Prerequisite.js";
import { PrerequisiteLayer } from "../Source/Prerequisites.js";
import type { ProcessCommand } from "../Source/Contract.js";
import { RequestFor } from "./Fixture.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { win32 } from "node:path";

/**
 * Injects every machine probe and mutation while reading only checked local configuration.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Harness = () =>
{
    const request = RequestFor();
    const probes: Array<ProcessCommand> = [];
    const commands: Array<ProcessCommand> = [];
    const prompts: Array<string> = [];
    const downloads: Array<ToolArtifact> = [];
    const cleaned: Array<string> = [];
    const files = new Map<string, string>();
    const hashes = new Map<string, string>();
    const broken = new Set<string>();
    const outputs = new Map<string, ToolOutput>();
    const archives = new Set<string>();
    const state = {
        accept: true,
        archiveReady: true,
        assetsReady: true,
        component: true,
        consentError: "",
        exit: 0,
        repair: true,
        rust: "1.100.0",
        rustup: true,
        target: true,
        toolchain: true,
        vs: "complete"
    };
    let temporary = 0;
    const output = (stdout: string = "", code: number = 0): ToolOutput => ({ code,
        stderr: "",
        stdout });
    const host = {
        archive: (artifact: ToolArtifact, directory: string) =>
            Effect.sync(() =>
            {
                downloads.push(artifact);
                if (state.repair)
                {
                    archives.add(directory);
                }
            }),
        archiveReady: (_artifact: ToolArtifact, directory: string) =>
            Effect.succeed(state.archiveReady || archives.has(directory)),
        capture: (command: ProcessCommand) =>
            Effect.sync(() =>
            {
                probes.push(command);
                const name = win32.basename(command.executable).toLowerCase();
                const args = command.args;
                if (outputs.has(name))
                {
                    return outputs.get(name)!;
                }

                if (broken.has(name))
                {
                    return output("", 1);
                }

                if (name === "powershell.exe")
                {
                    const script = Buffer.from(args.at(-1)!, "base64").toString("utf16le");
                    return output(
                        JSON.stringify(
                            script.includes("Enter-VsDevShell")
                                ? {
                                    INCLUDE: "include",
                                    LIB: "lib",
                                    Path: "C:\\VS\\bin",
                                    VSCMD_ARG_TGT_ARCH: "x64",
                                    WindowsSDKVersion: "10.0.26100.0",
                                    WindowsSdkDir: "C:\\SDK"
                                }
                                : { machine: "C:\\machine tools",
                                    user: "C:\\new account tools" }
                        )
                    );
                }

                if (name === "vswhere.exe")
                {
                    return output(
                        JSON.stringify(
                            state.vs === "absent"
                                ? []
                                : [
                                    {
                                        installationPath: "C:\\VS existing",
                                        installationVersion: "18.0.0.0",
                                        isComplete: state.vs === "complete",
                                        isLaunchable: true
                                    }
                                ]
                        )
                    );
                }

                if (name === "git.exe")
                {
                    return output("git version 2.50.0.windows.1");
                }

                if (name === "winget.exe")
                {
                    return output("v1.12.0");
                }

                if (name === "cmake.exe")
                {
                    return output("cmake version 3.31.0");
                }

                if (name === "clang-cl.exe")
                {
                    return output("clang version 20\nTarget: x86_64-pc-windows-msvc");
                }

                if (name === "rustup.exe")
                {
                    if (!state.rustup)
                    {
                        return output("", 1);
                    }

                    if (args[0] === "--version")
                    {
                        return output("rustup 1.28.2");
                    }

                    if (args[0] === "toolchain")
                    {
                        return output(
                            state.toolchain
                                ? "stable-x86_64-pc-windows-msvc (default)\nnightly-x86_64-pc-windows-gnu"
                                : ""
                        );
                    }

                    if (args[0] === "component")
                    {
                        return output(
                            state.component
                                ? "rustfmt-x86_64-pc-windows-msvc\nclippy-x86_64-pc-windows-msvc"
                                : ""
                        );
                    }

                    if (args[0] === "target")
                    {
                        return output(state.target ? "wasm32-unknown-unknown" : "");
                    }

                    if (args.includes("rustc"))
                    {
                        return output(
                            `rustc ${state.rust} (fixture)\nhost: x86_64-pc-windows-msvc`
                        );
                    }

                    if (args.includes("cargo"))
                    {
                        return output(`cargo ${state.rust} (fixture)`);
                    }
                }

                if (name === "go.exe")
                {
                    return output("go version go1.27.3 windows/amd64");
                }

                if (name === "xmake.exe")
                {
                    return output("xmake v3.1.0");
                }

                if (name === "ffmpeg.exe")
                {
                    return output(
                        args.includes("-version")
                            ? "ffmpeg version 8.0"
                            : args.includes("-encoders")
                                ? " V..... libx264 H264"
                                : ""
                    );
                }

                if (name === "ffprobe.exe")
                {
                    return output("{\"streams\":[{\"codec_name\":\"h264\"}]}");
                }

                if (name === "cl.exe" || name === "toolchain.exe" || name.endsWith("-check.exe"))
                {
                    return output();
                }

                throw new Error(`Unexpected probe: ${name} ${args.join(" ")}`);
            }),
        cleanup: (directory: string) =>
            Effect.sync(() =>
            {
                cleaned.push(directory);
            }),
        exists: (file: string) => Effect.succeed(state.assetsReady || hashes.has(file)),
        file: (artifact: ToolArtifact, file: string) =>
            Effect.sync(() =>
            {
                downloads.push(artifact);
                hashes.set(file, artifact.gitBlob ?? artifact.sha256!);
            }),
        hash: (file: string) =>
            Effect.sync(() =>
            {
                if (hashes.has(file))
                {
                    return hashes.get(file)!;
                }

                const inventory = JSON.parse(
                    readFileSync(win32.join(request.paths.source, "Bedform/import.json"), "utf8")
                );
                return inventory.excluded.find(
                    (entry: { path: string }) =>
                        win32.join(request.paths.source, entry.path) === file
                ).sha as string;
            }),
        read: (file: string) =>
            Effect.try({
                catch: (error: unknown) => new Error(String(error)),
                try: () => files.get(file) ?? readFileSync(file, "utf8")
            }),
        temporary: Effect.sync(() => `C:\\temporary fixture\\${++temporary}`),
        write: () => Effect.void
    };
    const dependencies = Layer.mergeAll(
        Layer.succeed(PrerequisiteHost, host),
        Layer.succeed(Consent, {
            confirm: (message: string) =>
                Effect.suspend(() =>
                {
                    prompts.push(message);
                    return state.consentError === ""
                        ? Effect.succeed(state.accept)
                        : Effect.fail(new Error(state.consentError));
                })
        }),
        Layer.succeed(Processes, {
            run: (command: ProcessCommand) =>
                Effect.sync(() =>
                {
                    commands.push(command);
                    if (state.repair && state.exit === 0)
                    {
                        broken.clear();
                        outputs.clear();
                        state.vs = "complete";
                        state.rustup = true;
                        state.toolchain = true;
                        state.component = true;
                        state.target = true;
                        state.rust = "1.100.0";
                    }

                    return state.exit;
                })
        })
    );
    const run = () =>
        Effect.runPromise(
            Effect.gen(function* ()
            {
                const prerequisites = yield* Prerequisites;
                return yield* prerequisites.prepare(request);
            }).pipe(Effect.provide(PrerequisiteLayer.pipe(Layer.provide(dependencies))))
        );
    return {
        archives,
        broken,
        cleaned,
        commands,
        dependencies,
        downloads,
        files,
        hashes,
        host,
        outputs,
        probes,
        prompts,
        request,
        run,
        state
    };
};

test("all tools present preserve account/defaults and reuse the exact installed Rust release", async () =>
{
    const fixture = Harness();
    const environment = await fixture.run();
    assert.equal(fixture.commands.length, 0);
    assert.equal(fixture.prompts.length, 0);
    assert.equal(environment.RUSTUP_TOOLCHAIN, "stable-x86_64-pc-windows-msvc");
    assert.match(environment.PATH!, /new account tools/);
    assert.match(environment.PATH!, /original home\\.cargo\\bin/);
    assert.equal(environment.GOTOOLCHAIN, "local");
    assert.equal(environment.RUSTUP_AUTO_INSTALL, "0");
    assert.equal(fixture.cleaned.length, 4);
    assert.ok(
        fixture.probes.every(
            (command: ProcessCommand) => command.cwd === fixture.request.paths.originalCwd
        )
    );
    assert.ok(
        fixture.probes.every(
            (command: ProcessCommand) => command.environment.RUSTUP_AUTO_INSTALL === "0"
        )
    );
});

for (const tool of [
    "git.exe",
    "go.exe",
    "xmake.exe",
    "ffmpeg.exe",
    "ffprobe.exe",
    "cmake.exe",
    "clang-cl.exe",
    "cl.exe"
])
{
    test(`broken ${tool} requires consent, repair and an actual recheck`, async () =>
    {
        const fixture = Harness();
        fixture.broken.add(tool);
        await fixture.run();
        assert.equal(fixture.commands.length, 1);
        assert.equal(fixture.prompts.length, 1);
        assert.ok(
            fixture.probes.filter(
                (command: ProcessCommand) => win32.basename(command.executable) === tool
            ).length >= 2
        );
    });
}

for (const vs of [ "incomplete", "absent" ])
{
    test(`${vs} VS uses the selected install or modify path with SDK/CMake components`, async () =>
    {
        const fixture = Harness();
        fixture.state.vs = vs;
        await fixture.run();
        const command = fixture.commands[0]!;
        assert.ok(
            command.args.join(" ").includes("Microsoft.VisualStudio.Component.VC.CMake.Project")
        );
        assert.ok(command.args.includes(vs === "incomplete" ? "modify" : "--override"));
        if (vs === "incomplete")
        {
            assert.ok(command.args.includes("C:\\VS existing"));
        }
    });
}

for (const mode of [
    "declined",
    "noninteractive",
    "canceled",
    "winget",
    "failed",
    "restart",
    "still broken"
])
{
    test(`${mode} stops before later prerequisite changes`, async () =>
    {
        const fixture = Harness();
        fixture.broken.add("git.exe");
        if (mode === "declined")
        {
            fixture.state.accept = false;
        }

        if (mode === "noninteractive" || mode === "canceled")
        {
            fixture.state.consentError = mode;
        }

        if (mode === "winget")
        {
            fixture.broken.add("winget.exe");
        }

        if (mode === "failed")
        {
            fixture.state.exit = 5;
        }

        if (mode === "restart")
        {
            fixture.state.exit = 3010;
        }

        if (mode === "still broken")
        {
            fixture.state.repair = false;
        }

        await assert.rejects(
            fixture.run(),
            /declined|noninteractive|canceled|WinGet|failed|restart|still missing/
        );
        assert.equal(fixture.downloads.length, 0);
        assert.equal(
            fixture.probes.some((command: ProcessCommand) => command.executable === "go.exe"),
            false
        );
    });
}

for (const missing of [ "rustup", "toolchain", "component", "target" ] as const)
{
    test(`missing Rust ${missing} is consented without changing defaults`, async () =>
    {
        const fixture = Harness();
        fixture.state[missing] = false;
        await fixture.run();
        assert.equal(fixture.commands.length, 1);
        assert.equal(fixture.prompts.length, 1);
        assert.ok(!fixture.commands[0]!.args.includes("default"));
        assert.ok(!fixture.commands[0]!.args.includes("--default-host"));
        if (missing === "rustup")
        {
            assert.match(fixture.downloads[0]!.sha256!, /^[a-f0-9]{64}$/);
            assert.equal(fixture.cleaned.length, 5);
        }

        if (missing === "toolchain")
        {
            assert.ok(fixture.commands[0]!.args.includes("1.100.0-x86_64-pc-windows-msvc"));
            assert.ok(fixture.commands[0]!.args.includes("--no-self-update"));
        }
    });
}

test("wrong installed Rust is replaced only with consent and checked again", async () =>
{
    const fixture = Harness();
    fixture.state.rust = "1.99.0";
    await fixture.run();
    assert.equal(fixture.commands.length, 1);
});

test("local channel is authoritative rather than a hard-coded installer channel", async () =>
{
    const fixture = Harness();
    for (const file of [ "rust-toolchain.toml", "Bedform/compatibility.json" ])
    {
        const name = win32.join(fixture.request.paths.source, file);
        fixture.files.set(name, readFileSync(name, "utf8").replaceAll("1.100.0", "1.101.0"));
    }

    fixture.state.rust = "1.101.0";
    await fixture.run();
    assert.equal(fixture.commands.length, 0);
});

test("missing SDK, runtime assets and Mojang samples have distinct consent and rechecks", async () =>
{
    const fixture = Harness();
    fixture.state.archiveReady = false;
    fixture.state.assetsReady = false;
    await fixture.run();
    assert.equal(fixture.prompts.length, 4);
    assert.equal(fixture.archives.size, 3);
    assert.ok(fixture.prompts.some((message: string) => /EULA/.test(message)));
    assert.ok(
        fixture.downloads.every((artifact: ToolArtifact) => artifact.sha256 || artifact.gitBlob)
    );
    assert.equal(fixture.commands.length, 0);
});

test("corrupt or locally edited data inputs are preserved and stop setup", async () =>
{
    const fixture = Harness();
    const plan = await Effect.runPromise(
        LoadPrerequisitePlan(fixture.request.paths).pipe(Effect.provide(fixture.dependencies))
    );
    fixture.hashes.set(win32.join(fixture.request.paths.source, plan.assets[0]!.path), "edited");
    await assert.rejects(fixture.run(), /will not overwrite/);
    assert.equal(fixture.downloads.length, 0);
});

test("SDK that remains corrupt after acquisition cannot be accepted", async () =>
{
    const fixture = Harness();
    fixture.state.archiveReady = false;
    fixture.state.repair = false;
    await assert.rejects(fixture.run(), /incomplete or corrupt/);
    assert.equal(fixture.prompts.length, 1);
});

for (const file of [
    "rust-toolchain.toml",
    "Bedform/compatibility.json",
    "Bedform/prerequisites.json",
    "go.work"
])
{
    test(`missing or inconsistent local ${file} fails before any machine probe or download`, async () =>
    {
        const fixture = Harness();
        fixture.files.set(win32.join(fixture.request.paths.source, file), "incomplete");
        await assert.rejects(fixture.run(), /Local prerequisite preflight failed/);
        assert.equal(fixture.probes.length, 0);
        assert.equal(fixture.commands.length, 0);
        assert.equal(fixture.prompts.length, 0);
        assert.equal(fixture.downloads.length, 0);
    });
}

test("Windows environment merge removes duplicate PATH spellings and reboot statuses stop", () =>
{
    assert.deepEqual(
        WithToolPaths({ HOME: "original",
            Path: "C:\\TOOLS;C:\\other" }, [ "c:\\tools" ]),
        { HOME: "original",
            PATH: "c:\\tools;C:\\other" }
    );
    for (const code of [ 3010, 1641, 0x8a150109 | 0, 0x80070bc2 | 0 ])
    {
        assert.throws(() => CheckInstallerExit(code, "fixture"), /restart/);
    }
});

for (const [ name, stdout ] of [
    [ "go.exe", "go version go1.25.0 windows/amd64" ],
    [ "go.exe", "go version go1.27.3 windows/arm64" ],
    [ "xmake.exe", "xmake v2.9.0" ],
    [ "cmake.exe", "cmake version 3.20.0" ],
    [ "clang-cl.exe", "clang version 20\nTarget: x86_64-pc-windows-gnu" ],
    [ "ffmpeg.exe", "ffmpeg version 8.0\n encoders: unavailable" ],
    [ "ffprobe.exe", "{\"streams\":[{\"codec_name\":\"vp9\"}]}" ]
] as const)
{
    test(`incompatible tool output ${stdout} requires repair and capability rechecks`, async () =>
    {
        const fixture = Harness();
        fixture.outputs.set(name, { code: 0,
            stderr: "",
            stdout });
        await fixture.run();
        assert.equal(fixture.commands.length, 1);
        assert.equal(fixture.prompts.length, 1);
    });
}

test("rustup download installer failure still cleans its scoped installer directory", async () =>
{
    const fixture = Harness();
    fixture.state.rustup = false;
    fixture.state.exit = 5;
    await assert.rejects(fixture.run(), /rustup failed/);
    assert.equal(fixture.downloads.length, 1);
    assert.equal(fixture.cleaned.length, 2);
});

test("a declined SDK download cannot acquire assets or start installers", async () =>
{
    const fixture = Harness();
    fixture.state.archiveReady = false;
    fixture.state.accept = false;
    await assert.rejects(fixture.run(), /declined/);
    assert.equal(fixture.commands.length, 0);
    assert.equal(fixture.downloads.length, 0);
});

for (const language of [ "rust", "go" ])
{
    test(`${language} version alone cannot establish compiler/linker usability`, async () =>
    {
        const fixture = Harness();
        fixture.outputs.set(`${language}-check.exe`, { code: 1,
            stderr: "broken runtime",
            stdout: "" });
        await assert.rejects(fixture.run(), /failed compile\/link\/run/);
        assert.equal(fixture.commands.length, 0);
        assert.equal(fixture.downloads.length, 0);
        assert.ok(fixture.cleaned.length >= 2);
    });
}

test("a BDS mismatch fails before tool probes or installation", async () =>
{
    const fixture = Harness();
    const file = win32.join(fixture.request.paths.source, "assets/bedrock-target.json");
    const target = JSON.parse(readFileSync(file, "utf8"));
    target.server_version = "unsupported";
    fixture.files.set(file, JSON.stringify(target));
    await assert.rejects(fixture.run(), /compatibility tuple/);
    assert.equal(fixture.probes.length, 0);
});
