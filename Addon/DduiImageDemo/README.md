# Transactional DDUI Demo

A four-player Creative/Peaceful flat-world fixture for `MineCraft-53dn.6`.

## Held cube follows the camera (1.1.82)

The held cube's resting place is now fixed relative to the camera, not the
player's yaw alone. Its center is 2 blocks along the view and 0.6 blocks
toward the bottom of the screen, so the cube rises and falls as the player
looks up and down. Looking straight down puts it 2 blocks below the eyes
(into the floor, which stops it) and 0.6 blocks behind. The cube also turns
to face the player's yaw with `setRotation`, through a damped spring with
the same constants as its movement. Turning speed changes by at most 10° a
tick and is capped at 30°. Whether the client smooths those rotations has
not been checked.

## Held cube (1.1.81)

Each joining player gets a stone cube, `ddui_demo:held_cube`, carried the
way Amnesia: The Dark Descent carries a held object (`Source/HeldCube.js`).
Its resting place puts its center 2 blocks ahead of the player's eyes
(horizontally, along the player's yaw) and 0.6 blocks below them. Nothing
fixes it there. Each tick, the script sets its velocity, as the attached
orbit's carrier does, to:

- what it really moved last tick,
- plus 0.08 × the distance to its resting place (the spring),
- plus 0.35 × (its resting place's movement last tick − its own) (the
  damping).

The change is limited to 0.3 blocks per tick and the speed to 1.5. Damping
the velocity relative to the resting place's lets the cube keep up with a
steady walk without trailing behind. It lags and swings behind turns,
starts and stops, overshoots a little (a damping ratio of about 0.6) and
settles back in about a second. It has no gravity but collides with blocks,
so a wall stops it until the player turns away.

The cube follows its player into other dimensions. If it is missing,
unloaded or more than 8 blocks off, it is placed at its resting place
again. It is removed when the player leaves. Strays saved in unloaded
chunks are removed when they load, and at startup. A script reload gives
everyone present a new cube. The server log reports `HELD_CUBE spawned`.
How it feels in the client has not been checked.

## Hop test (1.1.80)

At the right end of the flat dimension's movement row, 11 blocks along it
from its center, two stone cubes stand 1 block apart, their bottoms 1 block
above the ground. Each rises 4 blocks and falls back, forever
(`Source/HopTest.js`):

- **Left: `applyImpulse`.** `ddui_demo:impulse_hop` has gravity but no block
  collision. Each launch clears its velocity and applies one upward impulse.
  From then on, only the engine's gravity moves it. On the tick before it
  would pass its start, its velocity becomes the remaining distance, so it
  lands on the start, and the next tick launches it again. After each hop,
  the script scales the launch by the square root of the rise it wanted
  over the rise it measured.
- **Right: a client animation.** `ddui_demo:animated_hop` stays put on the
  server. At every launch of the left cube, `playAnimation` restarts
  `animation.ddui_demo.hop.launch` on it. That animation moves the model's
  `cube` bone along the closed form of the same flight:
  `236.142807 × (1 − 0.98ⁿ) − 3.92 n` blocks after `n` ticks, for a launch
  of 0.8029 blocks per tick. It holds at the bottom from landing (20.1
  ticks) to its end (21 ticks).

**Result (server):** a custom entity with `has_gravity` falls like a mob.
Each tick, it moves by its velocity, then its velocity becomes
`(v − 0.08) × 0.98`. An impulse sets that velocity in blocks per tick. The
first hop, launched at the model's 0.8029, rose 3.997 blocks in 21 ticks,
the model's prediction for whole ticks. After one correction (0.8032),
every hop rises 4.000 blocks and lands 0.000 blocks from its start. The
server log reports hops 1–5 and every 20th as `HOP_TEST hop`. Whether the
two cubes look alike in the client, and whether `playAnimation` restarts
the right cube's flight every time, have not been checked.

## Glyphs packed with no gaps (1.1.79)

A glyph's stand-in no longer follows from its code point, which left 409
slots empty: unassigned and dropped Legacy Computing characters, their wide
copies, and Minecraft Ten's control-code and lowercase places. Every glyph
now takes the next slot from U+E200, so the 2,407 glyphs fill U+E200–EB66,
ten pages (E2–EB) instead of eleven, and EC–F8 are free:

| Glyphs | Slots |
| --- | --- |
| Legacy Computing (250), sextant completers (4), Supplement (633), octant completers (26) | U+E200–E590 |
| Their wide copies (stand-in + 913) | U+E591–E921 |
| Minecraft Ten (69) | U+E922–E966 |
| Octants (256) | U+E967–EA66 |
| Braille dots (256) | U+EA67–EB66 |

`Source/LegacyComputing.js` builds the stand-in table at load (`LegacyGlyph`
is a lookup, and returns undefined for a character without a glyph), and
`Source/MinecraftTen.js` and `Source/Octant.js` continue the sequence
(`MinecraftTenGlyph`, `OctantBase`, `BrailleDotBase`, `GlyphEnd`).
`Tool/CustomGlyph.mjs` draws every group by slot into shared pages and
refuses to write pages that are not consecutive. Every glyph's pixels are
unchanged: all 2,407 matched their 1.1.78 cells. The contact sheets are now
per cell page, plus `minecraft-ten.png` and `braille-dots.png`.

## Pages packed at the front (1.1.78)

The eleven glyph pages now occupy E2–EC, the front of the Private Use Area
pages the vanilla font leaves free, so ED–F8 are free in one block. Each
page's pixels are unchanged; only its number moved:

| Contents | Before | Now |
| --- | --- | --- |
| Legacy Computing, narrow (completers U+E2FB–E2FE) | E3 | E2 |
| Supplement, narrow (octant completers U+E5C0–E5D9) | E4–E6 | E3–E5 |
| Wide copies (`LegacyWideOffset` 0x900 → 0x400) | EC–EF | E6–E9 |
| Minecraft Ten (`MinecraftTenBase`) | EB | EA |
| Octants (`OctantBase`) | F4 | EB |
| Braille dots (new `BrailleDotBase`) | F8 | EC |

The addresses live only in `Source/LegacyComputing.js`,
`Source/MinecraftTen.js` and `Source/Octant.js`; `Tool/CustomGlyph.mjs`
derives the completers' start, the dot page and the Unifont notice's page
names from them, and `Source/RegionLayer.js` uses `BrailleDotBase`.

## No cyan octants (1.1.77)

The cyan octant page, `glyph_F5.png`, is gone: `OctantColors` holds only
dark gray, so every octant is on F4 whatever the color code. The fireflies
animation's glyph-only copy, the only thing that drew F5, is now all dark
gray; its vanilla Braille canvas keeps its cyan, dark aqua and blue rows.
Every glyph the demo draws is dark gray, except Minecraft Ten's white button
text. Twelve pages are now free.

## No test glyph page (1.1.76)

Page E2 (`glyph_E2.png`) is gone, with the glyphs it held: the custom A at
U+E200, the first proof that the pack's glyph pages load, and the eight
alpha tests at U+E201–E208, which established that any alpha of 1 or more
widens a glyph. `Source/CustomGlyph.js` keeps only `CustomGlyphAdvance` and
`IsCustomGlyph`, which now matches the cell glyphs alone. The pixel offset
row loses the four displays that showed them: the one- and two-line custom
A overlays, their plain comparison and the alpha test. Eleven pages are now
free.

## No dark aqua or blue octants (1.1.75)

The dark aqua (§3) and blue (§9) octant pages, `glyph_F6.png` and
`glyph_F7.png`, are gone: `OctantColors` in `Source/Octant.js` now holds
only dark gray (F4) and cyan (F5), and `OctantGlyph` gives dark gray for
every other code. The fireflies animation's vanilla Braille canvas still
colors its rows cyan, dark aqua and blue; its glyph-only octant copy shows
the cyan rows in cyan and the rest in dark gray. Ten pages are now free.

## No cyan glyph copies (1.1.74)

The cyan copies of the Legacy Computing pages are gone: `glyph_E7.png` to
`glyph_EA.png` (narrow) and `glyph_F0.png` to `glyph_F3.png` (wide), with
`LegacyCyanOffset` and `LegacyCyanGlyph`. Every Legacy Computing glyph is
now dark gray, whatever the color code around it: in the overlays, in
`GlyphOnly` and in the charts, whose row labels still alternate dark gray
and cyan. The glyph-only sample's diagonal zigzag is dark gray too. The
octant pages F4 to F7 keep their four colors, cyan among them. Eight pages
are free.

## Every display in one dimension (1.1.73)

In 1.1.72 the gallery's displays also showed in the flat dimension. The API
draws a shape whose location has no dimension in every dimension, and the
demo created its displays, and moved them with `setLocation`, using bare
coordinates. `AddText`, the texture test, the glyph probe and the movement
tests now create every display with its dimension, and every gallery move
goes through `InOverworld`. After the gallery and after the movement tests,
the server log reports `PRIMITIVE_DIMENSIONS`: how many displays each
dimension holds, and how many are drawn in every dimension. **Result:** the
gallery's 428 displays stay in the overworld and the flat dimension shows
only its 6. There, the velocity-steered `attachedTo` text moves smoothly.

## Flat dimension and movement tests (1.1.72)

The scripts register a custom dimension, `ddui_demo:flat`
(`Source/FlatDimension.js`). The engine generates custom dimensions as void,
so the script lays a superflat floor: bedrock, two dirt and grass, with the
ground top 4 blocks above the dimension's lowest block. A ticking area keeps
the 6 × 6 chunks around its origin loaded and ticking with no player there.
The floor is laid there once they load, and in the chunks within 4 of any
player in the dimension as they load.

A joining player still triggers the overworld gallery's placement, then is
moved to the flat dimension's spawn at 0.5, 0.5, looking south. A respawn
returns to the gallery as before. `/ddui_demo:flat` and `/ddui_demo:gallery`
move any player between the two, without cheats.

The movement tests moved out of the overworld (their 1.1.70 and 1.1.71
entities there are removed when the gallery is placed) into one row 10
blocks south of the flat spawn, all on the same circle and phase (radius 2,
lowest point 0.1 above the ground, 8 seconds):

- **Left: `setLocation` every tick**, a display with no entity (new).
- **Middle: `attachedTo` a velocity-steered carrier** (1.1.70).
- **Right: `attachedTo` a bone-animated entity** (1.1.71; the text does not
  move).

Comparing left and middle shows whether either moves smoothly. In 1.1.73 the
middle one does; the left one's smoothness has not been reported.

## Bone-animated orbit (1.1.71)

Beside the attached orbit, 5 blocks along its row, a second `attachedTo`
display tests client-side bone animation. `ddui_demo:bone_orbit` stands
still on the ground, turned so its model's x axis runs along the row. Its
model's root bone holds a small red cube and loops around the same circle
(radius 2, lowest point 0.1 above the ground, 8 seconds) in the client
animation `animation.ddui_demo.bone_orbit.loop`. The text is attached 0.1
blocks above the entity, so the loop starts with it just under the cube. If
attached text follows the root bone, it rides around under the cube. If it
follows only the entity's location, as the API's "root location of the
attached entity" suggests, it stays at the bottom while the cube loops
alone. **Result: the text did not move.** Attached text ignores client bone
animation.

## Attached orbit (1.1.70)

A new row stands 3 blocks beyond the animation row, facing the same way
(stand beyond it and look back toward the aisle). In it, a small
`attachedTo` display loops around a 2-block circle in the row's plane every
8 seconds. The circle's lowest point is 0.1 blocks above the ground, and a
fixed title stands above it. The display is a `TextPrimitive` with no offset,
attached to `ddui_demo:orbit_carrier`, an invisible entity with no geometry,
gravity or block collision (`Source/AttachedOrbit.js`). Each tick the script
clears the carrier's velocity and applies the step to its next point, so the
server moves it like any moving entity instead of teleporting it. It is
teleported only if it is more than a block off course. Once a loop the
server log reports `ATTACHED_ORBIT largest error` between carrier and target.
**Result: the text moved with the carrier**, which stayed exactly on its
path (0.000 blocks of error per loop). Whether the client draws the motion
smoothly or in 20 Hz steps was not reported. Placing the gallery removes
every earlier carrier.

## Dropped Supplement glyphs (1.1.69)

`LegacyComputingDropped` in `Source/LegacyComputing.js` leaves 62
Supplement characters without glyphs, to free their slots: the aliens, the
robot halves (including the flailing robot's top halves), the racing cars,
the tanks and the outlined letters and digits. Unifont draws them across all
8 columns, so their 7-column copies lost a column. Their narrow, wide and
cyan slots on pages E4–E6, E8–EA, ED–EF and F1–F3 are now empty, and the
charts no longer show them. The seven-segment digits, runners and go-karts
remain.

## High-resolution regions (1.1.68)

The pixel offset row ends with a 12×5-cell glyph-only host. Three 4×3-cell
boxes show the same filled circle and ring in octants at k = 1, 2 and 4,
left to right. Each region adds one transparent, depth-tested primitive at
the host glyph scale divided by k, anchored at A and just in front of B.

`Source/RegionLayer.js` exports pure `RegionText(Host, Box, K, Family,
Inside, Options)`. Host is `{ Cells, Lines, Scale }`, describing glyph
layer A (Scale = RowScale / 2); Box is `{ Column, Row, Columns, Rows }`.
For a seamless `SplitOverlay`, supply the actual glyph grid dimensions
and anchor at Back, including its existing drop. Every host line must
share that grid width, and the box must be blank on every host layer.
Inside receives local sub-pixel centres or is an exact-sized rectangular
bitmap. Families are Octant (2×4), Sextant (2×3), Quadrant (2×2),
SeparatedSextant, SeparatedQuadrant and Braille. Braille uses F8 dot glyphs
on the octant 8×16 grid, rather than vanilla's 3.5-pixel advance. Results
contain Text, Scale, Lines and local right/up LocationOffset in blocks.

Default placement uses compressed blank-cell padding and needs no pixel
calibration. `{ WorldOffset: true, PixelSize: 0.025 }` uses the
**uncalibrated** blocks-per-pixel estimate instead. Lines over 128 UTF-8
bytes throw with a smaller k or box/padding budget. Narrow glyphs retain
a seam of 1/k host fine pixel. The 230 supplement octants are reused;
26 completers occupy E6C0–E6D9, with existing wide/cyan copies. F8 is now
occupied by Braille dots.

```powershell
npm run custom-glyph --workspace @sorrell/ddui-image-demo
npm run test:region --workspace @sorrell/ddui-image-demo
npm run build --workspace @sorrell/ddui-image-demo
```

The PNG simulation checks all 256 narrow octants and 324 placements at
k = 1, 2, 4 across six families, both positioning modes and byte limits.
Inspect `dist/glyph-preview/regions.png` and the page previews. Vertical
centring follows the documented inferred client model. **In-game alignment
and shimmer at k = 4 remain unverified.**

To update the existing demo, stop with `npm stop --workspace
@sorrell/ddui-image-demo` and wait for `dist/bds-runtime/host.pid` to vanish.
Back up both installed demo pack directories and the complete
`worlds/transactional-demo` to a timestamped `dist/before-*` directory.
Copy the built `behavior_packs/ddui_image_demo` and
`resource_packs/ddui_image_demo` into the server's matching pack folders.
Update only those packs' UUID-matched entries in both world pack reference
JSON files to their manifest versions, retaining other references. Start
with `npm start --workspace @sorrell/ddui-image-demo`; check the console for
`TRANSACTIONAL_DEMO_READY 1.1.82`. Keep the fixed executable path;
`prepare:server` refuses to overwrite an existing world.

## Turned row and back row (1.1.24–1.1.25)

- **Turn:** the whole arrangement is turned a quarter turn counterclockwise
  (seen from above) about the selected-character display, which keeps its
  1.1.23 place, 6 blocks ahead and about 2.3 blocks left of spawn. The row now
  runs straight away from spawn, with text facing the spawn side. The
  selected-character display is the row's anchor: when its width changes,
  the browser and everything after it shift instead.
- **Yaw range (1.1.25):** in 1.1.24 the displays were drawn at about 45° to
  their row in the client. The turn had produced yaws outside −180° to 180°
  (as low as −450°); the server stores them unchanged. Yaws are now
  normalized to (−180°, 180°], and the gallery log line reports the facing it
  was placed for.
- **Yaw calibration (1.1.25):** on the first spawn after each server start,
  eight panels appear 25 blocks above the player at yaws 0, 30, 60, 90, −45,
  180, 270 and −270 (labeled), seen through a fixed camera looking south for
  20 seconds. Each panel's apparent width shows the angle the client really
  draws for that yaw. The panels are then removed and the camera restored.
- **Break tests removed (1.1.25):** the eight U+0000…U+2029 break test
  displays are gone; the row now starts with the selected character.
- **Back row:** a straight row 3 blocks (1 block before 1.1.29) behind the browser page, back to back
  with it and facing the other way, centered on the browser's page-0 position
  (about 200 blocks long). Since 1.1.25 every case is its own display, 112 in
  all (`OddCharacterCases` in `OddCharacters.js`), each with its own title
  above it. Titles are wrapped to the display's width at spaces; a wider
  title widens that display's place in the row. In order:
  sixteenth and quarter block arrangements (5), spaces (16), zero-width
  characters (15), direction and tag characters (16), fillers and controls
  (16), combining marks (17), tall and deep glyphs (13), and wide glyphs and
  formatting codes (14).
- **Pixel offset row (1.1.33):** a third row, 10 blocks from the browser
  page on the spawn side, faces the main row across the aisle where you
  arrive (turn around after the join teleport). Two titled displays
  (`Source/PixelOffsets.js`) test moving a bar by less than a glyph between
  fixed brackets; every line is the same width, so centering moves nothing
  else. **Bold spaces:** line k has k bold spaces before the bar and 6 - k
  after it; if a bold space is 5 px against 4, the bar moves right 1 px per
  line. **Braille blanks:** line m has m U+2800 before the bar and 8 - m
  after it; if a braille blank is 3.5 px, the bar moves left 1/2 px per
  line. A ruler of bars 2 px apart is at the top and bottom of each. Both
  displays have `lineGapHeight` -4 (1.1.34).
- **Font switch (1.1.35):** a line containing any character outside the
  ASCII font sheets is drawn wholly in the smaller Unicode font. A third
  offset display tries switch triggers on one bar ruler per line: a bar
  swapped for U+2223, U+2502, U+258F or U+01C0; black U+2223 at both ends;
  and U+2065, U+2069 (empty Unicode-font cells), U+200B, U+2060 and U+FEFF
  (full-cell glyphs) at both ends. The braille display's rulers now use
  U+2223, so they are in the same font as its bar lines. All three offset
  displays have `lineGapHeight` -4.
- **Custom glyph (1.1.38):** the resource pack's `font/glyph_E2.png`
  draws U+E200 (Private Use Area) as a capital A with its crossbar lowered
  and a small square inside, a shape no vanilla page has, so seeing it in
  game proves the pack's glyph page is loaded. `Source/CustomGlyph.js`
  holds the character and its bitmap; `npm run custom-glyph --workspace
  @sorrell/ddui-image-demo` regenerates the page. Vanilla supplies pages E0
  and E1 only, but AdvancedMinimapRewired overrides E2 to F8, every other
  BMP Private Use Area page; a pack replaces a whole page, so the two packs
  must not be used in the same world.
- **Animation row (1.1.67):** the fireflies canvas has left the main row
  for a row of its own, 3 blocks beyond the pixel offset row on the spawn
  side, facing the way the main row does (stand beyond it and look back
  toward the aisle). Right beside it is the same animation as a seamless
  glyph-only display: each Braille cell becomes the octant with blocks where
  it has dots (`Source/Octant.js`; pages F4 to F7 hold every octant pattern
  as a wide glyph in dark gray, cyan, dark aqua and blue), drawn by two
  half-scale layers, with its title on a display above it. Both are set from
  the same moment in the same tick, so they show the same frame. Octants
  exist only wide, so a glyph-only line ending in one gains a blank cell, and
  every glyph-only line is padded with blank cells to the widest, since the
  client centers each line.
- **Seamless glyphs (1.1.66):** the client always leaves 1 empty pixel
  after a glyph's ink, so adjacent custom glyphs never touched. Two new kinds
  of display remove that seam:
  - **Three-layer overlays** (`SplitOverlay(Text, { Seamless: true })`): the
    back is split in two half-scale layers, the back with the background and
    a transparent middle layer `OverlayDepth / 2` behind the front, dropped
    like the back. In each run of adjacent glyphs the two layers take
    alternate cells; each draws its cell with a **wide** glyph, 8 columns of
    ink plus an alpha-1 pixel in column 14, an advance of 16 (two cells), so
    its 1-pixel gap falls in a cell the other layer draws. A cell a layer
    neither draws nor spans is a blank cell. A run's last cell, before text
    or the line's end, keeps its seam. The Legacy Computing charts in the
    pixel offset row are now three-layer; a two-layer copy of the first
    stands beside it for comparison.
  - **Glyph-only displays** (`GlyphOnly`): text made only of cell glyphs
    needs no front, so one half-scale TextPrimitive draws it (seams kept), or
    two (seamless), with no mirrored text, no font switch, no pads and no
    drop. Spaces become blank cells and `§b` picks the cyan glyphs. Their
    gap is 6, so rows are one 16-pixel cell apart. The pixel offset row ends
    with both versions of a sample: sextant rings (`SextantArt`), a cyan
    zigzag of diagonals and a checkerboard.

  Wide glyphs are on pages EC to EF (stand-in + 0x900), their cyan copies on
  F0 to F3. The Supplement's wide glyphs are Unifont's own 8 columns; the
  block's are drawn 8 wide by `Tool/LegacyGlyphs.mjs`, multi-cell pictures
  filling the seam where the art is inked on both sides of a cut. Page E3
  also holds four glyphs that complete the sextants (`LegacyExtraGlyphs`, at
  the unassigned U+E3FB to U+E3FE): full block, left and right halves, and
  a blank cell. Diagonal lines now run between the cell's corners and edge
  midpoints, so neighbors continue at one slope (they met in a flat step).
- **Button text style (1.1.65):** the Minecraft Ten glyphs are drawn as the
  game's button labels are, measured from a screenshot of the title screen's
  Play button: white, with a shadow 1 pixel right and down in #2A5D1B, which is
  black at 30% (Ore UI's `rgba(0,0,0,0.3)` text shadow) over the button's
  #3C8527 face. The shadow is baked opaque, since the client hides glyph
  pixels at alpha 64 or less, so it is right on that green only; the Ten
  display takes that green as its background. The shadow adds a column, so
  each advance is the ink width plus 2.
- **Minecraft Ten (1.1.64):** the game's heading font as custom glyphs, pixel
  for pixel: `Tool/MinecraftTen.mjs` reads the vanilla pack's
  `font/minecraft-ten.ttf` (outlines on a 70-unit pixel grid) and rasterizes
  the 69 printable ASCII characters other than the lowercase letters, which
  Minecraft Ten draws with its capitals' outlines. Stand-ins are U+EB00 plus
  the ASCII code, on `font/glyph_EB.png` (`Source/MinecraftTen.js`); the
  10-pixel capitals sit on rows 4 to 13, as the Unicode font's do. Each
  advance is the ink width plus 1 by the client's rule (Minecraft Ten's own is
  1.43); the space is 3 pixels by two alpha-1 pixels, and the bar's tail
  below row 15 is clipped. A half-scale display in the pixel offset row shows
  them all.
- **Separated blocks (1.1.63):** Unifont's separated quadrants and sextants
  put each block's gutter on its left (columns 0 and 4 empty), so dropping
  column 7 left their right blocks 2 columns wide against 3 on the left. They
  now drop column 0, so every block is 3 wide and the seam is the right
  block's gutter.
- **Rows that stack (1.1.62):** a Unicode-font line is 10 pixels tall, not
  12, so once the chart rows were put in that font (1.1.53) a gap of -4
  spaced them 12 Unicode-font pixels apart and 16-pixel glyphs overlapped.
  `SplitOverlay` now starts every line the large font would draw with the
  hidden font switch, so every overlay line is in the Unicode font, and the
  overlays' gaps are -2 in front (`OverlayFrontGap`) and 6 behind
  (`OverlayBackGap`): both 16 Unicode-font pixels per line, one glyph's
  height. `RowLayout` takes a per-entry `Pitch` for such lines.
- **Chart ranges on the titles (1.1.61):** each full-block chart's range
  (such as `U+1FB00–1FBFF`) moved from the chart's first line, which stuck out
  above the dropped back's background, to a second line of the chart's title.
- **Alpha-1 widening pixels (1.1.60):** the alpha test showed the client
  counts any pixel above alpha 0 toward a glyph's width (alphas 1 to 254 all
  widened it; up to 64 they were invisible). The custom glyph pages' widening
  pixels, which set every glyph's advance, are now at alpha 1 instead of the
  background's gray, so the pages suit any background color.
- **UI textures on cuboids (1.1.59):** `Source/TextureTest.js` places, 6
  blocks behind the browser's viewing spot, four custom blocks and above them
  four custom cube entities, faced with vanilla textures by path: the main
  menu button (`textures/ui/button_borderless_light`), a play screen button
  (`textures/gui/newgui/play_screen/NormalButtonThinNewBevel`), the server
  list icon (`textures/ui/servers`) and stone as a control. Blocks reach them
  through the terrain atlas (`textures/terrain_texture.json`), entities by
  path (`ddui_demo:ui_texture_cube`, texture by variant). A texture the
  client cannot load shows its missing-texture pattern.
- **Alpha width test (1.1.58):** a display in the pixel offset row shows
  glyphs U+E201 to U+E208 eight times each: a white bar in column 1 and,
  except on the "none" line, one white pixel in column 7 at an alpha from 1
  to 255 (`AlphaTests` in `Source/CustomGlyph.js`). Where a pixel of that
  alpha counts toward the glyph's width, its bars are 8 pixels apart, as on
  the "opaque" line; where it does not, 2, as on the "none" line.
- **Bedrock gray (1.1.57):** Bedrock draws §7 as #C5C5C5, not Java's
  #AAAAAA, so marks hidden in §7 showed on the #AAAAAA background. The
  background and the glyph pages' hidden pixels are now #C5C5C5, and the
  cyan pages are Bedrock's §b, #54FFFF (Java's is #55FFFF), per the
  Minecraft Wiki's Bedrock color table.
- **Overlay text color (1.1.56):** the overlays' text and glyphs are
  #4D4D4D, which no color code gives: it is the fronts' display color, lines
  return to it with the reset code (§r) instead of §8, and the glyph pages
  are drawn in it.
- **Overlay colors (1.1.55):** every two-layer display, and the plain
  comparison beside them, is now gray (§7, #AAAAAA) with dark gray text and
  glyphs (§8, #555555); cyan rows stay cyan (§b). Glyphs keep their
  texture's colors, so the custom glyph pages are dark gray (the cyan copies
  cyan), and everything drawn only to place or size something (mirrored
  text, pads, the small-font switch, the pixels that widen glyphs) is in the
  background's gray instead of black (`OverlayColors` in
  `Source/GlyphOverlay.js`).
- **Cyan glyphs (1.1.54):** the client draws Private Use Area glyphs in their
  texture's colors and ignores color codes, so the cyan rows kept white
  glyphs. Pages E7 to EA are cyan copies of pages E3 to E6 (stand-in plus
  0x400, `LegacyCyanGlyph`), and `SplitOverlay` uses them where the front is
  cyan; other colors keep white glyphs. The copies of the Unifont-derived
  pages are listed in `font/LICENSE-Unifont.txt` too.
- **Chart rows (1.1.53):** each full-block chart row starts with a black
  U+2800, which puts the row in the Unicode font, so its label is small; the
  braille blank's dotted outline is black on black. Rows alternate white and
  cyan: `SplitOverlay` now draws each custom glyph in the front's color at
  that point, white by default.
- **Overlay order and titles (1.1.52):** the charts' row labels were hidden:
  the client seems to draw nearer displays last, not in creation order, and
  the dropped back, nearer to a viewer below a tall chart's center, was drawn
  over the front. Both layers now have depth testing, and the back sits
  0.005 blocks behind the front (`OverlayDepth`), so depth keeps the text on
  top. Titles were overlapping tall charts: the client seems to center a
  block on 12 pixels per line whatever its line gap, so with a gap of -4 the
  text reaches higher than its height suggests. `RowLayout` reports that
  reach, and titles stack above it.
- **No calibration view (1.1.51):** the yaw calibration that froze the first
  player to join, high above the gallery and looking at panels of different
  yaws, is removed; its findings are in the notes above.
- **Row height and drop (1.1.50):** the pixel offset row's layout now counts
  its displays' line gap of -4; it took the 17-line charts for 4 blocks tall
  instead of 2.7 and raised the whole row to keep them above the ground, so
  the row is back at eye height, about half a block lower. `OverlayDrop`, how
  far every overlay's back sits below its front, is doubled from 2 to 4
  large-font pixels at the front's scale.
- **Legacy Computing Supplement (1.1.49):** the supplement (U+1CC00 to
  U+1CEBF, 695 characters) is drawn the same way, its stand-ins at U+E400 to
  U+E6BF on `font/glyph_E4.png` to `glyph_E6.png`. Its glyphs are adapted
  from GNU Unifont 18.0.01 (`Tool/Unifont.mjs` downloads it into
  `dist/unifont`; `Tool/LegacySupplementGlyphs.mjs` adapts it): Unifont's
  cells are 8 columns, so a glyph with no ink in column 7 keeps columns 0 to
  6, one that tiles with its neighbors (mosaics, pieces of larger pictures,
  circuit segments) drops column 7 where the seam falls, a standalone picture
  inked only on the right shifts left, and one inked on both edges loses the
  interior column most like a neighbor. `Overrides` holds hand-drawn
  replacements. Unifont is dual-licensed; the derived pages are used and
  distributed under the SIL Open Font License 1.1, whose text and Unifont's
  copyright notice are in `font/LICENSE-Unifont.txt` beside them. The pixel
  offset row has three supplement charts, and the gallery's Octants chart is
  now an overlay too.
- **Symbols for Legacy Computing (1.1.48):** the whole block (U+1FB00 to
  U+1FBFF, 250 characters) is drawn as custom glyphs for the overlay. The
  client has glyph pages only for the Basic Multilingual Plane, so each
  character has a Private Use Area stand-in with the same low byte, U+E300 to
  U+E3FF (`Source/LegacyComputing.js`), drawn by `font/glyph_E3.png`;
  `SplitOverlay` substitutes them and now also keeps color codes in the front.
  Each glyph is a 7 by 16 cell of Unicode-font pixels whose ink spans exactly
  columns 0 to 6, with an opaque black pixel where its white ink falls short,
  so its advance is 8, one space; neighbors keep the game's 1-pixel seam, and
  rows stack with no gap at the overlay's line gap of -4. Sextants, smooth
  mosaics, eighths, triangles, fills, diagonal box drawings and circles are
  drawn from their names on shared anchors (columns split 4 and 3, rows 5, 6
  and 5); shades use the vanilla Unicode font's U+2592 pattern; pictographs
  are hand drawn in `Tool/LegacyGlyphs.mjs`, those spanning two or three
  cells cut into 7-column pieces. `npm run custom-glyph` writes the pages
  and a contact sheet of each, `dist/glyph-preview/glyph-E3.png` and onward. The pixel
  offset row has a full-block chart, and the gallery's Sextants and Diagonal
  lines charts are now overlays. Page E3 is also overridden by
  AdvancedMinimapRewired; the two packs must not share a world.
- **Overlay pad (1.1.46):** every glyph on the second test line sat 1
  Unicode-font pixel left. The client places a line's start at minus half
  its width rounded to whole pixels of the display's font, and that line is
  39 large-font pixels wide, so the front rounded by half a pixel while the
  half-scale back, with pixels half the size, did not. Each overlay line now
  ends with a short black pad (`EvenPad` in `Source/GlyphOverlay.js`), in
  front and doubled behind, that makes its width a multiple of 2, so neither
  layer rounds. The first pads were bars, whose ink reached onto the rows
  above and below; since 1.1.47 pads use characters inked well inside a row
  (U+2219, U+00B7 and l).
- **Overlay fixes (1.1.44):** on the two-line overlay the second line's
  glyphs sat 2 Unicode-font pixels low and 2 left. The back line no longer
  comes from estimated advances: it mirrors the front, every character twice
  in black on black, which at half scale takes exactly that character's
  place, and the custom glyph has a black pixel in column 7 that makes its
  advance two spaces. The back's line gap is 2 less than 12 + 2 x the
  front's (`OverlayBackGap`). A drop of 1.5 large-font pixels left every
  glyph 1 Unicode-font pixel high, so since 1.1.45 it is 2.
- **Overlay fixes (1.1.42 to 1.1.43):** the client centers a line on the
  full sum of its advances, so the "1 px less" versions are gone, and
  `LineWidth` in `Source/Layout.js` no longer subtracts a pixel for the gap
  after a line's last glyph. With the front's `lineGapHeight` at -4 and the
  back's at 4, the front text sat 4 Unicode-font pixels below the custom
  glyphs and stuck out below the back's background. Raising the glyph in its
  page (1.1.42) doubled the offset, so the glyph is back in place and the
  whole back now sits that much lower than the front (`OverlayDrop`, 2
  large-font pixels at the front's scale), by the estimated font pixel size.
- **Overlay prototype (1.1.41):** the scale tests showed the client draws
  every Private Use Area texel as one large-font pixel, whatever the page's
  resolution or the glyph's ink, so `glyph_E2.png` is back to 256 pixels and
  holds only the custom A. At half scale its pixels match the Unicode font.
  Five new displays at the right end of the pixel offset row
  (`Source/GlyphOverlay.js`) layer two TextPrimitives at one place: a back
  one at half scale with the black background and the custom glyphs, padded
  with black-on-black filler, and a front one at full scale with a
  transparent background and the text, with a space where each glyph goes.
  The back is created first, so it is drawn first. Lines are centered, so
  each back line has its front line's width; the displays try both
  assumptions about a line's width (the sum of its advances, or 1 pixel
  less) with one and two lines, beside a plain display of the custom glyph.
- **Custom glyph scale (1.1.39 to 1.1.40):** the custom glyph comes out at
  twice the Unicode font's size, centered on the line, with pixels as big as
  the large font's, whether its page is 256 or 512 pixels square (the client
  cache held the 512-pixel page, so the resolution truly made no
  difference). Two rules fit: every texel of a Private Use Area page drawn as
  one large-font pixel, or every glyph's ink scaled to a fixed height. The
  page now also holds scale tests: bars 20, 10 and 5 pixels tall (U+E201 to
  U+E203), and the A with nearly transparent (U+E204) and opaque (U+E205)
  pixels at its cell's top and bottom.
