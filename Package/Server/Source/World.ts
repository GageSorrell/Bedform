/**
 * Live native World access with player-relative movement input and derived button gesture after-events.
 *
 * @module @bedform/server/World
 *
 * @file      World.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { ButtonState, InputButton as NativeInputButton,
    world as nativeWorld, system } from "@minecraft/server";
import { InputButton as Control } from "./Internal/ButtonInput.js";
import { makeWorld } from "./Internal/World.js";

export type { ButtonEventOptions, ButtonFilter, ButtonSelection, GestureCallback, GestureEventMap,
    GestureEventOptions, GestureKind, GestureOptionsMap, GestureSubscribe, GestureSubscribeOptions,
    HoldCancellationReason, HoldEventOptions, HoldKind, HoldPhase, HoldSelection, InputCallback,
    InputEventOptions, InputSubscribe, MovementButton, NTapAndHoldEventOptions, NTapEventOptions,
    PhaseSelection, PlayerButtonGestureAfterEvent, PlayerButtonGestureAfterEventSignal,
    PlayerButtonHoldActiveAfterEvent, PlayerButtonHoldAfterEvent, PlayerButtonHoldCancelAfterEvent,
    PlayerButtonHoldReleaseAfterEvent, PlayerButtonInputAfterEvent, PlayerButtonInputAfterEventSignal,
    World, WorldAfterEvents } from "./Internal/WorldTypes.js";

/**
 * Native InputButton values extended with all eight player-relative movement controls.
 * Cardinal directions remain active alongside their diagonal when both vector axes exceed 0.2.
 *
 * @category Constant
 * @since 2.11.0
 */
export const InputButton = Object.freeze({ ...Control,
    ...NativeInputButton });

/**
 * A native button or synthesized player-relative movement direction.
 *
 * @category Model
 * @since 2.11.0
 */
export type InputButton = typeof InputButton[keyof typeof InputButton];

/**
 * Native World behavior with enhanced playerButtonInput and derived button gesture signals.
 * Importing or inspecting it installs no listeners. All input signals share sampling, which starts on
 * the first subscription and stops after the final unsubscription.
 * Movement pressed and released entirely between samples cannot be recovered.
 *
 * @category Instance
 * @since 2.11.0
 */
export const world = makeWorld({ buttons: InputButton,
    states: ButtonState,
    system,
    world: nativeWorld });
