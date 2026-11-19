# Bedform imperative DDUI, shared configuration and initialization

## Organization and delivery boundary

The November 17, 2026 revision under `MineCraft-w82n.2` replaces this document's former functional DDUI/JSX design. Preserve imperative `bedform/DDUI`, CustomForm, Direction, Transactional, native observable controls and navigation. Remove DDUI elements, hooks, JSX runtimes and declarative-only diagnostics/configuration. React APIs, hooks and JSX runtimes belong to the single shared `bedform/Spatial/React` port in the [React plan](Bedform_React3D_Plan.md); Ink and Window reuse it. There is no separate React-style form renderer to implement.

The [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) separates canonical display/VM constructors and bare Display adapters. A display starts no React, Ink or VM. Optional `bedform/Spatial/Terminal/Ink` supplies terminal rendering over virtual streams; `bedform/VM` owns virtual computer services and shell behavior. `bedform/Spatial/Window` owns an independent runtime React root/store/events lifecycle, with consumer persistence snapshots rather than automatically restored applications. The dedicated [Ink/Window specification](Bedform_Terminal_Ink_Window_Plan.md) is recorded by `MineCraft-w82n.3`; the separate [VM specification](Bedform_VM_Plan.md) is recorded by `.4`.

This is a specification revision, not source removal, completed forms, native API qualification or client acceptance. Existing source/config may still expose the old layer until `MineCraft-9rdk.12` implements the migration. Keep ordinary builds on qualified release-compatible native APIs; new native controls require their own availability/qualification gate. This revision does not assert that historical package versions remain current.

## Issue ownership and migration mapping

| Existing tracking | Revised responsibility |
| --- | --- |
| `MineCraft-5jg/.1-.4` and `.3.1` (closed foundations) | Reuse schema/types, JSON/TS config loading, override resolution, script-only add-on compilation and Physics integration. Preserve closed history. Future migration removes obsolete DDUI-specific settings through schema/generator sources. |
| `MineCraft-l89/.1/.2` | Supersede the separate elements/JSX/hooks design; shared React belongs to `ty2k.1-.4`, not a new form hook runtime. |
| `MineCraft-l89.3/.4/.6` | Map useful native observable, MessageBox and Checklist behavior to retained imperative APIs or explicit replacement deliverables before supersession; do not implement their old JSX wrappers. |
| `MineCraft-l89.5`, `MineCraft-ty2k.7`, `MineCraft-9rdk.12` | Coordinate generic TSX discovery/bundling with Spatial React paths and remove DDUI JSX exports/defaults. Preserve supported per-file overrides and unrelated JSX engines. |
| `MineCraft-fh9/.1/.2` | Retire declarative render-tree strict banners and diagnostics. Retain applicable imperative validation/error reporting under explicit ownership, without a DDUI hook scheduler. |
| `MineCraft-073/.1-.5` | Preserve initializer behavior below; migrate examples/config and stale functional-DDUI prerequisites to surviving imperative/build or optional Spatial React deliverables. |
| `MineCraft-10s/.1-.3` | Retarget independent packed-consumer, native/client and authoring checks to imperative DDUI and the removal/migration boundary. |
| `MineCraft-yse/.1-.3` | Reconcile deferred native MultiButtonRow, third MessageBox button and navigation requests to imperative wrappers, gated by qualified native availability. Spatial Tabs remains a separate React component. |
| `MineCraft-fwox/.1-.7` and `MineCraft-53dn` | Retain imperative navigation/resource cleanup and Transactional behavior, including Common-owned icons. Preserve closed Transactional implementation history and outstanding `.6` client acceptance. |
| `MineCraft-s80.5/.8/.12-.14` | Prototype tools/editor/navigation use imperative DDUI and native observables, not functional-DDUI hooks or JSX. Retarget their UI/build prerequisites to concrete surviving deliverables. |

The audit mapping is in `MineCraft-w82n.1`. This table describes the document contract; `w82n.5` records the applied changes to nonclosed issues and embedded specifications, `.6` creates future Ink/Window/VM epics and `.7` wires exact dependency edges. Old issue titles/edges are not proof of active JSX requirements. Do not reopen closed history or close implementation work on the strength of this plan.

