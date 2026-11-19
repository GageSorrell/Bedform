# Bedform Diagetic Gizmo

Beads epic: `MineCraft-74ii`.

## Summary

Add `Diagetic.Gizmo` for item-driven editing of location, rotation, and scale on developer-defined targets, including entities, entity parts, and block-backed objects.

Use local coordinates exclusively. Support axis handles, translation planes, camera-plane free translation, and uniform scaling. Default to direct manipulation, shared live preview, stationary players during dragging, and immediate commit on release. Physics, snapping, guides, transform cycling, private previews, and confirmation review are configurable.

Use the release-compatible experimental Script API for native [TextPrimitive](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/textprimitive?view=minecraft-bedrock-experimental) support. Preserve current runtime compatibility for existing controls.

## Public API and architecture

- Expose `Diagetic.Gizmo` through both existing Diagetic import forms, plus `bedform/Diagetic/Gizmo`. Provide inert `Make` definitions and an explicit `Start` runtime with disposal, following existing Bedform conventions.
- Keep Gizmo's transform and transaction model separate from the existing scalar lever/slider/wheel model. Reuse ownership and permission-recovery infrastructure without changing existing control persistence or toggle behavior.
- Definitions associate custom item identifiers with enabled transform types, target discovery, eligibility, and editing policies. Require at least one enabled type; use its configured order for cycling and initial selection.
- Define a generic target adapter providing a stable target key, validity, target-body hit testing, local transform, parent-to-world frame, and transform application. Provide resolution by stable key for recovery. This supports arbitrary developer-owned objects without assuming native support for entity roll, bone transforms, or block scaling.
- Represent editable transforms with position, quaternion orientation, and component scale. Positions use blocks internally; rotations use existing Bedform conventions. Provide continuous degree channels for rotation constraints without normalizing away complete turns.
- Expose synchronous preview, commit, cancel, and abandonment callbacks with original/current transforms, player, target, mode, selected handle, and reason. Support a custom text formatter.
- Default shared preview applies provisional transforms through the adapter. Private preview requires developer-supplied player-specific preview creation, update, and disposal hooks; the actual target changes only on commit. Reject incomplete private-preview configurations.
- Supply an item-component build helper and examples using long-duration `minecraft:use_modifiers` with `start_using: "always"`. Use native item-start/stop-use events, with repeated-event suppression and stale-release fencing.
- Inject the experimental text constructor and manager through a typed presentation adapter. Keep native imports out of inert public modules and avoid forcing Bedform Common's existing runtime onto beta dependencies.
- Bedform Common owns shared rendering resources, localized prompts, cross-pack ownership coordination, and tutorial persistence. Use a versioned request/response contract with acknowledgments and session tokens.

## Interaction and editing behavior

- Show one focused gizmo per player while holding a capable item, within configurable range and sufficiently near the target in their view. Default to a 3-block interaction range and a 15-degree targeting allowance around the target's bounds. Occluded targets are ineligible by default.
- Resolve overlapping candidates by nearest positive view-ray hit, then angular proximity and distance. Hit-test the actual handle geometry separately from the broader target focus region.
- Use Unreal-style translation arrows, rotation rings, and scale handles, following the [Unreal transform-tool reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/transforming-actors?application_version=4.27). Map local X/Y/Z to red/green/blue while retaining Minecraft's Y-up coordinates.
- Holding Use over a handle begins dragging. The camera follows normal aim; the selected handle remains captured as the crosshair moves away. Capture local axes at each drag's start, then refresh them between drags.
- Support translation along axes, within local planes, and within the camera plane. Support axis rotation and axis, plane, and uniform scaling. Use analytic ray projection, continuous angle unwrapping, and stable handling of nearly parallel views; invalid projections retain the last valid result.
- Lock walking during dragging by default and restore the exact prior permissions on release. Allow concurrent walking as an option; its TSDoc must warn that it is recommended only for edits large relative to the player and can feel slightly janky compared with holding position.
- Physics is disabled by default. Optional weighted motion reuses existing fixed-step techniques. Freeze on release by default; optional coasting enters a settling state before review or automatic commit. Explicit commit/cancel stops coasting immediately.
- Snapping defaults off, with configurable increments per transform type and absolute or edit-relative origins. Apply snapping before final bounds enforcement; bounds always win.
- Support inclusive per-axis min/max bounds on actual values and, optionally, changes relative to the whole edit's original transform. Actual values are interpreted in the adapter's declared parent frame. Preserve one original snapshot through all resumed drags and mode changes.
- Scale defaults to a minimum of `0.001` on each component. Explicit configuration may permit zero or negative scale. Avoid division-based scale calculations that fail when zero is allowed.
- Transform cycling defaults off. When enabled, each Sneak press while Use is held advances through enabled types. End the current drag segment, retain its changes, and wait for a valid handle in the new mode before beginning another rebased drag.

