# Plan: `bedform/Clock/Monotonic`

## Context

Bedform has no shared clock for measuring elapsed time. Timing code calls `Date.now()` directly: `Source/Internal/PhysicsProfile.ts:91`, and the `clock` default at `Source/PhysicsRuntime.ts:628`. `Date.now` can jump backward. `effect-bedrock` has `Clock.monotonicTimeNanos`, but on BDS, where there is no `performance` global, it returns `max(previous, Date.now())` (`Package/Effect/Source/Bedrock.ts:194`, `Package/Effect/Source/Internal/effect.ts:9161`). After a backward jump, that value stops advancing until the wall clock catches up, which can take hours.

Goal: a new `bedform/Clock/Monotonic` module with:
- a synchronous plain-function clock that does not need Effect, and
- an adapter that installs it as the monotonic source of effect-bedrock's `Clock` service.

`bedform/Clock` becomes a namespace. Later modules that extend the system-clock and world-clock APIs will go there.

Decisions you made:
- Provide both the plain API and the Effect adapter.
- A backward jump counts as zero elapsed time, and the clock keeps advancing normally afterward.
- Use a high-resolution source when the host has one.

## Layout

This follows the existing `Utility/index.ts` + `Utility/Name.ts` and `Spatial/index.ts` + `Spatial/Intent.ts` pattern.

- `Source/Clock/Monotonic.ts` (new, `@module bedform/Clock/Monotonic`): the implementation.
- `Source/Clock/index.ts` (new, `@module bedform/Clock/index`): the `bedform/Clock` barrel. It contains `export * as Monotonic from "./Monotonic.js";` with `@category Exports` / `@since 1.0.0` TSDoc. Future system-clock and world-clock modules get added here.
- `Source/index.ts`: add `export * as Clock from "./Clock/index.js";` with TSDoc.
- `package.json` exports:
  - `"./Clock"` → `Distribution/Clock/index.{d.ts,js}`
  - `"./Clock/Monotonic"` → `Distribution/Clock/Monotonic.{d.ts,js}`

## Design: `Source/Clock/Monotonic.ts`

Module header per CLAUDE.md. Copy the jsdoc lint-context comment from `Source/Ray.ts`. Every symbol gets `@category` and `@since 1.0.0`. Do not import `@minecraft/server`, so the module stays in the pure build. Reading the module never reads a clock. Import effect-bedrock's Clock as `EffectClock` so it does not shadow the `bedform/Clock` namespace.

**Types**
- `interface MonotonicClock { now(): number; elapsed(since: number): number }`
  - Readings are milliseconds from an arbitrary origin and may be fractional. They are for subtracting only, never for serializing.
  - `elapsed(since)` returns `Math.max(0, now() - since)`.
- `interface Options { readonly source?: () => number }`. The source is a raw millisecond reader and is injectable for tests.

**Core algorithm** (inside `make`, per clock)
- State: `baseline: number | undefined` and `elapsed = 0`.
- On each `now()`:
  1. Read the source inside try/catch.
  2. If the read throws or is not finite, return `elapsed` unchanged. A failing source must never throw out of `now()`, matching the PhysicsProfile rule that "a failed clock cannot interrupt".
  3. If `baseline` is unset, set it to the reading and return `elapsed`.
  4. Otherwise compute `delta = raw - baseline`. Add `delta` to `elapsed` only if it is greater than 0. Always set `baseline = raw`, which re-anchors after a backward jump.
- Result: readings never decrease, and a backward jump costs no time beyond the jump itself.

**Exports**
- `hostSource(): () => number`
  - Detects `performance.now` through a structural cast of `globalThis`, because the pure tsconfig has `types: []`. Uses the same pattern as `Package/Effect/Source/Internal/host.ts`.
  - Falls back to `Date.now`. On BDS this means `Date.now`; in Node tests and tooling it means `performance.now`.
- `make(options?: Options): MonotonicClock`. The source defaults to `hostSource()`, detected at construction.
- `now(): number` and `elapsed(since: number): number`. These use a shared default clock, created lazily on the first call so that importing the module has no side effects (`sideEffects: false`).
- Effect adapter. Import from `effect-bedrock/Clock`, `effect-bedrock/Effect` and `effect-bedrock/Layer`.
  - `toClock(base: EffectClock.Clock, clock?: MonotonicClock): EffectClock.Clock`
    - Returns `base` with `monotonicTimeNanosUnsafe` / `monotonicTimeNanos` replaced by `BigInt(Math.round(clock.now() * 1_000_000))`. `clock` defaults to `make()`.
    - Keeps `base`'s wall-time readings and `sleep` unchanged, so Bedrock tick sleeps still work.
  - `layer(options?: Options): Layer.Layer<never>`
    - Implemented as `Layer.effect(EffectClock.Clock, EffectClock.clockWith((base) => Effect.sync(() => toClock(base, make(options)))))`.
    - It wraps whatever `Clock` is current where it is built. Document the intended composition: `Layer.provideMerge(Monotonic.layer(), Bedrock.layer(system))`.
    - Confirm during implementation that `Layer.effect` accepts the `Context.Reference` `Clock.Clock`, as `Layer.succeed` does in `Bedrock.ts:263`. If it does not, use the closest equivalent effect-bedrock API.

## Other wiring

- `package.json` scripts:
  - `lint:clock`: `eslint Source/Clock Test/Clock*.mts`
  - `test:clock`: `npm run build && node --import tsx --test Test/Clock*.test.mts`
- `ReadMe.md`: add a `bedform/Clock` section that introduces the namespace and its `Monotonic` module, in the style of the Ray section (around line 738), with a usage example and an API table.
- Leave PhysicsProfile and PhysicsRuntime unchanged; adopting the new clock there is out of scope. File a bead for that follow-up.

## Tests

Test files stay flat, because `npm test` globs `Test/*.test.mts`.

- `Test/ClockMonotonic.test.mts` (header `@module bedform/Test/ClockMonotonic.test`):
  - The first reading is 0. Forward steps accumulate, including fractional ones.
  - A backward jump is absorbed: the source sequence 100, 150, 50, 70 gives readings 0, 50, 50, 70.
  - A source that throws, returns NaN or returns Infinity leaves the reading unchanged and never throws.
  - `elapsed` is never negative.
  - The default `now()` never decreases across repeated calls.
  - `hostSource` picks `performance.now` in Node.
  - Effect: provide a fake base `Clock` with `Layer.succeed`, layered under `layer({ source })`.
    - `Clock.monotonicTimeNanos` reflects the injected source and absorbs backward jumps.
    - `currentTimeMillis` and `sleep` still come from the base clock.
  - Root (`Clock.Monotonic` from `bedform`), `bedform/Clock` (`Monotonic`) and `bedform/Clock/Monotonic` imports all resolve to the same functions.
- `Test/ClockMonotonic.types.mts`: public-signature fixtures, as in `Test/Ray.types.mts`.

## Tracking

Run `bd create` for the feature and claim it. Close it when verification passes. File a follow-up bead for adopting the clock in PhysicsProfile and PhysicsRuntime. Do not commit or push.

## Verification (in `Package/Bedform`)

- `npm run typecheck` and `npm run typecheck:pure`. The pure build proves there is no Node or `@minecraft/server` dependency.
- `npm run test:clock`
- `npm run typecheck:tools`
- `npm run lint`
- `npm test`. This includes `Package.test.mts`, which checks that both new export entrypoints are published.
