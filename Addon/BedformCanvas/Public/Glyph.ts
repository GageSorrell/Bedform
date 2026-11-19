/**
 * Inert public contract for Canvas custom glyphs: catalogue lookup by PUA code or source identity,
 * particle page identities and Molang variable keys, and the arbitrary RGB/RGBA tint contract for
 * white particle textures, re-exported from bedform/Canvas/Surface. Importing this module registers
 * nothing and touches no native API.
 *
 * @module bedform-canvas/Public/Glyph
 *
 * @file      Glyph.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { OrientedSuffix, ParticleVariable, type Rgba, Tint, type TintInput } from "bedform/Canvas/Surface";
import { GlyphData } from "./Glyph.generated.js";

/**
 * The shared surface particle contract: Molang variable keys, oriented suffix and tint.
 *
 * @category Constant
 * @since 1.0.0
 */
export { DefaultTint, OrientedSuffix, ParticleVariable, Tint } from "bedform/Canvas/Surface";

/**
 * Shared tint types.
 *
 * @category Model
 * @since 1.0.0
 */
export type { Rgba, TintInput } from "bedform/Canvas/Surface";

/**
 * Catalogue kinds. Wide kinds are the seamless 8-column copies with a 16-texel advance.
 *
 * @category Constant
 * @since 1.0.0
 */
export const GlyphKind = Object.freeze({
    B: "Braille",
    C: "Completer",
    D: "CompleterWide",
    N: "Legacy",
    O: "Octant",
    S: "Switch",
    T: "Ten",
    W: "LegacyWide",
    X: "Extra",
    Y: "ExtraWide"
} as const);

/**
 * One catalogue kind name.
 *
 * @category Model
 * @since 1.0.0
 */
export type Kind = typeof GlyphKind[keyof typeof GlyphKind];

