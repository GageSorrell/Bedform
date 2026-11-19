/**
 * Diagetic demonstration runtime: registers the tuned demo controls, builds the scene once per world and
 * reports native evidence that both its own controls and BedformCommon's built-ins are published.
 *
 * @module @sorrell/diagetic-demo/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Scene records and evidence retain semantic field ordering. */
/* eslint-disable sort-keys */

import * as Diagetic from "../../../Package/Bedform/Source/Diagetic.js";
import { Cubes, Desk, Faces, Floor, FreeControls, Lamps, Signs, Wall, WallControls } from "./Layout.js";
import { DemoControls, Feedback } from "./Controls.js";
import type { Dimension, Entity } from "@minecraft/server";
import { DynamicProperty, Marker, TickingArea } from "./Keys.js";
import { system, world } from "@minecraft/server";

const SceneVersion = 1;
const BuiltinTypes = [ "bedform:diagetic_lever", "bedform:diagetic_slider", "bedform:diagetic_wheel" ];

/**
 * Finds the demo definition registered for an entity type.
 *
 * @category Getter
 * @since 1.0.0
 */
function Definition(type: string): Diagetic.Definition
{
    return DemoControls.find((control: Diagetic.Definition) => control.EntityType === type)!;
}

/**
 * Runs a command, ignoring an unsuccessful result such as an existing ticking area.
 *
 * @category Running
 * @since 1.0.0
 */
function Command(dimension: Dimension, command: string): void
{
    try
    {
        dimension.runCommand(command);
    }
    catch (error)
    {
        console.warn(`Diagetic demo command failed: ${command}: ${String(error)}`);
    }
}

/**
 * Formats a block position for a command.
 *
 * @category Converting
 * @since 1.0.0
 */
function At(position: { x: number;
    y: number;
    z: number }): string
{
    return `${position.x} ${position.y} ${position.z}`;
}

/**
 * Builds blocks, signs, built-in controls (through BedformCommon's placement event) and tuned demo controls.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Build(dimension: Dimension): void
{
    world.gameRules.doDayLightCycle = false;
    world.gameRules.doWeatherCycle = false;
    world.gameRules.doMobSpawning = false;
    world.setTimeOfDay(6_000);
    for (const type of [ ...BuiltinTypes, ...DemoControls.map((control: Diagetic.Definition) =>
        control.EntityType) ])
    {
        Command(dimension, `kill @e[type=${type}]`);
    }

    Command(dimension, `fill ${At(Wall.From)} ${At(Wall.To)} smooth_stone`);
    Command(dimension, `fill ${At(Desk.From)} ${At(Desk.To)} polished_andesite`);
    for (const lamp of Lamps)
    {
        Command(dimension, `setblock ${At(lamp)} redstone_lamp`);
    }

    for (const cube of Cubes)
    {
        Command(dimension, `setblock ${At(cube.Position)} polished_andesite`);
        for (const face of Faces)
        {
            Command(dimension, `scriptevent ${Diagetic.Keys.ScriptEvent.Place} ${JSON.stringify({
                Kind: cube.Kind,
                Dimension: dimension.id,
                Position: cube.Position,
                Face: face,
                Value: cube.Kind === "wheel" ? 0 : 0.5 })}`);
        }
    }

    for (const sign of Signs)
    {
        Command(dimension, `setblock ${At(sign.Position)} standing_sign ["ground_sign_direction"=8]`);
        dimension.getBlock(sign.Position)?.getComponent("minecraft:sign")?.setText(sign.Text);
    }

    for (const control of WallControls)
    {
        const support = dimension.getBlock(control.Position)!;
        const binding: Diagetic.BlockBinding = { Dimension: dimension.id,
            Position: control.Position,
            Face: control.Face,
            ExpectedBlockType: support.typeId };
        const handle = Definition(control.EntityType).Spawn(dimension, Diagetic.BindingLocation(binding),
            { initialPersistence: true,
                Binding: binding,
                Initialize: (entity: Entity) =>
                {
                    if (control.Tag)
                    {
                        entity.addTag(control.Tag);
                    }
                } });
        Feedback(handle, handle.Definition.Kind === "lever" ? "Off" : handle.Definition.Kind === "slider"
            ? "0%" : "0°");
    }

    for (const control of FreeControls)
    {
        const handle = Definition(control.EntityType).Spawn(dimension, control.Location,
            { initialPersistence: true,
                initialRotation: control.Yaw,
                Pose: { Offset: { x: 0,
                    y: Diagetic.CarrierSize / 2,
                    z: 0 },
                Rotation: control.Rotation } });
        Feedback(handle, handle.Definition.Kind === "lever" ? "Off" : handle.Definition.Kind === "slider"
            ? "0%" : "0°");
    }

    world.setDynamicProperty(DynamicProperty.Scene, SceneVersion);
}

/**
 * Reports entity counts and one published built-in pose, then the readiness marker.
 *
 * @category Testing
 * @since 1.0.0
 */
function Report(dimension: Dimension): void
{
    const counts: Record<string, number> = {};
    for (const type of [ ...BuiltinTypes, ...DemoControls.map((control: Diagetic.Definition) =>
        control.EntityType) ])
    {
        counts[type] = dimension.getEntities({ type }).length;
    }

    const lever = dimension.getEntities({ type: BuiltinTypes[0] })
        .sort((a: Entity, b: Entity) => b.location.y - a.location.y)[0];
    const pose = lever && Object.fromEntries(Object.values(Diagetic.Keys.PoseProperty)
        .map((key: string) => [ key, lever.getProperty(key) ]));
    const expected = BuiltinTypes.every((type: string) => counts[type] === Faces.length) &&
        DemoControls.every((control: Diagetic.Definition) => counts[control.EntityType] === 2);
    console.warn(`${Marker.Evidence} ${JSON.stringify({ counts,
        upFaceLever: pose,
        expected })}`);
    if (!expected)
    {
        console.warn(`${Marker.Fail} unexpected control counts`);
    }

    console.warn(Marker.Ready);
}

/**
 * Waits for the scene chunks to load, builds the scene once, then reports.
 *
 * @category Running
 * @since 1.0.0
 */
function Prepare(): void
{
    const dimension = world.getDimension("overworld");
    Command(dimension, `tickingarea add ${At({ x: Wall.From.x - 2,
        y: Floor - 1,
        z: 0 })} ` +
        `${At({ x: Wall.To.x + 2,
            y: Floor + 4,
            z: Wall.To.z + 1 })} ${TickingArea}`);
    const poll = system.runInterval(() =>
    {
        if (!dimension.getBlock({ x: Wall.To.x,
            y: Floor - 1,
            z: Wall.To.z }) ||
            !dimension.getBlock({ x: Wall.From.x,
                y: Floor - 1,
                z: 0 }))
        {
            return;
        }

        system.clearRun(poll);
        try
        {
            if (world.getDynamicProperty(DynamicProperty.Scene) !== SceneVersion)
            {
                Build(dimension);
            }
        }
        catch (error)
        {
            console.warn(`${Marker.Fail} ${String(error)}`);
        }

        system.runTimeout(() => Report(dimension), 40);
    }, 10);
}

Diagetic.Start({ World: world,
    System: system,
    Controls: DemoControls,
    OnError: (error: unknown) => console.warn(`[DiageticDemo] ${String(error)}`) });
system.runTimeout(Prepare, 20);
