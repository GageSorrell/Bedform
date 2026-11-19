/**
 * Generates the authoritative Canvas custom glyph catalogue from checked-in inputs, ported from the
 * demo's CustomGlyph tool. One drawing pass yields dark gray #4D4D4D TextPrimitive font pages and
 * matching white #FFFFFF particle textures with identical shapes, alpha, UVs and metrics. Invisible
 * alpha-1 width helpers stay in the font pages and catalogue metadata only, never in particle ink.
 * Also writes per-page particle definitions, the shared surface rectangle particle and texture,
 * upstream notices, the typed catalogue module and, in write mode, contact sheets under
 * dist/glyph-preview.
 *
 * Usage: npm run glyph --workspace bedform-canvas (or glyph:check to verify freshness)
 *
 * @module bedform-canvas/Tool/Glyph/Generate
 *
 * @file      Generate.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Allocate, type ExtraName, ExtraNames, GlyphBase, IsTenCharacter, type Layout, OctantCompleterCount,
    TenGlyph } from "./Allocation.mts";
import { Cell, LegacyExtraCells, LegacyGlyphCells, type Pixels, WideWidth } from "./Legacy.mts";
import { type Inputs, ReadInputs, WorkspaceRoot } from "./Input.mts";
import { ParticleDefinition, SurfaceOutput, SurfaceOutputs } from "../Particle.mts";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { LegacySupplementCells } from "./Supplement.mts";
import { PNG } from "pngjs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Generated output locations, relative to the workspace root.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Output = Object.freeze({
    Catalogue: "Public/Glyph.generated.ts",
    Font: "resource_packs/bedform_canvas/font",
    Particles: "resource_packs/bedform_canvas/particles",
    Preview: "dist/glyph-preview",
    Textures: "resource_packs/bedform_canvas/textures/bedform_canvas/glyph"
} as const);

/**
 * Font ink, baked into TextPrimitive pages and used as the default particle tint.
 *
 * @category Constant
 * @since 1.0.0
 */
export const FontInk = Object.freeze([ 0x4D, 0x4D, 0x4D ] as const);

/**
 * One-letter catalogue kinds, in the order of the generated Kinds string.
 *
 * @category Constant
 * @since 1.0.0
 */
export const KindLetter = Object.freeze({
    Braille: "B",
    Completer: "C",
    CompleterWide: "D",
    Extra: "X",
    ExtraWide: "Y",
    Legacy: "N",
    LegacyWide: "W",
    Octant: "O",
    Switch: "S",
    Ten: "T"
} as const);

/**
 * One drawn glyph: visible ink and invisible width helpers, kept separate.
 *
 * @category Model
 * @since 1.0.0
 */
interface Drawn
{
    readonly Code: number;
    readonly Kind: keyof typeof KindLetter;
    readonly Source: number;
    readonly Label: string;
    readonly Ink: Array<readonly [ number, number ]>;
    readonly Hidden: Array<readonly [ number, number ]>;
}

/**
 * Complete in-memory generation result; PNG entries hold raw RGBA for pixel-level freshness checks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Generated
{
    readonly Layout: Layout;
    readonly Glyphs: ReadonlyMap<number, Drawn>;
    readonly Images: ReadonlyMap<string, Uint8Array>;
    readonly Texts: ReadonlyMap<string, string>;
    readonly RegionOctants: ReadonlyArray<number>;
    readonly TenAdvances: string;
}

const Hex = (value: number): string => value.toString(16).toUpperCase();
const PageName = (key: number): string => Hex(key).padStart(2, "0");

/**
 * The narrow and wide last ink columns: advances 8 (one cell) and 16 (two cells).
 *
 * @category Constant
 * @since 1.0.0
 */
const LastColumn = Object.freeze({ Narrow: Cell.Width - 1,
    Wide: 2 * WideWidth - 2 });

/**
 * Builds the glyph set, layout and auxiliary tables from captured inputs.
 *
 * @throws { Error } If inputs are incomplete or a glyph violates its extent contract.
 *
 * @category Tool
 * @since 1.0.0
 */
