/**
 * Synchronous schema parsing with validation failures represented by Result.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/SchemaParser
 *
 * @file      SchemaParser.ts
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
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import type * as Option from "./Option.js";
import * as Result from "./Result.js";
import type * as Schema from "./Schema.js";
import * as SchemaAST from "./SchemaAST.js";
import * as SchemaGetter from "./SchemaGetter.js";
import * as SchemaIssue from "./SchemaIssue.js";
import * as Input from "./Internal/Schema/parser.js";

/**
 * A compiled synchronous AST parser.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Parser { (input: unknown, options: SchemaAST.ParseOptions): Result.Result<unknown, SchemaIssue.Issue>; }

/**
 * A lazily cached parser compiler.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Compiler { (ast: SchemaAST.AST): Parser; }

const DecodeCache = new WeakMap<SchemaAST.AST, Parser>();
const ConstructorCache = new WeakMap<SchemaAST.AST, Parser>();

/**
 * Compiles an AST, deferring recursive children until parsing begins.
 *
 * @category Parsing
 * @since 1.0.0
 */
function compile(ast: SchemaAST.AST, constructor: boolean): Parser
{
    const cache = constructor ? ConstructorCache : DecodeCache;
    const cached = cache.get(ast);
    if (cached) {return cached;}

    let parser: Parser;
    const deferred: Parser = (input, options) => (parser ??= build(ast, constructor))(input, options);
    cache.set(ast, deferred);
    return deferred;
}

/**
 * Builds checks, construction and bidirectional encoding around the local parser.
 *
 * @category Parsing
 * @since 1.0.0
 */
function build(ast: SchemaAST.AST, constructor: boolean): Parser
{
    const recur: Compiler = (node) => compile(node, constructor);
    const field: Compiler = (node) =>
    {
        const parser = recur(node);
        const fallback = node.context?.constructorDefault;
        return !fallback ? parser : (input, options) =>
        {
            if (input !== Input.missing && input !== undefined) {return parser(input, options);}

            const result = Input.checked(fallback());
            if (Result.isFailure(result)) {return Result.fail(new SchemaIssue.Encoding(node, result.failure, input, options));}

            const parsed = parser(result.success, options);
            return parsed === Input.sameExit ? result : parsed;
        };
    };

    const descriptor = constructor ? SchemaAST.getConstructorDescriptor(ast) : undefined;
    let source: Parser;
    const local: Parser = descriptor ? (input, options) =>
    {
        if (input === Input.missing) {return Input.missingExit;}

        if (descriptor.isConstructed(input)) {return Input.sameExit;}

        const parsed = (source ??= recur(descriptor.link.to))(input, options);
        return transform(parsed, input, descriptor.link.transformation.decode, options);
    } : ast.getParser(recur, constructor ? field : undefined);
    const parseLocal: Parser = (input, options) =>
    {
        let result = Input.checked(local(input, options));
        if (Result.isFailure(result) || options.disableChecks) {return result;}

        const value = result === Input.sameExit ? input : result.success;
        const encodingChecks = "encodingChecks" in ast ? ast.encodingChecks : undefined;
        if (value !== Input.missing && input !== Input.missing && encodingChecks)
        {
            const issues = SchemaAST.collectIssues(encodingChecks, input, undefined, ast, options);
            if (issues) {result = Result.fail(new SchemaIssue.Composite(ast, issues, input, options));}
        }

        if (Result.isSuccess(result) && value !== Input.missing && ast.checks)
        {
            const issues = SchemaAST.collectIssues(ast.checks, value, undefined, ast, options);
            if (issues) {result = Result.fail(new SchemaIssue.Composite(ast, issues, value, options));}
        }

        return result;
    };

    if (!ast.encoding) {return parseLocal;}

    const links = ast.encoding;
    let parsers: Array<Parser>;
    return (input, options) =>
    {
        parsers ??= links.map((link) => recur(link.to));
        let current = input;
        let result = parsers[parsers.length - 1](current, options);
        for (let index = links.length - 1; index >= 0; index--)
        {
            result = transform(result, current, links[index].transformation.decode, options);
            if (Result.isFailure(result)) {return Result.fail(new SchemaIssue.Encoding(ast, result.failure, input, options));}

            current = result.success;
            if (index > 0)
            {
                result = parsers[index - 1](current, options);
            }
        }

        const parsed = parseLocal(current, options);
        return parsed === Input.sameExit ? Result.succeed(current) : parsed;
    };
}

