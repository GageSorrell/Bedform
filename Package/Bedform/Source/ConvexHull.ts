/**
 * Immutable full-dimensional convex solids and complete static geometric queries.
 *
 * @module bedform/ConvexHull
 *
 * @file      ConvexHull.ts
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
import * as I from "./Internal/ConvexHull.js";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as O from "@bedform/effect/Option";
import * as P from "./Plane.js";
import * as Pipeable from "@bedform/effect/Pipeable";
import * as Q from "./Quat.js";
import * as R from "./Ray.js";
import * as S from "./OBB.js";
import * as T from "./Transform.js";
import * as V from "./Vector3.js";
import { formatComponents, parseComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";

/**
 * Distinguishes indexed convex solids from other spatial values.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/ConvexHull" as const;

/**
 * Structural vertices and indexed outward polygon faces. Geometric queries require a closed,
 * full-dimensional convex manifold, never a concave or degenerate substitute.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates extends I.Coordinates {}

/**
 * Deeply frozen indexed topology with exact stored-topology protocols and lazy derived geometry.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ConvexHull extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
    readonly vertices: ReadonlyArray<V.Vector3>;
}

/**
 * Undirected edge with ascending stored vertex indices.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Edge extends I.Edge {}

/**
 * Full-precision stored vertices/topology and spatial discriminators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json
{
    readonly _id: "ConvexHull";
    readonly vertices: ReadonlyArray<V.Json>;
    readonly faces: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Finite nonnegative absolute/relative contact tolerances, defaulting to 1e-9 each.
 *
 * @category Types
 * @since 1.0.0
 */
export interface QueryOptions extends G.QueryOptions {}

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
 * Direct/data-last partial queries with optional contact tolerances.
 *
 * @category Types
 * @since 1.0.0
 */
interface Query<That, Value>
{
    (that: That, options?: QueryOptions): (self: Coordinates) => O.Option<Value>;
    (self: Coordinates, that: That, options?: QueryOptions): O.Option<Value>;
}

/**
 * Caches validation only for owned immutable values; mutable structural inputs are always rechecked.
 *
 * @category Internal
 * @since 1.0.0
 */
const Cache = new WeakMap<ConvexHull, O.Option<I.Data> | undefined>();

/**
 * Builds binary dual operations.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Selects direct optional queries from the second argument's structural field.
 *
 * @category Internal
 * @since 1.0.0
 */
const query = <That, Value>(field: string,
    body: (self: Coordinates, that: That, options?: QueryOptions) => O.Option<Value>): Query<That, Value> =>
{
    return dual((args: IArguments) => args.length >= 2 && typeof args[1] === "object" &&
        args[1] !== null && field in args[1], body);
};

/**
 * Shared frozen raw-topology protocols, piping and inspection, without eager unsafe validation.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Restricts equality to this indexed solid kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: ConvexHull, that: Equal.Equal): boolean
    {
        return isConvexHull(that) && equals(this, that);
    },

    /**
     * Hashes exact vertex components and indexed face cycles, including invalid raw indices.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: ConvexHull): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ Hash.array(this.vertices),
            Hash.array(this.faces.map((face: ReadonlyArray<number>) => Hash.array(face))) ]));
    },

    /**
     * Retains all stored precision and indexed topology in frozen JSON data.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: ConvexHull): Json
    {
        return Object.freeze({ _id: "ConvexHull",
            faces: this.faces,
            vertices: Object.freeze(this.vertices.map((point: V.Vector3) => point.toJSON() as V.Json)) });
    },

    /**
     * Emits raw stored vertex and face text without canonical rounding.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: ConvexHull): string
    {
        return format(this);
    }
});

/**
 * Recognizes owned enriched hull values, including unsafe invalid topology.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isConvexHull = (input: unknown): input is ConvexHull =>
{
    return typeof input === "object" && input !== null && Object.getPrototypeOf(input) === Prototype;
};

/**
 * Copies/freezes raw vertices and optional face arrays without building/repairing a hull or computing
 * derived geometry. Omitting faces stores empty raw topology, whose geometric queries return None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ConvexHullUnsafe = (vertices: ReadonlyArray<V.Coordinates>,
    faces: ReadonlyArray<ReadonlyArray<number>> = []): ConvexHull =>
{
    const Value = Object.freeze(Object.assign(Object.create(Prototype) as ConvexHull, {
        faces: Object.freeze(faces.map((face: ReadonlyArray<number>) => Object.freeze([ ...face ]))),
        vertices: Object.freeze(vertices.map((point: V.Coordinates) =>
            V.Vector3Unsafe(point.x, point.y, point.z)))
    }));
    Cache.set(Value, undefined);
    return Value;
};

/**
 * Retrieves validated geometry without caching caller-owned mutable structural inputs.
 *
 * @category Internal
 * @since 1.0.0
 */
