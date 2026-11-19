/**
 * Immutable functional 3D vectors accepting plain readonly coordinates.
 *
 * @module bedform/Vector3
 *
 * @file      Vector3.ts
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

import * as Equal from "@bedform/effect/Equal";
import * as Hash from "@bedform/effect/Hash";
import * as Inspectable from "@bedform/effect/Inspectable";
import * as N from "@bedform/effect/Number";
import * as Option from "@bedform/effect/Option";
import * as Pipeable from "@bedform/effect/Pipeable";
import { formatComponents,
    normalizeComponents,
    parseComponents,
    slerpComponents } from "./Internal/Vector.js";
import { dual } from "@bedform/effect/Function";

/**
 * Private discriminator shared by this enriched vector kind.
 *
 * @category Symbols
 * @since 1.0.0
 */
const TypeId = "~bedform/Vector3" as const;

/**
 * Plain readonly coordinates; Bedrock vectors are structurally compatible.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Coordinates
{
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/**
 * Immutable coordinates with exact equality, hashing, piping and inspection.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Vector3 extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
{
    readonly [TypeId]: typeof TypeId;
}

/**
 * Formatting with optional decimals; omission preserves full precision.
 *
 * @category Types
 * @since 1.0.0
 */
export interface FormatOptions
{
    readonly decimals?: number;
    readonly delimiter?: string;
}

/**
 * A separator for complete finite numeric component parsing.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ParseOptions
{
    readonly delimiter?: string;
}

/**
 * Optional partial component bounds; defaults are safe-integer limits.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Limits
{
    readonly min?: Partial<Coordinates>;
    readonly max?: Partial<Coordinates>;
}

/**
 * Full-precision stored coordinates and a type discriminator.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Json extends Coordinates
{
    readonly _id: "Vector3";
}

/**
 * Shared immutable protocols; arithmetic remains functional.
 *
 * @category Internal
 * @since 1.0.0
 */
