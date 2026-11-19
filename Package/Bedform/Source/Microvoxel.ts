/**
 * Sixteenth-of-a-block lattice coordinates in meters, with local and global
 * addressing, faces, boxes and segment traversal.
 *
 * A `Microvoxel` is a plain frozen `{ x, y, z }` at the minimum corner of a
 * 1/16 m cube. Each coordinate is a `Meter` that is a whole multiple of
 * 0.0625, which binary floating point represents exactly, so a microvoxel can
 * be passed wherever Bedrock expects a `Vector3`. Within its block a
 * microvoxel has `Local` coordinates 0..15 and an `index` 0..4095; across the
 * world it has global integer `steps`, its coordinates times 16. Faces are
 * `bedform/Voxel` faces, and point-valued results are `bedform/Vector3` and
 * `bedform/AABB` values.
 *
 * @module bedform/Microvoxel
 *
 * @file      Microvoxel.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Document exported variables at their export declaration. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as B from "./AABB.js";
import * as Equ from "@bedform/effect/Equivalence";
import * as Int from "@bedform/effect/Int";
import type * as Meter from "@bedform/effect/Unit/Meter";
import * as Option from "@bedform/effect/Option";
import * as Ord from "@bedform/effect/Order";
import * as V from "./Vector3.js";
import * as X from "./Voxel.js";
import { dual } from "@bedform/effect/Function";

/**
 * Identifies microvoxel values by a unique symbol key and value.
 *
 * @category TypeID
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for("~bedform/Microvoxel");

/**
 * Identifies local microvoxel coordinates by a unique symbol key and value.
 *
 * @category TypeID
 * @since 1.0.0
 */
export const LocalTypeId: unique symbol = Symbol.for("~bedform/Microvoxel/Local");

/**
 * Identifies global microvoxel steps by a unique symbol key and value.
 *
 * @category TypeID
 * @since 1.0.0
 */
export const StepsTypeId: unique symbol = Symbol.for("~bedform/Microvoxel/Steps");

/**
 * A 1/16 m lattice cell, addressed by its minimum corner in meters. Every
 * coordinate is a whole multiple of `Size`. It is a plain frozen object and
 * is assignable to Bedrock's `Vector3`.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Microvoxel
{
    readonly [TypeId]: typeof TypeId;
    readonly x: Meter.Meter;
    readonly y: Meter.Meter;
    readonly z: Meter.Meter;
}

/**
 * A microvoxel's position inside its block, in microvoxel steps from the
 * block's minimum corner. Each coordinate is in 0..15.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Local
{
    readonly [LocalTypeId]: typeof LocalTypeId;
    readonly x: Int.Int;
    readonly y: Int.Int;
    readonly z: Int.Int;
}

/**
 * A microvoxel's global position in microvoxel steps: its coordinates in
 * meters times `Resolution`.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Steps
{
    readonly [StepsTypeId]: typeof StepsTypeId;
    readonly x: Int.Int;
    readonly y: Int.Int;
    readonly z: Int.Int;
}

/**
 * One microvoxel visited by `traverse`, with the face through which the
 * segment entered it. The first microvoxel, which holds the segment's start,
 * has no entry face.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Step
{
    readonly face: Option.Option<X.Face>;
    readonly microvoxel: Microvoxel;
}

/**
 * Binary operations callable data-first or data-last.
 *
 * @category Types
 * @since 1.0.0
 */
interface Binary<Self, That, Value>
{
    (that: That): (self: Self) => Value;
    (self: Self, that: That): Value;
}

/**
 * Builds a binary dual operation.
 *
 * @category Internal
 * @since 1.0.0
 */
const binary = <Self, That, Value>(body: (self: Self, that: That) => Value): Binary<Self, That, Value> =>
{
    return dual(2, body);
};

/**
 * Microvoxels along each edge of a block.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Resolution: Int.Int = Int.makeUnsafe(16);

/**
 * The edge length of a microvoxel, 1/16 m.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Size: Meter.Meter = 0.0625 as Meter.Meter;

/**
 * Microvoxels in one block, 16³.
 *
 * @category Constants
 * @since 1.0.0
 */
