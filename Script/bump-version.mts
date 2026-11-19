/**
 * Bumps workspace and pack versions so clients download rebuilt packs.
 *
 * @module bedform-monorepo/Script/bump-version
 *
 * @file      bump-version.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
// Bumps the version of the add-on or resource pack in the current directory, so clients that cached
// an earlier build download the new one. Usage (from a package directory):
//   node --import tsx ../../Script/bump-version.mts [patch|minor|major]
// The new version is one step past the highest of package.json and the pack manifests. It is written
// to package.json, the repository's package-lock.json and every manifest.json at the package root or
// under behavior_packs/* and resource_packs/*: each pack header, each module, and each dependency on
// one of those packs. Only the version literals change, so each file keeps its formatting.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";

/**
 * A pack or module version as manifests write it: an array, or a string in format version 3.
 *
 * @category Tools
 * @since 1.0.0
 */
type ManifestVersion = [ number, number, number ] | string;

namespace Manifest
{
    /**
     * The pack's identity and version.
     *
     * @category Tools
     * @since 1.0.0
     */
    export interface Header
    {
        uuid: string;
        version: ManifestVersion;
    }

    /**
     * One module of the pack.
     *
     * @category Tools
     * @since 1.0.0
     */
    export interface Module
    {
        version?: ManifestVersion;
    }

    /**
     * A dependency on a pack, by UUID, or on a script module, by name.
     *
     * @category Tools
     * @since 1.0.0
     */
    export interface Dependency
    {
        uuid?: string;
        version?: ManifestVersion;
    }
}

/**
 * The fields of a manifest that carry versions.
 *
 * @category Tools
 * @since 1.0.0
 */
interface Manifest
{
    header: Manifest.Header;
    modules?: Array<Manifest.Module>;
    dependencies?: Array<Manifest.Dependency>;
}

/**
 * One file to rewrite, with its original and updated text.
 *
 * @category Tools
 * @since 1.0.0
 */
interface Change
{
    readonly file: string;
    readonly before: string;
    readonly after: string;
}

/**
 * The version component each bump level increments.
 *
 * @category Tools
 * @since 1.0.0
 */
const Levels = Object.freeze({ major: 0,
    minor: 1,
    patch: 2 } as const);

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Reports the failure and exits with a nonzero status.
 *
 * @category Tools
 * @since 1.0.0
 */
function fail(message: string): never
{
    console.error(`bump-version: ${message}`);
    process.exit(1);
}

/**
 * Parses a version from either manifest form or a package.json string.
 *
 * @category Tools
 * @since 1.0.0
 */
function triple(value: unknown, where: string): [ number, number, number ]
{
    const parts = typeof value === "string" ? value.split(".").map(Number) : value;
    if (!Array.isArray(parts) || parts.length !== 3 ||
        !parts.every((part: unknown) => Number.isSafeInteger(part) && (part as number) >= 0))
    {
        fail(`${where} has no plain major.minor.patch version: ${JSON.stringify(value)}`);
    }

    return parts as [ number, number, number ];
}

/**
 * Orders two versions.
 *
 * @category Tools
 * @since 1.0.0
 */
