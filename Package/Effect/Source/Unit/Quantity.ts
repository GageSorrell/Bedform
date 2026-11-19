/**
 * Typed quantity values: a number tagged with a unit tree, with arithmetic and
 * the unit algebra (`times`, `squared`, `cubed`, `per`, `at`, `over`, `ratio`
 * and so on).
 *
 * A quantity's value is a 64-bit float, an `@bedform/effect/Rational` or an
 * `@bedform/effect/BigRational` (its *kind*); `make` also accepts a `bigint` or
 * a `BigDecimal`, which become a `BigRational`. Every operation tests whether
 * its operands are floats first and then dispatches on the exact kinds. A
 * float operand makes a result a float; two exact operands give a `Rational`
 * when both are `Rational`s and a `BigRational` otherwise. Float division
 * follows IEEE semantics; exact division returns `Option`, since the
 * rationals have no infinities, and each dividing operation has an `Unsafe`
 * counterpart that throws instead.
 *
 * Ported from effect-units 1.0.1, merging its `Quantity` and `QuantityExact`
 * modules.
 *
 * @module @bedform/effect/Unit/Quantity
 *
 * @file      Quantity.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units generics and contextual inference and import and property order. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef, sort-imports */

import * as BigDecimal from "../BigDecimal.js";
import * as BigRational from "../BigRational.js";
import * as Equal from "../Equal.js";
import * as Function from "../Function.js";
import * as Hash from "../Hash.js";
import type * as Inspectable from "../Inspectable.js";
import * as Option from "../Option.js";
import type * as Pipeable from "../Pipeable.js";
import * as Predicate from "../Predicate.js";
import * as Rational from "../Rational.js";
import * as Schema from "../Schema.js";
import * as SchemaTransformation from "../SchemaTransformation.js";

import { ValueObjectProto } from "../Internal/valueObject.js";
import {
    isUnitless,
    leftFactorOf,
    rightFactorOf
} from "./Internal/dimensionless.js";
import * as Numeric from "./Internal/numeric.js";
import * as Unit from "./Unit.js";

/**
 * The runtime brand carried by every `Quantity`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export const TypeId = Symbol.for("effect-units/Quantity");

/**
 * The type of the runtime brand carried by every `Quantity`.
 *
 * @category Symbols
 * @since 1.0.0
 */
export type TypeId = typeof TypeId;

// Kinds

/**
 * A value a quantity can store: a float, a `Rational` or a `BigRational`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Value = Numeric.Value;

/**
 * A numeric argument the unit functions accept: any stored kind, a `bigint` or
 * a `BigDecimal`.
 *
 * @category Types
 * @since 1.0.0
 */
export type Input = Numeric.Input;

/**
 * The stored kind an argument of kind `N` produces: `number` for a float,
 * `Rational` for a `Rational`, and `BigRational` for every other kind.
 *
 * @category Types
 * @since 1.0.0
 */
export type Of<N> = Numeric.Of<N>;

/**
 * The kind of a result computed from operands of kinds `A` and `B`: a float if
 * either is a float, a `Rational` if both are `Rational`s, and a `BigRational`
 * otherwise.
 *
 * @category Types
 * @since 1.0.0
 */
export type Join<A, B> = Numeric.Join<A, B>;

/**
 * The result of a dividing operation whose result kind is `V`: a float
 * quantity, following IEEE semantics, or an `Option` of an exact quantity,
 * which is `none` on division by zero.
 *
 * @category Types
 * @since 1.0.0
 */
export type Quotient<U extends Unit.Unit, V> = V extends number
    ? Quantity<U, number>
    : Option.Option<Quantity<U, Extract<V, Value>>>;

/**
 * The value schemas a quantity schema accepts: `Schema.Finite` for floats,
 * `Rational.Rational` and `BigRational.BigRational` for exact values.
 *
 * @category Schemas
 * @since 1.0.0
 */
export type ValueSchema = Numeric.ValueSchema;

/**
 * The stored kind a value schema decodes to.
 *
 * @category Schemas
 * @since 1.0.0
 */
export type ValueOf<S extends ValueSchema> = Numeric.ValueOf<S>;

/**
 * The single definition of the `{ unit, value }` wire format, shared by
 * {@link QuantityFromStruct} and by the `toCodecJson` annotation on
 * {@link Quantity}, so the two can never drift apart.
 *
 * The value is a finite number for floats and the canonical rational string
 * (`"3/2"`) for exact values. The float wire format only admits finite
 * values: NaN and ±Infinity (which in-memory arithmetic produces under IEEE
 * semantics) fail loudly at encode rather than corrupting silently through
 * JSON (where they would become `null`).
 */
const wire = <const U extends Unit.Unit, V extends Value>(
    unit: U,
    value: ValueSchema
) =>
{
    const struct = Schema.Struct({
        unit: Schema.Literal(Unit.encode(unit)),
        value: Numeric.valueCodec(value)
    });
    return {
        struct,
        transformation: SchemaTransformation.transform({
            decode: ({ value: v }: typeof struct.Type) =>
                make(unit, v) as Quantity<U, V>,
            encode: ({ value: v }: Quantity<U, V>) => ({
                unit: Unit.encode(unit),
                value: v as Value
            })
        })
    };
};

