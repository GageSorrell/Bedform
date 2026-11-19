/**
 * Durable Prototype transactions, recovery journals, declaration reconciliation and reference resolution.
 *
 * @module bedform/Test/PrototypePersistence.test
 *
 * @file      PrototypePersistence.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Tests preserve contextual inference and domain-grouped expected data. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import Assert from "node:assert/strict";
import { test } from "node:test";
import type { Block as NativeBlock, Entity as NativeEntity } from "@minecraft/server";
import type { Bounds, Configuration } from "../Source/Prototype/Interaction.js";
import * as P from "../Source/Prototype/Persistence.js";
import * as R from "../Source/Prototype/References.js";
import * as S from "../Source/Prototype/Structure.js";
import { Block, Entity, Demonstration, Ready } from "../Source/Prototype/Demonstration.js";
import { DynamicProperty, DynamicPropertyPrefix, StructurePrefix } from "../Source/Prototype/keys.js";
import { decode, publish, readDocument, StorageLimits } from "../Source/Prototype/Internal/PersistenceCodec.js";

/**
 * In-memory native property port enforces the byte budget and supports exact injected write failures.
 *
 * @category Tests
 * @since 1.0.0
 */
const memory = () =>
{
    const values = new Map<string, string>();
    const writes: Array<string> = [];
    let failure: ((key: string) => boolean) | undefined;
    return {
        values,
        writes,
        fail: (value?: (key: string) => boolean) =>
        {
            failure = value;
        },
        getDynamicProperty: (key: string) => values.get(key),
        setDynamicProperty: (key: string, value?: string) =>
        {
            if (failure?.(key))
            {
                throw new Error("Injected property failure");
            }

            if (value !== undefined)
            {
                Assert.ok(Buffer.byteLength(value, "utf8") <= StorageLimits.ChunkBytes);
            }

            writes.push(key);
            if (value === undefined)
            {
                values.delete(key);
            }
            else
            {
                values.set(key, value);
            }
        }
    };
};

const Area: Bounds = { Dimension: "minecraft:overworld",
    Min: { x: -5,
        y: 63,
        z: -5 },
    Max: { x: 5,
        y: 80,
        z: 9 } };
const Arrival = { Dimension: Area.Dimension,
    Position: { x: 0.5,
        y: 64,
        z: 7.5 },
    Rotation: { x: 0,
        y: 180 } };
const Chest = { Kind: "Block",
    Dimension: Area.Dimension,
    Position: { x: 1,
        y: 64,
        z: 1 } } as const;
const Actor = { Kind: "Entity",
    Dimension: Area.Dimension,
    Id: "actor-1" } as const;
const NoObjects: R.Resolver = { Block: () => ({ Status: "Unloaded" }),
    Entity: () => ({ Status: "Unloaded" }) };

/**
 * Supplies exact independent material roles and bottom-half slab states for persistence checks.
 *
 * @category Tests
 * @since 1.0.0
 */
const choices = (): Omit<P.StructureOptions, "Revision"> =>
{
    const options: S.Options = { Size: "Large",
        Facing: "West",
        InteriorHeight: 8,
        IncludeMainCeiling: true,
        Materials: { MainFloor: "minecraft:white_concrete",
            EntranceWall: "minecraft:stone_bricks",
            EntranceFloor: "minecraft:quartz_block",
            MainWalls: "minecraft:white_stained_glass_pane",
            MainCeiling: "minecraft:quartz_slab",
            EntranceCeiling: "minecraft:smooth_stone_slab" } };
    const permutations = Object.fromEntries(Object.entries(options.Materials).map(([ role, id ]) => [ role,
        { Id: id,
            States: id.endsWith("_slab") ? { "minecraft:vertical_half": "bottom" } : {} }
    ])) as unknown as P.MaterialPermutations;
    return { CatalogVersion: 3,
        Options: options,
        Permutations: permutations };
};

/**
 * Seed geometry includes a tall main roof, the separate fixed canopy and a protruding entrance footprint.
 * The downstream placement service supplies the full native footprint rather than regenerating on load.
 *
 * @category Tests
 * @since 1.0.0
 */
