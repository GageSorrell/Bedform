/**
 * Immutable oriented boxes, rigid frame queries and complete separating-axis overlap.
 *
 * @module bedform/OBB
 *
 * @file      OBB.ts
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

import * as B from "./AABB.js";
import * as Equal from "@bedform/effect/Equal";
import * as G from "./Internal/Geometry.js";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as Q from "./Quat.js";
import * as R from "./Ray.js";
import * as T from "./Transform.js";
import * as V from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";

/**
 * Discriminates oriented boxes from axis-aligned bounds and other spatial kinds.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/OBB" as const;

/**
 * Structural center, nonnegative half extents and finite nonzero quaternion orientation.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly center: V.Coordinates;
    readonly halfExtents: V.Coordinates;
    readonly rotation: Q.Coordinates;
}

/**
 * Copied, deeply frozen oriented box with exact center/extents and canonical rotation protocols.
 *
 * @category Types
 * @since 1.0.0
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface OBB extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly center: V.Vector3;
    readonly halfExtents: V.Vector3;
    readonly rotation: Q.Quat;
}

/**
 * Stored full-precision coordinates and orientation with spatial discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "OBB";
    readonly center: V.Json;
    readonly halfExtents: V.Json;
    readonly rotation: Q.Json;
}

/**
 * Finite nonnegative absolute/relative contact tolerances, defaulting to 1e-9 each.
 *
 * @category Types
 * @since 1.0.0
 */
export interface QueryOptions extends G.QueryOptions {}

/**
 * Frozen corners in binary local xyz order, transformed into the containing frame.
 *
 * @category Types
 * @since 1.0.0
 */
export type Corners = B.Corners;

/**
 * Direct and data-last operations preserving receiver order.
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
 * Partial direct/data-last queries with optional tolerance fields.
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
 * Builds a binary dual operation.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Recognizes direct optional-argument queries from the second argument's structural field.
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
 * Shared frozen protocols, inspection and piping.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Restricts equality to oriented boxes of this kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: OBB, that: Equal.Equal): boolean
    {
        return isOBB(that) && equals(this, that);
    },

    /**
     * Hashes exact center/extents and canonical orientation with a kind discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: OBB): number
    {
        return Hash.combine(Hash.string(TypeId))(
            Hash.array([ this.center, this.halfExtents, this.rotation ]));
    },

    /**
     * Retains stored precision, including raw unsafe rotation magnitude.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: OBB): Json
    {
        return Object.freeze({ _id: "OBB",
            center: this.center.toJSON() as V.Json,
            halfExtents: this.halfExtents.toJSON() as V.Json,
            rotation: this.rotation.toJSON() as Q.Json });
    },

    /**
     * Emits full-precision oriented-box text.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: OBB): string
    {
        return format(this);
    }
});

/**
 * Recognizes enriched boxes, including invalid unsafe representations.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isOBB = (input: unknown): input is OBB =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies/freezes raw center, extents and quaternion without normalization or eager derived geometry.
 * Caller-owned values remain untouched and unfrozen.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const OBBUnsafe = (center: V.Coordinates, halfExtents: V.Coordinates, rotation: Q.Coordinates): OBB =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as OBB, {
        center: V.Vector3Unsafe(center.x, center.y, center.z),
        halfExtents: V.Vector3Unsafe(halfExtents.x, halfExtents.y, halfExtents.z),
        rotation: Q.QuatUnsafe(rotation.x, rotation.y, rotation.z, rotation.w)
    }));
};

/**
 * Requires finite center/extents, nonnegative extents and finite nonzero orientation. Nonunit
 * unsafe orientations remain valid and are normalized when interpreting rotations.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return V.isFinite(self.center) && V.isFinite(self.halfExtents) &&
        self.halfExtents.x >= 0 && self.halfExtents.y >= 0 && self.halfExtents.z >= 0 &&
        Option.isSome(Q.normalize(self.rotation));
};

/**
 * Validates finite center and nonnegative half extents and stably normalizes finite nonzero
 * quaternion orientation. Zero extents are valid; invalid input yields None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const OBB = (center: V.Coordinates, halfExtents: V.Coordinates,
    rotation: Q.Coordinates): Option.Option<OBB> =>
{
    if (!V.isFinite(center) || !V.isFinite(halfExtents) ||
        halfExtents.x < 0 || halfExtents.y < 0 || halfExtents.z < 0)
    {
        return Option.none();
    }

    return Option.map(Q.normalize(rotation), (unit: Q.Quat) => OBBUnsafe(center, halfExtents, unit));
};

/**
 * Compares exact stored center/extents and canonical orientation, including raw invalid fallbacks.
 * Alternate box parameterizations are not treated as equal geometric sets.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => V.equals(self.center, that.center) &&
        V.equals(self.halfExtents, that.halfExtents) && Q.equals(self.rotation, that.rotation));

/**
 * Views a box as a structural rigid pose for geometric interpretation.
 *
 * @category Internal
 * @since 1.0.0
 */
