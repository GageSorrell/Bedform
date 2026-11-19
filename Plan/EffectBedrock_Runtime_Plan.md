# Port the Effect runtime to `effect-bedrock`

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

Approved scope extension, recorded November 10, 2026. Beads epic: `MineCraft-isg.21`.
Beads is authoritative for task status; this document records the approved design.

## Context

`effect-bedrock` (Package/Effect, v1.0.0, port of `effect@4.0.5`) has pure modules and a
synchronous Schema subset. It deliberately excludes the Effect executor
(Plan/EffectBedrock_InitialPort_Plan.md:51). The user now wants add-ons to create and
run `Effect`s, including scoped effects, layers and services.

A spike bundled upstream `effect@4.0.5`
into a sandbox with no `setTimeout`/`setImmediate`/`queueMicrotask`/`performance`/
`crypto`/`AbortController`/`process`, driven by a fake `system` tick loop. With only
two replacement services (a `MixedScheduler` whose deferral is `system.run`, and a
`Clock` whose `sleep` is `system.runTimeout`), all of the following worked unchanged:
- services, `Layer.effect` and `Layer.provide`, `acquireRelease`/`addFinalizer`,
  `forkScoped`, `Effect.scoped`, `Deferred`, fibers, interruption, `Schedule.spaced`,
  typed failures and `runSync`;
- a 20k-step loop, spread over 9 ticks.

Without those two services, `Effect.sleep` fails with `ReferenceError: setTimeout`.

**Decisions (approved by the user):**
- **Bedrock integration by injection.** The library never imports `@minecraft/server`.
  It defines a structural `TickSystem`, and add-ons pass their `system` to
  `Bedrock.layer(system)`.
- **Scope.** The `Effect` dependency closure, plus `Fiber`, `ManagedRuntime`, `Ref` and
  `MutableRef`. Queue, PubSub, Semaphore, Latch and Stream are deferred to follow-up beads.
  Effect-based Schema adapters stay excluded.

Package version stays `1.0.0` and `@since 1.0.0`, as in earlier scope extensions.

## Approach

### 1. Record the scope extension
- Add `Plan/EffectBedrock_Runtime_Plan.md` with this design. In
  `Plan/EffectBedrock_InitialPort_Plan.md`, amend the exclusion at line 51 to point to it.
  FileSystem and Path stay permanently excluded.
- Beads: create epic `MineCraft-isg.21` "Port the Effect runtime with Bedrock tick
  services" under `MineCraft-isg`, with child tasks matching steps 2–7 below.
- Claim each task with `bd update <id> --claim` as work starts.

### 2. Vendor the runtime closure from `node_modules/effect/src` (pinned 4.0.5)
**New public modules** (complete, upstream names, `.js` import specifiers, repository
TSDoc/header style as in `Source/Option.ts`):
- Runtime: `Cause`, `Clock`, `Context`, `Deferred`, `Effect`, `Effectable`, `Exit`,
  `Fiber`, `Layer`, `ManagedRuntime`, `Scope`, `Scheduler`, `References`.
- Supporting: `Cron`, `ExecutionPlan`, `Filter`, `Metric`, `MutableHashMap`,
  `MutableRef`, `Pull`, `Redactable`, `Ref`, `Request`, `Schedule`, `Tracer`.

**New private internals:** `internal/core.ts`, `internal/effect.ts` (≈3.4k lines),
`internal/layer.ts`, `internal/schedule.ts`, `internal/references.ts`,
`internal/tracer.ts`, `internal/request.ts`, `internal/executionPlan.ts`,
`internal/metric.ts`, `internal/random.ts`, and `internal/dateTime.ts`. The last one is
private and needed only by `Cron`; `DateTime` stays unexported.

The upstream closure is 36 missing files, about 30k emitted JS lines including docs.
Port it bottom-up: core → effect → Exit/Cause/Context → Scope/Layer → Schedule/Clock →
the rest.

**Unify the extractions that the earlier work made from upstream `internal/core.ts`,**
so there is one runtime protocol:
- `internal/core.ts` becomes the single home of `EffectProto`, `PipeInspectableProto`,
  Cause/Exit primitives and `YieldableError`/`TaggedError`.
- `internal/inspection.ts` and `internal/data.ts` become thin re-exports, plus Data's
  non-core remainder, so existing importers keep working.
- `internal/data-types.ts` re-exports the real `Effect`/`Cause` types instead of its
  private contracts.
