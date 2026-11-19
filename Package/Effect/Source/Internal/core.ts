/**
 * The core of the Effect runtime: the effect, exit and cause protocols and
 * prototypes, continuation markers, primitive effect constructors, and cause
 * construction and combination. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/core
 *
 * @file      core.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, prefer-rest-params, @stylistic/max-len */

/* Preserve upstream statement layout, type-level inference names and signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type * as Cause from "../Cause.js";
import type * as Context from "../Context.js";
import type * as Effect from "../Effect.js";
import * as Equal from "../Equal.js";
import type * as Exit from "../Exit.js";
import { format } from "../Formatter.js";
import { dual, identity } from "../Function.js";
import * as Hash from "../Hash.js";
import { NodeInspectSymbol } from "../Inspectable.js";
import { pipeArguments } from "../Pipeable.js";
import { hasProperty } from "../Predicate.js";
import type { StackFrame } from "../References.js";
import type * as Types from "../Types.js";
import { SingleShotGen } from "../Utils.js";
import type { FiberImpl } from "./effect.js";
import * as InternalRecord from "./record.js";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const EffectTypeId = "~effect/Effect" as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const ExitTypeId = "~effect/Exit" as const;

const effectVariance = {
    _A: identity,
    _E: identity,
    _R: identity
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const identifier = `${EffectTypeId}/identifier` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type identifier = typeof identifier;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const args = `${EffectTypeId}/args` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type args = typeof args;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const evaluate = `${EffectTypeId}/evaluate` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type evaluate = typeof evaluate;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const contA = `${EffectTypeId}/successCont` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type contA = typeof contA;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const contE = `${EffectTypeId}/failureCont` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type contE = typeof contE;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const contAll = `${EffectTypeId}/ensureCont` as const;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type contAll = typeof contAll;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Yield = Symbol.for("effect/Effect/Yield");

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export type Yield = typeof Yield;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const PipeInspectableProto = {
    pipe()
    {
        return pipeArguments(this, arguments);
    },
    toJSON(this: any)
    {
        return { ...this };
    },
    toString()
    {
        return format(this.toJSON(), { ignoreToString: true,
            space: 2 });
    },
    [NodeInspectSymbol]()
    {
        return this.toJSON();
    }
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const StructuralProto = {
    [Hash.symbol](this: any): number
    {
        return Hash.structureKeys(this, Object.keys(this));
    },
    [Equal.symbol](this: any, that: any): boolean
    {
        const selfKeys = Object.keys(this);
        const thatKeys = Object.keys(that);
        if (selfKeys.length !== thatKeys.length) {return false;}

        for (let i = 0; i < selfKeys.length; i++)
        {
            if (selfKeys[i] !== thatKeys[i] || !Equal.equals(this[selfKeys[i]], that[selfKeys[i]]))
            {
                return false;
            }
        }

        return true;
    }
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const EffectProto = {
    [EffectTypeId]: effectVariance,
    ...PipeInspectableProto,
    [Symbol.iterator]()
    {
        return new SingleShotGen(this) as any;
    },
    toJSON(this: Primitive)
    {
        return {
            _id: "Effect",
            op: this[identifier],
            ...(args in this ? { args: this[args] } : undefined)
        };
    }
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isEffect = (u: unknown): u is Effect.Effect<unknown, unknown, unknown> => hasProperty(u, EffectTypeId);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isExit = (u: unknown): u is Exit.Exit<unknown, unknown> => hasProperty(u, ExitTypeId);

// ----------------------------------------------------------------------------
// Cause
// ----------------------------------------------------------------------------

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CauseTypeId = "~effect/Cause";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const CauseReasonTypeId = "~effect/Cause/Reason";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isCause = (self: unknown): self is Cause.Cause<unknown> => hasProperty(self, CauseTypeId);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isCauseReason = (self: unknown): self is Cause.Reason<unknown> => hasProperty(self, CauseReasonTypeId);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export class CauseImpl<E> implements Cause.Cause<E>
{
    declare readonly [CauseTypeId]: typeof CauseTypeId;
    declare readonly reasons: ReadonlyArray<
    Cause.Fail<E> | Cause.Die | Cause.Interrupt
    >;
    constructor(
        failures: ReadonlyArray<
      Cause.Fail<E> | Cause.Die | Cause.Interrupt
        >
    )
    {
        this[CauseTypeId] = CauseTypeId;
        this.reasons = failures;
    }
    pipe()
    {
        return pipeArguments(this, arguments);
    }
    toJSON(): unknown
    {
        return {
            _id: "Cause",
            failures: this.reasons.map((f) => f.toJSON())
        };
    }
    toString()
    {
        return `Cause(${format(this.reasons)})`;
    }
    [NodeInspectSymbol]()
    {
        return this.toJSON();
    }
    [Equal.symbol](that: any): boolean
    {
        return (
            isCause(that) &&
      this.reasons.length === that.reasons.length &&
      this.reasons.every((e, i) => Equal.equals(e, that.reasons[i]))
        );
    }
    [Hash.symbol](): number
    {
        return Hash.array(this.reasons);
    }
}

const annotationsMap = new WeakMap<object, ReadonlyMap<string, unknown>>();

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export abstract class ReasonBase<Tag extends string> implements Cause.Cause.ReasonProto<Tag>
{
    readonly [CauseReasonTypeId]: typeof CauseReasonTypeId;
    readonly annotations: ReadonlyMap<string, unknown>;
    readonly _tag: Tag;

    constructor(
        _tag: Tag,
        annotations: ReadonlyMap<string, unknown>,
        originalError: unknown
    )
    {
        this[CauseReasonTypeId] = CauseReasonTypeId;
        this._tag = _tag;
        if (
            annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null &&
      annotations.size > 0
        )
        {
            const prevAnnotations = annotationsMap.get(originalError);
            if (prevAnnotations)
            {
                annotations = new Map([
                    ...prevAnnotations,
                    ...annotations
                ]);
            }

            annotationsMap.set(originalError, annotations);
        }

        this.annotations = annotations;
    }

    annotate(
        annotations: Context.Context<never>,
        options?: { readonly overwrite?: boolean | undefined }
    ): this
    {
        if (annotations.mapUnsafe.size === 0) {return this;}

        const newAnnotations = new Map(this.annotations);
        annotations.mapUnsafe.forEach((value, key) =>
        {
            if (options?.overwrite !== true && newAnnotations.has(key)) {return;}

            newAnnotations.set(key, value);
        });
        const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
        self.annotations = newAnnotations;
        return self;
    }

    pipe()
    {
        return pipeArguments(this, arguments);
    }

    abstract toJSON(): unknown;
    abstract [Equal.symbol](that: any): boolean;
    abstract [Hash.symbol](): number;

    toString()
    {
        return format(this);
    }

    [NodeInspectSymbol]()
    {
        return this.toString();
    }
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const constEmptyAnnotations: ReadonlyMap<string, unknown> = new Map<string, unknown>();

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export class Fail<E> extends ReasonBase<"Fail"> implements Cause.Fail<E>
{
    declare readonly error: E;
    constructor(
        error: E,
        annotations = constEmptyAnnotations
    )
    {
        super("Fail", annotations, error);
        this.error = error;
    }
    override toString()
    {
        return `Fail(${format(this.error)})`;
    }
    toJSON(): unknown
    {
        return {
            _tag: "Fail",
            error: this.error
        };
    }
    [Equal.symbol](that: any): boolean
    {
        return (
            isFailReason(that) &&
      Equal.equals(this.error, that.error) &&
      Equal.equals(this.annotations, that.annotations)
        );
    }
    [Hash.symbol](): number
    {
        return Hash.combine(Hash.string(this._tag))(
            Hash.combine(Hash.hash(this.error))(Hash.hash(this.annotations))
        );
    }
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeFromReasons = <E>(
    reasons: ReadonlyArray<Cause.Reason<E>>
): Cause.Cause<E> => new CauseImpl(reasons);

const dedupeReasons = <E>(
    self: ReadonlyArray<Cause.Reason<E>>,
    that: ReadonlyArray<Cause.Reason<E>>
): Array<Cause.Reason<E>> =>
{
    // Avoid importing Array.ts into the core bundle.
    // Snapshot both arrays before invoking user-defined hash or equality methods.
    const buckets = new Map<number, Array<Cause.Reason<E>>>();
    const out: Array<Cause.Reason<E>> = [];
    for (const reason of self.concat(that))
    {
        const hash = Hash.hash(reason);
        const bucket = buckets.get(hash);
        if (bucket === undefined)
        {
            buckets.set(hash, [ reason ]);
        }
        else if (bucket.some((previous) => Equal.equals(previous, reason)))
        {
            continue;
        }
        else
        {
            bucket.push(reason);
        }

        out.push(reason);
    }

    return out;
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeCombine: {
    <E2>(that: Cause.Cause<E2>): <E>(self: Cause.Cause<E>) => Cause.Cause<E | E2>
    <E, E2>(self: Cause.Cause<E>, that: Cause.Cause<E2>): Cause.Cause<E | E2>
} = dual(
    2,
    <E, E2>(self: Cause.Cause<E>, that: Cause.Cause<E2>): Cause.Cause<E | E2> =>
    {
        if (self.reasons.length === 0)
        {
            return that as Cause.Cause<E | E2>;
        }
        else if (that.reasons.length === 0)
        {
            return self as Cause.Cause<E | E2>;
        }

        const newCause = new CauseImpl<E | E2>(
            dedupeReasons<E | E2>(self.reasons, that.reasons)
        );
        return Equal.equals(self, newCause) ? self : newCause;
    }
);

/**
 * Appends the interrupts from `interrupts` that `self` does not contain yet.
 * Unlike `causeCombine`, it never calls hash or equality methods, which can be
 * user-defined, random, or throwing.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeAddInterrupts = <E>(self: Cause.Cause<E>, interrupts: Cause.Cause<never>): Cause.Cause<E> =>
{
    const reasons: Array<Cause.Reason<E>> = self.reasons.slice();
    for (const reason of interrupts.reasons)
    {
        if (
            isInterruptReason(reason) &&
      !reasons.some((r) => isInterruptReason(r) && r.fiberId === reason.fiberId && r.annotations === reason.annotations)
        )
        {
            reasons.push(reason);
        }
    }

    return reasons.length === self.reasons.length ? self : new CauseImpl(reasons);
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeEmpty: Cause.Cause<never> = new CauseImpl([]);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeFail = <E>(error: E): Cause.Cause<E> => new CauseImpl([ new Fail(error) ]);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export class Die extends ReasonBase<"Die"> implements Cause.Die
{
    declare readonly defect: unknown;
    constructor(
        defect: unknown,
        annotations = constEmptyAnnotations
    )
    {
        super("Die", annotations, defect);
        this.defect = defect;
    }
    override toString()
    {
        return `Die(${format(this.defect)})`;
    }
    toJSON(): unknown
    {
        return {
            _tag: "Die",
            defect: this.defect
        };
    }
    [Equal.symbol](that: any): boolean
    {
        return (
            isDieReason(that) &&
      Equal.equals(this.defect, that.defect) &&
      Equal.equals(this.annotations, that.annotations)
        );
    }
    [Hash.symbol](): number
    {
        return Hash.combine(Hash.string(this._tag))(
            Hash.combine(Hash.hash(this.defect))(Hash.hash(this.annotations))
        );
    }
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeDie = (defect: unknown): Cause.Cause<never> => new CauseImpl([ new Die(defect) ]);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const causeAnnotate: {
    (
        annotations: Context.Context<never>,
        options?: {
            readonly overwrite?: boolean | undefined
        }
    ): <E>(self: Cause.Cause<E>) => Cause.Cause<E>
    <E>(
        self: Cause.Cause<E>,
        annotations: Context.Context<never>,
        options?: {
            readonly overwrite?: boolean | undefined
        }
    ): Cause.Cause<E>
} = dual(
    (args) => isCause(args[0]),
    <E>(
        self: Cause.Cause<E>,
        annotations: Context.Context<never>,
        options?: {
            readonly overwrite?: boolean | undefined
        }
    ): Cause.Cause<E> =>
    {
        if (annotations.mapUnsafe.size === 0) {return self;}

        return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
    }
);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isFailReason = <E>(
    self: Cause.Reason<E>
): self is Cause.Fail<E> => self._tag === "Fail";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isDieReason = <E>(self: Cause.Reason<E>): self is Cause.Die => self._tag === "Die";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isInterruptReason = <E>(self: Cause.Reason<E>): self is Cause.Interrupt => self._tag === "Interrupt";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export interface Primitive {
    readonly [identifier]: string
    readonly [contA]:
    | ((value: unknown, fiber: FiberImpl, exit?: Exit.Exit<any, any>) => Primitive | Yield)
    | undefined
    readonly [contE]:
    | ((cause: Cause.Cause<unknown>, fiber: FiberImpl, exit?: Exit.Exit<any, any>) => Primitive | Yield)
    | undefined
    readonly [contAll]:
    | ((
        fiber: FiberImpl
    ) =>
      | ((value: unknown, fiber: FiberImpl) => Primitive | Yield)
      | undefined)
    | undefined
    [evaluate](fiber: FiberImpl): Primitive | Yield
}

interface PrimitiveClass {
    new(value: any): Primitive
    prototype: any
}

/**
 * Upstream helper from the pinned Effect implementation.
 *
 * @category Utilities
 * @since 1.0.0
 */
