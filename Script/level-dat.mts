/** @file level-dat.mts Node tooling for level-dat. */
// Bedrock level.dat helpers: an 8-byte header (storage version, body length) followed by little-endian NBT.
// Only the top-level compound is edited; every other byte is copied unchanged.
const END = 0;
const STRING = 8;
const LIST = 9;
const COMPOUND = 10;
const FIXED: Record<number, number> = { 1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 4,
    6: 8 };
const ARRAY: Record<number, number> = { 11: 4,
    12: 8,
    7: 1 };

/** Locate the byte immediately after an NBT string. */
function stringEnd(bytes: Buffer, at: number)
{
    return at + 2 + bytes.readUInt16LE(at);
}

// Returns the offset just past the payload of a tag of the given type that starts at `at`.

/**
 * Skip one NBT payload, including nested compounds and lists.
 * @throws {Error} If the payload uses an unknown tag type.
 */
function skipPayload(bytes: Buffer, type: number, at: number)
{
    if (type in FIXED)
    {
        return at + FIXED[type];
    }

    if (type in ARRAY)
    {
        return at + 4 + bytes.readInt32LE(at) * ARRAY[type];
    }

    if (type === STRING)
    {
        return stringEnd(bytes, at);
    }

    if (type === LIST)
    {
        const item = bytes[at];
        const count = bytes.readInt32LE(at + 1);
        let next = at + 5;
        for (let index = 0; index < count; index++)
        {
            next = skipPayload(bytes, item, next);
        }

        return next;
    }

    if (type === COMPOUND)
    {
        let next = at;
        while (bytes[next] !== END)
        {
            next = skipPayload(bytes, bytes[next], stringEnd(bytes, next + 1));
        }

        return next + 1;
    }

    throw new Error(`Unknown NBT tag type ${type} at byte ${at}`);
}

/**
 * Return the top-level tags and their complete byte ranges.
 * @throws {Error} If the header or root compound is invalid.
 */
export function topLevelTags(bytes: Buffer)
{
    if (bytes.readInt32LE(4) !== bytes.length - 8)
    {
        throw new Error("level.dat length header does not match the file");
    }

    if (bytes[8] !== COMPOUND)
    {
        throw new Error("level.dat does not start with a compound");
    }

    const tags = [];
    let at = stringEnd(bytes, 9);
    while (bytes[at] !== END)
    {
        const type = bytes[at];
        const nameEnd = stringEnd(bytes, at + 1);
        const end = skipPayload(bytes, type, nameEnd);
        tags.push({
            end,
            name: bytes.toString("utf8", at + 3, nameEnd),
            start: at,
            type,
            value: type === STRING ? bytes.toString("utf8", nameEnd + 2, end) : undefined
        });
        at = end;
    }

    if (at + 1 !== bytes.length)
    {
        throw new Error("level.dat has data after its root compound");
    }

    return tags;
}

/**
 * BDS 1.26.5x prepends "minecraft:" to BiomeOverride every time it loads a world that has the
 * field, so a world without a single-biome override grows "minecraft:minecraft:...". Without the
 * field, BDS keeps an empty override for the session. Removes the field only when it holds no
 * biome (empty or nothing but "minecraft:" prefixes); returns the new bytes and what it did.
 */
export function repairBiomeOverride(bytes: Buffer)
{
    const tag = topLevelTags(bytes).find(
        ({
            name
        }: {
            end: number;
            name: string;
            start: number;
            type: number;
            value: string | undefined;
        }) => name === "BiomeOverride"
    );
    if (!tag)
    {
        return { bytes,
            status: "absent" };
    }

    if (tag.type !== STRING || !/^(minecraft:)*$/.test(tag.value ?? ""))
    {
        return { bytes,
            status: "kept",
            value: tag.value };
    }

    const repaired = Buffer.concat([ bytes.subarray(0, tag.start), bytes.subarray(tag.end) ]);
    repaired.writeInt32LE(repaired.length - 8, 4);
    return {
        bytes: repaired,
        prefixes: tag.value!.length / "minecraft:".length,
        status: "removed"
    };
}
