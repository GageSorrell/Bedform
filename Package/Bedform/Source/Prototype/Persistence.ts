/**
 * Versioned world storage, optimistic edits, independent structure options and recovery journals.
 * All operations are synchronous and game-safe; native placement adapters perform block writes.
 *
 * @module bedform/Prototype/Persistence
 *
 * @file      Persistence.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/* Domain records retain their public field order. */
/* Parser and adapter callbacks retain contextual generic inference. */
/* eslint-disable sort-keys, @typescript-eslint/typedef */

import type { Bounds, Configuration, Pose } from "./Interaction.js";
import type { Options, Permutation, PlacedRecipe } from "./Structure.js";
import { decode, publish, readDocument } from "./Internal/PersistenceCodec.js";
import { Defaults } from "./Structure.js";
import type { RGB } from "@minecraft/server";
import { StructurePrefix } from "./keys.js";

/**
 * Minimal native world adapter; undefined values clear only the specified owned key.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Properties
{
    readonly getDynamicProperty: (key: string) => unknown;
    readonly setDynamicProperty: (key: string, value?: string) => void;
}

/**
 * Material resolution is stored by role and ID/state, never by locale or dropdown index.
 * An absent map denotes legacy choices not yet qualified against the engine catalog.
 *
 * @category Types
 * @since 1.0.0
 */
export type MaterialPermutations = Readonly<Record<keyof Options["Materials"], Permutation>>;

/**
 * Editable choices have their own revision and catalog provenance, independent of placed blocks.
 *
 * @category Types
 * @since 1.0.0
 */
export interface StructureOptions
{
    readonly Revision: number;
    readonly CatalogVersion: number;
    readonly Options: Options;
    readonly Permutations?: MaterialPermutations;
}

/**
 * Stable-ID record retains removed references and successful history while a definition is archived.
 * GeneratedColor is retained even when an authored color temporarily overrides it.
 *
 * @category Types
 * @since 1.0.0
 */
export interface RecordState
{
    readonly Configuration: Configuration;
    readonly SuccessfulCompletions: number;
    readonly GeneratedColor?: RGB;
    readonly StructureOptions?: StructureOptions;
    readonly PlacedRecipe?: PlacedRecipe;
    readonly PlacedMaterials?: MaterialPermutations;
    readonly PlacedCatalogVersion?: number;
}

/**
 * Native snapshot identity and exact partition bounds, journaled before the snapshot is created.
 * Saved is set only after the native adapter successfully saves the partition.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Snapshot
{
    readonly Id: string;
    readonly Bounds: Bounds;
    readonly Saved: boolean;
}

/**
 * Interrupted placement is never resumed as a fresh placement. Prior configuration remains intact
 * until commit; failed rollback retains snapshots and blocks subsequent editing/live transitions.
 *
 * @category Types
 * @since 1.0.0
 */
export interface PlacementRecovery
{
    readonly Id: string;
    readonly Stage: "Snapshotting" | "Writing" | "Restoring" | "Cleanup";
    readonly Proposed: PlacedRecipe;
    readonly Materials?: MaterialPermutations;
    readonly CatalogVersion: number;
    readonly Snapshots: ReadonlyArray<Snapshot>;
    readonly Error?: string;
}

/**
 * Inventory recovery describes where the original selector-slot stack was safely relocated.
 * Item contents stay in native inventory slots, preserving metadata without JSON serialization.
 *
 * @category Types
 * @since 1.0.0
 */
export interface SelectionRecovery
{
    readonly PlayerId: string;
    readonly DemonstrationId: string;
    readonly Dimension: string;
    readonly ProtectedSlot?: number;
    readonly SelectorItemId: string;
}

/**
 * Version-one storage envelope. Active runs and generic demonstration Data are never stored.
 * Loaded documents are detached; mutating a draft alone cannot save or place anything.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Document
{
    readonly SchemaVersion: 1;
    readonly Revision: number;
    readonly Editing: boolean;
    readonly Home?: Pose;
    readonly Demonstrations: Readonly<Record<string, RecordState>>;
    readonly Selections: Readonly<Record<string, SelectionRecovery>>;
    readonly Placement?: PlacementRecovery;
}

/**
 * Preview captures both the configuration and saved-options revisions; any edit invalidates it.
 *
 * @category Types
 * @since 1.0.0
 */
export interface Preview
{
    readonly DemonstrationId: string;
    readonly ConfigurationRevision: number;
    readonly Selection: StructureOptions;
}

/**
 * Returns a detached validated snapshot without writing, regenerating or deleting anything.
 *
 * @throws { Error } When the stored version, integrity, size or data is invalid.
 *
 * @category Storage
 * @since 1.0.0
 */