function Draw(inputs: Inputs): { Glyphs: Map<number, Drawn>;
    Layout: Layout;
    RegionOctants: Array<number>;
    TenAdvances: string;
    SupplementPages: string;
    SupplementSpan: string }
{
    const layout = Allocate();
    const name = (codePoint: number): string =>
    {
        const label = inputs.Names.Names[Hex(codePoint)];
        if (!label)
        {
            throw new Error(`Missing Unicode name for U+${Hex(codePoint)}.`);
        }

        return label;
    };

    const shade = (x: number, y: number): boolean => inputs.Shade.Rows[y][x] === "#";
    const glyphs = new Map<number, Drawn>();
    const add = (glyph: Drawn): void =>
    {
        if (glyphs.has(glyph.Code))
        {
            throw new Error(`U+${Hex(glyph.Code)} is allocated twice.`);
        }

        glyphs.set(glyph.Code, glyph);
    };

    // Narrow octant patterns, bit 2 * row + column: supplement octants first, then 26 completers.
    const regionOctants = Array<number>(256);
    for (const [ codePoint, standIn ] of layout.Legacy)
    {
        const digits = /^BLOCK OCTANT-([1-8]+)$/u.exec(inputs.Names.Names[Hex(codePoint)] ?? "")?.[1];
        if (digits)
        {
            regionOctants[[ ...digits ].reduce((value: number, digit: string) =>
                value | 1 << (Number(digit) - 1), 0)] = standIn;
        }
    }

    const missing = Array.from({ length: 256 }, (_: unknown, pattern: number) => pattern)
        .filter((pattern: number) => regionOctants[pattern] === undefined);
    if (missing.length !== OctantCompleterCount)
    {
        throw new Error(`Expected ${OctantCompleterCount} octant completers, found ${missing.length}.`);
    }

    missing.forEach((pattern: number, index: number) =>
    {
        regionOctants[pattern] = layout.OctantCompleterBase + index;
    });

    // Every cell glyph, narrow and wide, in the demo's order.
    const cells: Array<{ StandIn: number;
        Kind: "Legacy" | "Extra" | "Completer";
        Source: number;
        Label: string;
        Narrow: Pixels;
        Wide: Pixels }> = [];
    {
        const narrow = LegacyGlyphCells(shade, name);
        const wide = LegacyGlyphCells(shade, name, WideWidth);
        for (const [ codePoint, pixels ] of narrow)
        {
            cells.push({ Kind: "Legacy",
                Label: `U+${Hex(codePoint)}`,
                Narrow: pixels,
                Source: codePoint,
                StandIn: layout.Legacy.get(codePoint)!,
                Wide: wide.get(codePoint)! });
        }
    }

    const supplement = LegacySupplementCells(inputs.UnifontGlyphs, name);
    for (const [ codePoint, pixels ] of supplement.Cells)
    {
        cells.push({ Kind: "Legacy",
            Label: `U+${Hex(codePoint)}`,
            Narrow: pixels,
            Source: codePoint,
            StandIn: layout.Legacy.get(codePoint)!,
            Wide: supplement.Wide.get(codePoint)! });
    }

    {
        const narrow = LegacyExtraCells();
        const wide = LegacyExtraCells(WideWidth);
        for (const extra of [ "Full", "LeftHalf", "RightHalf", "Blank" ] as const)
        {
            cells.push({ Kind: "Extra",
                Label: extra,
                Narrow: narrow.get(extra)!,
                Source: ExtraNames.indexOf(extra),
                StandIn: layout.Extras[extra as ExtraName],
                Wide: wide.get(extra)! });
        }
    }

    for (const pattern of missing)
    {
        const rows = (width: number): Pixels => Array.from({ length: 16 }, (_: unknown, y: number) =>
            Array.from({ length: width }, (_column: unknown, x: number) =>
                Boolean(pattern & 1 << (2 * Math.floor(y / 4) + Math.floor(x / 4)))));
        cells.push({ Kind: "Completer",
            Label: `Octant ${pattern}`,
            Narrow: rows(Cell.Width),
            Source: pattern,
            StandIn: regionOctants[pattern],
            Wide: rows(WideWidth) });
    }

    for (const cell of cells)
    {
        for (const wide of [ false, true ])
        {
            const pixels = wide ? cell.Wide : cell.Narrow;
            const ink: Array<readonly [ number, number ]> = [];
            pixels.forEach((row: Array<boolean>, y: number) => row.forEach((inked: boolean, x: number) =>
            {
                if (inked)
                {
                    ink.push([ x, y ]);
                }
            }));
            const empty = cell.Kind === "Extra" && cell.Label === "Blank" ||
                cell.Kind === "Completer" && cell.Source === 0;
            if (ink.length === 0 && !empty)
            {
                throw new Error(`${cell.Label} has no ink.`);
            }

            const columns = new Set(ink.map(([ x ]: readonly [ number, number ]) => x));
            const last = wide ? LastColumn.Wide : LastColumn.Narrow;
            add({ Code: wide ? cell.StandIn + layout.WideOffset : cell.StandIn,
                Hidden: [ 0, last ].filter((x: number) => !columns.has(x))
                    .map((x: number) => [ x, Cell.Height - 1 ] as const),
                Ink: ink,
                Kind: wide ? `${cell.Kind}Wide` as const : cell.Kind,
                Label: cell.Label,
                Source: cell.Source });
        }
    }

    // Minecraft Ten in dark gray without the demo's baked button shadow. The shadow's rightmost
    // column becomes an alpha-1 helper, so every advance matches the demo's measured table.
    let tenAdvances = "";
    for (let codePoint = 0x20; codePoint <= 0x7E; codePoint++)
    {
        if (!IsTenCharacter(codePoint))
        {
            tenAdvances += "0";
            continue;
        }

        const rows = inputs.Ten.Cells[Hex(codePoint)]?.map((row: string) => [ ...row ].map((pixel: string) =>
            pixel === "#"));
        if (!rows)
        {
            throw new Error(`Minecraft Ten input lacks U+${Hex(codePoint)}.`);
        }

        const ink: Array<readonly [ number, number ]> = [];
        let right = -1;
        rows.forEach((row: Array<boolean>, y: number) => row.forEach((inked: boolean, x: number) =>
        {
            if (!inked)
            {
                return;
            }

            ink.push([ x, y ]);
            right = Math.max(right, x);
            if (y < 15 && x < 15 && !rows[y + 1][x + 1])
            {
                right = Math.max(right, x + 1);
            }
        }));
        const code = TenGlyph(layout, codePoint);
        if (ink.length === 0)
        {
            // The space: two helpers give it a 3-pixel advance, Minecraft Ten's 2.86 rounded.
            add({ Code: code,
                Hidden: [ [ 0, 15 ], [ 1, 15 ] ],
                Ink: [],
                Kind: "Ten",
                Label: `Ten U+${Hex(codePoint)}`,
                Source: codePoint });
            tenAdvances += String.fromCharCode(48 + 3);
            continue;
        }

        const inkRight = Math.max(...ink.map(([ x ]: readonly [ number, number ]) => x));
        if (Math.min(...ink.map(([ x ]: readonly [ number, number ]) => x)) !== 0)
        {
            throw new Error(`Minecraft Ten U+${Hex(codePoint)} does not start in column 0.`);
        }

        add({ Code: code,
            Hidden: right > inkRight ? [ [ right, 15 ] ] : [],
            Ink: ink,
            Kind: "Ten",
            Label: `Ten U+${Hex(codePoint)}`,
            Source: codePoint });
        tenAdvances += String.fromCharCode(48 + right + 2);
    }

    // Wide octants, 4 by 4 blocks; the single dark gray color of the current demo.
    for (let pattern = 0; pattern < 256; pattern++)
    {
        const ink: Array<readonly [ number, number ]> = [];
        for (let block = 0; block < 8; block++)
        {
            if (!(pattern & (1 << block)))
            {
                continue;
            }

            const [ row, column ] = [ block >> 1, block & 1 ];
            for (let y = 0; y < 4; y++)
            {
                for (let x = 0; x < 4; x++)
                {
                    ink.push([ column * 4 + x, row * 4 + y ]);
                }
            }
        }

        add({ Code: layout.OctantBase + pattern,
            Hidden: [ ...pattern & 0x55 ? [] : [ [ 0, 15 ] as const ], [ LastColumn.Wide, 15 ] as const ],
            Ink: ink,
            Kind: "Octant",
            Label: `Octant ${pattern}`,
            Source: pattern });
    }

    // Braille dots: row-major 2 by 4 patterns on the 8 by 16 grid, narrow.
    for (let pattern = 0; pattern < 256; pattern++)
    {
        const ink: Array<readonly [ number, number ]> = [];
        for (let bit = 0; bit < 8; bit++)
        {
            if (!(pattern & 1 << bit))
            {
                continue;
            }

            for (let y = 1; y <= 2; y++)
            {
                for (let x = 1; x <= 2; x++)
                {
                    ink.push([ (bit & 1) * 4 + x, (bit >> 1) * 4 + y ]);
                }
            }
        }

        add({ Code: layout.BrailleBase + pattern,
            Hidden: [ [ 0, 15 ], [ 6, 15 ] ],
            Ink: ink,
            Kind: "Braille",
            Label: `Braille ${pattern}`,
            Source: pattern });
    }

    // The Mojangles switch: one alpha-1 texel, so a line holding it uses the fine font invisibly.
    add({ Code: layout.Switch,
        Hidden: [ [ 0, 15 ] ],
        Ink: [],
        Kind: "Switch",
        Label: "Switch",
        Source: 0 });

    const codes = [ ...glyphs.keys() ].sort((a: number, b: number) => a - b);
    if (codes[0] !== GlyphBase || codes.at(-1) !== layout.End - 1 || codes.length !== layout.End - GlyphBase)
    {
        throw new Error("Canvas glyph allocation is not gapless from U+E200.");
    }

    const slots = [ ...supplement.Cells.keys() ].map((codePoint: number) => layout.Legacy.get(codePoint)!)
        .sort((a: number, b: number) => a - b);
    const pages = [ ...new Set(slots.flatMap((code: number) => [ code, code + layout.WideOffset ])
        .map((code: number) => code >> 8)) ].sort((a: number, b: number) => a - b);
    return { Glyphs: glyphs,
        Layout: layout,
        RegionOctants: regionOctants,
        SupplementPages: pages.map((key: number) => `glyph_${PageName(key)}.png`).join(", "),
        SupplementSpan: `U+${Hex(slots[0])} to U+${Hex(slots.at(-1)!)}, wide copies ` +
            `U+${Hex(slots[0] + layout.WideOffset)} to U+${Hex(slots.at(-1)! + layout.WideOffset)}`,
        TenAdvances: tenAdvances };
}

