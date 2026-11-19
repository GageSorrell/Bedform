/**
 * Whole-block lattice coordinates in meters, with faces, neighbors, boxes and
 * segment traversal.
 *
 * A `Voxel` is a plain frozen `{ x, y, z }` object at a block's minimum
 * corner. Each coordinate is a `Meter<Int>`, so a voxel can be passed wherever
 * Bedrock expects a `Vector3`, while a plain object of numbers is rejected
 * where a `Voxel` is expected. `Face` names the six block faces with the same
 * strings as Bedrock's `Direction`, so either can be passed to these
 * functions. Point-valued results are `bedform/Vector3` and `bedform/AABB`
 * values; every other result is a `Voxel`.
 *
 * @module bedform/Voxel
 *
 * @file      Voxel.ts
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
import { dual } from "@bedform/effect/Function";

/**
 * A block-sized lattice cell, addressed by its minimum corner in whole
 * meters. It is a plain frozen object and is assignable to Bedrock's
 * `Vector3`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Voxel
{
    readonly x: Meter.Meter<Int.Int>;
    readonly y: Meter.Meter<Int.Int>;
    readonly z: Meter.Meter<Int.Int>;
}

/**
 * Whole-block steps along each axis. Every `Voxel` is also an `Offset`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Offset
{
    readonly x: Int.Int;
    readonly y: Int.Int;
    readonly z: Int.Int;
}

/**
 * The six block faces. Each value equals the matching Bedrock `Direction`
 * string, so `Face.Up` and `Direction.Up` are interchangeable as arguments.
 * North is −z and East is +x.
 *
 * @category Faces
 * @since 1.0.0
 */
export const Face = Object.freeze({
    Down: "Down",
    East: "East",
    North: "North",
    South: "South",
    Up: "Up",
    West: "West"
} as const);

/**
 * One of the six block face names, which are also Bedrock `Direction` values.
 *
 * @category Faces
 * @since 1.0.0
 */
export type Face = (typeof Face)[keyof typeof Face];

/**
 * Every face, in the order Up, Down, North, South, East, West.
 *
 * @category Faces
 * @since 1.0.0
 */
export const Faces: ReadonlyArray<Face> = Object.freeze([
    Face.Up, Face.Down, Face.North, Face.South, Face.East, Face.West
]);

/**
 * A coordinate axis.
 *
 * @category Faces
 * @since 1.0.0
 */
export type Axis = "x" | "y" | "z";

/**
 * How many neighbors `neighbors` returns: faces only (6), faces and edges
 * (18), or faces, edges and corners (26).
 *
 * @category Types
 * @since 1.0.0
 */
export type Connectivity = 6 | 18 | 26;

/**
 * One voxel visited by `traverse`, with the face through which the segment
 * entered it. The first voxel, which holds the segment's start, has no
 * entry face.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Step
{
    readonly face: Option.Option<Face>;
    readonly voxel: Voxel;
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
 * Per-face geometry, keyed by face name.
 *
 * @category Internal
 * @since 1.0.0
 */
interface FaceData
{
    readonly axis: Axis;
    readonly normal: V.Vector3;
    readonly opposite: Face;
    readonly sign: 1 | -1;
}

/**
 * Freezes the geometry of one face.
 *
 * @category Internal
 * @since 1.0.0
 */
const faceData = (axis: Axis, normal: V.Vector3, opposite: Face, sign: 1 | -1): FaceData =>
{
    return Object.freeze({
        axis,
        normal,
        opposite,
        sign
    });
};

/**
 * Geometry of each face.
 *
 * @category Internal
 * @since 1.0.0
 */
const FaceTable: Readonly<Record<Face, FaceData>> = Object.freeze({
    Down: faceData("y", V.Down, Face.Up, -1),
    East: faceData("x", V.East, Face.West, 1),
    North: faceData("z", V.North, Face.South, -1),
    South: faceData("z", V.South, Face.North, 1),
    Up: faceData("y", V.Up, Face.Down, 1),
    West: faceData("x", V.West, Face.East, -1)
});

/**
 * The face on the positive and negative side of each axis.
 *
 * @category Internal
 * @since 1.0.0
 */
const AxisFaces: Readonly<Record<Axis, readonly [Face, Face]>> = Object.freeze({
    x: Object.freeze([ Face.East, Face.West ] as const),
    y: Object.freeze([ Face.Up, Face.Down ] as const),
    z: Object.freeze([ Face.South, Face.North ] as const)
});