const data = (self: Coordinates): O.Option<I.Data> =>
{
    if (isConvexHull(self) && Cache.has(self))
    {
        const Existing = Cache.get(self);
        if (Existing !== undefined)
        {
            return Existing;
        }
    }

    const Result = I.prepare(self);
    if (isConvexHull(self) && Cache.has(self))
    {
        Cache.set(self, Result);
    }

    return Result;
};

/**
 * Validates closed outward convex indexed polygons before canonicalizing vertex/face ordering.
 * Rejects malformed, nonmanifold, inward, nonplanar, concave and zero-volume inputs without repair.
 * A 64-machine-epsilon conditioned allowance covers plane/support roundoff only.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromFaces: Binary<ReadonlyArray<V.Coordinates>, ReadonlyArray<ReadonlyArray<number>>,
    O.Option<ConvexHull>> = binary((self: ReadonlyArray<V.Coordinates>,
    that: ReadonlyArray<ReadonlyArray<number>>): O.Option<ConvexHull> =>
{
    if (O.isNone(I.prepare({ faces: that,
        vertices: self })))
    {
        return O.none();
    }

    const Canonical = I.canonical({ faces: that,
        vertices: self });
    const Result = ConvexHullUnsafe(Canonical.vertices, Canonical.faces);
    const Data = data(Result);
    return O.isSome(Data) ? O.some(Result) : O.none();
});

/**
 * Constructs a bounded full-dimensional solid from finite point clouds. Duplicate and interior
 * points are allowed; empty/point/collinear/coplanar clouds and unrepresentable derived data yield None.
 * The result is the convex envelope of points, never a replacement for validating concave indexed solids.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const ConvexHull = (points: ReadonlyArray<V.Coordinates>): O.Option<ConvexHull> =>
{
    return O.flatMap(I.build(points),
        (topology: I.Coordinates) => fromFaces(topology.vertices, topology.faces));
};

/**
 * Tests the full indexed solid domain, including topology and representable derived planes.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isValid = (self: Coordinates): boolean =>
{
    return O.isSome(data(self));
};

/**
 * Converts full-dimensional AABB corners into a solid hull; zero-volume boxes yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromAABB = (self: B.Coordinates): O.Option<ConvexHull> =>
{
    return O.flatMap(B.corners(self), ConvexHull);
};

/**
 * Converts representable full-dimensional OBB corners into a solid hull. Collapsed/zero-volume
 * boxes yield None.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromOBB = (self: S.Coordinates): O.Option<ConvexHull> =>
{
    return O.flatMap(S.corners(self), ConvexHull);
};

/**
 * Compares exact stored coordinates and face indices with Effect numeric semantics. Alternate
 * tessellations or raw relabelings are not geometric-set equality; invalid values remain reflexive.
 *
 * @category Equivalence
 * @since 1.0.0
 */
export const equals: Binary<Coordinates, Coordinates, boolean> = binary(
    (self: Coordinates, that: Coordinates) => self.vertices.length === that.vertices.length &&
        self.faces.length === that.faces.length &&
        self.vertices.every((point: V.Coordinates, index: number) =>
            V.equals(point, that.vertices[index])) &&
        self.faces.every((face: ReadonlyArray<number>, index: number) =>
            face.length === that.faces[index].length && face.every((value: number, position: number) =>
                N.Equivalence(value, that.faces[index][position]))));

/**
 * Returns frozen ascending-index edges derived only from valid solid topology.
 *
 * @category Operation
 * @since 1.0.0
 */
export const edges = (self: Coordinates): O.Option<ReadonlyArray<Edge>> =>
{
    return O.map(data(self), (value: I.Data) => value.edges);
};

/**
 * Returns outward frozen unit planes in stored face order; invalid raw topology yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const planes = (self: Coordinates): O.Option<ReadonlyArray<P.Plane>> =>
{
    return O.map(data(self), (value: I.Data) => value.planes);
};

/**
 * Returns finite enclosing AABB bounds of a valid solid hull.
 *
 * @category Operation
 * @since 1.0.0
 */
export const bounds = (self: Coordinates): O.Option<B.AABB> =>
{
    return isValid(self) ? B.fromPoints(self.vertices) : O.none();
};

/**
 * Aliases solid-hull enclosing bounds conversion.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toAABB = bounds;

/**
 * Returns positive solid volume in cubic blocks; unrepresentable overflow/underflow yields None.
 * Topology validation does not require the final cubic-block number to fit in a double.
 *
 * @category Operation
 * @since 1.0.0
 */
