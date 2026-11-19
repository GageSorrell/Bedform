# Add `bedform/Diagetic` controls

## Summary

Add entity-based levers, sliders, and wheels, with shared content in BedformCommon and CLI scaffolding. Preserve the requested spelling `Diagetic`.

Use toggles interaction: the first press grabs the targeted control, and the next press releases it. While grabbed, freeze movement and the displayed camera, read mouse/right-stick rotation deltas, and display exactly:

```text
§o§7Press §e:_input_key.use: §o§7to let go.§r
```

Buttons are excluded. Custom controls receive low-level hooks; a branched-path solver is excluded.

## Public API and interaction runtime

- Export `Diagetic` from `"bedform"` and publish `"bedform/Diagetic"`. Keep imports inert and free of native runtime imports so Node tooling can import the package.
- Provide `Make` with a discriminated configuration, plus `Lever`, `Slider`, and `Wheel` convenience constructors. These create reusable control definitions without spawning entities.
- Definitions expose `Spawn(dimension, location, options)` and `Attach(entity)`. Preserve native `SpawnEntityOptions`, with additional initial value, model pose, optional block binding, and entity-initialization callback.
- Provide explicit `Start({ World, System, Controls })`, returning a disposable runtime. Generated consumer scaffolds export definitions for registration; BedformCommon registers its three built-in definitions in its own entrypoint.
- Configuration includes sensitivity, inertia, damping, friction, limits, detents, return springs, interaction range, eligibility, and callbacks for grab, value change, release, and cancellation. Handles expose the native entity, current value, programmatic value updates, and removal.
- Defaults: levers settle at either endpoint, sliders retain their released position, and wheels rotate continuously without end stops. All remain configurable.
- Reuse LookInputDemo's eye-anchored camera capture, unchanged FOV, rotation-delta measurement, recentering, correction-gap estimates, first-person presentation, and activation-rotation restoration.
- Allow one player per control and one control per player. Claim ownership before changing camera or permissions. Restore saved permissions and release ownership on cancellation, errors, death, respawn, disconnect, dimension change, entity loss, or runtime disposal.
- Persist control values and block bindings across unloading/restarts. Persist recovery information before locking the player; never restore an interrupted grab as an active session.

### Input and simulation

- Project look deltas through the frozen camera frame into the control's local interaction plane. Levers follow their handle arc; sliders follow their track.
- Wheels integrate a virtual pointer around the projected hub and derive rotation from signed angular motion. Include a central dead zone; straight horizontal dragging must not act as unrestricted wheel rotation.
- Apply weighted motion at a fixed simulation timestep, respecting limits and preventing unstable or non-finite state. Continue settling after release when inertia or springs require it.
- Expose custom-control hooks for acquisition, look samples—including whether they are estimated—simulation, state persistence, pose publication, and release. Include a small custom-control example demonstrating these hooks.

### Toggle capture gate

User override: assume `playerInteractWithEntity` works for both starting and stopping
interaction. `.1` is resolved on that explicit assumption; missing physical targeting
or repeat traces do not block `.4`. Retain physical mouse/controller verification
in the later acceptance work. Do not require a helper based on the simulated
player's head-ray targeting result. The original qualification guidance below is
retained as diagnostic context, subordinate to this decision.

- First verify repeated entity-interaction behavior and second-Use delivery while underlying player aim diverges. Entity interaction events do not expose an initial-press flag in the installed API.
- Use a temporary, invisible, session-owned interaction helper when necessary. Keep inventory unchanged, suppress held-input repeats, and remove helpers during every cleanup/recovery path.
- Require native/client evidence that helpers neither obstruct other players nor trigger unrelated block/item actions. If reliable capture cannot satisfy these requirements, report the engine blocker before proceeding with dependent integration.

## Shared content, mounting, and CLI

