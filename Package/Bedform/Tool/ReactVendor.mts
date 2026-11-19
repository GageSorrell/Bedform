/**
 * Reproducibly vendors the pinned react@19.3.1, react-reconciler@0.34.0 and scheduler@0.28.0
 * CommonJS builds into ES modules that read host globals only through injected lexical stand-ins,
 * and regenerates the third-party notices recording their licences and provenance.
 *
 * Usage: npm run react-vendor --workspace bedform (or react-vendor:check). Tarballs are verified
 * against pinned npm integrity hashes, cached under node_modules/.cache/bedform-react-vendor and
 * downloaded from the npm registry only when absent; --tarballs DIR reads them from DIR instead.
 *
 * @module bedform/Tool/ReactVendor
 *
 * @file      ReactVendor.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Generated vendor directory, relative to the package root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const OutputDirectory = "Source/Spatial/Internal/React/Vendor";

/**
 * Generated third-party notices, relative to the package root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const NoticesFile = "ThirdPartyNotices.md";

/**
 * Tarball cache, relative to the package root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const CacheDirectory = "node_modules/.cache/bedform-react-vendor";

/**
 * A pinned upstream npm release.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Pin
{
    readonly Name: string;
    readonly Version: string;
    readonly Tarball: string;
    readonly Integrity: string;
}

/**
 * The pinned releases. The reconciler's own manifest must declare the scheduler and React ranges
 * recorded in `Contract`, which these pins satisfy.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Pins: ReadonlyArray<Pin> = Object.freeze([
    {
        Integrity: "sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKl" +
            "HL69gO38yw==",
        Name: "react",
        Tarball: "https://registry.npmjs.org/react/-/react-19.3.1.tgz",
        Version: "19.3.1"
    },
    {
        Integrity: "sha512-eVibvB1fc9j5Qf1KRkiM3GzRPBdjg2P6G6QV2f3P6Eb3OGMxRBhdg2rrUwjbV5JrQaJj8nOa" +
            "8uajmmJA5tJWjQ==",
        Name: "react-reconciler",
        Tarball: "https://registry.npmjs.org/react-reconciler/-/react-reconciler-0.34.0.tgz",
        Version: "0.34.0"
    },
    {
        Integrity: "sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA" +
            "1+xKBmHXJsczAw==",
        Name: "scheduler",
        Tarball: "https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz",
        Version: "0.28.0"
    }
]);

/**
 * Ranges the pinned reconciler manifest must declare for its React peer and scheduler dependency.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Contract = Object.freeze({
    React: "^19.3.0",
    Scheduler: "^0.28.0"
} as const);

/**
 * An exact textual adaptation of an upstream file, applied after the occurrence count is confirmed.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Patch
{
    readonly Reason: string;
    readonly Find: string;
    readonly Replace: string;
    readonly Count: number;
}

/**
 * Routes the scheduler's per-turn yield check through the host tick budget, falling back to
 * upstream's `frameInterval` (5 ms, or the value `unstable_forceFrameRate` set) when none is given.
 *
 * @category Constant
 * @since 1.0.0
 */
export const TickBudgetPatch: Patch = Object.freeze({
    Count: 1,
    Find: "exports.unstable_now() - startTime < frameInterval",
    Reason: "Yield after the host tick budget instead of a fixed frame interval.",
    Replace: "exports.unstable_now() - startTime < __BedformTickBudget(frameInterval)"
});

/**
 * Upstream build flavor.
 *
 * @category Model
 * @since 1.0.0
 */
export type Flavor = "development" | "production";

/**
 * Declared type of a generated module's export.
 *
 * @category Model
 * @since 1.0.0
 */
export type ExportType = "ReconcilerFactory" | "SchedulerModule" | "VendorModule";

/**
 * One vendored upstream file.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Output
{
    readonly Name: string;
    readonly Package: string;
    readonly Source: string;
    readonly Flavor: Flavor;
    readonly Description: string;
    readonly Type: ExportType;
    readonly Requires: Readonly<Record<string, string>>;
    readonly Patches: ReadonlyArray<Patch>;
}

/**
 * An upstream entry point vendored in both flavors.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Entry
{
    readonly Name: string;
    readonly Package: string;
    readonly Source: string;
    readonly Description: string;
    readonly Type: ExportType;
    readonly Requires?: ReadonlyArray<readonly [ string, string ]>;
    readonly Patches?: ReadonlyArray<Patch>;
}

/**
 * Builds the production and development outputs of one upstream entry point.
 *
 * @category Utility
 * @since 1.0.0
 */
