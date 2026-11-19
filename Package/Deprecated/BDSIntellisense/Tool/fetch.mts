/**
 * Downloads the default `server.properties` of every BDS release listed in `Tool/versions.json`.
 *
 * Each file is extracted from the official server zip with Range requests and saved, byte for
 * byte, as `Data/Pristine/<version>.properties`.  Releases already saved are skipped unless
 * `--force` is given.  Each release is tried from the Windows zip first and then the Linux zip.
 * Releases that neither host serves are reported and skipped.
 *
 * `--refresh-versions` first replaces `Tool/versions.json` with the stable releases from 1.16.0 on,
 * taken from the community-maintained list at {@link UpstreamVersionList}.
 *
 * Usage: `npm run fetch --workspace bds-intellisense [-- --refresh-versions] [-- --force]`
 *
 * @module bds-intellisense/Tool/fetch
 *
 * @file      fetch.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import * as Version from "../Source/Version.ts";
import { type ArchiveReader, ExtractEntry, OpenRemoteArchive } from "./RemoteZip.mts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import process from "node:process";

/**
 * The release names each platform's host serves; the same release can be spelt differently on
 * each, such as `1.16.10.02` and `1.16.10.2`.
 *
 * @category Tools
 * @since 1.0.0
 */
export interface VersionList
{
    /** The download root, under which `bin-win/` and `bin-linux/` hold the zips. */
    readonly CdnRoot: string;
    readonly Linux: ReadonlyArray<string>;
    /** Where and when the list was taken from. */
    readonly Source: string;
    readonly Windows: ReadonlyArray<string>;
}

/**
 * One platform's spelling of a release.
 */
interface Candidate
{
    readonly Name: string;
    readonly Platform: "bin-linux" | "bin-win";
}

/**
 * A release and the downloads that can supply it.
 */
interface Release
{
    readonly Candidates: Array<Candidate>;
    readonly Version: Version.BdsVersion;
}

namespace UpstreamList
{
    /**
     * One platform's releases.
     *
     * @category Tools
     * @since 1.0.0
     */
    export interface Platform
    {
        readonly versions: ReadonlyArray<string>;
    }
}

/**
 * The upstream list's JSON shape, of which only the stable release names are used.
 */
interface UpstreamList
{
    readonly cdn_root: string;
    readonly linux: UpstreamList.Platform;
    readonly windows: UpstreamList.Platform;
}

/**
 * The community-maintained list of BDS releases.
 *
 * @category Tools
 * @since 1.0.0
 */
export const UpstreamVersionList: string =
    "https://raw.githubusercontent.com/Bedrock-OSS/BDS-Versions/main/versions.json";

/** The folder holding this package's `package.json`. */
const PackageRoot: string = Path.resolve(import.meta.dirname, "..");

/** Where downloaded files are saved. */
const PristineDirectory: string = Path.join(PackageRoot, "Data", "Pristine");

/** The release list this tool reads. */
const VersionListPath: string = Path.join(PackageRoot, "Tool", "versions.json");

/** The oldest release with a bundled schema. */
const MinimumVersion: Version.BdsVersion = [ 1, 16, 0 ];

/** Identifies this tool to the download host. */
const UserAgent: string = "bds-intellisense-generator";

/** Releases downloaded at once. */
const Concurrency: number = 4;

/**
 * Writes a line of progress.
 */
function Log(message: string): void
{
    process.stdout.write(`${message}\n`);
}

/**
 * Keeps the names of releases from the minimum version on, oldest first.
 */
function Supported(names: ReadonlyArray<string>): Array<string>
{
    return names
        .filter((name: string) =>
        {
            const version: Version.BdsVersion | undefined = Version.Parse(name);
            return version !== undefined && Version.Compare(version, MinimumVersion) >= 0;
        })
        .sort((left: string, right: string) => Version.Compare(Version.Parse(left)!, Version.Parse(right)!));
}

/**
 * Replaces the release list with the upstream list's stable releases.
 *
 * @throws { Error } When the upstream list cannot be fetched.
 */
