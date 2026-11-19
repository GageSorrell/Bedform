/**
 * Verifies the packaged transactional icons' size, hard alpha, glyph and
 * shadow colours, and the component's en_US translations.
 *
 * @module bedform-common/Test/TransactionalIcons.test
 *
 * @file      TransactionalIcons.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { GlyphSize, IconColor, IconGlyph, IconScale, IconSize, ShadowColor, type TransactionalIconName,
    TransactionalIconPng } from "../Tool/TransactionalIcons.mts";
import { TransactionalIcon, TransactionalText } from
    "../../../Package/Bedform/Source/Internal/TransactionalAssets.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { unzipSync, unzlibSync } from "fflate";
import { Build } from "../Tool/Build.mts";
import { EncodePng } from "../Tool/Png.mts";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";

/**
 * A decoded 8-bit RGBA image.
 *
 * @category Testing
 * @since 1.1.3
 */
interface Image
{
    readonly Height: number;
    readonly Pixels: Uint8Array;
    readonly Width: number;
}

/**
 * Decodes the unfiltered RGBA PNGs that `EncodePng` writes.
 *
 * @throws { Error } If the PNG uses another format or a scanline filter.
 *
 * @category Testing
 * @since 1.1.3
 */
function DecodePng(png: Uint8Array): Image
{
    const bytes = Buffer.from(png);
    assert.deepEqual([ ...bytes.subarray(0, 8) ], [ 137, 80, 78, 71, 13, 10, 26, 10 ]);
    let offset = 8;
    let width = 0;
    let height = 0;
    const data: Array<Buffer> = [];
    while (offset < bytes.length)
    {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString("latin1", offset + 4, offset + 8);
        const body = bytes.subarray(offset + 8, offset + 8 + length);
        if (type === "IHDR")
        {
            width = body.readUInt32BE(0);
            height = body.readUInt32BE(4);
            assert.deepEqual([ body[8], body[9] ], [ 8, 6 ]);
        }
        else if (type === "IDAT")
        {
            data.push(body);
        }

        offset += length + 12;
    }

    const scanlines = unzlibSync(Buffer.concat(data));
    const pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
    {
        const start = y * (width * 4 + 1);
        if (scanlines[start] !== 0)
        {
            throw new Error(`Unexpected filter on row ${y}.`);
        }

        pixels.set(scanlines.subarray(start + 1, start + 1 + width * 4), y * width * 4);
    }

    return { Height: height,
        Pixels: pixels,
        Width: width };
}

/**
 * The RGBA value at a pixel.
 *
 * @category Testing
 * @since 1.1.3
 */
function At(image: Image, x: number, y: number): Array<number>
{
    const index = (y * image.Width + x) * 4;
    return [ ...image.Pixels.subarray(index, index + 4) ];
}

test("PNG encoding round-trips pixels and rejects mismatched buffers", () =>
{
    const pixels = Uint8Array.from([ 1, 2, 3, 255, 0, 0, 0, 0, 9, 8, 7, 6, 255, 255, 255, 255 ]);
    const image = DecodePng(EncodePng(2, 2, pixels));
    assert.deepEqual([ image.Width, image.Height ], [ 2, 2 ]);
    assert.deepEqual(image.Pixels, pixels);
    assert.throws(() => EncodePng(2, 2, new Uint8Array(15)), RangeError);
});

test("each glyph and its quarter-colour shadow are drawn at eight times scale", () =>
{
    assert.equal(IconSize, 64);
    assert.deepEqual(ShadowColor([ 255, 255, 255 ]), [ 63, 63, 63 ]);
    assert.deepEqual(ShadowColor([ 85, 255, 85 ]), [ 21, 63, 21 ]);
    for (const name of Object.keys(TransactionalIcon) as Array<TransactionalIconName>)
    {
        const image = DecodePng(TransactionalIconPng(name));
        const glyph = IconGlyph[name];
        assert.equal(glyph.length, GlyphSize);
        assert.ok(glyph.every((row: string) => row.length === GlyphSize), name);
        const ink = (x: number, y: number): boolean =>
            x >= 0 && y >= 0 && x < GlyphSize && y < GlyphSize && glyph[y][x] === "#";
        for (let y = 0; y < IconSize; y++)
        {
            for (let x = 0; x < IconSize; x++)
            {
                const gx = Math.floor(x / IconScale);
                const gy = Math.floor(y / IconScale);
                const expected = ink(gx, gy) ? [ ...IconColor[name], 255 ]
                    : ink(gx - 1, gy - 1) ? [ ...ShadowColor(IconColor[name]), 255 ] : [ 0, 0, 0, 0 ];
                assert.deepEqual(At(image, x, y), expected, `${name} (${x}, ${y})`);
            }
        }
    }

    assert.deepEqual(IconColor.Confirm, [ 85, 255, 85 ]);
});

test("the common archive packages every icon and translation", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-common-icons-"));
    try
    {
        const addon = unzipSync(await readFile(await Build(directory)));
        const resource = unzipSync(addon["bedform-common-rp.mcpack"]);
        const names = Object.keys(TransactionalIcon) as Array<TransactionalIconName>;
        assert.deepEqual(Object.keys(resource).filter((file: string) =>
            file.startsWith("textures/bedform/transactional/")).sort(),
        names.map((name: TransactionalIconName) => TransactionalIcon[name]).sort());
        for (const name of names)
        {
            const file = resource[TransactionalIcon[name]];
            assert.deepEqual(Buffer.from(file), TransactionalIconPng(name));
            const image = DecodePng(file);
            assert.deepEqual([ image.Width, image.Height ], [ 64, 64 ]);
            const alpha = new Set<number>();
            for (let index = 3; index < image.Pixels.length; index += 4)
            {
                alpha.add(image.Pixels[index]);
            }

            assert.deepEqual([ ...alpha ].sort((left: number, right: number) => left - right), [ 0, 255 ]);
        }

        const lang = Buffer.from(resource["texts/en_US.lang"]).toString().split("\n");
        for (const text of Object.values(TransactionalText))
        {
            assert.equal(lang.filter((line: string) => line.startsWith(`${text.Key}=`)).length, 1, text.Key);
            assert.ok(lang.includes(`${text.Key}=${text.English}`), text.Key);
        }
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});
