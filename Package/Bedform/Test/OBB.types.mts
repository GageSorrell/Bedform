/**
 * Oriented-box structural inputs, readonly outputs and dual optional-query inference.
 *
 * @module bedform/Test/OBB.types
 *
 * @file      OBB.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports */

import { OBB as S, AABB as B, Ray as R, Transform as T, Quat as Q, Vector3 as V } from "bedform";
import type * as Direct from "bedform/OBB";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: S.Coordinates = { center: V.Zero,
    halfExtents: V.One,
    rotation: Q.Identity };
const Options: S.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };
const Constructed: O.Option<Direct.OBB> = S.OBB(Input.center, Input.halfExtents, Input.rotation);
const Raw: S.OBB = S.OBBUnsafe(Input.center, Input.halfExtents, Input.rotation);
const Local: O.Option<V.Vector3> = S.toLocalPoint(Input, V.One);
const LocalPipe: O.Option<V.Vector3> = pipe(Input, S.toLocalPoint(V.One));
const World: O.Option<V.Vector3> = S.toWorldPoint(Input, V.One);
const WorldPipe: O.Option<V.Vector3> = pipe(Input, S.toWorldPoint(V.One));
const Corners: O.Option<Direct.Corners> = S.corners(Input);
const Bounds: O.Option<B.AABB> = S.toAABB(Input);
const Closest: O.Option<V.Vector3> = S.closestPoint(Input, V.One);
const ClosestPipe: O.Option<V.Vector3> = pipe(Input, S.closestPoint(V.One));
const Distance: O.Option<number> = S.distanceToPoint(Input, V.One);
const DistancePipe: O.Option<number> = pipe(Input, S.distanceToPoint(V.One));
const Support: O.Option<V.Vector3> = S.supportPoint(Input, V.One);
const SupportPipe: O.Option<V.Vector3> = pipe(Input, S.supportPoint(V.One));
const Contains: O.Option<boolean> = S.containsPoint(Input, V.One, Options);
const ContainsPipe: O.Option<boolean> = pipe(Input, S.contains(V.One, Options));
const Overlap: O.Option<boolean> = S.overlaps(Input, Raw, Options);
const OverlapPipe: O.Option<boolean> = pipe(Input, S.overlapsOBB(Raw, Options));
const AABBOverlap: O.Option<boolean> = S.overlapsAABB(Input, B.AABBUnsafe(V.Zero, V.One), Options);
const AABBOverlapPipe: O.Option<boolean> = pipe(Input, S.overlapsAABB(B.AABBUnsafe(V.Zero, V.One)));
const Mapped: O.Option<S.OBB> = S.transform(Input, T.Identity);
const MappedPipe: O.Option<S.OBB> = pipe(Input, S.transform(T.Identity));
const Ray = R.RayUnsafe(V.Zero, V.UnitX);
const Hit: O.Option<R.Hit> = S.intersectRay(Input, Ray, Options);
const HitPipe: O.Option<R.Hit> = pipe(Input, S.intersectRay(Ray, Options));
const Equal: boolean = S.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, S.equals(Raw));
const Parsed: O.Option<S.OBB> = S.fromString(S.format(Input));
const ParsedAlias: O.Option<S.OBB> = S.parse(S.toString(Input));
const Valid: boolean = S.isValid(Input);
const Text: string = Raw.pipe(S.toString);
declare const Unknown: unknown;
if (S.isOBB(Unknown))
{
    const Value: S.OBB = Unknown;
}

// @ts-expect-error Plain structural boxes lack enriched protocols.
const MissingProtocols: S.OBB = Input;
// @ts-expect-error Center coordinates are readonly.
Raw.center.x = 3;
// @ts-expect-error Half extents are readonly.
Raw.halfExtents.x = 3;
// @ts-expect-error Rotation coordinates are readonly.
Raw.rotation.w = 3;
// @ts-expect-error Corners are readonly.
O.getOrThrow(Corners)[0] = V.Zero;
// @ts-expect-error Overlap predicates are partial Option results.
const NotOption: boolean = S.overlaps(Input, Raw);
// @ts-expect-error AABB queries take bounds rather than quaternion fields.
S.overlapsAABB(Input, Q.Identity);
