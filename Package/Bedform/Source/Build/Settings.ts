/**
 * Host build parsing and preflight settings, resolved before any staging or compilation.
 *
 * @module bedform/Build/Settings
 *
 * @file      Settings.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Build options retain domain grouping and contextual inference. */
/* eslint-disable sort-keys */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type { LoadedProjectConfig } from "./ProjectConfig.js";

/**
 * Compile-time replacement token consumed by the pure DDUI build-mode module.
 *
 * @category Build
 * @since 1.0.0
 */
export const StrictModeDefine = "BedformDDUIStrict" as const;

/**
 * Parsed build arguments; omitted strict preserves project configuration authority.
 *
 * @category Build
 * @since 1.0.0
 */
export interface BuildArguments
{
    readonly root?: string;
    readonly config?: string;
    readonly output?: string;
    readonly strict?: boolean;
    readonly development?: boolean;
    readonly allowDevelopmentModulesInProduction?: boolean;
}

export namespace BuildSettings
{
    /**
     * Options applied together by strict-aware compilation before official script bundling.
     *
     * @category Build
     * @since 1.0.0
     */
    export interface Bundle
    {
        readonly define: Readonly<Record<string, string>>;
        readonly jsx: "automatic";
        readonly jsxDev: boolean;
        readonly jsxImportSource: "bedform/DDUI";
    }

    /**
     * Matching TypeScript JSX selection for consumer checking.
     *
     * @category Build
     * @since 1.0.0
     */
    export interface TypeScript
    {
        readonly jsx: "react-jsx" | "react-jsxdev";
        readonly jsxImportSource: "bedform/DDUI";
    }
}

/**
 * One effective mode drives runtime substitution, source metadata, and typechecking.
 *
 * @category Build
 * @since 1.0.0
 */
export interface BuildSettings
{
    readonly strict: boolean;
    readonly development: boolean;
    readonly allowDevelopmentModulesInProduction: boolean;
    readonly bundle: BuildSettings.Bundle;
    readonly typescript: BuildSettings.TypeScript;
}

/**
 * Validated configuration and effective build settings, with no filesystem writes.
 *
 * @category Build
 * @since 1.0.0
 */
export interface PreparedBuild
{
    readonly arguments: BuildArguments;
    readonly project: LoadedProjectConfig;
    readonly settings: BuildSettings;
}

/**
 * Parses supported strict flags without coercion; duplicates fail even when values agree.
 * Value flags require a following nonempty argument. One source-directory argument is allowed.
 *
 * @throws { Error } Unknown, malformed, or repeated arguments are supplied.
 *
 * @category Build
 * @since 1.0.0
 */
