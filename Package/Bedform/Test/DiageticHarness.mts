/**
 * Native-shaped Diagetic session host with deterministic scheduling and resource fault injection.
 *
 * @module bedform/Test/DiageticHarness
 *
 * @file      DiageticHarness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native-shaped fixtures preserve contextual types and transaction field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import type { Entity, Player, System, Vector2, Vector3, World } from "@minecraft/server";
import { Keys } from "bedform/Diagetic";

/**
 * Creates a deterministic host; every native mutation records ordering and can fail independently.
 *
 * @category Testing
 * @since 1.0.0
 */
export const Harness = () =>
{
    const faults = new Map<string, number>();
    const calls: Array<string> = [];
    const errors: Array<unknown> = [];
    const storage = new Map<string, unknown>();
    const queue = new Map<number, () => void>();
    const intervals = new Map<number, () => void>();
    let tick = 0;
    let serial = 0;
    const hit = (name: string): void =>
    {
        calls.push(name);
        const left = faults.get(name) ?? 0;
        if (left > 0)
        {
            faults.set(name, left - 1);
            throw new Error(name);
        }
    };

    const signal = (name: string) =>
    {
        const callbacks = new Set<(event: never) => void>();
        return { callbacks,
            subscribe(callback: (event: never) => void): (event: never) => void
            {
                hit("subscribe:" + name);
                callbacks.add(callback);
                return callback;
            },
            unsubscribe(callback: (event: never) => void): void
            {
                hit("unsubscribe:" + name);
                callbacks.delete(callback);
            },
            emit(event: unknown): void
            {
                for (const callback of [ ...callbacks ])
                {
                    callback(event as never);
                }
            }
        };
    };

    const before = { playerInteractWithEntity: signal("use"),
        playerInteractWithBlock: signal("block"),
        itemUse: signal("item") };
    const after = { playerSpawn: signal("spawn"),
        playerLeave: signal("leave"),
        playerDimensionChange: signal("dimension"),
        entityDie: signal("die"),
        entityRemove: signal("remove"),
        entityLoad: signal("load"),
        entitySpawn: signal("spawnEntity"),
        playerBreakBlock: signal("break"),
        playerPlaceBlock: signal("place"),
        blockExplode: signal("explode") };
    const actors = new Map<string, Entity>();
    const players = new Map<string, Player>();
    const blocks = new Map<string, string | undefined>();
    const dimension = { id: "minecraft:overworld",
        spawnEntity: (type: string, position: Vector3) =>
        {
            hit("spawnTarget");
            const target = actor("target:" + (++serial), type);
            target.native.location = { ...position };
            return target.entity;
        },
        getBlock: (position: Vector3) =>
        {
            hit("block:" + [ position.x, position.y, position.z ].join(","));
            const typeId = blocks.get([ position.x, position.y, position.z ].join(","));
            return typeId === undefined ? undefined : { typeId,
                isAir: typeId === "minecraft:air" };
        },
        getEntities: (options: { type: string }) => [ ...actors.values() ]
            .filter((entry) => entry.isValid && entry.typeId === options.type) };
    const actor = (id: string, typeId = "bedform:diagetic_slider") =>
    {
        const tags = new Set<string>();
        const properties = new Map<string, unknown>();
        const synchronized = new Map<string, unknown>();
        const native = { id,
            typeId,
            isValid: true,
            dimension,
            location: { x: 0,
                y: 1.5,
                z: 0 },
            teleport: (position: Vector3) =>
            {
                hit(id + ":teleport");
                native.location = { ...position };
            },
            triggerEvent: () => hit(id + ":refresh"),
            getRotation: (): Vector2 => ({ x: 0,
                y: 0 }),
            getDynamicProperty: (key: string) => properties.get(key),
            setDynamicProperty: (key: string, value: unknown) =>
            {
                hit(id + ":write:" + key);
                properties.set(key, value);
            },
            getProperty: (key: string) => synchronized.get(key),
            setProperty: (key: string, value: unknown) =>
            {
                hit(id + ":property:" + key);
                synchronized.set(key, value);
            },
            getTags: () => [ ...tags ],
            hasTag: (tag: string) => tags.has(tag),
            addTag: (tag: string) =>
            {
                hit(id + ":addTag");
                tags.add(tag);
                return true;
            },
            removeTag: (tag: string) =>
            {
                hit(id + ":removeTag");
                return tags.delete(tag);
            },
            remove: () =>
            {
                hit(id + ":remove");
                native.isValid = false;
                if (typeId === Keys.ReleaseTarget)
                {
                    actors.delete(id);
                }

                after.entityRemove.emit({ removedEntityId: id,
                    typeId });
            } };
        const result = { native,
            tags,
            properties,
            synchronized,
            entity: native as unknown as Entity };
        actors.set(id, result.entity);
        return result;
    };

    const player = (id: string) =>
    {
        const tags = new Set<string>();
        const permissions = new Map<number, boolean>(Object.values(Keys.NativePermission)
            .map((category) => [ category, true ]));
        const data = { rotation: { x: 0,
            y: 180 },
        active: false,
        bodyLocked: false,
        prompt: "",
        fovClears: 0 };
        const native = { id,
            name: id,
            typeId: "minecraft:player",
            isValid: true,
            dimension,
            location: { x: 0,
                y: 0,
                z: 2 },
            getRotation: (): Vector2 => ({ ...data.rotation }),
            getEntitiesFromViewDirection: () => [] as Array<{ entity: Entity;
                distance: number }>,
            getViewDirection: (): Vector3 =>
            {
                const pitch = data.rotation.x * Math.PI / 180;
                const yaw = data.rotation.y * Math.PI / 180;
                return { x: -Math.sin(yaw) * Math.cos(pitch),
                    y: -Math.sin(pitch),
                    z: Math.cos(yaw) * Math.cos(pitch) };
            },
            getHeadLocation: (): Vector3 => ({ ...native.location,
                y: native.location.y + 1.5 }),
            getTags: () => [ ...tags ],
            hasTag: (tag: string) => tags.has(tag),
            addTag: (tag: string) =>
            {
                hit(id + ":addTag");
                tags.add(tag);
                return true;
            },
            removeTag: (tag: string) =>
            {
                hit(id + ":removeTag");
                return tags.delete(tag);
            },
            clearVelocity: () => hit(id + ":velocity"),
            teleport: (location: Vector3, options: { rotation: Vector2 }) =>
            {
                hit(id + ":teleport");
                if (!native.isValid)
                {
                    throw new Error("offline");
                }

                native.location = { ...location };
                data.rotation = { ...options.rotation };
            },
            triggerEvent: (event: string) =>
            {
                hit(id + ":" + (event === Keys.EntityEvent.Lock ? "lock" : "unlock"));
                data.bodyLocked = event === Keys.EntityEvent.Lock;
            },
            getProperty: (name: string) => name === Keys.EntityProperty.CameraActive
                ? data.bodyLocked : undefined,
            runCommand: (command: string) =>
            {
                hit(id + ":camera");
                calls.push(command);
                data.active = true;
                return { successCount: 1 };
            },
            camera: {
                clear: () =>
                {
                    hit(id + ":clear");
                    data.active = false;
                },
                setFov: (...values: Array<unknown>) =>
                {
                    hit(id + ":fov");
                    if (values.length)
                    {
                        throw new Error("FOV override was authored");
                    }

                    data.fovClears++;
                } },
            inputPermissions: {
                isPermissionCategoryEnabled: (category: number) => permissions.get(category)!,
                setPermissionCategory: (category: number, enabled: boolean) =>
                {
                    hit(id + ":permission:" + category);
                    permissions.set(category, enabled);
                    if (category === Keys.NativePermission.Movement)
                    {
                        for (const child of Object.values(Keys.NativePermission))
                        {
                            if (child !== Keys.NativePermission.Camera)
                            {
                                permissions.set(child, enabled);
                            }
                        }
                    }

                    if (category === Keys.NativePermission.LateralMovement)
                    {
                        for (const child of [ 9, 10, 11, 12 ])
                        {
                            permissions.set(child, enabled);
                        }
                    }
                } },
            onScreenDisplay: { setActionBar: (text: string) =>
            {
                hit(id + ":prompt");
                data.prompt = text;
            } },
            getComponent: () =>
            {
                throw new Error("Unexpected component/inventory access");
            }
        };
        const result = { native,
            tags,
            permissions,
            data,
            player: native as unknown as Player };
        players.set(id, result.player);
        return result;
    };

    const world = { beforeEvents: before,
        afterEvents: after,
        getAllPlayers: () => [ ...players.values() ].filter((entry) => entry.isValid),
        getEntity: (id: string) => actors.get(id)?.isValid ? actors.get(id) :
            players.get(id)?.isValid ? players.get(id) : undefined,
        getDimension: () => dimension,
        getDynamicProperty: (key: string) =>
        {
            hit("read:" + key);
            return storage.get(key);
        },
        setDynamicProperty: (key: string, value: unknown) =>
        {
            hit("write:" + key);
            if (value === undefined)
            {
                storage.delete(key);
            }
            else
            {
                storage.set(key, value);
            }
        } } as unknown as World;
    const system = { get currentTick()
    {
        return tick;
    },
    run: (callback: () => void) =>
    {
        hit("run");
        queue.set(++serial, callback);
        return serial;
    },
    runInterval: (callback: () => void) =>
    {
        hit("interval");
        intervals.set(++serial, callback);
        return serial;
    },
    clearRun: (id: number) =>
    {
        hit("clearRun");
        queue.delete(id);
        intervals.delete(id);
    }
    } as unknown as System;
    const advance = (count = 1): void =>
    {
        for (let i = 0; i < count; i++)
        {
            tick++;
            const scheduled = [ ...queue.values() ];
            queue.clear();
            for (const callback of scheduled)
            {
                callback();
            }

            for (const callback of [ ...intervals.values() ])
            {
                callback();
            }
        }
    };

    return { world,
        system,
        actor,
        player,
        actors,
        blocks,
        dimension,
        players,
        before,
        after,
        calls,
        errors,
        faults,
        storage,
        queue,
        intervals,
        advance,
        options: { World: world,
            System: system,
            OnError: (error: unknown) => errors.push(error) },
        subscriptions: () => [ ...Object.values(before), ...Object.values(after) ]
            .reduce((total, entry) => total + entry.callbacks.size, 0) };
};
