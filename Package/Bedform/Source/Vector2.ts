/**
 * Immutable functional 2D vectors accepting plain readonly coordinates.
 *
 * @module bedform/Vector2
 *
 * @file      Vector2.ts
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
const TypeId = "~bedform/Vector2" as const;

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
}

/**
 * Immutable coordinates with exact equality, hashing, piping and inspection.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Vector2 extends Coordinates, Equal.Equal, Pipeable.Pipeable, Inspectable.Inspectable
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
    readonly _id: "Vector2";
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
    [Equal.symbol](this: Vector2, that: Equal.Equal): boolean
    {
        return isVector2(that) && equals(this, that);
    },

    /**
     * Hashes exact components with the vector discriminator.
     *
     * @category Hashing
     * @since 1.0.0
     */
    [Hash.symbol](this: Vector2): number
    {
        return Hash.combine(Hash.string(TypeId))(Hash.array([ this.x, this.y ]));
    },

    /**
     * Retains stored numeric precision for JSON.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toJSON(this: Vector2): Json
    {
        return Object.freeze({ _id: "Vector2",
            x: this.x,
            y: this.y });
    },

    /**
     * Formats without default component rounding.
     *
     * @category Formatting
     * @since 1.0.0
     */
    toString(this: Vector2): string
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
export const isVector2 = (input: unknown): input is Vector2 =>
{
    return typeof input === "object" && input !== null && TypeId in input && input[TypeId] === TypeId;
};

/**
 * Copies and freezes raw components without validating or normalizing.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Vector2Unsafe = (x: number, y: number): Vector2 =>
{
    return Object.freeze(Object.assign(Object.create(Prototype) as Vector2, { x,
        y }));
};

/**
 * Constructs a finite vector; zero is valid.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const Vector2 = (x: number, y: number): Option.Option<Vector2> =>
{
    return N.Number.isFinite(x) && N.Number.isFinite(y) ? Option.some(Vector2Unsafe(x, y)) : Option.none();
};

/**
 * Checks whether every coordinate is finite.
 *
 * @category Guard
 * @since 1.0.0
 */
export const isFinite = (self: Coordinates): boolean =>
{
    return N.Number.isFinite(self.x) && N.Number.isFinite(self.y);
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
        that.y));

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
    (that: Partial<Coordinates>): (self: Coordinates) => Vector2;

    /**
     * Adds supplied coordinates; omissions contribute zero.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Partial<Coordinates>): Vector2;
} = dual(2,
    (self: Coordinates,
        that: Partial<Coordinates>): Vector2 => Vector2Unsafe(N.sum(self.x,
        that.x ?? 0),
    N.sum(self.y,
        that.y ?? 0)));

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
    (that: Partial<Coordinates>): (self: Coordinates) => Vector2;

    /**
     * Subtracts that from self; omissions contribute zero.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Partial<Coordinates>): Vector2;
} = dual(2,
    (self: Coordinates,
        that: Partial<Coordinates>): Vector2 => Vector2Unsafe(N.subtract(self.x,
        that.x ?? 0),
    N.subtract(self.y,
        that.y ?? 0)));

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
    (that: Coordinates): (self: Coordinates) => Vector2;

    /**
     * Multiplies corresponding raw components.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector2;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector2 => Vector2Unsafe(N.multiply(self.x,
        that.x),
    N.multiply(self.y,
        that.y)));

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
    (that: Coordinates): (self: Coordinates) => Vector2;

    /**
     * Takes component minima, propagating NaN.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector2;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector2 => Vector2Unsafe(
        N.Number.isNaN(self.x) || N.Number.isNaN(that.x) ? NaN : N.min(self.x,
            that.x),
        N.Number.isNaN(self.y) || N.Number.isNaN(that.y) ? NaN : N.min(self.y,
            that.y)));

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
    (that: Coordinates): (self: Coordinates) => Vector2;

    /**
     * Takes component maxima, propagating NaN.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates): Vector2;
} = dual(2,
    (self: Coordinates,
        that: Coordinates): Vector2 => Vector2Unsafe(
        N.Number.isNaN(self.x) || N.Number.isNaN(that.x) ? NaN : N.max(self.x,
            that.x),
        N.Number.isNaN(self.y) || N.Number.isNaN(that.y) ? NaN : N.max(self.y,
            that.y)));

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
    (that: number): (self: Coordinates) => Vector2;

    /**
     * Scales raw components, preserving overflow and unsafe results.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: number): Vector2;
} = dual(2,
    (self: Coordinates,
        that: number): Vector2 => Vector2Unsafe(N.multiply(self.x,
        that),
    N.multiply(self.y,
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
        that.y));

/**
 * Computes a stable Euclidean length through Number hypot helpers.
 *
 * @category Operation
 * @since 1.0.0
 */
