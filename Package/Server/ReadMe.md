# `@bedform/server`

Bedform's counterpart to [`@minecraft/server`](https://www.npmjs.com/package/@minecraft/server).

It re-exports all of `@minecraft/server`, which it requires as an exact peer dependency: the game provides the module at runtime, so your add-on's manifest must declare the matching module version.
Bedform adds its extensions here, and where an extension replaces a first-party export, it shadows it.

## Versions

This package's version is the version of `@minecraft/server` that it tracks, followed by a channel suffix:
`-dev.N` on the `Master` branch and `-beta.N` on the `Beta` branch. For example, this release tracks
`@minecraft/server@2.11.0`.

## World input

`@bedform/server` exports `world`, a live forwarding facade with the native World methods
and events, and an enhanced `world.afterEvents.playerButtonInput`. Import `InputButton`
from the same module for native Jump/Sneak values and the eight player-relative movement
directions. The signal retains native `subscribe`/`unsubscribe`, `buttons` and `state`
filters, and the `player`, `button` and `newButtonState` event fields. Native event objects
are forwarded unchanged. An unfiltered callback must accept movement buttons too; use
an explicit native button list with a callback typed for native-only events.

Movement uses the raw input vector once per tick, with a 0.2 dead zone on each axis.
ForwardRight activates Forward, Right and ForwardRight together; releasing Right keeps
Forward active. Existing held movement is baselined without a synthetic press. Imports
are inert, and the final input unsubscription releases the shared sampler. Movement
pressed and released entirely between samples cannot be recovered. The facade has its
own identity and leaves the native singleton unchanged. Pure root imports remain inert.

`world.afterEvents` also provides derived button signals for every `InputButton`:
`playerButtonDown`, `playerButtonUp`, `playerButtonPress`, `playerButtonHold`,
`playerButtonNTap` (requires a positive integer `count`), `playerButtonPressAndHold` and
`playerButtonNTapAndHold` (also requires `count`). Each accepts a `buttons` filter; gesture
signals accept `maxPressTicks`, `holdTicks` and `maxGapTicks` (defaults 5, 6 and 5), and hold
signals accept a `phase` filter of `Start`, `Tick` or `End`.

```ts
import { InputButton, world } from "@bedform/server";
import type { PlayerButtonGestureAfterEvent } from "@bedform/server";

function onDoubleSneak(event: PlayerButtonGestureAfterEvent<typeof InputButton.Sneak>): void
{
    event.player.sendMessage(`Double sneak at tick ${event.tick}`);
}

world.afterEvents.playerButtonNTap.subscribe(onDoubleSneak, {
    buttons: [ InputButton.Sneak ],
    count: 2
});
```

Events carry `button`, `player`, `playerId`, `tick`, `tapCount` (completed short presses,
excluding a held final press) and `duration` (of the final press). Hold events add `phase`;
`End` adds `reason`, which is `Release` or a cancellation: `Leave`, `Death`, `Spawn`,
`DimensionChange` or `UnavailableInput`. A cancelled `End` may have an undefined `player`.
Leaving, dying, respawning, changing dimension or unreadable input discard unfinished
progress without completing a press or tap. Each subscription recognizes independently and
never inherits a press that began before it. All input signals share one native subscription
set and one sampling interval, released after the final unsubscription; a failing callback
is reported without affecting other listeners.

### Input signals

`InputButton.Jump` and `InputButton.Sneak` come from native `playerButtonInput` events, so
their transitions are observed even between samples. The eight movement directions come
from the sampled movement vector described above. Touch sneak may be released immediately
even while the finger remains down. Item use is not an input control: add-ons that need
item-use gestures recognize `itemStartUse`/`itemStopUse` themselves.

See the official [button input documentation](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/ScriptAPI/minecraft/server/InputButton.md).

```ts
import { InputButton, world } from "@bedform/server";
import type { PlayerButtonHoldAfterEvent } from "@bedform/server";

function onJumpHold(event: PlayerButtonHoldAfterEvent<typeof InputButton.Jump>): void
{
    if (event.phase !== "End")
    {
        event.player.addEffect("slow_falling", 2);
    }
}

world.afterEvents.playerButtonHold.subscribe(onJumpHold, {
    buttons: [ InputButton.Jump ],
    holdTicks: 15
});

// Later, from the add-on's own shutdown or reconfiguration path:
world.afterEvents.playerButtonHold.unsubscribe(onJumpHold);
```

A callback typed for some buttons or phases needs a matching `buttons` or `phase` filter;
an unfiltered callback must accept every button and phase. `subscribe` returns the callback
for `unsubscribe`, and subscribing the same callback again replaces its options and progress.
Invalid options throw `TypeError` before any native resource is acquired.

Taps are counted on release. Press duration and release-to-next-press gap limits are inclusive,
and zero allows same-tick presses and gaps. Subscriptions match independently: a Press fires
even when its release also completes an N-tap. Each subscription consumes its complete
sequence, so triple-tapping produces one double-tap match. Long presses, expired gaps and
failed final holds reset that subscription's sequence.

Hold `Start` fires once at `holdTicks`, `Tick` on each later observed tick, and `End` on release.
A release exactly at the threshold emits `Start` then `End` whether or not that tick has been
sampled yet. Repeated sampling within a tick emits no duplicate phase; skipped ticks are
observed once, without replay. A `phase` filter hides other phases without changing recognition.

Callbacks are **synchronous**; do not return promises. Exceptions go to `console.error`
while other listeners continue.
