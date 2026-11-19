/**
 * Hexadecimal encoding, decoding, and random value helpers.
 *
 * Pure Schema dependency ported from Effect 4.0.5.
 *
 * @module @bedform/effect/Encoding/Hex
 *
 * @file      Hex.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Upstream copyright (c) 2023 Effectful Technologies Inc. */

/* Preserve upstream loop formatting and overload signatures. */

/* Check exported variable documentation at the export node. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */
/* Preserve upstream generics, contextual inference, property order and argument forwarding. */
/* eslint-disable @typescript-eslint/typedef */
/* eslint-disable sort-imports, sort-keys */

import { encodeUtf8, decodeUtf8 } from "../Internal/utf8.js";

import * as Result from "../Result.js";
import { EncodingError } from "./EncodingError.js";

/**
 * Encodes the given value into a hex `string`.
 *
 * **When to use**
 *
 * Use to encode text or bytes as lowercase hexadecimal text.
 *
 * **Example** (Encoding hex strings and bytes)
 *
 * ```ts import.meta.vitest
 * import { Hex } from "effect/encoding"
 *
 * // Encode a string to hex
 * Hex.encode("hello") // => "68656c6c6f"
 *
 * // Encode binary data to hex
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * Hex.encode(bytes) // => "48656c6c6f"
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const encode: (input: Uint8Array | string) => string = (input) =>
    typeof input === "string" ? HexEncodeUint8Array(encodeUtf8(input)) : HexEncodeUint8Array(input);

/**
 * Generates a random lowercase hexadecimal string, optimized for lengths that
 * are multiples of 8.
 *
 * **Details**
 *
 * `length` is not validated. The function generates `length >>> 3` random
 * 8-character words, so non-negative lengths below `2 ** 32` are rounded down
 * to a multiple of 8 and other values follow JavaScript's unsigned 32-bit
 * coercion rules.
 *
 * This function uses `Math.random()` and is not cryptographically secure. For
 * security-sensitive values, use the `Crypto.Crypto` service's `randomBytes`
 * method and encode the result with {@link encode}.
 *
 * @category Utilities
 * @since 1.0.0
 */
export const random = (length: number): string =>
{
    switch (length)
    {
        case 16:
            return Random16();
        case 32:
            return Random32();
        default: {
            let result = "";
            for (let i = length >>> 3; i > 0; i--)
            {
                result += Random8();
            }

            return result;
        }
    }
};

const HexCharCodes = Uint8Array.from("0123456789abcdef", (c) => c.charCodeAt(0));

const RandomWord = (): number => (Math.random() * 0x1_00_00_00_00) >>> 0;

// Trace and span identifiers are the common lengths. A single
// String.fromCharCode call produces a flat string, which avoids rope
// flattening when the identifier is later serialized.
const Random8 = (): string =>
{
    const AValue = RandomWord();
    return String.fromCharCode(
        HexCharCodes[AValue >>> 28],
        HexCharCodes[(AValue >>> 24) & 15],
        HexCharCodes[(AValue >>> 20) & 15],
        HexCharCodes[(AValue >>> 16) & 15],
        HexCharCodes[(AValue >>> 12) & 15],
        HexCharCodes[(AValue >>> 8) & 15],
        HexCharCodes[(AValue >>> 4) & 15],
        HexCharCodes[AValue & 15]
    );
};

const Random16 = (): string =>
{
    const AValueValue = RandomWord();
    const B = RandomWord();
    return String.fromCharCode(
        HexCharCodes[AValueValue >>> 28],
        HexCharCodes[(AValueValue >>> 24) & 15],
        HexCharCodes[(AValueValue >>> 20) & 15],
        HexCharCodes[(AValueValue >>> 16) & 15],
        HexCharCodes[(AValueValue >>> 12) & 15],
        HexCharCodes[(AValueValue >>> 8) & 15],
        HexCharCodes[(AValueValue >>> 4) & 15],
        HexCharCodes[AValueValue & 15],
        HexCharCodes[B >>> 28],
        HexCharCodes[(B >>> 24) & 15],
        HexCharCodes[(B >>> 20) & 15],
        HexCharCodes[(B >>> 16) & 15],
        HexCharCodes[(B >>> 12) & 15],
        HexCharCodes[(B >>> 8) & 15],
        HexCharCodes[(B >>> 4) & 15],
        HexCharCodes[B & 15]
    );
};

