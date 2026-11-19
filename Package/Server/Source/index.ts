/**
 * Everything `@minecraft/server` exports, with Bedform's extended `world` and `InputButton` in place of
 * the native ones.
 *
 * Bedform's `world` forwards every native World member and adds player-relative movement input and
 * derived button gesture after-events. The `World` and `WorldAfterEvents` types describe that facade,
 * so they shadow the native classes' types; the native class values still pass through at runtime.
 *
 * @module @bedform/server/index
 *
 * @file      index.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

export * from "@minecraft/server";
export { InputButton, world } from "./World.js";
export type { ButtonEventOptions, ButtonFilter, ButtonSelection, GestureCallback, GestureEventMap,
    GestureEventOptions, GestureKind, GestureOptionsMap, GestureSubscribe, GestureSubscribeOptions,
    HoldCancellationReason, HoldEventOptions, HoldKind, HoldPhase, HoldSelection, InputCallback,
    InputEventOptions, InputSubscribe, MovementButton, NTapAndHoldEventOptions, NTapEventOptions,
    PhaseSelection, PlayerButtonGestureAfterEvent, PlayerButtonGestureAfterEventSignal,
    PlayerButtonHoldActiveAfterEvent, PlayerButtonHoldAfterEvent, PlayerButtonHoldCancelAfterEvent,
    PlayerButtonHoldReleaseAfterEvent, PlayerButtonInputAfterEvent, PlayerButtonInputAfterEventSignal,
    World, WorldAfterEvents } from "./World.js";
