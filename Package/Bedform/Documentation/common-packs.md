# Common packs

Every complete `bedform build` includes the BedformCommon behavior and resource
packs exactly once. This applies to scripted, content-only, behavior-only and
resource-only projects, with the same behavior in production, development and
strict modes. Inclusion is automatic and has no configuration switch.

BedformCommon 1.1.0 contains the shared Diagetic camera preset and player
presentation definitions, the built-in `bedform:diagetic_lever`,
`bedform:diagetic_slider` and `bedform:diagetic_wheel` entities with their models,
animations, render controllers and localization, and a script runtime that
registers those three controls and handles `bedform:diagetic_place` requests. Both
manifests use format version 2, pack and module versions `[1, 1, 0]`, and minimum
engine version `[1, 26, 60]`. The behavior pack's script module depends on
`@minecraft/server` 2.10.0.

The behavior pack supplies the eye-snapshot preset and player body-lock events
and synchronized camera-active property. The resource pack preserves vanilla
player animation/rendering and selects first-person presentation for the active
local view, with a near-camera guard for packet ordering. Remote players and
inventory/map previews retain vanilla selection. There is no authored camera
offset or FOV. See [built-in controls](diagetic.md#built-in-controls-and-shared-models)
for the control entities and pose properties.

Both player definitions are based on the pinned Mojang samples documented in
`Addon/BedformCommon/Assets/ReadMe.md`; both packs include the upstream license as
`License.Mojang.txt`. These files have Mojang's upstream license, separately from
Bedform's MIT code. Packs overriding `minecraft:player` must merge the shared
property, component group, events and client expressions into the winning player
definition. Pack stacking does not merge these definitions automatically. Missing
server presentation assets cause Diagetic acquisition to fail before locking.

## Archive and shared identity

The final `.mcaddon` contains each consumer `.mcpack` plus these two root entries:

| Archive entry | Header UUID |
| --- | --- |
| `bedform-common-bp.mcpack` | `f0ae8683-f8dc-4d1f-9a6e-4059f4035e10` |
| `bedform-common-rp.mcpack` | `c15f802e-ae6c-4b64-9037-db7fb035f1e8` |

Each common `.mcpack` has `manifest.json` at its root. The common behavior pack
depends on the common resource pack at the same version. The behavior data-module
UUID is `922982ea-e393-41e5-b397-aaae537a3aee`, the behavior script-module UUID is
`82d1ef5f-59f2-480f-9f04-2e21987e9105` and the resource-module UUID is
`a91ce449-9145-42d5-a221-5652b080338a`. These five identities stay stable across
builds and releases so the packs remain shared across Bedform-built add-ons.

The two common packs sit directly alongside the consumer packs. The output does
not contain a nested `bedform-common.mcaddon`.

## Staged manifest dependencies

Bedform updates copies of consumer manifests inside the owned build workspace.
Each behavior pack receives a dependency on the common behavior header; each
resource pack receives a dependency on the common resource header. Both common
packs are included even when the project authors only one kind of pack.

For example, a staged consumer behavior manifest at common version 1.1.0 gains:

```json
{
  "uuid": "f0ae8683-f8dc-4d1f-9a6e-4059f4035e10",
  "version": [1, 1, 0]
}
```

The dependency version comes from the bundled common manifest, independently of
the consumer add-on's own version. Authored manifests remain byte-for-byte
unchanged. Other manifest fields, script-module paths and unrelated dependencies
are preserved in the staged copies.

An existing matching dependency is reused, including its additional fields;
repeated matching entries for the corresponding common pack are reduced to the
first entry. UUID matching is case-insensitive. A declared dependency on either
common header with a different version fails the build with the expected and
received versions. When upgrading to a Bedform release with a new common version,
update or remove any explicitly authored common dependency that pins the old
version. Bedform can add the dependency automatically when it is absent.

Consumer headers and modules must use their own UUIDs. Copying a common pack into
the project's selected pack directories fails with guidance to remove it or
assign unique identities, because Bedform already includes the shared packs.

## Packaged artifact and failure handling

The Bedform npm package includes `Asset/bedform-common.mcaddon` through its explicit
`files` list and supplies `fflate` as a runtime dependency. The installed build
module resolves that artifact relative to its own package location. Installed
consumers need no monorepo source paths, common workspace, or install lifecycle
scripts to prepare it.

During a complete build, Bedform validates the artifact's two entries, manifests,
identities, module and pack versions, the behavior script module (JavaScript, with
its entry present in the pack), the behavior-to-resource dependency and the
`@minecraft/server` dependency. It
stages the validated `.mcpack` bytes under
`Intermediate/bedform/build-*/common/` and rewrites consumer manifest copies under
the same workspace's `source/` directory.

Missing or invalid artifacts, incompatible dependencies and reused common UUIDs
fail before publication. Previous output survives failures and cancellation;
failed staged builds report the retained workspace path for inspection. For a
missing or corrupt artifact, reinstall Bedform or rebuild it from the source
workspace. Editing an installed artifact bypasses the release preparation flow.

The legacy standalone Physics overlay command remains unchanged. A standalone
configuration with top-level `schemaVersion` produces overlays, without common
packs or consumer manifest updates. Move those settings under `Physics` in shared
project configuration to use the complete add-on pipeline; see
[Physics compilation and migration](configuration.md#physics-compilation-and-migration).

## Preparing and maintaining a release

The private `bedform-common` workspace lives at `Addon/BedformCommon`. Its independent
builder generates the control content from `bedform/Build/DiageticControls`, bundles
`Script/Main.ts` with esbuild and archives with `fflate`; it never invokes the
Bedform CLI, avoiding recursive bundling. From the repository root:

```sh
npm run build --workspace bedform-common
npm run build --workspace bedform
```

The first command writes `Addon/BedformCommon/dist/bedform-common.mcaddon`.
Bedform's normal and pure builds prepare a fresh copy directly at
`Package/Bedform/Asset/bedform-common.mcaddon`. Bedform's `prepack` runs its normal
build, so a normal `npm pack --workspace bedform` prepares the artifact. When
packing with `--ignore-scripts`, run Bedform's build first. Its packed-consumer test
command already performs that preparation. The generated artifact is ignored by
Git and included in npm packages by the explicit `files` entry.

For shared-content updates, retain all five UUIDs. Keep the common workspace's
`package.json` version, both header versions, both module versions and the common
behavior-to-resource dependency aligned. Keep numeric version triples in the
manifests. Adjust version-pinned regression expectations when intentionally
releasing a new common version, while retaining UUID and dependency assertions.
The loader validates exactly a data and a script module in the behavior pack and a
resources module in the resource pack; adding modules requires a matching
loader-contract change and regression coverage.

Bedform and BedformCommon have separate package versions. A Bedform release carries
the exact common version prepared from its source workspace. Rebuild and package
Bedform whenever shared pack content changes so installed users receive the
current artifact. Verify before distributing:

```sh
npm run verify --workspace bedform
npm run check --workspace bedform-common
```

These checks cover common archive structure and fixed identities, repeatable
standalone builds, scripted and content-only builds, dependency preservation and
deduplication, rejection paths, and source/prior-output preservation. The full
Bedform run also tests real npm tarballs in an offline consumer with install
scripts disabled, while retaining strict-mode, Physics and development-boundary
runtime checks. These are packaging and host checks; they do not deploy packs or
qualify game-client rendering.
