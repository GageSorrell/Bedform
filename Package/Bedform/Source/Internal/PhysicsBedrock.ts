/**
 * Opt-in Bedrock ports for PhysicsRuntime; never imported by the pure root.
 *
 * @module bedform/Internal/PhysicsBedrock
 *
 * @file      PhysicsBedrock.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* eslint jsdoc/require-jsdoc: ["error", { "contexts": ["ExportNamedDeclaration > TSTypeAliasDeclaration",
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration > ClassDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"] }] */

/* Engine records retain contextual types and geometric axis order. */
/* eslint-disable @typescript-eslint/typedef, sort-imports, sort-keys, @stylistic/max-len */

import { system, world, type Entity } from "@minecraft/server";
import type { Host, Owner } from "../PhysicsRuntime.js";
import { DynamicProperty } from "../keys.js";
import * as B from "../AABB.js";
import * as V from "../Vector3.js";
import * as O from "@bedform/effect/Option";
import type * as N from "./PhysicsNative.js";
const ActiveNamespaces = new Set<string>();

/**
 * Namespace limits discovery and orphan cleanup to one generated physics pack.
 * Additional dimensions must be explicitly listed by the calling add-on.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Options
{
    readonly namespace: string;
    readonly dimensions?: ReadonlyArray<string>;
}

/**
 * Adapts a live entity without caching its dimension or location across ticks.
 *
 * @category Internal
 * @since 1.0.0
 */
const owner = (entity: Entity): Owner =>
{
    return Object.freeze({ id: entity.id,
        identifier: entity.typeId,
        dimension: () => entity.dimension.id,
        position: () => entity.location,
        loaded: () => entity.isValid,
        read: (key: string) => entity.getDynamicProperty(key),
        write: (key: string, value: string | undefined) =>
        {
            entity.setDynamicProperty(key, value);
        },
        property: (key: string, value: number) =>
        {
            entity.setProperty(key, value);
        },
        readProperty: (key: string) => entity.getProperty(key),
        move: (dimension: string, position: Parameters<Entity["teleport"]>[0]) =>
        {
            entity.teleport(position, { dimension: world.getDimension(dimension),
                rotation: { x: 0,
                    y: 0 } });
        },
        remove: () =>
        {
            if (entity.isValid)
            {
                entity.remove();
            }
        } });
};

/**
 * Creates inert ports. Subscriptions begin only when PhysicsRuntime.start calls them.
 * Entity AABBs are read from the engine by the native bridge, never inferred from IDs.
 * No automatic ticking areas, service processes or Node/browser globals are used.
 *
 * @throws { Error } Invalid custom pack namespace.
 *
 * @category Constructors
 * @since 1.0.0
 */
