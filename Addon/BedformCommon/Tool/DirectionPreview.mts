/**
 * Rasterizes compact native DDUI signed-axis previews without antialiasing.
 *
 * @module bedform-common/Tool/DirectionPreview
 *
 * @file      DirectionPreview.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DirectionAxes, DirectionPreviewPath } from
    "../../../Package/Bedform/Source/Internal/DirectionPreview.js";
import { mkdir, writeFile } from "node:fs/promises";
import { EncodePng } from "./Png.mjs";
import path from "node:path";

const Size = 96;
const Names = [ "UP", "DOWN", "NORTH", "SOUTH", "EAST", "WEST" ] as const;
const Ends = [ [ 48, 18 ], [ 48, 75 ], [ 65, 25 ], [ 31, 67 ], [ 77, 57 ], [ 19, 35 ] ] as const;
const Labels = [ [ 48, 7 ], [ 48, 86 ], [ 73, 17 ], [ 23, 76 ], [ 84, 64 ], [ 12, 26 ] ] as const;
const Colors = [ [ 100, 213, 115 ], [ 100, 213, 115 ], [ 97, 158, 244 ],
    [ 97, 158, 244 ], [ 237, 100, 100 ], [ 237, 100, 100 ] ] as const;
const Font: Readonly<Record<string, string>> = Object.freeze({
    "+": "000010111010000",
    "-": "000000111000000",
    A: "010101111101101",
    D: "110101101101110",
    E: "111100110100111",
    H: "101101111101101",
    N: "101111111111101",
    O: "111101101101111",
    P: "110101110100100",
    R: "110101110101101",
    S: "111100111001111",
    T: "111010010010010",
    U: "101101101101111",
    W: "101101111111101",
    X: "101101010101101",
    Y: "101101010010010",
    Z: "111001010100111"
});

/**
 * Draws one transparent 96 by 96 PNG using whole pixels and a tiny bitmap font.
 * X is red, Y green and Z blue; a cream outline emphasizes the selected arrow.
 *
 * @category Encoding
 * @since 1.1.2
 */
export function DirectionPreview(
    selected: number,
    mask: number,
    labels: "xyz" | "localized" | undefined,
    excluded: boolean | "dim"
): Buffer
{
    const pixels = Buffer.alloc(Size * Size * 4);
    const pixel = (x: number, y: number, color: ReadonlyArray<number>): void =>
    {
        if (x >= 0 && y >= 0 && x < Size && y < Size)
        {
            pixels.set([ ...color, 255 ], (y * Size + x) * 4);
        }
    };

    const line = (ax: number, ay: number, bx: number, by: number,
        width: number, color: ReadonlyArray<number>): void =>
    {
        const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let step = 0; step <= steps; step++)
        {
            const x = Math.round(ax + (bx - ax) * step / steps);
            const y = Math.round(ay + (by - ay) * step / steps);
            for (let dy = -width; dy <= width; dy++)
            {
                for (let dx = -width; dx <= width; dx++)
                {
                    pixel(x + dx, y + dy, color);
                }
            }
        }
    };

    const order = [ 5, 2, 0, 1, 3, 4 ].filter((index: number) => index !== selected);
    if (selected >= 0)
    {
        order.push(selected);
    }

    for (const index of order)
    {
        const allowed = (mask & (1 << index)) !== 0;
        if (!allowed && excluded === false)
        {
            continue;
        }

        const color = !allowed && excluded === "dim"
            ? Colors[index].map((value: number) => Math.round(value * 0.18 + 35)) : Colors[index];
        const [ x, y ] = Ends[index];
        const length = Math.hypot(x - 48, y - 46);
        const ux = (x - 48) / length;
        const uy = (y - 46) / length;
        const arrow = (width: number, ink: ReadonlyArray<number>): void =>
        {
            line(48, 46, x, y, width, ink);
            line(x, y, x - ux * 7 - uy * 5, y - uy * 7 + ux * 5, width, ink);
            line(x, y, x - ux * 7 + uy * 5, y - uy * 7 - ux * 5, width, ink);
        };

        arrow(index === selected ? 3 : 2, index === selected ? [ 255, 244, 191 ] : [ 26, 29, 38 ]);
        arrow(1, color);
        if (labels !== undefined)
        {
            const text = labels === "xyz" ? DirectionAxes[index] : Names[index];
            const [ cx, cy ] = Labels[index];
            for (let letter = 0; letter < text.length; letter++)
            {
                const glyph = Font[text[letter]];
                for (let bit = 0; bit < 15; bit++)
                {
                    if (glyph[bit] === "1")
                    {
                        const px = cx - Math.floor((text.length * 4 - 1) / 2) + letter * 4 + bit % 3;
                        const py = cy - 2 + Math.floor(bit / 3);
                        pixel(px + 1, py + 1, [ 26, 29, 38 ]);
                        pixel(px, py, index === selected ? [ 255, 244, 191 ] : color);
                    }
                }
            }
        }
    }

    return EncodePng(Size, Size, pixels);
}

/**
 * Emits all nonempty choice masks, label modes and valid highlights, plus neutral
 * previews. Unrestricted artwork is shared instead of repeated for every mask.
 *
 * @category Serialization
 * @since 1.1.2
 */
export async function GenerateDirectionPreviews(root: string): Promise<void>
{
    const files = new Set<string>();
    for (const labels of [ "xyz", "localized", undefined ] as const)
    {
        await mkdir(path.join(root, `textures/bedform/direction/${labels ?? "none"}`), { recursive: true });
        for (let mask = 1; mask < 64; mask++)
        {
            for (let selected = -1; selected < 6; selected++)
            {
                if (selected >= 0 && !(mask & (1 << selected)))
                {
                    continue;
                }

                for (const excluded of [ true, false, "dim" ] as const)
                {
                    const file = DirectionPreviewPath(selected, mask, labels, excluded);
                    if (!files.has(file))
                    {
                        files.add(file);
                        await writeFile(path.join(root, file),
                            DirectionPreview(selected, mask, labels, excluded));
                    }
                }
            }
        }
    }
}
