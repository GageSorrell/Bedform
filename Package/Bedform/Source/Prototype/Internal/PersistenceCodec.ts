/**
 * Strict serialization and bounded atomic publication for Prototype world state.
 *
 * @module bedform/Prototype/Internal/PersistenceCodec
 *
 * @file      PersistenceCodec.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Export declarations own their documentation. */
/* eslint jsdoc/require-jsdoc: ["error", { "contexts": [
    "ExportNamedDeclaration > TSInterfaceDeclaration",
    "ExportNamedDeclaration > FunctionDeclaration",
    "ExportNamedDeclaration:has(VariableDeclaration)"
] }] */

/* Schema fields follow domain order; parsers deliberately narrow unknown input. */
/* Parser and adapter callbacks retain contextual generic inference. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import type { BlockBinding, Bounds, Configuration, EntityBinding, Pose } from "../Interaction.js";
import { Defaults, SlabPalette } from "../Structure.js";
import type { Document, MaterialPermutations, PlacementRecovery, Properties,
    RecordState, SelectionRecovery, StructureOptions } from "../Persistence.js";
import { DynamicProperty, DynamicPropertyPrefix, StructurePrefix } from "../keys.js";
import type { Options, Permutation, PlacedRecipe } from "../Structure.js";
import { normalize as options } from "../Structure/Catalog.js";

/**
 * Publication source includes the exact manifest used by optimistic concurrency checks.
 *
 * @category Types
 * @since 1.0.0
 */
export interface ReadResult
{
    readonly Document: Document;
    readonly Manifest: unknown;
    readonly Slot: number;
}

/**
 * Maximum serialized UTF-8 payload per property and bounded bank capacity.
 *
 * @category Constants
 * @since 1.0.0
 */
export const StorageLimits = Object.freeze({ ChunkBytes: 24_000,
    MaxChunks: 256 } as const);

/**
 * Narrows a plain data object and rejects undeclared fields, including generic Data/native handles.
 *
 * @throws { Error } When a value is not a plain object with only the permitted fields.
 *
 * @category Internal
 * @since 1.0.0
 */
const object = (value: unknown, keys?: ReadonlyArray<string>): Record<string, unknown> =>
{
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null))
    {
        throw new Error("Expected a plain persisted object");
    }

    if (keys && Object.keys(value).some((key) => !keys.includes(key)))
    {
        throw new Error("Unknown persisted field");
    }

    return value as Record<string, unknown>;
};

/**
 * Validates stable IDs, dimension names and native identifiers without coercion.
 *
 * @throws { Error } When the value is not a nonempty trimmed string.
 *
 * @category Internal
 * @since 1.0.0
 */
const text = (value: unknown): string =>
{
    if (typeof value !== "string" || !value.trim() || value !== value.trim())
    {
        throw new Error("Expected a nonempty persisted string");
    }

    return value;
};

/**
 * Validates finite coordinates and integer counters without silent clamping.
 *
 * @throws { Error } When a value is not a valid coordinate or bounded nonnegative integer.
 *
 * @category Internal
 * @since 1.0.0
 */
const number = (value: unknown, integer: boolean = false): number =>
{
    if (typeof value !== "number" || !Number.isFinite(value) ||
        (integer && (!Number.isSafeInteger(value) || value < 0)))
    {
        throw new Error("Invalid persisted numeric value");
    }

    return value;
};

/**
 * Validates an actual boolean rather than accepting truthy saved data.
 *
 * @throws { Error } When the value is not boolean.
 *
 * @category Internal
 * @since 1.0.0
 */
const boolean = (value: unknown): boolean =>
{
    if (typeof value !== "boolean")
    {
        throw new Error("Expected persisted boolean");
    }

    return value;
};

/**
 * Checks exact vectors, including negative integral block coordinates when requested.
 *
 * @throws { Error } When coordinates are invalid or nonintegral block positions.
 *
 * @category Internal
 * @since 1.0.0
 */
const vector = (value: unknown, integral: boolean = false): { x: number;
    y: number;
    z: number } =>
{
    const source = object(value, [ "x", "y", "z" ]);
    const result = { x: number(source.x),
        y: number(source.y),
        z: number(source.z) };
    if (integral && Object.values(result).some((coordinate) => !Number.isSafeInteger(coordinate)))
    {
        throw new Error("Expected whole block coordinates");
    }

    return result;
};

