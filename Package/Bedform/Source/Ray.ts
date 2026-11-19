/**
 * Immutable forward rays with unit directions and block-distance parameters.
 *
 * @module bedform/Ray
 *
 * @file      Ray.ts
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
import * as T from "./Transform.js";
import * as V from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";

/**
 * Discriminates enriched rays from other spatial values.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/Ray" as const;

/**
 * Allows only normalization roundoff when checking unit directions, independently of query tolerances.
 *
 * @category Internal
 * @since 1.0.0
 */
const UnitTolerance = 8 * N.Number.EPSILON;

/**
 * Structural ray input. Valid queries require finite origin and finite unit direction.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly origin: V.Coordinates;
    readonly direction: V.Coordinates;
}

/**
 * Deeply frozen origin and direction with exact component protocols and forward block-distance queries.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Ray extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly origin: V.Vector3;
    readonly direction: V.Vector3;
}

/**
 * Full-precision copied origin/direction with spatial type discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "Ray";
    readonly origin: V.Json;
    readonly direction: V.Json;
}

/**
 * Shared shape-intersection result. Distance is forward from zero in blocks; point and any unique
 * surface normal use the ray's containing frame. Inside-origin hits have distance zero; an absent
 * normal represents a non-unique surface normal. Shape modules construct copied frozen results.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Hit
{
    readonly distance: number;
    readonly point: V.Vector3;
    readonly normal: Option.Option<V.Vector3>;
}

/**
 * Data-first and data-last operations preserving receiver order.
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
 * Builds a binary dual operation preserving receiver order in pipelines.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Shared frozen piping, inspection and exact stored-coordinate protocols.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Restricts protocol equality to enriched rays.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: Ray, that: Equal.Equal): boolean
    {
        return isRay(that) && equals(this, that);
    },

    /**
     * Hashes exact raw origin and direction components with the ray discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Ray): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.origin, this.direction ]));
    },

    /**
     * Retains stored numeric precision and raw unsafe direction length.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Ray): Json
    {
        return Object.freeze({ _id: "Ray",
            direction: this.direction.toJSON() as V.Json,
            origin: this.origin.toJSON() as V.Json });
    },

    /**
     * Emits full-precision origin xyz followed by direction xyz.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Ray): string
    {
        return format(this);
    }
});

/**
 * Recognizes enriched rays, including invalid unsafe representations.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isRay = (input: unknown): input is Ray =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Deep-copies and freezes raw origin/direction without normalization, validation or derived queries.
 * Caller-owned objects remain untouched and unfrozen.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const RayUnsafe = (origin: V.Coordinates, direction: V.Coordinates): Ray =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as Ray, {
        direction: V.Vector3Unsafe(direction.x, direction.y, direction.z),
        origin: V.Vector3Unsafe(origin.x, origin.y, origin.z)
    }));
};

/**
 * Copies finite origin and stably normalizes finite nonzero direction, including extreme magnitudes.
 * Invalid input yields None. The resulting parameter measures blocks from distance zero forward.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Ray = (origin: V.Coordinates, direction: V.Coordinates): Option.Option<Ray> =>
{
    return V.isFinite(origin) ? Option.map(V.normalize(direction),
        (unit: V.Vector3) => RayUnsafe(origin, unit)) : Option.none();
};

/**
 * Requires finite origin and unit direction within eight machine epsilons of length one.
 * This allowance covers normalization roundoff only; unsafe non-unit directions are never repaired.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return V.isFinite(self.origin) && V.isFinite(self.direction) &&
        N.abs(V.magnitude(self.direction) - 1) <= UnitTolerance;
};

/**
 * Compares exact stored origin and direction with Effect NaN/signed-zero semantics.
 * No direction normalization or geometric tolerance affects equality, even for unsafe values.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => V.equals(self.origin, that.origin) &&
        V.equals(self.direction, that.direction));

/**
 * Evaluates origin+distance*direction for a finite nonnegative block distance. Invalid ray/parameter
 * or unrepresentable coordinates yield None; zero returns a copied frozen origin.
 *
 * @category Operation
 * @since 1.0.0
 */
export const at: Binary<Coordinates, number, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: number): Option.Option<V.Vector3> =>
    {
        if (!isValid(self) || !N.Number.isFinite(that) || that < 0)
        {
            return Option.none();
        }

        if (that === 0)
        {
            return V.Vector3(self.origin.x, self.origin.y, self.origin.z);
        }

        return V.Vector3(self.origin.x + that * self.direction.x,
            self.origin.y + that * self.direction.y, self.origin.z + that * self.direction.z);
    });