async function RefreshVersionList(): Promise<void>
{
    const response: Response = await fetch(UpstreamVersionList, { headers: { "User-Agent": UserAgent } });
    if (!response.ok)
    {
        throw new Error(`${UpstreamVersionList} answered ${response.status}.`);
    }

    const upstream: UpstreamList = await response.json() as UpstreamList;
    const list: VersionList = {
        CdnRoot: upstream.cdn_root,
        Linux: Supported(upstream.linux.versions),
        Source: `${UpstreamVersionList}, retrieved ${new Date().toISOString().slice(0, 10)}`,
        Windows: Supported(upstream.windows.versions)
    };

    await writeFile(VersionListPath, `${JSON.stringify(list, undefined, 2)}\n`);
    Log(`Wrote ${list.Windows.length} Windows and ${list.Linux.length} Linux releases to versions.json.`);
}

/**
 * Groups both platforms' release names by release, Windows first.
 */
function Releases(list: VersionList): Array<Release>
{
    const releases: Map<string, Release> = new Map<string, Release>();
    const add: (name: string, platform: Candidate["Platform"]) => void =
        (name: string, platform: Candidate["Platform"]) =>
        {
            const version: Version.BdsVersion | undefined = Version.Parse(name);
            if (version === undefined)
            {
                return;
            }

            const key: string = Version.Format(version);
            const release: Release | undefined = releases.get(key);
            const candidate: Candidate = {
                Name: name,
                Platform: platform
            };

            if (release === undefined)
            {
                releases.set(key, {
                    Candidates: [ candidate ],
                    Version: version
                });
            }
            else
            {
                release.Candidates.push(candidate);
            }
        };

    list.Windows.forEach((name: string) => add(name, "bin-win"));
    list.Linux.forEach((name: string) => add(name, "bin-linux"));
    return [ ...releases.values() ].sort((left: Release, right: Release) =>
        Version.Compare(left.Version, right.Version));
}

/**
 * Downloads one release's default file, or yields `undefined` when no host serves the release.
 *
 * @throws { Error } When a host serves the zip but it cannot be read.
 */
async function FetchRelease(list: VersionList, release: Release): Promise<Uint8Array | undefined>
{
    for (const candidate of release.Candidates)
    {
        const url: string = `${list.CdnRoot}/${candidate.Platform}/bedrock-server-${candidate.Name}.zip`;
        const archive: ArchiveReader | undefined = await OpenRemoteArchive(url, UserAgent);
        if (archive !== undefined)
        {
            const file: Uint8Array | undefined = await ExtractEntry(archive, "server.properties");
            if (file !== undefined)
            {
                return file;
            }
        }
    }

    return undefined;
}

/**
 * Fetches every release not yet saved and reports the outcome.
 */
async function Main(): Promise<void>
{
    const options: Array<string> = process.argv.slice(2);
    if (options.includes("--refresh-versions"))
    {
        await RefreshVersionList();
    }

    const force: boolean = options.includes("--force");
    const list: VersionList = JSON.parse(await readFile(VersionListPath, "utf8")) as VersionList;
    await mkdir(PristineDirectory, { recursive: true });

    const pending: Array<Release> = Releases(list).filter((release: Release) =>
        force || !existsSync(Path.join(PristineDirectory, `${Version.Format(release.Version)}.properties`)));

    const missing: Array<string> = [];
    const failed: Array<string> = [];
    let saved: number = 0;
    const worker: () => Promise<void> = async () =>
    {
        let release: Release | undefined = pending.shift();
        for (; release !== undefined; release = pending.shift())
        {
            const name: string = Version.Format(release.Version);
            try
            {
                const file: Uint8Array | undefined = await FetchRelease(list, release);
                if (file === undefined)
                {
                    missing.push(name);
                    Log(`${name}: not available`);
                    continue;
                }

                await writeFile(Path.join(PristineDirectory, `${name}.properties`), file);
                saved++;
                Log(`${name}: saved (${file.length} bytes)`);
            }
            catch (error: unknown)
            {
                failed.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
                Log(`${name}: failed`);
            }
        }
    };

    await Promise.all(Array.from({ length: Concurrency }, worker));
    Log(`Saved ${saved}; ${missing.length} not available; ${failed.length} failed.`);
    for (const name of missing.sort())
    {
        Log(`  not available: ${name}`);
    }

    for (const message of failed.sort())
    {
        Log(`  failed: ${message}`);
    }

    process.exitCode = failed.length === 0 ? 0 : 1;
}

await Main();
