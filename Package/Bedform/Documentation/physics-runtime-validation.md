# Physics runtime validation, 2026-11-01

`MineCraft-8zu.4` has runtime implementation and host/isolated-engine evidence. It remains in progress because its client-rendered interpolation acceptance is unverified. Package versions and the settled physics/particle dependency direction are unchanged.

## Host validation

`npm run verify --workspace bedform` exited 0: source typecheck, build, all 228 tests, tool/declaration typecheck and full package lint. This includes 20 runtime fixtures covering both representations, full orientation, persisted physical overrides/loads, startup rollback, disposal, unload/reload, dimension transfer, missing/incompatible states, duplicate owners/runtime startup, asset repair, combined pause causes, terrain budgets/extensions/permutations, native momentum, walking/rotating support, helper reuse and packet-counter exhaustion.

Packed-consumer verification imports the runtime core in a restricted host with no Node/browser globals or Bedrock runtime dependency. The existing common-root compiler/decoder tests cover presentation endpoints and packet handling. `git diff --check` passed. These checks do not establish real client frame behavior.

Host log: `Package/Bedform/dist/physics-runtime-verify.log`.

SHA-256: `125E0452449B093B6B7F242EADE4A663DD0AD17B22AFC806C2E15E1A9701DA26`.

## Isolated engine validation

`npm run test:physics:bds --workspace bedform` exited 0. The final run is `Package/Bedform/dist/physics-bds-aGDllh/`, using the fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe`. The available engine was **BDS 1.26.52.3, build 51798905**, not the newer engine mentioned in historical project notes. Its executable SHA-256 is `19C88569AF2E4B7D984E999055A31CBCB0799DACF8BBBF7371EDA42F5772A443`.

The runner compiled real cuboid and mesh-solid particle-owner registrations and a test renderer, then launched two separate server processes against the same disposable world. Both processes exited 0. Assertions verified:

- Generated helper gravity and native collision behavior before bridge integration. A pig stood at helper height 100.125; moving the helper alone did not transport it horizontally.
- Dynamic body contact with a real bottom-slab permutation at the expected body-origin height 100.
- Native standing at body surface height 100.5 and one active support helper within the configured four-helper limit.
- Translation of native support from x=0 to approximately x=0.25 while the platform moved.
- Jump release reaching y=101.212, without zero-distance native teleports cancelling the impulse.
- Custom/native side pushing on level slab footing, moving the pig from x=1.25 to approximately x=1.405 with no runtime diagnostics in that scene.
- Persistent visible/invisible owners, full committed orientation, neutral native orientation, render-base changes and separate transient test anchors.
- A remote fixture area at x=256: removal paused/unloaded its body, reloading restored the frozen committed pose and exactly one attachment.
- Actual process restart without elapsed-motion replay, restored attachments, orphan helper/anchor cleanup, repeated startup/disposal and owner removal.

Startup log SHA-256: `0C290958434A987D975109F4D7EF12004A1C1FDE77E8186EAB4BDB7C6EBA3903`.

Restart log SHA-256: `8F9C1051DB49C12DCC1EDEBC78435A965ACD74BC62E3419567BDBE3428F79E08`.

The explicitly named ticking areas exist only in disposable fixtures. No installed/server world was modified. The runner never elevated; the firewall configuration script was extended but administrator firewall setup was not run.

## Acceptance boundaries

There are no real client captures proving intermediate cuboid poses, coherent client property/frame timing, render-base compensation without doubled native smoothing, late joins, or two-player walking/jumping/jitter on moving and rotating bodies. Host walking/rotation tests and native pig tests do not substitute for those captures. The full terrain-family and cross-dimension client matrix also needs qualification on the target engine/content version. `MineCraft-8zu.4` therefore remains in progress.

These runs are not performance qualification. Contact-heavy fixture ticks were visibly slow; no isolated p95 measurement or ten-minute 128-body campaign was run. `MineCraft-8zu.5` retains profiling and sustained performance acceptance. Actual ParticleRuntime/live-locator rendering remains downstream in `MineCraft-2zx`; the test renderer creates no real particles.

No commits, git pushes or remote Dolt synchronization were performed.
