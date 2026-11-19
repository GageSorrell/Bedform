/**
 * Describes problems found while decoding, encoding, or checking data with
 * schemas.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/SchemaIssue
 *
 * @file      SchemaIssue.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as Arr from "./Array.js";

import { format, formatPath, type Formatter as FormatterI } from "./Formatter.js";

import * as InternalAnnotations from "./Internal/Schema/annotations.js";

import * as InternalParser from "./Internal/Schema/parser.js";

import { hasProperty } from "./Predicate.js";

import type * as Schema from "./Schema.js";

import type * as SchemaAST from "./SchemaAST.js";

import type { StandardSchemaV1 } from "./StandardSchema.js";

const TypeId = "~effect/SchemaIssue/Issue";

/**
 * Returns `true` if the given value is an {@link Issue}.
 *
 * @category guards
 * @since 1.0.0
 */
export function isIssue(u: unknown): u is Issue
{
    return hasProperty(u, TypeId) && u[TypeId] === TypeId;
}

/**
 * Returns `true` when an issue contains an input reported by the schema parser.
 *
 * @category guards
 * @since 1.0.0
 */
export function hasInput(issue: Issue): issue is Issue & {
    readonly input: unknown;
}
{
    return Object.hasOwn(issue, "input");
}

/**
 * Union of all terminal (leaf) issue types that have no inner `Issue` children.
 *
 * @category models
 * @since 1.0.0
 */
export type Leaf = InvalidType | InvalidValue | MissingKey | UnexpectedKey | Forbidden | OneOf;

/**
 * The root discriminated union of all validation error nodes.
 *
 * @category models
 * @since 1.0.0
 */
export type Issue = Leaf
// composite
 | Filter | Encoding | Pointer | Composite | AnyOf;

interface IssueNode
{
    readonly [TypeId]: typeof TypeId;

    /**
     * The input reported by the schema parser, when input reporting is enabled
     * and the issue is associated with a present value.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly input?: unknown;
}

class IssueNodeImpl implements IssueNode
{
    readonly [TypeId] = TypeId;

    /**
     * The input reported by the schema parser, when input reporting is enabled
     * and the issue is associated with a present value.
     *
     * @category Utilities
     * @since 1.0.0
     */
    declare readonly input?: unknown;
    constructor(input?: unknown, options?: SchemaAST.ParseOptions)
    {
        if (options?.reportInput === true && input !== InternalParser.missing)
        {
            this.input = input;
        }
    }
}

/**
 * Represents a schema issue produced when a schema filter (refinement check) fails.
 *
 * @category models
 * @since 1.0.0
 */
export interface Filter extends IssueNode
{
    readonly _tag: "Filter";

    /**
     * The filter that failed.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly filter: SchemaAST.Filter<unknown>;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
}

/**
 * Constructs a schema issue for a failed refinement check.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Filter: new (
/**
 * The filter that failed.
 *
 * @category Utilities
 * @since 1.0.0
 */
    filter: SchemaAST.Filter<any>,

/**
 * The issue that occurred.
 *
 * @category Utilities
 * @since 1.0.0
 */
    issue: Issue,

/**
 * The present input associated with the issue. It is retained only when
 * `options.reportInput` is `true`.
 *
 * @category Utilities
 * @since 1.0.0
 */
    input?: unknown,

/**
 * The effective parse options controlling input retention.
 *
 * @category Utilities
 * @since 1.0.0
 */
    options?: SchemaAST.ParseOptions) => Filter = class extends IssueNodeImpl
{
    readonly _tag = "Filter";

    /**
     * The filter that failed.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly filter: SchemaAST.Filter<unknown>;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
    constructor(
    /**
     * The filter that failed.
     *
     * @category Utilities
     * @since 1.0.0
     */
        filter: SchemaAST.Filter<any>,

        /**
         * The issue that occurred.
         *
         * @category Utilities
         * @since 1.0.0
         */
        issue: Issue,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.filter = filter;
        this.issue = issue;
    }
};

/**
 * Represents a schema issue produced when a schema transformation (encode/decode step) fails.
 *
 * @category models
 * @since 1.0.0
 */
export interface Encoding extends IssueNode
{
    readonly _tag: "Encoding";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
}

/**
 * Constructs a schema issue for a failed transformation.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Encoding: new (ast: SchemaAST.AST, issue: Issue, input?: unknown, options?: SchemaAST.ParseOptions) => Encoding = class extends IssueNodeImpl
{
    readonly _tag = "Encoding";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.AST,

        /**
         * The issue that occurred.
         *
         * @category Utilities
         * @since 1.0.0
         */
        issue: Issue,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
        this.issue = issue;
    }
};

