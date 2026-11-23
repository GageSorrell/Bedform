/**
 * Strict local fork, toolchain, native tuple and asset-input preflight before machine changes.
 *
 * @module monorepo-setup/PrerequisitePlan
 *
 * @file      PrerequisitePlan.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Cause, Effect } from "effect";
import type { PrerequisitePlan, PrerequisitePolicy, ToolArtifact } from "./Prerequisite.js";
import type { Paths } from "./Contract.js";
import { PrerequisiteHost } from "./Prerequisite.js";
import { parse } from "smol-toml";
import { win32 } from "node:path";

/**
 * Rejects malformed local records without obtaining replacement metadata.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Guard
 * @since 1.0.0
 */
export const LocalRecord = (value: unknown): Record<string, unknown> =>
{
    if (value === null || typeof value !== "object" || Array.isArray(value))
    {
        throw new Error("Invalid local prerequisite record.");
    }

    return value as Record<string, unknown>;
};

/**
 * Requires nonempty local configuration text.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const LocalString = (value: unknown): string =>
{
    if (typeof value !== "string" || value.trim() === "" || value.includes("\0"))
    {
        throw new Error("Missing or invalid local prerequisite string.");
    }

    return value;
};

/**
 * Requires a declared array instead of silently dropping components or targets.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
const Strings = (value: unknown): ReadonlyArray<string> =>
{
    if (!Array.isArray(value))
    {
        throw new Error("Invalid local prerequisite list.");
    }

    return value.map(LocalString);
};

/**
 * Confines a manifest-owned relative path to its source or cache root.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const LocalRelative = (value: unknown): string =>
{
    const text = LocalString(value);
    if (
        !text
            .split("/")
            .every(
                (part: string) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== ".."
            )
    )
    {
        throw new Error(`Unsafe local prerequisite path: ${text}`);
    }

    return text;
};

/**
 * Validates a checked HTTPS archive or installer pin.
 *
 * @throws { Error } When the input violates the checked prerequisite contract.
 *
 * @category Decoding
 * @since 1.0.0
 */
const Artifact = (value: unknown): ToolArtifact =>
{
    const record = LocalRecord(value);
    const url = LocalString(record.url);
    const sha256 = LocalString(record.sha256);
    if (new URL(url).protocol !== "https:" || !/^[a-f0-9]{64}$/.test(sha256))
    {
        throw new Error("Prerequisite artifacts require a local HTTPS URL and SHA-256 pin.");
    }

    const prefix = record.prefix === undefined ? undefined : LocalString(record.prefix);
    if (prefix !== undefined)
    {
        LocalRelative(prefix.replace(/\/$/, ""));
    }

    return { prefix,
        sha256,
        url };
};

