/**
 * Versioned cooperative Canvas Intent commands, acknowledgements and shared script-event keys.
 *
 * @module bedform/Canvas/Public/Intent
 *
 * @file      Intent.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Definition, ResolvedOptions } from "../../Spatial/Intent.js";

/**
 * Canvas-owned public script events. Native server-origin messages are cooperative pack transport,
 * not an authentication boundary between installed add-ons or server operators.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ScriptEvent = Object.freeze({
    Acknowledgement: "bedform_canvas:intent_ack",
    Command: "bedform_canvas:intent_command"
} as const);

/**
 * Wire format version; runtimes must correlate and reject unsupported versions explicitly.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Version = 1 as const;

/**
 * Tick limits bound handshake retries and acknowledgement waits, including absent Canvas packs.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const Timing = Object.freeze({ RetryTicks: 5,
    TimeoutTicks: 100 } as const);

/**
 * Maximum UTF-8 JSON payload size accepted by this protocol, independent of native limits.
 *
 * @category Constant
 * @since 1.0.0
 */
export const MaxMessageBytes = 2_048 as const;

/**
 * Correlation and ordering envelope. ClientId names the add-on; ConnectionId is a fresh session
 * token. RequestId increases within that connection and fences reordered work and stale callbacks.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Envelope
{
    readonly Version: number;
    readonly ClientId: string;
    readonly ConnectionId: string;
    readonly RequestId: number;
}

/**
 * Startup probe. Runtimes respond only after installing their complete Intent request handler.
 * Repeated probes with the same correlation tuple must be idempotent.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Hello extends Envelope
{
    readonly Operation: "hello";
}

/**
 * Accepted replacement resets animation and takes ownership for this connection. RuntimeId fences
 * restarts; the runtime must resolve EntityId in its own world and validate the complete payload.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Set extends Envelope
{
    readonly Operation: "set";
    readonly RuntimeId: string;
    readonly EntityId: string;
    readonly Intent: Definition;
    readonly Options: ResolvedOptions;
}

/**
 * Explicitly clears the subject's current Intent, irrespective of its owning connection.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Clear extends Envelope
{
    readonly Operation: "clear";
    readonly RuntimeId: string;
    readonly EntityId: string;
}

/**
 * Releases only state still owned by this connection. RuntimeId may be absent when disposal races
 * startup. The runtime must fence this connection before acknowledging, rejecting delayed hello/set
 * work at or below this request sequence; cleanup cannot remove another connection's replacement.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Dispose extends Envelope
{
    readonly Operation: "dispose";
    readonly RuntimeId?: string;
}

/**
 * Complete public request union. Retries are allowed only for hello; mutating commands are never
 * replayed after a lost acknowledgement because their acceptance is then unknown.
 *
 * @category Model
 * @since 1.0.0
 */
export type Command = Hello | Set | Clear | Dispose;

/**
 * Runtime acknowledgement. Ready is valid only for hello; accepted is valid only for mutations.
 * RuntimeId identifies this boot, not persistent state. Rejection carries a bounded actionable
 * Message. All correlation fields and Operation must match the request before settling it.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Acknowledgement extends Envelope
{
    readonly Operation: Command["Operation"];
    readonly RuntimeId: string;
    readonly Status: "ready" | "accepted" | "rejected";
    readonly Message?: string;
}
