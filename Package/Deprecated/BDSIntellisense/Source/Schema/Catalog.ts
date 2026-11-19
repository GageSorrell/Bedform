/**
 * An ordered set of schemas, with lookup of the schema that applies to a BDS release.
 *
 * Each schema applies from its own version until the next schema's version.  A release older than
 * every schema uses the oldest one, and a release newer than every schema uses the latest one.
 *
 * @module bds-intellisense/Schema/Catalog
 *
 * @file      Catalog.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as Version from "../Version.js";
import type { PropertySchema, ServerPropertiesSchema } from "./Types.js";
import type { BdsVersion } from "../Version.js";
import { LatestKeyword } from "../Keys.js";

/**
 * Schemas sorted from oldest to latest; there is always at least one.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SchemaCatalog
{
    readonly Latest: ServerPropertiesSchema;
    readonly Oldest: ServerPropertiesSchema;
    /** Every schema, oldest first. */
    readonly Schemas: ReadonlyArray<ServerPropertiesSchema>;
}

/**
 * Releases from `From` up to but excluding `Until`; without `Until` the run reaches the latest schema.
 *
 * @category Types
 * @since 1.0.0
 */
export interface VersionRange
{
    readonly From: BdsVersion;
    readonly Until?: BdsVersion;
}

/** Property lookup tables, built the first time a schema is searched. */
const PropertyIndex: WeakMap<ServerPropertiesSchema, ReadonlyMap<string, PropertySchema>> =
    new WeakMap<ServerPropertiesSchema, ReadonlyMap<string, PropertySchema>>();

/**
 * Sorts schemas into a catalog.
 *
 * @throws { Error } When no schemas are given, or when two schemas share a version.
 *
 * @category Functions
 * @since 1.0.0
 */
export function CreateSchemaCatalog(schemas: Iterable<ServerPropertiesSchema>): SchemaCatalog
{
    const sorted: Array<ServerPropertiesSchema> = [ ...schemas ].sort(
        (left: ServerPropertiesSchema, right: ServerPropertiesSchema) =>
            Version.Compare(left.Version, right.Version));

    if (sorted.length === 0)
    {
        throw new Error("A schema catalog needs at least one schema.");
    }

    for (let index: number = 1; index < sorted.length; index++)
    {
        if (Version.Equals(sorted[index - 1].Version, sorted[index].Version))
        {
            throw new Error(`Two schemas share version ${Version.Format(sorted[index].Version)}.`);
        }
    }

    return Object.freeze({
        Latest: sorted[sorted.length - 1],
        Oldest: sorted[0],
        Schemas: Object.freeze(sorted)
    });
}

/**
 * Picks the schema that applies to a release: the newest one whose version is not later than it,
 * or the oldest schema for a release that predates them all.
 *
 * @category Functions
 * @since 1.0.0
 */
export function SchemaFor(catalog: SchemaCatalog, version: BdsVersion): ServerPropertiesSchema
{
    for (let index: number = catalog.Schemas.length - 1; index >= 0; index--)
    {
        if (Version.Compare(catalog.Schemas[index].Version, version) <= 0)
        {
            return catalog.Schemas[index];
        }
    }

    return catalog.Oldest;
}

/**
 * Picks the schema named by a setting value: `latest` in any letter case, or a version such as
 * `1.21.0`.  Unreadable text yields `undefined`.
 *
 * @category Functions
 * @since 1.0.0
 */
export function SchemaForSetting(catalog: SchemaCatalog, setting: string): ServerPropertiesSchema | undefined
{
    if (setting.trim().toLowerCase() === LatestKeyword)
    {
        return catalog.Latest;
    }

    const version: BdsVersion | undefined = Version.Parse(setting);
    return version === undefined ? undefined : SchemaFor(catalog, version);
}

/**
 * Looks up a property of a schema by its exact key.
 *
 * @category Functions
 * @since 1.0.0
 */
export function FindProperty(schema: ServerPropertiesSchema, key: string): PropertySchema | undefined
{
    let index: ReadonlyMap<string, PropertySchema> | undefined = PropertyIndex.get(schema);
    if (index === undefined)
    {
        index = new Map<string, PropertySchema>(
            schema.Properties.map((property: PropertySchema) => [ property.Key, property ]));
        PropertyIndex.set(schema, index);
    }

    return index.get(key);
}

/**
 * Lists the runs of consecutive schemas that define a property, oldest first; the list is empty
 * for a key no schema defines.
 *
 * @category Functions
 * @since 1.0.0
 */
export function PropertyHistory(catalog: SchemaCatalog, key: string): ReadonlyArray<VersionRange>
{
    const ranges: Array<VersionRange> = [];
    let from: BdsVersion | undefined = undefined;
    for (const schema of catalog.Schemas)
    {
        const defined: boolean = FindProperty(schema, key) !== undefined;
        if (defined && from === undefined)
        {
            from = schema.Version;
        }
        else if (!defined && from !== undefined)
        {
            ranges.push({
                From: from,
                Until: schema.Version
            });
            from = undefined;
        }
    }

    if (from !== undefined)
    {
        ranges.push({ From: from });
    }

    return ranges;
}

/**
 * Describes version ranges in prose, such as `1.16.0 until 1.19.0, 1.21.0 and later`.
 *
 * @category Functions
 * @since 1.0.0
 */
export function FormatHistory(ranges: ReadonlyArray<VersionRange>): string
{
    return ranges.map((range: VersionRange) => range.Until === undefined
        ? `${Version.Format(range.From)} and later`
        : `${Version.Format(range.From)} until ${Version.Format(range.Until)}`)
        .join(", ");
}
