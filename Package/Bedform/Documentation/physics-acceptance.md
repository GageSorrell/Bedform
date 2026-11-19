# Physics acceptance record

Implementation and repeatable validation tooling for **MineCraft-8zu.5** are present. The issue remains **in progress**: the required performance gate failed, and real two-player cuboid acceptance remains open per the user's November 2, 2026 instruction. Package versions remain `1.0.0-alpha.1`. These measurements are validation results, not release-readiness claims.

## Contracts and coverage

The [asset compiler documentation](../ReadMe.md#physics-asset-compiler) specifies cuboid and particle registrations, the version-one mesh-solid interchange, coordinate conversion and fingerprints, closed oriented shells and cavity validation, decomposition limits, source provenance and source-solid mass/inertia. Rendering and selected collision approximations never redefine physical mass. Failed mesh validation or partitioning is a hard error; no enclosing-hull fallback is permitted. Particle attachment is renderer-neutral and tested through adapters; Blender export and real generated particle rendering remain downstream in **MineCraft-2zx** with the fixed 4096 policy.

The [dynamics documentation](../ReadMe.md#immutable-rigid-body-dynamics) specifies public model-origin poses, authoritative COM velocity, explicit origin-motion conversion, fixed substeps, failure rollback and retained state. [PhysicsRuntime](physics-runtime.md) documents explicit integration, native proxies/support and terrain approximations, typed diagnostics, compatible owner restoration and transient lifecycle. The [earlier runtime record](physics-runtime-validation.md) preserves `.4` evidence; this report records its follow-up checks and sustained acceptance campaign.

The host suite covers numerical presentation samples at 0/12.5/25/37.5/50 ms, shortest normalized quaternion lerp and sign/tie/wrapping behavior, origin/COM separation, hierarchy/root generation, packet coherence/reset/hold and independence of physics from render alpha. Packed/restricted-host tests exercise public root/subpath exports, declarations and explicit runtime imports without introducing Bedrock/Node subscriptions into the pure API. New regression tests cover cached immutable transforms versus mutable structural inputs, rotated box contacts against independent SAT, shared transform bounds, convex parallel-motion CCD, observational runtime metrics and actual mesh compilation/texture validity.

Optimization retains exact collision geometry, full inertia tensors, four substeps and ten solver iterations. It caches immutable face/rigid-frame/native-shape data, uses SAT for eligible small convex polyhedra, and precomputes constraint effective masses. Single-convex-pair CCD can bound linear closing motion along its separating plane; compound/concave CCD retains the global relative-speed bound. None of these changes qualifies the runtime against the performance target.

## Host and engine verification

`npm run verify --workspace bedform` passed source typecheck, build, **233 tests**, tool/declaration typecheck and full package lint. The tests include packed/restricted-host consumers. Tool typecheck and lint were also rerun after the final report aggregation change. `git diff --check` passed.

`npm run test:physics:bds --workspace bedform` exited 0 with separate startup/restart processes against the same disposable world (`dist/physics-bds-RyEiBd`). It rechecked actual generated owners, native AABBs/support/pushing/jump release, slab contact, full committed orientation, renderer-adapter lifecycle, unload/reload and process restoration after the collision/solver changes. Both engine processes exited 0, with no watchdog termination. The detailed assertion boundaries remain in the earlier runtime record.

Client preparation produced `dist/physics-bds-rdOImR/client-session.json`. Foreground preview with `--smoke` exited 0 after `BF_CLIENT_READY`, using NetherNet without the transport error. Both bodies were unpaused; the server snapshot and `client-smoke.json` explicitly record **zero players and no captures**. The server was stopped cleanly. This proves server readiness only; client connectivity/rendering remains unverified and open.

Evidence paths below are relative to `Package/Bedform`; generated `dist` artifacts are local ignored evidence, so archive them separately when sharing this report.

| Evidence | SHA-256 |
| --- | --- |
| `dist/physics-acceptance-verify-final.log` | `b6507698d77dfe1a56f7fb3c35e7791bb200bc1f38c649762d655e08a6f4e15a` |
| `dist/physics-bds-RyEiBd/startup.log` | `c2121a25ea1c259955109410f6b3054e557e6e9935cb8cb18d5dbe6ee49b2c17` |
| `dist/physics-bds-RyEiBd/restart.log` | `7e87621afc527f63cda341fe238a862bdc5d8f4487eb46811c8ff368aa5bd790` |
| `dist/physics-bds-BP8yNA/report.json` | `79a039c295203f60e18f27287bf46fdfd9fc9c5fef84dce1cee1bd5115c34a48` |
| `dist/physics-bds-rdOImR/client-session.json` | `f24e6976fefdb7218a417daf3a11fccc505bfe4eeffff38b662436b7bf2bba92` |
| `dist/physics-bds-rdOImR/client.log` | `d97aa52a782e2171a3144c1b60bc61732f4892827a6e2ed0c9f8a35c81acfa47` |

## Reproduction and measurement

From the repository root:

```powershell
npm run verify --workspace bedform
npm run test:physics:bds --workspace bedform
npm run benchmark:physics --workspace bedform
npm run benchmark:physics --workspace bedform -- --scene mixed-128
npm run benchmark:physics:smoke --workspace bedform
npm run benchmark:physics:host --workspace bedform -- --seconds 2
```

The BDS campaign uses the fixed package runtime path and lock, real compiler output, explicit fixture-only ticking areas and fresh worlds/processes per scene. The mixed scene has **96 primitives and 32 complex bodies**, each complex model containing **32 authored cuboids / 32 convex cells**. Sleeping is disabled. Four bodies encounter terrain under gravity, four native pigs exercise the bridge, and the remaining bodies rotate under zero gravity. The all-complex stress scene uses 128 complex bodies. Representative mesh scenes use 32 bodies and an inert test renderer, not real particles. Full durations are 600 seconds mixed, 60 seconds all-complex and 10 seconds per mesh, following warmup. `--seconds` shortens the campaign for smoke/debugging and cannot qualify the ten-minute gate.

`PhysicsRuntime.Options.clock` supplies milliseconds and `metrics` receives frozen `TickMetrics`. Total time includes terrain/native queries, solving, owner properties and persistence; solver/publication times are also recorded. Counters distinguish actual owners from terrain/proxies, and include active owners, contacts, terrain reads, failures and clock validity. Clock/sink exceptions are isolated from authoritative physics. BDS uses its millisecond wall clock; host measurements use the high-resolution Node clock and in-memory ports. Host results are diagnostic and always mark `engineQualified: false`.

Reports retain wall duration separately from simulated seconds, nearest-rank p95, sample counts, minimum active owners, diagnostic failures, engine/hardware metadata and script hashes. Completing a wall-time window does not establish 20 Hz throughput. Qualification requires the full mixed duration, 128 active owners, no failed ticks/invalid clock/watchdog, terrain/native contacts, sustained tick count and runtime p95 **below 15 ms**. Failed campaigns exit nonzero even when the engine shuts down cleanly. Each scene's process is isolated so a watchdog does not erase subsequent mesh measurements.

## Recorded performance

The isolated test engine was **BDS 1.26.52.3, build 51798905**, SHA-256 `19c88569af2e4b7d984e999055a31cbcb0799dacf8bbbf7371eda42f5772a443`. Hardware reported AMD Ryzen 5 5600, 8 logical processors, 21,421,248,512 bytes RAM; Windows kernel 10.0.26300 and Node 24.22.1. This is the available test runtime, not a claim about the installed production server or every Bedrock version. Host tooling/verification ran concurrently with portions of the diagnostic campaign; no controlled release-performance claim is made.

Final mixed rerun: `dist/physics-bds-BP8yNA/report.json`, script SHA-256 `0f30d3b0b054e95bf604318bd9a7340b2d3614000d9593ff6ef195ad0b603f32`.

| Metric | Result |
| --- | --- |
| Measured wall duration | 601,660 ms |
| Ticks / simulated time | 169 / 8.45 seconds, versus 12,000 expected ticks |
| Runtime median / p95 / maximum | 3,402 / **4,442** / 5,759 ms |
| Solver p95 / publication p95 | 3,974 / 53 ms |
| Minimum active owners | **127 of 128** |
| Failed ticks / invalid clock | **85** / 0 |
| Terrain / native contact ticks | 169 / 156 |
| Watchdog / qualification | No / **failed** |

The retained diagnostic is `CollisionFailure`, `CCD exceeded 128 iterations`, for `benchmark-1` and a native proxy. The engine process exited 0; the benchmark command exited 1 because qualification failed. The first complete six-scene campaign (`dist/physics-bds-5BWS6C/report.json`) had mixed p95 3,225 ms but paused four owners, so its apparently lower timing is not an equivalent healthy-scene improvement. Its all-complex scene terminated under the 10-second watchdog with no valid timing result. Both failures remain tracked in **MineCraft-8zu.5.1**.

Representative mesh measurements from that six-scene campaign:

| Solid | Vertices / triangles / cells | Validation ms | Decomposition ms | Full compile ms | 32-body BDS p95 ms |
| --- | --- | --- | --- | --- | --- |
| Cube | 8 / 12 / 1 | 0.48 | 10.74 | 19.04 | 211 |
| Concave | 16 / 28 / 3 | 0.13 | 12.98 | 20.81 | 211 |
| Closed cavity | 124 / 240 / 26 | 0.89 | 186.18 | 166.99 | 244 |
| Disconnected | 16 / 24 / 2 | 0.28 | 5.85 | 19.83 | 211 |

The mesh windows were ten seconds each, with 32 active owners and no failed ticks. Compilation stages are separately timed calls, not additive components of one invocation; cache/JIT effects can make full compilation faster than the isolated decomposition measurement. These small voxel-boundary solids establish reproducible representative costs, not performance for arbitrary Blender meshes. Their volumes are 1/64, 3/64, 0.875 and 2/64 cubic blocks respectively.

A final-source two-second host smoke (`dist/physics-host-benchmark-uVvgZZ/report.json`) retained 128 active mixed bodies but reached p95 309.65 ms; all-complex paused four bodies with an impact-budget failure. It exited 1. This is a short diagnostic, not the BDS gate. Earlier host/microbenchmark artifacts are exploratory baselines and do not establish final-source qualification.

## Remaining acceptance

**MineCraft-8zu.5.1** owns runtime cost, native/complex CCD failures and a new healthy full-duration mixed/all-complex campaign. Do not close `.5` based on a short smoke, reduced active count, disabled contacts, relaxed solver budgets or a completed wall-time window.

**MineCraft-8zu.5.2** owns real two-player cuboid interpolation, property timing/native smoothing, moving/rotating support, jumping, late join/restart and lifecycle captures. See the [prepared fixture and capture procedure](physics-client-validation.md). Client acceptance remains open; server probes and mathematical samples do not establish intermediate rendered frames. Actual particle evidence remains downstream in **MineCraft-2zx**.

No commits, git pushes or remote Dolt synchronization were performed.