/**
 * Leftmost and rightmost columns with alpha above zero in a cell of a 256 by 256 RGBA page.
 *
 * @category Tool
 * @since 1.0.0
 */
export function OpaqueColumns(page: Uint8Array, code: number): { Left: number;
    Right: number } | undefined
{
    let left: number | undefined;
    let right: number | undefined;
    const x0 = (code & 15) * 16;
    const y0 = ((code & 255) >> 4) * 16;
    for (let x = 0; x < 16; x++)
    {
        for (let y = 0; y < 16; y++)
        {
            if (page[((y0 + y) * 256 + x0 + x) * 4 + 3] !== 0)
            {
                left ??= x;
                right = x;
                break;
            }
        }
    }

    return left === undefined ? undefined : { Left: left,
        Right: right! };
}

/**
 * Serializes the typed catalogue module, indexed by code minus First.
 *
 * @category Serialization
 * @since 1.0.0
 */
function Catalogue(inputs: Inputs, result: ReturnType<typeof Draw>, advances: Map<number, number>): string
{
    const { Layout: layout, Glyphs: glyphs } = result;
    const codes = [ ...glyphs.keys() ].sort((a: number, b: number) => a - b);
    const kinds = codes.map((code: number) => KindLetter[glyphs.get(code)!.Kind]).join("");
    const advance = codes.map((code: number) => String.fromCharCode(48 + advances.get(code)!)).join("");
    const visible = codes.map((code: number) => glyphs.get(code)!.Ink.length > 0 ? "1" : "0").join("");
    const hidden = codes.map((code: number) => glyphs.get(code)!.Hidden.reduce((mask: number,
        [ x, y ]: readonly [ number, number ]) =>
    {
        if (y !== 15)
        {
            throw new Error("Width helpers must lie on the cell's last row.");
        }

        return mask | 1 << x;
    }, 0));
    const sources = codes.map((code: number) => glyphs.get(code)!.Source);
    const pages = [ ...new Set(codes.map((code: number) => code >> 8)) ].map(PageName);
    const wrap = (values: ReadonlyArray<number>): string =>
    {
        const lines: Array<string> = [];
        for (let index = 0; index < values.length; index += 24)
        {
            lines.push("        " + values.slice(index, index + 24).join(", "));
        }

        return `[\n${lines.join(",\n")}\n    ]`;
    };

    const chunk = (text: string): string => (text.match(/.{1,96}/gu) ?? []).map((part: string) =>
        `        ${JSON.stringify(part)}`).join(" +\n");
    return `/**
 * Authoritative Canvas custom glyph catalogue: every allocated PUA code from U+E200, its kind, source
 * identity, advance, visible ink and invisible width-helper columns, plus particle page identities.
 *
 * This module is auto-generated by Tool/Glyph/Generate.mts.
 *
 * @module bedform-canvas/Public/Glyph.generated
 *
 * @file      Glyph.generated.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

/** Generated catalogue data; read through Public/Glyph.ts. */
export const GlyphData = Object.freeze({
    Version: 1,
    UnicodeVersion: ${JSON.stringify(inputs.Names.UnicodeVersion)},
    Client: ${JSON.stringify(inputs.Ten.Client)},
    Unifont: ${JSON.stringify(inputs.Unifont.Version)},
    First: 0x${Hex(GlyphBase)},
    End: 0x${Hex(layout.End)},
    Switch: 0x${Hex(layout.Switch)},
    WideOffset: ${layout.WideOffset},
    TenBase: 0x${Hex(layout.TenBase)},
    OctantBase: 0x${Hex(layout.OctantBase)},
    BrailleBase: 0x${Hex(layout.BrailleBase)},
    Pages: Object.freeze(${JSON.stringify(pages)}),
    Kinds:
${chunk(kinds)},
    Advances:
${chunk(advance)},
    Visible:
${chunk(visible)},
    Hidden: Object.freeze(${wrap(hidden)}),
    Sources: Object.freeze(${wrap(sources)}),
    RegionOctants: Object.freeze(${wrap(result.RegionOctants)}),
    TenAdvances: ${JSON.stringify(result.TenAdvances)}
} as const);
`;
}

