/**
 * Two-process native save/reopen qualification for control records and block-face bindings.
 *
 * @module @sorrell/look-input-demo/Tool/DiageticPersistenceFixture
 *
 * @file      DiageticPersistenceFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Native assertions retain contextual inference and geometric field ordering. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import * as D from "../../../Package/Bedform/Source/Diagetic.js";
import { BlockPermutation, Direction, GameMode, system, world } from "@minecraft/server";
import { DynamicProperty, ProbeEntity, TickingArea } from "./ToggleKeys.mjs";
import { CaptureFrame } from "../../../Package/Bedform/Source/Internal/DiageticFrame.js";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

/**
 * Native actor identity and expected scalar recorded by the first server process.
 *
 * @category Testing
 * @since 1.0.12
 */
interface RecordEntry
{
    readonly Id: string;
    readonly Value: number;
    readonly Face?: Direction;
}

const Wait = (ticks: number) => new Promise<void>((resolve: () => void) => system.runTimeout(resolve, ticks));
const Check = (condition: unknown, message: string): void =>
{
    if (!condition)
    {
        throw new Error(message);
    }
};

system.run(() =>
{
    void (async () =>
    {
        const dimension = world.getDimension("overworld");
        const saved = world.getDynamicProperty(DynamicProperty.Persistence);
        if (saved === undefined)
        {
            dimension.runCommand(`tickingarea add circle 0 -60 3 2 ${TickingArea.Scene}`);
        }

        await Wait(12);
        const support = { x: 0,
            y: -60,
            z: 3 };
        const definition = D.Slider({ EntityType: ProbeEntity,
            InteractionRange: 10 });
        const errors: Array<unknown> = [];
        const runtime = D.Start({ World: world,
            System: system,
            Controls: [ definition ],
            OnError: (error: unknown) => errors.push(error) });
        if (saved === undefined)
        {
            dimension.runCommand("fill -8 -61 -8 8 -61 8 smooth_stone");
            dimension.getBlock(support)!.setType("minecraft:oak_log");
            const records: Array<RecordEntry> = [];
            for (const [ index, face ] of Object.values(Direction).entries())
            {
                const value = (index + 1) / 10;
                const control = definition.Spawn(dimension, { x: 0.5,
                    y: -59,
                    z: 3.5 }, {
                    Value: value,
                    Binding: { Dimension: dimension.id,
                        Position: support,
                        Face: face,
                        ExpectedBlockType: "minecraft:oak_log" }
                });
                records.push({ Id: control.Entity.id,
                    Value: value,
                    Face: face });
            }

            const free = definition.Spawn(dimension, { x: 2.5,
                y: -59,
                z: 3.5 }, { Value: 0.875,
                Pose: { Offset: { x: 0.1,
                    y: 0.2,
                    z: 0.3 } } });
            records.push({ Id: free.Entity.id,
                Value: 0.875 });
            const player = spawnSimulatedPlayer({ dimension,
                x: 0.5,
                y: -59,
                z: 6.5 },
            "InterruptedOwner", GameMode.Creative);
            await Wait(5);
            const south = records.find((record) => record.Face === Direction.South)!;
            player.setRotation({ x: 0,
                y: 180 });
            runtime.Interact(player, world.getEntity(south.Id)!);
            await Wait(3);
            Check(runtime.IsInteracting(player), "first process never acquired the persisted control: " +
                errors.map(String).join("; "));
            world.setDynamicProperty(DynamicProperty.Persistence, JSON.stringify(records));
            Check(errors.length === 0, "first process reported runtime errors");
            console.warn("DIAGETIC_PERSISTENCE_EVIDENCE " + JSON.stringify({ savedActors: records.length,
                interruptedGrab: true,
                physicalInputVerified: false }));
            // Deliberately leave the session active when the runner stops this server process.
            console.warn("DIAGETIC_PERSISTENCE_SAVED");
            return;
        }

        const records = JSON.parse(String(saved)) as Array<RecordEntry>;
        const controls = records.map((record) =>
        {
            const entity = world.getEntity(record.Id);
            Check(entity?.isValid, "saved control did not survive server restart");
            const control = definition.Attach(entity!);
            Check(control.Value === record.Value, "saved scalar changed on restart");
            Check(!control.Motion.State.Dragging && control.Motion.State.Velocity === 0,
                "restart resumed held motion");
            Check(control.Binding?.Face === record.Face, "saved face changed on restart");
            if (record.Face)
            {
                Check(control.Binding!.ExpectedBlockType === "minecraft:oak_log", "support type was lost");
            }
            else
            {
                Check(control.Pose.Offset.z === 0.3, "free control pose was lost");
            }

            return control;
        });
        Check(controls.length === 7, "restart duplicated or lost controls");
        const axes = { Up: [ 0, 1, 0 ],
            Down: [ 0, -1, 0 ],
            North: [ 0, 0, -1 ],
            South: [ 0, 0, 1 ],
            East: [ 1, 0, 0 ],
            West: [ -1, 0, 0 ] };
        // CaptureFrame only needs a native-shaped eye source for geometric inspection.
        for (const control of controls.filter((entry) => entry.Binding))
        {
            const source = { getHeadLocation: () => ({ x: 0.5,
                y: -58,
                z: 6.5 }) };
            const frame = CaptureFrame(source as Parameters<typeof CaptureFrame>[0], control, { x: 0,
                y: 180 });
            const normal = frame.Mount.Normal;
            const expected = axes[control.Binding!.Face];
            Check([ normal.x, normal.y, normal.z ].every((value, index) =>
                Math.abs(value - expected[index]) < 1e-10), "persisted face normal changed");
        }

        dimension.getBlock(support)!.setPermutation(BlockPermutation.resolve("minecraft:oak_log",
            { pillar_axis: "x" }));
        await Wait(3);
        Check(controls.every((control) => control.IsValid), "ordinary block state change removed controls");
        dimension.getBlock(support)!.setType("minecraft:stone");
        await Wait(3);
        Check(controls.filter((entry) => entry.Binding).every((control) => !control.IsValid),
            "changed support retained a bound control");
        Check(controls.at(-1)!.IsValid, "support replacement removed the free control");
        controls.at(-1)!.Remove();
        runtime.Dispose();
        Check(errors.length === 0, "second process reported runtime errors");
        Check(dimension.getEntities({ type: ProbeEntity }).length === 0, "duplicate actors survived cleanup");
        dimension.runCommand(`tickingarea remove ${TickingArea.Scene}`);
        console.warn("DIAGETIC_PERSISTENCE_EVIDENCE " + JSON.stringify({ serverRestart: true,
            restoredActors: 7,
            sixFaces: true,
            freePoseRestored: true,
            inactiveAfterRestart: true,
            ordinaryStateRetained: true,
            replacedSupportRemoved: true,
            duplicateActors: 0,
            physicalInputVerified: false }));
        console.warn("DIAGETIC_PERSISTENCE_PASS");
    })().catch((error: unknown) => console.warn("DIAGETIC_PERSISTENCE_FAIL " + String(error)));
});