## Imperative forms, controls and resource ownership

- Keep `bedform/DDUI` and its imperative subpaths available without React. Keep native UI imports and the Bedrock runtime separate from Node/CLI and upstream Effect tooling.
- Preserve CustomForm construction, native observables and callbacks, Direction's optional values, Transactional undo/redo/reset, and navigation through fresh owned forms. Native MessageBox retains the qualified native button/body and closed-result semantics; third-button support is a separately qualified feature.
- Respect construction-only versus observable-updatable native properties. Validate complete candidate data before writes; invalid updates preserve last valid values and handlers. Structural changes use a new form rather than pretending native displayed control trees can be reconciled arbitrarily.
- Keep per-player form/session ownership, serialized navigation, callback freshness and cleanup on close, disconnect, supersession or failure. Dispose subscriptions and pending work; retained disposed handles reject operations. Isolate errors to the affected form/player and report actionable diagnostics without retaining a declarative strict banner runtime.
- DDUI Direction/Transactional/navigation icons and localization stay in BedformCommon. Canvas owns terminal/spatial glyph pages, ordinary white particle textures, frame assets, canonical display/VM entities and shared persistence support. Reuse generators and stable pack references without duplicating assets between packs.
- VM text/password entry uses player-private imperative forms. Passwords must not enter terminal output, routed chat, logs, command history or Transactional undo history. Revalidate current session/controller on delayed callbacks; logout, disconnect, focus loss and disposal cancel pending entry. Ordinary DDUI text entry and explicitly routed chat both feed the common terminal input model, distinguishing insertion from submission; ordinary chat is not globally captured.

### Preserved Checklist requirements

The former `l89.6` component request contains useful imperative behavior to preserve when its implementation ownership is reconciled. This section is a behavior transfer, not an approved replacement JSX API or a completed control.

- A checklist comprises one or more explicitly registered toggle items with stable unique IDs and native label types. Validate missing/duplicate/unknown IDs and nonboolean values before any writes. Item IDs are scoped to the checklist. Keep the displayed item count/order/IDs fixed; structural changes create a fresh form.
- Support controlled proposals or internally managed initial defaults with a complete boolean snapshot. Missing entries mean false; do not accept competing authoritative/default values. Later default changes do not reset live state. Reads and snapshots expose committed values without allowing external mutation.
- Preserve handle behavior for `getValues`, `getValue`, `setValues`, `setValue`, `reset`, `selectAll` and `clearAll`. Replacement treats omitted IDs as false; reset restores the initial successfully established snapshot. Bind/release the handle through imperative form ownership instead of React refs/hooks; disposed handles reject operations.
- Notify changed items once in item order, followed by one aggregate snapshot; initialization and no-op writes are silent. Prevent observable feedback and stale callbacks. Controlled writes propose values without claiming uncommitted data is already displayed. Failed validation preserves existing values, handlers and resources.
- Preserve isolation between checklists/forms/players, writable-tick scheduling, atomic updates and cleanup. JSX child identity, intrinsics and DDUI hook/ref tests are retired; equivalent imperative data/handle/lifecycle tests remain required.

## Shared build and configuration

