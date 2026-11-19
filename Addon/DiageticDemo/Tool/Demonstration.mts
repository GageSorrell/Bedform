/**
 * Prepares an isolated, persistent BDS world for trying the Diagetic controls.
 *
 * @module @sorrell/diagetic-demo/Tool/Demonstration
 *
 * @file      Demonstration.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Root } from "./Build.mts";
import { writeFile } from "node:fs/promises";
import { Marker } from "../Script/Keys.ts";
import { createDemonstration } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import path from "node:path";

const packs = await Build();
const world = path.join(Root, "TestWorld");
const result = await createDemonstration({
    addon: Root,
    bds: process.env.BDS_PATH ?? "C:/MineCraft/Server",
    behaviorPacks: [ packs.CommonBehavior, packs.Behavior ],
    config: { "content-log-console-output-enabled": true,
        "content-log-file-enabled": true,
        "default-player-permission-level": "operator",
        "tick-distance": 4,
        transport: "nethernet",
        "view-distance": 8 },
    description: "Bedform Diagetic levers, sliders and wheels on every face, with tuned drag and free poses",
    descriptor: "diagetic",
    instructions: "Accept the resource packs and walk south from spawn. Look at a control and press Use to " +
        "grab it; your view freezes and the action bar says how to let go. Move the mouse or right " +
        "stick to drag, then press Use again to release. The first row has the built-in lever, " +
        "slider and wheel on all six faces of a block. The desk has free controls that are tilted, " +
        "rolled and turned. The wall has tuned controls: a heavy lever that lights a lamp, a " +
        "throttle that springs back to zero while filling a gauge, and a dial with detents. Place " +
        "more with /scriptevent bedform:diagetic_place lever (or slider or wheel; add free to float " +
        "one in front of you). No primer is required.",
    name: "Diagetic Controls Demo",
    readyMarker: Marker.Ready,
    resourcePacks: [ packs.CommonResource, packs.Resource ],
    world
});
await writeFile(path.join(Root, "dist/demonstration-build.json"), JSON.stringify(result, null, 2) + "\n");
console.log(result);
