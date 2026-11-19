/**
 * Exact structure catalogs, height boundaries, native material qualification and localized control mappings.
 *
 * @module bedform/Test/PrototypeCatalog.test
 *
 * @file      PrototypeCatalog.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Fixtures preserve domain order, contextual typing and intentional invalid inputs. */
/* eslint-disable sort-imports, sort-keys, @typescript-eslint/typedef, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import * as C from "../Source/Prototype/Structure/Catalog.js";
import * as S from "../Source/Prototype/Structure.js";
import * as P from "../Source/Prototype/Persistence.js";

/**
 * Isolated native-static adapter fixture records exact requested states and rejects unavailable IDs.
 *
 * @category Tests
 * @since 1.0.0
 */
const engine = () =>
{
    const calls: Array<readonly [string, Readonly<Record<string, string | number | boolean>>]> = [];
    const missing = new Set<string>();
    let localized = true;
    let preserveStates = true;
    const adapter = C.nativeEngine({ get: (id) => missing.has(id) ? undefined : {
        id,
        ...(localized ? { localizationKey: "tile." + id.slice("minecraft:".length) + ".name" } : {})
    } }, { resolve: (id, states) =>
    {
        if (missing.has(id))
        {
            throw new Error("missing block");
        }

        calls.push([ id, { ...states } ]);
        return { type: { id },
            getAllStates: () => preserveStates ? { ...states } : {} };
    } });
    return { adapter,
        calls,
        missing,
        setLocalized: (value: boolean) =>
        {
            localized = value;
        },
        setPreserveStates: (value: boolean) =>
        {
            preserveStates = value;
        } };
};

test("exact catalogs preserve all six role palettes/defaults without duplicates or unstable materials", () =>
{
    Assert.deepEqual(S.SolidPalette, [ "minecraft:iron_block", "minecraft:polished_andesite",
        "minecraft:smooth_stone", "minecraft:stone", "minecraft:stone_bricks", "minecraft:quartz_block",
        "minecraft:white_concrete", "minecraft:black_concrete" ]);
    Assert.deepEqual(S.GlassPalette, [ "minecraft:glass", "minecraft:white_stained_glass", "minecraft:light_gray_stained_glass" ]);
    Assert.deepEqual(S.PanePalette, [ "minecraft:glass_pane", "minecraft:white_stained_glass_pane", "minecraft:light_gray_stained_glass_pane" ]);
    Assert.deepEqual(S.SlabPalette, [ "minecraft:smooth_stone_slab", "minecraft:stone_brick_slab", "minecraft:quartz_slab" ]);
    Assert.deepEqual(S.Defaults, { Size: "Medium",
        Facing: "South",
        IncludeMainCeiling: false,
        InteriorHeight: 3,
        Materials: { MainFloor: "minecraft:iron_block",
            EntranceWall: "minecraft:stone",
            EntranceFloor: "minecraft:polished_andesite",
            MainWalls: "minecraft:glass",
            MainCeiling: "minecraft:glass",
            EntranceCeiling: "minecraft:smooth_stone_slab" } });
    Assert.deepEqual(C.normalize({}), S.Defaults);
    for (const role of [ "MainFloor", "EntranceWall", "EntranceFloor" ] as const)
    {
        Assert.deepEqual(C.Catalogs[role], S.SolidPalette);
    }

    Assert.deepEqual(C.Catalogs.MainWalls, [ ...S.SolidPalette, ...S.GlassPalette, ...S.PanePalette ]);
    Assert.deepEqual(C.Catalogs.MainCeiling, [ ...S.SolidPalette, ...S.GlassPalette, ...S.SlabPalette ]);
    Assert.deepEqual(C.Catalogs.EntranceCeiling, C.Catalogs.MainCeiling);
    for (const ids of Object.values(C.Catalogs))
    {
        Assert.equal(new Set(ids).size, ids.length);
        Assert.equal(ids.some((id) => /air|water|lava|sand$|gold|diamond/u.test(id)), false);
        Assert.ok(Object.isFrozen(ids));
    }

    const native = engine();
    for (const role of Object.keys(C.Catalogs) as Array<C.Part>)
    {
        Assert.deepEqual(C.catalog(role, native.adapter).map((choice) => choice.Id), C.Catalogs[role]);
    }
});

