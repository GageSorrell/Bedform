/**
 * Helpers for escaping JSON Pointer path segments and converting JSON Pointer
 * URI fragments. JSON Pointer uses `/` to separate path tokens inside a JSON
 * document, so token text must encode literal `~` and `/` characters. URI
 * fragments additionally apply percent-encoding after JSON Pointer escaping.
 *
 * Synchronous Schema support adapted from Effect 4.0.5.
 *
 * @module @bedform/effect/JsonPointer
 *
 * @file      JsonPointer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve sequential traversal and compact upstream guard branches. */

/* Preserve upstream generic inference, argument forwarding, overloads and property order. */
/* eslint-disable @typescript-eslint/typedef, @stylistic/max-len */
/* Check exported declarations at their export nodes, preserving contextual callback inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration", "ExportNamedDeclaration > TSInterfaceDeclaration", "ExportNamedDeclaration > FunctionDeclaration", "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/**
 * Escapes a JSON Pointer reference token according to RFC 6901 by encoding special characters so the token can be safely used as a segment in a JSON Pointer.
 *
 * @category encoding
 * @since 1.0.0
 */
export function escapeToken(token: string): string
{
    return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Decodes a JSON Pointer reference token according to RFC 6901 escaping rules.
 *
 * @category decoding
 * @since 1.0.0
 */
export function unescapeToken(token: string): string
{
    return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/**
 * Supports format uri fragment token during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function formatUriFragmentToken(token: string): string
{
    return encodeURI(escapeToken(token)).replace(/#/g, "%23");
}

/**
 * Supports decode uri fragment during synchronous schema processing.
 *
 *  @internal
 *
 * @category Utilities
 * @since 1.0.0
 */
export function decodeUriFragment(fragment: string): string | undefined
{
    if (fragment.length === 0 || fragment === "#")
    {return "";}

    if (!fragment.startsWith("#"))
    {return undefined;}

    const encoded = fragment.slice(1);
    try
    {
        if (encodeURI(encoded).replace(/%25/g, "%").replace(/#/g, "%23") !== encoded)
        {return undefined;}

        const pointer = decodeURIComponent(encoded);
        return pointer.startsWith("/") && !/~(?:[^01]|$)/.test(pointer) ? pointer : undefined;
    }
    catch
    {
        return undefined;
    }
}

/**
 * Parses a JSON Pointer URI fragment into decoded path tokens.
 *
 * @category decoding
 * @since 1.0.0
 */
export function parseUriFragment(fragment: string): ReadonlyArray<string> | undefined
{
    const pointer = decodeUriFragment(fragment);
    return pointer === undefined ? undefined : pointer.length === 0 ? [] : pointer.slice(1).split("/").map(unescapeToken);
}

/**
 * Formats path tokens as a JSON Pointer URI fragment.
 *
 * @category encoding
 * @since 1.0.0
 */
export function formatUriFragment(path: ReadonlyArray<string>): string
{
    return path.reduce((fragment, token) => `${fragment}/${formatUriFragmentToken(token)}`, "#");
}
