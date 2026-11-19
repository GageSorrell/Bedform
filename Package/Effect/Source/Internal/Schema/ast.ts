/**
 * Represents Effect schemas as runtime trees: node types and guards, parse
 * options, and the encodings and checks attached to nodes. Adapted from Effect
 * 4.0.5 for synchronous parsing.
 *
 * @module @bedform/effect/Internal/Schema/ast
 *
 * @file      ast.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

import * as InternalRecord from "../record.js";
import * as InternalSync from "./synchronous.js";

import * as Arr from "../../Array.js";

import { format, formatPropertyKey } from "../../Formatter.js";

import { identity, memoize, memoizeIdempotent } from "../../Function.js";

import * as InternalAnnotations from "./annotations.js";

import * as InternalParser from "./parser.js";

import * as Pipeable from "../../Pipeable.js";

import * as Predicate from "../../Predicate.js";

import * as Result from "../../Result.js";

import type * as Schema from "../../Schema.js";

import * as SchemaGetter from "../../SchemaGetter.js";

import * as SchemaIssue from "../../SchemaIssue.js";

import type * as SchemaParser from "../../SchemaParser.js";

import * as SchemaTransformation from "../../SchemaTransformation.js";

/**
 * Discriminated union of all AST node types.
 *
 * @category models
 * @since 1.0.0
 */
export type AST = Declaration | Null | Undefined | Void | Never | Unknown | Any | String | Number | Boolean | BigInt | Symbol | Literal | UniqueSymbol | ObjectKeyword | Enum | TemplateLiteral | Arrays | Objects | Union | Suspend;

/**
 * Supports make guard during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const makeGuard = <T extends AST["_tag"]>(tag: T) =>
{
    return (ast: AST): ast is Extract<AST, {
        _tag: T;
    }> => ast._tag === tag;
};

/**
 * Returns `true` if the value is an {@link AST} node (any variant).
 *
 * @category guards
 * @since 1.0.0
 */
export const isAST = (u: unknown): u is AST =>
{
    return Predicate.hasProperty(u, TypeId) && u[TypeId] === TypeId;
};

/**
 * Narrows an {@link AST} to {@link Declaration}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isDeclaration = makeGuard("Declaration");

/**
 * Narrows an {@link AST} to {@link Null}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isNull = makeGuard("Null");

/**
 * Narrows an {@link AST} to {@link Undefined}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isUndefined = makeGuard("Undefined");

/**
 * Narrows an {@link AST} to {@link Void}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isVoid = makeGuard("Void");

/**
 * Narrows an {@link AST} to {@link Never}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isNever = makeGuard("Never");

/**
 * Narrows an {@link AST} to {@link Unknown}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isUnknown = makeGuard("Unknown");

/**
 * Narrows an {@link AST} to {@link Any}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isAny = makeGuard("Any");

/**
 * Narrows an {@link AST} to {@link String}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isString = makeGuard("String");

/**
 * Narrows an {@link AST} to {@link Number}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isNumber = makeGuard("Number");

/**
 * Narrows an {@link AST} to {@link Boolean}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isBoolean = makeGuard("Boolean");

/**
 * Narrows an {@link AST} to {@link BigInt}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isBigInt = makeGuard("BigInt");

/**
 * Narrows an {@link AST} to {@link Symbol}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isSymbol = makeGuard("Symbol");

/**
 * Narrows an {@link AST} to {@link Literal}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isLiteral = makeGuard("Literal");

/**
 * Narrows an {@link AST} to {@link UniqueSymbol}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isUniqueSymbol = makeGuard("UniqueSymbol");

/**
 * Narrows an {@link AST} to {@link ObjectKeyword}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isObjectKeyword = makeGuard("ObjectKeyword");

/**
 * Narrows an {@link AST} to {@link Enum}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isEnum = makeGuard("Enum");

/**
 * Narrows an {@link AST} to {@link TemplateLiteral}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isTemplateLiteral = makeGuard("TemplateLiteral");

/**
 * Narrows an {@link AST} to {@link Arrays}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isArrays = makeGuard("Arrays");

/**
 * Narrows an {@link AST} to {@link Objects}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isObjects = makeGuard("Objects");

/**
 * Narrows an {@link AST} to {@link Union}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isUnion = makeGuard("Union");

/**
 * Narrows an {@link AST} to {@link Suspend}.
 *
 * @category guards
 * @since 1.0.0
 */
export const isSuspend = makeGuard("Suspend");

/**
 * Represents a single step in an {@link Encoding} chain.
 *
 * @category models
 * @since 1.0.0
 */
export interface Link
{
    readonly to: AST;
    readonly transformation: SchemaTransformation.Transformation<any, any, never, never>;
}

/**
 * Constructs a {@link Link}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Link: new (to: AST, transformation: SchemaTransformation.Transformation<any, any, never, never>) => Link = class
{
    readonly to: AST;
    readonly transformation: SchemaTransformation.Transformation<any, any, never, never>;
    constructor(to: AST, transformation: SchemaTransformation.Transformation<any, any, never, never>)
    {
        this.to = to;
        this.transformation = transformation;
    }
};

/**
 * A non-empty chain of {@link Link} values representing the transformation
 * steps between a schema's decoded (type) form and its encoded (wire) form.
 *
 * @category models
 * @since 1.0.0
 */
export type Encoding = readonly [
    Link,
    ...Array<Link>
];

/**
 * Options that control schema parsing, validation, transformation, and output behavior.
 *
 * @category options
 * @since 1.0.0
 */
export interface ParseOptions
{
    /**
     * Controls how many parsing errors are reported.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly errors?: "first" | "all" | undefined;

    /**
     * Controls how object parsing handles keys that are not declared by the schema.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly onExcessProperty?: "ignore" | "error" | undefined;

    /**
     * Whether to disable checks while still applying defaults and
     * transformations.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly disableChecks?: boolean | undefined;

    /**
     * Whether schema issues should retain and report rejected input values.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly reportInput?: boolean | undefined;
}

/**
 * Supports default parse options during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const defaultParseOptions: ParseOptions = {};

/**
 * Represents per-property metadata attached to an AST node's `context` field.
 *
 * @category models
 * @since 1.0.0
 */
export interface Context
{
    readonly isOptional: boolean;
    readonly isMutable: boolean;

    /**
     *  Used for constructor default values (e.g. `withConstructorDefault` API)
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly constructorDefault: (() => Result.Result<unknown, SchemaIssue.Issue>) | undefined;
    readonly annotations: Schema.Annotations.Key<unknown> | undefined;
}

/**
 * Constructs a {@link Context}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Context: new (isOptional: boolean, isMutable: boolean, /**
                                                                     *  Used for constructor default values (e.g. `withConstructorDefault` API)
                                                                     *
                                                                     * @category Utilities
                                                                     * @since 1.0.0
                                                                     */ constructorDefault?: (() => Result.Result<unknown, SchemaIssue.Issue>) | undefined, annotations?: Schema.Annotations.Key<unknown> | undefined) => Context = class
{
    readonly isOptional: boolean;
    readonly isMutable: boolean;

    /**
     *  Used for constructor default values (e.g. `withConstructorDefault` API)
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly constructorDefault: (() => Result.Result<unknown, SchemaIssue.Issue>) | undefined;
    readonly annotations: Schema.Annotations.Key<unknown> | undefined;
    constructor(isOptional: boolean, isMutable: boolean,

        /**
         *  Used for constructor default values (e.g. `withConstructorDefault` API)
         *
         * @category Utilities
         * @since 1.0.0
         */
        constructorDefault: (() => Result.Result<unknown, SchemaIssue.Issue>) | undefined = undefined, annotations: Schema.Annotations.Key<unknown> | undefined = undefined)
    {
        this.isOptional = isOptional;
        this.isMutable = isMutable;
        this.constructorDefault = constructorDefault;
        this.annotations = annotations;
    }
};

/**
 * Non-empty array of validation {@link Check} values attached to an AST node's
 * `checks` field.
 *
 * @category models
 * @since 1.0.0
 */
export type Checks = readonly [
    Check<any>,
    ...Array<Check<any>>
];

const TypeId = "~effect/Schema";

interface ASTNode
{
    readonly [TypeId]: typeof TypeId;
    readonly _tag: string;
    readonly annotations: Schema.Annotations.Annotations | undefined;
    readonly checks: Checks | undefined;
    readonly encoding: Encoding | undefined;
    readonly context: Context | undefined;
    toString(): string;
}

abstract class ASTNodeImpl implements ASTNode
{
    readonly [TypeId] = TypeId;
    abstract readonly _tag: string;
    readonly annotations: Schema.Annotations.Annotations | undefined;
    readonly checks: Checks | undefined;
    readonly encoding: Encoding | undefined;
    readonly context: Context | undefined;
    constructor(annotations: Schema.Annotations.Annotations | undefined = undefined, checks: Checks | undefined = undefined, encoding: Encoding | undefined = undefined, context: Context | undefined = undefined)
    {
        this.annotations = annotations;
        this.checks = checks;
        this.encoding = encoding;
        this.context = context;
    }
    toString()
    {
        return `<${this._tag}>`;
    }
}

type DeclarationRun = (typeParameters: ReadonlyArray<AST>) => (input: unknown, self: Declaration, options: ParseOptions) => Result.Result<any, SchemaIssue.Issue>;

/**
 * AST node for user-defined opaque types with custom parsing logic.
 *
 * @category models
 * @since 1.0.0
 */
export interface Declaration extends ASTNode
{
    readonly _tag: "Declaration";
    readonly typeParameters: ReadonlyArray<AST>;
    readonly run: DeclarationRun;
    readonly encodingChecks: Checks | undefined;

    /**
     * Parser factory {@link flip} swaps in, so a declaration can behave
     * differently when encoding. `undefined` reuses `run`.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly encodingRun: DeclarationRun | undefined;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST): Declaration;

    /**
     * Supports declaration during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): Declaration;

    /**
     * Supports declaration during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Declaration}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Declaration: new (typeParameters: ReadonlyArray<AST>, run: DeclarationRun, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks, encodingRun?: DeclarationRun) => Declaration = class extends ASTNodeImpl
{
    readonly _tag = "Declaration";
    readonly typeParameters: ReadonlyArray<AST>;
    readonly run: DeclarationRun;
    readonly encodingChecks: Checks | undefined;

    /**
     * Parser factory {@link flip} swaps in, so a declaration can behave
     * differently when encoding. `undefined` reuses `run`.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly encodingRun: DeclarationRun | undefined;
    constructor(typeParameters: ReadonlyArray<AST>, run: DeclarationRun, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks, encodingRun?: DeclarationRun)
    {
        super(annotations, checks, encoding, context);
        this.typeParameters = typeParameters;
        this.run = run;
        this.encodingChecks = encodingChecks;
        this.encodingRun = encodingRun;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser
    {
        let run: ReturnType<typeof this.run>;
        return (input, options) =>
        {
            if (input === InternalParser.missing)
            {return InternalParser.missingExit;}

            return (run ??= this.run(this.typeParameters))(input, this, options);
        };
    }
    private _rebuild(recur: (ast: AST) => AST, checks: Checks | undefined, encodingChecks: Checks | undefined, run: DeclarationRun, encodingRun: DeclarationRun | undefined)
    {
        const tps = mapOrSame(this.typeParameters, recur);
        return tps === this.typeParameters && checks === this.checks && encodingChecks === this.encodingChecks &&
            run === this.run && encodingRun === this.encodingRun ?
            this :
            new Declaration(tps, run, this.annotations, checks, undefined, this.context, encodingChecks, encodingRun);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST)
    {
        return this._rebuild(recur, this.checks, this.encodingChecks, this.run, this.encodingRun);
    }

    /**
     * Supports expected during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST)
    {
        return this._rebuild(recur, this.encodingChecks, this.checks, this.encodingRun ?? this.run, this.run);
    }

    /**
     * Supports expected during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        const expected = this.annotations?.expected;
        if (typeof expected === "string")
        {return expected;}

        return "<Declaration>";
    }
};

/**
 * AST node matching the `null` literal value.
 *
 * @category models
 * @since 1.0.0
 */
export interface Null extends ASTNode
{
    readonly _tag: "Null";

    /**
     * Supports null during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports null during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Null}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Null: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Null = class extends ASTNodeImpl
{
    readonly _tag = "Null";

    /**
     * Supports null_ during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromConst(this, null);
    }

    /**
     * Supports null_ during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "null";
    }
};

const null_ = new Null();

export {
/**
 * Provides the singleton {@link Null} AST instance.
 *
 * @category constants
 * @since 1.0.0
 */
    null_ as null };

/**
 * AST node matching the `undefined` value.
 *
 * @category models
 * @since 1.0.0
 */
export interface Undefined extends ASTNode
{
    readonly _tag: "Undefined";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports undefined during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST;