- **Glyph width measurement (1.1.37):** `npm run measure-glyphs --workspace
  @sorrell/ddui-image-demo` measures every Unicode-font character as the
  client draws it. With the server running and the client joined and
  visible, it sends `/scriptevent ddui_demo:glyph_probe start` through the
  host's console channel (`command.request`, handled by `Tool/Host.mjs`).
  The script (`Source/GlyphProbe.js`) moves the camera to a row of display
  columns east of the gallery, hides the HUD except the action bar, which
  shows the batch, percentage and estimated time left, and shows one batch
  of `Source/GlyphProbePlan.js` lines at a time. Each line is `[ǀ`, 8 copies
  of a character and `]`, with markers in red or blue by batch. The tool
  photographs the game window (`Tool/CaptureWindow.ps1`), reads the bracket
  distances (`Tool/GlyphShot.mjs`) and acknowledges each batch. The first
  photograph sets the scale, and the run restarts with as many columns and
  lines as keep about 1.5 screen pixels per font pixel. Results:
  `dist/glyph-probe/measured.json` and `summary.txt`.
- **Per-line font widths (1.1.36):** the font-switch display showed that
  only U+2502 kept its line in the large font: it is one of the large font's
  438 characters (code page 437 box drawing), while U+2223, U+258F, U+01C0,
  U+2065, U+2069, U+200B, U+2060 and U+FEFF are not. Layout now measures each
  line in the font the client picks for it (see the widths note below).
