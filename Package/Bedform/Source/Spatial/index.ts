/**
 * Explicitly started spatial presentation clients without import-time native services.
 *
 * @module bedform/Spatial/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Cooperative entity Intent definitions and the explicitly started Canvas request client.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Intent from "./Intent.js";

/**
 * Pure text metrics, font presence and line layout helpers.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as Measurement from "./Measurement.js";

/**
 * Shared React client APIs, hooks and component types.
 *
 * @category Exports
 * @since 1.0.0
 */
export * as React from "./React/index.js";

/**
 * Explicit spatial runtime startup with injected native services.
 *
 * @category Constructor
 * @since 1.0.0
 */
export { Start } from "./Renderer.js";

/**
 * Managed React roots and surface backend contracts.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export * as Renderer from "./Renderer.js";

/**
 * Typed spatial component and theme foundations.
 *
 * @category Constructor
 * @since 1.0.0
 */
export * as Components from "./Components.js";

/**
 * Shared committed geometry and local/world coordinate conversion.
 *
 * @category Transforming
 * @since 1.0.0
 */
export * as Layout from "./Layout.js";
