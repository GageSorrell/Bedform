# Entity Use capture qualification

`MineCraft-b2bb.1` is **resolved by an explicit user assumption**: use
`playerInteractWithEntity` for both starting and stopping control interaction.
Proceed with `b2bb.4` on that basis. Missing physical targeting/repeat traces do
not block integration, and the simulated result does not justify requiring a helper.
Physical mouse/controller checks remain later acceptance work, not proven results.

The native probe establishes simulated raycast targeting and shows that the tested
helper is targetable by another simulated player. It does not establish physical
Use edges, repeat suppression, or grab/second-Use release. The observations below
are retained as diagnostic evidence rather than a rejection of the chosen signal.

## Reproduction and evidence

From `E:/MineCraft`:

```powershell
npm run test:toggle --workspace @sorrell/look-input-demo
npm run typecheck --workspace @sorrell/look-input-demo
npm run lint --workspace @sorrell/look-input-demo
npm test --workspace @sorrell/look-input-demo
npm run test:native --workspace @sorrell/look-input-demo
```

The new runner uses the fixed
`Addon/LookInputDemo/dist/bds-runtime/bedrock_server.exe`, a fresh disposable world
per run, and only official engine files from `BDS_PATH` (default
`C:/MineCraft/Server`). It never copies production worlds or changes that server.
Its pack identities differ from the normal demo, avoiding client cache collisions.
The normal LookInputDemo source, item behavior, and installed demonstration are
unchanged. Both fixtures reuse its current camera implementation; the client
recorder also reuses its look measurement and recentering implementation.

Native evidence is written to `dist/toggle-probe.log` and
`dist/toggle-probe.json`. A successful `TOGGLE_CAPTURE_PASS` means that the
diagnostic assertions ran successfully, **not** that the input contract qualified.
The [retained native result](ToggleCapture.results.json) is the observed snapshot
for this report. Lint, both typechecks, all **17 host regressions**, the existing
native look probe, the new native probe, and stable client-recorder startup smoke
passed. No physical-client observations were performed.

Observed on release **BDS 1.26.63.1, build 53340801**:

| Observation | Native result | Implication |
| --- | --- | --- |
| Explicit entity interaction, then stop and interact again | Both accepted | Native interactable content works |
| Initial view ray at target | Hit | Baseline targeting established |
| Frozen camera, hidden yaw about 29.05 degrees away | Target missed; simulated `interact()` false | Simulated raycast Use misses; physical-client targeting remains unknown |
| Invisible non-physical helper placed on hidden view ray | Owner hit; `interact()` true | Helper can intercept the divergent ray |
| Second simulated player looks at that owned helper | Hit; `interact()` true | Ownership metadata and disabled physical collision do not isolate simulated targeting |
| Before/after entity events during simulated calls | Zero, including accepted calls | Simulated interaction cannot qualify event dispatch or repeat semantics |
| Inventory before and after all operations | Unchanged empty inventory | No temporary item replacement or grant |
| Teardown | Both actors removed; permissions restored; players disconnected; ticking area removed | Normal native teardown verified |

The helper has an empty render-controller list, an interactable collision box,
and disabled physical collision/gravity. Its ownership receipt is probe-only.
There is no claim that all possible helper designs are impossible; this candidate
has not established the contract and no replacement has qualified. In particular, cancellation
of another player's helper event does not retarget their action to the entity or
block behind it. Client visibility and effects still require observation.

The installed stable `@minecraft/server` 2.10.0 typings expose only `Jump` and
`Sneak` in `InputButton`; neither entity-interaction event exposes
`isFirstEvent`. See Microsoft's [entity interaction event reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerinteractwithentitybeforeevent?view=minecraft-bedrock-stable)
and [InputButton reference](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/inputbutton?view=minecraft-bedrock-stable).
A time cooldown cannot reliably distinguish a new press from a held repeat when
both produce the same event sequence. Do not reuse the item demo's five-tick
cooldown as evidence for entity repeat suppression. Simulated `interact()` and
`interactWithEntity()` calls are not physical hold/release input.

## Physical-client recorder

Launch the **diagnostic**, rather than changing the normal item demo:

```powershell
npm run probe:toggle:client --workspace @sorrell/look-input-demo
```

Connect a physical client to port **19134** and accept the qualification resource
pack. This mode uses stable server APIs with no GameTest experiment or simulated
players. It creates a new Creative/Peaceful world each launch and grants no items.
It is a laboratory: arrivals/respawns receive ordinary movement/camera permissions.
It does not implement the final persisted recovery or input classifier.

The target is invisible above a gold floor marker at `0.5 -60 2.5`. Position the
test player using the server console:

```text
tp @a 0.5 -60 0.5 facing 0.5 -59 2.5
```

The first target interaction freezes the camera for at most **30 seconds**.
Further entity events are logged with tick, player, device mode, target/helper,
ownership and underlying rotation as `TOGGLE_CLIENT_USE`. They deliberately do
not toggle release: there is no qualified fresh-press classifier. All recorded
target/helper interactions are cancelled to keep their authored action harmless.
The recorder writes `dist/toggle-client.log` when the server stops.

Use these server-console commands between trials:

```text
scriptevent look_probe:reset reset
scriptevent look_probe:helper on
scriptevent look_probe:helper off
```

Changing helper mode resets capture. The next grab creates a session-owned helper
only when enabled. Reset, expiry, death, respawn, disconnect, dimension change,
target/helper loss and update errors retire the session and attempt helper cleanup.
Cleanup attempts continue if a player handle has become invalid. A reconnect
restores ordinary camera/movement permissions. Type `stop` into the runner's
console for reset followed by graceful shutdown. An abrupt process termination
is not a verified cleanup path; subsequent launches use a fresh world.

For a headless startup check only:

```powershell
node --import tsx Addon/LookInputDemo/Tool/ToggleProbe.mts --client --smoke
```

Later client acceptance observations, for both mouse and controller:

1. Record one tap, holding Use for several seconds, then release and a fresh tap.
   Preserve the event ticks and physical timing. Establish whether held repeats
   exist and whether a fresh press has any distinguishing signal.
2. Repeat after hidden aim diverges in both directions, including pitch/yaw
   recenter corrections, with helper off and on. Establish delivery independently
   of the displayed frozen aim.
3. With a second player, aim through/across the helper at another interactable
   entity or block. Check interception, physical movement, helper visibility,
   prompts and unrelated item/block actions. Repeat with both empty and occupied
   hands; compare all stack counts and metadata before/after.
4. Exercise reset, expiry, disconnect/reconnect, death/respawn, dimension changes
   and helper/target removal. Verify helper absence and camera/permission restore.
5. Demonstrate grab followed by second-Use release with no held-repeat oscillation
   using the assumed entity-interaction signal. This recorder alone does not
   establish that physical behavior.

These observations are no longer prerequisites for `.4`, under the user's explicit
instruction to assume the event works. Do not infer a passing client test from
server startup, the item demo, or native raycast results.

`playerInteractWithEntity` remains the intended acquisition signal and may also
be sufficient for release. The simulated player's `interact()` implementation
raycasts from the player head. This is not evidence that a physical client sends
its interaction target using that same ray while a free camera is active. It may
target the entity under the displayed frozen camera instead. Physical event traces
can resolve that question during later acceptance. Do not claim an engine delivery
blocker or require a helper from the simulated test. Held-Use repeats and fresh-press distinguishability remain
physical-client questions; the absence of an explicit edge field alone does not
prove that the event stream needs a repeat filter.
