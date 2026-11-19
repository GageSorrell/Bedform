# Bedform Voxel, Microvoxel and Grid

## Context

Add-ons such as Microblocks work at block and sub-block (1/16 m) precision, but Bedform has no voxel types, and every add-on draws its own placement grid. Microblocks uses per-player particles, and its placed surfaces use cropped `experience_orb` entities. This change adds:

- `bedform/Voxel` and `bedform/Microvoxel`: pure lattice types whose coordinates are numbers in meters, so they can be passed directly to Bedrock's `Vector3` APIs.
- `bedform/Grid`: entity-textured grids on block faces, at cell sizes smaller and larger than 1 m. It also provides tinted region highlights (several disjoint regions at once), 3D voxel grids, and vertex particles colored with smooth-selection falloff.
- Assets in the existing **Bedform Common** add-on (`Addon/BedformCommon`, not renamed): grid textures, overlay entities and a vertex particle.

Confirmed decisions:

- The `Meter` type goes in effect-bedrock's Unit tree.
- Points use `bedform/Vector3`. effect-bedrock has no Vector3.
- Grid textures are 16×16-cell sheets.
- The largest texture is 1024×1024.

## Prior art to reuse

- **Cropped, scaled, tinted entity quads.** `Addon/Microblocks/Tool/placement-content.mts:141-247` shows the pattern, which has been verified on a client:
  - `experience_orb` material
  - property-driven `uv_anim` offset and scale (≤ 1 crops a sub-rectangle)
  - one geometry per face, chosen from a geometry array
  - bone scale from properties
  - spawn at the patch center, then `teleport` with rotation 0
- **Overlay entity components.** `Package/Bedform/Source/Build/DiageticControls.ts:369-433`:
  - `BehaviorEntity` has a 1.26.60-valid component set: `pushable_by_entity` presets, `damage_sensor`, `body_rotation_blocked`.
  - Float properties need fractional defaults and range tokens (`Diagetic/Keys.ts` `PoseRange`).
  - Its animations cancel `query.body_y_rotation`.
  - Grid entities omit the interaction and use a 0×0 collision box (Microblocks), so they never intercept block targeting.
- **Tinting.** Use `overlay_color` with `entity_alphablend` (WorldRealism clouds). Translucent fills take their alpha from the texture, because `experience_orb` is alpha-tested.
- **Asset pipeline.**
  - `Addon/BedformCommon/Tool/Build.mts` `Generate()` imports Bedform `Source/Build/*` emitters directly.
  - PNGs come from `Tool/Png.mts` `EncodePng`, generated at build time and git-ignored, like `DirectionPreview.mts` and `TransactionalIcons.mts`.
  - Shared path tables follow `Source/Internal/TransactionalAssets.ts`.
- **Particle color and plane-fixed billboards.**
  - `MolangVariableMap.setColorRGB("variable.color", …)` is read as `variable.color.r/g/b` (`Addon/AdvancedMinimapRewired` beam).
  - `Addon/Microblocks/Script/Geometry/preview.ts` uses `player.spawnParticle` for per-player particles.
- **Test patterns.**
  - Pure modules: `Test/Vector.test.mts` and `Test/Vector.types.mts` (`node:test`, imports `bedform/X`, root namespace identity).
  - Internal logic: `../Source/Internal/*.js` via tsx.
  - Host runtime: `Test/Direction.test.mts`, which bundles with esbuild into `node:vm` against a fake `@minecraft/server`, and checks assets against `Asset/bedform-common.mcaddon`.
- **Module style.**
  - Pure modules are free functions with `dual` and Option constructors plus `*Unsafe` variants (`Source/Vector3.ts`, `AABB.ts`).
  - Host modules follow `Source/Diagetic.ts`: PascalCase functions and fields, `Start(options) → Runtime`, keys in `Diagetic/Keys.ts`.

## 1. effect-bedrock `Unit/Meter`

New file: `Package/Effect/Source/Unit/Meter.ts`.

- **License.** The lint override for `Source/Unit/**` requires `@license BSD-3-Clause`. Mark the module as original, not upstream.
- **Exports.**
  - Namespace: `export * as Meter` in `Source/Unit.ts`.
  - Subpath: `effect-bedrock/Unit/Meter` in `package.json`.
