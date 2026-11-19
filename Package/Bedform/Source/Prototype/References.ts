/**
 * Current-object reference resolution and declaration-aware setup completeness.
 * Native adapters report evidence of removal explicitly; an unloaded entity is never guessed to be removed.
 *
 * @module bedform/Prototype/References
 *
 * @file      References.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Domain status fields precede their related values. */
/* Parser and adapter callbacks retain contextual generic inference. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import { Block, Entity, isBindableEntity } from "./Demonstration.js";
import type { BlockBinding, Configuration, EntityBinding, WorldConfiguration } from "./Interaction.js";
import type { Block as NativeBlock, Entity as NativeEntity, RGB, World } from "@minecraft/server";
import type { ReferenceHandles, ReferenceMap, ReferenceValidators } from "./Demonstration.js";
import type { Document } from "./Persistence.js";
import { record } from "./Persistence.js";

/**
 * Successfully resolved current native object.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Available<Value>
{
    readonly Status: "Available";
    readonly Value: Value;
}

/**
 * Missing denotes unassigned; Unloaded remains assigned and configured. Removed requires positive evidence.
 * Invalid includes wrong kinds, changed dimensions, forbidden entities and failed validators.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Unavailable
{
    readonly Status: "Missing" | "Unloaded" | "Removed" | "Invalid";
    readonly Reason?: string;
}

/**
 * Availability is separate from assignment completeness and never serializes native objects.
 *
 * @category Types
 * @since 1.0.0
 */
export type Resolution<Value> = Available<Value> | Unavailable;

/**
 * Game-native lookup adapter. Undefined getEntity results must be Unloaded unless removal is known.
 * An adapter can use native entity-removal events to supply positive Removed evidence.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Resolver
{
    readonly Block: (binding: BlockBinding) => Resolution<NativeBlock>;
    readonly Entity: (binding: EntityBinding) => Resolution<NativeEntity>;
    readonly Dimension?: (id: string) => boolean;
}

/**
 * Adapts native world lookups without importing a game runtime into host tests.
 * A missing entity is unloaded unless removal events supplied positive evidence.
 *
 * @category References
 * @since 1.0.0
 */
export const nativeResolver = (world: Pick<World, "getDimension" | "getEntity">,
    removedEntities: ReadonlySet<string> = new Set()): Resolver =>
{
    return {
        Dimension: (id) =>
        {
            try
            {
                world.getDimension(id);
                return true;
            }
            catch
            {
                return false;
            }
        },
        Block: (binding) =>
        {
            let dimension;
            try
            {
                dimension = world.getDimension(binding.Dimension);
            }
            catch
            {
                return { Status: "Invalid",
                    Reason: "Unknown saved dimension" };
            }

            try
            {
                const value = dimension.getBlock(binding.Position);
                return value ? { Status: "Available",
                    Value: value } : { Status: "Unloaded" };
            }
            catch
            {
                return { Status: "Unloaded" };
            }
        },
        Entity: (binding) =>
        {
            try
            {
                world.getDimension(binding.Dimension);
            }
            catch
            {
                return { Status: "Invalid",
                    Reason: "Unknown saved dimension" };
            }

            try
            {
                const value = world.getEntity(binding.Id);
                return value ? { Status: "Available",
                    Value: value } : {
                    Status: removedEntities.has(binding.Id) ? "Removed" : "Unloaded"
                };
            }
            catch
            {
                return { Status: "Unloaded" };
            }
        }
    };
};