    /**
     * Supports undefined during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Undefined}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Undefined: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Undefined = class extends ASTNodeImpl
{
    readonly _tag = "Undefined";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromConst(this, undefined);
    }

    /**
     * Supports undefined to null during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST
    {
        return replaceEncoding(this, [ undefinedToNull ]);
    }

    /**
     * Supports undefined to null during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "undefined";
    }
};

const undefinedToNull = new Link(null_, new SchemaTransformation.Transformation(SchemaGetter.transform(() => undefined), SchemaGetter.transform(() => null)));

const undefined_ = new Undefined();

export {
/**
 * Provides the singleton {@link Undefined} AST instance.
 *
 * @category constants
 * @since 1.0.0
 */
    undefined_ as undefined };

/**
 * AST node matching TypeScript `void` return-value semantics.
 *
 * @category models
 * @since 1.0.0
 */
export interface Void extends ASTNode
{
    readonly _tag: "Void";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): (input: unknown) => InternalParser.Success<undefined, never> | InternalParser.Success<typeof InternalParser.missing, never>;

    /**
     * Supports void during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST;

    /**
     * Supports void during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Void}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Void: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Void = class extends ASTNodeImpl
{
    readonly _tag = "Void";

    /**
     * Supports succeed during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        const succeed = InternalParser.succeed(undefined);
        return (input: unknown) => input === InternalParser.missing ? InternalParser.missingExit : succeed;
    }

    /**
     * Supports void_ during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST
    {
        return replaceEncoding(this, [ undefinedToNull ]);
    }

    /**
     * Supports void_ during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "void";
    }
};

const void_ = new Void();

export {
/**
 * Provides the singleton {@link Void} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
    void_ as void };

/**
 * AST node representing the `never` type — no value matches.
 *
 * @category models
 * @since 1.0.0
 */
export interface Never extends ASTNode
{
    readonly _tag: "Never";

    /**
     * Supports never during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports never during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Never}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Never: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Never = class extends ASTNodeImpl
{
    readonly _tag = "Never";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isNever);
    }

    /**
     * Supports never during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "never";
    }
};

/**
 * Provides the singleton {@link Never} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const never = new Never();

/**
 * AST node representing the `any` type — every value matches.
 *
 * @category models
 * @since 1.0.0
 */
export interface Any extends ASTNode
{
    readonly _tag: "Any";

    /**
     * Supports any during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports any during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Any}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Any: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Any = class extends ASTNodeImpl
{
    readonly _tag = "Any";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isUnknown);
    }

    /**
     * Supports any during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "any";
    }
};

/**
 * Provides the singleton {@link Any} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const any = new Any();

/**
 * AST node representing the `unknown` type — every value matches.
 *
 * @category models
 * @since 1.0.0
 */
export interface Unknown extends ASTNode
{
    readonly _tag: "Unknown";

    /**
     * Supports unknown during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports unknown during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Unknown}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Unknown: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Unknown = class extends ASTNodeImpl
{
    readonly _tag = "Unknown";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isUnknown);
    }

    /**
     * Supports unknown during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "unknown";
    }
};

/**
 * Provides the singleton {@link Unknown} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const unknown = new Unknown();

/**
 * AST node matching the TypeScript `object` type — accepts objects, arrays,
 * and functions (anything non-primitive and non-null).
 *
 * @category models
 * @since 1.0.0
 */
export interface ObjectKeyword extends ASTNode
{
    readonly _tag: "ObjectKeyword";

