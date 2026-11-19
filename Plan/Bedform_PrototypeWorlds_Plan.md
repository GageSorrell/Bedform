# Bedform Prototype worlds

## Summary and integration

Add `bedform/Prototype`, `bedform/Prototype/World`, and `bedform/Prototype/Interaction`, plus `bedform/Prototype/Demonstration`, `bedform/Prototype/Structure`, and a separate host-only `bedform/Prototype/World/Host` entrypoint for CLI operations.

Developers define demonstrations in a dedicated source entrypoint. `bedform prototype create --name Foo` builds the add-on and creates a self-contained BDS server with a **fresh world**. Players build their scenes manually or place a generated demonstration structure, then assign world-specific information using generated tools.

- Reuse the existing add-on build plan (`MineCraft-5sn`), completed shared configuration/script-only foundations (`MineCraft-5jg`, including `.3.1`), and [imperative DDUI plan](Bedform_DDUI_TSX_Config_Init_MultiPart_Plan.md). Generated tools and native observable forms do not require DDUI JSX or a separate hook renderer. `MineCraft-w82n.5` replaces retired `l89.5`/functional-renderer prerequisites with closed `5jg.3.1` builds and imperative `l89.3/.4` bindings; future-epic wiring remains `.7`.
- Extract reusable creation, locking, backup, and launch infrastructure from the standalone demonstration creator. Preserve its existing commands and generated servers.
- Initially target Windows x64, matching the planned build CLI.
- Preserve package versions and unrelated workspace changes. Follow repository TSDoc, namespace, generated-type, and identifier-key conventions.

## Public API and demonstration lifetime

**Definitions**

- Export a `Demonstration<Data = never, References = {}>` type and constructor, with an exported `unique symbol` brand. Constructed values carry a non-enumerable dummy function whose signature encodes both type arguments.
- Require a stable `Id`, `Name`, `Description`, and synchronous `GetState`. Support optional `Color`, `References`, `CanStart`, `GetActionBar`, and `IsViewing` callbacks.
- `Demonstration.Color` is optional. Resolve an omitted color to a unique, easy-on-the-eyes color, chosen to be perceptually distinct from colors already assigned to demonstrations; avoid near-duplicate shades, harsh neon colors, and extremes that impair readability. Preserve generated assignments by stable demonstration ID across declaration reordering, renaming, reconnect and restart. An explicit authored color takes precedence. Use the same resolved color for the demonstration in DDUI and its locator-bar waypoint; do not choose a new random color on every render or join. Qualify palette capacity and perceptual separation, and report exhaustion/conflicts rather than silently assigning indistinguishable colors.
- Export the unique symbols `Ready`, `InProgress`, `NotReady`, and `Stopping`.
- `State<Data>` contains `Status`. It contains required `Data` exactly when `[Data] extends [never]` is false; the property is absent for `never`.
- Named references use a record of exported `Block` and `Entity` symbols. Infer typed reference handles from its keys and values. Handles resolve the current object, allowing callbacks to handle unloading or removal.
- Containers, signs, and other block entities are `Block` references accessed through their components. Support optional typed validation predicates for individual named references. Exclude players and item drops from saved entity bindings.
- A definition without `Run` is static. Runnable demonstrations additionally support `OnStart`, asynchronous `Run`, `OnCancel`, and `OnCleanup`.

**Managed execution**

- Allow one shared run per demonstration world-wide. Different demonstrations may run concurrently.
- Before starting, resolve required references, fetch current state, and evaluate `CanStart` against a world registry containing other demonstrations' states, running counts, and completion history.
- Reserve a run synchronously before awaiting callbacks, preventing simultaneous requests from starting it twice.
- Prototype owns `InProgress` and `Stopping`; the authored getter supplies `Data` and idle readiness. Missing configuration, unavailable references, or failed predicates prevent starting.
- Give run callbacks the initiating player, world configuration, named references, current state/data, registry access, and a Bedrock-compatible cooperative cancellation token.
- A successful return from `Run` completes the demonstration. Cancellation requests invoke `OnCancel` once; cleanup runs once after execution settles, including failures. Keep an uncooperative run in `Stopping` rather than pretending it stopped.
- Surface callback errors in DDUI and server logs. Failed runs become `NotReady` until explicitly reset. Never fabricate generic `Data` when a getter fails.
- Persist successful completion counts by stable ID. Cancellation and failure do not count. Active runs do not resume automatically after restart.

