/**
 * Private UTF-8 codecs with Web-compatible replacement and BOM behavior.
 *
 * @module @bedform/effect/Internal/utf8
 *
 * @file      utf8.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Preserve upstream loop formatting and overload signatures. */

/* Check exported variable documentation at the export, preserving upstream contextual inference. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve multiple statements in the upstream traversal loops. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Preserve upstream generic signatures, contextual inference, property order and argument forwarding. */

/**
 * Encodes UTF-16 text, replacing unpaired surrogates with U+FFFD.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const encodeUtf8 = (input: string): Uint8Array =>
{
    const Bytes: Array<number> = [];
    for (let index = 0; index < input.length; index++)
    {
        let point = input.charCodeAt(index);
        if (point >= 0xD8_00 && point <= 0xDB_FF)
        {
            const Next = input.charCodeAt(index + 1);
            if (Next >= 0xDC_00 && Next <= 0xDF_FF)
            {
                point = 0x1_00_00 + ((point - 0xD8_00) << 10) + Next - 0xDC_00;
                index++;
            }
            else {point = 0xFF_FD;}
        }
        else if (point >= 0xDC_00 && point <= 0xDF_FF) {point = 0xFF_FD;}

        if (point < 0x80) {Bytes.push(point);}
        else if (point < 0x8_00) {Bytes.push(0xC0 | (point >> 6), 0x80 | (point & 0x3F));}
        else if (point < 0x1_00_00)
        {
            Bytes.push(0xE0 | (point >> 12), 0x80 | ((point >> 6) & 0x3F), 0x80 | (point & 0x3F));
        }
        else
        {
            Bytes.push(0xF0 | (point >> 18), 0x80 | ((point >> 12) & 0x3F),
                0x80 | ((point >> 6) & 0x3F), 0x80 | (point & 0x3F));
        }
    }

    return new Uint8Array(Bytes);
};

/**
 * Decodes bytes with maximal-subpart replacement and strips one initial BOM.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const decodeUtf8 = (input: Uint8Array): string =>
{
    let output = "";
    let index = 0;
    let first = true;
    while (index < input.length)
    {
        const Lead = input[index++];
        let point = Lead;
        let count = 0;
        let lower = 0x80;
        let upper = 0xBF;
        if (Lead >= 0xC2 && Lead <= 0xDF) { count = 1; point = Lead & 0x1F; }
        else if (Lead >= 0xE0 && Lead <= 0xEF)
        {
            count = 2;
            point = Lead & 0x0F;
            if (Lead === 0xE0) {lower = 0xA0;}

            if (Lead === 0xED) {upper = 0x9F;}
        }
        else if (Lead >= 0xF0 && Lead <= 0xF4)
        {
            count = 3;
            point = Lead & 0x07;
            if (Lead === 0xF0) {lower = 0x90;}

            if (Lead === 0xF4) {upper = 0x8F;}
        }
        else if (Lead >= 0x80) {point = 0xFF_FD;}

        for (let remaining = count; remaining > 0; remaining--)
        {
            const Byte = input[index];
            if (index === input.length || Byte < lower || Byte > upper)
            {
                point = 0xFF_FD;
                break;
            }

            index++;
            point = (point << 6) | (Byte & 0x3F);
            lower = 0x80;
            upper = 0xBF;
        }

        if (!first || point !== 0xFE_FF) {output += String.fromCodePoint(point);}

        first = false;
    }

    return output;
};
