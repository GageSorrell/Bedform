/**
 * Represents exact, non-negative, integral byte counts.
 *
 * Decimal units use powers of 1,000 and binary units use powers of 1,024.
 *
 * @module @bedform/effect/ByteSize
 *
 * @file      ByteSize.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import * as BI from "./BigInt.js";
import type * as Brand from "./Internal/brand.js";
import type * as Combiner from "./Combiner.js";
import type * as Equ from "./Equivalence.js";
import { dual } from "./Function.js";
import * as Option from "./Option.js";
import type * as order from "./Order.js";
import type * as Reducer from "./Reducer.js";

// Nominal marker is used only at the type level.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TypeId = "~effect/ByteSize";

const Bigint0 = BigInt(0);
const Bigint1 = BigInt(1);
const DecimalBase = BigInt(1_000);
const BinaryBase = BigInt(1_024);

/**
 * Represents an exact, non-negative number of bytes.
 *
 * @category Utilities
 * @since 1.0.0
 */
export type ByteSize = Brand.Branded<bigint, typeof TypeId>;

/**
 * Values accepted by byte-size decoding operations.
 *
 * **Details**
 *
 * String inputs require a non-negative decimal integer without leading zeros,
 * followed by a canonical unit symbol or lowercase unit name, optionally
 * separated by one space. Numeric inputs are validated at runtime.
 *
 * @see {@link fromString} for external strings and fractional quantities
 * @see {@link fromStringUnsafe} for throwing string validation
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Input = ByteSize | bigint | number | `${IntegerQuantity}${"" | " "}${InputUnit}`;

// Combining these constraints excludes signs, radix prefixes, leading zeros,
// fractions, and exponent notation without limiting the number of digits.
type IntegerQuantity = "0" | (`${bigint}` & `${"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"}${string}`);

type InputUnit =
  | Unit
  | `${
    | ""
    | "kilo"
    | "mega"
    | "giga"
    | "tera"
    | "peta"
    | "exa"
    | "zetta"
    | "yotta"
    | "ronna"
    | "quetta"
    | "kibi"
    | "mebi"
    | "gibi"
    | "tebi"
    | "pebi"
    | "exbi"
    | "zebi"
    | "yobi"}byte${"" | "s"}`;

/**
 * Canonical decimal byte unit symbols.
 *
 * @category Utilities
 * @since 1.0.0
 */
export type DecimalUnit =
  | "B"
  | "kB"
  | "MB"
  | "GB"
  | "TB"
  | "PB"
  | "EB"
  | "ZB"
  | "YB"
  | "RB"
  | "QB";

/**
 * Canonical binary byte unit symbols.
 *
 * @category Utilities
 * @since 1.0.0
 */
export type BinaryUnit =
  | "B"
  | "KiB"
  | "MiB"
  | "GiB"
  | "TiB"
  | "PiB"
  | "EiB"
  | "ZiB"
  | "YiB";

/**
 * Canonical decimal and binary byte unit symbols.
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Unit = DecimalUnit | BinaryUnit;

/**
 * Options controlling compact byte-size formatting.
 *
 * @category Utilities
 * @since 1.0.0
 */
export type FormatOptions =
  & {
      readonly precision?: number | undefined
      readonly trailingZeros?: boolean | undefined
  }
  & (
    | {
        readonly system?: "decimal" | undefined
        readonly unit?: DecimalUnit | undefined
    }
    | {
        readonly system?: "binary" | undefined
        readonly unit?: BinaryUnit | undefined
    }
  );

interface UnitInfo
{
    readonly symbol: Unit
    readonly factor: bigint
    readonly names: ReadonlyArray<string>
}

const DecimalUnits: ReadonlyArray<UnitInfo> = [
    { symbol: "B",
        factor: Bigint1,
        names: [ "B", "byte", "bytes" ] },
    { symbol: "kB",
        factor: DecimalBase,
        names: [ "kB", "kilobyte", "kilobytes" ] },
    { symbol: "MB",
        factor: DecimalBase ** BigInt(2),
        names: [ "MB", "megabyte", "megabytes" ] },
    { symbol: "GB",
        factor: DecimalBase ** BigInt(3),
        names: [ "GB", "gigabyte", "gigabytes" ] },
    { symbol: "TB",
        factor: DecimalBase ** BigInt(4),
        names: [ "TB", "terabyte", "terabytes" ] },
    { symbol: "PB",
        factor: DecimalBase ** BigInt(5),
        names: [ "PB", "petabyte", "petabytes" ] },
    { symbol: "EB",
        factor: DecimalBase ** BigInt(6),
        names: [ "EB", "exabyte", "exabytes" ] },
    { symbol: "ZB",
        factor: DecimalBase ** BigInt(7),
        names: [ "ZB", "zettabyte", "zettabytes" ] },
    { symbol: "YB",
        factor: DecimalBase ** BigInt(8),
        names: [ "YB", "yottabyte", "yottabytes" ] },
    { symbol: "RB",
        factor: DecimalBase ** BigInt(9),
        names: [ "RB", "ronnabyte", "ronnabytes" ] },
    { symbol: "QB",
        factor: DecimalBase ** BigInt(10),
        names: [ "QB", "quettabyte", "quettabytes" ] }
];

