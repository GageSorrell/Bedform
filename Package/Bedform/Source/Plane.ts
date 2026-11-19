/**
 * Immutable oriented planes and static half-space/intersection queries.
 *
 * @module bedform/Plane
 *
 * @file      Plane.ts
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
import * as G from "./Internal/Geometry.js";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as R from "./Ray.js";
import * as T from "./Transform.js";
import * as V from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";

/**
 * Discriminates oriented plane values from other spatial kinds.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/Plane" as const;

/**
 * Structural plane with equation dot(normal,point)+offset=0; queries require a unit normal.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly normal: V.Coordinates;
    readonly offset: number;
}

/**
 * Deeply frozen oriented plane; the negative side is the interior half-space.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Plane extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly normal: V.Vector3;
}

/**
 * Full-precision stored plane coefficients and spatial discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "Plane";
    readonly normal: V.Json;
    readonly offset: number;
}

/**
 * Finite nonnegative absolute/relative query tolerances, defaulting to 1e-9 each.
 *
 * @category Types
 * @since 1.0.0
 */
export interface QueryOptions extends G.QueryOptions {}

/**
 * Unique infinite intersection line, with closest-to-origin point and deterministic unit direction.
 * This line extends both ways and is not a forward Ray.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Line
{
    readonly point: V.Vector3;
    readonly direction: V.Vector3;
}

/**
 * Signed half-space classification; Boundary includes tolerance contact.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Side = Object.freeze({ Boundary: "Boundary",
    Inside: "Inside",
    Outside: "Outside" } as const);

/**
 * One of the exported half-space classifications.
 *
 * @category Types
 * @since 1.0.0
 */
export type Side = typeof Side[keyof typeof Side];

/**
 * Direct and data-last receiver operations preserving operand order.
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
 * Direct and data-last partial queries with optional tolerances.
 *
 * @category Types
 * @since 1.0.0
 */
interface Query<That, Value>
{
    (that: That, options?: QueryOptions): (self: Coordinates) => Option.Option<Value>;
    (self: Coordinates, that: That, options?: QueryOptions): Option.Option<Value>;
}

/**
 * Direct and data-last oriented construction from three points.
 *
 * @category Types
 * @since 1.0.0
 */
interface FromPoints
{
    (second: V.Coordinates, third: V.Coordinates): (self: V.Coordinates) => Option.Option<Plane>;
    (self: V.Coordinates, second: V.Coordinates, third: V.Coordinates): Option.Option<Plane>;
}

/**
 * Builds a dual receiver operation.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Builds optional-argument queries by recognizing the second argument's structural field.
 *
 * @category Internal
 * @since 1.0.0
 */
const query = <That, Value>(
    field: string,
    body: (self: Coordinates, that: That, options?: QueryOptions) => Option.Option<Value>
): Query<That, Value> =>
{
    return dual((args: IArguments) => args.length >= 2 && typeof args[1] === "object" &&
        args[1] !== null && field in args[1], body);
};

