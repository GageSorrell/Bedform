# Bedform Cable simulation

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

Beads epic: `MineCraft-7r9`. Implementation status and dependencies are tracked in Beads.

## Summary

Add `bedform/Cable` for persistent, physically simulated cables and hoses, with configurable materials, geometry, attachments, impulses, vibration, and fluid effects.

Use a dedicated cable solver and client-side bone animations to interpolate between authoritative 50 ms simulation updates. The initial target is **16 active cables with 32 segments each**, including terrain collision. Players, entities, and other cables affect cables only through explicit API calls.

## Public API and behavior

- Follow Bedform's functional conventions: immutable public values, direct and curried operations, `effect-bedrock/Result` for failures, and `Option` for absent results.
- Export definitions, constructors, configuration, sampling, and physical operations through `bedform/Cable`. Keep engine integration in `bedform/Cable/Bedrock`; importing either module starts no subscriptions.
- Provide explicit runtime startup, spawning, updating, inspection, pause/resume, removal, and disposal. Runtime updates accept Cable operations rather than exposing mutable solver buffers.
- Creation accepts segment count, total rest length, outer radius, `4 | 6 | 8` sides, registered appearance or solid RGB color, dry mass, gravity, axial/compression/bending/torsional stiffness, damping, and failure and deformation limits.
- Use blocks as metres, seconds, kilograms, and impulses in N·s. Define axial and compression stiffness as force per unit strain in newtons; bending and torsional stiffness use N·m². Scale constraints by segment rest length so changing resolution preserves material behavior.
- Accept an initial world-space polyline, resampled to the requested segment count. Without one, initialize between attachments with slack matching the rest length; a cable with fewer attachments uses a supplied origin and optional direction.
- Provide `applyImpulseAtPosition`, `applyImpulseAtDistance`, and `applyImpulseAtFraction`. Positions and impulse vectors use world space. Position targeting projects onto the nearest segment; distance uses the current simulated path in blocks, while fraction uses `[0, 1]`. Distribute impulses between adjacent simulation nodes.
- Expose path samples, fragment information, strain, attachment errors, and typed break/diagnostic events. Invalid selectors return errors rather than silently clamping.

### Attachments and breakage

- Each end independently accepts no attachment, a world position, or a position plus orientation. Position-only attachments swivel; orientation also constrains fitting direction and twist.
- Add-ons update attachment values explicitly. Bedform does not discover or manage attached blocks or entities.
- Provide endpoint impulse and vibration operations. With a fixed attachment, drive the adjacent movable cable material while retaining the attachment constraint.
- Separate break thresholds from finite deformation limits. `maxStrain: Infinity` selects unbreakable behavior; finite stretch, compression, curvature, and twist limits still apply.
- Break at an interior joint between rendered segments. Split that joint into independent ends, retain material and momentum, and allow every resulting fragment to continue simulating under the same cable handle.
- Keep original segment indices stable. Path distances after breakage count material length in original order and exclude spatial gaps; optional fragment targeting removes ambiguity.
- For incompatible attachments, preserve the start attachment by default and report the simulated end's shortfall. Offer an explicit end-priority override. Apply the same priority when terrain or orientation constraints make both attachments infeasible.
- Require at least two segments, ensuring every cable has a possible break joint.

## Simulation, presets, vibration, and hoses