/**
 * Wraps an inner {@link Issue} with a property-key path, indicating *where* in
 * a nested structure the error occurred.
 *
 * @category models
 * @since 1.0.0
 */
export interface Pointer extends IssueNode
{
    readonly _tag: "Pointer";

    /**
     * The path to the location in the input that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly path: ReadonlyArray<PropertyKey>;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
}

/**
 * Constructs a schema issue that points to a nested location.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Pointer: new (path: ReadonlyArray<PropertyKey>, issue: Issue) => Pointer = class extends IssueNodeImpl
{
    readonly _tag = "Pointer";

    /**
     * The path to the location in the input that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly path: ReadonlyArray<PropertyKey>;

    /**
     * The issue that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issue: Issue;
    constructor(
    /**
     * The path to the location in the input that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        path: ReadonlyArray<PropertyKey>,

        /**
         * The issue that occurred.
         *
         * @category Utilities
         * @since 1.0.0
         */
        issue: Issue)
    {
        super();
        this.path = path;
        this.issue = issue;
    }
};

/**
 * Represents a schema issue produced when a required key or tuple index is missing from the input.
 *
 * @category models
 * @since 1.0.0
 */
export interface MissingKey extends IssueNode
{
    readonly _tag: "MissingKey";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Key<unknown> | undefined;
}

/**
 * Constructs a schema issue for a missing key or tuple index.
 *
 * @category constructors
 * @since 1.0.0
 */
export const MissingKey: new (annotations: Schema.Annotations.Key<unknown> | undefined) => MissingKey = class extends IssueNodeImpl
{
    readonly _tag = "MissingKey";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Key<unknown> | undefined;
    constructor(
    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        annotations: Schema.Annotations.Key<unknown> | undefined)
    {
        super();
        this.annotations = annotations;
    }
};

/**
 * Represents a schema issue produced when an input object or tuple contains a key/index not
 * declared by the schema.
 *
 * @category models
 * @since 1.0.0
 */
export interface UnexpectedKey extends IssueNode
{
    readonly _tag: "UnexpectedKey";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;
}

/**
 * Constructs a schema issue for an unexpected key or tuple index.
 *
 * @category constructors
 * @since 1.0.0
 */
export const UnexpectedKey: new (ast: SchemaAST.AST, input?: unknown, options?: SchemaAST.ParseOptions) => UnexpectedKey = class extends IssueNodeImpl
{
    readonly _tag = "UnexpectedKey";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.AST,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
    }
};

/**
 * Represents a schema issue that groups multiple child issues under a single schema node.
 *
 * @category models
 * @since 1.0.0
 */
export interface Composite extends IssueNode
{
    readonly _tag: "Composite";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;

    /**
     * The issues that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issues: readonly [
        Issue,
        ...Array<Issue>
    ];
}

/**
 * Constructs a schema issue that groups multiple child issues.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Composite: new (ast: SchemaAST.AST, issues: readonly [
    Issue,
    ...Array<Issue>
], input?: unknown, options?: SchemaAST.ParseOptions) => Composite = class extends IssueNodeImpl
{
    readonly _tag = "Composite";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;

    /**
     * The issues that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issues: readonly [
        Issue,
        ...Array<Issue>
    ];
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.AST,

        /**
         * The issues that occurred.
         *
         * @category Utilities
         * @since 1.0.0
         */
        issues: readonly [
            Issue,
            ...Array<Issue>
        ],

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
        this.issues = issues;
    }
};

/**
 * Represents a schema issue produced when the runtime type of the input does not match the type
 * expected by the schema.
 *
 * @category models
 * @since 1.0.0
 */
export interface InvalidType extends IssueNode
{
    readonly _tag: "InvalidType";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;
}

/**
 * Constructs a schema issue for an input with an invalid runtime type.
 *
 * @category constructors
 * @since 1.0.0
 */
export const InvalidType: new (ast: SchemaAST.AST, input?: unknown, options?: SchemaAST.ParseOptions) => InvalidType = class extends IssueNodeImpl
{
    readonly _tag = "InvalidType";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.AST;
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.AST,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
    }
};

/**
 * Represents a schema issue produced when the input has the correct type but its value violates a
 * constraint (e.g. a string that is too short, a number out of range).
 *
 * @category models
 * @since 1.0.0
 */
