# Create and configure Prototype demonstrations

A Prototype demonstration has two parts: its behavior is defined in add-on code,
and its scene is built and assigned in a particular Minecraft world. The same
definition can therefore be used with different scene locations and bindings.

This guide covers `bedform` version `1.0.0-alpha.2` in this checkout.

| Capability | Current availability |
| --- | --- |
| Define demonstrations, named references, and an ordered world | Implemented |
| Validate structure options and material catalogs; store configuration and history | Implemented library services |
| Generate a Prototype server, install tools, run managed demonstrations, and use the in-game editor | Planned; not available through the current CLI/runtime |

**Part 1 can be used to author and type-check definitions now. Part 2 describes the
intended workflow once the server, controller, selection, and editor work is
implemented.** Exporting a world currently does not start a runtime or add menu
items to Minecraft. See the [API reference](prototype.md) and
[implementation plan](../../../Plan/Bedform_PrototypeWorlds_Plan.md) for boundaries.

## Part 1: Define demonstrations in your add-on

### Put definitions in a dedicated entrypoint

Create a module such as `Script/Prototype.ts` inside your add-on. Default-export
one `World.World(...)` containing the demonstrations in navigation order. You can
define demonstrations in separate modules and import them into this entrypoint.
Keep it separate from your ordinary gameplay entrypoint.

Use the exported `Demonstration(...)` constructor for each definition. `Id` is its
permanent storage identity; keep it stable when changing its display `Name`,
`Description`, or registration order. IDs must be unique within a world. Changing
an ID creates a different saved identity rather than renaming the old scene.

Optionally supply `Color` as an RGB object with `red`, `green`, and `blue` channels
between 0 and 1. The planned controller uses that color for the menu and waypoint;
when omitted, it will assign and persist a distinct, subdued color by stable ID.

This complete example defines a static chest inspection and a runnable entity
inspection. Replace the inspection work with your add-on's own behavior:

```ts
import { ItemStack, system } from "@minecraft/server";
import { Block, Demonstration, Entity, NotReady, Ready, World } from "bedform/Prototype";

const Storage = Demonstration({
    Id: "storage",
    Name: "Storage inspection",
    Description: "Assign a chest, then stand in the scene to inspect its block type.",
    References: { Chest: Block },
    Validators: { Chest: block => block.typeId === "minecraft:chest" },
    GetState: context => {
        const Chest = context.References.Chest.Resolve();
        return {
            Status: Chest ? Ready : NotReady,
            Reason: Chest ? undefined : "Assign a loaded chest.",
            Data: Chest?.typeId ?? "Unavailable"
        };
    },
    GetActionBar: context => `Chest: ${context.State.Data}`
});

const EntityInspection = Demonstration({
    Id: "entity-inspection",
    Name: "Entity inspection",
    Description: "Assign an armor stand and a trigger. Activate it to sample the entity three times.",
    References: { Subject: Entity },
    Validators: { Subject: entity => entity.typeId === "minecraft:armor_stand" },
    GetState: context => {
        const Subject = context.References.Subject.Resolve();
        return {
            Status: Subject ? Ready : NotReady,
            Reason: Subject ? undefined : "Assign a loaded armor stand."
        };
    },
    Run: async context => {
        for (let Sample = 0; Sample < 3; Sample++) {
            context.Cancellation.ThrowIfRequested();
            const Subject = context.References.Subject.Resolve();
            if (!Subject) {
                throw new Error("The assigned armor stand is no longer available.");
            }
            context.Player.sendMessage(`Sample ${Sample + 1}: ${Subject.typeId}`);
            await system.waitTicks(20);
        }
        context.Cancellation.ThrowIfRequested();
    }
});

const PrototypeWorld = World.World({
    Demonstrations: [Storage, EntityInspection]
});

export default World.withHotbarInventory(PrototypeWorld, [
    new ItemStack("minecraft:chest"),
    new ItemStack("minecraft:armor_stand"),
    new ItemStack("minecraft:stone_button")
]);
```

The example is checked against packed package declarations. Its native calls need
Minecraft, and the callbacks need the planned Prototype runtime to invoke them.
The inventory declaration describes a future live-mode inventory; it does not give
you these items during editing. Build the example scenes with Creative inventory.

### Choose static or runnable behavior

A definition without `Run` is static: it provides state and optional HUD content,
without a start/cancel cycle or a required trigger. This fits a machine inspection,
display, or continuously operating scene.

Add `Run` when activation should perform a finite asynchronous operation. Return
normally when it succeeds. Check `context.Cancellation.ThrowIfRequested()` between
steps and after awaited work. Cancellation is cooperative; it cannot interrupt a
long synchronous loop or an unresolved promise by itself.

| Optional callback | Intended use |
| --- | --- |
| `CanStart` | Apply an additional start condition using current state, player, or registry history |
| `OnStart` | Prepare resources for a run |
| `OnCancel` | React to a cancellation request |
| `OnCleanup` | Release resources after execution settles, including cancellation or failure |
| `GetActionBar` | Return viewer text, or an array of lines |
| `IsViewing` | Override the default test of whether a player is inside the scene's bounds |

