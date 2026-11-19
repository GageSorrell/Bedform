/**
 * Builds two-way conversions used by schemas.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/SchemaTransformation
 *
 * @file      SchemaTransformation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Result from "./Result.js";

import * as BigDecimal from "./BigDecimal.js";

import * as ByteSize from "./ByteSize.js";

import * as Duration from "./Duration.js";

import { format, formatDate, formatJson } from "./Formatter.js";

import { dual } from "./Function.js";

import * as Option from "./Option.js";

import * as Pipeable from "./Pipeable.js";

import * as Predicate from "./Predicate.js";

import type { ErrorOptions, Json } from "./Schema.js";

import type * as SchemaAST from "./SchemaAST.js";

import * as SchemaGetter from "./SchemaGetter.js";

import * as SchemaIssue from "./SchemaIssue.js";

const TypeId = "~effect/SchemaTransformation/Transformation";

/**
 * Represents a bidirectional transformation between a decoded type `T` and an encoded
 * type `E`, built from a pair of `Getter`s.
 *
 * @category models
 * @since 1.0.0
 */
export interface Transformation<in out T, in out E, RD extends never = never, RE extends never = never> extends Pipeable.Pipeable
{
    readonly [TypeId]: typeof TypeId;
    readonly _tag: "Transformation";
    readonly decode: SchemaGetter.Getter<T, E, RD>;
    readonly encode: SchemaGetter.Getter<E, T, RE>;
    flip(): Transformation<E, T, RE, RD>;
}

/**
 * Constructs a bidirectional schema transformation from its decode and encode getters.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Transformation: new <T, E, RD extends never = never, RE extends never = never>(decode: SchemaGetter.Getter<T, E, RD>, encode: SchemaGetter.Getter<E, T, RE>) => Transformation<T, E, RD, RE> = class <in out T, in out E, RD extends never = never, RE extends never = never> extends Pipeable.Class
{
    readonly [TypeId] = TypeId;
    readonly _tag = "Transformation";
    readonly decode: SchemaGetter.Getter<T, E, RD>;
    readonly encode: SchemaGetter.Getter<E, T, RE>;
    constructor(decode: SchemaGetter.Getter<T, E, RD>, encode: SchemaGetter.Getter<E, T, RE>)
    {
        super();
        this.decode = decode;
        this.encode = encode;
    }
    flip(): Transformation<E, T, RE, RD>
    {
        return new Transformation(this.encode, this.decode);
    }
};

/**
 * Composes two schema transformations into a single bidirectional conversion.
 *
 * @category combining
 * @since 1.0.0
 */
export const composeTransformation: {
    /**
     * Composes two schema transformations into a single bidirectional conversion.
     *
     * @category combining
     * @since 1.0.0
     */
    <T, T2, RD2 extends never, RE2 extends never>(other: Transformation<T2, T, RD2, RE2>): <E, RD extends never, RE extends never>(self: Transformation<T, E, RD, RE>) => Transformation<T2, E, RD | RD2, RE | RE2>;

    /**
     * Composes two schema transformations into a single bidirectional conversion.
     *
     * @category combining
     * @since 1.0.0
     */
    <T, E, RD extends never, RE extends never, T2, RD2 extends never, RE2 extends never>(self: Transformation<T, E, RD, RE>, other: Transformation<T2, T, RD2, RE2>): Transformation<T2, E, RD | RD2, RE | RE2>;
} = dual(2, <T, E, RD extends never, RE extends never, T2, RD2 extends never, RE2 extends never>(self: Transformation<T, E, RD, RE>, other: Transformation<T2, T, RD2, RE2>): Transformation<T2, E, RD | RD2, RE | RE2> => new Transformation(SchemaGetter.compose(self.decode, other.decode), SchemaGetter.compose(other.encode, self.encode)));

/**
 * Returns `true` if `u` is a `Transformation` instance.
 *
 * @category guards
 * @since 1.0.0
 */
export function isTransformation(u: unknown): u is Transformation<any, any, never, never>
{
    return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId;
}