test("saved permutations require all six roles and explicit valid states without silent repair", () =>
{
    const native = engine();
    const saved = C.qualify(S.Defaults, native.adapter).Permutations!;
    const { MainFloor: omitted, ...partial } = saved;
    void omitted;
    Assert.throws(() => C.qualify(S.Defaults, native.adapter, undefined, partial as P.MaterialPermutations), /all six/u);
    Assert.throws(() => C.qualify(S.Defaults, native.adapter, undefined, { ...saved,
        MainFloor: undefined } as unknown as P.MaterialPermutations), /all six/u);
    Assert.throws(() => C.qualify(S.Defaults, native.adapter, undefined, { ...saved,
        EntranceCeiling: { Id: S.Defaults.Materials.EntranceCeiling,
            States: {} } }), /bottom/u);
    Assert.throws(() => C.qualify(S.Defaults, native.adapter, undefined, { ...saved,
        MainFloor: { Id: "minecraft:stone",
            States: {} } }), /MainFloor.*role/u);
    for (const state of [ NaN, Infinity, null, {}, [] ])
    {
        Assert.throws(() => C.qualify(S.Defaults, native.adapter, undefined, { ...saved,
            MainFloor: { Id: S.Defaults.Materials.MainFloor,
                States: { custom: state } }
        } as unknown as P.MaterialPermutations), /MainFloor.*invalid state/u);
    }

    const refusing = { ...native.adapter,
        Resolve: () =>
        {
            throw new Error("unsupported state");
        } };
    Assert.throws(() => C.qualify(S.Defaults, refusing, undefined, saved), /MainFloor.*unsupported state/u);
    const wrongId: C.Engine = { ...native.adapter,
        Resolve: () => ({ Id: "minecraft:stone",
            States: {} }) };
    Assert.throws(() => C.qualify(S.Defaults, wrongId), /MainFloor.*permutation/u);
});

test("strict normalization defaults only absent legacy fields and detaches the resulting draft", () =>
{
    const raw = { Materials: { MainFloor: "minecraft:black_concrete" } };
    const result = C.normalize(raw);
    Assert.equal(result.Materials.MainFloor, "minecraft:black_concrete");
    Assert.equal(result.Materials.EntranceCeiling, "minecraft:smooth_stone_slab");
    (result.Materials as { MainFloor: string }).MainFloor = "minecraft:stone";
    Assert.equal(raw.Materials.MainFloor, "minecraft:black_concrete");
    for (const invalid of [ null, [], { Size: "Tiny" }, { Facing: "east" }, { Facing: 2 },
        { IncludeMainCeiling: 0 }, { InteriorHeight: 2 }, { InteriorHeight: 3.1 },
        { InteriorHeight: NaN }, { InteriorHeight: Infinity }, { InteriorHeight: "3" },
        { Materials: { MainFloor: null } }, { Materials: { MainWalls: "minecraft:quartz_slab" } },
        { Materials: { MainCeiling: "minecraft:glass_pane" } }, { Materials: { EntranceFloor: "minecraft:glass" } },
        { Materials: { EntranceWall: "addon:wall" } }, { Materials: { Extra: "minecraft:stone" } }, { Extra: true } ])
    {
        Assert.throws(() => C.normalize(invalid));
    }
});