/**
 * Shared frozen exact coefficient protocols and inspection.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Compares only enriched planes of this kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: Plane, that: Equal.Equal): boolean
    {
        return isPlane(that) && equals(this, that);
    },

    /**
     * Hashes exact raw normal/offset components with the plane discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Plane): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.normal, this.offset ]));
    },

    /**
     * Retains stored precision, orientation and unsafe coefficient magnitude.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Plane): Json
    {
        return Object.freeze({ _id: "Plane",
            normal: this.normal.toJSON() as V.Json,
            offset: this.offset });
    },

    /**
     * Emits full-precision normal xyz and offset text.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Plane): string
    {
        return format(this);
    }
});

/**
 * Recognizes enriched plane values, including invalid unsafe coefficients.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isPlane = (input: unknown): input is Plane =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies/freezes raw normal and offset without normalization, validation or derived calculations.
 * Caller-owned coordinates remain untouched and unfrozen.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const PlaneUnsafe = (normal: V.Coordinates, offset: number): Plane =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as Plane, {
        normal: V.Vector3Unsafe(normal.x, normal.y, normal.z),
        offset
    }));
};

/**
 * Normalizes finite nonzero normal and divides offset by the same positive length, without sign
 * flipping. Invalid input or unrepresentable normalized offset yields None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Plane = (normal: V.Coordinates, offset: number): Option.Option<Plane> =>
{
    const Unit = V.normalize(normal);
    if (Option.isNone(Unit) || !N.Number.isFinite(offset))
    {
        return Option.none();
    }

    const Maximum = N.max(N.max(N.abs(normal.x), N.abs(normal.y)), N.abs(normal.z));
    const Length = V.magnitude(V.Vector3Unsafe(normal.x / Maximum, normal.y / Maximum, normal.z / Maximum));
    const Ratio = offset / Maximum;
    const Offset = N.Number.isFinite(Ratio) ? Ratio / Length : (offset / Length) / Maximum;
    return N.Number.isFinite(Offset) ? Option.some(PlaneUnsafe(Unit.value, Offset)) : Option.none();
};

/**
 * Requires finite coefficients and a unit normal within eight machine epsilons for roundoff.
 * Nonunit unsafe planes are rejected by queries rather than silently rescaled.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return V.isFinite(self.normal) && N.Number.isFinite(self.offset) &&
        N.abs(V.magnitude(self.normal) - 1) <= 8 * N.Number.EPSILON;
};

/**
 * Compares exact stored normal/offset, including Effect NaN and signed-zero semantics.
 * Opposite orientation and unsafe scaled representations remain distinct.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => V.equals(self.normal, that.normal) &&
        N.Equivalence(self.offset, that.offset));

/**
 * Computes finite terms of the signed plane equation with compensated scaled summation.
 *
 * @category Internal
 * @since 1.0.0
 */
const terms = (self: Coordinates, point: V.Coordinates): ReadonlyArray<number> =>
{
    return [ self.normal.x * point.x, self.normal.y * point.y, self.normal.z * point.z, self.offset ];
};

/**
 * Computes signed distance in blocks; negative values belong to the interior half-space.
 * Invalid input or unrepresentable distance yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const signedDistance: Binary<Coordinates, V.Coordinates, Option.Option<number>> = binary(
    (self: Coordinates, that: V.Coordinates): Option.Option<number> =>
    {
        if (!isValid(self) || !V.isFinite(that))
        {
            return Option.none();
        }

        const Distance = G.sum(terms(self, that));
        return N.Number.isFinite(Distance) ? Option.some(Distance) : Option.none();
    });

/**
 * Constructs an oriented plane from a finite point and finite nonzero normal, preserving normal sign.
 * Undefined or unrepresentable coefficients yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromPointNormal: Binary<V.Coordinates, V.Coordinates, Option.Option<Plane>> = binary(
    (self: V.Coordinates, that: V.Coordinates): Option.Option<Plane> =>
    {
        const Unit = V.normalize(that);
        if (!V.isFinite(self) || Option.isNone(Unit))
        {
            return Option.none();
        }

        const Offset = -G.sum([ Unit.value.x * self.x, Unit.value.y * self.y, Unit.value.z * self.z ]);
        return N.Number.isFinite(Offset) ? Option.some(PlaneUnsafe(Unit.value, Offset)) : Option.none();
    });

/**
 * Normalizes an edge stably, rescaling positions only when raw subtraction overflows.
 *
 * @category Internal
 * @since 1.0.0
 */
const edge = (self: V.Coordinates, that: V.Coordinates): Option.Option<V.Vector3> =>
{
    const Difference = V.subtract(that, self);
    if (V.isFinite(Difference))
    {
        return V.normalize(Difference);
    }

    const Scale = [ self.x, self.y, self.z, that.x, that.y, that.z ]
        .reduce((maximum: number, value: number) => N.max(maximum, N.abs(value)), 0);
    return V.normalize(V.Vector3Unsafe(that.x / Scale - self.x / Scale,
        that.y / Scale - self.y / Scale, that.z / Scale - self.z / Scale));
};

