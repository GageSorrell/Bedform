/**
 * Pure DDUI element and JSX foundations. Native rendering and hooks are separate milestones.
 *
 * @module bedform/DDUI/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export { ElementTypeId, Fragment, isValidElement } from "./Element.js";
export type { ComponentType, FC, FunctionComponent, JSX, PropsWithChildren,
    ReactElement, ReactNode, SourceLocation } from "./Element.js";
export { StrictMode } from "../Internal/DDUIBuildMode.js";
