/**
 * Getters: the one-directional steps that schema transformations compose. They
 * pass values through, require or default missing values, convert between
 * strings, numbers, booleans, big integers and dates, reshape text, parse and
 * stringify JSON, and encode and decode Base64, hexadecimal and URI components.
 * Adapted from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/SchemaGetter
 *
 * @file      SchemaGetter.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve public generic arities after constraining service channels to never. */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as InternalParser from "./Internal/Schema/parser.js";

import * as Base64 from "./Encoding/Base64.js";

import * as Base64Url from "./Encoding/Base64Url.js";

import * as Hex from "./Encoding/Hex.js";

import { dual } from "./Function.js";

import * as Option from "./Option.js";

import * as Pipeable from "./Pipeable.js";

import * as Predicate from "./Predicate.js";

import * as Result from "./Result.js";

import type * as Schema from "./Schema.js";

import type * as SchemaAST from "./SchemaAST.js";

import * as SchemaIssue from "./SchemaIssue.js";

import * as Str from "./String.js";

/**
 * A transformation that returns its input unchanged.
 *
 * @category models
 * @since 1.0.0
 */
export interface Passthrough extends Pipeable.Pipeable
{
    readonly _tag: "Passthrough";
}

/**
 * A synchronous transformation of present values.
 *
 * @category models
 * @since 1.0.0
 */
export interface Transform<out T, in E> extends Pipeable.Pipeable
{
    readonly _tag: "Transform";
    readonly transform: (input: E) => T;
}

/**
 * A synchronous transformation of optional values.
 *
 * @category models
 * @since 1.0.0
 */
export interface TransformOptional<out T, in E> extends Pipeable.Pipeable
{
    readonly _tag: "TransformOptional";
    readonly transform: (input: Option.Option<E>) => Option.Option<T>;
}

/**
 * An effectful transformation of present values.
 *
 * @category models
 * @since 1.0.0
 */
