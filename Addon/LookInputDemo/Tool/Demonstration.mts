/**
 * Prepares an isolated, persistent BDS world for the look-input experiment.
 *
 * @module @sorrell/look-input-demo/Tool/Demonstration
 *
 * @file      Demonstration.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Root } from "./Build.mts";
import { mkdir, writeFile } from "node:fs/promises";
import { WorldFixture } from "../../../Script/WorldFixture.mts";
import { createDemonstration } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import path from "node:path";
const packs = await Build();
const world = path.join(Root, "dist/template");
await mkdir(world, { recursive: true });
await writeFile(path.join(world, "level.dat"), WorldFixture());
const result = await createDemonstration({
    addon: Root,
    bds: process.env.BDS_PATH ?? "C:/MineCraft/Server",
    behaviorPacks: [ packs.behavior ],
    config: { "content-log-console-output-enabled": true,
        "content-log-file-enabled": true,
        "tick-distance": 4,
        transport: "nethernet",
        "view-distance": 8 },
    description: "Fixed camera and blocked body rotation with per-tick look measurement",
    descriptor: "look-input",
    instructions: "Accept the resource pack. Select Look Input Toggle in first-person. Tap Use to enable. " +
        "Move the mouse or right stick while watching the vector, then tap Use to disable. " +
        "Values are (yaw, pitch) degrees per tick derived from head rotation, not raw device axes. " +
        "No primer is required.",
    name: "Look Input Demo",
    readyMarker: "LOOK_INPUT_DEMO_READY",
    resourcePacks: [ packs.resource ],
    world
});
await writeFile(path.join(Root, "dist/demonstration-build.json"), JSON.stringify(result, null, 2) + "\n");
