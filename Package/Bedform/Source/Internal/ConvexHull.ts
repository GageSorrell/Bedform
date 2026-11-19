/**
 * Exact topology predicates and conditioned convex-polytope geometry.
 *
 * @module bedform/Internal/ConvexHull
 *
 * @file      ConvexHull.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as G from "./Geometry.js";
import * as N from "@bedform/effect/Number";
import * as O from "@bedform/effect/Option";
import * as P from "../Plane.js";
import * as V from "../Vector3.js";

/**
 * Readonly indexed polygon topology.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly vertices: ReadonlyArray<V.Coordinates>;
    readonly faces: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * Undirected edge with ascending vertex indices.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Edge
{
    readonly start: number;
    readonly end: number;
}

/**
 * Exact integer coordinates sharing a common positive binary scale.
 *
 * @category Types
 * @since 1.0.0
 */
interface IntegerPoint
{
    readonly x: bigint;
    readonly y: bigint;
    readonly z: bigint;
}

/**
 * Exact finite-double significand and binary exponent.
 *
 * @category Types
 * @since 1.0.0
 */
interface BinaryParts
{
    readonly significand: bigint;
    readonly exponent: number;
}

/**
 * Conditioned coordinates relative to a copied reference point.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Frame
{
    readonly origin: V.Vector3;
    readonly scale: number;
    readonly points: ReadonlyArray<V.Vector3>;
}

/**
 * Validated finite geometric data, preserving the input's indexed topology.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Data extends Frame
{
    readonly integers: ReadonlyArray<IntegerPoint>;
    readonly edges: ReadonlyArray<Edge>;
    readonly planes: ReadonlyArray<P.Plane>;
    readonly normalizedVolume: number;
    readonly normalizedCentroid: V.Vector3;
}

/**
 * Vertex and axis data for complete static polytope SAT, including degenerate boxes.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Polytope
{
    readonly vertices: ReadonlyArray<V.Coordinates>;
    readonly normals: ReadonlyArray<V.Coordinates>;
    readonly directions: ReadonlyArray<V.Coordinates>;
}

/**
 * Decodes a finite IEEE double without losing subnormal bits; no host-specific APIs are used.
 *
 * @category Internal
 * @since 1.0.0
 */
const parts = (value: number): BinaryParts =>
{
    const View = new DataView(new ArrayBuffer(8));
    View.setFloat64(0, value);
    const Bits = View.getBigUint64(0);
    const Exponent = N.Number((Bits >> 52n) & 2_047n);
    const Fraction = Bits & ((1n << 52n) - 1n);
    const Sign = (Bits >> 63n) === 0n ? 1n : -1n;
    return { exponent: Exponent === 0 ? -1_074 : Exponent - 1_075,
        significand: Sign * (Exponent === 0 ? Fraction : Fraction + (1n << 52n)) };
};

/**
 * Converts finite coordinates to exact integers on one common binary lattice.
 *
 * @category Internal
 * @since 1.0.0
 */
const integers = (
    points: ReadonlyArray<V.Coordinates>,
    fixedExponent?: number
): ReadonlyArray<IntegerPoint> =>
{
    const Values = points.flatMap((point: V.Coordinates) =>
        [ parts(point.x), parts(point.y), parts(point.z) ]);
    const Exponent = fixedExponent ?? Values.reduce((minimum: number, value: BinaryParts) =>
        value.significand === 0n ? minimum : N.min(minimum, value.exponent), 0);
    const ValuesAsIntegers = Values.map((value: BinaryParts) => value.significand === 0n ? 0n :
        value.significand << BigInt(value.exponent - Exponent));
    return points.map((_: V.Coordinates, index: number) => ({ x: ValuesAsIntegers[index * 3],
        y: ValuesAsIntegers[index * 3 + 1],
        z: ValuesAsIntegers[index * 3 + 2] }));
};

/**
 * Subtracts exact integer coordinates.
 *
 * @category Internal
 * @since 1.0.0
 */
const subtract = (a: IntegerPoint, b: IntegerPoint): IntegerPoint =>
{
    return { x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z };
};

/**
 * Computes an exact integer cross product.
 *
 * @category Internal
 * @since 1.0.0
 */
const cross = (a: IntegerPoint, b: IntegerPoint): IntegerPoint =>
{
    return { x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x };
};

/**
 * Computes an exact integer dot product.
 *
 * @category Internal
 * @since 1.0.0
 */