/**
 * Compares compiler/tool release numbers without depending on ambient package-manager versions.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const AtLeast = (actual: string, minimum: string): boolean =>
{
    const parseVersion = (text: string): Array<number> =>
    {
        if (!/^\d+\.\d+(?:\.\d+)?$/.test(text))
        {
            throw new Error(`Invalid prerequisite version: ${text}`);
        }

        return text.split(".").map(Number);
    };

    const left = parseVersion(actual);
    const right = parseVersion(minimum);
    for (let index = 0; index < 3; index++)
    {
        const difference = (left[index] ?? 0) - (right[index] ?? 0);
        if (difference !== 0)
        {
            return difference > 0;
        }
    }

    return true;
};

/**
 * Resolves every requirement from the current local fork before consent, installation or downloads.
 * Missing, inconsistent or unsupported configuration stops instead of consulting upstream metadata.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const LoadPrerequisitePlan = (paths: Paths) =>
    Effect.gen(function* ()
    {
        const host = yield* PrerequisiteHost;
        const read = (relative: string) =>
            host.read(win32.join(paths.source, LocalRelative(relative)));
        const json = (text: string): Record<string, unknown> => LocalRecord(JSON.parse(text));
        const toolchain = LocalRecord(parse(yield* read("rust-toolchain.toml")).toolchain);
        const channel = LocalString(toolchain.channel);
        if (
            !new RegExp("^(?:\\d+\\.\\d+\\.\\d+|stable|beta|nightly(?:-\\d{4}-\\d{2}-\\d{2})?)" +
                "(?:-x86_64-pc-windows-msvc)?$").test(
                channel
            )
        )
        {
            throw new Error(
                "The local Rust toolchain must select a supported Windows x64 MSVC channel."
            );
        }

        const components = toolchain.components === undefined ? [] : Strings(toolchain.components);
        const targets = toolchain.targets === undefined ? [] : Strings(toolchain.targets);
        if (
            ![ ...components, ...targets ].every((entry: string) =>
                /^[a-z0-9][a-z0-9-]*$/.test(entry)
            )
        )
        {
            throw new Error("Invalid Rust component or target in local toolchain.");
        }

        const profile =
            toolchain.profile === undefined ? "default" : LocalString(toolchain.profile);
        if (![ "minimal", "default", "complete" ].includes(profile))
        {
            throw new Error("Unsupported local Rust installation profile.");
        }

        const cargo = parse(yield* read("Cargo.toml"));
        const workspace = LocalRecord(cargo.workspace);
        const rustMinimum = LocalString(LocalRecord(workspace.package)["rust-version"]);
        const rustNumber = /^(\d+\.\d+\.\d+)/.exec(channel)?.[1];
        if (rustNumber !== undefined && !AtLeast(rustNumber, rustMinimum))
        {
            throw new Error("Local Rust channel is below the workspace MSRV.");
        }

        const application = parse(yield* read("app/Cargo.toml"));
        if (
            LocalRecord(application.package).name !== "cinnabar" ||
            !Array.isArray(LocalRecord(application.features)["developer-control"])
        )
        {
            throw new Error("Local client package/developer-control feature is incomplete.");
        }

        if (
            LocalRecord(parse(yield* read("tools/cinnabar-mcp/Cargo.toml")).package).name !==
            "cinnabar-mcp"
        )
        {
            throw new Error("Local MCP package is incomplete.");
        }

        for (const file of [ "app/src/main.rs", "tools/cinnabar-mcp/src/main.rs", "Cargo.lock" ])
        {
            LocalString(yield* read(file));
        }

        let go = "0.0.0";
        for (const file of [
            "go.work",
            "core/go.mod",
            "tools/registrygen/go.mod",
            "tools/fixturegen/go.mod"
        ])
        {
            const text = yield* read(file);
            const versions = [ ...text.matchAll(/^(?:go\s+|toolchain\s+go)(\d+\.\d+(?:\.\d+)?)/gm) ];
            if (!/^go\s+\d+\.\d+/m.test(text))
            {
                throw new Error(`Missing local Go version: ${file}`);
            }

            for (const version of versions)
            {
                if (AtLeast(version[1], go))
                {
                    go = version[1];
                }
            }
        }

        const compatibility = json(yield* read("Bedform/compatibility.json"));
        const target = json(
            yield* host.read(win32.join(paths.monorepo, "Script/bedrock-target.json"))
        );
        const bedrock = json(yield* read("assets/bedrock-target.json"));
        const apiPins = LocalRecord(compatibility.apiPins);
        const selectedPins = LocalRecord(target.apiPins);
        if (
            compatibility.status !== "aligned" ||
            !Array.isArray(compatibility.blockers) ||
            compatibility.blockers.length !== 0 ||
            target.serverVersion !== compatibility.bedformBdsVersion ||
            compatibility.importedServerVersion !== target.serverVersion ||
            compatibility.sdkBdsVersion !== target.serverVersion ||
            bedrock.server_version !== target.serverVersion ||
            bedrock.wire_protocol !== compatibility.wireProtocol ||
            bedrock.codec_crate !== compatibility.codecCrate ||
            bedrock.codec_manifest_sha256 !== compatibility.codecManifestSha256 ||
            bedrock.protocolgen_commit !== compatibility.protocolgenCommit ||
            channel.replace(/-x86_64-pc-windows-msvc$/, "") !== compatibility.rustVersion ||
            JSON.stringify(Object.entries(apiPins).sort()) !==
                JSON.stringify(Object.entries(selectedPins).sort())
        )
        {
            throw new Error(
                "Unsupported local BDS/API/protocol/loader/toolchain compatibility tuple."
            );
        }

        for (const [ name, pin ] of Object.entries(apiPins))
        {
            const directory = name
                .slice("@minecraft/".length)
                .split("-")
                .map((part: string) =>
                    part === "gametest"
                        ? "GameTest"
                        : part === "ui"
                            ? "UI"
                            : part.charAt(0).toUpperCase() + part.slice(1)
                )
                .join("");
            const mirror = json(
                yield* host.read(win32.join(paths.monorepo, "Package", directory, "package.json"))
            );
            if (LocalRecord(mirror.peerDependencies)[name] !== pin)
            {
                throw new Error(`Local API pin drift: ${name}`);
            }
        }

        const sdkVersion = LocalString(compatibility.sdkVersion);
        const loaderCommit = LocalString(compatibility.loaderCommit);
        if (
            !/^[a-f0-9]{40}$/.test(loaderCommit) ||
            `1.${sdkVersion.split("-")[0]}` !== target.serverVersion
        )
        {
            throw new Error("Unsupported native SDK identity.");
        }

        const loader = parse(yield* read("Bedform/LeviLamina.lip.toml"));
        const variants = LocalRecord(loader.variants)[""];
        const server = Array.isArray(variants)
            ? variants
                .map(LocalRecord)
                .find((variant: Record<string, unknown>) =>
                    variant.side === "server" && variant.platform === "win-x64")
            : undefined;
        const dependencies = LocalRecord(server?.deps);
        if (
            loader.version !== compatibility.loaderVersion ||
            dependencies["github.com/LiteLDev/bedrock-runtime-data"] !== sdkVersion ||
            dependencies["github.com/LiteLDev/PreLoader"] !== compatibility.preLoaderVersion ||
            dependencies["github.com/LiteLDev/bds"] !== compatibility.loaderBdsDependency
        )
        {
            throw new Error("Local loader descriptor does not match the selected native tuple.");
        }

        const lua = yield* read("Bedform/LeviLamina.xmake.lua");
        const xmake = /set_xmakever\("(\d+\.\d+\.\d+)"\)/.exec(lua)?.[1];
        const cmake = /cmake_minimum_required\(VERSION (\d+\.\d+(?:\.\d+)?)/.exec(
            yield* read("Bedform/Native/CMakeLists.txt")
        )?.[1];
        if (
            xmake === undefined ||
            cmake === undefined ||
            !lua.includes(`bedrockdata v${sdkVersion}`)
        )
        {
            throw new Error("Local native build requirements are incomplete.");
        }

        const rawPolicy = json(yield* read("Bedform/prerequisites.json"));
        const policy: PrerequisitePolicy = {
            container: LocalString(rawPolicy.container),
            encoder: LocalString(rawPolicy.encoder),
            nativeSource: Artifact(rawPolicy.nativeSource),
            runtimeData: Artifact(rawPolicy.runtimeData),
            rustup: Artifact(rawPolicy.rustup),
            schemaVersion: Number(rawPolicy.schemaVersion),
            visualStudioComponents: Strings(rawPolicy.visualStudioComponents),
            winget: Object.fromEntries(
                Object.entries(LocalRecord(rawPolicy.winget)).map(([ key, value ]: [string, unknown]) => [
                    key,
                    LocalString(value)
                ])
            )
        };
        if (
            policy.schemaVersion !== 1 ||
            !policy.nativeSource.url.endsWith(`/zip/${loaderCommit}`) ||
            policy.nativeSource.prefix !== `LeviLamina-${loaderCommit}/` ||
            !policy.runtimeData.url.includes(`/v${sdkVersion}/`) ||
            !policy.rustup.url.startsWith("https://static.rust-lang.org/rustup/archive/") ||
            !policy.rustup.url.endsWith("/x86_64-pc-windows-msvc/rustup-init.exe") ||
            !/^[a-z0-9_]+$/.test(policy.encoder) ||
            !/^[a-z0-9]+$/.test(policy.container) ||
            policy.visualStudioComponents.length === 0
        )
        {
            throw new Error(
                "Local prerequisite acquisition policy does not match the selected tuple."
            );
        }

        for (const name of [ "git", "visualStudio", "go", "xmake", "ffmpeg" ])
        {
            if (!/^[A-Za-z0-9.-]+$/.test(policy.winget[name] ?? ""))
            {
                throw new Error(`Missing local WinGet policy: ${name}`);
            }
        }

        const inventory = json(yield* read("Bedform/import.json"));
        const commit = LocalString(inventory.commit);
        if (
            commit !== compatibility.upstreamCommit ||
            !/^[a-f0-9]{40}$/.test(commit) ||
            !Array.isArray(inventory.excluded)
        )
        {
            throw new Error("Local source-asset provenance is incomplete.");
        }

        const assets = inventory.excluded
            .map(LocalRecord)
            .filter(
                (entry: Record<string, unknown>) =>
                    LocalString(entry.path).startsWith("assets/") ||
                    LocalString(entry.path).startsWith("crates/assets/data/")
            )
            .map((entry: Record<string, unknown>) =>
            {
                const path = LocalRelative(entry.path);
                const gitBlob = LocalString(entry.sha);
                if (!/^[a-f0-9]{40}$/.test(gitBlob))
                {
                    throw new Error(`Invalid imported data pin: ${path}`);
                }

                return {
                    artifact: {
                        gitBlob,
                        url: `https://raw.githubusercontent.com/cinnabar-mc/cinnabar/${commit}/${path}`
                    },
                    path
                };
            });
        const vanilla = json(yield* read("assets/vanilla-source.json"));
        const marker = /const MARKER: &str = "([^"]+)"/
            .exec(yield* read("crates/assets/src/vanilla_pack.rs"))?.[1];
        LocalRelative(marker);
        const vanillaDirectory = LocalRelative(vanilla.cache_dir);
        if (
            !vanillaDirectory.startsWith(".local/assets/") ||
            vanilla.schema !== 1 ||
            vanilla.artifact_policy !== "local-only" ||
            vanilla.commit !== compatibility.vanillaSourceCommit
        )
        {
            throw new Error(
                "Local vanilla asset source/cache does not match its compatibility pin."
            );
        }

        const packages = new Set<string>();
        for (const member of Strings(workspace.members))
        {
            const manifest = parse(yield* read(`${LocalRelative(member)}/Cargo.toml`));
            packages.add(LocalString(LocalRecord(manifest.package).name));
        }

        for (const line of (yield* read("packaging/common/runtime-binaries.txt"))
            .trim()
            .split(/\r?\n/))
        {
            const [ binary, packageName, role ] = line.trim().split(/\s+/);
            if (role === "CORE")
            {
                LocalString(yield* read(`core/cmd/${LocalRelative(binary)}/main.go`));
            }
            else if (packageName === undefined || !packages.has(packageName) || role === undefined)
            {
                throw new Error(`Missing local runtime helper source: ${line}`);
            }
        }

        const plan: PrerequisitePlan = {
            assets,
            cmake,
            go,
            loaderCommit,
            policy,
            rust: { channel,
                components,
                minimum: rustMinimum,
                profile,
                targets },
            sdkVersion,
            vanilla: { ...Artifact(vanilla),
                marker },
            vanillaDirectory,
            xmake
        };
        return plan;
    }).pipe(
        Effect.catchCause((cause: Cause.Cause<unknown>) =>
            Effect.fail(
                new Error(
                    `Local prerequisite preflight failed: ${String(Cause.squash(cause))}. ` +
                        "Obtain the complete compatible checkout; " +
                        "setup never downloads replacement configuration or source code."
                )
            )
        )
    );
