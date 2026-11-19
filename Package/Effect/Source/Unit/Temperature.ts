/**
 * Absolute temperatures, stored in kelvins, and relative temperature deltas,
 * measured in Celsius degrees.
 *
 * Every constructor and converter accepts each numeric kind that `Quantity`
 * does: a float, an `Int`, a `Rational`, a `bigint`, a `BigRational` or a
 * `BigDecimal`. A temperature stores a float, a `Rational` or a
 * `BigRational`, and operations on two temperatures follow `Quantity`'s rule
 * for mixed kinds.
 *
 * Ported from effect-units 1.0.1, merging its `Temperature` and
 * `TemperatureExact` modules.
 *
 * @module @bedform/effect/Unit/Temperature
 *
 * @file      Temperature.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units property order. */
/* eslint-disable sort-keys */

import * as BigRational from "../BigRational.js";
import * as Equal from "../Equal.js";
import * as Function from "../Function.js";
import * as Hash from "../Hash.js";
import type * as Inspectable from "../Inspectable.js";
import * as Numeric from "./Internal/numeric.js";
import * as Option from "../Option.js";
import * as Ord from "../Order.js";
import type * as Pipeable from "../Pipeable.js";
import * as Predicate from "../Predicate.js";
import * as Quantity from "./Quantity.js";
import type * as Rational from "../Rational.js";
import * as Schema from "../Schema.js";
import * as SchemaTransformation from "../SchemaTransformation.js";

import { ValueObjectProto } from "../Internal/valueObject.js";

/**
 * The runtime brand carried by every `Temperature`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const TypeId = Symbol.for("effect-units/Temperature");

/**
 * The type of the runtime brand carried by every `Temperature`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export type TypeId = typeof TypeId;

/**
 * An absolute temperature (a point on the thermodynamic temperature scale,
 * stored in kelvins), whose value has kind `K`, a float by default. Unlike a
 * temperature `Delta`, an absolute temperature is not a `Quantity`—it makes
 * no sense to add two absolute temperatures, for example.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Temperature<K extends Quantity.Value = number>
    extends Equal.Equal, Inspectable.Inspectable, Pipeable.Pipeable
{
    readonly [TypeId]: TypeId;
    readonly value: K;
}

/**
 * Checks whether a value is a `Temperature` of any kind.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isTemperature = (u: unknown): u is Temperature<Quantity.Value> =>
    Predicate.hasProperty(u, TypeId);

const Proto = {
    ...ValueObjectProto,
    [TypeId]: TypeId,
    [Equal.symbol](this: Temperature<Quantity.Value>, that: unknown): boolean
    {
        return isTemperature(that) && Numeric.equalsStructural(this.value, that.value);
    },
    [Hash.symbol](this: Temperature<Quantity.Value>): number
    {
        return Numeric.hash(this.value);
    },
    toJSON(this: Temperature<Quantity.Value>)
    {
        return { _id: "Temperature",
            value: Numeric.encode(this.value) };
    }
} as const;

const make = <K extends Quantity.Value = number>(
    value: Quantity.Input
): Temperature<K> =>
    Object.assign(Object.create(Proto), { value: Numeric.normalize(value) });

/**
 * Checks whether two temperatures are equal, treating NaN as equal to itself.
 * A float compared with an exact value is compared as a float.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equals = <A extends Quantity.Value, B extends Quantity.Value>(
    a: Temperature<A>,
    b: Temperature<B>
): boolean =>
    (Numeric.isNaN(a.value) && Numeric.isNaN(b.value)) ||
    Numeric.compare(a.value, b.value) === 0;

/**
 * The single definition of the wire format, shared by
 * {@link TemperatureFromStructOf} and by the `toCodecJson` annotation on
 * {@link TemperatureOf}, so the two can never drift apart.
 *
 * The wire format carries a `unit: "Kelvins"` discriminator so persisted
 * temperatures are self-describing, matching the `{ unit, value }`
 * convention of `Quantity` schemas. As with quantities, a float value must be
 * finite, and an exact value is the canonical rational string.
 */
const wire = <K extends Quantity.Value>(value: Quantity.ValueSchema) =>
{
    const struct = Schema.Struct({
        unit: Schema.Literal("Kelvins"),
        value: Numeric.valueCodec(value)
    });
    return {
        struct,
        transformation: SchemaTransformation.transform({
            decode: ({ value: v }: typeof struct.Type) => make<K>(v),
            encode: ({ value: v }: Temperature<K>) => ({ unit: "Kelvins" as const,
                value: v as Quantity.Value })
        })
    };
};