function defaultEvaluate(_fiber: FiberImpl): Primitive | Yield
{
    return exitDie("Effect.evaluate: Not implemented") as any;
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makePrimitiveProto = <Op extends string>(options: {
    readonly op: Op
    readonly [evaluate]?: (
        fiber: FiberImpl
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contA]?: (
        this: Primitive,
        value: any,
        fiber: FiberImpl,
        exit?: Exit.Exit<any, any>
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contE]?: (
        this: Primitive,
        cause: Cause.Cause<any>,
        fiber: FiberImpl,
        exit?: Exit.Exit<any, any>
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contAll]?: (
        this: Primitive,
        fiber: FiberImpl
    ) => void | ((value: any, fiber: FiberImpl) => void)
}): Primitive =>
    ({
        ...EffectProto,
        [identifier]: options.op,
        [evaluate]: options[evaluate] ?? defaultEvaluate,
        [contA]: options[contA],
        [contE]: options[contE],
        [contAll]: options[contAll]
    }) as any;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makePrimitive = <
    Fn extends (...args: Array<any>) => any
>(options: {
    readonly op: string
    readonly [evaluate]?: (
        this: Primitive & {
            readonly [args]: Parameters<Fn>[0]
        },
        fiber: FiberImpl
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contA]?: (
        this: Primitive & {
            readonly [args]: Parameters<Fn>[0]
        },
        value: any,
        fiber: FiberImpl,
        exit?: Exit.Exit<any, any>
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contE]?: (
        this: Primitive & {
            readonly [args]: Parameters<Fn>[0]
        },
        cause: Cause.Cause<any>,
        fiber: FiberImpl,
        exit?: Exit.Exit<any, any>
    ) => Primitive | Effect.Effect<any, any, any> | Yield
    readonly [contAll]?: (
        this: Primitive & {
            readonly [args]: Parameters<Fn>[0]
        },
        fiber: FiberImpl
    ) => void | ((value: any, fiber: FiberImpl) => void)
}): Fn =>
{
    const Proto = makePrimitiveProto(options as any);
    const PrimitiveImpl = function(this: any, value: any)
    {
        this[args] = value;
    } as unknown as PrimitiveClass;
    PrimitiveImpl.prototype = Proto;
    return function(value: any)
    {
        return new PrimitiveImpl(value);
    } as Fn;
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const makeExit = <
    Fn extends (...args: Array<any>) => any,
    Prop extends string
>(options: {
    readonly op: "Success" | "Failure"
    readonly prop: Prop
    readonly [evaluate]: (
        this: Exit.Exit<unknown, unknown> & { [args]: Parameters<Fn>[0] },
        fiber: FiberImpl<unknown, unknown>
    ) => Primitive | Yield
}): Fn =>
{
    const Proto = {
        [ExitTypeId]: ExitTypeId,
        _tag: options.op,
        get [options.prop](): any
        {
            return (this as any)[args];
        },
        ...makePrimitiveProto(options),
        toString(this: any)
        {
            return `${options.op}(${format(this[args])})`;
        },
        toJSON(this: any)
        {
            return {
                _id: "Exit",
                _tag: options.op,
                [options.prop]: this[args]
            };
        },
        [Equal.symbol](this: any, that: any): boolean
        {
            return (
                isExit(that) &&
        that._tag === this._tag &&
        Equal.equals(this[args], (that as any)[args])
            );
        },
        [Hash.symbol](this: any): number
        {
            return Hash.combine(Hash.string(options.op), Hash.hash(this[args]));
        }
    };
    const ExitPrimitive = function(this: any, value: unknown)
    {
        this[args] = value;
    } as unknown as PrimitiveClass;
    ExitPrimitive.prototype = Proto;
    return function(value: unknown)
    {
        return new ExitPrimitive(value);
    } as Fn;
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exitSucceed: <A>(a: A) => Exit.Exit<A> = makeExit({
    op: "Success",
    prop: "value",
    [evaluate](fiber)
    {
        const cont = fiber.getCont(contA);
        return cont ? cont[contA](this[args], fiber, this) : fiber.yieldWith(this);
    }
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const StackTraceKey = {
    key: "effect/Cause/StackTrace" satisfies typeof Cause.StackTrace.key
} as Context.Service<Cause.StackTrace, StackFrame>;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const InterruptorStackTrace = {
    key: "effect/Cause/InterruptorStackTrace" satisfies typeof Cause.InterruptorStackTrace.key
} as Context.Service<Cause.InterruptorStackTrace, StackFrame>;

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exitFailCause: <E>(cause: Cause.Cause<E>) => Exit.Exit<never, E> = makeExit({
    op: "Failure",
    prop: "cause",
    [evaluate](fiber)
    {
        let cause = this[args];
        let annotated = false;
        if (fiber.cache.stackFrame)
        {
            cause = causeAnnotate(cause, { mapUnsafe: new Map([ [ StackTraceKey.key, fiber.cache.stackFrame ] ]) } as any);
            annotated = true;
        }

        let cont = fiber.getCont(contE);
        const interruptedCause = fiber._interruptedCause;
        if (interruptedCause && fiber.interruptible)
        {
            // Drop typed failures only when interruption skips a recovery handler.
            // Interruptibility-restoration continuations have no identifier.
            let skippedHandler = false;
            while (cont && fiber.interruptible)
            {
                skippedHandler ||= identifier in cont;
                cont = fiber.getCont(contE);
            }

            if (skippedHandler)
            {
                cause = causeFromReasons(cause.reasons.filter((reason) => reason._tag !== "Fail"));
            }

            cause = causeAddInterrupts(cause, interruptedCause);
            annotated = true;
        }

        return cont
            ? cont[contE](cause, fiber, annotated ? undefined : this)
            : fiber.yieldWith(annotated ? exitFailCause(cause) : this);
    }
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exitFail = <E>(e: E): Exit.Exit<never, E> => exitFailCause(causeFail(e));

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const exitDie = (defect: unknown): Exit.Exit<never> => exitFailCause(causeDie(defect));

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const withFiber: <A, E = never, R = never>(
    evaluate: (fiber: FiberImpl<unknown, unknown>) => Effect.Effect<A, E, R>
) => Effect.Effect<A, E, R> = makePrimitive({
    op: "WithFiber",
    [evaluate](fiber)
    {
        return this[args](fiber);
    }
});

/**
 * Accesses the current fiber to compute a value without a separate `succeed`
 * operation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const withFiberSucceed: <A, R = never>(
    evaluate: (fiber: FiberImpl<unknown, unknown>) => A
) => Effect.Effect<A, never, R> = makePrimitive({
    op: "WithFiberSucceed",
    [evaluate](fiber)
    {
        const value = this[args](fiber);
        const cont = fiber.getCont(contA);
        return cont ? cont[contA](value, fiber) : fiber.yieldWith(exitSucceed(value));
    }
});

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const YieldableError: new(
    message?: string,
    options?: ErrorOptions
) => Cause.YieldableError = (function()
{
    class YieldableError extends globalThis.Error {}
    const proto = makePrimitiveProto({
        op: "YieldableError",
        [evaluate]()
        {
            return exitFail(this);
        }
    });
    delete (proto as any).toString;
    Object.assign(
        YieldableError.prototype,
        proto
    );
    return YieldableError as any;
})();

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Error: new<A extends Record<string, any> = {}>(
    args: Types.VoidIfEmpty<{ readonly [P in keyof A]: A[P] }>
) => Cause.YieldableError & Readonly<A> = (function()
{
    const plainArgsSymbol = Symbol.for("effect/Data/Error/plainArgs");
    return class Base extends YieldableError
    {
        constructor(args: Record<string, any> | undefined)
        {
            super(args?.message, args?.cause ? { cause: args.cause } : undefined);
            if (args)
            {
                InternalRecord.assignProperties(this, args);
                // @effect-diagnostics-next-line floatingEffect:off
                Object.defineProperty(this, plainArgsSymbol, {
                    value: args,
                    enumerable: false
                });
            }
        }
        override toJSON()
        {
            return { ...(this as any)[plainArgsSymbol],
                ...this };
        }
    } as any;
})();

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const TaggedError = <Tag extends string>(
    tag: Tag
): new<A extends Record<string, any> = {}>(
    args: Types.VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }>
) => Cause.YieldableError & { readonly _tag: Tag } & Readonly<A> =>
{
    class Base extends Error<{}>
    {
        readonly _tag = tag;
    }
    ;(Base.prototype as any).name = tag;
    return Base as any;
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isNoSuchElementError = (
    u: unknown
): u is Cause.NoSuchElementError => hasProperty(u, NoSuchElementErrorTypeId);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export class NoSuchElementError extends TaggedError("NoSuchElementError")
{
    readonly [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
    constructor(message?: string)
    {
        super({ message } as any);
    }
}

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const DoneTypeId = "~effect/Cause/Done";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const isDone = (
    u: unknown
): u is Cause.Done => hasProperty(u, DoneTypeId);

const DoneVoid: Cause.Done<void> = {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value: undefined
};

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const Done = <A = void>(value?: A): Cause.Done<A> =>
{
    if (value === undefined) {return DoneVoid as Cause.Done<A>;}

    return {
        [DoneTypeId]: DoneTypeId,
        _tag: "Done",
        value
    };
};

const doneVoid = exitFail(DoneVoid);

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const done = <A = void>(value?: A): Effect.Effect<never, Cause.Done<A>> =>
{
    if (value === undefined) {return doneVoid as any;}

    return exitFail(Done(value));
};