/**
 * The identity schema: a `Quantity` in `unit` on both sides, decoded from
 * itself. The optional value schema picks the kind, and defaults to floats:
 * `Quantity(Meters)` holds floats, `Quantity(Meters, BigRational.BigRational)`
 * holds `BigRational`s.
 *
 * It carries the wire format as its canonical JSON representation, so
 * `Schema.toCodecJson` derives that codec on demand—including when a
 * quantity is nested inside a larger schema of your own.
 * {@link QuantityFromStruct} is the same codec named directly, with a
 * precise `{ unit, value }` encoded type rather than `Json`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Quantity = <
    const U extends Unit.Unit,
    S extends ValueSchema = typeof Schema.Finite
>(
    unit: U,
    value: S = Schema.Finite as S
) =>
    Schema.declare(hasUnitAndKind<U, ValueOf<S>>(unit, value), {
        toCodecJson: () =>
        {
            const { struct, transformation } = wire<U, ValueOf<S>>(unit, value);
            return Schema.link<Quantity<U, ValueOf<S>>>()(struct, transformation);
        }
    });

/**
 * Encodes a quantity as `{ unit, value }`, with a finite numeric value for
 * floats and the canonical rational string for exact values. A custom unit's
 * ID is part of this storage contract, including inside products and rates.
 * Renaming that ID requires migrating persisted data; renaming a variable or
 * type alias while retaining the ID does not.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const QuantityFromStruct = <
    const U extends Unit.Unit,
    S extends ValueSchema = typeof Schema.Finite
>(
    unit: U,
    value: S = Schema.Finite as S
) =>
{
    const { struct, transformation } = wire<U, ValueOf<S>>(unit, value);
    return struct.pipe(Schema.decodeTo(Quantity(unit, value), transformation));
};

/**
 * Encodes only the value; the unit is supplied by the schema. Use when an
 * existing wire format already fixes the unit out of band. Changing that unit
 * or its base scale changes the meaning of stored data. The identity schema's
 * canonical JSON representation remains `{ unit, value }`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const QuantityFromValue = <
    const U extends Unit.Unit,
    S extends ValueSchema = typeof Schema.Finite
>(
    unit: U,
    value: S = Schema.Finite as S
) =>
    Numeric.valueCodec(value).pipe(
        Schema.decodeTo(
            Quantity(unit, value),
            SchemaTransformation.transform({
                decode: (v: Value) => make(unit, v) as Quantity<U, ValueOf<S>>,
                encode: (quantity: Quantity<U, ValueOf<S>>) => quantity.value as Value
            })
        )
    );

/**
 * Checks a quantity against an inclusive bound in the same units.
 * Use with a quantity schema's `.check(...)`. NaN fails; infinities follow
 * the comparison predicates and are still rejected by the wire codecs.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const greaterThanOrEqualTo = <U extends Unit.Unit, V extends Value>(
    bound: Quantity<U, V>,
    annotations?: Schema.Annotations.Filter
) =>
    Schema.makeFilter<Quantity<U, Value>>(
        (quantity) =>
            Unit.equals(quantity.unit, bound.unit) &&
      isGreaterThanOrEqualTo(quantity, bound),
        {
            expected: `a quantity greater than or equal to ${Numeric.encode(bound.value)} ${
                Unit.encode(bound.unit)
            }`,
            ...annotations
        }
    );

/**
 * Adds a strictly-positive check without changing a schema's encoded form,
 * services, or existing checks. NaN fails; positive infinity passes this
 * check but cannot be encoded by the finite wire codecs.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const positive = <S extends Schema.Schema<Quantity<Unit.Unit, Value>>>(
    schema: S,
    annotations?: Schema.Annotations.Filter
): S["Rebuild"] =>
    schema.check(
        Schema.makeFilter<Quantity<Unit.Unit, Value>>(
            (quantity) =>
                Numeric.compare(quantity.value, Rational.zero) > 0 ||
        (annotations?.message ??
          annotations?.expected ??
          `Expected a positive quantity in ${Unit.encode(quantity.unit)}`),
            annotations
        )
    );

/**
 * Adds a non-negative check, preserving the schema just like {@link positive}.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const nonNegative = <S extends Schema.Schema<Quantity<Unit.Unit, Value>>>(
    schema: S,
    annotations?: Schema.Annotations.Filter
): S["Rebuild"] =>
    schema.check(
        Schema.makeFilter<Quantity<Unit.Unit, Value>>(
            (quantity) =>
                Numeric.compare(quantity.value, Rational.zero) >= 0 ||
        (annotations?.message ??
          annotations?.expected ??
          `Expected a non-negative quantity in ${Unit.encode(quantity.unit)}`),
            annotations
        )
    );

/**
 * A quantity is a value of kind `V` tagged with a unit tree. Float arithmetic
 * follows IEEE 754 semantics: division by zero yields ±Infinity, and invalid
 * operations yield NaN—check with {@link isNaN} and {@link isInfinite}.
 * Exact arithmetic is exact, and its divisions return `Option`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Quantity<U extends Unit.Unit, V extends Value = number>
    extends Equal.Equal, Inspectable.Inspectable, Pipeable.Pipeable {
    readonly [TypeId]: TypeId;
    readonly unit: U;
    readonly value: V;
}

type QuantityUnit<Q> = [Q] extends [Quantity<infer U, Value>] ? U : never;
type QuantityValue<Q> = [Q] extends [Quantity<Unit.Unit, infer V>] ? V : never;
type QuantityInput<Q> = Q & Quantity<Unit.Unit, Value>;

const isQuantity = (u: unknown): u is Quantity<Unit.Unit, Value> =>
    Predicate.hasProperty(u, TypeId);

const hasUnitAndKind =
    <U extends Unit.Unit, V extends Value>(unit: U, value: ValueSchema) =>
    {
        const isValue = Numeric.isKind(value);
        return (u: unknown): u is Quantity<U, V> =>
            isQuantity(u) && Unit.equals(u.unit, unit) && isValue(u.value);
    };

// `Unitless` is the identity of the unit algebra, so `times`, `over`,
// `over_`, `squared`, and `cubed` fold a dimensionless operand away rather
// than composing with it: the algebra never produces a `Product` with a
// `Unitless` factor. Each carries an overload for the dimensionless case
// ahead of its general one, so at any call site whose units are known the
// static type follows the runtime.
//
// Where the two part company is code generic in its units: a `Quantity<U2>`
// whose `U2` is still a type variable selects the general overload even when
// `U2` is later instantiated with `"Unitless"`, so `times` is typed
// `Product<U1, U2>` while the runtime folds. The type overstates the
// structure; the value stays coherent, because `over` and `over_` undo the
// fold instead of trusting the type (see `leftFactorOf`). Keep units precise
// and the two agree.

const Proto = {
    ...ValueObjectProto,
    [TypeId]: TypeId,
    [Equal.symbol](this: Quantity<Unit.Unit, Value>, that: unknown): boolean
    {
        return (
            isQuantity(that) &&
            Numeric.equalsStructural(this.value, that.value) &&
            Unit.equals(this.unit, that.unit)
        );
    },
    [Hash.symbol](this: Quantity<Unit.Unit, Value>): number
    {
        return Hash.combine(Hash.string(Unit.encode(this.unit)))(
            Numeric.hash(this.value)
        );
    },
    toJSON(this: Quantity<Unit.Unit, Value>)
    {
        return {
            _id: "Quantity",
            unit: Unit.encode(this.unit),
            value: Numeric.encode(this.value)
        };
    }
} as const;

/**
 * Creates a quantity of `value` in `unit`. A `bigint` or `BigDecimal` value
 * becomes a `BigRational`; negative zero becomes zero.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const make = <U extends Unit.Unit, N extends Input>(
    unit: U,
    value: N
): Quantity<U, Of<N>> =>
    Object.assign(Object.create(Proto), {
        unit,
        value: Numeric.normalize(value)
    });

/** Builds a quantity from an already stored value, for the operations below. */
const of = <U extends Unit.Unit>(unit: U, value: Value): Quantity<U, any> =>
    make(unit, value);

