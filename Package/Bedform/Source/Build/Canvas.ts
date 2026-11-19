/**
 * Shared Canvas artifact validation, surviving-feature detection and staged dependency ownership.
 *
 * @module bedform/Build/Canvas
 *
 * @file      Canvas.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Artifact records preserve their manifest grouping and contextual callbacks. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import type { Metafile } from "esbuild";
import { isDeepStrictEqual } from "node:util";

/**
 * Canvas pack and module identities; Common owns an independent set of UUIDs.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Identity = Object.freeze({
    Behavior: "c9d18475-cf4a-4ae1-bf29-2154f9e7c10a",
    Data: "abfd850a-2928-4d67-b16b-5cf387b1973d",
    Script: "e96cb050-1354-44fd-871d-096e14bf8295",
    Resource: "5cb152c6-0965-4e0a-9870-0e0bebca1398",
    Resources: "850c8f8a-aa4c-4464-bc5e-0f14d1ba67dc"
} as const);

/**
 * Existing asset-backed entry families. Pure React, measurement, image metadata and protocol helpers
 * do not require Canvas assets. New backends can use Canvas/Dependency instead of extending this list.
 *
 * @category Constant
 * @since 1.0.0
 */
export const FeaturePaths = Object.freeze([
    "Canvas/Dependency", "Spatial/Intent", "Spatial/Renderer", "Spatial/Pointer",
    "Spatial/Glyph", "Spatial/Terminal", "Spatial/Window"
]);

/**
 * A discovered source pack; supplying canonical Canvas packs is an explicit inclusion request.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SourcePack
{
    readonly kind: string;
    readonly source: string;
}

/**
 * Validated canonical pack bytes, inspected without extracting archive paths to disk.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CanvasPack
{
    readonly Name: string;
    readonly Kind: string;
    readonly Uuid: string;
    readonly Version: ReadonlyArray<number>;
    readonly Bytes: Uint8Array;
    readonly Files: Readonly<Record<string, Uint8Array>>;
}

/**
 * Existing source Canvas packs and explicit dependencies discovered before script entry selection.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Selection
{
    readonly Required: boolean;
    readonly Supplied: ReadonlyArray<SourcePack>;
}

/**
 * Requires an object and retains an actionable manifest/archive diagnostic.
 *
 * @throws { Error } When a value is not an object.
 *
 * @category Decoding
 * @since 1.0.0
 */
function ObjectOf(value: unknown, label: string): Record<string, unknown>
{
    if (!value || typeof value !== "object" || Array.isArray(value))
    {
        throw new Error(`Expected an object in ${label}`);
    }

    return value as Record<string, unknown>;
}

/**
 * Reads JSON without changing authored bytes, including a possible UTF-8 BOM.
 *
 * @category Decoding
 * @since 1.0.0
 */
async function Manifest(file: string): Promise<Record<string, unknown>>
{
    return ObjectOf(JSON.parse((await Fs.readFile(file, "utf8")).replace(/^\uFEFF/u, "")), file);
}

/**
 * Tests a numeric Bedrock release triple.
 *
 * @category Guard
 * @since 1.0.0
 */
function Version(value: unknown): value is ReadonlyArray<number>
{
    return Array.isArray(value) && value.length === 3 && value.every((part: unknown) =>
        typeof part === "number" && Number.isSafeInteger(part) && part >= 0);
}

/**
 * Compares version triples without coercion.
 *
 * @category Predicate
 * @since 1.0.0
 */
function SameVersion(value: unknown, expected: ReadonlyArray<number>): boolean
{
    return Version(value) && value.every((part: number, index: number) => part === expected[index]);
}

/**
 * Normalizes UUID casing while leaving other manifest values unmatched.
 *
 * @category Converting
 * @since 1.0.0
 */
function Id(value: unknown): string
{
    return typeof value === "string" ? value.toLowerCase() : "";
}

/**
 * Classifies explicit Canvas ownership before discovery chooses consumer script entries. Reserved
 * module UUIDs cannot be reused by consumers or named as pack dependencies.
 *
 * @throws { Error } If a source pack misuses reserved identities or dependencies are malformed.
 *
 * @category Filtering
 * @since 1.0.0
 */
