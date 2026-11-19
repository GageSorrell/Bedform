/**
 * Public solid topology, readonly derived arrays and dual partial-query declarations.
 *
 * @module bedform/Test/ConvexHull.types
 *
 * @file      ConvexHull.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys, @stylistic/max-len */

import type { Plane as P} from "bedform";
import { ConvexHull as H, AABB as B, OBB as S, Ray as R, Transform as T, Quat as Q, Vector3 as V } from "bedform";
import type * as Direct from "bedform/ConvexHull";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Points = [ V.Zero, V.UnitX, V.UnitY, V.UnitZ ];
const Faces = [ [ 0, 2, 1 ], [ 0, 1, 3 ], [ 0, 3, 2 ], [ 1, 2, 3 ] ];
const Input: H.Coordinates = { vertices: Points,
    faces: Faces };
const Options: H.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };
const Constructed: O.Option<Direct.ConvexHull> = H.ConvexHull(Points);
const Indexed: O.Option<H.ConvexHull> = H.fromFaces(Points, Faces);
const IndexedPipe: O.Option<H.ConvexHull> = pipe(Points, H.fromFaces(Faces));
const Raw: H.ConvexHull = H.ConvexHullUnsafe(Points, Faces);
const FromAABB: O.Option<H.ConvexHull> = H.fromAABB(B.AABBUnsafe(V.Zero, V.One));
const FromOBB: O.Option<H.ConvexHull> = H.fromOBB(S.OBBUnsafe(V.Zero, V.One, Q.Identity));
const Bounds: O.Option<B.AABB> = H.bounds(Input);
const BoundsAlias: O.Option<B.AABB> = H.toAABB(Input);
const Volume: O.Option<number> = H.volume(Input);
const Center: O.Option<V.Vector3> = H.centroid(Input);
const Edges: O.Option<ReadonlyArray<H.Edge>> = H.edges(Input);
const Planes: O.Option<ReadonlyArray<P.Plane>> = H.planes(Input);
const Contains: O.Option<boolean> = H.containsPoint(Input, V.Zero, Options);
const ContainsPipe: O.Option<boolean> = pipe(Input, H.contains(V.Zero, Options));
const Closest: O.Option<V.Vector3> = H.closestPoint(Input, V.One);
const ClosestPipe: O.Option<V.Vector3> = pipe(Input, H.closestPoint(V.One));
const Distance: O.Option<number> = H.distanceToPoint(Input, V.One);
const DistancePipe: O.Option<number> = pipe(Input, H.distanceToPoint(V.One));
const Support: O.Option<V.Vector3> = H.supportPoint(Input, V.One);
const SupportPipe: O.Option<V.Vector3> = pipe(Input, H.supportPoint(V.One));
const Mapped: O.Option<H.ConvexHull> = H.transform(Input, T.Identity);
const MappedPipe: O.Option<H.ConvexHull> = pipe(Input, H.transform(T.Identity));
const Overlap: O.Option<boolean> = H.overlaps(Input, Input, Options);
const OverlapPipe: O.Option<boolean> = pipe(Input, H.overlapsConvexHull(Input, Options));
const AABBOverlap: O.Option<boolean> = H.overlapsAABB(Input, B.AABBUnsafe(V.Zero, V.One), Options);
const AABBOverlapPipe: O.Option<boolean> = pipe(Input, H.overlapsAABB(B.AABBUnsafe(V.Zero, V.One)));
const OBBOverlap: O.Option<boolean> = H.overlapsOBB(Input, S.OBBUnsafe(V.Zero, V.One, Q.Identity), Options);
const OBBOverlapPipe: O.Option<boolean> = pipe(Input, H.overlapsOBB(S.OBBUnsafe(V.Zero, V.One, Q.Identity)));
const Hit: O.Option<R.Hit> = H.intersectRay(Input, R.RayUnsafe(V.Zero, V.UnitX), Options);
const HitPipe: O.Option<R.Hit> = pipe(Input, H.intersectRay(R.RayUnsafe(V.Zero, V.UnitX), Options));
const Equal: boolean = H.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, H.equals(Raw));
const Parsed: O.Option<H.ConvexHull> = H.fromString(H.format(Input));
const ParsedAlias: O.Option<H.ConvexHull> = H.parse(H.toString(Input));
const Text: string = Raw.pipe(H.toString);
const Valid: boolean = H.isValid(Input);
declare const Unknown: unknown;
if (H.isConvexHull(Unknown))
{
    const Value: H.ConvexHull = Unknown;
}

// @ts-expect-error Structural inputs lack enriched value protocols.
const MissingProtocols: H.ConvexHull = Input;
// @ts-expect-error Stored vertices are deeply readonly.
Raw.vertices[0].x = 1;
// @ts-expect-error Face indices are readonly.
Raw.faces[0][0] = 1;
// @ts-expect-error Vertex arrays cannot be replaced.
Raw.vertices = [];
// @ts-expect-error Derived edge fields are readonly.
O.getOrThrow(Edges)[0].start = 1;
// @ts-expect-error Predicates return Option.
const NotOption: boolean = H.overlaps(Input, Input);
