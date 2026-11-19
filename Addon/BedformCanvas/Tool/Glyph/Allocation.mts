/**
 * Gapless PUA allocation of the Canvas custom glyph catalogue from U+E200, ported from the demo's
 * LegacyComputing, MinecraftTen and Octant slot modules: legacy computing stand-ins, sextant extras
 * and octant completers, their wide copies, Minecraft Ten, wide octants, Braille dots and the
 * invisible Mojangles switch cell.
 *
 * @module bedform-canvas/Tool/Glyph/Allocation
 *
 * @file      Allocation.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Inclusive Unicode block range.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Block
{
    readonly First: number;
    readonly Last: number;
    readonly Name: string;
}

/**
 * Symbols for Legacy Computing and its supplement.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LegacyComputingBlocks: ReadonlyArray<Block> = Object.freeze([
    Object.freeze({ First: 0x1_FB_00,
        Last: 0x1_FB_FF,
        Name: "Symbols for Legacy Computing" }),
    Object.freeze({ First: 0x1_CC_00,
        Last: 0x1_CE_BF,
        Name: "Symbols for Legacy Computing Supplement" })
]);

/**
 * Inclusive integer range.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Span(first: number, last: number): Array<number>
{
    return Array.from({ length: last - first + 1 }, (_: unknown, index: number) => first + index);
}

/**
 * Unassigned code points of both blocks.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LegacyComputingReserved: ReadonlyArray<number> = Object.freeze([
    0x1_FB_93, 0x1_FB_FB, 0x1_FB_FC, 0x1_FB_FD, 0x1_FB_FE, 0x1_FB_FF,
    0x1_CC_FD, 0x1_CC_FE, 0x1_CC_FF, 0x1_CE_B4, 0x1_CE_B5, 0x1_CE_B6, 0x1_CE_B7, 0x1_CE_B8, 0x1_CE_B9
]);

/**
 * Assigned supplement characters the demo deliberately leaves without a stand-in.
 *
 * @category Constant
 * @since 1.0.0
 */
export const LegacyComputingDropped: ReadonlyArray<number> = Object.freeze([
    ...Span(0x1_CC_4C, 0x1_CC_55),
    ...Span(0x1_CC_5A, 0x1_CC_5F),
    ...Span(0x1_CC_97, 0x1_CC_9C),
    ...Span(0x1_CC_9E, 0x1_CC_9F),
    ...Span(0x1_CC_D6, 0x1_CC_F9),
    0x1_CD_F6, 0x1_CD_F7
]);

const Excluded = new Set([ ...LegacyComputingReserved, ...LegacyComputingDropped ]);

/**
 * Whether a code point has a legacy computing stand-in.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function IsLegacyComputing(codePoint: number): boolean
{
    return LegacyComputingBlocks.some((block: Block) =>
        codePoint >= block.First && codePoint <= block.Last) &&
        !Excluded.has(codePoint);
}

/**
 * First allocated PUA code point, the first one the vanilla font leaves free.
 *
 * @category Constant
 * @since 1.0.0
 */
export const GlyphBase = 0xE2_00;

/**
 * Number of octant patterns missing from the supplement, drawn as completers.
 *
 * @category Constant
 * @since 1.0.0
 */
export const OctantCompleterCount = 26;

/**
 * Names of the extra sextant-completing cells, which Unicode encodes as Block Elements.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ExtraNames = Object.freeze([ "Full", "LeftHalf", "RightHalf", "Blank" ] as const);

/**
 * One extra sextant-completing cell name.
 *
 * @category Model
 * @since 1.0.0
 */
export type ExtraName = typeof ExtraNames[number];

/**
 * The complete slot layout. Wide copies of every cell glyph follow the narrow ones at WideOffset.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Layout
{
    readonly Legacy: ReadonlyMap<number, number>;
    readonly Extras: Readonly<Record<ExtraName, number>>;
    readonly OctantCompleterBase: number;
    readonly CellGlyphCount: number;
    readonly WideOffset: number;
    readonly TenBase: number;
    readonly TenCount: number;
    readonly OctantBase: number;
    readonly BrailleBase: number;
    readonly Switch: number;
    readonly End: number;
}

/**
 * Minecraft Ten's printable ASCII without lowercase letters, which draw with capital outlines.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function IsTenCharacter(codePoint: number): boolean
{
    return codePoint >= 0x20 && codePoint <= 0x7E && !(codePoint >= 0x61 && codePoint <= 0x7A);
}

/**
 * Computes the demo-compatible layout. The switch cell takes the first slot after the Braille dots,
 * which no demo mapping uses; every slot through it is consecutive.
 *
 * @category Constructor
 * @since 1.0.0
 */
export function Allocate(): Layout
{
    const legacy = new Map<number, number>();
    let next = GlyphBase;
    const assigned = (block: Block): Array<number> => Span(block.First, block.Last).filter(IsLegacyComputing);
    for (const codePoint of assigned(LegacyComputingBlocks[0]))
    {
        legacy.set(codePoint, next++);
    }

    const extra = next;
    next += ExtraNames.length;
    for (const codePoint of assigned(LegacyComputingBlocks[1]))
    {
        legacy.set(codePoint, next++);
    }

    const completer = next;
    const cellGlyphCount = completer + OctantCompleterCount - GlyphBase;
    const tenBase = GlyphBase + 2 * cellGlyphCount;
    const tenCount = 0x7F - 0x20 - 26;
    const octantBase = tenBase + tenCount;
    const brailleBase = octantBase + 256;
    const switchCell = brailleBase + 256;
    return Object.freeze({ BrailleBase: brailleBase,
        CellGlyphCount: cellGlyphCount,
        End: switchCell + 1,
        Extras: Object.freeze({ Blank: extra + 3,
            Full: extra,
            LeftHalf: extra + 1,
            RightHalf: extra + 2 }),
        Legacy: legacy,
        OctantBase: octantBase,
        OctantCompleterBase: completer,
        Switch: switchCell,
        TenBase: tenBase,
        TenCount: tenCount,
        WideOffset: cellGlyphCount });
}

/**
 * Minecraft Ten stand-in of a printable ASCII character.
 *
 * @category Lookup
 * @since 1.0.0
 */
export function TenGlyph(layout: Layout, codePoint: number): number
{
    const beforeLowercase = 0x61 - 0x20;
    return layout.TenBase + (codePoint < 0x61 ? codePoint - 0x20 : codePoint - 0x7B + beforeLowercase);
}