export const parseBuildArguments = (args: ReadonlyArray<string>): BuildArguments =>
{
    let root: string | undefined;
    let config: string | undefined;
    let output: string | undefined;
    let strict: boolean | undefined;
    let development: boolean | undefined;
    let allowDevelopmentModulesInProduction: boolean | undefined;
    for (let index = 0; index < args.length; index++)
    {
        const Argument = args[index];
        if (Argument === "--ddui-strict" || Argument.startsWith("--ddui-strict="))
        {
            if (strict !== undefined)
            {
                throw new Error("Repeated option --ddui-strict");
            }

            const Value = Argument === "--ddui-strict" ? "true" : Argument.slice("--ddui-strict=".length);
            if (Value !== "true" && Value !== "false")
            {
                throw new Error("--ddui-strict accepts only true or false");
            }

            if (Argument === "--ddui-strict" && [ "true", "false" ].includes(args[index + 1]))
            {
                throw new Error("Use --ddui-strict=true or --ddui-strict=false for an explicit value");
            }

            strict = Value === "true";
        }
        else if (Argument === "--development")
        {
            if (development !== undefined)
            {
                throw new Error("Repeated option --development");
            }

            if ([ "true", "false" ].includes(args[index + 1]))
            {
                throw new Error("--development is a presence-only flag");
            }

            development = true;
        }
        else if (Argument === "--allow-development-modules-in-production" ||
            Argument.startsWith("--allow-development-modules-in-production="))
        {
            if (allowDevelopmentModulesInProduction !== undefined)
            {
                throw new Error("Repeated option --allow-development-modules-in-production");
            }

            const Flag = "--allow-development-modules-in-production";
            const Value = Argument === Flag ? "true" : Argument.slice(Flag.length + 1);
            if (Value !== "true" && Value !== "false" ||
                Argument === Flag && [ "true", "false" ].includes(args[index + 1]))
            {
                throw new Error(`${Flag} accepts only a bare flag or =true or =false`);
            }

            allowDevelopmentModulesInProduction = Value === "true";
        }
        else if (Argument === "--config" || Argument === "--out")
        {
            const Value = args[++index];
            if (!Value?.trim() || Value.startsWith("--"))
            {
                throw new Error(`${Argument} requires a value`);
            }

            if (Argument === "--config")
            {
                if (config !== undefined)
                {
                    throw new Error("Repeated option --config");
                }

                config = Value;
            }
            else
            {
                if (output !== undefined)
                {
                    throw new Error("Repeated option --out");
                }

                output = Value;
            }
        }
        else if (Argument.startsWith("-") || root !== undefined || !Argument.trim())
        {
            throw new Error(`Invalid build argument ${Argument}`);
        }
        else
        {
            root = Argument;
        }
    }

    return { root,
        config,
        output,
        strict,
        ...(development === undefined ? {} : { development }),
        ...(allowDevelopmentModulesInProduction === undefined ? {} :
            { allowDevelopmentModulesInProduction }) };
};

/**
 * Resolves the flag over an authored value, logging every explicit replacement including equal values.
 * The input configuration remains unchanged and absent flags produce no override diagnostic.
 *
 * @category Build
 * @since 1.0.0
 */
export const resolveBuildSettings = (project: LoadedProjectConfig, strict: boolean | undefined,
    log: (message: string) => void, options: Pick<BuildArguments,
        "development" | "allowDevelopmentModulesInProduction"> = {}): BuildSettings =>
{
    const Configured = project.input.DDUI?.StrictMode;
    if (strict !== undefined && Configured !== undefined)
    {
        log(`DDUI.StrictMode override: config=${Configured}, --ddui-strict=${strict}`);
    }

    const Effective = strict ?? Configured ?? false;
    const Permission = project.input.Development?.AllowDevelopmentModulesInProduction;
    const Override = options.allowDevelopmentModulesInProduction;
    if (Override !== undefined && Permission !== undefined)
    {
        log(`Development.AllowDevelopmentModulesInProduction override: config=${Permission}, ` +
            `--allow-development-modules-in-production=${Override}`);
    }

    return {
        strict: Effective,
        development: options.development ?? false,
        allowDevelopmentModulesInProduction: Override ?? Permission ?? false,
        bundle: { define: { [StrictModeDefine]: String(Effective) },
            jsx: "automatic",
            jsxDev: Effective,
            jsxImportSource: "bedform/DDUI" },
        typescript: { jsx: Effective ? "react-jsxdev" : "react-jsx",
            jsxImportSource: "bedform/DDUI" }
    };
};

/**
 * Loads project configuration and logs overrides before returning control to any build stage.
 * No staging, compilation, archive publication, or dependency installation occurs here.
 *
 * @throws { Error } Project configuration cannot be loaded or validated.
 *
 * @category Build
 * @since 1.0.0
 */
export const prepareBuild = async (options: BuildArguments,
    log: (message: string) => void): Promise<PreparedBuild> =>
{
    const { loadProjectConfig } = await import("./ProjectConfig.js");
    const Project = await loadProjectConfig({ root: options.root,
        config: options.config });
    return { arguments: options,
        project: Project,
        settings: resolveBuildSettings(Project, options.strict, log, options) };
};