- **Text Writer (1.1.30):** a new item in hotbar slot 3
  (`ddui_demo:text_writer`, name tag icon). Using it opens a DDUI custom form
  with six text fields, **Line 1** to **Line 6** (one field before 1.1.31),
  and **Confirm** and **Cancel** buttons. Trailing empty lines are dropped;
  empty lines between filled ones are kept. Confirm places a
  TextPrimitive with that text 3 blocks ahead of your eyes, facing you,
  styled like the gallery displays (white on opaque black, scale 0.7875);
  `§` codes work. Each player has at most one: using the item while yours
  is showing removes it instead of opening the form. Empty text, or a line
  over 128 UTF-8 bytes, is refused with a chat message.
- **Facing fix (1.1.29):** the client turns TextPrimitives the opposite way
  to entities: yaw θ shows the text toward (−sin θ, −cos θ). Earlier
  versions used the entity sign, which only works facing north or south, so
  the turned rows faced each other (and, at other join facings, displays sat
  at an angle to their row). Yaws now use the TextPrimitive sign, and
  backgrounds are single-sided, so a row seen from behind is invisible
  instead of covering the row beyond it. Reference text is now light purple
  at 60% opacity (it was light blue at 50%).
- **Fixed placement and join teleport (1.1.27–1.1.28):** the gallery no
  longer follows where you join. It is built once per server start, laid out
  from world spawn (0, 0) looking south, so both rows lie along the world Z
  axis (displays face ±X). Every join or respawn teleports you 4 blocks in
  front of the Unicode browser page, on the ground, looking at it. Players
  who join while it is still being built wait at spawn and are moved once
  it is ready.
