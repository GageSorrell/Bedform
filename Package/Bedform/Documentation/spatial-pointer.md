# Spatial pointer targeting and lines

`Spatial.Pointer` (`Source/Spatial/Pointer.ts`) finds what each player's crosshair
is aiming at among committed spatial widgets and draws a pointer line from the
player's estimated hand to that point. Importing it starts nothing. A tracker
runs only after `Pointer.Start`, and every native service it uses is passed in.

Activation proxies and gestures (`ty2k.15`) build on this module. They are not
implemented here. The tracker provides the hooks they need: `Press` and
`Retain`. Access policies are applied through [access control](spatial-access.md).

## Starting a tracker

```ts
import { Spatial } from "bedform";
import { MolangVariableMap, system, world } from "@minecraft/server";

const tracker = Spatial.Pointer.Start({
    World: world,
    System: system,
    // Renderer roots satisfy Pointer.Source: { Layout, Audience }.
    Sources: () => roots,
    CreateVariables: () => new MolangVariableMap(),
    OnError: error => console.warn(error)
});

tracker.Subscribe(states => {
    for (const [ playerId, state ] of states) {
        // state.Target, state.Eligible, state.Denial, state.Line ...
    }
});

// After an observed Use (for example from an activation proxy):
tracker.Press(player.id);

tracker.Dispose();
```

Each tick, the tracker does the following for every valid online player:

1. It reads the view ray. By default this is `getHeadLocation()` and
   `getViewDirection()`; the `View` option overrides it.
2. It intersects the ray with every `View` plane in the player's dimension, using
   only the sources whose `Audience` contains the player's id.
