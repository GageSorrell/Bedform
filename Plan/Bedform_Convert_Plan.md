# Bedform conversion and add-on builds

## Summary and commands

Implement the Windows x64 CLI with:

```text
bedform convert <model.blend> [--out <model.geo.json>] [--name <name>] [--ignore-invalid]
bedform setup convert [--fix]
bedform build [source-directory] [--config <file>] [--out <file-or-directory>] [--ignore-invalid]
bedform config get [key]
bedform config set <key> <value>
bedform config unset <key>
```

`convert` exports cuboid geometry through Blender and Mcblend. `build` stages an add-on's source, replaces Blender models with exported geometry, and uses Microsoft's build tasks to produce a `.mcaddon`.

## Configuration, discovery, and setup

- Implement the configuration commands already specified in `Plan/Bedform_CustomModels_Grabbing_Plan.md`. Store machine settings at `%LOCALAPPDATA%\bedform\config.json`; write atomically and preserve unrelated settings.
- Support `python.executable` and `blender.executable`. Explicit invalid paths fail with actionable diagnostics and are never silently replaced.
- When Python configuration is unset, inspect these candidates in order:
  - Environment locations: `VIRTUAL_ENV`, `CONDA_PREFIX`, `PYTHONHOME`; executable overrides `PYTHON3` and `PYTHON`.
  - Python commands on `PATH` and installed runtimes reported by the Windows launcher/install manager.
  - Registry registrations and conventional Python locations under Local AppData, Program Files, and system-drive `Python3*` directories.
