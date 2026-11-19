/**
 * Bounded ZIP decoding with central/local reconciliation and portable names.
 *
 * @module bedrock-server-manager/archive
 *
 * @file      archive.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as BedrockString from "@bedform/effect/String";
import { Inflate, strFromU8 } from "fflate";
import { portableName } from "./safety.js";

/** One shared budget counts bytes expanded at every archive layer. */
export interface ExpansionBudget
{
    used: number;
    readonly limit: number;
}

interface ZipEntry
{
    readonly name: string;
    readonly original: string;
    readonly size: number;
    readonly compressed: number;
    readonly method: number;
    readonly crc: number;
    readonly directory: boolean;
    readonly flags: number;
    readonly local: number;
    readonly start: number;
    readonly end: number;
}

const crcTable = Uint32Array.from({ length: 256 }, (_: unknown, number: number) =>
{
    let value = number;
    for (let bit = 0; bit < 8; bit++) { value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0); }
    return value >>> 0;
});
const crc32 = (bytes: Uint8Array): number =>
{
    let value = 0xffffffff;
    for (const byte of bytes) { value = (value >>> 8) ^ crcTable[(value ^ byte) & 255]; }
    return (value ^ 0xffffffff) >>> 0;
};

/**
 * Charge expanded content before it can be retained or written.
 *
 * @throws {Error} When aggregate expanded content exceeds the allowed budget.
 */
const charge = (budget: ExpansionBudget, size: number): void =>
{
    if (size < 0 || !Number.isSafeInteger(size) || size > budget.limit - budget.used)
    {
        throw new Error(`Expanded content exceeds the ${budget.limit}-byte limit (maximum 1 GiB).`);
    }
    budget.used += size;
};

const localEntry = (data: Uint8Array, central: number, entry: Omit<ZipEntry, "start" | "end">) =>
{
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const offset = entry.local;
    const mismatch = (): never => { throw new Error(`ZIP local/central entry mismatch: ${entry.name}`); };
    if (offset + 30 > central || view.getUint32(offset, true) !== 0x04034b50)
    {
        return mismatch();
    }
    const length = view.getUint16(offset + 26, true);
    const start = offset + 30 + length + view.getUint16(offset + 28, true);
    if (start > central || view.getUint16(offset + 6, true) !== entry.flags ||
        view.getUint16(offset + 8, true) !== entry.method || strFromU8(
        data.subarray(offset + 30, offset + 30 + length), !(entry.flags & 2048)
    ) !== entry.original)
    {
        return mismatch();
    }
    const descriptor = (entry.flags & 8) !== 0;
    for (const [ field, expected ] of [ [ 14, entry.crc ], [ 18, entry.compressed ], [ 22, entry.size ] ])
    {
        const actual = view.getUint32(offset + field, true);
        if (actual !== expected && (!descriptor || actual !== 0))
        {
            return mismatch();
        }
    }
    let end = start + entry.compressed;
    if (end > central || (entry.method === 0 && entry.compressed !== entry.size))
    {
        return mismatch();
    }
    if (descriptor)
    {
        const matches = (at: number): boolean => at + 12 <= central &&
            view.getUint32(at, true) === entry.crc &&
            view.getUint32(at + 4, true) === entry.compressed &&
            view.getUint32(at + 8, true) === entry.size;
        if (end + 16 <= central && view.getUint32(end, true) === 0x08074b50 && matches(end + 4))
        {
            end += 16;
        }
        else if (matches(end))
        {
            end += 12;
        }
        else
        {
            throw new Error(`Invalid ZIP data descriptor: ${entry.name}`);
        }
    }
    return { ...entry, end, start };
};

/**
 * Check ZIP metadata before invoking any decompressor. ZIP64/encryption are unsupported.
 *
 * @throws {Error} When metadata, identities, paths or declared sizes are unsafe.
 */