/**
 * Brands three safe integers as a frozen voxel, normalizing negative zero.
 *
 * @category Internal
 * @since 1.0.0
 */
const of = (x: number, y: number, z: number): Voxel =>
{
    return Object.freeze({
        x: (x + 0) as Meter.Meter<Int.Int>,
        y: (y + 0) as Meter.Meter<Int.Int>,
        z: (z + 0) as Meter.Meter<Int.Int>
    });
};

/**
 * Checks that a computed coordinate is still a safe integer.
 *
 * @throws { RangeError } When the coordinate leaves the safe integer range.
 * @category Internal
 * @since 1.0.0
 */
const checked = (value: number, operation: string): number =>
{
    if (!Number.isSafeInteger(value))
    {
        throw new RangeError(`Voxel.${operation}: ${value} is not a safe integer`);
    }

    return value;
};

/**
 * Returns the outward unit normal of a face as a `Vector3`.
 *
 * @category Faces
 * @since 1.0.0
 */
export const faceNormal = (face: Face): V.Vector3 =>
{
    return FaceTable[face].normal;
};

/**
 * Returns the axis a face is perpendicular to.
 *
 * @category Faces
 * @since 1.0.0
 */
export const faceAxis = (face: Face): Axis =>
{
    return FaceTable[face].axis;
};

/**
 * Returns the face on the other side of the block, such as Down for Up.
 *
 * @category Faces
 * @since 1.0.0
 */
export const opposite = (face: Face): Face =>
{
    return FaceTable[face].opposite;
};

/**
 * Returns the face whose normal points along the given vector. The vector
 * must have exactly one nonzero component, which must be finite; its length
 * does not matter. Any other vector, including zero and diagonals, yields
 * `Option.none()`.
 *
 * @category Faces
 * @since 1.0.0
 */
export const fromNormal = (normal: V.Coordinates): Option.Option<Face> =>
{
    const axes = ([ "x", "y", "z" ] as const).filter((axis: Axis): boolean => normal[axis] !== 0);
    if (axes.length !== 1)
    {
        return Option.none();
    }

    const [ axis ] = axes;
    const component = normal[axis];
    if (!Number.isFinite(component))
    {
        return Option.none();
    }

    return Option.some(AxisFaces[axis][component > 0 ? 0 : 1]);
};

/**
 * Checks whether a value is a voxel: an object whose `x`, `y` and `z` are
 * safe integers.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isVoxel = (input: unknown): input is Voxel =>
{
    if (typeof input !== "object" || input === null)
    {
        return false;
    }

    const value = input as Partial<Record<Axis, unknown>>;
    return Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y) && Number.isSafeInteger(value.z);
};

/**
 * Constructs a voxel from three safe integers. It never rounds: a fractional,
 * non-finite or unsafe coordinate yields `Option.none()`. Use `fromPoint` to
 * find the voxel that contains a point.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Voxel = (x: number, y: number, z: number): Option.Option<Voxel> =>
{
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) && Number.isSafeInteger(z)
        ? Option.some(of(x, y, z))
        : Option.none();
};

/**
 * Constructs a voxel from three safe integers without rounding.
 *
 * @throws { RangeError } When a coordinate is fractional, non-finite or unsafe.
 * @category Constructors
 * @since 1.0.0
 */
export const VoxelUnsafe = (x: number, y: number, z: number): Voxel =>
{
    return of(checked(x, "VoxelUnsafe"), checked(y, "VoxelUnsafe"), checked(z, "VoxelUnsafe"));
};

/**
 * Returns the voxel that contains a point, flooring each coordinate, so
 * −0.5 lies in voxel −1. A point on a boundary belongs to the voxel on its
 * positive side. Non-finite points, and points beyond the safe integer
 * range, yield `Option.none()`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fromPoint = (point: V.Coordinates): Option.Option<Voxel> =>
{
    return Voxel(Math.floor(point.x), Math.floor(point.y), Math.floor(point.z));
};

/**
 * The voxel whose minimum corner is the origin.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Origin: Voxel = of(0, 0, 0);

/**
 * Moves a voxel by whole-block steps; omitted axes do not move.
 *
 * @throws { RangeError } When a result leaves the safe integer range.
 * @category Operation
 * @since 1.0.0
 */
