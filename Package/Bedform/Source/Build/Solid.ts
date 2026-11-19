/**
 * Bounded plane-arrangement solid partitioning and signed tetrahedron integration.
 *
 * @module bedform/Build/Solid
 *
 * @file      Solid.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Host geometry/packet expressions keep mathematical ordering and contextual types. */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */
/* Document exported constants at their declarations; generated expressions retain layout. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Geometric kernels use inferred local scalar/vector types. */
/* eslint-disable @typescript-eslint/typedef */

import * as H from "../ConvexHull.js";
import * as O from "@bedform/effect/Option";
import * as V from "../Vector3.js";
import type * as C from "../CollisionShape.js";
import type * as M from "../PhysicsModel.js";

/**
 * Absolute and scale-relative geometric budgets; exhaustion never creates a proxy.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Limits = Object.freeze({ triangles: 1_024,
    planes: 128,
    cells: 4_096,
    faceVertices: 256,
    extent: 1_024,
    coordinate: 1_000_000,
    relativeTolerance: 1e-9,
    work: 4_000_000,
    cellVertices: 256 } as const);

/**
 * Source-located compilation failure suitable for CLI diagnostics.
 *
 * @category Errors
 * @since 1.0.0
 */
export class SolidError extends Error
{
    readonly _tag = "SolidError";
    constructor(message: string, readonly sources: ReadonlyArray<string> = [])
    {
        super(`${message}${sources.length ? ` [${sources.join(", ")}]` : ""}`);
    }
}

/**
 * Indexed oriented triangles in already-converted block coordinates.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Surface
{
    readonly vertices: ReadonlyArray<V.Coordinates>;
    readonly triangles: ReadonlyArray<M.Triangle>;
}

/**
 * Mutable host-only polygon clipping face; normal points outward.
 *
 * @category Types
 * @since 1.0.0
 */
interface Face
{
    points: Array<V.Coordinates>;
}

/**
 * Unit plane used for bounded spatial partitioning.
 *
 * @category Types
 * @since 1.0.0
 */
interface Plane
{
    normal: V.Coordinates;
    offset: number;
}

/**
 * Complete source partition and its numerical classification tolerance in blocks.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Partition
{
    readonly cells: ReadonlyArray<C.CollisionShape.Cell>;
    readonly tolerance: number;
}

const Add = (a: V.Coordinates, b: V.Coordinates): V.Coordinates =>
    ({ x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z });
const Sub = (a: V.Coordinates, b: V.Coordinates): V.Coordinates =>
    ({ x: a.x - b.x,
        y: a.y - b.y,
        z: a.z - b.z });
const Mul = (a: V.Coordinates, s: number): V.Coordinates => ({ x: a.x * s,
    y: a.y * s,
    z: a.z * s });
const Dot = (a: V.Coordinates, b: V.Coordinates): number => a.x * b.x + a.y * b.y + a.z * b.z;
const Cross = (a: V.Coordinates, b: V.Coordinates): V.Coordinates =>
    ({ x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x });
const Length = (a: V.Coordinates): number => Math.hypot(a.x, a.y, a.z);
const Mean = (points: ReadonlyArray<V.Coordinates>): V.Coordinates =>
    Mul(points.reduce(Add, { x: 0,
        y: 0,
        z: 0 }), 1 / points.length);
const Source = (t: M.Triangle): string => `${t.source.object}:face ${t.source.face}`;
const PointsOf = (s: Surface, t: M.Triangle): Array<V.Coordinates> => t.indices.map((i) => s.vertices[i]);
const NormalOf = (p: ReadonlyArray<V.Coordinates>): V.Coordinates =>
    Cross(Sub(p[1], p[0]), Sub(p[2], p[0]));

/**
 * Computes winding in a closed oriented shell, including concave regions and cavities.
 *
 * @category Build
 * @since 1.0.0
 */