export const PerVoxel: Int.Int = Int.makeUnsafe(4_096);

/**
 * Brands global steps, already checked to be safe integers, as a frozen
 * microvoxel. Division by 16 is exact, and negative zero is normalized.
 *
 * @category Internal
 * @since 1.0.0
 */
const ofSteps = (x: number, y: number, z: number): Microvoxel =>
{
    return Object.freeze({
        [TypeId]: TypeId as typeof TypeId,
        x: (x / 16 + 0) as Meter.Meter,
        y: (y / 16 + 0) as Meter.Meter,
        z: (z / 16 + 0) as Meter.Meter
    });
};

/**
 * Checks that a computed step coordinate is still a safe integer.
 *
 * @throws { RangeError } When the coordinate leaves the safe integer range.
 * @category Internal
 * @since 1.0.0
 */
const checked = (value: number, operation: string): number =>
{
    if (!Number.isSafeInteger(value))
    {
        throw new RangeError(`Microvoxel.${operation}: ${value} steps is not a safe integer`);
    }

    return value;
};

/**
 * Checks whether a number is a local coordinate, an integer in 0..15.
 *
 * @category Internal
 * @since 1.0.0
 */
const isLocalCoordinate = (value: number): boolean =>
{
    return Number.isInteger(value) && value >= 0 && value < 16;
};

/**
 * Checks whether a value carries the microvoxel type ID as both key and
 * value, with `x`, `y` and `z` coordinates that are whole multiples of 1/16
 * whose step counts are safe integers.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isMicrovoxel = (input: unknown): input is Microvoxel =>
{
    if (typeof input !== "object" || input === null || !(TypeId in input) || input[TypeId] !== TypeId)
    {
        return false;
    }

    const value = input as Partial<Record<X.Axis, unknown>>;
    return [ value.x, value.y, value.z ].every((coordinate: unknown): boolean =>
        typeof coordinate === "number" && Number.isSafeInteger(coordinate * 16));
};

/**
 * Constructs a microvoxel from coordinates in meters. It never rounds: a
 * coordinate that is not a whole multiple of 1/16, is non-finite, or whose
 * step count is unsafe yields `Option.none()`. Use `fromPoint` to find the
 * microvoxel that contains a point.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Microvoxel = (x: number, y: number, z: number): Option.Option<Microvoxel> =>
{
    return fromSteps({
        x: x * 16,
        y: y * 16,
        z: z * 16
    });
};

/**
 * Constructs a microvoxel from coordinates in meters without rounding.
 *
 * @throws { RangeError } When a coordinate is not a whole multiple of 1/16,
 * is non-finite, or has an unsafe step count.
 * @category Constructors
 * @since 1.0.0
 */
export const MicrovoxelUnsafe = (x: number, y: number, z: number): Microvoxel =>
{
    return ofSteps(
        checked(x * 16, "MicrovoxelUnsafe"),
        checked(y * 16, "MicrovoxelUnsafe"),
        checked(z * 16, "MicrovoxelUnsafe")
    );
};

/**
 * Constructs a microvoxel from global steps, which must be safe integers.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromSteps = (steps: V.Coordinates): Option.Option<Microvoxel> =>
{
    return Number.isSafeInteger(steps.x) && Number.isSafeInteger(steps.y) && Number.isSafeInteger(steps.z)
        ? Option.some(ofSteps(steps.x, steps.y, steps.z))
        : Option.none();
};

/**
 * Returns the microvoxel's global position in steps, its coordinates times 16.
 *
 * @category Queries
 * @since 1.0.0
 */
export const steps = (self: Microvoxel): Steps =>
{
    return Object.freeze({
        [StepsTypeId]: StepsTypeId as typeof StepsTypeId,
        x: (self.x * 16 + 0) as Int.Int,
        y: (self.y * 16 + 0) as Int.Int,
        z: (self.z * 16 + 0) as Int.Int
    });
};

