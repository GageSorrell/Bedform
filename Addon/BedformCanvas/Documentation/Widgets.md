# Widget artwork and actor assets

`Tool/WidgetArt.mts` is the single generator for the non-glyph spatial widget
artwork and presentation actors delivered by `ty2k.6`. It reads checked-in
`Assets/Widget/Input.json`, never the client or network during normal generation.
Refresh references explicitly with `npm run widget:art:capture`, regenerate with
`npm run widget:art`, and validate with `npm run check` in `bedform-canvas`.

`Public/Widget.generated.ts` exports the frozen `WidgetImages`, `WidgetEntity`
and `WidgetStyle` records. Each image includes a standard Canvas image descriptor,
the source texture identity and unmodified source nine-slice metadata where present.
These are asset contracts, not a second React implementation or a component backend.
Imports create no actors, subscriptions, displays, timers, Ink services or VM.

## Reference and state inventory

The captured target is Minecraft for Windows **1.26.6501.0**. Input records contain
decoded RGBA, dimensions, PNG SHA-256 identities, texture metadata, and the relevant
pause, disconnect, button-template, HUD, common-control and inventory JSON definitions.
The attachment skeleton comes from `models/entity.brarchive/armor_stand.geo.json`;
the generator removes every cube while preserving attachment bone names and pivots.

| Family | Sprite contracts |
| --- | --- |
| Slots | Normal, hover, disabled, disabled-hover and selected overlay |
| Buttons | Light/dark normal, hover and pressed; disabled; separate light/dark border sprites |
| Tabs | Recipe tab normal, hover, selected and selected-hover; light/dark recipe button states; crafting/furnace toggles |
| Subtle tab actions | Light/dark documentation and close icons, each normal/hover/pressed |
| Scrolling and controls | Rail, gutter and thumb; square 8-pixel arrow masks in all four orientations; slider track/progress/thumb states and disabled thumb; toggle on/off and hover |
| Callouts | Five distinct original white masks and light/dark accent palettes for Note, Tip, Important, Warning and Caution |
| Dividers and panel interiors | Light/dark dividers and panel fills; crafting/furnace/loading fill tokens; dark inner fill at alpha 128 |
| HUD | Empty/full/half health, hunger and armor; air full/empty/pop; experience and boss-health empty/full tracks |

There are **90 sprites**, each with a camera-facing and oriented particle definition
using the existing Canvas particle serializer. Glyph pages, glyph particles and the
plain rectangle particle remain with their existing owners. No PUA cells are added.
The five callout masks and square arrows are original MIT drawings, not captured
Minecraft or GitHub icon assets. Colored sprites retain their original RGBA and
should normally use white tint; white masks accept arbitrary tint through the existing
surface API, whose omitted tint remains dark gray `#4D4D4D`. Baked font-page ink is
unaffected. Sprite alpha multiplies the supplied tint alpha.

The two requested button appearances share an actual native reference in this client:
`pause.pause_button_template` and `disconnect.menu_button_template` both inherit
`common_buttons.light_text_button`. The generator records that equivalence instead
of fabricating different artwork. Both retain independent appearance names for the
component owner. Dark-theme variants use the corresponding native dark button assets.
Disabled and normal states can legitimately share individual icons; disabled alpha,
selected borders and control event semantics belong to the rendering component.

Keep borders separate where the client's template does so. Preserve the captured
`nineslice_size` and `base_size`: for example recipe-tab borders are four pixels and
the scroll thumb uses `[1, 2, 1, 2]`. Sample with nearest filtering, retain corner
texels, and stretch only the indicated centers/edges. This asset delivery preserves
source pixels and metadata; it does not implement a second slicing algorithm.
Rounded/scalable external panel frames and extrusion are owned by **`9rdk.9`**.
Crafting/furnace/loading sprites here are only flat interior fills; the later panel
backend combines them with that shared frame delivery. No placeholder frame model
or duplicated frame geometry is emitted.

Mojang source textures and the stripped attachment skeleton retain their upstream
ownership; `textures/bedform_canvas/widget/NOTICE-Mojang.txt` accompanies them in the
resource pack. Original masks and flat fills are MIT. `AssetProvenance.md` ships in
both packs, and the packed-content tests compare every generated resource byte.

## Actor contract and limits

`WidgetEntity` identifies `InteractionProxy`, `ItemHolder` and `MobAnchor`. Each has
a tiny query hitbox, disabled physical collision and gravity, disabled pushing,
damage immunity, no AI, pickup behavior, attack, rider, spawn rule or nonempty loot
table, and a client geometry containing **no cubes**. They remain stationary until
explicitly moved. The item holder enables attachment rendering on the stripped
armor-stand skeleton, with equipment drop chances disabled and a private one-slot
inventory. In BDS 1.26.63.1 this custom actor does not expose the Script API
`minecraft:equippable` component. The native fixture verifies mainhand replacement
using `replaceitem` followed by a `hasitem` selector; a future component must use
that qualified command route or establish another backend. `MobAnchor` is an inert
presentation support actor; it does not clone arbitrary gameplay mobs or start AI.

These actors are **world-visible**. An invisible body is not proof that held items
or attached visuals obey private audiences. Consumers must reject unsupported private
actor presentations until `ty2k.20`/`ty2k.23` qualify their audience and representation
backends. Inventory-pose conversion, flat-item/block/custom-item visual fidelity,
scaling, clipping, cosmetic animations and actor lifecycle integration belong to those
component issues. Physical-client visibility and pixel fidelity are separate evidence.

`Test/Native/Widgets.mts` extends the existing fixed-path Canvas native fixture. It
checks native actor creation, stationary/damage behavior, nearby-item retention,
player movement through the proxies, equipment replacement and safe removal; it also
exercises native particle emission for every sprite with omitted tint, explicit dark
gray, non-palette RGB and RGBA. The runner keeps
`Addon/BedformCanvas/dist/bds-runtime/bedrock_server.exe`, an isolated world and the
existing three-process restart/unmodified-artifact checks. See `dist/native.results.json`
for the measured engine, resource hashes and `WidgetAssets` step. Real-client
appearance, inventory poses and actor privacy are not established by these server tests.
The [saved native result](WidgetsNative.results.json) records the successful three-process
run, including safe holder removal and forced death, for this asset revision.
