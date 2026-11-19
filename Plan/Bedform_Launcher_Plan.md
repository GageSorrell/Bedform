# Bedform Desktop Launcher

## Summary

Create `Application/Launcher` as a private `@bedform/application` workspace, starting at `1.0.0`. Deliver a Tauri 2 application with a React frontend, a C++23 backend connected through CXX, and a separately runnable management agent.

Support Windows x64, Linux x64, and macOS Intel/Apple Silicon. Use a Bedrock-inspired interface with original assets, keyboard navigation, and Play, Worlds, Servers, Add-ons, and Settings pages.

This document records the agreed specification. Beads is authoritative for implementation status. Saving the plan and creating issues does not establish implementation or runtime acceptance.

## Architecture and interfaces

- Use React, TypeScript, and Vite. Keep Rust responsible for Tauri commands, events, platform integration, and CXX bridging. Put registry access, installation, persistence, and server management in C++23.
- Build one reusable native core with CMake; link it into the desktop application through CXX and into the headless agent. Pin toolchains and dependencies, with an explicit C++23 compiler check. Follow [CXX's Cargo integration](https://cxx.rs/build/cargo.html).
- Expose typed operations for client profiles, worlds, servers, registry searches, installation plans, backups, and agent pairing. Long operations return IDs and publish progress, completion, and structured errors.
- Store application and agent state in versioned SQLite databases. Keep user data separate from system-wide application binaries; retain recoverable installation journals and backups.
- Add application workspaces and scoped build, typecheck, lint, test, native-test, and verification commands. Apply repository documentation and naming conventions to application TypeScript too.

## Launcher, worlds, and add-ons

- On Windows, discover current GDK and legacy UWP client content roots, support explicit overrides, and distinguish installed profiles. Launch the existing game; game downloads and Microsoft authentication remain owned by the installed client.
- Use `minecraft://connect?serverUrl=…&serverPort=…` for servers and `minecraft://?load=…` with the opaque local level ID for worlds. Encode arguments and test actual client behavior against the [documented handlers](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/Reference/Content/deep-links.md).
- On macOS/Linux, provide configurable external-launcher adapters: executable, argument arrays for launch/connect/open-world, content roots, and supported capabilities. Invoke directly without shell interpolation.
- Discover or select existing worlds, import `.mcworld` archives, display world metadata, install add-ons, back up, restore, and launch. Creating new client worlds is outside this release.
- Search npm using the `bedform-addon` **keyword**, paginate results, and revalidate package metadata before installation. Use the [npm registry search and metadata APIs](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md).
- Define the publisher contract as `bedformAddon: { schemaVersion: 1, artifacts: string[] }` in `package.json`. Artifact paths identify prebuilt `.mcaddon` or `.mcpack` files inside the published tarball. Document this contract and provide fixture packages.
- Verify registry tarball integrity and safely inspect archives before extraction. Never execute npm lifecycle scripts or build downloaded source. Reject traversal, escaping links, oversized archives, and conflicting pack identities.
- Install into a selected client library, local world, or local/remote server world. Client-library installation makes packs available; world/server installation activates the required pack stacks.
- Resolve pack dependencies against the artifacts, canonical shared packs, and existing target inventory. Report missing dependencies explicitly. Preserve unrelated packs, stack order, manifest fields, and saved-data identifiers.
- Package the existing Common and Canvas artifacts from the same Bedform release as the bundled CLI. Provision both for managed servers, deduplicate matching copies, and reject incompatible shared-pack versions.
- Present destination, pack changes, compatibility failures, and required downtime before applying a transaction. Require inactive client worlds or stopped BDS, create backups, and recover or roll back interrupted changes.

## Local and remote servers

- Provide creation, explicit adoption of existing installations, start/stop/restart, configuration, console input, live logs, backups, restore, runtime updates, and add-on management.
- Download BDS from official sources after license acceptance. Support local BDS on Windows/Ubuntu x64; macOS manages remote supported hosts. Official BDS has no macOS or ARM build. See [platform requirements](https://help.minecraft.net/hc/en-us/articles/49914677714957).
- Use a persistent per-user local agent, started on demand and registered for user-session startup. It owns BDS processes, so closing the desktop window leaves servers running.
- Use user-restricted named pipes or Unix sockets locally. Remote agents expose a versioned HTTPS API with streamed events, verified host fingerprints, one-time pairing, mutual TLS credentials, and revocation.
- Ship standalone Windows/Linux agent installers with service support. Remote deployment is operator initiated; the desktop pairs with an already provisioned agent.
- Restrict remote file operations to registered server roots. Persist operation IDs so reconnecting clients can recover progress without duplicating installations.
- Serialize changes per server, verify process ownership, stop gracefully, and preserve a stable executable path when updating BDS. Use the transport supported by the downloaded runtime.
- Exclude the separately planned Settings/Workflow sidecar from this project.

## Installation and delivery

- Produce system-wide Windows NSIS, macOS PKG, and Ubuntu DEB installers. Capture the installing user before elevation; unattended installation must identify that user when it cannot be determined.
- Bundle Node **24.19.0**, the complete release-matched `bedform` CLI dependency closure, required assets, and a native command shim. Running the CLI must require neither system Node nor npm.
- Check the installing user's npm-global package metadata and CLI mapping. If npm-global `bedform` exists, skip the system CLI command for everyone, as selected. Otherwise install the app-owned command and required PATH integration. Never overwrite npm-owned or unrelated commands.
- This is an installer-user check, not a per-user delegating dispatcher. A skipped system command can leave other users without a CLI; this is the chosen system-wide coexistence policy.
- Record installer ownership so upgrades and removal affect only app-owned files and PATH entries. Preserve worlds, backups, user configuration, and npm installations by default.
- Supply signing/notarization configuration; release signing depends on supplied credentials. Publishing, remote deployment, commits, pushes, and Dolt synchronization are outside implementation.

## Validation and acceptance

- Test malicious archives, integrity failures, pack conflicts, dependency handling, rollback, interrupted-operation recovery, concurrent requests, pairing/revocation, disconnects, and process lifecycle.
- Test frontend workflows, keyboard access, progress/error states, and installation destinations with deterministic fixtures.
- Test installation, upgrade, and uninstall with no Node/npm, with npm-global Bedform, with command collisions, and with different installing/elevated accounts. Exercise CLI configuration validation and a real add-on build.
- Run native builds on every supported platform and real local/remote BDS tests on Windows and Ubuntu. Windows tests must use a fixed `dist/bds-runtime/bedrock_server.exe` through package runners and explicit firewall setup. Ordinary tests must not elevate.
- Require a real Windows-client walkthrough proving server connection, local-world deep-link loading, and installed pack activation. Qualify macOS/Linux adapters separately. Report automated, native, installer, BDS, and client evidence independently.
- Native toolchain setup is required before native validation: Rust/Cargo were not on the inspected shell's PATH at planning time.
- Preserve unrelated in-progress React-port work. Add no new dependencies on deprecated server-manager code. Keep existing Bedform versions, pack UUIDs, and saved-data keys intact.
- Keep each implementation issue open until its acceptance criteria are met. Unmet platform, installer, live BDS, or real-client gates remain explicit blockers to their owning issues and the epic.

## Beads implementation tracking

The epic and child issue mapping below is a specification index, not a separate task-status checklist. All implementation issues start open. Each child includes its own validation, and the final two children own integrated qualification.

Epic: **`Bedform-2zw`**.

| Issue | Implementation area | Blocking prerequisites |
| --- | --- | --- |
| `Bedform-2zw.1` | Establish launcher workspace, C++23 core, CXX bridge, contracts, and persistence | None |
| `Bedform-2zw.2` | Implement safe archives, pack inventory, and canonical shared-pack dependency resolution | `Bedform-2zw.1` |
| `Bedform-2zw.3` | Implement npm add-on discovery, artifact metadata, and verified downloads | `Bedform-2zw.2` |
| `Bedform-2zw.4` | Implement transactional add-on installation, activation, backup, and recovery | `Bedform-2zw.2` |
| `Bedform-2zw.5` | Integrate Windows client discovery, existing worlds, and Minecraft deep links | `Bedform-2zw.1`, `Bedform-2zw.4` |
| `Bedform-2zw.6` | Implement macOS/Linux external launcher adapters and content-root integration | `Bedform-2zw.1`, `Bedform-2zw.4` |
| `Bedform-2zw.7` | Implement persistent local management agent, IPC, and BDS process supervision | `Bedform-2zw.1` |
| `Bedform-2zw.8` | Implement remote agent TLS pairing, authorization, streaming, and service mode | `Bedform-2zw.7` |
| `Bedform-2zw.9` | Implement managed BDS provisioning, configuration, updates, and server workflows | `Bedform-2zw.2`, `Bedform-2zw.4`, `Bedform-2zw.7` |
| `Bedform-2zw.10` | Build Bedrock-inspired launcher UI and complete desktop workflows | `Bedform-2zw.3`, `Bedform-2zw.5`, `Bedform-2zw.6`, `Bedform-2zw.8`, `Bedform-2zw.9` |
| `Bedform-2zw.11` | Package self-contained Bedform CLI runtime and native command shim | `Bedform-2zw.1` |
| `Bedform-2zw.12` | Build system-wide desktop/agent installers and npm-global CLI coexistence | `Bedform-2zw.8`, `Bedform-2zw.10`, `Bedform-2zw.11` |
| `Bedform-2zw.13` | Validate cross-platform integration, installers, CLI, and document launcher operation | `Bedform-2zw.10`, `Bedform-2zw.12` |
| `Bedform-2zw.14` | Qualify real BDS, remote hosts, Windows deep links, and external client adapters | `Bedform-2zw.13` |

Parent-child hierarchy is separate from the blocking prerequisites above. Start with `Bedform-2zw.1`; claim implementation work only when beginning it. All implementation entries remain open after this planning handoff.