Lifecycle hooks require `Run`. Design cleanup to release only resources owned by
that run. The planned manager allows one shared run per demonstration across all
players, while different demonstrations may run concurrently. A second trigger
activation requests cancellation; it does not start a second instance.

### Supply readiness and typed data

`GetState` is synchronous and returns `Ready` or `NotReady`; supply `Reason` when
it helps explain an unavailable scene. `InProgress` and `Stopping` belong to the
manager, so do not return them from a getter. Keep state getters quick and free of
scene-changing side effects because the controller will refresh them repeatedly.

Returning `Data` lets TypeScript infer its type in execution and viewing callbacks.
`Storage` above carries a string, accessible as `context.State.Data`. Without data,
the default `never` type has no `Data` member. For an explicitly non-`never` data
type, including `undefined`, every returned state must supply `Data`.

`context.Registry.Entries` is keyed by stable demonstration ID and exposes current
state, running count, and successful completion count. Use `CanStart` for a
dependency such as requiring an earlier runnable demonstration to have completed.
Handle a missing entry or state explicitly. Static demonstrations do not acquire
successful run completions merely by being viewed.

### Declare references instead of hard-coding locations

`References` names the objects the player must assign later. Use the exported
`Block` and `Entity` symbols, rather than strings. Keys such as `Chest` and
`Subject` become typed members of `context.References`. Keep those names stable
when you want existing bindings to continue to apply.

Use `Block` for chests, signs, and other block entities, then obtain native
components from the resolved block. Use `Entity` for persistent non-player
entities; players and dropped items cannot be bound. Optional `Validators` check
that each selected native object is appropriate for your scene.

Call `Resolve()` again when you need the object, especially after an `await`.
An object can unload, disappear, or be reassigned. Handle `undefined` rather than
retaining a native object indefinitely. A reference's saved dimension/coordinates
or entity ID belongs to world configuration; do not put native handles in saved
state. Temporarily unloaded references remain assigned but prevent a run from
starting until available again.

### Register the world and optional player inventory

`World.World` accepts heterogeneous demonstrations in a fixed order. Pass the
constructed values directly; spreading a demonstration loses its non-enumerable
identity brand. Registration validates definitions without running their callbacks.

Inventory helpers return a new world definition and clone supplied `ItemStack`s:

| Helper | Destination slots | Maximum items |
| --- | --- | --- |
| `World.withHotbarInventory` | 1–8 | 8 |
| `World.withMainInventory` | 9–35 | 27 |
| `World.withInventory` | 1–35 | 35 |

Array index zero maps to the first listed slot. Slot zero is reserved for Prototype
tools. Unspecified positions in a configured section are cleared; unconfigured
sections are left alone. A full-inventory call replaces both section settings.
The planned live controller applies these settings; the helpers themselves only
construct the definition.

## Part 2: Create and configure scenes in-game

**Planned workflow:** the following tools, screens, and command are specified by
the epic but are not yet wired into this checkout. Treat this as the setup guide
for that workflow, not as a claim that the current CLI can execute it. Exact screen
wording may change as the editor is implemented.

### 1. Create and join a Prototype server

The planned project setting `Prototype.Entry` selects your dedicated world module.
From the add-on root, the planned command is:

```text
bedform prototype create --name Inspection
```

It is intended to build the add-on and produce a self-contained BDS server with a
fresh world at `<addon>/Demonstration/Inspection/server`, including launchers and
generated tools. Normal terrain, Creative mode, and Peaceful difficulty are the
defaults. Flat terrain is an option, with its default grass surface at Y=63.
Start the generated launcher and join that server to configure its world.

The current CLI does not implement `bedform prototype create`, and the current
configuration schema does not yet accept `Prototype.Entry`. Defining the module
is the available preparation step. The generator will supply tool pack assets and
runtime registration; authors will not need to hand-author setup-tool JSON.

### 2. Open the world editor and build a scene

A new Prototype world is intended to start in world-wide editing mode. Use the
setup tool in hotbar slot 0 to open the main editor. It lists the demonstrations
registered in code; in-game setup assigns their scenes rather than creating new
TypeScript definitions. Add a new code definition and rebuild/update the server
when you need another demonstration.

For the example, place a chest for **Storage inspection**. For **Entity inspection**,
place an armor stand and a supported button or pressure plate. Keep enough clear
space for players to stand and navigate. Build manually, or use the optional
structure workflow below.

### 3. Assign each demonstration's required fields

Choose a demonstration in the editor, then assign:

| Field | What to select |
| --- | --- |
| Bounds | Two opposite block corners enclosing the scene, in one dimension |
| Arrival / teleport pose | Stand at the desired arrival position and face the desired direction, then capture the pose |
| Named references | Select the block or entity for every name declared in `References` |
| Trigger, for runnable demonstrations | Select a supported button or pressure plate |