/**
 * Returns the microvoxel that contains a point, flooring each coordinate to
 * the 1/16 m lattice, so −0.01 lies in the microvoxel at −0.0625. A point on
 * a boundary belongs to the microvoxel on its positive side. Non-finite
 * points, and points whose step counts are unsafe, yield `Option.none()`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromPoint = (point: V.Coordinates): Option.Option<Microvoxel> =>
{
    return fromSteps({
        x: Math.floor(point.x * 16),
        y: Math.floor(point.y * 16),
        z: Math.floor(point.z * 16)
    });
};

/**
 * Returns the microvoxel at local coordinates inside a block. Each local
 * coordinate must be an integer in 0..15; anything else yields
 * `Option.none()`, as does a block whose microvoxels have unsafe step counts.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromVoxel = (voxel: X.Voxel, local: V.Coordinates): Option.Option<Microvoxel> =>
{
    if (!isLocalCoordinate(local.x) || !isLocalCoordinate(local.y) || !isLocalCoordinate(local.z))
    {
        return Option.none();
    }

    return fromSteps({
        x: voxel.x * 16 + local.x,
        y: voxel.y * 16 + local.y,
        z: voxel.z * 16 + local.z
    });
};

/**
 * Returns the microvoxel at local coordinates inside a block.
 *
 * @throws { RangeError } When a local coordinate is not an integer in 0..15,
 * or the result has an unsafe step count.
 * @category Constructors
 * @since 1.0.0
 */
export const fromVoxelUnsafe = (voxel: X.Voxel, local: V.Coordinates): Microvoxel =>
{
    return Option.getOrThrowWith(
        fromVoxel(voxel, local),
        () => new RangeError("Microvoxel.fromVoxelUnsafe: "
            + `local ${local.x},${local.y},${local.z} is outside 0..15 or the result is unsafe`)
    );
};

/**
 * Returns the microvoxel with a given `index` inside a block. The index must
 * be an integer in 0..4095; anything else yields `Option.none()`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromIndex = (voxel: X.Voxel, index: number): Option.Option<Microvoxel> =>
{
    if (!Number.isInteger(index) || index < 0 || index >= 4_096)
    {
        return Option.none();
    }

    return fromVoxel(voxel, {
        x: index % 16,
        y: Math.floor(index / 256),
        z: Math.floor(index / 16) % 16
    });
};

/**
 * Splits a step coordinate into its block coordinate and local coordinate.
 *
 * @category Internal
 * @since 1.0.0
 */
const split = (step: number): readonly [number, number] =>
{
    const block = Math.floor(step / 16);
    return [ block, step - block * 16 ];
};

/**
 * Returns the block that contains the microvoxel.
 *
 * @category Queries
 * @since 1.0.0
 */
export const voxel = (self: Microvoxel): X.Voxel =>
{
    const position = steps(self);
    return X.VoxelUnsafe(split(position.x)[0], split(position.y)[0], split(position.z)[0]);
};

/**
 * Returns the microvoxel's position inside its block, each coordinate in
 * 0..15.
 *
 * @category Queries
 * @since 1.0.0
 */
export const local = (self: Microvoxel): Local =>
{
    const position = steps(self);
    return Object.freeze({
        [LocalTypeId]: LocalTypeId as typeof LocalTypeId,
        x: split(position.x)[1] as Int.Int,
        y: split(position.y)[1] as Int.Int,
        z: split(position.z)[1] as Int.Int
    });
};

/**
 * Returns the microvoxel's index inside its block, `x + 16 * (z + 16 * y)`
 * of its local coordinates, in 0..4095. It increases in canonical order.
 *
 * @category Queries
 * @since 1.0.0
 */
export const index = (self: Microvoxel): Int.Int =>
{
    const position = local(self);
    return (position.x + 16 * (position.z + 16 * position.y)) as Int.Int;
};

/**
 * Moves a microvoxel by whole microvoxel steps, not meters; omitted axes do
 * not move.
 *
 * @throws { RangeError } When a result has an unsafe step count.
 * @category Operation
 * @since 1.0.0
 */
