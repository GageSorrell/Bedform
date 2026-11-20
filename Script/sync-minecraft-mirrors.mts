/**
 * Creates and versions the `@bedform/*` mirror of every `@minecraft/*` npm package.
 *
 * @module bedform-monorepo/Script/sync-minecraft-mirrors
 *
 * @file      sync-minecraft-mirrors.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */
// Usage: node --import tsx Script/sync-minecraft-mirrors.mts [--channel dev|beta] [--check]
// Each mirror's version is its first-party counterpart's version with `-<channel>.1` appended. The
// counterpart's version is its `latest` release when that is stable, and otherwise its `beta` release.
// The channel defaults to `beta` on the Beta branch and `dev` everywhere else. Missing mirrors are
// scaffolded under Package/<Name>; existing mirrors only have their version and their exact
// first-party dependency rewritten, so hand-written sources survive. --check fails instead of writing.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * How a mirror re-exports its first-party package.
 *
 * - `native`: a Script API module the game provides at runtime, required as an exact peer.
 * - `library`: a JavaScript package, required as an exact dependency and re-exported.
 * - `types`: a declaration-only package, re-exported as types.
 * - `cli`: a command-line package with no module entry point, required but not re-exported.
 *
 * @category Tools
 * @since 1.0.0
 */
type Kind = "cli" | "library" | "native" | "types";

/**
 * One first-party package and the mirror that corresponds to it.
 *
 * @category Tools
 * @since 1.0.0
 */
interface Mirror
{
    /** The unscoped package name shared by both packages, such as `server-ui`. */
    readonly Name: string;
    /** The mirror's directory under Package/, such as `ServerUI`. */
    readonly Directory: string;
    /** The exact first-party version the mirror tracks. */
    readonly Upstream: string;
    /** The mirror's own version: the first-party version with the channel suffix appended. */
    readonly Version: string;
    /** How the mirror depends on and re-exports the first-party package. */
    readonly Kind: Kind;
}

/**
 * The registry subset of a published version that decides a mirror's kind.
 *
 * @category Tools
 * @since 1.0.0
 */
interface VersionDocument
{
    readonly main?: string;
    readonly exports?: unknown;
    readonly bin?: unknown;
}

const Registry = "https://registry.npmjs.org";
const Repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const Generator = "Script/sync-minecraft-mirrors.mts";
const Author = Object.freeze({ email: "gage@sorrell.sh",
    name: "Gage Sorrell",
    url: "https://sorrell.sh" });
const TypeScriptVersion = "6.0.3";

/** Script API modules that the game provides at runtime; their npm packages hold only declarations. */
const Native: ReadonlySet<string> = new Set([ "common", "debug-utilities", "diagnostics", "server",
    "server-admin", "server-editor", "server-gametest", "server-graphics", "server-net", "server-ui" ]);

/** Name segments whose PascalCase spelling is not a plain capitalization. */
const Segments: Readonly<Record<string, string>> = Object.freeze({ gametest: "GameTest",
    ui: "UI" });

/**
 * Prints a message and exits with a nonzero status.
 *
 * @category Tools
 * @since 1.0.0
 */
function fail(message: string): never
{
    console.error(message);
    process.exit(1);
}

/**
 * Fetches and parses a JSON document from the public npm registry.
 *
 * @throws { Error } When the registry does not answer with a success status.
 *
 * @category Tools
 * @since 1.0.0
 */
async function fetchJson<Document>(url: string): Promise<Document>
{
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok)
    {
        throw new Error(`GET ${url} answered ${response.status}.`);
    }

    return await response.json() as Document;
}

/**
 * Converts an unscoped package name such as `server-gametest` to its directory name, `ServerGameTest`.
 *
 * @category Tools
 * @since 1.0.0
 */
function directoryOf(name: string): string
{
    return name.split("-").map((segment: string) =>
        Segments[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1)).join("");
}

/**
 * Classifies a first-party package from its name and published entry points.
 *
 * @category Tools
 * @since 1.0.0
 */
