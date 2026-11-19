/**
 * Internal optional-value representations and option operations.
 *
 * @module @bedform/effect/Internal/option
 *
 * @file      option.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Upstream object member order is part of inspection and serialization behavior. */
/* eslint sort-keys: "off" */

import * as Equal from "../Equal.js";
import * as Hash from "../Hash.js";
import type * as Option from "../Option.js";
import { PipeInspectableProto } from "./core.js";
import { SingleShotGen } from "../Utils.js";
import { format } from "../Formatter.js";
import { hasProperty } from "../Predicate.js";
import { toJson } from "../Inspectable.js";

const TypeId = "~effect/Option";

const CommonProto = {
    [TypeId]: {
        _A: (_: never) => _
    },
    ...PipeInspectableProto,
    [Symbol.iterator]()
    {
        return new SingleShotGen(this);
    }
};

// `valueOrUndefined` is folded into the initializer (rather than a separate
// `Object.defineProperty(SomeProto, ...)` statement) so the whole definition
// is pure-annotated by the build and tree-shakable.
const SomeProto = Object.defineProperty(
    Object.assign(Object.create(CommonProto), {
        _tag: "Some",
        _op: "Some",
        [Equal.symbol]<A>(this: Option.Some<A>, that: unknown): boolean
        {
            return (
                isOption(that) && isSome(that) && Equal.equals(this.value, that.value)
            );
        },
        [Hash.symbol]<A>(this: Option.Some<A>)
        {
            return Hash.combine(Hash.hash(this._tag))(Hash.hash(this.value));
        },
        toString<A>(this: Option.Some<A>)
        {
            return `some(${format(this.value)})`;
        },
        toJSON<A>(this: Option.Some<A>)
        {
            return {
                _id: "Option",
                _tag: this._tag,
                value: toJson(this.value)
            };
        }
    }),
    "valueOrUndefined",
    {
        get()
        {
            return this.value;
        }
    }
);

const NoneHash = Hash.hash("None");
const NoneProto = Object.assign(Object.create(CommonProto), {
    _tag: "None",
    _op: "None",
    valueOrUndefined: undefined,
    [Equal.symbol]<A>(this: Option.None<A>, that: unknown): boolean
    {
        return isOption(that) && isNone(that);
    },
    [Hash.symbol]<A>(this: Option.None<A>)
    {
        return NoneHash;
    },
    toString<A>(this: Option.None<A>)
    {
        return "none()";
    },
    toJSON<A>(this: Option.None<A>)
    {
        return {
            _id: "Option",
            _tag: this._tag
        };
    }
});

/**
 * Provides the `isOption` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isOption = (input: unknown): input is Option.Option<unknown> => hasProperty(input, TypeId);

/**
 * Provides the `isNone` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isNone = <A>(fa: Option.Option<A>): fa is Option.None<A> => fa._tag === "None";

/**
 * Provides the `isSome` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const isSome = <A>(fa: Option.Option<A>): fa is Option.Some<A> => fa._tag === "Some";

/**
 * Provides the `none` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const none: Option.Option<never> = Object.create(NoneProto);

/**
 * Constructs the internal Some value with its preserved prototype.
 *
 * @internal
 *
 * @category Constructor
 * @since 1.0.0
 */
const SomeImpl = function(this: any, value: unknown)
{
    this.value = value;
} as unknown as { new<A>(value: A): Option.Option<A>;
    prototype: any };
SomeImpl.prototype = SomeProto;

/**
 * Provides the `some` helper.
 *
 * @internal
 *
 * @category Model
 * @since 1.0.0
 */
export const some = <A>(value: A): Option.Option<A> => new SomeImpl(value);