test("site validation uses actual floor and both roof heights without fixed dimension assumptions or clamping", () =>
{
    const site = { FloorY: 63,
        MinY: -64,
        MaxYExclusive: 320 };
    Assert.equal(C.validateSite(S.Defaults, site), 256);
    Assert.equal(C.validateSite({ ...S.Defaults,
        IncludeMainCeiling: true }, site), 255);
    Assert.doesNotThrow(() => C.validateSite({ ...S.Defaults,
        InteriorHeight: 256 }, site));
    Assert.throws(() => C.validateSite({ ...S.Defaults,
        InteriorHeight: 257 }, site), /maximum 256/u);
    Assert.doesNotThrow(() => C.validateSite({ ...S.Defaults,
        InteriorHeight: 255,
        IncludeMainCeiling: true }, site));
    Assert.throws(() => C.validateSite({ ...S.Defaults,
        InteriorHeight: 256,
        IncludeMainCeiling: true }, site), /maximum 255/u);
    Assert.doesNotThrow(() => C.validateSite(S.Defaults, { FloorY: 315,
        MinY: -64,
        MaxYExclusive: 320 }));
    Assert.throws(() => C.validateSite(S.Defaults, { FloorY: 316,
        MinY: -64,
        MaxYExclusive: 320 }), /entrance roof/u);
    Assert.throws(() => C.validateSite(S.Defaults, { FloorY: -65,
        MinY: -64,
        MaxYExclusive: 320 }), /floor/u);
    Assert.doesNotThrow(() => C.validateSite(S.Defaults, { FloorY: -20,
        MinY: -20,
        MaxYExclusive: -15 }));
    Assert.throws(() => C.validateSite(S.Defaults, { FloorY: 0.5,
        MinY: 0,
        MaxYExclusive: 100 }), /range/u);
    Assert.equal(S.Defaults.InteriorHeight, 3);
});

test("native qualification preserves independent selected materials and explicit bottom-half slab states", () =>
{
    const native = engine();
    const options: S.Options = { ...S.Defaults,
        IncludeMainCeiling: true,
        InteriorHeight: 6,
        Materials: { MainFloor: "minecraft:white_concrete",
            EntranceWall: "minecraft:quartz_block",
            EntranceFloor: "minecraft:stone_bricks",
            MainWalls: "minecraft:white_stained_glass_pane",
            MainCeiling: "minecraft:quartz_slab",
            EntranceCeiling: "minecraft:stone_brick_slab" } };
    const resolved = C.qualify(options, native.adapter, { FloorY: 0,
        MinY: 0,
        MaxYExclusive: 128 });
    Assert.equal(resolved.CatalogVersion, C.CatalogVersion);
    Assert.deepEqual(resolved.Options, options);
    Assert.equal(resolved.Permutations!.MainCeiling.States["minecraft:vertical_half"], "bottom");
    Assert.equal(resolved.Permutations!.EntranceCeiling.States["minecraft:vertical_half"], "bottom");
    Assert.equal(resolved.Permutations!.MainWalls.Id, "minecraft:white_stained_glass_pane");
    Assert.equal(native.calls.length, 6);
    const stored = { ...resolved.Permutations!,
        MainFloor: { Id: options.Materials.MainFloor,
            States: { custom: 1 } } };
    Assert.equal(C.qualify(options, native.adapter, undefined, stored).Permutations!.MainFloor.States.custom, 1);
    Assert.throws(() => C.qualify(options, native.adapter, undefined, { ...stored,
        MainCeiling: { Id: "minecraft:quartz_slab",
            States: { "minecraft:vertical_half": "top" } } }), /bottom/u);
    native.setPreserveStates(false);
    Assert.throws(() => C.qualify(options, native.adapter), /permutation/u);
});

test("missing native types, localization keys, saved material states and disappearing selections fail explicitly", () =>
{
    const native = engine();
    native.missing.add("minecraft:iron_block");
    Assert.throws(() => C.catalog("MainFloor", native.adapter), /MainFloor.*iron_block/u);
    native.missing.clear();
    native.setLocalized(false);
    Assert.throws(() => C.catalog("MainWalls", native.adapter), /localizationKey/u);
    native.setLocalized(true);
    const choices = C.catalog("MainFloor", native.adapter);
    Assert.throws(() => C.dropdown("MainFloor", S.Defaults, choices.slice(1)), /saved material/u);
    Assert.throws(() => C.dropdown("MainFloor", S.Defaults, [ ...choices, choices[0] ]), /ambiguous/u);
    native.missing.add(S.Defaults.Materials.MainCeiling);
    Assert.throws(() => C.qualify(S.Defaults, native.adapter), /MainWalls|MainCeiling/u);
});

