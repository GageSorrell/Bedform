/**
 * Captures client widget references and generates reproducible Canvas artwork and inert actor assets.
 *
 * @module bedform-canvas/Tool/WidgetArt
 *
 * @file      WidgetArt.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Sprite states and pack JSON retain their semantic field order. */
/* eslint-disable sort-keys */

import { FindClient, ReadArchive } from "../../../Package/Bedform/Tool/TextMetrics.mjs";
import { ParticleDefinition, ParticleVariants } from "./Particle.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { createHash } from "node:crypto";
import path from "node:path";

const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * The bedform-canvas version that introduced the generated widget records. It is fixed rather than read
 * from package.json, so later pack version bumps do not relabel existing symbols.
 *
 * @category Constant
 * @since 1.0.1
 */
const Since = "1.0.1" as const;
const InputFile = "Assets/Widget/Input.json";
const Resource = "resource_packs/bedform_canvas";
const Behavior = "behavior_packs/bedform_canvas";

/**
 * Semantic sprite names and exact target-client sources; aliases share captured source pixels.
 *
 * @category Constant
 * @since 1.0.1
 */
export const Sources = Object.freeze({
    ArmorEmpty: "armor_empty",
    ArmorFull: "armor_full",
    ArmorHalf: "armor_half",
    AirEmpty: "bubble_empty",
    AirFull: "bubble",
    AirPop: "bubble_pop",
    BossEmpty: "empty_progress_bar",
    BossFull: "filled_progress_bar",
    ButtonDarkNormal: "button_borderless_dark",
    ButtonDarkHover: "button_borderless_darkhover",
    ButtonDarkPressed: "button_borderless_darkpressed",
    ButtonDisabled: "disabledButtonNoBorder",
    ButtonLightNormal: "button_borderless_light",
    ButtonLightHover: "button_borderless_lighthover",
    ButtonLightPressed: "button_borderless_lightpressed",
    ButtonBorderDark: "button_border_dark",
    ButtonBorderLight: "button_border_light",
    CloseDarkNormal: "close_button_default",
    CloseDarkHover: "close_button_hover",
    CloseDarkPressed: "close_button_pressed",
    CloseLightNormal: "close_button_default_light",
    CloseLightHover: "close_button_hover_light",
    CloseLightPressed: "close_button_pressed_light",
    DocumentationDarkNormal: "how_to_play_button_default",
    DocumentationDarkHover: "how_to_play_button_hover",
    DocumentationDarkPressed: "how_to_play_button_pressed",
    DocumentationLightNormal: "how_to_play_button_default_light",
    DocumentationLightHover: "how_to_play_button_hover_light",
    DocumentationLightPressed: "how_to_play_button_pressed_light",
    ExperienceEmpty: "experiencebarempty",
    ExperienceFull: "experiencebarfull",
    HealthEmpty: "heart_background",
    HealthFull: "heart",
    HealthHalf: "heart_half",
    HungerEmpty: "hunger_background",
    HungerFull: "hunger_full",
    HungerHalf: "hunger_half",
    RecipeTabNormal: "TabTopBack",
    RecipeTabHover: "TabTopBackHover",
    RecipeTabSelected: "TabTopFront",
    RecipeTabSelectedHover: "TabTopFrontHover",
    RecipeDarkNormal: "recipe_book_dark_button",
    RecipeDarkPressed: "recipe_book_dark_button_pressed",
    RecipeLightNormal: "recipe_book_light_button",
    RecipeLightPressed: "recipe_book_light_button_pressed",
    CraftingOff: "craft_toggle_off",
    CraftingOffHover: "craft_toggle_off_hover",
    CraftingOn: "craft_toggle_on",
    CraftingOnHover: "craft_toggle_on_hover",
    FurnaceOff: "furnace_toggle_off",
    FurnaceOffHover: "furnace_toggle_off_hover",
    FurnaceOn: "furnace_toggle_on",
    FurnaceOnHover: "furnace_toggle_on_hover",
    ScrollTrack: "ScrollRail",
    ScrollGutter: "ScrollGutterWithBG",
    ScrollThumb: "ScrollHandle",
    SliderTrack: "slider_background",
    SliderTrackHover: "slider_background_hover",
    SliderProgress: "slider_progress",
    SliderProgressHover: "slider_progress_hover",
    SliderThumb: "slider_button_default",
    SliderThumbHover: "slider_button_hover",
    SliderThumbDisabled: "slider_button_locked",
    SlotNormal: "slot_enabled",
    SlotHover: "slot_enabled_hover",
    SlotDisabled: "slot_disabled",
    SlotDisabledHover: "slot_disabled_hover",
    SlotSelected: "highlight_slot",
    ToggleOff: "toggle_off",
    ToggleOffHover: "toggle_off_hover",
    ToggleOn: "toggle_on",
    ToggleOnHover: "toggle_on_hover"
} as const);

