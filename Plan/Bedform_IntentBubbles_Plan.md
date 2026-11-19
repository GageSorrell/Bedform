# Bedform Intent Bubbles and BedformCanvas

## Summary

Add `bedform/Spatial/Intent` for displaying camera-facing intent bubbles above players and other entities. Players never see their own bubble. Each entity has one active intent across all add-ons; the newest request replaces it.

Create `Addon/BedformCanvas`, package `bedform-canvas`, as the shared add-on dependency for Intent and asset-backed terminal/spatial UI. Bedform builds automatically include its packs when those features are used.

## Shared Canvas organization

Canvas owns shared terminal/spatial assets, canonical display/VM entities, and common runtime, identity, ownership and persistence support. The [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) specifies persistent display appearance, collision, sizing and restoration; VM services at `bedform/VM` own per-machine files, accounts, permissions and safe session metadata. Restoring a display does not start a VM; machine restoration requires login again and does not resume commands. Intent state remains session-only and follows the independent lifecycle below.

Canonical display and VM constructors are distinct at `bedform/Spatial/Terminal`; bare `bedform/Spatial/Terminal/Display` offers frames, regions, measurement, snapshots, input adapters and lifecycle for custom entities/displays/storage without React, Ink or VM startup. Shared framing is React-independent and reused by canonical displays, React FramedPanel and `bedform/Spatial/Window`. Canvas owns its crafting/furnace frame artwork, optional matching rear face and rounded border extrusion; unrelated DDUI/control resources stay in Common.

The [React plan](Bedform_React3D_Plan.md) provides one shared `bedform/Spatial/React` port, hooks and JSX runtimes. Optional Ink at `bedform/Spatial/Terminal/Ink` adapts surfaces and virtual streams without Node processes, native TTYs or host filesystems; Bedform components live under `Ink/Components/*`. Windows have independent React roots, external snapshot/subscription/update stores consumed with `useSyncExternalStore`, typed bidirectional events and isolated focus/errors/cleanup. They default private, allow explicit sharing, unmount/release resources on disposal and reject later operations. Window snapshots support consumer persistence rather than automatically restored applications. Keep imperative DDUI text/password forms and remove its JSX layer. The dedicated [Ink/Window specification](Bedform_Terminal_Ink_Window_Plan.md) is recorded by `MineCraft-w82n.3`; the separate [VM specification](Bedform_VM_Plan.md) is recorded by `.4`.

## Public API and lifecycle

- Export `Spatial.Intent` from Bedform's root and publish `bedform/Spatial/Intent`. Imports remain inert.
- `Intent.Start({ Id, World, System, OnError? })` creates a connection to BedformCanvas's shared runtime. `Id` uniquely identifies the calling add-on.
- The connection exposes asynchronous `Set(entity, intent, options?)`, `Clear(entity)` and idempotent `Dispose()`. Requests acknowledge acceptance; missing or incompatible Canvas runtimes produce actionable errors.
- Export a frozen `Builtin` record, a `Glyphs(text, metrics?)` constructor, and types for generated custom-icon descriptors.
- `Set` replaces the current intent and restarts animation. Options include `DurationTicks`, `Scale`, `Offset` and `MaxDistance`. Defaults are indefinite duration, scale 1, a downward pointer ending 0.25 blocks above the entity's head, and 32-block viewing range.
- `Clear` explicitly clears the entity's current bubble. `Dispose` clears only requests still owned by that connection; it cannot remove another connection's newer replacement.
- State is session-only. Death and player disconnect clear it. Bedrock's `entityRemove` event also fires for chunk unloads and carries no reason, so removal never clears directly: the subject is suspended and resumes when it reloads (decision of November 18, 2026, preserving unload/reload behavior). A permanently removed subject's dormant record ends on expiry, `Clear`, owner `Dispose` or restart. Dimension changes move rendering into the new dimension. Temporarily unloaded subjects stop rendering; elapsed durations continue.
- BedformCanvas owns one renderer and versioned request protocol. Sequence tokens fence stale expiry, cleanup and acknowledgement callbacks.

Example:

