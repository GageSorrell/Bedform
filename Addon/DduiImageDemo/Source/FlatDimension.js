/**
 * A custom flat grass dimension: registered at startup, generated as void by
 * the engine, and given a superflat-style floor by script, around its spawn
 * and around every player in it.
 *
 * @module @sorrell/ddui-image-demo/FlatDimension
 *
 * @file      FlatDimension.js
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */
import { BlockVolume, system, world } from "@minecraft/server";
import { CustomDimension, TickingArea } from "./Keys.js";

/**
 * The floor's layers from the dimension's lowest block up, as in the
 * overworld's default superflat: bedrock, two dirt and grass on top.
 *
 * @category Constant
 * @since 1.1.72
 */
export const FlatLayers = Object.freeze([
    Object.freeze({ Height: 1, Type: "minecraft:bedrock" }),
    Object.freeze({ Height: 2, Type: "minecraft:dirt" }),
    Object.freeze({ Height: 1, Type: "minecraft:grass_block" })
]);

/** Chunks each way from the origin that the spawn ticking area keeps loaded: 6 by 6 chunks. */
const SpawnChunks = 3;
/** Chunks each way from a player in the dimension whose floor is laid as they load. */
const PlayerChunks = 4;
/** Chunks whose floor is known to be laid, as "x,z" chunk coordinates. */
const Laid = new Set();
/** Calls waiting for the spawn area's floor. */
const Waiting = [];
let Ready = false;

system.beforeEvents.startup.subscribe(({ dimensionRegistry }) =>
{
    dimensionRegistry.registerCustomDimension(CustomDimension.Flat);
});

/**
 * The flat dimension.
 *
 * @category Running
 * @since 1.1.72
 */
export function FlatDimension()
{
    return world.getDimension(CustomDimension.Flat);
}

/**
 * The y of the flat dimension's ground top: the top of its grass, where a
 * player's feet stand.
 *
 * @category Running
 * @since 1.1.72
 */
export function FlatGroundTop()
{
    return FlatDimension().heightRange.min + FlatLayers.reduce((Sum, { Height }) => Sum + Height, 0);
}

/**
 * Lays the floor in one chunk if it is loaded and has none yet, returning
 * whether the chunk has its floor. A chunk whose lowest corner is already
 * bedrock was laid before, on this run or an earlier one, and is left alone.
 */
function LayChunk(Dimension, ChunkX, ChunkZ)
{
    const Key = `${ChunkX},${ChunkZ}`;
    if (Laid.has(Key)) return true;
    const Bottom = Dimension.heightRange.min;
    const Corner = { x: ChunkX * 16, y: Bottom, z: ChunkZ * 16 };
    if (!Dimension.isChunkLoaded(Corner)) return false;
    if (Dimension.getBlock(Corner)?.typeId !== FlatLayers[0].Type)
    {
        let Y = Bottom;
        for (const { Height, Type } of FlatLayers)
        {
            const From = { x: Corner.x, y: Y, z: Corner.z };
            const To = { x: Corner.x + 15, y: Y + Height - 1, z: Corner.z + 15 };
            Dimension.fillBlocks(new BlockVolume(From, To), Type);
            Y += Height;
        }
    }

    Laid.add(Key);
    return true;
}

/**
 * Prepares the dimension once the world has loaded: a ticking area keeps the
 * spawn area's chunks loaded and ticking, so entities there move with no
 * player nearby, and once they are loaded every one gets its floor. Calls
 * waiting in `WhenFlatReady` then run.
 *
 * @category Running
 * @since 1.1.72
 */
export async function PrepareFlatDimension()
{
    const Dimension = FlatDimension();
    const Bottom = Dimension.heightRange.min;
    const Options = {
        dimension: Dimension,
        from: { x: -SpawnChunks * 16, y: Bottom, z: -SpawnChunks * 16 },
        to: { x: SpawnChunks * 16 - 1, y: Bottom + 8, z: SpawnChunks * 16 - 1 }
    };
    const Manager = world.tickingAreaManager;
    if (Manager.hasTickingArea(TickingArea.FlatSpawn)) Manager.removeTickingArea(TickingArea.FlatSpawn);
    if (!Manager.hasCapacity(Options))
    {
        throw new Error("No ticking capacity for the flat spawn area " +
            `(${Manager.chunkCount} of ${Manager.maxChunkCount} chunks used).`);
    }

    await Manager.createTickingArea(TickingArea.FlatSpawn, Options);
    let Missing = 0;
    for (let X = -SpawnChunks; X < SpawnChunks; X++)
    {
        for (let Z = -SpawnChunks; Z < SpawnChunks; Z++)
        {
            if (!LayChunk(Dimension, X, Z)) Missing++;
        }
    }

    if (Missing > 0) throw new Error(`${Missing} spawn chunks of the flat dimension were not loaded.`);
    Ready = true;
    console.warn(`FLAT_DIMENSION_READY ${Dimension.id}, ground top ${FlatGroundTop()}, ` +
        `${(2 * SpawnChunks) ** 2} spawn chunks ticking`);
    for (const Call of Waiting.splice(0)) Call();
}

/**
 * Runs `Call` once the spawn area's floor is laid: now, or when
 * `PrepareFlatDimension` finishes.
 *
 * @category Running
 * @since 1.1.72
 */
export function WhenFlatReady(Call)
{
    if (Ready) Call();
    else Waiting.push(Call);
}

/**
 * Moves a player to the flat dimension's spawn, on the ground at the middle of
 * block 0, 0, looking south, once its floor is ready.
 *
 * @category Running
 * @since 1.1.72
 */
export function MoveToFlat(Player)
{
    WhenFlatReady(() =>
    {
        if (!Player.isValid) return;
        const Spawn = { x: 0.5, y: FlatGroundTop(), z: 0.5 };
        Player.teleport(Spawn, { dimension: FlatDimension(), rotation: { x: 0, y: 0 } });
    });
}

// Lays the floor of the chunks around every player in the dimension as they load.
system.runInterval(() =>
{
    if (!Ready) return;
    try
    {
        const Dimension = FlatDimension();
        for (const Player of Dimension.getPlayers())
        {
            const ChunkX = Math.floor(Player.location.x / 16);
            const ChunkZ = Math.floor(Player.location.z / 16);
            for (let X = ChunkX - PlayerChunks; X <= ChunkX + PlayerChunks; X++)
            {
                for (let Z = ChunkZ - PlayerChunks; Z <= ChunkZ + PlayerChunks; Z++)
                {
                    LayChunk(Dimension, X, Z);
                }
            }
        }
    }
    catch (Error)
    {
        console.error(`Flat dimension floor: ${Error?.stack ?? Error}`);
    }
}, 10);