/**
 * Validates dimension-qualified half-open bounds and all three positive extents.
 *
 * @throws { Error } When bounds are malformed, reversed or empty.
 *
 * @category Internal
 * @since 1.0.0
 */
const bounds = (value: unknown): Bounds =>
{
    const source = object(value, [ "Dimension", "Min", "Max" ]);
    const min = vector(source.Min, true);
    const max = vector(source.Max, true);
    if (min.x >= max.x || min.y >= max.y || min.z >= max.z)
    {
        throw new Error("Invalid bounds extents");
    }

    return { Dimension: text(source.Dimension),
        Min: min,
        Max: max };
};

/**
 * Validates saved positions and native degree rotations without retaining dimension objects.
 *
 * @throws { Error } When the pose contains invalid fields or coordinates.
 *
 * @category Internal
 * @since 1.0.0
 */
const pose = (value: unknown): Pose =>
{
    const source = object(value, [ "Dimension", "Position", "Rotation" ]);
    const rotation = object(source.Rotation, [ "x", "y" ]);
    return { Dimension: text(source.Dimension),
        Position: vector(source.Position),
        Rotation: { x: number(rotation.x),
            y: number(rotation.y) } };
};

/**
 * Decodes block coordinates or native entity IDs; only string descriptors are persisted.
 *
 * @throws { Error } When kind-specific fields are invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const binding = (value: unknown): BlockBinding | EntityBinding =>
{
    const source = object(value);
    if (source.Kind === "Block")
    {
        object(source, [ "Kind", "Dimension", "Position" ]);
        return { Kind: "Block",
            Dimension: text(source.Dimension),
            Position: vector(source.Position, true) };
    }

    object(source, [ "Kind", "Dimension", "Id", "Removed" ]);
    if (source.Kind !== "Entity")
    {
        throw new Error("Unknown binding kind");
    }

    return { Kind: "Entity",
        Dimension: text(source.Dimension),
        Id: text(source.Id),
        ...(source.Removed === undefined ? {} : { Removed: boolean(source.Removed) }) };
};

/**
 * Parses keyed records safely even for identifiers such as __proto__.
 *
 * @throws { Error } When keys or entries are invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const map = <Value>(value: unknown, parse: (entry: unknown, key: string) => Value): Record<string, Value> =>
{
    return Object.fromEntries(Object.entries(object(value))
        .map(([ key, entry ]) => [ text(key), parse(entry, key) ]));
};

/**
 * Validates ID/state provenance for each role; slab states must explicitly retain the bottom half.
 *
 * @throws { Error } When roles, IDs, state values or required slab halves are inconsistent.
 *
 * @category Internal
 * @since 1.0.0
 */
const permutations = (value: unknown, selection: Options): MaterialPermutations =>
{
    const source = object(value, Object.keys(Defaults.Materials));
    return Object.fromEntries(Object.entries(selection.Materials).map(([ role, id ]) =>
    {
        const material = object(source[role], [ "Id", "States" ]);
        if (material.Id !== id)
        {
            throw new Error("Saved material permutation does not match its role");
        }

        const states = map(material.States, (entry) =>
        {
            if (typeof entry === "string" || typeof entry === "boolean")
            {
                return entry;
            }

            return number(entry);
        });
        if ((SlabPalette as ReadonlyArray<string>).includes(id) &&
            states["minecraft:vertical_half"] !== "bottom")
        {
            throw new Error("Saved ceiling slab must use its bottom half");
        }

        return [ role, { Id: id,
            States: states } satisfies Permutation ];
    })) as unknown as MaterialPermutations;
};

/**
 * Parses independently saved authoring options; defaults do not regenerate an existing recipe.
 *
 * @throws { Error } When options or their provenance is invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const selection = (value: unknown): StructureOptions =>
{
    const source = object(value, [ "Revision", "CatalogVersion", "Options", "Permutations" ]);
    const parsed = options(source.Options);
    return { Revision: number(source.Revision, true),
        CatalogVersion: source.CatalogVersion === undefined ? 0 : number(source.CatalogVersion, true),
        Options: parsed,
        ...(source.Permutations === undefined ? {} : {
            Permutations: permutations(source.Permutations, parsed) }) };
};

/**
 * Parses successful placement metadata without touching native blocks, including canopy/roof footprint.
 *
 * @throws { Error } When geometry metadata, IDs or dimensions are inconsistent.
 *
 * @category Internal
 * @since 1.0.0
 */
