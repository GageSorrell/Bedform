/**
 * Reads the installed Bedrock client's bitmap fonts: the vanilla font
 * archive's glyph sheets and the large font's character table in the client
 * executable.
 *
 * @module @sorrell/ddui-image-demo/Tool/ClientFont
 *
 * @file      ClientFont.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * The pngjs PNG class, from the repository's root dependencies.
 *
 * @category Tool
 * @since 1.1.37
 */
export const { PNG } = createRequire(import.meta.url)(path.resolve(Root, "../../node_modules/pngjs"));

/**
 * Finds the installed client through its Appx package, because WindowsApps
 * cannot be listed directly.
 *
 * @throws { Error } When Minecraft for Windows is not installed.
 *
 * @category Tool
 * @since 1.1.36
 */
export function FindClient()
{
    const Location = execFileSync("powershell.exe", [ "-NoProfile", "-NonInteractive", "-Command",
        "(Get-AppxPackage Microsoft.MinecraftUWP).InstallLocation" ], { encoding: "utf8" }).trim();
    if (!Location) throw new Error("Minecraft for Windows is not installed; pass the font.brarchive and executable paths.");
    return Location;
}

/**
 * Path of the vanilla font archive inside an installed client.
 *
 * @category Tool
 * @since 1.1.37
 */
export const FontArchive = (Client) => path.join(Client, "data/resource_packs/vanilla/__brarchive/font.brarchive");

/**
 * Path of the executable inside an installed client.
 *
 * @category Tool
 * @since 1.1.37
 */
export const ClientExecutable = (Client) => path.join(Client, "Minecraft.Windows.exe");

/**
 * Reads every file in a Bedrock .brarchive: a 16-byte header, then 256-byte
 * entries (name length, 247-byte name, data offset, data length), then data.
 *
 * @category Tool
 * @since 1.1.14
 */
export function ReadArchive(File)
{
    const Bytes = readFileSync(File);
    const Count = Bytes.readUInt32LE(8);
    const Data = 16 + Count * 256;
    const Files = new Map();
    for (let Index = 0; Index < Count; Index++)
    {
        const Entry = 16 + Index * 256;
        const Name = Bytes.toString("utf8", Entry + 1, Entry + 1 + Bytes[Entry]);
        const Offset = Data + Bytes.readUInt32LE(Entry + 248);
        Files.set(path.basename(Name), Bytes.subarray(Offset, Offset + Bytes.readUInt32LE(Entry + 252)));
    }
    return Files;
}

/**
 * Reads the large font's character table from the client executable: sorted
 * pairs of 32-bit code point and cell index, the cells numbering the three
 * ASCII sheets in order. The executable holds two such tables, one for
 * default8.png alone and a longer one for the extended sheets that
 * default8.json enables; both pair every printable ASCII character with its
 * own code, which locates them. Returns the longer table.
 *
 * @throws { Error } When no table is found.
 *
 * @category Tool
 * @since 1.1.36
 */
export function ReadLargeFontTable(File)
{
    const Bytes = readFileSync(File);
    const Needle = Buffer.alloc(95 * 8);
    for (let Code = 0x20; Code <= 0x7e; Code++)
    {
        Needle.writeUInt32LE(Code, (Code - 0x20) * 8);
        Needle.writeUInt32LE(Code, (Code - 0x20) * 8 + 4);
    }
    const Pair = (Offset) => [ Bytes.readUInt32LE(Offset), Bytes.readUInt32LE(Offset + 4) ];
    let Best = [];
    for (let Found = Bytes.indexOf(Needle); Found >= 0; Found = Bytes.indexOf(Needle, Found + 1))
    {
        // Extend backwards and forwards while the code points stay increasing and the cells fit three sheets.
        let Start = Found;
        while (Start >= 8 && Pair(Start - 8)[0] < Pair(Start)[0] && Pair(Start - 8)[1] < 480) Start -= 8;
        const Table = [];
        for (let Offset = Start; Offset + 8 <= Bytes.length; Offset += 8)
        {
            const [ Code, Cell ] = Pair(Offset);
            if (Cell >= 480 || (Table.length > 0 && Code <= Table.at(-1)[0])) break;
            Table.push([ Code, Cell ]);
        }
        if (Table.length > Best.length) Best = Table;
    }
    if (Best.length === 0) throw new Error(`No large font character table in ${File}.`);
    return Best;
}

/**
 * Returns the leftmost and rightmost opaque columns of one cell of a glyph
 * sheet that is sixteen cells wide, or undefined for an empty cell.
 *
 * @category Tool
 * @since 1.1.14
 */
export function OpaqueColumns(Sheet, Index, Size, Height = Size)
{
    let Left;
    let Right;
    const X0 = (Index % 16) * Size;
    const Y0 = Math.floor(Index / 16) * Height;
    for (let X = 0; X < Size; X++)
    {
        for (let Y = 0; Y < Height; Y++)
        {
            if (Sheet.data[((Y0 + Y) * Sheet.width + X0 + X) * 4 + 3] === 0) continue;
            Left ??= X;
            Right = X;
            break;
        }
    }
    return Left === undefined ? undefined : { Left, Right };
}

/**
 * Returns a cached reader of the archive's PNG sheets by file name, which
 * yields undefined for a sheet the archive lacks.
 *
 * @category Tool
 * @since 1.1.37
 */
export function SheetReader(Files)
{
    const Sheets = new Map();
    return (Name) =>
    {
        if (!Sheets.has(Name)) Sheets.set(Name, Files.has(Name) ? PNG.sync.read(Files.get(Name)) : undefined);
        return Sheets.get(Name);
    };
}

/**
 * File name of the Unicode font page holding a Basic Multilingual Plane code point.
 *
 * @category Tool
 * @since 1.1.37
 */
export const UnicodePageName = (CodePoint) => `glyph_${(CodePoint >> 8).toString(16).toUpperCase().padStart(2, "0")}.png`;
