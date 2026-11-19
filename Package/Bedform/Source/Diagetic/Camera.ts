/**
 * Shared native eye-anchored camera snapshot and independent perspective cleanup.
 *
 * @module bedform/Diagetic/Camera
 *
 * @file      Camera.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Camera, Player } from "@minecraft/server";

/**
 * Captures the engine's eye pose with unchanged FOV and no authored position offset.
 *
 * @throws { Error } If the native camera command fails.
 *
 * @category Configuration
 * @since 1.0.0
 */
export const FreezeCamera = (player: Pick<Player, "runCommand">, preset: string): void =>
{
    const result = player.runCommand("execute as @s at @s anchored eyes run camera @s set " +
        `${preset} pos ^ ^ ^ rot ~ ~`);
    if (result.successCount === 0)
    {
        throw new Error("The native eye-anchored camera command did not apply");
    }
};

/**
 * Restores the selected native perspective and clears any previous FOV override.
 * Both cleanup operations are attempted independently.
 *
 * @throws { AggregateError } If either restoration operation fails.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const RestoreCamera = (camera: Pick<Camera, "clear" | "setFov">): void =>
{
    const errors: Array<unknown> = [];
    for (const restore of [ () => camera.clear(), () => camera.setFov() ])
    {
        try
        {
            restore();
        }
        catch (error)
        {
            errors.push(error);
        }
    }

    if (errors.length)
    {
        throw new AggregateError(errors, "Native camera restoration failed");
    }
};
