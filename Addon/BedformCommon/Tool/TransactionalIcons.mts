/**
 * Rasterizes the transactional component's undo, redo, cancel, confirm and
 * trash-can icons as Mojangles-scale pixel glyphs with a font-style drop shadow.
 *
 * @module bedform-common/Tool/TransactionalIcons
 *
 * @file      TransactionalIcons.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { mkdir, writeFile } from "node:fs/promises";
import { EncodePng } from "./Png.mjs";
import { TransactionalIcon } from "../../../Package/Bedform/Source/Internal/TransactionalAssets.js";
import path from "node:path";

/**
 * Names of the generated icons, matching the members of `TransactionalIcon`.
 *
 * @category Types
 * @since 1.1.3
 */
export type TransactionalIconName = keyof typeof TransactionalIcon;

/**
 * Width and height of a glyph, in glyph pixels. The shadow extends the cell by one.
 *
 * @category Constant
 * @since 1.1.3
 */
export const GlyphSize = 7;

/**
 * Output pixels per glyph pixel; the 8 by 8 cell becomes a 64 by 64 texture.
 *
 * @category Constant
 * @since 1.1.3
 */
export const IconScale = 8;

/**
 * Width and height of each generated texture, in pixels.
 *
 * @category Constant
 * @since 1.1.3
 */
export const IconSize = (GlyphSize + 1) * IconScale;

/**
 * Glyph colours: Minecraft's white text colour, and its green (`§a`) for confirm.
 *
 * @category Constant
 * @since 1.1.3
 */
export const IconColor: Readonly<Record<TransactionalIconName, readonly [ number, number, number ]>> =
    Object.freeze({
        Cancel: [ 255, 255, 255 ],
        Confirm: [ 85, 255, 85 ],
        Redo: [ 255, 255, 255 ],
        Reset: [ 255, 255, 255 ],
        Undo: [ 255, 255, 255 ]
    });

/**
 * Glyph bitmaps, top row first, with `#` for an inked pixel.
 *
 * @category Constant
 * @since 1.1.3
 */
export const IconGlyph: Readonly<Record<TransactionalIconName, ReadonlyArray<string>>> = Object.freeze({
    Cancel: [
        ".......",
        ".#...#.",
        "..#.#..",
        "...#...",
        "..#.#..",
        ".#...#.",
        "......."
    ],
    Confirm: [
        ".......",
        "......#",
        ".....#.",
        "#...#..",
        ".#.#...",
        "..#....",
        "......."
    ],
    Redo: [
        ".......",
        ".####..",
        "#......",
        "#....#.",
        ".######",
        ".....#.",
        "......."
    ],
    Reset: [
        "..###..",
        "#######",
        ".#...#.",
        ".#.#.#.",
        ".#.#.#.",
        ".#...#.",
        ".#####."
    ],
    Undo: [
        ".......",
        "..####.",
        "......#",
        ".#....#",
        "######.",
        ".#.....",
        "......."
    ]
});

/**
 * The shadow colour of a glyph colour: each channel divided by four, as
 * Minecraft's font renderer does.
 *
 * @category Encoding
 * @since 1.1.3
 */
export function ShadowColor(color: ReadonlyArray<number>): [ number, number, number ]
{
    return [ color[0] >> 2, color[1] >> 2, color[2] >> 2 ];
}

/**
 * Draws one icon as a transparent PNG: the shadow one glyph pixel down and
 * right, the glyph over it, upscaled with nearest-neighbour sampling, so every
 * alpha value is 0 or 255.
 *
 * @category Encoding
 * @since 1.1.3
 */
export function TransactionalIconPng(name: TransactionalIconName): Buffer
{
    const pixels = new Uint8Array(IconSize * IconSize * 4);
    const glyph = IconGlyph[name];
    const color = IconColor[name];
    const cell = (x: number, y: number, ink: ReadonlyArray<number>): void =>
    {
        for (let row = y * IconScale; row < (y + 1) * IconScale; row++)
        {
            for (let column = x * IconScale; column < (x + 1) * IconScale; column++)
            {
                pixels.set([ ...ink, 255 ], (row * IconSize + column) * 4);
            }
        }
    };

    for (const [ offset, ink ] of [ [ 1, ShadowColor(color) ], [ 0, color ] ] as const)
    {
        for (let y = 0; y < GlyphSize; y++)
        {
            for (let x = 0; x < GlyphSize; x++)
            {
                if (glyph[y][x] === "#")
                {
                    cell(x + offset, y + offset, ink);
                }
            }
        }
    }

    return EncodePng(IconSize, IconSize, pixels);
}

/**
 * Writes every transactional icon beneath a resource pack root, at the paths
 * named by `TransactionalIcon`.
 *
 * @category Serialization
 * @since 1.1.3
 */
export async function GenerateTransactionalIcons(root: string): Promise<void>
{
    for (const name of Object.keys(TransactionalIcon) as Array<TransactionalIconName>)
    {
        const target = path.join(root, TransactionalIcon[name]);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, TransactionalIconPng(name));
    }
}