const proposed = (preview: P.Preview): S.PlacedRecipe =>
{
    const radius = (S.Presets[preview.Selection.Options.Size].InteriorSize - 1) / 2;
    const cells = [];
    for (let x = -radius - 1; x <= radius + 1; x++)
    {
        for (let z = -radius - 1; z <= radius + 1; z++)
        {
            cells.push({ x,
                y: 63,
                z });
        }
    }

    for (let x = -2; x <= 2; x++)
    {
        for (let z = radius + 2; z <= radius + 4; z++)
        {
            cells.push({ x,
                y: 63,
                z });
        }
    }

    return { RecipeVersion: 7,
        DemonstrationId: preview.DemonstrationId,
        OptionsRevision: preview.Selection.Revision,
        Options: preview.Selection.Options,
        Dimension: Area.Dimension,
        Center: { x: 0,
            y: 63,
            z: 0 },
        Footprint: cells,
        Bounds: { Dimension: Area.Dimension,
            Min: { x: -radius - 1,
                y: 63,
                z: -radius - 1 },
            Max: { x: radius + 2,
                y: 63 + Math.max(6, preview.Selection.Options.InteriorHeight + 2),
                z: radius + 5 } },
        Arrival: { ...Arrival,
            Position: { x: 0,
                y: 64,
                z: radius + 2 } } };
};

/**
 * Starts and acknowledges partitioned snapshots without pretending to execute native block writes.
 *
 * @category Tests
 * @since 1.0.0
 */
const writing = (properties: P.Properties, id: string = "demo") =>
{
    const capture = P.preview(P.load(properties), id);
    const recipe = proposed(capture);
    const partitions = [ { ...recipe.Bounds,
        Max: { ...recipe.Bounds.Max,
            y: 320 } } ];
    const journal = P.beginPlacement(properties, capture, recipe, partitions).Placement!;
    P.snapshotSaved(properties, journal.Id, 0);
    P.startWriting(properties, journal.Id);
    return { journal,
        recipe };
};

test("new worlds have no writes; descriptor round trips preserve all fields and optional home/mode", () =>
{
    const host = memory();
    Assert.deepEqual(P.load(host), { SchemaVersion: 1,
        Revision: 0,
        Editing: true,
        Demonstrations: {},
        Selections: {} });
    Assert.equal(host.writes.length, 0);
    const config: Configuration = { Id: "demo",
        Revision: 0,
        Bounds: Area,
        Arrival,
        Trigger: Chest,
        References: { Input: Chest,
            Display: Actor } };
    P.saveConfiguration(host, config);
    const saved = P.saveWorld(host, 1, false, Arrival);
    Assert.deepEqual(P.load(host), saved);
    Assert.deepEqual(saved.Demonstrations.demo.Configuration, { ...config,
        Revision: 1 });
    P.saveWorld(host, 2, true);
    Assert.equal(P.load(host).Home, undefined);
    Assert.ok(host.writes.every((key) => key === DynamicProperty.Manifest || key.startsWith(DynamicPropertyPrefix.Chunk)));
    Assert.equal(host.writes.at(-1), DynamicProperty.Manifest);
});

test("optimistic per-demo and world edits reject stale callbacks while independent IDs preserve each other", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "one",
        Revision: 0,
        References: {} });
    P.saveConfiguration(host, { Id: "two",
        Revision: 0,
        References: {} });
    Assert.throws(() => P.saveConfiguration(host, { Id: "one",
        Revision: 0,
        References: {} }), /Stale/u);
    Assert.throws(() => P.saveWorld(host, 1, false), /Stale/u);
    Assert.equal(Object.keys(P.load(host).Demonstrations).length, 2);
    P.saveConfiguration(host, { Id: "__proto__",
        Revision: 0,
        References: { constructor: Chest } });
    Assert.equal(P.record(P.load(host), "__proto__").Configuration.Id, "__proto__");
});

