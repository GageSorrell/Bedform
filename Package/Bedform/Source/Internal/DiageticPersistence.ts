/**
 * Versioned entity-owned Diagetic scalar, model pose and supporting-block persistence.
 *
 * @module bedform/Internal/DiageticPersistence
 *
 * @file      DiageticPersistence.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Durable field ordering is shared by initial writes and scalar updates. */
/* eslint-disable sort-keys */

import { Binding, CheckValue, Coordinates } from "./DiageticConfiguration.js";
import type { BlockBinding, Configuration, Kind, ModelPose } from "../Diagetic.js";
import { DynamicProperty } from "../Diagetic/Keys.js";
import type { Entity } from "@minecraft/server";

/**
 * Durable control data; velocity, held targets and player ownership are deliberately transient.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SavedControl
{
    readonly Version: 1;
    readonly Kind: Kind;
    readonly Value: number;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
}

/**
 * Durable custom-control data. Value is the JSON-compatible result of the definition's Save hook;
 * transient held, frame and holder state is never written.
 *
 * @category Model
 * @since 1.0.0
 */
export interface SavedCustom
{
    readonly Version: 1;
    readonly Kind: "custom";
    readonly Value: unknown;
    readonly Pose: ModelPose;
    readonly Binding?: BlockBinding;
}

/**
 * Copies a finite model pose without retaining caller-owned coordinate objects.
 *
 * @throws { RangeError } If pose coordinates are malformed.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const Pose = (input?: Partial<ModelPose>): ModelPose =>
{
    return Object.freeze({
        Offset: Coordinates(input?.Offset ?? { x: 0,
            y: 0,
            z: 0 }),
        Rotation: Coordinates(input?.Rotation ?? { x: 0,
            y: 0,
            z: 0 })
    });
};

/**
 * Parses the raw version-one record without interpreting its kind-specific value.
 *
 * @throws { Error } If the retirement marker or durable record is malformed.
 *
 * @category Decoding
 * @since 1.0.0
 */
const ReadRecord = (entity: Entity, kind: Kind | "custom"): Omit<SavedCustom, "Kind"> | undefined =>
{
    const retired = entity.getDynamicProperty(DynamicProperty.Retired);
    if (retired !== undefined && retired !== true)
    {
        throw new Error("Malformed Diagetic retirement marker");
    }

    const raw = entity.getDynamicProperty(DynamicProperty.Control);
    if (raw === undefined)
    {
        return undefined;
    }

    if (typeof raw !== "string" || raw.length > 16_384)
    {
        throw new Error("Malformed Diagetic control record");
    }

    const value = JSON.parse(raw) as SavedCustom;
    if (!value || value.Version !== 1 || value.Kind !== kind || value.Value === undefined ||
        !value.Pose || !value.Pose.Offset || !value.Pose.Rotation ||
        value.Binding !== undefined && (!value.Binding || typeof value.Binding !== "object"))
    {
        throw new Error("Unsupported or malformed Diagetic control record");
    }

    return Object.freeze({ Version: 1,
        Value: value.Value,
        Pose: Pose(value.Pose),
        Binding: Binding(value.Binding) });
};

/**
 * Reads a strict version-one record, preserving unsupported or corrupt data without granting defaults.
 * Updated definitions must still accept the persisted kind and scalar limits.
 *
 * @throws { Error } If durable state is malformed, unsupported or incompatible with the definition.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const ReadControl = (entity: Entity, configuration: Configuration): SavedControl | undefined =>
{
    const value = ReadRecord(entity, configuration.Kind);
    return value && Object.freeze({ Version: 1,
        Kind: configuration.Kind,
        Value: CheckValue(value.Value as number, configuration.Limits),
        Pose: value.Pose,
        Binding: value.Binding });
};

/**
 * Reads a strict version-one custom record. Its value is decoded by the definition's Load hook.
 *
 * @throws { Error } If durable state is malformed, unsupported or belongs to a built-in kind.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const ReadCustom = (entity: Entity): SavedCustom | undefined =>
{
    const value = ReadRecord(entity, "custom");
    return value && Object.freeze({ ...value,
        Kind: "custom" });
};

/**
 * Commits one bounded scalar/metadata record and checks native readback before callbacks observe it.
 *
 * @throws { Error } If native storage rejects the write or cannot confirm the committed bytes.
 *
 * @category Serialization
 * @since 1.0.0
 */
export const WriteControl = (entity: Entity, value: SavedControl | SavedCustom): void =>
{
    const raw = JSON.stringify(value);
    if (raw.length > 16_384)
    {
        throw new Error("Diagetic control record is too large");
    }

    entity.setDynamicProperty(DynamicProperty.Control, raw);
    if (entity.getDynamicProperty(DynamicProperty.Control) !== raw)
    {
        throw new Error("Diagetic control record did not commit");
    }
};
