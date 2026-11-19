/**
 * Immutable axis-aligned bounds and pure static geometric queries.
 *
 * @module bedform/AABB
 *
 * @file      AABB.ts
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
 * Discriminates enriched axis-aligned boxes from other spatial kinds.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/AABB" as const;

/**
 * Deterministic coordinate and corner traversal order.
 *
 * @category Internal
 * @since 1.0.0
 */
const Axes = Object.freeze([ "x", "y", "z" ] as const);

/**
 * Structural bounds; valid boxes require finite min<=max on each axis.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly min: V.Coordinates;
    readonly max: V.Coordinates;
}

/**
 * Deeply frozen bounds with exact component protocols. Zero extents are valid.
 *
 * @category Types
 * @since 1.0.0
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface AABB extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly min: V.Vector3;
    readonly max: V.Vector3;
}

/**
 * Stored full-precision bounds with spatial type discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "AABB";
    readonly min: V.Json;
    readonly max: V.Json;
}

/**
 * Finite nonnegative absolute and relative contact tolerances, defaulting to 1e-9 each.
 *
 * @category Types
 * @since 1.0.0
 */
export interface QueryOptions extends G.QueryOptions {}

/**
 * Frozen corners in binary xyz order: x changes fastest, followed by y, then z.
 * Repeated corners are retained for zero extents.
 *
 * @category Types
 * @since 1.0.0
 */
export type Corners = readonly [V.Vector3, V.Vector3, V.Vector3, V.Vector3,
    V.Vector3, V.Vector3, V.Vector3, V.Vector3];

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
 * Partial queries with optional contact tolerances in both call styles.
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
 * Selects direct optional-argument queries by the second argument's structural field.
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
 * Shared frozen exact protocols, piping and inspection.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Restricts protocol equality to this box kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: AABB, that: Equal.Equal): boolean
    {
        return isAABB(that) && equals(this, that);
    },

    /**
     * Hashes raw bounds with the box discriminator, including unsafe invalid fallbacks.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: AABB): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.min, this.max ]));
    },

    /**
     * Retains stored precision and raw unsafe bounds.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: AABB): Json
    {
        return Object.freeze({ _id: "AABB",
            max: this.max.toJSON() as V.Json,
            min: this.min.toJSON() as V.Json });
    },

    /**
     * Emits default full-precision bounds text.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: AABB): string
    {
        return format(this);
    }
});

/**
 * Recognizes enriched boxes, including unsafe invalid representations.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isAABB = (input: unknown): input is AABB =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies/freezes raw bounds without reordering, validating or calculating derived geometry.
 * Caller-owned coordinates remain unchanged and unfrozen.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const AABBUnsafe = (min: V.Coordinates, max: V.Coordinates): AABB =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as AABB, {
        max: V.Vector3Unsafe(max.x, max.y, max.z),
        min: V.Vector3Unsafe(min.x, min.y, min.z)
    }));
};

/**
 * Requires finite bounds and min<=max component-wise; zero extents are valid.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return V.isFinite(self.min) && V.isFinite(self.max) && Axes.every((axis: keyof V.Coordinates) =>
        self.min[axis] <= self.max[axis]);
};

/**
 * Validates and copies finite ordered bounds, allowing planes, lines and points as degenerate boxes.
 * Inverted or nonfinite bounds yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const AABB = (min: V.Coordinates, max: V.Coordinates): Option.Option<AABB> =>
{
    return isValid({ max,
        min }) ? Option.some(AABBUnsafe(min, max)) : Option.none();
};

/**
 * Encloses a nonempty finite point array; empty/nonfinite inputs yield None. Copies all output data.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromPoints = (points: ReadonlyArray<V.Coordinates>): Option.Option<AABB> =>
{
    if (points.length === 0 || !Array.from(points).every((point: V.Coordinates) =>
        point !== undefined && V.isFinite(point)))
    {
        return Option.none();
    }

    let min = V.Vector3Unsafe(points[0].x, points[0].y, points[0].z);
    let max = min;
    for (const Point of points)
    {
        min = V.min(min, Point);
        max = V.max(max, Point);
    }

    return AABB(min, max);
};

/**
 * Constructs finite bounds from finite center and component-wise nonnegative half extents.
 * Negative extents or unrepresentable bounds yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromCenterHalfExtents: Binary<V.Coordinates, V.Coordinates, Option.Option<AABB>> = binary(
    (self: V.Coordinates, that: V.Coordinates) => V.isFinite(self) && V.isFinite(that) &&
        Axes.every((axis: keyof V.Coordinates) => that[axis] >= 0)
        ? AABB(V.subtract(self, that), V.add(self, that)) : Option.none());

/**
 * Compares exact raw bounds with Effect NaN and signed-zero semantics; tolerances never affect equality.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => V.equals(self.min, that.min) && V.equals(self.max, that.max));

/**
 * Computes a midpoint without overflow or avoidable same-sign/subnormal underflow.
 *
 * @category Internal
 * @since 1.0.0
 */
