/**
 * Generates Bedform's bundled TextPrimitive font metrics from the installed Bedrock client, ported
 * from the demo's GlyphWidths and ClientFont tools: the large (Legacy) font's character set and
 * advances, the Unicode (Mojangles) font's advance and glyph presence for every Basic Multilingual
 * Plane code point, and Minecraft Ten stand-in advances from the authoritative Canvas catalogue.
 *
 * Usage: npm run text-metrics --workspace bedform (or text-metrics:check; add --require-client to
 * fail instead of skipping when the client is not installed).
 *
 * @module bedform/Tool/TextMetrics
 *
 * @file      TextMetrics.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { GlyphData } from "../../../Addon/BedformCanvas/Public/Glyph.generated.js";
import { PNG } from "pngjs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Generated module path, relative to the package root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const OutputFile = "Source/Spatial/Internal/TextMetrics.generated.ts";

/**
 * The authoritative Canvas glyph catalogue holding Minecraft Ten advances.
 *
 * @category Constant
 * @since 1.0.0
 */
export const CanvasCatalogue = "../../Addon/BedformCanvas/Public/Glyph.generated.ts";

/**
 * Client data read by generation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ClientFonts
{
    readonly Version: string;
    readonly Archive: ReadonlyMap<string, Buffer>;
    readonly LargeTable: ReadonlyArray<readonly [ number, number ]>;
}

/**
 * Locates the installed client and its version through its Appx package, or undefined.
 *
 * @category Tool
 * @since 1.0.0
 */
export function FindClient(): { Location: string;
    Version: string } | undefined
{
    try
    {
        const output = execFileSync("powershell.exe", [ "-NoProfile", "-NonInteractive", "-Command",
            "$p = Get-AppxPackage Microsoft.MinecraftUWP; \"$($p.InstallLocation)|$($p.Version)\"" ],
        { encoding: "utf8" }).trim();
        const [ location, version ] = output.split("|");
        return location ? { Location: location,
            Version: version } : undefined;
    }
    catch
    {
        return undefined;
    }
}

/**
 * Reads every file of a Bedrock .brarchive: a 16-byte header, then 256-byte entries (name length,
 * 247-byte name, data offset, data length), then data.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function ReadArchive(bytes: Buffer): Map<string, Buffer>
{
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
 * Reads the large font's character table from the client executable: sorted pairs of 32-bit code
 * point and cell index over the three ASCII sheets. The longest table pairing printable ASCII with
 * its own codes is the extended one default8.json enables.
 *
 * @throws { Error } When no table is found.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function ReadLargeFontTable(bytes: Buffer): Array<readonly [ number, number ]>
{
    const needle = Buffer.alloc(95 * 8);
    for (let code = 0x20; code <= 0x7E; code++)
    {
        needle.writeUInt32LE(code, (code - 0x20) * 8);
        needle.writeUInt32LE(code, (code - 0x20) * 8 + 4);
    }

    const pair = (offset: number): readonly [ number, number ] => [ bytes.readUInt32LE(offset),
        bytes.readUInt32LE(offset + 4) ];
    let best: Array<readonly [ number, number ]> = [];
    for (let found = bytes.indexOf(needle); found >= 0; found = bytes.indexOf(needle, found + 1))
    {
        let start = found;
        while (start >= 8 && pair(start - 8)[0] < pair(start)[0] && pair(start - 8)[1] < 480)
        {
            start -= 8;
        }

        const table: Array<readonly [ number, number ]> = [];
        for (let offset = start; offset + 8 <= bytes.length; offset += 8)
        {
            const [ code, cell ] = pair(offset);
            if (cell >= 480 || (table.length > 0 && code <= table.at(-1)![0]))
            {
                break;
            }

            table.push([ code, cell ]);
        }

        if (table.length > best.length)
        {
            best = table;
        }
    }

    if (best.length === 0)
    {
        throw new Error("No large font character table in the client executable.");
    }

    return best;
}

/**
 * Reads the installed client's fonts, or undefined when it is not installed.
 *
 * @category Tool
 * @since 1.0.0
 */