**World definitions and inventory**

- `Prototype.Entry` points to a module default-exporting a world definition containing an ordered demonstration list.
- Export `World.withInventory`, `World.withHotbarInventory`, and `World.withMainInventory`, returning updated definitions and cloning supplied `ItemStack`s.
- Full inventory arrays map index `0` to inventory slot `1`, continuing through the remaining hotbar and main slots. Maximum lengths are 35 overall, eight hotbar, and 27 main inventory slots for the standard player container.
- Reject oversized arrays. Clear unspecified slots within configured sections; leave unconfigured sections alone. A later full-inventory setting replaces both sections; section-specific settings replace only that section.

## In-game configuration and interaction

**Screens and tools**

- Build editor and navigator screens using imperative bedform DDUI forms and native observables, with reactive status icons, tooltips, descriptions, readiness reasons, and teleport buttons. Native DDUI supports observable image and tooltip values. ([Button options](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/buttonoptions?view=minecraft-bedrock-experimental))
- Generate setup, navigation, and temporary selection items automatically during prototype builds. Developers do not author their pack JSON or registration code.
- Reserve hotbar slot `0` for the setup tool while editing and the navigator while live. Move displaced items into available inventory space, preserving their contents.
- While selecting, keep the menu tool in slot `0` and temporarily equip the selector in slot `1`. Relocate and protect its previous stack in a free inventory slot, record recovery information, and restore it on completion or cancellation. Refuse selection with an explanatory message if no safe slot is available.
- Using slot `0` reopens DDUI. Pressing the active assignment button cancels that mode. Clean up selection state, shapes, camera changes, and temporary items on cancellation, death, dimension change, disconnect, and reload, recovering inventory on the next spawn where necessary.

**Required information**

- Every demonstration requires bounds, a teleport pose, and its named references. Runnable demonstrations also require one button or pressure-plate binding.
- Capture teleport poses from the player's position, dimension, and rotation.
- Show incomplete demonstrations divided by total demonstrations at the top, and missing/invalid fields divided by required fields for each incomplete demonstration.
- Exclude optional home configuration from completeness counts. Show green **"Everything completed!"** when nothing is missing.
- Display assigned reference details and provide reassignment and clearing controls. Temporarily unloaded references remain assigned but make the relevant run unavailable.

**Generated demonstration structures**

- Add an optional **Create structure / Structure options** action to each demonstration's entry in the main world-editing DDUI screen. It opens a dedicated options screen for that existing code-defined demonstration; it does not create or modify a source definition. Manual scene building remains supported, and a generated structure is not an additional completeness requirement.
- The options screen contains size, cardinal facing, a **Main ceiling** toggle, an **Interior height (blocks)** whole-number field, six material dropdowns, and controls to save options, preview/select placement, cancel, and return to the main editor. Default to Medium, `IncludeMainCeiling=false`, and `InteriorHeight=3`. Height must be an integer of at least three so the existing two-block-high entrance has a lintel. Validate the upper limit against the actual placement dimension and floor height, including both roofs; never silently clamp it.
- Offer exactly three main-floor presets: **Small = 7×7**, **Medium = 17×17**, and **Large = 25×25**. Sizes describe the interior, excluding its one-block-wide border: complete bordered squares are **9×9**, **19×19**, and **27×27**. All floors are one block thick with a unique center cell. Iron remains the default main-floor material, but it can be changed below. Export typed `Structure.Options`/material/layout/placement contracts and presets from `bedform/Prototype/Structure`; the development-module restrictions apply to this submodule too.
- Provide the following six independent material controls. Keep the main-ceiling material control mounted but disabled while the main-ceiling toggle is off, retaining its selection. The entrance ceiling is always present and its control is always enabled.

| Structure part / material field | Default | Dropdown choices |
| --- | --- | --- |
| Main section floor / `MainFloor` | Iron block | Solid palette |
| Entrance sign wall / `EntranceWall` | Stone | Solid palette |
| Entrance floor / `EntranceFloor` | Polished andesite | Solid palette |
| All four main-section walls / `MainWalls` | Glass | Solid palette, glass palette, and pane palette |
| Optional main-section ceiling / `MainCeiling` | Glass | Solid palette, glass palette, and slab palette |
| Always-present entrance ceiling / `EntranceCeiling` | Smooth stone slab | Solid palette, glass palette, and slab palette |