export const volume = (self: Coordinates): O.Option<number> =>
{
    return O.flatMap(data(self), I.volume);
};

/**
 * Returns the volume centroid, restoring conditioned coordinates without premature overflow.
 *
 * @category Operation
 * @since 1.0.0
 */
export const centroid = (self: Coordinates): O.Option<V.Vector3> =>
{
    return O.flatMap(data(self), (value: I.Data) => I.restored(value, value.normalizedCentroid));
};

/**
 * Returns the first stored exact support maximizer for a finite direction, copying the selected
 * vertex. Zero-direction ties select vertex zero; invalid input yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const supportPoint: Binary<Coordinates, V.Coordinates, O.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => V.isFinite(that) ? O.map(data(self), (value: I.Data) =>
    {
        const Point = self.vertices[I.support(value, that)];
        return V.Vector3Unsafe(Point.x, Point.y, Point.z);
    }) : O.none());

/**
 * Tests one outward half-space in scaled coordinates; distance tolerances use hull/relative-offset scale.
 *
 * @category Internal
 * @since 1.0.0
 */
const insidePlane = (point: V.Coordinates, origin: V.Coordinates, normal: V.Coordinates,
    hullScale: number, options: QueryOptions): boolean =>
{
    const Delta = V.subtract(point, origin);
    const Finite = V.isFinite(Delta);
    const Scale = [ hullScale, ...Finite ? [ Delta.x, Delta.y, Delta.z ] :
        [ point.x, point.y, point.z, origin.x, origin.y, origin.z ] ]
        .reduce((maximum: number, value: number) => N.max(maximum, N.abs(value)), 0);
    const D = Finite ? V.Vector3Unsafe(Delta.x / Scale, Delta.y / Scale, Delta.z / Scale) :
        V.Vector3Unsafe(point.x / Scale - origin.x / Scale, point.y / Scale - origin.y / Scale,
            point.z / Scale - origin.z / Scale);
    const Terms = [ D.x * normal.x, D.y * normal.y, D.z * normal.z ];
    const Distance = G.sum(Terms);
    const RelativeScale = Terms.reduce((maximum: number, value: number) =>
        N.max(maximum, N.abs(value)), hullScale / Scale);
    return Distance <= 0 || Distance <= (options.absoluteTolerance ?? 1e-9) / Scale +
        (options.relativeTolerance ?? 1e-9) * RelativeScale;
};

/**
 * Tests closed solid containment against every supporting plane with validated scale-aware tolerances.
 * Valid outside points yield Some(false); invalid topology/point/options yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const containsPoint: Query<V.Coordinates, boolean> = query("x",
    (self: Coordinates, that: V.Coordinates, options: QueryOptions = {}) =>
        V.isFinite(that) && G.validOptions(options) ? O.map(data(self), (value: I.Data) =>
            self.faces.every((face: ReadonlyArray<number>, index: number) => insidePlane(that,
                self.vertices[face[0]], value.planes[index].normal, value.scale, options))) : O.none());

/**
 * Aliases closed solid point containment.
 *
 * @category Queries
 * @since 1.0.0
 */
export const contains = containsPoint;

/**
 * Returns the closest point in the closed solid; interior points copy their input coordinates exactly.
 * Boundary search uses all face triangles and edges, never just a bounding box.
 *
 * @category Operation
 * @since 1.0.0
 */
export const closestPoint: Binary<Coordinates, V.Coordinates, O.Option<V.Vector3>> = binary(
    (self: Coordinates, that: V.Coordinates) => O.flatMap(containsPoint(self, that,
        { absoluteTolerance: 0,
            relativeTolerance: 0 }), (inside: boolean) =>
        inside ? V.Vector3(that.x, that.y, that.z) : I.nearest(self, that)));

/**
 * Returns block distance to the closed solid, zero for interior points. Invalid input or
 * unrepresentable closest point/distance yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const distanceToPoint: Binary<Coordinates, V.Coordinates, O.Option<number>> = binary(
    (self: Coordinates, that: V.Coordinates) => O.flatMap(closestPoint(self, that),
        (point: V.Vector3): O.Option<number> =>
        {
            const Distance = V.distance(point, that);
            return N.Number.isFinite(Distance) ? O.some(Distance) : O.none();
        }));

/**
 * Rigidly maps stored vertices, preserving indexed polygons. Revalidates degeneracy/convexity after
 * numeric conversion; invalid or unrepresentable output yields None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const transform: Binary<Coordinates, T.Coordinates, O.Option<ConvexHull>> = binary(
    (self: Coordinates, that: T.Coordinates): O.Option<ConvexHull> =>
    {
        if (!isValid(self))
        {
            return O.none();
        }

        const Points: Array<V.Vector3> = [];
        for (const Vertex of self.vertices)
        {
            const Point = T.transformPoint(that, Vertex);
            if (O.isNone(Point))
            {
                return O.none();
            }

            Points.push(Point.value);
        }

        return fromFaces(Points, self.faces);
    });

/**
 * Returns robust unit edge directions, subtracting original coordinates before any scale fallback.
 *
 * @category Internal
 * @since 1.0.0
 */
