/**
 * Example spring-centred two-axis joystick composed from the Diagetic custom-control hooks.
 *
 * @module bedform/Test/DiageticCustomExample
 *
 * @file      DiageticCustomExample.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Example hooks keep semantic field ordering and rely on contextual hook parameter types. */
/* eslint-disable @typescript-eslint/typedef, sort-keys */

import { Diagetic } from "bedform";
import type { Vector2 } from "@minecraft/server";

/**
 * Synchronized entity properties the example's client entity animates from.
 *
 * @category Constant
 * @since 1.0.0
 */
export const StickProperty = Object.freeze({ X: "example:stick_x",
    Y: "example:stick_y" } as const);

/**
 * Joystick deflection in the unit disc. Pointer is the transient local grab point in blocks;
 * Save omits it, so a reload never resumes a grab.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Stick
{
    readonly X: number;
    readonly Y: number;
    readonly Pointer?: Readonly<Vector2>;
}

/**
 * Local plane distance, in blocks, that corresponds to full deflection.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Reach = 0.2 as const;

/**
 * Fraction of the remaining distance covered per fixed step, snapping within one thousandth.
 * Settling after release uses the same rate toward centre.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Response = 0.5 as const;

/**
 * Limits a deflection to the unit disc.
 *
 * @category Calculating
 * @since 1.0.0
 */
const Disc = (x: number, y: number): Stick =>
{
    const length = Math.hypot(x, y);
    return length > 1 ? { X: x / length,
        Y: y / length } : { X: x,
        Y: y };
};

/**
 * Hook configuration, exported so tests and consumers can compose additional behavior around it.
 * Acquire places the pointer at the current deflection; Look moves it through the frozen camera,
 * halving estimated correction-gap samples; Simulate follows the pointer while held and springs
 * to centre after release; Release drops the transient pointer; Save/Load persist only X and Y;
 * Publish writes both axes to synchronized entity properties.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const JoystickConfiguration = Object.freeze<Diagetic.Custom.Configuration<Stick>>({
    EntityType: "example:joystick",
    Initial: Object.freeze({ X: 0,
        Y: 0 }),
    InteractionRange: 3,
    Acquire: ({ Value }) => ({ ...Value,
        Pointer: { x: Value.X * Reach,
            y: Value.Y * Reach } }),
    Look: ({ Value, Frame, Delta, Estimated }) =>
    {
        const moved = Diagetic.Simulation.MovePointer(Frame, Value.Pointer!, Delta, Estimated ? 0.5 : 1);
        return moved && { ...Value,
            Pointer: moved };
    },
    Simulate: ({ Value, Held }) =>
    {
        const target = Held && Value.Pointer ? Disc(Value.Pointer.x / Reach, Value.Pointer.y / Reach)
            : { X: 0,
                Y: 0 };
        let x = Value.X + (target.X - Value.X) * Response;
        let y = Value.Y + (target.Y - Value.Y) * Response;
        if (Math.hypot(target.X - x, target.Y - y) < 1e-3)
        {
            x = target.X;
            y = target.Y;
        }

        const moved = x !== Value.X || y !== Value.Y;
        return { Value: moved ? { ...Value,
            X: x,
            Y: y } : undefined,
        Settled: !Held && !moved };
    },
    Release: ({ Value }) => ({ X: Value.X,
        Y: Value.Y }),
    Save: ({ X, Y }) => ({ X,
        Y }),
    Load: (saved) =>
    {
        const { X, Y } = (saved ?? {}) as Partial<Stick>;
        if (typeof X !== "number" || typeof Y !== "number" || !Number.isFinite(X) ||
            !Number.isFinite(Y) || Math.hypot(X, Y) > 1 + 1e-9)
        {
            throw new RangeError("Saved joystick deflection must be finite and inside the unit disc");
        }

        return { X,
            Y };
    },
    Publish: ({ Control, Value }) =>
    {
        Control.Entity.setProperty(StickProperty.X, Value.X);
        Control.Entity.setProperty(StickProperty.Y, Value.Y);
    }
});

/**
 * The registered joystick definition; pass it to Diagetic.Start with any built-in controls.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Joystick = Diagetic.Custom.Make(JoystickConfiguration);