/**
 * Constructs a `Transformation` from an object with `decode` and `encode`
 * `Getter`s. If the input is already a `Transformation`, returns it as-is.
 *
 * @category constructors
 * @since 1.0.0
 */
export const makeTransformation = <T, E, RD extends never = never, RE extends never = never>(options: {
    readonly decode: SchemaGetter.Getter<T, E, RD>;
    readonly encode: SchemaGetter.Getter<E, T, RE>;
}): Transformation<T, E, RD, RE> =>
{
    if (isTransformation(options))
    {
        return options as any;
    }

    return new Transformation(options.decode, options.encode);
};

/**
 * Creates a `Transformation` from effectful decode and encode functions.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transformResult<T, E, RD extends never = never, RE extends never = never>(options: {
    readonly decode: (e: E, options: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>;
    readonly encode: (t: T, options: SchemaAST.ParseOptions) => Result.Result<E, SchemaIssue.Issue>;
}): Transformation<T, E, RD, RE>
{
    return new Transformation(SchemaGetter.transformResult(options.decode), SchemaGetter.transformResult(options.encode));
}

/**
 * Creates a `Transformation` from pure (sync, infallible) decode and encode
 * functions.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transform<T, E>(options: {
    readonly decode: (input: E) => T;
    readonly encode: (input: T) => E;
}): Transformation<T, E>
{
    return new Transformation(SchemaGetter.transform(options.decode), SchemaGetter.transform(options.encode));
}

/**
 * Creates a `Transformation` where decode and encode operate on `Option`
 * values, giving full control over missing-key handling.
 *
 * @category transforming
 * @since 1.0.0
 */
export function transformOptional<T, E>(options: {
    readonly decode: (input: Option.Option<E>) => Option.Option<T>;
    readonly encode: (input: Option.Option<T>) => Option.Option<E>;
}): Transformation<T, E>
{
    return new Transformation(SchemaGetter.transformOptional(options.decode), SchemaGetter.transformOptional(options.encode));
}

/**
 * Transforms strings by trimming whitespace on decode.
 * Encode is passthrough (no change).
 *
 * @category transforming
 * @since 1.0.0
 */
export function trim(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.trim(), SchemaGetter.passthrough());
}

/**
 * Transforms strings by converting snake_case to camelCase
 * on decode and camelCase to snake_case on encode.
 *
 * @category transforming
 * @since 1.0.0
 */
export function snakeToCamel(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.snakeToCamel(), SchemaGetter.camelToSnake());
}

/**
 * Transforms strings by lowercasing on decode.
 * Encode is passthrough.
 *
 * @category transforming
 * @since 1.0.0
 */
export function toLowerCase(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.toLowerCase(), SchemaGetter.passthrough());
}

/**
 * Transforms strings by uppercasing on decode.
 * Encode is passthrough.
 *
 * @category transforming
 * @since 1.0.0
 */
export function toUpperCase(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.toUpperCase(), SchemaGetter.passthrough());
}

/**
 * Transforms strings by capitalizing the first character on
 * decode. Encode is passthrough.
 *
 * @category transforming
 * @since 1.0.0
 */
export function capitalize(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.capitalize(), SchemaGetter.passthrough());
}

/**
 * Transforms strings by lowercasing the first character on
 * decode. Encode is passthrough.
 *
 * @category transforming
 * @since 1.0.0
 */
export function uncapitalize(): Transformation<string, string>
{
    return new Transformation(SchemaGetter.uncapitalize(), SchemaGetter.passthrough());
}

const passthrough_ = new Transformation(SchemaGetter.passthrough<any>(), SchemaGetter.passthrough<any>());

/**
 * Transforms values by returning the input unchanged in both
 * directions.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthrough<T, E>(options: {
    readonly strict: false;
}): Transformation<T, E>;

export function passthrough<T>(): Transformation<T, T>;

export function passthrough<T>(): Transformation<T, T>
{
    return passthrough_;
}

/**
 * Transforms values without changing them, typed so that `T extends E`, where the decoded
 * type `T` is a subtype of the encoded type `E`.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthroughSupertype<T extends E, E>(): Transformation<T, E>;

export function passthroughSupertype<T>(): Transformation<T, T>
{
    return passthrough_;
}

/**
 * Transforms values without changing them, typed so that `E extends T` — the encoded
 * type is a subtype of the decoded type.
 *
 * @category constructors
 * @since 1.0.0
 */
