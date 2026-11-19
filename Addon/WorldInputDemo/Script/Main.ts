/**
 * Live demonstration of @bedform/server derived button signals with an on-screen input monitor.
 *
 * @module @sorrell/world-input-demo/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { ChatMode, Shown } from "./Format.js";
import type { EntityDieAfterEvent, Player, PlayerDimensionChangeAfterEvent, PlayerLeaveAfterEvent,
    PlayerSpawnAfterEvent, ScriptEventCommandMessageAfterEvent } from "@minecraft/server";
import { LogPrefix, ReadyMarker, ScriptEvent, TickingArea } from "./Keys.js";
import type { PlayerButtonGestureAfterEvent, PlayerButtonHoldAfterEvent } from "@bedform/server";
import { axis, chats, describe, held, parseChatMode } from "./Format.js";
import { system } from "@minecraft/server";
import { world } from "@bedform/server";

/**
 * One player's on-screen monitor state.
 *
 * @category Model
 * @since 1.0.0
 */
interface Monitor
{
    readonly active: Set<string>;
    last: string;
    hold: string;
}

/**
 * Monitor state by player ID; entries are discarded when a player leaves.
 *
 * @category Instance
 * @since 1.0.0
 */
const Monitors = new Map<string, Monitor>();

/**
 * Current chat echo mode, shared by every player.
 *
 * @category Instance
 * @since 1.0.0
 */
let Chat: ChatMode = "all";

/**
 * Returns a player's monitor, creating an empty one on first use.
 *
 * @category Getter
 * @since 1.0.0
 */
function monitor(playerId: string): Monitor
{
    let state = Monitors.get(playerId);
    if (!state)
    {
        state = { active: new Set(),
            hold: "",
            last: "-" };
        Monitors.set(playerId, state);
    }

    return state;
}

/**
 * Records one event on the console and, when the chat mode selects it, in the player's chat.
 *
 * @category Running
 * @since 1.0.0
 */
function report(signal: string, event: Shown, player: Player | undefined): void
{
    const text = describe(signal, event);
    console.warn(`${LogPrefix} ${event.playerId} ${text}`);
    if (player && chats(Chat, event.button))
    {
        player.sendMessage(`§e${signal}§r ${text.slice(signal.length + 1)}`);
    }
}

/**
 * Creates a hold-family observer: Start and End are reported; Tick only refreshes the live duration.
 *
 * @category Factory
 * @since 1.0.0
 */
function holds(signal: string): (event: PlayerButtonHoldAfterEvent) => void
{
    return (event: PlayerButtonHoldAfterEvent): void =>
    {
        const state = monitor(event.playerId);
        state.hold = event.phase === "End" ? "" : `${signal} ${event.button} ${event.duration}t`;
        if (event.phase !== "Tick")
        {
            report(signal, event, event.player);
        }
    };
}

/**
 * Creates a short-press observer reported under the given signal label.
 *
 * @category Factory
 * @since 1.0.0
 */
function presses(signal: string): (event: PlayerButtonGestureAfterEvent) => void
{
    return (event: PlayerButtonGestureAfterEvent): void => report(signal, event, event.player);
}

/**
 * Clears held-button display after a lifecycle boundary, which also discards unfinished presses.
 *
 * @category Running
 * @since 1.0.0
 */
function forget(playerId: string): void
{
    const state = Monitors.get(playerId);
    if (state)
    {
        state.active.clear();
        state.hold = "";
    }
}

const signals = world.afterEvents;
signals.playerButtonDown.subscribe((event: PlayerButtonGestureAfterEvent): void =>
{
    const state = monitor(event.playerId);
    state.active.add(event.button);
    state.last = `Down ${event.button}`;
    console.warn(`${LogPrefix} ${event.playerId} ${describe("Down", event)}`);
});
signals.playerButtonUp.subscribe((event: PlayerButtonGestureAfterEvent): void =>
{
    const state = monitor(event.playerId);
    state.active.delete(event.button);
    state.last = `Up ${event.button} (${event.duration}t)`;
    console.warn(`${LogPrefix} ${event.playerId} ${describe("Up", event)}`);
});
signals.playerButtonPress.subscribe(presses("Press"));
signals.playerButtonNTap.subscribe(presses("DoubleTap"), { count: 2 });
signals.playerButtonNTap.subscribe(presses("TripleTap"), { count: 3 });
signals.playerButtonHold.subscribe(holds("Hold"));
signals.playerButtonPressAndHold.subscribe(holds("PressAndHold"));
signals.playerButtonNTapAndHold.subscribe(holds("DoubleTapAndHold"), { count: 2 });

signals.playerSpawn.subscribe((event: PlayerSpawnAfterEvent): void =>
{
    forget(event.player.id);
    if (event.initialSpawn)
    {
        event.player.sendMessage("§aWorld input demo.§r Move, jump and sneak; the action bar shows the raw " +
            "movement vector and held buttons, and chat lists recognized gestures. " +
            `§7/scriptevent ${ScriptEvent.Chat} all|buttons|off§r filters chat.`);
    }
});
signals.playerDimensionChange.subscribe((event: PlayerDimensionChangeAfterEvent): void =>
    forget(event.player.id));
signals.entityDie.subscribe((event: EntityDieAfterEvent): void => forget(event.deadEntity.id),
    { entityTypes: [ "minecraft:player" ] });
signals.playerLeave.subscribe((event: PlayerLeaveAfterEvent): void =>
{
    Monitors.delete(event.playerId);
});

system.afterEvents.scriptEventReceive.subscribe((event: ScriptEventCommandMessageAfterEvent): void =>
{
    if (event.id !== ScriptEvent.Chat)
    {
        return;
    }

    const mode = parseChatMode(event.message);
    const source = event.sourceEntity as Player | undefined;
    if (mode === undefined)
    {
        source?.sendMessage?.(`Usage: /scriptevent ${ScriptEvent.Chat} all|buttons|off`);
        return;
    }

    Chat = mode;
    world.sendMessage(`Gesture chat: ${mode}`);
}, { namespaces: [ ScriptEvent.Chat.split(":")[0] ] });

system.runInterval(() =>
{
    for (const player of world.getAllPlayers())
    {
        try
        {
            const vector = player.inputInfo.getMovementVector();
            const state = monitor(player.id);
            player.onScreenDisplay.setActionBar(`Move x ${axis(vector.x)} y ${axis(vector.y)}   ` +
                `Held: ${held(state.active)}\nLast: ${state.last}${state.hold ? `   ${state.hold}` : ""}`);
        }
        catch
        {
            // A player can become unavailable between listing and reading; the next tick retries.
        }
    }
}, 1);

system.run(() =>
{
    const dimension = world.getDimension("overworld");
    dimension.runCommand(`tickingarea add circle 0 -60 0 2 ${TickingArea.Scene}`);
    system.runTimeout(() =>
    {
        dimension.runCommand("fill -16 -61 -16 16 -61 16 smooth_stone");
        for (const [ x, z ] of [ [ 0, 4 ], [ 0, -4 ], [ 4, 0 ], [ -4, 0 ] ])
        {
            dimension.runCommand(`setblock ${x} -60 ${z} sea_lantern`);
        }

        world.setDefaultSpawnLocation({ x: 0,
            y: -60,
            z: 0 });
        world.setTimeOfDay(6_000);
        world.gameRules.doDayLightCycle = false;
        world.gameRules.doMobSpawning = false;
        console.warn(ReadyMarker);
    }, 40);
});
