# Amnesia-style PhysicsEntity grabbing

## Summary

Add opt-in grabbing to `bedform`, assuming the planned physics modules and spatial math additions are complete.

Players interact with a physics entity using an empty hand to toggle grabbing. Grabbed bodies spring into a position directly ahead, follow player movement and viewing direction, and retain collision. Holding sneak rotates the body through look input; double-tapping sneak throws it.

Held, manually rotated, dropped, and thrown bodies retain the [physics plan's shared visual interpolation](Bedform_Physics_Initial_Plan.md#visual-interpolation-between-physics-ticks): one common root bone offsets both location and full rotation, lerping from the previous pose to the next computed endpoint over the 50 ms between ticks. Reuse existing bones and their hierarchy; add a trivial root only when the representation otherwise has no bones, with a common parent used where multiple roots need grouping. This applies to cuboid models and CLI-generated particle models alike.

Use the agreed defaults: center-of-mass pivot, size-based holding distance, camera position following the player during rotation, and add-on-controlled eligibility without a built-in mass limit.

## Public API and integration

- Export a pure `PhysicsGrab` namespace from the root and matching subpath. Provide validated configuration, immutable session transitions, spring calculations, and typed failures using `effect-bedrock`, `Option`, `Result`, and applicable `dual` overloads.
- Reuse the shared math `Transform` for visual model-origin poses and `RigidTransform` for motion-bearing body/target snapshots. RigidTransform linear velocity belongs to its own origin. A COM-target RigidTransform therefore has its position at COM; a model-origin body snapshot converts with `vOrigin = vCOM + cross(angularVelocity, origin - COM)`. Never mix a model-origin position with COM velocity under the RigidTransform type.
- Keep springs, manual rotation, impulse application and separation checks at the authoritative COM, with world-space angular velocity in radians/second. Consume the existing shared Plane/AABB/OBB/Ray/ConvexHull types for bounds and static query helpers where required, without creating a second collision or selection system. Empty-hand entity-interaction acquisition remains unchanged; this update does not replace it with ray selection.
- Add explicit startup through `bedform/PhysicsGrabRuntime`. Startup accepts the physics runtime, configuration, a required `canGrab(player, body)` predicate, and optional lifecycle/error callbacks. Return a handle providing held-body inspection, drop, throw, and idempotent disposal.
- Keep subscriptions and Bedrock imports outside the pure surface. Reuse the physics runtime’s fixed substeps, body lookup, mass properties, force/torque operations, and lifecycle handling. Add narrow integration hooks where needed instead of running a separate simulation.
- Reuse the physics runtime's committed pose-interval stream and common-root renderer; grabbing must not set visual bones, reposition particle faces, or run a second interpolation clock. Preserve the shared linear 50 ms progress for position and shortest-path normalized quaternion rotation lerp, native-origin compensation, coherent endpoint synchronization, and lifecycle resets. The one-tick visual buffer does not delay authoritative input, impulses, ownership, contacts, or spring/separation checks.
- Enforce one held body per player and one holder per body through authoritative physics-runtime ownership. Reject static, kinematic, unavailable, or already-held bodies.
- Preserve package versions and repository conventions, including TSDoc, extracted nested interfaces, and centralized script-owned identifiers.

## Interaction and physical behavior

**Acquisition and release**

- Subscribe to `beforeEvents.playerInteractWithEntity`. Accept only interactions whose `itemStack` is `undefined` and whose target resolves to an eligible `PhysicsEntity`.
- Cancel accepted native interactions, schedule mutations into writable execution, and revalidate player, hand, target, eligibility, and ownership before committing.
- While holding, another accepted empty-hand interaction with the held entity drops it. Other targets cannot replace the held body.
- Check interaction repetition on the target engine before completing this adapter. A sustained Use press must not cause repeated grab/drop toggles. If independent activations cannot be distinguished reliably, report an integration blocker instead of inventing release detection or silently changing controls.
- Release when the main hand becomes occupied, the player dies/leaves/respawns/changes dimension, the body becomes unavailable, the simulation pauses, or the owning runtime stops. Grips are transient and are never restored from saved body state.

**Holding and spring response**

- Capture the body’s orientation relative to the player’s viewing frame. Preserve that relative orientation during ordinary movement and looking, updating it after manual rotation.
- Place the target COM directly along the viewing axis. Compute distance as `max(1.25, enclosingRadius + 0.75)` blocks, using a conservative COM-centered radius covering visible geometry and collision bounds. Keep this distance stable during the grip.
- Start the acquisition reference at the body’s actual COM, then spring it toward the centered position. This prevents an initial snap or immediate separation failure for an off-axis body.
- Apply a gravity-compensated positional spring at COM and a quaternion angular spring using the full inertia tensor. Account for target velocity, angular velocity, and the physics substep duration. Keep the body dynamic with terrain, body, and native-entity collisions active.
- Use default response frequency `10 rad/s` and damping ratio `0.9`. Scale frequency by `clamp((mass / 1 kg)^-0.05, 0.85, 1.15)` for a slight mass effect. Expose these tuning values as validated configuration.
- Bound commanded linear/angular acceleration, defaulting to `80 blocks/s²` and `40 rad/s²`. Never teleport the body or disable collision to satisfy a grip.
- Drop when actual COM is more than the configurable separation limit from its commanded spring reference; default `1 block`. Evaluate during substeps so walls and narrow spaces cause prompt release. Acquisition smoothing must not extend indefinitely or bypass this check.
- Dropping removes grab forces and ownership while preserving current linear and angular velocity.
- Keep acquisition/spring smoothing separate from visual interpolation. The spring controls authoritative substep motion; the renderer only lerps its published model-origin pose endpoints. Evaluate collision and separation against the actual COM, never the visually buffered pose. Ordinary grab/drop, entering or leaving manual rotation, and throwing continue the existing visual stream without resetting its root offsets or snapping to the spring target. Explicit teleports, dimension changes, restoration, skipped pose sequences, and disposal use the physics interpolation reset/cleanup contract.

**Sneak rotation and throwing**

- Subscribe through `bedform/World`: `world.afterEvents.playerButtonHold` filtered to `InputButton.Sneak` with the default six-tick `holdTicks`, and `world.afterEvents.playerButtonNTap` filtered to `InputButton.Sneak` with `count: 2` and the default five-tick press/gap limits. Discard gesture progress when a grip starts or ends by ignoring that player's events whose sequence began before the grip boundary; a cancelled hold `End` (leave, death, respawn, dimension change or unavailable input) ends rotation like a release.
- On rotation start, save the viewing direction and activate a free camera at the player’s eyes. Follow eye position while keeping the displayed direction fixed. Leave look input enabled.
- Each tick, convert look deltas into incremental quaternion rotations about the frozen view’s up/right axes, at 1:1 sensitivity. Accumulate rotations around COM. Reset the hidden player rotation to the saved direction after sampling, avoiding pitch-limit exhaustion.
- On sneak release, preserve the updated relative object orientation, restore player direction, and clear the camera. Perform the same cleanup on every cancellation path.
- Double-tap sneak releases the body and applies one forward impulse at COM: default `10 kg·blocks/s`, configurable independently of mass. Preserve existing velocity and add no artificial spin; heavier bodies therefore receive less added speed.
- Verify camera behavior on clients. Bedrock documents that free-camera input continues to control the player, while raw input currently exposes Jump and Sneak. Document touch-sneak limitations. [Camera behavior](https://learn.microsoft.com/en-us/minecraft/creator/documents/cameracommandintroduction?view=minecraft-bedrock-stable), [input limitations](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputbutton?view=minecraft-bedrock-experimental)

## Validation and delivery

- Test spring convergence, acquisition centering, moving targets, mass variation, COM overrides, inertia-sensitive rotation, quaternion wrapping, and preserved release momentum.
- Test wall obstruction, oversized bodies, rotation against terrain, excessive separation, ownership contention, and rejection of ineligible bodies.
- Test empty-hand toggling, sustained/repeated interaction events, hold/double-tap boundaries, stale gesture cancellation, exactly-once throws, camera cleanup, callback failures, and startup rollback.
- Test that grabbing reuses the common-root pose stream without adding visual subscriptions/clocks or feeding interpolated poses into spring forces, COM pivots, collision, or separation release. Require real two-player cuboid client evidence of intermediate position/rotation frames throughout acquisition, following, manual COM rotation, drop and throw, including off-center COM, angle wrapping, simultaneous movement/rotation, varied frame rates, and lifecycle resets. Validate the same cases with CLI-generated particle models once that renderer is available; track those combined cases downstream of both features without adding a reverse prerequisite. Verify there are no 20 Hz visual steps, double smoothing, per-face drift, reset snaps on ordinary grip transitions, or leaked roots/anchors.
- Extend declaration, packed-consumer, restricted-host, import-purity, build, typecheck, lint, and package tests. Document executable add-on integration and tuning examples.
- Use isolated physics-runner BDS fixtures and the fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe` path. Require real two-player client evidence for grabbing, rotation, camera restoration, collision, and multiplayer synchronization; automated tests alone do not satisfy those checks.
- Validate COM-target versus model-origin RigidTransform snapshots, explicit velocity conversion and off-center rotating bodies. Visual endpoints remain pose-only Transform values and continue the existing 50 ms common-root stream without velocity-driven prediction or alternate interpolation.
- Track implementation in the existing `MineCraft-53o` epic, dependent on `MineCraft-ner` and `MineCraft-8zu`, with this specification saved as `Plan/Bedform_PhysicsEntity_Grabbing_Plan.md` and embedded in the epic. Keep self-contained children for interaction feasibility, spring behavior, camera/gestures, and validation. Track combined particle-model grabbing/interpolation evidence in the separate integration issue `MineCraft-opl`, downstream of both completed features, so neither core epic depends on its own integration validation.
- No live-world installation, commits, pushes, or remote Dolt synchronization.
