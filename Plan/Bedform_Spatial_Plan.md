# Bedform adaptive spatial anchors and text

## Summary

Add `bedform/Spatial`, `bedform/Spatial/AdaptiveAnchor` and `bedform/Spatial/AdaptiveText`, plus a `Spatial` namespace export from `bedform`.

A shared runtime will maintain player-specific anchors around targets. Adaptive text will own an adaptive anchor and apply a content-aware offset to a separate `TextPrimitive` for each relevant player.

### Shared spatial organization

This adaptive-anchor feature (`MineCraft-ys8v`) remains independently tracked. Coordinate `Spatial` exports/runtime ownership with the [React plan](Bedform_React3D_Plan.md) and [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md), without making display, Ink or Window delivery wait for adaptive anchors. `bedform/Spatial/React` is the single React/hooks/JSX port; bare `bedform/Spatial/Terminal/Display` starts no React, Ink or VM. Canonical display and VM constructors are distinct, and `bedform/Spatial/Window` owns runtime React roots with consumer persistence snapshots rather than automatic application restoration. Canvas owns shared terminal/spatial assets and canonical entity/persistence support; unrelated imperative DDUI/control assets stay in Common. This organization note is a document-only revision under `MineCraft-w82n.2` and supplies no implementation or client evidence.

## Public API and lifecycle

- `Spatial.Start({ World, System, TextPrimitive?, OnError? })` creates the shared runtime. Inject the native constructor explicitly, preserving Bedform's inert imports and compatibility with host tests.
- `Spatial.Entity(entity, options?)`, `Spatial.Block(block, options?)` and `Spatial.Custom(read)` create target adapters.
- Custom readers synchronously return a dimension, `Transform.Coordinates`, and bounds, or `undefined` while unavailable. Bounds accept a local `AABB.Coordinates` or a nonnegative sphere radius centered at the transform's origin.
- Entity adapters use current native collision bounds and pose; block adapters use a unit cube centered on the block. Both allow authored bounds overrides. Native entity AABBs remain world-aligned and are never rotated twice; custom local boxes follow their supplied transform.
- `AdaptiveAnchor.Make(runtime, options)` returns a managed handle. Its frozen `Snapshot` contains matching readonly `Players` and `Positions` arrays, ordered by player ID. Positions are immutable Bedform `Vector3` values. `Get(playerOrId)` returns `Option<Vector3>` from the current snapshot.
- `AdaptiveText.Make(runtime, options)` returns a handle exposing its owned `Anchor`, a snapshot of rendered text positions, `Get`, `SetText` and `Dispose`.
- Disposal is idempotent. Disposing text also disposes its anchor; disposing that owned anchor disposes the text. Runtime disposal releases every owned handle and the shared ticker.

Use one configurable update interval, defaulting to every tick. Sample each player's view once per update and each shared target once, then publish complete snapshots atomically.

## Anchor placement

- Relevant players default to the same dimension, within 32 blocks of the target's bounds, with those bounds intersecting the configured view envelope. Allow an audience provider and relevance predicate override; dimension isolation always applies.
- Default views use `getHeadLocation()` and `getViewDirection()`. Support a view-provider override for custom cameras. Use configurable projection assumptions, defaulting to a 70-degree vertical field of view and 16:9 aspect ratio.
- `PreferredLocation` accepts `"left"`, `"right"`, `"above"` or `"below"`, interpreted in each player's view. Default to `"above"`.
- Project the target's bounds into the player's view. Generate candidates outside each projected edge, with a configurable clearance defaulting to 0.15 blocks.
- Prefer the requested side when it fits. Otherwise rank candidates by target overlap, viewport clipping, preferred-side match and distance from gaze, in that order. Resolve ties deterministically.
- Retain the current side while it remains suitable; require five consecutive suitable updates before returning from a fallback to the preferred side. Smooth movement along the same edge, rechecking clearance after smoothing. Snap between sides rather than interpolating across the object.
- Handle near-plane crossings, overhead views, zero-size bounds and players inside bounds without nonfinite coordinates. Omit a position when no finite placement exists.
- Default to the least obstructive available candidate when none fits completely. `HideUntilFits: true` suppresses that player's placement until a complete fit is available.

Placement is independent per target. Collision avoidance between different labels is outside this version.

## Adaptive text

