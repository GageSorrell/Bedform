# Spatial text

`bedform/Spatial/Text` supplies an explicitly selected, text-only surface for
`Spatial.Renderer`. Importing it creates no primitives, timers or subscriptions.
Compose its `Commit`, `Update` and `Dispose` methods with another surface when a
root also needs non-text visuals.

```ts
import { TextPrimitive, system, world } from "@minecraft/server";
import * as Renderer from "bedform/Spatial/Renderer";
import * as Text from "bedform/Spatial/Text";
import type { Dimension, DimensionLocation } from "@minecraft/server";

const Surface = Text.CreateSurface({
    Dimension: id => world.getDimension(id),
    CreateText: (location, value) =>
        new TextPrimitive(location as DimensionLocation, value) as unknown as Text.Primitive,
    AddText: (primitive, dimension) => world.primitiveShapesManager.addText(
        primitive as unknown as TextPrimitive, dimension as Dimension)
});
const Runtime = Renderer.Start({
    World: world, System: system, Native: { TextPrimitive }, Surface
});
// CreateRoot and Render use the ordinary spatial React components.
// Await Runtime.Dispose() to release every private presentation.
```

The experimental native ABI is injected explicitly. Each audience lease registers
its own primitives, with `visibleTo` configured before `addText`. Every location
includes its dimension. Each outer Text's committed visual line gets one
fixed-rotation primitive; inline Text nodes contribute color runs to those lines.
Depth testing is enabled, both backface flags are disabled, and backgrounds are
transparent. Layer offsets use the View's depth setting. Yaw is +F normalized to
(-180, 180]; client pitch/roll appearance still needs physical verification.

Layout and presentation share the encoded lines, wrapping and measured anchors.
Line starts compensate for whole-pixel client rounding. `TextAlign` moves the
anchor for start, center and end alignment. `EvenPad` adds the established small
padding characters to obtain an even transmitted extent; these are real glyphs,
and their ink is included in clipping. They can be visible on a transparent
background. Font-switch advance is removed from the intended visible start.
`BlocksPerLargePixel` is the single 0.025 estimate used to derive native scale
from the View's pixels-per-block setting; it remains uncalibrated.

Mojangles lines include Canvas's invisible fine-font switch. Its identity and
all custom PUA advances come from the authoritative Canvas catalogue through
`Tool/TextMetrics.mts`; using this surface marks a surviving bundle as requiring
the shared Canvas packs. PUA ink stays baked dark gray and does not inherit Text
colors. Arbitrary glyph tinting uses Canvas's white particle textures instead.
The Legacy fallback and Minecraft Ten substitution policies remain the separate
font feature; this surface does not yet convert Ten ASCII to stand-ins. Use
Mojangles for native text through this implementation.

The outer Text's native color can be arbitrary RGB/RGBA. Both default theme
foregrounds are #4D4D4D, including `§r` resets, and custom ThemeProvider foreground
tokens and explicit Color values override them reactively. Nested colors use
the nearest Bedrock § palette color; nested alpha must equal the outer alpha.
Nested providers and separate React roots keep their own defaults and overrides.

Color codes and `§r` have no width. Unknown codes and U+0000 are rejected during
layout, before presentation. `§k`, `§l` and `§o` require an explicit `Measure`
override accepting responsibility for their widths. Measure receives visible
content with color codes and the internal switch removed; width-changing codes
remain. Byte wrapping always counts the final transmitted codes, switch and pad,
including continued color state, against 128 UTF-8 bytes. Wrapping preserves
Unicode code points and explicit empty lines. Right-to-left text draws in stored
order; the renderer performs no bidirectional reordering.

TextPrimitive exposes no rectangular scissor. A ScrollView line intersecting an
edge is omitted in full, including from text hit-testing; it becomes visible again
when scrolling admits the complete line and its padding. This is conservative
line clipping, rather than native partial-glyph clipping. Other controls retain
their own policy and pointer admission rules.

Unchanged content causes no `setText` calls. Static placement gets one resend five
native ticks later; a content change cancels that resend. Removed/hidden/clipped
lines release their handles, and the enclosing renderer owns rollback and cleanup
if native allocation or configuration fails.

`Test/SpatialText.test.mts` covers encoding, final byte budgets, alignment,
private registration, updates/resends, clipping, yaw, themes and root isolation.
The installed consumer qualification imports the public subpath in both JSX modes.
`Addon/BedformCanvas/Test/Native/Text.mts` exercises actual native constructor,
registration, flags, arbitrary RGB, audience, byte-wrapped writes, resend and
removal through the fixed-path Canvas BDS runner. Native results do not establish
client appearance, font-switch invisibility, alpha, PUA tint fidelity, clipping
appearance or pixel-to-block calibration.

Recorded server evidence is in
[spatial-text-native.results.json](spatial-text-native.results.json), using
BDS 1.26.63.1 build 53340801. Explicit alpha was retained by the native API;
its appearance still requires a client check.

For isolated text qualification, run
`node --import tsx Addon/BedformCanvas/Tool/Native.mts --text-only` from the root.
This skips the independent widget-actor probe while retaining Canvas's common
lifetime/restart checks. Results mark `SpatialTextAcceptance` separately and do
not claim full Canvas native acceptance when that option is selected.
