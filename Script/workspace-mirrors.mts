/**
 * Discovers npm mirror workspaces without classifying native forks as mirrors.
 *
 * @module bedform-monorepo/Script/workspace-mirrors
 *
 * @file      workspace-mirrors.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
import { existsSync, readdirSync } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

/**
 * Returns package directories eligible for the mirror publishing channel.
 * Cinnabar stays excluded even if a local native build adds an npm manifest.
 *
 * @category Getter
 * @since 1.0.0
 */
export function discoverMirrors(repository: string): ReadonlyArray<string>
{
    return readdirSync(path.join(repository, "Package"), { withFileTypes: true })
        .filter((entry: Dirent) => entry.isDirectory() &&
            ![ "Bedform", "Cinnabar", "Deprecated", "Effect" ].includes(entry.name) &&
            existsSync(path.join(repository, "Package", entry.name, "package.json")))
        .map((entry: Dirent) => `Package/${entry.name}`)
        .sort();
}
