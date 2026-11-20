/**
 * Native safety checks for generated Canvas actors and successful widget particle/tint forwarding.
 *
 * @module bedform-canvas/Test/Native/Widgets
 *
 * @file      Widgets.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native evidence retains semantic field order and contextual callbacks. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import * as Surface from "bedform/Canvas/Surface";
import type { Dimension, Entity } from "@minecraft/server";
import { ItemStack, MolangVariableMap, system } from "@minecraft/server";
import { WidgetEntity, WidgetImages } from "../../Public/Widget.generated.js";
import type { SimulatedPlayer } from "@minecraft/server-gametest";

/**
 * Checks actor persistence without drift, equipment replacement/removal without drops, no item
 * pickup and unobstructed player movement, then emits all widget particles through the shared API.
 * Actor-backed privacy, inventory pose and actual pixel appearance belong to later client tests.
 *
 * @throws { Error } If a native safety or resource-load assertion fails.
 *
 * @category Testing
 * @since 1.0.1
 */
export async function QualifyWidgets(dimension: Dimension, player: SimulatedPlayer): Promise<unknown>
{
    const wait = (ticks: number): Promise<void> =>
        new Promise((resolve) => system.runTimeout(resolve, ticks));
    const check = (condition: unknown, message: string): void =>
    {
        if (!condition)
        {
            throw new Error(`Widget native: ${message}`);
        }
    };

    const actors: Array<Entity> = [];
    const original = player.location;
    const location = { x: 20.5,
        y: -60,
        z: 0.5 };
    let dropped: Entity | undefined;
    try
    {
        for (const id of Object.values(WidgetEntity))
        {
            actors.push(dimension.spawnEntity(id, location));
        }

        const holder = actors[1];
        const equipmentApi = holder.getComponent("minecraft:equippable") !== undefined;
        for (const item of [ "minecraft:stone", "minecraft:stick" ])
        {
            const replaced = holder.runCommand(`replaceitem entity @s slot.weapon.mainhand 0 ${item} 1`);
            check(replaced.successCount === 1,
                `native mainhand replacement failed for ${item}`);
            check(holder.runCommand(`testfor @s[hasitem={item=${item},location=slot.weapon.mainhand}]`)
                .successCount === 1, `native mainhand does not contain ${item}`);
        }

        const before = actors.map((actor) => actor.location);
        dropped = dimension.spawnItem(new ItemStack("minecraft:diamond", 1), location);
        await wait(40);
        check(dropped.isValid, "a proxy picked up the nearby item");
        actors.forEach((actor, index) =>
        {
            check(actor.isValid, "actor vanished without explicit disposal");
            check(Math.hypot(actor.location.x - before[index].x, actor.location.y - before[index].y,
                actor.location.z - before[index].z) < 0.001, "actor wandered, fell or was pushed");
            actor.applyDamage(100);
            check(actor.isValid, "proxy took damage");
            check(actor.getComponent("minecraft:health")?.currentValue === 1, "proxy health changed");
        });
        dropped.remove();
        dropped = undefined;
        player.teleport({ ...location,
            x: location.x - 2 });
        player.moveToLocation({ ...location,
            x: location.x + 2 }, { speed: 1 });
        await wait(60);
        player.stopMoving();
        check(player.location.x > location.x + 0.5, "presentation proxies blocked player movement");
        holder.remove();
        await wait(5);
        check(dimension.getEntities({ type: "minecraft:item",
            location,
            maxDistance: 4 }).length === 0,
        "removing the equipped holder dropped items");
        const doomed = dimension.spawnEntity(WidgetEntity.ItemHolder, location);
        actors.push(doomed);
        doomed.runCommand("replaceitem entity @s slot.weapon.mainhand 0 minecraft:stone 1");
        check(doomed.kill(), "forced holder death failed");
        await wait(10);
        check(dimension.getEntities({ type: "minecraft:item",
            location,
            maxDistance: 4 }).length === 0,
        "forced holder death dropped equipment or loot");
        const variants: Array<Surface.TintInput | undefined> = [
            undefined, "#4D4D4D", "#19A7D3", "#3ACB7280"
        ];
        const observed: Array<Surface.Rgba> = [];
        for (const tint of variants)
        {
            const report = Surface.Emit({ Viewers: [ player ],
                Dimension: dimension.id,
                Pose: { Position: { ...location,
                    y: location.y + 2 },
                Scale: 1 / 16,
                Orientation: { Right: { x: 1,
                    y: 0,
                    z: 0 },
                Up: { x: 0,
                    y: 1,
                    z: 0 } } },
                Content: { Kind: "viewport",
                    Clip: { X: 0,
                        Y: 0,
                        Width: 400,
                        Height: 16 },
                    Children: Object.values(WidgetImages).map(({ Image }, index) => ({ Kind: "sprite",
                        Particle: Image.Particle,
                        Bounds: { X: index * 4,
                            Y: 0,
                            Width: 4,
                            Height: 4 },
                        UV: { X: 0,
                            Y: 0,
                            Width: Image.Width,
                            Height: Image.Height },
                        Tint: tint })) },
                CreateVariables: () =>
                {
                    const map = new MolangVariableMap();
                    const set = map.setColorRGBA.bind(map);
                    map.setColorRGBA = (name, color): void =>
                    {
                        observed.push({ ...color });
                        set(name, color);
                    };

                    return map;
                } });
            check(report.Errors.length === 0 && report.Spawned === Object.keys(WidgetImages).length,
                `native particle emission failed: ${report.Errors.map(String).join("; ")}`);
        }

        check(observed.length === Object.keys(WidgetImages).length * variants.length,
            "tint was not forwarded");
        check(JSON.stringify(observed[0]) === JSON.stringify(observed[Object.keys(WidgetImages).length]),
            "omitted tint differs from explicit dark gray");
        return { Actors: Object.values(WidgetEntity),
            Equipment: [ "minecraft:stone", "minecraft:stick" ],
            EquipmentApi: equipmentApi,
            EquipmentMutation: "replaceitem; hasitem mainhand verified",
            DriftTicks: 40,
            WalkedThrough: true,
            NoPickup: true,
            NoDropsOnRemove: true,
            NoDropsOnDeath: true,
            Particles: Object.keys(WidgetImages).length,
            TintCalls: observed.length,
            Audience: "World-visible actors; no private-actor claim",
            ClientAppearance: false };
    }
    finally
    {
        player.stopMoving();
        player.teleport(original);
        if (dropped?.isValid)
        {
            dropped.remove();
        }

        for (const actor of actors)
        {
            if (actor.isValid)
            {
                actor.remove();
            }
        }
    }
}