const Prototype = Object.freeze({
    ...Pipeable.Prototype,
    ...Inspectable.BaseProto,
    [TypeId]: TypeId,

    /**
     * Compares only enriched vectors of the same kind.
     *
     * @category Equivalence
     * @since 1.0.0
     */
    [Equal.symbol](this: Vector3, that: Equal.Equal): boolean
    {
        return isVector3(that) && equals(this, that);
    },

    /**
     * Hashes exact components with the vector discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Vector3): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.x, this.y, this.z ]));
    },

    /**
     * Retains stored numeric precision for JSON.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Vector3): Json
    {
        return Object.freeze({ _id: "Vector3",
            x: this.x,
            y: this.y,
            z: this.z });
    },

    /**
     * Formats without default component rounding.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Vector3): string
    {
        return format(this);
    }
});

/**
 * Checks the vector discriminator, including unsafe nonfinite values.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isVector3 = (input: unknown): input is Vector3 =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies and freezes raw components without validating or normalizing.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Vector3Unsafe = (x: number, y: number, z: number): Vector3 =>
{
    const Value = Object.create(Prototype) as { -readonly [Key in keyof Vector3]: Vector3[Key] };
    Value.x = x;
    Value.y = y;
    Value.z = z;
    return Object.freeze(Value);
};

/**
 * Constructs a finite vector; zero is valid.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Vector3 = (x: number, y: number, z: number): Option.Option<Vector3> =>
{
    return N.Number.isFinite(x) && N.Number.isFinite(y) && N.Number.isFinite(z) ? Option.some(Vector3Unsafe(x,
        y,
        z)) : Option.none();
};

/**
 * Checks whether every coordinate is finite.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isFinite = (self: Coordinates): boolean =>
{
    return N.Number.isFinite(self.x) && N.Number.isFinite(self.y) && N.Number.isFinite(self.z);
};

/**
 * Compares exact components; NaN equals NaN and signed zeros agree.
 *
 * @category Operation
 * @since 1.0.0
 */
export const equals: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => boolean;

    /**
     * Compares exact components; NaN equals NaN and signed zeros agree.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): boolean;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): boolean => Equal.equals(self.x,
        that.x) && Equal.equals(self.y,
        that.y) && Equal.equals(self.z,
        that.z));

/**
 * Adds supplied coordinates; omissions contribute zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const add: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Partial<Coordinates>): (self: Coordinates) => Vector3;

    /**
     * Adds supplied coordinates; omissions contribute zero.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Partial<Coordinates>): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Partial<Coordinates>): Vector3 => Vector3Unsafe(N.sum(self.x,
        that.x ?? 0),
    N.sum(self.y,
        that.y ?? 0),
    N.sum(self.z,
        that.z ?? 0)));

/**
 * Subtracts that from self; omissions contribute zero.
 *
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Partial<Coordinates>): (self: Coordinates) => Vector3;

    /**
     * Subtracts that from self; omissions contribute zero.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Partial<Coordinates>): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Partial<Coordinates>): Vector3 => Vector3Unsafe(N.subtract(self.x,
        that.x ?? 0),
    N.subtract(self.y,
        that.y ?? 0),
    N.subtract(self.z,
        that.z ?? 0)));

/**
 * Multiplies corresponding raw components.
 *
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => Vector3;

    /**
     * Multiplies corresponding raw components.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector3 => Vector3Unsafe(N.multiply(self.x,
        that.x),
    N.multiply(self.y,
        that.y),
    N.multiply(self.z,
        that.z)));

/**
 * Takes component minima, propagating NaN.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => Vector3;

    /**
     * Takes component minima, propagating NaN.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector3 => Vector3Unsafe(
        N.Number.isNaN(self.x) || N.Number.isNaN(that.x) ? NaN : N.min(self.x,
            that.x),
        N.Number.isNaN(self.y) || N.Number.isNaN(that.y) ? NaN : N.min(self.y,
            that.y),
        N.Number.isNaN(self.z) || N.Number.isNaN(that.z) ? NaN : N.min(self.z,
            that.z)));

/**
 * Takes component maxima, propagating NaN.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => Vector3;

    /**
     * Takes component maxima, propagating NaN.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector3 => Vector3Unsafe(
        N.Number.isNaN(self.x) || N.Number.isNaN(that.x) ? NaN : N.max(self.x,
            that.x),
        N.Number.isNaN(self.y) || N.Number.isNaN(that.y) ? NaN : N.max(self.y,
            that.y),
        N.Number.isNaN(self.z) || N.Number.isNaN(that.z) ? NaN : N.max(self.z,
            that.z)));

/**
 * Scales raw components, preserving overflow and unsafe results.
 *
 * @category Operation
 * @since 1.0.0
 */
export const scale: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: number): (self: Coordinates) => Vector3;

    /**
     * Scales raw components, preserving overflow and unsafe results.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: number): Vector3;
} = dual(2,
    (self: Coordinates,
        that: number): Vector3 => Vector3Unsafe(N.multiply(self.x,
        that),
    N.multiply(self.y,
        that),
    N.multiply(self.z,
        that)));

/**
 * Computes the raw component dot product.
 *
 * @category Operation
 * @since 1.0.0
 */
export const dot: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => number;

    /**
     * Computes the raw component dot product.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): number;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): number => N.multiply(self.x,
        that.x) + N.multiply(self.y,
        that.y) + N.multiply(self.z,
        that.z));

/**
 * Computes self cross that using positive coordinate axes.
 *
 * @category Operation
 * @since 1.0.0
 */
export const cross: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => Vector3;

    /**
     * Computes self cross that using positive coordinate axes.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector3;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector3 => Vector3Unsafe(self.y * that.z - self.z * that.y,
        self.z * that.x - self.x * that.z,
        self.x * that.y - self.y * that.x));

/**
 * Computes a stable Euclidean length through Number hypot helpers.
 *
 * @category Operation
 * @since 1.0.0
 */
export const magnitude = (self: Coordinates): number =>
{
    return N.hypot(N.hypot(self.x, self.y), self.z);
};

/**
 * Computes raw squared magnitude, including numeric overflow/underflow.
 *
 * @category Operation
 * @since 1.0.0
 */
export const magnitudeSquared = (self: Coordinates): number =>
{
    return dot(self, self);
};

/**
 * Computes Euclidean distance through stable length evaluation.
 *
 * @category Operation
 * @since 1.0.0
 */
export const distance: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates): (self: Coordinates) => number;

    /**
     * Computes Euclidean distance through stable length evaluation.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): number;
} = dual(2, (self: Coordinates, that: Coordinates): number => magnitude(subtract(self, that)));

/**
 * Applies native Number floor semantics to every component.
 *
 * @category Operation
 * @since 1.0.0
 */
export const floor = (self: Coordinates): Vector3 =>
{
    return Vector3Unsafe(N.floor(self.x), N.floor(self.y), N.floor(self.z));
};

