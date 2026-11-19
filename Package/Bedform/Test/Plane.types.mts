/**
 * Plane structural inputs, extracted line results, query options and dual Option inference.
 *
 * @module bedform/Test/Plane.types
 *
 * @file      Plane.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports */

import { Plane as P, Ray as R, Transform as T, Vector3 as V } from "bedform";
import type * as Direct from "bedform/Plane";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: P.Coordinates = { normal: { x: 0,
    y: 1,
    z: 0 },
offset: -2 };
const Options: P.QueryOptions = { absoluteTolerance: 0,
    relativeTolerance: 0 };
const Constructed: O.Option<Direct.Plane> = P.Plane(Input.normal, Input.offset);
const Raw: P.Plane = P.PlaneUnsafe(Input.normal, Input.offset);
const PointNormal: O.Option<P.Plane> = P.fromPointNormal(V.Zero, V.Up);
const PointNormalPipe: O.Option<P.Plane> = pipe(V.Zero, P.fromPointNormal(V.Up));
const Points: O.Option<P.Plane> = P.fromPoints(V.Zero, V.UnitX, V.UnitY);
const PointsPipe: O.Option<P.Plane> = pipe(V.Zero, P.fromPoints(V.UnitX, V.UnitY));
const Distance: O.Option<number> = P.signedDistance(Input, V.One);
const DistancePipe: O.Option<number> = pipe(Input, P.signedDistance(V.One));
const Projection: O.Option<V.Vector3> = P.projectPoint(Input, V.One);
const ProjectionPipe: O.Option<V.Vector3> = pipe(Input, P.projectPoint(V.One));
const Side: O.Option<P.Side> = P.classify(Input, V.One);
const SideOptions: O.Option<P.Side> = P.classify(Input, V.One, Options);
const SidePipe: O.Option<P.Side> = pipe(Input, P.classify(V.One));
const SideOptionsPipe: O.Option<P.Side> = pipe(Input, P.classify(V.One, Options));
const Contains: O.Option<boolean> = P.contains(Input, V.One, Options);
const ContainsPipe: O.Option<boolean> = pipe(Input, P.contains(V.One, Options));
const Flipped: O.Option<P.Plane> = P.flip(Input);
const Mapped: O.Option<P.Plane> = P.transform(Input, T.Identity);
const MappedPipe: O.Option<P.Plane> = pipe(Input, P.transform(T.Identity));
const Line: O.Option<Direct.Line> = P.intersectPlane(Input, Raw, Options);
const LinePipe: O.Option<P.Line> = pipe(Input, P.intersectPlane(Raw, Options));
const Ray = R.RayUnsafe(V.Zero, V.Up);
const Hit: O.Option<R.Hit> = P.intersectRay(Input, Ray, Options);
const HitPipe: O.Option<R.Hit> = pipe(Input, P.intersectRay(Ray, Options));
const Equal: boolean = P.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, P.equals(Raw));
const Parsed: O.Option<P.Plane> = P.fromString(P.format(Input));
const ParsedAlias: O.Option<P.Plane> = P.parse(P.toString(Input));
const Valid: boolean = P.isValid(Input);
const Text: string = Raw.pipe(P.toString);
declare const Unknown: unknown;
if (P.isPlane(Unknown))
{
    const Enriched: P.Plane = Unknown;
}

// @ts-expect-error Structural input lacks enriched protocols.
const MissingProtocols: P.Plane = Input;
// @ts-expect-error Nested normal coordinates are readonly.
Raw.normal.x = 1;
// @ts-expect-error Offset is readonly.
Raw.offset = 1;
// @ts-expect-error Queries return Option, including valid outside results.
const NotOption: boolean = P.contains(Input, V.One);
// @ts-expect-error An infinite line is distinct from a forward Ray.
const NotRay: R.Ray = O.getOrThrow(Line);
// @ts-expect-error Intersection line coordinates are readonly.
O.getOrThrow(Line).direction.x = 1;
// @ts-expect-error Query tolerances are numeric.
P.classify(Input, V.One, { absoluteTolerance: "small" });
