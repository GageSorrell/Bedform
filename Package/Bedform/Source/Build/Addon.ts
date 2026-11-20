/**
 * Spatial React script add-on builds with shared asset staging and official bundle/archive tasks.
 *
 * @module bedform/Build/Addon
 *
 * @file      Addon.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Build records preserve pipeline order and contextual callback inference. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration"
] }] */

import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { constants } from "node:fs";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { build } from "esbuild";
import * as Ts from "typescript";
import type { Ignore } from "ignore";
import type { PreparedBuild } from "./Settings.js";
import { compileConfig } from "./Physics.js";
import { PhysicsCatalog, catalogHost, catalogPlugin, stagePhysics, type Catalog } from "./PhysicsStage.js";
import { developmentBoundary } from "./Development.js";
import { stageCommon, stageCommonDependency } from "./Common.js";
import { Compile as compileImages, Stage as stageImages } from "./CanvasImages.js";
import { Select as selectCanvas, Load as loadCanvas, ValidateCopies as validateCanvasCopies,
    UsesAssets as usesCanvasAssets, Dependency as canvasDependency, Stage as stageCanvas } from "./Canvas.js";

namespace OfficialTasks
{
    /**
     * Supported subset of the pinned official bundling task options.
     *
     * @category Build
     * @since 1.0.0
     */
    export interface Bundle
    {
        readonly entryPoint: string;
        readonly outfile: string;
        readonly external: Array<string>;
    }

    /**
     * Official archive task content, with files or directories rooted at the archive top level.
     *
     * @category Build
     * @since 1.0.0
     */
    export interface Content
    {
        readonly contents: Array<string>;
    }
}

/**
 * Narrow host facade for the pinned official task API. This keeps just-scripts' unrelated,
 * optional webpack declarations out of Bedform's public type graph.
 *
 * @category Build
 * @since 1.0.0
 */
interface OfficialTasks
{
    readonly bundleTask: (options: OfficialTasks.Bundle) => () => Promise<void>;
    readonly zipTask: (output: string, contents: Array<OfficialTasks.Content>) => () => Promise<void>;
}

/**
 * Invokes official tasks without allowing their process exit-code bookkeeping to escape the host API.
 *
 * @category Build
 * @since 1.0.0
 */
const officialTask = async (task: () => Promise<void>): Promise<void> =>
{
    const ExitCode = process.exitCode;
    try
    {
        await task();
    }
    finally
    {
        process.exitCode = ExitCode;
    }
};

/**
 * Native engine modules remain external in both compilation passes.
 *
 * @category Build
 * @since 1.0.0
 */
const NativeModules = Object.freeze([ "@minecraft/server", "@minecraft/server-ui", "@minecraft/server-net",
    "@minecraft/server-admin", "@minecraft/server-gametest", "@minecraft/debug-utilities" ]);

/**
 * A discovered pack and its script module entries, all rooted in the original project.
 *
 * @category Build
 * @since 1.0.0
 */
interface Pack
{
    readonly kind: string;
    readonly source: string;
    readonly scripts: ReadonlyArray<string>;
}

/**
 * One original script entry and its manifest-mapped staged output.
 *
 * @category Build
 * @since 1.0.0
 */
interface Script
{
    readonly entry: string;
    readonly output: string;
}

/**
 * Optional cancellation and ordered progress diagnostics for host integrations.
 *
 * @category Build
 * @since 1.0.0
 */
export interface AddonBuildOptions
{
    readonly signal?: AbortSignal;
    readonly log?: (message: string) => void;
}

/**
 * Published archive and retained, uniquely owned intermediate workspace.
 *
 * @category Build
 * @since 1.0.0
 */
export interface AddonBuildResult
{
    readonly archive: string;
    readonly workspace: string;
}

/**
 * Checks existence while preserving permission and other filesystem errors.
 *
 * @category Build
 * @since 1.0.0
 */
