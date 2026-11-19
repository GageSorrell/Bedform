/**
 * Captures the frozen view using Bedrock's native eye-anchored command context.
 *
 * @module @sorrell/look-input-demo/Script/Camera
 *
 * @file      Camera.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import type { Camera, Player } from "@minecraft/server";
import { FreezeCamera as Capture, RestoreCamera as Restore } from
    "../../../Package/Bedform/Source/Diagetic/Camera.js";

/**
 * Free-camera preset retaining player rendering effects and the player audio listener.
 *
 * @category Constant
 * @since 1.0.9
 */
export const CameraPreset = "look_demo:first_person_snapshot" as const;

/**
 * Resolves the complete eye pose in the engine after the caller stops player movement.
 * Zero local offsets and relative rotation capture the current native command context;
 * the add-on supplies no eye-height correction, horizontal centering or numeric FOV.
 *
 * @throws { Error } If the native command does not apply the camera.
 *
 * @category Configuration
 * @since 1.0.11
 */
export function FreezeCamera(player: Pick<Player, "runCommand">): void
{
    Capture(player, CameraPreset);
}

/**
 * Restores the selected native perspective and removes the demo's FOV override.
 *
 * @category ResourceManagement
 * @since 1.0.9
 */
export function RestoreCamera(camera: Pick<Camera, "clear" | "setFov">): void
{
    Restore(camera);
}
