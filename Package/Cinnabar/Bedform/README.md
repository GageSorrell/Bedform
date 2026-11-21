# Cinnabar in Bedform

This is a source-only import of [cinnabar-mc/cinnabar](https://github.com/cinnabar-mc/cinnabar)
at commit `99cbeb5016b0833cd8b8e5ebe11cad2589c333ae`. It is ordinary monorepo content,
with no nested Git repository, submodule, hosted fork or separately managed checkout.
`import.json` records every imported and excluded upstream Git blob. All 9,786 imported
files were checked against those hashes before local integration edits.

The upstream implementation is licensed under `../LICENSE` (PolyForm Noncommercial
1.0.0), with the separate grants and attribution in `../THIRD_PARTY_NOTICES.md` and
component notices. Bedform does not relicense it as MIT. The three Figma TypeScript
modules received Bedform module headers; their upstream implementation remains intact.
Other local changes are the vendored agent guidance, ignore rules, the Rust 1.100.0
toolchain/MSRV and CI pins requested for this fork, and this directory.
The LeviLamina build descriptors are evidence snapshots from commit
`db7ea1f1a964baa9c9612845ea60575d76a012ec`, under the accompanying license.

## Exact target gate

`compatibility.json` records the currently selected version set, targeting BDS
**1.26.66.1**. Its beta API pins carry the `1.26.66-stable` label; that label alone
does not establish a minimum runtime version. The older-target assessment below
demonstrates that 1.26.60.6 is a viable alternative without changing this selection.
The imported Cinnabar codec, protocol 2225 registry foundation and core target
**1.26.60.6**. Its vanilla resource source is separately pinned to a 1.26.60 preview
sample pack. These older inputs have not been relabeled as compatible with 1.26.66.1.
Mojang's [protocol changelog](https://mojang.github.io/bedrock-protocol-docs/changelog/)
documents protocol 2225 with no packet changes through the 1.26.66 hotfix. This is
packet-schema evidence only; registry/assets, codec execution and native ABI
qualification remain outstanding.

Published LeviLamina **26.60.8** uses BDS dependency `1.26.60`, PreLoader **1.16.8**
and SDK/runtime data **26.60.6-server.16**. Its release and SDK build descriptors do
not establish support for BDS 1.26.66.1. No matching published SDK was found in the
release inventory checked on 2026-11-20. Exact native alignment remains blocked.
`availability.json` records the latest 100 published tags for each project, the
checked loader main commit, query URLs and the empty exact-target candidate lists.
This availability audit does not prove that adapting the SDK is impossible.
Bedform-8ww.1 therefore remains open, and dependent attachment/rendering work must
remain blocked. This import proves neither native attachment nor renderer behavior.

From the repository root:

```powershell
node --import tsx Script/check-cinnabar.mts --source-only
node --import tsx Script/check-cinnabar.mts
node --import tsx --test Script/cinnabar.test.mts
```

The first command checks provenance, notices and consistency of the recorded pins.
The second additionally rejects unresolved qualification gates and currently exits 1.
Neither command launches BDS, fetches assets or performs machine setup.

## Preserved build entrypoints

Run upstream commands from `Package/Cinnabar`. The fork retains its Cargo lockfile,
Go module locks, architecture policy and Makefile. Rust **1.100.0** is pinned by
`rust-toolchain.toml`; Go modules require **1.26.1** or later. Build the client with
developer control and the MCP executable separately:

```powershell
go build -o target/debug/bedrock-core.exe ./core/cmd/bedrock-core
cargo build --locked -p cinnabar --features developer-control
cargo build --locked -p cinnabar-mcp
cargo check --locked --tests -p protocol
go -C tools/registrygen test ./internal/foundation ./cmd/foundationcheck
```

`make help`, `make registry-foundation-check`, `make assets`, `make play-build` and
`make dist-local` retain their upstream meaning. Builds require excluded asset inputs;
the source import is not a runnable bundle. Do not run old-target asset preparation
and treat it as target alignment. Before enabling installation, replace or qualify
the codec, registry, vanilla asset, Go core and native SDK inputs against 1.26.66.1,
regenerate assets locally, and pass the exact-target gate. No toolchain installation,
Rust build, BDS launch or asset acquisition is implicit in this import.

## Rust validation on 2026-11-20

The installed Windows x64 MSVC toolchain reports Rust and Cargo **1.100.0**. The
vendored codec passed **39 tests** (25 unit and 14 integration tests) using that
compiler. Validation copied its unchanged source, tests and manifest plus the
upstream Cargo lockfile into the ignored `.local/codec-validation` directory,
added an empty `[workspace]` to isolate dependency resolution, and ran:

```powershell
cargo +stable test --manifest-path .local/codec-validation/Cargo.toml --target-dir .local/codec-validation/target
```

The `stable` toolchain was verified to report exactly the pinned 1.100.0 release.
The source lockfile was unchanged. An additional isolated protocol workspace passed
**1,253 unit tests and 65 integration tests**, including its offline Go startup
harness. Three benchmarks and the manual live-BDS test remained ignored upstream.
The Go `TestHandoffCarriesTheTraceConnection` test also passed. The reduced workspace
used 511 byte-identical crate files and a pruned lockfile whose 103 package identities
and checksums match the original lock. Commands, hashes and scope are recorded in
`protocol-validation.json`.

The original workspace check remains incomplete: an attempt to fetch the pinned
Bevy commit with shallow history failed with a connection reset, early EOF and
invalid index-pack output. The isolated checks do not establish a passing original
workspace build, qualify current-BDS registries/assets or the native SDK, or prove
attachment and rendering behavior.

The full Go registry-generator suite was also run. Its carrier checks fail because
the excluded block/biome binary registries are absent; its Rust delegation could
not find Cargo on the inherited PATH. Regenerating and validating the required
carriers from qualified target inputs remains an open gate. The passing foundation
command tests validate metadata handling, not the missing carriers.

## Older-target assessment

The user-requested investigation in Bedform-8ww.15 found BDS **1.26.60.6** to be a
viable Bedform target. `bds-1.26.60.6-assessment.json` records the evidence, exact
package versions, integrity/hash information, commands and limitations. Eleven API
version comparisons, including the seven version-specific beta comparisons, have
identical complete declaration syntax after removing comments and normalizing
whitespace. Four workspace typechecks introduce no errors using the older beta
declarations and each workspace's installed TypeScript compiler.

On the exact Windows server executable (build 52886189), the package runners passed
all six Effect scenarios, the three-process Canvas/widget/spatial-text fixture
(including restart and the byte-exact unmodified pack), and the native physics
fixture with actual process restart. These runs used the fixed test executable
paths after the user completed firewall setup. The source installation was read
only; all launched test servers stopped cleanly.

This establishes a practical older-target option without demonstrating Cinnabar
attachment or real-client appearance. A deliberate retarget still requires changes
to the canonical task contract, six beta mirror pins and dependent lockfile entries,
the latest-version mirror policy and compatibility guards. Stable server 2.11.0
and server-ui 2.3.0 need no downgrade. Missing Cinnabar assets, original-workspace
build validation, native loader/link qualification and exact-player acceptance
remain open. The selected 1.26.66.1 target and issue .1's blocked status are unchanged.

## Exclusions and repository tooling

`import.json` lists the 167 exclusions: asset binaries, fonts, images, audio/video and
the upstream roadmap (`plan.md`). Source schemas, shaders, code, small protocol test
fixtures and license files remain. `.gitignore` excludes those payloads plus native
outputs, `.local/` assets/authentication, reports, captures, recordings and buffers.
Excluded built-in fonts and images are also needed by upstream embedded-resource
builds; a future target-qualified asset stage must supply them locally.

Cinnabar has no root `package.json`, so npm workspace discovery excludes it. Mirror
sync rejects a future `@minecraft/cinnabar` collision and skips the native directory;
publishing explicitly excludes it even if an npm manifest is added later. Handwritten
`Package/ServerGameTest` source remains owned by that mirror and is preserved by sync.