export const load = (properties: Properties): Document =>
{
    return readDocument(properties).Document;
};

/**
 * Returns an existing record or an incomplete unsaved record for a newly declared ID.
 *
 * @category Storage
 * @since 1.0.0
 */
export const record = (document: Document, id: string): RecordState =>
{
    return Object.hasOwn(document.Demonstrations, id) ? document.Demonstrations[id] : {
        Configuration: { Id: id,
            Revision: 0,
            References: {} },
        SuccessfulCompletions: 0
    };
};

/**
 * Runs one synchronous validated document transaction, publishing the manifest only after all chunks.
 *
 * @throws { Error } When a revision is stale, recovery is active or persistence fails.
 *
 * @category Internal
 * @since 1.0.0
 */
const change = (properties: Properties, update: (document: Document) => Document,
    allowRecovery: boolean = false): Document =>
{
    const current = readDocument(properties);
    if (current.Document.Placement && !allowRecovery)
    {
        throw new Error("Prototype placement recovery or snapshot cleanup is pending");
    }

    const next = decode({ ...update(current.Document),
        Revision: current.Document.Revision + 1 });
    publish(properties, current, next);
    return next;
};

/**
 * Updates one demo while preserving other demonstrations and rejecting stale same-demo edits.
 *
 * @throws { Error } When revisions are stale or the resulting record is invalid.
 *
 * @category Internal
 * @since 1.0.0
 */
const edit = (properties: Properties, id: string, revision: number,
    update: (value: RecordState) => RecordState): Document =>
{
    return change(properties, (document) =>
    {
        const value = record(document, id);
        if (value.Configuration.Revision !== revision)
        {
            throw new Error("Stale demonstration revision");
        }

        const next = update(value);
        return { ...document,
            Demonstrations: { ...document.Demonstrations,
                [id]: {
                    ...next,
                    Configuration: { ...next.Configuration,
                        Id: id,
                        Revision: revision + 1 }
                } } };
    });
};

/**
 * Saves bindings/bounds/arrival without overwriting successful history, structure provenance or colors.
 * Unknown or removed reference names remain archived when omitted from later declarations.
 *
 * @throws { Error } When the revision is stale, recovery is pending or configuration is invalid.
 *
 * @category Storage
 * @since 1.0.0
 */
export const saveConfiguration = (properties: Properties, configuration: Configuration): Document =>
{
    return edit(properties, configuration.Id, configuration.Revision, (value) => ({
        ...value,
        Configuration: { ...configuration,
            References: { ...value.Configuration.References,
                ...configuration.References } }
    }));
};

/**
 * Saves editing/live mode and optional home using the global revision.
 * Home is never required for completeness.
 *
 * @throws { Error } When the global revision is stale, recovery is pending or the pose is invalid.
 *
 * @category Storage
 * @since 1.0.0
 */
export const saveWorld = (
    properties: Properties,
    revision: number,
    editing: boolean,
    home?: Pose
): Document =>
{
    return change(properties, (document) =>
    {
        if (document.Revision !== revision)
        {
            throw new Error("Stale world revision");
        }

        return { ...document,
            Editing: editing,
            Home: home };
    });
};

/**
 * Explicitly clears one binding; ordinary saves retain omitted archived reference names.
 *
 * @throws { Error } When the revision is stale or recovery is pending.
 *
 * @category Storage
 * @since 1.0.0
 */
export const clearReference = (
    properties: Properties,
    id: string,
    revision: number,
    name: string
): Document =>
{
    return edit(properties, id, revision, (value) =>
    {
        const references = { ...value.Configuration.References };
        delete references[name];
        return { ...value,
            Configuration: { ...value.Configuration,
                References: references } };
    });
};

/**
 * Records positive native entity-removal evidence for matching saved bindings, including archived demos.
 * Unknown/unloaded entities must never call this operation. Reassignment with a fresh descriptor clears it.
 *
 * @throws { Error } When storage validation/publication fails.
 *
 * @category Storage
 * @since 1.0.0
 */
export const markEntityRemoved = (properties: Properties, entityId: string): Document =>
{
    return change(properties, (document) => ({ ...document,
        Demonstrations: Object.fromEntries(
            Object.entries(document.Demonstrations).map(([ id, value ]) =>
            {
                let changed = false;
                const references = Object.fromEntries(Object.entries(value.Configuration.References)
                    .map(([ name, binding ]) =>
                    {
                        if (binding.Kind !== "Entity" || binding.Id !== entityId || binding.Removed)
                        {
                            return [ name, binding ];
                        }

                        changed = true;
                        return [ name, { ...binding,
                            Removed: true } ];
                    }));
                return [ id, changed ? { ...value,
                    Configuration: { ...value.Configuration,
                        References: references,
                        Revision: value.Configuration.Revision + 1 } } : value ];
            })) }), true);
};