test("translated labels are client-locale messages; saved IDs map correctly after catalog order changes", () =>
{
    const native = engine();
    const choices = C.catalog("MainFloor", native.adapter);
    const control = C.dropdown("MainFloor", S.Defaults, choices);
    Assert.deepEqual(control.Items[0], { value: 0,
        label: { translate: "tile.iron_block.name" } });
    const locales = { en: { "tile.iron_block.name": "Block of Iron" },
        fr: { "tile.iron_block.name": "Bloc de fer" } };
    Assert.notEqual(locales.en[control.Items[0].label.translate as "tile.iron_block.name"],
        locales.fr[control.Items[0].label.translate as "tile.iron_block.name"]);
    const reordered = C.dropdown("MainFloor", S.Defaults, [ ...choices ].reverse());
    Assert.equal(reordered.SelectedValue, choices.length - 1);
    Assert.equal(reordered.Choices[reordered.SelectedValue].Id, S.Defaults.Materials.MainFloor);
    const changed = C.withChoice(S.Defaults, reordered, 0);
    Assert.equal(changed.Materials.MainFloor, "minecraft:black_concrete");
    Assert.equal(S.Defaults.Materials.MainFloor, "minecraft:iron_block");
    for (const bad of [ -1, 0.5, NaN, Infinity, choices.length ])
    {
        Assert.throws(() => C.withChoice(S.Defaults, control, bad), /dropdown/u);
    }
});

test("disabled main-ceiling controls retain their material and entrance-ceiling controls remain enabled", () =>
{
    const native = engine();
    const options = C.normalize({ Materials: { MainCeiling: "minecraft:quartz_slab" } });
    const main = C.dropdown("MainCeiling", options, C.catalog("MainCeiling", native.adapter));
    const entrance = C.dropdown("EntranceCeiling", options, C.catalog("EntranceCeiling", native.adapter));
    Assert.equal(main.Enabled, false);
    Assert.equal(main.Choices[main.SelectedValue].Id, "minecraft:quartz_slab");
    Assert.equal(entrance.Enabled, true);
    Assert.throws(() => C.withChoice(options, main, 0), /disabled/u);
    const enabled = C.dropdown("MainCeiling", { ...options,
        IncludeMainCeiling: true }, main.Choices);
    Assert.equal(enabled.SelectedValue, main.SelectedValue);
    Assert.equal(enabled.Enabled, true);
});

test("qualified material IDs/states persist across restart without labels/indexes or implicit block changes", () =>
{
    const values = new Map<string, string>();
    const port: P.Properties = { getDynamicProperty: (key) => values.get(key),
        setDynamicProperty: (key, value) =>
        {
            if (value === undefined)
            {
                values.delete(key);
            }
            else
            {
                values.set(key, value);
            }
        } };
    const native = engine();
    P.saveOptions(port, "demo", 0, C.qualify({}, native.adapter));
    const saved = P.load(port).Demonstrations.demo.StructureOptions!;
    Assert.deepEqual(C.qualify(saved.Options, native.adapter, undefined, saved.Permutations).Permutations, saved.Permutations);
    Assert.equal(saved.Options.IncludeMainCeiling, false);
    Assert.equal(P.load(port).Demonstrations.demo.PlacedRecipe, undefined);
    Assert.equal([ ...values.values() ].join("").includes("translate"), false);
    native.missing.add(saved.Options.Materials.EntranceCeiling);
    Assert.throws(() => C.qualify(saved.Options, native.adapter, undefined, saved.Permutations), /EntranceCeiling/u);
});