    /**
     * Supports object keyword during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports object keyword during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link ObjectKeyword}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const ObjectKeyword: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => ObjectKeyword = class extends ASTNodeImpl
{
    readonly _tag = "ObjectKeyword";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isObjectKeyword);
    }

    /**
     * Supports object keyword during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "object | array | function";
    }
};

/**
 * Provides the singleton {@link ObjectKeyword} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const objectKeyword = new ObjectKeyword();

/**
 * AST node representing a TypeScript `enum`.
 *
 * @category models
 * @since 1.0.0
 */
export interface Enum extends ASTNode
{
    readonly _tag: "Enum";
    readonly enums: ReadonlyArray<readonly [
        string,
        string | number
    ]>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports enum during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports enum during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Enum}. Numeric values must be finite.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Enum: new (enums: ReadonlyArray<readonly [
    string,
    string | number
]>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context) => Enum = class extends ASTNodeImpl
{
    readonly _tag = "Enum";
    readonly enums: ReadonlyArray<readonly [
        string,
        string | number
    ]>;
    constructor(enums: ReadonlyArray<readonly [
        string,
        string | number
    ]>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context)
    {
        super(annotations, checks, encoding, context);
        for (const [ , value ] of enums)
        {
            if (typeof value === "number" && !globalThis.Number.isFinite(value))
            {
                throw new Error(`A numeric enum value must be finite, got ${format(value)}`);
            }
        }

        this.enums = enums;
    }

    /**
     * Supports values during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        const values = new Set<unknown>(this.enums.map(([ , v ]) => v));
        return fromRefinement(this, (input): input is typeof this.enums[number][1] => values.has(input));
    }

    /**
     * Supports template literal part during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports template literal part during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return this.enums.map(([ _, value ]) => JSON.stringify(value)).join(" | ");
    }
};

type TemplateLiteralPart = String | Number | BigInt | Literal | TemplateLiteral | Union<TemplateLiteralPart>;

/**
 * Supports format template literal path during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const formatTemplateLiteralPath = (path: string | number): string =>
{
    return typeof path === "number" ? `parts[${path}]` : path;
};

/**
 * Supports is template literal part during synchronous schema processing.
 *
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Internal
 * @since 1.0.0
 */
const isTemplateLiteralPart = (ast: AST, path: string | number, validated: Set<AST>): ast is TemplateLiteralPart =>
{
    if (validated.has(ast))
    {return true;}

    if (ast.encoding)
    {
        throw new Error(`TemplateLiteral parts cannot have an encoding at ${formatTemplateLiteralPath(path)}`);
    }

    let valid: boolean;
    switch (ast._tag)
    {
        case "String":
        case "Number":
        case "BigInt":
            valid = true;
            break;
        case "Literal":
            valid = !ast.checks;
            break;
        case "TemplateLiteral": {
            const currentPath = formatTemplateLiteralPath(path);
            valid = !ast.checks &&
                ast.parts.every((part, index) => isTemplateLiteralPart(part, `${currentPath}.parts[${index}]`, validated));
            break;
        }

        case "Union": {
            const currentPath = formatTemplateLiteralPath(path);
            valid = !ast.checks &&
                ast.types.every((part, index) => isTemplateLiteralPart(part, `${currentPath}.types[${index}]`, validated));
            break;
        }

        default:
            return false;
    }

    if (valid)
    {validated.add(ast);}

    return valid;
};

/**
 * AST node representing a TypeScript template literal type
 * (e.g. `` `user_${string}` ``).
 *
 * @category models
 * @since 1.0.0
 */
export interface TemplateLiteral extends ASTNode
{
    readonly _tag: "TemplateLiteral";
    readonly parts: ReadonlyArray<AST>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly encodedParts: ReadonlyArray<TemplateLiteralPart>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly literals: ReadonlyArray<string | undefined>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly suffixLengths: ReadonlyArray<number>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler): SchemaParser.Parser;

    /**
     * Supports template literal during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;

    /**
     * Supports template literal during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): string | undefined;
}

/**
 * Constructs a {@link TemplateLiteral}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const TemplateLiteral: new (parts: ReadonlyArray<AST>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context) => TemplateLiteral = class extends ASTNodeImpl
{
    readonly _tag = "TemplateLiteral";
    readonly parts: ReadonlyArray<AST>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly encodedParts: ReadonlyArray<TemplateLiteralPart>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly literals: ReadonlyArray<string | undefined>;

    /**
     * Supports encoded parts during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly suffixLengths: ReadonlyArray<number>;
    constructor(parts: ReadonlyArray<AST>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context)
    {
        super(annotations, checks, encoding, context);
        const encodedParts: Array<TemplateLiteralPart> = [];
        const literals: Array<string | undefined> = [];
        const validated = new Set<AST>();
        for (let index = 0; index < parts.length; index++)
        {
            const part = parts[index];
            if (!isTemplateLiteralPart(part, index, validated))
            {
                throw new Error(`Invalid TemplateLiteral part ${part._tag}`);
            }

            encodedParts.push(part);
            literals.push(part._tag === "Literal" ? globalThis.String(part.literal) : undefined);
        }

        const suffixLengths = new Array<number>(encodedParts.length + 1);
        suffixLengths[encodedParts.length] = 0;
        for (let i = encodedParts.length - 1; i >= 0; i--)
        {
            suffixLengths[i] = suffixLengths[i + 1] + (literals[i]?.length ?? 0);
        }

        this.parts = parts;
        this.encodedParts = encodedParts;
        this.literals = literals;
        this.suffixLengths = suffixLengths;
    }

    /**
     * Supports tuple during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler): SchemaParser.Parser
    {
        const tuple = new Arrays(false, this.parts.map(partFromString), []);
        const parser = compile(decodeTo(string, tuple, templateLiteralTransformation(this)));
        return (input, options) =>
        {
            if (input === InternalParser.missing)
            {return InternalParser.missingExit;}

            const result = parser(input, options);
            if ((result as Result.Result<unknown, unknown>)._tag === "Success")
            {
                return InternalParser.sameExit;
            }

            return Result.mapBoth(result, {
                onSuccess: () => input,
                onFailure: (issue) => new SchemaIssue.Composite(this, [ issue ], input, options)
            });
        };
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "string";
    }

    /**
     * Supports template literal parser during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): string | undefined
    {
        return segmentTemplateLiteralParts(this, s, options) === undefined ? undefined : s;
    }
};

/**
 * Supports template literal parser during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const templateLiteralParser = (parts: ReadonlyArray<AST>): Arrays =>
{
    // Encoded members can overlap even when decoding selects exactly one member.
    // Match their spellings here; the original tuple enforces the union's mode.
    const normalize = memoize((encoded: AST): AST =>
    {
        if (encoded._tag !== "Union")
        {return encoded;}

        const types = mapOrSame(encoded.types, normalize);
        return (encoded.options?.mode ?? "anyOf") === "anyOf" && types === encoded.types
            ? encoded
            : new Union(types, encoded.options === undefined ? undefined : { ...encoded.options,
                mode: "anyOf" }, encoded.annotations, encoded.checks, undefined, encoded.context);
    });
    const template = new TemplateLiteral(parts.map((part) => normalize(toEncoded(part))));
    const tuple = new Arrays(false, parts.map(partFromString), []);
    return decodeTo(template, tuple, templateLiteralTransformation(template));
};

/**
 * Supports template literal transformation during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const templateLiteralTransformation = (template: TemplateLiteral) =>
{
    return new SchemaTransformation.Transformation(SchemaGetter.transformResult((s: string, options) =>
    {
        const segments = segmentTemplateLiteralParts(template, s, options);
        if (segments)
        {return Result.succeed(segments);}

        return Result.fail(new SchemaIssue.InvalidValue({ expected: "a string matching template literal parts" }, s, options));
    }), SchemaGetter.transform((parts: ReadonlyArray<string>) => parts.join("")));
};

/**
 * AST node matching a specific `unique symbol` value.
 *
 * @category models
 * @since 1.0.0
 */
export interface UniqueSymbol extends ASTNode
{
    readonly _tag: "UniqueSymbol";
    readonly symbol: symbol;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports unique symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports unique symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link UniqueSymbol}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const UniqueSymbol: new (symbol: symbol, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context) => UniqueSymbol = class extends ASTNodeImpl
{
    readonly _tag = "UniqueSymbol";
    readonly symbol: symbol;
    constructor(symbol: symbol, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context)
    {
        super(annotations, checks, encoding, context);
        this.symbol = symbol;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromConst(this, this.symbol);
    }

    /**
     * Supports literal value during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports literal value during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return globalThis.String(this.symbol);
    }
};

/**
 * The set of primitive types that can appear as a {@link Literal} value.
 *
 * @category models
 * @since 1.0.0
 */
export type LiteralValue = string | number | boolean | bigint;

/**
 * AST node matching an exact primitive value (string, number, boolean, or
 * bigint).
 *
 * @category models
 * @since 1.0.0
 */
export interface Literal extends ASTNode
{
    readonly _tag: "Literal";
    readonly literal: LiteralValue;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, _options: ParseOptions): LiteralValue | undefined;

    /**
     * Supports literal during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST;

    /**
     * Supports literal during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports literal during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Literal}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Literal: new (literal: LiteralValue, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context) => Literal = class extends ASTNodeImpl
{
    readonly _tag = "Literal";
    readonly literal: LiteralValue;
    constructor(literal: LiteralValue, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context)
    {
        super(annotations, checks, encoding, context);
        if (typeof literal === "number" && !globalThis.Number.isFinite(literal))
        {
            throw new Error(`A numeric literal must be finite, got ${format(literal)}`);
        }

        this.literal = literal;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromConst(this, this.literal);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, _options: ParseOptions): LiteralValue | undefined
    {
        return s === globalThis.String(this.literal) ? this.literal : undefined;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST
    {
        return typeof this.literal === "bigint" ? literalToString(this) : this;
    }

    /**
     * Supports literal to string during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports literal to string during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
    }
};

/**
 * Supports literal to string during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const literalToString = (ast: Literal): Literal =>
{
    const literalAsString = globalThis.String(ast.literal);
    return replaceEncoding(ast, [
        new Link(new Literal(literalAsString), new SchemaTransformation.Transformation(SchemaGetter.transform(() => ast.literal), SchemaGetter.transform(() => literalAsString)))
    ]);
};

/**
 * AST node matching any `string` value.
 *
 * @category models
 * @since 1.0.0
 */
export interface String extends ASTNode
{
    readonly _tag: "String";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports string during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): string | undefined;

    /**
     * Supports string during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link String}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const String: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => String = class extends ASTNodeImpl
{
    readonly _tag = "String";

    /**
     * Supports checks during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isString);
    }

    /**
     * Supports checks during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): string | undefined
    {
        const checks = this.checks;
        return checks && !options.disableChecks && collectIssues(checks, s, undefined, this, options) ? undefined : s;
    }

    /**
     * Supports string during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "string";
    }
};

/**
 * Provides the singleton {@link String} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const string = new String();

/**
 * AST node matching any `number` value (including `NaN`, `Infinity`,
 * `-Infinity`).
 *
 * @category models
 * @since 1.0.0
 */
export interface Number extends ASTNode
{
    readonly _tag: "Number";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchKey(s: string, options: ParseOptions): number | undefined;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): number | undefined;

    /**
     * Supports number during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST;

    /**
     * Supports number during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports number during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Number}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Number: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Number = class extends ASTNodeImpl
{
    readonly _tag = "Number";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isNumber);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchKey(s: string, options: ParseOptions): number | undefined
    {
        return this._match(isStringNumberRegExp, s, options);
    }

    /**
     * Supports value during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): number | undefined
    {
        return this._match(isStringFiniteRegExp, s, options);
    }
    private _match(regexp: RegExp, s: string, options: ParseOptions): number | undefined
    {
        if (!regexp.test(s))
        {return undefined;}

        const value = globalThis.Number(s);
        if (options.disableChecks || !this.checks)
        {return value;}

        return collectIssues(this.checks, value, undefined, this, options) ? undefined : value;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    toCodecJson(): AST
    {
        if (this.checks &&
            (hasCheck(this.checks, "effect/schema/isFinite") || hasCheck(this.checks, "effect/schema/isInt")))
        {
            return this;
        }

        return replaceEncoding(this, [ numberToJson ]);
    }

    /**
     * Supports has check during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports has check during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "number";
    }
};

/**
 * Supports has check during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const hasCheck = (checks: ReadonlyArray<Check<unknown>>, id: string): boolean =>
{
    return checks.some((check) => (check.annotations?.["~representation"] as { id?: string } | undefined)?.id === id ||
        (check._tag === "FilterGroup" && hasCheck(check.checks, id)));
};

/**
 * Provides the singleton {@link Number} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const number = new Number();

/**
 * AST node matching any `boolean` value (`true` or `false`).
 *
 * @category models
 * @since 1.0.0
 */
export interface Boolean extends ASTNode
{
    readonly _tag: "Boolean";

    /**
     * Supports boolean during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports boolean during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Boolean}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Boolean: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Boolean = class extends ASTNodeImpl
{
    readonly _tag = "Boolean";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isBoolean);
    }

    /**
     * Supports boolean during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "boolean";
    }
};

/**
 * Provides the singleton {@link Boolean} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const boolean = new Boolean();

/**
 * AST node matching any `symbol` value.
 *
 * @category models
 * @since 1.0.0
 */
export interface Symbol extends ASTNode
{
    readonly _tag: "Symbol";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchKey(s: symbol, options: ParseOptions): symbol | undefined;

    /**
     * Supports symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Symbol}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Symbol: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => Symbol = class extends ASTNodeImpl
{
    readonly _tag = "Symbol";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isSymbol);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchKey(s: symbol, options: ParseOptions): symbol | undefined
    {
        if (options.disableChecks || !this.checks)
        {return s;}

        return collectIssues(this.checks, s, undefined, this, options) ? undefined : s;
    }

    /**
     * Supports symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports symbol during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "symbol";
    }
};

/**
 * Provides the singleton {@link Symbol} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const symbol = new Symbol();

/**
 * AST node matching any `bigint` value.
 *
 * @category models
 * @since 1.0.0
 */
export interface BigInt extends ASTNode
{
    readonly _tag: "BigInt";

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): bigint | undefined;

    /**
     * Supports big int during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports big int during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link BigInt}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const BigInt: new (annotations?: Schema.Annotations.Annotations | undefined, checks?: Checks | undefined, encoding?: Encoding | undefined, context?: Context | undefined) => BigInt = class extends ASTNodeImpl
{
    readonly _tag = "BigInt";

    /**
     * Supports value during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser()
    {
        return fromRefinement(this, Predicate.isBigInt);
    }

    /**
     * Supports value during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): bigint | undefined
    {
        if (!isStringBigIntRegExp.test(s))
        {return undefined;}

        const value = globalThis.BigInt(s);
        if (options.disableChecks || !this.checks)
        {return value;}

        return collectIssues(this.checks, value, undefined, this, options) ? undefined : value;
    }

    /**
     * Supports big int during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */

    /**
     * Supports big int during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "bigint";
    }
};

/**
 * Provides the singleton {@link BigInt} AST instance.
 *
 * @category constructors
 * @since 1.0.0
 */
export const bigInt = new BigInt();

/**
 * AST node for array-like types — both tuples and arrays.
 *
 * @category models
 * @since 1.0.0
 */
export interface Arrays extends ASTNode
{
    readonly _tag: "Arrays";
    readonly isMutable: boolean;
    readonly elements: ReadonlyArray<AST>;
    readonly rest: ReadonlyArray<AST>;
    readonly encodingChecks: Checks | undefined;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField?: SchemaParser.Compiler): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST): Arrays;

    /**
     * Supports arrays during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): Arrays;

    /**
     * Supports arrays during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Arrays}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Arrays: new (isMutable: boolean, elements: ReadonlyArray<AST>, rest: ReadonlyArray<AST>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks) => Arrays = class extends ASTNodeImpl
{
    readonly _tag = "Arrays";
    readonly isMutable: boolean;
    readonly elements: ReadonlyArray<AST>;
    readonly rest: ReadonlyArray<AST>;
    readonly encodingChecks: Checks | undefined;
    constructor(isMutable: boolean, elements: ReadonlyArray<AST>, rest: ReadonlyArray<AST>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks)
    {
        super(annotations, checks, encoding, context);
        this.isMutable = isMutable;
        this.elements = elements;
        this.rest = rest;
        this.encodingChecks = encodingChecks;
        let hasOptional = false;
        for (let i = 0; i < elements.length; i++)
        {
            if (isOptional(elements[i]))
            {
                hasOptional = true;
            }
            else if (hasOptional)
            {
                throw new Error("A required element cannot follow an optional element. ts(1257)");
            }
        }

        if (hasOptional && rest.length > 1)
        {
            throw new Error("A required element cannot follow an optional element. ts(1257)");
        }

        // An optional element cannot follow a rest element.ts(1266)
        for (let i = 1; i < rest.length; i++)
        {
            if (isOptional(rest[i]))
            {
                throw new Error("An optional element cannot follow a rest element. ts(1266)");
            }
        }
    }

    /**
     * Supports elements during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField: SchemaParser.Compiler = compile): SchemaParser.Parser { return InternalSync.arrays(this, compile, compileField); }
    private _rebuild(recur: (ast: AST) => AST, checks: Checks | undefined, encodingChecks: Checks | undefined)
    {
        const elements = mapOrSame(this.elements, recur);
        const rest = mapOrSame(this.rest, recur);
        return elements === this.elements && rest === this.rest && checks === this.checks &&
            encodingChecks === this.encodingChecks ?
            this :
            new Arrays(this.isMutable, elements, rest, this.annotations, checks, undefined, this.context, encodingChecks);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST)
    {
        return this._rebuild(recur, this.checks, this.encodingChecks);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST)
    {
        return this._rebuild(recur, this.encodingChecks, this.checks);
    }

    /**
     * Supports finite pattern during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        return "array";
    }
};

/**
 * floating point or integer, with optional exponent
 *
 * @category Utilities
 * @since 1.0.0
 */
export const FinitePattern = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?";

/**
 * Returns the object keys that match the index signature parameter schema.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getIndexSignatureKeys = (input: {
    readonly [x: PropertyKey]: unknown;
}, parameter: IndexSignatureParameter, options: ParseOptions = defaultParseOptions): ReadonlyArray<PropertyKey> =>
{
    let stringKeys: ReadonlyArray<string> | undefined;
    let symbolKeys: ReadonlyArray<symbol> | undefined;

    /**
     * Supports go during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const go = (parameter: AST): ReadonlyArray<PropertyKey> =>
    {
        switch (parameter._tag)
        {
            case "String":
            case "TemplateLiteral":
                return (stringKeys ??= Object.keys(input)).filter((k) => parameter.matchPart(k, options) !== undefined);
            case "Number":
                return (stringKeys ??= Object.keys(input)).filter((k) => parameter.matchKey(k, options) !== undefined);
            case "Symbol":
                return (symbolKeys ??= Object.getOwnPropertySymbols(input)).filter((k) => Object.prototype.propertyIsEnumerable.call(input, k) && parameter.matchKey(k, options) !== undefined);
            case "Union":
                return [ ...new Set(parameter.types.flatMap(go)) ];
            default:
                return [];
        }
    };

    return go(parameterFromPropertyKey(toEncoded(parameter)));
};

/**
 * Represents a named property within an {@link Objects} node.
 *
 * @category models
 * @since 1.0.0
 */
export interface PropertySignature
{
    readonly name: PropertyKey;
    readonly type: AST;
}

/**
 * Constructs a {@link PropertySignature}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const PropertySignature: new (name: PropertyKey, type: AST) => PropertySignature = class
{
    readonly name: PropertyKey;
    readonly type: AST;
    constructor(name: PropertyKey, type: AST)
    {
        this.name = name;
        this.type = type;
    }
};

type IndexSignatureParameter = String | Number | Symbol | TemplateLiteral | Union<IndexSignatureParameter>;

/**
 * Supports is index signature parameter side during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isIndexSignatureParameterSide = (ast: AST): ast is IndexSignatureParameter =>
{
    switch (ast._tag)
    {
        case "String":
        case "Number":
        case "Symbol":
        case "TemplateLiteral":
            return true;
        case "Union":
            return ast.types.every(isIndexSignatureParameterSide);
        default:
            return false;
    }
};

/**
 * Supports is index signature parameter encoded side during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isIndexSignatureParameterEncodedSide = (ast: AST): boolean =>
{
    const encoded = getLastEncoding(ast);
    switch (encoded._tag)
    {
        case "String":
        case "Number":
        case "Symbol":
        case "TemplateLiteral":
            return true;
        case "Union":
            return encoded.types.every(isIndexSignatureParameterEncodedSide);
        default:
            return false;
    }
};

/**
 * Supports is index signature parameter during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isIndexSignatureParameter = (ast: AST): ast is IndexSignatureParameter =>
{
    return isIndexSignatureParameterSide(ast) && isIndexSignatureParameterEncodedSide(ast);
};

/**
 * Represents an index signature entry within an {@link Objects} node.
 *
 * @category models
 * @since 1.0.0
 */
export interface IndexSignature
{
    readonly parameter: IndexSignatureParameter;
    readonly type: AST;
}

/**
 * Constructs a {@link IndexSignature}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const IndexSignature: new (parameter: AST, type: AST) => IndexSignature = class
{
    readonly parameter: IndexSignatureParameter;
    readonly type: AST;
    constructor(parameter: AST, type: AST)
    {
        if (!isIndexSignatureParameter(parameter))
        {
            throw new Error(`Invalid index signature parameter ${parameter._tag}`);
        }

        this.parameter = parameter;
        this.type = type;
        if (isOptional(type) && !containsUndefined(type))
        {
            throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.");
        }
    }
};

/**
 * AST node for object-like schemas, including structs and records.
 *
 * @category models
 * @since 1.0.0
 */
export interface Objects extends ASTNode
{
    readonly _tag: "Objects";
    readonly propertySignatures: ReadonlyArray<PropertySignature>;
    readonly indexSignatures: ReadonlyArray<IndexSignature>;
    readonly encodingChecks: Checks | undefined;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField?: SchemaParser.Compiler): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): AST;

    /**
     * Supports objects during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST, recurParameter?: (ast: AST) => AST): AST;

    /**
     * Supports objects during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string;
}

/**
 * Constructs a {@link Objects}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Objects: new (propertySignatures: ReadonlyArray<PropertySignature>, indexSignatures: ReadonlyArray<IndexSignature>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks) => Objects = class extends ASTNodeImpl
{
    readonly _tag = "Objects";
    readonly propertySignatures: ReadonlyArray<PropertySignature>;
    readonly indexSignatures: ReadonlyArray<IndexSignature>;
    readonly encodingChecks: Checks | undefined;
    constructor(propertySignatures: ReadonlyArray<PropertySignature>, indexSignatures: ReadonlyArray<IndexSignature>, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks)
    {
        super(annotations, checks, encoding, context);
        this.propertySignatures = propertySignatures;
        this.indexSignatures = indexSignatures;
        this.encodingChecks = encodingChecks;
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField: SchemaParser.Compiler = compile): SchemaParser.Parser { return InternalSync.objects(this, compile, compileField); }
    private _rebuild(recur: (ast: AST) => AST, recurParameter: (ast: AST) => AST, checks: Checks | undefined, encodingChecks: Checks | undefined): Objects
    {
        const props = mapOrSame(this.propertySignatures, (ps) =>
        {
            const t = recur(ps.type);
            return t === ps.type ? ps : new PropertySignature(ps.name, t);
        });
        const indexes = mapOrSame(this.indexSignatures, (is) =>
        {
            const p = recurParameter(is.parameter);
            const t = recur(is.type);
            return p === is.parameter && t === is.type
                ? is
                : new IndexSignature(p, t);
        });
        return props === this.propertySignatures && indexes === this.indexSignatures && checks === this.checks &&
            encodingChecks === this.encodingChecks
            ? this
            : new Objects(props, indexes, this.annotations, checks, undefined, this.context, encodingChecks);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): AST
    {
        return this._rebuild(recur, recur, this.encodingChecks, this.checks);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST, recurParameter: (ast: AST) => AST = recur): AST
    {
        return this._rebuild(recur, recurParameter, this.checks, this.encodingChecks);
    }

    /**
     * Supports combine checks during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(): string
    {
        if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0)
        {return "object | array";}

        return "object";
    }
};

/**
 * Supports combine checks during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const combineChecks = (a: Checks | undefined, b: Checks | undefined): Checks | undefined =>
{
    if (!a)
    {return b;}

    if (!b)
    {return a;}

    return [ ...a, ...b ];
};

/**
 * Supports struct during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const struct = <Fields extends Schema.Struct.Fields>(fields: Fields, checks: Checks | undefined, annotations?: Schema.Annotations.Annotations): Objects =>
{
    return new Objects(Reflect.ownKeys(fields).map((key) =>
    {
        return new PropertySignature(key, fields[key].ast);
    }), [], annotations, checks);
};

/**
 * Supports get ast during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getAST = <S extends {
    readonly ast: AST;
}>(self: S): S["ast"] =>
{
    return self.ast;
};

/**
 * Supports tuple during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const tuple = <Elements extends Schema.Tuple.Elements>(elements: Elements, checks: Checks | undefined = undefined): Arrays =>
{
    return new Arrays(false, elements.map((e) => e.ast), [], undefined, checks);
};

/**
 * Supports union during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const union = <Members extends ReadonlyArray<{
    readonly ast: AST;
}>>(members: Members, options: UnionOptions | undefined, checks: Checks | undefined): Union<Members[number]["ast"]> =>
{
    return new Union(members.map(getAST), options, undefined, checks);
};

/**
 * Supports struct with rest during synchronous schema processing.
 *
 *  @internal
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const structWithRest = (ast: Objects, records: ReadonlyArray<Objects>): Objects =>
{
    if (ast.encoding || records.some((r) => r.encoding))
    {
        throw new Error("StructWithRest does not support encodings");
    }

    let propertySignatures = ast.propertySignatures;
    let indexSignatures = ast.indexSignatures;
    let checks = ast.checks;
    for (const record of records)
    {
        for (const propertySignature of record.propertySignatures)
        {
            if (propertySignatures.some((ps) => ps.name === propertySignature.name))
            {
                throw new Error(`Duplicate identifier: ${JSON.stringify(propertySignature.name)}. ts(2300)`);
            }
        }

        propertySignatures = propertySignatures.concat(record.propertySignatures);
        indexSignatures = indexSignatures.concat(record.indexSignatures);
        checks = combineChecks(checks, record.checks);
    }

    return new Objects(propertySignatures, indexSignatures, undefined, checks);
};

/**
 * Supports tuple with rest during synchronous schema processing.
 *
 *  @internal
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const tupleWithRest = (ast: Arrays, rest: ReadonlyArray<AST>): Arrays =>
{
    if (ast.encoding)
    {
        throw new Error("TupleWithRest does not support encodings");
    }

    return new Arrays(ast.isMutable, ast.elements, rest, undefined, ast.checks);
};

/**
 * Supports mutable during synchronous schema processing.
 *
 *  @internal
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mutable = (ast: Arrays): Arrays =>
{
    if (ast.encoding)
    {
        throw new Error("mutable does not support encodings");
    }

    return new Arrays(true, ast.elements, ast.rest, ast.annotations, ast.checks, undefined, ast.context, ast.encodingChecks);
};

type Type = "null" | "array" | "object" | "string" | "number" | "boolean" | "symbol" | "undefined" | "bigint" | "function";

/**
 * Supports sentinel during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Sentinel = {
    readonly key: PropertyKey;
    readonly literal: LiteralValue | symbol;
};

const toCandidate = memoizeIdempotent((ast: AST): AST =>
{
    while (true)
    {
        if (isSuspend(ast))
        {return unknown;}

        const encoding = ast.encoding;
        if (!encoding)
        {
            // Index signature parameters do not participate in union selection.
            return (ast as any).recur?.(toCandidate, identity) ?? ast;
        }

        ast = encoding[encoding.length - 1].to;
    }
});

/**
 * Supports get candidate types during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const getCandidateTypes = (ast: AST): ReadonlyArray<Type> =>
{
    switch (ast._tag)
    {
        case "Null":
            return [ "null" ];
        case "Undefined":
            return [ "undefined" ];
        case "String":
        case "TemplateLiteral":
            return [ "string" ];
        case "Number":
            return [ "number" ];
        case "Boolean":
            return [ "boolean" ];
        case "Symbol":
        case "UniqueSymbol":
            return [ "symbol" ];
        case "BigInt":
            return [ "bigint" ];
        case "Arrays":
            return [ "array" ];
        case "ObjectKeyword":
            return [ "object", "array", "function" ];
        case "Objects":
            return ast.propertySignatures.length || ast.indexSignatures.length
                ? [ "object" ]
                : [ "string", "number", "boolean", "symbol", "bigint", "object", "array", "function" ];
        case "Enum":
            return Array.from(new Set(ast.enums.map(([ , v ]) => typeof v)));
        case "Literal":
            return [ typeof ast.literal ];
        case "Union":
            return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
        default:
            return [
                "null",
                "undefined",
                "string",
                "number",
                "boolean",
                "symbol",
                "bigint",
                "object",
                "array",
                "function"
            ];
    }
};

/**
 * Supports collect sentinels during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const collectSentinels = (ast: AST): ReadonlyArray<Sentinel> =>
{
    switch (ast._tag)
    {
        default:
            return [];
        case "Declaration": {
            const s = ast.annotations?.[InternalAnnotations.SentinelsAnnotationKey];
            return Array.isArray(s) ? s : [];
        }

        case "Objects":
            return ast.propertySignatures.flatMap((ps): Array<Sentinel> =>
            {
                const type = ps.type;
                if (!isOptional(type))
                {
                    if (isLiteral(type))
                    {
                        return [ { key: ps.name,
                            literal: type.literal } ];
                    }

                    if (isUniqueSymbol(type))
                    {
                        return [ { key: ps.name,
                            literal: type.symbol } ];
                    }
                }

                return [];
            });
        case "Arrays":
            return ast.elements.flatMap((e, i): Array<Sentinel> =>
            {
                if (!isOptional(e))
                {
                    if (isLiteral(e))
                    {
                        return [ { key: i,
                            literal: e.literal } ];
                    }

                    if (isUniqueSymbol(e))
                    {
                        return [ { key: i,
                            literal: e.symbol } ];
                    }
                }

                return [];
            });
        case "Union": {
            if (ast.types.length === 0)
            {return [];}

            const members = ast.types.map((type) => collectSentinels(toCandidate(type)));
            return members[0].filter((s) => members.every((sentinels) => sentinels.some((o) => o.key === s.key && o.literal === s.literal)));
        }

        case "Suspend":
            return collectSentinels(ast.thunk());
    }
};

/**
 * Supports candidate index during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type CandidateIndex = (input: any, isConstructor: boolean) => ReadonlyArray<number>;

type SentinelEntry = readonly [
    byValue: Map<LiteralValue | symbol, Set<number>>,
    all: Set<number>
];

type SentinelIndex = Map<PropertyKey, SentinelEntry>;

const candidateIndexCache = new WeakMap<ReadonlyArray<AST>, CandidateIndex>();

const emptyCandidates: ReadonlyArray<never> = Object.freeze([]);

const getRuntimeType = (input: unknown): Type => input === null ? "null" : Array.isArray(input) ? "array" : typeof input;

const hasPropertySignature = (input: object, key: PropertyKey): boolean => key === "__proto__" ? Object.hasOwn(input, key) : key in input;

/**
 * Supports get candidate index during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getCandidateIndex = (types: ReadonlyArray<AST>): CandidateIndex =>
{
    let index = candidateIndexCache.get(types);
    if (index)
    {return index;}

    let bySentinel: SentinelIndex | undefined;
    let sentinelCandidateCount = 0;
    let otherwise: {
        [K in Type]?: Array<number>;
    } | undefined;
    let literalCandidates: Map<LiteralValue | symbol, Array<number>> | undefined;
    let onlyLiterals = true;
    const literalOf: Array<LiteralValue | symbol | undefined> = [];
    for (let i = 0; i < types.length; i++)
    {
        const a = types[i];
        const encoded = toCandidate(a);
        if (isNever(encoded))
        {continue;}

        if (isLiteral(encoded) || isUniqueSymbol(encoded))
        {
            literalCandidates ??= new Map();
            const literal = isLiteral(encoded) ? encoded.literal : encoded.symbol;
            literalOf[i] = literal;
            let arr = literalCandidates.get(literal);
            if (!arr)
            {literalCandidates.set(literal, arr = []);}

            arr.push(i);
        }
        else
        {
            onlyLiterals = false;
        }

        const sentinels = collectSentinels(encoded);
        if (sentinels.length)
        { // discriminated variants
            bySentinel ??= new Map();
            sentinelCandidateCount++;
            for (const { key, literal } of sentinels)
            {
                let entry = bySentinel.get(key);
                if (!entry)
                {bySentinel.set(key, entry = [ new Map(), new Set() ]);}

                entry[1].add(i);
                let indexes = entry[0].get(literal);
                if (!indexes)
                {entry[0].set(literal, indexes = new Set());}

                indexes.add(i);
            }
        }
        else
        { // non-discriminated
            otherwise ??= {};
            const candidateTypes = getCandidateTypes(encoded);
            for (const t of candidateTypes)
            {(otherwise[t] ??= []).push(i);}
        }
    }

    // Non-discriminated members are grouped by runtime type once and reused by every decode.
    const fallbacks: {
        [K in Type]?: ReadonlyArray<number>;
    } = {};
    const getFallback = (type: Type): ReadonlyArray<number> => fallbacks[type] ??= Object.freeze(otherwise?.[type] ?? emptyCandidates);
    if (onlyLiterals && literalCandidates)
    {
        literalCandidates.forEach(Object.freeze);
        index = (input) => literalCandidates.get(input) ?? emptyCandidates;
    }
    else if (bySentinel?.size === 1 && !otherwise)
    {
        const [ key, [ byValue ] ] = bySentinel.entries().next().value!;
        const candidates = new Map<LiteralValue | symbol, ReadonlyArray<number>>();
        for (const [ literal, indexes ] of byValue)
        {
            candidates.set(literal, Object.freeze(Array.from(indexes)));
        }

        const all = Object.freeze(types.map((_, i) => i));
        index = (input, isConstructor) =>
        {
            if (Predicate.isObjectKeyword(input))
            {
                const value = hasPropertySignature(input, key) ? (input as any)[key] : undefined;
                if (value !== undefined)
                {return candidates.get(value) ?? emptyCandidates;}

                if (isConstructor)
                {return all;}
            }

            return emptyCandidates;
        };
    }
    else if (bySentinel)
    {
        // A key owned by every discriminated candidate is safe to use as the initial selector: no candidate can
        // be excluded merely because it uses a different sentinel key. Prefer the key with the most distinct values
        // to minimize the matching bucket.
        let commonSentinel: [
            PropertyKey,
            SentinelEntry
        ] | undefined;
        for (const entry of bySentinel)
        {
            if ((!commonSentinel || entry[1][0].size > commonSentinel[1][0].size) &&
                entry[1][1].size === sentinelCandidateCount)
            {
                commonSentinel = entry;
            }
        }

        index = (input, isConstructor) =>
        {
            const runtimeType = getRuntimeType(input);
            if (!Predicate.isObjectKeyword(input))
            {return getFallback(runtimeType);}

            // Non-discriminated candidates are runtime-type fallbacks and are never removed by sentinel checks.
            const selected = new Set(otherwise?.[runtimeType]);
            let directKey: PropertyKey | undefined;
            // An observed common key can seed the selection directly; an unknown value rules out every
            // discriminated candidate.
            if (commonSentinel)
            {
                const [ key, [ byValue ] ] = commonSentinel;
                const hasKey = hasPropertySignature(input, key);
                const value = hasKey ? (input as any)[key] : undefined;
                if (hasKey && (!isConstructor || value !== undefined))
                {
                    const match = byValue.get(value);
                    if (!match)
                    {return getFallback(runtimeType);}

                    for (const i of match)
                    {selected.add(i);}

                    directKey = key;
                }
            }

            // Without an observed common key, collect positive matches from every sentinel. Constructor mode treats
            // absent and undefined keys as unconstrained and therefore selects every candidate that owns the key.
            if (directKey === undefined)
            {
                for (const [ key, [ byValue, all ] ] of bySentinel)
                {
                    const hasKey = hasPropertySignature(input, key);
                    const value = hasKey ? (input as any)[key] : undefined;
                    if (hasKey && (!isConstructor || value !== undefined))
                    {
                        const match = byValue.get(value);
                        if (match)
                        {
                            for (const i of match)
                            {selected.add(i);}
                        }
                    }
                    else if (isConstructor)
                    {
                        for (const i of all)
                        {selected.add(i);}
                    }
                }
            }

            // Missing keys are neutral. An observed key rejects only selected candidates that own it and do not match.
            for (const [ key, [ byValue, all ] ] of bySentinel)
            {
                if (key === directKey)
                {continue;}

                const hasKey = hasPropertySignature(input, key);
                const value = hasKey ? (input as any)[key] : undefined;
                if (hasKey && (!isConstructor || value !== undefined))
                {
                    const match = byValue.get(value);
                    for (const i of selected)
                    {
                        if (all.has(i) && !match?.has(i))
                        {selected.delete(i);}
                    }
                }
            }

            return Array.from(selected).sort((a, b) => a - b);
        };
    }
    else
    {
        index = (input) =>
        {
            const fallback = getFallback(getRuntimeType(input));
            return literalCandidates ? fallback.filter((i) => literalOf[i] === undefined || literalOf[i] === input) : fallback;
        };
    }

    candidateIndexCache.set(types, index);
    return index;
};

/**
 * AST node representing a union of schemas.
 *
 * @category models
 * @since 1.0.0
 */
export interface Union<A extends AST = AST> extends ASTNode
{
    readonly _tag: "Union";
    readonly types: ReadonlyArray<A>;
    readonly options: UnionOptions | undefined;
    readonly encodingChecks: Checks | undefined;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField?: SchemaParser.Compiler): SchemaParser.Parser;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST): Union<AST>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): Union<AST>;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): LiteralValue | undefined;