/** Divides under the kind rule, returning a float quantity or an `Option`. */
const quotient = <R>(
    a: Value,
    b: Value,
    build: (value: Value) => R
): R | Option.Option<R> =>
{
    const value = Numeric.divide(a, b);
    if (Numeric.isFloatDivision(a, b))
    {
        return build(value as number);
    }

    return value === undefined ? Option.none() : Option.some(build(value));
};

/**
 * Divides under the kind rule, throwing on an exact division by zero.
 *
 * @throws { RangeError } On an exact division by zero.
 */
const quotientUnsafe = <R>(a: Value, b: Value, build: (value: Value) => R): R =>
{
    const value = Numeric.divide(a, b);
    if (value === undefined)
    {
        throw new RangeError("Division by zero");
    }

    return build(value);
};

/**
 * Converts a decimal in the quantity's base units to the nearest double,
 * rounding once via Effect's decimal-to-number conversion. Overflow yields
 * ±Infinity; underflow can yield zero, following the float track's semantics.
 * Shift a decimal's scale before this boundary, not by multiplying the float.
 * For an exact quantity from a decimal, pass the `BigDecimal` to {@link make}.
 *
 * A decimal with at most 15 significant digits whose nonzero magnitude is
 * in the normal finite double range round-trips numerically through
 * {@link toBigDecimal}. This does not preserve trailing zeros or make
 * subsequent quantity arithmetic exact. Subnormal values have no such guarantee.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const fromBigDecimal = (<U extends Unit.Unit>(
    unit: U,
    value?: BigDecimal.BigDecimal
): Quantity<U> | ((value: BigDecimal.BigDecimal) => Quantity<U>) =>
{
    return value === undefined
        ? (decimal) => make(unit, BigDecimal.toNumberUnsafe(decimal))
        : make(unit, BigDecimal.toNumberUnsafe(value));
}) as {
    <U extends Unit.Unit>(
        unit: U
    ): (value: BigDecimal.BigDecimal) => Quantity<U>;
    <U extends Unit.Unit>(
        unit: U,
        value: BigDecimal.BigDecimal
    ): Quantity<U>;
};

/**
 * Converts a quantity's value to a `BigDecimal`. For a float this reads the
 * double's shortest round-tripping decimal representation, and returns `None`
 * for NaN and ±Infinity; this recovers decimal input under
 * {@link fromBigDecimal}'s conditions, not the exact binary fraction stored in
 * the double (for that, use {@link toBigRational}). An exact value converts
 * without rounding when its decimal expansion terminates, and returns `None`
 * otherwise (1/3, for example).
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigDecimal = <U extends Unit.Unit, V extends Value>(
    quantity: Quantity<U, V>
): Option.Option<BigDecimal.BigDecimal> =>
{
    const value: Value = quantity.value;
    if (Predicate.isNumber(value))
    {
        return BigDecimal.fromNumber(value);
    }

    return Rational.isRational(value)
        ? Rational.toBigDecimalExact(value)
        : BigRational.toBigDecimalExact(value);
};

// Conversions between kinds

/**
 * The exact image of a quantity as a `BigRational`—lossless, since every
 * finite double is a dyadic rational. Returns `Option.none()` for NaN and
 * ±Infinity, which have no rational image.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRational = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Option.Option<Quantity<U, BigRational.BigRational>> =>
    Option.map(Numeric.toBigRational(q.value), (value) => make(q.unit, value));

/**
 * Like {@link toBigRational}, but throws for NaN and ±Infinity.
 *
 * @throws { RangeError } On NaN and ±Infinity values.
 * @category Conversions
 * @since 1.0.0
 */
export const toBigRationalUnsafe = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Quantity<U, BigRational.BigRational> =>
    Option.getOrThrowWith(
        toBigRational(q),
        () => new RangeError(`Quantity.toBigRationalUnsafe: ${Numeric.encode(q.value)}`)
    );

/**
 * The exact image of a quantity as a `Rational`. Returns `Option.none()` for
 * NaN and ±Infinity, and when the exact value does not fit in safe integers.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toRational = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Option.Option<Quantity<U, Rational.Rational>> =>
    Option.map(Numeric.toRational(q.value), (value) => make(q.unit, value));

/**
 * Like {@link toRational}, but throws where it returns `Option.none()`.
 *
 * @throws { RangeError } When the value has no exact image with safe-integer
 * parts.
 * @category Conversions
 * @since 1.0.0
 */
export const toRationalUnsafe = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Quantity<U, Rational.Rational> =>
    Option.getOrThrowWith(
        toRational(q),
        () => new RangeError(`Quantity.toRationalUnsafe: ${Numeric.encode(q.value)}`)
    );

