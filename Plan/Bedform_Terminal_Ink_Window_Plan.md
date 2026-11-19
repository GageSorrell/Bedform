# Bedform Ink port and independent spatial Windows

## Purpose and delivery boundary

Port Ink to `bedform/Spatial/Terminal/Ink` as an optional React renderer for terminal display surfaces and virtual streams. Add `bedform/Spatial/Window` for independent, framed spatial React applications with externally managed state and typed events.

This document is the planning deliverable of `MineCraft-w82n.3`, dated November 17, 2026, under organization epic `MineCraft-w82n`. The reconciliation audit is in `MineCraft-w82n.1`; `.2` updated the related plans. Saving this specification does not implement APIs, vendor dependencies, qualify a layout engine, create runtime assets or establish native/client acceptance. Follow-on implementation tracking belongs to `.6`, after nonclosed issue reconciliation in `.5`; exact prerequisite wiring belongs to `.7` and final coverage verification to `.8`. Future implementation and qualification issues remain open until their own evidence exists.

The [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) owns display appearance, dimensions, collision, brightness, themes and persistence. The [React plan](Bedform_React3D_Plan.md) owns the single React port/hooks/JSX implementation. The [Canvas/Intent plan](Bedform_IntentBubbles_Plan.md) owns shared Canvas packaging/assets; the [imperative DDUI plan](Bedform_DDUI_TSX_Config_Init_MultiPart_Plan.md) preserves forms while retiring DDUI JSX. The separate [VM service, accounts, shell and hybrid keyboard specification](Bedform_VM_Plan.md) is recorded by `MineCraft-w82n.4`.

## Modules, ownership and independent construction

| Module or owner | Public responsibility | Independence |
| --- | --- | --- |
| `bedform/Spatial/Terminal` | Distinct canonical display and canonical VM constructors | Display-only creation starts no React, Ink or VM |
| `bedform/Spatial/Terminal/Display` | Frame updates, regions, measurement, snapshots, input adapters and display lifecycle | Bare/custom displays work without React, Ink or canonical machine persistence |
| `bedform/Spatial/React` | Shared React APIs, hooks and both automatic JSX runtimes | One implementation reused by widgets, Ink and Window |
| `bedform/Spatial/Terminal/Ink` | Supported upstream Ink components/hooks, terminal root and host adapters | Optional layer over Display; no VM required |
| `bedform/Spatial/Terminal/Ink/Components/*` | Bedform-provided input, scrollback and shell presentation | Supplements the port without renaming upstream APIs |
| `bedform/Spatial/Window` | Independent spatial React root, external store, events, framing and lifecycle | No dependency on Ink or VM services |
| `bedform/VM` | Storage, FileSystem, Users, Permissions, Session, Process, Shell, Coreutils and IO | Owns virtual computer behavior; shell presentation consumes Ink |
| `bedform-canvas` | Shared spatial/terminal assets, canonical display/VM entities, identity, ownership and persistence/runtime support | Common retains unrelated imperative DDUI/control assets |

All imports are inert. Explicit runtime/start/create operations receive the qualified host dependencies and create resources only when requested. Custom display/entity/storage adapters declare which resources they borrow and which they own; attaching Ink does not adopt a custom entity into canonical persistence or merge machine identities. Disposing an attached renderer releases its own subscriptions and presentation resources; it does not delete a borrowed display, machine or caller-owned stream. Explicitly owned child resources are disposed with their owner. Prevent competing renderers from silently overwriting the same display surface; attachment ownership and transfer must be explicit and tested.

Ink and Window share React and lower-level Canvas/frame machinery, but use their respective terminal and spatial host contracts. A terminal component is not an independent Window, and Window construction does not implicitly attach Ink. Application components can compose the supported layers explicitly.

## Ink source, provenance and compatibility policy