/**
 * Applies a getter while resolving the internal unchanged-input marker.
 *
 * @category Parsing
 * @since 1.0.0
 */
function transform(result: Result.Result<unknown, SchemaIssue.Issue>, input: unknown, getter: SchemaGetter.Getter<any, any, never>, options: SchemaAST.ParseOptions): Result.Result<unknown, SchemaIssue.Issue>
{
    if (Result.isFailure(result)) {return Result.fail(result.failure);}

    const value = result === Input.sameExit ? input : result.success;
    return Result.flatMap(Input.checked(SchemaGetter.run(getter, Input.toOption(value), options)), Input.fromOptionExit);
}

/**
 * Resolves internal markers before exposing a parser result.
 *
 * @category Parsing
 * @since 1.0.0
 */
function resolve<T>(parser: Parser, input: unknown, options?: SchemaAST.ParseOptions): Result.Result<T, SchemaIssue.Issue>
{
    const result = parser(input, options ?? SchemaAST.defaultParseOptions);
    if (Result.isFailure(result)) {return Result.fail(result.failure);}

    const value = result === Input.sameExit ? input : result.success;
    return value === Input.missing ? Result.fail(new SchemaIssue.InvalidValue()) : Result.succeed(value as T);
}

/**
 * Runs an AST directly with synchronous Result output.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function run<T, R extends never = never>(ast: SchemaAST.AST): (input: unknown, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>
{
    const parser = compile(ast, false);
    return (input, options) => resolve<T>(parser, input, options);
}

/**
 * Constructs and validates the decoded side, applying construction defaults.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function make<S extends Schema.Constraint>(schema: S)
{
    const parser = compile(SchemaAST.toType(schema.ast), true);
    return (input: S["~type.make.in"], options?: Schema.MakeOptions): S["Type"] =>
    {
        const result = resolve<S["Type"]>(parser, input, { ...options?.parseOptions,
            ...(options?.disableChecks ? { disableChecks: true } : {}) });
        if (Result.isFailure(result)) {throw new Error("Schema validation failed", { cause: result.failure });}

        return result.success;
    };
}

/**
 * Constructs a value, discarding validation failures and preserving defects.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function makeOption<S extends Schema.Constraint>(schema: S)
{
    const parser = compile(SchemaAST.toType(schema.ast), true);
    return (input: S["~type.make.in"], options?: Schema.MakeOptions): Option.Option<S["Type"]> => Result.getSuccess(resolve<S["Type"]>(parser, input, { ...options?.parseOptions,
        ...(options?.disableChecks ? { disableChecks: true } : {}) }));
}

/**
 * Builds a decoded-side type guard.
 *
 * @category Guard
 * @since 1.0.0
 */
export function is<S extends Schema.Constraint>(schema: S): <I>(input: I) => input is I & S["Type"] { return _is(schema.ast); }

/**
 * Builds an AST decoded-side guard.
 *
 * @category Guard
 * @since 1.0.0
 */
export function _is<T>(ast: SchemaAST.AST): <I>(input: I) => input is I & T
{
    const parser = run(SchemaAST.toType(ast));
    return <I>(input: I): input is I & T => Result.isSuccess(parser(input));
}

