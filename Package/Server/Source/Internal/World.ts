/**
 * Lazy native World forwarding, shared raw-vector movement sampling, and derived gesture signals.
 *
 * @module @bedform/server/Internal/World
 * @internal
 *
 * @file      World.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as HashMap from "@bedform/effect/HashMap";
import * as Recognizer from "./ButtonRecognizer.js";
import * as Result from "@bedform/effect/Result";
import type {
    ButtonState,
    EntityDieAfterEvent,
    PlayerButtonInputAfterEvent as NativeEvent,
    World as NativeWorld,
    Player,
    PlayerDimensionChangeAfterEvent,
    PlayerLeaveAfterEvent,
    PlayerSpawnAfterEvent,
    System,
    Vector2
} from "@minecraft/server";
import type {
    GestureKind,
    HoldCancellationReason,
    InputButton,
    InputCallback,
    InputEventOptions,
    MovementButton,
    PlayerButtonInputAfterEvent,
    World,
    WorldAfterEvents
} from "./WorldTypes.js";
import { InputButton as Control } from "./ButtonInput.js";
import type { Registration } from "./ButtonInput.js";

/**
 * Shared per-axis cutoff; exactly this magnitude remains inactive.
 *
 * @category Constant
 * @since 2.11.0
 */
const MovementDeadZone = 0.2;

/**
 * Stable traversal order for independent cardinal and diagonal transitions.
 *
 * @category Constant
 * @since 2.11.0
 */
const MovementButtons: ReadonlyArray<MovementButton> = Object.freeze([
    Control.Forward, Control.Backward, Control.Left, Control.Right,
    Control.ForwardLeft, Control.ForwardRight, Control.BackwardLeft, Control.BackwardRight
]);

/**
 * Controls the private recognizer accepts, used to select native buttons that feed gestures.
 *
 * @category Constant
 * @since 2.11.0
 */
const RecognizedButtons: ReadonlyArray<string> = Object.freeze(Object.values(Control));

/**
 * Entity type whose deaths cancel gesture progress.
 *
 * @category Constant
 * @since 2.11.0
 */
const PlayerType = "minecraft:player" as const;

/**
 * Derived after-event signal names and the recognition family each one exposes.
 *
 * @category Constant
 * @since 2.11.0
 */
const GestureSignals: ReadonlyArray<readonly [ string, GestureKind ]> = Object.freeze([
    [ "playerButtonDown", "Down" ],
    [ "playerButtonUp", "Up" ],
    [ "playerButtonPress", "Press" ],
    [ "playerButtonHold", "Hold" ],
    [ "playerButtonNTap", "NTap" ],
    [ "playerButtonPressAndHold", "PressAndHold" ],
    [ "playerButtonNTapAndHold", "NTapAndHold" ]
] as const);

/**
 * Injected native services and enum values, allowing host verification without native imports.
 *
 * @category Interface
 * @since 2.11.0
 */
export interface Host
{
    readonly world: NativeWorld;
    readonly system: Pick<System, "currentTick" | "runInterval" | "clearRun">;
    readonly buttons: Readonly<Record<string, InputButton>>;
    readonly states: Readonly<Record<"Pressed" | "Released", ButtonState>>;
    readonly onError?: (cause: unknown) => void;
}

/**
 * Structural native signal contract; cleanup uses the exact callback returned by subscribe.
 *
 * @category Interface
 * @since 2.11.0
 */
interface Signal<A, OptionsType>
{
    subscribe(callback: (event: A) => void, options?: OptionsType): (event: A) => void;
    unsubscribe(callback: (event: A) => void): void;
}

/**
 * One callback's immutable selection, independent of later option mutations.
 *
 * @category Model
 * @since 2.11.0
 */
interface Listener
{
    readonly callback: InputCallback;
    readonly buttons?: ReadonlyArray<InputButton>;
    readonly state?: ButtonState;
}

/**
 * One derived-signal subscription with its own recognizer, so it never inherits earlier presses.
 *
 * @category Model
 * @since 2.11.0
 */
interface Gesture
{
    readonly kind: GestureKind;
    readonly callback: (event: unknown) => void;
    readonly buttons: ReadonlyArray<string>;
    state: Recognizer.State;
}

/**
 * Previously sampled movement states and acquired native resources of one active generation.
 *
 * @category Model
 * @since 2.11.0
 */
interface Session
{
    active: boolean;
    lastTick?: number;
    readonly cleanup: Array<() => void>;
    readonly players: Map<string, Readonly<Vector2>>;
}