export async function Select(packs: ReadonlyArray<SourcePack>): Promise<Selection>
{
    const supplied: Array<SourcePack> = [];
    let required = false;
    for (const pack of packs)
    {
        const file = Path.join(pack.source, "manifest.json");
        const manifest = await Manifest(file);
        const header = ObjectOf(manifest.header, file);
        const modules = Array.isArray(manifest.modules) ? manifest.modules : [];
        const own = Id(header.uuid);
        const expected = pack.kind === "behavior_packs" ? Identity.Behavior : Identity.Resource;
        if (own === Identity.Behavior || own === Identity.Resource)
        {
            if (own !== expected)
            {
                throw new Error(`BedformCanvas UUID belongs to the other pack kind: ${file}`);
            }

            supplied.push(pack);
            required = true;
        }
        else if ([ own, ...modules.map((module) => Id(ObjectOf(module, file).uuid)) ].some(
            (id) => Object.values(Identity).includes(id as typeof Identity[keyof typeof Identity])))
        {
            throw new Error(`Consumer pack reuses a BedformCanvas UUID: ${file}`);
        }

        if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies))
        {
            throw new Error(`Expected a dependencies array in ${file}`);
        }

        for (const value of manifest.dependencies ?? [])
        {
            const dependency = ObjectOf(value, file);
            const id = Id(dependency.uuid);
            if (id === Identity.Behavior || id === Identity.Resource)
            {
                required = true;
            }
            else if (Object.values(Identity).includes(id as typeof Identity[keyof typeof Identity]))
            {
                throw new Error(`BedformCanvas dependency must use a pack UUID, not a module UUID: ${file}`);
            }
        }
    }

    return Object.freeze({ Required: required,
        Supplied: Object.freeze(supplied) });
}

/**
 * Detects only modules contributing bytes to a finished prebundle. Erased types, dead branches and
 * eliminated imports cannot enable assets. Package-root ownership prevents unrelated lookalike paths
 * from triggering inclusion. Root namespaces, dynamic imports and transitive imports share this path.
 *
 * @category Predicate
 * @since 1.0.0
 */
export async function UsesAssets(meta: Metafile, root: string): Promise<boolean>
{
    const packageRoot = await Fs.realpath(fileURLToPath(new URL("../../", import.meta.url)));
    const normalize = (file: string): string =>
    {
        const normalized = Path.resolve(file).replaceAll("\\", "/");
        return process.platform === "win32" ? normalized.toLowerCase() : normalized;
    };

    const bases = [ "Source", "Distribution" ].map((part) => normalize(Path.join(packageRoot, part)) + "/");
    const owners = new Map<string, boolean>();
    const featureOf = (module: string): boolean => FeaturePaths.some((feature) =>
        module === feature.toLowerCase() || module.startsWith(feature.toLowerCase() + "/"));
    for (const output of Object.values(meta.outputs))
    {
        for (const [ file, contribution ] of Object.entries(output.inputs))
        {
            if (contribution.bytesInOutput === 0)
            {
                continue;
            }

            const input = normalize(Path.resolve(root, file));
            const base = bases.find((prefix) => input.startsWith(prefix));
            if (base)
            {
                const module = input.slice(base.length).replace(/\.[cm]?[jt]sx?$/u, "").toLowerCase();
                if (featureOf(module))
                {
                    return true;
                }

                continue;
            }

            // Transitive packages may have their own installed Bedform copy, rather than the CLI's copy.
            const match = /\/(?:source|distribution)\/((?:canvas|spatial)\/.*)$/iu.exec(input);
            if (!match || !featureOf(match[1].replace(/\.[cm]?[jt]sx?$/u, "").toLowerCase()))
            {
                continue;
            }

            const owner = input.slice(0, match.index);
            if (!owners.has(owner))
            {
                try
                {
                    const metadata = ObjectOf(JSON.parse(await Fs.readFile(
                        Path.join(owner, "package.json"), "utf8")), owner);
                    owners.set(owner, metadata.name === "bedform");
                }
                catch (error)
                {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                    {
                        throw error;
                    }

                    owners.set(owner, false);
                }
            }

            if (owners.get(owner))
            {
                return true;
            }
        }
    }

    return false;
}

/**
 * Loads and validates the installed Canvas artifact independently of Common and feature completeness.
 * No staging directory is created when the artifact is missing or corrupt.
 *
 * @throws { Error } If the packaged artifact is missing, corrupt or inconsistent.
 *
 * @category Decoding
 * @since 1.0.0
 */