- **Reference displays (1.1.26):** beside each case, 0.1 blocks to its
  right as seen from behind, a display at the same scale with no background
  and half-opaque light blue text. Each of its lines is the case's line
  without the characters the case studies (the tested character, mark,
  sample glyphs, block characters or `§` codes; ordinary spaces stay), so
  the two can be compared line by line. Each title is centered over its
  case and reference together, and the back row is now about 295 blocks
  long. Page turns and selections no longer move the back row; it is laid
  out again only when the pixel size changes.
- **Realistic direction cases (1.1.32):** six cases after the direction and
  tag characters use them as they are used in practice, and may repeat
  letters: a right-to-left override around Latin words (with "want:" lines),
  a left-to-right override on a Hebrew word, a Hebrew name followed by a
  number with and without RLI or FSI isolates, an embedding against an
  isolate, RLM and LRM beside punctuation, and the England, Scotland and
  Wales subdivision flags (black flag plus tag letters). The back row now
  has 118 cases.
- **Case text:** every case has more than one line, and no Latin letter
  appears twice in a case, ignoring case. Letters come from a pool of
  letters 6 font pixels wide, so bars line up across lines. A width case
  shows the ordinary space and the character between bars and letters, once
  and four times, at the start and end of a bar pair and inside words. A mark
  case puts the mark on a capital, a lower-case letter and a descender,
  stacks it three times and shows it alone. A sample case puts letters above
  and below the sample line, so anything that leaves its line overlaps them.

