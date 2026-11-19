/**
 * Detection of the Bedrock Dedicated Server release that a `server.properties` file belongs to.
 *
 * The file is taken to sit in the root of a BDS installation.  Detection tries, in order:
 *
 * 1. The file version of `bedrock_server.exe` beside it, which names the exact release, such as
 *    `1.26.63.1`.
 * 2. The newest `vanilla_X.Y.Z` folder in `behavior_packs` or `resource_packs`.  This also covers
 *    Linux servers, whose `bedrock_server` executable carries no version resource.  These folders
 *    name the release without its build number, such as `1.26.63`.
 *
 * A folder with neither is not treated as a BDS installation, and detection yields `undefined`.
 * Detection never throws; unreadable files count as absent.
 *
 * @module bds-intellisense/Detection
 *
 * @file      Detection.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Path from "node:path";
import * as Version from "./Version.js";
import type { BdsVersion } from "./Version.js";
import type { PeVersionInfo } from "./PeVersion.js";
import { ReadPeFileVersionInfo } from "./PeVersion.js";
import { readdir } from "node:fs/promises";

/**
 * Which evidence a detected version came from.
 *
 * @category Types
 * @since 1.0.0
 */
export type DetectionSource = "Executable" | "VanillaPacks";

/**
 * A detected release and the file or folder that showed it.
 *
 * @category Types
 * @since 1.0.0
 */
export interface DetectedVersion
{
    /** The executable or `vanilla_*` folder that the version was read from. */
    readonly Evidence: string;
    readonly Source: DetectionSource;
    readonly Version: BdsVersion;
}

/**
 * File names of the server executable.
 *
 * @category Constants
 * @since 1.0.0
 */
export const ServerExecutable = Object.freeze({
    Linux: "bedrock_server",
    Windows: "bedrock_server.exe"
} as const);

/**
 * Folders of a BDS installation that hold the `vanilla_*` packs.
 *
 * @category Constants
 * @since 1.0.0
 */
export const PackDirectories: ReadonlyArray<string> = Object.freeze([ "behavior_packs", "resource_packs" ]);

/**
 * Matches the name of a versioned vanilla pack folder, capturing its version.
 *
 * @category Constants
 * @since 1.0.0
 */
export const VanillaPackPattern: RegExp = /^vanilla_(\d+(?:\.\d+){1,3})$/u;

/**
 * Lists the paths whose changes can change the detected version of an installation, for editors
 * that watch them to refresh detection.
 *
 * @category Functions
 * @since 1.0.0
 */
export function DetectionInputs(directory: string): Array<string>
{
    return [
        Path.join(directory, ServerExecutable.Windows),
        ...PackDirectories.map((folder: string) => Path.join(directory, folder))
    ];
}

/**
 * Reads the release from the Windows executable of an installation.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function DetectExecutableVersion(directory: string): Promise<DetectedVersion | undefined>
{
    const executable: string = Path.join(directory, ServerExecutable.Windows);
    const info: PeVersionInfo | undefined = await ReadPeFileVersionInfo(executable);
    if (info === undefined || info.FileVersion.every((part: number) => part === 0))
    {
        return undefined;
    }

    return {
        Evidence: executable,
        Source: "Executable",
        Version: info.FileVersion
    };
}

/**
 * Reads the release from the newest versioned vanilla pack folder of an installation.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function DetectVanillaPackVersion(directory: string): Promise<DetectedVersion | undefined>
{
    let newest: DetectedVersion | undefined = undefined;
    for (const folder of PackDirectories)
    {
        const parent: string = Path.join(directory, folder);
        const names: Array<string> = await readdir(parent).catch(() => []);
        for (const name of names)
        {
            const match: RegExpExecArray | null = VanillaPackPattern.exec(name);
            const version: BdsVersion | undefined = match === null ? undefined : Version.Parse(match[1]);
            const newer: boolean = version !== undefined &&
                (newest === undefined || Version.Compare(version, newest.Version) > 0);

            if (version !== undefined && newer)
            {
                newest = {
                    Evidence: Path.join(parent, name),
                    Source: "VanillaPacks",
                    Version: version
                };
            }
        }
    }

    return newest;
}

/**
 * Detects the release of the BDS installation rooted at a folder.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function DetectServerVersionInDirectory(directory: string): Promise<DetectedVersion | undefined>
{
    return await DetectExecutableVersion(directory) ?? await DetectVanillaPackVersion(directory);
}

/**
 * Detects the release of the BDS installation that a `server.properties` file belongs to, taking
 * the file's folder as the installation root.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function DetectServerVersion(propertiesPath: string): Promise<DetectedVersion | undefined>
{
    return await DetectServerVersionInDirectory(Path.dirname(propertiesPath));
}