/**
 * Prefix of Canvas glyph particle identifiers; append the lowercase page, such as e2.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ParticlePrefix = "bedform_canvas:glyph_" as const;

/**
 * One cataloged glyph. Advance and Extent are in page texels. Hidden lists the columns of invisible
 * alpha-1 width helpers on the cell's last row: they exist only in TextPrimitive font pages, never as
 * particle ink. Visible is false for glyphs without particle ink, such as the switch or blank cells.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Entry
{
    readonly Code: number;
    readonly Kind: Kind;
    readonly Source: number;
    readonly Advance: number;
    readonly Hidden: ReadonlyArray<number>;
    readonly Visible: boolean;
    readonly Page: string;
    readonly U: number;
    readonly V: number;
}

/**
 * Catalogue provenance and allocation bounds.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Catalogue = Object.freeze({
    BrailleBase: GlyphData.BrailleBase,
    Client: GlyphData.Client,
    End: GlyphData.End,
    First: GlyphData.First,
    OctantBase: GlyphData.OctantBase,
    Pages: GlyphData.Pages,
    Switch: GlyphData.Switch,
    TenBase: GlyphData.TenBase,
    UnicodeVersion: GlyphData.UnicodeVersion,
    Unifont: GlyphData.Unifont,
    WideOffset: GlyphData.WideOffset
});

/**
 * Looks up an allocated PUA code; reserved or unallocated codes return undefined.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function Lookup(code: number): Entry | undefined
{
    if (!Number.isSafeInteger(code) || code < GlyphData.First || code >= GlyphData.End)
    {
        return undefined;
    }

    const index = code - GlyphData.First;
    const mask = GlyphData.Hidden[index];
    return Object.freeze({ Advance: GlyphData.Advances.charCodeAt(index) - 48,
        Code: code,
        Hidden: Object.freeze(Array.from({ length: 16 }, (_: unknown, column: number) => column)
            .filter((column: number) => (mask & 1 << column) !== 0)),
        Kind: GlyphKind[GlyphData.Kinds[index] as keyof typeof GlyphKind],
        Page: (code >> 8).toString(16).toUpperCase(),
        Source: GlyphData.Sources[index],
        U: (code & 15) * 16,
        V: ((code & 255) >> 4) * 16,
        Visible: GlyphData.Visible[index] === "1" });
}

let LegacyIndex: Map<number, number> | undefined;

/**
 * Narrow stand-in of a Symbols for Legacy Computing (or supplement) code point; reserved, unassigned
 * and deliberately dropped characters return undefined. Add Catalogue.WideOffset for the wide copy.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function LegacyGlyph(codePoint: number): number | undefined
{
    if (!LegacyIndex)
    {
        LegacyIndex = new Map();
        for (let index = 0; index < GlyphData.Kinds.length; index++)
        {
            if (GlyphData.Kinds[index] === "N")
            {
                LegacyIndex.set(GlyphData.Sources[index], GlyphData.First + index);
            }
        }
    }

    return LegacyIndex.get(codePoint);
}

/**
 * Converts every legacy computing character with a stand-in to it; other text is unchanged. This is
 * an opt-in helper: stand-ins use baked dark gray ink at large-pixel size.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function ToLegacyGlyphs(text: string): string
{
    let result = "";
    for (const character of text)
    {
        const standIn = LegacyGlyph(character.codePointAt(0)!);
        result += standIn === undefined ? character : String.fromCodePoint(standIn);
    }

    return result;
}

/**
 * Minecraft Ten stand-in of printable ASCII without lowercase letters, or undefined.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function TenGlyph(codePoint: number): number | undefined
{
    if (codePoint < 0x20 || codePoint > 0x7E || codePoint >= 0x61 && codePoint <= 0x7A)
    {
        return undefined;
    }

    return GlyphData.TenBase + (codePoint < 0x61 ? codePoint - 0x20 : codePoint - 0x7B + 0x61 - 0x20);
}

/**
 * Pattern-indexed glyphs: the wide octant (bit 2 * row + column), the narrow region octant reusing
 * supplement stand-ins, or the narrow row-major Braille dot pattern.
 *
 * @throws { RangeError } If the pattern is not an integer from 0 to 255.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function PatternGlyph(family: "Octant" | "RegionOctant" | "Braille", pattern: number): number
{
    if (!Number.isInteger(pattern) || pattern < 0 || pattern > 255)
    {
        throw new RangeError("Glyph patterns are integers from 0 to 255.");
    }

    return family === "Octant" ? GlyphData.OctantBase + pattern
        : family === "Braille" ? GlyphData.BrailleBase + pattern : GlyphData.RegionOctants[pattern];
}

/**
 * Pure spawn description for one glyph particle; apply Floats with setFloat, Colors with setColorRGBA
 * and Vectors with setVector3, then spawn Particle.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ParticleSpawn
{
    readonly Particle: string;
    readonly Floats: Readonly<Record<string, number>>;
    readonly Colors: Readonly<Record<string, Rgba>>;
    readonly Vectors: Readonly<Record<string, Readonly<{ x: number;
        y: number;
        z: number }>>>;
}

/**
 * Describes one glyph particle: its page particle, cell UVs (Width texels wide, defaulting to the
 * glyph's extent, Advance minus 1, where helper columns are transparent), half-size in blocks and
 * tint. A Direction selects the oriented particle.
 *
 * @throws { RangeError } If the code is unallocated or has no visible particle ink.
 * @throws { TypeError } If the tint or size is invalid.
 *
 * @category Tint
 * @since 1.0.0
 */
export function ParticleSpawnOf(code: number, options: { readonly Tint?: TintInput;
    readonly SizeX: number;
    readonly SizeY: number;
    readonly Width?: number;
    readonly Direction?: Readonly<{ x: number;
        y: number;
        z: number }> }): ParticleSpawn
{
    const entry = Lookup(code);
    if (!entry || !entry.Visible)
    {
        throw new RangeError(`U+${code.toString(16).toUpperCase()} has no visible Canvas particle glyph.`);
    }

    for (const size of [ options.SizeX, options.SizeY, options.Width ?? 1 ])
    {
        if (!Number.isFinite(size) || size <= 0)
        {
            throw new TypeError("Glyph particle sizes must be positive finite numbers.");
        }
    }

    const page = entry.Page.toLowerCase();
    return Object.freeze({ Colors: Object.freeze({ [ParticleVariable.Color]: Tint(options.Tint) }),
        Floats: Object.freeze({ [ParticleVariable.Height]: 16,
            [ParticleVariable.SizeX]: options.SizeX,
            [ParticleVariable.SizeY]: options.SizeY,
            [ParticleVariable.U]: entry.U,
            [ParticleVariable.V]: entry.V,
            [ParticleVariable.Width]: options.Width ?? entry.Advance - 1 }),
        Particle: ParticlePrefix + page + (options.Direction ? OrientedSuffix : ""),
        Vectors: Object.freeze(options.Direction
            ? { [ParticleVariable.Direction]: Object.freeze({ ...options.Direction }) }
            : {}) as ParticleSpawn["Vectors"] });
}
