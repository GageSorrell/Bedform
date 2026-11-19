# Prototype persistence

`bedform/Prototype/Persistence` supplies synchronous, versioned world storage.
Pass the native `world` as its `Properties` port, or use a host-test adapter with
`getDynamicProperty` and `setDynamicProperty`. No Node or native runtime import is
needed by the storage implementation.

`load` returns detached data and never writes, regenerates structures, restores
inventories, starts runs, or resumes native placement. A new world starts editing
with no configured demonstrations. Unknown schema versions, unknown fields,
malformed coordinates, invalid material choices and corrupt publications are
rejected without clearing saved progress. No existing key text was changed and no
live world was migrated by this implementation.

The frozen records in `bedform/Prototype/keys` own the manifest, chunk and native
snapshot identifiers. Strings are split at Unicode code-point boundaries into
chunks of at most 24,000 UTF-8 bytes. Each of two alternating banks permits at most
256 chunks. An edit writes the inactive bank first, then atomically switches one
small manifest containing its schema version, revision, chunk count and checksum.
Failed staging leaves the published bank readable. Oversized documents fail
before any write. Unreferenced staging chunks are bounded by the two fixed banks;
the checksum detects corruption and does not provide authentication.

Each demonstration record is keyed by stable ID. `saveConfiguration` checks that
demo's revision and increments it on success. It preserves successful history,
generated color, structure options and placed provenance. Omitted reference names
stay archived when requirements change; `clearReference` is the explicit deletion
operation. `saveWorld` checks the global revision for mode/home changes. Loaded
drafts and cancelled screens have no effect until their save operation is called.
Operations reject concurrent stale edits; separate-demo edits preserve each other.

`recordOutcome` increments successful completion history only for `Succeeded`.
Cancelled/failed runs do not increment counts or restore active run state.
`saveGeneratedColor` retains an RGB assignment by stable ID. An explicit authored
color overrides its effective value in the reconciled view without destroying the
saved generated assignment. Automatic perceptual color allocation and locator-bar
waypoint publication belong to the world controller (`MineCraft-s80.7`). That
controller must show the matching-color waypoint as soon as Arrival is assigned,
in editing and live modes, independently of other setup requirements.

`bedform/Prototype/References` supplies typed `handles`, `resolve`, `completeness`
and `reconcile`. Handles read the current configuration and current native object
on every call, including after reassignment. The native adapter validates dimension
availability and reads blocks/entity IDs. Unknown entity lookup results remain
`Unloaded`; positive native removal events may call `markEntityRemoved` to persist
`Removed` evidence. Never infer removal solely from a missing native handle.
Forbidden player/item entities, air blocks, dimension changes, false predicates
and throwing validators produce invalid results. Live native values are never
serialized.

Completeness counts bounds, arrival, current named references and a trigger only
for runnable demonstrations. Optional home and generated structures do not count.
Assigned-but-unloaded targets remain configured, so they do not increase the
missing/invalid setup count; they independently prevent starting a run. Removed
or known-invalid targets make setup incomplete. Reconciliation follows current
definition order and retains removed demonstrations/references in storage while
excluding them from the active view. Newly added requirements become incomplete.

`saveOptions` persists role-specific material IDs, optional resolved state maps,
catalog version, size/facing, height and roof toggle separately from `PlacedRecipe`.
The disabled main-roof selection is retained. Missing legacy option fields default
in memory, without changing the recipe version or regenerating existing blocks.
Explicitly invalid saved materials never silently receive substitutes. Structural
role validation rejects slab walls, pane ceilings, unsupported IDs and non-bottom
slab permutations. Use `StructureCatalog.qualify` to check selected-engine material
availability, localized names and site-specific upper build limits before preview
and placement. Native construction and rollback execution remain `.16` work.

`preview` snapshots both configuration and option revisions. `beginPlacement`
rejects stale or changed choices and requires editing mode. It journals planned
partition IDs before native snapshots are created. The native placement adapter
must preflight the full rotated floor/border/canopy footprint and dimension build
limits, reserve required chunks, then save each partition's blocks and block-entity
contents through native structure storage. JSON stores only snapshot descriptors;
it never attempts to serialize chest contents or other native block-entity data.

After each native partition save, call `snapshotSaved`; `startWriting` refuses to
proceed until all partitions are acknowledged. The native adapter performs bounded
block/sign writes and calls `commitPlacement` only after every write succeeds. The
commit publishes saved options, variable bounds/arrival and complete placed recipe
together, then leaves the journal in `Cleanup` until native snapshot cleanup succeeds.
The persistence layer does not perform or independently attest native block writes.

Cancellation, write failure or an interrupted uncommitted journal requires
`requestRollback`. Prior configuration remains intact. Native recovery restores
the saved partitions and cleans them up before calling `finishRecovery`. On restore
failure, retain the journal, error and snapshot IDs for retry; no further normal
edits or live transition are permitted while a journal exists. A committed journal
requires cleanup only. Reopening the store never starts native recovery on its own;
the downstream controller must inspect pending journals before permitting activity.

`saveSelection` keeps protected inventory-slot descriptors per player for disconnect
or reload recovery. Original ItemStacks remain in their relocated native inventory
slots, preserving metadata. The selection controller restores inventories and
clears descriptors only after success.

Run `npm run test:prototype --workspace bedform` for constructor, storage, reference,
recovery and isolated packed-consumer checks. Native BDS placement/restart execution
and client-visible behavior remain the epic's separate integration gates.
