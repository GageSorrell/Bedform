/**
 * Published Intent consumer example and compile-time checks for shared descriptors and native subjects.
 *
 * @module bedform/Test/Intent.types
 *
 * @file      Intent.types.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Intent from "bedform/Spatial/Intent";
import type { Entity, Player, System, World } from "@minecraft/server";
import type { Command } from "bedform/Canvas/IntentProtocol";
import type { ImageDescriptor } from "bedform/Canvas/Image";
import { Spatial } from "bedform";

/**
 * Demonstrates root and direct consumers sharing native subjects and generic generated images.
 * This function is typechecked, never invoked automatically by importing the fixture.
 *
 * @category Testing
 * @since 1.0.0
 */
export async function Example(world: World, system: System, player: Player, npc: Entity,
    image: ImageDescriptor): Promise<void>
{
    const intents: Intent.Connection = Spatial.Intent.Start({ Id: "example:addon",
        System: system,
        World: world });
    try
    {
        await intents.Set(player, Intent.Builtin.Thinking, { DurationTicks: 60 });
        await intents.Set(npc, Intent.Glyphs("\uE200\uE201", { Advances: [ 8, 16 ],
            Height: 16 }));
        const shared: Intent.ImageDescriptor = image;
        await intents.Set(npc, shared);
        await intents.Clear(player);
        // @ts-expect-error Subjects must be native entities.
        await intents.Set("player", Intent.Builtin.Sleep);
        // @ts-expect-error Durations are tick counts, not strings.
        await intents.Set(player, Intent.Builtin.Sleep, { DurationTicks: "60" });
        await intents.Set(player, { Kind: "builtin",
            // @ts-expect-error Unknown built-in names are not part of the contract.
            Name: "unknown" });
        // @ts-expect-error Image descriptors require their generated animation metadata.
        await intents.Set(player, { Id: "example:missing",
            Kind: "image" });
    }
    finally
    {
        await intents.Dispose();
    }
}

/**
 * Consumes the discriminated wire contract from the public Canvas subpath.
 *
 * @category Testing
 * @since 1.0.0
 */
export function ReadCommand(command: Command): string
{
    if (command.Operation === "set")
    {
        const definition: Intent.Definition = command.Intent;
        return definition.Kind + command.EntityId;
    }

    return command.ConnectionId;
}