export const magnitude = (self: Coordinates): number =>
{
    return N.hypot(self.x, self.y);
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
export const floor = (self: Coordinates): Vector2 =>
{
    return Vector2Unsafe(N.floor(self.x), N.floor(self.y));
};

/**
 * Applies native Number ceil semantics to every component.
 *
 * @category Operation
 * @since 1.0.0
 */
export const ceil = (self: Coordinates): Vector2 =>
{
    return Vector2Unsafe(N.ceil(self.x), N.ceil(self.y));
};

/**
 * Normalizes huge or tiny finite inputs stably; zero/nonfinite inputs yield None.
 *
 * @category Operation
 * @since 1.0.0
 */
export const normalize = (self: Coordinates): Option.Option<Vector2> =>
{
    return Option.map(normalizeComponents([ self.x,
        self.y ]),
    (values: ReadonlyArray<number>) => Vector2Unsafe(values[0],
        values[1]));
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
    (limits?: Limits): (self: Coordinates) => Vector2;

    /**
     * Clamps components using scalar Number clamp.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, limits?: Limits): Vector2;
} = dual((args: IArguments) => args.length >= 2 ||
    (args[0] !== null && typeof args[0] === "object" && "x" in args[0]),

(self: Coordinates,
    limits: Limits = {}): Vector2 => Vector2Unsafe(N.clamp(self.x,
    { maximum: limits.max?.x ?? N.Number.MAX_SAFE_INTEGER,
        minimum: limits.min?.x ?? N.Number.MIN_SAFE_INTEGER }),
N.clamp(self.y,
    { maximum: limits.max?.y ?? N.Number.MAX_SAFE_INTEGER,
        minimum: limits.min?.y ?? N.Number.MIN_SAFE_INTEGER })));

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
    (that: Coordinates, t: number): (self: Coordinates) => Vector2;

    /**
     * Linearly interpolates raw components with unclamped t.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates, t: number): Vector2;
} = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Vector2 => Vector2Unsafe(N.lerp(self.x,
        that.x,
        t),
    N.lerp(self.y,
        that.y,
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
    (that: Coordinates, t: number): (self: Coordinates) => Option.Option<Vector2>;

    /**
     * Interpolates direction on a great circle and magnitude linearly with unclamped t.
     * Zero/nonfinite inputs or unrepresentable results yield None. Parallel and antiparallel
     * paths are stable and deterministic as described in the README.
     *
     * @category Operation
     * @since 1.0.0
     */
    (self: Coordinates, that: Coordinates, t: number): Option.Option<Vector2>;
} = dual(3,
    (self: Coordinates,
        that: Coordinates,
        t: number): Option.Option<Vector2> => Option.flatMap(slerpComponents([ self.x,
        self.y ],
    [ that.x,
        that.y ],
    t),
    (values: ReadonlyArray<number>) => Vector2(values[0],
        values[1])));

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
    self.y ],
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
    (options?: ParseOptions): (self: string) => Option.Option<Vector2>;

    /**
     * Parses default emitted text or a custom separator.
     *
     * @category Parsing
     * @since 1.0.0
     */
    (self: string, options?: ParseOptions): Option.Option<Vector2>;
} = dual((args: IArguments) => typeof args[0] === "string",
    (self: string,
        options: ParseOptions = {}): Option.Option<Vector2> => Option.flatMap(parseComponents(self,
        2,
        options.delimiter),

    (values: ReadonlyArray<number>) => Vector2(values[0], values[1])));

/**
 * Aliases strict finite parsing under a functional name.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const parse = fromString;

/**
 * The immutable Zero vector (0, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Zero: Vector2 = Vector2Unsafe(0, 0);

/**
 * The immutable One vector (1, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const One: Vector2 = Vector2Unsafe(1, 1);

/**
 * The immutable Half vector (0.5, 0.5).
 *
 * @category Constants
 * @since 1.0.0
 */
export const Half: Vector2 = Vector2Unsafe(0.5, 0.5);

/**
 * The immutable NegativeOne vector (-1, -1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const NegativeOne: Vector2 = Vector2Unsafe(-1, -1);

/**
 * The immutable UnitX vector (1, 0).
 *
 * @category Constants
 * @since 1.0.0
 */
export const UnitX: Vector2 = Vector2Unsafe(1, 0);

/**
 * The immutable UnitY vector (0, 1).
 *
 * @category Constants
 * @since 1.0.0
 */
export const UnitY: Vector2 = Vector2Unsafe(0, 1);

