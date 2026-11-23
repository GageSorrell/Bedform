/**
 * Consented prerequisite preparation with usable probes, pinned Rust and post-install rechecks.
 *
 * @module monorepo-setup/Prerequisites
 *
 * @file      Prerequisites.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { AtLeast, LoadPrerequisitePlan, LocalRecord, LocalString } from "./PrerequisitePlan.js";
import { Cause, Effect, Layer } from "effect";
import { Consent, Prerequisites, Processes } from "./Contract.js";
import type { PrerequisitePlan, ToolEnvironment, ToolOutput } from "./Prerequisite.js";
import { Buffer } from "node:buffer";
import { EnvironmentVariable } from "./keys.js";
import { IsAbsolutePath } from "./Permissions.js";
import { PrerequisiteHost } from "./Prerequisite.js";
import type { Request } from "./Contract.js";
import { win32 } from "node:path";

/**
 * Reads an environment value with Windows' case-insensitive name semantics.
 *
 * @category Getter
 * @since 1.0.0
 */
export const EnvironmentValue = (environment: ToolEnvironment, name: string): string | undefined =>
    Object.entries(environment).find(([ key ]: [string, string | undefined]) =>
        key.toUpperCase() === name.toUpperCase())?.[1];

/**
 * Updates tool paths without duplicate Path/PATH entries or changes to account identity.
 *
 * @category Merging
 * @since 1.0.0
 */
export const WithToolPaths = (
    environment: ToolEnvironment,
    paths: ReadonlyArray<string>
): ToolEnvironment =>
{
    const entries = Object.entries(environment).filter(([ key ]: [string, string | undefined]) =>
        key.toUpperCase() !== "PATH");
    const unique = new Map<string, string>();
    for (const entry of [ ...paths, ...(EnvironmentValue(environment, "PATH") ?? "").split(";") ])
    {
        if (entry !== "" && !unique.has(entry.toLowerCase()))
        {
            unique.set(entry.toLowerCase(), entry);
        }
    }

    return { ...Object.fromEntries(entries),
        PATH: [ ...unique.values() ].join(";") };
};

/**
 * Fixed PowerShell transport; variable paths are passed only as environment data.
 *
 * @category Converting
 * @since 1.0.0
 */
const PowerShellCommand = (request: Request, environment: ToolEnvironment, script: string) => ({
    args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(script, "utf16le").toString("base64")
    ],
    cwd: request.paths.originalCwd,
    environment,
    executable: win32.join(
        EnvironmentValue(environment, "SystemRoot") ?? "C:\\Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe"
    )
});

/**
 * A read-only registry PATH refresh; never writes a user's PATH or global tool defaults.
 *
 * @category Configuration
 * @since 1.0.0
 */
const RefreshScript =
    "@{machine=[Environment]::GetEnvironmentVariable('Path','Machine');" +
    "user=[Environment]::GetEnvironmentVariable('Path','User')} | ConvertTo-Json -Compress";

/**
 * Initializes a discovered Visual Studio environment, emitting only compiler/SDK tool values.
 *
 * @category Configuration
 * @since 1.0.0
 */
const DeveloperScript = `$ErrorActionPreference='Stop'
$root=$env:${EnvironmentVariable.VisualStudio}
Import-Module (Join-Path $root 'Common7/Tools/Microsoft.VisualStudio.DevShell.dll')
$arguments='-no_logo -arch=x64 -host_arch=x64'
Enter-VsDevShell -VsInstallPath $root -SkipAutomaticLocation -DevCmdArguments $arguments 6>$null | Out-Null
$result=@{}
foreach($key in @('Path','INCLUDE','LIB','LIBPATH','VSINSTALLDIR','VCINSTALLDIR','VCToolsInstallDir',
 'WindowsSdkDir','WindowsSDKVersion','VSCMD_ARG_TGT_ARCH')) {
 $value=[Environment]::GetEnvironmentVariable($key); if($value){$result[$key]=$value}
}
$result | ConvertTo-Json -Compress`;

/**
 * Captures a tool probe without allowing missing executables to trigger an implicit installer.
 *
 * @category Testing
 * @since 1.0.0
 */