export interface InvalidValue extends IssueNode
{
    readonly _tag: "InvalidValue";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Issue | undefined;
}

/**
 * Constructs a schema issue for a value that violates a constraint.
 *
 * @category constructors
 * @since 1.0.0
 */
export const InvalidValue: new (annotations?: Schema.Annotations.Issue | undefined, input?: unknown, options?: SchemaAST.ParseOptions) => InvalidValue = class extends IssueNodeImpl
{
    readonly _tag = "InvalidValue";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Issue | undefined;
    constructor(
    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        annotations?: Schema.Annotations.Issue | undefined,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.annotations = annotations;
    }
};

/**
 * Supports make composite at key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function makeCompositeAtKey(compositeAst: SchemaAST.AST, pointerKey: PropertyKey, pointerIssue: Issue, compositeInput: unknown, parseOptions?: SchemaAST.ParseOptions): Composite
{
    return new Composite(compositeAst, [ new Pointer([ pointerKey ], pointerIssue) ], compositeInput, parseOptions);
}

/**
 * Represents a schema issue produced when a forbidden operation is encountered during parsing,
 * such as an asynchronous Effect running inside `Schema.decodeUnknownSync`.
 *
 * @category models
 * @since 1.0.0
 */
export interface Forbidden extends IssueNode
{
    readonly _tag: "Forbidden";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Issue | undefined;
}

/**
 * Constructs a schema issue for a forbidden parsing operation.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Forbidden: new (annotations: Schema.Annotations.Issue | undefined, input?: unknown, options?: SchemaAST.ParseOptions) => Forbidden = class extends IssueNodeImpl
{
    readonly _tag = "Forbidden";

    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly annotations: Schema.Annotations.Issue | undefined;
    constructor(
    /**
     * The metadata for the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        annotations: Schema.Annotations.Issue | undefined,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.annotations = annotations;
    }
};

/**
 * Represents a schema issue produced when a value does not match *any* member of a union schema.
 *
 * @category models
 * @since 1.0.0
 */
export interface AnyOf extends IssueNode
{
    readonly _tag: "AnyOf";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.Union;

    /**
     * The issues that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issues: ReadonlyArray<Issue>;
}

/**
 * Constructs a schema issue for a value that matches no union member.
 *
 * @category constructors
 * @since 1.0.0
 */
export const AnyOf: new (ast: SchemaAST.Union, issues: ReadonlyArray<Issue>, input?: unknown, options?: SchemaAST.ParseOptions) => AnyOf = class extends IssueNodeImpl
{
    readonly _tag = "AnyOf";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.Union;

    /**
     * The issues that occurred.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly issues: ReadonlyArray<Issue>;
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.Union,

        /**
         * The issues that occurred.
         *
         * @category Utilities
         * @since 1.0.0
         */
        issues: ReadonlyArray<Issue>,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
        this.issues = issues;
    }
};

/**
 * Represents a schema issue produced when a value matches *multiple* members of a union that is
 * configured to allow exactly one match (oneOf mode).
 *
 * @category models
 * @since 1.0.0
 */
export interface OneOf extends IssueNode
{
    readonly _tag: "OneOf";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.Union;

    /**
     * The schemas that were successful.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly successes: ReadonlyArray<SchemaAST.AST>;
}

/**
 * Constructs a schema issue for a value that matches multiple union members.
 *
 * @category constructors
 * @since 1.0.0
 */
export const OneOf: new (ast: SchemaAST.Union, successes: ReadonlyArray<SchemaAST.AST>, input?: unknown, options?: SchemaAST.ParseOptions) => OneOf = class extends IssueNodeImpl
{
    readonly _tag = "OneOf";

    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly ast: SchemaAST.Union;

    /**
     * The schemas that were successful.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly successes: ReadonlyArray<SchemaAST.AST>;
    constructor(
    /**
     * The schema that caused the issue.
     *
     * @category Utilities
     * @since 1.0.0
     */
        ast: SchemaAST.Union,

        /**
         * The schemas that were successful.
         *
         * @category Utilities
         * @since 1.0.0
         */
        successes: ReadonlyArray<SchemaAST.AST>,

        /**
         * The present input associated with the issue. It is retained only when
         * `options.reportInput` is `true`.
         *
         * @category Utilities
         * @since 1.0.0
         */
        input?: unknown,

        /**
         * The effective parse options controlling input retention.
         *
         * @category Utilities
         * @since 1.0.0
         */
        options?: SchemaAST.ParseOptions)
    {
        super(input, options);
        this.ast = ast;
        this.successes = successes;
    }
};

