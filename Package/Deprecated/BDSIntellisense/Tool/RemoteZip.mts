/**
 * Extracts single entries from zip archives over HTTP, using Range requests where possible.
 *
 * Only three regions are fetched: the end-of-central-directory record, the central directory, and
 * the one entry's local header and data.  ZIP64 archives are supported.  When a server ignores
 * Range requests, the whole archive is downloaded once and read from memory instead.
 *
 * @module bds-intellisense/Tool/RemoteZip
 *
 * @file      RemoteZip.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { crc32, inflateRawSync } from "node:zlib";

/**
 * Random access to the bytes of an archive of known size.
 *
 * @category Tools
 * @since 1.0.0
 */
export interface ArchiveReader
{
    /** Reads exactly `length` bytes at `offset`, or rejects. */
    readonly Read: (offset: number, length: number) => Promise<Uint8Array>;
    readonly Size: number;
}

/**
 * Where a central-directory entry's data lies, and how it is stored.
 */
interface EntryLocation
{
    readonly CompressedSize: number;
    readonly Crc: number;
    readonly HeaderOffset: number;
    readonly Method: number;
    readonly Name: string;
    readonly UncompressedSize: number;
}

/**
 * The position and length of the central directory.
 */
interface CentralDirectory
{
    readonly Count: number;
    readonly Offset: number;
    readonly Size: number;
}

/**
 * Sizes and the header offset of an entry, which the ZIP64 extra field may replace.
 */
interface EntrySizes
{
    Compressed: number;
    HeaderOffset: number;
    Uncompressed: number;
}

/** Signatures of the zip records this module reads. */
const Signature = Object.freeze({
    CentralEntry: 0x02_01_4B_50,
    EndOfCentralDirectory: 0x06_05_4B_50,
    LocalHeader: 0x04_03_4B_50,
    Zip64End: 0x06_06_4B_50,
    Zip64Locator: 0x07_06_4B_50
} as const);

/** The value that marks a 32-bit field as moved to the ZIP64 extra field. */
const Zip64Marker: number = 0xFF_FF_FF_FF;

/** Attempts per request before a network or server error is reported. */
const Attempts: number = 4;

/**
 * Wraps bytes in a data view.
 */