function Both(entry: Entry): ReadonlyArray<Output>
{
    const flavors: ReadonlyArray<Flavor> = [ "production", "development" ];
    return flavors.map((flavor: Flavor): Output => ({
        Description: entry.Description,
        Flavor: flavor,
        Name: `${entry.Name}.${flavor}`,
        Package: entry.Package,
        Patches: entry.Patches ?? [],
        Requires: Object.fromEntries((entry.Requires ?? []).map(
            ([ specifier, module ]: readonly [ string, string ]) => [ specifier, `${module}.${flavor}` ])),
        Source: `package/cjs/${entry.Source}.${flavor}.js`,
        Type: entry.Type
    }));
}

/**
 * Every vendored file. Server, profiling, compiler-runtime, reflection, native, mock and post-task
 * builds are intentionally excluded.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Outputs: ReadonlyArray<Output> = Object.freeze([
    ...Both({
        Description: "React core: elements, hooks dispatch, context and transitions.",
        Name: "React",
        Package: "react",
        Source: "react",
        Type: "VendorModule"
    }),
    ...Both({
        Description: "React automatic JSX runtime.",
        Name: "JsxRuntime",
        Package: "react",
        Requires: [ [ "react", "React" ] ],
        Source: "react-jsx-runtime",
        Type: "VendorModule"
    }),
    ...Both({
        Description: "React automatic JSX development runtime.",
        Name: "JsxDevRuntime",
        Package: "react",
        Requires: [ [ "react", "React" ] ],
        Source: "react-jsx-dev-runtime",
        Type: "VendorModule"
    }),
    ...Both({
        Description: "Scheduler priority queue and host work loop.",
        Name: "Scheduler",
        Package: "scheduler",
        Patches: [ TickBudgetPatch ],
        Source: "scheduler",
        Type: "SchedulerModule"
    }),
    ...Both({
        Description: "React reconciler host-configuration factory.",
        Name: "Reconciler",
        Package: "react-reconciler",
        Requires: [ [ "react", "React" ], [ "scheduler", "Scheduler" ] ],
        Source: "react-reconciler",
        Type: "ReconcilerFactory"
    }),
    ...Both({
        Description: "React reconciler root tags and event priorities.",
        Name: "ReconcilerConstants",
        Package: "react-reconciler",
        Source: "react-reconciler-constants",
        Type: "VendorModule"
    })
]);

/**
 * Host globals that each upstream body sees as `undefined` lexical parameters, so upstream's
 * `typeof` probes take their host-less paths.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Absent: ReadonlyArray<string> = Object.freeze([
    "window", "self", "global", "globalThis", "document", "navigator", "location", "setImmediate",
    "clearImmediate", "setInterval", "clearInterval", "MessageChannel", "queueMicrotask",
    "requestAnimationFrame", "cancelAnimationFrame", "AbortController", "IS_REACT_ACT_ENVIRONMENT",
    "__REACT_DEVTOOLS_GLOBAL_HOOK__"
]);

/**
 * Every host global each upstream body sees as a lexical parameter, with its argument expression.
 * Injected host bindings come first; nothing listed reaches the real global object.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Shadows: ReadonlyArray<readonly [ string, string ]> = Object.freeze([
    [ "process", "Host.process" ],
    [ "setTimeout", "Host.setTimeout" ],
    [ "clearTimeout", "Host.clearTimeout" ],
    [ "performance", "Host.performance" ],
    [ "reportError", "Host.reportError" ],
    [ "console", "Host.console" ],
    [ "__BedformTickBudget", "Host.TickBudget" ],
    ...Absent.map((name: string): readonly [ string, string ] => [ name, "void 0" ])
]);

/**
 * Downloaded and verified tarball contents.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Archive
{
    readonly Pin: Pin;
    readonly Files: ReadonlyMap<string, Buffer>;
}

/**
 * The manifest fields generation verifies.
 *
 * @category Model
 * @since 1.0.0
 */