## Unicode browser (1.1.19)

The row now starts with a Unicode browser page, centered 6 blocks straight
ahead of spawn. Every `TextPrimitive` has an opaque black background.

Since 1.1.21, every display uses the fireflies canvas's face settings:
`textBackfaceVisible` false and `backfaceVisible` true. In 1.1.19–1.1.20 the
static displays had double-sided text and showed as black boxes; only the
animated ones showed text. With no depth test, the client evidently draws the
background over double-sided text, as in 1.1.3–1.1.4. Static text is also sent
again 5 ticks after placement. The 40 by 16 terminal text test is removed
(`BrailleTerminalFrame` remains in `TerminalArt.js`).

- **Page:** code points in order, 16 per line and up to 16 lines,
  space-separated, `lineGapHeight` 0. It starts at U+0000.
  NUL and line breaks (U+000A–U+000D, U+0085, U+2028, U+2029) are shown
  as control pictures (␀ ␊ ␋ ␌ ␍) or ␤, since they would end the text or its
  line. Everything else, including other controls, `§`, unassigned and
  private-use code points, is the real character.
- **Break tests (1.1.20, removed in 1.1.25):** eight separate primitives to the left of the page,
  one for each substituted character, in code point order. Each has a label
  line, then ten a's, the raw character and ten more a's, then `end`. A split
  middle line shows a line break; missing a's or a missing `end` show the
  text was cut off. The server truncates TextPrimitive text at U+0000: reading
  it back returns only `U+0000 NULL` and the first ten a's. The other seven
  are stored unchanged, so their effect depends on client rendering.