const zipEntries = (data: Uint8Array, budget: ExpansionBudget): Map<string, ZipEntry> =>
{
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let end = data.length - 22;
    for (; end >= Math.max(0, data.length - 65557); end--)
    {
        if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) ===
            data.length)
        {
            break;
        }
    }
    if (end < Math.max(0, data.length - 65557))
    {
        throw new Error("Invalid ZIP end record.");
    }
    const count = view.getUint16(end + 10, true);
    const length = view.getUint32(end + 12, true);
    let offset = view.getUint32(end + 16, true);
    const central = offset;
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) ||
        view.getUint16(end + 8, true) !== count || count === 65535 || offset + length !== end)
    {
        throw new Error("Unsupported ZIP64/multi-disk archive or invalid central directory.");
    }
    const entries = new Map<string, ZipEntry>();
    let total = 0;
    for (let index = 0; index < count; index++)
    {
        if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
        {
            throw new Error("Invalid ZIP central directory entry.");
        }
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        if (offset + 46 + nameLength + extraLength + commentLength > end)
        {
            throw new Error("Truncated ZIP directory.");
        }
        const flags = view.getUint16(offset + 8, true);
        const original = strFromU8(data.subarray(offset + 46, offset + 46 + nameLength), !(flags & 2048));
        const name = portableName(original);
        const key = BedrockString.toLowerCase(name);
        const mode = view.getUint32(offset + 38, true) >>> 16;
        const method = view.getUint16(offset + 10, true);
        const size = view.getUint32(offset + 24, true);
        const compressed = view.getUint32(offset + 20, true);
        if ((flags & ~0x080e) || (mode & 0xf000) === 0xa000 || (method !== 0 && method !== 8) ||
            view.getUint16(offset + 34, true) !== 0 ||
            size === 0xffffffff || compressed === 0xffffffff || entries.has(key))
        {
            throw new Error(`Unsafe/unsupported or duplicate normalized ZIP entry: ${original}`);
        }
        const directory = /[/\\]$/.test(original);
        if (directory && size !== 0)
        {
            throw new Error(`ZIP directory contains data: ${original}`);
        }
        entries.set(key, localEntry(data, central, {
            compressed, crc: view.getUint32(offset + 16, true), directory, flags,
            local: view.getUint32(offset + 42, true), method, name, original, size
        }));
        total += size;
        if (total > budget.limit - budget.used)
        {
            throw new Error("Expanded content exceeds 1 GiB limit.");
        }
        offset += 46 + nameLength + extraLength + commentLength;
    }
    if (offset !== end)
    {
        throw new Error("ZIP directory length does not match its entries.");
    }
    let cursor = 0;
    for (const entry of [ ...entries.values() ].sort((left: ZipEntry, right: ZipEntry) =>
        left.local - right.local))
    {
        if (entry.local !== cursor)
        {
            throw new Error("Overlapping or unindexed ZIP local entries.");
        }
        cursor = entry.end;
    }
    if (cursor !== central)
    {
        throw new Error("ZIP local data does not match its central directory.");
    }
    for (const entry of entries.values())
    {
        const parts = BedrockString.toLowerCase(entry.name).split("/");
        for (let count = 1; count < parts.length; count++)
        {
            const parent = entries.get(parts.slice(0, count).join("/"));
            if (parent && !parent.directory)
            {
                throw new Error(`ZIP file/directory collision: ${entry.name}`);
            }
        }
    }
    return entries;
};

/**
 * Decode in small compressed chunks and charge actual output, checking size and CRC.
 *
 * @throws {Error} When an archive is malformed, unsafe or exceeds its shared byte budget.
 */
const decodeArchive = (data: Uint8Array, budget: ExpansionBudget): Map<string, Uint8Array> =>
{
    const entries = zipEntries(data, budget);
    const output = new Map<string, Uint8Array>();
    for (const metadata of entries.values())
    {
        const chunks: Array<Uint8Array> = [];
        let size = 0;
        let complete = false;
        const receive = (bytes: Uint8Array, final: boolean): void =>
        {
            charge(budget, bytes.length);
            size += bytes.length;
            if (size > metadata.size)
            {
                throw new Error(`ZIP entry exceeded declared size: ${metadata.name}`);
            }
            chunks.push(bytes);
            complete = final;
        };
        const inflate = metadata.method === 8 ? new Inflate(receive) : undefined;
        const end = metadata.start + metadata.compressed;
        for (let offset = metadata.start; offset < end; offset += 1024)
        {
            const next = Math.min(end, offset + 1024);
            const bytes = data.subarray(offset, next);
            if (inflate)
            {
                inflate.push(bytes, next === end);
            }
            else
            {
                receive(bytes, next === end);
            }
        }
        if (!metadata.compressed)
        {
            if (inflate)
            {
                inflate.push(new Uint8Array(), true);
            }
            else
            {
                receive(new Uint8Array(), true);
            }
        }
        if (!complete || size !== metadata.size)
        {
            throw new Error(`Truncated ZIP entry: ${metadata.name}`);
        }
        const content = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
        if (crc32(content) !== metadata.crc)
        {
            throw new Error(`ZIP CRC mismatch: ${metadata.name}`);
        }
        if (!metadata.directory)
        {
            output.set(metadata.name, content);
        }
    }
    return output;
};

export { charge, decodeArchive };