- `internal/filter.ts` re-exports the new public `Filter.ts`, and
  `internal/redactable.ts` the new public `Redactable.ts`.
- Restore upstream's redaction lookup of the current fiber
  (`globalThis["~effect/Fiber/currentFiber"]`). This is upstream behavior, scoped to each
  pack's script context; record it in PROVENANCE.

**Repository conventions:**
- Extract inline property object types into same-named namespaces.
- Private constants use PascalCase; public API names stay as upstream.
- Use file-local lint exceptions as in `internal/data.ts`.
- Add exports to `Source/index.ts`, to `package.json` `exports`/`typesVersions`, and to
  the `files` list for new docs.

### 3. Adapt host globals without installing polyfills
| Upstream use | Adaptation |
|---|---|
| `Scheduler.ts` `setImmediate`/`setTimeout` default | Keep upstream's try/catch microtask fallback as the default. Bedrock add-ons override it via step 4. |
| `ClockImpl.sleepMillis` `setTimeout` | Keep for hosts that have it; when absent, die with a descriptive defect ("provide Bedrock.layer(system)") instead of a `ReferenceError`. |
| `monotonicNowNanos` (`process.hrtime`, `performance`) | Unchanged; upstream's `Date.now` fallback applies. |
| `AbortController`/`AbortSignal` (`callback` withSignal, `tryPromise`, `abortSignal`) | New private `internal/abort.ts`, used only when `globalThis.AbortController` is absent. Public declarations use a port-local structural `AbortSignal` interface so consumers need no DOM lib. Record as a declaration adaptation. |
| `internal/uuid.ts` `crypto.getRandomValues` | Fall back to `Math.random` bytes when `crypto` is absent; document as non-cryptographic. |
| `Error.stackTraceLimit`/`captureStackTrace` | Reuse the existing `internal/stackTraceLimit.ts`; span stack capture degrades on QuickJS. |
| `Symbol.dispose`/`asyncDispose` (`acquireDisposable`, `Scope`) | Guarded property lookups; add the disposable lib to tsconfig. |
| `node:async_hooks` (`AsyncResource`) | Already guarded with `?.`/`try`. |

Set `lib` explicitly in `Package/Effect/tsconfig.json` (`ES2022` plus the disposable lib,
no DOM) so host-global uses fail typecheck, and fix any fallout in existing sources.

### 4. New port-specific module `Source/Bedrock.ts` (`effect-bedrock/Bedrock`)
- `interface TickSystem { run(cb): number; runTimeout(cb, ticks?): number; clearRun(id): void; readonly currentTick: number }`.
  This structurally matches `@minecraft/server` `System` (2.0.0–2.10.0).
- `TickMillis = 50`, and `ticks(n): Duration`.
- `makeScheduler(system, { budgetMillis })`: a `Scheduler.Scheduler` built on
  `MixedScheduler`'s injectable deferral. It continues via microtasks while the current
  tick's elapsed time is under budget (tracked per `currentTick`), then defers with
  `system.run`. The budget is configurable with a conservative default. Pure
  `system.run` deferral is the fallback if BDS shows microtasks misbehave.
- `makeClock(system)`:
  - times come from `Date.now`;
  - `sleep` is `runTimeout(max(1, ceil(ms / 50)))`, with `clearRun` on interruption;
  - `ms <= 0` yields, and non-finite durations never resume, as in upstream.
- `TickSystemService` (`Context.Service`), and `layer(system, options?)`, which provides
  Scheduler, Clock and TickSystemService.
- `nextTick`: an Effect that resumes on the next tick via `system.run`. It is the
  documented way to leave before-event read-only context.
- `disposeOnShutdown(runtime, shutdownSignal)`: subscribes to a structural
  `{ subscribe(cb) }` (e.g. `system.beforeEvents.shutdown`) and closes the
  `ManagedRuntime` with `runSyncExit(runtime.disposeEffect)`. Async finalizers can't
  finish there; report that through `console.warn`.
- TSDoc example: `ManagedRuntime.make(Layer.mergeAll(Bedrock.layer(system), AppLive))`,
  `runtime.runFork` in after-event handlers, and `Effect.runSync` for before-events.