    /**
     * Supports union options during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(getExpected: (ast: AST) => string): string;
}

/**
 * Local matching options stored on {@link Union} nodes.
 *
 * @category options
 * @since 1.0.0
 */
export interface UnionOptions
{
    /**
     *  Defaults to `"anyOf"`; `"oneOf"` requires exactly one matching member.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly mode?: "anyOf" | "oneOf" | undefined;
}

/**
 * Constructs a {@link Union}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Union: new <A extends AST = AST>(types: ReadonlyArray<A>, options?: UnionOptions, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks) => Union<A> = class <A extends AST = AST> extends ASTNodeImpl
{
    readonly _tag = "Union";
    readonly types: ReadonlyArray<A>;
    readonly options: UnionOptions | undefined;
    readonly encodingChecks: Checks | undefined;
    constructor(types: ReadonlyArray<A>, options?: UnionOptions, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context, encodingChecks?: Checks)
    {
        super(annotations, checks, encoding, context);
        this.types = types;
        this.options = options;
        this.encodingChecks = encodingChecks;
    }

    /**
     * Supports types during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler, compileField?: SchemaParser.Compiler): SchemaParser.Parser { return InternalSync.union(this, compile, compileField); }
    private _rebuild(recur: (ast: AST) => AST, checks: Checks | undefined, encodingChecks: Checks | undefined): Union<AST>
    {
        const types = mapOrSame(this.types, recur);
        return types === this.types && checks === this.checks && encodingChecks === this.encodingChecks ?
            this :
            new Union(types, this.options, this.annotations, checks, undefined, this.context, encodingChecks);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST): Union<AST>
    {
        return this._rebuild(recur, this.checks, this.encodingChecks);
    }

    /**
     * Supports type during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    flip(recur: (ast: AST) => AST): Union<AST>
    {
        return this._rebuild(recur, this.encodingChecks, this.checks);
    }

    /**
     * Supports type during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    matchPart(s: string, options: ParseOptions): LiteralValue | undefined
    {
        for (const type of this.types)
        {
            const out = (type as TemplateLiteralPart).matchPart(s, options);
            if (out !== undefined)
            {return out;}
        }

        return undefined;
    }

    /**
     * Supports expected during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(getExpected: (ast: AST) => string): string
    {
        const expected = this.annotations?.expected;
        if (typeof expected === "string")
        {return expected;}

        if (this.types.length === 0)
        {return "never";}

        const types = this.types.map((type) =>
        {
            const encoded = toEncoded(type);
            switch (encoded._tag)
            {
                case "Arrays": {
                    const literals = encoded.elements.filter(isLiteral);
                    if (literals.length > 0)
                    {
                        return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
                    }

                    break;
                }

                case "Objects": {
                    const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
                    if (literals.length > 0)
                    {
                        return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected(ps.type)}`).join(", ")}, ... }`;
                    }

                    break;
                }
            }

            return getExpected(encoded);
        });
        return Array.from(new Set(types)).join(" | ");
    }
};

const nonFiniteLiterals = new Union([
    new Literal("Infinity"),
    new Literal("-Infinity"),
    new Literal("NaN")
]);

/**
 * Supports format is mutable during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const formatIsMutable = (isMutable: boolean | undefined): string =>
{
    return isMutable ? "" : "readonly ";
};

/**
 * Supports format is optional during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const formatIsOptional = (isOptional: boolean | undefined): string =>
{
    return isOptional ? "?" : "";
};

/**
 * AST node for lazy/recursive schemas.
 *
 * @category models
 * @since 1.0.0
 */
export interface Suspend extends ASTNode
{
    readonly _tag: "Suspend";
    readonly thunk: () => AST;

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler): SchemaParser.Parser;