/**
 * Uses cross(second-first,third-first) orientation for three finite noncollinear points.
 * Duplicate/collinear points or unrepresentable coefficients yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromPoints: FromPoints = dual(3,
    (self: V.Coordinates, second: V.Coordinates, third: V.Coordinates): Option.Option<Plane> =>
    {
        if (![ self, second, third ].every(V.isFinite))
        {
            return Option.none();
        }

        const A = edge(self, second);
        const B = edge(self, third);
        return Option.isSome(A) && Option.isSome(B)
            ? fromPointNormal(self, V.cross(A.value, B.value)) : Option.none();
    });

/**
 * Orthogonally projects a finite point to the plane; invalid or unrepresentable results yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const projectPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => Option.flatMap(signedDistance(self, that),
        (distance: number) => V.Vector3(that.x - self.normal.x * distance,
            that.y - self.normal.y * distance, that.z - self.normal.z * distance)));

/**
 * Measures numerical equation scale as the largest absolute individual dot/offset term.
 *
 * @category Internal
 * @since 1.0.0
 */
const scale = (self: Coordinates, point: V.Coordinates): number =>
{
    return terms(self, point).reduce((maximum: number, value: number) => N.max(maximum, N.abs(value)), 0);
};

/**
 * Classifies the signed half-space using abs+relative*equationScale tolerance. Boundary contact
 * is included; invalid options/input yields None. Classification stays scaled so a distance
 * beyond numeric range can still produce a valid half-space classification.
 *
 * @category Queries
 * @since 1.0.0
 */
export const classify: Query<V.Coordinates, Side> = query("x",
    (self: Coordinates, that: V.Coordinates, options: QueryOptions = {}): Option.Option<Side> =>
    {
        if (!isValid(self) || !V.isFinite(that) || !G.validOptions(options))
        {
            return Option.none();
        }

        const Terms = terms(self, that);
        const Scale = scale(self, that);
        if (Scale === 0)
        {
            return Option.some(Side.Boundary);
        }

        const Distance = G.sum(Terms.map((value: number) => value / Scale));
        if (!N.Number.isFinite(Distance))
        {
            return Option.none();
        }

        const Absolute = (options.absoluteTolerance ?? 1e-9) / Scale;
        const Relative = options.relativeTolerance ?? 1e-9;
        const Magnitude = N.abs(Distance);
        return Option.some(Magnitude <= Absolute || Magnitude - Absolute <= Relative ? Side.Boundary :
            Distance < 0 ? Side.Inside : Side.Outside);
    });

/**
 * Tests membership in the closed negative half-space, including Boundary tolerance contact.
 * Valid outside input returns Some(false); invalid geometry/options returns None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const contains: Query<V.Coordinates, boolean> = query("x",
    (self: Coordinates, that: V.Coordinates, options: QueryOptions = {}) =>
        Option.map(classify(self, that, options), (side: Side) => side !== Side.Outside));

/**
 * Reverses normal and offset, swapping interior/exterior. Invalid unsafe input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const flip = (self: Coordinates): Option.Option<Plane> =>
{
    return isValid(self) ? Option.some(PlaneUnsafe(V.scale(self.normal, -1), -self.offset)) : Option.none();
};

/**
 * Maps plane orientation rigidly and updates offset as offset-dot(rotatedNormal,translation).
 * Invalid inputs or unrepresentable output yield None; translation never changes normal direction.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transform: Binary<Coordinates, T.Coordinates, Option.Option<Plane>> = binary(
    (self: Coordinates, that: T.Coordinates): Option.Option<Plane> =>
    {
        if (!isValid(self))
        {
            return Option.none();
        }

        return Option.flatMap(T.transformDirection(that, self.normal), (normal: V.Vector3) =>
            Plane(normal, G.sum([ self.offset, -normal.x * that.position.x,
                -normal.y * that.position.y, -normal.z * that.position.z ])));
    });

/**
 * Returns the unique infinite line of two planes. Parallel/coincident planes within the angular
 * abs+relative tolerance return None. The closest-to-origin point and unit direction are frozen;
 * the first nonzero direction coordinate is positive, independent of operand order.
 *
 * @category Queries
 * @since 1.0.0
 */
