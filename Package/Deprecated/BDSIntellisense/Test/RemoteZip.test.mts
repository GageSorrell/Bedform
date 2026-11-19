/**
 * Entry extraction from zip archives built in memory, including ZIP64 end records.
 *
 * @module bds-intellisense/Test/RemoteZip.test
 *
 * @file      RemoteZip.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ExtractEntry, MemoryArchive } from "../Tool/RemoteZip.mts";
import { crc32, deflateRawSync } from "node:zlib";
import Assert from "node:assert/strict";
import { test } from "node:test";

/**
 * A file to put in a fixture archive.
 */
interface FixtureEntry
{
    readonly Data: string;
    readonly Deflate: boolean;
    readonly Name: string;
}

/**
 * How to write a fixture archive.
 */
interface ZipOptions
{
    /** Replaces the stored checksum of every entry with a wrong one. */
    readonly CorruptChecksum?: boolean;
    /** Writes ZIP64 end records, with markers in the ordinary end record. */
    readonly Zip64?: boolean;
}

/**
 * Adds up the lengths of byte arrays.
 */
function TotalLength(parts: ReadonlyArray<Uint8Array>): number
{
    return parts.reduce((total: number, part: Uint8Array) => total + part.length, 0);
}

/**
 * Builds a zip archive of the given entries.
 */
function BuildZip(entries: ReadonlyArray<FixtureEntry>, options: ZipOptions = {}): Uint8Array
{
    const encoder: TextEncoder = new TextEncoder();
    const locals: Array<Uint8Array> = [];
    const centrals: Array<Uint8Array> = [];
    let offset: number = 0;
    for (const entry of entries)
    {
        const name: Uint8Array = encoder.encode(entry.Name);
        const raw: Uint8Array = encoder.encode(entry.Data);
        const data: Uint8Array = entry.Deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
        const checksum: number = options.CorruptChecksum === true ? (crc32(raw) ^ 1) >>> 0 : crc32(raw);
        const method: number = entry.Deflate ? 8 : 0;

        const local: Uint8Array = new Uint8Array(30 + name.length + data.length);
        const localView: DataView = new DataView(local.buffer);
        localView.setUint32(0, 0x04_03_4B_50, true);
        localView.setUint16(8, method, true);
        localView.setUint32(14, checksum, true);
        localView.setUint32(18, data.length, true);
        localView.setUint32(22, raw.length, true);
        localView.setUint16(26, name.length, true);
        local.set(name, 30);
        local.set(data, 30 + name.length);

        const central: Uint8Array = new Uint8Array(46 + name.length);
        const centralView: DataView = new DataView(central.buffer);
        centralView.setUint32(0, 0x02_01_4B_50, true);
        centralView.setUint16(10, method, true);
        centralView.setUint32(16, checksum, true);
        centralView.setUint32(20, data.length, true);
        centralView.setUint32(24, raw.length, true);
        centralView.setUint16(28, name.length, true);
        centralView.setUint32(42, offset, true);
        central.set(name, 46);

        locals.push(local);
        centrals.push(central);
        offset += local.length;
    }

    const directorySize: number = TotalLength(centrals);
    const tail: Array<Uint8Array> = [];
    const end: Uint8Array = new Uint8Array(22);
    const endView: DataView = new DataView(end.buffer);
    endView.setUint32(0, 0x06_05_4B_50, true);
    if (options.Zip64 === true)
    {
        const record: Uint8Array = new Uint8Array(56);
        const recordView: DataView = new DataView(record.buffer);
        recordView.setUint32(0, 0x06_06_4B_50, true);
        recordView.setBigUint64(32, BigInt(entries.length), true);
        recordView.setBigUint64(40, BigInt(directorySize), true);
        recordView.setBigUint64(48, BigInt(offset), true);

        const locator: Uint8Array = new Uint8Array(20);
        const locatorView: DataView = new DataView(locator.buffer);
        locatorView.setUint32(0, 0x07_06_4B_50, true);
        locatorView.setBigUint64(8, BigInt(offset + directorySize), true);

        endView.setUint16(10, 0xFF_FF, true);
        endView.setUint32(12, 0xFF_FF_FF_FF, true);
        endView.setUint32(16, 0xFF_FF_FF_FF, true);
        tail.push(record, locator);
    }
    else
    {
        endView.setUint16(10, entries.length, true);
        endView.setUint32(12, directorySize, true);
        endView.setUint32(16, offset, true);
    }

    tail.push(end);
    const parts: Array<Uint8Array> = [ ...locals, ...centrals, ...tail ];
    const bytes: Uint8Array = new Uint8Array(TotalLength(parts));
    let position: number = 0;
    for (const part of parts)
    {
        bytes.set(part, position);
        position += part.length;
    }

    return bytes;
}

/** Entries resembling a BDS zip: a nested decoy, the root file, and another file. */
const Entries: ReadonlyArray<FixtureEntry> = [
    {
        Data: "decoy=true\n",
        Deflate: false,
        Name: "config/default/server.properties"
    },
    {
        Data: "server-name=Dedicated Server\n".repeat(20),
        Deflate: true,
        Name: "server.properties"
    },
    {
        Data: "[]",
        Deflate: false,
        Name: "permissions.json"
    }
];

/**
 * Extracts an entry from an in-memory archive as text.
 */
async function Extract(bytes: Uint8Array, name: string): Promise<string | undefined>
{
    const data: Uint8Array | undefined = await ExtractEntry(MemoryArchive(bytes), name);
    return data === undefined ? undefined : new TextDecoder().decode(data);
}

test("ExtractEntry prefers the root entry and inflates it", async () =>
{
    Assert.equal(await Extract(BuildZip(Entries), "server.properties"), Entries[1].Data);
    Assert.equal(await Extract(BuildZip(Entries), "permissions.json"), "[]");
});

test("ExtractEntry falls back to the shallowest nested entry", async () =>
{
    Assert.equal(await Extract(BuildZip([ Entries[0], Entries[2] ]), "server.properties"), "decoy=true\n");
});

test("ExtractEntry yields undefined for a missing entry", async () =>
{
    Assert.equal(await Extract(BuildZip(Entries), "bedrock_server.exe"), undefined);
});

test("ExtractEntry reads ZIP64 end records", async () =>
{
    Assert.equal(await Extract(BuildZip(Entries, { Zip64: true }), "server.properties"), Entries[1].Data);
});

test("ExtractEntry rejects a checksum mismatch and data that is not a zip", async () =>
{
    const corrupt: Uint8Array = BuildZip(Entries, { CorruptChecksum: true });
    await Assert.rejects(Extract(corrupt, "server.properties"), /checksum/u);
    await Assert.rejects(Extract(new Uint8Array(100), "server.properties"), /end-of-central-directory/u);
});
