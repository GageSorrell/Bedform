/**
 * Forwards Canvas's canonical cooperative Intent protocol for shared runtime implementations.
 *
 * @module bedform-canvas/Public/Intent
 *
 * @file      Intent.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export { MaxMessageBytes, ScriptEvent, Timing, Version } from
    "../../../Package/Bedform/Source/Canvas/Public/Intent.js";
export type { Acknowledgement, Clear, Command, Dispose, Envelope, Hello, Set } from
    "../../../Package/Bedform/Source/Canvas/Public/Intent.js";
