/**
 * Pure button controls, subscription contracts, and validated timing for World input signals.
 *
 * @module @bedform/server/Internal/ButtonInput
 *
 * @file      ButtonInput.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Result from "@bedform/effect/Result";
import { pipe } from "@bedform/effect/Function";

/**
 * Native buttons and player-relative directions, without importing the native runtime.
 *
 * @category Constant
 * @since 2.11.0
 */
export const InputButton = Object.freeze({
    Backward: "Backward",
    BackwardLeft: "BackwardLeft",
    BackwardRight: "BackwardRight",
    Forward: "Forward",
    ForwardLeft: "ForwardLeft",
    ForwardRight: "ForwardRight",
    Jump: "Jump",
    Left: "Left",
    Right: "Right",
    Sneak: "Sneak"
} as const);

/**
 * A native button or one of eight independently observable movement directions.
 *
 * @category Model
 * @since 2.11.0
 */
export type InputButton = typeof InputButton[keyof typeof InputButton];

/**
 * Input families matched independently for each registration, player, and button.
 *
 * @category Model
 * @since 2.11.0
 */
export type Kind = "Down" | "Up" | "Press" | "Hold" | "NTap" | "PressAndHold" | "NTapAndHold";

/**
 * A threshold crossing, subsequent observed tick, or terminal hold notification.
 *
 * @category Model
 * @since 2.11.0
 */
export type HoldPhase = "Start" | "Tick" | "End";

/**
 * Lifecycle boundaries that discard unfinished input without completing a press or tap.
 *
 * @category Model
 * @since 2.11.0
 */
export type CancellationReason = "Reset" | "Leave" | "Death" | "Spawn" | "DimensionChange" |
    "UnavailableInput" | "Dispose";

/**
 * Inclusive short-press and gap limits, plus the first tick that qualifies as a hold.
 *
 * @category Constant
 * @since 2.11.0
 */
export const DefaultTiming = Object.freeze({
    holdTicks: 6,
    maxGapTicks: 5,
    maxPressTicks: 5
} as const);

/**
 * Button selection and safe-integer game-tick limits; omitted buttons select all controls.
 * Hold timing must exceed the short-press limit; press and gap limits may be zero.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface Options
{
    readonly buttons?: ReadonlyArray<InputButton>;
    readonly maxPressTicks?: number;
    readonly holdTicks?: number;
    readonly maxGapTicks?: number;
}

/**
 * Hold-phase filtering; hidden phases still advance internal recognition normally.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface HoldOptions extends Options
{
    readonly phase?: HoldPhase;
}

export namespace Registration
{
    /**
     * A transition or one short release, with no tap count to configure.
     *
     * @category Configuration
     * @since 2.11.0
     */
    export interface Edge extends Options
    {
        readonly kind: "Down" | "Up" | "Press";
    }

    /**
     * An initial hold or one completed short press followed by another held press.
     *
     * @category Configuration
     * @since 2.11.0
     */
    export interface Hold extends HoldOptions
    {
        readonly kind: "Hold" | "PressAndHold";
    }

    /**
     * A positive number of completed short presses, counted on release.
     *
     * @category Configuration
     * @since 2.11.0
     */
    export interface TapSequence extends Options
    {
        readonly kind: "NTap";
        readonly count: number;
    }

    /**
     * Completed short presses followed by an additional held press, excluded from the count.
     *
     * @category Configuration
     * @since 2.11.0
     */
    export interface TapSequenceAndHold extends HoldOptions
    {
        readonly kind: "NTapAndHold";
        readonly count: number;
    }
}

/**
 * One input-signal subscription before validation and default resolution.
 *
 * @category Configuration
 * @since 2.11.0
 */
export type Registration = Registration.Edge | Registration.Hold |
    Registration.TapSequence | Registration.TapSequenceAndHold;

/**
 * Immutable registration with resolved timing, buttons, and completed-tap target.
 * Count is zero for edges and initial holds, one for Press and PressAndHold, and N for N-tap families.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface Definition
{
    readonly kind: Kind;
    readonly buttons: ReadonlyArray<InputButton>;
    readonly count: number;
    readonly maxPressTicks: number;
    readonly holdTicks: number;
    readonly maxGapTicks: number;
    readonly phase?: HoldPhase;
}

/**
 * Rejected registration field, retaining the supplied value for diagnostics.
 *
 * @category Error
 * @since 2.11.0
 */
