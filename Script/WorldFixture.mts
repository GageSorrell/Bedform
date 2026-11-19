/**
 * Disposable BDS world fixtures for Bedform tools, demonstrations and tests.
 *
 * @module bedform-monorepo/Script/WorldFixture
 *
 * @file      WorldFixture.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   SEE LICENSE IN License.md
 */

/**
 * Computes world fixture for BuildCraft world fixture operations.
 *
 * @category Runtime
 * @since 1.2.5
 */
export function WorldFixture(
    gametest: boolean = false,
    normal: boolean = false,
    nativeContainers: boolean = false
)
{
    const chunks: Array<Buffer> = [];
    const byte = (value: number) => chunks.push(Buffer.from([ value ]));
    const int = (value: number) =>
    {
        const b = Buffer.alloc(4);
        b.writeInt32LE(value);
        chunks.push(b);
    };

    const string = (value: string) =>
    {
        const b = Buffer.from(value);
        const n = Buffer.alloc(2);
        n.writeUInt16LE(b.length);
        chunks.push(n, b);
    };

    const named = (type: number, name: string, fn: () => void) =>
    {
        byte(type);
        string(name);
        fn();
    };

    const compound = (name: string, fn: () => void) =>
        named(10, name, () =>
        {
            fn();
            byte(0);
        });
    compound("", () =>
    {
        for (const [ name, value ] of Object.entries({
            GameType: 1,
            Generator: normal ? 1 : 2,
            SpawnX: 0,
            SpawnY: 100,
            SpawnZ: 0
        }))
        {
            named(3, name, () => int(value));
        }

        named(4, "RandomSeed", () =>
        {
            const seed = Buffer.alloc(8);
            seed.writeBigInt64LE(728n);
            chunks.push(seed);
        });
        named(4, "Time", () => chunks.push(Buffer.alloc(8)));
        named(4, "worldStartCount", () =>
        {
            const count = Buffer.alloc(8);
            count.writeBigInt64LE(1n);
            chunks.push(count);
        });
        for (const name of [ "commandsEnabled", "hasBeenLoadedInCreative" ])
        {
            named(1, name, () => byte(1));
        }

        named(8, "FlatWorldLayers", () =>
            string(
                JSON.stringify({
                    biome_id: 1,
                    block_layers: [
                        {
                            block_name: "minecraft:bedrock",
                            count: 1
                        },
                        {
                            block_name: "minecraft:dirt",
                            count: 2
                        },
                        {
                            block_name: "minecraft:grass_block",
                            count: 1
                        }
                    ],
                    encoding_version: 6,
                    structure_options: null,
                    world_version: "version.post_1_18"
                })
            )
        );
        if (gametest || nativeContainers)
        {
            compound("experiments", () =>
            {
                for (const name of [
                    ...(gametest ? [ "gametest" ] : []),
                    ...(nativeContainers ? [ "upcoming_creator_features" ] : []),
                    "experiments_ever_used",
                    "saved_with_toggled_experiments"
                ])
                {
                    named(1, name, () => byte(1));
                }
            });
        }
    });
    const data = Buffer.concat(chunks);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(10);
    header.writeUInt32LE(data.length, 4);
    return Buffer.concat([ header, data ]);
}

/**
 * Computes counter offset for BuildCraft world fixture operations.
 *
 * @throws { Error } Invalid level.dat header.
 *
 * @throws { Error } Missing/ambiguous world session counter.
 *
 * @category Runtime
 * @since 1.2.5
 */
function counterOffset(bytes: Buffer)
{
    if (bytes.length < 8 || bytes.readUInt32LE(4) !== bytes.length - 8)
    {
        throw new Error("Invalid level.dat header");
    }

    const name = Buffer.from("worldStartCount");
    const length = Buffer.alloc(2);
    length.writeUInt16LE(name.length);
    const tag = Buffer.concat([ Buffer.from([ 4 ]), length, name ]);
    const index = bytes.indexOf(tag, 8);
    if (
        index < 0 ||
        bytes.indexOf(tag, index + tag.length) >= 0 ||
        index + tag.length + 8 > bytes.length
    )
    {
        throw new Error("Missing/ambiguous world session counter");
    }

    return index + tag.length;
}

/**
 * Computes world session counter for BuildCraft world fixture operations.
 *
 * @category Runtime
 * @since 1.2.5
 */
export const WorldSessionCounter = (bytes: Buffer) =>
    bytes.readBigInt64LE(counterOffset(bytes));

/**
 * Persists world session for BuildCraft world fixture operations.
 *
 * @throws { Error } World session counter unexpectedly increased.
 *
 * @category Runtime
 * @since 1.2.5
 */
export function PersistWorldSession(bytes: Buffer, previous: bigint)
{
    const output = Buffer.from(bytes);
    const offset = counterOffset(output);
    const current = output.readBigInt64LE(offset);
    // Minimal generated worlds do not always rewrite their level.dat on BDS stop.
    // Preserve the native session allocator across launches of this disposable
    // fixture, or new actors can collide with actors saved by the prior launch.
    if (current === previous)
    {
        output.writeBigInt64LE(previous - 1n, offset);
    }
    else if (current > previous)
    {
        throw new Error("World session counter unexpectedly increased");
    }

    return output;
}
