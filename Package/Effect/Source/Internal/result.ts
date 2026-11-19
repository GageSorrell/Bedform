/**
 * Internal success and failure representations and result operations.
 *
 * @module @bedform/effect/Internal/result
 *
 * @file      result.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Upstream object member order is part of inspection and serialization behavior. */
/* eslint sort-keys: "off" */

import * as Equal from "../Equal.js";
import * as Hash from "../Hash.js";
import type * as Result from "../Result.js";
import * as option from "./option.js";
import type { Option } from "../Option.js";
import { PipeInspectableProto } from "./core.js";
import { SingleShotGen } from "../Utils.js";
import { dual } from "../Function.js";
import { format } from "../Formatter.js";
import { hasProperty } from "../Predicate.js";
import { toJson } from "../Inspectable.js";

const TypeId = "~effect/Result";

const CommonProto = {
    [TypeId]: {
    /* v8 ignore next 2 */
        _A: (_: never) => _,
        _E: (_: never) => _
    },
    ...PipeInspectableProto,
    [Symbol.iterator]()
    {
        return new SingleShotGen(this);
    }
};

const SuccessProto = Object.assign(Object.create(CommonProto), {
    _tag: "Success",
    _op: "Success",
    [Equal.symbol]<A, E>(this: Result.Success<A, E>, that: unknown): boolean
    {
        return (
            isResult(that) && isSuccess(that) && Equal.equals(this.success, that.success)
        );
    },
    [Hash.symbol]<A, E>(this: Result.Success<A, E>)
    {
        return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.success));
    },
    toString<A, E>(this: Result.Success<A, E>)
    {
        return `success(${format(this.success)})`;
    },
    toJSON<A, E>(this: Result.Success<A, E>)
    {
        return {
            _id: "Result",
            _tag: this._tag,
            value: toJson(this.success)
        };
    }
});

const FailureProto = Object.assign(Object.create(CommonProto), {
    _tag: "Failure",
    _op: "Failure",
    [Equal.symbol]<A, E>(this: Result.Failure<A, E>, that: unknown): boolean
    {
        return isResult(that) && isFailure(that) && Equal.equals(this.failure, that.failure);
    },
    [Hash.symbol]<A, E>(this: Result.Failure<A, E>)
    {
        return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.failure));
    },
    toString<A, E>(this: Result.Failure<A, E>)
    {
        return `failure(${format(this.failure)})`;
    },
    toJSON<A, E>(this: Result.Failure<A, E>)
    {
        return {
            _id: "Result",
            _tag: this._tag,
            failure: toJson(this.failure)
        };
    }
});

/**
 * Provides the `isResult` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isResult = (input: unknown): input is Result.Result<unknown, unknown> =>
    hasProperty(input, TypeId);

/**
 * Provides the `isFailure` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isFailure = <A, E>(result: Result.Result<A, E>): result is Result.Failure<A, E> =>
    result._tag === "Failure";

/**
 * Provides the `isSuccess` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isSuccess = <A, E>(result: Result.Result<A, E>): result is Result.Success<A, E> =>
    result._tag === "Success";

/**
 * Constructs the internal failed Result value.
 *
 * @internal
 *
 * @category Constructor
 * @since 1.0.0
 */
const FailureImpl = function(this: any, failure: unknown)
{
    this.failure = failure;
} as unknown as { new<E>(failure: E): Result.Result<never, E>;
    prototype: any };
FailureImpl.prototype = FailureProto;

/**
 * Provides the `fail` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const fail = <E>(failure: E): Result.Result<never, E> => new FailureImpl(failure);

/**
 * Constructs the internal successful Result value.
 *
 * @internal
 *
 * @category Constructor
 * @since 1.0.0
 */
const SuccessImpl = function(this: any, success: unknown)
{
    this.success = success;
} as unknown as { new<A>(success: A): Result.Result<A>;
    prototype: any };
SuccessImpl.prototype = SuccessProto;

/**
 * Provides the `succeed` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const succeed = <A>(success: A): Result.Result<A> => new SuccessImpl(success);

/**
 * Provides the `getFailure` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const getFailure = <A, E>(self: Result.Result<A, E>): Option<E> =>
    isSuccess(self) ? option.none : option.some(self.failure);

/**
 * Provides the `getSuccess` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const getSuccess = <A, E>(self: Result.Result<A, E>): Option<A> =>
    isFailure(self) ? option.none : option.some(self.success);

/**
 * Provides the `fromOption` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const fromOption: {
    <E>(onNone: () => E): <A>(self: Option<A>) => Result.Result<A, E>
    <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E>
} = dual(
    2,
    <A, E>(self: Option<A>, onNone: () => E): Result.Result<A, E> =>
        option.isNone(self) ? fail(onNone()) : succeed(self.value)
);
