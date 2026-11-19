/**
 * Support-mapped GJK distance, EPA penetration and analytic round primitives.
 *
 * @module bedform/Internal/CollisionConvex
 *
 * @file      CollisionConvex.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Simplex matrices preserve geometric ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as V from "../Vector3.js";
import * as T from "../Transform.js";
import * as O from "@bedform/effect/Option";
import * as G from "./CollisionGeometry.js";
import * as M from "./CollisionMath.js";

/**
 * One Minkowski vertex and its original support witnesses.
 *
 * @category Types
 * @since 1.0.0
 */
interface Vertex
{
    readonly p: V.Vector3;
    readonly a: V.Vector3;
    readonly b: V.Vector3;
}

/**
 * Closest simplex point with barycentric witness reconstruction.
 *
 * @category Types
 * @since 1.0.0
 */
interface Simplex
{
    readonly vertices: ReadonlyArray<Vertex>;
    readonly weights: ReadonlyArray<number>;
    readonly point: V.Vector3;
}

/**
 * Convex distance witnesses. Overlap has zero distance and is resolved separately by EPA.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Distance
{
    readonly distance: number;
    readonly normal: V.Vector3;
    readonly pointA: V.Vector3;
    readonly pointB: V.Vector3;
    readonly simplex: ReadonlyArray<Vertex>;
}

/**
 * Penetration axis and two surface witnesses; normal points from A toward B.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Penetration
{
    readonly certified?: boolean;
    readonly normal: V.Vector3;
    readonly depth: number;
    readonly pointA: V.Vector3;
    readonly pointB: V.Vector3;
}

/**
 * Exact separating-axis penetration for bounded polyhedral pairs. Face normals
 * and edge cross products describe the actual cells, including their cavities
 * through the existing partition dispatcher. Distance/CCD still use GJK witnesses.
 * Negative depth certifies separation; no bounding proxy is introduced.
 *
 * @category Internal
 * @since 1.0.0
 */
