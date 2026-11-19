/**
 * Immutable rigid poses with no scale, acting on column vectors.
 *
 * @module bedform/Transform
 *
 * @file      Transform.ts
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
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as Q from "./Quat.js";
import * as V from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";
import { interpolateComponent } from "./Internal/Transform.js";

/**
 * Discriminates enriched poses from other spatial kinds.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/Transform" as const;

/**
 * Structural pose input expressed in its containing coordinate frame.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly position: V.Coordinates;
    readonly rotation: Q.Coordinates;
}

/**
 * A copied, deeply frozen position and orientation with Effect protocols and no scale.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Transform extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly position: V.Vector3;
    readonly rotation: Q.Quat;
}

/**
 * Full-precision stored components with spatial type discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "Transform";
    readonly position: V.Json;
    readonly rotation: Q.Json;
}

/**
 * Readonly row-major homogeneous matrix acting on column vectors; translation is at 3, 7 and 11.
 *
 * @category Types
 * @since 1.0.0
 */
export type Matrix4 = Q.Matrix4;

/**
 * Data-first and data-last signatures preserving receiver order.
 *
 * @category Types
 * @since 1.0.0
 */
interface Binary<Self, That, Value>
{
    (that: That): (self: Self) => Value;
    (self: Self, that: That): Value;
}

/**
 * Direct and data-last pose interpolation, permitting extrapolation.
 *
 * @category Types
 * @since 1.0.0
 */
interface Interpolation
{
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<Transform>;
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Transform>;
}

/**
 * Builds a binary operation preserving receiver order in pipelines.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Shared frozen piping, inspection, structural position and canonical rotation protocols.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Restricts protocol equality to this spatial kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: Transform, that: Equal.Equal): boolean
    {
        return isTransform(that) && Object.getPrototypeOf(that) === Prototype && equals(this, that);
    },

    /**
     * Combines exact position and canonical orientation hashes with the pose discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Transform): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.position, this.rotation ]));
    },

    /**
     * Retains copied raw position and rotation precision, including unsafe representations.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Transform): Json
    {
        return Object.freeze({ _id: "Transform",
            position: this.position.toJSON() as V.Json,
            rotation: this.rotation.toJSON() as Q.Json });
    },

    /**
     * Emits full-precision stored pose text.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Transform): string
    {
        return format(this);
    }
});

/**
 * Checks the enriched pose discriminator, including unsafe values.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isTransform = (input: unknown): input is Transform =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies and deeply freezes raw components without normalizing, validating or deriving geometry.
 * Caller-owned inputs remain untouched.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const TransformUnsafe = (position: V.Coordinates, rotation: Q.Coordinates): Transform =>
{
    const Value = Object.create(Prototype) as { -readonly [Key in keyof Transform]: Transform[Key] };
    Value.position = V.Vector3Unsafe(position.x, position.y, position.z);
    Value.rotation = Q.QuatUnsafe(rotation.x, rotation.y, rotation.z, rotation.w);
    return Object.freeze(Value);
};

/**
 * Copies finite position and stably normalizes a finite nonzero orientation; invalid input yields None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Transform = (position: V.Coordinates, rotation: Q.Coordinates): Option.Option<Transform> =>
{
    return V.isFinite(position) ? Option.map(Q.normalize(rotation),
        (unit: Q.Quat) => TransformUnsafe(position, unit)) : Option.none();
};

/**
 * Tests the mathematical pose domain without requiring an already unit unsafe orientation.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return V.isFinite(self.position) && Option.isSome(Q.normalize(self.rotation));
};

/**
 * Compares exact stored positions and canonical orientations, including reflexive invalid fallbacks.
 * Fuzzy geometric tolerances never affect protocol equality.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) =>
        V.equals(self.position, that.position) && Q.equals(self.rotation, that.rotation));

/**
 * Maps a local point into the containing frame by rotation and translation. Invalid pose/input or
 * unrepresentable output yields None; unsafe rotations are interpreted after normalization.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transformPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates): Option.Option<V.Vector3> =>
    {
        if (!V.isFinite(self.position))
        {
            return Option.none();
        }

        return Option.flatMap(Q.rotateVector(self.rotation, that), (rotated: V.Vector3) =>
            V.Vector3(rotated.x + self.position.x, rotated.y + self.position.y, rotated.z + self.position.z));
    });

/**
 * Rotates a direction without translating or normalizing its magnitude. Invalid poses or vectors
 * yield None, including poses with invalid positions even though translation is unused.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transformDirection: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => V.isFinite(self.position)
        ? Q.rotateVector(self.rotation, that) : Option.none());

/**
 * Removes translation and then rotation from a containing-frame point. Invalid or unrepresentable
 * intermediate/output coordinates yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const untransformPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => V.isFinite(self.position) && V.isFinite(that)
        ? Q.unrotateVector(self.rotation, V.subtract(that, self.position)) : Option.none());

/**
 * Removes rotation only, preserving the direction magnitude; invalid pose/input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const untransformDirection: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => V.isFinite(self.position)
        ? Q.unrotateVector(self.rotation, that) : Option.none());

/**
 * Composes self after that: position=self.position+rotate(self.rotation,that.position), with
 * Hamilton orientation self.rotation*that.rotation. Invalid or unrepresentable poses yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const compose: Binary<Coordinates, Coordinates, Option.Option<Transform>> = binary(
    (self: Coordinates, that: Coordinates): Option.Option<Transform> =>
    {
        const Position = transformPoint(self, that.position);
        const A = Q.normalize(self.rotation);
        const B = Q.normalize(that.rotation);
        return Option.isSome(Position) && Option.isSome(A) && Option.isSome(B)
            ? Transform(Position.value, Q.multiply(A.value, B.value)) : Option.none();
    });

/**
 * Returns the inverse rigid pose using normalized orientation, or None for invalid/unrepresentable input.
 *
 * @category Operation
 * @since 1.0.0
 */