const pose = (self: Coordinates): T.Coordinates =>
{
    return { position: self.center,
        rotation: self.rotation };
};

/**
 * Builds copied finite local bounds, retaining all zero-extent cases.
 *
 * @category Internal
 * @since 1.0.0
 */
const localBounds = (self: Coordinates): B.AABB =>
{
    return B.AABBUnsafe(V.scale(self.halfExtents, -1), self.halfExtents);
};

/**
 * Maps a local point into the box's containing frame. Invalid or unrepresentable results yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toWorldPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => isValid(self)
        ? T.transformPoint(pose(self), that) : Option.none());

/**
 * Maps a containing-frame point into local box coordinates. Invalid inputs or unrepresentable
 * intermediate/output coordinates yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const toLocalPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => isValid(self)
        ? T.untransformPoint(pose(self), that) : Option.none());

/**
 * Returns copied frozen corners in binary local xyz order after rotation/translation.
 * Invalid input or unrepresentable world corners yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const corners = (self: Coordinates): Option.Option<Corners> =>
{
    if (!isValid(self))
    {
        return Option.none();
    }

    const Local = Option.getOrThrow(B.corners(localBounds(self)));
    const Points: Array<V.Vector3> = [];
    for (const Point of Local)
    {
        const World = toWorldPoint(self, Point);
        if (Option.isNone(World))
        {
            return Option.none();
        }

        Points.push(World.value);
    }

    return Option.some(Object.freeze([ Points[0], Points[1], Points[2], Points[3],
        Points[4], Points[5], Points[6], Points[7] ] as const));
};

/**
 * Returns the exact axis-aligned enclosure of all transformed corners, or None for invalid or
 * unrepresentable bounds. It does not replace oriented interior queries with this enclosure.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toAABB = (self: Coordinates): Option.Option<B.AABB> =>
{
    return Option.flatMap(corners(self), B.fromPoints);
};

/**
 * Returns the closest point in the closed oriented solid; interior points are copied unchanged.
 * Invalid input or unrepresentable local/world coordinates yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closestPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => Option.flatMap(toLocalPoint(self, that),
        (local: V.Vector3): Option.Option<V.Vector3> =>
        {
            const Bounds = localBounds(self);
            if (Option.getOrElse(B.containsPoint(Bounds, local,
                { absoluteTolerance: 0,
                    relativeTolerance: 0 }), () => false))
            {
                return V.Vector3(that.x, that.y, that.z);
            }

            return Option.flatMap(B.closestPoint(Bounds, local),
                (point: V.Vector3) => toWorldPoint(self, point));
        }));

/**
 * Computes block distance to the closed solid, zero for interior points; invalid or unrepresentable
 * results yield None.
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
 * Maximizes dot(worldDirection,point) by local direction signs. Zero local components choose
 * negative local extents deterministically. Invalid/unrepresentable results yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const supportPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates): Option.Option<V.Vector3> =>
    {
        if (!isValid(self) || !V.isFinite(that))
        {
            return Option.none();
        }

        const Unit = V.magnitude(that) === 0 ? Option.some(V.Zero) : V.normalize(that);
        return Option.flatMap(Unit, (unit: V.Vector3) =>
            Option.flatMap(Q.unrotateVector(self.rotation, unit), (direction: V.Vector3) =>
                Option.flatMap(B.supportPoint(localBounds(self), direction),
                    (point: V.Vector3) => toWorldPoint(self, point))));
    });

/**
 * Rigidly transforms center/orientation while preserving local half extents. Invalid or
 * unrepresentable output yields None; stored unsafe rotation magnitude is not used as scale.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transform: Binary<Coordinates, T.Coordinates, Option.Option<OBB>> = binary(
    (self: Coordinates, that: T.Coordinates): Option.Option<OBB> =>
    {
        if (!isValid(self))
        {
            return Option.none();
        }

        return Option.flatMap(T.compose(that, pose(self)), (result: T.Transform) =>
            OBB(result.position, self.halfExtents, result.rotation));
    });

/**
 * Divides components directly, retaining subnormal components without reciprocal overflow.
 *
 * @category Internal
 * @since 1.0.0
 */
const divided = (self: V.Coordinates, scale: number): V.Vector3 =>
{
    return V.Vector3Unsafe(self.x / scale, self.y / scale, self.z / scale);
};