const Probe = (
    request: Request,
    environment: ToolEnvironment,
    executable: string,
    args: ReadonlyArray<string>
) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        return yield* host
            .capture({ args,
                cwd: request.paths.originalCwd,
                environment,
                executable })
            .pipe(
                Effect.catch((error: Error) =>
                    Effect.succeed({ code: -1,
                        stderr: error.message,
                        stdout: "" })
                )
            );
    });

/**
 * Refreshes only child discovery, including original-account Rust and WinGet link locations.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Refresh = (request: Request, environment: ToolEnvironment) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const output = yield* host.capture(PowerShellCommand(request, environment, RefreshScript));
        if (output.code !== 0)
        {
            return yield* Effect.fail(
                new Error(`Cannot refresh prerequisite PATH: ${output.stderr}`)
            );
        }

        const paths = LocalRecord(JSON.parse(output.stdout));
        const cargo =
            EnvironmentValue(environment, "CARGO_HOME") ??
            win32.join(request.account.home, ".cargo");
        const local =
            EnvironmentValue(environment, "LOCALAPPDATA") ??
            win32.join(request.account.home, "AppData/Local");
        return WithToolPaths(environment, [
            win32.join(cargo, "bin"),
            win32.join(local, "Microsoft/WinGet/Links"),
            ...[ paths.user, paths.machine ]
                .filter((value: unknown): value is string => typeof value === "string")
                .flatMap((value: string) => value.split(";"))
        ]);
    });

/**
 * Requests one explicit required change; cancellation and noninteractive refusal remain errors.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const Approve = (message: string) =>
    Effect.gen(function* ()
    {
        const consent = yield* Consent;
        if (!(yield* consent.confirm(message)))
        {
            return yield* Effect.fail(new Error(`Required prerequisite declined: ${message}`));
        }
    });

/**
 * Interprets installers, including wrapped Windows reboot-required status codes.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category ErrorHandling
 * @since 1.0.0
 */
export const CheckInstallerExit = (code: number, name: string): void =>
{
    const unsigned = code >>> 0;
    if (
        code === 3_010 ||
        code === 1_641 ||
        unsigned === 0x8a_15_01_09 ||
        unsigned === 0x8a_15_01_0a ||
        unsigned === 0x80_07_0b_c2 ||
        unsigned === 0x80_07_06_69
    )
    {
        throw new Error(`${name} requires a Windows restart. Restart and rerun setup.`);
    }

    if (code !== 0)
    {
        throw new Error(`${name} failed or was canceled (exit ${code}); setup stopped.`);
    }
};

/**
 * Installs only a consented WinGet package; WinGet retains its signature/checksum verification.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const WinGet = (
    request: Request,
    environment: ToolEnvironment,
    id: string,
    extra: ReadonlyArray<string> = []
) =>
    Effect.gen(function* ()
    {
        const winget = yield* Probe(request, environment, "winget.exe", [ "--version" ]);
        if (winget.code !== 0 || !/^v?\d+\./.test(winget.stdout.trim()))
        {
            return yield* Effect.fail(
                new Error(
                    "WinGet is required for this installation. Install Microsoft's " +
                        "App Installer manually, reopen the terminal and rerun. " +
                        "Setup does not bootstrap WinGet."
                )
            );
        }

        const processes = yield* Processes;
        const code = yield* processes.run({
            args: [
                "install",
                "--id",
                id,
                "--exact",
                "--source",
                "winget",
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--disable-interactivity",
                ...extra
            ],
            cwd: request.paths.originalCwd,
            environment,
            executable: "winget.exe"
        });
        CheckInstallerExit(code, id);
    });

/**
 * Uses real version output, installs if approved and rejects a still-broken or stale replacement.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const EnsureTool = (
    request: Request,
    environment: ToolEnvironment,
    name: string,
    args: ReadonlyArray<string>,
    usable: (output: ToolOutput) => boolean,
    id: string
) =>
    Effect.gen(function* ()
    {
        if (usable(yield* Probe(request, environment, name, args)))
        {
            return environment;
        }

        yield* Approve(
            `Install or repair ${id} using WinGet and accept its package/source licenses? ` +
                "The refreshed tool will be verified before continuing."
        );
        yield* WinGet(request, environment, id, [ "--force" ]);
        const refreshed = yield* Refresh(request, environment);
        if (!usable(yield* Probe(request, refreshed, name, args)))
        {
            return yield* Effect.fail(
                new Error(`${name} is still missing, broken or incompatible after installation.`)
            );
        }

        return refreshed;
    });

/**
 * Checks actual compiler/SDK linkage and CMake/Clang availability inside a discovered VS environment.
 *
 * @category Testing
 * @since 1.0.0
 */
