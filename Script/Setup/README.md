# Monorepo setup

Private `monorepo-setup@1.0.0` provides the Effect 4.0.5 CLI foundation for Windows 11 x64 setup of the local Cinnabar fork.

Effect, the Node platform, and its shared adapter are pinned together at `4.0.5` so clean dependency resolution cannot introduce an incompatible newer Effect peer.

From the repository root, use Node 24.19.0 and npm >=12.0.2:

```powershell
npm install
npm run setup -- --help
npm run setup -- --version
npm run setup -- --directory "D:\Tools\Cinnabar"
npm run setup -- --update
```

Root `npm install`/`npm ci` runs setup through `postinstall`, explicitly compiling the CLI first even on a clean checkout. This can enter the consented setup workflow; required consent without a terminal fails clearly. Workspace `prepare` only compiles. Importing modules and requesting help/version never run setup, elevate, build native binaries, or start capture. The root command retains npm's original `INIT_CWD` for invocation-relative paths, including `npm --prefix` calls from another directory. Direct Node invocations use their current working directory. After source edits, run `npm run build --workspace monorepo-setup`.

Source is always `Package/Cinnabar` in the checkout owning the CLI. A missing local fork or missing configuration produces an actionable error before any installation. `--directory` selects the executable installation directory only; its default is `C:\Program Files\Bedform\Cinnabar`. Relative overrides resolve against the original invocation directory. Ordinary reruns first check whether setup is already complete and current, then request incremental work if necessary. `--update` bypasses that shortcut and requests forced rebuilding/reinstallation of the **current local source**, preserving developer edits; neither mode fetches, pulls, switches branches, updates submodules, resets, stashes, cleans, or clones a replacement.

Verified already-current setup emits exactly `☑ Setup is already complete and current.` and exits before prompts or setup mutations. The symbol is green when color is supported and resets immediately before the single separating space. `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR=0`, and terminal capability control color without changing the character or spacing. No other setup-owned logs appear on this path. Missing/stale/corrupt/partial/unverified setup, a successful first installation/repair, and forced `--update` never emit that line.

Core setup is selected by default. Independent selections are:

| Flag | Selection |
| --- | --- |
| `--no-core` | Skip core build/install for independently selected provisioning/tool stages. |
| `--bds-directory <path>` | Provision an explicitly selected stopped BDS. No server is selected implicitly. |
| `--mcp-config <file>` | Register the installed MCP executable in an explicitly selected configuration. |
| `--blender` | Offer optional Blender/Mcblend setup. |
| `--blockbench` | Offer optional Blockbench setup. |

Optional-stage decline/failure emits a diagnostic and preserves required setup success. Consent defaults to No; a required decision without an interactive terminal fails clearly. Setup does not change global PATH or enable look-back/capture.

This foundation does **not yet perform a complete installation**. Machine-changing adapters fail explicitly until their owning Beads components are implemented: prerequisites (`xa5.3`), build/install (`xa5.4`), BDS/MCP (`xa5.7`), and creative tools (`xa5.8`/`xa5.9`). Consequently root postinstall currently fails with the missing-source or pending-component diagnostic. Help/version work now. No native installation or renderer acceptance is claimed.

Permission preflight resolves junctions and checks the local build cache, install directory, sibling bundle staging/rollback, every owned bundle file supplied by the inspector, and explicitly selected BDS/MCP configuration and backup locations. It rejects source/build/install collisions. Setup supplies `CARGO_TARGET_DIR` and `CARGO_BUILD_BUILD_DIR` for `source/target` and `source/target/.setup-build`, overriding ambient Cargo output redirection without rewriting configuration. Prerequisite/build adapters must retain these values so their writes match preflight. Temporary write/rename probes are cleaned immediately; existing files are opened without truncation. ACLs are never changed.

Writable custom destinations continue without elevation. Protected paths require a default-No confirmation. Approval launches the same absolute Node executable and compiled CLI through Windows UAC in a visible terminal, waits for completion, and propagates the child exit code. The data-only handoff retains flags, original cwd, absolute paths and original tool/profile locations; it excludes credentials and Node startup hooks. A different Windows account, cancellation, noninteractive consent, or continued denial while elevated fails clearly without a relaunch loop.

Scoped leases under the invoking account's `LOCALAPPDATA/Bedform/Setup/locks` prevent duplicate setup work for the same source or destination. The elevated child verifies and borrows its live parent's lease. Interrupted runs can leave a stale lock: inspect its recorded PID and resources before manually removing that specific lock. Setup never deletes another process's locks automatically. Already-current setup exits before creating locks or probes.

## Component contracts

To prepare the native feasibility environment on Windows, run
`npm run qualify:cinnabar --workspace bedform` from an interactive terminal.
The runner checks the assessed BDS binary at
`Package/Bedform/dist/bds-runtime/bedrock_server.exe` and its existing inbound
firewall rule. Use the repository's explicit firewall setup if approval is missing.
The runner shares the package BDS lock, starts a disposable world with joins
disabled, and stops the server after startup. It restores the previous
`server.properties` and keeps the scoped fixture and evidence under
`Package/Bedform/dist/cinnabar-environment/<run-id>`.

