/**
 * Choice of the schema for a `server.properties` file, and a cache of detected server versions.
 *
 * A manually selected version wins.  Otherwise, when detection is enabled and finds the release
 * of the BDS installation the file belongs to, that release's schema is used.  Failing both, the
 * fallback setting decides: `latest`, or a version such as `1.21.0`.
 *
 * @module bds-intellisense/Resolution
 *
 * @file      Resolution.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Version from "./Version.js";
import { DetectServerVersionInDirectory, type DetectedVersion, DetectionInputs } from "./Detection.js";
import { type SchemaCatalog, SchemaFor, SchemaForSetting } from "./Schema/Catalog.js";
import type { BdsVersion } from "./Version.js";
import { LatestKeyword } from "./Keys.js";
import type { ServerPropertiesSchema } from "./Schema/Types.js";
import type { Stats } from "node:fs";
import { stat } from "node:fs/promises";

/**
 * What decided the schema of a file.
 *
 * @category Types
 * @since 1.0.0
 */
export type SchemaOrigin = "Detected" | "Fallback" | "Manual";

/**
 * The inputs to schema resolution, read from an editor's settings and session state.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ResolutionSettings
{
    /** Whether to detect the release of the installation that the file belongs to. */
    readonly DetectVersion: boolean;
    /** `latest`, or a version, used when there is no manual choice and nothing is detected. */
    readonly FallbackVersion: string;
    /** A version chosen by hand for this file, which overrides detection and the fallback. */
    readonly ManualVersion?: BdsVersion;
}

/**
 * The schema chosen for a file and why it was chosen.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ResolvedSchema
{
    /** The detection result, when detection ran and succeeded. */
    readonly Detected?: DetectedVersion;
    /** Explanations for users, such as why the fallback was used or a setting was ignored. */
    readonly Notes: ReadonlyArray<string>;
    readonly Origin: SchemaOrigin;
    readonly Schema: ServerPropertiesSchema;
    /** The release to show: the manual, detected or fallback version, or the schema's own. */
    readonly Version: BdsVersion;
}

/**
 * Detects the release of the installation in a folder, as {@link DetectServerVersionInDirectory} does.
 *
 * @category Types
 * @since 1.0.0
 */
export type Detector = (directory: string) => Promise<DetectedVersion | undefined>;

/**
 * Detection results remembered per installation folder.
 *
 * @category Types
 * @since 1.0.0
 */
export interface DetectionCache
{
    /** Forgets every remembered result. */
    readonly Clear: () => void;

    /**
     * Detects the release of the installation in a folder.  A remembered result is reused while
     * the folder's executable and pack folders keep their sizes and modification times.
     */
    readonly Detect: (directory: string) => Promise<DetectedVersion | undefined>;
}

/**
 * A remembered detection and the state of the inputs it was made from.
 */
interface CacheEntry
{
    readonly Fingerprint: string;
    readonly Result: Promise<DetectedVersion | undefined>;
}

/**
 * Chooses the schema for a file.  `detect` runs only when detection is enabled and no version was
 * chosen by hand.
 *
 * An unreadable fallback setting falls back to the latest schema, with a note saying so.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function ResolveSchema(
    catalog: SchemaCatalog,
    settings: ResolutionSettings,
    detect: () => Promise<DetectedVersion | undefined>): Promise<ResolvedSchema>
{
    if (settings.ManualVersion !== undefined)
    {
        return {
            Notes: [ `Version ${Version.Format(settings.ManualVersion)} was selected by hand.` ],
            Origin: "Manual",
            Schema: SchemaFor(catalog, settings.ManualVersion),
            Version: settings.ManualVersion
        };
    }

    const notes: Array<string> = [];
    if (settings.DetectVersion)
    {
        const detected: DetectedVersion | undefined = await detect();
        if (detected !== undefined)
        {
            const source: string = detected.Source === "Executable"
                ? "the server executable"
                : "the vanilla pack folders";

            return {
                Detected: detected,
                Notes: [ `Detected from ${source}: ${detected.Evidence}` ],
                Origin: "Detected",
                Schema: SchemaFor(catalog, detected.Version),
                Version: detected.Version
            };
        }

        notes.push("No Bedrock Dedicated Server installation was found beside this file.");
    }
    else
    {
        notes.push("Version detection is turned off.");
    }

    let schema: ServerPropertiesSchema | undefined = SchemaForSetting(catalog, settings.FallbackVersion);
    if (schema === undefined)
    {
        notes.push(`The fallback version "${settings.FallbackVersion}" is neither "${LatestKeyword}" nor a ` +
            "version, so the latest schema is used.");

        schema = catalog.Latest;
    }

    return {
        Notes: notes,
        Origin: "Fallback",
        Schema: schema,
        Version: Version.Parse(settings.FallbackVersion) ?? schema.Version
    };
}

/**
 * Describes the state of the files and folders that detection reads.
 */
async function Fingerprint(directory: string): Promise<string>
{
    const parts: Array<string> = await Promise.all(DetectionInputs(directory).map(async (path: string) =>
    {
        try
        {
            const info: Stats = await stat(path);
            return `${info.size}:${info.mtimeMs}`;
        }
        catch
        {
            return "-";
        }
    }));

    return parts.join("|");
}

/**
 * Creates an empty detection cache.  The detector can be replaced, for tests.
 *
 * @category Functions
 * @since 1.0.0
 */
export function CreateDetectionCache(detect: Detector = DetectServerVersionInDirectory): DetectionCache
{
    const entries: Map<string, CacheEntry> = new Map<string, CacheEntry>();
    return {
        Clear: () => entries.clear(),
        Detect: async (directory: string) =>
        {
            const fingerprint: string = await Fingerprint(directory);
            const entry: CacheEntry | undefined = entries.get(directory);
            if (entry !== undefined && entry.Fingerprint === fingerprint)
            {
                return await entry.Result;
            }

            const result: Promise<DetectedVersion | undefined> = detect(directory);
            entries.set(directory, {
                Fingerprint: fingerprint,
                Result: result
            });

            return await result;
        }
    };
}
