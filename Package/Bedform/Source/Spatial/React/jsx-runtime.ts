/**
 * Automatic JSX element construction using the shared diagnostic React client.
 *
 * @module bedform/Spatial/React/jsx-runtime
 *
 * @file      jsx-runtime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as RuntimeTypes from "react/jsx-runtime";
import { Module } from "../Internal/React/Vendor/JsxRuntime.development.generated.js";

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
export const jsx: typeof RuntimeTypes.jsx = Module.jsx as typeof RuntimeTypes.jsx;

/**
 * Creates an element through the upstream automatic JSX runtime.
 *
 * @category Constructor
 * @since 1.0.0
 */
export const jsxs: typeof RuntimeTypes.jsxs = Module.jsxs as typeof RuntimeTypes.jsxs;

