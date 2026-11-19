/**
 * One-time capture of glyph generation inputs from the installed Bedrock client, the pinned Unicode
 * name table and GNU Unifont, ported from the demo's ClientFont, MinecraftTen and Unifont tools.
 * Rerun after a client or font update; ordinary generation never reads the client or network.
 *
 * Usage: npm run glyph:capture --workspace bedform-canvas
 *
 * @module bedform-canvas/Tool/Glyph/Capture
 *
 * @file      Capture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ArtRows, MinecraftTen, Shade, UnicodeNames, Unifont } from "./Input.mts";
import { InputDirectory, InputFile, WorkspaceRoot } from "./Input.mts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { execFileSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";

const UnifontVersion = "18.0.01";
const UnifontNotice = "Copyright (C) 1998-2026 Roman Czyborra, Paul Hardy, Qianqian Fang, Andrew Miller, " +
    "Johnnie Weaver, David Corbett, Ælla Chiana Moskopp, Rebecca Bettencourt, Minseo Lee, Ho-Seok Ee, et al.";
const DemoRoot = path.join(WorkspaceRoot, "../DduiImageDemo");

/**
 * Legacy computing blocks whose names are captured.
 *
 * @category Constant
 * @since 1.0.0
 */
export const NamedBlocks = Object.freeze([ Object.freeze({ First: 0x1_FB_00,
    Last: 0x1_FB_FF }), Object.freeze({ First: 0x1_CC_00,
    Last: 0x1_CE_BF }) ]);

/**
 * Locates the installed client through its Appx package, because WindowsApps cannot be listed.
 *
 * @throws { Error } When Minecraft for Windows is not installed.
 *
 * @category Tool
 * @since 1.0.0
 */
function FindClient(): { Location: string;
    Version: string }
{
    const output = execFileSync("powershell.exe", [ "-NoProfile", "-NonInteractive", "-Command",
        "$p = Get-AppxPackage Microsoft.MinecraftUWP; \"$($p.InstallLocation)|$($p.Version)\"" ],
    { encoding: "utf8" }).trim();
    const [ location, version ] = output.split("|");
    if (!location)
    {
        throw new Error("Minecraft for Windows is not installed; glyph capture needs the client.");
    }

    return { Location: location,
        Version: version };
}

/**
 * Reads every file in a Bedrock .brarchive: a 16-byte header, then 256-byte entries (name length,
 * 247-byte name, data offset, data length), then data.
 *
 * @category Decoding
 * @since 1.0.0
 */
function ReadArchive(file: string): Map<string, Buffer>
{
    const bytes = readFileSync(file);
    const count = bytes.readUInt32LE(8);
    const data = 16 + count * 256;
    const files = new Map<string, Buffer>();
    for (let index = 0; index < count; index++)
    {
        const entry = 16 + index * 256;
        const name = bytes.toString("utf8", entry + 1, entry + 1 + bytes[entry]);
        const offset = data + bytes.readUInt32LE(entry + 248);
        files.set(path.basename(name), bytes.subarray(offset, offset + bytes.readUInt32LE(entry + 252)));
    }

    return files;
}

/**
 * Samples the vanilla Unicode font's U+2592 cell as text art.
 *
 * @throws { Error } If the cell is missing or empty.
 *
 * @category Tool
 * @since 1.0.0
 */
function CaptureShade(client: string, version: string): Shade
{
    const file = "data/resource_packs/vanilla/__brarchive/font.brarchive";
    const sheet = ReadArchive(path.join(client, file)).get("glyph_25.png");
    if (!sheet)
    {
        throw new Error("The vanilla font archive has no glyph_25.png.");
    }

    const page = PNG.sync.read(sheet);
    const size = page.width / 16;
    const inked = (x: number, y: number): boolean =>
        page.data[(((0x92 >> 4) * size + y) * page.width + (0x92 & 15) * size + x) * 4 + 3] > 0;
    const rows = Array.from({ length: size }, (_: unknown, y: number) => Array.from({ length: size },
        (_column: unknown, x: number) => inked(x, y) ? "#" : ".").join(""));
    if (!rows.some((row: string) => row.includes("#")))
    {
        throw new Error("The vanilla U+2592 cell is empty.");
    }

    return { Client: version,
        File: `${file}/glyph_25.png U+2592`,
        Rows: rows };
}