- Accept a string, native `RawMessage`, or synchronous per-player content callback.
- Estimate text width and height from visible characters, line breaks, formatting and scale, including background clearance. Use documented approximate metrics at scale 1: 0.15 blocks per ordinary character and 0.25 blocks per line, with wider Unicode characters counted conservatively.
- Recursively estimate literal `RawMessage` fragments. Use a documented conservative placeholder of 32 characters across two lines for unresolved translations, selectors or scores. Expose a fixed `Size` override and a `MeasureText` callback; both return dimensions at scale 1.
- Feed estimated text dimensions into candidate selection. Keep the underlying anchor at the target's projected edge plus clearance, then offset the text outward by its relevant half-width or half-height.
- `Offset` accepts a world-space vector or a callback receiving the player, view, target snapshot, anchor, selected side, estimated dimensions and suggested offset. An explicit offset replaces the automatic offset and may intentionally override its clearance.
- Keep native billboarding enabled and default `DepthTest` to true. Expose scale, color, background and depth-test options. Native text supports camera-facing rendering and depth testing. [Minecraft TextPrimitive documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/textprimitive?view=minecraft-bedrock-stable)
- Configure each primitive's dimension and `visibleTo: [player]` before adding it. Update existing primitives in place. Remove inactive primitives rather than assigning an empty audience, which would expose them to everyone. [Minecraft PrimitiveShape documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/primitiveshape?view=minecraft-bedrock-stable)
- Remove owned primitives on lost relevance, disconnect, dimension change, unavailable target or disposal. A hidden or failed text primitive does not remove an otherwise valid entry from its owned anchor's snapshot.
- Validate static configuration synchronously. Isolate dynamic provider and native-operation failures to the affected handle/player, report them through `OnError`, and retry on subsequent updates. Never clear unrelated primitives when capacity is exhausted.

## Validation and delivery

- Test projection and placement for rotated boxes, spheres, all preferred sides, opposing viewers, moving targets, gaze changes, clipping, near-plane cases, fallback stability and `HideUntilFits`.
- Test snapshot alignment, immutable vectors, identity lookup, relevance overrides, shared sampling and complete cleanup.
- Test multiline/formatted text, Unicode, dynamic content, unresolved `RawMessage` estimates, scale, measurement overrides and offset callbacks.
- Use a native-shaped harness to verify private visibility before registration, dimension assignment, in-place updates, capacity failures and disposal.
- Extend packed-consumer and declaration tests for all three subpaths and root exports. Verify imports create no timers or subscriptions and introduce no native runtime imports.
- Run `npm run verify --workspace bedform`. Add a native smoke fixture using Bedform's existing fixed `dist/bds-runtime/bedrock_server.exe` design; verify primitive creation, movement and removal without touching production worlds.
- Document examples and the limits of estimated text dimensions and assumed camera projection. Keep physical-client readability acceptance distinct from automated evidence.
- Create Beads tracking before implementation. Follow repository headers, extracted nested interfaces, PascalCase constants and symbol-level `@since 1.0.0`. Preserve existing unrelated changes and package versions.

## Implementation boundaries

This document records the agreed specification on November 14, 2026. Saving the plan and creating Beads entries does not implement the modules or establish test or visual acceptance. Implementation and physical-client acceptance issues remain open until their own evidence exists. No production deployment, git commit, git push or remote Dolt synchronization is part of this planning delivery.

## Beads implementation mapping

Epic: `MineCraft-ys8v` - Add Bedform Spatial adaptive anchors and text.

Beads is the source of truth for task status. Each child contains its own goal, acceptance criteria and a copy of the agreed specification; implementation does not require this document or the original conversation to remain available.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-ys8v.1` | Shared contracts, runtime and target adapters | None |
| `MineCraft-ys8v.2` | Pure projection and adaptive placement | `.1` |
| `MineCraft-ys8v.3` | Managed per-player anchor handles | `.1`, `.2` |
| `MineCraft-ys8v.4` | Text content estimation and offset layout | `.3` |
| `MineCraft-ys8v.5` | Private native text rendering and lifecycle | `.4` |
| `MineCraft-ys8v.6` | Public exports, documentation and automated/native qualification | `.1`, `.2`, `.3`, `.4`, `.5` |
| `MineCraft-ys8v.7` | Separate physical-client readability acceptance | `.6` |

Short dependency identifiers in the table use the `MineCraft-ys8v` prefix. The epic and all seven children were created open; no implementation or visual acceptance is claimed by this planning delivery.