export interface ConfigurationError
{
    readonly _tag: "ConfigurationError";
    readonly field: "kind" | "count" | "phase" | keyof Options;
    readonly value: unknown;
    readonly message: string;
}

/**
 * Constructs a frozen diagnostic without throwing for invalid configuration.
 *
 * @category ErrorHandling
 * @since 2.11.0
 */
const invalid = (field: ConfigurationError["field"], value: unknown, message: string): ConfigurationError =>
{
    return Object.freeze({ _tag: "ConfigurationError",
        field,
        message,
        value });
};

/**
 * Validates a game-tick limit or tap count without coercing runtime values.
 *
 * @category Decoding
 * @since 2.11.0
 */
const integer = (
    field: ConfigurationError["field"],
    value: number,
    minimum: number
): Result.Result<number, ConfigurationError> =>
{
    return Number.isSafeInteger(value) && value >= minimum ? Result.succeed(value) :
        Result.fail(invalid(field, value, `${field} must be a safe integer at least ${minimum}.`));
};

/**
 * Copies a registration and validates fields before creating independent recognizer state.
 * Empty button lists select no controls; repeated buttons are recognized only once.
 *
 * @category Decoding
 * @since 2.11.0
 */
export const configure = (registration: Registration): Result.Result<Definition, ConfigurationError> =>
{
    const { kind } = registration;
    if (![ "Down", "Up", "Press", "Hold", "NTap", "PressAndHold", "NTapAndHold" ].includes(kind))
    {
        return Result.fail(invalid("kind", kind, "kind must name a supported input signal."));
    }

    const buttons = registration.buttons === undefined ? Object.values(InputButton) : registration.buttons;
    if (!Array.isArray(buttons) ||
        !Array.from(buttons).every((button: InputButton) => Object.values(InputButton).includes(button)))
    {
        return Result.fail(invalid("buttons", buttons,
            "buttons must contain only supported input controls."));
    }

    const phase = "phase" in registration ? registration.phase : undefined;
    if (phase !== undefined && (![ "Hold", "PressAndHold", "NTapAndHold" ].includes(kind) ||
        ![ "Start", "Tick", "End" ].includes(phase)))
    {
        return Result.fail(invalid("phase", phase,
            "phase must select Start, Tick, or End on a hold signal."));
    }

    const count = kind === "NTap" || kind === "NTapAndHold" ? registration.count :
        kind === "Press" || kind === "PressAndHold" ? 1 : 0;
    return pipe(Result.all({
        count: integer("count", count, kind === "NTap" || kind === "NTapAndHold" ? 1 : 0),
        holdTicks: integer("holdTicks",
            registration.holdTicks === undefined ? DefaultTiming.holdTicks : registration.holdTicks, 1),
        maxGapTicks: integer("maxGapTicks",
            registration.maxGapTicks === undefined ? DefaultTiming.maxGapTicks : registration.maxGapTicks, 0),
        maxPressTicks: integer("maxPressTicks",
            registration.maxPressTicks === undefined ?
                DefaultTiming.maxPressTicks : registration.maxPressTicks,
            0)
    }), Result.flatMap((timing: Omit<Definition, "buttons" | "kind" | "phase">):
    Result.Result<Definition, ConfigurationError> =>
        timing.holdTicks <= timing.maxPressTicks ? Result.fail(invalid("holdTicks", timing.holdTicks,
            "holdTicks must exceed maxPressTicks.")) : Result.succeed(Object.freeze({
            ...timing,
            buttons: Object.freeze([ ...new Set(buttons) ]),
            kind,
            phase
        }))));
};

/**
 * Determines whether the selected input family emits hold phases.
 *
 * @category Guard
 * @since 2.11.0
 */
export const isHold = (kind: Kind): kind is "Hold" | "PressAndHold" | "NTapAndHold" =>
{
    return kind === "Hold" || kind === "PressAndHold" || kind === "NTapAndHold";
};
