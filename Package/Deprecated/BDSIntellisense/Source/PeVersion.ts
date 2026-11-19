/**
 * Reads the version resource of a Windows Portable Executable, such as `bedrock_server.exe`.
 *
 * Only the headers, the section table and the path through the resource tree to the `RT_VERSION`
 * resource are read, so a file of hundreds of megabytes costs a handful of small reads.  Malformed
 * or truncated files yield `undefined` rather than an error.
 *
 * @module bds-intellisense/PeVersion
 *
 * @file      PeVersion.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { BdsVersion } from "./Version.js";
import type { FileHandle } from "node:fs/promises";
import { open } from "node:fs/promises";

/**
 * Random access to the bytes of an executable.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ByteSource
{
    /** Reads up to `length` bytes at `offset`; fewer are returned at the end of the data. */
    readonly Read: (offset: number, length: number) => Promise<Uint8Array>;
}

/**
 * The two four-part versions of a `VS_FIXEDFILEINFO` structure.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PeVersionInfo
{
    readonly FileVersion: BdsVersion;
    readonly ProductVersion: BdsVersion;
}

/**
 * A section header's mapping from virtual addresses to file offsets.
 */
interface Section
{
    readonly FileOffset: number;
    readonly Size: number;
    readonly VirtualAddress: number;
}

/**
 * The sections of an executable and the virtual address of its resource directory.
 */
interface Layout
{
    readonly Resources: number;
    readonly Sections: ReadonlyArray<Section>;
}

/**
 * Where a resource's data lies in the file.
 */
interface ResourceLocation
{
    readonly Offset: number;
    readonly Size: number;
}

/** The `VS_FIXEDFILEINFO.dwSignature` value. */
const FixedFileInfoSignature: number = 0xFE_EF_04_BD;

/** The `Magic` values of 32-bit and 64-bit optional headers. */
const OptionalHeaderMagic = Object.freeze({
    Pe32: 0x01_0B,
    Pe32Plus: 0x02_0B
} as const);

/** The resource type identifier of version information. */
const VersionResourceType: number = 16;

/** Index of the resource table in the optional header's data directories. */
const ResourceDirectoryIndex: number = 2;

/** Limits that keep a corrupt file from causing large reads or long loops. */
const Limit = Object.freeze({
    DirectoryEntries: 4_096,
    Sections: 96,
    VersionResourceBytes: 65_536
} as const);

/**
 * Reads exactly `length` bytes, or yields `undefined` when the data ends first.
 */
async function ReadExactly(source: ByteSource, offset: number, length: number): Promise<DataView | undefined>
{
    const bytes: Uint8Array = await source.Read(offset, length);
    return bytes.length < length ? undefined : new DataView(bytes.buffer, bytes.byteOffset, length);
}

/**
 * Reads the section table and the virtual address of the resource directory.
 */
async function ReadLayout(source: ByteSource): Promise<Layout | undefined>
{
    const dos: DataView | undefined = await ReadExactly(source, 0, 64);
    if (dos === undefined || dos.getUint16(0, true) !== 0x5A_4D)
    {
        return undefined;
    }

    const peOffset: number = dos.getUint32(0x3C, true);
    const headers: DataView | undefined = await ReadExactly(source, peOffset, 24);
    if (headers === undefined || headers.getUint32(0, true) !== 0x00_00_45_50)
    {
        return undefined;
    }

    const sectionCount: number = headers.getUint16(6, true);
    const optionalSize: number = headers.getUint16(20, true);
    const optional: DataView | undefined = await ReadExactly(source, peOffset + 24, optionalSize);
    if (optional === undefined || sectionCount > Limit.Sections || optionalSize < 2)
    {
        return undefined;
    }

    const magic: number = optional.getUint16(0, true);
    if (magic !== OptionalHeaderMagic.Pe32 && magic !== OptionalHeaderMagic.Pe32Plus)
    {
        return undefined;
    }

    const countOffset: number = magic === OptionalHeaderMagic.Pe32Plus ? 108 : 92;
    const directoryOffset: number = countOffset + 4 + ResourceDirectoryIndex * 8;
    if (optionalSize < directoryOffset + 8 ||
        optional.getUint32(countOffset, true) <= ResourceDirectoryIndex)
    {
        return undefined;
    }

    const resources: number = optional.getUint32(directoryOffset, true);
    const table: DataView | undefined =
        await ReadExactly(source, peOffset + 24 + optionalSize, sectionCount * 40);

    if (table === undefined || resources === 0)
    {
        return undefined;
    }

    const sections: Array<Section> = [];
    for (let index: number = 0; index < sectionCount; index++)
    {
        const base: number = index * 40;
        sections.push({
            FileOffset: table.getUint32(base + 20, true),
            Size: Math.max(table.getUint32(base + 8, true), table.getUint32(base + 16, true)),
            VirtualAddress: table.getUint32(base + 12, true)
        });
    }

    return {
        Resources: resources,
        Sections: sections
    };
}

/**
 * Converts a relative virtual address to a file offset through the section table.
 */