const polytope = (self: Coordinates, value: I.Data): I.Polytope =>
{
    return { directions: value.edges.map((edge: I.Edge) =>
    {
        const Raw = V.subtract(self.vertices[edge.end], self.vertices[edge.start]);
        return O.getOrThrow(V.normalize(V.isFinite(Raw) ? Raw :
            V.subtract(value.points[edge.end], value.points[edge.start])));
    }),
    normals: value.planes.map((plane: P.Plane) => plane.normal),
    vertices: self.vertices };
};

/**
 * Tests complete face-normal and pairwise edge-cross SAT for two valid solid hulls. Contact counts;
 * tolerances use conditioned projected endpoint scale. Invalid input/options yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlaps: Query<Coordinates, boolean> = query("vertices",
    (self: Coordinates, that: Coordinates, options: QueryOptions = {}) => G.validOptions(options) ?
        O.flatMap(data(self), (a: I.Data) => O.map(data(that), (b: I.Data) =>
            I.overlaps(polytope(self, a), polytope(that, b), options))) : O.none());

/**
 * Aliases complete hull/hull static overlap.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlapsConvexHull = overlaps;

/**
 * Tests complete overlap with valid AABB bounds, including degenerate boxes. Solid-only hull
 * conversion is not used for queries; invalid geometry/options yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlapsAABB: Query<B.Coordinates, boolean> = query("min",
    (self: Coordinates, that: B.Coordinates, options: QueryOptions = {}) => G.validOptions(options) ?
        O.flatMap(data(self), (value: I.Data) => O.map(B.corners(that), (points: B.Corners) =>
            I.overlaps(polytope(self, value), { directions: [ V.UnitX, V.UnitY, V.UnitZ ],
                normals: [ V.UnitX, V.UnitY, V.UnitZ ],
                vertices: points }, options))) : O.none());

/**
 * Tests complete overlap with valid OBB geometry, including lower-dimensional boxes. Invalid
 * input/options or unrepresentable world corners yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const overlapsOBB: Query<S.Coordinates, boolean> = query("center",
    (self: Coordinates, that: S.Coordinates, options: QueryOptions = {}) => G.validOptions(options) ?
        O.flatMap(data(self), (value: I.Data) => O.flatMap(S.corners(that), (points: S.Corners) =>
            O.map(Q.axes(that.rotation), (axes: Q.Axes) => I.overlaps(polytope(self, value), {
                directions: [ axes.x, axes.y, axes.z ],
                normals: [ axes.x, axes.y, axes.z ],
                vertices: points
            }, options)))) : O.none());

/**
 * Selects a unique outward direction, deduplicating coplanar triangulation normals within roundoff.
 *
 * @category Internal
 * @since 1.0.0
 */
const uniqueNormal = (normals: ReadonlyArray<V.Vector3>): O.Option<V.Vector3> =>
{
    return normals.length > 0 && normals.every((normal: V.Vector3) =>
        V.distance(normal, normals[0]) <= 64 * N.Number.EPSILON)
        ? O.some(V.Vector3Unsafe(normals[0].x, normals[0].y, normals[0].z)) : O.none();
};

/**
 * Clips a valid unit forward ray against all hull half-spaces. Inside origins hit at zero;
 * unique boundary faces have outward normals, while strict interior/edge/corner ties have None.
 * Coplanar triangulation faces share one normal. Invalid input/options or unrepresentable hits yield None.
 *
 * @category Queries
 * @since 1.0.0
 */