const Random32 = (): string =>
{
    const AValueValueValue = RandomWord();
    const BValue = RandomWord();
    const C = RandomWord();
    const D = RandomWord();
    return String.fromCharCode(
        HexCharCodes[AValueValueValue >>> 28],
        HexCharCodes[(AValueValueValue >>> 24) & 15],
        HexCharCodes[(AValueValueValue >>> 20) & 15],
        HexCharCodes[(AValueValueValue >>> 16) & 15],
        HexCharCodes[(AValueValueValue >>> 12) & 15],
        HexCharCodes[(AValueValueValue >>> 8) & 15],
        HexCharCodes[(AValueValueValue >>> 4) & 15],
        HexCharCodes[AValueValueValue & 15],
        HexCharCodes[BValue >>> 28],
        HexCharCodes[(BValue >>> 24) & 15],
        HexCharCodes[(BValue >>> 20) & 15],
        HexCharCodes[(BValue >>> 16) & 15],
        HexCharCodes[(BValue >>> 12) & 15],
        HexCharCodes[(BValue >>> 8) & 15],
        HexCharCodes[(BValue >>> 4) & 15],
        HexCharCodes[BValue & 15],
        HexCharCodes[C >>> 28],
        HexCharCodes[(C >>> 24) & 15],
        HexCharCodes[(C >>> 20) & 15],
        HexCharCodes[(C >>> 16) & 15],
        HexCharCodes[(C >>> 12) & 15],
        HexCharCodes[(C >>> 8) & 15],
        HexCharCodes[(C >>> 4) & 15],
        HexCharCodes[C & 15],
        HexCharCodes[D >>> 28],
        HexCharCodes[(D >>> 24) & 15],
        HexCharCodes[(D >>> 20) & 15],
        HexCharCodes[(D >>> 16) & 15],
        HexCharCodes[(D >>> 12) & 15],
        HexCharCodes[(D >>> 8) & 15],
        HexCharCodes[(D >>> 4) & 15],
        HexCharCodes[D & 15]
    );
};

/**
 * Decodes a hexadecimal string into bytes safely.
 *
 * **When to use**
 *
 * Use to decode hexadecimal text into bytes without throwing on invalid input.
 *
 * **Details**
 *
 * Returns `Result.succeed` with a `Uint8Array` when decoding succeeds, or
 * `Result.fail` with an `EncodingError` when the input has an odd length or
 * contains invalid hex characters.
 *
 * **Example** (Decoding hex bytes)
 *
 * ```ts import.meta.vitest
 * import { Result } from "effect"
 * import { Hex } from "effect/encoding"
 *
 * Hex.decode("48656c6c6f") // => Result.succeed(new Uint8Array([72, 101, 108, 108, 111]))
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const decode = (str: string): Result.Result<Uint8Array, EncodingError> =>
{
    const Bytes = encodeUtf8(str);
    if (Bytes.length % 2 !== 0)
    {
        return Result.fail(
            new EncodingError({
                module: "Hex",
                kind: "Decode",
                input: str,
                message: `Length must be a multiple of 2, but is ${Bytes.length}`
            })
        );
    }

    try
    {
        const LengthValue = Bytes.length / 2;
        const ResultValue = new Uint8Array(LengthValue);
        for (let i = 0; i < LengthValue; i++)
        {
            const AValueValueValueValue = FromHexChar(Bytes[i * 2]);
            const BValueValue = FromHexChar(Bytes[i * 2 + 1]);
            ResultValue[i] = (AValueValueValueValue << 4) | BValueValue;
        }

        return Result.succeed(ResultValue);
    }
    catch (e)
    {
        return Result.fail(
            new EncodingError({
                module: "Hex",
                kind: "Decode",
                input: str,
                message: e instanceof Error ? e.message : "Invalid input"
            })
        );
    }
};

/**
 * Decodes a hexadecimal string into a UTF-8 string safely.
 *
 * **When to use**
 *
 * Use to decode hexadecimal text into UTF-8 text without throwing on invalid
 * input.
 *
 * **Details**
 *
 * Returns `Result.succeed` with the decoded text when decoding succeeds, or
 * `Result.fail` with an `EncodingError` when the input is not valid hex.
 *
 * **Example** (Decoding hex strings)
 *
 * ```ts import.meta.vitest
 * import { Result } from "effect"
 * import { Hex } from "effect/encoding"
 *
 * Hex.decodeString("68656c6c6f") // => Result.succeed("hello")
 * ```
 *
 * @category Utilities
 * @since 1.0.0
 */
export const decodeString = (str: string) => Result.map(decode(str), (_) => decodeUtf8(_));

const ByteToHex: Array<string> = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));

const HexEncodeUint8Array = (bytes: Uint8Array): string =>
{
    let result = "";
    for (let i = 0; i < bytes.length; i++)
    {
        result += ByteToHex[bytes[i]];
    }

    return result;
};

const FromHexChar = (byte: number) =>
{
    if (48 <= byte && byte <= 57)
    {
        return byte - 48;
    }

    if (97 <= byte && byte <= 102)
    {
        return byte - 97 + 10;
    }

    if (65 <= byte && byte <= 70)
    {
        return byte - 65 + 10;
    }

    throw new TypeError("Invalid input");
};
