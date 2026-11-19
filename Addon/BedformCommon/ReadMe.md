# Bedform Common

Private workspace `bedform-common` provides the shared behavior and resource packs for Bedform add-ons. Version 1.1.3 contains Diagetic player body-lock events, the synchronized camera-active property, the native eye-snapshot camera preset, first-person player presentation, and the built-in `bedform:diagetic_lever`, `bedform:diagetic_slider` and `bedform:diagetic_wheel` controls: behavior and client entities, geometry, animations, render controllers and localization. `Script/Main.ts` registers the three built-ins with a Diagetic runtime and handles `/scriptevent bedform:diagetic_place` requests; see [built-in controls](../../Package/Bedform/Documentation/diagetic.md#built-in-controls-and-shared-models). Both packs use manifest format 2 and require engine 1.26.60 or later. The behavior pack depends on the resource pack at the same version and on `@minecraft/server` 2.10.0.

The builder generates player and camera JSON from the pinned vanilla sources under `Assets/` using Bedform's shared presentation transformer, generates the control content with `bedform/Build/DiageticControls`, and bundles the runtime script with esbuild (only `@minecraft/server` stays external). Generated files are written into the pack directories before archiving. Both packs include Mojang's upstream license. See [asset provenance](Assets/ReadMe.md). Other packs overriding `minecraft:player` must merge these shared additions into the winning definition; native pack stacking does not merge player JSON. Idle controls in an idle player's gaze receive a light gold tint within interaction range. The synchronized highlight is visible to all viewers and clears when the player looks away or a control is held. Client rendering still requires physical acceptance checks.

From the repository root:

```sh
npm run build --workspace bedform-common
npm run check --workspace bedform-common
```

The independent builder writes `dist/bedform-common.mcaddon` within this workspace. Its two root entries are `bedform-common-bp.mcpack` and `bedform-common-rp.mcpack`, each containing its pack's files with `manifest.json` at the root. It uses `fflate` directly and never invokes the Bedform CLI. File ordering and archive timestamps are fixed for repeatable builds. `mcaddon` is an alias for `build`; `check` runs lint, script and tool/test typechecking, archive tests, and the build.

Pack identities are authored in the manifests and must remain stable across builds:

| Identity | UUID |
| --- | --- |
| Behavior header | `f0ae8683-f8dc-4d1f-9a6e-4059f4035e10` |
| Behavior data module | `922982ea-e393-41e5-b397-aaae537a3aee` |
| Behavior script module | `82d1ef5f-59f2-480f-9f04-2e21987e9105` |
| Resource header | `c15f802e-ae6c-4b64-9037-db7fb035f1e8` |
| Resource module | `a91ce449-9145-42d5-a221-5652b080338a` |

Add future shared content beneath `behavior_packs/bedform_common` or `resource_packs/bedform_common`; the builder includes nested files. Keep pack and module versions aligned with `package.json` and update the behavior-to-resource dependency when changing versions. Tests pin the initial identity and manifest contract.

Bedform's normal build, pure build, and `prepack` prepare a fresh artifact at `Package/Bedform/Asset/bedform-common.mcaddon`. Its npm `files` list includes that archive, and `fflate` is a runtime dependency. Package preparation uses this workspace's builder directly; installed packages need neither the common workspace nor install lifecycle scripts. When packing with `--ignore-scripts`, run Bedform's build first; the packed-consumer test command does this automatically.

Every complete Bedform add-on build includes both common packs and adds the corresponding common behavior/resource dependency to each staged consumer manifest. Authored manifests stay unchanged. Existing matching dependencies are reused; incompatible versions and consumer reuse of the common UUIDs fail before output publication. The legacy standalone Physics overlay command remains unchanged. See [Common packs](../../Package/Bedform/Documentation/common-packs.md) for consumer behavior, failure diagnostics, and release/version maintenance, and [the common add-on plan](../../Plan/Bedform_CommonAddon_Plan.md) for the implementation specification.

Native CustomForm direction dropdowns also use this pack. Builds generate transparent 96 by 96 pixel PNGs (red X, green Y, blue Z, cream selected outline) for every allowed-direction subset, label mode, and hidden/dimmed exclusion style. Artwork uses a 3 by 5 bitmap font with no antialiasing; XYZ, English direction names, and unlabelled variants are available. Dropdown text uses client translations with en_US fallback; direction-name artwork is English. Tool/DirectionPreview.mts is the source of truth; generated textures are ignored and recreated before packaging.

The CustomForm transactional component (undo, redo and reset) also uses this pack. Builds generate its five icons (undo, redo, cancel, a green confirm checkmark and a trash can for reset) under `textures/bedform/transactional/` as transparent 64 by 64 pixel PNGs: a 7 by 7 glyph at Mojangles scale with a one-pixel drop shadow in the glyph colour divided by four, upscaled eight times without antialiasing, so alpha is only 0 or 255. Its text uses `bedform.transactional.*` translation keys with en_US entries in `texts/en_US.lang`. The texture paths and the keys with their English text live in `Package/Bedform/Source/Internal/TransactionalAssets.ts`, which the runtime and Tool/TransactionalIcons.mts share; the generated textures are ignored and recreated before packaging.