The port adapts actual upstream Ink rather than reimplementing the superseded hand-built Ink-like renderer. The [upstream repository](https://github.com/vadimdemedes/ink), [package manifest](https://github.com/vadimdemedes/ink/blob/master/package.json), [README](https://github.com/vadimdemedes/ink/blob/master/readme.md) and [MIT license](https://github.com/vadimdemedes/ink/blob/master/license) identify the source and licensing to preserve. These branch URLs are discovery references, not reproducible source pins. The README explicitly describes an upcoming version; do not equate branch documentation with a released baseline.

Before implementation, select and record an exact source release/commit, archive integrity hash, dependency graph and compatible shared React/reconciler/scheduler versions. Replace discovery references in the port's provenance manifest with immutable source references. Pin every adapted dependency, upstream test fixture and layout implementation; prohibit floating tags or ranges in the reproducible adaptation inputs. If the chosen release conflicts with the shared React foundation, resolve that common prerequisite explicitly instead of vendoring a second React. This plan does not claim a qualified Ink version.

Keep upstream notices/licenses and attribution alongside copied/adapted sources, fixtures and derived assets. Record original paths, hashes, patch rationale and the regeneration command. Re-running the adaptation from pinned inputs must reproduce tracked outputs. Ordinary consumer builds and offline installed-package checks must not download source, discover a client installation or execute dependency lifecycle scripts to make the port usable. Follow repository generated-header, TSDoc, nested-interface and identifier conventions in future source/generators; preserve upstream attribution separately.

Inventory all public exports of the selected baseline before coding. Publish a compatibility matrix with an entry for every export and relevant prop/behavior, classified as preserved, adapted, explicitly unsupported or deferred. Each supported entry needs type/runtime tests; each adaptation needs a documented host difference; each unsupported/deferred entry needs an explicit diagnostic or unavailable export, not an accepted no-op. Preserve supported upstream component/hook names, spelling, default behavior and signatures where portable. Add only the host-specific surface/stream/context parameters required by Bedrock and document them. Keep upstream prop naming even where Bedform's own APIs use different casing.

| Compatibility family | Required port contract and qualification |
| --- | --- |
| Terminal components and text/layout props | Inventory the baseline's containers, text, spacing, static output and layout-inspection behavior; preserve supported semantics through the real Display contract and record rendering limitations |
| Input and focus hooks | Preserve supported callback, active/inactive, focus acquisition/traversal and cleanup behavior using the common routed input adapter; no fabricated physical release/raw-mode support |
| Application/root lifecycle | Explicit mount, rerender, completion/exit and unmount behavior; exit affects the attached application/virtual process only, never the Minecraft server or host process |
| Input/output hooks and streams | Adapt to injected virtual stdin/stdout/stderr and terminal-size changes; preserve ordering, cancellation and error/completion behavior; no dependency on native process handles |
| Layout measurement | Return committed layout measured against Bedform fonts, frames and region limits, with documented rounding and units; no assumption that code-point count equals visual width |
| Host terminal effects | Classify ANSI styling/cursor control, terminal detection, console interception, process signals and related exports; implement only explicitly supported virtual behavior and reject unsupported effects |

The matrix is a release gate, not a license to defer the agreed terminal input, focus, rendering and virtual-stream functionality. A narrower baseline or host limitation must be visible in tracking and documentation before claiming the port complete. Do not advertise compatibility with arbitrary Node CLI packages merely because Ink components render.

## Portable layout and display adaptation

Qualify the portable layout implementation as an early independent deliverable. Identify its exact code/artifact, license, initialization requirements, memory lifetime and algorithms. Probe the selected Bedrock script runtime and packaged consumer bundle directly: do not assume native bindings, WebAssembly, browser APIs, dynamic code generation or top-level asynchronous loading are available. A host-only Node test is insufficient. If the upstream layout dependency cannot execute there, use an explicitly pinned compatible portable implementation with differential fixtures and documented limits; do not silently replace it with a loose flexbox subset. Keep a failed feasibility gate open and report the blocked semantics.

Port supported layout properties with deterministic rounding, row/column sizing, growth/shrinkage, wrapping, alignment, spacing, borders, clipping and overflow according to the chosen Ink baseline. Differentially compare fixture layouts with that baseline. Bound tree size, layout passes, allocations and work per tick, and release layout nodes on replacement, failed render and unmount. Cooperative scheduling cannot preempt arbitrary user component execution; document that limit.

Use Display's authoritative measurement and normalization, cell/aspect settings, UTF-8 limits, Unicode-safe line splitting, glyph mappings and mixed text/region frames. Cover wide/seamless custom glyphs and all six region families. Translate supported upstream terminal measurements into these units explicitly, including combining/supplementary characters, fallback, wrapping, alignment and resize invalidation. Do not resurrect ASCII-to-fullwidth normalization, code-point-count-as-width or the old Braille Pen/cursor-screen framework. Keep one pure frame representation for snapshots, light/dark backends and canonical persistence.

Rendering produces candidate frames and validated region updates before replacing the last valid presentation. Update content and hit/focus bounds coherently; rejected geometry, byte/capacity limits or render failures must not leave invisible interactive controls. Support bounded incremental updates, clearing removed content and resize/reflow without leaking layers. Expose lifecycle/error hooks and actual committed measurements to consumers; application render completion does not prove client paint timing.

The canonical display contract remains unchanged when Ink is attached:

- Resolved-only `themeMode`, default light; light uses the three-layer text/custom-glyph renderer, and dark renders all ordinary text, glyphs and regions with particles. Entering dark mode warns once per transition/creation rather than every tick.
- Font pages and default TextPrimitive text are dark gray `#4D4D4D`. Generate matching white `#FFFFFF` glyph PNGs as ordinary resource-pack textures, with particle definitions/descriptors, preserving shapes, alpha, UVs and metrics. Particles cannot sample `font/` implicitly. Arbitrary RGB/RGBA particle tint defaults to dark gray when omitted; baked PUA font ink cannot be recolored by section-sign codes. Keep invisible width/switch metadata separate from visible particle ink and normalize demo-specific baked backgrounds/colors/shadows.
- Brightness uses `LightLevel`, default 15, with normalized black-overlay alpha `1 - level / 15`, masking/depth covering the whole front and regions; omit the overlay at full brightness. Reuse shared rounded framing, flipped matching rear face, backface default true, finite nonnegative centimeter thickness default zero and closed extrusion only with the backface enabled.
- Preserve canonical content sizing, frame/padding bounds, collision default on, player/mob blocking, runtime toggling and yaw-only orientation while collision is enabled. Disabling collision permits unrestricted orientation. Ink does not weaken the early native collision feasibility gate or force collision on a consumer's custom transient surface.

Display owns appearance and canonical persistence, not React component closures or running commands. Persist serializable frames/bitmaps through the existing ownership/revision/deletion contract; reconnecting Ink is an explicit application operation. Restoring a canonical display never starts an Ink application or VM automatically. Machine restoration policy belongs to VM services and requires fresh authentication with commands stopped.

## Virtual streams, input and focus

The runtime port has no Node processes, native TTYs or host filesystems. Inject virtual stream contracts instead of importing Node stream classes or reading global stdin/stdout/stderr. These contracts must specify ordered chunks, text encoding, end-of-input, separate stdout/stderr, bounded buffering, backpressure, error delivery, cancellation and close ownership. Adapters may serve a standalone terminal application or a VM process; an Ink application does not need a VM account/filesystem.

Output overload must throttle or report explicit capacity failure instead of unbounded buffering or silently claiming delivery. Scope completion and cancellation to the current application/session; disconnect or disposal cancels pending reads/subscriptions without closing unrelated caller-owned streams. Fence late callbacks and writes by application/session generation so a replaced root cannot mutate its successor. Do not globally patch console output, intercept ordinary chat, execute Minecraft commands or start host processes to emulate a terminal. Interpret only documented virtual terminal sequences; malformed/unsupported control input cannot become native execution or an invisible interaction path.

Use one common input model across spatial keys, simple imperative DDUI text entry and explicitly routed chat. Represent text insertion separately from submission, navigation, commands and modifier combinations. Support Ctrl, Shift, Alt, Super, arrows, Home/End/Page Up/Page Down/Insert/Delete/Backspace/Enter/Tab/Escape/function keys and related controls. Tap modifiers visibly latch for the next key and reset on focus/session loss; activation-only native input never produces invented physical release events. The same normalized input reaches supported Ink hooks and VM shell adapters without independently decoding each source into conflicting editing semantics.

Validate current controller, target application and authenticated session where applicable on every delayed DDUI/chat submission. One active input controller owns a displayed terminal at a time. Keep editing, history and focus state separate between authenticated player sessions; controller switching does not merge accounts or edits. Disconnect, logout, root replacement and disposal release focus, reset modifier latches and cancel pending input. Only explicitly authorized routing consumes chat. Credential entry remains player-private imperative DDUI and bypasses terminal output, chat, logs, history, scrollback and Transactional history. Separate sessions do not make a shared display's output private; its audience can still read rendered output.

Ink focus hooks and traversal are scoped to their attached application, with deterministic transfer and cleanup when targets become disabled, disappear or lose authorization. Reuse the applicable pointer/access/gesture primitives, but keep display controller ownership distinct from general multi-pointer widget admission. Input failures in one application must not steal focus or disconnect another root's streams.

## Bedform terminal components

Publish Bedform additions in category submodules beneath `bedform/Spatial/Terminal/Ink/Components/*`, with a discoverable index and independently usable exports. The planned submodules are `Input`, `Scrollback` and `Shell`; settle exact symbol signatures during the API implementation deliverable without colliding with or renaming supported upstream exports.

- `Input` provides reusable editing, caret/selection presentation where supported, insertion versus submission, history/completion adapters, navigation/modifier handling and cancellation. Bind it to the application/controller input model, not host keyboard state. Keep entered credentials out of ordinary input/history persistence.
- `Scrollback` provides bounded output storage and viewport presentation, explicit append/clear/snapshot behavior, deterministic wrapping/reflow and navigation. Keep stdout/stderr provenance where requested, define overflow policy and release buffers/subscriptions on disposal. It is reusable without the shell and without VM persistence.
- `Shell` composes prompt, reusable input, output/scrollback, completion/history and command-status presentation. It binds to the VM Shell/Process virtual streams, cancellation and session/controller adapters. It owns no duplicate parser, filesystem, user database, permission engine or world-capability policy.

The service-side shell contract belongs to `MineCraft-w82n.4`: Bash-like editing/history/completion, quoting, environment, pipelines, stdin/stdout/stderr redirection, exit statuses and `;`, `&&`, `||`; ordinary file creation/text redirection and the agreed core utilities remain available. Scripts, loops, functions, command substitution, background jobs, compilers, editors and arbitrary code execution are deferred. Shell presentation cannot bypass per-machine account/filesystem permissions or independently host-granted world IO capabilities. Qualify the basic Ink/Input/Scrollback delivery independently of the VM-dependent Shell binding.

## Independent Window API and lifecycle

Expose a typed create/update/subscribe/event/dispose surface at `bedform/Spatial/Window`, with consumer state and both event directions parameterized by their own types. Future API work must finalize names/signatures and publish positive/negative consumer examples; this document defines observable semantics rather than claiming those symbols already exist.

Creation supplies the explicit spatial runtime, application component/root inputs, initial state, frame/pose/size options, audience and error handling. Default to a specified player's private audience and require explicit sharing/audience selection; never interpret a missing private viewer or an empty native audience list as public visibility. Validate before allocation, and clean up all resources when initial rendering fails. Each successful Window gets its own React root and store; independent roots share the React implementation, not application state or component identity.

Update supports application state and supported presentation/root inputs, without recreating the store or remounting unaffected component state. Validate transforms, dimensions, resources and access before replacing valid presentation. Audience/focus changes revalidate affected controllers and cancel unauthorized gestures/input. Reuse Canvas frame geometry rather than copying frame algorithms into Window. Crafting/furnace framing supports an optional matching backface and rounded border extrusion using the canonical geometry's dimensions, flipped rear axes, centimeter units, nonnegative finite thickness and closed-corner rules. Do not silently import canonical machine persistence or physical collision merely because framing is shared. If a Window explicitly uses a canonical collision-enabled display, its existing yaw-only/native collision restrictions still apply.

Window need not wait for Tabs, TabButton, TitledPanel or every spatial widget. Its base frame is the shared rounded frame; tabs/title/body variants remain separately requested components. Preserve the applicable top-level host-ancestry contract when composing React FramedPanel: nonvisual providers/fragments/composite wrappers may intervene, while regular visual/layout ancestors may not hide forbidden nesting. Window manages its own permitted root/frame structure, not a loophole around ancestry validation.

### External store and React subscription

Each Window exposes a consumer-owned-data contract with snapshot, subscription and update operations. The runtime owns the store's lifetime. Snapshots are immutable/read-only views of committed application state and revision; repeated reads without a change preserve snapshot identity. Consumers cannot mutate internal state through returned values. Successful changes publish one coherent revision to current subscribers; invalid updates leave the prior state and revision intact. Define equality/no-op handling so unchanged updates do not produce unbounded notification/render loops.

React uses the shared `useSyncExternalStore` hook against that same store, including stable subscription/unsubscription and snapshot identity. Updates made outside React must reach React subscribers, and application updates made inside React must be observable through the external handle. Do not keep an unsynchronized second React-local copy. Test subscriptions added/removed during notification, reentrant updates and multiple consumers; serialize/bound notification work and isolate listener errors without starving other subscribers or Windows.

State publication and asynchronous React/native rendering are distinct observable stages. Report the affected revision and phase if rendering fails after a valid store update; do not claim a store update proves successful native rendering. Preserve the last valid scene or a documented error-boundary fallback, remove invalid interaction targets and permit explicit recovery. Failed validation/allocation before publication cannot leak a candidate revision. Avoid silent rollback that would make subscribers observe an unexplained older snapshot.

### Typed bidirectional events

Define separate typed event maps for host-to-application and application-to-host traffic, with discriminated event names and matching payload types. Document which direction each subscribe/emit operation handles. Host events reach only this Window's application listeners; UI events reach only its subscribed external consumers. Do not use a global bus with unscoped names, cross-root implicit broadcasts or global Minecraft command/chat execution.

Specify deterministic dispatch order, unsubscribe behavior, bounded queuing and the relationship to store revision. An event is not an implicit store mutation; application code may apply an explicit validated update. When action events carry a player/controller context, revalidate audience/access/session ownership at dispatch, including queued actions. Fence stale callbacks/events by Window lifetime; dispose or replacement cannot deliver to a successor by recycled identity. A failing listener is reported through this Window's error channel and cannot abort unrelated Window dispatch or leak payloads across private audiences.

Types reject unknown event names and wrong payloads for each direction. Runtime adapters validate external/untrusted payloads before invoking handlers; generic type parameters alone do not establish runtime validity. Document validation responsibility for entirely in-process consumer events without inventing an unrestricted host transport.

### Errors, disposal and consumer persistence

Keep store, event, focus, React boundary, rendering and cleanup errors scoped to the affected Window with useful phase/revision context. Error reporting must not publish credentials or another Window's private state. Test initial failure, failed update, subscriber failure, renderer capacity loss, controller disconnect, dimension changes, lost audience and partial cleanup; unaffected Windows continue normally.

Disposal first prevents new operations/input/event dispatch, then unmounts React and runs effect cleanup, removes input/event/store subscriptions, releases owned frame/surface/proxy resources and pending scheduler work, and invalidates handles. Make disposal and unsubscribe cleanup idempotent; all new state reads/updates/subscriptions/event emissions/presentation operations after disposal reject with a documented disposed error. Retained callbacks cannot resurrect the root. Cleanup failures still attempt remaining cleanup and are reported; borrowed runtimes/displays/streams remain caller-owned.

Windows are runtime-owned. Expose a snapshot suitable for explicit consumer persistence, with a versioned application-state/presentation representation or a required consumer serializer for nonserializable values. Exclude React trees, closures, live native handles, event listeners, pending work, authentication secrets and input controller authority from persisted snapshots. A consumer saves and explicitly reconstructs a new Window and rebinds events; Bedform does not automatically restore applications on world restart/chunk load. Disposal does not implicitly persist state. Exporting a snapshot neither grants access nor resumes a session/process; canonical machine data/restoration remains Canvas/VM responsibility.

## Existing prerequisites and future implementation ownership

The table maps reusable owners, not implementation evidence. The historical audit found missing edges and an obsolete terminal blocker; `MineCraft-w82n.5` reconciled existing owners and `MineCraft-w82n.7` now wires the new child-level prerequisites in the actual-ID tables below. Closed history remains preserved and the graph is acyclic.

| Existing work | Reuse for Ink/Window | Required boundary |
| --- | --- | --- |
| `MineCraft-zcmm.1` | Canvas scaffold, identities and deterministic artifact | Asset prerequisites use this foundation, not completion of Intent |
| `MineCraft-9rdk.1/.2/.3` | LightLevel, ThemeMode and native light wrappers | Preserve existing value contracts/defaults; do not gate pure contracts on native fixture completion |
| `MineCraft-ty2k.9/.10`, `MineCraft-9rdk.5` | One glyph inventory/generator/metrics source, white particle textures and ordinary-font dark-mode coverage | No duplicate glyph pages or baked-color particle renderer |
| `MineCraft-9rdk.6/.7` | Pure frames/regions/measurements and bare Display lifecycle/input adapters | Ink uses these; Display remains independent of Ink, React and VM |
| `MineCraft-9rdk.8/.9` | Theme backends and React-independent rounded frame/rear/extrusion/brightness geometry | Window shares frame helpers; do not require completed React FramedPanel |
| `MineCraft-9rdk.4/.10/.11` | Collision proof and canonical identity/persistence/display integration | Needed when explicitly composing canonical displays/machines; not automatic Window persistence prerequisites |
| `MineCraft-ty2k.1-.4` | One React/reconciler/scheduler adaptation, API/hooks, differential tests and root contracts | Use bounded API publication in `ty2k.2` and shared root/compatibility children, without waiting for `.16` or the full widget catalogue |
| `MineCraft-ty2k.6/.8/.11/.12/.13-.15/.24` | Applicable particle, text/font, pointer/access/gesture and theme machinery | Extract imperative primitives and only required contracts; preserve distinct terminal controller semantics |
| `MineCraft-ty2k.33` and `MineCraft-9rdk.9` | FramedPanel consumer and shared frame implementation | Shared geometry supplies both; no reverse dependency from canonical frame to full React panel |
| `MineCraft-zcmm.6/.7`, `MineCraft-ty2k.7/.16`, `MineCraft-9rdk.12/.14` | Canvas.Images/descriptors, general feature-based Canvas bundling, Spatial React JSX exports, DDUI migration and offline consumer checks | Separate general packaging from Intent completion and broad component qualification |
| `MineCraft-ty2k.17/.18`, `MineCraft-9rdk.15/.16` | Fixed-path native fixture patterns and separate real-client evidence | Share infrastructure, not automatic acceptance of new Ink/Window behavior |
| `MineCraft-5jg` including `.3.1`, `MineCraft-4osy` | Closed shared config/script-build and Common archive/dependency patterns | Reuse evidence/patterns without reopening or rewriting closed issues |
| `MineCraft-fwox`, `MineCraft-53dn`, `MineCraft-9rdk.12` | Imperative form navigation/cleanup and declarative migration | Common form icons remain Common; password input never enters Transactional history |

The superseded `MineCraft-2k9d` and its nine superseded children are historical/replacement-mapping inputs, not implementation prerequisites. Transfer applicable compatibility/measurement/lifecycle requirements according to `w82n.1`; do not implement its emulator or DDUI JSX recipe. `ty2k.27` integrates the new Display contract. Adaptive-anchor `ys8v`, Nerd Fonts `ty2k.29`, all Intent presets and the full spatial widget catalogue do not gate basic Ink or Window delivery.

`MineCraft-w82n.6` records the separate open Ink and Window implementation epics, complete embedded specifications and explicit child acceptance in the actual-ID mapping below. The following are deliverable responsibilities for those future issues, with separate qualification gates rather than a single ambiguous implementation task:

| Future family | Implementation deliverables | Packaging/qualification deliverables |
| --- | --- | --- |
| Ink | Source/dependency inventory and exact pin/provenance; shared React integration; portable layout feasibility and compatibility fixtures; Display host/measurement/frame adapter; virtual streams; routed input/focus; supported upstream API matrix; reusable Input/Scrollback components | Full compatibility/type/host and restricted-runtime tests; inert/tree-shaken imports; reproducible artifacts and independently installed offline consumers; fixed-path BDS lifecycle/input/render calls; separate real-client text/input/performance/multiplayer acceptance |
| Window | Typed root/handle contract; shared Canvas frame; external store and useSyncExternalStore bridge; typed event maps/dispatch; audience/focus/error isolation; disposal and consumer snapshot/reconstruction | Store/event/root tests and type errors; packed consumers/Canvas dependency handling; fixed-path BDS resource/privacy-call/lifecycle tests; separate two-client frame/audience/input/disposal observations |
| VM shell integration | Future VM epic owns service parser/process/streams/security/session semantics; Ink family supplies Shell presentation and binds the qualified service adapter | End-to-end shell/Ink input/output/backpressure/cancellation, logout/restart and authority checks, plus distinct native/client input acceptance; basic Ink and Window do not wait for the shell |

Dependency direction is Canvas/value/display foundations first; shared React next; Ink and Window after their specific shared prerequisites; VM shell after Ink plus VM services. Ink and Window do not depend on each other. General Canvas packaging and shared React compatibility must be deliverable independently of all widgets/Intent. Keep display-only delivery independent of VM and shell; do not wire broad epics as reciprocal blockers.

## Validation and acceptance gates

### Automated, type and packed consumers

- Differentially test every claimed supported Ink export/prop against the exact upstream baseline, including layout, wrapping/borders/overflow, measurements, focus, callback cleanup, rerender/unmount and documented unsupported behavior. Keep licenses on upstream fixtures. Test shared React hooks, contexts, errors, effect cleanup, Suspense/abandoned renders where supported by the port's matrix, without a second React dispatcher.
- Qualify portable layout on the selected Bedrock script runtime and offline installed bundle. Test initialization, prohibited host dependencies, determinism, work/memory bounds and full node cleanup. Node-only fixture parity does not establish native feasibility.
- Compare generated glyph assets/alpha/UVs and authoritative measurements with committed frames, light/dark parity, explicit/default arbitrary tint, byte limits, Unicode boundaries, six region families, failed-frame retention and resize/reflow. Check stream ordering, separate output channels, end/error, bounded buffers/backpressure, cancellation and stale-callback fencing.
- Exercise spatial keys, DDUI insertion/submission and routed chat through one model, controller transfer, session separation, modifier latch/reset, focus traversal/cancellation and delayed callback revalidation. Test that ordinary chat and credential input never appear in ordinary terminal routing/history.
- Window types reject wrong event directions/payloads and invalid state operations. Runtime tests cover independent roots/stores, immutable stable snapshots, no-op/invalid updates, revisions, outside/inside React updates, subscription reentrancy/unsubscribe/errors, event ordering/authorization, failed-render recovery and no cross-Window leakage. Verify unmount/effect cleanup, disposed rejection, late callbacks and idempotent cleanup.
- Window snapshot/reconstruction tests demonstrate explicit consumer persistence only: importing, loading a chunk or restarting cannot automatically restore applications, listeners, input authority or running work. Canonical display and VM restoration remain separately tested contracts.
- Run Bedform full verification and affected Canvas generator/asset/lint/type/reproducible-build checks. Independently install packed packages offline with lifecycle scripts disabled, compile both Spatial React JSX modes, verify submodule exports/components/declarations, license/provenance inclusion, inert imports, Canvas feature detection/dedup/conflict handling and absence of Node/native TTY/host filesystem dependencies. Bare Display consumers must omit optional Ink/VM startup and DDUI JSX artifacts.

### Native BDS

Use isolated add-on runners at fixed `dist/bds-runtime/bedrock_server.exe` paths, preserving existing worlds and unrelated servers. Ordinary tests do not elevate or silently alter firewall rules. Record engine/build, qualified native APIs, artifact hashes, exact commands, configuration, logs and clean shutdown. Probe actual portable-layout execution and native text/particle API forwarding, frame updates, tint/audience calls, focus/input lifecycle where supported, root replacement/disposal, capacity errors, disconnect/dimension changes and restart cleanup without orphan resources. A two-process fixture must distinguish canonical display data restoration from nonrestored Ink applications/Windows and logged-out/stopped VM behavior when the VM integration is present.

### Real-client acceptance

Record client versions, final artifact identity, observations and available captures separately from host/BDS results. Verify Ink text/glyph/region alignment, wrapping/resize/scrollback/caret readability, dark-mode particle performance, arbitrary RGB/RGBA tint/alpha, occlusion and particle seams/flicker. Compare Window crafting/furnace framing, rear orientation, zero/positive rounded extrusion and closed seams under movement/resize/theme updates. Use two clients for private/default versus explicitly shared audiences, focus/controller transfer and independent Window state/events. Check spatial-key activation and visible modifier latches, DDUI text insertion versus submission, explicitly routed chat, delayed submissions after session loss, disconnect/disposal and absence of ordinary chat capture. Existing demo appearance or server-side audience assertions alone are not acceptance of these applications.

Keep unobserved cases open and file defects in Beads under the relevant future implementation epic. No production deployment, commits, pushes, remote Dolt sync or runtime work is authorized by this planning document.

## Existing issue reconciliation recorded by MineCraft-w82n.5

Existing nonclosed prerequisites now have explicit single owners: custom glyph catalogue/generation `ty2k.9`, native metrics `ty2k.10`, ordinary-font particle coverage `9rdk.5`, pure frames/Display `9rdk.6/.7`, shared frame `9rdk.9`, canonical identity/persistence `9rdk.10`, imperative particle helpers `ty2k.8`, Canvas.Images `zcmm.6`, general Canvas bundling `zcmm.7`, shared React/API/JSX publication `ty2k.2` and Spatial React build integration `ty2k.7`. DDUI removal/migration remains open in `9rdk.12`; imperative forms/MessageBox/Checklist are `l89.3/.4/.6`. `ty2k.27` no longer depends on the superseded emulator. Earlier audit references describe the pre-reconciliation graph. Runtime epic/child creation is recorded by `w82n.6`; `w82n.7` now records their required child dependencies. No runtime or acceptance work is completed by reconciliation.

## Open runtime implementation tracking (MineCraft-w82n.6)

Created November 18, 2026 by `MineCraft-w82n.6`: three separate top-level future runtime epics, 42 implementation/packaging/native/client children, all open. These are separate from the planning-only w82n parent. Hierarchy and the listed child-level blocking prerequisites are recorded. `MineCraft-w82n.7` wires these edges and publishes coordinated ordering; `.8` owns final coverage/parity validation. Creation is not implementation, native feasibility or real-client acceptance.

| Runtime epic | Responsibility | Children |
| --- | --- | --- |
| `MineCraft-3w2z` | Own optional upstream Ink adaptation, qualified portable layout, Display host, renderer-facing virtual IO/input/focus, supported components/hooks and Input/Scrollback/view-only Shell. Reuse shared React and existing Canvas/display assets. VM owns actual accounts/process/parser/services and real Shell binding. Standalone Ink does not wait for VM or Window. | 12 open |
| `MineCraft-glcb` | Own independent roots/handles, shared-frame binding, external stores/useSyncExternalStore, typed directional events, audience/focus/error isolation and disposal/explicit consumer reconstruction. Reuse shared React/Canvas geometry; no Ink/VM or automatic persistence requirement. | 10 open |
| `MineCraft-q4r0` | Own VM service contracts, per-machine durable data/accounts/permissions, qualified credential handling, scoped world IO, processes/streams/parser/coreutils, authenticated input/session binding, actual hybrid keyboard/text adapters, Ink shell integration and canonical VM constructor/restoration. Shared display/React/Ink components and Canvas identity/frames remain with their existing owners. | 20 open |

### Ink descendants — `MineCraft-3w2z`

| Issue | Deliverable | Blocking prerequisites (current Beads edges) |
| --- | --- | --- |
| `MineCraft-3w2z.1` | Pin Ink source, provenance and the complete compatibility inventory | None |
| `MineCraft-3w2z.2` | Qualify portable Ink layout on the selected Bedrock script runtime | `MineCraft-3w2z.1` |
| `MineCraft-3w2z.3` | Implement the Ink terminal host over reusable Display frames | `MineCraft-3w2z.1`; `MineCraft-3w2z.2`; `MineCraft-9rdk.6`; `MineCraft-9rdk.7`; `MineCraft-ty2k.4`; `MineCraft-ty2k.10` |
| `MineCraft-3w2z.4` | Adapt Ink input and output to bounded virtual stream contracts | `MineCraft-3w2z.1` |
| `MineCraft-3w2z.5` | Implement common routed input and Ink focus adapters | `MineCraft-3w2z.1`; `MineCraft-9rdk.7`; `MineCraft-ty2k.4` |
| `MineCraft-3w2z.6` | Implement reusable Ink Input editing and completion presentation | `MineCraft-3w2z.3`; `MineCraft-3w2z.5` |
| `MineCraft-3w2z.7` | Implement bounded reusable Ink Scrollback and viewport presentation | `MineCraft-3w2z.3`; `MineCraft-3w2z.4` |
| `MineCraft-3w2z.8` | Implement supported upstream Ink components, hooks and compatibility behavior | `MineCraft-3w2z.1`; `MineCraft-3w2z.2`; `MineCraft-3w2z.3`; `MineCraft-3w2z.4`; `MineCraft-3w2z.5`; `MineCraft-ty2k.3` |
| `MineCraft-3w2z.9` | Qualify Ink exports, host compatibility and offline packed consumers | `MineCraft-3w2z.6`; `MineCraft-3w2z.7`; `MineCraft-3w2z.8`; `MineCraft-3w2z.12`; `MineCraft-zcmm.7`; `MineCraft-ty2k.7` |
| `MineCraft-3w2z.10` | Qualify Ink native layout, rendering and application lifecycle | `MineCraft-3w2z.9`; `MineCraft-3w2z.2`; `MineCraft-9rdk.8`; `MineCraft-9rdk.9` |
| `MineCraft-3w2z.11` | Accept Ink appearance, editing and shared application behavior on real clients | `MineCraft-3w2z.10` |
| `MineCraft-3w2z.12` | Implement view-only Ink Shell presentation over structural service adapters | `MineCraft-3w2z.4`; `MineCraft-3w2z.6`; `MineCraft-3w2z.7`; `MineCraft-3w2z.8` |

### Window descendants — `MineCraft-glcb`

| Issue | Deliverable | Blocking prerequisites (current Beads edges) |
| --- | --- | --- |
| `MineCraft-glcb.1` | Implement typed independent Window roots and public lifecycle handles | `MineCraft-ty2k.2`; `MineCraft-ty2k.4`; `MineCraft-glcb.3` |
| `MineCraft-glcb.2` | Bind Window framing to shared Canvas geometry and presentation | `MineCraft-glcb.1`; `MineCraft-9rdk.9`; `MineCraft-ty2k.8` |
| `MineCraft-glcb.3` | Implement immutable external Window stores and revisioned updates | None |
| `MineCraft-glcb.4` | Bridge Window stores into React with useSyncExternalStore | `MineCraft-glcb.3`; `MineCraft-ty2k.2`; `MineCraft-ty2k.3` |
| `MineCraft-glcb.5` | Implement typed bidirectional Window events and bounded dispatch | `MineCraft-glcb.1`; `MineCraft-glcb.3` |
| `MineCraft-glcb.6` | Implement Window audience, focus and error isolation | `MineCraft-glcb.2`; `MineCraft-glcb.4`; `MineCraft-glcb.5`; `MineCraft-ty2k.13`; `MineCraft-ty2k.14`; `MineCraft-ty2k.15` |
| `MineCraft-glcb.7` | Implement Window disposal and explicit consumer snapshot reconstruction | `MineCraft-glcb.4`; `MineCraft-glcb.5`; `MineCraft-glcb.6` |
| `MineCraft-glcb.8` | Qualify Window host contracts and offline packed consumers | `MineCraft-glcb.7`; `MineCraft-zcmm.7`; `MineCraft-ty2k.7` |
| `MineCraft-glcb.9` | Qualify Window native resources, audience calls and restart cleanup | `MineCraft-glcb.8` |
| `MineCraft-glcb.10` | Accept Window frames, privacy and independent interactions with two clients | `MineCraft-glcb.9` |

VM services, actual authenticated shell binding, native hybrid input and VM restoration are owned by `MineCraft-q4r0`; see the [VM mapping](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). View-only Shell is `MineCraft-3w2z.12`; actual VM binding is `MineCraft-q4r0.16`. Common input/focus semantics are `MineCraft-3w2z.5`, authenticated routing `MineCraft-q4r0.13`, spatial key activation `MineCraft-q4r0.14` and both native DDUI/chat sources `MineCraft-q4r0.15`. Standalone Ink and Window do not wait for VM shell/native acceptance.

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
