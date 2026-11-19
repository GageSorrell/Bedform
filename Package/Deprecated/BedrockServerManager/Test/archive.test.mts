/**
 * Streaming ZIP descriptors, local record reconciliation and bounded decoding.
 *
 * @module bedrock-server-manager/Test/archive.test
 *
 * @file      archive.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Effect, FileSystem, Path } from "effect";
import { Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8, zipSync } from "fflate";
import { NodeServices } from "@effect/platform-node";
import assert from "node:assert/strict";
import { decodeArchive } from "../Distribution/archive.js";
import { installAddon } from "../Distribution/install.js";
import test from "node:test";
import { Option } from "effect";

const decode: (bytes: Uint8Array, limit?: number) => Map<string, Uint8Array> = (
    bytes: Uint8Array,
    limit: number = 1024 ** 3
) => decodeArchive(bytes, { limit,
    used: 0 });
const streamed: (files: Map<string, Uint8Array>, compress: boolean) => Uint8Array = (
    files: Map<string, Uint8Array>,
    compress: boolean
) =>
{
    const chunks: Array<Uint8Array> = [];
    const zip: Zip = new Zip((error, bytes: Uint8Array) =>
    {
        if (error)
        {
            throw error;
        }

        chunks.push(bytes);
    });
    for (const [ name, bytes ] of files)
    {
        const entry: ZipDeflate | ZipPassThrough = compress
            ? new ZipDeflate(name)
            : new ZipPassThrough(name);
        zip.add(entry);
        for (let offset: number = 0; offset < bytes.length; offset += 17)
        {
            entry.push(bytes.subarray(offset, offset + 17), offset + 17 >= bytes.length);
        }

        if (!bytes.length)
        {
            entry.push(bytes, true);
        }
    }

    zip.end();
    const result: Uint8Array = new Uint8Array(
        chunks.reduce((sum: number, chunk: Uint8Array) => sum + chunk.length, 0)
    );
    let offset: number = 0;
    for (const chunk of chunks)
    {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
};

const locations: (bytes: Uint8Array) => {
    central: number;
    start: number;
    view: DataView;
} = (bytes: Uint8Array) =>
{
    const view: DataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const central: number = view.getUint32(bytes.length - 6, true);
    const start: number = 30 + view.getUint16(26, true) + view.getUint16(28, true);
    return { central,
        start,
        view };
};

test("streaming stored/deflated ZIPs preserve nested signatures, empty entries and chunk boundaries", () =>
{
    const nested: Uint8Array = zipSync({
        empty: new Uint8Array(),
        "manifest.json": strToU8("nested bytes")
    });
    const payload: Uint8Array = new Uint8Array(65539);
    payload.set(strToU8("PK\u0003\u0004PK\u0007\bPK\u0001\u0002"), 1021);
    const files: Map<string, Uint8Array> = new Map([
        [ "nested.mcpack", nested ],
        [ "payload.bin", payload ],
        [ "empty", new Uint8Array() ],
        [ "二.txt", strToU8("Unicode") ]
    ]);
    for (const compress of [ false, true ])
    {
        const bytes: Uint8Array = streamed(files, compress);
        assert.deepEqual(decode(bytes), files);
        const decodedNested: Option.Option<Uint8Array> = Option.fromUndefinedOr(decode(bytes).get("nested.mcpack"));
        assert.ok(Option.isSome(decodedNested));
        assert.deepEqual(decode(decodedNested.value), decode(nested));
        const expanded: number = [ ...files.values() ].reduce(
            (sum: number, value: Uint8Array) => sum + value.length,
            0
        );
        assert.throws(() => decode(bytes, expanded - 1), /limit/);
    }
});

test("unsigned data descriptors and reordered central entries decode using indexed local offsets", () =>
{
    const original: Uint8Array = streamed(new Map([ [ "file", strToU8("content") ] ]), false);
    const { central } = locations(original);
    const unsigned: Uint8Array = new Uint8Array(original.length - 4);
    unsigned.set(original.subarray(0, central - 16));
    unsigned.set(original.subarray(central - 12), central - 16);
    new DataView(unsigned.buffer).setUint32(unsigned.length - 6, central - 4, true);
    assert.deepEqual(decode(unsigned).get("file"), strToU8("content"));
    const pair: Uint8Array = zipSync({
        first: strToU8("1"),
        second: strToU8("2")
    });
    const index: number = locations(pair).central;
    const records: Uint8Array = pair.slice(index, pair.length - 22);
    const split: number = 46 + "first".length;
    pair.set(records.subarray(split), index);
    pair.set(records.subarray(0, split), index + records.length - split);
    const first: Option.Option<Uint8Array> = Option.fromUndefinedOr(decode(pair).get("first"));
    assert.ok(Option.isSome(first));
    assert.equal(strFromU8(first.value), "1");
});

test("local header, descriptor, offset and disk tampering is rejected before extraction", () =>
{
    const original: Uint8Array = streamed(new Map([ [ "file", strToU8("payload") ] ]), false);
    const { central } = locations(original);
    const mutations: Array<(view: DataView) => void> = [
        (view: DataView) => view.setUint16(6, 0, true),
        (view: DataView) => view.setUint16(8, 8, true),
        (view: DataView) => view.setUint32(18, 999, true),
        (view: DataView) => view.setUint32(central - 12, 0, true),
        (view: DataView) => view.setUint32(central - 8, 999, true),
        (view: DataView) => view.setUint32(central + 42, 1, true),
        (view: DataView) => view.setUint16(central + 34, 1, true),
        (view: DataView) => view.setUint16(central + 8, 1, true),
        (view: DataView) => view.setUint32(central + 20, 0xffffffff, true)
    ];
    for (const mutate of mutations)
    {
        const bytes: Uint8Array = original.slice();
        mutate(new DataView(bytes.buffer));
        assert.throws(() => decode(bytes), /ZIP|Unsafe/);
    }

    const duplicate: Uint8Array = zipSync({
        first: strToU8("1"),
        second: strToU8("2")
    });
    const index: number = locations(duplicate).central + 46 + "first".length;
    new DataView(duplicate.buffer).setUint32(index + 42, 0, true);
    assert.throws(() => decode(duplicate), /mismatch|Overlapping/);
    for (const length of [ 0, 1, 21, original.length - 1 ])
    {
        assert.throws(() => decode(original.subarray(0, length)), /ZIP/);
    }
});

test("actual expansion and CRC are checked even when headers agree on forged sizes/CRC", () =>
{
    const original: Uint8Array = zipSync({
        file: new Uint8Array(131072).fill(65)
    });
    for (const crc of [ false, true ])
    {
        const bytes: Uint8Array = original.slice();
        const { central, view } = locations(bytes);
        view.setUint32(crc ? 14 : 22, crc ? 123 : 1, true);
        view.setUint32(central + (crc ? 16 : 24), crc ? 123 : 1, true);
        assert.throws(() => decode(bytes), crc ? /CRC/ : /exceeded declared size/);
    }
});

test("nested streaming mcaddons install through source ingestion as complete paired bundles", () =>
    Effect.runPromise(
        Effect.scoped(
            Effect.gen(function* ()
            {
                const fs: FileSystem.FileSystem = yield* FileSystem.FileSystem;
                const path: Path.Path = yield* Path.Path;
                const root: string = yield* fs.makeTempDirectoryScoped({
                    prefix: "bds-streaming-"
                });
                const context: {
                    cwd: string;
                    env: { BDS_CONFIG_PATH: string };
                    home: string;
                    platform: NodeJS.Platform;
                } = {
                    cwd: root,
                    env: { BDS_CONFIG_PATH: path.join(root, "config.json") },
                    home: root,
                    platform: process.platform
                };
                const pack: (number: number, kind: string) => Uint8Array = (
                    number: number,
                    kind: string
                ) =>
                    streamed(
                        new Map([
                            [
                                "manifest.json",
                                strToU8(
                                    JSON.stringify({
                                        format_version: 2,
                                        header: {
                                            description: "Streaming",
                                            min_engine_version: [ 1, 21, 0 ],
                                            name: `Streaming ${number}`,
                                            uuid: `88888888-8888-8888-8888-00000000000${number}`,
                                            version: [ 1, 0, 0 ]
                                        },
                                        modules: [
                                            {
                                                type: kind,
                                                uuid: `99999999-9999-9999-9999-00000000000${number}`,
                                                version: [ 1, 0, 0 ]
                                            }
                                        ]
                                    })
                                )
                            ],
                            [ "asset.bin", new Uint8Array([ 0, 255, 13, 10 ]) ]
                        ]),
                        true
                    );
                for (const compress of [ false, true ])
                {
                    const server: string = path.join(root, `server-${compress}`);
                    yield* fs.makeDirectory(server);
                    const source: string = path.join(root, `source-${compress}.mcaddon`);
                    yield* fs.writeFile(
                        source,
                        streamed(
                            new Map([
                                [ "behavior.mcpack", pack(1, "data") ],
                                [ "resource.mcpack", pack(2, "resources") ]
                            ]),
                            compress
                        )
                    );
                    const installed = yield* installAddon(context, source, {
                        enable: false,
                        server
                    });
                    assert.equal(installed.packs.length, 2);
                    for (const member of installed.packs)
                    {
                        const file: string = path.join(
                            server,
                            ...member.location.split("/"),
                            "asset.bin"
                        );
                        assert.deepEqual([ ...(yield* fs.readFile(file)) ], [ 0, 255, 13, 10 ]);
                    }
                }
            })
        ).pipe(Effect.provide(NodeServices.layer))
    ));
