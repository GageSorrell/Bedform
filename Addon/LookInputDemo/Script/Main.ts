/**
 * A fixed external camera with body rotation blocked and look permission retained.
 *
 * @module @sorrell/look-input-demo/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DynamicProperty, TickingArea, ToggleItem } from "./Keys.js";
import { Fraction, MeasureLook } from "./Look.js";
import { FreezeCamera, RestoreCamera } from "./Camera.js";
import { InputPermissionCategory, ItemStack, system, world } from "@minecraft/server";
import type { ItemUseAfterEvent, Player, PlayerLeaveAfterEvent,
    PlayerSpawnAfterEvent, Vector2 } from "@minecraft/server";
import type { LookState } from "./Look.js";
interface Session
{
    player: Player;
    look: LookState;
    movement: boolean;
    camera: boolean;
    dimension: string;
    startRotation: Readonly<Vector2>;
}
const Sessions = new Map<string, Session>();
const LastUse = new Map<string, number>();

/**
 * Displays rotation deltas in degrees per tick and corrects pitch or yaw through teleport.
 * Estimates bridge wrap corrections and are marked separately from direct measurements.
 *
 * @category Running
 * @since 1.0.6
 */
export function UpdateLook(player: Player, state: LookState): void
{
    const sample = MeasureLook(state, player.getRotation());
    const horizontal = Fraction(sample.delta.x);
    const vertical = Fraction(sample.delta.y);
    const approximation = sample.estimated ? "≈ " : "";
    player.onScreenDisplay.setActionBar(
        `Rotation delta (yaw, pitch): ${approximation}(${horizontal} °, ${vertical} °)/tick`);
    if (sample.resetRotation)
    {
        // Send an explicit rotation correction to the owning player through teleport.
        player.teleport(player.location, { rotation: sample.resetRotation });
    }
}

/**
 * Restores the activation rotation before normal rendering, then restores saved permissions.
 * A same-position teleport sends the correction without returning to the activation position.
 *
 * @category ResourceManagement
 * @since 1.0.12
 */
export function Disable(player: Player): void
{
    const session = Sessions.get(player.id);
    if (session)
    {
        player.teleport(player.location, { rotation: session.startRotation });
    }

    RestoreCamera(player.camera);
    player.triggerEvent("look_demo:unlock");
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement,
        session?.movement ?? true);
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, session?.camera ?? true);
    player.onScreenDisplay.setActionBar("");
    player.setDynamicProperty(DynamicProperty.Active, undefined);
    Sessions.delete(player.id);
}

/**
 * Stops existing motion, captures the engine's eye-anchored view once, and measures rotation changes.
 * Camera input remains enabled. Translation permission is disabled and a same-position
 * teleport corrects the client's existing movement prediction.
 *
 * @throws { Error } If the engine rejects the camera or player changes.
 *
 * @category ResourceManagement
 * @since 1.0.11
 */
export function Enable(player: Player): void
{
    const rotation = player.getRotation();
    const position = player.location;
    const session: Session = {
        camera: player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Camera),
        dimension: player.dimension.id,
        look: { previousRotation: rotation,
            resetPendingTicks: 0,
            yawOrigin: rotation.y },
        movement: player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Movement),
        player,
        startRotation: { x: rotation.x,
            y: rotation.y }
    };
    Sessions.set(player.id, session);
    // Persist before changing permissions so a reconnect can recover an interrupted session.
    player.setDynamicProperty(DynamicProperty.Active, true);
    try
    {
        player.triggerEvent("look_demo:lock");
        player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
        player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
        player.clearVelocity();
        player.teleport(position, { rotation });
        FreezeCamera(player);
        player.onScreenDisplay.setActionBar("Rotation delta (yaw, pitch): (0.000 °, 0.000 °)/tick");
    }
    catch (error)
    {
        Disable(player);
        throw error;
    }
}

world.afterEvents.itemUse.subscribe(({ source, itemStack }: ItemUseAfterEvent) =>
{
    if (itemStack.typeId !== ToggleItem || system.currentTick - (LastUse.get(source.id) ?? -20) < 5)
    {
        return;
    }

    LastUse.set(source.id, system.currentTick);
    if (Sessions.has(source.id))
    {
        Disable(source);
        source.sendMessage("Look demo OFF");
    }
    else
    {
        Enable(source);
        source.sendMessage("Look demo ON: fixed camera; vector = (yaw, pitch) degrees per tick.");
    }
});
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }: PlayerSpawnAfterEvent) =>
{
    if (Sessions.has(player.id) || player.getDynamicProperty(DynamicProperty.Active))
    {
        Disable(player);
    }
    else
    {
        player.triggerEvent("look_demo:unlock");
    }

    const container = player.getComponent("minecraft:inventory")?.container;
    if (container)
    {
        let found = false;
        for (let slot = 0; slot < container.size; slot++)
        {
            found ||= container.getItem(slot)?.typeId === ToggleItem;
        }

        if (!found)
        {
            const item = new ItemStack(ToggleItem);
            item.keepOnDeath = true;
            const overflow = container.addItem(item);
            if (overflow)
            {
                player.dimension.spawnItem(overflow, player.location);
            }
        }
    }

    if (initialSpawn)
    {
        player.teleport({ x: 0.5,
            y: -60,
            z: 0.5 }, { rotation: { x: 0,
            y: 0 } });
        player.sendMessage("Select Look Input Toggle. In first-person, tap Use to lock the view, " +
            "move your mouse/stick, then tap Use again to unlock. " +
            "Vector is measured rotation, not raw device input.");
    }
});
world.afterEvents.playerLeave.subscribe(({ playerId }: PlayerLeaveAfterEvent) =>
{
    Sessions.delete(playerId);
    LastUse.delete(playerId);
});
system.runInterval(() =>
{
    for (const session of Sessions.values())
    {
        const { look, player } = session;
        if (!player.isValid)
        {
            Sessions.delete(player.id);
            continue;
        }

        if (player.dimension.id !== session.dimension)
        {
            Disable(player);
            continue;
        }

        try
        {
            UpdateLook(player, look);
        }
        catch (error)
        {
            console.error(`Look demo stopped for ${player.name}: ${String(error)}`);
            Disable(player);
        }
    }
}, 1);
system.run(() =>
{
    const dimension = world.getDimension("overworld");
    dimension.runCommand(`tickingarea add circle 0 -60 0 2 ${TickingArea.Scene}`);
    system.runTimeout(() =>
    {
        dimension.runCommand("fill -12 -61 -12 12 -61 12 smooth_stone");
        dimension.runCommand("fill -8 -60 8 8 -55 8 stonebrick");
        for (let x = -6; x <= 6; x += 3)
        {
            dimension.runCommand(`fill ${x} -60 7 ${x} -56 7 sea_lantern`);
        }

        world.setDefaultSpawnLocation({ x: 0,
            y: -60,
            z: 0 });
        world.setTimeOfDay(6_000);
        world.gameRules.doDayLightCycle = false;
        world.gameRules.doMobSpawning = false;
        console.warn("LOOK_INPUT_DEMO_READY");
    }, 40);
});