function FileOffsetOf(sections: ReadonlyArray<Section>, address: number): number | undefined
{
    const section: Section | undefined = sections.find((candidate: Section) =>
        address >= candidate.VirtualAddress && address < candidate.VirtualAddress + candidate.Size);

    return section === undefined ? undefined : section.FileOffset + address - section.VirtualAddress;
}

/**
 * Picks an entry of a resource directory: the one with the given numeric identifier, or the first
 * entry when no identifier is given.  The result is the entry's offset field.
 */
async function DirectoryEntry(
    source: ByteSource,
    directory: number,
    id: number | undefined): Promise<number | undefined>
{
    const header: DataView | undefined = await ReadExactly(source, directory, 16);
    if (header === undefined)
    {
        return undefined;
    }

    const count: number = header.getUint16(12, true) + header.getUint16(14, true);
    if (count === 0 || count > Limit.DirectoryEntries)
    {
        return undefined;
    }

    const entries: DataView | undefined = await ReadExactly(source, directory + 16, count * 8);
    if (entries === undefined)
    {
        return undefined;
    }

    for (let index: number = 0; index < count; index++)
    {
        const name: number = entries.getUint32(index * 8, true);
        const isId: boolean = (name & 0x80_00_00_00) === 0;
        if (id === undefined || (isId && name === id))
        {
            return entries.getUint32(index * 8 + 4, true);
        }
    }

    return undefined;
}

/**
 * Finds the file offset and size of the first version resource.
 */
async function LocateVersionResource(source: ByteSource): Promise<ResourceLocation | undefined>
{
    const layout: Layout | undefined = await ReadLayout(source);
    const root: number | undefined =
        layout === undefined ? undefined : FileOffsetOf(layout.Sections, layout.Resources);
    if (layout === undefined || root === undefined)
    {
        return undefined;
    }

    // The type and name levels point to subdirectories; the language level points to the data.
    let offset: number = root;
    for (const id of [ VersionResourceType, undefined ])
    {
        const entry: number | undefined = await DirectoryEntry(source, offset, id);
        if (entry === undefined || (entry & 0x80_00_00_00) === 0)
        {
            return undefined;
        }

        offset = root + (entry & 0x7F_FF_FF_FF);
    }

    const language: number | undefined = await DirectoryEntry(source, offset, undefined);
    if (language === undefined || (language & 0x80_00_00_00) !== 0)
    {
        return undefined;
    }

    const data: DataView | undefined = await ReadExactly(source, root + language, 8);
    const dataOffset: number | undefined = data === undefined
        ? undefined
        : FileOffsetOf(layout.Sections, data.getUint32(0, true));

    if (data === undefined || dataOffset === undefined)
    {
        return undefined;
    }

    return {
        Offset: dataOffset,
        Size: Math.min(data.getUint32(4, true), Limit.VersionResourceBytes)
    };
}

/**
 * Combines the high and low words of a `VS_FIXEDFILEINFO` version into four parts.
 */
function FourPartVersion(high: number, low: number): BdsVersion
{
    return Object.freeze([ high >>> 16, high & 0xFF_FF, low >>> 16, low & 0xFF_FF ]);
}

/**
 * Reads the file and product versions from executable bytes, or yields `undefined` when the data
 * is not a Portable Executable or has no version resource.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function ReadPeVersionInfo(source: ByteSource): Promise<PeVersionInfo | undefined>
{
    const resource: ResourceLocation | undefined = await LocateVersionResource(source);
    if (resource === undefined)
    {
        return undefined;
    }

    const bytes: Uint8Array = await source.Read(resource.Offset, resource.Size);
    const view: DataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
    // The structure follows a variable-length key and is aligned to four bytes.
    for (let offset: number = 0; offset + 52 <= bytes.length; offset += 4)
    {
        if (view.getUint32(offset, true) === FixedFileInfoSignature)
        {
            const word: (index: number) => number = (index: number) =>
                view.getUint32(offset + index * 4, true);

            return {
                FileVersion: FourPartVersion(word(2), word(3)),
                ProductVersion: FourPartVersion(word(4), word(5))
            };
        }
    }

    return undefined;
}

/**
 * Wraps bytes held in memory as a byte source.
 *
 * @category Functions
 * @since 1.0.0
 */
export function MemorySource(bytes: Uint8Array): ByteSource
{
    return {
        Read: async (offset: number, length: number) =>
            bytes.subarray(Math.min(offset, bytes.length), Math.min(offset + length, bytes.length))
    };
}

/**
 * Reads the file and product versions of an executable on disk, or yields `undefined` when the
 * file cannot be read, is not a Portable Executable, or has no version resource.
 *
 * @category Functions
 * @since 1.0.0
 */
export async function ReadPeFileVersionInfo(path: string): Promise<PeVersionInfo | undefined>
{
    let handle: FileHandle | undefined = undefined;
    try
    {
        handle = await open(path, "r");
        const file: FileHandle = handle;
        return await ReadPeVersionInfo({
            Read: async (offset: number, length: number) =>
            {
                const buffer: Uint8Array = new Uint8Array(length);
                const { bytesRead } = await file.read(buffer, 0, length, offset);
                return buffer.subarray(0, bytesRead);
            }
        });
    }
    catch
    {
        return undefined;
    }
    finally
    {
        await handle?.close().catch(() => undefined);
    }
}