export const inverse = (self: Coordinates): Option.Option<Transform> =>
{
    const Unit = Q.normalize(self.rotation);
    if (!V.isFinite(self.position) || Option.isNone(Unit))
    {
        return Option.none();
    }

    const Rotation = Q.conjugate(Unit.value);
    return Option.flatMap(Q.rotateVector(Rotation, V.scale(self.position, -1)),
        (position: V.Vector3) => Transform(position, Rotation));
};

/**
 * Produces a copied frozen row-major rigid matrix; translation occupies indices 3, 7 and 11.
 * Invalid poses yield None.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toMatrix = (self: Coordinates): Option.Option<Matrix4> =>
{
    return V.isFinite(self.position) ? Option.map(Q.toMatrix(self.rotation),
        (matrix: Matrix4) => Object.freeze([
            matrix[0], matrix[1], matrix[2], self.position.x,
            matrix[4], matrix[5], matrix[6], self.position.y,
            matrix[8], matrix[9], matrix[10], self.position.z,
            0, 0, 0, 1
        ] as const)) : Option.none();
};

/**
 * Accepts finite rigid homogeneous matrices with proper orthonormal bases. Uses Quat's
 * absolute 1e-10 validation tolerance for basis and homogeneous terms; scale, reflection,
 * shear and perspective outside this numerical tolerance yield None.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromMatrix = (self: Matrix4): Option.Option<Transform> =>
{
    if (self.length !== 16 || !self.every(N.Number.isFinite))
    {
        return Option.none();
    }

    const Rotation: Matrix4 = [
        self[0], self[1], self[2], 0,
        self[4], self[5], self[6], 0,
        self[8], self[9], self[10], 0,
        self[12], self[13], self[14], self[15]
    ];
    return Option.flatMap(Q.fromMatrix(Rotation), (rotation: Q.Quat) =>
        Transform(V.Vector3Unsafe(self[3], self[7], self[11]), rotation));
};

/**
 * Interpolates position componentwise and orientation by shortest-path quaternion slerp.
 * Finite t permits extrapolation; invalid input or unrepresentable output yields None. This
 * mathematical operation does not change the renderer's separately specified normalized lerp.
 *
 * @category Operation
 * @since 1.0.0
 */
export const interpolate: Interpolation = dual(3,
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Transform> =>
    {
        if (!V.isFinite(self.position) || !V.isFinite(that.position) || !N.Number.isFinite(t))
        {
            return Option.none();
        }

        return Option.flatMap(Q.slerp(self.rotation, that.rotation, t), (rotation: Q.Quat) =>
            Transform(V.Vector3Unsafe(interpolateComponent(self.position.x, that.position.x, t),
                interpolateComponent(self.position.y, that.position.y, t),
                interpolateComponent(self.position.z, that.position.z, t)), rotation));
    });

/**
 * Aliases pose interpolation: linear position and shortest-path spherical orientation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const lerp = interpolate;

/**
 * Formats stored x/y/z position followed by x/y/z/w rotation with Effect number formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `Transform(${formatComponents([ self.position.x, self.position.y, self.position.z,
        self.rotation.x, self.rotation.y, self.rotation.z, self.rotation.w ])})`;
};

/**
 * Aliases full-precision default pose formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses default finite pose text without changing stored rotation magnitude; zero/nonfinite
 * orientations yield None. Validating construction separately normalizes orientation.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<Transform> =>
{
    const Match = /^Transform\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 7),
        (values: ReadonlyArray<number>): Option.Option<Transform> =>
        {
            const Pose = TransformUnsafe(V.Vector3Unsafe(values[0], values[1], values[2]),
                Q.QuatUnsafe(values[3], values[4], values[5], values[6]));
            return isValid(Pose) ? Option.some(Pose) : Option.none();
        });
};

/**
 * Aliases strict default pose text parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * Zero translation and identity orientation.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Identity: Transform = TransformUnsafe(V.Zero, Q.Identity);