const midpoint = (min: number, max: number): number =>
{
    const Sum = min + max;
    return N.Number.isFinite(Sum) ? Sum / 2 : min + (max - min) / 2;
};

/**
 * Returns the stable center of valid finite bounds, without requiring representable full extents.
 *
 * @category Operation
 * @since 1.0.0
 */
export const center = (self: Coordinates): Option.Option<V.Vector3> =>
{
    return isValid(self) ? V.Vector3(midpoint(self.min.x, self.max.x),
        midpoint(self.min.y, self.max.y), midpoint(self.min.z, self.max.z)) : Option.none();
};

/**
 * Returns max-min, or None for invalid bounds or unrepresentable full extents.
 *
 * @category Operation
 * @since 1.0.0
 */
export const size = (self: Coordinates): Option.Option<V.Vector3> =>
{
    return isValid(self) ? V.Vector3(self.max.x - self.min.x,
        self.max.y - self.min.y, self.max.z - self.min.z) : Option.none();
};

/**
 * Computes half a span, avoiding overflow when the full span exceeds numeric range.
 *
 * @category Internal
 * @since 1.0.0
 */
const half = (min: number, max: number): number =>
{
    const Difference = max - min;
    return N.Number.isFinite(Difference) ? Difference / 2 : max / 2 - min / 2;
};

/**
 * Returns component-wise half extents stably even when full extents overflow.
 *
 * @category Operation
 * @since 1.0.0
 */
export const halfExtents = (self: Coordinates): Option.Option<V.Vector3> =>
{
    return isValid(self) ? V.Vector3(half(self.min.x, self.max.x),
        half(self.min.y, self.max.y), half(self.min.z, self.max.z)) : Option.none();
};

/**
 * Returns eight frozen enriched corners in binary xyz order, retaining duplicates for zero extents.
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

    const { min: A, max: B } = self;
    return Option.some(Object.freeze([
        V.Vector3Unsafe(A.x, A.y, A.z), V.Vector3Unsafe(B.x, A.y, A.z),
        V.Vector3Unsafe(A.x, B.y, A.z), V.Vector3Unsafe(B.x, B.y, A.z),
        V.Vector3Unsafe(A.x, A.y, B.z), V.Vector3Unsafe(B.x, A.y, B.z),
        V.Vector3Unsafe(A.x, B.y, B.z), V.Vector3Unsafe(B.x, B.y, B.z)
    ] as const));
};

/**
 * Tests closed point containment with scale-aware contact tolerances. Invalid inputs/options yield
 * None; valid outside points yield Some(false). Stored bounds are never inflated.
 *
 * @category Queries
 * @since 1.0.0
 */
export const containsPoint: Query<V.Coordinates, boolean> = query("x",
    (self: Coordinates, that: V.Coordinates, options: QueryOptions = {}): Option.Option<boolean> =>
        isValid(self) && V.isFinite(that) && G.validOptions(options) ? Option.some(
            Axes.every((axis: keyof V.Coordinates) => G.lessOrNear(self.min[axis], that[axis], options) &&
                G.lessOrNear(that[axis], self.max[axis], options))) : Option.none());

/**
 * Aliases point containment in the closed box.
 *
 * @category Queries
 * @since 1.0.0
 */
export const contains = containsPoint;

/**
 * Tests containment of another valid box, including boundary and lower-dimensional contact.
 *
 * @category Queries
 * @since 1.0.0
 */
export const containsBox: Query<Coordinates, boolean> = query("min",
    (self: Coordinates, that: Coordinates, options: QueryOptions = {}) => isValid(that)
        ? Option.flatMap(containsPoint(self, that.min, options), (min: boolean) =>
            Option.map(containsPoint(self, that.max, options),
                (max: boolean) => min && max)) : Option.none());