- **API.**
  - `type Meter<N extends number = number> = N & Brand.Brand<"Meter">`. `Meter<Int>` stays assignable to `number` and `Int`.
  - Schema `Meter` (finite, branded).
  - `make(n): Option<Meter>`, `makeUnsafe(n)` (RangeError if not finite), `fromInt(i: Int): Meter<Int>`.
  - `makeInt(n): Option<Meter<Int>>`, which floors like `Int.make`.
  - `fromLength(Length) → Meter` and `toLength(Meter) → Length<number>`.
- **Tests.** Unit tests plus a `.types.mts` fixture: plain `number` is rejected, `Meter<Int>` is assignable to `number`, `Int` and Bedrock `Vector3` components. Run `npm run build` and `verify:unit` (effect-bedrock). Delete stale `Distribution/` outputs if files move.
- `@since 1.0.0`.

## 2. `bedform/Voxel` (pure)

`Source/Voxel.ts`, root `export * as Voxel` in `index.ts`, subpath `./Voxel`, all `@since 1.0.0`.

- **Type.** `interface Voxel { readonly x: Meter<Int>; readonly y: Meter<Int>; readonly z: Meter<Int> }`, a plain frozen object at the voxel's minimum corner. It is assignable to Bedrock `Vector3` (checked by a types fixture).
- **Faces.**
  - `Face` is a frozen `as const` record whose values equal Bedrock `Direction` strings, so both `Face.Up` and `Direction.Up` are accepted.
  - `faceNormal(face): Vector3`, `faceAxis`, `opposite`, `fromNormal`.
- **Construction.**
  - `Voxel(x, y, z): Option<Voxel>` requires safe integers and never floors. `VoxelUnsafe` throws RangeError.
  - `fromPoint(point): Option<Voxel>` floors, so -0.5 maps to -1.
- **Operations.**
  - `add`/`subtract` (partial Int offsets), `neighbor(self, face, distance?)`, `neighbors(self, 6 | 18 | 26)`.
  - `box(from, to)`: inclusive iteration in canonical order.
  - `traverse(from, to)`: Amanatides–Woo segment traversal yielding `{ voxel, face }`.
  - `distanceManhattan` and `distanceChebyshev` return Int; `distance` returns a number.
  - `Equivalence`, `Order`, `key`/`fromKey`.
- **Point-valued results** return `bedform/Vector3` or `AABB`: `center`, `bounds`. Everything else returns `Voxel`.

## 3. `bedform/Microvoxel` (pure)

`Source/Microvoxel.ts`, root namespace plus subpath.

- **Type.** `interface Microvoxel { readonly x: Meter; readonly y: Meter; readonly z: Meter }`, the minimum corner on the 1/16 m lattice. Values k/16 are exact in binary floating point.
- **Constants.** `Resolution = 16`, `Size = 0.0625` (`Meter`), `PerVoxel = 4096`.
- **Local and global coordinates.**
  - `interface Local { x; y; z: Int }`, each in 0..15, addresses 6.25 cm steps inside one voxel.
  - Global integer steps (`steps(self)` / `fromSteps`) address the containing voxel space.
- **Construction.**
  - `Microvoxel(x, y, z): Option` checks lattice alignment; `MicrovoxelUnsafe`.
  - `fromPoint` floors to the lattice.
  - `fromVoxel(voxel, local): Option` and its Unsafe variant reject locals outside 0..15.
  - `fromIndex(voxel, index 0..4095)`.
- **Queries.** `voxel(self): Voxel`, `local(self): Local`, `index(self)` (x + 16·(z + 16·y)).
- **Operations.**
  - `offset(self, steps)` moves in microvoxel steps, not meters. `neighbor(self, face)`.
  - `inVoxel(voxel)` iterates all 4096. `box(from, to)`. `traverse(from, to)`.
  - `center` and `bounds` (Vector3/AABB). `Equivalence`, `Order`, `key`.

## 4. `bedform/Grid` (host module; subpath only, not in `index.ts`)

### Public API (Diagetic naming style)