Bounds include both selected corner cells. Arrival saves position, dimension, and
rotation independently of the scene's bounds. For the example, assign `Chest` to
the chest and `Subject` to the armor stand. Validators should refuse the wrong
block/entity type. Static **Storage inspection** needs no trigger.

During selection, the planned temporary selector occupies slot 1 while the menu
tool remains in slot 0. Its previous item is relocated and restored; selection
should refuse to begin when no safe inventory slot is available. Aim at the target
and use the selector. Bounds need two selections. Private outlines show the focused
cell and candidate bounds; target reach is five blocks. Sneaking targets a hit
face's adjacent air cell, which is useful for empty-space corners. Without a solid
hit, the selector can focus a valid air cell three blocks ahead.

Use slot 0 to reopen the editor. Press the active assignment action again to cancel
it. Cancelling selection should restore the camera and displaced item. Existing
bindings can be reassigned or cleared through the editor.

### 4. Optionally generate the surrounding structure

Open **Create structure / Structure options** for an existing demonstration.
This creates a room and entrance around a chosen center; it does not create the
chest, armor stand, trigger binding, or code behavior for you.

Choose a cardinal facing and one of these main-floor interior sizes:

| Size | Interior | Including the one-block border |
| --- | --- | --- |
| Small | 7×7 | 9×9 |
| Medium, default | 17×17 | 19×19 |
| Large | 25×25 | 27×27 |

Set **Interior height** to a whole number of at least 3. **Main ceiling** defaults
off. The entrance always has its own ceiling, even when the main room is open.
Heights must fit the actual dimension and floor level; invalid heights are rejected
rather than shortened. Facing points from the room toward the entrance sign wall.

The six independent material choices default to:

| Part | Default |
| --- | --- |
| Main floor | Iron block |
| Entrance sign wall | Stone |
| Entrance floor and main border | Polished andesite |
| Main walls | Glass |
| Main ceiling | Glass |
| Entrance ceiling | Smooth stone slab |

Floors and sign supports use solid blocks. Main walls also allow glass and panes;
ceilings also allow glass and bottom-half slabs. Dropdown labels use localized
in-game block names. Turning the main ceiling off retains its disabled material
selection. The entrance-ceiling control stays enabled.

Save options to retain the choices without changing blocks. Select the center
floor cell, inspect the private preview and full clearance extent, then explicitly
confirm placement. Changing options after preview requires a fresh preview.
Cancel discards an unsaved screen draft; saved options remain separate from the
last placed structure.

**Confirm the clearance area carefully:** placement is designed to clear every
block above the selected floor to the dimension's maximum build height in all
room, border, and entrance columns, including existing roofs. It preserves blocks
below the floor, neighboring columns, and entities. Placement must complete or
recover its rollback before editing/live activity continues.

A successful placement supplies default bounds and arrival. Assign the actual
named references and runnable trigger afterward. Manually built scenes are equally
supported; generating a structure is never a completeness requirement.

### 5. Check completeness and finish editing

The editor is intended to show incomplete demonstrations out of the total, and
missing/invalid required fields for each. Bounds, arrival, and all named references
are required; only runnable demonstrations need a trigger. Optional home and
generated structures do not contribute to the count. Unloaded bindings remain
configured but can still make a demonstration unavailable to run.

Set an optional world home pose if useful. Once every demonstration is configured,
the editor shows **Everything completed!**. Choose **Finish editing** when no
placement or recovery is active. Editing/live mode is shared by the entire world.

### 6. Navigate, run, and revise scenes

In the planned live mode, slot 0 contains the navigator, and configured inventories
are applied. Use the navigator to visit demonstrations or home. Once an arrival
pose is assigned, a matching-color locator-bar waypoint should appear in editing
and live modes, even before the rest of that scene is complete.

Stand inside the static chest scene's bounds to see its action-bar text. Activate
the entity scene's trigger to run its three samples; activate again to request
cancellation. A run must satisfy readiness, loaded references, and any `CanStart`
condition. Successful runs increase saved completion history; cancelled or failed
runs do not. A failed run requires an explicit reset. Runs do not resume after a
server restart.

To change a scene, return to editing through the navigator and confirm the
world-wide transition. New starts are blocked while active runs cancel and clean
up. Then move blocks, reassign references, adjust bounds/arrival, or explicitly
place a new structure. Rebuilding or restarting should preserve saved choices and
placed scenes rather than silently regenerate them. Keep stable IDs to preserve
configuration/history across code updates; newly declared references need setup.

For missing setup, check the editor's required-field details. For a configured but
unavailable demo, check unloaded/removed references, validators, its readiness
reason, and dependencies. Callback failures belong in the editor and server logs.
Pending placement recovery must finish before normal activity resumes.

See [Prototype persistence](prototype-persistence.md) for the implemented storage
and recovery services, and the [API reference](prototype.md) for catalog integration.
Live BDS and real-client validation remain separate epic acceptance work.
