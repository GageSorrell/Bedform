/**
 * Pack manifest parsing, version normalization and dependency inspection.
 *
 * @module bedrock-server-manager/manifest
 *
 * @file      manifest.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
/**
 * Stable manifest parsing without discarding extension fields.
 *
 * @file manifest.ts
 */

/** Supported pack directory classifications. */
export type PackKind = "behavior" | "resource";
/** Bedrock pack versions may use a numeric triple or a semantic version. */
export type PackVersion = [number, number, number] | string;
/** Dependency on an installed pack or a scripting API. */
export interface Dependency
{
    readonly uuid?: string;
    readonly module_name?: string;
    readonly version: PackVersion;
}
/** Validated identity and content declarations alongside the untouched manifest. */
export interface Manifest
{
    readonly raw: Record<string, unknown>;
    readonly name: string;
    readonly uuid: string;
    readonly version: PackVersion;
    readonly kind: PackKind;
    readonly moduleUuids: Array<string>;
    readonly scripts: Array<string>;
    readonly dependencies: Array<Dependency>;
}

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string => typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
const semver = (value: string): boolean =>
{
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([\da-z.-]+))?(?:\+([\da-z.-]+))?$/i.exec(value);
    if (!match || !match.slice(1, 4).every((part: string) => /^(0|[1-9]\d*)$/.test(part)))
    {
        return false;
    }
    const prerelease = match[4]?.split(".") ?? [];
    const build = match[5]?.split(".") ?? [];
    return prerelease.every((part: string) => /^(0|[1-9]\d*|\d*[a-z-][\da-z-]*)$/i.test(part)) &&
        build.every((part: string) => /^[\da-z-]+$/i.test(part));
};
const version = (value: unknown): value is PackVersion =>
    (Array.isArray(value) && value.length === 3 &&
        value.every((part: unknown) => typeof part === "number" &&
            Number.isSafeInteger(part) && part >= 0)) ||
    (typeof value === "string" && semver(value));
const versionText = (value: PackVersion): string => Array.isArray(value) ? value.join(".") : value;

/**
 * Format 3 manifests write a plain release as "1.14.1"; world pack references and the qualified test
 * worlds use the numeric triple, so a plain release becomes a triple. Prereleases and builds keep their text.
 */
const identity = (value: PackVersion): PackVersion =>
    typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value)
        ? value.split(".").map(Number) as [number, number, number]
        : value;
const sameVersion = (left: PackVersion, right: PackVersion): boolean =>
    versionText(left) === versionText(right);

/**
 * Validate supported manifest fields; errors explain what must be repaired.
 *
 * @throws {Error} When a required field or supported module declaration is invalid.
 */
const parseManifest = (raw: unknown): Manifest =>
{
    if (!object(raw))
    {
        throw new Error("Manifest must be a JSON object.");
    }
    if (raw.format_version !== 2 && raw.format_version !== 3)
    {
        throw new Error("Unsupported manifest format; expected format_version 2 or 3.");
    }
    const header = raw.header;
    if (!object(header) || typeof header.name !== "string" || !BedrockString.trim(header.name) ||
        !uuid(header.uuid) || !version(header.version))
    {
        throw new Error("Manifest header requires a nonempty name, UUID and valid version.");
    }
    if (typeof header.description !== "string" || !version(header.min_engine_version))
    {
        throw new Error("Manifest header requires description and a valid min_engine_version.");
    }
    if (!Array.isArray(raw.modules) || !raw.modules.length)
    {
        throw new Error("Manifest requires at least one module.");
    }
    const kinds = new Set<PackKind>();
    const moduleUuids: Array<string> = [];
    const scripts: Array<string> = [];
    for (const module of raw.modules)
    {
        if (!object(module) || !uuid(module.uuid) || !version(module.version))
        {
            throw new Error("Each module requires a UUID and valid version.");
        }
        const id = BedrockString.toLowerCase(module.uuid);
        if (id === BedrockString.toLowerCase(header.uuid) || moduleUuids.includes(id))
        {
            throw new Error(`Duplicate module/header UUID: ${id}`);
        }
        moduleUuids.push(id);
        if (module.type === "resources")
        {
            kinds.add("resource");
        }
        else if (module.type === "data" || module.type === "script")
        {
            kinds.add("behavior");
        }
        else
        {
            throw new Error(`Unsupported pack module kind: ${String(module.type)}`);
        }
        if (module.type === "script")
        {
            if (module.language !== "javascript" || typeof module.entry !== "string" || !BedrockString.trim(module.entry))
            {
                throw new Error("Script modules require language javascript and a nonempty entry path.");
            }
            scripts.push(module.entry);
        }
    }
    if (kinds.size !== 1)
    {
        throw new Error("A pack cannot mix resource and behavior modules.");
    }
    if (raw.dependencies !== undefined && !Array.isArray(raw.dependencies))
    {
        throw new Error("Manifest dependencies must be an array.");
    }
    const dependencies: Array<Dependency> = [];
    for (const dependency of (raw.dependencies ?? []) as Array<unknown>)
    {
        const scripting = object(dependency) && typeof dependency.module_name === "string" &&
            BedrockString.trim(dependency.module_name).length > 0;
        // Scripting APIs also accept the bare "beta" channel, as stock BDS editor packs declare.
        const channel = object(dependency) && scripting && dependency.version === "beta";
        if (!object(dependency) || !(channel || version(dependency.version)) ||
            uuid(dependency.uuid) === scripting ||
            (dependency.uuid !== undefined && dependency.module_name !== undefined))
        {
            throw new Error("Each dependency requires exactly one UUID or module_name and a valid version.");
        }
        const required = dependency.version as PackVersion;
        dependencies.push(dependency.uuid !== undefined
            ? { uuid: BedrockString.toLowerCase(String(dependency.uuid)), version: required }
            : { module_name: String(dependency.module_name), version: required });
    }
    return {
        dependencies, kind: kinds.has("resource") ? "resource" : "behavior",
        moduleUuids, name: header.name, raw, scripts,
        uuid: BedrockString.toLowerCase(header.uuid), version: identity(header.version)
    };
};

/**
 * UUIDs claimed by more than one pack identity. Bedrock identifies a pack by header UUID and version, and
 * stock servers ship one UUID at several versions (vanilla_1.21.90, chemistry_1.21.20, ...), so header and
 * module UUIDs may repeat across distinct versions of the same header UUID but nowhere else.
 */
const conflictingUuids = (manifests: Array<Manifest>): Set<string> =>
{
    const owners = new Map<string, Array<Manifest>>();
    for (const manifest of manifests)
    {
        for (const id of [ manifest.uuid, ...manifest.moduleUuids ])
        {
            owners.set(id, [ ...(owners.get(id) ?? []), manifest ]);
        }
    }
    const conflicts = new Set<string>();
    for (const [ id, matches ] of owners)
    {
        const versions = new Set(matches.map((manifest: Manifest) => versionText(manifest.version)));
        if (versions.size !== matches.length ||
            matches.some((manifest: Manifest) => manifest.uuid !== matches[0].uuid))
        {
            conflicts.add(id);
        }
    }
    return conflicts;
};

export { conflictingUuids, object, parseManifest, sameVersion, uuid, version, versionText };
