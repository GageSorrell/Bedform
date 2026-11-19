/** @file world.mts Allocate fresh native actor sessions when reopening minimal demonstration fixtures. */

import { repairBiomeOverride, topLevelTags } from "../../../level-dat.mts";

/**
 * Preserve other NBT bytes while allocating a fresh actor session and removing empty biome overrides.
 *
 * @throws { Error } If the native session counter is exhausted or the NBT header is invalid.
 */
export function prepareWorld(bytes: Buffer): Buffer
{
    const output = Buffer.from(repairBiomeOverride(bytes).bytes);
    const counter = topLevelTags(output).find((tag) => tag.name === "worldStartCount" && tag.type === 4);
    if (counter)
    {
        const value = output.readBigInt64LE(counter.end - 8);
        if (value === -(2n ** 63n))
        {
            throw new Error("World actor-session counter is exhausted");
        }

        output.writeBigInt64LE(value - 1n, counter.end - 8);
    }

    return output;
}