const NativeTools = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const vswhere = win32.join(
            EnvironmentValue(environment, "ProgramFiles(x86)") ?? "C:\\Program Files (x86)",
            "Microsoft Visual Studio/Installer/vswhere.exe"
        );
        const discovery = yield* Probe(request, environment, vswhere, [
            "-all",
            "-products",
            "*",
            "-format",
            "json",
            "-utf8"
        ]);
        const candidates = discovery.code === 0 ? JSON.parse(discovery.stdout) : [];
        if (!Array.isArray(candidates))
        {
            throw new Error("vswhere returned malformed installation data.");
        }

        let incomplete: string | undefined;
        for (const entry of candidates)
        {
            const candidate = LocalRecord(entry);
            const path = LocalString(candidate.installationPath);
            if (
                !IsAbsolutePath(path) ||
                typeof candidate.installationVersion !== "string" ||
                !AtLeast(candidate.installationVersion.split(".").slice(0, 3).join("."), "17.0.0")
            )
            {
                continue;
            }

            incomplete ??= path;
            if (candidate.isComplete !== true || candidate.isLaunchable !== true)
            {
                continue;
            }

            const developer = yield* host
                .capture(
                    PowerShellCommand(
                        request,
                        { ...environment,
                            [EnvironmentVariable.VisualStudio]: path },
                        DeveloperScript
                    )
                )
                .pipe(Effect.catch(() => Effect.succeed({ code: -1,
                    stderr: "",
                    stdout: "" })));
            if (developer.code !== 0)
            {
                continue;
            }

            const values = LocalRecord(JSON.parse(developer.stdout));
            const allowed = [
                "INCLUDE",
                "LIB",
                "LIBPATH",
                "VSINSTALLDIR",
                "VCINSTALLDIR",
                "VCToolsInstallDir",
                "WindowsSdkDir",
                "WindowsSDKVersion",
                "VSCMD_ARG_TGT_ARCH"
            ];
            const toolValues = Object.fromEntries(
                allowed
                    .filter((key: string) => typeof values[key] === "string")
                    .map((key: string) => [ key, values[key] as string ])
            );
            const refreshed = WithToolPaths({ ...environment,
                ...toolValues }, [
                win32.join(path, "Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin"),
                win32.join(path, "VC/Tools/Llvm/x64/bin"),
                win32.join(path, "VC/Tools/Llvm/bin"),
                ...String(values.Path ?? values.PATH ?? "").split(";")
            ]);
            if (
                toolValues.VSCMD_ARG_TGT_ARCH !== "x64" ||
                !toolValues.WindowsSdkDir ||
                !toolValues.WindowsSDKVersion ||
                !toolValues.INCLUDE ||
                !toolValues.LIB
            )
            {
                continue;
            }

            const cmake = yield* Probe(request, refreshed, "cmake.exe", [ "--version" ]);
            const cmakeVersion = /cmake version (\d+\.\d+\.\d+)/.exec(cmake.stdout)?.[1];
            const clang = yield* Probe(request, refreshed, "clang-cl.exe", [ "--version" ]);
            if (
                cmake.code !== 0 ||
                cmakeVersion === undefined ||
                !AtLeast(cmakeVersion, plan.cmake) ||
                clang.code !== 0 ||
                !/Target: x86_64-pc-windows-msvc/.test(clang.stdout)
            )
            {
                continue;
            }

            const linked = yield* Effect.acquireUseRelease(
                host.temporary,
                (directory: string) =>
                    Effect.gen(function* ()
                    {
                        const file = win32.join(directory, "toolchain.cpp");
                        yield* host.write(
                            file,
                            "#include <windows.h>\n#include <d3d12.h>\n#include <string>\n" +
                                "#pragma comment(lib, \"d3d12.lib\")\n" +
                                "int main(){std::string value=\"sdk\"; " +
                                "return GetCurrentProcessId() && value.size()==3 ? 0:1;}\n"
                        );
                        const executable = win32.join(directory, "toolchain.exe");
                        const compile = yield* Probe(request, refreshed, "cl.exe", [
                            "/nologo",
                            "/EHsc",
                            file,
                            `/Fo${win32.join(directory, "toolchain.obj")}`,
                            `/Fe${executable}`
                        ]);
                        return (
                            compile.code === 0 &&
                            (yield* Probe(request, refreshed, executable, [])).code === 0
                        );
                    }),
                (directory: string) => host.cleanup(directory).pipe(Effect.orDie)
            );
            if (linked)
            {
                return { environment: refreshed,
                    installation: path,
                    ready: true };
            }
        }

        return { environment,
            installation: incomplete,
            ready: false };
    });