/**
 * A TrueType glyph outline as closed polygons of font units.
 *
 * @category Model
 * @since 1.0.0
 */
type Contours = ReadonlyArray<ReadonlyArray<readonly [ number, number ]>>;

/**
 * Reads the simple, straight-edged glyph outlines of a TrueType font by code point.
 *
 * @throws { Error } If a glyph is composite or curved.
 *
 * @category Decoding
 * @since 1.0.0
 */
function ReadTrueType(font: Buffer): (codePoint: number) => Contours | undefined
{
    const tables = new Map<string, number>();
    for (let index = 0; index < font.readUInt16BE(4); index++)
    {
        const entry = 12 + index * 16;
        tables.set(font.toString("ascii", entry, entry + 4), font.readUInt32BE(entry + 8));
    }

    const long = font.readInt16BE(tables.get("head")! + 50) === 1;
    const glyphs = new Map<number, number>();
    const cmap = tables.get("cmap")!;
    for (let index = 0; index < font.readUInt16BE(cmap + 2); index++)
    {
        const table = cmap + font.readUInt32BE(cmap + 4 + index * 8 + 4);
        if (font.readUInt16BE(table) !== 4)
        {
            continue;
        }

        const segments = font.readUInt16BE(table + 6) / 2;
        const ends = table + 14;
        const starts = ends + segments * 2 + 2;
        const deltas = starts + segments * 2;
        const ranges = deltas + segments * 2;
        for (let segment = 0; segment < segments; segment++)
        {
            const end = font.readUInt16BE(ends + segment * 2);
            const start = font.readUInt16BE(starts + segment * 2);
            const delta = font.readInt16BE(deltas + segment * 2);
            const range = font.readUInt16BE(ranges + segment * 2);
            for (let code = start; code <= end && code !== 0xFF_FF; code++)
            {
                let glyph = range === 0 ? (code + delta) & 0xFF_FF
                    : font.readUInt16BE(ranges + segment * 2 + range + (code - start) * 2);
                if (range !== 0 && glyph !== 0)
                {
                    glyph = (glyph + delta) & 0xFF_FF;
                }

                if (glyph !== 0 && !glyphs.has(code))
                {
                    glyphs.set(code, glyph);
                }
            }
        }
    }

    const loca = tables.get("loca")!;
    const glyf = tables.get("glyf")!;
    const offset = (glyph: number): number => long ? font.readUInt32BE(loca + glyph * 4)
        : font.readUInt16BE(loca + glyph * 2) * 2;
    return (codePoint: number): Contours | undefined =>
    {
        const glyph = glyphs.get(codePoint);
        if (glyph === undefined)
        {
            return undefined;
        }

        if (offset(glyph) === offset(glyph + 1))
        {
            return [];
        }

        const start = glyf + offset(glyph);
        const count = font.readInt16BE(start);
        if (count < 0)
        {
            throw new Error(`U+${codePoint.toString(16)} is a composite glyph.`);
        }

        const endPoints = Array.from({ length: count }, (_: unknown, index: number) =>
            font.readUInt16BE(start + 10 + index * 2));
        const total = endPoints.at(-1)! + 1;
        let at = start + 10 + count * 2;
        at += 2 + font.readUInt16BE(at);
        const flags: Array<number> = [];
        while (flags.length < total)
        {
            const flag = font[at++];
            flags.push(flag);
            if (flag & 8)
            {
                for (let repeat = font[at++]; repeat > 0; repeat--)
                {
                    flags.push(flag);
                }
            }
        }

        if (flags.some((flag: number) => !(flag & 1)))
        {
            throw new Error(`U+${codePoint.toString(16)} has curves.`);
        }

        const coordinates = (short: number, same: number): Array<number> =>
        {
            let value = 0;
            return flags.map((flag: number) =>
            {
                if (flag & short)
                {
                    const step = font[at++];
                    value += flag & same ? step : -step;
                }
                else if (!(flag & same))
                {
                    value += font.readInt16BE(at);
                    at += 2;
                }

                return value;
            });
        };

        const xs = coordinates(2, 16);
        const ys = coordinates(4, 32);
        return endPoints.map((end: number, index: number) =>
        {
            const first = index === 0 ? 0 : endPoints[index - 1] + 1;
            return xs.slice(first, end + 1).map((x: number, point: number) =>
                [ x, ys[first + point] ] as const);
        });
    };
}