const dot = (a: IntegerPoint, b: IntegerPoint): bigint =>
{
    return a.x * b.x + a.y * b.y + a.z * b.z;
};

/**
 * Gives the exact signed side of d relative to oriented triangle abc.
 *
 * @category Internal
 * @since 1.0.0
 */
const orientation = (a: IntegerPoint, b: IntegerPoint, c: IntegerPoint, d: IntegerPoint): bigint =>
{
    return dot(cross(subtract(b, a), subtract(c, a)), subtract(d, a));
};

/**
 * Orders finite coordinates lexicographically, with signed zeros agreeing.
 *
 * @category Internal
 * @since 1.0.0
 */
export const compareVertices = (a: V.Coordinates, b: V.Coordinates): number =>
{
    return a.x < b.x ? -1 : a.x > b.x ? 1 : a.y < b.y ? -1 : a.y > b.y ? 1 :
        a.z < b.z ? -1 : a.z > b.z ? 1 : 0;
};

/**
 * Conditions finite positions, subtracting first when possible to preserve large common origins.
 *
 * @category Internal
 * @since 1.0.0
 */
export const frame = (points: ReadonlyArray<V.Coordinates>): Frame =>
{
    const Origin = V.Vector3Unsafe(points[0].x, points[0].y, points[0].z);
    const Differences = points.map((point: V.Coordinates) => V.subtract(point, Origin));
    const Finite = Differences.every(V.isFinite);
    const Scale = (Finite ? Differences : points).reduce((maximum: number, point: V.Coordinates) =>
        N.max(maximum, N.max(N.abs(point.x), N.max(N.abs(point.y), N.abs(point.z)))), 0) || 1;
    return { origin: Origin,
        points: points.map((point: V.Coordinates, index: number) =>
            Finite ? V.Vector3Unsafe(Differences[index].x / Scale, Differences[index].y / Scale,
                Differences[index].z / Scale) : V.Vector3Unsafe(point.x / Scale - Origin.x / Scale,
                point.y / Scale - Origin.y / Scale, point.z / Scale - Origin.z / Scale)),
        scale: Scale };
};

/**
 * Builds a deterministic incremental triangulation from sorted unique finite point clouds.
 * Exact signs decide visibility and degeneracy; unused duplicate/interior points are discarded.
 *
 * @category Internal
 * @since 1.0.0
 */
export const build = (points: ReadonlyArray<V.Coordinates>): O.Option<Coordinates> =>
{
    if (points.length < 4 || !Array.from(points).every((point: V.Coordinates) =>
        point !== undefined && V.isFinite(point)))
    {
        return O.none();
    }

    const Vertices = [ ...points ].sort(compareVertices).filter((point: V.Coordinates, index: number,
        values: Array<V.Coordinates>) => index === 0 || compareVertices(point, values[index - 1]) !== 0);
    if (Vertices.length < 4)
    {
        return O.none();
    }

    const Exact = integers(Vertices);
    const A = 0;
    const B = 1;
    const C = Exact.findIndex((point: IntegerPoint) =>
    {
        const Normal = cross(subtract(Exact[B], Exact[A]), subtract(point, Exact[A]));
        return Normal.x !== 0n || Normal.y !== 0n || Normal.z !== 0n;
    });
    if (C < 0)
    {
        return O.none();
    }

    const D = Exact.findIndex((point: IntegerPoint) =>
        orientation(Exact[A], Exact[B], Exact[C], point) !== 0n);
    if (D < 0)
    {
        return O.none();
    }

    const Seed = [ A, B, C, D ];
    let faces = Seed.map((opposite: number) =>
    {
        const Face = Seed.filter((index: number) => index !== opposite);
        if (orientation(Exact[Face[0]], Exact[Face[1]], Exact[Face[2]], Exact[opposite]) > 0n)
        {
            [ Face[1], Face[2] ] = [ Face[2], Face[1] ];
        }

        return Face;
    });
    for (let index = 0; index < Vertices.length; index++)
    {
        if (Seed.includes(index))
        {
            continue;
        }

        const Visible = faces.filter((face: Array<number>) =>
            orientation(Exact[face[0]], Exact[face[1]], Exact[face[2]], Exact[index]) > 0n);
        const Horizon = new Map<string, readonly [number, number]>();
        for (const Face of Visible)
        {
            for (let edge = 0; edge < 3; edge++)
            {
                const Start = Face[edge];
                const End = Face[(edge + 1) % 3];
                if (!Horizon.delete(`${End}:${Start}`))
                {
                    Horizon.set(`${Start}:${End}`, [ Start, End ]);
                }
            }
        }

        faces = faces.filter((face: Array<number>) => !Visible.includes(face));
        for (const [ Start, End ] of Horizon.values())
        {
            faces.push([ Start, End, index ]);
        }
    }

    const Used = Array.from(new Set(faces.flat())).sort((a: number, b: number) => a - b);
    const Indices = new Map(Used.map((index: number, position: number) => [ index, position ]));
    return O.some({ faces: faces.map((face: Array<number>) =>
        face.map((index: number) => Indices.get(index)!)),
    vertices: Used.map((index: number) => Vertices[index]) });
};