function kindOf(name: string, document: VersionDocument): Kind
{
    if (Native.has(name))
    {
        return "native";
    }

    // Only the root entry point matters: a JSON or declaration subpath is not a module to re-export.
    const exports = document.exports;
    const subpaths = typeof exports === "object" && exports !== null &&
        Object.keys(exports).some((key: string) => key.startsWith("."));
    const root: unknown = subpaths ? (exports as Record<string, unknown>)["."] : exports;
    const runnable = document.main !== undefined || typeof root === "string" ||
        (typeof root === "object" && root !== null &&
            [ "import", "require", "default" ].some((condition: string) => condition in root));
    if (runnable)
    {
        return "library";
    }

    return document.bin === undefined ? "types" : "cli";
}

/**
 * Picks the channel from the command line, or from the current branch when none is given.
 *
 * @category Tools
 * @since 1.0.0
 */
function channelOf(argv: ReadonlyArray<string>): string
{
    const index = argv.indexOf("--channel");
    if (index >= 0)
    {
        const channel = argv[index + 1];
        if (channel !== "dev" && channel !== "beta")
        {
            fail("--channel must be dev or beta.");
        }

        return channel;
    }

    const branch = execFileSync("git", [ "rev-parse", "--abbrev-ref", "HEAD" ], { cwd: Repository,
        encoding: "utf8" }).trim();
    return branch === "Beta" ? "beta" : "dev";
}

/**
 * Resolves every package in the `@minecraft` npm organization to its mirror.
 *
 * @category Tools
 * @since 1.0.0
 */
async function resolveMirrors(channel: string): Promise<ReadonlyArray<Mirror>>
{
    const organization = await fetchJson<Record<string, string>>(`${Registry}/-/org/minecraft/package`);
    const names = Object.keys(organization).filter((name: string) => name.startsWith("@minecraft/"))
        .map((name: string) => name.slice("@minecraft/".length)).sort();
    return await Promise.all(names.map(async (name: string): Promise<Mirror> =>
    {
        const encoded = `@minecraft%2F${name}`;
        const tags = await fetchJson<Record<string, string>>(`${Registry}/-/package/${encoded}/dist-tags`);
        const latest = tags.latest;
        const upstream = latest !== undefined && !latest.includes("-") ? latest : tags.beta ?? latest;
        if (upstream === undefined)
        {
            throw new Error(`@minecraft/${name} has neither a latest nor a beta release.`);
        }

        const document = await fetchJson<VersionDocument>(`${Registry}/${encoded}/${upstream}`);
        return { Directory: directoryOf(name),
            Kind: kindOf(name, document),
            Name: name,
            Upstream: upstream,
            Version: `${upstream}-${channel}.1` };
    }));
}

/**
 * Renders the generated entry module that re-exports the first-party package.
 *
 * @category Tools
 * @since 1.0.0
 */
function entryModule(mirror: Mirror): string
{
    const upstream = `@minecraft/${mirror.Name}`;
    const description = {
        cli: `Placeholder entry point; \`${upstream}\` is a command-line package with nothing to re-export.`,
        library: `Re-exports \`${upstream}\` for \`@bedform/${mirror.Name}\`.`,
        native: `Re-exports the \`${upstream}\` Script API module for \`@bedform/${mirror.Name}\`.`,
        types: `Re-exports the declarations of \`${upstream}\` for \`@bedform/${mirror.Name}\`.`
    }[mirror.Kind];
    const body = {
        cli: "export {};",
        library: `export * from "${upstream}";`,
        native: `export * from "${upstream}";`,
        types: `export type * from "${upstream}";`
    }[mirror.Kind];
    return [
        "/**",
        ` * ${description}`,
        " *",
        ` * This module is auto-generated by ${Generator}.`,
        " *",
        ` * @module @bedform/${mirror.Name}/index`,
        " *",
        " * @file      index.ts",
        " * @author    Gage Sorrell <gage@sorrell.sh>",
        " * @copyright (c) 2026 Gage Sorrell",
        " * @license   MIT",
        " */",
        "",
        "/* eslint-disable */",
        "",
        body,
        ""
    ].join("\n");
}

/**
 * Renders a new mirror's package manifest.
 *
 * @category Tools
 * @since 1.0.0
 */
