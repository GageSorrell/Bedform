# Bundle BedformCommon with Bedform-built add-ons

## Summary

Create `Addon/BedformCommon` as a private workspace named `bedform-common`, initially containing behavior and resource pack scaffolds. Every complete add-on built through Bedform will include both common packs and declare the corresponding manifest dependencies.

## Organization boundary (November 17, 2026)

The scaffold/bundling delivery below is closed history in `MineCraft-4osy`; its initial no-runtime/content assumptions describe that delivery, not a restriction on later additions. Common retains unrelated imperative DDUI/control resources, including Direction, Transactional and navigation icons/localization. The [Canvas/Intent plan](Bedform_IntentBubbles_Plan.md) assigns terminal/spatial glyphs, white ordinary particle textures, shared frame assets, canonical display/VM entities and common identity/persistence/runtime support to `bedform-canvas`. Spatial TabButton and FramedPanel artwork belongs to Canvas, including the corrected Canvas assignment in `MineCraft-ty2k.32` recorded by `MineCraft-w82n.5`.

Reuse the proven archive/dependency/consumer patterns here for Canvas without merging pack UUIDs or moving native DDUI assets. Common remains included in every complete build; Canvas inclusion is feature-based. Display-only construction starts no React, Ink or VM, and general Canvas packaging does not wait for all Intent work. `MineCraft-w82n.2` revises these document boundaries only; future issue reconciliation and dependency wiring remain in `.5/.7`.

## Implementation

- Create format-version-2 manifests with fixed header/module UUIDs, initial pack versions `[1, 0, 0]`, and minimum engine version `[1, 26, 0]`. The common behavior pack depends on its resource pack. Include documentation, without adding runtime scripts or moving existing assets.
- Give BedformCommon an independent build tool that produces `bedform-common.mcaddon` containing two `.mcpack` files. It must not invoke the Bedform CLI, avoiding recursive bundling.
- Have Bedform's build prepare that artifact inside its package directory. Add the artifact to `Package/Bedform/package.json`'s `"files"` and run the build during `prepack`. Installed consumers require no lifecycle scripts or monorepo files.
- Resolve the bundled artifact relative to Bedform's installed module location. Extract its two `.mcpack` entries into the existing build workspace and append them to the consumer's outer `.mcaddon`; do not nest another `.mcaddon`. Promote `fflate` to a runtime dependency for archive reading.
- Add common behavior/resource UUID dependencies to the corresponding staged consumer manifests. Preserve existing dependencies, reuse matching entries, and reject conflicting versions. Leave authored manifests unchanged.
- Reject consumer packs that reuse the common packs' UUIDs, with guidance that Bedform includes them automatically. Missing or invalid bundled artifacts fail without replacing a previous output.
- Document automatic inclusion and dependency handling. Preserve existing public build interfaces and CLI flags; add no configuration switch.

## Validation

- Verify the common archive contains exactly the two expected packs, with stable UUIDs and matching dependency versions.
- Test scripted, content-only, behavior-only, and resource-only builds. Each includes both common packs exactly once.
- Check staged dependencies, preservation of authored manifests, conflicting dependencies, duplicate UUIDs, and preservation of previous output on failure.
- Extend npm package checks to require the common artifact. Extend the isolated, offline installed-consumer test to build successfully with install scripts disabled and inspect both common packs.
- Update existing archive-count and manifest assertions while retaining their runtime checks. Run Bedform's full verification plus the new workspace's build, typechecking, and lint checks.

## Assumptions

- Initial content is the pack scaffold selected during planning.
- Inclusion applies to every complete CLI add-on build, regardless of runtime imports or development mode.
- The legacy Physics overlay command remains an overlay generator.
- Record and claim the implementation in Beads before editing. Preserve existing unrelated changes; no deployment, commit, push, or remote sync is included.

## Beads implementation entries

Epic: `MineCraft-4osy` — Bundle BedformCommon with Bedform-built add-ons.

| Entry | Deliverable | Depends on |
| --- | --- | --- |
| `MineCraft-4osy.1` | Common pack scaffolds and standalone archive builder | — |
| `MineCraft-4osy.2` | Common artifact in the Bedform npm package | `MineCraft-4osy.1` |
| `MineCraft-4osy.3` | CLI bundling and staged manifest dependencies | `MineCraft-4osy.2` |
| `MineCraft-4osy.4` | Archive, dependency, failure-path, and installed-consumer verification | `MineCraft-4osy.3` |
| `MineCraft-4osy.5` | Documentation and final verification | `MineCraft-4osy.4` |

Beads is the source of truth for task status; this document is the implementation specification.
