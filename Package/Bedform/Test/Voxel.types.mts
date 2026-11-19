/**
 * Voxel declarations: Bedrock Vector3 and Direction compatibility, branded coordinates and dual inference.
 *
 * @module bedform/Test/Voxel.types
 *
 * @file      Voxel.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports */

import { AABB as B, Vector3 as V, Voxel as X } from "bedform";
import type * as Direct from "bedform/Voxel";
import * as Int from "@bedform/effect/Int";
import type * as Meter from "@bedform/effect/Unit/Meter";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
import { Direction } from "@minecraft/server";
import type { BlockRaycastHit, Vector3 } from "@minecraft/server";

declare const Hit: BlockRaycastHit;
const Value: Direct.Voxel = X.VoxelUnsafe(1, 2, 3);
const Constructed: O.Option<X.Voxel> = X.Voxel(1, 2, 3);
const Floored: O.Option<X.Voxel> = X.fromPoint({ x: 0.5,
    y: -0.5,
    z: 2 });
const FromBedrock: O.Option<X.Voxel> = X.fromPoint(Hit.block.location);
const FromVector: O.Option<X.Voxel> = X.fromPoint(V.One);

const AsBedrock: Vector3 = Value;
const Component: Vector3["x"] = Value.x;
const AsMeter: Meter.Meter<Int.Int> = Value.y;
const AsInt: Int.Int = Value.z;
const AsCoordinates: V.Coordinates = Value;
const AsOffset: X.Offset = Value;

const FaceFromDirection: X.Face = Direction.Up;
const FaceFromHit: X.Face = Hit.face;
const DirectionString: `${Direction.East}` = X.Face.East;
const Normal: V.Vector3 = X.faceNormal(Direction.North);
const Axis: X.Axis = X.faceAxis(X.Face.West);
const Opposite: X.Face = X.opposite(Direction.South);
const FromNormal: O.Option<X.Face> = X.fromNormal(V.Up);
const Faces: ReadonlyArray<X.Face> = X.Faces;

const Added: X.Voxel = X.add(Value, { x: Int.one });
const AddedPipe: X.Voxel = pipe(Value, X.add({ y: Int.one }));
const Subtracted: X.Voxel = X.subtract(Value, Value);
const Neighbor: X.Voxel = X.neighbor(Value, Hit.face);
const NeighborFar: X.Voxel = X.neighbor(Value, Direction.Down, Int.makeUnsafe(3));
const NeighborPipe: X.Voxel = pipe(Value, X.neighbor(X.Face.Up));
const Around: ReadonlyArray<X.Voxel> = X.neighbors(Value, 26);
const Box: Iterable<X.Voxel> = X.box(Value, X.Origin);
const BoxPipe: Iterable<X.Voxel> = pipe(Value, X.box(X.Origin));
const Steps: Iterable<X.Step> = X.traverse(Hit.block.location, V.One);
const StepsPipe: Iterable<X.Step> = pipe(V.Zero, X.traverse(V.One));
const StepFace: O.Option<X.Face> = Array.from(Steps)[0].face;
const Manhattan: Int.Int = X.distanceManhattan(Value, X.Origin);
const Chebyshev: Int.Int = pipe(Value, X.distanceChebyshev(X.Origin));
const Euclidean: number = X.distance(Value, X.Origin);
const Same: boolean = X.Equivalence(Value, X.Origin);
const Sorted: Array<X.Voxel> = [ Value ].sort(X.Order);
const Key: string = X.key(Value);
const Parsed: O.Option<X.Voxel> = X.fromKey(Key);
const Center: V.Vector3 = X.center(Value);
const Bounds: B.AABB = X.bounds(Value);

const PlainObject = { x: 1,
    y: 2,
    z: 3 } as const;
// @ts-expect-error A plain object of numbers is not a Voxel.
const Plain: X.Voxel = PlainObject;
// @ts-expect-error A Bedrock Vector3 is not a Voxel; use fromPoint.
const Unfloored: X.Voxel = Hit.block.location;
// @ts-expect-error Offsets are Ints, not plain numbers.
const PlainOffset: X.Voxel = X.add(Value, { x: 1 });
// @ts-expect-error A Face is a Bedrock Direction name.
const NotFace: X.Face = "Upward";
// @ts-expect-error Only 6, 18 and 26 connectivity exist.
const BadConnectivity: ReadonlyArray<X.Voxel> = X.neighbors(Value, 8);
// @ts-expect-error Voxel coordinates are read-only.
Value.x = Value.y;
// @ts-expect-error The Bedrock Direction type resolved, so West is not East.
const WrongDirection: `${Direction.East}` = X.Face.West;
