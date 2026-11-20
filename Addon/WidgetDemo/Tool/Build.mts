/**
 * Builds the widget demonstration packs and stages BedformCanvas's packs beside them.
 *
 * @module @sorrell/widget-demo/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pack content retains authored Bedrock key ordering. */
/* eslint-disable sort-keys */

import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Build as BuildCanvas } from "../../BedformCanvas/Tool/Build.mts";
import { Item } from "../Script/Keys.ts";
import { build } from "esbuild";
import path from "node:path";
import { unzipSync } from "fflate";

/**
 * Root of this demonstration add-on.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Root = fileURLToPath(new URL("../", import.meta.url));

/**
 * Bedform package sources, bundled directly instead of a built distribution.
 *
 * @category Constant
 * @since 1.0.0
 */
const Source = path.join(Root, "../../Package/Bedform/Source");

/**
 * Fixed pack identities of the demonstration packs.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Identity = Object.freeze({ Behavior: "3f6b8a52-1d4e-4c07-9a2b-6e5d1c0f7a91",
    BehaviorData: "a8d2c4e6-5b17-4f3a-8c90-2e1f4d6b7a35",
    BehaviorScript: "c51e9f07-3a6d-4b28-9e4c-7d0a2b8f6e13",
    Resource: "5e0d7b39-8c24-4a61-b3f5-91c6e2d4a807",
    ResourceModule: "d93a1f6c-2e85-47b0-a1d9-3c7e5f8b0264" } as const);

/**
 * Directories of the four packs the demonstration server loads.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Packs
{
    readonly CanvasBehavior: string;
    readonly CanvasResource: string;
    readonly Behavior: string;
    readonly Resource: string;
}

const Items = Object.freeze([
    { Id: Item.Wand,
        Name: "Widget Wand",
        Icon: "compass_item" },
    { Id: Item.Key,
        Name: "Widget Key",
        Icon: "clock_item" }
] as const);

/**
 * Writes JSON with a trailing newline, creating parent directories.
 *
 * @category Serialization
 * @since 1.0.0
 */
async function Json(file: string, value: unknown): Promise<void>
{
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

/**
 * Builds fresh pack directories under dist and returns their paths.
 *
 * @category Serialization
 * @since 1.0.0
 */
export async function Build(): Promise<Packs>
{
    const dist = path.join(Root, "dist");
    const packs: Packs = { CanvasBehavior: path.join(dist, "canvas-behavior"),
        CanvasResource: path.join(dist, "canvas-resource"),
        Behavior: path.join(dist, "behavior"),
        Resource: path.join(dist, "resource") };
    for (const directory of Object.values(packs))
    {
        await rm(directory, { force: true,
            recursive: true });
    }

    const canvas = unzipSync(await readFile(await BuildCanvas(path.join(dist, "canvas"))));
    const references: Record<string, { uuid: string;
        version: Array<number> }> = {};
    for (const [ archive, target ] of [ [ "bedform-canvas-bp.mcpack", packs.CanvasBehavior ],
        [ "bedform-canvas-rp.mcpack", packs.CanvasResource ] ])
    {
        const files = unzipSync(canvas[archive]);
        for (const [ name, bytes ] of Object.entries(files))
        {
            await mkdir(path.dirname(path.join(target, name)), { recursive: true });
            await writeFile(path.join(target, name), bytes);
        }

        const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString());
        references[archive] = { uuid: manifest.header.uuid,
            version: manifest.header.version };
    }

    const version = JSON.parse(await readFile(path.join(Root, "package.json"), "utf8")).version
        .split(".").map(Number);
    await Json(path.join(packs.Resource, "manifest.json"), { format_version: 2,
        header: { name: "Widget Demo Resources",
            description: "Item names for the spatial widget demonstration",
            uuid: Identity.Resource,
            version,
            min_engine_version: [ 1, 26, 60 ] },
        modules: [ { type: "resources",
            uuid: Identity.ResourceModule,
            version } ],
        dependencies: [ references["bedform-canvas-rp.mcpack"] ] });
    await Json(path.join(packs.Behavior, "manifest.json"), { format_version: 2,
        header: { name: "Widget Demo",
            description: "Spatial React widgets, pointer lines, access control and Canvas surfaces",
            uuid: Identity.Behavior,
            version,
            min_engine_version: [ 1, 26, 60 ] },
        modules: [ { type: "data",
            uuid: Identity.BehaviorData,
            version },
        { type: "script",
            language: "javascript",
            entry: "scripts/main.js",
            uuid: Identity.BehaviorScript,
            version } ],
        dependencies: [ { uuid: Identity.Resource,
            version },
        references["bedform-canvas-bp.mcpack"],
        { module_name: "@minecraft/server",
            version: "2.10.0" } ] });
    const lang: Array<string> = [];
    for (const item of Items)
    {
        await Json(path.join(packs.Behavior, `items/${item.Id.split(":")[1]}.json`), {
            format_version: "1.26.0",
            "minecraft:item": {
                description: { identifier: item.Id,
                    menu_category: { category: "equipment" } },
                components: {
                    "minecraft:display_name": { value: item.Name },
                    "minecraft:icon": item.Icon,
                    "minecraft:interact_button": true,
                    "minecraft:max_stack_size": 1
                }
            }
        });
        lang.push(`item.${item.Id}.name=${item.Name}`);
    }

    await mkdir(path.join(packs.Resource, "texts"), { recursive: true });
    await writeFile(path.join(packs.Resource, "texts/en_US.lang"), lang.join("\n") + "\n");
    await Json(path.join(packs.Resource, "texts/languages.json"), [ "en_US" ]);
    await build({ absWorkingDir: Root,
        alias: { "bedform/Canvas/Surface": path.join(Source, "Canvas/Surface.ts") },
        bundle: true,
        entryPoints: [ "Script/Main.ts" ],
        external: [ "@minecraft/server" ],
        format: "esm",
        legalComments: "none",
        logLevel: "warning",
        outfile: path.join(packs.Behavior, "scripts/main.js"),
        platform: "neutral",
        target: "es2022" });
    return packs;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
