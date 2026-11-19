/**
 * `Effect.provide` for layers: builds the given layers for an effect,
 * optionally in a local memo map, and provides their services. Ported from
 * Effect 4.0.5.
 *
 * @module @bedform/effect/Internal/layer
 *
 * @file      layer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import * as Context from "../Context.js";
import type { Effect } from "../Effect.js";
import { dual } from "../Function.js";
import * as Layer from "../Layer.js";
import { isEffect } from "./core.js";
import * as effect from "./effect.js";

const provideLayer = <A, E, R, ROut, E2, RIn>(
    self: Effect<A, E, R>,
    layer: Layer.Layer<ROut, E2, RIn>,
    options?: {
        readonly local?: boolean | undefined
    } | undefined
): Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    effect.scopedWith((scope) =>
        effect.flatMap(
            options?.local
                ? Layer.buildWithMemoMap(layer, Layer.makeMemoMapUnsafe(), scope)
                : Layer.buildWithScope(layer, scope),
            (context) => effect.provideContext(self, context)
        )
    );

/**
 * Runtime helper from the pinned Effect implementation.
 *
 * @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export const provide = dual<
    {
        <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
            layers: Layers,
            options?: {
                readonly local?: boolean | undefined
            } | undefined
        ): <A, E, R>(
            self: Effect<A, E, R>
        ) => Effect<
            A,
      E | Layer.Error<Layers[number]>,
      | Layer.Services<Layers[number]>
      | Exclude<R, Layer.Success<Layers[number]>>
        >
        <ROut, E2, RIn>(
            layer: Layer.Layer<ROut, E2, RIn>,
            options?: {
                readonly local?: boolean | undefined
            } | undefined
        ): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E | E2, RIn | Exclude<R, ROut>>
        <R2>(context: Context.Context<R2>): <A, E, R>(self: Effect<A, E, R>) => Effect<A, E, Exclude<R, R2>>
    },
    {
        <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
            self: Effect<A, E, R>,
            layers: Layers,
            options?: {
                readonly local?: boolean | undefined
            } | undefined
        ): Effect<
            A,
      E | Layer.Error<Layers[number]>,
      | Layer.Services<Layers[number]>
      | Exclude<R, Layer.Success<Layers[number]>>
        >
        <A, E, R, ROut, E2, RIn>(
            self: Effect<A, E, R>,
            layer: Layer.Layer<ROut, E2, RIn>,
            options?: {
                readonly local?: boolean | undefined
            } | undefined
        ): Effect<A, E | E2, RIn | Exclude<R, ROut>>
        <A, E, R, R2>(
            self: Effect<A, E, R>,
            context: Context.Context<R2>
        ): Effect<A, E, Exclude<R, R2>>
    }
>(
    (args) => isEffect(args[0]),
    <A, E, R, ROut>(
        self: Effect<A, E, R>,
        source:
      | Layer.Layer<ROut, any, any>
      | Context.Context<ROut>
      | Array<Layer.Any>,
        options?: {
            readonly local?: boolean | undefined
        } | undefined
    ): Effect<any, any, Exclude<R, ROut>> =>
        Context.isContext(source)
            ? effect.provideContext(self, source)
            : provideLayer(self, Array.isArray(source) ? Layer.mergeAll(...source as any) : source, options)
);
