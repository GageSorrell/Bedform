/**
 * Describes data shapes and how unknown input becomes trusted values.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/Schema
 *
 * @file      Schema.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */
/* eslint-disable @stylistic/max-statements-per-line */
/* Preserve public generic arities after constraining service channels to never. */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef, sort-imports, sort-keys, prefer-rest-params, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as InternalParser from "./Internal/Schema/parser.js";
import type { YieldableError as DataError } from "./Cause.js";
import * as RResult from "./Result.js";

import * as Arr from "./Array.js";

import * as BigDecimal_ from "./BigDecimal.js";

import type * as Brand from "./Internal/brand.js";

import * as ByteSize_ from "./ByteSize.js";

import * as Chunk_ from "./Chunk.js";

import * as Data from "./Data.js";

import * as Duration_ from "./Duration.js";

import * as Equal from "./Equal.js";

import type * as Equivalence from "./Equivalence.js";

import type { Formatter } from "./Formatter.js";

import { format, formatPropertyKey } from "./Formatter.js";

import * as HashMap_ from "./HashMap.js";

import * as HashSet_ from "./HashSet.js";

import { NodeInspectSymbol } from "./Inspectable.js";

import * as InternalRecord from "./Internal/record.js";

import * as InternalAnnotations from "./Internal/Schema/annotations.js";

import * as InternalMake from "./Internal/Schema/make.js";

import * as InternalStandardSchema from "./Internal/Schema/standardSchema.js";

import * as InternalToCodec from "./Internal/Schema/toCodec.js";

import * as InternalEquivalence from "./Internal/Schema/toEquivalence.js";

import * as InternalToFormatter from "./Internal/Schema/toFormatter.js";

import * as InternalToJsonSchemaDocument from "./Internal/Schema/toJsonSchemaDocument.js";

import * as InternalToRepresentation from "./Internal/Schema/toRepresentation.js";

import { isSchemaError as isSchemaErrorInternal, SchemaErrorTypeId } from "./Internal/schemaError.js";

import { getStackTraceLimit, setStackTraceLimit } from "./Internal/stackTraceLimit.js";

import type * as JsonSchema from "./JsonSchema.js";

import { remainder } from "./Number.js";

import * as Option_ from "./Option.js";

import * as Order from "./Order.js";

import * as Pipeable from "./Pipeable.js";

import * as Predicate from "./Predicate.js";

import * as Record_ from "./Record.js";

import * as Redacted_ from "./Redacted.js";

import * as RegExp_ from "./RegExp.js";

import * as Result_ from "./Result.js";

import * as SchemaAST from "./SchemaAST.js";

import * as SchemaGetter from "./SchemaGetter.js";

import * as SchemaIssue from "./SchemaIssue.js";

import * as SchemaParser from "./SchemaParser.js";

import type * as SchemaRepresentation from "./Internal/Schema/representation.js";

import * as SchemaTransformation from "./SchemaTransformation.js";

import type { StandardJSONSchemaV1, StandardSchemaV1 } from "./StandardSchema.js";

import type { Assign, Lambda, Mutable, Simplify } from "./Struct.js";

import * as Struct_ from "./Struct.js";

import type { IsUnion, RequiredKeys } from "./Types.js";

import type { Unify } from "./Unify.js";

const TypeId = InternalMake.TypeId;

/**
 * Whether a schema field is required or optional within a struct.
 *
 * @category models
 * @since 1.0.0
 */
export type Optionality = "required" | "optional";

/**
 * Whether a schema field is readonly or mutable within a struct.
 *
 * @category models
 * @since 1.0.0
 */
export type Mutability = "readonly" | "mutable";

/**
 * Whether a schema field has a constructor default value.
 *
 * @category models
 * @since 1.0.0
 */
export type ConstructorDefault = "no-default" | "with-default";
export namespace MakeOptions
{
/**
 * ~payload settings for MakeOptions.
 *
 * @category Types
 * @since 1.0.0
 */
    export interface Payload
    {
        readonly token: unknown;
        readonly value: unknown;
    }
}

/**
 * Options for synchronous makers and Class constructors.
 *
 * @category options
 * @since 1.0.0
 */
export interface MakeOptions
{
    /**
     * The parse options to use for the schema.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly parseOptions?: SchemaAST.ParseOptions | undefined;

    /**
     * Whether to disable validation for the schema.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly disableChecks?: boolean | undefined;

    /**
     * Supports without during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly "~payload"?: MakeOptions.Payload;
}

/**
 * The fully-parameterized schema interface without a construct signature.
 * Exposes all 14 type parameters controlling type inference, mutability,
 * optionality, services, and transformation behavior.
 *
 * @category models
 * @since 1.0.0
 */
export interface BottomWithoutNew<out T, out E, out RD extends never, out RE extends never, out Ast extends SchemaAST.AST, out Rebuild extends Top, out TypeMakeIn = T, out Iso = T, in out TypeParameters extends ReadonlyArray<Constraint> = readonly [
], out TypeMake = TypeMakeIn, out TypeMutability extends Mutability = "readonly", out TypeOptionality extends Optionality = "required", out TypeConstructorDefault extends ConstructorDefault = "no-default", out EncodedMutability extends Mutability = "readonly", out EncodedOptionality extends Optionality = "required"> extends Pipeable.Pipeable
{
    readonly [TypeId]: typeof TypeId;
    readonly "ast": Ast;
    readonly "Rebuild": Rebuild;
    readonly "~type.parameters": TypeParameters;
    readonly "Type": T;
    readonly "Encoded": E;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": TypeMakeIn;
    readonly "~type.make": TypeMake;
    readonly "~type.constructor.default": TypeConstructorDefault;
    readonly "Iso": Iso;
    readonly "~type.mutability": TypeMutability;
    readonly "~type.optionality": TypeOptionality;
    readonly "~encoded.mutability": EncodedMutability;
    readonly "~encoded.optionality": EncodedOptionality;
    annotate(annotations: Annotations.Bottom<this["Type"], this["~type.parameters"]>): this["Rebuild"];
    annotateKey(annotations: Annotations.Key<this["Type"]>): this["Rebuild"];
    check(...checks: readonly [
        SchemaAST.Check<this["Type"]>,
        ...Array<SchemaAST.Check<this["Type"]>>
    ]): this["Rebuild"];
    rebuild(ast: this["ast"]): this["Rebuild"];

    /**
     * Constructs a value from the make input representation synchronously.
     *
     * @category Utilities
     * @since 1.0.0
     */
    make(input: this["~type.make.in"], options?: MakeOptions): this["Type"];

    /**
     * Constructs a value from the make input representation, returning `Option.none`
     * when validation fails.
     *
     * @category Utilities
     * @since 1.0.0
     */
    makeOption(input: this["~type.make.in"], options?: MakeOptions): Option_.Option<this["Type"]>;
}

/**
 * Fully-parameterized base interface for schemas that can be extended directly
 * by TypeScript classes.
 *
 * @category utility types
 * @since 1.0.0
 */
export interface Bottom<out T, out E, out RD extends never, out RE extends never, out Ast extends SchemaAST.AST, out Rebuild extends Top, out TypeMakeIn = T, out Iso = T, in out TypeParameters extends ReadonlyArray<Constraint> = readonly [
], out TypeMake = TypeMakeIn, out TypeMutability extends Mutability = "readonly", out TypeOptionality extends Optionality = "required", out TypeConstructorDefault extends ConstructorDefault = "no-default", out EncodedMutability extends Mutability = "readonly", out EncodedOptionality extends Optionality = "required"> extends BottomWithoutNew<T, E, RD, RE, Ast, Rebuild, TypeMakeIn, Iso, TypeParameters, TypeMake, TypeMutability, TypeOptionality, TypeConstructorDefault, EncodedMutability, EncodedOptionality>
{
    new (_: never): {};
}

/**
 * Lazy `BottomWithoutNew` variant for schema implementations that
 * compute their public views on demand.
 *
 * @category utility types
 * @since 1.0.0
 */
export interface BottomLazyWithoutNew<out Ast extends SchemaAST.AST, out Rebuild extends Top, in out TypeParameters extends ReadonlyArray<Constraint> = readonly [
], out TypeMutability extends Mutability = "readonly", out TypeOptionality extends Optionality = "required", out TypeConstructorDefault extends ConstructorDefault = "no-default", out EncodedMutability extends Mutability = "readonly", out EncodedOptionality extends Optionality = "required"> extends BottomWithoutNew<unknown, unknown, never, never, Ast, Rebuild, unknown, unknown, TypeParameters, unknown, TypeMutability, TypeOptionality, TypeConstructorDefault, EncodedMutability, EncodedOptionality>
{
}

/**
 * Lazy `Bottom` variant for schemas that can be extended directly by TypeScript
 * classes.
 *
 * @category utility types
 * @since 1.0.0
 */
export interface BottomLazy<out Ast extends SchemaAST.AST, out Rebuild extends Top, in out TypeParameters extends ReadonlyArray<Constraint> = readonly [
], out TypeMutability extends Mutability = "readonly", out TypeOptionality extends Optionality = "required", out TypeConstructorDefault extends ConstructorDefault = "no-default", out EncodedMutability extends Mutability = "readonly", out EncodedOptionality extends Optionality = "required"> extends BottomLazyWithoutNew<Ast, Rebuild, TypeParameters, TypeMutability, TypeOptionality, TypeConstructorDefault, EncodedMutability, EncodedOptionality>
{
    new (_: never): {};
}

/**
 * Type-level representation returned by {@link declareConstructor}.
 *
 * @category constructors
 * @since 1.0.0
 */
export interface declareConstructor<T, E, TypeParameters extends ReadonlyArray<Constraint>, Iso = T> extends Bottom<T, E, TypeParameters[number]["DecodingServices"], TypeParameters[number]["EncodingServices"], SchemaAST.Declaration, declareConstructor<T, E, TypeParameters, Iso>, T, Iso, TypeParameters>
{
}

/**
 * Creates a schema for a **parametric** type (a generic container such as
 * `Array<A>`, `Option<A>`, etc.) by accepting a list of type-parameter schemas
 * and a decoder factory.
 *
 * @category constructors
 * @since 1.0.0
 */
export function declareConstructor<T, E = T, Iso = T>()
{
    return <const TypeParameters extends ReadonlyArray<Constraint>>(typeParameters: TypeParameters, run: (typeParameters: {
        readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"], TypeParameters[K]["Encoded"]>;
    }) => (u: unknown, self: SchemaAST.Declaration, options: SchemaAST.ParseOptions) => RResult.Result<T, SchemaIssue.Issue>, annotations?: Annotations.Declaration<T, TypeParameters>): declareConstructor<T, E, TypeParameters, Iso> =>
    {
        return make(new SchemaAST.Declaration(typeParameters.map(SchemaAST.getAST), (typeParameters) => run(typeParameters.map((ast) => make(ast)) as any), annotations));
    };
}

/**
 * Type-level representation returned by {@link declare}.
 *
 * @category constructors
 * @since 1.0.0
 */
export interface declare<T, Iso = T> extends declareConstructor<T, T, readonly [
], Iso>
{
    readonly "Rebuild": declare<T, Iso>;
}

/**
 * Creates a schema for a **non-parametric** opaque type using a type-guard
 * function. The schema accepts any unknown value and succeeds when `is` returns
 * `true`, failing with an `InvalidType` issue otherwise.
 *
 * @category constructors
 * @since 1.0.0
 */
export function declare<T, Iso = T>(is: (u: unknown) => u is T, annotations?: Annotations.Declaration<T> | undefined): declare<T, Iso>
{
    return declareConstructor<T, T, Iso>()([], () => (input, ast, options) => is(input) ?
        RResult.succeed(input) :
        RResult.fail(new SchemaIssue.InvalidType(ast, input, options)), annotations);
}

/**
 * Returns a schema widened to the fully-parameterized {@link Bottom} interface,
 * making all 14 type parameters visible to TypeScript.
 *
 * @category utility types
 * @since 1.0.0
 */
export function revealBottom<S extends Top>(bottom: S): Bottom<S["Type"], S["Encoded"], S["DecodingServices"], S["EncodingServices"], S["ast"], S["Rebuild"], S["~type.make.in"], S["Iso"], S["~type.parameters"], S["~type.make"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    return bottom as any;
}

/**
 * Adds metadata annotations to a schema without changing its runtime behavior.
 * This is the pipeable (curried) counterpart of the `.annotate` method.
 *
 * @category annotations
 * @since 1.0.0
 */
export function annotate<S extends Top>(annotations: Annotations.Bottom<S["Type"], S["~type.parameters"]>)
{
    return (self: S) => self.annotate(annotations);
}

/**
 * Adds metadata annotations to the **encoded** side of a schema without
 * changing its runtime behavior. This is the encoded-side counterpart of
 * `annotate`, which targets the decoded (Type) side.
 *
 * @category annotations
 * @since 1.0.0
 */
export function annotateEncoded<S extends Top>(annotations: Annotations.Bottom<S["Encoded"], readonly [
]>)
{
    return (self: S): S["Rebuild"] => flip(flip(self).annotate(annotations));
}

/**
 * Adds key-level annotations to a schema field. This is the pipeable
 * (curried) counterpart of the `.annotateKey` method.
 *
 * @category annotations
 * @since 1.0.0
 */
export function annotateKey<S extends Top>(annotations: Annotations.Key<S["Type"]>)
{
    return (self: S): S["Rebuild"] =>
    {
        return self.rebuild(SchemaAST.annotateKey(self.ast, annotations));
    };
}

/**
 * The existential "any schema" type — all type parameters are erased to `unknown`.
 *
 * @category models
 * @since 1.0.0
 */
export interface Top extends Bottom<unknown, unknown, never, never, SchemaAST.AST, Top, unknown, unknown, any, // this is because TypeParameters is invariant
    unknown, Mutability, Optionality, ConstructorDefault, Mutability, Optionality>
{
}

/**
 * Lightweight structural constraint for APIs that accept schema values but only
 * read their data and type-level views.
 *
 * @category models
 * @since 1.0.0
 */
export interface Constraint
{
    readonly [TypeId]: typeof TypeId;
    readonly "ast": SchemaAST.AST;
    readonly "Type": unknown;
    readonly "Encoded": unknown;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.parameters": any;
    readonly "~type.make.in": unknown;
    readonly "~type.make": unknown;
    readonly "Iso": unknown;
    readonly "~type.optionality": Optionality;
    readonly "~type.mutability": Mutability;
    readonly "~type.constructor.default": ConstructorDefault;
    readonly "~encoded.optionality": Optionality;
    readonly "~encoded.mutability": Mutability;
}

/**
 * Lightweight structural constraint for APIs that need codec type views but do
 * not need the full schema protocol.
 *
 * @category models
 * @since 1.0.0
 */
export interface ConstraintCodec<out T, out E = T, out RD extends never = never, out RE extends never = never> extends Constraint
{
    readonly "Type": T;
    readonly "Encoded": E;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
}

/**
 * Lightweight structural constraint for APIs that need decoder type views but
 * do not need the full schema protocol.
 *
 * @category models
 * @since 1.0.0
 */
export interface ConstraintDecoder<out T, out RD extends never = never> extends ConstraintCodec<T, unknown, RD, never>
{
}

/**
 * Lightweight structural constraint for APIs that need encoder type views but
 * do not need the full schema protocol.
 *
 * @category models
 * @since 1.0.0
 */
export interface ConstraintEncoder<out E, out RE extends never = never> extends ConstraintCodec<unknown, E, never, RE>
{
}

/**
 * Lightweight structural constraint for APIs that need schema views and the
 * rebuilt schema type, but do not call the full schema protocol.
 *
 * @category models
 * @since 1.0.0
 */
export interface ConstraintRebuildable extends Constraint
{
    readonly "Rebuild": Constraint;
}

/**
 * Namespace of type-level helpers for {@link Schema}.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Schema
{
    /**
     * Extracts the decoded `Type` from a schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<S> = S extends {
        readonly "Type": infer T;
    } ? T : never;
}

/**
 * A typed view of a schema that tracks only the decoded (output) type `T`.
 *
 * @category models
 * @since 1.0.0
 */
export interface Schema<out T> extends Top
{
    readonly "Type": T;
    readonly "Rebuild": Schema<T>;
}

/**
 * Namespace of type-level helpers for {@link Codec}.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Codec
{
    /**
     * Extracts the encoded (`Encoded`) type from a schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<S> = S extends {
        readonly "Encoded": infer E;
    } ? E : never;

    /**
     * Extracts the Effect services required during *decoding* from a schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type DecodingServices<S> = S extends {
        readonly "DecodingServices": never;
    } ? never : never;

    /**
     * Extracts the Effect services required during *encoding* from a schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type EncodingServices<S> = S extends {
        readonly "EncodingServices": never;
    } ? never : never;
}

/**
 * A schema that tracks the decoded type `T`, the encoded type `E`, and the
 * Effect services required during decoding (`RD`) and encoding (`RE`).
 *
 * @category models
 * @since 1.0.0
 */
export interface Codec<out T, out E = T, out RD extends never = never, out RE extends never = never> extends Schema<T>
{
    readonly "Encoded": E;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "Rebuild": Codec<T, E, RD, RE>;
}

/**
 * A schema that tracks the decoded type `T` and the Effect services required
 * during decoding (`RD`).
 *
 * @category models
 * @since 1.0.0
 */
export interface Decoder<out T, out RD extends never = never> extends Schema<T>
{
    readonly "Encoded": unknown;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "Rebuild": Decoder<T, RD>;
}

/**
 * A schema that tracks the encoded type `E` and the Effect services required
 * during encoding (`RE`).
 *
 * @category models
 * @since 1.0.0
 */
export interface Encoder<out E, out RE extends never = never> extends Schema<unknown>
{
    readonly "Encoded": E;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "Rebuild": Encoder<E, RE>;
}

/**
 * Returns a codec widened to the full {@link Codec} interface, prompting
 * TypeScript to infer all four type parameters (`T`, `E`, `RD`, `RE`).
 *
 * @category utility types
 * @since 1.0.0
 */
export function revealCodec<T, E, RD extends never, RE extends never>(codec: Codec<T, E, RD, RE>)
{
    return codec;
}

/**
 * Error thrown or returned when schema decoding or encoding fails.
 *
 * @category errors
 * @since 1.0.0
 */
export class SchemaError extends Data.TaggedError("SchemaError")<{
    readonly issue: SchemaIssue.Issue;
}>
{
    readonly [SchemaErrorTypeId]: typeof SchemaErrorTypeId = SchemaErrorTypeId;
    constructor(issue: SchemaIssue.Issue)
    {
        const stackTraceLimit = getStackTraceLimit();
        setStackTraceLimit(0);
        try
        {
            super({ issue });
        }
        finally
        {
            setStackTraceLimit(stackTraceLimit);
        }
    }
    override get message()
    {
        return SchemaIssue.defaultFormatter(this.issue);
    }
    override toJSON()
    {
        return {
            _tag: this._tag,
            message: this.message
        };
    }
    override [NodeInspectSymbol]()
    {
        return this.toJSON();
    }
    override toString()
    {
        return `SchemaError(${this.message})`;
    }
}

/**
 * Returns `true` if `u` is a {@link SchemaError}.
 *
 * @category guards
 * @since 1.0.0
 */
export function isSchemaError(u: unknown): u is SchemaError
{
    return isSchemaErrorInternal(u);
}

/**
 * Returns a "Standard Schema" object conforming to the [Standard Schema
 * v1](https://standardschema.dev/) specification.
 *
 * @category converting
 * @since 1.0.0
 */
export function toStandardSchemaV1<S extends ConstraintDecoder<unknown>>(self: S, options?: {
    readonly leafHook?: SchemaIssue.LeafHook | undefined;
    readonly checkHook?: SchemaIssue.CheckHook | undefined;
    readonly parseOptions?: SchemaAST.ParseOptions | undefined;
}): StandardSchemaV1<S["Encoded"], S["Type"]> & S
{
    return InternalStandardSchema.toStandardSchemaV1(self, options);
}

/**
 * Converts a schema to an experimental Standard JSON Schema V1 representation.
 *
 * @category converting
 * @since 1.0.0
 */
export function toStandardJSONSchemaV1<S extends Constraint>(self: S): StandardJSONSchemaV1<S["Encoded"], S["Type"]> & S
{
    return InternalStandardSchema.toStandardJSONSchemaV1(self);
}

/**
 * Creates a type guard function that checks if a value conforms to a given
 * schema.
 *
 * @category guards
 * @since 1.0.0
 */
export const is: typeof SchemaParser.is = SchemaParser.is;

/**
 * Creates an assertion function that throws an error if the input does not match
 * the schema.
 *
 * @category guards
 * @since 1.0.0
 */
export const asserts: <S extends Constraint, I>(schema: S, input: I) => asserts input is I & S["Type"] = SchemaParser.asserts;

/**
 * Decodes an `unknown` input against a schema, returning an `Option` that is
 * `Some` with the decoded value on success or `None` for schema mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export const decodeUnknownOption: <S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: unknown, options?: SchemaAST.ParseOptions) => Option_.Option<S["Type"]> = SchemaParser.decodeUnknownOption;

/**
 * Decodes a typed input (the schema's `Encoded` type) against a schema,
 * returning an `Option` that is `Some` with the decoded value on success or
 * `None` for schema mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export const decodeOption: <S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Option_.Option<S["Type"]> = SchemaParser.decodeOption;

/**
 * Decodes an `unknown` input against a schema, returning a `Result` that
 * succeeds with the decoded value or fails with a {@link SchemaError} for schema
 * mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeUnknownResult<S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = SchemaParser.decodeUnknownResult(schema, options);
    return (input: unknown, options?: SchemaAST.ParseOptions): Result_.Result<S["Type"], SchemaError> =>
    {
        return Result_.mapError(parser(input, options), (issue) => new SchemaError(issue));
    };
}

/**
 * Decodes a typed input (the schema's `Encoded` type) against a schema,
 * returning a `Result` that succeeds with the decoded value or fails with a
 * {@link SchemaError} for schema mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export const decodeResult: <S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Result_.Result<S["Type"], SchemaError> = decodeUnknownResult;

/**
 * Decodes an `unknown` input against a schema synchronously, returning the
 * decoded value or throwing a {@link SchemaError} for schema mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export function decodeUnknownSync<S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = decodeUnknownResult(schema, options); return (input: unknown, override?: SchemaAST.ParseOptions): S["Type"] =>
    {
        const result = parser(input, override); if (RResult.isFailure(result)) {throw result.failure;}

        return result.success;
    };
}

/**
 * Decodes a typed input (the schema's `Encoded` type) against a schema
 * synchronously, returning the decoded value or throwing a {@link SchemaError}
 * for schema mismatches.
 *
 * @category decoding
 * @since 1.0.0
 */
export const decodeSync: <S extends ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => S["Type"] = decodeUnknownSync;

/**
 * Encodes an `unknown` input against a schema, returning an `Option` that is
 * `Some` with the encoded value on success or `None` for schema mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export const encodeUnknownOption: <S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: unknown, options?: SchemaAST.ParseOptions) => Option_.Option<S["Encoded"]> = SchemaParser.encodeUnknownOption;

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning an
 * `Option` that is `Some` with the encoded value on success or `None` for schema
 * mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export const encodeOption: <S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Option_.Option<S["Encoded"]> = SchemaParser.encodeOption;

/**
 * Encodes an `unknown` input against a schema, returning a `Result` that
 * succeeds with the encoded value or fails with a {@link SchemaError} for schema
 * mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeUnknownResult<S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = SchemaParser.encodeUnknownResult(schema, options);
    return (input: unknown, options?: SchemaAST.ParseOptions): Result_.Result<S["Encoded"], SchemaError> =>
    {
        return Result_.mapError(parser(input, options), (issue) => new SchemaError(issue));
    };
}

/**
 * Encodes a typed input (the schema's `Type`) against a schema, returning a
 * `Result` that succeeds with the encoded value or fails with a
 * {@link SchemaError} for schema mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export const encodeResult: <S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Result_.Result<S["Encoded"], SchemaError> = encodeUnknownResult;

/**
 * Encodes an `unknown` input against a schema synchronously, throwing a
 * {@link SchemaError} for schema mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export function encodeUnknownSync<S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = encodeUnknownResult(schema, options); return (input: unknown, override?: SchemaAST.ParseOptions): S["Encoded"] =>
    {
        const result = parser(input, override); if (RResult.isFailure(result)) {throw result.failure;}

        return result.success;
    };
}

/**
 * Encodes a typed input (the schema's `Type`) against a schema synchronously,
 * throwing a {@link SchemaError} for schema mismatches.
 *
 * @category encoding
 * @since 1.0.0
 */
export const encodeSync: <S extends ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => S["Encoded"] = encodeUnknownSync;

/**
 * Creates a schema from an AST (Abstract Syntax Tree) node.
 *
 * @category constructors
 * @since 1.0.0
 */
export const make: <S extends Constraint>(ast: S["ast"], options?: object) => S = InternalMake.make;

/**
 * Checks whether a value is a `Schema`.
 *
 * @category guards
 * @since 1.0.0
 */
export function isSchema(u: unknown): u is Top
{
    return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId;
}

/**
 * Type-level representation returned by {@link optionalKey}.
 *
 * @category models
 * @since 1.0.0
 */
export interface optionalKey<S extends Constraint> extends BottomLazy<S["ast"], optionalKey<S>, S["~type.parameters"], S["~type.mutability"], "optional", S["~type.constructor.default"], S["~encoded.mutability"], "optional">
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

interface optionalKeyLambda extends Lambda
{
    <S extends Constraint>(self: S): optionalKey<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? optionalKey<this["~lambda.in"]> : never;
}

/**
 * Creates an exact optional key schema for struct fields. Unlike `optional`,
 * this creates exact optional properties (not `| undefined`) that can be
 * completely omitted from the object.
 *
 * @category combinators
 * @since 1.0.0
 */
export const optionalKey: optionalKeyLambda = Struct_.lambda<optionalKeyLambda>((schema) => make(SchemaAST.optionalKey(schema.ast), { schema }));

interface requiredKeyLambda extends Lambda
{
    <S extends Constraint>(self: optionalKey<S>): S;
    readonly "~lambda.out": this["~lambda.in"] extends optionalKey<Constraint> ? this["~lambda.in"]["schema"] : "Error: schema not eligible for requiredKey";
}

/**
 * Reverses `optionalKey` and returns the inner required schema.
 *
 * @category combinators
 * @since 1.0.0
 */
export const requiredKey: requiredKeyLambda = Struct_.lambda<requiredKeyLambda>((self) => self.schema);

/**
 * Type-level representation returned by {@link optional}.
 *
 * @category models
 * @since 1.0.0
 */
export interface optional<S extends Constraint> extends optionalKey<UndefinedOr<S>>
{
    readonly "Rebuild": optional<S>;
}

interface optionalLambda extends Lambda
{
    <S extends Constraint>(self: S): optional<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? optional<this["~lambda.in"]> : never;
}

/**
 * Marks a struct field as optional, allowing the key to be absent or
 * `undefined`.
 *
 * @category combinators
 * @since 1.0.0
 */
export const optional: optionalLambda = Struct_.lambda<optionalLambda>((self) =>
{
    const schema = UndefinedOr(self);
    return make(SchemaAST.optional(self.ast), { schema });
});

interface requiredLambda extends Lambda
{
    <S extends Constraint>(self: optional<S>): S;
    readonly "~lambda.out": this["~lambda.in"] extends optional<Constraint> ? this["~lambda.in"]["schema"]["members"][0] : "Error: schema not eligible for required";
}

/**
 * Reverses `optional` and returns the inner schema.
 *
 * @category combinators
 * @since 1.0.0
 */
export const required: requiredLambda = Struct_.lambda<requiredLambda>((self) => self.schema.members[0]);

/**
 * Type-level representation returned by {@link mutableKey}.
 *
 * @category models
 * @since 1.0.0
 */
export interface mutableKey<S extends Constraint> extends BottomLazy<S["ast"], mutableKey<S>, S["~type.parameters"], "mutable", S["~type.optionality"], S["~type.constructor.default"], "mutable", S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

interface mutableKeyLambda extends Lambda
{
    <S extends Constraint>(self: S): mutableKey<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? mutableKey<this["~lambda.in"]> : never;
}

/**
 * Makes a struct field mutable (removes the `readonly` modifier on the property).
 * Use {@link readonlyKey} to reverse.
 *
 * @category combinators
 * @since 1.0.0
 */
export const mutableKey: mutableKeyLambda = Struct_.lambda<mutableKeyLambda>((schema) => make(SchemaAST.mutableKey(schema.ast), { schema }));

interface readonlyKeyLambda extends Lambda
{
    <S extends Constraint>(self: mutableKey<S>): S;
    readonly "~lambda.out": this["~lambda.in"] extends mutableKey<Constraint> ? this["~lambda.in"]["schema"] : "Error: schema not eligible for readonlyKey";
}

/**
 * Reverses `mutableKey` and returns the inner readonly schema.
 *
 * @category combinators
 * @since 1.0.0
 */
export const readonlyKey: readonlyKeyLambda = Struct_.lambda<readonlyKeyLambda>((self) => self.schema);

/**
 * Type-level representation returned by {@link toType}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface toType<S extends Constraint> extends BottomLazy<S["ast"], toType<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Type"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

interface toTypeLambda extends Lambda
{
    <S extends Constraint>(self: S): toType<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? toType<this["~lambda.in"]> : never;
}

/**
 * Extracts the type-side schema: sets `Encoded` to equal the decoded `Type`,
 * discarding the encoding transformation path.
 *
 * @category transforming
 * @since 1.0.0
 */
export const toType: toTypeLambda = Struct_.lambda<toTypeLambda>((schema) => make(SchemaAST.toType(schema.ast), { schema }));

/**
 * Type-level representation returned by {@link toEncoded}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface toEncoded<S extends Constraint> extends BottomLazy<SchemaAST.AST, toEncoded<S>, ReadonlyArray<Constraint>, S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Encoded"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["Encoded"];
    readonly "~type.make": S["Encoded"];
    readonly "Iso": S["Encoded"];
    readonly schema: S;
}

interface toEncodedLambda extends Lambda
{
    <S extends Constraint>(self: S): toEncoded<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? toEncoded<this["~lambda.in"]> : never;
}

/**
 * Extracts the encoded-side schema: sets `Type` to equal the `Encoded`,
 * discarding the decoding transformation path.
 *
 * @category transforming
 * @since 1.0.0
 */
export const toEncoded: toEncodedLambda = Struct_.lambda<toEncodedLambda>((schema) => make(SchemaAST.toEncoded(schema.ast), { schema }));

const FlipTypeId = "~effect/Schema/flip";

/**
 * Type-level representation returned by {@link flip}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface flip<S extends Top> extends BottomLazy<SchemaAST.AST, flip<S>, ReadonlyArray<Constraint>, S["~encoded.mutability"], S["~encoded.optionality"], ConstructorDefault, S["~type.mutability"], S["~type.optionality"]>
{
    readonly "Type": S["Encoded"];
    readonly "Encoded": S["Type"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["Encoded"];
    readonly "~type.make": S["Encoded"];
    readonly "Iso": S["Encoded"];
    readonly [FlipTypeId]: typeof FlipTypeId;
    readonly schema: S;
}

/**
 * Supports is flip during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function isFlip$(schema: Top): schema is flip<any>
{
    return Predicate.hasProperty(schema, FlipTypeId) && schema[FlipTypeId] === FlipTypeId;
}

/**
 * Swaps the decoded and encoded sides of a schema.
 *
 * @category transforming
 * @since 1.0.0
 */
export function flip<S extends Top>(schema: S): S extends flip<infer F> ? F["Rebuild"] : flip<S>;

export function flip<S extends Top>(schema: S): flip<S>
{
    if (isFlip$(schema))
    {
        return schema.schema.rebuild(SchemaAST.flip(schema.ast));
    }

    return make(SchemaAST.flip(schema.ast), { [FlipTypeId]: FlipTypeId,
        schema });
}

/**
 * Type-level representation returned by {@link Literal}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Literal<L extends SchemaAST.LiteralValue> extends Bottom<L, L, never, never, SchemaAST.Literal, Literal<L>>
{
    readonly literal: L;
    transform<L2 extends SchemaAST.LiteralValue>(to: L2): decodeTo<Literal<L2>, Literal<L>>;
}

/**
 * Creates a schema for a single literal value (string, number, bigint, boolean, or null).
 *
 * @category constructors
 * @since 1.0.0
 */
export function Literal<L extends SchemaAST.LiteralValue>(literal: L): Literal<L>
{
    const out = make<Literal<L>>(new SchemaAST.Literal(literal), {
        literal,
        transform<L2 extends SchemaAST.LiteralValue>(to: L2): decodeTo<Literal<L2>, Literal<L>>
        {
            return out.pipe(decodeTo(Literal(to), {
                decode: SchemaGetter.transform(() => to),
                encode: SchemaGetter.transform(() => literal)
            }));
        }
    });
    return out;
}

/**
 * Namespace for {@link TemplateLiteral} helper types.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace TemplateLiteral
{
    /**
     * Constraint for schema parts that can appear inside a `TemplateLiteral`.
     *
     * @category utility types
     * @since 1.0.0
     */
    interface SchemaPart extends Constraint
    {
        readonly Encoded: string | number | bigint;
    }

