/**
 * Native-compatible World facade, extended player-button events, and derived gesture signal contracts.
 *
 * @module @bedform/server/Internal/WorldTypes
 *
 * @file      WorldTypes.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type {
    ButtonState,
    InputButton as NativeInputButton,
    PlayerButtonInputAfterEvent as NativePlayerButtonInputAfterEvent,
    World as NativeWorld,
    WorldAfterEvents as NativeWorldAfterEvents,
    Player
} from "@minecraft/server";
import type { InputButton as PureInputButton } from "./ButtonInput.js";

/**
 * A player-relative direction synthesized from the raw movement vector.
 *
 * @category Model
 * @since 2.11.0
 */
export type MovementButton = Exclude<PureInputButton, "Jump" | "Sneak">;

/**
 * All native buttons plus the eight player-relative movement directions.
 *
 * @category Model
 * @since 2.11.0
 */
export type InputButton = NativeInputButton | MovementButton;

/**
 * Native event information with a button that may also represent movement.
 * Native events retain their original object identity when forwarded.
 *
 * @category Model
 * @since 2.11.0
 */
export interface PlayerButtonInputAfterEvent<Selected extends InputButton = InputButton>
    extends Omit<NativePlayerButtonInputAfterEvent, "button">
{
    readonly button: Selected;
}

/**
 * Native button/state filters extended to movement; omitted filters select every value.
 * Explicit button lists also narrow the callback's button type.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface InputEventOptions<Selected extends InputButton = InputButton>
{
    readonly buttons?: ReadonlyArray<Selected>;
    readonly state?: ButtonState;
}

/**
 * A synchronous input observer returned unchanged by subscribe for later un-subscription.
 *
 * @category Interface
 * @since 2.11.0
 */
export type InputCallback<Selected extends InputButton = InputButton> =
    (event: PlayerButtonInputAfterEvent<Selected>) => void;

/**
 * An explicit selection required when the callback accepts only a subset of buttons.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface ButtonFilter<Selected extends InputButton> extends InputEventOptions<Selected>
{
    readonly buttons: ReadonlyArray<Selected>;
}

/**
 * Subscription overloads that narrow payloads only when a button filter guarantees the selection.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface InputSubscribe
{
    <Selected extends InputButton>(
        callback: InputCallback<NoInfer<Selected>>,
        options: ButtonFilter<Selected>
    ): InputCallback<Selected>;
    (callback: InputCallback, options?: InputEventOptions): InputCallback;
}

/**
 * Native-style input subscription and removal, including movement transitions.
 * Narrow callbacks require an explicit button filter; unfiltered callbacks cover every button.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface PlayerButtonInputAfterEventSignal
{
    readonly subscribe: InputSubscribe;
    readonly unsubscribe: <Selected extends InputButton>(callback: InputCallback<Selected>) => void;
}

/**
 * A threshold crossing, one subsequent observed tick while held, or the terminal notification.
 *
 * @category Model
 * @since 2.11.0
 */
export type HoldPhase = "Start" | "Tick" | "End";

/**
 * Lifecycle boundaries that end an active hold without a physical release.
 * Leave reports a departed player; UnavailableInput covers unreadable input and players no longer listed.
 *
 * @category Model
 * @since 2.11.0
 */
export type HoldCancellationReason =
    | "Leave"
    | "Death"
    | "Spawn"
    | "DimensionChange"
    | "UnavailableInput";

/**
 * Derived button event data. Tick is the observed game tick and duration measures the final press,
 * so Down reports zero. Tap count is zero for Down, Up and Hold, one for Press and PressAndHold,
 * and the subscribed count for NTap and NTapAndHold; it never includes a held final press.
 *
 * @category Model
 * @since 2.11.0
 */
export interface PlayerButtonGestureAfterEvent<Selected extends InputButton = InputButton>
{
    readonly button: Selected;
    readonly player: Player;
    readonly playerId: string;
    readonly tick: number;
    readonly tapCount: number;
    readonly duration: number;
}

/**
 * A hold reaching its threshold (Start) or remaining held on a later observed tick (Tick).
 *
 * @category Model
 * @since 2.11.0
 */
export interface PlayerButtonHoldActiveAfterEvent<
    Selected extends InputButton = InputButton,
    Phase extends "Start" | "Tick" = "Start" | "Tick"
> extends PlayerButtonGestureAfterEvent<Selected>
{
    readonly phase: Phase;
}