    /**
     * Supports suspend during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST): Suspend;

    /**
     * Supports suspend during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(getExpected: (ast: AST) => string): string;
}

/**
 * Constructs a {@link Suspend}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Suspend: new (thunk: () => AST, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context) => Suspend = class extends ASTNodeImpl
{
    readonly _tag = "Suspend";
    readonly thunk: () => AST;
    constructor(thunk: () => AST, annotations?: Schema.Annotations.Annotations, checks?: Checks, encoding?: Encoding, context?: Context)
    {
        if (checks)
        {
            throw new Error("Cannot add checks to Suspend");
        }

        super(annotations, undefined, encoding, context);
        let ast: AST;
        this.thunk = () => ast ??= thunk();
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getParser(compile: SchemaParser.Compiler): SchemaParser.Parser
    {
        let parser: SchemaParser.Parser;
        return (input, options) => (parser ??= compile(this.thunk()))(input, options);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    recur(recur: (ast: AST) => AST)
    {
        return new Suspend(() => recur(this.thunk()), this.annotations, undefined, undefined, this.context);
    }

    /**
     * Supports schema operation during synchronous schema processing.
     *
     *  @internal
     *
     * @category Utilities
     * @since 1.0.0
     */
    getExpected(getExpected: (ast: AST) => string): string
    {
        return getExpected(this.thunk());
    }
};

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------

/**
 * Represents a single validation check attached to an AST node.
 *
 * @category models
 * @since 1.0.0
 */
export interface Filter<in E> extends Pipeable.Pipeable
{
    readonly _tag: "Filter";
    readonly run: (input: E, self: AST, options: ParseOptions) => SchemaIssue.Issue | undefined;
    readonly annotations: Schema.Annotations.Filter | undefined;