The readiness report includes the invoking identity, checkout revision and local
changes, prerequisite probe results, an offscreen D3D12 pixel readback, both
GameTest spawn API availability checks, and a measured world checkpoint. Native
build and Go commands use two jobs or processors, and the fixture requests two
BDS threads. To restore a stopped disposable world from its checkpoint, run
`node --import tsx Script/Setup/Tool/cinnabar-environment.mts --reset <run-id>`.
Keep evidence local because the report identifies the Windows account.

This checkpoint covers the disposable world. Clean, missing-tool and incomplete-tool
OS snapshots and real installer/UAC verification remain part of final Windows
qualification. Exact-player attachment, rendered Cinnabar world frames and
server-observed input are measured separately in the native feasibility experiment.

The prerequisite adapter validates local Cargo, Rust/Go, helper, native loader/SDK,
API and asset manifests before permission prompts or installation. It detects Git,
VS 2022 or later with a working x64 compiler/Windows SDK/CMake/Clang environment,
the declared MSVC Rust toolchain and components, Go, xmake, and FFmpeg/ffprobe.
Compiler/link and H.264/MP4 smoke probes check usable capabilities. Child environments
retain the original account and canonical build paths; PATH refresh does not edit
the registry or Rust's global default. Installed toolchains matching an exact release
can be reused under their existing name.

Each missing or broken prerequisite requires an explicit default-No confirmation.
Git, Go, VS Build Tools, xmake and FFmpeg use the locally declared WinGet IDs.
An incomplete supported VS installation is modified in place. Missing WinGet requires
manual App Installer setup; setup never bootstraps it. Rustup uses the official
Windows installer URL and SHA-256 in `Package/Cinnabar/Bedform/prerequisites.json`.
Install failures, cancellations, reboot results and unsuccessful rechecks stop setup.
Installer and smoke-test temporary directories are cleaned.

The same checked policy pins the selected LeviLamina source SDK and runtime-data
archives. Acquisition verifies their SHA-256 and extracted bytes. Separately consented
source data/font/image inputs come only from the recorded import commit and must
match the import inventory's Git blob hashes. They stay ignored and untracked;
edited existing inputs are preserved and cause a diagnostic. Mojang sample assets
use the fork's checked manifest and cache normalization, with explicit Minecraft
EULA/license consent. No replacement fork/configuration is fetched, optional creative
tools remain independent, and preparation never enables capture or look-back.

Prerequisite readiness establishes tool and input availability. Building runtime
helpers, generated carriers and the native bridge, SDK link/load qualification, and
installed-bundle validation remain separate build/native acceptance gates. Normal
tests inject probes, consent, installers and acquisition; they do not run installers
or UAC.

`Source/Contract.ts` is the shared boundary. Changes to these contracts and the root manifests/lockfile should have one integration owner. Implement lane-specific adapters in separate modules and wire their layers in `Source/index.ts` when ready.

| Service/model | Responsibility |
| --- | --- |
| `Options`, `Paths`, `Account`, `Request` | Selected stages, forced rebuild flag, absolute checkout/source/install/CLI/Node/original-cwd locations, account and tool environment. Preserve the entire request through UAC. |
| `Probes` | Read-only platform/source preflight before machine changes. The prerequisite lane extends detailed local manifest/toolchain validation. |
| `Currency`, `Verification` | Read-only inspection supplying complete receipts and freshly measured SHA-256 evidence. Source/build inputs include developer edits; pins include dependency/toolchain/compatibility manifests; bundle checks include independent required-file enumeration, ownership, every owned file and provenance. Selected BDS/MCP targets and configuration must match. Recorded optional declines/unavailability remain nonblocking. The default inspector returns no evidence until the build/install and provisioning lanes implement inspection; it never trusts an unverified marker. |
| `Reporting` | Sole already-current success line after proof validation. No banners or progress on this path. |
| `Permissions` | Destination access, original-account checks and consented single elevation handoff. Return a refreshed environment or the waited child exit code. A relaunch result ends parent orchestration. |
| `Prerequisites` | Usable-tool discovery, consented installers, rechecks and refreshed child environment. |
| `Consent` | Effect `Prompt.Confirm`, default No, explicit noninteractive/cancellation diagnostics. |
| `Processes` | Effect `ChildProcess`/spawner, executable plus argument array, explicit cwd/environment, live streams, no shell, exit code. Component owners interpret installer/reboot/build statuses. |
| `BuildInstall` | Incremental/forced local builds and verified transactional bundle installation. |
| `Provisioning` | Independent BDS and MCP operations with explicit absolute destinations. |
| `CreativeTools` | Independent Blender/Mcblend and Blockbench operations. |

Adapters capture their Effect dependencies when constructing layers, keeping service methods' error channel as `Error`. Original account identity/home remain unchanged when child environments refresh. `Request.elevated` is reserved for the permissions lane's validated internal handoff; it is never accepted as a public approval flag. That lane owns serialized payload validation, loop prevention and result propagation. The permission and handoff adapters implement this boundary.

`Test/Fixture.mts` supplies reusable in-memory services, currency evidence/checks, recorded requests/events/commands/prompts/logs, queued consent answers (default No), and queued process exit codes. Override individual services with `Effect.provideService` to exercise a component without changing the machine.

```powershell
npm run verify --workspace monorepo-setup
npm run typecheck:tools
```

The host tests establish component orchestration, parsing, path resolution and import/help/version safety. Actual UAC, prerequisite installation, native builds and installed-bundle acceptance remain separate isolated Windows gates.
