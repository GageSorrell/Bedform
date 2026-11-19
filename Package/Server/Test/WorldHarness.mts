/**
 * Shared mock Bedrock host for World facade, movement sampling, and derived gesture signal tests.
 *
 * @module @bedform/server/Test/WorldHarness
 *
 * @file      WorldHarness.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ButtonState, EntityDieAfterEvent, InputButton as NativeButton,
    PlayerButtonInputAfterEvent as NativeEvent, World as NativeWorld, Player,
    PlayerDimensionChangeAfterEvent, PlayerLeaveAfterEvent, PlayerSpawnAfterEvent,
    Vector2 } from "@minecraft/server";
import Assert from "node:assert/strict";
import type { Host } from "../Source/Internal/World.js";
import { InputButton } from "../Source/Internal/ButtonInput.js";
import type { World } from "../Source/Internal/WorldTypes.js";
import { makeWorld } from "../Source/Internal/World.js";

/**
 * Enum values supplied by the native host, without loading its runtime in Node.
 *
 * @category Constant
 * @since 2.11.0
 */
export const States = Object.freeze({ Pressed: "Pressed" as ButtonState.Pressed,
    Released: "Released" as ButtonState.Released });

/**
 * A native-style signal that deliberately returns a wrapped callback for cleanup verification.
 *
 * @category Testing
 * @since 2.11.0
 */
export class Signal<A = NativeEvent>
{
    readonly callbacks: Set<(event: A) => void> = new Set();
    readonly options: Array<unknown> = [];
    readonly acceptsOptions: boolean;
    subscribed: number = 0;
    unsubscribed: number = 0;
    failSubscribe: boolean = false;

    /**
     * Native signals without an options parameter reject any second argument, even undefined.
     *
     * @category Testing
     * @since 2.11.0
     */
    constructor(acceptsOptions: boolean = true)
    {
        this.acceptsOptions = acceptsOptions;
    }

    subscribe(callback: (event: A) => void, ...options: Array<unknown>): (event: A) => void
    {
        this.subscribed++;
        if (this.failSubscribe)
        {
            throw new Error("native subscribe failed");
        }

        if (!this.acceptsOptions && options.length > 0)
        {
            throw new TypeError(`Incorrect number of arguments to function. Expected 1, received ${
                options.length + 1}`);
        }

        this.options.push(options[0]);
        const wrapped = (event: A): void => callback(event);
        this.callbacks.add(wrapped);
        return wrapped;
    }

    unsubscribe(callback: (event: A) => void): void
    {
        Assert.ok(this.callbacks.delete(callback), "Unsubscribe must use the native returned callback");
        this.unsubscribed++;
    }

    emit(event: A): void
    {
        for (const callback of [ ...this.callbacks ])
        {
            callback(event);
        }
    }
}

/**
 * One movable player's input source with observable reads and temporary read failures.
 *
 * @category Testing
 * @since 2.11.0
 */
export class MovementPlayer
{
    readonly id: string;
    vector: Vector2 = { x: 0,
        y: 0 };
    reads: number = 0;
    failRead: boolean = false;
    readonly player: Player;

    constructor(id: string)
    {
        this.id = id;
        this.player = { id: this.id,
            inputInfo: { getMovementVector: (): Vector2 => this.getMovementVector() } } as Player;
    }

    getMovementVector(): Vector2
    {
        this.reads++;
        if (this.failRead)
        {
            throw new Error("input unavailable");
        }

        return this.vector;
    }

    native(): Player
    {
        return this.player;
    }
}

/**
 * Native after-events: button input, the lifecycle signals that cancel gestures, and an unrelated signal.
 *
 * @category Testing
 * @since 2.11.0
 */
export class AfterEvents
{
    readonly playerButtonInput: Signal = new Signal();
    readonly playerLeave: Signal<PlayerLeaveAfterEvent> = new Signal(false);
    readonly playerSpawn: Signal<PlayerSpawnAfterEvent> = new Signal(false);
    readonly playerDimensionChange: Signal<PlayerDimensionChangeAfterEvent> = new Signal(false);
    readonly entityDie: Signal<EntityDieAfterEvent> = new Signal();

    readonly weatherChange: Readonly<Record<"marker", string>> = Object.freeze({ marker: "native signal" });

