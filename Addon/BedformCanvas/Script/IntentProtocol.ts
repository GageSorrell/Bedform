/**
 * Independently validates bounded Canvas command envelopes and normalized mutation payloads.
 *
 * @module bedform-canvas/Script/IntentProtocol
 *
 * @file      IntentProtocol.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { CheckDefinition, CheckMessage, CheckOptions, IsIdentifier, RecordValue }
    from "bedform/Canvas/IntentValidation";
import type { Command, Envelope } from "bedform/Canvas/IntentProtocol";

/**
 * Validated correlation fields, retained even when a supported operation's payload is rejected.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Header extends Envelope
{
    readonly Operation: Command["Operation"];
}

/**
 * Validates a bounded nonempty wire token or native entity identifier.
 *
 * @throws { TypeError } If the token is missing, overlong or contains control characters.
 *
 * @category Validation
 * @since 1.0.0
 */
export function Token(value: unknown): string
{
    if (typeof value !== "string" || value.length === 0 || value.length > 128 ||
        [ ...value ].some((character: string) => character.charCodeAt(0) < 0x20))
    {
        throw new TypeError("Canvas Intent requires bounded nonempty identifiers without control " +
            "characters.");
    }

    return value;
}

/**
 * Reads only a bounded JSON record; malformed traffic cannot acquire ownership or mutate state.
 *
 * @throws { Error } If the JSON or its size is invalid.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function Read(message: string): Record<string, unknown>
{
    CheckMessage(message);
    return RecordValue(JSON.parse(message));
}

/**
 * Validates correlation independently of body parsing, allowing actionable correlated rejections.
 *
 * @throws { TypeError } If the envelope cannot be safely acknowledged.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function Correlation(input: Record<string, unknown>): Header
{
    if (!IsIdentifier(input.ClientId) || typeof input.RequestId !== "number" ||
        !Number.isSafeInteger(input.RequestId) || input.RequestId <= 0 ||
        typeof input.Version !== "number" || !Number.isSafeInteger(input.Version) || input.Version <= 0 ||
        ![ "hello", "set", "clear", "dispose" ].includes(input.Operation as string))
    {
        throw new TypeError("Canvas Intent envelope is malformed.");
    }

    return { ClientId: input.ClientId,
        ConnectionId: Token(input.ConnectionId),
        Operation: input.Operation as Command["Operation"],
        RequestId: input.RequestId,
        Version: input.Version };
}

/**
 * Normalizes every body field before world access or state mutation, reusing the client value rules.
 * Wire options must be complete, including an explicit null for indefinite duration.
 *
 * @throws { TypeError } If a command body is invalid.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function Decode(header: Header, input: Record<string, unknown>): Command
{
    if (header.Operation === "hello")
    {
        return { ...header,
            Operation: "hello" };
    }

    if (header.Operation === "dispose")
    {
        return { ...header,
            Operation: "dispose",
            ...input.RuntimeId === undefined ? {} : { RuntimeId: Token(input.RuntimeId) } };
    }

    const runtime = Token(input.RuntimeId);
    const entity = Token(input.EntityId);
    if (header.Operation === "clear")
    {
        return { ...header,
            EntityId: entity,
            Operation: "clear",
            RuntimeId: runtime };
    }

    const options = RecordValue(input.Options);
    for (const field of [ "DurationTicks", "MaxDistance", "Offset", "Scale" ])
    {
        if (!Object.hasOwn(options, field) || options[field] === undefined)
        {
            throw new TypeError(`Canvas Intent wire options require ${field}.`);
        }
    }

    return { ...header,
        EntityId: entity,
        Intent: CheckDefinition(input.Intent),
        Operation: "set",
        Options: CheckOptions({ DurationTicks: options.DurationTicks === null
            ? undefined : options.DurationTicks as number,
        MaxDistance: options.MaxDistance as number,
        Offset: options.Offset as never,
        Scale: options.Scale as number }),
        RuntimeId: runtime };
}