/**
 * Heterogeneous declaration view preserves exact authored callbacks in their original definitions.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Declaration
{
    readonly Id: string;
    readonly References?: ReferenceMap;
    readonly Validators?: Readonly<Record<string, ((value: never) => boolean) | undefined>>;
    readonly Run?: unknown;
    readonly Color?: RGB;
}

/**
 * One required field's current configuration/availability status.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Field
{
    readonly Name: string;
    readonly Status: "Available" | Unavailable["Status"];
    readonly Reason?: string;
}

/**
 * Unloaded assignments do not make setup incomplete, but do prevent starting a run.
 * Optional home and generated structures are excluded from Required entirely.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Completeness
{
    readonly Required: number;
    readonly Missing: number;
    readonly Invalid: number;
    readonly Unloaded: number;
    readonly Complete: boolean;
    readonly Available: boolean;
    readonly Fields: ReadonlyArray<Field>;
}

/**
 * Active demonstration view uses its current declaration and stable-ID stored configuration.
 *
 * @category Types
 * @since 1.0.0
 */
export interface DemonstrationView
{
    readonly Id: string;
    readonly Configuration: Configuration;
    readonly CompletionCount: number;
    readonly Color?: RGB;
    readonly Completeness: Completeness;
}

/**
 * Reconciled view keeps removed demos archived in storage but out of the active callback registry.
 *
 * @category Types
 * @since 1.0.0
 */
export interface WorldView
{
    readonly Configuration: WorldConfiguration;
    readonly Demonstrations: ReadonlyArray<DemonstrationView>;
    readonly ArchivedIds: ReadonlyArray<string>;
    readonly Incomplete: number;
    readonly Total: number;
}

/**
 * Resolves and validates one named binding without deleting assignments when objects unload.
 *
 * @category References
 * @since 1.0.0
 */
export const resolve = (kind: typeof Block | typeof Entity, binding: BlockBinding | EntityBinding | undefined,
    resolver: Resolver, validator?: (value: never) => boolean): Resolution<NativeBlock | NativeEntity> =>
{
    if (!binding)
    {
        return { Status: "Missing" };
    }

    if (binding.Kind === "Entity" && binding.Removed)
    {
        return { Status: "Removed",
            Reason: "Saved native removal evidence" };
    }

    if ((kind === Block && binding.Kind !== "Block") || (kind === Entity && binding.Kind !== "Entity"))
    {
        return { Status: "Invalid",
            Reason: "Assigned reference kind changed" };
    }

    let result: Resolution<NativeBlock | NativeEntity>;
    try
    {
        result = binding.Kind === "Block" ? resolver.Block(binding) : resolver.Entity(binding);
    }
    catch
    {
        return { Status: "Unloaded",
            Reason: "Native lookup unavailable; assignment retained" };
    }

    if (result.Status !== "Available")
    {
        return result;
    }

    try
    {
        const value = result.Value;
        if (value.dimension.id !== binding.Dimension ||
            (binding.Kind === "Block" && (value as NativeBlock).isAir) ||
            (binding.Kind === "Entity" && !isBindableEntity(value as NativeEntity)))
        {
            return { Status: "Invalid",
                Reason: "Assigned target is no longer valid" };
        }

        if (validator && validator(value as never) !== true)
        {
            return { Status: "Invalid",
                Reason: "Reference validator failed" };
        }
    }
    catch
    {
        return { Status: "Invalid",
            Reason: "Reference validation failed" };
    }

    return result;
};

/**
 * Each Resolve call reads the current saved binding and current native object, never a cached handle.
 * A failed validator or unavailable target resolves to undefined while retaining its saved descriptor.
 *
 * @category References
 * @since 1.0.0
 */
export const handles = <const References extends ReferenceMap>(references: References,
    configuration: () => Configuration, resolver: Resolver,
    validators?: ReferenceValidators<References>): ReferenceHandles<References> =>
{
    return Object.fromEntries(Object.entries(references).map(([ name, kind ]) => [ name, Object.freeze({
        Resolve: () =>
        {
            const config = configuration();
            const result = resolve(kind,
                Object.hasOwn(config.References, name) ? config.References[name] : undefined,
                resolver, validators?.[name]);
            return result.Status === "Available" ? result.Value : undefined;
        }
    }) ])) as ReferenceHandles<References>;
};