    /**
     * Lists every native signal the shared session acquires.
     *
     * @category Testing
     * @since 2.11.0
     */
    acquired(): ReadonlyArray<Signal<never>>
    {
        return [ this.playerButtonInput, this.playerLeave, this.playerSpawn, this.playerDimensionChange,
            this.entityDie ] as unknown as ReadonlyArray<Signal<never>>;
    }
}

/**
 * Native object with prototype accessors and a branded method that rejects the wrong receiver.
 *
 * @category Testing
 * @since 2.11.0
 */
export class NativeFixture
{
    readonly afterEvents: AfterEvents = new AfterEvents();
    readonly beforeEvents: Readonly<Record<"marker", string>> = Object.freeze({ marker: "before" });
    readonly players: Array<Player> = [];
    #value: number = 1;

    get value(): number
    {
        return this.#value;
    }

    set value(value: number)
    {
        this.#value = value;
    }

    getAllPlayers(): Array<Player>
    {
        return this.players;
    }

    getDay(): number
    {
        return this.#value;
    }
}

/**
 * Native fixture augmented with controllable ticks, scheduling failures, and captured diagnostics.
 *
 * @category Testing
 * @since 2.11.0
 */
export class Harness
{
    readonly native: NativeFixture = new NativeFixture();
    readonly intervals: Map<number, () => void> = new Map();
    readonly errors: Array<unknown> = [];
    tick: number = 0;
    schedules: number = 0;
    cleared: number = 0;
    failSchedule: boolean = false;
    readonly world: World;

    constructor()
    {
        this.world = makeWorld(this.host());
    }

    host(): Host
    {
        const currentTick = (): number => this.tick;
        return { buttons: InputButton as Host["buttons"],
            onError: (cause: unknown): void => { this.errors.push(cause); },
            states: States,
            system: {
                clearRun: (id: number): void =>
                {
                    Assert.ok(this.intervals.delete(id));
                    this.cleared++;
                },
                get currentTick(): number { return currentTick(); },
                runInterval: (callback: () => void, ticks?: number): number =>
                {
                    Assert.equal(ticks, 1);
                    this.schedules++;
                    if (this.failSchedule)
                    {
                        throw new Error("interval failed");
                    }

                    this.intervals.set(this.schedules, callback);
                    return this.schedules;
                }
            },
            world: this.native as unknown as NativeWorld };
    }

    /**
     * Advances the clock by one tick and runs every scheduled interval.
     *
     * @category Testing
     * @since 2.11.0
     */
    advance(ticks: number = 1): void
    {
        for (let index = 0; index < ticks; index++)
        {
            this.tick++;
            for (const callback of [ ...this.intervals.values() ])
            {
                callback();
            }
        }
    }

    /**
     * Emits a native Jump or Sneak transition at the current tick.
     *
     * @category Testing
     * @since 2.11.0
     */
    button(player: MovementPlayer, button: "Jump" | "Sneak", pressed: boolean): void
    {
        this.native.afterEvents.playerButtonInput.emit({ button: button as NativeButton,
            newButtonState: pressed ? States.Pressed : States.Released,
            player: player.native() });
    }

    /**
     * Emits the native lifecycle signal corresponding to a gesture cancellation reason.
     *
     * @category Testing
     * @since 2.11.0
     */
    lifecycle(player: MovementPlayer, reason: "Leave" | "Spawn" | "DimensionChange" | "Death"): void
    {
        const events = this.native.afterEvents;
        switch (reason)
        {
            case "Leave":
                events.playerLeave.emit({ playerId: player.id,
                    playerName: player.id } as PlayerLeaveAfterEvent);
                break;
            case "Spawn":
                events.playerSpawn.emit({ initialSpawn: false,
                    player: player.native() } as PlayerSpawnAfterEvent);
                break;
            case "DimensionChange":
                events.playerDimensionChange.emit({
                    player: player.native() } as PlayerDimensionChangeAfterEvent);
                break;
            case "Death":
                events.entityDie.emit({ deadEntity: { id: player.id,
                    typeId: "minecraft:player" } } as EntityDieAfterEvent);
                break;
        }
    }

    player(id: string = "a"): MovementPlayer
    {
        const input = new MovementPlayer(id);
        this.native.players.push(input.native());
        return input;
    }

    /**
     * Counts native callbacks currently held by the shared session across every acquired signal.
     *
     * @category Testing
     * @since 2.11.0
     */
    held(): number
    {
        return this.native.afterEvents.acquired().reduce((total: number, signal: Signal<never>) =>
            total + signal.callbacks.size, 0) + this.intervals.size;
    }
}