    /**
     * Literal value that can be used directly as a part of a `TemplateLiteral`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type LiteralPart = string | number | bigint;

    /**
     * A single part of a `TemplateLiteral`, either an interpolated schema part or a
     * literal `string`, `number`, or `bigint`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Part = SchemaPart | LiteralPart;

    /**
     * Ordered list of parts used to construct a `TemplateLiteral` schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Parts = ReadonlyArray<Part>;
    type AppendType<Template extends string, Next> = Next extends LiteralPart ? `${Template}${Next}` : Next extends {
        readonly Encoded: infer E extends LiteralPart;
    } ? `${Template}${E}` : never;

    /**
     * Computes the encoded string literal type produced by concatenating the encoded
     * forms of all template literal parts.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<Parts> = Parts extends readonly [
        ...infer Init,
        infer Last
    ] ? AppendType<Encoded<Init>, Last> : "";
}

/**
 * Type-level representation returned by {@link TemplateLiteral}.
 *
 * @category models
 * @since 1.0.0
 */
export interface TemplateLiteral<Parts extends TemplateLiteral.Parts> extends Bottom<TemplateLiteral.Encoded<Parts>, TemplateLiteral.Encoded<Parts>, never, never, SchemaAST.TemplateLiteral, TemplateLiteral<Parts>>
{
    readonly parts: Parts;
}

/**
 * Supports template literal parts during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function templateLiteralParts(parts: TemplateLiteral.Parts)
{
    return parts.map((part) => isSchema(part) ? part.ast : new SchemaAST.Literal(part as TemplateLiteral.LiteralPart));
}

/**
 * Creates a schema that validates strings by matching ordered template literal
 * parts.
 *
 * @category constructors
 * @since 1.0.0
 */
export function TemplateLiteral<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteral<Parts>
{
    return make(new SchemaAST.TemplateLiteral(templateLiteralParts(parts)), { parts });
}

/**
 * Namespace for {@link TemplateLiteralParser} helper types.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace TemplateLiteralParser
{
    /**
     * Computes the decoded tuple type produced by `TemplateLiteralParser`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<Parts> = Parts extends readonly [
        infer Head,
        ...infer Tail
    ] ? readonly [
            Head extends TemplateLiteral.LiteralPart ? Head : Head extends ConstraintDecoder<infer T, never> ? T : never,
            ...Type<Tail>
        ] : [
        ];
}

/**
 * Type-level representation returned by {@link TemplateLiteralParser}.
 *
 * @category models
 * @since 1.0.0
 */
export interface TemplateLiteralParser<Parts extends TemplateLiteral.Parts> extends BottomLazy<SchemaAST.Arrays, TemplateLiteralParser<Parts>>
{
    readonly "Type": TemplateLiteralParser.Type<Parts>;
    readonly "Encoded": TemplateLiteral.Encoded<Parts>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": TemplateLiteralParser.Type<Parts>;
    readonly "~type.make": TemplateLiteralParser.Type<Parts>;
    readonly "Iso": TemplateLiteralParser.Type<Parts>;
    readonly parts: Parts;
}

/**
 * Schema for parsing matched template literal strings into typed tuple parts.
 *
 * @category constructors
 * @since 1.0.0
 */
export function TemplateLiteralParser<const Parts extends TemplateLiteral.Parts>(parts: Parts): TemplateLiteralParser<Parts>
{
    return make(SchemaAST.templateLiteralParser(templateLiteralParts(parts)), { parts });
}

/**
 * Type-level representation returned by {@link Enum}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Enum<A extends
{
    [x: string]: string | number;
}> extends Bottom<A[keyof A], A[keyof A], never, never, SchemaAST.Enum, Enum<A>> {
    readonly enums: A;
}

/**
 * Creates a schema from a TypeScript enum object. Validates that the input is one of the enum's values.
 * Numeric enum values must be finite.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Enum<A extends {
    [x: string]: string | number;
}>(enums: A): Enum<A>
{
    return make(new SchemaAST.Enum(Object.keys(enums).filter((key) => typeof enums[enums[key]] !== "number").map((key) => [ key, enums[key] ])), { enums });
}

/**
 * Type-level representation of {@link Never}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Never extends Bottom<never, never, never, never, SchemaAST.Never, Never>
{
}

/**
 * Schema for the `never` type. Always fails validation — no value satisfies it.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Never: Never = make(SchemaAST.never);

/**
 * Type-level representation of {@link Any}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Any extends Bottom<any, any, never, never, SchemaAST.Any, Any>
{
}

/**
 * Schema for the `any` type. Accepts any value without validation.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Any: Any = make(SchemaAST.any);

/**
 * Type-level representation of {@link Unknown}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Unknown extends Bottom<unknown, unknown, never, never, SchemaAST.Unknown, Unknown>
{
}

/**
 * Schema for the `unknown` type. Accepts any value without validation.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Unknown: Unknown = make(SchemaAST.unknown);

/**
 * Type-level representation of {@link Null}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Null extends Bottom<null, null, never, never, SchemaAST.Null, Null>
{
}

/**
 * Schema for the `null` literal. Validates that the input is strictly `null`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Null: Null = make(SchemaAST.null);

/**
 * Type-level representation of {@link Undefined}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Undefined extends Bottom<undefined, undefined, never, never, SchemaAST.Undefined, Undefined>
{
}

/**
 * Schema for the `undefined` literal. Validates that the input is strictly `undefined`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Undefined: Undefined = make(SchemaAST.undefined);

/**
 * Type-level representation of {@link String}.
 *
 * @category models
 * @since 1.0.0
 */
export interface String extends Bottom<string, string, never, never, SchemaAST.String, String>
{
}

/**
 * Schema for `string` values. Validates that the input is `typeof` `"string"`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const String: String = make(SchemaAST.string);

/**
 * Type-level representation of {@link StringForLiteralAutocomplete}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StringForLiteralAutocomplete extends Bottom<string & {}, string & {}, never, never, SchemaAST.String, StringForLiteralAutocomplete>
{
}

/**
 * Schema for `string & {}`. Validates that the input is `typeof` `"string"`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StringForLiteralAutocomplete: StringForLiteralAutocomplete = String;

/**
 * Type-level representation of {@link Number}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Number extends Bottom<number, number, never, never, SchemaAST.Number, Number>
{
}

/**
 * Schema for `number` values, including `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Number: Number = make(SchemaAST.number);

/**
 * Type-level representation of {@link Boolean}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Boolean extends Bottom<boolean, boolean, never, never, SchemaAST.Boolean, Boolean>
{
}

/**
 * Schema for `boolean` values. Validates that the input is `typeof` `"boolean"`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Boolean: Boolean = make(SchemaAST.boolean);

/**
 * Type-level representation of {@link Symbol}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Symbol extends Bottom<symbol, symbol, never, never, SchemaAST.Symbol, Symbol>
{
}

/**
 * Schema for `symbol` values. Validates that the input is `typeof` `"symbol"`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Symbol: Symbol = make(SchemaAST.symbol);

/**
 * Type-level representation of {@link BigInt}.
 *
 * @category models
 * @since 1.0.0
 */
export interface BigInt extends Bottom<bigint, bigint, never, never, SchemaAST.BigInt, BigInt>
{
}

/**
 * Schema for `bigint` values. Validates that the input is `typeof` `"bigint"`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const BigInt: BigInt = make(SchemaAST.bigInt);

/**
 * Type-level representation of {@link Void}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Void extends Bottom<void, void, never, never, SchemaAST.Void, Void>
{
}

/**
 * Schema for a TypeScript `void` return value.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Void: Void = make(SchemaAST.void);

/**
 * Type-level representation of {@link ObjectKeyword}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ObjectKeyword extends Bottom<object, object, never, never, SchemaAST.ObjectKeyword, ObjectKeyword>
{
}

/**
 * Schema for the `object` type. Validates that the input is a non-null object or function
 * (i.e. `typeof value === "object" && value !== null || typeof value === "function"`).
 *
 * @category schemas
 * @since 1.0.0
 */
export const ObjectKeyword: ObjectKeyword = make(SchemaAST.objectKeyword);

/**
 * Type-level representation returned by {@link UniqueSymbol}.
 *
 * @category models
 * @since 1.0.0
 */
export interface UniqueSymbol<sym extends symbol> extends Bottom<sym, sym, never, never, SchemaAST.UniqueSymbol, UniqueSymbol<sym>>
{
}

/**
 * Creates a schema for a specific symbol. Only that exact symbol satisfies the schema.
 *
 * @category constructors
 * @since 1.0.0
 */
export function UniqueSymbol<const sym extends symbol>(symbol: sym): UniqueSymbol<sym>
{
    return make(new SchemaAST.UniqueSymbol(symbol));
}

/**
 * Namespace for struct field type utilities.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Struct
{
    /**
     * Constraint for a struct field map: an object whose values are schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Fields = {
        readonly [x: PropertyKey]: Constraint;
    };
    type TypeOptionalKeys<Fields extends Struct.Fields> = {
        [K in keyof Fields]: Fields[K] extends {
            readonly "~type.optionality": "optional";
        } ? K : never;
    }[keyof Fields];
    type TypeMutableKeys<Fields extends Struct.Fields> = {
        [K in keyof Fields]: Fields[K] extends {
            readonly "~type.mutability": "mutable";
        } ? K : never;
    }[keyof Fields];
    type SetOptional<A, K extends keyof A> = Omit<A, K> & Partial<Pick<A, K>>;
    type Mutable<A> = {
        -readonly [K in keyof A]: A[K];
    };
    type SetMutable<A, K extends keyof A> = Omit<A, K> & Mutable<Pick<A, K>>;
    type Side = "Type" | "Iso" | "Encoded";
    type EncodedOptionalKeys<Fields extends Struct.Fields> = {
        [K in keyof Fields]: Fields[K] extends {
            readonly "~encoded.optionality": "optional";
        } ? K : never;
    }[keyof Fields];
    type EncodedMutableKeys<Fields extends Struct.Fields> = {
        [K in keyof Fields]: Fields[K] extends {
            readonly "~encoded.mutability": "mutable";
        } ? K : never;
    }[keyof Fields];
    type SideOptionalKeys<F extends Fields, S extends Side> = S extends "Encoded" ? EncodedOptionalKeys<F> : TypeOptionalKeys<F>;
    type SideMutableKeys<F extends Fields, S extends Side> = S extends "Encoded" ? EncodedMutableKeys<F> : TypeMutableKeys<F>;
    type ReadonlySide<F extends Fields, S extends Side> = {
        readonly [K in keyof F]: F[K][S];
    };
    type View<F extends Fields, S extends Side, O extends keyof F = SideOptionalKeys<F, S>, M extends keyof F = SideMutableKeys<F, S>> = [
        O | M
    ] extends [
        never
    ] ? Simplify<ReadonlySide<F, S>> : [
            M
        ] extends [
            never
        ] ? Simplify<SetOptional<ReadonlySide<F, S>, O>> : [
                O
            ] extends [
                never
            ] ? Simplify<SetMutable<ReadonlySide<F, S>, M>> : Simplify<SetMutable<SetOptional<ReadonlySide<F, S>, O>, Extract<keyof SetOptional<ReadonlySide<F, S>, O>, M>>>;

    /**
     * Computes the decoded object type for a struct field map.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<F extends Fields> = View<F, "Type">;

    /**
     * Computes the iso object type for a struct field map from each field schema's
     * `Iso` type.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Iso<F extends Fields> = View<F, "Iso">;

    /**
     * Computes the encoded object type for a struct field map.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<F extends Fields> = View<F, "Encoded">;

    /**
     * Union of all decoding service requirements needed by the schemas in a struct
     * field map.
     *
     * @category utility types
     * @since 1.0.0
     */
    type DecodingServices<F extends Fields> = {
        readonly [K in keyof F]: F[K]["DecodingServices"];
    }[keyof F];

    /**
     * Union of all encoding service requirements needed by the schemas in a struct
     * field map.
     *
     * @category utility types
     * @since 1.0.0
     */
    type EncodingServices<F extends Fields> = {
        readonly [K in keyof F]: F[K]["EncodingServices"];
    }[keyof F];
    type TypeConstructorDefaultedKeys<Fields extends Struct.Fields> = {
        [K in keyof Fields]: Fields[K] extends {
            readonly "~type.constructor.default": "with-default";
        } ? K : never;
    }[keyof Fields];
    type ReadonlyMakeIn<F extends Fields> = {
        readonly [K in keyof F]: F[K]["~type.make"];
    };
    type MakeInView<F extends Fields, O extends keyof F = TypeOptionalKeys<F> | TypeConstructorDefaultedKeys<F>> = [
        O
    ] extends [
        never
    ] ? Simplify<ReadonlyMakeIn<F>> : Simplify<SetOptional<ReadonlyMakeIn<F>, O>>;

    /**
     * Computes the input object type accepted when constructing a struct value.
     *
     * @category utility types
     * @since 1.0.0
     */
    type MakeIn<F extends Fields> = MakeInView<F>;
}

/**
 * Type-level representation returned by {@link Struct}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Struct<Fields extends Struct.Fields> extends BottomLazy<SchemaAST.Objects, Struct<Fields>>
{
    readonly "Type": Struct.Type<Fields>;
    readonly "Encoded": Struct.Encoded<Fields>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": Struct.MakeIn<Fields>;
    readonly "~type.make": Struct.MakeIn<Fields>;
    readonly "Iso": Struct.Iso<Fields>;

    /**
     * The field definitions of this struct. Spread them into a new struct to
     * reuse fields across schemas.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly fields: Fields;

    /**
     * Returns a new struct with the fields modified by the provided function.
     *
     * @category Utilities
     * @since 1.0.0
     */
    mapFields<To extends Struct.Fields>(f: (fields: Fields) => To, options?: {
        readonly unsafePreserveChecks?: boolean | undefined;
    } | undefined): Struct<Simplify<Readonly<To>>>;
}

/**
 * Supports make struct during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeStruct<const Fields extends Struct.Fields>(ast: SchemaAST.Objects, fields: Fields): Struct<Fields>
{
    return make(ast, {
        fields,
        mapFields<To extends Struct.Fields>(this: Struct<Fields>, f: (fields: Fields) => To, options?: {
            readonly unsafePreserveChecks?: boolean | undefined;
        } | undefined): Struct<To>
        {
            const fields = f(this.fields);
            return makeStruct(SchemaAST.struct(fields, options?.unsafePreserveChecks ? this.ast.checks : undefined), fields);
        }
    });
}

/**
 * Defines a struct schema from a map of field schemas.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Struct<const Fields extends Struct.Fields>(fields: Fields): Struct<Fields>
{
    return makeStruct(SchemaAST.struct(fields, undefined), fields);
}

interface fieldsAssign<NewFields extends Struct.Fields> extends Lambda
{
    <Fields extends Struct.Fields>(struct: Struct<Fields>): Struct<Struct_.Simplify<Struct_.Assign<Fields, NewFields>>>;
    readonly "~lambda.out": this["~lambda.in"] extends Struct<Struct.Fields> ? Struct<Struct_.Simplify<Struct_.Assign<this["~lambda.in"]["fields"], NewFields>>> : "Error: schema not eligible for fieldsAssign";
}

/**
 * Adds fields to a struct schema through a struct-mapping lambda.
 *
 * @category combinators
 * @since 1.0.0
 */
export function fieldsAssign<const NewFields extends Struct.Fields>(fields: NewFields)
{
    return Struct_.lambda<fieldsAssign<NewFields>>((struct) => struct.mapFields(Struct_.assign(fields)));
}

/**
 * Type-level representation returned by {@link encodeKeys}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface encodeKeys<S extends Constraint &
{
    readonly fields: Struct.Fields;
}, M extends {
    readonly [K in keyof S["fields"]]?: PropertyKey;
}> extends decodeTo<S, Struct<{
        [K in keyof S["fields"] as K extends keyof M ? M[K] extends PropertyKey ? M[K] : K : K]: toEncoded<S["fields"][K]>;
    }>> {
}

const canonicalPropertyKey = (key: PropertyKey): string | symbol => typeof key === "symbol" ? key : globalThis.String(key);

/**
 * Renames struct keys in the encoded form without changing the decoded type.
 *
 * @category transforming
 * @since 1.0.0
 */
export function encodeKeys<S extends Constraint & {
    readonly fields: Struct.Fields;
}, const M extends {
    readonly [K in keyof S["fields"]]?: PropertyKey;
}>(mapping: M)
{
    return function (self: S): encodeKeys<S, M>
    {
        const fields: any = {};
        const appliedMapping: any = Object.create(null);
        const reverseMapping: any = Object.create(null);
        const seenEncodedKeys = new Set<string | symbol>();
        for (const k of Reflect.ownKeys(self.fields))
        {
            const encoded = toEncoded(self.fields[k]);
            const hasMapping = Object.hasOwn(mapping, k);
            const encodedKey = hasMapping ? (mapping as any)[k] as PropertyKey : k;
            const canonical = canonicalPropertyKey(encodedKey);
            if (seenEncodedKeys.has(canonical))
            {
                throw new globalThis.Error(`Duplicate encoded keys: ${formatPropertyKey(encodedKey)}`);
            }

            seenEncodedKeys.add(canonical);
            InternalRecord.assignProperty(fields, encodedKey, encoded);
            if (hasMapping)
            {
                appliedMapping[k] = encodedKey;
                reverseMapping[encodedKey] = k;
            }
        }

        return Struct(fields).pipe(decodeTo(self, SchemaTransformation.transform<any, any>({
            decode: Struct_.renameKeys(reverseMapping),
            encode: Struct_.renameKeys(appliedMapping)
        }))) as any;
    };
}

/**
 * Adds derived fields to a struct schema during decoding.
 *
 * @category transforming
 * @since 1.0.0
 */
export function extendTo<S extends Struct<Struct.Fields>, const Fields extends Struct.Fields>(fields: Fields, derive: {
    readonly [K in keyof Fields]: (s: S["Type"]) => Option_.Option<Fields[K]["Type"]>;
})
{
    return (self: S): decodeTo<Struct<Simplify<{
        [K in keyof S["fields"]]: toType<S["fields"][K]>;
    } & Fields>>, S> =>
    {
        const f = Record_.map(self.fields, toType);
        const to = Struct({ ...f,
            ...fields });
        return self.pipe(decodeTo(to, SchemaTransformation.transform({
            decode: (input) =>
            {
                const out: any = { ...input };
                for (const k in fields)
                {
                    const f = derive[k];
                    const o = f(input);
                    if (Option_.isSome(o))
                    {
                        InternalRecord.assignProperty(out, k, o.value);
                    }
                }

                return out;
            },
            encode: (input) =>
            {
                const out = { ...input };
                for (const k in fields)
                {
                    delete out[k];
                }

                return out;
            }
        }))) as any;
    };
}

/**
 * Namespace for `Record` type utilities.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Record
{
    /**
     * Constraint for schemas that can be used as record keys.
     *
     * @category utility types
     * @since 1.0.0
     */
    interface Key extends Codec<PropertyKey, PropertyKey, never, never>
    {
        readonly "~type.make": PropertyKey;
        readonly "Iso": PropertyKey;
    }

    /**
     * Computes the decoded object type for a record schema from its key and value
     * schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<Key extends Record.Key, Value extends Constraint> = Value extends {
        readonly "~type.optionality": "optional";
    } ? Value extends {
            readonly "~type.mutability": "mutable";
        } ? {
                [P in Key["Type"]]?: Value["Type"];
            } : {
                readonly [P in Key["Type"]]?: Value["Type"];
            } : Value extends {
            readonly "~type.mutability": "mutable";
        } ? {
                [P in Key["Type"]]: Value["Type"];
            } : {
                readonly [P in Key["Type"]]: Value["Type"];
            };

    /**
     * Computes the iso object type for a record schema from the key schema's `Iso`
     * keys and the value schema's `Iso` values.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Iso<Key extends Record.Key, Value extends Constraint> = Value extends {
        readonly "~type.optionality": "optional";
    } ? Value extends {
            readonly "~type.mutability": "mutable";
        } ? {
                [P in Key["Iso"]]?: Value["Iso"];
            } : {
                readonly [P in Key["Iso"]]?: Value["Iso"];
            } : Value extends {
            readonly "~type.mutability": "mutable";
        } ? {
                [P in Key["Iso"]]: Value["Iso"];
            } : {
                readonly [P in Key["Iso"]]: Value["Iso"];
            };

    /**
     * Computes the encoded object type for a record schema from the key and value
     * schemas' encoded types.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<Key extends Record.Key, Value extends Constraint> = Value extends {
        readonly "~encoded.optionality": "optional";
    } ? Value extends {
            readonly "~encoded.mutability": "mutable";
        } ? {
                [P in Key["Encoded"]]?: Value["Encoded"];
            } : {
                readonly [P in Key["Encoded"]]?: Value["Encoded"];
            } : Value extends {
            readonly "~encoded.mutability": "mutable";
        } ? {
                [P in Key["Encoded"]]: Value["Encoded"];
            } : {
                readonly [P in Key["Encoded"]]: Value["Encoded"];
            };

    /**
     * Union of the decoding service requirements of a record's key schema and value
     * schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type DecodingServices<Key extends Record.Key, Value extends Constraint> = Key["DecodingServices"] | Value["DecodingServices"];

    /**
     * Union of the encoding service requirements of a record's key schema and value
     * schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type EncodingServices<Key extends Record.Key, Value extends Constraint> = Key["EncodingServices"] | Value["EncodingServices"];

    /**
     * Computes the input object type accepted when constructing a record value.
     *
     * @category utility types
     * @since 1.0.0
     */
    type MakeIn<Key extends Record.Key, Value extends Constraint> = Value extends {
        readonly "~encoded.optionality": "optional";
    } ? Value extends {
            readonly "~encoded.mutability": "mutable";
        } ? {
                [P in Key["~type.make"]]?: Value["~type.make"];
            } : {
                readonly [P in Key["~type.make"]]?: Value["~type.make"];
            } : Value extends {
            readonly "~encoded.mutability": "mutable";
        } ? {
                [P in Key["~type.make"]]: Value["~type.make"];
            } : {
                readonly [P in Key["~type.make"]]: Value["~type.make"];
            };
}

/**
 * Type-level representation returned by {@link Record}.
 *
 * @category models
 * @since 1.0.0
 */
export interface $Record<Key extends Record.Key, Value extends Constraint> extends BottomLazy<SchemaAST.Objects, $Record<Key, Value>>
{
    readonly "Type": Record.Type<Key, Value>;
    readonly "Encoded": Record.Encoded<Key, Value>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": Simplify<Record.MakeIn<Key, Value>>;
    readonly "~type.make": Simplify<Record.MakeIn<Key, Value>>;
    readonly "Iso": Record.Iso<Key, Value>;
    readonly key: Key;
    readonly value: Value;
}

/**
 * Defines a record schema whose dynamic properties are selected by a key schema
 * and decoded with a value schema.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Record<Key extends Record.Key, Value extends Constraint>(key: Key, value: Value): $Record<Key, Value>
{
    return make(SchemaAST.record(key.ast, value.ast), { key,
        value });
}

/**
 * Namespace for `StructWithRest` type utilities.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace StructWithRest
{
    /**
     * Constraint for object-like schemas that can be used as the fixed portion of a
     * `StructWithRest` schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Objects = Constraint & {
        readonly ast: SchemaAST.Objects;
        readonly Encoded: object;
    };

    /**
     * Readonly list of record schemas that provide the additional index signatures
     * for a `StructWithRest` schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Records = ReadonlyArray<$Record<Record.Key, Constraint>>;
    type MergeTuple<T extends ReadonlyArray<unknown>> = T extends readonly [
        infer Head,
        ...infer Tail
    ] ? Head & MergeTuple<Tail> : {};
    type Intersect<S extends Objects, Records extends StructWithRest.Records, Side extends "Type" | "Iso" | "Encoded" | "~type.make"> = S[Side] & MergeTuple<{
        readonly [K in keyof Records]: Records[K][Side];
    }>;

    /**
     * Computes the decoded type for `StructWithRest` by intersecting the base object
     * schema's decoded `Type` with the decoded types of all rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<S extends Objects, Records extends StructWithRest.Records> = Intersect<S, Records, "Type">;

    /**
     * Computes the iso type for `StructWithRest` by intersecting the base object
     * schema's `Iso` type with the `Iso` types of all rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Iso<S extends Objects, Records extends StructWithRest.Records> = Intersect<S, Records, "Iso">;

    /**
     * Computes the encoded type for `StructWithRest` by intersecting the base object
     * schema's encoded type with the encoded types of all rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<S extends Objects, Records extends StructWithRest.Records> = Intersect<S, Records, "Encoded">;

    /**
     * Computes the input type accepted when constructing a `StructWithRest` value by
     * intersecting the base object's make input with the make inputs of all rest
     * record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type MakeIn<S extends Objects, Records extends StructWithRest.Records> = Intersect<S, Records, "~type.make">;
    type Services<S extends Objects, Records extends StructWithRest.Records, Side extends "DecodingServices" | "EncodingServices"> = S[Side] | {
        [K in keyof Records]: Records[K][Side];
    }[number];

    /**
     * Union of the decoding service requirements of the base object schema and all
     * rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type DecodingServices<S extends Objects, Records extends StructWithRest.Records> = Services<S, Records, "DecodingServices">;

    /**
     * Union of the encoding service requirements of the base object schema and all
     * rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type EncodingServices<S extends Objects, Records extends StructWithRest.Records> = Services<S, Records, "EncodingServices">;
    type IncompatibleKeys<A, B, OK extends (keyof A & keyof B) = Extract<keyof A, keyof B>> = {
        [K in OK]: Required<Pick<A, K>>[K] extends B[K] ? never : K;
    }[OK];
    type IncompatibleSideKeys<S extends Objects, Records extends StructWithRest.Records, Side extends "Type" | "Encoded" | "Iso" | "~type.make"> = {
        [I in keyof Records]: Records[I][Side] extends object ? IncompatibleKeys<S[Side], Records[I][Side]> : never;
    }[number];
    type IncompatibleRecords<S extends Objects, Records extends StructWithRest.Records> = IncompatibleSideKeys<S, Records, "Type"> | IncompatibleSideKeys<S, Records, "Encoded"> | IncompatibleSideKeys<S, Records, "Iso"> | IncompatibleSideKeys<S, Records, "~type.make">;

    /**
     * Checks whether fixed fields are compatible with the rest record schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type ValidateRecords<S extends Objects, Records extends StructWithRest.Records> = [
        IncompatibleRecords<S, Records>
    ] extends [
        never
    ] ? true : {
            "incompatible index signatures": IncompatibleRecords<S, Records>;
        };
}

/**
 * Type-level representation returned by {@link StructWithRest}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StructWithRest<S extends StructWithRest.Objects, Records extends StructWithRest.Records> extends BottomLazy<SchemaAST.Objects, StructWithRest<S, Records>>
{
    readonly "Type": Simplify<StructWithRest.Type<S, Records>>;
    readonly "Encoded": Simplify<StructWithRest.Encoded<S, Records>>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": Simplify<StructWithRest.MakeIn<S, Records>>;
    readonly "~type.make": Simplify<StructWithRest.MakeIn<S, Records>>;
    readonly "Iso": Simplify<StructWithRest.Iso<S, Records>>;
    readonly schema: S;
    readonly records: Records;
}

/**
 * Extends a struct schema with one or more record (index-signature) schemas,
 * producing a schema whose decoded type intersects the struct and all records.
 *
 * @category constructors
 * @since 1.0.0
 */
