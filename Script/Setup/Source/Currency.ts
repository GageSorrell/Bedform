/**
 * Fail-closed evaluation of measured setup currency and exact already-current terminal output.
 *
 * @module monorepo-setup/Currency
 *
 * @file      Currency.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Request } from "./Contract.js";

/**
 * Recorded and freshly measured SHA-256 digests of the same complete input or artifact set.
 * Missing, inaccessible or unmeasured contents have no actual digest.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Fingerprint
{
    readonly recorded: string;
    readonly actual?: string;
}

/**
 * Integrity measurement of an ownership-manifest entry relative to the installation directory.
 *
 * @category Model
 * @since 1.0.0
 */
export interface OwnedFile extends Fingerprint
{
    readonly path: string;
}

/**
 * Verified stage configuration, or a previously recorded optional-tool decline/unavailability.
 * Target paths distinguish explicitly selected BDS instances and MCP configuration files.
 *
 * @category Model
 * @since 1.0.0
 */
export type StageVerification =
    | { readonly stage: "core" | "bds" | "mcp" | "blender" | "blockbench";
        readonly state: "current";
        readonly target?: string;
        readonly fingerprint: Fingerprint }
    | { readonly stage: "blender" | "blockbench";
        readonly state: "declined" | "unavailable" };

/**
 * Complete installation receipt paired with freshly measured local and installed contents.
 * Inputs cover source/build inputs including developer edits; pins cover toolchains, dependencies
 * and compatibility manifests. Provenance and ownership digests cover the complete bundle metadata.
 * The inspector must enumerate all required runtime files independently of the receipt's file list.
 * Stage digests include applicable selected configuration and provisioned artifact integrity.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Verification
{
    readonly complete: boolean;
    readonly sourceDirectory: string;
    readonly installDirectory: string;
    readonly inputs: Fingerprint;
    readonly pins: Fingerprint;
    readonly provenance: Fingerprint;
    readonly ownership: Fingerprint;
    readonly requiredFiles: ReadonlyArray<string>;
    readonly files: ReadonlyArray<OwnedFile>;
    readonly stages: ReadonlyArray<StageVerification>;
}

/**
 * Requires a measured, matching SHA-256 digest instead of accepting an arbitrary completion marker.
 *
 * @category Predicate
 * @since 1.0.0
 */
const Matches = (fingerprint: Fingerprint): boolean =>
    /^[\da-f]{64}$/.test(fingerprint.recorded) && fingerprint.recorded === fingerprint.actual;

/**
 * Accepts only relative owned paths that cannot escape the bundle or alias another manifest entry.
 *
 * @category Predicate
 * @since 1.0.0
 */
const IsOwnedPath = (path: string): boolean =>
    path.length > 0 && !path.includes("\\") && !path.includes(":") &&
    path.split("/").every((part: string) => part !== "" && part !== "." && part !== "..");

/**
 * Establishes current setup only from complete, matching, freshly measured evidence for this request.
 * A forced local rebuild always bypasses currency. Optional recorded declines remain nonblocking.
 *
 * @category Predicate
 * @since 1.0.0
 */
const VerifyEvidence = (request: Request, evidence: Verification | undefined): boolean =>
{
    if (request.options.update || evidence === undefined || evidence.complete !== true ||
        evidence.sourceDirectory !== request.paths.source ||
        evidence.installDirectory !== request.paths.install ||
        ![ evidence.inputs, evidence.pins, evidence.provenance, evidence.ownership ].every(Matches) ||
        evidence.requiredFiles.length === 0 || evidence.files.length === 0)
    {
        return false;
    }

    const files = new Map<string, OwnedFile>();
    for (const file of evidence.files)
    {
        const normalized = file.path.toLowerCase();
        if (!IsOwnedPath(file.path) || files.has(normalized) || !Matches(file))
        {
            return false;
        }

        files.set(normalized, file);
    }

    if (!evidence.requiredFiles.every((path: string) => IsOwnedPath(path) && files.has(path.toLowerCase())))
    {
        return false;
    }

    const stages = new Map<string, StageVerification>();
    for (const stage of evidence.stages)
    {
        if (stages.has(stage.stage))
        {
            return false;
        }

        stages.set(stage.stage, stage);
    }

    for (const name of [ "core", "bds", "mcp", "blender", "blockbench" ] as const)
    {
        const target = name === "bds" ? request.options.bdsDirectory
            : name === "mcp" ? request.options.mcpConfig : undefined;
        const selected = name === "bds" || name === "mcp" ? target !== undefined : request.options[name];
        if (!selected)
        {
            continue;
        }

        const stage = stages.get(name);
        if (stage === undefined)
        {
            return false;
        }

        if (stage.state !== "current")
        {
            if ((name === "blender" || name === "blockbench") &&
                (stage.state === "declined" || stage.state === "unavailable"))
            {
                continue;
            }

            return false;
        }

        if (stage.target !== target || !Matches(stage.fingerprint))
        {
            return false;
        }
    }

    return true;
};

/**
 * Rejects malformed or incomplete inspection data instead of treating it as current or aborting setup.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const IsCurrent = (request: Request, evidence: Verification | undefined): boolean =>
{
    try
    {
        return VerifyEvidence(request, evidence);
    }
    catch
    {
        return false;
    }
};

/**
 * Honors terminal capability and standard color-disable settings without changing Unicode or spacing.
 *
 * @category Predicate
 * @since 1.0.0
 */
export const ColorEnabled = (
    environment: Readonly<Record<string, string | undefined>>, tty: boolean
): boolean =>
{
    if (environment.NO_COLOR !== undefined || environment.NODE_DISABLE_COLORS === "1" ||
        environment.FORCE_COLOR === "0")
    {
        return false;
    }

    if (environment.FORCE_COLOR !== undefined)
    {
        return true;
    }

    return tty && environment.TERM !== "dumb";
};

/**
 * Formats the sole setup-owned output permitted when existing setup is verified current.
 * Only the ballot-box symbol is colored, with an immediate reset before its single separating space.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const AlreadyCurrentLine = (color: boolean): string =>
    `${color ? "\u001B[32m☑\u001B[0m" : "☑"} Setup is already complete and current.`;
