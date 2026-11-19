/**
 * Packages disposable local worlds with explicit pack orders, without modifying an installation.
 *
 * @module @sorrell/documentation-probe/Tool/Worlds
 *
 * @file      Worlds.mjs
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { Json, Root, Stamp } from "./Build.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { strToU8, unzipSync, zipSync } from "fflate";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Encodes the small little-endian NBT subset needed for a fresh Creative world.
 *
 * @category Encoding
 * @since 1.0.12
 */
function Tag(name, value)
{
    const key = Buffer.from(name);
    const header = Buffer.alloc(3);
    header[0] = typeof value === "string" ? 8 : 3;
    header.writeUInt16LE(key.length, 1);
    let payload;
    if (typeof value === "string")
    {
        const text = Buffer.from(value);
        const length = Buffer.alloc(2);
        length.writeUInt16LE(text.length);
        payload = Buffer.concat([ length, text ]);
    }
    else
    {
        payload = Buffer.alloc(4);
        payload.writeInt32LE(value);
    }

    return Buffer.concat([ header, key, payload ]);
}

/**
 * Encodes a Creative grass-flat fixture with a plains biome and spawn on the grass surface.
 *
 * @category Encoding
 * @since 1.0.12
 */
export function Level(name)
{
    const layers = JSON.stringify({
        biome_id: 1,
        block_layers: [
            { block_name: "minecraft:bedrock",
                count: 1 },
            { block_name: "minecraft:dirt",
                count: 2 },
            { block_name: "minecraft:grass_block",
                count: 1 }
        ],
        encoding_version: 6,
        structure_options: null,
        world_version: "version.post_1_18"
    });
    const body = Buffer.concat([ Buffer.from([ 10, 0, 0 ]),
        Tag("LevelName", name), Tag("StorageVersion", 10), Tag("Generator", 2),
        Tag("FlatWorldLayers", layers),
        Tag("GameType", 1), Tag("Difficulty", 0), Tag("SpawnX", 0), Tag("SpawnY", -60),
        Tag("SpawnZ", 0), Buffer.from([ 0 ]) ]);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(10);
    header.writeUInt32LE(body.length, 4);
    return Buffer.concat([ header, body ]);
}

/**
 * Reads already built packs; it never combines or rewrites their UI definitions.
 *
 * @category Serialization
 * @since 1.0.12
 */
export async function Worlds(directory = path.join(Root, "dist"))
{
    const packs = {

    };
    for (const id of [ "common", "alpha", "beta" ])
    {
        packs[id] = unzipSync(await readFile(path.join(directory, `docs-probe-${id}.mcpack`)));
    }

    for (const order of [ [ "alpha", "beta", "common" ], [ "beta", "alpha", "common" ],
        [ "alpha", "common" ], [ "beta", "common" ] ])
    {
        const suffix = order.filter((id) => id !== "common").join("-");
        const manifestVersion = JSON.parse(Buffer.from(packs.common["manifest.json"]).toString())
            .header.version.join(".");
        const name = `Docs ${manifestVersion} grass ${suffix}`;
        const entries = {
            "level.dat": Level(name),
            "levelname.txt": strToU8(name)
        };
        const refs = [];
        for (const id of order)
        {
            const manifest = JSON.parse(Buffer.from(packs[id]["manifest.json"]).toString());
            refs.push({
                pack_id: manifest.header.uuid,
                version: manifest.header.version
            });
            for (const [ file, bytes ] of Object.entries(packs[id]))
            {
                entries[`resource_packs/docs_probe_${id}/${file}`] = bytes;
            }
        }

        entries["world_resource_packs.json"] = strToU8(Json(refs));
        const bytes = zipSync(
            Object.fromEntries(Object.entries(entries).map(([ file, bytes ]) => [ file, [ bytes, {
                mtime: Stamp
            } ] ]))
        );
        await writeFile(path.join(directory, `docs-probe-${manifestVersion}-${suffix}.mcworld`), bytes);
        await writeFile(path.join(directory, `docs-probe-${manifestVersion}-${suffix}-grass.mcworld`), bytes);
        await writeFile(path.join(directory, `docs-probe-${suffix}.mcworld`), bytes);
        console.log(`Prepared ${name}: ${refs.length} resource packs.`);
    }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
{
    await Worlds();
}