function compare(a: ReadonlyArray<number>, b: ReadonlyArray<number>): number
{
    return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Writes a version in the form the original value used.
 *
 * @category Tools
 * @since 1.0.0
 */
function like(original: ManifestVersion, version: [ number, number, number ]): ManifestVersion
{
    return typeof original === "string" ? version.join(".") : [ ...version ];
}

/**
 * Lists the pack manifests that belong to the package in a directory.
 *
 * @category Tools
 * @since 1.0.0
 */
function manifestFiles(directory: string): Array<string>
{
    const files = [ path.join(directory, "manifest.json") ];
    for (const kind of [ "behavior_packs", "resource_packs" ])
    {
        const packs = path.join(directory, kind);
        if (existsSync(packs))
        {
            for (const entry of readdirSync(packs, { withFileTypes: true }))
            {
                if (entry.isDirectory())
                {
                    files.push(path.join(packs, entry.name, "manifest.json"));
                }
            }
        }
    }

    return files.filter((file: string) => existsSync(file));
}

/**
 * Replaces every `"version"` value that spells one of the old versions, keeping its spacing.
 *
 * @category Tools
 * @since 1.0.0
 */
function replaceVersions(
    text: string,
    old: ReadonlyArray<[ number, number, number ]>,
    next: [ number, number, number ]
): string
{
    for (const [ a, b, c ] of old)
    {
        const array = new RegExp(
            `("version"\\s*:\\s*)\\[(\\s*)${a}(\\s*,\\s*)${b}(\\s*,\\s*)${c}(\\s*)\\]`, "g");
        text = text.replace(array, (_match: string, key: string, s0: string, s1: string,
            s2: string, s3: string) => `${key}[${s0}${next[0]}${s1}${next[1]}${s2}${next[2]}${s3}]`);
        const string = new RegExp(`("version"\\s*:\\s*)"${a}\\.${b}\\.${c}"`, "g");
        text = text.replace(string, (_match: string, key: string) => `${key}"${next.join(".")}"`);
    }

    return text;
}

const flags = process.argv.slice(2).filter((argument: string) => argument.startsWith("--"));
const levels = process.argv.slice(2).filter((argument: string) => !argument.startsWith("--"));
const level = levels[0] ?? "patch";
if (levels.length > 1 || !Object.hasOwn(Levels, level) || flags.length > 0)
{
    fail("Usage: bump-version.mts [patch|minor|major]");
}

const directory = process.cwd();
const packageFile = path.join(directory, "package.json");
if (!existsSync(packageFile))
{
    fail(`No package.json in ${directory}`);
}

const files = manifestFiles(directory);
if (!files.length)
{
    fail(`No pack manifest in ${directory}`);
}

const packageText = readFileSync(packageFile, "utf8");
const packageJson = JSON.parse(packageText);
const texts = files.map((file: string) => readFileSync(file, "utf8"));
const manifests: Array<Manifest> = texts.map((text: string) => JSON.parse(text));
const headers = manifests.map((manifest: Manifest, index: number) =>
    triple(manifest.header?.version, path.relative(directory, files[index])));
const current = [ triple(packageJson.version, "package.json"), ...headers ]
    .sort(compare)
    .at(-1)!;
const next: [ number, number, number ] = [ ...current ];
next[Levels[level as keyof typeof Levels]]++;
for (let index = Levels[level as keyof typeof Levels] + 1; index < 3; index++)
{
    next[index] = 0;
}

const uuids = new Set(manifests.map((manifest: Manifest) => manifest.header.uuid));
const changes: Array<Change> = [];
for (const [ index, file ] of files.entries())
{
    // Decide on the parsed manifest what must change, then require the text edit to do exactly that.
    const expected: Manifest = structuredClone(manifests[index]);
    expected.header.version = like(expected.header.version, next);
    for (const module of expected.modules ?? [])
    {
        if (module.version !== undefined)
        {
            module.version = like(module.version, next);
        }
    }

    for (const dependency of expected.dependencies ?? [])
    {
        if (dependency.uuid && uuids.has(dependency.uuid) && dependency.version !== undefined)
        {
            dependency.version = like(dependency.version, next);
        }
    }

    const after = replaceVersions(texts[index], headers, next);
    if (!isDeepStrictEqual(JSON.parse(after), expected))
    {
        fail(`${path.relative(directory, file)} has a version this script cannot update safely; ` +
            "update it by hand.");
    }

    changes.push({ after,
        before: texts[index],
        file });
}

const packageAfter = packageText.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${next.join(".")}"`);
if (!isDeepStrictEqual(JSON.parse(packageAfter), { ...packageJson,
    version: next.join(".") }))
{
    fail("package.json has a version this script cannot update safely; update it by hand.");
}

changes.push({ after: packageAfter,
    before: packageText,
    file: packageFile });

// npm records each workspace's version in the root lockfile; keep it in step with package.json.
const lockFile = path.join(repository, "package-lock.json");
const workspace = path.relative(repository, directory).replaceAll("\\", "/");
if (existsSync(lockFile))
{
    const lockText = readFileSync(lockFile, "utf8");
    const lock = JSON.parse(lockText);
    const entry = lock.packages?.[workspace];
    if (entry?.version !== undefined)
    {
        if (JSON.stringify(lock, null, 2) + "\n" !== lockText)
        {
            fail("package-lock.json is not in npm's format; run npm install, then try again.");
        }

        entry.version = next.join(".");
        changes.push({ after: JSON.stringify(lock, null, 2) + "\n",
            before: lockText,
            file: lockFile });
    }
}

for (const change of changes)
{
    if (change.after !== change.before)
    {
        writeFileSync(change.file, change.after);
    }
}

console.log(`Bumped ${packageJson.name} from ${current.join(".")} to ${next.join(".")}:`);
for (const change of changes)
{
    console.log(`  ${path.relative(repository, change.file).replaceAll("\\", "/")}`);
}
