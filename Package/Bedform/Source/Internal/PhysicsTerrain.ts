/**
 * Bounded terrain permutation resolution in block-local coordinates.
 *
 * @module bedform/Internal/PhysicsTerrain
 *
 * @file      PhysicsTerrain.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Geometry records preserve axis ordering and contextual inference. */
/* eslint-disable @typescript-eslint/typedef, @stylistic/max-len */

import * as B from "../AABB.js";
import * as V from "../Vector3.js";

/**
 * One loaded block permutation. Undefined reads mean unavailable terrain, never air.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Block
{
    readonly identifier: string;
    readonly states: Readonly<Record<string, string | number | boolean>>;
    readonly solid: boolean;
}

/**
 * Local collision boxes; undefined delegates to the next resolver. Neighbor offsets
 * are relative to the queried block and share the runtime's per-tick read cache.
 *
 * @category Types
 * @since 1.0.0
 */
export type Resolver = (block: Block, neighbor: (x: number, y: number, z: number) => Block) => ReadonlyArray<B.AABB> | undefined;

/**
 * Exactly coalesces rectangular neighbors with identical spans on the other two
 * axes. No holes, steps or cavities are filled; no tolerance expands the union.
 *
 * @category Terrain
 * @since 1.0.0
 */
export const coalesce = (input: ReadonlyArray<B.AABB>): ReadonlyArray<B.AABB> =>
{
    let boxes = [ ...input ];
    for (const Axis of [ "x", "z", "y" ] as const)
    {
        const Others = ([ "x", "y", "z" ] as const).filter((axis) => axis !== Axis);
        const Groups = new Map<string, Array<B.AABB>>();
        for (const Box of boxes)
        {
            const Key = Others.map((axis) => `${Box.min[axis]},${Box.max[axis]}`).join(";");
            const Group = Groups.get(Key) ?? [];
            Group.push(Box);
            Groups.set(Key, Group);
        }

        boxes = [];
        for (const Group of Groups.values())
        {
            Group.sort((a, b) => a.min[Axis] - b.min[Axis] || a.max[Axis] - b.max[Axis]);
            let current = Group[0];
            for (let index = 1; index < Group.length; index++)
            {
                const Next = Group[index];
                if (Next.min[Axis] <= current.max[Axis])
                {current = B.AABBUnsafe(V.min(current.min, Next.min), V.max(current.max, Next.max));}
                else
                {
                    boxes.push(current);
                    current = Next;
                }
            }

            boxes.push(current);
        }
    }

    return Object.freeze(boxes);
};

/**
 * Immutable block-local box.
 *
 * @category Internal
 * @since 1.0.0
 */
const box = (x = 0, y = 0, z = 0, xx = 1, yy = 1, zz = 1): B.AABB =>
{
    return B.AABBUnsafe(V.Vector3Unsafe(x, y, z), V.Vector3Unsafe(xx, yy, zz));
};

/**
 * Rotates north-facing boxes clockwise around the block center.
 *
 * @category Internal
 * @since 1.0.0
 */
const turn = (value: B.AABB, count: number): B.AABB =>
{
    let result = value;
    for (let i = 0; i < count; i++)
    {
        result = box(1 - result.max.z, result.min.y, result.min.x, 1 - result.min.z, result.max.y, result.max.x);
    }

    return result;
};

/**
 * Explicit vanilla families; unrecognized solid blocks use a reported full cube.
 * Connected shapes consult loaded neighbors; missing neighbors pause their users.
 *
 * @category Terrain
 * @since 1.0.0
 */