function View(bytes: Uint8Array): DataView
{
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Waits for a number of milliseconds.
 */
async function Delay(milliseconds: number): Promise<void>
{
    await new Promise<void>((resolve: () => void) =>
    {
        setTimeout(resolve, milliseconds);
    });
}

/**
 * Fetches a URL, retrying network errors and server errors with a growing delay.
 *
 * @throws { Error } When every attempt fails.
 */
async function FetchWithRetry(url: string, headers: Readonly<Record<string, string>>): Promise<Response>
{
    let failure: unknown = undefined;
    for (let attempt: number = 1; attempt <= Attempts; attempt++)
    {
        try
        {
            const response: Response = await fetch(url, { headers });
            if (response.status < 500)
            {
                return response;
            }

            failure = new Error(`${url} answered ${response.status} ${response.statusText}.`);
            await response.body?.cancel();
        }
        catch (error: unknown)
        {
            failure = error;
        }

        await Delay(500 * 2 ** attempt);
    }

    throw failure instanceof Error ? failure : new Error(String(failure));
}

/**
 * Wraps in-memory bytes as an archive reader.
 *
 * @throws { Error } From the returned reader, when a read falls outside the bytes.
 *
 * @category Tools
 * @since 1.0.0
 */
export function MemoryArchive(bytes: Uint8Array): ArchiveReader
{
    return {
        Read: async (offset: number, length: number) =>
        {
            if (offset < 0 || offset + length > bytes.length)
            {
                throw new Error(`Read of ${length} bytes at ${offset} is outside the archive.`);
            }

            return bytes.subarray(offset, offset + length);
        },
        Size: bytes.length
    };
}

/**
 * Opens a remote archive, or yields `undefined` when the server reports that it does not exist.
 *
 * @throws { Error } When the server answers with another error, or a ranged read comes back short.
 *
 * @category Tools
 * @since 1.0.0
 */
export async function OpenRemoteArchive(url: string, userAgent: string): Promise<ArchiveReader | undefined>
{
    const probe: Response = await FetchWithRetry(url, {
        Range: "bytes=0-0",
        "User-Agent": userAgent
    });

    if (probe.status === 404 || probe.status === 403)
    {
        await probe.body?.cancel();
        return undefined;
    }

    if (probe.status === 200)
    {
        return MemoryArchive(new Uint8Array(await probe.arrayBuffer()));
    }

    const total: RegExpExecArray | null = /\/(\d+)$/u.exec(probe.headers.get("Content-Range") ?? "");
    await probe.body?.cancel();
    if (probe.status !== 206 || total === null)
    {
        throw new Error(`${url} answered ${probe.status} without a usable Content-Range.`);
    }

    return {
        Read: async (offset: number, length: number) =>
        {
            const response: Response = await FetchWithRetry(url, {
                Range: `bytes=${offset}-${offset + length - 1}`,
                "User-Agent": userAgent
            });

            const bytes: Uint8Array = new Uint8Array(await response.arrayBuffer());
            if (response.status !== 206 || bytes.length !== length)
            {
                throw new Error(`${url} returned ${bytes.length} of ${length} bytes at ${offset}.`);
            }

            return bytes;
        },
        Size: Number(total[1])
    };
}

/**
 * Locates the central directory from the end-of-central-directory record.
 *
 * @throws { Error } When the record is missing or malformed.
 */
async function FindCentralDirectory(archive: ArchiveReader): Promise<CentralDirectory>
{
    const tailLength: number = Math.min(archive.Size, 22 + 65_535);
    const tailStart: number = archive.Size - tailLength;
    const tail: Uint8Array = await archive.Read(tailStart, tailLength);
    const view: DataView = View(tail);
    let end: number = -1;
    for (let offset: number = tail.length - 22; offset >= 0; offset--)
    {
        if (view.getUint32(offset, true) === Signature.EndOfCentralDirectory)
        {
            end = offset;
            break;
        }
    }

    if (end < 0)
    {
        throw new Error("The archive has no end-of-central-directory record.");
    }

    const count: number = view.getUint16(end + 10, true);
    const size: number = view.getUint32(end + 12, true);
    const offset: number = view.getUint32(end + 16, true);
    if (count !== 0xFF_FF && size !== Zip64Marker && offset !== Zip64Marker)
    {
        return {
            Count: count,
            Offset: offset,
            Size: size
        };
    }

    if (end < 20 || view.getUint32(end - 20, true) !== Signature.Zip64Locator)
    {
        throw new Error("The archive needs ZIP64 but has no ZIP64 locator.");
    }

    const record: DataView = View(await archive.Read(Number(view.getBigUint64(end - 12, true)), 56));
    if (record.getUint32(0, true) !== Signature.Zip64End)
    {
        throw new Error("The ZIP64 end-of-central-directory record is missing.");
    }

    return {
        Count: Number(record.getBigUint64(32, true)),
        Offset: Number(record.getBigUint64(48, true)),
        Size: Number(record.getBigUint64(40, true))
    };
}

/**
 * Reads the ZIP64 replacements for 32-bit fields that hold the ZIP64 marker.
 */
function ApplyZip64(extra: DataView, sizes: EntrySizes): void
{
    for (let offset: number = 0; offset + 4 <= extra.byteLength;)
    {
        const id: number = extra.getUint16(offset, true);
        const length: number = extra.getUint16(offset + 2, true);
        if (id === 0x00_01)
        {
            let field: number = offset + 4;
            for (const key of [ "Uncompressed", "Compressed", "HeaderOffset" ] as const)
            {
                if (sizes[key] === Zip64Marker && field + 8 <= offset + 4 + length)
                {
                    sizes[key] = Number(extra.getBigUint64(field, true));
                    field += 8;
                }
            }

            return;
        }

        offset += 4 + length;
    }
}

/**
 * Lists the entries of the central directory.
 *
 * @throws { Error } When an entry is malformed.
 */
async function ReadEntries(archive: ArchiveReader): Promise<Array<EntryLocation>>
{
    const directory: CentralDirectory = await FindCentralDirectory(archive);
    const bytes: Uint8Array = await archive.Read(directory.Offset, directory.Size);
    const view: DataView = View(bytes);
    const decoder: TextDecoder = new TextDecoder();
    const entries: Array<EntryLocation> = [];
    let offset: number = 0;
    for (let index: number = 0; index < directory.Count; index++)
    {
        if (view.getUint32(offset, true) !== Signature.CentralEntry)
        {
            throw new Error(`Central directory entry ${index} is malformed.`);
        }

        const nameLength: number = view.getUint16(offset + 28, true);
        const extraLength: number = view.getUint16(offset + 30, true);
        const commentLength: number = view.getUint16(offset + 32, true);
        const sizes: EntrySizes = {
            Compressed: view.getUint32(offset + 20, true),
            HeaderOffset: view.getUint32(offset + 42, true),
            Uncompressed: view.getUint32(offset + 24, true)
        };

        const extraStart: number = offset + 46 + nameLength;
        ApplyZip64(View(bytes.subarray(extraStart, extraStart + extraLength)), sizes);
        entries.push({
            CompressedSize: sizes.Compressed,
            Crc: view.getUint32(offset + 16, true),
            HeaderOffset: sizes.HeaderOffset,
            Method: view.getUint16(offset + 10, true),
            Name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
            UncompressedSize: sizes.Uncompressed
        });

        offset += 46 + nameLength + extraLength + commentLength;
    }

    return entries;
}

/**
 * Extracts the entry whose path is `name`, or failing that the shallowest entry whose file name is
 * `name`.  Yields `undefined` when the archive has no such entry.
 *
 * @throws { Error } When the archive is malformed, the entry uses an unsupported compression method,
 * or its checksum does not match.
 *
 * @category Tools
 * @since 1.0.0
 */
export async function ExtractEntry(archive: ArchiveReader, name: string): Promise<Uint8Array | undefined>
{
    const entries: Array<EntryLocation> = await ReadEntries(archive);
    const depth: (entry: EntryLocation) => number = (entry: EntryLocation) => entry.Name.split("/").length;
    const exact: EntryLocation | undefined = entries.find((candidate: EntryLocation) =>
        candidate.Name === name);

    const entry: EntryLocation | undefined = exact ?? entries
        .filter((candidate: EntryLocation) => candidate.Name.endsWith(`/${name}`))
        .sort((left: EntryLocation, right: EntryLocation) => depth(left) - depth(right))[0];

    if (entry === undefined)
    {
        return undefined;
    }

    const header: DataView = View(await archive.Read(entry.HeaderOffset, 30));
    if (header.getUint32(0, true) !== Signature.LocalHeader)
    {
        throw new Error(`The local header of ${entry.Name} is malformed.`);
    }

    const dataOffset: number =
        entry.HeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
    const compressed: Uint8Array = await archive.Read(dataOffset, entry.CompressedSize);
    let data: Uint8Array;
    switch (entry.Method)
    {
        case 0:
            data = compressed;
            break;
        case 8:
            data = new Uint8Array(inflateRawSync(compressed));
            break;
        default:
            throw new Error(`${entry.Name} uses unsupported compression method ${entry.Method}.`);
    }

    if (data.length !== entry.UncompressedSize || crc32(data) !== entry.Crc)
    {
        throw new Error(`${entry.Name} failed its size or checksum check.`);
    }

    return data;
}