/**
 * Tests static overlap on all three axes; touching counts, including zero-extent boxes.
 * Valid separated boxes yield Some(false); invalid geometry/options yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlaps: Query<Coordinates, boolean> = query("min",
    (self: Coordinates, that: Coordinates, options: QueryOptions = {}): Option.Option<boolean> =>
        isValid(self) && isValid(that) && G.validOptions(options) ? Option.some(
            Axes.every((axis: keyof V.Coordinates) => G.lessOrNear(self.min[axis], that.max[axis], options) &&
                G.lessOrNear(that.min[axis], self.max[axis], options))) : Option.none());

/**
 * Returns the exact smallest enclosing union of two valid boxes.
 *
 * @category Operation
 * @since 1.0.0
 */
export const union: Binary<Coordinates, Coordinates, Option.Option<AABB>> = binary(
    (self: Coordinates, that: Coordinates) => isValid(self) && isValid(that)
        ? AABB(V.min(self.min, that.min), V.max(self.max, that.max)) : Option.none());

/**
 * Returns exact intersection bounds, or None for empty intersections/invalid inputs.
 * Touching intersections retain their zero extents; query tolerances never alter this geometry.
 *
 * @category Operation
 * @since 1.0.0
 */
export const intersection: Binary<Coordinates, Coordinates, Option.Option<AABB>> = binary(
    (self: Coordinates, that: Coordinates) => isValid(self) && isValid(that)
        ? AABB(V.max(self.min, that.min), V.min(self.max, that.max)) : Option.none());

/**
 * Expands by finite uniform or per-axis amounts; negative values contract. Inverted bounds or
 * unrepresentable output yield None, while contraction to zero extents is valid.
 *
 * @category Operation
 * @since 1.0.0
 */
export const expand: Binary<Coordinates, number | V.Coordinates, Option.Option<AABB>> = binary(
    (self: Coordinates, that: number | V.Coordinates): Option.Option<AABB> =>
    {
        const Amount = typeof that === "number" ? V.Vector3Unsafe(that, that, that) : that;
        return isValid(self) && V.isFinite(Amount)
            ? AABB(V.subtract(self.min, Amount), V.add(self.max, Amount)) : Option.none();
    });

/**
 * Returns the closest point in the closed solid, including the input point itself when inside.
 * Invalid input yields None; no tolerance changes this exact clamping operation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closestPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => isValid(self) && V.isFinite(that)
        ? V.Vector3(N.max(self.min.x, N.min(self.max.x, that.x)),
            N.max(self.min.y, N.min(self.max.y, that.y)),
            N.max(self.min.z, N.min(self.max.z, that.z))) : Option.none());

/**
 * Returns Euclidean distance to the closed solid; interior distance is zero. Invalid inputs or
 * unrepresentable distance yield None.
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
 * Maximizes dot(direction,point) without computing the dot product. Zero direction coordinates
 * choose min, including an all-zero direction; invalid bounds/direction yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const supportPoint: Binary<Coordinates, V.Coordinates, Option.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => isValid(self) && V.isFinite(that)
        ? V.Vector3(that.x > 0 ? self.max.x : self.min.x, that.y > 0 ? self.max.y : self.min.y,
            that.z > 0 ? self.max.z : self.min.z) : Option.none());

/**
 * Maps all eight corners rigidly and returns their enclosing AABB. This is an enclosure of a
 * rotated box, not a claim that rotation preserves axis alignment. Invalid/unrepresentable results
 * yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transform: Binary<Coordinates, T.Coordinates, Option.Option<AABB>> = binary(
    (self: Coordinates, that: T.Coordinates): Option.Option<AABB> =>
    {
        const Corners = corners(self);
        if (Option.isNone(Corners))
        {
            return Option.none();
        }

        const Points: Array<V.Vector3> = [];
        for (const Corner of Corners.value)
        {
            const Point = T.transformPoint(that, Corner);
            if (Option.isNone(Point))
            {
                return Option.none();
            }

            Points.push(Point.value);
        }

        return fromPoints(Points);
    });

/**
 * Tests scalar contact proximity symmetrically without overflowing finite differences.
 *
 * @category Internal
 * @since 1.0.0
 */
const near = (self: number, that: number, options: QueryOptions): boolean =>
{
    return G.lessOrNear(self, that, options) && G.lessOrNear(that, self, options);
};

/**
 * Returns a copied outward coordinate normal for one box face.
 *
 * @category Internal
 * @since 1.0.0
 */
const axisNormal = (axis: keyof V.Coordinates, sign: number): V.Vector3 =>
{
    return V.Vector3Unsafe(axis === "x" ? sign : 0, axis === "y" ? sign : 0, axis === "z" ? sign : 0);
};

