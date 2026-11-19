/**
 * Native simulated-player acceptance probe, excluded from the demonstration pack.
 *
 * @module @sorrell/look-input-demo/Tool/NativeFixture
 *
 * @file      NativeFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import "../Script/Main.js";
import { Disable, Enable, UpdateLook } from "../Script/Main.js";
import { DynamicProperty, ToggleItem } from "../Script/Keys.js";
import { GameMode, InputPermissionCategory, system, world } from "@minecraft/server";
import type { ItemUseAfterEvent } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";
const Wait = (ticks: number) => new Promise<void>((resolve: () => void) =>
    system.runTimeout(resolve, ticks));
system.runTimeout(() =>
{
    void (async () =>
    {
        const player = spawnSimulatedPlayer({ dimension: world.getDimension("overworld"),
            x: 0.5,
            y: -60,
            z: 0.5 }, "LookProbe", GameMode.Creative);
        let exitRotation: ReturnType<typeof player.getRotation> | undefined;
        // Observe after Main's Use handler, before the simulated driver's later pitch updates.
        const captureExit = world.afterEvents.itemUse.subscribe(({ source }: ItemUseAfterEvent) =>
        {
            if (source.id === player.id && !player.getDynamicProperty(DynamicProperty.Active))
            {
                exitRotation = player.getRotation();
            }
        });
        try
        {
            await Wait(10);
            const inventory = player.getComponent("minecraft:inventory")!.container!;
            const item = inventory.getItem(0);
            if (item?.typeId !== ToggleItem)
            {
                throw new Error("Spawn did not supply the toggle item in the empty inventory");
            }

            if (player.getDynamicProperty(DynamicProperty.Active))
            {
                throw new Error("Player did not start OFF");
            }

            for (let cycle = 0; cycle < 4; cycle++)
            {
                player.setRotation({ x: cycle % 2 === 0 ? 20 : -35,
                    y: cycle % 2 === 0 ? 30 : -120 });
                const used = player.useItem(inventory.getItem(0)!);
                console.warn(`Native cycle ${cycle}: use=${used} tick=${system.currentTick}`);
                await Wait(3);
                const enabled = cycle % 2 === 0;
                if (!enabled && (!exitRotation || Math.abs(exitRotation.x - 20) > 0.01 ||
                    Math.abs(exitRotation.y - 30) > 0.01))
                {
                    throw new Error("Native Use OFF did not restore activation pitch/yaw: " +
                        JSON.stringify(exitRotation));
                }

                if (Boolean(player.getDynamicProperty(DynamicProperty.Active)) !== enabled)
                {
                    throw new Error(`Native Use cycle ${cycle} failed to toggle: active=` +
                        String(player.getDynamicProperty(DynamicProperty.Active)));
                }

                if (!player.inputPermissions.isPermissionCategoryEnabled(InputPermissionCategory.Camera) ||
                    player.inputPermissions.isPermissionCategoryEnabled(
                        InputPermissionCategory.Movement) === enabled)
                {
                    throw new Error("Wrong camera/movement permissions");
                }

                if (enabled)
                {
                    // Synthetic rotation validates the measurement loop, not physical mouse processing.
                    player.setRotation({ x: -4.2819,
                        y: 3.5299 });
                    UpdateLook(player, { previousRotation: { x: 0,
                        y: 0 },
                    resetPendingTicks: 0,
                    yawOrigin: 0 });
                    if (Math.abs(player.getRotation().x + 4.2819) > 0.01 ||
                        Math.abs(player.getRotation().y - 3.5299) > 0.01)
                    {
                        throw new Error("Ordinary pitch/yaw was unexpectedly reset");
                    }

                    for (const pitch of [ 84.9, -84.9, 85, -85, 89, -89 ])
                    {
                        player.setRotation({ x: pitch,
                            y: 30 });
                        const state = { previousRotation: { x: 0,
                            y: 0 },
                        resetPendingTicks: 0,
                        yawOrigin: 30 };
                        const before = player.location;
                        UpdateLook(player, state);
                        const expectedPitch = Math.abs(pitch) >= 85 ? 0 : pitch;
                        const actual = player.getRotation();
                        if (Math.abs(actual.x - expectedPitch) > 0.01 || Math.abs(actual.y - 30) > 0.01)
                        {
                            throw new Error(`Pitch-limit reset failed for ${pitch}: ` +
                                JSON.stringify(actual));
                        }

                        if (Math.abs(player.location.x - before.x) > 0.01 ||
                            Math.abs(player.location.y - before.y) > 0.01 ||
                            Math.abs(player.location.z - before.z) > 0.01)
                        {
                            throw new Error("Pitch correction moved the player");
                        }

                        if (Math.abs(pitch) >= 85)
                        {
                            UpdateLook(player, state);
                            if (state.resetPendingTicks !== 0)
                            {
                                throw new Error("Pitch correction did not confirm recovery");
                            }
                        }
                    }

                    for (const offset of [ -45, -44.9, 44.9, 45 ])
                    {
                        player.setRotation({ x: 20,
                            y: 30 + offset });
                        const state = { previousRotation: { x: 20,
                            y: 30 },
                        resetPendingTicks: 0,
                        yawOrigin: 30 };
                        const before = player.location;
                        UpdateLook(player, state);
                        const expectedYaw = Math.abs(offset) >= 45 ? 30 : 30 + offset;
                        const actual = player.getRotation();
                        if (Math.abs(actual.x - 20) > 0.01 || Math.abs(actual.y - expectedYaw) > 0.01 ||
                            Math.abs(player.location.x - before.x) > 0.01 ||
                            Math.abs(player.location.y - before.y) > 0.01 ||
                            Math.abs(player.location.z - before.z) > 0.01)
                        {
                            throw new Error(`Yaw-limit correction failed for offset ${offset}`);
                        }

                        if (Math.abs(offset) >= 45)
                        {
                            UpdateLook(player, state);
                            if (state.resetPendingTicks !== 0)
                            {
                                throw new Error("Yaw correction did not confirm recovery");
                            }
                        }
                    }
                }

                player.stopUsingItem();
                await Wait(25);
                if (inventory.getItem(0)?.typeId !== ToggleItem)
                {
                    throw new Error("Toggle item was consumed");
                }
            }

            for (const sprinting of [ false, true ])
            {
                player.teleport({ x: 0.5,
                    y: -60,
                    z: 0.5 });
                player.isSprinting = sprinting;
                player.move(0, 1, 1);
                await Wait(10);
                const velocity = player.getVelocity();
                if (Math.hypot(velocity.x, velocity.z) < 0.01)
                {
                    throw new Error("Movement fixture did not establish existing velocity");
                }

                const before = player.location;
                Enable(player);
                const stopped = player.getVelocity();
                if (Math.hypot(stopped.x, stopped.z) > 0.00001)
                {
                    throw new Error("Activation did not immediately clear existing velocity");
                }

                // Stop the simulated movement driver as input permission neutralizes real client input.
                player.stopMoving();
                await Wait(5);
                if (Math.hypot(player.location.x - before.x, player.location.z - before.z) > 0.01)
                {
                    throw new Error("Player coasted after activation");
                }

                if (player.getProperty("look_demo:camera_active") !== true)
                {
                    throw new Error("Client head-hiding property did not enable");
                }

                Disable(player);
                await Wait(2);
                if (player.getProperty("look_demo:camera_active") !== false)
                {
                    throw new Error("Client head-hiding property did not restore");
                }
            }

            for (const pitch of [ -80, 0, 80 ])
            {
                for (const yaw of [ -170, 0, 170 ])
                {
                    player.teleport({ x: -6.25,
                        y: -60,
                        z: 3.75 }, { rotation: { x: pitch,
                        y: yaw } });
                    const before = player.location;
                    Enable(player);
                    const rotation = player.getRotation();
                    if (Math.abs(rotation.x - pitch) > 0.01 || Math.abs(rotation.y - yaw) > 0.01 ||
                        player.location.x !== before.x || player.location.y !== before.y ||
                        player.location.z !== before.z)
                    {
                        throw new Error("Native eye-anchored activation changed the player's pose");
                    }

                    // Exercise return from a different look direction and position.
                    player.teleport({ x: before.x + 0.25,
                        y: before.y,
                        z: before.z - 0.25 }, { rotation: { x: -pitch / 2,
                        y: 90 } });
                    const exitPosition = player.location;
                    Disable(player);
                    const restored = player.getRotation();
                    if (Math.abs(restored.x - pitch) > 0.01 || Math.abs(restored.y - yaw) > 0.01 ||
                        player.location.x !== exitPosition.x || player.location.y !== exitPosition.y ||
                        player.location.z !== exitPosition.z)
                    {
                        throw new Error("OFF did not restore the starting rotation at the current position");
                    }

                    // Repeated cleanup without a session must not overwrite a later normal rotation.
                    player.setRotation({ x: 15,
                        y: 60 });
                    Disable(player);
                    if (Math.abs(player.getRotation().x - 15) > 0.01 ||
                        Math.abs(player.getRotation().y - 60) > 0.01)
                    {
                        throw new Error("Cleanup without a session changed normal player rotation");
                    }
                }
            }

            console.warn("LOOK_INPUT_NATIVE_PASS: spawn item, default OFF, four native use edges, " +
                "permission restore, ordinary rotation retained, pitch/yaw limits and recovery, " +
                "item retained, native eye-anchored command accepted, no walk/sprint coasting, " +
                "head visibility and activation rotation restored at the current position");
        }
        finally
        {
            world.afterEvents.itemUse.unsubscribe(captureExit);
            Disable(player);
            player.disconnect();
        }
    })().catch((error: unknown) => console.error(`LOOK_INPUT_NATIVE_FAIL: ${String(error)}`));
}, 65);
