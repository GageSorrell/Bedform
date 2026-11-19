/**
 * Private immutable per-button press, tap, and hold recognition behind the World input signals.
 *
 * @module @bedform/server/Internal/ButtonRecognizer
 *
 * @file      ButtonRecognizer.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Button from "./ButtonInput.js";
import * as HashMap from "@bedform/effect/HashMap";
import * as Option from "@bedform/effect/Option";
import * as Result from "@bedform/effect/Result";
import { pipe } from "@bedform/effect/Function";

/**
 * One observed transition at a nonnegative safe-integer game tick.
 *
 * @category Model
 * @since 2.11.0
 */
export interface Input
{
    readonly playerId: string;
    readonly button: Button.InputButton;
    readonly pressed: boolean;
    readonly tick: number;
}

/**
 * Recognition metadata without native player references. Duration measures the final press.
 * Tap count excludes a held final press and is zero for transition events and initial holds.
 *
 * @category Model
 * @since 2.11.0
 */
export interface EventData
{
    readonly registration: number;
    readonly playerId: string;
    readonly button: Button.InputButton;
    readonly tick: number;
    readonly tapCount: number;
    readonly duration: number;
}

export namespace Event
{
    /**
     * An observed transition or a completed sequence of short releases.
     *
     * @category Model
     * @since 2.11.0
     */
    export interface Edge extends EventData
    {
        readonly kind: "Down" | "Up" | "Press" | "NTap";
    }

    /**
     * One hold phase; End distinguishes physical release from lifecycle cancellation.
     *
     * @category Model
     * @since 2.11.0
     */
    export interface Hold extends EventData
    {
        readonly kind: "Hold" | "PressAndHold" | "NTapAndHold";
        readonly phase: Button.HoldPhase;
        readonly reason?: Button.CancellationReason | "Release";
    }
}

/**
 * A transition, short-press match, or hold phase emitted for a registration.
 *
 * @category Model
 * @since 2.11.0
 */
export type Event = Event.Edge | Event.Hold;

/**
 * Progress for one button in one registration. Optional ticks preserve valid zero-tick edges.
 *
 * @category Model
 * @since 2.11.0
 */
export interface Progress
{
    readonly pressedAt: Option.Option<number>;
    readonly releasedAt: Option.Option<number>;
    readonly count: number;
    readonly holding: boolean;
    readonly emittedAt: Option.Option<number>;
}

/**
 * Persistent progress for every observed button within a single registration.
 *
 * @category Model
 * @since 2.11.0
 */
export type ButtonProgress = HashMap.HashMap<Button.InputButton, Progress>;

/**
 * Per-registration button maps for one player, with stable registration indices.
 *
 * @category Model
 * @since 2.11.0
 */
export type PlayerProgress = ReadonlyArray<ButtonProgress>;

/**
 * Immutable registrations and per-player arrays of independent per-button progress maps.
 * Registration indices are stable for the lifetime of this snapshot series.
 *
 * @category Model
 * @since 2.11.0
 */
export interface State
{
    readonly definitions: ReadonlyArray<Button.Definition>;
    readonly players: HashMap.HashMap<string, PlayerProgress>;
    readonly tick: number;
}

/**
 * A new snapshot and its ordered, frozen event batch.
 *
 * @category Model
 * @since 2.11.0
 */
export interface Transition
{
    readonly state: State;
    readonly events: ReadonlyArray<Event>;
}

/**
 * An invalid clock value; rejected operations leave the original snapshot unchanged.
 *
 * @category Error
 * @since 2.11.0
 */
export interface TimeError
{
    readonly _tag: "TimeError";
    readonly tick: number;
    readonly previousTick: number;
    readonly message: string;
}

/**
 * Time and cancellation reason for discarding unfinished input.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface Reset
{
    readonly tick: number;
    readonly reason?: Button.CancellationReason;
}

/**
 * A lifecycle reset limited to one player.
 *
 * @category Configuration
 * @since 2.11.0
 */
export interface PlayerReset extends Reset
{
    readonly playerId: string;
}

/**
 * Creates an idle button snapshot without an inferred physical press.
 *
 * @category Constructor
 * @since 2.11.0
 */
const idle = (): Progress =>
{
    return Object.freeze({ count: 0,
        emittedAt: Option.none<number>(),
        holding: false,
        pressedAt: Option.none<number>(),
        releasedAt: Option.none<number>() });
};

/**
 * Validates clock values without permitting fractions, overflow, or time reversal.
 *
 * @category Decoding
 * @since 2.11.0
 */