export async function Load(): Promise<ReadonlyArray<CanvasPack>>
{
    const artifact = new URL("../../Asset/bedform-canvas.mcaddon", import.meta.url);
    try
    {
        const outer = unzipSync(await Fs.readFile(artifact));
        const names = [ "bedform-canvas-bp.mcpack", "bedform-canvas-rp.mcpack" ];
        if (Object.keys(outer).length !== 2 || names.some((name) => !Object.hasOwn(outer, name)))
        {
            throw new Error("Expected exactly the Canvas behavior and resource mcpack entries");
        }

        const packs: Array<CanvasPack> = [];
        for (const [ index, name ] of names.entries())
        {
            const files = unzipSync(outer[name]);
            if (!Object.hasOwn(files, "manifest.json") || Object.keys(files).some((file) =>
                file.includes("\\") || file.startsWith("/") || file.includes(":") ||
                file.split("/").some((part) => !part || part === "." || part === "..")))
            {
                throw new Error(`Invalid Canvas archive paths in ${name}`);
            }

            const manifest = ObjectOf(JSON.parse(strFromU8(files["manifest.json"])), name);
            const header = ObjectOf(manifest.header, name);
            const expected = index === 0 ? Identity.Behavior : Identity.Resource;
            if (manifest.format_version !== 2 || header.uuid !== expected || !Version(header.version) ||
                !Version(header.min_engine_version) || !Array.isArray(manifest.modules) ||
                manifest.modules.length !== (index === 0 ? 2 : 1))
            {
                throw new Error(`Invalid Canvas header or modules in ${name}`);
            }

            const module = ObjectOf(manifest.modules[0], name);
            if (module.uuid !== (index === 0 ? Identity.Data : Identity.Resources) ||
                module.type !== (index === 0 ? "data" : "resources") ||
                !SameVersion(module.version, header.version))
            {
                throw new Error(`Invalid Canvas module in ${name}`);
            }

            if (index === 0)
            {
                const script = ObjectOf(manifest.modules[1], name);
                if (script.uuid !== Identity.Script || script.type !== "script" ||
                    script.language !== "javascript" || typeof script.entry !== "string" ||
                    !Object.hasOwn(files, script.entry) || !SameVersion(script.version, header.version))
                {
                    throw new Error(`Invalid Canvas script in ${name}`);
                }

                if (!Array.isArray(manifest.dependencies) || manifest.dependencies.length !== 2)
                {
                    throw new Error("Canvas behavior requires its resource pack and @minecraft/server");
                }

                const resource = ObjectOf(manifest.dependencies[0], name);
                const native = ObjectOf(manifest.dependencies[1], name);
                if (resource.uuid !== Identity.Resource || !SameVersion(resource.version, header.version) ||
                    native.module_name !== "@minecraft/server" || typeof native.version !== "string" ||
                    !/^\d+\.\d+\.\d+$/u.test(native.version))
                {
                    throw new Error("Invalid Canvas resource/native dependency");
                }
            }
            else if (manifest.dependencies !== undefined &&
                (!Array.isArray(manifest.dependencies) || manifest.dependencies.length !== 0))
            {
                throw new Error("Unexpected Canvas resource dependencies");
            }

            packs.push(Object.freeze({ Name: name,
                Kind: index === 0 ? "behavior_packs" : "resource_packs",
                Uuid: expected,
                Version: header.version,
                Bytes: outer[name],
                Files: files }));
        }

        if (!SameVersion(packs[0].Version, packs[1].Version))
        {
            throw new Error("Canvas pack versions differ");
        }

        return Object.freeze(packs);
    }
    catch (error)
    {
        throw new Error(`Cannot load bundled BedformCanvas artifact ${artifact.href}: ` +
            `${error instanceof Error ? error.message : String(error)}. Reinstall Bedform ` +
            "or rebuild it from the source workspace.", { cause: error });
    }
}

/**
 * Compares manifest semantics while ignoring UUID casing and the order of module/dependency records.
 * Other fields remain significant, so authored changes are never silently replaced by canonical data.
 *
 * @category Converting
 * @since 1.0.0
 */
function ComparableManifest(bytes: Uint8Array): Record<string, unknown>
{
    const manifest = ObjectOf(JSON.parse(strFromU8(bytes).replace(/^\uFEFF/u, "")), "Canvas manifest");
    const records = (values: unknown): Array<Record<string, unknown>> =>
        (Array.isArray(values) ? values : []).map((value) =>
        {
            const record = ObjectOf(value, "Canvas manifest record");
            return typeof record.uuid === "string" ? { ...record,
                uuid: Id(record.uuid) } : record;
        }).sort((left, right) => String(left.uuid ?? left.module_name).localeCompare(
            String(right.uuid ?? right.module_name)));
    const header = ObjectOf(manifest.header, "Canvas header");
    return { ...manifest,
        header: { ...header,
            uuid: Id(header.uuid) },
        modules: records(manifest.modules),
        dependencies: records(manifest.dependencies) };
}