/**
 * Stores a generated assignment. Color allocation/perceptual policy belongs to the world controller;
 * this assignment remains available when an authored explicit color takes precedence.
 *
 * @throws { Error } When the revision, color or persisted state is invalid.
 *
 * @category Storage
 * @since 1.0.0
 */
export const saveGeneratedColor = (
    properties: Properties,
    id: string,
    revision: number,
    color: RGB
): Document =>
{
    return edit(properties, id, revision, (value) => ({ ...value,
        GeneratedColor: color }));
};

/**
 * Records only successful completion; cancelled and failed runs leave counts and revisions unchanged.
 * No run status is restored by a later load.
 *
 * @throws { Error } When the revision is stale or a successful update cannot be saved.
 *
 * @category Storage
 * @since 1.0.0
 */
export const recordOutcome = (properties: Properties, id: string, revision: number,
    outcome: "Succeeded" | "Cancelled" | "Failed"): Document =>
{
    if (![ "Succeeded", "Cancelled", "Failed" ].includes(outcome))
    {
        throw new Error("Invalid run outcome");
    }

    if (outcome !== "Succeeded")
    {
        const document = load(properties);
        if (record(document, id).Configuration.Revision !== revision)
        {
            throw new Error("Stale demo revision");
        }

        return document;
    }

    return edit(properties, id, revision, (value) => ({
        ...value,
        SuccessfulCompletions: value.SuccessfulCompletions + 1
    }));
};

/**
 * Saves a detached screen draft without altering blocks or the last successful recipe.
 * Cancel simply discards the unsaved caller-owned draft and never calls this function.
 *
 * @throws { Error } When the revision, role-specific choices or permutation provenance is invalid.
 *
 * @category Storage
 * @since 1.0.0
 */
export const saveOptions = (properties: Properties, id: string, revision: number,
    selection: Omit<StructureOptions, "Revision">): Document =>
{
    return edit(properties, id, revision, (value) => ({ ...value,
        StructureOptions: { ...selection,
            Revision: (value.StructureOptions?.Revision ?? 0) + 1 }
    }));
};

/**
 * Captures persisted options; default choices for an unconfigured demo are an unsaved draft only.
 *
 * @category Storage
 * @since 1.0.0
 */
export const preview = (document: Document, id: string): Preview =>
{
    const value = record(document, id);
    return { DemonstrationId: id,
        ConfigurationRevision: value.Configuration.Revision,
        Selection: value.StructureOptions ?? { Revision: 0,
            CatalogVersion: 0,
            Options: Defaults } };
};