const exists = async (file: string): Promise<boolean> =>
{
    try
    {
        await Fs.lstat(file);
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
 * Constrains an authored path to a strict descendant of its declared root.
 *
 * @throws { Error } A path escapes or names the root itself.
 *
 * @category Build
 * @since 1.0.0
 */
const relative = (root: string, file: string): string =>
{
    const Value = Path.relative(root, file);
    if (!Value || Value === ".." || Value.startsWith(`..${Path.sep}`) || Path.isAbsolute(Value))
    {
        throw new Error(`Build path must be inside ${root}: ${file}`);
    }

    return Value;
};

/**
 * Rejects symlink and junction ancestors before using source or destination paths.
 *
 * @throws { Error } An existing ancestor is a link.
 *
 * @category Build
 * @since 1.0.0
 */
const noLinks = async (file: string): Promise<void> =>
{
    let current = Path.resolve(file);
    while (true)
    {
        if (await exists(current) && (await Fs.lstat(current)).isSymbolicLink())
        {
            throw new Error(`Build paths cannot contain symlinks or junctions: ${current}`);
        }

        const Parent = Path.dirname(current);
        if (Parent === current)
        {
            return;
        }

        current = Parent;
    }
};

/**
 * Reads JSON objects with a filename diagnostic, accepting an optional UTF-8 BOM.
 *
 * @throws { Error } A file is malformed or does not contain an object.
 *
 * @category Build
 * @since 1.0.0
 */
const object = async (file: string): Promise<Record<string, unknown>> =>
{
    const Value: unknown = JSON.parse((await Fs.readFile(file, "utf8")).replace(/^\uFEFF/u, ""));
    if (!Value || typeof Value !== "object" || Array.isArray(Value))
    {
        throw new Error(`Expected a JSON object: ${file}`);
    }

    return Value as Record<string, unknown>;
};

/**
 * Discovers immediate conventional packs or explicitly configured pack directories.
 *
 * @throws { Error } A manifest, pack path, or script module entry is invalid.
 *
 * @category Build
 * @since 1.0.0
 */
const discover = async (
    root: string,
    kind: string,
    configured?: ReadonlyArray<string>
): Promise<Array<Pack>> =>
{
    const Parent = Path.join(root, kind);
    const Sources = configured ?? (await exists(Parent) ? (await Fs.readdir(Parent, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory()).map((entry) => Path.join(Parent, entry.name)) : []);
    const Packs: Array<Pack> = [];
    for (const Source of Sources)
    {
        const Relative = relative(root, Source);
        if (Relative.split(Path.sep).some((part) =>
            [ ".git", "node_modules", "intermediate", "dist" ].includes(part.toLowerCase())))
        {
            throw new Error(`Pack source cannot be inside a reserved build/dependency directory: ${Source}`);
        }

        await noLinks(Source);
        const ManifestPath = Path.join(Source, "manifest.json");
        if (!configured && !await exists(ManifestPath))
        {
            continue;
        }

        await noLinks(ManifestPath);
        const Manifest = await object(ManifestPath);
        if (!Manifest.header || !Array.isArray(Manifest.modules) || Manifest.modules.length === 0)
        {
            throw new Error(`Invalid pack manifest: ${ManifestPath}`);
        }

        const Scripts: Array<string> = [];
        for (const Module of Manifest.modules as Array<Record<string, unknown>>)
        {
            if (!Module || typeof Module !== "object")
            {
                throw new Error(`Invalid module in ${ManifestPath}`);
            }

            if (Module.type === "script")
            {
                if (kind !== "behavior_packs" || Module.language !== "javascript" ||
                    typeof Module.entry !== "string" || !Module.entry.endsWith(".js") ||
                    Module.entry.includes("\\") ||
                    Module.entry.split("/").some((part) => !part || part === "." || part === ".."))
                {
                    throw new Error(`Invalid script module entry in ${ManifestPath}`);
                }

                const Output = Path.resolve(Source, Module.entry);
                relative(Source, Output);
                if (Scripts.includes(Output))
                {
                    throw new Error(`Duplicate script module entry: ${Output}`);
                }

                Scripts.push(Output);
            }
        }

        Packs.push({ kind,
            source: Source,
            scripts: Scripts });
    }

    return Packs;
};

/**
 * Matches explicit mappings or one unambiguous conventional TS/TSX entry to each manifest output.
 *
 * @throws { Error } Mappings are duplicated, unmatched, missing, or ambiguous.
 *
 * @category Build
 * @since 1.0.0
 */
const scripts = async (root: string, packs: ReadonlyArray<Pack>, mappings?: ReadonlyArray<Script>)
: Promise<Array<Script>> =>
{
    const Outputs = packs.flatMap((pack) => pack.scripts);
    const Result: Array<Script> = [];
    for (const Mapping of mappings ?? [])
    {
        relative(root, Mapping.entry);
        if (!Outputs.includes(Mapping.output) || Result.some((script) => script.output === Mapping.output))
        {
            throw new Error("Script output must uniquely match a behavior-pack manifest entry: " +
                Mapping.output);
        }

        Result.push(Mapping);
    }

    for (const Output of Outputs.filter((output) => !Result.some((script) => script.output === output)))
    {
        const Candidates = packs.length === 1 && Outputs.length === 1 ?
            [ "Script/main.ts", "Script/main.tsx", "scripts/main.ts", "scripts/main.tsx" ]
                .map((entry) => Path.join(root, entry)) : [];
        // On Windows, differently cased directory names can identify the same source file.
        const Unique = new Map(Candidates.map((file) =>
            [ process.platform === "win32" ? file.toLowerCase() : file, file ]));
        const Present: Array<string> = [];
        for (const File of Unique.values())
        {
            if (await exists(File))
            {
                Present.push(File);
            }
        }

        if (Present.length > 1)
        {
            throw new Error(`Ambiguous script entries: ${Present.join(", ")}; configure build.scripts`);
        }

        const Entry = Present[0] ?? Output;
        if (!await exists(Entry))
        {
            throw new Error(`Missing script entry for ${Output}; configure build.scripts`);
        }

        Result.push({ entry: Entry,
            output: Output });
    }

    for (const Script of Result)
    {
        await noLinks(Script.entry);
        if (!(await Fs.stat(Script.entry)).isFile())
        {
            throw new Error(`Script entry is not a file: ${Script.entry}`);
        }
    }

    return Result;
};

/**
 * Checks the original configured project with JSX settings identical to script compilation.
 *
 * @throws { Error } Configuration parsing or TypeScript diagnostics fail.
 *
 * @category Build
 * @since 1.0.0
 */
const typecheck = async (root: string, entries: ReadonlyArray<Script>, prepared: PreparedBuild,
    catalogs: ReadonlyArray<Catalog> = []): Promise<void> =>
{
    const File = Path.join(root, "tsconfig.json");
    if (!await exists(File))
    {
        return;
    }

    const Read = Ts.readConfigFile(File, Ts.sys.readFile);
    const Parsed = Ts.parseJsonConfigFileContent(Read.config ?? {}, Ts.sys, root, {
        noEmit: true,
        emitDeclarationOnly: false,
        jsx: prepared.settings.typescript.jsx === "react-jsxdev" ?
            Ts.JsxEmit.ReactJSXDev : Ts.JsxEmit.ReactJSX,
        jsxImportSource: prepared.settings.typescript.jsxImportSource
    }, File);
    const Diagnostics = [ ...(Read.error ? [ Read.error ] : []), ...Parsed.errors ];
    if (Diagnostics.length === 0)
    {
        const Sources = new Map<string, string>();
        for (const File of [ ...Parsed.fileNames, ...entries.map((entry) => entry.entry) ])
        {
            const Key = Ts.sys.useCaseSensitiveFileNames ? File : File.toLowerCase();
            if (!Sources.has(Key))
            {
                Sources.set(Key, File);
            }
        }

        const Original = Ts.createCompilerHost(Parsed.options);
        const Program = Ts.createProgram([ ...Sources.values(), ...catalogs.map((catalog) => catalog.file) ],
            Parsed.options, catalogs.reduce((host, catalog) => catalogHost(catalog, host), Original));
        Diagnostics.push(...Ts.getPreEmitDiagnostics(Program));
    }

    if (Diagnostics.length)
    {
        throw new Error(Ts.formatDiagnostics(Diagnostics, {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: () => root,
            getNewLine: () => "\n"
        }));
    }
};

/**
 * Appends the effective Intermediate rule only to an existing root gitignore, preserving its encoding.
 *
 * @category Build
 * @since 1.0.0
 */
const ignoreIntermediate = async (root: string): Promise<void> =>
{
    const File = Path.join(root, ".gitignore");
    if (!await exists(File))
    {
        return;
    }

    await noLinks(File);
    const Bytes = await Fs.readFile(File);
    const BigEndian = Bytes[0] === 0xfe && Bytes[1] === 0xff;
    const Utf16 = BigEndian || Bytes[0] === 0xff && Bytes[1] === 0xfe;
    const Decoded = BigEndian ? Buffer.from(Bytes).swap16() : Bytes;
    const Encoding = Utf16 ? "utf16le" : "utf8";
    const Text = Decoded.toString(Encoding);
    const MakeIgnore = createRequire(import.meta.url)("ignore") as () => Ignore;
    const Rules = MakeIgnore().add(Text.replace(/^\uFEFF/u, ""));
    if (Rules.ignores("Intermediate/") && Rules.ignores("Intermediate/.bedform-probe"))
    {
        return;
    }

    const Eol = Text.includes("\r\n") ? "\r\n" : "\n";
    const Prefix = Text.length && !Text.endsWith("\n") ? Eol : "";
    const Addition = Buffer.from(`${Prefix}/Intermediate/${Eol}`, Encoding);
    // Appending leaves all authored bytes, including BOM and original line endings, intact.
    await Fs.appendFile(File, BigEndian ? Addition.swap16() : Addition);
};

/**
 * Copies pack assets into an owned stage without source code, model inputs, dependency trees, or links.
 *
 * @throws { Error } A source link or unsupported model input is encountered.
 *
 * @category Build
 * @since 1.0.0
 */
const copyPack = async (source: string, destination: string, signal?: AbortSignal): Promise<void> =>
{
    signal?.throwIfAborted();
    await Fs.mkdir(destination, { recursive: true });
    for (const Entry of await Fs.readdir(source, { withFileTypes: true }))
    {
        const File = Path.join(source, Entry.name);
        const Name = Entry.name.toLowerCase();
        if (Entry.isSymbolicLink())
        {
            throw new Error(`Pack assets cannot contain links: ${File}`);
        }

        if (Entry.isDirectory())
        {
            if (![ ".git", "node_modules", "intermediate", "dist" ].includes(Name))
            {
                await copyPack(File, Path.join(destination, Entry.name), signal);
            }
        }
        else if (/\.(?:blend|bbmodel)$/u.test(Name))
        {
            throw new Error(`Model conversion is not available in script-only builds: ${File}`);
        }
        else if (!/\.(?:tsx?|mts|cts|mcaddon|mcpack)$/u.test(Name))
        {
            await Fs.copyFile(File, Path.join(destination, Entry.name));
        }
    }
};

/**
 * Stages packs, compiles strict-aware scripts, invokes official tasks, then atomically publishes.
 * Preflight must already have resolved configuration and logged every explicit override.
 * Dependencies resolve from original script paths; builds never install or probe optional model tools.
 * Failed workspaces remain available and previous published archives are preserved.
 *
 * @throws { Error } Discovery, typechecking, compilation, packaging, or publication fails.
 *
 * @category Build
 * @since 1.0.0
 */
export const buildAddon = async (prepared: PreparedBuild, options: AddonBuildOptions = {})
: Promise<AddonBuildResult> =>
{
    const Root = Path.resolve(prepared.arguments.root ?? process.cwd());
    const Log = options.log ?? (() => {});
    const Signal = options.signal;
    Signal?.throwIfAborted();
    const Build = prepared.project.config.build;
    const Packs = [ ...await discover(Root, "behavior_packs", Build?.behaviorPacks),
        ...await discover(Root, "resource_packs", Build?.resourcePacks) ];
    if (!Packs.length || new Set(Packs.map((pack) => pack.source.toLowerCase())).size !== Packs.length)
    {
        throw new Error("Build requires at least one unique behavior or resource pack");
    }

    // Overlapping packs would create duplicate staged content and ambiguous output ownership.
    for (const Pack of Packs)
    {
        for (const Other of Packs)
        {
            if (Pack !== Other && Path.relative(Pack.source, Other.source).split(Path.sep)[0] !== "..")
            {
                throw new Error(`Pack directories overlap: ${Pack.source} and ${Other.source}`);
            }
        }
    }

    const CanvasSelection = await selectCanvas(Packs);
    const CanvasPacks = CanvasSelection.Required ? await loadCanvas() : undefined;
    if (CanvasPacks)
    {
        await validateCanvasCopies(CanvasSelection.Supplied, CanvasPacks);
    }

    const Consumers = Packs.filter((pack) => !CanvasSelection.Supplied.includes(pack));
    const ManagedScripts = Packs.filter((pack) => CanvasSelection.Supplied.includes(pack))
        .flatMap((pack) => pack.scripts);
    const Mappings = Build?.scripts?.filter((mapping) =>
    {
        if (!ManagedScripts.some((output) => Path.relative(output, mapping.output) === ""))
        {
            return true;
        }

        if (Path.relative(mapping.entry, mapping.output) !== "")
        {
            throw new Error(`Cannot replace a canonical BedformCanvas script: ${mapping.output}`);
        }

        return false;
    });
    const Scripts = await scripts(Root, Consumers.filter((pack) => pack.scripts.length), Mappings);
    const Physics = prepared.project.config.Physics;
    if (Physics)
    {
        for (const [ Kind, Source ] of [ [ "behavior_packs", Physics.behaviorPack ],
            [ "resource_packs", Physics.resourcePack ] ])
        {
            if (!Consumers.some((pack) => pack.kind === Kind &&
                Path.relative(pack.source, Source) === ""))
            {
                throw new Error(`Physics ${Kind} root must match a discovered ${Kind} pack: ${Source}`);
            }
        }
    }

    const CatalogFile = Path.join(Root, PhysicsCatalog);
    if (Physics)
    {
        await noLinks(CatalogFile);
        if (await exists(CatalogFile) || await exists(CatalogFile.replace(/\.ts$/u, ".js")))
        {
            throw new Error(`Physics catalog collides with authored content: ${CatalogFile}`);
        }

        Log("Compiling physics");
        Signal?.throwIfAborted();
    }

    const Compilation = Physics ? await compileConfig(Physics, prepared.project.directory) : undefined;
    const Catalog = Compilation ? { file: CatalogFile,
        contents: Compilation.files["catalog/models.ts"] } : undefined;
    const Canvas = prepared.project.config.Canvas;
    const Images = Canvas ? await compileImages(Canvas, Root,
        Consumers.filter((pack) => pack.kind === "resource_packs").map((pack) => pack.source), Signal)
        : undefined;
    const Catalogs = [ ...(Catalog ? [ Catalog ] : []), ...(Images ? [ Images.Catalog ] : []) ];
    Signal?.throwIfAborted();
    Log("Typechecking scripts");
    await typecheck(Root, Scripts, prepared, Catalogs);
    Signal?.throwIfAborted();
    const Intermediate = Path.join(Root, "Intermediate", "bedform");
    await noLinks(Intermediate);
    await ignoreIntermediate(Root);
    await Fs.mkdir(Intermediate, { recursive: true });
    const Workspace = await Fs.mkdtemp(Path.join(Intermediate, "build-"));
    Log(`Staging add-on in ${Workspace}`);
    try
    {
        const BundleConfig = Path.join(Workspace, "tsconfig.bundle.json");
        const ProjectConfig = Path.join(Root, "tsconfig.json");
        await Fs.writeFile(BundleConfig, JSON.stringify({
            ...await exists(ProjectConfig) ? { extends: ProjectConfig } : {},
            compilerOptions: prepared.settings.typescript
        }));
        Signal?.throwIfAborted();
        const Stage = Path.join(Workspace, "source");
        const Common = await stageCommon(Workspace, Signal);
        for (const Pack of Consumers)
        {
            const Destination = Path.join(Stage, relative(Root, Pack.source));
            await copyPack(Pack.source, Destination, Signal);
            Signal?.throwIfAborted();
            await stageCommonDependency(Path.join(Destination, "manifest.json"), Pack.kind, Common);
        }

        if (Compilation && Physics)
        {
            Log("Generating physics assets");
            await stagePhysics(Compilation, Path.join(Stage, relative(Root, Physics.behaviorPack)),
                Path.join(Stage, relative(Root, Physics.resourcePack)), Workspace, Signal);
        }

        if (Images)
        {
            await stageImages(Images, Path.join(Stage, relative(Root, Images.ResourcePack)),
                Workspace, Signal);
        }

        const Official = createRequire(import.meta.url)("@minecraft/core-build-tasks") as OfficialTasks;
        let NeedsCanvas = CanvasSelection.Required;
        for (const [ Index, Script ] of Scripts.entries())
        {
            Signal?.throwIfAborted();
            const Compiled = Path.join(Workspace, "compiled", `${Index}.js`);
            // The official task has no define/JSX extension point. Resolve these in a complete
            // neutral prebundle, then pass its JS (with only native externals) to the official task.
            const Bundle = await build({ ...prepared.settings.bundle,
                tsconfig: BundleConfig,
                absWorkingDir: Root,
                entryPoints: [ Script.entry ],
                outfile: Compiled,
                bundle: true,
                format: "esm",
                target: "es2022",
                platform: "neutral",
                external: [ ...NativeModules ],
                logLevel: "silent",
                metafile: true,
                plugins: [ developmentBoundary(prepared.settings),
                    ...Catalogs.map((catalog, index) =>
                        catalogPlugin(catalog, Root, `bedform-catalog-${index}`)), {
                        name: "bedform-runtime-boundary",
                        setup(plugin)
                        {
                            const Host =
                                /^(node:|effect($|\/)|@effect\/|jiti($|\/)|bedform\/(Config|Build)($|\/))/;
                            plugin.onResolve({ filter: Host },
                                (args) => ({ errors: [ {
                                    text: `Host-only import cannot enter a Bedrock bundle: ${args.path}`
                                } ] }));
                        }
                    } ] });
            NeedsCanvas ||= await usesCanvasAssets(Bundle.metafile!, Root);
            Signal?.throwIfAborted();
            await officialTask(Official.bundleTask({ entryPoint: Compiled,
                outfile: Path.join(Stage, relative(Root, Script.output)),
                external: [ ...NativeModules ] }));
        }

        const CanvasArchives: ReadonlyArray<string> = NeedsCanvas ? await (async () =>
        {
            Log("Including BedformCanvas");
            const Selected = CanvasPacks ?? await loadCanvas();
            for (const Pack of Consumers)
            {
                await canvasDependency(Path.join(Stage, relative(Root, Pack.source), "manifest.json"),
                    Pack.kind, Selected);
            }

            return stageCanvas(Workspace, Selected, Signal);
        })() : [];
        const Archives: Array<string> = [];
        for (const [ Index, Pack ] of Consumers.entries())
        {
            Signal?.throwIfAborted();
            const Archive = Path.join(Workspace, `${Index}-${Path.basename(Pack.source)}.mcpack`);
            await officialTask(Official.zipTask(Archive,
                [ { contents: [ Path.join(Stage, relative(Root, Pack.source)) ] } ]));
            Archives.push(Archive);
        }

        Archives.push(...Common.map((pack) => pack.archive));
        Archives.push(...CanvasArchives);
        const Candidate = Path.join(Workspace, "addon.mcaddon");
        await officialTask(Official.zipTask(Candidate, [ { contents: Archives } ]));
        Signal?.throwIfAborted();
        const PackagePath = Path.join(Root, "package.json");
        const Package = await exists(PackagePath) ? await object(PackagePath) : {};
        const Name = (typeof Package.name === "string" ? Package.name.split("/").at(-1) :
            Path.basename(Root)) ?? "addon";
        if (!/^[\w.-]+$/u.test(Name) || Name === "." || Name === "..")
        {
            throw new Error(`Cannot derive archive name from package/directory: ${Name}`);
        }

        const Output = Path.resolve(Root, prepared.arguments.output ?? "dist");
        const Archive = Output.toLowerCase().endsWith(".mcaddon") ? Output :
            Path.join(Output, `${Name}.mcaddon`);
        await noLinks(Archive);
        await Fs.mkdir(Path.dirname(Archive), { recursive: true });
        const Temporary = `${Archive}.${randomUUID()}.tmp`;
        try
        {
            await Fs.copyFile(Candidate, Temporary, constants.COPYFILE_EXCL);
            Signal?.throwIfAborted();
            await Fs.rename(Temporary, Archive);
        }
        finally
        {
            await Fs.rm(Temporary, { force: true });
        }

        return { archive: Archive,
            workspace: Workspace };
    }
    catch (error)
    {
        throw new Error(`Add-on build failed; intermediate workspace retained at ${Workspace}: ` +
            `${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
};