test("successful history is separate from cancellations/failures and survives a new storage adapter", () =>
{
    const host = memory();
    Assert.equal(P.recordOutcome(host, "demo", 0, "Cancelled").Revision, 0);
    Assert.equal(P.recordOutcome(host, "demo", 0, "Failed").Revision, 0);
    P.recordOutcome(host, "demo", 0, "Succeeded");
    const restarted: P.Properties = { getDynamicProperty: host.getDynamicProperty,
        setDynamicProperty: host.setDynamicProperty };
    Assert.equal(P.record(P.load(restarted), "demo").SuccessfulCompletions, 1);
    Assert.throws(() => P.recordOutcome(host, "demo", 0, "Failed"), /Stale/u);
    Assert.equal(JSON.stringify(P.load(host)).includes("InProgress"), false);
});

test("structure choices survive locale/catalog reordering, disabled roof toggles and discarded drafts", () =>
{
    const host = memory();
    P.saveOptions(host, "demo", 0, choices());
    const saved = P.load(host);
    const draft = JSON.parse(JSON.stringify(saved.Demonstrations.demo.StructureOptions!)) as P.StructureOptions;
    (draft.Options as { InteriorHeight: number }).InteriorHeight = 20;
    Assert.equal(P.load(host).Demonstrations.demo.StructureOptions!.Options.InteriorHeight, 8);
    const off = { ...choices(),
        Options: { ...choices().Options,
            IncludeMainCeiling: false } };
    P.saveOptions(host, "demo", 1, off);
    const current = P.load(host).Demonstrations.demo;
    Assert.equal(current.StructureOptions!.Options.Materials.MainCeiling, "minecraft:quartz_slab");
    Assert.deepEqual(current.StructureOptions!.Permutations, choices().Permutations);
    Assert.equal(current.PlacedRecipe, undefined);
    Assert.equal(current.Configuration.Bounds, undefined);
    const serialized = [ ...host.values.values() ].join("");
    Assert.equal(/translation|localization|dropdown|index/iu.test(serialized), false);
    const reordered = { ...off,
        Options: { ...off.Options,
            Materials: Object.fromEntries(
                Object.entries(off.Options.Materials).reverse()) as unknown as S.Materials },
        Permutations: Object.fromEntries(Object.entries(off.Permutations!).reverse()) as unknown as P.MaterialPermutations };
    P.saveOptions(host, "demo", 2, reordered);
    Assert.deepEqual(P.load(host).Demonstrations.demo.StructureOptions!.Options.Materials, off.Options.Materials);
});

test("saving options invalidates an old preview and never modifies the old scene/arrival", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 0,
        Bounds: Area,
        Arrival,
        References: {} });
    const capture = P.preview(P.load(host), "demo");
    P.saveOptions(host, "demo", 1, choices());
    Assert.throws(() => P.beginPlacement(host, capture, proposed(capture), [ Area ]), /Stale/u);
    Assert.deepEqual(P.load(host).Demonstrations.demo.Configuration.Arrival, Arrival);
    Assert.deepEqual(P.load(host).Demonstrations.demo.Configuration.Bounds, Area);
});

test("unknown versions, corrupt/missing chunks, unsupported fields and native handles are rejected without writes", () =>
{
    const host = memory();
    host.values.set(DynamicProperty.Manifest, JSON.stringify({ SchemaVersion: 2 }));
    Assert.throws(() => P.load(host), /Unsupported/u);
    Assert.equal(host.writes.length, 0);
    host.values.clear();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 0,
        References: {} });
    const chunkKey = host.writes.find((key) => key.startsWith(DynamicPropertyPrefix.Chunk))!;
    const original = host.values.get(chunkKey)!;
    host.values.set(chunkKey, original.replace("\"Revision\":1", "\"Revision\":2"));
    Assert.throws(() => P.load(host), /integrity/u);
    host.values.delete(chunkKey);
    Assert.throws(() => P.load(host), /Missing/u);
    host.values.set(chunkKey, original);
    const document = P.load(host);
    Assert.throws(() => decode({ ...document,
        Data: {} }), /Unknown/u);
    Assert.throws(() => P.saveConfiguration(host, { ...document.Demonstrations.demo.Configuration,
        References: { Bad: { ...Chest,
            NativeHandle: {} } } } as Configuration), /Unknown/u);
    Assert.throws(() => P.saveConfiguration(host, { ...document.Demonstrations.demo.Configuration,
        Bounds: { ...Area,
            Max: Area.Min } }), /extents/u);
    Assert.throws(() => P.saveGeneratedColor(host, "demo", 1, { red: 2,
        green: 0.5,
        blue: 0.5 }), /RGB/u);
});

