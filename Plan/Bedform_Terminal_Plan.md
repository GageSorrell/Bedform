# Plan: `bedform/Terminal`, a terminal-style renderer for Bedrock text

> **Superseded historical design — not an implementation specification.**
> The active [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) replaces this renderer. `MineCraft-2k9d` is closed as superseded; its nine formerly open children are closed as superseded with explicit replacement mapping in `MineCraft-w82n.5`. Preserve closed history.
>
> The entire design below is retained for provenance only, including old paths, no-shell wording, DDUI JSX, fullwidth cell assumptions, Braille Pen and the demo conversion recipe. None is an active requirement. The new design permits an optional actual Ink port at `bedform/Spatial/Terminal/Ink` using the single `bedform/Spatial/React` implementation, alongside separate `bedform/VM` services and runtime-owned `bedform/Spatial/Window`. A bare display starts none of those layers. `MineCraft-w82n.3/.4` own their dedicated specifications. Applicable measurements, frame/region lifecycle and compatibility concerns transfer according to the audit in `MineCraft-w82n.1`; this document does not revive the old emulator.

## Archived specification

## Context

`Addon/DduiImageDemo` (despite the name it is a TextPrimitive and DDUI fixture) shows by hand that
Bedrock's client font renders a uniform grid from fullwidth Latin and digits, Braille, box drawing,
arrows, diagonals, shading, quadrants and geometric shapes. See `BrailleFrame` and `TerminalTable` in
`Source/TerminalArt.js`, the ranges in `Source/CharacterSets.js`, and the "Ｅｇｇ" splice that replaces
three Braille cells with three fullwidth letters. This plan turns that into a reusable module,
`bedform/Terminal`. It only renders text: there is no TTY, session, shell or OS. It provides:

- a fixed-size cell screen that can patch part of a frame or replace the whole frame, and
  serializes to one `§`-formatted string for a `TextPrimitive.setText` or a DDUI label;
- Braille drawing functions whose coordinates are in **cells, fractions allowed** (a fraction
  addresses one of the 2×4 dots in a cell);
- `Box`, as close as practical to ink's `<Box>` (flexbox layout, borders and ink's prop names), plus
  `Text`, `Spacer` and `Newline`. `Box` cannot be used without these.

Decisions you made: blank cells and spaces render as **U+2800**. **All printable ASCII** maps to
U+FF01–FF5E. Any other character outside the confirmed repertoire becomes a **placeholder glyph**.

Client rendering findings since this plan was written are in
[Rendering text with `TextPrimitive`](../Documentation/TextPrimitive.md). In particular, the font sheets give
fullwidth Latin non-uniform advances (Ａ 7.5, ｅ 4.5 large-font pixels), while Braille is uniform at 3.5;
confirm cell widths in game before relying on fullwidth cells.

## Design

Each normalized code point fills exactly one cell, so the width of text is its code-point count once
mapped. Ink needs wcwidth to measure text; this terminal does not.

### Files (all new unless noted)

The layout follows Bedform's `Diagetic/Gizmo` pattern: public entry, public submodules, and internals
in `Source/Internal/`.