- Probe candidates to verify Python 3 and resolve its actual executable. Reject broken installations, Python 2, and Store aliases without an interpreter. Disable automatic installation during discovery.
- Reuse the particle plan's Blender discovery: validate explicit configuration or inspect Blender Foundation installations, select the newest tested compatible version, and persist its executable path.
- Require Blender 5+. Initially qualify Blender 5.2 with Mcblend 13, whose release explicitly targets Blender 5.2. Reject unsupported combinations clearly. ([Mcblend releases](https://github.com/Nusiq/mcblend/releases))
- Probe Mcblend inside the selected Blender. Verify installation, enabled state, compatibility, and exporter availability. Missing/disabled diagnostics must explain that Mcblend must be added and enabled, print its [official downloads page](https://github.com/Nusiq/mcblend/releases), and suggest `bedform setup convert`.
- `setup convert` reports dependency status and prompts separately for each installation or enablement action. `--fix` skips Bedform prompts. Without an interactive terminal or `--fix`, unresolved dependencies cause an unsuccessful exit.
- Use normal official Windows installers: Python at its conventional per-user location, Blender through its MSI, and Mcblend in the selected Blender's current-user add-on directory.
- Initially pin Python 3.14.10, Blender 5.2.3, and Mcblend 13.0.0 in a download manifest with official URLs and SHA-256 values. ([Python downloads](https://www.python.org/downloads/windows/), [Blender downloads](https://download.blender.org/release/Blender5.2/))
- Install silently without restarting Windows. Request elevation only where required; `--fix` cannot bypass UAC. Enable Mcblend as the original user, reprobe after changes, and persist paths only after verification. Repeated setup leaves healthy dependencies alone.

## Cuboid conversion

- Default output is `<input-basename>.geo.json` beside the input. `--out` specifies a file; refuse existing destinations. Derive the geometry identifier from the filename unless `--name` overrides it.
- Include all geometry in the saved active scene, including hidden geometry. Ignore cameras, lights, armatures, and empty helpers.
- Evaluate modifiers, instances, and saved-frame transforms in temporary data. Validate disconnected mesh components separately.
- Accept nondegenerate rectangular cuboid solids. Normalize rotated, mirrored, triangulated, or subdivided cuboids into temporary six-face meshes when faithfully representable. Reject skewed solids, curved surfaces, loose geometry, and other unsupported geometry with object/component diagnostics.
- Strict conversion fails before publication if any invalid component exists. `--ignore-invalid` skips invalid components and reports their names and reasons; fail if no cuboids remain. It does not suppress dependency, I/O, UV, or exporter failures.
- Preserve a compatible rigid bone hierarchy. Attach unbound cubes to a temporary root; create the required root and bone parenting for ordinary unrigged models.
- Export static geometry at the saved frame. Preserve representable UVs and existing Mcblend texture dimensions; otherwise use deterministic box UVs and Mcblend defaults. Do not bake textures or export animations.
- Follow the particle plan's scene-origin, unit, and coordinate conventions exactly once, accounting for Bedrock's 16 geometry units per block.
- Package an external-Python coordinator and a Blender Python driver. Blender's embedded Python performs `bpy` and Mcblend operations; external Python needs no separate `bpy` package.
- Share hidden subprocess execution, argument-array handling, diagnostics, cancellation, and process-tree cleanup with the planned particle compiler. Disable embedded-file script autoexecution and never save the source `.blend`.
- Use a version-specific Mcblend adapter that consumes structured exporter warnings. Verify exported cube counts and reject `poly_mesh` output to catch silent omissions.
- Validate staged JSON before atomic publication. Report destination, exported cubes, and skipped components.

## Add-on build pipeline

- Default source is the current directory. Read optional project configuration from `<source>\bedform.config.json`, overridden by `--config`. Keep project build settings separate from machine executable settings.
- Discover immediate pack directories containing `manifest.json` under `behavior_packs` and `resource_packs`. Optional `build.behaviorPacks` and `build.resourcePacks` arrays specify alternate source-relative pack directories. Require at least one pack.
- Allow explicit script mappings through `build.scripts`, each containing source-relative `entry` and `output` paths. Outputs must match script-module entries in discovered behavior-pack manifests.
- For a single behavior pack with one script module, infer `Script/main.ts` or `scripts/main.ts` when exactly one exists. Otherwise use an existing manifest-referenced JavaScript file or require an explicit mapping. Ambiguous entrypoints fail.
- Supply Microsoft's `@minecraft/core-build-tasks` through Bedform; do not require an existing Just configuration or invoke the source project's npm build script. Use official bundling and archive tasks, including one `.mcpack` per pack and an outer `.mcaddon`. Microsoft documents these tasks as its standard build infrastructure. ([Official build documentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/libraries?view=minecraft-bedrock-stable))
- Create owned, isolated build workspaces under `<source>\Intermediate\bedform`. Exclude Git metadata, dependency directories, `Intermediate`, and build outputs from source copying. Resolve installed dependencies from the original project/workspace without installing them during builds.
- Scan included source files for `.blend` inputs. Export each to the corresponding staged sibling path: `models/example.blend` becomes `models/example.geo.json`. Fail if source already contains the corresponding `.geo.json`, including Windows case-insensitive collisions.
- Use the same converter implementation and validation policy as `convert`; forward `--ignore-invalid`. Blender files may be read from original source, but all generated geometry goes into staging. The source passed to official build tasks must contain no `.blend` files.
- Run TypeScript checking where configured, bundle mapped scripts, and package staged packs. Preserve valid relative configuration references when relocating source. Treat unresolved external configuration or source references as actionable build errors.
- Builds without Blender inputs do not require Python, Blender, or Mcblend.
- Default output is `<source>\dist\<name>.mcaddon`, using the unscoped package name or source-directory name. `--out` accepts a `.mcaddon` file or destination directory. Build outputs may be atomically replaced on successful rebuilds.
- Publish only after all conversions and official tasks succeed. On failure, preserve the previous published archive and retain the failed intermediate workspace with its diagnostic path. Never delete unowned contents of an existing `Intermediate`.
- When creating `Intermediate`, inspect only the add-on root's existing `.gitignore`. If its effective rules do not ignore that directory, append `/Intermediate/`. Preserve existing content, encoding, and line endings; avoid duplicate equivalent rules. Do not create a missing `.gitignore`.
- Reconcile the physics plan's reserved `bedform build --config` interface with this pipeline: future physics compilation becomes an asset-generation stage before script compilation and packaging. Physics implementation is outside this delivery.

## Delivery and validation

- Create self-contained Beads work for shared infrastructure, conversion/setup, build staging/packaging, and validation. Reuse that infrastructure from `MineCraft-2zx.1/.2` while preserving the particle epic's math/physics dependencies.
- Update the affected saved plans and command documentation. Preserve package versions, unrelated edits, repository TSDoc conventions, and runtime import boundaries.
- Test discovery precedence, invalid paths, Store aliases, setup prompts, `--fix`, repeated setup, download verification, installer failure, and UAC denial.
- Test ordinary/rigged cuboids, hidden geometry, disconnected mixed components, modifiers, transformations, units, UVs, strict failure, skipped geometry, and unchanged source hashes.
- Test conventional/custom pack roots, script mappings, multiple packs, builds without Blender, model-path collisions, stale intermediate data, cancellation, and archive replacement only after success.
- Cover `.gitignore` absence, equivalent ignore patterns, negations, missing final newline, and repeated builds without duplicate additions.
- Run real Blender/Mcblend conversion and official-tool packaging. Inspect the resulting archive for generated geometry and absence of `.blend` files. Validate silent setup in a disposable Windows x64 VM.
- Verify a packed installation outside the repository, run package quality gates, and confirm Bedrock runtime imports remain independent of host tooling.
- No live-world deployment, particle-renderer implementation, commits, pushes, or remote Dolt synchronization.

## Success Criteria

The packaged Windows x64 CLI implements the specified configuration, conversion, setup, and add-on build commands. Cuboid export and official-tool packaging satisfy the host, packed-consumer, real Blender/Mcblend, and disposable Windows installer checks above. Source models remain unchanged, intermediate geometry replaces Blender inputs before the official build runs, and failed builds preserve the previously published archive. Shared foundations are usable without waiting for spatial math, physics, or particle rendering, while existing particle prerequisites remain intact.

Saving this specification and creating Beads entries is a planning delivery only. Implementation and validation entries remain open until their own acceptance criteria are met.
