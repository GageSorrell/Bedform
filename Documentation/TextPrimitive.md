# Rendering text with `TextPrimitive`

What this repository has learned about how the Bedrock client draws
`TextPrimitive` text, and how to build pixel-exact displays from it, up to a
"terminal emulator" grid with custom glyphs. Read this before writing code
that places, measures or styles `TextPrimitive`s. That covers
`bedform/Terminal` ([plan](../Plan/Bedform_Terminal_Plan.md)), Diagetic
displays and any add-on that puts text in the world.

**Provenance.** Unless stated otherwise, every finding comes from
`Addon/DduiImageDemo` (`@sorrell/ddui-image-demo`, versions 1.1.0 to 1.1.68).
It was observed between 2026-11-14 and 2026-11-16 on BDS 1.26.6x with
`@minecraft/server` 2.12.0-beta, viewed with the Windows client 1.26.6x. The
demo's [README](../Addon/DduiImageDemo/README.md) gives the version-by-version
history behind each finding. Labels used below:

- **Verified:** seen in game with a test built for it.
- **Measured:** read from the client's files or from screenshots.
- **Inferred:** follows from the above but has no direct test.
- **Untested:** the question is open.

Client behavior can change with any release. Recheck anything that matters
after a client update.

---

## 1. Rules at a glance

1. **Two fonts, chosen per line.** A line whose visible characters are all
   in the large font's 438-character set is drawn in the large font. Any
   other character switches *the whole line* to the smaller, finer Unicode
   font. *(Verified)*
2. **Units.** A large-font pixel is twice a Unicode-font ("fine") pixel. Each
   custom glyph-page texel in the Private Use Area is drawn as one *large*
   pixel, whatever the PNG's resolution. *(Verified)*
3. **Lines are centred** horizontally on the sum of their advances. Each
   line's start is rounded to a whole pixel of the display's own scale.
   *(Verified)*
4. **Line pitch depends on the font:** 12 + `lineGapHeight` for large-font
   lines, 10 + `lineGapHeight` for Unicode-font lines, both in large pixels.
   *(Verified)*
5. **128 UTF-8 bytes per line**, and the server cuts text at the first
   U+0000. *(Verified)*
6. **The yaw sign is the opposite of entities'.** Normalise yaw to
   (−180°, 180°]. *(Verified)*
7. **Glyph advance = ink extent + 1 pixel, always.** No glyph's ink can touch
   its right-hand neighbour's: there is always a 1-pixel seam. Rows can touch.
   Two layers of wide glyphs, each drawing alternate cells, work around the
   seam (§10a).
   *(Verified)*
8. **Private Use Area glyphs ignore `§` colour codes.** They draw in their
   texture's colours. A pixel with alpha ≥ 1 counts toward a glyph's width,
   and alpha ≤ 64 is invisible. *(Verified)*
9. **Bedrock `§` colours are not Java's** (§7 is #C5C5C5). *(Measured)*
10. **Use `depthTest = true` and a small depth offset** when layering
    primitives. The client does not draw them in creation order. *(Verified)*
11. **Always give a location its dimension.** A shape whose location has no
    dimension is drawn in every dimension. This applies to the constructor
    and to every `setLocation`, so pass `{ ...Location, dimension }` both
    times. *(Verified, 1.1.72–1.1.73)*
12. **To move text smoothly, attach it to an entity the server moves by
    velocity** (§2). *(Verified, 1.1.73)*

---

## 2. The API as used

```js
import { TextPrimitive, world } from "@minecraft/server";

const Display = new TextPrimitive(Location, Text);
Display.useRotation = true;
Display.rotation = { x: 0, y: YawDegrees, z: 0 }; // Euler degrees [pitch, yaw, roll]; see §4
Display.scale = 0.7875;
Display.color = { red, green, blue, alpha };      // default text colour; § codes override it, §r returns to it
Display.backgroundColorOverride = { red, green, blue, alpha }; // alpha 0 = transparent
Display.lineGapHeight = 0;                         // large-font pixels added to each line's pitch
Display.depthTest = false;
Display.textBackfaceVisible = false;
Display.backfaceVisible = false;
world.primitiveShapesManager.addText(Display, Dimension);
// Later: Display.setText(NewText);
```

This is the demo's `AddText` in `Source/Main.js`. The properties need the
beta script API. Two practices from the demo:

- **Resend static text.** The demo calls `setText(Display.text)` 5 ticks after
  placing static text. It has done so since 1.1.21, when static displays
  sometimes showed no text. Whether this is still needed is untested.
- **Only send changes.** Call `setText` only when the text has actually
  changed. Each call is network traffic, and animated displays call it every
  frame.

**Moving text with `attachedTo`** (demo 1.1.70–1.1.73, `Source/AttachedOrbit.js`).
`attachedTo` makes a display copy an entity's location, with its own location
as an offset:

