/**
 * Base64 encoding and decoding helpers.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Encoding/Base64
 *
 * @file      Base64.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */
/* eslint-disable @stylistic/max-statements-per-line */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys, @stylistic/max-len */

import { encodeUtf8, decodeUtf8 } from "../Internal/utf8.js";

import * as Result from "../Result.js";
import { EncodingError } from "./EncodingError.js";

/**
 * Encodes the given value into a Base64 (RFC 4648) string.
 *
 * **When to use**
 *
 * Use to encode text or bytes as a standard padded Base64 string for storage or
 * transport.
 *
 * **Details**
 *
 * String inputs are encoded as UTF-8 bytes before Base64 encoding.
 * `Uint8Array` inputs are encoded directly. The output uses the standard
 * RFC 4648 alphabet with `=` padding.
 *
 * **Example** (Encoding Base64 strings and bytes)
 *
 * ```ts import.meta.vitest
 * import { Base64 } from "effect/encoding"
 *
 * Base64.encode("hello") // => "aGVsbG8="
 *
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * Base64.encode(bytes) // => "SGVsbG8="
 * ```
 *
 * @see {@link decode} for decoding standard Base64 to bytes
 * @see {@link decodeString} for decoding standard Base64 to UTF-8 text
 *
 * @category Utilities
 * @since 1.0.0
 */
export const encode: (input: Uint8Array | string) => string = (input) =>
    EncodeBytes(typeof input === "string" ? encodeUtf8(input) : input);

/**
 * Decodes a Base64 (RFC 4648) string into bytes safely.
 *
 * **When to use**
 *
 * Use to decode a standard padded Base64 string into bytes without throwing on
 * invalid input.
 *
 * **Details**
 *
 * Returns `Result.succeed` with a `Uint8Array` when decoding succeeds, or
 * `Result.fail` with an `EncodingError` when the input is not valid Base64.
 *
 * **Example** (Decoding Base64 bytes)
 *
 * ```ts import.meta.vitest
 * import { Result } from "effect"
 * import { Base64 } from "effect/encoding"
 *
 * Base64.decode("SGVsbG8=") // => Result.succeed(new Uint8Array([72, 101, 108, 108, 111]))
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const decode = (str: string): Result.Result<Uint8Array, EncodingError> =>
{
    const Stripped = StripCrlf(str);
    const LengthValue = Stripped.length;
    if (LengthValue % 4 !== 0)
    {
        return Result.fail(
            new EncodingError({
                kind: "Decode",
                module: "Base64",
                input: Stripped,
                message: `Length must be a multiple of 4, but is ${LengthValue}`
            })
        );
    }

    const Index = Stripped.indexOf("=");
    if (Index !== -1 && ((Index < LengthValue - 2) || (Index === LengthValue - 2 && Stripped[LengthValue - 1] !== "=")))
    {
        return Result.fail(
            new EncodingError({
                kind: "Decode",
                module: "Base64",
                input: Stripped,
                message: "Found a '=' character, but it is not at the end"
            })
        );
    }

    try
    {
        const MissingOctets = Stripped.endsWith("==") ? 2 : Stripped.endsWith("=") ? 1 : 0;
        const ResultValue = new Uint8Array(3 * (LengthValue / 4) - MissingOctets);
        for (let i = 0, j = 0; i < LengthValue; i += 4, j += 3)
        {
            const Buffer = GetCode(Stripped.charCodeAt(i)) << 18 |
        GetCode(Stripped.charCodeAt(i + 1)) << 12 |
        GetCode(Stripped.charCodeAt(i + 2)) << 6 |
        GetCode(Stripped.charCodeAt(i + 3));
            ResultValue[j] = Buffer >> 16;
            ResultValue[j + 1] = (Buffer >> 8) & 0xff;
            ResultValue[j + 2] = Buffer & 0xff;
        }

        return Result.succeed(ResultValue);
    }
    catch (cause)
    {
        return Result.fail(
            new EncodingError({
                kind: "Decode",
                module: "Base64",
                input: Stripped,
                message: cause instanceof Error ? cause.message : "Invalid input"
            })
        );
    }
};

/**
 * Decodes a Base64 (RFC 4648) string into UTF-8 text safely.
 *
 * **When to use**
 *
 * Use to decode a standard padded Base64 string into UTF-8 text without
 * throwing on invalid input.
 *
 * **Details**
 *
 * Returns `Result.succeed` with the decoded text when decoding succeeds, or
 * `Result.fail` with an `EncodingError` when the input is not valid Base64.
 *
 * **Example** (Decoding Base64 strings)
 *
 * ```ts import.meta.vitest
 * import { Result } from "effect"
 * import { Base64 } from "effect/encoding"
 *
 * Base64.decodeString("aGVsbG8=") // => Result.succeed("hello")
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const decodeString = (str: string) => Result.map(decode(str), (_) => decodeUtf8(_));

const EncodeBytes = (bytes: Uint8Array): string =>
{
    const LengthValueValue = bytes.length;
    let result = "";
    let i: number;
    for (i = 2; i < LengthValueValue; i += 3)
    {
        result += Alphabet[bytes[i - 2] >> 2];
        result += Alphabet[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += Alphabet[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
        result += Alphabet[bytes[i] & 0x3f];
    }

    if (i === LengthValueValue + 1)
    {
        result += Alphabet[bytes[i - 2] >> 2];
        result += Alphabet[(bytes[i - 2] & 0x03) << 4];
        result += "==";
    }

    if (i === LengthValueValue)
    {
        result += Alphabet[bytes[i - 2] >> 2];
        result += Alphabet[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += Alphabet[(bytes[i - 1] & 0x0f) << 2];
        result += "=";
    }

    return result;
};

const StripCrlf = (str: string) => str.replace(/[\n\r]/g, "");
const Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const Codes = new Uint8Array(123).fill(255);
for (let i = 0; i < Alphabet.length; i++) {Codes[Alphabet.charCodeAt(i)] = i;}

Codes["=".charCodeAt(0)] = 0;

const GetCode = (charCode: number): number =>
{
    if (charCode >= Codes.length || Codes[charCode] === 255)
    {
        throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
    }

    return Codes[charCode];
};

/* Preserve multiple statements in upstream traversal loops. */