export function passthroughSubtype<T, E extends T>(): Transformation<T, E>;

export function passthroughSubtype<T>(): Transformation<T, T>
{
    return passthrough_;
}

/**
 * Decodes a `string` into a `number` and encodes a `number` back to a
 * `string`.
 *
 * @category converting
 * @since 1.0.0
 */
export const numberFromString = new Transformation(SchemaGetter.Number(), SchemaGetter.String());

/**
 * Decodes a `string` into a `bigint` and encodes a `bigint` back to a
 * `string`.
 *
 * @category converting
 * @since 1.0.0
 */
export const bigintFromString = new Transformation(SchemaGetter.BigInt(), SchemaGetter.String());

/**
 * Decodes a `string` into a `Date` and encodes a `Date` back to a `string`.
 *
 * @category converting
 * @since 1.0.0
 */
export const dateFromString: Transformation<globalThis.Date, string> = new Transformation(SchemaGetter.Date(), SchemaGetter.transform(formatDate));

/**
 * Decodes epoch milliseconds into a `Date` and encodes a `Date` back to epoch
 * milliseconds.
 *
 * @category converting
 * @since 1.0.0
 */
export const dateFromMillis: Transformation<globalThis.Date, number> = new Transformation(SchemaGetter.Date(), SchemaGetter.transform((date) => date.getTime()));

/**
 * Decodes a `string` into a `Duration` and encodes a `Duration` back to a
 * parseable `string`.
 *
 * @category transforming
 * @since 1.0.0
 */
export const durationFromString: Transformation<Duration.Duration, string> = transformResult<Duration.Duration, string>({
    decode: (s, options) => Option.match(Duration.fromInput(s as Duration.Input), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid Duration string" }, s, options)),
        onSome: Result.succeed
    }),
    encode: (duration) => Result.succeed(String(duration))
});

/**
 * Decodes a `bigint` (nanoseconds) into a `Duration` and encodes a
 * `Duration` back to `bigint` nanoseconds.
 *
 * @category transforming
 * @since 1.0.0
 */
export const durationFromNanos: Transformation<Duration.Duration, bigint> = transformResult({
    decode: (i) => Result.succeed(Duration.nanos(i)),
    encode: (a, options) => Option.match(Duration.toNanos(a), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a Duration representable as a bigint" }, a, options)),
        onSome: (nanos) => Result.succeed(nanos)
    })
});

/**
 * Decodes a `number` of milliseconds into a `Duration` and encodes a `Duration`
 * back to milliseconds.
 *
 * @category transforming
 * @since 1.0.0
 */
export const durationFromMillis: Transformation<Duration.Duration, number> = transform({
    decode: (i) => Duration.millis(i),
    encode: (a) => Duration.toMillis(a)
});

/**
 * Decodes a string into a `ByteSize` and encodes it as an exact string.
 *
 * @category transforming
 * @since 1.0.0
 */
export const byteSizeFromString: Transformation<ByteSize.ByteSize, string> = transformResult({
    decode: (input, options) => Option.match(ByteSize.fromString(input), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid ByteSize string" }, input, options)),
        onSome: Result.succeed
    }),
    encode: (byteSize) => Result.succeed(`${byteSize} ${byteSize === BigInt(1) ? "byte" : "bytes"}`)
});

/**
 * Decodes a non-negative bigint byte count into a `ByteSize`.
 *
 * @category transforming
 * @since 1.0.0
 */
export const byteSizeFromBigInt: Transformation<ByteSize.ByteSize, bigint> = transformResult({
    decode: (input, options) => Option.match(ByteSize.fromInput(input), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a non-negative bigint byte count" }, input, options)),
        onSome: Result.succeed
    }),
    encode: (byteSize) => Result.succeed(ByteSize.toBigInt(byteSize))
});

