/**
 * Builds the standalone look-input demonstration packs.
 *
 * @module @sorrell/look-input-demo/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { CameraPreset } from "../Script/Camera.js";
import { Presentation } from "../../../Package/Bedform/Source/Build/DiageticPresentation.js";
import { build } from "esbuild";
import path from "node:path";

/**
 * Root of this standalone demonstration add-on.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Emits player behavior and first-person presentation guarded against camera/property delivery races.
 *
 * @category Serialization
 * @since 1.0.10
 */
export async function Build(): Promise<{
    behavior: string;
    resource: string;
}>
{
    const behavior = path.join(Root, "dist/behavior");
    const resource = path.join(Root, "dist/resource");
    const json = async (base: string, name: string, value: unknown) =>
    {
        const file = path.join(base, name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(value, null, 2) + "\n");
    };

    const metadata = JSON.parse(await readFile(path.join(Root, "package.json"), "utf8"));
    const version = metadata.version.split(".").map(Number);
    await mkdir(behavior, { recursive: true });
    await mkdir(resource, { recursive: true });
    const license = await readFile(path.join(Root, "Assets/License.Mojang.txt"));
    await writeFile(path.join(behavior, "License.Mojang.txt"), license);
    await writeFile(path.join(resource, "License.Mojang.txt"), license);
    await json(behavior, "cameras/presets/first_person_snapshot.json", {
        format_version: "1.21.0",
        "minecraft:camera_preset": {
            identifier: CameraPreset,
            inherit_from: "minecraft:free",
            listener: "player",
            player_effects: true
        }
    });
    await json(resource, "manifest.json", { format_version: 2,
        header: {
            description: "Toggle item localization",
            min_engine_version: [ 1, 26, 60 ],
            name: "Look Input Demo Resources",
            uuid: "e7461b53-daa7-4c45-8c21-5461bbbcf8b9",
            version },
        modules: [ { type: "resources",
            uuid: "66b8ce53-3883-4d57-9503-f26718a9e92b",
            version } ] });
    await json(behavior, "manifest.json", {
        dependencies: [ { module_name: "@minecraft/server",
            version: "2.10.0" },
        { uuid: "e7461b53-daa7-4c45-8c21-5461bbbcf8b9",
            version } ],
        format_version: 2,
        header: {
            description: "Fixed camera and body; measured look deltas",
            min_engine_version: [ 1, 26, 60 ],
            name: "Look Input Demo",
            uuid: "7ea1d972-e018-4628-ac03-e1b055178324",
            version },
        modules: [ { type: "data",
            uuid: "7bbfb280-a383-47e8-84da-b319df629a5e",
            version },
        {
            entry: "scripts/main.js",
            language: "javascript",
            type: "script",
            uuid: "b10ee983-fc2d-4483-9019-d541d025ef16",
            version } ]
    });
    await json(behavior, "items/toggle.json", { format_version: "1.26.0",
        "minecraft:item": {
            components: { "minecraft:display_name": { value: "Look Input Toggle" },
                "minecraft:icon": "compass_item",
                "minecraft:interact_button": true,
                "minecraft:max_stack_size": 1 },
            description: { identifier: "look_demo:toggle",
                menu_category: { category: "equipment" } }
        } });
    const presentation = Presentation(
        JSON.parse(await readFile(path.join(Root, "Assets/player.vanilla.json"), "utf8")),
        JSON.parse(await readFile(path.join(Root, "Assets/player.client.vanilla.json"), "utf8")),
        { ActiveProperty: "look_demo:camera_active",
            LockEvent: "look_demo:lock",
            LockedGroup: "look_demo:locked",
            Preset: CameraPreset,
            UnlockEvent: "look_demo:unlock" }
    );
    await json(behavior, "entities/player.json", presentation.Behavior);
    await json(resource, "entity/player.entity.json", presentation.Client);
    await rm(path.join(resource, "render_controllers/look_demo_player.render_controllers.json"),
        { force: true });
    await build({
        bundle: true,
        entryPoints: [ path.join(Root, "Script/Main.ts") ],
        external: [ "@minecraft/server" ],
        format: "esm",
        outfile: path.join(behavior, "scripts/main.js"),
        target: "es2022" });
    return { behavior,
        resource };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