test("large Unicode records use byte-safe chunks, survive restart, and staging/manifest failures retain prior state", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 0,
        References: {} });
    const before = P.load(host);
    const refs = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [ "ref-" + index,
        { ...Actor,
            Id: "🌍".repeat(80) + index } ]));
    host.fail((key) => key.endsWith("_1"));
    Assert.throws(() => P.saveConfiguration(host, { Id: "demo",
        Revision: 1,
        References: refs }), /Injected/u);
    Assert.deepEqual(P.load(host), before);
    host.fail((key) => key === DynamicProperty.Manifest);
    Assert.throws(() => P.saveConfiguration(host, { Id: "demo",
        Revision: 1,
        References: refs }), /Injected/u);
    Assert.deepEqual(P.load(host), before);
    host.fail();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 1,
        References: refs });
    Assert.deepEqual(P.load(host).Demonstrations.demo.Configuration.References, refs);
    Assert.ok(host.values.size > 4);
    const tooLarge = Object.fromEntries(Array.from({ length: StorageLimits.MaxChunks + 1 }, (_, index) =>
        [ "r" + index, { ...Actor,
            Id: "x".repeat(StorageLimits.ChunkBytes) } ]));
    const writes = host.writes.length;
    Assert.throws(() => P.saveConfiguration(host, { Id: "demo",
        Revision: 2,
        References: tooLarge }), /capacity/u);
    Assert.equal(host.writes.length, writes);
    Assert.deepEqual(P.load(host).Demonstrations.demo.Configuration.References, refs);
});

test("legacy option omissions default in memory without regenerating or changing recipe version", () =>
{
    const host = memory();
    const recipe = proposed(P.preview(P.load(host), "demo"));
    const legacy = { ...recipe,
        Options: { Size: "Medium",
            Facing: "East" },
        RecipeVersion: 1 };
    const raw = { ...P.load(host),
        Demonstrations: { demo: { Configuration: { Id: "demo",
            Revision: 0,
            References: {} },
        SuccessfulCompletions: 4,
        PlacedRecipe: legacy,
        StructureOptions: { Revision: 1,
            Options: { Materials: { MainFloor: "minecraft:black_concrete" } } } } } };
    publish(host, readDocument(host), decode(raw));
    const writes = host.writes.length;
    const value = P.load(host).Demonstrations.demo;
    Assert.equal(value.PlacedRecipe!.RecipeVersion, 1);
    Assert.equal(value.PlacedRecipe!.Options.InteriorHeight, 3);
    Assert.equal(value.PlacedRecipe!.Options.IncludeMainCeiling, false);
    Assert.equal(value.StructureOptions!.Options.Materials.MainFloor, "minecraft:black_concrete");
    Assert.equal(value.StructureOptions!.Options.Materials.EntranceCeiling, "minecraft:smooth_stone_slab");
    Assert.equal(host.writes.length, writes);
});

test("invalid saved materials/heights, mismatched permutations and unsupported slab halves are never substituted", () =>
{
    const host = memory();
    const valid = choices();
    for (const height of [ 2, 3.5, NaN, Infinity ])
    {
        Assert.throws(() => P.saveOptions(host, "demo", 0, { ...valid,
            Options: { ...valid.Options,
                InteriorHeight: height } }));
    }

    for (const [ role, id ] of [ [ "MainFloor", "minecraft:glass" ], [ "MainWalls", "minecraft:quartz_slab" ],
        [ "MainCeiling", "minecraft:glass_pane" ], [ "EntranceWall", "pack:unknown" ] ])
    {
        Assert.throws(() => P.saveOptions(host, "demo", 0, { ...valid,
            Options: { ...valid.Options,
                Materials: { ...valid.Options.Materials,
                    [role]: id } } } as typeof valid), /material/u);
    }

    Assert.throws(() => P.saveOptions(host, "demo", 0, { ...valid,
        Permutations: { ...valid.Permutations!,
            MainCeiling: { Id: "minecraft:quartz_slab",
                States: {} } } }), /bottom/u);
    Assert.equal(host.writes.length, 0);
});