/**
 * Installs or modifies a VS installation without replacing a complete supported installation.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const EnsureNative = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const native = yield* NativeTools(request, environment, plan);
        if (native.ready)
        {
            return native.environment;
        }

        yield* Approve(
            `${
                native.installation === undefined
                    ? "Install Visual Studio 2022 Build Tools"
                    : `Modify Visual Studio at ${native.installation}`
            } with C++ compiler, Windows SDK, CMake and Clang? ` +
                "This may request Windows administrator approval."
        );
        const additions = plan.policy.visualStudioComponents.flatMap((component: string) => [
            "--add",
            component
        ]);
        const override = [ "--passive", "--wait", "--norestart", ...additions ].join(" ");
        if (native.installation === undefined)
        {
            yield* WinGet(request, environment, plan.policy.winget.visualStudio, [
                "--override",
                override
            ]);
        }
        else
        {
            const processes = yield* Processes;
            const executable = win32.join(
                EnvironmentValue(environment, "ProgramFiles(x86)") ?? "C:\\Program Files (x86)",
                "Microsoft Visual Studio/Installer/setup.exe"
            );
            CheckInstallerExit(
                yield* processes.run({
                    args: [
                        "modify",
                        "--installPath",
                        native.installation,
                        "--passive",
                        "--wait",
                        "--norestart",
                        ...additions
                    ],
                    cwd: request.paths.originalCwd,
                    environment,
                    executable
                }),
                "Visual Studio components"
            );
        }

        const checked = yield* NativeTools(request, yield* Refresh(request, environment), plan);
        if (!checked.ready)
        {
            return yield* Effect.fail(
                new Error(
                    "Visual Studio compiler/SDK/CMake/Clang remains unusable after " +
                        "installation. Reopen the intended account's terminal " +
                        "or repair the listed components."
                )
            );
        }

        return checked.environment;
    });

/**
 * Verifies an already installed MSVC compiler without invoking a downloading rustup shim.
 *
 * @category Testing
 * @since 1.0.0
 */
const InstalledRust = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const list = yield* Probe(request, environment, "rustup.exe", [ "toolchain", "list" ]);
        if (list.code !== 0)
        {
            return undefined;
        }

        const desired = plan.rust.channel.endsWith("-x86_64-pc-windows-msvc")
            ? plan.rust.channel
            : `${plan.rust.channel}-x86_64-pc-windows-msvc`;
        const installed = list.stdout
            .split(/\r?\n/)
            .map((line: string) => line.trim().split(/\s+/)[0])
            .filter((name: string) => name.endsWith("-x86_64-pc-windows-msvc"));
        const ordered = [ ...new Set([ desired, ...installed ]) ].filter((name: string) =>
            installed.includes(name)
        );
        const exact = /^(\d+\.\d+\.\d+)/.exec(plan.rust.channel)?.[1];
        for (const toolchain of ordered)
        {
            if (exact === undefined && toolchain !== desired)
            {
                continue;
            }

            const compiler = yield* Probe(request, environment, "rustup.exe", [
                "run",
                toolchain,
                "rustc",
                "-vV"
            ]);
            const cargo = yield* Probe(request, environment, "rustup.exe", [
                "run",
                toolchain,
                "cargo",
                "--version"
            ]);
            const version = /^rustc (\d+\.\d+\.\d+)/.exec(compiler.stdout)?.[1];
            if (
                compiler.code === 0 &&
                cargo.code === 0 &&
                version !== undefined &&
                AtLeast(version, plan.rust.minimum) &&
                (exact === undefined || version === exact) &&
                /host: x86_64-pc-windows-msvc/.test(compiler.stdout) &&
                (exact === undefined
                    ? /^cargo \d+\./.test(cargo.stdout)
                    : cargo.stdout.startsWith(`cargo ${exact} `))
            )
            {
                return toolchain;
            }
        }

        return undefined;
    });