export const offset: Binary<Microvoxel, Partial<X.Offset>, Microvoxel> = binary(
    (self: Microvoxel, that: Partial<X.Offset>): Microvoxel =>
    {
        const position = steps(self);
        return ofSteps(
            checked(position.x + (that.x ?? 0), "offset"),
            checked(position.y + (that.y ?? 0), "offset"),
            checked(position.z + (that.z ?? 0), "offset")
        );
    }
);

/**
 * Returns the microvoxel `distance` steps past the given face, one step by
 * default. A negative distance moves through the opposite face.
 *
 * @throws { RangeError } When the result has an unsafe step count.
 * @category Operation
 * @since 1.0.0
 */
export const neighbor: {
    (face: X.Face, distance?: Int.Int): (self: Microvoxel) => Microvoxel;
    (self: Microvoxel, face: X.Face, distance?: Int.Int): Microvoxel;
} = dual((args: IArguments): boolean => typeof args[0] === "object",
    (self: Microvoxel, face: X.Face, distance: Int.Int = Int.one): Microvoxel =>
    {
        const normal = X.faceNormal(face);
        return offset(self, {
            x: (normal.x * distance + 0) as Int.Int,
            y: (normal.y * distance + 0) as Int.Int,
            z: (normal.z * distance + 0) as Int.Int
        });
    });

/**
 * Wraps a factory of fresh iterators as a re-iterable value.
 *
 * @category Internal
 * @since 1.0.0
 */
const iterable = <A>(make: () => Iterator<A>): Iterable<A> =>
{
    return Object.freeze({ [Symbol.iterator]: make });
};

/**
 * The components of a step-space voxel, as arguments for `ofSteps`.
 *
 * @category Internal
 * @since 1.0.0
 */
const stepsOf = (position: X.Voxel): [number, number, number] =>
{
    return [ position.x, position.y, position.z ];
};

/**
 * Lazily converts step-space voxels, as yielded by `bedform/Voxel`, into
 * microvoxels.
 *
 * @category Internal
 * @since 1.0.0
 */
const fromStepVoxels = (voxels: Iterable<X.Voxel>): Iterable<Microvoxel> =>
{
    return iterable((): Iterator<Microvoxel> =>
    {
        const source = voxels[Symbol.iterator]();
        return {
            next: (): IteratorResult<Microvoxel> =>
            {
                const result = source.next();
                return result.done === true
                    ? result
                    : {
                        done: false,
                        value: ofSteps(result.value.x, result.value.y, result.value.z)
                    };
            }
        };
    });
};

/**
 * Treats a microvoxel's global steps as a voxel, to reuse voxel algorithms on
 * the finer lattice.
 *
 * @category Internal
 * @since 1.0.0
 */
const stepVoxel = (self: Microvoxel): X.Voxel =>
{
    const position = steps(self);
    return X.VoxelUnsafe(position.x, position.y, position.z);
};

/**
 * Iterates every microvoxel in the inclusive box spanned by two corner
 * microvoxels, which may be given in any order. Microvoxels come in canonical
 * order: by y, then z, then x, each ascending. The result can be iterated
 * more than once.
 *
 * @category Operation
 * @since 1.0.0
 */
export const box: Binary<Microvoxel, Microvoxel, Iterable<Microvoxel>> = binary(
    (from: Microvoxel, to: Microvoxel): Iterable<Microvoxel> =>
        fromStepVoxels(X.box(stepVoxel(from), stepVoxel(to)))
);

/**
 * Iterates all 4096 microvoxels of a block in index order, which is also
 * canonical order. The result can be iterated more than once.
 *
 * @throws { RangeError } When the block's microvoxels have unsafe step counts.
 * @category Operation
 * @since 1.0.0
 */
export const inVoxel = (voxel: X.Voxel): Iterable<Microvoxel> =>
{
    const first = fromVoxelUnsafe(voxel, V.Zero);
    const last = fromVoxelUnsafe(voxel, {
        x: 15,
        y: 15,
        z: 15
    });
    return box(first, last);
};

/**
 * Scales a point from meters to steps. Multiplying by 16 is exact.
 *
 * @category Internal
 * @since 1.0.0
 */
