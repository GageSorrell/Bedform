/**
 * Reproducible benchmark-source, analytic solid and real texture integrity gates.
 *
 * @module bedform/Test/PhysicsAcceptance.test
 *
 * @file      PhysicsAcceptance.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixture measurements preserve contextual types and physical ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as Fs from "node:fs/promises";
import * as Path from "node:path";
import { tmpdir } from "node:os";
import { crc32, inflateSync } from "node:zlib";
import { createFixtures, FixtureTexture } from "../Tool/physics-fixtures.mjs";
import { waitForLoadedRegion } from "./Engine/readiness.mjs";
import { galleryLevel } from "../Tool/physics-client-world.mjs";
import { topLevelTags } from "../../../Script/level-dat.mjs";

test("gallery metadata produces flat creative peaceful worlds while retaining unrelated template tags", () =>
{
    const Keep = Buffer.from("0804006b6565700300616263", "hex");
    const Template = Buffer.alloc(8 + 4 + Keep.length + 1);
    Template.writeInt32LE(10, 0);
    Template.writeInt32LE(Template.length - 8, 4);
    Template[8] = 10;
    // Root name 'x'; root ends after its name.
    Template.writeUInt16LE(1, 9);
    Template[11] = 120;
    Keep.copy(Template, 12);
    const Flat = galleryLevel(Template);
    const Tags = topLevelTags(Flat);
    const Integer = (name: string): number =>
    {
        const Tag = Tags.find((tag) => tag.name === name)!;
        Assert.equal(Tag.type, 3);
        return Flat.readInt32LE(Tag.end - 4);
    };

    Assert.equal(Integer("Generator"), 2);
    Assert.equal(Integer("GameType"), 1);
    Assert.equal(Integer("Difficulty"), 0);
    Assert.equal(Integer("SpawnY"), 99);
    const Layers = JSON.parse(Tags.find((tag) => tag.name === "FlatWorldLayers")!.value!);
    Assert.equal(Layers.block_layers.reduce((sum: number, layer: { count: number }) => sum + layer.count, 0) - 65, 98);
    Assert.equal(Layers.block_layers.at(-1).block_name, "minecraft:grass_block");
    const Force = Tags.find((tag) => tag.name === "ForceGameType")!;
    Assert.equal(Force.type, 1);
    Assert.equal(Flat[Force.end - 1], 1);
    Assert.deepEqual(Template.subarray(8, 12), Flat.subarray(8, 12));
    const Kept = Tags.find((tag) => tag.name === "keep")!;
    Assert.equal(Kept.value, "abc");
    Assert.deepEqual(Flat.subarray(Kept.start, Kept.end), Keep);
    Assert.deepEqual(galleryLevel(Flat), Flat);
});

test("client fixture waits through thrown and unavailable chunk reads before initializing once", () =>
{
    const Pending: Array<() => void> = [];
    let attempts = 0;
    let ready = 0;
    waitForLoadedRegion({
        probe: () =>
        {
            attempts++;
            if (attempts === 1)
            {
                throw new Error("LocationInUnloadedChunkError");
            }

            return attempts >= 4;
        },
        schedule: (callback, ticks) =>
        {
            Assert.equal(ticks, 5);
            Pending.push(callback);
        },
        ready: () => { ready++; },
        failed: Assert.fail
    });
    Assert.equal(ready, 0);
    while (Pending.length)
    {
        Pending.shift()!();
    }

    Assert.equal(attempts, 4);
    Assert.equal(ready, 1);
});

test("client fixture reports a bounded readiness failure instead of spawning in unloaded chunks", () =>
{
    const Pending: Array<() => void> = [];
    const Failures: Array<string> = [];
    let attempts = 0;
    waitForLoadedRegion({
        probe: () =>
        {
            attempts++;
            return false;
        },
        schedule: (callback) => { Pending.push(callback); },
        ready: () => Assert.fail("must not initialize unloaded scene"),
        failed: (message) => { Failures.push(message); }
    });
    while (Pending.length)
    {
        Pending.shift()!();
    }

    Assert.equal(attempts, 120);
    Assert.equal(Failures.length, 1);
    Assert.match(Failures[0], /120 probes/u);
});

test("client fixture texture has valid PNG chunks and a complete 16-pixel RGBA stream", () =>
{
    Assert.equal(FixtureTexture.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    let offset = 8;
    const Compressed: Array<Buffer> = [];
    while (offset < FixtureTexture.length)
    {
        const Length = FixtureTexture.readUInt32BE(offset);
        const Kind = FixtureTexture.subarray(offset + 4, offset + 8).toString("ascii");
        const Payload = FixtureTexture.subarray(offset + 8, offset + 8 + Length);
        Assert.equal(crc32(FixtureTexture.subarray(offset + 4, offset + 8 + Length)), FixtureTexture.readUInt32BE(offset + 8 + Length));
        if (Kind === "IHDR")
        {
            Assert.equal(Payload.readUInt32BE(0), 16);
            Assert.equal(Payload.readUInt32BE(4), 16);
            Assert.equal(Payload[9], 6);
        }

        if (Kind === "IDAT")
        {Compressed.push(Payload);}

        offset += 12 + Length;
    }

    Assert.equal(offset, FixtureTexture.length);
    Assert.equal(inflateSync(Buffer.concat(Compressed)).length, 16 * (16 * 4 + 1));
});
test("benchmark source counts, concave cells and enclosed cavity volumes are measured from real compilation", async () =>
{
    const Root = await Fs.mkdtemp(Path.join(tmpdir(), "bedform-acceptance-"));
    try
    {
        const Result = await createFixtures(Root, Path.join(Root, "bp"), Path.join(Root, "rp"));
        const Complex = Result.compilation.models.find((model) => model.name === "complex")!;
        Assert.equal(Result.complexAuthoredCubes, 32);
        Assert.equal(Complex.sourceGeometry.length, 32);
        Assert.equal(Complex.sourceCells.length, 32);
        Assert.ok(Math.abs(Complex.physical.volume - 0.5) < 1e-10);
        const Expected = new Map([ [ "mesh_cube", 1 / 64 ], [ "mesh_concave", 3 / 64 ], [ "mesh_cavity", 7 / 8 ], [ "mesh_disconnected", 2 / 64 ] ]);
        for (const Mesh of Result.meshes)
        {
            Assert.ok(Math.abs(Mesh.volume - Expected.get(Mesh.name)!) < 1e-10);
            Assert.ok(Mesh.triangles > 0 && Mesh.cells > 0);
            Assert.ok([ Mesh.validationMs, Mesh.decompositionMs, Mesh.compileMs ].every((time) => Number.isFinite(time) && time >= 0));
            const Model = Result.compilation.models.find((model) => model.name === Mesh.name)!;
            Assert.equal(Model.sourceCells.length, Mesh.cells);
        }
    }
    finally
    {
        Assert.equal(Path.dirname(Path.resolve(Root)), Path.resolve(tmpdir()));
        Assert.ok(Path.basename(Root).startsWith("bedform-acceptance-"));
        await Fs.rm(Root, { recursive: true,
            force: true });
    }
});