/**
 * Journals planned native snapshot partitions before any snapshot or block write.
 * Placement adapters must preflight the exact geometry, dimension heights and loaded/writable chunks.
 *
 * @throws { Error } When not editing, revisions/options are stale, or the proposal is inconsistent.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const beginPlacement = (properties: Properties, captured: Preview, proposed: PlacedRecipe,
    partitions: ReadonlyArray<Bounds>): Document =>
{
    return change(properties, (document) =>
    {
        const fresh = preview(document, captured.DemonstrationId);
        if (!document.Editing || fresh.ConfigurationRevision !== captured.ConfigurationRevision ||
            JSON.stringify(fresh.Selection) !== JSON.stringify(captured.Selection) ||
            proposed.DemonstrationId !== captured.DemonstrationId ||
            proposed.OptionsRevision !== captured.Selection.Revision ||
            JSON.stringify(proposed.Options) !== JSON.stringify(captured.Selection.Options))
        {
            throw new Error("Stale or inconsistent placement preview");
        }

        if (partitions.length === 0)
        {
            throw new Error("Native snapshot partitions are required");
        }

        const id = String(document.Revision + 1);
        return { ...document,
            Placement: { Id: id,
                Stage: "Snapshotting",
                Proposed: proposed,
                Materials: captured.Selection.Permutations,
                CatalogVersion: captured.Selection.CatalogVersion,
                Snapshots: partitions.map((bounds, index) => ({
                    Id: StructurePrefix.Snapshot + id + "_" + index,
                    Bounds: bounds,
                    Saved: false
                })) } };
    });
};

/**
 * Persists native snapshot success one partition at a time; blocks remain unwritable until all are saved.
 *
 * @throws { Error } When the job/stage/partition is stale or invalid.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const snapshotSaved = (properties: Properties, id: string, index: number): Document =>
{
    return change(properties, (document) =>
    {
        const job = requireJob(document, id);
        if (job.Stage !== "Snapshotting" || !Number.isInteger(index) || !job.Snapshots[index])
        {
            throw new Error("Invalid snapshot acknowledgement");
        }

        return { ...document,
            Placement: { ...job,
                Snapshots: job.Snapshots.map((snapshot, current) => current === index ?
                    { ...snapshot,
                        Saved: true } : snapshot) } };
    }, true);
};

/**
 * Switches from snapshotting to writing only after every native partition is durably saved.
 *
 * @throws { Error } When snapshot preparation is incomplete or the job is stale.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const startWriting = (properties: Properties, id: string): Document =>
{
    return change(properties, (document) =>
    {
        const job = requireJob(document, id);
        if (job.Stage !== "Snapshotting" || job.Snapshots.some((snapshot) => !snapshot.Saved))
        {
            throw new Error("Snapshots must all be saved before writing");
        }

        return { ...document,
            Placement: { ...job,
                Stage: "Writing" } };
    }, true);
};

/**
 * Called only after every native block/sign write succeeds. Publishes options, recipe, bounds and arrival
 * atomically, retaining snapshot IDs until native cleanup succeeds. Repeated commit is rejected.
 *
 * @throws { Error } When the job is not writing or publication fails.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const commitPlacement = (properties: Properties, id: string): Document =>
{
    return change(properties, (document) =>
    {
        const job = requireJob(document, id);
        if (job.Stage !== "Writing")
        {
            throw new Error("Placement is not writing");
        }

        const proposed = job.Proposed;
        const value = record(document, proposed.DemonstrationId);
        return { ...document,
            Placement: { ...job,
                Stage: "Cleanup" },
            Demonstrations: {
                ...document.Demonstrations,
                [proposed.DemonstrationId]: { ...value,
                    PlacedRecipe: proposed,
                    PlacedMaterials: job.Materials,
                    PlacedCatalogVersion: job.CatalogVersion,
                    StructureOptions: { Options: proposed.Options,
                        Revision: proposed.OptionsRevision,
                        CatalogVersion: job.CatalogVersion,
                        Permutations: job.Materials },
                    Configuration: { ...value.Configuration,
                        Revision: value.Configuration.Revision + 1,
                        Bounds: proposed.Bounds,
                        Arrival: proposed.Arrival } }
            } };
    }, true);
};

/**
 * Marks cancellation/write failure for restoration without changing prior settings.
 * Cleanup after a committed scene never rolls back its successfully published settings.
 *
 * @throws { Error } When the job is stale or already committed.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const requestRollback = (properties: Properties, id: string, error?: string): Document =>
{
    return change(properties, (document) =>
    {
        const job = requireJob(document, id);
        if (job.Stage === "Cleanup")
        {
            throw new Error("Committed placement requires cleanup only");
        }

        return { ...document,
            Placement: { ...job,
                Stage: "Restoring",
                Error: error } };
    }, true);
};

/**
 * Clears the journal only after the adapter confirms successful restoration/cleanup of all native snapshots.
 * On restoration failure, retain the journal and its snapshots and retry through the recovery controller.
 *
 * @throws { Error } When recovery has not reached a terminal restoration/cleanup stage.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const finishRecovery = (properties: Properties, id: string): Document =>
{
    return change(properties, (document) =>
    {
        const job = requireJob(document, id);
        if (job.Stage !== "Restoring" && job.Stage !== "Cleanup")
        {
            throw new Error("Recovery is not finished");
        }

        return { ...document,
            Placement: undefined };
    }, true);
};

/**
 * Resolves a specific journal identity to reject delayed callbacks from an earlier job.
 *
 * @throws { Error } When the job is missing or stale.
 *
 * @category Internal
 * @since 1.0.0
 */
const requireJob = (document: Document, id: string): PlacementRecovery =>
{
    if (!document.Placement || document.Placement.Id !== id)
    {
        throw new Error("Stale placement job");
    }

    return document.Placement;
};

/**
 * Saves/removes a player's selector-slot recovery record using the global revision.
 * Calling with no recovery clears only that player's descriptor after inventory restoration.
 *
 * @throws { Error } When revisions are stale or the descriptor names a different player.
 *
 * @category Recovery
 * @since 1.0.0
 */
export const saveSelection = (properties: Properties, revision: number, playerId: string,
    recovery?: SelectionRecovery): Document =>
{
    return change(properties, (document) =>
    {
        if (document.Revision !== revision || (recovery && recovery.PlayerId !== playerId))
        {
            throw new Error("Stale or inconsistent selection recovery");
        }

        const selections = { ...document.Selections,
            ...(recovery ? { [playerId]: recovery } : {}) };
        if (!recovery)
        {
            delete selections[playerId];
        }

        return { ...document,
            Selections: selections };
    });
};