/**
 * The identity schema for temperatures of the kind that `value` decodes to:
 * `TemperatureOf(Schema.Finite)` holds floats, and
 * `TemperatureOf(BigRational.BigRational)` holds `BigRational`s.
 *
 * It carries the wire format as its canonical JSON representation, so
 * `Schema.toCodecJson` derives that codec on demand—including when a
 * temperature is nested inside a larger schema of your own.
 * {@link TemperatureFromStructOf} is the same codec named directly, with a
 * precise `{ unit, value }` encoded type rather than `Json`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const TemperatureOf = <S extends Quantity.ValueSchema>(value: S) =>
{
    const isValue = Numeric.isKind(value);
    return Schema.declare(
        (u: unknown): u is Temperature<Quantity.ValueOf<S>> =>
            isTemperature(u) && isValue(u.value),
        {
            identifier: "Temperature",
            description: "an absolute temperature",
            toCodecJson: () =>
            {
                const { struct, transformation } = wire<Quantity.ValueOf<S>>(value);
                return Schema.link<Temperature<Quantity.ValueOf<S>>>()(struct, transformation);
            }
        }
    );
};

/**
 * The codec between temperatures of the kind that `value` decodes to and
 * their `{ unit: "Kelvins", value }` encoding.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const TemperatureFromStructOf = <S extends Quantity.ValueSchema>(value: S) =>
{
    const { struct, transformation } = wire<Quantity.ValueOf<S>>(value);
    return struct.pipe(Schema.decodeTo(TemperatureOf(value), transformation));
};

/**
 * The identity schema for float temperatures; see {@link TemperatureOf}.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Temperature = TemperatureOf(Schema.Finite);

/**
 * The codec between float temperatures and their `{ unit: "Kelvins", value }`
 * encoding, with a finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const TemperatureFromStruct = TemperatureFromStructOf(Schema.Finite);

// Absolute temperatures

/**
 * Creates a `Temperature` from a number of kelvins.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const kelvins = <N extends Quantity.Input>(n: N): Temperature<Quantity.Of<N>> =>
    make(n);

/**
 * Converts a `Temperature` to a number of kelvins.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inKelvins = <K extends Quantity.Value>(t: Temperature<K>): K => t.value;

/**
 * Absolute zero, 0 kelvins.
 *
 * @category Constants
 * @since 1.0.0
 */
export const absoluteZero = kelvins(0);

const zeroCelsiusInKelvins = 273.15;

const zeroCelsiusInKelvinsExact = BigRational.makeUnsafe(5_463n, 20n);

/**
 * Creates a `Temperature` from a number of degrees Celsius.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const degreesCelsius = <N extends Quantity.Input>(
    n: N
): Temperature<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make(n + zeroCelsiusInKelvins)
        : make(Numeric.sumExact(n, zeroCelsiusInKelvinsExact));

/**
 * Converts a `Temperature` to a number of degrees Celsius.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDegreesCelsius = <K extends Quantity.Value>(t: Temperature<K>): K =>
    (Predicate.isNumber(t.value)
        ? t.value - zeroCelsiusInKelvins
        : Numeric.subtractExact(t.value, zeroCelsiusInKelvinsExact)) as K;

/** The size of a Fahrenheit degree relative to a Celsius degree. */
const fiveNinths = 5 / 9;

const fiveNinthsExact = BigRational.makeUnsafe(5n, 9n);

const thirtyTwoExact = BigRational.makeUnsafe(32n);

/**
 * Creates a `Temperature` from a number of degrees Fahrenheit.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const degreesFahrenheit = <N extends Quantity.Input>(
    n: N
): Temperature<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? make((n - 32) * fiveNinths + zeroCelsiusInKelvins)
        : make(
            Numeric.sumExact(
                Numeric.multiplyExact(Numeric.subtractExact(n, thirtyTwoExact), fiveNinthsExact),
                zeroCelsiusInKelvinsExact
            )
        );

/**
 * Converts a `Temperature` to a number of degrees Fahrenheit.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inDegreesFahrenheit = <K extends Quantity.Value>(t: Temperature<K>): K =>
    (Predicate.isNumber(t.value)
        ? (t.value - zeroCelsiusInKelvins) / fiveNinths + 32
        : Numeric.sumExact(
            Numeric.divideExact(inDegreesCelsius(t), fiveNinthsExact),
            thirtyTwoExact
        )) as K;

// Deltas

/**
 * A difference between two temperatures, whose value has kind `K`, a float by
 * default. Unlike an absolute `Temperature`, a `Delta` is an ordinary
 * `Quantity` and participates in the usual quantity arithmetic.
 *
 * Note the deliberate word order, following `elm-units` and standard
 * metrology usage: "degrees Celsius" (`degreesCelsius`) is a point on the
 * scale, while "Celsius degrees" (`celsiusDegrees`) is a number of
 * scale-sized intervals—a rise of 5 Celsius degrees, from 20 degrees
 * Celsius to 25.
 *
 * @category Types
 * @since 1.0.0
 */
