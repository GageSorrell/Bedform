/**
 * Windows destination access policy and consented single-elevation orchestration.
 *
 * @module monorepo-setup/Permissions
 *
 * @file      Permissions.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Consent, Currency, Permissions, Probes } from "./Contract.js";
import { Context, Effect, Layer } from "effect";
import type { PermissionResult, Request } from "./Contract.js";
import { win32 } from "node:path";

/**
 * Measured Windows token identity; usernames alone do not identify an account across UAC.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Identity
{
    readonly sid: string;
    readonly name: string;
    readonly home: string;
    readonly elevated: boolean;
}

/**
 * An explicit directory transaction or existing-file access check, without installation writes.
 *
 * @category Model
 * @since 1.0.0
 */
export interface AccessTarget
{
    readonly path: string;
    readonly kind: "directory" | "file";
    readonly purpose: string;
}

/**
 * Injectable Windows token inspection; performs no elevation.
 *
 * @category Service
 * @since 1.0.0
 */
export const AccountIdentity = Context.Service<{
    readonly inspect: Effect.Effect<Identity, Error>;
}>("monorepo-setup/AccountIdentity");

/**
 * Canonical path discovery and temporary, fully cleaned write/rename probes.
 * Denial means access needs approval; malformed, locked or uninspectable paths fail explicitly.
 *
 * @category Service
 * @since 1.0.0
 */
export const Access = Context.Service<{
    readonly canonical: (path: string) => Effect.Effect<string, Error>;
    readonly probe: (target: AccessTarget) => Effect.Effect<"writable" | "denied", Error>;
}>("monorepo-setup/Access");

/**
 * UAC transport with a waited result; ordinary tests replace it and never request elevation.
 *
 * @category Service
 * @since 1.0.0
 */
export const Elevation = Context.Service<{
    readonly relaunch: (request: Request) => Effect.Effect<number, Error>;
}>("monorepo-setup/Elevation");

/**
 * Rejects device paths, alternate data streams and ambiguous Windows filename components.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const IsAbsolutePath = (path: string): boolean =>
    win32.isAbsolute(path) && !Array.from(path).some((character: string) => character.charCodeAt(0) < 32) &&
    !path.startsWith("\\\\?\\") &&
    !path.startsWith("\\\\.\\") && !path.slice(win32.parse(path).root.length).includes(":") &&
    path.slice(win32.parse(path).root.length).split(/[\\/]/).every((part: string) =>
        part === "" || (!/[. ]$/.test(part) && !/[<>"|?*]/.test(part)));

/**
 * Determines ancestor collisions without confusing similarly prefixed sibling directories.
 * Paths are canonicalized by the access service before this comparison.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const Overlaps = (left: string, right: string): boolean =>
{
    const contains = (parent: string, child: string): boolean =>
    {
        const relative = win32.relative(parent, child);
        return relative === "" || (!relative.startsWith("..\\") && relative !== ".." &&
            !win32.isAbsolute(relative));
    };

    return contains(left, right) || contains(right, left);
};

/**
 * Preflights build cache, whole-bundle staging/rollback and only explicitly selected provisioning paths.
 * Owned file inspection comes from the shared currency inspector supplied by the installation component.
 *
 * @category Constructor
 * @since 1.0.0
 */
const Targets = (request: Request): Array<AccessTarget> =>
{
    const targets: Array<AccessTarget> = [];
    if (request.options.core)
    {
        targets.push(
            { kind: "directory",
                path: win32.join(request.paths.source, "target"),
                purpose: "local build cache" },
            { kind: "directory",
                path: win32.join(request.paths.source, "target", ".setup-build"),
                purpose: "local build intermediates" },
            { kind: "directory",
                path: request.paths.install,
                purpose: "installed bundle" },
            { kind: "directory",
                path: win32.dirname(request.paths.install),
                purpose: "bundle staging/rollback" }
        );
    }

    if (request.options.bdsDirectory !== undefined)
    {
        targets.push({ kind: "directory",
            path: request.options.bdsDirectory,
            purpose: "explicit stopped-BDS bridge and configuration" });
        for (const file of [ "server.properties", "permissions.json" ])
        {
            targets.push({ kind: "file",
                path: win32.join(request.options.bdsDirectory, file),
                purpose: "selected BDS configuration backup/write" });
        }
    }

    if (request.options.mcpConfig !== undefined)
    {
        targets.push(
            { kind: "file",
                path: request.options.mcpConfig,
                purpose: "explicit MCP configuration" },
            { kind: "directory",
                path: win32.dirname(request.options.mcpConfig),
                purpose: "MCP configuration staging/backup" }
        );
    }

    return targets;
};