/**
 * Validates copied source packs against the canonical package, accepting manifest formatting changes
 * but rejecting modified or missing content under the same UUID/version. Copies are deduplicated.
 *
 * @throws { Error } If copied content, identity or versions conflict with the packaged Canvas packs.
 *
 * @category Validation
 * @since 1.0.0
 */
export async function ValidateCopies(sources: ReadonlyArray<SourcePack>, packs: ReadonlyArray<CanvasPack>)
    : Promise<void>
{
    for (const source of sources)
    {
        const expected = packs.find((pack) => pack.Kind === source.kind)!;
        const files = new Map<string, Uint8Array>();
        const collect = async (directory: string, prefix: string = ""): Promise<void> =>
        {
            for (const entry of await Fs.readdir(directory, { withFileTypes: true }))
            {
                const file = Path.join(directory, entry.name);
                if (entry.isSymbolicLink())
                {
                    throw new Error(`BedformCanvas copies cannot contain links: ${file}`);
                }

                if (entry.isDirectory())
                {
                    await collect(file, prefix + entry.name + "/");
                }
                else if (entry.isFile())
                {
                    files.set(prefix + entry.name, await Fs.readFile(file));
                }
                else
                {
                    throw new Error(`Unsupported BedformCanvas copy entry: ${file}`);
                }
            }
        };

        await collect(source.source);
        const same = Object.keys(expected.Files).length === files.size &&
            Object.entries(expected.Files).every(([ name, bytes ]) =>
            {
                const actual = files.get(name);
                return actual !== undefined && (name === "manifest.json"
                    ? isDeepStrictEqual(ComparableManifest(bytes), ComparableManifest(actual))
                    : Buffer.from(bytes).equals(actual));
            });
        if (!same)
        {
            throw new Error(`BedformCanvas UUID/version/content conflict in ${source.source}; ` +
                "use an intact matching Canvas pack or assign unique UUIDs to authored content.");
        }
    }
}

/**
 * Reuses and deduplicates matching Canvas dependencies while preserving unrelated manifest fields.
 * The corresponding pack kind is added once; every existing Canvas version must match.
 *
 * @throws { Error } If a manifest declares an incompatible Canvas version.
 *
 * @category Transforming
 * @since 1.0.0
 */
export async function Dependency(file: string, kind: string, packs: ReadonlyArray<CanvasPack>): Promise<void>
{
    const manifest = await Manifest(file);
    if (manifest.dependencies !== undefined && !Array.isArray(manifest.dependencies))
    {
        throw new Error(`Expected a dependencies array in ${file}`);
    }

    const target = packs.find((pack) => pack.Kind === kind)!;
    const dependencies: Array<Record<string, unknown>> = [];
    const found = new Set<string>();
    for (const value of manifest.dependencies ?? [])
    {
        const dependency = ObjectOf(value, file);
        const canvas = packs.find((pack) => pack.Uuid === Id(dependency.uuid));
        if (canvas)
        {
            if (!SameVersion(dependency.version, canvas.Version))
            {
                throw new Error(`Conflicting BedformCanvas dependency ${canvas.Uuid} in ${file}: ` +
                    `expected ${canvas.Version.join(".")}, received ${JSON.stringify(dependency.version)}`);
            }

            if (found.has(canvas.Uuid))
            {
                continue;
            }

            found.add(canvas.Uuid);
        }

        dependencies.push(dependency);
    }

    if (!found.has(target.Uuid))
    {
        dependencies.push({ uuid: target.Uuid,
            version: target.Version });
    }

    manifest.dependencies = dependencies;
    await Fs.writeFile(file, JSON.stringify(manifest, null, 2) + "\n");
}

/**
 * Stages each canonical Canvas archive exactly once, outside the consumer pack trees.
 *
 * @throws { Error } If a reserved staging destination already exists or cancellation is requested.
 *
 * @category Serialization
 * @since 1.0.0
 */
export async function Stage(workspace: string, packs: ReadonlyArray<CanvasPack>, signal?: AbortSignal)
    : Promise<ReadonlyArray<string>>
{
    signal?.throwIfAborted();
    if (packs.some((pack) => ![ "bedform-canvas-bp.mcpack", "bedform-canvas-rp.mcpack" ].includes(pack.Name)))
    {
        throw new Error("Canvas staging only accepts the fixed Canvas pack archive names.");
    }

    const directory = Path.join(workspace, "canvas-packs");
    await Fs.mkdir(directory, { recursive: true });
    const archives: Array<string> = [];
    for (const pack of packs)
    {
        signal?.throwIfAborted();
        const file = Path.join(directory, pack.Name);
        await Fs.writeFile(file, pack.Bytes, { flag: "wx" });
        archives.push(file);
    }

    return Object.freeze(archives);
}
