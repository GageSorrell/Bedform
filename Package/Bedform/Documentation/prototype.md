# Prototype authoring contracts

For a two-part walkthrough, see [Create and configure Prototype demonstrations](prototype-guide.md):
define demonstrations in add-on code, then follow the planned in-game setup workflow.

`bedform/Prototype` provides the first part of the Prototype-world API: definitions,
typed callbacks, inventory composition, and structure contracts. It does not yet
create servers, run demonstrations, show editor screens, or place structures.
Versioned world storage, reference resolution and recovery journals are implemented;
see [Prototype persistence](prototype-persistence.md).
Those services are tracked separately under `MineCraft-s80`.

Use a dedicated source entrypoint default-exporting an ordered world definition:

```ts
import { Demonstration, Ready, Block, World } from "bedform/Prototype";

const Storage = Demonstration({
    Id: "storage",
    Name: "Storage",
    Description: "Inspect the chest's current contents.",
    References: { Chest: Block },
    Validators: { Chest: block => block.typeId === "minecraft:chest" },
    GetState: context => ({
        Status: Ready,
        Data: context.References.Chest.Resolve()?.typeId ?? "Unavailable"
    }),
    GetActionBar: context => context.State.Data
});

export default World.World({ Demonstrations: [Storage] });
```

Stable IDs retain settings across renames and reordering. The constructor validates
identity, reference kinds, validators, and callback shapes without invoking authored
callbacks. Its exported `TypeId` symbol holds a non-enumerable, invariant generic
witness; spreading a definition loses this nominal identity. Definitions and their
reference/validator records are copied and frozen.

`State<never>` has no `Data` member. Every other data argument, including `undefined`,
requires `Data`. Constructor inference carries getter data and reference kinds into
the other callbacks. Getters are synchronous and return `Ready` or `NotReady`;
`InProgress` and `Stopping` belong to the future execution manager. A definition with
no `Run` is static. Adding asynchronous `Run` permits `OnStart`, `OnCancel`, and
`OnCleanup`. Their context includes the initiating player, typed state, references,
world configuration, registry history, and cooperative cancellation token.

Reference handles resolve current native objects or `undefined` when unavailable.
Use `Block` for containers, signs, and their components; use `Entity` for non-player,
non-item entities. `isBindableEntity` supplies the exclusion check for binding services.
No constructor saves entity bindings or retains live native objects.

`World.withInventory(world, items)` clones stacks into slots 1–35, skipping reserved
slot 0. `withHotbarInventory` configures slots 1–8; `withMainInventory` configures
slots 9–35. They reject lengths above 35, 8, and 27 respectively. Unspecified slots
in configured sections become `undefined` for clearing; unconfigured sections stay
unconfigured. A full setting replaces both sections. Each helper returns a new
definition and clones retained configured sections too. Native ItemStacks remain
mutable, but updates to one definition do not mutate another definition's stacks.

`bedform/Prototype/Structure` exports `Options`, `Materials`, `Presets`, `Defaults`,
and layout/placement/provenance contracts. Presets describe interior and bordered
sizes: Small 7/9, Medium 17/19, Large 25/27. Defaults select Medium, South-facing
signs, height 3, and no main ceiling. Materials default to iron main flooring,
stone sign supports, polished andesite entrance/border flooring, glass walls and
main ceiling, and smooth stone slabs for the always-present entrance ceiling.
Floors/supports accept the solid palette, walls additionally accept glass and panes,
and ceilings additionally accept glass and slabs. Slabs require bottom-half states
when resolved for placement. The exported palettes fix the initial identifier unions;
`bedform/Prototype/Structure/Catalog` (also `Prototype.StructureCatalog`) qualifies
those choices against the selected engine and supplies localized dropdown data.

Call `nativeEngine(BlockTypes, BlockPermutation)` with the native static registries,
then `qualify(options, engine, site, savedPermutations)` before preview or placement.
`normalize` defaults omitted legacy fields and rejects invalid explicit values;
`validateSite` takes inclusive `MinY`, exclusive `MaxYExclusive`, and `FloorY`, checks
walls and both roofs, and returns the largest legal interior height without clamping.
The entrance canopy always needs `FloorY+4`, even with the main ceiling off.

`catalog(part, engine)` returns each role's ordered IDs, exact native permutations
and translated labels using `BlockType.localizationKey`. `dropdown(part, options,
choices)` maps the current catalog to native-compatible numeric items; `withChoice`
applies an index to a detached options draft. Rebuild that mapping on reopen rather
than storing indexes or translated strings. The disabled main-ceiling control keeps
its selection; the entrance-ceiling control stays enabled. Save the qualified result
through `Persistence.saveOptions`; all six IDs/states are retained separately from
the placed recipe. Missing blocks, localization metadata, unsupported saved states
or incomplete saved permutations fail explicitly. Slabs require the bottom half.

These adapters are tested in isolation with native-shaped ports and packed type
consumers. Actual native availability, pane connections, slab appearance and names
rendered in multiple client locales remain downstream native/client gates.

`SavedOptions` records editable choices and their revision. `Placement` snapshots
the preview revision and layout. `PlacedRecipe` records a successful placement and
its complete footprint, bounds and arrival pose. They are separate types so saving
options need not claim that a structure was placed. Persistence now stores these
choices and journals partitioned native snapshots. Geometry, full-height clearance
and native rollback execution are later services.

The game entrypoints use only erased native type imports and game-safe JavaScript.
`bedform/Prototype/World/Host` is a separate host-service contract boundary and is
never re-exported by game modules. Shared production builds now reject reachable
Prototype runtime imports unless explicitly permitted; erased type imports remain
valid. Use `--development` or the explicit production permission described in
[configuration](configuration.md#development-module-boundary). Neither adds
Prototype assets or startup. Prototype generation settings/engine qualification and
dedicated build wiring remain under `MineCraft-s80.4` and `.5`.
