/**
 * The shape of a `server.properties` schema: the properties one BDS release ships and their values.
 *
 * @module bds-intellisense/Schema/Types
 *
 * @file      Types.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { BdsVersion } from "../Version.js";

/**
 * Accepts exactly `true` or `false`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface BooleanType
{
    readonly Kind: "Boolean";
}

/**
 * Accepts a number within optional inclusive bounds, or one of a few keywords such as `Disabled`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface NumberType
{
    /** Whether fractional values are rejected. */
    readonly Integer: boolean;
    /** Words accepted in place of a number. */
    readonly Keywords?: ReadonlyArray<string>;
    readonly Kind: "Number";
    readonly Maximum?: number;
    readonly Minimum?: number;
}

/**
 * Accepts one word from a fixed list, compared case-sensitively.
 *
 * @category Types
 * @since 1.0.0
 */
export interface EnumType
{
    readonly Kind: "Enum";
    readonly Values: ReadonlyArray<string>;
}

/**
 * Accepts free text, optionally excluding some characters or requiring a regular expression.
 *
 * @category Types
 * @since 1.0.0
 */
export interface StringType
{
    /** Characters that must not appear, such as `;` in `server-name`. */
    readonly Forbidden?: string;
    readonly Kind: "String";
    /** Source of a regular expression that the whole value must match. */
    readonly Pattern?: string;
    /** A phrase describing {@link StringType.Pattern} for messages, such as "an IPv4 or IPv6 literal". */
    readonly PatternDescription?: string;
}

/**
 * The values a property accepts.
 *
 * @category Types
 * @since 1.0.0
 */
export type PropertyType = BooleanType | EnumType | NumberType | StringType;

/**
 * One property as documented by a BDS release's default `server.properties`.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PropertySchema
{
    /** The text of the `Allowed values` comment line, kept for display. */
    readonly AllowedValues?: string;
    /** The value in the default file; absent when the property ships disabled without a value. */
    readonly Default?: string;
    /** The explanatory comment lines, joined with newlines. */
    readonly Description: string;
    readonly Key: string;
    /** Whether the default file ships the property commented out, so leaving it unset is normal. */
    readonly Optional: boolean;
    /** Whether the property may appear on several lines that accumulate, like `server-udp-ports`. */
    readonly Repeatable: boolean;
    readonly Type: PropertyType;
}

/**
 * The properties of one or more consecutive BDS releases whose default files agree.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ServerPropertiesSchema
{
    /** Properties in the order of the default file. */
    readonly Properties: ReadonlyArray<PropertySchema>;
    /** The first release that shipped this schema. */
    readonly Version: BdsVersion;
}