- The **solid palette** is the ordered list `minecraft:iron_block`, `minecraft:polished_andesite`, `minecraft:smooth_stone`, `minecraft:stone`, `minecraft:stone_bricks`, `minecraft:quartz_block`, `minecraft:white_concrete`, and `minecraft:black_concrete`. The **glass palette** is `minecraft:glass`, `minecraft:white_stained_glass`, and `minecraft:light_gray_stained_glass`; the **pane palette** is the corresponding `minecraft:glass_pane`, `minecraft:white_stained_glass_pane`, and `minecraft:light_gray_stained_glass_pane`; the **slab palette** is `minecraft:smooth_stone_slab`, `minecraft:stone_brick_slab`, and `minecraft:quartz_slab`. Concatenate listed palettes in table order without duplicates. Floors/sign supports use full stable blocks; ceilings accept full blocks or bottom-half slabs, and panes are offered only for main walls. Do not include air, liquids, falling blocks, gold, diamond, or unsupported custom blocks in this initial catalog. The floor border follows `EntranceFloor`, keeping the border and approach coordinated without adding a seventh material control.
- Dropdown labels are localized in-game block names, using each resolved `BlockType.localizationKey` in a translated `UIRawMessage`; never show raw identifiers as the normal choice text. Native dropdown entries accept translated messages. Store selected block IDs and required permutations, not translated labels or transient dropdown indexes; resolve the current catalog order when reopening. Validate choices against their part-specific catalog and selected engine; report a missing/unsupported saved material without silently substituting it. ([Block localization keys](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blocktype?view=minecraft-bedrock-stable), [dropdown labels](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/dropdownitemdata?view=minecraft-bedrock-stable))
- Save per-demonstration options separately from the last successfully placed recipe. Changing or saving options does not mutate existing blocks. Cancel discards that screen's unsaved draft; saved options survive screen close/reconnect/restart. Placement snapshots its validated options and revision, so changing settings after preview invalidates confirmation and requires a fresh preview. Existing placed structures remain intact until an explicitly confirmed new placement.
- Define the layout in local block coordinates: the chosen center floor cell is `(u=0, y=F, v=0)`, `r=(N−1)/2`, positive `v` points toward the entrance sign wall, and positive `u` is the viewer's right when facing the signs. Rotate by cardinal quarter turns. Bedrock's vertical axis is **Y**, not Z. With interior height `H`, the clear interior occupies `y=F+1` through `F+H`; an enabled main ceiling starts at **`y=F+H+1`**, one block above the highest interior air cell. A bottom-half slab ceiling has the same underside at that level, rather than reducing usable interior height.
- Fill `u,v ∈ [−r,r]` at `y=F` with `MainFloor`. Surround it with a complete one-block-wide ring of `EntranceFloor` at the same height, where `max(abs(u),abs(v))=r+1`, including all four corners. The border never replaces the main floor's edge cells.
- On every border cell place `H` wall blocks of the single selected `MainWalls` type at `y=F+1` through `F+H`. At the middle of the apron-facing edge, omit only `u ∈ [−1,1]`, `v=r+1`, `y ∈ [F+1,F+2]`: the entrance stays three blocks wide and two blocks tall. At the default `H=3`, its lintel is the single row of three wall blocks at `F+3`, preserving the clarified earlier layout. For larger heights, ordinary wall courses continue above that row uniformly with the other sides; do not add a separately thickened or raised arch. Pane choices must have correctly connected corner, side, and lintel permutations. Keep the floor continuous under the passage, with no step or door block.
- When `IncludeMainCeiling` is true, fill the entire bordered square `u,v ∈ [−r−1,r+1]` at `y=F+H+1` with `MainCeiling`; otherwise leave the main section open above its wall tops. This optional roof and the adjustable wall height supersede the earlier unconditional open-roof/three-high/no-fourth-row rules. The minimum-height lintel remains a single row; an enabled ceiling is a distinct roof plane at the requested interior-height offset.
- Add a centered 5×3 entrance floor of `EntranceFloor` over `u ∈ [−2,2]`, `v ∈ [r+2,r+4]`, at `y=F`. Its central three lanes connect through the border opening into the main region. The entrance uses a fixed three-block interior height independent of `H`, keeping it compact and the signs at a consistent reading height.
- Build the separate five-block-wide, one-block-thick sign wall of `EntranceWall` over `u ∈ [−2,2]`, `v=r+4`, `y ∈ [F+1,F+3]`, facing back toward the demonstration. Always cover the entrance floor with a single flat roof plane of `EntranceCeiling` at `y=F+4` over `u ∈ [−2,2]`, `v ∈ [r+2,r+4]`. Use bottom-half permutations for slab choices. This roof is outside the main border and never overwrites the selected main roof or its material. Its underside leaves three clear blocks over the entrance floor regardless of the main ceiling toggle.
- Give the entrance a restrained, professional appearance: a flat slab roof by default, coordinated border/entrance flooring, and symmetrical clear-glass-pane side screens at `u=−2` and `u=2`, `v ∈ [r+2,r+3]`, `y ∈ [F+1,F+3]`. The screens are fixed decorative entrance elements, separate from the main section's four uniformly selected walls. Preserve the central three-lane approach and sign-reading space; use correct pane connections, no towers, ornamental stacks, extra roof bands, stairs in the walking path, or enlargement beyond the existing entrance footprint. Slabs and pane detailing provide the requested simple styling without requiring stairs as an additional decoration.
- Attach the name's oak wall sign at `(0,F+2,r+3)`, at head level above the entrance floor. Place at most two description signs to its viewer-relative left: first `(−1,F+2,r+3)`, then `(−1,F+1,r+3)` only when needed. Read the upper sign fully before the lower. These positions are independent of main-region height and both roof choices; neither roofs nor side panes may obscure the signs or obstruct the reading position.
- Wrap sign text to four explicit lines per sign using a glyph-width-aware budget qualified against the supported Bedrock engine and font assets. Preserve authored line breaks, wrap at words, split long words only at grapheme boundaries, account for spacing, use conservative unknown-glyph widths, and omit formatting controls from the plain sign copy. Do not treat the native string-length limit as a rendered-fit limit. If the name cannot fit one sign, refuse placement rather than truncate it. Flow the description through at most eight lines across two signs, with a fitted ellipsis only at the very end when needed. Keep complete text in DDUI, use black front-face text, and wax the signs. ([Native sign text and waxing API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blocksigncomponent?view=minecraft-bedrock-stable))
- Select the center with the existing selector and show a private debug preview of the selected materials, interior/bordered sizes, variable-height walls, main ceiling if enabled, entrance canopy/panes, sign wall, arrival pose, and full-height clearance columns. The same editor action cancels placement mode. Final confirmation states height, ceiling state, material choices and complete clearance extent. Preview and saving options never place blocks.
- Before construction, remove every existing block above `F` through the dimension's maximum build height in the exact union of main-floor, border, and entrance columns, including roofs/supports. Then build the floors, chosen walls/ceilings, canopy/panes, and signs. Leave blocks below `F`, neighboring columns, and entities untouched. Always perform full-height clearance even when the main ceiling is off; do not confuse requested interior height with a clearance cap.
- Place only during world-wide editing after active demos have stopped. Preflight exact material permutations, dimension/build limits for both roofs, loaded/writable chunks, overlap with other demonstrations, text fit and current revision; revalidate after confirmation. Serialize placement jobs, retain needed chunks, and use bounded tick batches with progress/cancellation. Snapshot all affected block permutations and block-entity contents in partitioned native world structures first, journaling snapshot IDs for cancellation/write-failure/restart rollback. Restore prior scene/settings before further activity, retain recovery material on restoration failure, and use frozen script-owned identifier records.
- After every write succeeds, commit the selected options, recipe version, center/dimension/facing, complete footprint and editable default bounds/arrival. Bounds enclose the bordered square plus covered entrance vertically from `F` through `F+max(6,H+2)` exclusive; the extra extent covers the optional main roof and the fixed entrance roof. Arrival remains `(0,F+1,r+2)` facing the signs, with clear standing/head space under the canopy. Do not replace prior bounds/pose before success. Runnable triggers and named references still need normal assignments/validation. Release temporary snapshots/chunk retention after commit. Rebuilds/restarts never implicitly regenerate a placed scene; preserve legacy recipe settings when absent fields are defaulted, and apply the new entrance style only on explicit placement.