export function ReadClient(): ClientFonts | undefined
{
    const client = FindClient();
    if (!client)
    {
        return undefined;
    }

    return { Archive: ReadArchive(readFileSync(path.join(client.Location,
        "data/resource_packs/vanilla/__brarchive/font.brarchive"))),
    LargeTable: ReadLargeFontTable(readFileSync(path.join(client.Location, "Minecraft.Windows.exe"))),
    Version: client.Version };
}

/**
 * Leftmost and rightmost opaque columns of one cell of a sheet sixteen cells wide.
 *
 * @category Tool
 * @since 1.0.0
 */
function OpaqueColumns(sheet: PNG, index: number, size: number, height: number = size):
    { Left: number;
        Right: number } | undefined
{
    let left: number | undefined;
    let right: number | undefined;
    const x0 = (index % 16) * size;
    const y0 = Math.floor(index / 16) * height;
    for (let x = 0; x < size; x++)
    {
        for (let y = 0; y < height; y++)
        {
            if (sheet.data[((y0 + y) * sheet.width + x0 + x) * 4 + 3] !== 0)
            {
                left ??= x;
                right = x;
                break;
            }
        }
    }

    return left === undefined ? undefined : { Left: left,
        Right: right! };
}

/**
 * Reads Minecraft Ten stand-in advances from the Canvas catalogue.
 *
 * @throws { Error } If the catalogue lacks them.
 *
 * @category Tool
 * @since 1.0.0
 */
export function ReadTenAdvances(root: string = Root): string
{
    const text = readFileSync(path.join(root, CanvasCatalogue), "utf8");
    const match = /TenAdvances: ("(?:[^"\\]|\\.)*")/u.exec(text);
    if (!match)
    {
        throw new Error("The Canvas glyph catalogue has no TenAdvances.");
    }

    return JSON.parse(match[1]) as string;
}

/**
 * Generates the metrics module text from client fonts and Ten advances.
 *
 * @throws { Error } If a required sheet is missing.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Generate(fonts: ClientFonts, tenAdvances: string): string
{
    const sheets = new Map<string, PNG | undefined>();
    const sheet = (name: string): PNG | undefined =>
    {
        if (!sheets.has(name))
        {
            const file = fonts.Archive.get(name);
            sheets.set(name, file ? PNG.sync.read(file) : undefined);
        }

        return sheets.get(name);
    };

    const pageName = (codePoint: number): string =>
        `glyph_${(codePoint >> 8).toString(16).toUpperCase().padStart(2, "0")}.png`;
    // notfound.png replaces a missing glyph, scaled to the 8-pixel cell height.
    const notFound = sheet("notfound.png");
    if (!notFound)
    {
        throw new Error("The font archive has no notfound.png.");
    }

    const notFoundColumns = OpaqueColumns(notFound, 0, notFound.width)!;
    const missing = Math.round((notFoundColumns.Right - notFoundColumns.Left + 1) * 8 / notFound.width) + 1;
    const large = (code: number, cell: number): number =>
    {
        if (code === 0x20)
        {
            return 4;
        }

        const page = sheet([ "default8.png", "default8_1.png", "default8_2.png" ][Math.floor(cell / 160)]);
        const columns = page && OpaqueColumns(page, cell % 160, 8, 12);
        return columns ? columns.Right + 2 : missing;
    };

    const presence = new Uint8Array(0x1_00_00 / 8);
    const small = (codePoint: number): number =>
    {
        if (codePoint === 0x20)
        {
            presence[codePoint >> 3] |= 1 << (codePoint & 7);
            return 4;
        }

        const page = sheet(pageName(codePoint));
        const columns = page && OpaqueColumns(page, codePoint & 0xFF, page.width / 16);
        if (!columns)
        {
            return missing;
        }

        presence[codePoint >> 3] |= 1 << (codePoint & 7);
        return (columns.Right - columns.Left + 1) * 8 / (page.width / 16) + 1;
    };

    // One character per width: code minus 48 is the width in half pixels.
    const encode = (width: number): string => String.fromCharCode(48 + Math.round(width * 2));
    const largeCharacters = fonts.LargeTable.map(([ code ]: readonly [ number, number ]) =>
        String.fromCodePoint(code)).join("");
    const largeWidths = fonts.LargeTable.map(([ code, cell ]: readonly [ number, number ]) =>
        encode(large(code, cell))).join("");
    let unicode = "";
    for (let codePoint = 0; codePoint <= 0xFF_FF; codePoint++)
    {
        unicode += encode(small(codePoint));
    }

    const pages = Array.from({ length: 256 }, (_: unknown, page: number) => page)
        .filter((page: number) => sheet(pageName(page << 8)) !== undefined);
    const hex = Buffer.from(presence).toString("hex");
    const chunk = (text: string): string => (JSON.stringify(text).slice(1, -1)
        .match(/(?:\\u[0-9a-f]{4}|\\.|[^\\]){1,96}/gu) ??
        []).map((part: string) => `    "${part}"`).join(" +\n");
    return `/**
 * Bundled TextPrimitive font metrics captured from Minecraft for Windows ${fonts.Version}: the large
 * (Legacy) font's characters and advances, and the Unicode (Mojangles) font's advance and glyph
 * presence for every Basic Multilingual Plane code point, in font pixels including the 1-pixel gap.
 * Minecraft Ten stand-in advances come from the BedformCanvas glyph catalogue. Custom PUA stand-ins
 * are absent from the vanilla pages, so their native entries read as missing glyphs.
 *
 * This module is auto-generated by Tool/TextMetrics.mts.
 *
 * @module bedform/Spatial/Internal/TextMetrics.generated
 *
 * @file      TextMetrics.generated.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

/**
 * Client version the tables were captured from.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Client = ${JSON.stringify(fonts.Version)};

/**
 * How presence is classified.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Classification = "A Mojangles glyph is present when its glyph_XX.png page exists in the " +
    "vanilla font.brarchive and its cell has a texel with alpha above zero; U+0020 is present by rule. " +
    "Large-font membership is the client executable's extended character-to-cell table.";

/**
 * Advance of the missing-glyph box, for characters without a glyph.
 *
 * @category Constant
 * @since 1.0.0
 */