/**
 * Canonicalizes vertex indices, face cycle starts and face order while preserving polygon winding
 * and tessellation. Validation must precede this operation.
 *
 * @category Internal
 * @since 1.0.0
 */
export const canonical = (self: Coordinates): Coordinates =>
{
    const Indices = self.vertices.map((_: V.Coordinates, index: number) => index)
        .sort((a: number, b: number) => compareVertices(self.vertices[a], self.vertices[b]));
    const Mapping = new Map(Indices.map((old: number, index: number) => [ old, index ]));
    const Faces = self.faces.map((face: ReadonlyArray<number>) =>
    {
        const Values = face.map((index: number) => Mapping.get(index)!);
        const Start = Values.indexOf(Values.reduce((a: number, b: number) => N.min(a, b)));
        return [ ...Values.slice(Start), ...Values.slice(0, Start) ];
    }).sort((a: Array<number>, b: Array<number>) =>
    {
        for (let index = 0; index < N.min(a.length, b.length); index++)
        {
            if (a[index] !== b[index])
            {
                return a[index] - b[index];
            }
        }

        return a.length - b.length;
    });
    return { faces: Faces,
        vertices: Indices.map((index: number) => self.vertices[index]) };
};

/**
 * Validates planar convex faces, outward supporting planes and a closed connected spherical
 * manifold, including vertex fans. Numeric derived planes/mass data must also be representable.
 *
 * @category Internal
 * @since 1.0.0
 */
