/**
 * Ray structural coordinates, shared hit results and dual partial-query declarations.
 *
 * @module bedform/Test/Ray.types
 *
 * @file      Ray.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys */

import { Ray as R, Transform as T, Vector3 as V } from "bedform";
import type * as Direct from "bedform/Ray";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: R.Coordinates = { origin: { x: 1,
    y: 2,
    z: 3 },
direction: { x: 0,
    y: 0,
    z: 1 } };
const Constructed: O.Option<Direct.Ray> = R.Ray(Input.origin, Input.direction);
const Raw: R.Ray = R.RayUnsafe(Input.origin, Input.direction);
const Origin: V.Vector3 = Raw.origin;
const Direction: V.Vector3 = Raw.direction;
const At: O.Option<V.Vector3> = R.at(Input, 2);
const AtPipe: O.Option<V.Vector3> = pipe(Input, R.at(2));
const Closest: O.Option<V.Vector3> = R.closestPoint(Input, V.One);
const ClosestPipe: O.Option<V.Vector3> = pipe(Input, R.closestPoint(V.One));
const Parameter: O.Option<number> = R.closestParameter(Input, V.One);
const ParameterPipe: O.Option<number> = pipe(Input, R.closestParameter(V.One));
const Distance: O.Option<number> = R.distanceToPoint(Input, V.One);
const DistancePipe: O.Option<number> = pipe(Input, R.distanceToPoint(V.One));
const Transformed: O.Option<R.Ray> = R.transform(Input, T.Identity);
const TransformedPipe: O.Option<R.Ray> = pipe(Input, R.transform(T.Identity));
const Equal: boolean = R.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, R.equals(Raw));
const Parsed: O.Option<R.Ray> = R.fromString(R.format(Input));
const ParsedAlias: O.Option<R.Ray> = R.parse(R.toString(Input));
const Text: string = Raw.pipe(R.toString);
const Valid: boolean = R.isValid(Input);
const Hit: Direct.Hit = { distance: 0,
    point: V.Zero,
    normal: O.none() };
const HitOption: O.Option<R.Hit> = O.some(Hit);
declare const Unknown: unknown;
if (R.isRay(Unknown))
{
    const Enriched: R.Ray = Unknown;
}

// @ts-expect-error Plain structural input lacks value protocols.
const MissingProtocols: R.Ray = Input;
// @ts-expect-error Nested origin is readonly.
Raw.origin.x = 1;
// @ts-expect-error Nested direction is readonly.
Raw.direction.z = 2;
// @ts-expect-error Nested vector cannot be replaced.
Raw.origin = V.Zero;
// @ts-expect-error Queries return Option.
const NotOption: V.Vector3 = R.at(Input, 2);
// @ts-expect-error Evaluation parameters are scalars.
R.at(Input, V.One);
// @ts-expect-error Rigid transformation requires a pose, not a quaternion.
R.transform(Input, T.Identity.rotation);
const BadHit: R.Hit = { distance: 0,
    point: V.Zero,
    // @ts-expect-error Hit normal uses Option, never undefined.
    normal: undefined };
// @ts-expect-error Hit fields are readonly.
Hit.distance = 2;