/**
 * Finds the largest absolute coordinate in a finite collection.
 *
 * @category Internal
 * @since 1.0.0
 */
const largest = (values: ReadonlyArray<V.Coordinates>): number =>
{
    return values.reduce((maximum: number, value: V.Coordinates) =>
        N.max(maximum, N.max(N.abs(value.x), N.max(N.abs(value.y), N.abs(value.z)))), 0);
};

/**
 * Supplies all six face axes and nine edge cross axes; only exactly zero axes are skipped later.
 *
 * @category Internal
 * @since 1.0.0
 */
const candidateAxes = (a: Q.Axes, b: Q.Axes): ReadonlyArray<V.Vector3> =>
{
    const A = [ a.x, a.y, a.z ];
    const B = [ b.x, b.y, b.z ];
    return [ ...A, ...B, ...A.flatMap((first: V.Vector3) =>
        B.map((second: V.Vector3) => V.cross(first, second))) ];
};

/**
 * Projects nonnegative scaled half extents onto a unit candidate axis.
 *
 * @category Internal
 * @since 1.0.0
 */
const radius = (half: V.Coordinates, axes: Q.Axes, axis: V.Coordinates): number =>
{
    return G.sum([ half.x * N.abs(V.dot(axes.x, axis)), half.y * N.abs(V.dot(axes.y, axis)),
        half.z * N.abs(V.dot(axes.z, axis)) ]);
};

/**
 * Tests the complete 15-axis SAT with scaled center differences and projected radii. Parallel
 * cross axes are skipped only when exactly zero. Touching and lower-dimensional boxes count.
 * Absolute tolerance is in blocks; relative tolerance uses projected separation/radius scale.
 * Invalid geometry/options yield None; valid separated inputs yield Some(false).
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlaps: Query<Coordinates, boolean> = query("center",
    (self: Coordinates, that: Coordinates, options: QueryOptions = {}): Option.Option<boolean> =>
    {
        if (!isValid(self) || !isValid(that) || !G.validOptions(options))
        {
            return Option.none();
        }

        const A = Option.getOrThrow(Q.axes(self.rotation));
        const B = Option.getOrThrow(Q.axes(that.rotation));
        const Difference = V.subtract(that.center, self.center);
        const Finite = V.isFinite(Difference);
        const Scale = largest([ self.halfExtents, that.halfExtents,
            ...Finite ? [ Difference ] : [ self.center, that.center ] ]);
        if (Scale === 0)
        {
            return Option.some(true);
        }

        const Delta = Finite ? divided(Difference, Scale) :
            V.subtract(divided(that.center, Scale), divided(self.center, Scale));
        const AH = divided(self.halfExtents, Scale);
        const BH = divided(that.halfExtents, Scale);
        for (const Candidate of candidateAxes(A, B))
        {
            const Axis = V.normalize(Candidate);
            if (Option.isNone(Axis))
            {
                continue;
            }

            const Distance = N.abs(G.sum([ Delta.x * Axis.value.x,
                Delta.y * Axis.value.y, Delta.z * Axis.value.z ]));
            const Radius = radius(AH, A, Axis.value) + radius(BH, B, Axis.value);
            const Tolerance = (options.absoluteTolerance ?? 1e-9) / Scale +
                (options.relativeTolerance ?? 1e-9) * N.max(Distance, Radius);
            if (Distance > Radius && Distance - Radius > Tolerance)
            {
                return Option.some(false);
            }
        }

        return Option.some(true);
    });

/**
 * Aliases complete oriented-box overlap.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlapsOBB = overlaps;

/**
 * Tests an AABB with the same complete SAT, projecting its original min/max endpoints directly.
 * Avoids lossy center/half-extents conversion for very thin/subnormal bounds. Contact tolerance
 * uses local projected endpoint/radius scale; invalid geometry/options yields None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlapsAABB: Query<B.Coordinates, boolean> = query("min",
    (self: Coordinates, that: B.Coordinates, options: QueryOptions = {}): Option.Option<boolean> =>
    {
        if (!isValid(self) || !B.isValid(that) || !G.validOptions(options))
        {
            return Option.none();
        }

        const A = Option.getOrThrow(Q.axes(self.rotation));
        const World: Q.Axes = { x: V.UnitX,
            y: V.UnitY,
            z: V.UnitZ };
        const Min = V.subtract(that.min, self.center);
        const Max = V.subtract(that.max, self.center);
        const Finite = V.isFinite(Min) && V.isFinite(Max);
        const Scale = largest([ self.halfExtents,
            ...Finite ? [ Min, Max ] : [ that.min, that.max, self.center ] ]);
        if (Scale === 0)
        {
            return Option.some(true);
        }

        const Low = Finite ? divided(Min, Scale) :
            V.subtract(divided(that.min, Scale), divided(self.center, Scale));
        const High = Finite ? divided(Max, Scale) :
            V.subtract(divided(that.max, Scale), divided(self.center, Scale));
        const Half = divided(self.halfExtents, Scale);
        for (const Candidate of candidateAxes(A, World))
        {
            const Unit = V.normalize(Candidate);
            if (Option.isNone(Unit))
            {
                continue;
            }

            const Axis = Unit.value;
            const MinProjection = G.sum([ Axis.x * (Axis.x < 0 ? High.x : Low.x),
                Axis.y * (Axis.y < 0 ? High.y : Low.y), Axis.z * (Axis.z < 0 ? High.z : Low.z) ]);
            const MaxProjection = G.sum([ Axis.x * (Axis.x < 0 ? Low.x : High.x),
                Axis.y * (Axis.y < 0 ? Low.y : High.y), Axis.z * (Axis.z < 0 ? Low.z : High.z) ]);
            const Radius = radius(Half, A, Axis);
            const Absolute = (options.absoluteTolerance ?? 1e-9) / Scale;
            const Relative = options.relativeTolerance ?? 1e-9;
            if ((MinProjection > Radius && MinProjection - Radius >
                Absolute + Relative * N.max(N.abs(MinProjection), Radius)) ||
                (MaxProjection < -Radius && -Radius - MaxProjection >
                Absolute + Relative * N.max(N.abs(MaxProjection), Radius)))
            {
                return Option.some(false);
            }
        }

        return Option.some(true);
    });

/**
 * Tests closed point containment through a zero-extent point box, retaining scaled arithmetic
 * for far-away points even when unscaled local coordinates would overflow.
 *
 * @category Queries
 * @since 1.0.0
 */
