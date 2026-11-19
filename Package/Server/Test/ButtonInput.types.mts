/**
 * Compile-time button registration, event narrowing, and immutable snapshot contracts.
 *
 * @module @bedform/server/Test/ButtonInput.types
 *
 * @file      ButtonInput.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type * as Button from "../Source/Internal/ButtonInput.js";
import type * as Recognizer from "../Source/Internal/ButtonRecognizer.js";

const tap: Button.Registration = { buttons: [ "Forward", "Right", "ForwardRight" ],
    count: 2,
    kind: "NTap" };
const hold: Button.Registration = { count: 2,
    kind: "NTapAndHold",
    phase: "End" };

// @ts-expect-error N-tap subscriptions require a tap count.
const missingCount: Button.Registration = { kind: "NTap" };
// @ts-expect-error Combined N-tap holds also require a completed-tap count.
const missingHoldCount: Button.Registration = { kind: "NTapAndHold" };
// @ts-expect-error Item actions are not button controls.
const item: Button.InputButton = "ItemUse";
const pressPhase: Button.Registration = { kind: "Press",
    // @ts-expect-error Only hold subscriptions accept a phase filter.
    phase: "Start" };
// @ts-expect-error Unknown phases cannot select hold notifications.
const unknownPhase: Button.HoldPhase = "Held";

declare const event: Recognizer.Event;
if ("phase" in event)
{
    const phase: Button.HoldPhase = event.phase;
    const reason: Button.CancellationReason | "Release" | undefined = event.reason;
    void [ phase, reason ];
}
else
{
    // @ts-expect-error Edge events have no hold-phase payload.
    void event.phase;
}

declare const state: Recognizer.State;
// @ts-expect-error Snapshot clocks are immutable.
state.tick = 1;
// @ts-expect-error Registration snapshots cannot be reordered or extended in place.
state.definitions.push(state.definitions[0]);
// @ts-expect-error Button filters are immutable snapshots.
state.definitions[0].buttons.push("Jump");

void [ tap, hold, missingCount, missingHoldCount, item, pressPhase, unknownPhase ];