const BinaryUnits: ReadonlyArray<UnitInfo> = [
    DecimalUnits[0],
    { symbol: "KiB",
        factor: BinaryBase,
        names: [ "KiB", "kibibyte", "kibibytes" ] },
    { symbol: "MiB",
        factor: BinaryBase ** BigInt(2),
        names: [ "MiB", "mebibyte", "mebibytes" ] },
    { symbol: "GiB",
        factor: BinaryBase ** BigInt(3),
        names: [ "GiB", "gibibyte", "gibibytes" ] },
    { symbol: "TiB",
        factor: BinaryBase ** BigInt(4),
        names: [ "TiB", "tebibyte", "tebibytes" ] },
    { symbol: "PiB",
        factor: BinaryBase ** BigInt(5),
        names: [ "PiB", "pebibyte", "pebibytes" ] },
    { symbol: "EiB",
        factor: BinaryBase ** BigInt(6),
        names: [ "EiB", "exbibyte", "exbibytes" ] },
    { symbol: "ZiB",
        factor: BinaryBase ** BigInt(7),
        names: [ "ZiB", "zebibyte", "zebibytes" ] },
    { symbol: "YiB",
        factor: BinaryBase ** BigInt(8),
        names: [ "YiB", "yobibyte", "yobibytes" ] }
];

const AllUnits = [ ...DecimalUnits, ...BinaryUnits.slice(1) ];
const UnitsByName = new Map(AllUnits.flatMap((unit) => unit.names.map((name) => [ name, unit ] as const)));
const UnitsBySymbol = new Map(AllUnits.map((unit) => [ unit.symbol, unit ] as const));

const Make = (value: bigint): ByteSize => value as ByteSize;