/**
 * Builds an issue-only decoded-side validator.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function _issue<T>(ast: SchemaAST.AST)
{
    const parser = run(SchemaAST.toType(ast));
    return (input: unknown, options?: SchemaAST.ParseOptions): SchemaIssue.Issue | undefined => { const result = parser(input, options); return Result.isFailure(result) ? result.failure : undefined; };
}

/**
 * Asserts that input satisfies the decoded side.
 *
 * @category Guard
 * @since 1.0.0
 */
export function asserts<S extends Schema.Constraint, I>(schema: S, input: I): asserts input is I & S["Type"] { decodeUnknownSync({ ast: SchemaAST.toType(schema.ast) } as S)(input); }

/**
 * Builds a decoder reporting lower-level schema issues.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function decodeUnknownResult<S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = run<S["Type"]>(schema.ast);
    return (input: unknown, override?: SchemaAST.ParseOptions) => parser(input, { ...options,
        ...override });
}

/**
 * Decodes typed input with Result output.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const decodeResult: <S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Result.Result<S["Type"], SchemaIssue.Issue> = decodeUnknownResult;

/**
 * Builds an encoder reporting lower-level schema issues.
 *
 * @category Encoding
 * @since 1.0.0
 */
export function encodeUnknownResult<S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions)
{
    const parser = run<S["Encoded"]>(SchemaAST.flip(schema.ast));
    return (input: unknown, override?: SchemaAST.ParseOptions) => parser(input, { ...options,
        ...override });
}

/**
 * Encodes typed input with Result output.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const encodeResult: <S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Result.Result<S["Encoded"], SchemaIssue.Issue> = encodeUnknownResult;

/**
 * Adapts a Result parser to Option without catching defects.
 *
 * @category Parsing
 * @since 1.0.0
 */
export function asOption<T, E>(parser: (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>) { return (input: E, options?: SchemaAST.ParseOptions) => Result.getSuccess(parser(input, options)); }

/**
 * Adapts a Result parser to a throwing function.
 *
 * @category Parsing
 * @since 1.0.0
 */
function asSync<T, E>(parser: (input: E, options?: SchemaAST.ParseOptions) => Result.Result<T, SchemaIssue.Issue>)
{
    return (input: E, options?: SchemaAST.ParseOptions): T =>
    {
        const result = parser(input, options); if (Result.isFailure(result)) {throw new Error("Schema validation failed", { cause: result.failure });}

        return result.success;
    };
}

/**
 * Decodes unknown input with Option output.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function decodeUnknownOption<S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) { return asOption(decodeUnknownResult(schema, options)); }

/**
 * Decodes typed input with Option output.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const decodeOption: <S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => Option.Option<S["Type"]> = decodeUnknownOption;

/**
 * Encodes unknown input with Option output.
 *
 * @category Encoding
 * @since 1.0.0
 */
export function encodeUnknownOption<S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) { return asOption(encodeUnknownResult(schema, options)); }

/**
 * Encodes typed input with Option output.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const encodeOption: <S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => Option.Option<S["Encoded"]> = encodeUnknownOption;

/**
 * Decodes unknown input or throws an Error carrying the issue as cause.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function decodeUnknownSync<S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) { return asSync(decodeUnknownResult(schema, options)); }

/**
 * Decodes typed input synchronously.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const decodeSync: <S extends Schema.ConstraintDecoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Encoded"], options?: SchemaAST.ParseOptions) => S["Type"] = decodeUnknownSync;

/**
 * Encodes unknown input or throws an Error carrying the issue as cause.
 *
 * @category Encoding
 * @since 1.0.0
 */
export function encodeUnknownSync<S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) { return asSync(encodeUnknownResult(schema, options)); }

/**
 * Encodes typed input synchronously.
 *
 * @category Encoding
 * @since 1.0.0
 */
export const encodeSync: <S extends Schema.ConstraintEncoder<unknown>>(schema: S, options?: SchemaAST.ParseOptions) => (input: S["Type"], options?: SchemaAST.ParseOptions) => S["Encoded"] = encodeUnknownSync;