- Implement an [XPBD](https://matthias-research.github.io/pages/publications/XPBD.pdf) rod solver with node positions and segment orientation frames. Include separate extension/compression response, bending, torsion, damping, gravity, and attachment constraints.
- Start with four substeps and ten constraint iterations per tick. Use reusable internal buffers, deterministic ordering, bounded work, and transactional failure handling.
- Reuse Bedform's terrain shape resolver and cache, with swept capsule contacts covering segment interiors. Use a conservative circular collision radius for every visual side count. Missing terrain pauses the cable rather than treating unloaded blocks as air.
- Evaluate failure after the elastic solve and before protective hard-limit projection. Break constraints without adding an arbitrary explosion impulse.
- Persist physical state, attachments, fragments, appearance references, fluid settings, and vibration random state. Pause while unloaded, restore without elapsed-time catch-up, and recreate transient renderers. Incompatible saved records remain intact and produce diagnostics.

Provide overrideable constructors named `heavyMachinery`, `climbingRope`, `peripheralCable`, `powerCord`, `gardenHose`, `fireHose`, and `hydraulicHose`. Their initial material defaults are gameplay approximations:

| Preset | Radius, m | Dry kg/m | Axial stiffness, N | Bending stiffness, N·m² | Wall, m | Break strain |
|---|---:|---:|---:|---:|---:|---:|
| Heavy machinery | 0.030 | 4.0 | 500,000 | 10 | — | 0.05 |
| Climbing rope | 0.006 | 0.07 | 20,000 | 0.002 | — | 0.30 |
| Peripheral cable | 0.0025 | 0.025 | 1,500 | 0.001 | — | 0.10 |
| Power cord | 0.0045 | 0.15 | 6,000 | 0.01 | — | 0.10 |
| Garden hose | 0.010 | 0.13 | 5,000 | 0.01 | 0.002 | 0.25 |
| Fire hose | 0.025 | 0.40 | 40,000 | 0.10 | 0.003 | 0.15 |
| Hydraulic hose | 0.012 | 0.60 | 200,000 | 1 | 0.004 | 0.05 |

- Common constructor defaults: 4 m length, 32 segments, 8 sides, Earth gravity, damping of 1.5 s⁻¹, torsional stiffness half the bending stiffness, and compression stiffness half the axial stiffness—one tenth for climbing rope. Dry mass scales with length.
- Default hard stretch capacity is twice the preset break strain and remains unchanged in unbreakable mode. Default minimum bend radius is twice the outer radius; maximum twist rate is one turn per metre. Bend/twist break thresholds are optional and disabled by default.
- Vibration exposes bounded impulse magnitude, event rate, direction or cone, seeded randomness, and a configurable Beta distribution. Uniform parameters produce uniform shaking; skewed parameters make violent shakes rare. Correlation time and attack/release envelopes control gradual swelling versus sudden shaking. Multiple vibration sources have independent start/stop handles.
- Hoses accept wall thickness, fluid density and dynamic viscosity, fill fraction, gauge pressure, signed volumetric flow, and open/closed outlet state. Initially all hoses are empty and unpressurized.
- Simulate added fluid mass, pressure-induced tension/stiffening, viscous effects, bend momentum transfer, and open-outlet reaction using a consistent segment momentum balance. Pressure and flow remain caller-supplied; v1 does not solve hydraulic networks, pressure waves, or water hammer.
- On rupture, clear pressure and flow throughout the cable, retain configured fill, and emit a rupture event so the add-on can implement pumps, leaks, and draining. Hollow construction affects mechanics; visible fluid and detailed exposed wall interiors are outside v1.

## Assets, animation, and build integration

- Add a `Cable` section to shared JSON/TypeScript configuration for namespace, pack roots, and appearance registrations. Generate a typed virtual catalog at `generated/cable/catalog/appearances.ts`.
- Extend the existing build pipeline to support Physics and Cable catalogs together, preserve authored assets, and reject output collisions. Update configuration schemas, generated declarations, documentation, and standalone-configuration ambiguity checks.
- Register texture/material references and UV layouts at build time. Expose per-face UV rectangles and per-segment tiling; runtime length changes stretch the registered mapping. Solid colors use a generated white texture and tint.
- Generate exactly **one, three, or four cuboids per segment** for 4, 6, or 8 sides. Define radius as circumradius. For 6/8 sides, use rotated rectangular sections spanning opposite polygon edges, suppress internal faces, and keep end-cap appearance consistent.
- Render contiguous groups of up to four segments per helper entity, respecting Bedrock's [32-property limit](https://learn.microsoft.com/en-us/minecraft/creator/documents/introductiontoentityproperties?view=minecraft-bedrock-stable). Regroup at fractures; collapse unused geometry slots.
- Publish tagged complete endpoint/frame snapshots with sequence and reset markers. Latch complete snapshots on the client and interpolate shared endpoints over 50 ms using [per-frame Molang timing](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions/query_delta_time?view=minecraft-bedrock-stable).
- Derive segment position, direction, length, and roll from the interpolated centerline. Avoid independently interpolated rigid poses that pull neighboring segments apart. Hold the last valid pose during missing updates and settle on join, reset, fracture, or rebase.
- Implement and qualify the renderer first, including group boundaries and thin cables. Treat interpolation as presentation smoothing; it does not increase server interaction frequency or eliminate network delay.
- Apply repository TSDoc, nested-interface, frozen-key-record, and generated-header conventions. Use `@since 1.0.0`.

## Validation and delivery

- Create Beads implementation tasks before editing, covering rendering, solver/API, assets, persistence, fluid/vibration behavior, and acceptance.
- Test resolution-independent stiffness, damping, impulse momentum, all attachment combinations, moving/clamped fittings, infeasible anchors, break thresholds, fragment conservation, unbreakable limits, and terrain contacts along segment interiors.
- Test current-path targeting, fracture boundaries, deterministic vibration distributions/envelopes, fluid mass and force balances, zero-flow behavior, reversed flow, and rupture shutdown.
- Verify exact cuboid counts, polygon bounds, UV orientation, packet integrity, stale/skipped updates, resets, and boundary continuity using emitted animation expressions.
- Test restart/unload recovery, orphan cleanup, incompatible records, combined Physics/Cable builds, and an independently installed packed consumer.
- Run `npm run verify --workspace bedform` and extend the package's BDS fixture runner using its fixed `dist/bds-runtime/bedrock_server.exe`.
- Benchmark 16 × 32 moving, terrain-contacting, eight-sided cables for ten minutes. Measure total Cable runtime cost, including publication and persistence; target p95 below 10 ms with sustained 20 Hz throughput and no failed ticks or watchdog events.
- Require real-client evidence of intermediate animation frames, connected group boundaries, fractures, late joins, rebasing, and two-client viewing. Server tests alone do not establish smooth rendering.
- Deliver API documentation, preset examples, a disposable demonstration world, and measured acceptance results. Keep failed performance or client gates explicitly open.
