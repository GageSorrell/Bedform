/**
 * Creates schema values from AST nodes and marks them with the Schema type
 * identifier. Adapted from Effect 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/make
 *
 * @file      make.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable sort-keys, prefer-rest-params, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Pipeable from "../../Pipeable.js";

import type * as Schema from "../../Schema.js";

import * as SchemaAST from "../../SchemaAST.js";

import * as SchemaParser from "../../SchemaParser.js";

/**
 * Supports type id during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TypeId = "~effect/Schema/Schema";

const RebuildOptions = Symbol();

const SchemaProto = {
    [TypeId]: TypeId,
    get make()
    {
        const value = SchemaParser.make(this as any);
        Object.defineProperty(this, "make", { value,
            enumerable: true });
        return value;
    },
    get makeOption()
    {
        const value = SchemaParser.makeOption(this as any);
        Object.defineProperty(this, "makeOption", { value,
            enumerable: true });
        return value;
    },
    pipe()
    {
        return Pipeable.pipeArguments(this, arguments);
    },
    annotate(this: Schema.Top, annotations: Schema.Annotations.Annotations)
    {
        return this.rebuild(SchemaAST.annotate(this.ast, annotations));
    },
    annotateKey(this: Schema.Top, annotations: Schema.Annotations.Key<unknown>)
    {
        return this.rebuild(SchemaAST.annotateKey(this.ast, annotations));
    },
    check(this: Schema.Top, ...checks: readonly [
        SchemaAST.Check<unknown>,
        ...Array<SchemaAST.Check<unknown>>
    ])
    {
        return this.rebuild(SchemaAST.appendChecks(this.ast, checks));
    },
    rebuild(this: Schema.Top, ast: SchemaAST.AST)
    {
        return make(ast, (this as any)[RebuildOptions]);
    }
};

/**
 * Supports make during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function make<S extends Schema.Constraint>(ast: S["ast"], options?: object): S
{
    /**
     * Supports schema during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    function Schema() { }

    const self = Object.setPrototypeOf(Schema, SchemaProto);
    if (options &&
        (Object.hasOwn(options, "name") || Object.hasOwn(options, "length") || Object.hasOwn(options, "__proto__")))
    {
        Object.defineProperties(self, Object.getOwnPropertyDescriptors({ ...options }));
    }
    else
    {
        Object.assign(self, options);
    }

    self[RebuildOptions] = options;
    self.ast = ast;
    return self;
}