export type Delta<K extends Quantity.Value = number> = Quantity.Quantity<"CelsiusDegrees", K>;

/**
 * The identity schema for `Delta` values. Its canonical JSON representation is `{
 * unit, value }` with a finite numeric value, so `Schema.toCodecJson` derives that
 * codec on demand.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Delta = Quantity.Quantity("CelsiusDegrees");

/**
 * The codec between `Delta` values and their `{ unit, value }` encoding, with a
 * finite numeric value.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const DeltaFromStruct = Quantity.QuantityFromStruct("CelsiusDegrees");

const makeDelta = <K extends Quantity.Value = number>(value: Quantity.Input): Delta<K> =>
    Quantity.make("CelsiusDegrees", value) as Delta<K>;

/**
 * Creates a `Delta` from a number of Celsius degrees.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const celsiusDegrees = <N extends Quantity.Input>(n: N): Delta<Quantity.Of<N>> =>
    makeDelta(n);

/**
 * Converts a `Delta` to a number of Celsius degrees.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inCelsiusDegrees = <K extends Quantity.Value>(d: Delta<K>): K => d.value;

/**
 * Creates a `Delta` from a number of Fahrenheit degrees.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const fahrenheitDegrees = <N extends Quantity.Input>(
    n: N
): Delta<Quantity.Of<N>> =>
    Predicate.isNumber(n)
        ? makeDelta(n * fiveNinths)
        : makeDelta(Numeric.multiplyExact(n, fiveNinthsExact));

/**
 * Converts a `Delta` to a number of Fahrenheit degrees.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const inFahrenheitDegrees = <K extends Quantity.Value>(d: Delta<K>): K =>
    (Predicate.isNumber(d.value)
        ? d.value / fiveNinths
        : Numeric.divideExact(d.value, fiveNinthsExact)) as K;

// Arithmetic

/**
 * Raises or lowers a temperature by a temperature `Delta`.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const plus: {
    <B extends Quantity.Value>(
        delta: Delta<B>,
    ): <A extends Quantity.Value>(t: Temperature<A>) => Temperature<Quantity.Join<A, B>>;
    <A extends Quantity.Value, B extends Quantity.Value>(
        t: Temperature<A>,
        delta: Delta<B>,
    ): Temperature<Quantity.Join<A, B>>;
} = Function.dual(
    2,
    (
        t: Temperature<Quantity.Value>,
        delta: Delta<Quantity.Value>
    ): Temperature<Quantity.Value> => make(Numeric.sum(t.value, delta.value))
);

/**
 * The delta from `b` up to `a` (i.e. `a` minus `b`).
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const minus: {
    <B extends Quantity.Value>(
        b: Temperature<B>,
    ): <A extends Quantity.Value>(a: Temperature<A>) => Delta<Quantity.Join<A, B>>;
    <A extends Quantity.Value, B extends Quantity.Value>(
        a: Temperature<A>,
        b: Temperature<B>,
    ): Delta<Quantity.Join<A, B>>;
} = Function.dual(
    2,
    (a: Temperature<Quantity.Value>, b: Temperature<Quantity.Value>): Delta<Quantity.Value> =>
        makeDelta(Numeric.subtract(a.value, b.value))
);

// Kind conversions

/**
 * The exact image of a temperature as a `BigRational`—lossless, since every
 * finite double is a dyadic rational. Returns `Option.none()` for NaN and
 * ±Infinity, which have no rational image.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRational = <K extends Quantity.Value>(
    t: Temperature<K>
): Option.Option<Temperature<BigRational.BigRational>> =>
    Option.map(Numeric.toBigRational(t.value), (value: BigRational.BigRational) =>
        make<BigRational.BigRational>(value));

/**
 * Like {@link toBigRational}, but throws for NaN and ±Infinity.
 *
 * @throws { RangeError } On NaN and ±Infinity values.
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRationalUnsafe = <K extends Quantity.Value>(
    t: Temperature<K>
): Temperature<BigRational.BigRational> =>
    Option.getOrThrowWith(
        toBigRational(t),
        () => new RangeError(`Temperature.toBigRationalUnsafe: ${Numeric.encode(t.value)}`)
    );

/**
 * The exact image of a temperature as a `Rational`. Returns `Option.none()`
 * for NaN and ±Infinity, and when the exact value does not fit in safe
 * integers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toRational = <K extends Quantity.Value>(
    t: Temperature<K>
): Option.Option<Temperature<Rational.Rational>> =>
    Option.map(Numeric.toRational(t.value), (value: Rational.Rational) =>
        make<Rational.Rational>(value));

/**
 * Like {@link toRational}, but throws where it returns `Option.none()`.
 *
 * @throws { RangeError } When the value has no exact image with safe-integer
 * parts.
 * @category Conversions
 * @since 1.0.0
 */
