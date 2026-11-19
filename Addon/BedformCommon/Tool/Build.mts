/**
 * Packages the shared Bedform packs independently of the Bedform CLI.
 *
 * @module bedform-common/Tool/Build
 *
 * @file      Build.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import { Animations, BehaviorEntity, BuiltinEntity, ClientEntity, Geometry, Localization, Models,
    ReleaseTargetBehavior, RenderControllers
} from "../../../Package/Bedform/Source/Build/DiageticControls.js";
import { CameraPreset, EntityEvent, EntityGroup, EntityProperty, ReleaseTarget } from
    "../../../Package/Bedform/Source/Diagetic/Keys.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { GenerateDirectionPreviews } from "./DirectionPreview.mjs";
import { GenerateTransactionalIcons } from "./TransactionalIcons.mjs";
import type { Kind } from "../../../Package/Bedform/Source/Diagetic.js";
import { Presentation } from "../../../Package/Bedform/Source/Build/DiageticPresentation.js";
import { TransactionalText } from "../../../Package/Bedform/Source/Internal/TransactionalAssets.js";
import type { Zippable } from "fflate";
import { build } from "esbuild";
import path from "node:path";
import { zipSync } from "fflate";

const Root = fileURLToPath(new URL("../", import.meta.url));
const Stamp = new Date("2026-01-01T00:00:00Z");

/**
 * Archives pack files in lexical order with portable paths and fixed timestamps.
 *
 * @throws { Error } If a pack contains an unsupported filesystem entry.
 *
 * @category Serialization
 * @since 1.0.0
 */
async function Archive(directory: string): Promise<Uint8Array>
{
    const entries: Zippable = {};

    /**
     * Collects regular files beneath the pack root, including nested content.
     *
     * @throws { Error } If a pack contains a symlink or another nonregular entry.
     *
     * @category Serialization
     * @since 1.0.0
     */
    async function Visit(relative: string): Promise<void>
    {
        const children = await readdir(path.join(directory, relative), { withFileTypes: true });
        children.sort((left: Dirent<string>, right: Dirent<string>) =>
            left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
        for (const child of children)
        {
            const name = relative + child.name;
            if (child.isDirectory())
            {
                await Visit(name + "/");
            }
            else if (child.isFile())
            {
                entries[name] = [ await readFile(path.join(directory, name)), { mtime: Stamp } ];
            }
            else
            {
                throw new Error(`Unsupported pack entry: ${name}`);
            }
        }
    }

    await Visit("");
    return zipSync(entries);
}

/**
 * Generates the shared control entities, models, animations, render controllers and localization, and
 * bundles the runtime script that registers the built-in controls. Paths are relative to each pack root.
 *
 * @category Serialization
 * @since 1.1.0
 */
export async function Generate(): Promise<void>
{
    const files: Array<readonly [ "behavior_packs" | "resource_packs", string, string ]> = [];
    const json = (value: unknown): string => JSON.stringify(value, null, 2) + "\n";
    for (const kind of Object.keys(Models) as Array<Kind>)
    {
        files.push([ "behavior_packs", `entities/diagetic_${kind}.json`,
            json(BehaviorEntity(BuiltinEntity[kind])) ],
        [ "resource_packs", `entity/diagetic_${kind}.entity.json`,
            json(ClientEntity(BuiltinEntity[kind], kind)) ],
        [ "resource_packs", `models/entity/diagetic_${kind}.geo.json`, json(Geometry(Models[kind])) ]);
    }

    files.push([ "behavior_packs", "entities/diagetic_release_target.json", json(ReleaseTargetBehavior()) ],
        [ "resource_packs", "entity/diagetic_release_target.entity.json", json({ format_version: "1.10.0",
            "minecraft:client_entity": { description: { identifier: ReleaseTarget,
                render_controllers: [] } } }) ]);
    files.push([ "resource_packs", "animations/bedform_diagetic.animation.json", json(Animations()) ],
        [ "resource_packs", "render_controllers/bedform_diagetic.render_controllers.json",
            json(RenderControllers()) ],
        [ "resource_packs", "texts/en_US.lang", Localization() +
            "\nbedform.direction.up=Up\nbedform.direction.down=Down\nbedform.direction.north=North\n" +
            "bedform.direction.south=South\nbedform.direction.east=East\nbedform.direction.west=West\n" +
            Object.values(TransactionalText).map((text: Readonly<Record<"English" | "Key", string>>) =>
                `${text.Key}=${text.English}\n`).join("") ],
        [ "resource_packs", "texts/languages.json", json([ "en_US" ]) ]);
    for (const [ pack, file, text ] of files)
    {
        const target = path.join(Root, pack, "bedform_common", file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, text);
    }

    await GenerateDirectionPreviews(path.join(Root, "resource_packs/bedform_common"));
    await GenerateTransactionalIcons(path.join(Root, "resource_packs/bedform_common"));
    await build({ absWorkingDir: Root,
        bundle: true,
        entryPoints: [ "Script/Main.ts" ],
        external: [ "@minecraft/server" ],
        format: "esm",
        legalComments: "none",
        logLevel: "warning",
        outfile: "behavior_packs/bedform_common/scripts/main.js",
        target: "es2022" });
}

/**
 * Writes bedform-common.mcaddon containing the behavior and resource mcpack files.
 * The optional output directory supports isolated callers without invoking Bedform.
 *
 * @category Serialization
 * @since 1.0.0
 */
export async function Build(outputDirectory: string = path.join(Root, "dist")): Promise<string>
{
    const presentation = Presentation(
        JSON.parse(await readFile(path.join(Root, "Assets/player.vanilla.json"), "utf8")),
        JSON.parse(await readFile(path.join(Root, "Assets/player.client.vanilla.json"), "utf8")),
        { ActiveProperty: EntityProperty.CameraActive,
            LockEvent: EntityEvent.Lock,
            LockedGroup: EntityGroup.Locked,
            Preset: CameraPreset,
            UnlockEvent: EntityEvent.Unlock }
    );
    for (const [ pack, file, value ] of [
        [ "behavior_packs", "entities/player.json", presentation.Behavior ],
        [ "behavior_packs", "cameras/presets/diagetic_snapshot.json", presentation.Preset ],
        [ "resource_packs", "entity/player.entity.json", presentation.Client ]
    ] as const)
    {
        const target = path.join(Root, pack, "bedform_common", file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, JSON.stringify(value, null, 2) + "\n");
    }

    await Generate();
    const license = await readFile(path.join(Root, "Assets/License.Mojang.txt"));
    for (const kind of [ "behavior_packs", "resource_packs" ])
    {
        await writeFile(path.join(Root, kind, "bedform_common/License.Mojang.txt"), license);
    }

    const behavior = await Archive(path.join(Root, "behavior_packs/bedform_common"));
    const resource = await Archive(path.join(Root, "resource_packs/bedform_common"));
    const bytes = zipSync({
        "bedform-common-bp.mcpack": [ behavior, { mtime: Stamp } ],
        "bedform-common-rp.mcpack": [ resource, { mtime: Stamp } ]
    });
    await mkdir(outputDirectory, { recursive: true });
    const output = path.join(outputDirectory, "bedform-common.mcaddon");
    await writeFile(output, bytes);
    return output;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    console.log(await Build());
}
