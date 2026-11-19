/**
 * Prototype constructor, inventory isolation and restricted-host export tests.
 *
 * @module bedform/Test/Prototype.test
 *
 * @file      Prototype.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Tests retain contextual callback inference and domain-grouped expected values. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "../Source/Prototype/Demonstration.js";
import * as S from "../Source/Prototype/Structure.js";
import * as W from "../Source/Prototype/World.js";
import Assert from "node:assert/strict";
import type { ItemStack } from "@minecraft/server";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

/**
 * Supplies a native-stack-shaped cloneable value without importing the native game runtime.
 *
 * @category Tests
 * @since 1.0.0
 */
const stack = (amount: number): ItemStack =>
{
    return { amount,
        clone() { return stack(this.amount); } } as ItemStack;
};

/**
 * Fresh static definition used to probe runtime validation with untyped callers.
 *
 * @category Tests
 * @since 1.0.0
 */
const input = (): D.Input =>
{
    return { Id: "example",
        Name: "Example",
        Description: "",
        GetState: () => ({ Status: D.Ready }) };
};

test("constructor branding is nominal, non-enumerable, frozen and does not invoke callbacks", () =>
{
    let called = false;
    const refs = { Chest: D.Block } as const;
    const definition = D.Demonstration({ ...input(),
        References: refs,
        GetState: () =>
        {
            called = true;
            return { Status: D.Ready };
        } });
    Assert.equal(called, false);
    Assert.deepEqual(Object.getOwnPropertyDescriptor(definition, D.TypeId), {
        value: definition[D.TypeId],
        writable: false,
        enumerable: false,
        configurable: false
    });
    Assert.ok(Object.isFrozen(definition));
    Assert.ok(Object.isFrozen(definition.References));
    Assert.notEqual(definition.References, refs);
    Assert.equal(Object.keys(definition).includes(String(D.TypeId)), false);
    Assert.equal(JSON.stringify(definition).includes("TypeId"), false);
});

test("constructor rejects malformed identity, callbacks, kinds and validators", () =>
{
    const invalid: Array<unknown> = [
        null, { ...input(),
            Id: " " }, { ...input(),
            Id: " example" }, { ...input(),
            Name: "" },
        { ...input(),
            Description: 3 }, { ...input(),
            GetState: undefined },
        { ...input(),
            Run: 1 }, { ...input(),
            OnCleanup: () => {} },
        { ...input(),
            References: { Chest: Symbol("Block") } },
        { ...input(),
            References: { "": D.Block } },
        { ...input(),
            References: { Chest: D.Block },
            Validators: { Missing: () => true } },
        { ...input(),
            References: { Chest: D.Block },
            Validators: { Chest: true } }
    ];
    for (const value of invalid)
    {
        Assert.throws(() => D.Demonstration(value as D.Input), TypeError);
    }
});

test("world registration retains order, rejects duplicates and copies configured inventories", () =>
{
    const first = D.Demonstration(input());
    const second = D.Demonstration({ ...input(),
        Id: "second" });
    const demos = [ first, second ];
    const original = stack(5);
    const world = W.World({ Demonstrations: demos,
        Inventory: { Hotbar: [ original ] } });
    demos.reverse();
    original.amount = 20;
    Assert.deepEqual(world.Demonstrations.map((demo) => demo.Id), [ "example", "second" ]);
    Assert.equal(world.Inventory?.Hotbar?.[0]?.amount, 5);
    Assert.throws(() => W.World({ Demonstrations: [ first, first ] }), /duplicate/u);
    Assert.throws(() => W.World({ Demonstrations: [ input() as unknown as D.Registered ] }), /Invalid/u);
});