const winding = (surface: Surface, point: V.Coordinates, triangles = surface.triangles): number =>
{
    let angle = 0;
    for (const Triangle of triangles)
    {
        const [ A, B, C ] = PointsOf(surface, Triangle).map((p) => Sub(p, point));
        angle += 2 * Math.atan2(Dot(A, Cross(B, C)),
            Length(A) * Length(B) * Length(C) + Dot(A, B) * Length(C) +
            Dot(B, C) * Length(A) + Dot(C, A) * Length(B));
    }

    return angle / (4 * Math.PI);
};

/**
 * Tests a point against an oriented triangle projected to its own plane.
 *
 * @category Build
 * @since 1.0.0
 */
const inTriangle = (point: V.Coordinates, triangle: ReadonlyArray<V.Coordinates>, epsilon: number): boolean =>
{
    const N = NormalOf(triangle);
    const Unit = Mul(N, 1 / Length(N));
    return triangle.every((p, i) =>
    {
        const Edge = Sub(triangle[(i + 1) % 3], p);
        return Dot(Unit, Cross(Edge, Sub(point, p))) >= -epsilon * Length(Edge);
    });
};

/**
 * Detects intersections beyond an explicitly shared topological edge or vertex.
 * Coplanar positive-area overlap is rejected as well as noncoplanar crossings.
 *
 * @category Build
 * @since 1.0.0
 */