- Add functional `bedform:diagetic_lever`, `bedform:diagetic_slider`, and `bedform:diagetic_wheel` entities to BedformCommon, including behavior, geometry, animation, render controllers, localization, and interaction-helper/camera assets.
- Use synchronized entity properties to animate moving parts for all viewers. Shared assets support controls mounted on all six block faces and freely positioned controls.
- Lever: retain the vanilla lever's proportions and materials, splitting the base around a central channel that clears the handle's sweep.
- Slider: use a vanilla-button-shaped knob with its longer side along a narrow raised track.
- Wheel: use a blocky, vanilla-style rim and spokes with an outer diameter of **0.5 blocks / 50 cm**.
- Prefer existing vanilla texture paths so resource packs can override them naturally. Add dedicated textures and matching Trailers Vision variants only where existing mappings cannot produce the required result. Preserve the resource pack's frozen baseline.
- Optional block bindings record dimension, block position, face, and expected block type. Remove controls when observed break/replacement events invalidate the binding or loaded-block checks find the support missing or changed. Ordinary state changes retain the binding.
- Extend BedformCommon's independent builder to bundle its runtime without invoking the Bedform CLI. Update common-artifact validation for its script module and native dependency, preserving pack UUIDs and automatic consumer bundling.
- Preserve LookInputDemo's standalone behavior and regression coverage.

Add:

```sh
bedform add diagetic <name> --kind lever|slider|wheel
```

- Require both arguments; reject `button`, invalid identifiers, duplicate options, and existing output files.
- Accept a namespaced entity identifier. For a bare name, derive the namespace from the unscoped project package name, normalized to a valid Bedrock namespace.
- Resolve packs from existing configuration/conventions. Add `--behavior-pack` and `--resource-pack` selectors for ambiguous projects; fail with actionable diagnostics when selection remains ambiguous.
- Generate behavior JSON, client-entity JSON referencing shared assets, localization, and `Script/Diagetic/<PascalName>.ts`.
- The TypeScript scaffold imports `import { Diagetic } from "bedform";`, calls `Diagetic.Make`, exports the definition, and includes callback/configuration examples.
- Print the registration and spawn snippets needed by the project's entrypoint. Do not silently rewrite existing startup code.
- Validate all outputs before writing and roll back newly created files on failure.

## Validation and delivery

- Test projection, reversed/rotated mounting, limits, detents, damping, springs, settling, wheel seams/dead zones, and rejection of non-circular wheel input.
- Test ownership conflicts, callback failures, partial activation rollback, helper cleanup, interrupted-session recovery, saved values, and block-binding removal.
- Test CLI generation for every kind, ambiguous packs, collisions, invalid input, rollback, and generated TypeScript compilation.
- Extend packed-consumer tests to cover both import forms, inert Node imports, generated scaffolds, shared asset references, and reproducible common archives.
- Run Bedform verification, BedformCommon checks, LookInputDemo regressions, and affected Trailers Vision checks.
- Add isolated native tests through a fixed `dist/bds-runtime/bedrock_server.exe`. Prepare a playable demonstration covering all three controls, mounting orientations, configurable drag, and multiplayer ownership.
- Keep physical mouse/controller feel, camera handoff, helper behavior, and visual acceptance as explicit client gates; simulated input cannot establish those results.

Before implementation, claim the applicable Beads entries below. Follow repository documentation, generated-header, identifier-key, and version conventions. Preserve existing uncommitted work. Production deployment, commits, pushes, and remote synchronization are excluded.

## Beads implementation entries

Epic: `MineCraft-b2bb` — Add bedform/Diagetic entity controls.

| Entry | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-b2bb.1` | Qualify toggle Use capture on the stable engine | — |
| `MineCraft-b2bb.2` | Inert definitions, public constructors, spawn/attach handles and runtime contracts | — |
| `MineCraft-b2bb.3` | Weighted lever, slider and circular-wheel simulation | `.2` |
| `MineCraft-b2bb.4` | Camera/look capture, qualified toggle bridge and recoverable sessions | `.1`, `.2` |
| `MineCraft-b2bb.5` | Persistent control values and optional block-face bindings | `.3`, `.4` |
| `MineCraft-b2bb.6` | Low-level custom-control hooks and example | `.3`, `.4` |
| `MineCraft-b2bb.7` | Functional BedformCommon controls, shared assets and independent packaging | `.3`, `.4`, `.5` |
| `MineCraft-b2bb.8` | CLI scaffolding and generated-module integration | `.2`, `.7` |
| `MineCraft-b2bb.9` | Vanilla/Trailers Vision texture integration where needed | `.7` |
| `MineCraft-b2bb.10` | Installed-consumer/package verification and documentation | `.6`, `.7`, `.8`, `.9` |
| `MineCraft-b2bb.11` | Native lifecycle and physical-client acceptance/demo | `.10` |

Dependencies abbreviated as `.N` refer to children of `MineCraft-b2bb`. Beads is the source of truth for task status; this document is the implementation specification. The epic must remain open until required native and physical-client acceptance gates are complete.