interface Manifest
{
    readonly name?: string;
    readonly version?: string;
    readonly license?: string;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly peerDependencies?: Readonly<Record<string, string>>;
}

/**
 * Computes an npm `sha512-` integrity string.
 *
 * @category Utility
 * @since 1.0.0
 */
export function Integrity(data: Buffer): string
{
    return `sha512-${createHash("sha512").update(data).digest("base64")}`;
}

/**
 * Computes a hexadecimal SHA-256 digest.
 *
 * @category Utility
 * @since 1.0.0
 */
export function Sha256(data: Buffer | string): string
{
    return createHash("sha256").update(data).digest("hex");
}

/**
 * Reads a NUL-terminated field from a tar header.
 *
 * @category Utility
 * @since 1.0.0
 */
function Field(header: Buffer, start: number, length: number): string
{
    const raw = header.subarray(start, start + length);
    const end = raw.indexOf(0);
    return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8");
}

/**
 * Extracts regular files from a gzipped ustar archive, honouring PAX `path` records.
 *
 * @throws { Error } When an entry size is malformed.
 *
 * @category Utility
 * @since 1.0.0
 */
export function Untar(gzipped: Buffer): ReadonlyMap<string, Buffer>
{
    const tar = gunzipSync(gzipped);
    const files = new Map<string, Buffer>();
    let offset = 0;
    let paxPath: string | undefined;
    while (offset + 512 <= tar.length)
    {
        const header = tar.subarray(offset, offset + 512);
        if (header.every((byte: number) => byte === 0))
        {
            break;
        }

        const size = Number.parseInt(Field(header, 124, 12).trim() || "0", 8);
        if (!Number.isFinite(size) || size < 0)
        {
            throw new Error(`Malformed tar entry size at offset ${offset}.`);
        }

        const type = String.fromCharCode(header[156] ?? 0);
        const prefix = Field(header, 345, 155);
        const name = prefix ? `${prefix}/${Field(header, 0, 100)}` : Field(header, 0, 100);
        const body = tar.subarray(offset + 512, offset + 512 + size);
        if (type === "x")
        {
            paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/u.exec(body.toString("utf8"))?.[1];
        }
        else if (type === "0" || type === "\0")
        {
            files.set(paxPath ?? name, Buffer.from(body));
            paxPath = undefined;
        }
        else
        {
            paxPath = undefined;
        }

        offset += 512 + Math.ceil(size / 512) * 512;
    }

    return files;
}

/**
 * Loads a pinned tarball from the given directory or the cache, downloading into the cache when
 * absent, and rejects any bytes whose integrity differs from the pin.
 *
 * @throws { Error } When the tarball cannot be obtained or fails integrity verification.
 *
 * @category Tool
 * @since 1.0.0
 */
export async function Load(pin: Pin, directory?: string): Promise<Archive>
{
    const fileName = `${pin.Name}-${pin.Version}.tgz`;
    const local = path.resolve(directory ?? path.join(Root, CacheDirectory), fileName);
    let data: Buffer;
    if (existsSync(local))
    {
        data = readFileSync(local);
    }
    else if (directory === undefined)
    {
        const response = await fetch(pin.Tarball);
        if (!response.ok)
        {
            throw new Error(`Downloading ${pin.Tarball} failed with HTTP ${response.status}.`);
        }

        data = Buffer.from(await response.arrayBuffer());
        if (Integrity(data) === pin.Integrity)
        {
            mkdirSync(path.dirname(local), { recursive: true });
            writeFileSync(local, data);
        }
    }
    else
    {
        throw new Error(`${fileName} is not in ${directory}.`);
    }

    const actual = Integrity(data);
    if (actual !== pin.Integrity)
    {
        throw new Error(`${pin.Name}@${pin.Version} integrity ${actual} does not match ` +
            `pinned ${pin.Integrity}.`);
    }

    return {
        Files: Untar(data),
        Pin: pin
    };
}

/**
 * Reads a required file from an archive.
 *
 * @throws { Error } When the file is absent.
 *
 * @category Utility
 * @since 1.0.0
 */
function Read(archive: Archive, file: string): Buffer
{
    const data = archive.Files.get(file);
    if (data === undefined)
    {
        throw new Error(`${archive.Pin.Name}@${archive.Pin.Version} has no ${file}.`);
    }

    return data;
}