export const prepare = (self: Coordinates): O.Option<Data> =>
{
    const { vertices: Vertices, faces: Faces } = self;
    if (Vertices.length < 4 || Faces.length < 4 ||
        !Array.from(Vertices).every((point: V.Coordinates) => point !== undefined && V.isFinite(point)))
    {
        return O.none();
    }

    const Sorted = [ ...Vertices ].sort(compareVertices);
    if (Sorted.some((point: V.Coordinates, index: number) =>
        index > 0 && compareVertices(point, Sorted[index - 1]) === 0))
    {
        return O.none();
    }

    const Exact = integers(Vertices);
    const Frame = frame(Vertices);
    const Used = new Set<number>();
    const Edges = new Map<string, Array<readonly [number, number, number]>>();
    const Planes: Array<P.Plane> = [];
    for (let faceIndex = 0; faceIndex < Faces.length; faceIndex++)
    {
        const Face = Faces[faceIndex];
        if (Face === undefined || Face.length < 3 || new Set(Face).size !== Face.length ||
            !Array.from(Face).every((index: number) => N.Number.isInteger(index) &&
                index >= 0 && index < Vertices.length))
        {
            return O.none();
        }

        const A = Exact[Face[0]];
        const B = Exact[Face[1]];
        const C = Exact[Face[2]];
        const Normal = cross(subtract(B, A), subtract(C, A));
        const NumericPlane = P.fromPoints(Frame.points[Face[0]],
            Frame.points[Face[1]], Frame.points[Face[2]]);
        if (O.isNone(NumericPlane))
        {
            return O.none();
        }

        const Distances = Frame.points.map((point: V.Vector3) =>
            G.sum([ V.dot(NumericPlane.value.normal, point), NumericPlane.value.offset ]));
        const Roundoff = 64 * N.Number.EPSILON;
        if (dot(Normal, Normal) === 0n || Face.some((index: number) => N.abs(Distances[index]) > Roundoff) ||
            Distances.some((distance: number) => distance > Roundoff) ||
            !Exact.some((point: IntegerPoint) => orientation(A, B, C, point) < 0n))
        {
            return O.none();
        }

        for (let edge = 0; edge < Face.length; edge++)
        {
            const Start = Face[edge];
            const End = Face[(edge + 1) % Face.length];
            for (const Index of Face)
            {
                if (Index !== Start && Index !== End && dot(cross(subtract(Exact[End], Exact[Start]),
                    subtract(Exact[Index], Exact[Start])), Normal) <= 0n)
                {
                    return O.none();
                }
            }

            Used.add(Start);
            const Key = `${N.min(Start, End)}:${N.max(Start, End)}`;
            const Entries = Edges.get(Key) ?? [];
            Entries.push([ Start, End, faceIndex ]);
            Edges.set(Key, Entries);
        }

        const Plane = P.fromPoints(Vertices[Face[0]], Vertices[Face[1]], Vertices[Face[2]]);
        if (O.isNone(Plane))
        {
            return O.none();
        }

        Planes.push(Plane.value);
    }

    const Pairs = Array.from(Edges.values());
    if (Used.size !== Vertices.length || Vertices.length - Edges.size + Faces.length !== 2 ||
        Pairs.some((pair: Array<readonly [number, number, number]>) => pair.length !== 2 ||
            pair[0][0] !== pair[1][1] || pair[0][1] !== pair[1][0]))
    {
        return O.none();
    }

    for (let vertex = -1; vertex < Vertices.length; vertex++)
    {
        const Incident = Faces.map((_: ReadonlyArray<number>, index: number) => index)
            .filter((index: number) => vertex < 0 || Faces[index].includes(vertex));
        const Seen = new Set<number>([ Incident[0] ]);
        const Queue = [ Incident[0] ];
        for (const Current of Queue)
        {
            for (const Pair of Pairs)
            {
                if (vertex >= 0 && Pair[0][0] !== vertex && Pair[0][1] !== vertex)
                {
                    continue;
                }

                const Next = Pair[0][2] === Current ? Pair[1][2] : Pair[1][2] === Current ? Pair[0][2] : -1;
                if (Next >= 0 && !Seen.has(Next))
                {
                    Seen.add(Next);
                    Queue.push(Next);
                }
            }
        }

        if (Seen.size !== Incident.length)
        {
            return O.none();
        }
    }

    const Volumes: Array<number> = [];
    const Centers: Array<V.Vector3> = [];
    for (const Face of Faces)
    {
        const A = Frame.points[Face[0]];
        for (let index = 1; index + 1 < Face.length; index++)
        {
            const B = Frame.points[Face[index]];
            const C = Frame.points[Face[index + 1]];
            Volumes.push(V.dot(A, V.cross(B, C)) / 6);
            Centers.push(V.scale(V.add(V.add(A, B), C), 0.25));
        }
    }

    const Volume = G.sum(Volumes);
    if (!(Volume > 0) || !N.Number.isFinite(Volume))
    {
        return O.none();
    }

    const Center = V.Vector3Unsafe(G.sum(Centers.map((point: V.Vector3, index: number) =>
        point.x * (Volumes[index] / Volume))), G.sum(Centers.map((point: V.Vector3, index: number) =>
        point.y * (Volumes[index] / Volume))), G.sum(Centers.map((point: V.Vector3, index: number) =>
        point.z * (Volumes[index] / Volume))));
    return O.some(Object.freeze({ ...Frame,
        edges: Object.freeze(Pairs.map((pair: Array<readonly [number, number, number]>) => Object.freeze({
            end: N.max(pair[0][0], pair[0][1]),
            start: N.min(pair[0][0], pair[0][1])
        })).sort((a: Edge, b: Edge) => a.start - b.start || a.end - b.end)),
        integers: Exact,
        normalizedCentroid: Center,
        normalizedVolume: Volume,
        planes: Object.freeze(Planes) }));
};

/**
 * Chooses the first stored support vertex with an exact dot-product comparison, including ties.
 *
 * @category Internal
 * @since 1.0.0
 */
export const support = (data: Data, direction: V.Coordinates): number =>
{
    const Direction = integers([ direction ])[0];
    let best = 0;
    for (let index = 1; index < data.integers.length; index++)
    {
        if (dot(subtract(data.integers[index], data.integers[best]), Direction) > 0n)
        {
            best = index;
        }
    }

    return best;
};

/**
 * Restores a conditioned point using compensated component sums.
 *
 * @category Internal
 * @since 1.0.0
 */