```ts
const grid = Grid.Start({ Owner: "microblocks" });           // once per add-on script runtime
const surface = grid.Surface({ Dimension, Region: Grid.BlockFaces(Voxel.Face.Up, from, to),
    Cell: Microvoxel.Size,                                      // Meter | { U, V }
    Origin, Lines: { Color, LineWidth?, Sheet? }, Major: { Every: 16, Color, LineWidth?, Sheet? }, Offset });
const picked = surface.Highlight(cells /* Iterable<{u,v}> | Rect */, { Tint: { red, green, blue, alpha } });
const soft = surface.Vertices({ Selected, Radius, Falloff: "Smooth", Ramp, Unaffected, Size, Players });
const volume = grid.Volume({ Dimension, Region: Grid.VoxelBox(a, b), Cell: 1, Facing: { Viewer: player } });
volume.Highlight(cells, { Tint }); grid.HighlightVoxels(Dimension, voxels, { Tint }); grid.HighlightMicrovoxels(…);
picked.Update(cells); picked.SetTint(t); surface.Dispose(); grid.Dispose();
```

- **Regions.**
  - `Grid.BlockFaces(face, from, to)` and `Grid.MicrovoxelFaces(…)` build a coplanar face rectangle in meters. Mismatched normal coordinates throw RangeError. Raw `{ Face, From, To }` is also accepted.
  - `Grid.VoxelBox` and `Grid.MicrovoxelBox` build volumes.
  - Regions need not align with the lattice. Edge cells are clipped through the UV crop offset and scale.
