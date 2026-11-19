/**
 * Automatic JSX element construction using the shared diagnostic React client.
 *
 * @module bedform/Spatial/React/jsx-dev-runtime
 *
 * @file      jsx-dev-runtime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as RuntimeTypes from "react/jsx-dev-runtime";
import { Module } from "../Internal/React/Vendor/JsxDevRuntime.development.generated.js";

/**
 * Upstream JSX checking contract; host intrinsic elements depend on the chosen renderer.
 *
 * @category Model
 * @since 1.0.0
 */
export type { JSX } from "react";

/**
 * Groups children without a host instance.
 *
 * @category Combinator
 * @since 1.0.0
 */
export const Fragment: typeof RuntimeTypes.Fragment = Module.Fragment as typeof RuntimeTypes.Fragment;

/**
 * Creates an element through the upstream automatic JSX runtime.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const jsxDEV: typeof RuntimeTypes.jsxDEV = Module.jsxDEV as typeof RuntimeTypes.jsxDEV;

