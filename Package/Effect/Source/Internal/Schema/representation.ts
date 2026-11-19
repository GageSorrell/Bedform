/**
 * A serializable representation of schemas: declaration, primitive, literal,
 * collection and union nodes with their checks and annotations. Adapted from
 * Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/representation
 *
 * @file      representation.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable sort-imports, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import type * as Schema from "../../Schema.js";
import type * as SchemaAST from "../../SchemaAST.js";
import type * as JsonSchema from "../../JsonSchema.js";

/**
 * Open persistence identity carried by declarations and opaque checks.
 *
 * @category Annotations
 * @since 1.0.0
 */
export interface RepresentationAnnotation
{
    readonly id: string
    readonly payload: Schema.Json
}

/**
 * Open persistence identity and schema dependencies carried by opaque checks.
 *
 * @category Annotations
 * @since 1.0.0
 */
export interface CheckRepresentationAnnotation<S> extends RepresentationAnnotation
{
    readonly schemas?: ReadonlyArray<S> | undefined
}

/**
 * Input and output contracts for JSON Schema compiler annotations.
 *
 * @category Combinator
 * @since 1.0.0
 */
export declare namespace ToJsonSchema
{
    /**
     * Input for a check compiler.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface CheckInput
    {
        readonly type: JsonSchema.Type | undefined
        readonly schemas: ReadonlyArray<JsonSchema.JsonSchema>
    }

    /**
     * The result of compiling a check to JSON Schema.
     *
     * @category Model
     * @since 1.0.0
     */
    export type CheckOutput =
        JsonSchema.JsonSchema | readonly [schema: JsonSchema.JsonSchema, approximate: true];

    /**
     * Compiles a check to a JSON Schema fragment.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Check = (input: CheckInput) => CheckOutput;
}

/**
 * Input and output contracts for code generation annotations.
 *
 * @category Combinator
 * @since 1.0.0
 */
export declare namespace Generation
{
    /**
     * Input for declaration code generation.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface DeclarationInput
    {
        readonly typeParameters: ReadonlyArray<Code>
    }

    /**
     * Output of declaration code generation.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface DeclarationOutput
    {
        readonly runtime: string
        readonly Type: string
        readonly importDeclarations?: ReadonlyArray<string> | undefined
    }

    /**
     * Declaration code generator.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Declaration = (input: DeclarationInput) => DeclarationOutput;

    /**
     * Input for check code generation.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface CheckInput
    {
        readonly schemas: ReadonlyArray<Code>
    }

    /**
     * Output of check code generation.
     *
     * @category Model
     * @since 1.0.0
     */
    export interface CheckOutput
    {
        readonly runtime: string
        readonly importDeclarations?: ReadonlyArray<string> | undefined
    }