/**
 * Pins Cargo outputs and intermediates to checked locations, overriding ambient output redirection.
 * Tool/profile locations remain those of the invoking account; no Cargo configuration file is rewritten.
 * Build adapters must retain these values rather than supplying alternate output flags.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const BuildEnvironment = (request: Request): Readonly<Record<string, string | undefined>> =>
    request.options.core ? { ...request.account.environment,
        CARGO_BUILD_BUILD_DIR: win32.join(request.paths.source, "target", ".setup-build"),
        CARGO_TARGET_DIR: win32.join(request.paths.source, "target") } : request.account.environment;

/**
 * Provides access checks and single-elevation policy while retaining the original request and tool locations.
 * The elevated entrypoint separately authenticates its SID, owning checkout and live parent session.
 *
 * @category Layer
 * @since 1.0.0
 */
export const PermissionLayer = Layer.effect(Permissions, Effect.gen(function*()
{
    const access = yield* Access;
    const identityService = yield* AccountIdentity;
    const consent = yield* Consent;
    const elevation = yield* Elevation;
    const probes = yield* Probes;
    const currency = yield* Currency;
    return { prepare: (request: Request): Effect.Effect<PermissionResult, Error> =>
        Effect.gen(function*()
        {
            yield* probes.platform;
            yield* probes.source(request.paths);
            const identity = yield* identityService.inspect;
            const sameAccount = request.account.id === identity.sid ||
                (!request.elevated && request.account.id.toLowerCase() === identity.name.toLowerCase());
            if (!sameAccount || win32.normalize(request.account.home).toLowerCase() !==
                win32.normalize(identity.home).toLowerCase())
            {
                return yield* Effect.fail(new Error(
                    "Setup cannot continue under a different account. Use the invoking account for UAC."
                ));
            }

            if (request.elevated && !identity.elevated)
            {
                return yield* Effect.fail(new Error(
                    "The setup handoff is not running with an elevated token."
                ));
            }

            const source = yield* access.canonical(request.paths.source);
            const install = yield* access.canonical(request.paths.install);
            const build = yield* access.canonical(win32.join(request.paths.source, "target"));
            const intermediates = yield* access.canonical(
                win32.join(request.paths.source, "target", ".setup-build"));
            if (Overlaps(source, install) || Overlaps(build, install) || Overlaps(intermediates, install))
            {
                return yield* Effect.fail(new Error(
                    "Installation must not overlap local source/build outputs."
                ));
            }

            const targets = Targets(request);
            for (const target of targets)
            {
                if (!IsAbsolutePath(target.path))
                {
                    return yield* Effect.fail(new Error(
                        `Invalid absolute Windows setup path: ${target.path}`
                    ));
                }

                const path = yield* access.canonical(target.path);
                if ((target.purpose.startsWith("explicit") || target.purpose.startsWith("selected") ||
                    target.purpose.startsWith("MCP")) && (Overlaps(path, source) || Overlaps(path, install)))
                {
                    return yield* Effect.fail(new Error(
                        "Provisioning paths must not overlap source or install."
                    ));
                }
            }

            if (request.options.core)
            {
                const evidence = yield* currency.inspect(request);
                if (evidence !== undefined)
                {
                    if ((yield* access.canonical(evidence.installDirectory)) !== install)
                    {
                        return yield* Effect.fail(new Error(
                            "Owned bundle metadata belongs to another destination."
                        ));
                    }

                    for (const file of evidence.files)
                    {
                        const path = win32.resolve(request.paths.install, file.path);
                        const canonical = yield* access.canonical(path);
                        if (!IsAbsolutePath(path) || canonical === install || !Overlaps(canonical, install) ||
                            win32.relative(install, canonical).startsWith(".."))
                        {
                            return yield* Effect.fail(new Error(
                                "Owned bundle path escapes the installation."
                            ));
                        }

                        targets.push({ kind: "file",
                            path,
                            purpose: "owned bundle replacement/rollback" });
                    }
                }
            }

            const denied: Array<AccessTarget> = [];
            for (const target of targets)
            {
                if ((yield* access.probe(target)) === "denied")
                {
                    denied.push(target);
                }
            }

            if (denied.length === 0)
            {
                return { environment: BuildEnvironment(request),
                    kind: "ready" as const };
            }

            const paths = denied.map((target: AccessTarget) =>
                `${target.purpose}: ${target.path}`).join("; ");
            if (request.elevated || identity.elevated)
            {
                return yield* Effect.fail(new Error(
                    `Access is still denied while elevated (${paths}). ` +
                    "Check permissions or locked files; no retry."
                ));
            }

            if (!(yield* consent.confirm(
                `Administrator access is required for ${paths}. Relaunch setup with UAC?`)))
            {
                return yield* Effect.fail(new Error(
                    "Elevation declined. Choose writable paths or approve UAC."
                ));
            }

            const code = yield* elevation.relaunch({ ...request,
                account: { ...request.account,
                    environment: BuildEnvironment(request),
                    id: identity.sid },
                elevated: true });
            return { exitCode: code,
                kind: "relaunched" as const };
        }) };
}));
