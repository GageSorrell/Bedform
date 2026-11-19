/**
 * Structural pose inputs, immutable nested declarations and dual Option inference.
 *
 * @module bedform/Test/Transform.types
 *
 * @file      Transform.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys */

import type { Quat as Q} from "bedform";
import { Transform as T, Vector3 as V } from "bedform";
import type * as Direct from "bedform/Transform";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: T.Coordinates = { position: { x: 1,
    y: 2,
    z: 3 },
rotation: { x: 0,
    y: 0,
    z: 0,
    w: 2 } };
const Constructed: O.Option<Direct.Transform> = T.Transform(Input.position, Input.rotation);
const Raw: T.Transform = T.TransformUnsafe(Input.position, Input.rotation);
const Position: V.Vector3 = Raw.position;
const Rotation: Q.Quat = Raw.rotation;
const Composed: O.Option<T.Transform> = T.compose(Input, Raw);
const ComposedPipe: O.Option<T.Transform> = pipe(Input, T.compose(Raw));
const Inverse: O.Option<T.Transform> = T.inverse(Input);
const Point: O.Option<V.Vector3> = T.transformPoint(Input, V.One);
const PointPipe: O.Option<V.Vector3> = pipe(Input, T.transformPoint(V.One));
const Direction: O.Option<V.Vector3> = T.transformDirection(Input, V.UnitX);
const DirectionPipe: O.Option<V.Vector3> = pipe(Input, T.transformDirection(V.UnitX));
const UnPoint: O.Option<V.Vector3> = T.untransformPoint(Input, V.One);
const UnPointPipe: O.Option<V.Vector3> = pipe(Input, T.untransformPoint(V.One));
const UnDirection: O.Option<V.Vector3> = T.untransformDirection(Input, V.UnitX);
const UnDirectionPipe: O.Option<V.Vector3> = pipe(Input, T.untransformDirection(V.UnitX));
const Interpolated: O.Option<T.Transform> = T.interpolate(Input, Raw, 0.5);
const InterpolatedPipe: O.Option<T.Transform> = pipe(Input, T.interpolate(Raw, 0.5));
const Lerp: O.Option<T.Transform> = pipe(Input, T.lerp(Raw, 2));
const Matrix: O.Option<Direct.Matrix4> = T.toMatrix(Input);
const RoundTrip: O.Option<T.Transform> = T.fromMatrix(O.getOrThrow(Matrix));
const Equal: boolean = T.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, T.equals(Raw));
const Text: string = Raw.pipe(T.format);
const Parsed: O.Option<T.Transform> = T.fromString(T.toString(Input));
const ParsedAlias: O.Option<T.Transform> = T.parse(Text);
const Valid: boolean = T.isValid(Input);
declare const Unknown: unknown;
if (T.isTransform(Unknown))
{
    const Value: T.Transform = Unknown;
}

// @ts-expect-error Plain structural inputs lack value protocols.
const MissingProtocols: T.Transform = Input;
// @ts-expect-error Position is deeply readonly.
Raw.position.x = 5;
// @ts-expect-error Orientation is deeply readonly.
Raw.rotation.w = 5;
// @ts-expect-error Nested vectors cannot be replaced.
Raw.position = V.Zero;
// @ts-expect-error Composition is partial.
const NotOption: T.Transform = T.compose(Input, Input);
// @ts-expect-error Homogeneous matrices have exactly sixteen components.
T.fromMatrix([ 1, 0, 0, 1 ]);
// @ts-expect-error Matrix output is readonly.
O.getOrThrow(Matrix)[3] = 10;
// @ts-expect-error Pose construction requires orientation.
T.Transform(V.Zero);
// @ts-expect-error Interpolation requires its scalar parameter.
T.interpolate(Input, Input);