    /**
     * Check code generator.
     *
     * @category Model
     * @since 1.0.0
     */
    export type Check = (input: CheckInput) => CheckOutput;
}

/**
 * A custom opaque declaration.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Declaration
{
    readonly _tag: "Declaration"
    readonly representation?: RepresentationAnnotation | undefined
    readonly annotations?: Schema.Annotations.Annotations | undefined
    readonly typeParameters: ReadonlyArray<Representation>
    readonly checks: ReadonlyArray<Check>
}

/**
 * A lazily resolved representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Suspend
{
    readonly _tag: "Suspend"
    readonly annotations?: Schema.Annotations.Annotations | undefined
    readonly checks: readonly []
    readonly thunk: Representation
}

/**
 * A named reference.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Reference
{
    readonly _tag: "Reference"
    readonly $ref: string
}

interface Keyword<Tag extends string>
{
    readonly _tag: Tag
    readonly annotations?: Schema.Annotations.Annotations | undefined
    readonly checks: ReadonlyArray<Check>
}

/**
 * The null keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Null extends Keyword<"Null"> {}

/**
 * The undefined keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Undefined extends Keyword<"Undefined"> {}

/**
 * The void keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Void extends Keyword<"Void"> {}

/**
 * The never keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Never extends Keyword<"Never"> {}

/**
 * The unknown keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Unknown extends Keyword<"Unknown"> {}

/**
 * The any keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Any extends Keyword<"Any"> {}

/**
 * A string representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface String extends Keyword<"String"> {}

/**
 * A number representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Number extends Keyword<"Number"> {}

/**
 * A boolean representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Boolean extends Keyword<"Boolean"> {}

/**
 * A bigint representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface BigInt extends Keyword<"BigInt"> {}

/**
 * A symbol representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Symbol extends Keyword<"Symbol"> {}

/**
 * A literal representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Literal extends Keyword<"Literal">
{
    readonly literal: SchemaAST.LiteralValue
}

/**
 * A unique symbol representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface UniqueSymbol extends Keyword<"UniqueSymbol">
{
    readonly symbol: symbol
}

/**
 * The object keyword representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ObjectKeyword extends Keyword<"ObjectKeyword"> {}

/**
 * An enum representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Enum extends Keyword<"Enum">
{
    readonly enums: ReadonlyArray<readonly [string, string | number]>
}

/**
 * A template literal representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface TemplateLiteral extends Keyword<"TemplateLiteral">
{
    readonly parts: ReadonlyArray<Representation>
}

/**
 * A tuple element.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Element
{
    readonly isOptional: boolean
    readonly type: Representation
    readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * An array or tuple representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Arrays extends Keyword<"Arrays">
{
    readonly elements: ReadonlyArray<Element>
    readonly rest: ReadonlyArray<Representation>
}

/**
 * A property signature.
 *
 * @category Model
 * @since 1.0.0
 */
export interface PropertySignature
{
    readonly name: PropertyKey
    readonly type: Representation
    readonly isOptional: boolean
    readonly isMutable: boolean
    readonly annotations?: Schema.Annotations.Annotations | undefined
}

/**
 * Describes the key pattern and value schema of a private record representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface IndexSignature
{
    readonly parameter: Representation
    readonly type: Representation
}

/**
 * An object representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Objects extends Keyword<"Objects">
{
    readonly propertySignatures: ReadonlyArray<PropertySignature>
    readonly indexSignatures: ReadonlyArray<IndexSignature>
}

/**
 * A union representation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Union extends Keyword<"Union">
{
    readonly types: ReadonlyArray<Representation>
    readonly options?: SchemaAST.UnionOptions | undefined
}

/**
 * The structural schema representation.
 *
 * @category Model
 * @since 1.0.0
 */
export type Representation =
  | Declaration
  | Reference
  | Suspend
  | Null
  | Undefined
  | Void
  | Never
  | Unknown
  | Any
  | String
  | Number
  | Boolean
  | BigInt
  | Symbol
  | Literal
  | UniqueSymbol
  | ObjectKeyword
  | Enum
  | TemplateLiteral
  | Arrays
  | Objects
  | Union;

/**
 * A structural check.
 *
 * @category Model
 * @since 1.0.0
 */
export type Check = Filter | FilterGroup;

/**
 * An opaque leaf check.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Filter
{
    readonly _tag: "Filter"
    readonly representation?: CheckRepresentationAnnotation<Representation> | undefined
    readonly annotations?: Schema.Annotations.Annotations | undefined
    readonly aborted: boolean
}

/**
 * A non-empty group of checks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FilterGroup
{
    readonly _tag: "FilterGroup"
    readonly representation?: CheckRepresentationAnnotation<Representation> | undefined
    readonly annotations?: Schema.Annotations.Annotations | undefined
    readonly checks: readonly [Check, ...Array<Check>]
}

/**
 * Named representation definitions.
 *
 * @category Model
 * @since 1.0.0
 */
export interface References
{
    readonly [$ref: string]: Representation
}

/**
 * A single representation and its definitions.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Document
{
    readonly representation: Representation
    readonly references: References
}

/**
 * Multiple representations sharing definitions.
 *
 * @category Model
 * @since 1.0.0
 */
export interface MultiDocument
{
    readonly representations: readonly [Representation, ...Array<Representation>]
    readonly references: References
}

/**
 * Reviver for a declaration.
 *
 * @category Model
 * @since 1.0.0
 */
export interface DeclarationReviver<P>
{
    readonly id: string
    readonly payloadSchema: Schema.Decoder<P>
    readonly revive: (input: {
        readonly payload: P
        readonly typeParameters: ReadonlyArray<Schema.Top>
        readonly annotations: Schema.Annotations.Annotations | undefined
    }) => Schema.Top
}

/**
 * Reviver for a leaf check.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FilterReviver<P>
{
    readonly id: string
    readonly payloadSchema: Schema.Decoder<P>
    readonly revive: (input: {
        readonly payload: P
        readonly schemas: ReadonlyArray<Schema.Top>
        readonly annotations: Schema.Annotations.Filter | undefined
    }) => SchemaAST.Filter<any>
}

/**
 * Reviver for a check group.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FilterGroupReviver<P>
{
    readonly id: string
    readonly payloadSchema: Schema.Decoder<P>
    readonly revive: (input: {
        readonly payload: P
        readonly schemas: ReadonlyArray<Schema.Top>
        readonly annotations: Schema.Annotations.Filter | undefined
    }) => SchemaAST.FilterGroup<any>
}

/**
 * A check reviver.
 *
 * @category Model
 * @since 1.0.0
 */
export type CheckReviver<P> = FilterReviver<P> | FilterGroupReviver<P>;

/**
 * A typed reviver.
 *
 * @category Model
 * @since 1.0.0
 */
export type Reviver<P> = DeclarationReviver<P> | CheckReviver<P>;

/**
 * A reviver erased only at collection boundaries.
 *
 * @category Model
 * @since 1.0.0
 */
export type AnyReviver = Reviver<any>;

/**
 * Options for importing JSON Schema Draft 2020-12 documents.
 *
 * @category Model
 * @since 1.0.0
 */
export interface FromJsonSchemaOptions
{
    readonly onEnter?: ((schema: JsonSchema.JsonSchema) => JsonSchema.JsonSchema) | undefined