/**
 * Source pixels plus upstream slicing metadata, without resizing or alpha normalization.
 *
 * @category Model
 * @since 1.0.1
 */
export interface SourceImage {
    readonly Width: number;
    readonly Height: number;
    readonly Rgba: string;
    readonly Sha256: string;
    readonly Metadata?: unknown;
}

/**
 * Offline inputs with source UI definitions that establish reference inheritance.
 *
 * @category Model
 * @since 1.0.1
 */
export interface WidgetInput {
    readonly Client: string;
    readonly Images: Readonly<Record<string, SourceImage>>;
    readonly References: Readonly<Record<string, unknown>>;
    readonly HolderBones: ReadonlyArray<Record<string, unknown>>;
}

/**
 * Explicitly refreshes source pixels and UI/holder references from the installed client.
 *
 * @throws { Error } If a required target-client file is missing.
 *
 * @category Tool
 * @since 1.0.1
 */
export function CaptureWidgets(): void
{
    const client = FindClient();
    if (!client)
    {
        throw new Error("Install Minecraft for Windows before capturing widget references.");
    }

    const archive = (name: string): Map<string, Buffer> => ReadArchive(readFileSync(path.join(
        client.Location, "data/resource_packs/vanilla/__brarchive", name)));
    const textures = archive("textures/ui.brarchive");
    const images: Record<string, SourceImage> = {};
    for (const name of new Set(Object.values(Sources)))
    {
        const bytes = textures.get(name + ".png");
        if (!bytes)
        {
            throw new Error(`Missing target-client widget source ${name}.png`);
        }

        const image = PNG.sync.read(bytes);
        const metadata = textures.get(name + ".json");
        images[name] = { Width: image.width,
            Height: image.height,
            Rgba: image.data.toString("hex"),
            Sha256: createHash("sha256").update(bytes).digest("hex"),
            ...metadata ? { Metadata: JSON.parse(metadata.toString()) } : {} };
    }

    const ui = archive("ui.brarchive");
    const references: Record<string, unknown> = {};
    for (const name of [ "pause_screen.json", "disconnect_screen.json", "ui_template_buttons.json",
        "hud_screen.json", "ui_common.json", "inventory_screen.json" ])
    {
        const bytes = ui.get(name);
        if (!bytes)
        {
            throw new Error(`Missing target-client reference ${name}`);
        }

        references[name] = JSON.parse(bytes.toString());
    }

    const geometry = JSON.parse(archive("models/entity.brarchive").get("armor_stand.geo.json")!.toString());
    const bones = geometry["minecraft:geometry"][0].bones.map((bone: Record<string, unknown>) =>
    {
        const skeleton = { ...bone };
        delete skeleton.cubes;
        return skeleton;
    });
    mkdirSync(path.join(Root, "Assets/Widget"), { recursive: true });
    writeFileSync(path.join(Root, InputFile), JSON.stringify({ Client: client.Version,
        Images: images,
        References: references,
        HolderBones: bones }, null, 2) + "\n");
}

/**
 * Creates a solid or transparent source image without interpolated edges.
 *
 * @category Constructor
 * @since 1.0.1
 */