- **Selected character (1.1.22):** a primitive directly left of the page,
  between it and the break tests. Since 1.1.23 it shows the character
  between `ab` and `rl`, starting as `ab rl`. Whenever the compass form's X
  or Y slider moves, it shows the character at that position raw (U+0000
  shows as ␀, since the server would truncate the text there), or a space if
  there is none. Opening the form does not change it. The row re-lays for its
  width.
- **Height (1.1.23):** every display is 0.2 blocks lower than the layout
  would otherwise place it. Row centers are about 2.03 blocks above the
  ground, and the browser heading and title move down with the page.
- **Categories** are Unicode blocks, all 350 except the three surrogate blocks.
  Each starts on a new page, so there are 1,443 pages.
- **Heading and title:** above the page, a slightly smaller heading
  (scale 0.65) shows the page's first and last code points in hexadecimal and
  its category, as `0000–007F • Basic Latin`. Above that is the title
  **Unicode Browser**. Each is 0.25 blocks apart.
- **Unicode Page Turner** (hotbar slot 2): Use for the next page, Use while
  sneaking for the previous page. It wraps at both ends and shows the heading
  on the action bar.
- **Compass** (hotbar slot 1): a DDUI form with a **Category** dropdown, then
  **X** (column, 0 at the left) and **Y** (row, 0 at the top) sliders, then
  details of the selected character. The details are name, code point and
  decimal, block, plane, general category, script, bidi class, the Unicode
  version that introduced it, UTF-8, UTF-16, HTML references and simple case
  mappings. Choosing a different category closes the form and shows that
  category's first page.