export const add: Binary<Voxel, Partial<Offset>, Voxel> = binary(
    (self: Voxel, that: Partial<Offset>): Voxel => of(
        checked(self.x + (that.x ?? 0), "add"),
        checked(self.y + (that.y ?? 0), "add"),
        checked(self.z + (that.z ?? 0), "add")
    )
);

/**
 * Moves a voxel back by whole-block steps; omitted axes do not move.
 * Subtracting one voxel from another gives the steps between them.
 *
 * @throws { RangeError } When a result leaves the safe integer range.
 * @category Operation
 * @since 1.0.0
 */
export const subtract: Binary<Voxel, Partial<Offset>, Voxel> = binary(
    (self: Voxel, that: Partial<Offset>): Voxel => of(
        checked(self.x - (that.x ?? 0), "subtract"),
        checked(self.y - (that.y ?? 0), "subtract"),
        checked(self.z - (that.z ?? 0), "subtract")
    )
);

/**
 * Returns the voxel `distance` blocks past the given face, one block by
 * default. A negative distance moves through the opposite face.
 *
 * @throws { RangeError } When the result leaves the safe integer range.
 * @category Operation
 * @since 1.0.0
 */
export const neighbor: {
    (face: Face, distance?: Int.Int): (self: Voxel) => Voxel;
    (self: Voxel, face: Face, distance?: Int.Int): Voxel;
} = dual((args: IArguments): boolean => typeof args[0] === "object",
    (self: Voxel, face: Face, distance: Int.Int = Int.one): Voxel =>
    {
        const { axis, sign } = FaceTable[face];
        return add(self, { [axis]: sign * distance } as Partial<Offset>);
    });

/**
 * Relative positions of the 26 surrounding voxels, in canonical order, each
 * with its count of nonzero axes.
 *
 * @category Internal
 * @since 1.0.0
 */
const Surroundings: ReadonlyArray<readonly [Offset, number]> = Object.freeze(
    [ -1, 0, 1 ].flatMap((y: number) => [ -1, 0, 1 ].flatMap((z: number) => [ -1, 0, 1 ].map((x: number) =>
        Object.freeze([ of(x, y, z), Math.abs(x) + Math.abs(y) + Math.abs(z) ] as const))))
        .filter(([ , count ]: readonly [Offset, number]): boolean => count > 0)
);

/**
 * Returns the voxels around this one that share a face (6), a face or an
 * edge (18), or a face, an edge or a corner (26, the default is 6). They are
 * in canonical order: by y, then z, then x.
 *
 * @throws { RangeError } When a result leaves the safe integer range.
 * @category Operation
 * @since 1.0.0
 */
export const neighbors = (self: Voxel, connectivity: Connectivity = 6): ReadonlyArray<Voxel> =>
{
    const limit = connectivity === 6 ? 1 : connectivity === 18 ? 2 : 3;
    return Object.freeze(Surroundings
        .filter(([ , count ]: readonly [Offset, number]): boolean => count <= limit)
        .map(([ offset ]: readonly [Offset, number]): Voxel => add(self, offset)));
};

/**
 * The result that ends an iterator.
 *
 * @category Internal
 * @since 1.0.0
 */
const Done: IteratorReturnResult<undefined> = Object.freeze({
    done: true,
    value: undefined
});

/**
 * A fresh iterator over the voxels of an inclusive box, in canonical order.
 *
 * @category Internal
 * @since 1.0.0
 */
const boxVoxels = (from: Voxel, to: Voxel): Iterator<Voxel> =>
{
    const [ minX, maxX ] = from.x <= to.x ? [ from.x, to.x ] : [ to.x, from.x ];
    const [ minZ, maxZ ] = from.z <= to.z ? [ from.z, to.z ] : [ to.z, from.z ];
    const maxY = Math.max(from.y, to.y);
    let [ x, y, z ]: Array<number> = [ minX, Math.min(from.y, to.y), minZ ];
    return {
        next: (): IteratorResult<Voxel> =>
        {
            if (y > maxY)
            {
                return Done;
            }

            const value = of(x, y, z);
            x++;
            if (x > maxX)
            {
                x = minX;
                z++;
                if (z > maxZ)
                {
                    z = minZ;
                    y++;
                }
            }

            return {
                done: false,
                value
            };
        }
    };
};