/**
 * The byte size containing zero bytes.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zero: ByteSize = Make(Bigint0);

const InvalidValue = (message: string): never =>
{
    throw new Error(`Invalid ByteSize: ${message}`);
};

const FromNumber = (input: number): ByteSize =>
{
    if (!Number.isSafeInteger(input) || input < 0)
    {
        return InvalidValue(`expected a non-negative safe integer, received ${input}`);
    }

    return Make(BigInt(input));
};

const FromQuantity = (quantity: number | bigint, unit: UnitInfo): ByteSize =>
{
    if (typeof quantity === "bigint")
    {
        if (quantity < Bigint0) {return InvalidValue(`expected a non-negative quantity, received ${quantity}`);}

        return Make(quantity * unit.factor);
    }

    const Value = quantity * Number(unit.factor);
    if (!Number.isSafeInteger(Value) || Value < 0)
    {
        return InvalidValue(`expected an exact non-negative safe-integer byte result, received ${quantity} ${unit.symbol}`);
    }

    return Make(BigInt(Value));
};

/**
 * Parses a byte-size string and throws for invalid syntax, unsupported units,
 * or quantities that do not represent non-negative integral bytes.
 *
 * **Details**
 *
 * Accepts decimal fractions, canonical SI and IEC symbols, lowercase unit
 * names, and whitespace around the quantity and unit. Parsing uses exact
 * bigint arithmetic, including above the safe integer range.
 *
 * @see {@link fromString} for non-throwing validation
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromStringUnsafe = (input: string): ByteSize =>
{
    const Match = /^\s*(\d+)(?:\.(\d+))?\s*([A-Za-z]+)\s*$/.exec(input);
    if (Match === null) {return InvalidValue(`unsupported syntax ${JSON.stringify(input)}`);}

    const UnitValue = UnitsByName.get(Match[3]);
    if (UnitValue === undefined) {return InvalidValue(`unsupported unit ${JSON.stringify(Match[3])}`);}

    const Fraction = Match[2] ?? "";
    const Scale = BigInt(10) ** BigInt(Fraction.length);
    const Numerator = BigInt(Match[1] + Fraction) * UnitValue.factor;
    if (Numerator % Scale !== Bigint0)
    {
        return InvalidValue(`${JSON.stringify(input)} does not represent an integral number of bytes`);
    }

    return Make(Numerator / Scale);
};

/**
 * Parses a byte-size string, returning `None` for invalid syntax, unsupported
 * units, or quantities that do not represent non-negative integral bytes.
 *
 * **Details**
 *
 * Accepts external strings and fractional quantities using the same syntax
 * as `fromStringUnsafe`.
 *
 * @see {@link fromStringUnsafe} for throwing validation
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromString: (input: string) => Option.Option<ByteSize> = Option.liftThrowable(fromStringUnsafe);

/**
 * Decodes a trusted input into a byte size and throws for invalid input.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromInputUnsafe = (input: Input): ByteSize =>
{
    switch (typeof input)
    {
        case "bigint":
            if (input < Bigint0) {return InvalidValue(`expected a non-negative bigint, received ${input}`);}

            return Make(input);
        case "number":
            return FromNumber(input);
        case "string":
            return fromStringUnsafe(input);
    }

    return InvalidValue(`unsupported input ${input}`);
};

/**
 * Decodes an input into a byte size, returning `None` for invalid input.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const fromInput: (input: Input) => Option.Option<ByteSize> = Option.liftThrowable(fromInputUnsafe);

/**
 * Creates a byte size from a non-negative byte count.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const bytes = (value: number | bigint): ByteSize =>
    typeof value === "bigint" ? fromInputUnsafe(value) : FromNumber(value);

const UnitConstructor = (symbol: Unit) => (value: number | bigint): ByteSize =>
    FromQuantity(value, UnitsBySymbol.get(symbol)!);

/**
 * Creates a decimal kilobyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const kilobytes: (value: number | bigint) => ByteSize = UnitConstructor("kB");

/**
 * Creates a decimal megabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const megabytes: (value: number | bigint) => ByteSize = UnitConstructor("MB");

/**
 * Creates a decimal gigabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const gigabytes: (value: number | bigint) => ByteSize = UnitConstructor("GB");

/**
 * Creates a decimal terabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const terabytes: (value: number | bigint) => ByteSize = UnitConstructor("TB");

/**
 * Creates a decimal petabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const petabytes: (value: number | bigint) => ByteSize = UnitConstructor("PB");

/**
 * Creates a decimal exabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exabytes: (value: number | bigint) => ByteSize = UnitConstructor("EB");

/**
 * Creates a decimal zettabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zettabytes: (value: number | bigint) => ByteSize = UnitConstructor("ZB");

/**
 * Creates a decimal yottabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const yottabytes: (value: number | bigint) => ByteSize = UnitConstructor("YB");

/**
 * Creates a decimal ronnabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ronnabytes: (value: number | bigint) => ByteSize = UnitConstructor("RB");

/**
 * Creates a decimal quettabyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const quettabytes: (value: number | bigint) => ByteSize = UnitConstructor("QB");

/**
 * Creates a binary kibibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const kibibytes: (value: number | bigint) => ByteSize = UnitConstructor("KiB");

/**
 * Creates a binary mebibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mebibytes: (value: number | bigint) => ByteSize = UnitConstructor("MiB");

/**
 * Creates a binary gibibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const gibibytes: (value: number | bigint) => ByteSize = UnitConstructor("GiB");

/**
 * Creates a binary tebibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const tebibytes: (value: number | bigint) => ByteSize = UnitConstructor("TiB");

/**
 * Creates a binary pebibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const pebibytes: (value: number | bigint) => ByteSize = UnitConstructor("PiB");

/**
 * Creates a binary exbibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exbibytes: (value: number | bigint) => ByteSize = UnitConstructor("EiB");

/**
 * Creates a binary zebibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const zebibytes: (value: number | bigint) => ByteSize = UnitConstructor("ZiB");

/**
 * Creates a binary yobibyte value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const yobibytes: (value: number | bigint) => ByteSize = UnitConstructor("YiB");

/**
 * Checks whether a value is a byte size.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isByteSize = (input: unknown): input is ByteSize => typeof input === "bigint" && input >= Bigint0;

/**
 * Checks whether a byte size is zero.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isZero = (self: ByteSize): boolean => self === Bigint0;

/**
 * Returns the exact byte count as a bigint.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toBigInt = (self: ByteSize): bigint => self;

/**
 * Converts a byte size to a safe integer, returning `None` when it is too large.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toNumber: (self: ByteSize) => Option.Option<number> = BI.toNumber;

/**
 * Converts a byte size to a safe integer and throws when it is too large.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toNumberUnsafe = (self: ByteSize): number =>
    Option.getOrThrowWith(toNumber(self), () => new Error(`ByteSize exceeds Number.MAX_SAFE_INTEGER: ${self}`));

/**
 * Converts a byte size to an approximate number of the specified unit.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const toUnit: {
    /**
     * Converts a byte size to an approximate number of the specified unit.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (unit: Unit): (self: ByteSize) => number

    /**
     * Converts a byte size to an approximate number of the specified unit.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, unit: Unit): number
} = dual(2, (self: ByteSize, unit: Unit) => Number(self) / Number(UnitsBySymbol.get(unit)!.factor));

/**
 * Provides an order for byte sizes.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Order: order.Order<ByteSize> = BI.Order;

/**
 * Provides an equivalence for byte sizes.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Equivalence: Equ.Equivalence<ByteSize> = BI.Equivalence;

/**
 * Returns whether a byte size is in an inclusive range.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const between: {
    /**
     * Returns whether a byte size is in an inclusive range.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (options: { minimum: ByteSize;
        maximum: ByteSize }): (self: ByteSize) => boolean

    /**
     * Returns whether a byte size is in an inclusive range.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, options: { minimum: ByteSize;
        maximum: ByteSize }): boolean
} = BI.between;

/**
 * Returns the smaller byte size.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const min: {
    /**
     * Returns the smaller byte size.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => ByteSize

    /**
     * Returns the smaller byte size.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): ByteSize
} = BI.min as any;

/**
 * Returns the larger byte size.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const max: {
    /**
     * Returns the larger byte size.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => ByteSize

    /**
     * Returns the larger byte size.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): ByteSize
} = BI.max as any;

/**
 * Constrains a byte size to an inclusive range.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const clamp: {
    /**
     * Constrains a byte size to an inclusive range.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (options: { minimum: ByteSize;
        maximum: ByteSize }): (self: ByteSize) => ByteSize

    /**
     * Constrains a byte size to an inclusive range.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, options: { minimum: ByteSize;
        maximum: ByteSize }): ByteSize
} = BI.clamp as any;

/**
 * Checks whether the first byte size is less than the second.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThan: {
    /**
     * Checks whether the first byte size is less than the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => boolean

    /**
     * Checks whether the first byte size is less than the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): boolean
} = BI.isLessThan;

/**
 * Checks whether the first byte size is at most the second.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isLessThanOrEqualTo: {
    /**
     * Checks whether the first byte size is at most the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => boolean

    /**
     * Checks whether the first byte size is at most the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): boolean
} = BI.isLessThanOrEqualTo;

/**
 * Checks whether the first byte size is greater than the second.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThan: {
    /**
     * Checks whether the first byte size is greater than the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => boolean

    /**
     * Checks whether the first byte size is greater than the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): boolean
} = BI.isGreaterThan;

/**
 * Checks whether the first byte size is at least the second.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo: {
    /**
     * Checks whether the first byte size is at least the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => boolean

    /**
     * Checks whether the first byte size is at least the second.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): boolean
} = BI.isGreaterThanOrEqualTo;

/**
 * Checks whether two byte sizes contain the same count.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const equals: {
    /**
     * Checks whether two byte sizes contain the same count.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => boolean

    /**
     * Checks whether two byte sizes contain the same count.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): boolean
} = dual(2, Equivalence);

/**
 * Adds two byte sizes exactly.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const sum: {
    /**
     * Adds two byte sizes exactly.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => ByteSize

    /**
     * Adds two byte sizes exactly.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): ByteSize
} = BI.sum as any;

/**
 * Subtracts byte sizes, returning `None` on underflow.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const subtract: {
    /**
     * Subtracts byte sizes, returning `None` on underflow.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => Option.Option<ByteSize>

    /**
     * Subtracts byte sizes, returning `None` on underflow.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): Option.Option<ByteSize>
} = dual(
    2,
    (self: ByteSize, that: ByteSize) => self < that ? Option.none() : Option.some(Make(self - that))
);

/**
 * Subtracts byte sizes and throws on underflow.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const subtractUnsafe: {
    /**
     * Subtracts byte sizes and throws on underflow.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (that: ByteSize): (self: ByteSize) => ByteSize

    /**
     * Subtracts byte sizes and throws on underflow.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, that: ByteSize): ByteSize
} = dual(2, (self: ByteSize, that: ByteSize) =>
{
    if (self < that) {throw new Error(`ByteSize subtraction underflow: ${self} - ${that}`);}

    return Make(self - that);
});

const Scalar = (input: number | bigint, positive: boolean): bigint | undefined =>
{
    if (typeof input === "bigint") {return input >= (positive ? Bigint1 : Bigint0) ? input : undefined;}

    return Number.isSafeInteger(input) && input >= (positive ? 1 : 0) ? BigInt(input) : undefined;
};

/**
 * Multiplies a byte size by a non-negative integer scalar.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const times: {
    /**
     * Multiplies a byte size by a non-negative integer scalar.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (multiplier: number | bigint): (self: ByteSize) => Option.Option<ByteSize>

    /**
     * Multiplies a byte size by a non-negative integer scalar.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, multiplier: number | bigint): Option.Option<ByteSize>
} = dual(2, (self: ByteSize, multiplier: number | bigint) =>
{
    const ValueValue = Scalar(multiplier, false);
    return ValueValue === undefined ? Option.none() : Option.some(Make(self * ValueValue));
});

/**
 * Divides a byte size by a positive integer, discarding any remainder.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const divide: {
    /**
     * Divides a byte size by a positive integer, discarding any remainder.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (divisor: number | bigint): (self: ByteSize) => Option.Option<ByteSize>

    /**
     * Divides a byte size by a positive integer, discarding any remainder.
     *
     * @category Utilities
     * @since 1.0.0
     */
    (self: ByteSize, divisor: number | bigint): Option.Option<ByteSize>
} = dual(2, (self: ByteSize, divisor: number | bigint) =>
{
    const ValueValueValue = Scalar(divisor, true);
    return ValueValueValue === undefined ? Option.none() : Option.some(Make(self / ValueValueValue));
});

