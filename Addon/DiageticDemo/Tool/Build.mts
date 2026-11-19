/**
 * Builds the Diagetic demonstration packs and stages BedformCommon's packs beside them.
 *
 * @module @sorrell/diagetic-demo/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Pack content retains authored Bedrock key ordering. */
/* eslint-disable sort-keys */

import { BehaviorEntity, ClientEntity } from "../../../Package/Bedform/Source/Build/DiageticControls.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Build as BuildCommon } from "../../BedformCommon/Tool/Build.mts";
import { DemoEntity } from "../Script/Controls.ts";
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
 * Fixed pack identities of the demonstration packs.
 *
 * @category Constant
 * @since 1.0.0
 */
export const Identity = Object.freeze({ Behavior: "b6e3a15c-a228-4f7e-bb1e-7d5be096063d",
    BehaviorData: "461096ff-1191-4ea1-ac1d-67a89ca2c7a6",
    BehaviorScript: "7193ae80-eec7-4e3a-942a-7f3539436932",
    Resource: "cab90f71-fe78-42c9-bb71-7e8bae2bd54c",
    ResourceModule: "fe6290b3-8d6b-4b96-81f4-3031fbcda554" } as const);

/**
 * Directories of the four packs the demonstration server loads.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Packs
{
    readonly CommonBehavior: string;
    readonly CommonResource: string;
    readonly Behavior: string;
    readonly Resource: string;
}

const Kinds = Object.freeze({ [DemoEntity.HeavyLever]: "lever",
    [DemoEntity.SpringThrottle]: "slider",
    [DemoEntity.NotchedDial]: "wheel" } as const);
const Names = Object.freeze({ [DemoEntity.HeavyLever]: "Heavy Lever",
    [DemoEntity.SpringThrottle]: "Spring Throttle",
    [DemoEntity.NotchedDial]: "Notched Dial" } as const);

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
    const packs: Packs = { CommonBehavior: path.join(dist, "common-behavior"),
        CommonResource: path.join(dist, "common-resource"),
        Behavior: path.join(dist, "behavior"),
        Resource: path.join(dist, "resource") };
    for (const directory of Object.values(packs))
    {
        await rm(directory, { force: true,
            recursive: true });
    }

    const common = unzipSync(await readFile(await BuildCommon(path.join(dist, "common"))));
    const references: Record<string, { uuid: string;
        version: Array<number> }> = {};
    for (const [ archive, target ] of [ [ "bedform-common-bp.mcpack", packs.CommonBehavior ],
        [ "bedform-common-rp.mcpack", packs.CommonResource ] ])
    {
        const files = unzipSync(common[archive]);
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
        header: { name: "Diagetic Demo Resources",
            description: "Names for the tuned demonstration controls",
            uuid: Identity.Resource,
            version,
            min_engine_version: [ 1, 26, 60 ] },
        modules: [ { type: "resources",
            uuid: Identity.ResourceModule,
            version } ],
        dependencies: [ references["bedform-common-rp.mcpack"] ] });
    await Json(path.join(packs.Behavior, "manifest.json"), { format_version: 2,
        header: { name: "Diagetic Demo",
            description: "Levers, sliders and wheels on every face, tuned drag and free poses",
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
        references["bedform-common-bp.mcpack"],
        { module_name: "@minecraft/server",
            version: "2.10.0" } ] });
    const lang: Array<string> = [];
    for (const [ identifier, kind ] of Object.entries(Kinds))
    {
        const name = identifier.split(":")[1];
        await Json(path.join(packs.Behavior, `entities/${name}.json`), BehaviorEntity(identifier));
        await Json(path.join(packs.Resource, `entity/${name}.entity.json`), ClientEntity(identifier, kind));
        lang.push(`entity.${identifier}.name=${Names[identifier as keyof typeof Names]}`);
    }

    await mkdir(path.join(packs.Resource, "texts"), { recursive: true });
    await writeFile(path.join(packs.Resource, "texts/en_US.lang"), lang.join("\n") + "\n");
    await Json(path.join(packs.Resource, "texts/languages.json"), [ "en_US" ]);
    await build({ absWorkingDir: Root,
        bundle: true,
        entryPoints: [ "Script/Main.ts" ],
        external: [ "@minecraft/server" ],
        format: "esm",
        legalComments: "none",
        logLevel: "warning",
        outfile: path.join(packs.Behavior, "scripts/main.js"),
        target: "es2022" });
    return packs;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