    /**
     * Whether the parsing process should be aborted after this check has failed.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly aborted: boolean;
    annotate(annotations: Schema.Annotations.Filter): Filter<E>;
    abort(): Filter<E>;
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>;
}

/**
 * Constructs a {@link Filter}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const Filter: new <E>(run: (input: E, self: AST, options: ParseOptions) => SchemaIssue.Issue | undefined, annotations?: Schema.Annotations.Filter | undefined, /**
                                                                                                                                                                       * Whether the parsing process should be aborted after this check has failed.
                                                                                                                                                                       *
                                                                                                                                                                       * @category Utilities
                                                                                                                                                                       * @since 1.0.0
                                                                                                                                                                       */ aborted?: boolean) => Filter<E> = class <in E> extends Pipeable.Class
{
    readonly _tag = "Filter";
    readonly run: (input: E, self: AST, options: ParseOptions) => SchemaIssue.Issue | undefined;
    readonly annotations: Schema.Annotations.Filter | undefined;

    /**
     * Whether the parsing process should be aborted after this check has failed.
     *
     * @category Utilities
     * @since 1.0.0
     */
    readonly aborted: boolean;
    constructor(run: (input: E, self: AST, options: ParseOptions) => SchemaIssue.Issue | undefined, annotations: Schema.Annotations.Filter | undefined = undefined,

        /**
         * Whether the parsing process should be aborted after this check has failed.
         *
         * @category Utilities
         * @since 1.0.0
         */
        aborted: boolean = false)
    {
        super();
        this.run = run;
        this.annotations = annotations;
        this.aborted = aborted;
    }
    annotate(annotations: Schema.Annotations.Filter): Filter<E>
    {
        return new Filter(this.run, { ...this.annotations,
            ...annotations }, this.aborted);
    }
    abort(): Filter<E>
    {
        return new Filter(this.run, this.annotations, true);
    }
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>;
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>
    {
        return new FilterGroup([ this, other ], annotations);
    }
};

/**
 * Represents a composite validation check grouping multiple {@link Check} values.
 *
 * @category models
 * @since 1.0.0
 */
export interface FilterGroup<in E> extends Pipeable.Pipeable
{
    readonly _tag: "FilterGroup";
    readonly checks: readonly [
        Check<E>,
        ...Array<Check<E>>
    ];
    readonly annotations: Schema.Annotations.Filter | undefined;
    annotate(annotations: Schema.Annotations.Filter): FilterGroup<E>;
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>;
}

/**
 * Constructs a {@link FilterGroup}.
 *
 * @category constructors
 * @since 1.0.0
 */
export const FilterGroup: new <E>(checks: readonly [
    Check<E>,
    ...Array<Check<E>>
], annotations?: Schema.Annotations.Filter | undefined) => FilterGroup<E> = class <in E> extends Pipeable.Class
{
    readonly _tag = "FilterGroup";
    readonly checks: readonly [
        Check<E>,
        ...Array<Check<E>>
    ];
    readonly annotations: Schema.Annotations.Filter | undefined;
    constructor(checks: readonly [
        Check<E>,
        ...Array<Check<E>>
    ], annotations: Schema.Annotations.Filter | undefined = undefined)
    {
        super();
        this.checks = checks;
        this.annotations = annotations;
    }
    annotate(annotations: Schema.Annotations.Filter): FilterGroup<E>
    {
        return new FilterGroup(this.checks, { ...this.annotations,
            ...annotations });
    }
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>;
    and(other: Check<E>, annotations?: Schema.Annotations.Filter): FilterGroup<E>
    {
        return new FilterGroup([ this, other ], annotations);
    }
};

/**
 * A validation check — either a single {@link Filter} or a composite
 * {@link FilterGroup}.
 *
 * @category models
 * @since 1.0.0
 */
export type Check<T> = Filter<T> | FilterGroup<T>;

/**
 * Supports make filter during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeFilter = <T>(filter: (input: T, ast: AST, options: ParseOptions) => Schema.FilterOutput, annotations?: Schema.Annotations.Filter | undefined, aborted: boolean = false): Filter<T> =>
{
    return new Filter((input, ast, options) => SchemaIssue.normalizeFilterOutput(ast, filter(input, ast, options), input, options), annotations, aborted);
};

/**
 * Supports make filter by guard during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeFilterByGuard = <T extends E, E>(is: (value: E) => value is T, annotations?: Schema.Annotations.Filter): Filter<any> =>
{
    return new Filter((input: E, _ast, options) => is(input) ? undefined : new SchemaIssue.InvalidValue(undefined, input, options), annotations, true // after a guard, we always want to abort
    );
};

/**
 * Supports is finite during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isFinite = (annotations?: Schema.Annotations.Filter) =>
{
    return makeFilter((n: number) => globalThis.Number.isFinite(n), {
        expected: "a finite number",
        "~representation": {
            id: "effect/schema/isFinite",
            payload: null
        },
        toJsonSchema: () => ({ type: "number" }),
        ...annotations
    });
};

/**
 * Creates a {@link Filter} that validates strings by running `RegExp.test`.
 *
 * @category constructors
 * @since 1.0.0
 */
export const isPattern = (regExp: globalThis.RegExp, annotations?: Schema.Annotations.Filter) =>
{
    const copy = new globalThis.RegExp(regExp);
    const payload = { source: copy.source,
        flags: copy.flags };
    return makeFilter((s: string) =>
    {
        copy.lastIndex = 0;
        return copy.test(s);
    }, {
        expected: `a string matching the RegExp ${payload.source}`,
        "~representation": {
            id: "effect/schema/isPattern",
            payload
        },
        // Keep the filter exportable so its JSON Schema annotations are preserved
        // when the RegExp constraint itself is omitted.
        toJsonSchema: () => [ {}, true ],
        ...annotations
    });
};

// Copies that update only context or encoding share a body.
// All other fields describe the body itself, including child contexts.
const bodyOwners = new WeakMap<AST, AST>();

/**
 * Supports copy during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const copy = <A extends AST>(ast: A, changes: Partial<AST>): A =>
{
    // AST copies preserve the prototype and enumerable values, not property descriptors.
    const out = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, changes) as A;
    if (Reflect.ownKeys(changes).every((key) => key === "context" || key === "encoding"))
    {
        bodyOwners.set(out, getContextOwner(ast));
    }

    return out;
};

/**
 * Supports get context owner during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getContextOwner = <A extends AST>(ast: A): A =>
{
    const existing = bodyOwners.get(ast);
    if (existing !== undefined)
    {return existing as A;}

    if (ast.encoding === undefined)
    {return ast;}

    // A body representative must not expose or retain the node's own codec.
    const owner = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, { encoding: undefined }) as A;
    bodyOwners.set(ast, owner);
    return owner;
};

/**
 * Supports replace encoding during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const replaceEncoding = <A extends AST>(ast: A, encoding: Encoding | undefined): A =>
{
    return ast.encoding === encoding ? ast : copy(ast, { encoding });
};

/**
 * Supports replace context during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const replaceContext = <A extends AST>(ast: A, context: Context | undefined): A =>
{
    if (ast.context === context)
    {
        return ast;
    }

    const owner = getContextOwner(ast);
    if (owner.context === context && owner.encoding === ast.encoding)
    {
        return owner;
    }

    return copy(ast, { context });
};

/**
 * Supports get last encoding during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getLastEncoding = (ast: AST): AST =>
{
    return ast.encoding ? getLastEncoding(ast.encoding[ast.encoding.length - 1].to) : ast;
};

/**
 * Supports annotate during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const annotate = <A extends AST>(ast: A, annotations: Schema.Annotations.Annotations): A =>
{
    if (ast.checks)
    {
        const last = ast.checks[ast.checks.length - 1];
        return replaceChecks(ast, Arr.append(ast.checks.slice(0, -1), last.annotate(annotations)));
    }

    return copy(ast, { annotations: { ...ast.annotations,
        ...annotations } });
};

/**
 * Supports replace checks during synchronous schema processing.
 *
 *  @internal
 *
 * @throws { Error } When schema configuration is invalid or a callback throws.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const replaceChecks = <A extends AST>(ast: A, checks: Checks | undefined): A =>
{
    if (ast._tag === "Suspend" && checks)
    {
        throw new Error("Cannot add checks to Suspend");
    }

    if (ast.checks === checks)
    {
        return ast;
    }

    return copy(ast, { checks });
};

/**
 * Supports append checks during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const appendChecks = <A extends AST>(ast: A, checks: Checks | undefined): A =>
{
    return replaceChecks(ast, combineChecks(ast.checks, checks));
};

/**
 * Supports map link during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mapLink = (link: Link, f: (ast: AST) => AST): Link =>
{
    const to = f(link.to);
    return to === link.to ? link : new Link(to, link.transformation);
};

/**
 * Supports update last link during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const updateLastLink = (encoding: Encoding, f: (ast: AST) => AST): Encoding =>
{
    const links = encoding;
    const last = links[links.length - 1];
    const out = mapLink(last, f);
    return out === last ? encoding : Arr.append(encoding.slice(0, encoding.length - 1), out);
};

/**
 * Supports apply to last link during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const applyToLastLink = (f: (ast: AST) => AST) =>
{
    return <A extends AST>(ast: A): A => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
};

/**
 * Supports replace context last link during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const replaceContextLastLink = <A extends AST>(ast: A, context: Context): A =>
{
    return applyToLastLink((ast) => replaceContext(ast, context))(ast);
};

/**
 * Supports apply to self or last link encoding during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const applyToSelfOrLastLinkEncoding = (f: (ast: AST) => AST) =>
{
    /**
     * Supports out during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const out = (ast: AST): AST =>
    {
        return ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, out)) : f(ast);
    };

    return memoize(out);
};

/**
 * Supports apply to self or last link encoding idempotent during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const applyToSelfOrLastLinkEncodingIdempotent = (f: (ast: AST) => AST, options?: {
    readonly stopAt?: (link: Link) => boolean;
}) =>
{
    /**
     * Supports out during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const out = (ast: AST): AST =>
    {
        if (ast.encoding)
        {
            const last = ast.encoding[ast.encoding.length - 1];
            return options?.stopAt?.(last) ? ast : replaceEncoding(ast, updateLastLink(ast.encoding, out));
        }

        return f(ast);
    };

    return memoizeIdempotent(out);
};

/**
 * Supports append transformation during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const appendTransformation = <A extends AST>(from: AST, transformation: SchemaTransformation.Transformation<any, any, never, never>, to: A): A =>
{
    const link = new Link(from, transformation);
    return replaceEncoding(to, to.encoding ? [ ...to.encoding, link ] : [ link ]);
};

/**
 * Maps over the array but will return the original array if no changes occur.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mapOrSame = (<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A> =>
{
    let out: Array<A> | undefined;
    for (let i = 0; i < as.length; i++)
    {
        const a = as[i];
        const fa = f(a);
        if (out)
        {
            out[i] = fa;
        }
        else if (fa !== a)
        {
            out = new Array(as.length);
            for (let j = 0; j < i; j++)
            {
                out[j] = as[j];
            }

            out[i] = fa;
        }
    }

    return out ?? as;
}) as {
    <A>(as: Arr.NonEmptyReadonlyArray<A>, f: (a: A) => A): Arr.NonEmptyReadonlyArray<A>;
    <A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A>;
};

/**
 * Supports annotate key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const annotateKey = <A extends AST>(ast: A, annotations: Schema.Annotations.Key<unknown>): A =>
{
    const context = ast.context ?
        new Context(ast.context.isOptional, ast.context.isMutable, ast.context.constructorDefault, { ...ast.context.annotations,
            ...annotations }) :
        new Context(false, false, undefined, annotations);
    return replaceContext(ast, context);
};

/**
 * Supports optional key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const optionalKey: <A extends AST>(ast: A) => A = memoizeIdempotent(<A extends AST>(ast: A): A =>
{
    const context = ast.context ?
        ast.context.isOptional === false ?
            new Context(true, ast.context.isMutable, ast.context.constructorDefault, ast.context.annotations) :
            ast.context :
        new Context(true, false);
    return optionalKeyLastLink(replaceContext(ast, context));
});

const optionalKeyLastLink = applyToLastLink(optionalKey);

/**
 * Supports optional during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const optional = memoize(<A extends AST>(ast: A): Union<A | Undefined> => optionalKey(new Union([ ast, undefined_ ])));

/**
 * Supports mutable key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const mutableKey = memoizeIdempotent(<A extends AST>(ast: A): A =>
{
    const context = ast.context ?
        ast.context.isMutable === false ?
            new Context(ast.context.isOptional, true, ast.context.constructorDefault, ast.context.annotations) :
            ast.context :
        new Context(false, true);
    return mutableKeyLastLink(replaceContext(ast, context));
});

const mutableKeyLastLink = applyToLastLink(mutableKey);

/**
 * Supports with constructor default during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const withConstructorDefault = <A extends AST>(ast: A, defaultValue: () => Result.Result<unknown, SchemaIssue.Issue>): A =>
{
    const context = ast.context ?
        new Context(ast.context.isOptional, ast.context.isMutable, defaultValue, ast.context.annotations) :
        new Context(false, false, defaultValue);
    return replaceContext(ast, context);
};

/**
 * Attaches a `Transformation` to the `to` AST, making it decode from the
 * `from` AST and encode back to it.
 *
 * @category transforming
 * @since 1.0.0
 */
export const decodeTo = <A extends AST>(from: AST, to: A, transformation: SchemaTransformation.Transformation<any, any, never, never>): A =>
{
    return appendTransformation(from, transformation, to);
};

/**
 * Supports parse parameter during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const parseParameter = (ast: AST): {
    literals: ReadonlyArray<PropertyKey>;
    parameters: ReadonlyArray<AST>;
} =>
{
    const literals: Array<PropertyKey> = [];
    const parameters: Array<AST> = [];

    /**
     * Supports go during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const go = (ast: AST) =>
    {
        switch (ast._tag)
        {
            case "Literal":
                if (Predicate.isPropertyKey(ast.literal) && !literals.includes(ast.literal))
                {
                    literals.push(ast.literal);
                }

                return;
            case "UniqueSymbol":
                if (!literals.includes(ast.symbol))
                {
                    literals.push(ast.symbol);
                }

                return;
            case "Never":
                return;
            case "Union":
                for (let i = 0; i < ast.types.length; i++)
                {
                    go(ast.types[i]);
                }

                return;
            default:
                parameters.push(ast);
        }
    };

    go(ast);
    return { literals,
        parameters };
};

/**
 * Supports record during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const record = (key: AST, value: AST): Objects =>
{
    const { literals, parameters: indexSignatures } = parseParameter(key);
    return new Objects(literals.map((literal) => new PropertySignature(literal, value)), indexSignatures.map((parameter) => new IndexSignature(parameter, value)));
};

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

/**
 * Returns `true` if the AST node represents an optional property.
 *
 * @category predicates
 * @since 1.0.0
 */
export const isOptional = (ast: AST): boolean =>
{
    return ast.context?.isOptional ?? false;
};

/**
 * Supports is mutable during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isMutable = (ast: AST): boolean =>
{
    return ast.context?.isMutable ?? false;
};

/**
 * Supports is structural check during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isStructuralCheck = (check: Check<any>): boolean =>
{
    return check.annotations?.[InternalAnnotations.StructuralAnnotationKey] === true ||
        check._tag === "FilterGroup" && check.checks.every(isStructuralCheck);
};

/**
 * Supports extract structural checks during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const extractStructuralChecks = (checks: Checks): Checks | undefined =>
{
    /**
     * Supports extract during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const extract = (check: Check<any>): Array<Check<any>> =>
    {
        if (isStructuralCheck(check))
        {return [ check ];}

        return check._tag === "FilterGroup" ? check.checks.flatMap(extract) : [];
    };

    const out = checks.flatMap(extract);
    return Arr.isArrayNonEmpty(out) ? out : undefined;
};

/**
 * Supports can preserve encoding checks during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const canPreserveEncodingChecks = (ast: AST): boolean =>
{
    let preserve = true;

    /**
     * Supports visit during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const visit = (child: AST): AST =>
    {
        preserve = preserve && !child.encoding && !isSuspend(child);
        if (preserve && "recur" in child)
        {child.recur(visit);}

        return child;
    };

    if ("recur" in ast)
    {ast.recur(visit);}

    return preserve;
};

/**
 * Strips all encoding transformations from an AST, returning the decoded
 * (type-level) representation.
 *
 * @category transforming
 * @since 1.0.0
 */
export const toType = memoizeIdempotent(<A extends AST>(ast: A): A =>
{
    const owner = getContextOwner(ast);
    if (owner !== ast)
    {
        const type = toType(owner);
        return type === owner && ast.encoding === undefined ? ast : replaceContext(type, ast.context);
    }

    const type = ("recur" in ast ? ast.recur(toType) : ast) as A;
    if ("encodingChecks" in type && type.encodingChecks)
    {
        const checks = canPreserveEncodingChecks(ast)
            ? type.encodingChecks
            : isArrays(type) || isObjects(type) || isDeclaration(type) && type.typeParameters.length > 0
                ? extractStructuralChecks(type.encodingChecks)
                : undefined;
        return copy(type, {
            encodingChecks: undefined,
            checks: combineChecks(type.checks, checks)
        });
    }

    return type;
});

/**
 * Returns the encoded (wire-format) AST by flipping and then stripping
 * encodings.
 *
 * @category transforming
 * @since 1.0.0
 */
export const toEncoded = memoizeIdempotent((ast: AST): AST =>
{
    return toType(flip(ast));
});

/**
 * Supports flip encoding during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const flipEncoding = (ast: AST, encoding: Encoding): AST =>
{
    const links = encoding;
    const len = links.length;
    const last = links[len - 1];
    const ls: Arr.NonEmptyArray<Link> = [
        new Link(flip(replaceEncoding(ast, undefined)), links[0].transformation.flip())
    ];
    for (let i = 1; i < len; i++)
    {
        ls.unshift(new Link(flip(links[i - 1].to), links[i].transformation.flip()));
    }

    const to = flip(last.to);
    if (to.encoding)
    {
        return replaceEncoding(to, [ ...to.encoding, ...ls ]);
    }
    else
    {
        return replaceEncoding(to, ls);
    }
};

/**
 * Swaps the decode and encode directions of an AST's {@link Encoding} chain.
 *
 * @category transforming
 * @since 1.0.0
 */
export const flip = memoize((ast: AST): AST =>
{
    if (ast.encoding)
    {
        return flipEncoding(ast, ast.encoding);
    }

    const owner = getContextOwner(ast);
    if (owner !== ast)
    {
        const flipped = flip(owner);
        return flipped === owner ? ast : replaceContext(flipped, ast.context);
    }

    return "flip" in ast ? ast.flip(flip) : "recur" in ast ? ast.recur(flip) : ast;
});

/**
 * Supports contains undefined during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const containsUndefined = (ast: AST): boolean =>
{
    switch (ast._tag)
    {
        case "Undefined":
            return true;
        case "Union":
            return ast.types.some(containsUndefined);
        default:
            return false;
    }
};

/**
 * Supports from const during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const fromConst = <const T>(ast: AST, value: T): SchemaParser.Parser =>
{
    const succeed = value === 0 ? InternalParser.sameExit : InternalParser.succeed(value);
    return (input, options) =>
    {
        if (input === InternalParser.missing)
        {return InternalParser.missingExit;}

        if (input === value)
        {return succeed;}

        return Result.fail(new SchemaIssue.InvalidType(ast, input, options));
    };
};

/**
 * Supports from refinement during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const fromRefinement = <T>(ast: AST, refinement: (input: unknown) => input is T): SchemaParser.Parser =>
{
    return (input, options) =>
    {
        if (input === InternalParser.missing)
        {return InternalParser.missingExit;}

        if (refinement(input))
        {return InternalParser.sameExit;}

        return Result.fail(new SchemaIssue.InvalidType(ast, input, options));
    };
};

/**
 * Supports segment template literal parts during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const segmentTemplateLiteralParts = (ast: TemplateLiteral, input: string, options: ParseOptions): Array<string> | undefined =>
{
    const parts = ast.encodedParts;
    const literals = ast.literals;
    const inputLength = input.length;
    for (let i = 0; i < literals.length; i++)
    {
        const literal = literals[i];
        if (literal && !input.includes(literal))
        {return undefined;}
    }

    if (ast.suffixLengths[0] > inputLength)
    {return undefined;}

    const out = new Array<string>(parts.length);
    let failures: Set<number> | undefined;

    /**
     * Supports go during synchronous schema processing.
     *
     *
     * @category Internal
     * @since 1.0.0
     */
    const go = (i: number, pos: number): boolean =>
    {
        if (i === parts.length)
        {return pos === inputLength;}

        if (failures?.has(i * (inputLength + 1) + pos))
        {return false;}

        const part = parts[i];
        if (i === parts.length - 1)
        {
            const s = input.slice(pos);
            if (part.matchPart(s, options) !== undefined)
            {
                out[i] = s;
                return true;
            }
        }
        else if (part._tag === "Literal")
        {
            const s = literals[i]!;
            if (input.startsWith(s, pos) && go(i + 1, pos + s.length))
            {
                out[i] = s;
                return true;
            }
        }
        else
        {
            const maximumEnd = inputLength - ast.suffixLengths[i + 1];
            // Splits preceding a literal only need to consider occurrences of that literal.
            const anchor = literals[i + 1];
            let end = anchor === undefined ? maximumEnd : input.lastIndexOf(anchor, maximumEnd);
            while (end >= pos)
            {
                const s = input.slice(pos, end);
                if (part.matchPart(s, options) !== undefined && go(i + 1, end))
                {
                    out[i] = s;
                    return true;
                }

                if (end === 0)
                {break;}

                end = anchor === undefined ? end - 1 : input.lastIndexOf(anchor, end - 1);
            }
        }

        failures ??= new Set();
        failures.add(i * (inputLength + 1) + pos);
        return false;
    };