/**
 * The physical release of a hold that previously started.
 *
 * @category Model
 * @since 2.11.0
 */
export interface PlayerButtonHoldReleaseAfterEvent<Selected extends InputButton = InputButton>
    extends PlayerButtonGestureAfterEvent<Selected>
{
    readonly phase: "End";
    readonly reason: "Release";
}

/**
 * A started hold cancelled by a lifecycle boundary. The player may be unavailable,
 * for example after leaving, while playerId still identifies it.
 *
 * @category Model
 * @since 2.11.0
 */
export interface PlayerButtonHoldCancelAfterEvent<Selected extends InputButton = InputButton>
    extends Omit<PlayerButtonGestureAfterEvent<Selected>, "player">
{
    readonly phase: "End";
    readonly player: Player | undefined;
    readonly reason: HoldCancellationReason;
}

/**
 * Any hold-family event, narrowed to the phases a subscription selects.
 *
 * @category Model
 * @since 2.11.0
 */
export type PlayerButtonHoldAfterEvent<Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase> =
    ([ Exclude<Phase, "End"> ] extends [ never ] ? never :
        PlayerButtonHoldActiveAfterEvent<Selected, Exclude<Phase, "End">>) |
    ("End" extends Phase ? PlayerButtonHoldReleaseAfterEvent<Selected> |
        PlayerButtonHoldCancelAfterEvent<Selected> : never);

/**
 * Button selection for transition signals; an omitted list selects every button and an empty list none.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface ButtonEventOptions<Selected extends InputButton = InputButton>
{
    readonly buttons?: ReadonlyArray<Selected>;
}

/**
 * Safe-integer game-tick limits, defaulting to 5, 6 and 5. Press and gap limits are inclusive and
 * may be zero; holdTicks is the first held duration that qualifies and must exceed maxPressTicks.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface GestureEventOptions<Selected extends InputButton = InputButton>
    extends ButtonEventOptions<Selected>
{
    readonly maxPressTicks?: number;
    readonly holdTicks?: number;
    readonly maxGapTicks?: number;
}

/**
 * Gesture timing plus an optional phase filter; hidden phases still advance recognition.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface HoldEventOptions<Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase> extends GestureEventOptions<Selected>
{
    readonly phase?: Phase;
}

/* eslint-disable @typescript-eslint/naming-convention */

/**
 * Gesture timing with the required positive integer number of completed short presses.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface NTapEventOptions<Selected extends InputButton = InputButton>
    extends GestureEventOptions<Selected>
{
    readonly count: number;
}

/**
 * Hold options with the required positive integer number of short presses before the held press.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface NTapAndHoldEventOptions<Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase> extends HoldEventOptions<Selected, Phase>
{
    readonly count: number;
}

/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Event payloads of every derived signal, keyed by recognition family.
 *
 * @category Model
 * @since 2.11.0
 */
export interface GestureEventMap<Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase>
{
    readonly Down: PlayerButtonGestureAfterEvent<Selected>;
    readonly Up: PlayerButtonGestureAfterEvent<Selected>;
    readonly Press: PlayerButtonGestureAfterEvent<Selected>;
    readonly Hold: PlayerButtonHoldAfterEvent<Selected, Phase>;
    readonly NTap: PlayerButtonGestureAfterEvent<Selected>;
    readonly PressAndHold: PlayerButtonHoldAfterEvent<Selected, Phase>;
    readonly NTapAndHold: PlayerButtonHoldAfterEvent<Selected, Phase>;
}

/**
 * Subscription options of every derived signal, keyed by recognition family.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface GestureOptionsMap<Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase>
{
    readonly Down: ButtonEventOptions<Selected>;
    readonly Up: ButtonEventOptions<Selected>;
    readonly Press: GestureEventOptions<Selected>;
    readonly Hold: HoldEventOptions<Selected, Phase>;
    readonly NTap: NTapEventOptions<Selected>;
    readonly PressAndHold: HoldEventOptions<Selected, Phase>;
    readonly NTapAndHold: NTapAndHoldEventOptions<Selected, Phase>;
}

/**
 * A derived recognition family exposed as a separate after-event signal.
 *
 * @category Model
 * @since 2.11.0
 */
export type GestureKind = keyof GestureEventMap;

/**
 * Families whose events carry Start, Tick and End phases.
 *
 * @category Model
 * @since 2.11.0
 */