export function StructWithRest<const S extends StructWithRest.Objects, const Records extends StructWithRest.Records>(schema: S, records: Records): StructWithRest<S, Records>
{
    return make(SchemaAST.structWithRest(schema.ast, records.map(SchemaAST.getAST)), { schema,
        records });
}

/**
 * Namespace for `Tuple` type utilities.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace Tuple
{
    /**
     * Constraint for the readonly array of element schemas used to define a
     * fixed-length `Tuple` schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Elements = ReadonlyArray<Constraint>;
    type Type_<Elements, Out extends ReadonlyArray<any> = readonly [
    ]> = Elements extends readonly [
        infer Head,
        ...infer Tail
    ] ? Head extends {
            readonly "Type": infer T;
        } ? Head extends {
                readonly "~type.optionality": "optional";
            } ? Type_<Tail, readonly [
                    ...Out,
        T?
                ]> : Type_<Tail, readonly [
                    ...Out,
                    T
                ]> : Out : Out;

    /**
     * Computes the decoded tuple type for a tuple element schema array.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<E extends Elements> = Type_<E>;
    type Iso_<Elements, Out extends ReadonlyArray<any> = readonly [
    ]> = Elements extends readonly [
        infer Head,
        ...infer Tail
    ] ? Head extends {
            readonly "Iso": infer T;
        } ? Head extends {
                readonly "~type.optionality": "optional";
            } ? Iso_<Tail, readonly [
                    ...Out,
        T?
                ]> : Iso_<Tail, readonly [
                    ...Out,
                    T
                ]> : Out : Out;

    /**
     * Computes the iso tuple type for a tuple element schema array from each
     * element schema's `Iso` type.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Iso<E extends Elements> = Iso_<E>;
    type Encoded_<Elements, Out extends ReadonlyArray<any> = readonly [
    ]> = Elements extends readonly [
        infer Head,
        ...infer Tail
    ] ? Head extends {
            readonly "Encoded": infer T;
        } ? Head extends {
                readonly "~encoded.optionality": "optional";
            } ? Encoded_<Tail, readonly [
                    ...Out,
        T?
                ]> : Encoded_<Tail, readonly [
                    ...Out,
                    T
                ]> : Out : Out;

    /**
     * Computes the encoded tuple type for a tuple element schema array.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<E extends Elements> = Encoded_<E>;

    /**
     * Union of all decoding service requirements needed by the tuple element
     * schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type DecodingServices<E extends Elements> = E[number]["DecodingServices"];

    /**
     * Union of all encoding service requirements needed by the tuple element
     * schemas.
     *
     * @category utility types
     * @since 1.0.0
     */
    type EncodingServices<E extends Elements> = E[number]["EncodingServices"];
    type MakeIn_<E, Out extends ReadonlyArray<any> = readonly [
    ]> = E extends readonly [
        infer Head,
        ...infer Tail
    ] ? Head extends {
            "~type.make": infer T;
        } ? Head extends {
            readonly "~type.optionality": "optional";
        } | {
            readonly "~type.constructor.default": "with-default";
        } ? MakeIn_<Tail, readonly [
                    ...Out,
        T?
                ]> : MakeIn_<Tail, readonly [
                    ...Out,
                    T
                ]> : Out : Out;

    /**
     * Computes the input tuple type accepted when constructing a tuple value.
     *
     * @category utility types
     * @since 1.0.0
     */
    type MakeIn<E extends Elements> = MakeIn_<E>;
}

/**
 * Type-level representation returned by {@link Tuple}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Tuple<Elements extends Tuple.Elements> extends BottomLazy<SchemaAST.Arrays, Tuple<Elements>>
{
    readonly "Type": Tuple.Type<Elements>;
    readonly "Encoded": Tuple.Encoded<Elements>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": Tuple.MakeIn<Elements>;
    readonly "~type.make": Tuple.MakeIn<Elements>;
    readonly "Iso": Tuple.Iso<Elements>;
    readonly elements: Elements;

    /**
     * Returns a new tuple with the elements modified by the provided function.
     *
     * @category Utilities
     * @since 1.0.0
     */
    mapElements<To extends Tuple.Elements>(f: (elements: Elements) => To, options?: {
        readonly unsafePreserveChecks?: boolean | undefined;
    } | undefined): Tuple<Simplify<Readonly<To>>>;
}

/**
 * Supports make tuple during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeTuple<Elements extends Tuple.Elements>(ast: SchemaAST.Arrays, elements: Elements): Tuple<Elements>
{
    return make(ast, {
        elements,
        mapElements<To extends Tuple.Elements>(this: Tuple<Elements>, f: (elements: Elements) => To, options?: {
            readonly unsafePreserveChecks?: boolean | undefined;
        } | undefined): Tuple<Simplify<Readonly<To>>>
        {
            const elements = f(this.elements);
            return makeTuple(SchemaAST.tuple(elements, options?.unsafePreserveChecks ? this.ast.checks : undefined), elements);
        }
    });
}

/**
 * Defines a fixed-length tuple schema from an array of element schemas.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Tuple<const Elements extends ReadonlyArray<Constraint>>(elements: Elements): Tuple<Elements>
{
    return makeTuple(SchemaAST.tuple(elements), elements);
}

/**
 * Namespace for `TupleWithRest` type utilities.
 *
 * @category Utilities
 * @since 1.0.0
 */
export declare namespace TupleWithRest
{
    /**
     * Constraint for tuple-like schemas that can be used as the fixed leading
     * portion of a `TupleWithRest` schema.
     *
     * @category utility types
     * @since 1.0.0
     */
    type TupleType = Constraint & {
        readonly Type: ReadonlyArray<unknown>;
        readonly Encoded: ReadonlyArray<unknown>;
        readonly ast: SchemaAST.Arrays;
        readonly "~type.make": ReadonlyArray<unknown>;
        readonly "Iso": ReadonlyArray<unknown>;
    };

    /**
     * Non-empty list of schemas used for the rest portion of a `TupleWithRest`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Rest = readonly [
        Constraint,
        ...Array<Constraint>
    ];

    /**
     * Computes the decoded tuple type for a `TupleWithRest`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Type<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends readonly [
        infer Head extends Constraint,
        ...infer Tail extends ReadonlyArray<Constraint>
    ] ? Readonly<[
            ...T,
            ...Array<Head["Type"]>,
            ...{
                readonly [K in keyof Tail]: Tail[K]["Type"];
            }
        ]> : T;

    /**
     * Computes the iso tuple type for a `TupleWithRest`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Iso<T extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends readonly [
        infer Head extends Constraint,
        ...infer Tail extends ReadonlyArray<Constraint>
    ] ? Readonly<[
            ...T,
            ...Array<Head["Iso"]>,
            ...{
                readonly [K in keyof Tail]: Tail[K]["Iso"];
            }
        ]> : T;

    /**
     * Computes the encoded tuple type for `TupleWithRest`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type Encoded<E extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends readonly [
        infer Head extends Constraint,
        ...infer Tail extends ReadonlyArray<Constraint>
    ] ? readonly [
            ...E,
            ...Array<Head["Encoded"]>,
            ...{
                readonly [K in keyof Tail]: Tail[K]["Encoded"];
            }
        ] : E;

    /**
     * Computes the constructor input tuple type for `TupleWithRest`.
     *
     * @category utility types
     * @since 1.0.0
     */
    type MakeIn<M extends ReadonlyArray<unknown>, Rest extends TupleWithRest.Rest> = Rest extends readonly [
        infer Head extends Constraint,
        ...infer Tail extends ReadonlyArray<Constraint>
    ] ? readonly [
            ...M,
            ...Array<Head["~type.make"]>,
            ...{
                readonly [K in keyof Tail]: Tail[K]["~type.make"];
            }
        ] : M;
}

/**
 * Type-level representation returned by {@link TupleWithRest}.
 *
 * @category models
 * @since 1.0.0
 */
export interface TupleWithRest<S extends TupleWithRest.TupleType, Rest extends TupleWithRest.Rest> extends BottomLazy<SchemaAST.Arrays, TupleWithRest<S, Rest>>
{
    readonly "Type": TupleWithRest.Type<S["Type"], Rest>;
    readonly "Encoded": TupleWithRest.Encoded<S["Encoded"], Rest>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": TupleWithRest.MakeIn<S["~type.make"], Rest>;
    readonly "~type.make": TupleWithRest.MakeIn<S["~type.make"], Rest>;
    readonly "Iso": TupleWithRest.Iso<S["Iso"], Rest>;
    readonly schema: S;
    readonly rest: Rest;
}

/**
 * Extends a fixed-length tuple schema with a variadic rest segment.
 *
 * @category constructors
 * @since 1.0.0
 */
export function TupleWithRest<S extends Tuple<Tuple.Elements>, const Rest extends TupleWithRest.Rest>(schema: S, rest: Rest): TupleWithRest<S, Rest>
{
    return make(SchemaAST.tupleWithRest(schema.ast, rest.map(SchemaAST.getAST)), { schema,
        rest });
}

/**
 * Type-level representation returned by {@link Array}.
 *
 * @category models
 * @since 1.0.0
 */
export interface $Array<S extends Constraint> extends BottomLazy<SchemaAST.Arrays, $Array<S>>
{
    readonly "Type": ReadonlyArray<S["Type"]>;
    readonly "Encoded": ReadonlyArray<S["Encoded"]>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": ReadonlyArray<S["~type.make"]>;
    readonly "~type.make": ReadonlyArray<S["~type.make"]>;
    readonly "Iso": ReadonlyArray<S["Iso"]>;
    readonly value: S;
}

interface ArrayLambda extends Lambda
{
    <S extends Constraint>(self: S): $Array<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? $Array<this["~lambda.in"]> : never;
}

/**
 * Internal schema support.
 *
 * @category constructors
 * @since 1.0.0
 */
const ArraySchema: ArrayLambda = Struct_.lambda<ArrayLambda>((schema) => make(new SchemaAST.Arrays(false, [], [ schema.ast ]), { value: schema }));

export {
/**
 * Defines a `ReadonlyArray` schema for a given element schema.
 *
 * @category constructors
 * @since 1.0.0
 */
    ArraySchema as Array };

/**
 * Supports with array length constraints during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function withArrayLengthConstraints<Item extends Constraint>(self: $Array<Item>, minimum: number | undefined, maximum: number | undefined): $Array<Item>
{
    if (minimum !== undefined && maximum !== undefined)
    {
        return self.check(isBetweenLength(minimum, maximum));
    }

    if (minimum !== undefined)
    {return self.check(isMinLength(minimum));}

    if (maximum !== undefined)
    {return self.check(isMaxLength(maximum));}

    return self;
}

/**
 * Type-level representation returned by {@link NonEmptyArray}.
 *
 * @category models
 * @since 1.0.0
 */
export interface NonEmptyArray<S extends Constraint> extends BottomLazy<SchemaAST.Arrays, NonEmptyArray<S>>
{
    readonly "Type": readonly [
        S["Type"],
        ...Array<S["Type"]>
    ];
    readonly "Encoded": readonly [
        S["Encoded"],
        ...Array<S["Encoded"]>
    ];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": readonly [
        S["~type.make"],
        ...Array<S["~type.make"]>
    ];
    readonly "~type.make": readonly [
        S["~type.make"],
        ...Array<S["~type.make"]>
    ];
    readonly "Iso": readonly [
        S["Iso"],
        ...Array<S["Iso"]>
    ];
    readonly value: S;
}

interface NonEmptyArrayLambda extends Lambda
{
    <S extends Constraint>(self: S): NonEmptyArray<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? NonEmptyArray<this["~lambda.in"]> : never;
}

/**
 * Defines a non-empty `ReadonlyArray` schema — at least one element required.
 * Type is `readonly [T, ...T[]]`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const NonEmptyArray: NonEmptyArrayLambda = Struct_.lambda<NonEmptyArrayLambda>((schema) => make(new SchemaAST.Arrays(false, [ schema.ast ], [ schema.ast ]), { value: schema }));

/**
 * Type-level representation returned by {@link ArrayEnsure}.
 *
 * @category constructors
 * @since 1.0.0
 */
export interface ArrayEnsure<S extends Constraint> extends decodeTo<$Array<toType<S>>, Union<readonly [
    S,
    $Array<S>
]>>
{
    readonly "Rebuild": ArrayEnsure<S>;
}

/**
 * Creates a schema that accepts either a value decoded by `schema` or an array
 * decoded by `Schema.Array(schema)`, then returns an array.
 *
 * @category constructors
 * @since 1.0.0
 */
export function ArrayEnsure<S extends Constraint>(schema: S): ArrayEnsure<S>
{
    const many = ArraySchema(schema);
    const to = ArraySchema(toType(schema));
    const one = decodeTo(Tuple([ Unknown ]), SchemaTransformation.transform({
        decode: (value) => [ value ] as const,
        encode: ([ value ]) => value
    }))(schema);
    return make(Union([ one, many ]).pipe(decodeTo(to)).ast, { from: Union([ schema, many ]),
        to });
}

/**
 * Type-level representation returned by {@link UniqueArray}.
 *
 * @category models
 * @since 1.0.0
 */
export interface UniqueArray<S extends Constraint> extends $Array<S>
{
    readonly "Rebuild": UniqueArray<S>;
}

/**
 * Returns a new array schema that ensures all elements are unique.
 *
 * @category constructors
 * @since 1.0.0
 */
export function UniqueArray<S extends Constraint>(item: S): UniqueArray<S>
{
    return ArraySchema(item).check(isUnique());
}

/**
 * Type-level representation returned by {@link mutable}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface mutable<S extends Constraint &
{
    readonly "ast": SchemaAST.Arrays;
}> extends BottomLazy<S["ast"], mutable<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]> {
    readonly "Type": Mutable<S["Type"]>;
    readonly "Encoded": Mutable<S["Encoded"]>;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

interface mutableLambda extends Lambda
{
    <S extends Constraint & {
        readonly "ast": SchemaAST.Arrays;
    }>(self: S): mutable<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint & {
        readonly "ast": SchemaAST.Arrays;
    } ? mutable<this["~lambda.in"]> : "Error: schema not eligible for mutable";
}

/**
 * Makes an array or tuple schema mutable, removing the `readonly` modifier.
 *
 * @category transforming
 * @since 1.0.0
 */
export const mutable: mutableLambda = Struct_.lambda<mutableLambda>((schema) => make(SchemaAST.mutable(schema.ast), { schema }));

/**
 * Type-level representation returned by {@link Union}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Union<Members extends ReadonlyArray<Constraint>> extends BottomLazy<SchemaAST.Union<{
    [K in keyof Members]: Members[K]["ast"];
}[number]>, Union<Members>> {
    readonly "Type": {
        [K in keyof Members]: Members[K]["Type"];
    }[number];
    readonly "Encoded": {
        [K in keyof Members]: Members[K]["Encoded"];
    }[number];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": {
        [K in keyof Members]: Members[K]["~type.make"];
    }[number];
    readonly "~type.make": {
        [K in keyof Members]: Members[K]["~type.make"];
    }[number];
    readonly "Iso": {
        [K in keyof Members]: Members[K]["Iso"];
    }[number];
    readonly members: Members;

    /**
     * Returns a new union with the members modified by the provided function.
     *
     * @category Utilities
     * @since 1.0.0
     */
    mapMembers<To extends ReadonlyArray<Constraint>>(f: (members: Members) => To, options?: {
        readonly unsafePreserveChecks?: boolean | undefined;
    } | undefined): Union<Simplify<Readonly<To>>>;
}

/**
 * Supports make union during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeUnion<Members extends ReadonlyArray<Constraint>>(ast: SchemaAST.Union<Members[number]["ast"]>, members: Members): Union<Members>
{
    return make(ast, {
        members,
        mapMembers<To extends ReadonlyArray<Constraint>>(this: Union<Members>, f: (members: Members) => To, options?: {
            readonly unsafePreserveChecks?: boolean | undefined;
        } | undefined): Union<Simplify<Readonly<To>>>
        {
            const members = f(this.members);
            return makeUnion(SchemaAST.union(members, this.ast.options, options?.unsafePreserveChecks ? this.ast.checks : undefined), members);
        }
    });
}

/**
 * Creates a union schema from an array of member schemas. Members are tested in
 * order; the first match is returned.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Union<const Members extends ReadonlyArray<Constraint>>(members: Members, options?: SchemaAST.UnionOptions): Union<Members>
{
    return makeUnion(SchemaAST.union(members, options, undefined), members);
}

/**
 * Type-level representation returned by {@link Literals}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Literals<L extends ReadonlyArray<SchemaAST.LiteralValue>> extends Bottom<L[number], L[number], never, never, SchemaAST.Union<SchemaAST.Literal>, Literals<L>>
{
    readonly literals: L;
    readonly members: {
        readonly [K in keyof L]: Literal<L[K]>;
    };

    /**
     * Map over the members of the union.
     *
     * @category Utilities
     * @since 1.0.0
     */
    mapMembers<To extends ReadonlyArray<Constraint>>(f: (members: this["members"]) => To): Union<Simplify<Readonly<To>>>;
    pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2>;
    transform<const L2 extends {
        readonly [I in keyof L]: SchemaAST.LiteralValue;
    }>(to: L2): Union<{
        [I in keyof L]: decodeTo<Literal<L2[I]>, Literal<L[I]>>;
    }>;
}

/**
 * Creates a union schema from an array of literal values.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Literals<const L extends ReadonlyArray<SchemaAST.LiteralValue>>(literals: L): Literals<L>
{
    const members = literals.map(Literal) as {
        readonly [K in keyof L]: Literal<L[K]>;
    };
    return make(SchemaAST.union(members, undefined, undefined), {
        literals,
        members,
        mapMembers<To extends ReadonlyArray<Constraint>>(this: Literals<L>, f: (members: Literals<L>["members"]) => To): Union<Simplify<Readonly<To>>>
        {
            return Union(f(this.members));
        },
        pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): Literals<L2>
        {
            return Literals(literals);
        },
        transform<const L2 extends {
            readonly [I in keyof L]: SchemaAST.LiteralValue;
        }>(to: L2): Union<{
            [I in keyof L]: decodeTo<Literal<L2[I]>, Literal<L[I]>>;
        }>
        {
            return Union(members.map((member, index) => member.transform(to[index]))) as any;
        }
    });
}

/**
 * Type-level representation returned by {@link NullOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface NullOr<S extends Constraint> extends Union<readonly [
    S,
    Null
]>
{
    readonly "Rebuild": NullOr<S>;
}

interface NullOrLambda extends Lambda
{
    <S extends Constraint>(self: S): NullOr<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? NullOr<this["~lambda.in"]> : never;
}

/**
 * Creates a union schema of `S | null`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const NullOr: NullOrLambda = Struct_.lambda<NullOrLambda>((self) => Union([ self, Null ]));

/**
 * Type-level representation returned by {@link UndefinedOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface UndefinedOr<S extends Constraint> extends Union<readonly [
    S,
    Undefined
]>
{
    readonly "Rebuild": UndefinedOr<S>;
}

interface UndefinedOrLambda extends Lambda
{
    <S extends Constraint>(self: S): UndefinedOr<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? UndefinedOr<this["~lambda.in"]> : never;
}

/**
 * Creates a union schema of `S | undefined`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const UndefinedOr: UndefinedOrLambda = Struct_.lambda<UndefinedOrLambda>((self) => Union([ self, Undefined ]));

/**
 * Type-level representation returned by {@link NullishOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface NullishOr<S extends Constraint> extends Union<readonly [
    S,
    Null,
    Undefined
]>
{
    readonly "Rebuild": NullishOr<S>;
}

interface NullishOrLambda extends Lambda
{
    <S extends Constraint>(self: S): NullishOr<S>;
    readonly "~lambda.out": this["~lambda.in"] extends Constraint ? NullishOr<this["~lambda.in"]> : never;
}

/**
 * Creates a union schema of `S | null | undefined`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const NullishOr: NullishOrLambda = Struct_.lambda<NullishOrLambda>((self) => Union([ self, Null, Undefined ]));

/**
 * Type-level representation returned by {@link suspend}.
 *
 * @category models
 * @since 1.0.0
 */
export interface suspend<S extends Constraint> extends BottomLazy<SchemaAST.Suspend, suspend<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
}

/**
 * Creates a suspended schema that defers evaluation until needed. This is
 * essential for creating recursive schemas where a schema references itself,
 * preventing infinite recursion during schema definition.
 *
 * @category constructors
 * @since 1.0.0
 */
export function suspend<S extends Constraint>(f: () => S): suspend<S>
{
    return make(new SchemaAST.Suspend(() => f().ast));
}

/**
 * Attaches one or more filter checks to a schema without changing the
 * TypeScript type.
 *
 * @category filtering
 * @since 1.0.0
 */
export function check<S extends Top>(...checks: readonly [
    SchemaAST.Check<S["Type"]>,
    ...Array<SchemaAST.Check<S["Type"]>>
])
{
    return (self: S): S["Rebuild"] => self.check(...checks);
}

/**
 * Type-level representation returned by {@link refine}.
 *
 * @category filtering
 * @since 1.0.0
 */
export interface refine<T extends S["Type"], S extends Constraint> extends BottomLazy<S["ast"], refine<T, S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": T;
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": T;
    readonly "Iso": T;
    readonly schema: S;
}

/**
 * Narrows the TypeScript type of a schema's output via a type guard predicate,
 * attaching the guard as a runtime filter check.
 *
 * @category filtering
 * @since 1.0.0
 */
export function refine<S extends Constraint, T extends S["Type"]>(refinement: (value: S["Type"]) => value is T, annotations?: Annotations.Filter): (schema: S) => refine<T, S>
{
    return (schema: S): refine<T, S> => make(SchemaAST.appendChecks(schema.ast, [ SchemaAST.makeFilterByGuard(refinement, annotations) ]), { schema });
}

// A concrete key requires a property; broad and open template keys do not.
type EnsureSingleBrandKey<K extends PropertyKey> = IsUnion<K> extends false ? {} extends Record<K, unknown> ? never : unknown : never;

// Collect all keys, including those not shared by every union member.
type FromBrandKeys<A extends Brand.Brand<any>> = A extends unknown ? Brand.Brand.Keys<A> : never;

/**
 * Type-level representation returned by {@link brand}.
 *
 * @category branding
 * @since 1.0.0
 */
export interface brand<S extends Constraint, B extends string> extends BottomLazy<S["ast"], brand<S, B>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"] & Brand.Brand<B>;
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["Type"] & Brand.Brand<B>;
    readonly "Iso": S["Type"] & Brand.Brand<B>;
    readonly schema: S;
    readonly identifier: string;
}

/**
 * Intersects a schema's output type with `Brand.Brand<B>` to prevent accidental
 * mixing of structurally identical types.
 *
 * @category branding
 * @since 1.0.0
 */
export function brand<B extends string>(identifier: B & EnsureSingleBrandKey<B>)
{
    return <S extends ConstraintRebuildable>(schema: S): brand<S["Rebuild"], B> => make(schema.ast, { schema,
        identifier });
}

/**
 * Creates a branded schema from a {@link Brand.Constructor}, applying the
 * constructor's checks and branded type to the underlying schema.
 *
 * @category branding
 * @since 1.0.0
 */
export function fromBrand<A extends Brand.Brand<any>>(identifier: Brand.Brand.Keys<A> & string, ctor: Brand.Constructor<A> & EnsureSingleBrandKey<FromBrandKeys<A>>)
{
    type B = Brand.Brand.Keys<A> & string;
    return <S extends Top & {
        readonly "Type": Brand.Brand.Unbranded<A>;
    }>(self: S): brand<S["Rebuild"], B> =>
    // The constructor already guarantees a single concrete brand key.
        (ctor.checks ? self.check(...ctor.checks) : self).pipe(brand<B>(identifier as B & EnsureSingleBrandKey<B>));
}

/**
 * Type-level representation returned by {@link decodeTo}.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface decodeTo<To extends Constraint, From extends Constraint, RD extends never = never, RE extends never = never> extends BottomLazy<To["ast"], decodeTo<To, From, RD, RE>, To["~type.parameters"], To["~type.mutability"], To["~type.optionality"], To["~type.constructor.default"], From["~encoded.mutability"], From["~encoded.optionality"]>
{
    readonly "Type": To["Type"];
    readonly "Encoded": From["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": To["~type.make.in"];
    readonly "~type.make": To["~type.make"];
    readonly "Iso": To["Iso"];
    readonly from: From;
    readonly to: To;
}

/**
 * Type-level representation returned by {@link decodeTo} without a custom transformation.
 *
 * @category transforming
 * @since 1.0.0
 */
export interface compose<To extends Constraint, From extends Constraint> extends decodeTo<To, From>
{
}

/**
 * Creates a schema that transforms from a source schema to a target schema.
 *
 * @category transforming
 * @since 1.0.0
 */
export function decodeTo<To extends Constraint>(to: To): <From extends Constraint>(from: From) => compose<To, From>;

export function decodeTo<To extends Constraint, From extends Constraint, RD extends never = never, RE extends never = never>(to: To, transformation: {
    readonly decode: SchemaGetter.Getter<NoInfer<To["Encoded"]>, NoInfer<From["Type"]>, RD>;
    readonly encode: SchemaGetter.Getter<NoInfer<From["Type"]>, NoInfer<To["Encoded"]>, RE>;
}): (from: From) => decodeTo<To, From, RD, RE>;

export function decodeTo<To extends Constraint, From extends Constraint, RD extends never = never, RE extends never = never>(to: To, transformation?: {
    readonly decode: SchemaGetter.Getter<To["Encoded"], From["Type"], RD>;
    readonly encode: SchemaGetter.Getter<From["Type"], To["Encoded"], RE>;
} | undefined)
{
    return (from: From) =>
    {
        return make(SchemaAST.decodeTo(from.ast, to.ast, transformation ? SchemaTransformation.makeTransformation(transformation) : SchemaTransformation.passthrough()), {
            from,
            to
        });
    };
}

/**
 * Constructs a decode-only `SchemaAST.Link`.
 *
 * @category Utilities
 * @since 1.0.0
 */
export function linkDecoding<T>(): <To extends Constraint>(to: To, decode: SchemaGetter.Getter<T, NoInfer<To["Type"]>>) => SchemaAST.Link
{
    return <To extends Constraint>(to: To, decode: SchemaGetter.Getter<T, NoInfer<To["Type"]>>): SchemaAST.Link => link<T>()(to, { decode,
        encode: SchemaGetter.forbiddenEncoding });
}

/**
 * Supports true literals during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TrueLiterals = Literals([ "true", "yes", "on", "1", "y" ]);

/**
 * Supports false literals during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const FalseLiterals = Literals([ "false", "no", "off", "0", "n" ]);

/**
 * Supports boolean literals during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const BooleanLiterals = Literals([ ...TrueLiterals.literals, ...FalseLiterals.literals ]).pipe(decodeTo(Boolean, SchemaTransformation.transform({
    decode: (value) => value === "true" || value === "yes" || value === "on" || value === "1" || value === "y",
    encode: (value) => value ? "true" : "false"
})));

/**
 * Applies a transformation to a schema, creating a new schema with the same type but transformed encoding/decoding.
 *
 * @category transforming
 * @since 1.0.0
 */
export function decode<S extends Constraint, RD extends never = never, RE extends never = never>(transformation: {
    readonly decode: SchemaGetter.Getter<S["Type"], S["Type"], RD>;
    readonly encode: SchemaGetter.Getter<S["Type"], S["Type"], RE>;
})
{
    return (self: S): decodeTo<toType<S>, S, RD, RE> =>
    {
        return decodeTo<toType<S>, S, RD, RE>(toType(self), transformation)(self);
    };
}