export const polyhedral = (a: G.Placed, b: G.Placed): Penetration | undefined =>
{
    if (a.leaf.kind === "box" && !a.leaf.hull && b.leaf.kind === "box" && !b.leaf.hull)
    {
        const A = G.frame(a.pose);
        const B = G.frame(b.pose);
        const AX = [ A.x, A.y, A.z ];
        const BX = [ B.x, B.y, B.z ];
        const AH = [ a.leaf.half.x, a.leaf.half.y, a.leaf.half.z ];
        const BH = [ b.leaf.half.x, b.leaf.half.y, b.leaf.half.z ];
        const Dx = b.pose.position.x - a.pose.position.x;
        const Dy = b.pose.position.y - a.pose.position.y;
        const Dz = b.pose.position.z - a.pose.position.z;
        let depth = Infinity;
        let nx = 1;
        let ny = 0;
        let nz = 0;
        const Axis = (x: number, y: number, z: number): void =>
        {
            const Length = Math.hypot(x, y, z);
            if (Length < 1e-14)
            {return;}

            x /= Length;
            y /= Length;
            z /= Length;
            let radius = 0;
            for (let index = 0; index < 3; index++)
            {
                radius += AH[index] * Math.abs(AX[index].x * x + AX[index].y * y + AX[index].z * z) +
                    BH[index] * Math.abs(BX[index].x * x + BX[index].y * y + BX[index].z * z);
            }

            const Center = Dx * x + Dy * y + Dz * z;
            const Overlap = radius - Math.abs(Center);
            if (Overlap < depth)
            {
                depth = Overlap;
                const Sign = Center < 0 ? -1 : 1;
                nx = x * Sign;
                ny = y * Sign;
                nz = z * Sign;
            }
        };

        for (const Direction of [ ...AX, ...BX ])
        {Axis(-Direction.x, -Direction.y, -Direction.z);}

        for (const Left of AX)
        {
            for (const Right of BX)
            {Axis(Left.y * Right.z - Left.z * Right.y, Left.z * Right.x - Left.x * Right.z, Left.x * Right.y - Left.y * Right.x);}
        }

        const Normal = V.Vector3Unsafe(nx, ny, nz);
        return { certified: true,
            depth,
            normal: Normal,
            pointA: G.support(a, Normal),
            pointB: G.support(b, V.Vector3Unsafe(-nx, -ny, -nz)) };
    }

    if (!(a.leaf.hull || a.leaf.kind === "box") || !(b.leaf.hull || b.leaf.kind === "box"))
    {
        return undefined;
    }

    const A = G.faces(a);
    const B = G.faces(b);
    if (A.length > 16 || B.length > 16)
    {
        return undefined;
    }

    const Unique = (directions: ReadonlyArray<V.Vector3>): Array<V.Vector3> =>
    {
        const Result: Array<V.Vector3> = [];
        for (const Direction of directions)
        {
            const Length = M.length(Direction);
            if (Length < 1e-14)
            {
                continue;
            }

            const Unit = M.scale(Direction, 1 / Length);
            if (!Result.some((value) => M.length(M.sub(value, Unit)) < 1e-12 || M.length(M.add(value, Unit)) < 1e-12))
            {
                Result.push(Unit);
            }
        }

        return Result;
    };

    const Edges = (faces: ReadonlyArray<G.Face>): Array<V.Vector3> => Unique(faces.flatMap((face) => face.points.map((point, index) => M.sub(face.points[(index + 1) % face.points.length], point))));
    const EdgeA = Edges(A);
    const EdgeB = Edges(B);
    if (EdgeA.length > 16 || EdgeB.length > 16)
    {
        return undefined;
    }

    const Axes = Unique([ ...A.map((face) => face.normal), ...B.map((face) => face.normal),
        ...EdgeA.flatMap((edge) => EdgeB.map((other) => M.cross(edge, other))) ]);
    const PointsA = A.flatMap((face) => face.points);
    const PointsB = B.flatMap((face) => face.points);
    let depth = Infinity;
    let normal = V.UnitX;
    for (const Axis of Axes)
    {
        let minA = Infinity;
        let maxA = -Infinity;
        let minB = Infinity;
        let maxB = -Infinity;
        // Translate before projection to retain small separations at large world coordinates.
        const Origin = a.pose.position;
        for (const Point of PointsA)
        {
            const Dot = (Point.x - Origin.x) * Axis.x + (Point.y - Origin.y) * Axis.y + (Point.z - Origin.z) * Axis.z;
            minA = Math.min(minA, Dot);
            maxA = Math.max(maxA, Dot);
        }

        for (const Point of PointsB)
        {
            const Dot = (Point.x - Origin.x) * Axis.x + (Point.y - Origin.y) * Axis.y + (Point.z - Origin.z) * Axis.z;
            minB = Math.min(minB, Dot);
            maxB = Math.max(maxB, Dot);
        }

        const Positive = maxA - minB;
        const Negative = maxB - minA;
        const Depth = Math.min(Positive, Negative);
        if (Depth < depth)
        {
            depth = Depth;
            normal = Positive <= Negative ? Axis : M.scale(Axis, -1);
        }
    }

    return { certified: true,
        depth,
        normal,
        pointA: G.support(a, normal),
        pointB: G.support(b, M.scale(normal, -1)) };
};

/**
 * Outward EPA facet enclosing the Minkowski origin.
 *
 * @category Types
 * @since 1.0.0
 */
interface Face
{
    readonly indices: readonly [
        number,
        number,
        number
    ];
    readonly normal: V.Vector3;
    readonly distance: number;
}

/**
 * Support of A minus B with source witnesses.
 *
 * @category Internal
 * @since 1.0.0
 */
const support = (a: G.Placed, b: G.Placed, direction: V.Coordinates): Vertex =>
{
    const A = G.support(a, direction);
    const B = G.support(b, M.scale(direction, -1));
    return { p: M.sub(A, B),
        a: A,
        b: B };
};

/**
 * Exhaustively solves all simplex subfeatures (at most fifteen). Singular affine
 * subsets are skipped; an interior tetrahedron has four positive weights.
 *
 * @throws { G.Fault } The simplex exceeds its feature budget.
 *
 * @category Internal
 * @since 1.0.0
 */
