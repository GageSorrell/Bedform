/**
 * Pure validation and immutable snapshots for Intent values, options and wire payload sizes.
 *
 * @module bedform/Spatial/Internal/IntentValue
 *
 * @file      IntentValue.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Builtin, type BuiltinDefinition, type Definition, type Options, type ResolvedOptions }
    from "../Intent.js";
import { MaxMessageBytes } from "../../Canvas/Public/Intent.js";

/**
 * Rejects nonrecord input before reading protocol fields.
 *
 * @throws { TypeError } If the value is not an object record.
 *
 * @category Validation
 * @since 1.0.0
 */
export function RecordValue(value: unknown): Record<string, unknown>
{
    if (value === null || typeof value !== "object" || Array.isArray(value))
    {
        throw new TypeError("Canvas Intent expects an object record.");
    }

    return value as Record<string, unknown>;
}

/**
 * Enforces a finite positive scalar, optionally restricted to safe integers.
 *
 * @throws { TypeError } If the scalar is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
function Positive(value: unknown, field: string, integer: boolean = false): number
{
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
        (integer && !Number.isSafeInteger(value)))
    {
        throw new TypeError(`Canvas Intent ${field} must be a positive ` +
            `${integer ? "safe integer" : "number"}.`);
    }

    return value;
}

/**
 * Recognizes bounded namespaced identifiers shared by generated images and calling add-ons.
 *
 * @category Predicate
 * @since 1.0.0
 */
export function IsIdentifier(value: unknown): value is string
{
    return typeof value === "string" && value.length <= 64 && /^[a-z0-9_.-]+:[a-z0-9_./-]+$/u.test(value);
}

/**
 * Validates a public definition even when a caller bypasses its TypeScript type or constructor.
 * Only recognized fields are serialized; mutable user objects are never retained.
 *
 * @throws { TypeError } If the definition or its metrics are invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckDefinition(value: unknown): Definition
{
    const input = RecordValue(value);
    if (input.Kind === "builtin")
    {
        const builtin = Object.values(Builtin).find((entry: BuiltinDefinition) => entry.Name === input.Name);
        if (!builtin)
        {
            throw new TypeError("Canvas Intent builtin name is unknown.");
        }

        return builtin;
    }

    if (input.Kind === "glyphs")
    {
        if (typeof input.Text !== "string" || !/^[\uE000-\uF8FF]{1,3}$/u.test(input.Text))
        {
            throw new TypeError("Canvas Intent Glyphs requires exactly one to three BMP PUA characters.");
        }

        if (input.Metrics === undefined)
        {
            return Object.freeze({ Kind: "glyphs",
                Text: input.Text });
        }

        const metrics = RecordValue(input.Metrics);
        let advances: ReadonlyArray<number> | undefined;
        if (metrics.Advances !== undefined)
        {
            if (!Array.isArray(metrics.Advances) || metrics.Advances.length !== input.Text.length)
            {
                throw new TypeError("Canvas Intent Advances must contain one value per glyph.");
            }

            advances = Object.freeze(metrics.Advances.map((width: unknown) => Positive(width, "advance")));
        }

        const height = metrics.Height === undefined ? undefined : Positive(metrics.Height, "glyph height");
        return Object.freeze({ Kind: "glyphs",
            Metrics: Object.freeze({
                ...advances === undefined ? {} : { Advances: advances },
                ...height === undefined ? {} : { Height: height }
            }),
            Text: input.Text });
    }

    if (input.Kind === "image")
    {
        if (input.Version !== 1 || !IsIdentifier(input.Id) || !IsIdentifier(input.Particle))
        {
            throw new TypeError("Canvas Intent image descriptor needs version 1 and namespaced Id/Particle.");
        }

        return Object.freeze({ FrameCount: Positive(input.FrameCount, "image frame count", true),
            FrameTicks: Positive(input.FrameTicks, "image frame ticks", true),
            Height: Positive(input.Height, "image height", true),
            Id: input.Id,
            Kind: "image",
            Particle: input.Particle,
            Version: 1,
            Width: Positive(input.Width, "image width", true) });
    }

    throw new TypeError("Canvas Intent definition Kind must be builtin, glyphs or image.");
}

/**
 * Copies finite presentation options and fills the documented transport defaults.
 *
 * @throws { TypeError } If any supplied option is invalid.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckOptions(value: Options = {}): ResolvedOptions
{
    const input = RecordValue(value);
    const offset = input.Offset === undefined ? { x: 0,
        y: 0.25,
        z: 0 } : RecordValue(input.Offset);
    for (const axis of [ "x", "y", "z" ])
    {
        if (typeof offset[axis] !== "number" || !Number.isFinite(offset[axis]))
        {
            throw new TypeError("Canvas Intent Offset must contain finite x, y and z coordinates.");
        }
    }

    return Object.freeze({ DurationTicks: input.DurationTicks === undefined
        ? null : Positive(input.DurationTicks, "DurationTicks", true),
    MaxDistance: input.MaxDistance === undefined ? 32 : Positive(input.MaxDistance, "MaxDistance"),
    Offset: Object.freeze({ x: offset.x as number,
        y: offset.y as number,
        z: offset.z as number }),
    Scale: input.Scale === undefined ? 1 : Positive(input.Scale, "Scale") });
}

/**
 * Measures UTF-8 without Node or Web APIs and bounds JSON transport messages.
 *
 * @throws { TypeError } If the message exceeds the public wire budget.
 *
 * @category Validation
 * @since 1.0.0
 */
export function CheckMessage(message: string): void
{
    let bytes = 0;
    for (const character of message)
    {
        const code = character.codePointAt(0)!;
        bytes += code <= 0x7F ? 1 : code <= 0x7_FF ? 2 : code <= 0xFF_FF ? 3 : 4;
    }

    if (bytes > MaxMessageBytes)
    {
        throw new TypeError(`Canvas Intent message exceeds ${MaxMessageBytes} UTF-8 bytes.`);
    }
}