/**
 * Reverses a schema transformation so the encoded schema is supplied first.
 *
 * @category transforming
 * @since 1.0.0
 */
export function encodeTo<To extends Constraint>(to: To): <From extends Constraint>(from: From) => compose<From, To>;

export function encodeTo<To extends Constraint, From extends Constraint, RD extends never = never, RE extends never = never>(to: To, transformation: {
    readonly decode: SchemaGetter.Getter<NoInfer<From["Encoded"]>, NoInfer<To["Type"]>, RD>;
    readonly encode: SchemaGetter.Getter<NoInfer<To["Type"]>, NoInfer<From["Encoded"]>, RE>;
}): (from: From) => decodeTo<From, To, RD, RE>;

export function encodeTo<To extends Constraint, From extends Constraint, RD extends never = never, RE extends never = never>(to: To, transformation?: {
    readonly decode: SchemaGetter.Getter<From["Encoded"], To["Type"], RD>;
    readonly encode: SchemaGetter.Getter<To["Type"], From["Encoded"], RE>;
})
{
    return (from: From): decodeTo<From, To, RD, RE> =>
    {
        return transformation ?
            decodeTo<From, To, RD, RE>(from, transformation)(to) :
            decodeTo<From>(from)(to);
    };
}

/**
 * Applies a transformation to a schema's encoded type, creating a new schema where encoding/decoding
 * operate on `S["Encoded"]` rather than `S["Type"]`.
 *
 * @category transforming
 * @since 1.0.0
 */
export function encode<S extends Constraint, RD extends never = never, RE extends never = never>(transformation: {
    readonly decode: SchemaGetter.Getter<S["Encoded"], S["Encoded"], RD>;
    readonly encode: SchemaGetter.Getter<S["Encoded"], S["Encoded"], RE>;
})
{
    return (self: S): decodeTo<S, toEncoded<S>, RD, RE> =>
    {
        return decodeTo<S, toEncoded<S>, RD, RE>(self, transformation)(toEncoded(self));
    };
}

/**
 * Constraint used to ensure a schema field does not already have a constructor default.
 *
 * @category models
 * @since 1.0.0
 */
export interface WithoutConstructorDefault
{
    readonly "~type.constructor.default": "no-default";
}

/**
 * Type-level representation returned by {@link withConstructorDefault}.
 *
 * @category constructors
 * @since 1.0.0
 */
export interface withConstructorDefault<S extends Constraint & WithoutConstructorDefault> extends BottomLazy<S["ast"], withConstructorDefault<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], "with-default", S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

/**
 * Attaches a constructor default value to a schema field.
 *
 * @category constructors
 * @since 1.0.0
 */
export function withConstructorDefault<S extends Constraint & WithoutConstructorDefault>(
// `S["~type.make.in"]` instead of `S["Type"]` is intentional here because
// it makes easier to define the default value if there are nested defaults
    defaultValue: () => RResult.Result<S["~type.make.in"], SchemaIssue.Issue>)
{
    return (schema: S): withConstructorDefault<S> => make(SchemaAST.withConstructorDefault(schema.ast, defaultValue), { schema });
}

/**
 * Type-level representation returned by {@link withDecodingDefaultKey}.
 *
 * @category decoding
 * @since 1.0.0
 */
export interface withDecodingDefaultKey<S extends Constraint, R extends never = never> extends decodeTo<S, optionalKey<toEncoded<S>>, R>
{
    readonly "Rebuild": withDecodingDefaultKey<S, R>;
}

/**
 * Options for {@link withDecodingDefaultKey} and {@link withDecodingDefault}.
 *
 * @category options
 * @since 1.0.0
 */
export type DecodingDefaultOptions = {
    readonly encodingStrategy?: "omit" | "passthrough" | undefined;
};

/**
 * Supports to issue result during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function toIssueResult<A>(self: () => RResult.Result<A, SchemaError>): () => RResult.Result<A, SchemaIssue.Issue> { return () => RResult.mapError(InternalParser.checked(self()), (error) => error.issue); }

/**
 * Makes a struct key optional on the `Encoded` side and provides a default
 * `Encoded` value when the key is missing during decoding.
 *
 * @category decoding
 * @since 1.0.0
 */
export function withDecodingDefaultKey<S extends Constraint, R extends never = never>(defaultValue: () => RResult.Result<S["Encoded"], SchemaError>, options?: DecodingDefaultOptions): (self: S) => withDecodingDefaultKey<S, R>
{
    const encode = options?.encodingStrategy === "omit" ? SchemaGetter.omit() : SchemaGetter.passthrough();
    return (self: S): withDecodingDefaultKey<S, R> =>
    {
        return optionalKey(toEncoded(self)).pipe(decodeTo(self, {
            decode: SchemaGetter.withDefault(toIssueResult(defaultValue)),
            encode
        }));
    };
}

/**
 * Type-level representation returned by {@link withDecodingDefaultTypeKey}.
 *
 * @category decoding
 * @since 1.0.0
 */
export interface withDecodingDefaultTypeKey<S extends Constraint, R extends never = never> extends decodeTo<withDecodingDefaultKey<toType<S>, R>, optionalKey<S>>
{
    readonly "Rebuild": withDecodingDefaultTypeKey<S, R>;
}

/**
 * Makes a struct key optional on the `Encoded` side (`optionalKey`, so the
 * key may be absent but **not** `undefined`) and provides a default `Type`
 * value when the key is missing during decoding.
 *
 * @category decoding
 * @since 1.0.0
 */
export function withDecodingDefaultTypeKey<S extends Constraint, R extends never = never>(defaultValue: () => RResult.Result<S["Type"], SchemaError>, options?: DecodingDefaultOptions): (self: S) => withDecodingDefaultTypeKey<S, R>
{
    return (self: S): withDecodingDefaultTypeKey<S, R> =>
    {
        return toType(self).pipe(withDecodingDefaultKey<toType<S>, R>(defaultValue, options), encodeTo(optionalKey(self)));
    };
}

/**
 * Type-level representation returned by {@link withDecodingDefault}.
 *
 * @category decoding
 * @since 1.0.0
 */
export interface withDecodingDefault<S extends Constraint, R extends never = never> extends decodeTo<S, optional<toEncoded<S>>, R>
{
    readonly "Rebuild": withDecodingDefault<S, R>;
}

/**
 * Wraps the `Encoded` side with `optional` (key absent **or** `undefined`)
 * and provides a default `Encoded` value when the field is missing or
 * `undefined` during decoding.
 *
 * @category decoding
 * @since 1.0.0
 */
export function withDecodingDefault<S extends Constraint, R extends never = never>(defaultValue: () => RResult.Result<S["Encoded"], SchemaError>, options?: DecodingDefaultOptions): (self: S) => withDecodingDefault<S, R>
{
    const encode = options?.encodingStrategy === "omit" ? SchemaGetter.omit() : SchemaGetter.passthrough();
    return (self: S): withDecodingDefault<S, R> =>
    {
        return optional(toEncoded(self)).pipe(decodeTo(self, {
            decode: SchemaGetter.withDefault(toIssueResult(defaultValue)),
            encode
        }));
    };
}

/**
 * Type-level representation returned by {@link withDecodingDefaultType}.
 *
 * @category decoding
 * @since 1.0.0
 */
export interface withDecodingDefaultType<S extends Constraint, R extends never = never> extends decodeTo<withDecodingDefault<toType<S>, R>, optional<S>>
{
    readonly "Rebuild": withDecodingDefaultType<S, R>;
}

/**
 * Wraps the `Encoded` side with `optional` (key absent **or** `undefined`)
 * and provides a default `Type` value when the field is missing or
 * `undefined` during decoding.
 *
 * @category decoding
 * @since 1.0.0
 */
export function withDecodingDefaultType<S extends Constraint, R extends never = never>(defaultValue: () => RResult.Result<S["Type"], SchemaError>, options?: DecodingDefaultOptions): (self: S) => withDecodingDefaultType<S, R>
{
    return (self: S): withDecodingDefaultType<S, R> =>
    {
        return toType(self).pipe(withDecodingDefault<toType<S>, R>(defaultValue, options), encodeTo(optional(self)));
    };
}

/**
 * Type-level representation returned by {@link tag}.
 *
 * @category constructors
 * @since 1.0.0
 */
export interface tag<Tag extends SchemaAST.LiteralValue> extends withConstructorDefault<Literal<Tag>>
{
}

/**
 * Combines a {@link Literal} schema with {@link withConstructorDefault}, making it ideal
 * for discriminator fields in tagged unions. When constructing via `make`, the
 * `_tag` field can be omitted and will be filled automatically.
 *
 * @category constructors
 * @since 1.0.0
 */
export function tag<Tag extends SchemaAST.LiteralValue>(literal: Tag): tag<Tag>
{
    return Literal(literal).pipe(withConstructorDefault(() => RResult.succeed(literal)));
}

/**
 * Creates a literal `_tag` schema that is omitted from encoded output.
 *
 * @category constructors
 * @since 1.0.0
 */
export function tagDefaultOmit<Tag extends SchemaAST.LiteralValue>(literal: Tag)
{
    return tag(literal).pipe(withDecodingDefaultKey(() => RResult.succeed(literal), { encodingStrategy: "omit" }));
}

/**
 * Type-level representation returned by {@link TaggedStruct}.
 *
 * @category models
 * @since 1.0.0
 */
export type TaggedStruct<Tag extends SchemaAST.LiteralValue, Fields extends Struct.Fields> = Struct<Simplify<{
    readonly _tag: tag<Tag>;
} & Fields>>;

/**
 * Creates a struct schema with an automatically populated `_tag` field.
 *
 * @category constructors
 * @since 1.0.0
 */
export function TaggedStruct<const Tag extends SchemaAST.LiteralValue, const Fields extends Struct.Fields>(value: Tag, fields: Fields): TaggedStruct<Tag, Fields>
{
    return Struct({ _tag: tag(value),
        ...fields }) as any;
}

/**
 * Recursively flatten any nested Schema.Union members into a single tuple of leaf schemas.
 *
 * @category Utilities
 * @since 1.0.0
 */
type Flatten<Schemas> = Schemas extends readonly [
    infer Head,
    ...infer Tail
] ? Head extends Union<infer Inner> ? [
        ...Flatten<Inner>,
        ...Flatten<Tail>
    ] : [
        Head,
        ...Flatten<Tail>
    ] : [
    ];

type DiscriminantKey<T extends PropertyKey> = T extends number ? `${T}` : T;

type EnsureUniqueDiscriminants<Tags extends ReadonlyArray<PropertyKey>, Seen = never> = Tags extends readonly [
    infer Head extends PropertyKey,
    ...infer Tail extends ReadonlyArray<PropertyKey>
] ? [
    DiscriminantKey<Head> & Seen
    ] extends [
        never
    ] ? EnsureUniqueDiscriminants<Tail, Seen | DiscriminantKey<Head>> : never : unknown;

type MatchCasesResult<Cases> = {
    [K in keyof Cases]-?: NonNullable<Cases[K]> extends (...args: Array<any>) => infer R ? R : never;
}[keyof Cases];

type MatchOrElseResult<Cases, OrElse extends (...args: Array<any>) => any> = Unify<MatchCasesResult<Cases> | ReturnType<OrElse>>;
namespace TaggedUnionUtils
{
/**
 * match settings for TaggedUnionUtils.
 *
 * @category Types
 * @since 1.0.0
 */
    export interface Match<Tag extends PropertyKey, Members extends ReadonlyArray<Constraint &
{
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}>, Flattened extends ReadonlyArray<Constraint & {
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}> = Flatten<Members>> {
        <Cases extends {
            [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => any;
        }>(value: Members[number]["Type"], cases: Cases): Cases[keyof Cases] extends (value: any) => infer R ? Unify<R> : never;
        <Cases extends {
            [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => any;
        }>(cases: Cases): (value: Members[number]["Type"]) => Cases[keyof Cases] extends (value: any) => infer R ? Unify<R> : never;
    }

    /**
     * matchOrElse settings for TaggedUnionUtils.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface MatchOrElse<Tag extends PropertyKey, Members extends ReadonlyArray<Constraint &
{
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}>, Flattened extends ReadonlyArray<Constraint & {
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}> = Flatten<Members>> {
        <Cases extends {
            [M in Flattened[number] as M["Type"][Tag]]+?: (value: M["Type"]) => any;
        } & {
            [K in Exclude<keyof Cases, Flattened[number]["Type"][Tag]>]: never;
        }, OrElse extends (value: Exclude<Members[number]["Type"], {
            readonly [K in Tag]: keyof Cases;
        }>) => any>(value: Members[number]["Type"], cases: Cases, orElse: OrElse): MatchOrElseResult<Cases, OrElse>;
        <Cases extends {
            [M in Flattened[number] as M["Type"][Tag]]+?: (value: M["Type"]) => any;
        } & {
            [K in Exclude<keyof Cases, Flattened[number]["Type"][Tag]>]: never;
        }, OrElse extends (value: Exclude<Members[number]["Type"], {
            readonly [K in Tag]: keyof Cases;
        }>) => any>(cases: Cases, orElse: OrElse): (value: Members[number]["Type"]) => MatchOrElseResult<Cases, OrElse>;
    }
}

type TaggedUnionUtils<Tag extends PropertyKey, Members extends ReadonlyArray<Constraint & {
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}>, Flattened extends ReadonlyArray<Constraint & {
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}> = Flatten<Members>> = {
    /**
     * Property key used to discriminate union members.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly tag: Tag;

    /**
     * Discriminant values in flattened member order.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly discriminants: {
        readonly [I in keyof Flattened]: Flattened[I]["Type"][Tag];
    };
    readonly cases: Simplify<{
        [M in Flattened[number] as M["Type"][Tag]]: M;
    }>;
    readonly isAnyOf: <const Keys>(keys: ReadonlyArray<Keys>) => (value: Members[number]["Type"]) => value is Extract<Members[number]["Type"], {
        readonly [K in Tag]: Keys;
    }>;
    readonly guards: {
        [M in Flattened[number] as M["Type"][Tag]]: (u: unknown) => u is M["Type"];
    };
    readonly match: TaggedUnionUtils.Match<Tag, Members, Flattened>;
    readonly matchOrElse: TaggedUnionUtils.MatchOrElse<Tag, Members, Flattened>;
};

/**
 * Type-level representation returned by {@link toTaggedUnion}.
 *
 * @category combinators
 * @since 1.0.0
 */
export type toTaggedUnion<Tag extends PropertyKey, Members extends ReadonlyArray<Constraint & {
    readonly Type: {
        readonly [K in Tag]: PropertyKey;
    };
}>> = Union<Members> & TaggedUnionUtils<Tag, Members>;

/**
 * Augments an existing {@link Union} of tagged structs with utility methods and an ordered tuple of discriminant
 * values.
 *
 * @category combinators
 * @since 1.0.0
 */
export function toTaggedUnion<const Tag extends PropertyKey>(tag: Tag)
{
    return <const Members extends ReadonlyArray<Constraint & {
        readonly Type: {
            readonly [K in Tag]: PropertyKey;
        };
    }>>(self: Union<Members> & NoInfer<EnsureUniqueDiscriminants<TaggedUnionUtils<Tag, Members>["discriminants"]>>): toTaggedUnion<Tag, Members> =>
    {
        const cases: Record<PropertyKey, unknown> = {};
        const discriminants: Array<PropertyKey> = [];
        const discriminantKeys = new Set<string | symbol>();
        const guards: Record<PropertyKey, (u: unknown) => boolean> = {};
        const isAnyOf = (keys: ReadonlyArray<PropertyKey>) => (value: Members[number]["Type"]) => keys.includes(value[tag]);
        walk(self);
        return Object.assign(self, { tag,
            cases,
            discriminants,
            isAnyOf,
            guards,
            match,
            matchOrElse }) as any;

        /**
         * Supports walk during synchronous schema processing.
         *
         *
         * @throws { Error } When schema configuration is invalid or a callback throws.
         *
         * @category Internal
         * @since 1.0.0
         */
        function walk(schema: Constraint)
        {
            const ast = schema.ast;
            if (SchemaAST.isUnion(ast) && "members" in schema && globalThis.Array.isArray(schema.members) &&
                schema.members.every(isSchema))
            {
                return schema.members.forEach(walk);
            }

            const sentinels = SchemaAST.collectSentinels(ast);
            if (sentinels.length > 0)
            {
                const literal = sentinels.find((s) => s.key === tag)?.literal;
                if (Predicate.isPropertyKey(literal))
                {
                    const key = typeof literal === "number" ? globalThis.String(literal) : literal;
                    if (discriminantKeys.has(key))
                    {
                        throw new globalThis.Error(`Duplicate discriminant: ${globalThis.String(literal)}`);
                    }

                    discriminantKeys.add(key);
                    discriminants.push(literal);
                    InternalRecord.assignProperty(cases, literal, schema);
                    InternalRecord.assignProperty(guards, literal, SchemaParser.is(toType(schema)));
                    return;
                }
            }

            throw new globalThis.Error("No literal or unique symbol found");
        }

        /**
         * Supports match during synchronous schema processing.
         *
         *
         * @category Internal
         * @since 1.0.0
         */
        function match()
        {
            if (arguments.length === 1)
            {
                const cases = arguments[0];
                return function (value: any)
                {
                    const key = value[tag];
                    const handler = Object.hasOwn(cases, key) ? cases[key] : undefined;
                    return handler(value);
                };
            }

            const value = arguments[0];
            const cases = arguments[1];
            const key = value[tag];
            const handler = Object.hasOwn(cases, key) ? cases[key] : undefined;
            return handler(value);
        }

        /**
         * Supports match or else during synchronous schema processing.
         *
         *
         * @category Internal
         * @since 1.0.0
         */
        function matchOrElse()
        {
            if (arguments.length === 2)
            {
                const cases = arguments[0];
                const orElse = arguments[1];
                return function (value: any)
                {
                    const key = value[tag];
                    const handler = Object.hasOwn(cases, key) ? cases[key] ?? orElse : orElse;
                    return handler(value);
                };
            }

            const value = arguments[0];
            const cases = arguments[1];
            const orElse = arguments[2];
            const key = value[tag];
            const handler = Object.hasOwn(cases, key) ? cases[key] ?? orElse : orElse;
            return handler(value);
        }
    };
}

export namespace TaggedUnion
{
/**
 * match settings for TaggedUnion.
 *
 * @category Types
 * @since 1.0.0
 */
    export interface Match<Cases extends Record<string, Constraint>>
    {
        <Output>(cases: {
            [K in keyof Cases]: (value: Cases[K]["Type"]) => Output;
        }): (value: Cases[keyof Cases]["Type"]) => Output;
        <Output>(value: Cases[keyof Cases]["Type"], cases: {
            [K in keyof Cases]: (value: Cases[K]["Type"]) => Output;
        }): Output;
    }

    /**
     * matchOrElse settings for TaggedUnion.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface MatchOrElse<Cases extends Record<string, Constraint>>
    {
        <Output>(value: Cases[keyof Cases]["Type"], cases: {
            [K in keyof Cases]?: (value: Cases[K]["Type"]) => Output;
        }, orElse: (value: Cases[keyof Cases]["Type"]) => Output): Output;
        <Output>(cases: {
            [K in keyof Cases]?: (value: Cases[K]["Type"]) => Output;
        }, orElse: (value: Cases[keyof Cases]["Type"]) => Output): (value: Cases[keyof Cases]["Type"]) => Output;
    }
}

/**
 * Type-level representation returned by {@link TaggedUnion}.
 *
 * @category models
 * @since 1.0.0
 */
export interface TaggedUnion<Cases extends Record<string, Constraint>> extends BottomLazy<SchemaAST.Union<SchemaAST.Objects>, TaggedUnion<Cases>>
{
    readonly "Type": {
        [K in keyof Cases]: Cases[K]["Type"];
    }[keyof Cases];
    readonly "Encoded": {
        [K in keyof Cases]: Cases[K]["Encoded"];
    }[keyof Cases];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": {
        [K in keyof Cases]: Cases[K]["~type.make"];
    }[keyof Cases];
    readonly "~type.make": {
        [K in keyof Cases]: Cases[K]["~type.make"];
    }[keyof Cases];
    readonly "Iso": {
        [K in keyof Cases]: Cases[K]["Type"];
    }[keyof Cases];
    readonly tag: "_tag";
    readonly cases: Cases;
    readonly isAnyOf: <const Keys>(keys: ReadonlyArray<Keys>) => (value: Cases[keyof Cases]["Type"]) => value is Extract<Cases[keyof Cases]["Type"], {
        _tag: Keys;
    }>;
    readonly guards: {
        [K in keyof Cases]: (u: unknown) => u is Cases[K]["Type"];
    };
    readonly match: TaggedUnion.Match<Cases>;
    readonly matchOrElse: TaggedUnion.MatchOrElse<Cases>;
}

/**
 * Builds a discriminated union from a record of field sets, one per variant.
 * Each key becomes the `_tag` literal and the value is passed to {@link TaggedStruct}.
 * The result includes `tag`, `cases`, `guards`, `isAnyOf`, `match`, and `matchOrElse` utilities.
 *
 * @category constructors
 * @since 1.0.0
 */
export function TaggedUnion<const CasesByTag extends Record<string, Struct.Fields>>(casesByTag: CasesByTag): TaggedUnion<{
    readonly [K in keyof CasesByTag & string]: TaggedStruct<K, CasesByTag[K]>;
}>
{
    const cases: any = {};
    const members: any = [];
    for (const key of Object.keys(casesByTag))
    {
        const member = TaggedStruct(key, casesByTag[key]);
        InternalRecord.assignProperty(cases, key, member);
        members.push(member);
    }

    const union = Union(members);
    const { tag, guards, isAnyOf, match, matchOrElse } = toTaggedUnion("_tag")(union);
    return make(union.ast, { tag,
        cases,
        isAnyOf,
        guards,
        match,
        matchOrElse });
}

/**
 * Type-level representation returned by {@link Opaque}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Opaque<Self, S extends Top, Brand> extends BottomLazyWithoutNew<S["ast"], S["Rebuild"], S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": Self;
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    new (_: never): S["Type"] & Brand;
}

/**
 * Wraps a struct schema so that its decoded `Type` becomes a nominally distinct type `Self`.
 * Useful for creating opaque types that are structurally identical to a base struct
 * but type-incompatible with it.
 *
 * @category constructors
 * @since 1.0.0
 */
export function Opaque<Self, Brand = {}>()
{
    return <S extends Top>(schema: S): Opaque<Self, S, Brand> & Omit<S, keyof Top> => schema as any;
}

/**
 * Type-level representation returned by {@link instanceOf}.
 *
 * @category models
 * @since 1.0.0
 */
export interface instanceOf<T, Iso = T> extends declare<T, Iso>
{
    readonly "Rebuild": instanceOf<T, Iso>;
}

/**
 * Creates a schema that validates values using `instanceof`.
 * Decoding and encoding pass the value through unchanged.
 *
 * @category constructors
 * @since 1.0.0
 */
export function instanceOf<C extends abstract new (...args: any) => any, Iso = InstanceType<C>>(constructor: C, annotations?: Annotations.Declaration<InstanceType<C>> | undefined): instanceOf<InstanceType<C>, Iso>
{
    return declare((u): u is InstanceType<C> => u instanceof constructor, annotations);
}

/**
 * Constructs an `SchemaAST.Link` that describes how a value of type `T` encodes to and decodes from a `To` schema.
 * Used when building low-level AST transformations that bridge two schema types.
 *
 * @category transforming
 * @since 1.0.0
 */
export function link<T>()
{
    return <To extends Constraint>(encodeTo: To, transformation: {
        readonly decode: SchemaGetter.Getter<T, NoInfer<To["Type"]>>;
        readonly encode: SchemaGetter.Getter<NoInfer<To["Type"]>, T>;
    }): SchemaAST.Link =>
    {
        return new SchemaAST.Link(encodeTo.ast, SchemaTransformation.makeTransformation(transformation));
    };
}

/**
 * Creates a custom validation filter from a predicate function.
 *
 * @category constructors
 * @since 1.0.0
 */
export const makeFilter: <T>(filter: (input: T, ast: SchemaAST.AST, options: SchemaAST.ParseOptions) => FilterOutput, annotations?: Annotations.Filter | undefined, abort?: boolean) => SchemaAST.Filter<T> = SchemaAST.makeFilter;

/**
 * A single failure reported by a filter predicate. Used as the element type
 * of the array arm of {@link FilterOutput}, and also accepted on its own.
 *
 * @category models
 * @since 1.0.0
 */
export type FilterIssue = string | SchemaIssue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>;
    readonly issue: string | SchemaIssue.Issue;
};

/**
 * The value a filter predicate (see {@link makeFilter}) may return.
 *
 * @category models
 * @since 1.0.0
 */
export type FilterOutput = undefined | boolean | FilterIssue | ReadonlyArray<FilterIssue>;

/**
 * Groups multiple checks into a single {@link SchemaAST.FilterGroup}, applying
 * optional shared annotations to the group as a whole.
 *
 * @category constructors
 * @since 1.0.0
 */
export function makeFilterGroup<T>(checks: readonly [
    SchemaAST.Check<T>,
    ...Array<SchemaAST.Check<T>>
], annotations: Annotations.Filter | undefined = undefined): SchemaAST.FilterGroup<T>
{
    return new SchemaAST.FilterGroup(checks, annotations);
}

const TrimmedPattern = "^\\S[\\s\\S]*\\S$|^\\S$|^$";

/**
 * Validates that a string has no leading or trailing whitespace.
 *
 * @category validation
 * @since 1.0.0
 */
export function isTrimmed(annotations?: Annotations.Filter)
{
    const regExp = new globalThis.RegExp(TrimmedPattern);
    return makeFilter((s: string) => s.trim() === s, {
        expected: "a string with no leading or trailing whitespace",
        "~representation": {
            id: "effect/schema/isTrimmed",
            payload: null
        },
        toJsonSchema: () => ({ pattern: regExp.source }),
        ...annotations
    });
}

/**
 * Validates that a string matches the specified regular expression pattern.
 *
 * @category validation
 * @since 1.0.0
 */
export function isPattern(regExp: globalThis.RegExp, annotations?: Annotations.Filter): SchemaAST.Filter<string>
{
    const source = regExp.source;
    const flags = regExp.flags;
    const canExport = /^[dg]*uy?$/.test(flags);
    return SchemaAST.isPattern(regExp, {
        toJsonSchema: () => canExport ? { pattern: flags.endsWith("y") ? `^(?:${source})` : source } : [ {}, true ],
        ...annotations
    });
}

/**
 * Validates that a string represents a finite number.
 *
 * @category validation
 * @since 1.0.0
 */
export function isStringFinite(annotations?: Annotations.Filter): SchemaAST.Filter<string>
{
    return SchemaAST.isStringFinite({
        ...annotations
    });
}

/**
 * Validates that a string is a signed base-10 integer literal for Effect's
 * BigInt string encoding.
 *
 * @category validation
 * @since 1.0.0
 */
export function isStringBigInt(annotations?: Annotations.Filter): SchemaAST.Filter<string>
{
    return SchemaAST.isStringBigInt({
        ...annotations
    });
}

/**
 * Validates that a string has the `Symbol(description)` format used by Effect's
 * symbol string encoding.
 *
 * @category validation
 * @since 1.0.0
 */
export function isStringSymbol(annotations?: Annotations.Filter): SchemaAST.Filter<string>
{
    return SchemaAST.isStringSymbol({
        ...annotations
    });
}

const getUUIDRegExp = (version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): globalThis.RegExp =>
{
    if (version)
    {
        return new globalThis.RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
    }

    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12})$/;
};

/**
 * Validates that a string is a strict Universally Unique Identifier (UUID).
 *
 * @category validation
 * @since 1.0.0
 */
export function isUUID(version?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, annotations?: Annotations.Filter)
{
    const regExp = getUUIDRegExp(version);
    return isPattern(regExp, {
        expected: version ? `a UUID v${version}` : "a UUID",
        "~representation": {
            id: "effect/schema/isUUID",
            payload: { version: version ?? null }
        },
        toJsonSchema: () => ({ pattern: regExp.source,
            format: "uuid" }),
        ...annotations
    });
}

const GuidRegexp = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

/**
 * Validates that a string has the GUID / UUID textual shape.
 *
 * @category validation
 * @since 1.0.0
 */
export function isGUID(annotations?: Annotations.Filter)
{
    return isPattern(GuidRegexp, {
        expected: "a GUID",
        "~representation": {
            id: "effect/schema/isGUID",
            payload: null
        },
        toJsonSchema: () => ({ pattern: GuidRegexp.source }),
        ...annotations
    });
}

/**
 * Validates that a string is a valid ULID (Universally Unique Lexicographically
 * Sortable Identifier).
 *
 * @category validation
 * @since 1.0.0
 */
export function isULID(annotations?: Annotations.Filter)
{
    const regExp = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
    return isPattern(regExp, {
        "~representation": {
            id: "effect/schema/isULID",
            payload: null
        },
        toJsonSchema: () => ({ pattern: regExp.source }),
        ...annotations
    });
}

/**
 * Validates that a string is valid Base64 encoded data.
 *
 * @category validation
 * @since 1.0.0
 */
export function isBase64(annotations?: Annotations.Filter)
{
    const regExp = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    return isPattern(regExp, {
        expected: "a base64 encoded string",
        "~representation": {
            id: "effect/schema/isBase64",
            payload: null
        },
        toJsonSchema: () => ({ pattern: regExp.source }),
        ...annotations
    });
}