/**
 * Finds all boundary-face normals at a point; opposing degenerate faces remain distinct.
 *
 * @category Internal
 * @since 1.0.0
 */
const boundaryNormals = (self: Coordinates, point: V.Coordinates, options: QueryOptions): Array<V.Vector3> =>
{
    const Normals: Array<V.Vector3> = [];
    for (const Axis of Axes)
    {
        if (near(point[Axis], self.min[Axis], options))
        {
            Normals.push(axisNormal(Axis, -1));
        }

        if (near(point[Axis], self.max[Axis], options))
        {
            Normals.push(axisNormal(Axis, 1));
        }
    }

    return Normals;
};

/**
 * Copies/freezes a forward hit; zero/multiple candidate normals produce None for the normal.
 *
 * @category Internal
 * @since 1.0.0
 */
const hit = (distance: number, point: V.Vector3, normals: ReadonlyArray<V.Vector3>): R.Hit =>
{
    const Normal = normals.length === 1 ? Option.some(normals[0]) : Option.none<V.Vector3>();
    const Copied = Object.create(Object.getPrototypeOf(Normal),
        Object.getOwnPropertyDescriptors(Normal)) as Option.Option<V.Vector3>;
    return Object.freeze({ distance: distance === 0 ? 0 : distance,
        normal: Object.freeze(Copied),
        point });
};

/**
 * Returns the first forward slab hit, using exact-zero parallel axes and tolerance contact tests.
 * Inside origins hit at zero; strict interior has no normal. A unique face has its outward normal;
 * edge/corner/degenerate-face ties have None. Invalid unit rays/options, misses and unrepresentable
 * hit distances/points yield None. Query tolerance never modifies stored bounds.
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

        if (Option.getOrElse(containsPoint(self, that.origin, options), () => false))
        {
            return Option.map(R.at(that, 0), (point: V.Vector3) =>
                hit(0, point, boundaryNormals(self, point, options)));
        }

        let entry = 0;
        let exit = Infinity;
        let normals: Array<V.Vector3> = [];
        for (const Axis of Axes)
        {
            const Direction = that.direction[Axis];
            const Origin = that.origin[Axis];
            if (Direction === 0)
            {
                if (!G.lessOrNear(self.min[Axis], Origin, options) ||
                    !G.lessOrNear(Origin, self.max[Axis], options))
                {
                    return Option.none();
                }

                continue;
            }

            const A = (self.min[Axis] - Origin) / Direction;
            const B = (self.max[Axis] - Origin) / Direction;
            const Near = N.min(A, B);
            const Far = N.max(A, B);
            const Normal = axisNormal(Axis, Direction > 0 ? -1 : 1);
            if (Near > entry)
            {
                normals = near(Near, entry, options) ? [ ...normals, Normal ] : [ Normal ];
                entry = Near;
            }
            else if (near(Near, entry, options))
            {
                normals.push(Normal);
            }

            exit = N.min(exit, Far);
            if (!G.lessOrNear(entry, exit, options))
            {
                return Option.none();
            }
        }

        if (!N.Number.isFinite(entry) || exit < 0)
        {
            return Option.none();
        }

        return Option.flatMap(R.at(that, entry), (point: V.Vector3): Option.Option<R.Hit> =>
        {
            if (!Option.getOrElse(containsPoint(self, point, options), () => false))
            {
                return Option.none();
            }

            const Boundary = boundaryNormals(self, point, options);
            return Option.some(hit(entry, point, Boundary.length === 0 ? normals : Boundary));
        });
    });

/**
 * Formats full-precision min xyz then max xyz bounds using Effect number formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    return `AABB(${formatComponents([ self.min.x, self.min.y, self.min.z,
        self.max.x, self.max.y, self.max.z ])})`;
};

/**
 * Aliases default full-precision box formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses default finite ordered bounds text without changing stored precision. Invalid text/bounds
 * yield None.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): Option.Option<AABB> =>
{
    const Match = /^AABB\((.*)\)$/.exec(self.trim());
    return Match === null ? Option.none() : Option.flatMap(parseComponents(Match[1], 6),
        (values: ReadonlyArray<number>) => AABB(V.Vector3Unsafe(values[0], values[1], values[2]),
            V.Vector3Unsafe(values[3], values[4], values[5])));
};

/**
 * Aliases strict finite ordered bounds parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;
