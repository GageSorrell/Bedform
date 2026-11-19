# Canonical spatial terminals and shared value types

## Summary

Replace the superseded terminal design with a persistent, shared in-world terminal exposed through `bedform/Spatial/Terminal`. Build it on a reusable, runtime-owned display renderer derived from the demo's three-layer custom-glyph overlay and high-resolution region implementation.

Preserve imperative DDUI APIs, remove DDUI's declarative JSX layer, and place spatial React APIs under `bedform/Spatial/React`. Update relevant plans and nonclosed Beads issues to match.

## Layer organization and construction

`bedform-canvas` owns shared terminal/spatial assets, canonical display and VM entities, and their shared runtime, identity, ownership and persistence support. Unrelated DDUI/control assets stay in BedformCommon. The construction boundary is:

| Surface | Responsibility | Optional layers |
| --- | --- | --- |
| `bedform/Spatial/Terminal` canonical display constructor | Create a persistent shared display with the appearance and restoration contract below | React, Ink and VM services are optional; display creation starts none of them |
| `bedform/Spatial/Terminal` canonical VM constructor | Explicitly compose a canonical machine identity, display and `bedform/VM` services | Starts only through the distinct VM construction path; shell presentation uses Ink |
| `bedform/Spatial/Terminal/Display` | Create and manage a bare display, with frames, regions, measurements, snapshots, input adapters and lifecycle | Consumer-owned persistence and custom entities/storage; independent of React, Ink and VM startup |
| `bedform/Spatial/React` | Shared React port, hooks and JSX runtimes | Reused by spatial widgets, Ink and Windows |
| `bedform/Spatial/Terminal/Ink` | Optional upstream Ink port adapted to display surfaces and virtual streams | Bedform additions live under `Ink/Components/*`, including reusable input, scrollback and shell presentation |
| `bedform/Spatial/Window` | Independent React root, Canvas frame, external store and typed events | Runtime-owned; snapshots allow consumer persistence; independent of Ink and VM |
| `bedform/VM` | Storage, FileSystem, Users, Permissions, Session, Process, Shell, Coreutils and IO | Bedrock-script virtual computer services; custom display/entity/storage adapters |

Constructor names and signatures must distinguish display-only creation from machine creation at both type and runtime boundaries. Imports remain inert. A bare display can be used without canonical entities; custom entity/display/storage adapters explicitly supply identity, ownership, persistence and disposal responsibilities instead of silently adopting canonical records. A custom presentation can connect to a VM without replacing its machine identity or merging accounts.

Ink adapts supported upstream component/hook names and semantics, layout, measurements, rendering, focus and input/output without Node processes, native TTYs or host filesystems. Pin source and licenses/provenance, document and test compatibility, and qualify the portable layout implementation. This optional port replaces the earlier blanket exclusion of Ink; it does not reinstate the superseded cursor-screen, fullwidth-normalization or Braille Pen framework.

The VM is a Bedrock-script virtual computer, not CPU emulation or a guest OS. Each canonical machine has persistent entity-associated identity, its own filesystem and independent per-machine accounts. Persist files, users, permissions, settings and appropriate session metadata; require login after restart and never persist entered passwords or resume commands automatically. Password verification uses versioned records and a vetted Bedrock-compatible implementation, with player-private imperative DDUI credential entry/change/authorized reset. Host-authorized owners bootstrap administration; VM administrator status, Minecraft operator status and independently host-granted world capabilities are distinct. Scoped block/entity/player IO and filesystem/account permissions remain enforced, with no unrestricted Minecraft command execution by default. The detailed [VM service, Bash-like shell and hybrid spatial-key/DDUI/routed-chat specification](Bedform_VM_Plan.md) is recorded by `MineCraft-w82n.4`; the dedicated [Ink/Window specification](Bedform_Terminal_Ink_Window_Plan.md) is recorded by `MineCraft-w82n.3`. These specifications are planning deliverables, not implementation evidence.

Windows use the same React implementation and React-independent canonical crafting/furnace frame geometry, with optional matching backface and rounded border extrusion. Each Window owns an isolated snapshot/subscription/update store and typed bidirectional events; React consumes the store with `useSyncExternalStore`. Keep focus, stores, events, errors and cleanup isolated. Default to private audiences, allow explicit sharing, and unmount/release resources and subscriptions on disposal; subsequent operations reject. Window snapshots support consumer persistence, without automatically restoring applications.