/**
 * Validates that a string is valid Base64URL encoded data (Base64 with URL-safe
 * characters).
 *
 * @category validation
 * @since 1.0.0
 */
export function isBase64Url(annotations?: Annotations.Filter)
{
    const regExp = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    return isPattern(regExp, {
        expected: "a base64url encoded string",
        "~representation": {
            id: "effect/schema/isBase64Url",
            payload: null
        },
        toJsonSchema: () => ({ pattern: regExp.source }),
        ...annotations
    });
}

/**
 * Supports literal to json schema during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function literalToJsonSchema(literal: string, original: string, pattern: string): SchemaRepresentation.ToJsonSchema.CheckOutput
{
    if (literal.length === 0)
    {return original.length === 0 ? {} : [ {}, true ];}

    const constraint = { pattern: new globalThis.RegExp(pattern).source };
    return literal === original ? constraint : [ constraint, true ];
}

/**
 * Validates at runtime that a string starts with the specified literal prefix.
 *
 * @category validation
 * @since 1.0.0
 */
export function isStartingWith(startsWith: string, annotations?: Annotations.Filter)
{
    const formatted = JSON.stringify(startsWith);
    const jsonSchemaLiteral = startsWith.replace(/[\uD800-\uDBFF]$/, "");
    return makeFilter((s: string) => s.startsWith(startsWith), {
        expected: `a string starting with ${formatted}`,
        "~representation": {
            id: "effect/schema/isStartingWith",
            payload: { startsWith }
        },
        toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, startsWith, `^${RegExp_.escape(jsonSchemaLiteral)}`),
        ...annotations
    });
}

/**
 * Validates at runtime that a string ends with the specified literal suffix.
 *
 * @category validation
 * @since 1.0.0
 */
export function isEndingWith(endsWith: string, annotations?: Annotations.Filter)
{
    const formatted = JSON.stringify(endsWith);
    const jsonSchemaLiteral = endsWith.replace(/^[\uDC00-\uDFFF]/, "");
    return makeFilter((s: string) => s.endsWith(endsWith), {
        expected: `a string ending with ${formatted}`,
        "~representation": {
            id: "effect/schema/isEndingWith",
            payload: { endsWith }
        },
        toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, endsWith, `${RegExp_.escape(jsonSchemaLiteral)}$`),
        ...annotations
    });
}

/**
 * Validates at runtime that a string contains the specified literal substring.
 *
 * @category validation
 * @since 1.0.0
 */
export function isIncluding(includes: string, annotations?: Annotations.Filter)
{
    const formatted = JSON.stringify(includes);
    const regExp = new globalThis.RegExp(RegExp_.escape(includes));
    const jsonSchemaLiteral = includes.replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, "");
    return makeFilter((s: string) => s.includes(includes), {
        expected: `a string including ${formatted}`,
        "~representation": {
            id: "effect/schema/isIncluding",
            payload: { includes }
        },
        toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, includes, RegExp_.escape(jsonSchemaLiteral)),
        ...annotations
    });
}

const UppercasedPattern = "^[^a-z]*$";

/**
 * Validates that a string is unchanged by JavaScript's `toUpperCase()`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isUppercased(annotations?: Annotations.Filter)
{
    const regExp = new globalThis.RegExp(UppercasedPattern);
    return makeFilter((s: string) => s.toUpperCase() === s, {
        expected: "a string with all characters in uppercase",
        "~representation": {
            id: "effect/schema/isUppercased",
            payload: null
        },
        toJsonSchema: () => [ { pattern: regExp.source }, true ],
        ...annotations
    });
}

const LowercasedPattern = "^[^A-Z]*$";

/**
 * Validates that a string is unchanged by JavaScript's `toLowerCase()`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isLowercased(annotations?: Annotations.Filter)
{
    const regExp = new globalThis.RegExp(LowercasedPattern);
    return makeFilter((s: string) => s.toLowerCase() === s, {
        expected: "a string with all characters in lowercase",
        "~representation": {
            id: "effect/schema/isLowercased",
            payload: null
        },
        toJsonSchema: () => [ { pattern: regExp.source }, true ],
        ...annotations
    });
}

const CapitalizedPattern = "^(?:[^a-z][\\s\\S]*)?$";

/**
 * Validates that the first character of a string is unchanged by
 * `toUpperCase()`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isCapitalized(annotations?: Annotations.Filter)
{
    const regExp = new globalThis.RegExp(CapitalizedPattern);
    return makeFilter((s: string) => s.charAt(0).toUpperCase() === s.charAt(0), {
        expected: "a string with the first character in uppercase",
        "~representation": {
            id: "effect/schema/isCapitalized",
            payload: null
        },
        toJsonSchema: () => [ { pattern: regExp.source }, true ],
        ...annotations
    });
}

const UncapitalizedPattern = "^(?:[^A-Z][\\s\\S]*)?$";

/**
 * Validates that the first character of a string is unchanged by
 * `toLowerCase()`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isUncapitalized(annotations?: Annotations.Filter)
{
    const regExp = new globalThis.RegExp(UncapitalizedPattern);
    return makeFilter((s: string) => s.charAt(0).toLowerCase() === s.charAt(0), {
        expected: "a string with the first character in lowercase",
        "~representation": {
            id: "effect/schema/isUncapitalized",
            payload: null
        },
        toJsonSchema: () => [ { pattern: regExp.source }, true ],
        ...annotations
    });
}

/**
 * Type-level representation of {@link Finite}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Finite extends Number
{
    readonly "Rebuild": Finite;
}

/**
 * Schema for finite numbers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Finite: Finite = make(SchemaAST.finite);

/**
 * Validates that a number is finite (not `Infinity`, `-Infinity`, or `NaN`).
 *
 * @category validation
 * @since 1.0.0
 */
export const isFinite: (annotations?: Annotations.Filter) => SchemaAST.Filter<number> = SchemaAST.isFinite;

/**
 * Creates a greater-than (`>`) check for any ordered type from an
 * `Order.Order` instance.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsGreaterThan<T>(options: {
    readonly order: Order.Order<T>;
    readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    const gt = Order.isGreaterThan(options.order);
    const formatter = options.formatter ?? format;
    return (exclusiveMinimum: T, annotations?: Annotations.Filter) =>
    {
        return makeFilter<T>((input) => gt(input, exclusiveMinimum), {
            expected: `a value greater than ${formatter(exclusiveMinimum)}`,
            ...options.annotate?.(exclusiveMinimum),
            ...annotations
        });
    };
}

/**
 * Creates a greater-than-or-equal-to (`>=`) check for any ordered type from an
 * `Order.Order` instance.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsGreaterThanOrEqualTo<T>(options: {
    readonly order: Order.Order<T>;
    readonly annotate?: ((exclusiveMinimum: T) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    const gte = Order.isGreaterThanOrEqualTo(options.order);
    const formatter = options.formatter ?? format;
    return (minimum: T, annotations?: Annotations.Filter) =>
    {
        return makeFilter<T>((input) => gte(input, minimum), {
            expected: `a value greater than or equal to ${formatter(minimum)}`,
            ...options.annotate?.(minimum),
            ...annotations
        });
    };
}

/**
 * Creates a less-than (`<`) check for any ordered type from an `Order.Order`
 * instance.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsLessThan<T>(options: {
    readonly order: Order.Order<T>;
    readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    const lt = Order.isLessThan(options.order);
    const formatter = options.formatter ?? format;
    return (exclusiveMaximum: T, annotations?: Annotations.Filter) =>
    {
        return makeFilter<T>((input) => lt(input, exclusiveMaximum), {
            expected: `a value less than ${formatter(exclusiveMaximum)}`,
            ...options.annotate?.(exclusiveMaximum),
            ...annotations
        });
    };
}

/**
 * Creates a less-than-or-equal-to (`<=`) check for any ordered type from an
 * `Order.Order` instance.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsLessThanOrEqualTo<T>(options: {
    readonly order: Order.Order<T>;
    readonly annotate?: ((exclusiveMaximum: T) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    const lte = Order.isLessThanOrEqualTo(options.order);
    const formatter = options.formatter ?? format;
    return (maximum: T, annotations?: Annotations.Filter) =>
    {
        return makeFilter<T>((input) => lte(input, maximum), {
            expected: `a value less than or equal to ${formatter(maximum)}`,
            ...options.annotate?.(maximum),
            ...annotations
        });
    };
}

/**
 * Creates an inclusive or exclusive range check for any ordered type from an
 * `Order.Order` instance.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsBetween<T>(deriveOptions: {
    readonly order: Order.Order<T>;
    readonly annotate?: ((options: {
        readonly minimum: T;
        readonly maximum: T;
        readonly exclusiveMinimum?: boolean | undefined;
        readonly exclusiveMaximum?: boolean | undefined;
    }) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    const greaterThanOrEqualTo = Order.isGreaterThanOrEqualTo(deriveOptions.order);
    const greaterThan = Order.isGreaterThan(deriveOptions.order);
    const lessThanOrEqualTo = Order.isLessThanOrEqualTo(deriveOptions.order);
    const lessThan = Order.isLessThan(deriveOptions.order);
    const formatter = deriveOptions.formatter ?? format;
    return (options: {
        readonly minimum: T;
        readonly maximum: T;
        readonly exclusiveMinimum?: boolean | undefined;
        readonly exclusiveMaximum?: boolean | undefined;
    }, annotations?: Annotations.Filter) =>
    {
        const gte = options.exclusiveMinimum ? greaterThan : greaterThanOrEqualTo;
        const lte = options.exclusiveMaximum ? lessThan : lessThanOrEqualTo;
        return makeFilter<T>((input) => gte(input, options.minimum) && lte(input, options.maximum), {
            expected: `a value between ${formatter(options.minimum)}${options.exclusiveMinimum ? " (excluded)" : ""} and ${formatter(options.maximum)}${options.exclusiveMaximum ? " (excluded)" : ""}`,
            ...deriveOptions.annotate?.(options),
            ...annotations
        });
    };
}

/**
 * Creates a divisibility check for any numeric type from a remainder function
 * and a zero value.
 *
 * @category validation
 * @since 1.0.0
 */
export function makeIsMultipleOf<T>(options: {
    readonly remainder: (input: T, divisor: T) => T;
    readonly zero: NoInfer<T>;
    readonly annotate?: ((divisor: T) => Annotations.Filter) | undefined;
    readonly formatter?: Formatter<T> | undefined;
})
{
    return (divisor: T, annotations?: Annotations.Filter) =>
    {
        const formatter = options.formatter ?? format;
        return makeFilter<T>((input) => options.remainder(input, divisor) === options.zero, {
            expected: `a value that is a multiple of ${formatter(divisor)}`,
            ...options.annotate?.(divisor),
            ...annotations
        });
    };
}

/**
 * Supports encode number payload during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
function encodeNumberPayload(number: number): number
{
    if (!globalThis.Number.isFinite(number))
    {
        throw new globalThis.RangeError(`Expected a finite number, got ${format(number)}`);
    }

    return number;
}

/**
 * Validates that a number is greater than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThan: (exclusiveMinimum: number, annotations?: Annotations.Filter) => SchemaAST.Filter<number> = makeIsGreaterThan({
    order: Order.Number,
    annotate: (exclusiveMinimum) => ({
        "~representation": {
            id: "effect/schema/isGreaterThan",
            payload: { exclusiveMinimum: encodeNumberPayload(exclusiveMinimum) }
        },
        toJsonSchema: () => ({ exclusiveMinimum })
    })
});

/**
 * Validates that a number is greater than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanOrEqualTo: (minimum: number, annotations?: Annotations.Filter) => SchemaAST.Filter<number> = makeIsGreaterThanOrEqualTo({
    order: Order.Number,
    annotate: (minimum) => ({
        "~representation": {
            id: "effect/schema/isGreaterThanOrEqualTo",
            payload: { minimum: encodeNumberPayload(minimum) }
        },
        toJsonSchema: () => ({ minimum })
    })
});

/**
 * Validates that a number is less than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThan: (exclusiveMaximum: number, annotations?: Annotations.Filter) => SchemaAST.Filter<number> = makeIsLessThan({
    order: Order.Number,
    annotate: (exclusiveMaximum) => ({
        "~representation": {
            id: "effect/schema/isLessThan",
            payload: { exclusiveMaximum: encodeNumberPayload(exclusiveMaximum) }
        },
        toJsonSchema: () => ({ exclusiveMaximum })
    })
});

/**
 * Validates that a number is less than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanOrEqualTo: (maximum: number, annotations?: Annotations.Filter) => SchemaAST.Filter<number> = makeIsLessThanOrEqualTo({
    order: Order.Number,
    annotate: (maximum) => ({
        "~representation": {
            id: "effect/schema/isLessThanOrEqualTo",
            payload: { maximum: encodeNumberPayload(maximum) }
        },
        toJsonSchema: () => ({ maximum })
    })
});

/**
 * Validates that a number is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * @category validation
 * @since 1.0.0
 */
export const isBetween: (options: {
    readonly minimum: number;
    readonly maximum: number;
    readonly exclusiveMinimum?: boolean | undefined;
    readonly exclusiveMaximum?: boolean | undefined;
}, annotations?: Annotations.Filter) => SchemaAST.Filter<number> = makeIsBetween({
    order: Order.Number,
    annotate: (options) =>
    {
        const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
        const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
        const payload = {
            minimum: encodeNumberPayload(options.minimum),
            maximum: encodeNumberPayload(options.maximum),
            ...(exclusiveMinimum && { exclusiveMinimum }),
            ...(exclusiveMaximum && { exclusiveMaximum })
        };
        return {
            "~representation": {
                id: "effect/schema/isBetween",
                payload
            },
            toJsonSchema: () => ({
                [exclusiveMinimum ? "exclusiveMinimum" : "minimum"]: options.minimum,
                [exclusiveMaximum ? "exclusiveMaximum" : "maximum"]: options.maximum
            })
        };
    }
});

/**
 * Validates that a number is a multiple of the specified divisor.
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMultipleOf(divisor: number, annotations?: Annotations.Filter): SchemaAST.Filter<number>
{
    if (!globalThis.Number.isFinite(divisor) || divisor === 0)
    {
        throw new globalThis.RangeError(`Expected a finite non-zero number, got ${globalThis.String(divisor)}`);
    }

    divisor = globalThis.Math.abs(divisor);
    return makeFilter((input: number) => remainder(input, divisor) === 0, {
        expected: `a value that is a multiple of ${divisor}`,
        "~representation": {
            id: "effect/schema/isMultipleOf",
            payload: { divisor }
        },
        toJsonSchema: () => ({ multipleOf: divisor }),
        ...annotations
    });
}

/**
 * Validates that a number is a safe integer (within the safe integer range
 * that can be exactly represented in JavaScript).
 *
 * @category validation
 * @since 1.0.0
 */
export function isInt(annotations?: Annotations.Filter)
{
    return makeFilter((n: number) => globalThis.Number.isSafeInteger(n), {
        expected: "an integer",
        "~representation": {
            id: "effect/schema/isInt",
            payload: null
        },
        toJsonSchema: () => ({
            type: "integer",
            minimum: globalThis.Number.MIN_SAFE_INTEGER,
            maximum: globalThis.Number.MAX_SAFE_INTEGER
        }),
        ...annotations
    });
}

/**
 * Type-level representation of {@link Int}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Int extends Number
{
    readonly "Rebuild": Int;
}

/**
 * Schema for integers, rejecting `NaN`, `Infinity`, and `-Infinity`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Int: Int = Number.check(isInt());

/**
 * Type-level representation of {@link Natural}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Natural extends Int
{
    readonly "Rebuild": Natural;
}

/**
 * Schema for non-negative safe integers, including zero.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Natural: Natural = Int.check(isGreaterThanOrEqualTo(0));

/**
 * Validates that a number is a 32-bit signed integer (range: -2,147,483,648 to
 * 2,147,483,647).
 *
 * @category validation
 * @since 1.0.0
 */
export function isInt32(annotations?: Annotations.Filter)
{
    return new SchemaAST.FilterGroup([
        isInt(),
        isBetween({ minimum: -2_147_483_648,
            maximum: 2_147_483_647 })
    ], {
        expected: "a 32-bit integer",
        ...annotations
    });
}

/**
 * Validates that a number is a 32-bit unsigned integer (range: 0 to
 * 4,294,967,295).
 *
 * @category validation
 * @since 1.0.0
 */
export function isUint32(annotations?: Annotations.Filter)
{
    return new SchemaAST.FilterGroup([
        isInt(),
        isBetween({ minimum: 0,
            maximum: 4_294_967_295 })
    ], {
        expected: "a 32-bit unsigned integer",
        ...annotations
    });
}

/**
 * Supports encode date payload during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
function encodeDatePayload(date: globalThis.Date): string
{
    if (globalThis.Number.isNaN(date.getTime()))
    {
        throw new globalThis.RangeError(`Expected a valid Date, got ${format(date)}`);
    }

    return date.toISOString();
}

/**
 * Validates that a Date is greater than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanDate: (exclusiveMinimum: globalThis.Date, annotations?: Annotations.Filter) => SchemaAST.Filter<globalThis.Date> = makeIsGreaterThan({
    order: Order.Date,
    annotate: (exclusiveMinimum) =>
    {
        const encoded = encodeDatePayload(exclusiveMinimum);
        return {
            "~representation": {
                id: "effect/schema/isGreaterThanDate",
                payload: { exclusiveMinimum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a Date is greater than or equal to the specified date
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanOrEqualToDate: (minimum: globalThis.Date, annotations?: Annotations.Filter) => SchemaAST.Filter<globalThis.Date> = makeIsGreaterThanOrEqualTo({
    order: Order.Date,
    annotate: (minimum) =>
    {
        const encoded = encodeDatePayload(minimum);
        return {
            "~representation": {
                id: "effect/schema/isGreaterThanOrEqualToDate",
                payload: { minimum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a Date is less than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanDate: (exclusiveMaximum: globalThis.Date, annotations?: Annotations.Filter) => SchemaAST.Filter<globalThis.Date> = makeIsLessThan({
    order: Order.Date,
    annotate: (exclusiveMaximum) =>
    {
        const encoded = encodeDatePayload(exclusiveMaximum);
        return {
            "~representation": {
                id: "effect/schema/isLessThanDate",
                payload: { exclusiveMaximum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a Date is less than or equal to the specified date
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanOrEqualToDate: (maximum: globalThis.Date, annotations?: Annotations.Filter) => SchemaAST.Filter<globalThis.Date> = makeIsLessThanOrEqualTo({
    order: Order.Date,
    annotate: (maximum) =>
    {
        const encoded = encodeDatePayload(maximum);
        return {
            "~representation": {
                id: "effect/schema/isLessThanOrEqualToDate",
                payload: { maximum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a Date is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * @category validation
 * @since 1.0.0
 */