export const makeHost = (options: Options): Host =>
{
    if (!/^[a-z][a-z0-9_]*$/u.test(options.namespace) || options.namespace === "minecraft")
    {
        throw new Error("Expected a generated custom pack namespace");
    }

    const Prefix = `${options.namespace}:physics_`;
    const Dimensions = options.dimensions ?? [ "overworld", "nether", "the_end" ];
    const Entities = (): Array<Entity> => Dimensions.flatMap((id) => world.getDimension(id).getEntities());
    const IsOwner = (entity: Entity): boolean => entity.typeId.startsWith(Prefix) && entity.typeId !== `${Prefix}support`;
    return Object.freeze({
        acquire: () =>
        {
            if (ActiveNamespaces.has(options.namespace))
            {
                throw new Error("This physics pack namespace is already running");
            }

            ActiveNamespaces.add(options.namespace);
            return () =>
            {
                ActiveNamespaces.delete(options.namespace);
            };
        },
        native: {
            query: (dimension: string, bounds: B.AABB): ReadonlyArray<N.Native> =>
            {
                const Center = O.getOrThrow(B.center(bounds));
                const Radius = V.magnitude(O.getOrThrow(B.halfExtents(bounds))) + 4;
                return world.getDimension(dimension).getEntities({ location: Center,
                    maxDistance: Radius })
                    .filter((entity) => !entity.typeId.startsWith(Prefix) && entity.hasComponent("minecraft:health"))
                    .map((entity): N.Native =>
                    {
                        const Box = entity.getAABB();
                        const Velocity = V.scale(entity.getVelocity(), 20);
                        return { id: entity.id,
                            position: V.Vector3Unsafe(entity.location.x, entity.location.y, entity.location.z),
                            bounds: B.AABBUnsafe(V.subtract(Box.center, Box.extent), V.add(Box.center, Box.extent)),
                            velocity: Velocity,
                            jumping: Velocity.y > 0.8,
                            impulse: (delta) =>
                            {
                                entity.applyImpulse(V.scale(delta, 0.05));
                            },
                            move: (delta) =>
                            {
                                const Player = entity.typeId === "minecraft:player";
                                const Before = entity.getVelocity();
                                const Moved = entity.tryTeleport(V.add(entity.location, delta), Player ? { checkForBlocks: true } : { checkForBlocks: true,
                                    keepVelocity: true });
                                if (Player && Moved)
                                {
                                    const After = entity.getVelocity();
                                    const Delta = V.subtract(Before, After);
                                    if (Delta.x !== 0 || Delta.y !== 0 || Delta.z !== 0)
                                    {entity.applyImpulse(Delta);}
                                }

                                return Moved;
                            } };
                    }).filter((native) => O.getOrThrow(B.overlaps(native.bounds, bounds)));
            },
            helper: (dimension: string, position: V.Vector3): N.Helper =>
            {
                const Entity = world.getDimension(dimension).spawnEntity(`${Prefix}support`, position);
                Entity.setDynamicProperty(DynamicProperty.PhysicsTransient, options.namespace);
                return { move: (target) =>
                {
                    if (V.distance(Entity.location, target) > 1e-5)
                    {
                        Entity.teleport(target);
                    }
                },
                dispose: () =>
                {
                    if (Entity.isValid)
                    {
                        Entity.remove();
                    }
                } };
            }
        },
        discover: () => Entities().filter(IsOwner).map(owner),
        spawn: (model, dimension, position) => owner(world.getDimension(dimension).spawnEntity(model.identifier, position)),
        onLoad: (callback) =>
        {
            const Listener = world.afterEvents.entityLoad.subscribe((event) =>
            {
                if (event.entity.typeId === `${Prefix}support` || event.entity.getDynamicProperty(DynamicProperty.PhysicsTransient) === options.namespace)
                {
                    event.entity.remove();
                }
                else if (IsOwner(event.entity))
                {
                    callback(owner(event.entity));
                }
            });
            return () =>
            {
                world.afterEvents.entityLoad.unsubscribe(Listener);
            };
        },
        onRemove: (callback) =>
        {
            const Listener = world.afterEvents.entityRemove.subscribe((event) =>
            {
                if (event.typeId.startsWith(Prefix))
                {
                    callback(event.removedEntityId);
                }
            });
            return () =>
            {
                world.afterEvents.entityRemove.unsubscribe(Listener);
            };
        },
        onTick: (callback) =>
        {
            const Handle = system.runInterval(callback, 1);
            return () =>
            {
                system.clearRun(Handle);
            };
        },
        block: (dimension, position) =>
        {
            try
            {
                const Dimension = world.getDimension(dimension);
                if (position.y < Dimension.heightRange.min || position.y >= Dimension.heightRange.max)
                {
                    return { identifier: "minecraft:air",
                        states: {},
                        solid: false };
                }

                const Block = Dimension.getBlock(position);
                return Block ? { identifier: Block.typeId,
                    states: Block.permutation.getAllStates(),
                    solid: !Block.isAir && !Block.isLiquid } : undefined;
            }
            catch
            {
                return undefined;
            }
        },
        cleanupTransients: () =>
        {
            for (const Entity of Entities())
            {
                if (Entity.typeId === `${Prefix}support` || Entity.getDynamicProperty(DynamicProperty.PhysicsTransient) === options.namespace)
                {
                    Entity.remove();
                }
            }
        }
    } satisfies Host);
};