/**
 * Nonzero winding containment of a point in closed polygons.
 *
 * @category Geometry
 * @since 1.0.0
 */
function Inside(contours: Contours, x: number, y: number): boolean
{
    let winding = 0;
    for (const contour of contours)
    {
        for (let index = 0; index < contour.length; index++)
        {
            const [ x0, y0 ] = contour[index];
            const [ x1, y1 ] = contour[(index + 1) % contour.length];
            if ((y0 <= y) !== (y1 <= y))
            {
                const cross = x0 + (y - y0) * (x1 - x0) / (y1 - y0);
                if (cross > x)
                {
                    winding += y1 > y0 ? 1 : -1;
                }
            }
        }
    }

    return winding !== 0;
}

/**
 * Rasterizes Minecraft Ten's printable ASCII without lowercase letters: its outlines lie on a
 * 70-unit pixel grid after a 50-unit bearing, with the baseline on cell row 13.
 *
 * @category Tool
 * @since 1.0.0
 */
function CaptureTen(client: string, version: string): MinecraftTen
{
    const file = "data/resource_packs/vanilla/font/minecraft-ten.ttf";
    const pixel = 70;
    const bearing = 50;
    const baselineRow = 13;
    const outline = ReadTrueType(readFileSync(path.join(client, file)));
    const cells: Record<string, ArtRows> = {};
    const clipped: Array<string> = [];
    for (let codePoint = 0x20; codePoint <= 0x7E; codePoint++)
    {
        if (codePoint >= 0x61 && codePoint <= 0x7A)
        {
            continue;
        }

        const contours = outline(codePoint) ?? [];
        const rows = Array.from({ length: 16 }, () => Array<boolean>(16).fill(false));
        const points = contours.flat();
        if (points.length > 0)
        {
            const xs = points.map(([ x ]: readonly [ number, number ]) => x);
            const ys = points.map(([ , y ]: readonly [ number, number ]) => y);
            const columns = Math.ceil((Math.max(...xs) - bearing) / pixel);
            const low = Math.floor(Math.min(...ys) / pixel);
            const high = Math.ceil(Math.max(...ys) / pixel);
            for (let column = 0; column < columns; column++)
            {
                for (let row = low; row < high; row++)
                {
                    const centerX = bearing + pixel * column + pixel / 2 + 0.01;
                    if (!Inside(contours, centerX, pixel * row + pixel / 2 + 0.01))
                    {
                        continue;
                    }

                    const cellRow = baselineRow - row;
                    if (cellRow < 0 || cellRow > 15 || column > 15)
                    {
                        clipped.push(`U+${codePoint.toString(16)} column ${column} row ${cellRow}`);
                    }
                    else
                    {
                        rows[cellRow][column] = true;
                    }
                }
            }
        }

        cells[codePoint.toString(16).toUpperCase()] = rows.map((row: Array<boolean>) =>
            row.map((inked: boolean) => inked ? "#" : ".").join(""));
    }

    return { Cells: cells,
        Client: version,
        Clipped: clipped,
        File: file };
}

/**
 * Downloads a file once into the capture cache.
 *
 * @category Tool
 * @since 1.0.0
 */
function Download(url: string, file: string): void
{
    if (existsSync(file))
    {
        return;
    }

    mkdirSync(path.dirname(file), { recursive: true });
    execFileSync("curl", [ "-sSLf", "--max-time", "600", "-o", file, url ]);
}

/**
 * Captures the Unifont plane-1 glyphs of the legacy supplement and Unifont's OFL text, reusing the
 * demo's download cache when present.
 *
 * @category Tool
 * @since 1.0.0
 */