export type HoldKind =
    | "Hold"
    | "PressAndHold"
    | "NTapAndHold";

/**
 * A synchronous derived-event observer returned unchanged by subscribe for later un-subscription.
 *
 * @category Interface
 * @since 2.11.0
 */
export type GestureCallback<Kind extends GestureKind, Selected extends InputButton = InputButton,
    Phase extends HoldPhase = HoldPhase> = (event: GestureEventMap<Selected, Phase>[Kind]) => void;

/**
 * An explicit button list, required before a callback may accept only some buttons.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface ButtonSelection<Selected extends InputButton>
{
    readonly buttons: ReadonlyArray<Selected>;
}

/**
 * An explicit phase, required before a hold callback may accept only some phases.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface PhaseSelection<Phase extends HoldPhase>
{
    readonly phase: Phase;
}

/**
 * Phase selection for hold families; signals without phases accept none.
 *
 * @category Configuration
 * @since 2.11.0
 */
export type HoldSelection<Kind extends GestureKind, Phase extends HoldPhase> =
    Kind extends HoldKind ? PhaseSelection<Phase> : never;

/**
 * Remaining subscribe arguments; N-tap families require options because count has no default.
 *
 * @category Configuration
 * @since 2.11.0
 */
export type GestureSubscribeOptions<Kind extends GestureKind> = Kind extends "NTap" | "NTapAndHold" ?
    [ options: GestureOptionsMap[Kind] ] : [ options?: GestureOptionsMap[Kind] ];

/**
 * Subscription overloads that narrow payloads only when explicit button or phase filters guarantee it.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface GestureSubscribe<Kind extends GestureKind>
{
    <Selected extends InputButton, Phase extends HoldPhase>(
        callback: GestureCallback<Kind, NoInfer<Selected>, NoInfer<Phase>>,
        options: GestureOptionsMap<Selected, Phase>[Kind] &
            ButtonSelection<Selected> &
            HoldSelection<Kind, Phase>
    ): GestureCallback<Kind, Selected, Phase>;
    <Selected extends InputButton>(
        callback: GestureCallback<Kind, NoInfer<Selected>>,
        options: GestureOptionsMap<Selected>[Kind] & ButtonSelection<Selected>
    ): GestureCallback<Kind, Selected>;
    <Phase extends HoldPhase>(
        callback: GestureCallback<Kind, InputButton, NoInfer<Phase>>,
        options: GestureOptionsMap<InputButton, Phase>[Kind] & HoldSelection<Kind, Phase>
    ): GestureCallback<Kind, InputButton, Phase>;
    (callback: GestureCallback<Kind>, ...options: GestureSubscribeOptions<Kind>): GestureCallback<Kind>;
}

/**
 * Native-style subscription and removal for one derived recognition family.
 * Each subscription recognizes independently and never inherits presses begun before it.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface PlayerButtonGestureAfterEventSignal<Kind extends GestureKind>
{
    readonly subscribe: GestureSubscribe<Kind>;
    readonly unsubscribe: <Selected extends InputButton, Phase extends HoldPhase>(
        callback: GestureCallback<Kind, Selected, Phase>) => void;
}

/**
 * Native after-events with the player-button signal replaced and derived button signals added.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface WorldAfterEvents extends Omit<NativeWorldAfterEvents, "playerButtonInput">
{
    readonly playerButtonInput: PlayerButtonInputAfterEventSignal;
    readonly playerButtonDown: PlayerButtonGestureAfterEventSignal<"Down">;
    readonly playerButtonUp: PlayerButtonGestureAfterEventSignal<"Up">;
    readonly playerButtonPress: PlayerButtonGestureAfterEventSignal<"Press">;
    readonly playerButtonHold: PlayerButtonGestureAfterEventSignal<"Hold">;
    readonly playerButtonNTap: PlayerButtonGestureAfterEventSignal<"NTap">;
    readonly playerButtonPressAndHold: PlayerButtonGestureAfterEventSignal<"PressAndHold">;
    readonly playerButtonNTapAndHold: PlayerButtonGestureAfterEventSignal<"NTapAndHold">;
}

/**
 * Live native World behavior with extended button input through afterEvents.
 * This forwarding facade has its own identity and leaves the native singleton untouched.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface World extends Omit<NativeWorld, "afterEvents">
{
    readonly afterEvents: WorldAfterEvents;
}