export const toRationalUnsafe = <K extends Quantity.Value>(
    t: Temperature<K>
): Temperature<Rational.Rational> =>
    Option.getOrThrowWith(
        toRational(t),
        () => new RangeError(`Temperature.toRationalUnsafe: ${Numeric.encode(t.value)}`)
    );

/**
 * The float temperature nearest the given one—a single correct rounding of
 * an exact value. Returns `Option.none()` when an exact value overflows to
 * ±Infinity; a float temperature is returned unchanged.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toNumber = <K extends Quantity.Value>(
    t: Temperature<K>
): Option.Option<Temperature> =>
{
    const value: Quantity.Value = t.value;
    if (Predicate.isNumber(value))
    {
        return Option.some(t as Temperature);
    }

    const float = Numeric.toFloat(value);
    return Number.isFinite(float) ? Option.some(make(float)) : Option.none();
};

/**
 * Like {@link toNumber}, but throws when an exact value overflows to
 * ±Infinity.
 *
 * @throws { RangeError } When the value overflows to ±Infinity.
 * @category Conversions
 * @since 1.0.0
 */
export const toNumberUnsafe = <K extends Quantity.Value>(t: Temperature<K>): Temperature =>
    Option.getOrThrowWith(
        toNumber(t),
        () => new RangeError(`Temperature.toNumberUnsafe: ${Numeric.encode(t.value)} overflows`)
    );

// Comparison

/**
 * Orders temperatures from coldest to hottest. A float compared with an exact
 * value is compared as a float, and NaN compares equal to everything, as it
 * does in `Number.Order`.
 *
 * @category Instances
 * @since 1.0.0
 */
export const Order: Ord.Order<Temperature<Quantity.Value>> = Ord.make((
    a: Temperature<Quantity.Value>,
    b: Temperature<Quantity.Value>
) =>
{
    const comparison = Numeric.compare(a.value, b.value);
    return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
});

/**
 * Checks whether the first temperature is colder than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan = Ord.isLessThan(Order);

/**
 * Checks whether the first temperature is colder than or as cold as the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo = Ord.isLessThanOrEqualTo(Order);

/**
 * Checks whether the first temperature is hotter than the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan = Ord.isGreaterThan(Order);

/**
 * Checks whether the first temperature is hotter than or as hot as the second.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo = Ord.isGreaterThanOrEqualTo(Order);

/**
 * Returns the colder of two temperatures, unchanged.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min: {
    <B extends Quantity.Value>(
        b: Temperature<B>,
    ): <A extends Quantity.Value>(a: Temperature<A>) => Temperature<A | B>;
    <A extends Quantity.Value, B extends Quantity.Value>(
        a: Temperature<A>,
        b: Temperature<B>,
    ): Temperature<A | B>;
} = Ord.min(Order);

/**
 * Returns the hotter of two temperatures, unchanged.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max: {
    <B extends Quantity.Value>(
        b: Temperature<B>,
    ): <A extends Quantity.Value>(a: Temperature<A>) => Temperature<A | B>;
    <A extends Quantity.Value, B extends Quantity.Value>(
        a: Temperature<A>,
        b: Temperature<B>,
    ): Temperature<A | B>;
} = Ord.max(Order);

/**
 * Restricts a temperature to the inclusive range between `minimum` and
 * `maximum`, returning one of the three unchanged.
 *
 * @category Operation
 * @since 1.0.0
 */
export const clamp: {
    (options: {
        readonly minimum: Temperature<Quantity.Value>;
        readonly maximum: Temperature<Quantity.Value>;
    }): (t: Temperature<Quantity.Value>) => Temperature<Quantity.Value>;
    (
        t: Temperature<Quantity.Value>,
        options: { readonly minimum: Temperature<Quantity.Value>;
            readonly maximum: Temperature<Quantity.Value> },
    ): Temperature<Quantity.Value>;
} = Ord.clamp(Order);