/**
 * Preserves defaults while installing only the missing pinned host toolchain, components and targets.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const EnsureRust = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const processes = yield* Processes;
        let refreshed = environment;
        const rustup = yield* Probe(request, refreshed, "rustup.exe", [ "--version" ]);
        if (rustup.code !== 0 || !/^rustup \d+\./.test(rustup.stdout))
        {
            yield* Approve(
                "Install official rustup for this account from the locally SHA-256-pinned installer? " +
                    "No global default toolchain or persistent PATH will be changed."
            );
            yield* Effect.acquireUseRelease(
                host.temporary,
                (directory: string) =>
                    Effect.gen(function* ()
                    {
                        const installer = win32.join(directory, "rustup-init.exe");
                        yield* host.file(plan.policy.rustup, installer);
                        CheckInstallerExit(
                            yield* processes.run({
                                args: [ "-y", "--no-modify-path", "--default-toolchain", "none" ],
                                cwd: request.paths.originalCwd,
                                environment: refreshed,
                                executable: installer
                            }),
                            "rustup"
                        );
                    }),
                (directory: string) => host.cleanup(directory).pipe(Effect.orDie)
            );
            refreshed = yield* Refresh(request, refreshed);
            const checked = yield* Probe(request, refreshed, "rustup.exe", [ "--version" ]);
            if (checked.code !== 0 || !/^rustup \d+\./.test(checked.stdout))
            {
                return yield* Effect.fail(
                    new Error("rustup is still unusable after installation.")
                );
            }
        }

        let selected = yield* InstalledRust(request, refreshed, plan);
        if (selected === undefined)
        {
            const channel = plan.rust.channel.endsWith("-x86_64-pc-windows-msvc")
                ? plan.rust.channel
                : `${plan.rust.channel}-x86_64-pc-windows-msvc`;
            yield* Approve(
                `Install missing Rust ${channel} with profile ${plan.rust.profile}, components ` +
                    `${plan.rust.components.join(", ") || "none"} and targets ` +
                    `${plan.rust.targets.join(", ") || "none"}? ` +
                    "Existing toolchains and the global default will be retained."
            );
            CheckInstallerExit(
                yield* processes.run({
                    args: [
                        "toolchain",
                        "install",
                        channel,
                        "--profile",
                        plan.rust.profile,
                        "--no-self-update",
                        ...plan.rust.components.flatMap((component: string) => [
                            "--component",
                            component
                        ]),
                        ...plan.rust.targets.flatMap((target: string) => [ "--target", target ])
                    ],
                    cwd: request.paths.originalCwd,
                    environment: refreshed,
                    executable: "rustup.exe"
                }),
                "Pinned Rust toolchain"
            );
            refreshed = yield* Refresh(request, refreshed);
            selected = yield* InstalledRust(request, refreshed, plan);
            if (selected === undefined)
            {
                return yield* Effect.fail(
                    new Error("Installed Rust/Cargo does not match the pinned MSVC toolchain.")
                );
            }
        }

        for (const [ kind, required ] of [
            [ "component", plan.rust.components ],
            [ "target", plan.rust.targets ]
        ] as const)
        {
            const installed = yield* Probe(request, refreshed, "rustup.exe", [
                kind,
                "list",
                "--installed",
                "--toolchain",
                selected
            ]);
            if (installed.code !== 0)
            {
                return yield* Effect.fail(new Error(`Cannot inspect pinned Rust ${kind}s.`));
            }

            const names = installed.stdout
                .split(/\r?\n/)
                .map((line: string) => line.trim().split(/\s+/)[0]);
            const missing = required.filter(
                (name: string) =>
                    !names.includes(name) &&
                    !(kind === "component" && names.includes(`${name}-x86_64-pc-windows-msvc`))
            );
            if (missing.length > 0)
            {
                yield* Approve(
                    `Install missing Rust ${kind}s ${missing.join(", ")} for ${selected}?`
                );
                CheckInstallerExit(
                    yield* processes.run({
                        args: [ kind, "add", "--toolchain", selected, ...missing ],
                        cwd: request.paths.originalCwd,
                        environment: refreshed,
                        executable: "rustup.exe"
                    }),
                    `Rust ${kind}s`
                );
                const checked = yield* Probe(request, refreshed, "rustup.exe", [
                    kind,
                    "list",
                    "--installed",
                    "--toolchain",
                    selected
                ]);
                if (
                    checked.code !== 0 ||
                    missing.some(
                        (name: string) =>
                            !checked.stdout
                                .split(/\s+/)
                                .some(
                                    (entry: string) =>
                                        entry === name ||
                                        (kind === "component" &&
                                            entry === `${name}-x86_64-pc-windows-msvc`)
                                )
                    )
                )
                {
                    return yield* Effect.fail(
                        new Error(`Rust ${kind}s remain missing after installation.`)
                    );
                }
            }
        }

        return { ...refreshed,
            RUSTUP_AUTO_INSTALL: "0",
            RUSTUP_TOOLCHAIN: selected };
    });

/**
 * Tests an actual H.264/MP4 encode, not just executable presence or an advertised encoder name.
 *
 * @category Testing
 * @since 1.0.0
 */
