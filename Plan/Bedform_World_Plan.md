# Add `bedform/World` input events

Use only `MAJOR.MINOR.PATCH` in symbol-level `@since` tags. Prerelease suffixes (`-alpha.*`, `-beta.*`, `-rc.*`, or any other prerelease identifier) and build metadata (`+...`) must never appear in `@since` tags; for example, package version `1.0.0-alpha.1` uses `@since 1.0.0`.

Module TSDoc headers must not contain `@category` or `@since`; these tags apply only to symbol documentation. Follow the repository's TypeScript module header format for file-level metadata.

## Summary

Add `bedform/World`, exporting `world` with native World behavior and enhanced input signals. Support Jump, Sneak, Forward, Backward, Left, Right, and the four diagonal combinations.

Remove the public Gesture, Recognizer, and Bedrock gesture APIs. Keep reusable recognition machinery private.

This plan supersedes the public gesture API contract in `Plan/Bedform_Initial_Plan.md` for this migration. Beads is the source of truth for implementation status and dependencies.

## Public API

- Export `world`, an extended frozen `InputButton` record, and documented event/options types from `bedform/World`.
- Implement `world` as a forwarding facade that preserves live native properties, native method receivers, and unchanged event-signal identities. Do not modify the native singleton.
- Preserve `afterEvents.playerButtonInput.subscribe(callback, options)` and `unsubscribe(callback)`, including native `buttons` and `state` filters. Forward native events unchanged; emit equivalent movement events containing `player`, `button`, and `newButtonState`.
- Add these separate signals under `afterEvents`:

| Signal | Meaning |
|---|---|
| `playerButtonDown` | An observed press begins |
| `playerButtonUp` | A previously observed press is released |
| `playerButtonPress` | A short press completes on release |
| `playerButtonHold` | The initial press reaches the hold threshold |
| `playerButtonNTap` | N short presses complete |
| `playerButtonPressAndHold` | One completed short press, then another press held |
| `playerButtonNTapAndHold` | N completed short presses, then another press held |

- All new signals support button filtering. N-tap signals require a positive integer `count`.
- Gesture subscriptions support `maxPressTicks`, `holdTicks`, and `maxGapTicks`, defaulting to **5, 6, and 5**. Validate safe integer values; press/gap limits allow zero, and hold must exceed the press limit.
- Hold-family events expose `Start`, `Tick`, and `End`, with an optional phase filter.
- Derived events include the button, player ID, tick, completed tap count, and final-press duration. Normal events include `player`; cancelled hold-end events allow an unavailable player and identify the cancellation reason.
- New signals cover buttons only; do not add ItemUse or ItemUseOn to the public input controls.

Example:

```ts
import { InputButton, world } from "bedform/World";

world.afterEvents.playerButtonNTap.subscribe(onDoubleSneak, {
    buttons: [InputButton.Sneak],
    count: 2
});
```

## Detection and recognition

- Sample every player's raw `inputInfo.getMovementVector()` once each tick. Compare current and previous direction states; never infer controls from position or velocity.
- Apply a shared **0.2 dead zone per axis**: magnitudes at or below 0.2 are inactive. Use player-relative axes: positive X is Left, positive Y is Forward.
- Activate diagonals when both component directions are active. ForwardRight therefore activates Forward, Right, and ForwardRight together. Magnitude changes within the same active directions produce no edges.
- Preserve native Jump/Sneak events to capture transitions occurring between tick samples.
- Count taps on release, with inclusive press-duration and release-to-next-down limits. Match subscriptions independently: Press fires immediately even when its release contributes to another gesture.
- Consume completed sequences within each registration without overlapping sliding-window matches. Invalid durations, expired gaps, and failed final holds reset that registration's sequence.
- Emit hold Start at the threshold, Tick once per subsequent observed tick, and End on release. Handle release exactly at the threshold consistently regardless of callback ordering.
- Start recognition from observed transitions. Baseline already-held movement controls without fabricating Down or gesture events; new subscriptions do not inherit unfinished presses.
- Share one sampling interval and native subscriptions while listeners exist. Remove resources after the last listener unsubscribes. Isolate callback failures and make dispatch safe against subscription changes.
- Reset player progress on departure, death, respawn, dimension change, or unavailable input. Cancel active holds without completing presses or taps.

## Migration

- Create and claim the appropriate Beads implementation subtask before implementing it. Follow the dependency order recorded in Beads.
- Remove the three legacy package subpaths and root Gesture/Recognizer exports. Add the World subpath without introducing runtime imports into Bedform's pure root.
- Move reusable recognition code behind private boundaries and replace legacy public examples and tests with the new signal API.
- Replace Microblocks' Gesture/Recognizer dependency with private item-use recognition, preserving its nine-tick press limit, ten-tick rotation cadence, skipped-tick behavior, and context cancellation.
- Update affected active documentation and outstanding Beads specifications that reference the removed APIs. Preserve historical completion records while identifying the replacement API.
- Preserve package versions and follow repository module-header and TSDoc conventions, including semantic PascalCase categories and the current owning package version in symbol-level `@since` tags.

## Validation and acceptance

- Test all eight directions, simultaneous cardinal/diagonal activation, dead-zone boundaries, unchanged vectors, direction changes, and release of one diagonal component.
- Test every gesture's timing boundaries, independent matches, counts, duplicate edges, same-tick edges, player isolation, subscription changes, hold phases, and lifecycle cancellation.
- Verify native payload forwarding, filters, receiver binding, unchanged signals, lazy startup, cleanup, and partial-startup failure.
- Verify packed declarations and exports, rejection of removed subpaths, pure-root imports, and absence of Node/browser runtime dependencies.
- Run Bedform's full verification and Microblocks' lint, typechecks, and host tests. The Bedform build and source/tool typechecks passed during planning on November 12, 2026, after refreshing ignored build output; this is a baseline, not validation of the planned feature.
- Qualify movement-axis signs, keyboard diagonals, controller dead-zone behavior, touch input, and hold timing on real clients. Document that movement transitions entirely between samples cannot be recovered from the sampled vector.
- Keep client acceptance separate from host-test results. Use fixed executable paths for any BDS runner work; no deployment, commit, push, or remote Dolt synchronization is included.
- Keep real-client qualification open until observed evidence is recorded. Missing physical-device evidence must not be reported as a host-test pass.

## Beads implementation order

Epic: `MineCraft-ukid` - Add bedform/World input signals and replace public gesture APIs.

Each subtask links to this plan. Blocking dependencies enforce the order below; status remains in Beads.

| Subtask | Work | Depends on |
|---|---|---|
| `MineCraft-ukid.1` | Private button gesture recognition | None |
| `MineCraft-ukid.2` | World facade and movement edge sampling | `MineCraft-ukid.1` |
| `MineCraft-ukid.3` | Gesture signals and shared lifecycle management | `MineCraft-ukid.2` |
| `MineCraft-ukid.4` | Legacy API removal, Microblocks migration, and documentation | `MineCraft-ukid.3` |
| `MineCraft-ukid.5` | Package and migrated-consumer verification | `MineCraft-ukid.4` |
| `MineCraft-ukid.6` | Physical Bedrock client qualification | `MineCraft-ukid.5` |