function manifest(mirror: Mirror): string
{
    const upstream = `@minecraft/${mirror.Name}`;
    const pin = { [upstream]: mirror.Upstream };
    // Entry arrays keep package.json in its conventional key order rather than alphabetical order.
    const fields: Array<[ string, unknown ]> = [
        [ "name", `@bedform/${mirror.Name}` ],
        [ "version", mirror.Version ],
        [ "description", `Bedform's counterpart to ${upstream}: everything it exports, extended by ` +
            "Bedform." ],
        [ "license", "MIT" ],
        [ "author", Author ],
        [ "repository", Object.fromEntries([ [ "type", "git" ],
            [ "url", "git+https://github.com/GageSorrell/Bedform.git" ],
            [ "directory", `Package/${mirror.Directory}` ] ]) ],
        [ "type", "module" ],
        [ "main", "./Distribution/index.js" ],
        [ "types", "./Distribution/index.d.ts" ],
        [ "exports", { ".": Object.fromEntries([ [ "types", "./Distribution/index.d.ts" ],
            [ "import", "./Distribution/index.js" ] ]),
        "./package.json": "./package.json" } ],
        [ "sideEffects", false ],
        [ "files", [ "Distribution", "License.md", "ReadMe.md" ] ],
        [ "scripts", Object.fromEntries([ [ "build", "tsc -p tsconfig.json" ],
            [ "typecheck", "tsc -p tsconfig.json --noEmit" ],
            [ "lint", "eslint Source" ],
            [ "prepack", "npm run build" ] ]) ],
        [ mirror.Kind === "native" ? "peerDependencies" : "dependencies", pin ],
        [ "devDependencies", { ...mirror.Kind === "native" ? pin : {},
            typescript: TypeScriptVersion } ],
        [ "keywords", [ "minecraft", "bedrock", "bedform", mirror.Name ] ]
    ];
    return JSON.stringify(Object.fromEntries(fields), null, 2) + "\n";
}

/**
 * Renders a new mirror's compiler configuration.
 *
 * @category Tools
 * @since 1.0.0
 */
function compilerConfiguration(): string
{
    const options: Array<[ string, unknown ]> = [
        [ "target", "ES2022" ],
        [ "lib", [ "ES2022" ] ],
        [ "module", "NodeNext" ],
        [ "moduleResolution", "NodeNext" ],
        [ "strict", true ],
        [ "declaration", true ],
        [ "declarationMap", true ],
        [ "sourceMap", true ],
        [ "skipLibCheck", true ],
        [ "rootDir", "Source" ],
        [ "outDir", "Distribution" ],
        [ "types", [] ]
    ];
    return JSON.stringify({ compilerOptions: Object.fromEntries(options),
        include: [ "Source/**/*.ts" ] }, null, 2) + "\n";
}

/**
 * Renders a new mirror's ReadMe.
 *
 * @category Tools
 * @since 1.0.0
 */
function readMe(mirror: Mirror): string
{
    const upstream = `@minecraft/${mirror.Name}`;
    const exactly = "which it installs at exactly that version.";
    const relation = {
        cli: `\`${upstream}\` is a command-line package, so this package installs it but exports ` +
            "nothing yet.",
        library: `It re-exports all of \`${upstream}\`, ${exactly}`,
        native: `It re-exports all of \`${upstream}\`, which it requires as an exact peer dependency: ` +
            "the game provides the module at runtime, so your add-on's manifest must declare the " +
            "matching module version.",
        types: `It re-exports the declarations of \`${upstream}\`, ${exactly}`
    }[mirror.Kind];
    return [
        `# \`@bedform/${mirror.Name}\``,
        "",
        `Bedform's counterpart to [\`${upstream}\`](https://www.npmjs.com/package/${upstream}).`,
        "",
        relation,
        "Bedform adds its extensions here, and where an extension replaces a first-party export, " +
            "it shadows it.",
        "",
        "## Versions",
        "",
        `This package's version is the version of \`${upstream}\` that it tracks, followed by a ` +
            "channel suffix:",
        "`-dev.N` on the `Master` branch and `-beta.N` on the `Beta` branch. For example, this release " +
            "tracks",
        `\`${upstream}@${mirror.Upstream}\`.`,
        ""
    ].join("\n");
}

/**
 * Rewrites an existing mirror's version and exact first-party pin, preserving everything else.
 *
 * @category Tools
 * @since 1.0.0
 */