const closest = (vertices: ReadonlyArray<Vertex>): Simplex =>
{
    if (vertices.length > 5)
    {
        throw new G.Fault("gjk", "ComplexityLimit", "Simplex feature budget exceeded");
    }

    let best: Simplex = { vertices: [ vertices[0] ],
        weights: [ 1 ],
        point: vertices[0].p };
    for (let mask = 1; mask < (1 << vertices.length); mask++)
    {
        const Selected = vertices.filter((_, i) => mask & (1 << i));
        const Origin = Selected[0].p;
        const Edges = Selected.slice(1).map((v) => M.sub(v.p, Origin));
        const Scale = Math.max(1e-150, ...Selected.map((v) => M.length(v.p)));
        const Normalized = Edges.map((e) => M.scale(e, 1 / Scale));
        const Solution = M.solve(Normalized.map((e) => Normalized.map((f) => M.dot(e, f))), Normalized.map((e) => -M.dot(e, M.scale(Origin, 1 / Scale))));
        if (Solution.length !== Edges.length)
        {
            continue;
        }

        const Weights = [ 1 - Solution.reduce((s, n) => s + n, 0), ...Solution ];
        if (Weights.some((w) => w < -1e-12))
        {
            continue;
        }

        const Clamped = Weights.map((w) => Math.max(0, w));
        const Sum = Clamped.reduce((s, n) => s + n, 0);
        const Unit = Clamped.map((w) => w / Sum);
        const Point = M.blend(Selected.map((v) => v.p), Unit);
        if (M.length(Point) < M.length(best.point))
        {
            best = { vertices: Selected,
                weights: Unit,
                point: Point };
        }
    }

    return best;
};

/**
 * Finds closest witnesses using a bounded distance-form GJK iteration. A repeated
 * support without a certified gap bound reports failure instead of a false miss.
 *
 * @throws { G.Fault } The configured GJK iteration budget is exhausted.
 *
 * @category Internal
 * @since 1.0.0
 */
export const distance = (a: G.Placed, b: G.Placed, tolerance: number, iterations: number): Distance =>
{
    let simplex = closest([ support(a, b, M.unit(M.sub(b.pose.position, a.pose.position))) ]);
    for (let iteration = 0; iteration < iterations; iteration++)
    {
        const Length = M.length(simplex.point);
        const Direction = Length > tolerance ? M.scale(simplex.point, -1 / Length) : V.UnitX;
        const Next = support(a, b, Direction);
        if (Length <= tolerance || Length + M.dot(Next.p, Direction) <= tolerance)
        {
            const PointA = M.blend(simplex.vertices.map((v) => v.a), simplex.weights);
            const PointB = M.blend(simplex.vertices.map((v) => v.b), simplex.weights);
            return { distance: Length <= tolerance ? 0 : Length,
                normal: M.unit(M.sub(PointB, PointA)),
                pointA: PointA,
                pointB: PointB,
                simplex: simplex.vertices };
        }

        if (simplex.vertices.some((v) => M.length(M.sub(v.p, Next.p)) <= tolerance * 0.01))
        {
            throw new G.Fault("gjk", "NonConvergence", "Repeated support without a certified GJK gap bound");
        }

        const Active = simplex.vertices.filter((_, i) => simplex.weights[i] > 1e-13);
        simplex = closest([ ...Active, Next ]);
    }

    throw new G.Fault("gjk", "NonConvergence", `GJK exceeded ${iterations} iterations`);
};

/**
 * Computes closest points on two finite line segments, including point degeneracies.
 *
 * @category Internal
 * @since 1.0.0
 */
const segments = (a0: V.Vector3, a1: V.Vector3, b0: V.Vector3, b1: V.Vector3): readonly [
    V.Vector3,
    V.Vector3
] =>
{
    const U = M.sub(a1, a0);
    const Vv = M.sub(b1, b0);
    const W = M.sub(a0, b0);
    const A = M.dot(U, U);
    const B = M.dot(U, Vv);
    const C = M.dot(Vv, Vv);
    const D = M.dot(U, W);
    const E = M.dot(Vv, W);
    const Denominator = A * C - B * B;
    let s = A === 0 ? 0 : C === 0 ? Math.max(0, Math.min(1, -D / A)) : Denominator > 1e-15 * A * C ? Math.max(0, Math.min(1, (B * E - C * D) / Denominator)) : 0;
    let t = C === 0 ? 0 : (B * s + E) / C;
    if (t < 0)
    {
        t = 0;
        s = A === 0 ? 0 : Math.max(0, Math.min(1, -D / A));
    }

    if (t > 1)
    {
        t = 1;
        s = A === 0 ? 0 : Math.max(0, Math.min(1, (B - D) / A));
    }

    return [ M.add(a0, M.scale(U, s)), M.add(b0, M.scale(Vv, t)) ];
};

/**
 * Exact sphere/capsule distance and penetration from segment closest points.
 *
 * @category Internal
 * @since 1.0.0
 */
