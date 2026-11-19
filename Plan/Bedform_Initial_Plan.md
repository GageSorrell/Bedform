# Create `bedform`

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

## Summary

Create `Package/Bedform` as the ESM TypeScript package `bedform`, version `1.0.0`, providing functional gesture detection and Bedrock response utilities.

Depend on `effect-bedrock@1.0.0`. Use its existing functional utilities throughout: immutable state, tagged unions, `Option`, `Result`, pattern matching, and pipeable functions. Keep Bedrock subscriptions and callbacks in a small imperative adapter.

## Package and public API

> Historical: the public `Gesture`, `Recognizer` and `bedform/Bedrock` APIs below were removed by [`Plan/Bedform_World_Plan.md`](Bedform_World_Plan.md) (`MineCraft-ukid`). Their replacement is the input signals on `world.afterEvents` from `bedform/World`.

- Follow workspace conventions: `Source`, emitted `Distribution`, declarations, package exports, and build/typecheck/lint/test scripts. Update the workspace lockfile.
- Export `Gesture` from the root and `bedform/Gesture`; export the Bedrock adapter through `bedform/Bedrock`. Importing the pure API must not load `@minecraft/server` or install subscriptions.
- Provide validated constructors for `tap`, `doubleTap`, `nTap`, `hold`, `doubleTapAndHold`, and generalized `nTapAndHold`. Constructors return `Result` with typed configuration errors.
- Provide pure recognizer creation, input transition, tick advancement, and player-reset functions. State operations support both data-first and pipeable invocation and return immutable state plus emitted events.
- Provide an explicit adapter `start` function accepting gesture/handler bindings and returning a disposable handle. No automatic startup.
- Declare `@minecraft/server` as a peer dependency compatible with stable 2.x; use `2.10.0` for development typings.
- Apply repository TSDoc, namespace extraction, and PascalCase constant conventions. Use `@since 1.0.0`.

## Controls and gesture behavior

- Support four distinct controls: `Jump`, `Sneak`, `ItemUse`, and `ItemUseOn`.
- Map jump/sneak to `playerButtonInput`; map item controls to their respective start/stop event pairs. Do not combine item sources or infer presses from successful-use events.
- Document charging-item, block-use, and touch-sneak limitations using the [official input documentation](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/ScriptAPI/minecraft/server/InputButton.md) and [event documentation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable).
- Use configurable integer game-tick timings: maximum tap duration **5**, maximum release-to-next-press gap **5**, and hold threshold **10**. Tap duration may be zero; gaps may be zero; hold thresholds and tap counts must be positive. Reject nonfinite or fractional values.
- Count taps on release. Duration and gap limits are inclusive. An invalid tap or expired gap resets the sequence; the next press may begin a new sequence.
- An *n*-tap-and-hold means *n - 1* completed taps followed by holding the *n*th press. Double-tap-and-hold is tap, release, press, hold.
- Emit hold `Start` once at the threshold, `Tick` on subsequent game ticks, and `End` on release. End events distinguish release from lifecycle cancellation.
- Registrations match independently. Each completed match consumes its own sequence, preventing overlapping sliding-window matches within that registration.
- Track players and controls separately; ignore duplicate presses and unmatched releases. Use monotonic tick inputs and reject backward time in the pure API.
- Events carry player ID, control, gesture kind, tick, tap count, and hold phase/duration where applicable. Adapter handlers additionally receive the current `Player`.

## Runtime lifecycle and responses

- Use one shared tick interval and shared event subscriptions per adapter instance.
- Begin recognition only from observed presses; never fabricate taps for controls already held at startup.
- Reset player state on departure, death/respawn, or dimension change. Cancel active holds without completing pending tap sequences.
- Make disposal idempotent; cancel active holds, remove subscriptions, clear scheduled work, and release state.
- Keep handlers synchronous. Isolate handler exceptions, report them through an optional error callback with a console fallback, and continue other bindings.
- Clean up partially installed resources if startup fails.
- Add README examples for double-sneak, repeated jump-hold responses, and item double-tap-and-hold, including timing and disposal.

## Validation and assumptions

- Test tap counts, timing boundaries, expired sequences, duplicate edges, same-tick edges, independent matches, player isolation, and hold phases.
- Test immutable transitions, invalid configuration, backward ticks, lifecycle cancellation, callback failures, partial startup failure, and idempotent disposal.
- Use mocked Bedrock signals and ticks for adapter tests. Verify declaration inference, root/subpath imports, package contents, and absence of Node/Web runtime dependencies.
- Run dependency build, package build, source/test typechecks, lint, and host tests.
- No add-on integration, live-world deployment, Effect-runtime expansion, movement sampling, or attack-action support in this version.
- Before implementation, create and claim a Beads issue. No commits, pushes, or remote Dolt synchronization.