export interface TransformResult<out T, in E, R extends never> extends Pipeable.Pipeable
{
    readonly _tag: "TransformResult";
    readonly transform: (input: E, options: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>;
}

/**
 * An effectful transformation of optional values.
 *
 * @category models
 * @since 1.0.0
 */
export interface TransformOptionalResult<out T, in E, R extends never> extends Pipeable.Pipeable
{
    readonly _tag: "TransformOptionalResult";
    readonly transform: (input: Option.Option<E>, options: SchemaAST.ParseOptions) => Result.Result<Option.Option<T>, SchemaIssue.Issue>;
}

/**
 * Represents a composable transformation from an encoded type `E` to a decoded type `T`.
 *
 * @category models
 * @since 1.0.0
 */
export type Getter<T, E, R extends never = never> = Passthrough | Transform<T, E> | TransformOptional<T, E> | TransformResult<T, E, R> | TransformOptionalResult<T, E, R>;

const runGetter = <T, E, R extends never>(self: Getter<T, E, R>, input: Option.Option<E>, options: SchemaAST.ParseOptions): Result.Result<Option.Option<T>, SchemaIssue.Issue> =>
{
    switch (self._tag)
    {
        case "Passthrough":
            return Result.succeed(input as unknown as Option.Option<T>);
        case "Transform":
            return Result.succeed(Option.map(input, self.transform));
        case "TransformOptional":
            return Result.succeed(self.transform(input));
        case "TransformResult":
            return Option.isNone(input)
                ? Result.succeed(Option.none())
                : Result.map(InternalParser.checked(self.transform(input.value, options)), Option.some);
        case "TransformOptionalResult":
            return InternalParser.checked(self.transform(input, options));
    }
};

/**
 * Runs a getter directly.
 *
 * @category converting
 * @since 1.0.0
 */
export const run: {
    /**
     * Runs a getter directly.
     *
     * @category converting
     * @since 1.0.0
     */
    <E>(input: Option.Option<E>, options: SchemaAST.ParseOptions): <T, R extends never>(self: Getter<T, E, R>) => Result.Result<Option.Option<T>, SchemaIssue.Issue>;

    /**
     * Runs a getter directly.
     *
     * @category converting
     * @since 1.0.0
     */
    <T, E, R extends never>(self: Getter<T, E, R>, input: Option.Option<E>, options: SchemaAST.ParseOptions): Result.Result<Option.Option<T>, SchemaIssue.Issue>;
} = dual(3, runGetter);

const makeGetter = <const A extends object>(fields: A): A & Pipeable.Pipeable => Object.assign(Object.create(Pipeable.Prototype), fields);

const composeOptionalEffect = <T, E, R extends never, T2, R2 extends never>(first: Getter<T, E, R>, second: Getter<T2, T, R2>): Getter<T2, E, R | R2> => transformOptionalResult((input, options) => Result.flatMap(runGetter(first, input, options), (output) => runGetter(second, output, options)));

/**
 * Composes two getters by passing the output of the first to the second.
 *
 * @category combining
 * @since 1.0.0
 */
export const compose: {
    /**
     * Composes two getters by passing the output of the first to the second.
     *
     * @category combining
     * @since 1.0.0
     */
    <T, T2, R2 extends never>(other: Getter<T2, T, R2>): <E, R extends never>(self: Getter<T, E, R>) => Getter<T2, E, R | R2>;

    /**
     * Composes two getters by passing the output of the first to the second.
     *
     * @category combining
     * @since 1.0.0
     */
    <T, E, R extends never, T2, R2 extends never>(self: Getter<T, E, R>, other: Getter<T2, T, R2>): Getter<T2, E, R | R2>;
} = dual(2, <T, E, R extends never, T2, R2 extends never>(self: Getter<T, E, R>, other: Getter<T2, T, R2>): Getter<T2, E, R | R2> =>
{
    if (self._tag === "Passthrough")
    {return other as Getter<T2, E, R | R2>;}

    if (other._tag === "Passthrough")
    {return self as unknown as Getter<T2, E, R | R2>;}

    switch (self._tag)
    {
        case "Transform": {
            switch (other._tag)
            {
                case "Transform":
                    return transform((input: E) => other.transform(self.transform(input)));
                case "TransformOptional":
                    return transformOptional((input) => other.transform(Option.map(input, self.transform)));
                case "TransformResult":
                    return transformResult((input: E, options) => other.transform(self.transform(input), options));
                case "TransformOptionalResult":
                    return composeOptionalEffect(self, other);
            }
        }

            throw new TypeError("Invalid getter variant");

        case "TransformOptional": {
            switch (other._tag)
            {
                case "Transform":
                    return transformOptional((input) => Option.map(self.transform(input), other.transform));
                case "TransformOptional":
                    return transformOptional((input) => other.transform(self.transform(input)));
                case "TransformResult":
                case "TransformOptionalResult":
                    return composeOptionalEffect(self, other);
            }
        }

            throw new TypeError("Invalid getter variant");

        case "TransformResult": {
            switch (other._tag)
            {
                case "Transform":
                    return transformResult((input: E, options) => Result.map(InternalParser.checked(self.transform(input, options)), other.transform));
                case "TransformOptional":
                case "TransformOptionalResult":
                    return composeOptionalEffect(self, other);
                case "TransformResult":
                    return transformResult((input: E, options) => Result.flatMap(InternalParser.checked(self.transform(input, options)), (output) => other.transform(output, options)));
            }
        }

            throw new TypeError("Invalid getter variant");

        case "TransformOptionalResult":
            return composeOptionalEffect(self, other);
    }
}
);

/**
 * Maps the output of a getter while preserving missing values.
 *
 * @category mapping
 * @since 1.0.0
 */
export const map: {
    /**
     * Maps the output of a getter while preserving missing values.
     *
     * @category mapping
     * @since 1.0.0
     */
    <T, T2>(f: (value: T) => T2): <E, R extends never>(self: Getter<T, E, R>) => Getter<T2, E, R>;

    /**
     * Maps the output of a getter while preserving missing values.
     *
     * @category mapping
     * @since 1.0.0
     */
    <T, E, R extends never, T2>(self: Getter<T, E, R>, f: (value: T) => T2): Getter<T2, E, R>;
} = dual(2, <T, E, R extends never, T2>(self: Getter<T, E, R>, f: (value: T) => T2): Getter<T2, E, R> => compose(self, transform(f)));

/**
 * Creates a getter that always produces the given constant value, ignoring the input.
 *
 * @category constructors
 * @since 1.0.0
 */
export function succeed<const T, E>(t: T): Getter<T, E>
{
    return transformOptional(() => Option.some(t));
}

/**
 * Creates a getter that always fails with the given issue.
 *
 * @category constructors
 * @since 1.0.0
 */
export function fail<T, E>(f: (oe: Option.Option<E>, options: SchemaAST.ParseOptions) => SchemaIssue.Issue): Getter<T, E>
{
    return transformOptionalResult((oe, options) => Result.fail(f(oe, options)));
}

/**
 * Creates a getter that always fails with a `Forbidden` issue.
 *
 * @category constructors
 * @since 1.0.0
 */
export function forbidden<T, E>(message: (oe: Option.Option<E>) => string): Getter<T, E>
{
    return fail<T, E>((oe, options) =>
    {
        const annotations = { message: message(oe) };
        return Option.isSome(oe)
            ? new SchemaIssue.Forbidden(annotations, oe.value, options)
            : new SchemaIssue.Forbidden(annotations);
    });
}

/**
 * Getter that always fails with a `Forbidden` issue indicating that encoding is unsupported.
 *
 * @category constructors
 * @since 1.0.0
 */
export const forbiddenEncoding: Getter<never, unknown> = forbidden(() => "Encoding is not supported");

const passthrough_: Passthrough = makeGetter({ _tag: "Passthrough" });

/**
 * Returns the identity getter — passes the value through unchanged.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthrough<T, E>(options: {
    readonly strict: false;
}): Getter<T, E>;

export function passthrough<T>(): Getter<T, T>;

export function passthrough<T>(): Getter<T, T>
{
    return passthrough_;
}

/**
 * Returns the identity getter typed for the relationship `T extends E`.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthroughSupertype<T extends E, E>(): Getter<T, E>;

export function passthroughSupertype<T>(): Getter<T, T>
{
    return passthrough_;
}

/**
 * Returns the identity getter, typed for when the encoded type `E` is a subtype of `T`.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthroughSubtype<T, E extends T>(): Getter<T, E>;

export function passthroughSubtype<T>(): Getter<T, T>
{
    return passthrough_;
}

/**
 * Creates a getter that fails with `MissingKey` if the input is absent (`Option.None`).
 *
 * @category validation
 * @since 1.0.0
 */
export function required<T, E extends T = T>(annotations?: Schema.Annotations.Key<T>): Getter<T, E>
{
    return transformOptionalResult((input) => Option.isNone(input) ? Result.fail(new SchemaIssue.MissingKey(annotations)) : Result.succeed(input));
}

/**
 * Creates a getter that validates a value using an effectful check function.
 *
 * @category validation
 * @since 1.0.0
 */
export function checkResult<T, R extends never = never>(f: (input: T, options: SchemaAST.ParseOptions) => Result.Result<undefined | boolean | Schema.FilterIssue, never>): Getter<T, T, R>
{
    return transformResult((t, options) =>
    {
        return f(t, options).pipe(Result.flatMap((out) =>
        {
            const issue = SchemaIssue.makeSingle(out, t, options);
            return issue ?
                Result.fail(issue) :
                Result.succeed(t);
        }));
    });
}

/**
 * Creates a getter that applies a pure function to present values.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transform<T, E>(f: (e: E) => T): Getter<T, E>
{
    return makeGetter({ _tag: "Transform",
        transform: f });
}

/**
 * Creates a getter that applies an effectful transformation to present values.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transformResult<T, E, R extends never = never>(f: (e: E, options: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>): Getter<T, E, R>
{
    return makeGetter({ _tag: "TransformResult",
        transform: f });
}

/**
 * Creates a getter that transforms the full `Option` — both present and absent values.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transformOptional<T, E>(f: (oe: Option.Option<E>) => Option.Option<T>): Getter<T, E>
{
    return makeGetter({ _tag: "TransformOptional",
        transform: f });
}

/**
 * Creates a getter that effectfully transforms the full `Option`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transformOptionalResult<T, E, R extends never = never>(f: (input: Option.Option<E>, options: SchemaAST.ParseOptions) => Result.Result<Option.Option<T>, SchemaIssue.Issue>): Getter<T, E, R>
{
    return makeGetter({ _tag: "TransformOptionalResult",
        transform: f });
}

/**
 * Creates a getter that always returns `None`, effectively omitting the value from output.
 *
 * @category filtering
 * @since 1.0.0
 */
export function omit<T>(): Getter<never, T>
{
    return transformOptional(() => Option.none());
}

/**
 * Creates a getter that replaces `undefined` values with a default.
 *
 * @category transforming
 * @since 1.0.0
 */
export function withDefault<T, R extends never = never>(defaultValue: () => Result.Result<T, SchemaIssue.Issue>): Getter<T, T | undefined, R>
{
    return transformOptionalResult((o) =>
    {
        const filtered = Option.filter(o, Predicate.isNotUndefined);
        return Option.isSome(filtered) ? Result.succeed(filtered) : Result.map(InternalParser.checked(defaultValue()), Option.some);
    });
}

/**
 * Coerces any value to a `string` using the global `String()` constructor.
 *
 * @category converting
 * @since 1.0.0
 */
export function String<E>(): Getter<string, E>
{
    return transform(globalThis.String);
}

/**
 * Coerces any value to a `number` using the global `Number()` constructor.
 *
 * @category converting
 * @since 1.0.0
 */
export function Number<E>(): Getter<number, E>
{
    return transform(globalThis.Number);
}

/**
 * Coerces any value to a `boolean` using the global `Boolean()` constructor.
 *
 * @category converting
 * @since 1.0.0
 */
export function Boolean<E>(): Getter<boolean, E>
{
    return transform(globalThis.Boolean);
}

/**
 * Coerces a value to `bigint` using the global `BigInt()` constructor.
 *
 * @category converting
 * @since 1.0.0
 */
export function BigInt<E extends string | number | bigint | boolean>(): Getter<bigint, E>
{
    return transform(globalThis.BigInt);
}

/**
 * Coerces a value to a `Date` using `new Date(input)`.
 *
 * @category converting
 * @since 1.0.0
 */
export function Date<E extends string | number | Date>(): Getter<Date, E>
{
    return transform((u) => new globalThis.Date(u));
}

/**
 * Strips whitespace from both ends of a string.
 *
 * @category transforming
 * @since 1.0.0
 */
export function trim<E extends string>(): Getter<string, E>
{
    return transform(Str.trim);
}

/**
 * Capitalizes the first character of a string.
 *
 * @category transforming
 * @since 1.0.0
 */
export function capitalize<E extends string>(): Getter<string, E>
{
    return transform(Str.capitalize);
}

/**
 * Uncapitalizes the first character of a string.
 *
 * @category transforming
 * @since 1.0.0
 */
export function uncapitalize<E extends string>(): Getter<string, E>
{
    return transform(Str.uncapitalize);
}

/**
 * Converts a `snake_case` string to `camelCase`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function snakeToCamel<E extends string>(): Getter<string, E>
{
    return transform(Str.snakeToCamel);
}

/**
 * Converts a `camelCase` string to `snake_case`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function camelToSnake<E extends string>(): Getter<string, E>
{
    return transform(Str.camelToSnake);
}

/**
 * Converts a string to lowercase.
 *
 * @category transforming
 * @since 1.0.0
 */
export function toLowerCase<E extends string>(): Getter<string, E>
{
    return transform(Str.toLowerCase);
}

/**
 * Converts a string to uppercase.
 *
 * @category transforming
 * @since 1.0.0
 */
export function toUpperCase<E extends string>(): Getter<string, E>
{
    return transform(Str.toUpperCase);
}

type ParseJsonOptions = {
    readonly reviver?: Parameters<typeof JSON.parse>[1];
};

/**
 * Parses a JSON string into a value.
 *
 * @category decoding
 * @since 1.0.0
 */
export function parseJson<E extends string>(): Getter<Schema.MutableJson, E>;

export function parseJson<E extends string>(options: ParseJsonOptions): Getter<unknown, E>;

export function parseJson<E extends string>(options?: ParseJsonOptions | undefined): Getter<unknown, E>
{
    return transformResult((input, parseOptions) => Result.try({
        try: () => JSON.parse(input, options?.reviver),
        catch: () => new SchemaIssue.InvalidValue({ expected: "a valid JSON string" }, input, parseOptions)
    }));
}

/**
 * Replacer function or property allowlist accepted by `JSON.stringify`.
 *
 * @category utility types
 * @since 1.0.0
 */
export type JsonReplacer = ((this: any, key: string, value: any) => any) | Array<string | number> | null;

type StringifyJsonOptions = {
    readonly replacer?: JsonReplacer | undefined;
    readonly space?: Parameters<typeof JSON.stringify>[2];
};

/**
 * Stringifies a present value using `JSON.stringify`.
 *
 * @category encoding
 * @since 1.0.0
 */
export function stringifyJson(options?: StringifyJsonOptions): Getter<string, unknown>
{
    return transformResult((input, parseOptions) => Result.try({
        try: () =>
        {
            const output = JSON.stringify(input, options?.replacer as any, options?.space);
            if (output === undefined)
            {
                throw new TypeError("Value cannot be represented as JSON");
            }

            return output;
        },
        catch: () => new SchemaIssue.InvalidValue({ expected: "a JSON-serializable value" }, input, parseOptions)
    }));
}

/**
 * Splits a string into an array of strings by a separator.
 *
 * @category splitting
 * @since 1.0.0
 */
export function split<E extends string>(options?: {
    readonly separator?: string | undefined;
}): Getter<ReadonlyArray<string>, E>
{
    const separator = options?.separator ?? ",";
    return transform((input) => input === "" ? [] : input.split(separator));
}

/**
 * Encodes a `Uint8Array` or string to a Base64 string.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeBase64<E extends Uint8Array | string>(): Getter<string, E>
{
    return transform(Base64.encode);
}

/**
 * Encodes a `Uint8Array` or string to a URL-safe Base64 string.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeBase64Url<E extends Uint8Array | string>(): Getter<string, E>
{
    return transform(Base64Url.encode);
}

/**
 * Encodes a `Uint8Array` or string to a hexadecimal string.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeHex<E extends Uint8Array | string>(): Getter<string, E>
{
    return transform(Hex.encode);
}

/**
 * Decodes a Base64 string to a `Uint8Array`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeBase64<E extends string>(): Getter<Uint8Array, E>
{
    return transformResult((input, options) => Result.mapError(Base64.decode(input), () => new SchemaIssue.InvalidValue({ expected: "a valid Base64 string" }, input, options)));
}

/**
 * Decodes a Base64 string to a UTF-8 `string`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeBase64String<E extends string>(): Getter<string, E>
{
    return transformResult((input, options) => Result.match(Base64.decodeString(input), {
        onFailure: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid Base64 string" }, input, options)),
        onSuccess: Result.succeed
    }));
}

/**
 * Decodes a URL-safe Base64 string to a `Uint8Array`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeBase64Url<E extends string>(): Getter<Uint8Array, E>
{
    return transformResult((input, options) => Result.match(Base64Url.decode(input), {
        onFailure: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid Base64Url string" }, input, options)),
        onSuccess: Result.succeed
    }));
}

/**
 * Decodes a URL-safe Base64 string to a UTF-8 `string`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeBase64UrlString<E extends string>(): Getter<string, E>
{
    return transformResult((input, options) => Result.match(Base64Url.decodeString(input), {
        onFailure: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid Base64Url string" }, input, options)),
        onSuccess: Result.succeed
    }));
}

/**
 * Decodes a hexadecimal string to a `Uint8Array`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeHex<E extends string>(): Getter<Uint8Array, E>
{
    return transformResult((input, options) => Result.match(Hex.decode(input), {
        onFailure: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid hexadecimal string" }, input, options)),
        onSuccess: Result.succeed
    }));
}

/**
 * Decodes a hexadecimal string to a UTF-8 `string`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeHexString<E extends string>(): Getter<string, E>
{
    return transformResult((input, options) => Result.match(Hex.decodeString(input), {
        onFailure: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid hexadecimal string" }, input, options)),
        onSuccess: Result.succeed
    }));
}

/**
 * Encodes a present string using `encodeURIComponent`.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeUriComponent<E extends string>(): Getter<string, E>
{
    return transform(encodeURIComponent);
}

/**
 * Decodes a URI component encoded string using `decodeURIComponent`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeUriComponent<E extends string>(): Getter<string, E>
{
    return transformResult((input, options) =>
    {
        try
        {
            return Result.succeed(globalThis.decodeURIComponent(input));
        }
        catch
        {
            return Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid URI component" }, input, options));
        }
    });
}