export const round = (a: G.Placed, b: G.Placed): Penetration | undefined =>
{
    if (![ "sphere", "capsule" ].includes(a.leaf.kind) || ![ "sphere", "capsule" ].includes(b.leaf.kind))
    {
        return undefined;
    }

    const Segment = (body: G.Placed): readonly [
        V.Vector3,
        V.Vector3
    ] =>
    {
        const Half = body.leaf.kind === "capsule" ? body.leaf.half.y : 0;
        return [ O.getOrThrow(T.transformPoint(body.pose, V.Vector3Unsafe(0, -Half, 0))),
            O.getOrThrow(T.transformPoint(body.pose, V.Vector3Unsafe(0, Half, 0))) ];
    };

    const [ A0, A1 ] = Segment(a);
    const [ B0, B1 ] = Segment(b);
    const [ A, B ] = segments(A0, A1, B0, B1);
    let normal = M.unit(M.sub(B, A));
    if (M.length(M.sub(B, A)) < 1e-14)
    {
        const U = M.sub(A1, A0);
        const W = M.sub(B1, B0);
        const Cross = M.cross(U, W);
        if (M.length(Cross) > 1e-14)
        {
            normal = M.unit(Cross);
        }
        else
        {
            const Axis = M.length(U) > 0 ? U : W;
            const Basis = Math.abs(Axis.x) <= Math.abs(Axis.y) && Math.abs(Axis.x) <= Math.abs(Axis.z) ? V.UnitX :
                Math.abs(Axis.y) <= Math.abs(Axis.z) ? V.UnitY : V.UnitZ;
            normal = M.length(Axis) > 0 ? M.unit(M.cross(Axis, Basis)) : V.UnitX;
        }
    }

    const Normal = normal;
    return { normal: Normal,
        depth: a.leaf.half.x + b.leaf.half.x - M.length(M.sub(B, A)),
        pointA: M.add(A, M.scale(Normal, a.leaf.half.x)),
        pointB: M.sub(B, M.scale(Normal, b.leaf.half.x)) };
};

/**
 * Builds an outward EPA triangle, rejecting zero-area facets.
 *
 * @category Internal
 * @since 1.0.0
 */
const face = (vertices: ReadonlyArray<Vertex>, a: number, b: number, c: number): Face | undefined =>
{
    const Cross = M.cross(M.sub(vertices[b].p, vertices[a].p), M.sub(vertices[c].p, vertices[a].p));
    if (M.length(Cross) === 0)
    {
        return undefined;
    }

    let normal = M.unit(Cross);
    let indices: [
        number,
        number,
        number
    ] = [ a, b, c ];
    let distance = M.dot(normal, vertices[a].p);
    if (distance < 0)
    {
        normal = M.scale(normal, -1);
        distance = -distance;
        indices = [ a, c, b ];
    }

    return { normal,
        distance,
        indices };
};

/**
 * Computes penetration with EPA. A deterministic sampled support seed expands
 * lower-dimensional GJK simplices; it is used only to enclose the Minkowski origin.
 * The final support gap bounds error on the actual analytic shapes.
 *
 * @throws { G.Fault } No interior seed or convergent bounded EPA result is available.
 *
 * @category Internal
 * @since 1.0.0
 */
