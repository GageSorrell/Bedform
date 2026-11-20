/**
 * Qualifies every widget sprite, source texel, slicing contract, actor definition and packed output.
 *
 * @module bedform-canvas/Test/WidgetArt.test
 *
 * @file      WidgetArt.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pixel and pack fixtures preserve semantic field order and infer contextual callbacks. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { GenerateWidgets, Sources } from "../Tool/WidgetArt.mjs";
import { WidgetEntity, WidgetImages, WidgetStyle } from "../Public/Widget.generated.js";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Build } from "../Tool/Build.mjs";
import { PNG } from "pngjs";
import type { WidgetInput } from "../Tool/WidgetArt.mjs";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { tmpdir } from "node:os";
import { unzipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Resource = "resource_packs/bedform_canvas/";
const Input = JSON.parse(readFileSync(path.join(Root, "Assets/Widget/Input.json"), "utf8")) as WidgetInput;

test("all widget assets reproduce offline and check mode rejects stale or missing files", async () =>
{
    const expected = GenerateWidgets(true);
    const temporary = await mkdtemp(path.join(tmpdir(), "canvas-widget-"));
    try
    {
        await cp(path.join(Root, "Assets"), path.join(temporary, "Assets"), { recursive: true });
        await cp(path.join(Root, "package.json"), path.join(temporary, "package.json"));
        const actual = GenerateWidgets(false, temporary);
        assert.deepEqual(actual, expected);
        assert.deepEqual(GenerateWidgets(true, temporary), expected);
        const name = `${Resource}textures/bedform_canvas/widget/inner_fill.png`;
        const source = expected.get(name)!;
        await writeFile(path.join(temporary, name), "stale");
        assert.throws(() => GenerateWidgets(true, temporary), /Stale widget asset/u);
        await writeFile(path.join(temporary, name), source);
        await rm(path.join(temporary, name));
        assert.throws(() => GenerateWidgets(true, temporary), /ENOENT/u);
        assert.ok(![ ...expected.keys() ].some((name) => /glyph|rectangle|frame.*geo/u.test(name)));
    }
    finally
    {
        await rm(temporary, { recursive: true,
            force: true });
    }
});

test("every captured state preserves target-client pixels, alpha and original slicing metadata", () =>
{
    assert.equal(Input.Client, "1.26.6501.0");
    for (const [ name, source ] of Object.entries(Sources))
    {
        const descriptor = WidgetImages[name as keyof typeof WidgetImages];
        const image = descriptor.Image;
        const input = Input.Images[source];
        const png = PNG.sync.read(readFileSync(path.join(Root, Resource,
            `textures/bedform_canvas/widget/${image.Particle.split(":widget_")[1]}.png`)));
        assert.equal(png.width, input.Width);
        assert.equal(png.height, input.Height);
        assert.equal(png.data.toString("hex"), input.Rgba, name);
        assert.deepEqual(descriptor.Metadata, input.Metadata ?? null);
        assert.match(input.Sha256, /^[\da-f]{64}$/u);
    }

    assert.notEqual(WidgetImages.ButtonLightNormal.Image.Width, WidgetImages.RecipeTabNormal.Image.Width);
    assert.deepEqual(WidgetImages.RecipeTabNormal.Metadata, { nineslice_size: 4,
        base_size: [ 12, 11 ] });
    assert.deepEqual(WidgetImages.ScrollThumb.Metadata,
        { nineslice_size: [ 1, 2, 1, 2 ],
            base_size: [ 3, 5 ] });
    assert.ok("pause_button_template@common_buttons.light_text_button" in
        (Input.References["pause_screen.json"] as object));
    assert.ok("menu_button_template@common_buttons.light_text_button" in
        (Input.References["disconnect_screen.json"] as object));
    assert.equal(WidgetStyle.ButtonReference.SameNativeAssets, true);
    const buttons = Input.References["ui_template_buttons.json"] as Record<string, Record<string, unknown>>;
    assert.equal(buttons["light_button_assets@common.button"]["$default_button_texture|default"],
        "textures/ui/button_borderless_light");
});

test("all sprite particles use shared UV, orientation and tint serialization without glyph allocation", () =>
{
    const outputs = GenerateWidgets(true);
    assert.ok(Object.keys(WidgetImages).length > 80);
    for (const asset of Object.values(WidgetImages))
    {
        const image = asset.Image;
        for (const suffix of [ "", "_oriented" ])
        {
            const effect = JSON.parse(Buffer.from(outputs.get(`${Resource}particles/` +
                image.Particle.split(":")[1] + suffix + ".json")!).toString()).particle_effect;
            assert.equal(effect.description.identifier, image.Particle + suffix);
            assert.equal(effect.description.basic_render_parameters.material, "particles_blend");
            const uv = effect.components["minecraft:particle_appearance_billboard"].uv;
            assert.equal(uv.texture_width, image.Width);
            assert.equal(uv.texture_height, image.Height);
            assert.deepEqual(effect.components["minecraft:particle_appearance_tinting"].color,
                [ "variable.color.r", "variable.color.g", "variable.color.b", "variable.color.a" ]);
        }
    }

    const inner = PNG.sync.read(Buffer.from(outputs.get(
        `${Resource}textures/bedform_canvas/widget/inner_fill.png`)!));
    assert.equal(inner.data.toString("hex"), "00000080");
    for (const name of [ "CalloutNote", "CalloutTip", "CalloutImportant", "CalloutWarning", "CalloutCaution",
        "ScrollArrowUp", "ScrollArrowRight", "ScrollArrowDown", "ScrollArrowLeft" ] as const)
    {
        const key = WidgetImages[name].Image.Particle.replace(":widget_", "/widget/");
        const png = PNG.sync.read(Buffer.from(outputs.get(`${Resource}textures/${key}.png`)!));
        let ink = 0;
        for (let offset = 0; offset < png.data.length; offset += 4)
        {
            const pixel = png.data.subarray(offset, offset + 4).toString("hex");
            assert.ok(pixel === "ffffffff" || pixel === "00000000");
            if (pixel === "ffffffff")
            {
                ink++;
            }
        }

        assert.ok(ink > 0 && ink < png.width * png.height);
        if (name.startsWith("Scroll"))
        {
            assert.equal(png.width, png.height);
        }
    }
});

test("proxies have no body, collisions, gravity, AI, pickup or loot; holder retains attachment bones", () =>
{
    const outputs = GenerateWidgets(true);
    for (const [ kind, id ] of Object.entries(WidgetEntity))
    {
        const slug = id.split(":")[1];
        const entity = JSON.parse(Buffer.from(outputs.get(
            `behavior_packs/bedform_canvas/entities/${slug}.json`)!).toString())["minecraft:entity"];
        assert.equal(entity.description.identifier, id);
        assert.equal(entity.description.is_spawnable, false);
        const c = entity.components;
        assert.deepEqual(c["minecraft:physics"], { has_collision: false,
            has_gravity: false });
        assert.deepEqual(c["minecraft:collision_box"], { width: 0.1,
            height: 0.1 });
        assert.deepEqual(c["minecraft:pushable_by_entity"], { presets: [ { push_mode: "none" } ] });
        assert.equal(c["minecraft:damage_sensor"].triggers[0].deals_damage, "no");
        assert.ok(!Object.keys(c).some((name) =>
            /behavior\.|pickup|attack|explode|interact|rideable/u.test(name)));
        const geo = JSON.parse(Buffer.from(outputs.get(
            `${Resource}models/entity/${slug}.geo.json`)!).toString())["minecraft:geometry"][0];
        assert.ok(geo.bones.every((bone: Record<string, unknown>) => !bone.cubes));
        if (kind === "ItemHolder")
        {
            assert.deepEqual(geo.bones, Input.HolderBones);
            assert.ok(geo.bones.some((bone: Record<string, unknown>) => bone.name === "rightitem"));
            assert.ok(c["minecraft:equipment"].slot_drop_chance.every(
                (slot: Record<string, unknown>) => slot.drop_chance === 0));
        }
    }

    assert.deepEqual(JSON.parse(Buffer.from(outputs.get(
        "behavior_packs/bedform_canvas/loot_tables/bedform_canvas/empty.json")!).toString()), { pools: [] });
});

test("every generated asset and notice ships byte-for-byte; catalogue imports start nothing", async () =>
{
    const temporary = await mkdtemp(path.join(tmpdir(), "canvas-widget-pack-"));
    try
    {
        const outer = unzipSync(await readFile(await Build(temporary)));
        const bp = unzipSync(outer["bedform-canvas-bp.mcpack"]);
        const rp = unzipSync(outer["bedform-canvas-rp.mcpack"]);
        for (const [ name, bytes ] of GenerateWidgets(true))
        {
            if (name.startsWith(Resource))
            {
                assert.deepEqual(Buffer.from(rp[name.slice(Resource.length)]), Buffer.from(bytes), name);
            }

            if (name.startsWith("behavior_packs/bedform_canvas/"))
            {
                assert.deepEqual(Buffer.from(bp[name.slice("behavior_packs/bedform_canvas/".length)]),
                    Buffer.from(bytes), name);
            }
        }

        const notice = Buffer.from(rp["textures/bedform_canvas/widget/NOTICE-Mojang.txt"]).toString();
        assert.match(notice, /outside MIT/u);
        const result = await build({ entryPoints: [ path.join(Root, "Public/Widget.generated.ts") ],
            bundle: true,
            platform: "neutral",
            format: "iife",
            globalName: "Widgets",
            write: false });
        const realm: Record<string, unknown> = {};
        runInNewContext(result.outputFiles[0].text, realm);
        assert.deepEqual(Object.keys(realm), [ "Widgets" ]);
        assert.ok(Object.isFrozen((realm.Widgets as Record<string, unknown>).WidgetEntity));
    }
    finally
    {
        await rm(temporary, { recursive: true,
            force: true });
    }
});
