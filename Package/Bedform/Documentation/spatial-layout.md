# Spatial components and committed layout

Import components from `bedform/Spatial/Components` and geometry operations from
`bedform/Spatial/Layout`. They are also exposed as `Spatial.Components` and
`Spatial.Layout`. They use the single `bedform/Spatial/React` client; imports
start no runtime, timers, native actors or display. Automatic JSX uses
`jsxImportSource: "bedform/Spatial/React"`.

```tsx
import { View, TitledPanel, Row, Button, Text } from "bedform/Spatial/Components";

const application = <View Dimension="minecraft:overworld" Width={160}
    Transform={{ position: { x: 0, y: 64, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } }}>
    <TitledPanel Title={<Text>Controls</Text>} Width={160}>
        <Row Gap={4} Align="center">
            <Button><Text>Open</Text></Button>
            <Text>Ready <Text Color="#55FF55">now</Text></Text>
        </Row>
    </TitledPanel>
</View>;
root.Render(application);
```

The [runtime](spatial-runtime.md) requires an injected surface backend. This
delivery supplies typed descriptors and layout, including controls, images,
inventory slots, mobs, callouts, bars and framed panels. Native textures, actors,
quantity overlays, pointer admission, gesture routing and control callbacks are
implemented by their separate component/input deliveries. `OnActivate`, controlled
values and callback props are retained for those adapters; layout does not fire
events. There is no placeholder `Terminal` or `Glyph` component. `GlyphProps`
provides the future leaf contract.

## Coordinates and flow

Each `View` defines a dimension and rigid quaternion transform. Local X points
right and Y points down. `PixelsPerBlock` defaults to 16 and `LayerDepth` to
0.002 world blocks. Finite nonzero quaternions are normalized; no yaw-only
restriction applies. `Project` and `Unproject` use the committed pose. Callers
can use an item's `Layer * view.LayerDepth` as its projection depth.

`Width`/`Height` accept nonnegative pixels or `"auto"` (also the omitted default).
Content sizes include padding; minima constrain both explicit and natural sizes.
Padding is a number or `{ Top, Right, Bottom, Left }`, with omitted sides zero.
`Row` flows horizontally; `Column`, `View` and `Panel` flow vertically unless
`Panel.Direction` selects a row. `Gap` separates flow children. `Align` selects
start/center/end/stretch on the cross axis; stretch applies to automatic sizes.
`Justify` selects start/center/end/space-between on the main axis. `Grow` divides
positive remaining space proportionally, without implicit shrinking. Content can
overflow an explicitly small box.

Relative `X`/`Y` offsets preserve the child's original flow space. Absolute
children use the padded content origin and contribute no natural flow size.
`Layer` adds to inherited depth and controls hit order. `Visible={false}` and
React's hidden host state hide descendants. No arbitrary ancestor clipping is
introduced. `ScrollView` provides clamped nonnegative offsets, content viewport
rectangles and their intersected clips for both presentation and hit testing.
An overflowing `ScrollView` whose scrollbar is not `"hidden"` also commits
`Item.Track`, the rectangle where its scrollbar would be drawn, which
[pointer targeting](spatial-pointer.md) hits even while a `"hover"` bar is not
shown. Scrollbar artwork, arrows and gestures remain with `ty2k.21`.

`InputScope` contributes no visual box or flow gap. Its item requirements and
access policies accumulate with those on ancestors; pointer settings inherit
with nearer overrides. [Access control](spatial-access.md) applies the policies.
`Pointer.Visible={false}` hides the pointer line without hiding targets.
`Pointer.MaxDistance` and the reactive `Pointer.Color` callback are described in
[pointer targeting](spatial-pointer.md).

## Text and child contracts

All external display text is a `Text` child, including control labels. Text
accepts scalar content and nested `Text`; nested runs can change `Color` and
repeat equal `Font`, `Fallback` and `FallbackScope` settings. Other nested layout
or text-setting changes are errors, including alignment, visibility and
access/pointer policy overrides: an inline run has no independent box or target.
Layout retains inline color ranges and
code-point-safe line boundaries (range indices use UTF-16), measured with the
shared Minecraft font tables. `Measure` can override line widths. The
[text surface](spatial-text.md) encodes color runs, enforces native byte limits
and places each line from this layout. Font fallback/substitution and physical
client calibration remain separate qualification work.

Containers exclude strings and numbers from their child types, including arrays.
`Slot` admits no child or one `ItemStack`. `ItemStack`, `Image`, `Mob`, `Divider`
and future glyph props are leaves. `Title` and custom callout `Heading` are
explicit Text element slots, rather than string labels. Tabs admit TabButtons.
These restrictions are checked again after composite/fragment reconciliation,
including descendant-only state updates. Invalid frames are withheld and the
nearest component guard throws through an ordinary React error boundary.

JSX erases an element's precise component/prop identity. Types cannot reliably
reject a `Panel` passed where a `Text`/`ItemStack` element is expected, a composite
that resolves to the wrong host, or forbidden ancestry through providers. Runtime
checks are authoritative. React drops empty strings, booleans and null output;
the host cannot inspect scalar output it never receives. Direct container
children and fragments are additionally checked before that normalization.

## Frames, tabs and themes

`FramedPanel` and `TitledPanel` must be top-level visual children of `View`.
Fragments, providers, function components and nonvisual InputScopes may intervene;
they never erase a visual ancestor. Initial renders and reactive ancestry changes
are checked. Frames use theme padding/minima; titled panels add a centered Text
title and a padded dark translucent content region. Their height accommodates the
title/content minimum. Rounded screen geometry and native artwork remain separate.

`Tabs` attaches above its frame's upper-right edge. `Inset` moves it left and
`Overlap` moves it down. Attachments do not enlarge normal flow. A strip wider
than its available frame width is hidden, including every hit target. `TabButton`
retains caller-controlled `Selected`, `Disabled`, `OnActivate` and recipe/subtle
appearance; selecting one never mutates its siblings.

`ThemeProvider` supplies reactive light/dark Minecraft-style palette and layout
tokens, with nested partial overrides. An omitted theme inherits its parent;
explicit component colors and dimensions override defaults. `Theme.Dark` and
`Theme.Light` are frozen defaults. These logical tokens do not certify a match
to native Minecraft screen assets.

## Surface and verification

The [text surface](spatial-text.md) consumes the same encoded per-line layout,
including nested colors, native byte wrapping and measured alignment. Partially
clipped Text lines are omitted from both text drawing and text hit-testing.

`Root.Layout` and `SurfaceFrame.Layout` reference the same frozen result for each
valid commit: View poses/extents, item bounds/content, layers, text lines/runs,
policies and scroll clips. `HitTest` returns visible rectangles front-to-back
using layer then paint order and half-open edges. It retains access-denied or
disabled-policy surfaces so the later pointer layer can preserve occlusion.
It does not perform world raycasting or permission decisions. Nested opaque
consumer prop objects follow the runtime's shallow snapshot contract.

```sh
npm run test:spatial-layout --workspace bedform
```

Tests cover flow properties, arbitrary orientation, clipping, reactive metadata,
themes, titles/tabs, resolved child/ancestry failures and error boundaries. The
independently installed archive compiles positive/negative consumers and executes
both automatic JSX modes in a restricted host without native/Node/browser imports.
These are source/host/package checks. Native BDS rendering, texture fidelity,
physical-client input, visibility and Switch acceptance remain unverified.