const recipe = (value: unknown): PlacedRecipe =>
{
    const source = object(value, [ "RecipeVersion", "DemonstrationId", "OptionsRevision", "Options",
        "Dimension", "Center", "Footprint", "Bounds", "Arrival" ]);
    if (!Array.isArray(source.Footprint) || source.Footprint.length === 0)
    {
        throw new Error("Placed recipe requires the complete footprint");
    }

    const dimension = text(source.Dimension);
    const area = bounds(source.Bounds);
    const arrival = pose(source.Arrival);
    const center = vector(source.Center, true);
    const footprint = source.Footprint.map((entry) => vector(entry, true));
    if (area.Dimension !== dimension || arrival.Dimension !== dimension ||
        footprint.some((cell) => cell.y !== center.y || cell.x < area.Min.x || cell.x >= area.Max.x ||
            cell.z < area.Min.z || cell.z >= area.Max.z) || area.Min.y !== center.y)
    {
        throw new Error("Inconsistent placed footprint/dimension");
    }

    const version = number(source.RecipeVersion, true);
    if (version < 1)
    {
        throw new Error("Invalid recipe version");
    }

    return { RecipeVersion: version,
        DemonstrationId: text(source.DemonstrationId),
        OptionsRevision: number(source.OptionsRevision, true),
        Options: options(source.Options),
        Dimension: dimension,
        Center: center,
        Footprint: footprint,
        Bounds: area,
        Arrival: arrival };
};

/**
 * Parses one stable demonstration record, excluding transient run state and generic data.
 *
 * @throws { Error } When a record is invalid or does not agree with its keyed identity.
 *
 * @category Internal
 * @since 1.0.0
 */
const demonstration = (value: unknown, key: string): RecordState =>
{
    const source = object(value, [ "Configuration", "SuccessfulCompletions", "GeneratedColor",
        "StructureOptions", "PlacedRecipe", "PlacedMaterials", "PlacedCatalogVersion" ]);
    const config = object(source.Configuration, [ "Id", "Revision", "Bounds", "Arrival",
        "Trigger", "References" ]);
    const trigger = config.Trigger === undefined ? undefined : binding(config.Trigger);
    if (config.Id !== key || (trigger && trigger.Kind !== "Block"))
    {
        throw new Error("Invalid configuration ID/trigger");
    }

    const configuration: Configuration = { Id: key,
        Revision: number(config.Revision, true),
        References: map(config.References, (entry) => binding(entry)),
        ...(config.Bounds === undefined ? {} : { Bounds: bounds(config.Bounds) }),
        ...(config.Arrival === undefined ? {} : { Arrival: pose(config.Arrival) }),
        ...(trigger ? { Trigger: trigger as BlockBinding } : {}) };
    const placed = source.PlacedRecipe === undefined ? undefined : recipe(source.PlacedRecipe);
    if (placed && placed.DemonstrationId !== key)
    {
        throw new Error("Inconsistent placed demonstration ID");
    }

    let color;
    if (source.GeneratedColor !== undefined)
    {
        const rgb = object(source.GeneratedColor, [ "red", "green", "blue" ]);
        color = { red: number(rgb.red),
            green: number(rgb.green),
            blue: number(rgb.blue) };
        if (Object.values(color).some((channel) => channel < 0 || channel > 1))
        {
            throw new Error("Invalid saved RGB");
        }
    }

    if (source.PlacedMaterials !== undefined && !placed)
    {
        throw new Error("Placed materials require a recipe");
    }

    return { Configuration: configuration,
        SuccessfulCompletions: number(source.SuccessfulCompletions, true),
        ...(color ? { GeneratedColor: color } : {}),
        ...(source.StructureOptions === undefined ? {} : {
            StructureOptions: selection(source.StructureOptions) }),
        ...(placed ? { PlacedRecipe: placed } : {}),
        ...(source.PlacedMaterials === undefined ? {} : {
            PlacedMaterials: permutations(source.PlacedMaterials, placed!.Options) }),
        ...(source.PlacedCatalogVersion === undefined ? {} : {
            PlacedCatalogVersion: number(source.PlacedCatalogVersion, true) }) };
};