const RecordingTools = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const version = yield* Probe(request, environment, "ffmpeg.exe", [ "-version" ]);
        const encoders = yield* Probe(request, environment, "ffmpeg.exe", [
            "-hide_banner",
            "-encoders"
        ]);
        if (
            version.code !== 0 ||
            !/^ffmpeg version \S+/m.test(version.stdout) ||
            encoders.code !== 0 ||
            !encoders.stdout.split(/\s+/).includes(plan.policy.encoder)
        )
        {
            return false;
        }

        const host = yield* PrerequisiteHost;
        return yield* Effect.acquireUseRelease(
            host.temporary,
            (directory: string) =>
                Effect.gen(function* ()
                {
                    const file = win32.join(directory, `codec.${plan.policy.container}`);
                    const encoded = yield* Probe(request, environment, "ffmpeg.exe", [
                        "-nostdin",
                        "-hide_banner",
                        "-loglevel",
                        "error",
                        "-f",
                        "lavfi",
                        "-i",
                        "color=c=black:s=16x16:r=1",
                        "-frames:v",
                        "1",
                        "-c:v",
                        plan.policy.encoder,
                        "-f",
                        plan.policy.container,
                        file
                    ]);
                    const decoded = yield* Probe(request, environment, "ffprobe.exe", [
                        "-v",
                        "error",
                        "-show_entries",
                        "stream=codec_name",
                        "-of",
                        "json",
                        file
                    ]);
                    if (encoded.code !== 0 || decoded.code !== 0)
                    {
                        return false;
                    }

                    const streams = LocalRecord(JSON.parse(decoded.stdout)).streams;
                    return (
                        Array.isArray(streams) &&
                        streams.some((stream: unknown) => LocalRecord(stream).codec_name === "h264")
                    );
                }),
            (directory: string) => host.cleanup(directory).pipe(Effect.orDie)
        );
    });

