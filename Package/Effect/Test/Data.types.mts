/**
 * Compile-time checks for complete Data API compatibility and generic inference.
 *
 * @module @bedform/effect/Test/Data.types
 *
 * @file      Data.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Data from "@bedform/effect/Data";
import type { YieldableError } from "@bedform/effect/Cause";

/* These callbacks and generic classes intentionally test contextual type inference. */
/* eslint-disable @typescript-eslint/typedef, @typescript-eslint/naming-convention */

/**
 * Declares readonly fields using the generic data class constructor.
 *
 * @category Tests
 * @since 1.0.0
 */
class Person extends Data.Class<{ name: string }> {}

const PersonValue = new Person({ name: "Alex" });
// @ts-expect-error -- Data class fields are readonly.
PersonValue.name = "Steve";
// @ts-expect-error -- Nonempty class fields are required.
new Person();

/**
 * Allows an omitted constructor argument when no fields are declared.
 *
 * @category Tests
 * @since 1.0.0
 */
class Empty extends Data.Class {}

new Empty();

/**
 * Excludes the discriminator from constructor fields.
 *
 * @category Tests
 * @since 1.0.0
 */
class Tagged extends Data.TaggedClass("Tagged")<{ value: number }> {}

const Tag: "Tagged" = new Tagged({ value: 1 })._tag;
// @ts-expect-error -- The tag is supplied by TaggedClass.
new Tagged({ _tag: "Tagged",
    value: 1 });

type VariantFields = { Empty: Record<never, never>;
    Value: ValueFields };

/**
 * Fields used to verify the TaggedEnum record conversion.
 *
 * @category Tests
 * @since 1.0.0
 */
interface ValueFields { readonly value: number }

type Variant = Data.TaggedEnum<VariantFields>;
const Variants: Data.TaggedEnum.Constructor<Variant> = Data.taggedEnum<Variant>();
const ValueConstructor: Data.TaggedEnum.ConstructorFrom<Extract<Variant, { _tag: "Value" }>, "_tag"> =
    Variants.Value;
const Fields: Data.TaggedEnum.Args<Variant, "Value"> = { value: 1 };
const Value: Data.TaggedEnum.Value<Variant, "Value"> = ValueConstructor(Fields);
Variants.Empty();
if (Variants.$is("Value")(Value))
{
    const NumberValue: number = Value.value;
    void NumberValue;
}

const Match: string | number = Variants.$match(Value, { Empty: () => "empty",
    Value: (value) => value.value });
// @ts-expect-error -- Every variant must have a handler.
Variants.$match(Value, { Value: (value: typeof Value) => value.value });
// @ts-expect-error -- Empty variants take no payload fields.
Variants.Empty({ value: 1 });
// @ts-expect-error -- Value variants require their payload.
Variants.Value();

type Generic<A, B = never, C = never, D = never> =
    | { readonly _tag: "Empty" }
    | { readonly _tag: "Value";
        readonly value: A;
        readonly second: B;
        readonly third: C;
        readonly fourth: D };

/**
 * A one-parameter tagged enum definition.
 *
 * @category Tests
 * @since 1.0.0
 */
interface One extends Data.TaggedEnum.WithGenerics<1>
{
    readonly taggedEnum: Generic<this["A"], undefined, undefined, undefined>;
}

/**
 * A two-parameter tagged enum definition.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Two extends Data.TaggedEnum.WithGenerics<2>
{
    readonly taggedEnum: Generic<this["A"], this["B"], undefined, undefined>;
}

/**
 * A three-parameter tagged enum definition.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Three extends Data.TaggedEnum.WithGenerics<3>
{
    readonly taggedEnum: Generic<this["A"], this["B"], this["C"], undefined>;
}

/**
 * A four-parameter tagged enum definition.
 *
 * @category Tests
 * @since 1.0.0
 */
interface Four extends Data.TaggedEnum.WithGenerics<4>
{
    readonly taggedEnum: Generic<this["A"], this["B"], this["C"], this["D"]>;
}

const OneValue = Data.taggedEnum<One>().Value({ fourth: undefined,
    second: undefined,
    third: undefined,
    value: "text" });
const TwoValue = Data.taggedEnum<Two>().Value({ fourth: undefined,
    second: 1,
    third: undefined,
    value: "text" });
const ThreeValue = Data.taggedEnum<Three>().Value({ fourth: undefined,
    second: 1,
    third: true,
    value: "text" });
const FourEnum = Data.taggedEnum<Four>();
const FourValue = FourEnum.Value({ fourth: null,
    second: 1,
    third: true,
    value: "text" });
const Inferred: [string, number, boolean, null] =
    [ FourValue.value, FourValue.second, FourValue.third, FourValue.fourth ];
const Applied: Data.TaggedEnum.Kind<Four, string, number, boolean, null> = FourValue;
const GenericMatch: string | number = FourEnum.$match(FourValue, {
    Empty: () => 0,
    Value: (value) => value.value
});
const GenericCurried: string | number = FourEnum.$match({
    Empty: () => 0,
    Value: (_value) => "value"
})(FourValue);

/**
 * A domain error retains the upstream yieldable contract.
 *
 * @category Tests
 * @since 1.0.0
 */
class DomainError extends Data.TaggedError("DomainError")<{ message: string }> {}

const ErrorValue: YieldableError = new DomainError({ message: "failed" });
const NativeError: globalThis.Error = new Data.Error<{}>(undefined);
// @ts-expect-error -- Error fields are required when declared.
new DomainError();
// @ts-expect-error -- TaggedError owns the discriminator field.
new DomainError({ _tag: "DomainError",
    message: "failed" });

void [ Tag, Match, OneValue, TwoValue, ThreeValue, Inferred, Applied,
    GenericMatch, GenericCurried, ErrorValue, NativeError ];