/**
 * Confirms the archive's manifest names the pinned release under the MIT licence and, for the
 * reconciler, the pinned scheduler and React contract.
 *
 * @throws { Error } When a manifest differs from its pin or contract.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckManifest(archive: Archive): void
{
    const manifest = JSON.parse(Read(archive, "package/package.json").toString("utf8")) as Manifest;
    if (manifest.name !== archive.Pin.Name || manifest.version !== archive.Pin.Version ||
        manifest.license !== "MIT")
    {
        throw new Error(`${archive.Pin.Name}@${archive.Pin.Version} manifest identity or licence changed.`);
    }

    if (archive.Pin.Name === "react-reconciler" &&
        (manifest.dependencies?.scheduler !== Contract.Scheduler ||
            manifest.peerDependencies?.react !== Contract.React))
    {
        throw new Error("react-reconciler no longer declares the pinned scheduler and React contract.");
    }
}

/**
 * Applies an output's patches after confirming each pattern's exact occurrence count.
 *
 * @throws { Error } When a pattern's occurrence count differs from the expected count.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Adapt(output: Output, source: string): string
{
    let text = source;
    for (const patch of output.Patches)
    {
        const parts = text.split(patch.Find);
        if (parts.length - 1 !== patch.Count)
        {
            throw new Error(`${output.Source}: expected ${patch.Count} of "${patch.Find}", ` +
                `found ${parts.length - 1}.`);
        }

        text = parts.join(patch.Replace);
    }

    return text;
}

/**
 * Renders one generated vendor module.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Render(output: Output, pin: Pin, source: string): string
{
    const fileName = `${output.Name}.generated.ts`;
    const upstream = output.Source.slice("package/".length);
    const imports = Object.entries(output.Requires);
    return [
        "/**",
        ` * ${output.Description}`,
        ` * Vendored from ${pin.Name}@${pin.Version} ${upstream}`,
        " * and evaluated once against injected Bedform host bindings in place of host globals.",
        " *",
        " * This module is auto-generated by Tool/ReactVendor.mts.",
        " *",
        ` * @module bedform/Spatial/Internal/React/Vendor/${output.Name}.generated`,
        " *",
        ` * @file      ${fileName}`,
        " * @author    Gage Sorrell <gage@sorrell.sh>",
        " * @copyright (c) 2026 Gage Sorrell",
        " * @license   MIT",
        " */",
        "",
        "/* eslint-disable */",
        "",
        "// @ts-nocheck",
        "",
        "import { Bindings } from \"../Host.js\";",
        `import type { ${output.Type} } from "../Types.js";`,
        ...imports.map(([ , module ]: [ string, string ], index: number) =>
            `import { Module as Dependency${index} } from "./${module}.generated.js";`),
        "",
        `const Host = Bindings(${JSON.stringify(output.Flavor)});`,
        "const Upstream = { exports: {} };",
        "",
        "function Require(specifier) {",
        ...imports.map(([ specifier ]: [ string, string ], index: number) =>
            `    if (specifier === ${JSON.stringify(specifier)}) return Dependency${index};`),
        "    throw new Error(\"Vendored module \" + specifier + \" is not available.\");",
        "}",
        "",
        "/**",
        ` * Exports of ${pin.Name}@${pin.Version} ${upstream}.`,
        " *",
        " * @category Vendor",
        " * @since 1.0.0",
        " */",
        `export const Module: ${output.Type} = (function (exports, module, require, ` +
            `${Shadows.map(([ name ]: readonly [ string, string ]) => name).join(", ")}) {`,
        Adapt(output, source).replace(/\s+$/u, ""),
        "return module.exports;",
        "}).call(void 0, Upstream.exports, Upstream, Require, " +
            `${Shadows.map(([ , value ]: readonly [ string, string ]) => value).join(", ")});`,
        ""
    ].join("\n");
}

/**
 * Renders the third-party notices with provenance and the upstream licence texts.
 *
 * @category Tool
 * @since 1.0.0
 */
