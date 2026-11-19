#!/usr/bin/env node
/**
 * Bedform physics build and project configuration command-line entrypoint.
 *
 * @module bedform/Bin
 *
 * @file      Bin.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Discriminants and vector channels precede related fields. */

/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import { compile, publish } from "./Build/Physics.js";
import { parseBuildArguments, prepareBuild } from "./Build/Settings.js";

/**
 * Recognizes the versioned standalone JSON physics format without evaluating TS configuration.
 * Shared configurations, including those containing Physics, use project preflight instead.
 *
 * @throws { Error } An explicitly selected JSON file cannot be read or parsed.
 *
 * @category CLI
 * @since 1.0.0
 */
const isLegacyPhysicsConfig = async (file: string): Promise<boolean> =>
{
    const { extname } = await import("node:path");
    if (extname(file).toLowerCase() !== ".json")
    {
        return false;
    }

    const { readFile } = await import("node:fs/promises");
    const Value: unknown = JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/u, ""));
    const Legacy = Value !== null && typeof Value === "object" && !Array.isArray(Value) &&
        Object.hasOwn(Value, "schemaVersion");
    if (Legacy && [ "Physics", "DDUI", "Development", "Canvas", "build" ]
        .some((key: string) => Object.hasOwn(Value, key)))
    {
        throw new Error("Ambiguous configuration: nest standalone physics fields under Physics; " +
            "do not combine schemaVersion with shared project settings at the root");
    }

    return Legacy;
};

/**
 * Runs project configuration validation or the explicitly requested physics build.
 *
 * @category CLI
 * @since 1.0.0
 */
const main = async (args: ReadonlyArray<string>): Promise<void> =>
{
    if (args.length === 0 || args.includes("--help"))
    {
        process.stdout.write("Usage: bedform build --config bedform.config.json --out <directory>\n" +
            "       bedform build [source-directory] [--ddui-strict[=true|false]] [--config <file>]\n" +
            "                     [--development]\n" +
            "                     [--allow-development-modules-in-production[=true|false]]\n" +
            "       bedform config validate [source-directory] [--config <file>]\n");
        return;
    }

    if (args[0] === "config" && args[1] === "validate")
    {
        let root: string | undefined;
        let config: string | undefined;
        for (let index = 2; index < args.length; index++)
        {
            const Argument = args[index];
            if (Argument === "--config" && config === undefined)
            {
                config = args[++index];
                if (!config || config.startsWith("--"))
                {
                    throw new Error("--config requires a file");
                }
            }
            else if (!Argument.startsWith("--") && root === undefined)
            {
                root = Argument;
            }
            else
            {
                throw new Error(`Invalid or repeated option ${Argument}`);
            }
        }

        const { loadProjectConfig } = await import("./Build/ProjectConfig.js");
        const Loaded = await loadProjectConfig({ config,
            root });
        process.stdout.write(`${JSON.stringify({ config: Loaded.config,
            directory: Loaded.directory,
            file: Loaded.file ?? null }, null, 2)}\n`);
        return;
    }

    if (args[0] !== "build")
    {
        throw new Error(`Unknown command ${args[0]}`);
    }

    const Options = parseBuildArguments(args.slice(1));
    const { resolve } = await import("node:path");
    const Legacy = Options.config !== undefined &&
        await isLegacyPhysicsConfig(resolve(Options.root ?? process.cwd(), Options.config));
    if (Legacy && (Options.root !== undefined || Options.strict !== undefined ||
        Options.development !== undefined || Options.allowDevelopmentModulesInProduction !== undefined))
    {
        throw new Error("Standalone physics configuration does not accept a source directory " +
            "or shared build flags. " +
            "Move its fields under Physics in bedform.config.json to build an add-on");
    }

    if (!Legacy)
    {
        const Log = (message: string): void =>
        {
            process.stderr.write(`${message}\n`);
        };

        const Prepared = await prepareBuild(Options, Log);
        const { buildAddon } = await import("./Build/Addon.js");
        const Result = await buildAddon(Prepared, { log: Log });
        process.stdout.write(`Built ${Result.archive}\n`);
        return;
    }

    const Config = Options.config;
    const Output = Options.output;
    if (!Config || !Output)
    {
        throw new Error("build requires --config and --out");
    }

    process.stderr.write("Legacy standalone physics build: migrate these fields under Physics in " +
        "bedform.config.json and use bedform build to produce an add-on; " +
        "this invocation still publishes overlays.\n");

    const Compilation = await compile(Config);
    await publish(Compilation, Output);
    process.stdout.write(`Compiled ${Compilation.models.length} physics model(s) to ${Output}\n`);
};

await main(process.argv.slice(2)).catch((error: unknown) =>
{
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});