function CaptureUnifont(): { Hex: string;
    License: string;
    Meta: Unifont }
{
    const demoCache = path.join(DemoRoot, "dist/unifont");
    const cache = existsSync(demoCache) ? demoCache : path.join(WorkspaceRoot, "dist/unifont");
    const base = `https://unifoundry.com/pub/unifont/unifont-${UnifontVersion}`;
    const archive = path.join(cache, `unifont_upper-${UnifontVersion}.hex.gz`);
    Download(`${base}/font-builds/unifont_upper-${UnifontVersion}.hex.gz`, archive);
    const lines = gunzipSync(readFileSync(archive)).toString("ascii").split(/\r?\n/u).filter((line: string) =>
    {
        const code = parseInt(line.split(":")[0], 16);
        return code >= NamedBlocks[1].First && code <= NamedBlocks[1].Last;
    });
    const license = path.join(cache, `OFL-1.1-${UnifontVersion}.txt`);
    if (!existsSync(license))
    {
        const tarball = path.join(cache, "download", `unifont-${UnifontVersion}.tar.gz`);
        Download(`${base}/unifont-${UnifontVersion}.tar.gz`, tarball);
        // A relative name, because GNU tar reads a drive letter as a remote host.
        writeFileSync(license, execFileSync("tar", [ "-xzOf", path.basename(tarball),
            `unifont-${UnifontVersion}/OFL-1.1.txt` ], { cwd: path.dirname(tarball) }));
    }

    return { Hex: lines.join("\n") + "\n",
        License: readFileSync(license, "utf8"),
        Meta: { Notice: UnifontNotice,
            Source: `${base}/font-builds/unifont_upper-${UnifontVersion}.hex.gz`,
            Version: UnifontVersion } };
}

/**
 * Snapshots the names of both legacy computing blocks from the demo's pinned Unicode table.
 *
 * @category Tool
 * @since 1.0.0
 */
async function CaptureNames(): Promise<UnicodeNames>
{
    const browser = await import(pathToFileURL(path.join(DemoRoot, "Source/UnicodeBrowser.js")).href) as
        { CharacterName: (codePoint: number) => string | undefined };
    const data = await import(pathToFileURL(path.join(DemoRoot, "Source/UnicodeData.js")).href) as
        { UnicodeVersion: string };
    const names: Record<string, string> = {};
    for (const block of NamedBlocks)
    {
        for (let codePoint = block.First; codePoint <= block.Last; codePoint++)
        {
            const name = browser.CharacterName(codePoint);
            if (name && !name.startsWith("<"))
            {
                names[codePoint.toString(16).toUpperCase()] = name;
            }
        }
    }

    return { Names: names,
        Source: "https://www.unicode.org/Public/UCD/ UnicodeData.txt, via " +
            "Addon/DduiImageDemo/Source/UnicodeData.js",
        UnicodeVersion: data.UnicodeVersion };
}

/**
 * Captures every input and writes it beneath InputDirectory.
 *
 * @category Tool
 * @since 1.0.0
 */
export async function Capture(): Promise<void>
{
    const client = FindClient();
    const directory = path.join(WorkspaceRoot, InputDirectory);
    mkdirSync(directory, { recursive: true });
    const json = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
    const unifont = CaptureUnifont();
    writeFileSync(path.join(directory, InputFile.UnicodeNames), json(await CaptureNames()));
    writeFileSync(path.join(directory, InputFile.Shade), json(CaptureShade(client.Location, client.Version)));
    const ten = CaptureTen(client.Location, client.Version);
    writeFileSync(path.join(directory, InputFile.MinecraftTen), json(ten));
    writeFileSync(path.join(directory, InputFile.Unifont), json(unifont.Meta));
    writeFileSync(path.join(directory, InputFile.UnifontHex), unifont.Hex);
    writeFileSync(path.join(directory, InputFile.License), unifont.License);
    console.log(`Captured glyph inputs from Minecraft ${client.Version} and Unifont ${UnifontVersion}.`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    await Capture();
}
