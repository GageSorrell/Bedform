/**
 * Widget demonstration runtime: starts the spatial React runtime with a particle and TextPrimitive
 * backend, a shared scene and a private status panel per player, the pointer tracker with access
 * control, demonstration-only Use activation, and an imperative Canvas gallery.
 *
 * @module @sorrell/widget-demo/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Access from "../../../Package/Bedform/Source/Spatial/Access.js";
import * as App from "./App.js";
import * as Backend from "./Backend.js";
import * as Gallery from "./Gallery.js";
import * as Pointer from "../../../Package/Bedform/Source/Spatial/Pointer.js";
import * as React from "../../../Package/Bedform/Source/Spatial/React/index.js";
import * as Renderer from "../../../Package/Bedform/Source/Spatial/Renderer.js";
import * as Text from "../../../Package/Bedform/Source/Spatial/Text.js";
import * as TextFlip from "./TextFlip.js";
import type { Dimension, DimensionLocation, Player } from "@minecraft/server";
import { DynamicProperty, Item, Marker, ScriptEvent, TickingArea } from "./Keys.js";
import { Floor, Pillar, RowZ, Strip } from "./Scene.js";
import { ItemStack, MolangVariableMap, TextPrimitive, system, world } from "@minecraft/server";
import type { Activation } from "../../../Package/Bedform/Source/Spatial/ComponentTypes.js";
import { Kind } from "../../../Package/Bedform/Source/Spatial/Internal/ComponentKind.js";

const SceneVersion = 1;
const Sources: Map<number, Renderer.Root> = new Map();
const Statuses: Map<string, Renderer.Root> = new Map();

/**
 * Whether widget particles use the depth-writing Canvas variants; toggled with widget_demo:depth.
 *
 * @category Model
 * @since 1.0.0
 */
const Depth = { Write: true };

/**
 * Logs a demonstration failure without stopping the runtime.
 *
 * @category ErrorHandling
 * @since 1.0.0
 */
