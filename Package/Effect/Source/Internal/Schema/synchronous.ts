/**
 * Synchronous parsers for compound schemas: tuples with rest elements, objects
 * with property and index signatures without prototype writes, and
 * discriminated and exclusive unions. Adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/Schema/synchronous
 *
 * @file      synchronous.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Result from "../../Result.js";
import * as SchemaAST from "../../SchemaAST.js";
import * as SchemaIssue from "../../SchemaIssue.js";
import type { Compiler, Parser } from "../../SchemaParser.js";
import { assignProperty } from "../record.js";
import * as Input from "./parser.js";

/**
 * Compiles sequential tuple and rest parsing.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const arrays = (ast: SchemaAST.Arrays, compile: Compiler, compileField: Compiler = compile): Parser =>
{
    let elements: Array<Parser>;
    let rest: Array<Parser>;
    return (input, options) =>
    {
        if (input === Input.missing) {return Input.missingExit;}

        if (!Array.isArray(input)) {return Result.fail(new SchemaIssue.InvalidType(ast, input, options));}

        elements ??= ast.elements.map(compileField);
        rest ??= ast.rest.map(compileField);
        const output = new Array(input.length);
        const issues: Array<SchemaIssue.Issue> = [];
        const tail = Math.max(0, rest.length - 1);
        const threshold = Math.max(elements.length, input.length - tail);
        const end = rest.length ? Math.max(input.length, elements.length + tail) : elements.length;
        for (let index = 0; index < end; index++)
        {
            const parser = index < elements.length ? elements[index] : index >= threshold ? rest[index - threshold + 1] : rest[0];
            const type = index < elements.length ? ast.elements[index] : index >= threshold ? ast.rest[index - threshold + 1] : ast.rest[0];
            const value = index < input.length ? input[index] : Input.missing;
            const result = parser(value, options);
            if (Result.isFailure(result)) {issues.push(new SchemaIssue.Pointer([ index ], result.failure));}
            else
            {
                const parsed = result === Input.sameExit ? value : result.success;
                if (parsed !== Input.missing) {output[index] = parsed;}
                else if (!SchemaAST.isOptional(type)) {issues.push(new SchemaIssue.Pointer([ index ], new SchemaIssue.MissingKey(type.context?.annotations)));}
            }

            if (issues.length && options.errors !== "all") {break;}
        }

        if ((!issues.length || options.errors === "all") && !rest.length)
        {
            for (let index = elements.length; index < input.length; index++)
            {
                issues.push(new SchemaIssue.Pointer([ index ], new SchemaIssue.UnexpectedKey(ast, input[index], options)));
                if (options.errors !== "all") {break;}
            }
        }

        return issues.length ? Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue, ...Array<SchemaIssue.Issue>], input, options)) : Result.succeed(output);
    };
};

/**
 * Compiles own properties and record index signatures without prototype writes.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const objects = (ast: SchemaAST.Objects, compile: Compiler, compileField: Compiler = compile): Parser =>
{
    let properties: Array<Parser>;
    let indexes: Array<readonly [Parser, Parser]>;
    const expected = new Set<PropertyKey>(ast.propertySignatures.map((property) => typeof property.name === "number" ? String(property.name) : property.name));
    return (input, options) =>
    {
        if (input === Input.missing) {return Input.missingExit;}

        if (!ast.propertySignatures.length && !ast.indexSignatures.length) {return input === null || input === undefined ? Result.fail(new SchemaIssue.InvalidType(ast, input, options)) : Input.sameExit;}

        if (typeof input !== "object" || input === null || Array.isArray(input)) {return Result.fail(new SchemaIssue.InvalidType(ast, input, options));}

        const record = input as Record<PropertyKey, unknown>;
        properties ??= ast.propertySignatures.map((property) => compileField(property.type));
        indexes ??= ast.indexSignatures.map((index) => [ compile(SchemaAST.parameterFromPropertyKey(index.parameter)), compileField(index.type) ] as const);
        const output: Record<PropertyKey, unknown> = {};
        const issues: Array<SchemaIssue.Issue> = [];
        const keys = Reflect.ownKeys(record).filter((key) => Object.prototype.propertyIsEnumerable.call(record, key));
        // Excess keys are reported before field validation, as upstream does.
        for (const key of keys)
        {
            if (expected.has(key)) {continue;}

            let accepts = false;
            for (let index = 0; index < indexes.length; index++)
            {
                if (SchemaAST.getIndexSignatureKeys(record, ast.indexSignatures[index].parameter, options).includes(key)) { accepts = true; break; }
            }

            if (!accepts && options.onExcessProperty === "error")
            {
                issues.push(new SchemaIssue.Pointer([ key ], new SchemaIssue.UnexpectedKey(ast, record[key], options)));
                if (options.errors !== "all") {return Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue], input, options));}
            }
        }

        for (let index = 0; index < properties.length; index++)
        {
            const property = ast.propertySignatures[index];
            const value = (property.name === "__proto__" ? Object.hasOwn(record, property.name) : property.name in record) ? record[property.name] : Input.missing;
            const result = properties[index](value, options);
            if (Result.isFailure(result)) {issues.push(new SchemaIssue.Pointer([ property.name ], result.failure));}
            else
            {
                const parsed = result === Input.sameExit ? value : result.success;
                if (parsed !== Input.missing) {assignProperty(output, property.name, parsed);}
                else if (!SchemaAST.isOptional(property.type)) {issues.push(new SchemaIssue.Pointer([ property.name ], new SchemaIssue.MissingKey(property.type.context?.annotations)));}
            }

            if (issues.length && options.errors !== "all") {return Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue], input, options));}
        }

        for (let index = 0; index < indexes.length; index++)
        {
            const [ parseKey, parseValue ] = indexes[index];
            for (const key of SchemaAST.getIndexSignatureKeys(record, ast.indexSignatures[index].parameter, options))
            {
                const keyResult = parseKey(key, options);
                if (Result.isFailure(keyResult))
                {
                    issues.push(new SchemaIssue.Pointer([ key ], keyResult.failure));
                    if (options.errors !== "all") {return Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue], input, options));}

                    continue;
                }

                const valueResult = parseValue(record[key], options);
                if (Result.isFailure(valueResult)) {issues.push(new SchemaIssue.Pointer([ key ], valueResult.failure));}
                else
                {
                    const parsedKey = keyResult === Input.sameExit ? key : keyResult.success;
                    const parsedValue = valueResult === Input.sameExit ? record[key] : valueResult.success;
                    if (parsedKey !== Input.missing && parsedValue !== Input.missing && !expected.has(key) && !expected.has(parsedKey as PropertyKey)) {assignProperty(output, parsedKey as PropertyKey, parsedValue);}
                }

                if (issues.length && options.errors !== "all") {return Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue], input, options));}
            }
        }

        return issues.length ? Result.fail(new SchemaIssue.Composite(ast, issues as [SchemaIssue.Issue], input, options)) : Result.succeed(output);
    };
};

/**
 * Compiles discriminated union selection and exclusive unions.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const union = (ast: SchemaAST.Union, compile: Compiler, compileField?: Compiler): Parser =>
{
    const parsers: Array<Parser> = [];
    let candidates: SchemaAST.CandidateIndex;
    return (input, options) =>
    {
        if (input === Input.missing) {return Input.missingExit;}

        const indices = (candidates ??= SchemaAST.getCandidateIndex(ast.types))(input, compileField !== undefined);
        const issues: Array<SchemaIssue.Issue> = [];
        const successes: Array<SchemaAST.AST> = [];
        let first: Result.Result<unknown, SchemaIssue.Issue> | undefined;
        for (const index of indices)
        {
            const result = (parsers[index] ??= compile(ast.types[index]))(input, options);
            if (Result.isFailure(result)) {issues.push(result.failure);}
            else
            {
                if (ast.options?.mode !== "oneOf") {return result;}

                first ??= result;
                successes.push(ast.types[index]);
                if (successes.length > 1) {return Result.fail(new SchemaIssue.OneOf(ast, successes, input, options));}
            }
        }

        return first ?? Result.fail(new SchemaIssue.AnyOf(ast, issues, input, options));
    };
};