/**
 * Supports make filter issue during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function makeFilterIssue(entry: Schema.FilterIssue, input?: unknown, options?: SchemaAST.ParseOptions): Issue
{
    if (isIssue(entry))
    {
        return entry;
    }

    if (typeof entry === "string")
    {
        return new InvalidValue({ message: entry }, input, options);
    }

    const inner = typeof entry.issue === "string"
        ? new InvalidValue({ message: entry.issue }, input, options)
        : entry.issue;
    return new Pointer(entry.path, inner);
}

/**
 * Supports make single during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function makeSingle(out: undefined | boolean | Schema.FilterIssue, input?: unknown, options?: SchemaAST.ParseOptions): Issue | undefined
{
    if (out === undefined)
    {
        return undefined;
    }

    if (typeof out === "boolean")
    {
        return out ? undefined : new InvalidValue(undefined, input, options);
    }

    return makeFilterIssue(out, input, options);
}

/**
 * Supports normalize filter output during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function normalizeFilterOutput(ast: SchemaAST.AST, out: Schema.FilterOutput, input?: unknown, options?: SchemaAST.ParseOptions): Issue | undefined
{
    if (Array.isArray(out))
    {
        if (!Arr.isReadonlyArrayNonEmpty(out))
        {
            return undefined;
        }

        return out.length === 1
            ? makeFilterIssue(out[0], input, options)
            : new Composite(ast, Arr.map(out, (entry) => makeFilterIssue(entry, input, options)), input, options);
    }

    return makeSingle(out as undefined | boolean | Schema.FilterIssue, input, options);
}

/**
 * A function type that converts an {@link Issue} into a formatted
 * representation. Specialisation of the generic `Formatter` from
 * `Formatter.ts` with `Value` fixed to `Issue`.
 *
 * @category formatting
 * @since 1.0.0
 */
export interface Formatter<out Format> extends FormatterI<Issue, Format>
{
}

/**
 * Callback type used to format {@link Leaf} issues into strings.
 *
 * @category formatting
 * @since 1.0.0
 */
export type LeafHook = (issue: Leaf) => string;

/**
 * Returns the built-in {@link LeafHook} used by default formatters.
 *
 * @category formatting
 * @since 1.0.0
 */
export const defaultLeafHook: LeafHook = (issue): string =>
{
    const message = findMessage(issue);
    if (message !== undefined)
    {return message;}

    switch (issue._tag)
    {
        case "InvalidType":
            return getExpectedMessage(InternalAnnotations.getExpected(issue.ast), issue);
        case "InvalidValue": {
            const expected = findExpected(issue);
            if (expected !== undefined)
            {return getExpectedMessage(expected, issue);}

            const input = formatInput(issue);
            return input === undefined ? "Expected a valid value" : `Invalid data ${input}`;
        }

        case "MissingKey":
            return "Missing key";
        case "UnexpectedKey": {
            const input = formatInput(issue);
            return input === undefined ? "Expected no excess property" : `Unexpected key with value ${input}`;
        }

        case "Forbidden":
            return "Forbidden operation";
        case "OneOf": {
            const input = formatInput(issue);
            return input === undefined
                ? "Expected exactly one member to match"
                : `Expected exactly one member to match the input ${input}`;
        }
    }
};

/**
 * Callback type used to format {@link Filter} issues into strings.
 *
 * @category formatting
 * @since 1.0.0
 */
export type CheckHook = (issue: Filter) => string | undefined;

/**
 * Returns the built-in {@link CheckHook} used by default formatters.
 *
 * @category formatting
 * @since 1.0.0
 */
export const defaultCheckHook: CheckHook = (issue): string | undefined => findMessage(issue.issue) ?? findMessage(issue);

/**
 * Creates a {@link Formatter} that produces a `StandardSchemaV1.FailureResult`.
 *
 * @category formatting
 * @since 1.0.0
 */
export function makeFormatterStandardSchemaV1(options?: {
    readonly leafHook?: LeafHook | undefined;
    readonly checkHook?: CheckHook | undefined;
}): Formatter<StandardSchemaV1.FailureResult>
{
    return (issue) => ({
        issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook, options?.checkHook ?? defaultCheckHook)
    });
}

// A subtype of StandardSchemaV1.Issue
type DefaultIssue = {
    readonly message: string;
    readonly path: ReadonlyArray<PropertyKey>;
};