/**
 * Validates inventory recovery slot ownership without serializing native items.
 *
 * @throws { Error } When recovery fields or slot identities are invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const selectionRecovery = (value: unknown, key: string): SelectionRecovery =>
{
    const source = object(value, [ "PlayerId", "DemonstrationId", "Dimension",
        "ProtectedSlot", "SelectorItemId" ]);
    if (source.PlayerId !== key)
    {
        throw new Error("Selection recovery player mismatch");
    }

    const slot = source.ProtectedSlot === undefined ? undefined : number(source.ProtectedSlot, true);
    if (slot !== undefined && (slot < 2 || slot > 35))
    {
        throw new Error("Invalid protected inventory slot");
    }

    return { PlayerId: text(source.PlayerId),
        DemonstrationId: text(source.DemonstrationId),
        Dimension: text(source.Dimension),
        SelectorItemId: text(source.SelectorItemId),
        ...(slot === undefined ? {} : { ProtectedSlot: slot }) };
};

/**
 * Checks a placement journal and all native snapshot descriptors before exposing recovery state.
 *
 * @throws { Error } When journal identities, stages, snapshot states or dimensions are invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const recovery = (value: unknown): PlacementRecovery =>
{
    const source = object(value, [ "Id", "Stage", "Proposed", "Materials",
        "CatalogVersion", "Snapshots", "Error" ]);
    const proposed = recipe(source.Proposed);
    const id = text(source.Id);
    if (![ "Snapshotting", "Writing", "Restoring", "Cleanup" ].includes(String(source.Stage)) ||
        !Array.isArray(source.Snapshots) || source.Snapshots.length === 0)
    {
        throw new Error("Invalid placement journal stage/partitions");
    }

    const snapshots = source.Snapshots.map((entry, index) =>
    {
        const snapshot = object(entry, [ "Id", "Bounds", "Saved" ]);
        if (snapshot.Id !== StructurePrefix.Snapshot + id + "_" + index)
        {
            throw new Error("Unowned native snapshot ID");
        }

        const area = bounds(snapshot.Bounds);
        if (area.Dimension !== proposed.Dimension)
        {
            throw new Error("Snapshot dimension mismatch");
        }

        return { Id: text(snapshot.Id),
            Bounds: area,
            Saved: boolean(snapshot.Saved) };
    });
    if ((source.Stage === "Writing" || source.Stage === "Cleanup") && snapshots.some((entry) => !entry.Saved))
    {
        throw new Error("Writing journal has unsaved snapshots");
    }

    if (source.Error !== undefined && typeof source.Error !== "string")
    {
        throw new Error("Invalid recovery error");
    }

    return { Id: id,
        Stage: source.Stage as PlacementRecovery["Stage"],
        Proposed: proposed,
        CatalogVersion: number(source.CatalogVersion, true),
        Snapshots: snapshots,
        ...(source.Materials === undefined ? {} : {
            Materials: permutations(source.Materials, proposed.Options) }),
        ...(source.Error === undefined ? {} : { Error: source.Error as string }) };
};

/**
 * Validates all world data and normalizes missing legacy option fields in memory only.
 * Unknown schema versions are rejected without rewriting or clearing their saved properties.
 *
 * @throws { Error } When stored data, field shapes or schema versions are unsupported.
 *
 * @category Internal
 * @since 1.0.0
 */
export const decode = (value: unknown): Document =>
{
    const source = object(value, [ "SchemaVersion", "Revision", "Editing", "Home",
        "Demonstrations", "Selections", "Placement" ]);
    if (source.SchemaVersion !== 1)
    {
        throw new Error("Unsupported Prototype schema version");
    }

    return { SchemaVersion: 1,
        Revision: number(source.Revision, true),
        Editing: boolean(source.Editing),
        Demonstrations: map(source.Demonstrations, demonstration),
        Selections: map(source.Selections === undefined ? {} : source.Selections, selectionRecovery),
        ...(source.Home === undefined ? {} : { Home: pose(source.Home) }),
        ...(source.Placement === undefined ? {} : { Placement: recovery(source.Placement) }) };
};