export function RenderNotices(archives: ReadonlyArray<Archive>): string
{
    const lines = [
        "# Third-party notices",
        "",
        "Bedform vendors the following MIT-licensed releases into",
        `\`${OutputDirectory}\`. \`Tool/ReactVendor.mts\` regenerates this file and every vendored`,
        "module from the pinned tarballs; `npm run react-vendor:check --workspace bedform` verifies them.",
        "Each vendored module keeps its upstream `@license React` banner. See",
        "[the React port documentation](Documentation/react-port.md) for the adaptation.",
        ""
    ];
    for (const archive of archives)
    {
        const { Pin: pin } = archive;
        lines.push(
            `## ${pin.Name}@${pin.Version}`,
            "",
            `- Tarball: ${pin.Tarball}`,
            `- Integrity: \`${pin.Integrity}\``,
            "- Vendored files:",
            "",
            "| Upstream file | Upstream SHA-256 | Generated module | Patches |",
            "| --- | --- | --- | --- |"
        );
        for (const output of Outputs.filter((candidate: Output) => candidate.Package === pin.Name))
        {
            const patches = output.Patches.length === 0 ?
                "None" :
                output.Patches.map((patch: Patch) => patch.Reason).join(" ");
            const digest = Sha256(Read(archive, output.Source));
            lines.push(`| \`${output.Source.slice("package/".length)}\` | \`${digest}\` | ` +
                `\`${output.Name}.generated.ts\` | ${patches} |`);
        }

        const licence = Read(archive, "package/LICENSE").toString("utf8").replace(/\s+$/u, "");
        lines.push("", "### Licence", "", "```text", licence, "```", "");
    }

    return lines.join("\n");
}

/**
 * Generates every vendored module and the notices, keyed by package-relative path.
 *
 * @throws { Error } When a tarball, manifest, file or patch does not match its pin.
 *
 * @category Tool
 * @since 1.0.0
 */
export async function Generate(directory?: string): Promise<ReadonlyMap<string, string>>
{
    const archives = await Promise.all(Pins.map((pin: Pin) => Load(pin, directory)));
    for (const archive of archives)
    {
        CheckManifest(archive);
    }

    const byName = new Map(archives.map((archive: Archive) => [ archive.Pin.Name, archive ] as const));
    const files = new Map<string, string>();
    for (const output of Outputs)
    {
        const archive = byName.get(output.Package);
        if (archive === undefined)
        {
            throw new Error(`No pin for ${output.Package}.`);
        }

        const source = Read(archive, output.Source).toString("utf8");
        files.set(`${OutputDirectory}/${output.Name}.generated.ts`, Render(output, archive.Pin, source));
    }

    files.set(NoticesFile, RenderNotices(archives));
    return files;
}

/**
 * Writes or checks every generated file; returns the stale or extraneous package-relative paths.
 * Extraneous files in the vendor directory are reported but never deleted.
 *
 * @throws { Error } When generation fails.
 *
 * @category Tool
 * @since 1.0.0
 */
export async function Run(check: boolean, directory?: string): Promise<ReadonlyArray<string>>
{
    const files = await Generate(directory);
    const stale: Array<string> = [];
    for (const [ relative, content ] of files)
    {
        const absolute = path.join(Root, relative);
        const current = existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
        if (current === content)
        {
            continue;
        }

        stale.push(relative);
        if (!check)
        {
            mkdirSync(path.dirname(absolute), { recursive: true });
            writeFileSync(absolute, content);
        }
    }

    const vendor = path.join(Root, OutputDirectory);
    for (const entry of existsSync(vendor) ? readdirSync(vendor) : [])
    {
        const relative = `${OutputDirectory}/${entry}`;
        if (!files.has(relative))
        {
            stale.push(relative);
        }
    }

    return stale;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
{
    const check = process.argv.includes("--check");
    const index = process.argv.indexOf("--tarballs");
    const stale = await Run(check, index === -1 ? undefined : process.argv[index + 1]);
    if (check && stale.length > 0)
    {
        console.error(`React vendor output is stale; run npm run react-vendor:\n  ${stale.join("\n  ")}`);
        process.exitCode = 1;
    }
    else if (check)
    {
        process.stdout.write("React vendor output is current.\n");
    }
    else
    {
        process.stdout.write(stale.length === 0 ?
            "React vendor output was already current.\n" :
            `Wrote or found stale:\n  ${stale.join("\n  ")}\n`);
    }
}