export const intersectRay: Query<R.Coordinates, R.Hit> = query("origin",
    (self: Coordinates, that: R.Coordinates, options: QueryOptions = {}): O.Option<R.Hit> =>
    {
        if (!R.isValid(that) || !G.validOptions(options))
        {
            return O.none();
        }

        return O.flatMap(data(self), (value: I.Data): O.Option<R.Hit> =>
        {
            let entry = 0;
            let exit = Infinity;
            let inside = true;
            let normals: Array<V.Vector3> = [];
            const Boundary: Array<V.Vector3> = [];
            for (const Plane of value.planes)
            {
                const Distance = P.signedDistance(Plane, that.origin);
                if (O.isNone(Distance))
                {
                    return O.none();
                }

                const On = G.withinTolerance(Distance.value,
                    N.max(value.scale, N.abs(Distance.value)), options);
                if (On)
                {
                    Boundary.push(Plane.normal);
                }

                if (Distance.value > 0 && !On)
                {
                    inside = false;
                }

                const Denominator = V.dot(Plane.normal, that.direction);
                if (Denominator === 0)
                {
                    if (Distance.value > 0 && !On)
                    {
                        return O.none();
                    }

                    continue;
                }

                const Parameter = -Distance.value / Denominator;
                if (Denominator < 0)
                {
                    const Tie = G.lessOrNear(entry, Parameter, options) &&
                        G.lessOrNear(Parameter, entry, options);
                    if (Parameter > entry)
                    {
                        normals = Tie ? [ ...normals, Plane.normal ] : [ Plane.normal ];
                        entry = Parameter;
                    }
                    else if (Tie)
                    {
                        normals.push(Plane.normal);
                    }
                }
                else
                {
                    exit = N.min(exit, Parameter);
                }
            }

            if (inside)
            {
                entry = 0;
                normals = Boundary;
            }
            else if (!N.Number.isFinite(entry) || exit < 0 || !G.lessOrNear(entry, exit, options))
            {
                return O.none();
            }

            return O.flatMap(R.at(that, entry), (point: V.Vector3): O.Option<R.Hit> =>
            {
                if (!O.getOrElse(containsPoint(self, point, options), () => false))
                {
                    return O.none();
                }

                const Contact = value.planes.filter((plane: P.Plane) =>
                {
                    const Distance = P.signedDistance(plane, point);
                    return O.isSome(Distance) && G.withinTolerance(Distance.value,
                        N.max(value.scale, N.abs(Distance.value)), options);
                }).map((plane: P.Plane) => plane.normal);
                const Normal = uniqueNormal(Contact.length > 0 ? Contact : normals);
                const Copied = Object.create(Object.getPrototypeOf(Normal),
                    Object.getOwnPropertyDescriptors(Normal)) as O.Option<V.Vector3>;
                return O.some(Object.freeze({ distance: entry === 0 ? 0 : entry,
                    normal: Object.freeze(Copied),
                    point }));
            });
        });
    });

/**
 * Formats raw vertex triples and indexed face lists separated by a vertical bar. Semicolons delimit
 * lists and Effect formatting retains full numeric precision, including unsafe nonfinite values.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format = (self: Coordinates): string =>
{
    const Vertices = self.vertices.map((point: V.Coordinates) =>
        `[${formatComponents([ point.x, point.y, point.z ])}]`).join(";");
    const Faces = self.faces.map((face: ReadonlyArray<number>) => `[${formatComponents(face)}]`).join(";");
    return `ConvexHull(${Vertices}|${Faces})`;
};

/**
 * Aliases default full-precision indexed solid formatting.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses a finite bracketed component list, retaining every supplied numeric component.
 *
 * @category Internal
 * @since 1.0.0
 */
const list = (text: string, count?: number): O.Option<ReadonlyArray<number>> =>
{
    const Match = /^\[([^[\]]+)\]$/.exec(text.trim());
    return Match === null ? O.none() : parseComponents(Match[1], count ?? Match[1].split(",").length);
};

/**
 * Parses and validates default stored vertex/topology text without changing index order or tessellation.
 * Invalid solids and malformed/nonfinite text yield None.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const fromString = (self: string): O.Option<ConvexHull> =>
{
    const Match = /^ConvexHull\((.*)\)$/.exec(self.trim());
    if (Match === null || Match[1].split("|").length !== 2)
    {
        return O.none();
    }

    const [ Vertices, Faces ] = Match[1].split("|");
    const Points: Array<V.Vector3> = [];
    const Topology: Array<ReadonlyArray<number>> = [];
    for (const Text of Vertices.split(";"))
    {
        const Values = list(Text, 3);
        if (O.isNone(Values))
        {
            return O.none();
        }

        Points.push(V.Vector3Unsafe(Values.value[0], Values.value[1], Values.value[2]));
    }

    for (const Text of Faces.split(";"))
    {
        const Values = list(Text);
        if (O.isNone(Values))
        {
            return O.none();
        }

        Topology.push(Values.value);
    }

    const Value = ConvexHullUnsafe(Points, Topology);
    return isValid(Value) ? O.some(Value) : O.none();
};

/**
 * Aliases strict indexed solid parsing.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const parse = fromString;