/**
 * A native method and its stable bound identity for the current property value.
 *
 * @category Model
 * @since 2.11.0
 */
interface Method
{
    readonly original: unknown;
    readonly bound: unknown;
    readonly receiver: object;
}

/**
 * Creates a receiver-safe forwarding object without reading or copying native properties eagerly.
 * An empty proxy target permits replacing non-configurable native properties without violating proxy rules.
 * Overrides absent from the native object are reported as additional read-only own properties.
 *
 * @category Factory
 * @since 2.11.0
 */
const forward = <A extends object>(
    source: () => object,
    overrides: ReadonlyMap<PropertyKey, () => unknown>
): A =>
{
    const methods = new Map<PropertyKey, Method>();

    /**
     * Reads a live native value, binding only methods and preserving stable function identity.
     *
     * @category Getter
     * @since 2.11.0
     */
    const get = (key: PropertyKey): unknown =>
    {
        const override = overrides.get(key);
        if (override)
        {
            return override();
        }

        const native = source();
        const value = Reflect.get(native, key, native);
        if (typeof value !== "function" || key === "constructor")
        {
            return value;
        }

        const previous = methods.get(key);
        if (previous && previous.original === value && previous.receiver === native)
        {
            return previous.bound;
        }

        const bound = value.bind(native);
        methods.set(key, { bound,
            original: value,
            receiver: native });
        return bound;
    };

    /**
     * Lists overrides that the native object does not provide itself.
     *
     * @category Getter
     * @since 2.11.0
     */
    const added = (native: object): Array<PropertyKey> =>
    {
        return [ ...overrides.keys() ].filter((key: PropertyKey) => !Reflect.has(native, key));
    };

    return new Proxy({}, {
        defineProperty: (_target: object, key: PropertyKey, descriptor: PropertyDescriptor): boolean =>
            !overrides.has(key) && Reflect.defineProperty(source(), key, descriptor),
        deleteProperty: (_target: object, key: PropertyKey): boolean =>
            !overrides.has(key) && Reflect.deleteProperty(source(), key),
        get: (_target: object, key: PropertyKey): unknown => get(key),
        getOwnPropertyDescriptor: (_target: object, key: PropertyKey): PropertyDescriptor | undefined =>
        {
            const native = source();
            const descriptor = Reflect.getOwnPropertyDescriptor(native, key);
            if (!descriptor)
            {
                return added(native).includes(key) ? { configurable: true,
                    enumerable: true,
                    value: get(key),
                    writable: false } : undefined;
            }

            return "value" in descriptor ? { ...descriptor,
                configurable: true,
                value: get(key) } : { ...descriptor,
                configurable: true,
                get: (): unknown => get(key),
                set: descriptor.set?.bind(native) };
        },
        getPrototypeOf: (): object | null => Reflect.getPrototypeOf(source()),
        has: (_target: object, key: PropertyKey): boolean => overrides.has(key) || Reflect.has(source(), key),
        ownKeys: (): Array<string | symbol> =>
        {
            const native = source();
            return [ ...Reflect.ownKeys(native), ...added(native) as Array<string | symbol> ];
        },
        preventExtensions: (): boolean => false,
        set: (_target: object, key: PropertyKey, value: unknown): boolean =>
            !overrides.has(key) && Reflect.set(source(), key, value, source())
    }) as A;
};

/**
 * Converts raw vector signs into component directions and their overlapping diagonal.
 *
 * @category Converting
 * @since 2.11.0
 */
const movement = (vector: Readonly<Vector2>): ReadonlySet<MovementButton> =>
{
    const forward = vector.y > MovementDeadZone;
    const backward = vector.y < -MovementDeadZone;
    const left = vector.x > MovementDeadZone;
    const right = vector.x < -MovementDeadZone;
    const buttons = new Set<MovementButton>();
    if (forward)
    {
        buttons.add(Control.Forward);
    }

    if (backward)
    {
        buttons.add(Control.Backward);
    }

    if (left)
    {
        buttons.add(Control.Left);
    }

    if (right)
    {
        buttons.add(Control.Right);
    }

    if (forward && left)
    {
        buttons.add(Control.ForwardLeft);
    }

    if (forward && right)
    {
        buttons.add(Control.ForwardRight);
    }

    if (backward && left)
    {
        buttons.add(Control.BackwardLeft);
    }

    if (backward && right)
    {
        buttons.add(Control.BackwardRight);
    }

    return buttons;
};