## Terminal rendering and public API

- Expose explicit runtime startup, terminal creation, lookup, updating and deletion. Imports remain inert. Creation identifies the owning add-on and terminal; duplicate identities fail rather than replace existing terminals.
- Expose `bedform/Spatial/Terminal/Display` independently of React and canonical persistence. Its API creates, replaces and updates mixed text/custom-glyph frames and region layers, changes presentation settings, returns snapshots and bounds, and disposes all owned rendering resources.
- Port the demo's measurement, normalization, seamless A/B glyph layers, front text layer and six high-resolution region families. Preserve its measured alignment rules and UTF-8 limits. Expose this display core to the optional Ink port without rebuilding the superseded terminal framework.
- Use one serializable frame representation for both backends and persistence. Region predicates may be accepted by drawing utilities, but their sampled bitmaps—not executable functions—enter stored frames.
- Expose applicable whole-display settings: cell dimensions, line spacing, layer depth separation, overlay alignment offsets, pixel calibration and text defaults. Regions retain their own bounds, resolution multiplier, family and placement options.
- Share React-independent frame geometry and Canvas assets with the planned crafting/furnace-style `FramedPanel` and Window. The canonical terminal uses its rounded gray frame without tabs or the titled/translucent-body variant. Deliver its frame without waiting for the React component or the spatial widget catalogue. The imperative terminal must work without starting React.

### Appearance and geometry

- `themeMode` accepts only `ThemeMode.Resolved`; default light. Light mode uses the three-layer TextPrimitive renderer. Dark mode renders all text, custom glyphs and regions using particles, with a dark background and light foreground. Both modes support the same packaged repertoire and layout.
- Warn when creating a dark-mode terminal or switching into dark mode: TextPrimitives cannot be used for this mode, so performance may degrade. Do not repeat the warning every tick.
- `brightness` accepts `LightLevel`, default 15. Normalize it to a valid level for rendering; black-overlay opacity is `1 − level / 15`. At full brightness omit the overlay. Place the overlay ahead of the complete front presentation, including attached regions, and mask it to the terminal silhouette.
- Keep Canvas font ink and default TextPrimitive text at `#4D4D4D`. Generate white particle atlases with arbitrary tint support; omitted glyph tint remains `#4D4D4D`. Package ordinary-font particle glyphs needed for dark-mode parity.
- `backfaceVisible` defaults true. Render the matching rear frame with both texture axes flipped and correctly oriented face visibility.
- `thickness` is a finite, nonnegative number in centimeters, default zero. When the backface is enabled, positive thickness offsets it behind the front and adds solid-color side strips following the rounded frame contour. Close corners and seams; omit rear and extrusion rendering when the backface is disabled.

### Sizing and collision

- Accept exactly one cell dimension—width or height—in blocks; derive the other from the renderer's cell aspect ratio.
- Accept either rows plus columns, total content width plus rows, or total content height plus columns. Floor inferred counts to whole cells and reject results below one cell. Frame and padding extend outside the content dimensions.
- Collision defaults on and is runtime-toggleable. It physically blocks players and mobs and covers the frame, layer stack and enabled extrusion.
- With collision enabled, allow yaw only; reject pitch or roll. Disabling collision permits unrestricted display orientation.
- Begin collision implementation with a fixed-path native fixture proving actor blocking, supported sizing and toggling. Account for native collision boxes' single horizontal width; qualify any required helper composition and its enclosing bounds. Do not silently substitute ray targeting for physical collision or claim unsupported thin-box behavior.
- Validate changes before replacing the current presentation. Capacity or geometry failures leave the previous valid terminal intact.

## Persistence and value types

### Canonical terminal ownership

- BedformCanvas owns the shared canonical runtime, canonical display/VM entities and persistent terminal records. Save versioned identity, owner, dimension, pose, resolved dimensions, presentation settings and content. Canonical machines reuse this identity/ownership/restoration support; VM services own their files, accounts and permissions rather than embedding executable commands in display frames.
- Restore loaded terminals after startup and chunk reload without requiring their creating add-on to replay creation calls. Rendering resources remain transient and are rebuilt from saved state.
- Persist successful updates before acknowledging them. Fence duplicate restoration and stale callbacks with revisions; enforce owner identity for mutation and deletion.
- Preserve malformed or unknown-version records and report actionable errors rather than overwriting them. Provide explicit migration handling and durable deletion markers.
- Bare displays remain transient. Expose snapshots, reconstruction inputs and lifecycle hooks so consumers can implement independent storage and migration policies.
- Restoring a canonical display rebuilds its presentation; it does not implicitly create a VM. Restoring a canonical machine restores durable data and presentation, requires fresh authentication, and leaves commands stopped. Runtime-owned Windows are outside canonical application restoration.

