/**
 * Minecraft Ten, the game's heading font, as custom glyphs: the printable
 * ASCII characters other than the lowercase letters (Minecraft Ten draws
 * those with its capitals' outlines), each with a Private Use Area stand-in,
 * drawn pixel for pixel from the font by Tool/MinecraftTen.mjs. The 69
 * stand-ins follow the cell glyphs' wide copies with no gaps, in code order
 * with the lowercase letters skipped (since 1.1.79). Each glyph's
 * advance is its ink width plus 1 pixel, by the client's rule; the space,
 * which has no ink, is 3 pixels wide by two pixels at alpha 1.
 *
 * @module @sorrell/ddui-image-demo/Source/MinecraftTen
 *
 * @file      MinecraftTen.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { CellGlyphEnd } from "./LegacyComputing.js";
import { MinecraftTenAdvances } from "./MinecraftTenWidths.js";

/**
 * The first code point of the Minecraft Ten stand-ins: right after the cell
 * glyphs' wide copies.
 *
 * @category Constant
 * @since 1.1.64
 */
export const MinecraftTenBase = CellGlyphEnd;

/** The characters before the lowercase letters, U+0020 to U+0060, which take the first slots. */
const BeforeLowercase = 0x61 - 0x20;

/**
 * How many characters have a Minecraft Ten stand-in: printable ASCII less the
 * 26 lowercase letters.
 *
 * @category Constant
 * @since 1.1.79
 */
export const MinecraftTenCount = 0x7f - 0x20 - 26;

/**
 * Whether a character has a Minecraft Ten stand-in: printable ASCII, U+0020
 * to U+007E, except the lowercase letters.
 *
 * @category Formatting
 * @since 1.1.64
 */
export function IsTenCharacter(CodePoint)
{
    return CodePoint >= 0x20 && CodePoint <= 0x7e && !(CodePoint >= 0x61 && CodePoint <= 0x7a);
}

/**
 * The stand-in of a character with one: its place among them, in code order
 * with the lowercase letters skipped, after `MinecraftTenBase`.
 *
 * @category Formatting
 * @since 1.1.79
 */
export function MinecraftTenGlyph(CodePoint)
{
    return MinecraftTenBase + (CodePoint < 0x61 ? CodePoint - 0x20 : CodePoint - 0x7b + BeforeLowercase);
}

/**
 * The character a Minecraft Ten stand-in stands for, or undefined for any
 * other code point.
 *
 * @category Formatting
 * @since 1.1.79
 */
export function MinecraftTenCharacter(StandIn)
{
    const Index = StandIn - MinecraftTenBase;
    if (Index < 0 || Index >= MinecraftTenCount) return undefined;
    return Index < BeforeLowercase ? Index + 0x20 : Index - BeforeLowercase + 0x7b;
}

/**
 * Replaces every character with a Minecraft Ten stand-in by that stand-in,
 * leaving the others, lowercase letters included, as they are.
 *
 * @category Formatting
 * @since 1.1.64
 */
export function ToMinecraftTen(Text)
{
    return [ ...String(Text) ].map((Character) =>
    {
        const CodePoint = Character.codePointAt(0);
        return IsTenCharacter(CodePoint) ? String.fromCodePoint(MinecraftTenGlyph(CodePoint)) : Character;
    }).join("");
}

/**
 * The width, in the glyphs' own pixels, of a line of Minecraft Ten stand-ins:
 * the sum of their advances.
 *
 * @throws { Error } When the line holds another character.
 *
 * @category Formatting
 * @since 1.1.64
 */
export function MinecraftTenWidth(Line)
{
    let Width = 0;
    for (const Character of String(Line))
    {
        const Code = MinecraftTenCharacter(Character.codePointAt(0));
        if (Code === undefined) throw new Error(`${JSON.stringify(Character)} is not a Minecraft Ten stand-in.`);
        Width += MinecraftTenAdvances.charCodeAt(Code - 0x20) - 48;
    }

    return Width;
}