/**
 * The float quantity nearest the given one—a single correct rounding of an
 * exact value. Returns `Option.none()` when an exact value overflows to
 * ±Infinity; a float quantity is returned unchanged.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const toNumber = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Option.Option<Quantity<U>> =>
{
    const value: Value = q.value;
    if (Predicate.isNumber(value))
    {
        return Option.some(q as Quantity<U, number>);
    }

    const float = Numeric.toFloat(value);
    return Number.isFinite(float) ? Option.some(make(q.unit, float)) : Option.none();
};

/**
 * Like {@link toNumber}, but throws when an exact value overflows to ±Infinity.
 *
 * @throws { RangeError } When the value overflows to ±Infinity.
 * @category Conversions
 * @since 1.0.0
 */
export const toNumberUnsafe = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): Quantity<U> =>
    Option.getOrThrowWith(
        toNumber(q),
        () => new RangeError(`Quantity.toNumberUnsafe: ${Numeric.encode(q.value)} overflows`)
    );

// Equality

/**
 * Exact equality: numerically equal values and structurally equal units. A
 * float compared with an exact value is compared as a float. NaN is equal to
 * itself, so equality is reflexive. For float quantities this is identity,
 * not "approximately the same measurement"—domain logic and tests usually
 * want {@link equalsWithin} instead.
 *
 * Unlike `Equal.equals`, this compares across kinds: a float 0.5 equals a
 * `Rational` 1/2 here, but they are not `Equal`.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equals = <U extends Unit.Unit, A extends Value, B extends Value>(
    a: Quantity<U, A>,
    b: Quantity<U, B>
): boolean =>
    ((Numeric.isNaN(a.value) && Numeric.isNaN(b.value)) ||
        Numeric.compare(a.value, b.value) === 0) &&
    Unit.equals(a.unit, b.unit);

/**
 * Tolerance-based equality: whether `a` and `b` differ by no more than
 * `tolerance` (a quantity in the same units). Identical values—including
 * two equal infinities—are always equal within any tolerance; NaN is
 * never equal to anything. With all three values exact, the comparison is
 * exact; otherwise it is made in floats.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equalsWithin: {
    <U extends Unit.Unit>(
        b: Quantity<U, Value>,
        tolerance: Quantity<U, Value>,
    ): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(
        a: Quantity<U, Value>,
        b: Quantity<U, Value>,
        tolerance: Quantity<U, Value>,
    ): boolean;
} = Function.dual(
    3,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>,
        tolerance: Quantity<Unit.Unit, Value>
    ): boolean =>
    {
        if (
            Predicate.isNumber(a.value) ||
            Predicate.isNumber(b.value) ||
            Predicate.isNumber(tolerance.value)
        )
        {
            const x = Numeric.toFloat(a.value);
            const y = Numeric.toFloat(b.value);
            return x === y || Math.abs(x - y) <= Math.abs(Numeric.toFloat(tolerance.value));
        }

        return (
            Numeric.compare(
                Numeric.abs(Numeric.subtract(a.value, b.value)),
                Numeric.abs(tolerance.value)
            ) <= 0
        );
    }
);

/**
 * Relative-tolerance equality: whether the absolute difference between `a`
 * and `b`, divided by their mean magnitude, is no more than `tolerance`.
 * This symmetric comparison is useful for two measurements of the same
 * quantity. Two zeroes are equal despite having no relative magnitude;
 * identical infinities are equal, while NaN and unequal infinities are not.
 * The comparison is made in floats, whatever the kinds.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equalsWithinRelative: {
    <U extends Unit.Unit>(
        b: Quantity<U, Value>,
        tolerance: Quantity<"Unitless", Value>,
    ): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(
        a: Quantity<U, Value>,
        b: Quantity<NoInfer<U>, Value>,
        tolerance: Quantity<"Unitless", Value>,
    ): boolean;
} = Function.dual(
    3,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>,
        tolerance: Quantity<"Unitless", Value>
    ): boolean =>
    {
        const x = Numeric.toFloat(a.value);
        const y = Numeric.toFloat(b.value);
        if (x === y)
        {
            return true;
        }

        const magnitudeA = Math.abs(x);
        const magnitudeB = Math.abs(y);
        const scale = Math.max(magnitudeA, magnitudeB);
        const difference = Math.abs(x / scale - y / scale);
        const meanMagnitude = (magnitudeA / scale + magnitudeB / scale) / 2;

        return difference / meanMagnitude <= Math.abs(Numeric.toFloat(tolerance.value));
    }
);

// Scalar arithmetic

/**
 * Scales a quantity by a plain number of any kind, in either argument order;
 * the unit is unchanged. Scaling an exact quantity by an exact scalar stays
 * exact, so `multiply(q, 3n)` loses nothing.
 *
 * @throws { RangeError } When a `Rational` product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const multiply: {
    <S extends Input>(
        b: S,
    ): <U extends Unit.Unit, V extends Value>(
        a: Quantity<U, V>
    ) => Quantity<U, Join<V, S>>;
    <U extends Unit.Unit, V extends Value, S extends Input>(
        a: Quantity<U, V>,
        b: S,
    ): Quantity<U, Join<V, S>>;

    <U extends Unit.Unit, V extends Value>(
        b: Quantity<U, V>,
    ): <S extends Input>(a: S) => Quantity<U, Join<S, V>>;
    <S extends Input, U extends Unit.Unit, V extends Value>(
        a: S,
        b: Quantity<U, V>,
    ): Quantity<U, Join<S, V>>;
    <Q, S extends Input>(
        a: QuantityInput<Q>,
        b: S,
    ): Quantity<QuantityUnit<Q>, Join<QuantityValue<Q>, S>>;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value> | Input,
        b: Quantity<Unit.Unit, Value> | Input
    ): Quantity<Unit.Unit, Value> =>
        isQuantity(a)
            ? of(a.unit, Numeric.multiply(a.value, Numeric.normalize(b as Input)))
            : of(
                (b as Quantity<Unit.Unit, Value>).unit,
                Numeric.multiply(
                    Numeric.normalize(a),
                    (b as Quantity<Unit.Unit, Value>).value
                )
            )
);

/**
 * Divides a quantity by a plain number of any kind. A float division yields
 * ±Infinity on division by zero (or NaN for 0/0); an exact division returns
 * `Option.none()` instead.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const divide: {
    <S extends Input>(
        b: S,
    ): <U extends Unit.Unit, V extends Value>(
        a: Quantity<U, V>
    ) => Quotient<U, Join<V, S>>;
    <U extends Unit.Unit, V extends Value, S extends Input>(
        a: Quantity<U, V>,
        b: S,
    ): Quotient<U, Join<V, S>>;
    <Q, S extends Input>(
        a: QuantityInput<Q>,
        b: S,
    ): Quotient<QuantityUnit<Q>, Join<QuantityValue<Q>, S>>;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Input) =>
        quotient(a.value, Numeric.normalize(b), (value) => of(a.unit, value))
);

/**
 * Like {@link divide}, but throws on an exact division by zero.
 *
 * @throws { RangeError } On an exact division by zero, or when a `Rational`
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const divideUnsafe: {
    <S extends Input>(
        b: S,
    ): <U extends Unit.Unit, V extends Value>(
        a: Quantity<U, V>
    ) => Quantity<U, Join<V, S>>;
    <U extends Unit.Unit, V extends Value, S extends Input>(
        a: Quantity<U, V>,
        b: S,
    ): Quantity<U, Join<V, S>>;
    <Q, S extends Input>(
        a: QuantityInput<Q>,
        b: S,
    ): Quantity<QuantityUnit<Q>, Join<QuantityValue<Q>, S>>;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Input): Quantity<Unit.Unit, Value> =>
        quotientUnsafe(a.value, Numeric.normalize(b), (value) => of(a.unit, value))
);

// Quantity arithmetic

/**
 * Adds two quantities in the same units.
 *
 * @throws { RangeError } When a `Rational` sum does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const sum: {
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<NoInfer<U>, B>,
    ): Quantity<U, Join<A, B>>;
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quantity<U, Join<A, B>>;
    <Q>(
        b: QuantityInput<Q>,
    ): [Q] extends [Quantity<infer U, infer B>]
        ? <A extends Value>(a: Quantity<U, A>) => Quantity<U, Join<A, B>>
        : never;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> => of(a.unit, Numeric.sum(a.value, b.value))
);

/**
 * Subtracts the second quantity from the first; both must be in the same units.
 *
 * @throws { RangeError } When a `Rational` difference does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const subtract: {
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<NoInfer<U>, B>,
    ): Quantity<U, Join<A, B>>;
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quantity<U, Join<A, B>>;
    <Q>(
        b: QuantityInput<Q>,
    ): [Q] extends [Quantity<infer U, infer B>]
        ? <A extends Value>(a: Quantity<U, A>) => Quantity<U, Join<A, B>>
        : never;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        of(a.unit, Numeric.subtract(a.value, b.value))
);

/**
 * Multiplies two quantities, composing their units into a `Product`:
 * `times(length, length)` is an area.
 *
 * `Unitless` is the identity, so multiplying by a dimensionless quantity
 * scales instead of composing—`times(length, Dimensionless.percent(90))` is
 * nine tenths of that length, still a `Length`. Either argument may be the
 * dimensionless one.
 *
 * @throws { RangeError } When a `Rational` product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const times: {
    <F extends Value>(
        factor: Quantity<"Unitless", F>,
    ): <U extends Unit.Unit, A extends Value>(
        a: Quantity<U, A>
    ) => Quantity<U, Join<A, F>>;
    <U2 extends Unit.Unit, B extends Value>(
        b: Quantity<U2, B>,
    ): <U1 extends Unit.Unit, A extends Value>(
        a: Quantity<U1, A>
    ) => Quantity<Unit.Product<U1, U2>, Join<A, B>>;
    <U extends Unit.Unit, A extends Value, F extends Value>(
        a: Quantity<U, A>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<U, Join<A, F>>;
    <F extends Value, U extends Unit.Unit, A extends Value>(
        factor: Quantity<"Unitless", F>,
        a: Quantity<U, A>,
    ): Quantity<U, Join<F, A>>;
    <U1 extends Unit.Unit, U2 extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U1, A>,
        b: Quantity<U2, B>,
    ): Quantity<Unit.Product<U1, U2>, Join<A, B>>;
    <Q, F extends Value>(
        a: QuantityInput<Q>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<QuantityUnit<Q>, Join<QuantityValue<Q>, F>>;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
    {
        const value = Numeric.multiply(a.value, b.value);
        return isUnitless(a.unit)
            ? of(b.unit, value)
            : isUnitless(b.unit)
                ? of(a.unit, value)
                : of(Unit.product(a.unit, b.unit), value);
    }
);

// squared and cubed are `times` specialized to one argument, so they honor
// the same identity. Each is cast to its overloaded type: a single
// implementation signature can never be assignable to an overload set,
// which is why `times` and `over` need no cast (`Function.dual` carries the
// annotation) and these two do.

/**
 * Squaring a dimensionless quantity leaves it dimensionless.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const squared = ((a: Quantity<Unit.Unit, Value>): Quantity<Unit.Unit, Value> =>
    of(
        isUnitless(a.unit) ? a.unit : Unit.squared(a.unit),
        Numeric.multiply(a.value, a.value)
    )) as {
    <V extends Value>(a: Quantity<"Unitless", V>): Quantity<"Unitless", V>;
    <U extends Unit.Unit, V extends Value>(
        a: Quantity<U, V>
    ): Quantity<Unit.Squared<U>, V>;
};

/**
 * Cubing a dimensionless quantity leaves it dimensionless.
 *
 * @throws { RangeError } When a `Rational` result does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const cubed = ((a: Quantity<Unit.Unit, Value>): Quantity<Unit.Unit, Value> =>
    of(
        isUnitless(a.unit) ? a.unit : Unit.cubed(a.unit),
        Numeric.multiply(Numeric.multiply(a.value, a.value), a.value)
    )) as {
    <V extends Value>(a: Quantity<"Unitless", V>): Quantity<"Unitless", V>;
    <U extends Unit.Unit, V extends Value>(
        a: Quantity<U, V>
    ): Quantity<Unit.Cubed<U>, V>;
};

/** The unit of a rate of `dependent` per `independent`. */
const rateOf = (
    dependent: Quantity<Unit.Unit, Value>,
    independent: Quantity<Unit.Unit, Value>
): Unit.Unit => Unit.rate(dependent.unit, independent.unit);

