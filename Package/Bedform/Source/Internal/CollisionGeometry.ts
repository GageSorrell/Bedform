/**
 * Validated convex leaves, deterministic model BVHs and support maps.
 *
 * @module bedform/Internal/CollisionGeometry
 *
 * @file      CollisionGeometry.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Geometric tuples and traversal buffers retain contextual inference. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import * as B from "../AABB.js";
import * as C from "../CollisionShape.js";
import * as H from "../ConvexHull.js";
import * as O from "@bedform/effect/Option";
import * as Q from "../Quat.js";
import * as T from "../Transform.js";
import * as V from "../Vector3.js";
import * as M from "./CollisionMath.js";

/**
 * Bounded collision failure propagated as a typed public Result diagnostic.
 *
 * @category Internal
 * @since 1.0.0
 */
export class Fault extends Error
{
    constructor(readonly stage: "validation" | "gjk" | "epa" | "manifold" | "bvh" | "ccd", readonly code: "InvalidInput" | "ComplexityLimit" | "NonConvergence", message: string)
    {
        super(message);
    }
}

/**
 * A model-local analytic primitive or exact convex partition cell.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Leaf
{
    readonly path: string;
    readonly kind: C.CollisionShape.Primitive["kind"] | "hull";
    readonly pose: T.Transform;
    readonly half: V.Vector3;
    readonly hull?: H.ConvexHull;
    readonly internal: ReadonlyArray<boolean>;
    readonly sources: ReadonlyArray<string>;
    readonly bounds: B.AABB;
}

/**
 * Immutable balanced model-local bounding-volume node.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Node
{
    readonly bounds: B.AABB;
    readonly left?: Node;
    readonly right?: Node;
    readonly leaf?: Leaf;
}

/**
 * Owned prepared geometry; no caller arrays or mutable input objects are retained.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Geometry
{
    readonly leaves: ReadonlyArray<Leaf>;
    readonly root: Node;
    readonly radius: number;
}

/**
 * A leaf placed at its authoritative world transform, with lazy polygon data.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Placed
{
    readonly leaf: Leaf;
    readonly pose: T.Transform;
}

/**
 * An oriented polygon and its source partition-face index.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Face
{
    readonly points: ReadonlyArray<V.Vector3>;
    readonly normal: V.Vector3;
    readonly index: number;
    readonly internal: boolean;
}
const LocalFaces = new WeakMap<Leaf, ReadonlyArray<Face>>();
const WorldFaces = new WeakMap<Placed, ReadonlyArray<Face>>();

/**
 * Shared-quaternion axes for an immutable owned pose, reused by the collision
 * kernels instead of normalizing the same rotation at every polygon vertex.
 *
 * @category Internal
 * @since 1.0.0
 */
interface Frame
{
    readonly x: V.Vector3;
    readonly y: V.Vector3;
    readonly z: V.Vector3;
}
const Frames = new WeakMap<T.Transform, Frame>();

/**
 * Builds a rigid basis through the existing shared Quat operations.
 *
 * @category Internal
 * @since 1.0.0
 */
export const frame = (pose: T.Transform): Frame =>
{
    let axes = Frames.get(pose);
    if (!axes)
    {
        axes = O.getOrThrow(Q.axes(pose.rotation));
        Frames.set(pose, axes);
    }

    return axes;
};

/**
 * Applies a validated owned pose's shared rigid basis to a local vector.
 *
 * @category Internal
 * @since 1.0.0
 */
const rotate = (pose: T.Transform, point: V.Coordinates): V.Vector3 =>
{
    const Axes = frame(pose);
    return V.Vector3Unsafe(Axes.x.x * point.x + Axes.y.x * point.y + Axes.z.x * point.z, Axes.x.y * point.x + Axes.y.y * point.y + Axes.z.y * point.z, Axes.x.z * point.x + Axes.y.z * point.y + Axes.z.z * point.z);
};

/**
 * Places bounded owned collision data, preserving the shared Vector3 representation.
 *
 * @category Internal
 * @since 1.0.0
 */
const point = (pose: T.Transform, value: V.Coordinates): V.Vector3 =>
{
    return M.add(pose.position, rotate(pose, value));
};

/**
 * Exact rigid enclosure of a bounded model-local AABB. Private owned bounds are
 * already finite and limited to one million blocks; arbitrary public AABB inputs
 * retain the general shared math module's validation/overflow behavior.
 *
 * @category Internal
 * @since 1.0.0
 */
