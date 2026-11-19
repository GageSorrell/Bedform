/**
 * Minimal lossless RGBA PNG encoding for generated pack artwork.
 *
 * @module bedform-common/Tool/Png
 *
 * @file      Png.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { zlibSync } from "fflate";

/**
 * Encodes a PNG chunk with its required IEEE CRC checksum.
 *
 * @category Encoding
 * @since 1.1.2
 */
function Chunk(type: string, data: Uint8Array): Buffer
{
    const body = Buffer.concat([ Buffer.from(type), data ]);
    let crc = 0xFFFFFFFF;
    for (const byte of body)
    {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++)
        {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
    }

    const chunk = Buffer.alloc(body.length + 8);
    chunk.writeUInt32BE(data.length);
    body.copy(chunk, 4);
    chunk.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, body.length + 4);
    return chunk;
}

/**
 * Encodes row-major, 8-bit RGBA pixels as a PNG with one maximally
 * compressed IDAT chunk and unfiltered scanlines.
 *
 * @throws { RangeError } If the pixel buffer's length is not width × height × 4.
 *
 * @category Encoding
 * @since 1.1.3
 */
export function EncodePng(width: number, height: number, rgba: Uint8Array): Buffer
{
    if (rgba.length !== width * height * 4)
    {
        throw new RangeError(`Expected ${width * height * 4} RGBA bytes, received ${rgba.length}.`);
    }

    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8;
    header[9] = 6;
    const scanlines = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++)
    {
        scanlines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
    }

    return Buffer.concat([ Buffer.from([ 137, 80, 78, 71, 13, 10, 26, 10 ]), Chunk("IHDR", header),
        Chunk("IDAT", zlibSync(scanlines, { level: 9 })), Chunk("IEND", new Uint8Array()) ]);
}
