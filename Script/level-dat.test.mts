/** @file level-dat.test.mts Node tooling for level-dat.test. */
// Run with: node --test Script/level-dat.test.mts
import { repairBiomeOverride, topLevelTags } from "./level-dat.mts";
import type { WithImplicitCoercion } from "node:buffer";
import assert from "node:assert/strict";
import { test } from "node:test";

const name = (text: WithImplicitCoercion<string>) =>
{
    const bytes = Buffer.from(text, "utf8");
    const length = Buffer.alloc(2);
    length.writeUInt16LE(bytes.length);
    return Buffer.concat([ length, bytes ]);
};

const tag = (type: number, key: string, payload: Uint8Array | Buffer) =>
    Buffer.concat([ Buffer.from([ type ]), name(key), payload ]);
const int = (value: number) =>
{
    const bytes = Buffer.alloc(4);
    bytes.writeInt32LE(value);
    return bytes;
};

const compound = (...tags: Array<Buffer>) => Buffer.concat([ ...tags, Buffer.from([ 0 ]) ]);

/** Build a level.dat fixture from named top-level tags. */
function levelDat(...tags: Array<Buffer>)
{
    const body = tag(10, "", compound(...tags));
    const header = Buffer.alloc(8);
    header.writeInt32LE(10, 0);
    header.writeInt32LE(body.length, 4);
    return Buffer.concat([ header, body ]);
}

// One of every payload shape the skipper has to step over, before and after the field.
const before = [
    tag(1, "byte", Buffer.from([ 1 ])),
    tag(4, "long", Buffer.alloc(8, 7)),
    tag(5, "float", Buffer.alloc(4)),
    tag(7, "bytes", Buffer.concat([ int(3), Buffer.from([ 1, 2, 3 ]) ])),
    tag(11, "ints", Buffer.concat([ int(2), int(1), int(2) ])),
    tag(9, "list", Buffer.concat([ Buffer.from([ 8 ]), int(2), name("a"), name("bc") ])),
    tag(
        10,
        "experiments",
        compound(
            tag(1, "upcoming_creator_features", Buffer.from([ 1 ])),
            tag(1, "gametest", Buffer.from([ 1 ]))
        )
    )
];
const after = [
    tag(8, "LevelName", name("Industrial Realism")),
    tag(12, "longs", Buffer.concat([ int(1), Buffer.alloc(8, 9) ]))
];

test("an empty or prefix-only BiomeOverride is removed and nothing else changes", () =>
{
    for (const value of [ "", "minecraft:", "minecraft:".repeat(31) ])
    {
        const result = repairBiomeOverride(
            levelDat(...before, tag(8, "BiomeOverride", name(value)), ...after)
        );
        assert.equal(result.status, "removed");
        assert.equal(result.prefixes, value.length / 10);
        assert.deepEqual(result.bytes, levelDat(...before, ...after));
        assert.deepEqual(
            topLevelTags(result.bytes).map(
                ({
                    name
                }: {
                    end: number;
                    name: string;
                    start: number;
                    type: number;
                    value: string | undefined;
                }) => name
            ),
            [ ...before, ...after ].map(
                (bytes: Buffer) => topLevelTags(levelDat(bytes))[0].name
            )
        );
    }
});

test("a real biome and a missing field are left alone", () =>
{
    const biome = levelDat(...before, tag(8, "BiomeOverride", name("minecraft:desert")));
    assert.deepEqual(repairBiomeOverride(biome), {
        bytes: biome,
        status: "kept",
        value: "minecraft:desert"
    });
    const none = levelDat(...before);
    assert.deepEqual(repairBiomeOverride(none), { bytes: none,
        status: "absent" });
});

test("a damaged file is refused", () =>
{
    const bytes = levelDat(tag(8, "BiomeOverride", name("")));
    assert.throws(
        () => repairBiomeOverride(bytes.subarray(0, bytes.length - 1)),
        /length header/
    );
});