- **Line Gap Clock:** no longer given, and removed from inventories on spawn.
  Its form still works if you take the item from the creative inventory.
- **Clipboard test:** the 1.1.17 JSON UI files remain in the resource pack, but
  the compass no longer opens them.

The data comes from the Unicode Character Database (Unicode 18.0.0), via
`npm run unicode-data --workspace @sorrell/ddui-image-demo`. That command
downloads it into `dist/ucd` and writes `Source/UnicodeData.js`: names are
front-coded, and Hangul syllable and pattern names (CJK, Tangut, Egyptian and
others) are derived. `npm run glyph-widths` now measures every Basic
Multilingual Plane character, so the row re-lays itself for each page's
width. Characters beyond the BMP count as 9-px missing glyphs.

Version 1.1.16 showed sixteen `TextPrimitive`s in one straight row, all at
scale 0.7875 (three quarters of 1.05) and turned 180° from 1.1.14–1.1.15
(fixed yaw `−facing`). The first is centered 6 blocks straight ahead of where
you spawn, along your view; the rest extend to the right. Every center sits
at one height: standing eye level (1.62 blocks above the ground), raised to
about 2.2 so the tallest chart, Braille, stays clear of the ground.
Neighbors are 0.5 blocks apart edge to edge. Left to right:

1. The animated fireflies canvas (`lineGapHeight` −4, opaque background).
2. The twelve character charts in `CharacterSets.js` order, including
   Sextants, Octants (new in 1.1.16) and Mathematical Monospace.
3. The terminal table and the pink fullwidth terminal table. The fullwidth
   table's box rules are 126 bytes, so its pink comes from the display color
   rather than per-line `§d` codes; with them, its lines exceeded the limit
   and the client dropped the whole text.
4. The 40 by 16 terminal text test (`lineGapHeight` −4); removed in 1.1.21.
5. The separator test (since 1.1.18): four lines of twenty lowercase a's,
   with no formatting codes. Line 1 is plain. Line 2 has U+001D after the
   first a. Line 3 has ten U+001D there. Line 4 is line 2 plus U+202E
   RIGHT-TO-LEFT OVERRIDE, U+001D, U+202E after the fourth a. The width model
   has no glyph for either character and counts each as a 9-px missing glyph.

The zero-gap fireflies comparison canvas is gone. Since 1.1.15 the
fireflies animation, and so the terminal text test, no longer has the
fullwidth “Ｅｇｇ”. Widths are estimates:
`Source/GlyphWidths.js` gives each character's advance in font pixels,
generated by `npm run glyph-widths --workspace @sorrell/ddui-image-demo`
from the installed client's bitmap fonts. Since 1.1.36 each line is measured
in the font the client picks for it: the large font (`default8*.png`, whose
438-character table the generator reads from `Minecraft.Windows.exe`) when
every character is in it, otherwise the smaller Unicode font
(`glyph_XX.png` pages, ASCII included). Converting pixels to blocks needs the
size of one font pixel at scale 1, which is undocumented. It starts at
25 mm. The **Line Gap Clock** now opens **Display settings**: `lineGapHeight`
for the two animated canvases and **Font pixel size**. Raise the size if
neighbors overlap, lower it if gaps exceed half a block; Confirm re-lays
the row in place. Both values last until the server restarts. Script
startup logs any line over the 128-byte `TextPrimitive` limit.