| File | Contents |
| --- | --- |
| `Package/Bedform/Source/Terminal.ts` | Public entry `bedform/Terminal`; re-exports below |
| `Source/Terminal/Glyph.ts` | `Blank` (U+2800) and `Placeholder` constants; frozen `Range` record (Fullwidth, BoxDrawing, Arrows, Diagonals incl. U+1FBA0–1FBAE / U+1FBD0–1FBDF, Shading, Quadrants, GeometricShapes, Braille); `IsSupported(codePoint)`; `Normalize(text)` (ASCII 0x21–0x7E → +0xFEE0, space → `Blank`, unsupported → `Placeholder`). Port of `Fullwidth()` from `TerminalArt.js`. |
| `Source/Terminal/Color.ts` | Bedrock color codes `§0–§f` plus material codes `§g §h §i §j §m §n §p §q §s §t §u §v`, each with an RGB value. `Resolve(color)` accepts ink color strings: chalk names (`red`, `blueBright`, `gray`…), `#rgb`/`#rrggbb`, `rgb(r,g,b)` and `ansi256(n)`, mapped to the nearest code. `Dim(code)` gives the darker variant for `dimColor`. |
| `Source/Terminal/Screen.ts` | `Screen` class (see below), `Surface` interface, `Region`, `Style`, `Target` types |
| `Source/Terminal/Braille.ts` | `Pen` drawing API (see below) |
| `Source/Terminal/Border.ts` | ink/cli-boxes styles: `single double round bold singleDouble doubleSingle classic arrow`, plus the `BoxStyle` interface for custom styles. `classic` (`+ - \|`) goes through `Normalize`, giving ＋－｜. |
| `Source/Terminal/Components.ts` | `Box`, `Text`, `Spacer`, `Newline` and `Canvas` as function components in the existing `DDUI/Element.ts` model; prop interfaces `BoxProps` and `TextProps` |
| `Source/Internal/TerminalLayout.ts` | Flexbox engine (Yoga subset) over float sizes, rounded to the cell grid the way Yoga rounds to pixels |
| `Source/Internal/TerminalText.ts` | Wrap/truncate measurement and line breaking for `Text` |
| `Source/Internal/TerminalRender.ts` | Element tree → layout nodes → paint onto a `Surface` |
| `Source/index.ts` (edit) | `export * as Terminal from "./Terminal.js";` |
| `Package/Bedform/package.json` (edit) | `"./Terminal"` export entry |

### Screen: partial frames and fresh frames

```ts
const screen = Terminal.Make({ Columns: 32, Rows: 10 });     // Blank, DefaultColor "§r" options; TextPrimitive default #4D4D4D
screen.Replace((s) => { s.Render(<Dashboard />); });        // scrap: clear everything, then paint
screen.Patch((s) => { s.Region(canvasRect).Draw(pen => …) }); // update part: paint over the current frame
screen.Present(display);                                     // setText only if the text changed
```

- Storage is flat typed arrays: code point (`Uint32Array`), color code index and style bits
  (bold/italic as `Uint8Array`), plus a per-row dirty flag and a cached row string.
- `Surface` (implemented by `Screen` and by `Region` views, which clip and use local coordinates) has
  `Write(column, row, text, style?)`, `Fill(rect, glyph, style?)`, `Clear(rect?)`,
  `Region(rect)`, `Draw(painter, pen?)` and `Render(node)`. `Render` clears the surface, lays out
  the element at the surface's size and paints it.
- `Patch` and `Replace` return the serialized text. Only dirty rows are re-serialized. Each row
  starts with its own color code (the demo already does this), and `§` codes are emitted only where
  the color or style changes. Rows are joined with `\n`.
- `Target` = `{ setText(text: string): void } | ((text: string) => void)`. It is structural, so
  `TextPrimitive` works without importing beta typings, and an `ObservableString` works through a
  lambda. `Present` remembers the last text it sent and skips unchanged frames.
- `Reset()` discards the cache and forces the next `Present` to send.

### Braille drawing (`Pen`)

All coordinates are in cells. Dot (i, j) is centered at ((i+0.5)/2, (j+0.5)/4). If cells are
square, a circle drawn in cell units stays a circle.

- `Point`, `Line` (DDA in dot space), `Polyline`, `Polygon`, `Rectangle`, `Ellipse`, `Circle`,
  `Arc` and `Bezier` (quadratic and cubic). Closed shapes take `{ Fill: true }`, which runs a
  scanline over dot centers.
- Pen options: `Mode: "set" | "clear" | "toggle"` and `Color`.
- Compositing: drawing on a Braille cell sets, clears or toggles bits using the demo's bit table
  `[1, 8, 2, 16, 4, 32, 64, 128]`. Drawing on a cell that holds another glyph replaces it with
  Braille. Clearing every dot leaves U+2800. Dots outside the surface are clipped.

### `Box` / `Text` with ink parity

`Box` props (ink 6 names and defaults: `flexDirection: "row"`, `flexShrink: 1`, `flexWrap: "nowrap"`):

- **Size:** `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` (number or `"N%"`).
- **Spacing:** `padding`, `paddingX`, `paddingY`, `paddingTop`, `paddingRight`, `paddingBottom`,
  `paddingLeft`; the same set for `margin`; `gap`, `columnGap`, `rowGap`.