- Reuse the completed shared JSON/TS and script-only build foundations instead of waiting on the entire broader model-conversion/build epic. Extend script discovery for `.tsx` entries and imported TSX modules, infer conventional `main.tsx` alongside TypeScript candidates and fail on ambiguity.
- Use automatic JSX with `jsxImportSource: "bedform/Spatial/React"` for spatial React consumers. Keep typechecking, bundling, declaration output and both JSX runtimes aligned. Preserve explicit per-file overrides for other supported engines, including `@bedrock-core/ui`.
- Remove DDUI JSX runtimes/exports, declarative elements/hooks, DDUI JSX defaults, `DDUI.StrictMode`, its build replacement token and `--ddui-strict` behavior as part of the future source migration. Define explicit handling of legacy flags/configurations with actionable migration guidance rather than silently ignoring supplied settings. Update schema sources, generated declarations/JSON Schema, initializers, tests, docs and stale Distribution/archive outputs together. Document that this removal has not happened merely because the plan changed.
- Preserve generic effective-configuration resolution before staging/compilation. Explicit overrides of present settings log the path and configured/flag values early, including equal-value overrides. Keep independent development/production restrictions.
- Retain `bedform/Config`, with a constructor/type named `BedformConfig` and the exported unique-symbol brand `Symbol.for("~bedform/Config")`. Its non-enumerable brand and `$schema` are excluded from constructor input. Use upstream `effect/Schema` as the source of truth; generate documented public declarations/schema and check them against inferred types.
- Load `bedform.config.json` or `bedform.config.ts` from the add-on root, honor explicit `--config`, reject ambiguous discovery and use defaults when missing. Keep packaged CLI-only Jiti loading, Node resolution, local TS imports, `node:fs`/`node:path`, upstream Effect and `@effect/platform-node`, including top-level asynchronous initialization. Require a validated default-exported object.
- Preserve optional `Physics` registrations, config-relative paths, virtual `generated/physics/catalog/models.ts`, collision-safe staged overlays, atomic publication and the documented standalone physics legacy adapter/migration notice. No source model conversion or Prototype asset injection is implied by TSX support.
- Canvas image registration uses one `Canvas.Images` compiler and virtual `generated/canvas/images.ts` descriptors from the [Canvas/Intent plan](Bedform_IntentBubbles_Plan.md). Reuse it for React consumers and shared Canvas packaging without requiring all Intent features.
- Generate/package the JSON Schema and keep its published editor URL and generated configurations consistent through the existing publication workflow. This document-only task neither publishes a schema nor changes a remote gist. Preserve the future website URL as a documented migration target.

## Init workflow

Implement:

```text
bedform init [--config-format json|ts]
```

JSON is the default.

- Before prompts, installs, or writes, detect the enclosing Git repository and inspect its entire working tree, including staged and untracked files. If dirty, exit unsuccessfully without changes.
- Search upward for the nearest add-on root, recognizing package-based add-ons and packs containing valid `manifest.json` files. Running in an add-on subdirectory enhances that add-on.
- For manifest-only packs, prompt for missing metadata and create a normal `package.json` with name, display name, version, description, author, license, module type, dependencies, development dependencies, and scripts.
- Otherwise, prompt for a new add-on’s destination and metadata. Create behavior/resource packs with linked UUIDs, scripting entrypoint, TypeScript configuration, and a minimal working imperative DDUI example; a spatial TSX example uses `bedform/Spatial/React` only when that optional layer is selected. Refuse conflicting destination files.
- Install `bedform` and `effect-bedrock` as direct dependencies, plus required API typings and TypeScript tooling. Use npm’s workspace support where applicable and preserve existing metadata, manifests, scripts, and configuration.
- Add `build` and `typecheck` scripts where missing; never overwrite existing script definitions. Generate configuration in the selected format without introducing removed DDUI JSX/strict settings. Existing supported configuration keeps its format and settings; detect obsolete declarative settings and provide explicit migration guidance before changing them.
- Prompt separately for global Bedform installation and optional Blender/Mcblend, Blockbench, and Bedform Blender-extension setup. Reuse the existing setup implementations and confirmations. Declining any optional setup still permits successful init.
- Cancellation before modification leaves files unchanged. Installation/setup failures return nonzero, report completed changes, and skip committing.
- Inside a Git repository, commit successful init changes automatically using `Adds bedform to ${displayName}.` or `Creates bedform add-on ${displayName}.` Fall back from an empty `displayName` to package `name`.
- Stage only init-owned changes, including relevant lockfiles. Recheck for concurrent unrelated changes before committing; stop and report if found. Respect Git hooks and identity failures. Do not push.
- Outside Git, finish without creating a repository or commit. Repeated initialization is idempotent and creates no empty commit.

## Validation and delivery defaults

