/**
 * Prepares an isolated, persistent BDS world for trying the spatial widgets built so far.
 *
 * @module @sorrell/widget-demo/Tool/Demonstration
 *
 * @file      Demonstration.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Build, Root } from "./Build.mts";
import { Marker } from "../Script/Keys.ts";
import { createDemonstration } from "../../../Script/Deprecated/Demonstration/Source/create.mts";
import path from "node:path";
import { writeFile } from "node:fs/promises";

const packs = await Build();
const result = await createDemonstration({
    addon: Root,
    bds: process.env.BDS_PATH ?? "C:/MineCraft/Server",
    behaviorPacks: [ packs.CanvasBehavior, packs.Behavior ],
    config: { "content-log-console-output-enabled": true,
        "content-log-file-enabled": true,
        "default-player-permission-level": "operator",
        "tick-distance": 4,
        transport: "nethernet",
        "view-distance": 8 },
    description: "Bedform spatial React widgets, pointer lines, access control and Canvas surfaces",
    descriptor: "widgets",
    instructions: "Accept the resource packs and look south from spawn at the row of panels. Aim at a " +
        "panel to see your pointer line: white on plain surfaces, cyan on controls you can use, red " +
        "when another player has the seat, magenta when you lack the key. Hold the Widget Wand or " +
        "Widget Key and press Use to activate the control under the pointer (it flashes orange). " +
        "The right-most panel is private and follows your pointer. Hover the right edge of the " +
        "Scrolling list to reveal its scrollbar. Run /scriptevent widget_demo:text_flip to turn the " +
        "panel text around if it is unreadable or missing, and /scriptevent widget_demo:depth to " +
        "switch widget particles between depth-writing and blended materials.",
    name: "Spatial Widgets Demo",
    port: 19133,
    portV6: 19134,
    readyMarker: Marker.Ready,
    resourcePacks: [ packs.CanvasResource, packs.Resource ],
    world: path.join(Root, "TestWorld")
});
await writeFile(path.join(Root, "dist/demonstration-build.json"), JSON.stringify(result, null, 2) + "\n");
console.log(result);