**Selection**

- Bounds selection uses two block coordinates in one dimension. Include both entire cells: minimum coordinate through maximum coordinate plus one. Display focused coordinates before the first selection, then candidate dimensions and volume.
- Use native debug shapes, restricted to the selecting player, for the focused cell, first corner, and candidate AABB. Update selection feedback every two ticks and remove owned shapes explicitly. ([Debug-shape visibility and lifecycle](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/debug-utilities/debugshape?view=minecraft-bedrock-experimental))
- Use a first-person camera during selection and restore the default camera afterward.
- Raycast within five metres. Normally focus the hit block; while sneaking, focus its face-adjacent cell if that cell is air.
- Without an in-range solid hit, test the cell containing `cameraPosition + viewDirection × 3`. Require it to be loaded, in bounds, and air; otherwise show no valid focus.
- Three metres guarantees at least `3 − √3 ≈ 1.268 m` between the camera and the nearest point of that unit grid cell. This is a geometric clearance policy, rather than an asserted Bedrock placement constant.
- Trigger selection includes passable blocks so pressure plates can be targeted. Accept supported buttons and pressure plates only.
- Reference selection accepts only the declared kind, respects occlusion, and runs its optional validator before saving. Selection consumes tool interactions without activating or modifying the target.

**Editing, live mode, and HUD**

