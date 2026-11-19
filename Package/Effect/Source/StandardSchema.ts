/**
 * Type definitions from the Standard Schema specification.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/StandardSchema
 *
 * @file      StandardSchema.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/*
MIT License

Copyright (c) 2024 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// #########################
// ###   Standard Typed  ###
// #########################

/**
 *  The Standard Typed interface. This is a base type extended by other specs.
 *
 * @category Combinator
 * @since 1.0.0
 */
export interface StandardTypedV1<Input = unknown, Output = Input>
{
    /**
     *  The Standard properties.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly "~standard": StandardTypedV1.Props<Input, Output>;
}

export declare namespace StandardTypedV1
{
    /**
     *  The Standard Typed properties interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Props<Input = unknown, Output = Input>
    {
        /**
         *  The version number of the standard.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly version: 1;

        /**
         *  The vendor name of the schema library.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly vendor: string;

        /**
         *  Inferred types associated with the schema.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly types?: Types<Input, Output> | undefined;
    }

    /**
     *  The Standard Typed types interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Types<Input = unknown, Output = Input>
    {
        /**
         *  The input type of the schema.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly input: Input;

        /**
         *  The output type of the schema.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly output: Output;
    }

    /**
     *  Infers the input type of a Standard Typed.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferInput<Schema extends StandardTypedV1> =
        NonNullable<Schema["~standard"]["types"]>["input"];

    /**
     *  Infers the output type of a Standard Typed.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferOutput<Schema extends StandardTypedV1> =
        NonNullable<Schema["~standard"]["types"]>["output"];
}

// ##########################
// ###   Standard Schema  ###
// ##########################

/**
 *  The Standard Schema interface.
 *
 * @category Combinator
 * @since 1.0.0
 */
export interface StandardSchemaV1<Input = unknown, Output = Input>
{
    /**
     *  The Standard Schema properties.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1
{
    /**
     *  The Standard Schema properties interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output>
    {
        /**
         *  Validates unknown input values.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly validate: (value: unknown, options?: StandardSchemaV1.Options | undefined) =>
            Result<Output> | Promise<Result<Output>>;
    }

    /**
     *  The result interface of the validate function.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type Result<Output> = SuccessResult<Output> | FailureResult;

    /**
     *  The result interface if validation succeeds.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface SuccessResult<Output>
    {
        /**
         *  The typed output value.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly value: Output;

        /**
         *  A falsy value for `issues` indicates success.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly issues?: undefined;
    }

    /**
     * Supports options during synchronous schema processing.
     *
     *
     * @category Model
     * @since 1.0.0
     */
    export interface Options
    {
        /**
         *  Explicit support for additional vendor-specific parameters, if needed.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly libraryOptions?: Record<string, unknown> | undefined;
    }

    /**
     *  The result interface if validation fails.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface FailureResult
    {
        /**
         *  The issues of failed validation.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly issues: ReadonlyArray<Issue>;
    }

    /**
     *  The issue interface of the failure output.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Issue
    {
        /**
         *  The error message of the issue.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly message: string;

        /**
         *  The path of the issue, if any.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }

    /**
     *  The path segment interface of the issue.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface PathSegment
    {
        /**
         *  The key representing a path segment.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly key: PropertyKey;
    }

    /**
     *  The Standard types interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output>
    {
    }

    /**
     *  Infers the input type of a Standard.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;

    /**
     *  Infers the output type of a Standard.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}

// ###############################
// ###   Standard JSON Schema  ###
// ###############################

/**
 *  The Standard JSON Schema interface.
 *
 * @category Combinator
 * @since 1.0.0
 */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input>
{
    /**
     *  The Standard JSON Schema properties.
     *
     * @category Combinator
     * @since 1.0.0
     */
    readonly "~standard": StandardJSONSchemaV1.Props<Input, Output>;
}

export declare namespace StandardJSONSchemaV1
{
    /**
     *  The Standard JSON Schema properties interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Props<Input = unknown, Output = Input> extends StandardTypedV1.Props<Input, Output>
    {
        /**
         *  Methods for generating the input/output JSON Schema.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly jsonSchema: StandardJSONSchemaV1.Converter;
    }

    /**
     *  The Standard JSON Schema converter interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Converter
    {
        /**
         *  Converts the input type to JSON Schema. May throw if conversion is not supported.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly input: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;

        /**
         *  Converts the output type to JSON Schema. May throw if conversion is not supported.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly output: (options: StandardJSONSchemaV1.Options) => Record<string, unknown>;
    }

    /**
     * The target version of the generated JSON Schema.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type Target = "draft-2020-12" | "draft-07" | "openapi-3.0"
    // Accepts any string for future targets while preserving autocomplete
     | ({} & string);

    /**
     *  The options for the input/output methods.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Options
    {
        /**
         *  Specifies the target version of the generated JSON Schema. Support for all versions is
         * on a best-effort basis. If a given version is not supported, the library should throw.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly target: Target;

        /**
         *  Explicit support for additional vendor-specific parameters, if needed.
         *
         * @category Combinator
         * @since 1.0.0
         */
        readonly libraryOptions?: Record<string, unknown> | undefined;
    }

    /**
     *  The Standard types interface.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export interface Types<Input = unknown, Output = Input> extends StandardTypedV1.Types<Input, Output>
    {
    }

    /**
     *  Infers the input type of a Standard.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferInput<Schema extends StandardTypedV1> = StandardTypedV1.InferInput<Schema>;

    /**
     *  Infers the output type of a Standard.
     *
     * @category Combinator
     * @since 1.0.0
     */
    export type InferOutput<Schema extends StandardTypedV1> = StandardTypedV1.InferOutput<Schema>;
}