export const containsPoint: Query<V.Coordinates, boolean> = query("x",
    (self: Coordinates, that: V.Coordinates, options: QueryOptions = {}) => overlaps(self,
        { center: that,
            halfExtents: V.Zero,
            rotation: Q.Identity }, options));

/**
 * Aliases closed point containment.
 *
 * @category Queries
 * @since 1.0.0
 */
export const contains = containsPoint;

/**
 * Intersects a valid unit ray in local coordinates, then returns the original ray's world point
 * at the same block distance and rotates any unique normal back. Inside origins hit at zero;
 * ambiguous normals remain None. Invalid/unrepresentable inputs or misses yield None.
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

        const Origin = toLocalPoint(self, that.origin);
        const Direction = Q.unrotateVector(self.rotation, that.direction);
        if (Option.isNone(Origin) || Option.isNone(Direction))
        {
            return Option.none();
        }

        return Option.flatMap(R.Ray(Origin.value, Direction.value), (local: R.Ray) =>
            Option.flatMap(B.intersectRay(localBounds(self), local, options),
                (localHit: R.Hit): Option.Option<R.Hit> =>
                {
                    const Point = R.at(that, localHit.distance);
                    const Normal = Option.isSome(localHit.normal) ?
                        Option.flatMap(Q.rotateVector(self.rotation, localHit.normal.value), V.normalize) :
                        Option.none();
                    if (Option.isNone(Point) || (Option.isSome(localHit.normal) && Option.isNone(Normal)))
                    {
                        return Option.none();
                    }

                    const Copied = Object.create(Object.getPrototypeOf(Normal),
                        Object.getOwnPropertyDescriptors(Normal)) as Option.Option<V.Vector3>;
                    return Option.some(Object.freeze({ distance: localHit.distance,
                        normal: Object.freeze(Copied),
                        point: Point.value }));
                }));
    });

/**
 * Formats center xyz, half extents xyz and raw rotation xyzw with full stored precision.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `OBB(${formatComponents([ self.center.x, self.center.y, self.center.z,
        self.halfExtents.x, self.halfExtents.y, self.halfExtents.z,
        self.rotation.x, self.rotation.y, self.rotation.z, self.rotation.w ])})`;
};

/**
 * Aliases full-precision default formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses valid finite box text while retaining raw quaternion magnitude; invalid domains yield None.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<OBB> =>
{
    const Match = /^OBB\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 10),
        (values: ReadonlyArray<number>): Option.Option<OBB> =>
        {
            const Value = OBBUnsafe(V.Vector3Unsafe(values[0], values[1], values[2]),
                V.Vector3Unsafe(values[3], values[4], values[5]),
                Q.QuatUnsafe(values[6], values[7], values[8], values[9]));
            return isValid(Value) ? Option.some(Value) : Option.none();
        });
};

/**
 * Aliases strict valid-box parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;