export const intersectPlane: Query<Coordinates, Line> = query("normal",
    (self: Coordinates, that: Coordinates, options: QueryOptions = {}): Option.Option<Line> =>
    {
        if (!isValid(self) || !isValid(that) || !G.validOptions(options))
        {
            return Option.none();
        }

        const Cross = V.cross(self.normal, that.normal);
        const Sine = V.magnitude(Cross);
        const Unit = V.normalize(Cross);
        if (Option.isNone(Unit) || G.withinTolerance(Sine, 1, options))
        {
            return Option.none();
        }

        const A = V.cross(that.normal, Unit.value);
        const B = V.cross(Unit.value, self.normal);
        const Point = V.Vector3(G.sum([ -self.offset * A.x, -that.offset * B.x ]) / Sine,
            G.sum([ -self.offset * A.y, -that.offset * B.y ]) / Sine,
            G.sum([ -self.offset * A.z, -that.offset * B.z ]) / Sine);
        const First = [ Unit.value.x, Unit.value.y, Unit.value.z ].find((value: number) => value !== 0) ?? 1;
        const Sign = First < 0 ? -1 : 1;
        const Direction = V.Vector3Unsafe(Unit.value.x === 0 ? 0 : Unit.value.x * Sign,
            Unit.value.y === 0 ? 0 : Unit.value.y * Sign, Unit.value.z === 0 ? 0 : Unit.value.z * Sign);
        return Option.map(Point, (point: V.Vector3) => Object.freeze({
            direction: Direction,
            point
        }));
    });

/**
 * Intersects the plane surface with a valid unit forward ray. Boundary origins, including
 * coplanar rays, hit at zero; parallel separated rays and behind-origin hits return None.
 * Every hit has this plane's unique oriented normal, even for coplanar rays. Distance and angular
 * comparisons use the documented scale-aware and abs+relative tolerances respectively.
 *
 * @category Queries
 * @since 1.0.0
 */
export const intersectRay: Query<R.Coordinates, R.Hit> = query("origin",
    (self: Coordinates, that: R.Coordinates, options: QueryOptions = {}): Option.Option<R.Hit> =>
    {
        if (!isValid(self) || !R.isValid(that) || !G.validOptions(options))
        {
            return Option.none();
        }

        const Distance = signedDistance(self, that.origin);
        if (Option.isNone(Distance))
        {
            return Option.none();
        }

        const Denominator = V.dot(self.normal, that.direction);
        const OnPlane = G.withinTolerance(Distance.value, scale(self, that.origin), options);
        if (!OnPlane && G.withinTolerance(Denominator, 1, options))
        {
            return Option.none();
        }

        const Parameter = OnPlane ? 0 : -Distance.value / Denominator;
        return Option.map(R.at(that, Parameter), (point: V.Vector3) => Object.freeze({ distance: Parameter,
            normal: Object.freeze(Option.some(V.Vector3Unsafe(self.normal.x, self.normal.y, self.normal.z))),
            point }));
    });

/**
 * Formats stored normal xyz and offset using full-precision Effect number formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `Plane(${formatComponents([ self.normal.x, self.normal.y, self.normal.z, self.offset ])})`;
};

/**
 * Aliases default full-precision plane formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses valid finite unit-plane text, preserving stored coefficient precision. Nonunit unsafe text
 * is rejected rather than silently normalized.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<Plane> =>
{
    const Match = /^Plane\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 4),
        (values: ReadonlyArray<number>): Option.Option<Plane> =>
        {
            const Value = PlaneUnsafe(V.Vector3Unsafe(values[0], values[1], values[2]), values[3]);
            return isValid(Value) ? Option.some(Value) : Option.none();
        });
};

/**
 * Aliases strict valid plane text parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;
