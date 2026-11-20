# Bedform React and interactive 3D widgets

## Summary

Add a Bedrock-compatible port of React, a particle-based spatial renderer, and a pointer system:

- `bedform/Spatial/React`: the shared React APIs, hooks, types and JSX runtimes for spatial widgets, Ink and Windows.
- `bedform/Spatial/Renderer`: React rendering, 2D layout, `TextPrimitive` text and particle surfaces.
- `bedform/Spatial/Pointer`: crosshair targeting, hand-to-surface lines, interaction and access control.
- `bedform/Spatial/Glyph`: named glyph components, grouped into category submodules, for legacy computing and supported non-ASCII Mojangles symbols; Nerd Fonts families follow later.

Support private and shared widgets, defaulting to private. Implement particles first; retain an internal surface interface for a future cuboid backend.

## React port

- Pin the port to verified releases: `react@19.3.1`, `react-reconciler@0.34.0` and their scheduler contract. Preserve upstream licenses, provenance and a reproducible adaptation process.
- Keep the core and reconciler independent of Minecraft. Adapt host scheduling, timers and error reporting without requiring Node, browser globals or global polyfills.
- Implement all 18 stable hooks: `useState`, `useReducer`, `useOptimistic`, `useContext`, `useRef`, `useImperativeHandle`, `useEffect`, `useLayoutEffect`, `useInsertionEffect`, `useEffectEvent`, `useMemo`, `useCallback`, `useTransition`, `useDeferredValue`, `useDebugValue`, `useId`, `useSyncExternalStore` and `useActionState`. Include the `use` resource API and its Promise/context behavior. [React hooks](https://react.dev/reference/react/hooks)
- Preserve upstream element creation, context, refs, memoization, class components, error boundaries, lazy loading, Suspense, Activity and StrictMode behavior where host-independent.
- Schedule urgent work ahead of transitions, yielding between units of work within a configurable tick budget. Document that component execution cannot be preempted and server commits cannot guarantee client paint timing.
- Publish a compatibility matrix. Browser animation, hydration, Server Components and DOM APIs are outside this renderer. Preserve upstream client semantics for server-oriented APIs; render `ViewTransition` children without browser animations and document that limitation. [React 19.3](https://react.dev/blog/2026/09/09/react-19-3)

Expose `bedform/Spatial/React/jsx-runtime` and `bedform/Spatial/React/jsx-dev-runtime`. Preserve React’s public naming and signatures. Use this single React port for widgets, `bedform/Spatial/Terminal/Ink` and `bedform/Spatial/Window`; neither adds a second React implementation. Remove DDUI elements, hooks and JSX runtimes while preserving imperative CustomForm, Direction, Transactional and navigation APIs. Preserve unrelated JSX users such as `@bedrock-core/ui`.

### Display, Ink and Window boundaries

The [canonical terminal plan](Bedform_Terminal_Canonical_Plan.md) owns display appearance, sizing, collision and persistence. `bedform/Spatial/Terminal` distinguishes canonical display and canonical VM construction; display-only creation starts no VM, React or Ink runtime. Bare `bedform/Spatial/Terminal/Display` provides frames, regions, measurements, snapshots, input adapters and lifecycle independently of React and canonical storage.

Ink is an optional port above those surfaces, using virtual streams and a qualified portable layout implementation without Node processes, native TTYs or host filesystems. Preserve supported upstream component/hook names and semantics, pinned sources, provenance/licenses and compatibility tests. Bedform extensions, including reusable input/scrollback and shell presentation, belong under `bedform/Spatial/Terminal/Ink/Components/*`. The shell's services belong to `bedform/VM`; adding React or a display alone never starts a virtual computer.

`bedform/Spatial/Window` creates, updates and disposes an independent React root using Canvas crafting/furnace framing, optional matching backface and rounded border extrusion. Reuse the canonical React-independent frame geometry. Each Window owns an external snapshot/subscription/update store and typed bidirectional events; React reads the store through `useSyncExternalStore`. Isolate focus, events, stores, errors and cleanup. Disposal unmounts React, releases resources/subscriptions and rejects subsequent operations. Windows default private and are explicitly shareable. They are runtime-owned with snapshots for consumer persistence, without automatic application restoration, and operate independently of Ink and VM. The dedicated [Ink/Window specification](Bedform_Terminal_Ink_Window_Plan.md) is recorded by `MineCraft-w82n.3`; the [VM specification](Bedform_VM_Plan.md) records VM services and shell/input details under `.4`.

## Spatial rendering and packaging

- Introduce an explicitly started `Spatial` runtime with injected world, system and native constructors. Imports create no subscriptions, timers or entities.
- `Renderer.CreateRoot` creates either a private root for a specified player or an explicitly shared root with an audience provider. Roots expose `Render` and idempotent `Unmount`.
- Provide typed `View`, `Panel`, `Row`, `Column`, `Text`, `Image`, `Slot`, `ItemStack`, `ScrollView`, `Button`, `Toggle`, `Slider`, `Mob`, `ThemeProvider`, `Callout`, `Divider`, `Bar` and nonvisual `InputScope` components. Track `Terminal` as a later integration with the terminal screen. Function components remain ordinary React components.
- `View` is the main container: the root placed in the world. A widget is the tree under one `View`. `View` supplies reactive dimension, rigid transform, dimensions, pointer settings, item requirements and access policy. Use local 2D coordinates with X right, Y down and configurable pixels per block; default to 16.
- All text must be wrapped in a `<Text>` component:
  - A string or number child anywhere outside a `Text` is an error. The component types reject it at compile time: every component other than `Text` types its children without `string` or `number`. The host config rejects it at render time by tracking in its host context whether it is inside a `Text`, and throws a render error that an error boundary can catch.
  - User-authored display text belongs in `Text` children rather than label props, including labels of `Button`, `Toggle`, `Slider` and `Callout`. Components may internally compose `Text` for generated content such as an `ItemStack` quantity, a standard callout heading or a named glyph. This does not permit bare text children on those components.
  - A `Text` may contain only text and nested `Text`. A nested `Text` is an inline run that may change `Color`. It inherits `Font`, `Fallback` and `FallbackScope`, and setting any of them to a different value is an error, because the font is chosen per line.
- Implement row/column layout with explicit or content-based dimensions, padding, gap, alignment, flex growth and absolute placement. Add rectangular viewport scrolling through `ScrollView`, including matching drawing and hit-test clipping. CSS parsing and arbitrary clipping outside `ScrollView` remain excluded.
- Bundle a customizable Minecraft-style theme. Add build-time PNG registration and generated image descriptors so images resolve to packaged particle assets without fetching resources at runtime.
- Render text as fixed-rotation `TextPrimitive`s with transparent backgrounds and world depth testing, in the fine Mojangles font by default (see [Text and fonts](#text-and-fonts)).
- Render panels and images using oriented, textured particle rectangles with Molang-controlled size, UVs, tint and pose. Use per-player emission for audience isolation, including shared widgets.
- Refresh particles every tick with a two-tick lifetime. Document the bounded visual delay when content changes or disappears. Apply configurable work limits and report capacity failures without leaving invisible controls interactive.
- Before further epic work, `Bedform-ty2k.35` fixes canvas/widget depth conflicts. Canvas and committed spatial layout share positive, configurable separation (default 0.01 blocks) along the surface normal. Resolve overlapping equal/fractional layers in layer/tree paint order while preserving disjoint planes, clipped bounds and hit order. Spatial backends project using committed `Item.Depth`. Host checks establish these calculations; multi-angle and multi-distance real-client observation remains the visual acceptance gate.
- Add shared textures, particle definitions, invisible proxy entities and the glyph pages described under [Text and fonts](#text-and-fonts) to BedformCanvas through its generators. Reuse the single `Canvas.Images` compiler and virtual `generated/canvas/images.ts` descriptor contract from the [Canvas/Intent plan](Bedform_IntentBubbles_Plan.md); React adds descriptor consumption, not a second image registry. Keep TypeScript and bundling aligned on `bedform/Spatial/React` for automatic JSX and preserve explicit per-file overrides for supported JSX engines. Remove DDUI JSX defaults and declarative-only configuration/diagnostics.
- Export `Spatial` from `bedform`, with `Spatial.React` providing the shared React namespace, and publish the requested subpaths. Do not make this delivery depend on completion of the existing adaptive-anchor or button-demo projects.
- BedformCanvas owns shared spatial/terminal assets and canonical display/VM entities plus identity, ownership and persistence support. Common retains unrelated imperative DDUI/control assets. Keep frame geometry and imperative glyph/particle machinery reusable without React startup; general Canvas bundling must not require the complete Intent feature.

## Minecraft components

The following extends the epic's implementation scope. All listed visual and behavioral props are reactive unless explicitly documented otherwise. Changes must update the committed layout, rendering and hit-testing together, including cancelling gestures whose targets disappear. Components inherit the enclosing `View` transform, audience and access policies. Internal generated text follows the same font, measurement, byte-limit and depth rules as `Text`.

### Slot and ItemStack

- `Slot` looks like a vanilla Minecraft inventory slot, including its recessed frame and item inset. It accepts either no child or exactly one `ItemStack` element. Reject other children and multiple stacks at compile time where expressible and at render time, including conditional/fragment expansion. An empty conditional child is an empty slot.
- `ItemStack` displays a block or item using an invisible entity that holds the represented stack. The result, positioned immediately in front of a `Slot`, must match its inventory appearance, rather than its dropped-item or ordinary held-item pose. Preserve the requested block/entity-backed representation use case; establish the supported native representation contract during the implementation probe and document unsupported inputs explicitly.
- Expose reactive stack identity/content and quantity. A quantity greater than one adds a bottom-right `TextPrimitive` count through internal `Text` composition; one has no count. Define validation for invalid/nonpositive quantities and native stack limits. The visual quantity must not require spawning or dropping that many real items.
- Align the representation, frame and count in layout pixels, with deliberate depth offsets. Support reactive replacement and orientation changes without leaking actors or count primitives. The invisible holder must have no visible body, pickup/drop behavior or unintended world interactions.
- Native qualification must establish the inventory pose and scale for both flat items and 3D blocks, including custom content where supported. Actor visibility must obey private/shared audiences; invisibility of the holder alone is not evidence that its held item is private. Test destruction, disconnect, dimension changes, failed spawns, replacement and restart cleanup.

### ScrollView

- Lay out children inside a rectangular viewport and translate their content by a clamped scroll offset. Content outside it is neither visible nor interactive. Support vertical and horizontal orientation, content resizing, nested views and offset updates without remounting.
- Expose `scrollbarVisibility` with `"always"` (default), `"hidden"` and `"hover"`. `"hover"` shows the scrollbar when an eligible pointer is over the track rectangle where it would be drawn, including while the bar is hidden; retain it during an active scrollbar gesture. The prop changes dynamically. Hiding the scrollbar does not itself reset the offset.
- Arrow buttons at the two ends are hidden by default and enabled with a reactive prop. Each is square, with side length equal to the scrollbar thumb's width (its cross-axis thickness for horizontal scrollbars). Reserve arrow space consistently when calculating track length and thumb travel.
- Implement thumb size and position from the viewport/content ratio, bounded offset, track activation, arrow steps and thumb dragging through the existing pointer/gesture system. Click/activation paths must work without release-capable input; do not fabricate releases. Define the no-overflow and too-small-track cases without negative sizes or division by zero.
- Keep the hover track available to targeting even when it has no visible scrollbar. Decide visibility per eligible audience/pointer state and test multiple players. Clipped children cannot intercept pointers or count toward access admission outside the viewport.
- Qualify clipping for particles, images, text and glyphs. Probe native clipping constraints for entity-backed `ItemStack`/`Mob` children and document or reject unsupported combinations explicitly; do not silently let them bleed beyond the viewport or remain interactive there. General arbitrary masks remain outside scope.

### Button

- `Button` defaults to the appearance of vanilla pause-screen buttons.
- The reactive prop is named exactly `appearance`, with `"pause"` (default) and `"disconnect"`. `"disconnect"` matches the buttons on the screen shown after the client loses its server connection. Capture both references from the target client during implementation, and record asset provenance.
- Both appearances support normal, hovered, pressed and disabled states, the same activation/access contract, and `Text` children. Switching appearance changes styling without losing component identity or active control state. Derive the geometry/texture treatment from the corresponding reference rather than treating the styles as a single color change.

### Mob

- A reactive mob-type prop selects the mob to spawn. Position and size the displayed mob against the root `View`'s main 2D surface using explicit visual bounds, scale and anchor, so its projected appearance lines up with the text and particles in the layout. Recompute placement under layout and root-transform changes; the mob is not placed independently on the world floor.
- Expose an imperative handle through the React `ref` prop, using the port's ref and imperative-handle semantics. Include animation playback for animations defined for the selected mob, stopping/resetting supported animations, and cosmetic actions such as setting/extinguishing a fire appearance. Use capability checks and diagnostics for unsupported actions instead of pretending every mob supports every animation or effect.
- Keep cosmetic effects from dealing damage, spreading fire, producing drops, wandering away or otherwise altering gameplay. Probe the target native APIs and add controlled presentation adapters where needed; a native gameplay action is not automatically a cosmetic implementation.
- Validate mob changes, animation identifiers/options, disposed handles and replacement races. Release the old handle/actor on replacement and set the ref to null on unmount. Owned presentation mobs must obey audience isolation, access and cleanup rules; establish feasibility for private roots in the native fixture before claiming support.

### ThemeProvider

- A nonvisual React context provider supplies a reactive `theme` of `"light"` or `"dark"`, with nested providers overriding their subtree. Use dark as the unprovided default and document it.
- Components derive default style tokens from context, especially `Text` foreground colors. Explicit component colors/styles take precedence. Theme changes update descendants without remounting; isolation between roots and nested providers is tested. Keep custom Minecraft-style theme tokens configurable.
- Custom TextPrimitive glyph pages use baked dark gray #4D4D4D and do not inherit arbitrary text colors. Particle glyphs use white Canvas texture copies and accept arbitrary tint, defaulting to #4D4D4D when omitted; do not claim that `Color` recolors a PUA font glyph.

### Callout and Divider

- `Callout` is a Minecraft-styled implementation of the five GFM alert/admonition kinds: Note, Tip, Important, Warning and Caution. Expose a typed kind prop, distinct icon/accent styling and the corresponding standard heading; allow a custom heading through `Text` composition and body content as normal spatial children. This component does not require a Markdown parser.
- Use the theme and shared style tokens for a pixel-art frame, spacing and readable foreground/background pairs. Preserve the external `Text` child rule; render any generated heading through internal `Text` composition.
- `Divider` is a noninteractive separator with horizontal/vertical orientation, configurable thickness and length, layout participation and theme-aware default color. It owns no input proxy and has no text children.

### Bar

- Expose a typed reactive appearance/kind prop selecting Minecraft HUD styles, including health, hunger, experience, armor, air and boss health. Keep the style registry extensible for further vanilla bar kinds.
- Accept a reactive current value and maximum. Health/hunger/armor/air use the matching segmented icons (including partial segments where vanilla supports them); experience and boss health use their matching continuous tracks. Derive style assets and dimensions from target-client references, not a single generic filled rectangle.
- Define finite-number validation, zero-maximum behavior and clamping outside the range. Appearance and value changes preserve component identity and recompute layout where intrinsic dimensions differ. Optional labels remain explicit `Text` children; bars do not create gameplay health, food or experience state.

### Terminal — later integration

- Reserve the `Terminal` component in this specification and track its implementation separately. It embeds the canonical plan's reusable Display frames, dimensions, region/measurement/input adapters and update/disposal lifecycle, using `MineCraft-9rdk.6/.7` as display prerequisites.
- Reuse that display contract and reconcile ownership, sizing and viewport clipping rather than implementing a second renderer. Bare custom presentations remain independent of canonical persistence and VM startup. Optional Ink attachment uses the shared React port; embedding a display does not require Ink. `MineCraft-2k9d` is superseded history, not an implementation prerequisite; the old blocker is replaced by canonical Display/shared React prerequisites in `MineCraft-w82n.5`.
- Do not ship a no-op public component or make this first component delivery depend on Terminal. Until implemented, documentation and export checks distinguish the reserved component from available APIs; its deferred issue remains open.

## Glyph components and submodules

- Publish `bedform/Spatial/Glyph` plus category subpaths, exposing a named React component for every assigned character in the two legacy-computing blocks and every supported non-ASCII symbol in the finer Mojangles font. Nerd Fonts families belong in the same namespace later. Glyphs internally compose the text renderer, so they can be used as layout elements without weakening the rule that a `Text` contains only text and nested `Text`.
- Organize exports by semantic category and subcategory. Use `Glyph/LegacyComputing` for Symbols for Legacy Computing and its supplement, with groups such as Block, Sextant, Octant, Diagonal, BoxDrawing and Symbol; use `Glyph/Mojangles` with Arrow, BoxDrawing, Block, Geometric, Math and other meaningful symbol groups. Reserve `Glyph/NerdFonts/<Family>` for the later font families. Provide category indexes and document discoverable import examples without eagerly registering runtime resources.
- Generate the catalog and component exports from a pinned repertoire manifest. Each entry records its source code point and Unicode name, public PascalCase component name, category, native glyph or stand-in, measured metrics, supported asset/color variants and source provenance. Export a discoverable catalog as well as the components. Preserve conventional acronym capitalization, resolve name collisions deterministically, and give each character one canonical component with documented category re-exports.
- Cover all assigned characters of U+1FB00–U+1FBFF and U+1CC00–U+1CEBF using BedformCanvas's stand-ins; do not expose reserved/unassigned cells as characters. Supplementary code points must be processed as code points, never split UTF-16 units. Keep source Unicode identity distinct from PUA texture addresses.
- For Mojangles symbols, derive the exact supported set from the installed client's font data and generated measurement tables, rather than exporting complete Unicode ranges that include missing glyphs. Include arrows, box drawing and other supported non-ASCII symbol families; basic ASCII and ordinary alphabet inventories are not this symbol catalog. Record the client/version and the classification rules so coverage is reproducible.
- Render native Mojangles glyphs at their fine-pixel scale. Legacy stand-ins need the documented half-scale/overlay treatment when aligned to that fine grid: a PUA texel otherwise draws as a large pixel. Account for baked colors, seams, advances, baseline, line-start rounding, depth and the byte limit. Reuse the generators and mapping already tracked by `.9`, `.10` and `.12` instead of adding conflicting glyph pages. Include the demo's wide/seamless and octant pages in `.9`'s asset inventory where present, not just the earlier E2–EB set.
- Test full repertoire coverage, no reserved characters or missing-glyph placeholders, stable naming, category reachability, stand-in mapping, generated-file freshness, per-glyph layout and consumer imports. Client acceptance checks representative arrows, box junctions, blocks, sextants/octants, mixed native/stand-in alignment and available color variants.
- Nerd Fonts ingestion is deferred. Track provenance/licenses, chosen families, page allocation, reproducible rasterization, metrics and generated components as a separate later issue. Do not invent font assets, placeholder components or a dependency that blocks the initial Glyph delivery.

## Text and fonts

Read [Rendering text with `TextPrimitive`](../Documentation/TextPrimitive.md) before implementing this section. Section numbers (§) below refer to it. Its findings come from the 1.26.6x client, so recheck any that matter after a client update. Its "Unicode font" is called Mojangles here, and its "large font" is called Legacy.

**Primitives and lines**

- Render each visual line of a `Text` as its own `TextPrimitive`. The client chooses fonts per line (§7.1), so the font choice then also applies per primitive, and the layout, not the client, sets the line pitch.
- Configure every primitive as §5 recommends: transparent background, `depthTest = true`, `textBackfaceVisible = false` and `backfaceVisible = false`. Send yaw as +F, normalised to (−180°, 180°] (§4).
- Position each line from its measured width (§8):
  - The client centres a line on the sum of its advances and rounds the line's start to a whole large-font pixel of the primitive's scale.
  - Implement left, centre and right alignment by moving the anchor.
  - Pad odd widths with `EvenPad`'s pad characters, which stay inside their row.
- Enforce the 128-byte UTF-8 line limit after font substitutions, switch characters and colour codes are added, and wrap to stay within it (§3). Wrap on Unicode boundaries, and reject U+0000.
- Call `setText` only when a line's text changes. Resend static text 5 ticks after placement, as the demo does, until a client test shows the resend is unnecessary (§2).
- Allow `§` colour codes and `§r`, using Bedrock's colour values (§9.2). Reject `§k`, `§l` and `§o` unless a measurement override supplies their widths (§7.4).
- The client has no bidirectional layout and draws right-to-left text in stored order. Document this.
- Convert layout pixels to primitive scale through one blocks-per-large-pixel constant, initially 0.025 (§6). That value is uncalibrated: client acceptance calibrates it, and layouts keep margins until then.

**Fonts**

`Text` takes a `Font` prop. Its value is a member of a frozen `TextFont` record, and the default is `TextFont.Mojangles`.

| `Font` | Drawn with | Line pitch (large pixels) | Colour |
| --- | --- | --- | --- |
| `Mojangles` (default) | The client's fine font. A fine pixel is half a large pixel. | 10 + gap | `Color` and `§` codes |
| `Legacy` | The client's large font (`default8`), which covers 438 characters | 12 + gap; a line that falls back uses Mojangles' pitch | `Color` and `§` codes |
| `Ten` | Minecraft Ten stand-ins on BedformCanvas's glyph page EB | Derived from the glyph cell and verified in the client | Baked into the page |

- **Mojangles.** The client draws a line in the large font when every character in it is a large-font character.
  - To prevent that, start such lines with an invisible *switch character*. A line that already holds a character outside the large font needs none.
  - The demo's hidden U+2800 suits only an opaque background drawn in the same colour (§7.1), so it cannot hide on transparent text.
  - Instead, add a switch cell to an unused cell of page E2 and draw it only in alpha-1 texels, which take width but are invisible on any background (§9.1). Account for its advance when positioning the line.
  - Implemented by `MineCraft-ty2k.9` at U+EB67 (`Catalogue.Switch`, advance 2 texels): the demo's gapless packing leaves no unused E2 cell, so the switch takes the first slot after the Braille dots, which no demo mapping uses.
  - Verify in the client that the switch cell selects the fine font and stays invisible. If it does not, use U+2069 instead: it also switches the line and is invisible, but its width (about one letter) is unmeasured.
- **Legacy.** Use the large font wherever every character of a line supports it. The `Fallback` prop decides what happens to characters the large font lacks:
  - `"Mojangles"` (default): keep the characters and draw the line in the fine font, as the client would. `FallbackScope` chooses whether only the affected line switches (`"Line"`, the default) or every line of the `Text` switches (`"Text"`), for a uniform appearance. Each line is a separate primitive, so the client never switches a line the renderer did not choose.
  - `"Omit"`: remove the unsupported characters.
  - `{ Replace: string }`: substitute the given text for each unsupported character. The replacement must itself consist of large-font characters.
  - A function: it receives the unsupported character, its index and its line, and returns replacement text, for example a transliteration. The renderer checks the result again, omits anything that is still unsupported, and reports the omission.
  - `"Error"`: throw during render, so an error boundary can handle it.

  Report omissions and replacements through the runtime's diagnostics, naming the widget and component. Measure each line in the font it actually receives.
- **Ten.** Map printable ASCII to U+EB00 plus its code.
  - Map lowercase letters to capitals, because Minecraft Ten draws lowercase letters with its capitals' outlines. The demo's `ToMinecraftTen` leaves lowercase letters unmapped.
  - Take widths from the generated advance table. One glyph-page texel is one large-font pixel (§9.1), and the capitals are 10 pixels tall.
  - Stand-ins are not large-font characters, so Ten lines are fine-font lines and need no switch character. Derive the pitch from the glyph cell: capitals occupy rows 4 to 13, and `|` descends about 3.6 pixels (§12). Verify the result in the client.
  - Characters without a stand-in use the same `Fallback` options. Here, however, `"Mojangles"` applies per character: the character is drawn inline in the fine font, because the line is already a fine-font line. `FallbackScope` does not apply.
  - Each stand-in takes 3 bytes, so a Ten line holds at most 42 characters.
  - Ten glyphs draw in the page's own colours and ignore `Color` and `§` codes (§9.1). Canvas page EB uses dark gray #4D4D4D ink without the demo's button-green baked shadow; its matching white particle texture supports arbitrary tint.
  - Strip colour codes from Ten text, and report a diagnostic when `Color` is set.
  - Arbitrary custom-glyph colors use the white particle textures with explicit tint; omitted particle tint defaults to #4D4D4D. TextPrimitive font ink remains dark gray.

**Measurement data**

- Port the demo's `Source/Layout.js`, `Source/GlyphWidths.js` and `Source/MinecraftTenWidths.js` to typed Bedform modules. They provide:
  - the advance of every Basic Multilingual Plane character in both fonts;
  - the 438-character large-font set;
  - Ten advances;
  - `UsesLargeFont`, `LineWidth`, byte counting, wrapping and `EvenPad`.
- Emit these modules from a ported generator, with the repository's generated-module header.
- Generation reads the installed client's `font.brarchive`, executable and `minecraft-ten.ttf` (`Tool/ClientFont.mjs`). Commit the outputs, record the client version they came from, and regenerate them after a client update.
- The measurement override, used for resource-pack fonts and unresolved translations, takes precedence over the bundled tables for every font.
- The widths were measured from the font sheets. The in-game measurement (`Tool/MeasureGlyphs.mjs`) has never been run (§7.2), so client acceptance runs it.

**Glyph pages in BedformCanvas**

- Copy every glyph page from `Addon/DduiImageDemo/resource_packs/ddui_image_demo/font/` to `Addon/BedformCanvas/resource_packs/bedform_canvas/font/`, keeping the same page numbers and glyph shapes/metrics while normalizing font ink to dark gray #4D4D4D. Matching white #FFFFFF texture pages are generated for arbitrary particle tint. The source inventory is:

  | Pages | Contents |
  | --- | --- |
  | E2 | Test glyphs |
  | E3–E6 | Symbols for Legacy Computing and its supplement |
  | E7–EA | Historical cyan copies of E3–E6; current demo may remove redundant color variants |
  | EB | Minecraft Ten |
  | EC–EF | Wide/seamless legacy-computing copies and sextant completers |
  | F0–F3 | Historical cyan copies of the wide legacy glyphs; current demo may remove redundant color variants |
  | F4–F7 | Wide octant patterns in the demo's four colors |
  | F8 and later generated region pages | Current region-family assets; inventory current generators and mappings before allocation |

  This table records source families rather than a frozen page count or a requirement to recreate removed color copies. Inventory current demo outputs and generators before porting, including wide/seamless, octant and all six high-resolution region families. Preserve source identities and metrics while normalizing font ink to dark gray; generate white particle PNG copies as ordinary resource-pack textures with particle definitions/descriptors, separately from `font/`. Particles cannot automatically sample font resources. Add the Mojangles switch cell in an unused cell of E2. Preserve mappings and required overlay masks; demo color variants are source inventory, not required Canvas ink colors. Coordinate `ty2k.9/.10` and `9rdk.5/.6` around one authoritative inventory and generator set.
- Copy `LICENSE-Unifont.txt` with the pages, and keep the Unifont notice for pages E4–E6 and E8–EA. Record beside BedformCanvas's `License.Mojang.txt` that page EB was rasterised from Mojang's `minecraft-ten.ttf`.
- Port the page generators to TypeScript in BedformCanvas's `Tool/`, with module headers, writing into its own pack: `CustomGlyph.mjs`, `LegacyGlyphs.mjs`, `LegacySupplementGlyphs.mjs`, `Unifont.mjs`, `MinecraftTen.mjs` and `ClientFont.mjs`.
  - Verify that the ported generators preserve the demo's glyph shapes, alpha and metrics with the specified dark gray font/white particle color normalization and added switch cell.
  - Write the contact sheets to `dist/`.
  - Leave the demo unchanged.
- Export the legacy-computing mapping (`ToLegacyGlyphs`) as an opt-in helper. `Text` does not substitute those stand-ins automatically, for two reasons:
  - their font ink is baked #4D4D4D, at large-pixel size;
  - they are designed for the two-layer overlay (§10), reused by the [canonical Display renderer](Bedform_Terminal_Canonical_Plan.md).

## Pointer, input and access

**Targeting and feedback**

- Intersect each player’s crosshair ray with widget planes, then hit-test their committed layout. Choose the nearest visible surface and respect world occlusion.
- A widget can independently enable or hide its pointer line. Hiding the line does not disable interaction or remove the player from access counting.
- Draw the line from an estimated hand position to the surface hit. Expose hand-origin and view-provider overrides.
- An optional maximum distance hides the line and rejects interaction beyond that distance. Empty-hand activation additionally respects native entity reach.
- Export frozen default colors: white for noninteractive surface hits, cyan for eligible interactive hits and orange for observed Use presses. A reactive color callback receives the current target, input state and denial reason. Hide the line when no widget surface is hit.

**Activation and gestures**

- Use small invisible, noncolliding interaction proxies at eligible hit points for ordinary native Use. Revalidate analytic targeting and access when processing native interactions; never trust the proxy alone.
- Default controls require no held item. A reactive `RequiredItem` property can restrict a widget or component; ancestor requirements also apply.
- Provide explicit registration of items that emit start/release events. Use their actual item-use lifecycle for held gestures, avoiding proxy interception of the item’s native use cycle.
- Expose activation, use-start, use-release and cancellation callbacks. Ordinary proxy interactions produce activation and brief pressed feedback; they do not fabricate a physical release.
- Buttons and toggles work through ordinary activation. Sliders support click-to-set without release-capable input and dragging when such input is available.
- Item changes, changed requirements, lost access, disconnects, dimension changes and unmounts cancel active gestures. An ambiguous stop/completion event is cancellation rather than an invented release. [Bedrock release events](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemreleaseuseafterevent?view=minecraft-bedrock-stable)

**Simultaneous players**

- Accept unlimited simultaneous players by default, including on the same control. Maintain gesture state per player; shared value updates follow the serialized event order.
- Provide a reusable access controller with `SetMaxPlayers`, `LockTo(player)` and `Unlock`. Apply it to widgets, controls or `InputScope` subtrees.
- Count distinct eligible players whose rays hit the controlled component or its descendants, even when their pointer line is hidden.
- Keep the first admitted players while they continue aiming. Fill vacancies in arrival order, breaking same-tick ties by player ID. Lock changes take effect on the next input update and cancel newly unauthorized gestures.
- Apply all ancestor policies. Denied surfaces block interaction with controls behind them; they do not allow click-through.

## Verification and delivery

- Create and claim Beads implementation tracking before editing. Preserve unrelated working-tree changes.
- Run differential React tests against the pinned upstream releases, covering every hook, Suspense, errors, keyed reconciliation, cleanup, action failures, transitions and abandoned renders.
- Test the font rules:
  - Mojangles forcing on lines made only of large-font characters;
  - every Legacy `Fallback` mode and both `FallbackScope`s;
  - re-checking of replacement functions' results;
  - Ten mapping, including lowercase letters and per-character fallback;
  - byte limits after substitution;
  - colour-code handling;
  - alignment under line-start rounding.
- Test the ported glyph shapes/metrics and dark gray font/white particle texture generation, default tint and arbitrary RGB/RGBA overrides.
- Test the `<Text>` rule: bare strings and numbers outside `Text` fail to typecheck and throw at render, nested `Text` runs merge into lines, and conflicting font props on a nested `Text` are rejected.
- Test layout, text limits, arbitrary `View` orientation, occlusion, hit ordering, dynamic colors/item requirements, private/shared audiences and simultaneous slider input.
- Test `Slot` child restrictions, inventory presentation and count updates; all `ScrollView` visibility modes, hover-track targeting, square arrows, clamping and viewport clipping; both `Button` appearances; `Mob` ref capabilities and cleanup; nested/reactive themes; every callout kind, divider orientation and bar kind; and Glyph repertoire coverage, category imports and generated freshness. Qualify the deferred Terminal and Nerd Fonts integrations when those issues are implemented.
- Test admission limits, stable ordering, nested policies, lock/unlock/relock, item changes during gestures and all cleanup paths.
- Verify restricted-host imports, scheduler cancellation, declaration compatibility, both JSX runtimes, generated-file freshness and an independently installed consumer bundle.
- Run Bedform’s full verification and BedformCanvas’s checks.
- Add an isolated native fixture using its fixed `dist/bds-runtime/bedrock_server.exe`. Prove proxy activation, item start/release routing, audience isolation (including item holders and presentation mobs), restart cleanup and absence of unintended item consumption, drops, damage, fire spread or movement blocking. Exercise reactive actor replacement, animation/cosmetic capabilities and viewport targeting; separately record native limitations instead of silently falling back to public actors.
- Keep real-client acceptance separate:
  - Text: the switch cell's invisibility and width, Ten pitch and baseline, mixed-font line placement, calibration of the blocks-per-pixel constant, and a run of `Tool/MeasureGlyphs.mjs` against the bundled widths.
  - Everything else: text alignment, particle seams/flicker, pointer appearance, estimated hand placement and controller/touch behavior require client observation.
  - Added components: compare slots and flat/3D item poses/counts with inventory references; compare both button appearances and states with pause/disconnection references; check scroll clipping/hover/arrows, mob plane alignment/animations/fire cosmetics, light/dark text and callouts, HUD bar kinds, and representative native/custom Glyph categories. Use two clients to check entity-backed audience isolation; server-side assertions alone do not establish it.

Follow repository documentation and generator conventions, including symbol-level `@since 1.0.0` for Bedform. Target the existing release-compatible beta API needed by `TextPrimitive`; do not upgrade to a preview engine. No production-world deployment, commit, push or remote Dolt synchronization is included.

## Scope and delivery status

The organization revision in `MineCraft-w82n.2` updates documents only. The audit is recorded in `MineCraft-w82n.1`; `.5` reconciles nonclosed issues and their embedded specifications, `.6` creates future Ink/Window/VM implementation tracking and `.7` wires exact deliverable-level dependencies. The document-only .2 revision left issue edges unchanged; w82n.5 now reconciles existing issue ownership and replaces .27's old blocker with canonical Display prerequisites. New future-epic edges remain .6/.7.

Deliver Canvas/value/display foundations first, then a bounded shared React API/root/compatibility milestone reusable by Ink and Window. Extract that milestone from `.1-.4/.16` instead of making either new layer wait for `.16`'s full widget catalogue. Share canonical frame geometry with `.33`, rather than requiring the React FramedPanel component for display delivery. `.30`'s imperative glyph operations reuse the underlying particle helpers independently of React roots. Ink follows shared React and Display; Window follows shared React/frame/surface foundations independently of Ink/VM; the VM shell follows Ink and VM services. Keep implementation, offline packaging, fixed-path native and real-client gates distinct for each feature.

The November 16, 2026 extension adds requirements and implementation tracking; it does not implement the components. Beads remains the source of truth for status. The first component delivery includes the Minecraft components and existing legacy/Mojangles Glyph families. Terminal integration and Nerd Fonts ingestion are explicitly later work and do not block that delivery's export/native/client qualification. The full epic remains open while any requested implementation or acceptance work remains open, including the later integrations.

### Beads extension mapping

All identifiers below use the `MineCraft-ty2k` prefix. Existing foundational issues retain their original responsibilities, extended for shared assets, viewport clipping, theme-aware text, pointer routing and qualification.

| Issue | Deliverable | Delivery |
| --- | --- | --- |
| `.19` | Expand this plan and implementation tracking | Planning only |
| `.20` | Slot and ItemStack, inventory pose and quantity | First component delivery |
| `.21` | ScrollView, dynamic visibility, clipping and square arrows | First component delivery |
| `.22` | Button pause/default and disconnect appearances | First component delivery |
| `.23` | Mob surface placement and imperative cosmetic refs | First component delivery |
| `.24` | ThemeProvider and reactive light/dark defaults | First component delivery |
| `.25` | GFM Callout and Divider | First component delivery |
| `.26` | Vanilla HUD Bar kinds | First component delivery |
| `.27` | Canonical Display integration; uses `MineCraft-9rdk.6/.7` and shared React/viewport contracts after w82n.5 reconciliation | Later |
| `.28` | Categorized legacy-computing and Mojangles Glyph components | First component delivery |
| `.29` | Nerd Fonts ingestion and Glyph family components | Later |

Export qualification (`.16`), the native fixture (`.17`) and real-client acceptance (`.18`) include the first-delivery additions. The deferred integrations have their own implementation/acceptance criteria and do not block those initial gates. Only the planning issue can close on the strength of this scope update; all implementation and acceptance issues require their own evidence.

## Canvas custom glyph asset and tint contract (November 17, 2026)

- `Addon/BedformCanvas` (`bedform-canvas`) owns terminal/spatial custom glyph assets and their generators; unrelated DDUI/control assets remain in BedformCommon.
- Generate custom font pages with dark gray glyph ink `#4D4D4D`. TextPrimitive presentation uses the same default dark gray text color, including ordinary text and `§r` resets. PUA glyph ink is baked into the font PNG and is not recolored by TextPrimitive color or `§` codes.
- Generate matching particle-accessible texture copies of every custom glyph page with white glyph ink `#FFFFFF`, from the same authoritative glyph source. Preserve glyph shapes, source/stand-in identities, cell/UV layout, metrics and ink alpha; retain invisible width/switch helpers as metadata, not visible particle ink. Remove demo-specific baked color, background and shadow treatments from the particle ink mask so they cannot prevent arbitrary tinting. Keep any required text-overlay masking treatment separate from that mask.
- All glyph-particle spawn/render helpers, including one-shot and managed entry points, accept an explicit arbitrary RGB/RGBA tint and apply it to the white texture. If tint is omitted, apply dark gray `#4D4D4D` with alpha 1; explicit tint takes precedence. Do not quantize particle tint to the `§` palette or require precolored texture variants. Preserve texture alpha when tinting.
- Inventory every current demo page and later custom font family, including wide/seamless, octant and region glyphs. Preserve shapes and metrics while normalizing colors; pixel-for-pixel reproduction of the demo's cyan, multicolor or white font ink is not required. Keep provenance/licenses, deterministic generation, descriptors, packaging and freshness checks aligned for both representations. Future Nerd Fonts follow the same contract when implemented.
- Verify dark gray font ink and default TextPrimitive color, white particle ink and matching alpha/UVs, omitted-tint parity with explicit dark gray, explicit non-palette RGB and RGBA overrides, transparent cells and generated/packed asset availability. Native tests exercise actual tint forwarding; real-client checks establish appearance, alpha and arbitrary tint fidelity. This is a specification update, not evidence of implementation or visual acceptance.

## Existing deliverable ownership after MineCraft-w82n.5

The existing nonclosed issues now use these sole implementation owners. These planning edits do not complete runtime work. The open Ink/Window/VM epics were created by w82n.6 and their exact child dependencies are wired by w82n.7.

| Deliverable | Existing owner | Consumers |
| --- | --- | --- |
| Custom glyph inventory, generators, dark gray font pages and white ordinary particle textures | `MineCraft-ty2k.9` | `9rdk.6`, `ty2k.28/.30`, Intent and future Ink |
| Native font metrics/presence | `MineCraft-ty2k.10` | Pure display and React text |
| Ordinary-font particle coverage for dark terminal parity | `MineCraft-9rdk.5` | Dark terminal backend; reuses custom catalogue |
| Non-glyph spatial artwork/proxies | `MineCraft-ty2k.6` | Imperative particle surfaces and widgets |
| Imperative particle surface/viewport primitives | `MineCraft-ty2k.8` | React host, glyph helpers, canonical frame and future Window |
| React-independent rounded frame assets/geometry, brightness, rear/extrusion | `MineCraft-9rdk.9` | Canonical displays, `ty2k.33`, future Window |
| Shared Canvas.Images compiler/descriptors | `MineCraft-zcmm.6` | Intent API/renderer and React build integration |
| General feature-based Canvas artifact bundling | `MineCraft-zcmm.7` | Display, spatial, Intent and future layers |
| Intent API/exports/docs and protocol client | `MineCraft-zcmm.2` | Intent feature consumers |
| Shared React/hooks/JSX API and bounded publication | `MineCraft-ty2k.2` | Widgets and future Ink/Window |
| Spatial React TSX/build/descriptor consumption | `MineCraft-ty2k.7` | Optional spatial TSX consumers |
| DDUI elements/hooks/JSX/strict-setting removal and migration | `MineCraft-9rdk.12` | Existing consumers and full widget qualification |
| Imperative native bindings / MessageBox / Checklist | `MineCraft-l89.3/.4/.6` | Forms, Prototype and integration |

`MineCraft-9rdk.13`, `MineCraft-l89.1/.2/.5` and the nine open `MineCraft-2k9d` children are closed as superseded, never as runtime-completed. Their preserved requirements map to the owners above and the saved Ink/Window/VM specifications. Closed historical parents and prior completed work remain unchanged.

## Future runtime epics recorded by MineCraft-w82n.6

Created November 18, 2026 by `MineCraft-w82n.6`: three separate top-level future runtime epics, 42 implementation/packaging/native/client children, all open. These are separate from the planning-only w82n parent. Hierarchy and the listed child-level blocking prerequisites are recorded. `MineCraft-w82n.7` wires these edges and publishes coordinated ordering; `.8` owns final coverage/parity validation. Creation is not implementation, native feasibility or real-client acceptance.

| Runtime epic | Responsibility | Children |
| --- | --- | --- |
| `MineCraft-3w2z` | Own optional upstream Ink adaptation, qualified portable layout, Display host, renderer-facing virtual IO/input/focus, supported components/hooks and Input/Scrollback/view-only Shell. Reuse shared React and existing Canvas/display assets. VM owns actual accounts/process/parser/services and real Shell binding. Standalone Ink does not wait for VM or Window. | 12 open |
| `MineCraft-glcb` | Own independent roots/handles, shared-frame binding, external stores/useSyncExternalStore, typed directional events, audience/focus/error isolation and disposal/explicit consumer reconstruction. Reuse shared React/Canvas geometry; no Ink/VM or automatic persistence requirement. | 10 open |
| `MineCraft-q4r0` | Own VM service contracts, per-machine durable data/accounts/permissions, qualified credential handling, scoped world IO, processes/streams/parser/coreutils, authenticated input/session binding, actual hybrid keyboard/text adapters, Ink shell integration and canonical VM constructor/restoration. Shared display/React/Ink components and Canvas identity/frames remain with their existing owners. | 20 open |

The complete actual child-ID tables and wired prerequisite mappings are in [Ink/Window tracking](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM tracking](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). Existing foundations retain the implementation owners assigned by w82n.5; the `.6` creation step delivered no runtime code or blocking edges; `.7` now records child-level blockers and ordering.

## Wired runtime implementation order (MineCraft-w82n.7)

The 42 Ink/Window/VM child deliverables now have the exact blocking prerequisites listed in the [Ink/Window tables](Bedform_Terminal_Ink_Window_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6) and [VM table](Bedform_VM_Plan.md#open-runtime-implementation-tracking-minecraft-w82n6). The [coordinated branch order and topological waves](Bedform_Terminal_Canonical_Plan.md#coordinated-implementation-order-minecraft-w82n7) show parallel foundations and runtime integration. Parent epics use nonblocking see-also links, not whole-epic gates. No runtime work or acceptance is completed by dependency wiring.