- Editing is world-wide. Anyone may enter after confirmation; immediately block new starts, request cancellation of active runs, and wait for cleanup before allowing changes.
- Enable **Finish editing** only when configuration is complete and no structure placement or recovery is active. It persists live mode, replaces setup tools with navigators, and applies configured inventories to connected players.
- In live mode, button activation or a pressure plate's unpressed-to-pressed edge starts a ready demo or requests cancellation of its running instance. Ignore repeated activation while stopping. Static demonstrations have no trigger requirement.
- On connection, give the appropriate slot-0 tool. For fully configured live worlds, apply inventory settings and teleport to the optional home pose, otherwise the zeroth demonstration's pose. In incomplete worlds, use default spawn.
- Allow setting, clearing, and visiting home through the editor. The navigator offers home navigation and confirmed return to editing.
- Once a demonstration has a saved location (its dimension-qualified teleport/arrival pose), show a locator-bar waypoint at that location whose color matches its resolved demonstration color. Show these waypoints in both editing and live mode, including partially configured or not-ready demonstrations; bounds, triggers, references and Finish editing are not prerequisites. Reflect location/color changes, clear the waypoint when the location is cleared or the demonstration is archived, and restore it on join/restart without duplicates. Qualify native locator-bar support, dimension behavior and visibility on the selected engine; unsupported configurations must produce an actionable compatibility diagnostic rather than silently omitting the feature.
- Refresh demo state and action-bar content every ten ticks, with immediate refresh after relevant actions. Join array results with `\n` and replace the entire action bar.
- Default viewing uses the player's position inside dimension-qualified bounds. Support `IsViewing` overrides; registration order breaks overlapping matches. Selection feedback takes priority, and clear Prototype's action bar when viewing ends.

## CLI, builds, and persistence

**Commands**

```text
bedform prototype create --name <name> [--out <parent>] [options]
bedform prototype list | ls
bedform prototype query <name-or-path>
bedform prototype update <name-or-path>
bedform prototype remove <name-or-path> [--yes]
```

- `create` accepts no existing-world argument. Default output is `<addon>/Demonstration/<name>/server`; `--out` changes the parent directory.
- Validate `--name` as a portable directory component, including Windows reserved names, separators, traversal, and trailing spaces/dots. Refuse an existing destination.
- Resolve named servers under the current add-on's `Demonstration` directory; explicit paths support external outputs. `list` scans the default directory. Provide human-readable output and `--json` for list/query.
- Persist versioned server metadata containing ownership, source/config paths, engine provenance, build hashes, installed packs, and launch settings.
- `query` reports recorded settings, installed builds, paths, and running/stopped status without requiring the server to run. In-game configuration remains authoritative in the world.
- `update` requires a stopped server, rebuilds the primary add-on and recorded source companions, refreshes built-pack inputs, validates the complete pack set, and replaces packs transactionally.
- Preserve world data, player data, configuration, history, pack UUIDs, and engine files during update. Back up the server first and restore previous packs if publication fails.
- `remove` verifies ownership and stopped status, then requires confirmation or `--yes`. Remove only the selected server directory, leaving backups intact.

**Configuration and generation**