    return go(0, 0) ? out : undefined;
};

/**
 * Supports parameter from property key during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const parameterFromPropertyKey = applyToSelfOrLastLinkEncodingIdempotent((ast) =>
{
    switch (ast._tag)
    {
        default:
            return ast;
        case "Number":
            return stringCodec(ast);
        case "Union":
            return ast.recur(parameterFromPropertyKey);
    }
});

/**
 * Supports parameter from string during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const parameterFromString = applyToSelfOrLastLinkEncodingIdempotent((ast) =>
{
    switch (ast._tag)
    {
        default:
            return ast;
        case "Symbol":
        case "UniqueSymbol":
            return stringCodec(ast);
        case "Union":
            return ast.recur(parameterFromString);
    }
});

const partFromString = applyToSelfOrLastLinkEncodingIdempotent((ast) =>
{
    switch (ast._tag)
    {
        default:
            return ast;
        case "Number":
        case "Literal":
        case "BigInt":
            return stringCodec(ast);
        case "Union":
            return ast.recur(partFromString);
    }
});

/**
 * any string, including newlines
 *
 * @category Utilities
 * @since 1.0.0
 */
export const StringPattern = "[\\s\\S]*?";

const isStringFiniteRegExp = new globalThis.RegExp(`^${FinitePattern}$`);

const isStringNumberRegExp = new globalThis.RegExp(`^(?:${FinitePattern}|Infinity|-Infinity|NaN)$`);

/**
 * Supports is string finite during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isStringFinite = (annotations?: Schema.Annotations.Filter) =>
{
    return isPattern(isStringFiniteRegExp, {
        expected: "a string representing a finite number",
        "~representation": {
            id: "effect/schema/isStringFinite",
            payload: null
        },
        toJsonSchema: () => ({ pattern: isStringFiniteRegExp.source }),
        ...annotations
    });
};

/**
 * Supports finite during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const finite = appendChecks(number, [ isFinite() ]);

const numberToJson = new Link(new Union([ finite, nonFiniteLiterals ]), new SchemaTransformation.Transformation(SchemaGetter.Number(), SchemaGetter.transform((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));

const finiteString = appendChecks(string, [ isStringFinite() ]);

const finiteToString = new Link(finiteString, SchemaTransformation.numberFromString);

const numberToString = new Link(new Union([ finiteString, nonFiniteLiterals ]), SchemaTransformation.numberFromString);

/**
 * signed integer only (no leading "+" because TypeScript doesn't support it)
 *
 * @category Utilities
 * @since 1.0.0
 */
const BigintPattern = "-?\\d+";

const isStringBigIntRegExp = new globalThis.RegExp(`^${BigintPattern}$`);

/**
 * Supports is string big int during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isStringBigInt = (annotations?: Schema.Annotations.Filter) =>
{
    return isPattern(isStringBigIntRegExp, {
        expected: "a string representing a bigint",
        "~representation": {
            id: "effect/schema/isStringBigInt",
            payload: null
        },
        toJsonSchema: () => ({ pattern: isStringBigIntRegExp.source }),
        ...annotations
    });
};

/**
 * Supports big int string during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const bigIntString = appendChecks(string, [ isStringBigInt({
    expected: "a string representing a bigint"
}) ]);

const bigIntToString = new Link(bigIntString, SchemaTransformation.bigintFromString);

const RegexpPattern = "Symbol\\(([\\s\\S]*)\\)";

const isStringSymbolRegExp = new globalThis.RegExp(`^${RegexpPattern}$`);

/**
 * Supports is string symbol during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isStringSymbol = (annotations?: Schema.Annotations.Filter) =>
{
    return isPattern(isStringSymbolRegExp, {
        expected: "a string representing a symbol",
        "~representation": {
            id: "effect/schema/isStringSymbol",
            payload: null
        },
        toJsonSchema: () => ({ pattern: isStringSymbolRegExp.source }),
        ...annotations
    });
};

/**
 * Supports symbol string during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const symbolString = appendChecks(string, [ isStringSymbol() ]);

/**
 * to distinguish between Symbol and String, we need to add a check to the string keyword
 *
 * @category Utilities
 * @since 1.0.0
 */
const symbolToString = new Link(symbolString, new SchemaTransformation.Transformation(SchemaGetter.transform((description) => globalThis.Symbol.for(isStringSymbolRegExp.exec(description)![1])), SchemaGetter.transformResult((sym: symbol, options) =>
{
    const key = globalThis.Symbol.keyFor(sym);
    if (key !== undefined)
    {
        return Result.succeed(globalThis.String(sym));
    }

    return Result.fail(new SchemaIssue.Forbidden({ message: "cannot serialize to string, Symbol is not registered" }, sym, options));
})));

/**
 * Supports collect issues during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const collectIssues = <T>(checks: ReadonlyArray<Check<T>>, value: T, issues: Arr.NonEmptyArray<SchemaIssue.Issue> | undefined, ast: AST, options: ParseOptions): Arr.NonEmptyArray<SchemaIssue.Issue> | undefined =>
{
    for (let i = 0; i < checks.length; i++)
    {
        const check = checks[i];
        if (check._tag === "FilterGroup")
        {
            issues = collectIssues(check.checks, value, issues, ast, options);
            if (issues &&
                (options.errors !== "all" || (issues[issues.length - 1] as SchemaIssue.Filter).filter.aborted))
            {
                return issues;
            }
        }
        else
        {
            const issue = check.run(value, ast, options);
            if (issue)
            {
                const filter = new SchemaIssue.Filter(check, issue, value, options);
                if (issues)
                {issues.push(filter);}
                else
                {issues = [ filter ];}

                if (options.errors !== "all" || check.aborted)
                {
                    return issues;
                }
            }
        }
    }

    return issues;
};

/**
 * Supports run checks during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const runChecks = <T>(checks: readonly [
    Check<T>,
    ...Array<Check<T>>
], s: T): Result.Result<T, SchemaIssue.Issue> =>
{
    const issues = collectIssues(checks, s, undefined, unknown, { errors: "all" });
    if (issues)
    {
        const issue = new SchemaIssue.Composite(unknown, issues);
        return Result.fail(issue);
    }

    return Result.succeed(s);
};

/**
 * Supports constructor descriptor during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface ConstructorDescriptor
{
    readonly isConstructed: Predicate.Predicate<unknown>;
    readonly link: Link;
}

/**
 * Supports get constructor descriptor during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const getConstructorDescriptor = (ast: AST): ConstructorDescriptor | undefined =>
{
    if (!isDeclaration(ast))
    {return undefined;}

    const getDescriptor = ast.annotations?.[InternalAnnotations.ConstructorAnnotationKey];
    return Predicate.isFunction(getDescriptor) ? getDescriptor(ast.typeParameters) : undefined;
};

/**
 * Returns all annotations from the AST node.
 *
 * @category annotations
 * @since 1.0.0
 */
export const resolve: (ast: AST) => Schema.Annotations.Annotations | undefined = InternalAnnotations.resolve;

/**
 * Returns a single annotation value by key from the AST node.
 *
 * @category annotations
 * @since 1.0.0
 */
export const resolveAt: <A>(key: string) => (ast: AST) => A | undefined = InternalAnnotations.resolveAt;

/**
 * Returns the `identifier` annotation from the AST node, if set.
 *
 * @category annotations
 * @since 1.0.0
 */
export const resolveIdentifier: (ast: AST) => string | undefined = InternalAnnotations.resolveIdentifier;

/**
 * Returns the `title` annotation from the AST node, if set.
 *
 * @category annotations
 * @since 1.0.0
 */
export const resolveTitle: (ast: AST) => string | undefined = InternalAnnotations.resolveTitle;

/**
 * Returns the `description` annotation from the AST node, if set.
 *
 * @category annotations
 * @since 1.0.0
 */
export const resolveDescription: (ast: AST) => string | undefined = InternalAnnotations.resolveDescription;

type TreeFrame = {
    readonly value: object;
    // Object keys or an array length snapshot.
    readonly keys: ReadonlyArray<string> | number;
    index: number;
};

/**
 * Supports is json leaf during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isJsonLeaf = (u: unknown): boolean =>
{
    return u === null || typeof u === "string" || typeof u === "boolean" ||
        typeof u === "number" && globalThis.Number.isFinite(u);
};

/**
 * Supports is tree during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const isTree = (u: unknown, isLeaf: (u: unknown) => boolean): boolean =>
{
    const cache = new WeakMap<object, boolean>();
    const stack: Array<TreeFrame> = [];
    outer: while (true)
    {
        if (typeof u !== "object" || u === null)
        {
            if (!isLeaf(u))
            {
                return false;
            }
        }
        else
        {
            const value = u;
            const cached = cache.get(value);
            // `false` marks a node on the current path, while `true` marks a fully
            // validated node that can be safely reused by a DAG.
            if (cached === false)
            {
                return false;
            }

            if (cached === undefined)
            {
                const isArray = Array.isArray(value);
                if (!isArray)
                {
                    const prototype = Object.getPrototypeOf(value);
                    // A plain object from another realm has a different Object.prototype,
                    // but that prototype still has a null prototype.
                    if (prototype !== null &&
                        prototype !== Object.prototype &&
                        Object.getPrototypeOf(prototype) !== null)
                    {
                        return false;
                    }
                }

                cache.set(value, false);
                stack.push({
                    value,
                    keys: isArray ? value.length : Object.keys(value),
                    index: 0
                });
            }
        }

        while (stack.length > 0)
        {
            const frame = stack[stack.length - 1];
            const keys = frame.keys;
            if (typeof keys === "number")
            {
                if (frame.index < keys)
                {
                    // A sparse slot is read as `undefined`; the leaf predicate determines
                    // whether that is valid for the current tree.
                    u = (frame.value as ReadonlyArray<unknown>)[frame.index++];
                    continue outer;
                }
            }
            else if (frame.index < keys.length)
            {
                u = (frame.value as Record<string, unknown>)[keys[frame.index++]];
                continue outer;
            }

            cache.set(frame.value, true);
            stack.pop();
        }

        return true;
    }
};

/**
 * Returns true if the value is a JSON value.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isJson = (u: unknown): u is Schema.Json =>
{
    return isTree(u, isJsonLeaf);
};

/**
 * Supports json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Json = new Declaration([], () => (input, ast, options) => isJson(input) ?
    InternalParser.sameExit :
    Result.fail(new SchemaIssue.InvalidType(ast, input, options)), {
    "~representation": {
        id: "effect/schema/Json",
        payload: null
    },
    expected: "JSON value",
    toCodecJson: () => undefined,
    toCodecStringTree: () => unknownToJson
});

/**
 * Supports mutable json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const MutableJson = annotate(Json, {
    "~representation": {
        id: "effect/schema/MutableJson",
        payload: null
    }
});

/**
 * Supports unknown to json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const unknownToJson = new Link(Json, SchemaTransformation.passthrough());

/**
 * Supports object keyword to json during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const objectKeywordToJson = new Link(new Union([
    new Arrays(false, [], [ Json ]),
    new Objects([], [ new IndexSignature(string, Json) ])
]), SchemaTransformation.passthrough());

/**
 * Derives private primitive string codecs used by JSON and index signatures.
 *
 * @category Parsing
 * @since 1.0.0
 */
export const stringCodec = (ast: AST): AST =>
{
    switch (ast._tag)
    {
        case "Enum": return enumToStringCodec(ast);
        case "UniqueSymbol": return uniqueSymbolToStringCodec(ast);
        case "Literal": return literalToStringCodec(ast);
        case "Number": return numberToStringCodec(ast);
        case "Symbol": return symbolToStringCodec(ast);
        case "BigInt": return bigIntToStringCodec(ast); default: return ast;
    }
};

/**
 * Supports enum to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const enumToStringCodec = (ast: Enum): AST =>
{
    if (ast.enums.some(([ _, v ]) => typeof v === "number"))
    {
        const coercions = Object.fromEntries(ast.enums.map(([ _, v ]) => [ globalThis.String(v), v ]));
        return replaceEncoding(ast, [
            new Link(new Union(Object.keys(coercions).map((k) => new Literal(k))), new SchemaTransformation.Transformation(SchemaGetter.transform((s) => coercions[s]), SchemaGetter.String()))
        ]);
    }

    return ast;
};

/**
 * Supports unique symbol to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const uniqueSymbolToStringCodec = (ast: UniqueSymbol): AST =>
{
    const key = globalThis.Symbol.keyFor(ast.symbol);
    return replaceEncoding(ast, [
        new Link(key === undefined ? never : new Literal(globalThis.String(ast.symbol)), symbolToString.transformation)
    ]);
};

/**
 * Supports literal to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const literalToStringCodec = (ast: Literal): AST =>
{
    return typeof ast.literal === "string" ? ast : literalToString(ast);
};

/**
 * Supports number to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const numberToStringCodec = (ast: Number): AST =>
{
    if (ast.toCodecJson() === ast)
    {
        return replaceEncoding(ast, [ finiteToString ]);
    }

    return replaceEncoding(ast, [ numberToString ]);
};

/**
 * Supports symbol to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const symbolToStringCodec = (ast: Symbol): AST =>
{
    return replaceEncoding(ast, [ symbolToString ]);
};

/**
 * Supports big int to string codec during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const bigIntToStringCodec = (ast: BigInt): AST =>
{
    return replaceEncoding(ast, [ bigIntToString ]);
};

type ArrayParserState = {
    readonly ast: AST
    readonly input: ReadonlyArray<unknown>
    readonly len: number
    readonly getParser: (
        tailThreshold: number,
        index: number
    ) => { readonly ast: AST;
        readonly parser: SchemaParser.Parser }
    readonly tailThreshold: number
    readonly options: ParseOptions
    readonly output: Array<unknown>
    issues: Arr.NonEmptyArray<SchemaIssue.Issue> | undefined
};

/**
 * Supports step array during synchronous schema processing.
 *
 *  @internal
 *
 * @category Internal
 * @since 1.0.0
 */
export const stepArray = (
    s: ArrayParserState,
    item: unknown,
    exit: Result.Result<unknown, SchemaIssue.Issue>,
    i: number
) =>
{
    if (exit._tag === "Failure")
    {
        return wrapPropertyKeyIssue(s, s.ast, i, exit);
    }

    const value = exit === InternalParser.sameExit
        ? item
        : (exit as InternalParser.Success<unknown, SchemaIssue.Issue>).success;
    if (value !== InternalParser.missing)
    {
        s.output[i] = value;
    }
    else
    {
        const p = s.getParser(s.tailThreshold, i);
        if (isOptional(p.ast)) {return;}

        const issue = new SchemaIssue.Pointer([ i ], new SchemaIssue.MissingKey(p.ast.context?.annotations));
        if (s.options.errors === "all")
        {
            if (s.issues) {s.issues.push(issue);}
            else {s.issues = [ issue ];}
        }
        else
        {
            return Result.fail(
                new SchemaIssue.Composite(s.ast, [ issue ], s.input, s.options)
            );
        }
    }
};

const parseArrayOptions = {
    onItem(s: ArrayParserState, item: unknown, i: number)
    {
        const value = i < s.len ? item : InternalParser.missing;
        return s.getParser(s.tailThreshold, i).parser(value, s.options);
    },
    step: stepArray
};

type ObjectParserState = {
    readonly ast: Objects
    readonly input: Record<PropertyKey, unknown>
    readonly options: ParseOptions
    readonly out: Record<PropertyKey, unknown>
    issues: Arr.NonEmptyArray<SchemaIssue.Issue> | undefined
};

type ParsedProperty = {
    readonly parser: SchemaParser.Parser
    readonly name: PropertyKey
    readonly type: AST
};

/**
 * Supports step property during synchronous schema processing.
 *
 *  @internal
 *
 * @category Internal
 * @since 1.0.0
 */
export const stepProperty = (
    s: ObjectParserState,
    p: ParsedProperty,
    exit: Result.Result<unknown, SchemaIssue.Issue>
): Result.Result<void, SchemaIssue.Issue> | void =>
{
    if (exit._tag === "Failure")
    {
        return wrapPropertyKeyIssue(s, s.ast, p.name, exit);
    }

    if (exit === InternalParser.sameExit) {return;}

    const value = (exit as InternalParser.Success<unknown, SchemaIssue.Issue>).success;
    if (value !== InternalParser.missing)
    {
        InternalRecord.assignProperty(s.out, p.name, value);
        return;
    }

    delete s.out[p.name];
    if (!isOptional(p.type))
    {
        const issue = new SchemaIssue.Pointer([ p.name ], new SchemaIssue.MissingKey(p.type.context?.annotations));
        if (s.options.errors === "all")
        {
            if (s.issues) {s.issues.push(issue);}
            else {s.issues = [ issue ];}

            return;
        }
        else
        {
            return Result.fail(
                new SchemaIssue.Composite(s.ast, [ issue ], s.input, s.options)
            );
        }
    }
};

const parsePropertiesOptions = {
    onItem(s: ObjectParserState, p: ParsedProperty)
    {
        if (!hasPropertySignature(s.input, p.name))
        {
            return p.parser(InternalParser.missing, s.options);
        }

        const value = s.input[p.name];
        InternalRecord.assignProperty(s.out, p.name, value);
        return p.parser(value, s.options);
    },
    step: stepProperty
};

/**
 * Supports wrap property key issue during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
const wrapPropertyKeyIssue = (s: { input: unknown;
    options: ParseOptions;
    issues: Array<SchemaIssue.Issue> | undefined }, ast: AST, key: PropertyKey, result: Result.Failure<unknown, SchemaIssue.Issue>): Result.Result<void, SchemaIssue.Issue> | undefined =>
{
    const pointer = new SchemaIssue.Pointer([ key ], result.failure);
    if (s.options.errors === "all")
    {
        if (s.issues){s.issues.push(pointer);}
        else {s.issues = [ pointer ];}

        return;
    }

    return Result.fail(new SchemaIssue.Composite(ast, [ pointer ], s.input, s.options));
};

/**
 * Supports parse array during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
export const parseArray = (state: ArrayParserState, items: ReadonlyArray<unknown>, start = 0, end = items.length): Result.Result<void, SchemaIssue.Issue> | undefined => { for (let i = start;i < end;i++) { const result = stepArray(state, items[i], parseArrayOptions.onItem(state, items[i], i), i); if (result) {return result;} } };

/**
 * Supports parse properties during synchronous schema processing.
 *
 *
 * @category Internal
 * @since 1.0.0
 */
export const parseProperties = (state: ObjectParserState, items: ReadonlyArray<ParsedProperty>, start = 0, end = items.length): Result.Result<void, SchemaIssue.Issue> | undefined => { for (let i = start;i < end;i++) { const result = stepProperty(state, items[i], parsePropertiesOptions.onItem(state, items[i])); if (result) {return result;} } };