/**
 * Divides one quantity by another, producing a rate: `per(dependent,
 * independent)` is the rate of change of `dependent` per unit of
 * `independent` (e.g. `per(length, duration)` is a speed). A float division
 * by zero yields ±Infinity (or NaN for 0/0); an exact one returns
 * `Option.none()`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const per: {
    <Independent extends Unit.Unit, B extends Value>(
        independent: Quantity<Independent, B>,
    ): <Dependent extends Unit.Unit, A extends Value>(
        dependent: Quantity<Dependent, A>
    ) => Quotient<Unit.Rate<Dependent, Independent>, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        dependent: Quantity<Dependent, A>,
        independent: Quantity<Independent, B>,
    ): Quotient<Unit.Rate<Dependent, Independent>, Join<A, B>>;
} = Function.dual(
    2,
    (
        dependent: Quantity<Unit.Unit, Value>,
        independent: Quantity<Unit.Unit, Value>
    ) =>
        quotient(dependent.value, independent.value, (value) =>
            of(rateOf(dependent, independent), value)
        )
);

/**
 * Like {@link per}, but throws on an exact division by zero.
 *
 * @throws { RangeError } When an exact independent quantity is zero, or when a
 * `Rational` quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const perUnsafe: {
    <Independent extends Unit.Unit, B extends Value>(
        independent: Quantity<Independent, B>,
    ): <Dependent extends Unit.Unit, A extends Value>(
        dependent: Quantity<Dependent, A>
    ) => Quantity<Unit.Rate<Dependent, Independent>, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        dependent: Quantity<Dependent, A>,
        independent: Quantity<Independent, B>,
    ): Quantity<Unit.Rate<Dependent, Independent>, Join<A, B>>;
} = Function.dual(
    2,
    (
        dependent: Quantity<Unit.Unit, Value>,
        independent: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        quotientUnsafe(dependent.value, independent.value, (value) =>
            of(rateOf(dependent, independent), value)
        )
);

/**
 * Multiplies a rate by a quantity in its independent units, producing a
 * quantity in its dependent units: `at(speed, duration)` is a length.
 *
 * @throws { RangeError } When a `Rational` product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const at: {
    <Independent extends Unit.Unit, B extends Value>(
        independent: Quantity<Independent, B>,
    ): <Dependent extends Unit.Unit, A extends Value>(
        rate: Quantity<Unit.Rate<Dependent, Independent>, A>
    ) => Quantity<Dependent, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        rate: Quantity<Unit.Rate<Dependent, Independent>, A>,
        independent: Quantity<Independent, B>,
    ): Quantity<Dependent, Join<A, B>>;
} = Function.dual(
    2,
    (
        rate: Quantity<Unit.Rate<Unit.Unit, Unit.Unit>, Value>,
        independent: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        of(rate.unit.dependent, Numeric.multiply(rate.value, independent.value))
);

/**
 * Divides a quantity in a rate's dependent units by the rate, producing a
 * quantity in its independent units: `at_(length, speed)` is a duration.
 * A float division by zero yields ±Infinity (or NaN for 0/0); an exact one
 * returns `Option.none()`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const at_: {
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        B extends Value
    >(
        rate: Quantity<Unit.Rate<Dependent, Independent>, B>,
    ): <A extends Value>(
        dependent: Quantity<Dependent, A>
    ) => Quotient<Independent, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        dependent: Quantity<Dependent, A>,
        rate: Quantity<Unit.Rate<Dependent, Independent>, B>,
    ): Quotient<Independent, Join<A, B>>;
} = Function.dual(
    2,
    (
        dependent: Quantity<Unit.Unit, Value>,
        rate: Quantity<Unit.Rate<Unit.Unit, Unit.Unit>, Value>
    ) =>
        quotient(dependent.value, rate.value, (value) =>
            of(rate.unit.independent, value)
        )
);

/**
 * Like {@link at_}, but throws on an exact division by zero.
 *
 * @throws { RangeError } When an exact rate is zero, or when a `Rational`
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const at_Unsafe: {
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        B extends Value
    >(
        rate: Quantity<Unit.Rate<Dependent, Independent>, B>,
    ): <A extends Value>(
        dependent: Quantity<Dependent, A>
    ) => Quantity<Independent, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        dependent: Quantity<Dependent, A>,
        rate: Quantity<Unit.Rate<Dependent, Independent>, B>,
    ): Quantity<Independent, Join<A, B>>;
} = Function.dual(
    2,
    (
        dependent: Quantity<Unit.Unit, Value>,
        rate: Quantity<Unit.Rate<Unit.Unit, Unit.Unit>, Value>
    ): Quantity<Unit.Unit, Value> =>
        quotientUnsafe(dependent.value, rate.value, (value) =>
            of(rate.unit.independent, value)
        )
);

/**
 * `for_(duration, speed)` is the length covered at `speed` for `duration`—
 * {@link at} with its arguments flipped. (Named `for_` because `for` is a
 * reserved word.)
 *
 * @throws { RangeError } When a `Rational` product does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const for_: {
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value
    >(
        rate: Quantity<Unit.Rate<Dependent, Independent>, A>,
    ): <B extends Value>(
        independent: Quantity<Independent, B>
    ) => Quantity<Dependent, Join<A, B>>;
    <
        Dependent extends Unit.Unit,
        Independent extends Unit.Unit,
        A extends Value,
        B extends Value
    >(
        independent: Quantity<Independent, B>,
        rate: Quantity<Unit.Rate<Dependent, Independent>, A>,
    ): Quantity<Dependent, Join<A, B>>;
} = Function.dual(
    2,
    (
        independent: Quantity<Unit.Unit, Value>,
        rate: Quantity<Unit.Rate<Unit.Unit, Unit.Unit>, Value>
    ): Quantity<Unit.Unit, Value> =>
        of(rate.unit.dependent, Numeric.multiply(rate.value, independent.value))
);

/** The unit left after dividing `a` by `b` on the right. */
const overUnit = (
    a: Quantity<Unit.Unit, Value>,
    b: Quantity<Unit.Unit, Value>
): Unit.Unit => (isUnitless(b.unit) ? a.unit : leftFactorOf(a.unit, b.unit));

