/**
 * Flat grass-world metadata for the disposable physics gallery.
 *
 * @module bedform/Tool/physics-client-world
 *
 * @file      physics-client-world.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint-disable @typescript-eslint/typedef */

import { topLevelTags } from "../../../Script/level-dat.mjs";

/**
 * Copies a template's metadata, replacing only gallery world settings. New chunks
 * have grass at y=98, with dirt below it and bedrock at y=-64. Existing worlds
 * are never edited: preparation writes these bytes into a new world directory.
 *
 * @category Fixtures
 * @since 1.0.0
 */
export const galleryLevel = (template: Buffer): Buffer =>
{
    const Tag = (name: string, value: string | number, byte = false): Buffer =>
    {
        const Name = Buffer.from(name);
        const Payload = typeof value === "string" ? Buffer.from(value) : Buffer.alloc(byte ? 1 : 4);
        const Header = Buffer.alloc(3 + Name.length + (typeof value === "string" ? 2 : 0));
        Header[0] = typeof value === "string" ? 8 : byte ? 1 : 3;
        Header.writeUInt16LE(Name.length, 1);
        Name.copy(Header, 3);
        if (typeof value === "string")
        {Header.writeUInt16LE(Payload.length, 3 + Name.length);}
        else if (byte)
        {Payload.writeInt8(value);}
        else
        {Payload.writeInt32LE(value);}

        return Buffer.concat([ Header, Payload ]);
    };

    const Replacements = new Map([
        [ "Generator", Tag("Generator", 2) ],
        [ "GameType", Tag("GameType", 1) ],
        [ "ForceGameType", Tag("ForceGameType", 1, true) ],
        [ "Difficulty", Tag("Difficulty", 0) ],
        [ "SpawnX", Tag("SpawnX", -8) ],
        [ "SpawnY", Tag("SpawnY", 99) ],
        [ "SpawnZ", Tag("SpawnZ", 6) ],
        [ "FlatWorldLayers", Tag("FlatWorldLayers", JSON.stringify({
            biome_id: 1,
            block_layers: [ { block_name: "minecraft:bedrock",
                count: 1 },
            { block_name: "minecraft:dirt",
                count: 161 },
            { block_name: "minecraft:grass_block",
                count: 1 } ],
            encoding_version: 6,
            structure_options: null,
            world_version: "version.post_1_18"
        })) ]
    ]);
    const Tags = topLevelTags(template);
    const Bytes = Buffer.concat([ template.subarray(0, Tags[0]?.start ?? template.length - 1),
        ...Tags.filter((tag) => !Replacements.has(tag.name))
            .map((tag) => template.subarray(tag.start, tag.end)),
        ...Replacements.values(), Buffer.from([ 0 ]) ]);
    Bytes.writeInt32LE(Bytes.length - 8, 4);
    return Bytes;
};
