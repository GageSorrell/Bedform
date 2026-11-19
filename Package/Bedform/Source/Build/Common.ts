/**
 * Validates and stages packaged common packs and their consumer manifest dependencies.
 *
 * @module bedform/Build/Common
 *
 * @file      Common.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import path from "node:path";

const Identity = Object.freeze({
    Behavior: "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10",
    BehaviorModule: "922982ea-e393-41e5-b397-aaae537a3aee",
    BehaviorScript: "82d1ef5f-59f2-480f-9f04-2e21987e9105",
    Resource: "c15f802e-ae6c-4b64-9037-db7fb035f1e8",
    ResourceModule: "a91ce449-9145-42d5-a221-5652b080338a"
} as const);

/**
 * A validated common pack staged as an mcpack in the owned build workspace.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CommonPack
{
    readonly archive: string;
    readonly kind: string;
    readonly uuid: string;
    readonly version: ReadonlyArray<number>;
}

/**
 * Requires a JSON object while retaining an artifact or manifest diagnostic.
 *
 * @throws { Error } The value is not an object.
 *
 * @category Decoding
 * @since 1.0.0
 */
const object = (value: unknown, label: string): Record<string, unknown> =>
{
    if (!value || typeof value !== "object" || Array.isArray(value))
    {
        throw new Error(`Expected an object in ${label}`);
    }

    return value as Record<string, unknown>;
};

/**
 * Recognizes a Bedrock numeric version triple.
 *
 * @category Guard
 * @since 1.0.0
 */
const version = (value: unknown): value is ReadonlyArray<number> =>
{
    return Array.isArray(value) && value.length === 3 &&
        value.every((part: unknown) => typeof part === "number" && Number.isSafeInteger(part) && part >= 0);
};

/**
 * Compares a manifest dependency or module version with a validated header version.
 *
 * @category Predicate
 * @since 1.0.0
 */
const sameVersion = (value: unknown, expected: ReadonlyArray<number>): boolean =>
{
    return version(value) && value.every((part: number, index: number) => part === expected[index]);
};

