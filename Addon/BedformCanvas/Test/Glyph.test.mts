/**
 * Qualifies the Canvas glyph catalogue: freshness and determinism, dark gray font ink, white particle
 * textures with matching alpha and UVs, helper separation, lookups, tint, particles, notices,
 * packing and inert imports.
 *
 * @module bedform-canvas/Test/Glyph.test
 *
 * @file      Glyph.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Glyph from "../Public/Glyph.ts";
import * as Surface from "bedform/Canvas/Surface";
import { FontInk, Generate, OpaqueColumns, Output, Stale } from "../Tool/Glyph/Generate.mts";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { Build } from "../Tool/Build.mts";
import { GlyphData } from "../Public/Glyph.generated.ts";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Generated = Generate();

test("tracked outputs are fresh and generation is deterministic from captured inputs alone", async () =>
{
    assert.deepEqual(Stale(Root, Generated), []);
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-glyph-"));
    try
    {
        // Only the checked-in inputs are copied: no client, network, demo or prior output is available.
        const inputs = "Assets/Glyph/Input";
        await cp(path.join(Root, inputs), path.join(directory, inputs), { recursive: true });
        const isolated = Generate(directory);
        assert.deepEqual([ ...isolated.Texts ], [ ...Generated.Texts ]);
        assert.deepEqual([ ...isolated.Images.keys() ], [ ...Generated.Images.keys() ]);
        for (const [ file, data ] of Generated.Images)
        {
            assert.ok(Buffer.from(isolated.Images.get(file)!).equals(Buffer.from(data)), file);
        }

        assert.ok(Stale(directory, isolated).length > 0, "an empty snapshot is reported stale");
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("font pages are dark gray; white particle textures share shapes, alpha and UVs without helpers", () =>
{
    const pages = [ ...new Set([ ...Generated.Glyphs.keys() ].map((code: number) => code >> 8)) ];
    assert.equal(pages.length, 10);
    for (const key of pages)
    {
        const name = key.toString(16).toUpperCase();
        const font = Generated.Images.get(`${Output.Font}/glyph_${name}.png`)!;
        const texture = Generated.Images.get(`${Output.Textures}/glyph_${name.toLowerCase()}.png`)!;
        for (let pixel = 0; pixel < font.length; pixel += 4)
        {
            const alpha = font[pixel + 3];
            assert.ok([ 0, 1, 255 ].includes(alpha));
            if (alpha > 0)
            {
                assert.deepEqual([ ...font.subarray(pixel, pixel + 3) ], [ ...FontInk ]);
            }

            assert.equal(texture[pixel + 3], alpha === 255 ? 255 : 0,
                "particle ink matches visible font ink only");
            assert.deepEqual([ ...texture.subarray(pixel, pixel + 3) ], [ 0xFF, 0xFF, 0xFF ]);
        }
    }
});

test("the catalogue matches every drawn glyph, keeps cells isolated and separates helpers", () =>
{
    assert.equal(Glyph.Catalogue.First, 0xE2_00);
    assert.equal(Glyph.Catalogue.End - Glyph.Catalogue.First, Generated.Glyphs.size);
    assert.equal(Glyph.Lookup(Glyph.Catalogue.First - 1), undefined);
    assert.equal(Glyph.Lookup(Glyph.Catalogue.End), undefined);
    for (const [ code, glyph ] of Generated.Glyphs)
    {
        const entry = Glyph.Lookup(code)!;
        const font = Generated.Images.get(`${Output.Font}/glyph_${entry.Page}.png`)!;
        assert.equal(entry.Kind, glyph.Kind);
        assert.equal(entry.Source, glyph.Source);
        assert.equal(entry.Visible, glyph.Ink.length > 0);
        const hidden = glyph.Hidden.map(([ x ]: readonly [ number, number ]) => x);
        assert.deepEqual(entry.Hidden, hidden.sort((a: number, b: number) => a - b));
        assert.equal(entry.Advance, OpaqueColumns(font, code)!.Right + 2);
        assert.equal(entry.U, (code & 15) * 16);
        assert.equal(entry.V, ((code & 255) >> 4) * 16);
        for (const [ x, y ] of [ ...glyph.Ink, ...glyph.Hidden ])
        {
            assert.ok(x >= 0 && x < 16 && y >= 0 && y < 16, "ink stays inside its own cell");
            const at = (point: readonly [ number, number ]): string => point.join(",");
            const ink = new Set(glyph.Ink.map(at));
            assert.ok(!glyph.Hidden.some((point: readonly [ number, number ]) => ink.has(at(point))));
        }
    }

    // Cells after the switch are unallocated and empty in both representations.
    const last = Generated.Images.get(`${Output.Font}/glyph_EB.png`)!;
    for (let code = Glyph.Catalogue.End; code < 0xEC_00; code++)
    {
        assert.equal(OpaqueColumns(last, code), undefined);
    }
});

test("source identities, reserved characters, Ten, patterns and the switch cell are exact", () =>
{
    const standIns = new Set<number>();
    for (const [ first, last ] of [ [ 0x1_FB_00, 0x1_FB_FF ], [ 0x1_CC_00, 0x1_CE_BF ] ])
    {
        for (let codePoint = first; codePoint <= last; codePoint++)
        {
            const standIn = Glyph.LegacyGlyph(codePoint);
            if (standIn !== undefined)
            {
                assert.ok(!standIns.has(standIn));
                standIns.add(standIn);
                assert.equal(Glyph.Lookup(standIn)!.Source, codePoint);
                assert.equal(Glyph.Lookup(standIn + Glyph.Catalogue.WideOffset)!.Kind, "LegacyWide");
            }
        }
    }

    for (const reserved of [ 0x1_FB_93, 0x1_FB_FF, 0x1_CC_FD, 0x1_CE_B4, 0x1_CC_4C, 0x1_CD_F6 ])
    {
        assert.equal(Glyph.LegacyGlyph(reserved), undefined);
    }

    const sextant = String.fromCodePoint(Glyph.LegacyGlyph(0x1_FB_00)!);
    assert.equal(Glyph.ToLegacyGlyphs("a\u{1FB00}b"), `a${sextant}b`);
    assert.equal(Glyph.TenGlyph(0x61), undefined);
    assert.equal(Glyph.Lookup(Glyph.TenGlyph(0x41)!)!.Source, 0x41);
    assert.equal(Glyph.Lookup(Glyph.TenGlyph(0x7E)!)!.Kind, "Ten");
    const space = Glyph.Lookup(Glyph.TenGlyph(0x20)!)!;
    assert.deepEqual([ space.Visible, space.Advance, space.Hidden ], [ false, 3, [ 0, 1 ] ]);
    assert.equal(Glyph.Lookup(Glyph.PatternGlyph("Octant", 255))!.Kind, "Octant");
    assert.equal(Glyph.Lookup(Glyph.PatternGlyph("Braille", 0))!.Visible, false);
    assert.ok([ "Legacy", "Completer" ].includes(Glyph.Lookup(Glyph.PatternGlyph("RegionOctant", 17))!.Kind));
    assert.throws(() => Glyph.PatternGlyph("Octant", 256), RangeError);

    const switchCell = Glyph.Lookup(Glyph.Catalogue.Switch)!;
    assert.deepEqual(switchCell, { Advance: 2,
        Code: 0xEB_67,
        Hidden: [ 0 ],
        Kind: "Switch",
        Page: "EB",
        Source: 0,
        U: 7 * 16,
        V: 6 * 16,
        Visible: false });
    assert.equal(GlyphData.Kinds.split("S").length - 1, 1, "exactly one switch cell");
});

test("tint defaults to dark gray and explicit non-palette RGB/RGBA wins without quantization", () =>
{
    const gray = 0x4D / 255;
    assert.deepEqual(Glyph.Tint(), { alpha: 1,
        blue: gray,
        green: gray,
        red: gray });
    assert.deepEqual(Glyph.Tint("#4D4D4D"), Glyph.Tint());
    assert.deepEqual(Glyph.Tint({ blue: 0.789,
        green: 0.456,
        red: 0.123 }),
    { alpha: 1,
        blue: 0.789,
        green: 0.456,
        red: 0.123 });
    assert.deepEqual(Glyph.Tint({ alpha: 0.25,
        blue: 0.3,
        green: 0.2,
        red: 0.1 }),
    { alpha: 0.25,
        blue: 0.3,
        green: 0.2,
        red: 0.1 });
    assert.deepEqual(Glyph.Tint("#12345678"), { alpha: 0x78 / 255,
        blue: 0x56 / 255,
        green: 0x34 / 255,
        red: 0x12 / 255 });
    for (const invalid of [ "#123", "red", { blue: 0,
        green: 0,
        red: 2 }, { blue: 0,
        green: Number.NaN,
        red: 0 },
    { alpha: -0.1,
        blue: 0,
        green: 0,
        red: 0 } ])
    {
        assert.throws(() => Glyph.Tint(invalid), TypeError);
    }

    const code = Glyph.LegacyGlyph(0x1_FB_00)!;
    const spawn = Glyph.ParticleSpawnOf(code, { SizeX: 0.1,
        SizeY: 0.2 });
    assert.equal(spawn.Particle, `bedform_canvas:glyph_${(code >> 8).toString(16)}`);
    assert.deepEqual(spawn.Colors[Glyph.ParticleVariable.Color], Glyph.DefaultTint);
    assert.equal(spawn.Floats[Glyph.ParticleVariable.Width], 7);
    assert.equal(spawn.Floats[Glyph.ParticleVariable.U], Glyph.Lookup(code)!.U);
    const tinted = Glyph.ParticleSpawnOf(code, { Direction: { x: 0,
        y: 0,
        z: 1 },
    SizeX: 0.1,
    SizeY: 0.2,
    Tint: { alpha: 0.5,
        blue: 0.9,
        green: 0.1,
        red: 0.7 } });
    assert.equal(tinted.Particle, spawn.Particle + Glyph.OrientedSuffix);
    assert.deepEqual(tinted.Colors[Glyph.ParticleVariable.Color], { alpha: 0.5,
        blue: 0.9,
        green: 0.1,
        red: 0.7 });
    assert.deepEqual(tinted.Vectors[Glyph.ParticleVariable.Direction], { x: 0,
        y: 0,
        z: 1 });
    assert.throws(() => Glyph.ParticleSpawnOf(Glyph.Catalogue.Switch, { SizeX: 1,
        SizeY: 1 }), RangeError);
    assert.throws(() => Glyph.ParticleSpawnOf(code, { SizeX: 0,
        SizeY: 1 }), TypeError);
});

test("glyph and rectangle particles sample white textures through the shared surface contract", () =>
{
    const definitions = [ ...Generated.Texts ].filter(([ file ]: [ string, string ]) =>
        file.startsWith(Output.Particles));
    assert.equal(definitions.length, 22);
    for (const [ file, text ] of definitions)
    {
        const effect = JSON.parse(text).particle_effect;
        const oriented = file.endsWith("_oriented.json");
        const page = /glyph_([0-9a-f]{2})/u.exec(file)?.[1];
        const [ identifier, texture, size ] = page === undefined
            ? [ Surface.Rectangle.Particle, "textures/bedform_canvas/surface/rectangle",
                Surface.Rectangle.TextureSize ]
            : [ Glyph.ParticlePrefix + page, `textures/bedform_canvas/glyph/glyph_${page}`, 256 ];
        assert.equal(effect.description.identifier, identifier + (oriented ? Surface.OrientedSuffix : ""));
        assert.equal(effect.description.basic_render_parameters.texture, texture);
        assert.ok(Generated.Images.has(`resource_packs/bedform_canvas/${texture}.png`));
        const billboard = effect.components["minecraft:particle_appearance_billboard"];
        assert.deepEqual([ billboard.uv.texture_width, billboard.uv.texture_height ], [ size, size ]);
        assert.deepEqual(billboard.uv.uv, [ Surface.ParticleVariable.U, Surface.ParticleVariable.V ]);
        assert.deepEqual(billboard.uv.uv_size,
            [ Surface.ParticleVariable.Width, Surface.ParticleVariable.Height ]);
        assert.deepEqual(billboard.size, [ Surface.ParticleVariable.SizeX, Surface.ParticleVariable.SizeY ]);
        assert.equal(billboard.facing_camera_mode, oriented ? "direction_z" : "rotate_xyz");
        assert.deepEqual(billboard.direction?.custom_direction, oriented
            ? [ "x", "y", "z" ].map((axis: string) => `${Surface.ParticleVariable.Direction}.${axis}`)
            : undefined);
        const motion = effect.components["minecraft:particle_motion_parametric"];
        assert.equal(motion.rotation, Surface.ParticleVariable.Roll);
        assert.equal(effect.components["minecraft:particle_lifetime_expression"].max_lifetime,
            Surface.LifetimeTicks / 20);
        assert.deepEqual(effect.components["minecraft:particle_appearance_tinting"].color,
            [ "r", "g", "b", "a" ].map((channel: string) => `${Surface.ParticleVariable.Color}.${channel}`));
    }

    const white = Generated.Images.get(
        "resource_packs/bedform_canvas/textures/bedform_canvas/surface/rectangle.png")!;
    assert.equal(white.length, Surface.Rectangle.TextureSize ** 2 * 4);
    assert.ok(white.every((value: number) => value === 0xFF), "the rectangle texture is opaque white");
    assert.equal(Glyph.ParticleVariable, Surface.ParticleVariable);
    assert.equal(Glyph.Tint, Surface.Tint);
});

test("notices travel with derived pages and the catalogue carries the generated module header", () =>
{
    for (const directory of [ Output.Font, Output.Textures ])
    {
        const unifont = Generated.Texts.get(`${directory}/LICENSE-Unifont.txt`)!;
        assert.match(unifont, /GNU Unifont 18\.0\.01/u);
        assert.match(unifont, /SIL OPEN FONT LICENSE Version 1\.1/u);
        assert.match(Generated.Texts.get(`${directory}/NOTICE-Mojang.txt`)!, /minecraft-ten\.ttf/u);
    }

    const catalogue = Generated.Texts.get(Output.Catalogue)!;
    assert.ok(catalogue.startsWith("/**\n * Authoritative Canvas custom glyph catalogue"));
    assert.ok(catalogue.includes(" *\n * This module is auto-generated by Tool/Glyph/Generate.mts.\n *\n" +
        " * @module bedform-canvas/Public/Glyph.generated\n"));
    assert.match(catalogue, / \*\/\n\n\/\* eslint-disable \*\/\n\n/u);
});

test("the packed resource pack contains every page, texture, particle and notice", async () =>
{
    const directory = await mkdtemp(path.join(tmpdir(), "bedform-canvas-glyph-pack-"));
    try
    {
        const archive = unzipSync(await readFile(await Build(directory)));
        const resource = unzipSync(archive["bedform-canvas-rp.mcpack"]);
        for (const file of [ ...Generated.Images.keys(), ...Generated.Texts.keys() ])
        {
            if (file.startsWith("resource_packs/bedform_canvas/"))
            {
                assert.ok(resource[file.slice("resource_packs/bedform_canvas/".length)], file);
            }
        }
    }
    finally
    {
        await rm(directory, { force: true,
            recursive: true });
    }
});

test("importing the public glyph contract is inert in a restricted host", async () =>
{
    const bundled = await build({ bundle: true,
        entryPoints: [ path.join(Root, "Public/Glyph.ts") ],
        format: "iife",
        globalName: "Glyph",
        platform: "neutral",
        write: false });
    const context: Record<string, unknown> = {};
    runInNewContext(bundled.outputFiles[0].text, context);
    const api = context.Glyph as typeof Glyph;
    assert.equal(api.Lookup(api.Catalogue.Switch)!.Kind, "Switch");
    // Objects from the restricted realm have its own prototypes, so compare their JSON.
    assert.equal(JSON.stringify(api.Tint()), JSON.stringify(Glyph.DefaultTint));
});
