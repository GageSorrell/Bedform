# Canvas asset ownership and provenance

Canvas owns shared terminal/spatial display artwork, custom glyph sources and generators,
and canonical display/VM entity resources. BedformCommon retains imperative DDUI and
Diagetic controls, their player/camera additions and their related resources. The
existing demos remain reference sources until their separately tracked migration.

## Widget artwork and proxies (`ty2k.6`)

`Tool/WidgetArt.mts` owns 90 non-glyph widget sprites, their shared-serializer particle
pairs, three bodyless presentation actor definitions and attachment skeletons. Captured
source pixels, slicing metadata, PNG hashes and screen/template references are pinned to
Minecraft for Windows 1.26.6501.0 in `Widget/Input.json`. The stripped armor-stand
skeleton and native textures are Mojang-derived; original callout/arrow masks and flat
theme fills are MIT. The resource pack includes their `NOTICE-Mojang.txt`.

See [widget inventory and limits](../Documentation/Widgets.md) for every state family,
the shared pause/disconnect reference, theme/tint rules, native safety qualification and
the world-visible actor restriction. Shared rounded frame geometry remains `9rdk.9`;
glyphs remain with the single generator below. No second frame or glyph output is emitted.

Canvas code, manifests and original drawings are MIT-licensed (`License.txt`). Both
packs include `License.txt` and this inventory as `AssetProvenance.md`. Upstream
material keeps its own notices beside the files derived from it; the MIT license never
replaces that attribution.

## Custom glyph catalogue (`MineCraft-ty2k.9`)

`Tool/Glyph/` is the single generator for terminal/spatial custom glyphs, ported from
the demo's `CustomGlyph`, `LegacyGlyphs`, `LegacySupplementGlyphs`, `Unifont`,
`MinecraftTen` and `ClientFont` tools. The demo's sources and assets are unchanged.

| Output | Contents |
| --- | --- |
| `resource_packs/bedform_canvas/font/glyph_E2.png` … `glyph_EB.png` | TextPrimitive font pages, ink `#4D4D4D` |
| `resource_packs/bedform_canvas/textures/bedform_canvas/glyph/glyph_e2.png` … `glyph_eb.png` | White `#FFFFFF` particle textures |
| `resource_packs/bedform_canvas/particles/glyph_e2.json` … (`_oriented` variants) | Particle definitions sampling each white page |
| `Public/Glyph.generated.ts`, read through `Public/Glyph.ts` | Typed catalogue, lookups and tint contract |
| `font/` and `textures/…/glyph/` `LICENSE-Unifont.txt`, `NOTICE-Mojang.txt` | Upstream notices |

Allocation is gapless from U+E200 and matches the demo's current (1.1.79) layout exactly:
legacy computing stand-ins, the four sextant extras and 26 octant completers (U+E200–U+E590),
their wide seamless copies (U+E591–U+E921), Minecraft Ten (U+E922–U+E966, printable ASCII
without lowercase), wide octants (U+E967–U+EA66) and Braille dots (U+EA67–U+EB66). The
invisible Mojangles switch cell is U+EB67, the first slot no demo mapping uses: one alpha-1
texel with a 2-texel advance. The plan's "unused cell of E2" predates gapless packing, which
left no unused E2 cell. Reserved, unassigned and deliberately dropped characters have no slot.
The region-octant mapping reuses supplement octants plus the completers.

One drawing pass produces both representations. Visible ink is opaque `#4D4D4D` in font
pages and opaque `#FFFFFF` in particle textures, with the same shapes, cells and UVs.
Invisible alpha-1 width helpers (seam extents, the Ten space, the switch) exist only in the
font pages and as catalogue `Hidden` metadata; particle textures leave them transparent.
Minecraft Ten loses the demo's baked button-green shadow; an alpha-1 helper at the
shadow's rightmost column preserves every measured advance. Demo color variants are not
reproduced. Particle tint defaults to `#4D4D4D` at alpha 1; any explicit RGB/RGBA wins,
unquantized, and multiplies the white texture.

Ordinary generation (`npm run glyph`) reads only the checked-in inputs in `Glyph/Input/`
and never the client or network. `npm run glyph:check` (part of `check`) verifies that every
tracked output is current, comparing decoded pixels for PNGs. Contact sheets go to
`dist/glyph-preview`. `npm run glyph:capture` refreshes the inputs from the installed
client, the demo's pinned Unicode table and GNU Unifont; rerun it and regenerate after a
client or font update.

| Input | Source |
| --- | --- |
| `Glyph/Input/unicode-names.json` | Unicode 18.0.0 names of both legacy computing blocks |
| `Glyph/Input/vanilla-shade.json` | Vanilla Unicode font U+2592 medium shade, Minecraft for Windows 1.26.6501.0 |
| `Glyph/Input/minecraft-ten.json` | Mojang's `minecraft-ten.ttf`, rasterized one texel per font pixel, same client |
| `Glyph/Input/unifont-supplement.hex`, `unifont.json`, `OFL-1.1.txt` | GNU Unifont 18.0.01 plane 1, U+1CC00–U+1CEBF, and its SIL OFL 1.1 |

Supplement stand-ins and their wide copies derive from GNU Unifont and are distributed under
the SIL Open Font License 1.1 (`LICENSE-Unifont.txt`). Minecraft Ten stand-ins and the
shade-derived legacy glyphs derive from Mojang's fonts (`NOTICE-Mojang.txt`); they are not
covered by the MIT license. All other glyphs are original drawings.

Tests prove demo parity (identities, alpha, Ten extents and advances, region mapping),
dark gray font ink, white particle ink with matching alpha/UVs and no helpers, catalogue
lookups, tint defaults and overrides, particle definitions, notices, packing and inert
imports. Native tint forwarding and real-client appearance, including whether the switch
cell selects the fine font invisibly, remain separate acceptance work. `ty2k.10` owns native
font metrics/presence tables and `9rdk.5` ordinary-font particle expansion; neither adds a
second glyph generator. Nerd Fonts remain `ty2k.29`.

## Intent artwork

`Intent/Input.json` records source identities, cropped RGBA pixels and client version
1.26.6501.0 for eight fine Mojangles arrows (U+2190–U+2199, excluding the two
bidirectional arrows), exclamation/question marks, and vanilla HUD `heart.png` and
`hunger_full.png`. `Tool/IntentArt.mts --capture` refreshes this input explicitly.
Ordinary generation is offline and reads it together with the **existing** Canvas
`Glyph/Input/minecraft-ten.json`; SOS reuses those Ten outlines and creates no PUA
allocation. Textures retain transparent cells and original HUD color/alpha. Fine
arrows preserve the captured shape and add exactly one lower-right shadow pixel.

The affirmative check, negative cross, knowledge bulb, thinking dots and six-frame
sleep loop are original pixel drawings in the generator under MIT. Thinking highlights
one dot left-to-right every six ticks; sleep advances every four ticks. The renderer's
pure `LayoutOf` source composes the gray panel, bevel, lower shadow and downward
pointer through the shared white rectangle particle, with separate depth layers.
The built-in image textures have their authored colors and an explicit white tint;
the shared custom-glyph particles retain their separate arbitrary-tint contract.

Outputs include 19 PNGs, two particle variants per PNG, typed image descriptors and
`textures/bedform_canvas/intent/NOTICE-Mojang.txt`. The latter travels in the resource
pack: Mojang's font/HUD source artwork is outside MIT. `dist/intent-preview.png` shows
all icon frames. `intent:art:check` and tests verify source pixels, shadows, frame UVs,
timing, resource references and packing. These checks establish no new client findings.
