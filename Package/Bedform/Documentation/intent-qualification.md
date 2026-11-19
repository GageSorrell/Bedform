# Automated Intent and Canvas qualification

Run from the repository root:

```powershell
npm run verify:intent --workspace bedform
```

The command runs Bedform's full `verify`, Canvas's full `check`, Bedform's pure build
and its `prepack` preparation. Each successful stage must leave the same SHA-256 for
`Asset/bedform-canvas.mcaddon`. Logs and incremental results are retained under
`Package/Bedform/dist/intent-qualification/`. `results.json` starts with `Passed:
false`; it becomes true only after every child process exits successfully and every
artifact hash matches. A failed gate stops the run and retains its log. A completed
run qualifies the current working tree, including uncommitted changes.

## Recorded run

The [November 18, 2026 evidence snapshot](intent-qualification.results.json), refreshed after the `.9` dead-subject fix, records
a successful run on Windows x64 with Node v24.19.0: Bedform 527/527 tests, Canvas
39/39 tests, all lint/type/freshness gates, and successful pure/prepack preparation.
All four stages produced the same Canvas artifact SHA-256. The complete local logs
remain in the output directory above; the checked-in snapshot retains commands,
exit codes, elapsed times and hashes. It describes the validated working tree at
that time and does not certify subsequent edits.

## Coverage

| Contract | Automated evidence |
| --- | --- |
| Published direct/root exports, declarations, inert imports and restricted globals | Bedform `IntentPacked.test.mts`, `Intent.types.mts` and the independently installed offline `Consumer.test.mts` |
| Two separately bundled clients sharing the packaged Canvas service and renderer | `IntentCanvas.mts`, invoked by both packed and offline installed-consumer checks; each consumer and the actual Canvas `scripts/main.js` execute in separate JavaScript contexts over one native-shaped event bus |
| All 19 presets resolve to packed particle definitions and textures; thinking uses all three animation frames | `IntentCanvas.mts` validates each emitted particle's identifier and UV bounds against the resource archive, and requires both opposing viewers to receive each preset |
| PUA metrics, private registration, transparent backgrounds, gray text, scale and cleanup | Packed integration plus Canvas `IntentRenderer.test.mts`; the manager checks audience and presentation before registration |
| Replacement, disposal, stale expiry, unload/reload, range, dimension, death and disconnect | Packed integration; Canvas `IntentRuntime.test.mts` additionally covers exact expiry, delayed hello/disposal, replay/order fences, malformed traffic and a fresh runtime after restart |
| Subject/viewer failure isolation, capacity, failed cleanup and retry | Canvas `IntentRenderer.test.mts`; these inject native-adapter failures and verify unrelated subjects and shapes survive |
| Static and animated custom PNGs, generated typed descriptors, duplicate/conflicting registrations and source preservation | Bedform `CanvasImages.test.mts` and offline installed-CLI `CanvasImagesPacked.mts`; renderer tests verify aspect ratio and elapsed frame UVs |
| Preset artwork, all arrow directions and shadows, thinking/sleep sequences, SOS from existing Ten glyphs | Canvas `IntentArt.test.mts` and generated-art freshness check |
| Dark gray font ink, white particle ink, matching alpha/UV/metrics, transparent helper cells | Canvas `Glyph.test.mts`, `GlyphParity.test.mts` and glyph freshness check |
| Default tint equals explicit gray; arbitrary RGB/RGBA reaches the particle setter boundary | Packed `VerifyPackedSurface` plus Bedform `Surface.test.mts`; checks do not quantize channels or require precolored textures |
| Inclusion from direct/root/transitive/runtime imports; omission for type-only/dead/pure imports | Bedform `CanvasPacks.test.mts` and offline installed-CLI `CanvasPacksPacked.mts` |
| One canonical Canvas copy, dependency reuse/deduplication, version/UUID/source-copy conflicts and preserved output on failure | The same packaging suites, including source-free offline builds using the shipped artifact |
| Headers, declarations, lint, metrics/assets freshness and reproducibility | Bedform `verify`, Canvas `check`, pure/prepack preparation and artifact hash equality |

The offline consumer packs dependencies with scripts disabled and installs with
`npm install --offline --ignore-scripts`, then runs installed CLI builds outside the source workspace.
It invokes the same packaged three-realm integration, so source-only execution
cannot substitute for the published Intent exports or Canvas entry point.

These are host and packaging checks. Fake native setters and events establish
adapter calls and cooperative privacy rules; they do not establish Bedrock engine
delivery or client appearance. Fixed-path isolated BDS qualification belongs to
`MineCraft-zcmm.9`. Two-client first/third-person views, occlusion, billboarding,
alignment, particle trails and tint/alpha fidelity belong to `MineCraft-zcmm.10`.
The fixed-path native run is documented in
[Canvas native qualification](../../../Addon/BedformCanvas/Documentation/Native.md).
The runner explicitly records `NativeAcceptance: false` and `ClientAcceptance:
false`. It does not start a server, change a world or deploy packs.