/**
 * Generates every output in memory from a workspace snapshot's captured inputs.
 *
 * @throws { Error } If inputs are invalid or any glyph violates the catalogue contract.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Generate(root: string = WorkspaceRoot): Generated
{
    const inputs = ReadInputs(root);
    const result = Draw(inputs);
    const { Glyphs: glyphs, Layout: layout } = result;
    const fonts = new Map<number, Uint8Array>();
    const textures = new Map<number, Uint8Array>();
    const page = (pages: Map<number, Uint8Array>, key: number,
        background: readonly [ number, number, number ]): Uint8Array =>
    {
        if (!pages.has(key))
        {
            const data = new Uint8Array(256 * 256 * 4);
            for (let index = 0; index < 256 * 256; index++)
            {
                data.set(background, index * 4);
            }

            pages.set(key, data);
        }

        return pages.get(key)!;
    };

    for (const glyph of glyphs.values())
    {
        const font = page(fonts, glyph.Code >> 8, [ 0, 0, 0 ]);
        const texture = page(textures, glyph.Code >> 8, [ 0xFF, 0xFF, 0xFF ]);
        const at = (x: number, y: number): number =>
            ((((glyph.Code & 255) >> 4) * 16 + y) * 256 + (glyph.Code & 15) * 16 + x) * 4;
        for (const [ x, y ] of glyph.Hidden)
        {
            font.set([ ...FontInk, 1 ], at(x, y));
        }

        for (const [ x, y ] of glyph.Ink)
        {
            font.set([ ...FontInk, 255 ], at(x, y));
            texture.set([ 0xFF, 0xFF, 0xFF, 255 ], at(x, y));
        }
    }

    // Every glyph's extent, visible or not, must begin at column 0; its advance is its extent plus 1.
    const advances = new Map<number, number>();
    for (const glyph of glyphs.values())
    {
        const columns = OpaqueColumns(fonts.get(glyph.Code >> 8)!, glyph.Code);
        if (!columns || columns.Left !== 0)
        {
            throw new Error(`${glyph.Label} at U+${Hex(glyph.Code)} spans ${JSON.stringify(columns)}.`);
        }

        const expected = glyph.Kind.endsWith("Wide") || glyph.Kind === "Octant" ? LastColumn.Wide
            : [ "Legacy", "Extra", "Completer", "Braille" ].includes(glyph.Kind) ? LastColumn.Narrow
                : undefined;
        if (expected !== undefined && columns.Right !== expected)
        {
            throw new Error(`${glyph.Label} at U+${Hex(glyph.Code)} ends at column ${columns.Right}.`);
        }

        advances.set(glyph.Code, columns.Right + 2);
    }

    const images = new Map<string, Uint8Array>();
    const texts = new Map<string, string>();
    for (const [ key, data ] of fonts)
    {
        images.set(`${Output.Font}/glyph_${PageName(key)}.png`, data);
        images.set(`${Output.Textures}/glyph_${PageName(key).toLowerCase()}.png`, textures.get(key)!);
        for (const oriented of [ false, true ])
        {
            const suffix = oriented ? "_oriented" : "";
            const page = PageName(key).toLowerCase();
            texts.set(`${Output.Particles}/glyph_${page}${suffix}.json`, ParticleDefinition(
                `bedform_canvas:glyph_${page}`, `textures/bedform_canvas/glyph/glyph_${page}`, 256,
                oriented));
        }
    }

    const surface = SurfaceOutputs();
    for (const [ file, data ] of surface.Images)
    {
        images.set(file, data);
    }

    for (const [ file, text ] of surface.Texts)
    {
        texts.set(file, text);
    }

    const unifont = [
        `Glyphs on ${result.SupplementPages} are derived from GNU Unifont ${inputs.Unifont.Version}`,
        "(https://unifoundry.com/unifont/): the Symbols for Legacy Computing Supplement stand-ins,",
        `${result.SupplementSpan}, narrowed from 8 to 7 columns where needed. The matching`,
        "white particle textures in textures/bedform_canvas/glyph/ carry the same derived glyphs.",
        "",
        inputs.Unifont.Notice,
        "",
        "Unifont is dual-licensed under the SIL Open Font License, Version 1.1, and the",
        "GNU GPL version 2 or later with the GNU font embedding exception. These derived",
        "glyph pages are used and distributed under the SIL Open Font License, Version",
        "1.1, which follows.",
        "",
        inputs.UnifontLicense
    ].join("\n");
    const ten = layout.TenBase;
    const mojang = [
        "Minecraft font notice",
        "",
        `Glyphs U+${Hex(ten)} to U+${Hex(ten + layout.TenCount - 1)} on glyph_${PageName(ten >> 8)}.png ` +
            "and its",
        "white particle texture were rasterised from Mojang's minecraft-ten.ttf, and the legacy",
        "computing shade glyphs sample the vanilla Unicode font's U+2592 medium shade pattern,",
        `both captured from Minecraft for Windows ${inputs.Ten.Client}. Minecraft is a trademark of`,
        "Mojang Synergies AB; the Minecraft fonts are Mojang's and are not covered by this",
        "add-on's MIT license.",
        ""
    ].join("\n");
    for (const directory of [ Output.Font, Output.Textures ])
    {
        texts.set(`${directory}/LICENSE-Unifont.txt`, unifont);
        texts.set(`${directory}/NOTICE-Mojang.txt`, mojang);
    }

    texts.set(Output.Catalogue, Catalogue(inputs, result, advances));
    return { Glyphs: glyphs,
        Images: images,
        Layout: layout,
        RegionOctants: result.RegionOctants,
        TenAdvances: result.TenAdvances,
        Texts: texts };
}

/**
 * Generated files currently present in the managed output directories.
 *
 * @category Tool
 * @since 1.0.0
 */
