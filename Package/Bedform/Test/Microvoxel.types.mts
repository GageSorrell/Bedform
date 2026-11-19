/**
 * Microvoxel declarations: Bedrock Vector3 compatibility, branded coordinates, addressing and dual inference.
 *
 * @module bedform/Test/Microvoxel.types
 *
 * @file      Microvoxel.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Public fixtures retain contextual inference and intentional negative uses. */
/* eslint-disable @typescript-eslint/no-unused-vars, sort-imports */

import { AABB as B, Microvoxel as M, Vector3 as V, Voxel as X } from "bedform";
import type * as Direct from "bedform/Microvoxel";
import * as Int from "@bedform/effect/Int";
import type * as Meter from "@bedform/effect/Unit/Meter";
import * as O from "@bedform/effect/Option";
import { pipe } from "@bedform/effect/Function";
import { Direction } from "@minecraft/server";
import type { BlockRaycastHit, Vector3 } from "@minecraft/server";

declare const Hit: BlockRaycastHit;
const Value: Direct.Microvoxel = M.MicrovoxelUnsafe(0.0625, 0, 0);
const Constructed: O.Option<M.Microvoxel> = M.Microvoxel(0.0625, 0, 0);
const Floored: O.Option<M.Microvoxel> = M.fromPoint(Hit.faceLocation);
const FromSteps: O.Option<M.Microvoxel> = M.fromSteps(M.steps(Value));
const FromVoxel: O.Option<M.Microvoxel> = M.fromVoxel(X.Origin, { x: 3,
    y: 0,
    z: 15 });
const FromLocal: M.Microvoxel = M.fromVoxelUnsafe(X.Origin, M.local(Value));
const FromIndex: O.Option<M.Microvoxel> = M.fromIndex(X.Origin, 4095);

const AsBedrock: Vector3 = Value;
const AsMeter: Meter.Meter = Value.x;
const AsNumber: number = Value.y;
const AsCoordinates: V.Coordinates = Value;
const Block: X.Voxel = M.voxel(Value);
const Local: M.Local = M.local(Value);
const LocalInt: Int.Int = Local.x;
const Steps: M.Steps = M.steps(Value);
const StepInt: Int.Int = Steps.z;
const MicrovoxelId: typeof M.TypeId = Value[M.TypeId];
const LocalId: typeof M.LocalTypeId = Local[M.LocalTypeId];
const StepsId: typeof M.StepsTypeId = Steps[M.StepsTypeId];
// @ts-expect-error Local coordinates and global steps have distinct type IDs.
const LocalAsSteps: M.Steps = Local;
// @ts-expect-error Global steps and local coordinates have distinct type IDs.
const StepsAsLocal: M.Local = Steps;
// @ts-expect-error Integer coordinates alone do not carry the Steps type ID.
const UnbrandedSteps: M.Steps = { x: Int.zero,
    y: Int.zero,
    z: Int.zero };
// @ts-expect-error Integer coordinates alone do not carry the Local type ID.
const UnbrandedLocal: M.Local = { x: Int.zero,
    y: Int.zero,
    z: Int.zero };
const StepsAsOffset: X.Offset = Steps;
const Index: Int.Int = M.index(Value);
const Size: Meter.Meter = M.Size;
const Resolution: Int.Int = M.Resolution;
const PerVoxel: Int.Int = M.PerVoxel;

const Offset: M.Microvoxel = M.offset(Value, { x: Int.one });
const OffsetPipe: M.Microvoxel = pipe(Value, M.offset({ z: Int.one }));
const Neighbor: M.Microvoxel = M.neighbor(Value, Hit.face);
const NeighborFar: M.Microvoxel = M.neighbor(Value, Direction.Up, M.Resolution);
const NeighborPipe: M.Microvoxel = pipe(Value, M.neighbor(X.Face.Down));
const All: Iterable<M.Microvoxel> = M.inVoxel(Block);
const Box: Iterable<M.Microvoxel> = M.box(Value, Value);
const BoxPipe: Iterable<M.Microvoxel> = pipe(Value, M.box(Value));
const Walk: Iterable<M.Step> = M.traverse(Hit.faceLocation, V.One);
const WalkPipe: Iterable<M.Step> = pipe(V.Zero, M.traverse(V.One));
const StepFace: O.Option<X.Face> = Array.from(Walk)[0].face;
const StepCell: M.Microvoxel = Array.from(Walk)[0].microvoxel;
const Same: boolean = M.Equivalence(Value, Value);
const Sorted: Array<M.Microvoxel> = [ Value ].sort(M.Order);
const Key: string = M.key(Value);
const Parsed: O.Option<M.Microvoxel> = M.fromKey(Key);
const Center: V.Vector3 = M.center(Value);
const Bounds: B.AABB = M.bounds(Value);

const PlainObject = { x: 0.0625,
    y: 0,
    z: 0 } as const;
// @ts-expect-error A plain object of numbers is not a Microvoxel.
const Plain: M.Microvoxel = PlainObject;
// @ts-expect-error A Bedrock Vector3 is not a Microvoxel; use fromPoint.
const Unfloored: M.Microvoxel = Hit.faceLocation;
// @ts-expect-error A Microvoxel is not a whole-block Voxel.
const NotVoxel: X.Voxel = Value;
// @ts-expect-error Offsets are Ints, not plain numbers.
const PlainOffset: M.Microvoxel = M.offset(Value, { x: 1 });
// @ts-expect-error Microvoxel coordinates are read-only.
Value.x = Value.y;