/**
 * Iterates every voxel in the inclusive box spanned by two corner voxels,
 * which may be given in any order. Voxels come in canonical order: by y,
 * then z, then x, each ascending. The result can be iterated more than once.
 *
 * @category Operation
 * @since 1.0.0
 */
export const box: Binary<Voxel, Voxel, Iterable<Voxel>> = binary(
    (from: Voxel, to: Voxel): Iterable<Voxel> => Object.freeze({
        [Symbol.iterator]: (): Iterator<Voxel> => boxVoxels(from, to)
    })
);

/**
 * Per-axis state of an Amanatides–Woo traversal.
 *
 * @category Internal
 * @since 1.0.0
 */
interface Walk
{
    /** The face of the next voxel that the segment enters through. */
    readonly entry: Face;

    /** The voxel steps left on this axis. */
    remaining: number;

    /** The step direction, −1 or 1. */
    readonly step: number;

    /** The segment parameter between two successive boundary crossings. */
    readonly tDelta: number;

    /** The segment parameter of the next boundary crossing. */
    tMax: number;
}

/**
 * Sets up one axis of a traversal between two coordinates.
 *
 * @category Internal
 * @since 1.0.0
 */
const walk = (axis: Axis, from: number, to: number, start: number, end: number): Walk =>
{
    const delta = to - from;
    const step = end >= start ? 1 : -1;
    const [ positive, negative ] = AxisFaces[axis];
    if (delta === 0)
    {
        return {
            entry: positive,
            remaining: 0,
            step,
            tDelta: Infinity,
            tMax: Infinity
        };
    }

    const boundary = delta > 0 ? start + 1 - from : from - start;
    return {
        entry: delta > 0 ? negative : positive,
        remaining: Math.abs(end - start),
        step,
        tDelta: 1 / Math.abs(delta),
        tMax: boundary / Math.abs(delta)
    };
};

/**
 * A fresh iterator over the steps of a validated traversal.
 *
 * @category Internal
 * @since 1.0.0
 */
const traversal = (from: V.Coordinates, to: V.Coordinates, start: Voxel, end: Voxel): Iterator<Step> =>
{
    const axes = [
        walk("x", from.x, to.x, start.x, end.x),
        walk("y", from.y, to.y, start.y, end.y),
        walk("z", from.z, to.z, start.z, end.z)
    ] as const;
    const position: Array<number> = [ start.x, start.y, start.z ];
    let started = false;
    return {
        next: (): IteratorResult<Step> =>
        {
            if (!started)
            {
                started = true;
                return {
                    done: false,
                    value: Object.freeze({
                        face: Option.none(),
                        voxel: start
                    })
                };
            }

            let chosen = -1;
            for (let index = 0; index < 3; index++)
            {
                if (axes[index].remaining > 0 && (chosen < 0 || axes[index].tMax < axes[chosen].tMax))
                {
                    chosen = index;
                }
            }

            if (chosen < 0)
            {
                return Done;
            }

            const state = axes[chosen];
            position[chosen] += state.step;
            state.remaining--;
            state.tMax += state.tDelta;
            return {
                done: false,
                value: Object.freeze({
                    face: Option.some(state.entry),
                    voxel: of(position[0], position[1], position[2])
                })
            };
        }
    };
};

/**
 * Walks the voxels crossed by the segment from one point to another, with
 * the Amanatides–Woo algorithm. It starts with the voxel holding `from`,
 * ends with the voxel holding `to`, and each later voxel shares a face with
 * the one before it; `Step.face` is that shared face, seen from the voxel
 * entered. Where the segment passes exactly through an edge or a corner, the
 * walk steps one axis at a time, x before y before z, so it also visits a
 * voxel that the segment only touches. The points are read once, when
 * `traverse` is called, and the result can be iterated more than once.
 *
 * @throws { RangeError } When either point is non-finite or beyond the safe
 * integer range.
 * @category Operation
 * @since 1.0.0
 */