### `bedform/LightLevel`

- Export `TypeId: unique symbol = Symbol.for("bedform/LightLevel")`. The public immutable interface exposes the brand and Effect protocols; the implementation stores `readonly value: number` outside that public interface.
- Provide `Make`, `ToNumber`, `ToValid`, `ToOption` and `ToPercentage`. Preserve any numeric input, including fractions, out-of-range values, NaN and infinities.
- `ToValid` rounds to the nearest integer and clamps to 0–15; NaN becomes zero and infinities become their respective endpoints. `ToOption` succeeds only for integers already within 0–15. `ToPercentage` returns the raw value divided by 15.
- Provide `Clamp`, `Add`, `Subtract`, `Lerp` and `Complement`, where complement is `15 − value`. Unclamped arithmetic preserves raw numeric results. `Clamped` counterparts normalize results to valid integer levels; its percentage accessor clamps to `[0,1]`.
- Implement `Equal`, `Hash`, `Inspectable` and `Pipeable`, and export `Equivalence` and `Order`. Use consistent NaN and signed-zero equality/hashing; place NaN after all other values in the total order. Tagged JSON preserves nonfinite values.
- `IsLightLevel` uses `Predicate.hasProperty(value, TypeId)` as requested.

### `bedform/Spatial/ThemeMode` and `bedform/Dimension`

- ThemeMode uses `Symbol.for("bedform/Spatial/ThemeMode")`, immutable branded light/dark/inherit values, and the same applicable Effect protocols. Export constants, guards, literal conversion, matching and ordering utilities.
- Merge a `ThemeMode` namespace containing `Resolved` and its corresponding utilities. `Resolve(mode, inherited)` returns light or dark; terminals reject inherit at both type and runtime boundaries.
- Re-export native `@minecraft/server` exports from `bedform/Dimension`, retaining native `Dimension` identity. Add `getLightLevel(dimension, location)` and `getSkyLightLevel(dimension, location)` wrappers returning LightLevel. Preserve native exceptions and receiver behavior; do not patch native prototypes.

## Migration and tracking

- Remove DDUI elements, hooks, JSX runtimes and declarative-only diagnostics/configuration. Preserve imperative CustomForm, Direction, Transactional and navigation APIs and migrate affected repository consumers.
- Publish spatial React APIs and automatic JSX runtimes under `bedform/Spatial/React`. Retarget spatial configuration, initializer output, tests, examples and planned exports. Preserve unrelated JSX users such as `@bedrock-core/ui`.
- Remove obsolete published outputs during builds so deleted DDUI modules cannot survive in npm archives.
- Save the replacement terminal plan and create implementation tracking before coding. The nine formerly open `2k9d` children are superseded in `w82n.5`, with requirements transferred and `ty2k.27` retargeted to canonical Display/shared React.
- Reconcile applicable nonclosed React, Canvas, theme, glyph, DDUI and qualification issues. Preserve closed issue history and mark superseded plan documents clearly.
- Follow repository TSDoc, generated-header, nested-type and centralized identifier rules. Preserve unrelated edits; no deployment, commits, pushes or remote Dolt synchronization.

## Validation

- Unit and type tests cover LightLevel arithmetic/conversions/nonfinite values, protocol laws, ThemeMode resolution and exclusion of inherit, and Dimension wrapper parity.
- Renderer tests compare actual generated glyph assets and layer placement, region families, sizing, byte limits, arbitrary tint, dark/light parity, brightness endpoints, backface UVs and closed extrusion geometry.
- Persistence tests cover restart, unload/reload, ownership, duplicate restoration, failed writes, deletion and incompatible records.
- Packed-consumer tests verify exports, Canvas dependency inclusion, inert imports, removal of DDUI JSX and preservation of imperative DDUI.
- Test distinct display/VM construction and custom adapters: display-only paths do not start React, Ink or VM services; adapter ownership and disposal remain explicit. Reuse shared frame and asset fixtures across displays, React panels and Windows. Ink, Window and VM implementations retain their own compatibility, store/event/disposal, service/security, native and real-client acceptance gates.
- Fixed-path BDS tests exercise real collision and toggling, native light reads, particle calls, lifecycle and two-process restoration.
- Separate real-client acceptance verifies three-layer alignment, dark-mode readability/performance, brightness blending, rounded frame seams, rear/extrusion appearance and shared multiplayer visibility. Native tests alone do not establish appearance.