- **Imperative forms:** verify native control data/types, observable updates, MessageBox results, Direction, Transactional and navigation lifetimes. Exercise invalid updates without partial writes, callback freshness, per-player isolation, close/disconnect/supersession and disposed-handle rejection.
- **Checklist:** test defaults/controlled proposals, complete immutable snapshots, all handle operations, invalid/duplicate/unknown IDs and nonboolean data, replacement/reset/bulk semantics, no-op/initialization silence, notification order, feedback prevention, atomic failure and cleanup. Add independent imperative consumer examples and separate native/client interaction checks.
- **Removal and shared React:** packed consumers must retain imperative DDUI while obsolete DDUI JSX imports fail and deleted outputs cannot survive in archives. Compile spatial TSX against `bedform/Spatial/React` with both JSX runtimes, without a second form hook runtime; preserve unrelated JSX engines. Actual React hook compatibility belongs to the React plan.
- **Configuration and builds:** test JSON/TS equivalence, Node/Effect CLI imports, branding, schema/declaration agreement, discovery ambiguity, generic override messages, explicit legacy DDUI-setting migration, Physics compatibility, generated freshness and independently installed offline consumers.
- **Init:** test existing roots/subdirectories, manifest-only/new projects, both formats, workspace lockfiles, declined setup, installation failure, idempotence, dirty-tree refusal, concurrent changes and exact commit messages in disposable repositories. Examples must use imperative forms or the selected optional Spatial React layer.
- **Native and client:** use a fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe` through the add-on runner; ordinary tests do not elevate. Record native behavior separately from real-client form appearance, icon fidelity and multiplayer input. Source migration and these tests are future work, not evidence supplied by saving this plan.
- Preserve unrelated workspace edits and package versions. No live-world deployment, implementation commits, pushes or remote Dolt synchronization are included; automatic commits remain initializer behavior to implement/test in disposable repositories.

## Existing deliverable ownership after MineCraft-w82n.5

The existing nonclosed issues now use these sole implementation owners. These planning edits do not complete runtime work. The open Ink/Window/VM epics were created by w82n.6 and their exact child dependencies are wired by w82n.7.

| Deliverable | Existing owner | Consumers |
| --- | --- | --- |
| Custom glyph inventory, generators, dark gray font pages and white ordinary particle textures | `MineCraft-ty2k.9` | `9rdk.6`, `ty2k.28/.30`, Intent and future Ink |
| Native font metrics/presence | `MineCraft-ty2k.10` | Pure display and React text |
| Ordinary-font particle coverage for dark terminal parity | `MineCraft-9rdk.5` | Dark terminal backend; reuses custom catalogue |
| Non-glyph spatial artwork/proxies | `MineCraft-ty2k.6` | Imperative particle surfaces and widgets |
| Imperative particle surface/viewport primitives | `MineCraft-ty2k.8` | React host, glyph helpers, canonical frame and future Window |
| React-independent rounded frame assets/geometry, brightness, rear/extrusion | `MineCraft-9rdk.9` | Canonical displays, `ty2k.33`, future Window |
| Shared Canvas.Images compiler/descriptors | `MineCraft-zcmm.6` | Intent API/renderer and React build integration |
| General feature-based Canvas artifact bundling | `MineCraft-zcmm.7` | Display, spatial, Intent and future layers |
| Intent API/exports/docs and protocol client | `MineCraft-zcmm.2` | Intent feature consumers |
| Shared React/hooks/JSX API and bounded publication | `MineCraft-ty2k.2` | Widgets and future Ink/Window |
| Spatial React TSX/build/descriptor consumption | `MineCraft-ty2k.7` | Optional spatial TSX consumers |
| DDUI elements/hooks/JSX/strict-setting removal and migration | `MineCraft-9rdk.12` | Existing consumers and full widget qualification |
| Imperative native bindings / MessageBox / Checklist | `MineCraft-l89.3/.4/.6` | Forms, Prototype and integration |

`MineCraft-9rdk.13`, `MineCraft-l89.1/.2/.5` and the nine open `MineCraft-2k9d` children are closed as superseded, never as runtime-completed. Their preserved requirements map to the owners above and the saved Ink/Window/VM specifications. Closed historical parents and prior completed work remain unchanged.

## Wired runtime implementation order (MineCraft-w82n.7)

The 42 Ink/Window/VM child deliverables now have the exact blocking prerequisites listed in the [Ink/Window tables](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM table](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). The [coordinated branch order and topological waves](Bedform_Terminal_Canonical_Plan.md#coordinated-implementation-order-minecraft-w82n7) show parallel foundations and runtime integration. Parent epics use nonblocking see-also links, not whole-epic gates. No runtime work or acceptance is completed by dependency wiring.