const time = (state: State, tick: number): Result.Result<number, TimeError> =>
{
    return Number.isSafeInteger(tick) && tick >= state.tick ? Result.succeed(tick) :
        Result.fail(Object.freeze({
            _tag: "TimeError",
            message: "tick must be a nonnegative safe integer at least as large as the previous tick.",
            previousTick: state.tick,
            tick
        }));
};

/**
 * Copies and validates subscriptions before starting idle, independent recognition.
 * This pure operation neither imports native services nor installs subscriptions.
 *
 * @category Constructor
 * @since 2.11.0
 */
export const make = (
    registrations: ReadonlyArray<Button.Registration>
): Result.Result<State, Button.ConfigurationError> =>
{
    return pipe(Result.all(registrations.map(Button.configure)),
        Result.map((definitions: Array<Button.Definition>): State => Object.freeze({
            definitions: Object.freeze(definitions),
            players: HashMap.empty<string, PlayerProgress>(),
            tick: 0
        })));
};

/**
 * Removes idle buttons and players so completed sequences retain no historical progress.
 *
 * @category Filtering
 * @since 2.11.0
 */
const finish = (state: State, events: ReadonlyArray<Event>): Transition =>
{
    const players = HashMap.filter(HashMap.map(state.players, (entries: PlayerProgress): PlayerProgress =>
        Object.freeze(entries.map((buttons: ButtonProgress): ButtonProgress =>
            HashMap.filter(buttons, (progress: Progress) =>
                Option.isSome(progress.pressedAt) || progress.count > 0)))),
    (entries: PlayerProgress) => entries.some((buttons: ButtonProgress) => HashMap.size(buttons) > 0));
    return Object.freeze({ events: Object.freeze(events),
        state: Object.freeze({ ...state,
            players }) });
};

/**
 * Builds metadata for an observed edge or final held press.
 *
 * @category Constructor
 * @since 2.11.0
 */
const metadata = (
    definition: Button.Definition,
    registration: number,
    playerId: string,
    button: Button.InputButton,
    progress: Progress,
    tick: number
): EventData =>
{
    return { button,
        duration: tick - Option.getOrElse(progress.pressedAt, () => tick),
        playerId,
        registration,
        tapCount: definition.count,
        tick };
};

/**
 * Records an event after applying only delivery filters, never recognition filters.
 *
 * @category Filtering
 * @since 2.11.0
 */
const emit = (events: Array<Event>, definition: Button.Definition, event: Event): void =>
{
    if (!("phase" in event) || definition.phase === undefined || definition.phase === event.phase)
    {
        events.push(Object.freeze(event));
    }
};

/**
 * Expires release gaps and advances final holds once at the currently observed tick.
 * Input edges may begin holds; only explicit clock advancement produces subsequent Tick phases.
 *
 * @category Transforming
 * @since 2.11.0
 */
const sweep = (state: State, tick: number, emitTicks: boolean): Transition =>
{
    const events: Array<Event> = [];
    const players = HashMap.map(state.players, (entries: PlayerProgress, playerId: string): PlayerProgress =>
        Object.freeze(entries.map((buttons: ButtonProgress, registration: number): ButtonProgress =>
            HashMap.map(buttons, (progress: Progress, button: Button.InputButton): Progress =>
            {
                const definition = state.definitions[registration];
                if (Option.isNone(progress.pressedAt))
                {
                    return Option.isSome(progress.releasedAt) &&
                    tick - progress.releasedAt.value > definition.maxGapTicks
                        ? idle() : progress;
                }

                if (!Button.isHold(definition.kind) || progress.count !== definition.count ||
                tick - progress.pressedAt.value < definition.holdTicks)
                {
                    return progress;
                }

                if (!progress.holding || emitTicks && Option.getOrElse(progress.emittedAt, () => -1) < tick)
                {
                    emit(events, definition, {
                        ...metadata(definition, registration, playerId, button, progress, tick),
                        kind: definition.kind,
                        phase: progress.holding ? "Tick" : "Start" });
                    return Object.freeze({ ...progress,
                        emittedAt: Option.some(tick),
                        holding: true });
                }

                return progress;
            }))));
    return finish({ ...state,
        players,
        tick }, events);
};

/**
 * Observes time without replaying skipped ticks or duplicating phases in the same tick.
 *
 * @category Transforming
 * @since 2.11.0
 */
export const advance = (state: State, tick: number): Result.Result<Transition, TimeError> =>
{
    return pipe(time(state, tick), Result.map(() => sweep(state, tick, true)));
};

/**
 * Processes an edge for a single registration and button, ignoring duplicate or unmatched transitions.
 * A failed final combined hold consumes that attempt rather than sliding its taps into another match.
 *
 * @category Transforming
 * @since 2.11.0
 */
