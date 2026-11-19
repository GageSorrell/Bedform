/**
 * Shares the diagnostic React client singleton between the public API and both JSX runtimes.
 *
 * @module bedform/Spatial/Internal/React/Core
 *
 * @file      Core.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as React from "react";
import { Module } from "./Vendor/React.development.generated.js";

/**
 * Pinned React client exports. Renderer internals must use this same singleton.
 *
 * @category Instance
 * @since 1.0.0
 */
export const Core = Module as unknown as typeof React;