- **Coordinates.**
  - A surface cell or vertex is `{ u: Int; v: Int }`, relative to `Origin` (default: the region's minimum corner).
  - Each face has a pinned basis with u × v equal to the outward normal.
  - Helpers: `CellAt(point)`, `CellCenter`, `VertexPoint`, `Cells()`.
  - Volume cells and vertices are `{ x, y, z: Int }`.
- **Colors** are Bedrock `RGB`/`RGBA` (type-only import), validated to [0, 1].
- **Nested option types** use the repository's namespace convention (`Surface.Options`, `Surface.Options.Major`, …).

### Rendering design

- **Line tiles: `bedform:grid_lines`.**
  - Material `experience_orb` (alpha-tested, UV-animated, tintable), `ignore_lighting`.
  - Six face geometries: a centered 16-unit square, 1/1024 thick, with **only the outward face** UV-mapped to the full sheet. The nominal 16×16 texture size normalizes UVs for every sheet size.
  - Render controller: geometry array by `face`, texture array by `sheet`, `uv_anim` offset and scale from properties, and `overlay_color` rgb from properties with a = 1.
  - The animation scales the bone to the tile size in meters and cancels body yaw. Entities spawn with `initialRotation: 0`.
  - `visible_bounds` cover the largest tile extent, 32 m.
- **Sheets: `textures/bedform/grid/sheet_{64,128,256,512,1024}.png`.**
  - Each sheet holds 16×16 cells, c = R/16 texels each.
  - White 1-texel lines sit on every cell's leading edge, plus a closing line on the last texel row and column. The interior is transparent.
  - A tile shows up to 16×16 cells:
    - the final tile crops n·c + 1 texels for n < 16, or R texels for n = 16;
    - interior 16-cell tiles crop R − 1 texels, so seams never draw doubled lines.
  - Placement error is at most one line width, and nothing depends on texture wrap mode.
- **Automatic sheet selection.**
  - Target width τ = min(1/64 m, cell ÷ 8), using the smaller cell dimension.
  - Pick the smallest sheet whose line (cell × 16 / R) is at most τ. If none qualifies, use 1024.
  - Results: microvoxel cell → 128 (7.8 mm); ¼ m → 256; 1 m → 1024 (1.6 cm).
  - Overrides: `LineWidth` (meters) or `Sheet` (exact resolution).
  - Major lines are a second line layer with cell = `Every` × cell, selected the same way and drawn in front.
- **Fills: `bedform:grid_fill`.**
  - Material `entity_alphablend`, `ignore_lighting`.
  - Geometry array: six face quads plus a box.
  - Texture array: `fill_1…16.png` (4×4 white, alpha k/16). Tint alpha is quantized to 1/16.
  - Overlay rgb comes from properties. Box highlights inflate by ε against block faces.
- **Layering.** Offsets along the normal: fills at ε, minor lines at 2ε, major lines at 3ε, with ε = 1/512 m (`Offset` overrides).
- **Decomposition** (pure, deterministic, exact and non-overlapping covers):
  - 2D highlight cell sets merge row runs into rectangles.
  - 3D voxel and microvoxel sets merge greedily into boxes.
  - Grids split into tiles of at most 16×16 cells and at most 32 m.
- **Volume gridlines.**
  - Stack 2D line planes perpendicular to the facing axis, one at every lattice boundary, with the single rendered face pointing along `Facing`.
  - `Facing: { Viewer }` re-evaluates the dominant axis and sign of (eye − center) every 5 ticks. It switches only when the new dominant component exceeds the current one by 1.2×, and it reuses entities.
- **Vertex particles: `bedform:grid_vertex`.**
  - `lookat_xyz` dot, `particles_alpha`. Opaque dots make refresh overlap invisible, so no crossfade is needed.
  - Size, color and lifetime come from Molang variables.
  - Each handle refreshes every 10 ticks with an 11-tick lifetime. Spawning goes through `dimension.spawnParticle`, or `player.spawnParticle` when `Players` is set.
  - Surface dots are lifted off the face by their radius.
- **Smooth selection.**
  - Weight = falloff(1 − d/r) for d < r, where d is the Euclidean world distance to the nearest selected vertex.
  - Falloffs: Linear, Smooth, Sphere, Root, Sharp, Constant, or a custom function.
  - The color interpolates linearly between `Ramp` stops (default blue → green → yellow → red). `Unaffected` optionally draws zero-weight vertices.

### Lifecycle, budgets, errors

- **`Start({ Owner })`.**
  - Creates a session id and registers `entityLoad` cleanup.
  - Sweeps all dimensions after world load, removing `bedform:grid_*` entities whose dynamic-property owner matches and whose session differs. Other add-ons' overlays are untouched.
  - Every Grid call throws until the runtime has started.
- **Updates reconcile.**
  - Desired tiles are diffed by stable key against existing entities.
  - Unchanged properties are skipped (like `PublishPose`), entities move only when needed, and only the difference is spawned or removed.
  - Unloaded entities are re-applied on load.
- **Atomic creation.** If a spawn fails (unloaded chunk, read-only context), already-spawned entities are removed before rethrowing.
- **Caps.** 256 entities and 2048 vertices per handle, configurable. Exceeding a cap throws RangeError before anything spawns.
- **Visibility.** Entity overlays are visible to every player; Bedrock has no per-player entities. Vertex particles can target specific players. Both are documented.

### Files

- `Source/Grid.ts`: runtime and public types.
- `Source/Grid/Keys.ts`, re-exported as `Grid.Keys`. Frozen PascalCase records:
  - `EntityType`, `Particle`, `EntityProperty`, `PropertyRange` (fractional tokens), `DynamicProperty` (`Owner`, `Session`, `Handle`), `MolangVariable`.
- `Source/Internal/GridLayout.ts` (pure): face bases, sheet selection, tiling and crop math, rectangle and box decomposition, lattice slicing, viewer-axis hysteresis, falloff, ramp, alpha quantization.
- `Source/Internal/GridAssets.ts`: sheet resolutions, cells per sheet, texture paths, fill levels, geometry, render-controller and animation identifiers, face order.
- `Source/Build/Grid.ts`: emitters for behavior and client entities, geometry, render controllers, animation and particle JSON.
- `Package/Bedform/package.json`:
  - `exports`: `./Voxel`, `./Microvoxel`, `./Grid`.
  - Per-module `lint:` / `test:` / `verify:` scripts.
  - ReadMe sections.
  - New `Documentation/grid.md`.

## 5. Bedform Common assets

- **`Tool/Build.mts` `Generate()`** writes:
  - `entities/grid_{lines,fill}.json`, `entity/grid_{lines,fill}.entity.json`
  - `models/entity/bedform_grid.geo.json`, `render_controllers/bedform_grid.render_controllers.json`, `animations/bedform_grid.animation.json`
  - `particles/grid_vertex.json`
  - lang names
  
  It also calls `GenerateGridTextures(rp)`.
- **New `Tool/GridTextures.mts`** generates the sheets, fill levels and a rimmed vertex dot, built on `EncodePng`.
- **`.gitignore`** gains `/resource_packs/bedform_common/textures/bedform/grid/`.
- **Version bump** 1.1.3 → **1.2.0** in `package.json`, both manifests, the BP→RP dependency and the root lock. No pack version is hard-coded in tooling. Then regenerate the committed JSON and the bundled script.
- **Tests and docs.**
  - Update `Test/Build.test.mts` (file lists, identifiers, properties, references).
  - Add `Test/GridTextures.test.mts` (pixel-exact line texels, alpha levels, dimensions).
  - Bedform `Test/GridAssets.test.mts` checks that every `GridAssets` path exists in the bundled mcaddon and that total size stays within budget.
  - Refresh `Documentation/common-packs.md` and the BedformCommon ReadMe.

## Conventions checklist

- Module headers and TSDoc per CLAUDE.md:
  - `@since`: `1.0.0` for bedform (1.0.0-alpha.1) and effect-bedrock; `1.2.0` for bedform-common.
  - Prose only, with no `@param` or `@returns`. `@throws { RangeError }`.
- Nested object types go into owner namespaces. Identifier keys go only in `Keys` records.
- LF line endings. Don't run `eslint --fix` on files this change doesn't own. Preserve all existing uncommitted work.
- No commit, push, deployment or Dolt sync.

## Beads tracking

The implementation epic is `MineCraft-8rve`. Implementation status and dependencies are tracked in Beads, not in this document.

| Issue | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-8rve.1` | effect-bedrock `Unit/Meter` | — |
| `MineCraft-8rve.2` | `bedform/Voxel` + `Face` | `.1` |
| `MineCraft-8rve.3` | `bedform/Microvoxel` | `.2` |
| `MineCraft-8rve.4` | Grid pure internals (`GridLayout`, `GridAssets`, `Keys`) | `.2`, `.3` |
| `MineCraft-8rve.5` | Common-pack grid emitters, textures, 1.2.0 bump | `.4` |
| `MineCraft-8rve.6` | Grid runtime: Start, Surface, styles, Highlight, lifecycle | `.4`, `.5` |
| `MineCraft-8rve.7` | Volume grids, viewer facing, box highlights | `.6` |
| `MineCraft-8rve.8` | Vertex particles and smooth selection | `.6` |
| `MineCraft-8rve.9` | Exports, docs, consumer type checks, full verification | `.6`, `.7`, `.8` |
| `MineCraft-8rve.10` | Native BDS smoke + physical-client acceptance (client part stays open for the user) | `.9` |

## Verification

- **effect-bedrock:** `npm run build --workspace effect-bedrock`, then `verify:unit`.
- **Voxel and Microvoxel:**
  - flooring of negative values
  - lattice rejection
  - all 4096 local/global/index round trips
  - neighbors
  - `traverse` against brute-force sampling
  - key round trips
  - Bedrock `Vector3` assignability fixtures
- **GridLayout:**
  - basis handedness for all six faces
  - the sheet-selection table
  - texel-coverage exactness: every lattice line within one line width, no seam doubling, clipped edges
  - decomposition is an exact, disjoint, deterministic cover
  - falloff curves and ramp endpoints
  - alpha quantization
  - face-geometry projection tests in the style of Microblocks' 24-rotation test, covering Bedrock Z mirroring
- **Grid runtime** (esbuild + `node:vm` + fake host):
  - spawn, update and reuse, dispose
  - atomic failure
  - owner/session sweep
  - caps
  - particle cadence and per-player targeting
  - viewer hysteresis
- **Full suites:**
  - `npm run verify --workspace bedform` (includes common-asset checks)
  - `npm run check --workspace bedform-common`
- **Native:**
  - A probe modeled on `Addon/LookInputDemo/Tool/ToggleProbe.mts`, run at an existing fixed-path, firewall-registered `dist/bds-runtime` (no new executable paths). It checks that BDS accepts the entity and particle definitions with no content-log errors, that spawn, update and dispose work, and that the session sweep runs after restart.
  - Physical-client checks, run by the user:
    - face orientation
    - crisp lines at the selected sheets
    - tint translucency
    - vertex colors
    - volume plane switching

## Risks to watch on a client

- **Materials.** `experience_orb` alpha-tested cropping and `entity_alphablend` tinting with alpha textures are inferred from Microblocks and WorldRealism. Neither combination has been verified on a client.
- **Aliasing.** Point filtering without mipmaps makes thin lines alias at distance. Automatic selection limits this, and overrides exist.
- **Memory.** All five sheets together use about 5.4 MB of GPU memory.