function Solid(color: string): PNG
{
    const image = new PNG({ width: 1,
        height: 1 });
    image.data.set(Buffer.from(color, "hex"));
    return image;
}

/**
 * Original white pixel masks; consumers apply theme/accent tint through the existing surface API.
 *
 * @category Constructor
 * @since 1.0.1
 */
function Mask(rows: ReadonlyArray<string>): PNG
{
    const image = new PNG({ width: rows[0].length,
        height: rows.length });
    rows.forEach((row: string, y: number) => [ ...row ].forEach((pixel: string, x: number) =>
    {
        if (pixel === "#")
        {
            image.data.fill(255, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
        }
    }));
    return image;
}

/**
 * Rotates an image by exact quarter turns, preserving every source texel and alpha value.
 *
 * @category Transforming
 * @since 1.0.1
 */
function Turn(image: PNG): PNG
{
    const output = new PNG({ width: image.height,
        height: image.width });
    for (let y = 0; y < image.height; y++)
    {
        for (let x = 0; x < image.width; x++)
        {
            output.data.set(image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4),
                (x * output.width + image.height - y - 1) * 4);
        }
    }

    return output;
}

/**
 * Emits a required monorepo header for generated public resource contracts.
 *
 * @category Serialization
 * @since 1.0.1
 */
function Header(name: string, description: string): string
{
    return `/**
 * ${description}
 *
 * This module is auto-generated by Tool/WidgetArt.mts.
 *
 * @module bedform-canvas/Public/${name.replace(/\.ts$/u, "")}
 *
 * @file      ${name}
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable */

`;
}

/**
 * Generates non-glyph sprites and actor assets offline; never emits shared rounded frame geometry.
 * Check mode compares all generated bytes without writing pack files.
 *
 * @throws { Error } If a generated output is absent or stale.
 *
 * @category Tool
 * @since 1.0.1
 */