/**
 * Converts a private recognizer event into the frozen public payload.
 *
 * @category Converting
 * @since 2.11.0
 */
const payload = (event: Recognizer.Event, player: Player | undefined): object =>
{
    const data = { button: event.button,
        duration: event.duration,
        player,
        playerId: event.playerId,
        tapCount: event.tapCount,
        tick: event.tick };
    if (!("phase" in event))
    {
        return Object.freeze(data);
    }

    return Object.freeze(event.phase === "End" ? { ...data,
        phase: event.phase,
        reason: event.reason ?? "Release" } : { ...data,
        phase: event.phase });
};

/**
 * Creates an inert facade; the first subscriber to any input signal acquires one native button listener,
 * the lifecycle listeners, and one interval, all released after the final un-subscription.
 * Movement baselines are read on the first writable tick, so subscription may occur during early execution.
 *
 * @category Factory
 * @since 2.11.0
 */
export const makeWorld = (host: Host): World =>
{
    const listeners = new Map<InputCallback, Listener>();
    const gestures = new Map<GestureKind, Map<unknown, Gesture>>(GestureSignals.map(
        ([ , kind ]: readonly [ string, GestureKind ]) => [ kind, new Map() ]));
    const order = new Set<Gesture>();
    let session: Session | undefined;

    /**
     * Reports failures without allowing a listener or custom reporter to interrupt sampling.
     *
     * @category ErrorHandling
     * @since 2.11.0
     */
    const report = (cause: unknown): void =>
    {
        try
        {
            if (host.onError)
            {
                host.onError(cause);
            }
            else
            {
                console.error(cause);
            }
        }
        catch
        {
            console.error(cause);
        }
    };

    /**
     * Determines whether a resource generation is still the current one.
     *
     * @category Guard
     * @since 2.11.0
     */
    const live = (current: Session): boolean =>
    {
        return current.active && session === current;
    };

    /**
     * Determines whether a gesture subscription has not been removed or replaced.
     *
     * @category Guard
     * @since 2.11.0
     */
    const registered = (gesture: Gesture): boolean =>
    {
        return gestures.get(gesture.kind)?.get(gesture.callback) === gesture;
    };

    /**
     * Dispatches a snapshot of matching listeners and honors removal during another callback.
     *
     * @category Running
     * @since 2.11.0
     */
    const dispatch = (current: Session, event: PlayerButtonInputAfterEvent): void =>
    {
        for (const listener of [ ...listeners.values() ])
        {
            if (!live(current))
            {
                break;
            }

            if (listeners.get(listener.callback) !== listener ||
                listener.buttons !== undefined && !listener.buttons.includes(event.button) ||
                listener.state !== undefined && listener.state !== event.newButtonState)
            {
                continue;
            }

            try
            {
                listener.callback(event);
            }
            catch (cause)
            {
                report(cause);
            }
        }
    };

    /**
     * Resolves listed, valid players by ID, reading the native list at most once per dispatch round.
     *
     * @category Getter
     * @since 2.11.0
     */
    const lookup = (
        known: ReadonlyMap<string, Player> = new Map()
    ): (playerId: string) => Player | undefined =>
    {
        let listed: Map<string, Player> | undefined;
        return (playerId: string): Player | undefined =>
        {
            const player = known.get(playerId);
            if (player)
            {
                return player;
            }

            if (!listed)
            {
                listed = new Map();
                try
                {
                    for (const candidate of host.world.getAllPlayers())
                    {
                        if (candidate.isValid !== false)
                        {
                            listed.set(candidate.id, candidate);
                        }
                    }
                }
                catch (cause)
                {
                    report(cause);
                }
            }

            return listed.get(playerId);
        };
    };

    /**
     * Commits one subscription's transition before delivering its events in order.
     * Normal events require a resolvable player; cancelled hold ends may report none.
     *
     * @category Running
     * @since 2.11.0
     */
    const deliver = (
        current: Session,
        gesture: Gesture,
        result: Result.Result<Recognizer.Transition, Recognizer.TimeError>,
        resolve: (playerId: string) => Player | undefined
    ): void =>
    {
        if (Result.isFailure(result))
        {
            report(result.failure);
            return;
        }

        gesture.state = result.success.state;
        for (const event of result.success.events)
        {
            if (!live(current) || !registered(gesture))
            {
                return;
            }

            const cancelled = "reason" in event && event.reason !== undefined && event.reason !== "Release";
            const player = cancelled && event.reason === "Leave" ? undefined : resolve(event.playerId);
            if (!player && !cancelled)
            {
                continue;
            }

            try
            {
                gesture.callback(payload(event, player));
            }
            catch (cause)
            {
                report(cause);
            }
        }
    };

    /**
     * Feeds one observed transition to a snapshot of gesture subscriptions selecting its button.
     *
     * @category Running
     * @since 2.11.0
     */
    const feed = (
        current: Session,
        edge: Recognizer.Input,
        resolve: (playerId: string) => Player | undefined
    ): void =>
    {
        for (const gesture of [ ...order ])
        {
            if (!live(current))
            {
                return;
            }

            if (registered(gesture) && gesture.buttons.includes(edge.button))
            {
                deliver(current, gesture, Recognizer.input(gesture.state, edge), resolve);
            }
        }
    };

    /**
     * Cancels one player's holds and pending sequences in every gesture subscription.
     *
     * @category Running
     * @since 2.11.0
     */
    const cancel = (
        current: Session,
        playerId: string,
        reason: HoldCancellationReason,
        resolve: (playerId: string) => Player | undefined = lookup()
    ): void =>
    {
        const tick = host.system.currentTick;
        for (const gesture of [ ...order ])
        {
            if (!live(current))
            {
                return;
            }

            if (registered(gesture) && HashMap.has(gesture.state.players, playerId))
            {
                deliver(current, gesture, Recognizer.resetPlayer(gesture.state, { playerId,
                    reason,
                    tick }), resolve);
            }
        }
    };

    /**
     * Releases one resource generation in reverse acquisition order, attempting every cleanup.
     * A replacement generation started by a callback is left untouched.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const stop = (current: Session): void =>
    {
        current.active = false;
        if (session === current)
        {
            session = undefined;
        }

        for (const dispose of current.cleanup.splice(0).reverse())
        {
            try
            {
                dispose();
            }
            catch (cause)
            {
                report(cause);
            }
        }

        current.players.clear();
    };

    /**
     * Forwards a native Jump or Sneak transition to input listeners and gesture recognition.
     *
     * @category Running
     * @since 2.11.0
     */
    const button = (current: Session, event: NativeEvent): void =>
    {
        dispatch(current, event);
        if (!live(current) || !RecognizedButtons.includes(event.button))
        {
            return;
        }

        const player = event.player;
        feed(current, { button: event.button as Recognizer.Input["button"],
            playerId: player.id,
            pressed: event.newButtonState === host.states.Pressed,
            tick: host.system.currentTick }, lookup(new Map([ [ player.id, player ] ])));
    };

    /**
     * Advances every gesture subscription once per observed tick, first cancelling players no longer listed.
     *
     * @category Running
     * @since 2.11.0
     */
    const advance = (current: Session, tick: number, present: Map<string, Player>): void =>
    {
        const resolve = (playerId: string): Player | undefined => present.get(playerId);
        for (const gesture of [ ...order ])
        {
            if (!live(current))
            {
                return;
            }

            if (!registered(gesture))
            {
                continue;
            }

            for (const playerId of [ ...HashMap.keys(gesture.state.players) ])
            {
                if (!present.has(playerId) && live(current) && registered(gesture))
                {
                    deliver(current, gesture, Recognizer.resetPlayer(gesture.state, { playerId,
                        reason: "UnavailableInput",
                        tick }), resolve);
                }
            }

            if (live(current) && registered(gesture) && HashMap.size(gesture.state.players) > 0)
            {
                deliver(current, gesture, Recognizer.advance(gesture.state, tick), resolve);
            }
        }
    };

    /**
     * Samples each present player once per observed tick, committing vectors before dispatching edges,
     * then advances gesture holds and gaps. Read failures discard the baseline and cancel gesture
     * progress rather than fabricating a physical release.
     *
     * @category Running
     * @since 2.11.0
     */
    const sample = (current: Session): void =>
    {
        if (!live(current))
        {
            return;
        }

        try
        {
            const tick = host.system.currentTick;
            if (tick === current.lastTick)
            {
                return;
            }

            current.lastTick = tick;
            const present = new Map<string, Player>();
            const resolve = lookup(present);
            for (const player of host.world.getAllPlayers())
            {
                if (!live(current))
                {
                    return;
                }

                let playerId: string | undefined;
                try
                {
                    playerId = player.id;
                    if (present.has(playerId))
                    {
                        continue;
                    }

                    present.set(playerId, player);
                    const raw = player.inputInfo.getMovementVector();
                    const vector = { x: raw.x,
                        y: raw.y };
                    if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y))
                    {
                        throw new Error("Player movement input must contain finite vector components.");
                    }

                    const previousVector = current.players.get(playerId);
                    current.players.set(playerId, vector);
                    if (!previousVector)
                    {
                        continue;
                    }

                    const buttons = movement(vector);
                    const previous = movement(previousVector);

                    for (const control of MovementButtons)
                    {
                        if (!live(current))
                        {
                            return;
                        }

                        const pressed = buttons.has(control);
                        if (previous.has(control) !== pressed)
                        {
                            dispatch(current, Object.freeze({ button: control,
                                newButtonState: pressed ? host.states.Pressed : host.states.Released,
                                player }));
                            feed(current, { button: control,
                                playerId,
                                pressed,
                                tick }, resolve);
                        }
                    }
                }
                catch (cause)
                {
                    report(cause);
                    if (playerId !== undefined)
                    {
                        current.players.delete(playerId);
                        cancel(current, playerId, "UnavailableInput", resolve);
                    }
                }
            }

            for (const playerId of current.players.keys())
            {
                if (!present.has(playerId))
                {
                    current.players.delete(playerId);
                }
            }

            advance(current, tick, present);
        }
        catch (cause)
        {
            current.players.clear();
            report(cause);
        }
    };

    /**
     * Subscribes one native signal for the current generation, isolating its handler failures.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const acquire = <A, OptionsType>(
        current: Session,
        signal: Signal<A, OptionsType>,
        handler: (event: A) => void,
        options?: OptionsType
    ): void =>
    {
        const callback = (event: A): void =>
        {
            if (!live(current))
            {
                return;
            }

            try
            {
                handler(event);
            }
            catch (cause)
            {
                report(cause);
            }
        };

        // Native bindings reject surplus arguments, even undefined, on signals without options.
        const subscribed = options === undefined ? signal.subscribe(callback) :
            signal.subscribe(callback, options);
        current.cleanup.push(() => signal.unsubscribe(subscribed));
    };

    /**
     * Installs shared resources with rollback, including reentrant removal during native startup.
     *
     * @throws { Error } When a native subscription or interval cannot be acquired.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const start = (): void =>
    {
        const current: Session = { active: true,
            cleanup: [],
            players: new Map() };
        session = current;
        try
        {
            const events = host.world.afterEvents;
            const steps: ReadonlyArray<() => void> = [
                (): void => acquire(current, events.playerButtonInput, (event: NativeEvent) =>
                    button(current, event)),
                (): void => acquire(current, events.playerLeave, (event: PlayerLeaveAfterEvent) =>
                    cancel(current, event.playerId, "Leave")),
                (): void => acquire(current, events.playerSpawn, (event: PlayerSpawnAfterEvent) =>
                    cancel(current, event.player.id, "Spawn")),
                (): void => acquire(current, events.playerDimensionChange,
                    (event: PlayerDimensionChangeAfterEvent) =>
                        cancel(current, event.player.id, "DimensionChange")),
                (): void => acquire(current, events.entityDie,
                    (event: EntityDieAfterEvent) =>
                    {
                        if (event.deadEntity.typeId === PlayerType)
                        {
                            cancel(current, event.deadEntity.id, "Death");
                        }
                    }, { entityTypes: [ PlayerType ] }),
                (): void =>
                {
                    const interval = host.system.runInterval(() => sample(current), 1);
                    current.cleanup.push(() => host.system.clearRun(interval));
                }
            ];
            for (const step of steps)
            {
                step();
                if (!current.active)
                {
                    stop(current);
                    return;
                }
            }
        }
        catch (cause)
        {
            stop(current);
            throw cause;
        }
    };

    /**
     * Counts subscriptions across every input signal sharing the native resources.
     *
     * @category Getter
     * @since 2.11.0
     */
    const count = (): number =>
    {
        return listeners.size + order.size;
    };

    /**
     * Starts shared resources for a newly stored subscription, removing it again if startup fails.
     *
     * @throws { Error } When a native subscription or interval cannot be acquired.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const ensure = (rollback: () => void): void =>
    {
        if (session)
        {
            return;
        }

        try
        {
            start();
        }
        catch (cause)
        {
            rollback();
            throw cause;
        }
    };

    /**
     * Releases shared resources once no subscription of any input signal remains.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const release = (): void =>
    {
        if (count() === 0 && session)
        {
            stop(session);
        }
    };

    /**
     * Copies button/state filters, returning the same callback identity as the native API.
     * Repeated subscription of one callback replaces its filters without adding another sampler.
     *
     * @throws { TypeError } When filters contain unsupported buttons or states.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const subscribe = <Selected extends InputButton = InputButton>(
        callback: InputCallback<NoInfer<Selected>>,
        options: InputEventOptions<Selected> = { }
    ): InputCallback<Selected> =>
    {
        if (typeof callback !== "function" || options.buttons !== undefined &&
            (!Array.isArray(options.buttons) || !Array.from(options.buttons).every((button: Selected) =>
                Object.values(host.buttons).includes(button))) ||
            options.state !== undefined && !Object.values(host.states).includes(options.state))
        {
            throw new TypeError("Input subscriptions require a callback and supported button/state filters.");
        }

        const key = callback as InputCallback;
        const listener: Listener = Object.freeze({ buttons: options.buttons === undefined ? undefined :
            Object.freeze([ ...options.buttons ]),
        callback: key,
        state: options.state });
        listeners.set(key, listener);
        ensure(() =>
        {
            if (listeners.get(key) === listener)
            {
                listeners.delete(key);
            }
        });
        return callback;
    };

    /**
     * Removes one observer and releases shared resources after the final listener leaves.
     *
     * @category ResourceManagement
     * @since 2.11.0
     */
    const unsubscribe = <Selected extends InputButton>(callback: InputCallback<Selected>): void =>
    {
        listeners.delete(callback as InputCallback);
        release();
    };

    /**
     * Creates one derived signal whose subscriptions each own independent recognizer progress.
     *
     * @category Factory
     * @since 2.11.0
     */
    const gestureSignal = (kind: GestureKind): object =>
    {
        const entries = gestures.get(kind)!;

        /**
         * Validates and copies options, replacing an earlier subscription of the same callback
         * with fresh progress, and returns the callback for later un-subscription.
         *
         * @throws { TypeError } When the callback or any option is unsupported.
         *
         * @category ResourceManagement
         * @since 2.11.0
         */
        const subscribeGesture = (callback: (event: unknown) => void, options?: unknown): unknown =>
        {
            if (typeof callback !== "function" ||
                options !== undefined && (typeof options !== "object" || options === null))
            {
                throw new TypeError("Input subscriptions require a callback and an options object.");
            }

            const selected = (options ?? {}) as Partial<Record<string, unknown>>;
            const registration = { buttons: selected.buttons,
                count: selected.count,
                holdTicks: selected.holdTicks,
                kind,
                maxGapTicks: selected.maxGapTicks,
                maxPressTicks: selected.maxPressTicks,
                phase: selected.phase } as Registration;
            const made = Recognizer.make([ registration ]);
            if (Result.isFailure(made))
            {
                throw new TypeError(made.failure.message);
            }

            const gesture: Gesture = { buttons: made.success.definitions[0].buttons,
                callback,
                kind,
                state: made.success };
            const previous = entries.get(callback);
            if (previous)
            {
                order.delete(previous);
            }

            entries.set(callback, gesture);
            order.add(gesture);
            ensure(() =>
            {
                if (entries.get(callback) === gesture)
                {
                    entries.delete(callback);
                    order.delete(gesture);
                }
            });
            return callback;
        };

        /**
         * Removes one subscription, discarding its progress without notification.
         *
         * @category ResourceManagement
         * @since 2.11.0
         */
        const unsubscribeGesture = (callback: unknown): void =>
        {
            const gesture = entries.get(callback);
            if (gesture)
            {
                entries.delete(callback);
                order.delete(gesture);
            }

            release();
        };

        return Object.freeze({ subscribe: subscribeGesture,
            unsubscribe: unsubscribeGesture });
    };

    const signal = Object.freeze({ subscribe,
        unsubscribe });
    const overrides = new Map<PropertyKey, () => unknown>([ [ "playerButtonInput", (): unknown => signal ] ]);
    for (const [ name, kind ] of GestureSignals)
    {
        const derived = gestureSignal(kind);
        overrides.set(name, (): unknown => derived);
    }

    const afterEvents = forward<WorldAfterEvents>(() => host.world.afterEvents, overrides);
    return forward<World>(() => host.world, new Map([ [ "afterEvents", (): unknown => afterEvents ] ]));
};