export const transformBounds = (bounds: B.AABB, pose: T.Transform): B.AABB =>
{
    const Axes = frame(pose);
    const Center = point(pose, V.Vector3Unsafe((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2));
    const X = (bounds.max.x - bounds.min.x) / 2;
    const Y = (bounds.max.y - bounds.min.y) / 2;
    const Z = (bounds.max.z - bounds.min.z) / 2;
    const Half = V.Vector3Unsafe(Math.abs(Axes.x.x) * X + Math.abs(Axes.y.x) * Y + Math.abs(Axes.z.x) * Z, Math.abs(Axes.x.y) * X + Math.abs(Axes.y.y) * Y + Math.abs(Axes.z.y) * Z, Math.abs(Axes.x.z) * X + Math.abs(Axes.y.z) * Y + Math.abs(Axes.z.z) * Z);
    return B.AABBUnsafe(M.sub(Center, Half), M.add(Center, Half));
};

/**
 * Conservative angular radius about a model-local COM, using the existing bounds
 * rather than adding two origin-based radii. Concavities and actual cells remain
 * authoritative in narrow-phase queries.
 *
 * @category Internal
 * @since 1.0.0
 */
export const reach = (bounds: B.AABB, center: V.Coordinates): number =>
{
    return Math.hypot(Math.max(Math.abs(bounds.min.x - center.x), Math.abs(bounds.max.x - center.x)), Math.max(Math.abs(bounds.min.y - center.y), Math.abs(bounds.max.y - center.y)), Math.max(Math.abs(bounds.min.z - center.z), Math.abs(bounds.max.z - center.z)));
};

/**
 * Returns exact support in a placed convex leaf, preserving analytic curved shapes.
 *
 * @category Internal
 * @since 1.0.0
 */
export const support = (self: Placed, direction: V.Coordinates): V.Vector3 =>
{
    const Axes = frame(self.pose);
    const Direction = V.Vector3Unsafe(M.dot(Axes.x, direction), M.dot(Axes.y, direction), M.dot(Axes.z, direction));
    const Half = self.leaf.half;
    let point: V.Coordinates;
    if (self.leaf.hull)
    {
        point = self.leaf.hull.vertices[0];
        for (const Vertex of self.leaf.hull.vertices)
        {
            if (M.dot(Vertex, Direction) > M.dot(point, Direction))
            {
                point = Vertex;
            }
        }
    }
    else if (self.leaf.kind === "box")
    {
        point = V.Vector3Unsafe(Direction.x >= 0 ? Half.x : -Half.x, Direction.y >= 0 ? Half.y : -Half.y, Direction.z >= 0 ? Half.z : -Half.z);
    }
    else if (self.leaf.kind === "ellipsoid")
    {
        const Denominator = Math.hypot(Half.x * Direction.x, Half.y * Direction.y, Half.z * Direction.z);
        point = Denominator === 0 ? V.Vector3Unsafe(Half.x, 0, 0) :
            V.Vector3Unsafe(Half.x * (Half.x * Direction.x / Denominator), Half.y * (Half.y * Direction.y / Denominator), Half.z * (Half.z * Direction.z / Denominator));
    }
    else
    {
        point = M.scale(M.unit(Direction), Half.x);
        if (self.leaf.kind === "capsule")
        {
            point = M.add(point, V.Vector3Unsafe(0, Direction.y >= 0 ? Half.y : -Half.y, 0));
        }
    }

    return M.add(self.pose.position, rotate(self.pose, point));
};

/**
 * Computes exact world bounds from six support directions.
 *
 * @category Internal
 * @since 1.0.0
 */
export const bounds = (self: Placed): B.AABB =>
{
    return B.AABBUnsafe(V.Vector3Unsafe(support(self, V.West).x, support(self, V.Down).y, support(self, V.North).z), V.Vector3Unsafe(support(self, V.East).x, support(self, V.Up).y, support(self, V.South).z));
};

/**
 * Composes body and collider poses through the shared Transform representation.
 *
 * @category Internal
 * @since 1.0.0
 */
export const place = (leaf: Leaf, body: T.Coordinates): Placed =>
{
    if (T.isTransform(body) && leaf.pose.rotation.x === 0 && leaf.pose.rotation.y === 0 && leaf.pose.rotation.z === 0 && leaf.pose.rotation.w === 1)
    {
        if (leaf.pose.position.x === 0 && leaf.pose.position.y === 0 && leaf.pose.position.z === 0)
        {
            return { leaf,
                pose: body };
        }

        const Next = T.TransformUnsafe(point(body, leaf.pose.position), body.rotation);
        Frames.set(Next, frame(body));
        return { leaf,
            pose: Next };
    }

    return { leaf,
        pose: O.getOrThrow(T.compose(body, leaf.pose)) };
};

/**
 * Copies and validates exact primitive/compound/cell geometry with explicit budgets.
 *
 * @throws { Fault } Malformed topology or exceeded registration complexity.
 *
 * @category Internal
 * @since 1.0.0
 */
export const prepare = (shape: C.CollisionShape): Geometry =>
{
    const Leaves: Array<Leaf> = [];
    const Seen = new Set<object>();
    const Visit = (input: C.CollisionShape, path: string, depth: number): void =>
    {
        if (!input || typeof input !== "object" || Seen.has(input))
        {
            throw new Fault("validation", "InvalidInput", "Malformed or cyclic collision shape");
        }

        if (depth > 8)
        {
            throw new Fault("validation", "ComplexityLimit", "Compound depth exceeds eight");
        }

        Seen.add(input);
        if (input.kind === "compound")
        {
            if (!Array.isArray(input.children) || !input.children.length)
            {
                throw new Fault("validation", "InvalidInput", "Empty compound");
            }

            input.children.forEach((child, i) => Visit(child, `${path}/${i}`, depth + 1));
        }
        else if (input.kind === "complex")
        {
            if (!Array.isArray(input.cells) || !input.cells.length)
            {
                throw new Fault("validation", "InvalidInput", "Empty complex shape");
            }

            if (input.cells.length + Leaves.length > 4_096)
            {
                throw new Fault("validation", "ComplexityLimit", "Convex cell budget exceeds 4096");
            }

            for (const [ Index, Cell ] of input.cells.entries())
            {
                if (!Cell || !Cell.hull || !Array.isArray(Cell.hull.vertices) || Cell.hull.vertices.length > 256 ||
                    !Array.isArray(Cell.hull.faces) || Cell.hull.faces.length > 256 || Cell.hull.faces.some((f: ReadonlyArray<number>) => !Array.isArray(f) || f.length > 256) || !H.isValid(Cell.hull) ||
                    !Array.isArray(Cell.internalFaces) || Cell.internalFaces.length !== Cell.hull.faces.length ||
                    Cell.internalFaces.some((v: unknown) => typeof v !== "boolean") || !Array.isArray(Cell.sources) || Cell.sources.some((s: unknown) => typeof s !== "string"))
                {
                    throw new Fault("validation", "InvalidInput", `Invalid convex-cell topology or metadata at ${path}/${Index}`);
                }

                const Hull = H.ConvexHullUnsafe(Cell.hull.vertices, Cell.hull.faces);
                const Leaf: Leaf = Object.freeze({ path: `${path}/${Index}`,
                    kind: "hull",
                    pose: T.Identity,
                    half: V.Zero,
                    hull: Hull,
                    internal: Object.freeze([ ...Cell.internalFaces ]),
                    sources: Object.freeze([ ...Cell.sources ]),
                    bounds: O.getOrThrow(H.bounds(Hull)) });
                Leaves.push(Leaf);
            }
        }
        else
        {
            const Valid = C.primitive(input.kind, input.halfExtents, input.pose);
            if (Valid._tag === "Failure")
            {
                throw new Fault("validation", "InvalidInput", Valid.failure.message);
            }

            const Primitive = Valid.success;
            if (Math.min(Primitive.halfExtents.x, Primitive.halfExtents.z, Primitive.kind === "capsule" ? Primitive.halfExtents.x : Primitive.halfExtents.y) < 1e-9)
            {
                throw new Fault("validation", "InvalidInput", "Primitive radii and box/ellipsoid half extents must be at least 1e-9 blocks");
            }

            const Leaf = { path,
                kind: Primitive.kind,
                pose: Primitive.pose,
                half: Primitive.halfExtents,
                internal: [],
                sources: [],
                bounds: B.AABBUnsafe(V.Zero, V.Zero) };
            Leaf.bounds = bounds({ leaf: Leaf,
                pose: Primitive.pose });
            Leaves.push(Object.freeze({ ...Leaf,
                internal: Object.freeze([]),
                sources: Object.freeze([]) }));
        }

        Seen.delete(input);
        if (Leaves.length > 4_096)
        {
            throw new Fault("validation", "ComplexityLimit", "Leaf budget exceeds 4096");
        }
    };

    Visit(shape, "0", 0);
    if (Leaves.some((leaf) => !B.isValid(leaf.bounds) || B.corners(leaf.bounds)._tag === "None" ||
        O.getOrThrow(B.corners(leaf.bounds)).some((p) => M.length(p) > 1_000_000)))
    {
        throw new Fault("validation", "InvalidInput", "Collider exceeds one million model-local blocks");
    }

    const Build = (leaves: ReadonlyArray<Leaf>): Node =>
    {
        const Box = leaves.map((l) => l.bounds).reduce((a, b) => O.getOrThrow(B.union(a, b)));
        if (leaves.length === 1)
        {
            return Object.freeze({ bounds: Box,
                leaf: leaves[0] });
        }

        const Size = O.getOrThrow(B.size(Box));
        const Axis = Size.x >= Size.y && Size.x >= Size.z ? "x" : Size.y >= Size.z ? "y" : "z";
        const Sorted = [ ...leaves ].sort((a, b) => (a.bounds.min[Axis] + a.bounds.max[Axis]) -
            (b.bounds.min[Axis] + b.bounds.max[Axis]) || (a.path < b.path ? -1 : 1));
        const Middle = Math.floor(Sorted.length / 2);
        return Object.freeze({ bounds: Box,
            left: Build(Sorted.slice(0, Middle)),
            right: Build(Sorted.slice(Middle)) });
    };

    const Root = Build(Leaves);
    return Object.freeze({ leaves: Object.freeze(Leaves),
        root: Root,
        radius: Math.max(...O.getOrThrow(B.corners(Root.bounds)).map(M.length)) });
};

/**
 * Returns polyhedral face polygons in world coordinates. Curved primitives stay analytic.
 *
 * @category Internal
 * @since 1.0.0
 */
export const faces = (self: Placed): ReadonlyArray<Face> =>
{
    const Existing = WorldFaces.get(self);
    if (Existing)
    {
        return Existing;
    }

    const Local = localFaces(self.leaf);
    const Points = new Map<V.Vector3, V.Vector3>();
    const Place = (value: V.Vector3): V.Vector3 =>
    {
        let placed = Points.get(value);
        if (!placed)
        {
            placed = point(self.pose, value);
            Points.set(value, placed);
        }

        return placed;
    };

    const Result = Local.map((face) => Object.freeze({ ...face,
        normal: rotate(self.pose, face.normal),
        points: Object.freeze(face.points.map(Place)) }));
    WorldFaces.set(self, Result);
    return Result;
};

/**
 * Compiles immutable local face polygons once per owned leaf. Queries only place
 * those polygons; they never revalidate a box hull or regroup coplanar triangles.
 *
 * @category Internal
 * @since 1.0.0
 */
const localFaces = (leaf: Leaf): ReadonlyArray<Face> =>
{
    const Existing = LocalFaces.get(leaf);
    if (Existing)
    {
        return Existing;
    }

    const Hull = leaf.hull ?? (leaf.kind === "box" ? O.getOrThrow(H.fromAABB({ min: M.scale(leaf.half, -1),
        max: leaf.half })) : undefined);
    if (!Hull)
    {
        return [];
    }

    const Vertices = Hull.vertices;
    const Planes = O.getOrThrow(H.planes(Hull));
    const Triangles = Hull.faces.map((face, index) =>
    {
        const Points = face.map((i) => Vertices[i]);
        return { points: Points,
            normal: Planes[index].normal,
            index,
            internal: leaf.internal[index] ?? false };
    });
    const Groups: Array<{
        normal: V.Vector3;
        index: number;
        internal: boolean;
        points: Array<V.Vector3>;
    }> = [];
    for (const Face of Triangles)
    {
        let group = Groups.find((g) => g.internal === Face.internal && M.length(M.sub(g.normal, Face.normal)) <= 1e-12 &&
            Math.abs(M.dot(g.normal, M.sub(Face.points[0], g.points[0]))) <= 64 * Number.EPSILON * Math.max(1, ...g.points.map(M.length)));
        if (!group)
        {
            group = { ...Face,
                points: [] };
            Groups.push(group);
        }

        for (const Point of Face.points)
        {
            if (!group.points.some((p) => p.x === Point.x && p.y === Point.y && p.z === Point.z))
            {
                group.points.push(Point);
            }
        }
    }

    const Result = Object.freeze(Groups.map((g) =>
    {
        const Center = M.scale(g.points.reduce(M.add, V.Zero), 1 / g.points.length);
        const U = M.unit(M.sub(g.points[0], Center));
        const W = M.cross(g.normal, U);
        g.points.sort((a, b) => Math.atan2(M.dot(M.sub(a, Center), W), M.dot(M.sub(a, Center), U)) -
            Math.atan2(M.dot(M.sub(b, Center), W), M.dot(M.sub(b, Center), U)));
        return Object.freeze({ ...g,
            points: Object.freeze(g.points) });
    }));
    LocalFaces.set(leaf, Result);
    return Result;
};

/**
 * Exact AABB lower bound for model-BVH distance traversal.
 *
 * @category Internal
 * @since 1.0.0
 */
export const boxDistance = (a: B.Coordinates, b: B.Coordinates): number =>
{
    return Math.hypot(Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x), Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z));
};
