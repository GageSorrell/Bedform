/**
 * Demonstration control definitions with distinct drag tuning and visible block feedback.
 *
 * @module @sorrell/diagetic-demo/Script/Controls
 *
 * @file      Controls.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Definitions retain semantic configuration ordering. */
/* eslint-disable sort-keys */

import * as Diagetic from "../../../Package/Bedform/Source/Diagetic.js";
import { Tag } from "./Keys.js";
import type { Vector3 } from "@minecraft/server";

/**
 * Demo entity identifiers. Each reuses the shared BedformCommon model of its kind.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DemoEntity = Object.freeze({ HeavyLever: "diagetic_demo:heavy_lever",
    SpringThrottle: "diagetic_demo:spring_throttle",
    NotchedDial: "diagetic_demo:notched_dial" } as const);

/**
 * Number of blocks in a gauge bar.
 *
 * @category Constant
 * @since 1.0.0
 */
export const GaugeLength = 8 as const;

/**
 * Sets one block, ignoring unloaded positions so feedback can never cancel a session.
 *
 * @category Rendering
 * @since 1.0.0
 */
function SetBlock(control: Diagetic.Handle, position: Vector3, type: string): void
{
    const block = control.Entity.dimension.getBlock(position);
    if (block && block.typeId !== type)
    {
        block.setType(type);
    }
}

/**
 * Shows the value above the control and drives tagged lamp or gauge feedback above its support block.
 * A lamp is powered by a redstone block placed directly above the support; a gauge lights a row of
 * concrete two blocks above the support.
 *
 * @category Rendering
 * @since 1.0.0
 */
export function Feedback(control: Diagetic.Handle, label: string): void
{
    control.Entity.nameTag = label;
    const support = control.Binding?.Position;
    if (!support)
    {
        return;
    }

    if (control.Entity.hasTag(Tag.Lamp))
    {
        SetBlock(control, { x: support.x,
            y: support.y + 1,
            z: support.z }, control.Value >= 0.5 ? "minecraft:redstone_block" : "minecraft:smooth_stone");
    }

    if (control.Entity.hasTag(Tag.Gauge))
    {
        const lit = Math.round(control.Value * GaugeLength);
        for (let index = 0; index < GaugeLength; index++)
        {
            SetBlock(control, { x: support.x - GaugeLength / 2 + 1 + index,
                y: support.y + 2,
                z: support.z }, index < lit ? "minecraft:lime_concrete" : "minecraft:gray_concrete");
        }
    }
}

/**
 * A heavy lever: high inertia and a weak drive make it lag the hand, then it settles on an endpoint.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const HeavyLever = Diagetic.Lever({ EntityType: DemoEntity.HeavyLever,
    Inertia: 5,
    DriveStrength: 30,
    Damping: 6,
    OnChange: ({ Control, Value }: Diagetic.ChangeEvent) => Feedback(Control, Value >= 0.5 ? "On" : "Off") });

/**
 * A throttle with a return spring: it follows the hand while held and springs back to zero on release.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const SpringThrottle = Diagetic.Slider({ EntityType: DemoEntity.SpringThrottle,
    Spring: { Target: 0,
        Strength: 30 },
    Damping: 10,
    OnChange: ({ Control, Value }: Diagetic.ChangeEvent) =>
        Feedback(Control, `${Math.round(Value * 100)}%`) });

/**
 * A dial limited to two turns either way, with strong detents every forty-five degrees.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const NotchedDial = Diagetic.Wheel({ EntityType: DemoEntity.NotchedDial,
    InitialValue: 0,
    Limits: { Min: -720,
        Max: 720 },
    Detents: Array.from({ length: 33 }, (_: unknown, index: number) => -720 + index * 45),
    DetentStrength: 80,
    Damping: 10,
    OnChange: ({ Control, Value }: Diagetic.ChangeEvent) => Feedback(Control, `${Math.round(Value)}°`) });

/**
 * Demo definitions registered by this pack's runtime, keyed by entity type.
 *
 * @category Constant
 * @since 1.0.0
 */
export const DemoControls: ReadonlyArray<Diagetic.Definition> = Object.freeze([ HeavyLever, SpringThrottle,
    NotchedDial ]);