Version 1.1.10 showed two identical animated Braille fireflies canvases, 36 blocks
ahead of spawn and 2.5 blocks above the ground. The right-hand one, as seen at
spawn, used an adjustable `lineGapHeight` (initially −4); the other kept 0.
Version 1.1.12 writes a fullwidth “Ｅｇｇ” over three Braille cells in the sixth
row, starting at the third column: two cells in from the lower-left corner.
Both canvases have an opaque very dark gray background (since 1.1.11).
Version 1.1.13 adds a third, otherwise identical canvas at a bearing of 35°
to the right: a 40 by 16 cell “terminal” that repeats the animation two by two.
White non-Braille text is written over cells throughout, one character per
cell (spaces included), to show how Mojangles advance widths line up with the
Braille grid. It covers A–Z, a–z, Unicode Roman numerals (U+2160–U+217F),
digits and common punctuation. A `TextPrimitive` rejects any line over 128
UTF-8 bytes, and a Braille cell takes 3, so a line can hold at most 42 Braille
cells and 64 columns cannot fit.
In 1.1.10–1.1.13 the **Line Gap Clock** in hotbar slot 2 opened a DDUI form
with a slider from −20 to 20, in steps of 0.5, and the other charts and
terminal tables were hidden.
Version 1.1.9 showed three copies with gaps −10, 0 and +10.

Earlier version notes:
Version 1.1.7 adds a pink Fullwidth Latin and digits chart directly ahead of
spawn: Ａ–Ｚ, ａ–ｚ and ０–９ (62 characters). Its ranges are U+FF21–U+FF3A,
U+FF41–U+FF5A and U+FF10–U+FF19. All eleven charts retain scale 0.7, fixed
rotation, lowered height and transparent backgrounds.
Version 1.1.6 restores all ten charts, including Mathematical Monospace. Their
scale is doubled to 0.7, their fixed yaw is rotated 180 degrees, and their
centers are lowered another 0.25 blocks to 0.5 blocks above the ground surface.
The arc radius is expanded to 24 blocks to space out the larger charts, with
Arrows and Braille near the middle. White text and transparent backgrounds remain.

Version 1.1.4 temporarily renders only the Arrows chart, centered directly ahead
of spawn. All ten character set definitions below are retained for restoration.
Version 1.1.5 explicitly formats each text line white, removes the background
plate's opacity and disables its back face, addressing the reported black
rendering while retaining fixed orientation and the lowered placement.
Version 1.1.3 provides ten separate fixed-orientation `TextPrimitive` charts in a
12-block-radius arc ahead of the player's position and view direction on spawn.
Braille is near the center. Each chart is labeled with its name, character count
and hexadecimal ranges, with up to sixteen characters per row. Their centers
are 0.75 blocks above the ground surface, lowered by 1.25 blocks. Their yaw is
set once toward the spawn area; they do not turn to follow the player.
Looking straight up/down falls back to
+Z. The shared gallery stays there until the next spawn and is replaced
rather than accumulated.

| Chart | Unicode code points |
| --- | --- |
| Braille | U+2800–U+28FF (including blank U+2800) |
| Block elements | U+2580–U+259F |
| Shading | U+2591–U+2593 |
| Quadrants | U+2596–U+259F |
| Box drawing | U+2500–U+257F |
| Sextants | U+1FB00–U+1FB3B |
| Octants | U+1CD00–U+1CDE5 (the other 26 patterns reuse block, quadrant and sextant characters) |
| Geometric shapes | U+25A0–U+25FF |
| Arrows | U+2190–U+21FF |
| Diagonal lines | U+2571–U+2573, U+1FBA0–U+1FBAE, U+1FBD0–U+1FBDF |
| Mathematical Monospace | U+1D670–U+1D6A3 (A–Z, a–z), U+1D7F6–U+1D7FF (0–9) |

The separate shading and quadrant charts intentionally repeat their subsets
of Block Elements. Ranges follow the [Unicode code charts](https://www.unicode.org/charts/)
and [Symbols for Legacy Computing names](https://www.unicode.org/Public/18.0.0/charts/nameslist/1fb00/).
Minecraft's client font determines which glyphs are visible; unsupported
characters may appear as missing glyphs.
This demo enables Beta APIs and uses `@minecraft/server` 2.12.0-beta and
`@minecraft/server-ui` 2.4.0-beta. Multi-button rows require the beta UI module.
Editable observables explicitly allow client writes and dropdown choices have
numeric values.
On every spawn, a custom **Clipboard Test Compass** is supplied and selected in
the hotbar. Accept the resource packs. Since 1.1.17, pressing Use opens a
custom JSON UI screen, which replaces the Transactional DDUI acceptance form.

The script shows an `ActionFormData` titled `clipboard_test` with sample body
text. The resource pack's `ui/server_form.json` hides the stock long form for
that title and shows `ui/clipboard_test.json` instead. That screen has two
buttons, using the IDs vanilla screens use for copying:

- `button.copy_to_clipboard` (content log history, dev console, manifest validation)
- `button.copy_log_path_to_clipboard` (logged-error details)

These IDs are handled by those screens' native controllers, which choose what
to copy; no vanilla JSON binding takes the text to copy. Press each one, then
paste elsewhere to see whether the server form screen's controller copies
anything. Closing the screen logs `CLIPBOARD_TEST closed …` to the console.

From `E:\MineCraft`:

```powershell
npm start --workspace @sorrell/ddui-image-demo
npm stop --workspace @sorrell/ddui-image-demo
```

Connect on this PC at `127.0.0.1:19133`, or on LAN at
`192.168.50.213:19133`. The server uses the existing fixed executable path
`Addon/DduiImageDemo/dist/bds-runtime/bedrock_server.exe`. Its world is
`worlds/transactional-demo`; ordinary launch preserves it.

The previous image-demo world is retained at `worlds/ddui-image-demo` and a
pre-install backup is stored in `dist/before-transactional-*`. The production
server at `C:\MineCraft\Server` is separate.

`npm run build --workspace @sorrell/ddui-image-demo` bundles Source/Main.js and
the current Bedform source into the demo behavior pack. For a new installation,
`npm run prepare:server --workspace @sorrell/ddui-image-demo` copies engine files,
stock packs, this demo and the built Bedform Common packs; it refuses to
overwrite an existing server. Build Bedform Common before preparing a server
if its generated assets have changed.

Client rendering, live visibility and native text commit cadence remain manual
acceptance checks. A successful BDS startup does not establish those results.