/**
 * Applies native Number ceil semantics to every component.
 *
 * @category Operation
 * @since 1.0.0
 */
export const ceil = (self: Coordinates): Vector3 =>
{
    return Vector3Unsafe(N.ceil(self.x), N.ceil(self.y), N.ceil(self.z));
};

/**
 * Normalizes huge or tiny finite inputs stably; zero/nonfinite inputs yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalize = (self: Coordinates): Option.Option<Vector3> =>
{
    return Option.map(normalizeComponents([ self.x,
        self.y,
        self.z ]),
    (values: ReadonlyArray<number>) => Vector3Unsafe(values[0],
        values[1],
        values[2]));
};

/**
 * Clamps coordinates with optional partial safe-integer limits.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp: {
    /**
     * Supplies limits before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (limits?: Limits): (self: Coordinates) => Vector3;

    /**
     * Clamps components using scalar Number clamp.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, limits?: Limits): Vector3;
} = dual((args: IArguments) => args.length >= 2 ||
    (args[0] !== null && typeof args[0] === "object" && "x" in args[0]),

(self: Coordinates,
    limits: Limits = {}): Vector3 => Vector3Unsafe(N.clamp(self.x,
    { maximum: limits.max?.x ?? N.Number.MAX_SAFE_INTEGER,
        minimum: limits.min?.x ?? N.Number.MIN_SAFE_INTEGER }),
N.clamp(self.y,
    { maximum: limits.max?.y ?? N.Number.MAX_SAFE_INTEGER,
        minimum: limits.min?.y ?? N.Number.MIN_SAFE_INTEGER }),
N.clamp(self.z,
    { maximum: limits.max?.z ?? N.Number.MAX_SAFE_INTEGER,
        minimum: limits.min?.z ?? N.Number.MIN_SAFE_INTEGER })));

/**
 * Linearly interpolates raw components with unclamped t.
 *
 * @category Operation
 * @since 1.0.0
 */