export const MissingGlyphWidth = ${missing};

/**
 * Every large-font character, in code point order.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LargeFontCharacters =
${chunk(largeCharacters)};

/**
 * Large-font advances, one character per LargeFontCharacters entry: code minus 48 in half pixels.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LargeFontWidths =
${chunk(largeWidths)};

/**
 * Pages of the Unicode font, by the high byte of their code points.
 *
 * @category Constant
 * @since 1.0.0
 */
export const UnicodeFontPages = ${JSON.stringify(pages)};

/**
 * Unicode-font advances of U+0000 to U+FFFF, one character each: code minus 48 in half pixels.
 *
 * @category Constant
 * @since 1.0.0
 */
export const UnicodeFontWidthTable =
${chunk(unicode)};

/**
 * Unicode-font glyph presence, a little-endian bitset over U+0000 to U+FFFF, as hexadecimal bytes.
 *
 * @category Constant
 * @since 1.0.0
 */
export const UnicodeFontPresence =
${chunk(hex)};

/**
 * Minecraft Ten stand-in advances of U+0020 to U+007E, one character each: code minus 48 (0 none).
 *
 * @category Constant
 * @since 1.0.0
 */
export const TenAdvances = ${JSON.stringify(tenAdvances)};

/**
 * Canvas font-switch code and custom PUA advances, from the authoritative glyph catalogue.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Canvas = Object.freeze(${JSON.stringify({ Advances: GlyphData.Advances,
    First: GlyphData.First,
    Switch: GlyphData.Switch })} as const);
`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    const fonts = ReadClient();
    const file = path.join(Root, OutputFile);
    if (!fonts)
    {
        const message = "Minecraft for Windows is not installed; text metrics cannot be regenerated.";
        if (process.argv.includes("--require-client") || !process.argv.includes("--check"))
        {
            console.error(message);
            process.exit(1);
        }

        console.warn(`${message} Skipping the freshness check.`);
    }
    else
    {
        const text = Generate(fonts, ReadTenAdvances());
        if (process.argv.includes("--check"))
        {
            if (readFileSync(file, "utf8") !== text)
            {
                console.error(`${OutputFile} is stale for client ${fonts.Version}; ` +
                    "run npm run text-metrics.");
                process.exit(1);
            }

            console.warn(`${OutputFile} is current for client ${fonts.Version}.`);
        }
        else
        {
            writeFileSync(file, text);
            console.warn(`Wrote ${OutputFile} from client ${fonts.Version}.`);
        }
    }
}