/**
 * Acquires exact native inputs and runtime asset inputs with separate SDK and Minecraft license consent.
 * Compiled SDK/bridge/bundle acceptance remains with the native/build components.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
const PrepareInputs = (request: Request, environment: ToolEnvironment, plan: PrerequisitePlan) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const source = win32.join(
            request.paths.source,
            ".local/prerequisites/native",
            plan.loaderCommit
        );
        const runtime = win32.join(
            request.paths.source,
            ".local/prerequisites/runtime",
            plan.sdkVersion
        );
        for (const [ artifact, directory, label ] of [
            [ plan.policy.nativeSource, source, "LeviLamina SDK sources" ],
            [ plan.policy.runtimeData, runtime, "Bedrock SDK runtime data" ]
        ] as const)
        {
            if (!(yield* host.archiveReady(artifact, directory)))
            {
                yield* Approve(
                    `Download/repair ${label} at the selected pinned version into ${directory}? ` +
                        "Its locally pinned SHA-256 and extracted files will be verified; " +
                        "upstream licenses apply."
                );
                yield* host.archive(artifact, directory);
                if (!(yield* host.archiveReady(artifact, directory)))
                {
                    return yield* Effect.fail(new Error(`${label} remains incomplete or corrupt.`));
                }
            }
        }

        const missing = [];
        for (const asset of plan.assets)
        {
            const file = win32.join(request.paths.source, asset.path);
            if (yield* host.exists(file))
            {
                if ((yield* host.hash(file, "gitBlob")) !== asset.artifact.gitBlob)
                {
                    return yield* Effect.fail(
                        new Error(
                            `Local asset differs from its pin: ${asset.path}. ` +
                                "Preserve your edits and resolve this input explicitly; " +
                                "setup will not overwrite it."
                        )
                    );
                }
            }
            else
            {
                missing.push(asset);
            }
        }

        if (missing.length > 0)
        {
            yield* Approve(
                `Acquire ${missing.length} missing, ignored Cinnabar data/font/image inputs from the ` +
                    "recorded import commit? Upstream PolyForm/component licenses apply. " +
                    "Source code and existing " +
                    "files are preserved; every input is Git-blob verified before publication."
            );
            for (const asset of missing)
            {
                const file = win32.join(request.paths.source, asset.path);
                yield* host.file(asset.artifact, file);
                if ((yield* host.hash(file, "gitBlob")) !== asset.artifact.gitBlob)
                {
                    return yield* Effect.fail(
                        new Error(`Acquired asset failed verification: ${asset.path}`)
                    );
                }
            }
        }

        const vanilla = win32.join(request.paths.source, plan.vanillaDirectory);
        if (!(yield* host.archiveReady(plan.vanilla, vanilla)))
        {
            yield* Approve(
                `Download/repair the locally pinned Mojang sample assets into ${vanilla}? ` +
                    "This accepts the Minecraft EULA and the pinned pack's license. " +
                    "It does not enable capture/look-back."
            );
            yield* host.archive(plan.vanilla, vanilla);
            if (!(yield* host.archiveReady(plan.vanilla, vanilla)))
            {
                return yield* Effect.fail(
                    new Error("Pinned vanilla asset inputs remain incomplete or corrupt.")
                );
            }
        }

        return {
            ...environment,
            [EnvironmentVariable.NativeSource]: source,
            [EnvironmentVariable.RuntimeData]: win32.join(runtime, "bedrock_runtime_data"),
            [EnvironmentVariable.AssetInputs]: vanilla
        };
    });

/**
 * Checks standard-library compilation and executable linkage without dependencies or network access.
 *
 * @category Testing
 * @since 1.0.0
 */
const CompilerSmoke = (request: Request, environment: ToolEnvironment, language: "Rust" | "Go") =>
    Effect.gen(function*()
    {
        const host = yield* PrerequisiteHost;
        return yield* Effect.acquireUseRelease(host.temporary, (directory: string) =>
            Effect.gen(function*()
            {
                const rust = language === "Rust";
                const file = win32.join(directory, rust ? "main.rs" : "main.go");
                const executable = win32.join(directory, rust ? "rust-check.exe" : "go-check.exe");
                yield* host.write(file, rust ?
                    "fn main(){let value=String::from(\"ready\");assert_eq!(value.len(),5);}\n" :
                    "package main\nimport \"fmt\"\nfunc main(){fmt.Print(\"ready\")}\n");
                const probeEnvironment = { ...environment,
                    GO111MODULE: "off",
                    GOPROXY: "off",
                    GOWORK: "off" };
                const compiled = yield* Probe(
                    request, probeEnvironment, rust ? "rustup.exe" : "go.exe", rust ?
                        [ "run", EnvironmentValue(environment, "RUSTUP_TOOLCHAIN")!, "rustc", file,
                            "--target", "x86_64-pc-windows-msvc", "-o", executable ] :
                        [ "build", "-o", executable, file ]);
                const ran = compiled.code === 0 &&
                    (yield* Probe(request, probeEnvironment, executable, [])).code === 0;
                if (!ran)
                {
                    return yield* Effect.fail(new Error(`${language} failed compile/link/run verification: ` +
                        `${compiled.stderr}. Repair the toolchain and rerun setup.`));
                }
            }), (directory: string) => host.cleanup(directory).pipe(Effect.orDie));
    });