```ts
const intents = Intent.Start({ Id: "example:addon", World: world, System: system });

await intents.Set(player, Intent.Builtin.Thinking, { DurationTicks: 60 });
await intents.Set(npc, Intent.Glyphs("\uE000\uE001"));
await intents.Set(player, Icons.CustomAnimation);
await intents.Clear(player);
```

## Rendering and included assets

- Use a gray Minecraft UI panel with pixel bevels, a lower shadow and a small downward pointer. Default panel size is 32 x 24 logical pixels, plus the pointer, at 32 pixels per block.
- Render panels and textured icons with camera-aligned particles, refreshed every tick with a two-tick lifetime. Use [per-player particle emission](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable#spawnparticle), excluding the subject's player ID.
- Render PUA content using private, camera-facing `TextPrimitive`s with transparent backgrounds. Configure the audience before registration; remove primitives when the audience disappears. Beta text APIs are allowed.
- Enable world depth testing. Keep panel/content layers aligned with deliberate depth offsets. Clearing or replacing particle content has a maximum two-tick visual tail.
- Follow the current head position every tick. Support all entity types without modifying their behavior or interaction rules.
- Include interrogative, exclamatory, exclamatory-interrogative, thinking, SOS, sleep, affirmative, negative, knowledgeable, affectionate and hunger.
- Include eight `arrow-*` directions. Extract the fine Mojangles arrow glyphs, preserving their shapes, and add a one-pixel lower-right shadow.
- Thinking cycles its highlighted dot left-to-right every six ticks. Sleep uses six looping frames at four ticks per frame.
- SOS uses Minecraft Ten. Affectionate and hunger use the vanilla health heart and hunger meat-on-bone artwork.
- `Glyphs` accepts exactly one to three BMP PUA characters. Canvas-owned glyphs use baked dark gray #4D4D4D font ink and default TextPrimitive text color; third-party resource-pack glyphs retain their authored colors. Expand the panel to fit their measured advances; allow metrics overrides for custom resource-pack fonts.
- Store reproducible source artwork, generators, previews and provenance in Canvas. Ordinary builds must work without an installed Minecraft client. Intent textures consume no new PUA allocations.

## Build and shared-asset integration

- Give Canvas stable behavior/resource-pack identities, a shared runtime, deterministic packaging and a bundled `bedform-canvas.mcaddon` artifact in the published Bedform package.
- Detect Canvas use from surviving bundled runtime features, including root namespace and transitive imports. Type-only or eliminated imports do not trigger inclusion.
- Stage Canvas once, add versioned manifest dependencies, reuse matching dependencies and reject conflicting versions. Preserve authored manifests and atomic build output.
- Add `Canvas.Images` configuration for custom PNG icons. Each entry supplies a source image and optional frame count/tick duration; animated images use equal-sized frames in a vertical strip.
- Generate typed descriptors under virtual `generated/canvas/images.ts`, plus namespaced textures and particle definitions in the consumer's resource pack. Require explicit resource-pack selection when multiple destinations exist.
- Generate animation frames from elapsed intent ticks so refreshes do not restart flip-books. Center custom icons and preserve their aspect ratio within the panel.
- Make Canvas the owner of terminal/spatial display assets in the existing plans and Beads specifications. Leave unrelated DDUI/control assets in Common. Reuse one glyph generator/inventory with `ty2k.9/.10` and `9rdk.5/.6`, and one `Canvas.Images` compiler/virtual descriptor contract with `ty2k.7`. The React renderer, optional Ink, Window, VM services and adaptive anchors retain their own implementation and acceptance work; the superseded terminal design is historical.
- Separate shared Canvas scaffold/artifact, particle helpers and automatic dependency inclusion from Intent-specific client/protocol/artwork completion. Terminal/display packaging must not wait for all Intent features; reuse `zcmm.1` and extract the general packaging foundation from `.7`. Canonical ownership `9rdk.10` is separate from Intent arbitration `.3`, so persistent machines cannot accidentally inherit session-only bubble semantics.
- Follow repository documentation, identifier and generator conventions, using symbol-level `@since 1.0.0` for the new APIs.

## Validation and acceptance

- Test replacement across two independent add-on connections, acknowledgements, startup races, expiry fencing, disposal, missing dependencies and incompatible protocol versions.
- Test player self-exclusion, NPC visibility, opposing viewers, range boundaries, movement, dimension changes, unload/reload, death, disconnect and restart.
- Verify every preset, arrow orientation/shadow, animation sequence, PUA validation, custom metrics and static/animated custom assets.
- Test automatic inclusion through direct, root and transitive imports; omission for type-only/unused imports; dependency deduplication; generated freshness; and an independently installed offline consumer.
- Isolate rendering failures to the affected subject/viewer, report them and retry without removing unrelated shapes.
- Run Bedform's full verification and Canvas's lint, type, asset and reproducible-build checks.
- Use an isolated native fixture at a fixed `dist/bds-runtime/bedrock_server.exe` path. Separately verify real-client appearance with two players, including first/third-person views, billboarding, occlusion, text alignment and particle trails.
- Create Beads implementation tracking before coding. Preserve unrelated changes; no production deployment, commit, push or remote synchronization is included.

## Delivery status

This document records the agreed specification on November 17, 2026. Saving it and creating the implementation issues does not implement the feature or establish native or visual acceptance. Beads is the source of truth for task status. Implementation and acceptance issues remain open until their own evidence exists.

The organization update belongs to `MineCraft-w82n.2`, based on the audit in `.1`. It edits documents only; `.5` updates nonclosed issues and embedded specifications, `.6` creates future Ink/Window/VM implementation tracking and `.7` wires deliverable dependencies without cycles. The table below records the existing Intent/shared Canvas deliverables and edges reconciled by w82n.5; new Ink/Window/VM tracking and edges remain .6/.7. Shared foundations stay independently deliverable.

## Beads implementation mapping

Epic: `MineCraft-zcmm` - Add Bedform intent bubbles and BedformCanvas shared add-on.

Each child contains its deliverable, acceptance criteria and a copy of the agreed specification. All implementation and acceptance children were created open. Short dependency identifiers below use the `MineCraft-zcmm` prefix.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-zcmm.1` | Create BedformCanvas shared add-on and deterministic pack artifacts | None |
| `MineCraft-zcmm.2` | Define Intent public API and versioned cross-add-on request client | `MineCraft-zcmm.1`; `MineCraft-zcmm.6`; `MineCraft-zcmm.7` |
| `MineCraft-zcmm.3` | Implement Canvas shared intent arbitration and session lifecycle | `MineCraft-zcmm.1`; `MineCraft-zcmm.2` |
| `MineCraft-zcmm.4` | Generate dialog panels and complete built-in intent artwork | `MineCraft-zcmm.1`; `MineCraft-ty2k.9` |
| `MineCraft-zcmm.5` | Render private billboard intent particles and PUA text above entities | `MineCraft-zcmm.3`; `MineCraft-zcmm.4`; `MineCraft-ty2k.8`; `MineCraft-ty2k.10` |
| `MineCraft-zcmm.6` | Compile shared Canvas.Images registrations and virtual typed descriptors | `MineCraft-zcmm.1` |
| `MineCraft-zcmm.7` | Bundle the shared Canvas artifact and feature-based dependencies independently of Intent | `MineCraft-zcmm.1` |
| `MineCraft-zcmm.8` | Qualify Intent and Canvas with full automated and offline consumer checks | `MineCraft-zcmm.6`; `MineCraft-zcmm.3`; `MineCraft-zcmm.1`; `MineCraft-zcmm.4`; `MineCraft-zcmm.7`; `MineCraft-zcmm.5`; `MineCraft-zcmm.2` |
| `MineCraft-zcmm.9` | Qualify Intent lifecycle and shared ownership on isolated native BDS | `MineCraft-zcmm.8` |
| `MineCraft-zcmm.10` | Accept intent bubble appearance and privacy with two real clients | `MineCraft-zcmm.9` |

## Canvas custom glyph asset and tint contract (November 17, 2026)

- `Addon/BedformCanvas` (`bedform-canvas`) owns terminal/spatial custom glyph assets and their generators; unrelated DDUI/control assets remain in BedformCommon.
- Generate custom font pages with dark gray glyph ink `#4D4D4D`. TextPrimitive presentation uses the same default dark gray text color, including ordinary text and `§r` resets. PUA glyph ink is baked into the font PNG and is not recolored by TextPrimitive color or `§` codes.
- Generate matching particle-accessible texture copies of every custom glyph page with white glyph ink `#FFFFFF`, from the same authoritative glyph source. Preserve glyph shapes, source/stand-in identities, cell/UV layout, metrics and ink alpha; retain invisible width/switch helpers as metadata, not visible particle ink. Remove demo-specific baked color, background and shadow treatments from the particle ink mask so they cannot prevent arbitrary tinting. Keep any required text-overlay masking treatment separate from that mask.
- All glyph-particle spawn/render helpers, including one-shot and managed entry points, accept an explicit arbitrary RGB/RGBA tint and apply it to the white texture. If tint is omitted, apply dark gray `#4D4D4D` with alpha 1; explicit tint takes precedence. Do not quantize particle tint to the `§` palette or require precolored texture variants. Preserve texture alpha when tinting.
- Inventory every current demo page and later custom font family, including wide/seamless, octant and region glyphs. Preserve shapes and metrics while normalizing colors; pixel-for-pixel reproduction of the demo's cyan, multicolor or white font ink is not required. Keep provenance/licenses, deterministic generation, descriptors, packaging and freshness checks aligned for both representations. Future Nerd Fonts follow the same contract when implemented.
- Verify dark gray font ink and default TextPrimitive color, white particle ink and matching alpha/UVs, omitted-tint parity with explicit dark gray, explicit non-palette RGB and RGBA overrides, transparent cells and generated/packed asset availability. Native tests exercise actual tint forwarding; real-client checks establish appearance, alpha and arbitrary tint fidelity. This is a specification update, not evidence of implementation or visual acceptance.

## Future runtime epics recorded by MineCraft-w82n.6

Created November 18, 2026 by `MineCraft-w82n.6`: three separate top-level future runtime epics, 42 implementation/packaging/native/client children, all open. These are separate from the planning-only w82n parent. Hierarchy and the listed child-level blocking prerequisites are recorded. `MineCraft-w82n.7` wires these edges and publishes coordinated ordering; `.8` owns final coverage/parity validation. Creation is not implementation, native feasibility or real-client acceptance.

| Runtime epic | Responsibility | Children |
| --- | --- | --- |
| `MineCraft-3w2z` | Own optional upstream Ink adaptation, qualified portable layout, Display host, renderer-facing virtual IO/input/focus, supported components/hooks and Input/Scrollback/view-only Shell. Reuse shared React and existing Canvas/display assets. VM owns actual accounts/process/parser/services and real Shell binding. Standalone Ink does not wait for VM or Window. | 12 open |
| `MineCraft-glcb` | Own independent roots/handles, shared-frame binding, external stores/useSyncExternalStore, typed directional events, audience/focus/error isolation and disposal/explicit consumer reconstruction. Reuse shared React/Canvas geometry; no Ink/VM or automatic persistence requirement. | 10 open |
| `MineCraft-q4r0` | Own VM service contracts, per-machine durable data/accounts/permissions, qualified credential handling, scoped world IO, processes/streams/parser/coreutils, authenticated input/session binding, actual hybrid keyboard/text adapters, Ink shell integration and canonical VM constructor/restoration. Shared display/React/Ink components and Canvas identity/frames remain with their existing owners. | 20 open |

The complete actual child-ID tables and wired prerequisite mappings are in [Ink/Window tracking](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM tracking](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). Existing foundations retain the implementation owners assigned by w82n.5; the `.6` creation step delivered no runtime code or blocking edges; `.7` now records child-level blockers and ordering.

## Wired runtime implementation order (MineCraft-w82n.7)

The 42 Ink/Window/VM child deliverables now have the exact blocking prerequisites listed in the [Ink/Window tables](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM table](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). The [coordinated branch order and topological waves](Bedform_Terminal_Canonical_Plan.md#coordinated-implementation-order-minecraft-w82n7) show parallel foundations and runtime integration. Parent epics use nonblocking see-also links, not whole-epic gates. No runtime work or acceptance is completed by dependency wiring.
