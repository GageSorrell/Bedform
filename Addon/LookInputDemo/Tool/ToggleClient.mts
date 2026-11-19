/**
 * Physical-client event recorder for the unqualified entity Use bridge.
 *
 * @module @sorrell/look-input-demo/Tool/ToggleClient
 *
 * @file      ToggleClient.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DynamicProperty, ProbeEntity, ScriptEvent, TickingArea } from "./ToggleKeys.mjs";
import type { Entity, EntityDieAfterEvent, Player, PlayerInteractWithEntityBeforeEvent,
    PlayerLeaveAfterEvent, PlayerSpawnAfterEvent, ScriptEventCommandMessageAfterEvent,
    Vector2 } from "@minecraft/server";
import { FreezeCamera, RestoreCamera } from "../Script/Camera.js";
import { InputPermissionCategory, system, world } from "@minecraft/server";
import type { LookState } from "../Script/Look.js";
import { MeasureLook } from "../Script/Look.js";

interface Capture
{
    camera: boolean;
    dimension: string;
    expires: number;
    helper?: Entity;
    look: LookState;
    movement: boolean;
    player: Player;
    rotation: Vector2;
}

let Session: Capture | undefined;
let Target: Entity | undefined;
let Helpers = false;

/**
 * Attempts every cleanup operation even if an earlier engine call fails.
 *
 * @category ResourceManagement
 * @since 1.0.12
 */
function Reset(): void
{
    const session = Session;
    Session = undefined;
    if (!session)
    {
        return;
    }

    const { player } = session;
    const actions = [
        () => session.helper?.isValid && session.helper.remove(),
        () => player.teleport(player.location, { rotation: session.rotation }),
        () => RestoreCamera(player.camera),
        () => player.triggerEvent("look_demo:unlock"),
        () => player.inputPermissions.setPermissionCategory(
            InputPermissionCategory.Movement, session.movement),
        () => player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, session.camera),
        () => player.onScreenDisplay.setActionBar("")
    ];
    for (const action of actions)
    {
        try
        {
            action();
        }
        catch (error)
        {
            console.warn(`TOGGLE_CLIENT_CLEANUP ${String(error)}`);
        }
    }

    console.warn("TOGGLE_CLIENT_RESET");
}

world.beforeEvents.playerInteractWithEntity.subscribe((event: PlayerInteractWithEntityBeforeEvent) =>
{
    if (event.target.id !== Target?.id && event.target.id !== Session?.helper?.id)
    {
        return;
    }

    event.cancel = true;
    console.warn("TOGGLE_CLIENT_USE " + JSON.stringify({
        first: Reflect.get(event, "isFirstEvent") ?? null,
        helper: event.target.id === Session?.helper?.id,
        mode: event.player.inputInfo.lastInputModeUsed,
        owner: event.player.id === Session?.player.id,
        player: event.player.name,
        rotation: event.player.getRotation(),
        tick: system.currentTick
    }));
    const player = event.player;
    system.run(() =>
    {
        if (Session || !player.isValid)
        {
            return;
        }

        const rotation = player.getRotation();
        Session = {
            camera: player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Camera),
            dimension: player.dimension.id,
            expires: system.currentTick + 600,
            look: { previousRotation: rotation,
                resetPendingTicks: 0,
                yawOrigin: rotation.y },
            movement: player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Movement),
            player,
            rotation
        };
        try
        {
            player.triggerEvent("look_demo:lock");
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
            player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
            player.clearVelocity();
            player.teleport(player.location, { rotation });
            FreezeCamera(player);
            if (Helpers)
            {
                Session.helper = player.dimension.spawnEntity(ProbeEntity, player.location);
                Session.helper.setDynamicProperty(DynamicProperty.Owner, player.id);
            }

            player.sendMessage("Recording raw Use events for 30 seconds. " +
                "No release classifier is qualified. " +
                "The console can reset capture; your inventory is untouched.");
        }
        catch (error)
        {
            Reset();
            console.error(`TOGGLE_CLIENT_ACTIVATION ${String(error)}`);
        }
    });
});
system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent) =>
{
    if (event.id === ScriptEvent.Reset || event.id === ScriptEvent.Helper)
    {
        Reset();
        if (event.id === ScriptEvent.Helper)
        {
            Helpers = event.message === "on";
        }

        console.warn(`TOGGLE_CLIENT_HELPER ${Helpers}`);
    }
});
world.afterEvents.playerLeave.subscribe((event: PlayerLeaveAfterEvent) =>
{
    if (event.playerId === Session?.player.id)
    {
        Reset();
    }
});
world.afterEvents.playerSpawn.subscribe((event: PlayerSpawnAfterEvent) =>
{
    if (event.player.id === Session?.player.id)
    {
        Reset();
    }

    // This disposable laboratory starts every arrival with ordinary permissions.
    // Also recovers a reconnect after an invalid player handle prevented Reset's calls.
    event.player.triggerEvent("look_demo:unlock");
    RestoreCamera(event.player.camera);
    event.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
    event.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
});
world.afterEvents.entityDie.subscribe((event: EntityDieAfterEvent) =>
{
    if (event.deadEntity.id === Session?.player.id)
    {
        Reset();
    }
});
system.runInterval(() =>
{
    const session = Session;
    if (!session)
    {
        return;
    }

    try
    {
        const { player } = session;
        if (!player.isValid || player.dimension.id !== session.dimension ||
            system.currentTick >= session.expires || !Target?.isValid)
        {
            Reset();
            return;
        }

        const sample = MeasureLook(session.look, player.getRotation());
        if (sample.resetRotation)
        {
            player.teleport(player.location, { rotation: sample.resetRotation });
        }

        if (session.helper)
        {
            const head = player.getHeadLocation();
            const direction = player.getViewDirection();
            session.helper.teleport({ x: head.x + direction.x * 1.5,
                y: head.y + direction.y * 1.5 - 0.9,
                z: head.z + direction.z * 1.5 });
        }

        player.onScreenDisplay.setActionBar("Use event recorder — automatic reset after 30 seconds");
    }
    catch (error)
    {
        Reset();
        console.error(`TOGGLE_CLIENT_UPDATE ${String(error)}`);
    }
}, 1);
system.run(() =>
{
    const dimension = world.getDimension("overworld");
    dimension.runCommand(`tickingarea add circle 0 -60 0 2 ${TickingArea.Scene}`);
    system.runTimeout(() =>
    {
        dimension.runCommand("fill -8 -61 -8 8 -61 8 smooth_stone");
        dimension.runCommand("setblock 0 -61 2 gold_block");
        // A fresh world is used each launch, so no actor or recovery data is adopted.
        Target = dimension.spawnEntity(ProbeEntity, { x: 0.5,
            y: -60,
            z: 2.5 });
        world.setDefaultSpawnLocation({ x: 0,
            y: -60,
            z: 0 });
        world.gameRules.doMobSpawning = false;
        console.warn("TOGGLE_CLIENT_READY: invisible target above gold at 0.5 -60 2.5; " +
            "console: tp @a 0.5 -60 0.5 facing 0.5 -59 2.5");
    }, 40);
});