/**
 * Supports format input during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function formatInput(issue: Issue): string | undefined
{
    return hasInput(issue) ? format(issue.input) : undefined;
}

/**
 * Supports find expected during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function findExpected(issue: InvalidValue): string | undefined
{
    const expected = issue.annotations?.expected;
    return typeof expected === "string" ? expected : undefined;
}

/**
 * Supports get expected message during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function getExpectedMessage(expected: string, issue: Issue): string
{
    const input = formatInput(issue);
    return input === undefined ? `Expected ${expected}` : `Expected ${expected}, got ${input}`;
}

/**
 * Supports to default issues during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function toDefaultIssues(issue: Issue, path: ReadonlyArray<PropertyKey>, leafHook: LeafHook, checkHook: CheckHook): Array<DefaultIssue>
{
    switch (issue._tag)
    {
        case "Filter": {
            const message = checkHook(issue);
            if (message !== undefined)
            {
                return [ { path,
                    message } ];
            }

            if (issue.issue._tag !== "InvalidValue")
            {
                return toDefaultIssues(issue.issue, path, leafHook, checkHook);
            }

            const expected = findExpected(issue.issue);
            return [ {
                path,
                message: expected === undefined
                    ? getExpectedMessage(formatCheck(issue.filter), issue)
                    : getExpectedMessage(expected, issue.issue)
            } ];
        }

        case "Encoding":
            return toDefaultIssues(issue.issue, path, leafHook, checkHook);
        case "Pointer":
            return toDefaultIssues(issue.issue, [ ...path, ...issue.path ], leafHook, checkHook);
        case "Composite":
            return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook));
        case "AnyOf": {
            if (issue.issues.length === 0)
            {
                return [ {
                    path,
                    message: findMessage(issue) ?? getExpectedMessage(InternalAnnotations.getExpected(issue.ast), issue)
                } ];
            }

            return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook));
        }

        default:
            return [ { path,
                message: leafHook(issue) } ];
    }
}

/**
 * Supports format check during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function formatCheck<T>(check: SchemaAST.Check<T>): string
{
    const expected = check.annotations?.expected;
    if (typeof expected === "string")
    {return expected;}

    switch (check._tag)
    {
        case "Filter":
            return "<filter>";
        case "FilterGroup":
            return check.checks.map((check) => formatCheck(check)).join(" & ");
    }
}

/**
 * Creates a {@link Formatter} that converts an {@link Issue} into a
 * human-readable multi-line string.
 *
 * @category formatting
 * @since 1.0.0
 */
export function makeFormatterDefault(): Formatter<string>
{
    return (issue) => formatIssue(issue, "");
}

/**
 * Supports default formatter during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const defaultFormatter = makeFormatterDefault();

/**
 * Supports format issue during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function formatIssue(issue: Issue, path: string): string
{
    let message: string;
    switch (issue._tag)
    {
        case "Filter": {
            const annotated = defaultCheckHook(issue);
            if (annotated !== undefined)
            {
                message = annotated;
            }
            else
            {
                if (issue.issue._tag !== "InvalidValue")
                {
                    return formatIssue(issue.issue, path);
                }

                const expected = findExpected(issue.issue);
                message = expected === undefined
                    ? getExpectedMessage(formatCheck(issue.filter), issue)
                    : getExpectedMessage(expected, issue.issue);
            }

            break;
        }

        case "Encoding":
            return formatIssue(issue.issue, path);
        case "Pointer":
            return formatIssue(issue.issue, path + formatPath(issue.path));
        case "Composite":
        case "AnyOf": {
            if (issue._tag === "Composite" || issue.issues.length > 0)
            {
                return issue.issues.map((issue) => formatIssue(issue, path)).join("\n");
            }

            message = findMessage(issue) ?? getExpectedMessage(InternalAnnotations.getExpected(issue.ast), issue);
            break;
        }

        default:
            message = defaultLeafHook(issue);
            break;
    }

    return path ? `${message}\n  at ${path}` : message;
}

/**
 * Supports find message during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
function findMessage(issue: Issue): string | undefined
{
    if (issue._tag === "Pointer")
    {return;}

    if (issue._tag === "Encoding")
    {return findMessage(issue.issue);}

    const annotations = issue._tag === "Filter"
        ? issue.filter.annotations
        : "annotations" in issue
            ? issue.annotations
            : issue.ast.annotations;
    const message = annotations?.[issue._tag === "MissingKey"
        ? "messageMissingKey"
        : issue._tag === "UnexpectedKey"
            ? "messageUnexpectedKey"
            : "message"];
    if (typeof message === "string")
    {return message;}
}