/**
 * Counts bounds/arrival, runnable-only native controls and currently declared references.
 * Removed reference requirements remain stored but no longer count toward active completeness.
 *
 * @category References
 * @since 1.0.0
 */
export const completeness = (definition: Declaration, configuration: Configuration,
    resolver: Resolver): Completeness =>
{
    const fields: Array<Field> = [
        { Name: "Bounds",
            Status: configuration.Bounds ? "Available" : "Missing" },
        { Name: "Arrival",
            Status: configuration.Arrival ? "Available" : "Missing" }
    ];
    if (resolver.Dimension)
    {
        for (const [ index, field ] of fields.entries())
        {
            const dimension = field.Name === "Bounds" ? configuration.Bounds?.Dimension :
                configuration.Arrival?.Dimension;
            if (dimension && !resolver.Dimension(dimension))
            {
                fields[index] = { ...field,
                    Status: "Invalid",
                    Reason: "Unknown saved dimension" };
            }
        }
    }

    if (definition.Run !== undefined)
    {
        const result = resolve(Block, configuration.Trigger, resolver, (value) =>
        {
            const id = (value as NativeBlock).typeId;
            return id.startsWith("minecraft:") && (id.endsWith("_button") || id.endsWith("_pressure_plate"));
        });
        fields.push({ Name: "Trigger",
            Status: result.Status,
            ...(result.Status === "Available" ? {} : { Reason: result.Reason }) });
    }

    for (const [ name, kind ] of Object.entries(definition.References ?? {}))
    {
        const result = resolve(kind, Object.hasOwn(configuration.References, name) ?
            configuration.References[name] : undefined, resolver, definition.Validators?.[name]);
        fields.push({ Name: "References." + name,
            Status: result.Status,
            ...(result.Status === "Available" ? {} : { Reason: result.Reason }) });
    }

    const missing = fields.filter((field) => field.Status === "Missing").length;
    const invalid = fields.filter((field) => field.Status === "Invalid" || field.Status === "Removed").length;
    const unloaded = fields.filter((field) => field.Status === "Unloaded").length;
    return { Required: fields.length,
        Missing: missing,
        Invalid: invalid,
        Unloaded: unloaded,
        Complete: missing + invalid === 0,
        Available: missing + invalid + unloaded === 0,
        Fields: fields };
};

/**
 * Projects current declaration order over stable saved IDs without rewriting, deleting or regenerating.
 * Omitted colors use their saved generated assignment; waypoint publication belongs to the controller.
 *
 * @throws { Error } When current declarations contain duplicate IDs.
 *
 * @category References
 * @since 1.0.0
 */
export const reconcile = (document: Document, definitions: ReadonlyArray<Declaration>,
    resolver: Resolver): WorldView =>
{
    const ids = new Set(definitions.map((definition) => definition.Id));
    if (ids.size !== definitions.length)
    {
        throw new Error("Duplicate demonstration IDs");
    }

    const demonstrations = definitions.map((definition) =>
    {
        const saved = record(document, definition.Id);
        const config = saved.Configuration;
        const configuration = { ...config,
            References: Object.fromEntries(
                Object.keys(definition.References ?? {})
                    .filter((name) => Object.hasOwn(config.References, name))
                    .map((name) => [ name, config.References[name] ])) };
        return { Id: definition.Id,
            Configuration: configuration,
            CompletionCount: saved.SuccessfulCompletions,
            Color: definition.Color ?? saved.GeneratedColor,
            Completeness: completeness(definition, configuration, resolver) };
    });
    return { Configuration: { Editing: document.Editing,
        Home: document.Home,
        Demonstrations: Object.fromEntries(
            demonstrations.map((value) => [ value.Id, value.Configuration ])) },
    Demonstrations: demonstrations,
    ArchivedIds: Object.keys(document.Demonstrations).filter((id) => !ids.has(id)),
    Incomplete: demonstrations.filter((value) => !value.Completeness.Complete).length,
    Total: demonstrations.length };
};
