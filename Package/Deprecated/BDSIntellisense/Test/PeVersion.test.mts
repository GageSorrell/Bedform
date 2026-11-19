/**
 * Reading `VS_FIXEDFILEINFO` from fixture executables and from the installed `bedrock_server.exe`.
 *
 * @module bds-intellisense/Test/PeVersion.test
 *
 * @file      PeVersion.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { BdsPe, BuildPe } from "./PeFixture.mts";
import { PeVersion, Version } from "bds-intellisense";
import Assert from "node:assert/strict";
import type { FileHandle } from "node:fs/promises";
import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { test } from "node:test";

/** The machine's BDS executable, used when present. */
const InstalledExecutable: string = "C:\\MineCraft\\Server\\bedrock_server.exe";

/**
 * Reads the file version of in-memory bytes as text.
 */
async function FileVersionOf(bytes: Uint8Array): Promise<string | undefined>
{
    const info: PeVersion.PeVersionInfo | undefined =
        await PeVersion.ReadPeVersionInfo(PeVersion.MemorySource(bytes));

    return info === undefined ? undefined : Version.Format(info.FileVersion);
}

test("ReadPeVersionInfo reads both versions from a 64-bit executable", async () =>
{
    const info: PeVersion.PeVersionInfo | undefined =
        await PeVersion.ReadPeVersionInfo(PeVersion.MemorySource(BdsPe));

    Assert.deepEqual(info?.FileVersion, [ 1, 26, 63, 1 ]);
    Assert.deepEqual(info?.ProductVersion, [ 1, 26, 0, 0 ]);
});

test("ReadPeVersionInfo reads a 32-bit executable", async () =>
{
    const bytes: Uint8Array = BuildPe({
        FileVersion: [ 1, 16, 0, 2 ],
        IncludeVersion: true,
        Pe32: true,
        ProductVersion: [ 1, 16, 0, 2 ]
    });

    Assert.equal(await FileVersionOf(bytes), "1.16.0.2");
});

test("ReadPeVersionInfo yields undefined without a version resource", async () =>
{
    const bytes: Uint8Array = BuildPe({
        FileVersion: [ 1, 26, 63, 1 ],
        IncludeVersion: false,
        Pe32: false,
        ProductVersion: [ 1, 26, 63, 1 ]
    });

    Assert.equal(await FileVersionOf(bytes), undefined);
});

test("ReadPeVersionInfo yields undefined for data that is not a whole executable", async () =>
{
    const elf: Uint8Array = new Uint8Array(512);
    elf.set([ 0x7F, 0x45, 0x4C, 0x46 ]);
    Assert.equal(await FileVersionOf(elf), undefined, "ELF");
    Assert.equal(await FileVersionOf(new Uint8Array()), undefined, "empty");
    Assert.equal(await FileVersionOf(BdsPe.subarray(0, 0x02_10)), undefined, "truncated");

    const misdirected: Uint8Array = BdsPe.slice();
    new DataView(misdirected.buffer).setUint32(0x3C, 0x7F_FF_FF_FF, true);
    Assert.equal(await FileVersionOf(misdirected), undefined, "PE header past the end");
});

test("ReadPeFileVersionInfo yields undefined for a missing file", async () =>
{
    Assert.equal(await PeVersion.ReadPeFileVersionInfo("Z:\\no\\such\\bedrock_server.exe"), undefined);
});

test("the installed bedrock_server.exe is read with a few small reads", {
    skip: !existsSync(InstalledExecutable)
}, async () =>
{
    Assert.deepEqual(
        (await PeVersion.ReadPeFileVersionInfo(InstalledExecutable))?.FileVersion,
        [ 1, 26, 63, 1 ]);

    const handle: FileHandle = await open(InstalledExecutable, "r");
    let total: number = 0;
    try
    {
        await PeVersion.ReadPeVersionInfo({
            Read: async (offset: number, length: number) =>
            {
                total += length;
                const buffer: Uint8Array = new Uint8Array(length);
                const { bytesRead } = await handle.read(buffer, 0, length, offset);
                return buffer.subarray(0, bytesRead);
            }
        });
    }
    finally
    {
        await handle.close();
    }

    Assert.ok(total < 16_384, `read ${total} bytes`);
});
