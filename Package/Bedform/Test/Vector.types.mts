/**
 * Public vector overloads, immutable coordinates and structural Bedrock input acceptance.
 *
 * @module bedform/Test/Vector.types
 *
 * @file      Vector.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Declaration fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/no-unused-vars, sort-imports, @stylistic/max-len */

import { Vector2 as V2, Vector3 as V3 } from "bedform";
import type * as Direct2 from "bedform/Vector2";
import type * as Direct3 from "bedform/Vector3";
import type { Vector2 as Bedrock2, Vector3 as Bedrock3 } from "@minecraft/server";
import type * as Option from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";

declare const Native2: Bedrock2;
declare const Native3: Bedrock3;
const Constructed2: Option.Option<Direct2.Vector2> = V2.Vector2(1, 2);
const Constructed3: Option.Option<Direct3.Vector3> = V3.Vector3(1, 2, 3);
const Plain2: V2.Coordinates = Native2;
const Plain3: V3.Coordinates = Native3;
const Add2Direct: V2.Vector2 = V2.add(Native2, Native2);
const Add2Curried: V2.Vector2 = V2.add(Native2)(Native2);
const Add2Piped: V2.Vector2 = pipe(Native2, V2.add(Native2));
const Subtract2Direct: V2.Vector2 = V2.subtract(Native2, Native2);
const Subtract2Curried: V2.Vector2 = V2.subtract(Native2)(Native2);
const Subtract2Piped: V2.Vector2 = pipe(Native2, V2.subtract(Native2));
const Multiply2Direct: V2.Vector2 = V2.multiply(Native2, Native2);
const Multiply2Curried: V2.Vector2 = V2.multiply(Native2)(Native2);
const Multiply2Piped: V2.Vector2 = pipe(Native2, V2.multiply(Native2));
const Min2Direct: V2.Vector2 = V2.min(Native2, Native2);
const Min2Curried: V2.Vector2 = V2.min(Native2)(Native2);
const Min2Piped: V2.Vector2 = pipe(Native2, V2.min(Native2));
const Max2Direct: V2.Vector2 = V2.max(Native2, Native2);
const Max2Curried: V2.Vector2 = V2.max(Native2)(Native2);
const Max2Piped: V2.Vector2 = pipe(Native2, V2.max(Native2));
const Dot2: number = V2.dot(Native2, Native2);
const Dot2Piped: number = pipe(Native2, V2.dot(Native2));
const Distance2: number = V2.distance(Native2, Native2);
const Distance2Piped: number = pipe(Native2, V2.distance(Native2));
const Equals2: boolean = V2.equals(Native2, Native2);
const Equals2Piped: boolean = pipe(Native2, V2.equals(Native2));
const Magnitude2: number = V2.magnitude(Native2);
const Magnitudesquared2: number = V2.magnitudeSquared(Native2);
const Isfinite2: boolean = V2.isFinite(Native2);
const Floor2: V2.Vector2 = V2.floor(Native2);
const Ceil2: V2.Vector2 = V2.ceil(Native2);
const Normalize2: Option.Option<V2.Vector2> = V2.normalize(Native2);
const Scale2: V2.Vector2 = V2.scale(Native2, 2);
const Scale2Piped: V2.Vector2 = pipe(Native2, V2.scale(2));
const Lerp2: V2.Vector2 = V2.lerp(Native2, Native2, 0.5);
const Lerp2Piped: V2.Vector2 = pipe(Native2, V2.lerp(Native2, 0.5));
const Slerp2: Option.Option<V2.Vector2> = V2.slerp(Native2, Native2, 0.5);
const Slerp2Piped: Option.Option<V2.Vector2> = pipe(Native2, V2.slerp(Native2, 0.5));
const Clamp2: V2.Vector2 = V2.clamp(Native2, { min: { x: 0 } });
const ClampPipe2: V2.Vector2 = pipe(Native2, V2.clamp({ max: { y: 1 } }));
const Formatted2: string = V2.format(Native2);
const FormatPipe2: string = pipe(Native2, V2.format({ decimals: 2 }));
const Parsed2: Option.Option<V2.Vector2> = V2.parse(V2.toString(Native2));
const ParsePipe2: Option.Option<V2.Vector2> = pipe("1|2", V2.fromString({ delimiter: "|" }));
const Enriched2: V2.Vector2 = V2.Vector2Unsafe(1, 1);
const MethodPipe2: string = Enriched2.pipe((value) => value.x, (value) => String(value));
// @ts-expect-error Enriched values require protocols beyond raw coordinates.
const MissingProtocols2: V2.Vector2 = Native2;
// @ts-expect-error Coordinates on enriched values are readonly.
Enriched2.x = 5;
// @ts-expect-error Partial addition still rejects unsupported coordinate names.
V2.add(Native2, { missing: 1 });
// @ts-expect-error Scaling requires numeric operands.
V2.scale(Native2, "2");
// @ts-expect-error Partial normalization must be unwrapped.
const UnsafeNormalize2: V2.Vector2 = V2.normalize(Native2);
const Add3Direct: V3.Vector3 = V3.add(Native3, Native3);
const Add3Curried: V3.Vector3 = V3.add(Native3)(Native3);
const Add3Piped: V3.Vector3 = pipe(Native3, V3.add(Native3));
const Subtract3Direct: V3.Vector3 = V3.subtract(Native3, Native3);
const Subtract3Curried: V3.Vector3 = V3.subtract(Native3)(Native3);
const Subtract3Piped: V3.Vector3 = pipe(Native3, V3.subtract(Native3));
const Multiply3Direct: V3.Vector3 = V3.multiply(Native3, Native3);
const Multiply3Curried: V3.Vector3 = V3.multiply(Native3)(Native3);
const Multiply3Piped: V3.Vector3 = pipe(Native3, V3.multiply(Native3));
const Min3Direct: V3.Vector3 = V3.min(Native3, Native3);
const Min3Curried: V3.Vector3 = V3.min(Native3)(Native3);
const Min3Piped: V3.Vector3 = pipe(Native3, V3.min(Native3));
const Max3Direct: V3.Vector3 = V3.max(Native3, Native3);
const Max3Curried: V3.Vector3 = V3.max(Native3)(Native3);
const Max3Piped: V3.Vector3 = pipe(Native3, V3.max(Native3));
const Cross3Direct: V3.Vector3 = V3.cross(Native3, Native3);
const Cross3Curried: V3.Vector3 = V3.cross(Native3)(Native3);
const Cross3Piped: V3.Vector3 = pipe(Native3, V3.cross(Native3));
const Dot3: number = V3.dot(Native3, Native3);
const Dot3Piped: number = pipe(Native3, V3.dot(Native3));
const Distance3: number = V3.distance(Native3, Native3);
const Distance3Piped: number = pipe(Native3, V3.distance(Native3));
const Equals3: boolean = V3.equals(Native3, Native3);
const Equals3Piped: boolean = pipe(Native3, V3.equals(Native3));
const Magnitude3: number = V3.magnitude(Native3);
const Magnitudesquared3: number = V3.magnitudeSquared(Native3);
const Isfinite3: boolean = V3.isFinite(Native3);
const Floor3: V3.Vector3 = V3.floor(Native3);
const Ceil3: V3.Vector3 = V3.ceil(Native3);
const Normalize3: Option.Option<V3.Vector3> = V3.normalize(Native3);
const Scale3: V3.Vector3 = V3.scale(Native3, 2);
const Scale3Piped: V3.Vector3 = pipe(Native3, V3.scale(2));
const Rotatex3: V3.Vector3 = V3.rotateX(Native3, 2);
const Rotatex3Piped: V3.Vector3 = pipe(Native3, V3.rotateX(2));
const Rotatey3: V3.Vector3 = V3.rotateY(Native3, 2);
const Rotatey3Piped: V3.Vector3 = pipe(Native3, V3.rotateY(2));
const Rotatez3: V3.Vector3 = V3.rotateZ(Native3, 2);
const Rotatez3Piped: V3.Vector3 = pipe(Native3, V3.rotateZ(2));
const Lerp3: V3.Vector3 = V3.lerp(Native3, Native3, 0.5);
const Lerp3Piped: V3.Vector3 = pipe(Native3, V3.lerp(Native3, 0.5));
const Slerp3: Option.Option<V3.Vector3> = V3.slerp(Native3, Native3, 0.5);
const Slerp3Piped: Option.Option<V3.Vector3> = pipe(Native3, V3.slerp(Native3, 0.5));
const Clamp3: V3.Vector3 = V3.clamp(Native3, { min: { x: 0 } });
const ClampPipe3: V3.Vector3 = pipe(Native3, V3.clamp({ max: { y: 1 } }));
const Formatted3: string = V3.format(Native3);
const FormatPipe3: string = pipe(Native3, V3.format({ decimals: 2 }));
const Parsed3: Option.Option<V3.Vector3> = V3.parse(V3.toString(Native3));
const ParsePipe3: Option.Option<V3.Vector3> = pipe("1|2|3", V3.fromString({ delimiter: "|" }));
const Enriched3: V3.Vector3 = V3.Vector3Unsafe(1, 1, 1);
const MethodPipe3: string = Enriched3.pipe((value) => value.x, (value) => String(value));
// @ts-expect-error Enriched values require protocols beyond raw coordinates.
const MissingProtocols3: V3.Vector3 = Native3;
// @ts-expect-error Coordinates on enriched values are readonly.
Enriched3.x = 5;
// @ts-expect-error Partial addition still rejects unsupported coordinate names.
V3.add(Native3, { missing: 1 });
// @ts-expect-error Scaling requires numeric operands.
V3.scale(Native3, "2");
// @ts-expect-error Partial normalization must be unwrapped.
const UnsafeNormalize3: V3.Vector3 = V3.normalize(Native3);
// @ts-expect-error Three-dimensional operations require z.
V3.cross(Native2, Native3);
// @ts-expect-error Enriched spatial kinds remain distinct.
const WrongKind: V2.Vector2 = V3.Zero;
// @ts-expect-error Constructor arguments are positional numeric components.
V3.Vector3({ x: 1,
    y: 2,
    z: 3 });
