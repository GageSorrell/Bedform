/**
 * Offline Intent artwork qualification: complete presets, source pixels, animation UVs and packing.
 *
 * @module bedform-canvas/Test/IntentArt.test
 *
 * @file      IntentArt.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pixel fixtures retain contextual inference and source field ordering. */
/* eslint-disable @typescript-eslint/typedef */

import { Builtin } from "../../../Package/Bedform/Source/Spatial/Intent.js";
import { BuiltinImages } from "../Public/IntentArt.generated.js";
import { Generate } from "../Tool/IntentArt.mjs";
import { PNG } from "pngjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const Root = new URL("../", import.meta.url);

test("all nineteen builtin descriptors and particle textures are current without a client", () =>
{
    Generate(true);
    assert.deepEqual(Object.keys(BuiltinImages).sort(),
        Object.values(Builtin).map((entry) => entry.Name).sort());
    assert.equal(Object.keys(BuiltinImages).length, 19);
    for (const [ name, image ] of Object.entries(BuiltinImages))
    {
        const texture = PNG.sync.read(readFileSync(new URL(
            `resource_packs/bedform_canvas/textures/bedform_canvas/intent/${name}.png`, Root)));
        assert.equal(texture.width, image.Width);
        assert.equal(texture.height, image.Height * image.FrameCount);
        for (const suffix of [ "", "_oriented" ])
        {
            const particle = JSON.parse(readFileSync(new URL(
                `resource_packs/bedform_canvas/particles/intent_${name.replaceAll("-", "_")}${suffix}.json`,
                Root), "utf8")).particle_effect;
            assert.equal(particle.description.identifier, image.Particle + suffix);
            assert.equal(particle.description.basic_render_parameters.material, "particles_blend");
            const components = particle.components;
            assert.equal(components["minecraft:particle_lifetime_expression"].max_lifetime, 0.1);
            assert.equal(components["minecraft:particle_appearance_billboard"].uv.texture_height,
                texture.height);
            assert.equal(components["minecraft:particle_appearance_billboard"].facing_camera_mode,
                suffix ? "direction_z" : "rotate_xyz");
        }
    }

    assert.equal(BuiltinImages.thinking.FrameCount, 3);
    assert.equal(BuiltinImages.thinking.FrameTicks, 6);
    assert.equal(BuiltinImages.sleep.FrameCount, 6);
    assert.equal(BuiltinImages.sleep.FrameTicks, 4);
});

test("arrow source masks retain fine Mojangles shape with exactly one lower-right shadow pixel", () =>
{
    const input = JSON.parse(readFileSync(new URL("Assets/Intent/Input.json", Root), "utf8"));
    assert.match(input.Client, /^\d+\.\d+\.\d+\.\d+$/u);
    for (const [ name, descriptor ] of Object.entries(BuiltinImages))
    {
        if (!name.startsWith("arrow-"))
        {
            continue;
        }

        assert.match(input.Sources[name], /font.brarchive\/glyph_21.png U\+219[0-9]/u);
        const source = input.Images[name];
        const mask = Buffer.from(source.Rgba, "hex");
        const actual = PNG.sync.read(readFileSync(new URL(
            `resource_packs/bedform_canvas/textures/bedform_canvas/intent/${name}.png`, Root)));
        assert.equal(descriptor.Width, source.Width + 1);
        assert.equal(descriptor.Height, source.Height + 1);
        for (let y = 0; y < actual.height; y++)
        {
            for (let x = 0; x < actual.width; x++)
            {
                const ink = x < source.Width && y < source.Height && mask[(y * source.Width + x) * 4 + 3];
                const shadow = x > 0 && y > 0 && mask[((y - 1) * source.Width + x - 1) * 4 + 3];
                assert.equal(actual.data.subarray((y * actual.width + x) * 4,
                    (y * actual.width + x + 1) * 4).toString("hex"),
                ink ? "4d4d4dff" : shadow ? "222222ff" : "00000000");
            }
        }
    }
});

test("vanilla health and hunger colors and alpha are preserved exactly", () =>
{
    const input = JSON.parse(readFileSync(new URL("Assets/Intent/Input.json", Root), "utf8"));
    for (const name of [ "affectionate", "hunger" ])
    {
        const image = PNG.sync.read(readFileSync(new URL(
            `resource_packs/bedform_canvas/textures/bedform_canvas/intent/${name}.png`, Root)));
        assert.equal(image.data.toString("hex"), input.Images[name].Rgba);
        assert.match(input.Sources[name], /textures\/ui.brarchive/u);
    }
});

test("SOS reuses the captured Ten outlines without allocating font cells or baking a background", () =>
{
    const input = JSON.parse(readFileSync(new URL("Assets/Glyph/Input/minecraft-ten.json", Root), "utf8"));
    const image = PNG.sync.read(readFileSync(new URL(
        "resource_packs/bedform_canvas/textures/bedform_canvas/intent/sos.png", Root)));
    const expected = [ "53", "4F", "53" ].reduce((sum, code) => sum +
        input.Cells[code].reduce((pixels: number, row: string) => pixels + [ ...row ].filter(
            (pixel) => pixel !== ".").length, 0), 0);
    let ink = 0;
    for (let offset = 0; offset < image.data.length; offset += 4)
    {
        if (image.data[offset + 3])
        {
            ink++;
            assert.equal(image.data.subarray(offset, offset + 4).toString("hex"), "4d4d4dff");
        }
    }

    assert.equal(ink, expected);
});
