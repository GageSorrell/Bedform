/**
 * Published control-kind inference, native spawn options and callback contract qualification.
 *
 * @module bedform/Test/Diagetic.types
 *
 * @file      Diagetic.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Contract fixtures preserve semantic ordering and contextual callback inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys */

import { Diagetic } from "bedform";
import * as Direct from "bedform/Diagetic";
import type { Dimension as NativeDimension, Entity as NativeEntity, Player, SpawnEntityOptions,
    System as NativeSystem, World as NativeWorld } from "@minecraft/server";

declare const Dimension: NativeDimension;
declare const Entity: NativeEntity;
declare const NativePlayer: Player;
declare const System: NativeSystem;
declare const World: NativeWorld;
declare const NativeOptions: SpawnEntityOptions;

const Lever: Direct.Definition<"lever"> = Diagetic.Make({ Kind: "lever",
    ArcDegrees: 110,
    ArmLength: 0.4,
    DriveStrength: 100,
    DetentStrength: 30 });
const Slider: Direct.Definition<"slider"> = Direct.Slider({ Length: 0.4,
    OnChange: (event) =>
    {
        const value: number = event.Value;
        const native: NativeEntity = event.Control.Entity;
        void [ value, native, event.Source ];
    } });
const Wheel: Direct.Definition<"wheel"> = Direct.Wheel({ Radius: 0.25,
    DeadZone: 0.05,
    OnGrab: (event) => { void event.Player.inputPermissions; },
    OnCancel: (event) => { void event.Reason; },
    Eligible: (player, handle) => player.isValid && handle.IsValid });
const Spawned: Direct.Handle<"lever"> = Lever.Spawn(Dimension, { x: 0,
    y: 1,
    z: 2 }, {
    ...NativeOptions,
    initialPersistence: true,
    initialRotation: 90,
    spawnEvent: "fixture:spawn",
    Value: 0.5,
    Pose: { Rotation: { x: 90,
        y: 0,
        z: 0 } },
    Initialize: (entity, handle) =>
    {
        const native: NativeEntity = entity;
        const value: number = handle.Value;
        entity.nameTag = String(value);
        void native;
    }
});
const Attached: Direct.Handle<"slider"> = Slider.Attach(Entity);
Attached.SetValue(0.5);
declare const Frame: Direct.Simulation.Frame;
const Pure: Direct.Simulation.Controller = Diagetic.Simulation.Make({ Kind: "wheel" });
Pure.Begin(Frame);
Pure.Look({ Delta: { x: 1,
    y: 2 },
Estimated: true });
const Snapshot: Direct.Simulation.Snapshot = Pure.Step();
Pure.Release();
Attached.Motion.Begin(Frame);
Attached.Motion.Step();
Attached.Motion.Release();
void [ Snapshot.Point, Snapshot.Settled, Snapshot.Velocity, Direct.Simulation.StepSeconds ];
const Runtime: Direct.Runtime = Diagetic.Start({ World,
    System,
    Controls: [ Lever, Slider, Wheel ],
    OnError: (error: unknown) => { void error; } });
const Handled: boolean = Runtime.Interact(NativePlayer, Entity);
const Held: boolean = Runtime.IsInteracting(NativePlayer);
void [ Handled, Held ];
Runtime.Dispose();
Spawned.Remove();

// @ts-expect-error Buttons are not a supported control kind.
Diagetic.Make({ Kind: "button" });
Diagetic.Make({ Kind: "lever",
    // @ts-expect-error Wheel geometry does not belong to a lever configuration.
    Radius: 0.5 });
// @ts-expect-error A convenience constructor supplies its own discriminant.
Diagetic.Wheel({ Kind: "slider" });
// @ts-expect-error Live values must be changed through SetValue.
Attached.Value = 1;
// @ts-expect-error Required explicit native dependencies cannot be omitted.
Direct.Start({ Controls: [ Lever ] });
Lever.Spawn(Dimension, { x: 0,
    y: 0,
    z: 0 }, {
    // @ts-expect-error Native yaw remains numeric.
    initialRotation: "90" });
// @ts-expect-error A wheel definition is not a slider definition.
const Wrong: Direct.Definition<"slider"> = Wheel;
void Wrong;

interface Gear
{
    readonly Slot: number;
}

const Gearbox: Direct.Custom.Definition<Gear> = Diagetic.Custom.Make<Gear>({ EntityType: "fixture:gearbox",
    Initial: { Slot: 0 },
    InteractionRange: 2,
    Eligible: (player, handle) => player.isValid && handle.Value.Slot >= 0,
    Acquire: (event) =>
    {
        const frame: Direct.Simulation.Frame = event.Frame;
        void frame;
    },
    Look: (event) =>
    {
        const estimated: boolean = event.Estimated;
        const moved = Diagetic.Simulation.MovePointer(event.Frame, { x: 0,
            y: 0 }, event.Delta, estimated ? 0.5 : 1);
        return moved && { Slot: Math.sign(moved.x) };
    },
    Simulate: (event) => ({ Settled: !event.Held && event.StepSeconds > 0 }),
    Release: (event) =>
    {
        const reason: Direct.CancellationReason | undefined = event.Reason;
        return reason ? { Slot: 0 } : undefined;
    },
    Save: (value) => value.Slot,
    Load: (saved) => ({ Slot: Number(saved) }),
    Publish: (event) =>
    {
        event.Control.Entity.setProperty("fixture:slot", event.Value.Slot);
        void (event.Source === "attach");
    },
    OnChange: (event) =>
    {
        const previous: Gear = event.PreviousValue;
        const source: Direct.Custom.Source = event.Source;
        void [ previous, source ];
    } });
const Shifter: Direct.Custom.Handle<Gear> = Gearbox.Spawn(Dimension, { x: 0,
    y: 1,
    z: 0 }, { ...NativeOptions,
    Value: { Slot: 1 },
    Initialize: (entity, handle) =>
    {
        entity.nameTag = String(handle.Value.Slot);
    } });
Shifter.SetValue({ Slot: 2 });
const Status: Direct.Custom.Status = Shifter.Motion.State;
void [ Status.Held, Status.Settled, Status.Estimated ];
const Mixed: Direct.Runtime = Direct.Start({ World,
    System,
    Controls: [ Lever, Gearbox ] });
Mixed.Dispose();

// @ts-expect-error Custom values keep their declared type.
Shifter.SetValue({ Slot: "2" });
// @ts-expect-error Custom controls require explicit persistence hooks.
Diagetic.Custom.Make({ EntityType: "fixture:x",
    Initial: 0 });
// @ts-expect-error Custom values are changed through SetValue.
Shifter.Value = { Slot: 3 };
// @ts-expect-error A custom definition is not a built-in definition.
const NotBuiltIn: Direct.Definition = Gearbox;
void NotBuiltIn;