- **Flex:** `flexGrow`, `flexShrink`, `flexBasis`, `flexDirection` (including the `-reverse`
  values), `flexWrap` (`wrap`, `wrap-reverse`), `alignItems`, `alignSelf`, `alignContent`,
  `justifyContent` (all six values), `display` (`flex` or `none`).
- **Position:** `position` (`relative` or `absolute`) with `top`, `right`, `bottom`, `left`.
- **Overflow:** `overflow`, `overflowX`, `overflowY` (`hidden` clips through a Region).
- **Border:** `borderStyle`, `borderTop`, `borderRight`, `borderBottom`, `borderLeft`,
  `borderColor` and the per-side color props, `borderDimColor` and the per-side dim props.
- **Background:** `backgroundColor` fills the box's unoccupied cells with U+2588 in that color.
  This is a client acceptance check, because Bedrock text has no background.
- **Accessibility:** the `aria-*` props are accepted and have no effect.

Ink behaviors that are kept:

- Bare strings inside a `Box` throw ink's error ("Text string … must be rendered inside `<Text>`").
- Nested `Text` inherits styles.
- `Text` `wrap` supports `wrap`, `truncate`, `truncate-start`, `truncate-middle` and `truncate-end`
  (`end` and `middle` are aliases). The ellipsis is `…`, which is not in the repertoire, so it maps
  to the placeholder. To avoid that, truncation uses fullwidth `．` instead and the docs say so.
- `Text` style props: `color`, `dimColor`, `bold` (`§l`) and `italic` (`§o`).
- `underline`, `strikethrough`, `inverse` and `backgroundColor` on `Text` are accepted but have no
  effect, because Bedrock has no formatting for them. The docs list this.
- `Spacer` is `Box flexGrow={1}`. `Newline` takes `count`.

`Canvas` is a Bedform extension: a leaf `Box` (sized like any `Box`) with a
`draw(pen, size)` callback in local cell coordinates. It joins layout and Braille drawing.

JSX uses the existing automatic runtime: `/** @jsxImportSource bedform/DDUI */`. The renderer
recognizes the components by identity and does not call them. Other function components are
called normally, as in `Element.ts`.

### Conventions to follow

- Every module needs a header (`@module bedform/Terminal/...`, `bedform/Internal/Terminal...`).
- Every symbol needs TSDoc ending with `@category` and `@since 1.0.0`, with no `@param` or
  `@returns`.
- Use PascalCase for constants.
- Nested object types are declared as `Owner.Member` interfaces in namespaces (for example
  `BoxProps`, and `Border.BoxStyle` declared in its own namespace).
- Public Bedform API is PascalCase (`Make`, `Patch`, `Replace`), matching `Diagetic/Gizmo`. Ink
  props keep ink's camelCase names.

### Shared Canvas assets

The original vanilla-only terminal path needs no custom font assets. Asset-backed terminal and multilayer custom-glyph presentation use `bedform-canvas`, which owns the dark gray font pages and white particle texture copies described below. Any custom glyph resource-pack fix belongs in `Addon/BedformCanvas`. Keep native `§` palette resolution separate from arbitrary particle tint.

### Demo update (`Addon/DduiImageDemo`)

- Replace the hand-built `BrailleFrame` canvases with a `Screen` rendered from JSX. The new
  `Source/Dashboard.jsx` contains:
  - a round-bordered `Box` with a title;
  - a `TerminalTable`-style table made of `Box` rows;
  - a `Canvas` that animates the fireflies and ribbons, ported to `Pen` calls.
- Each tick calls `Patch` on the canvas region only. Gallery creation calls `Replace`.
  `Present(display)` sends the text to both TextPrimitives. The line-gap tool stays.
- `Tool/Build.mjs`: add `jsx: "automatic"`, `jsxImportSource: "bedform/DDUI"`, and an `alias`
  `bedform` → `../../Package/Bedform/Source` so the bundle uses current source, as it already does.
- Bump the demo to 1.2.0 and update `README.md`. `TerminalArt.js` can be removed once the port is
  done, but `CharacterSets.js` stays as the reference chart.

### Docs