/**
 * Decodes a non-negative safe-integer byte count into a `ByteSize`.
 *
 * @category transforming
 * @since 1.0.0
 */
export const byteSizeFromNumber: Transformation<ByteSize.ByteSize, number> = transformResult({
    decode: (input, options) => Option.match(ByteSize.fromInput(input), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a non-negative safe-integer byte count" }, input, options)),
        onSome: Result.succeed
    }),
    encode: (byteSize, options) => Option.match(ByteSize.toNumber(byteSize), {
        onNone: () => Result.fail(new SchemaIssue.InvalidValue({ expected: "a ByteSize representable as a safe integer" }, byteSize, options)),
        onSome: Result.succeed
    })
});

type JsonError = {
    message: string;
    name?: string;
    stack?: string;
    cause?: Json;
};

const isJsonError = (input: unknown): input is JsonError => Predicate.isObject(input) && typeof input["message"] === "string";

const decodeJsonError = (input: JsonError): Error =>
{
    const hasCause = Object.hasOwn(input, "cause");
    const err = hasCause
        ? new Error(input.message, { cause: decodeDefect(input.cause as Json) })
        : new Error(input.message);
    if (typeof input.name === "string" && input.name !== "Error")
    {err.name = input.name;}

    if (typeof input.stack === "string")
    {err.stack = input.stack;}

    return err;
};

const encodeUnknownAsJson = (input: unknown): Json =>
{
    try
    {
        const json = formatJson(input);
        return json === undefined ? format(input) : JSON.parse(json);
    }
    catch
    {
        return format(input);
    }
};

const encodeJsonError = (input: Error, options: ErrorOptions | undefined, encodeDefect: (input: unknown) => Json): JsonError =>
{
    const encoded: JsonError = {
        name: input.name,
        message: typeof input.message === "string" ? input.message : ""
    };
    if (options?.includeStack && typeof input.stack === "string")
    {
        encoded.stack = input.stack;
    }

    if (!options?.excludeCause && input.cause !== undefined)
    {
        encoded.cause = encodeDefect(input.cause);
    }

    return encoded;
};

const makeEncodeDefect = (options?: ErrorOptions): (input: unknown) => Json =>
{
    const seen = new WeakSet<object>();
    const encode = (input: unknown): Json =>
    {
        if (Predicate.isError(input))
        {
            if (seen.has(input))
            {
                return "[Circular]";
            }

            seen.add(input);
            const encoded = encodeJsonError(input, options, encode);
            seen.delete(input);
            return encoded;
        }

        return encodeUnknownAsJson(input);
    };

    return encode;
};

const decodeDefect = (input: Json): unknown => isJsonError(input) ? decodeJsonError(input) : input;

/**
 * Supports error from json error during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const errorFromJsonError = (options?: ErrorOptions): Transformation<Error, JsonError> => transform({
    decode: decodeJsonError,
    encode: (input) => makeEncodeDefect(options)(input) as JsonError
});

/**
 * Supports defect from json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const defectFromJson = (options?: ErrorOptions) => transform({
    decode: decodeDefect,
    encode: makeEncodeDefect(options)
});

/**
 * Decodes `T | null` into `Option<T>` and encodes `Option<T>` back to
 * `T | null`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function optionFromNullOr<T>(): Transformation<Option.Option<T>, T | null>
{
    return transform({
        decode: Option.fromNullOr,
        encode: Option.getOrNull
    });
}

/**
 * Decodes `T | undefined` into `Option<T>` and encodes `Option.none()` back to
 * `undefined`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function optionFromUndefinedOr<T>(): Transformation<Option.Option<T>, T | undefined>
{
    return transform({
        decode: Option.fromUndefinedOr,
        encode: Option.getOrUndefined
    });
}

/**
 * Decodes `T | null | undefined` into `Option<T>` and encodes `Option<T>`
 * back to `T | null` or `T | undefined` depending on the provided
 * `options.onNoneEncoding` (defaults to `undefined`).
 *
 * @category transforming
 * @since 1.0.0
 */