function Existing(root: string): Array<string>
{
    const found: Array<string> = [ Output.Catalogue ];
    const notices = "|LICENSE-Unifont\\.txt|NOTICE-Mojang\\.txt";
    const fonts = new RegExp(`^(glyph_[0-9A-F]{2}\\.png${notices})$`, "u");
    const textures = new RegExp(`^(glyph_[0-9a-f]{2}\\.png${notices})$`, "u");
    for (const [ directory, pattern ] of [ [ Output.Font, fonts ], [ Output.Textures, textures ],
        [ Output.Particles, /^(glyph_[0-9a-f]{2}|rectangle)(_oriented)?\.json$/u ],
        [ path.dirname(SurfaceOutput.Texture), /^rectangle\.png$/u ] ] as const)
    {
        try
        {
            for (const file of readdirSync(path.join(root, directory)))
            {
                if (pattern.test(file))
                {
                    found.push(`${directory}/${file}`);
                }
            }
        }
        catch
        {
            // A missing directory simply has no generated files yet.
        }
    }

    return found;
}

/**
 * Lists outputs that are missing, stale or unexpected. PNGs compare decoded RGBA so encoder versions
 * cannot cause false staleness.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Stale(root: string = WorkspaceRoot, generated: Generated = Generate(root)): Array<string>
{
    const stale: Array<string> = [];
    for (const [ file, data ] of generated.Images)
    {
        try
        {
            const image = PNG.sync.read(readFileSync(path.join(root, file)));
            const same = Buffer.from(image.data).equals(Buffer.from(data));
            if (image.width * image.height * 4 !== data.length || !same)
            {
                stale.push(file);
            }
        }
        catch
        {
            stale.push(file);
        }
    }

    for (const [ file, text ] of generated.Texts)
    {
        try
        {
            if (readFileSync(path.join(root, file), "utf8") !== text)
            {
                stale.push(file);
            }
        }
        catch
        {
            stale.push(file);
        }
    }

    for (const file of Existing(root))
    {
        if (!generated.Images.has(file) && !generated.Texts.has(file))
        {
            stale.push(file);
        }
    }

    return stale.sort();
}

/**
 * Writes every output and the contact sheets under dist/glyph-preview.
 *
 * @category Tool
 * @since 1.0.0
 */
