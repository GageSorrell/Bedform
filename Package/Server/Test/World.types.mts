/**
 * Entry-point World event filters, native enum compatibility, and unchanged World method types.
 *
 * @module @bedform/server/Test/World.types
 *
 * @file      World.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { HoldCancellationReason, InputEventOptions, MovementButton, PlayerButtonGestureAfterEvent,
    PlayerButtonHoldAfterEvent, PlayerButtonInputAfterEvent } from "@bedform/server";
import { InputButton, world } from "@bedform/server";
import type { PlayerButtonInputAfterEvent as NativeEvent, InputEventOptions as NativeOptions,
    World as NativeWorld, Player } from "@minecraft/server";

const signal = world.afterEvents.playerButtonInput;
signal.subscribe((event: PlayerButtonInputAfterEvent): void =>
{
    const button: InputButton = event.button;
    const player: NativeEvent["player"] = event.player;
    const state: NativeEvent["newButtonState"] = event.newButtonState;
    void [ button, player, state ];
});
signal.subscribe((event: PlayerButtonInputAfterEvent<"ForwardRight">): void =>
{
    const button: "ForwardRight" = event.button;
    void button;
}, { buttons: [ InputButton.ForwardRight ] });

const nativeCallback = (event: NativeEvent): void =>
{
    void event.player;
};

declare const nativeOptions: NativeOptions;
const returned = signal.subscribe(nativeCallback, { buttons: [ InputButton.Jump, InputButton.Sneak ] });
const nativeReturned: typeof nativeCallback = returned;
signal.subscribe(nativeCallback, { ...nativeOptions,
    buttons: [ InputButton.Jump ] });
signal.unsubscribe(returned);
signal.unsubscribe(nativeCallback);
// @ts-expect-error Unfiltered callbacks must also accept movement buttons.
signal.subscribe(nativeCallback);
// @ts-expect-error Callback-only inference cannot falsely promise native-only payloads.
signal.subscribe(nativeCallback, { state: nativeOptions.state });
// @ts-expect-error Explicit type arguments cannot bypass the requirement for a narrow button filter.
signal.subscribe<typeof InputButton.Jump>(nativeCallback);
// @ts-expect-error Item actions are not movement or button input.
const item: InputEventOptions = { buttons: [ "ItemUse" ] };
// @ts-expect-error Invalid state names cannot select native button states.
const state: InputEventOptions = { state: "Down" };

const day: ReturnType<NativeWorld["getDay"]> = world.getDay();
const dimension: ReturnType<NativeWorld["getDimension"]> = world.getDimension("overworld");
const nativeAfterEvent: NativeWorld["afterEvents"]["playerSpawn"] = world.afterEvents.playerSpawn;
const movement: MovementButton = InputButton.BackwardLeft;
declare const event: PlayerButtonInputAfterEvent<typeof InputButton.Forward>;
const forward: "Forward" = event.button;
void [ nativeReturned, item, state, day, dimension, nativeAfterEvent, movement, forward ];

const events = world.afterEvents;
events.playerButtonDown.subscribe((event: PlayerButtonGestureAfterEvent): void =>
{
    const player: Player = event.player;
    const data: ReadonlyArray<number | string> = [ event.playerId, event.tick, event.tapCount,
        event.duration ];
    void [ player, data ];
});
type SneakEvent = PlayerButtonGestureAfterEvent<typeof InputButton.Sneak>;
const doubleSneak = events.playerButtonNTap.subscribe((event: SneakEvent): void =>
{
    const button: typeof InputButton.Sneak = event.button;
    void button;
}, { buttons: [ InputButton.Sneak ],
    count: 2,
    maxGapTicks: 4 });
events.playerButtonNTap.unsubscribe(doubleSneak);
events.playerButtonHold.subscribe((event: PlayerButtonHoldAfterEvent): void =>
{
    if (event.phase === "End" && event.reason !== "Release")
    {
        const reason: HoldCancellationReason = event.reason;
        // @ts-expect-error A cancelled hold may have no available player.
        const player: Player = event.player;
        void [ reason, player ];
    }
    else
    {
        const player: Player = event.player;
        void player;
    }
}, { holdTicks: 20 });
events.playerButtonPressAndHold.subscribe((event: PlayerButtonHoldAfterEvent<InputButton, "End">): void =>
{
    const phase: "End" = event.phase;
    void phase;
}, { phase: "End" });
events.playerButtonNTapAndHold.subscribe(
    (event: PlayerButtonHoldAfterEvent<typeof InputButton.Jump, "Start" | "Tick">): void =>
    {
        const player: Player = event.player;
        void player;
    },
    { buttons: [ InputButton.Jump ],
        count: 3,
        phase: "Tick" }
);
events.playerButtonPress.subscribe((event: PlayerButtonGestureAfterEvent<MovementButton>): void =>
{
    const button: MovementButton = event.button;
    void button;
}, { buttons: [ InputButton.Forward, InputButton.BackwardRight ],
    maxPressTicks: 3 });
// @ts-expect-error N-tap signals require a count.
events.playerButtonNTap.subscribe((): void => {});
// @ts-expect-error N-tap-and-hold options require a count.
events.playerButtonNTapAndHold.subscribe((): void => {}, { phase: "Start" });
// @ts-expect-error Signals without phases accept no phase selection.
events.playerButtonPress.subscribe((): void => {}, { phase: "End" });
declare const jumpUp: (event: PlayerButtonGestureAfterEvent<typeof InputButton.Jump>) => void;
declare const holdEnd: (event: PlayerButtonHoldAfterEvent<InputButton, "End">) => void;
// @ts-expect-error A narrow callback requires an explicit button filter.
events.playerButtonUp.subscribe(jumpUp);
// @ts-expect-error A phase-narrowed callback requires an explicit phase filter.
events.playerButtonHold.subscribe(holdEnd);
// @ts-expect-error Explicit type arguments cannot bypass the phase filter.
events.playerButtonHold.subscribe<"End">(holdEnd, {});
// @ts-expect-error Item actions are not public input controls.
events.playerButtonDown.subscribe((): void => {}, { buttons: [ "ItemUse" ] });
// @ts-expect-error Native event options are not gesture options.
events.playerButtonPress.subscribe((): void => {}, { state: nativeOptions.state });
