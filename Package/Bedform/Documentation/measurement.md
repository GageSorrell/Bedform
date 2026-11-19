# Text measurement

`bedform/Spatial/Measurement` (also `Spatial.Measurement`) provides inert, pure font
measurement without Minecraft imports, Node APIs or TextEncoder. `LineWidth`,
`MeasureText`, `WrapText` and `EvenPad` share the same optional measurement override.

```ts
import * as Measurement from "bedform/Spatial/Measurement";

Measurement.LineWidth("hello"); // client-selected font, including trailing advance
Measurement.LineWidth("hello", { Font: "Mojangles" }); // native fine-font metrics
Measurement.MeasureText("first\nsecond"); // { Lines, Width }, stops at native NUL
Measurement.LongestLineBytes("§ahello"); // formatting counts toward 128-byte lines
const pad = Measurement.EvenPad("hello"); // suffix, making the width even
```

Widths use large pixels, including trailing advance. `Auto` selects the large font
only when every visible code point belongs to its 438-character table; otherwise
the entire line uses Mojangles. Color/reset codes have no advance. Width-changing
`§k`, `§l` and `§o` are rejected. Each supplementary code point occupies one missing
glyph, with no surrogate truncation or low-word aliasing. Native Mojangles presence
and advances are separate from custom PUA stand-in metrics: `HasGlyph` never
reports a Canvas stand-in as a native character.

`Legacy` uses large advances where available and native fallback elsewhere. `Ten`
uses the existing Canvas printable-ASCII stand-in advances, in page texels; lowercase
mapping and substitution belong to the text renderer. No new Ten glyphs are allocated.
Use Canvas's authoritative catalogue for custom PUA advances, as the Intent renderer
does. `Limits` records native pitches (12 large, 10 Unicode) and the 128-byte limit.
Blocks per pixel remain subject to client calibration.

`Override(text, font)` runs before font selection, formatting validation or table
lookup, for **every** font, including Ten. Return a finite nonnegative width to
measure a resource-pack font or unresolved translation; return `undefined` for the
bundled metrics. The complete candidate line is passed during wrapping and padding.
`Utf8Bytes` counts raw transmitted bytes, including codes and lone surrogates;
`LongestLineBytes` does not hide bytes after NUL. `MeasureText` models native NUL
truncation. `WrapText` preserves explicit newlines and keeps an overwide word intact.

## Generation and provenance

`Tool/TextMetrics.mts` generates the tracked
`Source/Spatial/Internal/TextMetrics.generated.ts` from Minecraft for Windows
**1.26.6501.0**. It reads the installed client's `font.brarchive` PNGs and executable's
extended character-to-cell table. Ten advances reuse the Canvas catalogue generated
from its checked-in `minecraft-ten.ttf` capture; this shares the existing source and
does not rasterize or allocate a second font.

The generated module records the client version and classification rule. A native
glyph is present when its page exists and its cell has nonzero alpha; space is present
by rule. Missing/empty cells, absent pages and supplementary characters retain the
missing-box advance. Surrogates are never exposed as supported characters.

```sh
npm run text-metrics --workspace bedform
node --import tsx Package/Bedform/Tool/TextMetrics.mts --check --require-client
```

Ordinary builds consume the tracked tables without a client. `verify` runs the
freshness check when a client is installed; `--require-client` makes absence fail.
Tests compare all BMP advances, large-font membership and Ten advances with the demo,
and exercise font choice, presence, Unicode identity, overrides, bytes, wrapping and
centering pads. These are file measurements and host checks, not new client observations.
