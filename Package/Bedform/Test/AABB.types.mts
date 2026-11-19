/**
 * Public bounds, immutable nested results and dual partial-query declaration inference.
 *
 * @module bedform/Test/AABB.types
 *
 * @file      AABB.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys */

import { AABB as B, Ray as R, Transform as T, Vector3 as V } from "bedform";
import type * as Direct from "bedform/AABB";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: B.Coordinates = { min: { x: 0,
    y: 0,
    z: 0 },
max: { x: 1,
    y: 1,
    z: 1 } };
const Options: B.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };
const Constructed: O.Option<Direct.AABB> = B.AABB(Input.min, Input.max);
const Raw: B.AABB = B.AABBUnsafe(Input.min, Input.max);
const FromPoints: O.Option<B.AABB> = B.fromPoints([ V.Zero, V.One ]);
const FromCenter: O.Option<B.AABB> = B.fromCenterHalfExtents(V.Zero, V.One);
const FromCenterPipe: O.Option<B.AABB> = pipe(V.Zero, B.fromCenterHalfExtents(V.One));
const Center: O.Option<V.Vector3> = B.center(Input);
const Size: O.Option<V.Vector3> = B.size(Input);
const Half: O.Option<V.Vector3> = B.halfExtents(Input);
const Corners: O.Option<Direct.Corners> = B.corners(Input);
const Point: O.Option<boolean> = B.containsPoint(Input, V.One, Options);
const PointPipe: O.Option<boolean> = pipe(Input, B.containsPoint(V.One, Options));
const Contains: O.Option<boolean> = B.contains(Input, V.One);
const ContainsPipe: O.Option<boolean> = pipe(Input, B.contains(V.One));
const Box: O.Option<boolean> = B.containsBox(Input, Raw);
const BoxPipe: O.Option<boolean> = pipe(Input, B.containsBox(Raw, Options));
const Overlap: O.Option<boolean> = B.overlaps(Input, Raw, Options);
const OverlapPipe: O.Option<boolean> = pipe(Input, B.overlaps(Raw));
const Union: O.Option<B.AABB> = B.union(Input, Raw);
const UnionPipe: O.Option<B.AABB> = pipe(Input, B.union(Raw));
const Intersection: O.Option<B.AABB> = B.intersection(Input, Raw);
const IntersectionPipe: O.Option<B.AABB> = pipe(Input, B.intersection(Raw));
const Expanded: O.Option<B.AABB> = B.expand(Input, 1);
const ExpandedPipe: O.Option<B.AABB> = pipe(Input, B.expand(V.One));
const Closest: O.Option<V.Vector3> = B.closestPoint(Input, V.One);
const ClosestPipe: O.Option<V.Vector3> = pipe(Input, B.closestPoint(V.One));
const Distance: O.Option<number> = B.distanceToPoint(Input, V.One);
const DistancePipe: O.Option<number> = pipe(Input, B.distanceToPoint(V.One));
const Support: O.Option<V.Vector3> = B.supportPoint(Input, V.One);
const SupportPipe: O.Option<V.Vector3> = pipe(Input, B.supportPoint(V.One));
const Mapped: O.Option<B.AABB> = B.transform(Input, T.Identity);
const MappedPipe: O.Option<B.AABB> = pipe(Input, B.transform(T.Identity));
const Ray = R.RayUnsafe(V.Zero, V.UnitX);
const Hit: O.Option<R.Hit> = B.intersectRay(Input, Ray, Options);
const HitPipe: O.Option<R.Hit> = pipe(Input, B.intersectRay(Ray, Options));
const Equal: boolean = B.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, B.equals(Raw));
const Parsed: O.Option<B.AABB> = B.fromString(B.format(Input));
const ParsedAlias: O.Option<B.AABB> = B.parse(B.toString(Input));
const Valid: boolean = B.isValid(Input);
const Text: string = Raw.pipe(B.toString);
declare const Unknown: unknown;
if (B.isAABB(Unknown))
{
    const Value: B.AABB = Unknown;
}

// @ts-expect-error Plain structural bounds lack enriched protocols.
const MissingProtocols: B.AABB = Input;
// @ts-expect-error Nested bounds are readonly.
Raw.min.x = 1;
// @ts-expect-error Nested bound vectors cannot be replaced.
Raw.max = V.Zero;
// @ts-expect-error Query predicates return Option, not plain boolean.
const NotOption: boolean = B.contains(Input, V.One);
// @ts-expect-error Corner tuple is readonly.
O.getOrThrow(Corners)[0] = V.One;
// @ts-expect-error Corners are themselves readonly enriched vectors.
O.getOrThrow(Corners)[0].x = 3;
// @ts-expect-error AABB transform returns enclosing bounds, not an oriented quaternion.
const NotVector: O.Option<V.Vector3> = B.transform(Input, T.Identity);