test("native snapshot journal survives restart, gates writing and commits geometry/settings only after success", () =>
{
    const host = memory();
    P.saveOptions(host, "demo", 0, choices());
    const capture = P.preview(P.load(host), "demo");
    const recipe = proposed(capture);
    const job = P.beginPlacement(host, capture, recipe, [ { ...recipe.Bounds,
        Max: { ...recipe.Bounds.Max,
            y: 320 } } ]).Placement!;
    Assert.ok(job.Snapshots[0].Id.startsWith(StructurePrefix.Snapshot));
    Assert.equal(P.load(host).Demonstrations.demo.PlacedRecipe, undefined);
    Assert.throws(() => P.startWriting(host, job.Id), /all be saved/u);
    Assert.throws(() => P.saveWorld(host, P.load(host).Revision, false), /pending/u);
    Assert.throws(() => P.saveOptions(host, "demo", 1, choices()), /pending/u);
    P.snapshotSaved(host, job.Id, 0);
    P.startWriting(host, job.Id);
    Assert.equal(P.load(host).Placement!.Stage, "Writing");
    const saved = P.commitPlacement(host, job.Id);
    Assert.deepEqual(saved.Demonstrations.demo.PlacedRecipe, recipe);
    Assert.equal(saved.Demonstrations.demo.Configuration.Bounds!.Max.y, 73);
    Assert.deepEqual(saved.Demonstrations.demo.Configuration.Arrival, recipe.Arrival);
    Assert.deepEqual(saved.Demonstrations.demo.PlacedMaterials, choices().Permutations);
    Assert.equal(saved.Demonstrations.demo.PlacedCatalogVersion, 3);
    Assert.equal(saved.Placement!.Stage, "Cleanup");
    Assert.throws(() => P.commitPlacement(host, job.Id), /not writing/u);
    P.finishRecovery(host, job.Id);
    Assert.equal(P.load(host).Placement, undefined);
    Assert.deepEqual(P.load(host).Demonstrations.demo.PlacedRecipe!.Footprint, recipe.Footprint);
});

test("cancelled/failed placement preserves prior scene settings and retains failed restoration evidence", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 0,
        Bounds: Area,
        Arrival,
        References: {} });
    const previous = P.load(host).Demonstrations.demo;
    const { journal } = writing(host);
    P.requestRollback(host, journal.Id, "write failed");
    P.requestRollback(host, journal.Id, "native snapshot restore failed");
    Assert.equal(P.load(host).Placement!.Error, "native snapshot restore failed");
    Assert.deepEqual(P.load(host).Demonstrations.demo, previous);
    Assert.throws(() => P.saveWorld(host, P.load(host).Revision, false), /pending/u);
    P.finishRecovery(host, journal.Id);
    Assert.deepEqual(P.load(host).Demonstrations.demo, previous);
    Assert.throws(() => P.snapshotSaved(host, journal.Id, 0), /Stale/u);
});

test("a failed settings publication after writes remains a recoverable writing journal", () =>
{
    const host = memory();
    const { journal } = writing(host);
    host.fail((key) => key === DynamicProperty.Manifest);
    Assert.throws(() => P.commitPlacement(host, journal.Id), /Injected/u);
    host.fail();
    Assert.equal(P.load(host).Placement!.Stage, "Writing");
    Assert.equal(P.record(P.load(host), "demo").PlacedRecipe, undefined);
    P.requestRollback(host, journal.Id);
    P.finishRecovery(host, journal.Id);
});

test("selector recovery stores protected slots and survives disconnect/restart without native item data", () =>
{
    const host = memory();
    const saved = P.saveSelection(host, 0, "player", { PlayerId: "player",
        DemonstrationId: "demo",
        Dimension: Area.Dimension,
        ProtectedSlot: 8,
        SelectorItemId: "example:selector" });
    Assert.deepEqual(P.load(host).Selections, saved.Selections);
    Assert.throws(() => P.saveSelection(host, 0, "player"), /Stale/u);
    Assert.throws(() => P.saveSelection(host, 1, "player", { ...saved.Selections.player,
        ProtectedSlot: 1 }), /slot/u);
    P.saveSelection(host, 1, "player");
    Assert.deepEqual(P.load(host).Selections, {});
});

