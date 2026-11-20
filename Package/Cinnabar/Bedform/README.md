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

`compatibility.json` is the checked version set. Bedform's first-party API pins require
BDS **1.26.66.1** (the current official stable Windows download checked on 2026-11-20).
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
The source lockfile was unchanged. The workspace command
`cargo +stable check --locked --tests -p protocol --offline` could not resolve the
uncached pinned Bevy Git dependency. Its online attempt was interrupted while
fetching that dependency so the isolated codec check could proceed; the workspace
check is incomplete. These codec tests do not qualify current-BDS registries,
assets or the native SDK, or establish attachment and rendering behavior.

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
