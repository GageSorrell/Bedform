/**
 * Request execution: submits requests to their resolvers and batches pending
 * requests by resolver and batch key. Ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/request
 *
 * @file      request.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

/* Preserve upstream statement layout, type-level inference names and signatures. */
/* eslint-disable @stylistic/max-statements-per-line, @typescript-eslint/no-unsafe-function-type */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import type { NonEmptyArray } from "../Array.js";
import * as Context from "../Context.js";
import type { Effect } from "../Effect.js";
import type { Exit } from "../Exit.js";
import type { Fiber } from "../Fiber.js";
import { dual } from "../Function.js";
import * as MutableHashMap from "../MutableHashMap.js";
import * as Option from "../Option.js";
import type * as Request from "../Request.js";
import { makeEntry } from "../Request.js";
import type { RequestResolver } from "./requestResolver-types.js";
import { Scheduler } from "../Scheduler.js";
import { exitDie, isEffect } from "./core.js";
import * as effect from "./effect.js";

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const request: {
    <A extends Request.Any, EX = never, RX = never>(
        resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
    ): (self: A) => Effect<
        Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
    >
    <A extends Request.Any, EX = never, RX = never>(
        self: A,
        resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
    ): Effect<
        Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
    >
} = dual(
    2,
    <A extends Request.Any, EX = never, RX = never>(
        self: A,
        resolver: RequestResolver<A> | Effect<RequestResolver<A>, EX, RX>
    ): Effect<
        Request.Success<A>,
    Request.Error<A> | EX,
    Request.Services<A> | RX
    > =>
    {
        const withResolver = (resolver: RequestResolver<A>) =>
            effect.callback<
                Request.Success<A>,
                Request.Error<A>,
                Request.Services<A>
            >((resume) =>
            {
                const entry = addEntry(resolver, self, resume, effect.getCurrentFiber()!);
                return maybeRemoveEntry(resolver, entry);
            });
        return isEffect(resolver) ? effect.flatMap(resolver, withResolver) : withResolver(resolver);
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
export const requestUnsafe = <A extends Request.Any>(
    self: A,
    options: {
        readonly resolver: RequestResolver<A>
        readonly onExit: (exit: Exit<Request.Success<A>, Request.Error<A>>) => void
        readonly context: Context.Context<never>
    }
): () => void =>
{
    const entry = addEntry(options.resolver, self, options.onExit, {
        context: options.context,
        cache: { scheduler: Context.get(options.context, Scheduler) }
    });
    return () => removeEntryUnsafe(options.resolver, entry);
};

/**
 * Pending batches of resolvers whose `batchKey` is in this set match keys with
 * `Equal` instead of by reference.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const equalBatchKeys = new WeakSet<Function>();

interface BatchMap {
    get(key: unknown): Batch | undefined
    has(key: unknown): boolean
    set(key: unknown, batch: Batch): void
    delete(key: unknown): void
}

const makeBatchMap = (resolver: RequestResolver<any>): BatchMap =>
{
    if (!equalBatchKeys.has(resolver.batchKey)) {return new Map();}

    const map = MutableHashMap.empty<unknown, Batch>();
    return {
        get: (key) => Option.getOrUndefined(MutableHashMap.get(map, key)),
        has: (key) => MutableHashMap.has(map, key),
        set: (key, batch) => MutableHashMap.set(map, key, batch),
        delete: (key) => MutableHashMap.remove(map, key)
    };
};

interface Batch {
    key: unknown
    resolver: RequestResolver<any>
    map: BatchMap
    readonly entrySet: Set<Request.Entry<any>>
    readonly entries: Set<Request.Entry<any>>
    readonly delayEffect: Effect<void>
    readonly run: Effect<void, unknown>
    fiber?: Fiber<void, unknown> | undefined
}

const batchPool: Array<Batch> = [];
const pendingBatches = new WeakMap<RequestResolver<any>, BatchMap>();

const addEntry = <A extends Request.Any>(
    resolver: RequestResolver<A>,
    request: A,
    resume: (exit: Exit<any, any>) => void,
    fiber: {
        readonly context: Context.Context<never>
        readonly cache: { readonly scheduler: Scheduler }
        readonly id?: number
    }
) =>
{
    let batchMap = pendingBatches.get(resolver);
    if (!batchMap)
    {
        batchMap = makeBatchMap(resolver);
        pendingBatches.set(resolver, batchMap);
    }

    let batch: Batch | undefined;
    let completed = false;
    const entry = makeEntry({
        request,
        context: fiber.context as any,
        uninterruptible: false,
        completeUnsafe(effect)
        {
            if (completed) {return;}

            completed = true;
            // Removed entries still notify resolver hooks, but not their cancelled callers.
            if (batch && !batch.entrySet.delete(entry)) {return;}

            resume(effect);
        }
    });
    if (resolver.preCheck !== undefined && !resolver.preCheck(entry))
    {
        return entry;
    }

    const key = resolver.batchKey(entry);
    batch = batchMap.get(key);
    if (!batch)
    {
        if (batchPool.length > 0)
        {
            batch = batchPool.pop()!;
            batch.key = key;
            batch.resolver = resolver;
            batch.map = batchMap;
        }
        else
        {
            const newBatch: Batch = {
                key,
                resolver,
                map: batchMap,
                entrySet: new Set(),
                entries: new Set(),
                delayEffect: effect.flatMap(
                    effect.suspend(() => newBatch.resolver.delay),
                    (_) => runBatch(newBatch)
                ) as Effect<void>,
                run: effect.onExit(
                    effect.suspend(() =>
                        newBatch.resolver.runAll(Array.from(newBatch.entries) as NonEmptyArray<Request.Entry<any>>, newBatch.key)
                    ),
                    (exit) =>
                    {
                        for (const entry of newBatch.entrySet)
                        {
                            entry.completeUnsafe(
                                exit._tag === "Success"
                                    ? exitDie(
                                        new Error("Effect.request: RequestResolver did not complete request", { cause: entry.request })
                                    )
                                    : exit
                            );
                        }

                        newBatch.entries.clear();
                        if (batchPool.length < 128)
                        {
                            newBatch.entrySet.clear();
                            newBatch.key = undefined;
                            newBatch.fiber = undefined;
                            newBatch.resolver = undefined as any;
                            newBatch.map = undefined as any;
                            batchPool.push(newBatch);
                        }

                        return effect.void;
                    }
                )
            };
            batch = newBatch;
        }

        batchMap.set(key, batch);
        batch.fiber = effect.runForkWith(fiber.context)(batch.delayEffect, { scheduler: fiber.cache.scheduler });
    }

    batch.entrySet.add(entry);
    batch.entries.add(entry);
    if (batch.resolver.collectWhile(batch.entries)) {return entry;}

    batch.fiber!.interruptUnsafe(fiber.id);
    batch.fiber = effect.runForkWith(fiber.context)(runBatch(batch), { scheduler: fiber.cache.scheduler });
    return entry;
};

const removeEntryUnsafe = <A extends Request.Any>(
    resolver: RequestResolver<A>,
    entry: Request.Entry<A>
) =>
{
    if (entry.uninterruptible) {return;}

    const batchMap = pendingBatches.get(resolver);
    if (!batchMap) {return;}

    const key = resolver.batchKey(entry);
    const batch = batchMap.get(key);
    if (!batch) {return;}

    if (!batch.entries.delete(entry)) {return;}

    batch.entrySet.delete(entry);

    let fiber: Fiber<void, unknown> | undefined;
    if (batch.entries.size === 0)
    {
        batchMap.delete(key);
        fiber = batch.fiber;
    }

    // Delay finalizers may enqueue new requests, so complete the removed entry first.
    entry.completeUnsafe(effect.exitInterrupt());
    fiber?.interruptUnsafe();
};

const maybeRemoveEntry = <A extends Request.Any>(
    resolver: RequestResolver<A>,
    entry: Request.Entry<A>
) => effect.sync(() => removeEntryUnsafe(resolver, entry));

/**
 * Upstream helper from the pinned Effect implementation.
 *
 * @category Utilities
 * @since 1.0.0
 */
function runBatch(batch: Batch)
{
    if (!batch.map.has(batch.key)) {return effect.void;}

    batch.map.delete(batch.key);
    return batch.run;
}
