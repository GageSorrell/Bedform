/**
 * Public Quat type, dual operand order and partial-result inference.
 *
 * @module bedform/Test/Quat.types
 *
 * @file      Quat.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Type fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-imports, sort-keys, @stylistic/max-len */

import { Quat as Q, Vector3 as V } from "bedform";
import * as Direct from "bedform/Quat";
import type * as Order from "@bedform/effect/Order";
import * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

const Alias: Direct.Quat = Q.Identity;
const Components: Q.Coordinates = { x: 1,
    y: 2,
    z: 3,
    w: 4 };
const Constructed: Option.Option<Q.Quat> = Direct.Quat(1, 2, 3, 4);
const AddDirect: Q.Quat = Q.add(Components, Q.Identity);
const AddCurried: Q.Quat = Q.add(Q.Identity)(Components);
const AddPiped: Q.Quat = pipe(Components, Q.add(Q.Identity));
const SubtractDirect: Q.Quat = Q.subtract(Components, Q.Identity);
const SubtractCurried: Q.Quat = Q.subtract(Q.Identity)(Components);
const SubtractPiped: Q.Quat = pipe(Components, Q.subtract(Q.Identity));
const MultiplyDirect: Q.Quat = Q.multiply(Components, Q.Identity);
const MultiplyCurried: Q.Quat = Q.multiply(Q.Identity)(Components);
const MultiplyPiped: Q.Quat = pipe(Components, Q.multiply(Q.Identity));
const AlignshortestarcDirect: Option.Option<Q.Quat> = Q.alignShortestArc(Components, Q.Identity);
const AlignshortestarcCurried: Option.Option<Q.Quat> = Q.alignShortestArc(Q.Identity)(Components);
const AlignshortestarcPiped: Option.Option<Q.Quat> = pipe(Components, Q.alignShortestArc(Q.Identity));
const EqualsDirect: boolean = Q.equals(Components, Q.Identity);
const EqualsCurried: boolean = Q.equals(Q.Identity)(Components);
const EqualsPiped: boolean = pipe(Components, Q.equals(Q.Identity));
const EqualscomponentsDirect: boolean = Q.equalsComponents(Components, Q.Identity);
const EqualscomponentsCurried: boolean = Q.equalsComponents(Q.Identity)(Components);
const EqualscomponentsPiped: boolean = pipe(Components, Q.equalsComponents(Q.Identity));
const DotDirect: number = Q.dot(Components, Q.Identity);
const DotCurried: number = Q.dot(Q.Identity)(Components);
const DotPiped: number = pipe(Components, Q.dot(Q.Identity));
const AngulardistanceDirect: Option.Option<number> = Q.angularDistance(Components, Q.Identity);
const AngulardistanceCurried: Option.Option<number> = Q.angularDistance(Q.Identity)(Components);
const AngulardistancePiped: Option.Option<number> = pipe(Components, Q.angularDistance(Q.Identity));
const ErrorDirect: Option.Option<number> = Q.error(Components, Q.Identity);
const ErrorCurried: Option.Option<number> = Q.error(Q.Identity)(Components);
const ErrorPiped: Option.Option<number> = pipe(Components, Q.error(Q.Identity));
const ErrorangleDirect: Option.Option<number> = Q.errorAngle(Components, Q.Identity);
const ErrorangleCurried: Option.Option<number> = Q.errorAngle(Q.Identity)(Components);
const ErroranglePiped: Option.Option<number> = pipe(Components, Q.errorAngle(Q.Identity));
const ScaleDirect: Q.Quat = Q.scale(Components, 2);
const ScalePiped: Q.Quat = pipe(Components, Q.scale(2));
const DivideDirect: Q.Quat = Q.divide(Components, 2);
const DividePiped: Q.Quat = pipe(Components, Q.divide(2));
const RotatevectorDirect: Option.Option<V.Vector3> = Q.rotateVector(Components, V.UnitX);
const RotatevectorPiped: Option.Option<V.Vector3> = pipe(Components, Q.rotateVector(V.UnitX));
const UnrotatevectorDirect: Option.Option<V.Vector3> = Q.unrotateVector(Components, V.UnitX);
const UnrotatevectorPiped: Option.Option<V.Vector3> = pipe(Components, Q.unrotateVector(V.UnitX));
const FromvectorsDirect: Option.Option<Q.Quat> = Q.fromVectors(V.UnitX, V.UnitY);
const FromvectorsPiped: Option.Option<Q.Quat> = pipe(V.UnitX, Q.fromVectors(V.UnitY));
const FromunitnormalsDirect: Option.Option<Q.Quat> = Q.fromUnitNormals(V.UnitX, V.UnitY);
const FromunitnormalsPiped: Option.Option<Q.Quat> = pipe(V.UnitX, Q.fromUnitNormals(V.UnitY));
const FromaxisangleDirect: Option.Option<Q.Quat> = Q.fromAxisAngle(V.UnitX, 1);
const FromaxisanglePiped: Option.Option<Q.Quat> = pipe(V.UnitX, Q.fromAxisAngle(1));
const Matrix: Option.Option<Q.Matrix4> = Q.toMatrix(Components);
const RoundTrip: Option.Option<Q.Quat> = pipe(Matrix, Option.flatMap(Q.fromMatrix));
const Key: Option.Option<Q.CanonicalKey> = Q.canonicalKey(Components);
const Approximate: Option.Option<boolean> = pipe(Components, Q.equalsApprox(Q.Identity, 0.01));
const Normal: boolean = pipe(Components, Q.isNormalized(0.001));
const Identity: boolean = Q.isIdentity(Components);
const Comparison: Order.Order<Q.Coordinates> = Q.OrderLexicographic;
const ByAngle: Option.Option<Order.Order<Q.Coordinates>> = Q.orderByAngleDistance(Components);
const Text: string = Q.format(Components);
const Parsed: Option.Option<Q.Quat> = Q.fromString(Text);
const PipedMethod: number = Q.Identity.pipe((value) => value.w);
// @ts-expect-error Quat components are readonly.
Alias.x = 2;
// @ts-expect-error Raw coordinates lack enriched protocols.
const MissingProtocols: Q.Quat = Components;
// @ts-expect-error Partial operations must be unwrapped.
const RawNormalize: Q.Quat = Q.normalize(Components);
// @ts-expect-error Multiplication requires quaternion coordinates.
Q.multiply(Components, V.Zero);
// @ts-expect-error Scale takes a numeric operand.
Q.scale(Components, "2");
// @ts-expect-error Curried vector rotation still requires a quaternion receiver.
Q.rotateVector(V.One)(V.Zero);
// @ts-expect-error Proper matrix conversion requires all sixteen entries.
Q.fromMatrix([ 1, 0, 0, 0 ]);
// @ts-expect-error Approximate comparison requires an explicit angular tolerance.
Q.equalsApprox(Components);
// @ts-expect-error The former module name has no root namespace.
import { Quaternion } from "bedform";
// @ts-expect-error The former module name has no package subpath.
import * as LegacyModule from "bedform/Quaternion";