/**
 * Projects a finite point onto the forward parameter using scaled differences to avoid avoidable
 * intermediate overflow. Points behind the origin clamp to zero before restoring magnitude.
 *
 * @category Internal
 * @since 1.0.0
 */
const parameter = (self: Coordinates, point: V.Coordinates): number =>
{
    const Offset = V.subtract(point, self.origin);
    const Values = V.isFinite(Offset)
        ? [ Offset.x, Offset.y, Offset.z ] : [ point.x, point.y, point.z,
            self.origin.x, self.origin.y, self.origin.z ];
    const Scale = Values.reduce((maximum: number, value: number) => N.max(maximum, N.abs(value)), 0);
    if (Scale === 0)
    {
        return 0;
    }

    const Scaled = V.isFinite(Offset)
        ? V.Vector3Unsafe(Offset.x / Scale, Offset.y / Scale, Offset.z / Scale) :
        V.Vector3Unsafe(point.x / Scale - self.origin.x / Scale,
            point.y / Scale - self.origin.y / Scale, point.z / Scale - self.origin.z / Scale);
    return N.max(0, V.dot(Scaled, self.direction) / V.dot(self.direction, self.direction)) * Scale;
};

/**
 * Returns the closest forward-ray parameter to a finite point, clamped at zero. The parameter is
 * in blocks; invalid input or an unrepresentable positive parameter yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closestParameter: Binary<Coordinates, V.Coordinates, Option.Option<number>> = binary(
    (self: Coordinates, that: V.Coordinates): Option.Option<number> =>
    {
        if (!isValid(self) || !V.isFinite(that))
        {
            return Option.none();
        }

        const Value = parameter(self, that);
        return N.Number.isFinite(Value) ? Option.some(Value === 0 ? 0 : Value) : Option.none();
    });

/**
 * Returns the closest point on the forward ray, including the origin for points behind it.
 * Invalid input or an unrepresentable parameter/result yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closestPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => Option.flatMap(closestParameter(self, that),
        (distance: number) => at(self, distance)));

/**
 * Computes Euclidean distance in blocks to the closest point on the forward ray. Invalid input or
 * unrepresentable parameter/point/distance yields None; the direction is not silently normalized.
 *
 * @category Operation
 * @since 1.0.0
 */
export const distanceToPoint: Binary<Coordinates, V.Coordinates, Option.Option<number>> = binary(
    (self: Coordinates, that: V.Coordinates) => Option.flatMap(closestPoint(self, that),
        (point: V.Vector3): Option.Option<number> =>
        {
            const Distance = V.distance(point, that);
            return N.Number.isFinite(Distance) ? Option.some(Distance) : Option.none();
        }));

/**
 * Rigidly maps origin as a point and direction as a vector into the pose's containing frame.
 * Copies/normalizes the rotated direction to remove rotation roundoff, preserving block units.
 * Invalid non-unit input rays, invalid poses or unrepresentable output yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transform: Binary<Coordinates, T.Coordinates, Option.Option<Ray>> = binary(
    (self: Coordinates, that: T.Coordinates): Option.Option<Ray> =>
    {
        if (!isValid(self))
        {
            return Option.none();
        }

        const Origin = T.transformPoint(that, self.origin);
        const Direction = T.transformDirection(that, self.direction);
        return Option.isSome(Origin) && Option.isSome(Direction)
            ? Ray(Origin.value, Direction.value) : Option.none();
    });

/**
 * Formats stored origin xyz and direction xyz with full-precision Effect number formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `Ray(${formatComponents([ self.origin.x, self.origin.y, self.origin.z,
        self.direction.x, self.direction.y, self.direction.z ])})`;
};

/**
 * Aliases default full-precision ray formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses default valid finite unit-ray text without changing stored precision or normalizing unsafe
 * non-unit direction text. Invalid input yields None.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<Ray> =>
{
    const Match = /^Ray\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 6),
        (values: ReadonlyArray<number>): Option.Option<Ray> =>
        {
            const Value = RayUnsafe(V.Vector3Unsafe(values[0], values[1], values[2]),
                V.Vector3Unsafe(values[3], values[4], values[5]));
            return isValid(Value) ? Option.some(Value) : Option.none();
        });
};

/**
 * Aliases strict valid ray text parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;