/** The unit left after dividing `a` by `b` on the left. */
const over_Unit = (
    a: Quantity<Unit.Unit, Value>,
    b: Quantity<Unit.Unit, Value>
): Unit.Unit => (isUnitless(b.unit) ? a.unit : rightFactorOf(a.unit, b.unit));

/**
 * Divides a product quantity by its right factor: `over(area, length)` is a
 * length.
 *
 * Dividing by a dimensionless quantity scales instead, staying in the units
 * it started in—the inverse of {@link times} in both cases. A float division
 * by zero yields ±Infinity (or NaN for 0/0); an exact one returns
 * `Option.none()`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const over: {
    <F extends Value>(
        factor: Quantity<"Unitless", F>,
    ): <U extends Unit.Unit, A extends Value>(
        a: Quantity<U, A>
    ) => Quotient<U, Join<A, F>>;
    <U2 extends Unit.Unit, B extends Value>(
        b: Quantity<U2, B>,
    ): <U1 extends Unit.Unit, A extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>
    ) => Quotient<U1, Join<A, B>>;
    <U extends Unit.Unit, A extends Value, F extends Value>(
        a: Quantity<U, A>,
        factor: Quantity<"Unitless", F>,
    ): Quotient<U, Join<A, F>>;
    <U1 extends Unit.Unit, U2 extends Unit.Unit, A extends Value, B extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>,
        b: Quantity<U2, B>,
    ): Quotient<U1, Join<A, B>>;
    <Q, F extends Value>(
        a: QuantityInput<Q>,
        factor: Quantity<"Unitless", F>,
    ): Quotient<QuantityUnit<Q>, Join<QuantityValue<Q>, F>>;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>) =>
        quotient(a.value, b.value, (value) => of(overUnit(a, b), value))
);

/**
 * Like {@link over}, but throws on an exact division by zero.
 *
 * @throws { RangeError } When an exact divisor is zero, or when a `Rational`
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const overUnsafe: {
    <F extends Value>(
        factor: Quantity<"Unitless", F>,
    ): <U extends Unit.Unit, A extends Value>(
        a: Quantity<U, A>
    ) => Quantity<U, Join<A, F>>;
    <U2 extends Unit.Unit, B extends Value>(
        b: Quantity<U2, B>,
    ): <U1 extends Unit.Unit, A extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>
    ) => Quantity<U1, Join<A, B>>;
    <U extends Unit.Unit, A extends Value, F extends Value>(
        a: Quantity<U, A>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<U, Join<A, F>>;
    <U1 extends Unit.Unit, U2 extends Unit.Unit, A extends Value, B extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>,
        b: Quantity<U2, B>,
    ): Quantity<U1, Join<A, B>>;
    <Q, F extends Value>(
        a: QuantityInput<Q>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<QuantityUnit<Q>, Join<QuantityValue<Q>, F>>;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        quotientUnsafe(a.value, b.value, (value) => of(overUnit(a, b), value))
);

/**
 * Divides a product quantity by its left factor: `over_(area, length)` is a
 * length.
 *
 * A dimensionless divisor scales, exactly as it does in {@link over}—for a
 * pure number there is no left or right factor to choose between. A float
 * division by zero yields ±Infinity (or NaN for 0/0); an exact one returns
 * `Option.none()`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const over_: {
    <F extends Value>(
        factor: Quantity<"Unitless", F>,
    ): <U extends Unit.Unit, A extends Value>(
        a: Quantity<U, A>
    ) => Quotient<U, Join<A, F>>;
    <U1 extends Unit.Unit, B extends Value>(
        b: Quantity<U1, B>,
    ): <U2 extends Unit.Unit, A extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>
    ) => Quotient<U2, Join<A, B>>;
    <U extends Unit.Unit, A extends Value, F extends Value>(
        a: Quantity<U, A>,
        factor: Quantity<"Unitless", F>,
    ): Quotient<U, Join<A, F>>;
    <U1 extends Unit.Unit, U2 extends Unit.Unit, A extends Value, B extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>,
        b: Quantity<U1, B>,
    ): Quotient<U2, Join<A, B>>;
    <Q, F extends Value>(
        a: QuantityInput<Q>,
        factor: Quantity<"Unitless", F>,
    ): Quotient<QuantityUnit<Q>, Join<QuantityValue<Q>, F>>;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>) =>
        quotient(a.value, b.value, (value) => of(over_Unit(a, b), value))
);

/**
 * Like {@link over_}, but throws on an exact division by zero.
 *
 * @throws { RangeError } When an exact divisor is zero, or when a `Rational`
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const over_Unsafe: {
    <F extends Value>(
        factor: Quantity<"Unitless", F>,
    ): <U extends Unit.Unit, A extends Value>(
        a: Quantity<U, A>
    ) => Quantity<U, Join<A, F>>;
    <U1 extends Unit.Unit, B extends Value>(
        b: Quantity<U1, B>,
    ): <U2 extends Unit.Unit, A extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>
    ) => Quantity<U2, Join<A, B>>;
    <U extends Unit.Unit, A extends Value, F extends Value>(
        a: Quantity<U, A>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<U, Join<A, F>>;
    <U1 extends Unit.Unit, U2 extends Unit.Unit, A extends Value, B extends Value>(
        product: Quantity<Unit.Product<U1, U2>, A>,
        b: Quantity<U1, B>,
    ): Quantity<U2, Join<A, B>>;
    <Q, F extends Value>(
        a: QuantityInput<Q>,
        factor: Quantity<"Unitless", F>,
    ): Quantity<QuantityUnit<Q>, Join<QuantityValue<Q>, F>>;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        quotientUnsafe(a.value, b.value, (value) => of(over_Unit(a, b), value))
);

// Dimensionless quantities
//
// `times`, `over`, `over_`, `squared`, and `cubed` already fold `Unitless`
// away as the identity, so a dimensionless factor needs no separate
// operation. What is left is the way in: `ratio`, which divides two
// quantities in the same units and returns the pure number rather than the
// `Rate<U, U>` that `per` would build.
//
// See the `Dimensionless` module for the constructors (`fraction`,
// `percent`, …) that read and write `Unitless` values; it is not imported
// here, since the dependency runs the other way.

/**
 * Divides two quantities in the same units, producing a dimensionless
 * quantity—`ratio(marathon, kilometer)` is a factor of 42.1648128, and the
 * units it was measured in are gone. Contrast {@link per}, which keeps them
 * as a rate. A float division by zero yields ±Infinity (or NaN for 0/0); an
 * exact one returns `Option.none()`.
 *
 * Read the result with `Dimensionless.inFraction` or `inPercent`.
 *
 * @throws { RangeError } When a `Rational` quotient does not fit in safe
 * integers.
 * @category Operation
 * @since 1.0.0
 */