test("stable IDs preserve archived settings/colors/history through rename, reorder and changing requirements", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "one",
        Revision: 0,
        Bounds: Area,
        Arrival,
        References: { Input: Chest,
            Display: Actor } });
    P.saveGeneratedColor(host, "one", 1, { red: 0.4,
        green: 0.6,
        blue: 0.8 });
    P.recordOutcome(host, "one", 2, "Succeeded");
    P.saveConfiguration(host, { Id: "archived",
        Revision: 0,
        References: {} });
    const original = P.load(host);
    const demo = Demonstration({ Id: "one",
        Name: "Renamed",
        Description: "",
        References: { Input: Block },
        GetState: () => ({ Status: Ready }) });
    const newDemo = Demonstration({ Id: "new",
        Name: "New",
        Description: "",
        GetState: () => ({ Status: Ready }) });
    const view = R.reconcile(original, [ newDemo, demo ], NoObjects);
    Assert.deepEqual(view.Demonstrations.map((value) => value.Id), [ "new", "one" ]);
    Assert.deepEqual(view.ArchivedIds, [ "archived" ]);
    Assert.equal(view.Total, 2);
    Assert.equal(view.Incomplete, 1);
    Assert.equal(view.Demonstrations[1].CompletionCount, 1);
    Assert.deepEqual(view.Demonstrations[1].Color, original.Demonstrations.one.GeneratedColor);
    Assert.deepEqual(Object.keys(view.Demonstrations[1].Configuration.References), [ "Input" ]);
    Assert.equal(view.Demonstrations[1].Completeness.Complete, true);
    Assert.equal(view.Demonstrations[1].Completeness.Available, false);
    Assert.ok(original.Demonstrations.one.Configuration.References.Display);
    const explicit = { ...demo,
        Color: { red: 0.7,
            green: 0.4,
            blue: 0.3 } };
    Assert.deepEqual(R.reconcile(original, [ explicit ], NoObjects).Demonstrations[0].Color, explicit.Color);
    Assert.deepEqual(P.load(host), original);
    const changed: R.Declaration = { ...demo,
        References: { Input: Entity,
            Added: Block } };
    const completeness = R.reconcile(original, [ changed ], NoObjects).Demonstrations[0].Completeness;
    Assert.equal(completeness.Missing, 1);
    Assert.equal(completeness.Invalid, 1);
});

test("typed handles resolve current bindings/objects, apply validators and distinguish unavailable from removed", () =>
{
    let config: Configuration = { Id: "demo",
        Revision: 0,
        References: { Input: Chest,
            Display: Actor } };
    const block = { dimension: { id: Area.Dimension },
        typeId: "minecraft:chest",
        isAir: false } as NativeBlock;
    const entity = { dimension: { id: Area.Dimension },
        typeId: "minecraft:armor_stand" } as NativeEntity;
    let status: "Available" | "Unloaded" | "Removed" = "Available";
    let seen = "";
    const resolver: R.Resolver = { Block: () => ({ Status: "Available",
        Value: block }),
    Entity: (binding) =>
    {
        seen = binding.Id;
        return status === "Available" ? { Status: "Available",
            Value: entity } : { Status: status };
    } };
    const handles = R.handles({ Input: Block,
        Display: Entity }, () => config, resolver,
    { Input: (value) => value.typeId === "minecraft:chest" });
    Assert.equal(handles.Input.Resolve(), block);
    Assert.equal(handles.Display.Resolve(), entity);
    config = { ...config,
        References: { ...config.References,
            Display: { ...Actor,
                Id: "replacement" } } };
    handles.Display.Resolve();
    Assert.equal(seen, "replacement");
    status = "Unloaded";
    Assert.equal(handles.Display.Resolve(), undefined);
    Assert.equal(R.resolve(Entity, Actor, resolver).Status, "Unloaded");
    status = "Removed";
    Assert.equal(R.resolve(Entity, Actor, resolver).Status, "Removed");
    Assert.equal(R.resolve(Block, Chest, resolver, () => false).Status, "Invalid");
    Assert.equal(R.resolve(Block, Chest, resolver, () =>
    {
        throw new Error("bad predicate");
    }).Status, "Invalid");
    Assert.equal(R.resolve(Entity, Chest, resolver).Status, "Invalid");
    for (const typeId of [ "minecraft:player", "minecraft:item" ])
    {
        Assert.equal(R.resolve(Entity, Actor, { ...resolver,
            Entity: () => ({ Status: "Available",
                Value: { ...entity,
                    typeId } as NativeEntity }) }).Status, "Invalid");
    }
});

