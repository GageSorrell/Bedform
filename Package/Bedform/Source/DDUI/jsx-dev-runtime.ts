/**
 * Pure automatic JSX development runtime sharing the effective strict selection.
 *
 * @module bedform/DDUI/jsx-dev-runtime
 *
 * @file      jsx-dev-runtime.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { type ComponentType, type ReactElement, type SourceLocation, element } from "./Element.js";

export { Fragment } from "./Element.js";
export type { JSX } from "./Element.js";

/**
 * Creates a development descriptor. Static-child and receiver arguments follow the JSX ABI.
 * Locations are discarded when the shared compile-time strict mode is false.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const jsxDEV = (type: ComponentType<never>, props: Readonly<Record<string, unknown>> | null,
    key?: string | number, staticChildren?: boolean, source?: SourceLocation, self?: unknown): ReactElement =>
{
    void staticChildren;
    void self;
    return element(type, props, key, source);
};