function updateManifest(text: string, mirror: Mirror): string
{
    // Package names hold only lowercase letters, digits and hyphens, none of which need escaping here.
    const pin = new RegExp(`("@minecraft/${mirror.Name}"\\s*:\\s*)"[^"]*"`, "gu");
    return text.replace(/("version"\s*:\s*)"[^"]*"/u, `$1"${mirror.Version}"`)
        .replace(pin, `$1"${mirror.Upstream}"`);
}

const argv = process.argv.slice(2);
const unknown = argv.filter((argument: string, index: number) =>
    !(argument === "--check" || argument === "--channel" || argv[index - 1] === "--channel"));
if (unknown.length > 0)
{
    fail("Usage: sync-minecraft-mirrors.mts [--channel dev|beta] [--check]");
}

const check = argv.includes("--check");
const channel = channelOf(argv);
const license = readFileSync(path.join(Repository, "Package/Bedform/License.md"), "utf8");
const stale: Array<string> = [];
const mirrors = await resolveMirrors(channel);
for (const mirror of mirrors)
{
    // Native forks must never be scaffolded or overwritten if the organization gains this name.
    if (mirror.Directory === "Cinnabar")
    {
        fail("Package/Cinnabar is a native fork, not an @minecraft mirror.");
    }

    const directory = path.join(Repository, "Package", mirror.Directory);
    const manifestFile = path.join(directory, "package.json");
    if (existsSync(manifestFile))
    {
        const current = readFileSync(manifestFile, "utf8");
        const next = updateManifest(current, mirror);
        if (next !== current)
        {
            stale.push(`${mirror.Directory}: ${mirror.Version}`);
            if (!check)
            {
                writeFileSync(manifestFile, next);
            }
        }

        // An entry module that still carries the generated note is regenerated; a hand-written one is kept.
        const entryFile = path.join(directory, "Source", "index.ts");
        const entry = existsSync(entryFile) ? readFileSync(entryFile, "utf8") : "";
        if (entry.includes(`This module is auto-generated by ${Generator}.`) && entry !== entryModule(mirror))
        {
            stale.push(`${mirror.Directory}: entry module`);
            if (!check)
            {
                writeFileSync(entryFile, entryModule(mirror));
            }
        }

        continue;
    }

    stale.push(`${mirror.Directory}: new at ${mirror.Version}`);
    if (check)
    {
        continue;
    }

    mkdirSync(path.join(directory, "Source"), { recursive: true });
    writeFileSync(manifestFile, manifest(mirror));
    writeFileSync(path.join(directory, "tsconfig.json"), compilerConfiguration());
    writeFileSync(path.join(directory, "ReadMe.md"), readMe(mirror));
    writeFileSync(path.join(directory, "License.md"), license);
    writeFileSync(path.join(directory, "Source", "index.ts"), entryModule(mirror));
}

// Workspaces that depend on a mirror pin it exactly, so they follow its channel version.
const Workspaces = [ "Addon", "Package", "Package/Deprecated", "Script", "Script/Deprecated" ];
for (const parent of Workspaces)
{
    const root = path.join(Repository, parent);
    for (const entry of existsSync(root) ? readdirSync(root, { withFileTypes: true }) : [])
    {
        const manifestFile = path.join(root, entry.name, "package.json");
        if (!entry.isDirectory() || (parent === "Package" && entry.name === "Cinnabar") ||
            !existsSync(manifestFile))
        {
            continue;
        }

        const current = readFileSync(manifestFile, "utf8");
        const next = mirrors.reduce((text: string, mirror: Mirror) =>
            text.replace(new RegExp(`("@bedform/${mirror.Name}"\\s*:\\s*)"[^"]*"`, "gu"),
                `$1"${mirror.Version}"`),
        current);
        if (next !== current)
        {
            stale.push(`${parent}/${entry.name}: dependent pins`);
            if (!check)
            {
                writeFileSync(manifestFile, next);
            }
        }
    }
}

if (check && stale.length > 0)
{
    fail(`Mirrors are out of date for channel ${channel}:\n  ${stale.join("\n  ")}`);
}

console.log(stale.length > 0
    ? `Updated ${stale.length} mirrors for channel ${channel}:\n  ${stale.join("\n  ")}`
    : `All mirrors are current for channel ${channel}.`);