export const ratio: {
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quotient<"Unitless", Join<A, B>>;
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<U, B>,
    ): Quotient<"Unitless", Join<A, B>>;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>) =>
        quotient(a.value, b.value, (value) => of("Unitless", value))
);

/**
 * Like {@link ratio}, but throws on an exact division by zero.
 *
 * @throws { RangeError } When an exact divisor is zero, or when a `Rational`
 * quotient does not fit in safe integers.
 * @category Operation
 * @since 1.0.0
 */
export const ratioUnsafe: {
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quantity<"Unitless", Join<A, B>>;
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<U, B>,
    ): Quantity<"Unitless", Join<A, B>>;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<"Unitless", Value> =>
        quotientUnsafe(a.value, b.value, (value) => of("Unitless", value))
);

// Comparison
//
// A float compared with an exact value is compared as a float. The ordering
// predicates follow IEEE semantics for NaN: every comparison involving NaN is
// false. min and max propagate NaN deterministically, like Math.min/Math.max,
// and return one of their arguments unchanged.

/**
 * Checks whether the first quantity is less than the second, in the same units.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThan: {
    <U extends Unit.Unit>(b: Quantity<U, Value>): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(a: Quantity<U, Value>, b: Quantity<U, Value>): boolean;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>): boolean =>
        Numeric.compare(a.value, b.value) < 0
);

/**
 * Checks whether the first quantity is less than or equal to the second, in the
 * same units.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isLessThanOrEqualTo: {
    <U extends Unit.Unit>(b: Quantity<U, Value>): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(a: Quantity<U, Value>, b: Quantity<U, Value>): boolean;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>): boolean =>
        Numeric.compare(a.value, b.value) <= 0
);

/**
 * Checks whether the first quantity is greater than the second, in the same units.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThan: {
    <U extends Unit.Unit>(b: Quantity<U, Value>): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(a: Quantity<U, Value>, b: Quantity<U, Value>): boolean;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>): boolean =>
        Numeric.compare(a.value, b.value) > 0
);

/**
 * Checks whether the first quantity is greater than or equal to the second, in the
 * same units.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo: {
    <U extends Unit.Unit>(b: Quantity<U, Value>): (a: Quantity<U, Value>) => boolean;
    <U extends Unit.Unit>(a: Quantity<U, Value>, b: Quantity<U, Value>): boolean;
} = Function.dual(
    2,
    (a: Quantity<Unit.Unit, Value>, b: Quantity<Unit.Unit, Value>): boolean =>
        Numeric.compare(a.value, b.value) >= 0
);

/**
 * Returns the smaller quantity, unchanged. Propagates NaN: if either argument
 * is NaN, the NaN quantity is returned.
 *
 * @category Operation
 * @since 1.0.0
 */