const toSteps = (point: V.Coordinates): V.Coordinates =>
{
    return Object.freeze({
        x: point.x * 16,
        y: point.y * 16,
        z: point.z * 16
    });
};

/**
 * Walks the microvoxels crossed by the segment from one point to another,
 * with the Amanatides–Woo algorithm on the 1/16 m lattice. It behaves as
 * `bedform/Voxel`'s `traverse` does at 16 times the scale: it starts with the
 * microvoxel holding `from`, ends with the one holding `to`, each later
 * microvoxel shares the face `Step.face` with the one before it, and exact
 * edge or corner crossings step x before y before z. The points are read
 * once, when `traverse` is called, and the result can be iterated more than
 * once.
 *
 * @throws { RangeError } When either point is non-finite or has an unsafe
 * step count.
 * @category Operation
 * @since 1.0.0
 */
export const traverse: Binary<V.Coordinates, V.Coordinates, Iterable<Step>> = binary(
    (from: V.Coordinates, to: V.Coordinates): Iterable<Step> =>
    {
        if (Option.isNone(fromPoint(from)) || Option.isNone(fromPoint(to)))
        {
            throw new RangeError("Microvoxel.traverse: both points must be finite with safe step counts");
        }

        const walk = X.traverse(toSteps(from), toSteps(to));
        return iterable((): Iterator<Step> =>
        {
            const source = walk[Symbol.iterator]();
            return {
                next: (): IteratorResult<Step> =>
                {
                    const result = source.next();
                    return result.done === true
                        ? result
                        : {
                            done: false,
                            value: Object.freeze({
                                face: result.value.face,
                                microvoxel: ofSteps(...stepsOf(result.value.voxel))
                            })
                        };
                }
            };
        });
    }
);

/**
 * Equality of microvoxels by coordinates.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<Microvoxel> = Equ.make(
    (self: Microvoxel, that: Microvoxel): boolean =>
        self.x === that.x && self.y === that.y && self.z === that.z
);

/**
 * Checks whether two microvoxels have the same coordinates.
 *
 * @category Instances
 * @since 1.0.0
 */
export const equals: Binary<Microvoxel, Microvoxel, boolean> = binary(
    (self: Microvoxel, that: Microvoxel): boolean => Equivalence(self, that)
);

/**
 * The canonical order of microvoxels, the order in which `box` yields them:
 * by y, then z, then x.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<Microvoxel> = Ord.make(
    (self: Microvoxel, that: Microvoxel): -1 | 0 | 1 =>
    {
        const difference = self.y - that.y || self.z - that.z || self.x - that.x;
        return difference < 0 ? -1 : difference > 0 ? 1 : 0;
    }
);

/**
 * A string key for maps and sets made of the global steps, `"x,y,z"`; the
 * microvoxel at 0.0625, 4, −0.125 has key `"1,64,-2"`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const key = (self: Microvoxel): string =>
{
    const position = steps(self);
    return `${position.x},${position.y},${position.z}`;
};

/**
 * Parses a key made by `key`. Anything else, including spaces, plus signs,
 * leading zeros, `-0` and unsafe integers, yields `Option.none()`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromKey = (input: string): Option.Option<Microvoxel> =>
{
    return Option.map(X.fromKey(input), (position: X.Voxel): Microvoxel =>
        ofSteps(position.x, position.y, position.z));
};

/**
 * The point at the center of the microvoxel.
 *
 * @category Geometry
 * @since 1.0.0
 */
export const center = (self: Microvoxel): V.Vector3 =>
{
    const half = Size / 2;
    return V.Vector3Unsafe(self.x + half, self.y + half, self.z + half);
};

/**
 * The microvoxel's 1/16 m cube, from its minimum corner to the opposite
 * corner.
 *
 * @category Geometry
 * @since 1.0.0
 */
export const bounds = (self: Microvoxel): B.AABB =>
{
    const position = steps(self);
    return B.AABBUnsafe(self, {
        x: (position.x + 1) / 16,
        y: (position.y + 1) / 16,
        z: (position.z + 1) / 16
    });
};
