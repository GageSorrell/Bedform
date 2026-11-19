/**
 * Host-only shared project configuration discovery and asynchronous evaluation.
 *
 * @module bedform/Build/ProjectConfig
 *
 * @file      ProjectConfig.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Configuration fields retain domain order and contextual inference. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef */

import { readFile, stat } from "node:fs/promises";
import * as Path from "node:path";
import { pathToFileURL } from "node:url";
import * as Schema from "effect/Schema";
import { BedformConfig } from "../Config.js";
import { BedformConfigSchema, BedformJsonConfigSchema } from "../ConfigSchema.js";

/**
 * Project-root discovery options; an explicit configuration path is relative to root.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface ProjectConfigOptions
{
    readonly root?: string;
    readonly config?: string;
}

/**
 * Validated authored input and effective settings with config-relative filesystem paths resolved.
 * Directory is the selected file's directory, or the project root when no file exists.
 * File is absent for defaults. Input retains property presence for later CLI override reporting.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface LoadedProjectConfig
{
    readonly config: BedformConfig;
    readonly directory: string;
    readonly file?: string;
    readonly input: BedformConfig.Input;
}

/**
 * Checks candidate existence without hiding permission or other filesystem errors.
 *
 * @category Configuration
 * @since 1.0.0
 */
const exists = async (file: string): Promise<boolean> =>
{
    try
    {
        await stat(file);
        return true;
    }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
        {
            return false;
        }

        throw error;
    }
};

/**
 * Resolves compiler and build filesystem fields once while preserving resource-pack asset references.
 *
 * @category Configuration
 * @since 1.0.0
 */
const resolvePaths = (input: BedformConfig.Input, directory: string): BedformConfig =>
{
    const Resolve = (file: string): string => Path.resolve(directory, file);
    const Physics = input.Physics;
    const Build = input.build;
    const Canvas = input.Canvas;
    return BedformConfig({
        ...input,
        ...(Canvas === undefined ? {} : { Canvas: {
            ...Canvas,
            ...(Canvas.ResourcePack === undefined ? {} : { ResourcePack: Resolve(Canvas.ResourcePack) }),
            Images: Canvas.Images.map((image) => ({ ...image,
                Source: Resolve(image.Source) }))
        } }),
        ...(Physics === undefined ? {} : { Physics: {
            ...Physics,
            behaviorPack: Resolve(Physics.behaviorPack),
            resourcePack: Resolve(Physics.resourcePack),
            models: Physics.models.map((model) => model.representation === "particle" ? {
                ...model,
                meshSolid: Resolve(model.meshSolid),
                rendererDescriptor: Resolve(model.rendererDescriptor)
            } : model)
        } }),
        ...(Build === undefined ? {} : { build: {
            ...(Build.behaviorPacks === undefined ? {} : { behaviorPacks: Build.behaviorPacks.map(Resolve) }),
            ...(Build.resourcePacks === undefined ? {} : { resourcePacks: Build.resourcePacks.map(Resolve) }),
            ...(Build.scripts === undefined ? {} : { scripts: Build.scripts.map((script) => ({
                entry: Resolve(script.entry),
                output: Resolve(script.output)
            })) })
        } })
    });
};

/**
 * Loads the selected add-on-root JSON or TypeScript file, or supplies defaults when discovery is empty.
 * Explicit files never fall back. Ambiguous automatic discovery fails before evaluating either file.
 * TypeScript requires a default-exported object and supports asynchronous module initialization.
 *
 * @throws { Error } Discovery, reading, evaluation, or schema validation fails.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const loadProjectConfig = async (options: ProjectConfigOptions = {}): Promise<LoadedProjectConfig> =>
{
    const Root = Path.resolve(options.root ?? process.cwd());
    let file: string | undefined;
    let phase = "discover";
    try
    {
        if (!(await stat(Root)).isDirectory())
        {
            throw new Error(`Project root is not a directory: ${Root}`);
        }

        if (options.config !== undefined)
        {
            if (!options.config.trim())
            {
                throw new Error("Explicit --config must name a JSON or TypeScript file");
            }

            file = Path.resolve(Root, options.config);
        }
        else
        {
            const Candidates = [ "bedform.config.json", "bedform.config.ts" ]
                .map((name) => Path.join(Root, name));
            const Present = await Promise.all(Candidates.map(exists));
            if (Present.every(Boolean))
            {
                throw new Error("Ambiguous project configuration: bedform.config.json and " +
                    "bedform.config.ts exist; select --config");
            }

            file = Candidates.find((_, index) => Present[index]);
        }

        if (file === undefined)
        {
            return { config: BedformConfig({}),
                directory: Root,
                input: {} };
        }

        phase = "read";
        if (!(await stat(file)).isFile())
        {
            throw new Error("Configuration path is not a file");
        }

        const Extension = Path.extname(file).toLowerCase();
        let value: unknown;
        if (Extension === ".json")
        {
            const Text = await readFile(file, "utf8");
            phase = "parse JSON";
            value = JSON.parse(Text.replace(/^\uFEFF/u, "")) as unknown;
        }
        else if (Extension === ".ts")
        {
            phase = "evaluate TypeScript";
            const { createJiti } = await import("jiti");
            const Jiti = createJiti(pathToFileURL(file).href, {
                fsCache: false,
                moduleCache: false,
                interopDefault: false
            });
            const Module = await Jiti.import<Record<string, unknown>>(file);
            if (Module === null || typeof Module !== "object" || !Object.hasOwn(Module, "default"))
            {
                throw new Error("TypeScript configuration must default-export an object");
            }

            value = Module.default;
        }
        else
        {
            throw new Error(`Unsupported configuration extension ${Extension}; expected .json or .ts`);
        }

        phase = "validate";
        if (value === null || typeof value !== "object" || Array.isArray(value))
        {
            throw new Error("Configuration must be an object");
        }

        if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
        {
            throw new Error("Configuration must be a plain object, not a promise or class instance");
        }

        let input: BedformConfig.Input;
        if (Extension === ".json")
        {
            const { $schema: Hint, ...Settings } = Schema.decodeUnknownSync(BedformJsonConfigSchema,
                { onExcessProperty: "error" })(value);
            void Hint;
            input = Settings;
        }
        else
        {
            input = Schema.decodeUnknownSync(BedformConfigSchema, { onExcessProperty: "error" })(value);
        }

        const Directory = Path.dirname(file);
        return { config: resolvePaths(input, Directory),
            directory: Directory,
            file,
            input };
    }
    catch (error)
    {
        const Detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot ${phase} project configuration ${file ?? Root}: ${Detail}`, { cause: error });
    }
};