export function Write(root: string = WorkspaceRoot, generated: Generated = Generate(root)): void
{
    for (const [ file, data ] of generated.Images)
    {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        const size = Math.sqrt(data.length / 4);
        const image = new PNG({ height: size,
            width: size });
        image.data = Buffer.from(data);
        writeFileSync(path.join(root, file), PNG.sync.write(image));
    }

    for (const [ file, text ] of generated.Texts)
    {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
    }

    // Contact sheets, 4x: font ink over light gray, helpers in red; white particle ink over black.
    const preview = path.join(root, Output.Preview);
    mkdirSync(preview, { recursive: true });
    const scale = 4;
    for (const [ file, data ] of generated.Images)
    {
        const font = file.startsWith(Output.Font);
        if (data.length !== 256 * 256 * 4)
        {
            continue;
        }

        const sheet = new PNG({ height: 256 * scale,
            width: 256 * scale });
        for (let y = 0; y < 256; y++)
        {
            for (let x = 0; x < 256; x++)
            {
                const index = (y * 256 + x) * 4;
                const alpha = data[index + 3];
                const grid = (x >> 4) + (y >> 4) & 1 ? 16 : 0;
                const color = alpha === 255 ? [ data[index], data[index + 1], data[index + 2] ]
                    : alpha > 0 ? [ 200, 0, 0 ]
                        : font ? [ 200 - grid, 200 - grid, 200 - grid ] : [ grid, grid, grid ];
                for (let dy = 0; dy < scale; dy++)
                {
                    for (let dx = 0; dx < scale; dx++)
                    {
                        const at = ((y * scale + dy) * sheet.width + x * scale + dx) * 4;
                        sheet.data.set([ ...color, 255 ], at);
                    }
                }
            }
        }

        const name = `${font ? "font" : "particle"}-${path.basename(file)}`;
        writeFileSync(path.join(preview, name), PNG.sync.write(sheet));
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    const generated = Generate();
    if (process.argv.includes("--check"))
    {
        const stale = Stale(WorkspaceRoot, generated);
        if (stale.length > 0)
        {
            console.error("Stale Canvas glyph outputs; run npm run glyph --workspace bedform-canvas:\n" +
                stale.join("\n"));
            process.exit(1);
        }

        console.log("Canvas glyph outputs are current.");
    }
    else
    {
        Write(WorkspaceRoot, generated);
        const codes = [ ...generated.Glyphs.keys() ];
        const last = Hex(generated.Layout.End - 1);
        const pages = new Set(codes.map((code: number) => code >> 8)).size;
        console.log(`Wrote ${codes.length} glyphs U+${Hex(GlyphBase)} to U+${last} on ${pages} pages; ` +
            `switch U+${Hex(generated.Layout.Switch)}.`);
    }
}
