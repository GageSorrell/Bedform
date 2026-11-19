/**
 * Native entity Use delivery, repeat and helper isolation qualification without inventory writes.
 *
 * @module @sorrell/look-input-demo/Tool/ToggleFixture
 *
 * @file      ToggleFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { DynamicProperty, ProbeEntity, TickingArea } from "./ToggleKeys.mjs";
import type { Entity, EntityRaycastHit, PlayerInteractWithEntityAfterEvent,
    PlayerInteractWithEntityBeforeEvent } from "@minecraft/server";
import { FreezeCamera, RestoreCamera } from "../Script/Camera.js";
import { GameMode, InputButton, InputPermissionCategory, system, world } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

interface ProbeEvent
{
    first: unknown;
    player: string;
    target: string;
    tick: number;
}

const Wait = (ticks: number) => new Promise<void>((resolve: () => void) =>
    system.runTimeout(resolve, ticks));
const Check = (condition: unknown, message: string): void =>
{
    if (!condition)
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
            const player = spawnSimulatedPlayer({ dimension,
                x: 0.5,
                y: -60,
                z: 0.5 },
            "ToggleOwner", GameMode.Creative);
            const observer = spawnSimulatedPlayer({ dimension,
                x: 3.5,
                y: -60,
                z: 0.5 },
            "ToggleObserver", GameMode.Creative);
            const actors: Array<Entity> = [];
            const events: Array<ProbeEvent> = [];
            const capture = world.beforeEvents.playerInteractWithEntity.subscribe(
                (event: PlayerInteractWithEntityBeforeEvent) =>
                {
                    if (actors.some((actor: Entity) => actor.id === event.target.id))
                    {
                        event.cancel = true;
                        events.push({ first: Reflect.get(event, "isFirstEvent") ?? null,
                            player: event.player.id,
                            target: event.target.id,
                            tick: system.currentTick });
                    }
                });
            let afterEvents = 0;
            const captureAfter = world.afterEvents.playerInteractWithEntity.subscribe(
                (event: PlayerInteractWithEntityAfterEvent) =>
                {
                    if (actors.some((actor: Entity) => actor.id === event.target.id))
                    {
                        afterEvents++;
                    }
                });
            const inventory = player.getComponent("minecraft:inventory")!.container!;
            const snapshot = (): string => JSON.stringify(Array.from({ length: inventory.size },
                (_: unknown, slot: number) => inventory.getItem(slot)?.typeId ?? null));
            const before = snapshot();
            const movement = player.inputPermissions.isPermissionCategoryEnabled(
                InputPermissionCategory.Movement);
            const camera = player.inputPermissions.isPermissionCategoryEnabled(
                InputPermissionCategory.Camera);
            let evidence: Record<string, unknown> | undefined;
            try
            {
                await Wait(5);
                const target = dimension.spawnEntity(ProbeEntity,
                    { x: 0.5,
                        y: -60,
                        z: 2.5 });
                actors.push(target);
                player.lookAtEntity(target);
                await Wait(5);
                const initialHit = player.getEntitiesFromViewDirection({ maxDistance: 6 })
                    .some((hit: EntityRaycastHit) => hit.entity.id === target.id);
                Check(initialHit, "Initial aim did not intersect the original target");
                const start = events.length;
                const accepted = player.interactWithEntity(target);
                Check(accepted, "Explicit native interaction was rejected");
                await Wait(30);
                player.stopInteracting();
                const held = events.slice(start);
                await Wait(5);
                const freshStart = events.length;
                const freshAccepted = player.interactWithEntity(target);
                Check(freshAccepted, "Fresh native interaction was rejected");
                await Wait(3);
                player.stopInteracting();
                const freshEvents = events.slice(freshStart);

                FreezeCamera(player);
                player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
                player.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
                // Stay below the demo's 45-degree yaw recenter threshold while missing the target.
                player.lookAtLocation({ x: -2.5,
                    y: -58.5,
                    z: 4.5 });
                await Wait(5);
                const divergentRotation = player.getRotation();
                const divergentHits = player.getEntitiesFromViewDirection({ maxDistance: 6 })
                    .some((hit: EntityRaycastHit) => hit.entity.id === target.id);
                const missedStart = events.length;
                const divergentAccepted = player.interact();
                await Wait(5);
                player.stopInteracting();
                const divergentEvents = events.length - missedStart;
                Check(divergentEvents === 0, "Diverged aim still hit the original target");
                Check(!divergentHits, "Diverged ray still intersects the target");

                // An invisible, non-physical interactable is a minimal helper candidate.
                // A script ownership receipt is not a native per-viewer interaction filter.
                const direction = player.getViewDirection();
                const head = player.getHeadLocation();
                const helper = dimension.spawnEntity(ProbeEntity, {
                    x: head.x + direction.x * 1.5,
                    y: head.y + direction.y * 1.5 - 0.9,
                    z: head.z + direction.z * 1.5 });
                actors.push(helper);
                helper.setDynamicProperty(DynamicProperty.Owner, player.id);
                await Wait(2);
                const helperHit = player.getEntitiesFromViewDirection({ maxDistance: 6 })
                    .some((hit: EntityRaycastHit) => hit.entity.id === helper.id);
                const helperStart = events.length;
                const helperAccepted = player.interact();
                await Wait(5);
                player.stopInteracting();
                const helperEvents = events.slice(helperStart).filter(
                    (event: ProbeEvent) => event.target === helper.id);
                Check(helperHit && helperAccepted, "Helper did not intercept the owner's divergent ray");
                observer.teleport({ x: helper.location.x + 1.5,
                    y: -60,
                    z: helper.location.z });
                observer.lookAtEntity(helper);
                await Wait(5);
                const observerHits = observer.getEntitiesFromViewDirection({ maxDistance: 6 })
                    .some((hit: EntityRaycastHit) => hit.entity.id === helper.id);
                const otherStart = events.length;
                const observerAccepted = observer.interact();
                await Wait(5);
                observer.stopInteracting();
                const otherEvents = events.slice(otherStart).filter(
                    (event: ProbeEvent) => event.player === observer.id);
                Check(observerHits && observerAccepted,
                    "Observer did not reproduce helper interception");
                Check(snapshot() === before, "Probe changed owner inventory");
                evidence = { accepted,
                    afterEvents,
                    clientGate: "Simulated calls do not establish physical press/release or event dispatch",
                    conclusion: "UNQUALIFIED: no Use edge signal; aim misses; " +
                        "invisible owned helper intercepts other players",
                    divergentAccepted,
                    divergentEvents,
                    divergentHits,
                    divergentRotation,
                    freshAccepted,
                    freshEvents,
                    heldEvents: held,
                    helperAccepted,
                    helperEvents,
                    helperHit,
                    initialHit,
                    inputButtons: Object.values(InputButton),
                    inventoryUnchanged: true,
                    observerAccepted,
                    observerHits,
                    otherEvents };
            }
            finally
            {
                const errors: Array<unknown> = [];
                const attempt = (action: () => void): void =>
                {
                    try
                    {
                        action();
                    }
                    catch (error)
                    {
                        errors.push(error);
                    }
                };

                for (const actor of actors)
                {
                    if (actor.isValid)
                    {
                        attempt(() => actor.remove());
                    }
                }

                attempt(() => player.stopInteracting());
                attempt(() => observer.stopInteracting());
                attempt(() => RestoreCamera(player.camera));
                attempt(() => player.inputPermissions.setPermissionCategory(
                    InputPermissionCategory.Movement, movement));
                attempt(() => player.inputPermissions.setPermissionCategory(
                    InputPermissionCategory.Camera, camera));
                attempt(() => world.beforeEvents.playerInteractWithEntity.unsubscribe(capture));
                attempt(() => world.afterEvents.playerInteractWithEntity.unsubscribe(captureAfter));
                attempt(() => Check(actors.every((actor: Entity) => !actor.isValid),
                    "Probe actor cleanup failed"));
                attempt(() => Check(snapshot() === before, "Cleanup changed owner inventory"));
                attempt(() => Check(player.inputPermissions.isPermissionCategoryEnabled(
                    InputPermissionCategory.Movement) === movement &&
                    player.inputPermissions.isPermissionCategoryEnabled(
                        InputPermissionCategory.Camera) === camera,
                "Probe did not restore permissions"));
                attempt(() => player.disconnect());
                attempt(() => observer.disconnect());
                attempt(() =>
                {
                    dimension.runCommand(`tickingarea remove ${TickingArea.Scene}`);
                });
                Check(errors.length === 0, `Cleanup errors: ${errors.map(String).join("; ")}`);
            }

            console.warn("TOGGLE_CAPTURE_EVIDENCE " + JSON.stringify({ ...evidence,
                cleanup: true }));
            console.warn("TOGGLE_CAPTURE_PASS");
        })().catch((error: unknown) => console.error(`TOGGLE_CAPTURE_FAIL ${String(error)}`));
    }, 40);
});