/**
 * Resolves the installed package's artifact, validates its pack contract, and stages its two mcpack files.
 * Only fixed archive names are written; inner pack contents are inspected without filesystem extraction.
 *
 * @throws { Error } The bundled common artifact is missing or invalid.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const stageCommon = async (
    workspace: string,
    signal?: AbortSignal
): Promise<ReadonlyArray<CommonPack>> =>
{
    signal?.throwIfAborted();
    const artifact = new URL("../../Asset/bedform-common.mcaddon", import.meta.url);
    const packs: Array<CommonPack> = [];
    const bytes: Array<Uint8Array> = [];
    try
    {
        const outer = unzipSync(await readFile(artifact));
        const names = [ "bedform-common-bp.mcpack", "bedform-common-rp.mcpack" ];
        if (Object.keys(outer).length !== 2 || names.some((name: string) => !Object.hasOwn(outer, name)))
        {
            throw new Error("Expected exactly the common behavior and resource mcpack entries");
        }

        for (const [ index, name ] of names.entries())
        {
            const files = unzipSync(outer[name]);
            if (!Object.hasOwn(files, "manifest.json") || Object.keys(files).some((file: string) =>
                file.includes("\\") || file.startsWith("/") || file.includes(":") ||
                file.split("/").some((part: string) => part === "." || part === "..")))
            {
                throw new Error(`Invalid pack paths or missing manifest in ${name}`);
            }

            const manifest = object(JSON.parse(strFromU8(files["manifest.json"])), name);
            const header = object(manifest.header, name);
            const expected = index === 0 ? Identity.Behavior : Identity.Resource;
            const moduleId = index === 0 ? Identity.BehaviorModule : Identity.ResourceModule;
            if (manifest.format_version !== 2 || header.uuid !== expected || !version(header.version) ||
                !version(header.min_engine_version) || !Array.isArray(manifest.modules) ||
                manifest.modules.length !== (index === 0 ? 2 : 1))
            {
                throw new Error(`Invalid common header or modules in ${name}`);
            }

            const module = object(manifest.modules[0], name);
            if (module.uuid !== moduleId || module.type !== (index === 0 ? "data" : "resources") ||
                !sameVersion(module.version, header.version))
            {
                throw new Error(`Invalid common module in ${name}`);
            }

            if (index === 0)
            {
                // The runtime module registers the built-in controls; its entry must ship in the pack.
                const script = object(manifest.modules[1], name);
                if (script.uuid !== Identity.BehaviorScript || script.type !== "script" ||
                    script.language !== "javascript" || typeof script.entry !== "string" ||
                    !Object.hasOwn(files, script.entry) || !sameVersion(script.version, header.version))
                {
                    throw new Error(`Invalid common script module in ${name}`);
                }

                if (!Array.isArray(manifest.dependencies) || manifest.dependencies.length !== 2)
                {
                    throw new Error("Common behavior pack must depend on its resource pack and " +
                        "@minecraft/server");
                }

                const dependency = object(manifest.dependencies[0], name);
                if (dependency.uuid !== Identity.Resource || !sameVersion(dependency.version, header.version))
                {
                    throw new Error("Invalid common resource dependency");
                }

                const native = object(manifest.dependencies[1], name);
                if (native.module_name !== "@minecraft/server" || typeof native.version !== "string" ||
                    !/^\d+\.\d+\.\d+$/u.test(native.version))
                {
                    throw new Error("Invalid common @minecraft/server dependency");
                }
            }
            else if (manifest.dependencies !== undefined &&
                (!Array.isArray(manifest.dependencies) || manifest.dependencies.length !== 0))
            {
                throw new Error("Unexpected common resource dependencies");
            }

            packs.push({ archive: path.join(workspace, "common", name),
                kind: index === 0 ? "behavior_packs" : "resource_packs",
                uuid: expected,
                version: header.version });
            bytes.push(outer[name]);
        }

        if (!sameVersion(packs[0].version, packs[1].version))
        {
            throw new Error("Common pack versions differ");
        }
    }
    catch (error)
    {
        throw new Error(`Cannot load bundled BedformCommon artifact ${artifact.href}: ` +
            `${error instanceof Error ? error.message : String(error)}. Reinstall Bedform ` +
            "or rebuild it from the source workspace.", { cause: error });
    }

    signal?.throwIfAborted();
    await mkdir(path.join(workspace, "common"), { recursive: true });
    for (const [ index, pack ] of packs.entries())
    {
        signal?.throwIfAborted();
        await writeFile(pack.archive, bytes[index]);
    }

    return packs;
};

/**
 * Adds the corresponding common dependency to a staged manifest, preserving unrelated fields and entries.
 * Existing matching entries are reused; repeated matches are reduced to one entry.
 *
 * @throws { Error } A consumer reuses a reserved UUID or declares a conflicting common version.
 *
 * @category Transforming
 * @since 1.0.0
 */
export const stageCommonDependency = async (file: string, kind: string, packs: ReadonlyArray<CommonPack>)
: Promise<void> =>
{
    const manifest = object(JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/u, "")), file);
    const header = object(manifest.header, file);
    const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
    const ids = [ header.uuid, ...modules.map((module: unknown) => object(module, file).uuid) ];
    if (ids.some((id: unknown) => typeof id === "string" &&
        Object.values(Identity).some((reserved: string) => reserved === id.toLowerCase())))
    {
        throw new Error(`Consumer pack reuses a BedformCommon UUID in ${file}. ` +
            "Bedform includes these packs automatically; " +
            "remove the copied common pack or assign unique UUIDs.");
    }

    if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies))
    {
        throw new Error(`Expected a dependencies array in ${file}`);
    }

    const target = packs.find((pack: CommonPack) => pack.kind === kind)!;
    const dependencies: Array<Record<string, unknown>> = [];
    let found = false;
    for (const value of manifest.dependencies ?? [])
    {
        const dependency = object(value, file);
        const common = packs.find((pack: CommonPack) => typeof dependency.uuid === "string" &&
            pack.uuid === dependency.uuid.toLowerCase());
        if (common && !sameVersion(dependency.version, common.version))
        {
            throw new Error(`Conflicting BedformCommon dependency ${common.uuid} in ${file}: ` +
                `expected version ${common.version.join(".")}, ` +
                `received ${JSON.stringify(dependency.version)}`);
        }

        if (common === target)
        {
            if (found)
            {
                continue;
            }

            found = true;
        }

        dependencies.push(dependency);
    }

    if (!found)
    {
        dependencies.push({ uuid: target.uuid,
            version: target.version });
    }

    manifest.dependencies = dependencies;
    await writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
};