export const lerp: {
    /**
     * Supplies destination and t before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates, t: number): (self: Coordinates) => Vector3;

    /**
     * Linearly interpolates raw components with unclamped t.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates, t: number): Vector3;
} = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Vector3 => Vector3Unsafe(N.lerp(self.x,
        that.x,
        t),
    N.lerp(self.y,
        that.y,
        t),
    N.lerp(self.z,
        that.z,
        t)));

/**
 * Interpolates direction on a great circle and magnitude linearly with unclamped t.
 * Zero/nonfinite inputs or unrepresentable results yield None. Parallel and antiparallel
 * paths are stable and deterministic as described in the README.
 *
 * @category Operation
 * @since 1.0.0
 */
export const slerp: {
    /**
     * Supplies destination and t before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<Vector3>;

    /**
     * Interpolates direction on a great circle and magnitude linearly with unclamped t.
     * Zero/nonfinite inputs or unrepresentable results yield None. Parallel and antiparallel
     * paths are stable and deterministic as described in the README.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Vector3>;
} = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Vector3> => Option.flatMap(slerpComponents([ self.x,
        self.y,
        self.z ],
    [ that.x,
        that.y,
        that.z ],
    t),
    (values: ReadonlyArray<number>) => Vector3(values[0],
        values[1],
        values[2])));

/**
 * Rotates around positive X by an angle in radians.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotateX: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: number): (self: Coordinates) => Vector3;

    /**
     * Rotates around positive X by an angle in radians.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: number): Vector3;
} = dual(2, (self: Coordinates, that: number): Vector3 =>
{
    const C = N.cos(that);
    const S = N.sin(that);
    return Vector3Unsafe(self.x, self.y * C - self.z * S, self.z * C + self.y * S);
});

/**
 * Rotates around positive Y by an angle in radians.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotateY: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: number): (self: Coordinates) => Vector3;

    /**
     * Rotates around positive Y by an angle in radians.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: number): Vector3;
} = dual(2, (self: Coordinates, that: number): Vector3 =>
{
    const C = N.cos(that);
    const S = N.sin(that);
    return Vector3Unsafe(self.x * C + self.z * S, self.y, self.z * C - self.x * S);
});

/**
 * Rotates around positive Z by an angle in radians.
 *
 * @category Operation
 * @since 1.0.0
 */
export const rotateZ: {
    /**
     * Supplies the second operand before the vector.
     *
     * @category Operation
     * @since 1.0.0
     */
    (that: number): (self: Coordinates) => Vector3;

    /**
     * Rotates around positive Z by an angle in radians.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: number): Vector3;
} = dual(2, (self: Coordinates, that: number): Vector3 =>
{
    const C = N.cos(that);
    const S = N.sin(that);
    return Vector3Unsafe(self.x * C - self.y * S, self.y * C + self.x * S, self.z);
});

/**
 * Formats optional decimals/delimiter; default precision is complete.
 * Invalid decimal precision follows native toFixed RangeError behavior.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const format: {
    /**
     * Supplies format options before the vector.
     *
     * @category Formatting
     * @since 1.0.0
     */
    (options?: FormatOptions): (self: Coordinates) => string;

    /**
     * Formats components without changing stored values.
     *
     * @category Formatting
     * @since 1.0.0
     */
    (self: Coordinates, options?: FormatOptions): string;
} = dual((args: IArguments) => args.length >= 2 ||
    (args[0] !== null && typeof args[0] === "object" && "x" in args[0]),

(self: Coordinates,
    options: FormatOptions = {}): string => formatComponents([ self.x,
    self.y,
    self.z ],
options.decimals,
options.delimiter));

/**
 * Aliases the dual formatter with the familiar vector utility name.
 *
 * @category Formatting
 * @since 1.0.0
 */
export const toString = format;

/**
 * Parses complete finite numeric fields; empty/partially numeric fields yield None.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const fromString: {
    /**
     * Supplies parse options before the text.
     *
     * @category Parsing
     * @since 1.0.0
     */
    (options?: ParseOptions): (self: string) => Option.Option<Vector3>;

    /**
     * Parses default emitted text or a custom separator.
     *
     * @category Parsing
     * @since 1.0.0
     */
    (self: string, options?: ParseOptions): Option.Option<Vector3>;
} = dual((args: IArguments) => typeof args[0] === "string",
    (self: string,
        options: ParseOptions = {}): Option.Option<Vector3> => Option.flatMap(parseComponents(self,
        3,
        options.delimiter),

    (values: ReadonlyArray<number>) => Vector3(values[0], values[1], values[2])));

/**
 * Aliases strict finite parsing under a functional name.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * The immutable Zero vector (0, 0, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Zero: Vector3 = Vector3Unsafe(0, 0, 0);

/**
 * The immutable One vector (1, 1, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const One: Vector3 = Vector3Unsafe(1, 1, 1);

/**
 * The immutable Half vector (0.5, 0.5, 0.5).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Half: Vector3 = Vector3Unsafe(0.5, 0.5, 0.5);

/**
 * The immutable NegativeOne vector (-1, -1, -1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const NegativeOne: Vector3 = Vector3Unsafe(-1, -1, -1);

/**
 * The immutable UnitX vector (1, 0, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const UnitX: Vector3 = Vector3Unsafe(1, 0, 0);

/**
 * The immutable UnitY vector (0, 1, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const UnitY: Vector3 = Vector3Unsafe(0, 1, 0);

/**
 * The immutable UnitZ vector (0, 0, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const UnitZ: Vector3 = Vector3Unsafe(0, 0, 1);

/**
 * The immutable East vector (1, 0, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const East: Vector3 = Vector3Unsafe(1, 0, 0);

/**
 * The immutable West vector (-1, 0, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const West: Vector3 = Vector3Unsafe(-1, 0, 0);

/**
 * The immutable South vector (0, 0, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const South: Vector3 = Vector3Unsafe(0, 0, 1);

/**
 * The immutable North vector (0, 0, -1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const North: Vector3 = Vector3Unsafe(0, 0, -1);

/**
 * The immutable Up vector (0, 1, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Up: Vector3 = Vector3Unsafe(0, 1, 0);

/**
 * The immutable Down vector (0, -1, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Down: Vector3 = Vector3Unsafe(0, -1, 0);

/**
 * The immutable Forward vector (0, 0, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Forward: Vector3 = Vector3Unsafe(0, 0, 1);

/**
 * The immutable Back vector (0, 0, -1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Back: Vector3 = Vector3Unsafe(0, 0, -1);

/**
 * Facing-right at zero orientation is negative X.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Right: Vector3 = Vector3Unsafe(-1, 0, 0);

/**
 * Facing-left at zero orientation is positive X.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Left: Vector3 = Vector3Unsafe(1, 0, 0);

