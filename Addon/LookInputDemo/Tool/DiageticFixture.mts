/**
 * Isolated native camera, journal and settling checks using scripted Diagetic observations.
 *
 * @module @sorrell/look-input-demo/Tool/DiageticFixture
 *
 * @file      DiageticFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native probe assertions retain contextual inference and physical coordinate order. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "../../../Package/Bedform/Source/Diagetic.js";
import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { ProbeEntity, TickingArea } from "./ToggleKeys.mjs";
import type { Player } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

const Wait = (ticks: number) => new Promise<void>((resolve: () => void) => system.runTimeout(resolve, ticks));
const Check = (value: unknown, message: string): void =>
{
    if (!value)
    {
        throw new Error(message);
    }
};

system.run(() =>
{
    const dimension = world.getDimension("overworld");
    dimension.runCommand(`tickingarea add circle 0 -60 0 2 ${TickingArea.Scene}`);
    system.runTimeout(() =>
    {
        void (async () =>
        {
            dimension.runCommand("fill -8 -61 -8 8 -61 8 smooth_stone");
            world.gameRules.doMobSpawning = false;
            const native = spawnSimulatedPlayer({ dimension,
                x: 0.5,
                y: -60,
                z: 0.5 },
            "DiageticOwner", GameMode.Creative);
            const other = spawnSimulatedPlayer({ dimension,
                x: 2.5,
                y: -60,
                z: 0.5 },
            "DiageticOther", GameMode.Creative);
            await Wait(5);
            const teleports: Array<unknown> = [];
            const player = new Proxy(native as unknown as Player, {
                get(target, key)
                {
                    if (key === "teleport")
                    {
                        return (location: Parameters<Player["teleport"]>[0],
                            options: Parameters<Player["teleport"]>[1]): void =>
                        {
                            target.teleport(location, options);
                            teleports.push(target.getRotation());
                        };
                    }

                    const value: unknown = Reflect.get(target, key, target);
                    return typeof value === "function" ? value.bind(target) : value;
                }
            });
            const errors: Array<unknown> = [];
            const definition = D.Lever({ EntityType: ProbeEntity });
            let runtime = D.Start({ World: world,
                System: system,
                Controls: [ definition ],
                OnError: (error: unknown) => errors.push(error) });
            const control = definition.Spawn(dimension, { x: 0.5,
                y: -60,
                z: 2.5 },
            { initialRotation: 180,
                Pose: { Offset: { x: 0,
                    y: 1.3,
                    z: 0 } } });
            const container = native.getComponent("minecraft:inventory")!.container!;
            const item = new ItemStack("minecraft:diamond", 7);
            item.nameTag = "Unchanged native probe stack";
            item.setLore([ "No inventory replacement" ]);
            container.setItem(0, item);
            const inventory = (): string => JSON.stringify(Array.from({ length: container.size }, (_, slot) =>
            {
                const stack = container.getItem(slot);
                return stack && { type: stack.typeId,
                    amount: stack.amount,
                    name: stack.nameTag,
                    lore: stack.getLore() };
            }));
            const original = inventory();
            try
            {
                native.teleport(native.location, { rotation: { x: 0,
                    y: 0 } });
                native.inputPermissions.setPermissionCategory(D.Keys.NativePermission.Jump, false);
                native.inputPermissions.setPermissionCategory(D.Keys.NativePermission.Camera, false);
                const saved = Object.values(D.Keys.NativePermission).map((category) =>
                    [ category, native.inputPermissions.isPermissionCategoryEnabled(category) ] as const);
                Check(runtime.Interact(player, control.Entity), "Observation was not accepted");
                await Wait(4);
                Check(runtime.IsInteracting(player),
                    "Native session did not activate: " + errors.map(String));
                Check(native.getProperty(D.Keys.EntityProperty.CameraActive) === true,
                    "Body/camera property did not lock");
                Check(!native.inputPermissions.isPermissionCategoryEnabled(D.Keys.NativePermission.Movement),
                    "Movement did not lock");
                Check(world.getDynamicProperty(
                    D.Keys.DynamicPropertyPrefix.Recovery + player.id) !== undefined,
                "No native recovery journal");
                runtime.Interact(other as unknown as Player, control.Entity);
                await Wait(3);
                Check(!runtime.IsInteracting(other), "Native contention admitted another owner");
                control.SetValue(0.8);
                native.selectedSlotIndex = 1;
                native.lookAtLocation({ x: -4,
                    y: -57,
                    z: 0.5 });
                await Wait(25);
                Check(runtime.IsInteracting(player), "Receiver lease expired during a live session");
                const receiver = dimension.getEntities({ type: D.Keys.ReleaseTarget })[0];
                Check(receiver && native.getEntitiesFromViewDirection({ maxDistance: 3 })
                    .some((hit) => hit.entity.id === receiver.id), "Native air aim missed release receiver");
                Check(runtime.Interact(other as unknown as Player, receiver) === false,
                    "Another player was admitted to the receiver");
                Check(runtime.IsInteracting(player), "Foreign Use released the owner");
                const observed: Array<unknown> = [];
                const watch = world.beforeEvents.playerInteractWithEntity.subscribe((event) =>
                    observed.push({ player: event.player.id,
                        target: event.target.id,
                        type: event.target.typeId,
                        cancel: event.cancel }));
                Check(native.interact(), "Native empty-handed Use was rejected");
                await Wait(4);
                native.stopInteracting();
                world.beforeEvents.playerInteractWithEntity.unsubscribe(watch);
                const nativeUseDelivered = observed.length > 0;
                if (!nativeUseDelivered)
                {
                    // ToggleFixture independently reproduces simulated Use bypassing script before-events.
                    Check(runtime.Interact(player, receiver), "Scripted receiver observation was rejected");
                    await Wait(3);
                }

                Check(!runtime.IsInteracting(player), "Receiver observation did not release");
                Check(dimension.getEntities({ type: D.Keys.ReleaseTarget }).length === 0,
                    "Release left a receiver");
                Check(native.getProperty(D.Keys.EntityProperty.CameraActive) === false,
                    "Presentation did not restore");
                Check(saved.every(([ category, enabled ]) =>
                    native.inputPermissions.isPermissionCategoryEnabled(category) === enabled),
                "Original native permission categories were not restored");
                Check(world.getDynamicProperty(
                    D.Keys.DynamicPropertyPrefix.Recovery + player.id) === undefined,
                "Native journal did not clear");
                Check(!native.getTags().some((tag) => tag.startsWith(D.Keys.TagPrefix.Session)) &&
                    !control.Entity.getTags().some((tag) => tag.startsWith(D.Keys.TagPrefix.Session)),
                "Native ownership markers survived release");
                Check(teleports.length >= 2, "Activation/release did not send native rotation corrections");
                await Wait(160);
                Check(control.Value === 1,
                    "Native tick driver did not settle released lever: " + control.Value);
                Check(inventory() === original, "Native inventory stack metadata changed");
                Check(dimension.getEntities({ type: ProbeEntity }).length === 1, "Unexpected helper entity");
                Check(errors.length === 0, "Native runtime errors: " + errors.map(String));
                runtime.Interact(player, control.Entity);
                await Wait(3);
                runtime.Dispose();
                await Wait(3);
                Check(native.getProperty(D.Keys.EntityProperty.CameraActive) === false,
                    "Dispose left native presentation locked");
                runtime = D.Start({ World: world,
                    System: system,
                    Controls: [ definition ],
                    OnError: (error: unknown) => errors.push(error) });
                await Wait(3);
                Check(!runtime.IsInteracting(player), "Fresh runtime resumed a grab");
                Check(errors.length === 0, "Restarted runtime errors: " + errors.map(String));
                const orphan = dimension.spawnEntity(D.Keys.ReleaseTarget, { x: 4,
                    y: -58,
                    z: 4 });
                await Wait(30);
                Check(!orphan.isValid, "Unrefreshed receiver did not expire");
                console.warn("DIAGETIC_NATIVE_EVIDENCE " + JSON.stringify({
                    scriptedObservations: true,
                    nativeUseDelivered,
                    nativeAirRayHit: true,
                    receiverObservationReleased: true,
                    orphanLeaseExpired: true,
                    physicalInputVerified: false,
                    savedPermissionsRestored: true,
                    journalCleared: true,
                    contention: true,
                    inventoryUnchanged: true,
                    helpers: 0,
                    settledValue: control.Value,
                    teleports,
                    presentationRestored: true,
                    runtimeRestart: true }));
                console.warn("DIAGETIC_NATIVE_PASS");
            }
            finally
            {
                runtime.Dispose();
                control.Remove();
                native.disconnect();
                other.disconnect();
                dimension.runCommand(`tickingarea remove ${TickingArea.Scene}`);
            }
        })().catch((error: unknown) => console.error(`DIAGETIC_NATIVE_FAIL ${String(error)}`));
    }, 40);
});