export const traverse: Binary<V.Coordinates, V.Coordinates, Iterable<Step>> = binary(
    (from: V.Coordinates, to: V.Coordinates): Iterable<Step> =>
    {
        const start = fromPoint(from);
        const end = fromPoint(to);
        if (Option.isNone(start) || Option.isNone(end))
        {
            throw new RangeError("Voxel.traverse: both points must be finite and in the safe integer range");
        }

        const [ first, last ] = [ start.value, end.value ];
        const source = Object.freeze({
            x: from.x,
            y: from.y,
            z: from.z
        });
        const target = Object.freeze({
            x: to.x,
            y: to.y,
            z: to.z
        });
        return Object.freeze({
            [Symbol.iterator]: (): Iterator<Step> => traversal(source, target, first, last)
        });
    }
);

/**
 * The number of face-to-face steps between two voxels: the sum of the
 * absolute coordinate differences.
 *
 * @throws { RangeError } When the result leaves the safe integer range.
 * @category Measures
 * @since 1.0.0
 */
export const distanceManhattan: Binary<Voxel, Voxel, Int.Int> = binary(
    (self: Voxel, that: Voxel): Int.Int => Int.makeUnsafe(checked(
        Math.abs(self.x - that.x) + Math.abs(self.y - that.y) + Math.abs(self.z - that.z),
        "distanceManhattan"
    ))
);

/**
 * The number of king-move steps between two voxels: the largest absolute
 * coordinate difference.
 *
 * @throws { RangeError } When the result leaves the safe integer range.
 * @category Measures
 * @since 1.0.0
 */
export const distanceChebyshev: Binary<Voxel, Voxel, Int.Int> = binary(
    (self: Voxel, that: Voxel): Int.Int => Int.makeUnsafe(checked(
        Math.max(Math.abs(self.x - that.x), Math.abs(self.y - that.y), Math.abs(self.z - that.z)),
        "distanceChebyshev"
    ))
);

/**
 * The straight-line distance in meters between the two voxels' centers.
 *
 * @category Measures
 * @since 1.0.0
 */
export const distance: Binary<Voxel, Voxel, number> = binary(
    (self: Voxel, that: Voxel): number => Math.hypot(self.x - that.x, self.y - that.y, self.z - that.z)
);

/**
 * Equality of voxels by coordinates.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<Voxel> = Equ.make(
    (self: Voxel, that: Voxel): boolean => self.x === that.x && self.y === that.y && self.z === that.z
);

/**
 * Checks whether two voxels have the same coordinates.
 *
 * @category Instances
 * @since 1.0.0
 */
export const equals: Binary<Voxel, Voxel, boolean> = binary(
    (self: Voxel, that: Voxel): boolean => Equivalence(self, that)
);

/**
 * The canonical order of voxels, the order in which `box` yields them: by y,
 * then z, then x.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<Voxel> = Ord.make(
    (self: Voxel, that: Voxel): -1 | 0 | 1 =>
    {
        const difference = self.y - that.y || self.z - that.z || self.x - that.x;
        return difference < 0 ? -1 : difference > 0 ? 1 : 0;
    }
);

/**
 * A string key for maps and sets, `"x,y,z"`, such as `"-1,64,3"`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const key = (self: Voxel): string =>
{
    return `${self.x},${self.y},${self.z}`;
};

/**
 * The pattern of a voxel key.
 *
 * @category Internal
 * @since 1.0.0
 */
const KeyPattern = /^(0|-?[1-9]\d*),(0|-?[1-9]\d*),(0|-?[1-9]\d*)$/;

/**
 * Parses a key made by `key`. Anything else, including spaces, plus signs,
 * leading zeros, `-0` and unsafe integers, yields `Option.none()`, so
 * `key(Option.getOrThrow(fromKey(s))) === s` for every accepted `s`.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromKey = (input: string): Option.Option<Voxel> =>
{
    const match = KeyPattern.exec(input);
    return match === null ? Option.none() : Voxel(Number(match[1]), Number(match[2]), Number(match[3]));
};

/**
 * The point at the center of the voxel.
 *
 * @category Geometry
 * @since 1.0.0
 */
export const center = (self: Voxel): V.Vector3 =>
{
    return V.Vector3Unsafe(self.x + 0.5, self.y + 0.5, self.z + 0.5);
};

/**
 * The voxel's one-meter cube, from its minimum corner to the opposite corner.
 *
 * @category Geometry
 * @since 1.0.0
 */
export const bounds = (self: Voxel): B.AABB =>
{
    return B.AABBUnsafe(self, { x: self.x + 1,
        y: self.y + 1,
        z: self.z + 1 });
};
