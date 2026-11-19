/**
 * Unit trees: built-in or custom base units composed with `Product` and `Rate`,
 * with structural equality and a canonical string encoding.
 *
 * Ported from effect-units 1.0.1.
 *
 * @module @bedform/effect/Unit/Unit
 *
 * @file      Unit.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   BSD-3-Clause
 */

/* Upstream copyright (c) 2026 RJ Dellecese, (c) 2018 Ian Mackenzie. */

/* Preserve upstream effect-units generics and contextual inference and import and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys */

import * as Equal from "../Equal.js";
import { pipe } from "../Function.js";
import * as Hash from "../Hash.js";
import * as Inspectable from "../Inspectable.js";
import * as Option from "../Option.js";
import * as Predicate from "../Predicate.js";
import * as Result from "../Result.js";
import * as Schema from "../Schema.js";
import * as SchemaGetter from "../SchemaGetter.js";
import * as SchemaIssue from "../SchemaIssue.js";
import * as String from "../String.js";

/**
 * The leaf tags of the unit algebra—every other unit is a `Product` or
 * `Rate` composition of these.
 *
 * `Unitless` is the dimensionless leaf—the SI unit one, which `Dimensionless`
 * is built on. It is an ordinary leaf here: this module composes unit trees
 * and never cancels anything, so `Unit.product("Meters", "Unitless")` is a
 * perfectly good (if pointless) tree. It is the quantity operations that
 * treat it as the identity—`Quantity.times`, `over`, `over_`, `squared`, and
 * `cubed` fold it away, and `Quantity.ratio` is the way into it.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const BaseUnit = Schema.Literals([
    "Meters",
    "Seconds",
    "Kilograms",
    "Radians",
    "Pixels",
    "Coulombs",
    "Farads",
    "Henries",
    "Lumens",
    "Moles",
    "Steradians",
    "CelsiusDegrees",
    "Unitless"
]);

/**
 * One of the built-in leaf unit tags, such as `"Meters"` or `"Seconds"`.
 *
 * @category Types
 * @since 1.0.0
 */
export type BaseUnit = typeof BaseUnit.Type;

const isBaseUnit = Schema.is(BaseUnit);

/**
 * The product of two units, such as newton-meters. Composite units implement
 * equality, hashing and inspection through their canonical encoding.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Product<in out U1 extends Unit, in out U2 extends Unit>
    extends Equal.Equal, Inspectable.Inspectable {
    readonly _tag: "Product";
    readonly left: U1;
    readonly right: U2;
}

/**
 * A rate of a dependent unit per independent unit, such as meters per second.
 * Composite units implement equality, hashing and inspection through their
 * canonical encoding.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Rate<
    in out Dependent extends Unit,
    in out Independent extends Unit
>
    extends Equal.Equal, Inspectable.Inspectable {
    readonly _tag: "Rate";
    readonly dependent: Dependent;
    readonly independent: Independent;
}

/**
 * A user-defined base unit, identified by `Id`. Custom units are leaves of
 * the unit tree, just like {@link BaseUnit}, and compose freely with
 * `Product` and `Rate`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Custom<in out Id extends string>
    extends Equal.Equal, Inspectable.Inspectable {
    readonly _tag: "Custom";
    readonly id: Id;
}

/**
 * A unit tree: a built-in base unit, a custom unit, or a product or rate of units.
 *
 * @category Types
 * @since 1.0.0
 */
export type Unit =
  | BaseUnit
  | Custom<string>
  | Product<Unit, Unit>
  | Rate<Unit, Unit>;

/**
 * The product of a unit with itself.
 *
 * @category Types
 * @since 1.0.0
 */
export type Squared<U extends Unit> = Product<U, U>;

/**
 * The product of a unit with itself, three times.
 *
 * @category Types
 * @since 1.0.0
 */
export type Cubed<U extends Unit> = Product<Product<U, U>, U>;

// Composite units implement Equal, Hash, and Inspectable (base units are
// bare strings, which support all three natively). Inspection shows the
// canonical encoding.

const Proto = {
    [Equal.symbol](this: Unit, that: unknown): boolean
    {
        return isUnit(that) && equals(this, that);
    },
    [Hash.symbol](this: Unit & object): number
    {
        return Hash.string(encode(this));
    },
    toJSON(this: Unit): string
    {
        return encode(this);
    },
    toString(this: Unit): string
    {
        return encode(this);
    },
    [Inspectable.NodeInspectSymbol](this: Unit): string
    {
        return encode(this);
    }
} as const;