/**
 * Implements prerequisite preparation while preserving source, defaults and optional tool selections.
 * All external changes follow default-No consent and a successful post-install usability check.
 *
 * @category Layer
 * @since 1.0.0
 */
export const PrerequisiteLayer = Layer.effect(
    Prerequisites,
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const consent = yield* Consent;
        const processes = yield* Processes;
        return {
            prepare: (request: Request) =>
                Effect.gen(function* ()
                {
                    const plan = yield* LoadPrerequisitePlan(request.paths);
                    let environment: ToolEnvironment = {
                        ...request.account.environment,
                        GOTOOLCHAIN: "local",
                        RUSTUP_AUTO_INSTALL: "0"
                    };
                    environment = yield* Refresh(request, environment);
                    environment = yield* EnsureTool(
                        request,
                        environment,
                        "git.exe",
                        [ "--version" ],
                        (output: ToolOutput) =>
                            output.code === 0 && /^git version \d+\./.test(output.stdout),
                        plan.policy.winget.git
                    );
                    environment = yield* EnsureNative(request, environment, plan);
                    environment = yield* EnsureRust(request, environment, plan);
                    environment = yield* EnsureTool(
                        request,
                        environment,
                        "go.exe",
                        [ "version" ],
                        (output: ToolOutput) =>
                        {
                            const version =
                                /^go version go(\d+\.\d+(?:\.\d+)?) windows\/amd64/.exec(
                                    output.stdout
                                )?.[1];
                            return (
                                output.code === 0 &&
                                version !== undefined &&
                                AtLeast(version, plan.go)
                            );
                        },
                        plan.policy.winget.go
                    );
                    yield* CompilerSmoke(request, environment, "Rust");
                    yield* CompilerSmoke(request, environment, "Go");
                    environment = yield* EnsureTool(
                        request,
                        environment,
                        "xmake.exe",
                        [ "--version" ],
                        (output: ToolOutput) =>
                        {
                            const version = /xmake v?(\d+\.\d+\.\d+)/i.exec(output.stdout)?.[1];
                            return (
                                output.code === 0 &&
                                version !== undefined &&
                                AtLeast(version, plan.xmake)
                            );
                        },
                        plan.policy.winget.xmake
                    );
                    if (!(yield* RecordingTools(request, environment, plan)))
                    {
                        yield* Approve(
                            `Install or repair ${plan.policy.winget.ffmpeg} with working ` +
                                `${plan.policy.encoder}/${plan.policy.container} encoding ` +
                                "and ffprobe through WinGet?"
                        );
                        yield* WinGet(request, environment, plan.policy.winget.ffmpeg, [ "--force" ]);
                        environment = yield* Refresh(request, environment);
                        if (!(yield* RecordingTools(request, environment, plan)))
                        {
                            return yield* Effect.fail(
                                new Error(
                                    "FFmpeg/ffprobe cannot produce verified H.264 media after install."
                                )
                            );
                        }
                    }

                    return yield* PrepareInputs(request, environment, plan);
                }).pipe(
                    Effect.provideService(PrerequisiteHost, host),
                    Effect.provideService(Consent, consent),
                    Effect.provideService(Processes, processes),
                    Effect.catchCause((cause: Cause.Cause<unknown>) =>
                        Effect.fail(
                            new Error(`Prerequisite setup stopped: ${String(Cause.squash(cause))}`)
                        )
                    )
                )
        };
    })
);
