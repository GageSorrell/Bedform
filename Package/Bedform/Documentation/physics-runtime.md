# Explicit physics runtime

`bedform/PhysicsRuntime` manages physics owners and fixed 50 ms simulation ticks through explicit host ports. `bedform/PhysicsRuntime/Bedrock` supplies the Bedrock implementation and requires `@minecraft/server` 2.10 or later for reported native AABBs. Neither module is exported through the pure root; constructing a host creates no subscriptions. Generated models remain independent of Blender and ParticleRuntime.

```ts
import * as Runtime from "bedform/PhysicsRuntime";
import { makeHost } from "bedform/PhysicsRuntime/Bedrock";
import * as Body from "bedform/PhysicsEntity";
import * as Result from "@bedform/effect/Result";
import { Models } from "./generated/catalog/models.js";

const Physics = Result.getOrThrow(Runtime.start({
    host: makeHost({ namespace: "example" }),
    models: Object.values(Models),
    diagnostic: (event) => console.warn(JSON.stringify(event))
}));
Result.getOrThrow(Physics.spawn(
    Result.getOrThrow(Body.make(Models.crate, { id: "crate-1" })),
    "minecraft:overworld"
));
// Functional updates retain COM-based authoritative velocities.
Result.getOrThrow(Physics.update("crate-1", Body.applyImpulse({ x: 1, y: 0, z: 0 })));
// At add-on shutdown: retains owners and data, releases transient resources.
Physics.dispose();
```

Use canonical dimension IDs returned by the engine. Default host discovery covers Overworld, Nether and End; explicitly list custom dimensions. One active runtime owns a host and generated pack namespace. Failed duplicate startup cannot remove the first runtime's attachments.

## Owners and presentation

Cuboid owners display the generated geometry. Particle owners are invisible persistent entities; their render adapter creates a separate transient anchor. Supply `renderer` for particle models. An unavailable renderer pauses the retained body and reports a `Renderer` diagnostic. A repaired renderer is retried and resumes only a pause introduced by that renderer failure. User/solver pauses remain explicit.

The native owner stays at neutral rotation. All three rotation axes and translation are encoded in the shared common-root interval. The runtime writes every tagged payload channel before the final sequence marker. Owners stay stationary until a local-coordinate rebase is necessary; root expressions compensate against the actual native render origin. Both representations consume the same committed model-origin `Transform` poses and 0.05-second interval. Rendering does not feed back into mass, COM, inertia or collision geometry.

Discontinuities settle endpoints; renderer recreation gets a settled initial interval. Already published owner sequence markers survive runtime disposal/startup through synchronized properties, while the saved physical record omits interpolation history. The runtime replaces an owner before its sequence/reset domain is exhausted. The new entity and attachment start settled, without wrapping a sequence on an existing client entity.

## Persistence and lifecycle

`DynamicProperty.PhysicsState` stores schema version 1, catalog identifier/fingerprint/representation/renderer reference, pose, COM linear and world angular velocities, mass/COM/restitution/gravity overrides, loads and sleep/pause state. Transient terrain/renderer pauses are re-evaluated on restoration. No wall-clock timestamp or elapsed unloaded motion is replayed.

Discovery and entity-load events restore compatible owners. Invalid schemas, missing catalog entries and mismatched physical/render asset fingerprints retain the original entity and stored bytes and emit typed diagnostics. `retry()` repeats discovery after an external repair. Duplicate persisted body IDs retain both entities but attach only the first compatible owner and report `DuplicateOwner`.

`remove()` deletes the owner and its attachment. `transfer()` moves an owner, removes old-dimension contacts and recreates its attachment with a settled interval. Chunk invalidation drops live solver/renderer state while retaining the owner save. Disposal and failed startup release subscriptions and attachments idempotently. Diagnostic callback failures do not interrupt cleanup. The Bedrock host removes only helpers and marked transient anchors belonging to its pack namespace, including orphans observed by later entity-load events. It creates no ticking areas.

## Terrain

Terrain queries share a per-tick permutation cache. Swept query neighborhoods include translation, gravity/loads and angular reach. Unavailable terrain pauses a retained body; the next loaded tick resumes a terrain-induced pause without elapsed-time catch-up. The default global read budget is 32,768 blocks, configurable to 1..1,000,000. Collider capacity follows the world's body budget. Failures report `Terrain` or `UnloadedTerrain` instead of silently treating unknown chunks as air.

