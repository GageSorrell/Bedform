/**
 * Rotator public aliases, structural degree inputs and dual/Option declaration inference.
 *
 * @module bedform/Test/Rotator.types
 *
 * @file      Rotator.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-imports, sort-keys, @stylistic/max-len */

import { Rotator as R, Quat as Q, Vector3 as V } from "bedform";
import type * as Direct from "bedform/Rotator";
import type * as Order from "@bedform/effect/Order";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: R.Coordinates = { pitch: 10,
    yaw: 20,
    roll: 30 };
const Constructed: O.Option<Direct.Rotator> = R.Rotator(10, 20, 30);
const Alias: R.EulerAngle = O.getOrThrow(Constructed);
const Added: R.Rotator = R.add(Input, Input);
const AddedPipe: R.Rotator = pipe(Input, R.add(Input));
const Subtracted: R.Rotator = R.subtract(Input, Input);
const SubtractedPipe: R.Rotator = pipe(Input, R.subtract(Input));
const Scaled: R.Rotator = R.scale(Input, 2);
const ScaledPipe: R.Rotator = pipe(Input, R.scale(2));
const Axis: number = R.getAxis(Input, R.Axis.Pitch);
const AxisPipe: number = pipe(Input, R.getAxis(R.Axis.Yaw));
const Set: R.Rotator = R.setAxis(Input, R.Axis.Roll, 10);
const SetPipe: R.Rotator = pipe(Input, R.setAxis(R.Axis.Roll, 10));
const Wrapped: number = R.wrapAxis(450);
const WrappedPipe: number = pipe(450, R.wrapAxis());
const NormalizedAxis: number = pipe(-450, R.normalizeAxis);
const ClampedAxis: number = R.clampAxis()(450);
const ComponentNormalized: R.Rotator = R.normalize(Input);
const ComponentWrapped: R.Rotator = R.wrap(Input);
const ComponentClamped: R.Rotator = R.clamp(Input);
const Principal: O.Option<R.Rotator> = R.principal(Input);
const Winding: O.Option<R.WindingRemainder> = R.windingAndRemainder(Input);
const Equivalent: O.Option<R.Rotator> = R.equivalent(Input);
const Closest: O.Option<R.Rotator> = R.closest(Input, Input);
const ClosestPipe: O.Option<R.Rotator> = pipe(Input, R.closest(Input));
const Grid: O.Option<R.Rotator> = R.gridSnap(Input, 10);
const GridPipe: O.Option<R.Rotator> = pipe(Input, R.gridSnap(Input));
const Manhattan: number = pipe(Input, R.manhattanDistance(Input));
const Byte: O.Option<number> = R.compressAxisToByte(90);
const BytePipe: O.Option<number> = pipe(90, R.compressAxisToByte());
const DecodedByte: O.Option<number> = R.decompressAxisFromByte(64);
const DecodedBytePipe: O.Option<number> = pipe(64, R.decompressAxisFromByte);
const Short: O.Option<number> = pipe(90, R.compressAxisToShort);
const DecodedShort: O.Option<number> = pipe(16384, R.decompressAxisFromShort());
const Composed: O.Option<R.Rotator> = R.compose(Input, Input);
const ComposedPipe: O.Option<R.Rotator> = pipe(Input, R.compose(Input));
const Multiplied: O.Option<R.Rotator> = R.multiply(Input, Input);
const Interpolated: O.Option<R.Rotator> = R.slerp(Input, Input, 0.5);
const InterpolatedPipe: O.Option<R.Rotator> = pipe(Input, R.slerp(Input, 0.5));
const Inverse: O.Option<R.Rotator> = R.inverse(Input);
const Rotated: O.Option<V.Vector3> = pipe(Input, R.rotateVector(V.UnitX));
const Unrotated: O.Option<V.Vector3> = R.unrotateVector(Input, V.UnitX);
const Directions: O.Option<Q.Axes> = R.axes(Input);
const Distance: O.Option<number> = pipe(Input, R.angularDistance(Input));
const Compared: O.Option<boolean> = pipe(Input, R.equalsApprox(Input, 0.01));
const Equal: boolean = pipe(Input, R.equals(Input));
const RawEqual: boolean = R.equalsComponents(Input, Input);
const RawHash: number = R.hashComponents(Input);
const Key: O.Option<Q.CanonicalKey> = R.canonicalKey(Input);
const Lexical: Order.Order<R.Coordinates> = R.OrderLexicographic;
const Angular: O.Option<Order.Order<R.Coordinates>> = R.orderByAngleDistance(Input);
const Parsed: O.Option<R.Rotator> = R.parse(R.format(Input));
const Quat: O.Option<Q.Quat> = Q.fromRotator(Input);
const Rotator: O.Option<R.Rotator> = Q.toRotator(Q.Identity);
const Euler: V.Vector3 = R.toEuler(Input);
const FromEuler: O.Option<R.Rotator> = R.fromEuler(Euler);
const QEuler: O.Option<V.Vector3> = Q.toEuler(Q.Identity);
const FromQEuler: O.Option<Q.Quat> = Q.fromEuler(Euler);
const MethodPipe: string = Alias.pipe((value) => value.yaw, (value) => String(value));
// @ts-expect-error Raw angles lack the protocols required by enriched values.
const MissingProtocols: R.Rotator = Input;
// @ts-expect-error Stored components are readonly.
Alias.pitch = 1;
// @ts-expect-error Named axes exclude misspelled fields.
R.getAxis(Input, "Pitch");
// @ts-expect-error Composition is a partial rotation operation.
const RawComposition: R.Rotator = R.compose(Input, Input);
// @ts-expect-error Component normalization returns raw angles rather than Option.
const WrongNormalize: O.Option<R.Rotator> = R.normalize(Input);
// @ts-expect-error Euler vectors require x/y/z, not angle property names.
Q.fromEuler(Input);
// @ts-expect-error Approximate comparisons require an explicit degree tolerance.
R.equalsApprox(Input);
// @ts-expect-error Angle aliases remain inside their owner module.
import { EulerAngle } from "bedform";
// @ts-expect-error No EulerAngle package subpath is exported.
import * as AliasPath from "bedform/EulerAngle";
const Parts = O.getOrThrow(Winding);
// @ts-expect-error Decomposition records are readonly.
Parts.remainder = Alias;
