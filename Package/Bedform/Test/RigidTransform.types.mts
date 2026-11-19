/**
 * Motion inheritance, readonly nested values and dual Option inference.
 *
 * @module bedform/Test/RigidTransform.types
 *
 * @file      RigidTransform.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports, sort-keys */

import type { Quat as Q} from "bedform";
import { RigidTransform as R, Transform as T, Vector3 as V } from "bedform";
import type * as Direct from "bedform/RigidTransform";
import type * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
const Input: R.Coordinates = { position: { x: 1,
    y: 2,
    z: 3 },
rotation: { x: 0,
    y: 0,
    z: 0,
    w: 2 },
linearVelocity: { x: 3,
    y: 4,
    z: 5 },
angularVelocity: { x: 0,
    y: 1,
    z: 0 } };
const Constructed: O.Option<Direct.RigidTransform> = R.RigidTransform(Input.position, Input.rotation,
    Input.linearVelocity, Input.angularVelocity);
const Raw: R.RigidTransform = R.RigidTransformUnsafe(Input.position, Input.rotation, V.Zero, V.Zero);
const Parent: T.Transform = Raw;
const Position: V.Vector3 = Raw.position;
const Rotation: Q.Quat = Raw.rotation;
const Linear: V.Vector3 = Raw.linearVelocity;
const Angular: V.Vector3 = Raw.angularVelocity;
const From: O.Option<R.RigidTransform> = R.fromTransform(T.Identity, V.Zero, V.UnitY);
const FromPipe: O.Option<R.RigidTransform> = pipe(T.Identity, R.fromTransform(V.Zero, V.UnitY));
const Pose: O.Option<T.Transform> = R.toTransform(Input);
const Composed: O.Option<R.RigidTransform> = R.compose(Input, Raw);
const ComposedPipe: O.Option<R.RigidTransform> = pipe(Input, R.compose(Raw));
const Inverse: O.Option<R.RigidTransform> = R.inverse(Input);
const Velocity: O.Option<V.Vector3> = R.velocityAtPoint(Input, V.One);
const VelocityPipe: O.Option<V.Vector3> = pipe(Input, R.velocityAtPoint(V.One));
const Interpolated: O.Option<R.RigidTransform> = R.interpolate(Input, Raw, 0.5);
const InterpolatedPipe: O.Option<R.RigidTransform> = pipe(Input, R.interpolate(Raw, 0.5));
const Lerp: O.Option<R.RigidTransform> = pipe(Input, R.lerp(Raw, 2));
const Equal: boolean = R.equals(Input, Raw);
const EqualPipe: boolean = pipe(Input, R.equals(Raw));
const Text: string = Raw.pipe(R.format);
const Parsed: O.Option<R.RigidTransform> = R.fromString(R.toString(Input));
const ParsedAlias: O.Option<R.RigidTransform> = R.parse(Text);
const Valid: boolean = R.isValid(Input);
declare const Unknown: unknown;
if (R.isRigidTransform(Unknown))
{
    const Value: R.RigidTransform = Unknown;
    const Base: T.Transform = Unknown;
}

// @ts-expect-error A pose alone lacks origin velocities.
const MissingMotion: R.RigidTransform = T.Identity;
// @ts-expect-error Plain structural inputs lack enriched protocols.
const MissingProtocols: R.RigidTransform = Input;
// @ts-expect-error Velocity fields are deeply readonly.
Raw.linearVelocity.x = 2;
// @ts-expect-error Angular velocity is deeply readonly.
Raw.angularVelocity.y = 2;
// @ts-expect-error Nested motion cannot be replaced.
Raw.angularVelocity = V.Zero;
// @ts-expect-error Pose remains deeply readonly through inheritance.
Parent.position.x = 2;
// @ts-expect-error Composition is partial.
const NotOption: R.RigidTransform = R.compose(Input, Input);
// @ts-expect-error Both velocities are required for construction from a pose.
R.fromTransform(T.Identity, V.Zero);
// @ts-expect-error Point queries require structural vector coordinates.
R.velocityAtPoint(Input, 2);