## Delivery status and Beads tracking

Agreed specification saved November 17, 2026. Epic: `MineCraft-9rdk`.

The November 17 organization revision is the document deliverable of `MineCraft-w82n.2`, following the audit in `MineCraft-w82n.1`. It does not implement APIs or establish native/client acceptance. Existing `MineCraft-2k9d` is already closed as superseded; preserve closed history. `MineCraft-w82n.5` reconciles nonclosed issues (including the overlapping `9rdk.13` planning task), `.6` creates future Ink/Window/VM implementation epics, and `.7` wires deliverable-level dependencies. `.3` and `.4` own the dedicated Ink/Window and VM specifications respectively. These planning tasks remain separate from runtime implementation.

The following table inventories existing implementation tracking and current Beads edges, reconciled by MineCraft-w82n.5; new Ink/Window/VM child-level edges are wired by w82n.7. Reuse Canvas scaffold `zcmm.1`, shared glyph generation/metrics `ty2k.9/.10` with `9rdk.5`, pure frame/display `9rdk.6/.7`, shared frame `9rdk.9`, and canonical ownership `9rdk.10`. Extract general Canvas packaging from `zcmm.7` and a bounded shared React milestone from `ty2k.1-.4/.16`; neither bare nor canonical displays wait for all Intent features, the whole widget catalogue or VM. Ink and Window follow only their shared foundations; the VM shell follows Ink and VM services. Keep independent deliverables acyclic. Updating the epic's embedded specification and exact edges belongs to `w82n.5/.7`.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-9rdk.1` | Implement immutable LightLevel values, conversions and arithmetic | None |
| `MineCraft-9rdk.2` | Implement ThemeMode and its resolved-only namespace utilities | None |
| `MineCraft-9rdk.3` | Add Dimension light getters returning LightLevel | `MineCraft-9rdk.1` |
| `MineCraft-9rdk.4` | Prove terminal physical collision, sizing and runtime toggling in BDS | None |
| `MineCraft-9rdk.5` | Generate ordinary-font terminal particle glyphs from the shared Canvas catalogue | `MineCraft-zcmm.1`; `MineCraft-ty2k.9`; `MineCraft-ty2k.10` |
| `MineCraft-9rdk.6` | Port the pure three-layer frame and high-resolution region renderer | `MineCraft-ty2k.9`; `MineCraft-ty2k.10` |
| `MineCraft-9rdk.7` | Expose runtime-owned Terminal Display and light-mode presentation | `MineCraft-9rdk.6` |
| `MineCraft-9rdk.8` | Implement particle-only dark terminal presentation and theme switching | `MineCraft-9rdk.7`; `MineCraft-9rdk.5`; `MineCraft-9rdk.2` |
| `MineCraft-9rdk.9` | Implement terminal frame, brightness, backface and rounded extrusion | `MineCraft-9rdk.1`; `MineCraft-9rdk.7`; `MineCraft-ty2k.8` |
| `MineCraft-9rdk.10` | Implement Canvas terminal persistence, ownership and restoration | `MineCraft-zcmm.1`; `MineCraft-9rdk.6` |
| `MineCraft-9rdk.11` | Publish the persistent canonical display constructor and runtime integration | `MineCraft-9rdk.2`; `MineCraft-9rdk.4`; `MineCraft-9rdk.8`; `MineCraft-9rdk.10`; `MineCraft-9rdk.7`; `MineCraft-9rdk.9` |
| `MineCraft-9rdk.12` | Remove DDUI JSX and relocate spatial React APIs and build configuration | `MineCraft-ty2k.7` |
| `MineCraft-9rdk.13` | Superseded planning overlap; replaced by MineCraft-w82n.1-.8 | None |
| `MineCraft-9rdk.14` | Qualify terminal exports, Canvas bundling and offline packed consumers | `MineCraft-9rdk.3`; `MineCraft-9rdk.11`; `MineCraft-zcmm.7` |
| `MineCraft-9rdk.15` | Qualify canonical terminals in native BDS including two-process restoration | `MineCraft-9rdk.14` |
| `MineCraft-9rdk.16` | Accept canonical terminal appearance and shared behavior on real clients | `MineCraft-9rdk.15` |