Add `Package/Bedform/Documentation/terminal.md` covering:

- the repertoire, normalization, U+2800 blank and placeholder;
- Patch vs Replace;
- Pen units;
- the ink parity table, including ignored props.

Also add a one-line entry to `Package/Bedform/ReadMe.md`.

## Verification

1. Run `bd create` for the work and claim it, then close it when the work is done.
2. `npm run verify --workspace bedform` (config check, typecheck, all tests, tool typecheck and
   lint), with these new tests:
   - `Test/Terminal.test.mts`:
     - Normalization: ASCII → fullwidth, space → U+2800, unsupported → placeholder.
     - Color mapping: names, hex, `rgb()` and `ansi256()` map to the nearest code.
     - Patch only re-serializes dirty rows; Replace clears; `Present` skips unchanged text.
     - Serialization emits `§` codes only where the color changes.
     - Pen: exact dot bits for lines, filled and stroked rectangles and circles, and
       `clear`/`toggle`.
     - Layout: ink fixtures ported from ink's `test/flex-*.tsx`, `borders.tsx`, `padding.tsx`,
       `margin.tsx`, `gap.tsx`, `width-height.tsx`, `overflow.tsx` and `text.tsx`, MIT with
       attribution. Their expected strings are converted through `Normalize`.
     - The bare-string error.
   - `Test/Terminal.types.mts`: prop typing (an invalid `flexDirection` or `borderStyle` fails).
   - `Test/Consumer.test.mts` / `Package.test.mts`: the installed `bedform/Terminal` import works
     in Node with no native modules, and the export entry is packed.
3. `npm run build --workspace @sorrell/ddui-image-demo`, then `npm start --workspace @sorrell/ddui-image-demo`.
   Confirm the BDS log shows `TRANSACTIONAL_DEMO_READY 1.2.0` and the gallery-ready line, with no
   script errors.
4. Client acceptance, which needs you to look: grid alignment of borders, fullwidth text and Braille,
   the U+2800 blank width, bold/italic advance, and U+2588 backgrounds. Make a bead for each result.
5. No commit, push or Dolt sync unless you ask.

## Canvas custom glyph asset and tint contract (November 17, 2026)

- `Addon/BedformCanvas` (`bedform-canvas`) owns terminal/spatial custom glyph assets and their generators; unrelated DDUI/control assets remain in BedformCommon.
- Generate custom font pages with dark gray glyph ink `#4D4D4D`. TextPrimitive presentation uses the same default dark gray text color, including ordinary text and `§r` resets. PUA glyph ink is baked into the font PNG and is not recolored by TextPrimitive color or `§` codes.
- Generate matching particle-accessible texture copies of every custom glyph page with white glyph ink `#FFFFFF`, from the same authoritative glyph source. Preserve glyph shapes, source/stand-in identities, cell/UV layout, metrics and ink alpha; retain invisible width/switch helpers as metadata, not visible particle ink. Remove demo-specific baked color, background and shadow treatments from the particle ink mask so they cannot prevent arbitrary tinting. Keep any required text-overlay masking treatment separate from that mask.
- All glyph-particle spawn/render helpers, including one-shot and managed entry points, accept an explicit arbitrary RGB/RGBA tint and apply it to the white texture. If tint is omitted, apply dark gray `#4D4D4D` with alpha 1; explicit tint takes precedence. Do not quantize particle tint to the `§` palette or require precolored texture variants. Preserve texture alpha when tinting.
- Inventory every current demo page and later custom font family, including wide/seamless, octant and region glyphs. Preserve shapes and metrics while normalizing colors; pixel-for-pixel reproduction of the demo's cyan, multicolor or white font ink is not required. Keep provenance/licenses, deterministic generation, descriptors, packaging and freshness checks aligned for both representations. Future Nerd Fonts follow the same contract when implemented.
- Verify dark gray font ink and default TextPrimitive color, white particle ink and matching alpha/UVs, omitted-tint parity with explicit dark gray, explicit non-palette RGB and RGBA overrides, transparent cells and generated/packed asset availability. Native tests exercise actual tint forwarding; real-client checks establish appearance, alpha and arbitrary tint fidelity. This is a specification update, not evidence of implementation or visual acceptance.