export const vanilla: Resolver = (block, neighbor) =>
{
    const Id = block.identifier;
    const S = block.states;
    if (!Id.startsWith("minecraft:"))
    {
        return undefined;
    }

    const Name = Id.slice(10);
    // Vanilla signs and buttons have selection boxes but no physical collision.
    if (Name.endsWith("_button") || Name === "wall_sign" || Name === "standing_sign" ||
        Name.endsWith("_wall_sign") || Name.endsWith("_standing_sign") || Name.endsWith("_hanging_sign"))
    {
        return [];
    }

    if ([ "air", "cave_air", "void_air", "water", "flowing_water", "lava", "flowing_lava", "fire", "soul_fire", "light_block", "structure_void" ].includes(Name))
    {
        return [];
    }

    if (Name.includes("double") && Name.includes("slab"))
    {
        return [ box() ];
    }

    if (Name.includes("slab"))
    {
        const Top = S["minecraft:vertical_half"] === "top" || S.top_slot_bit === true;
        return [ box(0, Top ? 0.5 : 0, 0, 1, Top ? 1 : 0.5, 1) ];
    }

    if (Name.endsWith("stairs"))
    {
        const Top = S.upside_down_bit === true;
        const Direction = Number(S.weirdo_direction ?? 0);
        const Rotation = [ 1, 3, 2, 0 ][Direction];
        const Base = box(0, Top ? 0.5 : 0, 0, 1, Top ? 1 : 0.5, 1);
        const Vectors = [ [ 1, 0 ], [ -1, 0 ], [ 0, 1 ], [ 0, -1 ] ] as const;
        const [ Dx, Dz ] = Vectors[Direction];
        const Compatible = (value: Block): boolean => value.identifier.endsWith("stairs") && (value.states.upside_down_bit === true) === Top;
        const Half = (direction: number, x: number, z: number): boolean => [ x === 1, x === 0, z === 1, z === 0 ][direction];
        let otherDirection: number | undefined;
        let outer = false;
        const Front = neighbor(Dx, 0, Dz);
        const Back = neighbor(-Dx, 0, -Dz);
        for (const [ Candidate, IsOuter ] of [ [ Front, true ], [ Back, false ] ] as const)
        {
            if (!Compatible(Candidate))
            {
                continue;
            }

            const Facing = Number(Candidate.states.weirdo_direction ?? 0);
            if ((Facing < 2) === (Direction < 2))
            {
                continue;
            }

            const [ SideX, SideZ ] = Vectors[Facing];
            const Side = neighbor(SideX * (IsOuter ? -1 : 1), 0, SideZ * (IsOuter ? -1 : 1));
            if (Compatible(Side) && Number(Side.states.weirdo_direction ?? 0) === Direction)
            {
                continue;
            }

            otherDirection = Facing;
            outer = IsOuter;
            break;
        }

        if (otherDirection === undefined)
        {
            return [ Base, turn(box(0, Top ? 0 : 0.5, 0, 1, Top ? 0.5 : 1, 0.5), Rotation) ];
        }

        const Boxes = [ Base ];
        for (const X of [ 0, 1 ])
        {
            for (const Z of [ 0, 1 ])
            {
                const A = Half(Direction, X, Z);
                const Other = Half(otherDirection, X, Z);
                if (outer ? A && Other : A || Other)
                {
                    Boxes.push(box(X / 2, Top ? 0 : 0.5, Z / 2, (X + 1) / 2, Top ? 0.5 : 1, (Z + 1) / 2));
                }
            }
        }

        return Boxes;
    }

    if (Name.endsWith("trapdoor"))
    {
        if (S.open_bit === true)
        {
            return [ turn(box(0, 0, 0, 1, 1, 0.1875), [ 2, 0, 1, 3 ][Number(S.direction ?? 0)]) ];
        }

        return [ S.upside_down_bit === true ? box(0, 0.8125, 0) : box(0, 0, 0, 1, 0.1875, 1) ];
    }

    if (Name.endsWith("_door"))
    {
        const Lower = S.upper_block_bit === true ? neighbor(0, -1, 0) : block;
        const Upper = S.upper_block_bit === true ? block : neighbor(0, 1, 0);
        const Rotation = (Number(Lower.states.direction ?? 0) + (Lower.states.open_bit === true ? (Upper.states.door_hinge_bit === true ? 3 : 1) : 0)) % 4;
        return [ turn(box(0, 0, 0, 0.1875, 1, 1), Rotation) ];
    }

    if (Name.endsWith("fence_gate"))
    {
        return S.open_bit === true ? [] : [ turn(box(0, 0, 0.375, 1, 1.5, 0.625), Number(S.direction ?? 0) % 2) ];
    }

    if (Name.endsWith("_fence") || Name === "nether_brick_fence" || Name.endsWith("_wall"))
    {
        const Wall = Name.endsWith("_wall");
        const Boxes = [ box(Wall ? 0.25 : 0.375, 0, Wall ? 0.25 : 0.375, Wall ? 0.75 : 0.625, 1.5, Wall ? 0.75 : 0.625) ];
        for (const [ X, Z, Rotation, State ] of [ [ 0, -1, 0, "wall_connection_type_north" ], [ 1, 0, 1, "wall_connection_type_east" ], [ 0, 1, 2, "wall_connection_type_south" ], [ -1, 0, 3, "wall_connection_type_west" ] ] as const)
        {
            const Adjacent = neighbor(X, 0, Z);
            const Connect = Wall && S[State] !== undefined ? S[State] !== "none" : Adjacent.solid || Adjacent.identifier.endsWith("_fence") || Adjacent.identifier.endsWith("fence_gate");
            if (Connect)
            {
                Boxes.push(turn(box(Wall ? 0.3125 : 0.375, 0, 0, Wall ? 0.6875 : 0.625, 1.5, 0.5), Rotation));
            }
        }

        return Boxes;
    }

    if (Name === "snow_layer")
    {
        return Number(S.height ?? 0) === 0 ? [] : [ box(0, 0, 0, 1, Number(S.height) / 8, 1) ];
    }

    if (Name.endsWith("_carpet") || Name === "moss_carpet")
    {
        return [ box(0, 0, 0, 1, 0.0625, 1) ];
    }

    if (Name.endsWith("_pressure_plate"))
    {
        return [ box(0.0625, 0, 0.0625, 0.9375, S.redstone_signal ? 0.03125 : 0.0625, 0.9375) ];
    }

    if (Name === "farmland" || Name === "grass_path" || Name === "dirt_path")
    {
        return [ box(0, 0, 0, 1, 0.9375, 1) ];
    }

    if (Name === "soul_sand")
    {
        return [ box(0, 0, 0, 1, 0.875, 1) ];
    }

    if (Name.endsWith("_pane") || Name === "iron_bars")
    {
        const Boxes = [ box(0.4375, 0, 0.4375, 0.5625, 1, 0.5625) ];
        for (const [ X, Z, Rotation ] of [ [ 0, -1, 0 ], [ 1, 0, 1 ], [ 0, 1, 2 ], [ -1, 0, 3 ] ] as const)
        {
            const Adjacent = neighbor(X, 0, Z);
            if (Adjacent.solid || Adjacent.identifier.endsWith("_pane") || Adjacent.identifier === "minecraft:iron_bars")
            {
                Boxes.push(turn(box(0.4375, 0, 0, 0.5625, 1, 0.5), Rotation));
            }
        }

        return Boxes;
    }

    if (!block.solid)
    {
        return [];
    }

    // Known ordinary full-cube families avoid fallback noise; unfamiliar solids
    // remain observable even when their conservative shape happens to be correct.
    if (/^(stone|dirt|grass_block|cobblestone|bedrock|sand|gravel|obsidian|netherrack|end_stone)$/u.test(Name) || /(_planks|_log|_wood|_ore|_concrete|_wool|_terracotta)$/u.test(Name))
    {
        return [ box() ];
    }

    return undefined;
};

/**
 * Conservative reported fallback shared by custom and vanilla unknown solids.
 *
 * @category Constants
 * @since 1.0.0
 */
export const FullCube = Object.freeze([ box() ]);