### 5. Tests (`Package/Effect/Test`, following `Match.test.mts` / `Data.test.mts` patterns)
- **`Runtime.test.mts` (differential and parity).**
  - Check runtime export and declaration parity of every new module against pinned
    `effect@4.0.5`, expanding namespace-extracted interfaces and normalizing the
    `AbortSignal` adaptation.
  - Check behavior against upstream: gen/flatMap/catch, Exit/Cause shapes, Context
    services, Layer memoization and dependency order, Scope finalizer order (success,
    failure, interrupt), Deferred, fork/join/interrupt, Schedule, Ref, and ManagedRuntime.
- **`Bedrock.test.mts`.**
  - Fake `TickSystem` and a `vm` sandbox with no Node/Web globals, reusing the spike
    harness.
  - Assert tick-accurate `sleep` and `Schedule.spaced`, clearRun on interrupt, the budget
    split for long loops, `nextTick`, and `disposeOnShutdown` finalizer order.
  - Cover `runSync` with sync layers, and the default-clock defect message.
- **Data/Schema regressions.** `Data.TaggedError` now yields into the ported fiber; Schema
  classes still work. Update `Test/Data.test.mts` private-contract checks for the
  unified core.
- **Packed consumer and audit.**
  - Root and direct imports, plus `typesVersions`.
  - Private paths stay rejected.
  - Emitted-JS scan rejects unguarded `setTimeout`/`setImmediate`/`queueMicrotask`/
    `performance`/`crypto`/`AbortController`/`process` and any `@minecraft/*` import.
  - Tree-shaking: a pure `Option` import pulls in no runtime.
- **Package scripts:** `lint:runtime`, `test:runtime` and `verify:runtime`, chaining
  existing `test:data`, `test:schema`, `test:match` and `test:collections`.

### 6. BDS evidence
- Implement the runtime portion of `MineCraft-isg.8`:
  - a fixture add-on that runs the spike scenarios through `Bedrock.layer(system)`;
  - a fixed `Package/Effect/dist/bds-runtime/bedrock_server.exe` runner, modeled on
    `Addon/BuildCraft/Tool/BdsRunner.mts` / `Addon/IndustrialCraftRewired/Tool/gametest-runner.mts`;
  - firewall entries in `Script/configure-test-firewall.ps1` and `Script/TestFirewall.md`.
- Assertions: microtask draining and write privilege after a before-event, the effect of
  the scheduler budget on the watchdog, and finalizers on shutdown.
- Missing prerequisites are reported as unrun, never as a pass.

### 7. Documentation
- New `RUNTIME.md`: usage, the Bedrock layer, tick semantics, and before-event and
  shutdown limits. Also cover stale entities across sleeps, QuickJS stack-trace limits,
  and Cron named time zones that need `Intl`.
- Update the README module table and PROVENANCE (sources, SHA-256 of
  `src/Effect.ts`/`internal/effect.ts`, every adaptation in step 3, and the core
  unification).
- Remove `Addon/IndustrialCraftRewired/Script/Utility/Effect.ts` only in a separate
  migration bead, not here.

## Critical files
- New: `Package/Effect/Source/{Effect,Exit,Cause,Context,Layer,Scope,…,Bedrock}.ts`,
  `Source/Internal/{core,effect,layer,abort,…}.ts`, `Test/{Runtime,Bedrock}.test.mts`,
  `RUNTIME.md`, `Plan/EffectBedrock_Runtime_Plan.md`.
- Modified: `Source/index.ts`, `Source/Internal/{data,data-types,inspection,filter,redactable}.ts`,
  `package.json`, `tsconfig.json`, `PROVENANCE.md`, `README.md`, `Test/Data.test.mts`,
  `Plan/EffectBedrock_InitialPort_Plan.md`.

## Verification
1. `npm run verify:runtime --workspace effect-bedrock`: typecheck (source + tools),
   build, focused lint, Runtime/Bedrock tests, packed consumers, audit.
2. Regressions: `verify:schema`, `verify:match`, `verify:collections`, `verify:unit` and
   `test:data`.
3. Sandbox acceptance: the Bedrock test reproduces the spike results:
   - layer open/close order;
   - heartbeat every 2 ticks;
   - interrupted sleeper;
   - long loop spread across ticks with per-tick time under budget.
4. BDS: the fixture runner on BDS 1.26.60.6 produces machine-readable pass markers. If
   prerequisites are missing, report BDS as unverified.
5. Handoff: report changed files, validation results and bead status. No commit, push
   or Dolt sync without explicit approval (conservative profile).