export function optionFromNullishOr<T>(options?: {
    onNoneEncoding: null | undefined;
}): Transformation<Option.Option<T>, T | null | undefined>
{
    return transform({
        decode: Option.fromNullishOr,
        encode: options?.onNoneEncoding === null ? Option.getOrNull : Option.getOrUndefined
    });
}

/**
 * Decodes an optional struct key into `Option<T>` and encodes `Option<T>`
 * back to an optional key.
 *
 * @category transforming
 * @since 1.0.0
 */
export function optionFromOptionalKey<T>(): Transformation<Option.Option<T>, T>
{
    return transformOptional({
        decode: Option.some,
        encode: Option.flatten
    });
}

/**
 * Decodes optional values into `Option<T>` and encodes `Option.none()` back to
 * an omitted optional value.
 *
 * @category transforming
 * @since 1.0.0
 */
export function optionFromOptional<T>(): Transformation<Option.Option<T>, T | undefined>
{
    return transformOptional<Option.Option<T>, T | undefined>({
        decode: (ot) => ot.pipe(Option.filter(Predicate.isNotUndefined), Option.some),
        encode: Option.flatten
    });
}

/**
 * Decodes a `string` into a `BigDecimal` and encodes a `BigDecimal` back to
 * its string representation.
 *
 * @category transforming
 * @since 1.0.0
 */
export const bigDecimalFromString: Transformation<BigDecimal.BigDecimal, string> = transformResult<BigDecimal.BigDecimal, string>({
    decode: (s, options) =>
    {
        const result = BigDecimal.fromString(s);
        return Option.isNone(result)
            ? Result.fail(new SchemaIssue.InvalidValue({ expected: "a valid BigDecimal string" }, s, options))
            : Result.succeed(result.value);
    },
    encode: (bd) => Result.succeed(BigDecimal.format(bd))
});

/**
 * Decodes a Base64-encoded `string` into a `Uint8Array` and encodes a
 * `Uint8Array` back to a Base64 string.
 *
 * @category encoding
 * @since 1.0.0
 */
export const uint8ArrayFromBase64String: Transformation<Uint8Array, string> = new Transformation(SchemaGetter.decodeBase64(), SchemaGetter.encodeBase64());

/**
 * Decodes a Base64-encoded `string` into a UTF-8 `string` and encodes a
 * UTF-8 `string` back to a Base64 string.
 *
 * @category encoding
 * @since 1.0.0
 */
export const stringFromBase64String: Transformation<string, string> = new Transformation(SchemaGetter.decodeBase64String(), SchemaGetter.encodeBase64());

/**
 * Decodes a base64 (URL) encoded `string` into a UTF-8 `string` and encodes it back.
 *
 * @category encoding
 * @since 1.0.0
 */
export const stringFromBase64UrlString: Transformation<string, string> = new Transformation(SchemaGetter.decodeBase64UrlString(), SchemaGetter.encodeBase64Url());

/**
 * Decodes a hex encoded `string` into a UTF-8 `string` and encodes it back.
 *
 * @category encoding
 * @since 1.0.0
 */
export const stringFromHexString: Transformation<string, string> = new Transformation(SchemaGetter.decodeHexString(), SchemaGetter.encodeHex());

/**
 * Decodes a URI component encoded string into a UTF-8 string and encodes a
 * UTF-8 string into a URI component encoded string.
 *
 * @category encoding
 * @since 1.0.0
 */
export const stringFromUriComponent: Transformation<string, string> = new Transformation(SchemaGetter.decodeUriComponent(), SchemaGetter.encodeUriComponent());

/**
 * Decodes a JSON string with `JSON.parse` and encodes a value with
 * `JSON.stringify`.
 *
 * @category decoding
 * @since 1.0.0
 */
export function fromJsonString(options?: {
    readonly reviver?: Parameters<typeof JSON.parse>[1] | undefined;
    readonly replacer?: SchemaGetter.JsonReplacer | undefined;
    readonly space?: Parameters<typeof JSON.stringify>[2] | undefined;
}): Transformation<unknown, string>
{
    return new Transformation(SchemaGetter.parseJson(options ?? {}), SchemaGetter.stringifyJson(options));
}
