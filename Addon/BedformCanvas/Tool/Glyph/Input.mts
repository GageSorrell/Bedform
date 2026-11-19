/**
 * Checked-in glyph generation inputs: Unicode names, the vanilla shade cell, rasterized Minecraft Ten
 * cells and the Unifont supplement subset. Ordinary generation reads only these files.
 *
 * @module bedform-canvas/Tool/Glyph/Input
 *
 * @file      Input.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

/**
 * Directory holding the captured inputs, relative to the workspace root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const InputDirectory = "Assets/Glyph/Input";

/**
 * File names of the captured inputs inside InputDirectory.
 *
 * @category Constant
 * @since 1.0.0
 */
export const InputFile = Object.freeze({
    License: "OFL-1.1.txt",
    MinecraftTen: "minecraft-ten.json",
    Shade: "vanilla-shade.json",
    UnicodeNames: "unicode-names.json",
    Unifont: "unifont.json",
    UnifontHex: "unifont-supplement.hex"
} as const);

/**
 * A 16-row cell as text art: `#` is ink, `.` is empty.
 *
 * @category Model
 * @since 1.0.0
 */
export type ArtRows = ReadonlyArray<string>;

/**
 * Provenance of a capture from the installed client.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ClientSource
{
    readonly Client: string;
    readonly File: string;
}

/**
 * Unicode character names for the assigned characters of both legacy computing blocks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface UnicodeNames
{
    readonly UnicodeVersion: string;
    readonly Source: string;
    readonly Names: Readonly<Record<string, string>>;
}

/**
 * The vanilla Unicode font's U+2592 medium shade cell, sampled for the legacy shades.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Shade extends ClientSource
{
    readonly Rows: ArtRows;
}

/**
 * Minecraft Ten printable ASCII rasterized at one texel per font pixel, keyed by hexadecimal code.
 * Clipped lists ink that fell outside the 16 by 16 cell.
 *
 * @category Model
 * @since 1.0.0
 */
export interface MinecraftTen extends ClientSource
{
    readonly Cells: Readonly<Record<string, ArtRows>>;
    readonly Clipped: ReadonlyArray<string>;
}

/**
 * Unifont version and copyright notice for the derived supplement glyphs.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Unifont
{
    readonly Version: string;
    readonly Notice: string;
    readonly Source: string;
}

/**
 * Every captured input, parsed.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Inputs
{
    readonly Names: UnicodeNames;
    readonly Shade: Shade;
    readonly Ten: MinecraftTen;
    readonly Unifont: Unifont;
    readonly UnifontGlyphs: ReadonlyMap<number, ReadonlyArray<ReadonlyArray<boolean>>>;
    readonly UnifontLicense: string;
}

/**
 * The workspace root of bedform-canvas.
 *
 * @category Constant
 * @since 1.0.0
 */
export const WorkspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Parses Unifont .hex lines into rows of booleans, 8 or 16 columns wide.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function ParseHex(text: string): Map<number, ReadonlyArray<ReadonlyArray<boolean>>>
{
    const glyphs = new Map<number, ReadonlyArray<ReadonlyArray<boolean>>>();
    for (const line of text.split(/\r?\n/u))
    {
        if (!line)
        {
            continue;
        }

        const [ code, bits ] = line.split(":");
        const width = bits.length / 4;
        glyphs.set(parseInt(code, 16), Array.from({ length: 16 }, (_: unknown, row: number) =>
        {
            const value = parseInt(bits.slice(row * width / 4, (row + 1) * width / 4), 16);
            return Array.from({ length: width }, (_column: unknown, x: number) =>
                (value >> (width - 1 - x) & 1) === 1);
        }));
    }

    return glyphs;
}

/**
 * Reads every captured input from a workspace snapshot.
 *
 * @throws { Error } If an input is missing or malformed.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function ReadInputs(root: string = WorkspaceRoot): Inputs
{
    const read = (name: string): string => readFileSync(path.join(root, InputDirectory, name), "utf8");
    return { Names: JSON.parse(read(InputFile.UnicodeNames)) as UnicodeNames,
        Shade: JSON.parse(read(InputFile.Shade)) as Shade,
        Ten: JSON.parse(read(InputFile.MinecraftTen)) as MinecraftTen,
        Unifont: JSON.parse(read(InputFile.Unifont)) as Unifont,
        UnifontGlyphs: ParseHex(read(InputFile.UnifontHex)),
        UnifontLicense: read(InputFile.License) };
}
