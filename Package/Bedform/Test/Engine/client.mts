/**
 * Peaceful creative gallery; server checks never substitute for client captures.
 *
 * @module bedform/Test/Engine/client
 *
 * @file      client.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Scene controls retain contextual types and physical coordinate ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import { BlockPermutation, GameMode, SignSide, system, world } from "@minecraft/server";
import * as Runtime from "../../Source/PhysicsRuntime.js";
import { makeHost } from "../../Source/Internal/PhysicsBedrock.js";
import * as E from "../../Source/PhysicsEntity.js";
import * as V from "../../Source/Vector3.js";
import * as Q from "../../Source/Quat.js";
import * as T from "../../Source/Transform.js";
import * as R from "@bedform/effect/Result";
import * as O from "@bedform/effect/Option";
import { Models } from "./catalog.mjs";
import { TestScriptEvent, TickingArea } from "./keys.mjs";
import { Stations } from "./gallery.mjs";
import { waitForLoadedRegion } from "./readiness.mjs";

system.runTimeout(() =>
{
    const Dimension = world.getDimension("overworld");
    try
    {Dimension.runCommand(`tickingarea remove ${TickingArea.Fixture}`);}
    catch
    { /* A fresh world has no saved fixture area. */ }

    // Saved-area removal is asynchronous; recreate on a later tick.
    system.runTimeout(() =>
    {
        try
        {
            const Area = Dimension.runCommand(`tickingarea add circle 40 100 0 4 ${TickingArea.Fixture} true`);
            if (Area.successCount === 0)
            {throw new Error("Ticking area command reported no success");}
        }
        catch (error)
        {
            console.error(`BF_FAIL client fixture could not create its ticking area: ${String(error)}`);
            return;
        }

        console.warn("BF_CLIENT_WAITING waiting for gallery chunks");
        waitForLoadedRegion({ probe: () =>
        {
            for (let x = -1; x <= 5; x++)
            {
                for (let z = -1; z <= 0; z++)
                {
                    if (!Dimension.getBlock({ x: x * 16,
                        y: 98,
                        z: z * 16 }))
                    {return false;}
                }
            }

            return true;
        },
        schedule: (callback, ticks) => { system.runTimeout(callback, ticks); },
        failed: (message) => console.error(`BF_FAIL client fixture ${message}`),
        ready: () =>
        {
            let physics: Runtime.Runtime | undefined;
            try
            {
                // The flat generator supplies grass everywhere; verify outside the path.
                const Grass = Dimension.getBlock({ x: -8,
                    y: 98,
                    z: -8 });
                if (!Grass || ![ "minecraft:grass_block", "minecraft:grass" ].includes(Grass.typeId) || !Dimension.getBlock({ x: -8,
                    y: 99,
                    z: -8 })?.isAir)
                {throw new Error(`Expected flat grass at y=98; found ${Grass?.typeId}`);}

                Dimension.runCommand("difficulty peaceful");
                Dimension.runCommand("gamemode creative @a");
                Dimension.runCommand("setworldspawn -8 99 6");
                Dimension.runCommand("gamerule doMobSpawning false");
                Dimension.runCommand("gamerule doDaylightCycle false");
                Dimension.runCommand("gamerule doWeatherCycle false");
                Dimension.runCommand("weather clear");
                Dimension.runCommand("time set noon");
                Dimension.runCommand("fill -10 98 4 88 98 7 stone");
                const PreparePlayer = (player: ReturnType<typeof world.getAllPlayers>[number]): void =>
                {
                    player.setGameMode(GameMode.Creative);
                    player.teleport({ x: -8,
                        y: 99,
                        z: 6 }, { dimension: Dimension,
                        rotation: { x: 0,
                            y: -90 } });
                    player.sendMessage("Physics gallery: follow the path east. Each sign explains a demo; its button resets it.");
                };

                world.afterEvents.playerSpawn.subscribe((event) =>
                {
                    event.player.setGameMode(GameMode.Creative);
                    if (event.initialSpawn)
                    {PreparePlayer(event.player);}
                });
                for (const Player of world.getAllPlayers())
                {PreparePlayer(Player);}

                const Physics = R.getOrThrow(Runtime.start({ host: makeHost({ namespace: "bedform_fixture",
                    dimensions: [ Dimension.id ] }),
                models: Object.values(Models),
                diagnostic: (error) => console.warn(`BF_CLIENT_DIAGNOSTIC ${JSON.stringify(error)}`) }));
                physics = Physics;
                const All = Object.values(Stations);
                const Restored = Physics.world(Dimension.id)?.bodies.filter((body) => All.some((station) => station.id === body.id)).length ?? 0;
                const Ages = new Map<string, number>();
                const Update = (id: string, operation: Parameters<Runtime.Runtime["update"]>[1]): void =>
                {R.getOrThrow(Physics.update(id, operation));};

                const Position = (station: typeof All[number]): V.Vector3 => V.Vector3Unsafe(station.x, station === Stations.Support ? 99.375 : station === Stations.Drop ? 103 : 101, 0);
                const Reset = (station: typeof All[number]): void =>
                {
                    const Existing = Physics.world(Dimension.id)?.bodies.find((body) => body.id === station.id);
                    if (Existing && Existing.definition.model.identifier !== Models[station.model].identifier)
                    {R.getOrThrow(Physics.remove(station.id));}

                    if (!Physics.world(Dimension.id)?.bodies.some((body) => body.id === station.id))
                    {
                        R.getOrThrow(Physics.spawn(R.getOrThrow(E.make(Models[station.model], {
                            id: station.id,
                            mode: "kinematic",
                            allowSleep: station === Stations.Drop,
                            pose: { position: Position(station),
                                rotation: Q.Identity }
                        })), Dimension.id));
                    }

                    Update(station.id, E.configure({ mode: station === Stations.Drop ? "dynamic" : "kinematic",
                        allowSleep: station === Stations.Drop,
                        gravity: O.none() }));
                    Update(station.id, E.setLinearVelocity(V.Zero));
                    Update(station.id, E.setAngularVelocity(V.Zero));
                    Update(station.id, E.resume);
                    R.getOrThrow(Physics.transfer(station.id, Dimension.id, O.getOrThrow(T.Transform(Position(station), Q.Identity))));
                    if (station === Stations.Rotate)
                    {
                        Update(station.id, E.setLinearVelocity(V.Vector3Unsafe(0.2, 0, 0)));
                        Update(station.id, E.setAngularVelocity(V.Vector3Unsafe(0.3, 0.6, 0.9)));
                    }
                    else if (station === Stations.Rebase || station === Stations.Hold)
                    {Update(station.id, E.setLinearVelocity(V.Vector3Unsafe(2, 0, 0)));}
                    else if (station === Stations.Support)
                    {
                        Update(station.id, E.setLinearVelocity(V.Vector3Unsafe(0.4, 0, 0)));
                        Update(station.id, E.setAngularVelocity(V.Vector3Unsafe(0, 0.2, 0)));
                    }

                    Ages.set(station.id, 0);
                };

                for (const Station of All)
                {
                    Dimension.runCommand(`fill ${Station.x - 6} 98 -5 ${Station.x + 6} 98 3 white_concrete outline`);
                    Dimension.runCommand(`fill ${Station.x - 1} 99 4 ${Station.x - 1} 101 4 stone`);
                    const Button = Dimension.getBlock({ x: Station.x - 1,
                        y: 100,
                        z: 5 })!;
                    Button.setPermutation(BlockPermutation.resolve("minecraft:stone_button", { facing_direction: 3 }));
                    const Sign = Dimension.getBlock({ x: Station.x - 1,
                        y: 101,
                        z: 5 })!;
                    Sign.setPermutation(BlockPermutation.resolve("minecraft:wall_sign", { facing_direction: 3 }));
                    const Text = Sign.getComponent("minecraft:sign");
                    if (!Text)
                    {throw new Error(`Sign component missing at station ${Station.id}`);}

                    Text.setText(Station.text, SignSide.Front);
                    Text.setText(Station.text, SignSide.Back);
                    Text.setWaxed(true);
                    Reset(Station);
                }

                const Capture = (label: string): void => console.warn(`BF_CLIENT_SNAPSHOT ${JSON.stringify({ label,
                    time: Date.now(),
                    tick: system.currentTick,
                    players: world.getAllPlayers().length,
                    bodies: Physics.world(Dimension.id)?.bodies.filter((body) => All.some((station) => station.id === body.id)).map((body) => ({ id: body.id,
                        pose: body.pose,
                        comVelocity: body.linearVelocity,
                        angularVelocity: body.angularVelocity,
                        sequence: body.interval.sequence,
                        reset: body.interval.reset,
                        paused: body.paused })) })}`);
                world.afterEvents.buttonPush.subscribe((event) =>
                {
                    if (event.block.dimension.id !== Dimension.id)
                    {return;}

                    const Location = event.block.location;
                    const Station = All.find((station) => Location.x === station.x - 1 && Location.y === 100 && Location.z === 5);
                    if (!Station)
                    {return;}

                    try
                    {
                        Reset(Station);
                        Capture(Station.id);
                    }
                    catch (error)
                    {console.error(`BF_CLIENT_CONTROL_ERROR ${String(error)}`);}
                });
                // Retain capture automation, but demonstrations require no console commands.
                system.afterEvents.scriptEventReceive.subscribe((event) =>
                {
                    if (event.id === TestScriptEvent.Capture)
                    {Capture(event.message.replace(/[^a-zA-Z0-9_-]/gu, "").slice(0, 64));}
                });

                let failed = false;
                const Animation = system.runInterval(() =>
                {
                    if (failed)
                    {return;}

                    try
                    {
                        for (const Station of All)
                        {
                            const Age = (Ages.get(Station.id) ?? 0) + 1;
                            Ages.set(Station.id, Age);
                            const Body = Physics.world(Dimension.id)?.bodies.find((body) => body.id === Station.id);
                            if (!Body || Body.paused)
                            {throw new Error(`Gallery owner missing or paused: ${Station.id}`);}

                            const Limit = Station === Stations.Rebase ? 5 : Station === Stations.Rotate ? 1 : 2;
                            if ((Station === Stations.Rotate || Station === Stations.Rebase || Station === Stations.Support) &&
                                (Body.pose.position.x > Station.x + Limit && Body.linearVelocity.x > 0 || Body.pose.position.x < Station.x - Limit && Body.linearVelocity.x < 0))
                            {Update(Station.id, E.setLinearVelocity(V.Vector3Unsafe(-Body.linearVelocity.x, 0, 0)));}

                            if (Station === Stations.Hold && Age === 20)
                            {Update(Station.id, E.setLinearVelocity(V.Zero));}

                            if (Station === Stations.Teleport && Age % 60 === 0)
                            {R.getOrThrow(Physics.transfer(Station.id, Dimension.id, O.getOrThrow(T.Transform(V.Vector3Unsafe(Station.x + (Age % 120 === 0 ? -2 : 2), 101, 0), Q.Identity))));}

                            if (Station === Stations.Drop && Age >= 180)
                            {Reset(Station);}
                        }

                        if (system.currentTick % 200 === 0)
                        {Capture("gallery-running");}
                    }
                    catch (error)
                    {
                        failed = true;
                        system.clearRun(Animation);
                        console.error(`BF_FAIL client gallery motion ${String(error)}`);
                    }
                }, 1);
                // Let real engine simulation advance before declaring the gallery ready.
                system.runTimeout(() =>
                {
                    if (failed)
                    {return;}

                    Capture("ready");
                    console.warn(`BF_CLIENT_READY ${JSON.stringify({ restored: Restored,
                        stations: All.length,
                        spawn: { x: -8,
                            y: 99,
                            z: 6 },
                        capturesRecorded: false,
                        clientsRequired: 2 })}`);
                }, 40);
            }
            catch (error)
            {
                physics?.dispose();
                console.error(`BF_FAIL client fixture ${error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(error)}`);
            }
        } });
    }, 5);
}, 20);