## Presentation, review, and lifecycle

- Generate player-private, short-lived blended particle geometry in Bedform Common for handles and guides. Share geometric definitions between rendering and hit testing. Keep refresh opacity stable, bound rendering work, and avoid collidable helper entities.
- Make hovered handles slightly brighter and more opaque; retain the axis color. Gizmo size and targeting tolerances are configurable.
- Enable floating measurements by default. Use one editor-only `TextPrimitive`, with `depthTest: false`, billboard orientation, and an explicit player visibility list. Update it during dragging and optional settling, then remove it.
- Default measurements describe the current drag: signed axis translation, displacement magnitude for plane/free translation, signed rotation angle, and scale multiplier. Plane scaling may show labeled component multipliers.
- Format translation as integer `cm`, optionally one decimal place; rotation as integer degrees with `°`; and scale as `×1.00`, supporting zero through three decimal places. Normalize negative zero and separate values from measurement units.
- Guides default off. Translation shows an axis beam; rotation shows original/current spokes and the swept arc; scaling shows original/current extents and a connecting ruler. Draw distinct endpoint markers at configured finite limits, including angular stops and scale-bound markers.
- Confirmation review defaults off. When enabled, releasing Use restores walking and enters review after any coasting. Use on a handle resumes dragging; Use on the target body outside handles commits; Sneak + Use on the target or gizmo cancels.
- Always display review instructions, regardless of tutorial completion. Include the remaining timeout, rounded up to seconds, when configured.
- Abandonment supports timeout, distance, held-item change, death, disconnect, dimension change, target invalidation, runtime disposal, and developer predicates. Provide a global commit/cancel outcome plus per-reason overrides. Default to cancel with no timeout.
- Evaluate simultaneous abandonment reasons together. If resolved outcomes conflict, cancel wins; report all matched reasons. Never recreate an invalid target to satisfy a commit.
- Keep one player and one underlying target exclusively claimed throughout dragging, settling, and review, including private previews. Use session tokens to fence delayed messages and callbacks.
- Journal original/provisional transforms and permission changes before applying them. On reload, restore player permissions and cancel interrupted edits, deferring target restoration until the target becomes available. Preserve unresolved receipts and prevent conflicting reacquisition. Adapter failures must not bypass cleanup.
- Store tutorial progress in Bedform Common per player, per world. Aggregate successful transform changes and time spent holding Use in interaction mode across all add-ons. Permanently suppress the tutorial after both three changes and 15 seconds, or immediately after Jump dismissal.
- Use this two-line tutorial, with localized input icons:

  ```text
  §fPress :_input_key.sneak: to change transform type. Release :_input_key.use: to stop editing.
  §o§7Press :_input_key.jump: to dismiss this notification.§r
  ```

## Validation and delivery

- Create Beads implementation work before editing code; preserve existing unrelated changes. Follow repository headers, TSDoc, nested-type, identifier-key, and generated-output conventions.
- Test projection and handle selection, rotated parents, angle wrapping, parallel views, bounds, snapping, scale through zero, text precision, physics, coasting, and rebasing without jumps.
- Test transaction transitions, resumed edits, private-preview isolation, competing players/add-ons, simultaneous abandonment, callback failures, stale events, disposal, and restart recovery.
- Verify tutorial aggregation across two independent add-ons, both threshold requirements, permanent Jump dismissal, and persistence across restart.
- Run Bedform verification, Bedform Common checks, affected demo checks, and packed-consumer tests covering inert imports and stable consumers without Gizmo.
- Extend the isolated Diagetic demonstration with entity-part and block-backed targets, shared/private preview, limits, guides, snapping, physics, review, and abandonment examples.
- Run native tests through the add-on's fixed `dist/bds-runtime/bedrock_server.exe`, without elevation or production deployment. Verify the experimental text adapter on BDS 1.26.63.1 using matching beta typings.
- Require physical mouse/controller and multiplayer acceptance for drag feel, transparency, visibility, input icons, review targeting, and permission restoration. Resolve remaining Unreal appearance questions during implementation, as requested.
