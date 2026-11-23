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

The user explicitly selected **BDS 1.26.60.6** on 2026-11-20 after Bedform-8ww.15.
`Script/bedrock-target.json` owns the server/API pins, and mirror sync preserves
these native pins instead of following newer npm tags. `compatibility.json` records
the corresponding Cinnabar inputs. Stable server 2.11.0 and server-ui 2.3.0 remain;
the six version-specific beta mirrors now use their `1.26.60-stable` builds.
The imported Cinnabar codec, protocol 2225 registry foundation and core target
**1.26.60.6**. Its vanilla resource source is separately pinned to a 1.26.60 preview
sample pack. Its original provenance remains intact.
Mojang's [protocol changelog](https://mojang.github.io/bedrock-protocol-docs/changelog/)
documents protocol 2225 with no packet changes through the 1.26.66 hotfix. This is
packet-schema evidence only; it is not the basis for claiming native ABI compatibility.

Published LeviLamina **26.60.8** uses BDS dependency `1.26.60`, PreLoader **1.16.8**
and SDK/runtime data **26.60.6-server.16**, matching the selected target.
`availability.json` records published availability and descriptor alignment.
`alignment-validation.json` records the passing source/target gate. Status `aligned`
means source import, exact version alignment and affected protocol/registry checks.
The [native fixture results](Native/README.md) record the separate Bedform-8ww.2
proof of linking, loader execution and visible rendering for both spawn APIs.

From the repository root:

```powershell
node --import tsx Script/check-cinnabar.mts --source-only
node --import tsx Script/check-cinnabar.mts
node --import tsx --test Script/cinnabar.test.mts
```

The first command checks provenance, notices and consistency of the recorded pins.
The second additionally checks alignment evidence; both currently pass.
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
the source import is not a runnable bundle. Full bundle preparation must supply those
inputs and qualify the resulting client, helpers and bridge for the selected target.
No toolchain installation or BDS launch is implicit in this source import.

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

The final registry validation passed **76 asset-compiler unit tests** and **490 Go
tests across seven packages**. `registryc --kind all --check` regenerated 26 production
files and matched the pinned bytes. The reduced validation graph has 1,073 byte-identical
source files and 254 exact package identities/checksums from the original lock. Twelve
excluded binary fixtures were fetched at the imported commit and Git-blob verified
inside ignored `.local/asset-validation`; the source import still excludes them.
Two upstream conditional tests remain skipped: the historical Education migration
comparison needs a previous registry root, and independent server-defined metadata
regeneration needs the sample behavior-pack/palette inputs. Current production
registry regeneration passed; the skipped checks are recorded as unrun.

To reproduce registry validation, run `python Bedform/PrepareRegistryValidation.py`
from `Package/Cinnabar`, then follow `alignment-validation.json`'s commands. The first
Cargo command prunes a copied lock for the reduced graph; subsequent commands use
`--locked`. The preparation command fetches verified fixtures into `.local`; it neither
installs tools nor launches BDS. GNU Make must be on PATH for its Makefile planning
test. Use `GOWORK=off` and point `CINNABAR_REGISTRYC_BIN` at the built validation compiler.

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

This assessment preceded the user's explicit target switch; its original selection
fields are historical. The task contract, beta pins, lockfile, mirror policy and
compatibility guards now select 1.26.60.6. The [later native fixture](Native/README.md)
validated the loader and visible Cinnabar attachment for that target. Complete
bundle production and original workspace build validation remain in the dependent
integration/setup gates. Final
focused checks and all six affected mirror typechecks also passed using portable
Node 24.19.0; the preceding native fixtures used installed Node 24.22.1. No system
Node default was changed.

The broader `npm run verify --workspace bedform` is not green: 587 of 590 tests
passed, with failures in Canvas artifact rejection, pointer drawing and the Windows
offline-consumer temp path. The two Canvas assertions also fail in a sequential
Node 24.19.0 recheck. The independent packed consumer subsequently passed under
Node 24.19.0 with a normal temp path; the default short-path case remains a test
infrastructure defect. Bedform-oce tracks these framework gates separately from
.1's passing import, selected-target, protocol and registry checks.

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
