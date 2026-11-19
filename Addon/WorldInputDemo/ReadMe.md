# World Input Demo

An isolated Creative, Peaceful flat world for trying out the `@bedform/server` input signals
(`MineCraft-ukid`) on real Bedrock clients. The behavior pack bundles `@bedform/server`; there is
no resource pack, primer or experiment. The server listens on **port 19133** (IPv6 19134) so it
can run alongside the main server on 19132. The engine is copied from `C:/MineCraft/Server`,
whose worlds and configuration are untouched.

```powershell
npm run demo:prepare --workspace @sorrell/world-input-demo   # build and (re)create the server
npm run demo:world-input --workspace @sorrell/world-input-demo  # launch it
```

Connect to the LAN address the launcher prints (or `127.0.0.1` on this PC), port `19133`.
Enter `stop` in the server console, or press Ctrl+C, to shut it down. Recreating the server with
`demo:prepare` keeps a full timestamped backup of its predecessor. Other demos also use 19133
for IPv6, so stop them before launching this one.

## What you see

- **Action bar:** `Move x … y …` is the raw `inputInfo.getMovementVector()` for this tick.
  Positive x is Left and positive y is Forward. `Held:` lists buttons between their observed
  Down and Up. `Last:` shows the latest edge, and a hold in progress shows its live duration in ticks.
- **Chat:** Press, DoubleTap, TripleTap, Hold, PressAndHold and DoubleTapAndHold, including hold
  `Start` and `End` with the end reason. `/scriptevent world_input:chat buttons` limits chat to
  Jump and Sneak; `all` and `off` are the other modes.
- **Server console:** every Down, Up and gesture, prefixed `WORLD_INPUT <playerId>`, including
  cancelled holds whose player has already left.

Default timing: a short press lasts at most 5 ticks, a hold starts at 6 ticks, and taps in a
sequence may be at most 5 ticks apart (20 ticks = 1 second).

## Qualification checklist (MineCraft-ukid.6)

Record the device, input method, client version and what you observed for each item. Host tests
and server logs do not count as client acceptance.

1. **Axis signs.** Walk forward, back, left and right. Forward gives positive y; Left gives positive x.
2. **Eight directions (keyboard).** Hold each of W, S, A, D and the four diagonal pairs. A diagonal
   also holds both of its cardinals. Example: `Held: Forward Right ForwardRight`.
3. **Releasing one diagonal component.** While holding W+D, release D. Only Right and ForwardRight
   are released; Forward stays held.
4. **Controller dead zone.** Push the left stick slowly. A direction activates only once that axis
   exceeds 0.20 in magnitude; exactly ±0.20 is inactive. Changing magnitude within the same
   directions produces no new edges.
5. **Touch.** Repeat 1–3 with the touch joystick or D-pad. Note how touch Sneak behaves (it may
   release immediately even while your finger is down).
6. **Timing.** Tap Jump quickly for Press (≤5 ticks). Hold it for Hold `Start` at 6 ticks, a rising
   live duration, then `End (Release)`. Tap twice or three times for DoubleTap and TripleTap. Tap
   once then hold for PressAndHold. Tap twice then hold for DoubleTapAndHold. Repeat with Sneak
   and a movement direction.
7. **Startup while held.** Hold W, run `/reload`, keep holding, then release. There must be no
   Down or Press for that held press. The next fresh press is recognized normally.
8. **Lifecycle cancellation.** Hold Sneak until Hold `Start`, then run `/kill @s`. Expect
   `Hold End (Death)`, and no Press or tap from that press when you release it. Repeat the hold
   with `/execute in nether run tp @s 0 100 0` and expect `End (DimensionChange)`. Disconnecting
   mid-hold logs `End (Leave)` on the console only.

## Known limitations

- Movement that is pressed and released entirely between two tick samples cannot be recovered
  from the sampled vector. Jump and Sneak come from native button events, so their quick taps
  are not lost this way.
- Native button input currently exposes only Jump and Sneak. Item use is not an input control.
- Touch Sneak may report a release immediately even while the finger remains down.

```powershell
npm run typecheck --workspace @sorrell/world-input-demo
npm run lint --workspace @sorrell/world-input-demo
npm test --workspace @sorrell/world-input-demo
```
