/**
 * Virtual physics catalog resolution and collision-safe staged asset generation.
 *
 * @module bedform/Build/PhysicsStage
 *
 * @file      PhysicsStage.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host adapters preserve compiler option grouping and callback inference. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef */
/* Exported declarations carry their documentation before the export keyword. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import * as Ts from "typescript";
import type { Plugin } from "esbuild";
import type { Compilation } from "./Physics.js";

/**
 * A project-relative generated catalog that exists only in the build's virtual filesystem.
 *
 * @category Build
 * @since 1.0.0
 */
export const PhysicsCatalog = "generated/physics/catalog/models.ts" as const;

/**
 * One generated TypeScript module, resolved as though authored beneath the project root.
 *
 * @category Build
 * @since 1.0.0
 */
export interface Catalog
{
    readonly file: string;
    readonly contents: string;
}

/**
 * Compares normalized virtual paths using the host filesystem's case sensitivity.
 *
 * @category Build
 * @since 1.0.0
 */
const same = (left: string, right: string): boolean =>
{
    const Normalize = (file: string): string => Ts.sys.useCaseSensitiveFileNames ?
        Path.resolve(file) : Path.resolve(file).toLowerCase();
    return Normalize(left) === Normalize(right);
};

/**
 * Overlays the generated catalog for TypeScript without changing source or tsconfig files.
 *
 * @category Build
 * @since 1.0.0
 */
export const catalogHost = (catalog: Catalog, original: Ts.CompilerHost): Ts.CompilerHost =>
{
    const Directories = new Set<string>();
    let directory = Path.dirname(catalog.file);
    while (true)
    {
        Directories.add(directory);
        const Parent = Path.dirname(directory);
        if (Parent === directory)
        {
            break;
        }

        directory = Parent;
    }

    return { ...original,
        fileExists: (file) => same(file, catalog.file) || original.fileExists(file),
        readFile: (file) => same(file, catalog.file) ? catalog.contents : original.readFile(file),
        directoryExists: (file) => [ ...Directories ].some((value) => same(file, value)) ||
            (original.directoryExists?.(file) ?? false),
        getSourceFile: (file, languageVersion, onError, shouldCreateNewSourceFile) =>
            same(file, catalog.file) ? Ts.createSourceFile(file, catalog.contents, languageVersion, true) :
                original.getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile) };
};

/**
 * Resolves relative imports of the virtual TS catalog or its emitted JS name during bundling.
 *
 * @category Build
 * @since 1.0.0
 */
export const catalogPlugin = (catalog: Catalog, root: string,
    namespace: string = "bedform-physics-catalog"): Plugin =>
{
    return { name: namespace,
        setup(plugin)
        {
            plugin.onResolve({ filter: /\.[jt]s$/ }, (args) =>
            {
                if (!Path.isAbsolute(args.path) && !args.path.startsWith("."))
                {
                    return undefined;
                }

                const File = Path.resolve(args.resolveDir, args.path);
                return same(File, catalog.file) || same(File, catalog.file.replace(/\.ts$/u, ".js")) ?
                    { path: catalog.file,
                        namespace } : undefined;
            });
            plugin.onLoad({ filter: /.*/,
                namespace }, () => ({ contents: catalog.contents,
                loader: "ts",
                resolveDir: root }));
        } };
};

/**
 * Writes physics overlays into owned staged packs and retains compiler catalogs in the workspace.
 * Authored assets are never replaced, even when their bytes match generated output.
 *
 * @throws { Error } A compiler path is unsafe or collides with authored pack content.
 *
 * @category Build
 * @since 1.0.0
 */
export const stagePhysics = async (compilation: Compilation, behavior: string, resource: string,
    workspace: string, signal?: AbortSignal): Promise<void> =>
{
    const Roots: Readonly<Record<string, string>> = { behavior_pack: behavior,
        resource_pack: resource,
        catalog: Path.join(workspace, "physics/catalog") };
    for (const [ File, Contents ] of Object.entries(compilation.files))
    {
        signal?.throwIfAborted();
        const [ Kind, ...Parts ] = File.split("/");
        if (!Roots[Kind] || !Parts.length || Parts.some((part) => !part || part === "." ||
            part === ".." || part.includes("\\") || part.includes(":")))
        {
            throw new Error(`Unsafe physics output path: ${File}`);
        }

        const Destination = Path.join(Roots[Kind], ...Parts);
        await Fs.mkdir(Path.dirname(Destination), { recursive: true });
        try
        {
            await Fs.writeFile(Destination, Contents, { flag: "wx" });
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code === "EEXIST")
            {
                throw new Error(`Physics output collides with authored content: ${Destination}`);
            }

            throw error;
        }
    }
};