const observe = (
    definition: Button.Definition,
    registration: number,
    progress: Progress,
    edge: Input,
    events: Array<Event>
): Progress =>
{
    if (edge.pressed)
    {
        if (Option.isSome(progress.pressedAt))
        {
            return progress;
        }

        const pressed = Object.freeze({ ...progress,
            pressedAt: Option.some(edge.tick),
            releasedAt: Option.none<number>() });
        if (definition.kind === "Down")
        {
            emit(events, definition, {
                ...metadata(definition, registration, edge.playerId, edge.button, pressed, edge.tick),
                kind: "Down" });
        }

        return pressed;
    }

    if (Option.isNone(progress.pressedAt))
    {
        return progress;
    }

    const data = metadata(definition, registration, edge.playerId, edge.button, progress, edge.tick);
    if (definition.kind === "Up")
    {
        emit(events, definition, { ...data,
            kind: "Up" });
    }
    else if (progress.holding && Button.isHold(definition.kind))
    {
        emit(events, definition, { ...data,
            kind: definition.kind,
            phase: "End",
            reason: "Release" });
    }
    else if (data.duration <= definition.maxPressTicks)
    {
        if (definition.kind === "Press" || definition.kind === "NTap")
        {
            if (progress.count + 1 === definition.count)
            {
                emit(events, definition, { ...data,
                    kind: definition.kind });
            }
            else
            {
                return Object.freeze({ ...idle(),
                    count: progress.count + 1,
                    releasedAt: Option.some(edge.tick) });
            }
        }
        else if (Button.isHold(definition.kind) && progress.count < definition.count)
        {
            return Object.freeze({ ...idle(),
                count: progress.count + 1,
                releasedAt: Option.some(edge.tick) });
        }
    }

    return idle();
};

/**
 * Commits an observed button edge after resolving elapsed thresholds and gaps.
 * A release exactly at the hold threshold begins and ends the hold in the same event batch.
 *
 * @category Transforming
 * @since 2.11.0
 */
export const input = (state: State, edge: Input): Result.Result<Transition, TimeError> =>
{
    return pipe(time(state, edge.tick), Result.map(() =>
    {
        const observed = sweep(state, edge.tick, false);
        const events = [ ...observed.events ];
        const previous = Option.getOrElse(HashMap.get(observed.state.players, edge.playerId), () =>
            state.definitions.map(() => HashMap.empty<Button.InputButton, Progress>()));
        const entries = Object.freeze(previous.map((buttons: ButtonProgress, registration: number) =>
        {
            const definition = state.definitions[registration];
            if (!definition.buttons.includes(edge.button))
            {
                return buttons;
            }

            const progress = Option.getOrElse(HashMap.get(buttons, edge.button), idle);
            return HashMap.set(buttons, edge.button,
                observe(definition, registration, progress, edge, events));
        }));
        return finish({ ...observed.state,
            players: HashMap.set(observed.state.players, edge.playerId, entries) }, events);
    }));
};

/**
 * Discards selected players without advancing thresholds or fabricating physical release events.
 *
 * @category Filtering
 * @since 2.11.0
 */
const cancel = (state: State, options: Reset, playerId: Option.Option<string>): Transition =>
{
    const events: Array<Event> = [];
    let players = state.players;
    for (const [ id, entries ] of state.players)
    {
        if (Option.isSome(playerId) && id !== playerId.value)
        {
            continue;
        }

        entries.forEach((buttons: ButtonProgress, registration: number) =>
        {
            const definition = state.definitions[registration];
            for (const [ button, progress ] of buttons)
            {
                if (progress.holding && Button.isHold(definition.kind))
                {
                    emit(events, definition, {
                        ...metadata(definition, registration, id, button, progress, options.tick),
                        kind: definition.kind,
                        phase: "End",
                        reason: options.reason ?? "Reset" });
                }
            }
        });
        players = HashMap.remove(players, id);
    }

    return finish({ ...state,
        players,
        tick: options.tick }, events);
};

/**
 * Cancels one player's holds and pending input while preserving other players' progress.
 *
 * @category Filtering
 * @since 2.11.0
 */
export const resetPlayer = (
    state: State,
    options: PlayerReset
): Result.Result<Transition, TimeError> =>
{
    return pipe(time(state, options.tick),
        Result.map(() => cancel(state, options, Option.some(options.playerId))));
};

/**
 * Cancels all active holds and clears every pending sequence without completing taps.
 *
 * @category Filtering
 * @since 2.11.0
 */
export const reset = (state: State, options: Reset): Result.Result<Transition, TimeError> =>
{
    return pipe(time(state, options.tick), Result.map(() => cancel(state, options, Option.none())));
};
