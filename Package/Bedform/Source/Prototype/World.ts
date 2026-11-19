/**
 * Ordered prototype-world definitions and slot-zero-preserving inventory composition.
 *
 * @module bedform/Prototype/World
 *
 * @file      World.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ItemStack } from "@minecraft/server";
import type { Registered } from "./Demonstration.js";
import { TypeId } from "./Demonstration.js";

/**
 * Configured sections clear unspecified slots; absent sections leave current inventory alone.
 * Hotbar maps to slots 1 through 8, main inventory to slots 9 through 35.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Inventory
{
    readonly Hotbar?: ReadonlyArray<ItemStack | undefined>;
    readonly Main?: ReadonlyArray<ItemStack | undefined>;
}

/**
 * Default export of a dedicated prototype entrypoint; registration order controls navigation and overlap.
 *
 * @category Types
 * @since 1.0.0
 */
export interface World<Demonstrations extends ReadonlyArray<Registered> = ReadonlyArray<Registered>>
{
    readonly Demonstrations: Demonstrations;
    readonly Inventory?: Inventory;
}

/**
 * Validates ordered registration without evaluating getters or starting demonstrations.
 *
 * @throws { TypeError } When demonstration IDs are duplicated or values are unbranded.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const World = <const Demonstrations extends ReadonlyArray<Registered>>(
    definition: World<Demonstrations>): World<Demonstrations> =>
{
    const ids = new Set<string>();
    for (const demonstration of definition.Demonstrations)
    {
        if (typeof demonstration[TypeId] !== "function" || ids.has(demonstration.Id))
        {
            throw new TypeError(`Invalid or duplicate demonstration: ${demonstration.Id}`);
        }

        ids.add(demonstration.Id);
    }

    return Object.freeze({ ...definition,
        Demonstrations: Object.freeze([ ...definition.Demonstrations ]) as unknown as Demonstrations,
        ...(definition.Inventory ? { Inventory: cloneInventory(definition.Inventory) } : {}) });
};

/**
 * Clones and pads a section so later application clears unspecified slots deterministically.
 *
 * @throws { RangeError } When a configured section exceeds its capacity.
 *
 * @category Internal
 * @since 1.0.0
 */
const section = (items: ReadonlyArray<ItemStack | undefined>, capacity: number):
ReadonlyArray<ItemStack | undefined> =>
{
    if (items.length > capacity)
    {
        throw new RangeError(`Inventory section accepts at most ${capacity} items`);
    }

    return Object.freeze(Array.from({ length: capacity },
        (_: unknown, index: number) => items[index]?.clone()));
};

/**
 * Copies configured sections without claiming native stacks themselves are immutable.
 *
 * @category Internal
 * @since 1.0.0
 */
const cloneInventory = (inventory: Inventory): Inventory =>
{
    return Object.freeze({
        ...(inventory.Hotbar ? { Hotbar: section(inventory.Hotbar, 8) } : {}),
        ...(inventory.Main ? { Main: section(inventory.Main, 27) } : {})
    });
};

/**
 * Replaces both sections, mapping the first supplied stack to slot 1 and preserving slot 0.
 * Supplied stacks are cloned; missing positions clear the configured sections.
 *
 * @throws { RangeError } When more than 35 stacks are supplied.
 *
 * @category Inventory
 * @since 1.0.0
 */
export const withInventory = <Demonstrations extends ReadonlyArray<Registered>>(
    world: World<Demonstrations>, items: ReadonlyArray<ItemStack | undefined>): World<Demonstrations> =>
{
    if (items.length > 35)
    {
        throw new RangeError("Full inventory accepts at most 35 items");
    }

    return Object.freeze({ ...world,
        Inventory: cloneInventory({ Hotbar: items.slice(0, 8),
            Main: items.slice(8) }) });
};

/**
 * Replaces slots 1 through 8; an unconfigured main section stays unconfigured.
 * Both the supplied stacks and any retained configured section are cloned.
 *
 * @throws { RangeError } When more than eight stacks are supplied.
 *
 * @category Inventory
 * @since 1.0.0
 */
export const withHotbarInventory = <Demonstrations extends ReadonlyArray<Registered>>(
    world: World<Demonstrations>, items: ReadonlyArray<ItemStack | undefined>): World<Demonstrations> =>
{
    return Object.freeze({ ...world,
        Inventory: cloneInventory({ ...world.Inventory,
            Hotbar: items }) });
};

/**
 * Replaces slots 9 through 35; an unconfigured hotbar stays unconfigured.
 * Both the supplied stacks and any retained configured section are cloned.
 *
 * @throws { RangeError } When more than 27 stacks are supplied.
 *
 * @category Inventory
 * @since 1.0.0
 */
export const withMainInventory = <Demonstrations extends ReadonlyArray<Registered>>(
    world: World<Demonstrations>, items: ReadonlyArray<ItemStack | undefined>): World<Demonstrations> =>
{
    return Object.freeze({ ...world,
        Inventory: cloneInventory({ ...world.Inventory,
            Main: items }) });
};