test("required-field counts include only bounds/arrival, runnable trigger and current reference requirements", () =>
{
    const config: Configuration = { Id: "demo",
        Revision: 0,
        Bounds: Area,
        Arrival,
        References: {} };
    const staticDemo = { Id: "demo" };
    Assert.equal(R.completeness(staticDemo, config, NoObjects).Required, 2);
    Assert.equal(R.completeness(staticDemo, config, NoObjects).Complete, true);
    const runnable = { ...staticDemo,
        Run: async () => {} };
    Assert.equal(R.completeness(runnable, config, NoObjects).Missing, 1);
    Assert.equal(R.completeness(runnable, config, NoObjects).Required, 3);
    const control = { ...config,
        Trigger: Chest };
    Assert.equal(R.completeness(runnable, control, NoObjects).Complete, true);
    Assert.equal(R.completeness(runnable, control, NoObjects).Available, false);
    const resolver: R.Resolver = { ...NoObjects,
        Block: () => ({ Status: "Available",
            Value: {
                dimension: { id: Area.Dimension },
                typeId: "minecraft:stone_button",
                isAir: false
            } as NativeBlock }) };
    Assert.equal(R.completeness(runnable, control, resolver).Available, true);
});

test("omitted archived bindings survive later edits; clearing and native removal evidence are explicit", () =>
{
    const host = memory();
    P.saveConfiguration(host, { Id: "demo",
        Revision: 0,
        References: { Old: Actor,
            Current: Chest } });
    P.saveConfiguration(host, { Id: "demo",
        Revision: 1,
        Bounds: Area,
        References: { Current: Chest } });
    Assert.deepEqual(P.load(host).Demonstrations.demo.Configuration.References.Old, Actor);
    P.markEntityRemoved(host, Actor.Id);
    const removed = P.load(host).Demonstrations.demo.Configuration.References.Old;
    Assert.equal(R.resolve(Entity, removed, NoObjects).Status, "Removed");
    P.clearReference(host, "demo", 3, "Old");
    Assert.equal(Object.hasOwn(P.load(host).Demonstrations.demo.Configuration.References, "Old"), false);
    Assert.ok(P.load(host).Demonstrations.demo.Configuration.References.Current);
});

test("native adapters retain unloaded assignments, distinguish known removals and reject unknown dimensions", () =>
{
    const block = { dimension: { id: Area.Dimension },
        typeId: "minecraft:chest",
        isAir: false } as NativeBlock;
    let loaded = true;
    const native = {
        getDimension: (dimension: string) =>
        {
            if (dimension !== Area.Dimension)
            {
                throw new Error("invalid dimension");
            }

            return { getBlock: () => loaded ? block : undefined };
        },
        getEntity: () => undefined
    };
    const resolver = R.nativeResolver(native as unknown as Parameters<typeof R.nativeResolver>[0]);
    Assert.equal(R.resolve(Block, Chest, resolver).Status, "Available");
    loaded = false;
    Assert.equal(R.resolve(Block, Chest, resolver).Status, "Unloaded");
    Assert.equal(R.resolve(Entity, Actor, resolver).Status, "Unloaded");
    Assert.equal(R.resolve(Entity, Actor, R.nativeResolver(
        native as unknown as Parameters<typeof R.nativeResolver>[0], new Set([ Actor.Id ]))).Status, "Removed");
    const config: Configuration = { Id: "demo",
        Revision: 0,
        Bounds: { ...Area,
            Dimension: "invalid" },
        Arrival,
        References: {} };
    Assert.equal(R.completeness({ Id: "demo" }, config, resolver).Invalid, 1);
});