/**
 * Splits by UTF-8 byte budget, preserving complete Unicode code points without browser/Node encoders.
 *
 * @category Internal
 * @since 1.0.0
 */
const chunks = (value: string): ReadonlyArray<string> =>
{
    const result: Array<string> = [];
    let current = "";
    let size = 0;
    for (const glyph of value)
    {
        const code = glyph.codePointAt(0)!;
        const bytes = code < 0x80 ? 1 : code < 0x8_00 ? 2 : code < 0x1_00_00 ? 3 : 4;
        if (size + bytes > StorageLimits.ChunkBytes)
        {
            result.push(current);
            current = "";
            size = 0;
        }

        current += glyph;
        size += bytes;
    }

    if (current)
    {
        result.push(current);
    }

    return result;
};

/**
 * FNV-1a detects incomplete/corrupt chunk payloads; this is an integrity check, not authentication.
 *
 * @category Internal
 * @since 1.0.0
 */
const checksum = (value: string): string =>
{
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index++)
    {
        hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
    }

    return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Loads only the published bank, rejecting corruption rather than silently reverting saved progress.
 *
 * @throws { Error } When publication metadata, chunks or their checksum is invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
export const readDocument = (properties: Properties): ReadResult =>
{
    const manifest = properties.getDynamicProperty(DynamicProperty.Manifest);
    if (manifest === undefined)
    {
        return { Manifest: undefined,
            Slot: 1,
            Document: {
                SchemaVersion: 1,
                Revision: 0,
                Editing: true,
                Demonstrations: {},
                Selections: {}
            } };
    }

    if (typeof manifest !== "string" || manifest.length > 512)
    {
        throw new Error("Invalid Prototype manifest");
    }

    const source = object(JSON.parse(manifest), [ "SchemaVersion", "Revision", "Slot", "Count", "Hash" ]);
    if (source.SchemaVersion !== 1 || (source.Slot !== 0 && source.Slot !== 1) ||
        number(source.Count, true) < 1 || (source.Count as number) > StorageLimits.MaxChunks)
    {
        throw new Error("Unsupported Prototype manifest version/bank/count");
    }

    let json = "";
    for (let index = 0; index < (source.Count as number); index++)
    {
        const part = properties.getDynamicProperty(DynamicPropertyPrefix.Chunk + source.Slot + "_" + index);
        if (typeof part !== "string" || chunks(part).length !== 1)
        {
            throw new Error("Missing or oversized Prototype chunk");
        }

        json += part;
    }

    if (checksum(json) !== source.Hash)
    {
        throw new Error("Prototype storage integrity mismatch");
    }

    const document = decode(JSON.parse(json));
    if (document.Revision !== source.Revision ||
        properties.getDynamicProperty(DynamicProperty.Manifest) !== manifest)
    {
        throw new Error("Stale or inconsistent Prototype publication");
    }

    return { Document: document,
        Manifest: manifest,
        Slot: source.Slot };
};

/**
 * Writes the inactive bank before switching the single publication pointer. Failed staging leaves the
 * current bank untouched; unreachable chunks are bounded by two fixed banks of MaxChunks properties.
 *
 * @throws { Error } When the document exceeds the storage budget, revisions changed or native writes fail.
 *
 * @category Internal
 * @since 1.0.0
 */
export const publish = (properties: Properties, previous: ReadResult, document: Document): void =>
{
    const json = JSON.stringify(document);
    const parts = chunks(json);
    if (parts.length > StorageLimits.MaxChunks)
    {
        throw new Error("Prototype document exceeds storage capacity");
    }

    const slot = 1 - previous.Slot;
    if (properties.getDynamicProperty(DynamicProperty.Manifest) !== previous.Manifest)
    {
        throw new Error("Stale Prototype publication");
    }

    for (const [ index, part ] of parts.entries())
    {
        properties.setDynamicProperty(DynamicPropertyPrefix.Chunk + slot + "_" + index, part);
    }

    if (properties.getDynamicProperty(DynamicProperty.Manifest) !== previous.Manifest)
    {
        throw new Error("Stale Prototype publication");
    }

    properties.setDynamicProperty(DynamicProperty.Manifest, JSON.stringify({
        SchemaVersion: 1,
        Revision: document.Revision,
        Slot: slot,
        Count: parts.length,
        Hash: checksum(json)
    }));
};