    /**
     * Controls how reached JSON Schema regular expression patterns are imported.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly patterns?: "error" | "ignore" | "apply" | undefined
}

/**
 * Runtime and TypeScript source generated for one schema.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Code
{
    readonly runtime: string
    readonly Type: string
}

/**
 * Auxiliary source artifact emitted while generating schema code.
 *
 * @category Model
 * @since 1.0.0
 */
export type Artifact =
  | {
      readonly _tag: "Symbol"
      readonly identifier: string
      readonly code: Code
  }
  | {
      readonly _tag: "Enum"
      readonly identifier: string
      readonly code: Code
  }
  | {
      readonly _tag: "Import"
      readonly importDeclaration: string
  };
export namespace CodeDocument
{
    export namespace References
    {
        /**
         * nonRecursives settings for References.
         *
         * @category Types
         * @since 1.0.0
         */
        export interface NonRecursives
        {
            readonly $ref: string
            readonly code: Code
        }
    }

    /**
     * references settings for CodeDocument.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface References
    {
        readonly nonRecursives: ReadonlyArray<References.NonRecursives>
        readonly recursives: Readonly<Record<string, Code>>
    }
}

/**
 * Generated schema code together with named references and auxiliary artifacts.
 *
 * @category Model
 * @since 1.0.0
 */
export interface CodeDocument
{
    readonly codes: ReadonlyArray<Code>
    readonly references: CodeDocument.References
    readonly artifacts: ReadonlyArray<Artifact>
}

/**
 * Information supplied to a reference policy for one representation candidate.
 *
 * @category Model
 * @since 1.0.0
 */
export interface ReferencePolicyInput
{
    /**
     *  The encoded-side AST owner for the candidate. Contextual copies can share the same owner.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST

    /**
     *  The number of times this candidate was encountered. Structurally equal ASTs remain distinct
     * candidates.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly occurrences: number

    /**
     *  The resolved encoded-side identifier, including an inherited `Encoded` suffix when applicable.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly identifier: string | undefined
}

/**
 * Function that chooses whether a representation candidate is emitted as a named reference.
 *
 * @category Model
 * @since 1.0.0
 */
export type ReferencePolicy = (input: ReferencePolicyInput) => string | undefined;

/**
 * Options for generating schema representations.
 *
 * @category Configuration
 * @since 1.0.0
 */
export interface ToRepresentationOptions
{
    /**
     * Chooses which representation candidates are extracted as named references.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly referencePolicy?: ReferencePolicy | undefined
}
