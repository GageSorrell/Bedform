/**
 * Production enforcement for Prototype modules in the real script dependency graph.
 *
 * @module bedform/Build/Development
 *
 * @file      Development.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Graph callbacks retain the host plugin's contextual types. */
/* eslint-disable sort-imports, @typescript-eslint/typedef */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import type { Plugin } from "esbuild";
import type { BuildSettings } from "./Settings.js";

/**
 * Identifies resolved Prototype files by their owning Bedform package, including symlink targets.
 * Unrelated project folders named Prototype are permitted.
 *
 * @throws { Error } Filesystem access or package metadata is invalid.
 *
 * @category Build
 * @since 1.0.0
 */
const prototypeFile = async (file: string): Promise<boolean> =>
{
    const File = await Fs.realpath(file);
    let directory = Path.dirname(File);
    while (true)
    {
        try
        {
            const Package = JSON.parse(await Fs.readFile(Path.join(directory, "package.json"), "utf8"));
            if (typeof Package.name === "string")
            {
                return Package.name === "bedform" &&
                    /^(?:source|distribution)\/prototype\//u.test(Path.relative(directory, File)
                        .split(Path.sep).join("/").toLowerCase());
            }
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT")
            {
                throw error;
            }
        }

        const Parent = Path.dirname(directory);
        if (Parent === directory)
        {
            return false;
        }

        directory = Parent;
    }
};

/**
 * Rejects reachable Prototype imports in production, including transitive and physical file imports.
 * Type-only imports erased by compilation do not enter this graph. Permission never injects assets.
 *
 * @category Build
 * @since 1.0.0
 */
export const developmentBoundary = (settings: BuildSettings): Plugin =>
{
    const Diagnostic = (file: string) => ({ errors: [ {
        text: `Prototype runtime module is development-only: ${file}. Use --development, or explicitly ` +
            "permit production use with --allow-development-modules-in-production. " +
            "These flags do not create a Prototype world or inject its assets."
    } ] });
    return { name: "bedform-development-boundary",
        setup(plugin)
        {
            if (settings.development || settings.allowDevelopmentModulesInProduction)
            {
                return;
            }

            plugin.onResolve({ filter: /^bedform\/Prototype(?:\/|$)/ }, (args) => Diagnostic(args.path));
            plugin.onLoad({ filter: /[\\/]Prototype[\\/]/i,
                namespace: "file" }, async (args) =>
                await prototypeFile(args.path) ? Diagnostic(args.path) : undefined);
        } };
};