export const restored = (frame: Frame, point: V.Coordinates): O.Option<V.Vector3> =>
{
    return V.Vector3(restoreComponent(frame.origin.x, point.x, frame.scale),
        restoreComponent(frame.origin.y, point.y, frame.scale),
        restoreComponent(frame.origin.z, point.z, frame.scale));
};

/**
 * Restores one component with a scaled cancellation fallback if the product alone overflows.
 *
 * @category Internal
 * @since 1.0.0
 */
const restoreComponent = (origin: number, point: number, scale: number): number =>
{
    const Direct = G.sum([ origin, point * scale ]);
    return N.Number.isFinite(Direct) ? Direct : G.sum([ origin / scale, point ]) * scale;
};

/**
 * Restores volume with binary exponent bookkeeping, avoiding premature scale-cube overflow.
 * A nonpositive/overflowed/underflowed final volume is not representable and yields None.
 *
 * @category Internal
 * @since 1.0.0
 */
export const volume = (data: Data): O.Option<number> =>
{
    const Scale = parts(data.scale);
    const ScaleBits = Scale.significand.toString(2).length - 1;
    const Mantissa = N.Number(Scale.significand) / N.pow(2, ScaleBits);
    const Coefficient = parts(data.normalizedVolume * Mantissa * Mantissa * Mantissa);
    const Bits = Coefficient.significand.toString(2).length - 1;
    const M = N.Number(Coefficient.significand) / N.pow(2, Bits);
    const E = Coefficient.exponent + Bits + 3 * (Scale.exponent + ScaleBits);
    const Value = E < -1_022 ? M * N.pow(2, E + 1_074) * N.Number.MIN_VALUE : M * N.pow(2, E);
    return Value > 0 && N.Number.isFinite(Value) ? O.some(Value) : O.none();
};

/**
 * Converts a nonnegative unit rational to a nearest double without overflowing either bigint.
 *
 * @category Internal
 * @since 1.0.0
 */
const ratio = (numerator: bigint, denominator: bigint): number =>
{
    return N.Number(((numerator << 54n) + denominator / 2n) / denominator) / N.pow(2, 54);
};

/**
 * Restores a convex barycentric combination with compensated sums and coordinate-range clamping
 * for final floating-point roundoff only.
 *
 * @category Internal
 * @since 1.0.0
 */
const barycentric = (a: V.Coordinates, b: V.Coordinates, c: V.Coordinates, u: number, v: number): V.Vector3 =>
{
    const Total = u + v;
    const U = Total > 1 ? u / Total : u;
    const W = Total > 1 ? 0 : 1 - u - v;
    const Z = Total > 1 ? 1 - U : v;
    const Component = (first: number, second: number, third: number): number =>
        N.max(N.min(first, N.min(second, third)), N.min(N.max(first, N.max(second, third)),
            G.sum([ W * first, U * second, Z * third ])));
    return V.Vector3Unsafe(Component(a.x, b.x, c.x), Component(a.y, b.y, c.y), Component(a.z, b.z, c.z));
};

/**
 * Finds a closest solid-boundary point with exact triangle-region/segment-parameter predicates.
 * Candidate distance ordering uses one exact integer lattice, retaining finite nearest coordinates
 * even when the query is extremely far away or all ordinary squared distances overflow.
 *
 * @category Internal
 * @since 1.0.0
 */