/**
 * Creates the product unit of `left` and `right`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const product = <U1 extends Unit, U2 extends Unit>(
    left: U1,
    right: U2
): Product<U1, U2> =>
    Object.assign(Object.create(Proto), { _tag: "Product",
        left,
        right });

/**
 * Creates the rate unit of `dependent` per `independent`.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const rate = <Dependent extends Unit, Independent extends Unit>(
    dependent: Dependent,
    independent: Independent
): Rate<Dependent, Independent> =>
    Object.assign(Object.create(Proto), { _tag: "Rate",
        dependent,
        independent });

const validCustomId = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Creates a {@link Custom} base unit. The ID must match
 * `/^[A-Za-z][A-Za-z0-9]*$/`—the charset keeps IDs trivially safe inside
 * the canonical encoding's grammar. IDs are expected to be developer-written
 * literals, so an invalid ID throws (a defect, not a recoverable error).
 *
 * The argument is a persistent identity, not a display name: it is encoded
 * as `"[ID]"` in quantity wire formats, including derived products and rates.
 * Choose it like a database column name. `const Count = Unit.custom("Units")`
 * can replace a binding named `Units` without changing stored identity;
 * its type alias can likewise be renamed while keeping `Custom<"Units">`.
 * Changing the ID makes old payloads fail the new unit's schema. Changing
 * what one base unit means (for example, cents to dollars) under the same ID
 * silently reinterprets stored values. Either change requires an explicit
 * wire migration, including derived units; keep display labels separately.
 *
 * A custom unit is always distinct from a {@link BaseUnit} with the same
 * name: `Unit.custom("Meters")` encodes as `"[Meters]"` and never equals
 * `"Meters"`.
 *
 * @throws { Error } When the ID does not match `/^[A-Za-z][A-Za-z0-9]*$/`.
 * @category Constructors
 * @since 1.0.0
 */
export const custom = <Id extends string>(id: Id): Custom<Id> =>
{
    if (!validCustomId.test(id))
    {
        throw new Error(
            `Unit.custom: invalid id ${JSON.stringify(id)} (expected /^[A-Za-z][A-Za-z0-9]*$/)`
        );
    }

    return Object.assign(Object.create(Proto), { _tag: "Custom",
        id });
};

/**
 * Creates the product unit of `unit` with itself.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const squared = <U extends Unit>(unit: U): Squared<U> =>
    product(unit, unit);

/**
 * Creates the product unit of `unit` with itself, three times.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const cubed = <U extends Unit>(unit: U): Cubed<U> =>
    product(product(unit, unit), unit);

/**
 * Checks whether a value is a well-formed unit tree: a built-in base unit, a
 * custom unit with a valid ID, or a product or rate of such units.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const isUnit = (u: unknown): u is Unit =>
    typeof u === "string"
        ? isBaseUnit(u)
        : Predicate.isReadonlyObject(u) &&
      (u._tag === "Product"
          ? isUnit(u.left) && isUnit(u.right)
          : u._tag === "Rate"
              ? isUnit(u.dependent) && isUnit(u.independent)
              : u._tag === "Custom" &&
            Predicate.isString(u.id) &&
            validCustomId.test(u.id));

/**
 * Structural equality of unit trees. Custom units are equal when their IDs are
 * equal, and never equal a built-in base unit.
 *
 * @category Predicates
 * @since 1.0.0
 */
export const equals = (a: Unit, b: Unit): boolean =>
    typeof a === "string" || typeof b === "string"
        ? a === b
        : a._tag === "Custom" || b._tag === "Custom"
            ? a._tag === "Custom" && b._tag === "Custom" && a.id === b.id
            : a._tag === "Product" && b._tag === "Product"
                ? equals(a.left, b.left) && equals(a.right, b.right)
                : a._tag === "Rate" &&
          b._tag === "Rate" &&
          equals(a.dependent, b.dependent) &&
          equals(a.independent, b.independent);

