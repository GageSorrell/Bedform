# Bedform native Cinnabar bridge

`BedformNativeBridge` is the Windows x64 LeviLamina extension for the [v1 automation contract](../../Contract/README.md). It binds a loopback control listener only when `BEDFORM_CINNABAR_BRIDGE_CONFIG` names an explicit configuration. The provisioner supplies the configuration and the matching `compatibility.json` in a private directory whose Windows ACL grants access to the BDS process and the intended host. The configuration carries a nonzero `port`, a randomly generated 64-character lowercase hexadecimal `token`, and an optional `packs` array. A pack entry has `uuid`, `version`, archive path, and archive `sha256`. Optional `subPack` and base64 `contentKey` follow the existing Cinnabar packet format. Provision the archives for the selected world's resource pack stack. The bridge checks the configured archive bytes on load, then selects the active world's packs in stack order. An unsatisfied active pack prevents attachment.

The extension checks the BDS executable version and stock executable-section hash, LeviLamina version, wire protocol, loaded PreLoader, and SDK runtime-data hashes before enabling native hooks. `Hello` checks the caller role, token, and full compatibility tuple including the SHA-256 of the installed compatibility manifest. An unavailable listener reports connection refusal at the transport boundary. The automation host maps that to `ExtensionMissing`. Lifecycle terminal reasons travel on the packet stream and remain queryable through control while the bridge is running.

Each attachment keeps the native script entity ID, runtime ID, and GameTest ownership. Multiple native simulated players can share the BDS network tuple. The bridge scopes native packet dispatch to the actor selected by the authenticated session. Outgoing player and entity sends use the actual recipient. Native broadcasts and scoped network sends retain their recipient scope. When a network-only send has an ambiguous recipient, the bridge drops it. BDS constructs the startup packets and supplies the player's inventory and terrain. The bridge carries the most recently addressed title, HUD, and open-screen state into the renderer lifecycle. Control requests and native input are handled on the server thread. A virtual lease overrides the simulated player's movement intent at the native movement pass. Revocation clears held behavior and queued packet input must still present the current session generation and lease when BDS dispatches it.

## Build and exercise the component

Use the pinned `xmake` and `clang-cl` environment. Copy `Bedform/Native/Bridge`, `Bedform/Contract/AutomationContract.h`, and `Bedform/compatibility.json` into an isolated build directory while preserving their relative layout. Run these commands from the copied `Bridge` directory.

```powershell
xmake f -P . -a x64 -m release -p windows -y
xmake -P . -j 1 BedformNativeBridge
```

The built DLL and [loader manifest](manifest.json) are the extension artifacts. The fixed-runner fixture takes explicit paths to the built DLL, the pinned loader-patched BDS executable from the [native feasibility fixture](../README.md), the extracted `releases` directory, and the exact `bedrock_runtime_data` file. From the repository root, using Node 24.19.0:

```powershell
node --import tsx Package/Cinnabar/Bedform/Native/Bridge/RunNativeFixture.mjs `
    $bridgeDll $patchedBds $loaderReleases $runtimeData
```

The runner uses `Package/Bedform/dist/bds-runtime/bedrock_server.exe` and the package's `physics-bds.lock`. It stages a disposable world, script pack, and resource pack. It verifies the stock executable, backs up runtime files, and restores and verifies the executable and server properties after stopping its own process. Use the repository's existing fixed-path firewall setup. Logs and JSON operation results go under `Package/Cinnabar/.local/8ww-3-native/`.

The host peer validates the v1 JSON envelopes and decodes Cinnabar packet frames. The scenario exercises both spawn APIs concurrently and checks `StartGame` IDs against the script IDs, native terrain and pack bytes, existing and targeted UI state, virtual and native movement lease isolation, native look input, death and respawn, a dimension transition, stale session rejection, detach and reattach, GameTest completion, explicit removal, socket loss, and orderly shutdown. Production host and renderer gameplay, inventory, and DDUI qualification are tracked in `Bedform-8ww.6`.

## Native evidence

The November 23, 2026 run `cinnabar-bridge-c2b2fec5-8b9f-4fd5-9137-de2f19b3d8cb` passed on BDS 1.26.60.6 build 52886189 with wire protocol 2225, LeviLamina 26.60.8, SDK 26.60.6-server.16, and PreLoader 1.16.8. The standalone script and native `StartGame` IDs were `4294967297` and runtime `1`. The GameTest IDs were `4294967298` and runtime `2`. Script enumeration contained the same two original actors before and after attachment. Native yaw changed to 45° for the standalone player and approximately −30° for the GameTest player under their respective leases. The standalone player moved about 0.098 blocks in the horizontal plane under virtual input. The fixture also verified targeted UI isolation, the resource pack byte hash on both streams, a fresh reattach generation, and terminal packet delivery for detach, GameTest completion, native removal, and shutdown. The fixed executable and server properties were restored and verified.