export const min: {
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<NoInfer<U>, B>,
    ): Quantity<U, A | B>;
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quantity<U, A | B>;
    <Q>(
        b: QuantityInput<Q>,
    ): [Q] extends [Quantity<infer U, infer B>]
        ? <A extends Value>(a: Quantity<U, A>) => Quantity<U, A | B>
        : never;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        Numeric.isNaN(a.value)
            ? a
            : Numeric.isNaN(b.value)
                ? b
                : Numeric.compare(b.value, a.value) < 0
                    ? b
                    : a
);

/**
 * Returns the larger quantity, unchanged. Propagates NaN: if either argument
 * is NaN, the NaN quantity is returned.
 *
 * @category Operation
 * @since 1.0.0
 */
export const max: {
    <U extends Unit.Unit, A extends Value, B extends Value>(
        a: Quantity<U, A>,
        b: Quantity<NoInfer<U>, B>,
    ): Quantity<U, A | B>;
    <U extends Unit.Unit, B extends Value>(
        b: Quantity<U, B>,
    ): <A extends Value>(a: Quantity<U, A>) => Quantity<U, A | B>;
    <Q>(
        b: QuantityInput<Q>,
    ): [Q] extends [Quantity<infer U, infer B>]
        ? <A extends Value>(a: Quantity<U, A>) => Quantity<U, A | B>
        : never;
} = Function.dual(
    2,
    (
        a: Quantity<Unit.Unit, Value>,
        b: Quantity<Unit.Unit, Value>
    ): Quantity<Unit.Unit, Value> =>
        Numeric.isNaN(a.value)
            ? a
            : Numeric.isNaN(b.value)
                ? b
                : Numeric.compare(b.value, a.value) > 0
                    ? b
                    : a
);

// Guards

/**
 * Checks whether a quantity's value is NaN; an exact value never is.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isNaN = <U extends Unit.Unit, V extends Value>(q: Quantity<U, V>): boolean =>
    Numeric.isNaN(q.value);

/**
 * Checks whether a quantity's value is positive or negative infinity; an exact
 * value never is.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isInfinite = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): boolean => q.value === Infinity || q.value === -Infinity;

/**
 * Checks whether a quantity's value is finite, that is neither NaN nor
 * infinite; an exact value always is.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isFinite = <U extends Unit.Unit, V extends Value>(
    q: Quantity<U, V>
): boolean => !Predicate.isNumber(q.value) || Number.isFinite(q.value);