export const isBetweenDate: (options: {
    readonly minimum: globalThis.Date;
    readonly maximum: globalThis.Date;
    readonly exclusiveMinimum?: boolean | undefined;
    readonly exclusiveMaximum?: boolean | undefined;
}, annotations?: Annotations.Filter) => SchemaAST.Filter<globalThis.Date> = makeIsBetween({
    order: Order.Date,
    annotate: (options) =>
    {
        const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
        const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
        const payload = {
            minimum: encodeDatePayload(options.minimum),
            maximum: encodeDatePayload(options.maximum),
            ...(exclusiveMinimum && { exclusiveMinimum }),
            ...(exclusiveMaximum && { exclusiveMaximum })
        };
        return {
            "~representation": {
                id: "effect/schema/isBetweenDate",
                payload
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a BigInt is greater than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanBigInt: (exclusiveMinimum: bigint, annotations?: Annotations.Filter) => SchemaAST.Filter<bigint> = makeIsGreaterThan({
    order: Order.BigInt,
    annotate: (exclusiveMinimum) =>
    {
        const encoded = exclusiveMinimum.toString(10);
        return {
            "~representation": {
                id: "effect/schema/isGreaterThanBigInt",
                payload: { exclusiveMinimum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a BigInt is greater than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanOrEqualToBigInt: (minimum: bigint, annotations?: Annotations.Filter) => SchemaAST.Filter<bigint> = makeIsGreaterThanOrEqualTo({
    order: Order.BigInt,
    annotate: (minimum) =>
    {
        const encoded = minimum.toString(10);
        return {
            "~representation": {
                id: "effect/schema/isGreaterThanOrEqualToBigInt",
                payload: { minimum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a BigInt is less than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanBigInt: (exclusiveMaximum: bigint, annotations?: Annotations.Filter) => SchemaAST.Filter<bigint> = makeIsLessThan({
    order: Order.BigInt,
    annotate: (exclusiveMaximum) =>
    {
        const encoded = exclusiveMaximum.toString(10);
        return {
            "~representation": {
                id: "effect/schema/isLessThanBigInt",
                payload: { exclusiveMaximum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a BigInt is less than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanOrEqualToBigInt: (maximum: bigint, annotations?: Annotations.Filter) => SchemaAST.Filter<bigint> = makeIsLessThanOrEqualTo({
    order: Order.BigInt,
    annotate: (maximum) =>
    {
        const encoded = maximum.toString(10);
        return {
            "~representation": {
                id: "effect/schema/isLessThanOrEqualToBigInt",
                payload: { maximum: encoded }
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a BigInt is within a specified range. The range boundaries can
 * be inclusive or exclusive based on the provided options.
 *
 * @category validation
 * @since 1.0.0
 */
export const isBetweenBigInt: (options: {
    readonly minimum: bigint;
    readonly maximum: bigint;
    readonly exclusiveMinimum?: boolean | undefined;
    readonly exclusiveMaximum?: boolean | undefined;
}, annotations?: Annotations.Filter) => SchemaAST.Filter<bigint> = makeIsBetween({
    order: Order.BigInt,
    annotate: (options) =>
    {
        const exclusiveMinimum = options.exclusiveMinimum ? true : undefined;
        const exclusiveMaximum = options.exclusiveMaximum ? true : undefined;
        const payload = {
            minimum: options.minimum.toString(10),
            maximum: options.maximum.toString(10),
            ...(exclusiveMinimum && { exclusiveMinimum }),
            ...(exclusiveMaximum && { exclusiveMaximum })
        };
        return {
            "~representation": {
                id: "effect/schema/isBetweenBigInt",
                payload
            },
            toJsonSchema: () => [ {}, true ]
        };
    }
});

/**
 * Validates that a value has at least the specified length. Works with strings
 * and arrays.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMinLength(minLength: number, annotations?: Annotations.Filter)
{
    minLength = normalizeCardinality(minLength);
    return makeIsMinLength(minLength, Math.ceil(minLength / 2), annotations);
}

/**
 * Supports make is min length during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeIsMinLength(minLength: number, minCodePoints: number, annotations?: Annotations.Filter)
{
    return makeFilter<{
        readonly length: number;
    }>((input) => input.length >= minLength, {
        expected: `a value with a length of at least ${minLength}`,
        "~representation": {
            id: "effect/schema/isMinLength",
            payload: { minLength }
        },
        toJsonSchema: ({ type }) => type === "string"
            ? minLength <= 1
                ? { minLength: minCodePoints }
                : [ { minLength: minCodePoints }, true ]
            : type === "array"
                ? { minItems: minLength }
                : type === undefined
                    ? [ { minLength: minCodePoints,
                        minItems: minLength }, true ]
                    : [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that a value has at least one element. Works with strings and arrays.
 * This is equivalent to `isMinLength(1)`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isNonEmpty(annotations?: Annotations.Filter)
{
    return makeIsMinLength(1, 1, annotations);
}

/**
 * Validates that a value has at most the specified length. Works with strings
 * and arrays.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMaxLength(maxLength: number, annotations?: Annotations.Filter)
{
    maxLength = normalizeCardinality(maxLength);
    return makeFilter<{
        readonly length: number;
    }>((input) => input.length <= maxLength, {
        expected: `a value with a length of at most ${maxLength}`,
        "~representation": {
            id: "effect/schema/isMaxLength",
            payload: { maxLength }
        },
        toJsonSchema: ({ type }) => type === "string"
            ? maxLength === 0 ? { maxLength } : [ { maxLength }, true ]
            : type === "array"
                ? { maxItems: maxLength }
                : type === undefined
                    ? [ { maxLength,
                        maxItems: maxLength }, true ]
                    : [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that a value's length is within the specified range. Works with
 * strings and arrays.
 *
 * @category validation
 * @since 1.0.0
 */
export function isBetweenLength(minimum: number, maximum: number, annotations?: Annotations.Filter)
{
    minimum = normalizeCardinality(minimum);
    maximum = normalizeCardinality(maximum);
    return makeFilter<{
        readonly length: number;
    }>((input) => input.length >= minimum && input.length <= maximum, {
        expected: minimum === maximum
            ? `a value with a length of ${minimum}`
            : `a value with a length between ${minimum} and ${maximum}`,
        "~representation": {
            id: "effect/schema/isBetweenLength",
            payload: { minimum,
                maximum }
        },
        toJsonSchema: ({ type }) => type === "string"
            ? maximum === 0 || Math.ceil(minimum / 2) > maximum
                ? { minLength: Math.ceil(minimum / 2),
                    maxLength: maximum }
                : [ { minLength: Math.ceil(minimum / 2),
                    maxLength: maximum }, true ]
            : type === "array"
                ? { minItems: minimum,
                    maxItems: maximum }
                : type === undefined
                    ? [ {
                        minLength: Math.ceil(minimum / 2),
                        maxLength: maximum,
                        minItems: minimum,
                        maxItems: maximum
                    }, true ]
                    : [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that a string contains at least the specified number of Unicode code points.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMinCodePoints(minCodePoints: number, annotations?: Annotations.Filter)
{
    minCodePoints = normalizeCardinality(minCodePoints);
    return makeFilter<string>((input) => countCodePointsUpTo(input, minCodePoints) >= minCodePoints, {
        expected: `a string with at least ${minCodePoints} code points`,
        "~representation": {
            id: "effect/schema/isMinCodePoints",
            payload: { minCodePoints }
        },
        toJsonSchema: () => ({ minLength: minCodePoints }),
        ...annotations
    });
}

/**
 * Validates that a string contains at most the specified number of Unicode code points.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMaxCodePoints(maxCodePoints: number, annotations?: Annotations.Filter)
{
    maxCodePoints = normalizeCardinality(maxCodePoints);
    return makeFilter<string>((input) => countCodePointsUpTo(input, maxCodePoints + 1) <= maxCodePoints, {
        expected: `a string with at most ${maxCodePoints} code points`,
        "~representation": {
            id: "effect/schema/isMaxCodePoints",
            payload: { maxCodePoints }
        },
        toJsonSchema: () => ({ maxLength: maxCodePoints }),
        ...annotations
    });
}

/**
 * Validates that a string's Unicode code point count is within the specified inclusive range.
 *
 * @category validation
 * @since 1.0.0
 */
export function isBetweenCodePoints(minimum: number, maximum: number, annotations?: Annotations.Filter)
{
    minimum = normalizeCardinality(minimum);
    maximum = normalizeCardinality(maximum);
    return makeFilter<string>((input) =>
    {
        const count = countCodePointsUpTo(input, maximum + 1);
        return count >= minimum && count <= maximum;
    }, {
        expected: minimum === maximum
            ? `a string with ${minimum} code points`
            : `a string with between ${minimum} and ${maximum} code points`,
        "~representation": {
            id: "effect/schema/isBetweenCodePoints",
            payload: { minimum,
                maximum }
        },
        toJsonSchema: () => ({ allOf: [ { minLength: minimum }, { maxLength: maximum } ] }),
        ...annotations
    });
}

/**
 * Supports count code points up to during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function countCodePointsUpTo(input: string, limit: number): number
{
    if (limit === 0)
    {return 0;}

    let count = 0;
    for (const _ of input)
    {
        if (++count >= limit)
        {break;}
    }

    return count;
}

/**
 * Supports normalize cardinality during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
function normalizeCardinality(value: number): number
{
    if (!globalThis.Number.isFinite(value))
    {
        throw new globalThis.RangeError(`Expected a finite number, got ${value}`);
    }

    return Math.max(0, Math.floor(value));
}

/**
 * Validates that a value has at least the specified size. Works with values
 * that have a `size` property, such as `Set` or `Map`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMinSize(minSize: number, annotations?: Annotations.Filter)
{
    minSize = normalizeCardinality(minSize);
    return makeFilter<{
        readonly size: number;
    }>((input) => input.size >= minSize, {
        expected: `a value with a size of at least ${minSize}`,
        "~representation": {
            id: "effect/schema/isMinSize",
            payload: { minSize }
        },
        toJsonSchema: () => [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that a value has at most the specified size. Works with values
 * that have a `size` property, such as `Set` or `Map`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMaxSize(maxSize: number, annotations?: Annotations.Filter)
{
    maxSize = normalizeCardinality(maxSize);
    return makeFilter<{
        readonly size: number;
    }>((input) => input.size <= maxSize, {
        expected: `a value with a size of at most ${maxSize}`,
        "~representation": {
            id: "effect/schema/isMaxSize",
            payload: { maxSize }
        },
        toJsonSchema: () => [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that a value's size is within the specified range. Works with
 * values that have a `size` property, such as `Set` or `Map`.
 *
 * @category validation
 * @since 1.0.0
 */
export function isBetweenSize(minimum: number, maximum: number, annotations?: Annotations.Filter)
{
    minimum = normalizeCardinality(minimum);
    maximum = normalizeCardinality(maximum);
    return makeFilter<{
        readonly size: number;
    }>((input) => input.size >= minimum && input.size <= maximum, {
        expected: minimum === maximum
            ? `a value with a size of ${minimum}`
            : `a value with a size between ${minimum} and ${maximum}`,
        "~representation": {
            id: "effect/schema/isBetweenSize",
            payload: { minimum,
                maximum }
        },
        toJsonSchema: () => [ {}, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that an object contains at least the specified number of
 * properties. This includes both string and symbol keys when counting
 * properties.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMinProperties(minProperties: number, annotations?: Annotations.Filter)
{
    minProperties = normalizeCardinality(minProperties);
    return makeFilter<object>((input) => Reflect.ownKeys(input).length >= minProperties, {
        expected: `a value with at least ${minProperties === 1 ? "1 entry" : `${minProperties} entries`}`,
        "~representation": {
            id: "effect/schema/isMinProperties",
            payload: { minProperties }
        },
        toJsonSchema: ({ type }) => type === "object" ? { minProperties } : [ { minProperties }, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that an object contains at most the specified number of properties.
 * This includes both string and symbol keys when counting properties.
 *
 * @category validation
 * @since 1.0.0
 */
export function isMaxProperties(maxProperties: number, annotations?: Annotations.Filter)
{
    maxProperties = normalizeCardinality(maxProperties);
    return makeFilter<object>((input) => Reflect.ownKeys(input).length <= maxProperties, {
        expected: `a value with at most ${maxProperties === 1 ? "1 entry" : `${maxProperties} entries`}`,
        "~representation": {
            id: "effect/schema/isMaxProperties",
            payload: { maxProperties }
        },
        toJsonSchema: ({ type }) => type === "object" ? { maxProperties } : [ { maxProperties }, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that an object contains between `minimum` and `maximum` properties (inclusive).
 * This includes both string and symbol keys when counting properties.
 *
 * @category validation
 * @since 1.0.0
 */
export function isBetweenProperties(minimum: number, maximum: number, annotations?: Annotations.Filter)
{
    minimum = normalizeCardinality(minimum);
    maximum = normalizeCardinality(maximum);
    return makeFilter<object>((input) => Reflect.ownKeys(input).length >= minimum && Reflect.ownKeys(input).length <= maximum, {
        expected: minimum === maximum
            ? `a value with exactly ${minimum === 1 ? "1 entry" : `${minimum} entries`}`
            : `a value with between ${minimum} and ${maximum} entries`,
        "~representation": {
            id: "effect/schema/isBetweenProperties",
            payload: { minimum,
                maximum }
        },
        toJsonSchema: ({ type }) => type === "object"
            ? { minProperties: minimum,
                maxProperties: maximum }
            : [ { minProperties: minimum,
                maxProperties: maximum }, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that every own property key of an object satisfies the encoded side
 * of the provided key schema.
 *
 * @category validation
 * @since 1.0.0
 */
export function isPropertyNames(keySchema: Constraint, annotations?: Annotations.Filter)
{
    const propertyNames = toEncoded(keySchema);
    const parser = SchemaParser._issue(propertyNames.ast);
    return makeFilter<object>((input, ast, options) =>
    {
        const keys = Reflect.ownKeys(input);
        const issues: Array<SchemaIssue.Issue> = [];
        for (const key of keys)
        {
            const issue = parser(key, options);
            if (issue !== undefined)
            {
                issues.push(new SchemaIssue.Pointer([ key ], issue));
                if (options.errors === "first")
                {break;}
            }
        }

        if (Arr.isArrayNonEmpty(issues))
        {
            return new SchemaIssue.Composite(ast, issues, input, options);
        }

        return true;
    }, {
        expected: "an object with property names matching the schema",
        "~representation": {
            id: "effect/schema/isPropertyNames",
            payload: null,
            schemas: [ propertyNames.ast ]
        },
        toJsonSchema: ({ schemas, type }) => type === "object" ? { propertyNames: schemas[0] } : [ { propertyNames: schemas[0] }, true ],
        [InternalAnnotations.StructuralAnnotationKey]: true,
        ...annotations
    });
}

/**
 * Validates that all items in an array are unique according to Effect equality.
 *
 * @category validation
 * @since 1.0.0
 */
export function isUnique<T>(annotations?: Annotations.Filter)
{
    return makeFilter<ReadonlyArray<T>>((input) => Arr.dedupe(input).length === input.length, {
        expected: "an array with unique items",
        "~representation": {
            id: "effect/schema/isUnique",
            payload: null
        },
        toJsonSchema: () => ({ uniqueItems: true }),
        ...annotations
    });
}

/**
 * Validates that all first elements in an array of key-value tuples are unique according to Effect equality.
 *
 * @category validation
 * @since 1.0.0
 */
export function isUniqueKey<Key, Value>(annotations?: Annotations.Filter)
{
    return makeFilter<ReadonlyArray<readonly [
        Key,
        Value
    ]>>((input) => Arr.dedupe(input.map(([ key ]) => key)).length === input.length, {
        expected: "an array with unique keys",
        "~representation": {
            id: "effect/schema/isUniqueKey",
            payload: null
        },
        ...annotations
    });
}

/**
 * Type-level representation of {@link NonEmptyString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface NonEmptyString extends String
{
    readonly "Rebuild": NonEmptyString;
}

/**
 * Schema for non-empty strings. Validates that a string has at least one
 * character.
 *
 * @category schemas
 * @since 1.0.0
 */
export const NonEmptyString: NonEmptyString = String.check(isNonEmpty());

/**
 * Type-level representation of {@link Char}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Char extends String
{
    readonly "Rebuild": Char;
}

/**
 * Schema for strings whose JavaScript `length` is exactly `1`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Char: Char = String.check(isBetweenLength(1, 1));

/**
 * Type-level representation of {@link ErrorInstance}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ErrorInstance extends instanceOf<globalThis.Error>
{
    readonly "Rebuild": ErrorInstance;
}

/**
 * Options for {@link ErrorInstance} and {@link Defect}.
 *
 * @category options
 * @since 1.0.0
 */
export interface ErrorOptions
{
    /**
     * Includes string stack traces in encoded `Error` values when set to `true`.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly includeStack?: boolean | undefined;

    /**
     * Excludes `Error.cause` values from encoded `Error` values when set to
     * `true`.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly excludeCause?: boolean | undefined;
}

type NormalizedErrorOptions = {
    readonly includeStack: true;
} | {
    readonly excludeCause: true;
} | {
    readonly includeStack: true;
    readonly excludeCause: true;
};

type ErrorOptionsKey = 0 | 1 | 2 | 3;

const getErrorOptionsKey = (options?: ErrorOptions): ErrorOptionsKey => ((options?.includeStack === true ? 1 : 0) |
    (options?.excludeCause === true ? 2 : 0)) as ErrorOptionsKey;

const getErrorOptions = (key: ErrorOptionsKey): NormalizedErrorOptions | undefined =>
{
    switch (key)
    {
        case 0:
            return undefined;
        case 1:
            return { includeStack: true };
        case 2:
            return { excludeCause: true };
        case 3:
            return { includeStack: true,
                excludeCause: true };
    }
};

const errorSchemaCache: Array<ErrorInstance | undefined> = [];

/**
 * Schema for JavaScript `Error` objects.
 *
 * @category schemas
 * @since 1.0.0
 */
export function ErrorInstance(options?: ErrorOptions): ErrorInstance
{
    const key = getErrorOptionsKey(options);
    const cached = errorSchemaCache[key];
    if (cached !== undefined)
    {
        return cached;
    }

    const normalizedOptions = getErrorOptions(key);
    const schema = instanceOf(globalThis.Error, {
        "~representation": {
            id: "effect/schema/Error",
            payload: normalizedOptions ?? null
        },
        expected: "Error",
        toCodecJson: () => link<globalThis.Error>()(JsonError, SchemaTransformation.errorFromJsonError(normalizedOptions))
    });
    errorSchemaCache[key] = schema;
    return schema;
}

/**
 * Type-level representation of {@link Defect}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Defect extends decodeTo<Unknown, typeof Json>
{
    readonly "Rebuild": Defect;
}

const defectSchemaCache: Array<Defect | undefined> = [];

/**
 * Schema for unexpected defect values represented as `unknown` with a JSON
 * encoded form.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Defect(options?: ErrorOptions): Defect
{
    const key = getErrorOptionsKey(options);
    const cached = defectSchemaCache[key];
    if (cached !== undefined)
    {
        return cached;
    }

    const schema = Json.pipe(decodeTo(Unknown, SchemaTransformation.defectFromJson(getErrorOptions(key))));
    defectSchemaCache[key] = schema;
    return schema;
}

/**
 * Type-level representation returned by {@link ReadonlyMap}.
 *
 * @category models
 * @since 1.0.0
 */
export interface $ReadonlyMap<Key extends Constraint, Value extends Constraint> extends declareConstructor<globalThis.ReadonlyMap<Key["Type"], Value["Type"]>, globalThis.ReadonlyMap<Key["Encoded"], Value["Encoded"]>, readonly [
    Key,
    Value
], ReadonlyMapIso<Key, Value>>
{
    readonly "Rebuild": $ReadonlyMap<Key, Value>;
    readonly key: Key;
    readonly value: Value;
}

/**
 * Iso representation used for `ReadonlyMap` schemas: an array of readonly
 * `[key, value]` tuples using each entry schema's `Iso` type.
 *
 * @category utility types
 * @since 1.0.0
 */
export type ReadonlyMapIso<Key extends Constraint, Value extends Constraint> = ReadonlyArray<readonly [
    Key["Iso"],
    Value["Iso"]
]>;

/**
 * Schema for readonly maps whose keys and values conform to the provided
 * schemas.
 *
 * @category schemas
 * @since 1.0.0
 */
export function ReadonlyMap<Key extends Constraint, Value extends Constraint>(key: Key, value: Value): $ReadonlyMap<Key, Value>
{
    const schema = declareConstructor<globalThis.ReadonlyMap<Key["Type"], Value["Type"]>, globalThis.ReadonlyMap<Key["Encoded"], Value["Encoded"]>, ReadonlyMapIso<Key, Value>>()([ key, value ], ([ key, value ]) =>
    {
        const array = ArraySchema(Tuple([ key, value ]));
        return (input, ast, options) =>
        {
            if (input instanceof globalThis.Map)
            {
                return RResult.mapBoth(SchemaParser.decodeUnknownResult(array)([ ...input ], options), {
                    onSuccess: (array: ReadonlyArray<readonly [
                        Key["Type"],
                        Value["Type"]
                    ]>) => new globalThis.Map(array),
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "entries", issue, input, options)
                });
            }

            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        };
    }, {
        "~representation": {
            id: "effect/schema/ReadonlyMap",
            payload: null
        },
        expected: "ReadonlyMap",
        toCodec: ([ key, value ]) => link<globalThis.Map<Key["Encoded"], Value["Encoded"]>>()(ArraySchema(Tuple([ key, value ])), SchemaTransformation.transform({
            decode: (entries) => new globalThis.Map(entries),
            encode: (map) => [ ...map.entries() ]
        }))
    });
    return make(schema.ast, { key,
        value });
}

/**
 * Type-level representation returned by {@link ReadonlySet}.
 *
 * @category models
 * @since 1.0.0
 */
export interface $ReadonlySet<Value extends Constraint> extends declareConstructor<globalThis.ReadonlySet<Value["Type"]>, globalThis.ReadonlySet<Value["Encoded"]>, readonly [
    Value
], ReadonlySetIso<Value>>
{
    readonly "Rebuild": $ReadonlySet<Value>;
    readonly value: Value;
}

/**
 * Iso representation used for `ReadonlySet` schemas: an array of element values
 * using the element schema's `Iso` type.
 *
 * @category utility types
 * @since 1.0.0
 */
export type ReadonlySetIso<Value extends Constraint> = ReadonlyArray<Value["Iso"]>;

/**
 * Schema for readonly sets whose values conform to the provided element schema.
 *
 * @category schemas
 * @since 1.0.0
 */
export function ReadonlySet<Value extends Constraint>(value: Value): $ReadonlySet<Value>
{
    const schema = declareConstructor<globalThis.ReadonlySet<Value["Type"]>, globalThis.ReadonlySet<Value["Encoded"]>, ReadonlySetIso<Value>>()([ value ], ([ value ]) =>
    {
        const array = ArraySchema(value);
        return (input, ast, options) =>
        {
            if (input instanceof globalThis.Set)
            {
                return RResult.mapBoth(SchemaParser.decodeUnknownResult(array)([ ...input ], options), {
                    onSuccess: (array: ReadonlyArray<Value["Type"]>) => new globalThis.Set(array),
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "values", issue, input, options)
                });
            }

            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        };
    }, {
        "~representation": {
            id: "effect/schema/ReadonlySet",
            payload: null
        },
        expected: "ReadonlySet",
        toCodec: ([ value ]) => link<globalThis.Set<Value["Encoded"]>>()(ArraySchema(value), SchemaTransformation.transform({
            decode: (values) => new globalThis.Set(values),
            encode: (set) => [ ...set.values() ]
        }))
    });
    return make(schema.ast, { value });
}

/**
 * Type-level representation of {@link RegExp}.
 *
 * @category models
 * @since 1.0.0
 */
export interface RegExp extends instanceOf<globalThis.RegExp>
{
    readonly "Rebuild": RegExp;
}

/**
 * Schema for JavaScript `RegExp` objects.
 *
 * @category schemas
 * @since 1.0.0
 */
export const RegExp: RegExp = instanceOf(globalThis.RegExp, {
    "~representation": {
        id: "effect/schema/RegExp",
        payload: null
    },
    expected: "RegExp",
    toCodecJson: () => link<globalThis.RegExp>()(Struct({
        source: String,
        flags: String
    }), SchemaTransformation.transformResult({
        decode: (e, options) => RResult.try({
            try: () => new globalThis.RegExp(e.source, e.flags),
            catch: () => new SchemaIssue.InvalidValue({ expected: "valid RegExp source and flags" }, e, options)
        }),
        encode: (regExp) => RResult.succeed({
            source: regExp.source,
            flags: regExp.flags
        })
    }))
});

/**
 * Type-level representation of {@link Date}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Date extends declare<globalThis.Date>
{
    readonly "Rebuild": Date;
}

const DateString = String.annotate({ expected: "a string that will be decoded as a Date" });

/**
 * Schema for valid JavaScript `Date` objects.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Date: Date = declare((input): input is globalThis.Date => input instanceof globalThis.Date && !globalThis.Number.isNaN(input.getTime()), {
    "~representation": {
        id: "effect/schema/Date",
        payload: null
    },
    expected: "a valid Date",
    toCodecJson: () => link<globalThis.Date>()(DateString, SchemaTransformation.dateFromString)
});

/**
 * Type-level representation of {@link DateFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface DateFromString extends decodeTo<Date, String>
{
    readonly "Rebuild": DateFromString;
}

/**
 * Schema that decodes a string into a JavaScript `Date`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const DateFromString: DateFromString = DateString.pipe(decodeTo(Date, SchemaTransformation.dateFromString));

/**
 * Type-level representation of {@link DateFromMillis}.
 *
 * @category models
 * @since 1.0.0
 */
export interface DateFromMillis extends decodeTo<Date, Int>
{
    readonly "Rebuild": DateFromMillis;
}

/**
 * Schema that decodes epoch milliseconds into a JavaScript `Date`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const DateFromMillis: DateFromMillis = Int.pipe(decodeTo(Date, SchemaTransformation.dateFromMillis));

/**
 * Type-level representation returned by {@link fromJsonString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface fromJsonString<S extends Constraint> extends decodeTo<S, String>
{
    readonly "Rebuild": fromJsonString<S>;
}

const JsonString = String.annotate({
    expected: "a string that will be decoded as JSON",
    contentMediaType: "application/json"
});

/**
 * Returns a schema that decodes a JSON string and then decodes the parsed value
 * using the given schema.
 *
 * @category schemas
 * @since 1.0.0
 */
export function fromJsonString<S extends Constraint>(schema: S, options?: {
    readonly reviver?: Parameters<typeof JSON.parse>[1] | undefined;
    readonly replacer?: SchemaGetter.JsonReplacer | undefined;
    readonly space?: Parameters<typeof JSON.stringify>[2] | undefined;
}): fromJsonString<S>
{
    return JsonString.pipe(decodeTo(schema, SchemaTransformation.fromJsonString(options)));
}

/**
 * Supports unknown from json string during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const UnknownFromJsonString: fromJsonString<Unknown> = fromJsonString(Unknown);

/**
 * Type-level representation of {@link NumberFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface NumberFromString extends decodeTo<Number, String>
{
    readonly "Rebuild": NumberFromString;
}

/**
 * Schema that parses a string into a `number` using JavaScript
 * number coercion.
 *
 * @category schemas
 * @since 1.0.0
 */
export const NumberFromString: NumberFromString = String.annotate({
    expected: "a string that will be decoded as a number"
}).pipe(decodeTo(Number, SchemaTransformation.numberFromString));

/**
 * Type-level representation of {@link FiniteFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface FiniteFromString extends decodeTo<Finite, String>
{
    readonly "Rebuild": FiniteFromString;
}

/**
 * Schema that parses a string into a finite number.
 *
 * @category schemas
 * @since 1.0.0
 */
export const FiniteFromString: FiniteFromString = String.annotate({
    expected: "a string that will be decoded as a finite number"
}).pipe(decodeTo(Finite, SchemaTransformation.numberFromString));

/**
 * Type-level representation of {@link BigIntFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface BigIntFromString extends decodeTo<BigInt, String>
{
    readonly "Rebuild": BigIntFromString;
}

/**
 * Schema that parses a string into a `bigint`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const BigIntFromString: BigIntFromString = make<String>(SchemaAST.bigIntString).pipe(decodeTo(BigInt, SchemaTransformation.bigintFromString));

/**
 * Type-level representation of {@link Trimmed}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Trimmed extends String
{
    readonly "Rebuild": Trimmed;
}

/**
 * Schema for strings that contains no leading or trailing whitespaces.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Trimmed: Trimmed = String.check(isTrimmed());

/**
 * Type-level representation of {@link Trim}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Trim extends decodeTo<Trimmed, String>
{
    readonly "Rebuild": Trim;
}

/**
 * Schema that trims whitespace from a string.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Trim: Trim = String.annotate({
    expected: "a string that will be decoded as a trimmed string"
}).pipe(decodeTo(Trimmed, SchemaTransformation.trim()));

/**
 * Type-level representation of {@link StringFromBase64}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StringFromBase64 extends decodeTo<String, String>
{
    readonly "Rebuild": StringFromBase64;
}

/**
 * Decodes a base64 (RFC4648) encoded string into a UTF-8 string.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StringFromBase64: StringFromBase64 = String.annotate({
    expected: "a base64 encoded string that will be decoded as a UTF-8 string"
}).pipe(decodeTo(String, SchemaTransformation.stringFromBase64String));

/**
 * Type-level representation of {@link StringFromBase64Url}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StringFromBase64Url extends decodeTo<String, String>
{
    readonly "Rebuild": StringFromBase64Url;
}

/**
 * Decodes a base64 (URL) encoded string into a UTF-8 string.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StringFromBase64Url: StringFromBase64Url = String.annotate({
    expected: "a base64 (URL) encoded string that will be decoded as a UTF-8 string"
}).pipe(decodeTo(String, SchemaTransformation.stringFromBase64UrlString));

/**
 * Type-level representation of {@link StringFromHex}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StringFromHex extends decodeTo<String, String>
{
    readonly "Rebuild": StringFromHex;
}

/**
 * Decodes a hex encoded string into a UTF-8 string.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StringFromHex: StringFromHex = String.annotate({
    expected: "a hex encoded string that will be decoded as a UTF-8 string"
}).pipe(decodeTo(String, SchemaTransformation.stringFromHexString));

/**
 * Type-level representation of {@link StringFromUriComponent}.
 *
 * @category models
 * @since 1.0.0
 */
export interface StringFromUriComponent extends decodeTo<String, String>
{
    readonly "Rebuild": StringFromUriComponent;
}

/**
 * Decodes a URI component encoded string into a UTF-8 string.
 * Can be used to store data in a URL.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StringFromUriComponent: StringFromUriComponent = String.annotate({
    expected: "a URI component encoded string that will be decoded as a UTF-8 string"
}).pipe(decodeTo(String, SchemaTransformation.stringFromUriComponent));

/**
 * Schema for property keys accepted by Effect schemas: finite `number`,
 * `symbol`, or `string`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const PropertyKey: Union<readonly [
    Finite,
    Symbol,
    String
]> = Union([ Finite, Symbol, String ]);

/**
 * Schema for a Standard Schema v1 failure result.
 *
 * @category schemas
 * @since 1.0.0
 */
export const StandardSchemaV1FailureResult: Struct<{
    readonly issues: $Array<Struct<{
        readonly message: String;
        readonly path: optional<$Array<Union<readonly [
            Union<readonly [
                Finite,
                Symbol,
                String
            ]>,
            Struct<{
                readonly key: Union<readonly [
                    Finite,
                    Symbol,
                    String
                ]>;
            }>
        ]>>>;
    }>>;
}> = Struct({
    issues: ArraySchema(Struct({
        message: String,
        path: optional(ArraySchema(Union([ PropertyKey, Struct({ key: PropertyKey }) ])))
    }))
});

/**
 * Type-level representation of {@link BooleanFromBit}.
 *
 * @category models
 * @since 1.0.0
 */
export interface BooleanFromBit extends decodeTo<Boolean, Literals<readonly [
    0,
    1
]>>
{
    readonly "Rebuild": BooleanFromBit;
}

/**
 * Schema for a boolean parsed from 0 or 1.
 *
 * @category schemas
 * @since 1.0.0
 */
export const BooleanFromBit: BooleanFromBit = Literals([ 0, 1 ]).pipe(decodeTo(Boolean, SchemaTransformation.transform({
    decode: (bit) => bit === 1,
    encode: (bool) => bool ? 1 : 0
})));

/**
 * Type-level representation of {@link Uint8Array}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Uint8Array extends instanceOf<globalThis.Uint8Array>
{
    readonly "Rebuild": Uint8Array;
}

const Base64String = String.annotate({
    expected: "a base64 encoded string that will be decoded as Uint8Array",
    format: "byte",
    contentEncoding: "base64"
});

/**
 * Schema for JavaScript `Uint8Array` objects.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Uint8Array: Uint8Array = instanceOf((globalThis.Uint8Array<ArrayBufferLike>), {
    "~representation": {
        id: "effect/schema/Uint8Array",
        payload: null
    },
    expected: "Uint8Array",
    toCodecJson: () => link<globalThis.Uint8Array<ArrayBufferLike>>()(Base64String, SchemaTransformation.uint8ArrayFromBase64String)
});

/**
 * Type-level representation of {@link Uint8ArrayFromBase64}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Uint8ArrayFromBase64 extends decodeTo<Uint8Array, String>
{
    readonly "Rebuild": Uint8ArrayFromBase64;
}

/**
 * Schema that decodes a base64 encoded string into a
 * `Uint8Array`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Uint8ArrayFromBase64: Uint8ArrayFromBase64 = Base64String.pipe(decodeTo(Uint8Array, SchemaTransformation.uint8ArrayFromBase64String));

/**
 * Type-level representation of {@link Uint8ArrayFromBase64Url}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Uint8ArrayFromBase64Url extends decodeTo<Uint8Array, String>
{
    readonly "Rebuild": Uint8ArrayFromBase64Url;
}

/**
 * Schema that decodes a base64 (URL) encoded string into a
 * `Uint8Array`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Uint8ArrayFromBase64Url: Uint8ArrayFromBase64Url = String.annotate({
    expected: "a base64 (URL) encoded string that will be decoded as a Uint8Array"
}).pipe(decodeTo(Uint8Array, {
    decode: SchemaGetter.decodeBase64Url(),
    encode: SchemaGetter.encodeBase64Url()
}));

/**
 * Type-level representation of {@link Uint8ArrayFromHex}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Uint8ArrayFromHex extends decodeTo<Uint8Array, String>
{
    readonly "Rebuild": Uint8ArrayFromHex;
}

/**
 * Schema that decodes a hex encoded string into a
 * `Uint8Array`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Uint8ArrayFromHex: Uint8ArrayFromHex = String.annotate({
    expected: "a hex encoded string that will be decoded as a Uint8Array"
}).pipe(decodeTo(Uint8Array, {
    decode: SchemaGetter.decodeHex(),
    encode: SchemaGetter.encodeHex()
}));

// -----------------------------------------------------------------------------
// BigDecimal schemas
// -----------------------------------------------------------------------------
const bigDecimalFromString: SchemaTransformation.Transformation<BigDecimal_.BigDecimal, string> = SchemaTransformation
    .transformResult<BigDecimal_.BigDecimal, string>({
        decode: (s, options) =>
        {
            const result = BigDecimal_.fromString(s);
            return Option_.isNone(result)
                ? RResult.fail(new SchemaIssue.InvalidValue({ expected: "a valid BigDecimal string" }, s, options))
                : RResult.succeed(result.value);
        },
        encode: (bd) => RResult.succeed(BigDecimal_.format(bd))
    });

/**
 * Validates that a BigDecimal is greater than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanBigDecimal: (exclusiveMinimum: BigDecimal_.BigDecimal, annotations?: Annotations.Filter) => SchemaAST.Filter<BigDecimal_.BigDecimal> = makeIsGreaterThan({
    order: BigDecimal_.Order,
    formatter: (bd) => BigDecimal_.format(bd)
});

/**
 * Validates that a BigDecimal is greater than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isGreaterThanOrEqualToBigDecimal: (minimum: BigDecimal_.BigDecimal, annotations?: Annotations.Filter) => SchemaAST.Filter<BigDecimal_.BigDecimal> = makeIsGreaterThanOrEqualTo({
    order: BigDecimal_.Order,
    formatter: (bd) => BigDecimal_.format(bd)
});

/**
 * Validates that a BigDecimal is less than the specified value (exclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanBigDecimal: (exclusiveMaximum: BigDecimal_.BigDecimal, annotations?: Annotations.Filter) => SchemaAST.Filter<BigDecimal_.BigDecimal> = makeIsLessThan({
    order: BigDecimal_.Order,
    formatter: (bd) => BigDecimal_.format(bd)
});

/**
 * Validates that a BigDecimal is less than or equal to the specified value
 * (inclusive).
 *
 * @category validation
 * @since 1.0.0
 */
export const isLessThanOrEqualToBigDecimal: (maximum: BigDecimal_.BigDecimal, annotations?: Annotations.Filter) => SchemaAST.Filter<BigDecimal_.BigDecimal> = makeIsLessThanOrEqualTo({
    order: BigDecimal_.Order,
    formatter: (bd) => BigDecimal_.format(bd)
});

/**
 * Validates that a `BigDecimal` is within a specified range.
 *
 * @category validation
 * @since 1.0.0
 */
export const isBetweenBigDecimal: (options: {
    readonly minimum: BigDecimal_.BigDecimal;
    readonly maximum: BigDecimal_.BigDecimal;
    readonly exclusiveMinimum?: boolean | undefined;
    readonly exclusiveMaximum?: boolean | undefined;
}, annotations?: Annotations.Filter) => SchemaAST.Filter<BigDecimal_.BigDecimal> = makeIsBetween({
    order: BigDecimal_.Order,
    formatter: (bd) => BigDecimal_.format(bd)
});

/**
 * Type-level representation of {@link BigDecimal}.
 *
 * @category models
 * @since 1.0.0
 */
export interface BigDecimal extends declare<BigDecimal_.BigDecimal>
{
    readonly "Rebuild": BigDecimal;
}

const BigDecimalString = String.annotate({ expected: "a string that will be decoded as a BigDecimal" });

/**
 * Schema for `BigDecimal` values.
 *
 * @category schemas
 * @since 1.0.0
 */
export const BigDecimal: BigDecimal = declare(BigDecimal_.isBigDecimal, {
    "~representation": {
        id: "effect/schema/BigDecimal",
        payload: null
    },
    expected: "BigDecimal",
    toCodecJson: () => link<BigDecimal_.BigDecimal>()(BigDecimalString, bigDecimalFromString),
    toFormatter: () => (bd) => BigDecimal_.format(bd)
});

/**
 * Type-level representation of {@link BigDecimalFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface BigDecimalFromString extends decodeTo<BigDecimal, String>
{
    readonly "Rebuild": BigDecimalFromString;
}

/**
 * Schema that parses a string into a `BigDecimal`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const BigDecimalFromString: BigDecimalFromString = BigDecimalString.pipe(decodeTo(BigDecimal, bigDecimalFromString));

// -----------------------------------------------------------------------------
// ByteSize schemas
// -----------------------------------------------------------------------------

/**
 * Type-level representation of {@link ByteSize}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ByteSize extends declare<ByteSize_.ByteSize>
{
    readonly "Rebuild": ByteSize;
}

/**
 * Schema for exact, non-negative `ByteSize` values.
 *
 * @category schemas
 * @since 1.0.0
 */
export const ByteSize: ByteSize = declare(ByteSize_.isByteSize, {
    "~representation": {
        id: "effect/schema/ByteSize",
        payload: null
    },
    expected: "ByteSize",
    toCodecJson: () => link<ByteSize_.ByteSize>()(BigInt.check(isGreaterThanOrEqualToBigInt(globalThis.BigInt(0))), SchemaTransformation.transform({
        decode: ByteSize_.bytes,
        encode: ByteSize_.toBigInt
    }))

});

const ByteSizeString = String.annotate({ expected: "a string that will be decoded as a ByteSize" });

/**
 * Type-level representation of {@link ByteSizeFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ByteSizeFromString extends decodeTo<ByteSize, String>
{
    readonly "Rebuild": ByteSizeFromString;
}

/**
 * Schema that decodes byte-size strings into exact, non-negative `ByteSize`
 * values.
 *
 * @category schemas
 * @since 1.0.0
 */
export const ByteSizeFromString: ByteSizeFromString = ByteSizeString.pipe(decodeTo(ByteSize, SchemaTransformation.byteSizeFromString));

/**
 * Type-level representation of {@link ByteSizeFromBigInt}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ByteSizeFromBigInt extends decodeTo<ByteSize, BigInt>
{
    readonly "Rebuild": ByteSizeFromBigInt;
}

/**
 * Schema that decodes non-negative bigint byte counts.
 *
 * @category schemas
 * @since 1.0.0
 */
export const ByteSizeFromBigInt: ByteSizeFromBigInt = BigInt.pipe(decodeTo(ByteSize, SchemaTransformation.byteSizeFromBigInt));

/**
 * Type-level representation of {@link ByteSizeFromNumber}.
 *
 * @category models
 * @since 1.0.0
 */
export interface ByteSizeFromNumber extends decodeTo<ByteSize, Number>
{
    readonly "Rebuild": ByteSizeFromNumber;
}

/**
 * Schema that decodes non-negative safe-integer byte counts.
 *
 * @category schemas
 * @since 1.0.0
 */
export const ByteSizeFromNumber: ByteSizeFromNumber = Number.pipe(decodeTo(ByteSize, SchemaTransformation.byteSizeFromNumber));

// -----------------------------------------------------------------------------
// Chunk schemas
// -----------------------------------------------------------------------------

/**
 * Supports chunk link during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function chunkLink<Value>(values: Schema<ReadonlyArray<Value>>)
{
    return link<Chunk_.Chunk<Value>>()(values, SchemaTransformation.transform({
        decode: Chunk_.fromIterable,
        encode: Arr.fromIterable
    }));
}

/**
 * Type-level representation returned by {@link Chunk}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Chunk<Value extends Constraint> extends declareConstructor<Chunk_.Chunk<Value["Type"]>, Chunk_.Chunk<Value["Encoded"]>, readonly [
    Value
], ChunkIso<Value>>
{
    readonly "Rebuild": Chunk<Value>;
    readonly value: Value;
}

/**
 * Iso representation used for `Chunk` schemas: an array of element values using
 * the element schema's `Iso` type.
 *
 * @category utility types
 * @since 1.0.0
 */
export type ChunkIso<Value extends Constraint> = ReadonlyArray<Value["Iso"]>;

/**
 * Schema for chunks whose values conform to the provided element schema.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Chunk<Value extends Constraint>(value: Value): Chunk<Value>
{
    const schema = declareConstructor<Chunk_.Chunk<Value["Type"]>, Chunk_.Chunk<Value["Encoded"]>, ChunkIso<Value>>()([ value ], ([ value ]) =>
    {
        const values = ArraySchema(value);
        return (input, ast, options) =>
        {
            if (Chunk_.isChunk(input))
            {
                return RResult.mapBoth(SchemaParser.decodeUnknownResult(values)(Arr.fromIterable(input), options), {
                    onSuccess: Chunk_.fromIterable,
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "values", issue, input, options)
                });
            }

            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        };
    }, {
        "~representation": {
            id: "effect/schema/Chunk",
            payload: null
        },
        expected: "Chunk",
        toCodec: ([ value ]) => chunkLink(ArraySchema(value)),
        toEquivalence: ([ value ]) => Chunk_.makeEquivalence(value)
    });
    return make(schema.ast, { value });
}

// -----------------------------------------------------------------------------
// Duration schemas
// -----------------------------------------------------------------------------
const durationFromString: SchemaTransformation.Transformation<Duration_.Duration, string> = SchemaTransformation
    .transformResult<Duration_.Duration, string>({
        decode: (s, options) => Option_.match(Duration_.fromInput(s as Duration_.Input), {
            onNone: () => RResult.fail(new SchemaIssue.InvalidValue({ expected: "a valid Duration string" }, s, options)),
            onSome: RResult.succeed
        }),
        encode: (duration) => RResult.succeed(globalThis.String(duration))
    });

const durationFromNanos: SchemaTransformation.Transformation<Duration_.Duration, bigint> = SchemaTransformation
    .transformResult({
        decode: (i) => RResult.succeed(Duration_.nanos(i)),
        encode: (a, options) => Option_.match(Duration_.toNanos(a), {
            onNone: () => RResult.fail(new SchemaIssue.InvalidValue({ expected: "a Duration representable as a bigint" }, a, options)),
            onSome: (nanos) => RResult.succeed(nanos)
        })
    });

const durationFromMillis: SchemaTransformation.Transformation<Duration_.Duration, number> = SchemaTransformation
    .transform({
        decode: (i) => Duration_.millis(i),
        encode: (a) => Duration_.toMillis(a)
    });

/**
 * Type-level representation of {@link Duration}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Duration extends declare<Duration_.Duration>
{
    readonly "Rebuild": Duration;
}

/**
 * Schema for `Duration` values.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Duration: Duration = declare(Duration_.isDuration, {
    "~representation": {
        id: "effect/schema/Duration",
        payload: null
    },
    expected: "Duration",
    toCodecJson: () => link<Duration_.Duration>()(Union([
        Struct({ _tag: Literal("Infinity") }),
        Struct({ _tag: Literal("NegativeInfinity") }),
        Struct({ _tag: Literal("Nanos"),
            value: BigInt }),
        Struct({ _tag: Literal("Millis"),
            value: Int })
    ]), SchemaTransformation.transform({
        decode: (e) =>
        {
            switch (e._tag)
            {
                case "Infinity":
                    return Duration_.infinity;
                case "NegativeInfinity":
                    return Duration_.negativeInfinity;
                case "Nanos":
                    return Duration_.nanos(e.value);
                case "Millis":
                    return Duration_.millis(e.value);
            }
        },
        encode: (duration) =>
        {
            switch (duration.value._tag)
            {
                case "Infinity":
                    return { _tag: "Infinity" } as const;
                case "NegativeInfinity":
                    return { _tag: "NegativeInfinity" } as const;
                case "Nanos":
                    return { _tag: "Nanos",
                        value: duration.value.nanos } as const;
                case "Millis":
                    return { _tag: "Millis",
                        value: duration.value.millis } as const;
            }
        }
    }))
});

const DurationString = String.annotate({ expected: "a string that will be decoded as a Duration" });

/**
 * Type-level representation of {@link DurationFromString}.
 *
 * @category models
 * @since 1.0.0
 */
export interface DurationFromString extends decodeTo<Duration, String>
{
    readonly "Rebuild": DurationFromString;
}

/**
 * Schema that parses a string into a `Duration`.
 *
 * @category schemas
 * @since 1.0.0
 */
export const DurationFromString: DurationFromString = DurationString.pipe(decodeTo(Duration, durationFromString));

/**
 * Type-level representation of {@link DurationFromNanos}.
 *
 * @category models
 * @since 1.0.0
 */
export interface DurationFromNanos extends decodeTo<Duration, BigInt>
{
    readonly "Rebuild": DurationFromNanos;
}

/**
 * Schema that decodes a `bigint` into a `Duration`, treating the bigint as
 * nanoseconds.
 *
 * @category schemas
 * @since 1.0.0
 */
export const DurationFromNanos: DurationFromNanos = BigInt.pipe(decodeTo(Duration, durationFromNanos));

/**
 * Type-level representation of {@link DurationFromMillis}.
 *
 * @category models
 * @since 1.0.0
 */
export interface DurationFromMillis extends decodeTo<Duration, Number>
{
    readonly "Rebuild": DurationFromMillis;
}

/**
 * Schema that decodes a number into a `Duration`, treating the number as
 * milliseconds.
 *
 * @category schemas
 * @since 1.0.0
 */
export const DurationFromMillis: DurationFromMillis = Number.pipe(decodeTo(Duration, durationFromMillis));

// -----------------------------------------------------------------------------
// HashMap schemas
// -----------------------------------------------------------------------------

/**
 * Supports hash map link during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function hashMapLink<Key, Value>(entries: Schema<ReadonlyArray<readonly [
    Key,
    Value
]>>)
{
    return link<HashMap_.HashMap<Key, Value>>()(entries, SchemaTransformation.transform({
        decode: HashMap_.fromIterable,
        encode: HashMap_.toEntries
    }));
}

/**
 * Type-level representation returned by {@link HashMap}.
 *
 * @category models
 * @since 1.0.0
 */
export interface HashMap<Key extends Constraint, Value extends Constraint> extends declareConstructor<HashMap_.HashMap<Key["Type"], Value["Type"]>, HashMap_.HashMap<Key["Encoded"], Value["Encoded"]>, readonly [
    Key,
    Value
], HashMapIso<Key, Value>>
{
    readonly "Rebuild": HashMap<Key, Value>;
    readonly key: Key;
    readonly value: Value;
}

/**
 * Iso representation used for `HashMap` schemas: an array of readonly
 * `[key, value]` tuples using each entry schema's `Iso` type.
 *
 * @category utility types
 * @since 1.0.0
 */
export type HashMapIso<Key extends Constraint, Value extends Constraint> = ReadonlyArray<readonly [
    Key["Iso"],
    Value["Iso"]
]>;

/**
 * Schema for hash maps whose keys and values conform to the provided schemas.
 *
 * @category schemas
 * @since 1.0.0
 */
export function HashMap<Key extends Constraint, Value extends Constraint>(key: Key, value: Value): HashMap<Key, Value>
{
    const schema = declareConstructor<HashMap_.HashMap<Key["Type"], Value["Type"]>, HashMap_.HashMap<Key["Encoded"], Value["Encoded"]>, HashMapIso<Key, Value>>()([ key, value ], ([ key, value ]) =>
    {
        const entries = ArraySchema(Tuple([ key, value ]));
        return (input, ast, options) =>
        {
            if (HashMap_.isHashMap(input))
            {
                return RResult.mapBoth(SchemaParser.decodeUnknownResult(entries)(HashMap_.toEntries(input), options), {
                    onSuccess: HashMap_.fromIterable,
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "entries", issue, input, options)
                });
            }

            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        };
    }, {
        "~representation": {
            id: "effect/schema/HashMap",
            payload: null
        },
        expected: "HashMap",
        toCodec: ([ key, value ]) => hashMapLink(ArraySchema(Tuple([ key, value ]))),
        toEquivalence: ([ key, value ]) => Equal.makeCompareMap(key, value)
    });
    return make(schema.ast, { key,
        value });
}

// -----------------------------------------------------------------------------
// HashSet schemas
// -----------------------------------------------------------------------------

/**
 * Supports hash set link during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function hashSetLink<Value>(values: Schema<ReadonlyArray<Value>>)
{
    return link<HashSet_.HashSet<Value>>()(values, SchemaTransformation.transform({
        decode: HashSet_.fromIterable,
        encode: Arr.fromIterable
    }));
}

/**
 * Type-level representation returned by {@link HashSet}.
 *
 * @category models
 * @since 1.0.0
 */
export interface HashSet<Value extends Constraint> extends declareConstructor<HashSet_.HashSet<Value["Type"]>, HashSet_.HashSet<Value["Encoded"]>, readonly [
    Value
], HashSetIso<Value>>
{
    readonly "Rebuild": HashSet<Value>;
    readonly value: Value;
}

/**
 * Iso representation used for `HashSet` schemas: an array of element values
 * using the element schema's `Iso` type.
 *
 * @category utility types
 * @since 1.0.0
 */
export type HashSetIso<Value extends Constraint> = ReadonlyArray<Value["Iso"]>;

/**
 * Schema for hash sets whose values conform to the provided element schema.
 *
 * @category schemas
 * @since 1.0.0
 */
export function HashSet<Value extends Constraint>(value: Value): HashSet<Value>
{
    const schema = declareConstructor<HashSet_.HashSet<Value["Type"]>, HashSet_.HashSet<Value["Encoded"]>, HashSetIso<Value>>()([ value ], ([ value ]) =>
    {
        const values = ArraySchema(value);
        return (input, ast, options) =>
        {
            if (HashSet_.isHashSet(input))
            {
                return RResult.mapBoth(SchemaParser.decodeUnknownResult(values)(Arr.fromIterable(input), options), {
                    onSuccess: HashSet_.fromIterable,
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "values", issue, input, options)
                });
            }

            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        };
    }, {
        "~representation": {
            id: "effect/schema/HashSet",
            payload: null
        },
        expected: "HashSet",
        toCodec: ([ value ]) => hashSetLink(ArraySchema(value)),
        toEquivalence: ([ value ]) => Equal.makeCompareSet(value)
    });
    return make(schema.ast, { value });
}

// -----------------------------------------------------------------------------
// Option schemas
// -----------------------------------------------------------------------------

/**
 * Type-level representation returned by {@link Option}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Option<A extends Constraint> extends declareConstructor<Option_.Option<A["Type"]>, Option_.Option<A["Encoded"]>, readonly [
    A
], OptionIso<A>>
{
    readonly "Rebuild": Option<A>;
    readonly value: A;
}

/**
 * Iso representation used for `Option` schemas.
 *
 * @category utility types
 * @since 1.0.0
 */
export type OptionIso<A extends Constraint> = {
    readonly _tag: "None";
} | {
    readonly _tag: "Some";
    readonly value: A["Iso"];
};

/**
 * Schema for `Option<A>` values.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Option<A extends Constraint>(value: A): Option<A>
{
    const schema = declareConstructor<Option_.Option<A["Type"]>, Option_.Option<A["Encoded"]>, OptionIso<A>>()([ value ], ([ value ]) => (input, ast, options) =>
    {
        if (Option_.isOption(input))
        {
            if (Option_.isNone(input))
            {
                return RResult.succeed(Option_.none());
            }

            return RResult.mapBoth(SchemaParser.decodeUnknownResult(value)(input.value, options), {
                onSuccess: Option_.some,
                onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "value", issue, input, options)
            });
        }

        return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
    }, {
        "~representation": {
            id: "effect/schema/Option",
            payload: null
        },
        expected: "Option",
        toCodec: ([ value ]) => link<Option_.Option<A["Encoded"]>>()(Union([
            Struct({ _tag: Literal("Some"),
                value }),
            Struct({ _tag: Literal("None") })
        ]), SchemaTransformation.transform({
            decode: (e) => e._tag === "None" ? Option_.none() : Option_.some(e.value),
            encode: (o) => (Option_.isSome(o) ? { _tag: "Some",
                value: o.value } as const : { _tag: "None" } as const)
        }))
    });
    return make(schema.ast, { value });
}

/**
 * Type-level representation returned by {@link OptionFromNullOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromNullOr<S extends Constraint> extends decodeTo<Option<toType<S>>, NullOr<S>>
{
    readonly "Rebuild": OptionFromNullOr<S>;
}

/**
 * Decodes a nullable, required value `T` to a required `Option<T>` value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromNullOr<S extends Constraint>(schema: S): OptionFromNullOr<S>
{
    return NullOr(schema).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.optionFromNullOr()));
}

/**
 * Type-level representation returned by {@link OptionFromUndefinedOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromUndefinedOr<S extends Constraint> extends decodeTo<Option<toType<S>>, UndefinedOr<S>>
{
    readonly "Rebuild": OptionFromUndefinedOr<S>;
}

/**
 * Decodes a required value that may be `undefined` to a required `Option<T>`
 * value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromUndefinedOr<S extends Constraint>(schema: S): OptionFromUndefinedOr<S>
{
    return UndefinedOr(schema).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.optionFromUndefinedOr()));
}

/**
 * Type-level representation returned by {@link OptionFromNullishOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromNullishOr<S extends Constraint> extends decodeTo<Option<toType<S>>, NullishOr<S>>
{
    readonly "Rebuild": OptionFromNullishOr<S>;
}

/**
 * Decodes a nullish value `T` to a required `Option<T>` value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromNullishOr<S extends Constraint>(schema: S, options?: {
    onNoneEncoding: null | undefined;
}): OptionFromNullishOr<S>
{
    return NullishOr(schema).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.optionFromNullishOr(options)));
}

/**
 * Type-level representation returned by {@link OptionFromOptionalKey}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromOptionalKey<S extends Constraint> extends decodeTo<Option<toType<S>>, optionalKey<S>>
{
    readonly "Rebuild": OptionFromOptionalKey<S>;
}

/**
 * Decodes an optional value `A` to a required `Option<A>` value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromOptionalKey<S extends Constraint>(schema: S): OptionFromOptionalKey<S>
{
    return optionalKey(schema).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.optionFromOptionalKey()));
}

/**
 * Type-level representation returned by {@link OptionFromOptional}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromOptional<S extends Constraint> extends decodeTo<Option<toType<S>>, optional<S>>
{
    readonly "Rebuild": OptionFromOptional<S>;
}

/**
 * Decodes an optional or `undefined` value `A` to a required `Option<A>`
 * value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromOptional<S extends Constraint>(schema: S): OptionFromOptional<S>
{
    return optional(schema).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.optionFromOptional<any>()));
}

/**
 * Type-level representation returned by {@link OptionFromOptionalNullOr}.
 *
 * @category models
 * @since 1.0.0
 */
export interface OptionFromOptionalNullOr<S extends Constraint> extends decodeTo<Option<toType<S>>, optional<NullOr<S>>>
{
    readonly "Rebuild": OptionFromOptionalNullOr<S>;
}

/**
 * Decodes an optional or `null` or `undefined` value `A` to a required `Option<A>`
 * value.
 *
 * @category schemas
 * @since 1.0.0
 */
export function OptionFromOptionalNullOr<S extends Constraint>(schema: S, options?: {
    readonly onNoneEncoding: "omit" | null | undefined;
}): OptionFromOptionalNullOr<S>
{
    const onNoneEncoding = options === undefined ? "omit" : options.onNoneEncoding;
    const noneValue = onNoneEncoding === null
        ? null as S["Type"] | null | undefined
        : undefined as S["Type"] | null | undefined;
    return optional(NullOr(schema)).pipe(decodeTo(Option(toType(schema)), SchemaTransformation.transformOptional<Option_.Option<S["Type"]>, S["Type"] | null | undefined>({
        decode: (oe) => oe.pipe(Option_.filter(Predicate.isNotNullish), Option_.some),
        encode: onNoneEncoding === "omit"
            ? Option_.flatten
            : (ot) => Option_.some(Option_.getOrElse(Option_.flatten(ot), () => noneValue))
    })));
}

// -----------------------------------------------------------------------------
// Redacted schemas
// -----------------------------------------------------------------------------

/**
 * Type-level representation returned by {@link Redacted}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Redacted<S extends Constraint> extends declareConstructor<Redacted_.Redacted<S["Type"]>, Redacted_.Redacted<S["Encoded"]>, readonly [
    S
]>
{
    readonly "Rebuild": Redacted<S>;
    readonly value: S;
}

type NormalizedRedactedOptions = {
    readonly label: string;
} | {
    readonly disallowJsonEncode: true;
} | {
    readonly label: string;
    readonly disallowJsonEncode: true;
};

/**
 * Schema for `Redacted` values, which hide their contents from inspection.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Redacted<S extends Constraint>(value: S, options?: {
    readonly label?: string | undefined;
    readonly disallowJsonEncode?: boolean | undefined;
}): Redacted<S>
{
    const label = typeof options?.label === "string" ? options.label : undefined;
    const disallowJsonEncode = options?.disallowJsonEncode === true;
    const normalizedOptions: NormalizedRedactedOptions | undefined = label !== undefined
        ? disallowJsonEncode ? { label,
            disallowJsonEncode: true } : { label }
        : disallowJsonEncode
            ? { disallowJsonEncode: true }
            : undefined;
    const decodeLabel = label !== undefined
        ? SchemaParser.decodeUnknownResult(Literal(label))
        : undefined;
    const schema = declareConstructor<Redacted_.Redacted<S["Type"]>, Redacted_.Redacted<S["Encoded"]>>()([ value ], ([ value ]) => (input, ast, poptions) =>
    {
        if (Redacted_.isRedacted(input))
        {
            const label: RResult.Result<unknown, SchemaIssue.Issue> = decodeLabel !== undefined
                ? RResult.mapError(decodeLabel(input.label, poptions), (issue) => new SchemaIssue.Pointer([ "label" ], issue))
                : RResult.succeed(undefined);
            return RResult.flatMap(label, () => RResult.mapBoth(SchemaParser.decodeUnknownResult(value)(Redacted_.value(input), poptions), {
                onSuccess: (value) => Redacted_.make(value, { label: input.label }),
                onFailure: () =>
                {
                    return new SchemaIssue.Composite(ast, [
                        new SchemaIssue.Pointer([ "value" ], new SchemaIssue.InvalidValue(undefined, input, poptions))
                    ], input, poptions);
                }
            }));
        }

        return RResult.fail(new SchemaIssue.InvalidType(ast, input, poptions));
    }, {
        "~representation": {
            id: "effect/schema/Redacted",
            payload: normalizedOptions ?? null
        },
        expected: "Redacted",
        toCodecJson: ([ value ]) => link<Redacted_.Redacted<S["Encoded"]>>()(value, {
            decode: SchemaGetter.transform((e) => Redacted_.make(e, { label })),
            encode: disallowJsonEncode ?
                SchemaGetter.forbidden((oe) => "Cannot serialize Redacted" +
                    (Option_.isSome(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) :
                SchemaGetter.transform(Redacted_.value)
        }),
        toEquivalence: ([ value ]) => Redacted_.makeEquivalence(value)
    });
    return make(schema.ast, { value });
}

/**
 * Type-level representation returned by {@link RedactedFromValue}.
 *
 * @category models
 * @since 1.0.0
 */
export interface RedactedFromValue<S extends Constraint> extends decodeTo<Redacted<toType<S>>, S>
{
    readonly "Rebuild": RedactedFromValue<S>;
}

/**
 * Decodes a value and wraps it in `Redacted<A>`. Unlike {@link Redacted} which
 * expects the input to already be a `Redacted` instance, this schema decodes
 * the raw value and wraps it.
 *
 * @category schemas
 * @since 1.0.0
 */
export function RedactedFromValue<S extends Constraint>(value: S, options?: {
    readonly label?: string | undefined;
    readonly disallowEncode?: boolean | undefined;
}): RedactedFromValue<S>
{
    return decodeTo<Redacted<toType<S>>, S>(Redacted(toType(value), {
        label: options?.label,
        disallowJsonEncode: options?.disallowEncode
    }), {
        decode: SchemaGetter.transform((t) => Redacted_.make(t, { label: options?.label })),
        encode: options?.disallowEncode ?
            SchemaGetter.forbidden((oe) => "Cannot encode Redacted" +
                (Option_.isSome(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) :
            SchemaGetter.transform(Redacted_.value)
    })(value);
}

// -----------------------------------------------------------------------------
// Result schemas
// -----------------------------------------------------------------------------

/**
 * Type-level representation returned by {@link Result}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Result<A extends Constraint, E extends Constraint> extends declareConstructor<Result_.Result<A["Type"], E["Type"]>, Result_.Result<A["Encoded"], E["Encoded"]>, readonly [
    A,
    E
], ResultIso<A, E>>
{
    readonly "Rebuild": Result<A, E>;
    readonly success: A;
    readonly failure: E;
}

/**
 * Iso representation used for `Result` schemas.
 *
 * @category utility types
 * @since 1.0.0
 */
export type ResultIso<A extends Constraint, E extends Constraint> = {
    readonly _tag: "Success";
    readonly success: A["Iso"];
} | {
    readonly _tag: "Failure";
    readonly failure: E["Iso"];
};

/**
 * Schema for `Result<A, E>` values.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Result<A extends Constraint, E extends Constraint>(success: A, failure: E): Result<A, E>
{
    const schema = declareConstructor<Result_.Result<A["Type"], E["Type"]>, Result_.Result<A["Encoded"], E["Encoded"]>, ResultIso<A, E>>()([ success, failure ], ([ success, failure ]) => (input, ast, options) =>
    {
        if (!Result_.isResult(input))
        {
            return RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        }

        switch (input._tag)
        {
            case "Success":
                return RResult.mapBoth(SchemaParser.decodeResult(success)(input.success, options), {
                    onSuccess: Result_.succeed,
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "success", issue, input, options)
                });
            case "Failure":
                return RResult.mapBoth(SchemaParser.decodeResult(failure)(input.failure, options), {
                    onSuccess: Result_.fail,
                    onFailure: (issue) => SchemaIssue.makeCompositeAtKey(ast, "failure", issue, input, options)
                });
        }
    }, {
        "~representation": {
            id: "effect/schema/Result",
            payload: null
        },
        expected: "Result",
        toCodec: ([ success, failure ]) => link<Result_.Result<A["Encoded"], E["Encoded"]>>()(Union([
            Struct({ _tag: Literal("Success"),
                success }),
            Struct({ _tag: Literal("Failure"),
                failure })
        ]), SchemaTransformation.transform({
            decode: (e): Result_.Result<A["Encoded"], E["Encoded"]> => e._tag === "Success" ? Result_.succeed(e.success) : Result_.fail(e.failure),
            encode: (r) => Result_.isSuccess(r)
                ? { _tag: "Success",
                    success: r.success } as const
                : { _tag: "Failure",
                    failure: r.failure } as const
        }))
    });
    return make(schema.ast, { success,
        failure });
}

/**
 * Type-level representation returned by {@link Class}.
 *
 * @category models
 * @since 1.0.0
 */
export interface Class<Self, S extends Constraint &
{
    readonly fields: Struct.Fields;
}, Inherited> extends BottomLazyWithoutNew<SchemaAST.Declaration, decodeTo<declareConstructor<Self, S["Encoded"], readonly [
        S
    ], S["Iso"]>, S>, readonly [
        S
    ], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]> {
    /**
     * `make` and `makeOption` preserve an existing instance of
     * this class. Use `new` when a distinct instance is required.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly "Type": Self;
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": RequiredKeys<S["~type.make.in"]> extends never ? void | S["~type.make.in"] : S["~type.make.in"];
    readonly "~type.make": Self;
    readonly "Iso": S["Iso"];
    new (...args: {} extends S["~type.make.in"] ? [
        props?: S["~type.make.in"],
        options?: MakeOptions
    ] : [
        props: S["~type.make.in"],
        options?: MakeOptions
    ]): S["Type"] & Inherited;
    readonly identifier: string;
    readonly fields: S["fields"];

    /**
     * Returns a new struct with the fields modified by the provided function.
     *
     * @category Utilities
     * @since 1.0.0
     */
    mapFields<To extends Struct.Fields>(f: (fields: S["fields"]) => To, options?: {
        readonly unsafePreserveChecks?: boolean | undefined;
    } | undefined): Struct<Simplify<Readonly<To>>>;

    /**
     * Returns a function that creates a schema-backed subclass with this class's
     * fields plus additional fields.
     *
     * @category Utilities
     * @since 1.0.0
     */
    extend<Extended = never, Static = {}, Brand = {}>(identifier: string): {
        <NewFields extends Struct.Fields>(fields: NewFields, annotations?: Annotations.Declaration<Extended, readonly [
            Struct<Simplify<Assign<S["fields"], NewFields>>>
        ]>): [
            Extended
        ] extends [
            never
        ] ? MissingSelfGeneric<"Base.extend"> : InheritStaticMembers<Class<Extended, Struct<Simplify<Assign<S["fields"], NewFields>>>, Self & Brand>, Static>;
        <Extension extends Struct<Struct.Fields>>(schema: Extension, annotations?: Annotations.Declaration<Extended, readonly [
            Struct<Simplify<Assign<S["fields"], Extension["fields"]>>>
        ]>): [
            Extended
        ] extends [
            never
        ] ? MissingSelfGeneric<"Base.extend"> : InheritStaticMembers<Class<Extended, Struct<Simplify<Assign<S["fields"], Extension["fields"]>>>, Self & Brand>, Static>;
    };
}

type InheritStaticMembers<C, Static> = C & Pick<Static, Exclude<keyof Static, keyof C>>;

type MissingSelfGeneric<Usage extends string> = `Missing \`Self\` generic - use \`class Self extends ${Usage}<Self>(...)\``;

const immerable: unique symbol = globalThis.Symbol.for("immer-draftable") as any;

const payloadToken = {};

/**
 * Supports make class during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeClass<Self, S extends Struct<Struct.Fields>, Inherited extends new (...args: ReadonlyArray<any>) => any>(Inherited: Inherited, identifier: string, struct: S, annotations: Annotations.Declaration<Self, readonly [
    S
]> | undefined, proto: ((identifier: string) => object) | undefined): any
{
    const getClassSchema = getClassSchemaFactory(struct, identifier, annotations);
    const ClassTypeId = getClassTypeId(identifier); // HMR support
    const out = class extends Inherited
    {
        constructor(...[ input, options ]: ReadonlyArray<any>)
        {
            const internalOptions = options as MakeOptions | undefined;
            const payload = internalOptions?.["~payload"];
            const value = payload?.token === payloadToken
                ? payload.value
                : struct.make(input ?? {}, options);
            super(value, { ...options,
                disableChecks: true,
                "~payload": { token: payloadToken,
                    value } });
        }
        static readonly [TypeId] = TypeId;
        get [ClassTypeId]()
        {
            return ClassTypeId;
        }
        static readonly [immerable] = true;
        static readonly identifier = identifier;
        static readonly fields = struct.fields;
        static get ast(): SchemaAST.Declaration
        {
            return getClassSchema(this).ast;
        }
        static pipe()
        {
            return Pipeable.pipeArguments(this, arguments);
        }
        static rebuild(ast: SchemaAST.Declaration)
        {
            return getClassSchema(this).rebuild(ast);
        }
        static make(input: S["~type.make.in"], options?: MakeOptions): Self
        {
            return SchemaParser.make(getClassSchema(this) as any)(input ?? {}, options) as Self;
        }
        static makeOption(input: S["~type.make.in"], options?: MakeOptions): Option_.Option<Self>
        {
            return SchemaParser.makeOption(getClassSchema(this) as any)(input ?? {}, options) as any;
        }
        static annotate(annotations: Annotations.Declaration<Self, readonly [
            S
        ]>)
        {
            return this.rebuild(SchemaAST.annotate(this.ast, annotations));
        }
        static annotateKey(annotations: Annotations.Key<Self>)
        {
            return this.rebuild(SchemaAST.annotateKey(this.ast, annotations));
        }
        static check(...checks: readonly [
            SchemaAST.Check<Self>,
            ...Array<SchemaAST.Check<Self>>
        ])
        {
            return this.rebuild(SchemaAST.appendChecks(this.ast, checks));
        }
        static extend(identifier: string)
        {
            return (schema: Struct.Fields | Struct<Struct.Fields>, annotations?: Annotations.Declaration<any, readonly [
                any
            ]>) =>
            {
                const extension = isStruct(schema) ? schema : Struct(schema);
                const fields = { ...struct.fields,
                    ...extension.fields };
                const ast = SchemaAST.struct(fields, struct.ast.checks, { identifier });
                return makeClass(this, identifier, makeStruct(SchemaAST.appendChecks(ast, extension.ast.checks), fields), annotations, proto);
            };
        }
        static mapFields<To extends Struct.Fields>(f: (fields: S["fields"]) => To, options?: {
            readonly unsafePreserveChecks?: boolean | undefined;
        } | undefined): Struct<Simplify<Readonly<To>>>
        {
            return struct.mapFields(f, options);
        }
    };
    if (proto !== undefined)
    {
        Object.assign(out.prototype, proto(identifier));
    }

    return out;
}

/**
 * Supports get class transformation during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function getClassTransformation(self: new (...args: ReadonlyArray<any>) => any)
{
    return new SchemaTransformation.Transformation<any, any, never, never>(SchemaGetter.transform((input) => new self(input, {
        "~payload": {
            token: payloadToken,
            value: input
        }
    })), SchemaGetter.passthrough());
}

/**
 * Supports get class type id during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function getClassTypeId(identifier: string)
{
    return `~effect/Schema/Class/${identifier}`;
}

/**
 * Supports get class schema factory during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function getClassSchemaFactory<S extends Constraint>(from: S, identifier: string, annotations: Annotations.Declaration<any, readonly [
    S
]> | undefined)
{
    let memo: decodeTo<declareConstructor<any, S["Encoded"], readonly [
        S
    ]>, S> | undefined;
    return <Self extends (new (...args: ReadonlyArray<any>) => any) & {
        readonly identifier: string;
    }>(self: Self): decodeTo<declareConstructor<Self, S["Encoded"], readonly [
        S
    ]>, S> =>
    {
        if (memo !== undefined)
        {
            return memo;
        }

        const ClassTypeId = getClassTypeId(identifier);
        const isClassValue: Predicate.Predicate<unknown> = (input) => input instanceof self || Predicate.hasProperty(input, ClassTypeId);
        const transformation = getClassTransformation(self);
        const to = make<declareConstructor<Self, S["Encoded"], readonly [
            S
        ]>>(new SchemaAST.Declaration([ from.ast ], () => (input, ast, options) =>
        {
            return isClassValue(input) ?
                RResult.succeed(input) :
                RResult.fail(new SchemaIssue.InvalidType(ast, input, options));
        }, {
            identifier,
            [InternalAnnotations.ConstructorAnnotationKey]: ([ from ]: readonly [
                SchemaAST.AST
            ]): SchemaAST.ConstructorDescriptor => ({
                isConstructed: isClassValue,
                link: new SchemaAST.Link(from, transformation)
            }),
            toCodec: ([ from ]: readonly [
                ConstraintCodec<S["Encoded"], S["Encoded"]>
            ]) => new SchemaAST.Link(from.ast, transformation),
            toEquivalence: ([ from ]: readonly [
                Equivalence.Equivalence<S["Type"]>
            ]) => from,
            toFormatter: ([ from ]: readonly [
                Formatter<S["Type"]>
            ]) => (t: Self) => `${self.identifier}(${from(t)})`,
            [InternalAnnotations.SentinelsAnnotationKey]: SchemaAST.collectSentinels(from.ast),
            ...annotations
        }));
        return memo = decodeTo<declareConstructor<Self, S["Encoded"], readonly [
            S
        ]>, S>(to, transformation)(from);
    };
}

/**
 * Supports is struct during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function isStruct(schema: Struct.Fields | Struct<Struct.Fields>): schema is Struct<Struct.Fields>
{
    return isSchema(schema);
}

/**
 * Creates a schema-backed class whose constructor validates input against a
 * {@link Struct} schema. Construction throws an `Error` with a
 * `SchemaIssue.Issue` in its `cause` on invalid input.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Class: {
    /**
     * Creates a schema-backed class whose constructor validates input against a
     * {@link Struct} schema. Construction throws an `Error` with a
     * `SchemaIssue.Issue` in its `cause` on invalid input.
     *
     * @category constructors
     * @since 1.0.0
     */
    <Self = never, Brand = {}>(identifier: string): {
        /**
         * Creates a schema-backed class whose constructor validates input against a
         * {@link Struct} schema. Construction throws an `Error` with a
         * `SchemaIssue.Issue` in its `cause` on invalid input.
         *
         * @category constructors
         * @since 1.0.0
         */
        <const Fields extends Struct.Fields>(fields: Fields, annotations?: Annotations.Declaration<Self, readonly [
            Struct<Fields>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.Class"> : Class<Self, Struct<Fields>, Brand>;

        /**
         * Creates a schema-backed class whose constructor validates input against a
         * {@link Struct} schema. Construction throws an `Error` with a
         * `SchemaIssue.Issue` in its `cause` on invalid input.
         *
         * @category constructors
         * @since 1.0.0
         */
        <S extends Struct<Struct.Fields>>(schema: S, annotations?: Annotations.Declaration<Self, readonly [
            S
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.Class"> : Class<Self, S, Brand>;
    };
} = <Self, Brand = {}>(identifier: string) => (schema: Struct.Fields | Struct<Struct.Fields>, annotations?: Annotations.Declaration<Self, readonly [
    Struct<Struct.Fields>
]>): [
    Self
] extends [
    never
] ? MissingSelfGeneric<"Schema.Class"> : Class<Self, Struct<Struct.Fields>, Brand> =>
{
    const struct = isStruct(schema) ? schema : Struct(schema);
    return makeClass(Data.Class, identifier, struct, annotations, (identifier) => ({
        toString()
        {
            return `${identifier}(${format({ ...this })})`;
        }
    }));
};

/**
 * Defines a schema-backed class with an automatically populated `_tag` field.
 *
 * @category constructors
 * @since 1.0.0
 */
export const TaggedClass: {
    /**
     * Defines a schema-backed class with an automatically populated `_tag` field.
     *
     * @category constructors
     * @since 1.0.0
     */
    <Self = never, Brand = {}>(identifier?: string): {
        /**
         * Defines a schema-backed class with an automatically populated `_tag` field.
         *
         * @category constructors
         * @since 1.0.0
         */
        <Tag extends string, const Fields extends Struct.Fields>(tag: Tag, fields: Fields, annotations?: Annotations.Declaration<Self, readonly [
            TaggedStruct<Tag, Fields>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.TaggedClass"> : Class<Self, TaggedStruct<Tag, Fields>, Brand>;

        /**
         * Defines a schema-backed class with an automatically populated `_tag` field.
         *
         * @category constructors
         * @since 1.0.0
         */
        <Tag extends string, S extends Struct<Struct.Fields>>(tag: Tag, schema: S, annotations?: Annotations.Declaration<Self, readonly [
            Struct<Simplify<{
                readonly _tag: tag<Tag>;
            } & S["fields"]>>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.TaggedClass"> : Class<Self, Struct<Simplify<{
            readonly _tag: tag<Tag>;
        } & S["fields"]>>, Brand>;
    };
} = (identifier?: string) =>
{
    return (tagValue: string, schema: Struct.Fields | Struct<Struct.Fields>, annotations?: Annotations.Declaration<any, readonly [
        Struct<Struct.Fields>
    ]>): any =>
    {
        const struct = isStruct(schema) ?
            schema.mapFields((fields) => ({ _tag: tag(tagValue),
                ...fields }), {
                unsafePreserveChecks: true
            }) :
            TaggedStruct(tagValue, schema);
        return Class<any, {}>(identifier ?? tagValue)(struct, annotations as Annotations.Declaration<any, readonly [
            typeof struct
        ]>);
    };
};

/**
 * Creates a schema-backed error class that can be used as a typed,
 * yieldable error in Effect programs. Combines {@link Class} validation with
 * the `YieldableError` interface so instances can be yielded directly inside
 * `Effect.gen`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Error: {
    /**
     * Creates a schema-backed error class that can be used as a typed,
     * yieldable error in Effect programs. Combines {@link Class} validation with
     * the `YieldableError` interface so instances can be yielded directly inside
     * `Effect.gen`.
     *
     * @category constructors
     * @since 1.0.0
     */
    <Self = never, Brand = {}>(identifier: string): {
        /**
         * Creates a schema-backed error class that can be used as a typed,
         * yieldable error in Effect programs. Combines {@link Class} validation with
         * the `YieldableError` interface so instances can be yielded directly inside
         * `Effect.gen`.
         *
         * @category constructors
         * @since 1.0.0
         */
        <const Fields extends Struct.Fields>(fields: Fields, annotations?: Annotations.Declaration<Self, readonly [
            Struct<Fields>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.Error"> : Class<Self, Struct<Fields>, DataError & Brand>;

        /**
         * Creates a schema-backed error class that can be used as a typed,
         * yieldable error in Effect programs. Combines {@link Class} validation with
         * the `YieldableError` interface so instances can be yielded directly inside
         * `Effect.gen`.
         *
         * @category constructors
         * @since 1.0.0
         */
        <S extends Struct<Struct.Fields>>(schema: S, annotations?: Annotations.Declaration<Self, readonly [
            S
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.Error"> : Class<Self, S, DataError & Brand>;
    };
} = <Self, Brand = {}>(identifier: string) => (schema: Struct.Fields | Struct<Struct.Fields>, annotations?: Annotations.Declaration<Self, readonly [
    Struct<Struct.Fields>
]>): [
    Self
] extends [
    never
] ? MissingSelfGeneric<"Schema.Error"> : Class<Self, Struct<Struct.Fields>, DataError & Brand> =>
{
    const struct = isStruct(schema) ? schema : Struct(schema);
    const self = makeClass(Data.Error, identifier, struct, annotations, (identifier) => ({
        name: identifier
    }));
    return self;
};

/**
 * Defines a schema-backed yieldable error class with an automatically populated
 * `_tag` field.
 *
 * @category constructors
 * @since 1.0.0
 */
export const TaggedError: {
    /**
     * Defines a schema-backed yieldable error class with an automatically populated
     * `_tag` field.
     *
     * @category constructors
     * @since 1.0.0
     */
    <Self = never, Brand = {}>(identifier?: string): {
        /**
         * Defines a schema-backed yieldable error class with an automatically populated
         * `_tag` field.
         *
         * @category constructors
         * @since 1.0.0
         */
        <Tag extends string, const Fields extends Struct.Fields>(tag: Tag, fields: Fields, annotations?: Annotations.Declaration<Self, readonly [
            TaggedStruct<Tag, Fields>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.TaggedError"> : Class<Self, TaggedStruct<Tag, Fields>, DataError & Brand>;

        /**
         * Defines a schema-backed yieldable error class with an automatically populated
         * `_tag` field.
         *
         * @category constructors
         * @since 1.0.0
         */
        <Tag extends string, S extends Struct<Struct.Fields>>(tag: Tag, schema: S, annotations?: Annotations.Declaration<Self, readonly [
            Struct<Simplify<{
                readonly _tag: tag<Tag>;
            } & S["fields"]>>
        ]>): [
            Self
        ] extends [
            never
        ] ? MissingSelfGeneric<"Schema.TaggedError"> : Class<Self, Struct<Simplify<{
            readonly _tag: tag<Tag>;
        } & S["fields"]>>, DataError & Brand>;
    };
} = (identifier?: string) =>
{
    return (tagValue: string, schema: Struct.Fields | Struct<Struct.Fields>, annotations?: Annotations.Declaration<any, readonly [
        Struct<Struct.Fields>
    ]>): any =>
    {
        const struct = isStruct(schema) ?
            schema.mapFields((fields) => ({ _tag: tag(tagValue),
                ...fields }), {
                unsafePreserveChecks: true
            }) :
            TaggedStruct(tagValue, schema);
        return Error<any, {}>(identifier ?? tagValue)(struct, annotations as Annotations.Declaration<any, readonly [
            typeof struct
        ]>);
    };
};

/**
 * Attaches a custom formatter used by `toFormatter`.
 *
 * @category formatting
 * @since 1.0.0
 */
export function overrideToFormatter<S extends Top>(toFormatter: () => Formatter<S["Type"]>)
{
    return (self: S): S["Rebuild"] => self.annotate({ toFormatter });
}

/**
 * Derives a string formatter function from a schema. The formatter converts
 * a value to its human-readable string representation, recursing into structs,
 * arrays, and unions.
 *
 * @category formatting
 * @since 1.0.0
 */
export function toFormatter<S extends Constraint>(schema: S, options?: {
    readonly onBefore?: ((ast: SchemaAST.AST, recur: (ast: SchemaAST.AST) => Formatter<any>) => Formatter<any> | undefined) | undefined;
}): Formatter<S["Type"]>
{
    return InternalToFormatter.toFormatter(schema.ast, options);
}

/**
 * Overrides the equivalence derivation for a schema by supplying a custom
 * `Equivalence`.
 *
 * @category instances
 * @since 1.0.0
 */
export function overrideToEquivalence<S extends Top>(toEquivalence: () => Equivalence.Equivalence<S["Type"]>)
{
    return (self: S): S["Rebuild"] => self.annotate({ toEquivalence });
}

/**
 * Derives an `Equivalence` from a schema. Two values are considered equal when
 * every field (and nested field) compares equal according to the schema
 * structure.
 *
 * @category instances
 * @since 1.0.0
 */
export function toEquivalence<T>(schema: Schema<T>): Equivalence.Equivalence<T>
{
    return InternalEquivalence.toEquivalence(schema.ast);
}

/**
 * Options for reference allocation and JSON Schema generation in {@link toJsonSchemaDocument}.
 *
 * @category options
 * @since 1.0.0
 */
export interface ToJsonSchemaOptions extends SchemaRepresentation.ToRepresentationOptions
{
    /**
     * Controls whether generated object schemas accept properties that are not
     * modeled by the Effect schema.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly onExcessProperty?: "ignore" | "error" | undefined;

    /**
     * Controls whether to generate descriptions for checks (if the user has not
     * provided them) based on the `expected` annotation of the check.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly generateDescriptions?: boolean | undefined;

    /**
     * A predicate that controls which additional annotation keys (beyond the
     * standard JSON Schema keys) are included in the generated output.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly includeAnnotationKey?: ((key: string) => boolean) | undefined;
}

/**
 * Returns a JSON Schema document using draft 2020-12.
 *
 * @category converting
 * @since 1.0.0
 */
export function toJsonSchemaDocument(schema: Constraint, options?: ToJsonSchemaOptions): JsonSchema.Document<"draft-2020-12">
{
    const document = InternalToRepresentation.toRepresentation(InternalToCodec.toCodecJsonAST(schema.ast), options);
    return InternalToJsonSchemaDocument.toJsonSchemaDocument(document, options);
}

/**
 * Type-level representation returned by {@link toCodecJson}.
 *
 * @category converting
 * @since 1.0.0
 */
export interface toCodecJson<S extends Constraint> extends BottomLazy<S["ast"], toCodecJson<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": Json;
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
    readonly schema: S;
}

/**
 * Derives a canonical JSON codec from a schema. The encoded form is `Json`, and
 * decoding produces the schema's `Type`.
 *
 * @category converting
 * @since 1.0.0
 */
export const toCodecJson: {
    /**
     * Derives a canonical JSON codec from a schema. The encoded form is `Json`, and
     * decoding produces the schema's `Type`.
     *
     * @category converting
     * @since 1.0.0
     */
    <S extends Constraint>(schema: S): toCodecJson<S>;
} = InternalToCodec.toCodecJson;

/**
 * Type-level representation returned by {@link toCodecArrayFromSingle}.
 *
 * @category converting
 * @since 1.0.0
 */
export interface toCodecArrayFromSingle<S extends Constraint> extends BottomLazy<S["ast"], toCodecArrayFromSingle<S>, S["~type.parameters"], S["~type.mutability"], S["~type.optionality"], S["~type.constructor.default"], S["~encoded.mutability"], S["~encoded.optionality"]>
{
    readonly "Type": S["Type"];
    readonly "Encoded": S["Encoded"];
    readonly "DecodingServices": never;
    readonly "EncodingServices": never;
    readonly "~type.make.in": S["~type.make.in"];
    readonly "~type.make": S["~type.make"];
    readonly "Iso": S["Iso"];
}

/**
 * Allows array schemas to decode from either an array input or a single value
 * input.
 *
 * @category converting
 * @since 1.0.0
 */
export const toCodecArrayFromSingle: {
    /**
     * Allows array schemas to decode from either an array input or a single value
     * input.
     *
     * @category converting
     * @since 1.0.0
     */
    <S extends Constraint>(schema: S): toCodecArrayFromSingle<S>;
} = InternalToCodec.toCodecArrayFromSingle;

/**
 * Recursive tree type whose leaves are `Node` values and whose branches are
 * readonly arrays or string-keyed records of child trees.
 *
 * @category models
 * @since 1.0.0
 */
export type Tree<Node> = Node | TreeRecord<Node> | ReadonlyArray<Tree<Node>>;

/**
 * A record node in a {@link Tree}: an object mapping string keys to child
 * `Tree` nodes.
 *
 * @category models
 * @since 1.0.0
 */
export interface TreeRecord<A>
{
    readonly [x: string]: Tree<A>;
}

/**
 * Creates a recursive schema for a {@link Tree} of values described by `node`.
 * The resulting schema accepts a single node value, an array of trees, or an
 * object whose values are trees.
 *
 * @category schemas
 * @since 1.0.0
 */
export function Tree<S extends Constraint>(node: S)
{
    const Tree$ref = suspend((): Codec<Tree<S["Type"]>, Tree<S["Encoded"]>, S["DecodingServices"], S["EncodingServices"]> => Tree);
    const Tree = Union([
        node,
        ArraySchema(Tree$ref),
        Record(String, Tree$ref)
    ]);
    return Tree;
}

/**
 * Recursive TypeScript type for any valid immutable JSON value: `null`,
 * `number`, `boolean`, `string`, a readonly array of `Json` values, or a
 * readonly record of `string → Json`. For the corresponding schema, see the
 * {@link Json} const.
 *
 * @category models
 * @since 1.0.0
 */
export type Json = null | number | boolean | string | JsonArray | JsonObject;

/**
 * A readonly array of {@link Json} values.
 *
 * @category models
 * @since 1.0.0
 */
export interface JsonArray extends ReadonlyArray<Json>
{
}

/**
 * A readonly record whose values are {@link Json} values.
 *
 * @category models
 * @since 1.0.0
 */
export interface JsonObject
{
    readonly [x: string]: Json;
}

/**
 * Schema that accepts and validates any immutable JSON-compatible value.
 *
 * @category schemas
 * @since 1.0.0
 */
export const Json: Codec<Json> = make(SchemaAST.annotate(SchemaAST.Json, {}));

/**
 * Schema for readonly string-keyed records whose values are JSON-compatible.
 *
 * @category schemas
 * @since 1.0.0
 */
export const JsonObject: $Record<String, Codec<Json, Json, never, never>> = Record(String, Json);

/**
 * Recursive TypeScript type for mutable JSON values: `null`, `number`,
 * `boolean`, `string`, mutable arrays, or mutable string-keyed records.
 *
 * @category models
 * @since 1.0.0
 */
export type MutableJson = null | number | boolean | string | MutableJsonArray | MutableJsonObject;

/**
 * A mutable array of {@link MutableJson} values.
 *
 * @category models
 * @since 1.0.0
 */
export interface MutableJsonArray extends Array<MutableJson>
{
}

/**
 * A mutable record whose values are {@link MutableJson} values.
 *
 * @category models
 * @since 1.0.0
 */
export interface MutableJsonObject
{
    [x: string]: MutableJson;
}

const JsonError = Struct({
    message: String,
    name: optionalKey(String),
    stack: optionalKey(String),
    cause: optionalKey(Json)
});

/**
 * Schema that accepts any mutable JSON-compatible value. See {@link Json} for
 * the immutable variant.
 *
 * @category schemas
 * @since 1.0.0
 */
export const MutableJson: Codec<MutableJson> = make(SchemaAST.annotate(SchemaAST.MutableJson, {}));

/**
 * Resolves the typed annotations from a schema. The term "resolve" (rather
 * than "get") reflects the lookup strategy: if the schema has checks, the
 * annotations are taken from the last check; otherwise they are taken from
 * the base schema instance.
 *
 * @category getters
 * @since 1.0.0
 */
export function resolveAnnotations<S extends Constraint>(schema: S): Annotations.Bottom<S["Type"], S["~type.parameters"]> | undefined
{
    return InternalAnnotations.resolve(schema.ast);
}

/**
 * Resolves the context (key-level) annotations from a schema. Context
 * annotations are those attached via `annotateKey` and live on the AST's
 * `context` rather than on the schema node itself.
 *
 * @category getters
 * @since 1.0.0
 */
export function resolveAnnotationsKey<S extends Constraint>(schema: S): Annotations.Key<S["Type"]> | undefined
{
    return schema.ast.context?.annotations;
}

/**
 * The `Annotations` namespace groups all annotation interfaces used to attach
 * metadata to schemas. Annotations control documentation, validation messages,
 * JSON Schema generation, equivalence, arbitrary generation, and more.
 *
 * @category models
 * @since 1.0.0
 */
export declare namespace Annotations
{
    /**
     * This interface is used to define the annotations that can be attached to a
     * schema. You can extend this interface to define your own annotations.
     *
     * @category models
     * @since 1.0.0
     */
    interface Annotations
    {
        readonly [x: string]: unknown;
    }

    /**
     * Annotations shared by all schema nodes. These map to common JSON Schema /
     * OpenAPI fields: `title`, `description`, `format`, etc.
     *
     * @category models
     * @since 1.0.0
     */
    interface Augment extends Annotations
    {
        /**
         * Human-readable description of what a value is expected to satisfy.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly expected?: string | undefined;
        readonly title?: string | undefined;
        readonly description?: string | undefined;
        readonly documentation?: string | undefined;
        readonly readOnly?: boolean | undefined;
        readonly writeOnly?: boolean | undefined;
        readonly format?: string | undefined;
        readonly contentEncoding?: string | undefined;
        readonly contentMediaType?: string | undefined;
        readonly contentSchema?: Json | undefined;
    }

    /**
     * Extends {@link Augment} with type-parametric `default` and `examples` fields.
     *
     * @category models
     * @since 1.0.0
     */
    interface Documentation<T> extends Augment
    {
        readonly default?: T | undefined;
        readonly examples?: ReadonlyArray<T> | undefined;
    }

    /**
     * Annotations for struct property schemas. Extends {@link Documentation}
     * with an optional `messageMissingKey` to override the error message when
     * the property key is absent during decoding.
     *
     * @category models
     * @since 1.0.0
     */
    interface Key<T> extends Documentation<T>
    {
        /**
         * The message to use when a key is missing.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly messageMissingKey?: string | undefined;
    }

    /**
     * Base annotations shared by all composite schema nodes. Extends
     * {@link Documentation} with error messages and arbitrary generation hooks.
     * {@link Declaration} and other annotation
     * interfaces build on top of this.
     *
     * @category models
     * @since 1.0.0
     */
    interface Bottom<T, TypeParameters extends ReadonlyArray<Constraint>> extends Documentation<T>
    {
        /**
         * Complete message to use when this schema node reports an issue.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly message?: string | undefined;

        /**
         * The message to use when a key is unexpected.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly messageUnexpectedKey?: string | undefined;

        /**
         * Stable identifier for this schema node.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly identifier?: string | undefined;
    }

    /**
     * Helpers for projecting declaration type-parameter schemas into decoded or
     * encoded codec arrays used by annotation hooks.
     *
     * @category Utilities
     * @since 1.0.0
     */
    namespace TypeParameters
    {
        /**
         * Maps declaration type-parameter schemas to codecs for their decoded `Type`
         * values.
         *
         * @category utility types
         * @since 1.0.0
         */
        type Type<TypeParameters extends ReadonlyArray<Constraint>> = {
            readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Type"]>;
        };

        /**
         * Maps declaration type-parameter schemas to codecs for their `Encoded` values.
         *
         * @category utility types
         * @since 1.0.0
         */
        type Encoded<TypeParameters extends ReadonlyArray<Constraint>> = {
            readonly [K in keyof TypeParameters]: Codec<TypeParameters[K]["Encoded"]>;
        };
    }

    /**
     * Full annotation set for `Declaration` schema nodes — used when defining
     * custom, opaque schema types via `Schema.declare`. Extends {@link Bottom}
     * with optional codec, arbitrary, equivalence, and formatter hooks so that
     * derived capabilities (JSON encoding, property testing, etc.) can be
     * provided for the custom type.
     *
     * @category models
     * @since 1.0.0
     */
    interface Declaration<T, TypeParameters extends ReadonlyArray<Constraint> = readonly [
    ]> extends Bottom<T, TypeParameters>
    {

        /**
         * Returns the fallback link used by canonical codec derivations.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly toCodec?: ((typeParameters: TypeParameters.Encoded<TypeParameters>) => SchemaAST.Link) | undefined;

        /**
         * Returns the link used to derive the declaration's JSON representation, or
         * `undefined` when the declaration is already in canonical JSON form.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly toCodecJson?: ((typeParameters: TypeParameters.Encoded<TypeParameters>) => SchemaAST.Link | undefined) | undefined;

        /**
         * Returns the link used to derive the declaration's StringTree
         * representation, or `undefined` when it is already canonical.
         *
         * @category Utilities
         * @since 1.0.0
         */

        readonly toEquivalence?: ToEquivalence.Declaration<T, TypeParameters> | undefined;
        readonly toFormatter?: ToFormatter.Declaration<T, TypeParameters> | undefined;

        /**
         * Used to collect sentinels from a Declaration SchemaAST.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly "~sentinels"?: ReadonlyArray<SchemaAST.Sentinel> | undefined;
    }

    /**
     * Annotations for filter schema nodes (created via `Schema.filter`). Extends
     * {@link Augment} with an optional error message, identifier, and metadata.
     * Filters are intentionally non-parametric to keep them covariant.
     *
     * @category models
     * @since 1.0.0
     */
    interface Filter extends Augment
    {

        /**
         * Compiles this filter to a JSON Schema fragment.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly toJsonSchema?: SchemaRepresentation.ToJsonSchema.Check | undefined;

        /**
         * Complete message to use when this filter or refinement fails.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly message?: string | undefined;

        /**
         * Stable identifier for the schema after this filter is attached.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly identifier?: string | undefined;

        /**
         * Marks the filter as *structural*, meaning it applies to the shape or
         * structure of the container (e.g., array length, object keys) rather than
         * the contents.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly "~structural"?: boolean | undefined;
    }

    /**
     * Types used by formatter annotations to customize formatter derivation for
     * declaration schemas.
     *
     * @category Utilities
     * @since 1.0.0
     */
    namespace ToFormatter
    {
        /**
         * Hook signature for declaration schema formatter annotations.
         *
         * @category models
         * @since 1.0.0
         */
        interface Declaration<T, TypeParameters extends ReadonlyArray<Constraint>>
        {
            (typeParameters: {
                readonly [K in keyof TypeParameters]: Formatter<TypeParameters[K]["Type"]>;
            }): Formatter<T>;
        }
    }

    /**
     * Types used by equivalence annotations to customize equivalence derivation for
     * declaration schemas.
     *
     * @category Utilities
     * @since 1.0.0
     */
    namespace ToEquivalence
    {
        /**
         * Hook signature for declaration schema equivalence annotations.
         *
         * @category models
         * @since 1.0.0
         */
        interface Declaration<T, TypeParameters extends ReadonlyArray<Constraint>>
        {
            (typeParameters: {
                readonly [K in keyof TypeParameters]: Equivalence.Equivalence<TypeParameters[K]["Type"]>;
            }): Equivalence.Equivalence<T>;
        }
    }

    /**
     * Annotations that can be attached to schema issues.
     *
     * @category models
     * @since 1.0.0
     */
    interface Issue extends Annotations
    {
        /**
         * The expected value description for an `InvalidValue` issue.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly expected?: string | undefined;

        /**
         * The complete formatted message for the issue.
         *
         * @category Utilities
         * @since 1.0.0
         */
        readonly message?: string | undefined;
    }
}