const ValidatePrecision = (precision: number): number =>
{
    if (!Number.isSafeInteger(precision) || precision < 0 || precision > 20)
    {
        throw new Error(`ByteSize format precision must be an integer from 0 to 20, received ${precision}`);
    }

    return precision;
};

const FormatWithUnit = (value: bigint, unit: UnitInfo, precision: number, trailingZeros: boolean): string =>
{
    const ScaleValue = BigInt(10) ** BigInt(precision);
    const Rounded = (value * ScaleValue * BigInt(2) + unit.factor) / (unit.factor * BigInt(2));
    const Whole = Rounded / ScaleValue;
    if (precision === 0) {return `${Whole} ${unit.symbol}`;}

    let fraction = `${Rounded % ScaleValue}`.padStart(precision, "0");
    if (!trailingZeros) {fraction = fraction.replace(/0+$/, "");}

    return `${Whole}${fraction.length === 0 ? "" : `.${fraction}`} ${unit.symbol}`;
};

/**
 * Formats a byte size with canonical decimal or binary unit symbols.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const format = (self: ByteSize, options: FormatOptions = {}): string =>
{
    const Precision = ValidatePrecision(options.precision ?? 2);
    const TrailingZeros = options.trailingZeros ?? false;
    if (options.unit !== undefined)
    {
        return FormatWithUnit(self, UnitsBySymbol.get(options.unit)!, Precision, TrailingZeros);
    }

    const Units = options.system === "decimal" ? DecimalUnits : BinaryUnits;
    if (self === Bigint0) {return "0 B";}

    let index = Units.length - 1;
    while (index > 0 && self < Units[index].factor) {index--;}

    if (index < Units.length - 1)
    {
        const ScaleValueValue = BigInt(10) ** BigInt(Precision);
        const RoundedValue = (self * ScaleValueValue * BigInt(2) + Units[index].factor) / (Units[index].factor * BigInt(2));
        const Base = options.system === "decimal" ? DecimalBase : BinaryBase;
        if (RoundedValue >= Base * ScaleValueValue) {index++;}
    }

    return FormatWithUnit(self, Units[index], Precision, TrailingZeros);
};

/**
 * Reducer that sums byte sizes from zero.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ReducerSum: Reducer.Reducer<ByteSize> = BI.ReducerSum as any;

/**
 * Combiner that keeps the largest byte size.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CombinerMax: Combiner.Combiner<ByteSize> = BI.CombinerMax as any;

/**
 * Combiner that keeps the smallest byte size.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CombinerMin: Combiner.Combiner<ByteSize> = BI.CombinerMin as any;

/* Preserve multiple statements in upstream traversal loops. */

