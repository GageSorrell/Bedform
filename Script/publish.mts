/**
 * Publishes every publishable workspace for the current branch, in dependency order.
 *
 * @module bedform-monorepo/Script/publish
 *
 * @file      publish.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
// Usage: node --import tsx Script/publish.mts [--dry-run]
// Order: @bedform/effect, the @bedform/* mirrors, bedform, then bedrock-server-manager. Mirrors publish
// under the branch's channel tag (`dev` on Master, `beta` on Beta); other prereleases publish under
// their prerelease identifier, such as `alpha`, and releases under `latest`. A version that is already
// on the registry is skipped, so an interrupted run can simply be repeated. npm's own prompts, such as
// two-factor approval in the browser, pass through to the terminal.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The fields of a workspace manifest that publishing reads.
 *
 * @category Tools
 * @since 1.0.0
 */
interface Manifest
{
    readonly name: string;
    readonly version: string;
    readonly private?: boolean;
}

/**
 * One workspace to publish and the dist-tag it publishes under.
 *
 * @category Tools
 * @since 1.0.0
 */
interface Release
{
    readonly Directory: string;
    readonly Name: string;
    readonly Version: string;
    readonly Tag: string;
}

const Repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Npm = process.platform === "win32" ? "npm.cmd" : "npm";

/** Package directories that are not mirrors, in the order they publish around the mirrors. */
const First: ReadonlyArray<string> = [ "Package/Effect" ];
const Last: ReadonlyArray<string> = [ "Package/Bedform", "Package/Deprecated/BedrockServerManager" ];

/**
 * Prints a message and exits with a nonzero status.
 *
 * @category Tools
 * @since 1.0.0
 */
function fail(message: string): never
{
    console.error(message);
    process.exit(1);
}

/**
 * Reads a workspace manifest relative to the repository root.
 *
 * @category Tools
 * @since 1.0.0
 */
function manifestOf(directory: string): Manifest
{
    return JSON.parse(readFileSync(path.join(Repository, directory, "package.json"), "utf8")) as Manifest;
}

/**
 * Reports whether the registry already holds a package version.
 *
 * @category Tools
 * @since 1.0.0
 */
function isPublished(name: string, version: string): boolean
{
    const result = spawnSync(Npm, [ "view", `${name}@${version}`, "version", "--prefer-online" ],
        { cwd: Repository,
            encoding: "utf8",
            shell: process.platform === "win32" });
    return result.status === 0 && result.stdout.trim() === version;
}

/**
 * Picks the dist-tag for a non-mirror version: its prerelease identifier, or `latest` for a release.
 *
 * @category Tools
 * @since 1.0.0
 */
function tagOf(version: string): string
{
    const prerelease = version.split("+")[0].split("-").slice(1).join("-");
    return prerelease ? prerelease.split(".")[0] : "latest";
}

const dryRun = process.argv.includes("--dry-run");
const unknown = process.argv.slice(2).filter((argument: string) => argument !== "--dry-run");
if (unknown.length > 0)
{
    fail("Usage: publish.mts [--dry-run]");
}

const status = execFileSync("git", [ "status", "--porcelain" ], { cwd: Repository,
    encoding: "utf8" }).trim();
if (status && !dryRun)
{
    fail("Commit or stash changes first: packages publish from a clean checkout.");
}

const branch = execFileSync("git", [ "rev-parse", "--abbrev-ref", "HEAD" ], { cwd: Repository,
    encoding: "utf8" }).trim();
const channel = branch === "Beta" ? "beta" : branch === "Master" ? "dev" : fail(
    `Publish from Master or Beta, not ${branch}.`);

// Every directory directly under Package/ other than Bedform, Effect and Deprecated is a mirror.
const mirrors = readdirSync(path.join(Repository, "Package"), { withFileTypes: true })
    .filter((entry: Dirent) => entry.isDirectory() &&
        ![ "Bedform", "Deprecated", "Effect" ].includes(entry.name) &&
        existsSync(path.join(Repository, "Package", entry.name, "package.json")))
    .map((entry: Dirent) => `Package/${entry.name}`)
    .sort();

const releases: Array<Release> = [];
for (const directory of [ ...First, ...mirrors, ...Last ])
{
    const manifest = manifestOf(directory);
    if (manifest.private)
    {
        continue;
    }

    releases.push({ Directory: directory,
        Name: manifest.name,
        Tag: mirrors.includes(directory) ? channel : tagOf(manifest.version),
        Version: manifest.version });
}

for (const release of releases)
{
    const label = `${release.Name}@${release.Version} (${release.Tag})`;
    if (isPublished(release.Name, release.Version))
    {
        console.log(`Skipping ${label}: already published.`);
        continue;
    }

    console.log(`${dryRun ? "Would publish" : "Publishing"} ${label}`);
    const result = spawnSync(Npm, [ "publish", "--workspace", release.Name, "--tag", release.Tag,
        "--access", "public", ...dryRun ? [ "--dry-run" ] : [] ], { cwd: Repository,
        shell: process.platform === "win32",
        stdio: "inherit" });
    if (result.status !== 0)
    {
        fail(`Publishing ${label} failed; fix the cause and run this script again to resume.`);
    }
}
