/**
 * Prepares an isolated, persistent BDS world on port 19133 for physical-client World input qualification.
 *
 * @module @sorrell/world-input-demo/Tool/Demonstration
 *
 * @file      Demonstration.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Root } from "./Build.mts";
import { ReadyMarker, ScriptEvent } from "../Script/Keys.js";
import { mkdir, writeFile } from "node:fs/promises";
import { WorldFixture } from "../../../Script/WorldFixture.mts";
import { createDemonstration } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import path from "node:path";

const behavior = await Build();
const world = path.join(Root, "dist/template");
await mkdir(world, { recursive: true });
await writeFile(path.join(world, "level.dat"), WorldFixture());
const result = await createDemonstration({
    addon: Root,
    bds: process.env.BDS_PATH ?? "C:/MineCraft/Server",
    behaviorPacks: [ behavior ],
    config: { "allow-cheats": true,
        "content-log-console-output-enabled": true,
        "content-log-file-enabled": true,
        difficulty: "peaceful",
        gamemode: "creative",
        "tick-distance": 4,
        transport: "nethernet",
        "view-distance": 8 },
    description: "@bedform/server movement and button gesture signals with a live input monitor",
    descriptor: "world-input",
    instructions: "Move, jump and sneak with keyboard, controller or touch. The action bar shows the raw " +
        "movement vector, held buttons and the live hold duration; chat lists Press, double/triple taps, " +
        `holds and tap-and-holds. Use /scriptevent ${ScriptEvent.Chat} buttons to hide movement gestures. ` +
        "No primer is required.",
    name: "World Input Demo",
    port: 19133,
    portV6: 19134,
    readyMarker: ReadyMarker,
    world
});
await writeFile(path.join(Root, "dist/demonstration-build.json"), JSON.stringify(result, null, 2) + "\n");
