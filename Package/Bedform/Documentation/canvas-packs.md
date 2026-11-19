# Shared Canvas packs

Bedform includes `Asset/bedform-canvas.mcaddon` in its npm package. Normal builds,
pure builds and prepack prepare this artifact with Canvas's independent builder.
It contains the canonical `bedform-canvas-bp.mcpack` and
`bedform-canvas-rp.mcpack`. Their UUIDs and versions belong to Canvas, independently
of BedformCommon and the Bedform npm version.

An installed offline consumer reads that packaged archive directly. It needs no
source workspace, Minecraft client, network request or lifecycle script to create
Canvas dependencies. Ordinary complete builds still include Common as before.

## Automatic inclusion

After tree shaking each script's neutral prebundle, Bedform inspects the modules
contributing output bytes. Surviving asset-backed features enable Canvas once for
the complete add-on, including direct, root-namespace, transitive and dynamic imports.
Current entry families include Intent, Renderer, Pointer, Glyph, Terminal and Window;
the latter families can grow independently as their APIs are implemented.

Pure React APIs, measurement, image metadata/frame helpers and protocol helpers
do not themselves request Canvas. Surface's built-in `Rectangle`/`Fill` use does;
pure helpers such as `Tint` do not. Custom image registrations emit self-contained
consumer resources and do not force the shared archive by themselves. Type-only
imports, eliminated imports and statically dead branches leave Canvas out.

This is conservative bundle analysis, not a prediction of which code executes at
runtime. Passing a whole namespace to unknown code retains its potential feature
use. It starts no extra services in the consuming script; the included Canvas pack
runs its own shared runtime when Bedrock loads the packs.

Future display, Ink, Window, VM presentation or custom spatial backends can declare
their dependency without importing Intent:

```ts
import { WithAssets } from "bedform/Canvas/Dependency";

export const Presentation = /* #__PURE__ */ WithAssets({
    Particle: "example:canvas_backed_presentation"
} as const);
```

`WithAssets` returns its input unchanged and registers nothing. Its surviving use
requests the canonical Canvas packs. The pure-call annotation allows an unused
definition and its dependency to disappear together. This marker makes general
packaging independent of completed Intent, image, React or VM implementations; it
does not implement or promise those APIs.

## Dependency and copy ownership

When enabled, each staged consumer behavior pack depends on Canvas's behavior
header UUID, and each staged consumer resource pack depends on its resource header
UUID. Canvas's behavior pack already depends on its resource pack. Both canonical
archives are appended exactly once. Source manifests are never edited.

Existing matching dependencies are retained, including unrelated metadata, with
duplicates reduced to one. UUID matching is case-insensitive. Every declared Canvas
version must match the artifact's numeric version triple; conflicts fail. Explicit
Canvas dependencies also request inclusion even without a runtime feature import.
Consumer pack/module UUIDs must not reuse reserved Canvas identities, and module
UUIDs cannot be used as pack dependencies.

Projects may supply copies of the canonical Canvas packs. Matching copies are
recognized before consumer script discovery, validated and deduplicated into the
canonical packaged archives. Their scripts are not rebuilt or given Common dependencies.
Manifest formatting, UUID casing, module/dependency order and omitted versus empty
resource dependencies are immaterial; all other fields and asset bytes must match.
Modified, missing or extra content under the same UUID/version is a conflict, so
authored changes are never silently discarded. Use a new identity for a fork.

An explicit script mapping of a copied prebuilt Canvas entry to itself is redundant
and accepted. Mapping another source entry onto the managed runtime is rejected.
Consumer script mappings retain their normal discovery and validation rules.

The loader validates archive paths, pack/module identities and versions, script
entry presence, the resource dependency and native module dependency before staging.
Missing or corrupt required artifacts produce a reinstall/rebuild diagnostic.
Non-Canvas builds never load that artifact. Staging and publication remain confined
to the owned intermediate workspace; failures preserve the previous published archive.

## Verification

`npm run test:canvas-packs --workspace bedform` checks bundle detection, erasure,
artifact validation, deduplication, copied packs, conflicts and source/archive
preservation. The full `npm run verify --workspace bedform` additionally runs a
source-free offline installed-CLI fixture using the general marker alone, with no
Intent or image configuration. Canvas's own checks validate artifact reproducibility.
Native delivery and real-client appearance/privacy remain separate acceptance work.