3. It applies world occlusion (see [Occlusion](#occlusion)).
4. It resolves the hit's interactive control and the reason, if any, that the
   player is denied (see [Eligibility](#eligibility)).
5. It admits players through the access policies of their targets
   (see [access control](spatial-access.md)), then calls the optional `Admit`
   hook with the interactive candidates that are still eligible.
6. It colors the line and draws it, privately for that player.

`Update()` runs one pass immediately. Tests and callers that step targeting
themselves use it. `Get(id)` and `All()` return the latest frozen states. A
player has a state only while a widget surface is hit.

`Renderer.Root.Audience` lists the ids of viewers that currently hold a
presentation lease for the root. A root is therefore targetable only by the
players it is shown to. After `Unmount` the list is empty.

## Geometry and hit ordering

- **Planes.** A View's visible face is its local +Z side, the side toward which
  `Layer` depth offsets point. Rays work at any rigid quaternion orientation.
  `Intersect` returns the distance along the normalized ray, the world point and
  the committed local point (`Layout.Unproject`). Rays from behind the face miss
  unless `DoubleSided` is set. Parallel and degenerate rays always miss.
- **Nearest surface.** `Cast` compares Views by distance along the ray. Within a
  View, `Regions` orders painted regions from front to back: higher `Layer`
  first, then later paint order. Ties between Views keep the earlier source.
  `Range` (default 64 blocks) bounds the search.
- **Painted surfaces.** These are leaves, panels, controls, text, images and any
  item with a `BackgroundColor`. Pure layout containers (`View`, `Row`, `Column`,
  `ScrollView`, `Tabs`, title/heading/content slots) paint nothing, so rays pass
  through their empty areas.
- **Controls.** A hit's `Control` is the hit item or its nearest interactive
  ancestor. Interactive items are `Button`, `Toggle`, `Slider`, `TabButton`, any
  item with `OnActivate`, and ScrollView tracks. Text inside a button therefore
  targets the button.
- **No click-through.** The nearest surface always wins, whether or not it is
  interactive. A noninteractive or denied surface blocks the controls behind it.
- **Hidden and clipped items.** Items hidden by `Visible={false}` or React's
  hidden state never take part. Items clipped by a `ScrollView` viewport can be
  hit only inside the clip. A clipped child therefore neither intercepts the
  pointer nor reaches admission outside the viewport.

## Occlusion

By default, the tracker measures the distance to the first solid world block with
`Dimension.getBlockFromRay`, excluding liquids and passable blocks. A widget
surface farther away than that block is occluded.

- **Flush surfaces.** A surface flush with a block face still wins within
  `Defaults.OcclusionTolerance` (0.01 blocks).
- **Overrides.** `Occlusion: false` disables occlusion. A function replaces the
  native raycast.
- **Failures.** A raycast that throws fails closed for that tick: nothing is
  targeted. The failure is reported once until it clears.

## Eligibility

`Deny` checks the item that governs the hit. That is the control, or the surface
when nothing interactive was hit. It checks these in order:

| Denial | Cause |
| --- | --- |
| `"disabled"` | `Pointer.Enabled === false` (inherited) or the control's `Disabled` prop |
| `"distance"` | The hit is beyond the inherited `Pointer.MaxDistance`, in blocks from the eye |
| `"item"` | The held item (`HeldItem` option; by default the main hand) differs from any `RequiredItem` on the item or its ancestors, including `InputScope`s |
| `"access"` | An `Access` policy on the item or an ancestor does not admit the player: a lock, a predicate or a player limit (see [access control](spatial-access.md)); or the optional `Admit` hook denies the player |

`Deny` checks only the first three. Access needs every player's hit at once, so
the tracker applies it afterwards for all eligible hits, interactive or not,
including pointers whose lines are hidden. A hit is `Eligible` when it has a
control and no denial. The optional `Admit` hook receives the interactive
candidates that are still eligible and returns the ids it denies. If `Admit` or
the access engine throws, the affected candidates are denied for that tick.

## Lines

- **Path.** The line runs from the hand to the hit. `EstimateHand` places the
  right hand 0.45 blocks forward, 0.3 right and 0.3 down from the eye
  (`Defaults.Hand*`); these values await client tuning. The `Hand` option
  overrides the estimate.
- **Drawing.** By default the line is one Canvas `bedform_canvas:rectangle`
  oriented particle. It is laid along the segment, turned about its axis to face
  the eye, and emitted only to the aiming player. `Thickness` defaults to 0.02
  blocks. Like other Canvas particles, it has a two-tick lifetime and is
  refreshed every tick. `Draw` replaces the particle line, for example for tests
  or another backend.
- **No surface.** When no widget surface is hit, the player has no state and no
  line is drawn.
- **Hidden lines.** `Pointer.Visible={false}` hides only the line. Targeting,
  eligibility and admission counting are unchanged.
- **Maximum distance.** Beyond `Pointer.MaxDistance` the line is hidden, and the
  hit is denied with `"distance"`.

### Colors

`Pointer.DefaultColors` is frozen:

| Key | Value | Used for |
| --- | --- | --- |
| `Surface` | `#FFFFFF` white | Noninteractive or denied hits |
| `Interactive` | `#54FFFF` cyan (Bedrock aqua) | Eligible interactive hits |
| `Use` | `#FFAA00` orange (Bedrock gold) | Eligible hits for `Defaults.PressTicks` (4) updates after `Press` |

A denied press stays white.

`Pointer.Color` is a reactive callback prop, inherited like other pointer
settings. It receives a frozen context: the player id, the target
(`Id`, `Type`, `Part`, `Interactive`, `Distance`), the input state (`HeldItem`,
`Use`), the `Denial`, `Eligible` and the `Default` color. It returns any Canvas
tint, or `undefined` to keep the default. Because it is a prop, a new commit
changes the color on the next update. A callback that throws falls back to the
default color and is reported once.

## ScrollView tracks

A `ScrollView` whose content overflows its scroll axis, and whose
`scrollbarVisibility` is not `"hidden"`, has a committed `Item.Track`. This is the
rectangle where its scrollbar would be drawn: `Layout.ScrollbarThickness`
(6 pixels) along the content box's right edge (vertical) or bottom edge
(horizontal).

- **Painting.** The track is painted above the ScrollView's descendants and
  clipped like the ScrollView itself, so ancestor viewports also clip nested
  tracks.
- **Targeting.** A track hit has `Part: "track"`, and its control is the
  ScrollView. A `"hover"` track can be targeted while its scrollbar is not drawn.
- **Visibility.** `tracker.ScrollbarVisible(id, source, item)` is always true for
  `"always"`. For `"hover"` it is true only for a player whose eligible pointer is
  on the track, or who holds `Retain(id, source, itemId)` during an active
  scrollbar gesture. It is false without a track. Visibility is decided per
  player, so one player's hover does not show the bar to others.
- **No overflow.** No track exists. Scrollbar artwork, arrows, thumb geometry and
  gestures belong to `ty2k.21`.

## Limits and qualification

- **Hit depth.** Hit-testing treats a View as one plane. Layer depth offsets (a
  few thousandths of a block) do not change hit distances.
- **Face sidedness.** Only the +Z face is targetable unless `DoubleSided` is set.
  Whether the client draws widget particles from behind is a client acceptance
  question.
- **Proxies.** A hidden, clipped or offscreen control never becomes a target, so
  an activation proxy derived from the target state has nothing to keep.
  Placing and removing proxies belongs to `ty2k.15`.
- **Client acceptance.** These need client observation: line appearance,
  thickness, hand placement, controller and touch view rays, and the occlusion
  feel near block faces.