function Report(where: string, error: unknown): void
{
    console.warn(`[WidgetDemo] ${where}: ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * A fresh Molang variable map for particle emission.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Variables(): MolangVariableMap
{
    return new MolangVariableMap();
}

const Runtime = Renderer.Start({
    Native: { TextPrimitive },
    OnError: (failure: Renderer.Failure): void => Report(failure.Phase, failure.Cause),
    Surface: Backend.Combine(
        Backend.Create({
            CreateVariables: Variables,
            DepthWrite: (): boolean => Depth.Write,
            OnError: (error: unknown): void => Report("surface", error),
            Source: (rootId: number): Pointer.Source | undefined => Sources.get(rootId),
            Tracker: (): Pointer.Tracker => Tracker
        }),
        Text.CreateSurface({
            AddText: (text: Text.Primitive, dimension: unknown): void =>
                world.primitiveShapesManager.addText(TextFlip.Unwrap(text), dimension as Dimension),
            CreateText: (location: Text.Location, text: string): Text.Primitive =>
                TextFlip.Wrap(new TextPrimitive(location as unknown as DimensionLocation, text)),
            Dimension: (id: string): unknown => world.getDimension(id)
        })
    ),
    System: system,
    World: world
});

const Seat = Access.CreateController({ MaxPlayers: 1 });
const Shared = Renderer.CreateRoot(Runtime, {
    Audience: (): Array<Player> => world.getAllPlayers(),
    Shared: true
});
Sources.set(Shared.Id, Shared);
Shared.Render(React.createElement(App.Scene, {
    OnLock: (viewerId: string): void => (viewerId ? Seat.LockTo(viewerId) : Seat.Unlock()),
    Seat
}));

const Tracker = Pointer.Start({
    CreateVariables: Variables,
    OnError: (error: Error): void => Report("pointer", error),
    Sources: (): Iterable<Pointer.Source> => Sources.values(),
    System: system,
    World: world as unknown as Pointer.Players
});

/**
 * Gives a player the wand and key once.
 *
 * @category Running
 * @since 1.0.0
 */
function Equip(player: Player): void
{
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container)
    {
        return;
    }

    for (const id of [ Item.Wand, Item.Key ])
    {
        let held = false;
        for (let slot = 0; slot < container.size; slot++)
        {
            held ||= container.getItem(slot)?.typeId === id;
        }

        if (!held)
        {
            container.addItem(new ItemStack(id));
        }
    }
}

/**
 * Creates a player's private status root.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Welcome(player: Player): void
{
    Equip(player);
    if (Statuses.has(player.id))
    {
        return;
    }

    const root = Renderer.CreateRoot(Runtime, { Player: player });
    Statuses.set(player.id, root);
    Sources.set(root.Id, root);
    root.Render(React.createElement(App.Status, {
        Name: player.name,
        PlayerId: player.id,
        Tracker: (): Pointer.Tracker | undefined => Tracker
    }));
}

/**
 * Activates the eligible control under a player's pointer. Bedform's activation proxies and gestures
 * (ty2k.15) are not built yet, so the demonstration routes item Use here instead.
 *
 * @category Running
 * @since 1.0.0
 */
function Activate(player: Player): void
{
    const state = Tracker?.Get(player.id);
    Tracker?.Press(player.id);
    const control = state?.Eligible ? state.Hit.Control : undefined;
    if (!state || !control)
    {
        return;
    }

    const props = control.Props;
    const event: Activation = {
        Kind: "activate",
        TargetId: control.Id,
        ViewerId: player.id
    };
    if (control.Type === Kind.Toggle)
    {
        (props.OnChange as ((checked: boolean, event: Activation) => void) | undefined)?.(
            !props.Checked, event);
    }
    else if (control.Type === Kind.Slider)
    {
        const minimum = (props.Min as number | undefined) ?? 0;
        const maximum = (props.Max as number | undefined) ?? 1;
        const fraction = Math.min(1, Math.max(0, (state.Hit.Point.X - control.Content.X) /
            Math.max(1, control.Content.Width)));
        (props.OnChange as ((value: number, event: Activation) => void) | undefined)?.(
            minimum + fraction * (maximum - minimum), event);
    }
    else
    {
        (props.OnActivate as ((event: Activation) => void) | undefined)?.(event);
    }
}

/**
 * Runs a command, ignoring an unsuccessful result such as an existing ticking area.
 *
 * @category Running
 * @since 1.0.0
 */
function Command(dimension: Dimension, command: string): void
{
    try
    {
        dimension.runCommand(command);
    }
    catch (error)
    {
        Report(`command ${command}`, error);
    }
}

/**
 * Formats a block position for a command.
 *
 * @category Converting
 * @since 1.0.0
 */
function At(position: { readonly x: number;
    readonly y: number;
    readonly z: number; }): string
{
    return `${position.x} ${position.y} ${position.z}`;
}

/**
 * Builds the ground strip and occlusion pillar once per world.
 *
 * @category Constructor
 * @since 1.0.0
 */
function Build(dimension: Dimension): void
{
    world.gameRules.doDayLightCycle = false;
    world.gameRules.doWeatherCycle = false;
    world.gameRules.doMobSpawning = false;
    world.setTimeOfDay(6_000);
    Command(dimension, `fill ${At(Strip.From)} ${At(Strip.To)} polished_andesite`);
    Command(dimension, `fill ${At(Pillar.From)} ${At(Pillar.To)} stone`);
    world.setDynamicProperty(DynamicProperty.Scene, SceneVersion);
}

/**
 * Waits for the scene chunks, builds the scene once, then reports readiness.
 *
 * @category Running
 * @since 1.0.0
 */
function Prepare(): void
{
    const dimension = world.getDimension("overworld");
    Command(dimension, `tickingarea add ${At({ ...Strip.From,
        y: Floor - 1 })} ${At({ ...Strip.To,
        y: Floor + 8,
        z: RowZ + 1 })} ${TickingArea}`);
    const poll = system.runInterval(() =>
    {
        if (!dimension.getBlock(Strip.From) || !dimension.getBlock(Strip.To))
        {
            return;
        }

        system.clearRun(poll);
        try
        {
            if (world.getDynamicProperty(DynamicProperty.Scene) !== SceneVersion)
            {
                Build(dimension);
            }
        }
        catch (error)
        {
            console.warn(`${Marker.Fail} ${String(error)}`);
        }

        system.runTimeout(() =>
        {
            const layout = Shared.Layout;
            console.warn(`${Marker.Evidence} ${JSON.stringify({
                Disposed: Shared.Disposed,
                Items: layout?.Items.length ?? 0,
                Views: layout?.Views.length ?? 0
            })}`);
            if (!layout || layout.Views.length !== 4 || Shared.Disposed)
            {
                console.warn(`${Marker.Fail} the shared scene did not commit four views`);
            }

            console.warn(Marker.Ready);
        }, 40);
    }, 10);
}

world.afterEvents.playerSpawn.subscribe(({ player }: { player: Player }) => Welcome(player));
world.afterEvents.playerLeave.subscribe(({ playerId }: { playerId: string }) =>
{
    const root = Statuses.get(playerId);
    Statuses.delete(playerId);
    if (root)
    {
        Sources.delete(root.Id);
        void root.Unmount().catch((error: unknown) => Report("unmount", error));
    }
});
world.afterEvents.itemUse.subscribe(({ source, itemStack }: { source: Player;
    itemStack: ItemStack; }) =>
{
    if (itemStack.typeId === Item.Wand || itemStack.typeId === Item.Key)
    {
        Activate(source);
    }
});
const Art = Gallery.Start({
    Audience: (): Array<Player> => world.getAllPlayers(),
    CreateVariables: Variables,
    OnError: (error: Error): void => Report("gallery", error),
    System: system
});
Art.SetDepthWrite(Depth.Write);
system.afterEvents.scriptEventReceive.subscribe(({ id }: { id: string }) =>
{
    if (id === ScriptEvent.TextFlip)
    {
        world.sendMessage(`Widget text flip is now ${TextFlip.Toggle() ? "on" : "off"}.`);
    }
    else if (id === ScriptEvent.Depth)
    {
        Depth.Write = !Depth.Write;
        Art.SetDepthWrite(Depth.Write);
        world.sendMessage(Depth.Write
            ? "Widget particles now write depth (particles_alpha, alpha-tested)."
            : "Widget particles are now blended without depth writes (particles_blend).");
    }
});
system.run(() =>
{
    // Players already online after a script reload; world reads are unavailable in early execution.
    for (const player of world.getAllPlayers())
    {
        Welcome(player);
    }
});

system.runTimeout(Prepare, 20);
