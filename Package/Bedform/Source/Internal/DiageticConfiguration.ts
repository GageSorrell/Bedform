/**
 * Validation and immutable snapshots shared by Diagetic definitions and pure motion.
 *
 * @module bedform/Internal/DiageticConfiguration
 *
 * @file      DiageticConfiguration.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Validated configuration retains semantic field ordering. */
/* eslint-disable sort-keys */

import type { BlockBinding, Configuration, Limits } from "../Diagetic.js";
import type { Vector3 } from "@minecraft/server";

const Builtin = Object.freeze({ lever: "bedform:diagetic_lever",
    slider: "bedform:diagetic_slider",
    wheel: "bedform:diagetic_wheel" } as const);

/**
 * Requires a finite number within optional inclusive limits.
 *
 * @throws { RangeError } If the value is non-finite or outside the configured limits.
 *
 * @category Validation
 * @since 1.0.0
 */
export const CheckValue = (value: number, limits?: Limits): number =>
{
    if (!Number.isFinite(value) || limits && (value < limits.Min || value > limits.Max))
    {
        throw new RangeError("Diagetic value must be finite and within its limits");
    }

    return value;
};

/**
 * Validates a scalar motion parameter against its lower bound.
 *
 * @throws { RangeError } If the parameter is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
export const Parameter = (value: number, name: string, positive: boolean = false): number =>
{
    if (!Number.isFinite(value) || (positive ? value <= 0 : value < 0))
    {
        throw new RangeError(`Diagetic ${name} must be finite and ${positive ? "positive" : "nonnegative"}`);
    }

    return value;
};

/**
 * Validates an authored namespaced content identifier.
 *
 * @throws { TypeError } If the identifier is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
export const Identifier = (value: string): string =>
{
    if (typeof value !== "string" || !/^[a-z0-9_]+:[a-z0-9_./-]+$/u.test(value))
    {
        throw new TypeError("Diagetic entity and block types must be namespaced identifiers");
    }

    return value;
};

/**
 * Copies and freezes a finite native coordinate triple.
 *
 * @throws { RangeError } If coordinates are missing or non-finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Coordinates = (value: Readonly<Vector3>): Readonly<Vector3> =>
{
    if (!value || ![ value.x, value.y, value.z ].every(Number.isFinite))
    {
        throw new RangeError("Diagetic coordinates must be finite");
    }

    return Object.freeze({ x: value.x,
        y: value.y,
        z: value.z });
};

/**
 * Snapshots spawn receipts before creating a native entity.
 *
 * @throws { TypeError } If a binding's dimension or face is invalid.
 * @throws { RangeError } If coordinates are invalid or a block position is not integral.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Binding = (value: BlockBinding | undefined): BlockBinding | undefined =>
{
    if (!value)
    {
        return undefined;
    }

    if (typeof value.Dimension !== "string" || !value.Dimension.trim() ||
        ![ "Up", "Down", "North", "South", "East", "West" ].includes(value.Face))
    {
        throw new TypeError("Diagetic binding requires a dimension and native block face");
    }

    const position = Coordinates(value.Position);
    if (![ position.x, position.y, position.z ].every(Number.isInteger))
    {
        throw new RangeError("Diagetic support position must contain integer block coordinates");
    }

    return Object.freeze({ Dimension: value.Dimension,
        Position: position,
        Face: value.Face,
        ExpectedBlockType: Identifier(value.ExpectedBlockType) });
};

/**
 * Creates a frozen configuration snapshot and validates all motion policy without invoking user code.
 *
 * @throws { TypeError } If the kind, content identifier or callback is invalid.
 * @throws { RangeError } If numeric policy is inconsistent or non-finite.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Configure = (input: Configuration): Configuration =>
{
    if (!input || !Object.hasOwn(Builtin, input.Kind))
    {
        throw new TypeError("Diagetic Kind must be lever, slider or wheel; buttons are unsupported");
    }

    const limits = input.Limits ?? (input.Kind === "wheel" ? undefined : { Min: 0,
        Max: 1 });
    if (limits && (!Number.isFinite(limits.Min) || !Number.isFinite(limits.Max) || limits.Min >= limits.Max))
    {
        throw new RangeError("Diagetic limits require finite Min < Max");
    }

    const detents = input.Detents ?? (input.Kind === "lever" && limits ? [ limits.Min, limits.Max ] : []);
    if (!Array.isArray(detents))
    {
        throw new TypeError("Diagetic detents must be an array");
    }

    for (const detent of detents)
    {
        CheckValue(detent, limits);
    }

    if (input.Spring)
    {
        CheckValue(input.Spring.Target, limits);
        Parameter(input.Spring.Strength, "spring strength");
    }

    for (const name of [ "Eligible", "OnGrab", "OnChange", "OnRelease", "OnCancel" ] as const)
    {
        if (input[name] !== undefined && typeof input[name] !== "function")
        {
            throw new TypeError(`Diagetic ${name} must be a function`);
        }
    }

    const geometry = input.Kind === "lever"
        ? { ArcDegrees: Parameter(input.ArcDegrees ?? 90, "arc", true),
            ArmLength: Parameter(input.ArmLength ?? 0.375, "arm length", true) }
        : input.Kind === "slider" ? { Length: Parameter(input.Length ?? 0.5, "length", true) }
            : { Radius: Parameter(input.Radius ?? 0.25, "radius", true),
                DeadZone: Parameter(input.DeadZone ?? 0.05, "dead zone") };
    if (geometry.DeadZone !== undefined && geometry.Radius !== undefined &&
        geometry.DeadZone >= geometry.Radius)
    {
        throw new RangeError("Diagetic dead zone must be smaller than the wheel radius");
    }

    return Object.freeze({ ...input,
        ...geometry,
        EntityType: Identifier(input.EntityType ?? Builtin[input.Kind]),
        InitialValue: CheckValue(input.InitialValue ?? limits?.Min ?? 0, limits),
        Sensitivity: Parameter(input.Sensitivity ?? 1, "sensitivity"),
        Inertia: Parameter(input.Inertia ?? 1, "inertia", true),
        Damping: Parameter(input.Damping ?? 8, "damping"),
        Friction: Parameter(input.Friction ?? 0, "friction"),
        DriveStrength: Parameter(input.DriveStrength ?? 120, "drive strength", true),
        DetentStrength: Parameter(input.DetentStrength ?? 40, "detent strength"),
        InteractionRange: Parameter(input.InteractionRange ?? 3, "interaction range", true),
        Limits: limits && Object.freeze({ Min: limits.Min,
            Max: limits.Max }),
        Detents: Object.freeze([ ...detents ]),
        Spring: input.Spring && Object.freeze({ Target: input.Spring.Target,
            Strength: input.Spring.Strength }) });
};

