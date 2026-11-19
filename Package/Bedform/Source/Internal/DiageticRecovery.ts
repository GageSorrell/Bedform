/**
 * Write-ahead player recovery receipts and independently attempted camera, permission and tag cleanup.
 *
 * @module bedform/Internal/DiageticRecovery
 *
 * @file      DiageticRecovery.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Journal and restoration order follow the acquisition transaction. */
/* eslint-disable sort-keys */

import { DynamicProperty, DynamicPropertyPrefix, EntityEvent, NativePermission, TagPrefix } from
    "../Diagetic/Keys.js";
import type { Entity, InputPermissionCategory, Player, Vector2, World } from "@minecraft/server";
import { RestoreCamera } from "../Diagetic/Camera.js";

/**
 * Original permissions and orientation, recorded before any player or ownership mutation.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Receipt
{
    readonly Version: 1;
    readonly Player: string;
    readonly Actor: string;
    readonly Dimension: string;
    readonly Tag: string;
    readonly Rotation: Readonly<Vector2>;
    readonly Permissions: ReadonlyArray<readonly [InputPermissionCategory, boolean]>;
}

/**
 * Exact persisted bytes used to fence stale recovery and cleanup attempts.
 *
 * @category Model
 * @since 1.0.0
 */
export interface Journal
{
    readonly Raw: string;
    readonly Receipt: Receipt;
}

/**
 * Copies a finite native pitch/yaw sample.
 *
 * @throws { Error } If a rotation is malformed.
 *
 * @category Validation
 * @since 1.0.0
 */
export const Rotation = (value: Readonly<Vector2>): Readonly<Vector2> =>
{
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y) || Math.abs(value.x) > 90)
    {
        throw new Error("Invalid Diagetic recovery rotation");
    }

    return Object.freeze({ x: value.x,
        y: value.y });
};

/**
 * Loads and validates a receipt without granting defaults or replacing corrupt data.
 *
 * @throws { Error } If a stored receipt is malformed or belongs to a different player.
 *
 * @category Decoding
 * @since 1.0.0
 */
export const ReadJournal = (world: World, playerId: string): Journal | undefined =>
{
    const raw = world.getDynamicProperty(DynamicPropertyPrefix.Recovery + playerId);
    if (raw === undefined)
    {
        return undefined;
    }

    if (typeof raw !== "string" || raw.length > 4_096)
    {
        throw new Error("Malformed Diagetic recovery receipt; acquisition is blocked");
    }

    const receipt = JSON.parse(raw) as Receipt;
    const categories = Object.values(NativePermission);
    if (!receipt || receipt.Version !== 1 || receipt.Player !== playerId ||
        typeof receipt.Actor !== "string" || !receipt.Actor ||
        typeof receipt.Dimension !== "string" || !receipt.Dimension ||
        typeof receipt.Tag !== "string" || !receipt.Tag.startsWith(TagPrefix.Session) ||
        receipt.Tag.length > 255 || !Array.isArray(receipt.Permissions) ||
        receipt.Permissions.length !== categories.length || receipt.Permissions.some(
        (entry: readonly [InputPermissionCategory, boolean], index: number) =>
            !Array.isArray(entry) || entry.length !== 2 || entry[0] !== categories[index] ||
                typeof entry[1] !== "boolean"))
    {
        throw new Error("Malformed Diagetic recovery receipt; acquisition is blocked");
    }

    Rotation(receipt.Rotation);
    return { Raw: raw,
        Receipt: receipt };
};

/**
 * Commits original state before claiming native tags or changing permissions and camera presentation.
 *
 * @throws { Error } If a receipt already exists or persistence cannot commit.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const PrepareJournal = (world: World, player: Player, actor: Entity, tick: number): Journal =>
{
    const key = DynamicPropertyPrefix.Recovery + player.id;
    if (world.getDynamicProperty(key) !== undefined)
    {
        throw new Error("Diagetic player requires recovery before acquisition");
    }

    const previous = world.getDynamicProperty(DynamicProperty.Sequence) ?? 0;
    if (typeof previous !== "number" || !Number.isSafeInteger(previous) || previous < 0 ||
        previous >= Number.MAX_SAFE_INTEGER)
    {
        throw new Error("Invalid Diagetic recovery sequence");
    }

    const receipt: Receipt = {
        Version: 1,
        Player: player.id,
        Actor: actor.id,
        Dimension: player.dimension.id,
        Tag: TagPrefix.Session + (previous + 1).toString(36) + ":" + tick.toString(36) + ":" +
            Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
        Rotation: Rotation(player.getRotation()),
        Permissions: Object.values(NativePermission).map((category: InputPermissionCategory) =>
            [ category, player.inputPermissions.isPermissionCategoryEnabled(category) ] as const)
    };
    const raw = JSON.stringify(receipt);
    world.setDynamicProperty(DynamicProperty.Sequence, previous + 1);
    world.setDynamicProperty(key, raw);
    if (world.getDynamicProperty(key) !== raw)
    {
        throw new Error("Diagetic recovery receipt did not commit");
    }

    return { Raw: raw,
        Receipt: receipt };
};

/**
 * Restores each player resource even if a preceding operation fails. Receipts are removed only after
 * all restoration succeeds; stale bytes and foreign ownership prevent cleanup from touching a new session.
 * Unloaded actor tags become orphaned and are retired on their next load or interaction.
 *
 * @category ResourceManagement
 * @since 1.0.0
 */
export const RestoreJournal = (world: World, player: Player, journal: Journal): Array<unknown> =>
{
    const errors: Array<unknown> = [];
    const attempt = (action: () => void): void =>
    {
        try
        {
            action();
        }
        catch (error)
        {
            errors.push(error);
        }
    };

    const { Receipt: receipt, Raw: raw } = journal;
    const key = DynamicPropertyPrefix.Recovery + receipt.Player;
    try
    {
        if (world.getDynamicProperty(key) !== raw || !player.isValid ||
            player.getTags().some((tag: string) => tag.startsWith(TagPrefix.Session) && tag !== receipt.Tag))
        {
            throw new Error("Diagetic recovery is stale, unavailable or blocked by another owner");
        }
    }
    catch (error)
    {
        return [ error ];
    }

    attempt(() => player.teleport(player.location, { rotation: receipt.Rotation }));
    attempt(() => RestoreCamera(player.camera));
    attempt(() => player.triggerEvent(EntityEvent.Unlock));
    for (const [ category, enabled ] of receipt.Permissions)
    {
        attempt(() => player.inputPermissions.setPermissionCategory(category, enabled));
    }

    attempt(() => player.onScreenDisplay.setActionBar(""));
    if (errors.length === 0)
    {
        attempt(() =>
        {
            const actor = world.getEntity(receipt.Actor);
            if (actor?.isValid)
            {
                actor.removeTag(receipt.Tag);
            }
        });
        if (errors.length === 0)
        {
            attempt(() => player.removeTag(receipt.Tag));
        }

        if (errors.length === 0)
        {
            attempt(() =>
            {
                if (world.getDynamicProperty(key) !== raw)
                {
                    throw new Error("Diagetic recovery receipt changed during restoration");
                }

                world.setDynamicProperty(key, undefined);
                if (world.getDynamicProperty(key) !== undefined)
                {
                    throw new Error("Diagetic recovery receipt was not cleared");
                }
            });
        }
    }

    return errors;
};