test("inventory maps index zero to slot one, splits at eight, pads clearing slots and clones", () =>
{
    const world = W.World({ Demonstrations: [] });
    const items = Array.from({ length: 35 }, (_, index) => stack(index + 1));
    const full = W.withInventory(world, items);
    Assert.equal(world.Inventory, undefined);
    Assert.equal(full.Inventory?.Hotbar?.length, 8);
    Assert.equal(full.Inventory?.Main?.length, 27);
    Assert.equal(full.Inventory?.Hotbar?.[0]?.amount, 1);
    Assert.equal(full.Inventory?.Hotbar?.[7]?.amount, 8);
    Assert.equal(full.Inventory?.Main?.[0]?.amount, 9);
    Assert.equal(full.Inventory?.Main?.[26]?.amount, 35);
    items[0].amount = 99;
    Assert.equal(full.Inventory?.Hotbar?.[0]?.amount, 1);
    const hotbarOnly = W.withHotbarInventory(world, [ stack(4) ]);
    Assert.equal(hotbarOnly.Inventory?.Main, undefined);
    Assert.deepEqual(hotbarOnly.Inventory?.Hotbar?.slice(1), Array(7).fill(undefined));
    const mainOnly = W.withMainInventory(world, []);
    Assert.equal(mainOnly.Inventory?.Hotbar, undefined);
    Assert.equal(mainOnly.Inventory?.Main?.length, 27);
    const updated = W.withMainInventory(full, [ stack(40) ]);
    updated.Inventory!.Hotbar![0]!.amount = 60;
    Assert.equal(full.Inventory?.Hotbar?.[0]?.amount, 1);
    Assert.equal(updated.Inventory?.Main?.[0]?.amount, 40);
    const replaced = W.withInventory(updated, []);
    Assert.ok(replaced.Inventory?.Hotbar?.every((item) => item === undefined));
    Assert.ok(replaced.Inventory?.Main?.every((item) => item === undefined));
    Assert.throws(() => W.withInventory(world, Array(36)), RangeError);
    Assert.throws(() => W.withHotbarInventory(world, Array(9)), RangeError);
    Assert.throws(() => W.withMainInventory(world, Array(28)), RangeError);
});

test("structure presets and defaults preserve independent materials and interior dimensions", () =>
{
    Assert.deepEqual(Object.values(S.Presets).map((preset) => [ preset.InteriorSize, preset.BorderedSize ]),
        [ [ 7, 9 ], [ 17, 19 ], [ 25, 27 ] ]);
    Assert.equal(S.Defaults.Size, "Medium");
    Assert.equal(S.Defaults.InteriorHeight, 3);
    Assert.equal(S.Defaults.IncludeMainCeiling, false);
    Assert.deepEqual(Object.values(S.Defaults.Materials), [
        "minecraft:iron_block", "minecraft:stone", "minecraft:polished_andesite",
        "minecraft:glass", "minecraft:glass", "minecraft:smooth_stone_slab"
    ]);
    Assert.ok(Object.isFrozen(S.Defaults.Materials));
});

test("game entrypoints bundle without native, Node, host, web or Effect runtime dependencies", async () =>
{
    const result = await build({ bundle: true,
        format: "iife",
        platform: "neutral",
        metafile: true,
        stdin: { contents: `
            import * as P from "bedform/Prototype";
            import * as D from "bedform/Prototype/Demonstration";
            import * as W from "bedform/Prototype/World";
            import * as I from "bedform/Prototype/Interaction";
            import * as S from "bedform/Prototype/Structure";
            const demo = D.Demonstration({Id:"test",Name:"Test",Description:"",
                GetState:()=>({Status:P.Ready})});
            globalThis.proof = [W.World({Demonstrations:[demo]}).Demonstrations.length,
                S.Defaults.InteriorHeight,Object.keys(I).length];
        `,
        resolveDir: fileURLToPath(new URL("..", import.meta.url)) },
        write: false });
    Assert.ok(Object.keys(result.metafile.inputs).every((path) =>
        !/node_modules|\/Host|\/Build\//u.test(path)));
    const sandbox = { proof: undefined,
        process: undefined,
        Buffer: undefined,
        console: undefined,
        URL: undefined,
        setTimeout: undefined };
    runInNewContext(result.outputFiles[0].text, sandbox);
    Assert.deepEqual(Array.from(sandbox.proof as unknown as Array<number>), [ 1, 3, 0 ]);
});

test("entity bindings exclude players and item drops", () =>
{
    Assert.equal(D.isBindableEntity({ typeId: "minecraft:player" }), false);
    Assert.equal(D.isBindableEntity({ typeId: "minecraft:item" }), false);
    Assert.equal(D.isBindableEntity({ typeId: "minecraft:armor_stand" }), true);
});
