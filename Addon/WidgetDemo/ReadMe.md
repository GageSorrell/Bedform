# Spatial widgets demonstration

A small, self-contained BDS world for trying what the Bedform React port and
spatial widgets (`Bedform-ty2k`) can do so far. It runs from its own server
directory with its own copy of the engine, so it never touches
`C:\MineCraft\Server` or its worlds.

## Start it

From the repository root:

```sh
npm run demo:widgets --workspace @sorrell/widget-demo
```

Or run `Start Demonstration.cmd` in
`Addon/WidgetDemo/Demonstration/widgets/server`. The server listens on port
**19133** (IPv6 19134), so it can run alongside the main server on 19132; other
demonstrations share 19133, so stop them first. The console shows the LAN
address and port once the scene is ready. Enter `stop` or press Ctrl+C
to save and shut down. On first use, run `npm run firewall:configure` from an
administrator-approved prompt so Windows Firewall admits the demonstration's
fixed `bedrock_server.exe`.

Connect from Minecraft and accept the resource packs. Players join as
operators in creative mode and receive a **Widget Wand** and a **Widget Key**.

## What to try

Look south from spawn at the row of panels, eight blocks away. From left to
right they are:

1. **Gallery.** An imperative BedformCanvas surface with no React. It shows
   vanilla button, toggle, slot and HUD art at GUI scale, plus a marquee of
   legacy-computing and octant glyph particles. The glyph textures are white
   and are tinted per glyph; the marquee scrolls inside a clipping viewport.
2. **Controls.** A counter with − and + buttons, a toggle and a click-to-set
   slider. Use the slider where you want the value. **No line** hides your
   pointer line but still works. **Near only** has a five-block maximum
   distance: walk closer for it to become usable.
3. **Access.** **Take a turn** sits under an access controller that admits one
   player at a time: a second player gets a red line until the first looks
   away. **Lock to me** and **Unlock** change the controller on the next input
   update. **Needs the key** requires the Widget Key in your hand (magenta line
   otherwise), and **Disabled** is disabled.
4. **Scrolling.** A clipped list with a `"hover"` scrollbar. Aim at the list's
   right edge to reveal the scrollbar, privately for you. Use on a row picks it;
   Use on the scrollbar track pages down. **Up** and **Down** scroll by one
   row. The stone pillar in front of the
   list blocks the pointer, which shows world occlusion.
5. **Status.** A private panel that only you see. It follows your pointer
   through `useSyncExternalStore`: target, distance, and either "ready" or the
   reason you are denied.

Pointer line colors:

| Color | Meaning |
| --- | --- |
| White | A plain surface |
| Cyan | A control you can use |
| Orange (briefly) | You pressed Use on it |
| Red | Another player has the seat, or the seat is locked |
| Magenta | You are not holding the required key |
| Gray | The control is disabled |

Hold the wand or the key and press **Use** to activate the control under the
pointer. Activation proxies and gestures (`Bedform-ty2k.15`) are not built
yet, so this item-Use routing is demonstration glue.

With two players, try the seat, the lock and the hover scrollbar together:
each player has their own pointer, hover and status panel.

## Known limits

- **Painting.** The particle painting in `Script/Backend.ts` is
  demonstration-only. Bedform's own widget backend, the real Button, Slot and
  Bar artwork components, and nine-sliced frames are separate open issues.
  Text comes from Bedform's in-progress TextPrimitive surface (`ty2k.11`), so
  text fonts and fallbacks (`ty2k.12`) are not finished either.
- **Text orientation.** Canvas surfaces and pointer targeting treat a View's
  +Z side as its front. The in-progress text surface currently sends a yaw
  that faces the −Z side. `Script/TextFlip.ts` turns the text around by
  default. If panel text is mirrored or missing, run
  `/scriptevent widget_demo:text_flip` to switch between the two orientations
  and note which one reads correctly.
- **Particle depth.** Canvas's usual particle material (`particles_blend`)
  never writes depth, so stacked widget layers draw in the client's particle
  order and flicker like z-fighting. The demo starts with the new depth-writing
  `_oriented_depth` variants (`particles_alpha`). They are alpha-tested, and
  they may be visible from one side only. Run `/scriptevent widget_demo:depth`
  to switch between the two. Please note whether the depth variants stop the
  flicker and are visible from the front of the panels.
- **Client checks.** Layer depths, hand placement, line thickness and text
  scale are uncalibrated estimates awaiting client checks (`ty2k.18`).

## Rebuild it

```sh
npm run demo:prepare --workspace @sorrell/widget-demo
```

Set `BDS_PATH` to an extracted stable BDS installation before preparing the
server when `C:\MineCraft\Server` is unavailable.

Preparing rebuilds BedformCanvas and the demo packs, then recreates the server
from the tracked `TestWorld/level.dat` flat creative seed, keeping any previous
server directory as a timestamped backup. The server must be stopped first.
The ground strip and pillar are built once, on the first start.

Smoke check without a client, from this directory:

```sh
node --import tsx ../../Script/Deprecated/Demonstration/Source/start.mts --server Demonstration/widgets/server --stop-after-ready
```

Host checks: `npm run check --workspace @sorrell/widget-demo`.
