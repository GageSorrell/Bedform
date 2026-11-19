/**
 * Identifiers owned by this package: setting and command names, diagnostic codes and keywords.
 *
 * Setting and command names are relative; each extension prefixes them with its own configuration
 * section or command prefix, such as `bdsIntellisense` or `bedform.serverProperties`.
 *
 * @module bds-intellisense/Keys
 *
 * @file      Keys.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Setting names relative to an extension's configuration section.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Setting = Object.freeze({
    DetectVersion: "detectVersion",
    DiagnosticsEnabled: "diagnostics.enabled",
    FallbackVersion: "fallbackVersion"
} as const);

/**
 * Command names relative to an extension's command prefix.
 *
 * @category Constants
 * @since 1.0.0
 */
export const Command = Object.freeze({
    RedetectVersion: "redetectVersion",
    SelectSchemaVersion: "selectSchemaVersion"
} as const);

/**
 * Codes attached to diagnostics, so that quick fixes and users can tell problems apart.
 *
 * @category Constants
 * @since 1.0.0
 */
export const DiagnosticCode = Object.freeze({
    DuplicateProperty: "duplicate-property",
    EmptyKey: "empty-key",
    EmptyValue: "empty-value",
    ForbiddenCharacter: "forbidden-character",
    InvalidLine: "invalid-line",
    InvalidValue: "invalid-value",
    UnknownProperty: "unknown-property",
    UnsupportedProperty: "unsupported-property"
} as const);

/**
 * Any value of {@link DiagnosticCode}.
 *
 * @category Types
 * @since 1.0.0
 */
export type DiagnosticCode = typeof DiagnosticCode[keyof typeof DiagnosticCode];

/**
 * The name diagnostics report as their source.
 *
 * @category Constants
 * @since 1.0.0
 */
export const DiagnosticSource = "bds-intellisense" as const;

/**
 * The fallback-version setting value that selects the newest bundled schema.
 *
 * @category Constants
 * @since 1.0.0
 */
export const LatestKeyword = "latest" as const;
