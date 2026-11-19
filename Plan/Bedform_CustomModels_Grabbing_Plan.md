# Blender models rendered with Bedform particles

## Summary and defaults

Add a Blender authoring extension, headless model compiler, and Bedrock particle renderer to `bedform`. Implementation starts after the planned `effect-bedrock` mathematics and Bedform spatial/physics additions are complete: `MineCraft-ner` and `MineCraft-8zu`.

The initial feature supports movable rigid models, world lighting, static first frames of animated textures, and resource-pack folders or archives. Each rendered face region uses one particle, attached to one invisible, non-colliding anchor entity per model instance. Physics-attached models inherit the [physics plan's common-root interpolation contract](Bedform_Physics_Initial_Plan.md#visual-interpolation-between-physics-ticks): both position and full rotation lerp over each 50 ms interval using one shared root transform.

Masked textures have a fixed ceiling of **4096x4096**. `Auto` uses **4096x4096**; explicit per-face dropdown choices are **16, 32, 64, 128, 256, 512, 1024, 2048, or 4096** pixels square. No machine-specific or platform-specific ceiling is computed. Assume 4096x4096 works on all Bedrock platforms, as explicitly requested; this is a design assumption, not a claim of measured cross-platform validation. Do not add a maximum-resolution discovery campaign or an all-platform qualification release gate. Do not silently downscale.

The requested filename is retained; this feature does not add grabbing controls. Physics attachment consumes the prerequisite physics runtime and leaves grabbing behavior to its separate feature.

## CLI, configuration, and Blender setup

- Add:
  ```text
  bedform model particles <model.blend> --namespace <namespace> --out <directory> [--name <name>]
  bedform blender setup
  bedform config get [key]
  bedform config set <key> <value>
  ```
- Keep `bedform build` compatible with the prerequisite physics compiler. The particle command emits a TypeScript module, behavior/resource-pack overlays, and a generation report; it does not bundle the consumer's scripts or install into a world.
- Store machine-local, per-user JSON configuration in the platform's standard configuration directory: `%LOCALAPPDATA%\bedform\config.json` on Windows. Writes are atomic and preserve unrelated settings.
- Define `blender.executable` without a default. Blender-dependent commands validate an explicitly configured executable. When unset on Windows, inspect `%ProgramFiles%\Blender Foundation\Blender *\blender.exe`, select the newest supported version, validate it, and persist its absolute path. Other systems require explicit configuration.
- Support Blender 4.5 LTS and subsequent stable versions covered by integration tests. Missing, invalid, or unsupported executables produce actionable errors.
- Package a versioned Blender extension ZIP and headless driver in the npm artifact. `blender setup` installs and enables that extension for the current user, using Blender's [local extension installation interface](https://docs.blender.org/manual/en/4.5/advanced/command_line/extension_arguments.html). Repeated setup is idempotent and upgrades only Bedform's extension.
- Export commands load the packaged extension directly in a hidden background Blender process, independent of interactive preferences. Disable embedded-file script autoexecution, capture diagnostics, support cancellation, and never save changes to the input `.blend`.
- Bundle CLI-only Effect/platform dependencies into the executable so a clean global installation works. Keep upstream Effect and Node imports outside the Bedrock runtime entrypoints.

## Blender authoring and resource resolution

- Treat the active scene's render-enabled mesh objects as one rigid model. Bake evaluated modifiers and object transforms at the saved frame; ignore cameras and lights. Animation playback and deformation over time are outside this feature.
- Use the scene origin as the model origin. Convert Blender coordinates to Bedform coordinates with `(x, y, z) -> (x, z, -y)` and respect scene units, with one metre corresponding to one block.
- Add face-selection controls for:
  - Solid RGBA color or texture.
  - Searchable vanilla texture dropdown or custom texture identifier.
  - Two-component UV scale and offset.
  - Mask resolution: `Auto` (4096x4096) or one of the explicit square sizes listed above; reject values above 4096 or outside that list.
- Store versioned face settings and scene resource references inside the `.blend`, with Blender undo support. Preserve existing UV maps; generate normalized planar UVs for faces lacking them. Apply scale, then offset, with repeating texture sampling.
- Build Blender materials from those same settings, using nearest-neighbor texture sampling. Both material preview and rendered scenes must show the resolved colors, texture alpha, and UV mapping.
- Store an ordered resource stack in the scene, shown highest priority first. Support directories, `.mcpack`, and resource packs inside `.mcaddon`; expose pack/subpack selection where needed. Resolve relative paths against the `.blend`.
- Supply a versioned vanilla texture catalog and cache vanilla images from a pinned, checksum-verified [Mojang sample release](https://github.com/Mojang/bedrock-samples/releases). Setup prepares the cache; allow an explicit local vanilla-pack override and offline reuse.
- Resolve texture paths and item/terrain atlas identifiers using the effective pack stack. Custom packs override vanilla, and higher-priority custom packs override lower ones, matching [Bedrock pack stacking](https://learn.microsoft.com/en-us/minecraft/creator/documents/resourcepack?view=minecraft-bedrock-stable). Preserve atlas-entry merging and [texture-set reference rules](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/texturesetsreference/texturesetsconcepts/texturesetsintroduction?view=minecraft-bedrock-stable).
- Preview and export use the same resolver and compositor. Animated textures use their first declared frame. Ambiguous variants require selection; missing assets fail with the face, identifier, and searched stack.
- Bake the resolved appearance into generated assets where required. Changing the source resource stack requires recompilation.

## Geometry, textures, and runtime interfaces

### Geometry and texture compilation

- Extract evaluated geometry and appearance data through the Blender extension into a versioned intermediate representation. Bedform validates it and generates the TypeScript and pack assets.
- Merge edge-connected, consistently oriented coplanar triangles into maximal planar regions, including concave boundaries and holes. Material and UV seams remain within the region and are composited into its texture.
- Use fixed, scale-aware geometry tolerances and compare each merged region against its original plane to prevent accumulated coplanarity drift.
- Remove redundant collinear boundary vertices before classification. Every non-rectangular region receives a masked texture, including triangles, higher n-gons, and non-rectangular quads. Holes remain transparent.
- Rectangles may use a shared solid texture or a resolved source image when their appearance is directly representable; otherwise bake them too. Each region still uses one particle. Any generated masked texture obeys the fixed ceiling, including a rectangle that requires baking.
- Rasterize the actual resolved texture or face color inside the polygon mask. Preserve UV seams and source alpha. Do not bake Blender scene lighting.
- Deduplicate using normalized geometry, resolved appearance, UV mapping, and resolution, independent of model placement. Identical shapes with different appearances must not share an incompatible texture.
- Default masked images to square 4096x4096 textures. Explicit face resolution overrides Auto. A merged region uses the highest resolved resolution among its constituent faces; show that effective value in Blender. `Auto` on any constituent face resolves to 4096. Invalid explicit values fail rather than being clamped or silently downscaled.
- Reject degenerate, overlapping, self-intersecting, or nonplanar input that cannot faithfully produce a planar particle. Identify the affected objects/faces rather than silently changing their geometry.
- Generate deterministic identifiers and assets. Stage output before publication and clean only files recorded as belonging to this compiler.

### Public runtime

- Add pure `bedform/ParticleModel` data/types and explicit `bedform/ParticleRuntime` integration. Generated modules export their model descriptor and a typed spawn helper.
- Reuse `Transform` from the completed math epic for static local poses, instance poses and the renderer-neutral committed model-origin endpoints; it stores position/quaternion with no scale. Motion-bearing targets/snapshots use `RigidTransform`, whose linear velocity is measured at its origin and angular velocity is in radians/second. Physics converts its authoritative COM velocity before exposing that type; rendering consumes the extracted Transform only.
- Use shared `Plane`, `AABB`, `OBB`, unit-direction `Ray` and solid-3D `ConvexHull` types where geometry/static queries are needed. Open standalone particle face regions remain valid and must not be coerced into solid hulls. Mesh-solid provenance, concave decomposition, cavity preservation and collision/mass remain governed by physics; static hull queries cannot replace that solid pipeline.
- Provide explicit runtime startup/disposal, model spawning, pose updates, attachment to a `PhysicsEntity`, and instance disposal. Follow the completed spatial/physics APIs' functional and typed-error conventions.
- Generate one invisible anchor entity per instance, with no gravity, collision, interaction, or rendered mesh. Reuse the prerequisite physics runtime's complete pose-interval and common-root interpolation contract. Preserve a suitable existing root and any fixed descendant hierarchy; when the anchor representation otherwise has no bones, add a trivial root at the model origin. All face locators share that root; do not generate a separate animated bone for every face.
- Give each face a locator and an attached emitter configured for one live, double-sided, world-lit particle. Keep the locator's static local position/orientation and emitter-plane alignment relative to the common root. Its per-frame animated position and full rotation offsets must move existing emitters and live particles together, including roll, without waiting for particle renewal. Bedrock documents animated bone locators and emitters following their location/orientation; validate the behavior of live particles on clients. ([Entity integration reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/particlesreference/particleentityintegration?view=minecraft-bedrock-stable))
- Physics attachment consumes the same committed start/end poses, 50 ms duration, sequence/reset markers, and render-base information as cuboid rendering. Generate client animation/Molang with one linear alpha for component-wise position lerp and shortest-path normalized quaternion rotation lerp, converted to root offsets. Follow the physics contract's coherent property latching, per-frame clock, native-origin compensation, endpoint hold and reset behavior. Do not add a second smoothing layer or alter collision, mass properties, spring behavior, or the one-tick visual buffer. Remove renderer subscriptions and anchors on disposal; handle dimension changes, unload/reload, and orphaned anchors explicitly.
- Keep renderer instances transient. Persistent physics bodies recreate their attached rendering through their existing restoration lifecycle.
- End successful CLI output with texture counts grouped by actual resolution and the particle count per model instance. Distinguish masked textures, other textures, unique emitter definitions, and the single helper entity; report counts even when generated files were reused.

## Validation and delivery

- Begin runtime integration with a small engine fixture proving arbitrary face orientation, roll, double-sided masking, world lighting, common-root position/rotation lerp across 50 ms, locator movement inherited by existing live particles, one-particle emitter renewal, native-origin compensation and cleanup. This is a rendering-behavior check, not resolution-ceiling discovery.
- Test the fixed resolution policy directly: Auto produces 4096x4096, every supported explicit size is respected, merged regions choose the highest resolved member size, and unsupported or oversized requests fail. Assume the 4096x4096 ceiling is supported across platforms; no platform qualification campaign is required.
- Cover triangles, rectangles, skewed quads, concave n-gons, holes, triangulated regions, mixed appearances, UV seams, mirrored transforms, tolerances, deduplication, and resolution overrides with geometry and pixel-level fixtures.
- Test pack collisions, atlas merging, texture sets, archive inputs, subpacks, first-frame extraction, missing resources, and agreement between Blender preview and exported textures.
- Test configuration/discovery, repeated setup, headless execution, cancellation, malformed `.blend` files, deterministic output, safe stale-file cleanup, and exact terminal totals.
- Verify a packed npm installation outside the repository, Blender extension installation, generated TypeScript compilation, and absence of host dependencies from runtime modules.
- Run BDS integration through the fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe` runner. Require real client checks for visual correctness, sustained movement, simultaneous instances, late joining, unload/reload, and disposal; BDS alone cannot establish rendering correctness. These checks need not be repeated on every platform to qualify the resolution assumption.
- Verify the physics interpolation contract at both endpoints and intermediate frame times, with simultaneous translation/rotation, full roll, equivalent quaternion signs, angle wrapping, varied frame rates, render-base changes, delayed/duplicate/skipped updates, late joining, explicit teleports, restored bodies, and sleeping/paused instances. Capture real two-player client evidence that every face follows one root continuously between 20 Hz physics updates, without per-face phase drift, doubled smoothing, particle-renewal jumps, orphan buildup, or changes to authoritative mesh collision/mass properties. Track combined physics-attached grabbing, manual rotation, dropping and throwing in `MineCraft-opl`, downstream of both completed feature epics; do not make prerequisite particle implementation depend on grabbing.
- Verify generated/public geometry and pose declarations reuse the shared math modules, model-origin/COM motion conversion is explicit, and rendering depends only on Transform pose endpoints. Preserve all existing 50 ms position/nlerp visual behavior; neither RigidTransform interpolation nor velocity extrapolation replaces it. Cover open standalone faces and cavity-bearing physics models without accidental hull substitution.
- Track implementation and validation in a Beads epic dependent on `MineCraft-ner` and `MineCraft-8zu`, with self-contained descendant work and explicit dependencies. Embed this specification in the epic so the durable work does not require chat access. Leave implementation entries open until their own implementation and validation are complete.
- Preserve package versions and unrelated edits. Apply repository TSDoc conventions, namespace-extracted nested types, and centralized frozen PascalCase script-owned identifier records to generators and generated code.
- No live-world deployment, commits, pushes, or remote Dolt synchronization are included. This planning delivery writes this specification and creates Beads tracking; it does not implement package changes.

### Success Criteria

The packaged CLI can install its bundled Blender extension, manage machine-local configuration, and compile a single rigid `.blend` model headlessly into a consumable TypeScript module plus the required pack assets. The extension authors and previews the same effective appearance used by export. Coplanar connected triangles render as one face region; every non-rectangular region has the correct reusable masked texture. Auto masks are 4096x4096, explicit supported sizes are honored, and output reports exact per-resolution texture and per-instance particle counts. Movable instances and PhysicsEntity attachment render correctly through the explicit runtime, with one invisible anchor per instance and verified lifecycle cleanup. Physics-attached faces inherit a single common root with position and full rotation lerped over each 50 ms interval, reusing existing bones or adding a trivial root when there are none. Host, packed-consumer, Blender, BDS, and available-client visual evidence cover the feature; 4096x4096 cross-platform support remains an explicit assumption rather than an empirical release gate.
