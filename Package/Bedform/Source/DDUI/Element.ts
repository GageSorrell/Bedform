/**
 * Pure function-component elements shared by both automatic JSX runtimes.
 *
 * @module bedform/DDUI/Element
 *
 * @file      Element.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Element fields retain semantic order and inferred callbacks. */
/* eslint-disable sort-keys */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

import { StrictMode } from "../Internal/DDUIBuildMode.js";

/**
 * Registry identity for DDUI elements; no native or host initialization is performed.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const ElementTypeId: unique symbol = Symbol.for("~bedform/DDUI/Element");

/**
 * Synchronous component output. Native controls and their renderer are a separate layer.
 *
 * @category Types
 * @since 1.0.0
 */
export type ReactNode = ReactElement | string | number | boolean | null | undefined |
    ReadonlyArray<ReactNode>;

/**
 * A synchronous function receiving its declared props and returning DDUI children.
 *
 * @category Types
 * @since 1.0.0
 */
export type FunctionComponent<Props = object> = (props: Props) => ReactNode;

/**
 * Function-component shorthand.
 *
 * @category Types
 * @since 1.0.0
 */
export type FC<Props = object> = FunctionComponent<Props>;

/**
 * Supported component constructor; class and asynchronous components are excluded.
 *
 * @category Types
 * @since 1.0.0
 */
export type ComponentType<Props = object> = FunctionComponent<Props>;

/**
 * Adds optional nested DDUI children to application properties.
 *
 * @category Types
 * @since 1.0.0
 */
export type PropsWithChildren<Props extends object = object> = Props & { readonly children?: ReactNode };

/**
 * Development location emitted by automatic JSX compilation in strict builds.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SourceLocation
{
    readonly fileName: string;
    readonly lineNumber: number;
    readonly columnNumber: number;
}

/**
 * Immutable element descriptor. The source location is retained only in strict builds.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReactElement<Props = unknown>
{
    readonly [ElementTypeId]: true;
    readonly type: ComponentType<never>;
    readonly props: Readonly<Props>;
    readonly key: string | null;
    readonly source?: SourceLocation;
}

/**
 * Groups children without introducing a native control.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const Fragment = (props: PropsWithChildren): ReactNode =>
{
    return props.children;
};

/**
 * Creates a descriptor without running components. Keys are normalized and excluded from props.
 * Development locations share the same compile-time strict selection as the future renderer.
 *
 * @throws { Error } An unsupported component, class, or asynchronous function is supplied.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const element = (type: ComponentType<never>, props: Readonly<Record<string, unknown>> | null,
    key?: string | number, source?: SourceLocation): ReactElement =>
{
    if (typeof type !== "function" || /^(?:class\b|async\b)/u.test(Function.prototype.toString.call(type)))
    {
        throw new Error("DDUI elements require synchronous function components");
    }

    const { key: PropKey, ...Properties } = props ?? {};
    const Key = key ?? PropKey;
    return Object.freeze({
        [ElementTypeId]: true as const,
        type,
        props: Object.freeze(Properties),
        key: Key === undefined || Key === null ? null : String(Key),
        ...(StrictMode && source ? { source: Object.freeze({ ...source }) } : {})
    });
};

/**
 * Tests the public element identity without importing a renderer or host tooling.
 *
 * @category DDUI
 * @since 1.0.0
 */
export const isValidElement = (value: unknown): value is ReactElement =>
{
    return value !== null && typeof value === "object" && ElementTypeId in value &&
        value[ElementTypeId] === true;
};

/**
 * Public automatic JSX typing for synchronous component composition.
 * Native intrinsic controls will be added with the native adapter layer.
 *
 * @category Types
 * @since 1.0.0
 */

export namespace JSX
{
    /**
     * Valid synchronous JSX component types.
     *
     * @category Types
     * @since 1.0.0
     */
    export type ElementType = ComponentType<never>;

    /**
     * Emitted JSX descriptor.
     *
     * @category Types
     * @since 1.0.0
     */
    export type Element = ReactElement;

    /**
     * Reserved element key, excluded from component props.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface IntrinsicAttributes
    {
        readonly key?: string | number;
    }

    /**
     * Property receiving nested JSX children.
     *
     * @category Types
     * @since 1.0.0
     */
    export interface ElementChildrenAttribute
    {
        readonly children: unknown;
    }
}