The resolver handles ordinary full cubes, slab halves, straight/inner/outer stairs, connected fences/walls/panes, gates, doors, trapdoors, snow layers, carpets, pressure plates, farmland/path and soul sand. It resolves connection/orientation state and reads neighbors where needed. Unknown solid permutations get a reported conservative full-cube fallback. These are explicit collision approximations and require engine/client qualification for target content versions.

`registerTerrain(resolver)` gives an add-on resolver priority over the built-in resolver and returns an idempotent unregister function. Return block-local shared `AABB` values, an empty array for no collision, or `undefined` to delegate. Neighbor reads share the cache and must be available. Invalid boxes pause/report their users. Content identifiers and block states stay pack-defined literals; script-owned keys live in `keys.ts`.

## Native contacts

The bridge reads native engine AABBs and measured displacement each tick. Native tick velocities convert to blocks/second at the adapter boundary; returned contact delta velocities convert back before `applyImpulse`. Proxies have an 80 kg effective mass, zero inverse inertia, no custom gravity and no sleep. The existing custom solver supplies impulses, CCD and custom angular response. Actual current overlap drives terrain-checked separation; predicted locomotion is not replayed as a position correction.

Support uses a projected foot point in body-local coordinates, preserving independent walking displacement while transporting translation and rotation. Upward native intent releases helpers/support and uses the reported launch velocity immediately. `tryTeleport` checks blocks and preserves native velocity. Queries are limited to 128 native actors per dimension; overflow is reported. Support helpers are reused during sustained contact and capped globally at 64 by default (configurable to 0..256). Owner removal/unloading, loss of support, jumping and disposal release them. Helpers never replace authoritative custom collision and are not created per triangle, cell or face.

## Validation

Run `npm run verify --workspace bedform` for host, declaration, packed-consumer and lint checks. `npm run test:physics:bds --workspace bedform` compiles real fixture owners, runs the generated helper probe and runtime checks, shuts down the actual process, and reopens the same disposable world to check restoration and orphan cleanup. It uses the fixed `Package/Bedform/dist/bds-runtime/bedrock_server.exe`, a lock and unique test worlds. `BDS_PATH` selects an extracted BDS installation (a directory with `bedrock_server.exe`, `behavior_packs` and `resource_packs`). Without that override, the runner tries the repository root `Server` directory, then its existing fixed-path Bedform runtime. An invalid explicit override is an error, rather than a fallback. Source worlds, custom packs and server configuration are never copied. No WorldRealism installation or generated files are required. `BDS_TEST_WORLD` optionally selects an offline world containing `level.dat`; without it, preparation briefly boots a new private disposable vanilla world on the same fixed executable, stops it cleanly and uses its engine-saved metadata as the template. Its log is retained as `bootstrap.log`, and previous runtime properties are restored after bootstrapping. The client gallery applies its own flat grass/creative/peaceful settings to a copy of that metadata. Run the repository firewall setup explicitly if required; ordinary tests never elevate. The fixture's explicitly named ticking area is test scaffolding only.

Optional `clock` and `metrics` options observe complete runtime ticks without changing the authoritative step. The clock returns milliseconds; frozen `TickMetrics` report total, solver and property/persistence publication durations, terrain reads, actual owner/active counts, terrain/native contacts, failures and clock validity. Clock and metrics-sink exceptions are isolated. Proxy/terrain bodies are excluded from owner counts. See the [acceptance record](physics-acceptance.md) for benchmark methodology and measured failures.

Host/engine assertions do not prove intermediate client frames, late-join property timing, absence of doubled native smoothing, two-player walking/jitter, or downstream live particle-locator behavior. Those acceptance boundaries remain recorded on the owning Beads issues. The sustained performance campaign failed its target; `MineCraft-8zu.5` remains in progress. Client acceptance remains open with a [prepared two-client procedure](physics-client-validation.md).

See the [validation record](physics-runtime-validation.md) for the tested engine, commands, evidence hashes and remaining acceptance boundaries.