export const penetration = (a: G.Placed, b: G.Placed, initial: Distance, tolerance: number, iterations: number): Penetration =>
{
    const Analytic = round(a, b);
    if (Analytic)
    {
        return Analytic;
    }

    const BoundaryNormals = [ initial.normal, ...G.faces(a).map((f) => f.normal), ...G.faces(b).map((f) => M.scale(f.normal, -1)) ];
    if (initial.simplex.length >= 3)
    {
        const Normal = M.unit(M.cross(M.sub(initial.simplex[1].p, initial.simplex[0].p), M.sub(initial.simplex[2].p, initial.simplex[0].p)));
        BoundaryNormals.push(Normal, M.scale(Normal, -1));
    }

    for (const Normal of BoundaryNormals)
    {
        const A = G.support(a, Normal);
        const B = G.support(b, M.scale(Normal, -1));
        const Depth = M.dot(M.sub(A, B), Normal);
        if (Depth <= tolerance * 2)
        {
            return { normal: Normal,
                depth: Math.max(0, Depth),
                pointA: initial.pointA,
                pointB: initial.pointB };
        }
    }

    const Candidates = [ ...initial.simplex ];
    for (let x = -1; x <= 1; x++)
    {
        for (let y = -1; y <= 1; y++)
        {
            for (let z = -1; z <= 1; z++)
            {
                if (x === 0 && y === 0 && z === 0)
                {
                    continue;
                }

                const Next = support(a, b, M.unit(V.Vector3Unsafe(x, y, z)));
                if (!Candidates.some((v) => M.length(M.sub(v.p, Next.p)) <= tolerance * 0.01))
                {
                    Candidates.push(Next);
                }
            }
        }
    }

    let vertices: Array<Vertex> = [];
    seed: for (let i = 0; i < Candidates.length; i++)
    {
        for (let j = i + 1; j < Candidates.length; j++)
        {
            for (let k = j + 1; k < Candidates.length; k++)
            {
                for (let l = k + 1; l < Candidates.length; l++)
                {
                    const Subset = [ Candidates[i], Candidates[j], Candidates[k], Candidates[l] ];
                    const Origin = Subset[0].p;
                    const Edges = Subset.slice(1).map((v) => M.sub(v.p, Origin));
                    const Scale = Math.max(...Subset.map((v) => M.length(v.p)), 1e-100);
                    const Normalized = Edges.map((e) => M.scale(e, 1 / Scale));
                    const Right = M.scale(Origin, -1 / Scale);
                    const Solution = M.solve([ [ Normalized[0].x, Normalized[1].x, Normalized[2].x ],
                        [ Normalized[0].y, Normalized[1].y, Normalized[2].y ], [ Normalized[0].z, Normalized[1].z, Normalized[2].z ] ], [ Right.x, Right.y, Right.z ]);
                    if (Solution.length === 3 && Solution.every((w) => w > 1e-8) && Solution.reduce((s, w) => s + w, 0) < 1 - 1e-8)
                    {
                        vertices = Subset;
                        break seed;
                    }
                }
            }
        }
    }

    if (!vertices.length)
    {
        // Boundary-only intersection: GJK witnesses provide a zero-depth contact.
        const Normal = M.unit(M.sub(b.pose.position, a.pose.position));
        const A = G.support(a, Normal);
        const B = G.support(b, M.scale(Normal, -1));
        if (M.dot(M.sub(A, B), Normal) <= tolerance * 4)
        {
            return { normal: Normal,
                depth: 0,
                pointA: initial.pointA,
                pointB: initial.pointB };
        }

        throw new G.Fault("epa", "NonConvergence", "Cannot construct an interior EPA seed");
    }

    let faces = [ [ 0, 1, 2 ], [ 0, 3, 1 ], [ 0, 2, 3 ], [ 1, 3, 2 ] ].map((f) => face(vertices, f[0], f[1], f[2])!);
    for (let iteration = 0; iteration < iterations; iteration++)
    {
        faces.sort((a, b) => a.distance - b.distance || a.indices[0] - b.indices[0] || a.indices[1] - b.indices[1] || a.indices[2] - b.indices[2]);
        const Best = faces[0];
        const Next = support(a, b, Best.normal);
        if (M.dot(Next.p, Best.normal) - Best.distance <= tolerance)
        {
            const Triangle = Best.indices.map((i) => vertices[i]);
            const Witness = closest(Triangle);
            return { normal: Best.normal,
                depth: Best.distance,
                pointA: M.blend(Witness.vertices.map((v) => v.a), Witness.weights),
                pointB: M.blend(Witness.vertices.map((v) => v.b), Witness.weights) };
        }

        const Visible = faces.filter((f) => M.dot(f.normal, M.sub(Next.p, vertices[f.indices[0]].p)) > tolerance * 0.01);
        if (!Visible.length)
        {
            throw new G.Fault("epa", "NonConvergence", "EPA support did not expose a valid horizon");
        }

        const Edges: Array<readonly [
            number,
            number
        ]> = [];
        for (const F of Visible)
        {
            for (let i = 0; i < 3; i++)
            {
                const A = F.indices[i];
                const B = F.indices[(i + 1) % 3];
                const Reverse = Edges.findIndex((e) => e[0] === B && e[1] === A);
                if (Reverse >= 0)
                {
                    Edges.splice(Reverse, 1);
                }
                else
                {
                    Edges.push([ A, B ]);
                }
            }
        }

        faces = faces.filter((f) => !Visible.includes(f));
        const Index = vertices.length;
        vertices.push(Next);
        for (const [ A, B ] of Edges)
        {
            const F = face(vertices, A, B, Index);
            if (F)
            {
                faces.push(F);
            }
        }

        if (faces.length > 1_024)
        {
            throw new G.Fault("epa", "ComplexityLimit", "EPA face budget exceeds 1024");
        }
    }

    throw new G.Fault("epa", "NonConvergence", `EPA exceeded ${iterations} iterations`);
};