export function GenerateWidgets(check: boolean = false, root: string = Root): ReadonlyMap<string, Uint8Array>
{
    const input = JSON.parse(readFileSync(path.join(root, InputFile), "utf8")) as WidgetInput;
    const outputs = new Map<string, Uint8Array>();
    const text = (name: string, value: unknown): void =>
    {
        const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n";
        outputs.set(name, Buffer.from(serialized));
    };

    const images = new Map<string, PNG>();
    const descriptors: Record<string, unknown> = {};
    for (const [ name, source ] of Object.entries(Sources))
    {
        const raw = input.Images[source];
        if (!raw)
        {
            throw new Error(`Missing captured widget ${source}`);
        }

        const image = new PNG({ width: raw.Width,
            height: raw.Height });
        image.data.set(Buffer.from(raw.Rgba, "hex"));
        images.set(name, image);
        descriptors[name] = { Source: `textures/ui.brarchive/${source}.png`,
            Metadata: raw.Metadata ?? null };
    }

    for (const [ name, color ] of Object.entries({ PanelLight: "c6c6c6ff",
        PanelDark: "313131ff",
        CraftingFill: "c6c6c6ff",
        FurnaceFill: "c6c6c6ff",
        LoadingFill: "313131ff",
        InnerFill: "00000080",
        DividerLight: "8b8b8bff",
        DividerDark: "555555ff",
        Transparent: "00000000" }))
    {
        images.set(name, Solid(color));
        descriptors[name] = { Source: "Original theme fill; frame geometry belongs to Bedform-9rdk.9",
            Metadata: null };
    }

    const masks = {
        CalloutNote: [ ".#####.", "#.....#", "#..#..#", "#.....#", "#..#..#", "#..#..#", ".#####." ],
        CalloutTip: [ "..###..", ".#...#.", "#.....#", "#.....#", ".#...#.", "..###..", "..###.." ],
        CalloutImportant: [ "#######", "#.....#", "#..#..#", "#..#..#", "#.....#", "###.###", "..#...." ],
        CalloutWarning: [ "...#...", "..#.#..", "..#.#..", ".#.#.#.", ".#...#.", "#..#..#", "#######" ],
        CalloutCaution: [ "..###..", ".#...#.", "#.#.#.#", "#..#..#", "#.#.#.#", ".#...#.", "..###.." ],
        ScrollArrowUp: [ "........", "........", "...##...", "..####..", ".######.",
            "........", "........", "........" ]
    };
    for (const [ name, rows ] of Object.entries(masks))
    {
        images.set(name, Mask(rows));
        descriptors[name] = { Source: "Original MIT pixel mask; explicit arbitrary surface tint",
            Metadata: null };
    }

    let arrow = images.get("ScrollArrowUp")!;
    for (const name of [ "ScrollArrowRight", "ScrollArrowDown", "ScrollArrowLeft" ])
    {
        arrow = Turn(arrow);
        images.set(name, arrow);
        descriptors[name] = descriptors.ScrollArrowUp;
    }

    const preview = new PNG({ width: 512,
        height: Math.ceil(images.size / 8) * 48 });
    let index = 0;
    for (const [ name, image ] of images)
    {
        const slug = name.replace(/[A-Z]/gu, (letter: string) => "_" + letter.toLowerCase()).slice(1);
        const texture = `textures/bedform_canvas/widget/${slug}`;
        const particle = `bedform_canvas:widget_${slug}`;
        outputs.set(`${Resource}/${texture}.png`, PNG.sync.write(image));
        for (const variant of ParticleVariants)
        {
            const definition = JSON.parse(ParticleDefinition(particle, texture, image.width, variant.Oriented,
                image.height, variant.Depth));
            text(`${Resource}/particles/widget_${slug}${variant.Suffix}.json`, definition);
        }

        descriptors[name] = { ...descriptors[name] as object,
            Image: { Kind: "image",
                Version: 1,
                Id: particle,
                Particle: particle,
                Width: image.width,
                Height: image.height,
                FrameCount: 1,
                FrameTicks: 1 } };
        PNG.bitblt(image, preview, 0, 0, Math.min(60, image.width), Math.min(44, image.height),
            (index % 8) * 64, Math.floor(index / 8) * 48);
        index++;
    }

    const entityTypes = { InteractionProxy: "bedform_canvas:interaction_proxy",
        ItemHolder: "bedform_canvas:item_holder",
        MobAnchor: "bedform_canvas:mob_anchor" };
    for (const [ kind, identifier ] of Object.entries(entityTypes))
    {
        const slug = identifier.split(":")[1];
        text(`${Behavior}/entities/${slug}.json`, { format_version: "1.26.50",
            "minecraft:entity": {
                description: { identifier,
                    is_spawnable: false,
                    is_summonable: true,
                    ...kind === "ItemHolder" ? { runtime_identifier: "minecraft:armor_stand" } : {} },
                components: {
                    "minecraft:type_family": { family: [ "bedform_canvas_presentation", "inanimate" ] },
                    "minecraft:collision_box": { width: 0.1,
                        height: 0.1 },
                    "minecraft:physics": { has_collision: false,
                        has_gravity: false },
                    "minecraft:pushable_by_entity": { presets: [ { push_mode: "none" } ] },
                    "minecraft:knockback_resistance": { value: 1 },
                    "minecraft:health": { value: 1,
                        max: 1 },
                    "minecraft:fire_immune": {},
                    "minecraft:damage_sensor": { triggers: [ { cause: "all",
                        deals_damage: "no" } ] },
                    "minecraft:loot": { table: "loot_tables/bedform_canvas/empty.json" },
                    ...kind === "ItemHolder" ? {
                        "minecraft:inventory": { inventory_size: 1,
                            container_type: "inventory",
                            private: true,
                            restrict_to_owner: true },
                        "minecraft:equippable": { slots: [ { slot: 0,
                            accepted_items: [] } ] },
                        "minecraft:equipment": { table: "loot_tables/bedform_canvas/empty.json",
                            slot_drop_chance: [ { slot: "slot.weapon.mainhand",
                                drop_chance: 0 },
                            { slot: "slot.weapon.offhand",
                                drop_chance: 0 } ] }
                    } : {}
                }
            } });
        text(`${Resource}/entity/${slug}.entity.json`, { format_version: "1.10.0",
            "minecraft:client_entity": {
                description: { identifier,
                    materials: { default: "entity_alphatest" },
                    textures: { default: "textures/bedform_canvas/widget/transparent" },
                    geometry: { default: `geometry.bedform_canvas.${slug}` },
                    render_controllers: [ "controller.render.bedform_canvas.empty" ],
                    enable_attachables: kind === "ItemHolder" }
            } });
        text(`${Resource}/models/entity/${slug}.geo.json`, { format_version: "1.12.0",
            "minecraft:geometry": [ {
                description: { identifier: `geometry.bedform_canvas.${slug}`,
                    texture_width: 1,
                    texture_height: 1,
                    visible_bounds_width: 2,
                    visible_bounds_height: 2,
                    visible_bounds_offset: [ 0, 0.5, 0 ] },
                bones: kind === "ItemHolder" ? input.HolderBones : [ { name: "root",
                    pivot: [ 0, 0, 0 ] } ]
            } ] });
    }

    text(`${Behavior}/loot_tables/bedform_canvas/empty.json`, { pools: [] });
    text(`${Resource}/render_controllers/widget_empty.json`, { format_version: "1.8.0",
        render_controllers: { "controller.render.bedform_canvas.empty": { geometry: "Geometry.default",
            materials: [ { "*": "Material.default" } ],
            textures: [ "Texture.default" ] } } });
    const record = (name: string, value: unknown): string =>
        `/**\n * Generated ${name} resource contract.\n *\n` +
        ` * @category Constant\n * @since ${Since}\n */\n` +
        `export const ${name} = Object.freeze(${JSON.stringify(value, null, 4)} as const);\n`;
    text("Public/Widget.generated.ts", Header("Widget.generated.ts",
        "Widget artwork, reference metadata and inert presentation actor identities.") +
        record("WidgetImages", descriptors) + "\n" + record("WidgetEntity", entityTypes) + "\n" +
        record("WidgetStyle", { Callout: { Light: { Note: "#0969DA",
            Tip: "#1A7F37",
            Important: "#8250DF",
            Warning: "#9A6700",
            Caution: "#CF222E" },
        Dark: { Note: "#4493F8",
            Tip: "#3FB950",
            Important: "#AB7DF8",
            Warning: "#D29922",
            Caution: "#F85149" } },
        FrameOwner: "Bedform-9rdk.9",
        ButtonReference: { Pause: "pause.pause_button_template@common_buttons.light_text_button",
            Disconnect: "disconnect.menu_button_template@common_buttons.light_text_button",
            SameNativeAssets: true },
        ActorAudience: "WorldVisible; private actor presentation requires separate qualification" }));
    text(`${Resource}/textures/bedform_canvas/widget/NOTICE-Mojang.txt`,
        "Minecraft widget artwork and armor-stand attachment skeleton derive from " +
        `Minecraft for Windows ${input.Client}.\n` +
        "Sources and original slicing metadata: Assets/Widget/Input.json. Mojang artwork is outside MIT.\n" +
        "Original masks and theme fills are MIT. Minecraft is a trademark of Mojang Synergies AB.\n");
    for (const [ name, bytes ] of outputs)
    {
        const target = path.join(root, name);
        if (check)
        {
            if (!readFileSync(target).equals(Buffer.from(bytes)))
            {
                throw new Error(`Stale widget asset: ${name}`);
            }
        }
        else
        {
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, bytes);
        }
    }

    if (!check)
    {
        mkdirSync(path.join(root, "dist"), { recursive: true });
        writeFileSync(path.join(root, "dist/widget-preview.png"), PNG.sync.write(preview));
    }

    return outputs;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    if (process.argv.includes("--capture"))
    {
        CaptureWidgets();
    }

    GenerateWidgets(process.argv.includes("--check"));
}