## Future runtime epics recorded by MineCraft-w82n.6

Created November 18, 2026 by `MineCraft-w82n.6`: three separate top-level future runtime epics, 42 implementation/packaging/native/client children, all open. These are separate from the planning-only w82n parent. Hierarchy and the listed child-level blocking prerequisites are recorded. `MineCraft-w82n.7` wires these edges and publishes coordinated ordering; `.8` owns final coverage/parity validation. Creation is not implementation, native feasibility or real-client acceptance.

| Runtime epic | Responsibility | Children |
| --- | --- | --- |
| `MineCraft-3w2z` | Own optional upstream Ink adaptation, qualified portable layout, Display host, renderer-facing virtual IO/input/focus, supported components/hooks and Input/Scrollback/view-only Shell. Reuse shared React and existing Canvas/display assets. VM owns actual accounts/process/parser/services and real Shell binding. Standalone Ink does not wait for VM or Window. | 12 open |
| `MineCraft-glcb` | Own independent roots/handles, shared-frame binding, external stores/useSyncExternalStore, typed directional events, audience/focus/error isolation and disposal/explicit consumer reconstruction. Reuse shared React/Canvas geometry; no Ink/VM or automatic persistence requirement. | 10 open |
| `MineCraft-q4r0` | Own VM service contracts, per-machine durable data/accounts/permissions, qualified credential handling, scoped world IO, processes/streams/parser/coreutils, authenticated input/session binding, actual hybrid keyboard/text adapters, Ink shell integration and canonical VM constructor/restoration. Shared display/React/Ink components and Canvas identity/frames remain with their existing owners. | 20 open |

The complete actual child-ID tables and wired prerequisite mappings are in [Ink/Window tracking](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM tracking](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). Existing foundations retain the implementation owners assigned by w82n.5; the `.6` creation step delivered no runtime code or blocking edges; `.7` now records child-level blockers and ordering.

## Coordinated implementation order (MineCraft-w82n.7)

The child-level blocking edges and tables below are wired in Beads as of November 18, 2026. Parent epics are cross-referenced with nonblocking `relates_to` links; they are not prerequisites. Hierarchy, a see-also link and a blocking dependency have distinct meanings. All runtime/native/client work remains open; this is a graph/document planning delivery.

| Delivery branch | Order and independent work |
| --- | --- |
| Existing foundations | Canvas scaffold `zcmm.1`, values `9rdk.1/.2/.3`, custom glyph inventory/metrics `ty2k.9/.10`, pure frames/Display `9rdk.6/.7`, ordinary particle expansion `9rdk.5`, particle-only dark mode `9rdk.8`, shared frame `9rdk.9`, canonical ownership/display `9rdk.10/.11` and independent Canvas bundling `zcmm.7` retain their sole owners. Display delivery does not wait for new VM, Ink, Window or the full spatial widget catalogue. |
| Early parallel investigations/contracts | Ink source pinning `3w2z.1`, pure Window store `glcb.3` and pure VM contracts `q4r0.1` have no blockers. Portable layout feasibility `3w2z.2` waits only for source pinning. These do not claim implemented React/native identity behavior; runtime integration has the required downstream gates. |
| Shared React and host integration | Existing `ty2k.1/.2/.3/.4` supply the single port/API/compatibility/root contract; `ty2k.7` supplies TSX build integration. Bare particle helpers `ty2k.8` remain independent of full widget artwork. Ink host `3w2z.3` waits for source/layout, Display/metrics and shared roots; Window root `glcb.1` waits for shared React and its pure store. |
| Independent Ink and Window deliveries | Ink stream/focus adapters, Input/Scrollback/upstream compatibility/view-only Shell precede its packaging, native and separate real-client gates. Window frame/store bridge/events/audience/lifetime work precedes its packaging/native/two-client gates. Neither new branch waits for the other or for VM services. |
| Independent VM services | From pure contracts, implement durable storage, permissions, filesystem, qualified password feasibility/Users, sessions and bounded process/pipeline streams, then scoped game IO, shell/parser/coreutils and account commands on their actual child prerequisites. Shared Canvas native identity is required for final canonical integration, not for initial service contracts. |
| Integrated VM shell and hybrid input | Authenticated input binding `q4r0.13` consumes common input `3w2z.5`; spatial keys `q4r0.14` and BOTH DDUI/chat sources `q4r0.15` follow. Actual service-to-Ink shell binding `q4r0.16` requires parser/utilities/accounts/input and qualified Ink package/view-only Shell, not a whole Ink epic. Canonical VM integration `q4r0.17` additionally requires existing canonical ownership/display and scoped IO. |
| Per-feature qualification | Each family retains host/type/offline package gates before actual fixed-path native and distinct real-client acceptance. VM native/restart `q4r0.19` consumes its package gate plus qualified Ink native; VM client `q4r0.20` consumes actual VM native and Ink client behavior. No prior demo or planning result closes these gates. |