- Add `Prototype.Entry`, optional `Prototype.BehaviorPack` for ambiguous multi-pack projects, and defaults corresponding to repeatable `--with`, `--world-shape`, `--flat-floor-height`, `--gamemode`, and `--difficulty`.
- Default to normal terrain, Creative mode, and Peaceful difficulty. Flat worlds place grass blocks at **Y=63**, with dirt below and bedrock at the dimension floor.
- `--with` accepts bedform source roots, pack folders, `.mcpack`, and `.mcaddon`. Build source roots through the shared pipeline; validate UUID dependencies and conflicting inputs before publication.
- Resolve configuration paths relative to the config file and CLI paths relative to the caller. Explicit CLI values override configuration using the existing override-reporting convention.
- Download and cache official stable BDS unless `--bds`, `BDS_PATH`, or `BDS_ROOT` selects an installation. Copy engine content without its worlds, credentials, or unrelated packs. Record download provenance and hashes. ([Official BDS distribution](https://www.minecraft.net/en-us/download/server/bedrock))
- Produce fresh engine-authored world metadata and configure generation before target chunks are created. For flat worlds, write native flat-layer metadata; never simulate flat terrain by filling a finite region.
- Package portable launchers and all runtime assets. Launching the generated server must not require the repository, source files, or Node.
- Reuse stable executable registration and explicit firewall setup. Tests use `Package/Bedform/dist/bds-runtime/bedrock_server.exe`; ordinary creation, launching, and tests never elevate.
- Apply the saved demonstration plan's ignore-file precedence: existing add-on `.gitignore`, otherwise existing repository-root `.gitignore`, otherwise create one in the add-on root. Apply only inside Git and for output under the add-on's `Demonstration` directory; preserve formatting and avoid duplicate rules.

**Development boundary and saved data**

The independent production boundary is implemented by child `MineCraft-s80.4.1`
using the real shared bundle graph, generated Development settings, and explicit
build flags. It does not complete parent `.4`: Prototype generation defaults and
paths, pack selection, selected-engine waypoint qualification, and downstream
automatic tool/startup injection remain separate unfinished acceptance work.

- Add `Development.AllowDevelopmentModulesInProduction`, defaulting to `false`, and the boolean build flag `--allow-development-modules-in-production[=true|false]`.
- Introduce explicit development build selection through `--development`; ordinary builds remain production builds. Prototype create/update always request development builds.
- Reject reachable runtime imports of Prototype modules during production builds unless explicitly allowed. Erased type-only imports are permitted.
- Include `Prototype.Entry`, automatic tools, textures, runtime wiring, and debug dependencies only in prototype builds. Production opt-in permits module use without automatically injecting these assets.
- Keep host-only imports outside Bedrock bundles. Resolve beta debug dependencies and required experiments against the selected engine, failing clearly for unsupported combinations.
- Store configuration, mode, generated demonstration-color assignments, named-reference descriptors, completion history, generated-structure provenance, and placement/recovery journals in versioned world dynamic properties keyed by stable demo IDs. Store block coordinates/dimensions and entity IDs, never native object handles. Keep native block snapshots in world structure storage rather than serializing block-entity contents into dynamic properties.
- Preserve settings across declaration reordering and renaming. Added requirements become incomplete; removed definitions remain archived and inactive. Use revision checks to reject stale concurrent edits.
- Regenerate configuration declarations and JSON Schema from the existing schema source.

## Acceptance Criteria

- **Types:** branding, reference inference, `never` excluding `Data`, required data for other types, callback contexts, constructor inference, and packed subpath exports.
- **Lifetime:** concurrent starts, dependency predicates, static demos, cancellation, cleanup failures, getter failures, restart history, and transitions into world-wide editing.
- **Selection/UI:** all block faces, negative coordinates, diagonal air clearance, inclusive AABBs, invalid/unloaded targets, occlusion, tool-event deduplication, cancellation, inventory recovery, status updates, and concurrent editors.
- **Generated structures and options:** verify all three interior presets, bordered dimensions/corners and four cardinal orientations, default and increased interior heights, main roof on/off, the `F+H+1` ceiling offset and bottom-half slab underside, the unchanged centered 3×2 opening, and continuous three-lane passage. Verify six independently persisted material choices with translated in-game dropdown names, stable ID/index mapping, per-part catalogs and rejection of invalid/missing choices. Exercise every listed block option in its allowed role, including connected pane walls and slabs. Check the always-present entrance roof and side panes, consistent head-level sign/read space, no overlap between separately selected roof materials, enlarged vertical bounds, and unobstructed arrival. Test saved versus cancelled drafts, disabled main-roof material retention, stale preview invalidation, height/build limits, complete above-floor footprint clearance, bounded jobs, block-entity-preserving rollback/restart recovery and preservation across updates. Retain word/newline/grapheme and rendered-width sign checks, title overflow refusal and final-only description ellipsis. Use native BDS results for actual geometry/permutations and real-client evidence for localized labels, interior headroom, passage, restrained entrance styling and sign readability.
- **Build/CLI:** JSON/TS equivalence, override precedence, production restrictions, fresh normal/flat worlds, every `--with` input kind, portable launchers, ignore-file precedence, stopped-server checks, backups, and failed-update recovery.
- **Native BDS:** actual triggers, entity-reference persistence across restart, home/arrival behavior, inventory mapping, configuration changes after update, and clean startup with supplied resource packs.
- **Real client:** verify matching locator-bar/DDUI colors, visible waypoints before Finish editing, readable/distinct/subdued generated colors, location/color updates and multiplayer/dimension/restart behavior; also verify DDUI icons/tooltips, private debug drawings, selection with mouse/controller/touch, navigation, action-bar readability, and two-player editing/live transitions. Report client acceptance separately from automated results.
- Run bedform's required quality gates and packed-consumer checks. Track implementation and unresolved acceptance work in Beads; do not close work without its evidence.

## Beads implementation tracking

Epic **`MineCraft-s80`** contains this specification. The entries below are open implementation and validation work; saving the plan and creating the entries does not complete them. Beads is authoritative for current status and dependencies.

| Entry | Work | Prerequisites |
| --- | --- | --- |
| `MineCraft-s80.1` | Demonstration, state, reference, world, and structure export contracts | None |
| `MineCraft-s80.2` | Versioned configuration, stable generated colors, bindings, history, structure options and recovery records | `.1`, `.17` |
| `MineCraft-s80.3` | Shared run lifecycle, cancellation, readiness, and history | `.1`, `.2` |
| `MineCraft-s80.4` | Configuration schema, build flags, and development-module restrictions | `MineCraft-5jg.1/.2/.3`, `MineCraft-5sn.5` |
| `MineCraft-s80.5` | Generated tools/assets, material support and dedicated entrypoint wiring | `.1`, `.4`, `.17`, `MineCraft-5jg.3.1` |
| `MineCraft-s80.6` | Bounds, reference, trigger, and structure-center selection with recovery | `.1`, `.2`, `.5`, `.15` |
| `MineCraft-s80.7` | Live/editor controller, inventories, home, triggers, HUD, locator-bar waypoints in both modes, and placement-busy gating | `.1`, `.2`, `.3`, `.5` |
| `MineCraft-s80.8` | Imperative observable DDUI editor, navigator, and dedicated structure-options screen | `.1`, `.2`, `.3`, `.6`, `.7`, `.16`, `.17`, `MineCraft-l89.3/.4`, `MineCraft-5jg.3.1` |
| `MineCraft-s80.9` | Official BDS provisioning and fresh native normal/flat worlds | `.4`, `MineCraft-5sn.1` |
| `MineCraft-s80.10` | Create command, companion packs, portable launchers, and ignore/firewall integration | `.4`, `.5`, `.9`, `MineCraft-5sn.4/.5` |
| `MineCraft-s80.11` | List/ls, query, transactional update, and safe removal | `.10` |
| `MineCraft-s80.12` | Automated and packed-consumer validation, examples, and documentation | `.7`, `.8`, `.10`, `.11` |
| `MineCraft-s80.13` | Native fixed-path BDS and real stop/restart validation | `.12` |
| `MineCraft-s80.14` | Real-client visual/input and two-player acceptance | `.13` |
| `MineCraft-s80.15` | Parameterized structure layout, variable height/roofs, covered entrance, and sign wrapping | `.1`, `.17` |
| `MineCraft-s80.16` | Selected-material structure placement, ceilings/panes, clearance, rollback, and bounds/arrival setup | `.2`, `.3`, `.6`, `.7`, `.15` |
| `MineCraft-s80.17` | Structure-option validation, per-part material catalogs, and localized dropdown data | `.1` |

Unqualified `.n` entries refer to children of `MineCraft-s80`. Dependency edges target the existing build/configuration/DDUI milestones rather than blocking independent contract work on entire prerequisite epics. Automated, native BDS, and real-client acceptance remain separate gates.