export const nearest = (self: Coordinates, point: V.Coordinates): O.Option<V.Vector3> =>
{
    const Exact = integers([ ...self.vertices, point ], -1_074);
    const Query = Exact[Exact.length - 1];
    let best = self.vertices[0];
    let delta = subtract(Query, Exact[0]);
    let distance = dot(delta, delta);
    for (const Face of self.faces)
    {
        for (let index = 1; index + 1 < Face.length; index++)
        {
            const Indices = [ Face[0], Face[index], Face[index + 1] ];
            const A = self.vertices[Indices[0]];
            const B = self.vertices[Indices[1]];
            const C = self.vertices[Indices[2]];
            const EA = Exact[Indices[0]];
            const EB = Exact[Indices[1]];
            const EC = Exact[Indices[2]];
            const AB = subtract(EB, EA);
            const AC = subtract(EC, EA);
            const AP = subtract(Query, EA);
            const D00 = dot(AB, AB);
            const D01 = dot(AB, AC);
            const D11 = dot(AC, AC);
            const D20 = dot(AP, AB);
            const D21 = dot(AP, AC);
            const Denominator = D00 * D11 - D01 * D01;
            const U = D11 * D20 - D01 * D21;
            const Z = D00 * D21 - D01 * D20;
            const Candidates: Array<V.Vector3> = [];
            if (Denominator > 0n && U >= 0n && Z >= 0n && U + Z <= Denominator)
            {
                Candidates.push(barycentric(A, B, C, ratio(U, Denominator), ratio(Z, Denominator)));
            }

            for (const [ Start, End ] of [ [ Indices[0], Indices[1] ],
                [ Indices[1], Indices[2] ], [ Indices[2], Indices[0] ] ])
            {
                const Edge = subtract(Exact[End], Exact[Start]);
                const Length = dot(Edge, Edge);
                const Projection = dot(subtract(Query, Exact[Start]), Edge);
                const T = Projection <= 0n ? 0 : Projection >= Length ? 1 : ratio(Projection, Length);
                Candidates.push(barycentric(self.vertices[Start],
                    self.vertices[End], self.vertices[End], T, 0));
            }

            for (const Candidate of Candidates)
            {
                delta = subtract(Query, integers([ Candidate ], -1_074)[0]);
                const Distance = dot(delta, delta);
                if (Distance < distance)
                {
                    best = Candidate;
                    distance = Distance;
                }
            }
        }
    }

    return V.Vector3(best.x, best.y, best.z);
};

/**
 * Compares an exact positive projected gap against finite absolute/relative tolerances.
 * Projection integers use the common 2^-2148 lattice from finite coordinates and unit axes.
 *
 * @category Internal
 * @since 1.0.0
 */
const separated = (gap: bigint, scale: bigint, options: G.QueryOptions): boolean =>
{
    const Absolute = parts(options.absoluteTolerance ?? 1e-9);
    const Relative = parts(options.relativeTolerance ?? 1e-9);
    const Exponent = N.min(0, Relative.exponent);
    const Left = gap << BigInt(-Exponent);
    const AbsoluteTerm = Absolute.significand << BigInt(Absolute.exponent + 2_148 - Exponent);
    const RelativeTerm = Relative.significand * scale << BigInt(Relative.exponent - Exponent);
    return Left > AbsoluteTerm + RelativeTerm;
};

/**
 * Tests complete face-normal/edge-cross SAT with exact projected interval comparisons. Relative
 * tolerance uses symmetric projected spans/endpoint separations, independent of world translation.
 * Degenerate boxes remain valid polytopes; callers validate geometry and tolerance domains.
 *
 * @category Internal
 * @since 1.0.0
 */
export const overlaps = (a: Polytope, b: Polytope, options: G.QueryOptions): boolean =>
{
    const Points = integers([ ...a.vertices, ...b.vertices ], -1_074);
    const Origin = Points[0];
    const A = Points.slice(0, a.vertices.length).map((point: IntegerPoint) => subtract(point, Origin));
    const B = Points.slice(a.vertices.length).map((point: IntegerPoint) => subtract(point, Origin));
    const Candidates = [ ...a.normals, ...b.normals, ...a.directions.flatMap((first: V.Coordinates) =>
        b.directions.map((second: V.Coordinates) => V.cross(first, second))) ];
    for (const Candidate of Candidates)
    {
        const Unit = V.normalize(Candidate);
        if (O.isNone(Unit))
        {
            continue;
        }

        const Axis = integers([ Unit.value ], -1_074)[0];
        const PA = A.map((point: IntegerPoint) => dot(point, Axis));
        const PB = B.map((point: IntegerPoint) => dot(point, Axis));
        const MinA = PA.reduce((x: bigint, y: bigint) => x < y ? x : y);
        const MaxA = PA.reduce((x: bigint, y: bigint) => x > y ? x : y);
        const MinB = PB.reduce((x: bigint, y: bigint) => x < y ? x : y);
        const MaxB = PB.reduce((x: bigint, y: bigint) => x > y ? x : y);
        const Width = [ MaxA - MinA, MaxB - MinB, MinA - MinB, MaxA - MaxB ]
            .map((value: bigint) => value < 0n ? -value : value)
            .reduce((x: bigint, y: bigint) => x > y ? x : y);
        if ((MinA > MaxB && separated(MinA - MaxB, Width, options)) ||
            (MinB > MaxA && separated(MinB - MaxA, Width, options)))
        {
            return false;
        }
    }

    return true;
};