Branches can progress in parallel once their concrete prerequisites are complete. The following waves are a valid topology of all open transitive prerequisites of the 42 new runtime children, not a requirement to serialize independent siblings or unrelated repository work. Closed prerequisites retain their existing evidence/history.

| Wave | Open deliverables permitted after earlier waves |
| --- | --- |
| 1 | `MineCraft-3w2z.1`, `MineCraft-9rdk.1`, `MineCraft-9rdk.2`, `MineCraft-9rdk.4`, `MineCraft-fwox.1`, `MineCraft-glcb.3`, `MineCraft-q4r0.1`, `MineCraft-ty2k.1`, `MineCraft-ty2k.10`, `MineCraft-zcmm.1` |
| 2 | `MineCraft-3w2z.2`, `MineCraft-3w2z.4`, `MineCraft-9rdk.3`, `MineCraft-fwox.2`, `MineCraft-l89.3`, `MineCraft-q4r0.2`, `MineCraft-q4r0.4`, `MineCraft-ty2k.2`, `MineCraft-ty2k.6`, `MineCraft-ty2k.8`, `MineCraft-ty2k.9`, `MineCraft-zcmm.6`, `MineCraft-zcmm.7` |
| 3 | `MineCraft-9rdk.5`, `MineCraft-9rdk.6`, `MineCraft-fwox.3`, `MineCraft-q4r0.3`, `MineCraft-q4r0.5`, `MineCraft-q4r0.8`, `MineCraft-ty2k.3`, `MineCraft-ty2k.4`, `MineCraft-ty2k.7` |
| 4 | `MineCraft-9rdk.10`, `MineCraft-9rdk.7`, `MineCraft-glcb.1`, `MineCraft-glcb.4`, `MineCraft-q4r0.6`, `MineCraft-ty2k.5` |
| 5 | `MineCraft-3w2z.3`, `MineCraft-3w2z.5`, `MineCraft-9rdk.8`, `MineCraft-9rdk.9`, `MineCraft-glcb.5`, `MineCraft-q4r0.7`, `MineCraft-ty2k.13` |
| 6 | `MineCraft-3w2z.6`, `MineCraft-3w2z.7`, `MineCraft-3w2z.8`, `MineCraft-9rdk.11`, `MineCraft-glcb.2`, `MineCraft-q4r0.10`, `MineCraft-q4r0.13`, `MineCraft-q4r0.9`, `MineCraft-ty2k.14` |
| 7 | `MineCraft-3w2z.12`, `MineCraft-9rdk.14`, `MineCraft-q4r0.11`, `MineCraft-q4r0.12`, `MineCraft-q4r0.15`, `MineCraft-ty2k.15` |
| 8 | `MineCraft-3w2z.9`, `MineCraft-glcb.6`, `MineCraft-q4r0.14` |
| 9 | `MineCraft-3w2z.10`, `MineCraft-glcb.7`, `MineCraft-q4r0.16` |
| 10 | `MineCraft-3w2z.11`, `MineCraft-glcb.8`, `MineCraft-q4r0.17` |
| 11 | `MineCraft-glcb.9`, `MineCraft-q4r0.18` |
| 12 | `MineCraft-glcb.10`, `MineCraft-q4r0.19` |
| 13 | `MineCraft-q4r0.20` |

No reciprocal feature-epic blockers, retired-emulator/DDUI JSX prerequisites or full-catalogue `ty2k.16-.18` gates are introduced. Exact child prerequisite tables remain the authoritative edge list; topological waves are a useful implementation schedule. `MineCraft-w82n.8` owns final parent requirement/issue/document parity review.
