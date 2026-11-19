/**
 * Pure text formatting for the World input demonstration's chat, action bar and console evidence.
 *
 * @module @sorrell/world-input-demo/Script/Format
 *
 * @file      Format.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/**
 * Stable display order of every button, matching the @bedform/server InputButton values.
 *
 * @category Constant
 * @since 1.0.0
 */
export const ButtonOrder: ReadonlyArray<string> = Object.freeze([ "Jump", "Sneak", "Forward", "Backward",
    "Left", "Right", "ForwardLeft", "ForwardRight", "BackwardLeft", "BackwardRight" ]);

/**
 * Buttons reported by native button events rather than the sampled movement vector.
 *
 * @category Constant
 * @since 1.0.0
 */
export const NativeButtons: ReadonlyArray<string> = Object.freeze([ "Jump", "Sneak" ]);

/**
 * Which recognized gestures are echoed into a player's chat; the console always records every event.
 *
 * @category Model
 * @since 1.0.0
 */
export type ChatMode = "all" | "buttons" | "off";

/**
 * The fields of a derived World event that the demonstration displays.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Shown
{
    readonly button: string;
    readonly playerId: string;
    readonly tick: number;
    readonly tapCount: number;
    readonly duration: number;
    readonly phase?: string;
    readonly reason?: string;
}

/**
 * Parses a chat-mode argument, accepting only the three supported modes.
 *
 * @category Decoding
 * @since 1.0.0
 */
export function parseChatMode(value: string): ChatMode | undefined
{
    const mode = value.trim().toLowerCase();
    return mode === "all" || mode === "buttons" || mode === "off" ? mode : undefined;
}

/**
 * Determines whether a gesture on this button is echoed to chat in the given mode.
 *
 * @category Filtering
 * @since 1.0.0
 */
export function chats(mode: ChatMode, button: string): boolean
{
    return mode === "all" || mode === "buttons" && NativeButtons.includes(button);
}

/**
 * Describes one derived event as plain text: signal, phase and reason, button, tick, taps and duration.
 *
 * @category Converting
 * @since 1.0.0
 */
export function describe(signal: string, event: Shown): string
{
    const phase = event.phase === undefined ? "" : ` ${event.phase}`;
    const reason = event.reason === undefined ? "" : ` (${event.reason})`;
    return `${signal}${phase}${reason} ${event.button} tick=${event.tick} taps=${event.tapCount} ` +
        `duration=${event.duration}`;
}

/**
 * Formats one raw movement axis with an explicit sign and two decimals.
 *
 * @category Converting
 * @since 1.0.0
 */
export function axis(value: number): string
{
    if (!Number.isFinite(value))
    {
        return "?";
    }

    const rounded = Math.round(value * 100) / 100;
    return `${rounded < 0 ? "-" : "+"}${Math.abs(rounded).toFixed(2)}`;
}

/**
 * Lists held buttons in stable display order, or a dash when none are held.
 *
 * @category Converting
 * @since 1.0.0
 */
export function held(active: ReadonlySet<string>): string
{
    const names = ButtonOrder.filter((button: string) => active.has(button));
    return names.length === 0 ? "-" : names.join(" ");
}