- **It follows the entity's server position, smoothly** *(Verified, 1.1.70
  and 1.1.73)*. Text attached to an invisible, gravity-free carrier moved
  around a 2-block circle when the script set the carrier's velocity every
  tick: `clearVelocity()`, then `applyImpulse()` of the step to the next
  point. The server held the carrier exactly on its path (0.000 blocks of
  error per loop). In 1.1.73, in a dimension holding only the test displays,
  the client drew the motion smoothly, presumably interpolating the entity
  between server updates. In 1.1.70 it looked choppy in the overworld, which
  then also drew about 430 gallery displays (and, through the bug in rule
  11, the other dimension's), so the scene's load may have caused that.
- **`setLocation` every tick** moved a display with no entity around the
  same circle and phase (1.1.72–1.1.73). How smooth it looks beside the
  attached text has not been reported.
- **It ignores client-side bone animation** *(Verified, 1.1.71)*. Text
  attached to a still entity whose model's root bone looped around the same
  circle in a client animation did not move. The API's "root location of the
  attached entity" means the entity's position, not its model's root bone.
  Moving text needs the server to move the entity (or the display) itself.

## 3. Server-side text limits

| Limit | Behaviour | Status |
| --- | --- | --- |
| A line over **128 UTF-8 bytes** | The constructor silently drops the whole text; `setText` throws | Verified |
| **U+0000** | The server cuts the text there; reading `text` back returns only what came before it | Verified |
| Line breaks | `\n` breaks a line. U+000B–U+000D, U+0085, U+2028 and U+2029 are stored unchanged; the browser shows them as control pictures to stay safe | Verified (stored); rendering not isolated |
| `primitiveShapesManager.getShapes()` | Returns only shapes the calling pack registered; another pack's live text is not listed. Observe another pack's text by instrumenting that pack instead | Verified, BDS 1.26.63.1 (Canvas native fixture, MineCraft-zcmm.9) |

**Byte budget for drawing characters.** Most drawing characters are 3 UTF-8
bytes: Braille, box drawing, block elements, the Private Use Area and
fullwidth forms. A `§x` code is 3 bytes (`§` is U+00A7, 2 bytes). So a line
holds at most **42** such characters, and fewer with colour codes. Supplementary-plane
characters are 4 bytes, but they have no glyphs anyway (§7.3). Check bytes
with `LongestLineBytes` in the demo's `Source/Layout.js`. The demo logs every
over-long line at startup.

## 4. Orientation

**Yaw sign** *(Verified, demo 1.1.29)*. The client turns `TextPrimitive`s the
opposite way to entities: yaw θ shows the readable side toward
(−sin θ, −cos θ). To face a viewer who looks along facing F (radians from +Z
toward +X), send **yaw = +F in degrees**, not the entity yaw −F. The two
agree only at 0° and 180°, which is why the bug hid until rows were turned.
The demo has `Yaw()` and `PlayerYaw()` in `Source/Main.js`.

**Normalise yaw to (−180°, 180°].** The server stores 270 unchanged, but the
client drew 270 at about 45° and drew −270 as a back face.

## 5. Faces, depth and draw order

**The black-box bug** *(Verified)*. With `depthTest = false`, an opaque
`backgroundColorOverride` and `textBackfaceVisible = true`, the client drew
only the background, a black box with no text. Use
`textBackfaceVisible = false`.

**Single-sided backgrounds.** With `backfaceVisible = false`, a display seen
from behind is invisible. Without that, a row's backs cover the row behind
it.

**Draw order is not creation order** *(Verified, 1.1.52)*. The client seems
to draw nearer displays last. Stacking two primitives at one place therefore
needs both of these:

- `depthTest = true` on both, and
- the back one a little farther from the viewer: the demo uses 0.005 blocks
  (`OverlayDepth`).

Otherwise the back can be drawn over the front. This happened when the back
was nearer to a viewer standing below a tall display's centre.

**§k does not animate** *(Verified)*. It replaces each letter with a random
glyph once, and the glyphs then stay fixed. With `§k§l` the replacements
overlap. Whether `setText` picks new glyphs is untested.

## 6. Units and size

| Unit | Definition |
| --- | --- |
| **Large-font pixel** | One texel of `default8.png`. All widths, `lineGapHeight` and pitches below are in these. |
| **Fine (Unicode-font) pixel** | Half a large pixel. Vanilla `glyph_XX.png` pages are drawn at this size. |
| **PUA texel** | One texel of a Private Use Area glyph page. Drawn as one **large** pixel (§7.2). |
| **Blocks per large pixel at scale 1** | About **0.025** (`PixelSize` in the demo). An estimate, never calibrated; the demo lets you adjust it. |

`scale` multiplies everything: glyphs, pitch and the gap.

## 7. Fonts

### 7.1 Font choice is per line *(Verified, 1.1.35–1.1.36)*

Bedrock text has two bitmap fonts:

- **The large font,** in `default8.png`, `default8_1.png` and
  `default8_2.png`. Its 438 characters cover ASCII, most of Latin-1 (not
  U+00A0), Latin Extended-A, Greek, Cyrillic, code page 437's box drawing and
  blocks (U+2502 is in it), and some maths symbols.
- **The Unicode font,** in the `glyph_XX.png` pages: 256 characters per page,
  16×16 cells of 16×16 texels, drawn at fine pixels.

**The rule:** if *every* visible character of a line is in the large font's
set, the line uses the large font. **Any** other character switches the
**whole line** to the Unicode font, ASCII included. ASCII is narrower in the
Unicode font: for example, `a` is 4 large pixels there against 6 in the large
font.

The 438-entry character-to-cell table is in `Minecraft.Windows.exe` as
UTF-32 pairs. `Tool/GlyphWidths.mjs` reads it, together with the font sheets
from the client's `font.brarchive`. U+2223, U+258F, U+01C0, U+2065 and U+2069
all switch a line; U+2502 does not.

**Forcing the Unicode font with nothing visible:** put a U+2800 BRAILLE
PATTERN BLANK in the background's colour at the start of the line. Its dotted
outline then can't be seen. The demo's overlays do this (`SmallFont` in
`Source/GlyphOverlay.js`).

### 7.2 Widths *(Measured from the font sheets; the in-game measurement has not been run)*

`Tool/GlyphWidths.mjs` generates `Source/GlyphWidths.js`, the advance of every
Basic Multilingual Plane character in both fonts. `GlyphWidth`, `LineWidth`
and `UsesLargeFont` in `Source/Layout.js` measure a line in the font the client
will pick for it. Widths are in large pixels, including the gap after the
glyph:

| Character | Unicode font | Large font |
| --- | --- | --- |
| space | 4 | 4 |
| `A` / `a` / `i` | 4 / 4 / 3.5 | 6 / 6 / 2 |
| U+2800–U+28FF Braille (all) | **3.5** | — |
| U+2500 ─ / U+2502 │ / U+253C ┼ | 5 / 1.5 / 5 | 9 / 6 / 9 |
| U+2588 █ | 9 | 9 |
| U+FF21 Ａ / U+FF45 ｅ | 7.5 / 4.5 | — |
| U+3000 ideographic space | 9 | — |
| Missing glyph (and any supplementary-plane character) | 9 | — |

Advances come from ink, so few vanilla sets are uniform. Braille is uniform
because every pattern carries the blank's dotted outline. **Fullwidth Latin
is *not* uniform** (Ａ 7.5, ｅ 4.5), and neither is box drawing in either
font. A grid built from vanilla characters only lines up if it uses one
uniform-width set, or pads each cell to a common width.
`npm run measure-glyphs --workspace @sorrell/ddui-image-demo`
(`Tool/MeasureGlyphs.mjs`) measures widths in game from screenshots, but has
not been run yet.

### 7.3 Pages that exist

- **Only the Basic Multilingual Plane has pages.** Supplementary-plane
  characters always draw as missing glyphs: Symbols for Legacy Computing
  U+1FB00–1FBFF, its supplement U+1CC00–1CEBF, and Mathematical Monospace.
  To show them, map each one to a Private Use Area stand-in (§9).
- **Private Use Area pages.** Vanilla ships pages E0 and E1 (controller and
  platform icons). It lacks D8–DF (the surrogates) and **E2–F8**, so those
  pages are free for packs.
- **Conflict:** `AdvancedMinimapRewired` overrides E2–F8 in this repository.
  A pack replaces a whole page, so no two packs that override the same page
  can share a world.

### 7.4 Other text behaviour

- **No bidirectional layout** *(Verified)*. Hebrew is drawn in stored order,
  and the isolate controls (RLI, FSI, PDI) reorder nothing. Each isolate is
  invisible but still takes about one letter's width.
- **Formatting codes.** `§k`, `§l` and `§o` change widths or glyphs, so
  layouts that need exact widths must reject them. Colour codes and `§r`
  take no width.

## 8. Line layout

**Horizontal** *(Verified, 1.1.32 and 1.1.41)*:

- Each line is centred on the full sum of its advances, including the
  1-pixel gap after its last glyph.
- A shorter line is indented on both sides.
- Lines of one display do not share a left edge unless their widths match.
  Pad lines to equal width if they must align.

**Line-start rounding** *(Verified, 1.1.45–1.1.46)*:

- A line starts at −width/2, rounded to whole pixels *of the display's own
  scale*. These are large-font pixels, even on Unicode-font lines.
- A 39-pixel line starts at −19, not −19.5.
- Two displays at different scales therefore disagree by half a pixel on odd
  or fractional widths.
- **Fix:** pad each line to an even width. The demo's `EvenPad` uses pads
  whose ink stays inside a row: `·` U+00B7, `∙` U+2219 and `l`. Bars reach
  into the rows above and below.

**Vertical:**

- **Pitch** *(Verified, 1.1.53 and 1.1.62)*. Large-font lines are
  12 + `lineGapHeight`; Unicode-font lines are 10 + `lineGapHeight`. Custom
  glyphs don't change it.
- **Mixed fonts.** A display whose lines mix fonts has uneven pitch, so force
  every line into one font.
- **16-fine-pixel rows,** one glyph cell: use Unicode-font lines with
  `lineGapHeight = -2`. That gives 8 large pixels, which is 16 fine pixels.
- **Centring height** *(Inferred from 1.1.52)*. The client seems to centre the
  text block on 12 pixels per line whatever the gap. With a negative gap,
  text reaches higher above the anchor than its height suggests, so layouts
  must count that reach (`RowLayout` in the demo returns it).

## 9. Custom glyphs (resource-pack glyph pages)

### 9.1 Mechanics

- **Page format.** Override `font/glyph_XX.png` in a resource pack: a
  256×256 PNG with 16×16 cells, cell `n` at column `n & 15`, row `n >> 4`.
  The pack replaces the whole page. *(Verified, 1.1.38)*
- **Texel size.** Each texel of a Private Use Area page is drawn as **one
  large-font pixel**. A 512 px page and a 256 px page looked identical, and so
  did glyphs of different ink heights. The cell is centred vertically on the
  line. *(Verified, 1.1.39–1.1.40)*
- **No fine-pixel detail at full scale.** A PUA glyph alone cannot have the
  Unicode font's finer pixels. At *half* scale, a texel is exactly one fine
  pixel of a full-scale display, which is what the overlay in §10 uses.
- **Advance.** The advance is the ink extent plus 1 texel. Empty left columns
  are drawn but not counted, so **always start ink at column 0**. To widen a
  glyph, add a pixel at the far column. *(Verified)*
- **Alpha** *(Verified, 1.1.58 and 1.1.60)*:
  - any alpha ≥ 1 counts as ink for width;
  - alpha ≤ 64 is invisible;
  - at alpha 128 a white pixel showed grey.

  So put **alpha-1 pixels** in any colour wherever you need width without
  visible ink: they work on any background. Don't rely on partial
  transparency for visible pixels; bake the blended colour into the page.
- **Colour.** PUA glyphs draw in their texture's colours and **ignore `§`
  codes**. Each extra text colour needs its own copy of the glyph pages.
  The demo had cyan copies at stand-in + 0x400 from 1.1.54 until 1.1.74,
  when they were removed to free pages. *(Verified, 1.1.53–1.1.54)*
- **Seams** (see §10a for the two-layer workaround). There is always one
  empty pixel column after every glyph's ink.
  Ink in the last column only moves the gap. Horizontally adjacent glyphs can
  **never** touch, but vertically adjacent rows can (§8).

### 9.2 Colour values

Bedrock's `§` colours differ from Java's. Use the Bedrock value whenever text
is hidden by matching the background. *(Measured; Minecraft Wiki Bedrock
table)*

| Code | Bedrock | Java |
| --- | --- | --- |
| §7 gray | **#C5C5C5** | #AAAAAA |
| §8 dark gray | **#545454** | #555555 |
| §b aqua | **#54FFFF** | #55FFFF |
| §9 blue | #447FFF (since 26.50) | #5555FF |
| §3 dark aqua | #00AAAA (same as Java; per colour-code tables, not measured) | #00AAAA |

**Arbitrary colours** *(Inferred)*. A display's main ink and its background
can be any RGB value:

- set `Display.color` (lines return to it with `§r`);
- set `backgroundColorOverride`;
- draw the glyph pages in the same colour as `Display.color`.

Text hidden on a background can use the display colour of a layer whose
colour equals the background. Only *additional* per-run colours are limited to
the `§` palette.

## 10. The two-layer overlay: custom glyphs at fine-pixel size *(Verified)*

The goal is custom glyphs whose pixels match the Unicode font's, inline with
ordinary text. The demo's implementation is `SplitOverlay` in
`Source/GlyphOverlay.js` and `AddOverlayBack` in `Source/Main.js`.

**Two primitives at one place:**

| | Front | Back |
| --- | --- | --- |
| Scale | S | **S / 2** (a texel = one front fine pixel) |
| Background | transparent | the display's background colour |
| Colour | the text colour (`Display.color`) | default; everything visible on it is a glyph |
| Text | the text, with a **space** wherever a custom glyph goes | the front text *mirrored*: every other character **twice** in the background's colour, each custom glyph once |
| `lineGapHeight` | **−2** (`OverlayFrontGap`) | **6** (`OverlayBackGap` = 2 × (10 + front gap) − 10) |
| `depthTest` | true | true |
| Position | anchor | **0.005 blocks** behind and **`OverlayDrop` = 4** large pixels (at the front's scale) lower |

**Why each part is there:**

- **Mirroring** is what aligns the layers. A character typed twice at half
  scale takes exactly its own full-scale place, whatever its true advance,
  so the back line has exactly the front line's width. Computing the back
  from *estimated* advances misplaced glyphs (1.1.44).
- **Glyph width.** A glyph cell is 7×16 texels, with ink extent exactly
  columns 0–6 (alpha-1 pixels fill out short ones), so its advance is 8
  texels. That is two half-scale spaces, one front space.
- **Font forcing.** Every line of both layers starts with the hidden U+2800
  (§7.1), so all lines are Unicode-font lines with a 10-pixel pitch. The gaps
  above then give a pitch of 16 fine pixels, exactly one glyph cell, so rows
  stack with no gap or overlap (1.1.62).
- **Even widths.** Both layers end each line with the same `EvenPad` (doubled
  behind), so line-start rounding moves neither layer (§8).
- **Colour codes.** Only colour codes and `§r` are allowed, and they are kept
  in front. The back emits a colour code only before an inked character, so
  a row of 16 spaced glyphs stays under 128 bytes. `§k`, `§l` and `§o` are
  rejected.
- **Drop and depth.** The back's vertical offset was calibrated
  empirically: a drop of 1.5 left glyphs 1 fine pixel high, and 2 was right,
  at a front gap of −4 (1.1.45). It was doubled to 4 at the user's request
  (1.1.50), and gaps changed to −2/6 later (1.1.62). Recheck the drop if you
  change scale or gaps. The depth offset plus depth testing keeps the front
  text in front (§5).

**Colours used in the demo:**

- background §7 #C5C5C5;
- ink #4D4D4D, which is not a `§` colour, so it is `Display.color`, reached
  with `§r`;
- cyan rows §b #54FFFF (until 1.1.74 with cyan glyph copies; now only the
  row labels are cyan).

**Overlay gotchas found along the way:**

- **Moving the glyph doubles errors.** Raising a glyph inside its cell to fix
  a vertical offset doubled the error (1.1.42). Move the back layer instead.
- **Pads must stay inside their row.** A pad whose ink spans the cell's
  height shows in the rows above and below.
- **Titles need room.** Titles above tall overlays must count the text's
  upward reach (§8).

## 10a. Closing the seam *(implemented in demo 1.1.66; in-game result pending)*

A glyph's forced 1-pixel gap follows its ink, but the empty columns after
the ink still count when they lie *inside* the glyph's extent. So:

- **Wide glyph.** Take an 8-column glyph (the cell plus its seam column) and
  add an alpha-1 pixel at column 14. Its extent is then 0–14, and its advance
  is 16, two cells. Its own gap lands in the *next* cell's column 7.
- **Alternating layers.** In each run of adjacent glyph cells, two half-scale
  layers take alternate cells:
  - each draws its cells with wide glyphs;
  - the cells it neither draws nor spans are a **blank cell** (alpha-1
    pixels only, advance 8);
  - the cell before text or the line's end uses the ordinary 7-column glyph
    and keeps its seam;
  - both layers' lines have equal widths, so they centre identically.
- **Placement.** The second layer is transparent, with depth testing, half
  `OverlayDepth` behind the front (dropped like the back), so the three
  depths are front, middle, back.

There are two forms:

| Form | Primitives | Use |
| --- | --- | --- |
| **Three-layer overlay**: back + middle + front (`SplitOverlay(Text, { Seamless: true })`) | 3 | glyphs mixed with vanilla Unicode-font text |
| **Glyph-only**: `GlyphOnly(Text)`, A (with background) + B (transparent, `OverlayDepth / 2` in front) | 2, or 1 with seams | text made only of cell glyphs |

**Glyph-only displays skip the overlay machinery.** They have no front,
mirrored text, hidden font switch, `EvenPad` or drop. A space becomes a blank
cell, so every line holds only Private Use Area glyphs, is a Unicode-font
line, and has a 10-pixel pitch. With `lineGapHeight` 6 that makes 16-pixel
rows at half scale. Lines are 3 bytes per drawn glyph, about 33 bytes for 20
cells.

**Glyph layout in the demo** (packed with no gaps since 1.1.79): every
glyph has a slot in one sequence from U+E200, the first code point the
vanilla font leaves free, so the pages run E2–EB with none missing and
groups share pages where they meet.

- **Narrow cell glyphs:** U+E200–E590, 913 of them: the 250 Legacy
  Computing glyphs in code point order, the 4 sextant completers
  (`LegacyExtraGlyphs`, U+E2FA–E2FD: full block, left half, right half,
  blank cell), the 633 Supplement glyphs and the 26 octant completers.
  Unassigned and dropped code points take no slot, so a stand-in comes from
  a lookup (`LegacyGlyph`), not arithmetic.
- **Wide copies:** U+E591–E921, at stand-in + 913 (`LegacyWideOffset`).
- **No colour copies** since 1.1.74: every cell glyph is dark grey.

`SextantArt` turns a shape into sextant text.

**Wide-only glyph sets and grids** (demo 1.1.67):

- **Wide-only glyphs.** A glyph-only display never draws a narrow glyph
  except in a line's last cell. So a set can exist **only wide**, provided a
  line ending in one gets an extra blank cell.
- **Octants.** U+E967–EA66 hold all 256 octant patterns that way, in dark
  grey. Coloured pages existed earlier: cyan (§b) F5 until 1.1.76, dark aqua
  (§3) F6 and blue (§9) F7 until 1.1.74. Every colour code now gives dark
  grey. `GlyphOnly` maps each
  Braille character's eight dots onto an octant's eight blocks, so Braille
  art becomes solid, seamless cells.
- **Pad lines to a grid.** The client centres each line, so `GlyphOnly`
  pads every line with blank cells to the widest. Unequal lines would
  otherwise shift by half a cell.
- **In the demo:** the fireflies animation runs both ways side by side,
  updated in the same tick.

## 11. Terminal emulator displays

### 11.1 Three approaches

**A. Vanilla font only** (`bedform/Terminal` plan). This uses no packs and
works for any client. Its limits:

- **Uniform characters are scarce.** Uniform-width cells must come from one
  uniform set: Braille, at 3.5 large pixels, is the obvious one. Fullwidth
  Latin and box drawing are *not* uniform (§7.2), so a grid that mixes them
  drifts unless every cell is padded to a common width. The plan's
  assumption of uniform fullwidth cells conflicts with the measured widths;
  check in game before relying on it.
- **Lines are 42 cells or fewer** (§3).
- **The font switch.** Any single non-large-font character puts a line in
  the Unicode font, and line pitch follows the font, so keep every line in
  one font.

**B. Custom-glyph overlay** (§10, §10a). Custom glyphs mixed with ordinary
vanilla text. Glyph cells are a uniform 8 fine pixels wide and rows are 16
fine pixels high and touch. Its costs:

- **Pages and conflicts:** it needs a resource pack with glyph pages in
  E2–F8, and page conflicts apply (§7.3).
- **Primitives:** 2 per display (back and front), or 3 to close the seams
  (back, middle and front), all kept in alignment.
- **Bytes:** a back line spends 3 bytes per glyph and mirrors the text
  around them, so a line holds roughly 40 cells, fewer with colour changes
  and pads.
- **Proportional text:** ordinary text on the front is still the
  proportional Unicode font.

**C. Glyph-only** (`GlyphOnly`, §10a). Everything is a custom glyph, so the
front layer is not needed. It uses 1 half-scale primitive (seams kept) or 2
(seamless). It needs no mirrored text, font switch, pads or drop
calibration, and lines are padded to a true grid. Each line holds 3 bytes
per drawn glyph, so a seamless pair reaches about 80 cells. This is the
cheapest route to a strict monospace terminal. Letters would need a
custom-glyph font, which does not exist yet; only drawing characters,
octants and Braille (as octants) are supported now.

### 11.2 Glyph sets built so far (demo resource pack)

| Pages | Contents | Source |
| --- | --- | --- |
| E200–E2F9 | Symbols for Legacy Computing (250), in code point order | procedural and hand-drawn, `Tool/LegacyGlyphs.mjs` |
| E2FA–E2FD | sextant completers (full block, left and right halves, blank cell, `LegacyExtraGlyphs`) | `LegacyExtraCells` in `Tool/LegacyGlyphs.mjs` |
| E2FE–E576 | Legacy Computing Supplement (633; the 62 aliens, robot halves, racing cars, tanks and outlined letters and digits are dropped, `LegacyComputingDropped`) | GNU Unifont 18.0.01 under SIL OFL 1.1, narrowed from 8 to 7 columns, `Tool/LegacySupplementGlyphs.mjs`; licence at `font/LICENSE-Unifont.txt` |
| E577–E590 | 26 narrow octant completers (`OctantCompleterBase`) | `Tool/CustomGlyph.mjs` |
| E591–E921 | the same 913 glyphs 8 columns wide for seamless layers (stand-in + 913) | drawn 8 wide; Unifont's own 8 columns for the supplement |
| E922–E966 | Minecraft Ten (69; no lowercase), in ASCII order with the lowercase letters skipped (`MinecraftTenGlyph`) | rasterised from the client's TTF, `Tool/MinecraftTen.mjs` |
| E967–EA66 | all 256 octant patterns, wide only, at `OctantBase` + pattern, in dark grey | `Source/Octant.js`, drawn by `Tool/CustomGlyph.mjs` |
| EA67–EB66 | octant-style Braille dot patterns, 8×16 cells, at `BrailleDotBase` + pattern | `Tool/CustomGlyph.mjs` |

**Page budget (1.1.79).** The demo's 2,407 glyphs fill U+E200–EB66, ten
pages (E2–EB) with no unused slot before the last, which has 153 free
(U+EB67–EBFF). The thirteen pages EC–F8 are free in one block. History:
removing the test page (1.1.76) and every coloured copy (1.1.74, 1.1.75,
1.1.77) freed whole pages, 1.1.78 moved the rest to the front, and 1.1.79
packed the glyphs into consecutive slots. A new glyph group goes after
`GlyphEnd` in `Source/Octant.js`. Every glyph the demo draws is dark grey,
except Minecraft Ten's white button text.

`npm run custom-glyph --workspace @sorrell/ddui-image-demo` regenerates every
page and writes contact sheets to `dist/glyph-preview/`. Read those sheets
before deploying.

**Design rules for 7×16 terminal glyphs:**

- **Ink spans columns 0–6 exactly,** with alpha-1 pixels at column 0 or 6
  where the shape is shorter.
- **Shared anchors.** Use shared anchors so neighbouring glyphs join: sextant
  columns 0–3 and 4–6, rows 0–4, 5–10 and 11–15.
- **Uneven halves.** A 7-column cell cannot split evenly: left halves are 4
  columns, right halves 3.
- **Narrowing 8-column sources** (Unifont), by kind of glyph:
  - **Tiling glyphs** drop column 7, where the seam falls.
  - **Separated-block glyphs** drop column 0, their gutter, so every block
    stays 3 wide.
  - **Standalone glyphs inked only on the right** shift left.
  - **Glyphs inked on both edges** lose the interior column most like a
    neighbour.
- **Shades** copy the vanilla Unicode font's U+2592 pattern, so the style
  matches.

**Design rules for 8×16 wide glyphs** (seamless layers):

- **Ink in columns 0–7,** plus an alpha-1 pixel at column 14, so the extent
  is 0–14 and the advance is 16. Add an alpha-1 pixel at column 0 if the
  shape doesn't reach it.
- **Halves are even:** 4 and 4.
- **Multi-cell pictures** are cut every 7 columns as before. The wide copy's
  column 7 is inked where the art is inked on both sides of the cut.
- **Unifont sources** are used unchanged (8 columns).
- **Wide-only sets** (no narrow copy) are fine for glyph-only displays: a
  line ending in one gains a blank cell (§10a).

### 11.3 Known defects and open problems

- **The seam.** A single glyph layer never touches horizontally, so boxes,
  blocks and octants show 1-pixel vertical gaps. §10a closes it with a
  second half-scale layer of wide glyphs, which also makes halves an even 4
  and 4. That is implemented but not yet seen in game.
- **Diagonal kinks** *(fixed in the generator, 1.1.66)*. The light diagonal
  box drawings used to end on fixed anchor pixels (right = column 6,
  middle = row 7), so where two met, the line stepped flat. They now run
  between the cell's corners and edge midpoints in continuous coordinates,
  one pixel per row or column, so a line keeps its slope into its
  neighbour.
- **Wider screens are untested.** Rounding and centring (§8) apply to each
  display independently, so placing several primitives side by side for a
  wider screen is untested.
- **Fine-pixel size in blocks** (0.025) is uncalibrated, so layouts that
  depend on it need margins.
- **Implemented: a higher-resolution region layer** *(demo 1.1.68; in-game
  alignment and shimmer at k = 4 pending)*. `Source/RegionLayer.js` exports
  pure `RegionText(Host, Box, K, Family, Inside, Options)`. Host describes
  glyph A with `{ Cells, Lines, Scale }` (Scale = RowScale / 2); Box is
  `{ Column, Row, Columns, Rows }` in its 8×16 grid, and K is a positive
  integer. Glyph-only and seamless overlay hosts use the same descriptor;
  for overlays, anchor at Back and include its existing drop. All host lines
  must have this grid width. Blank the box on every host layer.
  - **Content and scale.** K×Columns by K×Rows sub-cells, at Host.Scale / K.
    Predicates receive sub-pixel centres in local 2×4 (Octant/Braille), 2×3
    (Sextant/SeparatedSextant) or 2×2 (Quadrant/SeparatedQuadrant) units.
    Exact-sized rectangular bitmaps are also accepted. Braille uses page
    the octant-style dots (`BrailleDotBase`) on the 8×16 grid, not
    vanilla's narrower grid.
  - **Vertical position.** Same anchor as A, with K×Host.Lines Unicode-font
    lines at GlyphOnlyLineGap = 6. Each padding line holds a PUA blank.
    Equal line count × scale follows §8's inferred vertical centring model;
    no new drop calibration is applied. Physical-client alignment is pending.
  - **Horizontal position.** Default blank-cell padding exactly centres each
    box at its cell offset. Two-cell wide blanks save bytes. WorldOffset
    instead returns a local right/up offset using Options.PixelSize, which
    remains uncalibrated. The demo adapter rotates it into world space and
    updates it when pixel calibration changes.
  - **Depth and lifecycle.** Transparent, depth-tested, OverlayDepth / 4 in
    front of B, behind an overlay's front. Offset and animation records
    create, move, remove and count attached region primitives.
  - **Glyph sets.** The 230 supplement narrow octants are reused. The 26
    missing patterns are drawn at E577–E590 (`OctantCompleterBase`), with
    existing wide copies.
    Each single-layer region retains 1/K-host-fine-pixel seams.
  - **Bytes and verification.** Lines over 128 UTF-8 bytes throw an Error
    with a smaller K or box/padding budget. `Tool/SimulateRegion.mjs` reads
    actual glyph PNGs, checks ink extent + 1 advances and rounded independent
    line centring, all 256 octant patterns and 324 placements at K = 1, 2, 4
    across six families and both placement modes. The pixel offset row has
    three 4×3 boxes on a 12×5 blank host, showing the same circle and ring.
  - **Practical limit.** At K = 4 a glyph pixel (about 2.5 mm at this row's
    scale) falls below one screen pixel at a few blocks' distance. Expect
    shimmer beyond about K = 2. Minimum scale and filtering remain untested.

## 12. Minecraft Ten and the UI button style

**The font** *(Measured)*:

- **Location.** Minecraft Ten is a loose TrueType file at
  `<client>/data/resource_packs/vanilla/font/minecraft-ten.ttf`. Its entry in
  `font.brarchive` is empty. Ore UI has an `.otf` copy under
  `data/gui/dist/hbui/fonts`.
- **Outlines** are straight-line pixels on a 70-unit grid, with a left
  bearing of 50 and the baseline at 0. Capitals are 10 pixels tall.
- **No real lowercase:** lowercase letters reuse the capitals' outlines.
- **Spacing and descent:** advances are ink + 1.43 pixels, and `|` descends
  3.6 pixels.

**Button text, Ore UI** *(Measured from the title screen's Play button)*:

- text #FFFFFF;
- shadow `text-shadow: 0.2rem 0.2rem 0 rgba(0,0,0,0.3)`, 1 font pixel right
  and down. On the green button face #3C8527 it is #2A5D1B.

The demo bakes that shadow as an opaque colour (§9.1, alpha), so it is
correct only on that green.

## 13. Tools and files (all in `Addon/DduiImageDemo`)

| File | Purpose |
| --- | --- |
| `Source/Layout.js` | `GlyphWidth`, `LineWidth`, `UsesLargeFont`, `LineHeight` (12), `UnicodeLineHeight` (10), `LineByteLimit` (128), `MeasureText`, `RowLayout`, `WrapText` |
| `Source/GlyphOverlay.js` | `SplitOverlay` (with `Seamless`), `LayerLine`, `GlyphOnly`, `CellLayer`, `GlyphOnlyLineGap`, `SextantArt`, `EvenPad`, `OverlayColors` |
| `Source/Main.js` | `AddText`, `AddOverlayBack`, `OverlayBack`, `AddMiddle`, `MiddleLocation`, `OverlayDrop`, `OverlayDepth`, gap constants, `Yaw`, the animation row (`AnimationEntries`) |
| `Source/LegacyComputing.js`, `Source/MinecraftTen.js` | stand-in mapping (`ToLegacyGlyphs`, `IsCellGlyph`, `LegacyWideGlyph`, `LegacyExtraGlyphs`, `ToMinecraftTen`, widths) |
| `Source/Octant.js` | octant pages and colours, `BrailleOctant` (Braille dots → octant blocks), `OctantGlyph` |
| `Source/TerminalArt.js` | the fireflies animation: `BrailleFrame` (with title), `BrailleCanvas` (without) |
| `Tool/GlyphWidths.mjs`, `Tool/ClientFont.mjs` | read the client's font sheets, `font.brarchive` and the large-font table in the executable |
| `Tool/CustomGlyph.mjs` (+ `LegacyGlyphs.mjs`, `LegacySupplementGlyphs.mjs`, `Unifont.mjs`, `MinecraftTen.mjs`) | generate the glyph pages and contact sheets |
| `Tool/MeasureGlyphs.mjs`, `Tool/GlyphShot.mjs`, `Tool/CaptureWindow.ps1`, `Source/GlyphProbe.js` | in-game width measurement from screenshots |

Glyph tables generated from the client's fonts reflect the client installed
at generation time. Regenerate them after a client update.

## Planned Canvas glyph assets and particle tint


- `Addon/BedformCanvas` (`bedform-canvas`) owns terminal/spatial custom glyph assets and their generators; unrelated DDUI/control assets remain in BedformCommon.
- Generate custom font pages with dark gray glyph ink `#4D4D4D`. TextPrimitive presentation uses the same default dark gray text color, including ordinary text and `§r` resets. PUA glyph ink is baked into the font PNG and is not recolored by TextPrimitive color or `§` codes.
- Generate matching particle-accessible texture copies of every custom glyph page with white glyph ink `#FFFFFF`, from the same authoritative glyph source. Preserve glyph shapes, source/stand-in identities, cell/UV layout, metrics and ink alpha; retain invisible width/switch helpers as metadata, not visible particle ink. Remove demo-specific baked color, background and shadow treatments from the particle ink mask so they cannot prevent arbitrary tinting. Keep any required text-overlay masking treatment separate from that mask.
- All glyph-particle spawn/render helpers, including one-shot and managed entry points, accept an explicit arbitrary RGB/RGBA tint and apply it to the white texture. If tint is omitted, apply dark gray `#4D4D4D` with alpha 1; explicit tint takes precedence. Do not quantize particle tint to the `§` palette or require precolored texture variants. Preserve texture alpha when tinting.
- Inventory every current demo page and later custom font family, including wide/seamless, octant and region glyphs. Preserve shapes and metrics while normalizing colors; pixel-for-pixel reproduction of the demo's cyan, multicolor or white font ink is not required. Keep provenance/licenses, deterministic generation, descriptors, packaging and freshness checks aligned for both representations. Future Nerd Fonts follow the same contract when implemented.
- Verify dark gray font ink and default TextPrimitive color, white particle ink and matching alpha/UVs, omitted-tint parity with explicit dark gray, explicit non-palette RGB and RGBA overrides, transparent cells and generated/packed asset availability. Native tests exercise actual tint forwarding; real-client checks establish appearance, alpha and arbitrary tint fidelity. This is a specification update, not evidence of implementation or visual acceptance.

The earlier demo color/page descriptions in this document record measured or historical behavior. This planned Canvas contract changes the shared asset output, not those observations or the demo itself.