const intersects = (surface: Surface, a: M.Triangle, b: M.Triangle, epsilon: number): boolean =>
{
    const Pa = PointsOf(surface, a);
    const Pb = PointsOf(surface, b);
    const Shared = a.indices.filter((i) => b.indices.includes(i)).map((i) => surface.vertices[i]);
    const Allowed = (p: V.Coordinates): boolean =>
    {
        if (Shared.length === 1)
        {
            return Length(Sub(p, Shared[0])) <= epsilon;
        }

        if (Shared.length === 2)
        {
            const Edge = Sub(Shared[1], Shared[0]);
            const T = Dot(Sub(p, Shared[0]), Edge) / Dot(Edge, Edge);
            return T >= -epsilon && T <= 1 + epsilon &&
                Length(Sub(p, Add(Shared[0], Mul(Edge, T)))) <= epsilon;
        }

        return false;
    };

    const Na = Mul(NormalOf(Pa), 1 / Length(NormalOf(Pa)));
    const Nb = Mul(NormalOf(Pb), 1 / Length(NormalOf(Pb)));
    const Coplanar = Pb.every((p) => Math.abs(Dot(Na, Sub(p, Pa[0]))) <= epsilon);
    if (Coplanar)
    {
        // Centroids catch coincident triangles; vertices and edge midpoints catch containment.
        for (const [ One, Other ] of [ [ Pa, Pb ], [ Pb, Pa ] ])
        {
            for (const P of [ ...One, Mean(One), ...One.map((p, i) => Mean([ p, One[(i + 1) % 3] ])) ])
            {
                if (inTriangle(P, Other, epsilon) && !Allowed(P))
                {
                    return true;
                }
            }

            for (let i = 0; i < 3; i++)
            {
                for (let j = 0; j < 3; j++)
                {
                    const P = One[i];
                    const R = Sub(One[(i + 1) % 3], P);
                    const Q = Other[j];
                    const S = Sub(Other[(j + 1) % 3], Q);
                    const Denominator = Dot(Na, Cross(R, S));
                    if (Math.abs(Denominator) <= epsilon * epsilon)
                    {
                        continue;
                    }

                    const T = Dot(Na, Cross(Sub(Q, P), S)) / Denominator;
                    const U = Dot(Na, Cross(Sub(Q, P), R)) / Denominator;
                    if (T >= 0 && T <= 1 && U >= 0 && U <= 1 && !Allowed(Add(P, Mul(R, T))))
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    for (const [ One, Other, N ] of [ [ Pa, Pb, Nb ], [ Pb, Pa, Na ] ] as const)
    {
        for (let i = 0; i < 3; i++)
        {
            const P = One[i];
            const Q = One[(i + 1) % 3];
            const Dp = Dot(N, Sub(P, Other[0]));
            const Dq = Dot(N, Sub(Q, Other[0]));
            if (Math.abs(Dp) <= epsilon && inTriangle(P, Other, epsilon) && !Allowed(P))
            {
                return true;
            }

            if (Dp * Dq >= 0)
            {
                continue;
            }

            const Hit = Add(P, Mul(Sub(Q, P), Dp / (Dp - Dq)));
            if (inTriangle(Hit, Other, epsilon) && !Allowed(Hit))
            {
                return true;
            }
        }
    }

    return false;
};

/**
 * Validates welded closed manifolds, connected vertex fans, disjoint shells and
 * alternating exterior/cavity orientation before any physical registration.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const validate = (surface: Surface, epsilon: number): void =>
{
    if (!surface.triangles.length || surface.triangles.length > Limits.triangles)
    {
        throw new SolidError(`Triangle budget is 1..${Limits.triangles}`);
    }

    const Edges = new Map<string, Array<{ triangle: number;
        direction: number }>>();
    const Used = new Set<number>();
    const Adjacency = surface.triangles.map(() => new Set<number>());
    surface.triangles.forEach((t, index) =>
    {
        if (t.indices.length !== 3 || new Set(t.indices).size !== 3 ||
            t.indices.some((i) => !Number.isSafeInteger(i) || i < 0 || i >= surface.vertices.length))
        {
            throw new SolidError("Invalid triangle indices", [ Source(t) ]);
        }

        if (Length(NormalOf(PointsOf(surface, t))) <= epsilon * epsilon)
        {
            throw new SolidError("Degenerate triangle", [ Source(t) ]);
        }

        t.indices.forEach((i, j) =>
        {
            Used.add(i);
            const Next = t.indices[(j + 1) % 3];
            const Key = `${Math.min(i, Next)}:${Math.max(i, Next)}`;
            const List = Edges.get(Key) ?? [];
            List.push({ triangle: index,
                direction: i < Next ? 1 : -1 });
            Edges.set(Key, List);
        });
    });
    if (Used.size !== surface.vertices.length)
    {
        throw new SolidError("Unused vertices are not allowed; export evaluated welded topology");
    }

    for (const List of Edges.values())
    {
        if (List.length !== 2 || List[0].direction === List[1].direction)
        {
            throw new SolidError("Open, nonmanifold or inconsistently oriented edge; weld evaluated vertices",
                List.map((e) => Source(surface.triangles[e.triangle])));
        }

        Adjacency[List[0].triangle].add(List[1].triangle);
        Adjacency[List[1].triangle].add(List[0].triangle);
    }

    for (const Vertex of Used)
    {
        const Incident = surface.triangles.map((t, i) => t.indices.includes(Vertex) ? i : -1).filter((i) => i >= 0);
        const Seen = new Set<number>();
        const Queue = [ Incident[0] ];
        while (Queue.length)
        {
            const Index = Queue.pop()!;
            if (Seen.has(Index))
            {
                continue;
            }

            Seen.add(Index);
            Queue.push(...[ ...Adjacency[Index] ].filter((i) => Incident.includes(i) && !Seen.has(i)));
        }

        if (Seen.size !== Incident.length)
        {
            throw new SolidError("Nonmanifold vertex fan", Incident.map((i) => Source(surface.triangles[i])));
        }
    }

    for (let i = 0; i < surface.triangles.length; i++)
    {
        for (let j = i + 1; j < surface.triangles.length; j++)
        {
            if (intersects(surface, surface.triangles[i], surface.triangles[j], epsilon))
            {
                throw new SolidError("Self-intersection or intersecting/ambiguous shells",
                    [ Source(surface.triangles[i]), Source(surface.triangles[j]) ]);
            }
        }
    }

    const Visited = new Set<number>();
    const Shells: Array<Array<M.Triangle>> = [];
    for (let i = 0; i < surface.triangles.length; i++)
    {
        if (Visited.has(i))
        {
            continue;
        }

        const Shell: Array<M.Triangle> = [];
        const Queue = [ i ];
        while (Queue.length)
        {
            const Index = Queue.pop()!;
            if (Visited.has(Index))
            {
                continue;
            }

            Visited.add(Index);
            Shell.push(surface.triangles[Index]);
            Queue.push(...[ ...Adjacency[Index] ].filter((j) => !Visited.has(j)));
        }

        Shells.push(Shell);
    }

    for (const Shell of Shells)
    {
        const P = surface.vertices[Shell[0].indices[0]];
        const Depth = Shells.filter((other) => other !== Shell && Math.abs(winding(surface, P, other)) > 0.5).length;
        const Reference = P;
        const Volume = Shell.reduce((sum, t) =>
        {
            const [ A, B, C ] = PointsOf(surface, t).map((v) => Sub(v, Reference));
            return sum + Dot(A, Cross(B, C)) / 6;
        }, 0);
        if (Math.abs(Volume) <= epsilon ** 3 || Math.sign(Volume) !== (Depth % 2 ? -1 : 1))
        {
            throw new SolidError("Shell winding must alternate outward solids and inward cavities", [ Source(Shell[0]) ]);
        }
    }
};

/**
 * Clips a closed convex polyhedron by one plane, retaining the negative half-space.
 *
 * @category Build
 * @since 1.0.0
 */
const clip = (faces: Array<Face>, plane: Plane, epsilon: number): Array<Face> =>
{
    const Output: Array<Face> = [];
    const Cap: Array<V.Coordinates> = [];
    for (const Face of faces)
    {
        const Points: Array<V.Coordinates> = [];
        Face.points.forEach((a, i) =>
        {
            const B = Face.points[(i + 1) % Face.points.length];
            const Da = Dot(a, plane.normal) + plane.offset;
            const Db = Dot(B, plane.normal) + plane.offset;
            if (Da <= epsilon)
            {
                Points.push(a);
            }

            if ((Da < -epsilon && Db > epsilon) || (Da > epsilon && Db < -epsilon))
            {
                const Point = Add(a, Mul(Sub(B, a), Da / (Da - Db)));
                Points.push(Point);
                Cap.push(Point);
            }
            else if (Math.abs(Da) <= epsilon)
            {
                Cap.push(a);
            }
        });
        const Clean = Points.filter((p, i) => Length(Sub(p, Points[(i + 1) % Points.length])) > epsilon);
        if (Clean.length >= 3)
        {
            Output.push({ points: Clean });
        }
    }

    const Unique = Cap.filter((p, i) => !Cap.slice(0, i).some((q) => Length(Sub(p, q)) <= epsilon));
    if (Unique.length >= 3)
    {
        const Center = Mean(Unique);
        const U = Mul(Sub(Unique[0], Center), 1 / Length(Sub(Unique[0], Center)));
        const V = Cross(plane.normal, U);
        Unique.sort((a, b) => Math.atan2(Dot(Sub(a, Center), V), Dot(Sub(a, Center), U)) -
            Math.atan2(Dot(Sub(b, Center), V), Dot(Sub(b, Center), U)));
        Output.push({ points: Unique });
    }

    return Output;
};

/**
 * Partitions a mesh or cuboid union into disjoint convex cells using all boundary
 * planes. Cell interiors are classified against the original solid, never its hull.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
const partitionSolid = (surfaces: ReadonlyArray<Surface>, mesh: boolean): Partition =>
{
    const Vertices = surfaces.flatMap((s) => [ ...s.vertices ]);
    if (!Vertices.length || Vertices.length > Limits.triangles * 3 || Vertices.some((p) =>
        ![ p.x, p.y, p.z ].every((n) => Number.isFinite(n) && Math.abs(n) <= Limits.coordinate)))
    {
        throw new SolidError("Invalid/over-budget finite source coordinates");
    }

    const Min = { x: Math.min(...Vertices.map((p) => p.x)),
        y: Math.min(...Vertices.map((p) => p.y)),
        z: Math.min(...Vertices.map((p) => p.z)) };
    const Max = { x: Math.max(...Vertices.map((p) => p.x)),
        y: Math.max(...Vertices.map((p) => p.y)),
        z: Math.max(...Vertices.map((p) => p.z)) };
    const Extent = Math.max(Max.x - Min.x, Max.y - Min.y, Max.z - Min.z);
    const Epsilon = Math.max(1, Extent) * Limits.relativeTolerance;
    if (Extent > Limits.extent || [ Max.x - Min.x, Max.y - Min.y, Max.z - Min.z ].some((n) => n <= Epsilon * 8))
    {
        throw new SolidError("Degenerate solid or extent exceeds compilation budget");
    }

    const TriangleCount = surfaces.reduce((n, s) => n + s.triangles.length, 0);
    if (TriangleCount > Limits.triangles)
    {
        throw new SolidError("Source triangle budget exceeded");
    }

    if (mesh)
    {
        validate(surfaces[0], Epsilon);
    }

    const Planes: Array<Plane> = [];
    for (const S of surfaces)
    {
        for (const T of S.triangles)
        {
            const Points = PointsOf(S, T);
            let normal = Mul(NormalOf(Points), 1 / Length(NormalOf(Points)));
            let offset = -Dot(normal, Points[0]);
            const First = [ normal.x, normal.y, normal.z ].find((n) => Math.abs(n) > 1e-12)!;
            if (First < 0)
            {
                normal = Mul(normal, -1);
                offset = -offset;
            }

            if (!Planes.some((p) => Length(Sub(p.normal, normal)) <= 1e-10 && Math.abs(p.offset - offset) <= Epsilon))
            {
                Planes.push({ normal,
                    offset });
            }
        }
    }

    if (Planes.length > Limits.planes)
    {
        throw new SolidError(`Boundary plane budget exceeds ${Limits.planes}`);
    }

    const Box = O.getOrThrow(H.fromAABB({ min: Min,
        max: Max }));
    let cells: Array<Array<Face>> = [ Box.faces.map((f) => ({ points: f.map((i) => Box.vertices[i]) })) ];
    let work = 0;
    for (const Plane of Planes)
    {
        const Next: Array<Array<Face>> = [];
        for (const Cell of cells)
        {
            const Distances = Cell.flatMap((f) => f.points.map((p) => Dot(p, Plane.normal) + Plane.offset));
            work += Distances.length;
            if (work > Limits.work)
            {
                throw new SolidError("Plane clipping work budget exceeded; simplify source");
            }

            if (Math.min(...Distances) < -Epsilon && Math.max(...Distances) > Epsilon)
            {
                Next.push(clip(Cell, Plane, Epsilon), clip(Cell, { normal: Mul(Plane.normal, -1),
                    offset: -Plane.offset }, Epsilon));
            }
            else
            {
                Next.push(Cell);
            }

            if (Next.length > Limits.cells)
            {
                throw new SolidError(`Convex partition exceeds ${Limits.cells} cells; simplify source`);
            }
        }

        cells = Next;
    }

    const Occupied = (p: V.Coordinates): boolean => mesh ? winding(surfaces[0], p) > 0.5 :
        surfaces.some((s) => winding(s, p) > 0.5);
    const Result: Array<C.CollisionShape.Cell> = [];
    for (const Cell of cells)
    {
        const Points = Cell.flatMap((f) => f.points);
        if (Points.length > Limits.faceVertices * 8 || Cell.some((f) => f.points.length > Limits.faceVertices))
        {
            throw new SolidError("Partition vertex budget exceeded");
        }

        if (!Occupied(Mean(Points)))
        {
            continue;
        }

        const Unique = Points.filter((p, i) => !Points.slice(0, i).some((q) => Length(Sub(p, q)) <= Epsilon));
        if (Unique.length > Limits.cellVertices)
        {
            throw new SolidError("Convex-cell vertex budget exceeds 256");
        }

        const HullOption = H.ConvexHull(Unique);
        if (O.isNone(HullOption))
        {
            throw new SolidError("Convex partition failed; no hull substitution permitted");
        }

        const Hull = HullOption.value;
        const InternalFaces = Hull.faces.map((face) =>
        {
            const Polygon = face.map((i) => Hull.vertices[i]);
            const N = NormalOf(Polygon);
            return Occupied(Add(Mean(Polygon), Mul(N, Epsilon * 4 / Length(N))));
        });
        const Sources = surfaces.flatMap((s) => s.triangles.filter((t) =>
        {
            const P = PointsOf(s, t);
            const N = NormalOf(P);
            return Hull.faces.some((f) =>
            {
                const Center = Mean(f.map((i) => Hull.vertices[i]));
                return Math.abs(Dot(N, Sub(Center, P[0]))) <= Epsilon * Length(N) && inTriangle(Center, P, Epsilon);
            });
        }).map(Source));
        Result.push(Object.freeze({ hull: Hull,
            internalFaces: Object.freeze(InternalFaces),
            sources: Object.freeze([ ...new Set(Sources) ].sort()) }));
    }

    if (!Result.length)
    {
        throw new SolidError("No positive-volume source cells");
    }

    return Object.freeze({ cells: Object.freeze(Result),
        tolerance: Epsilon });
};

/**
 * Integrates exact polynomial moments over disjoint convex-cell tetrahedra.
 * COM overrides use the parallel-axis theorem, independent of collision selection.
 *
 * @throws { SolidError } Invalid input, unsupported complexity or publication conflict.
 *
 * @category Build
 * @since 1.0.0
 */
export const massProperties = (cells: ReadonlyArray<C.CollisionShape.Cell>, mass: number,
    centerOfMass?: V.Coordinates): M.MassProperties =>
{
    // Recognize an exact validated axis-aligned cuboid, rather than introducing
    // tiny spurious COM offsets and tensor couplings through tetrahedron sums.
    // This is a closed-form integration of the source solid, not a diagonal
    // approximation: displaced COMs retain the complete parallel-axis tensor.
    const Hull = cells.length === 1 ? cells[0].hull : undefined;
    if (Hull?.vertices.length === 8 && H.isValid(Hull))
    {
        const Box = O.getOrThrow(H.bounds(Hull));
        if (Hull.vertices.every((point) => (point.x === Box.min.x || point.x === Box.max.x) &&
            (point.y === Box.min.y || point.y === Box.max.y) && (point.z === Box.min.z || point.z === Box.max.z)))
        {
            const X = Box.max.x - Box.min.x;
            const Y = Box.max.y - Box.min.y;
            const Z = Box.max.z - Box.min.z;
            const Centroid = V.Vector3Unsafe((Box.min.x + Box.max.x) / 2, (Box.min.y + Box.max.y) / 2, (Box.min.z + Box.max.z) / 2);
            const Com = centerOfMass ?? Centroid;
            const Offset = [ Centroid.x - Com.x, Centroid.y - Com.y, Centroid.z - Com.z ];
            const Diagonal = [ mass * (Y * Y + Z * Z) / 12, mass * (X * X + Z * Z) / 12, mass * (X * X + Y * Y) / 12 ];
            const Square = Offset.reduce((sum, value) => sum + value * value, 0);
            const Inertia = Array.from({ length: 9 }, (_, index) =>
            {
                const Row = Math.floor(index / 3);
                const Column = index % 3;
                return (Row === Column ? Diagonal[Row] + mass * Square : 0) - mass * Offset[Row] * Offset[Column];
            });
            const Volume = X * Y * Z;
            if (!(Volume > 0) || !(mass > 0) || ![ Volume, mass, Com.x, Com.y, Com.z, ...Inertia ].every(Number.isFinite))
            {throw new SolidError("Nonpositive/nonfinite mass, volume or COM");}

            return Object.freeze({ volume: Volume,
                mass,
                centroid: Centroid,
                centerOfMass: V.Vector3Unsafe(Com.x, Com.y, Com.z),
                inertia: Object.freeze(Inertia) as unknown as M.Inertia });
        }
    }

    let volume = 0;
    const First = [ 0, 0, 0 ];
    const Second = Array<number>(9).fill(0);
    const Reference = cells[0].hull.vertices[0];
    for (const { hull: Hull } of cells)
    {
        for (const Face of Hull.faces)
        {
            for (let i = 1; i < Face.length - 1; i++)
            {
                const P = [ Face[0], Face[i], Face[i + 1] ].map((j) => Sub(Hull.vertices[j], Reference));
                const V = Dot(P[0], Cross(P[1], P[2])) / 6;
                const Sums = [ P.reduce((n, q) => n + q.x, 0), P.reduce((n, q) => n + q.y, 0), P.reduce((n, q) => n + q.z, 0) ];
                const Components = P.map((q) => [ q.x, q.y, q.z ]);
                volume += V;
                for (let a = 0; a < 3; a++)
                {
                    First[a] += V * Sums[a] / 4;
                    for (let b = 0; b < 3; b++)
                    {
                        Second[a * 3 + b] += V * (Sums[a] * Sums[b] + Components.reduce((n, q) => n + q[a] * q[b], 0)) / 20;
                    }
                }
            }
        }
    }

    if (!(volume > 0) || !(mass > 0) || !Number.isFinite(mass))
    {
        throw new SolidError("Nonpositive/nonfinite mass or volume");
    }

    const Centroid = V.Vector3Unsafe(Reference.x + First[0] / volume, Reference.y + First[1] / volume, Reference.z + First[2] / volume);
    const Com = centerOfMass ?? Centroid;
    if (![ Com.x, Com.y, Com.z ].every(Number.isFinite))
    {
        throw new SolidError("Invalid COM override");
    }

    const C = [ Com.x - Reference.x, Com.y - Reference.y, Com.z - Reference.z ];
    const Moments = Second.map((value, index) =>
    {
        const A = Math.floor(index / 3);
        const B = index % 3;
        return (value - C[A] * First[B] - C[B] * First[A] + C[A] * C[B] * volume) * mass / volume;
    });
    const Trace = Moments[0] + Moments[4] + Moments[8];
    const Inertia = Moments.map((v, i) => (i % 4 === 0 ? Trace : 0) - v);
    if (![ volume, ...Inertia ].every(Number.isFinite))
    {
        throw new SolidError("Mass-property integration overflow");
    }

    return Object.freeze({ volume,
        mass,
        centroid: Centroid,
        centerOfMass: V.Vector3Unsafe(Com.x, Com.y, Com.z),
        inertia: Object.freeze(Inertia) as unknown as M.Inertia });
};

/**
 * Preserves source object/face diagnostics for every complexity or decomposition failure.
 *
 * @throws { SolidError } Invalid topology or exhausted geometric budgets.
 *
 * @category Build
 * @since 1.0.0
 */
export const partition = (surfaces: ReadonlyArray<Surface>, mesh: boolean): Partition =>
{
    try
    {
        return partitionSolid(surfaces, mesh);
    }
    catch (error)
    {
        if (error instanceof SolidError && !error.sources.length)
        {
            throw new SolidError(error.message, surfaces.flatMap((s) => s.triangles.slice(0, 4).map(Source)));
        }

        throw error;
    }
};
