/**
 * Pure degree-based rotation conventions, values and helper operations.
 *
 * @module bedform/Internal/Rotator
 *
 * @file      Rotator.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document exported variables at their export declaration. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as Option from "@bedform/effect/Option";
import * as Pipeable from "@bedform/effect/Pipeable";
import type * as R from "../Rotator.js";
import { anglesToQuat, compareNumericKeys, quaternionToAngles, rotationKey } from "./Rotation.js";
import type { RotationKey } from "./Rotation.js";
import { formatComponents } from "./Vector.js";

/**
 * Private enriched Rotator discriminator.
 *
 * @category Constants
 * @since 1.0.0
 */
export const RotatorTypeId = "~bedform/Rotator" as const;

/**
 * Derives canonical Quat keys from winding-reduced degree angles.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotatorKey = (self: R.Coordinates): Option.Option<RotationKey> =>
{
    return Option.flatMap(anglesToQuat(self.pitch, self.yaw, self.roll), rotationKey);
};

/**
 * Orders valid canonical orientations by principal Euler angles and key ties, before raw invalid
 * values.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compareRotators = (self: R.Coordinates, that: R.Coordinates): -1 | 0 | 1 =>
{
    const A = rotatorKey(self);
    const B = rotatorKey(that);
    if (Option.isSome(A) && Option.isSome(B))
    {
        const PrincipalA = Option.getOrElse(quaternionToAngles(A.value), () => [ 0, 0, 0 ]);
        const PrincipalB = Option.getOrElse(quaternionToAngles(B.value), () => [ 0, 0, 0 ]);
        const Principal = compareNumericKeys(PrincipalA, PrincipalB);
        return Principal === 0 ? compareNumericKeys(A.value, B.value) : Principal;
    }

    if (Option.isSome(A))
    {
        return -1;
    }

    if (Option.isSome(B))
    {
        return 1;
    }

    return compareNumericKeys([ self.pitch, self.yaw, self.roll ], [ that.pitch, that.yaw, that.roll ]);
};

/**
 * Formats stored degree fields through the shared Effect-based formatter.
 *
 * @category Operation
 * @since 1.0.0
 */
export const formatRotator = (self: R.Coordinates): string =>
{
    return `Rotator(${formatComponents([ self.pitch, self.yaw, self.roll ])})`;
};

/**
 * Checks the enriched Rotator discriminator.
 *
 * @category Operation
 * @since 1.0.0
 */
export const isRotatorValue = (input: unknown): input is R.Rotator =>
{
    return typeof input === "object" &&
        input !== null && RotatorTypeId in input && input[RotatorTypeId] === RotatorTypeId;
};

/**
 * Shared frozen orientation equality, hashing, piping and inspection.
 *
 * @category Operation
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [RotatorTypeId]: RotatorTypeId,

    /**
     * Compares canonical orientations only within the Rotator kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: R.Rotator, that: Equal.Equal): boolean
    {
        return isRotatorValue(that) && compareRotators(this, that) === 0;
    },

    /**
     * Hashes the canonical valid key or distinct raw invalid fallback.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: R.Rotator): number
    {
        const Key = rotatorKey(this);
        return Hash.combine(Hash.string(RotatorTypeId))(Hash.array(Option.isSome(Key)
            ? [ 0, ...Key.value ] : [ 1, this.pitch, this.yaw, this.roll ]));
    },

    /**
     * Retains raw component precision and winding in JSON.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: R.Rotator): R.Json
    {
        return Object.freeze({ _id: "Rotator",
            pitch: this.pitch,
            roll: this.roll,
            yaw: this.yaw });
    },

    /**
     * Delegates full-precision angle formatting to Effect helpers.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: R.Rotator): string
    {
        return formatRotator(this);
    }
});

/**
 * Copies raw degree components into a frozen shared-prototype value.
 *
 * @category Operation
 * @since 1.0.0
 */
export const makeRotator = (pitch: number, yaw: number, roll: number): R.Rotator =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as R.Rotator, { pitch,
        roll,
        yaw }));
};