/**
 * The canonical string encoding of a unit tree, e.g. `"Meters"`, `"[USD]"`
 * (a custom unit), `"(Meters/Seconds)"`, or
 * `"(Kilograms*((Meters/Seconds)/Seconds))"`.
 *
 * This is a stable serialization format—it appears as the `unit` field of
 * a `Quantity`'s encoded form and feeds unit hashing. It doubles as the
 * inspection output for composite units, whose `Inspectable` implementation
 * delegates to it.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const encode = (u: Unit): string =>
    typeof u === "string"
        ? u
        : u._tag === "Custom"
            ? `[${u.id}]`
            : u._tag === "Product"
                ? `(${encode(u.left)}*${encode(u.right)})`
                : `(${encode(u.dependent)}/${encode(u.independent)})`;

// A parse step consumes a prefix of the input, yielding the parsed unit and
// the remaining input.
type Parsed = readonly [unit: Unit, rest: string];

const baseUnitName = /^[A-Za-z]+/;

// Far deeper than any legitimate unit tree; bounds recursion so adversarial
// input fails with Option.none() instead of a stack overflow.
const maxDepth = 64;

const parseBaseUnit = (input: string): Option.Option<Parsed> =>
    pipe(
        String.match(baseUnitName)(input),
        Option.flatMap((matches) => Option.fromUndefinedOr(matches[0])),
        Option.filter(isBaseUnit),
        Option.map((name) => [ name, String.slice(name.length)(input) ] as const)
    );

const customUnit = /^\[[A-Za-z][A-Za-z0-9]*\]/;

const parseCustom = (input: string): Option.Option<Parsed> =>
    pipe(
        String.match(customUnit)(input),
        Option.flatMap((matches) => Option.fromUndefinedOr(matches[0])),
        Option.map(
            (matched) =>
                [
                    custom(matched.slice(1, -1)),
                    String.slice(matched.length)(input)
                ] as const
        )
    );

const parseComposite = (input: string, depth: number): Option.Option<Parsed> =>
    Option.gen(function* ()
    {
        const [ first, afterFirst ] = yield* parseTree(String.slice(1)(input), depth);
        const operator = yield* pipe(
            String.charAt(0)(afterFirst),
            Option.filter(
                (character): character is "*" | "/" =>
                    character === "*" || character === "/"
            )
        );
        const [ second, afterSecond ] = yield* parseTree(
            String.slice(1)(afterFirst),
            depth
        );

        if (!String.startsWith(")")(afterSecond))
        {
            return yield* Option.none();
        }

        return [
            operator === "*" ? product(first, second) : rate(first, second),
            String.slice(1)(afterSecond)
        ] as const;
    });

const parseTree = (input: string, depth: number): Option.Option<Parsed> =>
    depth > maxDepth
        ? Option.none()
        : String.startsWith("(")(input)
            ? parseComposite(input, depth + 1)
            : String.startsWith("[")(input)
                ? parseCustom(input)
                : parseBaseUnit(input);

/**
 * Parses the canonical encoding produced by {@link encode}. Returns
 * `Option.none()` for anything else, including trees nested beyond any
 * depth the library's unit algebra can produce.
 *
 * @category Conversions
 * @since 1.0.0
 */
export const decode = (input: string): Option.Option<Unit> =>
    parseTree(input, 0).pipe(
        Option.flatMap(([ unit, rest ]) =>
            rest === "" ? Option.some(unit) : Option.none()
        )
    );

/**
 * The single definition of the canonical string encoding, shared by
 * {@link UnitFromString} and by the `toCodecJson` annotation on
 * {@link Unit}, so the two can never drift apart.
 */
const stringTransformation = {
    decode: SchemaGetter.transformResult((input: string, options) =>
        Option.match(decode(input), {
            onNone: () =>
                Result.fail(
                    new SchemaIssue.InvalidValue(
                        { message: "not a canonical unit encoding" },
                        input,
                        options
                    )
                ),
            onSome: Result.succeed
        })
    ),
    encode: SchemaGetter.transform(encode)
};

/**
 * The identity schema: a `Unit` on both sides, decoded from itself.
 *
 * It carries the canonical string encoding as its JSON representation, so
 * `Schema.toCodecJson` derives that codec on demand—including when a unit
 * is nested inside a larger schema of your own. {@link UnitFromString} is
 * the same codec named directly, with a precise `string` encoded type
 * rather than `Json`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const Unit = Schema.declare(isUnit, {
    identifier: "Unit",
    description: "a unit tree",
    toCodecJson: () => Schema.link<Unit>()(Schema.String, stringTransformation)
});

/**
 * The codec between units and their canonical string encoding, as produced by
 * `encode`.
 *
 * @category Schemas
 * @since 1.0.0
 */
export const UnitFromString = Schema.String.pipe(
    Schema.decodeTo(Unit, stringTransformation)
).annotate({ identifier: "UnitFromString" });
