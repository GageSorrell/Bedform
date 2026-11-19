/**
 * BedformCommon runtime: registers the built-in lever, slider and wheel controls and handles placement
 * requests sent through the shared script event.
 *
 * @module bedform-common/Script/Main
 *
 * @file      Main.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Placement requests retain semantic field ordering. */
/* eslint-disable sort-keys */

import * as Diagetic from "../../../Package/Bedform/Source/Diagetic.js";
import type { Dimension, Direction, Entity, Player, ScriptEventCommandMessageAfterEvent,
    Vector3 } from "@minecraft/server";
import { system, world } from "@minecraft/server";

/**
 * Built-in definitions owned by this pack. Other packs must not register these entity types.
 *
 * @category Constant
 * @since 1.1.0
 */
export const Controls: Readonly<Record<Diagetic.Kind, Diagetic.Definition>> = Object.freeze({
    lever: Diagetic.Lever(),
    slider: Diagetic.Slider(),
    wheel: Diagetic.Wheel()
});

/**
 * A JSON placement request. With Face, the control binds to the block at Position; otherwise it is placed
 * freely at Position, facing Yaw.
 *
 * @category Model
 * @since 1.1.0
 */
export interface PlacementRequest
{
    readonly Kind: Diagetic.Kind;
    readonly Dimension?: string;
    readonly Position: Vector3;
    readonly Face?: Direction;
    readonly Yaw?: number;
    readonly Value?: number;
}

const Faces: ReadonlyArray<string> = [ "Up", "Down", "North", "South", "East", "West" ];
const Reach = 8;

/**
 * Requires a supported control kind.
 *
 * @throws { TypeError } If the kind is not lever, slider or wheel.
 *
 * @category Validation
 * @since 1.1.0
 */
function KindOf(value: unknown): Diagetic.Kind
{
    if (value !== "lever" && value !== "slider" && value !== "wheel")
    {
        throw new TypeError("Diagetic placement kind must be lever, slider or wheel");
    }

    return value;
}

/**
 * Spawns a bound control on a loaded block face.
 *
 * @throws { Error } If the block is unloaded or is air.
 *
 * @category Constructor
 * @since 1.1.0
 */
function Bind(kind: Diagetic.Kind, dimension: Dimension, position: Vector3, face: Direction,
    value?: number): Diagetic.Handle
{
    const block = dimension.getBlock(position);
    if (!block || block.isAir)
    {
        throw new Error("Diagetic placement requires a loaded, solid supporting block");
    }

    const binding: Diagetic.BlockBinding = { Dimension: dimension.id,
        Position: block.location,
        Face: face,
        ExpectedBlockType: block.typeId };
    return Controls[kind].Spawn(dimension, Diagetic.BindingLocation(binding), { Binding: binding,
        Value: value,
        initialPersistence: true });
}

/**
 * Spawns a free control whose model sits at the centre of its carrier, facing the given yaw.
 *
 * @category Constructor
 * @since 1.1.0
 */
function Free(kind: Diagetic.Kind, dimension: Dimension, location: Vector3, yaw: number,
    value?: number): Diagetic.Handle
{
    return Controls[kind].Spawn(dimension, location, { initialRotation: yaw,
        initialPersistence: true,
        Value: value,
        Pose: { Offset: { x: 0,
            y: Diagetic.CarrierSize / 2,
            z: 0 } } });
}

/**
 * Places from a player's words: "lever", "slider" or "wheel", optionally followed by "free" and an initial
 * value. Without "free", the control binds to the block face in view; otherwise, or when no block is in
 * reach, it floats in front of the player, facing them.
 *
 * @throws { Error } If the request is malformed or placement fails.
 *
 * @category Constructor
 * @since 1.1.0
 */
function PlaceFromPlayer(player: Player, words: ReadonlyArray<string>): Diagetic.Handle
{
    const kind = KindOf(words[0]);
    const free = words.includes("free");
    const number = words.slice(1).find((word: string) => word !== "free");
    const value = number === undefined ? undefined : Number(number);
    if (value !== undefined && !Number.isFinite(value))
    {
        throw new TypeError("Diagetic placement value must be a number");
    }

    const hit = free ? undefined : player.getBlockFromViewDirection({ maxDistance: Reach,
        includeLiquidBlocks: false,
        includePassableBlocks: false });
    if (hit)
    {
        return Bind(kind, player.dimension, hit.block.location, hit.face, value);
    }

    const eye = player.getHeadLocation();
    const view = player.getViewDirection();
    return Free(kind, player.dimension, { x: eye.x + view.x * 1.5,
        y: eye.y + view.y * 1.5 - Diagetic.CarrierSize / 2,
        z: eye.z + view.z * 1.5 }, player.getRotation().y + 180, value);
}

/**
 * Places from a JSON request.
 *
 * @throws { Error } If the request is malformed or placement fails.
 *
 * @category Constructor
 * @since 1.1.0
 */
function PlaceFromRequest(request: PlacementRequest, source?: Entity): Diagetic.Handle
{
    const kind = KindOf(request?.Kind);
    const dimension = world.getDimension(request.Dimension ?? source?.dimension.id ?? "overworld");
    if (request.Face !== undefined)
    {
        if (!Faces.includes(request.Face))
        {
            throw new TypeError("Diagetic placement face must be a native block face");
        }

        return Bind(kind, dimension, request.Position, request.Face, request.Value);
    }

    return Free(kind, dimension, request.Position, request.Yaw ?? 0, request.Value);
}

/**
 * Handles the shared placement script event and reports the result to a player source.
 *
 * @category Running
 * @since 1.1.0
 */
function Place(event: ScriptEventCommandMessageAfterEvent): void
{
    if (event.id !== Diagetic.Keys.ScriptEvent.Place)
    {
        return;
    }

    const source = event.sourceEntity;
    const player = source?.typeId === "minecraft:player" ? source as Player : undefined;
    try
    {
        const message = event.message.trim();
        const handle = message.startsWith("{")
            ? PlaceFromRequest(JSON.parse(message) as PlacementRequest, event.sourceEntity)
            : player ? PlaceFromPlayer(player, message.toLowerCase().split(/\s+/u))
                : (() =>
                {
                    throw new Error("Word placement requires a player; send a JSON request instead");
                })();
        player?.sendMessage(`Placed ${handle.Definition.Kind}${handle.Binding ? " on " +
            handle.Binding.Face.toLowerCase() + " face" : ""}.`);
    }
    catch (error)
    {
        const text = `Diagetic placement failed: ${error instanceof Error ? error.message : String(error)}`;
        if (player)
        {
            player.sendMessage(`§c${text}`);
        }
        else
        {
            console.warn(text);
        }
    }
}

Diagetic.Start({ World: world,
    System: system,
    Controls: Object.values(Controls),
    OnError: (error: unknown) => console.warn(`[BedformCommon] ${String(error)}`) });
system.afterEvents.scriptEventReceive.subscribe(Place, { namespaces: [ "bedform" ] });
